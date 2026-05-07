## 1. Analysis
- [x] 1.1 Inventory every Smash Up gameplay read of `abilityTags.special`
- [x] 1.2 Classify all affected cards into manual activation, response-window play, trigger-driven special text, and true talent
- [x] 1.3 Freeze migration rules for ambiguous cards and record rationale

## 2. Model
- [x] 2.1 Add explicit non-titan activation metadata types
- [x] 2.2 Add shared helpers for manual special validation and response-window playability
- [x] 2.3 Mark `abilityTags.special` as deprecated for gameplay behavior

## 3. Runtime Migration
- [x] 3.1 Migrate `ACTIVATE_SPECIAL` validation to explicit manual activation metadata
- [x] 3.2 Migrate board highlight logic to the new validation model
- [x] 3.3 Migrate response-window availability checks to explicit response metadata
- [x] 3.4 Migrate AI reactive classification off ambiguous `special` tags

## 4. Data Migration
- [x] 4.1 Reclassify Smash Up minions/actions/ongoings that currently misuse `special`
- [x] 4.2 Preserve legitimate response-window and discard special behavior under the new model
- [x] 4.3 Remove false-positive board activations for trigger-driven cards

## 5. Verification
- [x] 5.1 Update targeted Smash Up validation/unit tests
- [x] 5.2 Add migration regression coverage for each semantic bucket
- [x] 5.3 Run focused Smash Up regression suites and document residual risks
- [x] 5.4 Update Smash Up intake/audit workflow docs to match the new model
