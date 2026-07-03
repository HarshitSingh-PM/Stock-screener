import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { VERIFIED_GLOBAL_CUES, VERIFIED_GAP_COMBOS, type GapCombo } from "@/lib/verifiedCues";

const yahooFinance = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey"] });

export const maxDuration = 60;

interface GlobalMarket {
  symbol: string;
  name: string;
  region: "americas" | "europe" | "asia" | "commodity" | "currency" | "volatility";
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  weekChange: number;
  monthChange: number;
  status: "open" | "closed" | "pre-market" | "post-market";
  session: string;
  high: number;
  low: number;
  correlation: number;
  correlationNote: string;
  impactOnIndia: string;
  historicPattern: string;
  lagEffect: string;
}

interface CorrelationInsight {
  title: string;
  description: string;
  impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "MIXED";
  strength: "STRONG" | "MODERATE" | "WEAK";
  category: "index" | "commodity" | "currency" | "volatility";
}

interface PredictionFactor {
  factor: string;
  direction: "UP" | "DOWN" | "FLAT";
  weight: number; // -100 to +100
  reasoning: string;
}

// Historic correlation data with Nifty 50 (based on academic research & market studies)
// Correlation coefficient: -1 (perfect inverse) to +1 (perfect positive)
interface SymbolMeta {
  symbol: string;
  name: string;
  region: "americas" | "europe" | "asia" | "commodity" | "currency" | "volatility";
  session: string;
  correlation: number; // with Nifty 50
  correlationNote: string; // explanation
  impactOnIndia: string; // how it impacts Indian markets
  historicPattern: string; // what historically happens
  lagEffect: string; // timing of the impact
}

