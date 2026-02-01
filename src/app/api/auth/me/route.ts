import { NextResponse } from "next/server";
import { getCurrentUser, getViewableEntities, getUserPermissions } from "../../../../lib/auth";
import { allAsync } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const viewableEntityCodes = await getViewableEntities(user.id, user.role);
    
    // Get entity details for viewable entities
    let entities: Array<{ id: number; code: string; name: string; canEdit: boolean }> = [];
    
    if (user.role === "admin") {
      // Admin can see and edit all
      const allEntities = await allAsync<{ id: number; code: string; display_name: string }>(
        "SELECT id, code, display_name FROM entities WHERE is_aggregate = 0 ORDER BY display_name"
      );
      entities = allEntities.map(e => ({ id: e.id, code: e.code, name: e.display_name, canEdit: true }));
    } else {
      const permissions = await getUserPermissions(user.id);
      // Get entity IDs for non-admin users
      const entityIds = await allAsync<{ id: number; code: string }>(
        "SELECT id, code FROM entities"
      );
      const idMap = new Map(entityIds.map(e => [e.code, e.id]));
      entities = permissions
        .filter(p => p.canView)
        .map(p => ({ id: idMap.get(p.entityCode) || 0, code: p.entityCode, name: p.entityName, canEdit: p.canEdit }));
    }

    return NextResponse.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      isAdmin: user.role === "admin",
      entities,
      viewableEntityCodes,
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ error: "Server-Fehler" }, { status: 500 });
  }
}
