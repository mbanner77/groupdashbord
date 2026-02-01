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
      const { employee_id, month, portfolio_id, target_revenue, forecast_percent, vacation_days, internal_days, sick_days, training_days } = row;
      
      if (!employee_id || !month) continue;
      
      await execAsync(
        `INSERT INTO pep_planning (employee_id, year, month, portfolio_id, target_revenue, forecast_percent, vacation_days, internal_days, sick_days, training_days)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (employee_id, year, month) DO UPDATE SET
           portfolio_id = COALESCE($4, pep_planning.portfolio_id),
           target_revenue = COALESCE($5, pep_planning.target_revenue),
           forecast_percent = COALESCE($6, pep_planning.forecast_percent),
           vacation_days = COALESCE($7, pep_planning.vacation_days),
           internal_days = COALESCE($8, pep_planning.internal_days),
           sick_days = COALESCE($9, pep_planning.sick_days),
           training_days = COALESCE($10, pep_planning.training_days)`,
        [employee_id, year, month, portfolio_id || null, target_revenue || 0, forecast_percent || 80, vacation_days || 0, internal_days || 0, sick_days || 0, training_days || 0]
      );
      imported++;
    }

    return NextResponse.json({ success: true, imported });
  } catch (e) {
    console.error("Import planning error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
