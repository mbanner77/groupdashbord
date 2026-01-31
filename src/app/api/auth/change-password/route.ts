import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { execAsync, getAsync } from "../../../../lib/db";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Alle Felder sind erforderlich" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Neues Passwort muss mindestens 8 Zeichen haben" }, { status: 400 });
    }

    // Verify current password
    const currentHash = crypto.createHash("sha256").update(currentPassword).digest("hex");
    const dbUser = await getAsync<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [user.id]
    );

    if (!dbUser || dbUser.password_hash !== currentHash) {
      return NextResponse.json({ error: "Aktuelles Passwort ist falsch" }, { status: 400 });
    }

    // Update password
    const newHash = crypto.createHash("sha256").update(newPassword).digest("hex");
    const now = new Date().toISOString();
    
    await execAsync(
      "UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3",
      [newHash, now, user.id]
    );

    return NextResponse.json({ success: true, message: "Passwort erfolgreich geändert" });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "Fehler beim Ändern des Passworts" }, { status: 500 });
  }
}
