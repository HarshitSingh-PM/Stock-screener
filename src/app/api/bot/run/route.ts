import { NextRequest, NextResponse } from "next/server";
import { getMarket, getMarketConfig, type Market } from "@/lib/markets";
import { loadBotState, saveBotState, type BotKind } from "@/lib/botStorage";
import { runBotDay } from "@/lib/botTrader";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// POST /api/bot/run?market=IN|US&kind=longterm|intraday&both=1&kinds=all
//   market  — which market (default IN)
//   kind    — which bot (default longterm)
//   both=1  — run both markets
//   kinds=all — run both bots (intraday + longterm)
// Idempotent per bot: skips if it already ran for the relevant day/session.
export async function POST(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const both = sp.get("both") === "1";
  const markets: Market[] = both ? ["IN", "US"] : [getMarket(sp.get("market"))];
  const kinds: BotKind[] = sp.get("kinds") === "all"
    ? ["longterm", "intraday"]
    : [sp.get("kind") === "intraday" ? "intraday" : "longterm"];

  const runs = [];
  for (const m of markets) {
    const cfg = getMarketConfig(m);
    for (const k of kinds) {
      const state = await loadBotState(m, k, cfg.botStartingCapital);
      const summary = await runBotDay(state);
      if (summary.ran) await saveBotState(summary.state);
      runs.push({
        market: summary.market,
        kind: summary.kind,
        ran: summary.ran,
        reason: summary.reason,
        evaluatedHoldings: summary.evaluatedHoldings,
        evaluatedCandidates: summary.evaluatedCandidates,
        trades: summary.trades,
        snapshot: summary.snapshot,
      });
    }
  }

  return NextResponse.json({ runs });
}

// GET equivalent so cron services that only do GET can hit it.
export async function GET(request: NextRequest) {
  return POST(request);
}
