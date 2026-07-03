import fs from "fs";
import path from "path";
import { getHistoricalData, getStockQuote } from "./stockData";
import { STRATEGIES, ALL_STRATEGIES } from "./strategies";
import { BACKTEST_CACHE } from "./backtestCache";
import { SIGNAL_GROUPS } from "./signalGroups";
import { analyze, LONGTERM_PROFILE, Thesis } from "./botBrain";
import { getMarketConfig, type Market } from "./markets";
import { recordPicks } from "./pickLedger";

// ─────────────────────────────────────────────────────────────────────────────
// The recommendation engine. Scans the top-500 universe and ranks stocks by
// win-rate-weighted confluence of the verified strategies: a strategy that won
// 65% of its backtested trades gets a bigger vote than one that won 60%.
// Each pick ships with the long-term brain's trade plan (entry/stop/target)
// so it reads as an actionable recommendation, not a screener row.
// Results are cached to data/recommendations-{market}.json per UTC day; a
// server cron refreshes the full universe after each market close.
// ─────────────────────────────────────────────────────────────────────────────

const DATA_DIR = process.env.BOT_STATE_DIR || path.join(process.cwd(), "data");
const HISTORY_DAYS = 280; // enough bars for 200-SMA strategies + the brain

export interface PickStrategy {
  id: string;
  name: string;
  category: string;
  strength: number;
  winRate: number; // 5y backtested win rate
}

export interface ActiveCombo {
  id: string;
  size: number;
  winRate: number;   // full 5y win rate of the group's joint signal
  testWinRate: number;
  trades: number;
}

export interface Recommendation {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  score: number;          // weighted net confluence, higher = stronger buy
  estWinRate: number;     // strength-weighted avg of agreeing strategies' 5y win rates
  buyCount: number;
  sellCount: number;
  totalStrategies: number;
  conviction: number;     // 0..1 from the multi-factor brain
  entry: number;
  stop: number;
  target: number;
  riskReward: number;
  rationale: string;
  topStrategies: PickStrategy[];
  combos: ActiveCombo[];  // mined 80%+ groups fully firing on this stock right now
}

export interface RecommendationSet {
  date: string;         // UTC YYYY-MM-DD the set was computed
  generatedAt: string;  // ISO timestamp
  market: Market;
  scanned: number;
  universe: number;
  picks: Recommendation[];
  avoid: Recommendation[];
  comboHits: Recommendation[]; // every scanned stock with an active mined group
}

// Strategies that only exist as group members (not individually served) still
// need evaluating when checking whether a group fires.
const SERVED_IDS = new Set(STRATEGIES.map((s) => s.id));
const COMBO_ONLY_MEMBERS = ALL_STRATEGIES.filter(
  (s) => !SERVED_IDS.has(s.id) && SIGNAL_GROUPS.some((g) => g.members.includes(s.id))
);

// 60% winner → 0.5 vote, 65% → 1.0, 70% → 1.5. Floor keeps any served
// strategy from being silenced entirely.
function strategyWeight(id: string): number {
  const bt = BACKTEST_CACHE[id];
  if (!bt || bt.trades < 300) return 0.3;
  return Math.max(0.25, (bt.winRate - 55) / 10);
}

function cacheFile(market: Market): string {
  return path.join(DATA_DIR, `recommendations-${market.toLowerCase()}.json`);
}

export function readCachedRecommendations(market: Market): RecommendationSet | null {
  try {
    const raw = JSON.parse(fs.readFileSync(cacheFile(market), "utf8"));
    return raw && Array.isArray(raw.picks) ? (raw as RecommendationSet) : null;
  } catch {
    return null;
  }
}

function writeCache(set: RecommendationSet) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(cacheFile(set.market), JSON.stringify(set));
  } catch {
    // cache write is best-effort; serving the computed set still works
  }
}

