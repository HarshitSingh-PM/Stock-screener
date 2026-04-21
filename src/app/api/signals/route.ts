import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { OHLCV, sma, ema, rsi, bollingerBands, atr, macd, obv, adl, adx, cci, mfi, stochastic, roc } from "@/lib/indicators";

const yahooFinance = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey"] });

export const maxDuration = 60;

interface MarketSignal {
  name: string;
  value: number;
  signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  details: string;
  category: "trend" | "momentum" | "volume" | "volatility" | "breadth";
}

interface MarketEvent {
  type: "earnings" | "economic" | "technical" | "sentiment" | "sector";
  title: string;
  description: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  signal: "BULLISH" | "BEARISH" | "NEUTRAL" | "WATCH";
  timestamp: string;
}

function analyzeIndex(candles: OHLCV[]): MarketSignal[] {
  const signals: MarketSignal[] = [];
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);
  const last = closes.length - 1;

  // 1. Trend: SMA alignment
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  if (sma20[last] && sma50[last] && sma200[last]) {
    const bullish = sma20[last]! > sma50[last]! && sma50[last]! > sma200[last]!;
    const bearish = sma20[last]! < sma50[last]! && sma50[last]! < sma200[last]!;
    signals.push({
      name: "Moving Average Alignment",
      value: bullish ? 80 : bearish ? 20 : 50,
      signal: bullish ? "BULLISH" : bearish ? "BEARISH" : "NEUTRAL",
      details: bullish ? "20 > 50 > 200 SMA: Perfect bullish alignment" : bearish ? "20 < 50 < 200 SMA: Bearish alignment" : "Mixed SMA alignment",
      category: "trend",
    });

    // Golden/Death Cross proximity
    const s50 = sma50[last]!;
    const s200 = sma200[last]!;
    const spread = ((s50 - s200) / s200) * 100;
    if (Math.abs(spread) < 2) {
      signals.push({
        name: spread > 0 ? "Golden Cross Zone" : "Death Cross Zone",
        value: spread > 0 ? 70 : 30,
        signal: spread > 0 ? "BULLISH" : "BEARISH",
        details: `50/200 SMA spread: ${spread.toFixed(2)}%. ${spread > 0 ? "Golden" : "Death"} cross ${Math.abs(spread) < 0.5 ? "imminent" : "nearby"}.`,
        category: "trend",
      });
    }
  }

  // 2. Momentum: RSI
  const rsiValues = rsi(closes, 14);
  const rsiVal = rsiValues[last];
  if (rsiVal) {
    signals.push({
      name: "RSI Momentum",
      value: rsiVal,
      signal: rsiVal < 30 ? "BULLISH" : rsiVal > 70 ? "BEARISH" : rsiVal < 45 ? "BULLISH" : rsiVal > 55 ? "BEARISH" : "NEUTRAL",
      details: `RSI(14) = ${rsiVal.toFixed(1)}. ${rsiVal < 30 ? "Oversold - buy zone" : rsiVal > 70 ? "Overbought - caution" : "Neutral range"}`,
      category: "momentum",
    });
  }

  // 3. Momentum: MACD
  const macdData = macd(closes);
  const macdVal = macdData.macdLine[last];
  const macdSig = macdData.signalLine[last];
  const macdHist = macdData.histogram[last];
  if (macdVal !== null && macdSig !== null && macdHist !== null) {
    const prevHist = macdData.histogram[last - 1];
    const histRising = prevHist !== null && macdHist > prevHist;
    signals.push({
      name: "MACD Signal",
      value: macdVal > macdSig ? 70 : 30,
      signal: macdVal > macdSig ? "BULLISH" : "BEARISH",
      details: `MACD ${macdVal > macdSig ? "above" : "below"} signal. Histogram ${histRising ? "rising" : "falling"} (${macdHist.toFixed(2)}).`,
      category: "momentum",
    });
  }

  // 4. Momentum: Stochastic
  const { k, d } = stochastic(highs, lows, closes, 14, 3);
  if (k[last] !== null && d[last] !== null) {
    const kVal = k[last]!;
    signals.push({
      name: "Stochastic Oscillator",
      value: kVal,
      signal: kVal < 20 ? "BULLISH" : kVal > 80 ? "BEARISH" : "NEUTRAL",
      details: `%K=${kVal.toFixed(0)}, %D=${d[last]!.toFixed(0)}. ${kVal < 20 ? "Oversold" : kVal > 80 ? "Overbought" : "Mid-range"}.`,
      category: "momentum",
    });
  }

  // 5. Volume: OBV trend
  const obvValues = obv(closes, volumes);
  const obvSma = sma(obvValues, 20);
  if (obvSma[last] !== null) {
    const obvTrend = obvValues[last] > obvSma[last]! ? "BULLISH" : "BEARISH";
    const obvRising = obvValues[last] > obvValues[last - 5];
    signals.push({
      name: "OBV Trend",
      value: obvTrend === "BULLISH" ? 70 : 30,
      signal: obvTrend,
      details: `OBV ${obvRising ? "rising" : "falling"}, ${obvTrend === "BULLISH" ? "above" : "below"} 20-SMA. ${obvTrend === "BULLISH" ? "Volume confirms buying" : "Volume pressure selling"}.`,
      category: "volume",
    });
  }

  // 6. Volume: MFI
  const mfiValues = mfi(highs, lows, closes, volumes, 14);
  const mfiVal = mfiValues[last];
  if (mfiVal !== null) {
    signals.push({
      name: "Money Flow Index",
      value: mfiVal,
      signal: mfiVal < 20 ? "BULLISH" : mfiVal > 80 ? "BEARISH" : "NEUTRAL",
      details: `MFI(14) = ${mfiVal.toFixed(1)}. ${mfiVal < 20 ? "Oversold - money flowing in" : mfiVal > 80 ? "Overbought - money flowing out" : "Normal money flow"}.`,
      category: "volume",
    });
  }

  // 7. Volume: Recent volume vs average
  const avgVol = volumes.slice(last - 20, last).reduce((a, b) => a + b, 0) / 20;
  const volRatio = volumes[last] / avgVol;
  signals.push({
    name: "Volume Activity",
    value: Math.min(100, volRatio * 50),
    signal: volRatio > 1.5 ? (closes[last] > closes[last - 1] ? "BULLISH" : "BEARISH") : "NEUTRAL",
    details: `Current volume ${volRatio.toFixed(1)}x average. ${volRatio > 2 ? "Extremely high" : volRatio > 1.5 ? "Above average" : volRatio < 0.5 ? "Very low" : "Normal"} activity.`,
    category: "volume",
  });

  // 8. Volatility: Bollinger Band width
  const bb = bollingerBands(closes, 20, 2);
  if (bb.upper[last] && bb.lower[last] && bb.middle[last]) {
    const width = (bb.upper[last]! - bb.lower[last]!) / bb.middle[last]!;
    const prevWidths: number[] = [];
    for (let i = last - 20; i < last; i++) {
      if (bb.upper[i] && bb.lower[i] && bb.middle[i] && bb.middle[i]! > 0) {
        prevWidths.push((bb.upper[i]! - bb.lower[i]!) / bb.middle[i]!);
      }
    }
    const avgWidth = prevWidths.length > 0 ? prevWidths.reduce((a, b) => a + b, 0) / prevWidths.length : width;
    const squeeze = width < avgWidth * 0.8;
    const expanding = width > avgWidth * 1.2;
    signals.push({
      name: "Bollinger Band Width",
      value: squeeze ? 80 : expanding ? 40 : 60,
      signal: squeeze ? "BULLISH" : "NEUTRAL",
      details: `BB Width: ${(width * 100).toFixed(2)}% (avg: ${(avgWidth * 100).toFixed(2)}%). ${squeeze ? "SQUEEZE - big move coming" : expanding ? "Expanding volatility" : "Normal"}.`,
      category: "volatility",
    });

    // Price position in BB
    const bbPos = ((closes[last] - bb.lower[last]!) / (bb.upper[last]! - bb.lower[last]!)) * 100;
    signals.push({
      name: "BB Position",
      value: bbPos,
      signal: bbPos < 15 ? "BULLISH" : bbPos > 85 ? "BEARISH" : "NEUTRAL",
      details: `Price at ${bbPos.toFixed(0)}% of BB range. ${bbPos < 15 ? "Near lower band - oversold" : bbPos > 85 ? "Near upper band - overbought" : "Mid-range"}.`,
      category: "volatility",
    });
  }

  // 9. Volatility: ATR trend
  const atrValues = atr(highs, lows, closes, 14);
  if (atrValues[last] && atrValues[last - 5]) {
    const atrRising = atrValues[last]! > atrValues[last - 5]!;
    const atrPercent = (atrValues[last]! / closes[last]) * 100;
    signals.push({
      name: "ATR Volatility",
      value: atrRising ? 60 : 40,
      signal: "NEUTRAL",
      details: `ATR(14) = ${atrValues[last]!.toFixed(2)} (${atrPercent.toFixed(2)}% of price). Volatility ${atrRising ? "increasing" : "decreasing"}.`,
      category: "volatility",
    });
  }

  // 10. ADX Trend Strength
  const { adx: adxValues, plusDI, minusDI } = adx(highs, lows, closes, 14);
  const adxVal = adxValues[last];
  if (adxVal !== null && plusDI[last] !== null && minusDI[last] !== null) {
    signals.push({
      name: "ADX Trend Strength",
      value: adxVal,
      signal: adxVal > 25 ? (plusDI[last]! > minusDI[last]! ? "BULLISH" : "BEARISH") : "NEUTRAL",
      details: `ADX=${adxVal.toFixed(0)} ${adxVal > 25 ? "(Strong trend)" : "(Weak/no trend)"}. +DI=${plusDI[last]!.toFixed(0)}, -DI=${minusDI[last]!.toFixed(0)}.`,
      category: "trend",
    });
  }

  // 11. CCI
  const cciValues = cci(highs, lows, closes, 20);
  const cciVal = cciValues[last];
  if (cciVal !== null) {
    signals.push({
      name: "CCI Level",
      value: Math.min(100, Math.max(0, 50 + cciVal / 4)),
      signal: cciVal < -100 ? "BULLISH" : cciVal > 100 ? "BEARISH" : "NEUTRAL",
      details: `CCI(20) = ${cciVal.toFixed(0)}. ${cciVal < -100 ? "Oversold territory" : cciVal > 100 ? "Overbought territory" : "Normal range"}.`,
      category: "momentum",
    });
  }

  // 12. Price vs 52-week range (breadth proxy)
  const high52w = Math.max(...highs.slice(Math.max(0, last - 252)));
  const low52w = Math.min(...lows.slice(Math.max(0, last - 252)));
  const pos52w = ((closes[last] - low52w) / (high52w - low52w)) * 100;
  signals.push({
    name: "52-Week Position",
    value: pos52w,
    signal: pos52w > 80 ? "BULLISH" : pos52w < 20 ? "BEARISH" : "NEUTRAL",
    details: `Price at ${pos52w.toFixed(0)}% of 52-week range (H: ${high52w.toFixed(0)}, L: ${low52w.toFixed(0)}). ${pos52w > 80 ? "Near highs - strong" : pos52w < 20 ? "Near lows - weak" : "Mid-range"}.`,
    category: "breadth",
  });

  // 13. Rate of Change
  const roc5 = roc(closes, 5);
  const roc20 = roc(closes, 20);
  if (roc5[last] !== null && roc20[last] !== null) {
    const momentum = roc5[last]! + roc20[last]! / 2;
    signals.push({
      name: "Price Momentum",
      value: Math.min(100, Math.max(0, 50 + momentum * 5)),
      signal: momentum > 3 ? "BULLISH" : momentum < -3 ? "BEARISH" : "NEUTRAL",
      details: `ROC(5)=${roc5[last]!.toFixed(2)}%, ROC(20)=${roc20[last]!.toFixed(2)}%. ${momentum > 0 ? "Positive" : "Negative"} momentum.`,
      category: "momentum",
    });
  }

  return signals;
}

