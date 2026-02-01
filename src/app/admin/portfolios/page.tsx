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

const SUGGESTED_PORTFOLIOS = [
  { code: "DEV", display_name: "Development", description: "Software-Entwicklung", color: "#0ea5e9" },
  { code: "CONS", display_name: "Consulting", description: "Beratung & Projektmanagement", color: "#10b981" },
  { code: "OPS", display_name: "Operations", description: "IT-Betrieb & Support", color: "#f59e0b" },
  { code: "SALES", display_name: "Sales", description: "Vertrieb & Akquise", color: "#8b5cf6" },
  { code: "MGMT", display_name: "Management", description: "Führung & Administration", color: "#ef4444" },
  { code: "DATA", display_name: "Data & Analytics", description: "Datenanalyse & BI", color: "#06b6d4" },
];

export default function PortfoliosPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ code: "", display_name: "", description: "", color: "#0ea5e9", is_active: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleQuickAdd = async (suggestion: typeof SUGGESTED_PORTFOLIOS[0]) => {
    if (portfolios.some(p => p.code === suggestion.code)) {
      setError(`Portfolio "${suggestion.code}" existiert bereits`);
      setTimeout(() => setError(null), 3000);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/pep/portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...suggestion, is_active: true })
      });
      if (res.ok) {
        await loadPortfolios();
        showSuccess(`Portfolio "${suggestion.display_name}" erstellt`);
      }
    } catch (e) {
      setError("Fehler beim Erstellen");
    } finally {
      setSaving(false);
    }
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
      showSuccess(editingId ? "Portfolio aktualisiert" : "Portfolio erstellt");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Portfolio "${name}" wirklich löschen? Alle Mitarbeiterzuordnungen werden entfernt.`)) return;

    try {
      const res = await fetch(`/api/pep/portfolios?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadPortfolios();
        showSuccess(`Portfolio "${name}" gelöscht`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const availableSuggestions = SUGGESTED_PORTFOLIOS.filter(s => !portfolios.some(p => p.code === s.code));

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

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 p-3 text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {successMessage}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-rose-50 dark:bg-rose-900/30 p-3 text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Portfolio Cards */}
        {portfolios.length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Noch keine Portfolios</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
              Portfolios helfen, Mitarbeiter nach Tätigkeitsbereichen zu gruppieren und die Kapazität pro Bereich zu planen.
            </p>
            
            {availableSuggestions.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Schnellstart mit Vorlagen:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {availableSuggestions.map((s) => (
                    <button
                      key={s.code}
                      onClick={() => handleQuickAdd(s)}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition hover:opacity-80 disabled:opacity-50"
                      style={{ backgroundColor: s.color }}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {s.display_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Eigenes Portfolio erstellen
            </button>
          </div>
        ) : (
          <>
            {/* Quick Add Suggestions */}
            {availableSuggestions.length > 0 && (
              <div className="mb-6 rounded-xl bg-slate-50 dark:bg-slate-700/30 p-4">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Vorschläge hinzufügen:</p>
                <div className="flex flex-wrap gap-2">
                  {availableSuggestions.map((s) => (
                    <button
                      key={s.code}
                      onClick={() => handleQuickAdd(s)}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-full border-2 border-dashed px-3 py-1 text-xs font-medium transition hover:border-solid disabled:opacity-50"
                      style={{ borderColor: s.color, color: s.color }}
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {s.display_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Portfolio Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {portfolios.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-xl border-2 p-5 transition ${
                    p.is_active 
                      ? "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" 
                      : "border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.code.slice(0, 2)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{p.display_name}</h3>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{p.code}</span>
                      </div>
                    </div>
                    {!p.is_active && (
                      <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400">
                        Inaktiv
                      </span>
                    )}
                  </div>
                  
                  {p.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{p.description}</p>
                  )}
                  
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <button
                      onClick={() => handleEdit(p)}
                      className="flex-1 rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => handleDelete(p.id, p.display_name)}
                      className="rounded-lg bg-rose-50 dark:bg-rose-900/30 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
