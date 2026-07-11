## ADDED Requirements

### Requirement: Smash Up Itty Critters And Time Travelers POD Assets SHALL Be Publishable And Verifiable

The official asset pipeline SHALL record, validate, and publish the compressed Itty Critters POD and Time Travelers POD runtime atlases through both the Smash Up locale manifest and the root i18n manifest.

#### Scenario: Rebuild manifests with both POD atlas keys

- **WHEN** the official asset manifests are rebuilt after the two POD atlases are added
- **THEN** the Smash Up locale manifest and root i18n manifest SHALL both contain stable logical keys for both atlases
- **AND** each compressed variant SHALL include its content hash

#### Scenario: Verify published POD atlases

- **WHEN** the two POD atlases are uploaded to the official asset host
- **THEN** representative runtime URLs for both atlases SHALL return HTTP `200`
- **AND** the runtime SHALL request the same logical paths recorded in the manifests
