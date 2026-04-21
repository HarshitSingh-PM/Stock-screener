import {
  OHLCV,
  bollingerBands,
  ema,
  sma,
  rsi,
  macd,
  williamsR,
  supertrend,
  atr,
  volumeOscillator,
  pivotPoints,
  obv,
  adl,
  stochastic,
  adx,
  cci,
  aroon,
  mfi,
  forceIndex,
  roc,
} from "./indicators";

export interface StrategyResult {
  signal: "BUY" | "SELL" | "NEUTRAL";
  strength: number; // 0-100
  details: string;
}

export interface Strategy {
  id: string;
  name: string;
  chapter: string;
  category: "Swing" | "Intraday" | "Advanced" | "Positional" | "Scalping" | "Options" | "Price Action" | "Value Investing" | "Candlestick" | "Trend Following" | "Index Investing";
  description: string;
  indicators: string[];
  book: string;
  evaluate: (candles: OHLCV[]) => StrategyResult;
}

// ─── Helper indicator functions (not in indicators.ts) ───

function parabolicSar(highs: number[], lows: number[], af0 = 0.02, afMax = 0.2): number[] {
  const n = highs.length;
  const sar: number[] = new Array(n).fill(0);
  if (n < 2) return sar;
  let isUpTrend = highs[1] > highs[0];
  let ep = isUpTrend ? highs[0] : lows[0];
  sar[0] = isUpTrend ? lows[0] : highs[0];
  let af = af0;
  for (let i = 1; i < n; i++) {
    sar[i] = sar[i - 1] + af * (ep - sar[i - 1]);
    if (isUpTrend) {
      if (i >= 2) sar[i] = Math.min(sar[i], lows[i - 1], lows[i - 2] ?? lows[i - 1]);
      if (lows[i] < sar[i]) {
        isUpTrend = false;
        sar[i] = ep;
        ep = lows[i];
        af = af0;
      } else {
        if (highs[i] > ep) { ep = highs[i]; af = Math.min(af + af0, afMax); }
      }
    } else {
      if (i >= 2) sar[i] = Math.max(sar[i], highs[i - 1], highs[i - 2] ?? highs[i - 1]);
      if (highs[i] > sar[i]) {
        isUpTrend = true;
        sar[i] = ep;
        ep = highs[i];
        af = af0;
      } else {
        if (lows[i] < ep) { ep = lows[i]; af = Math.min(af + af0, afMax); }
      }
    }
  }
  return sar;
}

function donchianChannel(highs: number[], lows: number[], period: number) {
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  const middle: (number | null)[] = [];
  for (let i = 0; i < highs.length; i++) {
    if (i < period - 1) { upper.push(null); lower.push(null); middle.push(null); continue; }
    const hh = Math.max(...highs.slice(i - period + 1, i + 1));
    const ll = Math.min(...lows.slice(i - period + 1, i + 1));
    upper.push(hh);
    lower.push(ll);
    middle.push((hh + ll) / 2);
  }
  return { upper, lower, middle };
}

function ichimokuCloud(highs: number[], lows: number[], closes: number[]) {
  const n = highs.length;
  const midpoint = (h: number[], l: number[], start: number, period: number) => {
    const hSlice = h.slice(start, start + period);
    const lSlice = l.slice(start, start + period);
    return (Math.max(...hSlice) + Math.min(...lSlice)) / 2;
  };
  const conversion: (number | null)[] = [];
  const base: (number | null)[] = [];
  const spanA: (number | null)[] = [];
  const spanB: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    if (i < 8) { conversion.push(null); } else {
      conversion.push(midpoint(highs, lows, i - 8, 9));
    }
    if (i < 25) { base.push(null); } else {
      base.push(midpoint(highs, lows, i - 25, 26));
    }
    if (conversion[i] !== null && base[i] !== null) {
      spanA.push((conversion[i]! + base[i]!) / 2);
    } else { spanA.push(null); }
    if (i < 51) { spanB.push(null); } else {
      spanB.push(midpoint(highs, lows, i - 51, 52));
    }
  }
  return { conversion, base, spanA, spanB };
}

function stochasticRsi(closes: number[], rsiPeriod = 14, stochPeriod = 14): (number | null)[] {
  const rsiVals = rsi(closes, rsiPeriod);
  const result: (number | null)[] = [];
  for (let i = 0; i < rsiVals.length; i++) {
    if (i < rsiPeriod + stochPeriod - 1 || rsiVals[i] === null) { result.push(null); continue; }
    const slice: number[] = [];
    for (let j = i - stochPeriod + 1; j <= i; j++) {
      if (rsiVals[j] !== null) slice.push(rsiVals[j]!);
    }
    if (slice.length < stochPeriod) { result.push(null); continue; }
    const min = Math.min(...slice);
    const max = Math.max(...slice);
    result.push(max === min ? 50 : ((rsiVals[i]! - min) / (max - min)) * 100);
  }
  return result;
}

function linearRegression(data: number[], period: number): { slope: (number | null)[]; value: (number | null)[] } {
  const slopes: (number | null)[] = [];
  const values: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { slopes.push(null); values.push(null); continue; }
    const slice = data.slice(i - period + 1, i + 1);
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let j = 0; j < period; j++) { sumX += j; sumY += slice[j]; sumXY += j * slice[j]; sumX2 += j * j; }
    const slope = (period * sumXY - sumX * sumY) / (period * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / period;
    slopes.push(slope);
    values.push(intercept + slope * (period - 1));
  }
  return { slope: slopes, value: values };
}

function vwapProxy(candles: OHLCV[]): number[] {
  const result: number[] = [];
  let cumVol = 0;
  let cumTP = 0;
  for (let i = 0; i < candles.length; i++) {
    const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
    cumVol += candles[i].volume;
    cumTP += tp * candles[i].volume;
    result.push(cumVol > 0 ? cumTP / cumVol : tp);
  }
  return result;
}

