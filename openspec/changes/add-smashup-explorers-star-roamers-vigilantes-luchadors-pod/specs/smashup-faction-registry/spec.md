## ADDED Requirements

### Requirement: Smash Up SHALL expose four additional POD factions

The Smash Up faction registry SHALL expose 探险家 explorers_pod、星际旅者 star_roamers_pod、侠义义警 vigilantes_pod and 摔角手 luchadors_pod as selectable POD factions with complete card data, atlas previews, locale entries, faction metadata and variant bindings.

#### Scenario: POD card data resolves to supplied 4×5 atlases

- **GIVEN** the user supplied four POD card images
- **WHEN** the game loads any card from explorers_pod, star_roamers_pod, vigilantes_pod or luchadors_pod
- **THEN** the card definition SHALL use a _pod card id
- **AND** the card definition SHALL point to the matching POD atlas id and 4×5 atlas index
- **AND** the total deck copies for each POD faction SHALL equal 20

#### Scenario: POD faction metadata and locale entries are available

- **GIVEN** the faction picker renders Smash Up factions
- **WHEN** these four POD faction ids are present
- **THEN** each POD faction SHALL have UI metadata without inheriting the base faction's in-progress marker
- **AND** English and Simplified Chinese locale files SHALL contain faction and card keys for every POD id

#### Scenario: Variant bindings prevent incorrect base-rule inheritance

- **GIVEN** a POD card whose rules text matches its base card
- **WHEN** the ability alias runtime initializes
- **THEN** the POD card MAY share the base ability/interaction/ongoing/modifier surfaces
- **AND** its base pool SHALL remain separate

- **GIVEN** a 侠义义警 POD card whose rules text differs from the base card
- **WHEN** the ability alias runtime initializes
- **THEN** that card family SHALL be marked separate for the affected surfaces
- **AND** explicit POD registrations SHALL override representative changed behavior rather than allowing the base behavior to alias through

