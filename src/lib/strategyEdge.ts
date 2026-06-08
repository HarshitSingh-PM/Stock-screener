import { STRATEGIES } from "./strategies";
import { LONGTERM_PROFILE } from "./botBrain";
import type { OHLCV } from "./indicators";

// ─────────────────────────────────────────────────────────────────────────────
// Adaptive strategy pruning. Measures each strategy's recent forward-return edge
// (when it fires BUY, what happens over the next `horizon` bars) across the
// universe, and returns the set of strategies worth listening to right now.
//
// This is what lets the bot "ignore" strategies that have been losing money —
// and it doubles as a regime tilt: in a choppy/down tape the trend/breakout
// strategies show negative edge and get pruned automatically; in an uptrend they
// earn their way back in.
// ─────────────────────────────────────────────────────────────────────────────

const MIN_HISTORY = LONGTERM_PROFILE.minBars;

export interface EdgeStat {
  id: string; name: string; book: string; category: string;
  fires: number; avgFwdRetPct: number; winRatePct: number;
}

export function computeEdges(candleMap: Map<string, OHLCV[]>, lookbackDays = 30, horizon = 5): EdgeStat[] {
  const acc = new Map<string, { fires: number; sum: number; wins: number }>();
  for (const s of STRATEGIES) acc.set(s.id, { fires: 0, sum: 0, wins: 0 });

  for (const candles of candleMap.values()) {
    const n = candles.length;
    if (n < MIN_HISTORY + horizon + 1) continue;
    const firstEval = Math.max(MIN_HISTORY, n - lookbackDays - horizon);
    for (let i = firstEval; i < n - horizon; i++) {
      const cur = candles[i].close;
      if (!(cur > 0)) continue;
      const fwd = (candles[i + horizon].close - cur) / cur;
      const slice = candles.slice(0, i + 1);
      for (const s of STRATEGIES) {
        try {
          if (s.evaluate(slice).signal === "BUY") {
            const a = acc.get(s.id)!;
            a.fires++; a.sum += fwd; if (fwd > 0) a.wins++;
          }
        } catch { /* ignore */ }
      }
    }
  }

  return STRATEGIES.map(s => {
    const a = acc.get(s.id)!;
    return {
      id: s.id, name: s.name, book: s.book, category: s.category,
      fires: a.fires,
      avgFwdRetPct: a.fires ? (a.sum / a.fires) * 100 : 0,
      winRatePct: a.fires ? (a.wins / a.fires) * 100 : 0,
    };
  }).sort((x, y) => y.avgFwdRetPct - x.avgFwdRetPct);
}

// Keep a strategy if it has positive recent edge, OR too little evidence to judge
// (don't prune on noise). Falls back to the top strategies by edge if pruning is
// too aggressive, so the bot always has signals to work with.
export function enabledSetFromEdges(
  candleMap: Map<string, OHLCV[]>,
  lookbackDays = 30, horizon = 5, thresholdPct = 0.1, minFires = 5,
): Set<string> {
  const edges = computeEdges(candleMap, lookbackDays, horizon);
  const enabled = new Set<string>();
  for (const e of edges) {
    if (e.fires < minFires || e.avgFwdRetPct > thresholdPct) enabled.add(e.id);
  }
  if (enabled.size < 12) {
    for (const e of edges.slice(0, 20)) enabled.add(e.id);
  }
  return enabled;
}
