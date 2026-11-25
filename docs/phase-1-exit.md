# Phase 1 exit report: Foundation

- Phase: **1 — Foundation** (master plan v1.1 §11; milestones in [`plans/phase-1-foundation.md`](plans/phase-1-foundation.md))
- Branch / PR: `phase-1`, PR #2 (draft, stacked on `phase-0` @ `5b2a995`; not merged)
- Date: 2026-11-25
- Authorization: owner decision D7 (2026-11-25), after the conditional Phase 0 closure (D6; [`phase-0-exit.md`](phase-0-exit.md) §9)
- Status: **AT THE PHASE 1 EXIT GATE, awaiting the owner.** Nothing in this report approves the gate.
  - Exit approval, the visual review, ADR 0014 and the flagged interpretations (§6) belong to the owner.
  - Phase 2 is not authorized and was not started.

## 1. Exit criteria (master plan §11, Phase 1 row) mapped to tests

All tests import only `@eschaton/world` or `@eschaton/foldon`, or drive the Studio in a real browser. They use no mocks, spies or sleeps. Every test helper that commits also asserts `checkInvariants(...) == []` on the new state. `applyPatch` itself refuses to commit any state that fails the invariants.

| Criterion | Evidence (test titles; files under `packages/*/test` and `apps/studio/e2e`) |
|---|---|
| Valid and invalid connections | "touching entities with incompatible sockets are rejected" and "instantiating an unknown definition is rejected without minting anything" (`world/identity`). "re-attaching a fragment where its sockets do not mate is rejected and the fragment stays detached" (`world/bonds`). The Phase 0 assembly tests (`foldon/assembly`). |
| Transform, occupancy and identity invariants | "instantiating the same assembly twice at overlapping anchors rejects the second patch"; "instantiating the same assembly at two world poses yields disjoint entity ids and occupied cells"; "entity ids do not depend on recipe part ids" (mutation-checked) (`world/identity`). "a fragment detached from a placed entity starts at that entity's logical transform" (mutation-checked) (`world/bonds`). |
| Attach/detach and round-trip serialization | "detaching a placed roof frees its cells and keeps its entity id"; "attach creates a bond for each mated socket pair and detach removes exactly those"; "attaching an entity that is already placed is rejected" (`world/bonds`). "a populated world round-trips through a snapshot to an equal state and hash"; "a snapshot whose entities were tampered into overlapping cells is rejected on load"; plus the empty-world, newer-schema and catalog-mismatch snapshot tests (`world/snapshot`). |
| Roof and leaf share behaviour without inheritance | "wind folds both a roof and a leaf through the same system"; "an entity without wind-responsive is not folded"; "a system cannot change entities outside its declared components" (`world/systems`). Class `extends` is a lint error in every first-party file (`tools/architecture`). |
| Identity and ownership invariants: no duplicate ownership, stable ids, acyclic lineage | A single `owner` union per entity makes duplicate ownership unrepresentable. Tests in `world/lineage`: "split children carry new ids and lineage to their parent; the parent becomes consumed"; "a consumed entity cannot be attached"; "moving a fragment through inventory keeps its id and the material totals"; "lineage stays acyclic and forward-only after a seeded sequence of random splits and merges"; "an id is never minted again after its entity is consumed"; plus the closed-conservation tests. |
| Transaction atomicity and rollback | Tests in `world/patch`: "a committed patch raises the revision by exactly one"; "a stale patch is rejected and consumes no revision"; "a proposal whose read region was untouched by an intervening commit is still rejected under strict equality"; "a patch whose final op is invalid leaves none of its earlier ops applied"; "replaying the commit log reproduces the live state hash"; "a corrupted commit record is reported as a divergence at its revision"; "replay against a different catalog version is refused"; "replay against a different rules version is refused". |
| Directional socket compatibility tests | Tests in `foldon/sockets`: "migrating the profile table changes no primitive, assembly or hash" (literal pre-M3 hashes); "a C1 door profile mates with a road only at its relation turn"; "a quarter-turned C4 piece mates exactly where the unturned one does" (fails when the rule uses gcd, verified twice); "handed side faces mate only left-to-right"; "a table with an illegal self-pair relation is rejected"; "a catalog socket whose profile is not in the socket table is rejected"; "a catalog compiles a door on a road only at the relation turn of its own socket table". |