const GLOBAL_SYMBOLS: SymbolMeta[] = [
  // Americas
  {
    symbol: "^GSPC", name: "S&P 500", region: "americas", session: "US",
    correlation: 0.62,
    correlationNote: "Strongest global predictor of Nifty. 10-year daily correlation ~0.62.",
    impactOnIndia: "S&P 500 closing up 1% historically leads to Nifty opening 0.4-0.7% higher next day. 2% drops cause 1-1.5% Nifty gap downs.",
    historicPattern: "In 2008, S&P crash dragged Nifty down 52%. In 2020 COVID crash, Nifty fell within hours of S&P. In bull runs, Nifty often outperforms S&P.",
    lagEffect: "Next-day open. US closes at 1:30 AM IST → impact on India open at 9:15 AM IST.",
  },
  {
    symbol: "^IXIC", name: "Nasdaq Composite", region: "americas", session: "US",
    correlation: 0.58,
    correlationNote: "Tech-heavy index. High correlation with Indian IT sector (TCS, Infy, HCL). Nifty IT correlation ~0.7.",
    impactOnIndia: "Nasdaq rally → IT stocks rally next day. Nasdaq correction → TCS, Infosys sell off. 1% Nasdaq move → 0.5-1% Nifty IT move.",
    historicPattern: "2022 Nasdaq bear market (-33%) caused Indian IT to drop 25%+. 2023-24 AI rally lifted Indian IT sentiment but earnings diverged.",
    lagEffect: "Next-day. IT stocks react immediately at open. Broader Nifty follows with 4-8 hour delay.",
  },
  {
    symbol: "^DJI", name: "Dow Jones", region: "americas", session: "US",
    correlation: 0.55,
    correlationNote: "Industrial/blue-chip index. Less tech, more industrials. Moderate correlation with Nifty.",
    impactOnIndia: "Dow reflects old-economy sentiment. Big Dow drops signal broad risk-off that hits Indian large-caps. Less impact on mid/small caps.",
    historicPattern: "Dow crossing milestones (30K, 40K) creates positive global sentiment. Dow drops >500 pts typically cause 200-400 pt Nifty drops next day.",
    lagEffect: "Next-day open. Impact diluted compared to S&P/Nasdaq.",
  },

  // Europe
  {
    symbol: "^FTSE", name: "FTSE 100 (London)", region: "europe", session: "EU",
    correlation: 0.45,
    correlationNote: "UK index with commodity/financial heavy weight. Moderate correlation. FTSE opens during Indian afternoon session.",
    impactOnIndia: "FTSE opening direction influences Indian market 2:30-3:30 PM session. FII flows from UK-based funds react to FTSE.",
    historicPattern: "Brexit crash (2016) caused 3% Nifty drop. UK recession fears have moderate India impact. FTSE commodity stocks track global metals.",
    lagEffect: "Real-time afternoon. FTSE opens 1:30 PM IST → direct impact on last 2 hours of Indian trading.",
  },
  {
    symbol: "^GDAXI", name: "DAX (Germany)", region: "europe", session: "EU",
    correlation: 0.48,
    correlationNote: "Europe's largest economy. Manufacturing/auto heavy. Correlation with Indian auto & industrial sectors ~0.5.",
    impactOnIndia: "DAX moves signal European economic health. German auto sector impacts Tata Motors (JLR parent). European FII flows follow DAX sentiment.",
    historicPattern: "2011 Euro crisis: DAX -30%, Nifty -25%. German recession fears in 2023 had mild India impact. DAX rally supports global risk-on.",
    lagEffect: "Real-time. DAX opens 1:30 PM IST. Impacts Indian afternoon session and next-day sentiment.",
  },

  // Asia
  {
    symbol: "^N225", name: "Nikkei 225 (Japan)", region: "asia", session: "Asia",
    correlation: 0.52,
    correlationNote: "Japan is Asia's largest economy. Nikkei trades same hours as Nifty. Real-time correlation during market hours ~0.5.",
    impactOnIndia: "Nikkei gap up/down at open (5:30 AM IST) sets Asian sentiment. BOJ rate decisions impact global carry trade → FII flows into India.",
    historicPattern: "Aug 2024 Nikkei crash (-12% in 2 days from yen carry trade unwind) caused Nifty to drop 3%. Nikkei hitting 40K+ in 2024 supported Asian optimism.",
    lagEffect: "Same-session. Nikkei opens 5:30 AM IST → impacts Nifty pre-open and first hour.",
  },
  {
    symbol: "^HSI", name: "Hang Seng (HK)", region: "asia", session: "Asia",
    correlation: 0.45,
    correlationNote: "China/HK proxy. Moderate correlation. When HK sells off on China fears, India often benefits as FIIs redirect to India.",
    impactOnIndia: "Hang Seng crash → short-term negative for Asian sentiment but medium-term positive for India (FII reallocation). China stimulus → mixed for India.",
    historicPattern: "2021-22 China tech crackdown: HSI fell 40%, India gained FII flows. China COVID lockdowns 2022: HSI crashed, Nifty was resilient. China recovery trades compete with India for EM flows.",
    lagEffect: "Same-session. HSI opens 6:45 AM IST. Direct intraday influence.",
  },
  {
    symbol: "000001.SS", name: "Shanghai Composite", region: "asia", session: "Asia",
    correlation: 0.25,
    correlationNote: "Low direct correlation (~0.25) but high indirect impact via commodities. China demand drives metal/commodity prices globally.",
    impactOnIndia: "Shanghai rally on stimulus → metal stocks rally (Tata Steel, Hindalco, JSW). Shanghai weakness → commodity demand fears → metal stocks fall.",
    historicPattern: "China stimulus announcements cause 2-5% moves in Indian metal stocks within hours. 2015 China crash had limited direct Nifty impact but metals collapsed.",
    lagEffect: "Same-session for metals. Broader impact with 1-2 day lag.",
  },
  {
    symbol: "^KS11", name: "KOSPI (Korea)", region: "asia", session: "Asia",
    correlation: 0.42,
    correlationNote: "Tech/semiconductor heavy (Samsung, SK Hynix). Tracks global tech sentiment. Moderate correlation with Nifty.",
    impactOnIndia: "KOSPI semiconductor weakness signals global tech slowdown → impacts Indian IT services demand expectations. KOSPI strength supports risk-on.",
    historicPattern: "KOSPI tracks global chip cycle. 2022 chip shortage: KOSPI volatile, Indian IT benefited from digitization. Korea geopolitical risks have limited India impact.",
    lagEffect: "Same-session. Opens 5:30 AM IST. Semiconductor signals take 1-2 days to reflect in Indian IT.",
  },
  {
    symbol: "^STI", name: "Straits Times (SG)", region: "asia", session: "Asia",
    correlation: 0.50,
    correlationNote: "Singapore is financial hub for Asia. SGX Nifty futures (now GIFT Nifty) trade here. High real-time correlation ~0.5.",
    impactOnIndia: "GIFT Nifty (SGX) is the best predictor of Nifty opening. STI direction at open signals Asian banking/financial sentiment.",
    historicPattern: "Singapore is gateway for FII flows into India. STI weakness from regional banking concerns can trigger FII outflows from Indian banks.",
    lagEffect: "Real-time. Singapore opens 5:30 AM IST. GIFT Nifty trades 6:30 AM → direct pre-open predictor.",
  },
  {
    symbol: "^AXJO", name: "ASX 200 (Australia)", region: "asia", session: "Asia",
    correlation: 0.38,
    correlationNote: "Mining/commodity heavy index. Correlation with Indian metals sector ~0.45. Opens before India.",
    impactOnIndia: "ASX mining stock moves signal commodity price direction → impacts Indian metal & mining stocks. ASX tracks iron ore prices closely.",
    historicPattern: "ASX rallies on China demand → Indian metals rally. Australian RBA rate decisions rarely impact India directly.",
    lagEffect: "Same-day. ASX opens 4:00 AM IST → metal stock sentiment set before India opens.",
  },
  {
    symbol: "^TWII", name: "Taiwan Weighted", region: "asia", session: "Asia",
    correlation: 0.40,
    correlationNote: "TSMC dominates (~30% weight). Global semiconductor bellwether. Moderate correlation with Nifty.",
    impactOnIndia: "Taiwan semiconductor trends signal global tech demand. TSMC earnings guide IT services demand. Taiwan geopolitical risk → global risk-off.",
    historicPattern: "China-Taiwan tensions cause sharp selloffs: Aug 2022 Pelosi visit caused 2% Asian correction. TSMC capex signals drive global tech sentiment.",
    lagEffect: "Same-session. Geopolitical events: immediate. Earnings signals: 1-3 day lag.",
  },

  // Commodities
  {
    symbol: "CL=F", name: "Crude Oil (WTI)", region: "commodity", session: "24h",
    correlation: -0.35,
    correlationNote: "INVERSE correlation with Nifty (~-0.35). India imports 85% of oil. Rising oil = weaker economy, weaker rupee.",
    impactOnIndia: "Every $10/bbl rise → India's import bill up $15B/year → widens fiscal deficit → RBI may hike rates. OMCs (BPCL, HPCL, IOC) directly impacted.",
    historicPattern: "2022 oil at $120: Nifty fell 15%, Rupee hit 83. 2014 oil crash to $30: Nifty rallied 30% in 6 months. 2020 negative oil: Nifty bottomed and rallied.",
    lagEffect: "1-2 days for market. OMC stocks react same-day. Rupee impact within hours. Macro impact over weeks.",
  },
  {
    symbol: "BZ=F", name: "Brent Crude", region: "commodity", session: "24h",
    correlation: -0.35,
    correlationNote: "India prices oil off Brent (not WTI). Same inverse correlation as WTI. Brent premium to WTI matters for India's actual import cost.",
    impactOnIndia: "Brent is India's actual reference price. Brent above $85 is considered uncomfortable for India's fiscal math. Below $70 is a significant tailwind.",
    historicPattern: "India's subsidy bill balloons when Brent >$100. Government cuts excise duty when Brent spikes. OMC stock rallies when Brent falls below $75.",
    lagEffect: "Same as WTI. Brent premium widening is an additional negative signal.",
  },
  {
    symbol: "GC=F", name: "Gold", region: "commodity", session: "24h",
    correlation: -0.15,
    correlationNote: "Weak inverse correlation (~-0.15). Gold is a safe-haven. Sharp gold rallies signal fear. India is world's 2nd largest gold consumer.",
    impactOnIndia: "Gold surge → risk-off globally → equities sell. But gold rally → Titan, Kalyan Jewellers, Senco rally. Cultural gold demand supports Indian gold stocks.",
    historicPattern: "2020 gold hit $2000: Nifty was volatile but gold stocks rallied 40%. 2023-24 gold rally to $2400: Titan +30%. Gold crash → jewelry stock correction.",
    lagEffect: "Gold stocks react same-day. Broader market safe-haven signal takes 1-2 days.",
  },
  {
    symbol: "SI=F", name: "Silver", region: "commodity", session: "24h",
    correlation: -0.10,
    correlationNote: "Weak correlation. Silver is both safe-haven AND industrial metal. Tracks solar/EV demand alongside gold.",
    impactOnIndia: "Silver rally → Hindustan Zinc, Vedanta benefit. Industrial silver demand signals → positive for manufacturing. India's silver imports are significant.",
    historicPattern: "Silver is more volatile than gold. 2020-21 silver doubled: mining stocks surged. Silver tracks green energy transition demand.",
    lagEffect: "Mining stocks react 1-2 days. Industrial demand signal over weeks.",
  },

  // Currency
  {
    symbol: "USDINR=X", name: "USD/INR", region: "currency", session: "FX",
    correlation: -0.55,
    correlationNote: "Strong inverse correlation (~-0.55). Weak rupee = FII selling. Nifty and Rupee move together (Nifty up = Rupee strong).",
    impactOnIndia: "Rupee depreciation >1% in a week → expect FII outflows → Nifty pressure. Rupee strength → FII inflows. IT stocks benefit from weak rupee (revenue in USD).",
    historicPattern: "2013 taper tantrum: Rupee fell to 68, Nifty crashed 20%. 2022: Rupee breached 83, Nifty corrected 15%. RBI intervention at key levels (80, 83, 85) provides support.",
    lagEffect: "Real-time during trading hours. RBI intervention visible within hours.",
  },
  {
    symbol: "DX-Y.NYB", name: "US Dollar Index", region: "currency", session: "FX",
    correlation: -0.45,
    correlationNote: "Inverse correlation (~-0.45). Strong dollar = capital flows to US from emerging markets including India.",
    impactOnIndia: "DXY above 105 is headwind for India. DXY below 100 is tailwind. Every 1% DXY rise → ~0.5% FII outflow pressure on Indian equities.",
    historicPattern: "2022 DXY hit 114: worst EM outflows in a decade, Nifty underperformed. 2020 DXY fell to 90: massive FII inflows, Nifty doubled from lows.",
    lagEffect: "1-3 days. FII flow data reported with 1-day lag. Currency impact immediate.",
  },

  // Volatility
  {
    symbol: "^VIX", name: "VIX (Fear Index)", region: "volatility", session: "US",
    correlation: -0.60,
    correlationNote: "Strong inverse correlation (~-0.60). VIX spike = market fear = sell everything including Indian equities.",
    impactOnIndia: "VIX above 20 → caution. VIX above 30 → significant Nifty downside risk. VIX above 40 → panic (but also contrarian buy zone historically).",
    historicPattern: "COVID Mar 2020: VIX hit 82, Nifty crashed 38% in 1 month. Aug 2024: VIX spiked to 65, Nifty dropped 5%. VIX returning below 20 from spikes = strong buy signal historically.",
    lagEffect: "Immediate to next-day. VIX spikes during US hours → Nifty gaps down next morning.",
  },

  // Bond proxy
  {
    symbol: "^TNX", name: "US 10Y Treasury Yield", region: "currency", session: "US",
    correlation: -0.30,
    correlationNote: "Moderate inverse correlation (~-0.30). Rising yields compete with equity returns. Impact via FII flows.",
    impactOnIndia: "10Y above 4.5% → FIIs prefer US bonds over Indian equities. 10Y below 4% → risk-on for emerging markets. Rate differential (India-US) drives FII debt flows.",
    historicPattern: "2023 10Y hit 5%: worst EM equity outflows. 2024 10Y fell to 4.2%: FII inflows resumed. India's 10Y ~7% vs US ~4.5% = 2.5% carry still attractive.",
    lagEffect: "1-5 days. Bond yield moves trigger gradual FII reallocation, not instant.",
  },
];

