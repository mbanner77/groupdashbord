"use client";

import { useState, useEffect, useMemo } from "react";
import { Sparkline } from "../../components/Sparkline";

type EntityData = {
  code: string;
  name: string;
  umsatz: number;
  ebit: number;
  headcount: number;
  margin: number;
  monthly: {
    umsatz: number[];
    ebit: number[];
  };
};

const MONTH_NAMES = ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export default function ComparePage() {
  const [entities, setEntities] = useState<{ code: string; name: string; isAggregate: boolean }[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [data, setData] = useState<EntityData[]>([]);
  const [loading, setLoading] = useState(false);
  const [kpi, setKpi] = useState<"umsatz" | "ebit" | "headcount">("umsatz");
  const [monthFrom, setMonthFrom] = useState(1);
  const [monthTo, setMonthTo] = useState(12);

  useEffect(() => {
    fetch("/api/years")
      .then((r) => r.json())
      .then((d) => setAvailableYears(d.available || []))
      .catch(() => {});

    fetch("/api/kpis?year=" + year)
      .then((r) => r.json())
      .then((d) => {
        if (d.entities) {
          setEntities(d.entities.map((e: { code: string; name: string; isAggregate?: boolean }) => ({
            code: e.code,
            name: e.name,
            isAggregate: e.isAggregate || false,
          })));
        }
      })
      .catch(() => {});
  }, [year]);

  useEffect(() => {
    if (selectedEntities.length === 0) {
      setData([]);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/compare?year=${year}&entities=${selectedEntities.join(",")}&monthFrom=${monthFrom}&monthTo=${monthTo}`
        );
        if (res.ok) {
          const d = await res.json();
          setData(
            (d.entities || []).map((e: {
              code: string;
              name: string;
              umsatz: number;
              ebit: number;
              headcount: number;
              margin: number;
              monthly: { umsatz: number[]; ebit: number[] };
            }) => ({
              code: e.code,
              name: e.name,
              umsatz: e.umsatz,
              ebit: e.ebit,
              headcount: e.headcount,
              margin: e.margin,
              monthly: e.monthly,
            }))
          );
        }
      } catch (e) {
        console.error("Failed to load comparison data", e);
      }
      setLoading(false);
    };

    loadData();
  }, [selectedEntities, year, monthFrom, monthTo]);

  const toggleEntity = (code: string) => {
    setSelectedEntities((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const formatValue = (v: number, type: string) => {
    if (type === "headcount") return Math.round(v).toLocaleString("de-DE");
    if (type === "margin") return v.toFixed(1) + "%";
    // Values are stored in thousands, display as T€
    return Math.round(v).toLocaleString("de-DE") + " T€";
  };

  const maxValue = useMemo(() => {
    if (data.length === 0) return 1;
    return Math.max(...data.map((d) => d[kpi]));
  }, [data, kpi]);

  const colors = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Entity Vergleich</h1>
          <p className="mt-1 text-sm text-slate-500">Vergleiche mehrere Einheiten nebeneinander</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
            <span className="text-xs text-slate-500">Monate:</span>
            <select
              value={monthFrom}
              onChange={(e) => setMonthFrom(Number(e.target.value))}
              className="border-0 bg-transparent text-sm font-medium focus:outline-none dark:text-white"
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <span className="text-slate-400">–</span>
            <select
              value={monthTo}
              onChange={(e) => setMonthTo(Number(e.target.value))}
              className="border-0 bg-transparent text-sm font-medium focus:outline-none dark:text-white"
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={i} value={i + 1} disabled={i + 1 < monthFrom}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Entity Selection */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Einheiten auswählen</h3>
        <div className="flex flex-wrap gap-2">
          {entities.filter((e) => !e.isAggregate).map((entity) => (
            <button
              key={entity.code}
              onClick={() => toggleEntity(entity.code)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                selectedEntities.includes(entity.code)
                  ? "bg-sky-500 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              }`}
            >
              {entity.name}
            </button>
          ))}
        </div>
        {selectedEntities.length > 0 && (
          <button
            onClick={() => setSelectedEntities([])}
            className="mt-3 text-xs text-slate-500 hover:text-slate-700"
          >
            Auswahl zurücksetzen
          </button>
        )}
      </div>

      {/* KPI Toggle */}
      <div className="flex items-center gap-2">
        {(["umsatz", "ebit", "headcount"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKpi(k)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              kpi === k
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
            }`}
          >
            {k === "umsatz" ? "Umsatz" : k === "ebit" ? "EBIT" : "Headcount"}
          </button>
        ))}
      </div>

      {/* Comparison Chart */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
        </div>
      ) : data.length > 0 ? (
        <div className="space-y-6">
          {/* Bar Comparison */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
            <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
              {kpi === "umsatz" ? "Umsatz" : kpi === "ebit" ? "EBIT" : "Headcount"} Vergleich
            </h3>
            <div className="space-y-3">
              {data.map((entity, i) => (
                <div key={entity.code} className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                    {entity.name}
                  </div>
                  <div className="flex-1">
                    <div
                      className="h-8 rounded transition-all duration-500"
                      style={{
                        width: `${(entity[kpi] / maxValue) * 100}%`,
                        backgroundColor: colors[i % colors.length],
                      }}
                    />
                  </div>
                  <div className="w-20 text-right text-sm font-semibold text-slate-900 dark:text-white">
                    {formatValue(entity[kpi], kpi)}
                  </div>
                  <div className="w-20">
                    <Sparkline
                      values={kpi === "headcount" ? [] : entity.monthly[kpi === "umsatz" ? "umsatz" : "ebit"]}
                      color={colors[i % colors.length]}
                      width={80}
                      height={24}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Table */}
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Einheit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Umsatz</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">EBIT</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Marge</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Headcount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {data.map((entity, i) => (
                  <tr key={entity.code} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                      <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                      {entity.name}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-300">{formatValue(entity.umsatz, "umsatz")}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-300">{formatValue(entity.ebit, "ebit")}</td>
                    <td className={`px-4 py-3 text-right text-sm font-medium ${entity.margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {formatValue(entity.margin, "margin")}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-300">{formatValue(entity.headcount, "headcount")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-700">
          <p className="text-sm text-slate-500">Wähle mindestens eine Einheit zum Vergleichen aus</p>
        </div>
      )}
    </div>
  );
}
