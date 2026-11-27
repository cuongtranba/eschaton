# ADR 0018: Fixed clock, tick commit and system order (Phase 4)

- Status: **Proposed — draft for the owner's review. Not accepted. Phase 4 is not authorized.** It becomes binding only by an explicit owner decision at CL0 of [`../plans/phase-4-collapse-proposal.md`](../plans/phase-4-collapse-proposal.md), which stays the canonical scope. Where the two differ, the proposal's owner decisions (P4-1…P4-12) win, and this ADR is amended.
- Date: 2026-11-26, written against `main` @ `6024a1b`. **Revised 2026-11-27** after a design review against `main` @ `03760d2`, which the owner asked for. The revision repairs the draft; it does not accept it. What changed and why is listed in "Review of 2026-11-27" at the end.
- Master plan: §6.1 (tick pipeline), §9.1 (budgets), §11 Phase 4 row ("reproducible event sequence", "failed solve rolls back").
- Answers: ADR 0007 amendment ("tick, idle-tick semantics and system order belong to the Phase 4 ADR") and ADR 0011 question 5. Related: ADR 0016 (proposals), 0017 (scoped seeds, `draftProposal`; choice 9 decided as (a) by the owner on 2026-11-27), [0019](0019-structural-support-and-bond-failure.md) (the structural systems scheduled here).

## Context

Today the world has no clock. `header.tick` is 0 and every commit is caused by an explicit command or a settled job. Phase 4 adds continuous systems (wind, decay, structural failure, fragment settle) and asynchronous re-collapse jobs. The master plan requires a fixed tick, pause, step, replay and reset. It also requires that "async completion ordering must not decide authoritative outcomes".

Facts in the code that the rules below depend on (`main` @ `03760d2`):
- `applyPatch` is all-or-nothing. `advance` validates a patch against `baseRevision`, applies its ops to one draft and mints new ids as `(revision + 1, ordinal)` (`packages/world/src/patch.ts`, `advance`). Every drafted or committed patch therefore advances the revision by one.
- A `CommitRecord` holds `revision`, `tick`, `origin`, `patch` and `stateHash`. `Origin.kind` is `command | job | system` (`patch.ts`). `tick` is copied from `header.tick`, which no patch changes today.
- `applyProposal` and `draftProposal` run the same checks; a changed read or `depends` digest is a `conflict` (`packages/world/src/region.ts`).

The rules below are kept small on purpose. There is no ECS, no plugin registry, no second world state and no physics engine.

## Recommendations (each needs the owner's decision)

### 1. Who owns time: two clocks, kept apart

- **World** (`@eschaton/world`) stores `header.tick`, meaning **the tick of the latest commit**. It owns no clock.
  - Phase 4 adds an optional `Patch.tick`, defaulting to `header.tick`. A patch with a tick below `header.tick` is refused; several commits may share a tick. The tick must be in the patch, not only in the record, because replay re-applies `record.patch` and compares state hashes.
  - `header` is part of the state hash, so a tick advances the hash only when something commits.
  - The tick's system patch uses the existing origin kind: `{ kind: "system", id: "tick" }`. No new origin kind is needed.
  - **This changes commit validation and derivation**, so ADR 0011 requires raising `invariants@n` in `versions.rules`. If CL1 and CL3 ship as one change of world rules, the bump is shared with ADR 0019 (`invariants@3`). Otherwise CL1 raises `invariants@3` and CL3 raises `invariants@4`. Either way, P4-6 decides what happens to older snapshots.
- **Session** (`@eschaton/collapse`, P4-1 a) owns:
  - the **cursor** (`next`, the next tick to run);
  - the input log, and the **scenario state** it carries (field specs, anchors, pins);
  - outstanding jobs and fragments still falling;
  - the run state `running | paused | waiting | stopped | failed`.

  It is one object behind a small API: `step()`, `run(frames)`, `pause()`, `submit(command)`, `status()`.
- **`header.tick` and the cursor are different facts.** `header.tick` is world state: hashed, changed only by a commit. The cursor is session state: never hashed, advanced by every tick, and never derived from the world. A published snapshot carries `(revision, header.tick, cursor)`.
- **While a session runs a world, nothing else commits to it.** The session's own commits are the only world changes. Phase 4 has no command that edits the world directly; commands change session state (§3). If the world revision differs from the one the session last committed or started from, the session moves to `failed { reason: "external-commit" }`.
- The renderer and the UI hold no simulation state. They read published snapshots and send commands.