function generateMarketEvents(niftyCandles: OHLCV[], sensexCandles: OHLCV[]): MarketEvent[] {
  const events: MarketEvent[] = [];
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const closes = niftyCandles.map(c => c.close);
  const highs = niftyCandles.map(c => c.high);
  const lows = niftyCandles.map(c => c.low);
  const volumes = niftyCandles.map(c => c.volume);
  const last = closes.length - 1;

  // 1. Large market moves
  const dayChange = ((closes[last] - closes[last - 1]) / closes[last - 1]) * 100;
  if (Math.abs(dayChange) > 1) {
    events.push({
      type: "technical",
      title: `Nifty ${dayChange > 0 ? "Rallied" : "Dropped"} ${Math.abs(dayChange).toFixed(2)}%`,
      description: `Market ${dayChange > 0 ? "gained" : "lost"} ${Math.abs(dayChange).toFixed(2)}% in the last session. ${dayChange > 0 ? "Buying" : "Selling"} pressure dominated.`,
      impact: Math.abs(dayChange) > 2 ? "HIGH" : "MEDIUM",
      signal: dayChange > 0 ? "BULLISH" : "BEARISH",
      timestamp: todayStr,
    });
  }

  // 2. Volume anomaly
  const avgVol = volumes.slice(last - 20, last).reduce((a, b) => a + b, 0) / 20;
  const volRatio = volumes[last] / avgVol;
  if (volRatio > 2) {
    events.push({
      type: "sentiment",
      title: `Unusual Volume: ${volRatio.toFixed(1)}x Average`,
      description: `Market volume is ${volRatio.toFixed(1)}x the 20-day average. High participation indicates strong conviction in the current direction.`,
      impact: "HIGH",
      signal: closes[last] > closes[last - 1] ? "BULLISH" : "BEARISH",
      timestamp: todayStr,
    });
  }

  // 3. New 52-week high/low
  const high52w = Math.max(...highs.slice(Math.max(0, last - 252), last));
  const low52w = Math.min(...lows.slice(Math.max(0, last - 252), last));
  if (closes[last] > high52w) {
    events.push({
      type: "technical",
      title: "Nifty at New 52-Week High",
      description: `Market broke above previous 52-week high of ${high52w.toFixed(0)}. Bullish breakout territory.`,
      impact: "HIGH",
      signal: "BULLISH",
      timestamp: todayStr,
    });
  } else if (closes[last] < low52w) {
    events.push({
      type: "technical",
      title: "Nifty at New 52-Week Low",
      description: `Market broke below previous 52-week low of ${low52w.toFixed(0)}. Bearish breakdown.`,
      impact: "HIGH",
      signal: "BEARISH",
      timestamp: todayStr,
    });
  }

  // 4. SMA crossovers
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  if (sma50[last] && sma200[last]) {
    const s50 = sma50[last]!;
    const s200 = sma200[last]!;
    const s50prev = sma50[last - 1]!;
    const s200prev = sma200[last - 1]!;
    if (s50 > s200 && s50prev <= s200prev) {
      events.push({
        type: "technical",
        title: "GOLDEN CROSS on Nifty",
        description: "50-SMA crossed above 200-SMA. This is a major long-term bullish signal historically associated with sustained rallies.",
        impact: "HIGH",
        signal: "BULLISH",
        timestamp: todayStr,
      });
    } else if (s50 < s200 && s50prev >= s200prev) {
      events.push({
        type: "technical",
        title: "DEATH CROSS on Nifty",
        description: "50-SMA crossed below 200-SMA. This is a major long-term bearish signal historically associated with extended declines.",
        impact: "HIGH",
        signal: "BEARISH",
        timestamp: todayStr,
      });
    }

    // Proximity to cross
    const spread = ((s50 - s200) / s200) * 100;
    if (Math.abs(spread) < 1 && !(s50 > s200 && s50prev <= s200prev) && !(s50 < s200 && s50prev >= s200prev)) {
      events.push({
        type: "technical",
        title: `${spread > 0 ? "Golden" : "Death"} Cross Approaching`,
        description: `50/200 SMA spread is only ${Math.abs(spread).toFixed(2)}%. A ${spread > 0 ? "death" : "golden"} cross may form soon. Watch closely.`,
        impact: "MEDIUM",
        signal: "WATCH",
        timestamp: todayStr,
      });
    }
  }

  // 5. RSI extremes
  const rsiValues = rsi(closes, 14);
  const rsiVal = rsiValues[last];
  if (rsiVal && rsiVal < 25) {
    events.push({
      type: "sentiment",
      title: "Market Deeply Oversold",
      description: `Nifty RSI at ${rsiVal.toFixed(1)} - extreme oversold. Historically, such levels have preceded bounces. Contrarian buy zone.`,
      impact: "HIGH",
      signal: "BULLISH",
      timestamp: todayStr,
    });
  } else if (rsiVal && rsiVal > 75) {
    events.push({
      type: "sentiment",
      title: "Market Extremely Overbought",
      description: `Nifty RSI at ${rsiVal.toFixed(1)} - extreme overbought. Elevated risk of pullback. Reduce risk or hedge.`,
      impact: "HIGH",
      signal: "BEARISH",
      timestamp: todayStr,
    });
  }

  // 6. Bollinger Band signals
  const bb = bollingerBands(closes, 20, 2);
  if (bb.upper[last] && bb.lower[last]) {
    if (closes[last] > bb.upper[last]!) {
      events.push({
        type: "technical",
        title: "Price Above Upper Bollinger Band",
        description: `Nifty broke above upper BB (${bb.upper[last]!.toFixed(0)}). Strong momentum but extended. Watch for pullback.`,
        impact: "MEDIUM",
        signal: "WATCH",
        timestamp: todayStr,
      });
    } else if (closes[last] < bb.lower[last]!) {
      events.push({
        type: "technical",
        title: "Price Below Lower Bollinger Band",
        description: `Nifty broke below lower BB (${bb.lower[last]!.toFixed(0)}). Oversold bounce potential.`,
        impact: "MEDIUM",
        signal: "BULLISH",
        timestamp: todayStr,
      });
    }

    // BB squeeze
    const width = (bb.upper[last]! - bb.lower[last]!) / bb.middle[last]!;
    const prevWidths: number[] = [];
    for (let i = last - 20; i < last; i++) {
      if (bb.upper[i] && bb.lower[i] && bb.middle[i] && bb.middle[i]! > 0) {
        prevWidths.push((bb.upper[i]! - bb.lower[i]!) / bb.middle[i]!);
      }
    }
    const minWidth = prevWidths.length > 0 ? Math.min(...prevWidths) : width;
    if (width <= minWidth * 1.05) {
      events.push({
        type: "technical",
        title: "Bollinger Band Squeeze Detected",
        description: "BB width at minimum. Historically, extreme low volatility precedes large directional moves. Prepare for breakout.",
        impact: "HIGH",
        signal: "WATCH",
        timestamp: todayStr,
      });
    }
  }

  // 7. Consecutive up/down days
  let consUp = 0, consDown = 0;
  for (let i = last; i > Math.max(0, last - 10); i--) {
    if (closes[i] > closes[i - 1]) { if (consDown > 0) break; consUp++; }
    else if (closes[i] < closes[i - 1]) { if (consUp > 0) break; consDown++; }
    else break;
  }
  if (consUp >= 5) {
    events.push({
      type: "sentiment",
      title: `${consUp} Consecutive Up Days`,
      description: `Market has risen for ${consUp} straight sessions. Strong momentum but mean reversion risk increasing.`,
      impact: "MEDIUM",
      signal: consUp >= 7 ? "BEARISH" : "BULLISH",
      timestamp: todayStr,
    });
  }
  if (consDown >= 5) {
    events.push({
      type: "sentiment",
      title: `${consDown} Consecutive Down Days`,
      description: `Market has fallen for ${consDown} straight sessions. Selling pressure persistent but bounce probability rising.`,
      impact: "MEDIUM",
      signal: consDown >= 7 ? "BULLISH" : "BEARISH",
      timestamp: todayStr,
    });
  }

  // 8. Gap detection
  const gapPercent = ((niftyCandles[last].open - closes[last - 1]) / closes[last - 1]) * 100;
  if (Math.abs(gapPercent) > 0.5) {
    events.push({
      type: "technical",
      title: `Market Gap ${gapPercent > 0 ? "Up" : "Down"}: ${Math.abs(gapPercent).toFixed(2)}%`,
      description: `Nifty opened with a ${Math.abs(gapPercent).toFixed(2)}% gap ${gapPercent > 0 ? "up" : "down"}. ${Math.abs(gapPercent) > 1.5 ? "Major gap - significant overnight event." : "Moderate gap."}`,
      impact: Math.abs(gapPercent) > 1.5 ? "HIGH" : "MEDIUM",
      signal: gapPercent > 0 ? "BULLISH" : "BEARISH",
      timestamp: todayStr,
    });
  }

  // 9. Week-over-week momentum
  if (last >= 5) {
    const weekChange = ((closes[last] - closes[last - 5]) / closes[last - 5]) * 100;
    if (Math.abs(weekChange) > 3) {
      events.push({
        type: "sentiment",
        title: `Weekly Move: ${weekChange > 0 ? "+" : ""}${weekChange.toFixed(2)}%`,
        description: `Nifty ${weekChange > 0 ? "gained" : "lost"} ${Math.abs(weekChange).toFixed(2)}% this week. ${Math.abs(weekChange) > 5 ? "Exceptional" : "Significant"} weekly movement.`,
        impact: Math.abs(weekChange) > 5 ? "HIGH" : "MEDIUM",
        signal: weekChange > 0 ? "BULLISH" : "BEARISH",
        timestamp: todayStr,
      });
    }
  }

  // 10. Distance from key levels
  if (sma200[last]) {
    const distFrom200 = ((closes[last] - sma200[last]!) / sma200[last]!) * 100;
    if (Math.abs(distFrom200) < 1) {
      events.push({
        type: "technical",
        title: "Price Testing 200-SMA",
        description: `Nifty is ${Math.abs(distFrom200).toFixed(2)}% from 200-SMA (${sma200[last]!.toFixed(0)}). This is a critical support/resistance level watched by institutions.`,
        impact: "HIGH",
        signal: "WATCH",
        timestamp: todayStr,
      });
    }
  }

  // 11. ADX trend confirmation
  const { adx: adxValues } = adx(highs, lows, closes, 14);
  if (adxValues[last] !== null) {
    const adxVal = adxValues[last]!;
    const prevAdx = adxValues[last - 5];
    if (adxVal > 30 && prevAdx !== null && adxVal > prevAdx) {
      events.push({
        type: "technical",
        title: `Strong Trend in Progress (ADX: ${adxVal.toFixed(0)})`,
        description: `ADX at ${adxVal.toFixed(0)} and rising. The current trend has strong momentum. Don't fight the trend.`,
        impact: "MEDIUM",
        signal: closes[last] > closes[last - 5] ? "BULLISH" : "BEARISH",
        timestamp: todayStr,
      });
    }
    if (adxVal < 15) {
      events.push({
        type: "technical",
        title: "No Clear Trend (ADX: " + adxVal.toFixed(0) + ")",
        description: "Market is in a low-momentum, range-bound phase. Trend-following strategies will underperform. Mean reversion preferred.",
        impact: "LOW",
        signal: "NEUTRAL",
        timestamp: todayStr,
      });
    }
  }

  // Sort by impact
  const impactOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  events.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

  return events;
}

