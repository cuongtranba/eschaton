# Phase 3 — owner decision packet (2026-11-26)

- Status: **DECISION REQUEST, partly decided.** On 2026-11-27 the owner decided **P3D-4, P3D-5, P3D-6 and GOV-1** and authorized the merge of this PR as proposal documentation (§0). **Everything else here is still undecided, unapproved and unwaived**, and waits for the owner by its id. The `P3D-` prefix avoids the Phase 3 milestone labels G0–G7.
- Sections 1–7 are the request as written on 2026-11-26. Where §0 records a decision, the affected rows say so; their original options and rationale are kept as history.
- Base: written against `main` @ `8f4f106` (PR #9 merged). **Re-checked against `main` @ `6024a1b`** (PRs #9, #7 and #8 merged; main CI run 45784820181, both jobs green). PRs #7 and #8 changed documentation only, so the evidence below still holds. Canonical evidence:
  - [`../phase-3-exit.md`](../phase-3-exit.md) (§6 decisions, §8 addendum);
  - [`phase-3-closure-audit.md`](phase-3-closure-audit.md);
  - [`phase-3-visual-walkthrough.md`](phase-3-visual-walkthrough.md);
  - ADR 0017, "Choices to confirm" 1–9.
- Proposals referenced (none accepted, except GOV-1, adopted as policy on 2026-11-27, §0):
  - [`../governance/phase-gate-proposal.md`](../governance/phase-gate-proposal.md) (GOV-1…GOV-8);
  - [`../plans/phase-4-collapse-proposal.md`](../plans/phase-4-collapse-proposal.md) (P4-1…P4-12);
  - draft ADRs [0018](../decisions/0018-clock-tick-and-system-order.md) (clock, tick, system order) and [0019](../decisions/0019-structural-support-and-bond-failure.md) (support and bond failure). Both are **Proposed**; neither is accepted.

## 0. Owner decisions recorded on 2026-11-27

- **Source:** an explicit owner instruction, given in the handoff message that opened a new Kanna agent session on 2026-11-27 and recorded here by the agent. No GitHub review, signed commit or comment from a separate identity attests it, so its provenance class is "agent-recorded, owner-attributed" (governance proposal §1.1). No ledger entry exists (GOV-2 is not adopted).
- **Base:** `main` @ `03760d2` (PR #12 merged), the revision this PR was brought up to before the decisions were recorded.

| Id | Kind | Decision | What it does and does not mean |
|---|---|---|---|
| **P3D-4** | `adr` (ADR 0017 choice 9) | **(a)**: keep the current `sqrt` wind formula with power-of-two scaling, **no version change** | Preserves the implementation on `main` (`windStrength` in `packages/world/src/systems.ts`, as fixed by the closure audit). `versions.rules` is unchanged and no system version field is added. It does **not** accept the `schedule` version that draft ADR 0018 §3 proposes for Phase 4; that stays a proposal |
| **P3D-5** | condition with a deadline | The RTX 5070 test C1–C6 is **due before any Phase 5 (Atmosphere) work**. **Not waived** | A deadline, not a waiver. The test stays **PENDING**: no result exists for that machine, and the Apple M5 Pro run does not count for it. Phase 5 is not authorized either; the deadline only fixes the latest point at which the check must be recorded |
| **P3D-6** | policy | Cross-engine determinism stays **a tested property, not a product guarantee** | The tested scope is finite: four pinned artefacts (solver golden digest, catalog fingerprint, district seed 1 state hash, the off-axis `[0.1, 0.1, 0.1]` wind fold) on Node and on the Chromium, Firefox and WebKit builds the CI engines job installs (Chromium 159, Firefox 159 and WebKit 27.2 at the closure audit). Nothing is promised for other inputs, browsers or versions. P4-9 (re-simulation across engines) stays a separate, pending decision |
| **GOV-1** | governance policy | **Adopt** the separation of decision kinds: merge, gate, ADR, visual, next-phase authorization and release are separate decisions, and none implies another | Policy only. Not adopted: the ledger and its entry schema (GOV-2), any agent identity (GOV-3), rulesets or enforcement (GOV-4a, GOV-4), review policy, invalidation paths, migration and the validator (GOV-5…GOV-8). No GitHub setting, workflow, ruleset or credential was changed |
| Merge of PR #10 | `merge` | Authorized **as proposal documentation only**, subject to review and green CI | Merging accepts no ADR, approves no visual, passes no gate and authorizes no phase. ADR 0018 and 0019 stay **Proposed** |

**Still not decided** (each waits for its own owner decision):
- **P3D-1:** **not decided.** The owner's instruction reads "Phase 3 remains open (P3D-1 keep open)". It is recorded as keeping the item and the gate open, not as a gate decision chosen among P3D-1's options. No gate decision of any kind has been made, and closing the gate needs one.
- **P3D-2:** visual review. **Not approved.**
- **P3D-3:** ADR 0017 choices 1–8. **Not confirmed.**
- ADR 0018 and ADR 0019: **Proposed**, not accepted. The owner asked for their design issues to be reviewed and repaired, which this PR does as drafts; that request is not an acceptance.
- P4-1…P4-12 and any Phase 4 implementation: **not authorized.**
- GOV-2…GOV-8: not adopted.
- The deferrable items in §3, other than GOV-1.

## 1. What has and has not been authorized

| Kind | Status |
|---|---|
| **Merge authorization** | Given by the owner on 2026-11-26 for PR #4 (`870ef62`), and later for PRs #9, #7 and #8. Each was merge-only. On 2026-11-27 the owner authorized merging **this PR (#10) as proposal documentation only**, subject to review and CI (§0) |
| **Phase 3 gate** (pass, pass with conditions, keep open) | **Not decided.** The gate stays open; the owner's instruction of 2026-11-27 keeps P3D-1 open (§0) |
| **Visual approval** at prototype level | **Not given.** The walkthrough records observations only, from an automated run nobody watched |
| **ADR 0017 choices 1–9** | Choice 9 **decided (a)** on 2026-11-27 (P3D-4). Choices 1–8 **not confirmed** (P3D-3). The ADR is "Accepted for Phase 3" under W7 |
| **Manual GPU checks C1–C6** on the Windows RTX 5070 | **Pending, not waived.** Due before any Phase 5 work (P3D-5, 2026-11-27). Only an Apple M5 Pro (Metal) was exercised; it is not the target machine |
| **Governance (GOV-1…8)** | GOV-1 **adopted** as policy on 2026-11-27. GOV-2…GOV-8 are proposals only. No setting, ruleset, workflow or credential was changed |
| **Phase 4 implementation (P4-1…P4-12, ADR 0018 and 0019)** | **Not authorized.** Proposal and drafts only; no code exists |
| **Release** | None. No tag or release exists or is proposed |

A merge does not imply any other row, and neither does a word such as "next".

## 2. Decisions that block closing the Phase 3 gate

P3D-1 depends on the others: the recommended outcome holds only if the owner actually decides P3D-2 to P3D-6 as recommended. If P3D-2 is "reject", the consistent outcome is "keep open".

**Status on 2026-11-27 (§0):** P3D-4, P3D-5 and P3D-6 are decided as recommended. P3D-1 is not decided, and the gate stays open (§0). P3D-2 and P3D-3 are pending, and they are what a later "pass with conditions" would still depend on.

| Id | Decision | Options | Recommendation and rationale |
|---|---|---|---|
| **P3D-1** | Phase 3 gate outcome (exit §6.1) | pass · pass with conditions · keep open | **Pass with conditions**, *conditional on* the owner deciding P3D-2 (own look, accept) and P3D-3, P3D-4 and P3D-6 as recommended, and setting a deadline for P3D-5. The exit criteria of master plan §11 are met and audited. The two settlement defects and the wind defect are fixed test-first, and CI is green on the merged head. What is still open is visual quality and target-hardware evidence, which do not affect the logic Phase 4 builds on |
| **P3D-2** | Visual review (exit §6.2) | accept at prototype level · accept with listed gaps · reject | **Accept with listed gaps, but only after the owner's own look** (§6 checklist). The plan reads as a settlement: core towers, roads, river, bridge and plaza, and two districts join at the seam. Known gaps: roads and river hard to read in 3D, box-like towers, unreadable roofs at district scale, no sky or depth. They are art and camera work for Phases 5 and 7, not generation. Visual approval is not given and is never inferred from tests or screenshots |
| **P3D-3** | ADR 0017 choices 1–8 (exit §6.3–6.4; choice 7 is the 1e-9 catalog grid) | confirm · change individual choices | **Confirm all eight as implemented.** Each is recorded with its limits (exit §7). The repository holds no stored snapshot or log that choice 7 affects. That says nothing about data saved outside the repository, which the owner alone can know |
| **P3D-4** — **decided (a), 2026-11-27** | ADR 0017 choice 9: wind formula and system versioning | (a) keep `sqrt` with power-of-two scaling, no version change · (b) version systems in `versions.rules` · (c) back to `Math.hypot` | **(a).** Logs record outcomes, so replay is unaffected. The Studio sends only axis winds, which are bit-identical. (b) makes every existing snapshot refuse to load (`rules-mismatch`) for a change that no committed outcome depends on. (c) is engine-dependent and fails the three-engine pin. Draft ADR 0018 proposes versioning systems in the re-simulation input log rather than in `versions.rules` |
| **P3D-5** — **decided 2026-11-27: due before any Phase 5 work, not waived** | RTX 5070 test C1–C6 ([`../testing/webgpu-manual-test.md`](../testing/webgpu-manual-test.md)) | run before the gate · make it a condition with a deadline · waive (owner only) | **Make it a condition.** Proposed deadline: before any Phase 5 (Atmosphere) work. (As written on 2026-11-26 this deadline was a proposal; the owner decided it on 2026-11-27, §0.) Phase 5 is where the renderer and hatching quality are judged, and C5 (hatching stability) and C6 (frame feel) can only be judged there by a human. Phase 4 is logic and simulation and does not depend on it. Not waived |
| **P3D-6** — **decided 2026-11-27: tested property** | Cross-engine determinism as a product promise (exit §6.5) | promise for named browsers · keep as a tested property | **Keep as a tested property.** Four artefacts are pinned on Node, Chromium, Firefox and WebKit: solver digest, catalog fingerprint, district seed 1 hash and an off-axis wind fold. That is a finite corpus. It shows the property for those inputs and is not a guarantee for every input or browser version. Decide any promise at Phase 7 (P4-9) |

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
| GOV-1 — **adopted 2026-11-27** | Separate decision kinds (merge ≠ gate ≠ visual ≠ ADR ≠ next phase ≠ release) | **Decide now (adopt):** this packet is already structured that way, and adopting it changes no setting. Adopted as policy only (§0) |
| GOV-2…GOV-8 | Ledger, agent identity, rulesets, review policy, invalidation paths, migration, validator | Defer to before the Phase 4 gate. GOV-4a (GitHub Pro or public) is the owner's cost call and comes before GOV-4. Implementation needs its own authorization |

## 4. Phase 4 readiness: decisions only if the owner authorizes Phase 4

These come after P3D-1, under a separate Phase 4 authorization. **The options, recommended defaults and rationale are canonical in the proposal, [`../plans/phase-4-collapse-proposal.md`](../plans/phase-4-collapse-proposal.md) §7**, revised on 2026-11-27 with the design review of the draft ADRs. They are not restated here, so the two cannot drift. "Needed by" is the first milestone (proposal §5) that cannot start without the decision.

| Id | Question | Where the detail is | Needed by |
|---|---|---|---|
| P4-1 | Where clock and systems live | proposal §2.1 | CL1 |
| P4-2 | When worker results commit, and the late-result bound | ADR 0018 §6 | CL5 |
| P4-3 | Idle ticks, and how a run continues (no resume from a world snapshot) | ADR 0018 §2 | CL1 |
| P4-4 | A system emits an invalid op; separate atomic commits or one transaction per tick | ADR 0018 §5 | CL1 |
| P4-5 | Structural state in the read-set digest | ADR 0019 §6, §5.2 below | CL5 |
| P4-6 | Snapshots from before the rules bump | ADR 0019 §1 | CL3 |
| P4-7 | What re-collapse may not touch | proposal §2.7 | CL5 |
| P4-8 | Q9, Q10, Q5 | proposal §2.8 | deferrable |
| P4-9 | Cross-engine re-simulation as a promise (P3D-6 settles only the Phase 3 corpus) | proposal §2.9 | deferrable |
| P4-10 | Tick commit cost at 9k entities | §5.1 below | CL1 |
| P4-11 | Non-structural pieces after a collapse (new, 2026-11-27) | ADR 0019 §5 | CL3 |
| P4-12 | When a re-collapse job is dispatched (new, 2026-11-27) | ADR 0019 §6 | CL5 |

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
  - **The one-district slice looks feasible on this evidence; it is not proven.** It combines P4-10 (c) with commits only on ticks that change state. The figures come from one shared machine under load, from synthetic and corpus harnesses rather than a running clock, so they show the budget is plausible, not that it holds. CL1 measures the real tick on a clean SHA with the load stated, and the 9k-entity tick stays a measured CL1 item, not a gate.
  - Only if the owner wants a larger live area at 30 Hz does the incremental hash (P4-10 a, a hash-format change with a migration, ADR 0011) come back.

### 5.2 Read-set gap: structural state is not in the region digest

- **Fact:** `readRegion`'s digest covers catalog, rules, conservation mode, the region, and each read entity's id, definition, anchor and rotation. Fold angles, bonds, broken bonds and damage are not covered. Phase 3 is not affected. A Phase 4 re-collapse that relies on "these neighbours are intact" could commit on top of a neighbour that broke after the job read it.
- **The digest is never persisted.** `CommitRecord` holds `revision`, `tick`, `origin`, `patch` and `stateHash` (`packages/world/src/patch.ts`). Read and `depends` digests live only between dispatch and settlement.
- **Mitigation:** specified in draft ADR 0019 §6, decided as P4-5 (options and default only in proposal §7). In short, the digest gains the bond state of read entities. It changes a transient token, so it needs no hash-format change and no version bump of its own. Revised 2026-11-27: damage is left out, because decay changes it every tick and would make every job near a decay zone conflict.

### 5.3 Exterior protection needs a precise statement

Proposal invariant 4, as written on 2026-11-26, said every exterior bond is identical after a re-collapse. That is too strong:
- consuming a piece inside the region removes its bonds to exterior neighbours;
- a new piece inside the region bonds to its exterior neighbours.

ADR 0019 §7 restates the invariant by what the proposal consumes, not by which cells lie in the region (revised 2026-11-27, because "no cell in the region" left out entities only partly inside it and detached fragments):
- every entity the proposal does not consume keeps id, definition, owner and pose, fold angles and damage;
- every bond and broken record with neither end consumed is unchanged;
- the only bond changes are the removal of those with a consumed end and the addition of those with an instantiated end.

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

**Re-checked 2026-11-27 11:59 local time:** the same instance (listener PID 29964) still answers `GET /` with 200 on `http://localhost:5181/`, served from the clean `studio-final` worktree at `6024a1b`. `main` is now `03760d2`; everything after `6024a1b` changes documentation only (`AGENTS.md`, `README.md`, `docs/governance/geometry-quality-gates.md`), so the served code is the code on `main`. This checks that the page is served, not that it renders.

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
6. Separately, and only if wanted now: Phase 4 authorization, P4-1…P4-12, and review of ADR 0018 and 0019.
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

On 2026-11-27 the owner answered the P3D-4, P3D-5, P3D-6, GOV-1 and merge lines (§0). The lines still open are P3D-2, P3D-3, a final P3D-1 outcome, Phase 4 implementation and the ADR 0018 and 0019 drafts.
