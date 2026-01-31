import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getWorkbookSheet } from "../../../../lib/workbook";
import { getCurrentUser } from "../../../../lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sheet = searchParams.get("sheet") || "Umsatz";
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const cutoffMonth = parseInt(searchParams.get("cutoffMonth") || "12");

    const data = await getWorkbookSheet({
      sheet: sheet as "Umsatz" | "Ertrag" | "Headcount",
      year,
      cutoffMonth,
    });

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Prepare data for Excel
    const headers = ["Einheit", "Zeile", "JAN", "FEB", "MRZ", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"];
    
    const rows = data.lines.map(line => [
      line.entityName,
      line.label,
      ...line.values.map(v => v ?? 0)
    ]);

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws["!cols"] = [
      { wch: 15 }, // Einheit
      { wch: 25 }, // Zeile
      ...Array(12).fill({ wch: 12 }) // Months
    ];

    XLSX.utils.book_append_sheet(wb, ws, sheet);

    // Generate buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Return as file download
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${sheet}_${year}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Excel export error:", error);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
