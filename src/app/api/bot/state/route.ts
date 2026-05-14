import { NextRequest, NextResponse } from "next/server";
import { getMarket, getMarketConfig } from "@/lib/markets";
import { loadBotState } from "@/lib/botStorage";
import { getHistoricalData } from "@/lib/stockData";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/bot/state?market=IN|US
// Returns current bot state for the market plus live mark-to-market values.
export async function GET(request: NextRequest) {
  const market = getMarket(request.nextUrl.searchParams.get("market"));
  const cfg = getMarketConfig(market);
  const state = await loadBotState(market, cfg.botStartingCapital);

  // Mark-to-market each holding using the most recent close.
  const liveHoldings = await Promise.all(
    state.holdings.map(async (h) => {
      const candles = await getHistoricalData(h.symbol, 30, market);
      const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : h.avgBuyPrice;
      const currentValue = h.quantity * currentPrice;
      const cost = h.quantity * h.avgBuyPrice;
      const unrealizedPnL = currentValue - cost;
      const unrealizedPnLPercent = cost > 0 ? (unrealizedPnL / cost) * 100 : 0;
      return {
        ...h,
        currentPrice,
        currentValue,
        cost,
        unrealizedPnL,
        unrealizedPnLPercent,
      };
    })
  );

  const holdingsValue = liveHoldings.reduce((s, h) => s + h.currentValue, 0);
  const equity = state.cash + holdingsValue;
  const totalPnL = equity - state.startingCapital;
  const unrealizedPnL = liveHoldings.reduce((s, h) => s + h.unrealizedPnL, 0);

  return NextResponse.json({
    market,
    startingCapital: state.startingCapital,
    cash: state.cash,
    holdingsValue,
    equity,
    totalPnL,
    totalPnLPercent: state.startingCapital > 0 ? (totalPnL / state.startingCapital) * 100 : 0,
    realizedPnL: state.realizedPnL,
    unrealizedPnL,
    holdings: liveHoldings,
    trades: state.trades,
    snapshots: state.snapshots,
    lastRunDate: state.lastRunDate,
    createdAt: state.createdAt,
    positionsOpen: state.holdings.length,
    maxPositions: 5,
  });
}
