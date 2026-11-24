# ADR 0009: Socket compatibility

- Status: Accepted for Phase 0
- Date: 2026-11-24
- Master plan: §4.2

## Context

Two foldons may touch only if their sockets agree. Sockets must be derivable for every rotation, symmetric, and cheap to compare.

## Options considered

1. **Per-pair compatibility lists between definitions.** Quadratic, and every new piece edits every other.
2. **A directional profile pair table** (A may attach to B but not the reverse). Closer to "support" semantics, but makes the check order-dependent.
3. **One symmetric table of allowed profile pairs**, plus geometric agreement of the touching face.

## Decision

Option 3 (`socketsCompatible` in `packages/foldon/src/definition.ts`).

- A socket is one per **external face of the footprint**: cell, face, position at the face centre, unit normal, tangent, profile, role (`support` on −y, `cap` on +y, `side` otherwise) and tolerance. `validateFoldon` rejects missing, extra or misplaced sockets.
- Profiles: `empty`, `ground`, `deck`, `base`, `wall`, `eave`, `beam`, `open`. Allowed pairs: `empty–empty`, `deck–base`, `ground–base`, `wall–wall`, `eave–eave`, `beam–beam`, `beam–wall`; `open` matches anything. The table is symmetric.
- Two sockets are compatible when positions coincide within the larger tolerance, normals are opposed, and profiles are allowed.
- **The P0.3 change** (commit `45576a8`, one line in `socketsCompatible`): the tangent-equality test used to apply to every face and now applies **only to side faces** (normal Y component 0). `faceTangent` gives every ±y face the tangent +x, and a quarter-turn rotation about +Y rotates that tangent to ±z, so a rotated piece resting on an unrotated one would fail the tangent test although its top and bottom faces coincide exactly. The watchtower recipe is such a case: its `band-beam` (P06, rotation 1) sits on the P08 shaft (`packages/foldon/src/assemblies.ts`). The commit has no message body, so this motive is inferred from the diff and the recipes, not quoted from the author. Side faces keep the tangent check.

## Consequences

- `open` is a wildcard and weakens the check wherever it is used (P01, P02, P05, P07, P09 side faces). The overlay and tests show profile colours, but a wildcard face never produces an incompatible reason.
- **P06 (triangular prism) and P07 (pyramid) expose an `empty` top profile, so nothing but `empty` can sit on them.** That limits nesting and stacking, which the look-dev composition works around by placing ridges and beams off-grid.
- No test targets the tangent rule directly (a search of `packages/foldon/test` for "tangent" finds nothing). It is exercised only indirectly through assembly compilation. A regression test for "rotated piece on vertical contact is accepted" would be the first addition in Phase 1.
- Compatibility is symmetric; it does not say who supports whom. Support direction and load come with the Phase 4 support graph.
- The profile table is data in code, not a catalog input; adding a profile means editing the package.

## Evidence

- `packages/foldon/src/definition.ts` (`socketProfiles`, `allowedProfilePairs`, `socketsCompatible`), `validate.ts`.
- Tests: "two box shells stacked vertically have compatible touching sockets", "a box shell beside a roof's eave side is incompatible", "touching parts with incompatible sockets are rejected", "every rotation keeps placed sockets on external face centres of the placed footprint".
- Screenshot `docs/screenshots/p0.4-roof-house-sockets.png`; commit `45576a8`.
