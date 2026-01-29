import { Pool, PoolClient } from "pg";

const connectionString = process.env.DATABASE_URL;

export type DbClient = {
  exec: (sql: string, params?: Array<string | number | null>) => Promise<void>;
  all: <T = unknown>(sql: string, params?: Array<string | number | null>) => T[];
  get: <T = unknown>(sql: string, params?: Array<string | number | null>) => T | null;
  save: () => Promise<void>;
};

let pool: Pool | null = null;
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
  
  migrated = true;
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

// Async versions for PostgreSQL
export async function execAsync(sql: string, params?: Array<string | number | null>): Promise<void> {
  const p = getPool();
  const client = await p.connect();
  try {
    await migrate(client);
    let idx = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
    await client.query(pgSql, params || []);
  } finally {
    client.release();
  }
}

export async function allAsync<T = unknown>(sql: string, params?: Array<string | number | null>): Promise<T[]> {
  const p = getPool();
  const client = await p.connect();
  try {
    await migrate(client);
    let idx = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
    const result = await client.query(pgSql, params || []);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function getAsync<T = unknown>(sql: string, params?: Array<string | number | null>): Promise<T | null> {
  const rows = await allAsync<T>(sql, params);
  return rows[0] ?? null;
}
