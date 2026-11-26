# ADR 0018: Fixed clock, tick commit and system order (Phase 4)

- Status: **Proposed — draft for the owner's review. Not accepted. Phase 4 is not authorized.** It becomes binding only by an explicit owner decision at CL0 of [`../plans/phase-4-collapse-proposal.md`](../plans/phase-4-collapse-proposal.md), which stays the canonical scope. Where the two differ, the proposal's owner decisions (P4-1…P4-10) win, and this ADR is amended.
- Date: 2026-11-26. Written against `main` @ `6024a1b`.
- Master plan: §6.1 (tick pipeline), §9.1 (budgets), §11 Phase 4 row ("reproducible event sequence", "failed solve rolls back").
- Answers: ADR 0007 amendment ("tick, idle-tick semantics and system order belong to the Phase 4 ADR") and ADR 0011 question 5. Related: ADR 0016 (proposals), 0017 (scoped seeds, `draftProposal`), [0019](0019-structural-support-and-bond-failure.md) (the structural systems scheduled here).

## Context

Today the world has no clock. `header.tick` is 0 and every commit is caused by an explicit command or a settled job. Phase 4 adds continuous systems (wind, decay, structural failure, fragment settle) and asynchronous re-collapse jobs. The master plan requires a fixed tick, pause, step, replay and reset. It also requires that "async completion ordering must not decide authoritative outcomes".

The rules below are kept small on purpose. There is no ECS, no plugin registry, no second world state and no physics engine.

## Recommendations (each needs the owner's decision)

### 1. Who owns time

- **World** (`@eschaton/world`) stores `header.tick`, meaning **the tick of the latest commit**. It owns no clock.
  - Today `header.tick` is set to 0 by `createWorld` and is never changed by a patch. `Patch` has no tick, but `CommitRecord` copies `header.tick` (`packages/world/src/patch.ts`).
  - Phase 4 adds an optional `Patch.tick`, defaulting to `header.tick`. A patch with a tick below `header.tick` is refused; several commits may share a tick.
  - `header` is part of the state hash, so a tick advances the hash only when something commits.
- **Session** (`@eschaton/collapse`, P4-1 a) owns:
  - the cursor (`next`, the next tick to run);
  - the input log;
  - outstanding jobs;
  - the run state `running | paused | stopped`.

  It is one object behind a small API: `step()`, `run(frames)`, `pause()`, `submit(command)`, `status()`.
- The renderer and the UI hold no simulation state. They read published snapshots `(revision, tick)` and send commands.

### 2. Idle ticks and the cursor (P4-3 a)

- An **idle tick** is one in which no command applies, no result is due and no system emits an op. It commits nothing, writes no record and does not change `header.tick`. The cursor still advances.
- **This needs two changes to how systems behave today** (`packages/world/src/systems.ts`):
  - `windFold` emits a `fold` op for every matching entity, even when the angle does not change. That op still commits, and it marks the entity as touched, so its bonds are re-derived. Under the clock, a system emits ops **only for values that change**. Otherwise no tick with wind is ever idle.
  - `runSystem` rejects an empty plan as `op-invalid` ("proposed no change"). The scheduler does not call `runSystem`. It calls `plan` on the system's view, and an empty plan is the normal idle result. `runSystem` stays as it is for the explicit Phase 1–3 path.
- Every field input is a pure function of an **absolute** tick, for example a gust's `fromTick`. A run that skips idle ticks therefore produces the same records as one that counts them.
- **Restart** is reset plus re-simulation: initial snapshot + input log.
- **Resume from a mid-run snapshot** is allowed only at a quiescent point, with no outstanding job. The cursor then resumes at `max(header.tick + 1, the last input tick + 1)`. A resume with jobs outstanding is refused with a diagnostic, not approximated.
- Persisting sessions across reloads is Phase 8.

### 3. Input commands, replay and re-simulation

- **Input log.** It records commands, not outcomes:
  - entries are `{ tick, seq, command }`, ordered by `(tick, seq)`;
  - `seq` is the session's receive order within that tick;
  - a command submitted while running is stamped with the cursor's next tick;
  - a command for a tick that has already run is refused.

  Commands change scenario data (field specs, event triggers, pins), or **resolve a stop**: resume after late, abandon job, retry job. Scenario data is session state carried by the log; it is not world state.
- **Header.** The input log carries the initial snapshot's state hash and a **`schedule` version**: the system list, its order and its parameters (K, L, budgets).
- **Replay** (unchanged, ADR 0011) applies the recorded `CommitRecord`s and verifies each state hash. It never runs systems or the solver, so it survives a schedule change.
- **Re-simulation** runs the session from the initial snapshot and the input log, and compares the produced records with the recorded ones. It refuses a `schedule` mismatch.
- This keeps system versions out of `versions.rules`, consistent with P3D-4 (a): changing a system makes old input logs refuse to re-simulate, but never makes a snapshot refuse to load. `versions.rules` changes only when world state or invariants change. ADR 0019 does that once.

### 4. Order of one tick (fixed; part of `schedule`)

