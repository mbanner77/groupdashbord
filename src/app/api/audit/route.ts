import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { allAsync } from "../../../lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");
    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");

    let query = "SELECT * FROM audit_log";
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (action) {
      conditions.push(`action = $${params.length + 1}`);
      params.push(action);
    }

    if (entityType) {
      conditions.push(`entity_type = $${params.length + 1}`);
      params.push(entityType);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const logs = await allAsync<{
      id: number;
      user_id: number | null;
      username: string;
      action: string;
      entity_type: string;
      entity_id: number | null;
      entity_name: string | null;
      old_value: string | null;
      new_value: string | null;
      details: string | null;
      created_at: string;
    }>(query, params);

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Audit log fetch error:", error);
    return NextResponse.json({ error: "Fehler beim Laden der Audit-Logs" }, { status: 500 });
  }
}
