"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type AuditLog = {
  id: number;
  user_id: number | null;
  username: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  entity_name: string | null;
  old_value: string | null;
  new_value: string | null;
  details: string | null;
  created_at: string;
};

const actionLabels: Record<string, { label: string; color: string }> = {
  login: { label: "Anmeldung", color: "bg-emerald-100 text-emerald-700" },
  logout: { label: "Abmeldung", color: "bg-slate-100 text-slate-700" },
  create: { label: "Erstellt", color: "bg-sky-100 text-sky-700" },
  update: { label: "Aktualisiert", color: "bg-amber-100 text-amber-700" },
  delete: { label: "Gelöscht", color: "bg-rose-100 text-rose-700" },
  import: { label: "Import", color: "bg-purple-100 text-purple-700" },
  export: { label: "Export", color: "bg-indigo-100 text-indigo-700" },
};

const entityTypeLabels: Record<string, string> = {
  user: "Benutzer",
  entity: "Einheit",
  kpi: "KPI",
  value: "Wert",
  permission: "Berechtigung",
  comment: "Kommentar",
  settings: "Einstellungen",
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/audit")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setLogs(d.logs || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit-Log</h1>
          <p className="mt-1 text-sm text-slate-500">Änderungshistorie und Benutzeraktivitäten</p>
        </div>
        <Link
          href="/admin/users"
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          ← Zurück zur Benutzerverwaltung
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      )}

      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Zeitpunkt
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Benutzer
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Aktion
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Bereich
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    Keine Einträge vorhanden
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                      {log.username}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        actionLabels[log.action]?.color || "bg-slate-100 text-slate-700"
                      }`}>
                        {actionLabels[log.action]?.label || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {entityTypeLabels[log.entity_type] || log.entity_type}
                      {log.entity_name && ` (${log.entity_name})`}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {log.details || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
