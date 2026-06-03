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
        Commercial intelligence coverage and blind-spot controls
      </h2>
      <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
        This framework forces SAGE and executive views to explicitly mark blind spots (non-digital steps, missing
        channels, and disconnected systems) so finance/ops disputes are visible rather than hidden.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Retail and aggregator completeness
          </h3>
          <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)] leading-snug list-disc pl-4">
            <li>Must include dine-in, takeaway, Zomato, Swiggy, and B2B</li>
            <li>Flag when B2B is tiny vs total but process docs over-focus on it</li>
            <li>Show channel mix coverage before drawing revenue conclusions</li>
          </ul>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Outlet operations layer
          </h3>
          <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)] leading-snug list-disc pl-4">
            <li>POS billing, aggregator acceptance, cash reconciliation, EOD close</li>
            <li>Mark missing controls if store-floor process is undocumented</li>
            <li>No &quot;operational excellence&quot; claim without this evidence</li>
          </ul>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Paper challan and production handoff
          </h3>
          <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)] leading-snug list-disc pl-4">
            <li>Step with zero digital trace is a verifiability black hole</li>
            <li>Require timestamp, quantity, sender/receiver identity, and SKU lines</li>
            <li>Escalate dispute risk when challan remains paper-only</li>
          </ul>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            System joins: Zoho, Rista, Tally
          </h3>
          <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)] leading-snug list-disc pl-4">
            <li>PO ↔ GRN ↔ PI/Invoice must share a reconcilable key</li>
            <li>Tally cannot be absent if it is financial source-of-truth</li>
            <li>Any missing join key must be surfaced as manual-recon risk</li>
            <li>Franchise settlements, royalty, and compliance need explicit flow</li>
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
