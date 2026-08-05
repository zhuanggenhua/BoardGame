## ADDED Requirements

### Requirement: Penguins runtime assets must be represented in manifests

Official asset manifests SHALL represent Penguins runtime card and base atlas assets with stable hashes and the correct i18n base prefix.

#### Scenario: Penguins assets appear in game-level manifest
- **WHEN** the official asset manifest is regenerated after Penguins resources are added
- **THEN** `public/assets/i18n/zh-CN/smashup/assets-manifest.json` MUST contain entries for the Penguins card and base runtime WebP assets
- **AND** those entries MUST use `official/i18n/zh-CN/smashup/` as their base prefix

#### Scenario: Penguins assets appear in root i18n manifest
- **WHEN** the root i18n manifest is regenerated after Penguins resources are added
- **THEN** `public/assets/i18n/assets-manifest.json` MUST contain the Penguins runtime asset keys
- **AND** each Penguins runtime asset variant MUST include a content hash

#### Scenario: Remote asset publishing is scoped separately
- **WHEN** Penguins runtime WebP assets are not uploaded to the server asset origin in the gameplay PR
- **THEN** the evidence MUST explicitly mark remote publishing as out of scope for the gameplay PR
- **AND** the gameplay PR MUST NOT claim that representative public official asset URLs were remotely verified
