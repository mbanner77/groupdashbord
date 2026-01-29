import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getAsync, execAsync } from "../../../../lib/db";

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Benutzername und Passwort erforderlich" },
        { status: 400 }
      );
    }

    const passwordHash = hashPassword(password);
    const user = await getAsync<{ id: number; username: string; display_name: string; role: string; is_active: number }>(
      "SELECT id, username, display_name, role, is_active FROM users WHERE username = $1 AND password_hash = $2",
      [username, passwordHash]
    );

    if (!user) {
      return NextResponse.json(
        { error: "Ungültige Anmeldedaten" },
        { status: 401 }
      );
    }

    if (user.is_active !== 1) {
      return NextResponse.json(
        { error: "Benutzer ist deaktiviert" },
        { status: 403 }
      );
    }

    const sessionToken = generateSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE * 1000).toISOString();

    // Store session in database
    await execAsync(
      "INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES ($1, $2, $3, $4)",
      [user.id, sessionToken, expiresAt, now.toISOString()]
    );
    
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return NextResponse.json({ 
      success: true, 
      username: user.username,
      displayName: user.display_name,
      role: user.role
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Server-Fehler" }, { status: 500 });
  }
}
