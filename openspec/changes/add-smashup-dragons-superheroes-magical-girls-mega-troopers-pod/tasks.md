## 1. OpenSpec And Intake Contract

- [x] 1.1 Validate this change with strict OpenSpec validation
- [ ] 1.2 Create source, crop/index, visual contract, comparison, conflict, and implementation-handoff tables for all four POD factions
- [ ] 1.3 Lock all four `4 x 5` row-major mappings to each physical slot and unique runtime object
- [ ] 1.4 Record source paths, sizes, hashes, acquisition time, runtime destinations, compressed artifacts, and planned remote URLs in evidence

## 2. Runtime Assets

- [x] 2.1 Copy the four user-supplied atlases into faction-specific formal runtime paths without replacing existing shared atlases
- [x] 2.2 Generate compressed WebP assets and register four unique `4 x 5` card atlas IDs
- [ ] 2.3 Add the POD atlases to Smash Up critical/warm preload resolution and verify locale-aware asset paths
- [ ] 2.4 Rebuild the Smash Up and root i18n manifests, validate new keys, upload only the new runtime assets, and verify representative remote URLs with `HEAD 200`

## 3. POD Faction Registry And Data

- [x] 3.1 Add four POD faction IDs, display names, metadata, and locale visibility
- [x] 3.2 Add four explicit POD faction data files with complete fields, `_pod` IDs, counts, tags, entry metadata, and POD atlas indexes
- [x] 3.3 Register all POD card sets without mutating existing base-faction definitions or shared atlas contracts
- [x] 3.4 Register POD base IDs for all four factions; preserve base rules and reuse current base artwork because no POD base artwork was supplied
- [x] 3.5 Add explicit locale entries for all POD factions, cards, and bases while preserving base-faction locale entries

## 4. Shared Gameplay And Titan Binding

- [ ] 4.1 Prove card-by-card that Dragons, Superheroes, and Magical Girls POD rules match their locked base-faction contracts
- [x] 4.2 Add explicit shared variant profiles for those three POD families across ability, interaction, ongoing, modifier, base ability, and base pool surfaces
- [x] 4.3 Reuse The Everything Glove, Walking Castle, and Megabot through faction fallback without duplicate POD titan definitions
- [x] 4.4 Ensure POD base pools resolve only `_pod` base IDs and base factions continue to resolve only base IDs

## 5. Mega Troopers POD Gameplay

- [x] 5.1 Add the Mega Troopers POD variant profile with explicit shared, separate, baseOnly, and podOnly family relations
- [x] 5.2 Implement POD Form Megabot, It's Blitzin' Time, Lightning Crystal, Blitzing Sword Attack, and Lightning Rescue
- [x] 5.3 Implement POD Omega Protocol and the before/after scoring branches of Power Pose
- [x] 5.4 Implement POD Plan for More draw/extra-minion/top-bottom reorder flow including legal skip behavior
- [x] 5.5 Implement POD Beta 6, Blue Trooper, Green Trooper, and Red Trooper, including counters, hand response play, choice branches, titan limit, and Megabot movement
- [x] 5.6 Verify unchanged Black, Yellow, and Pink Trooper families use only the explicitly approved shared relationship
- [x] 5.7 Prove base Mega Troopers cards retain their original behavior and never receive POD-only effects

## 6. Tests, Audit, And E2E

- [ ] 6.1 Add atlas/index, registry, locale, faction-selection, preload, manifest, base-pool, titan-fallback, and POD consistency tests
- [x] 6.2 Extend Dragons, Superheroes, and Magical Girls suites so representative POD IDs prove shared behavior and cleanup
- [x] 6.3 Add object-level Mega Troopers POD L2 tests for every changed family, optional/skip branch, and final authoritative state
- [ ] 6.4 Create object-level rule-clause and complete-skill-flow matrices for every POD card, base, and reused titan
- [ ] 6.5 Add real-entry E2E for selecting each POD faction, initializing a match, rendering the correct POD atlas, and completing representative gameplay chains
- [ ] 6.6 Capture and inspect real-page screenshots, record absolute paths and `.atlas-shimmer` results, and distinguish task failures from historical baseline debt
- [ ] 6.7 Run focused Vitest, i18n, typecheck, asset validation, strict OpenSpec validation, and the new E2E cases; update task boxes only after evidence is complete
