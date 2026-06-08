import { getHistoricalData, getIntradayData } from "./stockData";
import { getMarketConfig, type Market } from "./markets";
import { analyze, LONGTERM_PROFILE } from "./botBrain";
import { enabledSetFromEdges } from "./strategyEdge";
import { longTermDecide, simulateIntradaySession, groupByDay, type SymBars } from "./botTrader";
import { freshState, type BotSnapshot, type BotTrade, type BotKind } from "./botStorage";
import type { OHLCV } from "./indicators";

// ─────────────────────────────────────────────────────────────────────────────
// Historical backtester. Replays the bots' ACTUAL decision cores
// (longTermDecide / simulateIntradaySession) day-by-day over a trailing window,
// so the numbers reflect the live engines rather than a parallel re-implementation.
//
// Caveat: the long-term fundamental tilt is skipped in backtest (Yahoo only
// exposes current fundamentals, not as-of-date), so historical long-term picks
// are driven purely by the technical brain + 110-strategy confluence.
// ─────────────────────────────────────────────────────────────────────────────

const SCAN_BATCH = 6;
const MIN_SESSION_BARS = 6; // skip intraday sessions with too few bars to trade

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export interface BacktestResult {
  market: Market;
  kind: BotKind;
  startingCapital: number;
  finalEquity: number;
  totalReturnPct: number;
  fromDate: string;
  toDate: string;
  tradingDays: number;
  totalTrades: number;
  buys: number;
  sells: number;
  winningSells: number;
  winRatePct: number;       // % of closed trades that were profitable
  avgWinPct: number;        // avg % gain on winning closed trades
  avgLossPct: number;       // avg % loss on losing closed trades
  maxDrawdownPct: number;
  bestDayPct: number;
  worstDayPct: number;
  snapshots: BotSnapshot[]; // equity curve
  note: string;
}

function cutoffISO(lastISO: string, lookbackDays: number): string {
  const d = new Date(lastISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - lookbackDays);
  return isoDate(d);
}

function metrics(
  market: Market, kind: BotKind, startingCapital: number,
  snapshots: BotSnapshot[], trades: BotTrade[], note: string,
): BacktestResult {
  const finalEquity = snapshots.length ? snapshots[snapshots.length - 1].equity : startingCapital;
  const buys = trades.filter(t => t.action === "BUY").length;
  const sellTrades = trades.filter(t => t.action === "SELL" && t.realizedPnL != null);
  const sells = sellTrades.length;

  // Win rate + avg win/loss on closed trades (using realized vs cost basis).
  let winning = 0, winPctSum = 0, winCount = 0, lossPctSum = 0, lossCount = 0;
  for (const s of sellTrades) {
    const cost = s.total - (s.realizedPnL ?? 0); // proceeds - pnl = cost basis
    const pct = cost > 0 ? ((s.realizedPnL ?? 0) / cost) * 100 : 0;
    if ((s.realizedPnL ?? 0) > 0) { winning++; winPctSum += pct; winCount++; }
    else if ((s.realizedPnL ?? 0) < 0) { lossPctSum += pct; lossCount++; }
  }

  // Max drawdown on the equity curve.
  let peak = startingCapital, maxDD = 0;
  for (const s of snapshots) {
    if (s.equity > peak) peak = s.equity;
    const dd = peak > 0 ? ((s.equity - peak) / peak) * 100 : 0;
    if (dd < maxDD) maxDD = dd;
  }

  // Best / worst single-day equity change.
  let bestDay = 0, worstDay = 0;
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1].equity, cur = snapshots[i].equity;
    const chg = prev > 0 ? ((cur - prev) / prev) * 100 : 0;
    if (chg > bestDay) bestDay = chg;
    if (chg < worstDay) worstDay = chg;
  }
  // include day 1 vs starting capital
  if (snapshots.length) {
    const d1 = ((snapshots[0].equity - startingCapital) / startingCapital) * 100;
    if (d1 > bestDay) bestDay = d1;
    if (d1 < worstDay) worstDay = d1;
  }

  return {
    market, kind, startingCapital,
    finalEquity: Math.round(finalEquity * 100) / 100,
    totalReturnPct: Math.round(((finalEquity - startingCapital) / startingCapital) * 10000) / 100,
    fromDate: snapshots[0]?.date ?? "",
    toDate: snapshots[snapshots.length - 1]?.date ?? "",
    tradingDays: snapshots.length,
    totalTrades: trades.length,
    buys, sells, winningSells: winning,
    winRatePct: sells > 0 ? Math.round((winning / sells) * 1000) / 10 : 0,
    avgWinPct: winCount > 0 ? Math.round((winPctSum / winCount) * 100) / 100 : 0,
    avgLossPct: lossCount > 0 ? Math.round((lossPctSum / lossCount) * 100) / 100 : 0,
    maxDrawdownPct: Math.round(maxDD * 100) / 100,
    bestDayPct: Math.round(bestDay * 100) / 100,
    worstDayPct: Math.round(worstDay * 100) / 100,
    snapshots,
    note,
  };
}

// Upper-bound index: number of candles with date <= d (candles are chronological).
function countUpTo(dates: string[], d: string): number {
  let lo = 0, hi = dates.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (dates[m] <= d) lo = m + 1; else hi = m; }
  return lo;
}

