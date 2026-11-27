# Vehicle V3 — design brief (GEO-0, GEO-2, GEO-7), written before code

- Status: **exploratory reuse experiment, not approved.** Standard: [`docs/governance/geometry-quality-gates.md`](../../governance/geometry-quality-gates.md). Construction rules: [`construction-brief.md`](construction-brief.md). The bird is the hero object of this iteration. If the bird stays blocked, the vehicle implies no acceptance of anything.
- Date: 2026-11-27. V1 vehicle (`73b612b`) is the "before": a lattice-triangle body with flat faceted disc wheels.

## 1. Subject and why

The reference ([`assets/reference/visual-direction.png`](../../../assets/reference/visual-direction.png)) shows abandoned 1930s–40s sedans, a bus and a truck. They have long bonnets, upright cabins, **separate fenders over exposed wheels** and running boards. A separate-fender sedan suits a module kit for three reasons:

- The wheels sit outside a narrow body tub, so no wheel arches have to be cut into body panels (no non-convex panels).
- Fenders are paper **arches**: strips bent around an axis.
- The parts are separable, which is the point of GEO-7 (wheels, fenders and boards detach as units).

## 2. References

No vehicle mesh, image or blueprint is imported or traced.

| # | Reference | Used for |
|---|---|---|
| V-R1 | 1940 Chevrolet Special/Master De Luxe: factory brochure specifications page (scan at lov2xlr8.no/brochures/chevy/40chev/40chev.html, image 15). 1939 brochure confirms "safety-tread running boards" | wheelbase, length, tyre |
| V-R2 | Mercedes-Benz 170 V saloon (W136): de.wikipedia.org/wiki/Mercedes-Benz_W_136 technical table (uncited table; infobox cites Oswald, *Deutsche Autos*); ADAC Autokatalog entry for the 1947–50 car | full set of dimensions, cross-check |
| V-R3 | 1940 Ford De Luxe: Ford Motor Co. of Australia 1940 brochure spec page (oldcarbrochures.org); en.wikipedia.org/wiki/1940_Ford | wheelbase and tyre cross-check |
| V-R4 | Tachi 2009 (rigid panels and hinges) and the construction brief's module families | how the parts are made and why every module is a tree |

### 2.1 Reference data (verified 2026-11-27; anything else was not verifiable and is not used)

| Car | Length | Wheelbase | Tyre → outer diameter | Width, height, track |
|---|---|---|---|---|
| 1940 Chevrolet (V-R1) | 192¼ in = 4.883 m (with bumpers) | 113 in = 2.870 m | 6.00-16 → 16 + 2 × 6 = 28 in ≈ 0.71 m | not verified |
| Mercedes 170 V (V-R2) | 4.285 m (ADAC) / 4.270 m | 2.845 m | 5.50-16 → ≈ 0.69 m | 1.58 / 1.61 m; track 1.32 / 1.31 m |
| 1940 Ford (V-R3) | not verified | 112 in = 2.845 m | 6.00-16 → ≈ 0.71 m | not verified |

Derived ratios:

| Ratio | References | Target |
|---|---|---|
| length / tyre diameter | 6.9 (Chevrolet), 6.2 (170 V) | 6.67 |
| wheelbase / tyre diameter | 4.0, 4.1 | 3.94 |
| wheelbase / length | 0.59, 0.66 | 0.59 |
| height / length (170 V) | 0.38 | 0.34 |
| track / length (170 V) | 0.31 | 0.32 |

The tyre arithmetic assumes the section height equals its width (roughly true for bias-ply tyres of the period), so real diameters are a little smaller.

## 3. Shape language

- **Primary forms:**
  - a long low tub;
  - an upright cabin set back over the rear axle region;
  - four exposed wheels under arched fenders.
- **Secondary forms:**
  - a prow nose with a recessed grille;
  - a split V windshield;
  - running boards joining front and rear fenders;
  - open side windows between pillars.
- **Tertiary forms:**
  - the hood's crown creases (three facets per side);
  - the grille slats (folded vanes);
  - the octagonal tyre tread with real width;
  - dished hub sidewalls.
