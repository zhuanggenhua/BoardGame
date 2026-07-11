## 1. Source And Specification

- [x] 1.1 Record the five supplied source images, hashes, dimensions, and row-major slot maps
- [x] 1.2 Coordinate Dragons POD with its existing active change instead of creating a duplicate specification
- [x] 1.3 Validate this change with strict OpenSpec validation

## 2. Runtime Data

- [x] 2.1 Add complete Sharks, Skeletons, Mythic Greeks, and Shapeshifters POD card definitions
- [x] 2.2 Register four POD faction IDs, atlas IDs, card sets, and faction metadata
- [x] 2.3 Bind the four POD families to shared gameplay surfaces and separate base pools
- [x] 2.4 Register independent POD base IDs while reusing the current base artwork and abilities
- [x] 2.5 Preserve and integrate the existing Dragons POD implementation

## 3. Assets And Locale

- [x] 3.1 Copy the four new source atlases into the formal English runtime path
- [x] 3.2 Generate compressed WebP variants for all five user-supplied atlases
- [x] 3.3 Add Chinese and English faction locale entries and locale visibility rules
- [x] 3.4 Rebuild the root asset manifest with the new source and compressed files
- [ ] 3.5 Run asset validation, upload new assets, and verify remote availability

## 4. Verification

- [x] 4.1 Add focused registry, count, slot, base-pool, variant, atlas, preload, locale, and titan tests
- [x] 4.2 Run the focused Vitest suite
- [x] 4.3 Run i18n and TypeScript validation
- [ ] 4.4 Complete a real-entry E2E selection/render check and record screenshot evidence
