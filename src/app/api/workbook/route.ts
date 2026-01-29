import { NextResponse } from "next/server";
import { z } from "zod";
import { getForecastCutoffMonth } from "../../../lib/settings";
import { getWorkbookSheet } from "../../../lib/workbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(request: Request) {
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

  return NextResponse.json(result);
}
