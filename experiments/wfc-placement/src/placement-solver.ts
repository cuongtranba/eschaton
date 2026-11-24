import { createTrace, DIRS, opposite, prepareProblem, SOCKET_COUNT, socketIndex, tileVariants } from "./model.ts";
import type { Prepared } from "./model.ts";
import type { CellState, Offset, Problem, Rotation, SolveOptions, SolveResult, SolveStats } from "./types.ts";
import { DEFAULT_MAX_BACKTRACKS, DEFAULT_MAX_NODES } from "./types.ts";
import { at, createRng, pickMinimum, weightedEntropy } from "./util.ts";
import { verifySolution } from "./verify.ts";

type ExternalFace = { readonly cell: number; readonly neighbour: number; readonly dir: number; readonly socket: number };

type Placement = {
  readonly tile: string;
  readonly rotation: Rotation;
  readonly anchor: Offset;
  readonly weight: number;
  readonly cells: readonly number[];
  readonly offsets: readonly Offset[];
  readonly faces: readonly ExternalFace[];
  readonly socketAt: Int8Array;
};

type Model = {
  readonly placements: readonly Placement[];
  readonly candidates: readonly (readonly number[])[];
  readonly candidateLocal: readonly (readonly number[])[];
  readonly byKey: ReadonlyMap<string, number>;
};

type Frame = { readonly trailMark: number; readonly placement: number; readonly cell: number };

function placementKey(tile: string, rotation: number, x: number, z: number): string {
  return `${tile}|${rotation}|${x},${z}`;
}

function buildModel(prepared: Prepared): Model {
  const { width, height } = prepared;
  const placements: Placement[] = [];
  const byKey = new Map<string, number>();
  for (const tile of prepared.tiles) {
    for (const variant of tileVariants(tile)) {
      for (let z = 0; z < height; z++) {
        for (let x = 0; x < width; x++) {
          const cells: number[] = [];
          let inside = true;
          for (const cell of variant.cells) {
            const cx = x + cell.delta[0];
            const cz = z + cell.delta[1];
            if (cx < 0 || cz < 0 || cx >= width || cz >= height) {
              inside = false;
              break;
            }
            cells.push(cz * width + cx);
          }
          if (!inside) continue;
          const faces: ExternalFace[] = [];
          const socketAt = new Int8Array(cells.length * 4).fill(-1);
          let allowed = true;
          for (const [local, cell] of variant.cells.entries()) {
            const cellIndex = at(cells, local);
            const cx = cellIndex % width;
            const cz = Math.floor(cellIndex / width);
            for (let dir = 0; dir < 4; dir++) {
              const nx = cx + at(DIRS, dir)[0];
              const nz = cz + at(DIRS, dir)[1];
              const socket = socketIndex(at(cell.faces, dir));
              if (nx < 0 || nz < 0 || nx >= width || nz >= height) {
                if (at(prepared.boundary, socket) === 0) allowed = false;
                continue;
              }
              const neighbour = nz * width + nx;
              if (cells.includes(neighbour)) continue;
              faces.push({ cell: cellIndex, neighbour, dir, socket });
              socketAt[local * 4 + dir] = socket;
            }
          }
          if (!allowed) continue;
          byKey.set(placementKey(tile.id, variant.rotation, x, z), placements.length);
          placements.push({
            tile: tile.id,
            rotation: variant.rotation,
            anchor: [x, z],
            weight: tile.weight,
            cells,
            offsets: variant.cells.map((c) => c.offset),
            faces,
            socketAt,
          });
        }
      }
    }
  }
  const candidates: number[][] = Array.from({ length: width * height }, () => []);
  const candidateLocal: number[][] = Array.from({ length: width * height }, () => []);
  for (const [id, placement] of placements.entries()) {
    for (const [local, cell] of placement.cells.entries()) {
      at(candidates, cell).push(id);
      at(candidateLocal, cell).push(local);
    }
  }
  return { placements, candidates, candidateLocal, byKey };
}