### 2. Idle ticks, the cursor and continuing a run (P4-3 a)

- An **idle tick** is one in which no command applies, no result is due and no system emits an op. It commits nothing, writes no record and does not change `header.tick`. The cursor still advances.
- **This needs two changes to how systems behave today** (`packages/world/src/systems.ts`):
  - `windFold` emits a `fold` op for every matching entity, even when the angle does not change. That op still commits, and it marks the entity as touched, so its bonds are re-derived. Under the clock, a system emits ops **only for values that change**. Otherwise no tick with wind is ever idle.
  - `runSystem` rejects an empty plan as `op-invalid` ("proposed no change"). The scheduler does not call `runSystem`. It calls `plan` on the system's view, and an empty plan is the normal idle result. `runSystem` stays as it is for the explicit Phase 1–3 path.
- Every field input is a pure function of an **absolute** tick, for example a gust's `fromTick`.
- **A world snapshot is not a session state, so the cursor cannot be recovered from it.** The earlier draft resumed at `max(header.tick + 1, last input tick + 1)`. That is wrong in three ways:
  1. *Elapsed idle ticks are lost.* Say the last commit is at tick 10, the last input at tick 5, and the snapshot is taken at cursor 1,500. The old rule resumes at 11. The next command is stamped 11 instead of 1,500, and a gust whose spec starts at absolute tick 2,000 arrives 1,989 ticks after resuming instead of 500. The run that follows is a different timeline, and its log cannot be re-simulated as a continuation.
  2. *Scenario state is not in the world.* Field specs, anchors and pins live in the input log. A session built from a snapshot alone would run with none of them.
  3. *Pending work is not visible in the world.* A fragment detached at tick 100 settles at `100 + fall ticks` (ADR 0019 §5). If another commit lands at tick 104, `header.tick` is 104 and the detach tick can no longer be read from the state. Outstanding jobs are the same.
- **Rule (recommended): Phase 4 has no resume from a world snapshot.** A run continues only in one of two ways:
  - **in memory:** `pause`, `step` and `run` act on the same session object, so the cursor is never lost;
  - **by re-simulation:** reset to the initial snapshot and run the input log to an exact target cursor `n`. This reproduces the cursor, the scenario state, the outstanding jobs and the falling fragments by construction.
- **Starting a new session from any snapshot** is allowed. It is a new timeline: that snapshot is its initial snapshot, its input log starts empty, and its cursor starts at `header.tick + 1`. It is not a continuation, and its log cannot be appended to the log of the session that wrote the snapshot.
- **Fast-forward is an optimization only.** Re-simulation may jump over idle ticks to the next tick at which something can happen. It may never skip:
  - the tick after a committing tick (for example, after a tick whose breaks hit the budget `K`, the next tick breaks more);
  - the next command, a job due, a dirty region waiting for dispatch (ADR 0019 §6), a fragment settling, a field-spec boundary, or a tick inside an active decay zone.

  It must give exactly what stepping gives, and a test compares the two.
- **Named alternative, not built in Phase 4: a session checkpoint.** If CL6 measures re-simulation as too slow for the Studio's replay controls, the session can offer an in-memory checkpoint. It holds:
  - the initial snapshot's state hash and the `schedule` version;
  - a digest of the input-log prefix (every entry with a tick below the cursor);
  - the cursor, the world snapshot (revision and state hash) and the scenario state.

  A checkpoint may be taken only at a quiescent tick boundary: no outstanding job, no dirty region waiting for dispatch, no falling fragment, and a run state other than `waiting`, `stopped` or `failed`. Resuming from it requires the same `schedule`, and its first test compares it with re-simulation.
- Persisting a session or a checkpoint across reloads is Phase 8.

### 3. Input commands, replay and re-simulation

- **Input log.** It records commands, not outcomes:
  - entries are `{ tick, seq, command }`, ordered by `(tick, seq)`;
  - `seq` is the session's receive order within that tick;
  - every command is stamped with the **cursor**, the tick that has not run yet. This holds whether the session is running, paused, waiting or stopped. A command is never stamped from `header.tick`;
  - a command for a tick that has already run is refused.

  Commands change scenario data (field specs, event triggers, anchors, pins), cancel a job, or **resolve a late stop** (`abandon` or `retry`, §6). Scenario data is session state carried by the log; it is not world state.
