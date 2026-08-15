## ADDED Requirements

### Requirement: Publish The Action Heroes POD Card Atlas

The official asset manifest SHALL register the source PNG and compressed WebP variants for Action Heroes POD under the English Smash Up card asset namespace.

#### Scenario: Resolve the Action Heroes POD atlas

- **WHEN** the client requests `smashup/cards/action_heroes_pod`
- **THEN** the manifest SHALL resolve the English compressed WebP runtime object
- **AND** the source PNG SHALL remain traceable in the local formal asset tree and evidence record
