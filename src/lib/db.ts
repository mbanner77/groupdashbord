import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dbFilePath = path.join(process.cwd(), "data", "app.sqlite");

export type SqliteDb = {
  exec: (sql: string, params?: Array<string | number | null>) => void;
  all: <T = unknown>(sql: string, params?: Array<string | number | null>) => T[];
  get: <T = unknown>(sql: string, params?: Array<string | number | null>) => T | null;
  save: () => Promise<void>;
};

let dbInstance: SqliteDb | null = null;

function ensureDataDir() {
  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function migrate(db: Database.Database) {
  db.pragma("foreign_keys = ON");
  db.exec(
    "CREATE TABLE IF NOT EXISTS entities (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, is_aggregate INTEGER NOT NULL DEFAULT 0);"
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS kpis (id INTEGER PRIMARY KEY AUTOINCREMENT, area TEXT NOT NULL, code TEXT NOT NULL, display_name TEXT NOT NULL, is_derived INTEGER NOT NULL DEFAULT 0, UNIQUE(area, code));"
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);"
  );

  const tableInfo = db.prepare("PRAGMA table_info(values_monthly)").all() as { name: string }[];
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

export async function getDb(): Promise<SqliteDb> {
  if (dbInstance) return dbInstance;

  ensureDataDir();
  const db = new Database(dbFilePath);
  migrate(db);

  const exec = (sql: string, params?: Array<string | number | null>) => {
    if (params && params.length) {
      db.prepare(sql).run(...params);
    } else {
      db.exec(sql);
    }
  };

  const all = <T = unknown>(sql: string, params?: Array<string | number | null>): T[] => {
    const stmt = db.prepare(sql);
    if (params && params.length) {
      return stmt.all(...params) as T[];
    }
    return stmt.all() as T[];
  };

  const get = <T = unknown>(sql: string, params?: Array<string | number | null>): T | null => {
    const stmt = db.prepare(sql);
    if (params && params.length) {
      return (stmt.get(...params) as T) ?? null;
    }
    return (stmt.get() as T) ?? null;
  };

  const save = async () => {
    // better-sqlite3 writes synchronously, no explicit save needed
  };

  dbInstance = { exec, all, get, save };
  return dbInstance;
}
