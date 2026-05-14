import { STRATEGIES } from "./strategies";
import { getHistoricalData } from "./stockData";
import { getMarketConfig, type Market } from "./markets";
import type { BotHolding, BotState, BotTrade, BotSnapshot } from "./botStorage";

export const MAX_POSITIONS = 5;        // Cap on concurrent positions (user constraint: "5 different shares").
const BUY_CONFLUENCE_MIN = 3;          // Min BUY-signal count to qualify a candidate.
const SELL_CONFLUENCE_MIN = 3;         // Min SELL-signal count to exit a holding.
const SCAN_BATCH = 5;                  // Parallel-fetch batch size.

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
  ran: boolean;             // false if already ran today / skipped
  reason?: string;
  evaluatedHoldings: number;
  evaluatedCandidates: number;
  trades: BotTrade[];
  snapshot: BotSnapshot | null;
  state: BotState;
}

// Executes one trading "day" for one market against the provided state.
// Pure-ish: takes state in, returns mutated state out. Caller persists.
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

  const tradesToday: BotTrade[] = [];

  // ─── Step 1: Evaluate holdings for SELL ───
  const holdingEvals = await evaluateBatch(state.holdings.map((h) => h.symbol), market);
  const holdingMap: Record<string, EvaluatedSymbol> = {};
  for (const e of holdingEvals) holdingMap[e.symbol] = e;

  const remainingHoldings: BotHolding[] = [];
  for (const h of state.holdings) {
    const evalRes = holdingMap[h.symbol];
    if (!evalRes) { remainingHoldings.push(h); continue; }
    const shouldSell = evalRes.sellCount >= SELL_CONFLUENCE_MIN && evalRes.sellCount > evalRes.buyCount;
    if (shouldSell) {
      const proceeds = h.quantity * evalRes.price;
      const realized = (evalRes.price - h.avgBuyPrice) * h.quantity;
      state.cash += proceeds;
      state.realizedPnL += realized;
      tradesToday.push({
        date,
        timestamp: new Date().toISOString(),
        symbol: h.symbol,
        action: "SELL",
        quantity: h.quantity,
        price: evalRes.price,
        total: proceeds,
        realizedPnL: realized,
        reason: `${evalRes.sellCount} strategies signaling SELL (avg strength ${evalRes.avgSellStrength.toFixed(0)})`,
      });
    } else {
      remainingHoldings.push(h);
    }
  }
  state.holdings = remainingHoldings;

  // ─── Step 2: Fill open slots from top BUY candidates ───
  const openSlots = MAX_POSITIONS - state.holdings.length;
  let candidates: EvaluatedSymbol[] = [];

  if (openSlots > 0) {
    const heldSet = new Set(state.holdings.map((h) => h.symbol));
    const universe = cfg.botUniverse.filter((s) => !heldSet.has(s));
    const evals = await evaluateBatch(universe, market);
    candidates = evals
      .filter((e) => e.buyCount >= BUY_CONFLUENCE_MIN && e.buyCount > e.sellCount && e.price > 0)
      .sort((a, b) => b.buyCount - a.buyCount || b.avgBuyStrength - a.avgBuyStrength);

    const picks = candidates.slice(0, openSlots);

    // Equal-weight remaining cash across the slots we're filling.
    const perSlotBudget = picks.length > 0 ? state.cash / picks.length : 0;

    for (const pick of picks) {
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

  // ─── Step 3: Compute equity snapshot ───
  let holdingsValue = 0;
  for (const h of state.holdings) {
    const evalRes = holdingMap[h.symbol] || (await evaluateSymbol(h.symbol, market));
    const price = evalRes?.price ?? h.avgBuyPrice;
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

  // Replace today's snapshot if it exists, else append.
  const existingIdx = state.snapshots.findIndex((s) => s.date === date);
  if (existingIdx >= 0) state.snapshots[existingIdx] = snapshot;
  else state.snapshots.push(snapshot);

  state.trades.push(...tradesToday);
  state.lastRunDate = date;

  return {
    market,
    ran: true,
    evaluatedHoldings: holdingEvals.length,
    evaluatedCandidates: candidates.length,
    trades: tradesToday,
    snapshot,
    state,
  };
}

function round(n: number, d = 2): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
