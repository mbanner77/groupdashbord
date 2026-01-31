"use client";

import { useState } from "react";
import type { ValidationWarning } from "../lib/validation";

type ValidationBadgeProps = {
  warnings: ValidationWarning[];
};

export function ValidationBadge({ warnings }: ValidationBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  const errors = warnings.filter(w => w.severity === "error");
  const warns = warnings.filter(w => w.severity === "warning");
  const infos = warnings.filter(w => w.severity === "info");

  if (warnings.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Validiert
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
          errors.length > 0
            ? "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400"
            : warns.length > 0
            ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
            : "bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-900/30 dark:text-sky-400"
        }`}
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        {errors.length > 0 && <span>{errors.length} Fehler</span>}
        {warns.length > 0 && <span>{warns.length} Warnungen</span>}
        {infos.length > 0 && errors.length === 0 && warns.length === 0 && <span>{infos.length} Hinweise</span>}
      </button>

      {expanded && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Validierungshinweise</h4>
            <button
              onClick={() => setExpanded(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {warnings.slice(0, 10).map((w, i) => (
              <div
                key={i}
                className={`rounded p-2 text-xs ${
                  w.severity === "error"
                    ? "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400"
                    : w.severity === "warning"
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                    : "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400"
                }`}
              >
                {w.message}
              </div>
            ))}
            {warnings.length > 10 && (
              <p className="text-xs text-slate-500">... und {warnings.length - 10} weitere</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
