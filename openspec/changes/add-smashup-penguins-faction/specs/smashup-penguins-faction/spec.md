## ADDED Requirements

### Requirement: 企鹅派系可选且可初始化

企鹅（`penguins`）SHALL be available as a Smash Up faction after this change, without being marked implementation-in-progress, and selecting it SHALL initialize a 20-card faction deck plus 2 faction bases and the existing 企鹅帝皇 titan where titan rules apply.

#### Scenario: 企鹅牌组 composition

- **GIVEN** the Smash Up card registry is initialized
- **WHEN** the `penguins` faction deck is built
- **THEN** it contains exactly 20 cards
- **AND** row-major atlas slots `0-14` map to playable card definitions while slot `15` remains logo-only
- **AND** duplicate card counts match the official deck composition: 4 企鹅宝宝, 2 破壳而出, 2 渴望飞翔的工作, and one copy of each other unique card

#### Scenario: 企鹅基地 composition

- **GIVEN** the Smash Up base registry is initialized
- **WHEN** `penguins` faction bases are resolved
- **THEN** the available bases are 浮冰 and 殖民地
- **AND** the base atlas grid is treated as `2 x 2`
- **AND** duplicate atlas slots are not registered as duplicate base definitions

### Requirement: 企鹅旧中文图集玩法

企鹅 card and base abilities SHALL implement the old Chinese atlas text supplied by the user, using official sources only for counts, base existence/numbers, the existing titan definition, and the generic "play off the top of your deck" procedure.

#### Scenario: 从牌库顶打出随从

- **GIVEN** a 企鹅 effect instructs a player to play a minion from the top of their deck
- **WHEN** the deck top contains non-minions followed by a minion
- **THEN** the first matching minion is played as an extra minion with `playedFrom=deck`
- **AND** skipped revealed cards are returned to the player's deck order according to the implemented shuffle/reorder policy
- **AND** downstream triggers such as 企鹅宝宝、时髦企鹅、水晶礼品 and 殖民地 can observe that the minion was played from the deck

#### Scenario: 关键旧版能力可结算

- **GIVEN** a match containing 企鹅 cards and bases
- **WHEN** 企鹅司令、乔装企鹅、破壳而出、在冰下、我不能区分他们、跳上船、水晶礼品、冰滑道、浮冰 or 殖民地 resolves
- **THEN** each effect produces legal Smash Up events or interactions using existing runtime systems
- **AND** it does not require manual state editing or an out-of-band script to play
