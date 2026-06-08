"use client";
import { useMemo, useState } from "react";

interface Trade {
  date: string;
  action: "BUY" | "SELL";
  symbol: string;
  quantity: number;
  price: number;
  total: number;
  realizedPnL?: number;
  reason: string;
}
interface Snap { date: string; equity: number; tradesCount: number; }

// Daily profit/loss histogram. X-axis = trading day, bar height = that day's P&L
// (equity change), green above the zero line for a gain, red below for a loss.
// Click any bar to see the trades made that day.
export default function BotDailyPnL({
  snapshots, startingCapital, trades, fmtMoney, fmtPrice,
}: {
  snapshots: Snap[];
  startingCapital: number;
  trades: Trade[];
  fmtMoney: (n: number) => string;
  fmtPrice: (n: number) => string;
}) {
  const days = useMemo(() => {
    let prev = startingCapital;
    return snapshots.map((s) => {
      const pnl = s.equity - prev;
      prev = s.equity;
      return { date: s.date, pnl, equity: s.equity, tradesCount: s.tradesCount };
    });
  }, [snapshots, startingCapital]);

  const [selected, setSelected] = useState<string | null>(days.length ? days[days.length - 1].date : null);

  const maxAbs = Math.max(1, ...days.map((d) => Math.abs(d.pnl)));
  const selDay = days.find((d) => d.date === selected) || null;
  const dayTrades = selected ? trades.filter((t) => t.date === selected) : [];

  if (days.length === 0) {
    return <div className="h-40 flex items-center justify-center text-sm text-gray-500">No history yet.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Histogram */}
      <div className="-mx-1 overflow-x-auto">
        <div className="flex items-stretch gap-[3px] px-1 min-w-full" style={{ minWidth: days.length * 14 }}>
          {days.map((d) => {
            const pct = (Math.abs(d.pnl) / maxAbs) * 100;
            const up = d.pnl >= 0;
            const isSel = d.date === selected;
            return (
              <button
                key={d.date}
                onClick={() => setSelected(d.date)}
                title={`${d.date}: ${d.pnl >= 0 ? "+" : "-"}${fmtMoney(Math.abs(d.pnl))} · ${d.tradesCount} trades`}
                className={`group relative flex-1 min-w-[10px] h-[160px] flex flex-col rounded-sm transition-colors ${isSel ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}
              >
                {/* top half (gains grow down to the zero line) */}
                <div className="flex-1 flex items-end justify-center">
                  {up && (
                    <div
                      className={`w-full rounded-t-sm ${isSel ? "bg-emerald-400" : "bg-emerald-500/70 group-hover:bg-emerald-500"}`}
                      style={{ height: `${pct}%` }}
                    />
                  )}
                </div>
                {/* zero line */}
                <div className="h-px bg-white/15" />
                {/* bottom half (losses grow up from the zero line) */}
                <div className="flex-1 flex items-start justify-center">
                  {!up && (
                    <div
                      className={`w-full rounded-b-sm ${isSel ? "bg-red-400" : "bg-red-500/70 group-hover:bg-red-500"}`}
                      style={{ height: `${pct}%` }}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {/* sparse date axis */}
        <div className="flex justify-between px-1 mt-1 text-[9px] text-gray-600 font-mono">
          <span>{days[0].date}</span>
          {days.length > 2 && <span>{days[Math.floor(days.length / 2)].date}</span>}
          <span>{days[days.length - 1].date}</span>
        </div>
      </div>

      {/* Selected-day detail */}
      {selDay && (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold font-mono text-gray-200">{selDay.date}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${selDay.pnl >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                {selDay.pnl >= 0 ? "+" : "-"}{fmtMoney(Math.abs(selDay.pnl))} on the day
              </span>
            </div>
            <span className="text-[11px] text-gray-500">{dayTrades.length} trade{dayTrades.length === 1 ? "" : "s"}</span>
          </div>
          {dayTrades.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              No trades this day — open positions were simply marked to market.
            </div>
          ) : (
            <div className="max-h-[320px] overflow-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="text-[10px] text-gray-500 uppercase tracking-wider bg-white/[0.02] sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2">Action</th>
                    <th className="text-left px-4 py-2">Symbol</th>
                    <th className="text-right px-4 py-2">Qty</th>
                    <th className="text-right px-4 py-2">Price</th>
                    <th className="text-right px-4 py-2">Realized</th>
                    <th className="text-left px-4 py-2">Reason</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {dayTrades.map((t, i) => (
                    <tr key={`${t.date}-${i}`} className="border-t border-white/5">
                      <td className="px-4 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.action === "BUY" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                          {t.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-semibold text-blue-400">{t.symbol}</td>
                      <td className="text-right px-4 py-2">{t.quantity}</td>
                      <td className="text-right px-4 py-2 text-gray-300">{fmtPrice(t.price)}</td>
                      <td className={`text-right px-4 py-2 text-[11px] ${t.realizedPnL == null ? "text-gray-600" : t.realizedPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {t.realizedPnL == null ? "—" : `${t.realizedPnL >= 0 ? "+" : "-"}${fmtMoney(Math.abs(t.realizedPnL))}`}
                      </td>
                      <td className="px-4 py-2 text-[11px] text-gray-500 max-w-md truncate" title={t.reason}>{t.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
