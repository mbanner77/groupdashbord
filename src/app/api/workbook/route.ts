import { NextResponse } from "next/server";
import { z } from "zod";
import { getForecastCutoffMonth } from "../../../lib/settings";
import { getWorkbookSheet } from "../../../lib/workbook";
import { getCurrentUser, getViewableEntities } from "../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(request: Request) {
  try {
    // Auth check
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const viewableEntities = await getViewableEntities(user.id, user.role);

    const url = new URL(request.url);

    const schema = z.object({
      sheet: z.enum(["Umsatz", "Ertrag", "Headcount"]),
      year: z.coerce.number().int().min(2000).max(2100).default(2025),
      cutoffMonth: z.coerce.number().int().min(1).max(12).optional()
    });

    const parsed = schema.safeParse({
      sheet: url.searchParams.get("sheet"),
      year: url.searchParams.get("year") ?? undefined,
      cutoffMonth: url.searchParams.get("cutoffMonth") ?? undefined
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "invalid query" }, { status: 400 });
    }

    const cutoffMonth = parsed.data.cutoffMonth ?? (await getForecastCutoffMonth());

    const result = await getWorkbookSheet({
      sheet: parsed.data.sheet,
      year: parsed.data.year,
      cutoffMonth
    });

    // Filter entities and lines based on permissions
    const filteredEntities = result.entities.filter(e => viewableEntities.includes(e.code));
    const filteredLines = result.lines.filter(l => viewableEntities.includes(l.entityCode));

    return NextResponse.json({
      ...result,
      entities: filteredEntities,
      lines: filteredLines,
    });
  } catch (error) {
    console.error("Workbook API error:", error);
    return NextResponse.json({ error: "Failed to load workbook" }, { status: 500 });
  }
}
