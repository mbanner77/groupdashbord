"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type EmailConfig = {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromAddress: string;
  fromName: string;
  useTls: boolean;
};

export default function EmailConfigPage() {
  const [config, setConfig] = useState<EmailConfig>({
    enabled: false,
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    fromAddress: "",
    fromName: "Group Dashboard",
    useTls: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    fetch("/api/admin/email-config")
      .then((r) => r.json())
      .then((d) => {
        if (d.config) setConfig(d.config);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/email-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Konfiguration gespeichert" });
      } else {
        setMessage({ type: "error", text: data.error || "Fehler beim Speichern" });
      }
    } catch {
      setMessage({ type: "error", text: "Verbindungsfehler" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      setMessage({ type: "error", text: "Bitte Test-E-Mail-Adresse eingeben" });
      return;
    }

    setTesting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/email-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: `Test-E-Mail gesendet an ${testEmail}` });
      } else {
        setMessage({ type: "error", text: data.error || "Test fehlgeschlagen" });
      }
    } catch {
      setMessage({ type: "error", text: "Verbindungsfehler" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">E-Mail Konfiguration</h1>
          <p className="mt-1 text-sm text-slate-500">SMTP-Server für Benachrichtigungen einrichten</p>
        </div>
        <Link
          href="/admin"
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          ← Zurück
        </Link>
      </div>

      {message && (
        <div className={`mb-6 rounded-lg p-4 text-sm ${
          message.type === "success"
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Enable/Disable */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">E-Mail-Benachrichtigungen</h3>
              <p className="text-sm text-slate-500">Aktiviere E-Mail-Benachrichtigungen für Alerts</p>
            </div>
            <button
              type="button"
              onClick={() => setConfig({ ...config, enabled: !config.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                config.enabled ? "bg-emerald-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  config.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* SMTP Settings */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">SMTP-Server</h3>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Host
              </label>
              <input
                type="text"
                value={config.smtpHost}
                onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
                placeholder="smtp.example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Port
              </label>
              <input
                type="number"
                value={config.smtpPort}
                onChange={(e) => setConfig({ ...config, smtpPort: parseInt(e.target.value) || 587 })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Benutzername
              </label>
              <input
                type="text"
                value={config.smtpUser}
                onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })}
                placeholder="user@example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Passwort
              </label>
              <input
                type="password"
                value={config.smtpPass}
                onChange={(e) => setConfig({ ...config, smtpPass: e.target.value })}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="useTls"
              checked={config.useTls}
              onChange={(e) => setConfig({ ...config, useTls: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
            />
            <label htmlFor="useTls" className="text-sm text-slate-700 dark:text-slate-300">
              TLS/SSL verwenden
            </label>
          </div>
        </div>

        {/* Sender Settings */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Absender</h3>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Absender-Name
              </label>
              <input
                type="text"
                value={config.fromName}
                onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
                placeholder="Group Dashboard"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Absender-E-Mail
              </label>
              <input
                type="email"
                value={config.fromAddress}
                onChange={(e) => setConfig({ ...config, fromAddress: e.target.value })}
                placeholder="noreply@realcore.de"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Test Email */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Verbindung testen</h3>
          
          <div className="flex gap-2">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !config.smtpHost}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300"
            >
              {testing ? "Senden..." : "Test senden"}
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-sky-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:opacity-50"
          >
            {saving ? "Speichere..." : "Konfiguration speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
