# Requirements Document

## Introduction

大杀四方 (Smash Up) 教学系统：为新玩家提供完整的分步引导教学，覆盖从派系选择到完整回合流程的所有核心概念。教学通过 TutorialManifest 配置驱动，使用 AI 自动操作、高亮提示和受控交互引导玩家学习游戏规则。

## Glossary

- **Tutorial_System**: 教学系统，基于 TutorialManifest 的分步引导框架，通过高亮 UI 元素、AI 自动操作和受控命令引导玩家
- **Tutorial_Step**: 教学步骤，TutorialStepSnapshot 的实例，包含文案、高亮目标、允许/阻止的命令等配置
- **AI_Action**: 教学中由系统自动执行的游戏命令（aiActions），用于跳过非教学重点的操作
- **Cheat_Command**: 作弊命令，用于在教学中设置固定的游戏状态（手牌、资源等），确保教学流程可控可复现
- **Highlight_Target**: 高亮目标，通过 `data-tutorial-id` 属性标记的 DOM 元素，教学步骤可聚焦高亮该元素
- **Board_UI**: 大杀四方的游戏主界面组件（Board.tsx 及其子组件）
- **Phase**: 游戏阶段，包括 factionSelect、startTurn、playCards、scoreBases、draw、endTurn
- **Base**: 基地卡，场上的争夺目标，力量达到临界点时记分
- **Breakpoint**: 基地临界点，基地上所有随从力量总和达到此值时触发记分
- **VP**: 胜利分数 (Victory Points)，先到 15 VP 的玩家获胜
- **Faction**: 派系，玩家选择 2 个派系混搭组成 40 张牌库
- **Minion**: 随从卡，有力量值，放置在基地上贡献力量
- **Action_Card**: 行动卡，分为标准/持续/特殊三种子类型
- **Talent**: 天赋能力，每回合只能使用一次的随从能力
- **Hand_Limit**: 手牌上限，固定为 10 张，仅在抽牌阶段结束时检查

## Requirements

### Requirement 1: 教学初始化与派系选择

**User Story:** As a 新玩家, I want 教学自动完成派系选择和初始设置, so that 我可以跳过复杂的选择直接进入学习核心玩法。

#### Acceptance Criteria

1. WHEN the Tutorial_System starts, THE Tutorial_System SHALL use AI_Action to automatically select two factions for the player and the opponent
2. WHEN the Tutorial_System starts, THE Tutorial_System SHALL use AI_Action to automatically ready the opponent and start the game
3. WHEN the game setup completes, THE Tutorial_System SHALL use Cheat_Command to deal specific cards to the player's hand to ensure a controlled teaching scenario
4. THE Tutorial_System SHALL use a fixed random policy to ensure reproducible game outcomes across all tutorial sessions

### Requirement 2: UI 元素介绍

**User Story:** As a 新玩家, I want 逐步了解游戏界面的各个区域, so that 我知道每个 UI 元素的用途。

#### Acceptance Criteria

1. WHEN the tutorial enters the UI introduction phase, THE Tutorial_System SHALL highlight the base area and explain that bases are the targets players compete for
2. WHEN introducing the score sheet, THE Tutorial_System SHALL highlight the scoreboard area and explain VP tracking
3. WHEN introducing the hand area, THE Tutorial_System SHALL highlight the hand zone and explain card types (minion and action)
4. WHEN introducing the turn tracker, THE Tutorial_System SHALL highlight the turn tracker and explain the phase flow
5. WHEN introducing the end turn button, THE Tutorial_System SHALL highlight the end turn button and explain its function
6. WHILE a UI introduction step is active, THE Tutorial_System SHALL block the ADVANCE_PHASE command to prevent the player from skipping ahead

### Requirement 3: 出牌阶段教学

**User Story:** As a 新玩家, I want 在引导下学习如何打出随从和行动卡, so that 我掌握出牌阶段的核心操作。

#### Acceptance Criteria

1. WHEN the playCards phase begins in the tutorial, THE Tutorial_System SHALL explain that the player can play 1 minion and 1 action per turn
2. WHEN guiding minion play, THE Tutorial_System SHALL allow only the PLAY_MINION command and advance when a MINION_PLAYED event occurs
3. WHEN guiding action play, THE Tutorial_System SHALL allow only the PLAY_ACTION command and advance when an ACTION_PLAYED event occurs
4. WHEN the player finishes playing cards, THE Tutorial_System SHALL guide the player to click the end turn button to advance to the next phase

