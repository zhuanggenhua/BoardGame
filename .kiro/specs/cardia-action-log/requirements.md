# Requirements Document

## Introduction

本文档定义 Cardia 游戏行为日志系统(ActionLog)的需求。Cardia 是一个双人卡牌对战游戏，玩家通过打出卡牌、激活能力、放置修正标记等操作进行游戏。目前 Cardia 没有行为日志系统，玩家无法回顾之前发生的操作和事件。

本系统将参考 Dice Throne 和 Smash Up 的实现模式，为 Cardia 提供完整的行为日志功能，记录所有有意义的玩家操作和游戏事件，支持国际化，并与现有 UI 组件集成。

## Glossary

- **ActionLog**: 行为日志系统，记录游戏中所有有意义的操作和事件
- **ActionLogEntry**: 单条日志条目，包含时间戳、执行者、操作类型和显示内容
- **ActionLogSegment**: 日志条目的显示片段，支持文本、i18n、卡牌预览等类型
- **Command**: 命令，玩家主动发起的操作（如打牌、激活能力）
- **Event**: 事件，游戏状态变化产生的通知（如卡牌打出、印戒授予）
- **Allowlist**: 白名单，定义哪些命令/事件需要记录到日志
- **i18n Segment**: 国际化片段，延迟翻译的文本片段，渲染时由客户端翻译
- **Card Preview Segment**: 卡牌预览片段，显示卡牌名称并支持悬停预览
- **Formatter**: 格式化函数，将命令和事件转换为日志条目
- **Undo Allowlist**: 撤回白名单，定义哪些命令可以创建撤回快照
- **Cardia_System**: Cardia 游戏系统，包含领域逻辑、事件处理和状态管理
- **Encounter**: 遭遇，Cardia 游戏中的核心机制，玩家在 3 个遭遇位置打出卡牌
- **Signet**: 印戒，Cardia 游戏的胜利条件，玩家需要获得 4 个印戒
- **Modifier_Token**: 修正标记，放置在卡牌上的数值标记，影响卡牌影响力
- **Ongoing_Ability**: 持续能力，持续生效的能力效果
- **Ability**: 能力，卡牌上的特殊效果，分为即时能力和持续能力

## Requirements

### Requirement 1: 行为日志系统集成

**User Story:** 作为开发者，我想要在 Cardia 游戏中集成行为日志系统，以便玩家可以查看游戏历史记录。

#### Acceptance Criteria

1. THE Cardia_System SHALL 使用 `createActionLogSystem` 创建行为日志系统
2. THE Cardia_System SHALL 在系统列表中注册 ActionLogSystem
3. THE Cardia_System SHALL 提供 `ACTION_ALLOWLIST` 定义需要记录的命令类型
4. THE Cardia_System SHALL 提供 `UNDO_ALLOWLIST` 定义可撤回的命令类型
5. THE Cardia_System SHALL 提供 `formatCardiaActionEntry` 格式化函数

### Requirement 2: 命令日志记录

**User Story:** 作为玩家，我想要看到我执行的操作记录，以便回顾游戏过程。

#### Acceptance Criteria

1. WHEN 玩家执行 `PLAY_CARD` 命令，THE ActionLog SHALL 记录"打出卡牌"条目
2. WHEN 玩家执行 `ACTIVATE_ABILITY` 命令，THE ActionLog SHALL 记录"激活能力"条目
3. WHEN 玩家执行 `SKIP_ABILITY` 命令，THE ActionLog SHALL 记录"跳过能力"条目
4. WHEN 玩家执行 `END_TURN` 命令，THE ActionLog SHALL 记录"回合结束"条目
5. WHEN 玩家执行 `SYS_INTERACTION_RESPOND` 命令，THE ActionLog SHALL 记录交互解决后产生的事件

### Requirement 3: 事件日志记录

**User Story:** 作为玩家，我想要看到游戏中发生的事件记录，以便理解游戏状态变化。

#### Acceptance Criteria

