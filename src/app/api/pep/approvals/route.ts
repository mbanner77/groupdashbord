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
  const year = Number(searchParams.get("year")) || new Date().getFullYear();

  try {
    let query = `
      SELECT a.*, 
        e.first_name, e.last_name,
        u1.display_name as submitted_by_name,
        u2.display_name as approved_by_name
      FROM pep_approvals a
      LEFT JOIN employees e ON e.id = a.employee_id
      LEFT JOIN users u1 ON u1.id = a.submitted_by
      LEFT JOIN users u2 ON u2.id = a.approved_by
      WHERE a.year = $1
    `;
    const params: (string | number)[] = [year];

    if (employeeId) {
      query += ` AND a.employee_id = $2`;
      params.push(Number(employeeId));
    }

    const approvals = await allAsync<{
      id: number;
      employee_id: number;
      year: number;
      status: string;
      submitted_at: string | null;
      approved_at: string | null;
      rejected_reason: string | null;
      first_name: string;
      last_name: string;
      submitted_by_name: string | null;
      approved_by_name: string | null;
    }>(query, params);

    return NextResponse.json(approvals);
  } catch (e) {
    console.error("Get approvals error:", e);
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { employeeId, year, action, reason } = await req.json();

    if (!employeeId || !year || !action) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    if (action === "submit") {
      await execAsync(
        `INSERT INTO pep_approvals (employee_id, year, status, submitted_by, submitted_at)
         VALUES ($1, $2, 'pending', $3, CURRENT_TIMESTAMP)
         ON CONFLICT (employee_id, year) DO UPDATE SET
           status = 'pending', submitted_by = $3, submitted_at = CURRENT_TIMESTAMP,
           approved_by = NULL, approved_at = NULL, rejected_reason = NULL`,
        [employeeId, year, user.id]
      );
    } else if (action === "approve" && user.role === "admin") {
      await execAsync(
        `UPDATE pep_approvals SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP
         WHERE employee_id = $2 AND year = $3`,
        [user.id, employeeId, year]
      );
    } else if (action === "reject" && user.role === "admin") {
      await execAsync(
        `UPDATE pep_approvals SET status = 'rejected', approved_by = $1, approved_at = CURRENT_TIMESTAMP, rejected_reason = $4
         WHERE employee_id = $2 AND year = $3`,
        [user.id, employeeId, year, reason || ""]
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Approval action error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
