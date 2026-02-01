import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { cookies } from "next/headers";

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  
  const db = await getDb();
  const session = db.get<{ user_id: number; expires_at: string }>(
    "SELECT user_id, expires_at FROM sessions WHERE token = $1",
    [token]
  );
  if (!session || new Date(session.expires_at) < new Date()) return null;
  
  const user = db.get<{ id: number; username: string; role: string }>(
    "SELECT id, username, role FROM users WHERE id = $1",
    [session.user_id]
  );
  return user;
}

async function getUserEntityPermissions(userId: number) {
  const db = await getDb();
  const permissions = db.all<{ entity_id: number; can_edit: number }>(
    "SELECT entity_id, can_edit FROM user_entity_permissions WHERE user_id = $1",
    [userId]
  );
  return permissions;
}

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") || new Date().getFullYear();
  const entityId = searchParams.get("entityId");
  const employeeId = searchParams.get("employeeId");

  const db = await getDb();
  
  let query = `
    SELECT 
      pp.*,
      e.first_name,
      e.last_name,
      e.entity_id,
      e.weekly_hours,
      e.hourly_rate,
      en.code as entity_code,
      en.display_name as entity_name,
      COALESCE(pa.actual_revenue, 0) as actual_revenue,
      COALESCE(pa.billable_hours, 0) as billable_hours,
      COALESCE(pa.total_hours, 0) as total_hours
    FROM pep_planning pp
    JOIN employees e ON e.id = pp.employee_id
    JOIN entities en ON en.id = e.entity_id
    LEFT JOIN pep_actuals pa ON pa.employee_id = pp.employee_id AND pa.year = pp.year AND pa.month = pp.month
    WHERE pp.year = $1
  `;
  const params: (string | number)[] = [Number(year)];
  let paramIndex = 2;

  if (employeeId) {
    query += ` AND pp.employee_id = $${paramIndex}`;
    params.push(Number(employeeId));
    paramIndex++;
  } else if (entityId) {
    query += ` AND e.entity_id = $${paramIndex}`;
    params.push(Number(entityId));
    paramIndex++;
  } else if (user.role !== "admin") {
    const permissions = await getUserEntityPermissions(user.id);
    const entityIds = permissions.map(p => p.entity_id);
    if (entityIds.length === 0) {
      return NextResponse.json([]);
    }
    query += ` AND e.entity_id IN (${entityIds.map((_, i) => `$${paramIndex + i}`).join(", ")})`;
    params.push(...entityIds);
  }

  query += " ORDER BY e.last_name, e.first_name, pp.month";

  const planning = db.all(query, params);

  return NextResponse.json(planning);
}

export async function PUT(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { employee_id, year, month, target_revenue, forecast_percent, vacation_days, internal_days, sick_days, training_days, notes } = body;

  if (!employee_id || !year || !month) {
    return NextResponse.json({ error: "employee_id, year and month are required" }, { status: 400 });
  }

  const db = await getDb();

  // Get employee to check entity
  const employee = db.get<{ entity_id: number }>("SELECT entity_id FROM employees WHERE id = $1", [employee_id]);
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Check permissions
  if (user.role !== "admin") {
    const permissions = await getUserEntityPermissions(user.id);
    const canEdit = permissions.find(p => p.entity_id === employee.entity_id && p.can_edit);
    if (!canEdit) {
      return NextResponse.json({ error: "No permission to edit planning for this employee" }, { status: 403 });
    }
  }

  const now = new Date().toISOString();

  try {
    // Upsert planning data
    await db.exec(
      `INSERT INTO pep_planning (employee_id, year, month, target_revenue, forecast_percent, vacation_days, internal_days, sick_days, training_days, notes, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (employee_id, year, month) DO UPDATE SET
         target_revenue = EXCLUDED.target_revenue,
         forecast_percent = EXCLUDED.forecast_percent,
         vacation_days = EXCLUDED.vacation_days,
         internal_days = EXCLUDED.internal_days,
         sick_days = EXCLUDED.sick_days,
         training_days = EXCLUDED.training_days,
         notes = EXCLUDED.notes,
         updated_at = EXCLUDED.updated_at`,
      [employee_id, year, month, target_revenue || 0, forecast_percent || 80, vacation_days || 0, internal_days || 0, sick_days || 0, training_days || 0, notes || null, now]
    );
    await db.save();

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Bulk update for a whole year
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { employee_id, year, monthly_data } = body;

  if (!employee_id || !year || !Array.isArray(monthly_data)) {
    return NextResponse.json({ error: "employee_id, year and monthly_data are required" }, { status: 400 });
  }

  const db = await getDb();

  // Get employee to check entity
  const employee = db.get<{ entity_id: number }>("SELECT entity_id FROM employees WHERE id = $1", [employee_id]);
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Check permissions
  if (user.role !== "admin") {
    const permissions = await getUserEntityPermissions(user.id);
    const canEdit = permissions.find(p => p.entity_id === employee.entity_id && p.can_edit);
    if (!canEdit) {
      return NextResponse.json({ error: "No permission to edit planning for this employee" }, { status: 403 });
    }
  }

  const now = new Date().toISOString();

  try {
    for (const data of monthly_data) {
      const { month, target_revenue, forecast_percent, vacation_days, internal_days, sick_days, training_days, notes } = data;
      if (!month) continue;

      await db.exec(
        `INSERT INTO pep_planning (employee_id, year, month, target_revenue, forecast_percent, vacation_days, internal_days, sick_days, training_days, notes, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (employee_id, year, month) DO UPDATE SET
           target_revenue = EXCLUDED.target_revenue,
           forecast_percent = EXCLUDED.forecast_percent,
           vacation_days = EXCLUDED.vacation_days,
           internal_days = EXCLUDED.internal_days,
           sick_days = EXCLUDED.sick_days,
           training_days = EXCLUDED.training_days,
           notes = EXCLUDED.notes,
           updated_at = EXCLUDED.updated_at`,
        [employee_id, year, month, target_revenue || 0, forecast_percent || 80, vacation_days || 0, internal_days || 0, sick_days || 0, training_days || 0, notes || null, now]
      );
    }
    await db.save();

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
