## 1. Model
- [x] 1.1 Add centralized Smash Up `ResourceRef` / `ResourceFootprint` types and stable comparison helpers.
- [x] 1.2 Add event-to-resource footprint inference for all Smash Up events used by reaction/base/titan triggers.
- [x] 1.3 Add interaction option / continuation-context footprint inference helpers.
- [x] 1.4 Add fallback footprint type with mandatory reason field and audit reporting.

## 2. Ordering Runtime
- [x] 2.1 Add trigger/base ability probing path that derives footprints from actual produced events/interactions without mutating authoritative state.
- [x] 2.2 Replace `ReactionOrderingAtom` conflict comparison as the primary path with derived `ResourceFootprint` comparison.
- [x] 2.3 Keep legacy `effectContract` only as temporary fallback/assertion and report every fallback use in tests.
- [x] 2.4 Ensure singleton mandatory effects with no real conflict auto-resolve without prompt.
- [x] 2.5 Ensure true conflicting mandatory effects still open ordering selection and shrink options after each resolution.

## 3. Mandatory / Optional Semantics
- [x] 3.1 Audit all `onTurnStart` / `onTurnEnd` triggers for `may/你可以` and mixed forced+optional semantics.
- [x] 3.2 Split Sprout-like mixed triggers into forced effect plus optional continuation.
- [x] 3.3 Split Invisible Ninja-like bookkeeping plus optional effect triggers.
- [x] 3.4 Mark or migrate The Bride, Sphinx, Emperor Penguin, Mergacon, Time Box, Great Wolf Spirit and similar titan specials into optional timing windows.

## 4. Optional Titan UX
- [x] 4.1 Add reaction-session state needed to expose legal optional titan activations to board/titan UI.
- [x] 4.2 Highlight eligible titan cards during their legal timing window.
- [x] 4.3 Make clicking titan execute the normal special activation path and target selection.
- [x] 4.4 Add explicit pass/skip control for the timing window.
- [x] 4.5 Stop using generic `smashup_reaction_choose` as the main “是否打出泰坦” prompt.

## 5. Cleanup
- [x] 5.1 Remove stale per-card `effectContract` declarations that are fully covered by derivation.
- [x] 5.2 Keep only documented fallback declarations for non-derivable effects.
- [x] 5.3 Update Smash Up developer docs/audit notes so new cards use event/interaction structures instead of hand-written ordering contracts.

## 6. Verification
- [x] 6.1 Unit tests: event footprint inference per event family.
- [x] 6.2 Unit tests: interaction footprint inference for Mushroom Kingdom, Sprout, The Bride, Sphinx, Emperor Penguin, Mergacon.
- [x] 6.3 Unit tests: ordering conflict/no-conflict behavior with shrinking mandatory queue.
- [x] 6.4 Unit tests: optional/mixed trigger semantics for Sprout, Invisible Ninja, The Bride.
- [x] 6.5 E2E: Mushroom Kingdom + opponent Sprout does not show ordering and uses field selection.
- [x] 6.6 E2E: Mushroom Kingdom + own The Bride resolves forced base choice first, then titan is clickable/highlighted with skip, not generic prompt.
- [x] 6.7 E2E: old factions with OR/optional trigger paths still work end-to-end.
- [x] 6.8 ESLint/typecheck for modified files.
- [x] 6.9 Evidence document with screenshots and observed conclusions.
