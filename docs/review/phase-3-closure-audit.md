# Phase 3 closure audit (2026-11-26)

- Scope: an independent audit of deterministic and golden-baseline defects on `main` after PR #4, limited to Phase 3. Owner handoff of 2026-11-26, task A.
- Base: `origin/main` @ `870ef62b97b3d6d6fc66bc7f4aadeef4b3684ce5`, the merge of PR #4. It was verified at the start: zero open PRs; main CI run 45757095399, both jobs green.
- Branch: `phase-3-closure`. **Nothing here closes Phase 3 or approves anything.** The gate decisions are listed in §6.

## 1. Summary

| Finding | Kind | Outcome |
|---|---|---|
| A finite wind above about 1.3e154 per component was rejected as "not a finite vector" | **Defect** introduced by `62cf1e3` (`hypot` → `sqrt` of squares overflows) | Fixed test-first, with results bit-identical inside [2^-500, 2^500] (§2.3) |
| `hypot` → `sqrt` changes off-axis wind results in the last bit | Undisclosed compatibility change | Measured and disclosed in ADR 0017, then pinned on Node and three engines. Versioning is left to the owner as ADR 0017 choice 9 (§2) |
| The golden fixed history lost its link to the pre-W3 commit path when it was re-recorded | Lost provenance | Restored by reproduction: pre-W3 code plus only the rounding patch gives the re-recorded hashes (§3) |
| No Node unit test covered the full preset catalog after G0 | Lost coverage | A recorded value is now pinned in Node (district seed 1, `5dc9053d2e6bd656`); nothing was re-recorded (§3.3) |
| `settleDistrict` trusted the result's district box and declared dependencies | **Defect** (a continuation could commit without its neighbour-road check) | Fixed test-first (§4.1) |
| `settleDistrict` could throw on a malformed result, and did not compare road gates and river with the request | **Defect** (second review) | Fixed test-first (§4.13) |
| Other review items: draftProposal, depends, validators, worker cancellation and budget, minor items | Audited | §4 |

## 2. Wind strength: `Math.hypot` → `Math.sqrt` (`62cf1e3`)

### 2.1 Reproduction through public APIs

How it was reproduced:

- In a scratch worktree at `870ef62`, a throwaway Vitest file built the systems-test garden through `@eschaton/world` and `@eschaton/foldon` only: a preset catalog, `roof-module` at the origin and a `leaf` at `[5,0,0]`.
- It ran `runSystem(…, windFold, { wind })` and recorded the state hash and the fold angles.
- It was then run again with only the `windFold` strength line changed back to `Math.hypot`.

The file is not committed.

| Wind | `hypot` | `sqrt` | Same state hash? |
|---|---|---|---|
| `[0.03, 0.04, 0]` | 0.05 | 0.05 | yes |
| `[0.0041, 0.0033, 0.1086]` (seeded) | …784 | …782 | yes (the last-bit change did not reach the angle) |
| `[0.0992, 0.1097, 0.1192]` (seeded) | …516 | …513 | **no** |
| `[0.1, 0.1, 0.1]` | 0.17320508075688773 | 0.17320508075688776 | **no**: leaf 0.35749885235170975 vs 0.3574988523517096; hash `5e3b3822b1e6836b` vs `ea9906626dd9f97b` |
| `[1e200, 0, 0]` | 1e200 (commits, leaf flat) | Infinity → **rejected** `op-invalid` | — |
| `[1e155, 1e155, 0]` | 1.41e155 (commits) | Infinity → **rejected** | — |
| `[MAX_VALUE, 0, 0]` | finite (commits) | Infinity → **rejected** | — |
| `[1e-170, 1e-170, 0]`, `[5e-324, 0, 0]` | tiny | 0 (underflow) | yes: the leaf keeps its rest angle either way |

- **Rate:** 37.3 % of 100,000 seeded winds with components in [0, 0.2) give a different strength on Node 24.20 (V8). This is a sample, not a bound.
- **Replay:** unaffected. `replay` re-applies the recorded `fold` op with its angles (`packages/world/src/patch.ts`) and never re-runs the system.
- **Studio:** unaffected. It only sends `[s, 0, 0]` with `s` in [0, 1], and `sqrt(s*s) === |s|` holds exactly in that range.
- **Golden fixed history:** unaffected. Its wind is `[0.05, 0, 0]`.