- Every detail is a panel, a crease or an opening. There are no decals and no flat discs.
- What is kept from the reference: heavy angular silhouettes and dark window openings. Weathering and wreck damage are left for Collapse, not this iteration.

## 4. Target proportions (cells; L_v = 4.4, x from the nose)

| Landmark | Target | Ratio | Window or ladder (variants) |
|---|---|---|---|
| Overall length | 4.40 | 1 | fixed |
| Wheelbase | 2.60 | 0.59 L | ladder 2.40, 2.60, 2.80; ratio window [0.54, 0.65] |
| Front axle from nose | 0.78 | 0.18 L | follows from the hood ladder |
| Wheel (tyre) diameter | 0.66 | 0.15 L | ladder 0.60, 0.66, 0.72 |
| Tyre width | 0.20 | | fixed |
| Track (wheel centres) | 1.42 | 0.32 L | 2 × (tub half-width + gap + half tyre) |
| Tub half-width | 0.56 | | fixed |
| Wheel inner face to tub side | ≥ 0.03 | | constraint |
| Axle centre height | wheel radius | | follows |
| Tub floor | 0.42 (above the axle line; the axle tube passes under it) | | constraint: floor − axle top ≥ 0.02 |
| Ground clearance (lowest non-tyre point) | 0.26 | 0.06 L | ≥ 0.20 |
| Deck / belt line | 0.80 | | fixed |
| Roof | 1.48 | height 0.34 L | ladder 1.40, 1.48, 1.56; height/L window [0.30, 0.38] |
| Hood (nose → windshield base) | 1.55 | 0.35 L | ladder 1.35, 1.55, 1.75; hood/L ≥ 0.28 |
| Cabin | windshield base 1.55, roof 1.85–3.05, rear window base 3.45 | | sedan: 3 window bays; coupe: 2 |
| Cabin centre between the axles | | | within ±0.30 of the wheelbase midpoint |
| Fenders | inner radius = tyre radius + 0.06, width 0.30, 5 segments over 180° (4 for variants) | | radial clearance to the tyre ≥ 0.04 |
| Running boards | top at 0.40, from the front fender's rear end to the rear fender's front end | | fixed |

The multi-view target is [`vehicle-target-views.svg`](vehicle-target-views.svg), plotted by [`plot_targets.py`](plot_targets.py). It is a proportion guide; the grille, hood creases and windshield are drawn schematically.

## 5. Modules (reuse levels marked)

