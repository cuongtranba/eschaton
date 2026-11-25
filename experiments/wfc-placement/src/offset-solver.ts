import { createTrace, DIRS, opposite, prepareProblem, SOCKET_COUNT, socketIndex, tileVariants } from "./model.ts";
import type { CellState, Offset, Problem, Rotation, SolveOptions, SolveResult, SolveStats, TileDef } from "./types.ts";
import { DEFAULT_MAX_BACKTRACKS, DEFAULT_MAX_NODES } from "./types.ts";
import { at, createRng, pickMinimum, weightedEntropy } from "./util.ts";
import { verifySolution } from "./verify.ts";

type State = {
  readonly tile: string;
  readonly rotation: Rotation;
  readonly offset: Offset;
  readonly weight: number;
  readonly sockets: readonly number[];
  readonly internal: readonly number[];
};

type Frame = { readonly trailMark: number; readonly cell: number; readonly state: number };

function buildStates(tiles: readonly TileDef[]): { states: State[]; byKey: Map<string, number> } {
  const states: State[] = [];
  const byKey = new Map<string, number>();
  for (const tile of tiles) {
    for (const variant of tileVariants(tile)) {
      const start = states.length;
      for (const [local, cell] of variant.cells.entries()) {
        const internal = DIRS.map((dir) => {
          const neighbour = variant.cells.findIndex((other) => other.delta[0] === cell.delta[0] + dir[0] && other.delta[1] === cell.delta[1] + dir[1]);
          return neighbour === -1 ? -1 : start + neighbour;
        });
        byKey.set(`${tile.id}|${variant.rotation}|${cell.offset.join(",")}`, start + local);
        states.push({
          tile: tile.id,
          rotation: variant.rotation,
          offset: cell.offset,
          weight: tile.weight,
          sockets: cell.faces.map((face) => socketIndex(face)),
          internal,
        });
      }
    }
  }
  return { states, byKey };
}

