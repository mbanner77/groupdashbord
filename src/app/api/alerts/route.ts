import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { allAsync, execAsync, getAsync } from "../../../lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

    // Check for high variance alerts (>20% deviation from plan)
    const alerts = await allAsync<{
      entity_name: string;
      kpi_name: string;
      month: number;
      actual: number;
      plan: number;
      variance_percent: number;
    }>(`
      SELECT 
        e.display_name as entity_name,
        k.display_name as kpi_name,
        v1.month,
        v1.value as actual,
        COALESCE(v2.value, 0) as plan,
        CASE 
          WHEN v2.value IS NULL OR v2.value = 0 THEN 0
          ELSE ((v1.value - v2.value) / ABS(v2.value)) * 100
        END as variance_percent
      FROM values_monthly v1
      JOIN entities e ON v1.entity_id = e.id
      JOIN kpis k ON v1.kpi_id = k.id
      LEFT JOIN values_monthly v2 ON 
        v2.entity_id = v1.entity_id AND 
        v2.kpi_id = v1.kpi_id AND 
        v2.year = v1.year AND 
        v2.month = v1.month AND 
        v2.scenario = 'plan'
      WHERE v1.year = $1 
        AND v1.scenario IN ('ist', 'fc')
        AND e.is_aggregate = 0
        AND ABS(CASE 
          WHEN v2.value IS NULL OR v2.value = 0 THEN 0
          ELSE ((v1.value - v2.value) / ABS(v2.value)) * 100
        END) > 20
      ORDER BY ABS(variance_percent) DESC
      LIMIT 50
    `, [year]);

    return NextResponse.json({ 
      alerts,
      count: alerts.length,
      year,
    });
  } catch (error) {
    console.error("Alerts fetch error:", error);
    return NextResponse.json({ error: "Fehler beim Laden der Alerts" }, { status: 500 });
  }
}

// API to configure alert thresholds (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const { varianceThreshold, emailRecipients } = await request.json();

    // Store settings
    const now = new Date().toISOString();
    
    if (varianceThreshold !== undefined) {
      await execAsync(
        `INSERT INTO settings (key, value) VALUES ('alert_variance_threshold', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`,
        [String(varianceThreshold)]
      );
    }

    if (emailRecipients !== undefined) {
      await execAsync(
        `INSERT INTO settings (key, value) VALUES ('alert_email_recipients', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`,
        [emailRecipients]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Alert config error:", error);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}
