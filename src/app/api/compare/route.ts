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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const viewableEntities = await getViewableEntities(user.id, user.role);

    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year")) || 2025;
    const entityCodes = searchParams.get("entities")?.split(",").filter(Boolean) || [];
    const monthFrom = Number(searchParams.get("monthFrom")) || 1;
    const monthTo = Number(searchParams.get("monthTo")) || 12;

    if (entityCodes.length === 0) {
      return NextResponse.json({ entities: [] });
    }

    // Filter by permissions
    const allowedCodes = entityCodes.filter(code => viewableEntities.includes(code));

    // Get KPI IDs
    const umsatzKpi = await getAsync<{ id: number }>("SELECT id FROM kpis WHERE area = 'Umsatz' AND code = 'umsatz'");
    const ebitKpi = await getAsync<{ id: number }>("SELECT id FROM kpis WHERE area = 'Ertrag' AND code = 'ebit'");
    const headcountKpi = await getAsync<{ id: number }>("SELECT id FROM kpis WHERE area = 'Headcount' AND code = 'headcount'");

    if (!umsatzKpi || !ebitKpi || !headcountKpi) {
      return NextResponse.json({ error: "KPIs not found" }, { status: 500 });
    }

    const results = await Promise.all(
      allowedCodes.map(async (entityCode) => {
        const entity = await getAsync<{ id: number; display_name: string }>(
          "SELECT id, display_name FROM entities WHERE code = $1",
          [entityCode]
        );

        if (!entity) {
          return null;
        }

        // Get monthly values for all scenarios
        const getValues = async (kpiId: number, scenario: string): Promise<MonthlyValue[]> => {
          return allAsync<MonthlyValue>(
            "SELECT month, value FROM values_monthly WHERE year = $1 AND entity_id = $2 AND kpi_id = $3 AND scenario = $4 ORDER BY month",
            [year, entity.id, kpiId, scenario]
          );
        };

        // Get IST and FC values
        const [umsatzIst, umsatzFc, umsatzPlan] = await Promise.all([
          getValues(umsatzKpi.id, "ist"),
          getValues(umsatzKpi.id, "fc"),
          getValues(umsatzKpi.id, "plan"),
        ]);

        const [ebitIst, ebitFc, ebitPlan] = await Promise.all([
          getValues(ebitKpi.id, "ist"),
          getValues(ebitKpi.id, "fc"),
          getValues(ebitKpi.id, "plan"),
        ]);

        const [hcIst, hcFc, hcPlan] = await Promise.all([
          getValues(headcountKpi.id, "ist"),
          getValues(headcountKpi.id, "fc"),
          getValues(headcountKpi.id, "plan"),
        ]);

        // Combine IST + FC (IST for months 1-12, FC as fallback if IST is 0)
        const combineIstFc = (ist: MonthlyValue[], fc: MonthlyValue[]): number[] => {
          const result: number[] = [];
          for (let m = 1; m <= 12; m++) {
            const istVal = ist.find((v) => v.month === m)?.value ?? 0;
            const fcVal = fc.find((v) => v.month === m)?.value ?? 0;
            result.push(istVal > 0 ? istVal : fcVal);
          }
          return result;
        };

        // Get plan values as array
        const planToArray = (plan: MonthlyValue[]): number[] => {
          const result: number[] = [];
          for (let m = 1; m <= 12; m++) {
            result.push(plan.find((v) => v.month === m)?.value ?? 0);
          }
          return result;
        };

        const umsatzActual = combineIstFc(umsatzIst, umsatzFc);
        const umsatzPlanArr = planToArray(umsatzPlan);
        const ebitActual = combineIstFc(ebitIst, ebitFc);
        const ebitPlanArr = planToArray(ebitPlan);
        const hcActual = combineIstFc(hcIst, hcFc);
        const hcPlanArr = planToArray(hcPlan);

        // Use actual if available, otherwise use plan
        const umsatzMonthly = umsatzActual.some(v => v > 0) ? umsatzActual : umsatzPlanArr;
        const ebitMonthly = ebitActual.some(v => v > 0) ? ebitActual : ebitPlanArr;
        const hcMonthly = hcActual.some(v => v > 0) ? hcActual : hcPlanArr;

        // Calculate sum for month range
        const sumRange = (arr: number[]): number => {
          let sum = 0;
          for (let i = monthFrom - 1; i < monthTo && i < arr.length; i++) {
            sum += arr[i] || 0;
          }
          return sum;
        };

        // Calculate average for headcount
        const avgRange = (arr: number[]): number => {
          let sum = 0;
          let count = 0;
          for (let i = monthFrom - 1; i < monthTo && i < arr.length; i++) {
            if (arr[i] > 0) {
              sum += arr[i];
              count++;
            }
          }
          return count > 0 ? sum / count : 0;
        };

        const umsatzSum = sumRange(umsatzMonthly);
        const ebitSum = sumRange(ebitMonthly);
        const hcAvg = avgRange(hcMonthly);

        return {
          code: entityCode,
          name: entity.display_name,
          umsatz: umsatzSum,
          ebit: ebitSum,
          headcount: Math.round(hcAvg),
          margin: umsatzSum > 0 ? (ebitSum / umsatzSum) * 100 : 0,
          monthly: {
            umsatz: umsatzMonthly,
            ebit: ebitMonthly,
            headcount: hcMonthly,
          },
        };
      })
    );

    return NextResponse.json({
      entities: results.filter(Boolean),
    });
  } catch (error) {
    console.error("Compare API error:", error);
    return NextResponse.json({ error: "Failed to load comparison data" }, { status: 500 });
  }
}
