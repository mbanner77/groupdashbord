import { getAsync, execAsync } from "./db";

export async function getSetting(key: string): Promise<string | null> {
  const row = await getAsync<{ value: string }>("SELECT value FROM settings WHERE key = $1", [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await execAsync(
    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
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
