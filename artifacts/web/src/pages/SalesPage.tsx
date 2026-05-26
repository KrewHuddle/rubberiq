import { StatTile } from '../design/index.js';

export function SalesPage() {
  return (
    <div className="space-y-8">
      <h1 className="font-[family-name:var(--rb-font-display)] text-4xl font-semibold tracking-tight">
        Your book
      </h1>
      <div className="grid gap-4 md:grid-cols-4">
        <StatTile label="Signed (period)" value="—" />
        <StatTile label="Goal progress" value="—" />
        <StatTile label="Book health" value="—" />
        <StatTile label="Commission (period)" value="—" />
      </div>
      <p className="text-[var(--rb-fg-muted)]">Sales surfaces land in Phase 2.5.</p>
    </div>
  );
}
