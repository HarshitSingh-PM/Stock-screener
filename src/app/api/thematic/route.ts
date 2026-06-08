import { NextRequest, NextResponse } from "next/server";
import { getMarket } from "@/lib/markets";
import { getThemes } from "@/lib/themes";
import { getHistoricalData } from "@/lib/stockData";
import { analyze, LONGTERM_PROFILE } from "@/lib/botBrain";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

type Rec = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";

function recFromScore(score: number): Rec {
  if (score >= 0.4) return "STRONG_BUY";
  if (score >= 0.15) return "BUY";
  if (score <= -0.4) return "STRONG_SELL";
  if (score <= -0.15) return "SELL";
  return "HOLD";
}

// GET /api/thematic?market=IN|US
// Scores every stock in every theme with the bot's brain and groups by theme.
export async function GET(request: NextRequest) {
  const market = getMarket(request.nextUrl.searchParams.get("market"));
  const themes = getThemes(market);

  // Unique symbols across themes (many overlap) — fetch + score each once.
  const symbols = Array.from(new Set(themes.flatMap(t => t.symbols)));
  const scored = new Map<string, any>();
  const BATCH = 6;
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(async (sym) => {
      const candles = await getHistoricalData(sym, 260, market);
      if (candles.length < 50) return null;
      const th = analyze(sym, candles, LONGTERM_PROFILE);
      const last = candles[candles.length - 1].close;
      const prev = candles.length > 1 ? candles[candles.length - 2].close : last;
      const changePct = prev > 0 ? ((last - prev) / prev) * 100 : 0;
      if (!th) {
        return { symbol: sym, price: last, changePct, score: 0, direction: "FLAT", recommendation: "HOLD" as Rec, buyCount: 0, sellCount: 0, probabilityScore: 0 };
      }
      return {
        symbol: sym, price: last, changePct,
        score: th.score, direction: th.direction,
        recommendation: recFromScore(th.score),
        buyCount: th.buyCount, sellCount: th.sellCount,
        probabilityScore: Math.round(th.probabilityScore * 100),
      };
    }));
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled" && r.value) scored.set(batch[j], r.value);
    }
  }

  const out = themes.map(t => {
    const stocks = t.symbols.map(s => scored.get(s)).filter(Boolean).sort((a, b) => b.score - a.score);
    const avgScore = stocks.length ? stocks.reduce((s, x) => s + x.score, 0) / stocks.length : 0;
    const buyish = stocks.filter(s => s.recommendation === "BUY" || s.recommendation === "STRONG_BUY").length;
    const sellish = stocks.filter(s => s.recommendation === "SELL" || s.recommendation === "STRONG_SELL").length;
    const sentiment: Rec = recFromScore(avgScore);
    return {
      key: t.key, label: t.label, icon: t.icon, blurb: t.blurb,
      avgScore, sentiment, buyish, sellish, count: stocks.length, stocks,
    };
  });

  // Strongest themes first.
  out.sort((a, b) => b.avgScore - a.avgScore);

  return NextResponse.json({ market, themes: out, scannedSymbols: scored.size, totalSymbols: symbols.length });
}
