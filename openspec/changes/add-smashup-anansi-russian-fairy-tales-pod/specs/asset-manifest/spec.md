## ADDED Requirements

### Requirement: Publish Anansi And Russian Fairy Tales POD Runtime Atlases

The asset pipeline SHALL index and publish the compressed Anansi Tales POD and Russian Fairy Tales POD atlases for both `en` and `zh-CN` locale paths.

#### Scenario: Close local and remote asset contracts

- **WHEN** the POD runtime resources are prepared for delivery
- **THEN** each locale SHALL contain the source PNG and compressed WebP at the expected Smash Up card paths
- **AND** incremental manifests SHALL contain the correct size and hash metadata
- **AND** the public runtime URLs SHALL be verified independently from local manifest success
