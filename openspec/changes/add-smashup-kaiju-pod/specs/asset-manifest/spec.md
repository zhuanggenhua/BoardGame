## ADDED Requirements

### Requirement: Kaiju POD Runtime Atlas SHALL Be Publishable And Verifiable

The official asset pipeline SHALL record, validate, and publish the compressed Kaiju POD atlas through both the Smash Up locale manifest and the root i18n manifest.

#### Scenario: Rebuild manifests with the Kaiju POD key

- **WHEN** the official asset manifests are rebuilt after the atlas is added
- **THEN** the Smash Up manifest SHALL contain `cards/kaiju_pod` and `cards/compressed/kaiju_pod`
- **AND** the root i18n manifest SHALL contain `zh-CN/smashup/cards/kaiju_pod` and `zh-CN/smashup/cards/compressed/kaiju_pod`
- **AND** the compressed variant SHALL include its content hash

#### Scenario: Verify the published runtime asset

- **WHEN** the Kaiju POD runtime WebP is uploaded to the official asset host
- **THEN** `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/kaiju_pod.webp` SHALL return HTTP `200`
- **AND** the runtime SHALL request the same logical path recorded in the manifests