1. Apply the input commands for tick `t`, in `seq` order.
2. **Settle due results:** each job due at `t`, in `(due tick, job id)` order, through `applyProposal`. Each is its own commit with origin `job`. An outcome of `conflict` re-dispatches the job against the current state, due at `t + L` again and at most twice, and the diagnostic is published. `invalid` abandons the job and publishes a diagnostic. Neither stops the session.
3. Sample fields at `t` for the drafted state: pure, integer or correctly rounded only (proposal §2.5). "No `pow`" means no operation whose result can differ between engines. An exact power-of-two constant such as `2 ** 500` in `windStrength` is allowed (ADR 0017 choice 9 a).
4. Run systems in order, each on the state drafted by the previous ones. This uses the same pattern as `draftProposal`: validate and apply without hashing or recording. Today the drafting step (`advance`) is internal to `@eschaton/world` and is exposed only for proposals. CL1 therefore adds one world export, `draftPatch(catalog, state, patch)`, which runs exactly the checks of `applyPatch` and returns the drafted state. The systems, in order:
   1. `windFold` (fold angles);
   2. `decay` (damage);
   3. `structural` (break within budget, ADR 0019);
   4. `detach` (unanchored components);
   5. `settle` (fragments that reach rest at `t`).
5. **Commit once:** the concatenated ops as one patch at tick `t` with origin `tick`, or nothing.
6. Plan dirty regions from this tick's detaches, and dispatch jobs due at `t + L`. A job id is `(t, ordinal)`.
7. Publish the snapshot.

A system sees only its declared view, as today. Seeds are scoped `(world seed, t, system id, scope)` (ADR 0017).

### 5. Atomicity and fail-stop (P4-4 a)

- **Step 5 is atomic.** If the drafted patch is rejected, nothing of step 5 commits. The session moves to `stopped { tick, system, issue }`, and the cursor stays at `t`.
  - The commits from step 2 stand: each was already a valid, separately recorded transaction.
  - Re-simulation reproduces the same stop at the same point.
- A stopped session runs nothing until a recorded command resolves it, or until reset.
- **Diagnostics are observable** through `status()` and the published snapshot event. They carry the system or job id, the tick and the world's rejection payload. Nothing is swallowed or logged only to the console.

### 6. Late worker: a deterministic barrier with a bounded wait (P4-2 a)

- At the start of tick `t`, a job due at `t` whose result has not arrived **blocks the cursor**. Wall time may decide only *when to stop waiting*, never *what commits*.
- The simulation waits asynchronously. The UI thread stays responsive, and the run state shows `waiting { job, since }`.
- **Bound.** After a wall-clock limit (proposed 5 s), the session moves to `stopped { reason: "late", job }` and cancels nothing on its own. Every resolution is a recorded input command at tick `t`, so re-simulation follows the same path:
  - **retry:** re-dispatch the same request; same seed, same result;
  - **abandon:** the ruin stays, and the job is dropped as if solved to "no change";
  - **wait:** resume waiting.
- **Unsolvable within budget** is decided by the solver's deterministic node and backtrack budgets (ADR 0015), never by time: an `unsatisfiable` or `budget-exceeded` outcome abandons the job with a diagnostic. The worker hosts already use wall time (`now`), but only to slice the work and pace progress messages. It never selects an outcome.
- **Cancellation** (user cancel, or an overlapping new region merging an outstanding job) is a recorded decision at a tick. A cancelled job posts one `cancelled` result and commits nothing, using the existing worker host cancellation.

### 7. Budgets per tick kind (measured at CL1 before any becomes a gate)

| Tick kind | Proposed p95 at about 1.6k entities |
|---|---|
| Idle | ≤ 1 ms (no commit) |
| Systems only (one tick patch) | systems ≤ 8 ms + commit ≤ 16 ms |
| With a settled re-collapse | + one proposal commit (measured 16–23 ms p95 on 2026-11-26, decision packet §5.1); may exceed one tick and is then a visible hitch, logged, not a failure |

Catch-up is capped at 4 ticks per frame, as in the proposal.

## Options not recommended

- **Record every tick (P4-3 b):** an O(world) hash per idle tick, about 30 records a second, no information.
- **Commit results at arrival (P4-2 b):** live runs would not re-simulate; reproduction would rest on replay only.
- **Version systems in `versions.rules`:** refuses every snapshot whenever a system changes (P3D-4 b).
- **A timeout that silently abandons:** wall time would decide state.

## Test-first cases (public seams: `@eschaton/world`, `@eschaton/collapse`; no mocks, no sleeps, an explicit session clock)

- "an idle tick commits nothing and leaves the header tick and state hash unchanged"
- "a patch with a tick below the header tick is refused"
- "a steady wind after the folds have settled leaves the tick idle" (no op for an unchanged angle)
- "the same initial snapshot and input log re-simulate to the same records" (Node; the engines job for Chromium, Firefox and WebKit)
- "re-simulation refuses an input log with another schedule version, and replay of the same records still succeeds"
- "a command for a tick that has already run is refused"
- "an invalid op from one system rejects the whole tick, keeps earlier settled results and stops with the system id"
- "a result due at tick t that has not arrived holds the cursor at t" (a worker host the test resolves by hand)
- "a late job abandoned by command leaves the ruin and re-simulates to the same records"
- "resuming from a snapshot with an outstanding job is refused"

## Consequences

- The clock needs no rules bump. `header.tick` already exists, and `Patch.tick` is optional. CL1 checks whether log parsing needs a schema bump for the new field.
- The input log is a new artefact, owned by the session, not by the world.
- Wall time appears in exactly one place, the late-result bound, and only as a reason to stop.
