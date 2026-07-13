## ADDED Requirements

### Requirement: Publish Sheep And All-Stars Promo Runtime Assets

The asset pipeline SHALL register every local runtime asset added for 绵羊 and 全明星, while keeping temporary intake crops and display-only source artifacts out of the runtime manifest.

#### Scenario: Build and upload localized Promo faction assets

- **WHEN** asset manifests are rebuilt for this change
- **THEN** the Smash Up game-level manifest and root i18n manifest SHALL contain the new card atlas path and any newly required base atlas path
- **AND** local manifest validation SHALL pass for representative card and base assets
- **AND** R2/CDN remote URL verification SHALL return `200` for representative runtime URLs unless the user explicitly scopes remote verification out
- **AND** temporary crops, previews, and display-only source artifacts SHALL NOT enter the runtime manifest
