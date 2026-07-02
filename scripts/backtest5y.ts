/**
 * 5-year, per-strategy backtest across the top-500 universes of both markets.
 *
 * Usage:
 *   npx tsx scripts/backtest5y.ts --chunk 0/6     # run one worker chunk
 *   npx tsx scripts/backtest5y.ts --merge         # merge partials -> data/backtest-5y.json
 *   npx tsx scripts/backtest5y.ts --calibrate     # timing check on 2 symbols
 *
 * Trade plan (mirrors how the site issues recommendations — entry/target/stop):
 * a BUY signal (strength >= 30) opens a long at that day's close with
 * target = entry + 1.5*ATR14 and stop = entry - 2.5*ATR14. Walk forward up to
 * `horizon` trading days (per strategy category): exit at target (win), stop
 * (loss), gap opens at the open price, both-hit-same-day counts as a LOSS
 * (conservative), else time-exit at the horizon close (win iff P&L > 0).
 * Cooldown per strategy per stock until the trade exits, so overlapping
 * signals don't double count.
 */
import fs from "node:fs";
import path from "node:path";
import YahooFinance from "yahoo-finance2";
import { ALL_STRATEGIES, Strategy } from "../src/lib/strategies";
import { SP500_SYMBOLS } from "../src/lib/universe/sp500";
import { IN_TOP500_SYMBOLS } from "../src/lib/universe/inTop500";
import type { OHLCV } from "../src/lib/indicators";

const yahoo = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey"] });

const SCRATCH = "/private/tmp/claude-501/-Users-harshitsingh/c5e818fa-0be7-48b3-bdcd-15465a230bbf/scratchpad";
const CANDLE_CACHE = path.join(SCRATCH, "candles");
const PARTIAL_DIR = path.join(SCRATCH, "bt-partials");
const OUT_JSON = path.join(process.cwd(), "data", "backtest-5y.json");

const WARMUP = 250; // bars of history each evaluate() sees before the first tradable bar
const MIN_STRENGTH = 30;
const YEARS = 5;

const HORIZON_BY_CATEGORY: Record<string, number> = {
  Intraday: 3,
  Scalping: 3,
  Swing: 10,
  "Price Action": 10,
  Candlestick: 10,
  Options: 10,
  Advanced: 10,
  Positional: 21,
  "Trend Following": 21,
  "Index Investing": 21,
  "Value Investing": 21,
};

interface StratAcc {
  trades: number; wins: number; sumRet: number;
  maxWin: number; maxLoss: number;
  sumPeak: number; sumPeakDay: number; sumDrawdown: number;
  targetHits: number; stopOuts: number; timeExits: number;
  byMarket: Record<string, { trades: number; wins: number; sumRet: number }>;
}

function newAcc(): StratAcc {
  return { trades: 0, wins: 0, sumRet: 0, maxWin: -Infinity, maxLoss: Infinity, sumPeak: 0, sumPeakDay: 0, sumDrawdown: 0, targetHits: 0, stopOuts: 0, timeExits: 0, byMarket: {} };
}

/** Wilder ATR(14) as absolute price units, aligned to candle index. */
function atr14(candles: OHLCV[]): number[] {
  const n = candles.length;
  const out = new Array(n).fill(NaN);
  if (n < 15) return out;
  let sum = 0;
  for (let i = 1; i <= 14; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    sum += tr;
  }
  let atr = sum / 14;
  out[14] = atr;
  for (let i = 15; i < n; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    atr = (atr * 13 + tr) / 14;
    out[i] = atr;
  }
  return out;
}

