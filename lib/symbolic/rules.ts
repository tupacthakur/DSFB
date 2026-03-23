/**
 * F&B symbolic rules: threshold-based alerts.
 */

export interface Rule {
  id: string;
  metric: string;
  op: '>' | '<';
  threshold: number;
  tag: string;
  confidence: number;
}

export const RULES: Rule[] = [
  { id: 'R01', metric: 'food_cost', op: '>', threshold: 35, tag: 'ALERT:high_food_cost', confidence: 1.0 },
  { id: 'R02', metric: 'labor_cost', op: '>', threshold: 32, tag: 'ALERT:high_labor_cost', confidence: 0.95 },
  { id: 'R03', metric: 'bev_margin', op: '<', threshold: 62, tag: 'ALERT:low_bev_margin', confidence: 0.92 },
  { id: 'R04', metric: 'table_turns', op: '<', threshold: 2.5, tag: 'SUGGEST:menu_flow', confidence: 0.85 },
  { id: 'R05', metric: 'avg_check', op: '<', threshold: 24, tag: 'SUGGEST:upsell_training', confidence: 0.8 },
  { id: 'R06', metric: 'waste_pct', op: '>', threshold: 7, tag: 'ALERT:high_waste', confidence: 0.9 },
  { id: 'R07', metric: 'prime_cost', op: '>', threshold: 65, tag: 'CRITICAL:prime_breach', confidence: 1.0 },
  { id: 'R08', metric: 'sat_score', op: '<', threshold: 4.1, tag: 'PRIORITY:service_review', confidence: 1.0 },
  { id: 'R09', metric: 'no_shows', op: '>', threshold: 12, tag: 'SUGGEST:deposit_policy', confidence: 0.75 },
  { id: 'R10', metric: 'repeat_rate', op: '<', threshold: 35, tag: 'SUGGEST:loyalty_program', confidence: 0.7 },
];
