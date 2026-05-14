import type { Market } from "./markets";

export interface ETF {
  symbol: string;
  name: string;
  theme: string;
  note?: string;
}

// India ETFs listed on NSE. Symbols match NSE tickers (yahoo: SYMBOL.NS).
export const IN_ETFS: ETF[] = [
  // Broad Market
  { symbol: "NIFTYBEES", name: "Nippon India Nifty 50 ETF", theme: "Broad Market", note: "Tracks Nifty 50" },
  { symbol: "SETFNIF50", name: "SBI Nifty 50 ETF", theme: "Broad Market", note: "Tracks Nifty 50" },
  { symbol: "JUNIORBEES", name: "Nippon India Nifty Next 50 ETF", theme: "Broad Market", note: "Tracks Nifty Next 50" },
  { symbol: "NV20BEES", name: "Nippon India Nifty 50 Value 20 ETF", theme: "Broad Market", note: "Quality value tilt" },
  { symbol: "MIDCAPETF", name: "Mirae Asset Nifty Midcap 150 ETF", theme: "Broad Market", note: "Mid-cap exposure" },
  { symbol: "SMALLCAP", name: "Nippon India Nifty Smallcap 250 ETF", theme: "Broad Market", note: "Small-cap exposure" },
  { symbol: "SETFNN50", name: "SBI Nifty Next 50 ETF", theme: "Broad Market" },

  // Sector
  { symbol: "BANKBEES", name: "Nippon India Nifty Bank ETF", theme: "Sector", note: "Nifty Bank index" },
  { symbol: "ITBEES", name: "Nippon India Nifty IT ETF", theme: "Sector", note: "IT services & products" },
  { symbol: "PSUBNKBEES", name: "Nippon India Nifty PSU Bank ETF", theme: "Sector", note: "Public-sector banks" },
  { symbol: "INFRABEES", name: "Nippon India Nifty Infra ETF", theme: "Sector" },
  { symbol: "CONSUMBEES", name: "Nippon India Nifty Consumption ETF", theme: "Sector" },
  { symbol: "PHARMABEES", name: "Nippon India Nifty Pharma ETF", theme: "Sector" },
  { symbol: "AUTOBEES", name: "Nippon India Nifty Auto ETF", theme: "Sector" },
  { symbol: "FMCGIETF", name: "Mirae Asset Nifty FMCG ETF", theme: "Sector" },

  // Smart Beta / Strategy
  { symbol: "MOM100", name: "Motilal Oswal Nifty 200 Momentum 30 ETF", theme: "Smart Beta", note: "Momentum factor" },
  { symbol: "ALPHAETF", name: "Nippon India Nifty Alpha 50 ETF", theme: "Smart Beta", note: "Alpha factor" },
  { symbol: "LOWVOLIETF", name: "Mirae Asset Nifty 100 Low Volatility 30 ETF", theme: "Smart Beta", note: "Low volatility" },
  { symbol: "QUAL30IETF", name: "Mirae Asset Nifty 100 Quality 30 ETF", theme: "Smart Beta", note: "Quality factor" },
  { symbol: "DIVOPPBEES", name: "Nippon India Nifty Dividend Opportunities ETF", theme: "Smart Beta", note: "Dividend tilt" },

  // International
  { symbol: "MAFANG", name: "Mirae Asset NYSE FANG+ ETF", theme: "International", note: "US tech mega-caps" },
  { symbol: "MASPTOP50", name: "Mirae Asset S&P 500 Top 50 ETF", theme: "International", note: "US large-caps" },
  { symbol: "MON100", name: "Motilal Oswal Nasdaq 100 ETF", theme: "International", note: "Nasdaq 100 exposure" },
  { symbol: "HNGSNGBEES", name: "Nippon India ETF Hang Seng BeES", theme: "International", note: "Hong Kong large-caps" },

  // Commodities
  { symbol: "GOLDBEES", name: "Nippon India Gold ETF", theme: "Commodities", note: "Tracks gold price" },
  { symbol: "GOLDIETF", name: "ICICI Prudential Gold ETF", theme: "Commodities", note: "Gold" },
  { symbol: "GOLDSHARE", name: "UTI Gold ETF", theme: "Commodities", note: "Gold" },
  { symbol: "SILVERBEES", name: "Nippon India Silver ETF", theme: "Commodities", note: "Tracks silver price" },
  { symbol: "SILVERIETF", name: "ICICI Prudential Silver ETF", theme: "Commodities", note: "Silver" },

  // Bonds / Debt
  { symbol: "LIQUIDBEES", name: "Nippon India Liquid ETF", theme: "Bonds & Debt", note: "Overnight liquidity" },
  { symbol: "BHARATBOND", name: "BHARAT Bond ETF", theme: "Bonds & Debt", note: "Govt-backed PSU bonds" },
  { symbol: "GSEC10IETF", name: "ICICI Prudential GSec 10Y ETF", theme: "Bonds & Debt", note: "10Y G-Sec" },
  { symbol: "LIQUIDETF", name: "DSP Liquid ETF", theme: "Bonds & Debt" },
];

