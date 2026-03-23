import type { FiredRule } from './engine';

/**
 * Domain dependency graph: which F&B domains are affected by which metrics.
 */
export const ONTOLOGY: Record<string, string[]> = {
  profitability: ['food_cost', 'labor_cost', 'prime_cost', 'bev_margin'],
  operations: ['table_turns', 'waste_pct', 'labor_cost'],
  customer: ['sat_score', 'avg_check', 'repeat_rate', 'no_shows'],
  sustainability: ['waste_pct', 'repeat_rate'],
};

export function traverseOntology(firedMetricNames: string[]): string[] {
  const domains = new Set<string>();
  for (const [domain, metrics] of Object.entries(ONTOLOGY)) {
    if (metrics.some((m) => firedMetricNames.includes(m))) domains.add(domain);
  }
  return Array.from(domains);
}

/**
 * For each fired rule, show which domain(s) it belongs to and which other metrics to watch.
 */
export function buildOntologyChains(fired: FiredRule[]): string {
  const chains: string[] = [];
  for (const rule of fired) {
    const affectedDomains = Object.entries(ONTOLOGY)
      .filter(([, metrics]) => metrics.includes(rule.metric))
      .map(([domain]) => domain);
    for (const domain of affectedDomains) {
      const peers = ONTOLOGY[domain].filter((m) => m !== rule.metric).join(', ');
      chains.push(
        `[${rule.id}] ${rule.metric} breach in domain:${domain} → also watch: ${peers}`
      );
    }
  }
  return chains.length > 0 ? chains.join('\n') : 'No ontological cascades detected.';
}
