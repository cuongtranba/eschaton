# ADR 0005: Renderer — `WebGPURenderer` with TSL node materials and automatic WebGL2 fallback

- Status: Accepted for Phase 0; **the WebGPU backend has never been exercised**
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
- Capability matrix: first rows recorded below ("Capability evidence"); the physical-GPU rows are pending. Still needed before Phase 5: WebGPU availability per target browser, which TSL nodes the ink material uses that are WebGPU-only (R9 says some functions are), line-width behaviour, MSAA, timestamp queries, and storage/compute availability.
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
| WebGPU on a physical GPU | **No** | Pending: [manual test](../testing/webgpu-manual-test.md) on the owner's Windows Chrome with an RTX 5070 | **PENDING.** TSL graph compilation to WGSL, line rendering, MSAA and visual parity are unknown. |
| WebGPU on the SwiftShader fallback adapter | Partially: the adapter is reachable with `google-chrome` 138 and the flags above, and the Studio starts, creates a device and reports `software`; frames were not compared or timed | Ad hoc probe on 2026-11-24 (readout above); not in CI | Renderer initialises. Output correctness and performance not assessed; a fallback adapter is never evidence for the WebGPU target. |
| WebGL2 on SwiftShader | **Yes** | Playwright headless Chromium: every e2e test, screenshot and benchmark in Phase 0; CI | Works. Ink look renders; frame times are software-rendering numbers and say nothing about the §9.1 targets. |
| WebGL2 on a physical GPU | **No** | Pending: manual test check C3 | **PENDING.** |

The status of this ADR is unchanged. Closing the two pending rows is part of the Phase 0 owner review, not a precondition for the Phase 0 decisions recorded above.
