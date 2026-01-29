import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import * as XLSX from "xlsx";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const dbFilePath = path.join(process.cwd(), "data", "app.sqlite");

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

function slugify(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function isMonthLabel(v) {
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return monthSet.has(s);
}

function findMonthHeaderRow(rows) {
  for (let r = 0; r < Math.min(rows.length, 120); r++) {
    const row = rows[r] ?? [];
    let monthCount = 0;
    for (let c = 0; c < Math.min(row.length, 60); c++) {
      if (isMonthLabel(row[c])) monthCount++;
    }
    if (monthCount >= 10) return r;
  }
  return null;
}

function extractYear(rows) {
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

function shouldImportRow(sheetName, kpiName) {
  const k = String(kpiName).trim().toLowerCase();
  if (sheetName === "Umsatz") {
    return k === "plan umsatz" || k === "ist/fc umsatz" || k === "vorjahr kum";
  }
  if (sheetName === "Ertrag") {
    return k === "plan ebit" || k === "ist/fc ebit" || k === "vorjahr kum";
  }
  if (sheetName === "Headcount") {
    return (
      k === "plan headcount" ||
      k === "ist/fc headcount" ||
      k === "davon umlagerelevant" ||
      k === "ohne umlage deutschland" ||
      k === "ohne umlage" ||
      k === "vorjahr" ||
      k === "vorjahr kum"
    );
  }
  return false;
}

function importMapping(sheetName, kpiName) {
  const k = String(kpiName).trim().toLowerCase();

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
    if (k === "plan headcount") return { area: sheetName, kpiCode: "headcount", kpiDisplayName: "Headcount", scenarios: ["plan"] };
    if (k === "ist/fc headcount") return { area: sheetName, kpiCode: "headcount", kpiDisplayName: "Headcount", scenarios: ["ist", "fc"] };
    if (k === "davon umlagerelevant")
      return { area: sheetName, kpiCode: "headcount_umlagerelevant", kpiDisplayName: "davon Umlagerelevant", scenarios: ["ist", "fc"] };
    if (k === "ohne umlage deutschland")
      return { area: sheetName, kpiCode: "headcount_ohne_umlage_de", kpiDisplayName: "ohne Umlage Deutschland", scenarios: ["ist", "fc"] };
    if (k === "ohne umlage")
      return { area: sheetName, kpiCode: "headcount_ohne_umlage", kpiDisplayName: "ohne Umlage", scenarios: ["ist", "fc"] };
    if (k === "vorjahr") return { area: sheetName, kpiCode: "headcount", kpiDisplayName: "Headcount", scenarios: ["prior_year"] };
    if (k === "vorjahr kum") return { area: sheetName, kpiCode: "headcount", kpiDisplayName: "Headcount", scenarios: ["prior_year_kum"] };
    return null;
  }

  return null;
}

function ensureDataDir() {
  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function migrate(db) {
  db.pragma("foreign_keys = ON");
  db.exec(
    "CREATE TABLE IF NOT EXISTS entities (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, is_aggregate INTEGER NOT NULL DEFAULT 0);"
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS kpis (id INTEGER PRIMARY KEY AUTOINCREMENT, area TEXT NOT NULL, code TEXT NOT NULL, display_name TEXT NOT NULL, is_derived INTEGER NOT NULL DEFAULT 0, UNIQUE(area, code));"
  );
  db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);");

  const tableInfo = db.prepare("PRAGMA table_info(values_monthly)").all();
  const valuesCols = tableInfo.map((r) => r.name);
  const hasValuesTable = valuesCols.length > 0;
  const hasScenario = valuesCols.includes("scenario");

  if (hasValuesTable && !hasScenario) {
    db.exec("ALTER TABLE values_monthly RENAME TO values_monthly_old;");
    db.exec(
      "CREATE TABLE values_monthly (id INTEGER PRIMARY KEY AUTOINCREMENT, year INTEGER NOT NULL, month INTEGER NOT NULL, entity_id INTEGER NOT NULL, kpi_id INTEGER NOT NULL, scenario TEXT NOT NULL, value REAL NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(entity_id) REFERENCES entities(id) ON DELETE CASCADE, FOREIGN KEY(kpi_id) REFERENCES kpis(id) ON DELETE CASCADE, UNIQUE(year, month, entity_id, kpi_id, scenario));"
    );
    db.exec(
      "INSERT INTO values_monthly (year, month, entity_id, kpi_id, scenario, value, updated_at) SELECT year, month, entity_id, kpi_id, 'value', value, updated_at FROM values_monthly_old;"
    );
    db.exec("DROP TABLE values_monthly_old;");
  }

  if (!hasValuesTable) {
    db.exec(
      "CREATE TABLE IF NOT EXISTS values_monthly (id INTEGER PRIMARY KEY AUTOINCREMENT, year INTEGER NOT NULL, month INTEGER NOT NULL, entity_id INTEGER NOT NULL, kpi_id INTEGER NOT NULL, scenario TEXT NOT NULL, value REAL NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(entity_id) REFERENCES entities(id) ON DELETE CASCADE, FOREIGN KEY(kpi_id) REFERENCES kpis(id) ON DELETE CASCADE, UNIQUE(year, month, entity_id, kpi_id, scenario));"
    );
  }
}

function all(db, sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) {
    return stmt.all(...params);
  }
  return stmt.all();
}

