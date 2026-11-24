# ADR 0008: Assembly catalog promotion and canonical hashing

- Status: Accepted for Phase 0
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
- **Depth bound:** `MAX_ASSEMBLY_DEPTH = 4` nested assembly levels (`depth-exceeded`).
- **Cycles** are rejected (`assembly-cycle`).
- **Canonical hash:** FNV-1a 64-bit over parts sorted by `(anchor, rotation, ref key)`, formatted as `anchor|rotation|kind:id@version`. Part ids, part order and recipe name are excluded; rotation is included (test: "the canonical hash ignores part ids, order and name but not rotation").
- **Duplicate-recipe rejection:** two recipes with different ids and the same hash fail `createCatalog` with `duplicate-recipe`.

## Consequences

- `catalog.flatten(id)` expands nested assemblies into leaf placements with path ids; `roof-house` and `watchtower` flatten in about 4–4.5 µs (see benchmarks).
- FNV-1a is not collision-resistant; with a few thousand recipes accidental collisions are unlikely, but the hash is not a security boundary and a collision would be reported as a false duplicate.
- Hashing recipes does not hash the geometry of the parts they reference, only their `id@version`. Changing a primitive without bumping its version silently changes assemblies without changing their hash. Versioning discipline is a Phase 1 rule.
- Duplicate detection is only by identical part lists. Two geometrically equivalent but structurally different recipes (for example a 2×1 slab versus two 1×1 slabs) are accepted as distinct.
- Level and depth limits are chosen by judgement (3 and 4); no catalog large enough exists to tune them.

## Evidence

- Tests in `packages/foldon/test/assembly.test.ts` (cycle, level, duplicate-hash, overlap, incompatible sockets, flatten-equals-mask, JSON round-trip).
- Commit `45576a8`; assemblies `roof-module`, `watchtower`, `roof-house`, `ruined-gate` in `packages/foldon/src/assemblies.ts`.
