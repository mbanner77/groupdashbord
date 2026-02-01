import { NextRequest, NextResponse } from "next/server";
import { allAsync, execAsync } from "../../../../../lib/db";
import { getCurrentUser } from "../../../../../lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { employeeId, year } = await req.json();

    if (!employeeId || !year) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const currentMonth = new Date().getMonth() + 1;

    // Get actuals for completed months
    const actuals = await allAsync<{
      month: number;
      actual_revenue: number;
    }>(`SELECT month, actual_revenue FROM pep_actuals 
        WHERE employee_id = $1 AND year = $2 AND month < $3`,
      [employeeId, year, currentMonth]);

    if (actuals.length === 0) {
      return NextResponse.json({ error: "No actuals data available" }, { status: 400 });
    }

    // Get planning data
    const planning = await allAsync<{
      month: number;
      target_revenue: number;
      forecast_percent: number;
    }>(`SELECT month, target_revenue, forecast_percent FROM pep_planning 
        WHERE employee_id = $1 AND year = $2`,
      [employeeId, year]);

    // Calculate average achievement rate from actuals
    let totalTarget = 0;
    let totalActual = 0;
    for (const a of actuals) {
      const p = planning.find(x => x.month === a.month);
      if (p && p.target_revenue > 0) {
        totalTarget += p.target_revenue;
        totalActual += a.actual_revenue;
      }
    }

    if (totalTarget === 0) {
      return NextResponse.json({ error: "No target data" }, { status: 400 });
    }

    // Calculate new forecast percent based on actual achievement
    const achievementRate = (totalActual / totalTarget) * 100;
    const newForecastPercent = Math.min(Math.max(Math.round(achievementRate), 50), 120);

    // Update forecast for remaining months
    let updated = 0;
    for (let m = currentMonth; m <= 12; m++) {
      await execAsync(
        `UPDATE pep_planning SET forecast_percent = $1 WHERE employee_id = $2 AND year = $3 AND month = $4`,
        [newForecastPercent, employeeId, year, m]
      );
      updated++;
    }

    // Log the change
    await execAsync(
      `INSERT INTO pep_audit_log (employee_id, user_id, action, year, field_name, old_value, new_value)
       VALUES ($1, $2, 'forecast_auto_adjust', $3, 'forecast_percent', $4, $5)`,
      [employeeId, user.id, year, `${achievementRate.toFixed(0)}% actual`, `${newForecastPercent}% forecast`]
    );

    return NextResponse.json({ 
      success: true, 
      achievementRate: achievementRate.toFixed(1),
      newForecastPercent,
      monthsUpdated: updated
    });
  } catch (e) {
    console.error("Auto-adjust forecast error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
