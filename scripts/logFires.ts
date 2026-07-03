/**
 * Pass A for group mining: log, per (stock, bar), the set of strategies that
 * fired BUY plus the trade-plan outcome of a long opened at that bar's close
 * (target +1.5*ATR14, stop -2.5*ATR14, walked up to 21 trading days).
 * Mining (scripts/mineGroups.ts) then evaluates ANY strategy group without
 * re-running evaluate().
 *
 * Usage: npx tsx scripts/logFires.ts --chunk k/8   (candles come from the
 * scratchpad cache populated by backtest5y.ts)
 */
import fs from "node:fs";
import path from "node:path";
import YahooFinance from "yahoo-finance2";
import { ALL_STRATEGIES } from "../src/lib/strategies";
import { SP500_SYMBOLS } from "../src/lib/universe/sp500";
import { IN_TOP500_SYMBOLS } from "../src/lib/universe/inTop500";
import type { OHLCV } from "../src/lib/indicators";

const yahoo = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey"] });

const SCRATCH = "/private/tmp/claude-501/-Users-harshitsingh/c5e818fa-0be7-48b3-bdcd-15465a230bbf/scratchpad";
const CANDLE_CACHE = path.join(SCRATCH, "candles");
const FIRES_DIR = path.join(SCRATCH, "fires");

const WARMUP = 250;
const MIN_STRENGTH = 30;
const YEARS = 5;
const MAX_HORIZON = 21;
const TARGET_ATR = 1.5;
const STOP_ATR = 2.5;

function sampleEvery<T>(arr: T[], want: number): T[] {
  if (arr.length <= want) return [...arr];
  const step = arr.length / want;
  const out: T[] = [];
  for (let i = 0; i < want; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

function universeJobs() {
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
  start.setFullYear(start.getFullYear() - (YEARS + 1));
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res: any = await yahoo.chart(yahooSymbol, { period1: start, period2: end, interval: "1d" });
      const candles: OHLCV[] = (res?.quotes ?? [])
        .filter((q: any) => q.open != null && q.high != null && q.low != null && q.close != null && q.volume != null)
        .map((q: any) => ({ date: new Date(q.date), open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume }));
      if (candles.length < WARMUP + 60) return null;
      fs.writeFileSync(cacheFile, JSON.stringify(candles));
      return candles;
    } catch {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  return null;
}

function atr14(candles: OHLCV[]): number[] {
  const n = candles.length;
  const out = new Array(n).fill(NaN);
  if (n < 15) return out;
  let sum = 0;
  for (let i = 1; i <= 14; i++) {
    sum += Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close));
  }
  let atr = sum / 14;
  out[14] = atr;
  for (let i = 15; i < n; i++) {
    const tr = Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close));
    atr = (atr * 13 + tr) / 14;
    out[i] = atr;
  }
  return out;
}

// Record: [symbol, date, fires[], hitType(0 none/1 target/2 stop), hitDay, pnlHit, pnl10, pnl21]
type FireRecord = [string, string, number[], number, number, number, number, number];

function logStock(symbol: string, candles: OHLCV[]): FireRecord[] {
  const n = candles.length;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - YEARS);
  const atr = atr14(candles);
  const records: FireRecord[] = [];

  for (let i = WARMUP; i < n - MAX_HORIZON; i++) {
    if (candles[i].date < cutoff) continue;
    const entry = candles[i].close;
    const a = atr[i];
    if (!(entry > 0) || !isFinite(a) || !(a > 0)) continue;

    const window = candles.slice(i - WARMUP, i + 1);
    const fires: number[] = [];
    for (let s = 0; s < ALL_STRATEGIES.length; s++) {
      try {
        const r = ALL_STRATEGIES[s].evaluate(window);
        if (r.signal === "BUY" && r.strength >= MIN_STRENGTH) fires.push(s);
      } catch { /* skip */ }
    }
    if (fires.length === 0) continue;

    const target = entry + TARGET_ATR * a;
    const stop = entry - STOP_ATR * a;
    const pct = (px: number) => +(((px - entry) / entry) * 100).toFixed(3);

    let hitType = 0, hitDay = 0, pnlHit = 0;
    for (let d = 1; d <= MAX_HORIZON; d++) {
      const b = candles[i + d];
      if (b.open <= stop) { hitType = 2; hitDay = d; pnlHit = pct(b.open); break; }
      if (b.open >= target) { hitType = 1; hitDay = d; pnlHit = pct(b.open); break; }
      if (b.low <= stop) { hitType = 2; hitDay = d; pnlHit = pct(stop); break; } // both-hit -> loss
      if (b.high >= target) { hitType = 1; hitDay = d; pnlHit = pct(target); break; }
    }
    const pnl10 = hitType !== 0 && hitDay <= 10 ? pnlHit : pct(candles[i + 10].close);
    const pnl21 = hitType !== 0 ? pnlHit : pct(candles[i + MAX_HORIZON].close);

    records.push([symbol, candles[i].date.toISOString().slice(0, 10), fires, hitType, hitDay, pnlHit, pnl10, pnl21]);
  }
  return records;
}

async function runChunk(k: number, total: number) {
  const jobs = universeJobs().filter((_, idx) => idx % total === k);
  const all: { market: string; records: FireRecord[] }[] = [];
  let done = 0;
  for (const job of jobs) {
    const candles = await fetchCandles(job.yahooSymbol);
    if (candles) all.push({ market: job.market, records: logStock(job.symbol, candles) });
    done++;
    if (done % 5 === 0 || done === jobs.length) console.log(`[fires chunk ${k}] ${done}/${jobs.length}`);
  }
  fs.mkdirSync(FIRES_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(FIRES_DIR, `fires-${k}.json`),
    JSON.stringify({ strategyIds: ALL_STRATEGIES.map((s) => s.id), chunks: all })
  );
  console.log(`[fires chunk ${k}] done`);
}

const [k, total] = (process.argv[3] ?? "0/1").split("/").map(Number);
if (process.argv[2] === "--chunk") runChunk(k, total);
else console.log("usage: --chunk k/N");
