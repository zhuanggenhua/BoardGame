## ADDED Requirements

### Requirement: Publish Five POD Card Atlases

The official asset manifest SHALL register source PNG and compressed WebP variants for Sharks, Skeletons, Mythic Greeks, Shapeshifters, and Dragons POD under the English Smash Up card asset namespace.

#### Scenario: Resolve a POD atlas asset

- **WHEN** the client requests a logical POD card atlas path
- **THEN** the manifest SHALL resolve a compressed WebP variant
- **AND** the source PNG SHALL remain traceable in the official asset manifest
