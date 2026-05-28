'use client';

/**
 * Static map of what the executive briefing and cockpit are designed to cover.
 * Pairs with SAGE prompt sections in ExecutiveBriefing.tsx.
 */
export function ExecutiveCoverageFramework() {
  return (
    <section className="executive-section card no-print" style={{ padding: 24 }}>
      <h2
        className="executive-section-title"
        style={{
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.04em',
          color: 'var(--text-secondary)',
          margin: 0,
        }}
      >
        Commercial intelligence coverage
      </h2>
      <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
        The SAGE executive briefing below is prompted to address each block: liquidity, inventory, sales interpretation,
        bottom-line outcomes, an operator checklist, and a phased timeline—using uploaded data where present and clearly
        calling out gaps.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Liquidity management
          </h3>
          <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)] leading-snug list-disc pl-4">
            <li>Payouts (aggregators, vendors, payroll cadence)</li>
            <li>Cash flow vs sales and cost timing</li>
            <li>Demand-driven working capital risk</li>
          </ul>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Inventory analytics
          </h3>
          <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)] leading-snug list-disc pl-4">
            <li>Cover, spoilage, and ordering vs demand</li>
            <li>Links to food cost and waste signals</li>
            <li>Stockout / overstock risk framing</li>
          </ul>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Sales data interpretation
          </h3>
          <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)] leading-snug list-disc pl-4">
            <li>Franchise or unit rollup (or consolidated single site)</li>
            <li>Cost per SKU vs price and category margins</li>
            <li>Transit, lead time, and channel mix where inferrable</li>
          </ul>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Bottom line · dispatch · franchise · timeframe
          </h3>
          <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)] leading-snug list-disc pl-4">
            <li>Expected profit or margin proxy for the selected period</li>
            <li>Dispatch / delivery fee drag if data supports it</li>
            <li>Franchise vs corporate reporting note</li>
            <li>Explicit timeframe and expected output (₹ or %)</li>
          </ul>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Checklist</h3>
          <p className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed">
            Briefing ends with executable checklist items (finance, ops, procurement) tied to numbers—not generic advice.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Timeline</h3>
          <p className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed">
            Phased view: this week, 30 days, and 90 days—each with concrete milestones and expected impact where possible.
          </p>
        </div>
      </div>
    </section>
  );
}
