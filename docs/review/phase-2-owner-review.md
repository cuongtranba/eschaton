# Phase 2 owner decisions (W1–W7)

- Date: 2026-11-25
- Source: the owner's written authorization "OWNER AUTHORIZATION W1–W7 — ESCHATON, 2026-11-25". Decisions are recorded as given; conditions and evidence are named; nothing beyond a decision is inferred.
- Gate report: [`../phase-2-exit.md`](../phase-2-exit.md) (§9 holds the closure evidence). Earlier decisions: [`phase-0-owner-review.md`](phase-0-owner-review.md) §0 (D1–D7), [`phase-1-owner-review.md`](phase-1-owner-review.md) (R1–R8).

| # | Decision | Condition and evidence |
|---|---|---|
| W1 | **Verify the Local WFC target in the production browser worker**, not on Node's main thread: clean SHA, recorded load, hardware and browser, fixed seeds, warm-up, at least 100 samples, raw data, a compile / transport / solve / commit breakdown, hard cases and the 28×8×28 stress case reported separately. No claim if contention prevents verification | `benchmarks/phase-2/2026-11-25-fd6aaec31/wave-worker-*.{json,md}`; exit report §9.1. Recorded load was 8–11, not idle; this is stated with the result |
| W2 | **Independent read-only review first, then reproduce and fix confirmed findings with public-interface TDD**; compare against an exhaustive oracle; validate proposals at commit | Review summary and fixes: exit report §9.2; commit `fd6aaec` |
| W3 | **Profile 10,000-entity commits, then implement the smallest justified optimisation**, keeping exact outcomes, hashes, replay, immutability, the full audit as reference and differential tests | Exit report §9.3; `benchmarks/phase-2/commit-profile/`; commit `a48bf9b` |
| W4 | **Approves ADRs 0015 and 0016, conditional on amendments and review corrections.** MRV integer-only cell selection with weighted seeded placement (not Shannon entropy); `needsMate` as a generation-only constraint; the ground plane as a Phase 2 request parameter; content-based read-set comparison with a one-cell shell valid only for local constraints; Phase 3 must extend the read set; closed-inventory reconstruction deferred to Phase 6; tested cross-engine scope with no universal promise | ADR 0015 and 0016, "Amendments (owner W4)"; master plan §5.1 and roadmap amendment 2 |
| W5 | **Add the three-engine golden corpus to CI**, with real worker transport smoke and cancel tests, lean jobs and cached browsers | `.github/workflows/ci.yml`, job "solver determinism and worker transport"; `apps/studio/engines/`; exit report §9.4 |
| W6 | **Accepts the Phase 2 scenes as prototype-level geometric-compatibility evidence**, not final art and not a meaningful district; the original reference stays the anchor and later visual gates remain. **Conditionally closes Phase 2** only after W1–W5 and green checks on the exact final PR #3 head. **Authorizes merging PR #3** when those conditions hold. No other merge | Exit report §9; the PR #3 description records the final-head CI run and the merge |
| W7 | **Authorizes planning and implementing Phase 3 (Genesis)** after the closure and the merge, on a separate branch from merged `main`, stopping at the Phase 3 exit gate | No Phase 3 PR merge and no Phase 4 work without separate authorization |

## Not decided by W1–W7 (preserved as open, not approved)

- Conservation key (ADR 0010 Q9); group on detach (Q10); tombstone compaction (Q5).
- Socket-table placement interpretation (ADR 0012 Q5).
- Studio decorative-offset toggle details and the UI-only `homes` map (plan §2a of Phase 1).
- Hatching on moving pieces (ADR 0006).
- The Windows RTX 5070 manual test and the human checks C5 and C6.
- New after W3: whether to adopt an incremental state hash (a hash-format change; ADR 0011).
