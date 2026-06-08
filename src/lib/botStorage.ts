import { promises as fs } from "fs";
import path from "path";
import type { Market } from "./markets";

// Filesystem-backed storage. Behind a single interface so swapping to Vercel KV,
// Upstash, Supabase, etc. for cloud deployment is a one-file change.
//
// There are now two bots per market — an intraday trader and a long-term
// investor — keyed by `kind`. Each gets its own state file:
//   data/bot-state-{market}-{kind}.json   e.g. bot-state-in-intraday.json

export type BotKind = "intraday" | "longterm";

export interface BotHolding {
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate: string; // ISO
  stop?: number;       // risk-plan stop price
  target?: number;     // risk-plan target price
  thesisScore?: number; // composite brain score at entry
}

export interface BotTrade {
  date: string;          // YYYY-MM-DD
  timestamp: string;     // ISO
  symbol: string;
  action: "BUY" | "SELL";
  quantity: number;
  price: number;
  total: number;
  reason: string;
  realizedPnL?: number;  // populated on SELL
}

export interface BotSnapshot {
  date: string;          // YYYY-MM-DD
  cash: number;
  holdingsValue: number;
  equity: number;
  pnl: number;           // equity - startingCapital
  pnlPercent: number;
  positions: number;
  tradesCount: number;   // trades executed on this day
}

export interface BotState {
  kind: BotKind;
  market: Market;
  startingCapital: number;
  cash: number;
  holdings: BotHolding[];
  trades: BotTrade[];
  snapshots: BotSnapshot[];
  lastRunDate: string | null; // YYYY-MM-DD
  realizedPnL: number;
  createdAt: string;
}

const DATA_DIR = process.env.BOT_STATE_DIR || path.join(process.cwd(), "data");

function statePath(market: Market, kind: BotKind): string {
  return path.join(DATA_DIR, `bot-state-${market.toLowerCase()}-${kind}.json`);
}

// Legacy single-bot path (pre two-bot split). Used to migrate old long-term state.
function legacyPath(market: Market): string {
  return path.join(DATA_DIR, `bot-state-${market.toLowerCase()}.json`);
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
}

export function freshState(market: Market, kind: BotKind, startingCapital: number): BotState {
  return {
    kind,
    market,
    startingCapital,
    cash: startingCapital,
    holdings: [],
    trades: [],
    snapshots: [],
    lastRunDate: null,
    realizedPnL: 0,
    createdAt: new Date().toISOString(),
  };
}

function backfill(parsed: BotState, market: Market, kind: BotKind, startingCapital: number): BotState {
  if (!parsed.kind) parsed.kind = kind;
  parsed.market = market;
  if (!parsed.startingCapital) parsed.startingCapital = startingCapital;
  if (!parsed.snapshots) parsed.snapshots = [];
  if (!parsed.trades) parsed.trades = [];
  if (!parsed.holdings) parsed.holdings = [];
  if (parsed.realizedPnL == null) parsed.realizedPnL = 0;
  return parsed;
}

export async function loadBotState(market: Market, kind: BotKind, startingCapital: number): Promise<BotState> {
  try {
    const raw = await fs.readFile(statePath(market, kind), "utf-8");
    return backfill(JSON.parse(raw) as BotState, market, kind, startingCapital);
  } catch {
    // For the long-term bot, fall back to the pre-split legacy file if present.
    if (kind === "longterm") {
      try {
        const raw = await fs.readFile(legacyPath(market), "utf-8");
        return backfill(JSON.parse(raw) as BotState, market, "longterm", startingCapital);
      } catch { /* none */ }
    }
    return freshState(market, kind, startingCapital);
  }
}

export async function saveBotState(state: BotState): Promise<void> {
  await ensureDir();
  await fs.writeFile(statePath(state.market, state.kind), JSON.stringify(state, null, 2), "utf-8");
}

export async function resetBotState(market: Market, kind: BotKind, startingCapital: number): Promise<BotState> {
  const next = freshState(market, kind, startingCapital);
  await saveBotState(next);
  return next;
}
