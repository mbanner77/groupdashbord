"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState("Umsatz");
  const [year, setYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/years")
      .then((r) => r.json())
      .then((d) => {
        const years = d.all || [];
        // Add next year if not present
        const nextYear = new Date().getFullYear() + 1;
        if (!years.includes(nextYear)) years.push(nextYear);
        setAvailableYears(years.sort((a: number, b: number) => b - a));
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setMessage({ type: "error", text: "Bitte wähle eine Datei aus" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sheet", sheet);
      formData.append("year", String(year));

      const res = await fetch("/api/import/excel", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "Import fehlgeschlagen" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Excel Import</h1>
          <p className="mt-1 text-sm text-slate-500">Importiere Daten aus Excel-Dateien</p>
        </div>
        <Link
          href="/admin/users"
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          ← Zurück
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        {message && (
          <div className={`mb-6 rounded-lg p-4 text-sm ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Excel-Datei
            </label>
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
              />
            </div>
            {file && (
              <p className="mt-2 text-sm text-slate-500">
                Ausgewählt: <span className="font-medium">{file.name}</span>
              </p>
            )}
          </div>

          {/* Sheet Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Sheet
            </label>
            <select
              value={sheet}
              onChange={(e) => setSheet(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              <option value="Umsatz">Umsatz</option>
              <option value="Ertrag">Ertrag</option>
              <option value="Headcount">Headcount</option>
            </select>
          </div>

          {/* Year Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Jahr
            </label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Info Box */}
          <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-medium">Hinweis zum Dateiformat:</p>
                <ul className="mt-1 list-disc list-inside space-y-1">
                  <li>Spalte A: Entity-Name (z.B. "RCC", "Gruppe")</li>
                  <li>Spalte B: Zeile (z.B. "Plan Umsatz", "IST/FC")</li>
                  <li>Spalten C-N: Monatswerte (Jan-Dez)</li>
                  <li>Bestehende Werte werden überschrieben</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !file}
            className="w-full rounded-lg bg-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Importiere…
              </span>
            ) : (
              "Importieren"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
