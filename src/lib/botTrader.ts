import { getHistoricalData, getIntradayData } from "./stockData";
import { getMarketConfig, type Market } from "./markets";
import { analyze, LONGTERM_PROFILE, INTRADAY_PROFILE, type Thesis } from "./botBrain";
import { getFundamentalView } from "./fundamentals";
import type { OHLCV } from "./indicators";
import type { BotHolding, BotState, BotTrade, BotSnapshot } from "./botStorage";

// ─── Shared trading parameters ───────────────────────────────────────────────
export const MAX_POSITIONS = 5;          // both bots hold at most 5 names
const SCAN_BATCH = 5;                     // parallel Yahoo fetches per batch

// Long-term (positional) bot
const LT_RISK_PER_TRADE = 0.02;          // risk 2% of equity per position (fixed-fractional)
const LT_MAX_POSITION_PCT = 0.35;        // never more than 35% of equity in one name
const LT_CASH_REDEPLOY_RATIO = 0.02;     // reinvest idle cash above 2% of equity
const LT_MIN_SCORE = 0.15;               // composite score needed to qualify a long

// Intraday bot — re-scans for fresh setups several times a session and redeploys
// freed-up capital, so it takes multiple round trips in a day.
const ID_RISK_PER_TRADE = 0.015;         // tighter risk per intraday trade
const ID_MAX_POSITION_PCT = 0.30;
const ID_MIN_SCORE = 0.12;
const ID_FIRST_DECISION = 4;             // first entry window ~1h into the session (4×15m)
const ID_DECISION_STEP = 3;              // re-scan for fresh setups ~every 45 min
const ID_CLOSE_BUFFER = 2;               // stop opening new trades in the last ~30 min

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function round(n: number, d = 2): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// Fixed-fractional position sizing (AutoHedge min-of-caps + ai-hedge-fund risk
// limits): risk a fixed % of equity per trade based on the stop distance, then
// clamp to the max-exposure cap and to available cash.
function sizeByRisk(
  equity: number, cash: number, entry: number, stop: number,
  riskPerTrade: number, maxPositionPct: number
): number {
  const stopDist = entry - stop;
  if (stopDist <= 0 || entry <= 0) return 0;
  const byRisk = (equity * riskPerTrade) / stopDist;
  const byExposure = (equity * maxPositionPct) / entry;
  const byCash = cash / entry;
  return Math.max(0, Math.floor(Math.min(byRisk, byExposure, byCash)));
}

export interface BotRunSummary {
  kind: BotState["kind"];
  market: Market;
  ran: boolean;
  reason?: string;
  evaluatedHoldings: number;
  evaluatedCandidates: number;
  trades: BotTrade[];
  snapshot: BotSnapshot | null;
  state: BotState;
}

// Dispatch to the correct engine based on the bot kind.
export async function runBotDay(state: BotState): Promise<BotRunSummary> {
  return state.kind === "intraday" ? runIntradayBotDay(state) : runLongTermBotDay(state);
}

