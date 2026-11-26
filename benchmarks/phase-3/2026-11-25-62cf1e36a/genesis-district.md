# Genesis district workload

- Commit: `62cf1e36aa69181de30d2385e6f7963d242a2429`; generated 2026-11-25T09:04:03.316Z
- Machine: Apple M5 Pro, 18 logical cores, Darwin 25.5.0 arm64, Node v24.20.0
- Load average before: 20.3 / 17.8 / 22.2; after: 19.0 / 17.6 / 22.1
- Preset: `last-district` 40×40, world seed 20261125; main thread of Node, 3 unrecorded warm-up districts

## Corpus: one district per seed into an empty world (12 seeds)

- Distinct state hashes: 12 of 12; invariant issues: 0
- Generate: p50 144.6 / p95 250.3 / max 250.3 ms
- World commit alone (`applyProposal`): p50 37.3 / p95 49.9 / max 49.9 ms
- Settle (re-validate plan, commit, audit): p50 41.4 / p95 57.2 / max 57.2 ms

| Seed | State hash | Entities | Placements | Road | Water | Bridge | Lots T/H/R/G | Empty lots | Decisions | Backtracks | Plan attempts | Lot retries | Generate ms | Commit ms | Settle ms |
|---:|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | `5dc9053d2e6bd656` | 1604 | 1331 | 114 | 78 | 2 | 6/20/1/54 | 0 | 1990 | 0 | 1 | 0 | 127.86 | 34.73 | 40.81 |
| 2 | `cc50179e8d873333` | 1765 | 1408 | 138 | 78 | 2 | 6/21/4/45 | 0 | 2168 | 0 | 1 | 0 | 166.63 | 41.87 | 48.79 |
| 3 | `d237e7fffd072bef` | 1372 | 1181 | 125 | 78 | 2 | 4/22/9/53 | 0 | 1987 | 0 | 1 | 0 | 142.64 | 32.3 | 38.68 |
| 4 | `a84bf90ac179a33f` | 1506 | 1261 | 132 | 78 | 2 | 5/29/6/45 | 0 | 2357 | 0 | 1 | 0 | 156.99 | 35.86 | 42.77 |
| 5 | `9ee6fffce3e91d6c` | 1514 | 1276 | 120 | 78 | 2 | 4/20/6/49 | 0 | 1992 | 0 | 1 | 0 | 125.97 | 40.86 | 38.91 |
| 6 | `d03ba7f641ef2d5a` | 1834 | 1475 | 135 | 78 | 2 | 5/27/7/42 | 0 | 2440 | 0 | 1 | 0 | 178.04 | 49.88 | 57.22 |
| 7 | `4dafd6031e9cb223` | 1701 | 1371 | 119 | 78 | 2 | 6/22/5/48 | 0 | 2154 | 0 | 1 | 0 | 144.58 | 41.16 | 44.48 |
| 8 | `a7ef753453b9eb3e` | 1556 | 1293 | 126 | 78 | 2 | 5/18/5/58 | 0 | 1928 | 0 | 1 | 0 | 135.92 | 36.5 | 45.44 |
| 9 | `09b9820cb876d787` | 1502 | 1239 | 114 | 78 | 2 | 6/16/5/49 | 0 | 2016 | 0 | 1 | 0 | 131.86 | 35.38 | 40.47 |
| 10 | `9883ebcfa9361755` | 2117 | 1608 | 126 | 78 | 2 | 8/28/12/32 | 0 | 2571 | 0 | 1 | 0 | 250.25 | 39.88 | 41.41 |
| 11 | `fb77794674873f71` | 1642 | 1297 | 128 | 78 | 2 | 5/26/9/51 | 0 | 2142 | 0 | 1 | 0 | 157.48 | 37.28 | 38.55 |
| 12 | `4e116109f5996d07` | 1633 | 1286 | 125 | 78 | 2 | 5/17/9/47 | 0 | 2012 | 0 | 1 | 0 | 169.78 | 45.14 | 51.36 |

## Chain: each district continues the previous one to the east (6 districts, one world)

Heap is `heapUsed` after a forced collection; it started at 16.01 MiB with an empty world. Snapshot columns are the cost of handing the world to a worker.

| District | Seed | World entities | World bonds | Generate ms | Commit ms | Settle ms | Hash ms | Snapshot KiB | Serialize ms | Parse ms | Heap MiB |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 21 | 1591 | 1630 | 135.95 | 25.01 | 29.5 | 3.26 | 0 | 0.06 | 0.36 | 18.86 |
| 2 | 22 | 3128 | 3190 | 219.72 | 56.85 | 77.61 | 13.37 | 745 | 1.03 | 48.91 | 22.02 |
| 3 | 23 | 4724 | 4635 | 223.1 | 88.84 | 88.83 | 14.92 | 1464 | 2.09 | 65.14 | 25.47 |
| 4 | 24 | 6162 | 5895 | 221.99 | 68.15 | 50.26 | 11.1 | 2191 | 1.47 | 112.66 | 28.2 |
| 5 | 25 | 7601 | 7137 | 245.75 | 102.6 | 94.22 | 19.22 | 2833 | 2.13 | 158.99 | 31.18 |
| 6 | 26 | 9158 | 8685 | 246.95 | 111.33 | 123.14 | 28.22 | 3479 | 2.7 | 125.72 | 34.36 |
