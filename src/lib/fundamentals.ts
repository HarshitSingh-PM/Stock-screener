import YahooFinance from "yahoo-finance2";
import { toYahooSymbol, Market } from "./markets";

const yahooFinance = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey"] });

// ─────────────────────────────────────────────────────────────────────────────
// Fundamental quality layer used by the LONG-TERM bot only. Implements simplified,
// deterministic versions of the ai-hedge-fund "investor agents" (Buffett, Lynch,
// Graham, Burry) as quantitative checklists over Yahoo fundamentals.
//
// Everything here degrades gracefully: if the fetch fails or a metric is missing,
// `available` is false and the bot falls back to pure technicals (qualityScore 0.5).
// ─────────────────────────────────────────────────────────────────────────────

export interface InvestorVote {
  name: string;
  bullish: boolean;
  note: string;
}

export interface FundamentalView {
  symbol: string;
  available: boolean;
  qualityScore: number; // 0..1 (0.5 = neutral / unknown)
  bullishCount: number;
  votes: InvestorVote[];
  summary: string;
}

const NEUTRAL = (symbol: string): FundamentalView => ({
  symbol, available: false, qualityScore: 0.5, bullishCount: 0, votes: [],
  summary: "Fundamentals unavailable — trading on technicals only.",
});

export async function getFundamentalView(symbol: string, market: Market = "IN"): Promise<FundamentalView> {
  let fin: any, stats: any, detail: any;
  try {
    const yahooSym = toYahooSymbol(symbol, market);
    const res: any = await yahooFinance.quoteSummary(yahooSym, {
      modules: ["financialData", "defaultKeyStatistics", "summaryDetail"],
    });
    fin = res?.financialData ?? {};
    stats = res?.defaultKeyStatistics ?? {};
    detail = res?.summaryDetail ?? {};
  } catch {
    return NEUTRAL(symbol);
  }

  const num = (v: any): number | null => (typeof v === "number" && isFinite(v) ? v : (typeof v?.raw === "number" ? v.raw : null));

  const roe = num(fin.returnOnEquity);                 // fraction, e.g. 0.18
  const opMargin = num(fin.operatingMargins);          // fraction
  const profitMargin = num(fin.profitMargins);         // fraction
  const currentRatio = num(fin.currentRatio);
  const debtToEquityPct = num(fin.debtToEquity);       // Yahoo reports as percent (e.g. 153.2)
  const d2e = debtToEquityPct != null ? debtToEquityPct / 100 : null;
  const revGrowth = num(fin.revenueGrowth);            // fraction
  const earningsGrowth = num(fin.earningsGrowth);      // fraction
  const fcf = num(fin.freeCashflow);
  const pe = num(detail.trailingPE);
  const peg = num(stats.pegRatio);
  const pb = num(stats.priceToBook);
  const divYield = num(detail.dividendYield);
  const mktCap = num(detail.marketCap) ?? num(stats.marketCap);
  const fcfYield = fcf != null && mktCap && mktCap > 0 ? fcf / mktCap : null;

  // If we got essentially nothing useful, treat as unavailable.
  const haveAny = [roe, opMargin, currentRatio, d2e, revGrowth, pe, fcfYield].some(v => v != null);
  if (!haveAny) return NEUTRAL(symbol);

  const votes: InvestorVote[] = [];

  // ── Buffett: durable, profitable, low-debt compounder ──
  {
    let pts = 0, max = 0;
    if (roe != null) { max++; if (roe > 0.15) pts++; }
    if (opMargin != null) { max++; if (opMargin > 0.15) pts++; }
    if (d2e != null) { max++; if (d2e < 0.5) pts++; }
    if (currentRatio != null) { max++; if (currentRatio > 1.5) pts++; }
    if (max >= 3) votes.push({ name: "Buffett", bullish: pts >= Math.ceil(max * 0.7), note: `quality ${pts}/${max} (ROE ${pct(roe)}, op margin ${pct(opMargin)}, D/E ${d2e?.toFixed(2) ?? "?"})` });
  }

  // ── Lynch: growth at a reasonable price (PEG) ──
  {
    const grow = (revGrowth != null && revGrowth > 0.10) || (earningsGrowth != null && earningsGrowth > 0.10);
    if (peg != null || revGrowth != null) {
      const bullish = (peg != null && peg > 0 && peg < 1.5) && grow;
      votes.push({ name: "Lynch", bullish, note: `PEG ${peg?.toFixed(2) ?? "?"}, growth ${grow ? "yes" : "no"} (rev ${pct(revGrowth)})` });
    }
  }

  // ── Graham: deep-value, strong balance sheet ──
  {
    if (pe != null || pb != null) {
      const cheap = (pe != null && pe > 0 && pe < 18) && (pb == null || pb < 2.5);
      const safe = currentRatio == null || currentRatio >= 1.5;
      votes.push({ name: "Graham", bullish: cheap && safe, note: `P/E ${pe?.toFixed(1) ?? "?"}, P/B ${pb?.toFixed(1) ?? "?"}${divYield ? `, div ${pct(divYield)}` : ""}` });
    }
  }

  // ── Burry: cash-generative & under-levered ──
  {
    if (fcfYield != null || d2e != null) {
      const bullish = (fcfYield != null && fcfYield > 0.06) && (d2e == null || d2e < 1.0);
      votes.push({ name: "Burry", bullish, note: `FCF yield ${pct(fcfYield)}, D/E ${d2e?.toFixed(2) ?? "?"}` });
    }
  }

  if (votes.length === 0) return NEUTRAL(symbol);

  const bullishCount = votes.filter(v => v.bullish).length;
  const qualityScore = bullishCount / votes.length;
  const summary = `${bullishCount}/${votes.length} investor checks bullish — ${votes.filter(v => v.bullish).map(v => v.name).join(", ") || "none"}`;

  return { symbol, available: true, qualityScore, bullishCount, votes, summary };
}

function pct(v: number | null): string {
  return v == null ? "?" : `${(v * 100).toFixed(1)}%`;
}
