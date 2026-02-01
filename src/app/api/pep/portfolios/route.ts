import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { cookies } from "next/headers";

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  
  const db = await getDb();
  const session = db.get<{ user_id: number; expires_at: string }>(
    "SELECT user_id, expires_at FROM sessions WHERE token = $1",
    [token]
  );
  if (!session || new Date(session.expires_at) < new Date()) return null;
  
  const user = db.get<{ id: number; username: string; role: string }>(
    "SELECT id, username, role FROM users WHERE id = $1",
    [session.user_id]
  );
  return user;
}

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  
  try {
    const portfolios = db.all<{
      id: number;
      code: string;
      display_name: string;
      description: string | null;
      color: string;
      is_active: number;
    }>("SELECT id, code, display_name, description, color, is_active FROM portfolios ORDER BY display_name");

    return NextResponse.json(portfolios);
  } catch (e: unknown) {
    // Table might not exist yet - return empty array
    console.error("Portfolio GET error:", e);
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { code, display_name, description, color } = body;

  if (!code || !display_name) {
    return NextResponse.json({ error: "Code and display_name are required" }, { status: 400 });
  }

  const db = await getDb();
  const now = new Date().toISOString();

  try {
    // Ensure table exists
    await db.exec(`
      CREATE TABLE IF NOT EXISTS portfolios (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#0ea5e9',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await db.exec(
      `INSERT INTO portfolios (code, display_name, description, color, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 1, $5, $5)`,
      [code, display_name, description || null, color || "#0ea5e9", now]
    );
    await db.save();

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Portfolio POST error:", message);
    // Better error messages
    if (message.includes("unique") || message.includes("duplicate")) {
      return NextResponse.json({ error: `Portfolio mit Code "${code}" existiert bereits` }, { status: 400 });
    }
    return NextResponse.json({ error: `Fehler beim Speichern: ${message}` }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, code, display_name, description, color, is_active } = body;

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const db = await getDb();
  const now = new Date().toISOString();

  try {
    await db.exec(
      `UPDATE portfolios SET code = $1, display_name = $2, description = $3, color = $4, is_active = $5, updated_at = $6 WHERE id = $7`,
      [code, display_name, description || null, color || "#0ea5e9", is_active ? 1 : 0, now, id]
    );
    await db.save();

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const db = await getDb();

  try {
    await db.exec("DELETE FROM portfolios WHERE id = $1", [Number(id)]);
    await db.save();

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
