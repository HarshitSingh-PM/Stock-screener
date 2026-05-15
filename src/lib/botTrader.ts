import { STRATEGIES } from "./strategies";
import { getHistoricalData } from "./stockData";
import { getMarketConfig, type Market } from "./markets";
import type { BotHolding, BotState, BotTrade, BotSnapshot } from "./botStorage";

// ─── Trading rules ───────────────────────────────────────────────────────────
// These constants drive a profit-seeking, risk-managed trader. The bot acts
// like a disciplined retail trader: cuts losers fast, lets winners run but
// locks profits when a stronger candidate exists, sizes positions by
// conviction, and never lets cash sit idle for long.
export const MAX_POSITIONS = 5;       // Hard cap on concurrent positions.
const BUY_CONFLUENCE_MIN = 2;         // Min BUY-strategy count to qualify a pick.
const STOP_LOSS_PCT = -5;             // Exit immediately if a position bleeds past this.
const TAKE_PROFIT_PCT = 12;           // Lock gains past this IF a stronger signal exists.
const ROTATION_SCORE_GAP = 2;         // Stronger signal must beat current by this margin.
const CASH_REDEPLOY_RATIO = 0.01;     // Top up the strongest holding when idle cash > 1% of starting capital.
const SCAN_BATCH = 5;                 // Parallel fetches per batch (Yahoo Finance rate ceiling).

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

function round(n: number, d = 2): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
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
    symbol, price, buyCount, sellCount,
    avgBuyStrength: buyCount > 0 ? buyStrength / buyCount : 0,
    avgSellStrength: sellCount > 0 ? sellStrength / sellCount : 0,
  };
}

async function evaluateBatch(symbols: string[], market: Market): Promise<EvaluatedSymbol[]> {
  const out: EvaluatedSymbol[] = [];
  for (let i = 0; i < symbols.length; i += SCAN_BATCH) {
    const batch = symbols.slice(i, i + SCAN_BATCH);
    const results = await Promise.allSettled(batch.map((s) => evaluateSymbol(s, market)));
    for (const r of results) if (r.status === "fulfilled" && r.value) out.push(r.value);
  }
  return out;
}

export interface BotRunSummary {
  market: Market;
  ran: boolean;
  reason?: string;
  evaluatedHoldings: number;
  evaluatedCandidates: number;
  trades: BotTrade[];
  snapshot: BotSnapshot | null;
  state: BotState;
}

// Rank candidates by buy confluence with deterministic tiebreakers.
//   1. higher buyCount
//   2. higher avgBuyStrength
//   3. prefer currently-held symbols on exact ties (anti-thrash)
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

