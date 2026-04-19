# Requirements Document

## Introduction

本文档定义 Cardia 游戏的音效和背景音乐系统需求。Cardia 是一个策略卡牌游戏，主题是魔法城市中四大派系争夺权力。游戏核心机制是双方同时出牌进行遭遇战，通过影响力对比决定胜负，率先获得5个印戒获胜。

游戏已有完整的事件系统（`src/games/cardia/domain/events.ts`），包含 30+ 种游戏事件。项目已有完善的音频架构（`docs/audio/add-audio.md`），支持事件驱动音效、BGM 管理、预加载策略等功能。

本需求旨在为 Cardia 游戏选择或创建符合魔法城市主题的音效和 BGM，并为关键游戏事件配置合适的音效，确保音效与游戏节奏和氛围相匹配。

## Glossary

- **Cardia_Game**: 策略卡牌游戏，主题为魔法城市中四大派系争夺权力
- **Audio_System**: 项目音频架构，包含音效管理、BGM 管理、预加载策略等功能
- **Event_System**: Cardia 游戏的事件系统，定义了 30+ 种游戏事件
- **Sound_Key**: 音频注册表中的唯一标识符，格式为 `category.subcategory.filename`
- **BGM**: 背景音乐（Background Music）
- **SFX**: 音效（Sound Effects）
- **Registry**: 音频注册表，存储所有音频资源的元数据
- **Feedback_Resolver**: 事件音效解析器，将游戏事件映射到音效 key
- **Audio_Strategy**: 音效策略，包括 `ui`（本地交互）、`immediate`（即时反馈）、`fx`（动画驱动）、`silent`（无音效）
- **Faction**: 派系，Cardia 游戏中的四大派系：沼泽反叛军、学院学者、行会机械、王朝后裔
- **Encounter**: 遭遇战，双方打出的卡牌进行影响力对比
- **Signet**: 印戒，游戏胜利条件，率先获得5个印戒获胜
- **Ability**: 能力，卡牌的特殊效果
- **Modifier**: 修正标记，影响卡牌影响力的临时效果
- **Influence**: 影响力，卡牌的战斗力数值

## Requirements

### Requirement 1: 选择符合主题的 BGM

**User Story:** 作为玩家，我希望听到符合魔法城市主题的背景音乐，以便沉浸在游戏氛围中。

#### Acceptance Criteria

1. THE Audio_System SHALL 从音频注册表中选择至少 8 首符合魔法城市主题的 BGM
2. WHEN 选择 BGM 时，THE Audio_System SHALL 确保曲目风格包含魔法、策略、神秘等元素
3. THE Audio_System SHALL 将 BGM 分为 `normal`（普通阶段）和 `battle`（战斗阶段）两组
4. THE Audio_System SHALL 为每组指定一个默认曲目
5. THE Audio_System SHALL 确保所选 BGM 不与其他游戏重复使用

### Requirement 2: 为关键游戏事件配置音效

**User Story:** 作为玩家，我希望在执行游戏操作时听到相应的音效反馈，以便更好地理解游戏状态变化。

#### Acceptance Criteria

1. WHEN 卡牌打出事件（CARD_PLAYED）发生时，THE Audio_System SHALL 播放卡牌打出音效
2. WHEN 卡牌抽取事件（CARD_DRAWN）发生时，THE Audio_System SHALL 播放卡牌抽取音效
3. WHEN 遭遇结算事件（ENCOUNTER_RESOLVED）发生时，THE Audio_System SHALL 根据结果播放胜利、失败或平局音效
4. WHEN 能力激活事件（ABILITY_ACTIVATED）发生时，THE Audio_System SHALL 播放能力激活音效
5. WHEN 印戒授予事件（SIGNET_GRANTED）发生时，THE Audio_System SHALL 播放印戒获得音效
6. WHEN 修正标记放置事件（MODIFIER_TOKEN_PLACED）发生时，THE Audio_System SHALL 根据修正值正负播放增益或减益音效
7. WHEN 卡牌替换事件（CARD_REPLACED）发生时，THE Audio_System SHALL 播放卡牌替换音效
8. WHEN 卡牌弃掉事件（CARDS_DISCARDED）发生时，THE Audio_System SHALL 播放卡牌弃掉音效
9. WHEN 游戏胜利事件（GAME_WON）发生时，THE Audio_System SHALL 播放游戏胜利音效

### Requirement 3: 实现事件音效解析器

**User Story:** 作为开发者，我希望有一个统一的事件音效解析器，以便将游戏事件自动映射到合适的音效。

#### Acceptance Criteria

1. THE Audio_System SHALL 创建 `feedbackResolver` 函数，接收游戏事件并返回音效 key
2. THE Audio_System SHALL 使用 `defineEvents()` 定义音频策略
3. WHEN 事件需要即时音效反馈时，THE Audio_System SHALL 使用 `immediate` 策略
4. WHEN 事件需要动画驱动音效时，THE Audio_System SHALL 使用 `fx` 策略
5. WHEN 事件不需要音效时，THE Audio_System SHALL 使用 `silent` 策略
6. THE Audio_System SHALL 确保每个事件的音效只在一个地方播放（UI 层 / EventStream / FX 系统）

### Requirement 4: 配置音效预加载策略

**User Story:** 作为玩家，我希望游戏启动后音效能够快速响应，以便获得流畅的游戏体验。

