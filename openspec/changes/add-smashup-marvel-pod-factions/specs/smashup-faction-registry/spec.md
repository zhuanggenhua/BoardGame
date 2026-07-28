## ADDED Requirements
### Requirement: Marvel POD faction registry entries
The Smash Up faction registry SHALL include eight Marvel POD faction ids and metadata entries for global selection, while classic Marvel entries remain zh-CN-only.

#### Scenario: POD variants are selectable outside zh-CN
- **WHEN** faction metadata is loaded for any locale
- **THEN** Marvel POD faction entries have no locale restriction and their classic counterparts keep the zh-CN locale restriction.
