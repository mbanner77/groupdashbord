import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";

export const dynamic = "force-dynamic";

interface MonthlyValue {
  month: number;
  value: number;
}

interface KpiData {
  year: number;
  cutoffMonth: number;
  kpis: {
    umsatz: {
      plan: number;
      actual: number;
      variance: number;
      variancePercent: number;
      monthly: Array<{ month: number; plan: number; actual: number }>;
    };
    ebit: {
      plan: number;
      actual: number;
      variance: number;
      variancePercent: number;
      monthly: Array<{ month: number; plan: number; actual: number }>;
    };
    ebitMargin: {
      plan: number;
      actual: number;
      monthly: Array<{ month: number; plan: number; actual: number }>;
    };
    headcount: {
      plan: number;
      actual: number;
      variance: number;
      variancePercent: number;
      monthly: Array<{ month: number; plan: number; actual: number }>;
    };
    revenuePerHead: {
      plan: number;
      actual: number;
      monthly: Array<{ month: number; plan: number; actual: number }>;
    };
    priorYearComparison: {
      umsatz: { current: number; priorYear: number; changePercent: number };
      ebit: { current: number; priorYear: number; changePercent: number };
    };
  };
  entities: Array<{
    code: string;
    name: string;
    umsatz: number;
    ebit: number;
    ebitMargin: number;
    headcount: number;
  }>;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year")) || 2025;
  const cutoffMonth = Number(searchParams.get("cutoffMonth")) || 12;

  const db = await getDb();

  const getEntityId = (code: string): number | null => {
    const row = db.get<{ id: number }>("SELECT id FROM entities WHERE code = ?", [code]);
    return row?.id ?? null;
  };

  const getKpiId = (area: string, code: string): number | null => {
    const row = db.get<{ id: number }>("SELECT id FROM kpis WHERE area = ? AND code = ?", [area, code]);
    return row?.id ?? null;
  };

  const getMonthlyValues = (entityId: number, kpiId: number, scenario: string): MonthlyValue[] => {
    return db.all<MonthlyValue>(
      "SELECT month, value FROM values_monthly WHERE year = ? AND entity_id = ? AND kpi_id = ? AND scenario = ? ORDER BY month",
      [year, entityId, kpiId, scenario]
    );
  };

  const sumValues = (values: MonthlyValue[], upToMonth: number): number => {
    return values.filter((v) => v.month <= upToMonth).reduce((sum, v) => sum + v.value, 0);
  };

  const gruppeId = getEntityId("gruppe");
  const umsatzKpiId = getKpiId("Umsatz", "umsatz");
  const ebitKpiId = getKpiId("Ertrag", "ebit");
  const headcountKpiId = getKpiId("Headcount", "headcount");

  if (!gruppeId || !umsatzKpiId || !ebitKpiId || !headcountKpiId) {
    return NextResponse.json({ error: "Missing entity or KPI data" }, { status: 500 });
  }

  // Get monthly data for Gruppe
  const umsatzPlan = getMonthlyValues(gruppeId, umsatzKpiId, "plan");
  const umsatzIst = getMonthlyValues(gruppeId, umsatzKpiId, "ist");
  const umsatzFc = getMonthlyValues(gruppeId, umsatzKpiId, "fc");
  const umsatzPriorYear = getMonthlyValues(gruppeId, umsatzKpiId, "prior_year_kum");

  const ebitPlan = getMonthlyValues(gruppeId, ebitKpiId, "plan");
  const ebitIst = getMonthlyValues(gruppeId, ebitKpiId, "ist");
  const ebitFc = getMonthlyValues(gruppeId, ebitKpiId, "fc");
  const ebitPriorYear = getMonthlyValues(gruppeId, ebitKpiId, "prior_year_kum");

  const hcPlan = getMonthlyValues(gruppeId, headcountKpiId, "plan");
  const hcIst = getMonthlyValues(gruppeId, headcountKpiId, "ist");
  const hcFc = getMonthlyValues(gruppeId, headcountKpiId, "fc");

  // Combine IST (up to cutoff) + FC (after cutoff)
  const combineIstFc = (ist: MonthlyValue[], fc: MonthlyValue[]): MonthlyValue[] => {
    const result: MonthlyValue[] = [];
    for (let m = 1; m <= 12; m++) {
      const istVal = ist.find((v) => v.month === m)?.value ?? 0;
      const fcVal = fc.find((v) => v.month === m)?.value ?? 0;
      result.push({ month: m, value: m <= cutoffMonth ? istVal : fcVal });
    }
    return result;
  };

  const umsatzActual = combineIstFc(umsatzIst, umsatzFc);
  const ebitActual = combineIstFc(ebitIst, ebitFc);
  const hcActual = combineIstFc(hcIst, hcFc);

