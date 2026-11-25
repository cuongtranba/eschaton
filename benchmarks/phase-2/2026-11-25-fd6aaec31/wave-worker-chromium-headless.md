# Wave solver in the production worker

- Commit: fd6aaec311619b3d25f812051f7a6f07a0df833b (dirty: false); mode: record
- Machine: Apple M5 Pro, 18 cores, 48 GiB, Darwin 25.5.0 (darwin arm64)
- Browser: chromium 159.0.8154.6 (playwright chromium (headless)); production bundle (vite build + vite preview)
- Load average (1, 5, 15 min) before: 11, 9.67, 12.47; after: 9.98, 9.55, 12.26
- Method: 10 unrecorded warm-up solves, then fixed seeds 1..n per series. Each sample starts from the same world. Times in ms, p50 / p95 / p99 by nearest rank.

| Series | n | Solve in worker | Worker round trip (compile + solve + transport) | World commit | End to end | Outcomes |
|---|---:|---|---|---|---|---|
| 16x8x16 with pins (canonical) | 120 | 22.4 / 53.2 / 153.4 | 51.1 / 189.2 / 346.9 | 25.2 / 89.5 / 145.7 | 80.5 / 279.1 / 572.6 | {"solved":120} |
| 16x8x16 empty world | 120 | 20.9 / 41.7 / 77.7 | 40.2 / 74.7 / 116.3 | 31.8 / 58.6 / 100.1 | 71 / 162.6 / 210.4 | {"solved":120} |
| 8x4x8 with pins | 120 | 0.8 / 1.9 / 7.7 | 3 / 6.2 / 25.5 | 1.4 / 3.2 / 10.5 | 4.6 / 9.6 / 37 | {"solved":120} |
| 28x8x28 with pins (stress) | 40 | 132.5 / 289 / 340.9 | 252.5 / 461.5 / 726.4 | 121.5 / 312.1 / 441.2 | 378 / 767.5 / 1039.3 | {"solved":40} |
| 16x8x16, cold worker | 10 | 16.7 / 18 / 18 | 59.3 / 65.1 / 65.1 | 17.9 / 24.3 / 24.3 | 78.8 / 85.6 / 85.6 | {"solved":10} |

Canonical breakdown (p50 / p95): prepare 0.2 / 0.4; compile 24.4 / 119.3; solve 22.4 / 53.2; transport 0.9 / 12.8; commit 25.2 / 89.5.

**Gate (Local WFC, 16x16x8, p95 <= 250 ms in worker):** solve p95 53.2 ms; worker round trip p95 189.2 ms. Inside the target in this run.

| Hard case | Outcomes | Mean decisions | Mean backtracks | Solve p50 / p95 / p99 | Round trip p50 / p95 / p99 |
|---|---|---:|---:|---|---|
| packing | {"budget-exceeded":7,"solved":93} | 1845.8 | 1765.97 | 0.8 / 117.3 / 137.1 | 2.3 / 120.3 / 140.8 |
| unsat-search | {"unsatisfiable":100} | 9.15 | 9.15 | 0.1 / 0.1 / 0.2 | 0.5 / 0.7 / 2.2 |
| unsat-propagation | {"unsatisfiable":100} | 0 | 0 | 0 / 0 / 0 | 0.6 / 0.7 / 1.9 |