- **Header.** The input log carries the initial snapshot's state hash and a **`schedule` version**: the system list, its order and its parameters (K, L, S and the budgets).
- **Replay** (unchanged, ADR 0011) applies the recorded `CommitRecord`s and verifies each state hash. It never runs systems or the solver, so it survives a schedule change.
- **Re-simulation** runs a session from the initial snapshot and the input log. It compares the produced records, and the sequence of session outcomes (job settled, conflicted, abandoned or cancelled; failure; each with its tick and id), with the recorded ones. A late stop is **not** an outcome: whether a machine stops depends on its speed (§6). It refuses a `schedule` mismatch and an initial snapshot whose hash differs from the log's.
- This keeps system versions out of `versions.rules`, in line with the owner's decision P3D-4 (a) of 2026-11-27 for Phase 3: changing a system makes old input logs refuse to re-simulate, but never makes a snapshot refuse to load. The `schedule` version itself is part of this proposal and is not decided. `versions.rules` changes only when world state, validation or derivation change: `Patch.tick` (§1) and ADR 0019's new state do.

### 4. Order of one tick (fixed; part of `schedule`)

1. **Apply the input commands for tick `t`**, in `seq` order, including any that arrive while the session waits at step 2. They change session state only and commit nothing. An `abandon`, `retry` or `cancel` at `t` removes that job from the jobs due at `t`.
2. **Barrier:** every job still due at `t` has a result, or the session waits (§6). Nothing after this step runs before the barrier is passed. Re-simulation knows every command of `t` in advance, so it never waits for a job that a recorded command resolved.
3. **Settle due results:** each job due at `t`, in `(due tick, job id)` order, through `applyProposal`. Each is its own commit with origin `job`. Its read set is compared with the state left by the commits before it. Before committing, the session checks that the drafted result anchors what it instantiates (ADR 0019 §6).
   - `conflict`: the job is marked for re-dispatch at step 7, against the state at the end of the tick, under a new job id, due at `t + L`; at most twice, then it is abandoned. Re-dispatching at step 7 rather than now means the job reads the shell after this tick's breaks.
   - `invalid` (including a result from an older `versions.rules`, which the version check refuses first), or a failed support check: the job is abandoned and a diagnostic is published.
   - None of these stops the session.
4. Sample fields at `t`: pure, integer or correctly rounded only (proposal §2.5). "No `pow`" means no operation whose result can differ between engines. Exact power-of-two scaling like the existing `2 ** 500` in `windStrength` is proposed to be allowed. (P3D-4 (a) kept that formula for Phase 3; it decided nothing about Phase 4.)
5. **Run systems in order, each on the state drafted by the previous ones.** CL1 adds one world export, `draftPatch(catalog, state, patch)`, which runs exactly the checks of `applyPatch` (`advance`) and returns the drafted state. The systems, in order:
   1. `windFold` (fold angles);
   2. `decay` (damage);
   3. `structural` (break within budget, ADR 0019);
   4. `detach` (unanchored components);
   5. `settle` (fragments that reach rest at `t`).

   - **Drafting is cumulative from the tick's base state.** System *k* plans on `draftPatch(base, ops of systems 1…k−1)`, never on a draft of a draft. A chain of drafts would advance the revision once per system, so ids, lineage `at` and `consumed.by` (`ops.ts`) would differ from the single commit. The cumulative draft has one revision, and its ids and lineage equal the commit's. Cost: up to five drafts per committing tick, measured at CL1.
   - **Each system sees a declared view.** Today `systemView` holds placed entities and their definitions only (`systems.ts`). The structural, detach and settle systems also need bonds, broken keys and detached entities. CL1 and CL3 therefore extend the view a system can declare. The scheduler keeps the check `runSystem` makes today, that no op touches an entity outside the declared view, because it does not call `runSystem`.
6. **Commit the system patch once:** all the tick's system ops as one patch at tick `t`, or nothing. `applyPatch` re-runs every check. CL1 tests that this commit gives the same entities, bonds and lineage as the last cumulative draft.
7. **Dispatch jobs:** plan dirty regions (when, see ADR 0019 §6) and re-dispatch the jobs retried at step 1 or marked at step 3, all due at `t + L`, reading the state committed at step 6. A job id is `(t, ordinal)`. One counter per tick hands out the ordinals in a fixed order: retries by old job id, then conflict re-dispatches by old job id, then new regions. No other step mints a job id.
8. Advance the cursor to `t + 1` and publish the snapshot.

