# StrategyScreener

**An Indian market stock screener powered by 83 trading strategies from 6 classic books.**

Screen Nifty 500 stocks using strategies from The Intelligent Investor, Technical Analysis of the Financial Markets, Japanese Candlestick Charting Techniques, Market Wizards, and more. Every strategy is backtested with 1-year historical data showing win rates, time-to-profit, and risk-reward ratios.

---

## Features

### Market Overview
- Live **Sensex & Nifty 50** candlestick charts with 1-year data
- Auto-calculated **key levels**: pivot points (S1, S2, R1, R2), support/resistance zones, ATR-based targets, and Fibonacci retracement levels (23.6% through 78.6%)
- **7 timeframes**: 1-minute, 5-minute, 15-minute, hourly, daily, weekly, monthly
- Toggle overlays: SMA 20/50/200, EMA 9/21, Bollinger Bands, RSI, MACD, Supertrend

### 83 Strategies from 6 Books

| Book | Author | Strategies | Categories |
|------|--------|-----------|-----------|
| **51 Trading Strategies** | Aseem Singhal | 51 | Swing, Intraday, Advanced, Positional, Scalping, Options, Price Action |
| **The Intelligent Investor** | Benjamin Graham | 5 | Value Investing |
| **Technical Analysis of the Financial Markets** | John Murphy | 10 | Trend Following |
| **Japanese Candlestick Charting Techniques** | Steve Nison | 9 | Candlestick Patterns |
| **The Little Book of Common Sense Investing** | John Bogle | 3 | Index Investing |
| **Market Wizards** | Jack Schwager | 5 | Trend Following |

### Strategy Screener
- Browse all 83 strategies organized by **book** and **category**
- Select any strategy to scan Nifty 500 stocks for BUY/SELL/NEUTRAL signals
- Each strategy card shows **pre-loaded backtest results**: win rate, total trades, peak return, time to peak, drawdown
- Click any stock to expand an **interactive candlestick chart** with the strategy's relevant indicators pre-selected and signal annotation

### Multi-Strategy Scanner
- One-click scan to find stocks with **BUY signals across multiple strategies simultaneously**
- View **all** buy and sell signals per stock (not just top 5)
- Click any strategy to jump directly to its screener page
- **Sort** results by buy count, price, % change, or strength
- **Share** formatted results list to clipboard

### Stock Lookup
- Search any Nifty 500 stock to see all 83 strategy signals at once
- Signal summary bar showing BUY/SELL/NEUTRAL distribution
- Full candlestick chart with all timeframes and indicators

### Backtesting
- Every strategy has **pre-computed 1-year backtest results** (cached, loads instantly)
- Backtested on **Nifty 50 index + 5 major stocks** (Reliance, TCS, HDFC Bank, Infosys, ICICI Bank)
- Metrics: win rate, total/avg return, avg days to peak return, peak return, drawdown, risk-reward ratio
- Run **detailed backtest** on-demand for per-stock breakdown and full trade history

### Top Performing Strategies (by Backtest)

| Strategy | Book | Win Rate | Peak Return | Days to Peak | Risk:Reward |
|----------|------|----------|------------|-------------|-------------|
| Double RSI | 51 Trading Strategies | 69.2% | +2.65% | 5.5 days | 1.58x |
| Smart Money Concept | 51 Trading Strategies | 62.9% | +2.26% | 6.2 days | 1.49x |
| Renko + RSI + Stochastic | 51 Trading Strategies | 63.6% | +2.54% | 6.0 days | 1.46x |
| Risk-Adjusted Entry | Market Wizards | 60.0% | +2.40% | 6.4 days | 1.27x |
| VWAP + Standard Deviations | 51 Trading Strategies | 57.7% | +2.50% | 5.6 days | 1.07x |
| RSI 70/30 Classic | Technical Analysis | 55.6% | +2.25% | 5.0 days | 1.14x |

### Interactive Charts
- **TradingView-quality** candlestick charts powered by lightweight-charts v5
- Volume bars, indicator overlays, RSI and MACD sub-panes
- Buy/Sell signal markers on charts
- **Hover tooltips** on every indicator and timeframe explaining the calculation methodology

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript, Tailwind CSS)
- **Charts**: [lightweight-charts](https://github.com/nickvdyck/lightweight-charts) v5 (TradingView)
- **Data**: Yahoo Finance (free, no API key required)
- **Indicators**: Custom implementation of SMA, EMA, RSI, MACD, Bollinger Bands, Supertrend, Williams %R, ATR, Stochastic, Ichimoku, Parabolic SAR, Donchian Channel, and more
- **No database** required - all analysis computed on-the-fly

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/HarshitSingh-PM/Stock-screener.git
cd Stock-screener
npm install
```

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build for production

```bash
npm run build
npm start
```

---

## Project Structure

```
src/
  app/
    page.tsx                    # Main UI (Market, Strategies, Multi-Scan, Lookup tabs)
    layout.tsx                  # Root layout
    api/
      chart/route.ts            # Chart data with multi-timeframe support
      market/route.ts           # Sensex/Nifty overview with key levels
      scan/route.ts             # Multi-strategy scanner
      screener/route.ts         # Single strategy screener
      stocks/route.ts           # Individual stock lookup
      backtest/route.ts         # On-demand detailed backtesting
  components/
    CandlestickChart.tsx        # Interactive chart with timeframes & indicators
    MarketChart.tsx             # Market overview with key levels panels
  lib/
    indicators.ts               # Technical indicator calculations
    strategies.ts               # All 83 strategy implementations
    backtest.ts                 # Backtesting engine
    backtestCache.ts            # Pre-computed backtest results
    stockData.ts                # Yahoo Finance data wrapper
    nifty200.ts                 # Nifty 500 stock symbols list
```

---

## Disclaimer

This tool is for **educational and research purposes only**. It is not financial advice. Trading in the stock market involves risk, and past performance (including backtest results) does not guarantee future results. Always do your own research and consult a qualified financial advisor before making investment decisions.

---

## License

MIT

---

Built with Next.js, TypeScript, and the wisdom of 6 classic trading books.
