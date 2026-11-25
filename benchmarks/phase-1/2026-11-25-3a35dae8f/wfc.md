# WFC encoding benchmark 2026-11-25

- Commit: 3a35dae8f79114f3cbd15442782673e54a3cc616; mode: record

- OS: Darwin 25.5.0 (darwin arm64)
- CPU: Apple M5 Pro (18 logical cores)
- Memory: 48 GiB
- Node: v24.20.0
- Corpus: seeds 1..100 per scenario × size × encoding (1200 timed runs); 5 untimed warm-up runs per cell
- Budget: maxNodes 5000, maxBacktracks 500
- Timing: performance.now() around one solve call, single thread, main thread (worker path is Phase 2). Times cover every run, solved or not.
- Propagation step: one worklist item processed. Placement encoding processes placements (support re-check); offset-state processes cells (domain arc revision). The two counts are not comparable.

## Scenario `open`: demo tile set, no pins

| Size | Encoding | Solved | Unsat | Budget | p50 ms | p95 ms | Max ms | Mean nodes | Mean backtracks | Max backtracks (seed) | Mean prop. steps |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8×8 | placement | 100 | 0 | 0 | 5.16 | 6.60 | 7.39 | 53.7 | 0.00 | 0 (1) | 8515 |
| 8×8 | offset-state | 100 | 0 | 0 | 4.24 | 4.75 | 5.17 | 53.7 | 0.00 | 0 (1) | 458 |
| 12×12 | placement | 100 | 0 | 0 | 16.52 | 39.15 | 66.75 | 110.5 | 0.00 | 0 (1) | 24658 |
| 12×12 | offset-state | 100 | 0 | 0 | 17.24 | 24.46 | 58.21 | 110.5 | 0.00 | 0 (1) | 1126 |
| 16×16 | placement | 100 | 0 | 0 | 36.99 | 53.90 | 72.38 | 186.9 | 0.00 | 0 (1) | 48553 |
| 16×16 | offset-state | 100 | 0 | 0 | 29.34 | 42.15 | 60.46 | 186.9 | 0.00 | 0 (1) | 2072 |

## Scenario `constrained`: demo tile set without `road-end`, one house pinned at the centre

| Size | Encoding | Solved | Unsat | Budget | p50 ms | p95 ms | Max ms | Mean nodes | Mean backtracks | Max backtracks (seed) | Mean prop. steps |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8×8 | placement | 100 | 0 | 0 | 5.33 | 8.57 | 13.66 | 49.8 | 4.41 | 170 (32) | 4652 |
| 8×8 | offset-state | 100 | 0 | 0 | 5.38 | 7.35 | 13.60 | 49.8 | 4.41 | 170 (32) | 449 |
| 12×12 | placement | 100 | 0 | 0 | 18.38 | 54.59 | 77.62 | 103.7 | 1.30 | 8 (16) | 18207 |
| 12×12 | offset-state | 100 | 0 | 0 | 13.19 | 80.82 | 194.84 | 103.7 | 1.36 | 8 (16) | 1115 |
| 16×16 | placement | 100 | 0 | 0 | 38.90 | 194.32 | 253.60 | 174.0 | 1.63 | 13 (75) | 37831 |
| 16×16 | offset-state | 100 | 0 | 0 | 20.33 | 21.83 | 23.02 | 173.9 | 1.59 | 13 (75) | 2048 |

## Agreement between encodings

| Scenario | Size | Both solved | Identical grid hash |
|---|---|---:|---:|
| open | 8×8 | 100 | 100 |
| open | 12×12 | 100 | 98 |
| open | 16×16 | 100 | 100 |
| constrained | 8×8 | 100 | 100 |
| constrained | 12×12 | 100 | 98 |
| constrained | 16×16 | 100 | 97 |