  // Calculate cumulative values
  const umsatzPlanTotal = sumValues(umsatzPlan, 12);
  const umsatzActualTotal = sumValues(umsatzActual, 12);
  const ebitPlanTotal = sumValues(ebitPlan, 12);
  const ebitActualTotal = sumValues(ebitActual, 12);

  // Headcount: use average or last month
  const hcPlanAvg = hcPlan.length > 0 ? hcPlan.reduce((s, v) => s + v.value, 0) / hcPlan.length : 0;
  const hcActualAvg = hcActual.length > 0 ? hcActual.reduce((s, v) => s + v.value, 0) / hcActual.length : 0;

  // Monthly data for charts
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

  // EBIT Margin
  const ebitMarginPlan = umsatzPlanTotal > 0 ? (ebitPlanTotal / umsatzPlanTotal) * 100 : 0;
  const ebitMarginActual = umsatzActualTotal > 0 ? (ebitActualTotal / umsatzActualTotal) * 100 : 0;

  const ebitMarginMonthly = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const up = umsatzPlan.find((v) => v.month === m)?.value ?? 0;
    const ua = umsatzActual.find((v) => v.month === m)?.value ?? 0;
    const ep = ebitPlan.find((v) => v.month === m)?.value ?? 0;
    const ea = ebitActual.find((v) => v.month === m)?.value ?? 0;
    return {
      month: m,
      plan: up > 0 ? (ep / up) * 100 : 0,
      actual: ua > 0 ? (ea / ua) * 100 : 0,
    };
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
    return {
      month: m,
      plan: hp > 0 ? up / hp : 0,
      actual: ha > 0 ? ua / ha : 0,
    };
  });

  // Prior year comparison (using kum values from last available month)
  const priorYearUmsatz = umsatzPriorYear.find((v) => v.month === 12)?.value ?? 0;
  const priorYearEbit = ebitPriorYear.find((v) => v.month === 12)?.value ?? 0;

  // Entity breakdown
  const entities = db.all<{ id: number; code: string; display_name: string; is_aggregate: number }>(
    "SELECT id, code, display_name, is_aggregate FROM entities WHERE is_aggregate = 0 ORDER BY display_name"
  );

  const entityData = entities.map((e) => {
    const uPlan = sumValues(getMonthlyValues(e.id, umsatzKpiId, "plan"), 12);
    const uActual = sumValues(combineIstFc(
      getMonthlyValues(e.id, umsatzKpiId, "ist"),
      getMonthlyValues(e.id, umsatzKpiId, "fc")
    ), 12);
    const ePlan = sumValues(getMonthlyValues(e.id, ebitKpiId, "plan"), 12);
    const eActual = sumValues(combineIstFc(
      getMonthlyValues(e.id, ebitKpiId, "ist"),
      getMonthlyValues(e.id, ebitKpiId, "fc")
    ), 12);
    const hActual = combineIstFc(
      getMonthlyValues(e.id, headcountKpiId, "ist"),
      getMonthlyValues(e.id, headcountKpiId, "fc")
    );
    const hAvg = hActual.length > 0 ? hActual.reduce((s, v) => s + v.value, 0) / hActual.length : 0;

    return {
      code: e.code,
      name: e.display_name,
      umsatz: uActual,
      ebit: eActual,
      ebitMargin: uActual > 0 ? (eActual / uActual) * 100 : 0,
      headcount: Math.round(hAvg),
    };
  });

  const safePercent = (a: number, b: number) => (b !== 0 ? ((a - b) / Math.abs(b)) * 100 : 0);

  const result: KpiData = {
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
      ebitMargin: {
        plan: ebitMarginPlan,
        actual: ebitMarginActual,
        monthly: ebitMarginMonthly,
      },
      headcount: {
        plan: Math.round(hcPlanAvg),
        actual: Math.round(hcActualAvg),
        variance: Math.round(hcActualAvg - hcPlanAvg),
        variancePercent: safePercent(hcActualAvg, hcPlanAvg),
        monthly: buildMonthly(hcPlan, hcActual),
      },
      revenuePerHead: {
        plan: revPerHeadPlan,
        actual: revPerHeadActual,
        monthly: revPerHeadMonthly,
      },
      priorYearComparison: {
        umsatz: {
          current: umsatzActualTotal,
          priorYear: priorYearUmsatz,
          changePercent: safePercent(umsatzActualTotal, priorYearUmsatz),
        },
        ebit: {
          current: ebitActualTotal,
          priorYear: priorYearEbit,
          changePercent: safePercent(ebitActualTotal, priorYearEbit),
        },
      },
    },
    entities: entityData,
  };

  return NextResponse.json(result);
}