#### Acceptance Criteria

1. THE Audio_System SHALL 配置 `criticalSounds` 列表，包含首回合高频音效（5-15 个）
2. THE Audio_System SHALL 在游戏进入后立即预加载 `criticalSounds`
3. WHERE 游戏有派系选择时，THE Audio_System SHALL 配置 `contextualPreloadKeys` 函数，根据选择的派系预加载对应音效
4. THE Audio_System SHALL 确保预加载不阻塞游戏启动

### Requirement 5: 确保音效语义正确性

**User Story:** 作为玩家，我希望听到的音效与游戏操作语义匹配，以便直观理解游戏状态变化。

#### Acceptance Criteria

1. WHEN 卡牌从隐藏信息变为公开信息时，THE Audio_System SHALL 播放揭示类音效，而非抽象 handling 音效
2. WHEN 卡牌获得或失去特殊规则身份时，THE Audio_System SHALL 播放状态变化音效，而非抽象 handling 音效
3. WHEN 卡牌在公开区域之间转移时，THE Audio_System SHALL 播放 `card.handling.*` 或 `card.fx.*` 音效
4. WHEN 事件同时包含状态变化和位置变化时，THE Audio_System SHALL 优先表达状态变化的音效
5. THE Audio_System SHALL 确保不使用低质量音效系列（如 `dark_fantasy_studio`），除非语义高度匹配

### Requirement 6: 创建音频配置文件

**User Story:** 作为开发者，我希望有一个集中的音频配置文件，以便管理 Cardia 游戏的所有音频资源。

#### Acceptance Criteria

1. THE Audio_System SHALL 创建 `src/games/cardia/audio.config.ts` 文件
2. THE Audio_System SHALL 在配置文件中定义 `bgm` 数组，包含所有 BGM 的 key
3. THE Audio_System SHALL 在配置文件中定义 `bgmGroups`，将 BGM 分为 `normal` 和 `battle` 两组
4. THE Audio_System SHALL 在配置文件中定义 `bgmRules`，指定每组的默认曲目
5. THE Audio_System SHALL 在配置文件中定义 `criticalSounds` 列表
6. THE Audio_System SHALL 在配置文件中定义 `contextualPreloadKeys` 函数（如适用）
7. THE Audio_System SHALL 确保配置文件不包含 `basePath` 或 `sounds` 字段（禁止在游戏层定义音频资源）

### Requirement 7: 集成音频系统到游戏引擎

**User Story:** 作为开发者，我希望音频系统能够自动响应游戏事件，以便无需手动触发音效播放。

#### Acceptance Criteria

1. THE Audio_System SHALL 在 `src/games/cardia/game.ts` 中导入音频配置
2. THE Audio_System SHALL 将 `feedbackResolver` 注册到游戏引擎
3. THE Audio_System SHALL 确保游戏引擎在事件发生时自动调用 `feedbackResolver`
4. THE Audio_System SHALL 确保音效播放不阻塞游戏逻辑执行

### Requirement 8: 更新音频注册表

**User Story:** 作为开发者，我希望新增的音效能够被正确注册，以便在游戏中使用。

#### Acceptance Criteria

1. IF 需要新增音效素材，THEN THE Audio_System SHALL 将音频文件放入 `public/assets/common/audio/` 目录
2. THE Audio_System SHALL 运行 `npm run compress:audio` 压缩音频文件
3. THE Audio_System SHALL 运行 `node scripts/audio/generate_common_audio_registry.js` 生成全量注册表
4. THE Audio_System SHALL 将 `public/assets/common/audio/registry.json` 同步到 `src/assets/audio/registry.json`
5. THE Audio_System SHALL 运行 `node scripts/audio/generate-slim-registry.mjs` 生成运行时精简注册表
6. THE Audio_System SHALL 运行 `node scripts/audio/generate_audio_assets_md.js` 生成音频清单文档
7. THE Audio_System SHALL 确保所有音效 key 在注册表中存在

### Requirement 9: 验证音频系统功能

**User Story:** 作为开发者，我希望能够验证音频系统是否正常工作，以便确保玩家能够听到正确的音效。

#### Acceptance Criteria

1. THE Audio_System SHALL 在 `/dev/audio` 页面中能够预览所有 Cardia 使用的音效
2. THE Audio_System SHALL 在游戏运行时能够正确播放事件音效
3. THE Audio_System SHALL 在游戏运行时能够正确播放 BGM
4. THE Audio_System SHALL 在游戏运行时能够正确切换 `normal` 和 `battle` BGM
5. THE Audio_System SHALL 确保音效不重复播放（每个事件只在一个地方播放）

### Requirement 10: 编写音频系统文档

**User Story:** 作为开发者，我希望有清晰的文档说明 Cardia 音频系统的设计和使用方法，以便后续维护和扩展。

#### Acceptance Criteria

1. THE Audio_System SHALL 创建 `evidence/cardia-audio-system.md` 文档
2. THE Audio_System SHALL 在文档中说明 BGM 选择的理由和风格定位
3. THE Audio_System SHALL 在文档中列出所有事件与音效的映射关系
4. THE Audio_System SHALL 在文档中说明预加载策略的设计
5. THE Audio_System SHALL 在文档中说明如何添加新的音效或 BGM
