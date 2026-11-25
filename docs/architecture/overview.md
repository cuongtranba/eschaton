# Architecture overview (Phase 0, extended in Phase 1)

This describes the code as it is at the end of Phase 0, plus the Phase 1 runtime package `@eschaton/world`, and compares it with the target architecture in [master plan §8](../master-plan.md). The plan's diagram shows runtime data flow, not imports; the diagram below shows both for the part that exists.

## What exists

Six projects. The first four are product code.

| Project | Package name | Role |
|---|---|---|
| `packages/foldon` | `@eschaton/foldon` | Pure TypeScript domain library: ids, `Result`, definitions, validation, geometry recipes and hinge posing, placement transforms, the P01–P09 catalog, assembly recipes, the catalog registry. No DOM, no three.js, no runtime dependencies. |
| `packages/world` | `@eschaton/world` | Phase 1 runtime state: an immutable `WorldState` (header, entities, bonds, lineage, conservation), the only write path `applyPatch` (atomic, strict base revision), replay from the commit log, canonical snapshots and hashes, invariant checks, and derived queries (occupancy, contacts). Imports only `@eschaton/foldon`. ADRs 0010–0014. |
| `packages/wave` | `@eschaton/wave` | Phase 2 generation: `src/solver` (pure placement-based WFC, imports foldon only), `src/region.ts` (world region → solver problem → inert proposal), `src/host.ts` (sliced, cancellable jobs). Holds no world state. ADRs 0015–0016. |
| `apps/studio` | `@eschaton/studio` | Vite + React 19 laboratory: lab state, view-model building, the reference-scene generators, the renderer adapter, UI panels, and (Phase 1 M7) World mode, which renders a `WorldState` from `@eschaton/world`. |
| `experiments/wfc-placement` | `@eschaton/exp-wfc-placement` | Throwaway solver comparison. Nothing imports it. See [ADR 0004](../decisions/0004-multi-cell-encoding.md). |
| `tools/architecture` | `@eschaton/architecture` | Architecture test: lints virtual files against the repository ESLint config to prove each dependency rule rejects a violation. |

## Module table: now versus §8 target

| §8 module | Phase 0 status | Where it lives | Notes |
|---|---|---|---|
| contracts | **Merged into foldon** | `packages/foldon/src/{ids,result,issues,vec}.ts` | Branded ids, `Result<T,E>`, `ValidationIssue`. No commands or transactions yet. ([ADR 0001](../decisions/0001-package-layout.md)) |
| foldon | **Exists** | `packages/foldon/src/` | Catalog, geometry recipes, assembly validation, canonical hashing, and (Phase 1 M3) the versioned socket table with the directional matcher `socketMismatches` ([ADR 0012](../decisions/0012-directional-sockets.md)). Owns definitions; does not own placement in a world. |
| generation | **Experiment only** | `experiments/wfc-placement` | 2D throwaway; the Phase 2 solver will be new code. |
| simulation | **Absent** | none | Component *data* exists on definitions; no system reads it ([ADR 0007](../decisions/0007-component-data-and-system-order.md)). |
| world | **Exists (Phase 1)** | `packages/world/src/` | Immutable `WorldState`, `applyPatch`, revisions and replay; no clock (Phase 4). The Studio's World mode holds one `WorldSession` and writes only through `applyPatch`/`runSystem`. Owner decision D4 approved the new package (ADR 0001 and ADR 0011 amendments). |
| renderer | **Inside the Studio** | `apps/studio/src/renderer/` | Adapter from `ViewModel` to three.js; the only code that imports `three`. ([ADR 0005](../decisions/0005-renderer-webgpu-tsl-webgl2-fallback.md)) |
| presets | **Absent** | none | The look palette and scene constants are code (`lab/look.ts`, `lab/palette.ts`, `lab/composition/`). |
| studio | **Exists** | `apps/studio/src/{App,ui,lab}` | Sends commands to the reducers; never mutates domain definitions or world state. World mode: `lab/world/`. |
| persistence / replay | **Snapshot and replay exist (Phase 1)** | `packages/world/src/{world,snapshot,patch}.ts` | `serializeSnapshot` and `parseSnapshot` (version-checked); `replay` re-applies recorded patches and reports the first divergence. No storage backend. |

