import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getMarket, getMarketConfig } from "@/lib/markets";
import { backtestMarket } from "@/lib/marketPredict";
import type { OHLCV } from "@/lib/indicators";

const yahooFinance = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey"] });

export const maxDuration = 120;
export const dynamic = "force-dynamic";

// GET /api/market/predict-backtest?market=IN|US&days=90
// Backtests the "Tomorrow's Call" next-day predictor over the trailing window
// for each of the market's indices.
export async function GET(request: NextRequest) {
  const market = getMarket(request.nextUrl.searchParams.get("market"));
  const days = Math.max(20, Math.min(250, parseInt(request.nextUrl.searchParams.get("days") || "90", 10) || 90));
  const horizon = Math.max(1, Math.min(20, parseInt(request.nextUrl.searchParams.get("horizon") || "5", 10) || 5));
  const cfg = getMarketConfig(market);

  const results = await Promise.all(cfg.indices.map(async ({ symbol, name }) => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 500); // enough history for window + 60-bar warmup
      const res: any = await yahooFinance.chart(symbol, { period1: startDate, period2: endDate, interval: "1d" });
      const candles: OHLCV[] = (res?.quotes || [])
        .filter((q: any) => q.open != null && q.high != null && q.low != null && q.close != null && q.volume != null)
        .map((q: any) => ({ date: new Date(q.date), open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume }));
      const bt = backtestMarket(candles, horizon, days);
      return { symbol, name, backtest: bt };
    } catch {
      return { symbol, name, backtest: null };
    }
  }));

  return NextResponse.json({ market, days, horizon, indices: results });
}
