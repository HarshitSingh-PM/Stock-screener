import { sma, ema, rsi, macd, adx, bollingerBands, atr } from "./indicators";
import type { OHLCV } from "./indicators";

// ─────────────────────────────────────────────────────────────────────────────
// Next-day market-direction predictor for an index. Uses the same multi-factor
// vocabulary learned from the open-source quant repos (trend stack + ADX,
// multi-horizon momentum, RSI/MACD, mean-reversion z-score/Bollinger, volatility
// regime), each as a −1..+1 vote, blended into a probability the index closes UP
// tomorrow. Volatility scales confidence, not direction.
// ─────────────────────────────────────────────────────────────────────────────

export interface PredictionFactor {
  name: string;
  vote: number;       // −1 (bearish) .. +1 (bullish)
  weight: number;
  detail: string;
}

export interface MarketPrediction {
  direction: "UP" | "DOWN" | "NEUTRAL";
  probUp: number;       // 0..100 — probability the index closes higher tomorrow
  confidence: number;   // 0..100
  score: number;        // −1..+1 blended directional score
  factors: PredictionFactor[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function stdev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = arr.reduce((s, v) => s + v, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

export function predictNextDay(candles: OHLCV[]): MarketPrediction | null {
  if (candles.length < 60) return null;
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const last = closes.length - 1;
  const price = closes[last];

  const factors: PredictionFactor[] = [];
  const ret = (n: number) => (closes[last] - closes[last - n]) / closes[last - n];

  // 1. Trend stack — EMA 8/21/55 alignment + ADX strength.
  {
    const e8 = ema(closes, 8)[last], e21 = ema(closes, 21)[last], e55 = ema(closes, 55)[last];
    const adxVal = adx(highs, lows, closes, 14).adx[last] ?? 0;
    let vote = 0;
    if (e8 != null && e21 != null && e55 != null) {
      const strength = clamp(adxVal / 40, 0, 1);
      if (e8 > e21 && e21 > e55) vote = strength;
      else if (e8 < e21 && e21 < e55) vote = -strength;
      else vote = e8 > e21 ? strength * 0.3 : -strength * 0.3;
    }
    factors.push({ name: "Trend", vote, weight: 0.28, detail: `EMA stack ${vote >= 0 ? "bullish" : "bearish"}, ADX ${adxVal.toFixed(0)}` });
  }

  // 2. Momentum — blended 1/5/10-day return.
  {
    const mom = 0.5 * ret(1) + 0.3 * ret(5) + 0.2 * ret(10);
    const vote = clamp(mom * 25, -1, 1);
    factors.push({ name: "Momentum", vote, weight: 0.22, detail: `5-day ${(ret(5) * 100).toFixed(1)}%, 10-day ${(ret(10) * 100).toFixed(1)}%` });
  }

  // 3. RSI — momentum in the middle, mean-reversion at the extremes.
  {
    const r = rsi(closes, 14)[last];
    let vote = 0, detail = "RSI n/a";
    if (r != null) {
      if (r < 30) { vote = 0.7; detail = `RSI ${r.toFixed(0)} oversold — bounce likely`; }
      else if (r > 70) { vote = -0.7; detail = `RSI ${r.toFixed(0)} overbought — pullback likely`; }
      else { vote = clamp((r - 50) / 25, -1, 1); detail = `RSI ${r.toFixed(0)}`; }
    }
    factors.push({ name: "RSI", vote, weight: 0.15, detail });
  }

  // 4. MACD histogram + its slope.
  {
    const m = macd(closes);
    const h = m.histogram[last], hp = m.histogram[last - 1];
    let vote = 0, detail = "MACD flat";
    if (h != null && hp != null) {
      const rising = h > hp;
      vote = clamp(Math.sign(h) * 0.5 + (rising ? 0.3 : -0.3), -1, 1);
      detail = `Histogram ${h >= 0 ? "+" : ""}${h.toFixed(2)}, ${rising ? "rising" : "falling"}`;
    }
    factors.push({ name: "MACD", vote, weight: 0.13, detail });
  }

  // 5. Mean reversion — z-score vs 20-day mean + Bollinger %B.
  {
    const win = closes.slice(last - 19, last + 1);
    const mean = win.reduce((s, v) => s + v, 0) / win.length;
    const sd = stdev(win);
    const z = sd > 0 ? (price - mean) / sd : 0;
    const { upper, lower } = bollingerBands(closes, 20, 2);
    const u = upper[last], l = lower[last];
    const pctB = (u != null && l != null && u > l) ? (price - l) / (u - l) : 0.5;
    let vote = 0;
    if (z < -2 && pctB < 0.1) vote = 0.6;        // stretched below — snap back up
    else if (z > 2 && pctB > 0.9) vote = -0.6;   // stretched above — fade
    else vote = clamp(-z / 6, -0.3, 0.3);
    factors.push({ name: "Mean reversion", vote, weight: 0.12, detail: `z-score ${z.toFixed(2)}, %B ${pctB.toFixed(2)}` });
  }

  // 6. Volatility regime — modulates confidence (high vol ⇒ less certain).
  const rets: number[] = [];
  for (let i = Math.max(1, last - 20); i <= last; i++) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  const hv = stdev(rets) * Math.sqrt(252);
  const atrPct = (atr(highs, lows, closes, 14)[last] ?? 0) / price;

  // Blend the directional votes.
  const wsum = factors.reduce((s, f) => s + f.weight, 0);
  const score = clamp(factors.reduce((s, f) => s + f.vote * f.weight, 0) / wsum, -1, 1);

  const probUp = Math.round(clamp(50 + 50 * score, 1, 99));
  const direction: MarketPrediction["direction"] = probUp >= 56 ? "UP" : probUp <= 44 ? "DOWN" : "NEUTRAL";
  // Confidence: distance from 50/50, dampened when volatility is high.
  const volDamp = clamp(1 - (hv - 0.15) , 0.45, 1); // hv 15% → 1.0, 70% → 0.45
  const confidence = Math.round(clamp(Math.abs(score) * 100 * volDamp, 0, 95));

  factors.push({
    name: "Volatility",
    vote: 0,
    weight: 0,
    detail: `Annualized ${(hv * 100).toFixed(0)}%, daily ATR ${(atrPct * 100).toFixed(1)}% — ${hv > 0.3 ? "elevated, lower conviction" : "normal"}`,
  });

  return { direction, probUp, confidence, score, factors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Backtest the next-day predictor: walk the candle history, and at each day run
// predictNextDay on data up to that day, then compare the call to the actual
// next-day close. Reports directional accuracy (vs the market's own up-rate
// baseline) and a Brier score on the up-probability.
// ─────────────────────────────────────────────────────────────────────────────
export interface PredictionBacktest {
  evaluated: number;        // total next-day outcomes checked
  directionalCalls: number; // non-neutral calls (UP or DOWN)
  correct: number;          // directional calls that matched the next day
  accuracyPct: number;      // correct / directionalCalls
  upCalls: number; upCorrect: number;
  downCalls: number; downCorrect: number;
  neutralCalls: number;
  marketUpRate: number;     // baseline: % of days the index actually rose
  edgePct: number;          // accuracy − the "always guess the majority direction" baseline
  highConfCalls: number; highConfAccuracyPct: number; // calls with confidence ≥ 50
  brier: number;            // mean (probUp/100 − actualUp)², 0.25 = coin flip, lower better
}

export function backtestNextDay(candles: OHLCV[], lookbackDays = 90): PredictionBacktest | null {
  const n = candles.length;
  if (n < 70) return null;
  const start = Math.max(60, n - 1 - lookbackDays);

  let evaluated = 0, directionalCalls = 0, correct = 0;
  let upCalls = 0, upCorrect = 0, downCalls = 0, downCorrect = 0, neutralCalls = 0;
  let actualUps = 0, brierSum = 0;
  let highConfCalls = 0, highConfCorrect = 0;

  for (let i = start; i < n - 1; i++) {
    const pred = predictNextDay(candles.slice(0, i + 1));
    if (!pred) continue;
    const actualUp = candles[i + 1].close > candles[i].close;
    evaluated++;
    if (actualUp) actualUps++;
    brierSum += (pred.probUp / 100 - (actualUp ? 1 : 0)) ** 2;

    if (pred.direction === "NEUTRAL") { neutralCalls++; continue; }
    directionalCalls++;
    const hit = (pred.direction === "UP") === actualUp;
    if (hit) correct++;
    if (pred.direction === "UP") { upCalls++; if (actualUp) upCorrect++; }
    else { downCalls++; if (!actualUp) downCorrect++; }
    if (pred.confidence >= 50) { highConfCalls++; if (hit) highConfCorrect++; }
  }

  const marketUpRate = evaluated ? (actualUps / evaluated) * 100 : 0;
  const baseline = Math.max(marketUpRate, 100 - marketUpRate); // always-guess-majority
  const accuracyPct = directionalCalls ? (correct / directionalCalls) * 100 : 0;

  return {
    evaluated, directionalCalls, correct,
    accuracyPct: Math.round(accuracyPct * 10) / 10,
    upCalls, upCorrect, downCalls, downCorrect, neutralCalls,
    marketUpRate: Math.round(marketUpRate * 10) / 10,
    edgePct: Math.round((accuracyPct - baseline) * 10) / 10,
    highConfCalls,
    highConfAccuracyPct: highConfCalls ? Math.round((highConfCorrect / highConfCalls) * 1000) / 10 : 0,
    brier: Math.round((brierSum / Math.max(1, evaluated)) * 1000) / 1000,
  };
}
