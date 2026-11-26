# ADR 0005: Renderer — `WebGPURenderer` with TSL node materials and automatic WebGL2 fallback

- Status: **Accepted with amendments** — owner decision D3 (2026-11-25, recorded in [`../review/phase-0-owner-review.md`](../review/phase-0-owner-review.md) §0) approved this ADR on condition that the independent-review amendments ([`../review/adr-review.md`](../review/adr-review.md)) are applied. They are applied in the section "Amendments (owner D3, 2026-11-25)" below. **At the time of D3 and D5 the WebGPU backend had never been exercised on a physical GPU.** Owner decision D5 conditionally waived that test for the Phase 0 gate only and moved it to the start of Phase 1. The waiver is not a verification and does not waive any later gate. Since then an automated run on an Apple M5 Pro (2026-11-25) is reported in the "Capability evidence" matrix below; the owner's RTX 5070 test is still **not performed**.
- Date: 2026-11-24
- Master plan: §2.3, §9; research R8, R9, R10

## Context

The plan prefers WebGPU for advanced effects and requires a WebGL 2 fallback with feature-detected compute. The Studio needs custom ink shading (quantized light, hatching, grain, haze) on instanced geometry.

## Options considered

1. **`WebGLRenderer` + `ShaderMaterial` / `onBeforeCompile`.** Mature, but these are not supported by `WebGPURenderer`, so every shader would be rewritten for a WebGPU move.
2. **`WebGPURenderer` with TSL node materials.** One shader description compiled to WGSL or GLSL. Falls back to WebGL 2 automatically; `forceWebGL` forces it for tests.
3. **Raw WebGPU.** No fallback; far more code.

## Decision

Option 2, three 0.187.0 (`three/webgpu`, TSL).

- The renderer adapter (`apps/studio/src/renderer/labRenderer.ts`) awaits `renderer.init()` before drawing and reports the actual backend in the status bar (`WebGPU` or `WebGL2`).
- All surfaces use one `MeshBasicNodeMaterial` whose `colorNode` carries the ink shading, driven by uniforms (`apps/studio/src/renderer/materials.ts`). No compute or atomic nodes are used.
- Each recipe-and-material batch is one `InstancedMesh`; React components or objects per Foldon are avoided; content is disposed and rebuilt when the layout key changes.
- `?forceWebGL=1` forces the fallback.

## Consequences

- **Every measurement and screenshot in Phase 0 comes from the WebGL2 fallback backend in headless Chromium without a GPU adapter** (software rasteriser). The WebGPU code path, its shader compilation of the TSL graph, and parity between the two backends are untested.
- Capability matrix: first rows recorded below ("Capability evidence"); the owner's RTX 5070 rows are pending and the Apple M5 Pro rows are recorded (automated, 2026-11-25). Still needed before Phase 5: WebGPU availability per target browser, which TSL nodes the ink material uses that are WebGPU-only (R9 says some functions are), line-width behaviour, MSAA, timestamp queries, and storage/compute availability.
- WebGL lines are one device pixel wide, so outline weight cannot vary with distance (look-dev technique 5). Quad-based lines are the proposed experiment.
- Compare mode renders the scene twice into one canvas with a scissor; this was only run on WebGL2.
- Shaders cannot assume bit-equal results across backends; any future GPU simulation must not be assumed deterministic.

## Evidence

- `apps/studio/src/renderer/labRenderer.ts`, `materials.ts`; e2e "falls back to the WebGL2 backend when forced" and "renders a non-blank scene on a reported backend" in `apps/studio/e2e/lab.spec.ts`.
- Capability readout: `apps/studio/src/renderer/gpuCapability.ts`; the e2e test "never labels a software rasteriser as a physical GPU" in `apps/studio/e2e/lab.spec.ts`.
- Benchmark environment labelling and renderer string: [`../../benchmarks/`](../../benchmarks/).
- R8, R9, R10 in [`../research/phase-0.md`](../research/phase-0.md). R9 was only half-read.

## Capability evidence (2026-11-24)

### What was probed

Machine: WSL2 on a Ryzen 7 7800X3D. `/dev/dxg` and `libd3d12` exist, but the only Vulkan ICDs installed are Intel, lavapipe, Radeon and virtio; there is no `dozen`/`dzn`, so no Vulkan driver reaches the physical GPU. Probes were run on `http://localhost` (a secure context) with Playwright Chromium (headless) and `/usr/bin/google-chrome` 138 (headless) with `--enable-unsafe-webgpu`, `--enable-features=Vulkan`, `--use-angle=vulkan` and `--ignore-gpu-blocklist` in various combinations:

- `navigator.gpu.requestAdapter()` returned only `{ vendor: "google", architecture: "swiftshader", isFallbackAdapter: true }`.
- The WebGL2 renderer string was `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`.
- **No physical GPU is reachable from this machine.** SwiftShader is a CPU rasteriser and is never reported as a physical GPU.

### How three 0.187 exposes adapter information

