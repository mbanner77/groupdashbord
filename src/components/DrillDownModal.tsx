"use client";

import { useState, useEffect } from "react";
import { Sparkline } from "./Sparkline";

type EntityDetail = {
  code: string;
  name: string;
  value: number;
  plan: number;
  variance: number;
  variancePercent: number;
  monthly: number[];
};

type DrillDownModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  kpi: "umsatz" | "ebit" | "headcount";
  month: number;
  year: number;
};

const MONTH_NAMES = ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export function DrillDownModal({ isOpen, onClose, title, kpi, month, year }: DrillDownModalProps) {
  const [data, setData] = useState<EntityDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<"value" | "variance">("value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/kpis?year=${year}&cutoffMonth=12`);
        if (res.ok) {
          const d = await res.json();
          const entities: EntityDetail[] = (d.entities || [])
            .filter((e: { isAggregate?: boolean }) => !e.isAggregate)
            .map((e: { code: string; name: string; umsatz: number; ebit: number; headcount: number; umsatzPlan?: number; ebitPlan?: number; headcountPlan?: number }) => {
              const value = kpi === "umsatz" ? e.umsatz : kpi === "ebit" ? e.ebit : e.headcount;
              const plan = kpi === "umsatz" ? (e.umsatzPlan || 0) : kpi === "ebit" ? (e.ebitPlan || 0) : (e.headcountPlan || 0);
              const variance = value - plan;
              const variancePercent = plan !== 0 ? (variance / Math.abs(plan)) * 100 : 0;
              return {
                code: e.code,
                name: e.name,
                value,
                plan,
                variance,
                variancePercent,
                monthly: [], // Would need additional API call for monthly data
              };
            });
          setData(entities);
        }
      } catch (e) {
        console.error("Failed to load drill-down data", e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, kpi, year]);

  const sortedData = [...data].sort((a, b) => {
    const aVal = sortBy === "value" ? a.value : a.variancePercent;
    const bVal = sortBy === "value" ? b.value : b.variancePercent;
    return sortDir === "desc" ? bVal - aVal : aVal - bVal;
  });

  const formatValue = (v: number) => {
    if (kpi === "headcount") return Math.round(v).toLocaleString("de-DE");
    return (v / 1000).toFixed(0) + " T€";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
            <p className="text-sm text-slate-500">
              {MONTH_NAMES[month - 1]} {year} - {kpi === "umsatz" ? "Umsatz" : kpi === "ebit" ? "EBIT" : "Headcount"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-3 dark:border-slate-700">
          <span className="text-xs text-slate-500">Sortieren nach:</span>
          <button
            onClick={() => { setSortBy("value"); setSortDir(d => d === "desc" ? "asc" : "desc"); }}
            className={`rounded px-2 py-1 text-xs font-medium ${sortBy === "value" ? "bg-sky-100 text-sky-700" : "text-slate-600 hover:bg-slate-100"}`}
          >
            Wert {sortBy === "value" && (sortDir === "desc" ? "↓" : "↑")}
          </button>
          <button
            onClick={() => { setSortBy("variance"); setSortDir(d => d === "desc" ? "asc" : "desc"); }}
            className={`rounded px-2 py-1 text-xs font-medium ${sortBy === "variance" ? "bg-sky-100 text-sky-700" : "text-slate-600 hover:bg-slate-100"}`}
          >
            Abweichung {sortBy === "variance" && (sortDir === "desc" ? "↓" : "↑")}
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
            </div>
          ) : (
            <div className="space-y-3">
              {sortedData.map((entity) => {
                const maxValue = Math.max(...data.map((d) => Math.abs(d.value)));
                const barWidth = maxValue > 0 ? (Math.abs(entity.value) / maxValue) * 100 : 0;
                const isPositive = entity.variancePercent >= 0;

                return (
                  <div
                    key={entity.code}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-4 transition hover:border-slate-200 dark:border-slate-700 dark:bg-slate-700/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-900 dark:text-white">{entity.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-slate-900 dark:text-white">
                          {formatValue(entity.value)}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          isPositive 
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                        }`}>
                          {isPositive ? "+" : ""}{entity.variancePercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-600">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isPositive ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>Plan: {formatValue(entity.plan)}</span>
                      <span>Δ {formatValue(entity.variance)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
