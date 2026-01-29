import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getForecastCutoffMonth } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Mapping = {
  area: "Umsatz" | "Ertrag" | "Headcount";
  kpiCode: string;
  mode: "plan" | "ist_fc";
};

function mapLabelToKpi(sheet: "Umsatz" | "Ertrag" | "Headcount", label: string): Mapping | null {
  if (sheet === "Umsatz") {
    if (label === "Plan Umsatz") return { area: "Umsatz", kpiCode: "umsatz", mode: "plan" };
    if (label === "IST/FC Umsatz") return { area: "Umsatz", kpiCode: "umsatz", mode: "ist_fc" };
    return null;
  }
  if (sheet === "Ertrag") {
    if (label === "Plan EBIT") return { area: "Ertrag", kpiCode: "ebit", mode: "plan" };
    if (label === "IST/FC EBIT") return { area: "Ertrag", kpiCode: "ebit", mode: "ist_fc" };
    return null;
  }

  if (label === "Plan Headcount") return { area: "Headcount", kpiCode: "headcount", mode: "plan" };
  if (label === "IST/FC headcount") return { area: "Headcount", kpiCode: "headcount", mode: "ist_fc" };
  if (label === "davon Umlagerelevant") return { area: "Headcount", kpiCode: "headcount_umlagerelevant", mode: "ist_fc" };
  if (label === "ohne Umlage Deutschland") return { area: "Headcount", kpiCode: "headcount_ohne_umlage_de", mode: "ist_fc" };
  if (label === "ohne Umlage") return { area: "Headcount", kpiCode: "headcount_ohne_umlage", mode: "ist_fc" };
  return null;
}

const putSchema = z.object({
  sheet: z.enum(["Umsatz", "Ertrag", "Headcount"]),
  year: z.number().int().min(2000).max(2100),
  entityCode: z.string().min(1),
  label: z.string().min(1),
  values: z.array(z.union([z.number(), z.null()])).length(12),
  cutoffMonth: z.number().int().min(1).max(12).optional()
});

export async function PUT(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const { sheet, year, entityCode, label } = parsed.data;
  const mapping = mapLabelToKpi(sheet, label);
  if (!mapping) {
    return NextResponse.json({ error: "unsupported edit label" }, { status: 400 });
  }

  const cutoffMonth = parsed.data.cutoffMonth ?? (await getForecastCutoffMonth());
  const db = await getDb();

  const entityRow = db.get<{ id: number; is_aggregate: number }>(
    "SELECT id, is_aggregate FROM entities WHERE code = ?",
    [entityCode]
  );
  if (!entityRow) {
    return NextResponse.json({ error: "unknown entity" }, { status: 404 });
  }
  if (entityRow.is_aggregate === 1) {
    return NextResponse.json({ error: "cannot edit aggregate entity" }, { status: 400 });
  }

  const kpiRow = db.get<{ id: number }>("SELECT id FROM kpis WHERE area = ? AND code = ?", [mapping.area, mapping.kpiCode]);
  if (!kpiRow) {
    return NextResponse.json({ error: "unknown kpi" }, { status: 404 });
  }

  const now = new Date().toISOString();
  let updated = 0;

  for (let i = 0; i < 12; i++) {
    const month = i + 1;
    const value = parsed.data.values[i];
    const v = typeof value === "number" && Number.isFinite(value) ? value : 0;

    const scenario =
      mapping.mode === "plan" ? "plan" : month <= cutoffMonth ? "ist" : "fc";

    db.exec(
      "INSERT INTO values_monthly (year, month, entity_id, kpi_id, scenario, value, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(year, month, entity_id, kpi_id, scenario) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
      [year, month, entityRow.id, kpiRow.id, scenario, v, now]
    );
    updated++;
  }

  await db.save();
  return NextResponse.json({ ok: true, updated });
}
