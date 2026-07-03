/**
 * Pass B: mine strategy GROUPS whose joint BUY signal (all members firing on
 * the same bar) clears a high win-rate bar over 5 years.
 *
 * Reads the fire logs from scripts/logFires.ts, beam-searches groups of
 * size 2..12 per horizon (10d / 21d), scores by the Wilson lower bound of the
 * train-period win rate, and validates on a held-out final 18 months so
 * multiple-comparison flukes don't survive. Cooldown: one open trade per
 * (group, stock) at a time, matching the single-strategy backtest.
 *
 * Usage: npx tsx scripts/mineGroups.ts [--bar 80] [--top 12]
 */
import fs from "node:fs";
import path from "node:path";

const SCRATCH = "/private/tmp/claude-501/-Users-harshitsingh/c5e818fa-0be7-48b3-bdcd-15465a230bbf/scratchpad";
const FIRES_DIR = path.join(SCRATCH, "fires");
const CANDLE_CACHE = path.join(SCRATCH, "candles");
const OUT_JSON = path.join(process.cwd(), "data", "signal-groups-5y.json");

const MIN_MEMBER_BARS = 200;   // a member must fire on at least this many bars alone
const MIN_TRAIN_TRADES = 25;
const BEAM_WIDTH = 250;
const MAX_SIZE = 12;
const HOLDOUT_MONTHS = 18;

function argNum(flag: string, dflt: number): number {
  const i = process.argv.indexOf(flag);
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) ? v : dflt;
}
const WIN_BAR = argNum("--bar", 80);
const TOP_N = argNum("--top", 12);

interface Rec {
  symKey: number;   // dense symbol index
  barIdx: number;   // trading-bar index within the symbol
  train: boolean;
  hitType: number;  // 0 none, 1 target, 2 stop
  hitDay: number;
  pnlHit: number;
  pnl10: number;
  pnl21: number;
}

function wilsonLB(wins: number, n: number, z = 1.96): number {
  if (n === 0) return 0;
  const p = wins / n;
  const z2 = z * z;
  return ((p + z2 / (2 * n) - z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / (1 + z2 / n)) * 100;
}

// ── Load fire logs ───────────────────────────────────────────────────────────
const files = fs.readdirSync(FIRES_DIR).filter((f) => f.startsWith("fires-"));
if (files.length === 0) throw new Error("no fire logs found");

let strategyIds: string[] = [];
const recs: Rec[] = [];
const fireLists: number[][] = []; // per rec, strategy indices
const symKeys = new Map<string, number>();
const barIdxCache = new Map<string, Map<string, number>>(); // yahooSymbol -> date -> barIdx

function barIndexMap(symbol: string, market: string): Map<string, number> | null {
  const ySym = market === "IN" ? `${symbol}.NS` : symbol.replace(/\./g, "-");
  if (barIdxCache.has(ySym)) return barIdxCache.get(ySym)!;
  const file = path.join(CANDLE_CACHE, `${ySym.replace(/[^A-Za-z0-9.-]/g, "_")}.json`);
  try {
    const candles = JSON.parse(fs.readFileSync(file, "utf8"));
    const m = new Map<string, number>();
    candles.forEach((c: any, i: number) => m.set(String(c.date).slice(0, 10), i));
    barIdxCache.set(ySym, m);
    return m;
  } catch {
    return null;
  }
}

const splitDate = new Date();
splitDate.setMonth(splitDate.getMonth() - HOLDOUT_MONTHS);
const splitStr = splitDate.toISOString().slice(0, 10);

for (const f of files) {
  const raw = JSON.parse(fs.readFileSync(path.join(FIRES_DIR, f), "utf8"));
  strategyIds = raw.strategyIds;
  for (const chunk of raw.chunks) {
    for (const r of chunk.records) {
      const [sym, date, fires, hitType, hitDay, pnlHit, pnl10, pnl21] = r;
      const bm = barIndexMap(sym, chunk.market);
      const barIdx = bm?.get(date);
      if (barIdx == null) continue;
      const skKey = `${chunk.market}:${sym}`;
      if (!symKeys.has(skKey)) symKeys.set(skKey, symKeys.size);
      recs.push({ symKey: symKeys.get(skKey)!, barIdx, train: date < splitStr, hitType, hitDay, pnlHit, pnl10, pnl21 });
      fireLists.push(fires);
    }
  }
}

// Sort rec indices by (symKey, barIdx) so cooldown walks are a single pass.
const order = recs.map((_, i) => i).sort((a, b) => recs[a].symKey - recs[b].symKey || recs[a].barIdx - recs[b].barIdx);
const rank = new Array(order.length);
order.forEach((recIdx, pos) => (rank[recIdx] = pos));

// Per-strategy postings as sorted positions.
const postings: number[][] = strategyIds.map(() => []);
for (let i = 0; i < fireLists.length; i++) {
  const pos = rank[i];
  for (const s of fireLists[i]) postings[s].push(pos);
}
for (const p of postings) p.sort((a, b) => a - b);

console.log(`loaded ${recs.length} fire-bars across ${symKeys.size} symbols; split at ${splitStr}`);

function intersect(a: number[], b: number[]): number[] {
  const out: number[] = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push(a[i]); i++; j++; }
    else if (a[i] < b[j]) i++;
    else j++;
  }
  return out;
}

