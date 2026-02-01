import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { z } from "zod";
import { getAsync, allAsync, execAsync } from "../../../../lib/db";
import { slugify } from "../../../../lib/slug";
import { getCurrentUser } from "../../../../lib/auth";

export const runtime = "nodejs";

const monthSet = new Set([
  "jan",
  "feb",
  "mrz",
  "mär",
  "maerz",
  "märz",
  "apr",
  "mai",
  "jun",
  "jul",
  "aug",
  "sep",
  "sept",
  "okt",
  "nov",
  "dez"
]);

function isMonthLabel(v: unknown) {
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return monthSet.has(s);
}

function findMonthHeaderRow(rows: unknown[][]) {
  for (let r = 0; r < Math.min(rows.length, 120); r++) {
    const row = rows[r] ?? [];
    let monthCount = 0;
    for (let c = 0; c < Math.min(row.length, 60); c++) {
      if (isMonthLabel(row[c])) monthCount++;
    }
    if (monthCount >= 10) {
      return r;
    }
  }
  return null;
}

function extractYear(rows: unknown[][]): number {
  const re = /\b(20\d{2})\b/;
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    for (let c = 0; c < Math.min((rows[r] ?? []).length, 20); c++) {
      const v = rows[r]?.[c];
      if (typeof v === "string") {
        const m = v.match(re);
        if (m) return Number(m[1]);
      }
      if (typeof v === "number" && v >= 2000 && v <= 2100) return v;
    }
  }
  return 2025;
}

async function upsertEntity(code: string, displayName: string, isAggregate: boolean) {
  const existing = await getAsync<{ id: number }>("SELECT id FROM entities WHERE code = $1", [code]);
  if (existing) return existing.id;
  await execAsync(
    "INSERT INTO entities (code, display_name, sort_order, is_aggregate) VALUES ($1, $2, $3, $4)",
    [code, displayName, 0, isAggregate ? 1 : 0]
  );
  const inserted = await getAsync<{ id: number }>("SELECT id FROM entities WHERE code = $1", [code]);
  if (!inserted) throw new Error("failed to insert entity");
  return inserted.id;
}

async function upsertKpi(area: string, code: string, displayName: string, isDerived: boolean) {
  const existing = await getAsync<{ id: number }>("SELECT id FROM kpis WHERE area = $1 AND code = $2", [area, code]);
  if (existing) return existing.id;
  await execAsync("INSERT INTO kpis (area, code, display_name, is_derived) VALUES ($1, $2, $3, $4)", [
    area,
    code,
    displayName,
    isDerived ? 1 : 0
  ]);
  const inserted = await getAsync<{ id: number }>("SELECT id FROM kpis WHERE area = $1 AND code = $2", [area, code]);
  if (!inserted) throw new Error("failed to insert kpi");
  return inserted.id;
}

function importMapping(sheetName: string, kpiName: string):
  | { area: string; kpiCode: string; kpiDisplayName: string; scenarios: string[] }
  | null {
  const k = kpiName.trim().toLowerCase();

  if (sheetName === "Umsatz") {
    if (k === "plan umsatz") return { area: sheetName, kpiCode: "umsatz", kpiDisplayName: "Umsatz", scenarios: ["plan"] };
    if (k === "ist/fc umsatz") return { area: sheetName, kpiCode: "umsatz", kpiDisplayName: "Umsatz", scenarios: ["ist", "fc"] };
    if (k === "vorjahr kum") return { area: sheetName, kpiCode: "umsatz", kpiDisplayName: "Umsatz", scenarios: ["prior_year_kum"] };
    return null;
  }

  if (sheetName === "Ertrag") {
    if (k === "plan ebit") return { area: sheetName, kpiCode: "ebit", kpiDisplayName: "EBIT", scenarios: ["plan"] };
    if (k === "ist/fc ebit") return { area: sheetName, kpiCode: "ebit", kpiDisplayName: "EBIT", scenarios: ["ist", "fc"] };
    if (k === "vorjahr kum") return { area: sheetName, kpiCode: "ebit", kpiDisplayName: "EBIT", scenarios: ["prior_year_kum"] };
    return null;
  }

  if (sheetName === "Headcount") {
    if (k === "plan headcount")
      return { area: sheetName, kpiCode: "headcount", kpiDisplayName: "Headcount", scenarios: ["plan"] };
    if (k === "ist/fc headcount")
      return { area: sheetName, kpiCode: "headcount", kpiDisplayName: "Headcount", scenarios: ["ist", "fc"] };
    if (k === "davon umlagerelevant")
      return {
        area: sheetName,
        kpiCode: "headcount_umlagerelevant",
        kpiDisplayName: "davon Umlagerelevant",
        scenarios: ["ist", "fc"]
      };
    if (k === "ohne umlage deutschland")
      return {
        area: sheetName,
        kpiCode: "headcount_ohne_umlage_de",
        kpiDisplayName: "ohne Umlage Deutschland",
        scenarios: ["ist", "fc"]
      };
    if (k === "ohne umlage")
      return { area: sheetName, kpiCode: "headcount_ohne_umlage", kpiDisplayName: "ohne Umlage", scenarios: ["ist", "fc"] };
    if (k === "vorjahr") return { area: sheetName, kpiCode: "headcount", kpiDisplayName: "Headcount", scenarios: ["prior_year"] };
    if (k === "vorjahr kum") return { area: sheetName, kpiCode: "headcount", kpiDisplayName: "Headcount", scenarios: ["prior_year_kum"] };
    return null;
  }

  return null;
}

