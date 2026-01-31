import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { getAsync, execAsync } from "../../../../lib/db";
import { logAudit } from "../../../../lib/audit";

type AlertConfig = {
  varianceThreshold: number;
  emailRecipients: string;
  alertsEnabled: boolean;
};

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const configRow = await getAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'alert_config'"
    );

    let config: AlertConfig = {
      varianceThreshold: 20,
      emailRecipients: "",
      alertsEnabled: false,
    };

    if (configRow?.value) {
      try {
        const parsed = JSON.parse(configRow.value);
        config = { ...config, ...parsed };
      } catch {
        // Invalid JSON, use defaults
      }
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error("Alert config GET error:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const config: AlertConfig = await request.json();

    // Validate
    if (config.varianceThreshold < 1 || config.varianceThreshold > 100) {
      return NextResponse.json({ error: "Schwellwert muss zwischen 1 und 100 liegen" }, { status: 400 });
    }

    await execAsync(
      `INSERT INTO settings (key, value) VALUES ('alert_config', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [JSON.stringify(config)]
    );

    await logAudit({
      userId: user.id,
      username: user.username,
      action: "update",
      entityType: "settings",
      entityName: "alert_config",
      details: `Alert-Konfiguration aktualisiert: Schwellwert ${config.varianceThreshold}%, Alerts ${config.alertsEnabled ? "aktiviert" : "deaktiviert"}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Alert config POST error:", error);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}
