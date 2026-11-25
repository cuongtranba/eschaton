# Phase 3 evidence: district workload

Produced by `pnpm --filter @eschaton/benchmarks profile:genesis` (method: [`../README.md`](../README.md), "District workload"). Node main thread, Apple M5 Pro. The machine is shared and was **not idle** in either run; each report records its load average. Compare the shape of the numbers, not single milliseconds.

| Directory | Commit | What it shows |
|---|---|---|
| [`2026-11-25-5ab709eae/`](2026-11-25-5ab709eae/genesis-district.md) | `5ab709e` (clean) | After the small scratch world, **before** `draftProposal`. Scratch steps still hashed the scratch world: generate p50 650 ms at load 17–29. State hashes are those of the catalog before the cross-engine fix |
| [`2026-11-25-62cf1e36a/`](2026-11-25-62cf1e36a/genesis-district.md) | `62cf1e3` (clean) | **Final.** Scratch world, `draftProposal`, engine-independent catalog. Generate p50 145 ms, p95 250 ms at load 19–20; chained districts stay at 136–247 ms from 1,591 to 9,158 world entities |

What was not recorded: the very first implementation, which used the real world as scratch state, was measured only from a dirty tree (474, 923 and 2,959 ms for three chained districts at load 27). It is described in ADR 0017, "The scratch world is small".

Residual costs that grow with the world (final run, six-district chain, 9,158 entities): the one real commit, 111 ms; settle including the audit, 123 ms; the state hash, 28 ms; parsing the snapshot in the worker, 126 ms for 3.4 MiB. Heap after a forced collection grew from 16 MiB to 34 MiB, about 2 KiB per entity.
