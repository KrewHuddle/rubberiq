import { StatTile } from '../design/index.js';

export function SuperAdminPage() {
  return (
    <div className="space-y-8">
      <h1 className="font-[family-name:var(--rb-font-display)] text-4xl font-semibold tracking-tight">
        Platform
      </h1>
      <div className="grid gap-4 md:grid-cols-4">
        <StatTile label="Shops live" value="—" />
        <StatTile label="MRR" value="—" />
        <StatTile label="Tires logged" value="—" />
        <StatTile label="Scrap hauled" value="—" />
      </div>
      <p className="text-[var(--rb-fg-muted)]">Super-admin surfaces land in Phase 2.5.</p>
    </div>
  );
}
