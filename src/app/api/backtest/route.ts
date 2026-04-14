import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { STRATEGIES } from "@/lib/strategies";
import { backtestStrategy } from "@/lib/backtest";

const yahooFinance = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey"] });

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const strategyId = searchParams.get("strategy");
  // Use a major Nifty stock for backtesting; default to NIFTY 50 index
  const symbol = searchParams.get("symbol") || "^NSEI";
  const holdDays = parseInt(searchParams.get("hold") || "10");

  if (!strategyId) {
    return NextResponse.json({ error: "strategy parameter required" }, { status: 400 });
  }

  const strategy = STRATEGIES.find((s) => s.id === strategyId);
  if (!strategy) {
    return NextResponse.json({ error: "Unknown strategy" }, { status: 400 });
  }

  try {
    // Fetch 1 year + 100 extra days for lookback
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 465);

    const isIndex = symbol.startsWith("^");
    const yahooSymbol = isIndex ? symbol : `${symbol}.NS`;

    const result: any = await yahooFinance.chart(yahooSymbol, {
      period1: startDate,
      period2: endDate,
      interval: "1d",
    });

    if (!result?.quotes || result.quotes.length < 100) {
      return NextResponse.json({ error: "Insufficient data for backtest" }, { status: 400 });
    }

    const candles = result.quotes
      .filter((q: any) => q.open != null && q.high != null && q.low != null && q.close != null && q.volume != null)
      .map((q: any) => ({
        date: new Date(q.date),
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume,
      }));

    const bt = backtestStrategy(strategy, candles, {
      lookback: 80,
      holdDays,
      minStrength: 25,
    });

    // Also backtest on a few major stocks for cross-validation
    const crossSymbols = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS"];
    const crossResults = await Promise.all(
      crossSymbols.map(async (sym) => {
        try {
          const r: any = await yahooFinance.chart(sym, {
            period1: startDate,
            period2: endDate,
            interval: "1d",
          });
          if (!r?.quotes || r.quotes.length < 100) return null;
          const c = r.quotes
            .filter((q: any) => q.open != null && q.high != null && q.low != null && q.close != null && q.volume != null)
            .map((q: any) => ({
              date: new Date(q.date),
              open: q.open,
              high: q.high,
              low: q.low,
              close: q.close,
              volume: q.volume,
            }));
          return backtestStrategy(strategy, c, { lookback: 80, holdDays, minStrength: 25 });
        } catch {
          return null;
        }
      })
    );

    const validCross = crossResults.filter((r): r is NonNullable<typeof r> => r !== null && r.totalSignals > 0);

    // Aggregate across all stocks
    const allTrades = [
      ...bt.trades,
      ...validCross.flatMap((r) => r.trades),
    ];

    const aggWins = allTrades.filter((t) => t.won).length;
    const aggTotal = allTrades.length;
    const aggWinRate = aggTotal > 0 ? (aggWins / aggTotal) * 100 : 0;
    const aggAvgReturn = aggTotal > 0 ? allTrades.reduce((s, t) => s + t.pnlPercent, 0) / aggTotal : 0;
    const aggTotalReturn = allTrades.reduce((s, t) => s + t.pnlPercent, 0);

    return NextResponse.json({
      strategy: {
        id: strategy.id,
        name: strategy.name,
        chapter: strategy.chapter,
        book: strategy.book,
      },
      primary: {
        symbol: isIndex ? symbol : symbol,
        totalSignals: bt.totalSignals,
        wins: bt.wins,
        losses: bt.losses,
        winRate: Math.round(bt.winRate * 10) / 10,
        avgReturn: Math.round(bt.avgReturn * 100) / 100,
        totalReturn: Math.round(bt.totalReturn * 100) / 100,
        maxWin: Math.round(bt.maxWin * 100) / 100,
        maxLoss: Math.round(bt.maxLoss * 100) / 100,
        avgDaysToProfit: Math.round(bt.avgDaysToProfit * 10) / 10,
        avgDaysToPeak: Math.round(bt.avgDaysToPeak * 10) / 10,
        trades: bt.trades.map((t) => ({
          entryDate: t.entryDate.toISOString().split("T")[0],
          exitDate: t.exitDate.toISOString().split("T")[0],
          signal: t.signal,
          entryPrice: Math.round(t.entryPrice * 100) / 100,
          exitPrice: Math.round(t.exitPrice * 100) / 100,
          pnlPercent: Math.round(t.pnlPercent * 100) / 100,
          won: t.won,
          peakReturn: Math.round(t.peakReturn * 100) / 100,
          peakDay: t.peakDay,
          drawdown: Math.round(t.drawdown * 100) / 100,
        })),
      },
      crossValidation: validCross.map((r) => ({
        symbol: crossSymbols[crossResults.indexOf(r)].replace(".NS", ""),
        totalSignals: r.totalSignals,
        wins: r.wins,
        losses: r.losses,
        winRate: Math.round(r.winRate * 10) / 10,
        avgReturn: Math.round(r.avgReturn * 100) / 100,
        avgDaysToPeak: Math.round(r.avgDaysToPeak * 10) / 10,
      })),
      aggregate: {
        totalTrades: aggTotal,
        wins: aggWins,
        losses: aggTotal - aggWins,
        winRate: Math.round(aggWinRate * 10) / 10,
        avgReturn: Math.round(aggAvgReturn * 100) / 100,
        totalReturn: Math.round(aggTotalReturn * 100) / 100,
        avgDaysToPeak: aggTotal > 0 ? Math.round((allTrades.reduce((s, t) => s + t.peakDay, 0) / aggTotal) * 10) / 10 : 0,
        avgPeakReturn: aggTotal > 0 ? Math.round((allTrades.reduce((s, t) => s + t.peakReturn, 0) / aggTotal) * 100) / 100 : 0,
        avgDrawdown: aggTotal > 0 ? Math.round((allTrades.reduce((s, t) => s + t.drawdown, 0) / aggTotal) * 100) / 100 : 0,
      },
      holdDays,
    });
  } catch (e) {
    return NextResponse.json({ error: "Backtest failed" }, { status: 500 });
  }
}
