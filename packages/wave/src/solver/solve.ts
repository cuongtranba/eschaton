import { socketId, type Cell, type Face, type Rotation, type SocketDefinition } from "@eschaton/foldon";
import { DIRECTIONS, OPPOSITE, STEP, type CompiledTiles, type TileRef } from "./compile";

export type BoundaryFace = Readonly<{ cell: Cell; face: Face; socket: SocketDefinition }>;

export type WaveProblem = Readonly<{
  size: Cell;
  seed: number;
  airWeight: number;
  blocked?: readonly Cell[];
  boundary?: readonly BoundaryFace[];
  ground?: Readonly<{ profile: string }>;
  budget: Readonly<{ maxNodes: number; maxBacktracks: number }>;
}>;

export type WavePlacement = Readonly<{ ref: TileRef; anchor: Cell; rotation: Rotation }>;
export type WaveStats = Readonly<{ cells: number; candidates: number; nodes: number; backtracks: number; propagations: number }>;

export type WaveOutcome =
  | Readonly<{ kind: "solved"; placements: readonly WavePlacement[]; airCells: number; stats: WaveStats }>
  | Readonly<{ kind: "unsatisfiable"; reason: string; stats: WaveStats }>
  | Readonly<{ kind: "budget-exceeded"; stats: WaveStats }>
  | Readonly<{ kind: "invalid"; issues: readonly string[] }>;

export type WaveProgress = Readonly<{ stats: WaveStats; decided: number; placements: readonly WavePlacement[] }>;

export type WaveSolve = Readonly<{ step: (nodes: number) => WaveOutcome | undefined; progress: () => WaveProgress }>;

const AIR = -1;
const UNDECIDED = -2;
const FREE_NEIGHBOUR = -1;
const FACES_AIR = -2;
const MAX_CELLS = 65536;

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

function problemIssues(problem: WaveProblem): string[] {
  const issues: string[] = [];
  const [nx, ny, nz] = problem.size;
  if (![nx, ny, nz].every((n) => Number.isSafeInteger(n) && n >= 1) || nx * ny * nz > MAX_CELLS) {
    issues.push(`size must be positive integers with at most ${MAX_CELLS} cells`);
  }
  if (!Number.isSafeInteger(problem.seed) || problem.seed < 0 || problem.seed > 0xffffffff) issues.push("seed must be an integer in 0..2^32-1");
  if (!Number.isSafeInteger(problem.airWeight) || problem.airWeight < 1) issues.push("airWeight must be an integer >= 1");
  const { maxNodes, maxBacktracks } = problem.budget;
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 1 || !Number.isSafeInteger(maxBacktracks) || maxBacktracks < 0) {
    issues.push("budget needs maxNodes >= 1 and maxBacktracks >= 0");
  }
  return issues;
}