// Executes one trading day for one market against the provided state.
// Caller is responsible for persisting the returned state.
//
// Daily decision flow:
//   1. Score every universe + held symbol against all 100 strategies.
//   2. RISK MANAGEMENT — for each holding:
//      a. Stop-loss: sell unconditionally if P&L <= -5%.
//      b. Take-profit: sell if P&L >= +12% AND a non-held candidate's BUY
//         confluence is meaningfully stronger (locks gains, redeploys).
//   3. SIGNAL ROTATION — rank everything that survived. Target = top 5.
//      Any current holding outside the target gets sold; any target stock
//      not currently held gets bought, sized by signal strength.
//   4. CASH REDEPLOY — if idle cash exceeds 1% of starting capital after
//      rotation, top up the strongest holding so capital is never wasted.
//
// Net effect: bot cuts losers fast, locks winners when smarter trades exist,
// always holds high-conviction positions sized by signal strength, and keeps
// nearly 100% of capital deployed.
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

  // ─── Step 1: Score holdings + universe together ──────────────────────────
  const heldSymbols = new Set(state.holdings.map((h) => h.symbol));
  const allSymbols = Array.from(new Set([...heldSymbols, ...cfg.botUniverse]));
  const evals = await evaluateBatch(allSymbols, market);
  const evalMap: Record<string, EvaluatedSymbol> = {};
  for (const e of evals) evalMap[e.symbol] = e;

  const heldEvalsCount = state.holdings.filter((h) => evalMap[h.symbol]).length;
  const universeEvalsCount = evals.length - heldEvalsCount;

  const ranked = rank(evals, heldSymbols);
  const strongestNonHeld = ranked.find((r) => !heldSymbols.has(r.symbol));

  const tradesToday: BotTrade[] = [];

  const sellHolding = (h: BotHolding, exitPrice: number, reason: string) => {
    const proceeds = h.quantity * exitPrice;
    const realized = (exitPrice - h.avgBuyPrice) * h.quantity;
    state.cash += proceeds;
    state.realizedPnL += realized;
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
  };

  // ─── Step 2: Risk management — stop-loss + take-profit-with-rotation ─────
  const afterRiskMgmt: BotHolding[] = [];
  for (const h of state.holdings) {
    const e = evalMap[h.symbol];
    const price = e?.price ?? h.avgBuyPrice;
    const pnlPct = ((price - h.avgBuyPrice) / h.avgBuyPrice) * 100;

    if (pnlPct <= STOP_LOSS_PCT) {
      sellHolding(h, price, `Stop loss triggered at ${pnlPct.toFixed(1)}% — cutting the loss`);
      continue;
    }

    const myScore = e?.buyCount ?? 0;
    const candidateScore = strongestNonHeld?.buyCount ?? 0;
    if (
      pnlPct >= TAKE_PROFIT_PCT
      && strongestNonHeld
      && candidateScore >= myScore + ROTATION_SCORE_GAP
    ) {
      sellHolding(
        h,
        price,
        `Take profit at +${pnlPct.toFixed(1)}% — rotating into ${strongestNonHeld.symbol} (stronger signal: ${candidateScore} vs ${myScore} BUY strategies)`,
      );
      continue;
    }

    afterRiskMgmt.push(h);
  }
  state.holdings = afterRiskMgmt;

  // ─── Step 3: Signal-based rotation — keep top 5 ──────────────────────────
  const target = ranked.slice(0, MAX_POSITIONS);
  const targetSet = new Set(target.map((e) => e.symbol));

  const afterRotation: BotHolding[] = [];
  for (const h of state.holdings) {
    if (targetSet.has(h.symbol)) { afterRotation.push(h); continue; }
    const e = evalMap[h.symbol];
    const exitPrice = e?.price ?? h.avgBuyPrice;
    let reason: string;
    if (!e) {
      reason = "Could not evaluate — exiting position";
    } else if (e.buyCount < BUY_CONFLUENCE_MIN || e.sellCount > e.buyCount) {
      reason = `Strategies turned bearish (${e.buyCount} BUY / ${e.sellCount} SELL) — exiting`;
    } else {
      const replacement = target.find((t) => !heldSymbols.has(t.symbol));
      reason = replacement
        ? `Rotated out for ${replacement.symbol} (stronger BUY confluence: ${replacement.buyCount} vs ${e.buyCount})`
        : `Dropped below top ${MAX_POSITIONS} — ${e.buyCount} BUY, avg strength ${e.avgBuyStrength.toFixed(0)}`;
    }
    sellHolding(h, exitPrice, reason);
  }
  state.holdings = afterRotation;

  // ─── Step 4: Buy new picks, sized by signal strength ─────────────────────
  const newPicks = target.filter((t) => !state.holdings.some((h) => h.symbol === t.symbol));
  if (newPicks.length > 0 && state.cash > 0) {
    // Conviction-weighted sizing: a stock with 12 BUY strategies gets twice
    // the allocation of one with 6. Computed against the cash snapshot at
    // the start of this buying pass so the math is deterministic.
    const cashAtStart = state.cash;
    const totalScore = newPicks.reduce((s, p) => s + p.buyCount, 0);
    const plan = newPicks.map((p) => ({
      pick: p,
      budget: totalScore > 0 ? cashAtStart * (p.buyCount / totalScore) : cashAtStart / newPicks.length,
    }));

    for (const { pick, budget } of plan) {
      if (state.cash <= 0) break;
      const actualBudget = Math.min(budget, state.cash);
      const qty = Math.floor(actualBudget / pick.price);
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
        reason: `${pick.buyCount} strategies signaling BUY (avg strength ${pick.avgBuyStrength.toFixed(0)}) — conviction-weighted entry`,
      });
    }
  }

  // ─── Step 5: Cash redeployment ───────────────────────────────────────────
  // Cash from rounding compounds over weeks. Top up the strongest holding
  // whenever idle cash exceeds 1% of starting capital so capital is always
  // working.
  const redeployThreshold = state.startingCapital * CASH_REDEPLOY_RATIO;
  if (state.cash > redeployThreshold && state.holdings.length > 0) {
    const scoredHoldings = state.holdings
      .map((h) => ({ h, e: evalMap[h.symbol] }))
      .filter((x) => x.e && x.e.price > 0)
      .sort((a, b) => (b.e!.buyCount - a.e!.buyCount) || (b.e!.avgBuyStrength - a.e!.avgBuyStrength));

    const top = scoredHoldings[0];
    if (top && top.e) {
      const extraQty = Math.floor(state.cash / top.e.price);
      if (extraQty > 0) {
        const cost = extraQty * top.e.price;
        // Update average buy price across old + new shares.
        const newQty = top.h.quantity + extraQty;
        top.h.avgBuyPrice = ((top.h.quantity * top.h.avgBuyPrice) + cost) / newQty;
        top.h.quantity = newQty;
        state.cash -= cost;
        tradesToday.push({
          date,
          timestamp: new Date().toISOString(),
          symbol: top.h.symbol,
          action: "BUY",
          quantity: extraQty,
          price: top.e.price,
          total: cost,
          reason: `Cash redeployment — topped up strongest holding (${top.e.buyCount} BUY signals)`,
        });
      }
    }
  }

  // ─── Step 6: Equity snapshot ─────────────────────────────────────────────
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
