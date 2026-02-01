import { NextRequest, NextResponse } from "next/server";
import { allAsync, execAsync } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const employeeId = Number(searchParams.get("employeeId"));
  const year = Number(searchParams.get("year"));

  if (!employeeId || !year) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    const comment = await allAsync<{ comment: string; updated_at: string }>(
      `SELECT comment, updated_at FROM pep_employee_comments WHERE employee_id = $1 AND year = $2`,
      [employeeId, year]
    );

    return NextResponse.json({ comment: comment[0]?.comment || "", updatedAt: comment[0]?.updated_at });
  } catch (e) {
    console.error("Get comment error:", e);
    return NextResponse.json({ comment: "" });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { employeeId, year, comment } = await req.json();

    if (!employeeId || !year) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    await execAsync(
      `INSERT INTO pep_employee_comments (employee_id, year, comment, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (employee_id, year) DO UPDATE SET
         comment = $3, updated_by = $4, updated_at = CURRENT_TIMESTAMP`,
      [employeeId, year, comment, user.id]
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Save comment error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
