## ADDED Requirements

### Requirement: Marvel Villain Faction Batch Contract
The Smash Up Marvel villain batch SHALL define Hydra, Kree, Masters of Evil, and Sinister Six as four distinct factions with traceable card-source contracts, 20-card physical deck counts, and separate implementation status from the earlier Marvel hero-side batch.

#### Scenario: Four faction batch is registered from the villain atlas
- **WHEN** the Marvel villain batch is inspected
- **THEN** the system exposes exactly four new faction identifiers for Hydra, Kree, Masters of Evil, and Sinister Six
- **AND** their card definitions sum to 20 physical cards per faction
- **AND** each card definition references the `marvel_villains` atlas using the locked row-major index.

#### Scenario: Gameplay status remains visible while handlers are incomplete
- **WHEN** a Marvel villain faction is visible in faction selection before all L2/L3/L4 evidence is complete
- **THEN** the faction metadata marks that faction as `implementationStatus: 'in_progress'`
- **AND** evidence documents do not claim full gameplay completion.

### Requirement: Marvel Villain Atlas Contract
The Marvel villain card atlas SHALL be registered as a `9 x 6` card atlas where row-major slots `0-48` are card faces and slots `49-53` are blank or tail slots that are not mapped to runtime cards.

#### Scenario: Card preview resolves to locked atlas slots
- **WHEN** a runtime card from Hydra, Kree, Masters of Evil, or Sinister Six is rendered
- **THEN** its `previewRef` uses the Marvel villain atlas id
- **AND** the referenced index is between `0` and `48`
- **AND** no card definition references the blank or tail slots `49-53`.

### Requirement: Marvel Villain Source Traceability
The Marvel villain batch SHALL retain a source evidence document that records the source image path, hash, dimensions, crop/contact-sheet artifacts, per-card canonical names, counts, and any unresolved Chinese effect transcript status.

#### Scenario: Chinese effect text is not fully locked
- **WHEN** evidence summarizes the intake contract
- **THEN** it marks English mechanics as locked from the Wiki-backed contract
- **AND** it marks Chinese effect text as translated or pending exact image transcript until the single-card crops are fully transcribed.