// US ETFs (Yahoo tickers, no suffix).
export const US_ETFS: ETF[] = [
  // Broad Market
  { symbol: "SPY", name: "SPDR S&P 500 ETF", theme: "Broad Market", note: "Tracks S&P 500" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", theme: "Broad Market", note: "Tracks S&P 500" },
  { symbol: "IVV", name: "iShares Core S&P 500 ETF", theme: "Broad Market", note: "Tracks S&P 500" },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF", theme: "Broad Market", note: "US total market" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", theme: "Broad Market", note: "Nasdaq 100" },
  { symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF", theme: "Broad Market", note: "Dow 30" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", theme: "Broad Market", note: "US small-caps" },
  { symbol: "MDY", name: "SPDR S&P MidCap 400 ETF", theme: "Broad Market", note: "US mid-caps" },

  // Sector (SPDR sector ETFs)
  { symbol: "XLK", name: "Technology Select Sector SPDR", theme: "Sector", note: "Big tech" },
  { symbol: "XLF", name: "Financial Select Sector SPDR", theme: "Sector", note: "Banks & financials" },
  { symbol: "XLV", name: "Health Care Select Sector SPDR", theme: "Sector", note: "Healthcare" },
  { symbol: "XLE", name: "Energy Select Sector SPDR", theme: "Sector", note: "Oil & gas" },
  { symbol: "XLY", name: "Consumer Discretionary Select Sector SPDR", theme: "Sector" },
  { symbol: "XLP", name: "Consumer Staples Select Sector SPDR", theme: "Sector" },
  { symbol: "XLI", name: "Industrial Select Sector SPDR", theme: "Sector" },
  { symbol: "XLU", name: "Utilities Select Sector SPDR", theme: "Sector" },
  { symbol: "XLB", name: "Materials Select Sector SPDR", theme: "Sector" },
  { symbol: "XLRE", name: "Real Estate Select Sector SPDR", theme: "Sector" },
  { symbol: "XLC", name: "Communication Services Select Sector SPDR", theme: "Sector" },

  // Thematic / Trend
  { symbol: "SMH", name: "VanEck Semiconductor ETF", theme: "Thematic", note: "Semiconductors" },
  { symbol: "SOXX", name: "iShares Semiconductor ETF", theme: "Thematic", note: "Semiconductors" },
  { symbol: "ARKK", name: "ARK Innovation ETF", theme: "Thematic", note: "Disruptive innovation" },
  { symbol: "ARKW", name: "ARK Next Generation Internet ETF", theme: "Thematic", note: "Internet & tech" },
  { symbol: "ICLN", name: "iShares Global Clean Energy ETF", theme: "Thematic", note: "Clean energy" },
  { symbol: "TAN", name: "Invesco Solar ETF", theme: "Thematic", note: "Solar" },
  { symbol: "ROBO", name: "ROBO Global Robotics & Automation ETF", theme: "Thematic", note: "Robotics" },
  { symbol: "BOTZ", name: "Global X Robotics & AI ETF", theme: "Thematic", note: "Robotics & AI" },
  { symbol: "XBI", name: "SPDR S&P Biotech ETF", theme: "Thematic", note: "Biotech" },
  { symbol: "CIBR", name: "First Trust Nasdaq Cybersecurity ETF", theme: "Thematic", note: "Cybersecurity" },

  // International
  { symbol: "EFA", name: "iShares MSCI EAFE ETF", theme: "International", note: "Developed ex-US" },
  { symbol: "VEA", name: "Vanguard FTSE Developed Markets ETF", theme: "International", note: "Developed ex-US" },
  { symbol: "EEM", name: "iShares MSCI Emerging Markets ETF", theme: "International", note: "Emerging markets" },
  { symbol: "VWO", name: "Vanguard FTSE Emerging Markets ETF", theme: "International", note: "Emerging markets" },
  { symbol: "FXI", name: "iShares China Large-Cap ETF", theme: "International", note: "China" },
  { symbol: "EWJ", name: "iShares MSCI Japan ETF", theme: "International", note: "Japan" },
  { symbol: "INDA", name: "iShares MSCI India ETF", theme: "International", note: "India" },

  // Bonds
  { symbol: "AGG", name: "iShares Core US Aggregate Bond ETF", theme: "Bonds & Debt", note: "US investment-grade" },
  { symbol: "BND", name: "Vanguard Total Bond Market ETF", theme: "Bonds & Debt", note: "US investment-grade" },
  { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF", theme: "Bonds & Debt", note: "Long-duration Treasuries" },
  { symbol: "IEF", name: "iShares 7-10 Year Treasury Bond ETF", theme: "Bonds & Debt", note: "Intermediate Treasuries" },
  { symbol: "SHY", name: "iShares 1-3 Year Treasury Bond ETF", theme: "Bonds & Debt", note: "Short-duration Treasuries" },
  { symbol: "HYG", name: "iShares iBoxx High Yield Corporate Bond ETF", theme: "Bonds & Debt", note: "High-yield credit" },
  { symbol: "LQD", name: "iShares iBoxx Investment Grade Corporate Bond ETF", theme: "Bonds & Debt", note: "IG credit" },

  // Commodities
  { symbol: "GLD", name: "SPDR Gold Shares", theme: "Commodities", note: "Gold" },
  { symbol: "IAU", name: "iShares Gold Trust", theme: "Commodities", note: "Gold" },
  { symbol: "SLV", name: "iShares Silver Trust", theme: "Commodities", note: "Silver" },
  { symbol: "USO", name: "United States Oil Fund", theme: "Commodities", note: "WTI crude" },
  { symbol: "UNG", name: "United States Natural Gas Fund", theme: "Commodities", note: "Natural gas" },
  { symbol: "DBC", name: "Invesco DB Commodity Index Tracking Fund", theme: "Commodities", note: "Diversified commodities" },

  // Real Estate
  { symbol: "VNQ", name: "Vanguard Real Estate ETF", theme: "Real Estate", note: "US REITs" },
  { symbol: "IYR", name: "iShares US Real Estate ETF", theme: "Real Estate", note: "US REITs" },

  // Dividend / Income
  { symbol: "VYM", name: "Vanguard High Dividend Yield ETF", theme: "Dividend & Income" },
  { symbol: "SCHD", name: "Schwab US Dividend Equity ETF", theme: "Dividend & Income" },
  { symbol: "DVY", name: "iShares Select Dividend ETF", theme: "Dividend & Income" },
  { symbol: "NOBL", name: "ProShares S&P 500 Dividend Aristocrats ETF", theme: "Dividend & Income", note: "Aristocrats" },

  // Volatility
  { symbol: "VIXY", name: "ProShares VIX Short-Term Futures ETF", theme: "Volatility", note: "Long VIX" },
  { symbol: "VXX", name: "iPath Series B S&P 500 VIX Short-Term Futures ETN", theme: "Volatility", note: "Long VIX" },
];

export function getETFs(market: Market): ETF[] {
  return market === "US" ? US_ETFS : IN_ETFS;
}

export function getETFThemes(market: Market): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const e of getETFs(market)) {
    if (!seen.has(e.theme)) {
      seen.add(e.theme);
      order.push(e.theme);
    }
  }
  return order;
}
