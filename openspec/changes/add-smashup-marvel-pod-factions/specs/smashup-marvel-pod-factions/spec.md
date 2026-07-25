## ADDED Requirements
### Requirement: Marvel POD faction card-art editions
The Smash Up Marvel implementation SHALL expose POD card-art editions for 复仇者, 神盾局, 蜘蛛宇宙, 终极战队, 九头蛇, 克里, 邪恶大师, and 邪恶六人组 with independent faction and card identities while preserving the gameplay fields of their corresponding classic Marvel factions.

#### Scenario: POD card identities preserve gameplay
- **WHEN** the card catalog registers a Marvel POD faction
- **THEN** each POD card uses an id suffixed with _pod, the matching POD faction id, the matching POD atlas id, and the same non-identity gameplay fields as its classic card.
