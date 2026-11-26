import { edgeKey, type Compiled } from "../src/index.ts";

const COLOR = { mountain: "#c8302b", valley: "#2753c9", join: "#b48d12", seam: "#16804a", joint: "#d86f00", boundary: "#26272b" } as const;

/** Flat crease pattern of every piece (the unfolded sheets), laid out left to right; each piece is its own sheet. */
export function flatNetSvg(c: Compiled): string {
  const roleOf = new Map(c.edges.map((e) => [edgeKey(e.a, e.b), e]));
  let cursor = 0;
  const groups: string[] = [];
  let height = 0;
  for (const piece of c.pieces) {
    const polys = piece.faces.map((f) => ({ f, poly: c.flat.get(f) ?? [] }));
    const pts = polys.flatMap((p) => p.poly);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const at = (p: readonly [number, number]): string => `${(p[0] - x0 + cursor).toFixed(3)},${(y1 - p[1] + 0.3).toFixed(3)}`;
    const faces = polys.map(({ poly }) => `<polygon points="${poly.map(at).join(" ")}" fill="#e9e4d8" stroke="none"/>`).join("");
    const lines = polys.flatMap(({ f, poly }) => {
      const face = c.design.faces[f];
      if (face === undefined) return [];
      return poly.map((p, k) => {
        const q = poly[(k + 1) % poly.length] ?? p;
        const e = roleOf.get(edgeKey(face.v[k] ?? 0, face.v[(k + 1) % face.v.length] ?? 0));
        const inPiece = e !== undefined && e.faces.filter((g) => c.pieceOf[g] === piece.index).length > 1;
        const role = e === undefined ? "boundary" : e.role === "crease" && inPiece ? ((e.rest ?? 0) < 0 ? "mountain" : "valley") : e.role === "join" && inPiece ? "join" : e.role === "joint" ? "joint" : e.faces.length > 1 ? "seam" : "boundary";
        const [a, b] = [at(p).split(","), at(q).split(",")];
        const dash = role === "join" ? ' stroke-dasharray="0.03 0.03"' : "";
        return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${COLOR[role]}" stroke-width="${role === "boundary" ? 0.012 : 0.018}"${dash}/>`;
      });
    });
    groups.push(`<g>${faces}${lines.join("")}<text x="${cursor.toFixed(2)}" y="0.22" font-size="0.18" fill="#333">${piece.module} p${piece.index} · ${piece.faces.length} panels</text></g>`);
    cursor += Math.max(x1 - x0, 1.6) + 0.5;
    height = Math.max(height, y1 - y0 + 0.6);
  }
  return `<div>Flat nets: ${c.pieces.length} separate sheets (modular papercraft, not one sheet). Lines: mountain red, valley blue, join yellow dashed, glue seam green, joint orange, cut boundary black.</div><svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.2 0 ${(cursor + 0.2).toFixed(2)} ${height.toFixed(2)}">${groups.join("")}</svg>`;
}
