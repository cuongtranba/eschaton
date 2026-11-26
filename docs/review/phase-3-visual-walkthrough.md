# Phase 3 visual walkthrough for the owner (2026-11-26)

- Purpose: prepare the owner's visual review of generated districts (Phase 3 gate decision 2). **This is not a visual approval.** Master plan §11: visual approval is never inferred from tests, screenshots or benchmarks.
- Code: `main` @ `870ef62b97b3d6d6fc66bc7f4aadeef4b3684ce5` (PR #4 merged), run from a clean detached worktree. The closure branch does not change anything the Studio renders: the Studio only applies winds along x, which the wind fix leaves bit-identical.
- Machine: Apple M5 Pro (18 cores), macOS. Load average was 3–12 during the session, with other local work running (OrbStack containers). Browser: installed Google Chrome 158, driven headless by Playwright (`channel: "chrome"`).
- Raw log of every step: [`phase-3-walkthrough-2026-11-26.json`](phase-3-walkthrough-2026-11-26.json).

## GPU backend evidence (scoped)

The Studio status bar reported:

| Field | Value |
|---|---|
| Backend | `WebGPU` |
| GPU | `apple metal-3` |
| GPU class | `physical` |
| Adapter info | `vendor=apple architecture=metal-3 isFallbackAdapter=false source=webgpu-device-adapter-info` |
| forceWebGL | `off` |

- This is a **physical Apple GPU through Metal**, not SwiftShader.
- It says nothing about the owner's Windows RTX 5070, which was not available and was not contacted. The RTX 5070 test (`docs/testing/webgpu-manual-test.md` C1–C6) stays **pending**. Nothing here waives it.
- The run was automated, not watched by a human. The headless browser throttles `requestAnimationFrame`, so the frame intervals in the log (p50 33–50 ms) measure the headless scheduler, **not** rendering performance. They are not used as a performance claim.

## What was exercised

| Step | Result |
|---|---|
| Seeds 1, 2, 3, 7 and 11: World mode, then Generate | All `committed` as revision 2. Click to status took 286–464 ms through the real worker. Districts had 1,343–1,726 entities and 9,031–14,135 triangles in 11–13 draw calls |
| Seed 3 | One lot retry (metrics "Plan attempts / lot retries 1 / 1"). The Phase 3 exit report said no lot retry occurred in its 12-seed corpus; that corpus generated into an empty world at `[0,0,0]`, while the Studio generates beside its setup entities at origin cell `[12,0,-20]`. Not a defect: a retry is the designed bounded path. Recorded because it differs from the earlier statement |
| Cancel immediately after Generate | `cancelled`; revision stayed 1 and the world hash was unchanged |
| Seed 5, then seed 6 (east continuation) | Revision 3, 3,208 instances, hash `125e3617336685ad` |
| Replay of the log | `match 125e3617336685ad` |
| Decorative offsets toggle on two districts | Applied. The capture is not kept in the repository; `p3-genesis-district-offsets.png` already shows offsets |
| Composition camera (`O`) on a district | Works. The mouse wheel did not change the composition camera's framing |

## Screenshots (physical GPU, WebGPU on Metal)

| File | What |
|---|---|
| [`../screenshots/p3-webgpu-m5pro-district-seed-1.png`](../screenshots/p3-webgpu-m5pro-district-seed-1.png) | Seed 1, orbit camera, plan map in the panel |
| [`../screenshots/p3-webgpu-m5pro-district-seed-3.png`](../screenshots/p3-webgpu-m5pro-district-seed-3.png) | Seed 3 (the one with a lot retry) |
| [`../screenshots/p3-webgpu-m5pro-district-seed-11.png`](../screenshots/p3-webgpu-m5pro-district-seed-11.png) | Seed 11, the most entities |
| [`../screenshots/p3-webgpu-m5pro-two-districts.png`](../screenshots/p3-webgpu-m5pro-two-districts.png) | Seeds 5 and 6 continued to the east |
| [`../screenshots/p3-webgpu-m5pro-district-composition-camera.png`](../screenshots/p3-webgpu-m5pro-district-composition-camera.png) | Seed 1 with the composition camera |
| [`../screenshots/p3-webgpu-m5pro-reference-composition.png`](../screenshots/p3-webgpu-m5pro-reference-composition.png) | The Phase 0 look-dev reference composition on the same GPU, for comparison. It is **not** world state |

The earlier `p3-genesis-*.png` captures are headless Chromium on software WebGL2. They stay as they were.

## Comparison with the reference artwork (observations for the owner, not a verdict)

Against `assets/reference/visual-direction.png` and master plan §2.2:

- **Legible:**
  - the district reads as a planned settlement: a dense core of box towers around the plaza, lower massing along roads, and sparse small pieces further out (garden and ruin lots);
  - the plan map shows the river, the three gates, the bridge and the plaza clearly;
  - two districts join at the seam.
- **Not yet like the reference:**
  - In the 3D view the river and roads are hard to see: water, paving and bridge pieces are flat cells in the paper palette, and at district scale they do not read as a "winding pale corridor".
  - Towers are stacks of box shells; at this zoom they read as voxel blocks rather than the tall dark silhouettes of the reference.
  - Pitched roofs are not recognisable at district scale.
  - Garden lots read as scattered confetti (small facets and pyramids).
  - There is no sky, sun, mountains or depth layering. The labelled backdrop is hidden once the camera reframes on a district (known limitation, exit report §7).
  - Ink hatching and paper grain are not visible at this camera distance.
  - Terrain is flat (ADR 0017, choice 1).
- **The Phase 0 reference composition**, drawn on the same GPU, shows the intended look (dark tall towers, roofs, ridges, sun). It is reached with unvalidated transforms (ADR 0013), which is why it is not the measure of Phase 3.
- **Controls:** generate, cancel, seed, layer toggles, orbit and composition cameras, offsets and replay all worked. The inspector's entity list becomes very long after a district (exit report §7).

## Running the Studio yourself

The Studio was started for this review and left running:

| | |
|---|---|
| URL | `http://localhost:5181/` (loopback only; Vite bound `[::1]:5181`, so use `localhost` or `[::1]`, not `127.0.0.1`) |
| Worktree | `/Users/cuong/Desktop/repo/eschaton-wt/studio-main`, detached at `870ef62` (`origin/main`), clean |
| Command | `cd /Users/cuong/Desktop/repo/eschaton-wt/studio-main && pnpm install --frozen-lockfile --offline && STUDIO_PORT=5181 pnpm --filter @eschaton/studio dev` |
| Processes | `pnpm` PID 51205 (parent), `vite` PID 51244 (listener), started 2026-11-26 14:02 local time |
| Lifetime | Until stopped or the machine restarts. Stop with `kill 51205 51244` |

To restart from the latest `main`:

```sh
cd /Users/cuong/Desktop/repo/eschaton-wt/studio-main
git fetch origin && git checkout --detach origin/main
pnpm install --frozen-lockfile
STUDIO_PORT=5181 pnpm --filter @eschaton/studio dev
```

Check readiness with `curl -s -o /dev/null -w "%{http_code}" http://localhost:5181/`, which should print 200. No tunnel is used. Vite's `allowedHosts` lists `.trycloudflare.com`, but no tunnel was started.

Suggested walkthrough: **World** (left panel) → Genesis seed 1 → *Generate next district (east)* → press `O` → toggle *Lot roles* and *Network routes* → *Decorative offsets* → a second seed → *Replay*.
