"use client";
import { useEffect, useRef } from "react";
import {
  createChart, AreaSeries, ColorType, LineStyle, createSeriesMarkers,
} from "lightweight-charts";
import type { IChartApi, UTCTimestamp, SeriesMarker, Time } from "lightweight-charts";

export interface EquityPoint {
  date: string;     // YYYY-MM-DD
  equity: number;
}

export interface TradeMarker {
  date: string;     // YYYY-MM-DD
  action: "BUY" | "SELL";
  symbol: string;
  quantity: number;
  price: number;
}

interface Props {
  startingCapital: number;
  currencySymbol: string;
  data: EquityPoint[];
  trades: TradeMarker[];
}

export default function BotEquityChart({ startingCapital, currencySymbol, data, trades }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: false, secondsVisible: false },
      crosshair: { mode: 1 },
      handleScale: true,
      handleScroll: true,
    });
    chartRef.current = chart;

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#3b82f6",
      topColor: "rgba(59, 130, 246, 0.4)",
      bottomColor: "rgba(59, 130, 246, 0.0)",
      lineWidth: 2,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });

    const points = data
      .filter((p) => p.equity != null && !isNaN(p.equity))
      .map((p) => ({
        time: Math.floor(new Date(p.date + "T00:00:00Z").getTime() / 1000) as UTCTimestamp,
        value: p.equity,
      }));
    series.setData(points);

    // Starting-capital reference line.
    series.createPriceLine({
      price: startingCapital,
      color: "rgba(255,255,255,0.25)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "Starting",
    });

    // BUY/SELL markers grouped by date so a single day shows one combined marker
    // (and tooltip shows all that day's trades).
    const byDate: Record<string, TradeMarker[]> = {};
    for (const t of trades) (byDate[t.date] ||= []).push(t);

    const markers: SeriesMarker<Time>[] = [];
    for (const date of Object.keys(byDate).sort()) {
      const list = byDate[date];
      const buys = list.filter((t) => t.action === "BUY");
      const sells = list.filter((t) => t.action === "SELL");
      const time = Math.floor(new Date(date + "T00:00:00Z").getTime() / 1000) as UTCTimestamp;
      if (buys.length > 0) {
        markers.push({
          time,
          position: "belowBar",
          color: "#10b981",
          shape: "arrowUp",
          text: buys.length === 1 ? `B ${buys[0].symbol}` : `B ×${buys.length}`,
        });
      }
      if (sells.length > 0) {
        markers.push({
          time,
          position: "aboveBar",
          color: "#ef4444",
          shape: "arrowDown",
          text: sells.length === 1 ? `S ${sells[0].symbol}` : `S ×${sells.length}`,
        });
      }
    }
    if (markers.length > 0) createSeriesMarkers(series, markers);

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, trades, startingCapital, currencySymbol]);

  return <div ref={containerRef} className="w-full" />;
}
