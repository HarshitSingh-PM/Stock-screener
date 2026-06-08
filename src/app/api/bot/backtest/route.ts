import { NextRequest, NextResponse } from "next/server";
import { getMarket } from "@/lib/markets";
import { runBacktest } from "@/lib/botBacktest";
import type { BotKind } from "@/lib/botStorage";

export const maxDuration = 800;
export const dynamic = "force-dynamic";

// GET /api/bot/backtest?market=IN|US&kind=longterm|intraday&days=30
// Replays the bot's decision core day-by-day over the trailing window.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const market = getMarket(sp.get("market"));
  const kind: BotKind = sp.get("kind") === "intraday" ? "intraday" : "longterm";
  const days = Math.max(5, Math.min(60, parseInt(sp.get("days") || "30", 10) || 30));

  const result = await runBacktest(market, kind, days);
  // Drop the full snapshot array from the default response to keep it light;
  // callers that want the curve can request it explicitly.
  const includeCurve = sp.get("curve") === "1";
  return NextResponse.json(includeCurve ? result : { ...result, snapshots: undefined });
}