`WebGPUBackend.init` calls `navigator.gpu.requestAdapter({ powerPreference, featureLevel: "compatibility", xrCompatible })` and keeps only the device, in a local variable named `adapter` that is not stored on the backend. The Studio therefore reads `renderer.backend.device.adapterInfo` (`GPUDevice.adapterInfo`). With Chrome 138 and the flags above, the device that three created reported **empty adapter info and `isFallbackAdapter=false`**, while a separate plain `navigator.gpu.requestAdapter()` reported SwiftShader with `isFallbackAdapter=true`. They are different adapters (compatibility-mode request versus default request), so the plain request is not proof of what three rendered on. The Studio handles this explicitly:

| Situation | `GPU` readout | `GPU class` |
|---|---|---|
| Device adapter info identifies the adapter | description, else device, else `vendor architecture` | `software` if `isFallbackAdapter` or the text matches `swiftshader\|llvmpipe\|lavapipe\|software\|basic render`, else `physical` |
| Device info empty, `requestAdapter()` identifies a software adapter | label ending in `(requestAdapter, reporting only)` | `software` (conservative: assume the worse) |
| Device info empty, `requestAdapter()` identifies something else | same label | `unknown` (never `physical` from a reporting-only call) |
| WebGL2 backend with `WEBGL_debug_renderer_info` | `UNMASKED_RENDERER_WEBGL` | same pattern test, else `physical` |
| WebGL2 backend, masked renderer | masked renderer string | `unknown` |

The status bar shows `Backend`, `GPU`, `GPU class` and `forceWebGL` (`data-testid` `stat-backend`, `stat-gpu`, `stat-gpu-class`, `stat-force-webgl`); the tooltip on `GPU` carries every adapter field and the source. The Studio benchmark copies these into its environment block.

Readouts seen in this environment:

| Browser and flags | Backend | GPU | GPU class |
|---|---|---|---|
| Playwright Chromium, headless, default | WebGL2 | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)` | `software` |
| Playwright Chromium, headless, `?forceWebGL=1` | WebGL2 | same | `software` |
| `google-chrome` 138, WebGPU flags, default | WebGPU | `google swiftshader (requestAdapter, reporting only)` | `software` |
| `google-chrome` 138, WebGPU flags, `?forceWebGL=1` | none: three throws `Cannot read properties of null (reading 'getSupportedExtensions')` because no WebGL2 context is created with these flags | | |

### Capability matrix

| Configuration | Exercised? | Where | Result |
|---|---|---|---|
| WebGPU on a physical GPU: owner's RTX 5070, Windows Chrome (the target) | **No** | Pending: [manual test](../testing/webgpu-manual-test.md) | **PENDING.** |
| WebGPU on a physical GPU: Apple M5 Pro, macOS Chrome 158 (start of Phase 1, 2026-11-25) | **Yes, automated C1–C4** | [manual test, Phase 1 section](../testing/webgpu-manual-test.md) | Class `physical` from three's device adapter info. The TSL ink material compiles to WGSL and renders the reference composition. Parity with WebGL2 on the same GPU: 0.59 % of pixels differ by more than 30/255. No shader errors. Motion stability and frame feel (C5, C6) are not assessed. |
| WebGPU on the SwiftShader fallback adapter | Partially: the adapter is reachable with `google-chrome` 138 and the flags above, and the Studio starts, creates a device and reports `software`; frames were not compared or timed | Ad hoc probe on 2026-11-24 (readout above); not in CI | Renderer initialises. Output correctness and performance not assessed; a fallback adapter is never evidence for the WebGPU target. |
| WebGL2 on SwiftShader | **Yes** | Playwright headless Chromium: every e2e test, screenshot and benchmark in Phase 0; CI | Works. Ink look renders; frame times are software-rendering numbers and say nothing about the §9.1 targets. |
| WebGL2 on a physical GPU: RTX 5070 | **No** | Pending: manual test check C3 | **PENDING.** |
| WebGL2 on a physical GPU: Apple M5 Pro (ANGLE Metal) | **Yes, automated C3** | as above | Renders the reference composition with the same draw counts. |

The status of this ADR is its Status line at the top. Closing the two pending RTX 5070 rows is not a precondition for the Phase 0 decisions recorded above.

## Amendments (owner D3 and D5, 2026-11-25)

- **Accepted conditionally on D5.** The owner waived the physical-GPU WebGPU test for the Phase 0 gate and deferred a real-GPU smoke test to the start of Phase 1. Both RTX 5070 rows in the capability matrix stay **PENDING** until that run is recorded (when this amendment was written, both "physical GPU" rows were pending; the Apple M5 Pro smoke test has since been recorded in the matrix and does not close the RTX 5070 rows). A run on a software adapter (SwiftShader, `GPU class: software`) never counts. Owner-run instructions: [`../testing/webgpu-manual-test.md`](../testing/webgpu-manual-test.md).
- This ADR does not block Phase 1 domain code. Any Phase 1 milestone criterion that depends on the GPU is reported as unresolved until the physical run exists.
