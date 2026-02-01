import type { WorkbookLine } from "../lib/workbook";

export function WorkbookTable(props: {
  months: Array<{ month: number; label: string }>;
  lines: WorkbookLine[];
}) {
  const nf = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const formatValue = (v: number) => (Number.isFinite(v) ? nf.format(v) : "–");

  const isGroupRow = (l: WorkbookLine) => l.entityCode === "group";

  return (
    <section className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-lg ring-1 ring-slate-200/60 dark:ring-slate-700">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Datentabelle</h3>
        <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          {props.lines.length} Zeilen
        </span>
      </div>
      <div className="max-h-[600px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/50">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 min-w-[140px] max-w-[180px] border-b-2 border-slate-300 dark:border-slate-600 bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Einheit
              </th>
              <th className="sticky left-[140px] top-0 z-30 min-w-[160px] max-w-[200px] border-b-2 border-l border-slate-300 dark:border-slate-600 bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Zeile
              </th>
              {props.months.map((m) => (
                <th
                  key={m.month}
                  className="sticky top-0 z-20 w-[80px] min-w-[80px] border-b-2 border-slate-300 dark:border-slate-600 bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800 px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {props.lines.map((l, idx) => {
              const isGroup = isGroupRow(l);
              return (
                <tr
                  key={`${l.entityCode}-${l.label}-${idx}`}
                  className={`transition-colors duration-150 ${
                    isGroup
                      ? "bg-sky-50/70 dark:bg-sky-900/30 font-semibold hover:bg-sky-100/70 dark:hover:bg-sky-900/50"
                      : idx % 2 === 0
                        ? "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
                        : "bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100/50 dark:hover:bg-slate-700/50"
                  }`}
                >
                  <td
                    className={`sticky left-0 z-10 min-w-[140px] max-w-[180px] truncate px-4 py-2.5 ${
                      isGroup ? "bg-sky-50/90 dark:bg-sky-900/50 text-sky-900 dark:text-sky-200" : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    }`}
                  >
                    {l.entityName}
                  </td>
                  <td
                    className={`sticky left-[140px] z-10 min-w-[160px] max-w-[200px] truncate border-l border-slate-200 dark:border-slate-700 px-4 py-2.5 ${
                      isGroup ? "bg-sky-50/90 dark:bg-sky-900/50 text-sky-800 dark:text-sky-300" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {l.label}
                  </td>
                  {l.values.map((v, i) => (
                    <td
                      key={i}
                      className={`w-[80px] min-w-[80px] px-3 py-2.5 text-right font-mono text-[13px] tabular-nums ${
                        Number.isFinite(v) && v < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : isGroup
                            ? "text-sky-900 dark:text-sky-200"
                            : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {formatValue(v)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
