import { EDGE_COLORS, type EdgeKind, type Sheet } from "../src/index.ts";

const ORDER: readonly EdgeKind[] = ["B", "S", "F", "J", "V", "M"];

/** 2D crease pattern of one sheet with the overlay colours; lattice units, y up. */
export function flatSvg(sheet: Sheet): string {
  const points = sheet.panels.flatMap((p) => p.vertices);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = 2;
  const width = x1 - x0 + 2 * pad;
  const height = y1 - y0 + 2 * pad;
  const at = (p: readonly [number, number]): string => `${(p[0] - x0 + pad).toFixed(2)},${(y1 - p[1] + pad).toFixed(2)}`;
  const faces = sheet.panels.map((p) => `<polygon points="${p.vertices.map(at).join(" ")}" fill="#f4efe6" fill-opacity="0.92" stroke="none"/>`).join("");
  const lines = ORDER.flatMap((kind) =>
    sheet.panels.flatMap((panel) =>
      panel.edges.flatMap((edge, i) => {
        if (edge.kind !== kind) return [];
        const [a, b] = [panel.vertices[i], panel.vertices[(i + 1) % panel.vertices.length]];
        if (a === undefined || b === undefined) return [];
        const dash = kind === "J" ? ' stroke-dasharray="1.2 0.9"' : "";
        return [`<line x1="${at(a).split(",")[0]}" y1="${at(a).split(",")[1]}" x2="${at(b).split(",")[0]}" y2="${at(b).split(",")[1]}" stroke="${EDGE_COLORS[kind]}" stroke-width="${kind === "B" ? 0.35 : 0.55}"${dash}/>`];
      }),
    ),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}" style="width:100%;max-height:180px">${faces}${lines.join("")}</svg>`;
}
