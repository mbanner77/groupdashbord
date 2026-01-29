import { NextResponse } from "next/server";
import { allAsync, execAsync } from "../../../../../../lib/db";
import { getCurrentUser } from "../../../../../../lib/auth";

export const dynamic = "force-dynamic";

// GET permissions for a user
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

    // Get all entities with user permissions
    const entities = await allAsync<{
      id: number;
      code: string;
      display_name: string;
      can_view: number | null;
      can_edit: number | null;
    }>(`
      SELECT e.id, e.code, e.display_name, 
             uep.can_view, uep.can_edit
      FROM entities e
      LEFT JOIN user_entity_permissions uep ON e.id = uep.entity_id AND uep.user_id = $1
      WHERE e.is_aggregate = 0
      ORDER BY e.display_name
    `, [userId]);

    return NextResponse.json(entities.map((e) => ({
      entityId: e.id,
      entityCode: e.code,
      entityName: e.display_name,
      canView: e.can_view === 1,
      canEdit: e.can_edit === 1,
    })));
  } catch (error) {
    console.error("Get permissions error:", error);
    return NextResponse.json({ error: "Server-Fehler" }, { status: 500 });
  }
}

// PUT update permissions for a user
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
    const { permissions } = body as { permissions: Array<{ entityId: number; canView: boolean; canEdit: boolean }> };

    // Delete existing permissions
    await execAsync("DELETE FROM user_entity_permissions WHERE user_id = $1", [userId]);

    // Insert new permissions
    for (const p of permissions) {
      if (p.canView || p.canEdit) {
        await execAsync(
          "INSERT INTO user_entity_permissions (user_id, entity_id, can_view, can_edit) VALUES ($1, $2, $3, $4)",
          [userId, p.entityId, p.canView ? 1 : 0, p.canEdit ? 1 : 0]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update permissions error:", error);
    return NextResponse.json({ error: "Server-Fehler" }, { status: 500 });
  }
}
