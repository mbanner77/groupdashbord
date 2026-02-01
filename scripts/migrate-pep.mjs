import pg from 'pg';

const { Pool } = pg;

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.log('No DATABASE_URL found, skipping PEP migration');
    return;
  }

  console.log('Running PEP database migration...');
  
  const pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Audit log table for change history
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pep_audit_log (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        year INTEGER,
        month INTEGER,
        field_name TEXT,
        old_value TEXT,
        new_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ pep_audit_log table created');

    // Planning approval table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pep_approvals (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        submitted_by INTEGER,
        submitted_at TIMESTAMP,
        approved_by INTEGER,
        approved_at TIMESTAMP,
        rejected_reason TEXT,
        UNIQUE(employee_id, year)
      )
    `);
    console.log('✓ pep_approvals table created');

    // Employee yearly comments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pep_employee_comments (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        comment TEXT,
        updated_by INTEGER,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(employee_id, year)
      )
    `);
    console.log('✓ pep_employee_comments table created');

    // Planning scenarios/versions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pep_scenarios (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        year INTEGER NOT NULL,
        description TEXT,
        is_active INTEGER DEFAULT 0,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ pep_scenarios table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pep_scenario_data (
        id SERIAL PRIMARY KEY,
        scenario_id INTEGER NOT NULL,
        employee_id INTEGER NOT NULL,
        month INTEGER NOT NULL,
        portfolio_id INTEGER,
        target_revenue REAL DEFAULT 0,
        forecast_percent REAL DEFAULT 80,
        vacation_days INTEGER DEFAULT 0,
        internal_days INTEGER DEFAULT 0,
        sick_days INTEGER DEFAULT 0,
        training_days INTEGER DEFAULT 0,
        UNIQUE(scenario_id, employee_id, month)
      )
    `);
    console.log('✓ pep_scenario_data table created');

    console.log('PEP migration completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await pool.end();
  }
}

migrate();