function sampleEvery<T>(arr: T[], want: number): T[] {
  if (arr.length <= want) return [...arr];
  const step = arr.length / want;
  const out: T[] = [];
  for (let i = 0; i < want; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

function universeJobs(): { symbol: string; yahooSymbol: string; market: "IN" | "US" }[] {
  const inSyms = sampleEvery(IN_TOP500_SYMBOLS, 100);
  const usSyms = sampleEvery(SP500_SYMBOLS, 100);
  return [
    ...inSyms.map((s) => ({ symbol: s, yahooSymbol: `${s}.NS`, market: "IN" as const })),
    ...usSyms.map((s) => ({ symbol: s, yahooSymbol: s.replace(/\./g, "-"), market: "US" as const })),
  ];
}

async function fetchCandles(yahooSymbol: string): Promise<OHLCV[] | null> {
  fs.mkdirSync(CANDLE_CACHE, { recursive: true });
  const cacheFile = path.join(CANDLE_CACHE, `${yahooSymbol.replace(/[^A-Za-z0-9.-]/g, "_")}.json`);
  if (fs.existsSync(cacheFile)) {
    const raw = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    return raw.map((c: any) => ({ ...c, date: new Date(c.date) }));
  }
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - (YEARS + 1)); // +1y so WARMUP bars precede the 5y window
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res: any = await yahoo.chart(yahooSymbol, { period1: start, period2: end, interval: "1d" });
      const candles: OHLCV[] = (res?.quotes ?? [])
        .filter((q: any) => q.open != null && q.high != null && q.low != null && q.close != null && q.volume != null)
        .map((q: any) => ({ date: new Date(q.date), open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume }));
      if (candles.length < WARMUP + 60) return null; // too little history to judge anything
      fs.writeFileSync(cacheFile, JSON.stringify(candles));
      return candles;
    } catch (e: any) {
      const wait = 2000 * (attempt + 1);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return null;
}

const TARGET_ATR = 1.5; // target = entry + 1.5*ATR14
const STOP_ATR = 2.5;   // stop   = entry - 2.5*ATR14

/** Run every strategy across one stock's candles, sharing the window slice per bar. */
function backtestStock(candles: OHLCV[], market: string, acc: Map<string, StratAcc>) {
  const n = candles.length;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - YEARS);
  const cooldownUntil = new Map<string, number>();
  const atr = atr14(candles);

  for (let i = WARMUP; i < n - 1; i++) {
    if (candles[i].date < cutoff) continue;
    const window = candles.slice(i - WARMUP, i + 1);
    for (const s of ALL_STRATEGIES as Strategy[]) {
      const cd = cooldownUntil.get(s.id);
      if (cd != null && i < cd) continue;
      const horizon = HORIZON_BY_CATEGORY[s.category] ?? 10;
      let result;
      try {
        result = s.evaluate(window);
      } catch {
        continue;
      }
      // Long recommendations only — that's what the engine publishes to users.
      if (result.signal !== "BUY" || result.strength < MIN_STRENGTH) continue;

      const entry = candles[i].close;
      const a14 = atr[i];
      if (!(entry > 0) || !isFinite(a14) || !(a14 > 0)) continue;
      const target = entry + TARGET_ATR * a14;
      const stop = entry - STOP_ATR * a14;

      let pnl = 0;
      let outcome: "target" | "stop" | "time" = "time";
      let exitDay = Math.min(horizon, n - 1 - i);
      for (let d = 1; d <= exitDay; d++) {
        const b = candles[i + d];
        if (b.open <= stop) { pnl = ((b.open - entry) / entry) * 100; outcome = "stop"; exitDay = d; break; }
        if (b.open >= target) { pnl = ((b.open - entry) / entry) * 100; outcome = "target"; exitDay = d; break; }
        const hitStop = b.low <= stop;
        const hitTarget = b.high >= target;
        if (hitStop) { // both hit same day counts as a loss (conservative)
          pnl = ((stop - entry) / entry) * 100; outcome = "stop"; exitDay = d; break;
        }
        if (hitTarget) { pnl = ((target - entry) / entry) * 100; outcome = "target"; exitDay = d; break; }
        if (d === exitDay) { pnl = ((b.close - entry) / entry) * 100; outcome = "time"; }
      }
      if (exitDay < 1) continue; // no forward bars left to trade
      const won = outcome === "target" || (outcome === "time" && pnl > 0);

      let peak = 0, peakDay = 0, dd = 0;
      for (let d = 1; d <= exitDay; d++) {
        const ret = ((candles[i + d].close - entry) / entry) * 100;
        if (ret > peak) { peak = ret; peakDay = d; }
        if (ret < dd) dd = ret;
      }

      const a = acc.get(s.id)!;
      a.trades++;
      if (won) a.wins++;
      a.sumRet += pnl;
      a.maxWin = Math.max(a.maxWin, pnl);
      a.maxLoss = Math.min(a.maxLoss, pnl);
      a.sumPeak += peak; a.sumPeakDay += peakDay; a.sumDrawdown += dd;
      if (outcome === "target") a.targetHits++;
      else if (outcome === "stop") a.stopOuts++;
      else a.timeExits++;
      const m = (a.byMarket[market] ??= { trades: 0, wins: 0, sumRet: 0 });
      m.trades++; if (won) m.wins++; m.sumRet += pnl;

      cooldownUntil.set(s.id, i + exitDay);
    }
  }
}

