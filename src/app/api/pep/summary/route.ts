import { NextRequest, NextResponse } from "next/server";
import { allAsync } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";

// Working days per month (approximate)
const WORKING_DAYS_PER_MONTH = [22, 20, 23, 21, 22, 21, 23, 22, 22, 23, 21, 20];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year")) || new Date().getFullYear();
  const entityId = searchParams.get("entityId");
  const portfolioId = searchParams.get("portfolioId");

  try {
    // Get all employees with their planning data
    let employeeQuery = `
      SELECT 
        e.id as employee_id,
        e.first_name,
        e.last_name,
        e.entity_id,
        e.weekly_hours,
        e.hourly_rate,
        en.code as entity_code,
        en.display_name as entity_name
      FROM employees e
      JOIN entities en ON en.id = e.entity_id
      WHERE e.is_active = 1
    `;
    const employeeParams: (string | number)[] = [];

    if (entityId) {
      employeeQuery += " AND e.entity_id = $1";
      employeeParams.push(Number(entityId));
    }

    if (portfolioId) {
      // Filter by monthly planning portfolio assignment instead of static employee_portfolios
      employeeQuery += ` AND EXISTS (SELECT 1 FROM pep_planning pp WHERE pp.employee_id = e.id AND pp.year = $${employeeParams.length + 1} AND pp.portfolio_id = $${employeeParams.length + 2})`;
      employeeParams.push(year);
      employeeParams.push(Number(portfolioId));
    }

    const employees = await allAsync<{
      employee_id: number;
      first_name: string;
      last_name: string;
      entity_id: number;
      weekly_hours: number;
      hourly_rate: number | null;
      entity_code: string;
      entity_name: string;
    }>(employeeQuery, employeeParams);

    // Get planning data for all employees
    const planningQuery = `
      SELECT 
        pp.employee_id,
        pp.month,
        pp.portfolio_id,
        p.code as portfolio_code,
        p.display_name as portfolio_name,
        p.color as portfolio_color,
        pp.target_revenue,
        pp.forecast_percent,
        pp.vacation_days,
        pp.internal_days,
        pp.sick_days,
        pp.training_days,
        COALESCE(pa.actual_revenue, 0) as actual_revenue,
        COALESCE(pa.billable_hours, 0) as billable_hours
      FROM pep_planning pp
      LEFT JOIN pep_actuals pa ON pa.employee_id = pp.employee_id AND pa.year = pp.year AND pa.month = pp.month
      LEFT JOIN portfolios p ON p.id = pp.portfolio_id
      WHERE pp.year = $1
    `;
    const planningData = await allAsync<{
      employee_id: number;
      month: number;
      portfolio_id: number | null;
      portfolio_code: string | null;
      portfolio_name: string | null;
      portfolio_color: string | null;
      target_revenue: number;
      forecast_percent: number;
      vacation_days: number;
      internal_days: number;
      sick_days: number;
      training_days: number;
      actual_revenue: number;
      billable_hours: number;
    }>(planningQuery, [year]);

    // Get portfolio assignments
    const portfolioAssignments = await allAsync<{
      employee_id: number;
      portfolio_id: number;
      portfolio_code: string;
      portfolio_name: string;
      portfolio_color: string;
      allocation_percent: number;
    }>(`
      SELECT ep.employee_id, ep.portfolio_id, p.code as portfolio_code, p.display_name as portfolio_name, p.color as portfolio_color, ep.allocation_percent
      FROM employee_portfolios ep
      JOIN portfolios p ON p.id = ep.portfolio_id
      WHERE p.is_active = 1
    `);

  // Calculate summary per employee
  const employeeSummary = employees.map(emp => {
    let empPlanning = planningData.filter(p => p.employee_id === emp.employee_id);
    const empPortfolios = portfolioAssignments.filter(p => p.employee_id === emp.employee_id);
    
    // Filter by portfolio if portfolioId is set
    if (portfolioId) {
      empPlanning = empPlanning.filter(p => p.portfolio_id === Number(portfolioId));
    }
    
    // Calculate totals
    let totalTargetRevenue = 0;
    let totalForecastRevenue = 0;
    let totalActualRevenue = 0;
    let totalAvailableDays = 0;
    let totalPlannedAbsence = 0;
    let totalBillableHours = 0;

    for (let month = 1; month <= 12; month++) {
      const monthData = empPlanning.find(p => p.month === month);
      const workingDays = WORKING_DAYS_PER_MONTH[month - 1];
      
      if (monthData) {
        totalTargetRevenue += monthData.target_revenue;
        totalForecastRevenue += monthData.target_revenue * (monthData.forecast_percent / 100);
        totalActualRevenue += monthData.actual_revenue;
        totalPlannedAbsence += monthData.vacation_days + monthData.internal_days + monthData.sick_days + monthData.training_days;
        totalBillableHours += monthData.billable_hours;
        totalAvailableDays += workingDays;
      } else if (!portfolioId) {
        totalAvailableDays += workingDays;
      }
    }

    const netAvailableDays = totalAvailableDays - totalPlannedAbsence;
    const dailyHours = emp.weekly_hours / 5;
    const totalAvailableHours = netAvailableDays * dailyHours;
    const utilizationPercent = totalAvailableHours > 0 ? (totalBillableHours / totalAvailableHours) * 100 : 0;
    const revenuePerDay = netAvailableDays > 0 ? totalForecastRevenue / netAvailableDays : 0;

    return {
      ...emp,
      portfolios: empPortfolios,
      totals: {
        targetRevenue: totalTargetRevenue,
        forecastRevenue: totalForecastRevenue,
        actualRevenue: totalActualRevenue,
        availableDays: totalAvailableDays,
        plannedAbsence: totalPlannedAbsence,
        netAvailableDays,
        availableHours: totalAvailableHours,
        billableHours: totalBillableHours,
        utilizationPercent,
        revenuePerDay
      },
      monthly: Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const monthData = empPlanning.find(p => p.month === month);
        const workingDays = WORKING_DAYS_PER_MONTH[i];
        const absenceDays = monthData ? (monthData.vacation_days + monthData.internal_days + monthData.sick_days + monthData.training_days) : 0;
        const netDays = workingDays - absenceDays;
        const availableHours = netDays * dailyHours;
        
        return {
          month,
          workingDays,
          portfolioId: monthData?.portfolio_id || null,
          portfolioCode: monthData?.portfolio_code || null,
          portfolioName: monthData?.portfolio_name || null,
          portfolioColor: monthData?.portfolio_color || null,
          targetRevenue: monthData?.target_revenue || 0,
          forecastPercent: monthData?.forecast_percent || 80,
          forecastRevenue: (monthData?.target_revenue || 0) * ((monthData?.forecast_percent || 80) / 100),
          vacationDays: monthData?.vacation_days || 0,
          internalDays: monthData?.internal_days || 0,
          sickDays: monthData?.sick_days || 0,
          trainingDays: monthData?.training_days || 0,
          netAvailableDays: netDays,
          availableHours,
          actualRevenue: monthData?.actual_revenue || 0,
          billableHours: monthData?.billable_hours || 0,
          utilizationPercent: availableHours > 0 ? ((monthData?.billable_hours || 0) / availableHours) * 100 : 0
        };
      })
    };
  });

  // Calculate portfolio summary
  const portfolios = await allAsync<{ id: number; code: string; display_name: string; color: string }>(
    "SELECT id, code, display_name, color FROM portfolios WHERE is_active = 1"
  );

  // Calculate portfolio summary based on monthly planning assignments
  const portfolioSummary = portfolios.map((portfolio: { id: number; code: string; display_name: string; color: string }) => {
    let totalTargetRevenue = 0;
    let totalForecastRevenue = 0;
    let totalActualRevenue = 0;
    let totalAvailableHours = 0;
    let totalBillableHours = 0;
    const employeesInPortfolio = new Set<number>();

    // Sum up all monthly data where portfolio_id matches
    planningData.filter(p => p.portfolio_id === portfolio.id).forEach(monthData => {
      employeesInPortfolio.add(monthData.employee_id);
      totalTargetRevenue += monthData.target_revenue;
      totalForecastRevenue += monthData.target_revenue * (monthData.forecast_percent / 100);
      totalActualRevenue += monthData.actual_revenue;
      totalBillableHours += monthData.billable_hours;
      
      // Calculate available hours for this month
      const emp = employees.find(e => e.employee_id === monthData.employee_id);
      if (emp) {
        const workingDays = WORKING_DAYS_PER_MONTH[(monthData.month - 1)] || 21;
        const absenceDays = monthData.vacation_days + monthData.internal_days + monthData.sick_days + monthData.training_days;
        const netDays = workingDays - absenceDays;
        const dailyHours = emp.weekly_hours / 5;
        totalAvailableHours += netDays * dailyHours;
      }
    });

    return {
      id: portfolio.id,
      code: portfolio.code,
      name: portfolio.display_name,
      color: portfolio.color,
      employeeCount: employeesInPortfolio.size,
      totals: {
        targetRevenue: totalTargetRevenue,
        forecastRevenue: totalForecastRevenue,
        actualRevenue: totalActualRevenue,
        availableHours: totalAvailableHours,
        billableHours: totalBillableHours,
        utilizationPercent: totalAvailableHours > 0 ? (totalBillableHours / totalAvailableHours) * 100 : 0
      }
    };
  });

  // Calculate entity summary
  const entitySummary: Record<number, {
    entityId: number;
    entityCode: string;
    entityName: string;
    employeeCount: number;
    totals: {
      targetRevenue: number;
      forecastRevenue: number;
      actualRevenue: number;
      availableHours: number;
      billableHours: number;
      utilizationPercent: number;
    };
  }> = {};

  employeeSummary.forEach(emp => {
    if (!entitySummary[emp.entity_id]) {
      entitySummary[emp.entity_id] = {
        entityId: emp.entity_id,
        entityCode: emp.entity_code,
        entityName: emp.entity_name,
        employeeCount: 0,
        totals: {
          targetRevenue: 0,
          forecastRevenue: 0,
          actualRevenue: 0,
          availableHours: 0,
          billableHours: 0,
          utilizationPercent: 0
        }
      };
    }
    
    const es = entitySummary[emp.entity_id];
    es.employeeCount++;
    es.totals.targetRevenue += emp.totals.targetRevenue;
    es.totals.forecastRevenue += emp.totals.forecastRevenue;
    es.totals.actualRevenue += emp.totals.actualRevenue;
    es.totals.availableHours += emp.totals.availableHours;
    es.totals.billableHours += emp.totals.billableHours;
  });

  // Calculate utilization percent for entities
  Object.values(entitySummary).forEach(es => {
    es.totals.utilizationPercent = es.totals.availableHours > 0 
      ? (es.totals.billableHours / es.totals.availableHours) * 100 
      : 0;
  });

  // Overall totals
  const overallTotals = {
    employeeCount: employeeSummary.length,
    targetRevenue: employeeSummary.reduce((sum, e) => sum + e.totals.targetRevenue, 0),
    forecastRevenue: employeeSummary.reduce((sum, e) => sum + e.totals.forecastRevenue, 0),
    actualRevenue: employeeSummary.reduce((sum, e) => sum + e.totals.actualRevenue, 0),
    availableHours: employeeSummary.reduce((sum, e) => sum + e.totals.availableHours, 0),
    billableHours: employeeSummary.reduce((sum, e) => sum + e.totals.billableHours, 0),
    utilizationPercent: 0
  };
  overallTotals.utilizationPercent = overallTotals.availableHours > 0 
    ? (overallTotals.billableHours / overallTotals.availableHours) * 100 
    : 0;

  return NextResponse.json({
    year,
    employees: employeeSummary,
    portfolios: portfolioSummary,
    entities: Object.values(entitySummary),
    totals: overallTotals
  });
  } catch (e: unknown) {
    console.error("Summary GET error:", e);
    return NextResponse.json({
      year,
      employees: [],
      portfolios: [],
      entities: [],
      totals: { employeeCount: 0, targetRevenue: 0, forecastRevenue: 0, actualRevenue: 0, availableHours: 0, billableHours: 0, utilizationPercent: 0 }
    });
  }
}
