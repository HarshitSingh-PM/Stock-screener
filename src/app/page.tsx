"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";

import { BACKTEST_CACHE } from "@/lib/backtestCache";

const CandlestickChart = dynamic(() => import("@/components/CandlestickChart"), { ssr: false });
const MarketChart = dynamic(() => import("@/components/MarketChart"), { ssr: false });

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
];

function formatNumber(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e7) return (n / 1e7).toFixed(2) + "Cr";
  if (n >= 1e5) return (n / 1e5).toFixed(2) + "L";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(2);
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
  const [activeTab, setActiveTab] = useState<"market" | "strategies" | "scan" | "search">("market");
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

  // Stock search
  const [searchQuery, setSearchQuery] = useState("");
  const [stockDetail, setStockDetail] = useState<StockDetail | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const runScreener = useCallback(async (strategy: StrategyInfo, signal: string, offset = 0) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/screener?strategy=${strategy.id}&signal=${signal}&limit=30&offset=${offset}`);
      const data = await res.json();
      if (offset === 0) setResults(data.results);
      else setResults((prev) => [...prev, ...data.results]);
      setScannedInfo({ scanned: (offset || 0) + data.scanned, total: data.total });
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const runScan = useCallback(async (offset = 0) => {
    setScanLoading(true);
    try {
      const res = await fetch(`/api/scan?limit=30&offset=${offset}&minBuy=2`);
      const data = await res.json();
      if (offset === 0) setScanResults(data.results);
      else setScanResults((prev) => [...prev, ...data.results]);
      setScanInfo({ scanned: data.scanned, total: data.total });
    } catch { /* ignore */ }
    setScanLoading(false);
  }, []);

  const searchStock = useCallback(async (symbol: string) => {
    if (!symbol.trim()) return;
    setSearchLoading(true);
    setStockDetail(null);
    try {
      const res = await fetch(`/api/stocks?symbol=${symbol.trim().toUpperCase()}`);
      if (res.ok) setStockDetail(await res.json());
    } catch { /* ignore */ }
    setSearchLoading(false);
  }, []);

  const handleSelectStrategy = (s: StrategyInfo) => {
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
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-sm">SS</div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">StrategyScreener</h1>
              <p className="text-[10px] text-gray-500 -mt-0.5">Nifty 500 &middot; 83 Strategies from 6 Classic Books</p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            {(["market", "strategies", "scan", "search"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
              >
                {tab === "market" ? "Market" : tab === "strategies" ? "Strategies" : tab === "scan" ? "Multi-Scan" : "Lookup"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {/* ─── MARKET TAB ─── */}
        {activeTab === "market" && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold">Market Overview</h2>
              <p className="text-sm text-gray-500 mt-1">Sensex & Nifty 50 with key levels, targets, supports and resistances</p>
            </div>
            <MarketChart />
          </div>
        )}

        {/* ─── STRATEGIES TAB ─── */}
        {activeTab === "strategies" && (
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
                  <p className="text-sm text-gray-500 max-w-sm">Choose from {STRATEGIES.length} strategies to scan Nifty 500 stocks</p>
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
                              Run detailed backtest on Nifty 50 + 5 major stocks over 1 year. Shows per-stock breakdown and individual trade history. Entry on signal with strength &ge;25, hold 10 trading days. Peak = best return during hold. Drawdown = worst dip.
                            </span>
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setBacktestLoading(true);
                            setBacktestData(null);
                            fetch(`/api/backtest?strategy=${selectedStrategy.id}`)
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
                          <Spinner /> Backtesting on Nifty 50 + 5 major stocks over 1 year...
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
                                  <div className="text-[10px] text-gray-500">NIFTY 50</div>
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
                                Trade History (Nifty 50) &mdash; {backtestData.primary.trades.length} trades
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
                              `${i + 1}. ${r.symbol} ₹${r.price.toFixed(2)} (${r.changePercent >= 0 ? "+" : ""}${r.changePercent.toFixed(2)}%) — ${r.signal} [${r.strength}] ${r.details}`
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
                    Scan Nifty 500
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
                        `${i + 1}. ${r.symbol} (₹${r.price.toFixed(2)}) ${r.changePercent >= 0 ? "+" : ""}${r.changePercent.toFixed(2)}% | BUY: ${r.buyCount}/${r.totalStrategies} | Avg Strength: ${r.avgStrength}${r.buyStrategies ? "\n   Top: " + r.buyStrategies.slice(0, 3).map(s => s.name).join(", ") : ""}`
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
                          <div className="text-sm font-mono font-semibold">₹{r.price.toFixed(2)}</div>
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
                <p className="text-sm text-gray-500 max-w-md">Click &quot;Scan Nifty 500&quot; to find stocks that have BUY signals on 2 or more strategies simultaneously. Stocks with the most buy confirmations appear first.</p>
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
                      <div className="text-2xl font-bold font-mono">₹{stockDetail.quote.price.toFixed(2)}</div>
                      <div className={`text-sm font-mono ${stockDetail.quote.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>{stockDetail.quote.change >= 0 ? "+" : ""}{stockDetail.quote.change.toFixed(2)} ({stockDetail.quote.changePercent.toFixed(2)}%)</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                    {[{ label: "Volume", value: formatNumber(stockDetail.quote.volume) }, { label: "Market Cap", value: "₹" + formatNumber(stockDetail.quote.marketCap) }, { label: "52W High", value: "₹" + stockDetail.quote.high52w.toFixed(2) }, { label: "52W Low", value: "₹" + stockDetail.quote.low52w.toFixed(2) }].map((item) => (
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
                    <CandlestickChart symbol={stockDetail.quote.symbol} />
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
                <p className="text-sm text-gray-500 max-w-sm">Enter any Nifty 500 symbol to see all {STRATEGIES.length} strategy signals at once</p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-white/5 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-gray-600">
          <span>Based on 6 classic trading books &middot; {STRATEGIES.length} strategies</span>
          <span>Data: Yahoo Finance &middot; For educational purposes only</span>
        </div>
      </footer>
    </div>
  );
}
