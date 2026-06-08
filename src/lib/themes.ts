import type { Market } from "./markets";

// ─────────────────────────────────────────────────────────────────────────────
// Thematic investment baskets. Each theme groups stocks that ride a single
// structural trend. Symbols are plain tickers (Yahoo suffix added per market).
// Some picks sit outside the core index (valid Yahoo tickers) — that's fine, the
// screener fetches any symbol.
// ─────────────────────────────────────────────────────────────────────────────

export interface ThemeGroup {
  key: string;
  label: string;
  icon: string;
  blurb: string;
  symbols: string[];
}

export const IN_THEMES: ThemeGroup[] = [
  {
    key: "ai-it", label: "AI & IT Services", icon: "🤖",
    blurb: "Indian IT majors and AI/engineering-services players building and deploying AI for global clients.",
    symbols: ["TCS", "INFY", "HCLTECH", "WIPRO", "TECHM", "LTIM", "PERSISTENT", "COFORGE", "MPHASIS", "TATAELXSI", "LTTS", "KPITTECH"],
  },
  {
    key: "ai-datacenter", label: "AI Data Centers & Digital Infra", icon: "🏢",
    blurb: "Telecom, fibre, networking and data-center build-out powering India's AI and cloud demand.",
    symbols: ["BHARTIARTL", "RELIANCE", "TATACOMM", "STLTECH", "HFCL", "TEJASNET", "NETWEB", "ANANTRAJ", "RAILTEL", "TANLA"],
  },
  {
    key: "deeptech", label: "Deep Tech & Electronics", icon: "🔬",
    blurb: "Electronics manufacturing, semiconductors-adjacent and advanced-tech plays — India's closest exposure to quantum/next-gen compute.",
    symbols: ["DIXON", "KAYNES", "SYRMA", "CGPOWER", "AMBER", "NETWEB", "TATAELXSI", "POLYCAB", "AVALON"],
  },
  {
    key: "energy-power", label: "Energy & Power", icon: "⚡",
    blurb: "Power generation, transmission and utilities — the backbone of industrial and AI-driven electricity demand.",
    symbols: ["NTPC", "POWERGRID", "TATAPOWER", "ADANIPOWER", "JSWENERGY", "NHPC", "SJVN", "TORNTPOWER", "CESC", "ADANIENSOL"],
  },
  {
    key: "renewables", label: "Renewable & Green Energy", icon: "🌱",
    blurb: "Solar, wind and clean-energy manufacturers and developers riding India's energy-transition push.",
    symbols: ["ADANIGREEN", "SUZLON", "INOXWIND", "WAAREEENER", "KPIGREEN", "JSWENERGY", "TATAPOWER", "NHPC", "ORIENTGREEN"],
  },
  {
    key: "oil-gas", label: "Oil & Gas", icon: "🛢️",
    blurb: "Upstream explorers, refiners and gas distributors.",
    symbols: ["RELIANCE", "ONGC", "OIL", "IOC", "BPCL", "HINDPETRO", "GAIL", "PETRONET", "IGL", "MGL", "GUJGASLTD"],
  },
  {
    key: "robotics", label: "Robotics & Automation", icon: "🦾",
    blurb: "Industrial automation, capital goods and electrification leaders.",
    symbols: ["ABB", "SIEMENS", "CGPOWER", "HONAUT", "THERMAX", "BHEL", "KAYNES", "ABBOTINDIA"],
  },
  {
    key: "agriculture", label: "Agriculture & Agri-Inputs", icon: "🌾",
    blurb: "Fertilisers, agrochemicals, seeds and crop-protection companies.",
    symbols: ["UPL", "COROMANDEL", "PIIND", "BAYERCROP", "RALLIS", "CHAMBLFERT", "GNFC", "DEEPAKFERT", "KSCL", "DHANUKA", "SUMICHEM"],
  },
  {
    key: "defence", label: "Defence & Aerospace", icon: "🛡️",
    blurb: "Defence manufacturing, shipbuilding and aerospace — beneficiaries of indigenisation and capex.",
    symbols: ["HAL", "BEL", "BDL", "MAZDOCK", "COCHINSHIP", "BEML", "DATAPATTNS", "PARAS", "ZENTEC", "SOLARINDS"],
  },
  {
    key: "ev-auto", label: "EV & Auto", icon: "🚗",
    blurb: "Automakers and EV-supply-chain names through the electrification transition.",
    symbols: ["TATAMOTORS", "M&M", "MARUTI", "BAJAJ-AUTO", "EICHERMOT", "TVSMOTOR", "ASHOKLEY", "OLECTRA", "EXIDEIND", "HEROMOTOCO"],
  },
  {
    key: "banks-fin", label: "Banking & Financials", icon: "🏦",
    blurb: "Private and public banks, NBFCs and insurers — the engine of the broader market.",
    symbols: ["HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK", "BAJFINANCE", "BAJAJFINSV", "INDUSINDBK", "PNB", "BANKBARODA"],
  },
  {
    key: "pharma", label: "Pharma & Healthcare", icon: "💊",
    blurb: "Drugmakers, hospitals and diagnostics.",
    symbols: ["SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "BIOCON", "LUPIN", "AUROPHARMA", "ZYDUSLIFE", "APOLLOHOSP", "MAXHEALTH"],
  },
  {
    key: "fmcg", label: "FMCG & Consumer", icon: "🛒",
    blurb: "Consumer staples and discretionary brands.",
    symbols: ["HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "DABUR", "MARICO", "GODREJCP", "COLPAL", "VBL", "TATACONSUM"],
  },
];

export const US_THEMES: ThemeGroup[] = [
  {
    key: "ai-semis", label: "AI & Semiconductors", icon: "🤖",
    blurb: "The chips and accelerators that train and run AI.",
    symbols: ["NVDA", "AMD", "AVGO", "MU", "QCOM", "INTC", "MRVL", "TSM", "ASML", "SMCI", "ARM", "LRCX"],
  },
  {
    key: "ai-datacenter", label: "AI Data Centers & Power", icon: "🏢",
    blurb: "Data-center networking, cooling, REITs and the power producers feeding AI compute.",
    symbols: ["NVDA", "AVGO", "ANET", "EQIX", "DLR", "VRT", "SMCI", "CEG", "VST", "NRG", "ETN", "GEV"],
  },
  {
    key: "quantum", label: "Quantum Computing", icon: "⚛️",
    blurb: "Pure-play quantum names plus the megacaps with serious quantum programs.",
    symbols: ["IBM", "IONQ", "RGTI", "QBTS", "GOOGL", "MSFT", "HON", "QUBT"],
  },
  {
    key: "energy-oil", label: "Energy & Oil", icon: "🛢️",
    blurb: "Integrated majors, E&P, services and refiners.",
    symbols: ["XOM", "CVX", "COP", "EOG", "SLB", "MPC", "PSX", "VLO", "OXY", "WMB", "KMI", "HAL"],
  },
  {
    key: "cloud-software", label: "IT & Cloud Software", icon: "☁️",
    blurb: "Enterprise software, cloud platforms and data infrastructure.",
    symbols: ["MSFT", "GOOGL", "AMZN", "CRM", "ORCL", "ADBE", "NOW", "SNOW", "PLTR", "DDOG", "NET", "MDB"],
  },
  {
    key: "robotics", label: "Robotics & Automation", icon: "🦾",
    blurb: "Industrial robotics, automation and motion control.",
    symbols: ["ISRG", "ROK", "ABB", "EMR", "HON", "TER", "PH", "ZBRA", "IRBT"],
  },
  {
    key: "agriculture", label: "Agriculture", icon: "🌾",
    blurb: "Farm equipment, fertilisers, seeds and agribusiness.",
    symbols: ["DE", "ADM", "CTVA", "MOS", "CF", "BG", "AGCO", "FMC", "TSN", "NTR"],
  },
  {
    key: "defense", label: "Defense & Aerospace", icon: "🛡️",
    blurb: "Primes, munitions and aerospace suppliers.",
    symbols: ["LMT", "RTX", "NOC", "GD", "BA", "LHX", "HII", "AXON", "LDOS", "TDG"],
  },
  {
    key: "ev", label: "EV & Clean Mobility", icon: "🚗",
    blurb: "EV makers, legacy autos electrifying, and battery materials.",
    symbols: ["TSLA", "RIVN", "LCID", "F", "GM", "ALB", "APTV", "ON"],
  },
  {
    key: "cyber", label: "Cybersecurity", icon: "🔒",
    blurb: "The security software stack — endpoint, network and identity.",
    symbols: ["CRWD", "PANW", "ZS", "FTNT", "S", "OKTA", "CYBR", "GEN"],
  },
  {
    key: "megacap-tech", label: "Megacap Tech", icon: "💎",
    blurb: "The largest technology platforms driving index returns.",
    symbols: ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "AVGO"],
  },
  {
    key: "healthcare", label: "Healthcare & Biotech", icon: "💊",
    blurb: "Pharma, managed care, devices and biotech leaders.",
    symbols: ["LLY", "UNH", "JNJ", "ABBV", "MRK", "PFE", "AMGN", "GILD", "VRTX", "REGN"],
  },
];

export function getThemes(market: Market): ThemeGroup[] {
  return market === "US" ? US_THEMES : IN_THEMES;
}
