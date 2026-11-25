export type Socket = "open" | "ground" | "road" | "wall" | "door";
export type Rotation = 0 | 1 | 2 | 3;
export type Offset = readonly [number, number];
export type Faces = readonly [Socket, Socket, Socket, Socket];

export const EMPTY_TILE = "empty";

export type TileCell = { readonly offset: Offset; readonly faces: Faces };

export type TileDef = {
  readonly id: string;
  readonly weight: number;
  readonly cells: readonly TileCell[];
};

export type TileSet = {
  readonly tiles: readonly TileDef[];
  readonly compatible: readonly (readonly [Socket, Socket])[];
  readonly boundary: readonly Socket[];
  readonly emptyWeight: number | null;
};

export type Pin = {
  readonly tile: string;
  readonly anchor: Offset;
  readonly rotation: Rotation;
};

export type Problem = {
  readonly width: number;
  readonly height: number;
  readonly tileSet: TileSet;
  readonly pins: readonly Pin[];
};

export type CellState = {
  readonly tile: string;
  readonly rotation: Rotation;
  readonly offset: Offset;
};

export type Grid = {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly CellState[];
};

export type SolveOptions = {
  readonly seed: number;
  readonly maxNodes?: number;
  readonly maxBacktracks?: number;
};

export type SolveStats = {
  readonly nodes: number;
  readonly backtracks: number;
  readonly propagationSteps: number;
};

export type TraceEvent = {
  readonly node: number;
  readonly event: "invalid" | "pin" | "decide" | "contradiction" | "backtrack";
  readonly cell: Offset | null;
  readonly detail: string;
};

export type SolveResult =
  | { readonly kind: "solved"; readonly grid: Grid; readonly stats: SolveStats }
  | { readonly kind: "unsatisfiable"; readonly stats: SolveStats; readonly trace: readonly TraceEvent[] }
  | { readonly kind: "budget-exceeded"; readonly stats: SolveStats; readonly trace: readonly TraceEvent[] };

export type Violation = {
  readonly kind:
    | "coverage"
    | "unknown-tile"
    | "straddle"
    | "incomplete"
    | "overlap"
    | "incompatible"
    | "border"
    | "empty-disallowed"
    | "pin";
  readonly cell: Offset | null;
  readonly detail: string;
};

export type Verification =
  | { readonly ok: true }
  | { readonly ok: false; readonly violations: readonly Violation[] };

export const DEFAULT_MAX_NODES = 20_000;
export const DEFAULT_MAX_BACKTRACKS = 2_000;
