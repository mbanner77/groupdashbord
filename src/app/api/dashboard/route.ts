import { NextResponse } from "next/server";
import { z } from "zod";
import { getForecastCutoffMonth } from "../../../lib/settings";
import { getDashboard } from "../../../lib/dashboard";

export const runtime = "nodejs";

export async function GET(request: Request) {
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

  const cutoffMonth = parsed.data.cutoffMonth ?? (await getForecastCutoffMonth());

  const result = await getDashboard({
    area: parsed.data.area,
    entityCode: parsed.data.entity,
    year: parsed.data.year,
    cutoffMonth
  });

  return NextResponse.json(result);
}
