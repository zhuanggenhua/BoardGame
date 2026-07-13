## ADDED Requirements

### Requirement: Asset manifests SHALL include the Smash Up Marvel card atlas

The localized Smash Up asset manifest and the root localized asset manifest SHALL both include the optimized Marvel card atlas used by the four new factions.

#### Scenario: Rebuild manifests after adding the Marvel atlas

- **WHEN** the optimized Marvel atlas is generated
- **THEN** `public/assets/i18n/zh-CN/smashup/assets-manifest.json` SHALL contain its key
- **AND** `public/assets/i18n/assets-manifest.json` SHALL contain the same runtime asset key
- **AND** validation SHALL confirm the runtime URL resolves to the uploaded compressed asset