export function solvePlacement(problem: Problem, options: SolveOptions): SolveResult {
  const trace = createTrace();
  const empty: SolveStats = { nodes: 0, backtracks: 0, propagationSteps: 0 };
  const checked = prepareProblem(problem);
  if (!checked.ok) {
    trace.add({ node: 0, event: "invalid", cell: null, detail: checked.detail });
    return { kind: "unsatisfiable", stats: empty, trace: trace.events() };
  }
  const prepared = checked.prepared;
  const { width, height, compat } = prepared;
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const maxBacktracks = options.maxBacktracks ?? DEFAULT_MAX_BACKTRACKS;
  const rng = createRng(options.seed);
  const model = buildModel(prepared);
  const { placements, candidates, candidateLocal } = model;
  const cellCount = width * height;

  const alive = new Uint8Array(placements.length).fill(1);
  const aliveCount = new Int32Array(cellCount);
  for (const placement of placements) for (const cell of placement.cells) aliveCount[cell] = at(aliveCount, cell) + 1;
  const chosen = new Int32Array(cellCount).fill(-1);
  const inQueue = new Uint8Array(placements.length);
  const trail: number[] = [];
  let queue: number[] = [];
  let queueHead = 0;
  let conflictCell = -1;
  let nodes = 0;
  let backtracks = 0;
  let steps = 0;

  const stats = (): SolveStats => ({ nodes, backtracks, propagationSteps: steps });
  const coords = (cell: number): Offset => [cell % width, Math.floor(cell / width)];

  const enqueue = (placement: number): void => {
    if (at(alive, placement) === 1 && at(inQueue, placement) === 0) {
      inQueue[placement] = 1;
      queue.push(placement);
    }
  };

  const clearQueue = (): void => {
    for (let i = queueHead; i < queue.length; i++) inQueue[at(queue, i)] = 0;
    queue = [];
    queueHead = 0;
  };

  const kill = (id: number): void => {
    alive[id] = 0;
    trail.push(id);
    const placement = at(placements, id);
    for (const cell of placement.cells) {
      const remaining = at(aliveCount, cell) - 1;
      aliveCount[cell] = remaining;
      if (remaining === 0 && at(chosen, cell) === -1 && conflictCell === -1) conflictCell = cell;
    }
    for (const face of placement.faces) for (const other of at(candidates, face.neighbour)) enqueue(other);
  };

  const supported = (id: number): boolean => {
    for (const face of at(placements, id).faces) {
      const ids = at(candidates, face.neighbour);
      const locals = at(candidateLocal, face.neighbour);
      let found = false;
      for (let i = 0; i < ids.length && !found; i++) {
        const other = at(ids, i);
        if (at(alive, other) === 0) continue;
        const socket = at(at(placements, other).socketAt, at(locals, i) * 4 + opposite(face.dir));
        if (socket >= 0 && at(compat, face.socket * SOCKET_COUNT + socket) === 1) found = true;
      }
      if (!found) return false;
    }
    return true;
  };

  const propagate = (): boolean => {
    while (queueHead < queue.length && conflictCell === -1) {
      const id = at(queue, queueHead++);
      inQueue[id] = 0;
      if (at(alive, id) === 0) continue;
      steps++;
      if (!supported(id)) kill(id);
    }
    if (conflictCell !== -1) {
      clearQueue();
      return false;
    }
    queue = [];
    queueHead = 0;
    return true;
  };

  const commit = (id: number): void => {
    const placement = at(placements, id);
    for (const cell of placement.cells) {
      chosen[cell] = id;
      trail.push(~cell);
    }
    for (const cell of placement.cells) {
      for (const other of at(candidates, cell)) if (other !== id && at(alive, other) === 1) kill(other);
    }
  };

  const settle = (): boolean => {
    if (!propagate()) return false;
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (let cell = 0; cell < cellCount; cell++) {
        if (at(chosen, cell) !== -1 || at(aliveCount, cell) !== 1) continue;
        const only = at(candidates, cell).find((id) => at(alive, id) === 1);
        if (only === undefined) return false;
        commit(only);
        if (!propagate()) return false;
        progressed = true;
      }
    }
    return true;
  };

  const undoTo = (mark: number): void => {
    clearQueue();
    conflictCell = -1;
    while (trail.length > mark) {
      const entry = trail.pop();
      if (entry === undefined) break;
      if (entry >= 0) {
        alive[entry] = 1;
        for (const cell of at(placements, entry).cells) aliveCount[cell] = at(aliveCount, cell) + 1;
      } else {
        chosen[~entry] = -1;
      }
    }
  };

  const selectCell = (): number => {
    const entropy = new Float64Array(cellCount);
    const eligible = new Uint8Array(cellCount);
    for (let cell = 0; cell < cellCount; cell++) {
      if (at(chosen, cell) !== -1 || at(aliveCount, cell) < 2) continue;
      let sum = 0;
      let sumLog = 0;
      for (const id of at(candidates, cell)) {
        if (at(alive, id) === 0) continue;
        const weight = at(placements, id).weight;
        sum += weight;
        sumLog += weight * Math.log(weight);
      }
      entropy[cell] = weightedEntropy(sum, sumLog);
      eligible[cell] = 1;
    }
    return pickMinimum(entropy, eligible, rng);
  };

  const pickPlacement = (cell: number): number => {
    let sum = 0;
    for (const id of at(candidates, cell)) if (at(alive, id) === 1) sum += at(placements, id).weight;
    let ticket = rng() * sum;
    let last = -1;
    for (const id of at(candidates, cell)) {
      if (at(alive, id) === 0) continue;
      last = id;
      ticket -= at(placements, id).weight;
      if (ticket < 0) return id;
    }
    return last;
  };

  const describe = (id: number): string => {
    const placement = at(placements, id);
    return `${placement.tile} r${placement.rotation} @${placement.anchor.join(",")}`;
  };

  const failure = (cell: number): void => {
    trace.add({ node: nodes, event: "contradiction", cell: cell === -1 ? null : coords(cell), detail: "empty domain" });
  };

  for (let id = 0; id < placements.length; id++) enqueue(id);
  if (!propagate()) {
    failure(conflictCell);
    return { kind: "unsatisfiable", stats: stats(), trace: trace.events() };
  }
  for (const pin of prepared.pins) {
    const first = at(pin.cells, 0);
    const key = placementKey(pin.tile.id, pin.rotation, pin.anchor[0], pin.anchor[1]);
    const id = model.byKey.get(key);
    if (id === undefined || at(alive, id) === 0) {
      trace.add({ node: 0, event: "pin", cell: [first.x, first.z], detail: `${pin.tile.id} is not a live candidate at its pin` });
      return { kind: "unsatisfiable", stats: stats(), trace: trace.events() };
    }
    trace.add({ node: 0, event: "pin", cell: [first.x, first.z], detail: describe(id) });
    commit(id);
    if (!settle()) {
      failure(conflictCell);
      return { kind: "unsatisfiable", stats: stats(), trace: trace.events() };
    }
  }

  const frames: Frame[] = [];
  let consistent = settle();
  for (;;) {
    if (!consistent) {
      failure(conflictCell);
      const frame = frames.pop();
      if (frame === undefined) return { kind: "unsatisfiable", stats: stats(), trace: trace.events() };
      if (backtracks >= maxBacktracks) return { kind: "budget-exceeded", stats: stats(), trace: trace.events() };
      backtracks++;
      undoTo(frame.trailMark);
      trace.add({ node: nodes, event: "backtrack", cell: coords(frame.cell), detail: `not ${describe(frame.placement)}` });
      kill(frame.placement);
      consistent = settle();
      continue;
    }
    const cell = selectCell();
    if (cell === -1) break;
    if (nodes >= maxNodes) return { kind: "budget-exceeded", stats: stats(), trace: trace.events() };
    nodes++;
    const id = pickPlacement(cell);
    trace.add({ node: nodes, event: "decide", cell: coords(cell), detail: describe(id) });
    frames.push({ trailMark: trail.length, placement: id, cell });
    commit(id);
    consistent = settle();
  }

  const cells: CellState[] = [];
  for (let cell = 0; cell < cellCount; cell++) {
    const placement = at(placements, at(chosen, cell));
    cells.push({ tile: placement.tile, rotation: placement.rotation, offset: at(placement.offsets, placement.cells.indexOf(cell)) });
  }
  const grid = { width, height, cells };
  const verdict = verifySolution(problem, grid);
  if (!verdict.ok) throw new Error(`placement solver produced an invalid grid: ${verdict.violations.map((v) => v.detail).join("; ")}`);
  return { kind: "solved", grid, stats: stats() };
}
