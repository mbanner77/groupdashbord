import { NextResponse } from "next/server";
import { z } from "zod";
import { getForecastCutoffMonth } from "../../../lib/settings";
import { getDashboard } from "../../../lib/dashboard";
import { getCurrentUser, canUserViewEntity } from "../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Auth check
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const url = new URL(request.url);

    const schema = z.object({
      area: z.enum(["Umsatz", "Ertrag", "Headcount"]),
      entity: z.string().min(1),
      year: z.coerce.number().int().min(2000).max(2100).default(2025),
      cutoffMonth: z.coerce.number().int().min(1).max(12).optional()
    });

    const parsed = schema.safeParse({
      area: url.searchParams.get("area"),
      entity: url.searchParams.get("entity"),
      year: url.searchParams.get("year") ?? undefined,
      cutoffMonth: url.searchParams.get("cutoffMonth") ?? undefined
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "invalid query" }, { status: 400 });
    }

    // Check view permission
    const canView = await canUserViewEntity(user.id, parsed.data.entity, user.role);
    if (!canView) {
      return NextResponse.json({ error: "Keine Berechtigung für diese Entität" }, { status: 403 });
    }

    const cutoffMonth = parsed.data.cutoffMonth ?? (await getForecastCutoffMonth());

    const result = await getDashboard({
      area: parsed.data.area,
      entityCode: parsed.data.entity,
      year: parsed.data.year,
      cutoffMonth
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Server-Fehler" }, { status: 500 });
  }
}
