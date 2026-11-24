# ADR 0011: Minimal atomic transaction and revision contract

- Status: **Proposed — awaiting owner approval**
- Date: 2026-11-24
- Master plan: §5.4 (commit only if the base revision matches), §6.1 (workers return proposals; record authoritative outcomes), §7.2, §8.1 (revision, header, replay), §12 (transactionality, replay), §11 Phase 1 and Phase 2 (roadmap v1.1)
- Related: [ADR 0010](0010-runtime-identity-ownership-lineage.md) (the entity state a patch changes), [ADR 0012](0012-directional-sockets.md) (socket rules version in the header)

## Context

Phase 0 has no authoritative world, so there is no transaction.

- **The only mutable state is a UI reducer.** `labReducer(state, command)` (`apps/studio/src/lab/state.ts:130-155`) always returns a state. It clamps bad values (`clampUnit`, `:95`) instead of rejecting them, has no revision, and cannot fail.
- **The catalog is the one all-or-nothing commit that exists.** `createCatalog` collects every issue, then returns `err(issues)` if any exist and builds nothing (`packages/foldon/src/registry.ts:183-270`, the gate at `:270`). `compileAssembly` validates before it builds (`assembly.ts:257-287`). Expected failures are `Result` values, not exceptions (`result.ts`, `AGENTS.md`).
- **Definition data is already frozen** by `canonicalizeAndFreeze` (`define.ts`, `assembly.ts:285`), so immutable-by-construction is an existing convention.
- **Seeded derivation exists.** `createRandom(seed, salt)` derives independent streams from one seed (`apps/studio/src/lab/composition/random.ts`); the lab seed is normalised in `state.ts:97`.
- **Hashing exists** as FNV-1a 64 over a canonical string (`assembly.ts:80-110`), explicitly not a security boundary (ADR 0008).
- The plan wants worker proposals that never mutate the world, a commit only if the base revision still matches, a save header (schema, seed, catalog/rules/engine versions, tick) and replay from snapshot plus authoritative outcomes (§6.1, §8.1). The WFC experiment never reached a worker or cancellation (ADR 0004), so no proposal has existed yet.

Roadmap v1.1 pulls the transaction contract into Phase 1 because attach/detach and the ownership invariants of ADR 0010 are meaningless without an atomic commit, and because Phase 2's frozen-boundary solve and Phase 4's rollback depend on it.

## Decision drivers

1. Exactly one authoritative world state; derived caches are not truth.
2. A failed or stale patch leaves the world byte-for-byte unchanged: no partial writes, no repair step.
3. A worker or system can only produce a proposal; only the commit function changes the world.
4. Replay must reproduce state without depending on worker timing or floating-point physics.
5. Smallest design that Phase 1 needs; the tick pipeline, scheduler and streaming come later.
6. Plain data and pure functions; classes only to hold the current reference behind a small API.

## Options considered

1. **Immutable snapshots with a pure commit function** (proposed). State is a frozen value; `applyPatch(state, patch)` returns a new state or an error; a small store swaps its reference on success.
   - Pros: atomic by construction (nothing is written until the whole patch validated); rollback is not performing the swap; readers (renderer, UI, workers) can hold any revision safely; equality and hashing are simple; unit-testable as a pure function.
   - Cons: building a new state costs O(changed) with structural sharing and O(n) without; Phase 1 sizes (about 1,000 pieces) are fine, 10k to 100k (§9.1 District and Stress) need a persistent or chunked structure later; structural clone cost when sending state to a worker.
2. **Mutable store with an undo log.** Apply ops in place, record inverse ops, roll back by applying inverses.
   - Pros: no copying; cheap for very large worlds.
   - Cons: partial writes are visible while the patch runs; an exception or a wrong inverse leaves a corrupt world; readers need locks or copies; contradicts "failure leaves prior valid state intact" (§5.4) unless the inverse is perfect; harder to test.
3. **Event sourcing as the truth.** The log is the state; the current world is a projection folded from the log.
   - Pros: replay is the definition of state; complete audit.
   - Cons: every read needs a projection cache (a second state that must be kept consistent); events must stay replayable forever, so schema migration is expensive; replaying commands re-runs systems and widens the determinism scope the plan wants narrow (§6.1: "record authoritative outcomes").
4. **Snapshot truth plus a commit log of authoritative outcomes** (proposed as the way option 1 records history). The snapshot is the truth; the log is evidence that can rebuild it. It is not option 3, because reads never go through the log and the log holds the *outcomes* (patches), not the commands that led to them.

## Proposed decision

Options 1 and 4 together.

**One world state.** `WorldState` holds the header, the entity state of ADR 0010 and anything else Phase 1 adds. It is deeply frozen after construction.

**Commands become patches; patches are committed.**

