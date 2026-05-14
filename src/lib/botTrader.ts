import { STRATEGIES } from "./strategies";
import { getHistoricalData } from "./stockData";
import { getMarketConfig, type Market } from "./markets";
import type { BotState, BotTrade, BotSnapshot } from "./botStorage";

export const MAX_POSITIONS = 5;  // Cap on concurrent positions ("5 different shares" constraint).
const BUY_CONFLUENCE_MIN = 3;    // Min BUY-strategy count to qualify any pick.
const SCAN_BATCH = 5;            // Parallel-fetch batch size to keep Yahoo Finance happy.

interface EvaluatedSymbol {
  symbol: string;
  price: number;
  buyCount: number;
  sellCount: number;
  avgBuyStrength: number;
  avgSellStrength: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function evaluateSymbol(symbol: string, market: Market): Promise<EvaluatedSymbol | null> {
  const candles = await getHistoricalData(symbol, 200, market);
  if (candles.length < 50) return null;
  const price = candles[candles.length - 1].close;

  let buyCount = 0, sellCount = 0;
  let buyStrength = 0, sellStrength = 0;
  for (const s of STRATEGIES) {
    try {
      const r = s.evaluate(candles);
      if (r.signal === "BUY") { buyCount++; buyStrength += r.strength; }
      else if (r.signal === "SELL") { sellCount++; sellStrength += r.strength; }
    } catch { /* ignore individual strategy errors */ }
  }
  return {
    symbol,
    price,
    buyCount,
    sellCount,
    avgBuyStrength: buyCount > 0 ? buyStrength / buyCount : 0,
    avgSellStrength: sellCount > 0 ? sellStrength / sellCount : 0,
  };
}

async function evaluateBatch(symbols: string[], market: Market): Promise<EvaluatedSymbol[]> {
  const out: EvaluatedSymbol[] = [];
  for (let i = 0; i < symbols.length; i += SCAN_BATCH) {
    const batch = symbols.slice(i, i + SCAN_BATCH);
    const results = await Promise.allSettled(batch.map((s) => evaluateSymbol(s, market)));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) out.push(r.value);
    }
  }
  return out;
}

export interface BotRunSummary {
  market: Market;
  ran: boolean;             // false if already ran today
  reason?: string;
  evaluatedHoldings: number;
  evaluatedCandidates: number;
  trades: BotTrade[];
  snapshot: BotSnapshot | null;
  state: BotState;
}

// Rank candidates by buy confluence. Tiebreakers:
//   1. higher avgBuyStrength
//   2. prefer currently-held symbols on exact ties (anti-thrash)
function rank(evals: EvaluatedSymbol[], heldSymbols: Set<string>): EvaluatedSymbol[] {
  return [...evals]
    .filter((e) => e.buyCount >= BUY_CONFLUENCE_MIN && e.buyCount > e.sellCount && e.price > 0)
    .sort((a, b) => {
      if (b.buyCount !== a.buyCount) return b.buyCount - a.buyCount;
      if (b.avgBuyStrength !== a.avgBuyStrength) return b.avgBuyStrength - a.avgBuyStrength;
      const aHeld = heldSymbols.has(a.symbol) ? 1 : 0;
      const bHeld = heldSymbols.has(b.symbol) ? 1 : 0;
      return bHeld - aHeld;
    });
}

