import { sma, rsi, macd } from "./indicators";

// ─────────────────────────────────────────────────────────────────────────────
// ETF call scoring, extracted from the API route so the backtest
// (scripts/backtestEtfCalls.ts) replays the exact production logic.
// Components return integer votes; the composite maps to a call.
// ─────────────────────────────────────────────────────────────────────────────

export type EtfRecommendation = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";

export interface EtfComponents {
  trendScore: number;      // ±2
  momentumScore: number;   // ±2 (RSI)
  macdScore: number;       // ±1
  confluenceScore: number; // ±2 (verified-strategy buy/sell ratio)
}

export function etfComponents(closes: number[], buyCount: number, sellCount: number, total: number): { comp: EtfComponents; rationale: string[] } {
  const rationale: string[] = [];
  const last = closes.length - 1;
  const price = closes[last];

  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const ma50 = sma50[last];
  const ma200 = sma200[last];
  let trendScore = 0;
  if (ma50 != null && ma200 != null) {
    if (price > ma50 && ma50 > ma200) { trendScore = 2; rationale.push("Price above 50 & 200 SMA, uptrend intact"); }
    else if (price < ma50 && ma50 < ma200) { trendScore = -2; rationale.push("Price below 50 & 200 SMA, downtrend"); }
    else if (price > ma200) { trendScore = 1; rationale.push("Price above 200 SMA, long-term bullish"); }
    else { trendScore = -1; rationale.push("Price below 200 SMA, long-term bearish"); }
  }

  const r = rsi(closes, 14);
  const lastRsi = r[last];
  let momentumScore = 0;
  if (lastRsi != null) {
    if (lastRsi < 30) { momentumScore = 2; rationale.push(`RSI ${lastRsi.toFixed(0)} — oversold`); }
    else if (lastRsi > 70) { momentumScore = -2; rationale.push(`RSI ${lastRsi.toFixed(0)} — overbought`); }
    else if (lastRsi > 55) { momentumScore = 1; rationale.push(`RSI ${lastRsi.toFixed(0)} — bullish momentum`); }
    else if (lastRsi < 45) { momentumScore = -1; rationale.push(`RSI ${lastRsi.toFixed(0)} — bearish momentum`); }
  }

  const m = macd(closes);
  const lastMacd = m.macdLine[last];
  const lastSignal = m.signalLine[last];
  let macdScore = 0;
  if (lastMacd != null && lastSignal != null) {
    if (lastMacd > lastSignal && lastMacd > 0) { macdScore = 1; rationale.push("MACD above signal, above zero"); }
    else if (lastMacd < lastSignal && lastMacd < 0) { macdScore = -1; rationale.push("MACD below signal, below zero"); }
  }

  const buyRatio = total > 0 ? buyCount / total : 0;
  const sellRatio = total > 0 ? sellCount / total : 0;
  let confluenceScore = 0;
  if (buyRatio - sellRatio > 0.15) { confluenceScore = 2; rationale.push(`${buyCount}/${total} strategies bullish`); }
  else if (buyRatio - sellRatio > 0.05) { confluenceScore = 1; rationale.push(`${buyCount}/${total} strategies bullish`); }
  else if (sellRatio - buyRatio > 0.15) { confluenceScore = -2; rationale.push(`${sellCount}/${total} strategies bearish`); }
  else if (sellRatio - buyRatio > 0.05) { confluenceScore = -1; rationale.push(`${sellCount}/${total} strategies bearish`); }

  return { comp: { trendScore, momentumScore, macdScore, confluenceScore }, rationale };
}

export function compositeCall(comp: EtfComponents): { rec: EtfRecommendation; score: number } {
  const score = comp.trendScore + comp.momentumScore + comp.macdScore + comp.confluenceScore;
  let rec: EtfRecommendation;
  if (score >= 5) rec = "STRONG_BUY";
  else if (score >= 2) rec = "BUY";
  else if (score <= -5) rec = "STRONG_SELL";
  else if (score <= -2) rec = "SELL";
  else rec = "HOLD";
  return { rec, score };
}

// What the site serves. The 5-year backtest showed SELL-side calls grade
// 40-44% (worse than a coin flip — an anti-signal), so only the verified
// BUY side is published; everything else is HOLD.
export function verifiedCall(comp: EtfComponents): { rec: EtfRecommendation; score: number } {
  const { rec, score } = compositeCall(comp);
  return { rec: rec === "SELL" || rec === "STRONG_SELL" ? "HOLD" : rec, score };
}
