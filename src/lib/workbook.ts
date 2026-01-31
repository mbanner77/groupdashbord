import { allAsync, getAsync } from "./db";
import type { Area } from "./dashboard";

export type WorkbookSheetParam = "Umsatz" | "Ertrag" | "Headcount";

export type WorkbookLine = {
  entityCode: string;
  entityName: string;
  label: string;
  values: number[];
};

export type WorkbookEntity = {
  code: string;
  name: string;
  isAggregate: boolean;
};

export type WorkbookCharts = {
  bar: Array<{ month: number; label: string; plan: number; actualForecast: number }>;
  line: Array<Record<string, number | string>>;
};

export type WorkbookSheet = {
  sheet: WorkbookSheetParam;
  year: number;
  cutoffMonth: number;
  months: Array<{ month: number; label: string }>;
  entities: WorkbookEntity[];
  lines: WorkbookLine[];
  charts: WorkbookCharts;
};

const MONTHS: Array<{ month: number; label: string }> = [
  { month: 1, label: "Jan" },
  { month: 2, label: "Feb" },
  { month: 3, label: "Mrz" },
  { month: 4, label: "Apr" },
  { month: 5, label: "Mai" },
  { month: 6, label: "Jun" },
  { month: 7, label: "Jul" },
  { month: 8, label: "Aug" },
  { month: 9, label: "Sep" },
  { month: 10, label: "Okt" },
  { month: 11, label: "Nov" },
  { month: 12, label: "Dez" }
];

function monthRange(): number[] {
  return MONTHS.map((m) => m.month);
}

