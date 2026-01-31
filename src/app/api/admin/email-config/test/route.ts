import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../lib/auth";
import { getAsync } from "../../../../../lib/db";

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

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "E-Mail-Adresse erforderlich" }, { status: 400 });
    }

    // Get email config
    const configRow = await getAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'email_config'"
    );

    if (!configRow?.value) {
      return NextResponse.json({ error: "E-Mail-Konfiguration nicht gefunden" }, { status: 400 });
    }

    let config: EmailConfig;
    try {
      config = JSON.parse(configRow.value);
    } catch {
      return NextResponse.json({ error: "Ungültige Konfiguration" }, { status: 400 });
    }

    if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
      return NextResponse.json({ error: "SMTP-Konfiguration unvollständig" }, { status: 400 });
    }

    // Note: Actual email sending would require nodemailer or similar
    // For now, we simulate success if config looks valid
    console.log(`[TEST EMAIL] Would send to: ${email}`);
    console.log(`[TEST EMAIL] From: ${config.fromName} <${config.fromAddress}>`);
    console.log(`[TEST EMAIL] Via: ${config.smtpHost}:${config.smtpPort}`);

    // TODO: Implement actual email sending with nodemailer
    // const nodemailer = await import("nodemailer");
    // const transporter = nodemailer.createTransport({
    //   host: config.smtpHost,
    //   port: config.smtpPort,
    //   secure: config.smtpPort === 465,
    //   auth: { user: config.smtpUser, pass: config.smtpPass },
    // });
    // await transporter.sendMail({
    //   from: `"${config.fromName}" <${config.fromAddress}>`,
    //   to: email,
    //   subject: "Test E-Mail - Group Dashboard",
    //   html: "<h1>Test erfolgreich!</h1><p>Diese Test-E-Mail wurde vom Group Dashboard gesendet.</p>",
    // });

    return NextResponse.json({ 
      success: true, 
      message: `Test-E-Mail konfiguriert für ${email} (Hinweis: nodemailer muss noch installiert werden für tatsächlichen Versand)` 
    });
  } catch (error) {
    console.error("Email test error:", error);
    return NextResponse.json({ error: "Test fehlgeschlagen: " + String(error) }, { status: 500 });
  }
}
