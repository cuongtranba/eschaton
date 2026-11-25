# Wave solver in the production worker

- Commit: fd6aaec311619b3d25f812051f7a6f07a0df833b (dirty: false); mode: record
- Machine: Apple M5 Pro, 18 cores, 48 GiB, Darwin 25.5.0 (darwin arm64)
- Browser: chromium 158.0.8127.37 (chrome); production bundle (vite build + vite preview)
- Load average (1, 5, 15 min) before: 8.88, 9.33, 12.13; after: 7.93, 9.07, 11.94
- Method: 10 unrecorded warm-up solves, then fixed seeds 1..n per series. Each sample starts from the same world. Times in ms, p50 / p95 / p99 by nearest rank.

| Series | n | Solve in worker | Worker round trip (compile + solve + transport) | World commit | End to end | Outcomes |
|---|---:|---|---|---|---|---|
| 16x8x16 with pins (canonical) | 120 | 25.2 / 52.9 / 66.9 | 53.7 / 108.1 / 161.6 | 24.7 / 41.6 / 75.2 | 77.7 / 159.5 / 187.3 | {"solved":120} |
| 16x8x16 empty world | 120 | 21.1 / 28.5 / 33.3 | 42.2 / 59.9 / 72.2 | 31.1 / 41.5 / 48.9 | 73.5 / 97 / 127.2 | {"solved":120} |
| 8x4x8 with pins | 120 | 0.7 / 0.9 / 1.4 | 2.4 / 2.9 / 5.3 | 0.9 / 1.6 / 1.9 | 3.4 / 4.3 / 6.5 | {"solved":120} |
| 28x8x28 with pins (stress) | 40 | 88.5 / 97.1 / 123.9 | 163 / 200.4 / 233.9 | 81.4 / 99 / 115.3 | 240.9 / 296 / 313.3 | {"solved":40} |
| 16x8x16, cold worker | 10 | 23.1 / 27.9 / 27.9 | 82.9 / 200.1 / 200.1 | 25.7 / 39 / 39 | 112.2 / 236.6 / 236.6 | {"solved":10} |

Canonical breakdown (p50 / p95): prepare 0.2 / 0.4; compile 26.5 / 40.6; solve 25.2 / 52.9; transport 1.1 / 3.4; commit 24.7 / 41.6.

**Gate (Local WFC, 16x16x8, p95 <= 250 ms in worker):** solve p95 52.9 ms; worker round trip p95 108.1 ms. Inside the target in this run.

| Hard case | Outcomes | Mean decisions | Mean backtracks | Solve p50 / p95 / p99 | Round trip p50 / p95 / p99 |
|---|---|---:|---:|---|---|
| packing | {"budget-exceeded":7,"solved":93} | 1845.8 | 1765.97 | 0.5 / 112.6 / 164 | 1.4 / 114.4 / 166.9 |
| unsat-search | {"unsatisfiable":100} | 9.15 | 9.15 | 0 / 0.1 / 0.1 | 0.4 / 0.5 / 0.8 |
| unsat-propagation | {"unsatisfiable":100} | 0 | 0 | 0 / 0 / 0 | 0.4 / 0.5 / 1.9 |