interface Stats {
  trades: number; wins: number; pnl: number;
  trainTrades: number; trainWins: number;
  testTrades: number; testWins: number; testPnl: number;
}

function evalGroup(positions: number[], horizon: 10 | 21): Stats {
  const st: Stats = { trades: 0, wins: 0, pnl: 0, trainTrades: 0, trainWins: 0, testTrades: 0, testWins: 0, testPnl: 0 };
  let curSym = -1, nextAllowed = -1;
  for (const pos of positions) {
    const rec = recs[order[pos]];
    if (rec.symKey !== curSym) { curSym = rec.symKey; nextAllowed = -1; }
    if (rec.barIdx < nextAllowed) continue;
    let won: boolean, pnl: number, exitDay: number;
    if (rec.hitType !== 0 && rec.hitDay <= horizon) {
      won = rec.hitType === 1; pnl = rec.pnlHit; exitDay = rec.hitDay;
    } else {
      pnl = horizon === 10 ? rec.pnl10 : rec.pnl21; won = pnl > 0; exitDay = horizon;
    }
    nextAllowed = rec.barIdx + exitDay;
    st.trades++; st.pnl += pnl; if (won) st.wins++;
    if (rec.train) { st.trainTrades++; if (won) st.trainWins++; }
    else { st.testTrades++; st.testPnl += pnl; if (won) st.testWins++; }
  }
  return st;
}

interface Candidate {
  members: number[];
  positions: number[];
  stats: Stats;
  horizon: 10 | 21;
  lb: number; // Wilson LB of train win rate
}

const eligible: number[] = [];
for (let s = 0; s < strategyIds.length; s++) if (postings[s].length >= MIN_MEMBER_BARS) eligible.push(s);
console.log(`${eligible.length} strategies eligible as group members`);

const pool: Candidate[] = [];

for (const horizon of [10, 21] as const) {
  let beam: Candidate[] = eligible.map((s) => {
    const stats = evalGroup(postings[s], horizon);
    return { members: [s], positions: postings[s], stats, horizon, lb: wilsonLB(stats.trainWins, stats.trainTrades) };
  });

  for (let size = 2; size <= MAX_SIZE; size++) {
    const next = new Map<string, Candidate>();
    for (const g of beam) {
      const maxM = g.members[g.members.length - 1];
      for (const s of eligible) {
        if (s <= maxM) continue;
        const positions = intersect(g.positions, postings[s]);
        if (positions.length < MIN_TRAIN_TRADES) continue;
        const members = [...g.members, s];
        const key = members.join(",");
        if (next.has(key)) continue;
        const stats = evalGroup(positions, horizon);
        if (stats.trainTrades < MIN_TRAIN_TRADES) continue;
        const cand: Candidate = { members, positions, stats, horizon, lb: wilsonLB(stats.trainWins, stats.trainTrades) };
        next.set(key, cand);
      }
    }
    const arr = [...next.values()].sort((a, b) => b.lb - a.lb);
    beam = arr.slice(0, BEAM_WIDTH);
    for (const c of beam) {
      const wr = (c.stats.wins / Math.max(1, c.stats.trades)) * 100;
      if (c.stats.trades >= 40 && wr >= WIN_BAR - 10) pool.push(c); // pool keeps near-bar too, for reporting
    }
    if (beam.length === 0) break;
    const best = beam[0];
    console.log(`h${horizon} size ${size}: beam ${beam.length}, best trainLB ${best.lb.toFixed(1)} (full ${(best.stats.wins / best.stats.trades * 100).toFixed(1)}% / ${best.stats.trades}t)`);
  }
}

