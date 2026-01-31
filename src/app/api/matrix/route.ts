import { NextResponse } from "next/server";
import { z } from "zod";
import { getAsync, execAsync, allAsync } from "../../../lib/db";
import { getForecastCutoffMonth } from "../../../lib/settings";
import { getCurrentUser, canUserEditEntity } from "../../../lib/auth";

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
  try {
    // Auth check
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const raw = await request.json().catch(() => null);
    const parsed = putSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    const { sheet, year, entityCode, label } = parsed.data;

    // Check edit permission
    const canEdit = await canUserEditEntity(user.id, entityCode, user.role);
    if (!canEdit) {
      return NextResponse.json({ error: "Keine Berechtigung zum Bearbeiten dieser Entität" }, { status: 403 });
    }

    const mapping = mapLabelToKpi(sheet, label);
    if (!mapping) {
      return NextResponse.json({ error: "unsupported edit label" }, { status: 400 });
    }

    // Plan data can only be edited by admin
    if (mapping.mode === "plan" && user.role !== "admin") {
      return NextResponse.json({ error: "Nur Administratoren dürfen Plandaten bearbeiten" }, { status: 403 });
    }

    const cutoffMonth = parsed.data.cutoffMonth ?? (await getForecastCutoffMonth());

    const entityRow = await getAsync<{ id: number; is_aggregate: number }>(
      "SELECT id, is_aggregate FROM entities WHERE code = $1",
      [entityCode]
    );
    if (!entityRow) {
      return NextResponse.json({ error: "unknown entity" }, { status: 404 });
    }
    if (entityRow.is_aggregate === 1) {
      return NextResponse.json({ error: "cannot edit aggregate entity" }, { status: 400 });
    }

    const kpiRow = await getAsync<{ id: number }>("SELECT id FROM kpis WHERE area = $1 AND code = $2", [mapping.area, mapping.kpiCode]);
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

      await execAsync(
        "INSERT INTO values_monthly (year, month, entity_id, kpi_id, scenario, value, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT(year, month, entity_id, kpi_id, scenario) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        [year, month, entityRow.id, kpiRow.id, scenario, v, now]
      );
      updated++;
    }

    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    console.error("Matrix PUT error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// POST: Copy prior year values to current year (admin only)
const copyPriorYearSchema = z.object({
  sheet: z.enum(["Umsatz", "Ertrag", "Headcount"]),
  sourceYear: z.number().int().min(2000).max(2100),
  targetYear: z.number().int().min(2000).max(2100),
  entityCode: z.string().min(1).optional(), // If not provided, copy for all entities
});

export async function POST(request: Request) {
  try {
    // Auth check - admin only
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Nur Administratoren dürfen Vorjahreswerte übernehmen" }, { status: 403 });
    }

    const raw = await request.json().catch(() => null);
    const parsed = copyPriorYearSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    const { sheet, sourceYear, targetYear, entityCode } = parsed.data;

    // Map sheet to KPI codes
    const kpiMappings: Array<{ area: string; code: string }> = [];
    if (sheet === "Umsatz") {
      kpiMappings.push({ area: "Umsatz", code: "umsatz" });
    } else if (sheet === "Ertrag") {
      kpiMappings.push({ area: "Ertrag", code: "ebit" });
    } else {
      kpiMappings.push({ area: "Headcount", code: "headcount" });
    }

    const now = new Date().toISOString();
    let copied = 0;

    for (const kpiMapping of kpiMappings) {
      const kpiRow = await getAsync<{ id: number }>(
        "SELECT id FROM kpis WHERE area = $1 AND code = $2",
        [kpiMapping.area, kpiMapping.code]
      );
      if (!kpiRow) continue;

      // Get entities to copy
      let entityCondition = "AND e.is_aggregate = 0";
      const entityQueryParams: (string | number)[] = [];
      
      if (entityCode) {
        entityCondition += " AND e.code = $1";
        entityQueryParams.push(entityCode);
      }

      // Get all non-aggregate entities
      const entities = await allAsync<{ id: number; code: string }>(
        `SELECT id, code FROM entities e WHERE 1=1 ${entityCondition}`,
        entityQueryParams
      );

      for (const entity of entities) {
        // 1. Get cumulative IST from source year (last month = total)
        //    Calculate cumulative as sum of ist values for all months
        const istData = await allAsync<{ month: number; value: number }>(
          `SELECT month, value FROM values_monthly 
           WHERE year = $1 AND entity_id = $2 AND kpi_id = $3 AND scenario = 'ist'
           ORDER BY month`,
          [sourceYear, entity.id, kpiRow.id]
        );
        
        // Calculate cumulative values
        let cumulative = 0;
        const cumulativeValues: number[] = [];
        for (let m = 1; m <= 12; m++) {
          const monthVal = istData.find(d => d.month === m)?.value ?? 0;
          cumulative += monthVal;
          cumulativeValues.push(cumulative);
        }

        // 2. Get Plan values from source year
        const planData = await allAsync<{ month: number; value: number }>(
          `SELECT month, value FROM values_monthly 
           WHERE year = $1 AND entity_id = $2 AND kpi_id = $3 AND scenario = 'plan'`,
          [sourceYear, entity.id, kpiRow.id]
        );

        // 3. Write to target year
        for (let month = 1; month <= 12; month++) {
          // Write prior_year_kum (cumulative IST from source year)
          await execAsync(
            `INSERT INTO values_monthly (year, month, entity_id, kpi_id, scenario, value, updated_at) 
             VALUES ($1, $2, $3, $4, 'prior_year_kum', $5, $6) 
             ON CONFLICT(year, month, entity_id, kpi_id, scenario) 
             DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
            [targetYear, month, entity.id, kpiRow.id, cumulativeValues[month - 1] ?? 0, now]
          );
          copied++;

          // Write plan (copy from source year)
          const planVal = planData.find(d => d.month === month)?.value ?? 0;
          await execAsync(
            `INSERT INTO values_monthly (year, month, entity_id, kpi_id, scenario, value, updated_at) 
             VALUES ($1, $2, $3, $4, 'plan', $5, $6) 
             ON CONFLICT(year, month, entity_id, kpi_id, scenario) 
             DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
            [targetYear, month, entity.id, kpiRow.id, planVal, now]
          );
          copied++;

          // Set IST to 0
          await execAsync(
            `INSERT INTO values_monthly (year, month, entity_id, kpi_id, scenario, value, updated_at) 
             VALUES ($1, $2, $3, $4, 'ist', $5, $6) 
             ON CONFLICT(year, month, entity_id, kpi_id, scenario) 
             DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
            [targetYear, month, entity.id, kpiRow.id, 0, now]
          );
          copied++;

          // Set FC to 0
          await execAsync(
            `INSERT INTO values_monthly (year, month, entity_id, kpi_id, scenario, value, updated_at) 
             VALUES ($1, $2, $3, $4, 'fc', $5, $6) 
             ON CONFLICT(year, month, entity_id, kpi_id, scenario) 
             DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
            [targetYear, month, entity.id, kpiRow.id, 0, now]
          );
          copied++;

          // Set prior_year to monthly IST from source year (not cumulative)
          const priorMonthVal = istData.find(d => d.month === month)?.value ?? 0;
          await execAsync(
            `INSERT INTO values_monthly (year, month, entity_id, kpi_id, scenario, value, updated_at) 
             VALUES ($1, $2, $3, $4, 'prior_year', $5, $6) 
             ON CONFLICT(year, month, entity_id, kpi_id, scenario) 
             DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
            [targetYear, month, entity.id, kpiRow.id, priorMonthVal, now]
          );
          copied++;
        }
      }
    }

    return NextResponse.json({ ok: true, copied, sourceYear, targetYear });
  } catch (error) {
    console.error("Matrix POST (copy prior year) error:", error);
    return NextResponse.json({ error: "Failed to copy prior year data" }, { status: 500 });
  }
}
