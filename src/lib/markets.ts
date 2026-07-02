import { SP500_SYMBOLS } from "./universe/sp500";
import { IN_TOP500_SYMBOLS } from "./universe/inTop500";
import { IN_BOT_UNIVERSE } from "./universe/inBotUniverse";
import { US_BOT_UNIVERSE } from "./universe/usBotUniverse";

export type Market = "IN" | "US";

export const DEFAULT_MARKET: Market = "IN";

export interface MarketIndex {
  symbol: string;
  name: string;
}

export interface MarketConfig {
  market: Market;
  label: string;
  flag: string;
  currency: "INR" | "USD";
  currencySymbol: "₹" | "$";
  locale: string;
  yahooSuffix: string;
  primaryIndex: MarketIndex;
  secondaryIndex: MarketIndex;
  indices: MarketIndex[];
  universe: string[];
  universeLabel: string;
  insiderUniverse: string[];
  backtestStocks: string[];
  botUniverse: string[]; // curated, liquid universe the auto-bot trades against
  botStartingCapital: number;
}

const IN: MarketConfig = {
  market: "IN",
  label: "India",
  flag: "🇮🇳",
  currency: "INR",
  currencySymbol: "₹",
  locale: "en-IN",
  yahooSuffix: ".NS",
  primaryIndex: { symbol: "^NSEI", name: "NIFTY 50" },
  secondaryIndex: { symbol: "^BSESN", name: "SENSEX" },
  indices: [
    { symbol: "^NSEI", name: "NIFTY 50" },
    { symbol: "^BSESN", name: "SENSEX" },
  ],
  universe: IN_TOP500_SYMBOLS,
  universeLabel: `NIFTY 500 (${IN_TOP500_SYMBOLS.length})`,
  insiderUniverse: IN_BOT_UNIVERSE.slice(0, 30),
  backtestStocks: ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK"],
  botUniverse: IN_BOT_UNIVERSE,
  botStartingCapital: 1_000_000, // ₹10 lakh
};

const US: MarketConfig = {
  market: "US",
  label: "USA",
  flag: "🇺🇸",
  currency: "USD",
  currencySymbol: "$",
  locale: "en-US",
  yahooSuffix: "",
  primaryIndex: { symbol: "^GSPC", name: "S&P 500" },
  secondaryIndex: { symbol: "^DJI", name: "DOW" },
  indices: [
    { symbol: "^GSPC", name: "S&P 500" },
    { symbol: "^DJI", name: "DOW" },
    { symbol: "^IXIC", name: "NASDAQ" },
  ],
  universe: SP500_SYMBOLS,
  universeLabel: `S&P ${SP500_SYMBOLS.length}`,
  insiderUniverse: ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "BRK.B", "JPM", "V", "XOM", "UNH", "JNJ", "WMT", "MA", "PG", "HD", "AVGO", "CVX", "LLY", "ABBV", "PFE", "KO", "PEP", "BAC", "CSCO", "ORCL", "ADBE", "CRM", "NFLX"],
  backtestStocks: ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN"],
  botUniverse: US_BOT_UNIVERSE,
  botStartingCapital: 5_000, // $5,000
};

const CONFIGS: Record<Market, MarketConfig> = { IN, US };

export function getMarket(market?: string | null): Market {
  const m = (market || "").toUpperCase();
  return m === "US" ? "US" : "IN";
}

export function getMarketConfig(market?: string | Market | null): MarketConfig {
  return CONFIGS[getMarket(market)];
}

// Yahoo Finance ticker conversion.
// India: append .NS (e.g. RELIANCE -> RELIANCE.NS)
// US: replace "." with "-" for share classes (BRK.B -> BRK-B); no suffix
export function toYahooSymbol(symbol: string, market: Market | string = "IN"): string {
  const m = getMarket(market);
  if (m === "US") return symbol.replace(/\./g, "-");
  return `${symbol}${CONFIGS.IN.yahooSuffix}`;
}

export function fromYahooSymbol(yahooSymbol: string, market: Market | string = "IN"): string {
  const m = getMarket(market);
  if (m === "US") return yahooSymbol.replace(/-/g, ".");
  return yahooSymbol.replace(CONFIGS.IN.yahooSuffix, "");
}

export function formatCurrency(value: number, market: Market | string = "IN", decimals = 2): string {
  const cfg = getMarketConfig(market);
  const sign = value < 0 ? "-" : "";
  return `${sign}${cfg.currencySymbol}${Math.abs(value).toLocaleString(cfg.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}
