# WFC encoding benchmark 2026-11-24

- Commit: e9e50c52794812cc553b70df378d4a6ddadfcbb9; mode: record

- OS: Linux 6.18.58.1-microsoft-standard-WSL2 (linux x64)
- CPU: AMD Ryzen 7 7800X3D 8-Core Processor (8 logical cores)
- Memory: 19.5 GiB
- Node: v24.5.0
- Corpus: seeds 1..100 per scenario × size × encoding (1200 timed runs); 5 untimed warm-up runs per cell
- Budget: maxNodes 5000, maxBacktracks 500
- Timing: performance.now() around one solve call, single thread, main thread (worker path is Phase 2). Times cover every run, solved or not.
- Propagation step: one worklist item processed. Placement encoding processes placements (support re-check); offset-state processes cells (domain arc revision). The two counts are not comparable.

## Scenario `open`: demo tile set, no pins

| Size | Encoding | Solved | Unsat | Budget | p50 ms | p95 ms | Max ms | Mean nodes | Mean backtracks | Max backtracks (seed) | Mean prop. steps |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8×8 | placement | 100 | 0 | 0 | 5.43 | 9.77 | 14.99 | 53.7 | 0.00 | 0 (1) | 8515 |
| 8×8 | offset-state | 100 | 0 | 0 | 4.33 | 4.76 | 5.07 | 53.7 | 0.00 | 0 (1) | 458 |
| 12×12 | placement | 100 | 0 | 0 | 18.78 | 24.60 | 34.31 | 110.5 | 0.00 | 0 (1) | 24658 |
| 12×12 | offset-state | 100 | 0 | 0 | 13.24 | 14.82 | 18.88 | 110.5 | 0.00 | 0 (1) | 1126 |
| 16×16 | placement | 100 | 0 | 0 | 47.32 | 59.69 | 74.20 | 186.9 | 0.00 | 0 (1) | 48553 |
| 16×16 | offset-state | 100 | 0 | 0 | 29.69 | 31.26 | 33.72 | 186.9 | 0.00 | 0 (1) | 2072 |

## Scenario `constrained`: demo tile set without `road-end`, one house pinned at the centre

| Size | Encoding | Solved | Unsat | Budget | p50 ms | p95 ms | Max ms | Mean nodes | Mean backtracks | Max backtracks (seed) | Mean prop. steps |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8×8 | placement | 100 | 0 | 0 | 3.40 | 4.30 | 8.58 | 49.8 | 4.41 | 170 (32) | 4652 |
| 8×8 | offset-state | 100 | 0 | 0 | 3.21 | 3.66 | 6.52 | 49.8 | 4.41 | 170 (32) | 449 |
| 12×12 | placement | 100 | 0 | 0 | 14.31 | 16.08 | 17.92 | 103.7 | 1.30 | 8 (16) | 18207 |
| 12×12 | offset-state | 100 | 0 | 0 | 10.78 | 11.46 | 12.50 | 103.7 | 1.36 | 8 (16) | 1115 |
| 16×16 | placement | 100 | 0 | 0 | 36.54 | 47.64 | 59.32 | 174.0 | 1.63 | 13 (75) | 37831 |
| 16×16 | offset-state | 100 | 0 | 0 | 25.32 | 30.92 | 38.63 | 173.9 | 1.59 | 13 (75) | 2048 |

## Agreement between encodings

| Scenario | Size | Both solved | Identical grid hash |
|---|---|---:|---:|
| open | 8×8 | 100 | 100 |
| open | 12×12 | 100 | 98 |
| open | 16×16 | 100 | 100 |
| constrained | 8×8 | 100 | 100 |
| constrained | 12×12 | 100 | 98 |
| constrained | 16×16 | 100 | 97 |

