import fsp from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const XLSX = require("xlsx");

const dbFilePath = path.join(process.cwd(), "data", "app.sqlite");
const excelPath = "/Users/mbanner/Downloads/RC-Gruppe-Plan-IST-FC-2025-Version-Dezember.xlsx";

const monthSet = new Set([
  "jan", "feb", "mrz", "mär", "maerz", "märz", "apr", "mai", "jun", "jul", "aug", "sep", "sept", "okt", "nov", "dez"
]);

function slugify(input) {
  return String(input).trim().toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

function isMonthLabel(v) {
  if (typeof v !== "string") return false;
  return monthSet.has(v.trim().toLowerCase());
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

function importMapping(sheetName, kpiName) {
  const k = String(kpiName).trim().toLowerCase();
  if (sheetName === "Umsatz") {
    if (k === "plan umsatz") return { area: sheetName, kpiCode: "umsatz", scenarios: ["plan"] };
    if (k === "ist/fc umsatz") return { area: sheetName, kpiCode: "umsatz", scenarios: ["ist", "fc"] };
    if (k === "vorjahr kum") return { area: sheetName, kpiCode: "umsatz", scenarios: ["prior_year_kum"] };
    return null;
  }
  if (sheetName === "Ertrag") {
    if (k === "plan ebit") return { area: sheetName, kpiCode: "ebit", scenarios: ["plan"] };
    if (k === "ist/fc ebit") return { area: sheetName, kpiCode: "ebit", scenarios: ["ist", "fc"] };
    if (k === "vorjahr kum") return { area: sheetName, kpiCode: "ebit", scenarios: ["prior_year_kum"] };
    return null;
  }
  if (sheetName === "Headcount") {
    if (k === "plan headcount") return { area: sheetName, kpiCode: "headcount", scenarios: ["plan"] };
    if (k === "ist/fc headcount") return { area: sheetName, kpiCode: "headcount", scenarios: ["ist", "fc"] };
    if (k === "davon umlagerelevant") return { area: sheetName, kpiCode: "headcount_umlagerelevant", scenarios: ["ist", "fc"] };
    if (k === "ohne umlage deutschland") return { area: sheetName, kpiCode: "headcount_ohne_umlage_de", scenarios: ["ist", "fc"] };
    if (k === "ohne umlage") return { area: sheetName, kpiCode: "headcount_ohne_umlage", scenarios: ["ist", "fc"] };
    if (k === "vorjahr") return { area: sheetName, kpiCode: "headcount", scenarios: ["prior_year"] };
    if (k === "vorjahr kum") return { area: sheetName, kpiCode: "headcount", scenarios: ["prior_year_kum"] };
    return null;
  }
  return null;
}

async function main() {
  console.log("=== DATENVERGLEICH: Excel vs. Datenbank ===\n");

  // Read Excel
  const buf = await fsp.readFile(excelPath);
  const wb = XLSX.read(buf, { type: "buffer" });
  console.log("Excel-Datei geladen:", excelPath);
  console.log("Sheets:", wb.SheetNames.join(", "), "\n");

  // Open DB
  const db = new Database(dbFilePath);
  
  // Get entity and KPI mappings from DB
  const dbEntities = db.prepare("SELECT id, code, display_name FROM entities").all();
  const dbKpis = db.prepare("SELECT id, area, code FROM kpis").all();
  
  const entityMap = new Map(dbEntities.map(e => [e.code, e]));
  const kpiMap = new Map(dbKpis.map(k => [`${k.area}:${k.code}`, k]));

  console.log("Datenbank-Entities:", dbEntities.length);
  console.log("Datenbank-KPIs:", dbKpis.length, "\n");

  // Collect Excel data
  const excelData = [];
  
  for (const sheetName of ["Umsatz", "Ertrag", "Headcount"]) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
      console.log(`Sheet "${sheetName}" nicht gefunden!`);
      continue;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    const year = extractYear(rows);
    const headerRowIndex = findMonthHeaderRow(rows);
    
    if (headerRowIndex === null) {
      console.log(`Keine Monatszeile in Sheet "${sheetName}" gefunden`);
      continue;
    }

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

      const entityCode = slugify(entityName);

      for (const mc of monthCols) {
        const v = row[mc.col];
        if (typeof v !== "number" || !Number.isFinite(v)) continue;
        
        for (const scenario of mapping.scenarios) {
          excelData.push({
            entityCode,
            entityName,
            area: mapping.area,
            kpiCode: mapping.kpiCode,
            scenario,
            year,
            month: mc.month,
            excelValue: v
          });
        }
      }
    }
  }

  console.log(`Excel-Datenpunkte extrahiert: ${excelData.length}\n`);

  // Compare with DB
  const differences = [];
  const missing = [];
  let matched = 0;

  for (const ex of excelData) {
    const entity = entityMap.get(ex.entityCode);
    if (!entity) {
      missing.push({ type: "entity", code: ex.entityCode, name: ex.entityName });
      continue;
    }

    const kpi = kpiMap.get(`${ex.area}:${ex.kpiCode}`);
    if (!kpi) {
      missing.push({ type: "kpi", area: ex.area, code: ex.kpiCode });
      continue;
    }

    const dbValue = db.prepare(
      "SELECT value FROM values_monthly WHERE year = ? AND month = ? AND entity_id = ? AND kpi_id = ? AND scenario = ?"
    ).get(ex.year, ex.month, entity.id, kpi.id, ex.scenario);

    if (!dbValue) {
      missing.push({
        type: "value",
        entity: ex.entityName,
        kpi: ex.kpiCode,
        scenario: ex.scenario,
        year: ex.year,
        month: ex.month,
        excelValue: ex.excelValue
      });
      continue;
    }

    // Compare values with tolerance for floating point
    const diff = Math.abs(dbValue.value - ex.excelValue);
    if (diff > 0.01) {
      differences.push({
        entity: ex.entityName,
        entityCode: ex.entityCode,
        area: ex.area,
        kpi: ex.kpiCode,
        scenario: ex.scenario,
        year: ex.year,
        month: ex.month,
        excelValue: ex.excelValue,
        dbValue: dbValue.value,
        diff: diff
      });
    } else {
      matched++;
    }
  }

  db.close();

  // Report
  console.log("=== ERGEBNIS ===\n");
  console.log(`✓ Übereinstimmende Werte: ${matched}`);
  console.log(`✗ Abweichungen: ${differences.length}`);
  console.log(`? Fehlende Daten: ${missing.length}\n`);

  if (differences.length > 0) {
    console.log("--- ABWEICHUNGEN (max. 50 angezeigt) ---");
    const showDiffs = differences.slice(0, 50);
    for (const d of showDiffs) {
      console.log(`  ${d.entity} | ${d.kpi} | ${d.scenario} | ${d.year}/${d.month}: Excel=${d.excelValue.toFixed(2)} vs DB=${d.dbValue.toFixed(2)} (Diff: ${d.diff.toFixed(2)})`);
    }
    if (differences.length > 50) {
      console.log(`  ... und ${differences.length - 50} weitere Abweichungen`);
    }
    console.log();
  }

  if (missing.length > 0) {
    console.log("--- FEHLENDE DATEN (max. 30 angezeigt) ---");
    const uniqueMissing = [];
    const seen = new Set();
    for (const m of missing) {
      const key = JSON.stringify(m);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueMissing.push(m);
      }
    }
    
    const showMissing = uniqueMissing.slice(0, 30);
    for (const m of showMissing) {
      if (m.type === "entity") {
        console.log(`  Entity fehlt: "${m.name}" (code: ${m.code})`);
      } else if (m.type === "kpi") {
        console.log(`  KPI fehlt: ${m.area}:${m.code}`);
      } else {
        console.log(`  Wert fehlt: ${m.entity} | ${m.kpi} | ${m.scenario} | ${m.year}/${m.month} = ${m.excelValue}`);
      }
    }
    if (uniqueMissing.length > 30) {
      console.log(`  ... und ${uniqueMissing.length - 30} weitere fehlende Einträge`);
    }
    console.log();
  }

  // Summary by entity
  console.log("--- ZUSAMMENFASSUNG PRO ENTITY ---");
  const entityStats = new Map();
  for (const ex of excelData) {
    if (!entityStats.has(ex.entityCode)) {
      entityStats.set(ex.entityCode, { name: ex.entityName, total: 0, matched: 0, diff: 0, missing: 0 });
    }
    entityStats.get(ex.entityCode).total++;
  }
  
  for (const d of differences) {
    if (entityStats.has(d.entityCode)) {
      entityStats.get(d.entityCode).diff++;
    }
  }
  
  for (const m of missing) {
    if (m.type === "value" && m.entity) {
      const code = slugify(m.entity);
      if (entityStats.has(code)) {
        entityStats.get(code).missing++;
      }
    }
  }

  // Calculate matched
  for (const [code, stats] of entityStats) {
    stats.matched = stats.total - stats.diff - stats.missing;
  }

  const sortedStats = [...entityStats.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [code, stats] of sortedStats) {
    const status = stats.diff === 0 && stats.missing === 0 ? "✓" : "✗";
    console.log(`  ${status} ${stats.name}: ${stats.matched}/${stats.total} OK, ${stats.diff} Abweichungen, ${stats.missing} fehlend`);
  }

  console.log("\n=== PRÜFUNG ABGESCHLOSSEN ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
