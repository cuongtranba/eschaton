import { edgeKey, type Compiled } from "../src/index.ts";

const COLOR = { mountain: "#c8302b", valley: "#2753c9", join: "#b48d12", seam: "#16804a", joint: "#d86f00", boundary: "#26272b" } as const;

/** Flat crease pattern of every piece (the unfolded sheets) as a wrapped grid; each piece is its own sheet, drawn at one common scale. */
export function flatNetSvg(c: Compiled): string {
  const roleOf = new Map(c.edges.map((e) => [edgeKey(e.a, e.b), e]));
  const cells = c.pieces.map((piece) => {
    const polys = piece.faces.map((f) => ({ f, poly: c.flat.get(f) ?? [] }));
    const pts = polys.flatMap((p) => p.poly);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const size = Math.max(x1 - x0, y1 - y0, 0.4);
    const at = (p: readonly [number, number]): readonly [string, string] => [(p[0] - x0).toFixed(3), (y1 - p[1]).toFixed(3)];
    const faces = polys.map(({ poly }) => `<polygon points="${poly.map((p) => at(p).join(",")).join(" ")}" fill="#e9e4d8" stroke="none"/>`).join("");
    const lines = polys.flatMap(({ f, poly }) => {
      const face = c.design.faces[f];
      if (face === undefined) return [];
      return poly.map((p, k) => {
        const q = poly[(k + 1) % poly.length] ?? p;
        const e = roleOf.get(edgeKey(face.v[k] ?? 0, face.v[(k + 1) % face.v.length] ?? 0));
        const inPiece = e !== undefined && e.faces.filter((g) => c.pieceOf[g] === piece.index).length > 1;
        const role = e === undefined ? "boundary" : e.role === "crease" && inPiece ? ((e.rest ?? 0) < 0 ? "mountain" : "valley") : e.role === "join" && inPiece ? "join" : e.role === "joint" ? "joint" : e.faces.length > 1 ? "seam" : "boundary";
        const [a, b] = [at(p), at(q)];
        const dash = role === "join" ? ' stroke-dasharray="0.03 0.03"' : "";
        return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${COLOR[role]}" stroke-width="${role === "boundary" ? 0.012 : 0.018}"${dash}/>`;
      });
    });
    return { size, body: `${faces}${lines.join("")}`, label: `${piece.module} p${piece.index} · ${piece.faces.length}` };
  });
  const scale = Math.max(...cells.map((cell) => cell.size));
  const figures = cells
    .map((cell) => `<figure style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.05 -0.05 ${(scale + 0.1).toFixed(3)} ${(scale + 0.1).toFixed(3)}" style="width:100%;height:auto;background:#f4f2ed">${cell.body}</svg><figcaption style="font-size:10px">${cell.label}</figcaption></figure>`)
    .join("");
  return `<div>Flat nets: ${c.pieces.length} separate sheets (modular papercraft, not one sheet), all drawn at one scale. Lines: mountain red, valley blue, join yellow dashed, glue seam green, joint orange, cut boundary black.</div><div style="display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:4px">${figures}</div>`;
}
