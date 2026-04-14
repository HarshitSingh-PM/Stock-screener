import { NextRequest, NextResponse } from "next/server";
import { getHistoricalData, getStockQuote } from "@/lib/stockData";
import { STRATEGIES } from "@/lib/strategies";
import { NIFTY_500_SYMBOLS } from "@/lib/nifty200";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const strategyId = searchParams.get("strategy");
  const signalFilter = searchParams.get("signal"); // BUY, SELL, or ALL
  const limit = parseInt(searchParams.get("limit") || "30");
  const offset = parseInt(searchParams.get("offset") || "0");

  if (!strategyId) {
    return NextResponse.json({ error: "strategy parameter required" }, { status: 400 });
  }

  const strategy = STRATEGIES.find((s) => s.id === strategyId);
  if (!strategy) {
    return NextResponse.json({ error: "Unknown strategy" }, { status: 400 });
  }

  const symbols = NIFTY_500_SYMBOLS.slice(offset, offset + limit);
  const results: any[] = [];

  // Process stocks in parallel batches
  const batchSize = 5;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const promises = batch.map(async (symbol) => {
      try {
        const [candles, quote] = await Promise.all([
          getHistoricalData(symbol, 120),
          getStockQuote(symbol),
        ]);

        if (candles.length < 20 || !quote) return null;

        const result = strategy.evaluate(candles);

        if (signalFilter && signalFilter !== "ALL" && result.signal !== signalFilter) {
          return null;
        }

        return {
          symbol,
          name: quote.name,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume,
          marketCap: quote.marketCap,
          signal: result.signal,
          strength: result.strength,
          details: result.details,
        };
      } catch {
        return null;
      }
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter((r) => r !== null));
  }

  // Sort by strength descending
  results.sort((a, b) => b.strength - a.strength);

  return NextResponse.json({
    strategy: {
      id: strategy.id,
      name: strategy.name,
      chapter: strategy.chapter,
      category: strategy.category,
      description: strategy.description,
      indicators: strategy.indicators,
    },
    results,
    total: NIFTY_500_SYMBOLS.length,
    scanned: symbols.length,
  });
}
