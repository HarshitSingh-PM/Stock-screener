import { NextRequest, NextResponse } from "next/server";
import { getMarket, getMarketConfig } from "@/lib/markets";
import { resetBotState, type BotKind } from "@/lib/botStorage";

export const dynamic = "force-dynamic";

// POST /api/bot/reset?market=IN|US&kind=longterm|intraday&kinds=all
// Wipes the bot state back to starting capital. Used from the UI.
export async function POST(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const market = getMarket(sp.get("market"));
  const cfg = getMarketConfig(market);
  const kinds: BotKind[] = sp.get("kinds") === "all"
    ? ["longterm", "intraday"]
    : [sp.get("kind") === "intraday" ? "intraday" : "longterm"];

  const states = [];
  for (const k of kinds) states.push(await resetBotState(market, k, cfg.botStartingCapital));
  return NextResponse.json({ ok: true, states });
}
