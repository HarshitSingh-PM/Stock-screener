import YahooFinance from "yahoo-finance2";
import { OHLCV } from "./indicators";
import { toYahooSymbol } from "./nifty200";

const yahooFinance = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey"] });

export interface StockInfo {
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
  sector: string;
  industry: string;
}

export async function getStockQuote(symbol: string): Promise<StockInfo | null> {
  try {
    const yahooSym = toYahooSymbol(symbol);
    const quote: any = await yahooFinance.quote(yahooSym);
    if (!quote) return null;

    return {
      symbol,
      name: quote.longName || quote.shortName || symbol,
      price: quote.regularMarketPrice || 0,
      change: quote.regularMarketChange || 0,
      changePercent: quote.regularMarketChangePercent || 0,
      volume: quote.regularMarketVolume || 0,
      marketCap: quote.marketCap || 0,
      high52w: quote.fiftyTwoWeekHigh || 0,
      low52w: quote.fiftyTwoWeekLow || 0,
      pe: quote.trailingPE || null,
      sector: quote.sector || "",
      industry: quote.industry || "",
    };
  } catch {
    return null;
  }
}

export async function getHistoricalData(
  symbol: string,
  days: number = 100
): Promise<OHLCV[]> {
  try {
    const yahooSym = toYahooSymbol(symbol);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result: any = await yahooFinance.chart(yahooSym, {
      period1: startDate,
      period2: endDate,
      interval: "1d",
    });

    if (!result?.quotes) return [];

    return result.quotes
      .filter(
        (q: any) =>
          q.open != null &&
          q.high != null &&
          q.low != null &&
          q.close != null &&
          q.volume != null
      )
      .map((q: any) => ({
        date: new Date(q.date),
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume,
      }));
  } catch {
    return [];
  }
}

export async function getBatchQuotes(
  symbols: string[]
): Promise<StockInfo[]> {
  const results: StockInfo[] = [];
  // Process in batches of 10
  const batchSize = 10;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const promises = batch.map((s) => getStockQuote(s));
    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter((r): r is StockInfo => r !== null));
  }
  return results;
}
