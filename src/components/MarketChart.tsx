"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const CandlestickChart = dynamic(() => import("./CandlestickChart"), { ssr: false });

interface IndexData {
  name: string;
  symbol: string;
  currentPrice: number;
  change: number;
  changePct: number;
  trend: string;
  rsi: number | null;
  atr: number;
  pivots: { pivot: number; r1: number; s1: number; r2: number; s2: number };
  fibonacci: Record<string, number>;
  keySupports: number[];
  keyResistances: number[];
  targets: { bullishTarget1: number; bullishTarget2: number; bearishTarget1: number; bearishTarget2: number };
  yearHigh: number;
  yearLow: number;
}

function Tip({ text }: { text: string }) {
  return (
    <span className="relative group ml-1 cursor-help">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white/5 text-[9px] text-gray-500 font-bold border border-white/10">i</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-xs text-gray-300 w-64 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 shadow-xl leading-relaxed">
        {text}
      </span>
    </span>
  );
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export default function MarketChart() {
  const [data, setData] = useState<IndexData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch("/api/market")
      .then((r) => r.json())
      .then((d) => { setData(d.indices); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-16 w-full rounded-xl" />
        <div className="skeleton h-[520px] w-full rounded-xl" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <div className="text-center text-gray-500 py-12">Failed to load market data</div>;
  }

  const idx = data[activeIndex];

  return (
    <div className="space-y-4">
      {/* Index selector tabs */}
      <div className="flex items-center gap-3">
        {data.map((d, i) => (
          <button key={d.symbol} onClick={() => setActiveIndex(i)}
            className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all ${activeIndex === i ? "bg-white/[0.05] border-white/15 shadow-lg" : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"}`}>
            <div>
              <div className="text-sm font-bold">{d.name}</div>
              <div className="text-lg font-bold font-mono">{fmt(d.currentPrice)}</div>
            </div>
            <div className={`text-right text-sm font-mono ${d.changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {d.changePct >= 0 ? "+" : ""}{d.changePct.toFixed(2)}%
              <div className="text-xs">{d.changePct >= 0 ? "+" : ""}{d.change.toFixed(2)}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className={`px-3 py-1.5 rounded-lg border text-sm font-semibold ${
          idx.trend === "BULLISH" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
          idx.trend === "BEARISH" ? "bg-red-500/10 border-red-500/20 text-red-400" :
          "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
        }`}>
          {idx.trend}
          <Tip text="Trend is determined by price position relative to 50-SMA and 200-SMA. BULLISH = price > 50-SMA > 200-SMA. BEARISH = price < 50-SMA < 200-SMA. SIDEWAYS = mixed alignment." />
        </div>
        <div className="text-xs text-gray-500">
          RSI: <span className={`font-mono font-semibold ${(idx.rsi || 0) > 70 ? "text-red-400" : (idx.rsi || 0) < 30 ? "text-emerald-400" : "text-white"}`}>{idx.rsi?.toFixed(1) || "N/A"}</span>
          <Tip text="Relative Strength Index (14-period). Measures momentum on a 0-100 scale. Above 70 = overbought (potential reversal down). Below 30 = oversold (potential reversal up). Calculated as: RSI = 100 - (100 / (1 + RS)), where RS = Avg Gain / Avg Loss over 14 periods." />
        </div>
        <div className="text-xs text-gray-500">
          ATR: <span className="font-mono text-white">{idx.atr.toFixed(2)}</span>
          <Tip text="Average True Range (14-period). Measures daily volatility in points. Higher ATR = more volatile market. Calculated as the smoothed average of True Range = max(High-Low, |High-PrevClose|, |Low-PrevClose|)." />
        </div>
        <div className="text-xs text-gray-500">
          52W: <span className="font-mono text-emerald-400">{idx.yearHigh.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
          {" / "}
          <span className="font-mono text-red-400">{idx.yearLow.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
          <Tip text="52-week high and low. The highest and lowest prices recorded in the past 1 year of trading." />
        </div>
      </div>

      {/* Chart with timeframes built in */}
      <CandlestickChart
        symbol={idx.symbol}
        indicators={["sma50", "sma200"]}
        isIndex={true}
      />

      {/* Key levels panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Support & Resistance */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Support & Resistance
            <Tip text="Automatically detected from local swing highs (resistance) and swing lows (support) in the last 60 trading days. Nearby levels within 1% are clustered into a single zone. These are prices where the market has previously reversed direction." />
          </h3>
          <div className="space-y-2">
            {idx.keyResistances.slice().reverse().map((r, i) => (
              <div key={`r-${i}`} className="flex items-center justify-between">
                <span className="text-xs text-red-400">Resistance {idx.keyResistances.length - i}</span>
                <span className="text-sm font-mono font-semibold text-red-400">{fmt(r)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-1 border-y border-white/10">
              <span className="text-xs text-white font-semibold">Current Price</span>
              <span className="text-sm font-mono font-bold text-white">{fmt(idx.currentPrice)}</span>
            </div>
            {idx.keySupports.map((s, i) => (
              <div key={`s-${i}`} className="flex items-center justify-between">
                <span className="text-xs text-emerald-400">Support {i + 1}</span>
                <span className="text-sm font-mono font-semibold text-emerald-400">{fmt(s)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pivot Points */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Pivot Points
            <Tip text="Standard Pivot Points calculated from previous day's High, Low, Close. Pivot (P) = (H+L+C)/3. R1 = 2P - L. S1 = 2P - H. R2 = P + (H-L). S2 = P - (H-L). These act as intraday support and resistance levels. Price above R1 is bullish, below S1 is bearish." />
          </h3>
          <div className="space-y-2">
            {[
              { label: "R2", value: idx.pivots.r2, color: "text-red-400" },
              { label: "R1", value: idx.pivots.r1, color: "text-orange-400" },
              { label: "Pivot", value: idx.pivots.pivot, color: "text-gray-300" },
              { label: "S1", value: idx.pivots.s1, color: "text-green-400" },
              { label: "S2", value: idx.pivots.s2, color: "text-emerald-400" },
            ].map((p) => (
              <div key={p.label} className="flex items-center justify-between">
                <span className={`text-xs font-medium ${p.color}`}>{p.label}</span>
                <span className={`text-sm font-mono font-semibold ${p.color}`}>{fmt(p.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Targets & Fibonacci */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Targets
            <Tip text="Projected price targets based on ATR (Average True Range). Bullish T1 = Current Price + 1.5x ATR. Bullish T2 = Current Price + 3x ATR. Bearish targets use the same multiples downward. ATR represents expected daily movement." />
          </h3>
          <div className="space-y-2 mb-4">
            {[
              { label: "Bullish T2", value: idx.targets.bullishTarget2, color: "text-emerald-400" },
              { label: "Bullish T1", value: idx.targets.bullishTarget1, color: "text-emerald-400" },
              { label: "Bearish T1", value: idx.targets.bearishTarget1, color: "text-red-400" },
              { label: "Bearish T2", value: idx.targets.bearishTarget2, color: "text-red-400" },
            ].map((t) => (
              <div key={t.label} className="flex items-center justify-between">
                <span className={`text-xs ${t.color}`}>{t.label}</span>
                <span className={`text-sm font-mono font-semibold ${t.color}`}>{t.value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
              </div>
            ))}
          </div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Fibonacci (60D)
            <Tip text="Fibonacci retracement levels calculated from the 60-day swing high and swing low. Key levels: 23.6%, 38.2%, 50%, 61.8%, 78.6%. In an uptrend, price tends to retrace to these levels before continuing. 61.8% (golden ratio) is the most significant." />
          </h3>
          <div className="space-y-1">
            {[
              { label: "100%", value: idx.fibonacci.level100 },
              { label: "78.6%", value: idx.fibonacci.level786 },
              { label: "61.8%", value: idx.fibonacci.level618 },
              { label: "50%", value: idx.fibonacci.level500 },
              { label: "38.2%", value: idx.fibonacci.level382 },
              { label: "23.6%", value: idx.fibonacci.level236 },
              { label: "0%", value: idx.fibonacci.level0 },
            ].map((f) => (
              <div key={f.label} className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500">{f.label}</span>
                <span className="text-xs font-mono text-gray-400">{f.value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
