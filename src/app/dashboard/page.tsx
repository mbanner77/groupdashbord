"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

interface KpiData {
  year: number;
  cutoffMonth: number;
  kpis: {
    umsatz: {
      plan: number;
      actual: number;
      variance: number;
      variancePercent: number;
      monthly: Array<{ month: number; plan: number; actual: number }>;
    };
    ebit: {
      plan: number;
      actual: number;
      variance: number;
      variancePercent: number;
      monthly: Array<{ month: number; plan: number; actual: number }>;
    };
    ebitMargin: {
      plan: number;
      actual: number;
      monthly: Array<{ month: number; plan: number; actual: number }>;
    };
    headcount: {
      plan: number;
      actual: number;
      variance: number;
      variancePercent: number;
      monthly: Array<{ month: number; plan: number; actual: number }>;
    };
    revenuePerHead: {
      plan: number;
      actual: number;
      monthly: Array<{ month: number; plan: number; actual: number }>;
    };
    priorYearComparison: {
      umsatz: { current: number; priorYear: number; changePercent: number };
      ebit: { current: number; priorYear: number; changePercent: number };
    };
  };
  entities: Array<{
    code: string;
    name: string;
    umsatz: number;
    ebit: number;
    ebitMargin: number;
    headcount: number;
  }>;
}

const MONTHS = ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const COLORS = ["#0ea5e9", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#84cc16"];

function Sparkline({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = height - ((v - min) / range) * (height - 4);
    return `${x},${y}`;
  }).join(" ");
  
  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-64 bg-slate-200 dark:bg-slate-700 rounded mt-2" />
          </div>
          <div className="flex gap-3">
            <div className="h-10 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="h-10 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="h-10 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg">
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded mt-3" />
            <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded mt-2" />
            <div className="h-10 w-full bg-slate-200 dark:bg-slate-700 rounded mt-4" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg">
            <div className="h-5 w-40 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
            <div className="h-[280px] bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const formatPercent = (v: number) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v) + "%";

function KpiCard({
  title,
  actual,
  plan,
  variance,
  variancePercent,
  format = "currency",
  icon,
  sparklineData,
  sparklineColor,
  delay = 0,
}: {
  title: string;
  actual: number;
  plan: number;
  variance?: number;
  variancePercent?: number;
  format?: "currency" | "percent" | "number";
  icon: React.ReactNode;
  sparklineData?: number[];
  sparklineColor?: string;
  delay?: number;
}) {
  const formatValue = (v: number) => {
    if (format === "percent") return formatPercent(v);
    if (format === "number") return Math.round(v).toLocaleString("de-DE");
    return formatCurrency(v);
  };

  const isPositive = (variancePercent ?? 0) >= 0;

  return (
    <div 
      className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700 transition-all duration-500 hover:shadow-xl hover:-translate-y-0.5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</div>
          <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white truncate">{formatValue(actual)}</div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Plan: {formatValue(plan)}</div>
        </div>
        <div className="rounded-xl bg-slate-100 dark:bg-slate-700 p-3 flex-shrink-0">{icon}</div>
      </div>
      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-4 opacity-60">
          <Sparkline data={sparklineData} color={sparklineColor || "#94a3b8"} />
        </div>
      )}
      {variancePercent !== undefined && (
        <div className="mt-4 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
              isPositive 
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
            }`}
          >
            {isPositive ? "↑" : "↓"} {formatPercent(Math.abs(variancePercent))}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">vs. Plan</span>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700 transition-shadow hover:shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
        {actions}
      </div>
      <div className="h-[280px]">{children}</div>
    </div>
  );
}

function AlertBadge({ variancePercent }: { variancePercent: number }) {
  const absVariance = Math.abs(variancePercent);
  if (absVariance < 10) return null;
  
  const isNegative = variancePercent < 0;
  return (
    <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
      isNegative ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
    }`}>
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      {absVariance.toFixed(0)}% Abweichung
    </span>
  );
}

type UserInfo = {
  isAdmin: boolean;
  entities: Array<{ code: string; name: string; canEdit: boolean }>;
  viewableEntityCodes: string[];
};

