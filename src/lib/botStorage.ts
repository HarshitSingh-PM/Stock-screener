import { promises as fs } from "fs";
import path from "path";
import type { Market } from "./markets";

// Filesystem-backed storage. Behind a single interface so swapping to Vercel KV,
// Upstash, Supabase, etc. for cloud deployment is a one-file change.
//
// To migrate: replace readJson/writeJson with calls into your KV/DB client,
// keying on `bot-state-${market}`. The rest of the bot code uses load()/save() only.

export interface BotHolding {
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate: string; // ISO
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

function statePath(market: Market): string {
  return path.join(DATA_DIR, `bot-state-${market.toLowerCase()}.json`);
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
}

export function freshState(market: Market, startingCapital: number): BotState {
  return {
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

export async function loadBotState(market: Market, startingCapital: number): Promise<BotState> {
  try {
    const raw = await fs.readFile(statePath(market), "utf-8");
    const parsed = JSON.parse(raw) as BotState;
    // Forward-compat: backfill new fields if older state file existed.
    if (!parsed.snapshots) parsed.snapshots = [];
    if (!parsed.trades) parsed.trades = [];
    if (!parsed.holdings) parsed.holdings = [];
    if (parsed.realizedPnL == null) parsed.realizedPnL = 0;
    return parsed;
  } catch {
    return freshState(market, startingCapital);
  }
}

export async function saveBotState(state: BotState): Promise<void> {
  await ensureDir();
  await fs.writeFile(statePath(state.market), JSON.stringify(state, null, 2), "utf-8");
}

export async function resetBotState(market: Market, startingCapital: number): Promise<BotState> {
  const next = freshState(market, startingCapital);
  await saveBotState(next);
  return next;
}
