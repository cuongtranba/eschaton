# Genesis district workload

- Commit: `5ab709eae955fc925c2c496ca0571d28aae507a1`; generated 2026-11-25T08:53:58.280Z
- Machine: Apple M5 Pro, 18 logical cores, Darwin 25.5.0 arm64, Node v24.20.0
- Load average before: 16.9 / 29.0 / 28.7; after: 20.4 / 29.1 / 28.7
- Preset: `last-district` 40×40, world seed 20261125; main thread of Node, 3 unrecorded warm-up districts

## Corpus: one district per seed into an empty world (12 seeds)

- Distinct state hashes: 12 of 12; invariant issues: 0
- Generate: p50 649.7 / p95 1170.7 / max 1170.7 ms
- World commit alone (`applyProposal`): p50 57.9 / p95 221.8 / max 221.8 ms
- Settle (re-validate plan, commit, audit): p50 65.9 / p95 417.8 / max 417.8 ms

| Seed | State hash | Entities | Placements | Road | Water | Bridge | Lots T/H/R/G | Empty lots | Decisions | Backtracks | Plan attempts | Lot retries | Generate ms | Commit ms | Settle ms |
|---:|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | `b6e00297e3cc6b11` | 1604 | 1331 | 114 | 78 | 2 | 6/20/1/54 | 0 | 1990 | 0 | 1 | 0 | 982.09 | 199.7 | 273.9 |
| 2 | `8927eb50c9b1f873` | 1765 | 1408 | 138 | 78 | 2 | 6/21/4/45 | 0 | 2168 | 0 | 1 | 0 | 846.99 | 92.16 | 65.88 |
| 3 | `7c35f2bd8216d0eb` | 1372 | 1181 | 125 | 78 | 2 | 4/22/9/53 | 0 | 1987 | 0 | 1 | 0 | 446.27 | 43.6 | 50.13 |
| 4 | `e2f13f0ce7223ac6` | 1506 | 1261 | 132 | 78 | 2 | 5/29/6/45 | 0 | 2357 | 0 | 1 | 0 | 1170.73 | 221.78 | 135.56 |
| 5 | `3e5ec7b9d3be7dde` | 1514 | 1276 | 120 | 78 | 2 | 4/20/6/49 | 0 | 1992 | 0 | 1 | 0 | 508.97 | 55.26 | 59.22 |
| 6 | `8ee93713f89372bc` | 1834 | 1475 | 135 | 78 | 2 | 5/27/7/42 | 0 | 2440 | 0 | 1 | 0 | 738.83 | 75.9 | 66.5 |
| 7 | `2614cc93f013a09a` | 1701 | 1371 | 119 | 78 | 2 | 6/22/5/48 | 0 | 2154 | 0 | 1 | 0 | 553.46 | 137.2 | 182.64 |
| 8 | `864f327099a82561` | 1556 | 1293 | 126 | 78 | 2 | 5/18/5/58 | 0 | 1928 | 0 | 1 | 0 | 1134.52 | 49.05 | 52.08 |
| 9 | `07970ffece983a3e` | 1502 | 1239 | 114 | 78 | 2 | 6/16/5/49 | 0 | 2016 | 0 | 1 | 0 | 414.04 | 42.74 | 43.35 |
| 10 | `87fc171d11fdcc78` | 2117 | 1608 | 126 | 78 | 2 | 8/28/12/32 | 0 | 2571 | 0 | 1 | 0 | 644.52 | 117.83 | 417.76 |
| 11 | `39e678c9822d5496` | 1642 | 1297 | 128 | 78 | 2 | 5/26/9/51 | 0 | 2142 | 0 | 1 | 0 | 1149.68 | 48.63 | 81.28 |
| 12 | `50b5f8b4bc80c384` | 1633 | 1286 | 125 | 78 | 2 | 5/17/9/47 | 0 | 2012 | 0 | 1 | 0 | 649.71 | 57.87 | 62.86 |

## Chain: each district continues the previous one to the east (6 districts, one world)

Heap is `heapUsed` after a forced collection; it started at 17.95 MiB with an empty world. Snapshot columns are the cost of handing the world to a worker.

| District | Seed | World entities | World bonds | Generate ms | Commit ms | Settle ms | Hash ms | Snapshot KiB | Serialize ms | Parse ms | Heap MiB |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 21 | 1591 | 1630 | 1244.92 | 93.77 | 99.67 | 10.5 | 0 | 0.07 | 0.37 | 20.87 |
| 2 | 22 | 3128 | 3190 | 711.95 | 55.56 | 100.36 | 43.55 | 779 | 1.92 | 59.13 | 24.14 |
| 3 | 23 | 4724 | 4635 | 616.37 | 79.91 | 74.84 | 12 | 1532 | 1.33 | 84.02 | 27.59 |
| 4 | 24 | 6162 | 5895 | 772.4 | 113.68 | 118.09 | 31.65 | 2292 | 2.46 | 405.92 | 30.39 |
| 5 | 25 | 7601 | 7137 | 776.75 | 152.75 | 168.53 | 37.08 | 2962 | 6.6 | 263.13 | 33.48 |
| 6 | 26 | 9158 | 8685 | 1064.51 | 133.25 | 142.98 | 31.29 | 3637 | 26.98 | 367.27 | 36.67 |
