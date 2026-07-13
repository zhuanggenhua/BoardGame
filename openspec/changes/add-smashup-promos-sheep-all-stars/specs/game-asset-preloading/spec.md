## ADDED Requirements

### Requirement: Preload Sheep And All-Stars Promo Assets

The Smash Up runtime SHALL expose the 绵羊 and 全明星 card atlas, plus their required base atlas slots, through the locale-aware atlas catalog and critical-image preload resolver.

#### Scenario: Load Promo factions through the formal picker

- **WHEN** the Smash Up faction picker renders 绵羊 or 全明星
- **THEN** the shared Promo card atlas SHALL be available through standard localized image paths
- **AND** matches containing either faction SHALL preload the required base atlas path
- **AND** the runtime SHALL NOT treat randomizer or card-back atlas slots as playable cards
- **AND** the board SHALL NOT remain in a permanent atlas shimmer or fallback state