export function solveOffsetState(problem: Problem, options: SolveOptions): SolveResult {
  const trace = createTrace();
  const empty: SolveStats = { nodes: 0, backtracks: 0, propagationSteps: 0 };
  const checked = prepareProblem(problem);
  if (!checked.ok) {
    trace.add({ node: 0, event: "invalid", cell: null, detail: checked.detail });
    return { kind: "unsatisfiable", stats: empty, trace: trace.events() };
  }
  const prepared = checked.prepared;
  const { width, height } = prepared;
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const maxBacktracks = options.maxBacktracks ?? DEFAULT_MAX_BACKTRACKS;
  const rng = createRng(options.seed);
  const { states, byKey } = buildStates(prepared.tiles);
  const stateCount = states.length;
  const cellCount = width * height;

  const allowed: Int32Array[][] = DIRS.map((_, dir) =>
    states.map((s, sIndex) => {
      const targets: number[] = [];
      for (const [tIndex, t] of states.entries()) {
        const sInternal = at(s.internal, dir);
        const tInternal = at(t.internal, opposite(dir));
        const ok =
          sInternal !== -1 || tInternal !== -1
            ? sInternal === tIndex && tInternal === sIndex
            : at(prepared.compat, at(s.sockets, dir) * SOCKET_COUNT + at(t.sockets, opposite(dir))) === 1;
        if (ok) targets.push(tIndex);
      }
      return Int32Array.from(targets);
    }),
  );

  const alive = new Uint8Array(cellCount * stateCount).fill(1);
  const count = new Int32Array(cellCount).fill(stateCount);
  const inQueue = new Uint8Array(cellCount);
  const trail: number[] = [];
  let queue: number[] = [];
  let queueHead = 0;
  let conflictCell = -1;
  let nodes = 0;
  let backtracks = 0;
  let steps = 0;

  const stats = (): SolveStats => ({ nodes, backtracks, propagationSteps: steps });
  const coords = (cell: number): Offset => [cell % width, Math.floor(cell / width)];

  const enqueue = (cell: number): void => {
    if (at(inQueue, cell) === 0) {
      inQueue[cell] = 1;
      queue.push(cell);
    }
  };

  const clearQueue = (): void => {
    for (let i = queueHead; i < queue.length; i++) inQueue[at(queue, i)] = 0;
    queue = [];
    queueHead = 0;
  };

  const remove = (cell: number, state: number): void => {
    alive[cell * stateCount + state] = 0;
    trail.push(cell * stateCount + state);
    const remaining = at(count, cell) - 1;
    count[cell] = remaining;
    if (remaining === 0 && conflictCell === -1) conflictCell = cell;
    enqueue(cell);
  };

  const propagate = (): boolean => {
    const mask = new Uint8Array(stateCount);
    while (queueHead < queue.length && !hasConflict()) {
      const cell = at(queue, queueHead++);
      inQueue[cell] = 0;
      steps++;
      const cx = cell % width;
      const cz = Math.floor(cell / width);
      for (let dir = 0; dir < 4; dir++) {
        const nx = cx + at(DIRS, dir)[0];
        const nz = cz + at(DIRS, dir)[1];
        if (nx < 0 || nz < 0 || nx >= width || nz >= height) continue;
        const neighbour = nz * width + nx;
        mask.fill(0);
        for (let s = 0; s < stateCount; s++) {
          if (at(alive, cell * stateCount + s) === 0) continue;
          for (const t of at(at(allowed, dir), s)) mask[t] = 1;
        }
        for (let t = 0; t < stateCount; t++) {
          if (at(alive, neighbour * stateCount + t) === 1 && at(mask, t) === 0) remove(neighbour, t);
        }
        if (hasConflict()) break;
      }
    }
    if (conflictCell !== -1) {
      clearQueue();
      return false;
    }
    queue = [];
    queueHead = 0;
    return true;
  };

  const undoTo = (mark: number): void => {
    clearQueue();
    conflictCell = -1;
    while (trail.length > mark) {
      const entry = trail.pop();
      if (entry === undefined) break;
      alive[entry] = 1;
      const cell = Math.floor(entry / stateCount);
      count[cell] = at(count, cell) + 1;
    }
  };

  const failure = (cell: number): void => {
    trace.add({ node: nodes, event: "contradiction", cell: cell === -1 ? null : coords(cell), detail: "empty domain" });
  };

  const hasConflict = (): boolean => conflictCell !== -1;

  const describe = (state: number): string => {
    const s = at(states, state);
    return `${s.tile} r${s.rotation} o${s.offset.join(",")}`;
  };

  for (let cell = 0; cell < cellCount; cell++) {
    const cx = cell % width;
    const cz = Math.floor(cell / width);
    for (const [index, state] of states.entries()) {
      let ok = true;
      for (let dir = 0; dir < 4; dir++) {
        const nx = cx + at(DIRS, dir)[0];
        const nz = cz + at(DIRS, dir)[1];
        if (nx >= 0 && nz >= 0 && nx < width && nz < height) continue;
        if (at(state.internal, dir) !== -1 || at(prepared.boundary, at(state.sockets, dir)) === 0) ok = false;
      }
      if (!ok) remove(cell, index);
    }
    enqueue(cell);
  }
  if (!propagate()) {
    failure(conflictCell);
    return { kind: "unsatisfiable", stats: stats(), trace: trace.events() };
  }
  for (const pin of prepared.pins) {
    const first = at(pin.cells, 0);
    trace.add({ node: 0, event: "pin", cell: [first.x, first.z], detail: `${pin.tile.id} r${pin.rotation}` });
    for (const pinned of pin.cells) {
      const cell = pinned.z * width + pinned.x;
      const wanted = byKey.get(`${pin.tile.id}|${pin.rotation}|${pinned.offset.join(",")}`);
      for (let s = 0; s < stateCount; s++) {
        if (s !== wanted && at(alive, cell * stateCount + s) === 1) remove(cell, s);
      }
    }
    if (conflictCell !== -1 || !propagate()) {
      failure(conflictCell);
      return { kind: "unsatisfiable", stats: stats(), trace: trace.events() };
    }
  }

  const selectCell = (): number => {
    const entropy = new Float64Array(cellCount);
    const eligible = new Uint8Array(cellCount);
    for (let cell = 0; cell < cellCount; cell++) {
      if (at(count, cell) < 2) continue;
      let sum = 0;
      let sumLog = 0;
      for (let s = 0; s < stateCount; s++) {
        if (at(alive, cell * stateCount + s) === 0) continue;
        const weight = at(states, s).weight;
        sum += weight;
        sumLog += weight * Math.log(weight);
      }
      entropy[cell] = weightedEntropy(sum, sumLog);
      eligible[cell] = 1;
    }
    return pickMinimum(entropy, eligible, rng);
  };

  const pickState = (cell: number): number => {
    let sum = 0;
    for (let s = 0; s < stateCount; s++) if (at(alive, cell * stateCount + s) === 1) sum += at(states, s).weight;
    let ticket = rng() * sum;
    let last = -1;
    for (let s = 0; s < stateCount; s++) {
      if (at(alive, cell * stateCount + s) === 0) continue;
      last = s;
      ticket -= at(states, s).weight;
      if (ticket < 0) return s;
    }
    return last;
  };

  const frames: Frame[] = [];
  let consistent = true;
  for (;;) {
    if (!consistent) {
      failure(conflictCell);
      const frame = frames.pop();
      if (frame === undefined) return { kind: "unsatisfiable", stats: stats(), trace: trace.events() };
      if (backtracks >= maxBacktracks) return { kind: "budget-exceeded", stats: stats(), trace: trace.events() };
      backtracks++;
      undoTo(frame.trailMark);
      trace.add({ node: nodes, event: "backtrack", cell: coords(frame.cell), detail: `not ${describe(frame.state)}` });
      remove(frame.cell, frame.state);
      consistent = propagate();
      continue;
    }
    const cell = selectCell();
    if (cell === -1) break;
    if (nodes >= maxNodes) return { kind: "budget-exceeded", stats: stats(), trace: trace.events() };
    nodes++;
    const state = pickState(cell);
    trace.add({ node: nodes, event: "decide", cell: coords(cell), detail: describe(state) });
    frames.push({ trailMark: trail.length, cell, state });
    for (let s = 0; s < stateCount; s++) {
      if (s !== state && at(alive, cell * stateCount + s) === 1) remove(cell, s);
    }
    consistent = propagate();
  }

  const cells: CellState[] = [];
  for (let cell = 0; cell < cellCount; cell++) {
    const index = Array.from({ length: stateCount }, (_, s) => s).find((s) => at(alive, cell * stateCount + s) === 1);
    if (index === undefined) throw new Error("offset solver ended with an empty domain");
    const state = at(states, index);
    cells.push({ tile: state.tile, rotation: state.rotation, offset: state.offset });
  }
  const grid = { width, height, cells };
  const verdict = verifySolution(problem, grid);
  if (!verdict.ok) throw new Error(`offset solver produced an invalid grid: ${verdict.violations.map((v) => v.detail).join("; ")}`);
  return { kind: "solved", grid, stats: stats() };
}