1. WHEN `CARD_PLAYED` 事件发生，THE ActionLog SHALL 记录卡牌打出信息（卡牌名称、遭遇位置）
2. WHEN `CARD_DRAWN` 事件发生，THE ActionLog SHALL 记录抽牌信息（玩家、数量）
3. WHEN `ENCOUNTER_RESOLVED` 事件发生，THE ActionLog SHALL 记录遭遇结算信息（位置、获胜方）
4. WHEN `ABILITY_ACTIVATED` 事件发生，THE ActionLog SHALL 记录能力激活信息（能力名称、卡牌）
5. WHEN `SIGNET_GRANTED` 事件发生，THE ActionLog SHALL 记录印戒授予信息（玩家、卡牌、总数）
6. WHEN `MODIFIER_TOKEN_PLACED` 事件发生，THE ActionLog SHALL 记录修正标记放置信息（卡牌、数值）
7. WHEN `MODIFIER_TOKEN_REMOVED` 事件发生，THE ActionLog SHALL 记录修正标记移除信息（卡牌）
8. WHEN `ONGOING_ABILITY_PLACED` 事件发生，THE ActionLog SHALL 记录持续能力放置信息（能力、卡牌）
9. WHEN `ONGOING_ABILITY_REMOVED` 事件发生，THE ActionLog SHALL 记录持续能力移除信息（能力、卡牌）
10. WHEN `CARDS_DISCARDED` 事件发生，THE ActionLog SHALL 记录弃牌信息（玩家、数量、来源）
11. WHEN `CARD_REPLACED` 事件发生，THE ActionLog SHALL 记录卡牌替换信息（位置、旧卡牌、新卡牌）
12. WHEN `FACTION_SELECTED` 事件发生，THE ActionLog SHALL 记录派系选择信息（玩家、派系）

### Requirement 4: 国际化支持

**User Story:** 作为玩家，我想要看到本地化的日志文本，以便理解日志内容。

#### Acceptance Criteria

1. THE ActionLog SHALL 使用 i18n segment 延迟翻译文本
2. THE ActionLog SHALL 使用 `game-cardia` namespace 存储日志文案
3. THE ActionLog SHALL 支持中文和英文两种语言
4. WHEN 卡牌名称是 i18n key（包含 `.`），THE ActionLog SHALL 标记 `previewTextNs` 为 `game-cardia`
5. WHEN 参数包含 i18n key，THE ActionLog SHALL 在 `paramI18nKeys` 中标记需要翻译的参数

### Requirement 5: 卡牌预览支持

**User Story:** 作为玩家，我想要在日志中悬停卡牌名称时看到卡牌预览，以便快速查看卡牌信息。

#### Acceptance Criteria

1. THE ActionLog SHALL 使用 `card` 类型的 segment 显示卡牌信息
2. THE ActionLog SHALL 包含 `cardId`、`previewText`、`previewRef` 字段
3. THE ActionLog SHALL 使用 `getCardiaCardPreviewRef` 函数获取卡牌预览引用
4. WHEN 卡牌名称是 i18n key，THE ActionLog SHALL 设置 `previewTextNs` 字段
5. WHEN 卡牌没有预览引用，THE ActionLog SHALL fallback 到纯文本显示

### Requirement 6: 遭遇位置显示

**User Story:** 作为玩家，我想要在日志中看到遭遇位置信息，以便理解操作发生在哪个遭遇。

#### Acceptance Criteria

1. THE ActionLog SHALL 显示遭遇位置（slot 0、slot 1、slot 2）
2. THE ActionLog SHALL 使用 i18n key 翻译遭遇位置名称
3. WHEN 卡牌打出事件发生，THE ActionLog SHALL 显示目标遭遇位置
4. WHEN 遭遇结算事件发生，THE ActionLog SHALL 显示结算的遭遇位置

### Requirement 7: 印戒信息显示

**User Story:** 作为玩家，我想要在日志中看到印戒授予和移动信息，以便追踪胜利进度。

#### Acceptance Criteria

1. WHEN 印戒授予事件发生，THE ActionLog SHALL 显示玩家、卡牌和新的印戒总数
2. WHEN 印戒移动事件发生，THE ActionLog SHALL 显示源卡牌、目标卡牌和遭遇位置
3. WHEN 印戒移除事件发生，THE ActionLog SHALL 显示卡牌和玩家
4. WHEN 额外印戒放置事件发生，THE ActionLog SHALL 显示卡牌和玩家

### Requirement 8: 修正标记信息显示

**User Story:** 作为玩家，我想要在日志中看到修正标记的放置和移除信息，以便理解影响力变化。

#### Acceptance Criteria

1. WHEN 修正标记放置事件发生，THE ActionLog SHALL 显示卡牌和数值
2. WHEN 修正标记移除事件发生，THE ActionLog SHALL 显示卡牌
3. WHEN 修正标记添加命令执行，THE ActionLog SHALL 记录添加操作
4. WHEN 修正标记移除命令执行，THE ActionLog SHALL 记录移除操作

