## ADDED Requirements
### Requirement: The Gang 数据录入合同
The Gang SHALL maintain auditable source and intake contracts before external rules or images are promoted into runtime behavior.

#### Scenario: Source truth recorded
- **WHEN** The Gang uses PDF, DOM, Images, or existing implementation data as input
- **THEN** the project MUST record the source path, source type, acquisition/discovery time, coverage scope, and current confidence state
- **AND** data without readable or attributable source MUST remain `candidate` or `blocked`

#### Scenario: Image promoted to runtime
- **WHEN** an external image is promoted into `public/assets/i18n/zh-CN/the-gang/**`
- **THEN** the intake contract MUST identify the source image, runtime object, compressed output, manifest key, and validation evidence
- **AND** unclassified hash-named images MUST NOT be referenced by runtime code

#### Scenario: Rule object asset matrix gates completion
- **WHEN** The Gang reports base-game completion
- **THEN** the project MUST have a rule-object-to-asset matrix for base-game required objects including playing card faces, card back, four rounds of chips, alarm/failure markers, gold/success markers, table/card slots, and player aid or help cards
- **AND** each required object MUST have a locked runtime asset, an explicit missing/blocker state, or an explicit approved programmatic replacement
- **AND** `blocked` or `base-runtime-candidate` source images MUST NOT be treated as completed runtime resources
- **AND** HTML/CSS-drawn stand-ins, text-only cards, programmatic shapes, mock images, or expansion-only assets MUST NOT be used to satisfy required base-game material closure unless the matrix records explicit approval for that programmatic replacement
- **AND** when a required base-game material is missing, the project MUST update proposal/tasks/spec and the asset matrix before any E2E result can be reported as completion evidence

#### Scenario: Layout truth source gates UI completion
- **WHEN** The Gang uses DOM, HTML, TTS Workshop JSON, XmlUI, object `Transform`, screenshots, or PureRef boards as layout inputs
- **THEN** the project MUST record which sources are empty, which sources are non-empty, and which source is authoritative for the current UI layout
- **AND** a single empty DOM file MUST NOT exclude other non-empty layout truth sources such as TTS Workshop JSON
- **AND** if TTS Workshop JSON contains table objects, slots, tokens, chips, references, or model transforms, the project MUST extract a layout contract before reporting the main Board UI as complete
- **AND** real-page E2E evidence MUST be reported only as runtime-flow validation when the Board has not been checked against the layout contract

### Requirement: The Gang runtime entry validation
The Gang SHALL have a supported-entry validation path that proves the registered game can be entered and the current viewer can operate through the user-facing board. One client MUST remain bound to one viewer identity and MUST NOT expose a multi-human hotseat switcher. The current viewer's key chip choices and public progression MUST use visible UI controls. A single-client representative-state E2E MAY use state injection or test command dispatch for other seats, but it MUST be labeled as state-injection evidence and MUST NOT claim natural multi-client flow, seat authorization, or synchronization. Runtime entry validation SHALL NOT override unresolved base-game material blockers.

#### Scenario: One heist playable through the board
- **GIVEN** `the-gang` is discoverable from the generated game registry
- **WHEN** a user enters a The Gang match from a supported online entry or an approved local-AI/test entry
- **THEN** the board MUST reach the first actionable chip-selection state
- **AND** all player names and public chip states MUST remain visible without a hotseat switcher
- **AND** hidden hand contents MUST remain limited to the current viewer
- **AND** the current viewer MUST select chips and use visible progression controls through the user-facing board
- **AND** other seats MAY be driven by state injection or test commands only when the evidence is explicitly reported as a representative-state test
- **AND** evidence claiming natural multiplayer operation, seat authorization, or synchronization MUST use separate player clients
- **AND** mobile delivery MUST treat landscape as the primary orientation; portrait evidence MAY validate compatibility and key-region visibility without requiring direct horizontal scrolling inside the Board
- **AND** if any base-game required asset remains missing, blocked, or unapproved as a programmatic replacement, the E2E result MUST be reported only as runtime-code validation, not as base-game completion

### Requirement: The Gang completion reporting
The Gang SHALL report foundation, data intake, runtime entry, add-on capabilities, and expansion scope as separate completion states.

#### Scenario: Foundation complete but follow-up remains
- **WHEN** `add-the-gang-foundation` tasks are complete
- **THEN** the project MUST report foundation as complete
- **AND** it MUST NOT report the whole game as complete unless data intake, rule-object asset matrix, runtime resource, runtime entry, and accepted add-on scope are also closed or explicitly accepted as later work
