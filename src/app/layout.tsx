import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

// Set NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX in .env.local (or shell env at build time).
// When empty, GA simply isn't loaded — site works fine without it.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://juicedtrade.com";
const SITE_NAME = "JuicedTrade";
const SITE_TAGLINE = "JuicedTrade Stock Screener · 110 Strategies for NSE & S&P 500";
const SITE_DESCRIPTION =
  "JuicedTrade is a free stock screener for Indian (NSE) and US (S&P 500) markets. Run 110 trading strategies across 2,100+ NSE stocks and the S&P 500, scan ETFs by theme, get daily buy/sell signals, and watch two autonomous paper-trading bots — an intraday trader and a long-term investor — make decisions every day.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TAGLINE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "JuicedTrade", url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  keywords: [
    "stock screener",
    "Indian stock screener",
    "NSE stock screener",
    "Nifty 500 screener",
    "S&P 500 screener",
    "US stock screener",
    "free stock screener",
    "trading strategies screener",
    "stock backtesting",
    "ETF screener",
    "Bollinger Bands screener",
    "RSI screener",
    "MACD screener",
    "Supertrend screener",
    "BSE stock screener",
    "stock signals India",
    "trading bot India",
    "Nifty buy sell signals",
    "candlestick patterns screener",
    "JuicedTrade",
  ],
  category: "finance",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TAGLINE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TAGLINE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

// Structured data — Schema.org. Optimized for ARO (AI search engines like
// ChatGPT, Perplexity, Claude search) which lean on FAQ + SoftwareApplication
// signals to surface and quote pages.
const jsonLdSoftware = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "JuicedTrade Stock Screener",
  "alternateName": ["JuicedTrade", "JuicedTrade Screener"],
  "url": SITE_URL,
  "applicationCategory": "FinanceApplication",
  "applicationSubCategory": "Stock Screener",
  "operatingSystem": "Web",
  "browserRequirements": "Requires a modern web browser. No download required.",
  "description": SITE_DESCRIPTION,
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
  },
  "featureList": [
    "110 trading strategies from classic trading literature and open-source quant research",
    "Scan all 2,100+ NSE-listed stocks and 500 S&P 500 stocks",
    "Daily buy / sell / neutral signals across every strategy",
    "Two autonomous paper-trading bots: an intraday trader and a long-term investor",
    "ETF screener grouped by theme with buy/hold/sell recommendation",
    "Backtesting on 1-year history across an index plus 5 cross-validation stocks",
    "Market overview with pivots, Fibonacci, key supports & resistances",
    "Global market cues with India + US market prediction",
    "Notable holders & insider transaction tracking",
    "Interactive candlestick charts with 7 timeframes and 20+ indicators",
  ],
  "creator": {
    "@type": "Organization",
    "name": SITE_NAME,
    "url": SITE_URL,
  },
};

const jsonLdOrganization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": SITE_NAME,
  "url": SITE_URL,
  "description": "JuicedTrade builds a free, strategy-driven stock screener for retail traders and investors covering Indian (NSE) and US (S&P 500) markets.",
};

const jsonLdFaq = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is JuicedTrade?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "JuicedTrade is a free stock screener that evaluates 2,100+ NSE-listed Indian stocks and all 500 S&P 500 US stocks against 110 trading strategies adapted from classic trading literature and open-source quant research. It gives daily buy/sell/neutral signals, an ETF screener, two autonomous paper-trading bots (an intraday trader and a long-term investor), market overview dashboards, and backtesting.",
      },
    },
    {
      "@type": "Question",
      "name": "Which markets does JuicedTrade cover?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "JuicedTrade covers two markets: India (NSE, all listed equities, around 2,100 symbols) and the United States (S&P 500). You can switch markets from the header toggle at any time, and the screener, ETF list, signals, and trading bot all adapt to the active market.",
      },
    },
    {
      "@type": "Question",
      "name": "Is JuicedTrade free?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. JuicedTrade is free during the public beta. There is no sign-up, no credit card, and no paid tier. Open the app and start screening immediately.",
      },
    },
    {
      "@type": "Question",
      "name": "Does JuicedTrade place real trades?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. JuicedTrade does not connect to any brokerage account and cannot place real orders. The built-in bots — an intraday trader and a long-term investor — are paper-trading simulators that each start with ₹10,00,000 (India) or $5,000 (US), buy high-conviction signals, and manage risk with stops and rotation, purely to demonstrate strategy performance over time.",
      },
    },
    {
      "@type": "Question",
      "name": "How many trading strategies does JuicedTrade use?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "JuicedTrade evaluates every stock against 110 strategies covering swing trading, intraday, positional, scalping, options proxies, price action, candlestick patterns, value investing, trend following, index investing, and quant/ML models. The strategies are adapted from classic trading literature plus open-source quant research and signal concepts.",
      },
    },
    {
      "@type": "Question",
      "name": "How is JuicedTrade different from TradingView, Screener.in, or Chartink?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "TradingView is a charting platform, Screener.in is a fundamental screener, and Chartink runs single-condition technical scans. JuicedTrade is different in three ways: (1) it evaluates 110 named strategies in parallel and shows which ones agree, instead of forcing you to compose a single condition; (2) it covers both NSE and S&P 500 in one tool with one toggle; (3) it ships two autonomous paper-trading bots (an intraday trader and a long-term investor) that act on the same strategy library, so you can see what consistent strategy-following would have produced.",
      },
    },
    {
      "@type": "Question",
      "name": "What data does JuicedTrade use?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "JuicedTrade uses live market price, volume, and historical OHLC data from public market feeds, refreshed daily. The NSE and S&P 500 universes are sourced from official exchange listings. All indicators, strategy signals, and backtests are computed inside JuicedTrade. There is no third-party signal provider.",
      },
    },
    {
      "@type": "Question",
      "name": "Can I backtest a strategy on JuicedTrade?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Every strategy ships with a one-click backtest that runs on the market's primary index (Nifty 50 or S&P 500) plus five major stocks for cross-validation, over the trailing year, with a 10-day hold. The report shows win rate, average return, max win/loss, peak return, drawdown, and the full trade history.",
      },
    },
    {
      "@type": "Question",
      "name": "What is the JuicedTrade trading bot?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The Bot Performance tab runs two autonomous paper-trading bots per market: a Long-Term Investor that holds positions across days with a trailing stop and rotates into stronger names, and an Intraday Trader that takes same-day round trips and stays flat overnight. Both use a multi-factor decision engine (trend, momentum, mean-reversion, volatility, plus a fundamental quality tilt for the long-term bot), size positions by risk, hold at most 5 names, and reinvest profits. Each plots an equity curve with buy/sell markers.",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const t = localStorage.getItem('strategyScreenerTheme');
            if (t) document.documentElement.setAttribute('data-theme', t);
          } catch(e) {}
        `}} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSoftware) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganization) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
      {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
    </html>
  );
}
