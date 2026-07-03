import fs from "fs";
import path from "path";
import { getHistoricalData } from "./stockData";
import type { Market } from "./markets";
import type { RecommendationSet } from "./recommend";

// ─────────────────────────────────────────────────────────────────────────────
// The public track record. Every pick published by the daily full-universe
// run is logged here the day it appears, then resolved against real prices
// with the SAME rules the 5-year backtest used: fill at the next session's
// open, exit at target or stop (gap-aware, both-hit-same-day = loss), or
// time-exit after the horizon. No retroactive edits — the ledger only ever
// appends and resolves.
// ─────────────────────────────────────────────────────────────────────────────

const DATA_DIR = process.env.BOT_STATE_DIR || path.join(process.cwd(), "data");
const HORIZON_TRADING_DAYS = 21; // long-term profile hold, same as the picks' trade plan
const MIN_SCANNED_TO_RECORD = 400; // only full-universe runs publish to the record

export type PickStatus = "open" | "target" | "stop" | "expired_win" | "expired_loss" | "void";

export interface LedgerEntry {
  id: string;            // date-market-symbol
  date: string;          // YYYY-MM-DD the pick was published
  market: Market;
  symbol: string;
  name: string;
  priceAtPick: number;
  entry: number;         // stated entry from the pick card
  target: number;
  stop: number;
  estWinRate: number;
  buyCount: number;
  comboId?: string;      // set when the pick was published as a mined-group signal
  comboWinRate?: number; // that group's 5y backtested win rate
  status: PickStatus;
  fillPrice?: number;    // actual next-session open
  fillDate?: string;
  exitPrice?: number;
  exitDate?: string;
  pnlPercent?: number;   // realized (resolved) — from fill, not stated entry
  lastPrice?: number;    // latest close while open
  unrealizedPnl?: number;
  daysHeld?: number;     // trading days since fill
}

export interface Ledger {
  market: Market;
  startedOn: string;
  lastResolvedAt: string | null;
  entries: LedgerEntry[];
}

function ledgerFile(market: Market): string {
  return path.join(DATA_DIR, `picks-ledger-${market.toLowerCase()}.json`);
}

export function readLedger(market: Market): Ledger {
  try {
    const raw = JSON.parse(fs.readFileSync(ledgerFile(market), "utf8"));
    if (raw && Array.isArray(raw.entries)) return raw as Ledger;
  } catch { /* fresh ledger below */ }
  return { market, startedOn: new Date().toISOString().slice(0, 10), lastResolvedAt: null, entries: [] };
}

function writeLedger(ledger: Ledger) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ledgerFile(ledger.market), JSON.stringify(ledger));
}

/** Append today's published picks + combo signals. Open symbols aren't re-added. */
export function recordPicks(set: RecommendationSet) {
  if (set.scanned < MIN_SCANNED_TO_RECORD) return;
  const published = [...set.picks, ...(set.comboHits ?? [])];
  if (published.length === 0) return;
  const ledger = readLedger(set.market);
  const openSymbols = new Set(ledger.entries.filter((e) => e.status === "open").map((e) => e.symbol));
  const seen = new Set<string>();
  let added = 0;
  for (const p of published) {
    if (openSymbols.has(p.symbol) || seen.has(p.symbol)) continue;
    seen.add(p.symbol);
    const id = `${set.date}-${set.market}-${p.symbol}`;
    if (ledger.entries.some((e) => e.id === id)) continue;
    const combo = p.combos?.[0];
    ledger.entries.push({
      id, date: set.date, market: set.market, symbol: p.symbol, name: p.name,
      priceAtPick: p.price, entry: p.entry, target: p.target, stop: p.stop,
      estWinRate: p.estWinRate, buyCount: p.buyCount,
      ...(combo ? { comboId: combo.id, comboWinRate: combo.winRate } : {}),
      status: "open",
    });
    added++;
  }
  if (added > 0) writeLedger(ledger);
}

/**
 * Resolve open entries against real daily candles.
 * Fill at the first session open AFTER the pick date; then walk each bar:
 * gap through stop/target exits at the open, both-hit-same-day counts as a
 * stop-out (conservative), otherwise time-exit at the horizon close.
 */