// Executes one trading "day" for one market against the provided state.
// Caller persists the returned state.
//
// Decision logic (post-rewrite, May 2026):
//   1. Score every candidate in the universe + every current holding.
//   2. Rank by buyCount desc → avgBuyStrength desc → prefer-held on ties.
//   3. Target portfolio = top MAX_POSITIONS qualifying candidates.
//   4. Sell any current holding NOT in target (frees cash).
//   5. Buy any target NOT currently held, equal-weighted from remaining cash.
//
// Net effect: when a fresh candidate scores higher than a current holding,
// the bot rotates — sells the weaker holding, buys the stronger pick.
export async function runBotDay(state: BotState): Promise<BotRunSummary> {
  const market = state.market;
  const cfg = getMarketConfig(market);
  const date = today();

  if (state.lastRunDate === date) {
    return {
      market, ran: false, reason: "already ran today",
      evaluatedHoldings: 0, evaluatedCandidates: 0,
      trades: [], snapshot: state.snapshots[state.snapshots.length - 1] ?? null, state,
    };
  }

  // ─── Step 1: Score holdings + universe together ───
  const heldSymbols = new Set(state.holdings.map((h) => h.symbol));
  const universe = cfg.botUniverse;
  const allSymbols = Array.from(new Set([...heldSymbols, ...universe]));
  const evals = await evaluateBatch(allSymbols, market);
  const evalMap: Record<string, EvaluatedSymbol> = {};
  for (const e of evals) evalMap[e.symbol] = e;

  const heldEvalsCount = state.holdings.filter((h) => evalMap[h.symbol]).length;
  const universeEvalsCount = evals.length - heldEvalsCount;

  // ─── Step 2: Rank and pick target portfolio ───
  const ranked = rank(evals, heldSymbols);
  const target = ranked.slice(0, MAX_POSITIONS);
  const targetSet = new Set(target.map((e) => e.symbol));

  const tradesToday: BotTrade[] = [];

  // ─── Step 3: Sell holdings not in target ───
  const keepHoldings = [];
  for (const h of state.holdings) {
    if (targetSet.has(h.symbol)) {
      keepHoldings.push(h);
      continue;
    }
    const e = evalMap[h.symbol];
    // Fall back to avgBuyPrice if we somehow couldn't fetch a price.
    const exitPrice = e?.price ?? h.avgBuyPrice;
    const proceeds = h.quantity * exitPrice;
    const realized = (exitPrice - h.avgBuyPrice) * h.quantity;
    state.cash += proceeds;
    state.realizedPnL += realized;

    // Build a human-readable reason that explains the rotation.
    let reason: string;
    if (e && (e.buyCount < BUY_CONFLUENCE_MIN || e.sellCount > e.buyCount)) {
      reason = `Strategies turned bearish (${e.buyCount} BUY / ${e.sellCount} SELL)`;
    } else if (e) {
      const replacedBy = target.find((t) => !heldSymbols.has(t.symbol));
      reason = replacedBy
        ? `Rotated out — ${replacedBy.symbol} has stronger BUY confluence (${replacedBy.buyCount} vs ${e.buyCount})`
        : `Ranked below top ${MAX_POSITIONS} (${e.buyCount} BUY strategies, avg strength ${e.avgBuyStrength.toFixed(0)})`;
    } else {
      reason = "Could not evaluate — exiting position";
    }

    tradesToday.push({
      date,
      timestamp: new Date().toISOString(),
      symbol: h.symbol,
      action: "SELL",
      quantity: h.quantity,
      price: exitPrice,
      total: proceeds,
      realizedPnL: realized,
      reason,
    });
  }
  state.holdings = keepHoldings;

  // ─── Step 4: Buy new picks not currently held ───
  const newPicks = target.filter((t) => !state.holdings.some((h) => h.symbol === t.symbol));
  if (newPicks.length > 0 && state.cash > 0) {
    // Equal-weight remaining cash across the picks we're filling.
    const perSlotBudget = state.cash / newPicks.length;
    for (const pick of newPicks) {
      if (state.cash <= 0) break;
      const budget = Math.min(perSlotBudget, state.cash);
      const qty = Math.floor(budget / pick.price);
      if (qty <= 0) continue;
      const cost = qty * pick.price;
      state.cash -= cost;
      state.holdings.push({
        symbol: pick.symbol,
        quantity: qty,
        avgBuyPrice: pick.price,
        buyDate: date,
      });
      tradesToday.push({
        date,
        timestamp: new Date().toISOString(),
        symbol: pick.symbol,
        action: "BUY",
        quantity: qty,
        price: pick.price,
        total: cost,
        reason: `${pick.buyCount} strategies signaling BUY (avg strength ${pick.avgBuyStrength.toFixed(0)})`,
      });
    }
  }

  // ─── Step 5: Equity snapshot ───
  let holdingsValue = 0;
  for (const h of state.holdings) {
    const price = evalMap[h.symbol]?.price ?? h.avgBuyPrice;
    holdingsValue += h.quantity * price;
  }
  const equity = state.cash + holdingsValue;
  const pnl = equity - state.startingCapital;
  const snapshot: BotSnapshot = {
    date,
    cash: round(state.cash),
    holdingsValue: round(holdingsValue),
    equity: round(equity),
    pnl: round(pnl),
    pnlPercent: round((pnl / state.startingCapital) * 100, 3),
    positions: state.holdings.length,
    tradesCount: tradesToday.length,
  };
  const existingIdx = state.snapshots.findIndex((s) => s.date === date);
  if (existingIdx >= 0) state.snapshots[existingIdx] = snapshot;
  else state.snapshots.push(snapshot);

  state.trades.push(...tradesToday);
  state.lastRunDate = date;

  return {
    market,
    ran: true,
    evaluatedHoldings: heldEvalsCount,
    evaluatedCandidates: universeEvalsCount,
    trades: tradesToday,
    snapshot,
    state,
  };
}

function round(n: number, d = 2): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