## 2. Milestones

| Milestone | Status | Commits (`phase-1`) | Acceptance evidence |
|---|---|---|---|
| Start: physical-GPU smoke test (D5) | Done for an Apple GPU; the RTX 5070 run is still pending | `072db74` | §5 |
| ADR 0014 bonds | Drafted, **Proposed** | `b611008`, `ee04c69` | Two interpretations flagged (§6) |
| M0 `@eschaton/world`, immutable state, snapshot | Done | `eccba64` | `world/snapshot` (6 tests); architecture lint for `world` (8 tests) |
| M1 patch, revision, commit log, replay | Done | `e01ac3a`, `7a5908b` | `world/patch` (8 tests) |
| M2 identity, placement, derived occupancy | Done | `dd24926` | `world/identity` (5 tests) |
| M3 directional sockets (lcm) | Done; ran in parallel on `phase-1-m3` and merged locally | `47928a2`, `6319cbc`, merge `ac1b0d7`, `7a5908b` | `foldon/sockets` (7 tests) |
| M4 bonds, attach/detach | Done | `dbe4c9d` | `world/bonds` (6 tests) |
| M5 lineage, inventory, conservation | Done | `9296551` | `world/lineage` (7 tests) |
| M6 systems, roof/leaf | Done | `f744e0e` | `world/systems` (5 tests); `leaf` preset in `foldon` |
| M7 World mode in the Studio | Done; ran in parallel on `phase-1-m7` and merged locally | `3671dad`, merge `b7c700a` | `apps/studio/e2e/world.spec.ts` (5 tests); screenshots `p1-world-mode*.png` |
| M8 self-assembly precursor (not WFC) | Done | `ff0ea45` | `world/assemble` (5 tests) |
| M9 exit evidence | This report | `6ac884b`, `b8f2f45`, `3a35dae`, `f3f6f34`, this commit | §3–§5 |

## 3. Demonstrations

- **Replay:**
  - `replay` re-applies the commit log and matches the live hash (`world/patch`).
  - In the Studio, "Replay log" shows `match <hash>` (e2e "replaying the commit log in the Studio reproduces the live state hash").
  - The rebuild study (27 commits, 1,233 entities) replays to the same hash, `79bb58b0560088a4`, in headless software Chromium and in Chrome on a physical GPU.
- **Roof and leaf in the Studio:** the World mode wind control runs `windFold` through `runSystem`. An over-strong gust is shown as a rejection, and the state is unchanged (e2e "applying wind commits a new revision and an over-strong gust is shown as a rejection").
- **Self-assembly precursor:**
  - `assemble` rebuilds a roof-module and a 27-piece watchtower from stored fragments with the same entity ids, also under closed conservation.
  - It builds a different recipe from the same pieces.
  - It fails before committing anything when a piece is missing, and stops at the first rejected step with a valid last state.
