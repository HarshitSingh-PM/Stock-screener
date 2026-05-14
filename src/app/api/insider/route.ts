import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { getNotableHolders } from "@/lib/notableHolders";
import { toYahooSymbol, getMarket, getMarketConfig, Market } from "@/lib/markets";

const yahooFinance = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey"] });

export const maxDuration = 60;

interface InsiderHolder {
  name: string;
  relation: string;
  positionDirect: number;
  latestTransDate: string;
  transactionDescription: string;
}

interface InsiderTransaction {
  filerName: string;
  filerRelation: string;
  transactionText: string;
  shares: number;
  value: number;
  startDate: string;
  ownership: string;
}

async function fetchInsiderData(symbol: string, market: Market) {
  try {
    const yahooSym = toYahooSymbol(symbol, market);
    const data: any = await yahooFinance.quoteSummary(yahooSym, {
      modules: ["insiderHolders", "insiderTransactions", "majorHoldersBreakdown"],
    });

    const holders: InsiderHolder[] = (data.insiderHolders?.holders || []).map((h: any) => ({
      name: h.name || "Unknown",
      relation: h.relation || "Unknown",
      positionDirect: h.positionDirect || 0,
      latestTransDate: h.latestTransDate ? new Date(h.latestTransDate).toISOString().split("T")[0] : "",
      transactionDescription: h.transactionDescription || "",
    }));

    const transactions: InsiderTransaction[] = (data.insiderTransactions?.transactions || []).map((t: any) => ({
      filerName: t.filerName || "Unknown",
      filerRelation: t.filerRelation || "Unknown",
      transactionText: t.transactionText || "",
      shares: t.shares || 0,
      value: t.value || 0,
      startDate: t.startDate ? new Date(t.startDate).toISOString().split("T")[0] : "",
      ownership: t.ownership || "D",
    }));

    const breakdown = data.majorHoldersBreakdown ? {
      insidersPercent: ((data.majorHoldersBreakdown.insidersPercentHeld || 0) * 100).toFixed(2),
      institutionsPercent: ((data.majorHoldersBreakdown.institutionsPercentHeld || 0) * 100).toFixed(2),
      institutionsFloatPercent: ((data.majorHoldersBreakdown.institutionsFloatPercentHeld || 0) * 100).toFixed(2),
      institutionsCount: data.majorHoldersBreakdown.institutionsCount || 0,
    } : null;

    return { holders, transactions, breakdown };
  } catch {
    return { holders: [], transactions: [], breakdown: null };
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol");
  const tab = searchParams.get("tab") || "holders"; // holders | deals | bulk
  const market = getMarket(searchParams.get("market"));
  const cfg = getMarketConfig(market);

  const marketHolders = getNotableHolders(market);

  // If a specific symbol is requested, fetch its insider data
  if (symbol) {
    const data = await fetchInsiderData(symbol, market);

    // Find notable holders for this symbol (within active market)
    const notable = marketHolders.filter(h =>
      h.holdings.some(holding => holding.symbol === symbol.toUpperCase())
    ).map(h => ({
      name: h.name,
      type: h.type,
      description: h.description,
      holding: h.holdings.find(holding => holding.symbol === symbol.toUpperCase()),
    }));

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      market,
      ...data,
      notableHolders: notable,
    });
  }

  // No symbol: return curated data based on tab
  if (tab === "holders") {
    const types = Array.from(new Set(marketHolders.map((h) => h.type)));
    return NextResponse.json({
      market,
      holders: marketHolders,
      types,
    });
  }

  if (tab === "deals" || tab === "bulk") {
    // Fetch recent insider transactions from top stocks for the active market
    const topStocks = cfg.insiderUniverse;

    const allTransactions: any[] = [];

    // Fetch in batches of 5
    for (let i = 0; i < topStocks.length; i += 5) {
      const batch = topStocks.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (sym) => {
          const data = await fetchInsiderData(sym, market);
          return data.transactions.map(t => ({ ...t, symbol: sym }));
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled") allTransactions.push(...r.value);
      }
    }

    // Sort by date (newest first)
    allTransactions.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    if (tab === "bulk") {
      // Filter for large deals: >1cr (INR) / >$1M (USD), or >1 lakh shares
      const valueThreshold = market === "US" ? 1_000_000 : 10_000_000;
      const bulkDeals = allTransactions.filter(t => t.value > valueThreshold || t.shares > 100000);
      const valueDesc = market === "US" ? "$1M value" : "1 crore value";
      return NextResponse.json({
        deals: bulkDeals,
        total: bulkDeals.length,
        note: `Transactions >${valueDesc} or >1 lakh shares from top ${topStocks.length} ${cfg.label} stocks. Source: Yahoo Finance.`,
        market,
      });
    }

    // All deals
    return NextResponse.json({
      deals: allTransactions.slice(0, 100), // Cap at 100 most recent
      total: allTransactions.length,
      note: `Recent insider transactions from top ${topStocks.length} ${cfg.label} stocks. Source: Yahoo Finance.`,
      market,
    });
  }

  return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
}
