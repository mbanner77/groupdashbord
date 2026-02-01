"use client";

import { useEffect, useState, useMemo } from "react";

interface Portfolio {
  id: number;
  code: string;
  display_name: string;
  color: string;
  allocation_percent: number;
}

interface Employee {
  id: number;
  entity_id: number;
  entity_code: string;
  entity_name: string;
  employee_number: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  position: string | null;
  weekly_hours: number;
  hourly_rate: number | null;
  is_active: number;
  portfolios: Portfolio[];
}

interface Entity {
  code: string;
  name: string;
  id: number;
}

interface MonthlyData {
  month: number;
  workingDays: number;
  targetRevenue: number;
  forecastPercent: number;
  forecastRevenue: number;
  vacationDays: number;
  internalDays: number;
  sickDays: number;
  trainingDays: number;
  netAvailableDays: number;
  availableHours: number;
  actualRevenue: number;
  billableHours: number;
  utilizationPercent: number;
}

interface EmployeeSummary extends Employee {
  totals: {
    targetRevenue: number;
    forecastRevenue: number;
    actualRevenue: number;
    availableDays: number;
    plannedAbsence: number;
    netAvailableDays: number;
    availableHours: number;
    billableHours: number;
    utilizationPercent: number;
    revenuePerDay: number;
  };
  monthly: MonthlyData[];
}

interface SummaryData {
  year: number;
  employees: EmployeeSummary[];
  portfolios: Array<{
    id: number;
    code: string;
    name: string;
    color: string;
    employeeCount: number;
    totals: {
      targetRevenue: number;
      forecastRevenue: number;
      actualRevenue: number;
      availableHours: number;
      billableHours: number;
      utilizationPercent: number;
    };
  }>;
  entities: Array<{
    entityId: number;
    entityCode: string;
    entityName: string;
    employeeCount: number;
    totals: {
      targetRevenue: number;
      forecastRevenue: number;
      actualRevenue: number;
      availableHours: number;
      billableHours: number;
      utilizationPercent: number;
    };
  }>;
  totals: {
    employeeCount: number;
    targetRevenue: number;
    forecastRevenue: number;
    actualRevenue: number;
    availableHours: number;
    billableHours: number;
    utilizationPercent: number;
  };
}