export default function DashboardPage() {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [compareYear, setCompareYear] = useState<number | null>(null);
  const [compareData, setCompareData] = useState<KpiData | null>(null);
  const [cutoffMonth, setCutoffMonth] = useState(12);
  const [selectedEntity, setSelectedEntity] = useState<string>("group");
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [showCumulative, setShowCumulative] = useState(false);
  const [sortColumn, setSortColumn] = useState<"umsatz" | "ebit" | "ebitMargin" | "headcount">("umsatz");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEntityDetail, setSelectedEntityDetail] = useState<string | null>(null);
  const [entityDetailData, setEntityDetailData] = useState<KpiData | null>(null);
  const [loadingEntityDetail, setLoadingEntityDetail] = useState(false);

  useEffect(() => {
    // Load user info and years
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/years").then((r) => r.json()),
    ]).then(([user, years]) => {
      setUserInfo(user);
      setAvailableYears(years.all || []);
      if (years.available?.length > 0 && !years.available.includes(year)) {
        setYear(years.available[0]);
      }
    }).catch(() => {});
  }, []);

  const loadData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      const settings = await fetch("/api/settings/forecast-cutoff").then((r) => r.json());
      const cm = Number(settings?.cutoffMonth) || 12;
      setCutoffMonth(cm);

      const entityParam = selectedEntity !== "group" ? `&entity=${selectedEntity}` : "";
      const res = await fetch(`/api/kpis?year=${year}&cutoffMonth=${cm}${entityParam}`);
      if (!res.ok) throw new Error("Failed to load KPIs");
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());

      if (compareYear && compareYear !== year) {
        const compareRes = await fetch(`/api/kpis?year=${compareYear}&cutoffMonth=${cm}${entityParam}`);
        if (compareRes.ok) {
          setCompareData(await compareRes.json());
        }
      } else {
        setCompareData(null);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [year, compareYear, selectedEntity]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      
      if (e.key === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        loadData(true);
      }
      if (e.key === "c" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowCumulative(prev => !prev);
      }
      if (e.key === "Escape") {
        setSelectedEntityDetail(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loadData]);

  // Load entity detail data when modal opens
  useEffect(() => {
    if (!selectedEntityDetail) {
      setEntityDetailData(null);
      return;
    }
    const loadEntityDetail = async () => {
      setLoadingEntityDetail(true);
      try {
        const res = await fetch(`/api/kpis?year=${year}&cutoffMonth=${cutoffMonth}&entity=${selectedEntityDetail}`);
        if (res.ok) {
          setEntityDetailData(await res.json());
        }
      } catch (e) {
        console.error("Failed to load entity detail", e);
      } finally {
        setLoadingEntityDetail(false);
      }
    };
    loadEntityDetail();
  }, [selectedEntityDetail, year, cutoffMonth]);

  const exportToExcel = () => {
    if (!data) return;
    
    const headers = ["Monat", "Umsatz Plan", "Umsatz IST/FC", "EBIT Plan", "EBIT IST/FC", "Headcount Plan", "Headcount IST/FC"];
    const rows = data.kpis.umsatz.monthly.map((u, i) => [
      MONTHS[i],
      u.plan,
      u.actual,
      data.kpis.ebit.monthly[i]?.plan ?? 0,
      data.kpis.ebit.monthly[i]?.actual ?? 0,
      data.kpis.headcount.monthly[i]?.plan ?? 0,
      data.kpis.headcount.monthly[i]?.actual ?? 0,
    ]);
    
    const csvContent = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kpi-export-${year}-${selectedEntity}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sortedEntities = useMemo(() => {
    if (!data) return [];
    return [...data.entities].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [data, sortColumn, sortDirection]);

  const toggleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ column }: { column: typeof sortColumn }) => (
    <span className={`ml-1 inline-block transition-transform ${sortColumn === column ? "opacity-100" : "opacity-0"}`}>
      {sortDirection === "desc" ? "↓" : "↑"}
    </span>
  );

  // useMemo must be called before any early returns to maintain hooks order
  const monthlyData = useMemo(() => {
    if (!data) return [];
    const kpis = data.kpis;
    let umsatzPlanCum = 0, umsatzActualCum = 0, ebitPlanCum = 0, ebitActualCum = 0;
    return kpis.umsatz.monthly.map((u, i) => {
      umsatzPlanCum += u.plan;
      umsatzActualCum += u.actual;
      ebitPlanCum += kpis.ebit.monthly[i]?.plan ?? 0;
      ebitActualCum += kpis.ebit.monthly[i]?.actual ?? 0;
      return {
        month: MONTHS[i],
        umsatzPlan: showCumulative ? umsatzPlanCum : u.plan,
        umsatzActual: showCumulative ? umsatzActualCum : u.actual,
        ebitPlan: showCumulative ? ebitPlanCum : (kpis.ebit.monthly[i]?.plan ?? 0),
        ebitActual: showCumulative ? ebitActualCum : (kpis.ebit.monthly[i]?.actual ?? 0),
      };
    });
  }, [data, showCumulative]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-rose-50 p-6 text-rose-700">
        Fehler beim Laden der KPIs: {error}
      </div>
    );
  }

  const { kpis, entities } = data;

  const marginData = kpis.ebitMargin.monthly.map((m, i) => ({
    month: MONTHS[i],
    plan: m.plan,
    actual: m.actual,
  }));

  const headcountData = kpis.headcount.monthly.map((h, i) => ({
    month: MONTHS[i],
    plan: h.plan,
    actual: h.actual,
  }));

  const entityPieData = entities
    .filter((e) => e.umsatz > 0)
    .sort((a, b) => b.umsatz - a.umsatz)
    .slice(0, 8);

  const tooltipStyle = {
    borderRadius: 12,
    border: "none",
    background: "rgba(15, 23, 42, 0.95)",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.25)",
    padding: "12px 16px",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200/60 dark:bg-slate-800 dark:ring-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">KPI Dashboard</h1>
            <p className="mt-1 text-slate-600 dark:text-slate-400">
              Übersicht aller wichtigen Kennzahlen für {year} (IST bis Monat {cutoffMonth})
              {lastUpdated && (
                <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                  • Aktualisiert {lastUpdated.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400 dark:text-slate-500">
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-700 px-2 py-0.5">
                <kbd className="font-mono">R</kbd> Aktualisieren
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-700 px-2 py-0.5">
                <kbd className="font-mono">C</kbd> Kumuliert
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">vs.</span>
              <select
                value={compareYear ?? ""}
                onChange={(e) => setCompareYear(e.target.value ? Number(e.target.value) : null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              >
                <option value="">Kein Vergleich</option>
                {availableYears.filter((y) => y !== year).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              <option value="group">Gruppe (Gesamt)</option>
              {(userInfo?.isAdmin ? entities : userInfo?.entities || []).map((e) => (
                <option key={e.code} value={e.code}>
                  {e.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50"
              title="Daten aktualisieren (R)"
            >
              <svg className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={exportToExcel}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
          </div>
        </div>
        
        {/* Alerts */}
        {(Math.abs(kpis.umsatz.variancePercent) >= 10 || Math.abs(kpis.ebit.variancePercent) >= 10) && (
          <div className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-900/30 p-4 ring-1 ring-amber-200 dark:ring-amber-700/50">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <div className="font-semibold text-amber-800 dark:text-amber-300">Abweichungen &gt;10% vom Plan</div>
                <div className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                  {Math.abs(kpis.umsatz.variancePercent) >= 10 && (
                    <span className="mr-4">Umsatz: {formatPercent(kpis.umsatz.variancePercent)}</span>
                  )}
                  {Math.abs(kpis.ebit.variancePercent) >= 10 && (
                    <span>EBIT: {formatPercent(kpis.ebit.variancePercent)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Year Comparison */}
      {compareData && (
        <section className="rounded-2xl bg-gradient-to-r from-sky-50 to-violet-50 p-6 ring-1 ring-slate-200 dark:from-sky-900/20 dark:to-violet-900/20 dark:ring-slate-700">
          <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">
            Jahresvergleich: {year} vs. {compareYear}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Umsatz", current: kpis.umsatz.actual, compare: compareData.kpis.umsatz.actual, format: "currency" as const },
              { label: "EBIT", current: kpis.ebit.actual, compare: compareData.kpis.ebit.actual, format: "currency" as const },
              { label: "EBIT-Marge", current: kpis.ebitMargin.actual, compare: compareData.kpis.ebitMargin.actual, format: "percent" as const },
              { label: "Headcount", current: kpis.headcount.actual, compare: compareData.kpis.headcount.actual, format: "number" as const },
            ].map((item) => {
              const change = item.compare !== 0 ? ((item.current - item.compare) / Math.abs(item.compare)) * 100 : 0;
              const isPositive = change >= 0;
              const formatVal = (v: number) => {
                if (item.format === "percent") return formatPercent(v);
                if (item.format === "number") return Math.round(v).toLocaleString("de-DE");
                return formatCurrency(v);
              };
              return (
                <div key={item.label} className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800">
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{item.label}</div>
                  <div className="mt-2 flex items-end justify-between">
                    <div>
                      <div className="text-xl font-bold text-slate-900 dark:text-white">{formatVal(item.current)}</div>
                      <div className="text-sm text-slate-500">{compareYear}: {formatVal(item.compare)}</div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      isPositive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                    }`}>
                      {isPositive ? "↑" : "↓"} {Math.abs(change).toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* KPI Cards */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Umsatz (Gesamt)"
          actual={kpis.umsatz.actual}
          plan={kpis.umsatz.plan}
          variance={kpis.umsatz.variance}
          variancePercent={kpis.umsatz.variancePercent}
          sparklineData={kpis.umsatz.monthly.map(m => m.actual)}
          sparklineColor="#10b981"
          delay={0}
          icon={
            <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <KpiCard
          title="EBIT (Gesamt)"
          actual={kpis.ebit.actual}
          plan={kpis.ebit.plan}
          variance={kpis.ebit.variance}
          variancePercent={kpis.ebit.variancePercent}
          sparklineData={kpis.ebit.monthly.map(m => m.actual)}
          sparklineColor="#0ea5e9"
          delay={50}
          icon={
            <svg className="h-6 w-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <KpiCard
          title="EBIT-Marge"
          actual={kpis.ebitMargin.actual}
          plan={kpis.ebitMargin.plan}
          format="percent"
          sparklineData={kpis.ebitMargin.monthly.map(m => m.actual)}
          sparklineColor="#8b5cf6"
          delay={100}
          icon={
            <svg className="h-6 w-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          }
        />
        <KpiCard
          title="Headcount (Ø)"
          actual={kpis.headcount.actual}
          plan={kpis.headcount.plan}
          variance={kpis.headcount.variance}
          variancePercent={kpis.headcount.variancePercent}
          format="number"
          sparklineData={kpis.headcount.monthly.map(m => m.actual)}
          sparklineColor="#f59e0b"
          delay={150}
          icon={
            <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
      </section>

      {/* Prior Year Comparison */}
      <section className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-900/30 dark:to-sky-800/30 p-6 ring-1 ring-sky-200/60 dark:ring-sky-700/50">
          <div className="text-sm font-medium text-sky-700 dark:text-sky-400">Umsatz vs. Vorjahr</div>
          <div className="mt-2 text-2xl font-bold text-sky-900 dark:text-sky-100">
            {formatCurrency(kpis.priorYearComparison.umsatz.current)}
          </div>
          <div className="mt-1 text-sm text-sky-600 dark:text-sky-400">
            Vorjahr: {formatCurrency(kpis.priorYearComparison.umsatz.priorYear)}
          </div>
          <div className="mt-3">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                kpis.priorYearComparison.umsatz.changePercent >= 0
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400"
              }`}
            >
              {kpis.priorYearComparison.umsatz.changePercent >= 0 ? "↑" : "↓"}{" "}
              {formatPercent(Math.abs(kpis.priorYearComparison.umsatz.changePercent))}
            </span>
          </div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30 p-6 ring-1 ring-emerald-200/60 dark:ring-emerald-700/50">
          <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">EBIT vs. Vorjahr</div>
          <div className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-100">
            {formatCurrency(kpis.priorYearComparison.ebit.current)}
          </div>
          <div className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
            Vorjahr: {formatCurrency(kpis.priorYearComparison.ebit.priorYear)}
          </div>
          <div className="mt-3">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                kpis.priorYearComparison.ebit.changePercent >= 0
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400"
              }`}
            >
              {kpis.priorYearComparison.ebit.changePercent >= 0 ? "↑" : "↓"}{" "}
              {formatPercent(Math.abs(kpis.priorYearComparison.ebit.changePercent))}
            </span>
          </div>
        </div>
      </section>

      {/* Chart Controls */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowCumulative(!showCumulative)}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            showCumulative 
              ? "bg-sky-500 text-white shadow-lg shadow-sky-500/25" 
              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          {showCumulative ? "Kumuliert" : "Monatlich"}
        </button>
      </div>

      {/* Charts Row 1 */}
      <section className="grid gap-6 lg:grid-cols-2">
        <ChartCard title={`Umsatz: Plan vs. IST/FC ${showCumulative ? "(Kumuliert)" : ""}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#f1f5f9", fontWeight: 600 }} />
              <Legend wrapperStyle={{ paddingTop: 12 }} iconType="circle" iconSize={8} />
              <Bar dataKey="umsatzPlan" name="Plan" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="umsatzActual" name="IST/FC" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`EBIT: Plan vs. IST/FC ${showCumulative ? "(Kumuliert)" : ""}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#f1f5f9", fontWeight: 600 }} />
              <Legend wrapperStyle={{ paddingTop: 12 }} iconType="circle" iconSize={8} />
              <Bar dataKey="ebitPlan" name="Plan" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ebitActual" name="IST/FC" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* Charts Row 2 */}
      <section className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="EBIT-Marge (%)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={marginData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#f1f5f9", fontWeight: 600 }} formatter={(v: number) => `${v.toFixed(1)}%`} />
              <Legend wrapperStyle={{ paddingTop: 12 }} iconType="plainline" iconSize={20} />
              <Line type="monotone" dataKey="plan" name="Plan" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="actual" name="IST/FC" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3, fill: "#8b5cf6" }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Headcount: Plan vs. IST/FC">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={headcountData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#f1f5f9", fontWeight: 600 }} />
              <Legend wrapperStyle={{ paddingTop: 12 }} iconType="plainline" iconSize={20} />
              <Line type="monotone" dataKey="plan" name="Plan" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="actual" name="IST/FC" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, fill: "#f59e0b" }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* Entity Breakdown */}
      <section className="grid gap-6 lg:grid-cols-3">
        <ChartCard title="Umsatz nach Einheit">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={entityPieData}
                dataKey="umsatz"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {entityPieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700 lg:col-span-2">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Einheiten-Übersicht</h3>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                  <th className="pb-3 font-semibold text-slate-600 dark:text-slate-400">Einheit</th>
                  <th 
                    className="pb-3 text-right font-semibold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 transition-colors select-none"
                    onClick={() => toggleSort("umsatz")}
                  >
                    Umsatz<SortIcon column="umsatz" />
                  </th>
                  <th 
                    className="pb-3 text-right font-semibold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 transition-colors select-none"
                    onClick={() => toggleSort("ebit")}
                  >
                    EBIT<SortIcon column="ebit" />
                  </th>
                  <th 
                    className="pb-3 text-right font-semibold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 transition-colors select-none"
                    onClick={() => toggleSort("ebitMargin")}
                  >
                    Marge<SortIcon column="ebitMargin" />
                  </th>
                  <th 
                    className="pb-3 text-right font-semibold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 transition-colors select-none"
                    onClick={() => toggleSort("headcount")}
                  >
                    HC<SortIcon column="headcount" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {sortedEntities.map((e, idx) => (
                  <tr 
                    key={e.code} 
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedEntityDetail(e.code)}
                    title={`Details für ${e.name} anzeigen`}
                  >
                    <td className="py-3 font-medium text-slate-900 dark:text-white">
                      <span className="inline-flex items-center gap-2">
                        <span 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        {e.name}
                        <svg className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </td>
                    <td className="py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{formatCurrency(e.umsatz)}</td>
                    <td className={`py-3 text-right tabular-nums ${e.ebit < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"}`}>
                      {formatCurrency(e.ebit)}
                    </td>
                    <td className={`py-3 text-right tabular-nums ${e.ebitMargin < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"}`}>
                      {formatPercent(e.ebitMargin)}
                    </td>
                    <td className="py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{e.headcount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Entity Detail Modal */}
      {selectedEntityDetail && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setSelectedEntityDetail(null)}
        >
          <div 
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {entities.find(e => e.code === selectedEntityDetail)?.name || selectedEntityDetail}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Detailansicht {year}</p>
              </div>
              <button
                onClick={() => setSelectedEntityDetail(null)}
                className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              {loadingEntityDetail ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
                </div>
              ) : entityDetailData ? (
                <div className="space-y-6">
                  {/* KPI Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4">
                      <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Umsatz</div>
                      <div className="mt-1 text-xl font-bold text-emerald-900 dark:text-emerald-100">{formatCurrency(entityDetailData.kpis.umsatz.actual)}</div>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400">Plan: {formatCurrency(entityDetailData.kpis.umsatz.plan)}</div>
                    </div>
                    <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-4">
                      <div className="text-xs font-medium text-sky-600 dark:text-sky-400">EBIT</div>
                      <div className="mt-1 text-xl font-bold text-sky-900 dark:text-sky-100">{formatCurrency(entityDetailData.kpis.ebit.actual)}</div>
                      <div className="text-xs text-sky-600 dark:text-sky-400">Plan: {formatCurrency(entityDetailData.kpis.ebit.plan)}</div>
                    </div>
                    <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 p-4">
                      <div className="text-xs font-medium text-violet-600 dark:text-violet-400">EBIT-Marge</div>
                      <div className="mt-1 text-xl font-bold text-violet-900 dark:text-violet-100">{formatPercent(entityDetailData.kpis.ebitMargin.actual)}</div>
                      <div className="text-xs text-violet-600 dark:text-violet-400">Plan: {formatPercent(entityDetailData.kpis.ebitMargin.plan)}</div>
                    </div>
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-4">
                      <div className="text-xs font-medium text-amber-600 dark:text-amber-400">Headcount</div>
                      <div className="mt-1 text-xl font-bold text-amber-900 dark:text-amber-100">{entityDetailData.kpis.headcount.actual}</div>
                      <div className="text-xs text-amber-600 dark:text-amber-400">Plan: {entityDetailData.kpis.headcount.plan}</div>
                    </div>
                  </div>

                  {/* Monthly Chart */}
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Monatliche Entwicklung</h3>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={entityDetailData.kpis.umsatz.monthly.map((u, i) => ({
                          month: MONTHS[i],
                          umsatz: u.actual,
                          ebit: entityDetailData.kpis.ebit.monthly[i]?.actual ?? 0
                        }))} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                          <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="umsatz" name="Umsatz" fill="#10b981" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="ebit" name="EBIT" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Monthly Table */}
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-600">
                          <th className="py-2 text-left font-medium text-slate-500 dark:text-slate-400">Monat</th>
                          <th className="py-2 text-right font-medium text-slate-500 dark:text-slate-400">Umsatz</th>
                          <th className="py-2 text-right font-medium text-slate-500 dark:text-slate-400">EBIT</th>
                          <th className="py-2 text-right font-medium text-slate-500 dark:text-slate-400">Marge</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {entityDetailData.kpis.umsatz.monthly.map((u, i) => {
                          const ebit = entityDetailData.kpis.ebit.monthly[i]?.actual ?? 0;
                          const margin = u.actual > 0 ? (ebit / u.actual) * 100 : 0;
                          return (
                            <tr key={i} className={i < cutoffMonth ? "" : "opacity-50"}>
                              <td className="py-2 text-slate-700 dark:text-slate-300">
                                {MONTHS[i]}
                                {i < cutoffMonth ? (
                                  <span className="ml-1 text-xs text-emerald-500">IST</span>
                                ) : (
                                  <span className="ml-1 text-xs text-amber-500">FC</span>
                                )}
                              </td>
                              <td className="py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{formatCurrency(u.actual)}</td>
                              <td className={`py-2 text-right tabular-nums ${ebit < 0 ? "text-rose-500" : "text-slate-700 dark:text-slate-300"}`}>{formatCurrency(ebit)}</td>
                              <td className={`py-2 text-right tabular-nums ${margin < 0 ? "text-rose-500" : "text-slate-700 dark:text-slate-300"}`}>{formatPercent(margin)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setSelectedEntity(selectedEntityDetail);
                        setSelectedEntityDetail(null);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Als Hauptansicht wählen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">Keine Daten verfügbar</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
