## 1. Source And Specification

- [x] 1.1 Record the supplied source image hash, dimensions, grid, and row-major slot map
- [x] 1.2 Validate this change with strict OpenSpec validation

## 2. Runtime Data

- [x] 2.1 Add complete Action Heroes POD card definitions with independent `_pod` IDs
- [x] 2.2 Register the POD faction ID, atlas ID, card set, faction metadata, and variant profile
- [x] 2.3 Confirm independent POD base identities and shared gameplay aliases

## 3. Assets And Locale

- [x] 3.1 Copy the supplied atlas into the formal English runtime path
- [x] 3.2 Generate a compressed WebP without resizing and update the incremental asset manifest
- [x] 3.3 Add Chinese and English faction locale entries
- [ ] 3.4 Upload the runtime WebP and verify the public object

  Blocked: the upload environment has no usable credential, SSH fallback is denied, and the public object still returns 404. The PR includes both atlas files and the manifest.

## 4. Verification And Delivery

- [x] 4.1 Add focused count, slot, registry, base-pool, variant, atlas, preload, locale, and ability-alias tests
- [ ] 4.2 Run focused Vitest, POD audit, i18n, typecheck, and asset validation

  Focused Vitest (116 tests), i18n, typecheck, strict OpenSpec, diff check, and the Action Heroes manifest contract pass. Full asset validation remains blocked by unrelated pre-existing atlas-config drift recorded in the intake evidence.

- [x] 4.3 Complete a real selection/card-preview render check or record any environment blocker
- [ ] 4.4 Review, commit, push, and open the upstream pull request
