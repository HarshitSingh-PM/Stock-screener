/**
 * Backtests the ETF Buy/Hold/Sell calls (the exact production scorer from
 * src/lib/etfScore.ts) over 5 years across both markets' ETF catalogs.
 *
 * Event-based grading to avoid overlapping-window inflation: an "event" is
 * the composite call TRANSITIONING into a state (or a component flipping
 * sign), with a 21-bar cooldown per direction. BUY-type events are graded on
 * the 21d and 63d forward return being positive; SELL-type on negative.
 *
 * Usage: --chunk k/6 | --merge | --generate
 */
import fs from "node:fs";
import path from "node:path";
import YahooFinance from "yahoo-finance2";
import { STRATEGIES } from "../src/lib/strategies";
import { etfComponents, compositeCall } from "../src/lib/etfScore";
import { getETFs } from "../src/lib/etfs";
import { toYahooSymbol } from "../src/lib/markets";
import type { OHLCV } from "../src/lib/indicators";

const yahoo = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey"] });
const SCRATCH = "/private/tmp/claude-501/-Users-harshitsingh/c5e818fa-0be7-48b3-bdcd-15465a230bbf/scratchpad";
const CACHE = path.join(SCRATCH, "etf-candles");
const PARTIALS = path.join(SCRATCH, "etf-partials");
const OUT_JSON = path.join(process.cwd(), "data", "etf-calls-backtest-5y.json");

const YEARS = 5;
const WARMUP = 250;
const COOLDOWN = 21;
const HOLDOUT_MONTHS = 18;

interface Ev { key: string; dir: number; date: string; fwd21: number; fwd63: number }

async function fetchCandles(symbol: string, market: "IN" | "US"): Promise<OHLCV[] | null> {
  fs.mkdirSync(CACHE, { recursive: true });
  const ySym = toYahooSymbol(symbol, market);
  const f = path.join(CACHE, ySym.replace(/[^A-Za-z0-9.-]/g, "_") + ".json");
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8")).map((c: any) => ({ ...c, date: new Date(c.date) }));
  const start = new Date(); start.setFullYear(start.getFullYear() - (YEARS + 1));
  for (let a = 0; a < 3; a++) {
    try {
      const res: any = await yahoo.chart(ySym, { period1: start, period2: new Date(), interval: "1d" });
      const candles = (res?.quotes ?? [])
        .filter((q: any) => q.open != null && q.close != null && q.high != null && q.low != null)
        .map((q: any) => ({ date: new Date(q.date), open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume ?? 0 }));
      if (candles.length < WARMUP + 80) return null;
      fs.writeFileSync(f, JSON.stringify(candles));
      return candles;
    } catch { await new Promise((r) => setTimeout(r, 1500 * (a + 1))); }
  }
  return null;
}

function backtestEtf(candles: OHLCV[], market: string): Ev[] {
  const n = candles.length;
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - YEARS);
  const closesAll = candles.map((c) => c.close);
  const events: Ev[] = [];
  const lastEvent = new Map<string, number>(); // key+dir -> bar of last event
  let prevStates = new Map<string, number>();

  for (let i = WARMUP; i < n - 63; i++) {
    const closes = closesAll.slice(0, i + 1);
    const window = candles.slice(i - WARMUP, i + 1);
    let buyCount = 0, sellCount = 0;
    for (const s of STRATEGIES) {
      try {
        const r = s.evaluate(window);
        if (r.signal === "BUY") buyCount++;
        else if (r.signal === "SELL") sellCount++;
      } catch { /* skip */ }
    }
    const { comp } = etfComponents(closes, buyCount, sellCount, STRATEGIES.length);
    const { rec } = compositeCall(comp);

    const states = new Map<string, number>([
      [`${market}:call:BUY`, rec === "BUY" || rec === "STRONG_BUY" ? 1 : 0],
      [`${market}:call:STRONG_BUY`, rec === "STRONG_BUY" ? 1 : 0],
      [`${market}:call:SELL`, rec === "SELL" || rec === "STRONG_SELL" ? -1 : 0],
      [`${market}:comp:trend`, Math.sign(comp.trendScore)],
      [`${market}:comp:rsi`, Math.sign(comp.momentumScore)],
      [`${market}:comp:macd`, Math.sign(comp.macdScore)],
      [`${market}:comp:confluence`, Math.sign(comp.confluenceScore)],
    ]);

    if (candles[i].date >= cutoff) {
      const c0 = candles[i].close;
      for (const [key, dir] of states) {
        if (dir === 0) continue;
        const prev = prevStates.get(key) ?? 0;
        if (prev === dir) continue; // must be a transition into the state
        const lk = `${key}:${dir}`;
        if (i - (lastEvent.get(lk) ?? -999) < COOLDOWN) continue;
        lastEvent.set(lk, i);
        events.push({
          key, dir,
          date: candles[i].date.toISOString().slice(0, 10),
          fwd21: ((candles[i + 21].close - c0) / c0) * 100,
          fwd63: ((candles[i + 63].close - c0) / c0) * 100,
        });
      }
    }
    prevStates = states;
  }
  return events;
}