export function createSolve(tiles: CompiledTiles, problem: WaveProblem): WaveSolve {
  const issues = problemIssues(problem);
  if (issues.length > 0) {
    const invalid: WaveOutcome = { kind: "invalid", issues };
    return { step: () => invalid, progress: () => ({ stats: { cells: 0, candidates: 0, nodes: 0, backtracks: 0, propagations: 0 }, decided: 0, placements: [] }) };
  }
  const [nx, ny, nz] = problem.size;
  const total = nx * ny * nz;
  const indexOf = (x: number, y: number, z: number): number =>
    x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz ? -1 : (y * nz + z) * nx + x;
  const cellAt = (index: number): Cell => [index % nx, Math.floor(index / (nx * nz)), Math.floor(index / nx) % nz];
  const neighbour = (index: number, direction: number): number => {
    const [x, y, z] = cellAt(index);
    const step = STEP[direction] ?? [0, 0, 0];
    return indexOf(x + step[0], y + step[1], z + step[2]);
  };

  const free = new Uint8Array(total).fill(1);
  for (const cell of problem.blocked ?? []) {
    const index = indexOf(cell[0], cell[1], cell[2]);
    if (index >= 0) free[index] = 0;
  }

  const groundSignature =
    problem.ground === undefined
      ? -1
      : tiles.signatureOf({
          id: socketId("ground"),
          cell: [0, -1, 0],
          face: "+y",
          position: [0.5, 0, 0.5],
          normal: [0, 1, 0],
          tangent: [1, 0, 0],
          profile: problem.ground.profile,
          role: "cap",
          tolerance: 1e-6,
        });

  const facing = new Int32Array(total * 6).fill(FACES_AIR);
  for (let index = 0; index < total; index++) {
    for (let direction = 0; direction < 6; direction++) {
      const other = neighbour(index, direction);
      if (other >= 0 && free[other] === 1) facing[index * 6 + direction] = FREE_NEIGHBOUR;
      else if (direction === 3 && other < 0 && problem.ground !== undefined) facing[index * 6 + direction] = groundSignature;
    }
  }
  for (const entry of problem.boundary ?? []) {
    const index = indexOf(entry.cell[0], entry.cell[1], entry.cell[2]);
    const direction = DIRECTIONS.indexOf(entry.face);
    if (index >= 0 && direction >= 0 && facing[index * 6 + direction] !== FREE_NEIGHBOUR) facing[index * 6 + direction] = tiles.signatureOf(entry.socket);
  }
  const signatures = tiles.signatureCount();

  const words = Math.max(1, Math.ceil(signatures / 32));
  const legalMask = new Uint32Array(signatures * words);
  const relaxedMask = new Uint32Array(words);
  for (let a = 0; a < signatures; a++) {
    if (!tiles.needsMate(a)) relaxedMask[a >>> 5] = ((relaxedMask[a >>> 5] ?? 0) | (1 << (a & 31))) >>> 0;
    for (let b = 0; b < signatures; b++) {
      if (tiles.legal(a, b)) legalMask[a * words + (b >>> 5)] = ((legalMask[a * words + (b >>> 5)] ?? 0) | (1 << (b & 31))) >>> 0;
    }
  }

  const fixedFaceAllows = (slot: number, signature: number): boolean => {
    const other = facing[slot] ?? FACES_AIR;
    return other === FACES_AIR ? !tiles.needsMate(signature) : tiles.legal(signature, other);
  };

  const variantSides = tiles.variants.map((variant) => {
    const sides = new Int32Array(variant.cells.length * 6).fill(-1);
    for (const face of variant.faces) sides[face.cell * 6 + face.direction] = face.signature;
    return sides;
  });

  const candidateVariant: number[] = [];
  const candidateOrigin: number[] = [];
  const candidateCells: number[][] = [];
  const covering: number[][] = Array.from({ length: total }, () => []);
  const coveringLocal: number[][] = Array.from({ length: total }, () => []);

  tiles.variants.forEach((variant, variantIndex) => {
    const count = variant.cells.length;
    for (let origin = 0; origin < total; origin++) {
      const [ox, oy, oz] = cellAt(origin);
      const cells: number[] = [];
      for (const offset of variant.cells) {
        const index = indexOf(ox + offset[0], oy + offset[1], oz + offset[2]);
        if (index < 0 || free[index] === 0) break;
        cells.push(index);
      }
      if (cells.length !== count) continue;
      let allowed = true;
      for (const face of variant.faces) {
        const slot = (cells[face.cell] ?? 0) * 6 + face.direction;
        if (facing[slot] !== FREE_NEIGHBOUR && !fixedFaceAllows(slot, face.signature)) {
          allowed = false;
          break;
        }
      }
      if (!allowed) continue;
      const id = candidateVariant.length;
      candidateVariant.push(variantIndex);
      candidateOrigin.push(origin);
      candidateCells.push(cells);
      for (let local = 0; local < count; local++) {
        const cell = cells[local] ?? 0;
        covering[cell]?.push(id);
        coveringLocal[cell]?.push(local);
      }
    }
  });

  const candidates = candidateVariant.length;
  const alive = new Uint8Array(candidates).fill(1);
  const aliveCount = new Int32Array(total);
  const airAlive = new Uint8Array(total);
  const decided = new Int32Array(total).fill(UNDECIDED);
  const support = new Int32Array(total * 6 * signatures);
  const present = new Uint32Array(total * 6 * words);
  for (let index = 0; index < total; index++) {
    if (free[index] === 0) {
      decided[index] = AIR;
      continue;
    }
    aliveCount[index] = covering[index]?.length ?? 0;
    let airAllowed = true;
    for (let direction = 0; direction < 6; direction++) {
      const other = facing[index * 6 + direction] ?? FACES_AIR;
      if (other >= 0 && tiles.needsMate(other)) airAllowed = false;
    }
    airAlive[index] = airAllowed ? 1 : 0;
  }
  let contradiction = false;
  for (let index = 0; index < total; index++) if (free[index] === 1 && (aliveCount[index] ?? 0) + (airAlive[index] ?? 0) === 0) contradiction = true;

  const queue: number[] = [];
  const queued = new Uint8Array(total * 6);
  const touchFace = (cell: number, direction: number): void => {
    if (facing[cell * 6 + direction] !== FREE_NEIGHBOUR) return;
    const slot = neighbour(cell, direction) * 6 + (OPPOSITE[direction] ?? 0);
    if (queued[slot] === 0) {
      queued[slot] = 1;
      queue.push(slot);
    }
  };

  const bump = (cell: number, direction: number, signature: number, delta: number): void => {
    const slot = (cell * 6 + direction) * signatures + signature;
    const next = (support[slot] ?? 0) + delta;
    support[slot] = next;
    const word = (cell * 6 + direction) * words + (signature >>> 5);
    if (next === 0) {
      present[word] = ((present[word] ?? 0) & ~(1 << (signature & 31))) >>> 0;
      touchFace(cell, direction);
    } else if (next === 1 && delta > 0) {
      present[word] = ((present[word] ?? 0) | (1 << (signature & 31))) >>> 0;
    }
  };

  const bumpCandidate = (id: number, delta: number): void => {
    const sides = variantSides[candidateVariant[id] ?? 0];
    const cells = candidateCells[id] ?? [];
    if (sides === undefined) return;
    for (let local = 0; local < cells.length; local++) {
      for (let direction = 0; direction < 6; direction++) {
        const signature = sides[local * 6 + direction] ?? -1;
        if (signature >= 0) bump(cells[local] ?? 0, direction, signature, delta);
      }
    }
  };
  for (let id = 0; id < candidates; id++) bumpCandidate(id, 1);

  const trail: number[] = [];
  let nodes = 0;
  let backtracks = 0;
  let propagations = 0;
  const random = mulberry32(problem.seed);

  const domainOf = (index: number): number => (aliveCount[index] ?? 0) + (airAlive[index] ?? 0);

  const kill = (id: number): void => {
    if (alive[id] === 0) return;
    alive[id] = 0;
    trail.push(id);
    for (const cell of candidateCells[id] ?? []) {
      aliveCount[cell] = (aliveCount[cell] ?? 0) - 1;
      if (domainOf(cell) === 0) contradiction = true;
    }
    bumpCandidate(id, -1);
  };

  const killAir = (index: number): void => {
    if (airAlive[index] === 0) return;
    airAlive[index] = 0;
    trail.push(-1 - index);
    if (domainOf(index) === 0) contradiction = true;
    for (let direction = 0; direction < 6; direction++) touchFace(index, direction);
  };

  const sideOf = (cell: number, k: number, direction: number): number => {
    const id = covering[cell]?.[k] ?? 0;
    return variantSides[candidateVariant[id] ?? 0]?.[(coveringLocal[cell]?.[k] ?? 0) * 6 + direction] ?? -1;
  };

  const revise = (slot: number): void => {
    const index = Math.floor(slot / 6);
    const direction = slot % 6;
    const other = neighbour(index, direction);
    const base = (other * 6 + (OPPOSITE[direction] ?? 0)) * words;
    const otherAir = airAlive[other] === 1;
    const here = covering[index] ?? [];
    for (let k = 0; k < here.length; k++) {
      const id = here[k] ?? 0;
      if (alive[id] === 0) continue;
      const signature = sideOf(index, k, direction);
      if (signature < 0 || (otherAir && !tiles.needsMate(signature))) continue;
      let ok = false;
      for (let w = 0; w < words && !ok; w++) ok = ((present[base + w] ?? 0) & (legalMask[signature * words + w] ?? 0)) !== 0;
      if (!ok) kill(id);
    }
    if (airAlive[index] === 1 && !otherAir) {
      let ok = false;
      for (let w = 0; w < words && !ok; w++) ok = ((present[base + w] ?? 0) & (relaxedMask[w] ?? 0)) !== 0;
      if (!ok) killAir(index);
    }
  };

  const propagate = (): void => {
    while (queue.length > 0 && !contradiction) {
      const slot = queue.pop() ?? 0;
      queued[slot] = 0;
      propagations += 1;
      revise(slot);
    }
    if (contradiction) {
      for (const slot of queue) queued[slot] = 0;
      queue.length = 0;
    }
  };

  const undoTo = (mark: number): void => {
    while (trail.length > mark) {
      const entry = trail.pop() ?? 0;
      if (entry >= 0) {
        alive[entry] = 1;
        for (const cell of candidateCells[entry] ?? []) aliveCount[cell] = (aliveCount[cell] ?? 0) + 1;
        bumpCandidate(entry, 1);
      } else {
        airAlive[-1 - entry] = 1;
      }
    }
    for (const slot of queue) queued[slot] = 0;
    queue.length = 0;
    contradiction = false;
  };

  const commitOption = (index: number, option: number): void => {
    if (option === AIR) {
      for (const id of covering[index] ?? []) kill(id);
      decided[index] = AIR;
      return;
    }
    for (const cell of candidateCells[option] ?? []) {
      for (const id of covering[cell] ?? []) if (id !== option) kill(id);
      killAir(cell);
      decided[cell] = option;
    }
  };

  type Frame = { mark: number; cell: number; option: number; cells: readonly number[] };
  const frames: Frame[] = [];

  const stats = (): WaveStats => ({ cells: total, candidates, nodes, backtracks, propagations });

  const placementsNow = (): WavePlacement[] => {
    const seen = new Set<number>();
    const placements: WavePlacement[] = [];
    for (let index = 0; index < total; index++) {
      const id = decided[index] ?? UNDECIDED;
      if (id < 0 || free[index] === 0 || seen.has(id)) continue;
      seen.add(id);
      const variant = tiles.variants[candidateVariant[id] ?? 0];
      if (variant === undefined) continue;
      const [x, y, z] = cellAt(candidateOrigin[id] ?? 0);
      placements.push({ ref: variant.ref, anchor: [x - variant.shift[0], y - variant.shift[1], z - variant.shift[2]], rotation: variant.rotation });
    }
    return placements;
  };

  const selfCheck = (): string | undefined => {
    for (let index = 0; index < total; index++) {
      if (free[index] === 0) continue;
      const id = decided[index] ?? UNDECIDED;
      if (id === UNDECIDED) return `cell ${index} is undecided`;
      if (id === AIR) {
        for (let direction = 0; direction < 6; direction++) {
          const other = facing[index * 6 + direction] ?? FACES_AIR;
          if (other >= 0 && tiles.needsMate(other)) return `air at cell ${index} faces a socket that needs a mate`;
        }
        continue;
      }
      const k = (covering[index] ?? []).indexOf(id);
      for (let direction = 0; direction < 6; direction++) {
        const signature = sideOf(index, k, direction);
        if (signature < 0) continue;
        const slot = index * 6 + direction;
        if (facing[slot] !== FREE_NEIGHBOUR) {
          if (!fixedFaceAllows(slot, signature)) return `cell ${index} breaks its fixed face ${direction}`;
          continue;
        }
        const other = neighbour(index, direction);
        const otherId = decided[other] ?? UNDECIDED;
        if (otherId === AIR) {
          if (tiles.needsMate(signature)) return `cell ${index} needs a mate on face ${direction} and faces air`;
          continue;
        }
        const otherK = (covering[other] ?? []).indexOf(otherId);
        const otherSignature = sideOf(other, otherK, OPPOSITE[direction] ?? 0);
        if (otherSignature < 0 || !tiles.legal(signature, otherSignature)) return `cells ${index} and ${other} do not mate`;
      }
    }
    return undefined;
  };

  let finished: WaveOutcome | undefined;

  const pickCell = (): number => {
    let best = -1;
    let bestCount = 0;
    let bestWeight = 0;
    for (let index = 0; index < total; index++) {
      if (decided[index] !== UNDECIDED) continue;
      const count = domainOf(index);
      if (best >= 0 && count > bestCount) continue;
      let weight = airAlive[index] === 1 ? problem.airWeight : 0;
      for (const id of covering[index] ?? []) if (alive[id] === 1) weight += tiles.variants[candidateVariant[id] ?? 0]?.weight ?? 0;
      if (best < 0 || count < bestCount || weight < bestWeight) {
        best = index;
        bestCount = count;
        bestWeight = weight;
      }
    }
    return best;
  };

  const drawOption = (index: number): number => {
    let sum = airAlive[index] === 1 ? problem.airWeight : 0;
    for (const id of covering[index] ?? []) if (alive[id] === 1) sum += tiles.variants[candidateVariant[id] ?? 0]?.weight ?? 0;
    let roll = random() % sum;
    for (const id of covering[index] ?? []) {
      if (alive[id] === 0) continue;
      roll -= tiles.variants[candidateVariant[id] ?? 0]?.weight ?? 0;
      if (roll < 0) return id;
    }
    return AIR;
  };

  const retreat = (): boolean => {
    while (contradiction) {
      const frame = frames.pop();
      if (frame === undefined) return false;
      backtracks += 1;
      for (const cell of frame.cells) decided[cell] = UNDECIDED;
      undoTo(frame.mark);
      if (frame.option === AIR) killAir(frame.cell);
      else kill(frame.option);
      propagate();
    }
    return true;
  };

  for (let slot = 0; slot < total * 6; slot++) {
    if (free[Math.floor(slot / 6)] === 1 && facing[slot] === FREE_NEIGHBOUR) {
      queued[slot] = 1;
      queue.push(slot);
    }
  }
  propagate();

  const step = (limit: number): WaveOutcome | undefined => {
    if (finished !== undefined) return finished;
    if (contradiction && frames.length === 0) {
      finished = { kind: "unsatisfiable", reason: "the constraints contradict before any choice", stats: stats() };
      return finished;
    }
    for (let done = 0; done < limit; done++) {
      const cell = pickCell();
      if (cell < 0) {
        const broken = selfCheck();
        if (broken !== undefined) throw new Error(`wave solver produced an invalid result: ${broken}`);
        let airCells = 0;
        for (let index = 0; index < total; index++) if (free[index] === 1 && decided[index] === AIR) airCells += 1;
        finished = { kind: "solved", placements: placementsNow(), airCells, stats: stats() };
        return finished;
      }
      if (nodes >= problem.budget.maxNodes || backtracks > problem.budget.maxBacktracks) {
        finished = { kind: "budget-exceeded", stats: stats() };
        return finished;
      }
      nodes += 1;
      const option = drawOption(cell);
      const cells = option === AIR ? [cell] : (candidateCells[option] ?? []);
      frames.push({ mark: trail.length, cell, option, cells });
      commitOption(cell, option);
      propagate();
      if (!retreat()) {
        finished = { kind: "unsatisfiable", reason: "every option was tried and contradicted", stats: stats() };
        return finished;
      }
      if (backtracks > problem.budget.maxBacktracks) {
        finished = { kind: "budget-exceeded", stats: stats() };
        return finished;
      }
    }
    return undefined;
  };

  const progress = (): WaveProgress => {
    let count = 0;
    for (let index = 0; index < total; index++) if (free[index] === 1 && decided[index] !== UNDECIDED) count += 1;
    return { stats: stats(), decided: count, placements: placementsNow() };
  };

  return { step, progress };
}

export function solve(tiles: CompiledTiles, problem: WaveProblem): WaveOutcome {
  const job = createSolve(tiles, problem);
  for (;;) {
    const outcome = job.step(1024);
    if (outcome !== undefined) return outcome;
  }
}
