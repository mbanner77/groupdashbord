"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { WorkbookBarChart, WorkbookLineChart } from "../../../components/WorkbookCharts";
import { WorkbookTable } from "../../../components/WorkbookTable";
import { Toast } from "../../../components/Toast";
import type { WorkbookSheet } from "../../../lib/workbook";

type SheetParam = "umsatz" | "ertrag" | "headcount";

function toSheetParam(v: string): SheetParam | null {
  const s = v.trim().toLowerCase();
  if (s === "umsatz") return "umsatz";
  if (s === "ertrag") return "ertrag";
  if (s === "headcount") return "headcount";
  return null;
}

function toSheetName(p: SheetParam): WorkbookSheet["sheet"] {
  if (p === "umsatz") return "Umsatz";
  if (p === "ertrag") return "Ertrag";
  return "Headcount";
}

export default function WorkbookClient(props: { sheetParam: string }) {
  const sheetParam = useMemo(() => toSheetParam(props.sheetParam), [props.sheetParam]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [cutoffMonth, setCutoffMonth] = useState<number | null>(null);
  const [data, setData] = useState<WorkbookSheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  const [editMode, setEditMode] = useState(false);
  const [editEntityCode, setEditEntityCode] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<string[]>(Array.from({ length: 12 }, () => ""));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetch("/api/years")
      .then((r) => r.json())
      .then((d) => {
        setAvailableYears(d.all || []);
        if (d.available?.length > 0 && !d.available.includes(year)) {
          setYear(d.available[0]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!sheetParam) return;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const s = await fetch("/api/settings/forecast-cutoff", { cache: "no-store" }).then((r) => r.json());
        const cm = Number(s?.cutoffMonth);
        setCutoffMonth(Number.isFinite(cm) ? cm : 12);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [sheetParam]);

  useEffect(() => {
    if (!sheetParam) return;
    if (!cutoffMonth) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const sheet = toSheetName(sheetParam);
        const url = new URL("/api/workbook", window.location.origin);
        url.searchParams.set("sheet", sheet);
        url.searchParams.set("year", String(year));
        url.searchParams.set("cutoffMonth", String(cutoffMonth));

        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) throw new Error(`workbook load failed (${res.status})`);
        const json = (await res.json()) as WorkbookSheet;
        setData(json);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [sheetParam, year, cutoffMonth, reloadKey]);

  const title = sheetParam ? toSheetName(sheetParam) : "Workbook";

  const editableLabels = useMemo(() => {
    if (!data) return [] as string[];
    if (data.sheet === "Umsatz") return ["Plan Umsatz", "IST/FC Umsatz"];
    if (data.sheet === "Ertrag") return ["Plan EBIT", "IST/FC EBIT"];
    return [
      "Plan Headcount",
      "IST/FC headcount",
      "davon Umlagerelevant",
      "ohne Umlage Deutschland",
      "ohne Umlage"
    ];
  }, [data]);

  useEffect(() => {
    if (!data) return;
    if (!editEntityCode) {
      const first = data.entities.find((e) => !e.isAggregate);
      setEditEntityCode(first?.code ?? null);
    }
    if (!editLabel) {
      setEditLabel(editableLabels[0] ?? null);
    }
  }, [data, editEntityCode, editLabel, editableLabels]);

  useEffect(() => {
    if (!data) return;
    if (!editEntityCode || !editLabel) return;
    const line = data.lines.find((l) => l.entityCode === editEntityCode && l.label === editLabel);
    if (!line) {
      setEditValues(Array.from({ length: 12 }, () => ""));
      return;
    }
    setEditValues(line.values.map((v) => (Number.isFinite(v) ? String(v) : "")));
  }, [data, editEntityCode, editLabel]);

  const onSaveCutoff = async (m: number) => {
    setCutoffMonth(m);
    await fetch("/api/settings/forecast-cutoff", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ month: m })
    });
  };

  const onSaveEdit = async () => {
    if (!data) return;
    if (!editEntityCode || !editLabel) return;
    if (!cutoffMonth) return;

    try {
      setSaving(true);
      setSaveError(null);

      const parsedValues = editValues.map((s) => {
        const t = s.trim();
        if (!t) return null;
        const n = Number(t.replace(",", "."));
        return Number.isFinite(n) ? n : null;
      });

      const res = await fetch("/api/matrix", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sheet: data.sheet,
          year: data.year,
          entityCode: editEntityCode,
          label: editLabel,
          values: parsedValues,
          cutoffMonth
        })
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? `save failed (${res.status})`);
      }

      setReloadKey((x) => x + 1);
      setToast({ message: "Daten erfolgreich gespeichert", type: "success" });
      setEditMode(false);
    } catch (e) {
      setSaveError(String(e));
      setToast({ message: "Fehler beim Speichern", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (!sheetParam) {
    return (
      <main className="space-y-4">
        <div className="text-sm text-slate-700">Unbekanntes Sheet.</div>
        <div className="mt-4">
          <Link className="text-sky-700 underline" href="/workbook/umsatz">
            Zurück
          </Link>
        </div>
      </main>
    );
  }

  const tabClass = (active: boolean) =>
    active
      ? "rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
      : "rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100";

  return (
    <main className="space-y-6">
      {/* Header Section */}
      <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200/60">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 text-xl font-bold text-white shadow-lg shadow-sky-500/25">
              {title.charAt(0)}
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Workbook</div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1">
              <Link
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  sheetParam === "umsatz"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                href="/workbook/umsatz"
              >
                Umsatz
              </Link>
              <Link
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  sheetParam === "ertrag"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                href="/workbook/ertrag"
              >
                Ertrag
              </Link>
              <Link
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  sheetParam === "headcount"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                href="/workbook/headcount"
              >
                Headcount
              </Link>
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-4">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <span className="font-medium text-slate-700">IST bis</span>
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                value={cutoffMonth ?? 12}
                onChange={(e) => void onSaveCutoff(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    Monat {m}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-3">
            {loading && (
              <span className="flex items-center gap-2 text-sm text-slate-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
                Laden…
              </span>
            )}
            {error && <span className="text-sm font-medium text-rose-600">{error}</span>}
          </div>

          <button
            type="button"
            className={`ml-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
              editMode
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
            onClick={() => setEditMode((v) => !v)}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {editMode ? "Bearbeitung beenden" : "Daten bearbeiten"}
          </button>
        </div>

        {/* Edit Panel */}
        {editMode && data ? (
          <div className="mt-4 rounded-xl border-2 border-dashed border-sky-200 bg-sky-50/50 p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-sky-500 flex items-center justify-center">
                <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Monatswerte bearbeiten</h3>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Einheit</span>
                <select
                  className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  value={editEntityCode ?? ""}
                  onChange={(e) => setEditEntityCode(e.target.value)}
                >
                  {data.entities
                    .filter((e) => !e.isAggregate)
                    .map((e) => (
                      <option key={e.code} value={e.code}>
                        {e.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Zeile / KPI</span>
                <select
                  className="min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  value={editLabel ?? ""}
                  onChange={(e) => setEditLabel(e.target.value)}
                >
                  {editableLabels.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                IST/FC wird anhand Stichtag (Monat {cutoffMonth ?? 12}) aufgeteilt
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-50"
                  onClick={() => void onSaveEdit()}
                  disabled={saving || !editEntityCode || !editLabel}
                >
                  {saving ? "Speichern…" : "Speichern"}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
                  onClick={() => {
                    setEditMode(false);
                    setSaveError(null);
                  }}
                >
                  Abbrechen
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-6 lg:grid-cols-12">
              {data.months.map((m, idx) => (
                <label key={m.month} className="group">
                  <span className="mb-1 block text-center text-xs font-semibold text-slate-500">{m.label}</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-center text-sm font-medium tabular-nums shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    value={editValues[idx] ?? ""}
                    onChange={(e) => {
                      const next = [...editValues];
                      next[idx] = e.target.value;
                      setEditValues(next);
                    }}
                    inputMode="decimal"
                    placeholder="0"
                  />
                </label>
              ))}
            </div>

            {saveError && (
              <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
                {saveError}
              </div>
            )}
          </div>
        ) : null}
      </section>

      {data ? (
        <div className="grid gap-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <WorkbookBarChart
              title="Monatlich"
              data={data.charts.bar as any}
              planLabel="Plan"
              actualForecastLabel="IST/FC"
            />

            <WorkbookLineChart
              title="Kumuliert"
              data={data.charts.line as any}
              xKey="month"
              lines={
                data.sheet === "Headcount"
                  ? [
                      { key: "cumPlan", name: "kum Plan", color: "#0ea5e9" },
                      { key: "cumActualForecast", name: "kum IST / FC", color: "#22c55e" },
                      { key: "priorYearCum", name: "Vorjahr kum", color: "#64748b" }
                    ]
                  : [
                      { key: "cumPlan", name: "kum Plan", color: "#0ea5e9" },
                      { key: "cumActualForecast", name: "kum IST / FC", color: "#22c55e" },
                      { key: "priorYearCum", name: "Vorjahr kum", color: "#64748b" }
                    ]
              }
            />
          </div>

          <WorkbookTable months={data.months} lines={data.lines} />
        </div>
      ) : null}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </main>
  );
}