- **ADR 0013 rebuild study** (`?study=rebuild`; [`review/p1-rebuild-study.json`](review/p1-rebuild-study.json)):
  - The reference composition, rebuilt from validated world commits at one uniform cell size of 4.4 units, using the same seeded corridor, composition camera and backdrop generators.
  - Contents: 1,199 logical entities and 34 authoritative debris fragments, in 27 commits. 0 candidates were rejected and 11 were moved 1–3 cells off the overlaps that the unvalidated look-dev layout contains.
  - **Not reproduced:**
    - per-instance non-uniform stretch (towers 4.4×7.4, slab blocks, ground slabs);
    - the barren tree and the free-angle beams, because neither placements nor fragments carry non-uniform scale;
    - the 620-unit ground slabs and the skyline (backdrop candidates);
    - free yaw, snapped to quarter turns.
  - Screenshots:
    - `screenshots/p1-rebuild-old.png`: Phase 0 look-dev composition;
    - `screenshots/p1-rebuild-new.png`: rebuilt, zero offsets;
    - `screenshots/p1-rebuild-new-offsets.png`: illustrative ADR 0013 envelope, look-dev toggle;
    - `screenshots/p1-webgpu-m5pro-rebuild.png`: the same on a physical GPU.
  - **Agent observation, not a verdict:**
    - The rebuilt scene keeps the composition: tower masses at left, the corridor winding into the distance, the sun, the ridges.
    - It reads clearly more "toy block": a window-grid cube cladding on every mass, a tiled corridor, shorter and blockier towers, small houses, no tree, skyline or ground layering.
    - This is the ADR 0002 / master plan §13 risk made visible.
    - The levers recorded in the ADR 0002 amendment (group offsets, internal-edge outline suppression, larger-footprint primitives, non-unit vertical cell) are untested.
  - **The visual verdict is the owner's.** ADR 0013's choices are: accept as the Phase 3 baseline, widen the envelope, change primitives or cell size, or take up the irregular-lattice study.

## 4. Validation

**Evaluated SHA for CI:** `3a35dae` (the last code commit). The commits after it, `f3f6f34` (benchmark evidence) and this report, change documentation, recorded JSON and screenshots only. Their own CI run on the final `phase-1` head is recorded in the PR #2 description.

