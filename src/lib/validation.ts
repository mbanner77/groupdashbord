export type ValidationWarning = {
  type: "high_variance" | "zero_value" | "negative_value" | "missing_data" | "unusual_change";
  severity: "info" | "warning" | "error";
  message: string;
  entityCode?: string;
  kpiCode?: string;
  month?: number;
  value?: number;
};

export function validateValue(params: {
  value: number;
  planValue?: number;
  priorValue?: number;
  entityName: string;
  kpiName: string;
  month: number;
}): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const { value, planValue, priorValue, entityName, kpiName, month } = params;

  // Check for negative values (only warning for non-EBIT)
  if (value < 0 && !kpiName.toLowerCase().includes("ebit")) {
    warnings.push({
      type: "negative_value",
      severity: "warning",
      message: `Negativer Wert für ${entityName} im ${getMonthName(month)}`,
      month,
      value,
    });
  }

  // Check for high variance vs plan (>20%)
  if (planValue && planValue !== 0) {
    const variance = ((value - planValue) / Math.abs(planValue)) * 100;
    if (Math.abs(variance) > 20) {
      warnings.push({
        type: "high_variance",
        severity: variance > 30 ? "error" : "warning",
        message: `Hohe Abweichung (${variance.toFixed(1)}%) vom Plan für ${entityName}`,
        month,
        value,
      });
    }
  }

  // Check for unusual change vs prior year (>50%)
  if (priorValue && priorValue !== 0) {
    const change = ((value - priorValue) / Math.abs(priorValue)) * 100;
    if (Math.abs(change) > 50) {
      warnings.push({
        type: "unusual_change",
        severity: "info",
        message: `Große Veränderung (${change.toFixed(1)}%) zum Vorjahr für ${entityName}`,
        month,
        value,
      });
    }
  }

  return warnings;
}

export function validateDataset(data: {
  entities: { code: string; name: string }[];
  values: Map<string, number[]>; // entityCode -> 12 months
  planValues?: Map<string, number[]>;
  priorValues?: Map<string, number[]>;
  kpiName: string;
}): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const { entities, values, planValues, priorValues, kpiName } = data;

  for (const entity of entities) {
    const entityValues = values.get(entity.code);
    if (!entityValues) {
      warnings.push({
        type: "missing_data",
        severity: "error",
        message: `Keine Daten für ${entity.name}`,
        entityCode: entity.code,
      });
      continue;
    }

    // Check for all zeros
    if (entityValues.every(v => v === 0)) {
      warnings.push({
        type: "zero_value",
        severity: "warning",
        message: `Alle Werte sind 0 für ${entity.name}`,
        entityCode: entity.code,
      });
    }

    // Validate each month
    for (let month = 1; month <= 12; month++) {
      const value = entityValues[month - 1] ?? 0;
      const planValue = planValues?.get(entity.code)?.[month - 1];
      const priorValue = priorValues?.get(entity.code)?.[month - 1];

      const monthWarnings = validateValue({
        value,
        planValue,
        priorValue,
        entityName: entity.name,
        kpiName,
        month,
      });

      warnings.push(...monthWarnings);
    }
  }

  return warnings;
}

function getMonthName(month: number): string {
  const months = ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  return months[month - 1] || String(month);
}

export function getValidationSummary(warnings: ValidationWarning[]): {
  errors: number;
  warnings: number;
  infos: number;
} {
  return {
    errors: warnings.filter(w => w.severity === "error").length,
    warnings: warnings.filter(w => w.severity === "warning").length,
    infos: warnings.filter(w => w.severity === "info").length,
  };
}
