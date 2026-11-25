# Manual test: Studio on a physical WebGPU GPU (Windows Chrome, RTX 5070)

- Status: **PENDING** — not run. Nothing in this repository has ever exercised the WebGPU backend on a physical GPU. The owner waived this test for the Phase 0 gate only (D5, 2026-11-25) and deferred a real-GPU smoke test to the start of Phase 1. The waiver is not a verification.
- Owner: the repository owner (Windows 11, NVIDIA GeForce RTX 5070).
- Related: [ADR 0005](../decisions/0005-renderer-webgpu-tsl-webgl2-fallback.md), capability matrix in its "Capability evidence" section.

## Why this is manual

The development machine is WSL2 on a Ryzen 7 7800X3D. `/dev/dxg` exists but no Vulkan driver reaches the physical GPU, so every browser started inside WSL2 sees only SwiftShader (a CPU rasteriser). A headless run can therefore never say anything about a real GPU. The Studio's status bar now labels the adapter it ended up on (`GPU` and `GPU class`), so this test can be judged from what the Studio itself prints, not from memory of what the machine has.

## Prerequisites

1. Windows Chrome, stable channel, current version. WebGPU has shipped on Windows (Direct3D 12) since Chrome 113; use the latest stable so `GPUAdapterInfo` is fully populated. Record the version from `chrome://version`.
2. Latest NVIDIA driver (Game Ready or Studio) for the RTX 5070. Record the version from the NVIDIA app or `nvidia-smi` in a Windows terminal.
3. Open `chrome://gpu` and confirm, under "Graphics Feature Status", **WebGPU: Hardware accelerated**. If it says "Software only" or "Disabled", stop: fix that first (driver, `chrome://flags/#enable-unsafe-webgpu` is *not* the fix for a physical GPU; hardware acceleration must be on in `chrome://settings/system`). Record what `chrome://gpu` says; that is itself a result.
4. Do not start Chrome with `--use-angle=swiftshader`, `--disable-gpu` or a remote-desktop session that swaps the GPU for a virtual adapter.

## Run the Studio

In WSL2:

```bash
cd /home/cuong/Kanna/eschaton/.worktrees/phase-0
STUDIO_PORT=5183 pnpm dev
```

Open `http://localhost:5183/` in **Windows** Chrome. WSL2 forwards `localhost`, so no tunnel is needed. (If the page does not load, try `http://127.0.0.1:5183/`; do not expose the dev server publicly.)

## Checks

Record every result in the template below. Take screenshots with the browser's own capture or Windows Snipping Tool at a 1440×860-ish viewport and save them as `docs/screenshots/p0-webgpu-rtx5070-<name>.png` (the names are given per check). Windows paths to the worktree are reachable as `\\wsl$\<distro>\home\cuong\Kanna\eschaton\.worktrees\phase-0\docs\screenshots\`.

### C1. Backend and GPU readout (default URL, no flags)

Status bar at the bottom of the window:

| Field | Expected on a working RTX 5070 |
|---|---|
| Backend | `WebGPU` |
| GPU | names the RTX 5070 (for example `NVIDIA GeForce RTX 5070`, or `nvidia` plus an architecture name) |
| GPU class | `physical` |
| forceWebGL | `off` |

Hover over the GPU value: the tooltip lists `vendor`, `architecture`, `device`, `description`, `isFallbackAdapter` and the `source`. Copy the whole tooltip into the template.

Interpreting the class:

- `physical` with `source=webgpu-device-adapter-info`: pass for this check.
- `software`: the browser is on a software adapter (SwiftShader, `isFallbackAdapter=true`). Fail; go back to the prerequisites.
- `unknown` with the label ending in `(requestAdapter, reporting only)` or `unidentified adapter`: three.js asks for a WebGPU *compatibility-mode* adapter, and some Chrome builds return empty adapter info for it. The Studio never claims `physical` from the separate, reporting-only `requestAdapter()` call, because it might not be the adapter three.js used. Record the tooltip text and the `chrome://gpu` "GL_RENDERER"/"Adapter" lines, and mark C1 as "inconclusive from the Studio, confirmed from `chrome://gpu`" only if those lines name the RTX 5070.

Screenshot: `docs/screenshots/p0-webgpu-rtx5070-statusbar.png`.

### C2. Reference composition on WebGPU

Select **Reference composition** in the catalog (left panel) and set the camera mode to the composition camera. Confirm the picture matches `docs/screenshots/p0.5-reference-composition.png` in structure: quantized light bands, hatching on shaded planes, grain, depth haze, vermilion accents, outlines. Note any difference (missing hatching, black or white surfaces, flicker, wrong haze, missing outlines).

Screenshot: `docs/screenshots/p0-webgpu-rtx5070-reference.png`.

### C3. Same scene on the WebGL2 fallback

Open `http://localhost:5183/?forceWebGL=1`. Status bar: Backend `WebGL2`, forceWebGL `on`, GPU shows an ANGLE/NVIDIA renderer string (for example `ANGLE (NVIDIA, NVIDIA GeForce RTX 5070 Direct3D11 ...)`), class `physical`. Select Reference composition with the composition camera and capture it.

Screenshot: `docs/screenshots/p0-webgpu-rtx5070-reference-webgl2.png`.

### C4. Backend parity

