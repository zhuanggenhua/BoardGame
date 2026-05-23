## ADDED Requirements

### Requirement: Emote Asset Routing
The system SHALL route emote images through the existing optimized asset pipeline, with separate locations for game-specific and common emotes.

#### Scenario: Game-specific emote asset
- **WHEN** a DiceThrone emote is referenced by catalog
- **THEN** its `assetPath` omits `compressed/`
- **AND** the corresponding WebP exists under `public/assets/i18n/zh-CN/dicethrone/emotes/<character>/compressed/`

#### Scenario: Common emote asset
- **WHEN** a common emote is referenced by catalog
- **THEN** its `assetPath` omits `compressed/`
- **AND** the corresponding WebP exists under `public/assets/common/images/emotes/<packId>/compressed/`

