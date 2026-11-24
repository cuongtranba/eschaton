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
- Capability matrix: **TODO**. Needed before Phase 5: WebGPU availability per target browser, which TSL nodes the ink material uses that are WebGPU-only (R9 says some functions are), line-width behaviour, MSAA, timestamp queries, and storage/compute availability.
- WebGL lines are one device pixel wide, so outline weight cannot vary with distance (look-dev technique 5). Quad-based lines are the proposed experiment.
- Compare mode renders the scene twice into one canvas with a scissor; this was only run on WebGL2.
- Shaders cannot assume bit-equal results across backends; any future GPU simulation must not be assumed deterministic.

## Evidence

- `apps/studio/src/renderer/labRenderer.ts`, `materials.ts`; e2e "falls back to the WebGL2 backend when forced" and "renders a non-blank scene on a reported backend" in `apps/studio/e2e/lab.spec.ts`.
- Benchmark environment labelling and renderer string: [`../../benchmarks/`](../../benchmarks/).
- R8, R9, R10 in [`../research/phase-0.md`](../research/phase-0.md). R9 was only half-read.
