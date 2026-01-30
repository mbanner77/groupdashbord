import Link from "next/link";

const sheets = [
  {
    id: "umsatz",
    title: "Umsatz",
    description: "Umsatzplanung und IST/FC-Vergleich mit monatlicher Auswertung",
    bgLight: "bg-emerald-50",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600"
  },
  {
    id: "ertrag",
    title: "Ertrag",
    description: "EBIT-Planung und IST/FC-Vergleich mit Margenanalyse",
    bgLight: "bg-sky-50",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600"
  },
  {
    id: "headcount",
    title: "Headcount",
    description: "Personalplanung und IST/FC-Vergleich nach Bereichen",
    bgLight: "bg-violet-50",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600"
  }
];

export default function WorkbookIndexPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white dark:bg-slate-800 p-8 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Workbooks</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Wähle ein Workbook aus. Charts zeigen immer die aggregierten Werte für die Gruppe.
        </p>
      </section>

      <div className="grid gap-6 sm:grid-cols-3">
        {sheets.map((sheet) => (
          <Link
            key={sheet.id}
            href={`/workbook/${sheet.id}`}
            prefetch={true}
            className="group block rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-md ring-1 ring-slate-200/80 dark:ring-slate-700 transition-all duration-200 hover:shadow-xl hover:-translate-y-1 active:scale-[0.99]"
          >
            <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${sheet.iconBg} dark:bg-slate-700`}>
              <svg className={`h-6 w-6 ${sheet.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {sheet.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
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
    </div>
  );
}
