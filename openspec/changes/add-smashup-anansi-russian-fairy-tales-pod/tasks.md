## 1. OpenSpec And Intake Contract

- [x] 1.1 Strictly validate this OpenSpec change
- [x] 1.2 Record source hashes, dimensions, crop grid, 40 physical slots, 29 runtime objects, comparison and conflict tables
- [x] 1.3 Record explicit shared-variant and shared-base-pool decisions before implementation

## 2. Faction Data And Registry

- [x] 2.1 Add both POD faction IDs and display names
- [x] 2.2 Add complete Anansi Tales POD and Russian Fairy Tales POD card definitions with exact counts and atlas slots
- [x] 2.3 Register both card sets without mutating classic definitions
- [x] 2.4 Add selectable faction metadata and complete en/zh-CN faction/card locale entries

## 3. Shared Gameplay Binding

- [x] 3.1 Add explicit variant profiles sharing ability, interaction, ongoing, baseAbility and powerModifier surfaces
- [x] 3.2 Set both POD base pools to shared and prove classic base IDs are returned
- [x] 3.3 Prove representative POD cards execute the matching classic handlers and cleanup semantics

## 4. Runtime Assets

- [x] 4.1 Copy both supplied PNG atlases into en and zh-CN formal runtime paths
- [x] 4.2 Generate compressed WebP assets and update incremental manifests
- [x] 4.3 Verify atlas catalog and critical-image resolution for both selected POD factions
- [ ] 4.4 Upload only the new runtime objects and verify representative public URLs with HEAD 200/hash evidence (blocked: no upload URL/token or usable SSH key)

## 5. Tests And Evidence

- [x] 5.1 Add integration coverage for counts, field parity, slots, registry, locale, metadata, aliases, execution, preload and base pools
- [ ] 5.2 Run focused Vitest, POD audit, i18n, assets and strict OpenSpec validation (all passed except full `i18n:check`, which stalled without output)
- [x] 5.3 Complete the evidence matrix with L0-L4 results and residual risks

## 6. Delivery

- [ ] 6.1 Freeze the reviewed task scope and create a Chinese multi-line commit
- [ ] 6.2 Push `codex/smashup-anansi-fairy-tales-pod` to `deathcats4/BoardGame`
- [ ] 6.3 Create a PR to `zhuanggenhua/BoardGame:main` including code, source atlases and compressed resources