## Dependency direction

The allowed import graph is enforced by ESLint (`eslint.config.js`, `no-restricted-imports` and `no-restricted-syntax`) and proved by `tools/architecture`, which lints virtual files against the real config and asserts each rule rejects a violating import and accepts the allowed one. Arrows point from importer to imported.

```mermaid
flowchart TD
  F["@eschaton/foldon (pure domain)"]
  W["@eschaton/world (pure runtime state)"]
  subgraph STUDIO["apps/studio/src"]
    UI["ui, App, main (React)"]
    R["renderer (three)"]
    L["lab (pure state and view-model)"]
  end
  X["experiments/*, benchmarks, tools/*"]
  UI --> R
  UI --> L
  R --> L
  UI --> F
  R --> F
  L --> F
  L --> W
  UI --> W
  X --> F
  W --> F
  F -. "never" .-> W
  X -. "never" .-> STUDIO
  F -. "never" .-> STUDIO
  F -. "never" .-> X
```

`foldon` is the bottom of the graph: it may not import any other `@eschaton/*` package. This is enforced before Phase 1 adds `@eschaton/world` (which will import `foldon`), so the reverse import, which would create a cycle, can never land ([ADR 0001](../decisions/0001-package-layout.md) amendment).

| Importer | May import | Must not import |
|---|---|---|
| `packages/foldon` | its own modules | `three`, `react`, `react-dom`, Node built-ins (bare or `node:`), **any other workspace package** (`@eschaton/*` except itself), any app, experiment, tool or benchmark package |
| `packages/world` | its own modules, `@eschaton/foldon` entry | `three`, `react`, `react-dom`, Node built-ins, any other workspace package, any app |
| `apps/studio/src/lab` | `@eschaton/foldon` and `@eschaton/world` entries | `three`, `react`, `react-dom`, `renderer`, `ui`, `App`, `main` |
| `apps/studio/src/renderer` | `three`, `lab`, `@eschaton/foldon` entry | `react`, `react-dom`, `ui`, `App`, `main` |
| `apps/studio/src/ui`, `App`, `main` | `react`, `lab`, `renderer`, `@eschaton/foldon` and `@eschaton/world` entries | `three` |
| `experiments/**`, `benchmarks/**`, `tools/**` | workspace package entry points | any app, deep paths |
| every workspace package and app | other packages only through the `exports` entry point | `@eschaton/*/<subpath>`, relative paths into `apps/`, `packages/`, `experiments/`, `benchmarks/`, `tools/` |

- **Composition over inheritance:** class `extends` is a lint error in every first-party `.ts`/`.tsx` file. There are no exceptions today. A third-party adapter that genuinely has to subclass would get a dedicated config block for that file in `eslint.config.js` with a comment naming the dependency; interface `extends` is always allowed.
- **Tests:** `*.test.ts` files additionally forbid relative imports and `vi`, so behavioral tests reach code only through the package entry point (`tools/architecture` is the deliberate exception that inspects source by design).
- **Current direction:** `renderer` imports lab values (`look`, `palette`) and types; `ui` and `App.tsx` import `renderer/labRenderer` for `RendererStats` and the renderer factory. No import runs the other way.
- **Limitations:** dynamic `import()` and `require` are not covered; cycles inside one folder are not detected (there is no dependency-cruiser gate); new workspace packages are picked up automatically for the "never import apps/experiments/tools" rules because the config reads workspace package names, but a new layer inside the Studio needs a new entry in `importAreas`.
- Tests of `@eschaton/foldon` import only its entry point. The Studio is covered by Playwright specs, not unit tests.

## Runtime data flow