Seeds are scoped `(world seed, t, system id, scope)` (ADR 0017).

### 5. Atomicity and failure (P4-4 a)

**Recommended: separately atomic commits with fixed failure points.** A tick is a short sequence of atomic transactions, not one transaction: zero or more job commits, then at most one system commit. Each commit is all-or-nothing. "One patch per tick" means one *system* patch per tick.

| Where | Cause | Session afterwards | Already committed at `t` | How the run continues |
|---|---|---|---|---|
| Barrier (step 2) | a result due at `t` is missing | `waiting`, then `stopped { reason: "late", job, tick: t }` after the bound | nothing of tick `t` | a recorded command at `t` (§6), applied as in step 1; then the tick continues from the barrier, once |
| Step 3 | `conflict` or `invalid` result, or a failed support check | unchanged; outcome and diagnostic published | the job commits before it | continues; not a failure |
| Steps 5–6 | a system op is rejected | `failed { tick: t, system, issue }`, **terminal** | the job commits of step 3 stand | reset only. No retry. Fixing the defect changes the `schedule` version, so the old input log is kept as a record and no longer re-simulates |
| Any | a commit made outside the session | `failed { reason: "external-commit" }`, terminal | — | reset |

- **Why nothing is applied twice.** Commands change only session state and are applied once each, in `seq` order, before the barrier; nothing that commits runs before the barrier is passed. So each command of tick `t` is applied once. A failed session never runs tick `t` again, so no settlement or command is repeated. A rejected system op is a defect, and it fails the same way on every run. Re-simulation therefore reproduces the same failure at the same tick and system, after the same records.
- **The cursor** stays at `t` when the session stops or fails at `t`. `status()` reports the step.
- **Diagnostics are observable** through `status()` and the published snapshot event. They carry the system or job id, the tick and the world's rejection payload, and they are part of the outcome sequence that re-simulation compares. Nothing is swallowed or logged only to the console.
- **Alternative: one validated transaction per tick.** All due settlements and system ops would be drafted and committed as one patch.
  - For: one state hash per tick, and a tick that is entirely committed or not at all.
  - Against: a record has one origin, so per-job provenance would leave the record. Each job's write-set and read-set checks would have to run against a cumulative draft and then be merged into one patch, which the world cannot do today: the write-set check is internal to `applyProposal` and `draftProposal` (`region.ts`), and both draft at their own revision. A conflict or invalid job inside the transaction would have to be dropped from the draft and the rest re-drafted.
  - **Not recommended for Phase 4.** With the failure points fixed as above, separate commits cannot duplicate anything, and they need no new world transaction. Their extra cost is one state hash per settled job, on the rare ticks that settle one. The owner decides (P4-4).
- **Cost.** A settle tick costs one proposal commit per due job plus one system commit. The packet's figures (§5.1) are a proposal commit p95 of 15.5–22.9 ms and a single-op commit p95 of 6.7–9.9 ms at 1,591 entities. They come from one shared, loaded Apple M5 Pro: they are **evidence, not a performance proof**. A settle tick may exceed 33.3 ms; it is then a visible hitch, logged, not a failure. CL1 and CL5 measure again on a clean SHA, with the load stated.

### 6. Late worker: a deterministic barrier with a bounded wait (P4-2 a)

- At the barrier of tick `t`, a job due at `t` whose result has not arrived **holds the cursor**. Wall time may decide only *when to stop waiting*, never *what commits*.
- The simulation waits asynchronously. The UI thread stays responsive, and the run state shows `waiting { job, since }`. `since` is wall time, shown and never recorded.
- **Bound.** After a wall-clock limit (proposed 5 s), the session moves to `stopped { reason: "late", job, tick: t }` and cancels nothing on its own. The bound is a user-interface setting. It is not in the `schedule` and not in the log.
- **The stop itself is not recorded**, because a faster machine would not stop at all. Only a resolution that changes an outcome is recorded, as a command at tick `t`:
  - **`abandon(job)`:** the ruin stays, and the job is dropped as if solved to "no change". A result that arrives afterwards is ignored. Re-simulation applies the same abandon without waiting for the worker.
  - **`retry(job)`:** cancel the late job at step 1, then re-dispatch the same request at step 7, with the same seed and so the same result, **under a new job id** from that step's single counter, due at `t + L`. A new id is required: both worker hosts silently ignore a request whose job id is still running (`packages/wave/src/host.ts` and `packages/genesis/src/host.ts`, the `running.has(message.job)` guard), so a retry under the old id would never be answered. The old id's result, if it arrives, is ignored. Re-simulation dispatches the retry at the same tick, under the same new id.
  - **Keep waiting:** not recorded, because it changes nothing. The result still settles at `t`.