// ── Final selection ──────────────────────────────────────────────────────────
const fullWR = (c: Candidate) => (c.stats.wins / Math.max(1, c.stats.trades)) * 100;
const testWR = (c: Candidate) => (c.stats.testWins / Math.max(1, c.stats.testTrades)) * 100;

const qualified = pool
  .filter((c) => fullWR(c) >= WIN_BAR && c.stats.trades >= 40 && c.stats.testTrades >= 10 && testWR(c) >= 70 && c.stats.pnl / c.stats.trades > 0)
  .sort((a, b) => wilsonLB(b.stats.wins, b.stats.trades) - wilsonLB(a.stats.wins, a.stats.trades));

// Dedupe: drop groups too similar (Jaccard >= 0.6) to an already-kept one.
const kept: Candidate[] = [];
for (const c of qualified) {
  const set = new Set(c.members);
  const similar = kept.some((k) => {
    const inter = k.members.filter((m) => set.has(m)).length;
    return inter / (k.members.length + c.members.length - inter) >= 0.6;
  });
  if (!similar) kept.push(c);
  if (kept.length >= TOP_N) break;
}

console.log(`\npool ${pool.length}, qualified ${qualified.length}, kept ${kept.length} (bar: full>=${WIN_BAR}%, test>=70%)`);
const describe = (c: Candidate) =>
  `${fullWR(c).toFixed(1)}% (${c.stats.trades}t, LB ${wilsonLB(c.stats.wins, c.stats.trades).toFixed(1)}) | test ${testWR(c).toFixed(1)}% (${c.stats.testTrades}t) | avg ${(c.stats.pnl / c.stats.trades).toFixed(2)}% | h${c.horizon} | ${c.members.map((m) => strategyIds[m]).join(" + ")}`;
for (const c of kept) console.log("KEEP", describe(c));
if (kept.length === 0) {
  console.log("\nBest near-misses:");
  const near = pool.sort((a, b) => wilsonLB(b.stats.wins, b.stats.trades) - wilsonLB(a.stats.wins, a.stats.trades)).slice(0, 15);
  for (const c of near) console.log("NEAR", describe(c));
}

fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify({
  generated: new Date().toISOString(),
  bar: WIN_BAR, holdoutMonths: HOLDOUT_MONTHS, splitDate: splitStr,
  totalFireBars: recs.length,
  kept: kept.map((c, i) => ({
    id: `combo-${i + 1}`,
    members: c.members.map((m) => strategyIds[m]),
    horizon: c.horizon,
    winRate: +fullWR(c).toFixed(1),
    wilsonLB: +wilsonLB(c.stats.wins, c.stats.trades).toFixed(1),
    trades: c.stats.trades,
    avgReturn: +(c.stats.pnl / c.stats.trades).toFixed(3),
    testWinRate: +testWR(c).toFixed(1),
    testTrades: c.stats.testTrades,
  })),
}, null, 2));
console.log(`\nwrote ${OUT_JSON}`);

// Generate the runtime module.
const keptRows = kept.map((c, i) => {
  const members = c.members.map((m) => strategyIds[m]);
  return `  { id: "combo-${i + 1}", members: ${JSON.stringify(members)}, horizon: ${c.horizon}, winRate: ${+fullWR(c).toFixed(1)}, trades: ${c.stats.trades}, avgReturn: ${+(c.stats.pnl / c.stats.trades).toFixed(3)}, testWinRate: ${+testWR(c).toFixed(1)}, testTrades: ${c.stats.testTrades} },`;
}).join("\n");
fs.writeFileSync(path.join(process.cwd(), "src", "lib", "signalGroups.ts"), `// AUTO-GENERATED by scripts/mineGroups.ts — do not edit by hand.
// Strategy groups whose joint BUY signal cleared ${WIN_BAR}%+ win rate over 5
// years (same trade plan as the single-strategy backtest) AND held >=70% on an
// ${HOLDOUT_MONTHS}-month holdout. A group fires when EVERY member signals BUY
// on the same bar.
export interface SignalGroup {
  id: string;
  members: string[];
  horizon: number;
  winRate: number;
  trades: number;
  avgReturn: number;
  testWinRate: number;
  testTrades: number;
}

export const SIGNAL_GROUPS: SignalGroup[] = [
${keptRows}
];
`);
console.log("wrote src/lib/signalGroups.ts");
