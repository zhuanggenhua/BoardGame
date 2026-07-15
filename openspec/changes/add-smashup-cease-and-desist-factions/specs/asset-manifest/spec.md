## ADDED Requirements

### Requirement: Publish Cease and Desist Runtime Assets

The asset pipeline SHALL register every local runtime asset added for 宇宙武士、卑劣封臣、星际旅者 and 百变机兵. R2/CDN remote URL verification is explicitly scoped out for this change.

#### Scenario: Build and upload localized faction assets

- **WHEN** asset manifests are rebuilt for this change
- **THEN** the Smash Up game-level manifest and root i18n manifest SHALL contain the new card and base atlas paths
- **AND** local manifest validation SHALL pass for representative card, base, and reused titan assets
- **AND** R2/CDN remote URL verification SHALL remain excluded from the completion criteria for this change
- **AND** temporary crops, previews, and display-only source artifacts SHALL NOT enter the runtime manifest
