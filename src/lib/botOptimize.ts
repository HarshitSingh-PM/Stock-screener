import { getHistoricalData } from "./stockData";
import { getMarketConfig, type Market } from "./markets";
import { STRATEGIES } from "./strategies";
import { analyze, LONGTERM_PROFILE } from "./botBrain";
import { longTermDecide } from "./botTrader";
import { freshState } from "./botStorage";
import type { OHLCV } from "./indicators";

// ─────────────────────────────────────────────────────────────────────────────
// Strategy-selection optimizer for the long-term bot.
//
//   1. Measure each strategy's EDGE: over the window, whenever a strategy fires
//      BUY, what is the forward N-day return? Average that → the strategy's edge.
//   2. Iteratively DROP low/negative-edge strategies and re-replay the bot's real
//      decision core (longTermDecide), searching for the subset that maximizes
//      return. The dropped strategies are the ones the bot should ignore.
//
// CAVEAT: this is in-sample selection on the same window we score on, so it will
// overfit. Treat the chosen subset as a hypothesis to validate out-of-sample.
// ─────────────────────────────────────────────────────────────────────────────

const SCAN_BATCH = 6;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

interface DailyData { candles: OHLCV[]; dates: string[]; }

function countUpTo(dates: string[], d: string): number {
  let lo = 0, hi = dates.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (dates[m] <= d) lo = m + 1; else hi = m; }
  return lo;
}

function cutoffISO(lastISO: string, lookbackDays: number): string {
  const d = new Date(lastISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - lookbackDays);
  return isoDate(d);
}

async function fetchDaily(market: Market): Promise<Map<string, DailyData>> {
  const cfg = getMarketConfig(market);
  const data = new Map<string, DailyData>();
  for (let i = 0; i < cfg.botUniverse.length; i += SCAN_BATCH) {
    const batch = cfg.botUniverse.slice(i, i + SCAN_BATCH);
    const res = await Promise.allSettled(batch.map(async (sym) => ({ sym, candles: await getHistoricalData(sym, 400, market) })));
    for (const r of res) {
      if (r.status === "fulfilled" && r.value.candles.length >= LONGTERM_PROFILE.minBars + 5) {
        data.set(r.value.sym, { candles: r.value.candles, dates: r.value.candles.map(c => isoDate(c.date)) });
      }
    }
  }
  return data;
}

export interface StrategyEdge {
  id: string; name: string; book: string; category: string;
  fires: number; avgFwdRetPct: number; winRatePct: number;
}

