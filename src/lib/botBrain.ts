import { OHLCV, ema, sma, atr, adx, bollingerBands } from "./indicators";
import { STRATEGIES } from "./strategies";

// ─────────────────────────────────────────────────────────────────────────────
// Bot "brain": a single composite analysis per symbol, fusing three ideas from
// the open-source research repos studied:
//
//   • ai-hedge-fund "technicals agent": a weighted blend of trend / momentum /
//     mean-reversion / volatility / stat-arb factors, each a −1..+1 sub-signal,
//     combined into one directional score and conviction.
//   • AutoHedge "quant schema": every dimension expressed as a normalized 0–1
//     score (technical / volume / trend / probability) plus key price levels.
//   • A "thesis" object (direction, entry, stop, target, key levels) so every
//     trade the bot makes is auditable.
//
// It also folds in the 111-strategy confluence the screener already computes, so
// the brain agrees with what users see on the site.
// ─────────────────────────────────────────────────────────────────────────────

export interface Thesis {
  symbol: string;
  price: number;

  // Strategy confluence (same numbers the screener shows users)
  buyCount: number;
  sellCount: number;
  avgBuyStrength: number;

  // Composite multi-factor verdict
  score: number;        // −1 (max bearish) .. +1 (max bullish)
  conviction: number;   // 0..1 how strong/clean the setup is
  direction: "LONG" | "SHORT" | "FLAT";

  // AutoHedge-style normalized sub-scores (0..1)
  technicalScore: number;
  momentumScore: number;
  trendStrength: number;
  meanReversionScore: number;
  volumeScore: number;
  volatility: number;       // ATR as % of price
  probabilityScore: number; // estimated win probability 0..1

  // Key levels + risk plan
  atr: number;
  support: number;
  resistance: number;
  pivot: number;
  entry: number;
  stop: number;
  target: number;
  riskReward: number;

  rationale: string;
}

export interface BrainProfile {
  kind: "intraday" | "longterm";
  momWindows: [number, number, number];
  stopAtrMult: number;
  targetAtrMult: number;
  minBars: number;
}

export const LONGTERM_PROFILE: BrainProfile = {
  kind: "longterm",
  momWindows: [21, 63, 126],
  stopAtrMult: 2.0,
  targetAtrMult: 3.0,
  minBars: 60,
};

export const INTRADAY_PROFILE: BrainProfile = {
  kind: "intraday",
  momWindows: [4, 12, 26], // ~1h / 3h / full-day on 15m bars
  stopAtrMult: 1.2,
  targetAtrMult: 2.0,
  minBars: 30,
};

function stdev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1));
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Run the 111 screener strategies for confluence.
function confluence(candles: OHLCV[]) {
  let buyCount = 0, sellCount = 0, buyStrength = 0;
  for (const s of STRATEGIES) {
    try {
      const r = s.evaluate(candles);
      if (r.signal === "BUY") { buyCount++; buyStrength += r.strength; }
      else if (r.signal === "SELL") sellCount++;
    } catch { /* ignore individual strategy errors */ }
  }
  return { buyCount, sellCount, avgBuyStrength: buyCount > 0 ? buyStrength / buyCount : 0 };
}

// The five ai-hedge-fund technical factors, each returning a −1..+1 signal.
function trendFactor(closes: number[], highs: number[], lows: number[]): number {
  const last = closes.length - 1;
  const e8 = ema(closes, 8)[last], e21 = ema(closes, 21)[last], e55 = ema(closes, 55)[last];
  const { adx: adxVals } = adx(highs, lows, closes, 14);
  const adxVal = adxVals[last] ?? 0;
  if (e8 == null || e21 == null || e55 == null) return 0;
  const strength = clamp(adxVal / 50, 0, 1);
  if (e8 > e21 && e21 > e55) return strength;
  if (e8 < e21 && e21 < e55) return -strength;
  // partial alignment
  if (e8 > e21) return strength * 0.4;
  if (e8 < e21) return -strength * 0.4;
  return 0;
}

function momentumFactor(closes: number[], windows: [number, number, number]): number {
  const last = closes.length - 1;
  const [a, b, c] = windows;
  if (last < c) return 0;
  const ret = (n: number) => (closes[last] - closes[last - n]) / closes[last - n];
  const mom = 0.4 * ret(a) + 0.3 * ret(b) + 0.3 * ret(c);
  return clamp(mom * 5, -1, 1);
}

function meanReversionFactor(closes: number[]): number {
  const last = closes.length - 1;
  if (last < 50) return 0;
  const window = closes.slice(last - 49, last + 1);
  const mean = window.reduce((s, v) => s + v, 0) / window.length;
  const sd = stdev(window);
  if (sd <= 0) return 0;
  const z = (closes[last] - mean) / sd;
  const { upper, lower } = bollingerBands(closes, 20, 2);
  const u = upper[last], l = lower[last];
  const pctB = (u != null && l != null && u > l) ? (closes[last] - l) / (u - l) : 0.5;
  // oversold → bullish reversion; overbought → bearish
  if (z < -1.5 && pctB < 0.25) return clamp(-z / 3, 0, 1);
  if (z > 1.5 && pctB > 0.75) return clamp(-z / 3, -1, 0);
  return clamp(-z / 6, -0.4, 0.4);
}

