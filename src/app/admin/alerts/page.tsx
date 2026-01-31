"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Alert = {
  entity_name: string;
  kpi_name: string;
  month: number;
  actual: number;
  plan: number;
  variance_percent: number;
};

type AlertConfig = {
  varianceThreshold: number;
  emailRecipients: string;
  alertsEnabled: boolean;
};

const MONTH_NAMES = ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [config, setConfig] = useState<AlertConfig>({
    varianceThreshold: 20,
    emailRecipients: "",
    alertsEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/years")
      .then((r) => r.json())
      .then((d) => setAvailableYears(d.available || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/alerts?year=${year}`).then((r) => r.json()),
      fetch("/api/admin/alert-config").then((r) => r.json()).catch(() => ({})),
    ])
      .then(([alertsData, configData]) => {
        setAlerts(alertsData.alerts || []);
        if (configData.config) {
          setConfig(configData.config);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year]);

  const handleSaveConfig = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/alert-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Einstellungen gespeichert" });
      } else {
        setMessage({ type: "error", text: "Fehler beim Speichern" });
      }
    } catch {
      setMessage({ type: "error", text: "Verbindungsfehler" });
    } finally {
      setSaving(false);
    }
  };

  const formatValue = (v: number) => {
    return (v / 1000).toFixed(0) + " T€";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Alert-Regeln</h1>
          <p className="mt-1 text-sm text-slate-500">Schwellwerte und Benachrichtigungen konfigurieren</p>
        </div>
        <Link
          href="/admin"
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          ← Zurück
        </Link>
      </div>

      {message && (
        <div className={`rounded-lg p-4 text-sm ${
          message.type === "success"
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
        }`}>
          {message.text}
        </div>
      )}

      {/* Configuration */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Konfiguration</h2>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Schwellwert für Abweichung (%)
            </label>
            <input
              type="number"
              value={config.varianceThreshold}
              onChange={(e) => setConfig({ ...config, varianceThreshold: parseInt(e.target.value) || 20 })}
              min={1}
              max={100}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
            <p className="mt-1 text-xs text-slate-500">Alerts werden bei Abweichungen über diesem Wert ausgelöst</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              E-Mail-Empfänger
            </label>
            <input
              type="text"
              value={config.emailRecipients}
              onChange={(e) => setConfig({ ...config, emailRecipients: e.target.value })}
              placeholder="user1@example.com, user2@example.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
            <p className="mt-1 text-xs text-slate-500">Kommagetrennte Liste von E-Mail-Adressen</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="alertsEnabled"
              checked={config.alertsEnabled}
              onChange={(e) => setConfig({ ...config, alertsEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
            />
            <label htmlFor="alertsEnabled" className="text-sm text-slate-700 dark:text-slate-300">
              E-Mail-Benachrichtigungen aktivieren
            </label>
          </div>

          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:opacity-50"
          >
            {saving ? "Speichern..." : "Einstellungen speichern"}
          </button>
        </div>
      </div>

      {/* Current Alerts */}
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Aktuelle Alerts ({alerts.length})
          </h2>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Keine Alerts für {year} mit Abweichung &gt; {config.varianceThreshold}%
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {alerts.slice(0, 20).map((alert, i) => {
              const isPositive = alert.variance_percent >= 0;
              return (
                <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      isPositive ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                    }`}>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
                          isPositive 
                            ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" 
                            : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                        } />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{alert.entity_name}</div>
                      <div className="text-sm text-slate-500">
                        {alert.kpi_name} • {MONTH_NAMES[alert.month - 1]}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">IST: {formatValue(alert.actual)}</span>
                      <span className="text-sm text-slate-400">|</span>
                      <span className="text-sm text-slate-500">Plan: {formatValue(alert.plan)}</span>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isPositive
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                    }`}>
                      {isPositive ? "+" : ""}{alert.variance_percent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
