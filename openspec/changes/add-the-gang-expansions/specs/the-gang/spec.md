## ADDED Requirements
### Requirement: The Gang extension rules configuration
The Gang SHALL provide a rules configuration for expansion play that can be changed only before the first heist has progressed beyond the initial chip-selection state.

#### Scenario: Configure expansion before play starts
- **GIVEN** a The Gang match is in heist 1 round 1
- **AND** no player has taken a chip
- **WHEN** a player sets a supported expansion rules configuration
- **THEN** the system MUST apply the normalized rules configuration
- **AND** the system MUST preserve the current dealt cards when the change does not alter the deal signature
- **AND** the system MUST rebuild the current heist when the change alters hand cards, community cards, game mode, special deck contents, Omaha, or 2Hand dealing
- **AND** unsupported or incompatible challenge selections MUST be removed from the active configuration

#### Scenario: Rules lock after play starts
- **GIVEN** any player has selected a chip or the match has recorded round/heist history
- **WHEN** a player attempts to change the expansion rules configuration
- **THEN** the command MUST be rejected
- **AND** the current heist state MUST remain unchanged

### Requirement: The Gang expansion modes
The Gang SHALL support Texas Hold'em, Seven-Card Stud, and Banana Split as selectable game modes, with each mode defining its own hand-card and community-card deal plan.

#### Scenario: Seven-Card Stud uses personal community cards
- **GIVEN** the rules configuration selects Seven-Card Stud
- **WHEN** a new heist is dealt
- **THEN** each player MUST receive three hidden hand cards
- **AND** each player MUST receive one personal face-up community card
- **AND** shared community cards MUST NOT be used as the player's only community source at showdown

#### Scenario: Base Texas Hold'em still uses shared community cards
- **GIVEN** the rules configuration selects Texas Hold'em
- **WHEN** the heist reaches showdown
- **THEN** each player MUST be evaluated with their hidden hand cards and the shared community cards
- **AND** the system MUST NOT replace shared community cards with an empty personal community-card list

### Requirement: The Gang TTS setup toggles
The Gang SHALL implement the TTS setup toggles for Omaha, 2Hand, 2Hand hand swap, and Automode where their runtime behavior is evidence-bounded by the Lua script.

#### Scenario: 2Hand deals and resolves two separate hands
- **GIVEN** the rules configuration enables 2Hand in Texas Hold'em with no more than five players
- **WHEN** a new heist is dealt
- **THEN** each player MUST receive a top hand and a bottom hand
- **AND** showdown MUST evaluate the two hands separately
- **AND** the stronger of the two hands MUST be used for chip-order validation

#### Scenario: Omaha changes hand size and evaluation
- **GIVEN** the rules configuration enables Omaha
- **WHEN** a new heist is dealt
- **THEN** each dealt hand MUST receive two additional hand cards
- **AND** showdown MUST evaluate hands using exactly two hand cards and three board cards when enough cards exist

#### Scenario: Automode advances after chip completion
- **GIVEN** the rules configuration enables Automode
- **WHEN** every player has taken a chip for the current round
- **THEN** the system MUST automatically advance to the next round or reveal showdown for the final round
- **AND** the system MUST NOT require the normal all-player progress confirmation for that automatic step

#### Scenario: 2Hand hand swap resolves after chip voting
- **GIVEN** the rules configuration enables 2Hand hand swap in Texas Hold'em with no more than five players
- **WHEN** all players have completed the normal chip-vote progress for a round or final showdown
- **THEN** the system MUST enter a hand-swap stage before drawing next-round cards or revealing showdown
- **AND** each player MUST be able to either exchange exactly one top-hand card with exactly one bottom-hand card or confirm no swap
- **AND** the system MUST advance to the next round or reveal showdown only after every player confirms the hand-swap stage
- **AND** enabling or disabling hand swap MUST NOT redeal cards unless another changed option alters the deal signature

### Requirement: The Gang challenge deal variants
The Gang SHALL implement TTS-derived challenge variants that change round progression, initial hand size, public card reveals, personal community cards, and special deck contents.

