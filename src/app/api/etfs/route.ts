import { NextRequest, NextResponse } from "next/server";
import { getStockQuote, getHistoricalData } from "@/lib/stockData";
import { STRATEGIES } from "@/lib/strategies";
import { getMarket } from "@/lib/markets";
import { getETFs } from "@/lib/etfs";
import { etfComponents, verifiedCall } from "@/lib/etfScore";
import { ETF_CALL_STATS } from "@/lib/verifiedEtfCalls";

export const maxDuration = 180;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const market = getMarket(searchParams.get("market"));
  const themeFilter = searchParams.get("theme");

  let etfs = getETFs(market);
  if (themeFilter) etfs = etfs.filter((e) => e.theme === themeFilter);

  const results: any[] = [];
  const batchSize = 5;

  for (let i = 0; i < etfs.length; i += batchSize) {
    const batch = etfs.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(async (etf) => {
        const [quote, candles] = await Promise.all([
          getStockQuote(etf.symbol, market),
          getHistoricalData(etf.symbol, 300, market),
        ]);
        if (!quote || candles.length < 50) return null;

        const closes = candles.map((c) => c.close);
        const strategyResults = STRATEGIES.map((s) => {
          try { return s.evaluate(candles); } catch { return { signal: "NEUTRAL" as const, strength: 0, details: "" }; }
        });
        const buyCount = strategyResults.filter((r) => r.signal === "BUY").length;
        const sellCount = strategyResults.filter((r) => r.signal === "SELL").length;

        const { comp, rationale } = etfComponents(closes, buyCount, sellCount, STRATEGIES.length);
        const { rec, score } = verifiedCall(comp);

        return {
          symbol: etf.symbol,
          name: etf.name,
          theme: etf.theme,
          note: etf.note,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume,
          high52w: quote.high52w,
          low52w: quote.low52w,
          recommendation: rec,
          score,
          buyCount,
          sellCount,
          neutralCount: STRATEGIES.length - buyCount - sellCount,
          totalStrategies: STRATEGIES.length,
          rationale,
        };
      })
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }
  }

  // Group by theme.
  const byTheme: Record<string, any[]> = {};
  for (const r of results) {
    if (!byTheme[r.theme]) byTheme[r.theme] = [];
    byTheme[r.theme].push(r);
  }
  // Sort each theme by score desc.
  for (const t of Object.keys(byTheme)) {
    byTheme[t].sort((a, b) => b.score - a.score);
  }

  return NextResponse.json({
    market,
    total: etfs.length,
    scanned: results.length,
    themes: Object.keys(byTheme),
    byTheme,
    results,
    callStats: ETF_CALL_STATS[market],
  });
}
