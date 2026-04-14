import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { sma, ema, rsi, bollingerBands, pivotPoints, atr } from "@/lib/indicators";

const yahooFinance = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey"] });

export async function GET() {
  try {
    // Fetch Sensex and Nifty 50
    const indices = [
      { symbol: "^BSESN", name: "SENSEX" },
      { symbol: "^NSEI", name: "NIFTY 50" },
    ];

    const results = await Promise.all(
      indices.map(async ({ symbol, name }) => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 365);

        const result: any = await yahooFinance.chart(symbol, {
          period1: startDate,
          period2: endDate,
          interval: "1d",
        });

        if (!result?.quotes || result.quotes.length === 0) return null;

        const candles = result.quotes
          .filter(
            (q: any) =>
              q.open != null && q.high != null && q.low != null && q.close != null && q.volume != null
          )
          .map((q: any) => ({
            date: new Date(q.date),
            open: q.open,
            high: q.high,
            low: q.low,
            close: q.close,
            volume: q.volume,
          }));

        if (candles.length < 20) return null;

        const closes = candles.map((c: any) => c.close);
        const highs = candles.map((c: any) => c.high);
        const lows = candles.map((c: any) => c.low);
        const last = candles.length - 1;

        // OHLC for chart
        const ohlc = candles.map((c: any) => ({
          time: Math.floor(c.date.getTime() / 1000),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));

        const volumes = candles.map((c: any) => ({
          time: Math.floor(c.date.getTime() / 1000),
          value: c.volume,
          color: c.close >= c.open ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
        }));

        // Indicators
        const sma20 = sma(closes, 20);
        const sma50 = sma(closes, 50);
        const sma200 = sma(closes, 200);
        const ema21vals = ema(closes, 21);
        const rsiVals = rsi(closes, 14);
        const bb = bollingerBands(closes, 20, 2);
        const atrVals = atr(highs, lows, closes, 14);

        // Current values
        const currentPrice = closes[last];
        const prevClose = closes[last - 1];
        const change = currentPrice - prevClose;
        const changePct = (change / prevClose) * 100;
        const currentRsi = rsiVals[last];
        const currentAtr = atrVals[last];

        // Pivot Points (using previous day's HLC)
        const pp = pivotPoints(highs[last - 1], lows[last - 1], closes[last - 1]);

        // Fibonacci levels from recent swing high/low (last 60 days)
        const recent60H = highs.slice(-60);
        const recent60L = lows.slice(-60);
        const swingHigh = Math.max(...recent60H);
        const swingLow = Math.min(...recent60L);
        const fibRange = swingHigh - swingLow;
        const fibonacci = {
          level0: swingLow,
          level236: swingLow + fibRange * 0.236,
          level382: swingLow + fibRange * 0.382,
          level500: swingLow + fibRange * 0.5,
          level618: swingLow + fibRange * 0.618,
          level786: swingLow + fibRange * 0.786,
          level100: swingHigh,
        };

        // Find recent support & resistance levels
        // Support: recent swing lows (local minima in last 60 days)
        // Resistance: recent swing highs (local maxima in last 60 days)
        const supports: number[] = [];
        const resistances: number[] = [];
        const lookback = Math.min(60, candles.length - 2);

        for (let i = candles.length - lookback; i < candles.length - 1; i++) {
          if (i < 2) continue;
          // Local minimum
          if (lows[i] <= lows[i - 1] && lows[i] <= lows[i - 2] && lows[i] <= lows[i + 1]) {
            supports.push(lows[i]);
          }
          // Local maximum
          if (highs[i] >= highs[i - 1] && highs[i] >= highs[i - 2] && highs[i] >= highs[i + 1]) {
            resistances.push(highs[i]);
          }
        }

        // Cluster nearby levels (within 1%)
        function clusterLevels(levels: number[]): number[] {
          if (levels.length === 0) return [];
          const sorted = [...levels].sort((a, b) => a - b);
          const clusters: number[] = [];
          let cluster = [sorted[0]];
          for (let i = 1; i < sorted.length; i++) {
            if ((sorted[i] - sorted[i - 1]) / sorted[i - 1] < 0.01) {
              cluster.push(sorted[i]);
            } else {
              clusters.push(cluster.reduce((a, b) => a + b, 0) / cluster.length);
              cluster = [sorted[i]];
            }
          }
          clusters.push(cluster.reduce((a, b) => a + b, 0) / cluster.length);
          return clusters;
        }

        const keySupports = clusterLevels(supports)
          .filter((s) => s < currentPrice)
          .sort((a, b) => b - a)
          .slice(0, 3);

        const keyResistances = clusterLevels(resistances)
          .filter((r) => r > currentPrice)
          .sort((a, b) => a - b)
          .slice(0, 3);

        // Targets based on ATR projections
        const atrVal = currentAtr || 0;
        const targets = {
          bullishTarget1: currentPrice + atrVal * 1.5,
          bullishTarget2: currentPrice + atrVal * 3,
          bearishTarget1: currentPrice - atrVal * 1.5,
          bearishTarget2: currentPrice - atrVal * 3,
        };

        // Trend assessment
        let trend = "SIDEWAYS";
        if (sma50[last] && sma200[last]) {
          if (currentPrice > sma50[last]! && sma50[last]! > sma200[last]!) trend = "BULLISH";
          else if (currentPrice < sma50[last]! && sma50[last]! < sma200[last]!) trend = "BEARISH";
        }

        // Format indicator lines for chart overlay
        const indicatorLines: Record<string, any[]> = {
          "SMA 20": sma20.map((v, i) => v !== null ? { time: ohlc[i].time, value: v } : null).filter(Boolean),
          "SMA 50": sma50.map((v, i) => v !== null ? { time: ohlc[i].time, value: v } : null).filter(Boolean),
          "SMA 200": sma200.map((v, i) => v !== null ? { time: ohlc[i].time, value: v } : null).filter(Boolean),
          "EMA 21": ema21vals.map((v, i) => v !== null ? { time: ohlc[i].time, value: v } : null).filter(Boolean),
          "BB Upper": bb.upper.map((v, i) => v !== null ? { time: ohlc[i].time, value: v } : null).filter(Boolean),
          "BB Lower": bb.lower.map((v, i) => v !== null ? { time: ohlc[i].time, value: v } : null).filter(Boolean),
        };

        // RSI data
        const rsiData = rsiVals.map((v, i) => v !== null ? { time: ohlc[i].time, value: v } : null).filter(Boolean);

        return {
          name,
          symbol,
          currentPrice,
          change,
          changePct,
          trend,
          rsi: currentRsi,
          atr: atrVal,
          ohlc,
          volumes,
          indicatorLines,
          rsiData,
          pivots: pp,
          fibonacci,
          keySupports,
          keyResistances,
          targets,
          yearHigh: Math.max(...highs),
          yearLow: Math.min(...lows),
        };
      })
    );

    return NextResponse.json({
      indices: results.filter(Boolean),
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch market data" }, { status: 500 });
  }
}
