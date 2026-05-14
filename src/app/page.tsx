"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";

import { BACKTEST_CACHE } from "@/lib/backtestCache";
import { TUTORIAL_INDICATORS, TUTORIAL_CONCEPTS } from "@/lib/tutorials";

const CandlestickChart = dynamic(() => import("@/components/CandlestickChart"), { ssr: false });
const MarketChart = dynamic(() => import("@/components/MarketChart"), { ssr: false });
const BotEquityChart = dynamic(() => import("@/components/BotEquityChart"), { ssr: false });

interface StrategyInfo {
  id: string;
  name: string;
  chapter: string;
  category: string;
  book: string;
  description: string;
  indicators: string[];
}

interface ScreenerResult {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  signal: "BUY" | "SELL" | "NEUTRAL";
  strength: number;
  details: string;
}

interface ScanStrategySignal {
  id: string;
  name: string;
  chapter: string;
  category: string;
  book: string;
  strength: number;
  details: string;
}

interface ScanResult {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  buyCount: number;
  sellCount: number;
  neutralCount: number;
  totalStrategies: number;
  avgStrength: number;
  buyStrategies: ScanStrategySignal[];
  sellStrategies: ScanStrategySignal[];
}

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

interface SignalsData {
  signals: MarketSignal[];
  events: MarketEvent[];
  sentiment: { score: number; label: string; bullish: number; bearish: number; neutral: number; total: number };
  market: {
    market?: "IN" | "US";
    primaryName: string;
    primaryPrice: string;
    primaryChange: string;
    secondaryName: string;
    secondaryPrice: string | null;
    secondaryChange: string | null;
  };
}

interface GlobalMarket {
  symbol: string;
  name: string;
  region: "americas" | "europe" | "asia" | "commodity" | "currency" | "volatility";
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  weekChange: number;
  monthChange: number;
  status: string;
  high: number;
  low: number;
  correlation: number;
  correlationNote: string;
  impactOnIndia: string;
  historicPattern: string;
  lagEffect: string;
}

interface CorrelationInsight {
  title: string;
  description: string;
  impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED";
  strength: "STRONG" | "MODERATE" | "WEAK";
  category: "index" | "commodity" | "currency" | "volatility";
}

interface PredictionFactor {
  factor: string;
  direction: "UP" | "DOWN" | "FLAT";
  weight: number;
  reasoning: string;
}

interface GlobalData {
  markets: GlobalMarket[];
  insights: CorrelationInsight[];
  prediction: { score: number; label: string; factors: PredictionFactor[] };
  usPrediction?: { score: number; label: string; factors: PredictionFactor[] };
  timestamp: string;
}

interface NotableHolderInfo {
  name: string;
  type: string;
  description: string;
  holdings: { symbol: string; shares?: number; percentHeld?: number; approxValue?: string; note?: string }[];
}

interface InsiderDeal {
  filerName: string;
  filerRelation: string;
  transactionText: string;
  shares: number;
  value: number;
  startDate: string;
  symbol: string;
}

interface InsiderData {
  holders: NotableHolderInfo[];
  deals: InsiderDeal[];
  bulkDeals: InsiderDeal[];
  types?: string[];
}

interface PortfolioHolding {
  symbol: string;
  buyPrice: number;
  quantity: number;
  addedAt: string; // ISO date
}

interface PortfolioLevels {
  pivots: { pivot: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number };
  fibonacci: { level236: number; level382: number; level500: number; level618: number; level786: number };
  movingAverages: { sma20: number | null; sma50: number | null; sma100: number | null; sma200: number | null; ema9: number | null; ema21: number | null };
  targets: { target1: number; target2: number; target3: number; stopLoss: number };
  support: number[];
  resistance: number[];
  supertrendLevel: number | null;
  supertrendDirection: number | null;
}

interface PortfolioSignalSummary {
  buyCount: number;
  sellCount: number;
  neutralCount: number;
  total: number;
  avgBuyStrength: number;
  avgSellStrength: number;
  recommendation: string;
  recSignal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  topBuy: { id: string; name: string; chapter: string; category: string; book: string; signal: string; strength: number; details: string }[];
  topSell: { id: string; name: string; chapter: string; category: string; book: string; signal: string; strength: number; details: string }[];
}

interface PortfolioStockData {
  symbol: string;
  quote: {
    symbol: string; name: string; price: number; change: number; changePercent: number;
    volume: number; marketCap: number; high52w: number; low52w: number; pe: number | null;
  };
  levels: PortfolioLevels;
  signals: PortfolioSignalSummary;
}

interface ETFResult {
  symbol: string;
  name: string;
  theme: string;
  note?: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high52w: number;
  low52w: number;
  recommendation: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  score: number;
  buyCount: number;
  sellCount: number;
  neutralCount: number;
  totalStrategies: number;
  rationale: string[];
}

interface ETFData {
  total: number;
  scanned: number;
  themes: string[];
  byTheme: Record<string, ETFResult[]>;
}

