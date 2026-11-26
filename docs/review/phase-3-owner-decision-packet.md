# Phase 3 — owner decision packet (2026-11-26)

- Status: **DECISION REQUEST. Nothing here is decided, approved or waived.** Every item waits for the owner, by its id. The `P3D-` prefix avoids the Phase 3 milestone labels G0–G7.
- Base: written against `main` @ `8f4f106` (PR #9 merged). **Re-checked against `main` @ `6024a1b`** (PRs #9, #7 and #8 merged; main CI run 45784820181, both jobs green). PRs #7 and #8 changed documentation only, so the evidence below still holds. Canonical evidence:
  - [`../phase-3-exit.md`](../phase-3-exit.md) (§6 decisions, §8 addendum);
  - [`phase-3-closure-audit.md`](phase-3-closure-audit.md);
  - [`phase-3-visual-walkthrough.md`](phase-3-visual-walkthrough.md);
  - ADR 0017, "Choices to confirm" 1–9.
- Proposals referenced, none accepted:
  - [`../governance/phase-gate-proposal.md`](../governance/phase-gate-proposal.md) (GOV-1…GOV-8);
  - [`../plans/phase-4-collapse-proposal.md`](../plans/phase-4-collapse-proposal.md) (P4-1…P4-10);
  - draft ADRs [0018](../decisions/0018-clock-tick-and-system-order.md) (clock, tick, system order) and [0019](../decisions/0019-structural-support-and-bond-failure.md) (support and bond failure). Both are **Proposed**; neither is accepted.

## 1. What has and has not been authorized

| Kind | Status |
|---|---|
| **Merge authorization** | Given by the owner on 2026-11-26 for PR #4 (`870ef62`), and later for PRs #9, #7 and #8. Each was merge-only. **This PR (#10) is not covered** |
| **Phase 3 gate** (pass, pass with conditions, keep open) | **Not decided** |
| **Visual approval** at prototype level | **Not given.** The walkthrough records observations only, from an automated run nobody watched |
| **ADR 0017 choices 1–9** | **Not confirmed.** The ADR is "Accepted for Phase 3" under W7; the choices beyond the master plan wait for the gate |
| **Manual GPU checks C1–C6** on the Windows RTX 5070 | **Pending, not waived.** Only an Apple M5 Pro (Metal) was exercised; it is not the target machine |
| **Governance (GOV-1…8)** | Proposal only. No setting, ruleset, workflow or credential was changed |
| **Phase 4 implementation (P4-1…10, ADR 0018 and 0019)** | **Not authorized.** Proposal and drafts only; no code exists |
| **Release** | None. No tag or release exists or is proposed |

A merge does not imply any other row, and neither does a word such as "next".

## 2. Decisions that block closing the Phase 3 gate

P3D-1 depends on the others: the recommended outcome holds only if the owner actually decides P3D-2 to P3D-6 as recommended. If P3D-2 is "reject", the consistent outcome is "keep open".

| Id | Decision | Options | Recommendation and rationale |
|---|---|---|---|
| **P3D-1** | Phase 3 gate outcome (exit §6.1) | pass · pass with conditions · keep open | **Pass with conditions**, *conditional on* the owner deciding P3D-2 (own look, accept) and P3D-3, P3D-4 and P3D-6 as recommended, and setting a deadline for P3D-5. The exit criteria of master plan §11 are met and audited. The two settlement defects and the wind defect are fixed test-first, and CI is green on the merged head. What is still open is visual quality and target-hardware evidence, which do not affect the logic Phase 4 builds on |
| **P3D-2** | Visual review (exit §6.2) | accept at prototype level · accept with listed gaps · reject | **Accept with listed gaps, but only after the owner's own look** (§6 checklist). The plan reads as a settlement: core towers, roads, river, bridge and plaza, and two districts join at the seam. Known gaps: roads and river hard to read in 3D, box-like towers, unreadable roofs at district scale, no sky or depth. They are art and camera work for Phases 5 and 7, not generation. Visual approval is not given and is never inferred from tests or screenshots |
| **P3D-3** | ADR 0017 choices 1–8 (exit §6.3–6.4; choice 7 is the 1e-9 catalog grid) | confirm · change individual choices | **Confirm all eight as implemented.** Each is recorded with its limits (exit §7). The repository holds no stored snapshot or log that choice 7 affects. That says nothing about data saved outside the repository, which the owner alone can know |
| **P3D-4** | ADR 0017 choice 9: wind formula and system versioning | (a) keep `sqrt` with power-of-two scaling, no version change · (b) version systems in `versions.rules` · (c) back to `Math.hypot` | **(a).** Logs record outcomes, so replay is unaffected. The Studio sends only axis winds, which are bit-identical. (b) makes every existing snapshot refuse to load (`rules-mismatch`) for a change that no committed outcome depends on. (c) is engine-dependent and fails the three-engine pin. Draft ADR 0018 proposes versioning systems in the re-simulation input log rather than in `versions.rules` |
| **P3D-5** | RTX 5070 test C1–C6 ([`../testing/webgpu-manual-test.md`](../testing/webgpu-manual-test.md)) | run before the gate · make it a condition with a deadline · waive (owner only) | **Make it a condition.** Proposed deadline: before any Phase 5 (Atmosphere) work. This deadline is a proposal, not approved. Phase 5 is where the renderer and hatching quality are judged, and C5 (hatching stability) and C6 (frame feel) can only be judged there by a human. Phase 4 is logic and simulation and does not depend on it. Not waived |
| **P3D-6** | Cross-engine determinism as a product promise (exit §6.5) | promise for named browsers · keep as a tested property | **Keep as a tested property.** Four artefacts are pinned on Node, Chromium, Firefox and WebKit: solver digest, catalog fingerprint, district seed 1 hash and an off-axis wind fold. That is a finite corpus. It shows the property for those inputs and is not a guarantee for every input or browser version. Decide any promise at Phase 7 (P4-9) |

## 3. Decisions that can be deferred, with a target

| Id | Item | Recommended handling |
|---|---|---|
| ADR 0010 Q5 | Tombstone compaction | Defer to Phase 8 (persistence and streaming); nothing grows unbounded in Phases 3–4 |
| ADR 0010 Q9 | Conservation key (appearance-derived `MaterialId`) | Defer to before Phase 6 (reconstruction), where it becomes observable; P4-8 |
| ADR 0010 Q10 | Group on detach | Same as Q9; Phase 4 keeps the provisional rule and pins it with a test (P4-8) |
| ADR 0012 Q5 | Socket table placement interpretation | Confirm as implemented, or defer; no later phase changes it |
| ADR 0006 | Hatching on moving pieces | Defer to Phase 5, together with P3D-5 |
| ADR 0011 | Incremental state hash (hash-format change) | Defer: not needed for a one-district slice (§5.1). Decide only if the owner wants more than about 3k entities committing at 30 Hz (P4-10) |
| Studio | Offset-toggle details, UI-only `homes` map (exit §6.6) | Defer; UI-only, no world state |
| GOV-1 | Separate decision kinds (merge ≠ gate ≠ visual ≠ ADR ≠ next phase ≠ release) | **Decide now (adopt):** this packet is already structured that way, and adopting it changes no setting |
| GOV-2…GOV-8 | Ledger, agent identity, rulesets, review policy, invalidation paths, migration, validator | Defer to before the Phase 4 gate. GOV-4a (GitHub Pro or public) is the owner's cost call and comes before GOV-4. Implementation needs its own authorization |

## 4. Phase 4 readiness: decisions only if the owner authorizes Phase 4

These come after P3D-1, under a separate Phase 4 authorization. Defaults are the proposal's, refined by the draft ADRs. "Needed by" is the first milestone (proposal §5) that cannot start without the decision.

| Id | Question | Options | Recommended default | Needed by |
|---|---|---|---|---|
| P4-1 | Where clock and systems live | (a) new `@eschaton/collapse`; (b) inside `@eschaton/world` | (a) | CL1 |
| P4-2 | When worker results commit | (a) at `t + L`; the clock waits, bounded by fail-stop; (b) at arrival, tick recorded | (a), with ADR 0018's bound: a late result pauses the session with a diagnostic, and the owner's resume or abandon is a recorded command. Wall time never selects a committed outcome | CL5 |
| P4-3 | Idle ticks | (a) no record, header tick = last committing tick; (b) record every tick | (a); the session's cursor is not world state, and resuming needs a quiescent point (ADR 0018) | CL1 |
| P4-4 | System emits an invalid op | (a) fail-stop the tick; (b) drop that system's ops | (a) | CL1 |
| P4-5 | Structural state in the read-set digest | (a) add it; (b) placement only | (a). The digest is transient and never persisted, so this needs no hash-format change and no version bump of its own (§5.2) | CL5 |
| P4-6 | Snapshots from before the rules bump | (a) refuse (current policy); (b) written migration (`broken = []`, `damage = 0`) | (a), unless the owner has saved data outside the repository. The repository holds no snapshot or log that would need it. ADR 0019 proposes an encoding that keeps Phase 3 entity and bond content byte-identical, so (b) would be only a header rewrite and a new hash | CL3 |
| P4-7 | What re-collapse may not touch | (a) derive protection from world content; (b) persist the semantic plan | (a) | CL5 |
| P4-8 | Q9, Q10, Q5 | keep provisional · decide now | Keep provisional; decide before Phase 6 | deferrable |
| P4-9 | Cross-engine re-simulation as a promise | promise · tested property | Tested property; decide at Phase 7 | deferrable |
| P4-10 | Tick commit cost at 9k entities | (a) incremental hash; (b) checkpoint hashes; (c) commit only changing ticks, one-district slice | **(c)** for Phase 4, now measured (§5.1); (a) deferred until a larger live area is wanted | CL1 |

Draft ADRs 0018 and 0019 are offered for review together with this list. Accepting them is part of CL0, not of the gate.

## 5. Technical risks for the next phase, with the smallest mitigation (design only)

### 5.1 Commit cost against a 30 Hz tick (33.3 ms)

- **Earlier figure:** `hashState` took 28 ms at 9,158 entities. This was a **single sample** from the six-district chain, run at `62cf1e3` at load 19–20 (exit §5, `benchmarks/phase-3/`). It is evidence, not a gate.
- **Re-measured at `6024a1b`** (clean tracked tree, an isolated worktree), using only the existing harnesses on the Node main thread of an Apple M5 Pro (18 cores). Load average while measuring: 1-minute 3.3–6.0, 15-minute 32→30, still decaying from earlier heavy use. The machine was not idle and is shared. These are local figures, not CI. The outputs went to the gitignored `benchmarks/runs/` only; no tracked artefact changed.

  | Harness | Entities | Measure | Result |
  |---|---:|---|---|
  | `profile:commit` (synthetic P08 grid), 2 runs × 60 rounds | 1,591 | `hashState` | p50 3.4–4.1, **p95 5.5–8.9**, p99 6.1–11.0 ms |
  | | 1,591 | one `detach` commit (validate + hash) | p50 4.1–4.7, **p95 6.7–9.9** ms |
  | | 9,158 | `hashState` | p50 22.0–26.4, **p95 40.6–48.1**, p99 49.4–51.7 ms |
  | | 9,158 | one `detach` commit | p50 24.7–28.3, **p95 39.7–53.0** ms |
  | | 1,591 / 9,158 | apply an 8×4×8 wave proposal | p95 15.5–22.9 / 62.2–65.5 ms |
  | `profile:genesis` chain (one sample per size) | 1,591 / 9,158 | `hashState` | 3.4 / 25.9 ms |
  | `profile:genesis` corpus, 12 seeds | ~1.6k | district settle | p50 32.6, p95 57.8 ms |

- **Assessment:**
  - At 9k entities, a single-op commit takes most of a tick at p50 and **exceeds the tick at p95**. Committing every tick at 9k entities does not fit. The earlier 28 ms single sample understated the tail.
  - At one district (about 1.6k entities), a single-op commit has a p95 of at most 10 ms. That leaves about 23 ms for systems, validation and audit. The proposal's budget fits: systems p95 ≤ 8 ms, commit p95 ≤ 16 ms at 2k entities.
  - A tick that settles a re-collapse proposal costs more: about 16–23 ms p95 at 1.6k entities for the commit alone. Such ticks are rare, because a job is due `L` ticks later. ADR 0018 therefore budgets this tick kind separately.
  - **The one-district slice is sound.** It combines P4-10 (c) with commits only on ticks that change state. The 9k-entity tick stays a measured CL1 item, not a gate.
  - Only if the owner wants a larger live area at 30 Hz does the incremental hash (P4-10 a, a hash-format change with a migration, ADR 0011) come back.

### 5.2 Read-set gap: structural state is not in the region digest

- **Fact:** `readRegion`'s digest covers catalog, rules, conservation mode, the region, and each read entity's id, definition, anchor and rotation. Fold angles, bonds, broken bonds and damage are not covered. Phase 3 is not affected. A Phase 4 re-collapse that relies on "these neighbours are intact" could commit on top of a neighbour that broke after the job read it.
- **The digest is never persisted.** `CommitRecord` holds `revision`, `tick`, `origin`, `patch` and `stateHash` (`packages/world/src/patch.ts`). Read and `depends` digests live only between dispatch and settlement.
- **Smallest mitigation (P4-5, specified in draft ADR 0019 §6):**
  - Add to the digest, for read entities only: damage, every stored or broken bond with at least one end among them (boundary-crossing ones included), and nothing about fold angles. The ADR 0019 stress rule does not read fold angles, and they never change occupancy (ADR 0003).
  - This changes a transient token: no hash-format change and no version bump of its own. A job in flight across an upgrade gets a `conflict` and is re-dispatched. The rules bump comes from the new state fields (P4-6).
  - Test: "a re-collapse proposal conflicts when a bond in its read shell breaks after the read".

### 5.3 Exterior protection needs a precise statement

Proposal invariant 4 says every exterior bond is identical after a re-collapse. That is too strong:
- consuming a piece inside the region removes its bonds to exterior neighbours;
- a new piece inside the region bonds to its exterior neighbours.

ADR 0019 §7 restates the invariant as follows:
- exterior entities keep id, definition, pose, fold angles and damage;
- bonds and broken records with both ends outside the region are unchanged;
- records with one end inside may change only through the proposal's own `consume` and `instantiate` ops.

Conservation: re-collapse mints, so it needs conservation `off` (refused in closed mode, ADR 0016). Detach and split conserve, so collapse alone stays valid in closed mode.

## 6. Running the Studio, and the owner's visual checklist

**Current instance, checked 2026-11-26 16:22 local time (UTC+7):**

| | |
|---|---|
| URL | `http://localhost:5181/`, loopback only. Vite is bound to `[::1]:5181`, so use `localhost`, not `127.0.0.1` |
| Source | Worktree `/Users/cuong/Desktop/repo/eschaton-wt/studio-final`, detached at `6024a1b` (= `origin/main`), clean |
| Processes | `pnpm --filter @eschaton/studio dev` PID 29941; `vite` PID 29964 (listener); started 15:38 local time |
| Readiness | `GET /` → 200, `GET /src/main.tsx` → 200 (served from source). A headless Chromium loaded the UI. Its renderer stayed at "Backend starting…", so the headless check shows that the page loads, not that it renders |
| Tunnel | None. Nothing is exposed beyond loopback |

The walkthrough's "Running the Studio yourself" section describes an earlier instance (`870ef62`, PIDs 51205 and 51244). It is no longer listening.

To start a fresh instance from the latest `main` without disturbing other worktrees:

```sh
cd /Users/cuong/Desktop/repo/eschaton
git fetch origin && git worktree add --detach ../eschaton-wt/studio-owner origin/main
cd ../eschaton-wt/studio-owner && pnpm install --frozen-lockfile
STUDIO_PORT=5182 pnpm --filter @eschaton/studio dev   # then: curl -s -o /dev/null -w "%{http_code}" http://localhost:5182/
```

**Owner checklist for P3D-2.** Tick each item yourself; the reference is [`../../assets/reference/visual-direction.png`](../../assets/reference/visual-direction.png).

1. Status bar shows **Backend `WebGPU`** and **GPU class `physical`**. Then reload with `?forceWebGL=1` and confirm **Backend `WebGL2`** renders the same district. On this Mac that is Metal, not the RTX 5070 (P3D-5 stays pending).
2. **World → Genesis, seed 1 → Generate.** Plaza, core towers, roads, river and bridge are recognisable as a settlement.
3. **Seed 3** (a lot retry happens; the result should still look complete) and **seed 11** (the most entities).
4. **Generate next district (east):** the seam between the two districts. Roads and the river continue without a visible break.
5. Toggle **Lot roles** and **Network routes**. Then, with them off, judge whether road and river read in 3D (a listed gap).
6. **Roofs** at district scale (a listed gap: often unreadable).
7. **Camera:** orbit (`O`) and the composition camera. Are framing and depth acceptable for a prototype? Sky and depth are a listed gap.
8. **Decorative offsets** on two districts, then **Replay**: the same districts come back.
9. Verdict per P3D-2: accept · accept with listed gaps (say which gaps are acceptable) · reject.

## 7. Suggested order, and the approval template

1. Look at the Studio (§6) → **P3D-2**.
2. **P3D-3, P3D-4, P3D-6**: confirmations, each with a recommended default.
3. **P3D-5**: the C1–C6 condition and its deadline.
4. **P3D-1**: the gate outcome, consistent with 1–3.
5. **GOV-1** (optional now).
6. Separately, and only if wanted now: Phase 4 authorization, P4-1…10, and review of ADR 0018 and 0019.
7. Separately: whether to merge this PR.

Copy, delete what does not apply, and reply:

```text
Owner decisions, <date>:
P3D-2 visual (after my own look): accept | accept with gaps: <which> | reject
P3D-3 ADR 0017 choices 1–8: confirm | change <n>: <how>
P3D-4 choice 9: a | b | c
P3D-5 RTX 5070 C1–C6: condition due before <Phase 5 | date> | run before gate | waive
P3D-6: tested property | promise for <engines>
P3D-1 gate: pass with conditions P3D-2, P3D-5 | pass | keep open
GOV-1: adopt | defer
Phase 4 implementation: not now | authorize CL0–CL7 with P4 defaults | authorize with changes: <ids>
ADR 0018 / 0019 drafts: accept | accept with changes: <…> | revise | not now
Merge PR #10: yes | no
```

Each line is independent. A line left out is not decided.