### Requirement 4: 基地记分教学

**User Story:** As a 新玩家, I want 理解基地记分的机制, so that 我知道如何赢得胜利分数。

#### Acceptance Criteria

1. WHEN introducing base scoring, THE Tutorial_System SHALL explain the breakpoint concept and how total power triggers scoring
2. WHEN introducing base scoring, THE Tutorial_System SHALL explain the VP award structure (1st/2nd/3rd place rankings)
3. WHEN the scoreBases phase occurs during the tutorial, THE Tutorial_System SHALL auto-advance through the scoring phase using AI_Action

### Requirement 5: 抽牌与手牌上限教学

**User Story:** As a 新玩家, I want 了解抽牌规则和手牌上限, so that 我知道每回合结束时的流程。

#### Acceptance Criteria

1. WHEN the draw phase begins in the tutorial, THE Tutorial_System SHALL explain that the player draws 2 cards per turn
2. WHEN explaining the draw phase, THE Tutorial_System SHALL explain the hand limit of 10 cards and the discard requirement
3. WHEN the draw phase explanation completes, THE Tutorial_System SHALL guide the player to advance to the next phase

### Requirement 6: 对手回合与回合循环

**User Story:** As a 新玩家, I want 观看对手的回合自动执行, so that 我理解回合交替的流程。

#### Acceptance Criteria

1. WHEN the opponent's turn begins, THE Tutorial_System SHALL use AI_Action to automatically execute the opponent's turn
2. WHEN the opponent's turn completes, THE Tutorial_System SHALL advance when the turn changes back to the player
3. WHEN the opponent's turn is executing, THE Tutorial_System SHALL display a message explaining that the opponent is taking their turn

### Requirement 7: 天赋能力教学

**User Story:** As a 新玩家, I want 了解天赋能力的使用方式, so that 我知道如何在回合中使用随从的特殊能力。

#### Acceptance Criteria

1. WHEN introducing talents, THE Tutorial_System SHALL explain that talents are once-per-turn abilities on minions
2. WHEN introducing talents, THE Tutorial_System SHALL highlight a minion with a talent ability on the board

### Requirement 8: 教学完成

**User Story:** As a 新玩家, I want 在教学结束时获得总结, so that 我对游戏规则有完整的认知。

#### Acceptance Criteria

1. WHEN all tutorial steps are completed, THE Tutorial_System SHALL display a summary of key concepts learned
2. WHEN the tutorial finishes, THE Tutorial_System SHALL allow the player to continue playing or exit

### Requirement 9: Board UI 高亮支持

**User Story:** As a 开发者, I want Board UI 组件添加 data-tutorial-id 属性, so that 教学系统可以高亮对应的 UI 元素。

#### Acceptance Criteria

1. THE Board_UI SHALL include `data-tutorial-id` attributes on the base area container, scoreboard, hand area, turn tracker, end turn button, and deck/discard zone
2. THE Board_UI SHALL include `data-tutorial-id` attributes on the faction selection screen elements
3. WHEN a Highlight_Target is specified in a Tutorial_Step, THE Tutorial_System SHALL visually focus the corresponding DOM element using the existing highlight mask mechanism

### Requirement 10: CheatSystem 集成

**User Story:** As a 开发者, I want 大杀四方游戏注册 CheatSystem, so that 教学可以使用作弊命令设置固定的游戏状态。

#### Acceptance Criteria

1. THE SmashUp game adapter SHALL register a CheatResourceModifier with the CheatSystem
2. THE SmashUp game adapter SHALL include all required Cheat_Command types in its commandTypes list
3. WHEN a DEAL_CARD_BY_ATLAS_INDEX Cheat_Command is issued, THE CheatSystem SHALL deal the specified card from the deck to the player's hand

### Requirement 11: 教学本地化

**User Story:** As a 玩家, I want 教学文案支持中英文, so that 不同语言的玩家都能理解教学内容。

#### Acceptance Criteria

1. THE Tutorial_System SHALL provide all tutorial step text in both zh-CN and en locales under the `game-smashup:tutorial` namespace
2. THE Tutorial_System SHALL use i18n keys for all tutorial content, with no hardcoded text in the tutorial manifest
