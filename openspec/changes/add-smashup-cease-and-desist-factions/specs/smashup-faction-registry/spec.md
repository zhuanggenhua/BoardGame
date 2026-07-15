## ADDED Requirements

### Requirement: Smash Up Astroknights Faction

The Smash Up faction registry SHALL expose 宇宙武士（`astroknights`）as a selectable and fully playable faction with complete card, base, locale, atlas, ability, interaction, ongoing-effect, modifier, and scoring registrations.

#### Scenario: Select and initialize Astroknights

- **WHEN** a player selects 宇宙武士（`astroknights`）from the formal faction picker
- **THEN** the match SHALL initialize its canonical 20-card faction deck
- **AND** the base pool SHALL include No-Moon and Hive of Scum and Villainy
- **AND** every card and base SHALL resolve the locked rule contract

### Requirement: Smash Up Ignobles Faction

The Smash Up faction registry SHALL expose 卑劣封臣（`ignobles`）as a selectable and fully playable faction with complete card, base, locale, atlas, ability, interaction, ongoing-effect, modifier, scoring, and titan registrations.

#### Scenario: Select and initialize Ignobles

- **WHEN** a player selects 卑劣封臣（`ignobles`）from the formal faction picker
- **THEN** the match SHALL initialize its canonical 20-card faction deck
- **AND** the base pool SHALL include Spikey Chair Room and Wintersquashed
- **AND** the faction SHALL expose the existing漫步山丘（`ignobles_the_hill_that_strolls`）titan

#### Scenario: Resolve Ignobles and The Hill that Strolls interactions

- **WHEN** an Ignobles effect changes minion control or activates its titan chain
- **THEN** the runtime SHALL use the authoritative control, reaction-ordering, prompt-source, and cleanup state
- **AND** the final state SHALL contain no stale interaction or queued titan trigger

### Requirement: Smash Up Star Roamers Faction

The Smash Up faction registry SHALL expose 星际旅者（`star_roamers`）as a selectable and fully playable faction with complete card, base, locale, atlas, ability, interaction, ongoing-effect, modifier, movement, and scoring registrations.

#### Scenario: Select and initialize Star Roamers

- **WHEN** a player selects 星际旅者（`star_roamers`）from the formal faction picker
- **THEN** the match SHALL initialize its canonical 20-card faction deck
- **AND** the base pool SHALL include USS Undertaking and Neutral Space
- **AND** every movement or relocation effect SHALL reach the locked final state

### Requirement: Smash Up Changerbots Faction

The Smash Up faction registry SHALL expose 百变机兵（`changerbots`）as a selectable and fully playable faction with complete card, base, locale, atlas, ability, interaction, ongoing-effect, modifier, scoring, and titan registrations.

#### Scenario: Select and initialize Changerbots

- **WHEN** a player selects 百变机兵（`changerbots`）from the formal faction picker
- **THEN** the match SHALL initialize its canonical 20-card faction deck
- **AND** the base pool SHALL include Changing Room and Unicrave
- **AND** the faction SHALL expose the existing合体机器人（`changerbots_mergacon`）titan

#### Scenario: Resolve Changerbots and Mergacon interactions

- **WHEN** a Changerbots effect or Mergacon changes form, moves, suppresses an ongoing ability, or creates a follow-up interaction
- **THEN** the runtime SHALL preserve the authoritative source, target, duration, and cleanup contract
- **AND** the final state SHALL contain no stale prompt, suppression marker, or queued titan trigger