async function scoreSymbol(symbol: string, market: Market): Promise<Recommendation | null> {
  const [candles, quote] = await Promise.all([
    getHistoricalData(symbol, HISTORY_DAYS, market),
    getStockQuote(symbol, market),
  ]);
  if (candles.length < 60 || !quote) return null;

  let weightedBuy = 0, weightedSell = 0, totalWeight = 0;
  let buyCount = 0, sellCount = 0;
  let estNum = 0, estDen = 0;
  const buys: PickStrategy[] = [];
  const buyIds = new Set<string>();

  for (const s of STRATEGIES) {
    const w = strategyWeight(s.id);
    totalWeight += w;
    let r;
    try {
      r = s.evaluate(candles);
    } catch {
      continue;
    }
    const vote = w * (r.strength / 100);
    if (r.signal === "BUY") {
      buyCount++;
      weightedBuy += vote;
      buyIds.add(s.id);
      const wr = BACKTEST_CACHE[s.id]?.winRate ?? 0;
      estNum += vote * wr;
      estDen += vote;
      buys.push({ id: s.id, name: s.name, category: s.category, strength: r.strength, winRate: wr });
    } else if (r.signal === "SELL") {
      sellCount++;
      weightedSell += vote;
    }
  }
  if (totalWeight <= 0) return null;

  // Group members outside the served set only matter for combo detection —
  // they don't vote in the confluence score.
  for (const s of COMBO_ONLY_MEMBERS) {
    try {
      const r = s.evaluate(candles);
      if (r.signal === "BUY" && r.strength >= 30) buyIds.add(s.id);
    } catch { /* ignore */ }
  }
  const combos: ActiveCombo[] = SIGNAL_GROUPS
    .filter((g) => g.members.every((m) => buyIds.has(m)))
    .map((g) => ({ id: g.id, size: g.members.length, winRate: g.winRate, testWinRate: g.testWinRate, trades: g.trades }))
    .sort((a, b) => b.winRate - a.winRate);

  const thesis: Thesis | null = analyze(symbol, candles, LONGTERM_PROFILE);
  if (!thesis) return null;

  const net = (100 * (weightedBuy - weightedSell)) / totalWeight;
  const score = net * (0.5 + 0.5 * thesis.conviction);

  // Trade plan uses the SAME multiples the 5y backtest verified (target
  // +1.5*ATR14, stop -2.5*ATR14 from the last close) so the public track
  // record grades exactly what was tested.
  const entry = candles[candles.length - 1].close;
  const target = entry + 1.5 * thesis.atr;
  const stop = entry - 2.5 * thesis.atr;

  return {
    symbol,
    name: quote.name,
    price: quote.price,
    changePercent: quote.changePercent,
    score: +score.toFixed(2),
    estWinRate: estDen > 0 ? +(estNum / estDen).toFixed(1) : 0,
    buyCount,
    sellCount,
    totalStrategies: STRATEGIES.length,
    conviction: +thesis.conviction.toFixed(2),
    entry: +entry.toFixed(2),
    stop: +stop.toFixed(2),
    target: +target.toFixed(2),
    riskReward: 0.6,
    rationale: thesis.rationale.replace(/\s*·\s*R:R[^·]*$/, ""),
    topStrategies: buys
      .sort((a, b) => b.winRate * b.strength - a.winRate * a.strength)
      .slice(0, 5),
    combos,
  };
}

export async function buildRecommendations(
  market: Market,
  limit: number,
  opts: { topN?: number; avoidN?: number } = {}
): Promise<RecommendationSet> {
  const cfg = getMarketConfig(market);
  const symbols = cfg.universe.slice(0, Math.min(limit, cfg.universe.length));
  const topN = opts.topN ?? 20;
  const avoidN = opts.avoidN ?? 8;

  const scored: Recommendation[] = [];
  const batchSize = 6;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((sym) => scoreSymbol(sym, market).catch(() => null))
    );
    for (const r of results) if (r) scored.push(r);
  }

  // Buy picks: brain agrees it's a long, several verified strategies concur.
  const picks = scored
    .filter((r) => r.score > 0 && r.buyCount >= 3 && r.buyCount > r.sellCount)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  // Avoid list: heaviest weighted sell pressure.
  const avoid = scored
    .filter((r) => r.score < 0 && r.sellCount >= 3 && r.sellCount > r.buyCount)
    .sort((a, b) => a.score - b.score)
    .slice(0, avoidN);

  // Every stock where a mined 80%+ group is fully firing, best group first —
  // shown regardless of whether it also made the top picks.
  const comboHits = scored
    .filter((r) => r.combos.length > 0)
    .sort((a, b) => (b.combos[0]?.winRate ?? 0) - (a.combos[0]?.winRate ?? 0) || b.score - a.score)
    .slice(0, 12);

  const set: RecommendationSet = {
    date: new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    market,
    scanned: symbols.length,
    universe: cfg.universe.length,
    picks,
    avoid,
    comboHits,
  };
  writeCache(set);
  // Full-universe runs publish to the immutable track record (pickLedger
  // ignores partial interactive scans).
  try { recordPicks(set); } catch { /* ledger is best-effort */ }
  return set;
}
