@AGENTS.md

# StrategyScreener - Indian Market Stock Screener

## Project Overview
A Next.js (v16) stock screener for Indian markets (Nifty 500) that implements 100 trading strategies from 6 classic books + OpenBB-inspired signal concepts. Users can screen stocks by individual strategies, run multi-strategy scans, view interactive candlestick charts with technical indicators, analyze Sensex/Nifty 50 market overview with key levels, and monitor real-time buy/sell signals with market events.

## Tech Stack
- **Framework**: Next.js 16.2.3 (App Router, TypeScript, Tailwind CSS)
- **Charts**: lightweight-charts v5 (TradingView)
- **Data**: yahoo-finance2 (requires `new YahooFinance()` instantiation, NOT default import)
- **No database** - all analysis computed on-the-fly from Yahoo Finance API

## Key Architecture
- `src/lib/indicators.ts` - Technical indicator calculations (SMA, EMA, RSI, MACD, Bollinger, Supertrend, ATR, Williams %R, Volume Oscillator, Pivot Points, OBV, ADL, Stochastic, ADX, CCI, Aroon, MFI, Force Index, ROC)
- `src/lib/strategies.ts` - All 100 strategy evaluate functions. Each strategy has `book` field. Categories: Swing, Intraday, Advanced, Positional, Scalping, Options, Price Action, Value Investing, Candlestick, Trend Following, Index Investing
- `src/lib/nifty200.ts` - Exports `NIFTY_500_SYMBOLS` (name is legacy, contains ~500 symbols)
- `src/lib/stockData.ts` - Yahoo Finance wrapper (`new YahooFinance()` pattern)
- `src/app/api/chart/route.ts` - Chart data with timeframe support (1m, 5m, 15m, 1h, 1d, 1wk, 1mo). Accepts `?index=1` for index symbols like ^BSESN
- `src/app/api/market/route.ts` - Sensex/Nifty overview with pivots, fibonacci, support/resistance, targets
- `src/app/api/scan/route.ts` - Multi-strategy scan, returns all buy/sell strategies per stock
- `src/app/api/screener/route.ts` - Single strategy screener
- `src/app/api/global/route.ts` - Global market cues: 20+ world markets (US, Europe, Asia, commodities, FX, VIX), correlation insights, India prediction score
- `src/app/api/portfolio/route.ts` - Portfolio analysis: per-stock targets, support/resistance, pivot points, fibonacci, MAs, supertrend, 100-strategy signals, recommendation
- `src/app/api/signals/route.ts` - Market signals dashboard: 15+ buy/sell indicators, sentiment gauge, market events
- `src/app/api/stocks/route.ts` - Individual stock lookup with all 100 strategy signals
- `src/components/CandlestickChart.tsx` - Reusable chart with timeframe tabs, indicator toggles, tooltips. Uses lightweight-charts v5 API (`chart.addSeries()`, `chart.addPane()`, `createSeriesMarkers()`)
- `src/components/MarketChart.tsx` - Market overview using CandlestickChart + key levels panels

## Sources Integrated (100 strategies total)
1. **51 Trading Strategies** by Aseem Singhal (51 strategies)
2. **The Intelligent Investor** by Benjamin Graham (5 strategies)
3. **Technical Analysis of Financial Markets** by John Murphy (10 strategies)
4. **Japanese Candlestick Charting Techniques** by Steve Nison (9 strategies)
5. **The Little Book of Common Sense Investing** by John Bogle (3 strategies)
6. **Market Wizards** by Jack Schwager (5 strategies)
7. **OpenBB Signal Concepts** - Inspired by OpenBB platform (17 strategies: OBV, ADL, ADX, CCI, Aroon, MFI, Force Index, Golden/Death Cross, Institutional Accumulation, Relative Strength, Fear/Greed, Gap & Go, Stochastic, Multi-Indicator Confluence, Volatility Squeeze, RSI-MACD Divergence, Market Regime Detector)

## Important Notes
- lightweight-charts v5 breaking changes: use `chart.addSeries(CandlestickSeries, opts)` not `chart.addCandlestickSeries(opts)`. Use `chart.addPane()` for sub-charts. Use `createSeriesMarkers()` not `series.setMarkers()`. Cast times to `UTCTimestamp`.
- yahoo-finance2 v3+: must instantiate `new YahooFinance()`, not use default export directly
- `suppressHydrationWarning` on `<body>` in layout.tsx to handle browser extension attribute injection
- The `NIFTY_500_SYMBOLS` export is in a file still named `nifty200.ts` (legacy name)
- Strategy results on the frontend are client-side rendered, so won't appear in SSR HTML

## UI Tabs
1. **Market** - Sensex/Nifty 50 candlestick chart with key levels, targets, supports, fibonacci
2. **Global** - World markets dashboard: S&P 500, Nasdaq, Dow, Nikkei, Hang Seng, FTSE, DAX, crude oil, gold, USD/INR, VIX, US 10Y yields. India prediction gauge (0-100) with weighted factor analysis. Correlation insights explaining how each global move impacts Indian equities.
3. **Signals** - Market signals dashboard with sentiment gauge (0-100), 15+ buy/sell indicators (trend/momentum/volume/volatility/breadth), and market events (gaps, crosses, extremes, volume anomalies)
4. **Portfolio** - Add holdings with buy price & quantity (localStorage). Shows P&L, targets (3 ATR-based), stop loss, dynamic support/resistance, pivot points, fibonacci retracement, moving averages (EMA 9/21, SMA 20/50/100/200), supertrend, top 5 buy/sell signals, recommendation (Strong Buy/Buy/Hold/Sell/Strong Sell), per-stock chart
5. **Strategies** - Browse 100 strategies by book/category, run individual scans with chart expansion
6. **Multi-Scan** - Scan stocks for multi-strategy buy confluence, sort by price/change/strength/buy count, share list
7. **Lookup** - Search any stock to see all 100 strategy signals with chart