### Requirement 9: 持续能力信息显示

**User Story:** 作为玩家，我想要在日志中看到持续能力的放置和移除信息，以便理解场上效果。

#### Acceptance Criteria

1. WHEN 持续能力放置事件发生，THE ActionLog SHALL 显示能力名称、卡牌和效果类型
2. WHEN 持续能力移除事件发生，THE ActionLog SHALL 显示能力名称和卡牌
3. WHEN 持续能力影响特定遭遇，THE ActionLog SHALL 显示遭遇索引
4. WHEN 持续能力是条件性效果，THE ActionLog SHALL 标记条件性标志

### Requirement 10: 撤回功能支持

**User Story:** 作为玩家，我想要撤回某些操作，以便纠正误操作。

#### Acceptance Criteria

1. THE Cardia_System SHALL 定义 `UNDO_ALLOWLIST` 包含可撤回的命令
2. THE Cardia_System SHALL 只对白名单命令创建撤回快照
3. THE Cardia_System SHALL 包含 `PLAY_CARD` 在撤回白名单中
4. THE Cardia_System SHALL 包含 `ACTIVATE_ABILITY` 在撤回白名单中
5. THE Cardia_System SHALL 排除系统命令和连锁命令（如 `SYS_INTERACTION_RESPOND`）

### Requirement 11: 时间戳和排序

**User Story:** 作为玩家，我想要看到按时间顺序排列的日志，以便理解事件发生顺序。

#### Acceptance Criteria

1. THE ActionLog SHALL 为每个条目分配时间戳
2. THE ActionLog SHALL 确保事件时间戳大于命令时间戳
3. THE ActionLog SHALL 支持 newest-first 排序
4. WHEN 多个事件在同一命令中产生，THE ActionLog SHALL 使用递增的时间戳偏移

### Requirement 12: 卡牌预览辅助函数

**User Story:** 作为开发者，我想要有统一的卡牌预览获取函数，以便在日志中显示卡牌信息。

#### Acceptance Criteria

1. THE Cardia_System SHALL 提供 `getCardiaCardPreviewRef` 函数
2. THE Cardia_System SHALL 从 `cardRegistry` 查找卡牌定义
3. THE Cardia_System SHALL 返回卡牌名称和预览引用
4. WHEN 卡牌不存在，THE Cardia_System SHALL 返回 null
5. THE Cardia_System SHALL 注册卡牌预览获取函数到全局注册表

### Requirement 13: 格式化函数实现

**User Story:** 作为开发者，我想要有清晰的格式化函数实现，以便维护和扩展日志功能。

#### Acceptance Criteria

1. THE Cardia_System SHALL 实现 `formatCardiaActionEntry` 函数
2. THE Cardia_System SHALL 接收 `command`、`state`、`events` 参数
3. THE Cardia_System SHALL 返回 `ActionLogEntry` 或 `ActionLogEntry[]` 或 `null`
4. THE Cardia_System SHALL 使用 `i18nSeg` 工厂函数创建 i18n segment
5. THE Cardia_System SHALL 使用 `buildCardSegment` 函数创建卡牌 segment
6. THE Cardia_System SHALL 为每个条目生成唯一 ID

### Requirement 14: 文件结构和组织

**User Story:** 作为开发者，我想要有清晰的文件结构，以便快速定位和修改代码。

#### Acceptance Criteria

1. THE Cardia_System SHALL 创建 `src/games/cardia/actionLog.ts` 文件
2. THE Cardia_System SHALL 在 `game.ts` 中导入和配置 ActionLogSystem
3. THE Cardia_System SHALL 导出 `ACTION_ALLOWLIST` 和 `UNDO_ALLOWLIST`
4. THE Cardia_System SHALL 导出 `formatCardiaActionEntry` 函数
5. THE Cardia_System SHALL 创建 `src/games/cardia/ui/cardPreviewHelper.ts` 文件（如果不存在）

### Requirement 15: 测试覆盖

**User Story:** 作为开发者，我想要有完整的测试覆盖，以便确保日志功能正确性。

#### Acceptance Criteria

1. THE Cardia_System SHALL 提供单元测试验证格式化函数
2. THE Cardia_System SHALL 提供单元测试验证白名单配置
3. THE Cardia_System SHALL 提供单元测试验证 i18n segment 生成
4. THE Cardia_System SHALL 提供单元测试验证卡牌 segment 生成
5. THE Cardia_System SHALL 提供 E2E 测试验证日志在 UI 中正确显示

