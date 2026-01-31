import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentUser } from "../../../../lib/auth";
import { execAsync, getAsync, allAsync } from "../../../../lib/db";
import { logAudit } from "../../../../lib/audit";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const sheetName = formData.get("sheet") as string;
    const year = parseInt(formData.get("year") as string);

    if (!file || !sheetName || !year) {
      return NextResponse.json({ error: "Datei, Sheet und Jahr sind erforderlich" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return NextResponse.json({ 
        error: `Sheet "${sheetName}" nicht gefunden. Verfügbar: ${workbook.SheetNames.join(", ")}` 
      }, { status: 400 });
    }

    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
    
    // Get KPI based on sheet
    let kpiCode = "umsatz";
    let area = "Umsatz";
    if (sheetName.toLowerCase() === "ertrag") {
      kpiCode = "ebit";
      area = "Ertrag";
    } else if (sheetName.toLowerCase() === "headcount") {
      kpiCode = "headcount";
      area = "Headcount";
    }

    const kpi = await getAsync<{ id: number }>(
      "SELECT id FROM kpis WHERE code = $1 AND area = $2",
      [kpiCode, area]
    );

    if (!kpi) {
      return NextResponse.json({ error: `KPI ${kpiCode} nicht gefunden` }, { status: 400 });
    }

    const entities = await allAsync<{ id: number; code: string; display_name: string }>(
      "SELECT id, code, display_name FROM entities"
    );

    const entityMap = new Map(entities.map(e => [e.display_name.toLowerCase(), e]));
    const monthCols = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]; // C-N (0-indexed)

    let importedCount = 0;
    const now = new Date().toISOString();

    for (let rowIdx = 4; rowIdx < data.length; rowIdx++) {
      const row = data[rowIdx];
      if (!row || row.length < 3) continue;

      const entityName = String(row[0] || "").trim().toLowerCase();
      const rowLabel = String(row[1] || "").trim().toLowerCase();
      
      const entity = entityMap.get(entityName);
      if (!entity) continue;

      // Determine scenario from row label
      let scenario: string | null = null;
      if (rowLabel.includes("plan")) scenario = "plan";
      else if (rowLabel.includes("ist") || rowLabel.includes("fc")) scenario = "ist";
      else if (rowLabel.includes("vorjahr")) scenario = "prior_year";
      
      if (!scenario) continue;

      for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
        const colIdx = monthCols[monthIdx];
        const value = row[colIdx];
        
        if (value === undefined || value === null || value === "") continue;
        
        const numValue = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
        if (isNaN(numValue)) continue;

        await execAsync(
          `INSERT INTO values_monthly (year, month, entity_id, kpi_id, scenario, value, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (year, month, entity_id, kpi_id, scenario) 
           DO UPDATE SET value = $6, updated_at = $7`,
          [year, monthIdx + 1, entity.id, kpi.id, scenario, numValue, now]
        );
        importedCount++;
      }
    }

    await logAudit({
      userId: user.id,
      username: user.username,
      action: "import",
      entityType: "value",
      details: `Excel-Import: ${sheetName} ${year}, ${importedCount} Werte importiert`,
    });

    return NextResponse.json({ 
      success: true, 
      message: `${importedCount} Werte erfolgreich importiert`,
      importedCount 
    });
  } catch (error) {
    console.error("Excel import error:", error);
    return NextResponse.json({ error: "Import fehlgeschlagen: " + String(error) }, { status: 500 });
  }
}
