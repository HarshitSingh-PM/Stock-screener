import { NextRequest, NextResponse } from "next/server";
import { getMarket, getMarketConfig } from "@/lib/markets";
import { resetBotState } from "@/lib/botStorage";

export const dynamic = "force-dynamic";

// POST /api/bot/reset?market=IN|US
// Wipes the market's bot state back to starting capital. Used from the UI.
export async function POST(request: NextRequest) {
  const market = getMarket(request.nextUrl.searchParams.get("market"));
  const cfg = getMarketConfig(market);
  const state = await resetBotState(market, cfg.botStartingCapital);
  return NextResponse.json({ ok: true, state });
}
