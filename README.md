# Eschaton

A web-based procedural world engine and laboratory: a small vocabulary of origami-inspired geometric pieces (**Foldons**) composed, folded and collapsed under explicit rules, rendered as a living woodcut print. See [`docs/master-plan.md`](docs/master-plan.md) for the full design and [`AGENTS.md`](AGENTS.md) for contributor rules.

Status: **Phase 0 — research & geometry lab.**

## Requirements

Node ≥ 22.12, pnpm 10.

## Commands

```sh
pnpm install
pnpm dev        # Studio at http://localhost:5173
pnpm test       # Vitest (packages)
pnpm lint       # ESLint, type-aware
pnpm typecheck  # tsc per project
pnpm build      # production build
pnpm e2e        # Playwright smoke tests (starts the dev server itself)
```

First-time Playwright setup: `pnpm --filter @eschaton/studio exec playwright install chromium` (a browser already installed under `~/.cache/ms-playwright` is reused).

## Layout

```
apps/studio/        Vite + React 19 Studio (laboratory UI)
packages/foldon/    @eschaton/foldon — geometry recipes, definitions, placement
experiments/        throwaway research code
docs/               master plan, research notes, ADRs
assets/reference/   art-direction reference
```

## Version pins

All versions are pinned exactly after checking the npm registry. **TypeScript is pinned to 6.0.3, not 7.x:** `typescript-eslint@8.74.0` declares peer `typescript >=4.8.4 <6.1.0`, so the native TypeScript 7 port cannot be used with the type-aware lint gate yet. Revisit when typescript-eslint adds TS 7 support.

## `@eschaton/foldon`

Immutable, serializable Foldon definitions: a folded-paper-net geometry recipe (panels + a crease tree authored in the rest pose), external-face sockets, components, and placement transforms. `poseGeometry` folds the recipe by rotating rigid sub-trees about hinges; targets outside a crease range are refused, never clamped. `primitiveCatalog` holds P01–P09. Fold-angle and coordinate conventions are documented in [`AGENTS.md`](AGENTS.md). Phase 0 limitation: crease networks must be trees (no closed loops).