```text
command ──plan(state)──▶ Patch(baseRevision, ops) ─┐
worker result ─────────▶ Patch(baseRevision, ops) ─┤──▶ applyPatch(state, patch)
                                                    │       validate every op in order on a draft,
                                                    │       run all invariant checks on the result
                                                    ├──▶ Rejected  → state unchanged, no revision consumed
                                                    └──▶ Committed → state' (revision+1), CommitRecord appended
```

- A **command** is intent from the UI or a system (`instantiate`, `attach`, `detach`). `plan` is a pure function from `(command, state)` to a patch or a rejection, so commands and worker proposals share one commit path.
- A **patch** carries `baseRevision` and an ordered list of ops (ADR 0010 `EntityOp`s for Phase 1). It describes the whole change; there is no "apply then fix".
- `applyPatch` builds the next state on a draft, validates each op, runs the full invariant check (ADR 0010 invariants plus occupancy and socket compatibility from ADR 0012), and either returns the new state or an error. The store swaps its reference only on success. **Rollback is never applying a failed patch.**
- **Stale base is rejected.** A patch with `baseRevision !== state.header.revision` fails with `stale` and reports the current revision. Phase 1 uses strict equality; rebasing by read-set is left to Phase 2 if livelock appears.
- **Revision** is an integer that increases by exactly 1 per committed patch. Rejected and stale patches consume nothing.
- **Worker proposals never mutate.** The worker receives a frozen snapshot (or a structural clone), returns a `Patch`, and the world applies it through the same function. New entities in a proposal use proposal-local refs; the world mints `EntityId`s on commit (ADR 0010).

**Log and replay.** Each commit appends a `CommitRecord`: the new revision, the origin (command or job id, for audit), the committed patch and a hash of the resulting state. `replay(initial, log)` applies the recorded patches (not the commands) and checks each hash; the first mismatch is reported as a divergence with its revision. Rejected patches are not in the replay log; they may be kept in a separate diagnostics list.

**Snapshot header.** `{ schema, seed, versions: { catalog, rules, engine }, tick, revision }`. `catalog` is a hash over every definition `id@version` and assembly hash; `rules` is the socket-table version (ADR 0012) plus the invariant set version; `engine` is the package version. Loading a snapshot with a newer `schema` is an error; older schemas go through explicit migration functions.

**Determinism scope for Phase 1.** All Phase 1 logical state is integers, ids and enums (cells, rotations 0–3, owners, quantities). For the same engine version, the same initial state and the same patch sequence give an identical state hash on every JavaScript engine. Floating-point values (fragment transforms, ADR 0013) are never recomputed on replay: the commit stores their authoritative values as outcomes. This is the starting text for the Phase 2 exit criterion "cross-browser determinism scope documented".

**Tick.** The header carries `tick`, but Phase 1 does not define stepping: idle ticks, tick-versus-revision semantics and the system order are decided in the Phase 4 ADR (question 5).

## Invariants

1. **Revision monotonic.** A committed patch raises `header.revision` by exactly 1; a rejected or stale patch leaves it unchanged.
2. **No partial writes.** If any op in a patch is invalid, none of its ops is visible in the resulting state; the previous state object is returned unchanged (`toBe` the same reference).
3. **Stale rejected.** A patch whose `baseRevision` differs from the current revision is rejected as `stale` and changes nothing.
4. **Proposals are inert.** Creating, queuing or discarding a `Patch` changes no world state; only a successful `applyPatch` does.
5. **Deterministic commit.** The same state and the same patch always produce the same new state and the same state hash.
6. **Replay equality.** `replay(initial, log)` yields a state whose hash equals the live state's hash; a corrupted record is reported as a divergence at its revision.
7. **Snapshot round trip.** Serialising and parsing a snapshot returns an equal state and an equal hash; an unknown newer schema or a mismatched catalog version is rejected, not loaded.
8. **Invariants hold after commit.** Every committed state passes `checkInvariants` (ADR 0010 invariants, occupancy, socket compatibility).
9. **States are immutable.** Mutating a committed state object (including nested arrays and maps) is impossible or throws in tests.

## Public API sketch

Illustrative TypeScript. The store is the only stateful piece; everything else is data and pure functions.

