import { NextRequest, NextResponse } from "next/server";
import { allAsync, execAsync } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const year = searchParams.get("year");
  const limit = Number(searchParams.get("limit")) || 50;

  try {
    let query = `
      SELECT a.*, 
        e.first_name, e.last_name,
        u.display_name as user_name
      FROM pep_audit_log a
      LEFT JOIN employees e ON e.id = a.employee_id
      LEFT JOIN users u ON u.id = a.user_id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (employeeId) {
      query += ` AND a.employee_id = $${paramIndex++}`;
      params.push(Number(employeeId));
    }
    if (year) {
      query += ` AND a.year = $${paramIndex++}`;
      params.push(Number(year));
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const logs = await allAsync<{
      id: number;
      employee_id: number;
      action: string;
      year: number | null;
      month: number | null;
      field_name: string | null;
      old_value: string | null;
      new_value: string | null;
      created_at: string;
      first_name: string;
      last_name: string;
      user_name: string;
    }>(query, params);

    return NextResponse.json(logs);
  } catch (e) {
    console.error("Get audit log error:", e);
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { employeeId, action, year, month, fieldName, oldValue, newValue } = await req.json();

    if (!employeeId || !action) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    await execAsync(
      `INSERT INTO pep_audit_log (employee_id, user_id, action, year, month, field_name, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [employeeId, user.id, action, year || null, month || null, fieldName || null, oldValue || null, newValue || null]
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Log audit error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
