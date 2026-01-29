import { NextResponse } from "next/server";
import crypto from "crypto";
import { allAsync, getAsync, execAsync } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// GET all users (admin only)
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const users = await allAsync<{
      id: number;
      username: string;
      display_name: string;
      role: string;
      is_active: number;
      created_at: string;
    }>("SELECT id, username, display_name, role, is_active, created_at FROM users ORDER BY created_at DESC");

    return NextResponse.json(users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      role: u.role,
      isActive: u.is_active === 1,
      createdAt: u.created_at,
    })));
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json({ error: "Server-Fehler" }, { status: 500 });
  }
}

// POST create new user (admin only)
export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const body = await request.json();
    const { username, password, displayName, role = "user" } = body;

    if (!username || !password || !displayName) {
      return NextResponse.json({ error: "Alle Felder sind erforderlich" }, { status: 400 });
    }

    // Check if username exists
    const existing = await getAsync<{ id: number }>("SELECT id FROM users WHERE username = $1", [username]);
    if (existing) {
      return NextResponse.json({ error: "Benutzername existiert bereits" }, { status: 400 });
    }

    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();

    await execAsync(
      "INSERT INTO users (username, password_hash, display_name, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [username, passwordHash, displayName, role, 1, now, now]
    );

    const newUser = await getAsync<{ id: number }>("SELECT id FROM users WHERE username = $1", [username]);

    return NextResponse.json({ success: true, userId: newUser?.id });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json({ error: "Server-Fehler" }, { status: 500 });
  }
}
