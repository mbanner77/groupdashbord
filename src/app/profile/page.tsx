"use client";

import { useState, useEffect } from "react";

export default function ProfilePage() {
  const [user, setUser] = useState<{ username: string; displayName: string; role: string } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser({ username: d.username, displayName: d.displayName, role: d.role }))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Neue Passwörter stimmen nicht überein" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "Fehler beim Ändern des Passworts" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profil</h1>
        <p className="mt-1 text-sm text-slate-500">Verwalte deine Kontoeinstellungen</p>
      </div>

      {/* User Info */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Benutzerinformationen</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Benutzername</span>
            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{user?.username || "-"}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Anzeigename</span>
            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{user?.displayName || "-"}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Rolle</span>
            <p className="mt-1">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                user?.role === "admin" 
                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                  : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300"
              }`}>
                {user?.role === "admin" ? "Administrator" : "Benutzer"}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Passwort ändern</h2>

        {message && (
          <div className={`mb-4 rounded-lg p-3 text-sm ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Aktuelles Passwort
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Neues Passwort
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              required
              minLength={8}
            />
            <p className="mt-1 text-xs text-slate-500">Mindestens 8 Zeichen</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Neues Passwort bestätigen
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:opacity-50"
          >
            {loading ? "Speichern…" : "Passwort ändern"}
          </button>
        </form>
      </div>
    </div>
  );
}
