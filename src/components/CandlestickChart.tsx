"use client";
import { useEffect, useRef, useState } from "react";
import {
  createChart,
  createSeriesMarkers,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
} from "lightweight-charts";
import type { IChartApi, UTCTimestamp } from "lightweight-charts";

interface ChartProps {
  symbol: string;
  indicators?: string[];
  signalDetails?: string;
  signal?: "BUY" | "SELL" | "NEUTRAL";
  isIndex?: boolean;
}

const TIMEFRAMES = [
  { id: "1m", label: "1M", tip: "1-Minute candles. Last 1 day of trading. Best for scalping and intraday momentum." },
  { id: "5m", label: "5M", tip: "5-Minute candles. Last 5 days. Popular for intraday trading and quick swing trades." },
  { id: "15m", label: "15M", tip: "15-Minute candles. Last 10 days. Good balance of detail and trend visibility for day trading." },
  { id: "1h", label: "1H", tip: "1-Hour candles. Last 60 days. Ideal for swing trading and spotting multi-day patterns." },
  { id: "1d", label: "1D", tip: "Daily candles. Last 200 days (~9 months). The most common timeframe for technical analysis and positional trading." },
  { id: "1wk", label: "1W", tip: "Weekly candles. Last 3 years. Shows major trends and long-term support/resistance levels." },
  { id: "1mo", label: "1MO", tip: "Monthly candles. Last 5 years. Reveals secular trends and major market cycles." },
];

const INDICATOR_OPTIONS = [
  { id: "sma20", label: "SMA 20", color: "#fbbf24", tip: "Simple Moving Average (20-period). Average of last 20 closing prices. Acts as short-term dynamic support/resistance." },
  { id: "sma50", label: "SMA 50", color: "#3b82f6", tip: "Simple Moving Average (50-period). Average of last 50 closes. Medium-term trend indicator. Price above = bullish, below = bearish." },
  { id: "sma200", label: "SMA 200", color: "#8b5cf6", tip: "Simple Moving Average (200-period). The most watched long-term trend indicator. A 'golden cross' (50-SMA crossing above 200-SMA) is a major bullish signal." },
  { id: "ema9", label: "EMA 9", color: "#f97316", tip: "Exponential Moving Average (9-period). Faster than SMA, gives more weight to recent prices. Used for short-term swing trading signals." },
  { id: "ema21", label: "EMA 21", color: "#06b6d4", tip: "Exponential Moving Average (21-period). Combined with EMA 9 for crossover signals. EMA 9 > EMA 21 = bullish momentum." },
  { id: "bb", label: "Bollinger", color: "#6366f1", tip: "Bollinger Bands (20-period, 2 std dev). Upper/lower bands show volatility envelope. Squeeze (narrow bands) = breakout coming. Price at upper band = overbought, lower = oversold." },
  { id: "rsi", label: "RSI", color: "#a855f7", tip: "Relative Strength Index (14-period). Oscillator 0-100. Above 70 = overbought, below 30 = oversold. Formula: RSI = 100 - 100/(1+RS), RS = avg gain / avg loss." },
  { id: "macd", label: "MACD", color: "#10b981", tip: "Moving Average Convergence Divergence. MACD Line = 12-EMA minus 26-EMA. Signal Line = 9-EMA of MACD. Histogram = MACD - Signal. Bullish when MACD crosses above Signal." },
  { id: "supertrend", label: "Supertrend", color: "#ef4444", tip: "Supertrend (10-period, 3x ATR). Trend-following indicator. Green (below price) = bullish, Red (above price) = bearish. Calculated using ATR to set dynamic stop-loss levels." },
];

const OVERLAY_COLORS: Record<string, string> = {
  "SMA 20": "#fbbf24",
  "SMA 50": "#3b82f6",
  "SMA 200": "#8b5cf6",
  "EMA 9": "#f97316",
  "EMA 21": "#06b6d4",
  "BB Upper": "#6366f1",
  "BB Middle": "#6366f180",
  "BB Lower": "#6366f1",
};

