# Commit profile (W3)

Workload: `benchmarks/profile/commit.test.ts` (`pnpm --filter @eschaton/benchmarks profile:commit`, sizes through `PROFILE_ENTITIES`). A dense grid of P08 boxes (every box touches its neighbours, so about two bonds per entity), then per round: one `detach` in the middle, one solved 8×4×8 wave proposal applied far from the grid, one `hashState`. The same test file was run on the baseline tree (`0dead22`) and on the optimised tree, alternating, on the same machine at the load printed in each file. The runs have the V8 CPU profiler attached, so absolute times are higher than in the benchmarks.

- `commit-100.txt`, `commit-1000.txt`, `commit-10000.txt`: p50 / p95 / p99 before and after.
- `cpu-before-10000.txt`: where the baseline spent its CPU at 10,000 entities (inclusive time per commit-path function, and top self time), produced by `benchmarks/src/profileSummary.ts` from the `.cpuprofile`.
- Heap figures are `heapUsed` deltas without a forced GC. Treat them as indicative only.
