import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { sma, ema, rsi, bollingerBands, macd, supertrend } from "@/lib/indicators";
import { toYahooSymbol } from "@/lib/nifty200";

const yahooFinance = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey"] });

// Timeframe configs: interval -> { yahooInterval, period1 calculation }
const TIMEFRAMES: Record<string, { interval: string; days: number; timeVisible: boolean }> = {
  "1m":  { interval: "1m",  days: 1,     timeVisible: true },
  "5m":  { interval: "5m",  days: 5,     timeVisible: true },
  "15m": { interval: "15m", days: 10,    timeVisible: true },
  "1h":  { interval: "60m", days: 60,    timeVisible: true },
  "1d":  { interval: "1d",  days: 200,   timeVisible: false },
  "1wk": { interval: "1wk", days: 1095,  timeVisible: false },
  "1mo": { interval: "1mo", days: 1825,  timeVisible: false },
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol");
  const indicators = searchParams.get("indicators")?.split(",").filter(Boolean) || [];
  const tf = searchParams.get("tf") || "1d";
  const isIndex = searchParams.get("index") === "1"; // for ^BSESN, ^NSEI

  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  const config = TIMEFRAMES[tf] || TIMEFRAMES["1d"];
  const yahooSymbol = isIndex ? symbol : toYahooSymbol(symbol);

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - config.days);

    const result: any = await yahooFinance.chart(yahooSymbol, {
      period1: startDate,
      period2: endDate,
      interval: config.interval,
    });

    if (!result?.quotes || result.quotes.length === 0) {
      return NextResponse.json({ error: "No data" }, { status: 404 });
    }

    const candles = result.quotes.filter(
      (q: any) => q.open != null && q.high != null && q.low != null && q.close != null
    );

    const closes = candles.map((c: any) => c.close);
    const highs = candles.map((c: any) => c.high);
    const lows = candles.map((c: any) => c.low);

    const ohlc = candles.map((c: any) => ({
      time: Math.floor(new Date(c.date).getTime() / 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumes = candles.map((c: any) => ({
      time: Math.floor(new Date(c.date).getTime() / 1000),
      value: c.volume || 0,
      color: c.close >= c.open ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
    }));

    const indicatorData: Record<string, unknown[]> = {};

    // Only compute indicators if we have enough data
    if (closes.length >= 5) {
      for (const ind of indicators) {
        switch (ind) {
          case "sma20": {
            if (closes.length >= 20) {
              const values = sma(closes, 20);
              indicatorData["SMA 20"] = values.map((v, i) => v !== null ? { time: ohlc[i].time, value: v } : null).filter(Boolean);
            }
            break;
          }
          case "sma50": {
            if (closes.length >= 50) {
              const values = sma(closes, 50);
              indicatorData["SMA 50"] = values.map((v, i) => v !== null ? { time: ohlc[i].time, value: v } : null).filter(Boolean);
            }
            break;
          }
          case "sma200": {
            if (closes.length >= 200) {
              const values = sma(closes, 200);
              indicatorData["SMA 200"] = values.map((v, i) => v !== null ? { time: ohlc[i].time, value: v } : null).filter(Boolean);
            }
            break;
          }
          case "ema9": {
            if (closes.length >= 9) {
              const values = ema(closes, 9);
              indicatorData["EMA 9"] = values.map((v, i) => v !== null ? { time: ohlc[i].time, value: v } : null).filter(Boolean);
            }
            break;
          }
          case "ema21": {
            if (closes.length >= 21) {
              const values = ema(closes, 21);
              indicatorData["EMA 21"] = values.map((v, i) => v !== null ? { time: ohlc[i].time, value: v } : null).filter(Boolean);
            }
            break;
          }
          case "bb": {
            if (closes.length >= 20) {
              const bb = bollingerBands(closes);
              indicatorData["BB Upper"] = bb.upper.map((v, i) => v !== null ? { time: ohlc[i].time, value: v } : null).filter(Boolean);
              indicatorData["BB Middle"] = bb.middle.map((v, i) => v !== null ? { time: ohlc[i].time, value: v } : null).filter(Boolean);
              indicatorData["BB Lower"] = bb.lower.map((v, i) => v !== null ? { time: ohlc[i].time, value: v } : null).filter(Boolean);
            }
            break;
          }
          case "rsi": {
            if (closes.length >= 15) {
              const values = rsi(closes, 14);
              indicatorData["RSI"] = values.map((v, i) => v !== null ? { time: ohlc[i].time, value: v } : null).filter(Boolean);
            }
            break;
          }
          case "macd": {
            if (closes.length >= 30) {
              const m = macd(closes);
              indicatorData["MACD"] = m.macdLine.map((v, i) => v !== null ? { time: ohlc[i].time, value: v } : null).filter(Boolean);
              indicatorData["Signal"] = m.signalLine.map((v, i) => v !== null ? { time: ohlc[i].time, value: v } : null).filter(Boolean);
              indicatorData["Histogram"] = m.histogram.map((v, i) => v !== null ? { time: ohlc[i].time, value: v, color: (v as number) >= 0 ? "rgba(16, 185, 129, 0.6)" : "rgba(239, 68, 68, 0.6)" } : null).filter(Boolean);
            }
            break;
          }
          case "supertrend": {
            if (closes.length >= 15) {
              const st = supertrend(highs, lows, closes, 10, 3);
              indicatorData["Supertrend"] = st.supertrend.map((v, i) => v !== null ? { time: ohlc[i].time, value: v, color: st.direction[i] === 1 ? "#10b981" : "#ef4444" } : null).filter(Boolean);
            }
            break;
          }
        }
      }
    }

    return NextResponse.json({ ohlc, volumes, indicators: indicatorData, timeVisible: config.timeVisible });
  } catch {
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
