import { NextRequest, NextResponse } from "next/server";
import { getMarket, getMarketConfig } from "@/lib/markets";
import { loadBotState, saveBotState } from "@/lib/botStorage";
import { runBotDay } from "@/lib/botTrader";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// POST /api/bot/run?market=IN|US&both=1
// Runs one trading day for the requested market (or both if both=1).
// Idempotent: if state.lastRunDate is today, returns without retrading.
export async function POST(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const both = sp.get("both") === "1";
  const markets = both ? (["IN", "US"] as const) : [getMarket(sp.get("market"))];

  const summaries = [];
  for (const m of markets) {
    const cfg = getMarketConfig(m);
    const state = await loadBotState(m, cfg.botStartingCapital);
    const summary = await runBotDay(state);
    if (summary.ran) await saveBotState(summary.state);
    summaries.push({
      market: summary.market,
      ran: summary.ran,
      reason: summary.reason,
      evaluatedHoldings: summary.evaluatedHoldings,
      evaluatedCandidates: summary.evaluatedCandidates,
      trades: summary.trades,
      snapshot: summary.snapshot,
    });
  }

  return NextResponse.json({ runs: summaries });
}

// GET equivalent so external cron services that only do GET can hit it.
export async function GET(request: NextRequest) {
  return POST(request);
}