function getMarketStatus(symbol: string): string {
  const now = new Date();
  const istHour = (now.getUTCHours() + 5) % 24 + (now.getUTCMinutes() + 30 >= 60 ? 1 : 0);
  const istMin = (now.getUTCMinutes() + 30) % 60;

  // Rough market hours in IST
  if (symbol.startsWith("^GSPC") || symbol.startsWith("^IXIC") || symbol.startsWith("^DJI") || symbol === "^VIX") {
    // US: 7:00 PM - 1:30 AM IST (next day)
    if (istHour >= 19 || istHour < 2) return "open";
    if (istHour >= 17 && istHour < 19) return "pre-market";
    return "closed";
  }
  if (symbol === "^FTSE" || symbol === "^GDAXI") {
    // Europe: 1:30 PM - 10:00 PM IST
    if (istHour >= 14 && istHour < 22) return "open";
    return "closed";
  }
  if (symbol === "^N225") {
    // Japan: 5:30 AM - 2:00 PM IST
    if (istHour >= 6 && istHour < 14) return "open";
    return "closed";
  }
  if (symbol === "^HSI" || symbol === "000001.SS") {
    // HK/China: 6:45 AM - 1:30 PM IST
    if (istHour >= 7 && istHour < 14) return "open";
    return "closed";
  }
  if (symbol === "^KS11" || symbol === "^TWII") {
    // Korea/Taiwan: 5:30 AM - 12:00 PM IST
    if (istHour >= 6 && istHour < 12) return "open";
    return "closed";
  }
  if (symbol.includes("=F") || symbol.includes("=X")) return "open"; // Futures/FX 24h
  return "closed";
}