export async function resolveLedger(market: Market): Promise<Ledger> {
  const ledger = readLedger(market);
  const open = ledger.entries.filter((e) => e.status === "open");
  if (open.length === 0) {
    ledger.lastResolvedAt = new Date().toISOString();
    writeLedger(ledger);
    return ledger;
  }

  const batchSize = 6;
  for (let i = 0; i < open.length; i += batchSize) {
    const batch = open.slice(i, i + batchSize);
    await Promise.all(batch.map(async (e) => {
      try {
        const candles = await getHistoricalData(e.symbol, 120, market);
        const bars = candles.filter((c) => c.date.toISOString().slice(0, 10) > e.date);
        if (bars.length === 0) return; // published after today's close; fills next session

        if (!e.fillPrice) {
          e.fillPrice = bars[0].open;
          e.fillDate = bars[0].date.toISOString().slice(0, 10);
        }
        const fill = e.fillPrice;
        // A fill at/below the stop or at/above the target means the setup was
        // gone before entry (overnight gap or bad data) — the trade never
        // existed. Voided entries don't count for or against the record.
        if (fill <= e.stop || fill >= e.target) {
          e.status = "void";
          return;
        }
        const pct = (px: number) => +(((px - fill) / fill) * 100).toFixed(2);

        for (let d = 0; d < bars.length; d++) {
          const b = bars[d];
          const dateStr = b.date.toISOString().slice(0, 10);
          const settle = (px: number, status: PickStatus) => {
            e.exitPrice = +px.toFixed(2); e.exitDate = dateStr;
            e.pnlPercent = pct(px); e.status = status; e.daysHeld = d + 1;
          };
          // Gap-open exits only apply after the fill bar — on day 0 the open
          // IS the fill, so only intraday moves from there can exit.
          if (d > 0 && b.open <= e.stop) { settle(b.open, "stop"); break; }
          if (d > 0 && b.open >= e.target) { settle(b.open, "target"); break; }
          if (b.low <= e.stop) { settle(e.stop, "stop"); break; } // both-hit → loss
          if (b.high >= e.target) { settle(e.target, "target"); break; }
          if (d + 1 >= HORIZON_TRADING_DAYS) {
            settle(b.close, pct(b.close) > 0 ? "expired_win" : "expired_loss");
            break;
          }
        }
        if (e.status === "open") {
          const last = bars[bars.length - 1];
          e.lastPrice = +last.close.toFixed(2);
          e.unrealizedPnl = pct(last.close);
          e.daysHeld = bars.length;
        }
      } catch { /* leave open; next resolve retries */ }
    }));
  }

  ledger.lastResolvedAt = new Date().toISOString();
  writeLedger(ledger);
  return ledger;
}

export interface ScoreboardStats {
  resolved: number;
  wins: number;
  winRate: number;        // % of resolved picks that made money
  targetHits: number;
  stopOuts: number;
  expired: number;
  avgReturn: number;      // avg realized % per resolved pick
  totalReturn: number;
  openCount: number;
  trackingSince: string;
}

export function computeStats(ledger: Ledger): ScoreboardStats {
  const resolved = ledger.entries.filter((e) => e.status !== "open" && e.status !== "void");
  const wins = resolved.filter((e) => e.status === "target" || e.status === "expired_win");
  const sum = resolved.reduce((s, e) => s + (e.pnlPercent ?? 0), 0);
  return {
    resolved: resolved.length,
    wins: wins.length,
    winRate: resolved.length ? +((wins.length / resolved.length) * 100).toFixed(1) : 0,
    targetHits: resolved.filter((e) => e.status === "target").length,
    stopOuts: resolved.filter((e) => e.status === "stop").length,
    expired: resolved.filter((e) => e.status.startsWith("expired")).length,
    avgReturn: resolved.length ? +(sum / resolved.length).toFixed(2) : 0,
    totalReturn: +sum.toFixed(2),
    openCount: ledger.entries.filter((e) => e.status === "open").length,
    trackingSince: ledger.startedOn,
  };
}