### 2.2 Why `sqrt` is the right portable formula, and what is not claimed

- ECMAScript defines `Math.hypot` as implementation-approximated. `*`, `+` and `Math.sqrt` are correctly rounded IEEE 754 operations, and the evaluation order is fixed by the expression.
- So the same input gives the same bits on any conforming engine. That is a property of the operations, not something inferred from the corpus.
- What the tests show is narrower: the pinned off-axis case gives identical angles on Node, Chromium 159, Firefox 159 and WebKit 27.2. **No claim of universal cross-engine determinism for the whole engine is made from that.**

### 2.3 The defect and its fix (test first)

- **Red on `main`:** `packages/world/test/systems.test.ts`, "a finite gust [1e+200,0,0] too strong to square flattens the leaf instead of being rejected as not finite". The `[1e155,1e155,0]` and `[MAX,MAX,0]` cases fail the same way, with `{"kind":"invalid","issues":[{"code":"op-invalid","message":"wind must be a finite vector"}]}`.
- **Fix** (`packages/world/src/systems.ts`, `windStrength`):
  - Finiteness is checked on the components.
  - The norm is computed on components scaled by 2^-600 or 2^600 only when the largest magnitude is outside [2^-500, 2^500]. Power-of-two scaling is exact.
  - The result is clamped to `Number.MAX_VALUE`, so `drag = 0` cannot produce `Infinity × 0 = NaN`.
  - Inside the range the expression is the `62cf1e3` one, so every in-range result is bit-identical. The golden hashes and the off-axis pin did not move.
- **Mutation checks** (run, then reverted):
  - Putting `Math.hypot` back inside `windStrength` fails "a wind off the x axis gives the recorded fold angles, which Math.hypot changes in the last bit".
  - Removing the component finiteness check fails "a wind with an infinite component is rejected" and "a wind with a NaN component is rejected".
- **Cross-engine:** `apps/studio/engines/determinism.spec.ts`, "a wind off the x axis folds to the recorded angles on this browser's JavaScript engine". Local run: 21 passed, 7 tests × Chromium 159.0.8154.6, Firefox 159.0 and WebKit 27.2.
- **Disclosure and owner choice:** ADR 0017, "Wind strength: compatibility disclosure" and choice 9.

## 3. Golden baseline provenance

### 3.1 History

| Commit | What happened to `packages/world/test/golden.test.ts` |
|---|---|
| `a48bf9b` (W3) | Created. The fixed history's hashes (`3337e935…` … `07d2e96c…`) were recorded with the **pre-W3** commit path, on the then `presetCatalog`. That catalog was primitives + `leaf` + assemblies + `column-3` and `l-block`. The test proved the optimised path gives the same hashes |
| `384ecef` (G0) | The catalog was pinned to an explicit subset, so adding `paving`, `water` and `bridge` would not move the hashes. The subset equals the W3-era `presetCatalog` content (verified in §3.2: same hashes). Values unchanged |
| `62cf1e3` | Re-recorded once (`ccf6bbfb…` … `68a3fbdb…`) because the 1e-9 rounding changed the fingerprint. The new values were produced only by the **post-W3** code. The test title lost "recorded before the commit path was optimised" |

**What was lost:**

1. Direct evidence that the re-recorded hashes are what the unoptimised commit path would produce. The W3 equivalence was no longer anchored.
2. Any Node unit test that depends on the full current preset catalog. Only the browser engines job pinned its fingerprint, so a change to a ground preset or any preset outside the subset passed `pnpm test`.

### 3.2 Provenance restored by reproduction (no rebaseline)

Run in a scratch worktree:

