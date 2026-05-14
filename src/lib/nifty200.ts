// Back-compat shim. New code should import from "@/lib/markets" and the
// per-market universes under "@/lib/universe/*".
import { NSE_ALL_SYMBOLS } from "./universe/nseAll";

export { toYahooSymbol, fromYahooSymbol } from "./markets";

// Legacy name. Now points at the full NSE EQ universe instead of just Nifty 500.
export const NIFTY_500_SYMBOLS: string[] = NSE_ALL_SYMBOLS;
