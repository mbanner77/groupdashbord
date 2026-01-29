import { cookies } from "next/headers";
import { getAsync, allAsync } from "./db";

export type User = {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "user";
  isActive: boolean;
};

export type UserWithPermissions = User & {
  permissions: {
    entityId: number;
    entityCode: string;
    entityName: string;
    canView: boolean;
    canEdit: boolean;
  }[];
};

export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;
    
    if (!sessionToken) return null;

    const session = await getAsync<{ user_id: number; expires_at: string }>(
      "SELECT user_id, expires_at FROM sessions WHERE token = $1",
      [sessionToken]
    );

    if (!session) return null;

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      return null;
    }

    const user = await getAsync<{ id: number; username: string; display_name: string; role: string; is_active: number }>(
      "SELECT id, username, display_name, role, is_active FROM users WHERE id = $1",
      [session.user_id]
    );

    if (!user || user.is_active !== 1) return null;

    return {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role as "admin" | "user",
      isActive: user.is_active === 1,
    };
  } catch {
    return null;
  }
}

export async function getUserPermissions(userId: number): Promise<UserWithPermissions["permissions"]> {
  const permissions = await allAsync<{
    entity_id: number;
    entity_code: string;
    entity_name: string;
    can_view: number;
    can_edit: number;
  }>(
    `SELECT uep.entity_id, e.code as entity_code, e.display_name as entity_name, 
            uep.can_view, uep.can_edit
     FROM user_entity_permissions uep
     JOIN entities e ON uep.entity_id = e.id
     WHERE uep.user_id = $1`,
    [userId]
  );

  return permissions.map((p) => ({
    entityId: p.entity_id,
    entityCode: p.entity_code,
    entityName: p.entity_name,
    canView: p.can_view === 1,
    canEdit: p.can_edit === 1,
  }));
}

export async function canUserViewEntity(userId: number, entityCode: string, userRole: string): Promise<boolean> {
  // Admins can view everything
  if (userRole === "admin") return true;

  const permission = await getAsync<{ can_view: number }>(
    `SELECT uep.can_view FROM user_entity_permissions uep
     JOIN entities e ON uep.entity_id = e.id
     WHERE uep.user_id = $1 AND e.code = $2`,
    [userId, entityCode]
  );

  return permission?.can_view === 1;
}

export async function canUserEditEntity(userId: number, entityCode: string, userRole: string): Promise<boolean> {
  // Admins can edit everything
  if (userRole === "admin") return true;

  const permission = await getAsync<{ can_edit: number }>(
    `SELECT uep.can_edit FROM user_entity_permissions uep
     JOIN entities e ON uep.entity_id = e.id
     WHERE uep.user_id = $1 AND e.code = $2`,
    [userId, entityCode]
  );

  return permission?.can_edit === 1;
}

export async function getViewableEntities(userId: number, userRole: string): Promise<string[]> {
  // Admins can view all entities
  if (userRole === "admin") {
    const entities = await allAsync<{ code: string }>("SELECT code FROM entities");
    return entities.map((e) => e.code);
  }

  const permissions = await allAsync<{ entity_code: string }>(
    `SELECT e.code as entity_code FROM user_entity_permissions uep
     JOIN entities e ON uep.entity_id = e.id
     WHERE uep.user_id = $1 AND uep.can_view = 1`,
    [userId]
  );

  return permissions.map((p) => p.entity_code);
}