export async function GET() {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365);

    const [niftyResult, sensexResult]: [any, any] = await Promise.all([
      yahooFinance.chart("^NSEI", { period1: startDate, period2: endDate, interval: "1d" }),
      yahooFinance.chart("^BSESN", { period1: startDate, period2: endDate, interval: "1d" }),
    ]);

    const toCandles = (result: any): OHLCV[] =>
      (result?.quotes || [])
        .filter((q: any) => q.open && q.high && q.low && q.close && q.volume)
        .map((q: any) => ({ date: new Date(q.date), open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume }));

    const niftyCandles = toCandles(niftyResult);
    const sensexCandles = toCandles(sensexResult);

    if (niftyCandles.length < 50) {
      return NextResponse.json({ error: "Insufficient market data" }, { status: 500 });
    }

    const signals = analyzeIndex(niftyCandles);
    const events = generateMarketEvents(niftyCandles, sensexCandles);

    // Compute overall sentiment
    const bullish = signals.filter(s => s.signal === "BULLISH").length;
    const bearish = signals.filter(s => s.signal === "BEARISH").length;
    const total = signals.length;
    const sentimentScore = total > 0 ? Math.round(((bullish - bearish) / total) * 50 + 50) : 50;

    const last = niftyCandles.length - 1;
    const niftyPrice = niftyCandles[last].close;
    const niftyChange = ((niftyCandles[last].close - niftyCandles[last - 1].close) / niftyCandles[last - 1].close) * 100;

    return NextResponse.json({
      signals,
      events,
      sentiment: {
        score: sentimentScore,
        label: sentimentScore >= 70 ? "Strong Buy" : sentimentScore >= 55 ? "Buy" : sentimentScore >= 45 ? "Neutral" : sentimentScore >= 30 ? "Sell" : "Strong Sell",
        bullish,
        bearish,
        neutral: total - bullish - bearish,
        total,
      },
      market: {
        niftyPrice: niftyPrice.toFixed(2),
        niftyChange: niftyChange.toFixed(2),
        sensexPrice: sensexCandles.length > 0 ? sensexCandles[sensexCandles.length - 1].close.toFixed(2) : null,
        sensexChange: sensexCandles.length > 1 ? (((sensexCandles[sensexCandles.length - 1].close - sensexCandles[sensexCandles.length - 2].close) / sensexCandles[sensexCandles.length - 2].close) * 100).toFixed(2) : null,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch signals" }, { status: 500 });
  }
}
