import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

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

function generateInsights(markets: GlobalMarket[]): CorrelationInsight[] {
  const insights: CorrelationInsight[] = [];
  const bySymbol: Record<string, GlobalMarket> = {};
  for (const m of markets) bySymbol[m.symbol] = m;

  const sp500 = bySymbol["^GSPC"];
  const nasdaq = bySymbol["^IXIC"];
  const dji = bySymbol["^DJI"];
  const nikkei = bySymbol["^N225"];
  const hsi = bySymbol["^HSI"];
  const shanghai = bySymbol["000001.SS"];
  const ftse = bySymbol["^FTSE"];
  const dax = bySymbol["^GDAXI"];
  const oil = bySymbol["CL=F"] || bySymbol["BZ=F"];
  const brent = bySymbol["BZ=F"];
  const gold = bySymbol["GC=F"];
  const usdinr = bySymbol["USDINR=X"];
  const dxy = bySymbol["DX-Y.NYB"];
  const vix = bySymbol["^VIX"];
  const tnx = bySymbol["^TNX"];

  // 1. US Market Impact
  if (sp500 && nasdaq) {
    const avgUSChange = (sp500.changePercent + nasdaq.changePercent + (dji?.changePercent || sp500.changePercent)) / 3;
    if (Math.abs(avgUSChange) > 0.3) {
      insights.push({
        title: avgUSChange > 0 ? "US Markets Closed Higher" : "US Markets Closed Lower",
        description: `S&P 500 ${sp500.changePercent >= 0 ? "+" : ""}${sp500.changePercent.toFixed(2)}%, Nasdaq ${nasdaq.changePercent >= 0 ? "+" : ""}${nasdaq.changePercent.toFixed(2)}%${dji ? `, Dow ${dji.changePercent >= 0 ? "+" : ""}${dji.changePercent.toFixed(2)}%` : ""}. US markets have ~0.6 correlation with Indian markets. ${Math.abs(avgUSChange) > 1.5 ? "Strong move - expect significant gap." : "Moderate move - mild impact expected."}`,
        impact: avgUSChange > 0.3 ? "POSITIVE" : avgUSChange < -0.3 ? "NEGATIVE" : "NEUTRAL",
        strength: Math.abs(avgUSChange) > 1.5 ? "STRONG" : Math.abs(avgUSChange) > 0.7 ? "MODERATE" : "WEAK",
        category: "index",
      });
    }

    // Tech-heavy Nasdaq divergence
    if (nasdaq && sp500 && Math.abs(nasdaq.changePercent - sp500.changePercent) > 0.5) {
      const techLeading = nasdaq.changePercent > sp500.changePercent;
      insights.push({
        title: techLeading ? "Tech Outperforming Broader Market" : "Tech Underperforming Broader Market",
        description: `Nasdaq ${techLeading ? "outpaced" : "lagged"} S&P 500 by ${Math.abs(nasdaq.changePercent - sp500.changePercent).toFixed(2)}%. ${techLeading ? "IT stocks (TCS, Infosys, HCL) may see positive sentiment." : "IT sector may face selling pressure. Watch Indian IT names."}`,
        impact: techLeading ? "POSITIVE" : "NEGATIVE",
        strength: Math.abs(nasdaq.changePercent - sp500.changePercent) > 1 ? "STRONG" : "MODERATE",
        category: "index",
      });
    }
  }

  // 2. Asian Peer Impact
  const asianMarkets = [nikkei, hsi, shanghai].filter(Boolean) as GlobalMarket[];
  if (asianMarkets.length > 0) {
    const avgAsiaChange = asianMarkets.reduce((sum, m) => sum + m.changePercent, 0) / asianMarkets.length;
    if (Math.abs(avgAsiaChange) > 0.3) {
      const details = asianMarkets.map(m => `${m.name.split(" (")[0]} ${m.changePercent >= 0 ? "+" : ""}${m.changePercent.toFixed(2)}%`).join(", ");
      insights.push({
        title: avgAsiaChange > 0 ? "Asian Markets Trading Higher" : "Asian Markets Under Pressure",
        description: `${details}. Asian markets trade in the same session as India and have high real-time correlation. ${Math.abs(avgAsiaChange) > 1.5 ? "Major regional move - expect Nifty to follow direction." : "Regional sentiment will influence Indian market direction."}`,
        impact: avgAsiaChange > 0.3 ? "POSITIVE" : avgAsiaChange < -0.3 ? "NEGATIVE" : "NEUTRAL",
        strength: Math.abs(avgAsiaChange) > 1 ? "STRONG" : "MODERATE",
        category: "index",
      });
    }

    // China-specific (impacts metals, commodities)
    if (shanghai && Math.abs(shanghai.changePercent) > 1) {
      insights.push({
        title: shanghai.changePercent > 0 ? "China Rally - Commodity Demand Signal" : "China Weakness - Demand Concern",
        description: `Shanghai Composite ${shanghai.changePercent >= 0 ? "+" : ""}${shanghai.changePercent.toFixed(2)}%. China is the world's largest commodity consumer. ${shanghai.changePercent > 0 ? "Positive for Indian metal & mining stocks (Tata Steel, Hindalco, JSW)." : "Negative for commodity-linked Indian stocks. Watch metals sector."}`,
        impact: shanghai.changePercent > 0 ? "POSITIVE" : "NEGATIVE",
        strength: Math.abs(shanghai.changePercent) > 2 ? "STRONG" : "MODERATE",
        category: "index",
      });
    }
  }

  // 3. European Cues
  if (ftse || dax) {
    const eurMarkets = [ftse, dax].filter(Boolean) as GlobalMarket[];
    const avgEurChange = eurMarkets.reduce((sum, m) => sum + m.changePercent, 0) / eurMarkets.length;
    if (Math.abs(avgEurChange) > 0.5) {
      insights.push({
        title: avgEurChange > 0 ? "European Markets Positive" : "European Markets Negative",
        description: `${eurMarkets.map(m => `${m.name.split(" (")[0]} ${m.changePercent >= 0 ? "+" : ""}${m.changePercent.toFixed(2)}%`).join(", ")}. European session overlaps with Indian afternoon trading. FII flows from Europe impact late-session moves.`,
        impact: avgEurChange > 0 ? "POSITIVE" : "NEGATIVE",
        strength: Math.abs(avgEurChange) > 1 ? "MODERATE" : "WEAK",
        category: "index",
      });
    }
  }

  // 4. Crude Oil Impact
  if (oil) {
    if (Math.abs(oil.changePercent) > 1) {
      insights.push({
        title: oil.changePercent > 0 ? "Crude Oil Prices Rising" : "Crude Oil Prices Falling",
        description: `${oil.name} at $${oil.price.toFixed(2)} (${oil.changePercent >= 0 ? "+" : ""}${oil.changePercent.toFixed(2)}%). India imports ~85% of its oil. ${oil.changePercent > 0 ? "Rising oil hurts India's trade deficit, OMCs (BPCL, HPCL, IOC) under pressure. Negative for Rupee." : "Falling oil is positive for India - reduces import bill, helps OMCs margins, supports Rupee."} ${Math.abs(oil.changePercent) > 3 ? "MAJOR move - significant macro impact." : ""}`,
        impact: oil.changePercent > 1 ? "NEGATIVE" : oil.changePercent < -1 ? "POSITIVE" : "NEUTRAL",
        strength: Math.abs(oil.changePercent) > 3 ? "STRONG" : "MODERATE",
        category: "commodity",
      });
    }

    // Week-over-week oil trend
    if (Math.abs(oil.weekChange) > 3) {
      insights.push({
        title: `Oil ${oil.weekChange > 0 ? "Up" : "Down"} ${Math.abs(oil.weekChange).toFixed(1)}% This Week`,
        description: `Sustained ${oil.weekChange > 0 ? "rise" : "decline"} in crude. ${oil.weekChange > 0 ? "Persistent high oil is structural negative for Indian markets. Watch for RBI commentary on inflation." : "Multi-day oil decline is a strong tailwind for Indian equities and the Rupee."}`,
        impact: oil.weekChange > 3 ? "NEGATIVE" : oil.weekChange < -3 ? "POSITIVE" : "NEUTRAL",
        strength: "MODERATE",
        category: "commodity",
      });
    }
  }

  // 5. Gold as Safe Haven
  if (gold) {
    if (Math.abs(gold.changePercent) > 1) {
      insights.push({
        title: gold.changePercent > 0 ? "Gold Prices Surging" : "Gold Prices Declining",
        description: `Gold at $${gold.price.toFixed(2)} (${gold.changePercent >= 0 ? "+" : ""}${gold.changePercent.toFixed(2)}%). ${gold.changePercent > 1.5 ? "Sharp gold rally signals risk-off / fear in global markets. Equities may face headwinds." : gold.changePercent < -1 ? "Gold decline signals risk-on sentiment. Positive for equities." : "Moderate gold move."} Indian gold stocks (Titan, Kalyan) track gold prices.`,
        impact: gold.changePercent > 1.5 ? "NEGATIVE" : gold.changePercent < -1 ? "POSITIVE" : "NEUTRAL",
        strength: Math.abs(gold.changePercent) > 2 ? "STRONG" : "MODERATE",
        category: "commodity",
      });
    }
  }

  // 6. USD/INR Currency
  if (usdinr) {
    if (Math.abs(usdinr.changePercent) > 0.2) {
      const rupeeFalling = usdinr.changePercent > 0; // Higher USD/INR = weaker rupee
      insights.push({
        title: rupeeFalling ? "Rupee Weakening Against Dollar" : "Rupee Strengthening Against Dollar",
        description: `USD/INR at ₹${usdinr.price.toFixed(2)} (${usdinr.changePercent >= 0 ? "+" : ""}${usdinr.changePercent.toFixed(2)}%). ${rupeeFalling ? "Weak rupee signals FII outflows, higher import costs. Negative for market. IT exporters (TCS, Infosys) benefit from weaker rupee." : "Strong rupee signals FII inflows, positive sentiment. Good for importers, but IT exporters may see revenue pressure."}`,
        impact: rupeeFalling ? "NEGATIVE" : "POSITIVE",
        strength: Math.abs(usdinr.changePercent) > 0.5 ? "STRONG" : "MODERATE",
        category: "currency",
      });
    }
  }

  // 7. Dollar Index
  if (dxy) {
    if (Math.abs(dxy.changePercent) > 0.3) {
      insights.push({
        title: dxy.changePercent > 0 ? "Dollar Index Strengthening" : "Dollar Index Weakening",
        description: `DXY at ${dxy.price.toFixed(2)} (${dxy.changePercent >= 0 ? "+" : ""}${dxy.changePercent.toFixed(2)}%). ${dxy.changePercent > 0 ? "Strong dollar typically means FII outflows from emerging markets including India. Negative for Nifty." : "Weak dollar drives FII inflows into emerging markets. Positive for Indian equities."}`,
        impact: dxy.changePercent > 0.3 ? "NEGATIVE" : dxy.changePercent < -0.3 ? "POSITIVE" : "NEUTRAL",
        strength: Math.abs(dxy.changePercent) > 0.7 ? "STRONG" : "MODERATE",
        category: "currency",
      });
    }
  }

  // 8. VIX Fear Gauge
  if (vix) {
    if (vix.price > 25) {
      insights.push({
        title: `VIX Elevated at ${vix.price.toFixed(1)} - Fear Mode`,
        description: `VIX above 25 indicates high fear in US markets. ${vix.changePercent > 5 ? "VIX spiking " + vix.changePercent.toFixed(1) + "% — panic selling likely to spill over to India." : "Elevated anxiety persists."} Historically, India Nifty falls ~0.5-1% when VIX is above 25. Consider hedging or reducing exposure.`,
        impact: "NEGATIVE",
        strength: vix.price > 30 ? "STRONG" : "MODERATE",
        category: "volatility",
      });
    } else if (vix.price < 15 && vix.changePercent < -5) {
      insights.push({
        title: `VIX Collapsing to ${vix.price.toFixed(1)} - Complacency`,
        description: `Very low VIX signals extreme complacency. While bullish short-term, historically VIX below 15 preceded volatility spikes. Market may be setting up for a correction.`,
        impact: "MIXED",
        strength: "WEAK",
        category: "volatility",
      });
    }
    if (Math.abs(vix.changePercent) > 10) {
      insights.push({
        title: `VIX ${vix.changePercent > 0 ? "Spiked" : "Collapsed"} ${Math.abs(vix.changePercent).toFixed(1)}%`,
        description: `Major VIX move signals ${vix.changePercent > 0 ? "sudden fear — expect risk-off across global markets. Indian market likely to see gap down or selling pressure." : "fear dissipating — risk-on rally likely. Indian market may see buying."}`,
        impact: vix.changePercent > 10 ? "NEGATIVE" : "POSITIVE",
        strength: "STRONG",
        category: "volatility",
      });
    }
  }

  // 9. US Bond Yields
  if (tnx) {
    if (Math.abs(tnx.changePercent) > 2) {
      insights.push({
        title: tnx.changePercent > 0 ? "US Bond Yields Rising" : "US Bond Yields Falling",
        description: `US 10Y at ${tnx.price.toFixed(2)}% (${tnx.changePercent >= 0 ? "+" : ""}${tnx.changePercent.toFixed(2)}% change). ${tnx.changePercent > 0 ? "Rising yields attract money to US bonds, away from emerging markets. Negative for Indian equities and FII flows." : "Falling yields push money into riskier assets like Indian equities. Positive for FII inflows."}`,
        impact: tnx.changePercent > 2 ? "NEGATIVE" : tnx.changePercent < -2 ? "POSITIVE" : "NEUTRAL",
        strength: Math.abs(tnx.changePercent) > 4 ? "STRONG" : "MODERATE",
        category: "currency",
      });
    }
    if (tnx.price > 4.5) {
      insights.push({
        title: `US 10Y Yield Above ${tnx.price.toFixed(1)}% - Elevated`,
        description: `High US yields (${tnx.price.toFixed(2)}%) compete with equity returns globally. Emerging market outflows increase when US yields are attractive. Structural headwind for Indian market.`,
        impact: "NEGATIVE",
        strength: tnx.price > 5 ? "STRONG" : "MODERATE",
        category: "currency",
      });
    }
  }

  return insights;
}

