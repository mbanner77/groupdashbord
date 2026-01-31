import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { allAsync, execAsync, getAsync } from "../../../lib/db";
import { logAudit } from "../../../lib/audit";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const year = searchParams.get("year");
    const kpiId = searchParams.get("kpiId");

    let query = `
      SELECT c.*, u.display_name as author_name, e.display_name as entity_name, k.display_name as kpi_name
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN entities e ON c.entity_id = e.id
      LEFT JOIN kpis k ON c.kpi_id = k.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (entityId) {
      params.push(parseInt(entityId));
      query += ` AND c.entity_id = $${params.length}`;
    }
    if (year) {
      params.push(parseInt(year));
      query += ` AND c.year = $${params.length}`;
    }
    if (kpiId) {
      params.push(parseInt(kpiId));
      query += ` AND c.kpi_id = $${params.length}`;
    }

    query += " ORDER BY c.created_at DESC";

    const comments = await allAsync<{
      id: number;
      user_id: number;
      entity_id: number;
      kpi_id: number | null;
      year: number;
      month: number | null;
      content: string;
      created_at: string;
      updated_at: string;
      author_name: string;
      entity_name: string;
      kpi_name: string | null;
    }>(query, params);

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Comments fetch error:", error);
    return NextResponse.json({ error: "Fehler beim Laden der Kommentare" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { entityId, kpiId, year, month, content } = await request.json();

    if (!entityId || !year || !content) {
      return NextResponse.json({ error: "Entity, Jahr und Inhalt sind erforderlich" }, { status: 400 });
    }

    const now = new Date().toISOString();

    await execAsync(
      `INSERT INTO comments (user_id, entity_id, kpi_id, year, month, content, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [user.id, entityId, kpiId || null, year, month || null, content, now, now]
    );

    const entity = await getAsync<{ display_name: string }>(
      "SELECT display_name FROM entities WHERE id = $1",
      [entityId]
    );

    await logAudit({
      userId: user.id,
      username: user.username,
      action: "create",
      entityType: "comment",
      entityId,
      entityName: entity?.display_name,
      details: `Kommentar für ${year}${month ? `/${month}` : ""}: ${content.substring(0, 50)}...`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Comment create error:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen des Kommentars" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID erforderlich" }, { status: 400 });
    }

    // Check ownership or admin
    const comment = await getAsync<{ user_id: number }>(
      "SELECT user_id FROM comments WHERE id = $1",
      [parseInt(id)]
    );

    if (!comment) {
      return NextResponse.json({ error: "Kommentar nicht gefunden" }, { status: 404 });
    }

    if (comment.user_id !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    await execAsync("DELETE FROM comments WHERE id = $1", [parseInt(id)]);

    await logAudit({
      userId: user.id,
      username: user.username,
      action: "delete",
      entityType: "comment",
      entityId: parseInt(id),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Comment delete error:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
