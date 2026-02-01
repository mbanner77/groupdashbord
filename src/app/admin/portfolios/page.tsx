"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Portfolio {
  id: number;
  code: string;
  display_name: string;
  description: string | null;
  color: string;
  is_active: number;
}

const COLORS = [
  "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
];

export default function PortfoliosPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ code: "", display_name: "", description: "", color: "#0ea5e9", is_active: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPortfolios = async () => {
    try {
      const res = await fetch("/api/pep/portfolios");
      if (res.ok) {
        setPortfolios(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolios();
  }, []);

  const resetForm = () => {
    setFormData({ code: "", display_name: "", description: "", color: "#0ea5e9", is_active: true });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleEdit = (portfolio: Portfolio) => {
    setFormData({
      code: portfolio.code,
      display_name: portfolio.display_name,
      description: portfolio.description || "",
      color: portfolio.color,
      is_active: portfolio.is_active === 1
    });
    setEditingId(portfolio.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { ...formData, id: editingId } : formData;
      
      const res = await fetch("/api/pep/portfolios", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Speichern");
      }

      await loadPortfolios();
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Portfolio wirklich löschen?")) return;

    try {
      const res = await fetch(`/api/pep/portfolios?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadPortfolios();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-sky-500" />
      </div>
    );
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Portfolios verwalten</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Portfolios für die Mitarbeiterzuordnung</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neues Portfolio
          </button>
        </div>

        {showForm && (
          <div className="mb-6 rounded-xl border-2 border-dashed border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-900/20 p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              {editingId ? "Portfolio bearbeiten" : "Neues Portfolio erstellen"}
            </h3>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm dark:text-white"
                  placeholder="z.B. DEV"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm dark:text-white"
                  placeholder="z.B. Development"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Beschreibung</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm dark:text-white"
                  placeholder="Optionale Beschreibung"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Farbe</label>
                <div className="flex flex-wrap gap-1">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: c })}
                      className={`h-7 w-7 rounded-full transition ${formData.color === c ? "ring-2 ring-offset-2 ring-slate-400" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              {editingId && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <label htmlFor="is_active" className="text-sm text-slate-600 dark:text-slate-400">Aktiv</label>
                </div>
              )}
              <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-3">
                {error && <span className="text-sm text-rose-600">{error}</span>}
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
                  >
                    {saving ? "Speichern…" : "Speichern"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50">
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Farbe</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Code</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Beschreibung</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {portfolios.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    Keine Portfolios vorhanden
                  </td>
                </tr>
              ) : (
                portfolios.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3">
                      <div className="h-6 w-6 rounded-full" style={{ backgroundColor: p.color }} />
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-900 dark:text-white">{p.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{p.display_name}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{p.description || "–"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                      }`}>
                        {p.is_active ? "Aktiv" : "Inaktiv"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleEdit(p)}
                        className="mr-2 text-sky-600 hover:text-sky-800 dark:text-sky-400"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-rose-600 hover:text-rose-800 dark:text-rose-400"
                      >
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
