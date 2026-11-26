# Phase 3 — owner decision packet (2026-11-26)

- Status: **DECISION REQUEST. Nothing here is decided, approved or waived.** Every item waits for the owner, by its id.
- Base: `main` @ `8f4f106` (PR #9 merged). Canonical evidence:
  - [`../phase-3-exit.md`](../phase-3-exit.md) (§6 decisions, §8 addendum);
  - [`phase-3-closure-audit.md`](phase-3-closure-audit.md);
  - [`phase-3-visual-walkthrough.md`](phase-3-visual-walkthrough.md);
  - ADR 0017, "Choices to confirm" 1–9.
- Proposals referenced:
  - [`../governance/phase-gate-proposal.md`](../governance/phase-gate-proposal.md) (GOV-1…GOV-8);
  - [`../plans/phase-4-collapse-proposal.md`](../plans/phase-4-collapse-proposal.md) (P4-1…P4-10).

## 1. What has and has not been authorized

| Kind | Status |
|---|---|
| **Merge authorization** | Given by the owner on 2026-11-26 for PR #4 (`870ef62`), and later for PRs #9, #7 and #8. Each was merge-only |
| **Phase 3 gate** (pass, pass with conditions, keep open) | **Not decided** |
| **Visual approval** at prototype level | **Not given.** The walkthrough records observations only |
| **ADR 0017 choices 1–9** | **Not confirmed.** The ADR is "Accepted for Phase 3" under W7; the choices beyond the master plan wait for the gate |
| **Manual GPU checks C1–C6** on the Windows RTX 5070 | **Pending, not waived.** Only an Apple M5 Pro (Metal) was exercised; it is not the target machine |
| **Governance (GOV-1…8)** | Proposal only. No setting, ruleset, workflow or credential was changed |
| **Phase 4 authorization (P4-1…10)** | **Not authorized.** Proposal only; no code exists |
| **Release** | None. No tag or release exists or is proposed |

A merge does not imply any other row.

## 2. Decisions that block closing the Phase 3 gate

| Id | Decision | Options | Recommendation and rationale |
|---|---|---|---|
| **G3-1** | Phase 3 gate outcome (exit §6.1) | pass · pass with conditions · keep open | **Pass with conditions** G3-2 and G3-5. The exit criteria of master plan §11 are met and audited. The two settlement defects and the wind defect are fixed test-first, and CI is green on the merged head. What is still open is visual quality and target-hardware evidence, which do not affect the logic Phase 4 builds on |
| **G3-2** | Visual review (exit §6.2) | accept at prototype level · accept with listed gaps · reject | **Accept with listed gaps.** The plan reads as a settlement: core towers, roads, river, bridge and plaza, and two districts join at the seam. Known gaps: roads and river hard to read in 3D, box-like towers, unreadable roofs at district scale, no sky or depth. They are art and camera work for Phases 5 and 7, not generation. **This needs the owner's own look**: see §6 to run the Studio |
| **G3-3** | ADR 0017 choices 1–8 (exit §6.3–6.4; choice 7 is the 1e-9 catalog grid) | confirm · change individual choices | **Confirm all eight as implemented.** Each is recorded with its limits (exit §7). No stored snapshot or log is affected by choice 7 |
| **G3-4** | ADR 0017 choice 9: wind formula and system versioning | (a) keep `sqrt` with power-of-two scaling, no version change · (b) version systems in `versions.rules` · (c) back to `Math.hypot` | **(a).** Logs record outcomes, so replay is unaffected. The Studio sends only axis winds, which are bit-identical. (b) refuses every snapshot for a change no stored data observed. (c) is engine-dependent and fails the three-engine pin. Revisit system versioning when the Phase 4 tick runs systems continuously (P4 ADR 0018) |
| **G3-5** | RTX 5070 test C1–C6 ([`../testing/webgpu-manual-test.md`](../testing/webgpu-manual-test.md)) | run before the gate · make it a condition with a deadline · waive (owner only) | **Make it a condition, due before any Phase 5 (Atmosphere) work.** Phase 5 is where the renderer and hatching quality are judged, and C5 (hatching stability) and C6 (frame feel) can only be judged there by a human. Phase 4 is logic and simulation and does not depend on it. Not waived |
| **G3-6** | Cross-engine determinism as a product promise (exit §6.5) | promise for named browsers · keep as a tested property | **Keep as a tested property.** Four artefacts are pinned on Node, Chromium, Firefox and WebKit: solver digest, catalog fingerprint, district seed 1 hash and an off-axis wind fold. A finite corpus is not a promise. Decide the promise at Phase 7, as P4-9 proposes |

## 3. Decisions that can be deferred, with a target

| Id | Item | Recommended handling |
|---|---|---|
| ADR 0010 Q5 | Tombstone compaction | Defer to Phase 8 (persistence and streaming); nothing grows unbounded in Phases 3–4 |
| ADR 0010 Q9 | Conservation key (appearance-derived `MaterialId`) | Defer to before Phase 6 (reconstruction), where it becomes observable; P4-8 |
| ADR 0010 Q10 | Group on detach | Same as Q9; Phase 4 keeps the provisional rule and pins it with a test (P4-8) |
| ADR 0012 Q5 | Socket table placement interpretation | Confirm as implemented, or defer; no later phase changes it |
| ADR 0006 | Hatching on moving pieces | Defer to Phase 5, together with G3-5 |
| ADR 0011 | Incremental state hash (hash-format change) | Decide inside P4-10, after the CL1 measurement (§4.1) |
| Studio | Offset-toggle details, UI-only `homes` map (exit §6.6) | Defer; UI-only, no world state |
| GOV-1 | Separate decision kinds (merge ≠ gate ≠ visual ≠ ADR ≠ next phase ≠ release) | **Decide now (adopt):** it is how this packet is already structured, and it costs nothing |
| GOV-2…GOV-8 | Ledger, agent identity, rulesets, review policy, invalidation paths, migration, validator | Defer to before the Phase 4 gate. GOV-4a (GitHub Pro or public) is the owner's cost call and comes before GOV-4. Implementation needs its own authorization |
| P4-1…P4-10 | Phase 4 architecture choices | Only after G3-1, with a separate Phase 4 authorization. The proposal's defaults stand, refined as in §4 |

## 4. Technical risks for the next phase, with the smallest mitigation (design only)

### 4.1 Commit cost: state hash against a 30 Hz tick

- **Measured:** `hashState` takes **28 ms** at **9,158 entities**, the sixth district of a six-district chain. A tick at 30 Hz is **33.3 ms**.
  - Conditions: Node main thread, Apple M5 Pro, clean tree at `62cf1e3`, load average 19–20 (not idle). Source: exit §5 and `benchmarks/phase-3/`. It is a local benchmark, not CI.
  - At the same size, the whole district commit was 111 ms and settlement 123 ms. Those include placing about 1,500 new entities, which a tick does not do.
  - At one district (1,591 entities) the hash took 3 ms. ADR 0011 records about 36 ms at 10,000 entities as the dominant cost of a small commit.
- **Why it matters:** a commit per tick at 9k entities leaves about 5 ms for systems, validation and audit. It does not fit.
- **Smallest mitigation, no format change:**
  1. Size the Phase 4 slice to **one district**, as the proposal already does (§1, "a committed Last District"). There the hash is about 3 ms.
  2. Commit **only on ticks that change state** (P4-10 option c). The per-tick failure budget keeps those commits small.
  3. Make the 9k-entity tick a **measured** item in CL1, not a slice gate.
  4. Only if the owner wants 9k entities at 30 Hz is the incremental hash (P4-10 a, a hash-format change with a migration) on the table. That is an owner decision under ADR 0011.

### 4.2 Read-set gap: bonds and damage are not in the region digest

- **Fact:** `readRegion`'s digest covers catalog, rules, conservation mode, the region, and each placed entity's id, definition, anchor and rotation. Fold angles, bonds, broken bonds and damage are not covered.
  - Phase 3 is not affected: generation needs empty ground, and `depends` guard road cells.
  - A Phase 4 re-collapse that relies on "these neighbours are intact" could commit on top of a neighbour that broke after the job read it.
- **Verified here:** the digest is **never persisted**.
  - `CommitRecord` holds `revision`, `tick`, `origin`, `patch` and `stateHash` (`packages/world/src/patch.ts`).
  - A proposal's `read` and `depends` digests live only between dispatch and settlement.
- **Smallest mitigation (refines P4-5):**
  - Add the bond and damage state of the read entities to the digest's canonical content.
  - This is a change to a transient concurrency token. It needs **no hash-format change and no version bump of its own**: a job in flight across an upgrade simply gets a `conflict` and is re-dispatched.
  - The rules bump Phase 4 needs comes from the new state fields (`broken`, `damage`); P4-6 already covers it.
  - Test at the public seam: "a re-collapse proposal conflicts when a bond in its read shell breaks after the read".
- **Design only.** Nothing is implemented, and the Phase 4 plan stays a proposal.

## 5. Suggested order for the owner

1. Run the Studio (§6) and look at seeds 1, 3 and 11 and two districts → **G3-2**.
2. **G3-3, G3-4, G3-6**: confirmations, each with a recommended default.
3. **G3-5**: set the C1–C6 condition and its deadline.
4. **G3-1**: the gate outcome.
5. **GOV-1** (optional now).
6. Only then, and separately: whether to authorize Phase 4, with P4-1…10.

## 6. Running the Studio locally

```sh
git checkout main && git pull --ff-only && pnpm install --frozen-lockfile
STUDIO_PORT=5173 pnpm dev   # then open http://localhost:5173/ and use the Genesis panel
```

The recorded walkthrough used WebGPU on Apple Metal. It is not the RTX 5070 run (G3-5).
