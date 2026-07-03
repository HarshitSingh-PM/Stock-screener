/**
 * Backtests every predictive signal on the Global and Signals pages against
 * what it actually claims to predict, then mines conjunctions.
 *
 * Global cues: each factor (US close, Asia, oil, VIX, ...) is computed from
 * driver-ticker closes available BEFORE the target session, and graded on
 * three outcomes: the next OPEN gap, the close-to-close day, and 5-day drift.
 * US mode only uses drivers that close before the US open (no Europe leak).
 *
 * Index signals: replays the Signals page's real analyzeIndex() over history
 * and grades each named signal on 5/10/21-day forward direction.
 *
 * Conjunctions: exhaustive pairs/triples of same-direction active signals.
 *
 * Usage: npx tsx scripts/backtestCues.ts            # run + report
 *        npx tsx scripts/backtestCues.ts --generate # also write verifiedCues.ts
 */
import fs from "node:fs";
import path from "node:path";
import YahooFinance from "yahoo-finance2";
import { analyzeIndex } from "../src/app/api/signals/route";
import type { OHLCV } from "../src/lib/indicators";

const yahoo = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey"] });
const SCRATCH = "/private/tmp/claude-501/-Users-harshitsingh/c5e818fa-0be7-48b3-bdcd-15465a230bbf/scratchpad";
const CACHE = path.join(SCRATCH, "cues-candles");
const OUT_JSON = path.join(process.cwd(), "data", "cues-backtest-5y.json");

const YEARS = 5;
const HOLDOUT_MONTHS = 18;
const MIN_N = 30;          // min occurrences over 5y to even report
const MIN_TEST_N = 10;

const TICKERS = ["^NSEI", "^GSPC", "^IXIC", "^DJI", "^N225", "^HSI", "000001.SS", "^FTSE", "^GDAXI", "CL=F", "GC=F", "USDINR=X", "DX-Y.NYB", "^VIX", "^TNX"];

async function fetchDaily(symbol: string): Promise<OHLCV[]> {
  fs.mkdirSync(CACHE, { recursive: true });
  const f = path.join(CACHE, symbol.replace(/[^A-Za-z0-9.-]/g, "_") + ".json");
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8")).map((c: any) => ({ ...c, date: new Date(c.date) }));
  const start = new Date(); start.setFullYear(start.getFullYear() - (YEARS + 2));
  const res: any = await yahoo.chart(symbol, { period1: start, period2: new Date(), interval: "1d" });
  const candles = (res?.quotes ?? [])
    .filter((q: any) => q.close != null && q.open != null)
    .map((q: any) => ({ date: new Date(q.date), open: q.open, high: q.high ?? q.close, low: q.low ?? q.close, close: q.close, volume: q.volume ?? 0 }));
  fs.writeFileSync(f, JSON.stringify(candles));
  return candles;
}

interface DriverDay { chg: number; level: number; weekChg: number }
type DriverFrame = Map<string, DriverDay>; // dateStr -> state as of that driver's close

function buildDriverFrame(candles: OHLCV[]): DriverFrame {
  const m: DriverFrame = new Map();
  for (let i = 1; i < candles.length; i++) {
    const chg = ((candles[i].close - candles[i - 1].close) / candles[i - 1].close) * 100;
    const w = i >= 5 ? ((candles[i].close - candles[i - 5].close) / candles[i - 5].close) * 100 : 0;
    m.set(candles[i].date.toISOString().slice(0, 10), { chg, level: candles[i].close, weekChg: w });
  }
  return m;
}

/** Latest driver state strictly BEFORE the given date. */
function asOfBefore(frame: DriverFrame, sortedDates: string[], date: string): DriverDay | null {
  // binary search over the driver's own dates
  let lo = 0, hi = sortedDates.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedDates[mid] < date) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans >= 0 ? frame.get(sortedDates[ans])! : null;
}

interface CueDef { id: string; label: string; eval: (d: Record<string, DriverDay | null>) => number } // returns +1/-1/0(inactive)

