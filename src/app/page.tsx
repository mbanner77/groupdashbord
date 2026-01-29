import Link from "next/link";

const sheets = [
  {
    id: "umsatz",
    title: "Umsatz",
    description: "Umsatzplanung und IST/FC-Vergleich mit monatlicher Auswertung",
    bgLight: "bg-emerald-50",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    borderColor: "border-emerald-200"
  },
  {
    id: "ertrag",
    title: "Ertrag",
    description: "EBIT-Planung und IST/FC-Vergleich mit Margenanalyse",
    bgLight: "bg-sky-50",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
    borderColor: "border-sky-200"
  },
  {
    id: "headcount",
    title: "Headcount",
    description: "Personalplanung und IST/FC-Vergleich nach Bereichen",
    bgLight: "bg-violet-50",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    borderColor: "border-violet-200"
  }
];

const features = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "Interaktive Charts",
    description: "Bar- und Liniendiagramme mit Tooltips und Zoom"
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    title: "Daten bearbeiten",
    description: "Plan- und Forecast-Werte direkt in der App ändern"
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: "IST/FC Stichtag",
    description: "Flexibler Cutoff zwischen IST- und Forecast-Daten"
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
    title: "KPI Dashboard",
    description: "Alle wichtigen Kennzahlen auf einen Blick"
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: "15 Entitäten",
    description: "Alle Gesellschaften und Aggregate im Überblick"
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: "Excel-Import",
    description: "Daten direkt aus Excel-Dateien importieren"
  }
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-white p-8 shadow-lg ring-1 ring-slate-200/60 sm:p-10">
        <div className="absolute right-0 top-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-gradient-to-br from-sky-100 to-emerald-100 opacity-50 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-64 w-64 rounded-full bg-gradient-to-br from-violet-100 to-pink-100 opacity-50 blur-3xl" />
        
        <div className="relative flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-8">
          <div className="shrink-0 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-slate-200/60">
            <img
              src="/rc-logo.png"
              alt="RealCore"
              className="h-20 w-auto"
            />
          </div>
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Version 1.0 — Live
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Group Dashboard
            </h1>
            <p className="mt-4 max-w-xl text-lg text-slate-600">
              Zentrale Plattform für Finanzplanung und Controlling. 
              Analysiere Umsatz, EBIT und Headcount – bearbeite Plan- und Forecast-Daten in Echtzeit.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-slate-800 hover:shadow-xl active:scale-[0.98]"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                KPI Dashboard öffnen
              </Link>
              <Link
                href="/workbook/umsatz"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-all hover:bg-slate-50 hover:shadow-md active:scale-[0.98]"
              >
                Workbooks erkunden
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-slate-900">Funktionen</h2>
          <p className="mt-2 text-slate-600">Alles was du für die Finanzplanung brauchst</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                {feature.icon}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Workbook Cards */}
      <section>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Workbooks</h2>
            <p className="mt-1 text-slate-600">Detaillierte Analysen nach Bereich</p>
          </div>
          <Link
            href="/workbook"
            className="text-sm font-medium text-sky-600 hover:text-sky-700"
          >
            Alle anzeigen →
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {sheets.map((sheet) => (
            <Link
              key={sheet.id}
              href={`/workbook/${sheet.id}`}
              prefetch={true}
              className={`group block rounded-2xl border-2 ${sheet.borderColor} bg-white p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-1 active:scale-[0.99]`}
            >
              <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${sheet.iconBg}`}>
                <svg className={`h-6 w-6 ${sheet.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {sheet.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {sheet.description}
              </p>
              <div className={`mt-5 inline-flex items-center gap-1.5 rounded-lg ${sheet.bgLight} px-3 py-1.5 text-xs font-semibold ${sheet.iconColor}`}>
                Öffnen
                <svg className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div>
            <h2 className="text-xl font-bold">Bereit zur Analyse?</h2>
            <p className="mt-1 text-slate-300">
              Starte mit dem KPI Dashboard für einen Überblick aller Kennzahlen
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition-all hover:bg-slate-100 active:scale-[0.98]"
          >
            Dashboard öffnen
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}
