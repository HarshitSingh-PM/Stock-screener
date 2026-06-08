import { NextRequest, NextResponse } from "next/server";
import { getMarket } from "@/lib/markets";
import { optimizeLongTerm } from "@/lib/botOptimize";

export const maxDuration = 800;
export const dynamic = "force-dynamic";

// GET /api/bot/optimize?market=IN|US&days=20&horizon=5
// Measures per-strategy forward edge and searches strategy subsets that maximize
// the long-term bot's return over the window.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const market = getMarket(sp.get("market"));
  const days = Math.max(5, Math.min(60, parseInt(sp.get("days") || "20", 10) || 20));
  const horizon = Math.max(1, Math.min(20, parseInt(sp.get("horizon") || "5", 10) || 5));
  const result = await optimizeLongTerm(market, days, horizon);
  return NextResponse.json(result);
}