```sh
git worktree add --detach ../scratch 11d31d9           # parent of W3: the unoptimised commit path
cd ../scratch && pnpm install --frozen-lockfile --offline
git show 870ef62:packages/world/test/golden.test.ts > packages/world/test/golden.test.ts
pnpm --filter @eschaton/world exec vitest run test/golden.test.ts
#   → fails with exactly the original W3 hashes 3337e935405a6509 … 07d2e96c3ee53825
git show 62cf1e3 -- packages/foldon/src/geometry.ts packages/world/src/systems.ts | git apply -3
pnpm --filter @eschaton/world exec vitest run test/golden.test.ts
#   → 3 passed: the unoptimised path + only the rounding patch gives ccf6bbfbd539d9ef … 68a3fbdb7ab3a443
```

So the current golden values are the pre-W3 path's values under the rounded catalog, and the W3 promise carries over. The historical values stay in git history (`a48bf9b`) and in this record; nothing was rewritten.

### 3.3 Full-catalog coverage restored in Node

- `packages/genesis/test/district.test.ts`: "the Last District, seed 1, commits to the state hash the engines job pins on Chromium, Firefox and WebKit".
- The value `5dc9053d2e6bd656` was already recorded in the Phase 3 exit report §4 and in `apps/studio/engines/genesis.spec.ts`.
- The state hash includes the full catalog fingerprint, the planner, the solver and settlement, so any change to any preset or to the 1e-9 grid now fails `pnpm test`.
- **No hash format change, no new hash value, no mass rebaseline.**

### 3.4 The 1e-9 grid

- Idempotence on authored decimals: 1,714,287 decimals with up to nine places, magnitudes up to 2,000, were checked. None changes under the grid.
- Older snapshots and logs on a catalog containing P03 or P09 are refused as `catalog-mismatch`. Existing tests cover that path: `world/test/{patch,snapshot,region}.test.ts`.
- The ADR's caveat stands: a value within about 1e-16 of a grid midpoint could still round differently on another engine. The engines job pins the fingerprint so a regression would fail CI.

## 4. Review items

Audited by reading the code at `870ef62`: a read-only research pass, with every claim that a decision depends on re-checked here. Each item has a verdict.

