import { NextRequest, NextResponse } from "next/server";
import { allAsync, execAsync } from "../../../../../lib/db";
import { getCurrentUser } from "../../../../../lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const employeeId = Number(searchParams.get("employeeId"));
  const fromYear = Number(searchParams.get("fromYear"));
  const toYear = Number(searchParams.get("toYear"));

  if (!employeeId || !fromYear || !toYear) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    // Get planning data from previous year
    const previousPlanning = await allAsync<{
      month: number;
      portfolio_id: number | null;
      target_revenue: number;
      forecast_percent: number;
      vacation_days: number;
      internal_days: number;
      sick_days: number;
      training_days: number;
      notes: string | null;
    }>(
      `SELECT month, portfolio_id, target_revenue, forecast_percent, vacation_days, internal_days, sick_days, training_days, notes
       FROM pep_planning WHERE employee_id = $1 AND year = $2`,
      [employeeId, fromYear]
    );

    if (previousPlanning.length === 0) {
      return NextResponse.json({ error: "No data from previous year" }, { status: 404 });
    }

    // Copy to new year (upsert)
    for (const p of previousPlanning) {
      await execAsync(
        `INSERT INTO pep_planning (employee_id, year, month, portfolio_id, target_revenue, forecast_percent, vacation_days, internal_days, sick_days, training_days, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (employee_id, year, month) DO UPDATE SET
           portfolio_id = $4, target_revenue = $5, forecast_percent = $6,
           vacation_days = $7, internal_days = $8, sick_days = $9, training_days = $10, notes = $11`,
        [employeeId, toYear, p.month, p.portfolio_id, p.target_revenue, p.forecast_percent, p.vacation_days, p.internal_days, p.sick_days, p.training_days, p.notes]
      );
    }

    return NextResponse.json({ success: true, copiedMonths: previousPlanning.length });
  } catch (e) {
    console.error("Copy planning error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