export async function POST(request: Request) {
  // Auth check
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  const fileSchema = z.instanceof(File);
  const parsed = fileSchema.safeParse(file);
  if (!parsed.success) {
    return NextResponse.json({ error: "missing form field 'file'" }, { status: 400 });
  }

  const buffer = Buffer.from(await parsed.data.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });

  const imported = {
    entities: 0,
    kpis: 0,
    values: 0,
    sheets: 0
  };

  const existingEntitiesArr = await allAsync<{ code: string }>("SELECT code FROM entities");
  const existingEntities = new Set(existingEntitiesArr.map((r) => r.code));
  const existingKpisArr = await allAsync<{ area: string; code: string }>("SELECT area, code FROM kpis");
  const existingKpis = new Set(existingKpisArr.map((r) => `${r.area}:${r.code}`));

  for (const sheetName of ["Umsatz", "Ertrag", "Headcount"]) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    imported.sheets++;

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null }) as unknown[][];
    const year = extractYear(rows);

    const headerRowIndex = findMonthHeaderRow(rows);
    if (headerRowIndex === null) continue;

    const monthCols = [] as Array<{ col: number; month: number }>;
    const headerRow = rows[headerRowIndex] ?? [];

    for (let c = 0; c < headerRow.length; c++) {
      if (!isMonthLabel(headerRow[c])) continue;
      monthCols.push({ col: c, month: monthCols.length + 1 });
      if (monthCols.length === 12) break;
    }

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const entityRaw = row[0];
      const kpiRaw = row[1];
      if (typeof entityRaw !== "string" || typeof kpiRaw !== "string") continue;
      const entityName = entityRaw.trim();
      const kpiName = kpiRaw.trim();
      if (!entityName || !kpiName) continue;
      const mapping = importMapping(sheetName, kpiName);
      if (!mapping) continue;

      let hasNumeric = false;
      for (const mc of monthCols) {
        const v = row[mc.col];
        if (typeof v === "number" && Number.isFinite(v)) {
          hasNumeric = true;
          break;
        }
      }
      if (!hasNumeric) continue;

      const entityCode = slugify(entityName);
      const isAggregate = entityName.toLowerCase() === "gruppe";

      const entityId = await upsertEntity(entityCode, entityName, isAggregate);
      if (!existingEntities.has(entityCode)) {
        existingEntities.add(entityCode);
        imported.entities++;
      }

      const kpiId = await upsertKpi(mapping.area, mapping.kpiCode, mapping.kpiDisplayName, false);
      const kpiKey = `${mapping.area}:${mapping.kpiCode}`;
      if (!existingKpis.has(kpiKey)) {
        existingKpis.add(kpiKey);
        imported.kpis++;
      }

      for (const mc of monthCols) {
        const v = row[mc.col];
        if (typeof v !== "number" || !Number.isFinite(v)) continue;
        for (const scenario of mapping.scenarios) {
          await execAsync(
            `INSERT INTO values_monthly (year, month, entity_id, kpi_id, scenario, value, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             ON CONFLICT(year, month, entity_id, kpi_id, scenario) 
             DO UPDATE SET value = $6, updated_at = $7`,
            [year, mc.month, entityId, kpiId, scenario, v, new Date().toISOString()]
          );
          imported.values++;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, imported });
}