```mermaid
flowchart LR
  subgraph FOLD["packages/foldon (@eschaton/foldon)"]
    CAT["primitiveCatalog P01-P09 and assemblyCatalog"]
    REG["createCatalog: validate, compile, hash, flatten"]
    POSE["foldProgress, poseGeometry, placeGeometry"]
    CAT --> REG
  end
  subgraph WORLD["packages/world (@eschaton/world)"]
    APPLY["applyPatch, runSystem(windFold), replay, hashState"]
  end
  subgraph LAB["apps/studio/src/lab (no three.js, no React)"]
    STATE["LabState reducer: commands in, state out"]
    SESSION["WorldSession reducer (lab/world/session.ts)"]
    WVIEW["lab/world/view.ts: entities, derived offsets, backdrop"]
    SESSION --> WVIEW
    WVIEW --> VM
    LIB["library: catalog items"]
    COMP["composition: sky, ridges, district, referenceScene"]
    SCENE["scene.ts: buildViewModel"]
    VM["ViewModel: batches, sockets, bounds, look"]
    LIB --> SCENE
    STATE --> SCENE
    COMP --> SCENE
    SCENE --> VM
  end
  subgraph REND["apps/studio/src/renderer (only importer of three)"]
    ADAPT["labRenderer: apply ViewModel"]
    MAT["materials: TSL ink node material"]
    GFX["WebGPURenderer with WebGL2 fallback"]
    ADAPT --> MAT
    ADAPT --> GFX
  end
  subgraph UI["apps/studio/src/ui and App.tsx"]
    PANELS["Catalog, Inspector, Toolbar, Look panel, Viewport, StatusBar"]
  end
  REG --> LIB
  POSE --> SCENE
  VM --> ADAPT
  PANELS -- "dispatch commands" --> STATE
  PANELS -- "world commands" --> SESSION
  SESSION -- "patches" --> APPLY
  APPLY -- "Committed or Rejected" --> SESSION
  STATE -- "state" --> PANELS
  ADAPT -. "RendererStats" .-> PANELS
```

Solid arrows are data or calls that cross a module boundary. The dotted arrow is the one place where the renderer reports back (frame statistics shown in the status bar); it carries no domain state.

## Data flow in words

1. **Catalog.** `defaultCatalog` (`packages/foldon/src/assemblies.ts`) runs `createCatalog` over the nine primitives and four assembly recipes at module load. The Studio's `loadLibrary()` turns the result into the item list; a validation failure renders a fatal error panel instead of the lab.
2. **State.** `App.tsx` owns `LabState` through `useReducer(labReducer)`: selected item, fold progress, crease overrides, overlays, look settings, camera mode, seed, reduced-motion flag, play state. UI components only `dispatch` commands.
3. **Posing and placement.** `lab/scene.ts` resolves the selected item. Assemblies are expanded with `catalog.flatten` into leaf placements; each leaf definition is posed at the current crease targets (`foldProgress`, then `poseGeometry`) once per definition, and the placements become per-instance affine bases (`lab/basis.ts` uses `placeGeometry` on a probe). The reference scene instead calls `composeReferenceScene(seed, …)`, which places the same definitions with arbitrary affine transforms and adds procedural sky, cloud and ridge panels.
4. **View model.** Everything the renderer needs is one immutable `ViewModel`: batches (posed geometry, instance bases, per-instance ink), sockets, footprint, bounds, camera preset, look and ink scale, a `layoutKey`.
5. **Renderer adapter.** `renderer.apply(viewModel)` rebuilds GPU content only when `layoutKey` changes (disposing the old meshes and geometries) and otherwise rewrites pose buffers in place. One `InstancedMesh` per batch; overlays and outlines are line batches. Frames are drawn only when something changed, unless `?continuous=1` is set for benchmarks.
6. **Feedback.** Per-frame `renderer.info` counters flow back to the status bar. No domain state flows back.
7. **World mode (Phase 1 M7).** The catalog's Scenes section has a **World** entry (`scene:world`). Ownership:
   - `@eschaton/world` owns the truth: `WorldState`, its revisions and the commit log records. The only writes are `applyPatch` (detach, re-attach) and `runSystem(windFold)`; a rejection leaves the state object unchanged and is shown as text.
   - `lab/world/session.ts` holds one `WorldSession` as pure data and a pure `worldReducer` (held by `App.tsx` through `useReducer`): the preset catalog, the `initial` world (seed `DEFAULT_SEED`, revision 0), the current `state`, the commit `log`, the selected `EntityId`, the last rejection, the wind slider value, the last replay result and the look-dev `offsets` toggle. The setup commit (`roof-module` at [0,0,0], a `leaf` at [3,0,0], a `P08` at [5,0,0]) is the first log record, so `replay(catalog, initial, log)` reproduces it too.
   - `homes` in the session maps a detached entity id to the pose it was detached from. It exists only so the UI can offer "Re-attach at previous pose"; it is **UI convenience, not domain truth**. It is never hashed or replayed; the re-attach itself is an ordinary `attach` op whose anchor and rotation are recorded in the log. Losing `homes` loses only the button.
   - `lab/world/view.ts` derives the `ViewModel` from the session: placed entities are posed with their own `fold` angles and placed with `basisOf(pose)`; detached entities use their `ContinuousTransform` (quaternion, position, uniform scale) as the basis; inventory and consumed entities are not drawn. Batches are grouped per definition, authority and fold pose, and labelled `authority: "logical" | "fragment"`; the reused sky, cloud and ridge generators become `authority: "none"` backdrop batches, and the viewport shows "Backdrop — not part of the world".
   - `lab/world/offsets.ts` derives decorative offsets from `(world seed, entity id)` only (ADR 0013 layer B). The envelope is zero by default; the "Decorative offsets (look-dev)" toggle switches to the illustrative ADR 0013 envelope (≤ 0.15 cell per axis, yaw ≤ 4°, pitch and roll ≤ 3°, scale ±8 % per axis), applied to placed entities only, about the footprint's base centre. Offsets are never stored in the session's world state and never enter `hashState`.
   - The renderer is unchanged and holds no world state: it receives a new `layoutKey` whenever the revision, the offsets toggle or the selection changes.
   - The Phase 0 catalog view and the reference composition are untouched and labelled look-dev in the catalog panel.