```ts
type Header = Readonly<{
  schema: number;
  seed: number;
  versions: Readonly<{ catalog: string; rules: string; engine: string }>;
  tick: number;
  revision: Revision;
}>;

type WorldState = Readonly<{ header: Header; entities: EntityState }>;

type WorldOp = EntityOp; // Phase 1; later phases add ops

type Patch = Readonly<{
  baseRevision: Revision;
  ops: readonly WorldOp[];
  origin: Readonly<{ kind: "command" | "job"; id: string }>;
}>;

type Rejection =
  | Readonly<{ kind: "invalid"; issues: readonly WorldIssue[] }>
  | Readonly<{ kind: "stale"; base: Revision; current: Revision }>;

type CommitRecord = Readonly<{
  revision: Revision;
  tick: number;
  origin: Patch["origin"];
  patch: Patch;
  stateHash: string;
}>;

type Committed = Readonly<{ state: WorldState; record: CommitRecord }>;

declare function applyPatch(state: WorldState, patch: Patch, rules: Rules): Result<Committed, Rejection>;
declare function plan(state: WorldState, command: Command, rules: Rules): Result<Patch, Rejection>;
declare function replay(initial: WorldState, log: readonly CommitRecord[], rules: Rules): Result<WorldState, ReplayDivergence>;
declare function hashState(state: WorldState): string; // canonical serialisation, then FNV-1a 64
declare function serializeSnapshot(state: WorldState): string;
declare function parseSnapshot(text: string, rules: Rules): Result<WorldState, SnapshotIssue>;

type World = Readonly<{
  state: () => WorldState;
  log: () => readonly CommitRecord[];
  dispatch: (command: Command) => Result<Committed, Rejection>;
  submit: (patch: Patch) => Result<Committed, Rejection>;
}>;
declare function createWorld(initial: WorldState, rules: Rules): World;
```

`createWorld` is the single place that holds a mutable reference; `dispatch` is `plan` followed by `submit`.

## Behavioural tests to write in Phase 1

Public seam: the `@eschaton/world` entry point with real catalogs and explicit seeds.

```ts
test("a committed patch raises the revision by exactly one")
test("a rejected patch consumes no revision and returns the unchanged state")
test("a patch whose final op is invalid leaves none of its earlier ops applied")
test("a patch built on an older revision is rejected as stale and reports the current revision")
test("submitting a proposal does not change the world until the patch is committed")
test("applying the same patch to the same state twice yields identical state hashes")
test("replaying the commit log reproduces the live state hash")
test("a tampered commit record is reported as a divergence at its revision")
test("a snapshot round trip yields an equal state and hash")
test("loading a snapshot with a newer schema is rejected")
test("loading a snapshot built against a different catalog version is rejected")
test("a committed state cannot be mutated through its nested collections")
test("dispatching an attach command on an occupied cell is rejected and the world is unchanged")
```

## Consequences

- Every change to the world goes through one function, so invariants (identity, occupancy, sockets, conservation) have one enforcement point.
- Workers (Phase 2) need no special path: a solve returns a `Patch`; a cancelled or unsatisfiable solve returns no patch and cannot affect the world.
- The UI gets rejections as values it can show, unlike `labReducer`, which clamps silently. `LabState` can stay a UI model that dispatches into `World`.
- Hashing every commit is O(n) unless the hash is incremental (see Risks); the cost has to be measured in Phase 1 against the §9.1 patch-latency target.
- The commit log is the only history. It does not include rejected patches, so debugging a rejection needs the diagnostics list.
- A new package, `@eschaton/world`, appears earlier than ADR 0001 expected; the reason is that §8 assigns transactions, revisions and the clock to a module that foldon "does not own".

## Risks

- **Copy cost.** Without structural sharing each commit is O(n) in entities. Mitigation: measure at 1,000 and 10,000 entities in Phase 1; adopt persistent maps or chunked state only on evidence.
- **Hash cost per commit.** Mitigation: incremental or per-chunk hashing, or hashing every N commits in release builds while keeping every-commit hashing in tests.
- **Strict stale rejection can starve a slow solve** that always loses to faster commits. Mitigation: Phase 2 may add rebase-by-read-set; the contract keeps `baseRevision` explicit so that remains possible.
- **Replaying patches hides bugs in `plan`.** Replay verifies commits, not command planning. Mitigation: separate planner tests; a debug mode that re-plans commands and compares patches.
- **Canonical serialisation pitfalls:** `-0`, `NaN`, map ordering. Mitigation: reject non-finite numbers at the boundary, sort keys, test the canonical form.
- **FNV-1a is not collision-resistant** (ADR 0008); a divergence could in theory go unnoticed. Acceptable for a divergence detector, not for integrity against an attacker.
- **Idle-tick and scheduler semantics are undecided** and may change the revision rule (question 5).

## Owner approval questions

1. Architecture: immutable snapshot truth plus an authoritative-outcome commit log, i.e. options 1 and 4 (**A**, recommended), event sourcing with the log as truth, option 3 (**B**), or a mutable store with an undo log, option 2 (**C**)?
2. Revision increments by exactly one per committed patch, and rejected or stale patches consume none? (yes/no)
3. Phase 1 uses strict base-revision equality, with read-set rebase deferred to Phase 2? (yes/no)
4. The replay log records committed patches (outcomes) and keeps commands only as audit metadata? (yes/no)
5. Phase 1 may leave `tick` at 0 and defer tick-versus-revision semantics to the Phase 4 ADR? (yes/no)
6. Divergence detection by FNV-1a 64 over the canonical serialisation is acceptable (non-cryptographic)? (yes/no)
7. Put entities, transactions and revisions in a new `@eschaton/world` package that imports `@eschaton/foldon` (**A**, recommended) or inside `@eschaton/foldon` (**B**)?
