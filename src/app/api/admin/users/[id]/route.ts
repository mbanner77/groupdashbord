import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAsync, execAsync } from "../../../../../lib/db";
import { getCurrentUser } from "../../../../../lib/auth";

export const dynamic = "force-dynamic";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// GET single user
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);

    const user = await getAsync<{
      id: number;
      username: string;
      display_name: string;
      role: string;
      is_active: number;
    }>("SELECT id, username, display_name, role, is_active FROM users WHERE id = $1", [userId]);

    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      isActive: user.is_active === 1,
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ error: "Server-Fehler" }, { status: 500 });
  }
}

// PUT update user
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    const body = await request.json();
    const { displayName, role, isActive, password } = body;

    const existingUser = await getAsync<{ id: number }>("SELECT id FROM users WHERE id = $1", [userId]);
    if (!existingUser) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (password) {
      const passwordHash = hashPassword(password);
      await execAsync(
        "UPDATE users SET display_name = $1, role = $2, is_active = $3, password_hash = $4, updated_at = $5 WHERE id = $6",
        [displayName, role, isActive ? 1 : 0, passwordHash, now, userId]
      );
    } else {
      await execAsync(
        "UPDATE users SET display_name = $1, role = $2, is_active = $3, updated_at = $4 WHERE id = $5",
        [displayName, role, isActive ? 1 : 0, now, userId]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Server-Fehler" }, { status: 500 });
  }
}

// DELETE user
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);

    // Prevent deleting self
    if (currentUser.id === userId) {
      return NextResponse.json({ error: "Sie können sich nicht selbst löschen" }, { status: 400 });
    }

    await execAsync("DELETE FROM users WHERE id = $1", [userId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Server-Fehler" }, { status: 500 });
  }
}