export default function CandlestickChart({
  symbol,
  indicators = [],
  signalDetails,
  signal,
  isIndex = false,
}: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndicators, setActiveIndicators] = useState<string[]>(indicators);
  const [timeframe, setTimeframe] = useState("1d");

  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "#0a0a0f" },
        textColor: "#9ca3af",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      width: container.clientWidth,
      height: 500,
      crosshair: {
        mode: 0,
        vertLine: { color: "rgba(255,255,255,0.1)", labelBackgroundColor: "#1a1a2e" },
        horzLine: { color: "rgba(255,255,255,0.1)", labelBackgroundColor: "#1a1a2e" },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.05)",
        timeVisible: ["1m", "5m", "15m", "1h"].includes(timeframe),
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.05)" },
    });

    chartRef.current = chart;

    setLoading(true);
    const indexParam = isIndex ? "&index=1" : "";
    fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&indicators=${activeIndicators.join(",")}&tf=${timeframe}${indexParam}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ohlc) { setLoading(false); return; }

        type TimePoint = { time: UTCTimestamp; value: number; color?: string };
        const asTime = (t: number) => t as UTCTimestamp;

        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: "#10b981",
          downColor: "#ef4444",
          borderDownColor: "#ef4444",
          borderUpColor: "#10b981",
          wickDownColor: "#ef4444",
          wickUpColor: "#10b981",
        });
        candleSeries.setData(
          data.ohlc.map((c: any) => ({ ...c, time: asTime(c.time) }))
        );

        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
        });
        chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
        volumeSeries.setData(
          data.volumes.map((v: any) => ({ ...v, time: asTime(v.time) }))
        );

        const toLineData = (pts: any[]): TimePoint[] =>
          pts.map((p) => ({ time: asTime(p.time), value: p.value, color: p.color }));

        const indicatorEntries = Object.entries((data.indicators || {}) as Record<string, any[]>);

        for (const [name, points] of indicatorEntries) {
          if (["RSI", "MACD", "Signal", "Histogram"].includes(name)) continue;

          if (name === "Supertrend") {
            const series = chart.addSeries(LineSeries, {
              color: "#10b981", lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
            });
            series.setData(toLineData(points));
          } else {
            const series = chart.addSeries(LineSeries, {
              color: OVERLAY_COLORS[name] || "#888",
              lineWidth: name.includes("BB") ? 1 : 2,
              priceLineVisible: false,
              lastValueVisible: false,
              lineStyle: name === "BB Middle" ? 2 : 0,
            });
            series.setData(toLineData(points));
          }
        }

        // RSI pane
        const rsiRaw = (data.indicators || {})["RSI"] as any[] | undefined;
        if (rsiRaw && rsiRaw.length > 0) {
          const rsiData = toLineData(rsiRaw);
          const rsiPane = chart.addPane();
          rsiPane.setStretchFactor(0.25);
          const rsiSeries = rsiPane.addSeries(LineSeries, {
            color: "#a855f7", lineWidth: 2, priceLineVisible: false, lastValueVisible: true,
          });
          rsiSeries.setData(rsiData);
          const rsi70 = rsiPane.addSeries(LineSeries, { color: "rgba(239,68,68,0.3)", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
          rsi70.setData(rsiData.map((p) => ({ time: p.time, value: 70 })));
          const rsi30 = rsiPane.addSeries(LineSeries, { color: "rgba(16,185,129,0.3)", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
          rsi30.setData(rsiData.map((p) => ({ time: p.time, value: 30 })));
        }

        // MACD pane
        const macdRaw = (data.indicators || {})["MACD"] as any[] | undefined;
        const signalRaw = (data.indicators || {})["Signal"] as any[] | undefined;
        const histRaw = (data.indicators || {})["Histogram"] as any[] | undefined;
        if (macdRaw && macdRaw.length > 0) {
          const macdPane = chart.addPane();
          macdPane.setStretchFactor(0.25);
          if (histRaw && histRaw.length > 0) {
            const histSeries = macdPane.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
            histSeries.setData(toLineData(histRaw));
          }
          const macdSeries = macdPane.addSeries(LineSeries, { color: "#10b981", lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
          macdSeries.setData(toLineData(macdRaw));
          if (signalRaw && signalRaw.length > 0) {
            const signalSeries = macdPane.addSeries(LineSeries, { color: "#ef4444", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
            signalSeries.setData(toLineData(signalRaw));
          }
        }

        // Signal marker
        if (signal && signal !== "NEUTRAL" && data.ohlc.length > 0) {
          const lastCandle = data.ohlc[data.ohlc.length - 1];
          createSeriesMarkers(candleSeries, [{
            time: asTime(lastCandle.time),
            position: signal === "BUY" ? "belowBar" : "aboveBar",
            color: signal === "BUY" ? "#10b981" : "#ef4444",
            shape: signal === "BUY" ? "arrowUp" : "arrowDown",
            text: signal,
          }]);
        }

        chart.timeScale().fitContent();
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    };
  }, [symbol, activeIndicators, signal, timeframe, isIndex]);

  const toggleIndicator = (id: string) => {
    setActiveIndicators((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
      {/* Signal banner */}
      {signalDetails && (
        <div className={`px-4 py-2.5 text-sm border-b ${
          signal === "BUY" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
          signal === "SELL" ? "bg-red-500/10 border-red-500/20 text-red-400" :
          "bg-white/5 border-white/5 text-gray-400"
        }`}>
          <span className="font-semibold">{signal} Signal:</span> {signalDetails}
        </div>
      )}

      {/* Timeframe tabs + Indicator toggles */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 border-b border-white/5">
        {/* Timeframes */}
        <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-lg p-0.5 mr-2">
          {TIMEFRAMES.map((tf) => (
            <span key={tf.id} className="relative group">
              <button
                onClick={() => setTimeframe(tf.id)}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                  timeframe === tf.id
                    ? "bg-blue-500/20 text-blue-400"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {tf.label}
              </button>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-xs text-gray-300 w-56 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 shadow-xl leading-relaxed">
                {tf.tip}
              </span>
            </span>
          ))}
        </div>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Indicators */}
        {INDICATOR_OPTIONS.map((opt) => (
          <span key={opt.id} className="relative group">
            <button
              onClick={() => toggleIndicator(opt.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border ${
                activeIndicators.includes(opt.id)
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-white/5 text-gray-500 hover:text-gray-300"
              }`}
              style={activeIndicators.includes(opt.id) ? { borderColor: opt.color + "60", color: opt.color } : {}}
            >
              {opt.label}
            </button>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-xs text-gray-300 w-64 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 shadow-xl leading-relaxed">
              {opt.tip}
            </span>
          </span>
        ))}
      </div>

      {/* Chart */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]/80 z-10">
            <svg className="animate-spin h-6 w-6 text-blue-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
        <div ref={chartContainerRef} />
      </div>
    </div>
  );
}