| Check | Where | Result |
|---|---|---|
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | local (macOS 26.5.1, Apple M5 Pro, Node v24.20.0, pnpm 10.33.4) | exit 0 |
| `pnpm test` | local and CI | foldon 46, architecture 51, world 42, WFC 13: **152 passed** |
| `pnpm e2e` | CI ([run 45552524180](https://github.com/cuongtranba/eschaton/actions/runs/45552524180), job 138996766598) | **26 passed** (21 Phase 0 + 5 World mode) |
| `pnpm e2e` | local, `--workers=1` | 26 passed |
| GitHub Actions `CI` on `3a35dae` | run 45552524180 | **success** (178 tests) |

Local flakiness, recorded honestly:
- On this Mac, under machine load from other processes (load average up to about 90), the parallel e2e run timed out on two long Phase 0 lab tests: "selecting every catalog item…" and "switching items repeatedly…", against a local timeout of 30 s.
- Once, the WFC experiment's 5 s unit-test timeout was also hit.
- The untouched Phase 0 head `5b2a995` failed a different lab test under the same load at the same time.
- Every one of these passed when re-run quietly and in CI. None was weakened, skipped or retried away.
- "switching items repeatedly" uses about 25 s of its 30 s local budget even on a quiet machine; CI allows 90 s.

## 5. Benchmarks and GPU

Recorded on clean commit `3a35dae` ([`../benchmarks/phase-1/2026-11-25-3a35dae8f/`](../benchmarks/phase-1/2026-11-25-3a35dae8f/)), Apple M5 Pro, Node v24.20.0, load average 6.6–10 during the run. Every commit includes the full invariant check and state hash.

| Measure | p50 | p99 |
|---|---|---|
| Commit: instantiate a watchtower (27 entities) into an empty world | 0.69 ms | 0.95 ms |
| Commit: one detach in a 100-entity world | 2.3 ms | 2.5 ms |
| Commit: one detach in a 1,000-entity world | 33 ms | 69 ms |
| `hashState`, 1,000 entities | 7.4 ms | 24 ms |
| Replay of a 50-commit log | 30 ms | 42 ms |
| `assemble` a watchtower from inventory (27 patches) | 18 ms | 23 ms |
| `runSystem(windFold)` over a roof-module and a leaf | 0.12 ms | 0.20 ms |

- These numbers come after four measured fixes made during M9 (`6ac884b`), none of which changes behaviour:
  - a 16-bit-limb FNV, shared by `foldon` and `world`;
  - native canonical JSON;
  - indexed contacts computed once per check;
  - bonds settled once per patch.
- In scratch runs under the same load, a 1,000-entity commit went from about 290 ms to about 38 ms.
- **Limitation:** a commit is O(n) in entities (copy, invariants, hash), as ADR 0011 states. One commit per user command is acceptable at Lab size (§9.1, 100–1,000 pieces). The District and Stress sizes need structural sharing or incremental hashing, chosen on measurement.

**GPU status:**
- **Start of Phase 1 (`072db74`):** checks C1–C4 of the manual test, automated on an Apple M5 Pro with Chrome 158, passed on both WebGPU (`apple metal-3`, class `physical`) and WebGL2 (ANGLE Metal).
- **At M9:** World mode and the rebuild study also render on WebGPU with class `physical`, with no shader errors (`screenshots/p1-webgpu-m5pro-world.png`, `p1-webgpu-m5pro-rebuild.png`).
- **Still pending:** the owner's target, Windows Chrome with an RTX 5070 ([`testing/webgpu-manual-test.md`](testing/webgpu-manual-test.md)), and the human checks C5 (hatching stability under orbit) and C6 (frame feel). No Phase 1 milestone criterion depends on the GPU beyond these. CI renders on software WebGL2.

## 6. Decisions for the owner at this gate

1. **Phase 1 gate:** pass, pass with conditions, or keep open.
2. **Visual review:**
   - World mode (`screenshots/p1-world-mode*.png`);
   - the ADR 0013 rebuild study (§3), choosing one of ADR 0013's four outcomes.
   This is required at every gate.
3. **ADR 0014 (Proposed):**
   - interpretation 1: `instantiate` also creates bonds;
   - interpretation 2: `empty–empty` and wildcard contacts are bonds.
4. **Interpretations recorded in plan §2a:**
   - socket table as data with `CatalogInput.sockets` and an open `SocketProfile` (ADR 0012 Q5);
   - the Studio offset toggle using the illustrative envelope;
   - offset pivot and seed details (M7);
   - `homes` as UI-only state;
   - the M7 undo test dropped, because history branching is forbidden.
5. **Open owner questions** (not blocking):
   - the conservation key: appearance `MaterialId` versus a matter class (ADR 0010 Q9);
   - the group on detach (Q10, provisionally unchanged);
   - tombstone compaction (Q5);
   - cross-engine generation determinism (ADR 0004, Phase 2 scope);
   - hatching on moving pieces (ADR 0006, Phase 5 scope).
6. **The RTX 5070 manual test**, or its continued deferral.

## 7. Known limitations

- **Commit cost:** O(n) per commit (§5). No structural sharing.
- **Bonds:** they carry strength data only. Nothing breaks them until Phase 4. In Phase 1 the stored bonds always equal the derived contacts.
- **Fragment transforms:** set only by `detach` (logical pose) and `retrieve` (explicit transform). There is no physics or settling (Phase 4).
- **Systems:** run only when invoked. No tick or order (Phase 4).
- **Self-assembly:** greedy and recipe-driven, bottom-up by `y`. It does not search alternatives or check support beyond socket validity.
- **Decorative offsets:** zero by default. The illustrative envelope is look-dev only. ADR 0013 invariant 5 ("rendered shape within margin") is not implemented.
- **Studio:**
  - World mode selects entities from a list; there is no 3D picking.
  - The rebuild study takes a few seconds to build on load.
  - The look-dev reference composition is unchanged and still bypasses validation, labelled as look-dev.
- **Unpushed Home work:** any unpushed work on the Home machine is unknown and was not inspected.
