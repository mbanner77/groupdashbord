import { execAsync } from "./db";

export type AuditAction = 
  | "login" 
  | "logout" 
  | "create" 
  | "update" 
  | "delete" 
  | "import" 
  | "export";

export type EntityType = 
  | "user" 
  | "entity" 
  | "kpi" 
  | "value" 
  | "permission" 
  | "comment" 
  | "settings";

interface AuditLogEntry {
  userId: number | null;
  username: string;
  action: AuditAction;
  entityType: EntityType;
  entityId?: number;
  entityName?: string;
  oldValue?: string;
  newValue?: string;
  details?: string;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const now = new Date().toISOString();
    await execAsync(
      `INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, entity_name, old_value, new_value, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        entry.userId,
        entry.username,
        entry.action,
        entry.entityType,
        entry.entityId || null,
        entry.entityName || null,
        entry.oldValue || null,
        entry.newValue || null,
        entry.details || null,
        now,
      ]
    );
  } catch (error) {
    console.error("Audit log error:", error);
  }
}