async function runChunk(k: number, total: number) {
  const jobs = [
    ...getETFs("IN").map((e) => ({ ...e, market: "IN" as const })),
    ...getETFs("US").map((e) => ({ ...e, market: "US" as const })),
  ].filter((_, idx) => idx % total === k);
  const events: Ev[] = [];
  let done = 0;
  for (const j of jobs) {
    const candles = await fetchCandles(j.symbol, j.market);
    if (candles) events.push(...backtestEtf(candles, j.market));
    done++;
    if (done % 5 === 0 || done === jobs.length) console.log(`[etf chunk ${k}] ${done}/${jobs.length}`);
  }
  fs.mkdirSync(PARTIALS, { recursive: true });
  fs.writeFileSync(path.join(PARTIALS, `etf-${k}.json`), JSON.stringify(events));
  console.log(`[etf chunk ${k}] done, ${events.length} events`);
}

function mergeAndReport(generate: boolean) {
  const events: Ev[] = fs.readdirSync(PARTIALS)
    .filter((f) => f.startsWith("etf-"))
    .flatMap((f) => JSON.parse(fs.readFileSync(path.join(PARTIALS, f), "utf8")));
  const split = new Date(); split.setMonth(split.getMonth() - HOLDOUT_MONTHS);
  const splitStr = split.toISOString().slice(0, 10);

  const keys = [...new Set(events.map((e) => e.key))].sort();
  const rows: any[] = [];
  for (const key of keys) {
    for (const h of ["fwd21", "fwd63"] as const) {
      const evs = events.filter((e) => e.key === key);
      const graded = evs.map((e) => ({ hit: Math.sign(e[h]) === Math.sign(e.dir), ret: e[h] * Math.sign(e.dir), test: e.date >= splitStr }));
      const n = graded.length, hits = graded.filter((g) => g.hit).length;
      const tn = graded.filter((g) => g.test).length, th = graded.filter((g) => g.test && g.hit).length;
      rows.push({
        key, horizon: h, n,
        hitRate: n ? +(100 * hits / n).toFixed(1) : 0,
        testN: tn, testHitRate: tn ? +(100 * th / tn).toFixed(1) : 0,
        avgMove: n ? +(graded.reduce((s, g) => s + g.ret, 0) / n).toFixed(3) : 0,
      });
    }
  }
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generated: new Date().toISOString(), splitDate: splitStr, totalEvents: events.length, rows }, null, 2));
  for (const r of rows.filter((r) => r.horizon === "fwd21")) {
    const r63 = rows.find((x) => x.key === r.key && x.horizon === "fwd63");
    console.log(`${r.key.padEnd(28)} 21d ${String(r.hitRate).padStart(5)}% of ${String(r.n).padStart(4)} (test ${r.testHitRate}%/${r.testN}) avg ${r.avgMove}% | 63d ${r63.hitRate}% avg ${r63.avgMove}%`);
  }
  console.log(`\n${events.length} events -> ${OUT_JSON}`);
  if (generate) {
    const get = (key: string, h: string) => rows.find((r) => r.key === key && r.horizon === h)!;
    const block = (mkt: string, call: string) => {
      const a = get(`${mkt}:call:${call}`, "fwd21");
      const b = get(`${mkt}:call:${call}`, "fwd63");
      return { n: a.n, hitRate21: a.hitRate, testHitRate21: a.testHitRate, hitRate63: b.hitRate, avgReturn63: b.avgMove };
    };
    const stats = {
      IN: { BUY: block("IN", "BUY"), STRONG_BUY: block("IN", "STRONG_BUY") },
      US: { BUY: block("US", "BUY"), STRONG_BUY: block("US", "STRONG_BUY") },
    };
    const sellNote = {
      IN: get("IN:call:SELL", "fwd21").hitRate,
      US: get("US:call:SELL", "fwd21").hitRate,
    };
    fs.writeFileSync(path.join(process.cwd(), "src", "lib", "verifiedEtfCalls.ts"), `// AUTO-GENERATED by scripts/backtestEtfCalls.ts — do not edit by hand.
// 5-year, event-based backtest of the ETF composite call (transitions only,
// ${COOLDOWN}-bar cooldown, ${HOLDOUT_MONTHS}-month holdout). BUY-side calls carry a real
// positive edge and are served with their measured stats. SELL-side calls
// graded ${sellNote.IN}% (IN) / ${sellNote.US}% (US) — worse than a coin flip — and were
// REMOVED from the site: scores below the BUY bar render as HOLD.
export interface EtfCallStat {
  n: number;
  hitRate21: number;
  testHitRate21: number;
  hitRate63: number;
  avgReturn63: number;
}

export const ETF_CALL_STATS: Record<"IN" | "US", Record<"BUY" | "STRONG_BUY", EtfCallStat>> = ${JSON.stringify(stats, null, 2)};
`);
    console.log("wrote src/lib/verifiedEtfCalls.ts");
  }
}

const arg = process.argv[2] ?? "";
if (arg === "--chunk") {
  const [k, total] = (process.argv[3] ?? "0/1").split("/").map(Number);
  runChunk(k, total);
} else if (arg === "--merge") mergeAndReport(false);
else if (arg === "--generate") mergeAndReport(true);
else console.log("usage: --chunk k/6 | --merge | --generate");