// ─── Strategy 1.1: Bollinger Bands + 9 EMA ───
function bollingerBandEma(candles: OHLCV[]): StrategyResult {
  if (candles.length < 30) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map((c) => c.close);
  const bb = bollingerBands(closes, 20, 2);
  const ema9 = ema(closes, 9);
  const last = candles.length - 1;
  const price = closes[last];
  const upperBB = bb.upper[last];
  const lowerBB = bb.lower[last];
  const emaVal = ema9[last];
  if (!upperBB || !lowerBB || !emaVal) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const bbWidth = upperBB - lowerBB;
  const distFromLower = ((price - lowerBB) / bbWidth) * 100;
  if (distFromLower < 15 && emaVal < price) {
    return { signal: "BUY", strength: Math.min(90, Math.round(100 - distFromLower * 3)), details: `Price near lower Bollinger Band (${distFromLower.toFixed(1)}% from bottom). 9-EMA confirms upward momentum.` };
  }
  if (distFromLower > 85 && emaVal > price) {
    return { signal: "SELL", strength: Math.min(90, Math.round((distFromLower - 85) * 6)), details: `Price near upper Bollinger Band (${distFromLower.toFixed(1)}% from bottom). 9-EMA confirms downward pressure.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `Price at ${distFromLower.toFixed(1)}% of BB range. No clear signal.` };
}

// ─── Strategy 1.2: Williams %R + MACD Duo ───
function williamsRMacd(candles: OHLCV[]): StrategyResult {
  if (candles.length < 30) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const sma14 = sma(closes, 14);
  const wr = williamsR(highs, lows, closes, 14);
  const macdResult = macd(closes);
  const last = candles.length - 1;
  const wrVal = wr[last]; const wrPrev = wr[last - 1];
  const macdHist = macdResult.histogram[last]; const macdHistPrev = macdResult.histogram[last - 1];
  const smaVal = sma14[last]; const price = closes[last];
  if (wrVal === null || wrPrev === null || macdHist === null || macdHistPrev === null || smaVal === null)
    return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  if (wrPrev < -80 && wrVal > wrPrev && price > smaVal && macdHist > macdHistPrev) {
    return { signal: "BUY", strength: Math.min(85, Math.round(Math.abs(wrVal - wrPrev) * 2)), details: `Williams %R reversing from oversold (${wrVal.toFixed(1)}). MACD histogram rising. Price above 14-SMA.` };
  }
  if (wrPrev > -20 && wrVal < wrPrev && price < smaVal && macdHist < macdHistPrev) {
    return { signal: "SELL", strength: Math.min(85, Math.round(Math.abs(wrPrev - wrVal) * 2)), details: `Williams %R reversing from overbought (${wrVal.toFixed(1)}). MACD histogram falling. Price below 14-SMA.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `Williams %R: ${wrVal?.toFixed(1)}. No clear signal.` };
}

// ─── Strategy 1.3: MACD + Fibonacci Retracement ───
function macdFibonacci(candles: OHLCV[]): StrategyResult {
  if (candles.length < 50) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map((c) => c.close);
  const macdResult = macd(closes, 12, 26, 9);
  const last = candles.length - 1;
  const macdLine = macdResult.macdLine[last]; const signalLine = macdResult.signalLine[last];
  const macdLinePrev = macdResult.macdLine[last - 1]; const signalLinePrev = macdResult.signalLine[last - 1];
  if (!macdLine || !signalLine || !macdLinePrev || !signalLinePrev)
    return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const recentHighs = candles.slice(-50).map((c) => c.high);
  const recentLows = candles.slice(-50).map((c) => c.low);
  const swingHigh = Math.max(...recentHighs);
  const swingLow = Math.min(...recentLows);
  const range = swingHigh - swingLow;
  const price = closes[last];
  const fib236 = swingHigh - range * 0.236;
  const fib382 = swingHigh - range * 0.382;
  const fib500 = swingHigh - range * 0.5;
  const fib618 = swingHigh - range * 0.618;
  const nearFibLevel = [fib236, fib382, fib500, fib618].some((level) => Math.abs(price - level) / price < 0.015);
  if (macdLinePrev < signalLinePrev && macdLine > signalLine && nearFibLevel && price < swingHigh * 0.95) {
    return { signal: "BUY", strength: 75, details: `MACD bullish crossover at Fibonacci level. Price near key retracement support.` };
  }
  if (macdLinePrev > signalLinePrev && macdLine < signalLine && nearFibLevel && price > swingLow * 1.05) {
    return { signal: "SELL", strength: 75, details: `MACD bearish crossover at Fibonacci resistance level.` };
  }
  if (macdLinePrev < signalLinePrev && macdLine > signalLine) {
    return { signal: "BUY", strength: 50, details: `MACD bullish crossover detected.` };
  }
  if (macdLinePrev > signalLinePrev && macdLine < signalLine) {
    return { signal: "SELL", strength: 50, details: `MACD bearish crossover detected.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: "No MACD crossover at Fibonacci levels." };
}

// ─── Strategy 1.4: Riding a Breakout (Triangle) ───
function triangleBreakout(candles: OHLCV[]): StrategyResult {
  if (candles.length < 30) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const last = candles.length - 1;
  const lookback = candles.slice(-20);
  // Detect narrowing range (triangle): compare first half range vs second half range
  const firstHalf = lookback.slice(0, 10);
  const secondHalf = lookback.slice(10);
  const firstRange = Math.max(...firstHalf.map(c => c.high)) - Math.min(...firstHalf.map(c => c.low));
  const secondRange = Math.max(...secondHalf.map(c => c.high)) - Math.min(...secondHalf.map(c => c.low));
  const isNarrowing = secondRange < firstRange * 0.7;
  if (!isNarrowing) return { signal: "NEUTRAL", strength: 0, details: "No triangle pattern detected. Range not narrowing." };
  const consolidationHigh = Math.max(...secondHalf.map(c => c.high));
  const consolidationLow = Math.min(...secondHalf.map(c => c.low));
  const price = candles[last].close;
  const vol = candles[last].volume;
  const avgVol = lookback.reduce((s, c) => s + c.volume, 0) / lookback.length;
  const volumeSurge = vol > avgVol * 1.3;
  if (price > consolidationHigh && volumeSurge) {
    return { signal: "BUY", strength: 80, details: `Triangle breakout upward. Price broke above ${consolidationHigh.toFixed(2)} with volume surge (${(vol / avgVol * 100).toFixed(0)}% of avg).` };
  }
  if (price < consolidationLow && volumeSurge) {
    return { signal: "SELL", strength: 80, details: `Triangle breakdown. Price broke below ${consolidationLow.toFixed(2)} with volume surge.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `Triangle forming (range narrowing ${((1 - secondRange / firstRange) * 100).toFixed(0)}%). Awaiting breakout.` };
}

// ─── Strategy 1.5: Swing Trading with Institutional Moves ───
function institutionalMoves(candles: OHLCV[]): StrategyResult {
  if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const last = candles.length - 1;
  // Detect gap up/down in recent history
  for (let i = Math.max(1, last - 10); i <= last - 2; i++) {
    const gapUp = candles[i].low > candles[i - 1].high;
    const gapDown = candles[i].high < candles[i - 1].low;
    if (gapUp) {
      const gapZoneHigh = candles[i].low;
      const gapZoneLow = candles[i - 1].high;
      const price = candles[last].close;
      if (price >= gapZoneLow && price <= gapZoneHigh * 1.01 && candles[last].close > candles[last].open) {
        return { signal: "BUY", strength: 75, details: `Price retraced to gap-up demand zone (${gapZoneLow.toFixed(2)}-${gapZoneHigh.toFixed(2)}). Bullish candle forming.` };
      }
    }
    if (gapDown) {
      const gapZoneHigh = candles[i - 1].low;
      const gapZoneLow = candles[i].high;
      const price = candles[last].close;
      if (price >= gapZoneLow * 0.99 && price <= gapZoneHigh && candles[last].close < candles[last].open) {
        return { signal: "SELL", strength: 75, details: `Price retraced to gap-down supply zone (${gapZoneLow.toFixed(2)}-${gapZoneHigh.toFixed(2)}). Bearish candle forming.` };
      }
    }
  }
  return { signal: "NEUTRAL", strength: 0, details: "No institutional gap pattern detected." };
}

// ─── Strategy 1.6: BB Width Breakout ───
function bbWidthBreakout(candles: OHLCV[]): StrategyResult {
  if (candles.length < 30) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map((c) => c.close);
  const bb = bollingerBands(closes, 20, 2);
  const last = candles.length - 1;
  const price = closes[last];
  const upper = bb.upper[last]; const lower = bb.lower[last]; const middle = bb.middle[last];
  if (!upper || !lower || !middle) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const widths: number[] = [];
  for (let i = Math.max(0, last - 20); i <= last; i++) {
    if (bb.upper[i] && bb.lower[i] && bb.middle[i]) widths.push((bb.upper[i]! - bb.lower[i]!) / bb.middle[i]!);
  }
  const currentWidth = (upper - lower) / middle;
  const avgWidth = widths.reduce((a, b) => a + b, 0) / widths.length;
  if (currentWidth < avgWidth * 0.8) {
    if (price > middle) return { signal: "BUY", strength: 65, details: `Bollinger Band squeeze (width: ${(currentWidth * 100).toFixed(2)}%). Price above middle band - potential upside breakout.` };
    return { signal: "SELL", strength: 65, details: `Bollinger Band squeeze (width: ${(currentWidth * 100).toFixed(2)}%). Price below middle band - potential downside breakout.` };
  }
  if (price > upper && currentWidth > avgWidth * 1.2) {
    return { signal: "BUY", strength: 80, details: `Price breaking above upper Bollinger Band with expanding width. Strong breakout.` };
  }
  if (price < lower && currentWidth > avgWidth * 1.2) {
    return { signal: "SELL", strength: 80, details: `Price breaking below lower Bollinger Band with expanding width. Strong breakdown.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `BB Width: ${(currentWidth * 100).toFixed(2)}%. No squeeze or breakout.` };
}

// ─── Strategy 1.7: Ichimoku Cloud ───
function ichimokuCloudStrategy(candles: OHLCV[]): StrategyResult {
  if (candles.length < 55) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const ich = ichimokuCloud(highs, lows, closes);
  const last = candles.length - 1;
  const conv = ich.conversion[last]; const base2 = ich.base[last];
  const sA = ich.spanA[last]; const sB = ich.spanB[last];
  const price = closes[last];
  if (conv === null || base2 === null || sA === null || sB === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const cloudTop = Math.max(sA, sB);
  const cloudBottom = Math.min(sA, sB);
  if (conv > base2 && price > cloudTop) {
    return { signal: "BUY", strength: 80, details: `Ichimoku bullish: Conversion (${conv.toFixed(2)}) above Base (${base2.toFixed(2)}), price above cloud (${cloudTop.toFixed(2)}).` };
  }
  if (conv < base2 && price < cloudBottom) {
    return { signal: "SELL", strength: 80, details: `Ichimoku bearish: Conversion below Base, price below cloud (${cloudBottom.toFixed(2)}).` };
  }
  if (price > cloudBottom && price < cloudTop) {
    return { signal: "NEUTRAL", strength: 30, details: `Price inside Ichimoku cloud. Indecision zone.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `Ichimoku mixed signals. Conv: ${conv.toFixed(2)}, Base: ${base2.toFixed(2)}.` };
}

// ─── Strategy 2.1: Moving Average + Fibonacci ───
function maFibonacci(candles: OHLCV[]): StrategyResult {
  if (candles.length < 200) return { signal: "NEUTRAL", strength: 0, details: "Not enough data (need 200+ candles)" };
  const closes = candles.map(c => c.close);
  const sma200 = sma(closes, 200);
  const last = candles.length - 1;
  const price = closes[last];
  const smaVal = sma200[last];
  if (smaVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const recent = candles.slice(-50);
  const swingHigh = Math.max(...recent.map(c => c.high));
  const swingLow = Math.min(...recent.map(c => c.low));
  const range = swingHigh - swingLow;
  const fib382 = swingHigh - range * 0.382;
  const fib500 = swingHigh - range * 0.5;
  const fib618 = swingHigh - range * 0.618;
  const nearFib = [fib382, fib500, fib618].some(l => Math.abs(price - l) / price < 0.015);
  if (price > smaVal && nearFib && price < swingHigh * 0.95) {
    return { signal: "BUY", strength: 70, details: `Price above 200-SMA (uptrend) and pulling back to Fibonacci support level. Buy on retracement.` };
  }
  if (price < smaVal && nearFib && price > swingLow * 1.05) {
    return { signal: "SELL", strength: 70, details: `Price below 200-SMA (downtrend) and rallying to Fibonacci resistance. Sell on retracement.` };
  }
  if (price > smaVal) return { signal: "BUY", strength: 40, details: `Price above 200-SMA. Uptrend intact but not at Fibonacci level.` };
  return { signal: "SELL", strength: 40, details: `Price below 200-SMA. Downtrend intact.` };
}

// ─── Strategy 2.2: Supertrend + Pivot Points ───
function supertrendPivot(candles: OHLCV[]): StrategyResult {
  if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const st = supertrend(highs, lows, closes, 10, 3);
  const last = candles.length - 1;
  const prev = last - 1;
  const pp = pivotPoints(highs[prev], lows[prev], closes[prev]);
  const price = closes[last];
  const stDir = st.direction[last];
  if (stDir === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  if (price > pp.r1 && stDir === 1) {
    return { signal: "BUY", strength: 80, details: `Price above R1 (${pp.r1.toFixed(2)}) + Supertrend bullish. Strong upward momentum.` };
  }
  if (price < pp.s1 && stDir === -1) {
    return { signal: "SELL", strength: 80, details: `Price below S1 (${pp.s1.toFixed(2)}) + Supertrend bearish. Strong downward pressure.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `Price: ${price.toFixed(2)}, Pivot: ${pp.pivot.toFixed(2)}, ST: ${stDir === 1 ? "Bullish" : "Bearish"}` };
}

// ─── Strategy 2.3: VWAP + Standard Deviations ───
function vwapStrategy(candles: OHLCV[]): StrategyResult {
  if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const last = candles.length - 1;
  const recentCandles = candles.slice(-20);
  const vwap = vwapProxy(recentCandles);
  const vwapVal = vwap[vwap.length - 1];
  const price = candles[last].close;
  const deviation = ((price - vwapVal) / vwapVal) * 100;
  if (deviation < -1.5) {
    return { signal: "BUY", strength: Math.min(80, Math.round(Math.abs(deviation) * 15)), details: `Price ${Math.abs(deviation).toFixed(2)}% below VWAP (${vwapVal.toFixed(2)}). Undervalued.` };
  }
  if (deviation > 1.5) {
    return { signal: "SELL", strength: Math.min(80, Math.round(deviation * 15)), details: `Price ${deviation.toFixed(2)}% above VWAP (${vwapVal.toFixed(2)}). Overvalued.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `Price near VWAP (deviation: ${deviation.toFixed(2)}%).` };
}

// ─── Strategy 2.4: RSI + Volume Oscillator ───
function rsiVolumeOscillator(candles: OHLCV[]): StrategyResult {
  if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const rsiValues = rsi(closes, 14);
  const voValues = volumeOscillator(volumes, 5, 10);
  const last = candles.length - 1;
  const rsiVal = rsiValues[last]; const voVal = voValues[last];
  if (rsiVal === null || voVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  if (rsiVal < 35 && voVal < -15) {
    return { signal: "BUY", strength: Math.min(85, Math.round((35 - rsiVal) * 3 + Math.abs(voVal))), details: `RSI oversold (${rsiVal.toFixed(1)}) + Volume Oscillator bearish (${voVal.toFixed(1)}%). Potential reversal.` };
  }
  if (rsiVal > 65 && voVal > 15) {
    return { signal: "SELL", strength: Math.min(85, Math.round((rsiVal - 65) * 3 + voVal)), details: `RSI overbought (${rsiVal.toFixed(1)}) + Volume Oscillator bullish (${voVal.toFixed(1)}%). Potential pullback.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `RSI: ${rsiVal.toFixed(1)}, Vol Osc: ${voVal.toFixed(1)}%. No extreme.` };
}

// ─── Strategy 2.5: Wait and Trade the Pullback ───
function waitTradePullback(candles: OHLCV[]): StrategyResult {
  if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const ema20 = ema(closes, 20);
  const last = candles.length - 1;
  const prev = last - 1;
  const pp = pivotPoints(candles[prev].high, candles[prev].low, candles[prev].close);
  const price = closes[last];
  const emaVal = ema20[last];
  if (emaVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const uptrend = price > emaVal;
  const downtrend = price < emaVal;
  const bullish = candles[last].close > candles[last].open;
  const bearish = candles[last].close < candles[last].open;
  const nearS1 = Math.abs(price - pp.s1) / price < 0.015;
  const nearR1 = Math.abs(price - pp.r1) / price < 0.015;
  const nearR2 = Math.abs(price - pp.r2) / price < 0.015;
  if (uptrend && nearS1 && bullish) {
    return { signal: "BUY", strength: 75, details: `Uptrend pullback to S1 (${pp.s1.toFixed(2)}). Bullish candle at support. Buy the pullback.` };
  }
  if (downtrend && (nearR1 || nearR2) && bearish) {
    return { signal: "SELL", strength: 75, details: `Downtrend rally to R1/R2. Bearish candle at resistance. Sell the pullback.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `No pullback pattern at pivot levels.` };
}

// ─── Strategy 2.6: Double RSI ───
function doubleRsi(candles: OHLCV[]): StrategyResult {
  if (candles.length < 65) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const rsi5 = rsi(closes, 5);
  const rsi60 = rsi(closes, 60);
  const last = candles.length - 1;
  const rsi5Val = rsi5[last]; const rsi60Val = rsi60[last];
  if (rsi5Val === null || rsi60Val === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  if (rsi5Val < 30 && rsi60Val < 40) {
    return { signal: "BUY", strength: Math.min(90, Math.round((30 - rsi5Val) * 2 + (40 - rsi60Val) * 2)), details: `Double RSI oversold: RSI(5)=${rsi5Val.toFixed(1)}, RSI(60)=${rsi60Val.toFixed(1)}. Strong buy confluence.` };
  }
  if (rsi5Val > 70 && rsi60Val > 60) {
    return { signal: "SELL", strength: Math.min(90, Math.round((rsi5Val - 70) * 2 + (rsi60Val - 60) * 2)), details: `Double RSI overbought: RSI(5)=${rsi5Val.toFixed(1)}, RSI(60)=${rsi60Val.toFixed(1)}. Strong sell confluence.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `RSI(5): ${rsi5Val.toFixed(1)}, RSI(60): ${rsi60Val.toFixed(1)}. No confluence.` };
}

// ─── Strategy 2.7: CPR with Trend Following ───
function cprTrendFollowing(candles: OHLCV[]): StrategyResult {
  if (candles.length < 5) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const last = candles.length - 1;
  const prev = candles[last - 1];
  const pivot = (prev.high + prev.low + prev.close) / 3;
  const bc = (prev.high + prev.low) / 2;
  const tc = (pivot - bc) + pivot;
  const price = candles[last].close;
  const cprWidth = Math.abs(tc - bc);
  const avgRange = candles.slice(-10).reduce((s, c) => s + (c.high - c.low), 0) / 10;
  const narrowCpr = cprWidth < avgRange * 0.3;
  if (narrowCpr) {
    if (price > tc) return { signal: "BUY", strength: 75, details: `Narrow CPR (trending day). Price broke above TC (${tc.toFixed(2)}). Bullish breakout.` };
    if (price < bc) return { signal: "SELL", strength: 75, details: `Narrow CPR (trending day). Price broke below BC (${bc.toFixed(2)}). Bearish breakdown.` };
    return { signal: "NEUTRAL", strength: 30, details: `Narrow CPR. Price between TC and BC. Awaiting breakout.` };
  }
  // Wide CPR = range bound
  if (price <= bc) return { signal: "BUY", strength: 55, details: `Wide CPR (range-bound). Price at BC support (${bc.toFixed(2)}). Buy at support.` };
  if (price >= tc) return { signal: "SELL", strength: 55, details: `Wide CPR (range-bound). Price at TC resistance (${tc.toFixed(2)}). Sell at resistance.` };
  return { signal: "NEUTRAL", strength: 0, details: `Price within wide CPR range. No clear signal.` };
}

// ─── Strategy 3.1: Dow Theory (Higher Highs/Lows) ───
function dowTheory(candles: OHLCV[]): StrategyResult {
  if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const recent = candles.slice(-20);
  // Find swing points (local highs and lows using 2-bar pivots)
  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  for (let i = 2; i < recent.length - 2; i++) {
    if (recent[i].high > recent[i - 1].high && recent[i].high > recent[i - 2].high &&
        recent[i].high > recent[i + 1].high && recent[i].high > recent[i + 2].high) {
      swingHighs.push(recent[i].high);
    }
    if (recent[i].low < recent[i - 1].low && recent[i].low < recent[i - 2].low &&
        recent[i].low < recent[i + 1].low && recent[i].low < recent[i + 2].low) {
      swingLows.push(recent[i].low);
    }
  }
  if (swingHighs.length < 2 || swingLows.length < 2) return { signal: "NEUTRAL", strength: 0, details: "Not enough swing points to determine trend." };
  const higherHighs = swingHighs[swingHighs.length - 1] > swingHighs[swingHighs.length - 2];
  const higherLows = swingLows[swingLows.length - 1] > swingLows[swingLows.length - 2];
  const lowerHighs = swingHighs[swingHighs.length - 1] < swingHighs[swingHighs.length - 2];
  const lowerLows = swingLows[swingLows.length - 1] < swingLows[swingLows.length - 2];
  if (higherHighs && higherLows) {
    return { signal: "BUY", strength: 75, details: `Dow Theory uptrend: Higher highs and higher lows confirmed.` };
  }
  if (lowerHighs && lowerLows) {
    return { signal: "SELL", strength: 75, details: `Dow Theory downtrend: Lower highs and lower lows confirmed.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `Mixed swing points. No clear Dow Theory trend.` };
}

// ─── Strategy 3.2: Smart Money Concept ───
function smartMoneyConcept(candles: OHLCV[]): StrategyResult {
  if (candles.length < 30) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const last = candles.length - 1;
  const recent = candles.slice(-20);
  // Find recent swing low (potential order block after aggressive selling)
  let lowestIdx = 0;
  for (let i = 1; i < recent.length - 3; i++) {
    if (recent[i].low < recent[lowestIdx].low) lowestIdx = i;
  }
  // Check for Break of Structure (BoS) upward after the low
  let bosUp = false;
  const prevSwingHigh = Math.max(...recent.slice(0, lowestIdx + 1).map(c => c.high));
  for (let i = lowestIdx + 1; i < recent.length; i++) {
    if (recent[i].high > prevSwingHigh) { bosUp = true; break; }
  }
  // Check for BoS downward
  let highestIdx = 0;
  for (let i = 1; i < recent.length - 3; i++) {
    if (recent[i].high > recent[highestIdx].high) highestIdx = i;
  }
  let bosDown = false;
  const prevSwingLow = Math.min(...recent.slice(0, highestIdx + 1).map(c => c.low));
  for (let i = highestIdx + 1; i < recent.length; i++) {
    if (recent[i].low < prevSwingLow) { bosDown = true; break; }
  }
  const price = candles[last].close;
  const orderBlockZoneUp = recent[lowestIdx].high;
  const orderBlockZoneDown = recent[highestIdx].low;
  if (bosUp && Math.abs(price - orderBlockZoneUp) / price < 0.02 && candles[last].close > candles[last].open) {
    return { signal: "BUY", strength: 75, details: `Smart Money: Bullish BoS detected. Price retracing to order block zone (${orderBlockZoneUp.toFixed(2)}). Bullish candle.` };
  }
  if (bosDown && Math.abs(price - orderBlockZoneDown) / price < 0.02 && candles[last].close < candles[last].open) {
    return { signal: "SELL", strength: 75, details: `Smart Money: Bearish BoS detected. Price at supply zone (${orderBlockZoneDown.toFixed(2)}). Bearish candle.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: "No Smart Money pattern detected." };
}

// ─── Strategy 3.3: Elliott Wave Theory (Simplified) ───
function elliottWave(candles: OHLCV[]): StrategyResult {
  if (candles.length < 50) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const recent = candles.slice(-40);
  // Find potential wave 1: first strong move up from a low
  let wave1Low = recent[0].low, wave1LowIdx = 0;
  for (let i = 1; i < 15; i++) {
    if (recent[i].low < wave1Low) { wave1Low = recent[i].low; wave1LowIdx = i; }
  }
  let wave1High = recent[wave1LowIdx].high, wave1HighIdx = wave1LowIdx;
  for (let i = wave1LowIdx + 1; i < Math.min(wave1LowIdx + 15, recent.length); i++) {
    if (recent[i].high > wave1High) { wave1High = recent[i].high; wave1HighIdx = i; }
  }
  const wave1Range = wave1High - wave1Low;
  if (wave1Range <= 0) return { signal: "NEUTRAL", strength: 0, details: "No wave pattern detected." };
  // Wave 2: retracement of 38.2%-61.8% of wave 1
  let wave2Low = wave1High, wave2LowIdx = wave1HighIdx;
  for (let i = wave1HighIdx + 1; i < Math.min(wave1HighIdx + 10, recent.length); i++) {
    if (recent[i].low < wave2Low) { wave2Low = recent[i].low; wave2LowIdx = i; }
  }
  const retrace = (wave1High - wave2Low) / wave1Range;
  const price = recent[recent.length - 1].close;
  if (retrace >= 0.382 && retrace <= 0.618 && wave2LowIdx < recent.length - 2) {
    // Check if wave 3 is starting (price moving up from wave 2 low)
    if (price > wave2Low && price < wave1High * 1.5) {
      return { signal: "BUY", strength: 70, details: `Elliott Wave: Wave 2 retraced ${(retrace * 100).toFixed(1)}% of Wave 1. Wave 3 potentially starting. Price: ${price.toFixed(2)}.` };
    }
  }
  return { signal: "NEUTRAL", strength: 0, details: `Elliott Wave pattern not clearly formed. Retracement: ${(retrace * 100).toFixed(1)}%.` };
}

// ─── Strategy 3.4: Fractal Trading ───
function fractalTrading(candles: OHLCV[]): StrategyResult {
  if (candles.length < 55) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const sma50 = sma(closes, 50);
  const last = candles.length - 1;
  const smaVal = sma50[last];
  if (smaVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  // Williams Fractals: high is highest among 4 candles on each side
  let fractalHigh: number | null = null;
  let fractalLow: number | null = null;
  for (let i = last - 4; i >= 4; i--) {
    const isHigh = candles[i].high > candles[i - 1].high && candles[i].high > candles[i - 2].high &&
                   candles[i].high > candles[i - 3].high && candles[i].high > candles[i - 4].high &&
                   candles[i].high > candles[i + 1].high && candles[i].high > candles[i + 2].high &&
                   candles[i].high > candles[i + 3].high && candles[i].high > candles[i + 4].high;
    if (isHigh && fractalHigh === null) fractalHigh = candles[i].high;
    const isLow = candles[i].low < candles[i - 1].low && candles[i].low < candles[i - 2].low &&
                  candles[i].low < candles[i - 3].low && candles[i].low < candles[i - 4].low &&
                  candles[i].low < candles[i + 1].low && candles[i].low < candles[i + 2].low &&
                  candles[i].low < candles[i + 3].low && candles[i].low < candles[i + 4].low;
    if (isLow && fractalLow === null) fractalLow = candles[i].low;
    if (fractalHigh !== null && fractalLow !== null) break;
  }
  const price = closes[last];
  if (fractalHigh !== null && price > fractalHigh && price > smaVal) {
    return { signal: "BUY", strength: 75, details: `Price broke above fractal high (${fractalHigh.toFixed(2)}) + above 50-SMA (${smaVal.toFixed(2)}). Bullish fractal breakout.` };
  }
  if (fractalLow !== null && price < fractalLow && price < smaVal) {
    return { signal: "SELL", strength: 75, details: `Price broke below fractal low (${fractalLow.toFixed(2)}) + below 50-SMA. Bearish fractal breakdown.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `No fractal breakout. Fractal High: ${fractalHigh?.toFixed(2) ?? "N/A"}, Low: ${fractalLow?.toFixed(2) ?? "N/A"}.` };
}

// ─── Strategy 3.5: Renko + RSI + Stochastic RSI ───
function renkoRsiStochastic(candles: OHLCV[]): StrategyResult {
  if (candles.length < 30) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const rsiValues = rsi(closes, 14);
  const stochRsi = stochasticRsi(closes, 14, 14);
  const last = candles.length - 1;
  const rsiVal = rsiValues[last];
  const stochVal = stochRsi[last];
  if (rsiVal === null || stochVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const rsiPrev = rsiValues[last - 1];
  // Buy: RSI near support (30-40), stochastic RSI low, RSI rising
  if (rsiVal >= 30 && rsiVal <= 45 && stochVal < 30 && rsiPrev !== null && rsiVal > rsiPrev) {
    return { signal: "BUY", strength: 70, details: `RSI at support (${rsiVal.toFixed(1)}) + Stochastic RSI oversold (${stochVal.toFixed(1)}). RSI momentum rising.` };
  }
  if (rsiVal >= 55 && rsiVal <= 70 && stochVal > 70 && rsiPrev !== null && rsiVal < rsiPrev) {
    return { signal: "SELL", strength: 70, details: `RSI at resistance (${rsiVal.toFixed(1)}) + Stochastic RSI overbought (${stochVal.toFixed(1)}). RSI momentum falling.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `RSI: ${rsiVal.toFixed(1)}, Stoch RSI: ${stochVal.toFixed(1)}. No confluence.` };
}

// ─── Strategy 3.6: Donchian Channel Pullback ───
function donchianPullback(candles: OHLCV[]): StrategyResult {
  if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const dc = donchianChannel(highs, lows, 20);
  const last = candles.length - 1;
  const upper = dc.upper[last]; const lower = dc.lower[last]; const mid = dc.middle[last];
  if (upper === null || lower === null || mid === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const price = candles[last].close;
  // Check if price recently touched upper band, pulled back to middle, now rising
  let touchedUpper = false, touchedLower = false;
  for (let i = last - 5; i < last; i++) {
    if (dc.upper[i] !== null && candles[i].high >= dc.upper[i]! * 0.99) touchedUpper = true;
    if (dc.lower[i] !== null && candles[i].low <= dc.lower[i]! * 1.01) touchedLower = true;
  }
  const nearMiddle = Math.abs(price - mid) / price < 0.015;
  if (touchedUpper && nearMiddle && candles[last].close > candles[last].open) {
    return { signal: "BUY", strength: 70, details: `Donchian pullback: Touched upper (${upper.toFixed(2)}), pulled back to middle (${mid.toFixed(2)}). Bullish candle. Buy the pullback.` };
  }
  if (touchedLower && nearMiddle && candles[last].close < candles[last].open) {
    return { signal: "SELL", strength: 70, details: `Donchian pullback: Touched lower (${lower.toFixed(2)}), bounced to middle (${mid.toFixed(2)}). Bearish candle. Sell the pullback.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `Price: ${price.toFixed(2)}, Donchian: [${lower.toFixed(2)}, ${mid.toFixed(2)}, ${upper.toFixed(2)}]. No pullback pattern.` };
}

// ─── Strategy 3.7: Gann Fan + Linear Regression ───
function gannLinearRegression(candles: OHLCV[]): StrategyResult {
  if (candles.length < 30) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const lr = linearRegression(closes, 20);
  const last = candles.length - 1;
  const lrVal = lr.value[last];
  const lrSlope = lr.slope[last];
  if (lrVal === null || lrSlope === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const price = closes[last];
  const slopePercent = (lrSlope / price) * 100;
  if (price > lrVal && lrSlope > 0) {
    return { signal: "BUY", strength: Math.min(80, Math.round(slopePercent * 100 + 40)), details: `Price above linear regression line (${lrVal.toFixed(2)}). Uptrend slope: ${slopePercent.toFixed(3)}%/bar.` };
  }
  if (price < lrVal && lrSlope < 0) {
    return { signal: "SELL", strength: Math.min(80, Math.round(Math.abs(slopePercent) * 100 + 40)), details: `Price below linear regression line (${lrVal.toFixed(2)}). Downtrend slope: ${slopePercent.toFixed(3)}%/bar.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `Mixed: Price ${price > lrVal ? "above" : "below"} LR (${lrVal.toFixed(2)}), slope: ${slopePercent.toFixed(3)}%/bar.` };
}

// ─── Strategy 4.1: Moving with Macro Trends (Pivots) ───
function macroTrendPivots(candles: OHLCV[]): StrategyResult {
  if (candles.length < 5) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const last = candles.length - 1;
  const prev = last - 1;
  const pp = pivotPoints(candles[prev].high, candles[prev].low, candles[prev].close);
  const price = candles[last].close;
  const nearS1 = Math.abs(price - pp.s1) / price < 0.01;
  const nearS2 = Math.abs(price - pp.s2) / price < 0.01;
  const bullishCandle = candles[last].close > candles[last].open;
  if ((nearS1 || nearS2) && bullishCandle) {
    return { signal: "BUY", strength: 70, details: `Price near pivot support (S1: ${pp.s1.toFixed(2)}, S2: ${pp.s2.toFixed(2)}). Bullish candle forming.` };
  }
  const nearR1 = Math.abs(price - pp.r1) / price < 0.01;
  const nearR2 = Math.abs(price - pp.r2) / price < 0.01;
  const bearishCandle = candles[last].close < candles[last].open;
  if ((nearR1 || nearR2) && bearishCandle) {
    return { signal: "SELL", strength: 70, details: `Price near pivot resistance (R1: ${pp.r1.toFixed(2)}, R2: ${pp.r2.toFixed(2)}). Bearish candle forming.` };
  }
  if (price > pp.r1) return { signal: "BUY", strength: 45, details: `Price (${price.toFixed(2)}) above R1 (${pp.r1.toFixed(2)}). Bullish bias.` };
  if (price < pp.s1) return { signal: "SELL", strength: 45, details: `Price (${price.toFixed(2)}) below S1 (${pp.s1.toFixed(2)}). Bearish bias.` };
  return { signal: "NEUTRAL", strength: 0, details: `Price (${price.toFixed(2)}) between S1 and R1.` };
}

// ─── Strategy 4.2: Supertrend + RSI (Positional) ───
function supertrendRsiPositional(candles: OHLCV[]): StrategyResult {
  if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const rsiValues = rsi(closes, 14);
  const st = supertrend(highs, lows, closes, 10, 3);
  const last = candles.length - 1;
  const rsiVal = rsiValues[last]; const stDir = st.direction[last]; const stVal = st.supertrend[last];
  if (rsiVal === null || stDir === null || stVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  if (rsiVal > 60 && stDir === 1) {
    return { signal: "BUY", strength: Math.min(90, Math.round(rsiVal - 40)), details: `Bullish: RSI ${rsiVal.toFixed(1)} (above 60) + Supertrend bullish at ${stVal.toFixed(2)}.` };
  }
  if (rsiVal < 40 && stDir === -1) {
    return { signal: "SELL", strength: Math.min(90, Math.round(60 - rsiVal)), details: `Bearish: RSI ${rsiVal.toFixed(1)} (below 40) + Supertrend bearish at ${stVal.toFixed(2)}.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `RSI: ${rsiVal.toFixed(1)} (sideways zone 40-60), Supertrend: ${stDir === 1 ? "Bullish" : "Bearish"}.` };
}

// ─── Strategy 4.3: Sectoral Analysis ───
function sectoralAnalysis(candles: OHLCV[]): StrategyResult {
  if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const last = candles.length - 1;
  // Relative strength: compare stock's recent performance vs overall (use own moving average as proxy)
  const closes = candles.map(c => c.close);
  const sma20 = sma(closes, 20);
  const smaVal = sma20[last];
  if (smaVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const price = closes[last];
  const pctChange5 = ((closes[last] - closes[last - 5]) / closes[last - 5]) * 100;
  const pctChange20 = ((closes[last] - closes[last - 20]) / closes[last - 20]) * 100;
  // Outperforming: recent short-term performance > longer-term performance
  const relativeStrength = pctChange5 - (pctChange20 / 4); // normalized
  if (relativeStrength > 2 && price > smaVal) {
    return { signal: "BUY", strength: Math.min(80, Math.round(40 + relativeStrength * 5)), details: `Outperforming: 5-day change ${pctChange5.toFixed(2)}% vs normalized 20-day ${(pctChange20 / 4).toFixed(2)}%. Relative strength: ${relativeStrength.toFixed(2)}%.` };
  }
  if (relativeStrength < -2 && price < smaVal) {
    return { signal: "SELL", strength: Math.min(80, Math.round(40 + Math.abs(relativeStrength) * 5)), details: `Underperforming: 5-day change ${pctChange5.toFixed(2)}%. Relative weakness: ${relativeStrength.toFixed(2)}%.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `Relative strength: ${relativeStrength.toFixed(2)}%. No clear outperformance.` };
}

// ─── Strategy 4.4: M&W RSI Pattern ───
function mwRsiPattern(candles: OHLCV[]): StrategyResult {
  if (candles.length < 30) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const rsiValues = rsi(closes, 14);
  const last = candles.length - 1;
  // Look for W pattern in RSI (bullish)
  const rsiSlice: number[] = [];
  for (let i = last - 20; i <= last; i++) {
    if (rsiValues[i] !== null) rsiSlice.push(rsiValues[i]!);
  }
  if (rsiSlice.length < 15) return { signal: "NEUTRAL", strength: 0, details: "Insufficient RSI data" };
  // W pattern: two dips below 30 with a bounce in between
  let firstDipBelow30 = -1, bounceAbove30 = -1, secondDipNear30 = -1;
  for (let i = 0; i < rsiSlice.length; i++) {
    if (firstDipBelow30 === -1 && rsiSlice[i] < 30) firstDipBelow30 = i;
    else if (firstDipBelow30 !== -1 && bounceAbove30 === -1 && rsiSlice[i] > 35) bounceAbove30 = i;
    else if (bounceAbove30 !== -1 && secondDipNear30 === -1 && rsiSlice[i] < 35) secondDipNear30 = i;
  }
  if (firstDipBelow30 !== -1 && bounceAbove30 !== -1 && secondDipNear30 !== -1 && rsiSlice[rsiSlice.length - 1] > 35) {
    return { signal: "BUY", strength: 75, details: `RSI W-pattern detected: Double bottom near oversold zone. RSI now recovering above 35. Bullish reversal.` };
  }
  // M pattern: two peaks above 70 with a dip in between
  let firstPeakAbove70 = -1, dipBelow65 = -1, secondPeakNear70 = -1;
  for (let i = 0; i < rsiSlice.length; i++) {
    if (firstPeakAbove70 === -1 && rsiSlice[i] > 70) firstPeakAbove70 = i;
    else if (firstPeakAbove70 !== -1 && dipBelow65 === -1 && rsiSlice[i] < 65) dipBelow65 = i;
    else if (dipBelow65 !== -1 && secondPeakNear70 === -1 && rsiSlice[i] > 65) secondPeakNear70 = i;
  }
  if (firstPeakAbove70 !== -1 && dipBelow65 !== -1 && secondPeakNear70 !== -1 && rsiSlice[rsiSlice.length - 1] < 65) {
    return { signal: "SELL", strength: 75, details: `RSI M-pattern detected: Double top near overbought zone. RSI now falling below 65. Bearish reversal.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `No M or W RSI pattern detected. Current RSI: ${rsiSlice[rsiSlice.length - 1]?.toFixed(1)}.` };
}

// ─── Strategy 5.1: Parabolic SAR + RSI + Heiken Ashi ───
function parabolicSarRsi(candles: OHLCV[]): StrategyResult {
  if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const sar = parabolicSar(highs, lows);
  const rsiValues = rsi(closes, 14);
  const last = candles.length - 1;
  const sarVal = sar[last];
  const rsiVal = rsiValues[last];
  const price = closes[last];
  const bullishCandle = candles[last].close > candles[last].open;
  const bearishCandle = candles[last].close < candles[last].open;
  if (rsiVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  if (sarVal < price && rsiVal > 50 && bullishCandle) {
    return { signal: "BUY", strength: Math.min(80, Math.round(rsiVal - 30)), details: `Parabolic SAR below price (${sarVal.toFixed(2)}) + RSI ${rsiVal.toFixed(1)} > 50 + bullish candle. Buy signal.` };
  }
  if (sarVal > price && rsiVal < 50 && bearishCandle) {
    return { signal: "SELL", strength: Math.min(80, Math.round(70 - rsiVal)), details: `Parabolic SAR above price (${sarVal.toFixed(2)}) + RSI ${rsiVal.toFixed(1)} < 50 + bearish candle. Sell signal.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `SAR: ${sarVal.toFixed(2)}, RSI: ${rsiVal.toFixed(1)}. No confluence.` };
}

// ─── Strategy 5.2: RSI Divergence + Bollinger Bands ───
function rsiDivergenceBb(candles: OHLCV[]): StrategyResult {
  if (candles.length < 30) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const rsiValues = rsi(closes, 14);
  const bb = bollingerBands(closes, 20, 2);
  const last = candles.length - 1;
  const rsiVal = rsiValues[last];
  const upper = bb.upper[last]; const lower = bb.lower[last];
  if (rsiVal === null || upper === null || lower === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const price = closes[last];
  // Check for bullish divergence: price lower low, RSI higher low
  const lookback = 10;
  let priceLowerLow = false, rsiHigherLow = false;
  let priceHigherHigh = false, rsiLowerHigh = false;
  for (let i = last - lookback; i < last - 2; i++) {
    if (rsiValues[i] === null) continue;
    if (closes[last] < closes[i] && closes[last] <= Math.min(...closes.slice(i, last))) priceLowerLow = true;
    if (rsiValues[last]! > rsiValues[i]! && priceLowerLow) rsiHigherLow = true;
    if (closes[last] > closes[i] && closes[last] >= Math.max(...closes.slice(i, last))) priceHigherHigh = true;
    if (rsiValues[last]! < rsiValues[i]! && priceHigherHigh) rsiLowerHigh = true;
  }
  const nearLowerBB = (price - lower) / (upper - lower) < 0.2;
  const nearUpperBB = (price - lower) / (upper - lower) > 0.8;
  if (priceLowerLow && rsiHigherLow && nearLowerBB) {
    return { signal: "BUY", strength: 80, details: `Bullish RSI divergence near lower Bollinger Band. Price making lower lows, RSI making higher lows. Reversal signal.` };
  }
  if (priceHigherHigh && rsiLowerHigh && nearUpperBB) {
    return { signal: "SELL", strength: 80, details: `Bearish RSI divergence near upper Bollinger Band. Price making higher highs, RSI making lower highs. Reversal signal.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `No RSI divergence at Bollinger Band extremes. RSI: ${rsiVal.toFixed(1)}.` };
}

// ─── Strategy 5.3: RSI + VWAP (Scalping) ───
function rsiVwapScalping(candles: OHLCV[]): StrategyResult {
  if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const rsiValues = rsi(closes, 14);
  const vwap = vwapProxy(candles.slice(-20));
  const last = candles.length - 1;
  const rsiVal = rsiValues[last];
  const vwapVal = vwap[vwap.length - 1];
  const price = closes[last];
  if (rsiVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  if (price < vwapVal && rsiVal < 40) {
    return { signal: "BUY", strength: Math.min(75, Math.round((40 - rsiVal) * 3)), details: `Price below VWAP (${vwapVal.toFixed(2)}) + RSI oversold (${rsiVal.toFixed(1)}). Scalping buy.` };
  }
  if (price > vwapVal && rsiVal > 60) {
    return { signal: "SELL", strength: Math.min(75, Math.round((rsiVal - 60) * 3)), details: `Price above VWAP (${vwapVal.toFixed(2)}) + RSI overbought (${rsiVal.toFixed(1)}). Scalping sell.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `RSI: ${rsiVal.toFixed(1)}, Price vs VWAP: ${((price / vwapVal - 1) * 100).toFixed(2)}%. No signal.` };
}

// ─── Strategy 5.4: 1-Min Consolidation Breakouts (adapted) ───
function consolidationBreakout(candles: OHLCV[]): StrategyResult {
  if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const atrValues = atr(highs, lows, closes, 14);
  const last = candles.length - 1;
  const currentAtr = atrValues[last];
  if (currentAtr === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  // Average ATR over last 20 periods
  let atrSum = 0, atrCount = 0;
  for (let i = last - 20; i < last; i++) {
    if (atrValues[i] !== null) { atrSum += atrValues[i]!; atrCount++; }
  }
  const avgAtr = atrCount > 0 ? atrSum / atrCount : currentAtr;
  const atrRatio = currentAtr / avgAtr;
  // Tight consolidation: current ATR significantly below average
  if (atrRatio < 0.6) {
    const recentHigh = Math.max(...highs.slice(-5));
    const recentLow = Math.min(...lows.slice(-5));
    const price = closes[last];
    if (price > recentHigh * 0.998) {
      return { signal: "BUY", strength: 70, details: `ATR contracting (${(atrRatio * 100).toFixed(0)}% of avg). Breakout above consolidation range ${recentHigh.toFixed(2)}.` };
    }
    if (price < recentLow * 1.002) {
      return { signal: "SELL", strength: 70, details: `ATR contracting (${(atrRatio * 100).toFixed(0)}% of avg). Breakdown below consolidation range ${recentLow.toFixed(2)}.` };
    }
    return { signal: "NEUTRAL", strength: 40, details: `Tight consolidation detected (ATR ${(atrRatio * 100).toFixed(0)}% of avg). Breakout imminent.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `ATR at ${(atrRatio * 100).toFixed(0)}% of average. No consolidation pattern.` };
}

// ─── Strategy 5.5: Moving Average Scalping ───
function maScalping(candles: OHLCV[]): StrategyResult {
  if (candles.length < 55) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const ema5 = ema(closes, 5);
  const ema13 = ema(closes, 13);
  const sma50 = sma(closes, 50);
  const last = candles.length - 1;
  const ema5Now = ema5[last]; const ema13Now = ema13[last]; const sma50Now = sma50[last];
  const ema5Prev = ema5[last - 1]; const ema13Prev = ema13[last - 1];
  const price = closes[last];
  if (!ema5Now || !ema13Now || !sma50Now || !ema5Prev || !ema13Prev)
    return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  if (ema5Prev <= ema13Prev && ema5Now > ema13Now && price > sma50Now) {
    return { signal: "BUY", strength: 75, details: `5-EMA crossed above 13-EMA + price above 50-SMA (${sma50Now.toFixed(2)}). Scalping buy.` };
  }
  if (ema5Prev >= ema13Prev && ema5Now < ema13Now && price < sma50Now) {
    return { signal: "SELL", strength: 75, details: `5-EMA crossed below 13-EMA + price below 50-SMA. Scalping sell.` };
  }
  if (ema5Now > ema13Now && price > sma50Now) {
    return { signal: "BUY", strength: 50, details: `5-EMA above 13-EMA + price above 50-SMA. Bullish bias.` };
  }
  if (ema5Now < ema13Now && price < sma50Now) {
    return { signal: "SELL", strength: 50, details: `5-EMA below 13-EMA + price below 50-SMA. Bearish bias.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: "No clear scalping signal." };
}

// ─── Strategy 5.6: Martingale System ───
function martingaleSystem(candles: OHLCV[]): StrategyResult {
  if (candles.length < 10) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const last = candles.length - 1;
  let consecutiveRed = 0;
  for (let i = last; i >= Math.max(0, last - 10); i--) {
    if (candles[i].close < candles[i].open) consecutiveRed++;
    else break;
  }
  let consecutiveGreen = 0;
  for (let i = last; i >= Math.max(0, last - 10); i--) {
    if (candles[i].close > candles[i].open) consecutiveGreen++;
    else break;
  }
  if (consecutiveRed >= 3) {
    return { signal: "BUY", strength: Math.min(80, 50 + consecutiveRed * 10), details: `Martingale: ${consecutiveRed} consecutive red candles. Probability of reversal increasing. Contrarian buy.` };
  }
  if (consecutiveGreen >= 3) {
    return { signal: "SELL", strength: Math.min(80, 50 + consecutiveGreen * 10), details: `Martingale: ${consecutiveGreen} consecutive green candles. Probability of reversal increasing. Contrarian sell.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `No consecutive candle pattern. Red streak: ${consecutiveRed}, Green streak: ${consecutiveGreen}.` };
}

// ─── Strategy 6.1: Weekly Hedged Strategy ───
function weeklyHedged(candles: OHLCV[]): StrategyResult {
  if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const atrValues = atr(highs, lows, closes, 14);
  const last = candles.length - 1;
  const prev = last - 1;
  const pp = pivotPoints(candles[prev].high, candles[prev].low, candles[prev].close);
  const currentAtr = atrValues[last];
  if (currentAtr === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  let avgAtr = 0, cnt = 0;
  for (let i = last - 14; i < last; i++) { if (atrValues[i] !== null) { avgAtr += atrValues[i]!; cnt++; } }
  avgAtr = cnt > 0 ? avgAtr / cnt : currentAtr;
  const price = closes[last];
  const isLowVol = currentAtr < avgAtr * 0.85;
  const inRange = price > pp.s1 && price < pp.r1;
  if (isLowVol && inRange) {
    return { signal: "NEUTRAL", strength: 60, details: `Low volatility (ATR ${currentAtr.toFixed(2)} < avg ${avgAtr.toFixed(2)}) + range-bound (S1-R1). Options selling opportunity.` };
  }
  if (price > pp.r1) return { signal: "BUY", strength: 50, details: `Price above R1. Trending up. Not ideal for hedged strategy.` };
  if (price < pp.s1) return { signal: "SELL", strength: 50, details: `Price below S1. Trending down.` };
  return { signal: "NEUTRAL", strength: 30, details: `Volatility normal. ATR: ${currentAtr.toFixed(2)}.` };
}

// ─── Strategy 6.2: Multi-Timeframe Options ───
function multiTimeframeOptions(candles: OHLCV[]): StrategyResult {
  if (candles.length < 55) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const ema5v = ema(closes, 5); const ema13v = ema(closes, 13);
  const ema21v = ema(closes, 21); const ema50v = ema(closes, 50);
  const last = candles.length - 1;
  const e5 = ema5v[last]; const e13 = ema13v[last]; const e21 = ema21v[last]; const e50 = ema50v[last];
  if (!e5 || !e13 || !e21 || !e50) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const shortBullish = e5 > e13;
  const mediumBullish = e21 > e50;
  if (shortBullish && mediumBullish) {
    return { signal: "BUY", strength: 80, details: `Multi-timeframe bullish: Short-term (5>13 EMA) + Medium-term (21>50 EMA) aligned. Strong buy.` };
  }
  if (!shortBullish && !mediumBullish) {
    return { signal: "SELL", strength: 80, details: `Multi-timeframe bearish: Short-term (5<13 EMA) + Medium-term (21<50 EMA) aligned. Strong sell.` };
  }
  return { signal: "NEUTRAL", strength: 40, details: `Conflicting timeframes: Short ${shortBullish ? "bullish" : "bearish"}, Medium ${mediumBullish ? "bullish" : "bearish"}.` };
}

// ─── Strategy 6.3: Open Interest Analysis ───
function openInterestProxy(candles: OHLCV[]): StrategyResult {
  if (candles.length < 10) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const last = candles.length - 1;
  const price = candles[last].close;
  const pricePrev = candles[last - 1].close;
  const vol = candles[last].volume;
  const avgVol = candles.slice(-10).reduce((s, c) => s + c.volume, 0) / 10;
  const priceRising = price > pricePrev;
  const volumeRising = vol > avgVol * 1.1;
  if (priceRising && volumeRising) {
    return { signal: "BUY", strength: 70, details: `Rising price + rising volume (${(vol / avgVol * 100).toFixed(0)}% of avg). Strong bullish trend confirmation.` };
  }
  if (!priceRising && volumeRising) {
    return { signal: "SELL", strength: 70, details: `Falling price + rising volume (${(vol / avgVol * 100).toFixed(0)}% of avg). Strong bearish trend confirmation.` };
  }
  if (priceRising && !volumeRising) {
    return { signal: "BUY", strength: 40, details: `Rising price but weak volume. Trend may lack conviction.` };
  }
  return { signal: "SELL", strength: 40, details: `Falling price with declining volume. Weak bearish.` };
}

// ─── Strategy 6.4: Supertrend Selling ───
function supertrendSelling(candles: OHLCV[]): StrategyResult {
  if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const st = supertrend(highs, lows, closes, 10, 3);
  const last = candles.length - 1;
  const dir = st.direction[last]; const dirPrev = st.direction[last - 1];
  if (dir === null || dirPrev === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  if (dirPrev === -1 && dir === 1) {
    return { signal: "BUY", strength: 80, details: `Supertrend direction changed from bearish to bullish. Buy signal.` };
  }
  if (dirPrev === 1 && dir === -1) {
    return { signal: "SELL", strength: 80, details: `Supertrend direction changed from bullish to bearish. Sell signal.` };
  }
  return { signal: dir === 1 ? "BUY" : "SELL", strength: 40, details: `Supertrend currently ${dir === 1 ? "bullish" : "bearish"}. No direction change.` };
}

// ─── Strategy 6.5: Combined Option + VWAP ───
function combinedOptionVwap(candles: OHLCV[]): StrategyResult {
  if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const ema20 = ema(closes, 20);
  const vwap = vwapProxy(candles.slice(-20));
  const last = candles.length - 1;
  const price = closes[last];
  const vwapVal = vwap[vwap.length - 1];
  const emaVal = ema20[last];
  if (emaVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const prevVwap = vwap[vwap.length - 2];
  const crossAbove = closes[last - 1] <= prevVwap && price > vwapVal;
  const crossBelow = closes[last - 1] >= prevVwap && price < vwapVal;
  const uptrend = price > emaVal;
  if (crossAbove && uptrend) {
    return { signal: "BUY", strength: 75, details: `Price crossed above VWAP (${vwapVal.toFixed(2)}) + uptrend (above 20-EMA). Buy signal.` };
  }
  if (crossBelow && !uptrend) {
    return { signal: "SELL", strength: 75, details: `Price crossed below VWAP (${vwapVal.toFixed(2)}) + downtrend (below 20-EMA). Sell signal.` };
  }
  if (price > vwapVal && uptrend) return { signal: "BUY", strength: 50, details: `Price above VWAP and 20-EMA. Bullish bias.` };
  if (price < vwapVal && !uptrend) return { signal: "SELL", strength: 50, details: `Price below VWAP and 20-EMA. Bearish bias.` };
  return { signal: "NEUTRAL", strength: 0, details: `Mixed signals. Price vs VWAP and EMA conflicting.` };
}

// ─── Strategy 6.6: Momentum Buying Option ───
function momentumBuyingOption(candles: OHLCV[]): StrategyResult {
  if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const rsiValues = rsi(closes, 14);
  const ema20 = ema(closes, 20);
  const last = candles.length - 1;
  const rsiVal = rsiValues[last]; const emaVal = ema20[last];
  const price = closes[last];
  if (rsiVal === null || emaVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const recentGain = ((price - closes[last - 3]) / closes[last - 3]) * 100;
  if (rsiVal > 65 && price > emaVal && recentGain > 2) {
    return { signal: "BUY", strength: Math.min(85, Math.round(50 + recentGain * 5)), details: `Strong momentum: RSI ${rsiVal.toFixed(1)} > 65, price above 20-EMA, ${recentGain.toFixed(2)}% gain in 3 sessions. Momentum buy.` };
  }
  if (rsiVal > 55 && price > emaVal && recentGain > 1) {
    return { signal: "BUY", strength: 55, details: `Moderate momentum: RSI ${rsiVal.toFixed(1)}, ${recentGain.toFixed(2)}% recent gain.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `RSI: ${rsiVal.toFixed(1)}, Recent gain: ${recentGain.toFixed(2)}%. Insufficient momentum.` };
}

// ─── Strategy 6.7: Expiry Decay Strategy ───
function expiryDecay(candles: OHLCV[]): StrategyResult {
  if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const rsiValues = rsi(closes, 14);
  const atrValues = atr(highs, lows, closes, 14);
  const last = candles.length - 1;
  const rsiVal = rsiValues[last]; const atrVal = atrValues[last];
  if (rsiVal === null || atrVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  let avgAtr = 0, cnt = 0;
  for (let i = last - 14; i < last; i++) { if (atrValues[i] !== null) { avgAtr += atrValues[i]!; cnt++; } }
  avgAtr = cnt > 0 ? avgAtr / cnt : atrVal;
  if (rsiVal > 60 && atrVal < avgAtr * 0.85) {
    return { signal: "NEUTRAL", strength: 65, details: `Theta decay opportunity: RSI ${rsiVal.toFixed(1)} (range-bound high) + low ATR (${atrVal.toFixed(2)} < avg ${avgAtr.toFixed(2)}). Premium selling.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `RSI: ${rsiVal.toFixed(1)}, ATR: ${atrVal.toFixed(2)}. No decay opportunity.` };
}

// ─── Strategy 6.8: Combined Stoploss Strategy ───
function combinedStoploss(candles: OHLCV[]): StrategyResult {
  if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const ema20 = ema(closes, 20);
  const rsiValues = rsi(closes, 14);
  const vwap = vwapProxy(candles.slice(-20));
  const last = candles.length - 1;
  const price = closes[last];
  const emaVal = ema20[last]; const rsiVal = rsiValues[last]; const vwapVal = vwap[vwap.length - 1];
  if (emaVal === null || rsiVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const aboveEma = price > emaVal;
  const aboveVwap = price > vwapVal;
  const rsiAbove50 = rsiVal > 50;
  const bullishCount = (aboveEma ? 1 : 0) + (aboveVwap ? 1 : 0) + (rsiAbove50 ? 1 : 0);
  if (bullishCount === 3) {
    return { signal: "BUY", strength: 85, details: `Triple confirmation: Price above 20-EMA (${emaVal.toFixed(2)}), above VWAP (${vwapVal.toFixed(2)}), RSI ${rsiVal.toFixed(1)} > 50. Strong buy.` };
  }
  if (bullishCount === 0) {
    return { signal: "SELL", strength: 85, details: `Triple confirmation: Price below 20-EMA, below VWAP, RSI ${rsiVal.toFixed(1)} < 50. Strong sell.` };
  }
  return { signal: "NEUTRAL", strength: 30, details: `Mixed signals (${bullishCount}/3 bullish). No strong confirmation.` };
}

// ─── Strategy 6.9: Theta Decay Strategy ───
function thetaDecay(candles: OHLCV[]): StrategyResult {
  if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const bb = bollingerBands(closes, 20, 2);
  const atrValues = atr(highs, lows, closes, 14);
  const last = candles.length - 1;
  const upper = bb.upper[last]; const lower = bb.lower[last]; const mid = bb.middle[last];
  const atrVal = atrValues[last];
  if (!upper || !lower || !mid || atrVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const price = closes[last];
  // Check ATR declining
  const atrPrev5 = atrValues[last - 5];
  const atrDeclining = atrPrev5 !== null && atrVal < atrPrev5;
  // Price oscillating in middle zone of BB
  const bbPos = (price - lower) / (upper - lower);
  const inMiddleZone = bbPos > 0.3 && bbPos < 0.7;
  if (atrDeclining && inMiddleZone) {
    return { signal: "NEUTRAL", strength: 65, details: `Theta decay setup: ATR declining (${atrVal.toFixed(2)} from ${atrPrev5?.toFixed(2)}), price in BB middle zone (${(bbPos * 100).toFixed(0)}%). Range-bound. Options premium decay.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `ATR: ${atrVal.toFixed(2)}, BB position: ${(bbPos * 100).toFixed(0)}%. No theta decay setup.` };
}

// ─── Strategy 6.10: BTST Momentum ───
function btstMomentum(candles: OHLCV[]): StrategyResult {
  if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const last = candles.length - 1;
  const closes = candles.map(c => c.close);
  const rsiValues = rsi(closes, 14);
  const price = closes[last];
  const prevPrice = closes[last - 1];
  const change = ((price - prevPrice) / prevPrice) * 100;
  const vol = candles[last].volume;
  const avgVol = candles.slice(-20).reduce((s, c) => s + c.volume, 0) / 20;
  const rsiVal = rsiValues[last];
  const rsiPrev = rsiValues[last - 1];
  if (rsiVal === null || rsiPrev === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  if (change > 1.5 && vol > avgVol * 1.2 && rsiVal > rsiPrev) {
    return { signal: "BUY", strength: Math.min(85, Math.round(50 + change * 10)), details: `BTST Momentum: ${change.toFixed(2)}% gain with high volume (${(vol / avgVol * 100).toFixed(0)}% of avg). RSI rising (${rsiVal.toFixed(1)}). Buy for next session.` };
  }
  if (change < -1.5 && vol > avgVol * 1.2 && rsiVal < rsiPrev) {
    return { signal: "SELL", strength: Math.min(85, Math.round(50 + Math.abs(change) * 10)), details: `BTST bearish: ${change.toFixed(2)}% loss with high volume. RSI falling. Sell signal.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `Change: ${change.toFixed(2)}%, Vol ratio: ${(vol / avgVol * 100).toFixed(0)}%. Insufficient momentum for BTST.` };
}

// ─── Strategy 6.11: 3 PM Nifty Strategy ───
function threePmNifty(candles: OHLCV[]): StrategyResult {
  if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const last = candles.length - 1;
  const vwap = vwapProxy(candles.slice(-20));
  const vwapVal = vwap[vwap.length - 1];
  const price = candles[last].close;
  const bullish = candles[last].close > candles[last].open;
  const bearish = candles[last].close < candles[last].open;
  if (price > vwapVal && bullish) {
    const strength = Math.min(75, Math.round(50 + ((price - vwapVal) / vwapVal) * 1000));
    return { signal: "BUY", strength, details: `End-of-day momentum: Close (${price.toFixed(2)}) above VWAP (${vwapVal.toFixed(2)}) + bullish candle. Buy for next session.` };
  }
  if (price < vwapVal && bearish) {
    const strength = Math.min(75, Math.round(50 + ((vwapVal - price) / vwapVal) * 1000));
    return { signal: "SELL", strength, details: `End-of-day weakness: Close (${price.toFixed(2)}) below VWAP (${vwapVal.toFixed(2)}) + bearish candle. Sell signal for next session.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `Close vs VWAP: ${((price / vwapVal - 1) * 100).toFixed(2)}%. No clear end-of-day signal.` };
}

// ─── Strategy 6.12: Momentum Selling ───
function momentumSelling(candles: OHLCV[]): StrategyResult {
  if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const ema20 = ema(closes, 20);
  const rsiValues = rsi(closes, 14);
  const last = candles.length - 1;
  const price = closes[last]; const emaVal = ema20[last]; const rsiVal = rsiValues[last];
  if (emaVal === null || rsiVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const change = ((price - candles[last].open) / candles[last].open) * 100;
  if (price < emaVal && rsiVal < 40 && change < -1.5) {
    return { signal: "SELL", strength: Math.min(85, Math.round(50 + Math.abs(change) * 10)), details: `Strong bearish momentum: Price below 20-EMA, RSI ${rsiVal.toFixed(1)} < 40, ${change.toFixed(2)}% loss. Momentum sell.` };
  }
  if (price < emaVal && rsiVal < 45) {
    return { signal: "SELL", strength: 55, details: `Moderate bearish: Price below 20-EMA, RSI ${rsiVal.toFixed(1)}.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `RSI: ${rsiVal.toFixed(1)}, Change: ${change.toFixed(2)}%. No bearish momentum.` };
}

// ─── Strategy 6.13: Swing Buying Options ───
function swingBuyingOptions(candles: OHLCV[]): StrategyResult {
  if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const bb = bollingerBands(closes, 20, 2);
  const rsiValues = rsi(closes, 14);
  const last = candles.length - 1;
  const price = closes[last];
  const lower = bb.lower[last]; const upper = bb.upper[last];
  const rsiVal = rsiValues[last];
  if (!lower || !upper || rsiVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const vol = candles[last].volume;
  const avgVol = candles.slice(-20).reduce((s, c) => s + c.volume, 0) / 20;
  const nearLowerBB = (price - lower) / (upper - lower) < 0.15;
  const oversold = rsiVal < 35;
  const volumeSpike = vol > avgVol * 1.5;
  if (nearLowerBB && oversold && volumeSpike) {
    return { signal: "BUY", strength: 85, details: `Strong swing buy: Price near lower BB + RSI oversold (${rsiVal.toFixed(1)}) + volume spike (${(vol / avgVol * 100).toFixed(0)}% of avg). Triple confirmation.` };
  }
  if (nearLowerBB && oversold) {
    return { signal: "BUY", strength: 65, details: `Swing buy: Price near lower BB + RSI oversold (${rsiVal.toFixed(1)}).` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `RSI: ${rsiVal.toFixed(1)}, BB position: ${(((price - lower) / (upper - lower)) * 100).toFixed(0)}%.` };
}

// ─── Strategy 7.1: 9 & 21 EMA Crossover ───
function ema9and21Crossover(candles: OHLCV[]): StrategyResult {
  if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const ema9 = ema(closes, 9); const ema21 = ema(closes, 21);
  const last = candles.length - 1;
  const ema9Now = ema9[last]; const ema21Now = ema21[last];
  const ema9Prev = ema9[last - 1]; const ema21Prev = ema21[last - 1];
  if (!ema9Now || !ema21Now || !ema9Prev || !ema21Prev)
    return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const price = closes[last];
  if (ema9Prev <= ema21Prev && ema9Now > ema21Now) {
    return { signal: "BUY", strength: 75, details: `9-EMA (${ema9Now.toFixed(2)}) crossed above 21-EMA (${ema21Now.toFixed(2)}). Bullish crossover.` };
  }
  if (ema9Prev >= ema21Prev && ema9Now < ema21Now) {
    return { signal: "SELL", strength: 75, details: `9-EMA (${ema9Now.toFixed(2)}) crossed below 21-EMA (${ema21Now.toFixed(2)}). Bearish crossover.` };
  }
  if (ema9Now > ema21Now && price > ema9Now) {
    const gap = ((ema9Now - ema21Now) / ema21Now) * 100;
    return { signal: "BUY", strength: Math.min(60, Math.round(gap * 20)), details: `9-EMA above 21-EMA. Price above both EMAs. Uptrend intact (gap: ${gap.toFixed(2)}%).` };
  }
  if (ema9Now < ema21Now && price < ema9Now) {
    const gap = ((ema21Now - ema9Now) / ema21Now) * 100;
    return { signal: "SELL", strength: Math.min(60, Math.round(gap * 20)), details: `9-EMA below 21-EMA. Price below both EMAs. Downtrend intact (gap: ${gap.toFixed(2)}%).` };
  }
  return { signal: "NEUTRAL", strength: 0, details: "No clear EMA crossover signal." };
}

// ─── Strategy 7.2: Positional Trading (Price Action) ───
function positionalPriceAction(candles: OHLCV[]): StrategyResult {
  if (candles.length < 200) return { signal: "NEUTRAL", strength: 0, details: "Not enough data (need 200+ candles)" };
  const closes = candles.map(c => c.close);
  const sma50v = sma(closes, 50); const sma200v = sma(closes, 200);
  const last = candles.length - 1;
  const s50 = sma50v[last]; const s200 = sma200v[last];
  const price = closes[last];
  if (s50 === null || s200 === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  if (price > s50 && price > s200) {
    return { signal: "BUY", strength: 80, details: `Price above 50-SMA (${s50.toFixed(2)}) and 200-SMA (${s200.toFixed(2)}). Strong bullish structure.` };
  }
  if (price < s50 && price < s200) {
    return { signal: "SELL", strength: 80, details: `Price below 50-SMA and 200-SMA. Strong bearish structure.` };
  }
  return { signal: "NEUTRAL", strength: 40, details: `Price between 50-SMA (${s50.toFixed(2)}) and 200-SMA (${s200.toFixed(2)}). Consolidation.` };
}

// ─── Strategy 7.3: Pin Bar / Reversal Pattern ───
function pinBarReversal(candles: OHLCV[]): StrategyResult {
  if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const last = candles.length - 1;
  const c = candles[last];
  const body = Math.abs(c.close - c.open);
  const totalRange = c.high - c.low;
  if (totalRange === 0) return { signal: "NEUTRAL", strength: 0, details: "No price movement." };
  const lowerWick = Math.min(c.open, c.close) - c.low;
  const upperWick = c.high - Math.max(c.open, c.close);
  // Bullish pin bar: long lower wick > 2x body
  if (lowerWick > body * 2 && lowerWick > totalRange * 0.6) {
    // Check if near recent support
    const recentLow = Math.min(...candles.slice(-10).map(x => x.low));
    const nearSupport = c.low <= recentLow * 1.01;
    return { signal: "BUY", strength: nearSupport ? 80 : 65, details: `Bullish pin bar: Lower wick (${lowerWick.toFixed(2)}) > 2x body (${body.toFixed(2)}).${nearSupport ? " Near recent support." : ""}` };
  }
  // Bearish pin bar: long upper wick > 2x body
  if (upperWick > body * 2 && upperWick > totalRange * 0.6) {
    const recentHigh = Math.max(...candles.slice(-10).map(x => x.high));
    const nearResistance = c.high >= recentHigh * 0.99;
    return { signal: "SELL", strength: nearResistance ? 80 : 65, details: `Bearish pin bar: Upper wick (${upperWick.toFixed(2)}) > 2x body (${body.toFixed(2)}).${nearResistance ? " Near recent resistance." : ""}` };
  }
  return { signal: "NEUTRAL", strength: 0, details: "No pin bar pattern detected." };
}

// ─── Strategy 7.4: Pullback Strategy ───
function pullbackStrategy(candles: OHLCV[]): StrategyResult {
  if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const ema20 = ema(closes, 20);
  const last = candles.length - 1;
  const price = closes[last]; const emaVal = ema20[last];
  if (emaVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const uptrend = price > emaVal;
  const touchEma = Math.abs(price - emaVal) / price < 0.01;
  // Check if most of recent 10 candles were above EMA (uptrend context)
  let aboveCount = 0;
  for (let i = last - 10; i < last; i++) {
    if (ema20[i] !== null && closes[i] > ema20[i]!) aboveCount++;
  }
  const trendContext = aboveCount >= 7;
  const bullish = candles[last].close > candles[last].open;
  const bearish = candles[last].close < candles[last].open;
  if (trendContext && touchEma && bullish) {
    return { signal: "BUY", strength: 75, details: `Pullback to 20-EMA (${emaVal.toFixed(2)}) in uptrend. Bullish bounce candle. Buy the pullback.` };
  }
  let belowCount = 0;
  for (let i = last - 10; i < last; i++) {
    if (ema20[i] !== null && closes[i] < ema20[i]!) belowCount++;
  }
  const downContext = belowCount >= 7;
  if (downContext && touchEma && bearish) {
    return { signal: "SELL", strength: 75, details: `Pullback to 20-EMA in downtrend. Bearish rejection candle. Sell the pullback.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `Price ${uptrend ? "above" : "below"} 20-EMA. No pullback pattern.` };
}

// ─── Strategy 7.5: Trading Based on Repo Rates ───
function repoRateProxy(candles: OHLCV[]): StrategyResult {
  if (candles.length < 200) return { signal: "NEUTRAL", strength: 0, details: "Not enough data (need 200+ candles)" };
  const closes = candles.map(c => c.close);
  const sma200v = sma(closes, 200);
  const rsiValues = rsi(closes, 14);
  const last = candles.length - 1;
  const s200 = sma200v[last]; const rsiVal = rsiValues[last]; const price = closes[last];
  if (s200 === null || rsiVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  if (price > s200 && rsiVal > 50) {
    return { signal: "BUY", strength: Math.min(75, Math.round(rsiVal - 20)), details: `Macro bullish: Price above 200-SMA (${s200.toFixed(2)}) + RSI ${rsiVal.toFixed(1)} > 50. Favorable macro environment.` };
  }
  if (price < s200 && rsiVal < 50) {
    return { signal: "SELL", strength: Math.min(75, Math.round(80 - rsiVal)), details: `Macro bearish: Price below 200-SMA + RSI ${rsiVal.toFixed(1)} < 50.` };
  }
  return { signal: "NEUTRAL", strength: 0, details: `Mixed macro signals. Price ${price > s200 ? "above" : "below"} 200-SMA, RSI: ${rsiVal.toFixed(1)}.` };
}

// ─── Strategy 7.6: Volatility Contraction Pattern (VCP) ───
function vcpPattern(candles: OHLCV[]): StrategyResult {
  if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const last = candles.length - 1;
  // Calculate ranges of last 5, 10, 15 candles
  const range5 = Math.max(...candles.slice(-5).map(c => c.high)) - Math.min(...candles.slice(-5).map(c => c.low));
  const range10 = Math.max(...candles.slice(-10).map(c => c.high)) - Math.min(...candles.slice(-10).map(c => c.low));
  const range15 = Math.max(...candles.slice(-15).map(c => c.high)) - Math.min(...candles.slice(-15).map(c => c.low));
  const tightening = range5 < range10 * 0.7 && range10 < range15 * 0.8;
  if (!tightening) return { signal: "NEUTRAL", strength: 0, details: `No VCP. Ranges: 5d=${range5.toFixed(2)}, 10d=${range10.toFixed(2)}, 15d=${range15.toFixed(2)}.` };
  const price = candles[last].close;
  const consolidationHigh = Math.max(...candles.slice(-5).map(c => c.high));
  if (price >= consolidationHigh * 0.998) {
    return { signal: "BUY", strength: 80, details: `VCP detected: Tightening ranges (${range15.toFixed(2)} -> ${range10.toFixed(2)} -> ${range5.toFixed(2)}). Price breaking out above ${consolidationHigh.toFixed(2)}.` };
  }
  return { signal: "NEUTRAL", strength: 50, details: `VCP forming: Tightening ranges. Awaiting breakout above ${consolidationHigh.toFixed(2)}.` };
}

// ─── Strategy 7.7: Two-Legged Pullback ───
function twoLeggedPullback(candles: OHLCV[]): StrategyResult {
  if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
  const closes = candles.map(c => c.close);
  const ema20 = ema(closes, 20);
  const last = candles.length - 1;
  const emaVal = ema20[last];
  if (emaVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
  const price = closes[last];
  const uptrend = price > emaVal;
  // In uptrend: two consecutive lower closes followed by bullish candle
  if (uptrend && last >= 3) {
    const twoLowerCloses = closes[last - 2] < closes[last - 3] && closes[last - 1] < closes[last - 2];
    const bullishBounce = closes[last] > closes[last - 1] && candles[last].close > candles[last].open;
    if (twoLowerCloses && bullishBounce) {
      return { signal: "BUY", strength: 75, details: `Two-legged pullback in uptrend: Two lower closes followed by bullish reversal candle. Buy signal.` };
    }
  }
  // In downtrend: two consecutive higher closes followed by bearish candle
  const downtrend = price < emaVal;
  if (downtrend && last >= 3) {
    const twoHigherCloses = closes[last - 2] > closes[last - 3] && closes[last - 1] > closes[last - 2];
    const bearishReject = closes[last] < closes[last - 1] && candles[last].close < candles[last].open;
    if (twoHigherCloses && bearishReject) {
      return { signal: "SELL", strength: 75, details: `Two-legged pullback in downtrend: Two higher closes followed by bearish reversal candle. Sell signal.` };
    }
  }
  return { signal: "NEUTRAL", strength: 0, details: `No two-legged pullback pattern detected. Trend: ${uptrend ? "up" : downtrend ? "down" : "neutral"}.` };
}

// ─── All 51 strategies ───
export const STRATEGIES: Strategy[] = [
  // CHAPTER 1 - SWING STRATEGIES
  {
    id: "bb-ema",
    name: "Bollinger Bands + 9 EMA",
    chapter: "1.1",
    category: "Swing",
    description: "Uses Bollinger Bands with 9-period EMA. Buy when price takes support on lower BB with bullish 9-EMA. Sell when price faces resistance at upper BB with falling EMA.",
    indicators: ["Bollinger Bands (20, 2)", "EMA (9)"],
    book: "51 Trading Strategies",
    evaluate: bollingerBandEma,
  },
  {
    id: "williams-macd",
    name: "Williams %R + MACD Duo",
    chapter: "1.2",
    category: "Swing",
    description: "Combines Williams %R oscillator with 14-SMA and MACD. Buy when Williams %R reverses from oversold (-80) with price above SMA. Targets pullback entries with minimal stoploss.",
    indicators: ["Williams %R (14)", "SMA (14)", "MACD (12,26,9)"],
    book: "51 Trading Strategies",
    evaluate: williamsRMacd,
  },
  {
    id: "macd-fib",
    name: "MACD + Fibonacci Retracement",
    chapter: "1.3",
    category: "Swing",
    description: "Catches swings using MACD crossover at Fibonacci retracement levels (23.6%, 38.2%, 50%, 61.8%).",
    indicators: ["MACD (12,26,9)", "Fibonacci Levels"],
    book: "51 Trading Strategies",
    evaluate: macdFibonacci,
  },
  {
    id: "triangle-breakout",
    name: "Riding a Breakout (Triangle)",
    chapter: "1.4",
    category: "Swing",
    description: "Detects triangle pattern (narrowing price range) and trades the breakout with volume confirmation.",
    indicators: ["Price Range", "Volume"],
    book: "51 Trading Strategies",
    evaluate: triangleBreakout,
  },
  {
    id: "institutional-moves",
    name: "Swing Trading with Institutional Moves",
    chapter: "1.5",
    category: "Swing",
    description: "Identifies gap-up/gap-down zones and trades retracements to these institutional demand/supply zones.",
    indicators: ["Gap Analysis", "Price Action"],
    book: "51 Trading Strategies",
    evaluate: institutionalMoves,
  },
  {
    id: "bb-width",
    name: "BB Width Breakout",
    chapter: "1.6",
    category: "Swing",
    description: "Trades breakouts when Bollinger Bands contract (squeeze) indicating low volatility, then expand with a directional move.",
    indicators: ["Bollinger Bands (20, 2)", "BB Width"],
    book: "51 Trading Strategies",
    evaluate: bbWidthBreakout,
  },
  {
    id: "ichimoku-cloud",
    name: "Ichimoku Cloud",
    chapter: "1.7",
    category: "Swing",
    description: "Uses Ichimoku Cloud components: Conversion/Base line crossover and price position relative to the cloud for trend confirmation.",
    indicators: ["Ichimoku Cloud (9, 26, 52)"],
    book: "51 Trading Strategies",
    evaluate: ichimokuCloudStrategy,
  },

  // CHAPTER 2 - INTRADAY STRATEGIES
  {
    id: "ma-fibonacci",
    name: "Moving Average + Fibonacci",
    chapter: "2.1",
    category: "Intraday",
    description: "Uses 200-SMA as macro trend filter and Fibonacci retracement levels for pullback entries.",
    indicators: ["SMA (200)", "Fibonacci Levels"],
    book: "51 Trading Strategies",
    evaluate: maFibonacci,
  },
  {
    id: "supertrend-pivot",
    name: "Supertrend + Pivot Points",
    chapter: "2.2",
    category: "Intraday",
    description: "Trend-following using Supertrend with Standard Pivot Points. Buy when price breaks above R1 with Supertrend bullish.",
    indicators: ["Supertrend (10, 3)", "Pivot Points (Standard)"],
    book: "51 Trading Strategies",
    evaluate: supertrendPivot,
  },
  {
    id: "vwap-stddev",
    name: "VWAP + Standard Deviations",
    chapter: "2.3",
    category: "Intraday",
    description: "Uses volume-weighted average price to identify undervalued (below VWAP) and overvalued (above VWAP) conditions.",
    indicators: ["VWAP Proxy"],
    book: "51 Trading Strategies",
    evaluate: vwapStrategy,
  },
  {
    id: "rsi-volume",
    name: "RSI + Volume Oscillator",
    chapter: "2.4",
    category: "Intraday",
    description: "Combines RSI with Volume Oscillator. Buy when RSI is oversold and Volume Oscillator is negative. Both must confirm.",
    indicators: ["RSI (14)", "Volume Oscillator (5, 10)"],
    book: "51 Trading Strategies",
    evaluate: rsiVolumeOscillator,
  },
  {
    id: "wait-trade-pullback",
    name: "Wait and Trade the Pullback",
    chapter: "2.5",
    category: "Intraday",
    description: "Waits for pullback to pivot support in uptrend or pivot resistance in downtrend before entering.",
    indicators: ["EMA (20)", "Pivot Points"],
    book: "51 Trading Strategies",
    evaluate: waitTradePullback,
  },
  {
    id: "double-rsi",
    name: "Double RSI",
    chapter: "2.6",
    category: "Intraday",
    description: "Uses confluence of RSI(5) for short-term and RSI(60) for long-term momentum. Strong signals when both agree.",
    indicators: ["RSI (5)", "RSI (60)"],
    book: "51 Trading Strategies",
    evaluate: doubleRsi,
  },
  {
    id: "cpr-trend",
    name: "CPR with Trend Following",
    chapter: "2.7",
    category: "Intraday",
    description: "Central Pivot Range strategy. Narrow CPR indicates trending day (trade breakout). Wide CPR indicates range-bound (trade support/resistance).",
    indicators: ["CPR (TC, BC, Pivot)"],
    book: "51 Trading Strategies",
    evaluate: cprTrendFollowing,
  },

  // CHAPTER 3 - ADVANCED STRATEGIES
  {
    id: "dow-theory",
    name: "Dow Theory (Higher Highs/Lows)",
    chapter: "3.1",
    category: "Advanced",
    description: "Identifies uptrend (higher highs + higher lows) and downtrend (lower highs + lower lows) using swing point analysis.",
    indicators: ["Swing Points"],
    book: "51 Trading Strategies",
    evaluate: dowTheory,
  },
  {
    id: "smart-money",
    name: "Smart Money Concept",
    chapter: "3.2",
    category: "Advanced",
    description: "Detects Break of Structure (BoS) and order block zones for institutional-style entries.",
    indicators: ["Break of Structure", "Order Blocks"],
    book: "51 Trading Strategies",
    evaluate: smartMoneyConcept,
  },
  {
    id: "elliott-wave",
    name: "Elliott Wave Theory",
    chapter: "3.3",
    category: "Advanced",
    description: "Simplified Elliott Wave: Detects wave 2 correction (38.2-61.8% retracement) and wave 3 start.",
    indicators: ["Wave Analysis", "Fibonacci"],
    book: "51 Trading Strategies",
    evaluate: elliottWave,
  },
  {
    id: "fractal-trading",
    name: "Fractal Trading",
    chapter: "3.4",
    category: "Advanced",
    description: "Williams Fractals: Buy when price breaks above fractal high with price above 50-SMA. Sell when below fractal low.",
    indicators: ["Williams Fractals", "SMA (50)"],
    book: "51 Trading Strategies",
    evaluate: fractalTrading,
  },
  {
    id: "renko-rsi-stoch",
    name: "Renko + RSI + Stochastic RSI",
    chapter: "3.5",
    category: "Advanced",
    description: "RSI + Stochastic RSI confluence. Buy at RSI support with oversold Stochastic RSI. Sell at RSI resistance.",
    indicators: ["RSI (14)", "Stochastic RSI (14, 14)"],
    book: "51 Trading Strategies",
    evaluate: renkoRsiStochastic,
  },
  {
    id: "donchian-pullback",
    name: "Donchian Channel Pullback",
    chapter: "3.6",
    category: "Advanced",
    description: "Uses Donchian Channel (highest high/lowest low). Trades pullback to middle after touching upper/lower band.",
    indicators: ["Donchian Channel (20)"],
    book: "51 Trading Strategies",
    evaluate: donchianPullback,
  },
  {
    id: "gann-linear-reg",
    name: "Gann Fan + Linear Regression",
    chapter: "3.7",
    category: "Advanced",
    description: "Uses linear regression to determine trend direction. Buy above regression line with positive slope.",
    indicators: ["Linear Regression (20)"],
    book: "51 Trading Strategies",
    evaluate: gannLinearRegression,
  },

  // CHAPTER 4 - POSITIONAL
  {
    id: "macro-pivots",
    name: "Moving with Macro Trends",
    chapter: "4.1",
    category: "Positional",
    description: "Uses daily pivot points to catch positional swings. Buy near support with bullish candle, sell near resistance with bearish.",
    indicators: ["Pivot Points (Standard)"],
    book: "51 Trading Strategies",
    evaluate: macroTrendPivots,
  },
  {
    id: "supertrend-rsi",
    name: "Supertrend + RSI (Positional)",
    chapter: "4.2",
    category: "Positional",
    description: "RSI > 60 with bullish Supertrend = buy. RSI < 40 with bearish Supertrend = sell. 40-60 = sideways.",
    indicators: ["Supertrend (10, 3)", "RSI (14)"],
    book: "51 Trading Strategies",
    evaluate: supertrendRsiPositional,
  },
  {
    id: "sectoral-analysis",
    name: "Sectoral Analysis",
    chapter: "4.3",
    category: "Positional",
    description: "Compares stock's short-term vs long-term performance to detect relative strength. Outperforming = buy.",
    indicators: ["Relative Strength", "SMA (20)"],
    book: "51 Trading Strategies",
    evaluate: sectoralAnalysis,
  },
  {
    id: "mw-rsi-pattern",
    name: "M&W RSI Pattern",
    chapter: "4.4",
    category: "Positional",
    description: "Detects W-pattern (double bottom in RSI near 30) for bullish reversal and M-pattern (double top near 70) for bearish.",
    indicators: ["RSI (14)", "Pattern Detection"],
    book: "51 Trading Strategies",
    evaluate: mwRsiPattern,
  },

  // CHAPTER 5 - SCALPING (adapted for daily)
  {
    id: "sar-rsi-ha",
    name: "Parabolic SAR + RSI + Heiken Ashi",
    chapter: "5.1",
    category: "Scalping",
    description: "Parabolic SAR below price + RSI > 50 + bullish candle = buy. SAR above + RSI < 50 + bearish = sell.",
    indicators: ["Parabolic SAR", "RSI (14)"],
    book: "51 Trading Strategies",
    evaluate: parabolicSarRsi,
  },
  {
    id: "rsi-divergence-bb",
    name: "RSI Divergence + Bollinger Bands",
    chapter: "5.2",
    category: "Scalping",
    description: "Detects bullish divergence (price lower low, RSI higher low) near lower BB. Bearish divergence near upper BB.",
    indicators: ["RSI (14)", "Bollinger Bands (20, 2)"],
    book: "51 Trading Strategies",
    evaluate: rsiDivergenceBb,
  },
  {
    id: "rsi-vwap-scalp",
    name: "RSI + VWAP (Scalping)",
    chapter: "5.3",
    category: "Scalping",
    description: "Buy when price below VWAP + RSI < 40. Sell when price above VWAP + RSI > 60.",
    indicators: ["RSI (14)", "VWAP Proxy"],
    book: "51 Trading Strategies",
    evaluate: rsiVwapScalping,
  },
  {
    id: "consolidation-breakout",
    name: "1-Min Consolidation Breakouts (adapted)",
    chapter: "5.4",
    category: "Scalping",
    description: "Detects tight consolidation (ATR contracting) then trades the breakout direction.",
    indicators: ["ATR (14)"],
    book: "51 Trading Strategies",
    evaluate: consolidationBreakout,
  },
  {
    id: "ma-scalping",
    name: "Moving Average Scalping",
    chapter: "5.5",
    category: "Scalping",
    description: "5-EMA crossing above 13-EMA with price above 50-SMA = buy. Crossing below with price below = sell.",
    indicators: ["EMA (5)", "EMA (13)", "SMA (50)"],
    book: "51 Trading Strategies",
    evaluate: maScalping,
  },
  {
    id: "martingale",
    name: "Martingale System",
    chapter: "5.6",
    category: "Scalping",
    description: "After 3+ consecutive red candles, probability of green increases. Contrarian buy after losing streaks.",
    indicators: ["Candle Pattern"],
    book: "51 Trading Strategies",
    evaluate: martingaleSystem,
  },

  // CHAPTER 6 - OPTIONS (adapted for stock screener)
  {
    id: "weekly-hedged",
    name: "Weekly Hedged Strategy",
    chapter: "6.1",
    category: "Options",
    description: "Low volatility + range-bound detection for options selling. NEUTRAL signal when ATR low and price in S1-R1.",
    indicators: ["ATR (14)", "Pivot Points"],
    book: "51 Trading Strategies",
    evaluate: weeklyHedged,
  },
  {
    id: "multi-tf-options",
    name: "Multi-Timeframe Options",
    chapter: "6.2",
    category: "Options",
    description: "Compares short-term (5/13 EMA) with medium-term (21/50 EMA). Both bullish = strong buy. Conflicting = neutral.",
    indicators: ["EMA (5, 13, 21, 50)"],
    book: "51 Trading Strategies",
    evaluate: multiTimeframeOptions,
  },
  {
    id: "oi-analysis",
    name: "Open Interest Analysis",
    chapter: "6.3",
    category: "Options",
    description: "Volume proxy for OI: Rising price + rising volume = strong trend. Falling price + rising volume = strong downtrend.",
    indicators: ["Volume Analysis"],
    book: "51 Trading Strategies",
    evaluate: openInterestProxy,
  },
  {
    id: "supertrend-selling",
    name: "Supertrend Selling",
    chapter: "6.4",
    category: "Options",
    description: "Trades Supertrend direction changes. Buy on bearish-to-bullish flip. Sell on bullish-to-bearish flip.",
    indicators: ["Supertrend (10, 3)"],
    book: "51 Trading Strategies",
    evaluate: supertrendSelling,
  },
  {
    id: "option-vwap",
    name: "Combined Option + VWAP",
    chapter: "6.5",
    category: "Options",
    description: "Price crossing above VWAP + uptrend = buy. Crossing below + downtrend = sell.",
    indicators: ["VWAP Proxy", "EMA (20)"],
    book: "51 Trading Strategies",
    evaluate: combinedOptionVwap,
  },
  {
    id: "momentum-buying",
    name: "Momentum Buying Option",
    chapter: "6.6",
    category: "Options",
    description: "Strong momentum: RSI > 65 + price above 20-EMA + > 2% gain in recent sessions.",
    indicators: ["RSI (14)", "EMA (20)"],
    book: "51 Trading Strategies",
    evaluate: momentumBuyingOption,
  },
  {
    id: "expiry-decay",
    name: "Expiry Decay Strategy",
    chapter: "6.7",
    category: "Options",
    description: "High RSI + low ATR = premium selling opportunity. Range-bound conditions for theta decay.",
    indicators: ["RSI (14)", "ATR (14)"],
    book: "51 Trading Strategies",
    evaluate: expiryDecay,
  },
  {
    id: "combined-stoploss",
    name: "Combined Stoploss Strategy",
    chapter: "6.8",
    category: "Options",
    description: "Triple confirmation: Price above 20-EMA + above VWAP + RSI > 50 = strong buy. All below = strong sell.",
    indicators: ["EMA (20)", "VWAP Proxy", "RSI (14)"],
    book: "51 Trading Strategies",
    evaluate: combinedStoploss,
  },
  {
    id: "theta-decay",
    name: "Theta Decay Strategy",
    chapter: "6.9",
    category: "Options",
    description: "ATR declining + price in BB middle zone = range-bound. Theta decay opportunity for options.",
    indicators: ["ATR (14)", "Bollinger Bands (20, 2)"],
    book: "51 Trading Strategies",
    evaluate: thetaDecay,
  },
  {
    id: "btst-momentum",
    name: "BTST Momentum",
    chapter: "6.10",
    category: "Options",
    description: "Buy Today Sell Tomorrow: Strong bullish candle (> 1.5% gain) with high volume + RSI rising.",
    indicators: ["RSI (14)", "Volume"],
    book: "51 Trading Strategies",
    evaluate: btstMomentum,
  },
  {
    id: "3pm-nifty",
    name: "3 PM Nifty Strategy",
    chapter: "6.11",
    category: "Options",
    description: "End-of-day momentum: Close above VWAP with bullish candle = buy for next session.",
    indicators: ["VWAP Proxy"],
    book: "51 Trading Strategies",
    evaluate: threePmNifty,
  },
  {
    id: "momentum-selling",
    name: "Momentum Selling",
    chapter: "6.12",
    category: "Options",
    description: "Strong bearish momentum: Price below 20-EMA, RSI < 40, big red candle (> 1.5% loss).",
    indicators: ["EMA (20)", "RSI (14)"],
    book: "51 Trading Strategies",
    evaluate: momentumSelling,
  },
  {
    id: "swing-buying-options",
    name: "Swing Buying Options",
    chapter: "6.13",
    category: "Options",
    description: "Price at BB lower support + RSI oversold + Volume spike. Strong swing buy signal.",
    indicators: ["Bollinger Bands (20, 2)", "RSI (14)", "Volume"],
    book: "51 Trading Strategies",
    evaluate: swingBuyingOptions,
  },

  // CHAPTER 7 - PRICE ACTION
  {
    id: "ema-crossover",
    name: "9 & 21 EMA Crossover",
    chapter: "7.1",
    category: "Price Action",
    description: "Classic EMA crossover using 9-period and 21-period EMAs. Bullish when 9-EMA crosses above 21-EMA.",
    indicators: ["EMA (9)", "EMA (21)"],
    book: "51 Trading Strategies",
    evaluate: ema9and21Crossover,
  },
  {
    id: "positional-pa",
    name: "Positional Trading (Price Action)",
    chapter: "7.2",
    category: "Price Action",
    description: "Price above 50-SMA AND 200-SMA = bullish. Below both = bearish. Between = consolidation.",
    indicators: ["SMA (50)", "SMA (200)"],
    book: "51 Trading Strategies",
    evaluate: positionalPriceAction,
  },
  {
    id: "pin-bar",
    name: "Pin Bar / Reversal Pattern",
    chapter: "7.3",
    category: "Price Action",
    description: "Detects pin bar candles: Long lower wick (> 2x body) near support = bullish. Long upper wick near resistance = bearish.",
    indicators: ["Candlestick Pattern"],
    book: "51 Trading Strategies",
    evaluate: pinBarReversal,
  },
  {
    id: "pullback",
    name: "Pullback Strategy",
    chapter: "7.4",
    category: "Price Action",
    description: "In uptrend (above 20-EMA), look for pullback to EMA then bounce. In downtrend: reverse.",
    indicators: ["EMA (20)"],
    book: "51 Trading Strategies",
    evaluate: pullbackStrategy,
  },
  {
    id: "repo-rate",
    name: "Trading Based on Repo Rates",
    chapter: "7.5",
    category: "Price Action",
    description: "Macro trend filter using 200-SMA + RSI. Above 200-SMA with RSI > 50 = macro bullish.",
    indicators: ["SMA (200)", "RSI (14)"],
    book: "51 Trading Strategies",
    evaluate: repoRateProxy,
  },
  {
    id: "vcp",
    name: "Volatility Contraction Pattern (VCP)",
    chapter: "7.6",
    category: "Price Action",
    description: "Series of tightening price ranges. Each successive range smaller = VCP setup. Buy on breakout.",
    indicators: ["Price Range Analysis"],
    book: "51 Trading Strategies",
    evaluate: vcpPattern,
  },
  {
    id: "two-leg-pullback",
    name: "Two-Legged Pullback",
    chapter: "7.7",
    category: "Price Action",
    description: "In uptrend: two consecutive lower closes followed by bullish candle = buy. In downtrend: reverse.",
    indicators: ["EMA (20)", "Price Action"],
    book: "51 Trading Strategies",
    evaluate: twoLeggedPullback,
  },

  // ═══════════════════════════════════════════════════════════════
  // BOOK 2: "The Intelligent Investor" by Benjamin Graham
  // ═══════════════════════════════════════════════════════════════

  {
    id: "graham-margin-of-safety",
    name: "Margin of Safety",
    chapter: "G1",
    category: "Value Investing",
    description: "Price well below 52-week high (at least 25% below). Buy when price is at significant discount from recent highs.",
    indicators: ["52-Week High (100 candles)", "Price"],
    book: "The Intelligent Investor",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 100) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const price = closes[closes.length - 1];
      const high52 = Math.max(...candles.slice(-100).map(c => c.high));
      const discount = (high52 - price) / high52;
      if (discount >= 0.25) {
        return { signal: "BUY", strength: Math.min(90, Math.round(discount * 200)), details: `Price ${(discount * 100).toFixed(1)}% below 52-week high (${high52.toFixed(2)}). Margin of safety present.` };
      }
      if (discount < 0.05) {
        return { signal: "SELL", strength: Math.min(70, Math.round((1 - discount) * 50)), details: `Price only ${(discount * 100).toFixed(1)}% below 52-week high. No margin of safety.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `Price ${(discount * 100).toFixed(1)}% below 52-week high. Moderate discount.` };
    },
  },
  {
    id: "graham-defensive-value",
    name: "Defensive Investor Screen",
    chapter: "G2",
    category: "Value Investing",
    description: "Stable stock: low volatility (ATR < 3% of price), price above 200-SMA, not at extreme overbought.",
    indicators: ["ATR (14)", "SMA (200)", "RSI (14)"],
    book: "The Intelligent Investor",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 200) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const price = closes[closes.length - 1];
      const atrVals = atr(highs, lows, closes, 14);
      const sma200 = sma(closes, 200);
      const rsiVals = rsi(closes, 14);
      const last = closes.length - 1;
      const atrVal = atrVals[last];
      const smaVal = sma200[last];
      const rsiVal = rsiVals[last];
      if (!atrVal || !smaVal || rsiVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient indicator data" };
      const atrPct = (atrVal / price) * 100;
      if (atrPct < 3 && price > smaVal && rsiVal < 70) {
        return { signal: "BUY", strength: Math.min(80, Math.round(70 + (70 - rsiVal))), details: `Defensive pick: Low volatility (ATR ${atrPct.toFixed(1)}%), above 200-SMA, RSI ${rsiVal.toFixed(1)}.` };
      }
      if (price < smaVal || rsiVal > 75) {
        return { signal: "SELL", strength: Math.min(65, Math.round(rsiVal - 50)), details: `Fails defensive screen: ${price < smaVal ? "below 200-SMA" : "RSI overbought at " + rsiVal.toFixed(1)}.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `ATR ${atrPct.toFixed(1)}% of price. Mixed signals for defensive investor.` };
    },
  },
  {
    id: "graham-mr-market",
    name: "Mr. Market Contrarian",
    chapter: "G3",
    category: "Value Investing",
    description: "Market overreaction detection. Buy extreme fear (RSI<25 + price >20% below 50-SMA). Sell extreme greed (RSI>80 + price >20% above 50-SMA).",
    indicators: ["RSI (14)", "SMA (50)"],
    book: "The Intelligent Investor",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 50) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const price = closes[closes.length - 1];
      const rsiVals = rsi(closes, 14);
      const sma50 = sma(closes, 50);
      const last = closes.length - 1;
      const rsiVal = rsiVals[last];
      const smaVal = sma50[last];
      if (rsiVal === null || !smaVal) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      const deviation = (price - smaVal) / smaVal;
      if (rsiVal < 25 && deviation < -0.20) {
        return { signal: "BUY", strength: Math.min(95, Math.round(90 + Math.abs(deviation) * 20)), details: `Mr. Market panic: RSI ${rsiVal.toFixed(1)}, price ${(deviation * 100).toFixed(1)}% below 50-SMA. Buy the fear.` };
      }
      if (rsiVal > 80 && deviation > 0.20) {
        return { signal: "SELL", strength: Math.min(95, Math.round(90 + deviation * 20)), details: `Mr. Market euphoria: RSI ${rsiVal.toFixed(1)}, price ${(deviation * 100).toFixed(1)}% above 50-SMA. Sell the greed.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `RSI ${rsiVal?.toFixed(1)}, deviation from 50-SMA: ${(deviation * 100).toFixed(1)}%. No extreme detected.` };
    },
  },
  {
    id: "graham-enterprising",
    name: "Enterprising Investor",
    chapter: "G4",
    category: "Value Investing",
    description: "Growth characteristics: price above 50 & 200 SMA, higher highs over 50 days, RSI 50-70.",
    indicators: ["SMA (50)", "SMA (200)", "RSI (14)"],
    book: "The Intelligent Investor",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 200) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const price = closes[closes.length - 1];
      const sma50 = sma(closes, 50);
      const sma200 = sma(closes, 200);
      const rsiVals = rsi(closes, 14);
      const last = closes.length - 1;
      const sma50Val = sma50[last];
      const sma200Val = sma200[last];
      const rsiVal = rsiVals[last];
      if (!sma50Val || !sma200Val || rsiVal === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      const recentHighs = candles.slice(-50).map(c => c.high);
      const firstHalfMax = Math.max(...recentHighs.slice(0, 25));
      const secondHalfMax = Math.max(...recentHighs.slice(25));
      const higherHighs = secondHalfMax > firstHalfMax;
      if (price > sma50Val && price > sma200Val && higherHighs && rsiVal >= 50 && rsiVal <= 70) {
        return { signal: "BUY", strength: Math.min(85, Math.round(60 + rsiVal - 50)), details: `Enterprising pick: Above both SMAs, making higher highs, RSI ${rsiVal.toFixed(1)} (trending, not overbought).` };
      }
      if (price < sma50Val && price < sma200Val) {
        return { signal: "SELL", strength: 60, details: `Below both 50 and 200 SMA. Not suitable for enterprising investor.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `Mixed signals. RSI: ${rsiVal?.toFixed(1)}. Higher highs: ${higherHighs}.` };
    },
  },
  {
    id: "graham-net-current-asset",
    name: "Net Current Asset Value",
    chapter: "G5",
    category: "Value Investing",
    description: "Proxy: stock near 52-week lows (bottom 15% of range) with improving momentum (RSI rising from oversold). Deep value play.",
    indicators: ["52-Week Range (100 candles)", "RSI (14)"],
    book: "The Intelligent Investor",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 100) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const price = closes[closes.length - 1];
      const high52 = Math.max(...candles.slice(-100).map(c => c.high));
      const low52 = Math.min(...candles.slice(-100).map(c => c.low));
      const range = high52 - low52;
      const posInRange = range > 0 ? (price - low52) / range : 0.5;
      const rsiVals = rsi(closes, 14);
      const last = closes.length - 1;
      const rsiVal = rsiVals[last];
      const rsiPrev = rsiVals[last - 1];
      if (rsiVal === null || rsiPrev === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      if (posInRange <= 0.15 && rsiVal > rsiPrev && rsiVal < 40) {
        return { signal: "BUY", strength: Math.min(85, Math.round(80 - posInRange * 200)), details: `Deep value: Price in bottom ${(posInRange * 100).toFixed(1)}% of 52-week range. RSI improving (${rsiVal.toFixed(1)}).` };
      }
      if (posInRange > 0.85) {
        return { signal: "SELL", strength: 50, details: `Near 52-week highs (${(posInRange * 100).toFixed(1)}% of range). Not a value play.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `Position in 52-week range: ${(posInRange * 100).toFixed(1)}%. RSI: ${rsiVal?.toFixed(1)}.` };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BOOK 3: "Technical Analysis of the Financial Markets" by John Murphy
  // ═══════════════════════════════════════════════════════════════

  {
    id: "murphy-triple-ma",
    name: "Triple Moving Average System",
    chapter: "M1",
    category: "Trend Following",
    description: "4-9-18 day moving averages. Buy when 4>9>18 (all aligned bullish). Sell when 4<9<18.",
    indicators: ["SMA (4)", "SMA (9)", "SMA (18)"],
    book: "Technical Analysis of the Financial Markets",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const sma4 = sma(closes, 4);
      const sma9 = sma(closes, 9);
      const sma18 = sma(closes, 18);
      const last = closes.length - 1;
      const s4 = sma4[last]; const s9 = sma9[last]; const s18 = sma18[last];
      if (!s4 || !s9 || !s18) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      if (s4 > s9 && s9 > s18) {
        const spread = ((s4 - s18) / s18) * 100;
        return { signal: "BUY", strength: Math.min(85, Math.round(50 + spread * 10)), details: `Triple MA aligned bullish: SMA4(${s4.toFixed(2)}) > SMA9(${s9.toFixed(2)}) > SMA18(${s18.toFixed(2)}).` };
      }
      if (s4 < s9 && s9 < s18) {
        const spread = ((s18 - s4) / s18) * 100;
        return { signal: "SELL", strength: Math.min(85, Math.round(50 + spread * 10)), details: `Triple MA aligned bearish: SMA4(${s4.toFixed(2)}) < SMA9(${s9.toFixed(2)}) < SMA18(${s18.toFixed(2)}).` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `MAs not aligned. SMA4: ${s4.toFixed(2)}, SMA9: ${s9.toFixed(2)}, SMA18: ${s18.toFixed(2)}.` };
    },
  },
  {
    id: "murphy-macd-histogram",
    name: "MACD Histogram Divergence",
    chapter: "M2",
    category: "Trend Following",
    description: "Bullish divergence: MACD histogram higher low while price makes lower low. Bearish: opposite.",
    indicators: ["MACD (12,26,9)", "Price"],
    book: "Technical Analysis of the Financial Markets",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 30) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const macdResult = macd(closes, 12, 26, 9);
      const last = closes.length - 1;
      const lookback = 10;
      if (last < lookback + 5) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      const recentHist = macdResult.histogram.slice(-lookback).filter((v): v is number => v !== null);
      const priorHist = macdResult.histogram.slice(-lookback * 2, -lookback).filter((v): v is number => v !== null);
      if (recentHist.length < 5 || priorHist.length < 5) return { signal: "NEUTRAL", strength: 0, details: "Insufficient MACD data" };
      const recentHistMin = Math.min(...recentHist);
      const priorHistMin = Math.min(...priorHist);
      const recentPriceLow = Math.min(...closes.slice(-lookback));
      const priorPriceLow = Math.min(...closes.slice(-lookback * 2, -lookback));
      if (recentPriceLow < priorPriceLow && recentHistMin > priorHistMin) {
        return { signal: "BUY", strength: 75, details: `Bullish divergence: Price made lower low but MACD histogram made higher low.` };
      }
      const recentHistMax = Math.max(...recentHist);
      const priorHistMax = Math.max(...priorHist);
      const recentPriceHigh = Math.max(...closes.slice(-lookback));
      const priorPriceHigh = Math.max(...closes.slice(-lookback * 2, -lookback));
      if (recentPriceHigh > priorPriceHigh && recentHistMax < priorHistMax) {
        return { signal: "SELL", strength: 75, details: `Bearish divergence: Price made higher high but MACD histogram made lower high.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: "No MACD histogram divergence detected." };
    },
  },
  {
    id: "murphy-rsi-70-30",
    name: "RSI 70/30 System",
    chapter: "M3",
    category: "Trend Following",
    description: "Buy when RSI crosses above 30 from below. Sell when RSI crosses below 70 from above. Centerline 50 adds confirmation.",
    indicators: ["RSI (14)"],
    book: "Technical Analysis of the Financial Markets",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const rsiVals = rsi(closes, 14);
      const last = closes.length - 1;
      const rsiVal = rsiVals[last];
      const rsiPrev = rsiVals[last - 1];
      if (rsiVal === null || rsiPrev === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      if (rsiPrev < 30 && rsiVal >= 30) {
        return { signal: "BUY", strength: Math.min(80, Math.round(60 + (30 - rsiPrev))), details: `RSI crossed above 30 (${rsiVal.toFixed(1)} from ${rsiPrev.toFixed(1)}). Oversold reversal.` };
      }
      if (rsiPrev > 70 && rsiVal <= 70) {
        return { signal: "SELL", strength: Math.min(80, Math.round(60 + (rsiPrev - 70))), details: `RSI crossed below 70 (${rsiVal.toFixed(1)} from ${rsiPrev.toFixed(1)}). Overbought reversal.` };
      }
      if (rsiPrev < 50 && rsiVal >= 50) {
        return { signal: "BUY", strength: 45, details: `RSI crossed above centerline 50 (${rsiVal.toFixed(1)}). Moderate bullish.` };
      }
      if (rsiPrev > 50 && rsiVal <= 50) {
        return { signal: "SELL", strength: 45, details: `RSI crossed below centerline 50 (${rsiVal.toFixed(1)}). Moderate bearish.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `RSI at ${rsiVal.toFixed(1)}. No crossover detected.` };
    },
  },
  {
    id: "murphy-stochastic-kd",
    name: "Stochastic %K/%D System",
    chapter: "M4",
    category: "Trend Following",
    description: "Buy when %K crosses above %D in oversold (<20). Sell when %K crosses below %D in overbought (>80).",
    indicators: ["Stochastic (14)"],
    book: "Technical Analysis of the Financial Markets",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const closes = candles.map(c => c.close);
      const last = closes.length - 1;
      const period = 14;
      const calcK = (idx: number): number | null => {
        if (idx < period - 1) return null;
        const hh = Math.max(...highs.slice(idx - period + 1, idx + 1));
        const ll = Math.min(...lows.slice(idx - period + 1, idx + 1));
        return hh === ll ? 50 : ((closes[idx] - ll) / (hh - ll)) * 100;
      };
      const kVals: (number | null)[] = [];
      for (let i = 0; i < closes.length; i++) kVals.push(calcK(i));
      const kNumbers = kVals.filter((v): v is number => v !== null);
      const dVals = sma(kNumbers, 3);
      const kVal = kVals[last];
      const kPrev = kVals[last - 1];
      const dVal = dVals.length > 0 ? dVals[dVals.length - 1] : null;
      const dPrev = dVals.length > 1 ? dVals[dVals.length - 2] : null;
      if (kVal === null || kPrev === null || !dVal || !dPrev) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      if (kPrev < dPrev && kVal > dVal && kVal < 20) {
        return { signal: "BUY", strength: Math.min(85, Math.round(70 + (20 - kVal))), details: `Stochastic bullish crossover in oversold zone. %K: ${kVal.toFixed(1)}, %D: ${dVal.toFixed(1)}.` };
      }
      if (kPrev > dPrev && kVal < dVal && kVal > 80) {
        return { signal: "SELL", strength: Math.min(85, Math.round(70 + (kVal - 80))), details: `Stochastic bearish crossover in overbought zone. %K: ${kVal.toFixed(1)}, %D: ${dVal.toFixed(1)}.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `Stochastic %K: ${kVal.toFixed(1)}, %D: ${dVal.toFixed(1)}. No signal.` };
    },
  },
  {
    id: "murphy-support-resistance",
    name: "Support/Resistance Breakout",
    chapter: "M5",
    category: "Trend Following",
    description: "Identify 20-bar support/resistance. Buy on breakout above resistance with volume. Sell on breakdown below support.",
    indicators: ["20-Bar High/Low", "Volume"],
    book: "Technical Analysis of the Financial Markets",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const last = candles.length - 1;
      const lookback = candles.slice(-21, -1);
      const resistance = Math.max(...lookback.map(c => c.high));
      const support = Math.min(...lookback.map(c => c.low));
      const price = candles[last].close;
      const vol = candles[last].volume;
      const avgVol = lookback.reduce((s, c) => s + c.volume, 0) / lookback.length;
      const volRatio = vol / avgVol;
      if (price > resistance && volRatio > 1.2) {
        return { signal: "BUY", strength: Math.min(90, Math.round(60 + volRatio * 15)), details: `Breakout above resistance ${resistance.toFixed(2)} with ${volRatio.toFixed(1)}x avg volume.` };
      }
      if (price < support && volRatio > 1.2) {
        return { signal: "SELL", strength: Math.min(90, Math.round(60 + volRatio * 15)), details: `Breakdown below support ${support.toFixed(2)} with ${volRatio.toFixed(1)}x avg volume.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `Price between support(${support.toFixed(2)}) and resistance(${resistance.toFixed(2)}).` };
    },
  },
  {
    id: "murphy-head-shoulders",
    name: "Head & Shoulders Detection",
    chapter: "M6",
    category: "Trend Following",
    description: "Simplified H&S: middle peak highest among 3 peaks in last 30 candles. Break below neckline = bearish. Inverse for bullish.",
    indicators: ["Price Pattern (30 candles)"],
    book: "Technical Analysis of the Financial Markets",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 35) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const recent = candles.slice(-30);
      const highs = recent.map(c => c.high);
      const lows = recent.map(c => c.low);
      const thirds = [highs.slice(0, 10), highs.slice(10, 20), highs.slice(20, 30)];
      const peaks = thirds.map(t => Math.max(...t));
      const troughs = [Math.min(...lows.slice(8, 12)), Math.min(...lows.slice(18, 22))];
      const price = candles[candles.length - 1].close;
      // Head and shoulders top
      if (peaks[1] > peaks[0] && peaks[1] > peaks[2] && Math.abs(peaks[0] - peaks[2]) / peaks[1] < 0.05) {
        const neckline = (troughs[0] + troughs[1]) / 2;
        if (price < neckline) {
          return { signal: "SELL", strength: 80, details: `Head & Shoulders pattern detected. Neckline ${neckline.toFixed(2)} broken. Head: ${peaks[1].toFixed(2)}.` };
        }
      }
      // Inverse head and shoulders
      const lowThirds = [lows.slice(0, 10), lows.slice(10, 20), lows.slice(20, 30)];
      const valleys = lowThirds.map(t => Math.min(...t));
      const ridges = [Math.max(...highs.slice(8, 12)), Math.max(...highs.slice(18, 22))];
      if (valleys[1] < valleys[0] && valleys[1] < valleys[2] && Math.abs(valleys[0] - valleys[2]) / valleys[1] < 0.05) {
        const neckline = (ridges[0] + ridges[1]) / 2;
        if (price > neckline) {
          return { signal: "BUY", strength: 80, details: `Inverse Head & Shoulders pattern. Neckline ${neckline.toFixed(2)} broken upward.` };
        }
      }
      return { signal: "NEUTRAL", strength: 0, details: "No clear Head & Shoulders pattern detected." };
    },
  },
  {
    id: "murphy-double-top-bottom",
    name: "Double Top/Bottom",
    chapter: "M7",
    category: "Trend Following",
    description: "Two peaks/troughs at similar levels (within 2%) in last 30 candles. Double bottom + breakout = buy. Double top + breakdown = sell.",
    indicators: ["Price Pattern (30 candles)"],
    book: "Technical Analysis of the Financial Markets",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 35) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const recent = candles.slice(-30);
      const highs = recent.map(c => c.high);
      const lows = recent.map(c => c.low);
      const price = candles[candles.length - 1].close;
      const firstHalf = { high: Math.max(...highs.slice(0, 15)), low: Math.min(...lows.slice(0, 15)) };
      const secondHalf = { high: Math.max(...highs.slice(15)), low: Math.min(...lows.slice(15)) };
      // Double top
      if (Math.abs(firstHalf.high - secondHalf.high) / firstHalf.high < 0.02) {
        const trough = Math.min(...lows.slice(10, 20));
        if (price < trough) {
          return { signal: "SELL", strength: 75, details: `Double top at ~${firstHalf.high.toFixed(2)}. Trough ${trough.toFixed(2)} broken.` };
        }
      }
      // Double bottom
      if (Math.abs(firstHalf.low - secondHalf.low) / firstHalf.low < 0.02) {
        const peak = Math.max(...highs.slice(10, 20));
        if (price > peak) {
          return { signal: "BUY", strength: 75, details: `Double bottom at ~${firstHalf.low.toFixed(2)}. Peak ${peak.toFixed(2)} broken upward.` };
        }
      }
      return { signal: "NEUTRAL", strength: 0, details: "No confirmed double top/bottom pattern." };
    },
  },
  {
    id: "murphy-volume-confirmation",
    name: "Volume Price Confirmation",
    chapter: "M8",
    category: "Trend Following",
    description: "Price rising + volume rising = strong uptrend. Price falling + volume rising = strong downtrend. Price rising + volume falling = weak rally.",
    indicators: ["Price Trend", "Volume Trend"],
    book: "Technical Analysis of the Financial Markets",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 15) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const recent = candles.slice(-10);
      const priceChange = (recent[recent.length - 1].close - recent[0].close) / recent[0].close;
      const firstHalfVol = recent.slice(0, 5).reduce((s, c) => s + c.volume, 0) / 5;
      const secondHalfVol = recent.slice(5).reduce((s, c) => s + c.volume, 0) / 5;
      const volTrend = secondHalfVol > firstHalfVol;
      if (priceChange > 0.01 && volTrend) {
        return { signal: "BUY", strength: Math.min(80, Math.round(50 + priceChange * 1000)), details: `Strong uptrend: Price up ${(priceChange * 100).toFixed(1)}% with rising volume. Confirmed.` };
      }
      if (priceChange < -0.01 && volTrend) {
        return { signal: "SELL", strength: Math.min(80, Math.round(50 + Math.abs(priceChange) * 1000)), details: `Strong downtrend: Price down ${(priceChange * 100).toFixed(1)}% with rising volume. Confirmed.` };
      }
      if (priceChange > 0.01 && !volTrend) {
        return { signal: "NEUTRAL", strength: 30, details: `Weak rally: Price up ${(priceChange * 100).toFixed(1)}% but volume declining. Caution.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `Price change: ${(priceChange * 100).toFixed(1)}%. Volume ${volTrend ? "rising" : "falling"}.` };
    },
  },
  {
    id: "murphy-ma-envelope",
    name: "Moving Average Envelope",
    chapter: "M9",
    category: "Trend Following",
    description: "Price outside 3% envelope around 20-SMA. Above upper = overbought (sell). Below lower = oversold (buy).",
    indicators: ["SMA (20)", "3% Envelope"],
    book: "Technical Analysis of the Financial Markets",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const sma20 = sma(closes, 20);
      const last = closes.length - 1;
      const smaVal = sma20[last];
      if (!smaVal) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      const price = closes[last];
      const upperEnv = smaVal * 1.03;
      const lowerEnv = smaVal * 0.97;
      const deviation = (price - smaVal) / smaVal;
      if (price < lowerEnv) {
        return { signal: "BUY", strength: Math.min(80, Math.round(60 + Math.abs(deviation) * 500)), details: `Price ${(deviation * 100).toFixed(1)}% below 20-SMA. Below lower envelope (${lowerEnv.toFixed(2)}). Oversold.` };
      }
      if (price > upperEnv) {
        return { signal: "SELL", strength: Math.min(80, Math.round(60 + deviation * 500)), details: `Price ${(deviation * 100).toFixed(1)}% above 20-SMA. Above upper envelope (${upperEnv.toFixed(2)}). Overbought.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `Price within 3% envelope of 20-SMA. Deviation: ${(deviation * 100).toFixed(1)}%.` };
    },
  },
  {
    id: "murphy-roc",
    name: "Rate of Change Momentum",
    chapter: "M10",
    category: "Trend Following",
    description: "12-period ROC. Buy when ROC crosses above 0 from negative. Sell when crosses below 0 from positive.",
    indicators: ["ROC (12)"],
    book: "Technical Analysis of the Financial Markets",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 15) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const last = closes.length - 1;
      const roc = ((closes[last] - closes[last - 12]) / closes[last - 12]) * 100;
      const rocPrev = ((closes[last - 1] - closes[last - 13]) / closes[last - 13]) * 100;
      if (rocPrev < 0 && roc >= 0) {
        return { signal: "BUY", strength: Math.min(75, Math.round(55 + Math.abs(roc) * 5)), details: `ROC crossed above zero (${roc.toFixed(2)}% from ${rocPrev.toFixed(2)}%). Momentum turning positive.` };
      }
      if (rocPrev > 0 && roc <= 0) {
        return { signal: "SELL", strength: Math.min(75, Math.round(55 + Math.abs(roc) * 5)), details: `ROC crossed below zero (${roc.toFixed(2)}% from ${rocPrev.toFixed(2)}%). Momentum turning negative.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `ROC: ${roc.toFixed(2)}%. No zero-line crossover.` };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BOOK 4: "Japanese Candlestick Charting Techniques" by Steve Nison
  // ═══════════════════════════════════════════════════════════════

  {
    id: "nison-hammer",
    name: "Hammer Pattern",
    chapter: "N1",
    category: "Candlestick",
    description: "Bullish reversal: Long lower shadow (>= 2x body), small body at top, appears after downtrend (price below 20-EMA).",
    indicators: ["EMA (20)", "Candlestick Pattern"],
    book: "Japanese Candlestick Charting Techniques",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const ema20 = ema(closes, 20);
      const last = candles.length - 1;
      const c = candles[last];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      const lowerShadow = Math.min(c.open, c.close) - c.low;
      const upperShadow = c.high - Math.max(c.open, c.close);
      const emaVal = ema20[last];
      if (!emaVal || range === 0) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      const isHammer = lowerShadow >= 2 * body && upperShadow < body && body > 0;
      const inDowntrend = c.close < emaVal;
      if (isHammer && inDowntrend) {
        return { signal: "BUY", strength: Math.min(80, Math.round(60 + (lowerShadow / range) * 30)), details: `Hammer pattern detected. Lower shadow ${(lowerShadow / body).toFixed(1)}x body. Price below 20-EMA (downtrend context).` };
      }
      return { signal: "NEUTRAL", strength: 0, details: "No hammer pattern in downtrend context." };
    },
  },
  {
    id: "nison-engulfing",
    name: "Engulfing Pattern",
    chapter: "N2",
    category: "Candlestick",
    description: "Bullish engulfing: current green candle body engulfs previous red candle body, after downtrend. Bearish: reverse.",
    indicators: ["EMA (20)", "Candlestick Pattern"],
    book: "Japanese Candlestick Charting Techniques",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const ema20 = ema(closes, 20);
      const last = candles.length - 1;
      const curr = candles[last];
      const prev = candles[last - 1];
      const emaVal = ema20[last];
      if (!emaVal) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      const currBody = curr.close - curr.open;
      const prevBody = prev.close - prev.open;
      // Bullish engulfing
      if (prevBody < 0 && currBody > 0 && curr.open <= prev.close && curr.close >= prev.open && prev.close < emaVal) {
        return { signal: "BUY", strength: Math.min(85, Math.round(65 + Math.abs(currBody / prev.close) * 500)), details: `Bullish engulfing: Green candle engulfs prior red candle. Downtrend context (below 20-EMA).` };
      }
      // Bearish engulfing
      if (prevBody > 0 && currBody < 0 && curr.open >= prev.close && curr.close <= prev.open && prev.close > emaVal) {
        return { signal: "SELL", strength: Math.min(85, Math.round(65 + Math.abs(currBody / prev.close) * 500)), details: `Bearish engulfing: Red candle engulfs prior green candle. Uptrend context (above 20-EMA).` };
      }
      return { signal: "NEUTRAL", strength: 0, details: "No engulfing pattern detected." };
    },
  },
  {
    id: "nison-doji-star",
    name: "Doji Star",
    chapter: "N3",
    category: "Candlestick",
    description: "Doji (body < 10% of range) after trending move. Doji after uptrend = sell signal. Doji after downtrend = buy signal.",
    indicators: ["EMA (20)", "Candlestick Pattern"],
    book: "Japanese Candlestick Charting Techniques",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const ema20 = ema(closes, 20);
      const last = candles.length - 1;
      const c = candles[last];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      const emaVal = ema20[last];
      if (!emaVal || range === 0) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      const isDoji = body / range < 0.1;
      if (!isDoji) return { signal: "NEUTRAL", strength: 0, details: `Not a doji. Body/range ratio: ${(body / range * 100).toFixed(1)}%.` };
      // Check trend context using last 5 candles
      const recentTrend = closes[last - 1] - closes[last - 5];
      if (recentTrend < 0 && c.close < emaVal) {
        return { signal: "BUY", strength: 65, details: `Doji star after downtrend. Potential bullish reversal.` };
      }
      if (recentTrend > 0 && c.close > emaVal) {
        return { signal: "SELL", strength: 65, details: `Doji star after uptrend. Potential bearish reversal.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: "Doji detected but no clear trend context." };
    },
  },
  {
    id: "nison-morning-evening-star",
    name: "Morning/Evening Star",
    chapter: "N4",
    category: "Candlestick",
    description: "3-candle pattern. Morning star: big red, small body, big green = bullish. Evening star: big green, small body, big red = bearish.",
    indicators: ["Candlestick Pattern"],
    book: "Japanese Candlestick Charting Techniques",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 5) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const last = candles.length - 1;
      const c1 = candles[last - 2];
      const c2 = candles[last - 1];
      const c3 = candles[last];
      const body1 = Math.abs(c1.close - c1.open);
      const body2 = Math.abs(c2.close - c2.open);
      const body3 = Math.abs(c3.close - c3.open);
      const range1 = c1.high - c1.low;
      const range3 = c3.high - c3.low;
      const isSmallMiddle = body2 < body1 * 0.3 && body2 < body3 * 0.3;
      // Morning star
      if (c1.close < c1.open && c3.close > c3.open && isSmallMiddle && body1 > range1 * 0.5 && body3 > range3 * 0.5) {
        return { signal: "BUY", strength: 80, details: `Morning star: Big red, small body, big green. Strong bullish reversal.` };
      }
      // Evening star
      if (c1.close > c1.open && c3.close < c3.open && isSmallMiddle && body1 > range1 * 0.5 && body3 > range3 * 0.5) {
        return { signal: "SELL", strength: 80, details: `Evening star: Big green, small body, big red. Strong bearish reversal.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: "No morning/evening star pattern detected." };
    },
  },
  {
    id: "nison-dark-cloud-piercing",
    name: "Dark Cloud Cover / Piercing Pattern",
    chapter: "N5",
    category: "Candlestick",
    description: "Dark cloud: green then red opening above high but closing below midpoint = bearish. Piercing: reverse = bullish.",
    indicators: ["Candlestick Pattern"],
    book: "Japanese Candlestick Charting Techniques",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 5) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const last = candles.length - 1;
      const prev = candles[last - 1];
      const curr = candles[last];
      const prevMid = (prev.open + prev.close) / 2;
      // Dark Cloud Cover
      if (prev.close > prev.open && curr.close < curr.open && curr.open > prev.high && curr.close < prevMid && curr.close > prev.open) {
        return { signal: "SELL", strength: 75, details: `Dark Cloud Cover: Red candle opened above prior high, closed below prior midpoint.` };
      }
      // Piercing Pattern
      if (prev.close < prev.open && curr.close > curr.open && curr.open < prev.low && curr.close > prevMid && curr.close < prev.open) {
        return { signal: "BUY", strength: 75, details: `Piercing Pattern: Green candle opened below prior low, closed above prior midpoint.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: "No dark cloud cover or piercing pattern detected." };
    },
  },
  {
    id: "nison-three-soldiers-crows",
    name: "Three White Soldiers / Three Black Crows",
    chapter: "N6",
    category: "Candlestick",
    description: "3 consecutive bullish candles with higher closes = strong buy. 3 bearish with lower closes = strong sell.",
    indicators: ["Candlestick Pattern"],
    book: "Japanese Candlestick Charting Techniques",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 5) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const last = candles.length - 1;
      const c1 = candles[last - 2];
      const c2 = candles[last - 1];
      const c3 = candles[last];
      const allBullish = c1.close > c1.open && c2.close > c2.open && c3.close > c3.open;
      const allBearish = c1.close < c1.open && c2.close < c2.open && c3.close < c3.open;
      const higherCloses = c3.close > c2.close && c2.close > c1.close;
      const lowerCloses = c3.close < c2.close && c2.close < c1.close;
      if (allBullish && higherCloses) {
        return { signal: "BUY", strength: 85, details: `Three White Soldiers: 3 consecutive bullish candles with progressively higher closes.` };
      }
      if (allBearish && lowerCloses) {
        return { signal: "SELL", strength: 85, details: `Three Black Crows: 3 consecutive bearish candles with progressively lower closes.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: "No three soldiers/crows pattern detected." };
    },
  },
  {
    id: "nison-harami",
    name: "Harami Pattern",
    chapter: "N7",
    category: "Candlestick",
    description: "Small candle contained within previous large candle. Bullish harami in downtrend = buy. Bearish harami in uptrend = sell.",
    indicators: ["EMA (20)", "Candlestick Pattern"],
    book: "Japanese Candlestick Charting Techniques",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const ema20 = ema(closes, 20);
      const last = candles.length - 1;
      const prev = candles[last - 1];
      const curr = candles[last];
      const emaVal = ema20[last];
      if (!emaVal) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      const prevBodyHigh = Math.max(prev.open, prev.close);
      const prevBodyLow = Math.min(prev.open, prev.close);
      const currBodyHigh = Math.max(curr.open, curr.close);
      const currBodyLow = Math.min(curr.open, curr.close);
      const isHarami = currBodyHigh < prevBodyHigh && currBodyLow > prevBodyLow;
      const prevBodySize = prevBodyHigh - prevBodyLow;
      const currBodySize = currBodyHigh - currBodyLow;
      if (!isHarami || currBodySize > prevBodySize * 0.5) return { signal: "NEUTRAL", strength: 0, details: "No harami pattern detected." };
      if (prev.close < prev.open && curr.close < emaVal) {
        return { signal: "BUY", strength: 65, details: `Bullish harami: Small candle inside prior large red candle. Downtrend context.` };
      }
      if (prev.close > prev.open && curr.close > emaVal) {
        return { signal: "SELL", strength: 65, details: `Bearish harami: Small candle inside prior large green candle. Uptrend context.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: "Harami detected but no clear trend context." };
    },
  },
  {
    id: "nison-shooting-star",
    name: "Shooting Star / Inverted Hammer",
    chapter: "N8",
    category: "Candlestick",
    description: "Long upper shadow, small body at bottom. Shooting star after uptrend = sell. Inverted hammer after downtrend = buy.",
    indicators: ["EMA (20)", "Candlestick Pattern"],
    book: "Japanese Candlestick Charting Techniques",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const ema20 = ema(closes, 20);
      const last = candles.length - 1;
      const c = candles[last];
      const body = Math.abs(c.close - c.open);
      const upperShadow = c.high - Math.max(c.open, c.close);
      const lowerShadow = Math.min(c.open, c.close) - c.low;
      const emaVal = ema20[last];
      if (!emaVal || body === 0) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      const isShootingStar = upperShadow >= 2 * body && lowerShadow < body;
      if (!isShootingStar) return { signal: "NEUTRAL", strength: 0, details: "No shooting star / inverted hammer pattern." };
      if (c.close > emaVal) {
        return { signal: "SELL", strength: Math.min(75, Math.round(55 + (upperShadow / body) * 5)), details: `Shooting star after uptrend. Upper shadow ${(upperShadow / body).toFixed(1)}x body. Bearish reversal.` };
      }
      if (c.close < emaVal) {
        return { signal: "BUY", strength: Math.min(70, Math.round(50 + (upperShadow / body) * 5)), details: `Inverted hammer after downtrend. Potential bullish reversal signal.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: "Shooting star shape but no clear trend context." };
    },
  },
  {
    id: "nison-tweezers",
    name: "Tweezers Top/Bottom",
    chapter: "N9",
    category: "Candlestick",
    description: "Two candles with matching highs (tweezer top = sell) or matching lows (tweezer bottom = buy). Matching within 0.3%.",
    indicators: ["Candlestick Pattern"],
    book: "Japanese Candlestick Charting Techniques",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 5) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const last = candles.length - 1;
      const prev = candles[last - 1];
      const curr = candles[last];
      const highMatch = Math.abs(prev.high - curr.high) / prev.high < 0.003;
      const lowMatch = Math.abs(prev.low - curr.low) / prev.low < 0.003;
      // Tweezer top: matching highs, first bullish, second bearish
      if (highMatch && prev.close > prev.open && curr.close < curr.open) {
        return { signal: "SELL", strength: 70, details: `Tweezer top: Matching highs at ~${curr.high.toFixed(2)}. Bearish reversal signal.` };
      }
      // Tweezer bottom: matching lows, first bearish, second bullish
      if (lowMatch && prev.close < prev.open && curr.close > curr.open) {
        return { signal: "BUY", strength: 70, details: `Tweezer bottom: Matching lows at ~${curr.low.toFixed(2)}. Bullish reversal signal.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: "No tweezer pattern detected." };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BOOK 5: "The Little Book of Common Sense Investing" by John Bogle
  // ═══════════════════════════════════════════════════════════════

  {
    id: "bogle-trend-following",
    name: "Bogle Long-Term Trend",
    chapter: "B1",
    category: "Index Investing",
    description: "Price above 200-SMA = long-term uptrend, stay invested. Below = caution. Simple long-term positioning.",
    indicators: ["SMA (200)"],
    book: "The Little Book of Common Sense Investing",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 200) return { signal: "NEUTRAL", strength: 0, details: "Not enough data (need 200+ candles)" };
      const closes = candles.map(c => c.close);
      const sma200 = sma(closes, 200);
      const last = closes.length - 1;
      const smaVal = sma200[last];
      const price = closes[last];
      if (!smaVal) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      const deviation = (price - smaVal) / smaVal;
      if (price > smaVal) {
        return { signal: "BUY", strength: Math.min(75, Math.round(50 + deviation * 200)), details: `Long-term uptrend: Price ${(deviation * 100).toFixed(1)}% above 200-SMA. Stay invested.` };
      }
      return { signal: "SELL", strength: Math.min(65, Math.round(40 + Math.abs(deviation) * 200)), details: `Below 200-SMA by ${(Math.abs(deviation) * 100).toFixed(1)}%. Long-term caution.` };
    },
  },
  {
    id: "bogle-mean-reversion",
    name: "Mean Reversion to Average",
    chapter: "B2",
    category: "Index Investing",
    description: "When price deviates >10% from 100-SMA, expect reversion. Below by 10% = buy. Above by 10% = sell/reduce.",
    indicators: ["SMA (100)"],
    book: "The Little Book of Common Sense Investing",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 100) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const sma100 = sma(closes, 100);
      const last = closes.length - 1;
      const smaVal = sma100[last];
      const price = closes[last];
      if (!smaVal) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      const deviation = (price - smaVal) / smaVal;
      if (deviation < -0.10) {
        return { signal: "BUY", strength: Math.min(85, Math.round(60 + Math.abs(deviation) * 200)), details: `Mean reversion: Price ${(Math.abs(deviation) * 100).toFixed(1)}% below 100-SMA. Expect reversion upward.` };
      }
      if (deviation > 0.10) {
        return { signal: "SELL", strength: Math.min(85, Math.round(60 + deviation * 200)), details: `Mean reversion: Price ${(deviation * 100).toFixed(1)}% above 100-SMA. Expect reversion downward.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `Price within 10% of 100-SMA. Deviation: ${(deviation * 100).toFixed(1)}%.` };
    },
  },
  {
    id: "bogle-low-cost-momentum",
    name: "Low-Cost Momentum",
    chapter: "B3",
    category: "Index Investing",
    description: "Low volatility (ATR < avg ATR) + positive trend (above 50 and 100 SMA) = good steady investment.",
    indicators: ["ATR (14)", "SMA (50)", "SMA (100)"],
    book: "The Little Book of Common Sense Investing",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 100) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const price = closes[closes.length - 1];
      const atrVals = atr(highs, lows, closes, 14);
      const sma50 = sma(closes, 50);
      const sma100 = sma(closes, 100);
      const last = closes.length - 1;
      const atrVal = atrVals[last];
      const sma50Val = sma50[last];
      const sma100Val = sma100[last];
      if (!atrVal || !sma50Val || !sma100Val) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      const atrRecent = atrVals.slice(-20).filter((v): v is number => v !== null);
      const avgAtr = atrRecent.reduce((s, v) => s + v, 0) / atrRecent.length;
      const lowVol = atrVal < avgAtr;
      const aboveSmas = price > sma50Val && price > sma100Val;
      if (lowVol && aboveSmas) {
        return { signal: "BUY", strength: Math.min(75, Math.round(55 + (1 - atrVal / avgAtr) * 50)), details: `Low-cost momentum: Low volatility (ATR ${atrVal.toFixed(2)} < avg ${avgAtr.toFixed(2)}) + above 50 & 100 SMA. Steady investment.` };
      }
      if (!aboveSmas) {
        return { signal: "SELL", strength: 45, details: `Below key SMAs. Not a steady investment candidate.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `Above SMAs but volatility elevated. ATR: ${atrVal.toFixed(2)} vs avg ${avgAtr.toFixed(2)}.` };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BOOK 6: "Market Wizards" by Jack Schwager
  // ═══════════════════════════════════════════════════════════════

  {
    id: "wizard-trend-breakout",
    name: "Trend Breakout (Turtle Style)",
    chapter: "W1",
    category: "Trend Following",
    description: "Buy when price breaks above 20-day high. Sell when breaks below 20-day low. Classic Richard Dennis / Turtle breakout.",
    indicators: ["20-Day High/Low"],
    book: "Market Wizards",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const last = candles.length - 1;
      const lookback = candles.slice(-21, -1);
      const high20 = Math.max(...lookback.map(c => c.high));
      const low20 = Math.min(...lookback.map(c => c.low));
      const price = candles[last].close;
      if (price > high20) {
        const breakPct = ((price - high20) / high20) * 100;
        return { signal: "BUY", strength: Math.min(85, Math.round(60 + breakPct * 10)), details: `Turtle breakout: Price ${price.toFixed(2)} above 20-day high ${high20.toFixed(2)} (+${breakPct.toFixed(1)}%).` };
      }
      if (price < low20) {
        const breakPct = ((low20 - price) / low20) * 100;
        return { signal: "SELL", strength: Math.min(85, Math.round(60 + breakPct * 10)), details: `Turtle breakdown: Price ${price.toFixed(2)} below 20-day low ${low20.toFixed(2)} (-${breakPct.toFixed(1)}%).` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `Price between 20-day low (${low20.toFixed(2)}) and high (${high20.toFixed(2)}).` };
    },
  },
  {
    id: "wizard-risk-reward",
    name: "Risk-Adjusted Entry (Larry Hite)",
    chapter: "W2",
    category: "Trend Following",
    description: "Enter near support (within 2% of 20-day low) with uptrend context (above 50-SMA). Tight risk, high reward.",
    indicators: ["20-Day Low", "SMA (50)"],
    book: "Market Wizards",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 55) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const last = closes.length - 1;
      const price = closes[last];
      const lookback = candles.slice(-21, -1);
      const low20 = Math.min(...lookback.map(c => c.low));
      const sma50 = sma(closes, 50);
      const smaVal = sma50[last];
      if (!smaVal) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      const distFromLow = (price - low20) / low20;
      if (distFromLow <= 0.02 && price > smaVal) {
        return { signal: "BUY", strength: Math.min(80, Math.round(65 + (0.02 - distFromLow) * 1000)), details: `Risk-adjusted entry: Price within ${(distFromLow * 100).toFixed(1)}% of 20-day low, above 50-SMA. Tight stop possible.` };
      }
      if (price < smaVal && distFromLow > 0.05) {
        return { signal: "SELL", strength: 50, details: `Below 50-SMA and not near support. Unfavorable risk/reward.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `${(distFromLow * 100).toFixed(1)}% from 20-day low. ${price > smaVal ? "Above" : "Below"} 50-SMA.` };
    },
  },
  {
    id: "wizard-seykota-trend",
    name: "Seykota Trend System",
    chapter: "W3",
    category: "Trend Following",
    description: "Long-term trend (price vs 50-EMA) + momentum (MACD histogram positive and rising). Both must align.",
    indicators: ["EMA (50)", "MACD (12,26,9)"],
    book: "Market Wizards",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 55) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const ema50 = ema(closes, 50);
      const macdResult = macd(closes, 12, 26, 9);
      const last = closes.length - 1;
      const price = closes[last];
      const emaVal = ema50[last];
      const hist = macdResult.histogram[last];
      const histPrev = macdResult.histogram[last - 1];
      if (!emaVal || hist === null || histPrev === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      if (price > emaVal && hist > 0 && hist > histPrev) {
        return { signal: "BUY", strength: Math.min(85, Math.round(60 + hist * 10)), details: `Seykota system: Above 50-EMA + MACD histogram positive (${hist.toFixed(3)}) and rising. Trend + momentum aligned.` };
      }
      if (price < emaVal && hist < 0 && hist < histPrev) {
        return { signal: "SELL", strength: Math.min(85, Math.round(60 + Math.abs(hist) * 10)), details: `Seykota system: Below 50-EMA + MACD histogram negative (${hist.toFixed(3)}) and falling. Bearish alignment.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `Trend and momentum not aligned. Price ${price > emaVal ? "above" : "below"} 50-EMA, MACD hist: ${hist?.toFixed(3)}.` };
    },
  },
  {
    id: "wizard-weinstein-stage",
    name: "Weinstein Stage Analysis",
    chapter: "W4",
    category: "Trend Following",
    description: "Stage 2 breakout: price breaks above flattening 150-day SMA + volume surge (above 1.5x 20-day avg).",
    indicators: ["SMA (150)", "Volume (20-day avg)"],
    book: "Market Wizards",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 155) return { signal: "NEUTRAL", strength: 0, details: "Not enough data (need 155+ candles)" };
      const closes = candles.map(c => c.close);
      const sma150 = sma(closes, 150);
      const last = closes.length - 1;
      const smaVal = sma150[last];
      const smaPrev = sma150[last - 5];
      const price = closes[last];
      if (!smaVal || !smaPrev) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      const smaSlope = (smaVal - smaPrev) / smaPrev;
      const isFlattening = Math.abs(smaSlope) < 0.005;
      const vol = candles[last].volume;
      const avgVol = candles.slice(-21, -1).reduce((s, c) => s + c.volume, 0) / 20;
      const volRatio = vol / avgVol;
      if (price > smaVal && isFlattening && volRatio > 1.5) {
        return { signal: "BUY", strength: Math.min(90, Math.round(70 + volRatio * 5)), details: `Weinstein Stage 2: Price above flattening 150-SMA, volume ${volRatio.toFixed(1)}x average. Ideal breakout.` };
      }
      if (price < smaVal && smaSlope < -0.005) {
        return { signal: "SELL", strength: 60, details: `Stage 4 decline: Below declining 150-SMA. Avoid.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `SMA150 slope: ${(smaSlope * 100).toFixed(2)}%. Volume ratio: ${volRatio.toFixed(1)}x.` };
    },
  },
  {
    id: "wizard-schwartz-momentum",
    name: "Marty Schwartz Momentum",
    chapter: "W5",
    category: "Trend Following",
    description: "10-EMA above 40-EMA = bullish. When both rising and price pulls back to 10-EMA, that is the buy point.",
    indicators: ["EMA (10)", "EMA (40)"],
    book: "Market Wizards",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 45) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const ema10 = ema(closes, 10);
      const ema40 = ema(closes, 40);
      const last = closes.length - 1;
      const ema10Val = ema10[last];
      const ema40Val = ema40[last];
      const ema10Prev = ema10[last - 3];
      const ema40Prev = ema40[last - 3];
      const price = closes[last];
      if (!ema10Val || !ema40Val || !ema10Prev || !ema40Prev) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      const ema10Rising = ema10Val > ema10Prev;
      const ema40Rising = ema40Val > ema40Prev;
      const bullish = ema10Val > ema40Val;
      const nearEma10 = Math.abs(price - ema10Val) / ema10Val < 0.01;
      if (bullish && ema10Rising && ema40Rising && nearEma10) {
        return { signal: "BUY", strength: Math.min(85, Math.round(70 + ((ema10Val - ema40Val) / ema40Val) * 500)), details: `Schwartz momentum: 10-EMA(${ema10Val.toFixed(2)}) > 40-EMA(${ema40Val.toFixed(2)}), both rising. Price pulled back to 10-EMA.` };
      }
      if (!bullish) {
        const bearish = ema10Val < ema40Val && !ema10Rising && !ema40Rising;
        if (bearish) {
          return { signal: "SELL", strength: 65, details: `Bearish: 10-EMA below 40-EMA, both declining.` };
        }
      }
      return { signal: "NEUTRAL", strength: 0, details: `10-EMA ${bullish ? "above" : "below"} 40-EMA. ${nearEma10 ? "Near" : "Not near"} 10-EMA.` };
    },
  },

  // ─── OpenBB-Inspired Signal Concepts ───

  {
    id: "obv-trend-confirm",
    name: "OBV Trend Confirmation",
    chapter: "OB1",
    category: "Trend Following",
    description: "On Balance Volume rising with price confirms buying pressure. Divergence warns of reversal.",
    indicators: ["OBV", "SMA (20)"],
    book: "OpenBB Signals",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 30) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const volumes = candles.map(c => c.volume);
      const obvValues = obv(closes, volumes);
      const last = closes.length - 1;
      const obvSma = sma(obvValues, 20);
      const priceRising = closes[last] > closes[last - 5];
      const obvRising = obvValues[last] > obvValues[last - 5];
      const obvAboveSma = obvSma[last] !== null && obvValues[last] > obvSma[last]!;

      if (priceRising && obvRising && obvAboveSma) {
        return { signal: "BUY", strength: Math.min(80, 65 + Math.round((obvValues[last] - obvValues[last - 5]) / Math.abs(obvValues[last - 5] || 1) * 50)), details: `OBV confirms uptrend: both price and volume momentum rising. OBV above 20-SMA.` };
      }
      if (!priceRising && !obvRising) {
        return { signal: "SELL", strength: 60, details: `OBV confirms downtrend: price and volume pressure declining.` };
      }
      if (priceRising && !obvRising) {
        return { signal: "SELL", strength: 55, details: `Bearish OBV divergence: price rising but volume not confirming. Weak rally.` };
      }
      if (!priceRising && obvRising) {
        return { signal: "BUY", strength: 60, details: `Bullish OBV divergence: smart money accumulating despite price weakness.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `OBV flat. No clear volume-price relationship.` };
    },
  },
  {
    id: "adl-accumulation",
    name: "Accumulation/Distribution",
    chapter: "OB2",
    category: "Trend Following",
    description: "Tracks money flow into/out of a stock. Rising ADL = institutional accumulation.",
    indicators: ["ADL", "EMA (21)"],
    book: "OpenBB Signals",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 30) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const closes = candles.map(c => c.close);
      const volumes = candles.map(c => c.volume);
      const adlValues = adl(highs, lows, closes, volumes);
      const last = adlValues.length - 1;
      const adlEma = ema(adlValues, 21);

      const adlRising = adlValues[last] > adlValues[last - 5] && adlValues[last - 5] > adlValues[last - 10];
      const priceRising = closes[last] > closes[last - 5];
      const aboveEma = adlEma[last] !== null && adlValues[last] > adlEma[last]!;

      if (adlRising && aboveEma && priceRising) {
        return { signal: "BUY", strength: 75, details: `Strong accumulation: ADL trending up, above 21-EMA. Institutional buying confirmed.` };
      }
      if (adlRising && !priceRising) {
        return { signal: "BUY", strength: 70, details: `Hidden accumulation: ADL rising while price flat/falling. Smart money loading.` };
      }
      if (!adlRising && priceRising) {
        return { signal: "SELL", strength: 65, details: `Distribution detected: Price rising but ADL falling. Selling into strength.` };
      }
      if (!adlRising && !aboveEma) {
        return { signal: "SELL", strength: 60, details: `Active distribution: ADL declining below 21-EMA.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `ADL inconclusive.` };
    },
  },
  {
    id: "adx-trend-strength",
    name: "ADX Trend Strength",
    chapter: "OB3",
    category: "Trend Following",
    description: "ADX > 25 indicates strong trend. +DI > -DI = bullish. Combines direction with strength.",
    indicators: ["ADX (14)", "+DI", "-DI"],
    book: "OpenBB Signals",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 40) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const closes = candles.map(c => c.close);
      const { adx: adxValues, plusDI, minusDI } = adx(highs, lows, closes, 14);
      const last = closes.length - 1;
      const adxVal = adxValues[last];
      const pdi = plusDI[last];
      const mdi = minusDI[last];

      if (adxVal === null || pdi === null || mdi === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient ADX data" };

      if (adxVal > 25 && pdi > mdi) {
        const str = Math.min(90, Math.round(50 + adxVal));
        return { signal: "BUY", strength: str, details: `Strong uptrend: ADX=${adxVal.toFixed(1)}, +DI(${pdi.toFixed(1)}) > -DI(${mdi.toFixed(1)}). Trend has momentum.` };
      }
      if (adxVal > 25 && mdi > pdi) {
        return { signal: "SELL", strength: Math.min(85, Math.round(50 + adxVal)), details: `Strong downtrend: ADX=${adxVal.toFixed(1)}, -DI(${mdi.toFixed(1)}) > +DI(${pdi.toFixed(1)}).` };
      }
      if (adxVal < 20) {
        return { signal: "NEUTRAL", strength: 0, details: `Weak/no trend: ADX=${adxVal.toFixed(1)} (below 20). Range-bound market.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `ADX=${adxVal.toFixed(1)}, +DI=${pdi.toFixed(1)}, -DI=${mdi.toFixed(1)}. Trend developing.` };
    },
  },
  {
    id: "cci-extreme-reversal",
    name: "CCI Extreme Reversal",
    chapter: "OB4",
    category: "Swing",
    description: "CCI below -100 signals oversold (buy), above +100 signals overbought (sell). Momentum reversal.",
    indicators: ["CCI (20)"],
    book: "OpenBB Signals",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const closes = candles.map(c => c.close);
      const cciValues = cci(highs, lows, closes, 20);
      const last = cciValues.length - 1;
      const cciVal = cciValues[last];
      const cciPrev = cciValues[last - 1];

      if (cciVal === null || cciPrev === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };

      if (cciVal < -100 && cciVal > cciPrev) {
        return { signal: "BUY", strength: Math.min(85, Math.round(60 + Math.abs(cciVal) / 5)), details: `CCI oversold reversal: CCI=${cciVal.toFixed(0)} turning up from extreme. Mean reversion buy.` };
      }
      if (cciVal > 100 && cciVal < cciPrev) {
        return { signal: "SELL", strength: Math.min(85, Math.round(60 + cciVal / 5)), details: `CCI overbought reversal: CCI=${cciVal.toFixed(0)} turning down. Take profits.` };
      }
      if (cciVal < -200) {
        return { signal: "BUY", strength: 70, details: `CCI extremely oversold: CCI=${cciVal.toFixed(0)}. Deep discount territory.` };
      }
      if (cciVal > 200) {
        return { signal: "SELL", strength: 70, details: `CCI extremely overbought: CCI=${cciVal.toFixed(0)}. Extended beyond normal.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `CCI=${cciVal.toFixed(0)}. Within normal range (-100 to +100).` };
    },
  },
  {
    id: "aroon-trend-change",
    name: "Aroon Trend Change",
    chapter: "OB5",
    category: "Swing",
    description: "Aroon Up crossing above Aroon Down signals new uptrend. Oscillator confirms direction.",
    indicators: ["Aroon (25)"],
    book: "OpenBB Signals",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 30) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const { up, down, oscillator } = aroon(highs, lows, 25);
      const last = up.length - 1;

      if (up[last] === null || down[last] === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };

      const aroonUp = up[last]!;
      const aroonDown = down[last]!;
      const osc = oscillator[last]!;
      const prevUp = up[last - 1]!;
      const prevDown = down[last - 1]!;

      // Bullish crossover
      if (aroonUp > aroonDown && prevUp <= prevDown) {
        return { signal: "BUY", strength: Math.min(85, Math.round(65 + osc / 3)), details: `Aroon bullish crossover! Up(${aroonUp.toFixed(0)}) crossed above Down(${aroonDown.toFixed(0)}). New uptrend starting.` };
      }
      if (aroonUp > 70 && aroonDown < 30) {
        return { signal: "BUY", strength: 75, details: `Strong Aroon uptrend: Up=${aroonUp.toFixed(0)}, Down=${aroonDown.toFixed(0)}. Recent new highs.` };
      }
      if (aroonDown > aroonUp && prevDown <= prevUp) {
        return { signal: "SELL", strength: Math.min(80, Math.round(65 + Math.abs(osc) / 3)), details: `Aroon bearish crossover! Down(${aroonDown.toFixed(0)}) crossed above Up(${aroonUp.toFixed(0)}). Downtrend starting.` };
      }
      if (aroonDown > 70 && aroonUp < 30) {
        return { signal: "SELL", strength: 70, details: `Strong Aroon downtrend: Down=${aroonDown.toFixed(0)}, Up=${aroonUp.toFixed(0)}.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `Aroon Up=${aroonUp.toFixed(0)}, Down=${aroonDown.toFixed(0)}. No clear trend.` };
    },
  },
  {
    id: "mfi-money-flow",
    name: "Money Flow Index",
    chapter: "OB6",
    category: "Swing",
    description: "Volume-weighted RSI. MFI < 20 = oversold with volume confirmation. MFI > 80 = overbought.",
    indicators: ["MFI (14)"],
    book: "OpenBB Signals",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const closes = candles.map(c => c.close);
      const volumes = candles.map(c => c.volume);
      const mfiValues = mfi(highs, lows, closes, volumes, 14);
      const last = mfiValues.length - 1;
      const mfiVal = mfiValues[last];
      const mfiPrev = mfiValues[last - 1];

      if (mfiVal === null || mfiPrev === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };

      if (mfiVal < 20 && mfiVal > mfiPrev) {
        return { signal: "BUY", strength: Math.min(85, Math.round(70 + (20 - mfiVal) * 2)), details: `MFI oversold reversal: MFI=${mfiVal.toFixed(1)} (below 20), turning up. Volume-confirmed buy.` };
      }
      if (mfiVal < 30 && mfiVal > mfiPrev) {
        return { signal: "BUY", strength: 60, details: `MFI approaching oversold: MFI=${mfiVal.toFixed(1)}, starting to recover.` };
      }
      if (mfiVal > 80 && mfiVal < mfiPrev) {
        return { signal: "SELL", strength: Math.min(85, Math.round(70 + (mfiVal - 80) * 2)), details: `MFI overbought reversal: MFI=${mfiVal.toFixed(1)} (above 80), turning down. Volume-confirmed sell.` };
      }
      if (mfiVal > 70 && mfiVal < mfiPrev) {
        return { signal: "SELL", strength: 55, details: `MFI elevated: MFI=${mfiVal.toFixed(1)}, beginning to decline.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `MFI=${mfiVal.toFixed(1)}. Normal range.` };
    },
  },
  {
    id: "force-index-momentum",
    name: "Force Index Momentum",
    chapter: "OB7",
    category: "Swing",
    description: "Combines price change with volume. Positive force = bulls in control. Negative = bears.",
    indicators: ["Force Index (13)"],
    book: "OpenBB Signals",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 20) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const volumes = candles.map(c => c.volume);
      const fi = forceIndex(closes, volumes, 13);
      const last = fi.length - 1;
      const fiVal = fi[last];
      const fiPrev = fi[last - 1];
      const fiPrev2 = fi[last - 3];

      if (fiVal === null || fiPrev === null || fiPrev2 === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };

      const crossedAboveZero = fiVal > 0 && fiPrev2 < 0;
      const crossedBelowZero = fiVal < 0 && fiPrev2 > 0;

      if (crossedAboveZero) {
        return { signal: "BUY", strength: 75, details: `Force Index crossed above zero. Bulls regained control with volume support.` };
      }
      if (fiVal > 0 && fiVal > fiPrev) {
        return { signal: "BUY", strength: 60, details: `Force Index positive and rising (${(fiVal / 1e6).toFixed(1)}M). Buying pressure increasing.` };
      }
      if (crossedBelowZero) {
        return { signal: "SELL", strength: 75, details: `Force Index crossed below zero. Bears took control with selling volume.` };
      }
      if (fiVal < 0 && fiVal < fiPrev) {
        return { signal: "SELL", strength: 60, details: `Force Index negative and falling. Selling pressure intensifying.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `Force Index: ${(fiVal / 1e6).toFixed(2)}M. No clear signal.` };
    },
  },
  {
    id: "golden-death-cross",
    name: "Golden/Death Cross",
    chapter: "OB8",
    category: "Positional",
    description: "50-SMA crossing above 200-SMA = Golden Cross (major buy). Below = Death Cross (major sell).",
    indicators: ["SMA (50)", "SMA (200)"],
    book: "OpenBB Signals",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 210) return { signal: "NEUTRAL", strength: 0, details: "Need 210+ candles for 200-SMA" };
      const closes = candles.map(c => c.close);
      const sma50 = sma(closes, 50);
      const sma200 = sma(closes, 200);
      const last = closes.length - 1;
      const s50 = sma50[last];
      const s200 = sma200[last];
      const s50Prev = sma50[last - 3];
      const s200Prev = sma200[last - 3];

      if (!s50 || !s200 || !s50Prev || !s200Prev) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };

      const goldenCross = s50 > s200 && s50Prev <= s200Prev;
      const deathCross = s50 < s200 && s50Prev >= s200Prev;
      const bullish = s50 > s200;

      if (goldenCross) {
        return { signal: "BUY", strength: 90, details: `GOLDEN CROSS! 50-SMA(${s50.toFixed(2)}) just crossed above 200-SMA(${s200.toFixed(2)}). Major bullish signal.` };
      }
      if (deathCross) {
        return { signal: "SELL", strength: 90, details: `DEATH CROSS! 50-SMA(${s50.toFixed(2)}) just crossed below 200-SMA(${s200.toFixed(2)}). Major bearish signal.` };
      }
      if (bullish && (s50 - s200) / s200 < 0.02) {
        return { signal: "BUY", strength: 65, details: `50-SMA above 200-SMA (Golden Cross zone). Bullish structure intact. Spread: ${((s50 - s200) / s200 * 100).toFixed(2)}%.` };
      }
      if (!bullish && (s200 - s50) / s200 < 0.02) {
        return { signal: "SELL", strength: 65, details: `50-SMA below 200-SMA (Death Cross zone). Bearish structure. Spread: ${((s50 - s200) / s200 * 100).toFixed(2)}%.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `50-SMA ${bullish ? "above" : "below"} 200-SMA. Spread: ${((s50 - s200) / s200 * 100).toFixed(2)}%.` };
    },
  },
  {
    id: "institutional-accumulation",
    name: "Institutional Accumulation",
    chapter: "OB9",
    category: "Positional",
    description: "Large volume spikes without proportional price moves indicate institutional accumulation/distribution.",
    indicators: ["Volume", "ATR", "Price"],
    book: "OpenBB Signals",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 30) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const volumes = candles.map(c => c.volume);
      const last = candles.length - 1;

      const avgVol = volumes.slice(last - 20, last).reduce((a, b) => a + b, 0) / 20;
      const volRatio = volumes[last] / avgVol;
      const priceChange = Math.abs(closes[last] - closes[last - 1]) / closes[last - 1];
      const avgChange = closes.slice(last - 20, last).reduce((sum, _, i, arr) => i === 0 ? 0 : sum + Math.abs(arr[i] - arr[i - 1]) / arr[i - 1], 0) / 19;

      // High volume with small price move = accumulation/distribution
      if (volRatio > 2 && priceChange < avgChange * 0.5) {
        const bullishClose = closes[last] > (candles[last].high + candles[last].low) / 2;
        if (bullishClose) {
          return { signal: "BUY", strength: Math.min(85, Math.round(65 + volRatio * 5)), details: `Institutional accumulation: Volume ${volRatio.toFixed(1)}x average with minimal price change. Close in upper half = buying.` };
        } else {
          return { signal: "SELL", strength: Math.min(80, Math.round(60 + volRatio * 5)), details: `Institutional distribution: Volume ${volRatio.toFixed(1)}x average with minimal price change. Close in lower half = selling.` };
        }
      }
      if (volRatio > 1.5 && priceChange > avgChange * 2) {
        const direction = closes[last] > closes[last - 1];
        if (direction) {
          return { signal: "BUY", strength: 70, details: `Volume breakout: ${volRatio.toFixed(1)}x volume with ${(priceChange * 100).toFixed(2)}% price jump. Momentum confirmed.` };
        } else {
          return { signal: "SELL", strength: 70, details: `Volume breakdown: ${volRatio.toFixed(1)}x volume with ${(priceChange * 100).toFixed(2)}% price drop. Panic selling.` };
        }
      }
      return { signal: "NEUTRAL", strength: 0, details: `Volume ratio: ${volRatio.toFixed(1)}x. Price change: ${(priceChange * 100).toFixed(2)}%. Normal activity.` };
    },
  },
  {
    id: "relative-strength-market",
    name: "Relative Strength vs Market",
    chapter: "OB10",
    category: "Positional",
    description: "Stock outperforming its own history signals leadership. Compare recent vs longer-term momentum.",
    indicators: ["ROC (5)", "ROC (20)", "SMA (50)"],
    book: "OpenBB Signals",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 55) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const last = closes.length - 1;
      const roc5 = roc(closes, 5);
      const roc20 = roc(closes, 20);
      const sma50 = sma(closes, 50);
      const roc5Val = roc5[last];
      const roc20Val = roc20[last];
      const sma50Val = sma50[last];

      if (roc5Val === null || roc20Val === null || !sma50Val) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };

      const aboveSma = closes[last] > sma50Val;
      const accelerating = roc5Val > roc20Val / 4; // Short-term pace faster than proportional longer-term

      if (aboveSma && roc20Val > 5 && accelerating) {
        return { signal: "BUY", strength: Math.min(85, Math.round(60 + roc20Val * 2)), details: `Strong relative strength: +${roc20Val.toFixed(1)}% over 20 days, above 50-SMA, momentum accelerating.` };
      }
      if (aboveSma && roc20Val > 3) {
        return { signal: "BUY", strength: 60, details: `Positive momentum: +${roc20Val.toFixed(1)}% over 20 days, above 50-SMA.` };
      }
      if (!aboveSma && roc20Val < -5) {
        return { signal: "SELL", strength: Math.min(80, Math.round(60 + Math.abs(roc20Val) * 2)), details: `Weak relative strength: ${roc20Val.toFixed(1)}% over 20 days, below 50-SMA.` };
      }
      if (!aboveSma && roc5Val < -3) {
        return { signal: "SELL", strength: 55, details: `Short-term weakness: ${roc5Val.toFixed(1)}% over 5 days, below 50-SMA.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `ROC(5)=${roc5Val.toFixed(1)}%, ROC(20)=${roc20Val.toFixed(1)}%. ${aboveSma ? "Above" : "Below"} 50-SMA.` };
    },
  },
  {
    id: "fear-greed-momentum",
    name: "Fear & Greed Reversal",
    chapter: "OB11",
    category: "Swing",
    description: "Extreme RSI + Bollinger Band + volume spike = market extreme. Buy fear, sell greed.",
    indicators: ["RSI (14)", "BB (20,2)", "Volume"],
    book: "OpenBB Signals",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const volumes = candles.map(c => c.volume);
      const last = closes.length - 1;
      const rsiValues = rsi(closes, 14);
      const bb = bollingerBands(closes, 20, 2);
      const rsiVal = rsiValues[last];
      const bbLower = bb.lower[last];
      const bbUpper = bb.upper[last];
      const avgVol = volumes.slice(last - 10, last).reduce((a, b) => a + b, 0) / 10;
      const volSpike = volumes[last] / avgVol;

      if (!rsiVal || !bbLower || !bbUpper) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };

      const extremeFear = rsiVal < 25 && closes[last] <= bbLower && volSpike > 1.5;
      const extremeGreed = rsiVal > 75 && closes[last] >= bbUpper && volSpike > 1.5;

      if (extremeFear) {
        return { signal: "BUY", strength: Math.min(90, Math.round(75 + (25 - rsiVal) + volSpike * 3)), details: `EXTREME FEAR: RSI=${rsiVal.toFixed(0)}, price at lower BB, volume ${volSpike.toFixed(1)}x spike. Capitulation buy.` };
      }
      if (rsiVal < 30 && closes[last] < bbLower) {
        return { signal: "BUY", strength: 70, details: `Fear zone: RSI=${rsiVal.toFixed(0)}, below lower BB. Oversold.` };
      }
      if (extremeGreed) {
        return { signal: "SELL", strength: Math.min(90, Math.round(75 + (rsiVal - 75) + volSpike * 3)), details: `EXTREME GREED: RSI=${rsiVal.toFixed(0)}, price at upper BB, volume ${volSpike.toFixed(1)}x spike. Euphoria sell.` };
      }
      if (rsiVal > 70 && closes[last] > bbUpper) {
        return { signal: "SELL", strength: 70, details: `Greed zone: RSI=${rsiVal.toFixed(0)}, above upper BB. Overbought.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `RSI=${rsiVal.toFixed(0)}. Price within Bollinger Bands. No extreme.` };
    },
  },
  {
    id: "gap-continuation",
    name: "Gap & Go Pattern",
    chapter: "OB12",
    category: "Intraday",
    description: "Gap up/down with volume confirms direction. Gap fills are sell signals; continuation gaps are buys.",
    indicators: ["Gap %", "Volume", "VWAP Proxy"],
    book: "OpenBB Signals",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 10) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const last = candles.length - 1;
      const gapPercent = ((candles[last].open - candles[last - 1].close) / candles[last - 1].close) * 100;
      const volumes = candles.map(c => c.volume);
      const avgVol = volumes.slice(last - 10, last).reduce((a, b) => a + b, 0) / 10;
      const volRatio = volumes[last] / avgVol;
      const bullishClose = candles[last].close > candles[last].open;

      if (gapPercent > 1.5 && volRatio > 1.5 && bullishClose) {
        return { signal: "BUY", strength: Math.min(85, Math.round(65 + gapPercent * 5 + volRatio * 3)), details: `Gap & Go: +${gapPercent.toFixed(2)}% gap up, ${volRatio.toFixed(1)}x volume, bullish close. Momentum continuation.` };
      }
      if (gapPercent > 2 && !bullishClose) {
        return { signal: "SELL", strength: 65, details: `Gap fade: +${gapPercent.toFixed(2)}% gap up but bearish close. Gap fill likely.` };
      }
      if (gapPercent < -1.5 && volRatio > 1.5 && !bullishClose) {
        return { signal: "SELL", strength: Math.min(85, Math.round(65 + Math.abs(gapPercent) * 5)), details: `Gap down continuation: ${gapPercent.toFixed(2)}% gap, ${volRatio.toFixed(1)}x volume. Selling pressure.` };
      }
      if (gapPercent < -2 && bullishClose) {
        return { signal: "BUY", strength: 65, details: `Gap recovery: ${gapPercent.toFixed(2)}% gap down but bullish close. Buyers absorbing.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `Gap: ${gapPercent.toFixed(2)}%. Volume: ${volRatio.toFixed(1)}x. No significant gap pattern.` };
    },
  },
  {
    id: "stochastic-momentum",
    name: "Stochastic Momentum",
    chapter: "OB13",
    category: "Swing",
    description: "Stochastic %K/%D crossover in oversold/overbought zones with trend confirmation.",
    indicators: ["Stochastic (14,3)", "SMA (50)"],
    book: "OpenBB Signals",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 55) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const closes = candles.map(c => c.close);
      const last = closes.length - 1;
      const { k, d } = stochastic(highs, lows, closes, 14, 3);
      const sma50 = sma(closes, 50);
      const kVal = k[last];
      const dVal = d[last];
      const kPrev = k[last - 1];
      const dPrev = d[last - 1];
      const aboveSma = sma50[last] !== null && closes[last] > sma50[last]!;

      if (kVal === null || dVal === null || kPrev === null || dPrev === null) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };

      // Bullish crossover in oversold zone
      if (kVal > dVal && kPrev <= dPrev! && kVal < 30) {
        return { signal: "BUY", strength: Math.min(85, Math.round(70 + (30 - kVal))), details: `Stochastic bullish crossover in oversold: %K(${kVal.toFixed(0)}) crossed %D(${dVal.toFixed(0)}). ${aboveSma ? "Above" : "Below"} 50-SMA.` };
      }
      if (kVal < 20 && aboveSma) {
        return { signal: "BUY", strength: 65, details: `Stochastic oversold in uptrend: %K=${kVal.toFixed(0)}. Pullback buy opportunity.` };
      }
      // Bearish crossover in overbought zone
      if (kVal < dVal && kPrev >= dPrev! && kVal > 70) {
        return { signal: "SELL", strength: Math.min(85, Math.round(70 + (kVal - 70))), details: `Stochastic bearish crossover in overbought: %K(${kVal.toFixed(0)}) crossed below %D(${dVal.toFixed(0)}).` };
      }
      if (kVal > 80 && !aboveSma) {
        return { signal: "SELL", strength: 65, details: `Stochastic overbought in downtrend: %K=${kVal.toFixed(0)}. Rally fading.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `Stochastic %K=${kVal.toFixed(0)}, %D=${dVal.toFixed(0)}. ${aboveSma ? "Above" : "Below"} 50-SMA.` };
    },
  },
  {
    id: "multi-indicator-confluence",
    name: "Multi-Indicator Confluence",
    chapter: "OB14",
    category: "Advanced",
    description: "Combines RSI, MACD, Bollinger, and volume for high-confidence signals when 3+ indicators align.",
    indicators: ["RSI", "MACD", "BB", "Volume"],
    book: "OpenBB Signals",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 30) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const volumes = candles.map(c => c.volume);
      const last = closes.length - 1;

      const rsiValues = rsi(closes, 14);
      const macdData = macd(closes);
      const bb = bollingerBands(closes, 20, 2);
      const avgVol = volumes.slice(last - 10, last).reduce((a, b) => a + b, 0) / 10;

      const rsiVal = rsiValues[last];
      const macdVal = macdData.macdLine[last];
      const macdSig = macdData.signalLine[last];
      const bbLower = bb.lower[last];
      const bbUpper = bb.upper[last];

      if (!rsiVal || macdVal === null || macdSig === null || !bbLower || !bbUpper) {
        return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      }

      let buyScore = 0;
      let sellScore = 0;
      const buyReasons: string[] = [];
      const sellReasons: string[] = [];

      // RSI
      if (rsiVal < 35) { buyScore++; buyReasons.push(`RSI oversold(${rsiVal.toFixed(0)})`); }
      if (rsiVal > 65) { sellScore++; sellReasons.push(`RSI overbought(${rsiVal.toFixed(0)})`); }

      // MACD
      if (macdVal > macdSig) { buyScore++; buyReasons.push("MACD bullish"); }
      if (macdVal < macdSig) { sellScore++; sellReasons.push("MACD bearish"); }

      // Bollinger
      if (closes[last] < bbLower) { buyScore++; buyReasons.push("Below lower BB"); }
      if (closes[last] > bbUpper) { sellScore++; sellReasons.push("Above upper BB"); }

      // Volume
      if (volumes[last] > avgVol * 1.5 && closes[last] > closes[last - 1]) { buyScore++; buyReasons.push("Volume surge"); }
      if (volumes[last] > avgVol * 1.5 && closes[last] < closes[last - 1]) { sellScore++; sellReasons.push("Sell volume"); }

      if (buyScore >= 3) {
        return { signal: "BUY", strength: Math.min(95, 65 + buyScore * 10), details: `HIGH CONFLUENCE BUY (${buyScore}/4): ${buyReasons.join(" + ")}` };
      }
      if (sellScore >= 3) {
        return { signal: "SELL", strength: Math.min(95, 65 + sellScore * 10), details: `HIGH CONFLUENCE SELL (${sellScore}/4): ${sellReasons.join(" + ")}` };
      }
      if (buyScore >= 2) {
        return { signal: "BUY", strength: 55 + buyScore * 5, details: `Moderate confluence (${buyScore}/4): ${buyReasons.join(" + ")}` };
      }
      if (sellScore >= 2) {
        return { signal: "SELL", strength: 55 + sellScore * 5, details: `Moderate sell confluence (${sellScore}/4): ${sellReasons.join(" + ")}` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `Buy signals: ${buyScore}/4, Sell signals: ${sellScore}/4. No strong confluence.` };
    },
  },
  {
    id: "volatility-breakout",
    name: "Volatility Squeeze Breakout",
    chapter: "OB15",
    category: "Advanced",
    description: "BB width contracts (squeeze), then expands with direction. Low volatility precedes big moves.",
    indicators: ["BB Width", "ATR", "Volume"],
    book: "OpenBB Signals",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 25) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const volumes = candles.map(c => c.volume);
      const last = closes.length - 1;
      const bb = bollingerBands(closes, 20, 2);

      // Calculate BB width
      const widths: number[] = [];
      for (let i = 0; i < closes.length; i++) {
        if (bb.upper[i] !== null && bb.lower[i] !== null && bb.middle[i] !== null && bb.middle[i]! > 0) {
          widths.push((bb.upper[i]! - bb.lower[i]!) / bb.middle[i]!);
        } else { widths.push(0); }
      }

      const currentWidth = widths[last];
      const avgWidth = widths.slice(last - 20, last).reduce((a, b) => a + b, 0) / 20;
      const minWidth = Math.min(...widths.slice(last - 20, last).filter(w => w > 0));
      const isSqueeze = currentWidth <= minWidth * 1.1;
      const isExpanding = currentWidth > widths[last - 1] && widths[last - 1] < widths[last - 2];
      const avgVol = volumes.slice(last - 10, last).reduce((a, b) => a + b, 0) / 10;
      const volSurge = volumes[last] > avgVol * 1.3;

      if (isExpanding && volSurge && closes[last] > closes[last - 1]) {
        return { signal: "BUY", strength: Math.min(85, Math.round(70 + (volumes[last] / avgVol) * 5)), details: `Volatility breakout UP: BB expanding from squeeze, volume surge ${(volumes[last] / avgVol).toFixed(1)}x. Directional move starting.` };
      }
      if (isExpanding && volSurge && closes[last] < closes[last - 1]) {
        return { signal: "SELL", strength: Math.min(85, Math.round(70 + (volumes[last] / avgVol) * 5)), details: `Volatility breakdown: BB expanding from squeeze, selling volume ${(volumes[last] / avgVol).toFixed(1)}x.` };
      }
      if (isSqueeze) {
        return { signal: "NEUTRAL", strength: 30, details: `Volatility SQUEEZE: BB width at ${(currentWidth * 100).toFixed(2)}% (minimum). Big move imminent. Watch for direction.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `BB width: ${(currentWidth * 100).toFixed(2)}% (avg: ${(avgWidth * 100).toFixed(2)}%). Normal volatility.` };
    },
  },
  {
    id: "rsi-macd-divergence",
    name: "RSI-MACD Divergence",
    chapter: "OB16",
    category: "Advanced",
    description: "When price makes new low but RSI/MACD don't = bullish divergence (strong buy). Opposite for bearish.",
    indicators: ["RSI (14)", "MACD", "Price"],
    book: "OpenBB Signals",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 30) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const closes = candles.map(c => c.close);
      const last = closes.length - 1;
      const rsiValues = rsi(closes, 14);
      const macdData = macd(closes);

      // Look for divergence over last 10 bars
      const lookback = 10;
      const priceMin1 = Math.min(...closes.slice(last - lookback, last - lookback / 2));
      const priceMin2 = Math.min(...closes.slice(last - lookback / 2, last + 1));
      const priceMax1 = Math.max(...closes.slice(last - lookback, last - lookback / 2));
      const priceMax2 = Math.max(...closes.slice(last - lookback / 2, last + 1));

      const rsiFiltered = rsiValues.slice(last - lookback, last + 1).filter(v => v !== null) as number[];
      if (rsiFiltered.length < lookback) return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      const rsiMin1 = Math.min(...rsiFiltered.slice(0, lookback / 2));
      const rsiMin2 = Math.min(...rsiFiltered.slice(lookback / 2));
      const rsiMax1 = Math.max(...rsiFiltered.slice(0, lookback / 2));
      const rsiMax2 = Math.max(...rsiFiltered.slice(lookback / 2));

      // Bullish divergence: price lower low, RSI higher low
      if (priceMin2 < priceMin1 && rsiMin2 > rsiMin1 + 3) {
        return { signal: "BUY", strength: Math.min(85, Math.round(70 + (rsiMin2 - rsiMin1) * 2)), details: `Bullish RSI divergence: Price made lower low but RSI made higher low (${rsiMin1.toFixed(0)}->${rsiMin2.toFixed(0)}). Reversal imminent.` };
      }
      // Bearish divergence: price higher high, RSI lower high
      if (priceMax2 > priceMax1 && rsiMax2 < rsiMax1 - 3) {
        return { signal: "SELL", strength: Math.min(85, Math.round(70 + (rsiMax1 - rsiMax2) * 2)), details: `Bearish RSI divergence: Price made higher high but RSI made lower high (${rsiMax1.toFixed(0)}->${rsiMax2.toFixed(0)}). Weakness building.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `No divergence detected. RSI=${rsiValues[last]?.toFixed(0) || "N/A"}.` };
    },
  },
  {
    id: "market-regime-detector",
    name: "Market Regime Detector",
    chapter: "OB17",
    category: "Advanced",
    description: "Identifies trending vs mean-reverting markets using ADX + ATR + moving average alignment.",
    indicators: ["ADX", "ATR", "SMA (20,50)"],
    book: "OpenBB Signals",
    evaluate: (candles: OHLCV[]): StrategyResult => {
      if (candles.length < 55) return { signal: "NEUTRAL", strength: 0, details: "Not enough data" };
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const closes = candles.map(c => c.close);
      const last = closes.length - 1;

      const { adx: adxValues } = adx(highs, lows, closes, 14);
      const atrValues = atr(highs, lows, closes, 14);
      const sma20 = sma(closes, 20);
      const sma50 = sma(closes, 50);
      const adxVal = adxValues[last];
      const atrVal = atrValues[last];
      const atrPrev = atrValues[last - 5];

      if (adxVal === null || !atrVal || !atrPrev || !sma20[last] || !sma50[last]) {
        return { signal: "NEUTRAL", strength: 0, details: "Insufficient data" };
      }

      const trending = adxVal > 25;
      const volExpanding = atrVal > atrPrev;
      const bullishAlignment = sma20[last]! > sma50[last]! && closes[last] > sma20[last]!;
      const bearishAlignment = sma20[last]! < sma50[last]! && closes[last] < sma20[last]!;

      if (trending && bullishAlignment && volExpanding) {
        return { signal: "BUY", strength: Math.min(85, Math.round(65 + adxVal)), details: `TRENDING BULL regime: ADX=${adxVal.toFixed(0)}, MAs aligned bullish, volatility expanding. Ride the trend.` };
      }
      if (trending && bearishAlignment) {
        return { signal: "SELL", strength: Math.min(85, Math.round(65 + adxVal)), details: `TRENDING BEAR regime: ADX=${adxVal.toFixed(0)}, MAs aligned bearish. Stay short/out.` };
      }
      if (!trending && closes[last] < sma20[last]! && closes[last] > sma50[last]!) {
        return { signal: "BUY", strength: 55, details: `Range-bound regime (ADX=${adxVal.toFixed(0)}): Price between 20/50 SMA. Mean reversion buy near support.` };
      }
      return { signal: "NEUTRAL", strength: 0, details: `Regime: ${trending ? "Trending" : "Range-bound"} (ADX=${adxVal.toFixed(0)}). ${bullishAlignment ? "Bullish" : bearishAlignment ? "Bearish" : "Mixed"} alignment.` };
    },
  },
];