Compare C2 and C3 side by side. The ink look should be recognisably the same picture. Record differences in line weight (WebGL lines are one device pixel), hatching density, grain, haze, and any shader compile errors in the DevTools console (open it before loading the page; WebGPU shader errors appear there).

### C5. Hatching stability under orbit

In the default (WebGPU) URL, orbit slightly (drag a few degrees, or use the arrow keys) while watching the hatching on a large shaded plane. Hatch lines should stay attached to the surface and not swim, shimmer or pop between frames. Repeat on `?forceWebGL=1`. Record "stable", "slight shimmer" or "swimming" for each backend.

### C6. Frame feel and frame times

1. Load `http://localhost:5183/?continuous=1` (draws every frame; otherwise the Studio only draws when something changes) and select Reference composition.
2. Orbit continuously for about 10 s. Note whether it feels smooth at your monitor's refresh rate.
3. Chrome DevTools → Performance: record 10 s of orbiting on the reference scene; note the "Frames" row's typical frame duration, the number of dropped frames, and the FPS summary.
4. Copy the in-app status values (Draw calls, Triangles, Instances) at the end of the recording.
5. Optional: repeat with `?continuous=1&stress=1000`.

`pnpm bench:studio` is **not** a substitute: it runs headless Chromium inside WSL2 on SwiftShader and can only produce software-rendering numbers.

## Results template

Copy this table into a new section at the bottom of this file (or a PR comment) with the date of the run. Leave **Status** as PENDING until every row is filled.

| Item | Value |
|---|---|
| Date | |
| Chrome version (`chrome://version`) | |
| NVIDIA driver version | |
| OS build | |
| `chrome://gpu` WebGPU line | |
| Studio commit (`git rev-parse --short HEAD` in the worktree) | |
| Adapter tooltip text (default URL) | |
| Backend (default URL) | |
| GPU class (default URL) | |
| Backend (`?forceWebGL=1`) | |
| GPU readout (`?forceWebGL=1`) | |
| GPU class (`?forceWebGL=1`) | |

| Check | Pass / fail | Screenshot | Observations |
|---|---|---|---|
| C1 backend = WebGPU, GPU names RTX 5070, class `physical` | | `docs/screenshots/p0-webgpu-rtx5070-statusbar.png` | |
| C2 reference composition renders on WebGPU | | `docs/screenshots/p0-webgpu-rtx5070-reference.png` | |
| C3 reference composition renders on forced WebGL2 | | `docs/screenshots/p0-webgpu-rtx5070-reference-webgl2.png` | |
| C4 backend parity (no console shader errors) | | | |
| C5 hatching stable under orbit (WebGPU / WebGL2) | | | |
| C6 frame feel and DevTools frame times | | | |

After the run, update the capability matrix in ADR 0005 (rows "WebGPU on a physical GPU" and "WebGL2 on a physical GPU") and keep ADR 0005's status unchanged unless the owner decides otherwise.

## Start of Phase 1: automated smoke test on a different physical GPU (2026-11-25)

Owner decision D5 deferred a real-GPU smoke test to the start of Phase 1. The owner's RTX 5070 machine was not reachable. This Mac has a physical GPU, so checks C1–C4 were automated on it with Playwright driving the installed Google Chrome. **This run does not replace the RTX 5070 test above, which stays PENDING.** It shows that the WebGPU backend, three.js's TSL-to-WGSL compilation of the ink material and the WebGL2 fallback work on one real GPU.

| Item | Value |
|---|---|
| Date | 2026-11-25 |
| Machine | Apple M5 Pro (Metal 4), macOS 26.5.1 |
| Browser | Google Chrome 158.0.8127.37 (system install), new headless mode, launched by Playwright 1.65.1 with `channel: "chrome"` |
| Studio commit | `5b2a995` (final Phase 0 head; the Studio is unchanged at the start of Phase 1) |
| Adapter tooltip (default URL) | `vendor=apple architecture=metal-3 device=- description=- isFallbackAdapter=false; … source=webgpu-device-adapter-info` |
| Backend / GPU / class (default URL) | `WebGPU` / `apple metal-3` / `physical` |
| Backend / GPU / class (`?forceWebGL=1`) | `WebGL2` / `ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Pro, Unspecified Version)` / `physical` |

| Check | Result | Screenshot | Observations |
|---|---|---|---|
| C1 backend = WebGPU on a physical adapter | **pass (Apple GPU, not the RTX 5070)** | `docs/screenshots/p1-webgpu-m5pro-reference.png` (status bar) | The class comes from three's own device adapter info, not from the reporting-only `requestAdapter()` |
| C2 reference composition on WebGPU | **pass** | `docs/screenshots/p1-webgpu-m5pro-reference.png` | Quantized bands, hatching, grain, haze and outlines present; 15 draw calls, 5,154 triangles, 543 instances, the same as the Phase 0 software baseline |
| C3 reference composition on forced WebGL2 | **pass** | `docs/screenshots/p1-webgpu-m5pro-reference-webgl2.png` | Same counts |
| C4 backend parity | **pass** | — | Viewport crops compared pixel by pixel: 0.59 % of pixels differ by more than 30/255 in luminance; mean absolute difference 0.63/255. No shader compile error or warning in the console. The only console error was a 404 for `/favicon.ico` (the Studio has no favicon) |
| C5 hatching stability under orbit | **not assessed** | — | Needs a human watching motion |
| C6 frame feel and DevTools frame times | **not assessed** | — | Needs a human and a headed DevTools session |

