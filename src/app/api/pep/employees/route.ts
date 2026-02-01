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
  const entityId = searchParams.get("entityId");

  const db = await getDb();
  
  let query = `
    SELECT e.*, en.code as entity_code, en.display_name as entity_name,
           COALESCE(
             (SELECT json_agg(json_build_object('id', p.id, 'code', p.code, 'display_name', p.display_name, 'color', p.color, 'allocation_percent', ep.allocation_percent))
              FROM employee_portfolios ep
              JOIN portfolios p ON p.id = ep.portfolio_id
              WHERE ep.employee_id = e.id), '[]'
           ) as portfolios
    FROM employees e
    JOIN entities en ON en.id = e.entity_id
  `;
  const params: (string | number)[] = [];

  if (entityId) {
    query += " WHERE e.entity_id = $1";
    params.push(Number(entityId));
  } else if (user.role !== "admin") {
    const permissions = await getUserEntityPermissions(user.id);
    const entityIds = permissions.map(p => p.entity_id);
    if (entityIds.length === 0) {
      return NextResponse.json([]);
    }
    query += ` WHERE e.entity_id IN (${entityIds.map((_, i) => `$${i + 1}`).join(", ")})`;
    params.push(...entityIds);
  }

  query += " ORDER BY e.last_name, e.first_name";

  const employees = db.all<{
    id: number;
    entity_id: number;
    entity_code: string;
    entity_name: string;
    employee_number: string | null;
    first_name: string;
    last_name: string;
    email: string | null;
    position: string | null;
    entry_date: string | null;
    exit_date: string | null;
    weekly_hours: number;
    hourly_rate: number | null;
    is_active: number;
    portfolios: string;
  }>(query, params);

  // Parse portfolios JSON
  const result = employees.map(emp => ({
    ...emp,
    portfolios: typeof emp.portfolios === "string" ? JSON.parse(emp.portfolios) : emp.portfolios
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { entity_id, employee_number, first_name, last_name, email, position, entry_date, exit_date, weekly_hours, hourly_rate, portfolio_ids } = body;

  if (!entity_id || !first_name || !last_name) {
    return NextResponse.json({ error: "entity_id, first_name and last_name are required" }, { status: 400 });
  }

  // Check permissions
  if (user.role !== "admin") {
    const permissions = await getUserEntityPermissions(user.id);
    const canEdit = permissions.find(p => p.entity_id === entity_id && p.can_edit);
    if (!canEdit) {
      return NextResponse.json({ error: "No permission to edit this entity" }, { status: 403 });
    }
  }

  const db = await getDb();
  const now = new Date().toISOString();

  try {
    await db.exec(
      `INSERT INTO employees (entity_id, employee_number, first_name, last_name, email, position, entry_date, exit_date, weekly_hours, hourly_rate, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, $11, $11)`,
      [entity_id, employee_number || null, first_name, last_name, email || null, position || null, entry_date || null, exit_date || null, weekly_hours || 40, hourly_rate || null, now]
    );

    // Get the new employee ID
    const newEmployee = db.get<{ id: number }>("SELECT id FROM employees WHERE entity_id = $1 AND first_name = $2 AND last_name = $3 ORDER BY id DESC LIMIT 1", [entity_id, first_name, last_name]);
    
    // Add portfolio assignments (only admin can do this)
    if (newEmployee && portfolio_ids && Array.isArray(portfolio_ids) && user.role === "admin") {
      for (const portfolioId of portfolio_ids) {
        await db.exec(
          "INSERT INTO employee_portfolios (employee_id, portfolio_id, allocation_percent) VALUES ($1, $2, 100) ON CONFLICT (employee_id, portfolio_id) DO NOTHING",
          [newEmployee.id, portfolioId]
        );
      }
    }

    await db.save();

    return NextResponse.json({ success: true, id: newEmployee?.id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, entity_id, employee_number, first_name, last_name, email, position, entry_date, exit_date, weekly_hours, hourly_rate, is_active, portfolio_ids } = body;

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const db = await getDb();

  // Get current employee to check entity
  const current = db.get<{ entity_id: number }>("SELECT entity_id FROM employees WHERE id = $1", [id]);
  if (!current) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Check permissions
  if (user.role !== "admin") {
    const permissions = await getUserEntityPermissions(user.id);
    const canEdit = permissions.find(p => p.entity_id === current.entity_id && p.can_edit);
    if (!canEdit) {
      return NextResponse.json({ error: "No permission to edit this employee" }, { status: 403 });
    }
  }

  const now = new Date().toISOString();

  try {
    await db.exec(
      `UPDATE employees SET entity_id = $1, employee_number = $2, first_name = $3, last_name = $4, email = $5, position = $6, entry_date = $7, exit_date = $8, weekly_hours = $9, hourly_rate = $10, is_active = $11, updated_at = $12 WHERE id = $13`,
      [entity_id, employee_number || null, first_name, last_name, email || null, position || null, entry_date || null, exit_date || null, weekly_hours || 40, hourly_rate || null, is_active ? 1 : 0, now, id]
    );

    // Update portfolio assignments (only admin)
    if (portfolio_ids !== undefined && user.role === "admin") {
      await db.exec("DELETE FROM employee_portfolios WHERE employee_id = $1", [id]);
      if (Array.isArray(portfolio_ids)) {
        for (const portfolioId of portfolio_ids) {
          await db.exec(
            "INSERT INTO employee_portfolios (employee_id, portfolio_id, allocation_percent) VALUES ($1, $2, 100)",
            [id, portfolioId]
          );
        }
      }
    }

    await db.save();

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const db = await getDb();

  // Get current employee to check entity
  const current = db.get<{ entity_id: number }>("SELECT entity_id FROM employees WHERE id = $1", [Number(id)]);
  if (!current) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Check permissions
  if (user.role !== "admin") {
    const permissions = await getUserEntityPermissions(user.id);
    const canEdit = permissions.find(p => p.entity_id === current.entity_id && p.can_edit);
    if (!canEdit) {
      return NextResponse.json({ error: "No permission to delete this employee" }, { status: 403 });
    }
  }

  try {
    await db.exec("DELETE FROM employees WHERE id = $1", [Number(id)]);
    await db.save();

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