| Slot | Module (family) | Sheets | Reuse |
|---|---|---|---|
| Tub segments (nose, hood, cowl, cabin floor, rear deck) | `band`, "tub" half-section with seven vertices: hood crown D–G1–G2–M (three 0.14-cell top facets, the outer one the cabin's footing), shoulder U, side B, floor K | ≈ 10 | family (b) with the bird body |
| Nose (recessed grille face) and tail | `cap`; the nose apex sits **behind** the front section, giving a concave grille recess | 4 | family (b) with the bird beak and rump |
| Grille slats | `vane` 0.48 × 0.14 hanging from the three 0.14-cell hood-front edges per side, in front of the recess | 6 | **concrete (c): the same definition id as the bird's alula** |
| Cabin (pillars, window bays, roof) | `band`, "cabin" half-section D (roof centre), U (roof edge), M (belt, on the tub's G2–M line); window bays omit the side facet (open) | ≈ 8 | family (b) |
| Windshield and rear window | `cap` (V split windshield) | 4 | family (b) |
| Fenders | `arch` (chain of quads around the axle) | 4 | — |
| Running boards | `plate` | 2 | family (b) with the bird's tail and wing plates |
| Wheels | 2 `band` "tyre" half-octagons (tread, real width) plus 2 + 2 `cap` sidewall halves dished toward the hub | 24 | family (b) |
| Axle tubes | `band` "axle" halves joining the inner hubs of an axle pair (one axle line) | 4 | family (b) |

The count is about 66 sheets: about 24 for the wheels, 14 for the body and 8 for the cabin. That is an output, not a target. A wheel is six sheets because no sheet may close on itself (construction brief, design rule 1).

## 6. Constraints the solver enforces (object-owned, function)

1. **Local:** port contracts (kernel).
2. **Wheel inside its fender:** radial clearance ≥ 0.04 at rest. No contact between tyre and fender, tub or running board.
3. **Ground clearance** ≥ 0.20 for every non-tyre module. Tyres touch the ground plane y = 0 within 1e-6.
4. **Proportions:** wheelbase ratio, height ratio and hood ratio inside their windows.
5. **Cabin over the wheelbase:** the cabin centre lies within ±0.30 of the wheelbase midpoint.
6. **No contact** between any two modules except on declared ports.
7. **Seed** → bounded targets (wheelbase, wheel, roof, hood, cabin type, fender segments, grille slats 2 or 3 per side), then the solver picks ladder values and records eliminations. Example: a 0.72 wheel with a 4-segment fender of radius 0.39 fails clearance and is eliminated.

## 7. Not claimed

- Real vehicle scale relative to the bird (the lab shows both at about 4 cells).
- Doors, interior, glass or lights as separate parts.
- Steering or suspension motion.
- Rolling wheels (no articulation in this iteration).
- Mechanical plausibility of the axle beyond a common axis.

## 8. Rejected alternatives

1. **Imported or hand-modelled car mesh.** Forbidden (GEO-7.9).
2. **One lofted body with wheel arches cut into it.** Non-convex panels and a target-mesh source.
3. **Flat faceted disc wheels (V1).** They have no thickness and read as decals from the side.
4. **Fully enclosed 1950s pontoon body.** It needs wheel-arch cut-outs and hides the parts that make the kit modular.

## 9. Iteration log (changes made during implementation, after the brief commit `0c9db3d`)

Logged per GEO §1.8. Each change was forced by a check or by the implementer's look at the clay images.

| # | Change | Why |
|---|---|---|
| 1 | Constant floor height 0.42; the deck follows each station's scale; the floor is flat (B and K both at −0.38). Narrowing at the axle stations removed | A sloped floor tilted the hanger, so the tyres missed the ground by 6.4e-4. Now hangers hang exactly vertical (90°) and axles sit at exactly 112.5°, the tyre octagon's 22.5° facet. Tyres touch the ground to 2.5e-11 |
| 2 | Fenders 0.30 wide on chamfered running-board ends, 0.06 outboard of the body side | Flush fenders lay along the body side (edge contact, exact test) whenever a full-width station fell inside a wheel well |
| 3 | Cabin centre window changed from ±0.30 to between 0.50 behind and 0.30 ahead of the wheelbase midpoint | The reference cars (1940 Chevrolet) sit the cabin about 0.1 L behind; the original ±0.30 rejected the brief's own hero targets |
| 4 | Grille: two slats per side on the outer crown rims; slats are the shared 0.36 × 0.14 blunt vane | The innermost pair crossed at the midline (mirror images). Pointed 0.48 slats hung below the floor as fangs |
| 5 | A running-board end within 0.06 of another station snaps onto it, and that fender's radius follows. A rear axle under the rear window becomes the rear-window base. The windshield and rear window use an explicit rising triangulation | Derived stations colliding with cabin stations made most targets infeasible. The greedy stitch produced a glass triangle lying in a tub crown facet (coplanar overlap) |
| 6 | The cabin is segmented at every tub station between roof front and rear; pillars and window bays are inherited per segment | A pillar spanning two tub edges is a T-junction (open seam) |
| 7 | Sheet count about 80–92 (output) | Wheels (6 sheets each plus axle and hanger) and per-station body bands dominate. No sheet closes on itself |
| 8 | After independent review round 1 (`b1b4a41`; NO-GO: fangs, no bonnet, plank body, invisible fenders, framing): nose station narrowed and lowered (scale 0.85, deck 0.743) so the bonnet tapers between the fenders and the front fenders show above it; grille slats are the shared short vane 0.26 × 0.119 (0.119 = the crown rim at the nose scale) hanging inside the nose recess, no longer below the floor; study side view and before/after framing widened (V1 is about twice the size of V3 at one world scale) | Reviewer blockers 7–9. The plank body and boxy cabin remain: a stepped cowl and a shaped cabin need the cabin to sit on a narrower body section than the hood allows today, which is recorded as open |
