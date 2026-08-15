## ADDED Requirements

### Requirement: Preload Selected Anansi And Russian Fairy Tales POD Atlases

The Smash Up critical image resolver SHALL preload the Anansi Tales POD and Russian Fairy Tales POD card atlases when the corresponding faction is selected.

#### Scenario: Resolve selected POD atlas as critical

- **WHEN** a match selects `anansi_tales_pod` or `russian_fairy_tales_pod`
- **THEN** the matching locale-aware POD card atlas path SHALL appear in the critical image set
- **AND** the unselected POD atlas SHALL NOT be added solely because its classic faction exists
