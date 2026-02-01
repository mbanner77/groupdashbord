import { NextRequest, NextResponse } from "next/server";
import { execAsync } from "../../../../../lib/db";
import { getCurrentUser } from "../../../../../lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, year } = await req.json();
    
    if (!Array.isArray(data) || !year) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
    }

    let imported = 0;
    for (const row of data) {
      const { employee_id, month, actual_revenue, billable_hours } = row;
      
      if (!employee_id || !month) continue;
      
      await execAsync(
        `INSERT INTO pep_actuals (employee_id, year, month, actual_revenue, billable_hours)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (employee_id, year, month) DO UPDATE SET
           actual_revenue = COALESCE($4, pep_actuals.actual_revenue),
           billable_hours = COALESCE($5, pep_actuals.billable_hours)`,
        [employee_id, year, month, actual_revenue || 0, billable_hours || 0]
      );
      imported++;
    }

    return NextResponse.json({ success: true, imported });
  } catch (e) {
    console.error("Import actuals error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
