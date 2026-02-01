import { NextResponse } from "next/server";
import { execAsync } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Audit log table for change history
    await execAsync(`
      CREATE TABLE IF NOT EXISTS pep_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        year INTEGER,
        month INTEGER,
        field_name TEXT,
        old_value TEXT,
        new_value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Planning approval table
    await execAsync(`
      CREATE TABLE IF NOT EXISTS pep_approvals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        submitted_by INTEGER,
        submitted_at DATETIME,
        approved_by INTEGER,
        approved_at DATETIME,
        rejected_reason TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (submitted_by) REFERENCES users(id),
        FOREIGN KEY (approved_by) REFERENCES users(id),
        UNIQUE(employee_id, year)
      )
    `);

    // Employee yearly comments
    await execAsync(`
      CREATE TABLE IF NOT EXISTS pep_employee_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        comment TEXT,
        updated_by INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (updated_by) REFERENCES users(id),
        UNIQUE(employee_id, year)
      )
    `);

    // Planning scenarios/versions
    await execAsync(`
      CREATE TABLE IF NOT EXISTS pep_scenarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        year INTEGER NOT NULL,
        description TEXT,
        is_active INTEGER DEFAULT 0,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    await execAsync(`
      CREATE TABLE IF NOT EXISTS pep_scenario_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        FOREIGN KEY (scenario_id) REFERENCES pep_scenarios(id),
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        UNIQUE(scenario_id, employee_id, month)
      )
    `);

    return NextResponse.json({ success: true, message: "Migration completed" });
  } catch (e) {
    console.error("Migration error:", e);
    return NextResponse.json({ error: "Migration failed" }, { status: 500 });
  }
}