function normalizeSeries(rows: Array<{ month: number; value: number }>): number[] {
  const map = new Map<number, number>();
  for (const r of rows) map.set(r.month, r.value);
  return monthRange().map((m) => {
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

function applyCutoff(ist: number[], fc: number[], cutoffMonth: number): number[] {
  return monthRange().map((m, idx) => {
    const useIst = m <= cutoffMonth;
    const v = useIst ? ist[idx] : fc[idx];
    return Number.isFinite(v) ? v : 0;
  });
}

type Entity = { code: string; name: string; isAggregate: boolean };

type ScenarioEntityMonthMap = Map<string, Map<string, Map<number, number>>>;

async function getEntities(): Promise<Entity[]> {
  const rows = await allAsync<{ code: string; display_name: string; is_aggregate: number; sort_order: number }>(
    "SELECT code, display_name, is_aggregate, sort_order FROM entities ORDER BY is_aggregate DESC, sort_order ASC, display_name ASC"
  );
  return rows.map((r) => ({ code: r.code, name: r.display_name, isAggregate: r.is_aggregate === 1 }));
}

async function getKpiId(area: Area, code: string): Promise<number | null> {
  const row = await getAsync<{ id: number }>("SELECT id FROM kpis WHERE area = $1 AND code = $2", [area, code]);
  return row?.id ?? null;
}

async function loadScenarioEntityMonthMap(params: {
  year: number;
  area: Area;
  kpiCode: string;
  scenarios: string[];
}): Promise<ScenarioEntityMonthMap> {
  const kpiId = await getKpiId(params.area, params.kpiCode);
  const out: ScenarioEntityMonthMap = new Map();
  for (const s of params.scenarios) out.set(s, new Map());
  if (!kpiId) return out;

  for (const scenario of params.scenarios) {
    const rows = await allAsync<{ entity_code: string; month: number; value: number }>(
      "SELECT e.code as entity_code, vm.month as month, vm.value as value FROM values_monthly vm JOIN entities e ON vm.entity_id = e.id WHERE vm.year = $1 AND vm.kpi_id = $2 AND vm.scenario = $3",
      [params.year, kpiId, scenario]
    );

    const entityMap = new Map<string, Map<number, number>>();
    for (const r of rows) {
      const m = entityMap.get(r.entity_code) ?? new Map<number, number>();
      m.set(r.month, r.value);
      entityMap.set(r.entity_code, m);
    }

    out.set(scenario, entityMap);
  }

  return out;
}

function seriesFromMap(params: {
  map: ScenarioEntityMonthMap;
  scenario: string;
  entity: Entity;
  entities: Entity[];
}): number[] {
  const scenarioMap = params.map.get(params.scenario) ?? new Map<string, Map<number, number>>();

  if (!params.entity.isAggregate) {
    const monthMap = scenarioMap.get(params.entity.code);
    if (!monthMap) return monthRange().map(() => 0);
    const rows: Array<{ month: number; value: number }> = [];
    for (const [month, value] of monthMap.entries()) rows.push({ month, value });
    return normalizeSeries(rows);
  }

  const parts = params.entities.filter((e) => !e.isAggregate);
  const sumByMonth = new Map<number, number>();
  for (const ent of parts) {
    const monthMap = scenarioMap.get(ent.code);
    if (!monthMap) continue;
    for (const [month, value] of monthMap.entries()) {
      sumByMonth.set(month, (sumByMonth.get(month) ?? 0) + value);
    }
  }

  const rows: Array<{ month: number; value: number }> = [];
  for (const [month, value] of sumByMonth.entries()) rows.push({ month, value });
  return normalizeSeries(rows);
}

export async function getWorkbookSheet(params: {
  sheet: WorkbookSheetParam;
  year: number;
  cutoffMonth: number;
}): Promise<WorkbookSheet> {
  const entities = await getEntities();
  const entityList: WorkbookEntity[] = entities.map((e) => ({ code: e.code, name: e.name, isAggregate: e.isAggregate }));

  if (params.sheet === "Umsatz") {
    const map = await loadScenarioEntityMonthMap({
      year: params.year,
      area: "Umsatz",
      kpiCode: "umsatz",
      scenarios: ["plan", "ist", "fc", "prior_year_kum"]
    });

    const lines: WorkbookLine[] = [];
    for (const entity of entities) {
      const plan = seriesFromMap({ map, scenario: "plan", entity, entities });
      const ist = seriesFromMap({ map, scenario: "ist", entity, entities });
      const fc = seriesFromMap({ map, scenario: "fc", entity, entities });
      const priorYearCum = seriesFromMap({ map, scenario: "prior_year_kum", entity, entities });
      const actualForecast = applyCutoff(ist, fc, params.cutoffMonth);

      const cumPlan = cumulative(plan);
      const cumActualForecast = cumulative(actualForecast);

      lines.push({ entityCode: entity.code, entityName: entity.name, label: "Plan Umsatz", values: plan });
      lines.push({ entityCode: entity.code, entityName: entity.name, label: "IST/FC Umsatz", values: actualForecast });
      lines.push({ entityCode: entity.code, entityName: entity.name, label: "kum Plan", values: cumPlan });
      lines.push({ entityCode: entity.code, entityName: entity.name, label: "kum IST / FC", values: cumActualForecast });
      lines.push({ entityCode: entity.code, entityName: entity.name, label: "Vorjahr kum", values: priorYearCum });
    }

    const gruppe = entities.find((e) => e.code === "gruppe") ?? entities[0];
    const plan = seriesFromMap({ map, scenario: "plan", entity: gruppe, entities });
    const ist = seriesFromMap({ map, scenario: "ist", entity: gruppe, entities });
    const fc = seriesFromMap({ map, scenario: "fc", entity: gruppe, entities });
    const priorYearCum = seriesFromMap({ map, scenario: "prior_year_kum", entity: gruppe, entities });
    const actualForecast = applyCutoff(ist, fc, params.cutoffMonth);

    const bar = MONTHS.map((m, idx) => ({
      month: m.month,
      label: m.label,
      plan: plan[idx] ?? 0,
      actualForecast: actualForecast[idx] ?? 0
    }));

    const cumPlan = cumulative(plan);
    const cumActualForecast = cumulative(actualForecast);

    const line = MONTHS.map((m, idx) => ({
      month: m.label,
      cumPlan: cumPlan[idx] ?? 0,
      cumActualForecast: cumActualForecast[idx] ?? 0,
      priorYearCum: priorYearCum[idx] ?? 0
    }));

    return {
      sheet: params.sheet,
      year: params.year,
      cutoffMonth: params.cutoffMonth,
      months: MONTHS,
      entities: entityList,
      lines,
      charts: { bar, line }
    };
  }

  if (params.sheet === "Ertrag") {
    const map = await loadScenarioEntityMonthMap({
      year: params.year,
      area: "Ertrag",
      kpiCode: "ebit",
      scenarios: ["plan", "ist", "fc", "prior_year_kum"]
    });

    const lines: WorkbookLine[] = [];
    for (const entity of entities) {
      const plan = seriesFromMap({ map, scenario: "plan", entity, entities });
      const ist = seriesFromMap({ map, scenario: "ist", entity, entities });
      const fc = seriesFromMap({ map, scenario: "fc", entity, entities });
      const priorYearCum = seriesFromMap({ map, scenario: "prior_year_kum", entity, entities });
      const actualForecast = applyCutoff(ist, fc, params.cutoffMonth);

      const cumPlan = cumulative(plan);
      const cumActualForecast = cumulative(actualForecast);

      lines.push({ entityCode: entity.code, entityName: entity.name, label: "Plan EBIT", values: plan });
      lines.push({ entityCode: entity.code, entityName: entity.name, label: "IST/FC EBIT", values: actualForecast });
      lines.push({ entityCode: entity.code, entityName: entity.name, label: "kum Plan", values: cumPlan });
      lines.push({ entityCode: entity.code, entityName: entity.name, label: "kum IST / FC", values: cumActualForecast });
      lines.push({ entityCode: entity.code, entityName: entity.name, label: "Vorjahr kum", values: priorYearCum });
    }

    const gruppe = entities.find((e) => e.code === "gruppe") ?? entities[0];
    const plan = seriesFromMap({ map, scenario: "plan", entity: gruppe, entities });
    const ist = seriesFromMap({ map, scenario: "ist", entity: gruppe, entities });
    const fc = seriesFromMap({ map, scenario: "fc", entity: gruppe, entities });
    const priorYearCum = seriesFromMap({ map, scenario: "prior_year_kum", entity: gruppe, entities });
    const actualForecast = applyCutoff(ist, fc, params.cutoffMonth);

    const bar = MONTHS.map((m, idx) => ({
      month: m.month,
      label: m.label,
      plan: plan[idx] ?? 0,
      actualForecast: actualForecast[idx] ?? 0
    }));

    const cumPlan = cumulative(plan);
    const cumActualForecast = cumulative(actualForecast);

    const line = MONTHS.map((m, idx) => ({
      month: m.label,
      cumPlan: cumPlan[idx] ?? 0,
      cumActualForecast: cumActualForecast[idx] ?? 0,
      priorYearCum: priorYearCum[idx] ?? 0
    }));

    return {
      sheet: params.sheet,
      year: params.year,
      cutoffMonth: params.cutoffMonth,
      months: MONTHS,
      entities: entityList,
      lines,
      charts: { bar, line }
    };
  }

  const headcountMap = await loadScenarioEntityMonthMap({
    year: params.year,
    area: "Headcount",
    kpiCode: "headcount",
    scenarios: ["plan", "ist", "fc", "prior_year", "prior_year_kum"]
  });

  const umlageMap = await loadScenarioEntityMonthMap({
    year: params.year,
    area: "Headcount",
    kpiCode: "headcount_umlagerelevant",
    scenarios: ["ist", "fc"]
  });

  const ohneDeMap = await loadScenarioEntityMonthMap({
    year: params.year,
    area: "Headcount",
    kpiCode: "headcount_ohne_umlage_de",
    scenarios: ["ist", "fc"]
  });

  const ohneMap = await loadScenarioEntityMonthMap({
    year: params.year,
    area: "Headcount",
    kpiCode: "headcount_ohne_umlage",
    scenarios: ["ist", "fc"]
  });

  const lines: WorkbookLine[] = [];
  for (const entity of entities) {
    const plan = seriesFromMap({ map: headcountMap, scenario: "plan", entity, entities });
    const ist = seriesFromMap({ map: headcountMap, scenario: "ist", entity, entities });
    const fc = seriesFromMap({ map: headcountMap, scenario: "fc", entity, entities });
    const actualForecast = applyCutoff(ist, fc, params.cutoffMonth);

    const cumPlan = cumulative(plan);
    const cumActualForecast = cumulative(actualForecast);

    const umlIst = seriesFromMap({ map: umlageMap, scenario: "ist", entity, entities });
    const umlFc = seriesFromMap({ map: umlageMap, scenario: "fc", entity, entities });
    const umlAF = applyCutoff(umlIst, umlFc, params.cutoffMonth);

    const ohneDeIst = seriesFromMap({ map: ohneDeMap, scenario: "ist", entity, entities });
    const ohneDeFc = seriesFromMap({ map: ohneDeMap, scenario: "fc", entity, entities });
    const ohneDeAF = applyCutoff(ohneDeIst, ohneDeFc, params.cutoffMonth);

    const ohneIst = seriesFromMap({ map: ohneMap, scenario: "ist", entity, entities });
    const ohneFc = seriesFromMap({ map: ohneMap, scenario: "fc", entity, entities });
    const ohneAF = applyCutoff(ohneIst, ohneFc, params.cutoffMonth);

    const priorYear = seriesFromMap({ map: headcountMap, scenario: "prior_year", entity, entities });
    const priorYearCum = seriesFromMap({ map: headcountMap, scenario: "prior_year_kum", entity, entities });

    lines.push({ entityCode: entity.code, entityName: entity.name, label: "Plan Headcount", values: plan });
    lines.push({ entityCode: entity.code, entityName: entity.name, label: "IST/FC headcount", values: actualForecast });
    lines.push({ entityCode: entity.code, entityName: entity.name, label: "davon Umlagerelevant", values: umlAF });
    lines.push({ entityCode: entity.code, entityName: entity.name, label: "ohne Umlage Deutschland", values: ohneDeAF });
    lines.push({ entityCode: entity.code, entityName: entity.name, label: "ohne Umlage", values: ohneAF });
    lines.push({ entityCode: entity.code, entityName: entity.name, label: "Vorjahr", values: priorYear });
    lines.push({ entityCode: entity.code, entityName: entity.name, label: "Vorjahr kum", values: priorYearCum });
  }

  const gruppe = entities.find((e) => e.code === "gruppe") ?? entities[0];
  const hcPlan = seriesFromMap({ map: headcountMap, scenario: "plan", entity: gruppe, entities });
  const hcIst = seriesFromMap({ map: headcountMap, scenario: "ist", entity: gruppe, entities });
  const hcFc = seriesFromMap({ map: headcountMap, scenario: "fc", entity: gruppe, entities });
  const hcAF = applyCutoff(hcIst, hcFc, params.cutoffMonth);

  const hcCumPlan = cumulative(hcPlan);
  const hcCumAF = cumulative(hcAF);

  const bar = MONTHS.map((m, idx) => ({
    month: m.month,
    label: m.label,
    plan: hcPlan[idx] ?? 0,
    actualForecast: hcAF[idx] ?? 0
  }));

  const priorYearCum = seriesFromMap({ map: headcountMap, scenario: "prior_year_kum", entity: gruppe, entities });

  const line = MONTHS.map((m, idx) => ({
    month: m.label,
    cumPlan: hcCumPlan[idx] ?? 0,
    cumActualForecast: hcCumAF[idx] ?? 0,
    priorYearCum: priorYearCum[idx] ?? 0
  }));

  return {
    sheet: params.sheet,
    year: params.year,
    cutoffMonth: params.cutoffMonth,
    months: MONTHS,
    entities: entityList,
    lines,
    charts: { bar, line }
  };
}
