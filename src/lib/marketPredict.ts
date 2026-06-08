import { ema, rsi, macd, adx, bollingerBands, atr, sma } from "./indicators";
import type { OHLCV } from "./indicators";

// ─────────────────────────────────────────────────────────────────────────────
// Market POSTURE / multi-day outlook for an index. NOT a next-day bet — a
// sentiment read over a short horizon (~1 week / 5 trading days by default),
// where the repo-learned factors actually carry signal.
//
// Factors (each a −1..+1 vote): trend stack + ADX, multi-day momentum, RSI,
// MACD, mean-reversion (z-score + Bollinger), with volatility scaling confidence.
//
// De-bias: the raw factor probability is blended toward the index's OWN realized
// up-rate over the horizon (computed from past data only). Equities drift up, so
// this removes the systematic DOWN-bias the next-day version showed.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_HORIZON = 5; // trading days (~1 week)

export interface PredictionFactor {
  name: string;
  vote: number;       // −1 (bearish) .. +1 (bullish)
  weight: number;
  detail: string;
}

export interface MarketPrediction {
  direction: "UP" | "DOWN" | "NEUTRAL";
  probUp: number;       // 0..100 — probability the index is higher in `horizon` days
  confidence: number;   // 0..100
  score: number;        // −1..+1 blended directional score
  horizon: number;      // trading-day outlook
  driftUpRate: number;  // index's realized up-rate over the horizon (the prior)
  factors: PredictionFactor[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function stdev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = arr.reduce((s, v) => s + v, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

// Realized fraction of horizon-day windows that closed up, over the last `window`
// days — using ONLY data up to the final bar (no look-ahead).
function realizedUpRate(closes: number[], horizon: number, window = 120): number {
  const lastEval = closes.length - 1 - horizon; // last day with a known forward outcome
  if (lastEval < 1) return 0.5;
  const from = Math.max(0, lastEval - window);
  let up = 0, n = 0;
  for (let j = from; j <= lastEval; j++) {
    n++;
    if (closes[j + horizon] > closes[j]) up++;
  }
  return n ? up / n : 0.5;
}

export function predictMarket(candles: OHLCV[], horizon = DEFAULT_HORIZON): MarketPrediction | null {
  if (candles.length < 70) return null;
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

  // 2. Momentum — blended returns scaled to the horizon.
  {
    const w1 = horizon, w2 = Math.min(last, horizon * 2), w3 = Math.min(last, horizon * 4);
    const mom = 0.5 * ret(w1) + 0.3 * ret(w2) + 0.2 * ret(w3);
    const vote = clamp(mom * 12, -1, 1);
    factors.push({ name: "Momentum", vote, weight: 0.24, detail: `${w1}d ${(ret(w1) * 100).toFixed(1)}%, ${w3}d ${(ret(w3) * 100).toFixed(1)}%` });
  }

  // 3. RSI — momentum mid-range, mean-reversion at the extremes.
  {
    const r = rsi(closes, 14)[last];
    let vote = 0, detail = "RSI n/a";
    if (r != null) {
      if (r < 30) { vote = 0.7; detail = `RSI ${r.toFixed(0)} oversold — bounce likely`; }
      else if (r > 70) { vote = -0.5; detail = `RSI ${r.toFixed(0)} overbought — stretched`; }
      else { vote = clamp((r - 50) / 25, -1, 1); detail = `RSI ${r.toFixed(0)}`; }
    }
    factors.push({ name: "RSI", vote, weight: 0.14, detail });
  }

  // 4. MACD histogram + slope.
  {
    const m = macd(closes);
    const h = m.histogram[last], hp = m.histogram[last - 1];
    let vote = 0, detail = "MACD flat";
    if (h != null && hp != null) {
      const rising = h > hp;
      vote = clamp(Math.sign(h) * 0.5 + (rising ? 0.3 : -0.3), -1, 1);
      detail = `Histogram ${h >= 0 ? "+" : ""}${h.toFixed(2)}, ${rising ? "rising" : "falling"}`;
    }
    factors.push({ name: "MACD", vote, weight: 0.12, detail });
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
    if (z < -2 && pctB < 0.1) vote = 0.6;
    else if (z > 2 && pctB > 0.9) vote = -0.4;
    else vote = clamp(-z / 7, -0.3, 0.3);
    factors.push({ name: "Mean reversion", vote, weight: 0.10, detail: `z-score ${z.toFixed(2)}, %B ${pctB.toFixed(2)}` });
  }

  // 6. Position vs 200-DMA — the long-trend regime (mild bullish tilt above it).
  {
    const ma200 = sma(closes, 200)[last];
    let vote = 0, detail = "200-DMA n/a";
    if (ma200 != null) {
      const dist = (price - ma200) / ma200;
      vote = clamp(dist * 6, -0.6, 0.6);
      detail = `${dist >= 0 ? "+" : ""}${(dist * 100).toFixed(1)}% vs 200-DMA`;
    }
    factors.push({ name: "Long trend", vote, weight: 0.12, detail });
  }

  // Volatility (confidence modifier only).
  const rets: number[] = [];
  for (let i = Math.max(1, last - 20); i <= last; i++) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  const hv = stdev(rets) * Math.sqrt(252);
  const atrPct = (atr(highs, lows, closes, 14)[last] ?? 0) / price;

  const wsum = factors.reduce((s, f) => s + f.weight, 0);
  const score = clamp(factors.reduce((s, f) => s + f.vote * f.weight, 0) / wsum, -1, 1);

  // De-bias: blend the factor probability with the index's realized up-rate prior.
  const driftUpRate = realizedUpRate(closes, horizon);
  const probRaw = 50 + 50 * score;
  const probUp = Math.round(clamp(0.62 * probRaw + 0.38 * (driftUpRate * 100), 1, 99));

  const direction: MarketPrediction["direction"] = probUp >= 55 ? "UP" : probUp <= 45 ? "DOWN" : "NEUTRAL";
  const volDamp = clamp(1 - (hv - 0.15), 0.45, 1);
  const confidence = Math.round(clamp(Math.abs(probUp - 50) * 2 * volDamp, 0, 95));

  factors.push({
    name: "Volatility",
    vote: 0, weight: 0,
    detail: `Annualized ${(hv * 100).toFixed(0)}%, daily ATR ${(atrPct * 100).toFixed(1)}% — ${hv > 0.3 ? "elevated, lower conviction" : "normal"}`,
  });

  return { direction, probUp, confidence, score, horizon, driftUpRate: Math.round(driftUpRate * 1000) / 10, factors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Backtest the posture model: at each day predict the `horizon`-day outlook on
// past-only data, then compare to the actual close `horizon` days later.
// ─────────────────────────────────────────────────────────────────────────────
export interface PredictionBacktest {
  horizon: number;
  evaluated: number;
  directionalCalls: number;
  correct: number;
  accuracyPct: number;
  upCalls: number; upCorrect: number;
  downCalls: number; downCorrect: number;
  neutralCalls: number;
  marketUpRate: number;
  edgePct: number;
  highConfCalls: number; highConfAccuracyPct: number;
  brier: number;
}

export function backtestMarket(candles: OHLCV[], horizon = DEFAULT_HORIZON, lookbackDays = 90): PredictionBacktest | null {
  const n = candles.length;
  if (n < 80) return null;
  const start = Math.max(70, n - horizon - lookbackDays);

  let evaluated = 0, directionalCalls = 0, correct = 0;
  let upCalls = 0, upCorrect = 0, downCalls = 0, downCorrect = 0, neutralCalls = 0;
  let actualUps = 0, brierSum = 0, highConfCalls = 0, highConfCorrect = 0;

  for (let i = start; i < n - horizon; i++) {
    const pred = predictMarket(candles.slice(0, i + 1), horizon);
    if (!pred) continue;
    const actualUp = candles[i + horizon].close > candles[i].close;
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
  const baseline = Math.max(marketUpRate, 100 - marketUpRate);
  const accuracyPct = directionalCalls ? (correct / directionalCalls) * 100 : 0;

  return {
    horizon, evaluated, directionalCalls, correct,
    accuracyPct: Math.round(accuracyPct * 10) / 10,
    upCalls, upCorrect, downCalls, downCorrect, neutralCalls,
    marketUpRate: Math.round(marketUpRate * 10) / 10,
    edgePct: Math.round((accuracyPct - baseline) * 10) / 10,
    highConfCalls,
    highConfAccuracyPct: highConfCalls ? Math.round((highConfCorrect / highConfCalls) * 1000) / 10 : 0,
    brier: Math.round((brierSum / Math.max(1, evaluated)) * 1000) / 1000,
  };
}
