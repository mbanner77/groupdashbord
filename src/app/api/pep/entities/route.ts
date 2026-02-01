import { NextResponse } from "next/server";
import { allAsync } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const entities = await allAsync<{ id: number; code: string; display_name: string }>(
      "SELECT id, code, display_name FROM entities WHERE is_aggregate = 0 ORDER BY display_name"
    );
    return NextResponse.json(entities);
  } catch (e: unknown) {
    console.error("Entities GET error:", e);
    return NextResponse.json([]);
  }
}