// ─────────────────────────────────────────────────────────────────────────────
// Verified analysis layer. Every insight, factor, and combo below is backed by
// a 5-year backtest (scripts/backtestCues.ts) against the outcome it claims to
// predict; anything that failed verification was removed from the site.
// ─────────────────────────────────────────────────────────────────────────────

const avgOf = (...xs: (number | undefined)[]) => {
  const v = xs.filter((x): x is number => x != null && isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
};

/** Live cue direction (+1 bullish / -1 bearish / 0 inactive) — thresholds
 *  mirror scripts/backtestCues.ts exactly. */
function liveCueDirections(bySymbol: Record<string, GlobalMarket>, market: "IN" | "US"): Map<string, number> {
  const g = (s: string) => bySymbol[s];
  const dirs = new Map<string, number>();
  const act = (v: number, thr: number, invert = false) =>
    !isFinite(v) || Math.abs(v) <= thr ? 0 : (v > 0 ? 1 : -1) * (invert ? -1 : 1);
  const sp = g("^GSPC"), nas = g("^IXIC"), dji = g("^DJI");
  const asia = avgOf(g("^N225")?.changePercent, g("^HSI")?.changePercent, g("000001.SS")?.changePercent);
  const eur = avgOf(g("^FTSE")?.changePercent, g("^GDAXI")?.changePercent);
  const oil = g("CL=F") || g("BZ=F");
  if (market === "IN") {
    const avgUS = avgOf(sp?.changePercent, nas?.changePercent, dji?.changePercent);
    dirs.set("us-close", act(avgUS, 0.3));
    dirs.set("us-close-strong", act(avgUS, 1.5));
    dirs.set("nasdaq-divergence", nas && sp ? act(nas.changePercent - sp.changePercent, 0.5) : 0);
    dirs.set("europe-prev", act(eur, 0.5));
    dirs.set("dxy", act(g("DX-Y.NYB")?.changePercent ?? NaN, 0.3, true));
    dirs.set("usdinr", act(g("USDINR=X")?.changePercent ?? NaN, 0.2, true));
    dirs.set("vix-spike", act(g("^VIX")?.changePercent ?? NaN, 10, true));
  } else {
    dirs.set("asia-day", act(asia, 0.3));
    dirs.set("own-momentum", act(sp?.changePercent ?? NaN, 0.3));
    dirs.set("vix-spike", act(g("^VIX")?.changePercent ?? NaN, 10, true));
    dirs.set("tnx-move", act(g("^TNX")?.changePercent ?? NaN, 2, true));
    dirs.set("dxy", act(g("DX-Y.NYB")?.changePercent ?? NaN, 0.3, true));
    dirs.set("oil-daily", act(oil?.changePercent ?? NaN, 2));
    dirs.set("gold-daily", act(g("GC=F")?.changePercent ?? NaN, 1, true));
  }
  return dirs;
}

const OUTCOME_LABEL: Record<string, string> = {
  gap: "next opening gap",
  day: "next session close",
  fwd5: "5-day direction",
};

function generateInsights(markets: GlobalMarket[]): CorrelationInsight[] {
  const bySymbol: Record<string, GlobalMarket> = {};
  for (const m of markets) bySymbol[m.symbol] = m;
  const dirs = liveCueDirections(bySymbol, "IN");
  const insights: CorrelationInsight[] = [];
  for (const cue of VERIFIED_GLOBAL_CUES.IN) {
    const dir = dirs.get(cue.id) ?? 0;
    if (dir === 0) continue;
    insights.push({
      title: `${cue.label.replace(/ \(.*\)$/, "")} → ${dir > 0 ? "bullish" : "bearish"} for Nifty`,
      description: `Backtested over 5 years: when this condition fired, the ${OUTCOME_LABEL[cue.outcome]} went the predicted way ${cue.hitRate}% of ${cue.n} times (${cue.testHitRate}% on the last 18 months, avg move ${cue.avgMove > 0 ? "+" : ""}${cue.avgMove}%). It is firing ${dir > 0 ? "bullish" : "bearish"} right now.`,
      impact: dir > 0 ? "POSITIVE" : "NEGATIVE",
      strength: cue.hitRate >= 80 ? "STRONG" : cue.hitRate >= 70 ? "MODERATE" : "WEAK",
      category: cue.id.startsWith("vix") ? "volatility" : cue.id === "dxy" || cue.id === "usdinr" ? "currency" : "index",
    });
  }
  return insights;
}

interface ActiveGapCombo extends GapCombo {
  direction: "UP" | "DOWN";
}

function activeCombos(markets: GlobalMarket[], market: "IN" | "US"): ActiveGapCombo[] {
  const bySymbol: Record<string, GlobalMarket> = {};
  for (const m of markets) bySymbol[m.symbol] = m;
  const dirs = liveCueDirections(bySymbol, market);
  const out: ActiveGapCombo[] = [];
  for (const combo of VERIFIED_GAP_COMBOS[market]) {
    const ds = combo.members.map((m) => dirs.get(m) ?? 0);
    if (ds.some((d) => d === 0) || new Set(ds).size !== 1) continue;
    out.push({ ...combo, direction: ds[0] > 0 ? "UP" : "DOWN" });
  }
  return out;
}

function verifiedPrediction(markets: GlobalMarket[], market: "IN" | "US"): { score: number; label: string; factors: PredictionFactor[] } {
  const bySymbol: Record<string, GlobalMarket> = {};
  for (const m of markets) bySymbol[m.symbol] = m;
  const dirs = liveCueDirections(bySymbol, market);
  const factors: PredictionFactor[] = [];
  let total = 0;
  for (const cue of VERIFIED_GLOBAL_CUES[market]) {
    const dir = dirs.get(cue.id) ?? 0;
    const weight = dir === 0 ? 0 : Math.round(dir * (cue.hitRate - 50) * 0.9);
    total += weight;
    factors.push({
      factor: cue.label.replace(/ \(.*\)$/, ""),
      direction: dir > 0 ? "UP" : dir < 0 ? "DOWN" : "FLAT",
      weight,
      reasoning: `Verified predictor of the ${OUTCOME_LABEL[cue.outcome]}: right ${cue.hitRate}% of ${cue.n} occurrences over 5y (${cue.testHitRate}% holdout). ${dir === 0 ? "Not firing right now." : `Firing ${dir > 0 ? "bullish" : "bearish"} now.`}`,
    });
  }
  let score = Math.min(95, Math.max(5, 50 + total));
  // A live 90%+ combo overrides toward its direction.
  const combos = activeCombos(markets, market);
  if (combos.length > 0) {
    score = combos[0].direction === "UP" ? Math.max(score, 88) : Math.min(score, 12);
  }
  let label: string;
  if (score >= 75) label = "Strong Bullish";
  else if (score >= 60) label = "Moderately Bullish";
  else if (score >= 55) label = "Slightly Bullish";
  else if (score >= 45) label = "Neutral / Indecisive";
  else if (score >= 40) label = "Slightly Bearish";
  else if (score >= 25) label = "Moderately Bearish";
  else label = "Strong Bearish";
  factors.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  return { score, label, factors };
}


export async function GET() {
  try {
    const markets: GlobalMarket[] = [];

    // Fetch all markets in parallel batches
    const batchSize = 5;
    for (let i = 0; i < GLOBAL_SYMBOLS.length; i += batchSize) {
      const batch = GLOBAL_SYMBOLS.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (meta) => {
          try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 35);

            const result: any = await yahooFinance.chart(meta.symbol, {
              period1: startDate,
              period2: endDate,
              interval: "1d",
            });

            if (!result?.quotes || result.quotes.length < 2) return null;

            const quotes = result.quotes.filter((q: any) => q.close != null && q.open != null);
            if (quotes.length < 2) return null;

            const lastQuote = quotes[quotes.length - 1];
            const prevQuote = quotes[quotes.length - 2];
            const price = lastQuote.close;
            const previousClose = prevQuote.close;
            const change = price - previousClose;
            const changePercent = (change / previousClose) * 100;

            const weekAgo = quotes.length >= 6 ? quotes[quotes.length - 6] : quotes[0];
            const weekChange = ((price - weekAgo.close) / weekAgo.close) * 100;

            const monthAgo = quotes.length >= 22 ? quotes[quotes.length - 22] : quotes[0];
            const monthChange = ((price - monthAgo.close) / monthAgo.close) * 100;

            const status = getMarketStatus(meta.symbol);

            return {
              symbol: meta.symbol,
              name: meta.name,
              region: meta.region,
              price,
              change,
              changePercent,
              previousClose,
              weekChange,
              monthChange,
              status,
              session: status,
              high: lastQuote.high || price,
              low: lastQuote.low || price,
              correlation: meta.correlation,
              correlationNote: meta.correlationNote,
              impactOnIndia: meta.impactOnIndia,
              historicPattern: meta.historicPattern,
              lagEffect: meta.lagEffect,
            } as GlobalMarket;
          } catch {
            return null;
          }
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) markets.push(r.value);
      }
    }

    const insights = generateInsights(markets);
    const prediction = verifiedPrediction(markets, "IN");
    const usPrediction = verifiedPrediction(markets, "US");

    return NextResponse.json({
      markets,
      insights,
      prediction,
      usPrediction,
      combos: {
        IN: { active: activeCombos(markets, "IN"), catalog: VERIFIED_GAP_COMBOS.IN },
        US: { active: activeCombos(markets, "US"), catalog: VERIFIED_GAP_COMBOS.US },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch global markets" }, { status: 500 });
  }
}
