## ADDED Requirements

### Requirement: Engine primitives SHALL avoid unproven generic value frameworks
Engine primitives SHALL NOT introduce a cross-game authoritative value framework unless at least two real games need the same reusable helper shape after local DomainCore boundaries have been audited.

Shared helpers MAY be added for read-only selectors, assertions, deterministic dice utilities, or provenance formatting when those helpers remove repeated local code. Shared helpers MUST NOT become a second write path for game rules.

#### Scenario: One-game issue stays local
- **GIVEN** only DiceThrone has a proven damage summary overreach
- **WHEN** the issue can be fixed by DiceThrone-local domain helpers and tests
- **THEN** the engine MUST NOT add a cross-game value framework
- **AND** the fix MUST stay in the DiceThrone domain or UI selector boundary

#### Scenario: Two games share the same selector assertion need
- **GIVEN** DiceThrone damage and Betrayal dice both need the same assertion that view selectors cannot consume AI hints
- **WHEN** the helper would remove repeated local guard code
- **THEN** engine primitives MAY provide a read-only assertion or test helper
- **AND** it MUST NOT own or mutate game state

### Requirement: Engine primitives SHALL mark heuristic and visual values as non-authoritative
Any shared primitive or helper used for AI scoring, unavailable-action preview, animation, hover text, or rough evaluation MUST be explicitly separated from rule state.

#### Scenario: AI estimates before committed rule state exists
- **GIVEN** an AI evaluates a candidate action before a damage, dice, resource, or score result has been committed by rules
- **WHEN** it uses a heuristic value
- **THEN** that value MAY influence AI scoring
- **AND** it MUST NOT be used as player-visible formal value, rule-gating input, or final settlement value

#### Scenario: Animation dice cannot feed a rule branch
- **GIVEN** a dice animation shows intermediate or decorative dice faces
- **WHEN** a rule branch needs the committed dice result
- **THEN** the rule MUST read game domain state or committed event result
- **AND** it MUST NOT read animation-local dice faces