function generatePrediction(markets: GlobalMarket[], insights: CorrelationInsight[]): { score: number; label: string; factors: PredictionFactor[] } {
  const factors: PredictionFactor[] = [];
  const bySymbol: Record<string, GlobalMarket> = {};
  for (const m of markets) bySymbol[m.symbol] = m;

  const sp500 = bySymbol["^GSPC"];
  const nasdaq = bySymbol["^IXIC"];
  const dji = bySymbol["^DJI"];
  const nikkei = bySymbol["^N225"];
  const hsi = bySymbol["^HSI"];
  const shanghai = bySymbol["000001.SS"];
  const oil = bySymbol["CL=F"] || bySymbol["BZ=F"];
  const gold = bySymbol["GC=F"];
  const usdinr = bySymbol["USDINR=X"];
  const dxy = bySymbol["DX-Y.NYB"];
  const vix = bySymbol["^VIX"];
  const tnx = bySymbol["^TNX"];
  const ftse = bySymbol["^FTSE"];
  const dax = bySymbol["^GDAXI"];

  // Factor 1: US Markets (highest weight - 0.6 correlation)
  if (sp500 && nasdaq) {
    const avgUS = (sp500.changePercent + nasdaq.changePercent) / 2;
    const weight = Math.min(40, Math.max(-40, avgUS * 20));
    factors.push({
      factor: "US Market Close",
      direction: avgUS > 0.2 ? "UP" : avgUS < -0.2 ? "DOWN" : "FLAT",
      weight: Math.round(weight),
      reasoning: `S&P ${sp500.changePercent >= 0 ? "+" : ""}${sp500.changePercent.toFixed(2)}%, Nasdaq ${nasdaq.changePercent >= 0 ? "+" : ""}${nasdaq.changePercent.toFixed(2)}%. US overnight move is the strongest predictor for Indian market open.`,
    });
  }

  // Factor 2: Asian Markets (same session)
  const asianPeers = [nikkei, hsi, shanghai].filter(Boolean) as GlobalMarket[];
  if (asianPeers.length > 0) {
    const avgAsia = asianPeers.reduce((s, m) => s + m.changePercent, 0) / asianPeers.length;
    const weight = Math.min(30, Math.max(-30, avgAsia * 15));
    factors.push({
      factor: "Asian Peers",
      direction: avgAsia > 0.2 ? "UP" : avgAsia < -0.2 ? "DOWN" : "FLAT",
      weight: Math.round(weight),
      reasoning: `${asianPeers.map(m => `${m.name.split(" ")[0]} ${m.changePercent >= 0 ? "+" : ""}${m.changePercent.toFixed(2)}%`).join(", ")}. Same-session Asian markets have real-time influence.`,
    });
  }

  // Factor 3: European Markets
  const eurMarkets = [ftse, dax].filter(Boolean) as GlobalMarket[];
  if (eurMarkets.length > 0) {
    const avgEur = eurMarkets.reduce((s, m) => s + m.changePercent, 0) / eurMarkets.length;
    const weight = Math.min(15, Math.max(-15, avgEur * 8));
    factors.push({
      factor: "European Cues",
      direction: avgEur > 0.2 ? "UP" : avgEur < -0.2 ? "DOWN" : "FLAT",
      weight: Math.round(weight),
      reasoning: `${eurMarkets.map(m => `${m.name.split(" (")[0]} ${m.changePercent >= 0 ? "+" : ""}${m.changePercent.toFixed(2)}%`).join(", ")}. European session impacts Indian afternoon trading via FII flows.`,
    });
  }

  // Factor 4: Crude Oil (inverse for India)
  if (oil) {
    // Oil up is bad for India (importer), oil down is good
    const weight = Math.min(20, Math.max(-20, -oil.changePercent * 5));
    factors.push({
      factor: "Crude Oil Price",
      direction: oil.changePercent < -0.5 ? "UP" : oil.changePercent > 0.5 ? "DOWN" : "FLAT",
      weight: Math.round(weight),
      reasoning: `${oil.name} $${oil.price.toFixed(2)} (${oil.changePercent >= 0 ? "+" : ""}${oil.changePercent.toFixed(2)}%). India imports 85% of oil - rising oil hurts trade deficit and inflation.`,
    });
  }

  // Factor 5: USD/INR
  if (usdinr) {
    // Rupee weakening (higher USDINR) is negative
    const weight = Math.min(15, Math.max(-15, -usdinr.changePercent * 25));
    factors.push({
      factor: "Rupee Movement",
      direction: usdinr.changePercent < -0.1 ? "UP" : usdinr.changePercent > 0.1 ? "DOWN" : "FLAT",
      weight: Math.round(weight),
      reasoning: `USD/INR ₹${usdinr.price.toFixed(2)} (${usdinr.changePercent >= 0 ? "+" : ""}${usdinr.changePercent.toFixed(2)}%). ${usdinr.changePercent > 0 ? "Weaker rupee = FII outflows." : usdinr.changePercent < 0 ? "Stronger rupee = FII inflows." : "Stable currency."}`,
    });
  }

  // Factor 6: Dollar Index (inverse)
  if (dxy) {
    const weight = Math.min(10, Math.max(-10, -dxy.changePercent * 8));
    factors.push({
      factor: "Dollar Index",
      direction: dxy.changePercent < -0.2 ? "UP" : dxy.changePercent > 0.2 ? "DOWN" : "FLAT",
      weight: Math.round(weight),
      reasoning: `DXY ${dxy.price.toFixed(2)} (${dxy.changePercent >= 0 ? "+" : ""}${dxy.changePercent.toFixed(2)}%). Strong dollar pulls FII money from emerging markets.`,
    });
  }

  // Factor 7: VIX (inverse)
  if (vix) {
    let weight = 0;
    if (vix.price > 25) weight = -15;
    else if (vix.price > 20) weight = -5;
    else if (vix.price < 15) weight = 10;
    // Adjust for change
    weight += Math.min(10, Math.max(-10, -vix.changePercent * 0.5));
    factors.push({
      factor: "VIX Fear Index",
      direction: vix.changePercent < -3 ? "UP" : vix.changePercent > 3 ? "DOWN" : "FLAT",
      weight: Math.round(Math.min(20, Math.max(-20, weight))),
      reasoning: `VIX at ${vix.price.toFixed(1)} (${vix.changePercent >= 0 ? "+" : ""}${vix.changePercent.toFixed(1)}%). ${vix.price > 25 ? "High fear = risk-off." : vix.price < 15 ? "Low fear = risk-on." : "Normal range."} VIX spike = expect selling.`,
    });
  }

  // Factor 8: Gold (mixed)
  if (gold) {
    // Sharp gold rally = risk-off, mild = neutral
    const weight = gold.changePercent > 1.5 ? -10 : gold.changePercent < -1 ? 5 : 0;
    if (weight !== 0) {
      factors.push({
        factor: "Gold (Safe Haven)",
        direction: gold.changePercent < -0.5 ? "UP" : gold.changePercent > 1 ? "DOWN" : "FLAT",
        weight,
        reasoning: `Gold $${gold.price.toFixed(2)} (${gold.changePercent >= 0 ? "+" : ""}${gold.changePercent.toFixed(2)}%). ${gold.changePercent > 1.5 ? "Gold rush = flight to safety = equity negative." : "Gold decline = risk appetite returning."}`,
      });
    }
  }

  // Factor 9: US Bond Yields
  if (tnx) {
    const weight = tnx.changePercent > 3 ? -10 : tnx.changePercent < -3 ? 8 : 0;
    if (weight !== 0) {
      factors.push({
        factor: "US 10Y Yield",
        direction: tnx.changePercent < -2 ? "UP" : tnx.changePercent > 2 ? "DOWN" : "FLAT",
        weight,
        reasoning: `Yield at ${tnx.price.toFixed(2)}% (${tnx.changePercent >= 0 ? "+" : ""}${tnx.changePercent.toFixed(2)}%). ${tnx.changePercent > 0 ? "Rising yields compete with equities for capital." : "Falling yields favor equities."}`,
      });
    }
  }

  // Calculate prediction score
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  // Normalize to 0-100 scale (50 = neutral)
  const score = Math.min(95, Math.max(5, 50 + totalWeight));

  let label: string;
  if (score >= 75) label = "Strong Bullish";
  else if (score >= 60) label = "Moderately Bullish";
  else if (score >= 55) label = "Slightly Bullish";
  else if (score >= 45) label = "Neutral / Indecisive";
  else if (score >= 40) label = "Slightly Bearish";
  else if (score >= 25) label = "Moderately Bearish";
  else label = "Strong Bearish";

  // Sort factors by absolute weight (most impactful first)
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
    const prediction = generatePrediction(markets, insights);

    return NextResponse.json({
      markets,
      insights,
      prediction,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch global markets" }, { status: 500 });
  }
}
