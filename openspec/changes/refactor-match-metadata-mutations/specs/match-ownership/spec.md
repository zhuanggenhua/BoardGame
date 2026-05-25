## ADDED Requirements
### Requirement: Match metadata seat mutations are concurrency-safe
The system SHALL update seat ownership metadata through an atomic or per-match serialized mutation seam instead of requiring callers to fetch and replace the whole match metadata object.

#### Scenario: Concurrent AI seat claims preserve all credentials
- **GIVEN** a match has three unclaimed local AI seats
- **WHEN** the owner concurrently claims seats `1`, `2`, and `3`
- **THEN** each claimed seat retains its own credentials in match metadata
- **AND** no later claim overwrites credentials written by an earlier claim

#### Scenario: Existing seat credentials are idempotent
- **GIVEN** a seat already has credentials in match metadata
- **WHEN** the owner repeats `POST /games/:name/:matchID/claim-seat` for that seat
- **THEN** the system returns the existing credentials
- **AND** it does not overwrite unrelated player metadata

#### Scenario: Full metadata replacement is not used for high-risk seat fields
- **WHEN** server code updates `metadata.players.<playerID>.credentials`, `name`, or `isConnected`
- **THEN** it MUST use the metadata mutation seam or an equivalent targeted atomic update
- **AND** it MUST NOT rely on `fetch(metadata) -> setMetadata(full metadata)` for those fields