async function runChunk(k: number, total: number) {
  const jobs = universeJobs().filter((_, idx) => idx % total === k);
  const acc = new Map<string, StratAcc>();
  for (const s of ALL_STRATEGIES) acc.set(s.id, newAcc());

  let done = 0;
  for (const job of jobs) {
    const candles = await fetchCandles(job.yahooSymbol);
    if (candles) backtestStock(candles, job.market, acc);
    done++;
    if (done % 5 === 0 || done === jobs.length) {
      console.log(`[chunk ${k}] ${done}/${jobs.length} symbols`);
    }
  }

  fs.mkdirSync(PARTIAL_DIR, { recursive: true });
  const out: Record<string, StratAcc> = {};
  for (const [id, a] of acc) out[id] = a;
  fs.writeFileSync(path.join(PARTIAL_DIR, `partial-${k}.json`), JSON.stringify(out));
  console.log(`[chunk ${k}] done`);
}

function merge() {
  const files = fs.readdirSync(PARTIAL_DIR).filter((f) => f.startsWith("partial-"));
  const acc = new Map<string, StratAcc>();
  for (const s of ALL_STRATEGIES) acc.set(s.id, newAcc());
  for (const f of files) {
    const part: Record<string, StratAcc> = JSON.parse(fs.readFileSync(path.join(PARTIAL_DIR, f), "utf8"));
    for (const [id, p] of Object.entries(part)) {
      const a = acc.get(id);
      if (!a) continue;
      a.trades += p.trades; a.wins += p.wins; a.sumRet += p.sumRet;
      a.maxWin = Math.max(a.maxWin, p.maxWin); a.maxLoss = Math.min(a.maxLoss, p.maxLoss);
      a.sumPeak += p.sumPeak; a.sumPeakDay += p.sumPeakDay; a.sumDrawdown += p.sumDrawdown;
      a.targetHits += p.targetHits ?? 0; a.stopOuts += p.stopOuts ?? 0; a.timeExits += p.timeExits ?? 0;
      for (const [mkt, m] of Object.entries(p.byMarket)) {
        const t = (a.byMarket[mkt] ??= { trades: 0, wins: 0, sumRet: 0 });
        t.trades += m.trades; t.wins += m.wins; t.sumRet += m.sumRet;
      }
    }
  }

  const rows = ALL_STRATEGIES.map((s) => {
    const a = acc.get(s.id)!;
    const winRate = a.trades ? (a.wins / a.trades) * 100 : 0;
    const perMarket: Record<string, { trades: number; winRate: number; avgReturn: number }> = {};
    for (const [mkt, m] of Object.entries(a.byMarket)) {
      perMarket[mkt] = { trades: m.trades, winRate: m.trades ? +((m.wins / m.trades) * 100).toFixed(1) : 0, avgReturn: m.trades ? +(m.sumRet / m.trades).toFixed(3) : 0 };
    }
    return {
      id: s.id, name: s.name, category: s.category, book: s.book,
      trades: a.trades, wins: a.wins, losses: a.trades - a.wins,
      winRate: +winRate.toFixed(1),
      avgReturn: a.trades ? +(a.sumRet / a.trades).toFixed(3) : 0,
      totalReturn: +a.sumRet.toFixed(1),
      maxWin: a.trades ? +a.maxWin.toFixed(2) : 0,
      maxLoss: a.trades ? +a.maxLoss.toFixed(2) : 0,
      avgPeakReturn: a.trades ? +(a.sumPeak / a.trades).toFixed(2) : 0,
      avgDaysToPeak: a.trades ? +(a.sumPeakDay / a.trades).toFixed(1) : 0,
      avgDrawdown: a.trades ? +(a.sumDrawdown / a.trades).toFixed(2) : 0,
      targetHits: a.targetHits, stopOuts: a.stopOuts, timeExits: a.timeExits,
      perMarket,
    };
  }).sort((x, y) => y.winRate - x.winRate);

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generated: new Date().toISOString(), years: YEARS, warmupBars: WARMUP, minStrength: MIN_STRENGTH, horizons: HORIZON_BY_CATEGORY, tradePlan: `long-only; target=+${TARGET_ATR}*ATR14, stop=-${STOP_ATR}*ATR14, gap-aware, both-hit=loss, time-exit at horizon close`, sample: "100 of top-500 per market (every 5th by list order)", rows }, null, 2));
  console.log(`merged ${files.length} partials -> ${OUT_JSON}`);
  for (const r of rows) {
    console.log(`${r.winRate.toString().padStart(5)}%  ${String(r.trades).padStart(6)} trades  avg ${String(r.avgReturn).padStart(7)}%  ${r.id}`);
  }
}

