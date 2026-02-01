import { NextRequest, NextResponse } from "next/server";
import { allAsync, getAsync, execAsync } from "../../../../lib/db";
import { getCurrentUser, getUserPermissions } from "../../../../lib/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") || new Date().getFullYear();
  const entityId = searchParams.get("entityId");
  const employeeId = searchParams.get("employeeId");

  try {
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
      const permissions = await getUserPermissions(user.id);
      const entityIds = permissions.map(p => p.entityId);
      if (entityIds.length === 0) {
        return NextResponse.json([]);
      }
      query += ` AND e.entity_id IN (${entityIds.map((_, i) => `$${paramIndex + i}`).join(", ")})`;
      params.push(...entityIds);
    }

    query += " ORDER BY e.last_name, e.first_name, pp.month";

    const planning = await allAsync(query, params);

    return NextResponse.json(planning);
  } catch (e: unknown) {
    console.error("Planning GET error:", e);
    return NextResponse.json([]);
  }
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { employee_id, year, month, target_revenue, forecast_percent, vacation_days, internal_days, sick_days, training_days, notes } = body;

  if (!employee_id || !year || !month) {
    return NextResponse.json({ error: "employee_id, year and month are required" }, { status: 400 });
  }

  // Get employee to check entity
  const employee = await getAsync<{ entity_id: number }>("SELECT entity_id FROM employees WHERE id = $1", [employee_id]);
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Check permissions
  if (user.role !== "admin") {
    const permissions = await getUserPermissions(user.id);
    const canEdit = permissions.find(p => p.entityId === employee.entity_id && p.canEdit);
    if (!canEdit) {
      return NextResponse.json({ error: "No permission to edit planning for this employee" }, { status: 403 });
    }
  }

  const now = new Date().toISOString();

  try {
    // Upsert planning data
    await execAsync(
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

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Bulk update for a whole year
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { employee_id, year, monthly_data } = body;

  if (!employee_id || !year || !Array.isArray(monthly_data)) {
    return NextResponse.json({ error: "employee_id, year and monthly_data are required" }, { status: 400 });
  }

  // Get employee to check entity
  const employee = await getAsync<{ entity_id: number }>("SELECT entity_id FROM employees WHERE id = $1", [employee_id]);
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Check permissions
  if (user.role !== "admin") {
    const permissions = await getUserPermissions(user.id);
    const canEdit = permissions.find(p => p.entityId === employee.entity_id && p.canEdit);
    if (!canEdit) {
      return NextResponse.json({ error: "No permission to edit planning for this employee" }, { status: 403 });
    }
  }

  const now = new Date().toISOString();

  try {
    for (const data of monthly_data) {
      const { month, portfolio_id, target_revenue, forecast_percent, vacation_days, internal_days, sick_days, training_days, notes } = data;
      if (!month) continue;

      await execAsync(
        `INSERT INTO pep_planning (employee_id, year, month, portfolio_id, target_revenue, forecast_percent, vacation_days, internal_days, sick_days, training_days, notes, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (employee_id, year, month) DO UPDATE SET
           portfolio_id = EXCLUDED.portfolio_id,
           target_revenue = EXCLUDED.target_revenue,
           forecast_percent = EXCLUDED.forecast_percent,
           vacation_days = EXCLUDED.vacation_days,
           internal_days = EXCLUDED.internal_days,
           sick_days = EXCLUDED.sick_days,
           training_days = EXCLUDED.training_days,
           notes = EXCLUDED.notes,
           updated_at = EXCLUDED.updated_at`,
        [employee_id, year, month, portfolio_id || null, target_revenue || 0, forecast_percent || 80, vacation_days || 0, internal_days || 0, sick_days || 0, training_days || 0, notes || null, now]
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
