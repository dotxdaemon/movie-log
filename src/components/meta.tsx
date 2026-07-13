// ABOUTME: Renders technical metadata rows with uppercase labels and monospaced values.
// ABOUTME: Keeps dossier and summary annotations consistent across every archive surface.
import type { ReactNode } from 'react';

export interface MetaRowData {
  label: string;
  value: ReactNode;
}

export function MetaList({ className = '', rows }: { className?: string; rows: MetaRowData[] }) {
  return (
    <dl className={className ? `meta-list ${className}` : 'meta-list'}>
      {rows.map((row) => (
        <div className="meta-row" key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value === null || row.value === undefined || row.value === '' ? '—' : row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