## Differences from the §8 target that matter for Phase 1

- The authoritative world exists only in World mode. The catalog view and the reference composition still render definitions directly from `LabState` (look-dev).
- The renderer adapter takes whole batches, not patches. A patch protocol (§8 "Snapshot and patch") is not designed.
- The view-model builder in `lab/scene.ts` re-poses every definition on every state change that affects pose; it is cached only for the reference composition (per seed).
- Composition generators live in the Studio, so they are not reachable from the headless test seam ([ADR 0001](../decisions/0001-package-layout.md)).
- No Web Worker exists; all computation runs on the main thread.

## Test and measurement seams

- `packages/foldon/test` — behavioural tests through the entry point.
- `apps/studio/e2e` — Playwright against the dev server (`pnpm e2e`), using `data-testid` hooks from the status bar and inspector.
- `packages/foldon/bench` and `apps/studio/bench` — benchmarks ([`../../benchmarks/`](../../benchmarks/)). `?continuous=1` and `?stress=N` are benchmark-only URL flags read by `lab/flags.ts`.

## Phase 2: generation data flow

```mermaid
flowchart LR
  UI["Wave panel (ui)"] -- "waveStart" --> SES["World session reducer (lab)"]
  SES -- "prepareRegion: problem + read set" --> CLI["worker client (src/worker)"]
  CLI -- "catalog source, tiles, problem" --> WRK["wave.worker: createWaveHost"]
  WRK -- "progress previews" --> CLI
  WRK -- "done: one outcome" --> CLI
  CLI -- "waveProgress / waveDone" --> SES
  SES -- "applyProposal, once" --> WLD["WorldState (@eschaton/world)"]
  SES -- "preview batches, authority none" --> VM["ViewModel"]
  WLD --> VM
```

- The worker never sees or changes world state. It gets plain data and returns placements.
- Previews are drawn and labelled "Solver preview — not part of the world". They are not entities, are not hashed and are not replayed.
- The world changes exactly once per successful solve, through `applyProposal`, and only if the region and its one-cell shell still hold what the solver was given.
