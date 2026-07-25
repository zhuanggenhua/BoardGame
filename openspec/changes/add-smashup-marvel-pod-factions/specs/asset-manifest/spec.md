## ADDED Requirements
### Requirement: Marvel POD card art manifest entries
The asset manifest SHALL include PNG and runtime WebP variants for both Marvel POD card atlases.

#### Scenario: Manifest hashes match checked-in assets
- **WHEN** the Marvel POD resource contract test reads the root and Smash Up asset manifests
- **THEN** each Marvel POD manifest entry has a SHA-256 hash matching the corresponding checked-in PNG or WebP file.
