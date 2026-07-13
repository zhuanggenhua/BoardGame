## ADDED Requirements

### Requirement: Smash Up Sheep Promo Faction

The Smash Up faction registry SHALL expose 绵羊（`sheep`）as a selectable and fully playable Promo faction with complete card, base, locale, atlas, ability, interaction, ongoing-effect, modifier, movement, and scoring registrations.

#### Scenario: Select and initialize Sheep

- **WHEN** a player selects 绵羊（`sheep`）from the formal faction picker
- **THEN** the match SHALL initialize its canonical 20-card faction deck
- **AND** the base pool SHALL include 牧场（`base_the_pasture`）and 绵羊神社（`base_sheep_shrine`）
- **AND** every card and base SHALL resolve the locked rule contract

#### Scenario: Reuse existing Sheep base registrations safely

- **WHEN** 牧场 or 绵羊神社 resolves its base ability
- **THEN** the runtime SHALL use the existing base ability registrations after they pass current intake and implementation evidence checks
- **AND** this change SHALL NOT replace those existing registrations unless the source contract proves they are incorrect

### Requirement: Smash Up All-Stars Promo Faction

The Smash Up faction registry SHALL expose 全明星（`all_stars`）as a selectable and fully playable Promo faction with complete card, base, locale, atlas, ability, interaction, ongoing-effect, modifier, movement, scoring, and base-ability registrations.

#### Scenario: Select and initialize All-Stars

- **WHEN** a player selects 全明星（`all_stars`）from the formal faction picker
- **THEN** the match SHALL initialize its canonical 20-card faction deck
- **AND** the base pool SHALL include 更衣室（`base_locker_room`）and 体育场（`base_stadium`）
- **AND** every card and base SHALL resolve the locked rule contract

#### Scenario: Resolve tribute cards without unsafe aliasing

- **WHEN** a 全明星 card has a name or theme similar to an existing Smash Up card
- **THEN** implementation SHALL first compare the locked rule text and effect atoms
- **AND** it SHALL only reuse an existing handler when the trigger, target, cost, optionality, final state, and cleanup contract are equivalent
- **AND** otherwise it SHALL register a distinct handler or wrapper with its own tests and evidence

### Requirement: Smash Up Promo Atlas Slot Contract

The Smash Up Promo card atlas SHALL preserve playable card slots and display-only slots separately.

#### Scenario: Register playable and display-only atlas slots

- **WHEN** the Promo card atlas is registered
- **THEN** slots `0-11` SHALL map to 绵羊 playable cards
- **AND** slots `12-31` SHALL map to 全明星 playable cards
- **AND** slots `32-35` SHALL be documented as display-only randomizer/back/logo slots
- **AND** slots `32-35` SHALL NOT be registered as playable card definitions
