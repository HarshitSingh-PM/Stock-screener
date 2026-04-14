import { OHLCV } from "./indicators";
import { Strategy, StrategyResult } from "./strategies";

export interface BacktestTrade {
  entryDate: Date;
  exitDate: Date;
  signal: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  pnlPercent: number;
  won: boolean;
  holdDays: number;
  peakReturn: number;     // best return during hold
  peakDay: number;        // day when peak return occurred
  drawdown: number;       // worst return during hold
}

export interface BacktestResult {
  strategyId: string;
  totalSignals: number;
  wins: number;
  losses: number;
  winRate: number;
  avgReturn: number;
  totalReturn: number;
  maxWin: number;
  maxLoss: number;
  avgHoldDays: number;
  avgDaysToProfit: number;   // avg days to first become profitable
  avgDaysToPeak: number;     // avg days to reach peak return
  trades: BacktestTrade[];
}

/**
 * Backtest a strategy on historical OHLCV data.
 *
 * For each signal, tracks the trade over maxHoldDays and records:
 * - Final P&L at exit
 * - Peak return and which day it occurred
 * - Time to first profit
 * - Drawdown during hold
 */
export function backtestStrategy(
  strategy: Strategy,
  candles: OHLCV[],
  options: {
    lookback?: number;
    holdDays?: number;
    minStrength?: number;
  } = {}
): BacktestResult {
  const lookback = options.lookback ?? 80;
  const maxHoldDays = options.holdDays ?? 10;
  const minStrength = options.minStrength ?? 30;

  const trades: BacktestTrade[] = [];
  let i = lookback;

  while (i < candles.length - maxHoldDays) {
    const window = candles.slice(i - lookback, i + 1);
    let result: StrategyResult;
    try {
      result = strategy.evaluate(window);
    } catch {
      i++;
      continue;
    }

    if (
      (result.signal === "BUY" || result.signal === "SELL") &&
      result.strength >= minStrength
    ) {
      const entryPrice = candles[i].close;
      const isBuy = result.signal === "BUY";

      let peakReturn = 0;
      let peakDay = 0;
      let drawdown = 0;
      let firstProfitDay = -1;

      // Track through the hold period
      for (let d = 1; d <= maxHoldDays && (i + d) < candles.length; d++) {
        const currentPrice = candles[i + d].close;
        let ret: number;
        if (isBuy) {
          ret = ((currentPrice - entryPrice) / entryPrice) * 100;
        } else {
          ret = ((entryPrice - currentPrice) / entryPrice) * 100;
        }

        if (ret > peakReturn) {
          peakReturn = ret;
          peakDay = d;
        }
        if (ret < drawdown) {
          drawdown = ret;
        }
        if (firstProfitDay === -1 && ret > 0) {
          firstProfitDay = d;
        }
      }

      const exitIndex = Math.min(i + maxHoldDays, candles.length - 1);
      const exitPrice = candles[exitIndex].close;
      let pnlPercent: number;
      if (isBuy) {
        pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
      } else {
        pnlPercent = ((entryPrice - exitPrice) / entryPrice) * 100;
      }

      const won = pnlPercent > 0;

      trades.push({
        entryDate: candles[i].date,
        exitDate: candles[exitIndex].date,
        signal: result.signal,
        entryPrice,
        exitPrice,
        pnlPercent,
        won,
        holdDays: maxHoldDays,
        peakReturn,
        peakDay,
        drawdown,
      });

      // Cooldown
      i += maxHoldDays;
    } else {
      i++;
    }
  }

  const wins = trades.filter((t) => t.won).length;
  const losses = trades.length - wins;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
  const avgReturn =
    trades.length > 0
      ? trades.reduce((sum, t) => sum + t.pnlPercent, 0) / trades.length
      : 0;
  const totalReturn = trades.reduce((sum, t) => sum + t.pnlPercent, 0);
  const maxWin =
    trades.length > 0 ? Math.max(...trades.map((t) => t.pnlPercent)) : 0;
  const maxLoss =
    trades.length > 0 ? Math.min(...trades.map((t) => t.pnlPercent)) : 0;

  // Time metrics
  const tradesWithProfit = trades.filter((t) => t.peakDay > 0);
  const avgDaysToProfit =
    tradesWithProfit.length > 0
      ? tradesWithProfit.reduce((sum, t) => sum + (t.peakDay > 0 ? Math.min(t.peakDay, t.holdDays) : t.holdDays), 0) / tradesWithProfit.length
      : 0;
  const avgDaysToPeak =
    trades.length > 0
      ? trades.reduce((sum, t) => sum + t.peakDay, 0) / trades.length
      : 0;
  const avgHoldDays = trades.length > 0
    ? trades.reduce((sum, t) => sum + t.holdDays, 0) / trades.length
    : 0;

  return {
    strategyId: strategy.id,
    totalSignals: trades.length,
    wins,
    losses,
    winRate,
    avgReturn,
    totalReturn,
    maxWin,
    maxLoss,
    avgHoldDays,
    avgDaysToProfit,
    avgDaysToPeak,
    trades,
  };
}
