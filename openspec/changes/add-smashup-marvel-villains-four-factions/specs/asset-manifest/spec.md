## ADDED Requirements

### Requirement: Marvel Villain Runtime Asset Manifest
The Marvel villain atlas SHALL be present as a formal local runtime asset and SHALL be represented in both the zh-CN Smash Up asset manifest and the root i18n asset manifest after compression.

#### Scenario: Local manifest includes original and compressed villain atlas
- **WHEN** the asset manifest is regenerated for the Marvel villain atlas
- **THEN** `zh-CN/smashup/cards/marvel_villains` appears in the root i18n manifest
- **AND** `cards/marvel_villains` appears in the zh-CN Smash Up manifest
- **AND** the compressed WebP variant appears beside the PNG variant.

#### Scenario: Remote verification is deferred to release handoff if upload is not performed
- **WHEN** R2/CDN upload is not available in the current implementation pass
- **THEN** evidence records the local asset, compressed output, manifest state, and PR handoff requirement
- **AND** the remote `HEAD 200` check remains an explicit post-release task rather than being marked passed.
