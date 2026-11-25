# Phase 1 owner decisions (R1–R8)

- Date: 2026-11-25
- Source: the owner's written authorization "OWNER AUTHORIZATION R1–R8 — Eschaton, 2026-11-25". Decisions are recorded as given. Conditions and their evidence are named; nothing beyond a decision is inferred.
- Gate report: [`../phase-1-exit.md`](../phase-1-exit.md). Earlier decisions D1–D7: [`phase-0-owner-review.md`](phase-0-owner-review.md) §0.

| # | Decision | Condition and evidence |
|---|---|---|
| R1 | **Correct the commit path:** `applyPatch` must refuse a catalog or rules version other than the world's, with a failing public regression first; bind validation to an immutable catalog identity without an O(catalog) cost per transaction; review and document the engine/version policy | Reproduced and fixed in commit `2803622`. ADR 0011, "Corrections and decisions at the Phase 1 gate" |
| R2 | **Correct the module-contract asymmetry** between `instantiate` and `planAssembly`; clarify where a contract applies; one placement definition; do not over-constrain primitives | Reproduced and fixed in commit `87c1852`. ADR 0008, "Correction at the Phase 1 gate" |
| R3 | **Approves ADR 0014 with amendments:** `instantiate` creates bonds like `attach`; `empty–empty` is never a structural bond; the `open` wildcard is non-bonding unless an explicit rule permits it; contact, legal adjacency, bond eligibility and strength are distinct; one versioned source of rules. No Phase 4 force or damage | Commit `1c05fce`. ADR 0014, "Amendments (owner R3)" |
| R4 | **Approves the regular-lattice direction of ADR 0013.** Explore expressive primitives, footprints and proportions as studies; the grid is logical, not visually prescriptive; no irregular lattice, no arbitrary widening of authoritative transforms; do not polish the manual scene. **World mode and the rebuild study are accepted as prototype-level evidence, not final visual approval.** Material lattice-contract changes must be proposed, not adopted silently | ADR 0013 and ADR 0002, "Owner direction". Full fidelity stays with the Genesis, Atmosphere and The Last District gates |
| R5 | **Defers generic undo.** Keep deterministic replay and atomic rollback; document future compensating transactions as distinct from history branching. Record the plan §2a interpretations and the unresolved non-blocking choices **without inferring approvals** | ADR 0011 (R5 section); plan §2a (status column); the unconfirmed rows stay unconfirmed |
| R6 | **Conditionally closes Phase 1** only after the R1–R5 corrections and evidence, synchronized documents, and lint, typecheck, unit, build, e2e, architecture checks and remote CI green on the exact final head. The gate is not passed on CI alone | Evidence: exit report §8 and the PR #2 description. Mac physical-GPU C1–C4 is recorded as verified; the Windows RTX 5070 run and the human checks (hatching stability, frame feel) stay **pending**, with no waiver |
| R7 | **Authorizes planning and implementing Phase 2 (Wave)** from `main` after the closure and both merges, within the stated scope, stopping at the Phase 2 exit gate | No Phase 2 PR merge and no Phase 3 work without separate approval. A genuinely new material decision outside the authorization must be surfaced |
| R8 | **Authorizes merging PR #1, then PR #2**, after their gates and exact-head required checks pass, preserving the stacked history. No other merges, no bypass of checks | Merge order, method, checks and resulting SHAs are recorded in both PR descriptions and in the Phase 2 plan, which is written after the merges |

## Not decided by R1–R8

These stay open or unconfirmed (plan §2a): the conservation key (ADR 0010 Q9); the group on detach (Q10); tombstone compaction (Q5); the socket-table placement interpretation (ADR 0012 Q5); the Studio offset toggle and its details; the UI-only `homes` map; cross-engine generation determinism (ADR 0004); hatching on moving pieces (ADR 0006); the RTX 5070 manual test.