- **Re-simulation** waits without the user-interface bound. If its own worker is late past the caller's limit, it reports "re-simulation incomplete at `t`", never a divergence.
- Results are keyed by job id. The order in which they arrive never matters.
- **Unsolvable within budget** is decided by the solver's deterministic node and backtrack budgets (ADR 0015), never by time: an `unsatisfiable` or `budget-exceeded` outcome abandons the job with a diagnostic. The worker hosts already use wall time (`now`), but only to slice the work and pace progress messages. It never selects an outcome.
- **Cancellation.** A user's cancel is a recorded command at a tick. Cancelling an outstanding job because a new dirty region overlaps it is a deterministic decision of step 7, so re-simulation makes it again and it is not recorded. A cancelled job commits nothing, using the existing worker host cancellation, and a result that arrives after the cancel is ignored.

### 7. Budgets per tick kind (measured at CL1 before any becomes a gate)

| Tick kind | Proposed p95 at about 1.6k entities |
|---|---|
| Idle | ≤ 1 ms (no commit) |
| Systems only (one tick patch) | systems ≤ 8 ms + commit ≤ 16 ms |
| With a settled re-collapse | + one proposal commit per job (15.5–22.9 ms p95 on 2026-11-26, decision packet §5.1: one machine, under load, evidence only); may exceed one tick and is then a visible hitch, logged, not a failure |

Catch-up is capped at 4 ticks per frame, as in the proposal. These budgets are proposals. The one-district figures show that they are plausible, not that they hold.

## Options not recommended

- **Record every tick (P4-3 b):** an O(world) hash per idle tick, about 30 records a second, no information.
- **Resume from a world snapshot at `max(header.tick + 1, last input tick + 1)`** (the earlier draft): it loses elapsed idle ticks, the scenario state and pending work (§2).
- **Commit results at arrival (P4-2 b):** live runs would not re-simulate; reproduction would rest on replay only.
- **Record the late stop itself:** a faster machine would produce a different log for the same inputs.
- **Retry a failed system stage:** a rejected op is a defect and fails again; retrying would also re-apply the tick's commands.
- **Version systems in `versions.rules`:** refuses every snapshot whenever a system changes (P3D-4 b, not chosen by the owner).
- **A timeout that silently abandons:** wall time would decide state.

## Test-first cases (public seams: `@eschaton/world`, `@eschaton/collapse`; no mocks, no sleeps, an explicit session clock)

- "an idle tick commits nothing and leaves the header tick and state hash unchanged"
- "a patch with a tick below the header tick is refused"
- "a steady wind after the folds have settled leaves the tick idle" (no op for an unchanged angle)
- "the same initial snapshot and input log re-simulate to the same records and outcomes" (Node; the engines job for Chromium, Firefox and WebKit)
- "re-simulation refuses an input log with another schedule version, and replay of the same records still succeeds"
- "re-simulation refuses an initial snapshot whose hash differs from the input log's"
- "a command for a tick that has already run is refused"
- **Long idle intervals** (the counterexamples of §2):
  - "after 10,000 idle ticks, a command is stamped with the cursor, not with the header tick + 1, and re-simulation applies it at the same tick";
  - "a gust whose window starts at absolute tick 5,000 commits its first fold at tick 5,000 after a 4,000-tick idle interval, live and in re-simulation";
  - "re-simulating to cursor n gives the cursor, outstanding jobs and falling fragments of the live session at n" (a fragment detached at tick 100, an unrelated commit at tick 104);
  - "fast-forward over idle ticks gives the same records and outcomes as stepping";
  - "the tick after a tick whose breaks hit the budget K is never skipped by fast-forward".
