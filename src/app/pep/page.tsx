"use client";

import { useEffect, useState, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";

interface Portfolio {
  id: number;
  code: string;
  display_name: string;
  color: string;
  allocation_percent: number;
}

interface Employee {
  employee_id: number;
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
  portfolioId: number | null;
  portfolioCode: string | null;
  portfolioName: string | null;
  portfolioColor: string | null;
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
  monthly: Array<{
    month: number;
    targetRevenue: number;
    forecastRevenue: number;
    actualRevenue: number;
    availableHours: number;
    billableHours: number;
    utilizationPercent: number;
  }>;
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
  const [editingPlanning, setEditingPlanning] = useState<Record<number, { portfolioId: number | null; targetRevenue: number; forecastPercent: number; vacationDays: number; internalDays: number; sickDays: number; trainingDays: number; actualRevenue: number; billableHours: number; notes: string }>>({});
  const [savingPlanning, setSavingPlanning] = useState(false);
  const [allPortfolios, setAllPortfolios] = useState<Array<{ id: number; code: string; display_name: string; color: string }>>([]);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showActuals, setShowActuals] = useState(false);
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
  const [yearlyComment, setYearlyComment] = useState("");
  const [showDrillDown, setShowDrillDown] = useState<{ type: string; data: EmployeeSummary[] } | null>(null);

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

  // Initialize editing data when employee is selected
  const initEditingPlanning = async (emp: EmployeeSummary) => {
    const data: Record<number, { portfolioId: number | null; targetRevenue: number; forecastPercent: number; vacationDays: number; internalDays: number; sickDays: number; trainingDays: number; actualRevenue: number; billableHours: number; notes: string }> = {};
    for (let m = 1; m <= 12; m++) {
      const monthData = emp.monthly.find(md => md.month === m);
      data[m] = {
        portfolioId: monthData?.portfolioId || null,
        targetRevenue: monthData?.targetRevenue || 0,
        forecastPercent: monthData?.forecastPercent || 80,
        vacationDays: monthData?.vacationDays || 0,
        internalDays: monthData?.internalDays || 0,
        sickDays: monthData?.sickDays || 0,
        trainingDays: monthData?.trainingDays || 0,
        actualRevenue: monthData?.actualRevenue || 0,
        billableHours: monthData?.billableHours || 0,
        notes: ""
      };
    }
    setEditingPlanning(data);
    // Load yearly comment
    try {
      const res = await fetch(`/api/pep/comments?employeeId=${emp.employee_id}&year=${year}`);
      if (res.ok) {
        const { comment } = await res.json();
        setYearlyComment(comment || "");
      }
    } catch { setYearlyComment(""); }
  };

  // Filter employees based on search
  const filteredEmployees = useMemo(() => {
    if (!summaryData?.employees || !employeeSearch.trim()) return summaryData?.employees || [];
    const search = employeeSearch.toLowerCase();
    return summaryData.employees.filter(emp => 
      emp.first_name.toLowerCase().includes(search) ||
      emp.last_name.toLowerCase().includes(search) ||
      emp.entity_name.toLowerCase().includes(search) ||
      emp.position?.toLowerCase().includes(search)
    );
  }, [summaryData?.employees, employeeSearch]);

  // Excel Export function
  const exportToExcel = () => {
    if (!summaryData) return;
    const rows = [
      ["Name", "Firma", "Position", "Zielumsatz", "Prognose", "IST-Umsatz", "Urlaub", "Kapazität (Std.)", "Auslastung %"].join("\t")
    ];
    summaryData.employees.forEach(emp => {
      rows.push([
        `${emp.last_name}, ${emp.first_name}`,
        emp.entity_name,
        emp.position || "",
        emp.totals.targetRevenue,
        emp.totals.forecastRevenue,
        emp.totals.actualRevenue,
        emp.totals.plannedAbsence,
        emp.totals.availableHours,
        emp.totals.utilizationPercent.toFixed(1)
      ].join("\t"));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/tab-separated-values" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PEP_${year}_Export.tsv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Utilization badge component
  const UtilizationBadge = ({ percent }: { percent: number }) => {
    const bgColor = percent >= 80 ? "bg-emerald-100 dark:bg-emerald-900/30" : percent >= 60 ? "bg-amber-100 dark:bg-amber-900/30" : "bg-rose-100 dark:bg-rose-900/30";
    const textColor = utilizationColor(percent);
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${bgColor} ${textColor}`}>
        {formatPercent(percent)}
      </span>
    );
  };

  const handleSavePlanning = async () => {
    if (!selectedEmployee) return;
    setSavingPlanning(true);
    try {
      const monthly_data = Object.entries(editingPlanning).map(([month, data]) => ({
        month: Number(month),
        portfolio_id: data.portfolioId,
        target_revenue: data.targetRevenue,
        forecast_percent: data.forecastPercent,
        vacation_days: data.vacationDays,
        internal_days: data.internalDays,
        sick_days: data.sickDays,
        training_days: data.trainingDays,
        notes: data.notes
      }));
      
      const res = await fetch("/api/pep/planning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: selectedEmployee.employee_id,
          year,
          monthly_data
        })
      });
      
      if (res.ok) {
        reloadData();
        alert("Planung gespeichert!");
      } else {
        const data = await res.json();
        alert(data.error || "Fehler beim Speichern");
      }
    } catch (e) {
      alert("Fehler beim Speichern");
    } finally {
      setSavingPlanning(false);
    }
  };

  const updatePlanningValue = (month: number, field: keyof typeof editingPlanning[number], value: number | null | string) => {
    setEditingPlanning(prev => ({
      ...prev,
      [month]: { ...prev[month], [field]: value }
    }));
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
          {/* KPI Cards - Clickable for Drill-Down */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div 
              onClick={() => setShowDrillDown({ type: "employees", data: summaryData.employees })}
              className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700 cursor-pointer hover:ring-violet-300 dark:hover:ring-violet-600 transition"
            >
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Mitarbeiter</div>
              <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{summaryData.totals.employeeCount}</div>
              <div className="mt-1 text-xs text-slate-400">Klicken für Details</div>
            </div>
            <div 
              onClick={() => setShowDrillDown({ type: "target", data: [...summaryData.employees].sort((a,b) => b.totals.targetRevenue - a.totals.targetRevenue) })}
              className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700 cursor-pointer hover:ring-violet-300 dark:hover:ring-violet-600 transition"
            >
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Zielumsatz (100%)</div>
              <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(summaryData.totals.targetRevenue)}</div>
              <div className="mt-1 text-xs text-slate-400">Klicken für Details</div>
            </div>
            <div 
              onClick={() => setShowDrillDown({ type: "forecast", data: [...summaryData.employees].sort((a,b) => b.totals.forecastRevenue - a.totals.forecastRevenue) })}
              className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700 cursor-pointer hover:ring-violet-300 dark:hover:ring-violet-600 transition"
            >
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Prognose-Umsatz</div>
              <div className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(summaryData.totals.forecastRevenue)}</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {formatPercent((summaryData.totals.forecastRevenue / summaryData.totals.targetRevenue) * 100 || 0)} vom Ziel
              </div>
            </div>
            <div 
              onClick={() => setShowDrillDown({ type: "actual", data: [...summaryData.employees].sort((a,b) => b.totals.actualRevenue - a.totals.actualRevenue) })}
              className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700 cursor-pointer hover:ring-violet-300 dark:hover:ring-violet-600 transition"
            >
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">IST-Umsatz</div>
              <div className="mt-2 text-3xl font-bold text-sky-600 dark:text-sky-400">{formatCurrency(summaryData.totals.actualRevenue)}</div>
              <div className={`mt-1 text-sm ${summaryData.totals.actualRevenue >= summaryData.totals.targetRevenue ? "text-emerald-600" : "text-rose-600"}`}>
                {summaryData.totals.actualRevenue >= summaryData.totals.targetRevenue ? "+" : ""}{formatCurrency(summaryData.totals.actualRevenue - summaryData.totals.targetRevenue)} vs. Ziel
              </div>
            </div>
            <div 
              onClick={() => setShowDrillDown({ type: "utilization", data: [...summaryData.employees].sort((a,b) => b.totals.utilizationPercent - a.totals.utilizationPercent) })}
              className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700 cursor-pointer hover:ring-violet-300 dark:hover:ring-violet-600 transition"
            >
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Auslastung</div>
              <div className={`mt-2 text-3xl font-bold ${utilizationColor(summaryData.totals.utilizationPercent)}`}>
                {formatPercent(summaryData.totals.utilizationPercent)}
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {formatNumber(summaryData.totals.billableHours)} / {formatNumber(summaryData.totals.availableHours)} Std.
              </div>
            </div>
          </section>

          {/* Drill-Down Modal */}
          {showDrillDown && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDrillDown(null)}>
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                    {showDrillDown.type === "employees" && "Alle Mitarbeiter"}
                    {showDrillDown.type === "target" && "Zielumsatz nach Mitarbeiter"}
                    {showDrillDown.type === "forecast" && "Prognose nach Mitarbeiter"}
                    {showDrillDown.type === "actual" && "IST-Umsatz nach Mitarbeiter"}
                    {showDrillDown.type === "utilization" && "Auslastung nach Mitarbeiter"}
                  </h3>
                  <button onClick={() => setShowDrillDown(null)} className="text-slate-400 hover:text-slate-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-2 font-semibold text-slate-700 dark:text-slate-300">Name</th>
                        <th className="text-right py-2 font-semibold text-slate-700 dark:text-slate-300">Ziel</th>
                        <th className="text-right py-2 font-semibold text-slate-700 dark:text-slate-300">Prognose</th>
                        <th className="text-right py-2 font-semibold text-slate-700 dark:text-slate-300">IST</th>
                        <th className="text-right py-2 font-semibold text-slate-700 dark:text-slate-300">Auslastung</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {showDrillDown.data.map(emp => (
                        <tr key={emp.employee_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="py-2 font-medium text-slate-900 dark:text-white">{emp.last_name}, {emp.first_name}</td>
                          <td className="py-2 text-right text-slate-600 dark:text-slate-300">{formatCurrency(emp.totals.targetRevenue)}</td>
                          <td className="py-2 text-right text-emerald-600">{formatCurrency(emp.totals.forecastRevenue)}</td>
                          <td className="py-2 text-right text-sky-600">{formatCurrency(emp.totals.actualRevenue)}</td>
                          <td className={`py-2 text-right font-semibold ${utilizationColor(emp.totals.utilizationPercent)}`}>{formatPercent(emp.totals.utilizationPercent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Deviation Warnings */}
          {(() => {
            const deviations = summaryData.employees.filter(emp => {
              if (emp.totals.targetRevenue === 0) return false;
              const deviation = Math.abs((emp.totals.forecastRevenue - emp.totals.targetRevenue) / emp.totals.targetRevenue * 100);
              return deviation > 20;
            });
            return deviations.length > 0 ? (
              <section className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200">Abweichungswarnung ({deviations.length})</h3>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {deviations.slice(0, 6).map(emp => {
                    const deviation = ((emp.totals.forecastRevenue - emp.totals.targetRevenue) / emp.totals.targetRevenue * 100);
                    return (
                      <div key={emp.employee_id} className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">{emp.last_name}, {emp.first_name}</span>
                        <span className={`font-bold ${deviation < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                          {deviation > 0 ? "+" : ""}{deviation.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
                {deviations.length > 6 && (
                  <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">... und {deviations.length - 6} weitere mit &gt;20% Abweichung</div>
                )}
              </section>
            ) : null;
          })()}

          {/* Monthly Trend Chart */}
          {summaryData.monthly && summaryData.monthly.length > 0 && (
            <section className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700">
              <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">Monatlicher Umsatzverlauf</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summaryData.monthly.map((m, i) => ({ name: MONTHS[i], Ziel: m.targetRevenue, Prognose: m.forecastRevenue, IST: m.actualRevenue }))} margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: "rgba(15,23,42,0.9)", border: "none", borderRadius: 8 }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#94a3b8" }} />
                    <Legend />
                    <Line type="monotone" dataKey="Ziel" stroke="#94a3b8" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Prognose" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="IST" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Utilization Heatmap */}
          {summaryData.employees.length > 0 && (
            <section className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700">
              <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">Auslastung Heatmap</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="px-2 py-2 text-left font-semibold text-slate-700 dark:text-slate-300 sticky left-0 bg-white dark:bg-slate-800">Mitarbeiter</th>
                      {MONTHS.map(m => <th key={m} className="px-2 py-2 text-center font-semibold text-slate-700 dark:text-slate-300 min-w-[50px]">{m}</th>)}
                      <th className="px-2 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">Ø</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {summaryData.employees.slice(0, 20).map(emp => (
                      <tr key={emp.employee_id}>
                        <td className="px-2 py-1.5 font-medium text-slate-900 dark:text-white sticky left-0 bg-white dark:bg-slate-800 whitespace-nowrap">
                          {emp.last_name}, {emp.first_name}
                        </td>
                        {emp.monthly.map((m, i) => {
                          const pct = m.utilizationPercent;
                          const bg = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : pct > 0 ? "bg-rose-500" : "bg-slate-200 dark:bg-slate-700";
                          return (
                            <td key={i} className="px-1 py-1.5">
                              <div className={`${bg} rounded text-white text-center py-0.5 text-[10px] font-medium`} title={`${MONTHS[i]}: ${pct.toFixed(0)}%`}>
                                {pct > 0 ? `${pct.toFixed(0)}` : "-"}
                              </div>
                            </td>
                          );
                        })}
                        <td className={`px-2 py-1.5 text-center font-bold ${utilizationColor(emp.totals.utilizationPercent)}`}>
                          {formatPercent(emp.totals.utilizationPercent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {summaryData.employees.length > 20 && (
                  <div className="mt-2 text-center text-sm text-slate-500">... und {summaryData.employees.length - 20} weitere</div>
                )}
              </div>
            </section>
          )}

          {/* Portfolio Overview with Chart */}
          {summaryData.portfolios.length > 0 && (
            <section className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700">
              <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">Umsatz nach Portfolio</h2>
              <div className="h-64 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summaryData.portfolios.map(p => ({ name: p.name, Ziel: p.totals.targetRevenue, Prognose: p.totals.forecastRevenue, IST: p.totals.actualRevenue, color: p.color }))} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <XAxis type="number" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: "rgba(15,23,42,0.9)", border: "none", borderRadius: 8 }} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#94a3b8" }} />
                    <Bar dataKey="Ziel" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Prognose" fill="#10b981" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="IST" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-6 text-sm mb-6">
                <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-slate-400" /> Ziel</div>
                <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-emerald-500" /> Prognose</div>
                <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-sky-500" /> IST</div>
              </div>
              <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Details</h3>
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
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mitarbeiter ({filteredEmployees.length})</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Suchen..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-48 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 pl-9 pr-3 py-2 text-sm dark:text-white"
                />
              </div>
              <button
                onClick={() => window.open(`/api/pep/export/pdf?year=${year}`, "_blank")}
                className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                PDF
              </button>
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </button>
              {isAdmin && (
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 cursor-pointer">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Import
                  <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    const lines = text.split("\n").filter(l => l.trim());
                    const headers = lines[0].split("\t");
                    const data = lines.slice(1).map(line => {
                      const vals = line.split("\t");
                      const obj: Record<string, string | number> = {};
                      headers.forEach((h, i) => obj[h.trim()] = vals[i]?.trim() || "");
                      return obj;
                    });
                    const res = await fetch("/api/pep/planning/import", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ data, year })
                    });
                    if (res.ok) { const r = await res.json(); alert(`${r.imported} Zeilen importiert`); reloadData(); }
                    else alert("Import fehlgeschlagen");
                    e.target.value = "";
                  }} />
                </label>
              )}
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
                      <option key={e.code} value={e.id}>{e.display_name}</option>
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
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">€/Std.</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Zielumsatz</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Prognose</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Kapazität</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Potenzial</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Auslastung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredEmployees.map((emp) => (
                  <tr 
                    key={emp.employee_id} 
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                    onClick={() => { setSelectedEmployee(emp); initEditingPlanning(emp); setActiveTab("planning"); }}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {emp.last_name}, {emp.first_name}
                      {emp.position && <span className="block text-xs text-slate-500 dark:text-slate-400">{emp.position}</span>}
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
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{emp.hourly_rate ? `${formatNumber(emp.hourly_rate)}€` : "–"}</td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{formatCurrency(emp.totals.targetRevenue)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(emp.totals.forecastRevenue)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatNumber(emp.totals.availableHours)} Std.</td>
                    <td className="px-4 py-3 text-right text-violet-600 dark:text-violet-400">{emp.hourly_rate ? formatCurrency(emp.totals.availableHours * emp.hourly_rate) : "–"}</td>
                    <td className="px-4 py-3 text-right">
                      <UtilizationBadge percent={emp.totals.utilizationPercent} />
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

              {/* Yearly Comment */}
              <div className="mb-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Jahreskommentar {year}</label>
                <textarea
                  value={yearlyComment}
                  onChange={(e) => setYearlyComment(e.target.value)}
                  onBlur={async () => {
                    await fetch("/api/pep/comments", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ employeeId: selectedEmployee.employee_id, year, comment: yearlyComment })
                    });
                  }}
                  placeholder="Notizen zu diesem Mitarbeiter für das Jahr..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm dark:text-white resize-none"
                  rows={2}
                />
              </div>

              {/* Monthly Planning Grid - Editable */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Jahresplanung {year}</h3>
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={showActuals}
                      onChange={(e) => setShowActuals(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    IST-Werte anzeigen
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!confirm(`Planung aus ${year - 1} übernehmen? Vorhandene Daten werden überschrieben.`)) return;
                      const res = await fetch(`/api/pep/planning/copy?employeeId=${selectedEmployee.employee_id}&fromYear=${year - 1}&toYear=${year}`, { method: "POST" });
                      if (res.ok) { reloadData(); alert("Vorjahresplanung übernommen!"); }
                    }}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600"
                  >
                    📋 Aus {year - 1} kopieren
                  </button>
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/pep/forecast/auto-adjust", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ employeeId: selectedEmployee.employee_id, year })
                      });
                      if (res.ok) {
                        const data = await res.json();
                        alert(`Forecast angepasst!\nErreichungsrate: ${data.achievementRate}%\nNeue Prognose: ${data.newForecastPercent}%`);
                        reloadData();
                      } else {
                        alert("Keine IST-Daten für Anpassung verfügbar");
                      }
                    }}
                    className="rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                  >
                    ⚡ Auto-Forecast
                  </button>
                  <button
                    onClick={async () => {
                      await handleSavePlanning();
                      const res = await fetch("/api/pep/approvals", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ employeeId: selectedEmployee.employee_id, year, action: "submit" })
                      });
                      if (res.ok) alert("Planung zur Freigabe eingereicht!");
                    }}
                    className="rounded-lg border border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                  >
                    ✓ Zur Freigabe
                  </button>
                  <button
                    onClick={handleSavePlanning}
                    disabled={savingPlanning}
                    className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-50"
                  >
                    {savingPlanning ? "Speichern…" : "Planung speichern"}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="px-2 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Monat</th>
                      <th className="px-2 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Portfolio</th>
                      <th className="px-2 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">Urlaub</th>
                      <th className="px-2 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">Intern</th>
                      <th className="px-2 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">Krank</th>
                      <th className="px-2 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">Schulung</th>
                      <th className="px-2 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">Zielumsatz €</th>
                      <th className="px-2 py-2 text-center font-semibold text-slate-700 dark:text-slate-300">Prognose %</th>
                      {showActuals && <th className="px-2 py-2 text-center font-semibold text-sky-700 dark:text-sky-300">IST €</th>}
                      {showActuals && <th className="px-2 py-2 text-center font-semibold text-sky-700 dark:text-sky-300">Δ Plan/IST</th>}
                      <th className="px-2 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Netto-Tage</th>
                      <th className="px-2 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">Prognose €</th>
                      <th className="px-2 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">Notiz</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {selectedEmployee.monthly.map((m) => {
                      const ed = editingPlanning[m.month] || { portfolioId: null, targetRevenue: 0, forecastPercent: 80, vacationDays: 0, internalDays: 0, sickDays: 0, trainingDays: 0 };
                      const absenceDays = ed.vacationDays + ed.internalDays + ed.sickDays + ed.trainingDays;
                      const netDays = m.workingDays - absenceDays;
                      const forecastRevenue = ed.targetRevenue * (ed.forecastPercent / 100);
                      return (
                        <tr key={m.month} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="px-2 py-1 font-medium text-slate-900 dark:text-white">{MONTHS[m.month - 1]}</td>
                          <td className="px-1 py-1">
                            <select
                              value={ed.portfolioId ?? ""}
                              onChange={(e) => updatePlanningValue(m.month, "portfolioId", e.target.value ? Number(e.target.value) : null)}
                              className="w-32 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-sm dark:text-white"
                            >
                              <option value="">– kein –</option>
                              {allPortfolios.map(p => (
                                <option key={p.id} value={p.id}>{p.display_name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-1 py-1">
                            <input type="number" min="0" max="31" value={ed.vacationDays} onChange={(e) => updatePlanningValue(m.month, "vacationDays", Number(e.target.value))}
                              className="w-14 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-center text-sm dark:text-white" />
                          </td>
                          <td className="px-1 py-1">
                            <input type="number" min="0" max="31" value={ed.internalDays} onChange={(e) => updatePlanningValue(m.month, "internalDays", Number(e.target.value))}
                              className="w-14 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-center text-sm dark:text-white" />
                          </td>
                          <td className="px-1 py-1">
                            <input type="number" min="0" max="31" value={ed.sickDays} onChange={(e) => updatePlanningValue(m.month, "sickDays", Number(e.target.value))}
                              className="w-14 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-center text-sm dark:text-white" />
                          </td>
                          <td className="px-1 py-1">
                            <input type="number" min="0" max="31" value={ed.trainingDays} onChange={(e) => updatePlanningValue(m.month, "trainingDays", Number(e.target.value))}
                              className="w-14 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-center text-sm dark:text-white" />
                          </td>
                          <td className="px-1 py-1">
                            <input type="number" min="0" step="1000" value={ed.targetRevenue} onChange={(e) => updatePlanningValue(m.month, "targetRevenue", Number(e.target.value))}
                              className="w-24 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-center text-sm dark:text-white" />
                          </td>
                          <td className="px-1 py-1">
                            <input type="number" min="0" max="100" value={ed.forecastPercent} onChange={(e) => updatePlanningValue(m.month, "forecastPercent", Number(e.target.value))}
                              className="w-16 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-center text-sm dark:text-white" />
                          </td>
                          {showActuals && (
                            <td className="px-2 py-1 text-center text-sky-600 dark:text-sky-400 font-medium">
                              {formatCurrency(m.actualRevenue)}
                            </td>
                          )}
                          {showActuals && (
                            <td className={`px-2 py-1 text-center font-medium ${m.actualRevenue - ed.targetRevenue >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                              {m.actualRevenue - ed.targetRevenue >= 0 ? "+" : ""}{formatCurrency(m.actualRevenue - ed.targetRevenue)}
                            </td>
                          )}
                          <td className="px-2 py-1 text-right text-slate-900 dark:text-white font-medium">{formatNumber(netDays, 1)}</td>
                          <td className="px-2 py-1 text-right text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(forecastRevenue)}</td>
                          <td className="px-1 py-1">
                            <input type="text" value={ed.notes || ""} onChange={(e) => updatePlanningValue(m.month, "notes", e.target.value)}
                              placeholder="Notiz..."
                              className="w-28 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-sm dark:text-white" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {(() => {
                      const totals = Object.values(editingPlanning).reduce((acc, ed) => ({
                        vacationDays: acc.vacationDays + ed.vacationDays,
                        internalDays: acc.internalDays + ed.internalDays,
                        sickDays: acc.sickDays + ed.sickDays,
                        trainingDays: acc.trainingDays + ed.trainingDays,
                        targetRevenue: acc.targetRevenue + ed.targetRevenue,
                        forecastRevenue: acc.forecastRevenue + (ed.targetRevenue * ed.forecastPercent / 100)
                      }), { vacationDays: 0, internalDays: 0, sickDays: 0, trainingDays: 0, targetRevenue: 0, forecastRevenue: 0 });
                      const totalWorkingDays = selectedEmployee.monthly.reduce((s, m) => s + m.workingDays, 0);
                      const totalAbsence = totals.vacationDays + totals.internalDays + totals.sickDays + totals.trainingDays;
                      const totalNetDays = totalWorkingDays - totalAbsence;
                      const totalActualRevenue = selectedEmployee.monthly.reduce((s, m) => s + m.actualRevenue, 0);
                      const totalDelta = totalActualRevenue - totals.targetRevenue;
                      return (
                        <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 font-semibold">
                          <td className="px-2 py-2 text-slate-900 dark:text-white">Gesamt {year}</td>
                          <td className="px-2 py-2"></td>
                          <td className="px-2 py-2 text-center text-amber-600 dark:text-amber-400">{totals.vacationDays}</td>
                          <td className="px-2 py-2 text-center text-sky-600 dark:text-sky-400">{totals.internalDays}</td>
                          <td className="px-2 py-2 text-center text-rose-600 dark:text-rose-400">{totals.sickDays}</td>
                          <td className="px-2 py-2 text-center text-violet-600 dark:text-violet-400">{totals.trainingDays}</td>
                          <td className="px-2 py-2 text-center text-slate-900 dark:text-white">{formatCurrency(totals.targetRevenue)}</td>
                          <td className="px-2 py-2 text-center text-slate-600 dark:text-slate-300">–</td>
                          {showActuals && <td className="px-2 py-2 text-center text-sky-600 dark:text-sky-400">{formatCurrency(totalActualRevenue)}</td>}
                          {showActuals && <td className={`px-2 py-2 text-center ${totalDelta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{totalDelta >= 0 ? "+" : ""}{formatCurrency(totalDelta)}</td>}
                          <td className="px-2 py-2 text-right text-slate-900 dark:text-white">{formatNumber(totalNetDays)}</td>
                          <td className="px-2 py-2 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.forecastRevenue)}</td>
                          <td className="px-2 py-2"></td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            </>
          ) : summaryData.employees.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Mitarbeiter für Planung auswählen:</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {summaryData.employees.map((emp) => (
                  <button
                    key={emp.employee_id}
                    onClick={() => { setSelectedEmployee(emp); initEditingPlanning(emp); }}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-600 transition"
                  >
                    <div className="h-10 w-10 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-violet-600 dark:text-violet-300 font-semibold">
                      {emp.first_name[0]}{emp.last_name[0]}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{emp.first_name} {emp.last_name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{emp.entity_name}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="mb-4">Noch keine Mitarbeiter angelegt.</p>
              <button
                onClick={() => setActiveTab("employees")}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600"
              >
                Zum Mitarbeiter-Tab wechseln
              </button>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
