import type { ReactNode } from "react";

export function Row({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="inspector__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
