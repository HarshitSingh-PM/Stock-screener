import { NextRequest, NextResponse } from "next/server";
import { getStockQuote, getHistoricalData } from "@/lib/stockData";
import { STRATEGIES } from "@/lib/strategies";
import {
  OHLCV, sma, ema, rsi, bollingerBands, atr, macd, supertrend, pivotPoints,
  obv, adl, adx, mfi, stochastic, roc,
} from "@/lib/indicators";

export const maxDuration = 60;

interface LevelAnalysis {
  pivots: { pivot: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number };
  fibonacci: { level236: number; level382: number; level500: number; level618: number; level786: number };
  movingAverages: { sma20: number | null; sma50: number | null; sma100: number | null; sma200: number | null; ema9: number | null; ema21: number | null };
  targets: { target1: number; target2: number; target3: number; stopLoss: number };
  support: number[];
  resistance: number[];
  supertrendLevel: number | null;
  supertrendDirection: number | null;
}

function computeLevels(candles: OHLCV[]): LevelAnalysis {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const last = candles.length - 1;

  // Pivot Points (using last candle)
  const lastCandle = candles[last];
  const pp = pivotPoints(lastCandle.high, lastCandle.low, lastCandle.close);
  const pivotRange = lastCandle.high - lastCandle.low;
  const pivots = {
    pivot: pp.pivot,
    r1: pp.r1,
    r2: pp.r2,
    r3: pp.r2 + pivotRange,
    s1: pp.s1,
    s2: pp.s2,
    s3: pp.s2 - pivotRange,
  };

  // Fibonacci retracement (52-week or available range)
  const lookback = Math.min(candles.length, 252);
  const recentHighs = highs.slice(last - lookback + 1);
  const recentLows = lows.slice(last - lookback + 1);
  const swingHigh = Math.max(...recentHighs);
  const swingLow = Math.min(...recentLows);
  const fibRange = swingHigh - swingLow;
  const fibonacci = {
    level236: swingHigh - fibRange * 0.236,
    level382: swingHigh - fibRange * 0.382,
    level500: swingHigh - fibRange * 0.5,
    level618: swingHigh - fibRange * 0.618,
    level786: swingHigh - fibRange * 0.786,
  };

  // Moving Averages
  const sma20Arr = sma(closes, 20);
  const sma50Arr = sma(closes, 50);
  const sma100Arr = sma(closes, 100);
  const sma200Arr = sma(closes, 200);
  const ema9Arr = ema(closes, 9);
  const ema21Arr = ema(closes, 21);
  const movingAverages = {
    sma20: sma20Arr[last],
    sma50: sma50Arr[last],
    sma100: sma100Arr[last],
    sma200: sma200Arr[last],
    ema9: ema9Arr[last],
    ema21: ema21Arr[last],
  };

  // Supertrend
  const st = supertrend(highs, lows, closes);
  const supertrendLevel = st.supertrend[last];
  const supertrendDirection = st.direction[last];

  // ATR-based targets
  const atrValues = atr(highs, lows, closes, 14);
  const atrVal = atrValues[last] || (lastCandle.high - lastCandle.low);
  const price = closes[last];
  const targets = {
    target1: price + atrVal * 1.5,
    target2: price + atrVal * 2.5,
    target3: price + atrVal * 4,
    stopLoss: price - atrVal * 1.5,
  };

  // Dynamic support/resistance from recent swing points
  const support: number[] = [];
  const resistance: number[] = [];

  // Find swing lows (support) and swing highs (resistance) over last 60 candles
  const swingLookback = Math.min(60, candles.length - 2);
  for (let i = last - swingLookback + 2; i < last; i++) {
    if (i < 2) continue;
    // Swing high: higher than neighbors
    if (highs[i] > highs[i - 1] && highs[i] > highs[i + 1] && highs[i] > highs[i - 2]) {
      resistance.push(highs[i]);
    }
    // Swing low: lower than neighbors
    if (lows[i] < lows[i - 1] && lows[i] < lows[i + 1] && lows[i] < lows[i - 2]) {
      support.push(lows[i]);
    }
  }

  // Also add MA levels as support/resistance
  const maLevels = [movingAverages.sma20, movingAverages.sma50, movingAverages.sma200].filter((v): v is number => v !== null);
  for (const ma of maLevels) {
    if (ma < price) support.push(ma);
    else resistance.push(ma);
  }

  // Deduplicate and cluster nearby levels (within 1%)
  const clusterLevels = (levels: number[]): number[] => {
    if (levels.length === 0) return [];
    const sorted = [...levels].sort((a, b) => a - b);
    const clustered: number[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const lastCluster = clustered[clustered.length - 1];
      if (Math.abs(sorted[i] - lastCluster) / lastCluster > 0.01) {
        clustered.push(sorted[i]);
      }
    }
    return clustered;
  };

  return {
    pivots,
    fibonacci,
    movingAverages,
    targets,
    support: clusterLevels(support).sort((a, b) => b - a).slice(0, 5), // Nearest supports first
    resistance: clusterLevels(resistance).sort((a, b) => a - b).slice(0, 5), // Nearest resistances first
    supertrendLevel,
    supertrendDirection,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbolsParam = searchParams.get("symbols"); // comma-separated

  if (!symbolsParam) {
    return NextResponse.json({ error: "symbols parameter required" }, { status: 400 });
  }

  const symbols = symbolsParam.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  if (symbols.length === 0) {
    return NextResponse.json({ error: "No valid symbols" }, { status: 400 });
  }

  // Limit to 20 stocks at a time
  const toProcess = symbols.slice(0, 20);

  const results = [];
  // Process in batches of 5
  for (let i = 0; i < toProcess.length; i += 5) {
    const batch = toProcess.slice(i, i + 5);
    const batchResults = await Promise.allSettled(
      batch.map(async (symbol) => {
        const [quote, candles] = await Promise.all([
          getStockQuote(symbol),
          getHistoricalData(symbol, 300), // Get more data for 200-SMA
        ]);

        if (!quote || candles.length < 20) return null;

        // Run all strategies
        const strategyResults = STRATEGIES.map((strategy) => {
          try {
            const result = strategy.evaluate(candles);
            return {
              id: strategy.id,
              name: strategy.name,
              chapter: strategy.chapter,
              category: strategy.category,
              book: strategy.book,
              signal: result.signal,
              strength: result.strength,
              details: result.details,
            };
          } catch {
            return {
              id: strategy.id,
              name: strategy.name,
              chapter: strategy.chapter,
              category: strategy.category,
              book: strategy.book,
              signal: "NEUTRAL" as const,
              strength: 0,
              details: "Error evaluating",
            };
          }
        });

        const buySignals = strategyResults.filter(s => s.signal === "BUY");
        const sellSignals = strategyResults.filter(s => s.signal === "SELL");

        // Compute levels
        const levels = computeLevels(candles);

        // Overall recommendation
        const buyCount = buySignals.length;
        const sellCount = sellSignals.length;
        const total = strategyResults.length;
        const avgBuyStrength = buyCount > 0 ? Math.round(buySignals.reduce((s, r) => s + r.strength, 0) / buyCount) : 0;
        const avgSellStrength = sellCount > 0 ? Math.round(sellSignals.reduce((s, r) => s + r.strength, 0) / sellCount) : 0;

        let recommendation: string;
        let recSignal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
        const buyRatio = buyCount / total;
        const sellRatio = sellCount / total;
        if (buyRatio > 0.3 && buyCount > sellCount * 2) { recSignal = "STRONG_BUY"; recommendation = "Strong Buy - multiple strategy confluence"; }
        else if (buyCount > sellCount && buyRatio > 0.15) { recSignal = "BUY"; recommendation = "Buy - majority of strategies bullish"; }
        else if (sellRatio > 0.3 && sellCount > buyCount * 2) { recSignal = "STRONG_SELL"; recommendation = "Strong Sell - heavy bearish signals"; }
        else if (sellCount > buyCount && sellRatio > 0.15) { recSignal = "SELL"; recommendation = "Sell - majority of strategies bearish"; }
        else { recSignal = "HOLD"; recommendation = "Hold - no clear directional consensus"; }

        return {
          symbol,
          quote,
          levels,
          signals: {
            buyCount,
            sellCount,
            neutralCount: total - buyCount - sellCount,
            total,
            avgBuyStrength,
            avgSellStrength,
            recommendation,
            recSignal,
            topBuy: buySignals.sort((a, b) => b.strength - a.strength).slice(0, 5),
            topSell: sellSignals.sort((a, b) => b.strength - a.strength).slice(0, 5),
          },
        };
      })
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }
  }

  return NextResponse.json({ stocks: results });
}
