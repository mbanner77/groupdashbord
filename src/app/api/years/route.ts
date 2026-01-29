import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  
  const years = db.all<{ year: number }>(
    "SELECT DISTINCT year FROM values_monthly ORDER BY year DESC"
  );
  
  const yearList = years.map((r) => r.year);
  
  // Add future years for planning (current year + 5)
  const currentYear = new Date().getFullYear();
  const maxYear = Math.max(...yearList, currentYear) + 5;
  const minYear = Math.min(...yearList, currentYear - 5);
  
  const allYears: number[] = [];
  for (let y = maxYear; y >= minYear; y--) {
    allYears.push(y);
  }
  
  return NextResponse.json({
    available: yearList,
    all: allYears,
    current: currentYear,
  });
}