| # | Item | Verdict | Evidence and action |
|---|---|---|---|
| 4.1 | `settleDistrict` trusted the result's box and dependencies (the "settle preset box" finding) | **BUG, fixed** | It took no request. A result for another free box committed. A continuation whose proposal had lost `depends` committed without the neighbour-road check. Both were red on `main` ("committed" instead of "failed"). `settleDistrict` now requires the request it answers and refuses a corner, plan size, region or dependency set that differs from it (commit `ebde366`). Tests: "a result generated for another district box is refused at settlement"; "a continuation whose result dropped the neighbour road dependencies is refused instead of committed unchecked". Each check was mutation-tested. Callers updated: the Studio session, the bench page and the profile |
| 4.2 | `draftProposal` versus `applyProposal` | OK | Both run the same `proposalPatch` (versions, region, shape, write set, read set, `depends`), then `advance`. `applyPatch` is `advance` plus the record and hash. The job's scratch drafts are re-validated in full when the final proposal meets the real state through `applyProposal`, so no draft-only path reaches the world |
| 4.3 | Nonlocal dependencies | OK, with recorded limits | A `depends` region is digested exactly like the read set, including its one-cell shell, so a one-cell dependency reads its 3×3×3 neighbourhood. A malformed region is an `invalid` result, not a throw. `continueFrom` declares the first 12 route cells of each gate it continues; it pairs `routes[i]` with `gates[i]`, which the planner produces in the same order. The digest does not cover fold angles, bonds or detached pieces, which is enough for Phase 3 (recorded for Phase 4) |
| 4.4 | Independent validators | OK | `validate.ts` and `audit.ts` import only *types* from `plan.ts` (`CellKind`, `DistrictPlan`, `Point`). No helper is shared with the planner |
| 4.5 | Worker cancellation | OK | `cancel` is processed between slices; the next slice posts `cancelled` with no proposal, and `done` is posted once. A cancel requested on the main thread also wins in `settleDistrict`. e2e and engines tests cover both |
| 4.6 | Worker budget | RISK (documentation) | The slice budget is enforced only when a clock is injected: the host's default `now` is `() => 0`, so with `sliceMs > 0` and no clock one slice would run the whole job. The Studio worker injects `performance.now()`, so the Studio is unaffected. A duplicate `generate` for a job id that is still running is ignored without a reply; the Studio uses unique run ids. Neither changes a result; left as documented behaviour |
| 4.7 | Incoming worker messages | RISK (accepted) | The worker does not shape-check `generate` beyond the catalog, fingerprint, snapshot and `sliceMs` checks. Both ends are same-origin first-party code, and the main thread now re-checks everything that comes back (4.1) |
| 4.8 | Garbled comment | Fixed | `createDistrictJob`'s doc comment ended with a dangling sentence fragment (`district.ts`). Fixed in `ebde366` |
| 4.9 | Test titles | One adjusted | "progress reports the plan and a rising lot count" asserts a count that never decreases; renamed to say that. "…keeps existing entities identical" checks `entities[0]`, which is the fixture's only pre-existing entity, so the title holds. "ten seeds … pass the plan validators" holds because `settleDistrict` runs `planIssues` before it commits |
| 4.10 | Relative type import | OK | No import crosses a package boundary. `apps/studio/engines/genesis.spec.ts` type-imports `../src/bench/genesisBench` inside the same app, and `Reflect.get(…) as GenesisBench` is a test-side cast on a value the bench page itself defines |
| 4.11 | Seed corpus and claims | Recorded | Unit tests use one world seed (20,261,125), one preset and origin `[0,0,0]`. The benchmark corpus (seeds 1–12) overlaps the unit seeds, so it is not independent evidence. The cross-engine equality of a district holds for seed 1, the one pinned. Determinism across *world* seeds is not tested. None of this is claimed as universal |
| 4.12 | The off-axis wind engines test compares raw doubles | OK (not engine-dependent) | The reviewer flagged it as the same risk as `atan2` or `sin`. It is not: `windFold` uses only `*`, `+`, `/`, `sqrt`, `max` and `min`, which are correctly rounded or exact. It passed on all three engines locally (§2.3) |
| 4.13 | Second review of `settleDistrict` (2026-11-26, before merge) | **BUG, fixed** | Two gaps were left after 4.1. (1) Some malformed results made it **throw** instead of returning `failed`: `plan`, `proposal` or `metrics` set to `null`, `plan.gates` missing, or a `depends` entry that is `null` or has no valid region. (2) The result's plan was not compared with the request's **road gates and river**. So a continuation planned without the gate that meets the neighbour's road could commit, as long as its box and dependencies matched. Both were red before the fix: one test threw a `TypeError`, the other returned `committed`. Fix: the shape check covers those fields and each dependency entry. The plan's gate cells and river terminals must equal those the request asks for. These are derived by `planRequestOf` and `plannedTerminals`, the functions the planner itself uses, so the rule is defined once. The declared dependency regions must be **exactly** the request's, not a superset. Each check was mutation-tested. Tests: "a malformed result from an untrusted transport is refused instead of throwing"; "a result planned for other road gates or another river than its request is refused at settlement". **What settlement does not check, by design:** (a) that the result's seed and lots are the ones the request would produce. Proving that means re-planning on the main thread, about 10–40 ms per district on this machine. Settlement checks contracts instead: box, terminals, dependencies, plan validity and an audit from scratch. (b) The read and dependency *digests*. They are optimistic-concurrency tokens taken on the state the job was sent (ADR 0016). A wrong digest gives a `conflict`, not a corrupt commit |


## 5. Validation

### 5.1 Local (Apple M5 Pro, 18 cores, Node 24.20.0, pnpm 10.33.4)

The machine was shared and not idle. OrbStack was running 13 containers, and other projects' processes ran at the same time (Spotlight indexing, an `ast-grep` scan, other Node and Chromium jobs). The load average is stated with every run, and timings here are not benchmarks.

