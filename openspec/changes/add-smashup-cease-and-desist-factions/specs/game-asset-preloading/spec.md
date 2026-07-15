## ADDED Requirements

### Requirement: Preload Cease and Desist Faction Assets

The Smash Up runtime SHALL expose the 宇宙武士、卑劣封臣、星际旅者、百变机兵 card and base atlases, plus required titan images, through the locale-aware atlas catalog and critical-image preload resolver.

#### Scenario: Load Cease and Desist factions through the formal picker

- **WHEN** the Smash Up faction picker renders any of the four Cease and Desist factions
- **THEN** the shared card atlas and matching base atlas SHALL be available through standard localized image paths
- **AND** matches containing 卑劣封臣 or 百变机兵 SHALL preload their required titan image
- **AND** the runtime SHALL NOT treat card atlas slot `55` as a playable card
- **AND** the board SHALL NOT remain in a permanent atlas shimmer or fallback state
