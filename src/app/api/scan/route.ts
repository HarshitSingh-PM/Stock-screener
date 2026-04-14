import { NextRequest, NextResponse } from "next/server";
import { getHistoricalData, getStockQuote } from "@/lib/stockData";
import { STRATEGIES } from "@/lib/strategies";
import { NIFTY_500_SYMBOLS } from "@/lib/nifty200";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "30");
  const offset = parseInt(searchParams.get("offset") || "0");
  const minBuyStrategies = parseInt(searchParams.get("minBuy") || "2");

  const symbols = NIFTY_500_SYMBOLS.slice(offset, offset + limit);
  const results: any[] = [];

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

        const strategyResults = STRATEGIES.map((strategy) => {
          const result = strategy.evaluate(candles);
          return {
            id: strategy.id,
            name: strategy.name,
            chapter: strategy.chapter,
            category: strategy.category,
            book: strategy.book,
            signal: result.signal,
            strength: result.strength,
            details: result.details,
          };
        });

        const buySignals = strategyResults.filter((r) => r.signal === "BUY");
        const sellSignals = strategyResults.filter((r) => r.signal === "SELL");

        if (buySignals.length >= minBuyStrategies) {
          return {
            symbol,
            name: quote.name,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            volume: quote.volume,
            marketCap: quote.marketCap,
            buyCount: buySignals.length,
            sellCount: sellSignals.length,
            neutralCount: strategyResults.length - buySignals.length - sellSignals.length,
            totalStrategies: STRATEGIES.length,
            buyStrategies: buySignals
              .sort((a, b) => b.strength - a.strength)
              .map((s) => ({
                id: s.id,
                name: s.name,
                chapter: s.chapter,
                category: s.category,
                book: s.book,
                strength: s.strength,
                details: s.details,
              })),
            sellStrategies: sellSignals
              .sort((a, b) => b.strength - a.strength)
              .map((s) => ({
                id: s.id,
                name: s.name,
                chapter: s.chapter,
                category: s.category,
                book: s.book,
                strength: s.strength,
                details: s.details,
              })),
            avgStrength:
              buySignals.length > 0
                ? Math.round(
                    buySignals.reduce((sum, s) => sum + s.strength, 0) /
                      buySignals.length
                  )
                : 0,
          };
        }
        return null;
      } catch {
        return null;
      }
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter((r) => r !== null));
  }

  results.sort((a, b) => b.buyCount - a.buyCount || b.avgStrength - a.avgStrength);

  return NextResponse.json({
    results,
    total: NIFTY_500_SYMBOLS.length,
    scanned: Math.min(offset + limit, NIFTY_500_SYMBOLS.length),
    minBuyStrategies,
  });
}