- **Commit and failure:**
  - "the committed system patch gives the same entities, bonds and lineage as the last cumulative draft, when three systems emit ops in one tick";
  - "a system op that touches an entity outside the system's declared view fails the session";
  - "a conflicting result is re-dispatched after the tick's system patch, under a new job id, and reads the shell after that tick's breaks";
  - "a rejected system op fails the session with the system id and tick, keeps the job commits settled at that tick, and re-simulation fails at the same tick and system";
  - "a failed session refuses step and run, and accepts only reset";
  - "a commit made outside the session fails it with external-commit".
- **Late, abandoned, retried and cancelled jobs** (a worker host the test resolves by hand):
  - "a result due at tick t that has not arrived holds the cursor at t";
  - "commands submitted while the session waits at t are stamped t and applied before the barrier is passed";
  - "a job abandoned by a command recorded at t is not waited for in re-simulation";
  - "a late job abandoned by command leaves the ruin, ignores a result that arrives afterwards, and re-simulates to the same records without waiting";
  - "a late job retried by command at t settles at t + L under a new job id, and a result for the old id is ignored, live and in re-simulation";
  - "a cancelled job commits nothing, even when its result arrives".

## Consequences

- The clock raises `invariants@n` (§1), shared with ADR 0019's bump if they ship together. `header.tick` already exists and `Patch.tick` is optional, so no state field is added. CL1 checks whether log and snapshot parsing (`SNAPSHOT_SCHEMA`, `packages/world/src/state.ts`) need a schema bump for the new field.
- The input log is a new artefact, owned by the session, not by the world.
- Wall time appears in exactly one place, the late-result bound, and only as a reason to stop. It never enters a log.
- One new world export (`draftPatch`) and a wider declarable system view. No new origin kind and no new transaction API.

## Review of 2026-11-27 (what changed in this draft, and why)

The owner asked for the draft's design issues to be reviewed and repaired. That request is not an acceptance; every recommendation above still needs the owner's decision.

| Issue in the 2026-11-26 draft | Repair |
|---|---|
| Resuming at `max(header.tick + 1, last input tick + 1)` loses elapsed idle ticks; absolute field sampling, command stamping and future scheduling then diverge. The snapshot also lacks scenario state and pending fragments | §1–§2: the cursor and `header.tick` are separate facts; no resume from a world snapshot; continuation in memory or by exact re-simulation; a checkpoint is a named, quiescent-only alternative, not built |
| Job settlements committed before the system patch, a system failure leaving them committed with the cursor at the same tick, and "the whole tick is rejected" stated at the same time; a retry could have repeated commands and settlements | §4–§5: a tick is a sequence of atomic commits; the failure points are fixed; a system failure is terminal; the single-transaction alternative is compared and not recommended |
| The late stop was implicitly part of the history, and "wait" was a recorded command | §6: the stop is not recorded; only `abandon` and `retry` are; re-simulation never waits on the user-interface bound |
| A retry under the same job id would be dropped silently by the worker hosts while the old job still runs | §6: a retry cancels the old job and uses a new job id |
| Chained drafts advance the revision once per system, so the single commit could not match their lineage | §4 step 5: cumulative drafting from the tick's base |
| `systemView` holds placed entities only, and the out-of-view check lives in `runSystem`, which the scheduler bypasses | §4 step 5: a wider declarable view; the scheduler keeps the check |
| The barrier ran before the commands that resolve a late job, and a conflicting job was re-dispatched before the tick's breaks | §4: commands, then barrier; re-dispatch at step 7 under a new id |
| The late stop was listed as a compared outcome | §3: not an outcome |
| Fast-forward could skip the tick after a budget-limited tick | §2: listed ticks are never skipped |
| `Patch.tick` changes validation, which ADR 0011 versions | §1: an `invariants@n` raise |
| The origin kind `tick` does not exist | §1: the existing `{ kind: "system", id: "tick" }` |
| Ids minted by chained drafts differ from the commit's | §4 step 5: cumulative drafting from the tick's base, and a commit-equals-draft test |
| A world change made outside the session would break re-simulation silently | §1: the session is the only writer; an external commit fails it |
| Benchmark figures read as a performance argument | §5, §7: evidence from one loaded machine, not a proof; re-measured at CL1 and CL5 |
