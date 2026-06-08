import YahooFinance from "yahoo-finance2";
import { OHLCV } from "./indicators";
import { toYahooSymbol, Market } from "./markets";

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

export async function getStockQuote(symbol: string, market: Market = "IN"): Promise<StockInfo | null> {
  try {
    const yahooSym = toYahooSymbol(symbol, market);
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
  days: number = 100,
  market: Market = "IN"
): Promise<OHLCV[]> {
  try {
    const yahooSym = toYahooSymbol(symbol, market);
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

// Intraday OHLCV bars for the intraday bot. Yahoo intraday intervals (1m/5m/15m/1h)
// only cover a limited trailing window, so `days` is clamped accordingly.
export async function getIntradayData(
  symbol: string,
  market: Market = "IN",
  interval: "5m" | "15m" | "1h" = "15m",
  days: number = 5
): Promise<OHLCV[]> {
  try {
    const yahooSym = toYahooSymbol(symbol, market);
    const endDate = new Date();
    const startDate = new Date();
    // 1m data is only ~7d; 5m/15m ~60d. Keep a safe trailing window.
    const clamp = interval === "5m" ? Math.min(days, 30) : Math.min(days, 50);
    startDate.setDate(startDate.getDate() - clamp);

    const result: any = await yahooFinance.chart(yahooSym, {
      period1: startDate,
      period2: endDate,
      interval,
    });

    if (!result?.quotes) return [];

    return result.quotes
      .filter(
        (q: any) =>
          q.open != null && q.high != null && q.low != null && q.close != null
      )
      .map((q: any) => ({
        date: new Date(q.date),
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume ?? 0,
      }));
  } catch {
    return [];
  }
}

export async function getBatchQuotes(
  symbols: string[],
  market: Market = "IN"
): Promise<StockInfo[]> {
  const results: StockInfo[] = [];
  // Process in batches of 10
  const batchSize = 10;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const promises = batch.map((s) => getStockQuote(s, market));
    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter((r): r is StockInfo => r !== null));
  }
  return results;
}
