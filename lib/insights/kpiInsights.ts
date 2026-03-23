export interface KpiInsight {
  id: string;
  title: string;
  summary: string;
  query: string;
}

/**
 * Static KPI-based insights (no SAGE call). Fault-driven: fewer items, longer text when there is a problem.
 * Used on home and insights page.
 */
export function getKpiInsights(
  avgMarginPct: number,
  wowPct: number,
  foodCostPct: number
): KpiInsight[] {
  const insights: KpiInsight[] = [];

  if (avgMarginPct < 65) {
    insights.push({
      id: 'margin',
      title: 'Gross margin below benchmark',
      summary:
        `Gross margin is at ${avgMarginPct.toFixed(1)}%, below the 65% target. This squeezes profitability and leaves less room for labor and overhead. Review food cost, portioning, and pricing; consider menu engineering and waste controls to get margin back on track.`,
      query: 'What should I do to improve gross margin?',
    });
  }

  if (wowPct < 0) {
    insights.push({
      id: 'revenue',
      title: 'Revenue down vs last week',
      summary:
        `Revenue is down ${Math.abs(wowPct).toFixed(1)}% week-over-week. That can point to traffic, check size, or seasonality. Check recent promotions, staffing, and operational issues that might have hurt throughput or satisfaction.`,
      query: 'Why is my revenue trending this way and what actions do you suggest?',
    });
  }

  if (foodCostPct > 32) {
    insights.push({
      id: 'food-cost',
      title: 'Food cost above target',
      summary:
        `Food cost is at ${foodCostPct.toFixed(1)}%, above the 32% target. This directly hits gross margin and sustainability. Focus on recipe costing, portion control, waste, and supplier pricing; tighten specs and prep to bring cost back in line without compromising quality.`,
      query: 'How can I reduce food cost without hurting quality?',
    });
  }

  return insights;
}
