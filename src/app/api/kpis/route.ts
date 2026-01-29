import { NextResponse } from "next/server";
import { allAsync, getAsync } from "../../../lib/db";
import { getCurrentUser, getViewableEntities } from "../../../lib/auth";

export const dynamic = "force-dynamic";

interface MonthlyValue {
  month: number;
  value: number;
}

export async function GET(request: Request) {
  try {
    // Auth check
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const viewableEntities = await getViewableEntities(user.id, user.role);

    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year")) || 2025;
    const cutoffMonth = Number(searchParams.get("cutoffMonth")) || 12;

    // Helper functions
    const getEntityId = async (code: string): Promise<number | null> => {
      const row = await getAsync<{ id: number }>("SELECT id FROM entities WHERE code = $1", [code]);
      return row?.id ?? null;
    };

    const getKpiId = async (area: string, code: string): Promise<number | null> => {
      const row = await getAsync<{ id: number }>("SELECT id FROM kpis WHERE area = $1 AND code = $2", [area, code]);
      return row?.id ?? null;
    };

    const getMonthlyValues = async (entityId: number, kpiId: number, scenario: string): Promise<MonthlyValue[]> => {
      return allAsync<MonthlyValue>(
        "SELECT month, value FROM values_monthly WHERE year = $1 AND entity_id = $2 AND kpi_id = $3 AND scenario = $4 ORDER BY month",
        [year, entityId, kpiId, scenario]
      );
    };

    const sumValues = (values: MonthlyValue[], upToMonth: number): number => {
      return values.filter((v) => v.month <= upToMonth).reduce((sum, v) => sum + v.value, 0);
    };

    const combineIstFc = (ist: MonthlyValue[], fc: MonthlyValue[]): MonthlyValue[] => {
      const result: MonthlyValue[] = [];
      for (let m = 1; m <= 12; m++) {
        const istVal = ist.find((v) => v.month === m)?.value ?? 0;
        const fcVal = fc.find((v) => v.month === m)?.value ?? 0;
        result.push({ month: m, value: m <= cutoffMonth ? istVal : fcVal });
      }
      return result;
    };

    const buildMonthly = (plan: MonthlyValue[], actual: MonthlyValue[]) => {
      return Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        return {
          month: m,
          plan: plan.find((v) => v.month === m)?.value ?? 0,
          actual: actual.find((v) => v.month === m)?.value ?? 0,
        };
      });
    };

    const safePercent = (a: number, b: number) => (b !== 0 ? ((a - b) / Math.abs(b)) * 100 : 0);

    // Get IDs
    const gruppeId = await getEntityId("group");
    const umsatzKpiId = await getKpiId("Umsatz", "umsatz");
    const ebitKpiId = await getKpiId("Ertrag", "ebit");
    const headcountKpiId = await getKpiId("Headcount", "headcount");

    if (!gruppeId || !umsatzKpiId || !ebitKpiId || !headcountKpiId) {
      return NextResponse.json({ error: "Missing entity or KPI data" }, { status: 500 });
    }

    // Get monthly data for Gruppe
    const [umsatzPlan, umsatzIst, umsatzFc, umsatzPriorYear] = await Promise.all([
      getMonthlyValues(gruppeId, umsatzKpiId, "plan"),
      getMonthlyValues(gruppeId, umsatzKpiId, "ist"),
      getMonthlyValues(gruppeId, umsatzKpiId, "fc"),
      getMonthlyValues(gruppeId, umsatzKpiId, "prior_year_kum"),
    ]);

    const [ebitPlan, ebitIst, ebitFc, ebitPriorYear] = await Promise.all([
      getMonthlyValues(gruppeId, ebitKpiId, "plan"),
      getMonthlyValues(gruppeId, ebitKpiId, "ist"),
      getMonthlyValues(gruppeId, ebitKpiId, "fc"),
      getMonthlyValues(gruppeId, ebitKpiId, "prior_year_kum"),
    ]);

    const [hcPlan, hcIst, hcFc] = await Promise.all([
      getMonthlyValues(gruppeId, headcountKpiId, "plan"),
      getMonthlyValues(gruppeId, headcountKpiId, "ist"),
      getMonthlyValues(gruppeId, headcountKpiId, "fc"),
    ]);

    // Combine IST + FC
    const umsatzActual = combineIstFc(umsatzIst, umsatzFc);
    const ebitActual = combineIstFc(ebitIst, ebitFc);
    const hcActual = combineIstFc(hcIst, hcFc);

    // Calculate totals
    const umsatzPlanTotal = sumValues(umsatzPlan, 12);
    const umsatzActualTotal = sumValues(umsatzActual, 12);
    const ebitPlanTotal = sumValues(ebitPlan, 12);
    const ebitActualTotal = sumValues(ebitActual, 12);

    const hcPlanAvg = hcPlan.length > 0 ? hcPlan.reduce((s, v) => s + v.value, 0) / hcPlan.length : 0;
    const hcActualAvg = hcActual.length > 0 ? hcActual.reduce((s, v) => s + v.value, 0) / hcActual.length : 0;

    // EBIT Margin
    const ebitMarginPlan = umsatzPlanTotal > 0 ? (ebitPlanTotal / umsatzPlanTotal) * 100 : 0;
    const ebitMarginActual = umsatzActualTotal > 0 ? (ebitActualTotal / umsatzActualTotal) * 100 : 0;

    const ebitMarginMonthly = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const up = umsatzPlan.find((v) => v.month === m)?.value ?? 0;
      const ua = umsatzActual.find((v) => v.month === m)?.value ?? 0;
      const ep = ebitPlan.find((v) => v.month === m)?.value ?? 0;
      const ea = ebitActual.find((v) => v.month === m)?.value ?? 0;
      return { month: m, plan: up > 0 ? (ep / up) * 100 : 0, actual: ua > 0 ? (ea / ua) * 100 : 0 };
    });

    // Revenue per Head
    const revPerHeadPlan = hcPlanAvg > 0 ? umsatzPlanTotal / hcPlanAvg : 0;
    const revPerHeadActual = hcActualAvg > 0 ? umsatzActualTotal / hcActualAvg : 0;

    const revPerHeadMonthly = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const up = umsatzPlan.find((v) => v.month === m)?.value ?? 0;
      const ua = umsatzActual.find((v) => v.month === m)?.value ?? 0;
      const hp = hcPlan.find((v) => v.month === m)?.value ?? 1;
      const ha = hcActual.find((v) => v.month === m)?.value ?? 1;
      return { month: m, plan: hp > 0 ? up / hp : 0, actual: ha > 0 ? ua / ha : 0 };
    });

    // Prior year
    const priorYearUmsatz = umsatzPriorYear.find((v) => v.month === 12)?.value ?? 0;
    const priorYearEbit = ebitPriorYear.find((v) => v.month === 12)?.value ?? 0;

    // Entity breakdown - filtered by permissions
    const entitiesRaw = await allAsync<{ id: number; code: string; display_name: string }>(
      "SELECT id, code, display_name FROM entities WHERE is_aggregate = 0 ORDER BY display_name"
    );

    // Filter entities based on user permissions
    const allowedEntities = entitiesRaw.filter(e => viewableEntities.includes(e.code));

    const entityData = await Promise.all(
      allowedEntities.map(async (e) => {
        const [uPlan, uIst, uFc, ePlan, eIst, eFc, hIst, hFc] = await Promise.all([
          getMonthlyValues(e.id, umsatzKpiId, "plan"),
          getMonthlyValues(e.id, umsatzKpiId, "ist"),
          getMonthlyValues(e.id, umsatzKpiId, "fc"),
          getMonthlyValues(e.id, ebitKpiId, "plan"),
          getMonthlyValues(e.id, ebitKpiId, "ist"),
          getMonthlyValues(e.id, ebitKpiId, "fc"),
          getMonthlyValues(e.id, headcountKpiId, "ist"),
          getMonthlyValues(e.id, headcountKpiId, "fc"),
        ]);

        const uActual = sumValues(combineIstFc(uIst, uFc), 12);
        const eActual = sumValues(combineIstFc(eIst, eFc), 12);
        const hActual = combineIstFc(hIst, hFc);
        const hAvg = hActual.length > 0 ? hActual.reduce((s, v) => s + v.value, 0) / hActual.length : 0;

        return {
          code: e.code,
          name: e.display_name,
          umsatz: uActual,
          ebit: eActual,
          ebitMargin: uActual > 0 ? (eActual / uActual) * 100 : 0,
          headcount: Math.round(hAvg),
        };
      })
    );

    const result = {
      year,
      cutoffMonth,
      kpis: {
        umsatz: {
          plan: umsatzPlanTotal,
          actual: umsatzActualTotal,
          variance: umsatzActualTotal - umsatzPlanTotal,
          variancePercent: safePercent(umsatzActualTotal, umsatzPlanTotal),
          monthly: buildMonthly(umsatzPlan, umsatzActual),
        },
        ebit: {
          plan: ebitPlanTotal,
          actual: ebitActualTotal,
          variance: ebitActualTotal - ebitPlanTotal,
          variancePercent: safePercent(ebitActualTotal, ebitPlanTotal),
          monthly: buildMonthly(ebitPlan, ebitActual),
        },
        ebitMargin: { plan: ebitMarginPlan, actual: ebitMarginActual, monthly: ebitMarginMonthly },
        headcount: {
          plan: Math.round(hcPlanAvg),
          actual: Math.round(hcActualAvg),
          variance: Math.round(hcActualAvg - hcPlanAvg),
          variancePercent: safePercent(hcActualAvg, hcPlanAvg),
          monthly: buildMonthly(hcPlan, hcActual),
        },
        revenuePerHead: { plan: revPerHeadPlan, actual: revPerHeadActual, monthly: revPerHeadMonthly },
        priorYearComparison: {
          umsatz: { current: umsatzActualTotal, priorYear: priorYearUmsatz, changePercent: safePercent(umsatzActualTotal, priorYearUmsatz) },
          ebit: { current: ebitActualTotal, priorYear: priorYearEbit, changePercent: safePercent(ebitActualTotal, priorYearEbit) },
        },
      },
      entities: entityData,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("KPIs API error:", error);
    return NextResponse.json({ error: "Failed to load KPIs" }, { status: 500 });
  }
}
