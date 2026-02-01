"use client";

import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Administration</h1>
        <p className="mt-1 text-sm text-slate-500">System- und Benutzereinstellungen verwalten</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Benutzerverwaltung */}
        <Link
          href="/admin/users"
          className="group rounded-xl border border-slate-200 bg-white p-6 transition hover:border-sky-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:hover:border-sky-600"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400">
            Benutzerverwaltung
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Benutzer erstellen, bearbeiten und Berechtigungen verwalten
          </p>
        </Link>

        {/* E-Mail Konfiguration */}
        <Link
          href="/admin/email"
          className="group rounded-xl border border-slate-200 bg-white p-6 transition hover:border-emerald-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:hover:border-emerald-600"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
            E-Mail Konfiguration
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            SMTP-Server für E-Mail-Benachrichtigungen einrichten
          </p>
        </Link>

        {/* Excel Import */}
        <Link
          href="/admin/import"
          className="group rounded-xl border border-slate-200 bg-white p-6 transition hover:border-amber-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:hover:border-amber-600"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
            Excel Import
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Daten aus Excel-Dateien importieren
          </p>
        </Link>

        {/* Audit Log */}
        <Link
          href="/admin/audit"
          className="group rounded-xl border border-slate-200 bg-white p-6 transition hover:border-purple-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:hover:border-purple-600"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
            Audit-Log
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Änderungshistorie und Benutzeraktivitäten einsehen
          </p>
        </Link>

        {/* Alerts */}
        <Link
          href="/admin/alerts"
          className="group rounded-xl border border-slate-200 bg-white p-6 transition hover:border-rose-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:hover:border-rose-600"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400">
            Alert-Regeln
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Schwellwerte und Benachrichtigungen konfigurieren
          </p>
        </Link>

        {/* Portfolios */}
        <Link
          href="/admin/portfolios"
          className="group rounded-xl border border-slate-200 bg-white p-6 transition hover:border-violet-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:hover:border-violet-600"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400">
            Portfolios
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Portfolios für die PEP-Mitarbeiterzuordnung verwalten
          </p>
        </Link>
      </div>
    </div>
  );
}