// The original ask was a 70% bar, but NO strategy clears 70% under an honest
// 5-year simulation (best: 69.9%). Harshit set the bar at 60% (2026-07-02:
// "remove everything below 60%"), with a positive-expectancy guard so no
// money-losing strategy ships regardless of its win rate.
const WIN_RATE_BAR = 60;
const AVG_RETURN_BAR = 0; // %/trade — must be strictly positive (expectancy guard)
const MIN_TRADES = 300; // fewer across ~200 stocks x 5y = no statistical basis; strategy is dead weight

/** Read data/backtest-5y.json and regenerate verifiedStrategies.ts + backtestCache.ts. */
function generate() {
  const { rows, generated } = JSON.parse(fs.readFileSync(OUT_JSON, "utf8"));
  const pass = (r: any) => r.trades >= MIN_TRADES && r.winRate >= WIN_RATE_BAR && r.avgReturn > AVG_RETURN_BAR;
  const passed = rows.filter(pass);
  const failed = rows.filter((r: any) => !pass(r));

  const verified = `// AUTO-GENERATED by scripts/backtest5y.ts — do not edit by hand.
// 5-year backtest (${generated.slice(0, 10)}): 100 stocks sampled from each market's
// top-500 universe (NIFTY 500 + S&P 500), daily bars, long-only trade plan
// (target +${TARGET_ATR}*ATR14 / stop -${STOP_ATR}*ATR14 / category-based time exit).
// Bar to pass: win rate >= ${WIN_RATE_BAR}%, avg return > ${AVG_RETURN_BAR}%/trade, >= ${MIN_TRADES} trades.
// ${passed.length}/${rows.length} strategies passed.
export const VERIFIED_STRATEGY_IDS: Set<string> = new Set<string>([
${passed.map((r: any) => `  "${r.id}", // ${r.winRate}% over ${r.trades} trades (IN ${r.perMarket.IN?.winRate ?? "-"}%, US ${r.perMarket.US?.winRate ?? "-"}%)`).join("\n")}
]);
`;
  fs.writeFileSync(path.join(process.cwd(), "src", "lib", "verifiedStrategies.ts"), verified);

  const cacheRows = rows
    .map((r: any) =>
      `  "${r.id}": { winRate: ${r.winRate}, trades: ${r.trades}, avgReturn: ${r.avgReturn}, totalReturn: ${r.totalReturn}, wins: ${r.wins}, losses: ${r.losses}, avgDaysToPeak: ${r.avgDaysToPeak}, avgPeakReturn: ${r.avgPeakReturn}, avgDrawdown: ${r.avgDrawdown} },`
    )
    .join("\n");
  const cache = `// Auto-generated backtest results cache — scripts/backtest5y.ts
// 5-year backtest across 100 stocks sampled from each market's top-500
// universe (NIFTY 500 + S&P 500), daily bars, category-based hold periods.
// Generated: ${generated.slice(0, 10)}

export interface BacktestCache {
  winRate: number;
  trades: number;
  avgReturn: number;
  totalReturn: number;
  wins: number;
  losses: number;
  avgDaysToPeak: number;
  avgPeakReturn: number;
  avgDrawdown: number;
}

export const BACKTEST_CACHE: Record<string, BacktestCache> = {
${cacheRows}
};
`;
  fs.writeFileSync(path.join(process.cwd(), "src", "lib", "backtestCache.ts"), cache);

  console.log(`PASSED (${passed.length}):`);
  for (const r of passed) console.log(`  ${r.winRate}% / ${r.trades} trades  ${r.id} [${r.category}]`);
  console.log(`REMOVED (${failed.length}): ${failed.map((r: any) => r.id).join(", ")}`);
}

async function calibrate() {
  const t0 = Date.now();
  const acc = new Map<string, StratAcc>();
  for (const s of ALL_STRATEGIES) acc.set(s.id, newAcc());
  for (const sym of ["RELIANCE.NS", "AAPL"]) {
    const candles = await fetchCandles(sym);
    if (!candles) { console.log(`no data for ${sym}`); continue; }
    const t1 = Date.now();
    backtestStock(candles, sym.endsWith(".NS") ? "IN" : "US", acc);
    console.log(`${sym}: ${candles.length} bars, backtest ${(Date.now() - t1) / 1000}s`);
  }
  console.log(`total ${(Date.now() - t0) / 1000}s`);
}

const arg = process.argv[2] ?? "";
if (arg === "--merge") merge();
else if (arg === "--generate") generate();
else if (arg === "--calibrate") calibrate();
else if (arg === "--chunk") {
  const [k, total] = (process.argv[3] ?? "0/1").split("/").map(Number);
  runChunk(k, total);
} else {
  console.log("usage: --chunk k/N | --merge | --calibrate");
}