function volatilityFactor(closes: number[]): number {
  const last = closes.length - 1;
  if (last < 70) return 0;
  const rets: number[] = [];
  for (let i = 1; i <= last; i++) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  const hv = (end: number) => stdev(rets.slice(Math.max(0, end - 21), end)) * Math.sqrt(252);
  const cur = hv(rets.length);
  const series: number[] = [];
  for (let i = rets.length; i > rets.length - 63 && i > 21; i--) series.push(hv(i));
  const avg = series.reduce((s, v) => s + v, 0) / series.length;
  if (avg <= 0) return 0;
  const regime = cur / avg;
  // calm regime is mildly supportive of longs; turbulent regime is a headwind
  if (regime < 0.85) return 0.4;
  if (regime > 1.3) return -0.5;
  return 0;
}

function volumeScoreOf(candles: OHLCV[]): number {
  const last = candles.length - 1;
  const vols = candles.map(c => c.volume);
  const volMA = sma(vols, 21)[last];
  if (volMA == null || volMA <= 0) return 0.5;
  return clamp(vols[last] / volMA / 2, 0, 1); // 1.0× avg → 0.5, 2×+ → 1.0
}

export function analyze(symbol: string, candles: OHLCV[], profile: BrainProfile): Thesis | null {
  if (candles.length < profile.minBars) return null;
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const last = closes.length - 1;
  const price = closes[last];
  if (!(price > 0)) return null;

  const conf = confluence(candles);

  // Factor signals (−1..+1), weighted per the ai-hedge-fund technicals agent.
  const fTrend = trendFactor(closes, highs, lows);
  const fMom = momentumFactor(closes, profile.momWindows);
  const fRev = meanReversionFactor(closes);
  const fVol = volatilityFactor(closes);
  const W = { trend: 0.30, mom: 0.30, rev: 0.20, vol: 0.20 };
  const factorScore =
    fTrend * W.trend + fMom * W.mom + fRev * W.rev + fVol * W.vol;

  // Blend the factor model with the 111-strategy confluence so the brain and
  // the public screener stay consistent. Confluence in −1..+1 form:
  const confTotal = conf.buyCount + conf.sellCount;
  const confSignal = confTotal > 0 ? (conf.buyCount - conf.sellCount) / confTotal : 0;
  const score = clamp(0.55 * factorScore + 0.45 * confSignal, -1, 1);

  const atrArr = atr(highs, lows, closes, 14);
  const atrVal = atrArr[last] ?? price * 0.02;
  const volatilityPct = atrVal / price;

  // Key levels
  const lookback = Math.min(20, last);
  const support = Math.min(...lows.slice(last - lookback, last + 1));
  const resistance = Math.max(...highs.slice(last - lookback, last + 1));
  const pivot = (highs[last] + lows[last] + closes[last]) / 3;

  const direction: Thesis["direction"] = score > 0.15 ? "LONG" : score < -0.15 ? "SHORT" : "FLAT";

  // Risk plan (long side; the bots only go long). ATR-based stop/target, but
  // never place the stop above structural support being lost by more than ATR.
  const entry = price;
  const stop = Math.max(entry - profile.stopAtrMult * atrVal, entry * (1 - 0.5));
  const target = entry + profile.targetAtrMult * atrVal;
  const riskReward = entry - stop > 0 ? (target - entry) / (entry - stop) : 0;

  // Normalized 0..1 sub-scores (AutoHedge vocabulary)
  const technicalScore = clamp((confSignal + 1) / 2, 0, 1);
  const momentumScore = clamp((fMom + 1) / 2, 0, 1);
  const trendStrength = clamp((fTrend + 1) / 2, 0, 1);
  const meanReversionScore = clamp((fRev + 1) / 2, 0, 1);
  const volumeScore = volumeScoreOf(candles);
  // Probability of a winning long: squashed score, lifted by volume confirmation.
  const probabilityScore = clamp(0.5 + 0.4 * score + 0.1 * (volumeScore - 0.5) * 2, 0, 1);
  const conviction = clamp(Math.abs(score) * (0.6 + 0.4 * volumeScore), 0, 1);

  const rationale =
    `${direction} · score ${score.toFixed(2)} · ${conf.buyCount} BUY/${conf.sellCount} SELL strategies · ` +
    `trend ${(trendStrength * 100).toFixed(0)} / mom ${(momentumScore * 100).toFixed(0)} / ` +
    `rev ${(meanReversionScore * 100).toFixed(0)} / vol ${(volumeScore * 100).toFixed(0)} · ` +
    `win-prob ${(probabilityScore * 100).toFixed(0)}% · R:R ${riskReward.toFixed(1)}`;

  return {
    symbol, price,
    buyCount: conf.buyCount, sellCount: conf.sellCount, avgBuyStrength: conf.avgBuyStrength,
    score, conviction, direction,
    technicalScore, momentumScore, trendStrength, meanReversionScore, volumeScore,
    volatility: volatilityPct, probabilityScore,
    atr: atrVal, support, resistance, pivot,
    entry, stop, target, riskReward,
    rationale,
  };
}
