## ADDED Requirements

### Requirement: Disney Aladdin Beauty Nightmare Ralph Intake Contract

The system SHALL treat the provided Disney contact sheet as a Smash Up four-faction source batch for 阿拉丁, 美女与野兽, 圣诞夜惊魂, and 无敌破坏王 and SHALL complete a field-level intake contract before runtime implementation begins.

#### Scenario: Lock image-derived card data before implementation

- **WHEN** the Disney batch is approved for implementation
- **THEN** the system MUST create complete single-card crops for every image-backed card before locking rule text
- **AND** the system MUST record source metadata, crop paths, row-major indexes, card ownership, readable fields, unresolved fields, and `locked / blocked / disputed` status
- **AND** the system MUST NOT use the full contact sheet thumbnail alone to finalize card names, powers, types, effect clauses, or preview indexes

#### Scenario: Missing Disney base information blocks base implementation

- **WHEN** no matching base atlas or base text is available for a Disney faction
- **THEN** the system MUST record the missing base source as `blocked`
- **AND** the system MUST NOT invent base names, breakpoints, VP values, or gameplay effects without explicit source evidence or user approval

### Requirement: Disney Aladdin Beauty Nightmare Ralph Registry And Assets

The system SHALL register 阿拉丁, 美女与野兽, 圣诞夜惊魂, and 无敌破坏王 as independent Smash Up factions with source-backed assets, locale entries, static data, and metadata.

#### Scenario: Register Disney factions as selectable factions

- **WHEN** the Smash Up faction registry initializes after the approved implementation
- **THEN** it SHALL include faction IDs for 阿拉丁, 美女与野兽, 圣诞夜惊魂, and 无敌破坏王
- **AND** each faction SHALL have registered card definitions, base definitions where source-backed, locale keys, faction metadata, atlas references, and critical image preload coverage
- **AND** these registrations SHALL be additive and MUST NOT overwrite unrelated active POD faction registrations

#### Scenario: Load Disney runtime assets through the formal asset pipeline

- **WHEN** a Disney card or base image is rendered
- **THEN** the image SHALL resolve through formal `i18n/zh-CN/smashup` runtime asset paths and compressed WebP variants
- **AND** the game-level and root asset manifests SHALL include the new runtime assets
- **AND** release-readiness SHALL require server asset upload and representative public URL `HEAD 200` verification unless explicitly scoped out by the user

### Requirement: Disney Aladdin Beauty Nightmare Ralph Gameplay Implementation

The system SHALL implement the approved Disney factions one faction at a time using Smash Up shared ability/runtime patterns and SHALL provide object-level gameplay evidence.

#### Scenario: Implement Disney faction gameplay sequentially

- **WHEN** the system begins gameplay implementation
- **THEN** it MUST complete 阿拉丁 before 美女与野兽, 美女与野兽 before 圣诞夜惊魂, and 圣诞夜惊魂 before 无敌破坏王 unless the user changes the order
- **AND** each faction MUST pass through configuration reuse, shared mechanism extension, and UI/E2E layers before being marked complete
- **AND** a faction with unresolved card/base clauses MUST remain `blocked` or `scoped-debt` rather than complete

#### Scenario: Validate Disney card effects at L2/L3/L4

- **WHEN** a Disney card or base effect is implemented
- **THEN** the system MUST provide L2 behavior tests for the authoritative state change
- **AND** effects with player choices, optional text, response windows, delayed cleanup, scoring hooks, or trigger queues MUST also have L3/L4 evidence from a real entry path
- **AND** optional, up-to, or any-number clauses MUST include skip or empty-selection coverage when legal candidates exist

### Requirement: Disney Aladdin Beauty Nightmare Ralph Release Readiness

The Disney batch SHALL only be described as push-ready when OpenSpec, intake, assets, gameplay, tests, E2E, evidence, and release handoff all match the approved scope.

#### Scenario: Prepare the Disney batch for author handoff

- **WHEN** the system reports the Disney batch as ready to push or hand off
- **THEN** all OpenSpec tasks for the approved scope SHALL be checked only after corresponding evidence exists
- **AND** the final evidence SHALL include a full-object L0/L1/L2/L3/L4 matrix, validation commands, screenshot paths, resource upload status, and residual-risk statement
- **AND** any unrelated worktree changes SHALL be clearly excluded from the Disney push/commit scope unless the user explicitly authorizes a combined push
