# ADR 0008: Assembly catalog promotion and canonical hashing

- Status: **Accepted with amendments** — owner decision D3 (2026-11-25, recorded in [`../review/phase-0-owner-review.md`](../review/phase-0-owner-review.md) §0) approved this ADR on condition that the independent-review amendments ([`../review/adr-review.md`](../review/adr-review.md)) are applied. They are applied in the section "Amendments (owner D3, 2026-11-25)" below; the Phase 0 code follows it.
- Date: 2026-11-24
- Master plan: §4.1, §13 ("Recursive catalog explosion")

## Context

Assemblies are built from foldons and from smaller assemblies. Without bounds, equivalent recipes under different names multiply the catalog, nesting can cycle, and a solver would see duplicate candidates.

## Options considered

1. **Free-form nesting by name.** Simple; explodes and cycles.
2. **Content-addressed recipes only.** Removes duplicates by construction, but loses stable human ids.
3. **Named, versioned recipes with a canonical content hash used for duplicate detection, explicit levels and a depth bound.**

## Decision

Option 3 (`packages/foldon/src/assembly.ts`, `registry.ts`).

- A recipe is `{ id, version, name, level: 1|2|3, parts, tags }`; a part is `{ id, ref, anchor, rotation }` and `ref` is a foldon or an assembly with an explicit version.
- **Promotion** means passing `createCatalog`: every part reference resolves (`ref-unknown`, `ref-version-unknown`), parts do not overlap, touching external sockets are compatible, the recipe contains at least one part, and the compiled definition (footprint mask, bounds, external sockets, semantics) is derived rather than authored.
- **Level ordering:** an assembly can only nest assemblies of a strictly lower level (`level-not-above-children`).
- **Depth bound:** implied by level ordering. Levels are 1–3 and each nested assembly has a strictly lower level, so nesting depth is at most 3. (The former explicit guard `MAX_ASSEMBLY_DEPTH = 4` with `depth-exceeded` could never fire and was removed at Phase 0 closure; see the amendments.)
- **Cycles** are rejected (`assembly-cycle`).
- **Canonical hash:** FNV-1a 64-bit over parts sorted by `(anchor, rotation, ref key)`, formatted as `anchor|rotation|kind:id@version`. Part ids, part order and recipe name are excluded; rotation is included (test: "the canonical hash ignores part ids, order and name but not rotation").
- **Duplicate-recipe rejection:** two recipes with different ids and the same hash fail `createCatalog` with `duplicate-recipe`.

## Consequences

- `catalog.flatten(id)` expands nested assemblies into leaf placements with path ids; `roof-house` and `watchtower` flatten in about 4–4.5 µs (see benchmarks).
- FNV-1a is not collision-resistant; with a few thousand recipes accidental collisions are unlikely, but the hash is not a security boundary and a collision would be reported as a false duplicate.
- Hashing recipes does not hash the geometry of the parts they reference, only their `id@version`. Changing a primitive without bumping its version silently changes assemblies without changing their hash. In Phase 1 the world detects this (see the amendments, "Versioned definitions").
- Duplicate detection is only by identical part lists. Two geometrically equivalent but structurally different recipes (for example a 2×1 slab versus two 1×1 slabs) are accepted as distinct.
- The level limit (3) is chosen by judgement; no catalog is yet large enough to tune it. Depth follows from it.

## Addendum (Phase 0 closure, 2026-11-24): typed module contracts and review findings

Status of this ADR is unchanged (Proposed — awaiting owner approval). Facts recorded:

