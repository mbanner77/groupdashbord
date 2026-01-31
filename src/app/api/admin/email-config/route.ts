import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { getAsync, execAsync } from "../../../../lib/db";
import { logAudit } from "../../../../lib/audit";

type EmailConfig = {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromAddress: string;
  fromName: string;
  useTls: boolean;
};

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const configRow = await getAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'email_config'"
    );

    let config: EmailConfig = {
      enabled: false,
      smtpHost: "",
      smtpPort: 587,
      smtpUser: "",
      smtpPass: "",
      fromAddress: "",
      fromName: "Group Dashboard",
      useTls: true,
    };

    if (configRow?.value) {
      try {
        const parsed = JSON.parse(configRow.value);
        config = { ...config, ...parsed };
        // Don't expose password
        config.smtpPass = config.smtpPass ? "••••••••" : "";
      } catch {
        // Invalid JSON, use defaults
      }
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error("Email config GET error:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const config: EmailConfig = await request.json();

    // Get existing config to preserve password if not changed
    const existingRow = await getAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'email_config'"
    );

    let existingConfig: EmailConfig | null = null;
    if (existingRow?.value) {
      try {
        existingConfig = JSON.parse(existingRow.value);
      } catch {
        // Invalid JSON
      }
    }

    // If password is placeholder, keep existing password
    if (config.smtpPass === "••••••••" && existingConfig?.smtpPass) {
      config.smtpPass = existingConfig.smtpPass;
    }

    // Validate required fields if enabled
    if (config.enabled) {
      if (!config.smtpHost || !config.smtpPort) {
        return NextResponse.json({ error: "SMTP-Host und Port sind erforderlich" }, { status: 400 });
      }
    }

    await execAsync(
      `INSERT INTO settings (key, value) VALUES ('email_config', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [JSON.stringify(config)]
    );

    await logAudit({
      userId: user.id,
      username: user.username,
      action: "update",
      entityType: "settings",
      entityName: "email_config",
      details: `E-Mail-Konfiguration ${config.enabled ? "aktiviert" : "deaktiviert"}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email config POST error:", error);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}