const avg = (...xs: (number | undefined)[]) => {
  const v = xs.filter((x): x is number => x != null && isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
};
const act = (v: number, thr: number, invert = false): number =>
  !isFinite(v) || Math.abs(v) <= thr ? 0 : (v > 0 ? 1 : -1) * (invert ? -1 : 1);

const IN_CUES: CueDef[] = [
  { id: "us-close", label: "US market close (>0.3%)", eval: (d) => act(avg(d.gspc?.chg, d.ixic?.chg, d.dji?.chg), 0.3) },
  { id: "us-close-strong", label: "US strong close (>1.5%)", eval: (d) => act(avg(d.gspc?.chg, d.ixic?.chg, d.dji?.chg), 1.5) },
  { id: "nasdaq-divergence", label: "Nasdaq vs S&P divergence (>0.5%)", eval: (d) => d.ixic && d.gspc ? act(d.ixic.chg - d.gspc.chg, 0.5) : 0 },
  { id: "asia-prev", label: "Asia previous close (>0.3%)", eval: (d) => act(avg(d.n225?.chg, d.hsi?.chg, d.shanghai?.chg), 0.3) },
  { id: "shanghai-extreme", label: "Shanghai big move (>1%)", eval: (d) => act(d.shanghai?.chg ?? NaN, 1) },
  { id: "europe-prev", label: "Europe previous close (>0.5%)", eval: (d) => act(avg(d.ftse?.chg, d.dax?.chg), 0.5) },
  { id: "oil-daily", label: "Crude daily move (>1%, inverse)", eval: (d) => act(d.oil?.chg ?? NaN, 1, true) },
  { id: "oil-week", label: "Crude weekly move (>3%, inverse)", eval: (d) => act(d.oil?.weekChg ?? NaN, 3, true) },
  { id: "gold-daily", label: "Gold move (>1%, inverse)", eval: (d) => act(d.gold?.chg ?? NaN, 1, true) },
  { id: "usdinr", label: "USD/INR move (>0.2%, inverse)", eval: (d) => act(d.usdinr?.chg ?? NaN, 0.2, true) },
  { id: "dxy", label: "Dollar index move (>0.3%, inverse)", eval: (d) => act(d.dxy?.chg ?? NaN, 0.3, true) },
  { id: "vix-level", label: "VIX above 25", eval: (d) => (d.vix?.level ?? 0) > 25 ? -1 : 0 },
  { id: "vix-spike", label: "VIX move (>10%, inverse)", eval: (d) => act(d.vix?.chg ?? NaN, 10, true) },
  { id: "vix-calm", label: "VIX below 15 and falling", eval: (d) => (d.vix?.level ?? 99) < 15 && (d.vix?.chg ?? 0) < -5 ? 1 : 0 },
  { id: "tnx-move", label: "US 10Y yield move (>2%, inverse)", eval: (d) => act(d.tnx?.chg ?? NaN, 2, true) },
  { id: "tnx-level", label: "US 10Y above 4.5%", eval: (d) => (d.tnx?.level ?? 0) > 4.5 ? -1 : 0 },
];

// US mode: only drivers that fully close before the US session opens.
const US_CUES: CueDef[] = [
  { id: "asia-day", label: "Asia same-day close (>0.3%)", eval: (d) => act(avg(d.n225?.chg, d.hsi?.chg, d.shanghai?.chg), 0.3) },
  { id: "own-momentum", label: "S&P previous close (>0.3%)", eval: (d) => act(d.gspc?.chg ?? NaN, 0.3) },
  { id: "vix-level", label: "VIX above 25", eval: (d) => (d.vix?.level ?? 0) > 25 ? -1 : 0 },
  { id: "vix-spike", label: "VIX move (>10%, inverse)", eval: (d) => act(d.vix?.chg ?? NaN, 10, true) },
  { id: "tnx-move", label: "US 10Y yield move (>2%, inverse)", eval: (d) => act(d.tnx?.chg ?? NaN, 2, true) },
  { id: "dxy", label: "Dollar index move (>0.3%, inverse)", eval: (d) => act(d.dxy?.chg ?? NaN, 0.3, true) },
  { id: "oil-daily", label: "Crude daily move (>2%)", eval: (d) => act(d.oil?.chg ?? NaN, 2) },
  { id: "gold-daily", label: "Gold move (>1%, inverse)", eval: (d) => act(d.gold?.chg ?? NaN, 1, true) },
];

interface Stat { n: number; hits: number; sum: number; testN: number; testHits: number }
const stat = (): Stat => ({ n: 0, hits: 0, sum: 0, testN: 0, testHits: 0 });
function tally(s: Stat, hit: boolean, ret: number, isTest: boolean) {
  s.n++; s.sum += ret; if (hit) s.hits++;
  if (isTest) { s.testN++; if (hit) s.testHits++; }
}
const pct = (a: number, b: number) => (b ? +(100 * a / b).toFixed(1) : 0);

async function main() {
  const generate = process.argv.includes("--generate");
  const frames: Record<string, { frame: DriverFrame; dates: string[] }> = {};
  const keyOf: Record<string, string> = { "^GSPC": "gspc", "^IXIC": "ixic", "^DJI": "dji", "^N225": "n225", "^HSI": "hsi", "000001.SS": "shanghai", "^FTSE": "ftse", "^GDAXI": "dax", "CL=F": "oil", "GC=F": "gold", "USDINR=X": "usdinr", "DX-Y.NYB": "dxy", "^VIX": "vix", "^TNX": "tnx" };
  const raw: Record<string, OHLCV[]> = {};
  for (const t of TICKERS) {
    raw[t] = await fetchDaily(t);
    if (t !== "^NSEI") {
      const frame = buildDriverFrame(raw[t]);
      frames[keyOf[t] ?? t] = { frame, dates: [...frame.keys()].sort() };
    }
  }

  const splitDate = new Date(); splitDate.setMonth(splitDate.getMonth() - HOLDOUT_MONTHS);
  const splitStr = splitDate.toISOString().slice(0, 10);
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - YEARS);

  const results: any = { generated: new Date().toISOString(), splitDate: splitStr, global: {}, index: {}, globalCombos: {}, indexCombos: {} };

  // ── Part 1: global cues ─────────────────────────────────────────────────
  for (const target of ["IN", "US"] as const) {
    const idx = raw[target === "IN" ? "^NSEI" : "^GSPC"];
    const cues = target === "IN" ? IN_CUES : US_CUES;
    // For US, Asia closes the same calendar day before the US open; approximate
    // "as of before open" with date <= D for Asia and < D for the rest.
    const days: { date: string; dirs: number[]; gap: number; day: number; fwd5: number }[] = [];
    for (let i = 1; i < idx.length - 5; i++) {
      if (idx[i].date < cutoff) continue;
      const date = idx[i].date.toISOString().slice(0, 10);
      const d: Record<string, DriverDay | null> = {};
      for (const [key, { frame, dates }] of Object.entries(frames)) {
        const sameDayOk = target === "US" && ["n225", "hsi", "shanghai"].includes(key);
        d[key] = sameDayOk
          ? (frame.get(date) ?? asOfBefore(frame, dates, date))
          : asOfBefore(frame, dates, date);
      }
      if (target === "US") {
        // own-momentum uses the S&P's own previous close, not today's
        d.gspc = asOfBefore(frames.gspc.frame, frames.gspc.dates, date);
      }
      const prevClose = idx[i - 1].close;
      days.push({
        date,
        dirs: cues.map((c) => c.eval(d)),
        gap: ((idx[i].open - prevClose) / prevClose) * 100,
        day: ((idx[i].close - prevClose) / prevClose) * 100,
        fwd5: ((idx[i + 5].close - prevClose) / prevClose) * 100,
      });
    }

    const perCue: any = {};
    for (let c = 0; c < cues.length; c++) {
      const st = { gap: stat(), day: stat(), fwd5: stat() };
      for (const dy of days) {
        const dir = dy.dirs[c];
        if (dir === 0) continue;
        const isTest = dy.date >= splitStr;
        tally(st.gap, Math.sign(dy.gap) === dir, dy.gap * dir, isTest);
        tally(st.day, Math.sign(dy.day) === dir, dy.day * dir, isTest);
        tally(st.fwd5, Math.sign(dy.fwd5) === dir, dy.fwd5 * dir, isTest);
      }
      perCue[cues[c].id] = { label: cues[c].label, outcomes: Object.fromEntries(Object.entries(st).map(([k, s]) => [k, { n: s.n, hitRate: pct(s.hits, s.n), testN: s.testN, testHitRate: pct(s.testHits, s.testN), avgMove: s.n ? +(s.sum / s.n).toFixed(3) : 0 }])) };
    }
    results.global[target] = perCue;

    // Conjunctions (pairs + triples), all members active and same direction.
    const combos: any[] = [];
    const idxs = cues.map((_, i) => i);
    const evalCombo = (members: number[]) => {
      const st = { gap: stat(), day: stat(), fwd5: stat() };
      for (const dy of days) {
        const ds = members.map((m) => dy.dirs[m]);
        if (ds.some((x) => x === 0) || new Set(ds).size !== 1) continue;
        const dir = ds[0];
        const isTest = dy.date >= splitStr;
        tally(st.gap, Math.sign(dy.gap) === dir, dy.gap * dir, isTest);
        tally(st.day, Math.sign(dy.day) === dir, dy.day * dir, isTest);
        tally(st.fwd5, Math.sign(dy.fwd5) === dir, dy.fwd5 * dir, isTest);
      }
      for (const [oc, s] of Object.entries(st)) {
        if (s.n >= MIN_N && s.testN >= MIN_TEST_N) {
          combos.push({ members: members.map((m) => cues[m].id), labels: members.map((m) => cues[m].label), outcome: oc, n: s.n, hitRate: pct(s.hits, s.n), testN: s.testN, testHitRate: pct(s.testHits, s.testN), avgMove: +(s.sum / s.n).toFixed(3) });
        }
      }
    };
    for (let a = 0; a < idxs.length; a++) for (let b = a + 1; b < idxs.length; b++) {
      evalCombo([a, b]);
      for (let cc = b + 1; cc < idxs.length; cc++) evalCombo([a, b, cc]);
    }
    combos.sort((x, y) => y.hitRate - x.hitRate);
    results.globalCombos[target] = combos.slice(0, 60);
  }

  // ── Part 2: the Signals page's analyzeIndex over history ────────────────
  for (const target of ["IN", "US"] as const) {
    const idx = raw[target === "IN" ? "^NSEI" : "^GSPC"];
    const days: { date: string; states: Map<string, string>; fwd5: number; fwd10: number; fwd21: number }[] = [];
    for (let i = 260; i < idx.length - 21; i++) {
      if (idx[i].date < cutoff) continue;
      const sigs = analyzeIndex(idx.slice(i - 260, i + 1));
      const states = new Map(sigs.map((s) => [s.name, s.signal]));
      const c0 = idx[i].close;
      days.push({
        date: idx[i].date.toISOString().slice(0, 10),
        states,
        fwd5: ((idx[i + 5].close - c0) / c0) * 100,
        fwd10: ((idx[i + 10].close - c0) / c0) * 100,
        fwd21: ((idx[i + 21].close - c0) / c0) * 100,
      });
    }
    const names = [...new Set(days.flatMap((d) => [...d.states.keys()]))];
    const perSig: any = {};
    for (const name of names) {
      const st = { fwd5: stat(), fwd10: stat(), fwd21: stat() };
      for (const dy of days) {
        const sg = dy.states.get(name);
        if (sg !== "BULLISH" && sg !== "BEARISH") continue;
        const dir = sg === "BULLISH" ? 1 : -1;
        const isTest = dy.date >= splitStr;
        tally(st.fwd5, Math.sign(dy.fwd5) === dir, dy.fwd5 * dir, isTest);
        tally(st.fwd10, Math.sign(dy.fwd10) === dir, dy.fwd10 * dir, isTest);
        tally(st.fwd21, Math.sign(dy.fwd21) === dir, dy.fwd21 * dir, isTest);
      }
      perSig[name] = Object.fromEntries(Object.entries(st).map(([k, s]) => [k, { n: s.n, hitRate: pct(s.hits, s.n), testN: s.testN, testHitRate: pct(s.testHits, s.testN), avgMove: s.n ? +(s.sum / s.n).toFixed(3) : 0 }]));
    }
    results.index[target] = perSig;

    // Index-signal conjunctions (pairs/triples, same direction).
    const combos: any[] = [];
    const evalCombo = (members: string[]) => {
      const st = { fwd5: stat(), fwd10: stat(), fwd21: stat() };
      for (const dy of days) {
        const sgs = members.map((m) => dy.states.get(m));
        if (sgs.some((s) => s !== "BULLISH" && s !== "BEARISH") || new Set(sgs).size !== 1) continue;
        const dir = sgs[0] === "BULLISH" ? 1 : -1;
        const isTest = dy.date >= splitStr;
        tally(st.fwd5, Math.sign(dy.fwd5) === dir, dy.fwd5 * dir, isTest);
        tally(st.fwd10, Math.sign(dy.fwd10) === dir, dy.fwd10 * dir, isTest);
        tally(st.fwd21, Math.sign(dy.fwd21) === dir, dy.fwd21 * dir, isTest);
      }
      for (const [oc, s] of Object.entries(st)) {
        if (s.n >= MIN_N && s.testN >= MIN_TEST_N) {
          combos.push({ members, outcome: oc, n: s.n, hitRate: pct(s.hits, s.n), testN: s.testN, testHitRate: pct(s.testHits, s.testN), avgMove: +(s.sum / s.n).toFixed(3) });
        }
      }
    };
    for (let a = 0; a < names.length; a++) for (let b = a + 1; b < names.length; b++) {
      evalCombo([names[a], names[b]]);
      for (let cc = b + 1; cc < names.length; cc++) evalCombo([names[a], names[b], names[cc]]);
    }
    combos.sort((x, y) => y.hitRate - x.hitRate);
    results.indexCombos[target] = combos.slice(0, 60);
  }

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2));
  console.log("wrote", OUT_JSON);

  // ── Report ───────────────────────────────────────────────────────────────
  for (const target of ["IN", "US"] as const) {
    console.log(`\n═══ GLOBAL CUES → ${target} ═══ (best outcome per cue)`);
    for (const [id, r] of Object.entries<any>(results.global[target])) {
      const best = Object.entries<any>(r.outcomes).sort((a, b) => b[1].hitRate - a[1].hitRate)[0];
      console.log(`${r.label.padEnd(42)} ${best[0].padEnd(5)} ${String(best[1].hitRate).padStart(5)}% of ${String(best[1].n).padStart(4)} (test ${best[1].testHitRate}%/${best[1].testN}) avg ${best[1].avgMove}%`);
    }
    console.log(`\n─ top global combos → ${target}`);
    for (const c of results.globalCombos[target].slice(0, 8)) console.log(`${String(c.hitRate).padStart(5)}% of ${String(c.n).padStart(4)} (test ${c.testHitRate}%/${c.testN}) ${c.outcome} avg ${c.avgMove}% :: ${c.members.join(" + ")}`);
    console.log(`\n═══ INDEX SIGNALS → ${target} ═══ (best horizon per signal)`);
    for (const [name, r] of Object.entries<any>(results.index[target])) {
      const best = Object.entries<any>(r).sort((a, b) => b[1].hitRate - a[1].hitRate)[0];
      console.log(`${name.padEnd(28)} ${best[0].padEnd(6)} ${String(best[1].hitRate).padStart(5)}% of ${String(best[1].n).padStart(4)} (test ${best[1].testHitRate}%/${best[1].testN}) avg ${best[1].avgMove}%`);
    }
    console.log(`\n─ top index combos → ${target}`);
    for (const c of results.indexCombos[target].slice(0, 6)) console.log(`${String(c.hitRate).padStart(5)}% of ${String(c.n).padStart(4)} (test ${c.testHitRate}%/${c.testN}) ${c.outcome} avg ${c.avgMove}% :: ${c.members.join(" + ")}`);
  }

  if (generate) {
    // Singles: must beat coin flip convincingly in BOTH periods with real sample.
    const CUE_BAR = { hitRate: 60, n: 100, testHitRate: 55 };
    // Combos: the 90% headline bar with holdout proof.
    const COMBO_BAR = { hitRate: 90, n: 40, testHitRate: 75, testN: 10 };

    const verified: Record<string, any[]> = { IN: [], US: [] };
    for (const target of ["IN", "US"] as const) {
      const cues = target === "IN" ? IN_CUES : US_CUES;
      for (const [id, r] of Object.entries<any>(results.global[target])) {
        const best = Object.entries<any>(r.outcomes).sort((a, b) => b[1].hitRate - a[1].hitRate)[0];
        const [outcome, s] = best;
        if (s.hitRate >= CUE_BAR.hitRate && s.n >= CUE_BAR.n && s.testHitRate >= CUE_BAR.testHitRate) {
          verified[target].push({ id, label: cues.find((c) => c.id === id)!.label, outcome, hitRate: s.hitRate, n: s.n, testHitRate: s.testHitRate, avgMove: s.avgMove });
        }
      }
    }

    const combosOut: Record<string, any[]> = { IN: [], US: [] };
    for (const target of ["IN", "US"] as const) {
      const qual = results.globalCombos[target]
        .filter((c: any) => c.hitRate >= COMBO_BAR.hitRate && c.n >= COMBO_BAR.n && c.testHitRate >= COMBO_BAR.testHitRate && c.testN >= COMBO_BAR.testN)
        .sort((a: any, b: any) => b.hitRate - a.hitRate);
      for (const c of qual) {
        const set = new Set(c.members);
        const redundant = combosOut[target].some((k) => {
          const inter = k.members.filter((m: string) => set.has(m)).length;
          return inter / (k.members.length + c.members.length - inter) >= 0.6;
        });
        if (!redundant) combosOut[target].push(c);
        if (combosOut[target].length >= 6) break;
      }
    }

    const body = `// AUTO-GENERATED by scripts/backtestCues.ts — do not edit by hand.
// 5-year backtest of global-cue signals against what they claim to predict
// (gap = next session's opening gap, day = close-to-close, fwd5 = 5-day drift).
// Singles bar: >=${CUE_BAR.hitRate}% hit rate, >=${CUE_BAR.n} occurrences, >=${CUE_BAR.testHitRate}% on an
// ${HOLDOUT_MONTHS}-month holdout. Combos bar: >=${COMBO_BAR.hitRate}% with >=${COMBO_BAR.testHitRate}% holdout.
// Generated ${new Date().toISOString().slice(0, 10)}.
export interface VerifiedCue {
  id: string;
  label: string;
  outcome: "gap" | "day" | "fwd5";
  hitRate: number;
  n: number;
  testHitRate: number;
  avgMove: number;
}

export interface GapCombo {
  members: string[];
  labels: string[];
  outcome: string;
  hitRate: number;
  n: number;
  testHitRate: number;
  testN: number;
  avgMove: number;
}

export const VERIFIED_GLOBAL_CUES: Record<"IN" | "US", VerifiedCue[]> = ${JSON.stringify(verified, null, 2)};

export const VERIFIED_GAP_COMBOS: Record<"IN" | "US", GapCombo[]> = ${JSON.stringify(combosOut, null, 2)};
`;
    fs.writeFileSync(path.join(process.cwd(), "src", "lib", "verifiedCues.ts"), body);
    console.log("\nwrote src/lib/verifiedCues.ts");
    for (const t of ["IN", "US"] as const) {
      console.log(`${t}: ${verified[t].length} verified cues, ${combosOut[t].length} 90%+ combos`);
    }
  }
}

main();
