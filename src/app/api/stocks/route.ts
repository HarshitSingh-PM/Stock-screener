import { NextRequest, NextResponse } from "next/server";
import { getStockQuote, getHistoricalData } from "@/lib/stockData";
import { STRATEGIES } from "@/lib/strategies";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json({ error: "symbol parameter required" }, { status: 400 });
  }

  try {
    const [quote, candles] = await Promise.all([
      getStockQuote(symbol),
      getHistoricalData(symbol, 120),
    ]);

    if (!quote) {
      return NextResponse.json({ error: "Stock not found" }, { status: 404 });
    }

    // Run all strategies against this stock
    const strategyResults = STRATEGIES.map((strategy) => {
      const result = strategy.evaluate(candles);
      return {
        id: strategy.id,
        name: strategy.name,
        chapter: strategy.chapter,
        category: strategy.category,
        signal: result.signal,
        strength: result.strength,
        details: result.details,
      };
    });

    return NextResponse.json({
      quote,
      strategyResults,
      candleCount: candles.length,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
