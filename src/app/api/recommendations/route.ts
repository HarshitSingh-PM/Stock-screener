import { NextRequest, NextResponse } from "next/server";
import { getMarket } from "@/lib/markets";
import { buildRecommendations, readCachedRecommendations } from "@/lib/recommend";

export const maxDuration = 300;

// GET /api/recommendations?market=IN|US[&limit=120][&refresh=1]
//
// Serves today's cached recommendation set when available. A cache computed
// over MORE symbols than requested still satisfies the request. The server
// cron hits ?limit=500&refresh=1 after each market close so interactive
// visitors almost always get an instant, full-universe answer.
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const market = getMarket(searchParams.get("market"));
  const limit = Math.max(20, parseInt(searchParams.get("limit") || "120"));
  const refresh = searchParams.get("refresh") === "1";

  const today = new Date().toISOString().slice(0, 10);
  if (!refresh) {
    const cached = readCachedRecommendations(market);
    if (cached && cached.date === today && cached.scanned >= Math.min(limit, cached.universe)) {
      return NextResponse.json({ ...cached, fromCache: true });
    }
  }

  try {
    const set = await buildRecommendations(market, limit);
    return NextResponse.json({ ...set, fromCache: false });
  } catch (e) {
    // Serve a stale cache over a hard failure — picks from the last session
    // beat an error page.
    const cached = readCachedRecommendations(market);
    if (cached) return NextResponse.json({ ...cached, fromCache: true, stale: true });
    return NextResponse.json({ error: "Failed to build recommendations" }, { status: 500 });
  }
}
