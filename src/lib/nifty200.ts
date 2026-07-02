// Back-compat shim. New code should import from "@/lib/markets" and the
// per-market universes under "@/lib/universe/*".
import { IN_TOP500_SYMBOLS } from "./universe/inTop500";

export { toYahooSymbol, fromYahooSymbol } from "./markets";

// Legacy name. Points at the official NIFTY 500 constituents (top 500 NSE stocks).
export const NIFTY_500_SYMBOLS: string[] = IN_TOP500_SYMBOLS;
