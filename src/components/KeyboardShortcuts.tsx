"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Show help with ?
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowHelp((v) => !v);
        return;
      }

      // Navigation shortcuts with 'g' prefix
      if (e.key === "g" && !e.ctrlKey && !e.metaKey) {
        const handleSecondKey = (e2: KeyboardEvent) => {
          switch (e2.key) {
            case "h":
              router.push("/");
              break;
            case "d":
              router.push("/dashboard");
              break;
            case "w":
              router.push("/workbook/umsatz");
              break;
            case "p":
              router.push("/profile");
              break;
            case "a":
              router.push("/admin/users");
              break;
          }
          window.removeEventListener("keydown", handleSecondKey);
        };
        window.addEventListener("keydown", handleSecondKey, { once: true });
        setTimeout(() => window.removeEventListener("keydown", handleSecondKey), 1000);
        return;
      }

      // Escape to close modals
      if (e.key === "Escape") {
        setShowHelp(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  if (!showHelp) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Tastenkürzel</h2>
          <button
            onClick={() => setShowHelp(false)}
            className="text-slate-400 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Navigation</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Home</span>
                <kbd className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs dark:bg-slate-700">g h</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Dashboard</span>
                <kbd className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs dark:bg-slate-700">g d</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Workbook</span>
                <kbd className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs dark:bg-slate-700">g w</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Profil</span>
                <kbd className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs dark:bg-slate-700">g p</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Admin</span>
                <kbd className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs dark:bg-slate-700">g a</kbd>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Allgemein</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Diese Hilfe anzeigen</span>
                <kbd className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs dark:bg-slate-700">?</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Schließen</span>
                <kbd className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs dark:bg-slate-700">Esc</kbd>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Drücke <kbd className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-700">?</kbd> um dieses Menü zu öffnen/schließen
        </p>
      </div>
    </div>
  );
}
