import { getDb } from "@/lib/db";

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = db.get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  db.exec(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
  await db.save();
}

export async function getForecastCutoffMonth(defaultValue = 12): Promise<number> {
  const raw = await getSetting("forecast_cutoff_month");
  if (!raw) return defaultValue;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 12) return defaultValue;
  return n;
}

export async function setForecastCutoffMonth(month: number): Promise<void> {
  await setSetting("forecast_cutoff_month", String(month));
}
