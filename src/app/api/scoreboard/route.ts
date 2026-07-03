import { NextRequest, NextResponse } from "next/server";
import { getMarket } from "@/lib/markets";
import { readLedger, resolveLedger, computeStats } from "@/lib/pickLedger";

export const maxDuration = 300;

const RESOLVE_STALENESS_MS = 6 * 60 * 60 * 1000;

// GET /api/scoreboard?market=IN|US[&resolve=1]
//
// Returns the public pick track record. Open picks are resolved against real
// prices when ?resolve=1 (the daily cron) or when the last resolution is
// older than 6 hours (lazy refresh for visitors).
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const market = getMarket(searchParams.get("market"));
  const force = searchParams.get("resolve") === "1";

  let ledger = readLedger(market);
  const stale =
    !ledger.lastResolvedAt ||
    Date.now() - new Date(ledger.lastResolvedAt).getTime() > RESOLVE_STALENESS_MS;

  if (force || (stale && ledger.entries.some((e) => e.status === "open"))) {
    try {
      ledger = await resolveLedger(market);
    } catch { /* serve the un-resolved ledger */ }
  }

  const open = ledger.entries
    .filter((e) => e.status === "open")
    .sort((a, b) => (b.date < a.date ? -1 : 1));
  const resolved = ledger.entries
    .filter((e) => e.status !== "open" && e.status !== "void")
    .sort((a, b) => ((b.exitDate ?? "") < (a.exitDate ?? "") ? -1 : 1))
    .slice(0, 100);

  return NextResponse.json({
    market,
    stats: computeStats(ledger),
    open,
    resolved,
    lastResolvedAt: ledger.lastResolvedAt,
  });
}