// Forward-return edge per strategy on its BUY signals over the window.
function computeEdges(data: Map<string, DailyData>, windowDates: string[], horizon: number): StrategyEdge[] {
  const acc = new Map<string, { fires: number; sum: number; wins: number }>();
  for (const s of STRATEGIES) acc.set(s.id, { fires: 0, sum: 0, wins: 0 });

  for (const { candles, dates } of data.values()) {
    for (const d of windowDates) {
      const n = countUpTo(dates, d);
      if (n < LONGTERM_PROFILE.minBars) continue;
      const fwdIdx = n - 1 + horizon;
      if (fwdIdx >= candles.length) continue;
      const slice = candles.slice(0, n);
      const cur = candles[n - 1].close;
      const fwd = (candles[fwdIdx].close - cur) / cur;
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

interface ReplayResult { returnPct: number; finalEquity: number; trades: number; tradingDays: number; }

// Replay the real long-term decision core over the window with a given enabled set.
function replay(market: Market, data: Map<string, DailyData>, windowDates: string[], enabled?: Set<string>): ReplayResult {
  const cfg = getMarketConfig(market);
  const state = freshState(market, "longterm", cfg.botStartingCapital);
  const emptyQuality = new Map<string, number>();
  for (const d of windowDates) {
    const theses = new Map<string, NonNullable<ReturnType<typeof analyze>>>();
    for (const [sym, { candles, dates }] of data) {
      const n = countUpTo(dates, d);
      if (n < LONGTERM_PROFILE.minBars) continue;
      const th = analyze(sym, candles.slice(0, n), LONGTERM_PROFILE, enabled);
      if (th) theses.set(sym, th);
    }
    if (theses.size) longTermDecide(state, theses, emptyQuality, d);
  }
  const last = state.snapshots[state.snapshots.length - 1];
  const finalEquity = last ? last.equity : cfg.botStartingCapital;
  return {
    returnPct: ((finalEquity - cfg.botStartingCapital) / cfg.botStartingCapital) * 100,
    finalEquity,
    trades: state.trades.length,
    tradingDays: state.snapshots.length,
  };
}

export interface OptimizeResult {
  market: Market;
  window: { from: string; to: string; days: number };
  horizon: number;
  baselineReturnPct: number;
  candidates: { label: string; threshold: number | null; kept: number; dropped: number; returnPct: number; finalEquity: number; trades: number }[];
  best: { label: string; kept: number; dropped: number; returnPct: number; disabledIds: string[] };
  worstStrategies: StrategyEdge[]; // most negative-edge — the ones to ignore
  bestStrategies: StrategyEdge[];
}

export async function optimizeLongTerm(market: Market, lookbackDays = 20, horizon = 5): Promise<OptimizeResult> {
  const data = await fetchDaily(market);

  const dateSet = new Set<string>();
  for (const { dates } of data.values()) for (const d of dates) dateSet.add(d);
  const allDates = [...dateSet].sort();
  const cut = cutoffISO(allDates[allDates.length - 1], lookbackDays);
  const windowDates = allDates.filter(d => d >= cut);

  const edges = computeEdges(data, windowDates, horizon);
  const baseline = replay(market, data, windowDates, undefined);

  // Candidate enabled sets: drop strategies whose avg forward edge is below a
  // sweep of thresholds. Also a "keep top-K by edge" variant.
  const candidates: OptimizeResult["candidates"] = [];
  const setByThreshold = (thPct: number) => new Set(edges.filter(e => e.fires === 0 || e.avgFwdRetPct > thPct).map(e => e.id));
  // (Strategies that never fired in-window are kept — no evidence against them.)

  const thresholds = [0, 0.1, 0.25, 0.5, 1.0];
  const records: { label: string; threshold: number | null; enabled: Set<string>; res: ReplayResult }[] = [];
  records.push({ label: "all strategies (baseline)", threshold: null, enabled: new Set(STRATEGIES.map(s => s.id)), res: baseline });
  for (const th of thresholds) {
    const enabled = setByThreshold(th);
    if (enabled.size === 0 || enabled.size === STRATEGIES.length) continue;
    records.push({ label: `drop edge ≤ ${th}%`, threshold: th, enabled, res: replay(market, data, windowDates, enabled) });
  }
  // keep top-K by edge (only strategies that actually fired), K sweep
  const fired = edges.filter(e => e.fires > 0);
  for (const k of [60, 40, 25]) {
    const keep = new Set(fired.slice(0, k).map(e => e.id));
    // also keep never-fired strategies (neutral)
    for (const e of edges) if (e.fires === 0) keep.add(e.id);
    if (keep.size === 0) continue;
    records.push({ label: `keep top-${k} by edge`, threshold: null, enabled: keep, res: replay(market, data, windowDates, keep) });
  }

  for (const r of records) {
    candidates.push({
      label: r.label, threshold: r.threshold,
      kept: r.enabled.size, dropped: STRATEGIES.length - r.enabled.size,
      returnPct: Math.round(r.res.returnPct * 100) / 100,
      finalEquity: Math.round(r.res.finalEquity),
      trades: r.res.trades,
    });
  }

  const bestRec = records.reduce((a, b) => (b.res.returnPct > a.res.returnPct ? b : a));
  const disabledIds = STRATEGIES.map(s => s.id).filter(id => !bestRec.enabled.has(id));

  return {
    market,
    window: { from: windowDates[0], to: windowDates[windowDates.length - 1], days: windowDates.length },
    horizon,
    baselineReturnPct: Math.round(baseline.returnPct * 100) / 100,
    candidates: candidates.sort((a, b) => b.returnPct - a.returnPct),
    best: {
      label: bestRec.label, kept: bestRec.enabled.size, dropped: disabledIds.length,
      returnPct: Math.round(bestRec.res.returnPct * 100) / 100, disabledIds,
    },
    worstStrategies: edges.filter(e => e.fires >= 5).slice(-15).reverse(),
    bestStrategies: edges.filter(e => e.fires >= 5).slice(0, 15),
  };
}
