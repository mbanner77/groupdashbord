import { allAsync, getAsync } from "./db";

export type Area = "Umsatz" | "Ertrag" | "Headcount";

export type DashboardResult = {
  area: Area;
  entityCode: string;
  year: number;
  cutoffMonth: number;
  months: number[];
  series: {
    plan: number[];
    actualForecast: number[];
    priorYearCum?: number[];
  };
  cumulative: {
    plan: number[];
    actualForecast: number[];
  };
  derived?: {
    margin?: {
      series: {
        plan: number[];
        actualForecast: number[];
      };
      cumulative: {
        plan: number[];
        actualForecast: number[];
      };
    };
  };
};

function rangeMonths(): number[] {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

function normalizeSeries(rows: Array<{ month: number; value: number }>): number[] {
  const map = new Map<number, number>();
  for (const r of rows) map.set(r.month, r.value);
  return rangeMonths().map((m) => {
    const v = map.get(m);
    return Number.isFinite(v as number) ? (v as number) : 0;
  });
}

function cumulative(series: number[]): number[] {
  let sum = 0;
  return series.map((v) => {
    sum += Number.isFinite(v) ? v : 0;
    return sum;
  });
}

function safeDivide(num: number, den: number): number {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return 0;
  return num / den;
}

async function getEntityId(entityCode: string): Promise<number | null> {
  const row = await getAsync<{ id: number }>("SELECT id FROM entities WHERE code = $1", [entityCode]);
  return row?.id ?? null;
}

async function isAggregateEntity(entityCode: string): Promise<boolean> {
  const row = await getAsync<{ is_aggregate: number }>("SELECT is_aggregate FROM entities WHERE code = $1", [entityCode]);
  return (row?.is_aggregate ?? 0) === 1;
}

async function getKpiId(area: Area, kpiCode: string): Promise<number | null> {
  const row = await getAsync<{ id: number }>("SELECT id FROM kpis WHERE area = $1 AND code = $2", [area, kpiCode]);
  return row?.id ?? null;
}

async function loadSeries(params: {
  area: Area;
  kpiCode: string;
  year: number;
  scenario: string;
  entityCode: string;
}): Promise<number[]> {
  const kpiId = await getKpiId(params.area, params.kpiCode);
  if (!kpiId) return rangeMonths().map(() => 0);

  const aggregate = await isAggregateEntity(params.entityCode);

  if (aggregate) {
    const rows = await allAsync<{ month: number; value: number }>(
      "SELECT vm.month as month, SUM(vm.value) as value FROM values_monthly vm JOIN entities e ON vm.entity_id = e.id WHERE vm.year = $1 AND vm.kpi_id = $2 AND vm.scenario = $3 AND e.is_aggregate = 0 GROUP BY vm.month",
      [params.year, kpiId, params.scenario]
    );
    return normalizeSeries(rows);
  }

  const entityId = await getEntityId(params.entityCode);
  if (!entityId) return rangeMonths().map(() => 0);

  const rows = await allAsync<{ month: number; value: number }>(
    "SELECT month, value FROM values_monthly WHERE year = $1 AND entity_id = $2 AND kpi_id = $3 AND scenario = $4",
    [params.year, entityId, kpiId, params.scenario]
  );

  return normalizeSeries(rows);
}

function applyCutoff(ist: number[], fc: number[], cutoffMonth: number): number[] {
  return rangeMonths().map((m, idx) => {
    const useIst = m <= cutoffMonth;
    const v = useIst ? ist[idx] : fc[idx];
    return Number.isFinite(v) ? v : 0;
  });
}

export async function getDashboard(params: {
  area: Area;
  entityCode: string;
  year: number;
  cutoffMonth: number;
}): Promise<DashboardResult> {
  const months = rangeMonths();

  const kpiCode = params.area === "Headcount" ? "headcount" : params.area === "Ertrag" ? "ebit" : "umsatz";

  const plan = await loadSeries({
    area: params.area,
    kpiCode,
    year: params.year,
    scenario: "plan",
    entityCode: params.entityCode
  });

  const ist = await loadSeries({
    area: params.area,
    kpiCode,
    year: params.year,
    scenario: "ist",
    entityCode: params.entityCode
  });

  const fc = await loadSeries({
    area: params.area,
    kpiCode,
    year: params.year,
    scenario: "fc",
    entityCode: params.entityCode
  });

  const actualForecast = applyCutoff(ist, fc, params.cutoffMonth);

  const priorYearCum = await loadSeries({
    area: params.area,
    kpiCode,
    year: params.year,
    scenario: "prior_year_kum",
    entityCode: params.entityCode
  });

  const result: DashboardResult = {
    area: params.area,
    entityCode: params.entityCode,
    year: params.year,
    cutoffMonth: params.cutoffMonth,
    months,
    series: {
      plan,
      actualForecast,
      priorYearCum
    },
    cumulative: {
      plan: cumulative(plan),
      actualForecast: cumulative(actualForecast)
    }
  };

  if (params.area === "Ertrag") {
    const umsatzPlan = await loadSeries({
      area: "Umsatz",
      kpiCode: "umsatz",
      year: params.year,
      scenario: "plan",
      entityCode: params.entityCode
    });

    const umsatzIst = await loadSeries({
      area: "Umsatz",
      kpiCode: "umsatz",
      year: params.year,
      scenario: "ist",
      entityCode: params.entityCode
    });

    const umsatzFc = await loadSeries({
      area: "Umsatz",
      kpiCode: "umsatz",
      year: params.year,
      scenario: "fc",
      entityCode: params.entityCode
    });

    const umsatzActualForecast = applyCutoff(umsatzIst, umsatzFc, params.cutoffMonth);

    const marginPlan = plan.map((ebit, idx) => safeDivide(ebit, umsatzPlan[idx]));
    const marginActualForecast = actualForecast.map((ebit, idx) => safeDivide(ebit, umsatzActualForecast[idx]));

    const cumEbitPlan = cumulative(plan);
    const cumUmsatzPlan = cumulative(umsatzPlan);
    const cumEbitActual = cumulative(actualForecast);
    const cumUmsatzActual = cumulative(umsatzActualForecast);

    result.derived = {
      margin: {
        series: {
          plan: marginPlan,
          actualForecast: marginActualForecast
        },
        cumulative: {
          plan: cumEbitPlan.map((v, idx) => safeDivide(v, cumUmsatzPlan[idx])),
          actualForecast: cumEbitActual.map((v, idx) => safeDivide(v, cumUmsatzActual[idx]))
        }
      }
    };
  }

  return result;
}
