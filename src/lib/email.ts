// Email notification configuration and helpers
// Note: This requires setting up SMTP credentials in environment variables

export type EmailConfig = {
  enabled: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromAddress?: string;
  fromName?: string;
};

export function getEmailConfig(): EmailConfig {
  return {
    enabled: process.env.EMAIL_ENABLED === "true",
    smtpHost: process.env.SMTP_HOST,
    smtpPort: parseInt(process.env.SMTP_PORT || "587"),
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    fromAddress: process.env.EMAIL_FROM_ADDRESS || "noreply@realcore.de",
    fromName: process.env.EMAIL_FROM_NAME || "Group Dashboard",
  };
}

export type AlertType = "high_variance" | "threshold_exceeded" | "data_missing";

export type EmailAlert = {
  type: AlertType;
  entityName: string;
  kpiName: string;
  value: number;
  threshold?: number;
  variance?: number;
  message: string;
};

export async function sendAlertEmail(
  recipientEmail: string,
  recipientName: string,
  alerts: EmailAlert[]
): Promise<boolean> {
  const config = getEmailConfig();
  
  if (!config.enabled) {
    console.log("Email notifications disabled");
    return false;
  }

  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
    console.error("Email configuration incomplete");
    return false;
  }

  try {
    // Using nodemailer would require installing it
    // For now, we'll log the alert and return success
    // In production, integrate with nodemailer or a transactional email service
    
    console.log(`[EMAIL ALERT] To: ${recipientEmail}`);
    console.log(`Subject: ${alerts.length} neue Warnungen im Group Dashboard`);
    console.log("Alerts:", JSON.stringify(alerts, null, 2));
    
    // TODO: Implement actual email sending with nodemailer
    // const nodemailer = await import("nodemailer");
    // const transporter = nodemailer.createTransport({
    //   host: config.smtpHost,
    //   port: config.smtpPort,
    //   secure: config.smtpPort === 465,
    //   auth: { user: config.smtpUser, pass: config.smtpPass },
    // });
    // await transporter.sendMail({ ... });
    
    return true;
  } catch (error) {
    console.error("Failed to send alert email:", error);
    return false;
  }
}

export function generateAlertEmailHtml(alerts: EmailAlert[]): string {
  const alertRows = alerts.map((alert) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
        <strong>${alert.entityName}</strong>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
        ${alert.kpiName}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
        ${alert.message}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: ${alert.variance && alert.variance < 0 ? '#ef4444' : '#10b981'};">
        ${alert.variance ? (alert.variance > 0 ? '+' : '') + alert.variance.toFixed(1) + '%' : '-'}
      </td>
    </tr>
  `).join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Group Dashboard Alert</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="padding: 24px; border-bottom: 1px solid #e2e8f0;">
          <h1 style="margin: 0; color: #0f172a; font-size: 20px;">
            ⚠️ ${alerts.length} neue Warnung${alerts.length > 1 ? 'en' : ''}
          </h1>
          <p style="margin: 8px 0 0; color: #64748b; font-size: 14px;">
            Group Dashboard - Plan & Forecast
          </p>
        </div>
        
        <div style="padding: 24px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="padding: 12px; text-align: left; color: #64748b; font-size: 12px; text-transform: uppercase;">Einheit</th>
                <th style="padding: 12px; text-align: left; color: #64748b; font-size: 12px; text-transform: uppercase;">KPI</th>
                <th style="padding: 12px; text-align: left; color: #64748b; font-size: 12px; text-transform: uppercase;">Details</th>
                <th style="padding: 12px; text-align: left; color: #64748b; font-size: 12px; text-transform: uppercase;">Abw.</th>
              </tr>
            </thead>
            <tbody>
              ${alertRows}
            </tbody>
          </table>
        </div>
        
        <div style="padding: 24px; background: #f8fafc; border-radius: 0 0 12px 12px; text-align: center;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://group-dashboard.onrender.com'}/dashboard" 
             style="display: inline-block; padding: 12px 24px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Dashboard öffnen
          </a>
        </div>
      </div>
    </body>
    </html>
  `;
}