function get(db, sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) {
    return stmt.get(...params) ?? null;
  }
  return stmt.get() ?? null;
}

function run(db, sql, params = []) {
  if (params.length) {
    db.prepare(sql).run(...params);
    return;
  }
  db.exec(sql);
}

function openDb() {
  ensureDataDir();
  const db = new Database(dbFilePath);
  migrate(db);
  return db;
}

function upsertEntity(db, code, displayName, isAggregate) {
  const existing = get(db, "SELECT id FROM entities WHERE code = ?", [code]);
  if (existing) return existing.id;
  run(db, "INSERT INTO entities (code, display_name, sort_order, is_aggregate) VALUES (?, ?, ?, ?)", [
    code,
    displayName,
    0,
    isAggregate ? 1 : 0
  ]);
  const inserted = get(db, "SELECT id FROM entities WHERE code = ?", [code]);
  if (!inserted) throw new Error("failed to insert entity");
  return inserted.id;
}

function upsertKpi(db, area, code, displayName, isDerived) {
  const existing = get(db, "SELECT id FROM kpis WHERE area = ? AND code = ?", [area, code]);
  if (existing) return existing.id;
  run(db, "INSERT INTO kpis (area, code, display_name, is_derived) VALUES (?, ?, ?, ?)", [
    area,
    code,
    displayName,
    isDerived ? 1 : 0
  ]);
  const inserted = get(db, "SELECT id FROM kpis WHERE area = ? AND code = ?", [area, code]);
  if (!inserted) throw new Error("failed to insert kpi");
  return inserted.id;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    process.stderr.write("Usage: npm run import:excel -- /path/to/file.xlsx\n");
    process.exit(1);
  }

  const buf = await fsp.readFile(filePath);
  const wb = XLSX.read(buf, { type: "buffer" });

  const db = openDb();

  const imported = {
    entities: 0,
    kpis: 0,
    values: 0,
    sheets: 0
  };

  const existingEntities = new Set(all(db, "SELECT code FROM entities").map((r) => r.code));
  const existingKpis = new Set(all(db, "SELECT area, code FROM kpis").map((r) => `${r.area}:${r.code}`));

  for (const sheetName of ["Umsatz", "Ertrag", "Headcount"]) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    imported.sheets++;

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    const year = extractYear(rows);
    const headerRowIndex = findMonthHeaderRow(rows);
    if (headerRowIndex === null) continue;

    const headerRow = rows[headerRowIndex] ?? [];
    const monthCols = [];
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

      const entityId = upsertEntity(db, entityCode, entityName, isAggregate);
      if (!existingEntities.has(entityCode)) {
        existingEntities.add(entityCode);
        imported.entities++;
      }

      const kpiId = upsertKpi(db, mapping.area, mapping.kpiCode, mapping.kpiDisplayName, false);
      const kpiKey = `${mapping.area}:${mapping.kpiCode}`;
      if (!existingKpis.has(kpiKey)) {
        existingKpis.add(kpiKey);
        imported.kpis++;
      }

      for (const mc of monthCols) {
        const v = row[mc.col];
        if (typeof v !== "number" || !Number.isFinite(v)) continue;
        for (const scenario of mapping.scenarios) {
          run(
            db,
            "INSERT INTO values_monthly (year, month, entity_id, kpi_id, scenario, value, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(year, month, entity_id, kpi_id, scenario) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            [year, mc.month, entityId, kpiId, scenario, v, new Date().toISOString()]
          );
          imported.values++;
        }
      }
    }
  }

  db.close();
  process.stdout.write(JSON.stringify({ ok: true, imported }, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(String(err?.stack ?? err) + "\n");
  process.exit(1);
});
