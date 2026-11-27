import type { Compiled } from "../src/index.ts";

export function inspectorHtml(c: Compiled): string {
  const roles = new Map<string, number>();
  for (const e of c.edges) roles.set(e.role, (roles.get(e.role) ?? 0) + 1);
  const parts = new Map<string, number>();
  for (const f of c.design.faces) parts.set(`${f.module}.${f.part}`, (parts.get(`${f.module}.${f.part}`) ?? 0) + 1);
  return `
    <h3>Identity</h3><pre>id ${c.id} (hash of kind, version and quantised params)\n${JSON.stringify(c.design.params, null, 1)}</pre>
    <h3>Topology</h3><pre>faces ${c.design.faces.length} · pieces ${c.pieces.length}\n${[...roles].map(([k, v]) => `${k} ${v}`).join(" · ")}</pre>
    <h3>Pieces (flat sheets → Foldon definitions)</h3><pre>${c.pieces.map((p) => `${p.id}  panels ${p.faces.length}  creases ${p.recipe.creases.length}  footprint ${p.definition.footprint.length} cells${p.attach === undefined ? "  (root)" : `  ${p.attach.kind} → p${p.attach.piece}${p.attach.articulation === undefined ? "" : ` articulated [${p.attach.articulation.lo}°, ${p.attach.articulation.hi}°]`}`}`).join("\n")}</pre>
    <h3>Semantic parts</h3><pre>${[...parts].map(([k, v]) => `${k}: ${v}`).join("\n")}</pre>`;
}
