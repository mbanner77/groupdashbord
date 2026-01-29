import { NextResponse } from "next/server";
import { allAsync } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const years = await allAsync<{ year: number }>(
      "SELECT DISTINCT year FROM values_monthly ORDER BY year DESC"
    );
    
    const yearList = years.map((r) => r.year);
    
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
  } catch (error) {
    console.error("Years API error:", error);
    const currentYear = new Date().getFullYear();
    return NextResponse.json({
      available: [],
      all: Array.from({ length: 11 }, (_, i) => currentYear + 5 - i),
      current: currentYear,
    });
  }
}