interface BotHoldingLive {
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate: string;
  currentPrice: number;
  currentValue: number;
  cost: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

interface BotTradeView {
  date: string;
  timestamp: string;
  symbol: string;
  action: "BUY" | "SELL";
  quantity: number;
  price: number;
  total: number;
  reason: string;
  realizedPnL?: number;
}

interface BotSnapshotView {
  date: string;
  cash: number;
  holdingsValue: number;
  equity: number;
  pnl: number;
  pnlPercent: number;
  positions: number;
  tradesCount: number;
}

interface BotStateView {
  market: "IN" | "US";
  startingCapital: number;
  cash: number;
  holdingsValue: number;
  equity: number;
  totalPnL: number;
  totalPnLPercent: number;
  realizedPnL: number;
  unrealizedPnL: number;
  holdings: BotHoldingLive[];
  trades: BotTradeView[];
  snapshots: BotSnapshotView[];
  lastRunDate: string | null;
  positionsOpen: number;
  maxPositions: number;
}

interface StockDetail {
  quote: {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    marketCap: number;
    high52w: number;
    low52w: number;
    pe: number | null;
  };
  strategyResults: {
    id: string;
    name: string;
    chapter: string;
    category: string;
    signal: "BUY" | "SELL" | "NEUTRAL";
    strength: number;
    details: string;
  }[];
}

function mapStrategyIndicatorsToChartIds(indicators: string[]): string[] {
  const ids: string[] = [];
  const joined = indicators.join(" ").toLowerCase();
  if (joined.includes("bb") || joined.includes("bollinger")) ids.push("bb");
  if (joined.includes("rsi")) ids.push("rsi");
  if (joined.includes("macd")) ids.push("macd");
  if (joined.includes("supertrend")) ids.push("supertrend");
  if (/sma.*200|200.*sma/.test(joined)) ids.push("sma200");
  if (/sma.*50|50.*sma/.test(joined)) ids.push("sma50");
  if (/sma.*20[^0]|sma.*\(20\)|20-sma|sma \(20\)/.test(joined)) ids.push("sma20");
  if (/ema.*9|9.*ema/.test(joined)) ids.push("ema9");
  if (/ema.*21|21.*ema/.test(joined)) ids.push("ema21");
  return [...new Set(ids)];
}

const STRATEGIES: StrategyInfo[] = [
  // Chapter 1 - Swing
  { id: "bb-ema", name: "Bollinger Bands + 9 EMA", chapter: "1.1", category: "Swing", book: "51 Trading Strategies", description: "Buy when price takes support on lower BB with bullish 9-EMA. Sell at upper BB.", indicators: ["BB (20,2)", "EMA (9)"] },
  { id: "williams-macd", name: "Williams %R + MACD Duo", chapter: "1.2", category: "Swing", book: "51 Trading Strategies", description: "Williams %R oversold reversal + MACD histogram rising + price above SMA.", indicators: ["Williams %R", "MACD", "SMA (14)"] },
  { id: "macd-fib", name: "MACD + Fibonacci Retracement", chapter: "1.3", category: "Swing", book: "51 Trading Strategies", description: "MACD crossover at Fibonacci retracement levels for swing entries.", indicators: ["MACD", "Fibonacci"] },
  { id: "triangle-breakout", name: "Riding a Breakout (Triangle)", chapter: "1.4", category: "Swing", book: "51 Trading Strategies", description: "Detects narrowing price range (triangle) followed by volume breakout.", indicators: ["Price Range", "Volume"] },
  { id: "institutional-moves", name: "Institutional Moves", chapter: "1.5", category: "Swing", book: "51 Trading Strategies", description: "Gap up/down followed by retracement to demand/supply zone.", indicators: ["Gap Detection", "Volume"] },
  { id: "bb-width", name: "BB Width Breakout", chapter: "1.6", category: "Swing", book: "51 Trading Strategies", description: "Bollinger Band squeeze then directional expansion breakout.", indicators: ["BB Width", "BB (20,2)"] },
  { id: "ichimoku-cloud", name: "Ichimoku Cloud", chapter: "1.7", category: "Swing", book: "51 Trading Strategies", description: "Conversion/Base line crossover + price above/below the cloud.", indicators: ["Ichimoku (9,26,52)"] },
  // Chapter 2 - Intraday
  { id: "ma-fibonacci", name: "Moving Average + Fibonacci", chapter: "2.1", category: "Intraday", book: "51 Trading Strategies", description: "Price above 200-SMA pulling back to Fibonacci support levels.", indicators: ["SMA (200)", "Fibonacci"] },
  { id: "supertrend-pivot", name: "Supertrend + Pivot Points", chapter: "2.2", category: "Intraday", book: "51 Trading Strategies", description: "Price above R1 + Supertrend bullish for buy signals.", indicators: ["Supertrend", "Pivots"] },
  { id: "vwap-stddev", name: "VWAP + Standard Deviations", chapter: "2.3", category: "Intraday", book: "51 Trading Strategies", description: "Price relative to VWAP proxy for overvalued/undervalued detection.", indicators: ["VWAP Proxy"] },
  { id: "rsi-volume", name: "RSI + Volume Oscillator", chapter: "2.4", category: "Intraday", book: "51 Trading Strategies", description: "RSI oversold/overbought confirmed by Volume Oscillator extremes.", indicators: ["RSI (14)", "Vol Osc (5,10)"] },
  { id: "wait-trade-pullback", name: "Wait & Trade Pullback", chapter: "2.5", category: "Intraday", book: "51 Trading Strategies", description: "Price in uptrend pulls back to pivot support with bullish candle.", indicators: ["Pivot Points", "Candle Pattern"] },
  { id: "double-rsi", name: "Double RSI", chapter: "2.6", category: "Intraday", book: "51 Trading Strategies", description: "RSI(5) + RSI(60) confluence for strong overbought/oversold signals.", indicators: ["RSI (5)", "RSI (60)"] },
  { id: "cpr-trend", name: "CPR with Trend Following", chapter: "2.7", category: "Intraday", book: "51 Trading Strategies", description: "Central Pivot Range: narrow CPR = trending, wide CPR = range-bound.", indicators: ["CPR", "Pivot Points"] },
  // Chapter 3 - Advanced
  { id: "dow-theory", name: "Dow Theory (HH/HL)", chapter: "3.1", category: "Advanced", book: "51 Trading Strategies", description: "Higher highs + higher lows = uptrend. Lower highs + lower lows = downtrend.", indicators: ["Swing Points"] },
  { id: "smart-money", name: "Smart Money Concept", chapter: "3.2", category: "Advanced", book: "51 Trading Strategies", description: "Break of Structure (BoS) detection for institutional order flow.", indicators: ["BoS", "CHoCH"] },
  { id: "elliott-wave", name: "Elliott Wave Theory", chapter: "3.3", category: "Advanced", book: "51 Trading Strategies", description: "5-wave impulse pattern detection at correction points (wave 2/4).", indicators: ["Wave Analysis"] },
  { id: "fractal-trading", name: "Fractal-Based Trading", chapter: "3.4", category: "Advanced", book: "51 Trading Strategies", description: "Williams Fractals (4/4) + 50-SMA directional filter for breakouts.", indicators: ["Fractals", "SMA (50)"] },
  { id: "renko-rsi-stoch", name: "Renko + RSI + Stoch RSI", chapter: "3.5", category: "Advanced", book: "51 Trading Strategies", description: "RSI + Stochastic RSI confluence at key support/resistance levels.", indicators: ["RSI", "Stoch RSI"] },
  { id: "donchian-pullback", name: "Donchian Channel Pullback", chapter: "3.6", category: "Advanced", book: "51 Trading Strategies", description: "Price touches Donchian band, pulls back, then retests for entry.", indicators: ["Donchian (20)"] },
  { id: "gann-linear-reg", name: "Gann Fan + Linear Regression", chapter: "3.7", category: "Advanced", book: "51 Trading Strategies", description: "Linear regression trend direction with price position analysis.", indicators: ["Linear Reg", "Trend"] },
  // Chapter 4 - Positional
  { id: "macro-pivots", name: "Moving with Macro Trends", chapter: "4.1", category: "Positional", book: "51 Trading Strategies", description: "Daily pivot points for positional swings at support/resistance.", indicators: ["Pivot Points"] },
  { id: "supertrend-rsi", name: "Supertrend + RSI (Positional)", chapter: "4.2", category: "Positional", book: "51 Trading Strategies", description: "RSI > 60 + bullish Supertrend = buy. RSI < 40 + bearish = sell.", indicators: ["Supertrend", "RSI (14)"] },
  { id: "sectoral-analysis", name: "Sectoral Analysis", chapter: "4.3", category: "Positional", book: "51 Trading Strategies", description: "Stock momentum vs sector - outperforming stocks get buy signals.", indicators: ["Relative Strength"] },
  { id: "mw-rsi-pattern", name: "M & W RSI Pattern", chapter: "4.4", category: "Positional", book: "51 Trading Strategies", description: "RSI W-bottom (buy) or M-top (sell) pattern detection.", indicators: ["RSI (14)"] },
  // Chapter 5 - Scalping
  { id: "sar-rsi-ha", name: "Parabolic SAR + RSI + Heiken Ashi", chapter: "5.1", category: "Scalping", book: "51 Trading Strategies", description: "SAR below price + RSI > 50 + bullish candle = buy confluence.", indicators: ["SAR", "RSI", "Heiken Ashi"] },
  { id: "rsi-divergence-bb", name: "RSI Divergence + Bollinger Bands", chapter: "5.2", category: "Scalping", book: "51 Trading Strategies", description: "RSI divergence with price at Bollinger Band extremes.", indicators: ["RSI Divergence", "BB"] },
  { id: "rsi-vwap-scalp", name: "RSI + VWAP Scalping", chapter: "5.3", category: "Scalping", book: "51 Trading Strategies", description: "Price below VWAP + RSI < 40 = buy. Above VWAP + RSI > 60 = sell.", indicators: ["RSI", "VWAP Proxy"] },
  { id: "consolidation-breakout", name: "Consolidation Breakouts", chapter: "5.4", category: "Scalping", book: "51 Trading Strategies", description: "ATR contraction (tight range) followed by directional breakout.", indicators: ["ATR", "Range"] },
  { id: "ma-scalping", name: "Moving Average Scalping", chapter: "5.5", category: "Scalping", book: "51 Trading Strategies", description: "5-EMA crosses 13-EMA + price above/below 50-SMA.", indicators: ["EMA (5,13)", "SMA (50)"] },
  { id: "martingale", name: "Martingale System", chapter: "5.6", category: "Scalping", book: "51 Trading Strategies", description: "After 3+ consecutive red candles, buy on mean reversion probability.", indicators: ["Candle Pattern"] },
  // Chapter 6 - Options
  { id: "weekly-hedged", name: "Weekly Hedged Strategy", chapter: "6.1", category: "Options", book: "51 Trading Strategies", description: "Low volatility range-bound detection for options selling.", indicators: ["ATR", "Pivots"] },
  { id: "multi-tf-options", name: "Multi-Timeframe Options", chapter: "6.2", category: "Options", book: "51 Trading Strategies", description: "Short-term (5/13 EMA) vs medium-term (21/50 EMA) trend alignment.", indicators: ["EMA (5,13,21,50)"] },
  { id: "oi-analysis", name: "Open Interest Analysis", chapter: "6.3", category: "Options", book: "51 Trading Strategies", description: "Volume + price direction analysis as OI proxy. Rising both = strong trend.", indicators: ["Volume", "Price"] },
  { id: "supertrend-selling", name: "Supertrend Selling", chapter: "6.4", category: "Options", book: "51 Trading Strategies", description: "Supertrend direction change signals for options entry.", indicators: ["Supertrend"] },
  { id: "option-vwap", name: "Combined Option + VWAP", chapter: "6.5", category: "Options", book: "51 Trading Strategies", description: "Price crossing VWAP proxy + trend direction confirmation.", indicators: ["VWAP Proxy", "EMA"] },
  { id: "momentum-buying", name: "Momentum Buying Option", chapter: "6.6", category: "Options", book: "51 Trading Strategies", description: "RSI > 65 + price above 20-EMA + strong recent gains.", indicators: ["RSI", "EMA (20)"] },
  { id: "expiry-decay", name: "Expiry Decay Strategy", chapter: "6.7", category: "Options", book: "51 Trading Strategies", description: "High RSI + low ATR = premium selling opportunity (range-bound).", indicators: ["RSI", "ATR"] },
  { id: "combined-stoploss", name: "Combined Stoploss Strategy", chapter: "6.8", category: "Options", book: "51 Trading Strategies", description: "Triple confirmation: above 20-EMA + above VWAP + RSI > 50.", indicators: ["EMA", "VWAP", "RSI"] },
  { id: "theta-decay", name: "Theta Decay Strategy", chapter: "6.9", category: "Options", book: "51 Trading Strategies", description: "ATR declining + price within BB middle zone = range-bound.", indicators: ["ATR", "BB"] },
  { id: "btst-momentum", name: "BTST Momentum", chapter: "6.10", category: "Options", book: "51 Trading Strategies", description: "Strong bullish candle (>1.5%) + high volume + RSI rising.", indicators: ["Volume", "RSI", "Price"] },
  { id: "3pm-nifty", name: "3 PM Nifty Strategy", chapter: "6.11", category: "Options", book: "51 Trading Strategies", description: "End-of-day momentum: close vs VWAP for next session direction.", indicators: ["VWAP Proxy", "Close"] },
  { id: "momentum-selling", name: "Momentum Selling", chapter: "6.12", category: "Options", book: "51 Trading Strategies", description: "Price below 20-EMA + RSI < 40 + big red candle (>1.5% loss).", indicators: ["EMA", "RSI"] },
  { id: "swing-buying-options", name: "Swing Buying Options", chapter: "6.13", category: "Options", book: "51 Trading Strategies", description: "BB lower support + RSI oversold + Volume spike = swing buy.", indicators: ["BB", "RSI", "Volume"] },
  // Chapter 7 - Price Action
  { id: "ema-crossover", name: "9 & 21 EMA Crossover", chapter: "7.1", category: "Price Action", book: "51 Trading Strategies", description: "Classic EMA crossover. Bullish when 9-EMA crosses above 21-EMA.", indicators: ["EMA (9)", "EMA (21)"] },
  { id: "positional-pa", name: "Positional Price Action", chapter: "7.2", category: "Price Action", book: "51 Trading Strategies", description: "Price above both 50-SMA and 200-SMA = bullish. Below both = bearish.", indicators: ["SMA (50)", "SMA (200)"] },
  { id: "pin-bar", name: "Pin Bar Reversal Pattern", chapter: "7.3", category: "Price Action", book: "51 Trading Strategies", description: "Long wick candles (>2x body) near support/resistance for reversals.", indicators: ["Candle Pattern"] },
  { id: "pullback", name: "Pullback Strategy", chapter: "7.4", category: "Price Action", book: "51 Trading Strategies", description: "In uptrend, price pulls back to 20-EMA then bounces.", indicators: ["EMA (20)", "Trend"] },
  { id: "repo-rate", name: "Trading on Repo Rates", chapter: "7.5", category: "Price Action", book: "51 Trading Strategies", description: "200-SMA macro trend filter + RSI momentum confirmation.", indicators: ["SMA (200)", "RSI"] },
  { id: "vcp", name: "Volatility Contraction (VCP)", chapter: "7.6", category: "Price Action", book: "51 Trading Strategies", description: "Tightening price ranges (each contraction smaller) = pending breakout.", indicators: ["Range Analysis"] },
  { id: "two-leg-pullback", name: "Two-Legged Pullback", chapter: "7.7", category: "Price Action", book: "51 Trading Strategies", description: "Two consecutive pullback legs in trend, then reversal candle.", indicators: ["Candle Pattern", "Trend"] },

  // The Intelligent Investor - Benjamin Graham
  { id: "graham-margin-of-safety", name: "Margin of Safety", chapter: "Ch 20", category: "Value Investing", book: "The Intelligent Investor", description: "Buy when price is >25% below 52-week high. Deep discount = margin of safety.", indicators: ["52W High", "Price"] },
  { id: "graham-defensive-value", name: "Defensive Value Screen", chapter: "Ch 14", category: "Value Investing", book: "The Intelligent Investor", description: "Low volatility + above 200-SMA + not overbought. Stable defensive stock.", indicators: ["ATR", "SMA (200)", "RSI"] },
  { id: "graham-mr-market", name: "Mr. Market Contrarian", chapter: "Ch 8", category: "Value Investing", book: "The Intelligent Investor", description: "Buy extreme fear (RSI<25 + price 20% below 50-SMA). Sell extreme greed.", indicators: ["RSI", "SMA (50)"] },
  { id: "graham-enterprising", name: "Enterprising Investor", chapter: "Ch 15", category: "Value Investing", book: "The Intelligent Investor", description: "Growth: above 50 & 200 SMA, higher highs, RSI 50-70.", indicators: ["SMA (50,200)", "RSI"] },
  { id: "graham-net-current-asset", name: "Net Asset Value Play", chapter: "Ch 7", category: "Value Investing", book: "The Intelligent Investor", description: "Near 52W lows (bottom 15%) with rising RSI. Deep value reversal.", indicators: ["52W Range", "RSI"] },

  // Technical Analysis - John Murphy
  { id: "murphy-triple-ma", name: "Triple Moving Average", chapter: "Ch 9", category: "Trend Following", book: "Technical Analysis of Financial Markets", description: "4-9-18 SMA alignment. Buy: 4>9>18. Sell: 4<9<18.", indicators: ["SMA (4,9,18)"] },
  { id: "murphy-macd-histogram", name: "MACD Histogram Divergence", chapter: "Ch 10", category: "Trend Following", book: "Technical Analysis of Financial Markets", description: "MACD histogram divergence with price for reversal signals.", indicators: ["MACD Histogram"] },
  { id: "murphy-rsi-70-30", name: "RSI 70/30 Classic", chapter: "Ch 10", category: "Trend Following", book: "Technical Analysis of Financial Markets", description: "Buy RSI crossing above 30. Sell RSI crossing below 70.", indicators: ["RSI (14)"] },
  { id: "murphy-stochastic-kd", name: "Stochastic %K/%D", chapter: "Ch 10", category: "Trend Following", book: "Technical Analysis of Financial Markets", description: "Buy %K crosses %D in oversold (<20). Sell in overbought (>80).", indicators: ["Stochastic (14)"] },
  { id: "murphy-support-resistance", name: "Support/Resistance Breakout", chapter: "Ch 4", category: "Trend Following", book: "Technical Analysis of Financial Markets", description: "Buy breakout above 20-day high. Sell breakdown below 20-day low.", indicators: ["20-Day Range"] },
  { id: "murphy-head-shoulders", name: "Head & Shoulders", chapter: "Ch 5", category: "Trend Following", book: "Technical Analysis of Financial Markets", description: "Head & Shoulders pattern detection for major reversals.", indicators: ["Pattern"] },
  { id: "murphy-double-top-bottom", name: "Double Top/Bottom", chapter: "Ch 5", category: "Trend Following", book: "Technical Analysis of Financial Markets", description: "Two peaks/troughs at similar levels signal reversal.", indicators: ["Pattern"] },
  { id: "murphy-volume-confirmation", name: "Volume Price Confirm", chapter: "Ch 7", category: "Trend Following", book: "Technical Analysis of Financial Markets", description: "Rising price + rising volume = strong trend confirmation.", indicators: ["Volume", "Price"] },
  { id: "murphy-ma-envelope", name: "MA Envelope", chapter: "Ch 9", category: "Trend Following", book: "Technical Analysis of Financial Markets", description: "Price outside 3% envelope of 20-SMA signals overbought/oversold.", indicators: ["SMA (20)", "Envelope"] },
  { id: "murphy-roc", name: "Rate of Change (ROC)", chapter: "Ch 10", category: "Trend Following", book: "Technical Analysis of Financial Markets", description: "12-period ROC crossing zero line for momentum shifts.", indicators: ["ROC (12)"] },

  // Japanese Candlestick - Steve Nison
  { id: "nison-hammer", name: "Hammer Pattern", chapter: "Ch 4", category: "Candlestick", book: "Japanese Candlestick Charting", description: "Long lower shadow (2x body) after downtrend. Bullish reversal.", indicators: ["Candle Pattern"] },
  { id: "nison-engulfing", name: "Engulfing Pattern", chapter: "Ch 4", category: "Candlestick", book: "Japanese Candlestick Charting", description: "Current candle body engulfs previous. Bullish/bearish reversal.", indicators: ["Candle Pattern"] },
  { id: "nison-doji-star", name: "Doji Star", chapter: "Ch 8", category: "Candlestick", book: "Japanese Candlestick Charting", description: "Doji (open=close) after trending move signals indecision/reversal.", indicators: ["Candle Pattern"] },
  { id: "nison-morning-evening-star", name: "Morning/Evening Star", chapter: "Ch 5", category: "Candlestick", book: "Japanese Candlestick Charting", description: "3-candle reversal: large, small body, large opposite direction.", indicators: ["Candle Pattern"] },
  { id: "nison-dark-cloud-piercing", name: "Dark Cloud / Piercing", chapter: "Ch 4", category: "Candlestick", book: "Japanese Candlestick Charting", description: "2-candle pattern: opens beyond previous, closes into body.", indicators: ["Candle Pattern"] },
  { id: "nison-three-soldiers-crows", name: "Three Soldiers/Crows", chapter: "Ch 6", category: "Candlestick", book: "Japanese Candlestick Charting", description: "3 consecutive same-direction candles with progressive closes.", indicators: ["Candle Pattern"] },
  { id: "nison-harami", name: "Harami Pattern", chapter: "Ch 6", category: "Candlestick", book: "Japanese Candlestick Charting", description: "Small candle within previous large candle signals reversal.", indicators: ["Candle Pattern"] },
  { id: "nison-shooting-star", name: "Shooting Star", chapter: "Ch 5", category: "Candlestick", book: "Japanese Candlestick Charting", description: "Long upper shadow at top of uptrend signals bearish reversal.", indicators: ["Candle Pattern"] },
  { id: "nison-tweezers", name: "Tweezers Top/Bottom", chapter: "Ch 6", category: "Candlestick", book: "Japanese Candlestick Charting", description: "Two candles with matching highs/lows at turning points.", indicators: ["Candle Pattern"] },

  // Common Sense Investing - John Bogle
  { id: "bogle-trend-following", name: "Long-Term Trend", chapter: "Ch 8", category: "Index Investing", book: "Common Sense Investing", description: "Price above 200-SMA = long-term uptrend. Simple and effective.", indicators: ["SMA (200)"] },
  { id: "bogle-mean-reversion", name: "Mean Reversion", chapter: "Ch 9", category: "Index Investing", book: "Common Sense Investing", description: "Price >10% from 100-SMA expects reversion. Buy below, sell above.", indicators: ["SMA (100)"] },
  { id: "bogle-low-cost-momentum", name: "Low-Cost Momentum", chapter: "Ch 12", category: "Index Investing", book: "Common Sense Investing", description: "Low volatility + positive trend = steady investment candidate.", indicators: ["ATR", "SMA (50,100)"] },

  // Market Wizards - Jack Schwager
  { id: "wizard-trend-breakout", name: "Turtle Breakout", chapter: "Dennis", category: "Trend Following", book: "Market Wizards", description: "Buy breakout above 20-day high. Sell below 20-day low. (Richard Dennis)", indicators: ["20-Day Range"] },
  { id: "wizard-risk-reward", name: "Risk-Adjusted Entry", chapter: "Hite", category: "Trend Following", book: "Market Wizards", description: "Enter near support (within 2% of 20-day low) with uptrend. (Larry Hite)", indicators: ["20-Day Low", "SMA (50)"] },
  { id: "wizard-seykota-trend", name: "Seykota Trend System", chapter: "Seykota", category: "Trend Following", book: "Market Wizards", description: "50-EMA trend + MACD momentum must align. (Ed Seykota)", indicators: ["EMA (50)", "MACD"] },
  { id: "wizard-weinstein-stage", name: "Weinstein Stage 2", chapter: "Weinstein", category: "Trend Following", book: "Market Wizards", description: "Price breaks above flattening 150-SMA + volume surge. (Mark Weinstein)", indicators: ["SMA (150)", "Volume"] },
  { id: "wizard-schwartz-momentum", name: "Schwartz Momentum", chapter: "Schwartz", category: "Trend Following", book: "Market Wizards", description: "10-EMA above 40-EMA, both rising, pullback to 10-EMA = buy. (Marty Schwartz)", indicators: ["EMA (10,40)"] },

  // OpenBB-Inspired Signal Concepts
  { id: "obv-trend-confirm", name: "OBV Trend Confirmation", chapter: "OB1", category: "Trend Following", book: "OpenBB Signals", description: "On Balance Volume rising with price confirms buying pressure. Divergence warns of reversal.", indicators: ["OBV", "SMA (20)"] },
  { id: "adl-accumulation", name: "Accumulation/Distribution", chapter: "OB2", category: "Trend Following", book: "OpenBB Signals", description: "Tracks money flow into/out of a stock. Rising ADL = institutional accumulation.", indicators: ["ADL", "EMA (21)"] },
  { id: "adx-trend-strength", name: "ADX Trend Strength", chapter: "OB3", category: "Trend Following", book: "OpenBB Signals", description: "ADX > 25 indicates strong trend. +DI > -DI = bullish. Combines direction with strength.", indicators: ["ADX (14)", "+DI", "-DI"] },
  { id: "cci-extreme-reversal", name: "CCI Extreme Reversal", chapter: "OB4", category: "Swing", book: "OpenBB Signals", description: "CCI below -100 signals oversold (buy), above +100 signals overbought (sell).", indicators: ["CCI (20)"] },
  { id: "aroon-trend-change", name: "Aroon Trend Change", chapter: "OB5", category: "Swing", book: "OpenBB Signals", description: "Aroon Up crossing above Aroon Down signals new uptrend. Oscillator confirms direction.", indicators: ["Aroon (25)"] },
  { id: "mfi-money-flow", name: "Money Flow Index", chapter: "OB6", category: "Swing", book: "OpenBB Signals", description: "Volume-weighted RSI. MFI < 20 = oversold with volume confirmation. MFI > 80 = overbought.", indicators: ["MFI (14)"] },
  { id: "force-index-momentum", name: "Force Index Momentum", chapter: "OB7", category: "Swing", book: "OpenBB Signals", description: "Combines price change with volume. Positive force = bulls in control.", indicators: ["Force Index (13)"] },
  { id: "golden-death-cross", name: "Golden/Death Cross", chapter: "OB8", category: "Positional", book: "OpenBB Signals", description: "50-SMA crossing above 200-SMA = Golden Cross (major buy). Below = Death Cross.", indicators: ["SMA (50)", "SMA (200)"] },
  { id: "institutional-accumulation", name: "Institutional Accumulation", chapter: "OB9", category: "Positional", book: "OpenBB Signals", description: "Large volume spikes without proportional price moves indicate institutional accumulation.", indicators: ["Volume", "ATR", "Price"] },
  { id: "relative-strength-market", name: "Relative Strength vs Market", chapter: "OB10", category: "Positional", book: "OpenBB Signals", description: "Stock outperforming its own history signals leadership.", indicators: ["ROC (5)", "ROC (20)", "SMA (50)"] },
  { id: "fear-greed-momentum", name: "Fear & Greed Reversal", chapter: "OB11", category: "Swing", book: "OpenBB Signals", description: "Extreme RSI + BB + volume spike = market extreme. Buy fear, sell greed.", indicators: ["RSI (14)", "BB (20,2)", "Volume"] },
  { id: "gap-continuation", name: "Gap & Go Pattern", chapter: "OB12", category: "Intraday", book: "OpenBB Signals", description: "Gap up/down with volume confirms direction. Gap fills are sell signals.", indicators: ["Gap %", "Volume", "VWAP Proxy"] },
  { id: "stochastic-momentum", name: "Stochastic Momentum", chapter: "OB13", category: "Swing", book: "OpenBB Signals", description: "Stochastic %K/%D crossover in oversold/overbought zones.", indicators: ["Stochastic (14,3)", "SMA (50)"] },
  { id: "multi-indicator-confluence", name: "Multi-Indicator Confluence", chapter: "OB14", category: "Advanced", book: "OpenBB Signals", description: "Combines RSI, MACD, BB, and volume for high-confidence signals when 3+ align.", indicators: ["RSI", "MACD", "BB", "Volume"] },
  { id: "volatility-breakout", name: "Volatility Squeeze Breakout", chapter: "OB15", category: "Advanced", book: "OpenBB Signals", description: "BB width contracts (squeeze), then expands with direction. Low volatility precedes big moves.", indicators: ["BB Width", "ATR", "Volume"] },
  { id: "rsi-macd-divergence", name: "RSI-MACD Divergence", chapter: "OB16", category: "Advanced", book: "OpenBB Signals", description: "Price makes new low but RSI doesn't = bullish divergence (strong buy).", indicators: ["RSI (14)", "MACD", "Price"] },
  { id: "market-regime-detector", name: "Market Regime Detector", chapter: "OB17", category: "Advanced", book: "OpenBB Signals", description: "Identifies trending vs mean-reverting markets using ADX + ATR + MA alignment.", indicators: ["ADX", "ATR", "SMA (20,50)"] },
];

const CATEGORY_COLORS: Record<string, string> = {
  Swing: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Intraday: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  Advanced: "bg-green-500/20 text-green-400 border-green-500/30",
  Positional: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  Scalping: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  Options: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Price Action": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Value Investing": "bg-teal-500/20 text-teal-400 border-teal-500/30",
  "Candlestick": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Trend Following": "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  "Index Investing": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

const BOOKS = [
  "All Books",
  "51 Trading Strategies",
  "The Intelligent Investor",
  "Technical Analysis of Financial Markets",
  "Japanese Candlestick Charting",
  "Common Sense Investing",
  "Market Wizards",
  "OpenBB Signals",
];

function formatNumber(n: number, market: "IN" | "US" = "IN"): string {
  if (market === "US") {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toFixed(2);
  }
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e7) return (n / 1e7).toFixed(2) + "Cr";
  if (n >= 1e5) return (n / 1e5).toFixed(2) + "L";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(2);
}

// Fire a GA4 custom event. No-op when gtag isn't loaded (NEXT_PUBLIC_GA_ID unset).
type GtagParams = Record<string, string | number | boolean | undefined>;
declare global {
  interface Window {
    gtag?: (command: "event", eventName: string, params?: GtagParams) => void;
  }
}
function track(eventName: string, params?: GtagParams): void {
  if (typeof window === "undefined") return;
  try { window.gtag?.("event", eventName, params); } catch { /* ignore */ }
}

function SignalBadge({ signal, strength }: { signal: string; strength: number }) {
  const config: Record<string, string> = {
    BUY: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    SELL: "bg-red-500/20 text-red-400 border-red-500/40",
    NEUTRAL: "bg-gray-500/20 text-gray-400 border-gray-500/40",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config[signal] || config.NEUTRAL}`}>
      {signal === "BUY" && "▲"}{signal === "SELL" && "▼"}{signal === "NEUTRAL" && "●"}
      {signal}
      {strength > 0 && <span className="opacity-70">({strength})</span>}
    </span>
  );
}

function StrengthBar({ strength }: { strength: number }) {
  const color = strength >= 70 ? "bg-emerald-500" : strength >= 40 ? "bg-amber-500" : "bg-gray-500";
  return (
    <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${strength}%` }} />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-white/5">
      <div className="skeleton h-4 w-20" /><div className="skeleton h-4 w-40" /><div className="skeleton h-4 w-16" /><div className="skeleton h-4 w-16" /><div className="skeleton h-6 w-16 rounded-full" /><div className="skeleton h-4 w-20" />
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"home" | "market" | "global" | "signals" | "portfolio" | "bot" | "etfs" | "strategies" | "scan" | "search" | "learn">("home");
  const [strategiesSubTab, setStrategiesSubTab] = useState<"screener" | "insider">("screener");
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyInfo | null>(null);
  const [signalFilter, setSignalFilter] = useState("ALL");
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [scannedInfo, setScannedInfo] = useState({ scanned: 0, total: 0 });
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [bookFilter, setBookFilter] = useState("All Books");
  const [chartStock, setChartStock] = useState<string | null>(null);

  // Scan
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanInfo, setScanInfo] = useState({ scanned: 0, total: 0 });
  const [expandedScan, setExpandedScan] = useState<string | null>(null);
  const [scanSort, setScanSort] = useState<"buyCount" | "price" | "change" | "strength">("buyCount");
  const [copiedScan, setCopiedScan] = useState(false);
  const [copiedStrategy, setCopiedStrategy] = useState(false);

  // Backtest
  const [backtestData, setBacktestData] = useState<any>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);

  // Signals
  const [signalsData, setSignalsData] = useState<SignalsData | null>(null);
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [signalCategoryFilter, setSignalCategoryFilter] = useState<"all" | "trend" | "momentum" | "volume" | "volatility" | "breadth">("all");

  // Global
  const [globalData, setGlobalData] = useState<GlobalData | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalRegionFilter, setGlobalRegionFilter] = useState<"all" | "americas" | "europe" | "asia" | "commodity" | "currency" | "volatility">("all");
  const [expandedGlobalCard, setExpandedGlobalCard] = useState<string | null>(null);

  // Theme
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const saved = localStorage.getItem("strategyScreenerTheme") as "dark" | "light" | null;
    if (saved) setTheme(saved);
  }, []);
  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("strategyScreenerTheme", next);
  }, [theme]);

  // Market (IN | US)
  type Market = "IN" | "US";
  const [market, setMarket] = useState<Market>("IN");
  useEffect(() => {
    const saved = localStorage.getItem("strategyScreenerMarket") as Market | null;
    if (saved === "US" || saved === "IN") setMarket(saved);
  }, []);
  const switchMarket = useCallback((next: Market) => {
    if (next === market) return;
    track("market_toggle", { from: market, to: next });
    setMarket(next);
    localStorage.setItem("strategyScreenerMarket", next);
    // Clear cached market-specific data so tabs refetch
    setResults([]);
    setScanResults([]);
    setMasterResults([]);
    setSignalsData(null);
    setPortfolioData([]);
    setInsiderData({ holders: [], deals: [], bulkDeals: [] });
    setStockDetail(null);
    setChartStock(null);
    setExpandedScan(null);
    setExpandedMaster(null);
    setBacktestData(null);
    setSelectedStrategy(null);
    setSearchQuery("");
    setEtfData(null);
    setExpandedEtf(null);
    setInsiderTypeFilter("All");
    setInsiderSearch("");
    setExpandedHolder(null);
    setBotState(null);
  }, [market]);
  const currencySymbol = market === "US" ? "$" : "₹";
  const fmtPrice = useCallback((v: number, decimals = 2) =>
    `${currencySymbol}${v.toLocaleString(market === "US" ? "en-US" : "en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`, [currencySymbol, market]);
  const universeLabel = market === "US" ? "S&P 500" : "NSE";

  // Learn
  const [learnTab, setLearnTab] = useState<"indicators" | "concepts" | "strategies">("indicators");
  const [expandedLearn, setExpandedLearn] = useState<string | null>(null);
  const [learnChartStock, setLearnChartStock] = useState<string | null>(null);
  const [learnDifficulty, setLearnDifficulty] = useState<"All" | "Beginner" | "Intermediate" | "Advanced">("All");

  // Insider
  const [insiderData, setInsiderData] = useState<InsiderData>({ holders: [], deals: [], bulkDeals: [] });
  const [insiderLoading, setInsiderLoading] = useState(false);
  const [insiderTab, setInsiderTab] = useState<"holders" | "deals" | "bulk">("holders");
  const [insiderTypeFilter, setInsiderTypeFilter] = useState("All");
  const [insiderSearch, setInsiderSearch] = useState("");
  const [expandedHolder, setExpandedHolder] = useState<string | null>(null);

  // Master Scan
  const [masterResults, setMasterResults] = useState<ScanResult[]>([]);
  const [masterScanning, setMasterScanning] = useState(false);
  const [masterProgress, setMasterProgress] = useState({ scanned: 0, total: 0, found: 0 });
  const [masterSort, setMasterSort] = useState<"buyCount" | "strength" | "change" | "price">("buyCount");
  const [expandedMaster, setExpandedMaster] = useState<string | null>(null);
  const [masterChartStock, setMasterChartStock] = useState<string | null>(null);

  // Portfolio
  const [portfolio, setPortfolio] = useState<PortfolioHolding[]>([]);
  const [portfolioData, setPortfolioData] = useState<PortfolioStockData[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [addSymbol, setAddSymbol] = useState("");
  const [addBuyPrice, setAddBuyPrice] = useState("");
  const [addQuantity, setAddQuantity] = useState("1");
  const [expandedPortfolio, setExpandedPortfolio] = useState<string | null>(null);
  const [portfolioChartStock, setPortfolioChartStock] = useState<string | null>(null);

  // Stock search
  const [searchQuery, setSearchQuery] = useState("");
  const [stockDetail, setStockDetail] = useState<StockDetail | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // ETFs
  const [etfData, setEtfData] = useState<ETFData | null>(null);
  const [etfLoading, setEtfLoading] = useState(false);
  const [etfThemeFilter, setEtfThemeFilter] = useState<string>("All");
  const [etfRecFilter, setEtfRecFilter] = useState<"All" | "BUY" | "HOLD" | "SELL">("All");
  const [expandedEtf, setExpandedEtf] = useState<string | null>(null);

  // Bot
  const [botState, setBotState] = useState<BotStateView | null>(null);
  const [botLoading, setBotLoading] = useState(false);
  const [botRunning, setBotRunning] = useState(false);
  const [botResetting, setBotResetting] = useState(false);

  const runScreener = useCallback(async (strategy: StrategyInfo, signal: string, offset = 0) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/screener?strategy=${strategy.id}&signal=${signal}&limit=30&offset=${offset}&market=${market}`);
      const data = await res.json();
      if (offset === 0) setResults(data.results);
      else setResults((prev) => [...prev, ...data.results]);
      setScannedInfo({ scanned: (offset || 0) + data.scanned, total: data.total });
    } catch { /* ignore */ }
    setLoading(false);
  }, [market]);

  const runScan = useCallback(async (offset = 0) => {
    setScanLoading(true);
    try {
      const res = await fetch(`/api/scan?limit=30&offset=${offset}&minBuy=2&market=${market}`);
      const data = await res.json();
      if (offset === 0) setScanResults(data.results);
      else setScanResults((prev) => [...prev, ...data.results]);
      setScanInfo({ scanned: data.scanned, total: data.total });
    } catch { /* ignore */ }
    setScanLoading(false);
  }, [market]);

  const loadInsiderTab = useCallback(async (tab: "holders" | "deals" | "bulk") => {
    setInsiderTab(tab);
    // Only fetch if we don't have the data yet
    if (tab === "holders" && insiderData.holders.length > 0) return;
    if (tab === "deals" && insiderData.deals.length > 0) return;
    if (tab === "bulk" && insiderData.bulkDeals.length > 0) return;

    setInsiderLoading(true);
    try {
      const res = await fetch(`/api/insider?tab=${tab}&market=${market}`);
      if (res.ok) {
        const data = await res.json();
        if (tab === "holders") setInsiderData(prev => ({ ...prev, holders: data.holders, types: data.types }));
        else if (tab === "deals") setInsiderData(prev => ({ ...prev, deals: data.deals }));
        else if (tab === "bulk") setInsiderData(prev => ({ ...prev, bulkDeals: data.deals }));
      }
    } catch { /* ignore */ }
    setInsiderLoading(false);
  }, [insiderData, market]);

  const runMasterScan = useCallback(async () => {
    setMasterScanning(true);
    setMasterResults([]);
    setMasterProgress({ scanned: 0, total: 0, found: 0 });
    setExpandedMaster(null);
    setMasterChartStock(null);

    let allResults: ScanResult[] = [];
    let offset = 0;
    const batchSize = 30;
    let total = 0;

    // First call to get total
    try {
      const res = await fetch(`/api/scan?limit=${batchSize}&offset=0&minBuy=1&market=${market}`);
      const data = await res.json();
      total = data.total;
      allResults = [...data.results];
      offset = data.scanned;
      setMasterProgress({ scanned: offset, total, found: allResults.length });
      setMasterResults([...allResults].sort((a, b) => b.buyCount - a.buyCount || b.avgStrength - a.avgStrength));
    } catch {
      setMasterScanning(false);
      return;
    }

    // Keep fetching remaining batches
    while (offset < total) {
      try {
        const res = await fetch(`/api/scan?limit=${batchSize}&offset=${offset}&minBuy=1&market=${market}`);
        const data = await res.json();
        allResults = [...allResults, ...data.results];
        offset = data.scanned;
        setMasterProgress({ scanned: offset, total, found: allResults.length });
        // Live sort and update
        setMasterResults([...allResults].sort((a, b) => b.buyCount - a.buyCount || b.avgStrength - a.avgStrength));
      } catch {
        break;
      }
    }

    setMasterScanning(false);
  }, [market]);

  // Load portfolio from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("strategyScreenerPortfolio");
      if (saved) setPortfolio(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // Save portfolio to localStorage whenever it changes
  useEffect(() => {
    if (portfolio.length > 0) {
      localStorage.setItem("strategyScreenerPortfolio", JSON.stringify(portfolio));
    }
  }, [portfolio]);

  const addToPortfolio = useCallback(() => {
    const sym = addSymbol.trim().toUpperCase();
    const price = parseFloat(addBuyPrice);
    const qty = parseInt(addQuantity) || 1;
    if (!sym || isNaN(price) || price <= 0) return;
    if (portfolio.some(p => p.symbol === sym)) return; // Already exists
    const updated = [...portfolio, { symbol: sym, buyPrice: price, quantity: qty, addedAt: new Date().toISOString() }];
    setPortfolio(updated);
    setAddSymbol("");
    setAddBuyPrice("");
    setAddQuantity("1");
  }, [addSymbol, addBuyPrice, addQuantity, portfolio]);

  const removeFromPortfolio = useCallback((symbol: string) => {
    const updated = portfolio.filter(p => p.symbol !== symbol);
    setPortfolio(updated);
    setPortfolioData(prev => prev.filter(p => p.symbol !== symbol));
    if (updated.length === 0) localStorage.removeItem("strategyScreenerPortfolio");
  }, [portfolio]);

  const refreshPortfolio = useCallback(async () => {
    if (portfolio.length === 0) return;
    setPortfolioLoading(true);
    try {
      const symbols = portfolio.map(p => p.symbol).join(",");
      const res = await fetch(`/api/portfolio?symbols=${symbols}&market=${market}`);
      if (res.ok) {
        const data = await res.json();
        setPortfolioData(data.stocks);
      }
    } catch { /* ignore */ }
    setPortfolioLoading(false);
  }, [portfolio, market]);

  const loadGlobal = useCallback(async () => {
    setGlobalLoading(true);
    try {
      const res = await fetch("/api/global");
      if (res.ok) setGlobalData(await res.json());
    } catch { /* ignore */ }
    setGlobalLoading(false);
  }, []);

  const loadSignals = useCallback(async () => {
    setSignalsLoading(true);
    try {
      const res = await fetch(`/api/signals?market=${market}`);
      if (res.ok) setSignalsData(await res.json());
    } catch { /* ignore */ }
    setSignalsLoading(false);
  }, [market]);

  const loadBot = useCallback(async () => {
    setBotLoading(true);
    try {
      const res = await fetch(`/api/bot/state?market=${market}`);
      if (res.ok) setBotState(await res.json());
    } catch { /* ignore */ }
    setBotLoading(false);
  }, [market]);

  const runBotNow = useCallback(async () => {
    track("bot_run_manual", { market });
    setBotRunning(true);
    try {
      await fetch(`/api/bot/run?market=${market}`, { method: "POST" });
      await loadBot();
    } catch { /* ignore */ }
    setBotRunning(false);
  }, [market, loadBot]);

  const resetBot = useCallback(async () => {
    if (!confirm(`Reset bot back to starting capital for ${market === "US" ? "US" : "India"}? This wipes all holdings and trade history.`)) return;
    setBotResetting(true);
    try {
      await fetch(`/api/bot/reset?market=${market}`, { method: "POST" });
      await loadBot();
    } catch { /* ignore */ }
    setBotResetting(false);
  }, [market, loadBot]);

  const loadEtfs = useCallback(async () => {
    track("etf_scan", { market });
    setEtfLoading(true);
    try {
      const res = await fetch(`/api/etfs?market=${market}`);
      if (res.ok) setEtfData(await res.json());
    } catch { /* ignore */ }
    setEtfLoading(false);
  }, [market]);

  const searchStock = useCallback(async (symbol: string) => {
    if (!symbol.trim()) return;
    setSearchLoading(true);
    setStockDetail(null);
    try {
      const res = await fetch(`/api/stocks?symbol=${symbol.trim().toUpperCase()}&market=${market}`);
      if (res.ok) setStockDetail(await res.json());
    } catch { /* ignore */ }
    setSearchLoading(false);
  }, [market]);

  const handleSelectStrategy = (s: StrategyInfo) => {
    track("strategy_view", { strategy_id: s.id, strategy_name: s.name, book: s.book, category: s.category });
    setSelectedStrategy(s);
    setResults([]);
    setSignalFilter("ALL");
    setChartStock(null);
    runScreener(s, "ALL");
  };

  const filteredStrategies = STRATEGIES.filter((s) => {
    const catMatch = categoryFilter === "All" || s.category === categoryFilter;
    const bookMatch = bookFilter === "All Books" || s.book === bookFilter;
    return catMatch && bookMatch;
  });

  const categories = ["All", "Swing", "Intraday", "Advanced", "Positional", "Scalping", "Options", "Price Action", "Value Investing", "Candlestick", "Trend Following", "Index Investing"];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/5" style={{ background: "var(--header-bg)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setActiveTab("home")}
              className="flex items-center gap-3 hover:opacity-90 transition-opacity"
              aria-label="JuicedTrade home"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 flex items-center justify-center font-bold text-sm text-white shadow-lg">JT</div>
              <div className="hidden sm:block text-left">
                <h1 className="text-lg font-bold tracking-tight">JuicedTrade</h1>
                <p className="text-[10px] text-gray-500 -mt-0.5">{universeLabel} &middot; {STRATEGIES.length} Strategies</p>
              </div>
            </button>
          </div>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5 overflow-x-auto flex-1 justify-center">
            {(["home", "market", "global", "signals", "portfolio", "bot", "etfs", "strategies", "scan", "search", "learn"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); if (tab === "signals" && !signalsData) loadSignals(); if (tab === "global" && !globalData) loadGlobal(); if (tab === "portfolio" && portfolio.length > 0 && portfolioData.length === 0) refreshPortfolio(); if (tab === "etfs" && !etfData) loadEtfs(); if (tab === "bot" && !botState) loadBot(); }}
                className={`px-2.5 sm:px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
              >
                {tab === "home" ? "Home" : tab === "market" ? "Market" : tab === "global" ? "Global" : tab === "signals" ? "Signals" : tab === "portfolio" ? `Portfolio${portfolio.length > 0 ? ` (${portfolio.length})` : ""}` : tab === "bot" ? "Bot" : tab === "etfs" ? "ETFs" : tab === "strategies" ? "Strategies" : tab === "scan" ? "Scan" : tab === "search" ? "Lookup" : "Learn"}
              </button>
            ))}
          </div>
          {/* Market toggle */}
          <div className="flex-shrink-0 flex items-center bg-white/5 border border-white/5 rounded-lg p-0.5" role="group" aria-label="Market">
            <button
              onClick={() => switchMarket("IN")}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${market === "IN" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
              title="India (NSE)"
              aria-pressed={market === "IN"}
            >
              <span className="mr-1">🇮🇳</span>IN
            </button>
            <button
              onClick={() => switchMarket("US")}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${market === "US" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
              title="USA (S&P 500)"
              aria-pressed={market === "US"}
            >
              <span className="mr-1">🇺🇸</span>US
            </button>
          </div>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center transition-all"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {/* ─── HOME / LANDING TAB ─── */}
        {activeTab === "home" && (
          <div className="-mx-4 sm:-mx-6 -my-6">
            {/* HERO */}
            <section className="relative overflow-hidden">
              <div
                className="absolute inset-0 -z-10 opacity-60"
                style={{
                  background:
                    "radial-gradient(60% 50% at 50% 0%, rgba(251,191,36,0.18) 0%, rgba(239,68,68,0.12) 35%, rgba(0,0,0,0) 70%)",
                }}
              />
              <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium mb-6">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                  </span>
                  Free during public beta · No sign-up required
                </div>
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-5">
                  <span className="bg-gradient-to-br from-white via-amber-100 to-amber-400 bg-clip-text text-transparent">
                    100 trading strategies.
                  </span>
                  <br />
                  <span className="bg-gradient-to-br from-amber-300 via-orange-400 to-red-500 bg-clip-text text-transparent">
                    Two markets. One screener.
                  </span>
                </h1>
                <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed mb-8">
                  <strong className="text-gray-200">JuicedTrade Stock Screener</strong> evaluates every NSE-listed Indian stock and the entire S&amp;P 500 against 100 strategies from six classic trading books — every single day. Get buy/sell signals, run backtests, screen ETFs by theme, and watch an autonomous bot trade the signals in real time.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
                  <button
                    onClick={() => { track("cta_click", { label: "launch_screener", location: "hero" }); setActiveTab("market"); }}
                    className="px-6 py-3 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-black font-bold text-sm shadow-lg shadow-amber-500/20 transition-all"
                  >
                    Launch the Screener →
                  </button>
                  <button
                    onClick={() => { track("cta_click", { label: "see_bot", location: "hero" }); setActiveTab("bot"); }}
                    className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-sm transition-all"
                  >
                    See the Bot in Action
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="text-lg">🇮🇳</span> 2,100+ NSE stocks</span>
                  <span className="flex items-center gap-1.5"><span className="text-lg">🇺🇸</span> 500 S&amp;P stocks</span>
                  <span className="flex items-center gap-1.5"><span className="text-emerald-400">●</span> {STRATEGIES.length} strategies</span>
                  <span className="flex items-center gap-1.5"><span className="text-blue-400">●</span> 80+ ETFs scanned</span>
                  <span className="flex items-center gap-1.5"><span className="text-purple-400">●</span> 1-click backtest</span>
                </div>
              </div>
            </section>

            {/* SOCIAL PROOF — book sources */}
            <section className="border-y border-white/5 bg-white/[0.015]" aria-labelledby="sources-heading">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                <h2 id="sources-heading" className="text-[10px] uppercase tracking-[0.2em] text-gray-500 text-center mb-5 font-semibold">
                  Strategies sourced from
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center">
                  {[
                    { title: "51 Trading Strategies", author: "A. Singhal", count: 51 },
                    { title: "Intelligent Investor", author: "B. Graham", count: 5 },
                    { title: "Technical Analysis", author: "J. Murphy", count: 10 },
                    { title: "Candlestick Charting", author: "S. Nison", count: 9 },
                    { title: "Common Sense Investing", author: "J. Bogle", count: 3 },
                    { title: "Market Wizards", author: "J. Schwager", count: 5 },
                  ].map((b) => (
                    <div key={b.title} className="px-3 py-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="text-xs font-semibold text-gray-300 truncate">{b.title}</div>
                      <div className="text-[10px] text-gray-500">{b.author}</div>
                      <div className="text-[10px] text-amber-400 mt-1 font-mono">{b.count} strategies</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* FEATURES */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16" aria-labelledby="features-heading">
              <div className="text-center mb-12">
                <h2 id="features-heading" className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                  Everything you need to find the next trade
                </h2>
                <p className="text-gray-500 max-w-2xl mx-auto">
                  A complete decision stack — from market overview to entry signal to backtest — for both Indian and US markets, in one place.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    icon: "📊",
                    title: "100-Strategy Screener",
                    body: "Every stock evaluated against 100 named strategies daily. Filter by book, category, or signal. See exactly which strategies agree.",
                    cta: "strategies" as const,
                  },
                  {
                    icon: "🤖",
                    title: "Autonomous Trading Bot",
                    body: "Paper-trading bot trades the signals every day with ₹10L (IN) or $5K (US). Max 5 positions. Live equity curve with buy/sell markers.",
                    cta: "bot" as const,
                  },
                  {
                    icon: "🎯",
                    title: "Multi-Strategy Scan",
                    body: "Surface stocks where 2+ strategies agree on a BUY signal. Ranked by confluence — find the highest-conviction setups in seconds.",
                    cta: "scan" as const,
                  },
                  {
                    icon: "💼",
                    title: "ETF Screener by Theme",
                    body: "80+ ETFs grouped by theme (Sector, Thematic, Bonds, Commodities, International). Each gets a Buy/Hold/Sell score with rationale.",
                    cta: "etfs" as const,
                  },
                  {
                    icon: "📈",
                    title: "Market Overview",
                    body: "Nifty/Sensex (IN) or S&P 500/Dow/Nasdaq (US) with pivots, Fibonacci, ATR targets, and clustered support/resistance.",
                    cta: "market" as const,
                  },
                  {
                    icon: "🌍",
                    title: "Global Market Cues",
                    body: "20+ world markets with a quantitative prediction (0-100) for both India and US sessions. See exactly which factors are driving direction.",
                    cta: "global" as const,
                  },
                  {
                    icon: "📡",
                    title: "Signals & Sentiment",
                    body: "15+ buy/sell technical indicators, sentiment gauge, market events. Live read of the index's underlying technical posture.",
                    cta: "signals" as const,
                  },
                  {
                    icon: "🔬",
                    title: "1-Click Backtest",
                    body: "Backtest any strategy on the primary index plus 5 major stocks over a year. Win rate, avg return, drawdown, full trade history.",
                    cta: "strategies" as const,
                  },
                  {
                    icon: "🔎",
                    title: "Stock Lookup",
                    body: "Type any symbol to see all 100 strategy signals at once, full 52-week stats, and an interactive candlestick chart.",
                    cta: "search" as const,
                  },
                ].map((f) => (
                  <button
                    key={f.title}
                    onClick={() => setActiveTab(f.cta)}
                    className="group text-left bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 rounded-2xl p-5 transition-all"
                  >
                    <div className="text-2xl mb-2.5">{f.icon}</div>
                    <h3 className="font-bold mb-1.5 group-hover:text-amber-300 transition-colors">{f.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>
                    <div className="mt-3 text-xs font-semibold text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Open →
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* HOW IT WORKS */}
            <section className="bg-white/[0.015] border-y border-white/5" aria-labelledby="how-heading">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
                <div className="text-center mb-10">
                  <h2 id="how-heading" className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                    How it works
                  </h2>
                  <p className="text-gray-500 max-w-xl mx-auto">
                    Three steps to a strategy-ranked watchlist. No accounts, no setup, no spreadsheets.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {[
                    {
                      n: "01",
                      title: "Pick your market",
                      body: "Toggle 🇮🇳 India or 🇺🇸 US in the header. The screener, ETFs, signals, and bot all switch markets together.",
                    },
                    {
                      n: "02",
                      title: "Choose a strategy or scan",
                      body: "Open the Strategies tab to run a single strategy across the universe, or Scan to find multi-strategy confluence.",
                    },
                    {
                      n: "03",
                      title: "Validate with backtest + chart",
                      body: "One-click backtest gives win rate and drawdown. Click any result for the candlestick chart with indicators overlaid.",
                    },
                  ].map((s) => (
                    <div key={s.n} className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                      <div className="text-3xl font-bold font-mono bg-gradient-to-br from-amber-400 to-orange-500 bg-clip-text text-transparent">
                        {s.n}
                      </div>
                      <h3 className="font-bold mt-3 mb-2">{s.title}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* COMPARISON */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16" aria-labelledby="compare-heading">
              <div className="text-center mb-10">
                <h2 id="compare-heading" className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                  Why JuicedTrade
                </h2>
                <p className="text-gray-500 max-w-2xl mx-auto">
                  Other tools make you compose one condition or read one chart at a time. JuicedTrade evaluates 100 strategies in parallel — every stock, every day, both markets — and shows you exactly which ones agree.
                </p>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-white/5">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.03]">
                    <tr>
                      <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">&nbsp;</th>
                      <th className="text-center px-4 py-3 text-xs font-bold text-amber-400">JuicedTrade</th>
                      <th className="text-center px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500">Chartink</th>
                      <th className="text-center px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500">Screener.in</th>
                      <th className="text-center px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500">TradingView</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    {[
                      { f: "Pre-built named strategies", j: `${STRATEGIES.length} from 6 books`, c: "User-built", s: "User-built", t: "Pine Script" },
                      { f: "Multi-strategy confluence", j: "Yes — ranked", c: "Single condition", s: "—", t: "—" },
                      { f: "NSE + S&P 500 in one toggle", j: "Yes", c: "NSE only", s: "NSE only", t: "Yes (paid)" },
                      { f: "Autonomous paper bot", j: "Built-in", c: "—", s: "—", t: "—" },
                      { f: "ETF screener with signals", j: "Yes (themed)", c: "—", s: "—", t: "Lists only" },
                      { f: "1-click backtest", j: "Yes", c: "Limited", s: "—", t: "Yes (paid)" },
                      { f: "Price", j: "Free (beta)", c: "Freemium", s: "Freemium", t: "Freemium → $15-60/mo" },
                    ].map((row) => (
                      <tr key={row.f} className="border-t border-white/5">
                        <td className="px-4 py-3 text-xs text-gray-400">{row.f}</td>
                        <td className="px-4 py-3 text-center text-xs font-semibold text-emerald-400">{row.j}</td>
                        <td className="px-4 py-3 text-center text-xs text-gray-500">{row.c}</td>
                        <td className="px-4 py-3 text-center text-xs text-gray-500">{row.s}</td>
                        <td className="px-4 py-3 text-center text-xs text-gray-500">{row.t}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-gray-600 mt-3 text-center">
                Competitor pricing and capabilities are summarized from publicly available information at time of writing. Names and trademarks are property of their respective owners.
              </p>
            </section>

            {/* FAQ — also encoded as JSON-LD in layout.tsx for ARO */}
            <section className="bg-white/[0.015] border-y border-white/5" aria-labelledby="faq-heading">
              <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
                <div className="text-center mb-10">
                  <h2 id="faq-heading" className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                    Frequently asked questions
                  </h2>
                  <p className="text-gray-500">Quick answers to common questions about JuicedTrade.</p>
                </div>
                <div className="space-y-3">
                  {[
                    {
                      q: "What is JuicedTrade?",
                      a: "JuicedTrade is a free stock screener for Indian (NSE) and US (S&P 500) markets. It evaluates every stock against 100 trading strategies — drawn from six classic books plus OpenBB signal concepts — and gives daily buy / sell / neutral signals.",
                    },
                    {
                      q: "Is it really free?",
                      a: "Yes. JuicedTrade is free during the public beta. There is no sign-up, no credit card, and no paid tier. Open the app and start screening immediately.",
                    },
                    {
                      q: "Does JuicedTrade place real trades?",
                      a: "No. JuicedTrade does not connect to any brokerage and cannot place real orders. The built-in trading bot is a paper-trading simulator — purely to demonstrate strategy performance over time.",
                    },
                    {
                      q: "Which markets are covered?",
                      a: "India: all 2,100+ NSE-listed equities. United States: all 500 S&P 500 stocks. Switch markets from the header toggle at any time — the entire app adapts.",
                    },
                    {
                      q: "How is it different from Chartink, Screener.in, or TradingView?",
                      a: "Three things: (1) JuicedTrade evaluates 100 named strategies in parallel and shows which ones agree — you don't compose conditions; (2) covers NSE and S&P 500 in one tool with one toggle; (3) ships an autonomous paper-trading bot that acts on the same strategies.",
                    },
                    {
                      q: "Where does the data come from?",
                      a: "Price, volume, and historical OHLCV come from Yahoo Finance. NSE tickers from the official EQUITY_L archive. S&P 500 list from the public datasets/s-and-p-500-companies repository. All indicators and strategy logic are computed inside JuicedTrade.",
                    },
                    {
                      q: "Is this investment advice?",
                      a: "No. JuicedTrade is an analytical and educational tool, not registered with SEBI or the SEC. Always do your own research and consult a licensed advisor before investing.",
                    },
                  ].map((item, i) => (
                    <details key={i} className="group bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                      <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                        <h3 className="text-sm font-semibold text-gray-200 pr-4">{item.q}</h3>
                        <svg className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="px-5 pb-4 text-sm text-gray-400 leading-relaxed">{item.a}</div>
                    </details>
                  ))}
                </div>
              </div>
            </section>

            {/* FINAL CTA */}
            <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                Ready to see what 100 strategies say about your watchlist?
              </h2>
              <p className="text-gray-500 mb-8">
                No account. No credit card. Just open the screener and pick a market.
              </p>
              <button
                onClick={() => { track("cta_click", { label: "launch_juicedtrade", location: "footer_cta" }); setActiveTab("market"); }}
                className="px-8 py-4 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-black font-bold text-base shadow-lg shadow-amber-500/20 transition-all"
              >
                Launch JuicedTrade →
              </button>
            </section>

            {/* FOOTER */}
            <footer className="border-t border-white/5">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 flex items-center justify-center font-bold text-[10px] text-white">JT</div>
                  <div>
                    <div className="font-semibold text-gray-300">JuicedTrade Stock Screener</div>
                    <div className="text-[10px] text-gray-600">© {new Date().getFullYear()} JuicedTrade. Free during public beta.</div>
                  </div>
                </div>
                <div className="text-[10px] text-gray-600 max-w-md sm:text-right leading-relaxed">
                  JuicedTrade is an analytical tool, not investment advice. Not registered with SEBI or the SEC. Always do your own research before investing.
                </div>
              </div>
            </footer>
          </div>
        )}

        {/* ─── MARKET TAB ─── */}
        {activeTab === "market" && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold">Market Overview</h2>
              <p className="text-sm text-gray-500 mt-1">
                {market === "US"
                  ? "S&P 500, Dow & Nasdaq with key levels, targets, supports and resistances"
                  : "Sensex & Nifty 50 with key levels, targets, supports and resistances"}
              </p>
            </div>
            <MarketChart market={market} />
          </div>
        )}

        {/* ─── GLOBAL TAB ─── */}
        {activeTab === "global" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">Global Market Cues</h2>
                <p className="text-sm text-gray-500 mt-1">How world markets impact Indian equities — prediction based on 20+ global indicators</p>
              </div>
              <button
                onClick={loadGlobal}
                disabled={globalLoading}
                className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-cyan-500/20"
              >
                {globalLoading ? <><Spinner /> Loading...</> : "Refresh Global Data"}
              </button>
            </div>

            {globalLoading && !globalData && (
              <div className="space-y-4">
                <div className="skeleton h-48 w-full rounded-xl" />
                <div className="grid grid-cols-4 gap-3">{[...Array(8)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
                <div className="skeleton h-64 w-full rounded-xl" />
              </div>
            )}

            {globalData && (() => {
              const PredictionPanel = ({ title, flag, badge, pred, factorsSubtitle }: { title: string; flag: string; badge: string; pred: { score: number; label: string; factors: PredictionFactor[] }; factorsSubtitle: string }) => (
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg leading-none">{flag}</span>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{title}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{badge}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-8">
                    <div className="flex-shrink-0 relative w-40 h-40">
                      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                        <circle cx="60" cy="60" r="50" fill="none"
                          stroke={pred.score >= 65 ? "#10b981" : pred.score >= 55 ? "#22c55e" : pred.score >= 45 ? "#eab308" : pred.score >= 35 ? "#f97316" : "#ef4444"}
                          strokeWidth="12" strokeLinecap="round"
                          strokeDasharray={`${pred.score * 3.14} 314`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-4xl font-bold ${pred.score >= 55 ? "text-emerald-400" : pred.score >= 45 ? "text-yellow-400" : "text-red-400"}`}>
                          {pred.score}
                        </span>
                        <span className="text-[10px] text-gray-500 uppercase text-center leading-tight mt-0.5">{pred.label}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-[280px] space-y-2">
                      <div className="text-xs text-gray-500 mb-2">{factorsSubtitle}</div>
                      {pred.factors.map((f, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-24 text-xs font-medium text-gray-300 truncate flex-shrink-0">{f.factor}</div>
                          <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${f.direction === "UP" ? "bg-emerald-500/20 text-emerald-400" : f.direction === "DOWN" ? "bg-red-500/20 text-red-400" : "bg-gray-500/20 text-gray-400"}`}>
                            {f.direction === "UP" ? "▲" : f.direction === "DOWN" ? "▼" : "—"}
                          </div>
                          <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden relative">
                            <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
                            {f.weight >= 0 ? (
                              <div className="absolute inset-y-0 left-1/2 bg-emerald-500 rounded-r-full transition-all duration-500" style={{ width: `${Math.min(50, f.weight)}%` }} />
                            ) : (
                              <div className="absolute inset-y-0 bg-red-500 rounded-l-full transition-all duration-500" style={{ right: "50%", width: `${Math.min(50, Math.abs(f.weight))}%` }} />
                            )}
                          </div>
                          <span className={`text-xs font-mono w-10 text-right flex-shrink-0 ${f.weight > 0 ? "text-emerald-400" : f.weight < 0 ? "text-red-400" : "text-gray-500"}`}>
                            {f.weight > 0 ? "+" : ""}{f.weight}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
              return (
              <div className="space-y-6">
                {/* ── India Prediction ── */}
                <PredictionPanel
                  title="India Market Prediction"
                  flag="🇮🇳"
                  badge="Based on Global Cues"
                  pred={globalData.prediction}
                  factorsSubtitle="Key factors influencing Nifty/Sensex (sorted by impact):"
                />

                {/* ── US Prediction ── */}
                {globalData.usPrediction && (
                  <PredictionPanel
                    title="US Market Prediction"
                    flag="🇺🇸"
                    badge="Based on Global Cues"
                    pred={globalData.usPrediction}
                    factorsSubtitle="Key factors influencing S&P 500 / Nasdaq (sorted by impact):"
                  />
                )}

                {/* ── Global Markets Grid ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">World Markets</h3>
                    <div className="flex items-center gap-1.5">
                      {(["all", "americas", "europe", "asia", "commodity", "currency", "volatility"] as const).map((r) => (
                        <button key={r} onClick={() => setGlobalRegionFilter(r)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${globalRegionFilter === r ? "bg-white/10 text-white border-white/20" : "border-white/5 text-gray-500 hover:text-gray-300"}`}
                        >{r === "americas" ? "US" : r === "currency" ? "FX/Bonds" : r.charAt(0).toUpperCase() + r.slice(1)}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {globalData.markets
                      .filter(m => globalRegionFilter === "all" || m.region === globalRegionFilter)
                      .map((m) => {
                      const isCardExpanded = expandedGlobalCard === m.symbol;
                      const corrColor = m.correlation > 0.4 ? "text-emerald-400" : m.correlation > 0 ? "text-emerald-400/60" : m.correlation > -0.2 ? "text-gray-400" : "text-red-400";
                      const corrBg = m.correlation > 0.4 ? "bg-emerald-500/10" : m.correlation > 0 ? "bg-emerald-500/5" : m.correlation > -0.2 ? "bg-gray-500/5" : "bg-red-500/10";
                      return (
                      <div key={m.symbol} className={`bg-white/[0.02] border rounded-xl transition-all hover:bg-white/[0.03] ${m.changePercent >= 0.5 ? "border-emerald-500/20" : m.changePercent <= -0.5 ? "border-red-500/20" : "border-white/5"}`}>
                        <div className="p-4 cursor-pointer" onClick={() => setExpandedGlobalCard(isCardExpanded ? null : m.symbol)}>
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <div className="text-sm font-semibold">{m.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${m.status === "open" ? "bg-emerald-400 animate-pulse" : "bg-gray-500"}`} />
                                <span className="text-[10px] text-gray-500">{m.status === "open" ? "Live" : "Closed"}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  m.region === "americas" ? "bg-blue-500/10 text-blue-400" :
                                  m.region === "europe" ? "bg-purple-500/10 text-purple-400" :
                                  m.region === "asia" ? "bg-orange-500/10 text-orange-400" :
                                  m.region === "commodity" ? "bg-amber-500/10 text-amber-400" :
                                  m.region === "currency" ? "bg-teal-500/10 text-teal-400" :
                                  "bg-pink-500/10 text-pink-400"
                                }`}>{m.region}</span>
                                {/* Correlation badge */}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${corrBg} ${corrColor}`}>
                                  {m.correlation > 0 ? "+" : ""}{m.correlation.toFixed(2)} corr
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-base font-bold font-mono">
                                {m.region === "currency" && m.symbol === "USDINR=X" ? "₹" : m.region === "commodity" ? "$" : ""}
                                {m.price.toFixed(m.price < 100 ? 2 : 0)}
                              </div>
                              <div className={`text-sm font-mono font-semibold ${m.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {m.changePercent >= 0 ? "+" : ""}{m.changePercent.toFixed(2)}%
                              </div>
                            </div>
                          </div>
                          {/* Mini trend bars */}
                          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/5">
                            <div className="flex-1">
                              <div className="text-[9px] text-gray-600 uppercase">1D</div>
                              <div className={`text-[11px] font-mono font-semibold ${m.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {m.changePercent >= 0 ? "+" : ""}{m.changePercent.toFixed(2)}%
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="text-[9px] text-gray-600 uppercase">1W</div>
                              <div className={`text-[11px] font-mono font-semibold ${m.weekChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {m.weekChange >= 0 ? "+" : ""}{m.weekChange.toFixed(2)}%
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="text-[9px] text-gray-600 uppercase">1M</div>
                              <div className={`text-[11px] font-mono font-semibold ${m.monthChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {m.monthChange >= 0 ? "+" : ""}{m.monthChange.toFixed(2)}%
                              </div>
                            </div>
                            <div className="w-12 h-6 flex items-end gap-px">
                              <div className={`flex-1 rounded-t-sm ${m.monthChange >= 0 ? "bg-emerald-500/30" : "bg-red-500/30"}`} style={{ height: `${Math.min(100, Math.abs(m.monthChange) * 8 + 20)}%` }} />
                              <div className={`flex-1 rounded-t-sm ${m.weekChange >= 0 ? "bg-emerald-500/50" : "bg-red-500/50"}`} style={{ height: `${Math.min(100, Math.abs(m.weekChange) * 12 + 20)}%` }} />
                              <div className={`flex-1 rounded-t-sm ${m.changePercent >= 0 ? "bg-emerald-500" : "bg-red-500"}`} style={{ height: `${Math.min(100, Math.abs(m.changePercent) * 20 + 20)}%` }} />
                            </div>
                          </div>
                        </div>
                        {/* Expanded: Correlation & Impact Details */}
                        {isCardExpanded && (
                          <div className="border-t border-white/5 px-4 py-3 space-y-2.5 bg-white/[0.01]">
                            {/* Correlation meter */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Nifty Correlation</span>
                                <span className={`text-xs font-mono font-bold ${corrColor}`}>{m.correlation > 0 ? "+" : ""}{m.correlation.toFixed(2)}</span>
                              </div>
                              <div className="h-2 bg-white/5 rounded-full overflow-hidden relative">
                                <div className="absolute inset-y-0 left-1/2 w-px bg-white/20 z-10" />
                                {m.correlation >= 0 ? (
                                  <div className="absolute inset-y-0 left-1/2 bg-emerald-500 rounded-r-full" style={{ width: `${m.correlation * 50}%` }} />
                                ) : (
                                  <div className="absolute inset-y-0 bg-red-500 rounded-l-full" style={{ right: "50%", width: `${Math.abs(m.correlation) * 50}%` }} />
                                )}
                              </div>
                              <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                                <span>-1 (Inverse)</span><span>0 (None)</span><span>+1 (Direct)</span>
                              </div>
                            </div>

                            <div className="bg-white/[0.02] rounded-lg p-2.5">
                              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Correlation</div>
                              <p className="text-[11px] text-gray-300 leading-relaxed">{m.correlationNote}</p>
                            </div>

                            <div className="bg-white/[0.02] rounded-lg p-2.5">
                              <div className="text-[10px] text-cyan-400 uppercase tracking-wider font-semibold mb-1">Impact on India</div>
                              <p className="text-[11px] text-gray-300 leading-relaxed">{m.impactOnIndia}</p>
                            </div>

                            <div className="bg-white/[0.02] rounded-lg p-2.5">
                              <div className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold mb-1">Historic Pattern</div>
                              <p className="text-[11px] text-gray-300 leading-relaxed">{m.historicPattern}</p>
                            </div>

                            <div className="bg-white/[0.02] rounded-lg p-2.5">
                              <div className="text-[10px] text-purple-400 uppercase tracking-wider font-semibold mb-1">Lag Effect</div>
                              <p className="text-[11px] text-gray-300 leading-relaxed">{m.lagEffect}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Correlation Insights (Impact on India) ── */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Impact Analysis on Indian Markets</h3>
                  {globalData.insights.length === 0 ? (
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-8 text-center text-gray-500 text-sm">
                      No significant global cues detected. Markets are relatively calm.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {globalData.insights.map((insight, i) => (
                        <div key={i} className={`bg-white/[0.02] border rounded-xl p-4 transition-all hover:bg-white/[0.03] ${
                          insight.strength === "STRONG" ? "border-l-2" : "border-l"
                        } ${
                          insight.impact === "POSITIVE" ? "border-l-emerald-500 border-r border-t border-b border-white/5" :
                          insight.impact === "NEGATIVE" ? "border-l-red-500 border-r border-t border-b border-white/5" :
                          insight.impact === "MIXED" ? "border-l-amber-500 border-r border-t border-b border-white/5" :
                          "border-white/5"
                        }`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-sm font-semibold ${
                                  insight.impact === "POSITIVE" ? "text-emerald-400" :
                                  insight.impact === "NEGATIVE" ? "text-red-400" :
                                  insight.impact === "MIXED" ? "text-amber-400" : "text-gray-300"
                                }`}>{insight.title}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  insight.strength === "STRONG" ? "bg-white/10 text-white" :
                                  insight.strength === "MODERATE" ? "bg-white/5 text-gray-400" :
                                  "bg-white/[0.03] text-gray-500"
                                }`}>{insight.strength}</span>
                              </div>
                              <p className="text-xs text-gray-400 leading-relaxed">{insight.description}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                insight.impact === "POSITIVE" ? "bg-emerald-500/15 text-emerald-400" :
                                insight.impact === "NEGATIVE" ? "bg-red-500/15 text-red-400" :
                                insight.impact === "MIXED" ? "bg-amber-500/15 text-amber-400" :
                                "bg-gray-500/15 text-gray-400"
                              }`}>
                                {insight.impact === "POSITIVE" ? "▲ Nifty +" : insight.impact === "NEGATIVE" ? "▼ Nifty −" : insight.impact === "MIXED" ? "◆ Mixed" : "● Neutral"}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                insight.category === "index" ? "bg-blue-500/10 text-blue-400" :
                                insight.category === "commodity" ? "bg-amber-500/10 text-amber-400" :
                                insight.category === "currency" ? "bg-teal-500/10 text-teal-400" :
                                "bg-pink-500/10 text-pink-400"
                              }`}>{insight.category}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── How to Read This ── */}
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">How Global Cues Affect Indian Markets</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px]">
                    <div><span className="text-blue-400 font-semibold">US Close (7-1:30 AM IST):</span> <span className="text-gray-500">Strongest predictor. S&amp;P/Nasdaq have ~0.6 correlation with Nifty next-day open.</span></div>
                    <div><span className="text-orange-400 font-semibold">Asian Peers (5:30 AM-3 PM):</span> <span className="text-gray-500">Nikkei, Hang Seng, Shanghai trade same hours. Real-time influence on Nifty intraday.</span></div>
                    <div><span className="text-purple-400 font-semibold">Europe (1:30-10 PM IST):</span> <span className="text-gray-500">FTSE/DAX opening impacts Indian afternoon session via FII activity.</span></div>
                    <div><span className="text-amber-400 font-semibold">Crude Oil:</span> <span className="text-gray-500">India imports 85% of oil. Rising crude = weaker rupee, higher inflation, negative for Nifty.</span></div>
                    <div><span className="text-teal-400 font-semibold">USD/INR & DXY:</span> <span className="text-gray-500">Strong dollar pulls FII money from India. Weak rupee = FII outflows. IT stocks benefit.</span></div>
                    <div><span className="text-pink-400 font-semibold">VIX & Gold:</span> <span className="text-gray-500">VIX &gt;25 = fear mode. Gold surge = flight to safety. Both signal equity risk.</span></div>
                  </div>
                </div>

                <div className="text-[10px] text-gray-600 text-center">
                  Last updated: {new Date(globalData.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
                </div>
              </div>
              );
            })()}

            {!globalLoading && !globalData && (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="text-lg font-semibold mb-1">Global Market Cues</h3>
                <p className="text-sm text-gray-500 max-w-md">Click &quot;Refresh Global Data&quot; to see how S&amp;P 500, Nasdaq, Nikkei, Crude Oil, USD/INR and 15+ global indicators predict today&apos;s Indian market direction.</p>
              </div>
            )}
          </div>
        )}

        {/* ─── SIGNALS TAB ─── */}
        {activeTab === "signals" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">Market Signals & Events</h2>
                <p className="text-sm text-gray-500 mt-1">Real-time buy/sell indicators and market-moving events from 15+ technical signals</p>
              </div>
              <button
                onClick={loadSignals}
                disabled={signalsLoading}
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-500/20"
              >
                {signalsLoading ? <><Spinner /> Loading...</> : "Refresh Signals"}
              </button>
            </div>

            {signalsLoading && !signalsData && (
              <div className="space-y-4">
                <div className="skeleton h-40 w-full rounded-xl" />
                <div className="grid grid-cols-3 gap-4"><div className="skeleton h-32 rounded-xl" /><div className="skeleton h-32 rounded-xl" /><div className="skeleton h-32 rounded-xl" /></div>
                <div className="skeleton h-64 w-full rounded-xl" />
              </div>
            )}

            {signalsData && (
              <div className="space-y-6">
                {/* ── Sentiment Gauge ── */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Market Sentiment</h3>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{signalsData.market.primaryName}: <span className="font-mono font-semibold text-white">{signalsData.market.primaryPrice}</span> <span className={parseFloat(signalsData.market.primaryChange) >= 0 ? "text-emerald-400" : "text-red-400"}>{parseFloat(signalsData.market.primaryChange) >= 0 ? "+" : ""}{signalsData.market.primaryChange}%</span></span>
                      {signalsData.market.secondaryPrice && <span>{signalsData.market.secondaryName}: <span className="font-mono font-semibold text-white">{signalsData.market.secondaryPrice}</span></span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    {/* Gauge */}
                    <div className="flex-shrink-0 relative w-36 h-36">
                      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                        <circle cx="60" cy="60" r="50" fill="none"
                          stroke={signalsData.sentiment.score >= 70 ? "#10b981" : signalsData.sentiment.score >= 55 ? "#22c55e" : signalsData.sentiment.score >= 45 ? "#eab308" : signalsData.sentiment.score >= 30 ? "#f97316" : "#ef4444"}
                          strokeWidth="10" strokeLinecap="round"
                          strokeDasharray={`${signalsData.sentiment.score * 3.14} 314`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-3xl font-bold ${signalsData.sentiment.score >= 55 ? "text-emerald-400" : signalsData.sentiment.score >= 45 ? "text-yellow-400" : "text-red-400"}`}>
                          {signalsData.sentiment.score}
                        </span>
                        <span className="text-[10px] text-gray-500 uppercase">{signalsData.sentiment.label}</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-400 font-bold text-lg w-8 text-right">{signalsData.sentiment.bullish}</span>
                        <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${(signalsData.sentiment.bullish / signalsData.sentiment.total) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-16">Bullish</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 font-bold text-lg w-8 text-right">{signalsData.sentiment.neutral}</span>
                        <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gray-500 rounded-full transition-all duration-700" style={{ width: `${(signalsData.sentiment.neutral / signalsData.sentiment.total) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-16">Neutral</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-red-400 font-bold text-lg w-8 text-right">{signalsData.sentiment.bearish}</span>
                        <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 rounded-full transition-all duration-700" style={{ width: `${(signalsData.sentiment.bearish / signalsData.sentiment.total) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-16">Bearish</span>
                      </div>
                      <div className="text-[10px] text-gray-600 mt-1">Based on {signalsData.sentiment.total} technical indicators analyzed on {signalsData.market.primaryName}</div>
                    </div>
                  </div>
                </div>

                {/* ── Buy/Sell Signal Indicators ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Signal Indicators</h3>
                    <div className="flex items-center gap-1.5">
                      {(["all", "trend", "momentum", "volume", "volatility", "breadth"] as const).map((cat) => (
                        <button key={cat} onClick={() => setSignalCategoryFilter(cat)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${signalCategoryFilter === cat ? "bg-white/10 text-white border-white/20" : "border-white/5 text-gray-500 hover:text-gray-300"}`}
                        >{cat.charAt(0).toUpperCase() + cat.slice(1)}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {signalsData.signals
                      .filter(s => signalCategoryFilter === "all" || s.category === signalCategoryFilter)
                      .map((s, i) => (
                      <div key={i} className={`bg-white/[0.02] border rounded-xl p-4 transition-all ${s.signal === "BULLISH" ? "border-emerald-500/20 hover:border-emerald-500/40" : s.signal === "BEARISH" ? "border-red-500/20 hover:border-red-500/40" : "border-white/5 hover:border-white/10"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold">{s.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.signal === "BULLISH" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : s.signal === "BEARISH" ? "bg-red-500/15 text-red-400 border-red-500/30" : "bg-gray-500/15 text-gray-400 border-gray-500/30"}`}>
                            {s.signal === "BULLISH" ? "▲ BUY" : s.signal === "BEARISH" ? "▼ SELL" : "● HOLD"}
                          </span>
                        </div>
                        {/* Signal strength bar */}
                        <div className="relative h-2 bg-white/5 rounded-full overflow-hidden mb-2">
                          <div className="absolute inset-0 flex">
                            <div className="w-1/3 border-r border-white/10" />
                            <div className="w-1/3 border-r border-white/10" />
                          </div>
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${s.value > 60 ? "bg-emerald-500" : s.value > 40 ? "bg-yellow-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(100, Math.max(2, s.value))}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-medium uppercase tracking-wider ${
                            s.category === "trend" ? "text-indigo-400" : s.category === "momentum" ? "text-pink-400" : s.category === "volume" ? "text-cyan-400" : s.category === "volatility" ? "text-orange-400" : "text-teal-400"
                          }`}>{s.category}</span>
                          <span className="text-xs font-mono text-gray-400">{s.value.toFixed(0)}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 leading-relaxed">{s.details}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Market Events & Happenings ── */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Market Events & Happenings</h3>
                  {signalsData.events.length === 0 ? (
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-8 text-center text-gray-500 text-sm">
                      No significant market events detected today. Markets are calm.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {signalsData.events.map((e, i) => (
                        <div key={i} className={`bg-white/[0.02] border rounded-xl p-4 transition-all hover:bg-white/[0.03] ${
                          e.impact === "HIGH" ? "border-l-2 border-l-amber-500 border-r border-t border-b border-white/5" :
                          "border-white/5"
                        }`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  e.signal === "BULLISH" ? "bg-emerald-400" : e.signal === "BEARISH" ? "bg-red-400" : e.signal === "WATCH" ? "bg-amber-400" : "bg-gray-400"
                                }`} />
                                <span className="text-sm font-semibold">{e.title}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  e.impact === "HIGH" ? "bg-red-500/15 text-red-400" : e.impact === "MEDIUM" ? "bg-amber-500/15 text-amber-400" : "bg-gray-500/15 text-gray-400"
                                }`}>{e.impact}</span>
                              </div>
                              <p className="text-xs text-gray-400 leading-relaxed">{e.description}</p>
                            </div>
                            <div className="flex flex-col items-end flex-shrink-0">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                e.signal === "BULLISH" ? "bg-emerald-500/15 text-emerald-400" : e.signal === "BEARISH" ? "bg-red-500/15 text-red-400" : e.signal === "WATCH" ? "bg-amber-500/15 text-amber-400" : "bg-gray-500/15 text-gray-400"
                              }`}>
                                {e.signal === "BULLISH" ? "▲ Bullish" : e.signal === "BEARISH" ? "▼ Bearish" : e.signal === "WATCH" ? "◆ Watch" : "● Neutral"}
                              </span>
                              <span className={`mt-1 px-1.5 py-0.5 rounded text-[9px] ${
                                e.type === "technical" ? "bg-indigo-500/10 text-indigo-400" : e.type === "sentiment" ? "bg-pink-500/10 text-pink-400" : e.type === "economic" ? "bg-teal-500/10 text-teal-400" : e.type === "sector" ? "bg-cyan-500/10 text-cyan-400" : "bg-amber-500/10 text-amber-400"
                              }`}>{e.type}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Signal Legend ── */}
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">Signal Categories</div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-[11px]">
                    <div><span className="text-indigo-400 font-semibold">Trend:</span> <span className="text-gray-500">SMA alignment, ADX, Golden/Death Cross</span></div>
                    <div><span className="text-pink-400 font-semibold">Momentum:</span> <span className="text-gray-500">RSI, MACD, Stochastic, CCI, ROC</span></div>
                    <div><span className="text-cyan-400 font-semibold">Volume:</span> <span className="text-gray-500">OBV, MFI, Volume activity</span></div>
                    <div><span className="text-orange-400 font-semibold">Volatility:</span> <span className="text-gray-500">BB width, ATR, BB position</span></div>
                    <div><span className="text-teal-400 font-semibold">Breadth:</span> <span className="text-gray-500">52-week position, momentum</span></div>
                  </div>
                </div>
              </div>
            )}

            {!signalsLoading && !signalsData && (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </div>
                <h3 className="text-lg font-semibold mb-1">Market Signals Dashboard</h3>
                <p className="text-sm text-gray-500 max-w-md">Click &quot;Refresh Signals&quot; to load 15+ buy/sell indicators with market events and sentiment analysis for {market === "US" ? "the S&P 500" : "Nifty 50"}.</p>
              </div>
            )}
          </div>
        )}

        {/* ─── PORTFOLIO TAB ─── */}
        {activeTab === "portfolio" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">My Portfolio</h2>
                <p className="text-sm text-gray-500 mt-1">Track your holdings with signals, targets, and support/resistance levels</p>
              </div>
              {portfolio.length > 0 && (
                <button
                  onClick={refreshPortfolio}
                  disabled={portfolioLoading}
                  className="px-5 py-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-violet-500/20"
                >
                  {portfolioLoading ? <><Spinner /> Analyzing...</> : "Refresh Analysis"}
                </button>
              )}
            </div>

            {/* Add Stock Form */}
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 mb-6">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Add Stock to Portfolio</div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Symbol</label>
                  <input
                    type="text"
                    value={addSymbol}
                    onChange={(e) => setAddSymbol(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && addToPortfolio()}
                    placeholder="e.g. RELIANCE"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-gray-600"
                  />
                </div>
                <div className="w-36">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Buy Price</label>
                  <input
                    type="number"
                    value={addBuyPrice}
                    onChange={(e) => setAddBuyPrice(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addToPortfolio()}
                    placeholder={`${currencySymbol}0.00`}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-gray-600 font-mono"
                  />
                </div>
                <div className="w-24">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Qty</label>
                  <input
                    type="number"
                    value={addQuantity}
                    onChange={(e) => setAddQuantity(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addToPortfolio()}
                    placeholder="1"
                    min="1"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-gray-600 font-mono"
                  />
                </div>
                <button
                  onClick={addToPortfolio}
                  disabled={!addSymbol.trim() || !addBuyPrice || parseFloat(addBuyPrice) <= 0}
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
              {portfolio.some(p => p.symbol === addSymbol.trim().toUpperCase()) && addSymbol.trim() && (
                <div className="text-xs text-amber-400 mt-2">{addSymbol.trim().toUpperCase()} is already in your portfolio</div>
              )}
            </div>

            {portfolio.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <h3 className="text-lg font-semibold mb-1">Add Your Holdings</h3>
                <p className="text-sm text-gray-500 max-w-md">Enter your stock symbol, buying price, and quantity above. Your portfolio is saved locally in your browser.</p>
              </div>
            )}

            {portfolioLoading && portfolioData.length === 0 && portfolio.length > 0 && (
              <div className="space-y-3">
                {portfolio.map((_, i) => <div key={i} className="skeleton h-32 w-full rounded-xl" />)}
              </div>
            )}

            {/* Portfolio Summary */}
            {portfolioData.length > 0 && (() => {
              const totalInvested = portfolio.reduce((sum, h) => {
                return sum + h.buyPrice * h.quantity;
              }, 0);
              const totalCurrent = portfolio.reduce((sum, h) => {
                const data = portfolioData.find(d => d.symbol === h.symbol);
                return sum + (data ? data.quote.price * h.quantity : h.buyPrice * h.quantity);
              }, 0);
              const totalPnl = totalCurrent - totalInvested;
              const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
              const winners = portfolio.filter(h => {
                const data = portfolioData.find(d => d.symbol === h.symbol);
                return data && data.quote.price > h.buyPrice;
              }).length;
              const losers = portfolio.length - winners;

              return (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold font-mono text-white">{currencySymbol}{formatNumber(totalInvested, market)}</div>
                    <div className="text-[10px] text-gray-500 uppercase mt-1">Invested</div>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold font-mono text-white">{currencySymbol}{formatNumber(totalCurrent, market)}</div>
                    <div className="text-[10px] text-gray-500 uppercase mt-1">Current Value</div>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center">
                    <div className={`text-2xl font-bold font-mono ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {totalPnl >= 0 ? "+" : ""}{currencySymbol}{formatNumber(Math.abs(totalPnl), market)}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase mt-1">P&L</div>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center">
                    <div className={`text-2xl font-bold font-mono ${totalPnlPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {totalPnlPercent >= 0 ? "+" : ""}{totalPnlPercent.toFixed(2)}%
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase mt-1">Return</div>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-emerald-400 font-bold text-xl">{winners}</span>
                      <span className="text-gray-500">/</span>
                      <span className="text-red-400 font-bold text-xl">{losers}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase mt-1">Win / Loss</div>
                  </div>
                </div>
              );
            })()}

            {/* Stock Cards */}
            {portfolio.length > 0 && (
              <div className="space-y-3">
                {portfolio.map((holding) => {
                  const data = portfolioData.find(d => d.symbol === holding.symbol);
                  const pnl = data ? (data.quote.price - holding.buyPrice) * holding.quantity : 0;
                  const pnlPercent = data ? ((data.quote.price - holding.buyPrice) / holding.buyPrice) * 100 : 0;
                  const isExpanded = expandedPortfolio === holding.symbol;

                  return (
                    <div key={holding.symbol} className={`bg-white/[0.02] border rounded-xl overflow-hidden transition-all ${
                      data ? (pnlPercent > 0 ? "border-emerald-500/15" : pnlPercent < 0 ? "border-red-500/15" : "border-white/5") : "border-white/5"
                    }`}>
                      {/* Header */}
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.01] transition-colors"
                        onClick={() => setExpandedPortfolio(isExpanded ? null : holding.symbol)}
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="text-base font-bold">{holding.symbol}</div>
                            <div className="text-xs text-gray-500">{data?.quote.name || "Loading..."}</div>
                          </div>
                          {data && (
                            <div className="text-right">
                              <div className="text-sm font-mono font-semibold">{currencySymbol}{data.quote.price.toFixed(2)}</div>
                              <div className={`text-xs font-mono ${data.quote.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                Today: {data.quote.changePercent >= 0 ? "+" : ""}{data.quote.changePercent.toFixed(2)}%
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-5">
                          {/* Buy Price & P&L */}
                          <div className="text-right">
                            <div className="text-xs text-gray-500">Buy: <span className="font-mono text-gray-300">{currencySymbol}{holding.buyPrice.toFixed(2)}</span> x {holding.quantity}</div>
                            {data && (
                              <div className={`text-sm font-mono font-bold ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {pnl >= 0 ? "+" : ""}{currencySymbol}{Math.abs(pnl).toFixed(2)} ({pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%)
                              </div>
                            )}
                          </div>

                          {/* Recommendation Badge */}
                          {data && (
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                              data.signals.recSignal === "STRONG_BUY" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                              data.signals.recSignal === "BUY" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                              data.signals.recSignal === "STRONG_SELL" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                              data.signals.recSignal === "SELL" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                              "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                            }`}>
                              {data.signals.recSignal.replace("_", " ")}
                            </span>
                          )}

                          {/* Signal summary mini */}
                          {data && (
                            <div className="flex items-center gap-1">
                              <span className="text-emerald-400 text-xs font-bold">{data.signals.buyCount}B</span>
                              <div className="w-16 h-2 bg-white/5 rounded-full overflow-hidden flex">
                                <div className="bg-emerald-500 h-full" style={{ width: `${(data.signals.buyCount / data.signals.total) * 100}%` }} />
                                <div className="bg-red-500 h-full" style={{ width: `${(data.signals.sellCount / data.signals.total) * 100}%` }} />
                              </div>
                              <span className="text-red-400 text-xs font-bold">{data.signals.sellCount}S</span>
                            </div>
                          )}

                          <button
                            onClick={(e) => { e.stopPropagation(); removeFromPortfolio(holding.symbol); }}
                            className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded"
                            title="Remove"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>

                          <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {/* Expanded Detail */}
                      {isExpanded && data && (
                        <div className="border-t border-white/5">
                          {/* Targets & Levels Grid */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                            {/* Left: Targets & Support/Resistance */}
                            <div className="space-y-4">
                              {/* ATR Targets */}
                              <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">Targets & Stop Loss (ATR-based)</div>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-emerald-400">Target 3 (Extended)</span>
                                    <span className="text-sm font-mono font-semibold text-emerald-400">{currencySymbol}{data.levels.targets.target3.toFixed(2)}</span>
                                    <span className="text-[10px] text-gray-500">+{((data.levels.targets.target3 - data.quote.price) / data.quote.price * 100).toFixed(1)}%</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-emerald-400">Target 2 (Medium)</span>
                                    <span className="text-sm font-mono font-semibold text-emerald-400">{currencySymbol}{data.levels.targets.target2.toFixed(2)}</span>
                                    <span className="text-[10px] text-gray-500">+{((data.levels.targets.target2 - data.quote.price) / data.quote.price * 100).toFixed(1)}%</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-emerald-300">Target 1 (Near)</span>
                                    <span className="text-sm font-mono font-semibold text-emerald-300">{currencySymbol}{data.levels.targets.target1.toFixed(2)}</span>
                                    <span className="text-[10px] text-gray-500">+{((data.levels.targets.target1 - data.quote.price) / data.quote.price * 100).toFixed(1)}%</span>
                                  </div>
                                  <div className="flex items-center justify-between py-1.5 border-y border-white/10">
                                    <span className="text-xs text-white font-semibold">Current Price</span>
                                    <span className="text-sm font-mono font-bold text-white">{currencySymbol}{data.quote.price.toFixed(2)}</span>
                                    <span className="text-[10px] text-gray-500">—</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-amber-400">Buy Price</span>
                                    <span className="text-sm font-mono font-semibold text-amber-400">{currencySymbol}{holding.buyPrice.toFixed(2)}</span>
                                    <span className={`text-[10px] ${pnlPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>{pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-red-400 font-semibold">Stop Loss</span>
                                    <span className="text-sm font-mono font-bold text-red-400">{currencySymbol}{data.levels.targets.stopLoss.toFixed(2)}</span>
                                    <span className="text-[10px] text-red-400">{((data.levels.targets.stopLoss - data.quote.price) / data.quote.price * 100).toFixed(1)}%</span>
                                  </div>
                                </div>
                              </div>

                              {/* Support & Resistance */}
                              <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">Dynamic Support & Resistance</div>
                                <div className="space-y-1.5">
                                  {data.levels.resistance.slice().reverse().map((r, i) => (
                                    <div key={`r-${i}`} className="flex items-center justify-between">
                                      <span className="text-xs text-red-400/70">R{data.levels.resistance.length - i}</span>
                                      <div className="flex-1 mx-3 h-px bg-red-500/20" />
                                      <span className="text-xs font-mono text-red-400">{currencySymbol}{r.toFixed(2)}</span>
                                      <span className="text-[10px] text-gray-500 w-14 text-right">+{((r - data.quote.price) / data.quote.price * 100).toFixed(1)}%</span>
                                    </div>
                                  ))}
                                  <div className="flex items-center justify-between py-1 bg-white/5 rounded px-2 -mx-1">
                                    <span className="text-xs text-white font-bold">CMP</span>
                                    <span className="text-xs font-mono font-bold text-white">{currencySymbol}{data.quote.price.toFixed(2)}</span>
                                    <span className="text-[10px] text-gray-500 w-14 text-right">—</span>
                                  </div>
                                  {data.levels.support.map((s, i) => (
                                    <div key={`s-${i}`} className="flex items-center justify-between">
                                      <span className="text-xs text-emerald-400/70">S{i + 1}</span>
                                      <div className="flex-1 mx-3 h-px bg-emerald-500/20" />
                                      <span className="text-xs font-mono text-emerald-400">{currencySymbol}{s.toFixed(2)}</span>
                                      <span className="text-[10px] text-gray-500 w-14 text-right">{((s - data.quote.price) / data.quote.price * 100).toFixed(1)}%</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Pivot Points */}
                              <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">Pivot Points</div>
                                <div className="grid grid-cols-7 gap-1.5 text-center">
                                  {[
                                    { label: "S3", value: data.levels.pivots.s3, color: "text-emerald-400" },
                                    { label: "S2", value: data.levels.pivots.s2, color: "text-emerald-400" },
                                    { label: "S1", value: data.levels.pivots.s1, color: "text-emerald-300" },
                                    { label: "PP", value: data.levels.pivots.pivot, color: "text-yellow-400" },
                                    { label: "R1", value: data.levels.pivots.r1, color: "text-red-300" },
                                    { label: "R2", value: data.levels.pivots.r2, color: "text-red-400" },
                                    { label: "R3", value: data.levels.pivots.r3, color: "text-red-400" },
                                  ].map((p) => (
                                    <div key={p.label} className="bg-white/[0.03] rounded p-1.5">
                                      <div className="text-[9px] text-gray-500">{p.label}</div>
                                      <div className={`text-[11px] font-mono font-semibold ${p.color}`}>{p.value.toFixed(0)}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Right: Fibonacci, MAs, Signals */}
                            <div className="space-y-4">
                              {/* Fibonacci Levels */}
                              <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">Fibonacci Retracement</div>
                                <div className="space-y-1.5">
                                  {[
                                    { label: "23.6%", value: data.levels.fibonacci.level236 },
                                    { label: "38.2%", value: data.levels.fibonacci.level382 },
                                    { label: "50.0%", value: data.levels.fibonacci.level500 },
                                    { label: "61.8%", value: data.levels.fibonacci.level618 },
                                    { label: "78.6%", value: data.levels.fibonacci.level786 },
                                  ].map((f) => {
                                    const isNear = Math.abs(data.quote.price - f.value) / data.quote.price < 0.02;
                                    return (
                                      <div key={f.label} className={`flex items-center justify-between px-2 py-1 rounded ${isNear ? "bg-yellow-500/10 border border-yellow-500/20" : ""}`}>
                                        <span className={`text-xs ${isNear ? "text-yellow-400 font-semibold" : "text-gray-400"}`}>Fib {f.label}</span>
                                        <span className={`text-xs font-mono ${isNear ? "text-yellow-400 font-bold" : "text-gray-300"}`}>{currencySymbol}{f.value.toFixed(2)}</span>
                                        <span className="text-[10px] text-gray-500">{f.value > data.quote.price ? "+" : ""}{((f.value - data.quote.price) / data.quote.price * 100).toFixed(1)}%</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Moving Averages */}
                              <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">Moving Averages</div>
                                <div className="space-y-1.5">
                                  {[
                                    { label: "EMA 9", value: data.levels.movingAverages.ema9 },
                                    { label: "EMA 21", value: data.levels.movingAverages.ema21 },
                                    { label: "SMA 20", value: data.levels.movingAverages.sma20 },
                                    { label: "SMA 50", value: data.levels.movingAverages.sma50 },
                                    { label: "SMA 100", value: data.levels.movingAverages.sma100 },
                                    { label: "SMA 200", value: data.levels.movingAverages.sma200 },
                                  ].filter(m => m.value !== null).map((m) => {
                                    const above = data.quote.price > m.value!;
                                    return (
                                      <div key={m.label} className="flex items-center justify-between">
                                        <span className="text-xs text-gray-400 w-16">{m.label}</span>
                                        <span className="text-xs font-mono text-gray-300">{currencySymbol}{m.value!.toFixed(2)}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${above ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                                          {above ? "Above" : "Below"}
                                        </span>
                                      </div>
                                    );
                                  })}
                                  {data.levels.supertrendLevel !== null && (
                                    <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                                      <span className="text-xs text-gray-400 w-16">Supertrend</span>
                                      <span className="text-xs font-mono text-gray-300">{currencySymbol}{data.levels.supertrendLevel.toFixed(2)}</span>
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${data.levels.supertrendDirection === 1 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                                        {data.levels.supertrendDirection === 1 ? "BULLISH" : "BEARISH"}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Signal Breakdown */}
                              <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">
                                  Signal Summary ({data.signals.buyCount}B / {data.signals.sellCount}S / {data.signals.neutralCount}N)
                                </div>
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden flex">
                                    <div className="bg-emerald-500 h-full" style={{ width: `${(data.signals.buyCount / data.signals.total) * 100}%` }} />
                                    <div className="bg-red-500 h-full" style={{ width: `${(data.signals.sellCount / data.signals.total) * 100}%` }} />
                                  </div>
                                  <span className={`text-xs font-bold ${
                                    data.signals.recSignal.includes("BUY") ? "text-emerald-400" :
                                    data.signals.recSignal.includes("SELL") ? "text-red-400" : "text-gray-400"
                                  }`}>{data.signals.recSignal.replace("_", " ")}</span>
                                </div>
                                <div className="text-xs text-gray-400 mb-2">{data.signals.recommendation}</div>

                                {/* Top Buy Signals */}
                                {data.signals.topBuy.length > 0 && (
                                  <div className="mb-2">
                                    <div className="text-[10px] text-emerald-400 font-semibold mb-1">Top Buy Signals:</div>
                                    <div className="space-y-1">
                                      {data.signals.topBuy.map((s) => (
                                        <div key={s.id} className="flex items-center justify-between bg-emerald-500/5 rounded px-2 py-1">
                                          <span className="text-[11px] text-gray-300 truncate flex-1">{s.name}</span>
                                          <span className="text-[10px] text-emerald-400 font-mono ml-2">BUY ({s.strength})</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Top Sell Signals */}
                                {data.signals.topSell.length > 0 && (
                                  <div>
                                    <div className="text-[10px] text-red-400 font-semibold mb-1">Top Sell Signals:</div>
                                    <div className="space-y-1">
                                      {data.signals.topSell.map((s) => (
                                        <div key={s.id} className="flex items-center justify-between bg-red-500/5 rounded px-2 py-1">
                                          <span className="text-[11px] text-gray-300 truncate flex-1">{s.name}</span>
                                          <span className="text-[10px] text-red-400 font-mono ml-2">SELL ({s.strength})</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Chart */}
                          <div className="px-4 pb-4">
                            <button
                              onClick={() => setPortfolioChartStock(portfolioChartStock === holding.symbol ? null : holding.symbol)}
                              className="text-xs text-blue-400 hover:text-blue-300 transition-colors mb-2"
                            >
                              {portfolioChartStock === holding.symbol ? "Hide Chart" : "Show Chart"}
                            </button>
                            {portfolioChartStock === holding.symbol && (
                              <div className="rounded-lg overflow-hidden border border-white/5">
                                <CandlestickChart symbol={holding.symbol} market={market} />
                              </div>
                            )}
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-2 px-4 pb-3">
                            <button
                              onClick={() => { setActiveTab("search"); setSearchQuery(holding.symbol); searchStock(holding.symbol); }}
                              className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
                            >
                              Full {STRATEGIES.length}-Strategy Analysis
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Loading state for individual stock */}
                      {isExpanded && !data && portfolioLoading && (
                        <div className="border-t border-white/5 p-8 flex items-center justify-center">
                          <Spinner /> <span className="ml-2 text-sm text-gray-500">Analyzing {holding.symbol}...</span>
                        </div>
                      )}
                      {isExpanded && !data && !portfolioLoading && (
                        <div className="border-t border-white/5 p-4 text-center text-sm text-gray-500">
                          Click &quot;Refresh Analysis&quot; to load signals and levels for this stock.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── BOT PERFORMANCE TAB ─── */}
        {activeTab === "bot" && (
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span>🤖</span> Bot Performance
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Autonomous trader. Buys top BUY-signal stocks, sells when strategies turn bearish. Max 5 concurrent positions. Starting capital: {market === "US" ? "$5,000" : "₹10,00,000"}. Cash-only delivery, no intraday.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={runBotNow}
                  disabled={botRunning || botLoading}
                  className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-xs font-semibold text-emerald-400 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {botRunning ? <><Spinner /> Trading...</> : "Run today's trade"}
                </button>
                <button
                  onClick={loadBot}
                  disabled={botLoading || botRunning}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-xs font-semibold text-gray-300 transition-all disabled:opacity-50"
                  title="Refresh state with live prices"
                >
                  Refresh
                </button>
                <button
                  onClick={resetBot}
                  disabled={botResetting || botRunning}
                  className="px-3 py-2 bg-red-500/5 hover:bg-red-500/15 border border-red-500/15 rounded-lg text-xs font-semibold text-red-400 transition-all disabled:opacity-50"
                  title="Wipe state and start fresh"
                >
                  {botResetting ? <Spinner /> : "Reset"}
                </button>
              </div>
            </div>

            {botLoading && !botState && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
                </div>
                <div className="skeleton h-[400px] w-full rounded-xl" />
              </div>
            )}

            {botState && (() => {
              const fmt = (n: number) => `${currencySymbol}${formatNumber(n, market)}`;
              const fmtFull = (n: number) => fmtPrice(n);
              const cards = [
                { label: "Cash", value: fmt(botState.cash), sub: `${((botState.cash / botState.startingCapital) * 100).toFixed(1)}% of capital`, tone: "neutral" as const },
                { label: "Holdings Value", value: fmt(botState.holdingsValue), sub: `${botState.positionsOpen}/${botState.maxPositions} positions`, tone: "neutral" as const },
                { label: "Equity (Total)", value: fmt(botState.equity), sub: `vs. ${fmt(botState.startingCapital)} start`, tone: "neutral" as const },
                { label: "Total P&L", value: `${botState.totalPnL >= 0 ? "+" : "-"}${fmt(Math.abs(botState.totalPnL))}`, sub: `${botState.totalPnLPercent >= 0 ? "+" : ""}${botState.totalPnLPercent.toFixed(2)}%`, tone: (botState.totalPnL >= 0 ? "good" : "bad") as "good" | "bad" },
                { label: "Realized P&L", value: `${botState.realizedPnL >= 0 ? "+" : "-"}${fmt(Math.abs(botState.realizedPnL))}`, sub: `${botState.trades.filter(t => t.action === "SELL").length} sells executed`, tone: (botState.realizedPnL >= 0 ? "good" : "bad") as "good" | "bad" },
              ];

              const equityData = botState.snapshots.map((s) => ({ date: s.date, equity: s.equity }));

              return (
                <div className="space-y-6">
                  {/* Status banner */}
                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <span className={`inline-block w-2 h-2 rounded-full ${botState.lastRunDate ? "bg-emerald-500" : "bg-gray-500"}`}></span>
                    {botState.lastRunDate
                      ? <>Last trade run: <span className="text-gray-300 font-mono">{botState.lastRunDate}</span></>
                      : <>Bot hasn&apos;t traded yet. Click &quot;Run today&apos;s trade&quot; to start.</>
                    }
                  </div>

                  {/* P&L Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {cards.map((c) => (
                      <div key={c.label} className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">{c.label}</div>
                        <div className={`text-xl font-bold font-mono mt-1 ${c.tone === "good" ? "text-emerald-400" : c.tone === "bad" ? "text-red-400" : "text-white"}`}>
                          {c.value}
                        </div>
                        <div className="text-[10px] text-gray-600 mt-1">{c.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Equity Curve + Trade Markers */}
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Equity Curve · Buy/Sell Markers
                      </h3>
                      <div className="flex items-center gap-3 text-[10px] text-gray-500">
                        <span className="flex items-center gap-1"><span className="text-emerald-400">▲</span> Buy</span>
                        <span className="flex items-center gap-1"><span className="text-red-400">▼</span> Sell</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-px bg-white/30"></span> Starting capital</span>
                      </div>
                    </div>
                    {equityData.length > 0 ? (
                      <BotEquityChart
                        startingCapital={botState.startingCapital}
                        currencySymbol={currencySymbol}
                        data={equityData}
                        trades={botState.trades.map((t) => ({ date: t.date, action: t.action, symbol: t.symbol, quantity: t.quantity, price: t.price }))}
                      />
                    ) : (
                      <div className="h-40 flex items-center justify-center text-sm text-gray-500">
                        No history yet — run a trade to populate the chart.
                      </div>
                    )}
                  </div>

                  {/* Current Holdings */}
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/5">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Holdings ({botState.holdings.length}/{botState.maxPositions})
                      </h3>
                    </div>
                    {botState.holdings.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">No open positions.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-[10px] text-gray-500 uppercase tracking-wider bg-white/[0.02]">
                            <tr>
                              <th className="text-left px-4 py-2">Symbol</th>
                              <th className="text-right px-4 py-2">Qty</th>
                              <th className="text-right px-4 py-2">Avg Buy</th>
                              <th className="text-right px-4 py-2">Current</th>
                              <th className="text-right px-4 py-2">Cost</th>
                              <th className="text-right px-4 py-2">Value</th>
                              <th className="text-right px-4 py-2">Unrealized P&L</th>
                              <th className="text-right px-4 py-2">Bought</th>
                            </tr>
                          </thead>
                          <tbody className="font-mono">
                            {botState.holdings.map((h) => (
                              <tr key={h.symbol} className="border-t border-white/5">
                                <td className="px-4 py-2 font-semibold text-blue-400">{h.symbol}</td>
                                <td className="text-right px-4 py-2">{h.quantity}</td>
                                <td className="text-right px-4 py-2 text-gray-400">{fmtFull(h.avgBuyPrice)}</td>
                                <td className="text-right px-4 py-2 text-white">{fmtFull(h.currentPrice)}</td>
                                <td className="text-right px-4 py-2 text-gray-400">{fmt(h.cost)}</td>
                                <td className="text-right px-4 py-2 text-white">{fmt(h.currentValue)}</td>
                                <td className={`text-right px-4 py-2 font-semibold ${h.unrealizedPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {h.unrealizedPnL >= 0 ? "+" : "-"}{fmt(Math.abs(h.unrealizedPnL))} ({h.unrealizedPnLPercent >= 0 ? "+" : ""}{h.unrealizedPnLPercent.toFixed(2)}%)
                                </td>
                                <td className="text-right px-4 py-2 text-[10px] text-gray-500">{h.buyDate}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Trade History */}
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Trade History ({botState.trades.length})
                      </h3>
                      <span className="text-[10px] text-gray-500">
                        {botState.trades.filter(t => t.action === "BUY").length} buys · {botState.trades.filter(t => t.action === "SELL").length} sells
                      </span>
                    </div>
                    {botState.trades.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">No trades yet.</div>
                    ) : (
                      <div className="max-h-[500px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="text-[10px] text-gray-500 uppercase tracking-wider bg-white/[0.02] sticky top-0">
                            <tr>
                              <th className="text-left px-4 py-2">Date</th>
                              <th className="text-left px-4 py-2">Action</th>
                              <th className="text-left px-4 py-2">Symbol</th>
                              <th className="text-right px-4 py-2">Qty</th>
                              <th className="text-right px-4 py-2">Price</th>
                              <th className="text-right px-4 py-2">Total</th>
                              <th className="text-right px-4 py-2">Realized</th>
                              <th className="text-left px-4 py-2">Reason</th>
                            </tr>
                          </thead>
                          <tbody className="font-mono">
                            {[...botState.trades].reverse().map((t, i) => (
                              <tr key={`${t.timestamp}-${i}`} className="border-t border-white/5">
                                <td className="px-4 py-2 text-[11px] text-gray-400">{t.date}</td>
                                <td className="px-4 py-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.action === "BUY" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                                    {t.action}
                                  </span>
                                </td>
                                <td className="px-4 py-2 font-semibold text-blue-400">{t.symbol}</td>
                                <td className="text-right px-4 py-2">{t.quantity}</td>
                                <td className="text-right px-4 py-2 text-gray-300">{fmtFull(t.price)}</td>
                                <td className="text-right px-4 py-2 text-white">{fmt(t.total)}</td>
                                <td className={`text-right px-4 py-2 text-[11px] ${t.realizedPnL == null ? "text-gray-600" : t.realizedPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {t.realizedPnL == null ? "—" : `${t.realizedPnL >= 0 ? "+" : "-"}${fmt(Math.abs(t.realizedPnL))}`}
                                </td>
                                <td className="px-4 py-2 text-[11px] text-gray-500 max-w-md truncate">{t.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Deploy note */}
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-[11px] text-gray-500 space-y-1">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1">Auto-trading on deploy</div>
                    <div>The bot trades only once per day — runs are idempotent. On Vercel, the cron in <code className="font-mono text-gray-300">vercel.json</code> hits <code className="font-mono text-gray-300">/api/bot/run?both=1</code> daily after market close.</div>
                    <div>State persists to <code className="font-mono text-gray-300">data/bot-state-{market.toLowerCase()}.json</code>. On serverless deploys without disk persistence, swap the storage layer in <code className="font-mono text-gray-300">src/lib/botStorage.ts</code> for Vercel KV or Upstash (one-file change).</div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ─── INSIDER (sub-tab under Strategies) ─── */}
        {activeTab === "strategies" && strategiesSubTab === "insider" && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold">Insider Information</h2>
              <p className="text-sm text-gray-500 mt-1">Track who owns what — {market === "US" ? "founders, CEOs, super-investors, mega institutions, and SEC insider filings" : "promoters, HNIs, celebrities, FIIs, and institutional deals"}</p>
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5 mb-6 w-fit">
              {([
                { key: "holders" as const, label: "Notable Holders", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
                { key: "deals" as const, label: "Recent Deals", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
                { key: "bulk" as const, label: "Bulk/Block Deals", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
              ]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => loadInsiderTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${insiderTab === t.key ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={t.icon} /></svg>
                  {t.label}
                </button>
              ))}
            </div>

            {insiderLoading && (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-24 w-full rounded-xl" />)}
              </div>
            )}

            {/* ── HOLDERS SUB-TAB ── */}
            {insiderTab === "holders" && !insiderLoading && (
              <div>
                {/* Search & Filter */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex-1 max-w-sm">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input
                      type="text"
                      value={insiderSearch}
                      onChange={(e) => setInsiderSearch(e.target.value)}
                      placeholder="Search by name or stock..."
                      className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-gray-600"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {["All", ...(insiderData.types || [])].map((t) => (
                      <button key={t} onClick={() => setInsiderTypeFilter(t)}
                        className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all border ${insiderTypeFilter === t ? "bg-white/10 text-white border-white/20" : "border-white/5 text-gray-500 hover:text-gray-300"}`}
                      >{t}</button>
                    ))}
                  </div>
                </div>

                {/* Holders List */}
                <div className="space-y-3">
                  {insiderData.holders
                    .filter(h => insiderTypeFilter === "All" || h.type === insiderTypeFilter)
                    .filter(h => {
                      if (!insiderSearch) return true;
                      const q = insiderSearch.toLowerCase();
                      return h.name.toLowerCase().includes(q) || h.holdings.some(s => s.symbol.toLowerCase().includes(q));
                    })
                    .map((holder) => {
                      const isExpanded = expandedHolder === holder.name;
                      const typeColors: Record<string, string> = {
                        Promoter: "bg-blue-500/15 text-blue-400 border-blue-500/25",
                        Founder: "bg-blue-500/15 text-blue-400 border-blue-500/25",
                        CEO: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
                        Insider: "bg-violet-500/15 text-violet-400 border-violet-500/25",
                        HNI: "bg-amber-500/15 text-amber-400 border-amber-500/25",
                        Institutional: "bg-teal-500/15 text-teal-400 border-teal-500/25",
                        Government: "bg-red-500/15 text-red-400 border-red-500/25",
                        FII: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
                        Celebrity: "bg-pink-500/15 text-pink-400 border-pink-500/25",
                        Politician: "bg-purple-500/15 text-purple-400 border-purple-500/25",
                      };
                      return (
                        <div key={holder.name} className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-all">
                          <button
                            onClick={() => setExpandedHolder(isExpanded ? null : holder.name)}
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.01] transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                                holder.type === "Celebrity" ? "bg-pink-500/20 text-pink-400" :
                                holder.type === "HNI" ? "bg-amber-500/20 text-amber-400" :
                                holder.type === "Government" ? "bg-red-500/20 text-red-400" :
                                holder.type === "FII" ? "bg-cyan-500/20 text-cyan-400" :
                                holder.type === "Promoter" || holder.type === "Founder" ? "bg-blue-500/20 text-blue-400" :
                                holder.type === "CEO" ? "bg-indigo-500/20 text-indigo-400" :
                                holder.type === "Insider" ? "bg-violet-500/20 text-violet-400" :
                                holder.type === "Politician" ? "bg-purple-500/20 text-purple-400" :
                                "bg-teal-500/20 text-teal-400"
                              }`}>
                                {holder.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold">{holder.name}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${typeColors[holder.type] || "bg-gray-500/15 text-gray-400"}`}>{holder.type}</span>
                                </div>
                                <p className="text-xs text-gray-500 truncate mt-0.5">{holder.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                              <div className="flex items-center gap-1.5">
                                {holder.holdings.slice(0, 4).map((h) => (
                                  <span key={h.symbol} className="px-2 py-0.5 bg-white/5 rounded text-[11px] font-mono text-gray-300">{h.symbol}</span>
                                ))}
                                {holder.holdings.length > 4 && <span className="text-[10px] text-gray-500">+{holder.holdings.length - 4}</span>}
                              </div>
                              <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-white/5 px-4 py-3">
                              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">Holdings ({holder.holdings.length} stocks)</div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {holder.holdings.map((h) => (
                                  <div key={h.symbol}
                                    className="flex items-center justify-between bg-white/[0.03] rounded-lg p-3 hover:bg-white/[0.05] transition-colors cursor-pointer"
                                    onClick={() => { setActiveTab("search"); setSearchQuery(h.symbol); searchStock(h.symbol); }}
                                  >
                                    <div>
                                      <div className="text-sm font-bold text-blue-400">{h.symbol}</div>
                                      {h.note && <div className="text-[10px] text-gray-500 mt-0.5">{h.note}</div>}
                                    </div>
                                    <div className="text-right">
                                      {h.percentHeld && <div className="text-sm font-mono font-semibold text-white">{h.percentHeld}%</div>}
                                      {h.approxValue && <div className="text-[10px] text-gray-400">{h.approxValue}</div>}
                                      {!h.percentHeld && !h.approxValue && <div className="text-[10px] text-gray-500">Holder</div>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-3 text-[10px] text-gray-600">Data sourced from SEBI filings, annual reports, and public disclosures. Holdings may have changed since last filing.</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
                {insiderData.holders.length === 0 && !insiderLoading && (
                  <div className="text-center py-8 text-gray-500 text-sm">Loading notable holders data...</div>
                )}
              </div>
            )}

            {/* ── DEALS SUB-TAB ── */}
            {insiderTab === "deals" && !insiderLoading && (
              <div>
                <div className="text-xs text-gray-500 mb-4">Recent insider transactions from top {market === "US" ? "S&P 500" : "Nifty"} stocks. Acquisitions may signal bullish outlook, sales may be routine or cautionary.</div>
                {insiderData.deals.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 text-sm">No recent deals found. Click the tab to load data.</div>
                ) : (
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[80px_1fr_100px_100px_100px_90px] gap-2 px-4 py-2.5 border-b border-white/5 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      <div>Date</div><div>Name</div><div>Stock</div><div className="text-right">Shares</div><div className="text-right">Value</div><div className="text-center">Type</div>
                    </div>
                    {insiderData.deals.map((d, i) => {
                      const isBuy = d.transactionText.toLowerCase().includes("acqui") || d.transactionText.toLowerCase().includes("purchase");
                      const isSale = d.transactionText.toLowerCase().includes("sale") || d.transactionText.toLowerCase().includes("sold");
                      return (
                        <div key={`${d.symbol}-${i}`} className={`grid grid-cols-[80px_1fr_100px_100px_100px_90px] gap-2 px-4 py-2.5 border-b border-white/[0.03] items-center hover:bg-white/[0.02] transition-colors ${isBuy ? "bg-emerald-500/[0.02]" : isSale ? "bg-red-500/[0.02]" : ""}`}>
                          <div className="text-xs text-gray-500 font-mono">{d.startDate}</div>
                          <div>
                            <div className="text-xs font-semibold truncate">{d.filerName}</div>
                            <div className="text-[10px] text-gray-500">{d.filerRelation}</div>
                          </div>
                          <div>
                            <span className="text-xs font-mono font-semibold text-blue-400 cursor-pointer hover:text-blue-300"
                              onClick={() => { setActiveTab("search"); setSearchQuery(d.symbol); searchStock(d.symbol); }}
                            >{d.symbol}</span>
                          </div>
                          <div className="text-right text-xs font-mono">{d.shares > 0 ? formatNumber(d.shares, market) : "—"}</div>
                          <div className="text-right text-xs font-mono">{d.value > 0 ? currencySymbol +formatNumber(d.value, market) : "—"}</div>
                          <div className="text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isBuy ? "bg-emerald-500/15 text-emerald-400" : isSale ? "bg-red-500/15 text-red-400" : "bg-gray-500/15 text-gray-400"}`}>
                              {isBuy ? "BUY" : isSale ? "SELL" : "OTHER"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── BULK/BLOCK DEALS SUB-TAB ── */}
            {insiderTab === "bulk" && !insiderLoading && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">LARGE TRANSACTIONS</span>
                  <span className="text-xs text-gray-500">{market === "US" ? "Shares >100K or value >$1M from SEC insider filings of top US stocks" : "Shares >1 lakh or value >1 crore from insider filings of top 30 stocks"}</span>
                </div>
                {insiderData.bulkDeals.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 text-sm">No bulk deals found. Click the tab to load data.</div>
                ) : (
                  <div className="space-y-3">
                    {insiderData.bulkDeals.map((d, i) => {
                      const isBuy = d.transactionText.toLowerCase().includes("acqui") || d.transactionText.toLowerCase().includes("purchase");
                      const isSale = d.transactionText.toLowerCase().includes("sale") || d.transactionText.toLowerCase().includes("sold");
                      const valueInCr = d.value / 10000000;
                      return (
                        <div key={`bulk-${i}`} className={`bg-white/[0.02] border rounded-xl p-4 transition-all hover:bg-white/[0.03] ${
                          isBuy ? "border-emerald-500/20 border-l-2 border-l-emerald-500" :
                          isSale ? "border-red-500/20 border-l-2 border-l-red-500" :
                          "border-white/5"
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold ${isBuy ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                                {isBuy ? "B" : "S"}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-base font-bold cursor-pointer text-blue-400 hover:text-blue-300"
                                    onClick={() => { setActiveTab("search"); setSearchQuery(d.symbol); searchStock(d.symbol); }}
                                  >{d.symbol}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isBuy ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                                    {isBuy ? "ACQUISITION" : "SALE"}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-300 mt-0.5">{d.filerName}</div>
                                <div className="text-[10px] text-gray-500">{d.filerRelation} &middot; {d.startDate}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold font-mono text-white">{formatNumber(d.shares, market)} shares</div>
                              {d.value > 0 && (
                                <div className="text-sm font-mono text-gray-400">
                                  {currencySymbol}{market === "IN" && valueInCr >= 1 ? valueInCr.toFixed(2) + " Cr" : formatNumber(d.value, market)}
                                </div>
                              )}
                              <div className="text-[10px] text-gray-500 mt-0.5">{d.transactionText}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Social / Trending Section */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Social & Market Buzz</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-500/15 text-violet-400 border border-violet-500/20">Trending</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { platform: "X (Twitter)", handle: "@ABORINGCEO", desc: "Large insider trades & block deals tracker. Real-time SEBI filing alerts.", color: "text-sky-400", bgColor: "bg-sky-500/10" },
                  { platform: "X (Twitter)", handle: "@Aboringfund", desc: "FII/DII flow data, bulk deals, mutual fund portfolio changes daily.", color: "text-sky-400", bgColor: "bg-sky-500/10" },
                  { platform: "X (Twitter)", handle: "@ABORINGANALYS1", desc: "Promoter buying/selling alerts. Tracks big-money moves in real-time.", color: "text-sky-400", bgColor: "bg-sky-500/10" },
                  { platform: "Trendlyne", handle: "trendlyne.com", desc: "Insider trades, bulk/block deals, SAST deals, shareholding patterns. Best free source.", color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
                  { platform: "Screener.in", handle: "screener.in", desc: "Shareholding patterns, promoter/FII/DII changes quarter over quarter.", color: "text-amber-400", bgColor: "bg-amber-500/10" },
                  { platform: "MoneyControl", handle: "moneycontrol.com", desc: "Bulk deals, block deals, insider trades section. Most comprehensive Indian financial portal.", color: "text-blue-400", bgColor: "bg-blue-500/10" },
                  { platform: "NSE India", handle: "nseindia.com", desc: "Official bulk/block deal data. Corporate announcements and SAST disclosures.", color: "text-orange-400", bgColor: "bg-orange-500/10" },
                  { platform: "X (Twitter)", handle: "@iaboringmarket", desc: "Market sentiment tracker. Tracks what retail, HNIs, and FIIs are doing.", color: "text-sky-400", bgColor: "bg-sky-500/10" },
                  { platform: "X (Twitter)", handle: "@InsiderTrades_", desc: "Automated insider trade alerts from SEBI filings. Promoter buys/sells.", color: "text-sky-400", bgColor: "bg-sky-500/10" },
                ].map((source, i) => (
                  <div key={i} className={`${source.bgColor} border border-white/5 rounded-xl p-3 hover:border-white/10 transition-all`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-xs font-bold ${source.color}`}>{source.platform}</span>
                      <span className="text-xs font-mono text-gray-300">{source.handle}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">{source.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-600 mt-3">Follow these sources for real-time insider activity. SEBI mandates disclosure of trades by promoters, directors, and KMPs within 2 trading days.</p>
            </div>
          </div>
        )}

        {/* ─── ETFs TAB ─── */}
        {activeTab === "etfs" && (() => {
          const recBadge = (rec: ETFResult["recommendation"]) => {
            const map = {
              STRONG_BUY: { label: "Strong Buy", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
              BUY: { label: "Buy", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
              HOLD: { label: "Hold", cls: "bg-gray-500/10 text-gray-300 border-gray-500/20" },
              SELL: { label: "Sell", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
              STRONG_SELL: { label: "Strong Sell", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
            };
            return map[rec];
          };
          const themes = etfData?.themes || [];
          const filteredThemes = etfThemeFilter === "All" ? themes : themes.filter((t) => t === etfThemeFilter);
          const recMatches = (r: ETFResult) => {
            if (etfRecFilter === "All") return true;
            if (etfRecFilter === "BUY") return r.recommendation === "BUY" || r.recommendation === "STRONG_BUY";
            if (etfRecFilter === "SELL") return r.recommendation === "SELL" || r.recommendation === "STRONG_SELL";
            return r.recommendation === "HOLD";
          };
          return (
            <div>
              <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-xl font-bold">ETF Screener</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {market === "US" ? "US-listed ETFs" : "NSE-listed ETFs"} grouped by theme. Each ETF is scored across trend, momentum, MACD and {STRATEGIES.length}-strategy confluence to produce a buy/hold/sell call.
                  </p>
                </div>
                <button
                  onClick={loadEtfs}
                  disabled={etfLoading}
                  className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-xs font-semibold text-blue-400 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {etfLoading ? <><Spinner /> Scanning...</> : (etfData ? "Re-scan ETFs" : "Scan ETFs")}
                </button>
              </div>

              {/* Filters */}
              {etfData && (
                <div className="flex flex-wrap items-center gap-2 mb-5">
                  <div className="flex flex-wrap gap-1.5 bg-white/[0.02] border border-white/5 rounded-lg p-1">
                    {["All", ...themes].map((t) => (
                      <button
                        key={t}
                        onClick={() => setEtfThemeFilter(t)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${etfThemeFilter === t ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5 bg-white/[0.02] border border-white/5 rounded-lg p-1">
                    {(["All", "BUY", "HOLD", "SELL"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setEtfRecFilter(r)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${etfRecFilter === r ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
                      >
                        {r === "All" ? "All Calls" : r}
                      </button>
                    ))}
                  </div>
                  <span className="ml-auto text-xs text-gray-500">Scanned {etfData.scanned}/{etfData.total}</span>
                </div>
              )}

              {!etfData && !etfLoading && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13h2l3 8 4-16 3 8h6" /></svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-1">ETF Screener</h3>
                  <p className="text-sm text-gray-500 max-w-md">Click &quot;Scan ETFs&quot; to evaluate every {market === "US" ? "US-listed" : "NSE-listed"} ETF across trend, momentum and strategy confluence — grouped by theme with a buy/hold/sell call for each.</p>
                </div>
              )}

              {etfLoading && !etfData && (
                <div className="space-y-3">
                  {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-20 w-full rounded-xl" />)}
                </div>
              )}

              {etfData && filteredThemes.map((theme) => {
                const items = (etfData.byTheme[theme] || []).filter(recMatches);
                if (items.length === 0) return null;
                return (
                  <div key={theme} className="mb-6">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                      {theme}
                      <span className="text-[10px] text-gray-600 font-normal normal-case">({items.length})</span>
                    </h3>
                    <div className="space-y-2">
                      {items.map((r) => {
                        const badge = recBadge(r.recommendation);
                        const isExpanded = expandedEtf === r.symbol;
                        return (
                          <div key={r.symbol} className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                            <button
                              onClick={() => setExpandedEtf(isExpanded ? null : r.symbol)}
                              className="w-full flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-all text-left"
                            >
                              <div className="flex-1 min-w-[180px]">
                                <div className="font-mono font-semibold text-sm">{r.symbol}</div>
                                <div className="text-[11px] text-gray-500 truncate max-w-md">{r.name}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-mono font-semibold">{fmtPrice(r.price)}</div>
                                <div className={`text-[11px] font-mono ${r.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {r.changePercent >= 0 ? "+" : ""}{r.changePercent.toFixed(2)}%
                                </div>
                              </div>
                              <div className={`px-2.5 py-1 rounded-md border text-xs font-semibold ${badge.cls}`}>
                                {badge.label}
                              </div>
                              <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-gray-500">
                                <span className="text-emerald-400">{r.buyCount}↑</span>
                                <span>·</span>
                                <span className="text-red-400">{r.sellCount}↓</span>
                                <span>·</span>
                                <span>score {r.score >= 0 ? "+" : ""}{r.score}</span>
                              </div>
                              <svg className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-3">
                                {r.note && <div className="text-xs text-gray-400">{r.note}</div>}
                                {r.rationale.length > 0 && (
                                  <ul className="text-xs text-gray-300 space-y-1">
                                    {r.rationale.map((line, i) => (
                                      <li key={i} className="flex gap-2"><span className="text-gray-600">•</span>{line}</li>
                                    ))}
                                  </ul>
                                )}
                                <div className="flex flex-wrap gap-3 text-[11px] text-gray-500">
                                  <span>52W: <span className="text-emerald-400 font-mono">{fmtPrice(r.high52w)}</span> / <span className="text-red-400 font-mono">{fmtPrice(r.low52w)}</span></span>
                                  <span>Volume: <span className="text-gray-300 font-mono">{r.volume.toLocaleString(market === "US" ? "en-US" : "en-IN")}</span></span>
                                </div>
                                <div className="rounded-lg overflow-hidden border border-white/5">
                                  <CandlestickChart symbol={r.symbol} indicators={["sma50", "sma200", "rsi"]} market={market} />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ─── STRATEGIES TAB ─── */}
        {activeTab === "strategies" && (
          <div className="mb-4 flex items-center gap-1 bg-white/5 rounded-lg p-0.5 w-fit">
            {(["screener", "insider"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setStrategiesSubTab(s); if (s === "insider" && insiderData.holders.length === 0) loadInsiderTab("holders"); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${strategiesSubTab === s ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
              >
                {s === "screener" ? "Screener" : "Insider Info"}
              </button>
            ))}
          </div>
        )}
        {activeTab === "strategies" && strategiesSubTab === "screener" && (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-[380px] flex-shrink-0">
              <div className="sticky top-20">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Book Strategies</h2>
                  <span className="text-xs text-gray-500">{STRATEGIES.length} strategies</span>
                </div>

                {/* Book Filter */}
                <div className="mb-3">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Book</div>
                  <select
                    value={bookFilter}
                    onChange={(e) => setBookFilter(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer"
                  >
                    {BOOKS.map((b) => (
                      <option key={b} value={b} className="bg-[#0a0a0f] text-gray-300">{b}</option>
                    ))}
                  </select>
                </div>

                {/* Category Filter */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {categories.map((cat) => (
                    <button key={cat} onClick={() => setCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${categoryFilter === cat ? "bg-white/10 text-white border-white/20" : "border-white/5 text-gray-500 hover:text-gray-300 hover:border-white/10"}`}
                    >{cat}</button>
                  ))}
                </div>
                <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
                  {filteredStrategies.map((s) => (
                    <button key={s.id} onClick={() => handleSelectStrategy(s)}
                      className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${selectedStrategy?.id === s.id ? "bg-blue-500/10 border-blue-500/30 shadow-lg shadow-blue-500/5" : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono text-gray-500">Ch {s.chapter}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${CATEGORY_COLORS[s.category] || ""}`}>{s.category}</span>
                          </div>
                          <h3 className="text-sm font-semibold truncate">{s.name}</h3>
                          <p className="text-[10px] text-gray-600 truncate mt-0.5">{s.book}</p>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{s.description}</p>
                        </div>
                        <svg className={`w-4 h-4 flex-shrink-0 mt-1 transition-transform ${selectedStrategy?.id === s.id ? "text-blue-400 rotate-90" : "text-gray-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {s.indicators.map((ind) => (<span key={ind} className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-gray-500">{ind}</span>))}
                      </div>
                      {/* Backtest stats */}
                      {BACKTEST_CACHE[s.id] && BACKTEST_CACHE[s.id].trades > 0 && (
                        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/5">
                          <div className={`text-[11px] font-bold ${BACKTEST_CACHE[s.id].winRate >= 55 ? "text-emerald-400" : BACKTEST_CACHE[s.id].winRate >= 45 ? "text-yellow-400" : "text-red-400"}`}>
                            {BACKTEST_CACHE[s.id].winRate}% win
                          </div>
                          <div className="text-[10px] text-gray-500">{BACKTEST_CACHE[s.id].trades} trades</div>
                          <div className={`text-[10px] font-mono ${BACKTEST_CACHE[s.id].avgPeakReturn >= 0 ? "text-emerald-400/70" : "text-red-400/70"}`}>
                            +{BACKTEST_CACHE[s.id].avgPeakReturn}% in {BACKTEST_CACHE[s.id].avgDaysToPeak}d
                          </div>
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                            <div className="bg-emerald-500 h-full" style={{ width: `${BACKTEST_CACHE[s.id].winRate}%` }} />
                            <div className="bg-red-500 h-full" style={{ width: `${100 - BACKTEST_CACHE[s.id].winRate}%` }} />
                          </div>
                        </div>
                      )}
                      {BACKTEST_CACHE[s.id] && BACKTEST_CACHE[s.id].trades === 0 && (
                        <div className="mt-2 pt-2 border-t border-white/5">
                          <span className="text-[10px] text-gray-600">No signals in backtest period</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              {!selectedStrategy ? (
                <div className="flex flex-col items-center justify-center h-96 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Select a Strategy</h3>
                  <p className="text-sm text-gray-500 max-w-sm">Choose from {STRATEGIES.length} strategies to scan {universeLabel} stocks</p>
                </div>
              ) : (
                <>
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-500">Chapter {selectedStrategy.chapter}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${CATEGORY_COLORS[selectedStrategy.category] || ""}`}>{selectedStrategy.category}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-gray-400 border border-white/10">{selectedStrategy.book}</span>
                    </div>
                    <h2 className="text-xl font-bold">{selectedStrategy.name}</h2>
                    <p className="text-sm text-gray-400 mt-1">{selectedStrategy.description}</p>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {selectedStrategy.indicators.map((ind) => (<span key={ind} className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-400">{ind}</span>))}
                    </div>

                    {/* Backtest section - pre-loaded from cache */}
                    <div className="mt-4 pt-4 border-t border-white/5">
                      {/* Cached backtest results - always visible */}
                      {(() => {
                        const bt = BACKTEST_CACHE[selectedStrategy.id];
                        if (!bt) return null;
                        if (bt.trades === 0) return (
                          <div className="text-xs text-gray-500 mb-3">No backtest signals generated for this strategy in the last year (requires extreme market conditions).</div>
                        );
                        const rr = bt.avgDrawdown < -0.1 ? (bt.avgPeakReturn / Math.abs(bt.avgDrawdown)) : 0;
                        return (
                          <div className="mb-3">
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-2">
                              <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                                <div className={`text-xl font-bold ${bt.winRate >= 55 ? "text-emerald-400" : bt.winRate >= 45 ? "text-yellow-400" : "text-red-400"}`}>{bt.winRate}%</div>
                                <div className="text-[9px] text-gray-500 uppercase">Win Rate</div>
                              </div>
                              <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                                <div className="text-xl font-bold text-white">{bt.trades}</div>
                                <div className="text-[9px] text-gray-500 uppercase">Trades</div>
                              </div>
                              <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                                <div className={`text-xl font-bold ${bt.totalReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>{bt.totalReturn >= 0 ? "+" : ""}{bt.totalReturn}%</div>
                                <div className="text-[9px] text-gray-500 uppercase">Total Return</div>
                              </div>
                              <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                                <div className="text-xl font-bold text-blue-400">{bt.avgDaysToPeak}d</div>
                                <div className="text-[9px] text-gray-500 uppercase">Avg Days to Peak</div>
                              </div>
                              <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                                <div className="text-xl font-bold text-emerald-400">+{bt.avgPeakReturn}%</div>
                                <div className="text-[9px] text-gray-500 uppercase">Avg Peak Return</div>
                              </div>
                              <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                                <div className="text-xl font-bold text-red-400">{bt.avgDrawdown}%</div>
                                <div className="text-[9px] text-gray-500 uppercase">Avg Drawdown</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] text-emerald-400 font-semibold">{bt.wins}W</span>
                              <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden flex">
                                <div className="bg-emerald-500 h-full" style={{ width: `${bt.winRate}%` }} />
                                <div className="bg-red-500 h-full" style={{ width: `${100 - bt.winRate}%` }} />
                              </div>
                              <span className="text-[10px] text-red-400 font-semibold">{bt.losses}L</span>
                              {rr > 0 && <span className="text-[10px] text-gray-500 ml-1">R:R {rr.toFixed(2)}x</span>}
                            </div>
                          </div>
                        );
                      })()}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Detailed Backtest</span>
                          <span className="relative group">
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white/5 text-[9px] text-gray-500 font-bold border border-white/10 cursor-help">i</span>
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-xs text-gray-300 w-72 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 shadow-xl leading-relaxed">
                              Run detailed backtest on the {market === "US" ? "S&P 500" : "Nifty 50"} index + 5 major stocks over 1 year. Shows per-stock breakdown and individual trade history. Entry on signal with strength &ge;25, hold 10 trading days. Peak = best return during hold. Drawdown = worst dip.
                            </span>
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setBacktestLoading(true);
                            setBacktestData(null);
                            fetch(`/api/backtest?strategy=${selectedStrategy.id}&market=${market}`)
                              .then((r) => r.json())
                              .then((d) => { setBacktestData(d); setBacktestLoading(false); })
                              .catch(() => setBacktestLoading(false));
                          }}
                          disabled={backtestLoading}
                          className="px-4 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg text-xs font-semibold text-purple-400 transition-all disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {backtestLoading ? <><Spinner /> Running...</> : (
                            backtestData?.strategy?.id === selectedStrategy.id ? "Re-run Backtest" : "Run Backtest"
                          )}
                        </button>
                      </div>

                      {backtestLoading && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                          <Spinner /> Backtesting on {market === "US" ? "S&P 500" : "Nifty 50"} + 5 major stocks over 1 year...
                        </div>
                      )}

                      {backtestData && backtestData.strategy?.id === selectedStrategy.id && !backtestLoading && (
                        <div className="mt-3 space-y-3">
                          {/* Aggregate results */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white/[0.03] rounded-lg p-3 text-center">
                              <div className={`text-2xl font-bold ${backtestData.aggregate.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>
                                {backtestData.aggregate.winRate}%
                              </div>
                              <div className="text-[10px] text-gray-500 uppercase mt-1">Win Rate</div>
                            </div>
                            <div className="bg-white/[0.03] rounded-lg p-3 text-center">
                              <div className="text-2xl font-bold text-white">{backtestData.aggregate.totalTrades}</div>
                              <div className="text-[10px] text-gray-500 uppercase mt-1">Total Trades</div>
                            </div>
                            <div className="bg-white/[0.03] rounded-lg p-3 text-center">
                              <div className={`text-2xl font-bold ${backtestData.aggregate.avgReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {backtestData.aggregate.avgReturn >= 0 ? "+" : ""}{backtestData.aggregate.avgReturn}%
                              </div>
                              <div className="text-[10px] text-gray-500 uppercase mt-1">Avg Return/Trade</div>
                            </div>
                            <div className="bg-white/[0.03] rounded-lg p-3 text-center">
                              <div className={`text-2xl font-bold ${backtestData.aggregate.totalReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {backtestData.aggregate.totalReturn >= 0 ? "+" : ""}{backtestData.aggregate.totalReturn}%
                              </div>
                              <div className="text-[10px] text-gray-500 uppercase mt-1">Total Return</div>
                            </div>
                          </div>

                          {/* Win/Loss bar */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-emerald-400 font-semibold">{backtestData.aggregate.wins}W</span>
                            <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden flex">
                              <div className="bg-emerald-500 h-full rounded-l-full" style={{ width: `${backtestData.aggregate.winRate}%` }} />
                              <div className="bg-red-500 h-full rounded-r-full" style={{ width: `${100 - backtestData.aggregate.winRate}%` }} />
                            </div>
                            <span className="text-xs text-red-400 font-semibold">{backtestData.aggregate.losses}L</span>
                          </div>

                          {/* Cross-validation */}
                          {backtestData.crossValidation && backtestData.crossValidation.length > 0 && (
                            <div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Per-Stock Breakdown</div>
                              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                <div className="bg-white/[0.02] rounded-lg p-2 text-center">
                                  <div className="text-[10px] text-gray-500">{market === "US" ? "S&P 500" : "NIFTY 50"}</div>
                                  <div className={`text-sm font-bold ${backtestData.primary.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>{backtestData.primary.winRate}%</div>
                                  <div className="text-[10px] text-gray-600">{backtestData.primary.totalSignals} trades</div>
                                </div>
                                {backtestData.crossValidation.map((cv: any) => (
                                  <div key={cv.symbol} className="bg-white/[0.02] rounded-lg p-2 text-center">
                                    <div className="text-[10px] text-gray-500">{cv.symbol}</div>
                                    <div className={`text-sm font-bold ${cv.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>{cv.winRate}%</div>
                                    <div className="text-[10px] text-gray-600">{cv.totalSignals} trades</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Recent trades */}
                          {backtestData.primary.trades && backtestData.primary.trades.length > 0 && (
                            <details className="group">
                              <summary className="text-[10px] text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 transition-colors">
                                Trade History ({market === "US" ? "S&P 500" : "Nifty 50"}) &mdash; {backtestData.primary.trades.length} trades
                              </summary>
                              <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                                {backtestData.primary.trades.map((t: any, i: number) => (
                                  <div key={i} className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs ${t.won ? "bg-emerald-500/5" : "bg-red-500/5"}`}>
                                    <div className="flex items-center gap-2">
                                      <span className={`font-semibold ${t.signal === "BUY" ? "text-emerald-400" : "text-red-400"}`}>{t.signal}</span>
                                      <span className="text-gray-500">{t.entryDate}</span>
                                      <span className="text-gray-600">&rarr;</span>
                                      <span className="text-gray-500">{t.exitDate}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-400 font-mono">{t.entryPrice} &rarr; {t.exitPrice}</span>
                                      <span className={`font-bold font-mono ${t.pnlPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                        {t.pnlPercent >= 0 ? "+" : ""}{t.pnlPercent}%
                                      </span>
                                      <span>{t.won ? "✓" : "✗"}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}

                          {backtestData.aggregate.totalTrades === 0 && (
                            <div className="text-xs text-gray-500 text-center py-2">
                              No signals generated with strength &ge;25 in the last year for this strategy.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      {["ALL", "BUY", "SELL", "NEUTRAL"].map((f) => (
                        <button key={f} onClick={() => { setSignalFilter(f); setResults([]); setChartStock(null); runScreener(selectedStrategy, f); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${signalFilter === f ? (f === "BUY" ? "bg-emerald-500/20 text-emerald-400" : f === "SELL" ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white") : "text-gray-500 hover:text-gray-300"}`}
                        >{f}</button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{scannedInfo.scanned}/{scannedInfo.total} scanned &middot; {results.length} results</span>
                      {results.length > 0 && (
                        <button
                          onClick={() => {
                            const lines = results.map((r, i) =>
                              `${i + 1}. ${r.symbol} ${currencySymbol}${r.price.toFixed(2)} (${r.changePercent >= 0 ? "+" : ""}${r.changePercent.toFixed(2)}%) — ${r.signal} [${r.strength}] ${r.details}`
                            );
                            const text = `${selectedStrategy?.name} (${selectedStrategy?.chapter}) — ${signalFilter} Signals\n${selectedStrategy?.description}\n${"─".repeat(50)}\n${lines.join("\n")}\n${"─".repeat(50)}\nScanned ${scannedInfo.scanned}/${scannedInfo.total} stocks | Generated by StrategyScreener`;
                            navigator.clipboard.writeText(text);
                            setCopiedStrategy(true);
                            setTimeout(() => setCopiedStrategy(false), 2000);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] font-medium transition-all"
                        >
                          {copiedStrategy ? (
                            <><svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Copied!</>
                          ) : (
                            <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg> Share</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[1fr_90px_90px_80px_80px_1fr] gap-2 px-4 py-2.5 border-b border-white/5 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                      <div>Stock</div><div className="text-right">Price</div><div className="text-right">Change</div><div className="text-center">Signal</div><div className="text-center">Strength</div><div>Details</div>
                    </div>
                    {loading && results.length === 0 && [...Array(8)].map((_, i) => <SkeletonRow key={i} />)}
                    {results.map((r) => (
                      <div key={r.symbol}>
                        <div
                          className={`grid grid-cols-[1fr_90px_90px_80px_80px_1fr] gap-2 px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors items-center cursor-pointer ${chartStock === r.symbol ? "bg-white/[0.03]" : ""}`}
                          onClick={() => setChartStock(chartStock === r.symbol ? null : r.symbol)}
                        >
                          <div>
                            <span className="text-sm font-semibold hover:text-blue-400 transition-colors">{r.symbol}</span>
                            <div className="text-[11px] text-gray-500 truncate max-w-[180px]">{r.name}</div>
                          </div>
                          <div className="text-right text-sm font-mono">{r.price.toFixed(2)}</div>
                          <div className={`text-right text-sm font-mono ${r.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>{r.change >= 0 ? "+" : ""}{r.changePercent.toFixed(2)}%</div>
                          <div className="text-center"><SignalBadge signal={r.signal} strength={0} /></div>
                          <div className="flex justify-center"><StrengthBar strength={r.strength} /></div>
                          <div className="text-xs text-gray-500 truncate" title={r.details}>{r.details}</div>
                        </div>
                        {chartStock === r.symbol && selectedStrategy && (
                          <div className="border-b border-white/[0.03] bg-white/[0.01] p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold">{r.symbol} Chart</h4>
                                <SignalBadge signal={r.signal} strength={r.strength} />
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); setActiveTab("search"); setSearchQuery(r.symbol); searchStock(r.symbol); }}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                Full Lookup &rarr;
                              </button>
                            </div>
                            <div className="rounded-lg overflow-hidden border border-white/5">
                              <CandlestickChart
                                symbol={r.symbol}
                                indicators={mapStrategyIndicatorsToChartIds(selectedStrategy.indicators)}
                                signalDetails={r.details}
                                signal={r.signal}
                                market={market}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">{r.details}</p>
                          </div>
                        )}
                      </div>
                    ))}
                    {!loading && results.length === 0 && selectedStrategy && <div className="p-8 text-center text-gray-500 text-sm">No stocks found with the selected filter.</div>}
                  </div>

                  {scannedInfo.scanned < scannedInfo.total && (
                    <div className="flex justify-center mt-4">
                      <button onClick={() => runScreener(selectedStrategy, signalFilter, scannedInfo.scanned)} disabled={loading}
                        className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2">
                        {loading ? <><Spinner /> Scanning...</> : `Scan Next 30 (${scannedInfo.scanned}/${scannedInfo.total})`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ─── MULTI-SCAN TAB ─── */}
        {activeTab === "scan" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">Multi-Strategy Scan</h2>
                <p className="text-sm text-gray-500 mt-1">Find stocks with BUY signals across 2 or more of the {STRATEGIES.length} strategies</p>
              </div>
              <button
                onClick={() => { setScanResults([]); runScan(0); }}
                disabled={scanLoading}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {scanLoading ? <><Spinner /> Scanning...</> : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    Scan {universeLabel}
                  </>
                )}
              </button>
            </div>

            {/* Sort bar + Share button */}
            {scanResults.length > 0 && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 mr-1">Sort by:</span>
                  {([
                    { key: "buyCount", label: "Buy Signals" },
                    { key: "price", label: "Price" },
                    { key: "change", label: "% Change" },
                    { key: "strength", label: "Strength" },
                  ] as const).map((s) => (
                    <button key={s.key} onClick={() => setScanSort(s.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${scanSort === s.key ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
                    >{s.label}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{scanResults.length} stocks found</span>
                  <button
                    onClick={() => {
                      const sorted = [...scanResults].sort((a, b) => {
                        switch (scanSort) {
                          case "price": return b.price - a.price;
                          case "change": return b.changePercent - a.changePercent;
                          case "strength": return b.avgStrength - a.avgStrength;
                          default: return b.buyCount - a.buyCount || b.avgStrength - a.avgStrength;
                        }
                      });
                      const lines = sorted.map((r, i) =>
                        `${i + 1}. ${r.symbol} (${currencySymbol}${r.price.toFixed(2)}) ${r.changePercent >= 0 ? "+" : ""}${r.changePercent.toFixed(2)}% | BUY: ${r.buyCount}/${r.totalStrategies} | Avg Strength: ${r.avgStrength}${r.buyStrategies ? "\n   Top: " + r.buyStrategies.slice(0, 3).map(s => s.name).join(", ") : ""}`
                      );
                      const text = `Multi-Strategy Scan Results (${new Date().toLocaleDateString("en-IN")})\nSorted by: ${scanSort}\n${"─".repeat(50)}\n${lines.join("\n")}\n${"─".repeat(50)}\nGenerated by StrategyScreener`;
                      navigator.clipboard.writeText(text);
                      setCopiedScan(true);
                      setTimeout(() => setCopiedScan(false), 2000);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium transition-all"
                  >
                    {copiedScan ? (
                      <><svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Copied!</>
                    ) : (
                      <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg> Share List</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {scanLoading && scanResults.length === 0 && (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-24 w-full rounded-xl" />)}
              </div>
            )}

            {scanResults.length > 0 && (
              <div className="space-y-3">
                {[...scanResults].sort((a, b) => {
                  switch (scanSort) {
                    case "price": return b.price - a.price;
                    case "change": return b.changePercent - a.changePercent;
                    case "strength": return b.avgStrength - a.avgStrength;
                    default: return b.buyCount - a.buyCount || b.avgStrength - a.avgStrength;
                  }
                }).map((r) => (
                  <div key={r.symbol} className="bg-white/[0.02] border border-emerald-500/10 rounded-xl overflow-hidden hover:border-emerald-500/20 transition-all">
                    {/* Header row - always visible */}
                    <button
                      onClick={() => setExpandedScan(expandedScan === r.symbol ? null : r.symbol)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.01] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="text-base font-bold">{r.symbol}</div>
                          <div className="text-xs text-gray-500">{r.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono font-semibold">{currencySymbol}{r.price.toFixed(2)}</div>
                          <div className={`text-xs font-mono ${r.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {r.changePercent >= 0 ? "+" : ""}{r.changePercent.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-emerald-400">{r.buyCount}</div>
                          <div className="text-[10px] text-gray-500 uppercase">Buy</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-red-400">{r.sellCount}</div>
                          <div className="text-[10px] text-gray-500 uppercase">Sell</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-gray-500">{r.neutralCount}</div>
                          <div className="text-[10px] text-gray-500 uppercase">Neutral</div>
                        </div>
                        <div className="text-center min-w-[60px]">
                          <StrengthBar strength={r.avgStrength} />
                          <div className="text-[10px] text-gray-500 mt-1">Avg: {r.avgStrength}</div>
                        </div>
                        {/* Signal bar */}
                        <div className="w-32 h-3 bg-white/5 rounded-full overflow-hidden flex">
                          <div className="bg-emerald-500 h-full" style={{ width: `${(r.buyCount / r.totalStrategies) * 100}%` }} />
                          <div className="bg-red-500 h-full" style={{ width: `${(r.sellCount / r.totalStrategies) * 100}%` }} />
                        </div>
                        <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expandedScan === r.symbol ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded: ALL buy and sell strategies */}
                    {expandedScan === r.symbol && (
                      <div className="border-t border-white/5">
                        {/* Quick actions */}
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.01] border-b border-white/5">
                          <button
                            onClick={() => { setActiveTab("search"); setSearchQuery(r.symbol); searchStock(r.symbol); }}
                            className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
                          >
                            View Full Analysis
                          </button>
                          <span className="text-xs text-gray-500">
                            {r.buyCount} buy + {r.sellCount} sell + {r.neutralCount} neutral = {r.totalStrategies} total
                          </span>
                        </div>

                        {/* BUY signals */}
                        {r.buyStrategies && r.buyStrategies.length > 0 && (
                          <div className="px-4 py-3">
                            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
                              All Buy Signals ({r.buyStrategies.length})
                            </div>
                            <div className="space-y-1.5">
                              {r.buyStrategies.map((s) => (
                                <button
                                  key={s.id}
                                  onClick={() => {
                                    const strat = STRATEGIES.find((st) => st.id === s.id);
                                    if (strat) {
                                      setActiveTab("strategies");
                                      setSelectedStrategy(strat);
                                      setResults([]);
                                      setSignalFilter("BUY");
                                      runScreener(strat, "BUY");
                                    }
                                  }}
                                  className="w-full flex items-center justify-between bg-emerald-500/5 hover:bg-emerald-500/10 rounded-lg p-2.5 text-left transition-colors group"
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="text-[10px] font-mono text-gray-500 flex-shrink-0">Ch {s.chapter}</span>
                                    <span className="text-sm font-medium truncate group-hover:text-emerald-400 transition-colors">{s.name}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border flex-shrink-0 ${CATEGORY_COLORS[s.category] || ""}`}>{s.category}</span>
                                    <span className="text-[10px] text-gray-600 truncate hidden sm:inline">{s.book}</span>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                    <StrengthBar strength={s.strength} />
                                    <span className="text-xs text-emerald-400 font-semibold w-16 text-right">BUY ({s.strength})</span>
                                    <svg className="w-3 h-3 text-gray-500 group-hover:text-emerald-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </div>
                                </button>
                              ))}
                            </div>
                            {/* Details on hover - show details of each strategy */}
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {r.buyStrategies.slice(0, 6).map((s) => (
                                <div key={s.id + "-detail"} className="text-[11px] text-gray-500 bg-white/[0.02] rounded px-2 py-1.5 truncate" title={s.details}>
                                  <span className="text-emerald-400/70 font-medium">{s.name}:</span> {s.details}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* SELL signals */}
                        {r.sellStrategies && r.sellStrategies.length > 0 && (
                          <div className="px-4 py-3 border-t border-white/5">
                            <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                              All Sell Signals ({r.sellStrategies.length})
                            </div>
                            <div className="space-y-1.5">
                              {r.sellStrategies.map((s) => (
                                <button
                                  key={s.id}
                                  onClick={() => {
                                    const strat = STRATEGIES.find((st) => st.id === s.id);
                                    if (strat) {
                                      setActiveTab("strategies");
                                      setSelectedStrategy(strat);
                                      setResults([]);
                                      setSignalFilter("SELL");
                                      runScreener(strat, "SELL");
                                    }
                                  }}
                                  className="w-full flex items-center justify-between bg-red-500/5 hover:bg-red-500/10 rounded-lg p-2.5 text-left transition-colors group"
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="text-[10px] font-mono text-gray-500 flex-shrink-0">Ch {s.chapter}</span>
                                    <span className="text-sm font-medium truncate group-hover:text-red-400 transition-colors">{s.name}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border flex-shrink-0 ${CATEGORY_COLORS[s.category] || ""}`}>{s.category}</span>
                                    <span className="text-[10px] text-gray-600 truncate hidden sm:inline">{s.book}</span>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                    <StrengthBar strength={s.strength} />
                                    <span className="text-xs text-red-400 font-semibold w-16 text-right">SELL ({s.strength})</span>
                                    <svg className="w-3 h-3 text-gray-500 group-hover:text-red-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!scanLoading && scanResults.length === 0 && scanInfo.scanned === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-1">Multi-Strategy Scanner</h3>
                <p className="text-sm text-gray-500 max-w-md">Click &quot;Scan {universeLabel}&quot; to find stocks that have BUY signals on 2 or more strategies simultaneously. Stocks with the most buy confirmations appear first.</p>
              </div>
            )}

            {scanInfo.scanned > 0 && scanInfo.scanned < scanInfo.total && (
              <div className="flex justify-center mt-4">
                <button onClick={() => runScan(scanInfo.scanned)} disabled={scanLoading}
                  className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2">
                  {scanLoading ? <><Spinner /> Scanning...</> : `Scan Next 30 (${scanInfo.scanned}/${scanInfo.total})`}
                </button>
              </div>
            )}

            {scanLoading && scanResults.length > 0 && (
              <div className="flex justify-center mt-4"><Spinner /></div>
            )}

            {/* ═══ MASTER SCAN SECTION ═══ */}
            <div className="mt-10 pt-8 border-t border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">Master Scan</h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">ALL 500 STOCKS</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Scan every {universeLabel} stock against all {STRATEGIES.length} strategies. Ranked by most buy signals — find the best stocks to buy right now.</p>
                </div>
                <button
                  onClick={runMasterScan}
                  disabled={masterScanning}
                  className="px-6 py-3 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  {masterScanning ? <><Spinner /> Scanning {masterProgress.scanned}/{masterProgress.total}...</> : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Master Scan All {universeLabel}
                    </>
                  )}
                </button>
              </div>

              {/* Progress Bar */}
              {masterScanning && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">Scanning {universeLabel}...</span>
                    <span className="text-xs text-gray-400">{masterProgress.scanned}/{masterProgress.total} stocks scanned &middot; <span className="text-emerald-400 font-semibold">{masterProgress.found} with buy signals</span></span>
                  </div>
                  <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full transition-all duration-500"
                      style={{ width: `${masterProgress.total > 0 ? (masterProgress.scanned / masterProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Results Leaderboard */}
              {masterResults.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500 mr-1">Sort:</span>
                      {([
                        { key: "buyCount", label: "Most Buy Signals" },
                        { key: "strength", label: "Avg Strength" },
                        { key: "change", label: "% Change" },
                        { key: "price", label: "Price" },
                      ] as const).map((s) => (
                        <button key={s.key} onClick={() => setMasterSort(s.key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${masterSort === s.key ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" : "text-gray-500 hover:text-gray-300"}`}
                        >{s.label}</button>
                      ))}
                    </div>
                    <span className="text-xs text-gray-500 font-mono">{masterResults.length} stocks with buy signals</span>
                  </div>

                  {/* Top Picks Banner */}
                  {masterResults.length >= 3 && !masterScanning && (
                    <div className="bg-gradient-to-r from-amber-500/5 to-red-500/5 border border-amber-500/15 rounded-xl p-4 mb-4">
                      <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3">Top Picks — Strongest Buy Confluence</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[...masterResults].sort((a, b) => b.buyCount - a.buyCount || b.avgStrength - a.avgStrength).slice(0, 3).map((r, i) => (
                          <div key={r.symbol} className="bg-white/[0.03] border border-white/5 rounded-lg p-3 hover:border-amber-500/20 transition-all cursor-pointer" onClick={() => { setActiveTab("search"); setSearchQuery(r.symbol); searchStock(r.symbol); }}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-amber-500/20 text-amber-400" : i === 1 ? "bg-gray-400/20 text-gray-300" : "bg-orange-900/20 text-orange-400"}`}>
                                {i + 1}
                              </span>
                              <div>
                                <div className="text-sm font-bold">{r.symbol}</div>
                                <div className="text-[10px] text-gray-500 truncate max-w-[150px]">{r.name}</div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-lg font-bold text-emerald-400">{r.buyCount}</div>
                                <div className="text-[9px] text-gray-500 uppercase">Buy Signals</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-mono">{currencySymbol}{r.price.toFixed(2)}</div>
                                <div className={`text-[11px] font-mono ${r.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {r.changePercent >= 0 ? "+" : ""}{r.changePercent.toFixed(2)}%
                                </div>
                              </div>
                              <div>
                                <StrengthBar strength={r.avgStrength} />
                                <div className="text-[9px] text-gray-500 mt-0.5 text-center">Str: {r.avgStrength}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full Leaderboard */}
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[40px_1fr_90px_80px_60px_60px_60px_80px_60px] gap-2 px-4 py-2.5 border-b border-white/5 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      <div>#</div><div>Stock</div><div className="text-right">Price</div><div className="text-right">Change</div><div className="text-center">Buy</div><div className="text-center">Sell</div><div className="text-center">Str</div><div className="text-center">Signal Bar</div><div></div>
                    </div>
                    {[...masterResults].sort((a, b) => {
                      switch (masterSort) {
                        case "strength": return b.avgStrength - a.avgStrength;
                        case "change": return b.changePercent - a.changePercent;
                        case "price": return b.price - a.price;
                        default: return b.buyCount - a.buyCount || b.avgStrength - a.avgStrength;
                      }
                    }).map((r, idx) => (
                      <div key={r.symbol}>
                        <div
                          className={`grid grid-cols-[40px_1fr_90px_80px_60px_60px_60px_80px_60px] gap-2 px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors items-center cursor-pointer ${expandedMaster === r.symbol ? "bg-white/[0.03]" : ""}`}
                          onClick={() => setExpandedMaster(expandedMaster === r.symbol ? null : r.symbol)}
                        >
                          <div className={`text-sm font-bold ${idx < 3 ? "text-amber-400" : idx < 10 ? "text-gray-300" : "text-gray-500"}`}>{idx + 1}</div>
                          <div>
                            <span className="text-sm font-semibold">{r.symbol}</span>
                            <div className="text-[10px] text-gray-500 truncate max-w-[160px]">{r.name}</div>
                          </div>
                          <div className="text-right text-sm font-mono">{currencySymbol}{r.price.toFixed(2)}</div>
                          <div className={`text-right text-sm font-mono ${r.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {r.changePercent >= 0 ? "+" : ""}{r.changePercent.toFixed(2)}%
                          </div>
                          <div className="text-center">
                            <span className="text-emerald-400 font-bold text-base">{r.buyCount}</span>
                          </div>
                          <div className="text-center">
                            <span className="text-red-400 font-semibold text-sm">{r.sellCount}</span>
                          </div>
                          <div className="text-center">
                            <span className="text-gray-300 text-sm font-mono">{r.avgStrength}</span>
                          </div>
                          <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden flex">
                            <div className="bg-emerald-500 h-full" style={{ width: `${(r.buyCount / r.totalStrategies) * 100}%` }} />
                            <div className="bg-red-500 h-full" style={{ width: `${(r.sellCount / r.totalStrategies) * 100}%` }} />
                          </div>
                          <div className="text-right">
                            <svg className={`w-4 h-4 text-gray-400 transition-transform inline ${expandedMaster === r.symbol ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {/* Expanded row */}
                        {expandedMaster === r.symbol && (
                          <div className="border-b border-white/[0.03] bg-white/[0.01] p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <button
                                onClick={() => { setActiveTab("search"); setSearchQuery(r.symbol); searchStock(r.symbol); }}
                                className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
                              >
                                Full {STRATEGIES.length}-Strategy Analysis
                              </button>
                              <button
                                onClick={() => setMasterChartStock(masterChartStock === r.symbol ? null : r.symbol)}
                                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/10 transition-colors"
                              >
                                {masterChartStock === r.symbol ? "Hide Chart" : "Show Chart"}
                              </button>
                              <span className="text-xs text-gray-500 ml-2">
                                {r.buyCount} buy + {r.sellCount} sell + {r.neutralCount} neutral = {r.totalStrategies} total
                              </span>
                            </div>

                            {masterChartStock === r.symbol && (
                              <div className="rounded-lg overflow-hidden border border-white/5 mb-3">
                                <CandlestickChart symbol={r.symbol} market={market} />
                              </div>
                            )}

                            {r.buyStrategies && r.buyStrategies.length > 0 && (
                              <div className="mb-3">
                                <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Buy Signals ({r.buyStrategies.length})</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {r.buyStrategies.map((s) => (
                                    <div key={s.id} className="flex items-center justify-between bg-emerald-500/5 rounded-lg px-3 py-2">
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <span className="text-sm font-medium truncate">{s.name}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border flex-shrink-0 ${CATEGORY_COLORS[s.category] || ""}`}>{s.category}</span>
                                      </div>
                                      <span className="text-xs text-emerald-400 font-mono font-semibold ml-2 flex-shrink-0">({s.strength})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {r.sellStrategies && r.sellStrategies.length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Sell Signals ({r.sellStrategies.length})</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {r.sellStrategies.map((s) => (
                                    <div key={s.id} className="flex items-center justify-between bg-red-500/5 rounded-lg px-3 py-2">
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <span className="text-sm font-medium truncate">{s.name}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border flex-shrink-0 ${CATEGORY_COLORS[s.category] || ""}`}>{s.category}</span>
                                      </div>
                                      <span className="text-xs text-red-400 font-mono font-semibold ml-2 flex-shrink-0">({s.strength})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!masterScanning && masterResults.length === 0 && masterProgress.scanned === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <p className="text-sm text-gray-500 max-w-md">Click &quot;Master Scan All {universeLabel}&quot; to automatically scan every stock in {universeLabel} against all {STRATEGIES.length} strategies. Results fill in live, sorted by most buy signals. Takes 2-5 minutes.</p>
                </div>
              )}

              {!masterScanning && masterProgress.scanned > 0 && masterResults.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No stocks found with buy signals in {masterProgress.scanned} stocks scanned.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── SEARCH TAB ─── */}
        {activeTab === "search" && (
          <div className="max-w-3xl mx-auto">
            <div className="relative mb-6">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchStock(searchQuery)}
                    placeholder="Enter stock symbol (e.g., RELIANCE, TCS, INFY)"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all placeholder:text-gray-600" />
                </div>
                <button onClick={() => searchStock(searchQuery)} disabled={searchLoading}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                  {searchLoading ? "..." : "Search"}
                </button>
              </div>
            </div>

            {searchLoading && <div className="space-y-3"><div className="skeleton h-32 w-full" /><div className="skeleton h-20 w-full" /><div className="skeleton h-20 w-full" /></div>}

            {stockDetail && (
              <div className="space-y-4">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
                  <div className="flex items-start justify-between">
                    <div><h2 className="text-2xl font-bold">{stockDetail.quote.symbol}</h2><p className="text-sm text-gray-400">{stockDetail.quote.name}</p></div>
                    <div className="text-right">
                      <div className="text-2xl font-bold font-mono">{currencySymbol}{stockDetail.quote.price.toFixed(2)}</div>
                      <div className={`text-sm font-mono ${stockDetail.quote.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>{stockDetail.quote.change >= 0 ? "+" : ""}{stockDetail.quote.change.toFixed(2)} ({stockDetail.quote.changePercent.toFixed(2)}%)</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                    {[{ label: "Volume", value: formatNumber(stockDetail.quote.volume, market) }, { label: "Market Cap", value: currencySymbol +formatNumber(stockDetail.quote.marketCap, market) }, { label: "52W High", value: currencySymbol +stockDetail.quote.high52w.toFixed(2) }, { label: "52W Low", value: currencySymbol +stockDetail.quote.low52w.toFixed(2) }].map((item) => (
                      <div key={item.label} className="bg-white/[0.03] rounded-lg p-3">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{item.label}</div>
                        <div className="text-sm font-semibold font-mono">{item.value}</div>
                      </div>
                    ))}
                  </div>
                  {stockDetail.quote.pe && <div className="mt-3 text-xs text-gray-500">P/E Ratio: {stockDetail.quote.pe.toFixed(2)}</div>}
                </div>

                {/* Chart for searched stock */}
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Price Chart</h3>
                  <div className="rounded-lg overflow-hidden border border-white/5">
                    <CandlestickChart symbol={stockDetail.quote.symbol} market={market} />
                  </div>
                </div>

                {/* Summary bar */}
                {stockDetail.strategyResults && (() => {
                  const buys = stockDetail.strategyResults.filter((s) => s.signal === "BUY").length;
                  const sells = stockDetail.strategyResults.filter((s) => s.signal === "SELL").length;
                  const neutrals = stockDetail.strategyResults.length - buys - sells;
                  const total = stockDetail.strategyResults.length || STRATEGIES.length;
                  return (
                    <div className="flex items-center gap-4 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                      <div className="text-sm font-medium text-gray-400">Signal Summary:</div>
                      <div className="flex items-center gap-1.5"><span className="text-emerald-400 font-bold text-lg">{buys}</span><span className="text-xs text-gray-500">BUY</span></div>
                      <div className="flex items-center gap-1.5"><span className="text-red-400 font-bold text-lg">{sells}</span><span className="text-xs text-gray-500">SELL</span></div>
                      <div className="flex items-center gap-1.5"><span className="text-gray-400 font-bold text-lg">{neutrals}</span><span className="text-xs text-gray-500">NEUTRAL</span></div>
                      <div className="flex-1" />
                      <div className="w-40 h-3 bg-white/5 rounded-full overflow-hidden flex">
                        <div className="bg-emerald-500 h-full" style={{ width: `${(buys / total) * 100}%` }} />
                        <div className="bg-red-500 h-full" style={{ width: `${(sells / total) * 100}%` }} />
                        <div className="bg-gray-600 h-full" style={{ width: `${(neutrals / total) * 100}%` }} />
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">All {STRATEGIES.length} Strategy Signals</h3>
                  <div className="space-y-2">
                    {stockDetail.strategyResults.map((sr) => (
                      <div key={sr.id} className={`bg-white/[0.02] border rounded-xl p-4 transition-all ${sr.signal === "BUY" ? "border-emerald-500/20" : sr.signal === "SELL" ? "border-red-500/20" : "border-white/5"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-gray-500">Ch {sr.chapter}</span>
                            <h4 className="text-sm font-semibold">{sr.name}</h4>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${CATEGORY_COLORS[sr.category] || ""}`}>{sr.category}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <StrengthBar strength={sr.strength} />
                            <SignalBadge signal={sr.signal} strength={sr.strength} />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">{sr.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!searchLoading && !stockDetail && (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <h3 className="text-lg font-semibold mb-1">Search a Stock</h3>
                <p className="text-sm text-gray-500 max-w-sm">Enter any {universeLabel} symbol to see all {STRATEGIES.length} strategy signals at once</p>
              </div>
            )}
          </div>
        )}

        {/* ─── LEARN TAB ─── */}
        {activeTab === "learn" && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold">Learn Trading</h2>
              <p className="text-sm text-gray-500 mt-1">Master every indicator, strategy, and concept used in this screener. With live chart examples.</p>
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
                {([
                  { key: "indicators" as const, label: "Indicators", count: TUTORIAL_INDICATORS.length },
                  { key: "concepts" as const, label: "Concepts", count: TUTORIAL_CONCEPTS.length },
                  { key: "strategies" as const, label: "Strategies", count: STRATEGIES.length },
                ]).map((t) => (
                  <button key={t.key} onClick={() => { setLearnTab(t.key); setExpandedLearn(null); }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${learnTab === t.key ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
                  >{t.label} ({t.count})</button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                {(["All", "Beginner", "Intermediate", "Advanced"] as const).map((d) => (
                  <button key={d} onClick={() => setLearnDifficulty(d)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${learnDifficulty === d ? "bg-white/10 text-white border-white/20" : "border-white/5 text-gray-500 hover:text-gray-300"}`}
                  >{d === "Beginner" ? "Beginner" : d === "Intermediate" ? "Intermediate" : d === "Advanced" ? "Advanced" : "All Levels"}</button>
                ))}
              </div>
            </div>

            {/* ── INDICATORS TUTORIALS ── */}
            {learnTab === "indicators" && (
              <div className="space-y-3">
                {TUTORIAL_INDICATORS
                  .filter(t => learnDifficulty === "All" || t.difficulty === learnDifficulty)
                  .map((tutorial) => {
                  const isExp = expandedLearn === tutorial.id;
                  const diffColor = tutorial.difficulty === "Beginner" ? "bg-emerald-500/15 text-emerald-400" : tutorial.difficulty === "Intermediate" ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400";
                  const catColor = tutorial.category === "Trend" ? "bg-indigo-500/10 text-indigo-400" : tutorial.category === "Momentum" ? "bg-pink-500/10 text-pink-400" : tutorial.category === "Volume" ? "bg-cyan-500/10 text-cyan-400" : tutorial.category === "Volatility" ? "bg-orange-500/10 text-orange-400" : "bg-purple-500/10 text-purple-400";
                  return (
                    <div key={tutorial.id} className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-all">
                      <button onClick={() => setExpandedLearn(isExp ? null : tutorial.id)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.01] transition-colors">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-sm font-bold text-blue-400 flex-shrink-0">
                            {tutorial.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">{tutorial.name}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${diffColor}`}>{tutorial.difficulty}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${catColor}`}>{tutorial.category}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{tutorial.shortDesc}</p>
                          </div>
                        </div>
                        <svg className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${isExp ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>

                      {isExp && (
                        <div className="border-t border-white/5 p-5 space-y-5">
                          {/* Formula */}
                          <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-500/10 rounded-lg p-4">
                            <div className="text-[10px] text-blue-400 uppercase tracking-wider font-bold mb-1.5">Formula</div>
                            <code className="text-sm text-gray-200 font-mono leading-relaxed">{tutorial.formula}</code>
                          </div>

                          {/* How to Read */}
                          <div>
                            <div className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">How to Interpret</div>
                            <div className="space-y-1.5">
                              {tutorial.interpretation.map((line, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <span className="text-blue-400 text-xs mt-0.5 flex-shrink-0">{i + 1}.</span>
                                  <p className="text-[13px] text-gray-300 leading-relaxed">{line}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Buy & Sell Signals */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-3">
                              <div className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold mb-1">Buy Signal</div>
                              <p className="text-[13px] text-gray-300 leading-relaxed">{tutorial.buySignal}</p>
                            </div>
                            <div className="bg-red-500/5 border border-red-500/15 rounded-lg p-3">
                              <div className="text-[10px] text-red-400 uppercase tracking-wider font-bold mb-1">Sell Signal</div>
                              <p className="text-[13px] text-gray-300 leading-relaxed">{tutorial.sellSignal}</p>
                            </div>
                          </div>

                          {/* Best For & Limitations */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="bg-white/[0.03] rounded-lg p-3">
                              <div className="text-[10px] text-cyan-400 uppercase tracking-wider font-bold mb-1">Best Used For</div>
                              <p className="text-[13px] text-gray-300 leading-relaxed">{tutorial.bestFor}</p>
                            </div>
                            <div className="bg-white/[0.03] rounded-lg p-3">
                              <div className="text-[10px] text-amber-400 uppercase tracking-wider font-bold mb-1">Limitations</div>
                              <p className="text-[13px] text-gray-300 leading-relaxed">{tutorial.limitations}</p>
                            </div>
                          </div>

                          {/* Pro Tip */}
                          <div className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/15 rounded-lg p-4">
                            <div className="text-[10px] text-amber-400 uppercase tracking-wider font-bold mb-1">Pro Tip</div>
                            <p className="text-[13px] text-gray-200 leading-relaxed">{tutorial.proTip}</p>
                          </div>

                          {/* Live Chart Example */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-xs font-bold text-gray-300 uppercase tracking-wider">Live Example: {tutorial.exampleStock}</div>
                              <button
                                onClick={() => setLearnChartStock(learnChartStock === tutorial.id ? null : tutorial.id)}
                                className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
                              >
                                {learnChartStock === tutorial.id ? "Hide Chart" : "Show Live Chart"}
                              </button>
                            </div>
                            {learnChartStock === tutorial.id && (
                              <div className="rounded-lg overflow-hidden border border-white/5">
                                <CandlestickChart symbol={tutorial.exampleStock} indicators={tutorial.exampleIndicators} />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── CONCEPTS TUTORIALS ── */}
            {learnTab === "concepts" && (
              <div className="space-y-3">
                {TUTORIAL_CONCEPTS
                  .filter(t => learnDifficulty === "All" || t.difficulty === learnDifficulty)
                  .map((concept) => {
                  const isExp = expandedLearn === concept.id;
                  const diffColor = concept.difficulty === "Beginner" ? "bg-emerald-500/15 text-emerald-400" : concept.difficulty === "Intermediate" ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400";
                  const catColor = concept.category === "Basics" ? "bg-blue-500/10 text-blue-400" : concept.category === "Technical" ? "bg-indigo-500/10 text-indigo-400" : concept.category === "Psychology" ? "bg-pink-500/10 text-pink-400" : concept.category === "Risk" ? "bg-red-500/10 text-red-400" : "bg-teal-500/10 text-teal-400";
                  return (
                    <div key={concept.id} className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-all">
                      <button onClick={() => setExpandedLearn(isExp ? null : concept.id)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.01] transition-colors">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center text-sm font-bold text-teal-400 flex-shrink-0">
                            {concept.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">{concept.name}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${diffColor}`}>{concept.difficulty}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${catColor}`}>{concept.category}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{concept.shortDesc}</p>
                          </div>
                        </div>
                        <svg className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${isExp ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>

                      {isExp && (
                        <div className="border-t border-white/5 p-5 space-y-5">
                          {/* Explanation */}
                          <div>
                            <div className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Detailed Explanation</div>
                            <div className="space-y-2">
                              {concept.explanation.map((line, i) => (
                                <p key={i} className="text-[13px] text-gray-300 leading-relaxed pl-4 border-l-2 border-white/10">{line}</p>
                              ))}
                            </div>
                          </div>

                          {/* Key Points */}
                          <div className="bg-white/[0.03] rounded-lg p-4">
                            <div className="text-[10px] text-cyan-400 uppercase tracking-wider font-bold mb-2">Key Points to Remember</div>
                            <div className="space-y-1.5">
                              {concept.keyPoints.map((point, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <span className="text-cyan-400 mt-0.5">+</span>
                                  <p className="text-[13px] text-gray-300">{point}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Common Mistakes */}
                          <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-4">
                            <div className="text-[10px] text-red-400 uppercase tracking-wider font-bold mb-2">Common Mistakes to Avoid</div>
                            <div className="space-y-1.5">
                              {concept.commonMistakes.map((mistake, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <span className="text-red-400 mt-0.5">x</span>
                                  <p className="text-[13px] text-gray-300">{mistake}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Real World Example */}
                          <div className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/15 rounded-lg p-4">
                            <div className="text-[10px] text-amber-400 uppercase tracking-wider font-bold mb-1">Real-World Example</div>
                            <p className="text-[13px] text-gray-200 leading-relaxed">{concept.realExample}</p>
                          </div>

                          {/* Related */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-gray-500 uppercase">Related:</span>
                            {concept.relatedConcepts.map((rc) => (
                              <span key={rc} className="px-2 py-0.5 bg-white/5 rounded text-xs text-gray-400">{rc}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── STRATEGIES REFERENCE ── */}
            {learnTab === "strategies" && (
              <div>
                <p className="text-sm text-gray-500 mb-4">All {STRATEGIES.length} strategies in this screener, organized by source book. Click any strategy name to scan stocks with it.</p>
                {BOOKS.filter(b => b !== "All Books").map((book) => {
                  const bookStrategies = STRATEGIES.filter(s => s.book === book);
                  if (bookStrategies.length === 0) return null;
                  return (
                    <div key={book} className="mb-6">
                      <h3 className="text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        {book} <span className="text-gray-500 font-normal">({bookStrategies.length} strategies)</span>
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {bookStrategies.map((s) => (
                          <button key={s.id}
                            onClick={() => { setActiveTab("strategies"); handleSelectStrategy(s); }}
                            className="bg-white/[0.02] border border-white/5 rounded-lg p-3 text-left hover:bg-white/[0.04] hover:border-white/10 transition-all group"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-mono text-gray-500">Ch {s.chapter}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${CATEGORY_COLORS[s.category] || ""}`}>{s.category}</span>
                            </div>
                            <div className="text-sm font-semibold group-hover:text-blue-400 transition-colors">{s.name}</div>
                            <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{s.description}</p>
                            <div className="flex items-center gap-1 mt-2">
                              {s.indicators.map((ind) => (
                                <span key={ind} className="px-1.5 py-0.5 bg-white/5 rounded text-[9px] text-gray-500">{ind}</span>
                              ))}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-white/5 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-gray-600">
          <span>Based on 6 classic books + OpenBB concepts &middot; {STRATEGIES.length} strategies</span>
          <span>Data: Yahoo Finance &middot; For educational purposes only</span>
        </div>
      </footer>
    </div>
  );
}
