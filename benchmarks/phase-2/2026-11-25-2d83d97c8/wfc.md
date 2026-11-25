# WFC encoding benchmark 2026-11-25

- Commit: 2d83d97c8fd2739753fe73c321b35c6717529b06; mode: record

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
| 8×8 | placement | 100 | 0 | 0 | 9.34 | 45.29 | 63.30 | 53.7 | 0.00 | 0 (1) | 8515 |
| 8×8 | offset-state | 100 | 0 | 0 | 7.87 | 22.90 | 51.32 | 53.7 | 0.00 | 0 (1) | 458 |
| 12×12 | placement | 100 | 0 | 0 | 32.07 | 181.92 | 276.21 | 110.5 | 0.00 | 0 (1) | 24658 |
| 12×12 | offset-state | 100 | 0 | 0 | 19.35 | 25.96 | 47.19 | 110.5 | 0.00 | 0 (1) | 1126 |
| 16×16 | placement | 100 | 0 | 0 | 90.69 | 254.76 | 639.00 | 186.9 | 0.00 | 0 (1) | 48553 |
| 16×16 | offset-state | 100 | 0 | 0 | 51.63 | 188.81 | 230.98 | 186.9 | 0.00 | 0 (1) | 2072 |

## Scenario `constrained`: demo tile set without `road-end`, one house pinned at the centre

| Size | Encoding | Solved | Unsat | Budget | p50 ms | p95 ms | Max ms | Mean nodes | Mean backtracks | Max backtracks (seed) | Mean prop. steps |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8×8 | placement | 100 | 0 | 0 | 5.79 | 11.83 | 27.88 | 49.8 | 4.41 | 170 (32) | 4652 |
| 8×8 | offset-state | 100 | 0 | 0 | 6.52 | 39.37 | 68.59 | 49.8 | 4.41 | 170 (32) | 449 |
| 12×12 | placement | 100 | 0 | 0 | 146.58 | 269.86 | 434.65 | 103.7 | 1.30 | 8 (16) | 18207 |
| 12×12 | offset-state | 100 | 0 | 0 | 70.29 | 170.77 | 213.41 | 103.7 | 1.36 | 8 (16) | 1115 |
| 16×16 | placement | 100 | 0 | 0 | 119.08 | 569.61 | 649.25 | 174.0 | 1.63 | 13 (75) | 37831 |
| 16×16 | offset-state | 100 | 0 | 0 | 37.97 | 130.65 | 177.70 | 173.9 | 1.59 | 13 (75) | 2048 |

## Agreement between encodings

| Scenario | Size | Both solved | Identical grid hash |
|---|---|---:|---:|
| open | 8×8 | 100 | 100 |
| open | 12×12 | 100 | 98 |
| open | 16×16 | 100 | 100 |
| constrained | 8×8 | 100 | 100 |
| constrained | 12×12 | 100 | 98 |
| constrained | 16×16 | 100 | 97 |

