import { NextRequest, NextResponse } from "next/server";
import { allAsync } from "../../../../../lib/db";
import { getCurrentUser } from "../../../../../lib/auth";

const MONTHS = ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year")) || new Date().getFullYear();
  const employeeId = searchParams.get("employeeId");

  try {
    // Get employee data
    let employeeQuery = `
      SELECT e.id, e.first_name, e.last_name, e.position, e.weekly_hours, e.hourly_rate,
             en.display_name as entity_name
      FROM employees e
      JOIN entities en ON en.id = e.entity_id
      WHERE e.is_active = 1
    `;
    const params: (string | number)[] = [];
    if (employeeId) {
      employeeQuery += ` AND e.id = $1`;
      params.push(Number(employeeId));
    }

    const employees = await allAsync<{
      id: number;
      first_name: string;
      last_name: string;
      position: string | null;
      weekly_hours: number;
      hourly_rate: number | null;
      entity_name: string;
    }>(employeeQuery, params);

    // Get planning data
    const planning = await allAsync<{
      employee_id: number;
      month: number;
      target_revenue: number;
      forecast_percent: number;
      vacation_days: number;
      internal_days: number;
    }>(`SELECT employee_id, month, target_revenue, forecast_percent, vacation_days, internal_days 
        FROM pep_planning WHERE year = $1`, [year]);

    // Get actuals
    const actuals = await allAsync<{
      employee_id: number;
      month: number;
      actual_revenue: number;
      billable_hours: number;
    }>(`SELECT employee_id, month, actual_revenue, billable_hours FROM pep_actuals WHERE year = $1`, [year]);

    // Build HTML report
    const formatCurrency = (v: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>PEP Bericht ${year}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
    h1 { font-size: 18px; margin-bottom: 5px; }
    h2 { font-size: 14px; margin: 15px 0 5px; border-bottom: 1px solid #ccc; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: right; }
    th { background: #f5f5f5; font-weight: bold; }
    td:first-child, th:first-child { text-align: left; }
    .total { font-weight: bold; background: #f9f9f9; }
    .green { color: #059669; }
    .red { color: #dc2626; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>Personal-Einsatz-Planung ${year}</h1>
  <p>Erstellt am ${new Date().toLocaleDateString("de-DE")} von ${user.displayName}</p>
`;

    for (const emp of employees) {
      const empPlanning = planning.filter(p => p.employee_id === emp.id);
      const empActuals = actuals.filter(a => a.employee_id === emp.id);

      let totalTarget = 0, totalForecast = 0, totalActual = 0;

      html += `<h2>${emp.last_name}, ${emp.first_name} - ${emp.entity_name}</h2>`;
      html += `<p>${emp.position || ""} | ${emp.weekly_hours}h/Woche | ${emp.hourly_rate ? formatCurrency(emp.hourly_rate) + "/Std." : ""}</p>`;
      html += `<table><thead><tr><th>Monat</th><th>Ziel</th><th>Prognose</th><th>IST</th><th>Δ</th></tr></thead><tbody>`;

      for (let m = 1; m <= 12; m++) {
        const p = empPlanning.find(x => x.month === m);
        const a = empActuals.find(x => x.month === m);
        const target = p?.target_revenue || 0;
        const forecast = target * ((p?.forecast_percent || 80) / 100);
        const actual = a?.actual_revenue || 0;
        const delta = actual - target;

        totalTarget += target;
        totalForecast += forecast;
        totalActual += actual;

        html += `<tr>
          <td>${MONTHS[m - 1]}</td>
          <td>${formatCurrency(target)}</td>
          <td>${formatCurrency(forecast)}</td>
          <td>${formatCurrency(actual)}</td>
          <td class="${delta >= 0 ? "green" : "red"}">${delta >= 0 ? "+" : ""}${formatCurrency(delta)}</td>
        </tr>`;
      }

      const totalDelta = totalActual - totalTarget;
      html += `<tr class="total">
        <td>Gesamt</td>
        <td>${formatCurrency(totalTarget)}</td>
        <td>${formatCurrency(totalForecast)}</td>
        <td>${formatCurrency(totalActual)}</td>
        <td class="${totalDelta >= 0 ? "green" : "red"}">${totalDelta >= 0 ? "+" : ""}${formatCurrency(totalDelta)}</td>
      </tr>`;
      html += `</tbody></table>`;
    }

    html += `</body></html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="PEP_${year}.html"`
      }
    });
  } catch (e) {
    console.error("PDF export error:", e);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
