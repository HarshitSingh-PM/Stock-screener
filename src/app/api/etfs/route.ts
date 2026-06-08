import { NextRequest, NextResponse } from "next/server";
import { getStockQuote, getHistoricalData } from "@/lib/stockData";
import { STRATEGIES } from "@/lib/strategies";
import { sma, rsi, macd } from "@/lib/indicators";
import { getMarket } from "@/lib/markets";
import { getETFs } from "@/lib/etfs";

export const maxDuration = 180;
export const dynamic = "force-dynamic";

type Recommendation = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";

function decideRecommendation(
  closes: number[],
  buyCount: number,
  sellCount: number,
  total: number,
): { rec: Recommendation; score: number; rationale: string[] } {
  const rationale: string[] = [];

  // Trend filter: price vs 50/200 SMA.
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const last = closes.length - 1;
  const price = closes[last];
  const ma50 = sma50[last];
  const ma200 = sma200[last];

  let trendScore = 0;
  if (ma50 != null && ma200 != null) {
    if (price > ma50 && ma50 > ma200) { trendScore = 2; rationale.push("Price above 50 & 200 SMA, uptrend intact"); }
    else if (price < ma50 && ma50 < ma200) { trendScore = -2; rationale.push("Price below 50 & 200 SMA, downtrend"); }
    else if (price > ma200) { trendScore = 1; rationale.push("Price above 200 SMA, long-term bullish"); }
    else { trendScore = -1; rationale.push("Price below 200 SMA, long-term bearish"); }
  }

  // Momentum: RSI.
  const r = rsi(closes, 14);
  const lastRsi = r[last];
  let momentumScore = 0;
  if (lastRsi != null) {
    if (lastRsi < 30) { momentumScore = 2; rationale.push(`RSI ${lastRsi.toFixed(0)} — oversold`); }
    else if (lastRsi > 70) { momentumScore = -2; rationale.push(`RSI ${lastRsi.toFixed(0)} — overbought`); }
    else if (lastRsi > 55) { momentumScore = 1; rationale.push(`RSI ${lastRsi.toFixed(0)} — bullish momentum`); }
    else if (lastRsi < 45) { momentumScore = -1; rationale.push(`RSI ${lastRsi.toFixed(0)} — bearish momentum`); }
  }

  // MACD direction.
  const m = macd(closes);
  const lastMacd = m.macdLine[last];
  const lastSignal = m.signalLine[last];
  let macdScore = 0;
  if (lastMacd != null && lastSignal != null) {
    if (lastMacd > lastSignal && lastMacd > 0) { macdScore = 1; rationale.push("MACD above signal, above zero"); }
    else if (lastMacd < lastSignal && lastMacd < 0) { macdScore = -1; rationale.push("MACD below signal, below zero"); }
  }

  // Strategy confluence: weight by buy/sell ratio of the full strategy library.
  const buyRatio = total > 0 ? buyCount / total : 0;
  const sellRatio = total > 0 ? sellCount / total : 0;
  let confluenceScore = 0;
  if (buyRatio - sellRatio > 0.15) { confluenceScore = 2; rationale.push(`${buyCount}/${total} strategies bullish`); }
  else if (buyRatio - sellRatio > 0.05) { confluenceScore = 1; rationale.push(`${buyCount}/${total} strategies bullish`); }
  else if (sellRatio - buyRatio > 0.15) { confluenceScore = -2; rationale.push(`${sellCount}/${total} strategies bearish`); }
  else if (sellRatio - buyRatio > 0.05) { confluenceScore = -1; rationale.push(`${sellCount}/${total} strategies bearish`); }

  // Aggregate. Max 7 (2+2+1+2), min -7.
  const score = trendScore + momentumScore + macdScore + confluenceScore;

  let rec: Recommendation;
  if (score >= 5) rec = "STRONG_BUY";
  else if (score >= 2) rec = "BUY";
  else if (score <= -5) rec = "STRONG_SELL";
  else if (score <= -2) rec = "SELL";
  else rec = "HOLD";

  return { rec, score, rationale };
}

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

        const { rec, score, rationale } = decideRecommendation(closes, buyCount, sellCount, STRATEGIES.length);

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
  });
}
