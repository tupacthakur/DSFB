/**
 * Executive section: logic, reasoning, and methodology copy for metrics and scores.
 * Used to explain how numbers are derived and what they mean.
 */

export const HEALTH_SCORE_GRADE_BANDS = [
  { range: '90–100', label: 'Exceptional', description: 'Operations are best-in-class; focus on sustaining and sharing practices.' },
  { range: '75–89', label: 'Strong', description: 'Key drivers are in good shape; address focus areas to reach exceptional.' },
  { range: '60–74', label: 'Developing', description: 'Some metrics need improvement; prioritize weakest areas to avoid risk.' },
  { range: '45–59', label: 'At Risk', description: 'Multiple drivers below target; coordinated action needed soon.' },
  { range: '0–44', label: 'Critical', description: 'Core operations are under pressure; immediate intervention recommended.' },
] as const;

/** Per-metric scoring logic (max points and threshold bands) for Business Health Score. */
export const HEALTH_SCORE_METRIC_RULES: Record<string, { max: number; logic: string; higherBetter: boolean }> = {
  food_cost: {
    max: 20,
    higherBetter: false,
    logic: 'Lower is better. ≤28% = 20 pts, ≤30% = 18, ≤32% = 15, ≤35% = 10, ≤38% = 5, >38% = 0. Based on F&B benchmarks (casual 28–32% ideal).',
  },
  labor_cost: {
    max: 20,
    higherBetter: false,
    logic: 'Lower is better. ≤28% = 20 pts, ≤30% = 18, ≤32% = 15, ≤35% = 10, ≤38% = 5, >38% = 0. Aligns with 28–35% industry range.',
  },
  bev_margin: {
    max: 15,
    higherBetter: true,
    logic: 'Higher is better. ≥72% = 15 pts, ≥68% = 12, ≥64% = 9, ≥60% = 6, ≥56% = 3, <56% = 0. Bar margin target 70–80%.',
  },
  sat_score: {
    max: 15,
    higherBetter: true,
    logic: 'Higher is better (out of 5). ≥4.5 = 15 pts, ≥4.3 = 12, ≥4.1 = 9, ≥3.8 = 6, ≥3.5 = 3, <3.5 = 0. Guest satisfaction proxy.',
  },
  waste_pct: {
    max: 10,
    higherBetter: false,
    logic: 'Lower is better. ≤3% = 10 pts, ≤5% = 8, ≤7% = 6, ≤9% = 3, >9% = 0. Target <5% for casual dining.',
  },
  table_turns: {
    max: 10,
    higherBetter: true,
    logic: 'Higher is better. ≥3.5 = 10 pts, ≥3.0 = 8, ≥2.5 = 6, ≥2.0 = 3, <2.0 = 0. Throughput; 2.5–4 typical for casual.',
  },
  repeat_rate: {
    max: 10,
    higherBetter: true,
    logic: 'Higher is better. ≥50% = 10 pts, ≥40% = 8, ≥35% = 6, ≥28% = 3, <28% = 0. Retention; target >40% for healthy base.',
  },
};

export const HEALTH_SCORE_SUMMARY =
  'The score is the sum of points across 7 metrics (max 100). Each metric uses F&B industry benchmarks: cost metrics lower is better, margin and satisfaction higher is better. Strengths and focus areas are the three highest- and lowest-scoring metrics.';

/** P&L cascade and EBITDA band reasoning. */
export const PL_METHODOLOGY = {
  cascade:
    'Revenue − Food Cost = Gross Profit; − Labor Cost = Prime Profit; − Operating Expenses (estimated 14% here) = EBITDA. Operating expenses include rent, utilities, and other fixed costs not in prime cost.',
  ebitdaBands:
    'EBITDA margin is compared to industry: >15% = strong (green), 10–15% = acceptable (amber), <10% = at risk (red). Full-service median is typically 12–15%.',
  estimatedNote: 'Values marked "Estimated" use your stored metrics and average daily revenue; upload actual P&L for precise figures.',
};

/** How alerts and opportunities are computed. */
export const STRATEGIC_INTEL_METHODOLOGY = {
  risks: {
    title: 'How risks are calculated',
    body: 'Risks come from symbolic rules: when a metric breaches a threshold (e.g. food cost >35%), the rule fires. Financial impact is the estimated weekly cost of being at current level vs benchmark ideal, using your weekly revenue. Time sensitivity: CRITICAL/ALERT/PRIORITY tags or confidence ≥0.98 → IMMEDIATE; ALERT/PRIORITY or ≥0.85 → THIS WEEK; else THIS MONTH. Risks are ordered by impact (highest ₹/week first).',
  },
  opportunities: {
    title: 'How opportunities are chosen',
    body: 'Metrics that are not yet at their ideal benchmark are candidates. For each, we compute the weekly revenue upside of moving to ideal and a simple ROI (upside ÷ gap to ideal). The top 3 by ROI are shown. Effort (LOW/MEDIUM/HIGH) is based on typical implementation difficulty for that lever (e.g. avg check = LOW, repeat rate = HIGH).',
  },
};

/** Period comparison table column meanings. */
export const PERIOD_TABLE_METHODOLOGY = {
  thisPeriod: 'Value for the selected period (week/month/quarter/YTD) from your data.',
  priorPeriod: 'Same metric in the immediately preceding period for comparison.',
  change: 'Percentage change vs prior period. Green = improvement, red = deterioration.',
  vsBudget: 'Your target (editable). Click a cell to set a budget; green = ahead of target, red = behind. Stored per metric.',
  vsIndustry: 'Difference vs benchmark ideal from F&B benchmarks. Green = ahead of industry norm for that metric.',
  trend: 'Recent 7-point history (sparkline) for direction; not all metrics have trend data.',
  computed: 'Rows marked * are derived (e.g. RevPASH, break-even) from revenue, seats, and cost percentages.',
};

/** Strategic outlook scenario and confidence logic. */
export const OUTLOOK_METHODOLOGY = {
  confidence:
    'Confidence is from the revenue forecast model: MAPE (mean absolute percentage error) ≤10% = HIGH, ≤20% = MEDIUM, else LOW. More historical data and stable patterns improve confidence.',
  scenarios: {
    doNothing: 'Projected 30-day revenue and costs if you continue on current trajectory (forecast only).',
    fixTopPriority: 'Forecast adjusted by mitigating the single highest-impact risk only; prime cost and EBITDA reflect that one fix.',
    allActions: 'Forecast adjusted by addressing all fired symbolic rules; assumes full execution of recommended actions.',
  },
  disclaimer: 'Scenario projections assume full execution of recommended actions. Actual results will vary.',
};
