#!/usr/bin/env node
/**
 * Migration script: SQLite → PostgreSQL
 * 
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/migrate-to-postgres.mjs
 * 
 * This reads data from the local SQLite database and inserts it into PostgreSQL.
 */

import Database from "better-sqlite3";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlitePath = path.join(__dirname, "..", "data", "app.sqlite");

const { Pool } = pg;

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("ERROR: DATABASE_URL environment variable is required");
    process.exit(1);
  }

  console.log("Opening SQLite database:", sqlitePath);
  const sqlite = new Database(sqlitePath, { readonly: true });

  console.log("Connecting to PostgreSQL...");
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    console.log("Creating PostgreSQL tables...");
    
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

    // Migrate entities
    console.log("Migrating entities...");
    const entities = sqlite.prepare("SELECT * FROM entities").all();
    for (const e of entities) {
      await client.query(
        `INSERT INTO entities (id, code, display_name, sort_order, is_aggregate) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (code) DO UPDATE SET display_name = $3, sort_order = $4, is_aggregate = $5`,
        [e.id, e.code, e.display_name, e.sort_order, e.is_aggregate]
      );
    }
    console.log(`  → ${entities.length} entities migrated`);

    // Reset sequence
    const maxEntityId = Math.max(...entities.map(e => e.id), 0);
    await client.query(`SELECT setval('entities_id_seq', $1, true)`, [maxEntityId]);

    // Migrate KPIs
    console.log("Migrating KPIs...");
    const kpis = sqlite.prepare("SELECT * FROM kpis").all();
    for (const k of kpis) {
      await client.query(
        `INSERT INTO kpis (id, area, code, display_name, is_derived) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (area, code) DO UPDATE SET display_name = $4, is_derived = $5`,
        [k.id, k.area, k.code, k.display_name, k.is_derived]
      );
    }
    console.log(`  → ${kpis.length} KPIs migrated`);

    // Reset sequence
    const maxKpiId = Math.max(...kpis.map(k => k.id), 0);
    await client.query(`SELECT setval('kpis_id_seq', $1, true)`, [maxKpiId]);

    // Migrate settings
    console.log("Migrating settings...");
    const settings = sqlite.prepare("SELECT * FROM settings").all();
    for (const s of settings) {
      await client.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`,
        [s.key, s.value]
      );
    }
    console.log(`  → ${settings.length} settings migrated`);

    // Migrate values_monthly
    console.log("Migrating monthly values...");
    const values = sqlite.prepare("SELECT * FROM values_monthly").all();
    let valuesCount = 0;
    
    // Batch insert for performance
    const batchSize = 100;
    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);
      for (const v of batch) {
        await client.query(
          `INSERT INTO values_monthly (year, month, entity_id, kpi_id, scenario, value, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           ON CONFLICT (year, month, entity_id, kpi_id, scenario) DO UPDATE SET value = $6, updated_at = $7`,
          [v.year, v.month, v.entity_id, v.kpi_id, v.scenario, v.value, v.updated_at]
        );
        valuesCount++;
      }
      process.stdout.write(`\r  → ${valuesCount}/${values.length} values migrated`);
    }
    console.log();

    console.log("\n✅ Migration completed successfully!");
    console.log(`   Entities: ${entities.length}`);
    console.log(`   KPIs: ${kpis.length}`);
    console.log(`   Settings: ${settings.length}`);
    console.log(`   Monthly Values: ${values.length}`);

  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
