import { NextResponse } from "next/server";
import { z } from "zod";
import { getForecastCutoffMonth, setForecastCutoffMonth } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const cutoffMonth = await getForecastCutoffMonth();
  return NextResponse.json({ cutoffMonth });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);

  const schema = z.object({ month: z.number().int().min(1).max(12) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  await setForecastCutoffMonth(parsed.data.month);
  return NextResponse.json({ ok: true, cutoffMonth: parsed.data.month });
}