#### Scenario: Challenge deal plan changes card flow
- **GIVEN** a supported challenge that changes the deal plan is active
- **WHEN** the heist advances through public-card rounds
- **THEN** the system MUST apply the challenge's extra cards, discarded high/low cards, skipped round, reversed public-card order, or front-loaded community-card rule as defined by the normalized configuration
- **AND** the deck MUST consume the same number of cards that the rule drew before discards

#### Scenario: Incompatible challenge is removed
- **GIVEN** a challenge is incompatible with the selected game mode
- **WHEN** rules configuration is normalized
- **THEN** the incompatible challenge MUST NOT remain active

### Requirement: The Gang expansion poker evaluation
The Gang SHALL support implemented expansion poker variants for special ranks, special suits, wild cards, disabled flush families, rank reversal, blank cards, and locked hand ranks.

#### Scenario: Expansion hand ranks are evaluated
- **GIVEN** an expansion configuration enables gear suit or wild-card style poker variants
- **WHEN** showdown evaluates a player's best hand
- **THEN** the evaluator MUST include the relevant expansion cards and hand-rank families
- **AND** locked hand ranks MUST NOT be selected as the best result

#### Scenario: Base poker order remains intact
- **GIVEN** no expansion poker challenge is active
- **WHEN** showdown evaluates standard cards
- **THEN** the evaluator MUST preserve standard Texas Hold'em hand ordering and kicker comparison

### Requirement: The Gang extension selection UI
The Gang SHALL expose extension selection through the current Board UI style without replacing the main table, player panels, chip controls, or progression controls.

#### Scenario: User opens extension panel
- **GIVEN** the The Gang Board is mounted
- **WHEN** the user opens the extension controls
- **THEN** the Board MUST show a compact rules panel using the current visual style
- **AND** the panel MUST allow selecting supported game modes and implemented challenges before the rules are locked
- **AND** reminder-only challenges with implemented runtime status MUST surface as short table status labels instead of rule-changing mechanics
- **AND** specialist single-card or vault rules MUST NOT be presented as completed interactive gameplay unless their runtimeStatus is implemented

#### Scenario: Extension UI locks during play
- **GIVEN** the rules are locked by gameplay progress
- **WHEN** the user views the extension panel
- **THEN** the Board MUST communicate that rules are locked
- **AND** changing the panel MUST NOT mutate the active heist

### Requirement: The Gang tool and specialist cards
The Gang SHALL model TTS-derived tool-card and specialist-card rule state where the Lua script contains runtime behavior.

#### Scenario: Tool cards are dealt through the Board
- **GIVEN** a The Gang match has enough tool cards for all players
- **WHEN** a player uses the tool-card deal control
- **THEN** each player MUST receive one tool card
- **AND** the tool deck MUST be reduced by the number of dealt players
- **AND** the same heist MUST reject repeated tool-card dealing

#### Scenario: Scripted tool cards apply their effects
- **GIVEN** a player holds a TTS-scripted tool card
- **WHEN** the player uses 一次性手机, 手电筒, 润滑剂, or 夜视眼镜
- **THEN** the used tool MUST leave the player's held tool cards and be recorded as active/discarded
- **AND** 一次性手机 MUST draw two specialist cards for that player
- **AND** 手电筒 MUST reveal a non-Joker deck card as an extra evaluated card
- **AND** 夜视眼镜 MUST move one hand card to the tool area while still counting it in showdown evaluation

#### Scenario: Specialist effects remain evidence-bounded
- **GIVEN** TTS Lua currently exposes specialist deck draw and reset behavior but no individual specialist effect scripts
- **WHEN** reporting specialist support
- **THEN** the project MUST claim specialist-card draw state only
- **AND** the project MUST NOT claim individual specialist card effects until a source script or rule source is identified and implemented

### Requirement: The Gang expansion boundary
The Gang SHALL distinguish implemented expansion rules from documented TTS-derived rules that remain future scope.

#### Scenario: Evidence-bounded TTS modules are not claimed complete
- **GIVEN** TTS Lua contains specialist single-card effects without implementation evidence or vault/safe logic
- **WHEN** reporting expansion support
- **THEN** the project MUST identify those modules as documented-only unless corresponding runtime behavior is implemented and tested
- **AND** insurance/vault 3D assets MUST NOT block this rules-focused change