const MONTHS = ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export default function PepPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>("all");
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>("all");
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "employees" | "planning">("overview");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSummary | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allPortfolios, setAllPortfolios] = useState<Array<{ id: number; code: string; display_name: string; color: string }>>([]);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    position: "",
    entity_id: "",
    weekly_hours: "40",
    hourly_rate: "",
    portfolio_ids: [] as number[]
  });
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [allEntities, setAllEntities] = useState<Array<{ id: number; code: string; display_name: string }>>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/years").then(r => r.json()),
      fetch("/api/auth/me").then(r => r.json()),
      fetch("/api/pep/portfolios").then(r => r.json()),
      fetch("/api/pep/entities").then(r => r.json())
    ]).then(([years, user, portfolios, entities]) => {
      setAvailableYears(years.all || []);
      setIsAdmin(user.role === "admin");
      setEntities(user.entities || []);
      setAllPortfolios(portfolios);
      setAllEntities(entities || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ year: String(year) });
        if (selectedEntity !== "all") params.set("entityId", selectedEntity);
        if (selectedPortfolio !== "all") params.set("portfolioId", selectedPortfolio);
        
        const res = await fetch(`/api/pep/summary?${params}`);
        if (res.ok) {
          setSummaryData(await res.json());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [year, selectedEntity, selectedPortfolio]);

  const formatCurrency = (v: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  const formatNumber = (v: number, decimals = 0) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: decimals }).format(v);
  const formatPercent = (v: number) => `${v.toFixed(1)}%`;

  const utilizationColor = (pct: number) => {
    if (pct >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (pct >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-rose-600 dark:text-rose-400";
  };

  const reloadData = () => {
    const params = new URLSearchParams({ year: String(year) });
    if (selectedEntity !== "all") params.set("entityId", selectedEntity);
    if (selectedPortfolio !== "all") params.set("portfolioId", selectedPortfolio);
    fetch(`/api/pep/summary?${params}`).then(r => r.json()).then(setSummaryData).catch(() => {});
  };

  const handleSaveEmployee = async () => {
    if (!employeeForm.first_name || !employeeForm.last_name || !employeeForm.entity_id) {
      alert("Vorname, Nachname und Firma sind erforderlich");
      return;
    }
    setSavingEmployee(true);
    try {
      const res = await fetch("/api/pep/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...employeeForm,
          entity_id: Number(employeeForm.entity_id),
          weekly_hours: Number(employeeForm.weekly_hours) || 40,
          hourly_rate: employeeForm.hourly_rate ? Number(employeeForm.hourly_rate) : null
        })
      });
      if (res.ok) {
        setShowEmployeeForm(false);
        setEmployeeForm({ first_name: "", last_name: "", email: "", position: "", entity_id: "", weekly_hours: "40", hourly_rate: "", portfolio_ids: [] });
        reloadData();
      } else {
        const data = await res.json();
        alert(data.error || "Fehler beim Speichern");
      }
    } catch (e) {
      alert("Fehler beim Speichern");
    } finally {
      setSavingEmployee(false);
    }
  };

  return (
    <main className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-xl font-bold text-white shadow-lg shadow-violet-500/25">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Personal-Einsatz-Planung</div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">PEP Dashboard</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium dark:text-white shadow-sm"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium dark:text-white shadow-sm"
            >
              <option value="all">Alle Firmen</option>
              {entities.map((e) => (
                <option key={e.code} value={String(e.id)}>{e.name}</option>
              ))}
            </select>
            <select
              value={selectedPortfolio}
              onChange={(e) => setSelectedPortfolio(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium dark:text-white shadow-sm"
            >
              <option value="all">Alle Portfolios</option>
              {allPortfolios.map((p) => (
                <option key={p.id} value={String(p.id)}>{p.display_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex gap-2 rounded-xl bg-slate-100 dark:bg-slate-700/50 p-1">
          {[
            { id: "overview", label: "Übersicht", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
            { id: "employees", label: "Mitarbeiter", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m0 0V6" },
            { id: "planning", label: "Planung", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-sky-500" />
        </div>
      ) : summaryData && activeTab === "overview" ? (
        <>
          {/* KPI Cards */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700">
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Mitarbeiter</div>
              <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{summaryData.totals.employeeCount}</div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700">
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Zielumsatz (100%)</div>
              <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(summaryData.totals.targetRevenue)}</div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700">
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Prognose-Umsatz</div>
              <div className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(summaryData.totals.forecastRevenue)}</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {formatPercent((summaryData.totals.forecastRevenue / summaryData.totals.targetRevenue) * 100 || 0)} vom Ziel
              </div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700">
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Auslastung</div>
              <div className={`mt-2 text-3xl font-bold ${utilizationColor(summaryData.totals.utilizationPercent)}`}>
                {formatPercent(summaryData.totals.utilizationPercent)}
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {formatNumber(summaryData.totals.billableHours)} / {formatNumber(summaryData.totals.availableHours)} Std.
              </div>
            </div>
          </section>

          {/* Portfolio Overview */}
          {summaryData.portfolios.length > 0 && (
            <section className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700">
              <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">Auslastung nach Portfolio</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {summaryData.portfolios.map((p) => (
                  <div key={p.id} className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-4 w-4 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="font-semibold text-slate-900 dark:text-white">{p.name}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">({p.employeeCount} MA)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-slate-500 dark:text-slate-400">Zielumsatz</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{formatCurrency(p.totals.targetRevenue)}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 dark:text-slate-400">Prognose</div>
                        <div className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(p.totals.forecastRevenue)}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 dark:text-slate-400">Kapazität</div>
                        <div className="font-semibold text-slate-900 dark:text-white">{formatNumber(p.totals.availableHours)} Std.</div>
                      </div>
                      <div>
                        <div className="text-slate-500 dark:text-slate-400">Auslastung</div>
                        <div className={`font-semibold ${utilizationColor(p.totals.utilizationPercent)}`}>
                          {formatPercent(p.totals.utilizationPercent)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Entity Overview */}
          {summaryData.entities.length > 0 && (
            <section className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700">
              <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">Auslastung nach Firma</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Firma</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Mitarbeiter</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Zielumsatz</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Prognose</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Kapazität (Std.)</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Auslastung</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {summaryData.entities.map((e) => (
                      <tr key={e.entityId} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{e.entityName}</td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{e.employeeCount}</td>
                        <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{formatCurrency(e.totals.targetRevenue)}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(e.totals.forecastRevenue)}</td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatNumber(e.totals.availableHours)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${utilizationColor(e.totals.utilizationPercent)}`}>
                          {formatPercent(e.totals.utilizationPercent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      ) : summaryData && activeTab === "employees" ? (
        <section className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mitarbeiter ({summaryData.employees.length})</h2>
            <button
              onClick={() => setShowEmployeeForm(true)}
              className="flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Mitarbeiter hinzufügen
            </button>
          </div>

          {showEmployeeForm && (
            <div className="mb-6 rounded-xl border-2 border-dashed border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/20 p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Neuer Mitarbeiter</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Vorname *</label>
                  <input
                    type="text"
                    value={employeeForm.first_name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, first_name: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nachname *</label>
                  <input
                    type="text"
                    value={employeeForm.last_name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, last_name: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Firma *</label>
                  <select
                    value={employeeForm.entity_id}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, entity_id: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm dark:text-white"
                  >
                    <option value="">Firma wählen…</option>
                    {(isAdmin ? allEntities : entities.map(ent => ({ id: ent.id, code: ent.code, display_name: ent.name }))).map((e) => (
                      <option key={e.code} value={e.id || e.code}>{e.display_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Position</label>
                  <input
                    type="text"
                    value={employeeForm.position}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, position: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm dark:text-white"
                    placeholder="z.B. Entwickler"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">E-Mail</label>
                  <input
                    type="email"
                    value={employeeForm.email}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Wochenstunden</label>
                  <input
                    type="number"
                    value={employeeForm.weekly_hours}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, weekly_hours: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Stundensatz (€)</label>
                  <input
                    type="number"
                    value={employeeForm.hourly_rate}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, hourly_rate: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm dark:text-white"
                    placeholder="optional"
                  />
                </div>
                {isAdmin && allPortfolios.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Portfolios</label>
                    <div className="flex flex-wrap gap-2">
                      {allPortfolios.map((p) => (
                        <label key={p.id} className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={employeeForm.portfolio_ids.includes(p.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEmployeeForm({ ...employeeForm, portfolio_ids: [...employeeForm.portfolio_ids, p.id] });
                              } else {
                                setEmployeeForm({ ...employeeForm, portfolio_ids: employeeForm.portfolio_ids.filter(id => id !== p.id) });
                              }
                            }}
                            className="rounded border-slate-300"
                          />
                          <span className="px-2 py-0.5 rounded-full text-white text-xs" style={{ backgroundColor: p.color }}>{p.code}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setShowEmployeeForm(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveEmployee}
                  disabled={savingEmployee}
                  className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-50"
                >
                  {savingEmployee ? "Speichern…" : "Speichern"}
                </button>
              </div>
            </div>
          )}

          {summaryData.employees.length === 0 && !showEmployeeForm && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-slate-500 dark:text-slate-400 mb-4">Noch keine Mitarbeiter angelegt.</p>
              <button
                onClick={() => setShowEmployeeForm(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Ersten Mitarbeiter hinzufügen
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Firma</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Portfolios</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Zielumsatz</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Prognose</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Urlaub (Tage)</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Kapazität</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Auslastung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {summaryData.employees.map((emp) => (
                  <tr 
                    key={emp.id} 
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                    onClick={() => { setSelectedEmployee(emp); setActiveTab("planning"); }}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {emp.last_name}, {emp.first_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{emp.entity_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {emp.portfolios.map((p) => (
                          <span 
                            key={p.id} 
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                            style={{ backgroundColor: p.color }}
                          >
                            {p.code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{formatCurrency(emp.totals.targetRevenue)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(emp.totals.forecastRevenue)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatNumber(emp.totals.plannedAbsence)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatNumber(emp.totals.availableHours)} Std.</td>
                    <td className={`px-4 py-3 text-right font-semibold ${utilizationColor(emp.totals.utilizationPercent)}`}>
                      {formatPercent(emp.totals.utilizationPercent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : summaryData && activeTab === "planning" ? (
        <section className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700">
          {selectedEmployee ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSelectedEmployee(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {selectedEmployee.last_name}, {selectedEmployee.first_name}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{selectedEmployee.entity_name} • {selectedEmployee.position || "–"}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {selectedEmployee.portfolios.map((p) => (
                    <span 
                      key={p.id} 
                      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.display_name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Monthly Planning Grid */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Monat</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Arbeitstage</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Urlaub</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Intern</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Netto-Tage</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Kapazität</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Zielumsatz</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Prognose %</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Prognose €</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Auslastung</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {selectedEmployee.monthly.map((m) => (
                      <tr key={m.month} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{MONTHS[m.month - 1]}</td>
                        <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{m.workingDays}</td>
                        <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400">{m.vacationDays || "–"}</td>
                        <td className="px-3 py-2 text-right text-sky-600 dark:text-sky-400">{m.internalDays || "–"}</td>
                        <td className="px-3 py-2 text-right text-slate-900 dark:text-white font-medium">{formatNumber(m.netAvailableDays, 1)}</td>
                        <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{formatNumber(m.availableHours)} Std.</td>
                        <td className="px-3 py-2 text-right text-slate-900 dark:text-white">{formatCurrency(m.targetRevenue)}</td>
                        <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{m.forecastPercent}%</td>
                        <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(m.forecastRevenue)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${utilizationColor(m.utilizationPercent)}`}>
                          {formatPercent(m.utilizationPercent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 font-semibold">
                      <td className="px-3 py-2 text-slate-900 dark:text-white">Gesamt</td>
                      <td className="px-3 py-2 text-right text-slate-900 dark:text-white">{formatNumber(selectedEmployee.totals.availableDays)}</td>
                      <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400">
                        {formatNumber(selectedEmployee.monthly.reduce((s, m) => s + m.vacationDays, 0))}
                      </td>
                      <td className="px-3 py-2 text-right text-sky-600 dark:text-sky-400">
                        {formatNumber(selectedEmployee.monthly.reduce((s, m) => s + m.internalDays, 0))}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-900 dark:text-white">{formatNumber(selectedEmployee.totals.netAvailableDays)}</td>
                      <td className="px-3 py-2 text-right text-slate-900 dark:text-white">{formatNumber(selectedEmployee.totals.availableHours)} Std.</td>
                      <td className="px-3 py-2 text-right text-slate-900 dark:text-white">{formatCurrency(selectedEmployee.totals.targetRevenue)}</td>
                      <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">–</td>
                      <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedEmployee.totals.forecastRevenue)}</td>
                      <td className={`px-3 py-2 text-right ${utilizationColor(selectedEmployee.totals.utilizationPercent)}`}>
                        {formatPercent(selectedEmployee.totals.utilizationPercent)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>Wählen Sie einen Mitarbeiter aus der Mitarbeiterliste, um die Planung zu sehen.</p>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
