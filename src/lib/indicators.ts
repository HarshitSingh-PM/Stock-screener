// Technical indicator calculations

export interface OHLCV {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Simple Moving Average
export function sma(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
  }
  return result;
}

// Exponential Moving Average
export function ema(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const avg = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(avg);
    } else {
      const prev = result[i - 1]!;
      result.push((data[i] - prev) * multiplier + prev);
    }
  }
  return result;
}

// Relative Strength Index
export function rsi(closes: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      result.push(null);
      continue;
    }
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);

    if (i < period) {
      result.push(null);
    } else if (i === period) {
      const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
      }
    } else {
      const prevRsi = result[i - 1];
      if (prevRsi === null) {
        result.push(null);
        continue;
      }
      // Use smoothed method
      const prevAvgGain = gains.slice(i - period, i - 1).reduce((a, b) => a + b, 0) / period;
      const prevAvgLoss = losses.slice(i - period, i - 1).reduce((a, b) => a + b, 0) / period;
      const avgGain = (prevAvgGain * (period - 1) + gains[i - 1]) / period;
      const avgLoss = (prevAvgLoss * (period - 1) + losses[i - 1]) / period;
      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
      }
    }
  }
  return result;
}

// Bollinger Bands
export function bollingerBands(
  closes: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = sma(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (middle[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = middle[i]!;
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const stdDev = Math.sqrt(variance);
      upper.push(mean + stdDevMultiplier * stdDev);
      lower.push(mean - stdDevMultiplier * stdDev);
    }
  }

  return { upper, middle, lower };
}

// MACD
export function macd(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macdLine: (number | null)[]; signalLine: (number | null)[]; histogram: (number | null)[] } {
  const fastEma = ema(closes, fastPeriod);
  const slowEma = ema(closes, slowPeriod);

  const macdLine: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (fastEma[i] !== null && slowEma[i] !== null) {
      macdLine.push(fastEma[i]! - slowEma[i]!);
    } else {
      macdLine.push(null);
    }
  }

  const macdValues = macdLine.filter((v) => v !== null) as number[];
  const signalEma = ema(macdValues, signalPeriod);

  const signalLine: (number | null)[] = [];
  const histogram: (number | null)[] = [];
  let signalIdx = 0;

  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] === null) {
      signalLine.push(null);
      histogram.push(null);
    } else {
      const sig = signalEma[signalIdx] ?? null;
      signalLine.push(sig);
      histogram.push(sig !== null ? macdLine[i]! - sig : null);
      signalIdx++;
    }
  }

  return { macdLine, signalLine, histogram };
}

// Williams %R
export function williamsR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const highSlice = highs.slice(i - period + 1, i + 1);
      const lowSlice = lows.slice(i - period + 1, i + 1);
      const highestHigh = Math.max(...highSlice);
      const lowestLow = Math.min(...lowSlice);
      if (highestHigh === lowestLow) {
        result.push(0);
      } else {
        result.push(((highestHigh - closes[i]) / (highestHigh - lowestLow)) * -100);
      }
    }
  }
  return result;
}

// Supertrend
export function supertrend(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 10,
  multiplier: number = 3
): { supertrend: (number | null)[]; direction: (number | null)[] } {
  const atrValues = atr(highs, lows, closes, period);
  const result: (number | null)[] = [];
  const direction: (number | null)[] = [];

  let prevUpperBand = 0;
  let prevLowerBand = 0;
  let prevSupertrend = 0;
  let prevDirection = 1;

  for (let i = 0; i < closes.length; i++) {
    if (atrValues[i] === null) {
      result.push(null);
      direction.push(null);
      continue;
    }

    const hl2 = (highs[i] + lows[i]) / 2;
    let upperBand = hl2 + multiplier * atrValues[i]!;
    let lowerBand = hl2 - multiplier * atrValues[i]!;

    if (i > period) {
      if (lowerBand > prevLowerBand || closes[i - 1] < prevLowerBand) {
        lowerBand = lowerBand;
      } else {
        lowerBand = prevLowerBand;
      }

      if (upperBand < prevUpperBand || closes[i - 1] > prevUpperBand) {
        upperBand = upperBand;
      } else {
        upperBand = prevUpperBand;
      }
    }

    let currentDirection: number;
    let currentSupertrend: number;

    if (i <= period) {
      currentDirection = 1;
      currentSupertrend = lowerBand;
    } else if (prevSupertrend === prevUpperBand) {
      currentDirection = closes[i] > upperBand ? 1 : -1;
    } else {
      currentDirection = closes[i] < lowerBand ? -1 : 1;
    }

    currentSupertrend = currentDirection === 1 ? lowerBand : upperBand;

    result.push(currentSupertrend);
    direction.push(currentDirection);

    prevUpperBand = upperBand;
    prevLowerBand = lowerBand;
    prevSupertrend = currentSupertrend;
    prevDirection = currentDirection;
  }

  return { supertrend: result, direction };
}

// Average True Range
export function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): (number | null)[] {
  const trueRanges: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      trueRanges.push(highs[i] - lows[i]);
    } else {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }
  }

  const result: (number | null)[] = [];
  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      result.push(trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period);
    } else {
      const prev = result[i - 1]!;
      result.push((prev * (period - 1) + trueRanges[i]) / period);
    }
  }
  return result;
}

// Volume Oscillator
export function volumeOscillator(
  volumes: number[],
  shortPeriod: number = 5,
  longPeriod: number = 10
): (number | null)[] {
  const shortEma = ema(volumes, shortPeriod);
  const longEma = ema(volumes, longPeriod);
  const result: (number | null)[] = [];

  for (let i = 0; i < volumes.length; i++) {
    if (shortEma[i] !== null && longEma[i] !== null && longEma[i]! !== 0) {
      result.push(((shortEma[i]! - longEma[i]!) / longEma[i]!) * 100);
    } else {
      result.push(null);
    }
  }
  return result;
}

// Pivot Points (Standard)
export function pivotPoints(high: number, low: number, close: number) {
  const pivot = (high + low + close) / 3;
  const r1 = 2 * pivot - low;
  const s1 = 2 * pivot - high;
  const r2 = pivot + (high - low);
  const s2 = pivot - (high - low);
  return { pivot, r1, s1, r2, s2 };
}