// ─────────────────────────────────────────────────────────────────────────────
// LONG-TERM (positional) bot
//
// Holds across days. Each run:
//   1. Build a composite thesis for every held + universe name (daily candles).
//   2. Add a fundamental quality tilt (investor checklists) to the top picks.
//   3. Risk-manage holdings: trailing stop, target+rotation, broken thesis.
//   4. Rotate to keep the 5 highest-conviction longs.
//   5. Size new buys by fixed-fractional risk; reinvest idle cash (compounding).
// ─────────────────────────────────────────────────────────────────────────────
async function runLongTermBotDay(state: BotState): Promise<BotRunSummary> {
  const market = state.market;
  const cfg = getMarketConfig(market);
  const date = today();

  if (state.lastRunDate === date) {
    return {
      kind: state.kind, market, ran: false, reason: "already ran today",
      evaluatedHoldings: 0, evaluatedCandidates: 0,
      trades: [], snapshot: state.snapshots[state.snapshots.length - 1] ?? null, state,
    };
  }

  const heldSymbols = new Set(state.holdings.map(h => h.symbol));
  const allSymbols = Array.from(new Set([...heldSymbols, ...cfg.botUniverse]));

  // Build theses in batches.
  const theses = new Map<string, Thesis>();
  for (let i = 0; i < allSymbols.length; i += SCAN_BATCH) {
    const batch = allSymbols.slice(i, i + SCAN_BATCH);
    const results = await Promise.allSettled(batch.map(async (sym) => {
      const candles = await getHistoricalData(sym, 300, market);
      return analyze(sym, candles, LONGTERM_PROFILE);
    }));
    for (const r of results) if (r.status === "fulfilled" && r.value) theses.set(r.value.symbol, r.value);
  }

  const heldEvalsCount = state.holdings.filter(h => theses.has(h.symbol)).length;
  const universeEvalsCount = theses.size - heldEvalsCount;

  // Rank long candidates by composite conviction.
  const longs = [...theses.values()]
    .filter(t => t.direction === "LONG" && t.score >= LT_MIN_SCORE)
    .sort((a, b) => (b.score * (0.5 + b.conviction)) - (a.score * (0.5 + a.conviction)));

  // Fundamental quality tilt for the top ~15 technical candidates (limits API calls).
  const tiltSet = longs.slice(0, 15).map(t => t.symbol);
  const quality = new Map<string, number>();
  await Promise.allSettled(tiltSet.map(async (sym) => {
    const fv = await getFundamentalView(sym, market);
    quality.set(sym, fv.qualityScore);
  }));
  const rankScore = (t: Thesis) => {
    const q = quality.get(t.symbol) ?? 0.5;
    return t.score * (0.5 + t.conviction) + 0.25 * (q - 0.5) * 2; // +/-0.25 tilt
  };
  longs.sort((a, b) => rankScore(b) - rankScore(a));

  const target = longs.slice(0, MAX_POSITIONS);
  const targetSet = new Set(target.map(t => t.symbol));
  const strongestNonHeld = longs.find(t => !heldSymbols.has(t.symbol));

  const tradesToday: BotTrade[] = [];
  const sellHolding = (h: BotHolding, price: number, reason: string) => {
    const proceeds = h.quantity * price;
    const realized = (price - h.avgBuyPrice) * h.quantity;
    state.cash += proceeds;
    state.realizedPnL += realized;
    tradesToday.push({
      date, timestamp: new Date().toISOString(), symbol: h.symbol, action: "SELL",
      quantity: h.quantity, price, total: proceeds, realizedPnL: realized, reason,
    });
  };

  // ── Risk management on existing holdings ──
  const survivors: BotHolding[] = [];
  for (const h of state.holdings) {
    const t = theses.get(h.symbol);
    const price = t?.price ?? h.avgBuyPrice;
    const pnlPct = ((price - h.avgBuyPrice) / h.avgBuyPrice) * 100;

    // 1. Trailing stop — raise the stop as the position works; never lower it.
    if (t) h.stop = Math.max(h.stop ?? t.stop, t.stop);

    // 2. Stop hit → cut the loss / lock the trail.
    if (h.stop != null && price <= h.stop) {
      sellHolding(h, price, `Stop hit at ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}% — protecting capital`);
      continue;
    }
    // 3. Thesis broken → exit.
    if (t && t.direction !== "LONG") {
      sellHolding(h, price, `Thesis turned ${t.direction.toLowerCase()} (${t.buyCount} BUY/${t.sellCount} SELL) — exiting`);
      continue;
    }
    // 4. Target reached AND a stronger candidate exists → lock profit & rotate.
    if (h.target != null && price >= h.target && strongestNonHeld && strongestNonHeld.score > (t?.score ?? 0) + 0.1) {
      sellHolding(h, price, `Target +${pnlPct.toFixed(1)}% reached — rotating into ${strongestNonHeld.symbol} (stronger signal)`);
      continue;
    }
    survivors.push(h);
  }
  state.holdings = survivors;

  // ── Rotation: drop holdings outside the top-5 target if a replacement exists ──
  const afterRotation: BotHolding[] = [];
  for (const h of state.holdings) {
    if (targetSet.has(h.symbol)) { afterRotation.push(h); continue; }
    const t = theses.get(h.symbol);
    const price = t?.price ?? h.avgBuyPrice;
    const replacement = target.find(x => !heldSymbols.has(x.symbol) && !state.holdings.some(o => o.symbol === x.symbol));
    if (replacement) {
      sellHolding(h, price, `Rotated out for ${replacement.symbol} (stronger conviction)`);
    } else {
      afterRotation.push(h); // keep — nothing better to rotate into
    }
  }
  state.holdings = afterRotation;

  // ── Buy new picks, sized by fixed-fractional risk + fair-share budgeting ──
  let equity = state.cash + state.holdings.reduce((s, h) => {
    const p = theses.get(h.symbol)?.price ?? h.avgBuyPrice; return s + h.quantity * p;
  }, 0);
  const toBuy = target.filter(t => !state.holdings.some(h => h.symbol === t.symbol));
  let slotsLeft = Math.min(toBuy.length, MAX_POSITIONS - state.holdings.length);
  for (const t of toBuy) {
    if (state.holdings.length >= MAX_POSITIONS || slotsLeft <= 0) break;
    // Fair-share cap: never let one pick spend more than its even slice of the
    // remaining cash, so all target names get filled instead of the first few
    // eating everything. Conviction still tilts via the risk cap (looser stops
    // get less) and the post-buy reinvestment into the strongest name.
    const fairShareQty = Math.floor((state.cash / slotsLeft) / t.entry);
    const riskQty = sizeByRisk(equity, state.cash, t.entry, t.stop, LT_RISK_PER_TRADE, LT_MAX_POSITION_PCT);
    const qty = Math.min(riskQty, fairShareQty);
    slotsLeft--;
    if (qty <= 0) continue;
    const cost = qty * t.entry;
    state.cash -= cost;
    state.holdings.push({
      symbol: t.symbol, quantity: qty, avgBuyPrice: t.entry, buyDate: date,
      stop: t.stop, target: t.target, thesisScore: t.score,
    });
    tradesToday.push({
      date, timestamp: new Date().toISOString(), symbol: t.symbol, action: "BUY",
      quantity: qty, price: t.entry, total: cost,
      reason: `${t.buyCount} BUY strategies · ${t.rationale}`,
    });
  }

  // ── Reinvest idle cash into the strongest holding (compounding) ──
  if (state.cash > equity * LT_CASH_REDEPLOY_RATIO && state.holdings.length > 0) {
    const ranked = state.holdings
      .map(h => ({ h, t: theses.get(h.symbol) }))
      .filter(x => x.t && x.t.price > 0)
      .sort((a, b) => (b.t!.score - a.t!.score));
    const top = ranked[0];
    if (top?.t) {
      const extra = Math.floor(state.cash / top.t.price);
      if (extra > 0) {
        const cost = extra * top.t.price;
        const newQty = top.h.quantity + extra;
        top.h.avgBuyPrice = (top.h.quantity * top.h.avgBuyPrice + cost) / newQty;
        top.h.quantity = newQty;
        state.cash -= cost;
        tradesToday.push({
          date, timestamp: new Date().toISOString(), symbol: top.h.symbol, action: "BUY",
          quantity: extra, price: top.t.price, total: cost,
          reason: `Reinvesting profits into strongest holding (score ${top.t.score.toFixed(2)})`,
        });
      }
    }
  }

  const snapshot = snapshotState(state, date, (sym) => theses.get(sym)?.price, tradesToday.length);
  state.trades.push(...tradesToday);
  state.lastRunDate = date;

  return {
    kind: state.kind, market, ran: true,
    evaluatedHoldings: heldEvalsCount, evaluatedCandidates: universeEvalsCount,
    trades: tradesToday, snapshot, state,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTRADAY bot
//
// Simulates a full trading day on 15-minute bars and takes MULTIPLE round trips:
// it walks the session bar by bar, exiting open positions on stop/target, and at
// regular decision points (~every 45 min after the first hour) it re-scans the
// universe and redeploys any freed-up capital into fresh high-conviction setups.
// Anything still open is squared off at the close. Always flat overnight; realized
// P&L compounds the equity.
// ─────────────────────────────────────────────────────────────────────────────
function groupByDay(candles: OHLCV[]): { date: string; idx: number[] }[] {
  const map = new Map<string, number[]>();
  candles.forEach((c, i) => {
    const d = isoDate(c.date);
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(i);
  });
  return [...map.entries()].map(([date, idx]) => ({ date, idx })).sort((a, b) => a.date.localeCompare(b.date));
}

interface SymBars {
  symbol: string;
  candles: OHLCV[];
  sessionIdx: number[]; // global indices of this symbol's bars in the target session
}

interface OpenPosition {
  symbol: string;
  qty: number;
  entry: number;
  stop: number;
  target: number;
  rationale: string;
}

async function runIntradayBotDay(state: BotState): Promise<BotRunSummary> {
  const market = state.market;
  const cfg = getMarketConfig(market);

  // Fetch intraday candles for the whole universe, grouped into trading days.
  const fetched: { symbol: string; candles: OHLCV[]; days: { date: string; idx: number[] }[] }[] = [];
  const symbols = cfg.botUniverse;
  for (let i = 0; i < symbols.length; i += SCAN_BATCH) {
    const batch = symbols.slice(i, i + SCAN_BATCH);
    const results = await Promise.allSettled(batch.map(async (sym) => {
      const candles = await getIntradayData(sym, market, "15m", 7);
      if (candles.length < INTRADAY_PROFILE.minBars + ID_FIRST_DECISION) return null;
      const days = groupByDay(candles);
      if (days.length < 2) return null;
      return { symbol: sym, candles, days };
    }));
    for (const r of results) if (r.status === "fulfilled" && r.value) fetched.push(r.value);
  }

  // Target session = the most recent date seen across the universe.
  let sessionDate = "";
  for (const f of fetched) {
    const last = f.days[f.days.length - 1].date;
    if (last > sessionDate) sessionDate = last;
  }

  // Keep symbols that have a usable number of bars in that session.
  const symBars: SymBars[] = [];
  for (const f of fetched) {
    const session = f.days.find(d => d.date === sessionDate);
    if (!session || session.idx.length < ID_FIRST_DECISION + 2) continue;
    symBars.push({ symbol: f.symbol, candles: f.candles, sessionIdx: session.idx });
  }

  if (symBars.length === 0 || !sessionDate) {
    return {
      kind: state.kind, market, ran: false, reason: "no intraday data available",
      evaluatedHoldings: 0, evaluatedCandidates: 0,
      trades: [], snapshot: state.snapshots[state.snapshots.length - 1] ?? null, state,
    };
  }

  // Idempotent on the simulated session date.
  if (state.lastRunDate === sessionDate) {
    return {
      kind: state.kind, market, ran: false, reason: "already traded this session",
      evaluatedHoldings: 0, evaluatedCandidates: 0,
      trades: [], snapshot: state.snapshots[state.snapshots.length - 1] ?? null, state,
    };
  }

  const bySymbol = new Map<string, SymBars>(symBars.map(s => [s.symbol, s]));
  const maxLen = symBars.reduce((m, s) => Math.max(m, s.sessionIdx.length), 0);

  // Thesis cache keyed by symbol@offset (computed lazily at decision points).
  const thesisCache = new Map<string, Thesis | null>();
  const analyzeAt = (sb: SymBars, offset: number): Thesis | null => {
    if (offset >= sb.sessionIdx.length) return null;
    const key = `${sb.symbol}@${offset}`;
    const hit = thesisCache.get(key);
    if (hit !== undefined) return hit;
    const gi = sb.sessionIdx[offset];
    const th = analyze(sb.symbol, sb.candles.slice(0, gi + 1), INTRADAY_PROFILE);
    thesisCache.set(key, th);
    return th;
  };

  const tradesToday: BotTrade[] = [];
  const ts = () => new Date().toISOString();
  let cash = state.cash;             // start of day, all cash (flat overnight)
  const startEquity = cash;          // base for fixed-fractional risk sizing
  let realizedToday = 0;
  const open: OpenPosition[] = [];

  const closePosition = (pos: OpenPosition, exitPrice: number, reason: string) => {
    const proceeds = pos.qty * exitPrice;
    const realized = (exitPrice - pos.entry) * pos.qty;
    cash += proceeds;
    realizedToday += realized;
    tradesToday.push({
      date: sessionDate, timestamp: ts(), symbol: pos.symbol, action: "SELL",
      quantity: pos.qty, price: round(exitPrice), total: round(proceeds), realizedPnL: round(realized),
      reason,
    });
  };

  // Walk the session bar by bar.
  for (let o = ID_FIRST_DECISION; o < maxLen; o++) {
    // 1. Exits first — check every open position against this bar.
    for (let k = open.length - 1; k >= 0; k--) {
      const pos = open[k];
      const sb = bySymbol.get(pos.symbol)!;
      if (o >= sb.sessionIdx.length) continue; // no bar at this offset; squared off later
      const bar = sb.candles[sb.sessionIdx[o]];
      if (bar.low <= pos.stop) {
        closePosition(pos, pos.stop, `Intraday stop hit (−${(((pos.entry - pos.stop) / pos.entry) * 100).toFixed(1)}%)`);
        open.splice(k, 1);
      } else if (bar.high >= pos.target) {
        closePosition(pos, pos.target, `Intraday target hit (+${(((pos.target - pos.entry) / pos.entry) * 100).toFixed(1)}%)`);
        open.splice(k, 1);
      }
    }

    // 2. Entries at decision points, while slots and cash remain, but not too
    //    close to the bell (no time for a trade to work).
    const isDecision = (o - ID_FIRST_DECISION) % ID_DECISION_STEP === 0 && o <= maxLen - 1 - ID_CLOSE_BUFFER;
    let slotsFree = MAX_POSITIONS - open.length;
    if (isDecision && slotsFree > 0 && cash > 0) {
      const held = new Set(open.map(p => p.symbol));
      const cands: Thesis[] = [];
      for (const sb of symBars) {
        if (held.has(sb.symbol) || o >= sb.sessionIdx.length) continue;
        const th = analyzeAt(sb, o);
        if (th && th.direction === "LONG" && th.score >= ID_MIN_SCORE) cands.push(th);
      }
      cands.sort((a, b) => (b.score * (0.5 + b.conviction)) - (a.score * (0.5 + a.conviction)));
      const picks = cands.slice(0, slotsFree);
      for (const t of picks) {
        if (slotsFree <= 0 || cash <= 0) break;
        const fairShareQty = Math.floor((cash / Math.max(1, slotsFree)) / t.entry);
        const riskQty = sizeByRisk(startEquity, cash, t.entry, t.stop, ID_RISK_PER_TRADE, ID_MAX_POSITION_PCT);
        const qty = Math.min(riskQty, fairShareQty);
        if (qty <= 0) continue;
        const cost = qty * t.entry;
        cash -= cost;
        slotsFree--;
        open.push({ symbol: t.symbol, qty, entry: t.entry, stop: t.stop, target: t.target, rationale: t.rationale });
        tradesToday.push({
          date: sessionDate, timestamp: ts(), symbol: t.symbol, action: "BUY",
          quantity: qty, price: round(t.entry), total: round(cost),
          reason: `Intraday long · ${t.rationale}`,
        });
      }
    }
  }

  // 3. Square off anything still open at its last session bar's close.
  for (const pos of open) {
    const sb = bySymbol.get(pos.symbol)!;
    const lastGi = sb.sessionIdx[sb.sessionIdx.length - 1];
    closePosition(pos, sb.candles[lastGi].close, "Squared off at session close");
  }

  state.cash = cash;                 // back to all-cash; profits compounded
  state.realizedPnL += realizedToday;
  state.holdings = [];               // flat overnight

  const equityNow = state.cash;
  const pnl = equityNow - state.startingCapital;
  const snapshot: BotSnapshot = {
    date: sessionDate,
    cash: round(state.cash),
    holdingsValue: 0,
    equity: round(equityNow),
    pnl: round(pnl),
    pnlPercent: round((pnl / state.startingCapital) * 100, 3),
    positions: 0,
    tradesCount: tradesToday.length,
  };
  const existing = state.snapshots.findIndex(s => s.date === sessionDate);
  if (existing >= 0) state.snapshots[existing] = snapshot; else state.snapshots.push(snapshot);

  state.trades.push(...tradesToday);
  state.lastRunDate = sessionDate;

  return {
    kind: state.kind, market, ran: true,
    evaluatedHoldings: 0, evaluatedCandidates: symBars.length,
    trades: tradesToday, snapshot, state,
  };
}

// Mark-to-market snapshot for position-holding bots.
function snapshotState(
  state: BotState, date: string, priceOf: (sym: string) => number | undefined, tradesCount: number
): BotSnapshot {
  let holdingsValue = 0;
  for (const h of state.holdings) holdingsValue += h.quantity * (priceOf(h.symbol) ?? h.avgBuyPrice);
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
    tradesCount,
  };
  const existing = state.snapshots.findIndex(s => s.date === date);
  if (existing >= 0) state.snapshots[existing] = snapshot; else state.snapshots.push(snapshot);
  return snapshot;
}