- **Typed module contracts (commit `ffd2cc4`).** `ModuleContract` (`packages/foldon/src/contract.ts`) states a footprint span, an optional height range and the allowed socket profiles per side. An assembly recipe may declare `contract: { id, version }`. `createCatalog` checks the claim against the **compiled** footprint and external sockets: the contract stores requirements, not geometry, so the compiled assembly stays the only source of occupancy and sockets. New issue codes are `contract-invalid`, `contract-unknown`, `contract-footprint-mismatch` and `contract-boundary-incompatible`. `catalog.satisfiesContract(assembly, contract, rotation)` checks a quarter-turned fit using the existing `placeFootprint`/`placeSockets`. Authored contracts: `module-2x2` (`roof-module`) and `module-4x4` (`roof-house`); the former `module-*` tags were removed.
- **Hash decision.** `contract` is **not** part of the canonical recipe hash. The hash identifies compiled content; a contract is a checked claim about that content, so identical parts with different declared contracts must still be caught as duplicate recipes, and a contract version change must not alter the content hash.
- **Contract boundaries are orientation-free.** They inherit the socket model of ADR 0009 (no turn or hand), so a contract cannot yet require a side to face a particular way. ADR 0012 (proposed) would add that.
- **Two checks cannot fire today** (independent review, `../review/adr-review.md`):
  - `MAX_ASSEMBLY_DEPTH = 4` cannot be exceeded, because levels run from 1 to 3 and each nested assembly must have a lower level, so depth is at most 3.
  - The contract's "no holes in the boundary" check cannot fire through the public API, because any assembly that passes the footprint check exposes a socket on every edge column.
  Neither check is tested, because no input can make either one fail. Both were removed at Phase 0 closure (see the amendments).

## Evidence

- Tests in `packages/foldon/test/assembly.test.ts` (cycle, level, duplicate-hash, overlap, incompatible sockets, flatten-equals-mask, JSON round-trip).
- Commit `45576a8`; assemblies `roof-module`, `watchtower`, `roof-house`, `ruined-gate` in `packages/foldon/src/assemblies.ts`.

## Amendments (owner D3, 2026-11-25)

- **Unreachable checks removed** (review question 1 for this ADR; the addendum's two inert checks). `MAX_ASSEMBLY_DEPTH` and the `depth-exceeded` issue code are gone from `registry.ts`, `issues.ts` and the public entry point. Depth ≤ 3 follows from levels `1|2|3` and `level-not-above-children`, which stay tested. The contract check's "no exposed socket at a boundary column" branch is also removed (`contract.ts`, `boundaryIssues`): any footprint that passes the exact-fill check exposes a socket on every boundary column, so the branch could not fire either. Neither change alters any accepted or rejected catalog; all 39 `@eschaton/foldon` tests pass unchanged. If master plan §4.1 levels L4–L5 are ever introduced, the depth bound has to be reconsidered then.
- **A1 contract decision recorded** (review question 2): the addendum above records that `contract` is not hashed. Two further points:
  - `ModuleSpan = 2 | 4` hard-codes the §14 module sizes and is provisional.
  - Allowing `open` in a contract boundary means the contract guarantees nothing on that side.
  Contract boundaries stay orientation-free until a contract needs orientation. ADR 0012 question 9 is answered "later".
- **Versioned definitions** (owner D3). The world snapshot header (ADR 0011) carries a catalog fingerprint. It hashes every foldon and assembly **by its canonical content together with `id@version`**, and every module contract likewise. So editing a definition without bumping its version changes the fingerprint, and a snapshot or commit log recorded against the old content is refused instead of being silently reinterpreted (ADR 0011 invariant 11). The recipe hash itself stays content-of-references only, as decided above.

## Correction at the Phase 1 gate (owner R2, 2026-11-25): where a module contract applies

- **A module contract is a claim about an assembly in its own (local) frame.** `createCatalog` proves the claim once, at rotation 0, against the compiled footprint and external sockets. The claim then turns with the assembly: placing the assembly in the world at any quarter turn, or nesting it quarter-turned inside a larger recipe, does not re-check it.
- **`catalog.satisfiesContract(assembly, contract, rotation)` answers a different question:** does this assembly, turned, fit a slot described by a contract in the slot's frame? That is for slot-based (hierarchical) solving. It is not a placement precondition.
- **Defect.** The self-assembly planner applied the slot question to a free placement, so an assembly with an asymmetric contract (2×4) could be instantiated at a quarter turn but not self-assembled at the same pose. Regression tests (`packages/world/test/contract.test.ts`): "an assembly with an asymmetric module contract self-assembles at every rotation at which it can be instantiated" (failed before); "an assembly nesting a quarter-turned contracted module is placed identically by instantiate and by self-assembly".
- **Fix.** `resolvePlacement` (`packages/world/src/model.ts`) is the single definition of "this catalog item at this world pose", used by both `instantiate` and `planAssembly`. Placement validity itself (occupancy, legal adjacency, bonds) has one enforcement point: the invariants in `applyPatch`. Independent primitive placements carry no contract and are not constrained by one.
- The shipped contracts (`module-2x2`, `module-4x4`) are symmetric, so no shipped behaviour changed.