| Check | Run 1: `58e3ee7` (wind fix), load 3–12 | Run 2: `ebde366` (+ settlement fix), load **74–108** | Targeted re-runs |
|---|---|---|---|
| `pnpm lint` | pass | pass | — |
| `pnpm typecheck` | pass | pass | — |
| `pnpm test` | 276 passed | 277 passed, 1 failed: `experiments/wfc-placement` "every solved grid in the seed corpus verifies" hit its 5 s timeout | wfc experiment alone: 13 passed |
| `pnpm build` | pass | pass | — |
| `pnpm e2e` (Chromium) | 36 passed, 1 failed (lab "selecting every catalog item…", 30 s timeout) | 31 passed, 6 failed: all Phase 0 lab tests, all timeouts (`stat-backend` 5 s, a 30 s test timeout) | `e2e/lab.spec.ts` alone with 1 worker at load 54–103: 18 passed, 2 failed. These are the same two tests the Phase 3 exit report (§4) recorded as timing out locally and passing in CI ("selecting every catalog item…", "switching items repeatedly…"). The first passed alone in 8.0 s at load 8 (run 1). **No Genesis, Wave or World e2e test failed in any run** |
| `pnpm --filter @eschaton/studio engines` | 21 passed | 21 passed | — |

Unit test count at the head: **280** (foldon 50, architecture 70, world 83, wave 37, genesis 27, wfc experiment 13). `main` @ `870ef62` has 269. The two tests of 4.13 were added after runs 1 and 2; run 3 is in §5.1a.

### 5.1a Run 3: the §4.13 settlement fix, load 77–173

- `pnpm lint`, `pnpm typecheck` and `pnpm build`: pass.
- `pnpm test`: 280 passed.
- `pnpm --filter @eschaton/studio engines`: 21 passed.
- `e2e/genesis.spec.ts` with 1 worker:
  - first run, 3 passed and 2 failed;
  - re-run of the same tree at the same load, all 5 passed.

  The failing tests were "generating a district in the worker…" and "a second district continues the first one…". The full e2e suite was not run locally at this load. CI on the head is the arbiter.

The local failures are timeouts in code this branch does not touch, under a load roughly six times the core count. The CI run on the PR head is the arbiter.

### 5.2 CI

CI on the PR head is the arbiter; its run is recorded in the PR description. Main's latest run before this branch: 45757095399 (green).

### 5.3 Benchmarks

No new benchmark was recorded. The machine was not idle, and the change does not touch generation or commit cost: the wind fix adds one `Math.max` and a branch per `windFold` call. The Phase 3 district figures in `benchmarks/phase-3/` remain the recorded evidence. They were measured locally on `62cf1e3` at load 19–20 and are not CI measurements.

## 6. GO / NO-GO and pending owner decisions

**Engineering recommendation: GO for the owner's gate review**, once this branch is reviewed and its CI is green. That is not a gate pass. Nothing below has been decided, and nothing is marked approved.

> **Later decisions (2026-11-27).** This list is left as written. The owner has since decided choice 9 as (a) (item 3), kept cross-engine determinism as a tested property (item 4), and made the RTX 5070 test due before any Phase 5 work, not waived (item 5). The gate, the visual review and choices 1–8 are still undecided. Record: [`phase-3-owner-decision-packet.md`](phase-3-owner-decision-packet.md) §0.

1. **Phase 3 gate:** pass, pass with conditions, or keep open (exit report §6, decision 1).
2. **Visual review** at prototype level: [`phase-3-visual-walkthrough.md`](phase-3-visual-walkthrough.md). It has screenshots on a physical Apple GPU (WebGPU on Metal) and observations against the reference. They are not approval.
3. **ADR 0017 choices 1–8** (exit report §6, decision 4), and **choice 9** (wind formula and system versioning), added by this audit.
4. **Cross-engine determinism as a product promise** (exit report §6, decision 5). The evidence now covers four pinned artefacts on Node and three engines: the solver digest, the catalog fingerprint, the district hash, and an off-axis wind fold. It is still a finite set.
5. **Outstanding manual checks, not waived:** the RTX 5070 test C1–C6 on the owner's Windows machine. That machine was not available and was not contacted from this session.
6. **Still open from earlier phases:**
   - ADR 0010 Q5, Q9, Q10;
   - ADR 0012 Q5;
   - ADR 0006 hatching on moving pieces;
   - incremental state hash (ADR 0011).
7. **Governance:** whether PR merges, gate decisions and next-phase authorizations should be recorded separately. See the Shared Phase Gate proposal (separate docs PR).
