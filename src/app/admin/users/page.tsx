"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type User = {
  id: number;
  username: string;
  displayName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

type Permission = {
  entityId: number;
  entityCode: string;
  entityName: string;
  canView: boolean;
  canEdit: boolean;
};

export default function UsersAdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    displayName: "",
    role: "user",
    isActive: true,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch {
      setError("Fehler beim Laden der Benutzer");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (editingUser) {
        const res = await fetch(`/api/admin/users/${editingUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Fehler beim Aktualisieren");
          return;
        }
        setSuccess("Benutzer aktualisiert");
      } else {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Fehler beim Erstellen");
          return;
        }
        setSuccess("Benutzer erstellt");
      }

      setShowModal(false);
      setEditingUser(null);
      setFormData({ username: "", password: "", displayName: "", role: "user", isActive: true });
      loadUsers();
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Server-Fehler");
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Benutzer "${user.displayName}" wirklich löschen?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (res.ok) {
        setSuccess("Benutzer gelöscht");
        loadUsers();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Fehler beim Löschen");
      }
    } catch {
      setError("Server-Fehler");
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: "",
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
    });
    setShowModal(true);
  };

  const openPermissionsModal = async (user: User) => {
    setEditingUser(user);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/permissions`);
      if (res.ok) {
        setPermissions(await res.json());
        setShowPermissionsModal(true);
      }
    } catch {
      setError("Fehler beim Laden der Berechtigungen");
    }
  };

  const handlePermissionChange = (entityId: number, field: "canView" | "canEdit", value: boolean) => {
    setPermissions((prev) =>
      prev.map((p) => {
        if (p.entityId === entityId) {
          if (field === "canView" && !value) {
            return { ...p, canView: false, canEdit: false };
          }
          if (field === "canEdit" && value) {
            return { ...p, canView: true, canEdit: true };
          }
          return { ...p, [field]: value };
        }
        return p;
      })
    );
  };

  const savePermissions = async () => {
    if (!editingUser) return;

    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
      if (res.ok) {
        setSuccess("Berechtigungen gespeichert");
        setShowPermissionsModal(false);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("Fehler beim Speichern");
      }
    } catch {
      setError("Server-Fehler");
    }
  };

  const selectAllPermissions = (canView: boolean, canEdit: boolean) => {
    setPermissions((prev) => prev.map((p) => ({ ...p, canView, canEdit: canEdit && canView })));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Benutzerverwaltung</h1>
          <p className="mt-1 text-sm text-slate-500">Benutzer und Berechtigungen verwalten</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/import"
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Excel Import
          </Link>
          <Link
            href="/admin/audit"
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Audit-Log
          </Link>
        <button
          onClick={() => {
            setEditingUser(null);
            setFormData({ username: "", password: "", displayName: "", role: "user", isActive: true });
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Benutzer
        </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 ring-1 ring-red-200">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-600 ring-1 ring-emerald-200">{success}</div>
      )}

      <div className="rounded-xl bg-white shadow-lg ring-1 ring-slate-200/60 dark:bg-slate-800 dark:ring-slate-700">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Benutzer</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Rolle</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Erstellt</th>
              <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900 dark:text-white">{user.displayName}</div>
                  <div className="text-sm text-slate-500">@{user.username}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    user.role === "admin" 
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" 
                      : "bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-300"
                  }`}>
                    {user.role === "admin" ? "Admin" : "Benutzer"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    user.isActive 
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                    {user.isActive ? "Aktiv" : "Inaktiv"}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {new Date(user.createdAt).toLocaleDateString("de-DE")}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openPermissionsModal(user)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                      title="Berechtigungen"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => openEditModal(user)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                      title="Bearbeiten"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                      title="Löschen"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
            <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">
              {editingUser ? "Benutzer bearbeiten" : "Neuer Benutzer"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Benutzername</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  disabled={!!editingUser}
                  required={!editingUser}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-700"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Passwort {editingUser && "(leer lassen für keine Änderung)"}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Anzeigename</label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Rolle</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
                >
                  <option value="user">Benutzer</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              {editingUser && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Aktiv</span>
                </label>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
                >
                  {editingUser ? "Speichern" : "Erstellen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
            <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">
              Berechtigungen: {editingUser.displayName}
            </h2>
            <p className="mb-4 text-sm text-slate-500">
              {editingUser.role === "admin" ? "Administratoren haben automatisch Zugriff auf alle Entitäten." : "Wählen Sie die Entitäten, auf die der Benutzer zugreifen darf."}
            </p>

            {editingUser.role !== "admin" && (
              <>
                <div className="mb-4 flex gap-2">
                  <button
                    onClick={() => selectAllPermissions(true, false)}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Alle ansehen
                  </button>
                  <button
                    onClick={() => selectAllPermissions(true, true)}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Alle bearbeiten
                  </button>
                  <button
                    onClick={() => selectAllPermissions(false, false)}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Keine
                  </button>
                </div>

                <div className="max-h-80 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Entität</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500">Ansehen</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500">Bearbeiten</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {permissions.map((p) => (
                        <tr key={p.entityId} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-900 dark:text-white">{p.entityName}</span>
                            <span className="ml-2 text-xs text-slate-400">({p.entityCode})</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={p.canView}
                              onChange={(e) => handlePermissionChange(p.entityId, "canView", e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={p.canEdit}
                              onChange={(e) => handlePermissionChange(p.entityId, "canEdit", e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
              >
                Abbrechen
              </button>
              {editingUser.role !== "admin" && (
                <button
                  onClick={savePermissions}
                  className="flex-1 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
                >
                  Speichern
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
