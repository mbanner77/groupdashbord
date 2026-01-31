import { Pool, PoolClient } from "pg";
import Database from "better-sqlite3";
import path from "path";

const connectionString = process.env.DATABASE_URL;
const usePostgres = !!connectionString;

export type DbClient = {
  exec: (sql: string, params?: Array<string | number | null>) => Promise<void>;
  all: <T = unknown>(sql: string, params?: Array<string | number | null>) => T[];
  get: <T = unknown>(sql: string, params?: Array<string | number | null>) => T | null;
  save: () => Promise<void>;
};

let pool: Pool | null = null;
let sqliteDb: Database.Database | null = null;
let migrated = false;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

let sqliteMigrated = false;

function getSqliteDb(): Database.Database {
  if (!sqliteDb) {
    const dbPath = path.join(process.cwd(), "data", "app.sqlite");
    sqliteDb = new Database(dbPath);
    sqliteDb.pragma("journal_mode = WAL");
    migrateSqlite(sqliteDb);
  }
  return sqliteDb;
}

function migrateSqlite(db: Database.Database) {
  if (sqliteMigrated) return;

  // Create users table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_entity_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      can_view INTEGER NOT NULL DEFAULT 1,
      can_edit INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, entity_id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Create default admin user if not exists
  const adminExists = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  if (!adminExists) {
    const crypto = require("crypto");
    const passwordHash = crypto.createHash("sha256").update("RealCore2025!").digest("hex");
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO users (username, password_hash, display_name, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run("admin", passwordHash, "Administrator", "admin", 1, now, now);
    console.log("Created default admin user for SQLite");
  }

  sqliteMigrated = true;
}

async function migrate(client: PoolClient) {
  if (migrated) return;
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS entities (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_aggregate INTEGER NOT NULL DEFAULT 0
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS kpis (
      id SERIAL PRIMARY KEY,
      area TEXT NOT NULL,
      code TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_derived INTEGER NOT NULL DEFAULT 0,
      UNIQUE(area, code)
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS values_monthly (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      kpi_id INTEGER NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
      scenario TEXT NOT NULL,
      value REAL NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(year, month, entity_id, kpi_id, scenario)
    );
  `);

  // User management tables
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS user_entity_permissions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      can_view INTEGER NOT NULL DEFAULT 1,
      can_edit INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, entity_id)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Create default admin user if not exists
  const adminExists = await client.query("SELECT id FROM users WHERE username = 'admin'");
  if (adminExists.rows.length === 0) {
    const crypto = await import("crypto");
    const passwordHash = crypto.createHash("sha256").update("RealCore2025!").digest("hex");
    const now = new Date().toISOString();
    await client.query(
      "INSERT INTO users (username, password_hash, display_name, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      ["admin", passwordHash, "Administrator", "admin", 1, now, now]
    );
  }

  // Seed data if tables are empty
  await seedDataIfEmpty(client);
  
  migrated = true;
}

async function seedDataIfEmpty(client: PoolClient) {
  // Check if entities table is empty
  const entityCount = await client.query("SELECT COUNT(*) as count FROM entities");
  if (parseInt(entityCount.rows[0].count) > 0) {
    return; // Data already exists
  }

  console.log("Seeding database with initial data...");

  // Seed entities - IDs must match seed-data.json!
  const entities = [
    { id: 1, code: "gruppe", display_name: "Gruppe", sort_order: 0, is_aggregate: 1 },
    { id: 2, code: "rcc", display_name: "RCC", sort_order: 0, is_aggregate: 0 },
    { id: 3, code: "rcs", display_name: "RCS", sort_order: 0, is_aggregate: 0 },
    { id: 4, code: "rct", display_name: "RCT", sort_order: 0, is_aggregate: 0 },
    { id: 5, code: "rso", display_name: "RSO", sort_order: 0, is_aggregate: 0 },
    { id: 6, code: "rbc", display_name: "RBC", sort_order: 0, is_aggregate: 0 },
    { id: 7, code: "group", display_name: "Group", sort_order: 0, is_aggregate: 0 },
    { id: 8, code: "rps", display_name: "rps", sort_order: 0, is_aggregate: 0 },
    { id: 9, code: "rcm", display_name: "RCM", sort_order: 0, is_aggregate: 0 },
    { id: 10, code: "dec", display_name: "DEC", sort_order: 0, is_aggregate: 0 },
    { id: 11, code: "rc4c", display_name: "RC4C", sort_order: 0, is_aggregate: 0 },
    { id: 12, code: "media", display_name: "Media", sort_order: 0, is_aggregate: 0 },
    { id: 13, code: "schweiz", display_name: "Schweiz", sort_order: 0, is_aggregate: 0 },
    { id: 14, code: "albanien", display_name: "Albanien", sort_order: 0, is_aggregate: 0 },
    { id: 15, code: "slovenien", display_name: "Slovenien", sort_order: 0, is_aggregate: 0 },
  ];

  for (const e of entities) {
    await client.query(
      "INSERT INTO entities (id, code, display_name, sort_order, is_aggregate) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (code) DO NOTHING",
      [e.id, e.code, e.display_name, e.sort_order, e.is_aggregate]
    );
  }
  await client.query("SELECT setval('entities_id_seq', 15, true)");

  // Seed KPIs
  const kpis = [
    { id: 1, area: "Umsatz", code: "umsatz", display_name: "Umsatz", is_derived: 0 },
    { id: 2, area: "Ertrag", code: "ebit", display_name: "EBIT", is_derived: 0 },
    { id: 3, area: "Headcount", code: "headcount", display_name: "Headcount", is_derived: 0 },
    { id: 4, area: "Headcount", code: "headcount_umlagerelevant", display_name: "Headcount Umlagerelevant", is_derived: 0 },
    { id: 5, area: "Headcount", code: "headcount_ohne_umlage_de", display_name: "Headcount ohne Umlage DE", is_derived: 0 },
  ];

  for (const k of kpis) {
    await client.query(
      "INSERT INTO kpis (id, area, code, display_name, is_derived) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (area, code) DO NOTHING",
      [k.id, k.area, k.code, k.display_name, k.is_derived]
    );
  }
  await client.query("SELECT setval('kpis_id_seq', 5, true)");

  // Seed values from embedded data
  await seedValuesFromFile(client);

  console.log("Database seeded successfully!");
}

async function seedValuesFromFile(client: PoolClient) {
  try {
    // Import embedded seed data
    const { seedValues } = await import("./seed-data");
    
    console.log(`Seeding ${seedValues.length} monthly values...`);
    const now = new Date().toISOString();

    // Batch insert for performance
    for (let i = 0; i < seedValues.length; i += 100) {
      const batch = seedValues.slice(i, i + 100);
      for (const v of batch) {
        await client.query(
          "INSERT INTO values_monthly (year, month, entity_id, kpi_id, scenario, value, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (year, month, entity_id, kpi_id, scenario) DO NOTHING",
          [v.year, v.month, v.entity_id, v.kpi_id, v.scenario, v.value, now]
        );
      }
    }
    console.log("Values seeded successfully!");
  } catch (error) {
    console.error("Error seeding values:", error);
  }
}

// Cache für Abfragen innerhalb eines Requests
let cachedData: {
  entities: Map<string, unknown[]>;
  kpis: Map<string, unknown[]>;
  values: Map<string, unknown[]>;
  settings: Map<string, unknown>;
} | null = null;

export async function getDb(): Promise<DbClient> {
  const p = getPool();
  const client = await p.connect();
  
  try {
    await migrate(client);
  } finally {
    client.release();
  }

  const exec = async (sql: string, params?: Array<string | number | null>) => {
    const c = await p.connect();
    try {
      // Convert ? placeholders to $1, $2, etc. for PostgreSQL
      let idx = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
      await c.query(pgSql, params || []);
    } finally {
      c.release();
    }
  };

  const all = <T = unknown>(sql: string, params?: Array<string | number | null>): T[] => {
    // This needs to be sync for compatibility, so we use a workaround
    // In practice, we'll need to refactor callers to be async
    throw new Error("Use allAsync instead");
  };

  const get = <T = unknown>(sql: string, params?: Array<string | number | null>): T | null => {
    throw new Error("Use getAsync instead");
  };

  const save = async () => {
    // PostgreSQL commits automatically
  };

  return { exec, all, get, save };
}

// Convert PostgreSQL $1, $2 placeholders to SQLite ? placeholders
function pgToSqlite(sql: string): string {
  return sql.replace(/\$\d+/g, "?");
}

// Async versions - support both PostgreSQL and SQLite
export async function execAsync(sql: string, params?: Array<string | number | null>): Promise<void> {
  if (usePostgres) {
    const p = getPool();
    const client = await p.connect();
    try {
      await migrate(client);
      await client.query(sql, params || []);
    } finally {
      client.release();
    }
  } else {
    const db = getSqliteDb();
    const sqliteSql = pgToSqlite(sql);
    db.prepare(sqliteSql).run(...(params || []));
  }
}

export async function allAsync<T = unknown>(sql: string, params?: Array<string | number | null>): Promise<T[]> {
  if (usePostgres) {
    const p = getPool();
    const client = await p.connect();
    try {
      await migrate(client);
      const result = await client.query(sql, params || []);
      return result.rows as T[];
    } finally {
      client.release();
    }
  } else {
    const db = getSqliteDb();
    const sqliteSql = pgToSqlite(sql);
    return db.prepare(sqliteSql).all(...(params || [])) as T[];
  }
}

export async function getAsync<T = unknown>(sql: string, params?: Array<string | number | null>): Promise<T | null> {
  const rows = await allAsync<T>(sql, params);
  return rows[0] ?? null;
}