export async function backtestLongTerm(market: Market, lookbackDays = 30): Promise<BacktestResult> {
  const cfg = getMarketConfig(market);

  // Fetch daily candles once per symbol.
  const data = new Map<string, { candles: OHLCV[]; dates: string[] }>();
  const symbols = cfg.botUniverse;
  for (let i = 0; i < symbols.length; i += SCAN_BATCH) {
    const batch = symbols.slice(i, i + SCAN_BATCH);
    const results = await Promise.allSettled(batch.map(async (sym) => {
      const candles = await getHistoricalData(sym, 400, market);
      return { sym, candles };
    }));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.candles.length >= LONGTERM_PROFILE.minBars + 5) {
        data.set(r.value.sym, { candles: r.value.candles, dates: r.value.candles.map(c => isoDate(c.date)) });
      }
    }
  }

  // Trading dates = union of all candle dates, restricted to the trailing window.
  const dateSet = new Set<string>();
  for (const { dates } of data.values()) for (const d of dates) dateSet.add(d);
  const allDates = [...dateSet].sort();
  if (allDates.length === 0) {
    return metrics(market, "longterm", cfg.botStartingCapital, [], [], "No data available.");
  }
  const cut = cutoffISO(allDates[allDates.length - 1], lookbackDays);
  const windowDates = allDates.filter(d => d >= cut);

  // Walk-forward adaptive pruning: derive the enabled-strategy set from history
  // BEFORE the window (no look-ahead), then apply it throughout — mirrors live.
  const preWindow = new Map<string, OHLCV[]>();
  for (const [sym, { candles, dates }] of data) {
    const n = countUpTo(dates, windowDates[0]); // candles strictly before window start
    if (n >= LONGTERM_PROFILE.minBars) preWindow.set(sym, candles.slice(0, n));
  }
  const enabled = enabledSetFromEdges(preWindow);

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
    if (theses.size === 0) continue;
    longTermDecide(state, theses, emptyQuality, d);
  }

  return metrics(
    market, "longterm", state.startingCapital, state.snapshots, state.trades,
    `Replayed ${windowDates.length} trading days with adaptive pruning (${enabled.size}/110 strategies kept) + regime-aware cash. Fundamental tilt disabled in backtest.`,
  );
}

export async function backtestIntraday(market: Market, lookbackDays = 30): Promise<BacktestResult> {
  const cfg = getMarketConfig(market);

  // Fetch intraday 15m bars once per symbol (Yahoo caps 15m history ~60 days).
  const fetched: { symbol: string; candles: OHLCV[]; days: { date: string; idx: number[] }[] }[] = [];
  const symbols = cfg.botUniverse;
  for (let i = 0; i < symbols.length; i += SCAN_BATCH) {
    const batch = symbols.slice(i, i + SCAN_BATCH);
    const results = await Promise.allSettled(batch.map(async (sym) => {
      const candles = await getIntradayData(sym, market, "15m", Math.min(lookbackDays + 8, 58));
      return { symbol: sym, candles, days: groupByDay(candles) };
    }));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.candles.length > 0 && r.value.days.length > 1) fetched.push(r.value);
    }
  }

  // Session dates = union across symbols, restricted to the trailing window.
  const dateSet = new Set<string>();
  for (const f of fetched) for (const day of f.days) dateSet.add(day.date);
  const allDates = [...dateSet].sort();
  if (allDates.length === 0) {
    return metrics(market, "intraday", cfg.botStartingCapital, [], [], "No intraday data available.");
  }
  const cut = cutoffISO(allDates[allDates.length - 1], lookbackDays);
  // exclude the earliest day (used only as warm-up history) and stay in window
  const windowSessions = allDates.filter((d, i) => i > 0 && d >= cut);

  const startingCapital = cfg.botStartingCapital;
  let cash = startingCapital;
  let realizedTotal = 0;
  const snapshots: BotSnapshot[] = [];
  const allTrades: BotTrade[] = [];

  for (const d of windowSessions) {
    const symBars: SymBars[] = [];
    for (const f of fetched) {
      const session = f.days.find(x => x.date === d);
      if (!session || session.idx.length < MIN_SESSION_BARS) continue;
      symBars.push({ symbol: f.symbol, candles: f.candles, sessionIdx: session.idx });
    }
    if (symBars.length === 0) continue;

    const sim = simulateIntradaySession(symBars, d, cash, cash);
    cash = sim.endCash;
    realizedTotal += sim.realized;
    allTrades.push(...sim.trades);
    const pnl = cash - startingCapital;
    snapshots.push({
      date: d,
      cash: Math.round(cash * 100) / 100,
      holdingsValue: 0,
      equity: Math.round(cash * 100) / 100,
      pnl: Math.round(pnl * 100) / 100,
      pnlPercent: Math.round((pnl / startingCapital) * 1000) / 10,
      positions: 0,
      tradesCount: sim.trades.length,
    });
  }

  return metrics(
    market, "intraday", startingCapital, snapshots, allTrades,
    `Replayed ${snapshots.length} sessions of 15m bars. Same-day round trips, flat overnight, compounding.`,
  );
}

export function runBacktest(market: Market, kind: BotKind, lookbackDays = 30): Promise<BacktestResult> {
  return kind === "intraday" ? backtestIntraday(market, lookbackDays) : backtestLongTerm(market, lookbackDays);
}
