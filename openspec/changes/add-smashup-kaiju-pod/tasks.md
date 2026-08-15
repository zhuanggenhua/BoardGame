## 1. OpenSpec And Intake Contract

- [x] 1.1 Validate `add-smashup-kaiju-pod` with strict OpenSpec validation
- [x] 1.2 Lock the source, full-grid scan, unique-object, visual, comparison, conflict, and implementation-handoff contracts
- [x] 1.3 Record source metadata, formal asset paths, manifest keys, and planned remote URL

## 2. Runtime Assets

- [x] 2.1 Copy only the supplied Kaiju POD atlas into the formal source path
- [x] 2.2 Generate a same-resolution WebP and register a unique `4 x 5` atlas
- [x] 2.3 Rebuild both manifests and prove the new logical key exists in each
- [ ] 2.4 Upload only the Kaiju POD runtime WebP and verify the public URL with `HEAD 200` — blocked: dry-run selected the correct single object, real upload retry produced no success output, and public `HEAD` remains `404 Not Found`

## 3. POD Faction Registry And Shared Gameplay

- [x] 3.1 Add `KAIJU_POD`, its display name, metadata, locale visibility, and card registration
- [x] 3.2 Add 14 explicit `_pod` card definitions whose physical counts total 20 and whose atlas indexes match the source
- [x] 3.3 Bind Kaiju POD to ordinary Kaiju through the explicit shared variant profile without changing ordinary Kaiju logic
- [x] 3.4 Prove the POD base pool contains only `base_tokyo_pod` and `base_kaiju_island_pod`, while reusing current artwork and behavior
- [x] 3.5 Reuse `kaiju_gorgodzolla` without creating a duplicate POD titan

## 4. Tests, Audit, And Delivery

- [x] 4.1 Add focused static, atlas, registry, variant, base-pool, titan, locale, preload, and manifest tests
- [x] 4.2 Add a real faction-picker and match-start E2E that renders the Kaiju POD atlas without shimmer
- [x] 4.3 Record object-level L0-L4 conclusions and shared-chain equivalence in evidence
- [x] 4.4 Run focused Vitest, i18n, typecheck, asset validation, strict OpenSpec validation, and E2E
- [ ] 4.5 Review the frozen task diff, commit with a Chinese multi-line message, push the branch, and open a draft PR to `zhuanggenhua/BoardGame:main`
