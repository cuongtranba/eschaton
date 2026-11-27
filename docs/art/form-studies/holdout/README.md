# Holdout transfer check: one previously unused object category (design level)

- Status: **DESIGN-LEVEL TRANSFER CHECK. Concept only.** It is not an ART-1 concept, not approved, and not implemented geometry. No production model is built, and nothing in it is runnable.
- Authority: the owner's third ART-D3b ruling ([packet](../../../review/art-1-raven-decision-packet.md) §0.2), item 5.
- What it can show: whether the **frozen** method M3 and the operators O1–O3 can be applied, as written, to one category that played no part in deriving them.
- What it cannot show: that the method generalizes. One category is not enough evidence for that.

## 1. Frozen inputs

The commit that adds this file freezes these three files. That commit is recorded in §2 when the selection is logged:
- [`docs/art/form-construction-method.md`](../../form-construction-method.md) (M3), with [`form-method-check.md`](../../form-method-check.md);
- [`docs/research/geometry-operators.md`](../../../research/geometry-operators.md);
- [`docs/research/geometry-operator-lab.md`](../../../research/geometry-operator-lab.md).

**No change to the frozen files until the holdout result is recorded.** If the holdout shows that the method or an operator must change, the rules are:
- the frozen version and its result stay as recorded;
- the change is a new variant (M3.1 or later);
- the new variant is **exploratory**, and this category is no longer held out for it.

## 2. Selection protocol

1. **Freeze first.** The frozen files are committed before any category is named, and this file is committed in the same commit.
2. **Independent selector.**
   - The selector is a separate agent that wrote none of the method, operators, studies or B-2 artwork.
   - It receives the frozen file paths and the repository, and nothing else from the author.
   - It searches the frozen files and the history of PR #14 and PR #11 for every object category named there.
   - It then proposes a category that meets three conditions:
     1. no example, derivation, study or failure in those files uses it;
     2. its form logic differs materially from a creature, a vehicle, a building and a branching plant;
     3. real references for it can be cited with verified sources.
3. **What is logged:** every candidate considered, each rejected candidate with its reason, the final choice, the search terms used to check for leakage, and at least two verified real-subject references (title, author or owner, URL, licence or use statement). References are **cited, never imported or traced** (ART §2.6).
4. **Author steps after selection,** in separate commits, in this order:
   1. a holdout brief that applies method §5 steps 1–6, committed before any drawing;
   2. original design drawings, clearly labelled as original, made from the brief's numbers;
   3. a small manually worked O1/O2/O3 composition.
5. **Independent reviewer.** A second separate agent inspects the drawings (pixels) and the reasoning, not the text alone, and records a verdict.

## 3. Selection log

*Pending: filled in by the commit after the freeze.*
