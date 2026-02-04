# Requirements Document

## Introduction

本需求文档旨在优化 DiceThrone 游戏的音效配置，解决当前存在的语义不匹配和音效缺失问题。

**当前问题分析：**
1. **CP 音效问题**：`cp_gain` 和 `cp_spend` 都使用 `Small_Coin_Drop_001.ogg`（硬币音效），这与 CP 作为"战斗能量"的概念不符
2. **卡牌售卖音效问题**：`card_sell` 也使用相同的硬币音效 `Small_Coin_Drop_001.ogg`，导致 CP 变化和卡牌售卖听起来一样
3. **语义混淆**：硬币音效暗示"货币交易"，但 CP 是战斗能量系统，不是货币系统
4. **技能音效缺失**：虽然音效系统支持技能级别的 `sfxKey` 配置，但当前所有技能定义（包括终极技能）都没有配置专属音效

**优化目标：**
- 为 CP 系统选择符合"能量"概念的通用音效（所有角色共享）
- 确保 CP 音效与卡牌售卖音效有明显区分
- 为 Monk 角色的关键技能（特别是终极技能）添加符合拳脚风格的专属音效
- 所有音效必须从现有音效列表中选择
- 建立技能音效配置的最佳实践，便于未来为其他角色添加音效

## Glossary

- **CP (Combat Points)**: 战斗能量点数，是 DiceThrone 游戏中的通用资源系统，用于激活技能和卡牌效果
- **Audio Config**: 音效配置文件，定义游戏中所有音效的映射关系
- **Sound Effect (SFX)**: 音效，游戏中的短音频片段，用于反馈玩家操作或游戏事件
- **Semantic Matching**: 语义匹配，指音效的含义与其所代表的游戏机制相符
- **Cross-Character Compatibility**: 跨角色兼容性，指某些通用系统音效（如 CP、UI 音效）能够适用于所有角色，而技能音效则应该根据角色风格定制
- **Audio System**: 音频系统，负责管理和播放游戏音效的框架
- **Event Sound Map**: 事件音效映射表，将游戏事件与对应音效关联的配置
- **sfxKey**: 音效键，在技能或效果定义中指定专属音效的字段
- **Ultimate Ability**: 终极技能，游戏中最强大的技能，通常需要特殊条件触发

## Requirements

### Requirement 1: CP 音效替换

**User Story:** 作为玩家，我希望 CP 获得和消耗时播放符合"能量"概念的音效，而不是硬币音效，这样能更好地理解 CP 的战斗能量属性。

#### Acceptance Criteria

1. WHEN CP 增加时，THE Audio System SHALL 播放表示能量充能或增强的音效
2. WHEN CP 减少时，THE Audio System SHALL 播放表示能量消耗或释放的音效
3. THE 新选择的 CP 音效 SHALL 不包含任何货币相关的语义（如硬币、金钱等）
4. THE 新选择的 CP 音效 SHALL 与卡牌售卖音效有明显区分
5. THE 新选择的 CP 音效 SHALL 适用于所有角色风格（不局限于特定主题）
6. THE 新选择的 CP 音效 SHALL 从现有音效列表中选择

### Requirement 2: 技能音效配置

**User Story:** 作为玩家，我希望 Monk 角色的关键技能（特别是终极技能）有符合拳脚风格的专属音效反馈，这样能更好地感受技能的威力和特殊性。

#### Acceptance Criteria

1. WHEN Monk 的终极技能激活时，THE Audio System SHALL 播放符合拳脚风格的强力音效
2. WHEN Monk 的其他关键技能激活时，THE Audio System SHALL 播放符合拳脚风格的合适音效
3. THE 技能音效 SHALL 通过在技能定义中添加 `sfxKey` 字段来配置
4. THE 技能音效 SHALL 与通用的 `ability_activate` 音效有明显区分
5. THE 技能音效 SHALL 从现有音效列表中选择
6. THE 技能音效配置方法 SHALL 可复用于未来其他角色（如剑士、法师等）

### Requirement 3: 音效语义审查

**User Story:** 作为开发者，我希望审查当前所有音效配置，识别其他可能存在的语义不匹配问题。

#### Acceptance Criteria

1. WHEN 审查音效配置时，THE System SHALL 检查每个音效是否符合其对应游戏机制的语义
2. THE System SHALL 识别使用相同音效文件的不同游戏事件
3. THE System SHALL 评估音效是否具有跨角色风格的通用性
4. THE System SHALL 记录所有发现的语义不匹配或重复使用问题
5. IF 发现问题，THEN THE System SHALL 提供优化建议

### Requirement 4: 音效配置更新

**User Story:** 作为开发者，我希望更新音效配置文件，应用所有审查后确定的音效替换方案。

#### Acceptance Criteria

1. WHEN 更新音效配置时，THE System SHALL 修改 `src/games/dicethrone/audio.config.ts` 文件
2. WHEN 添加技能音效时，THE System SHALL 修改对应的技能定义文件（如 `src/games/dicethrone/monk/abilities.ts`）
3. THE 更新后的配置 SHALL 保持与现有代码结构的兼容性
4. THE 更新后的配置 SHALL 包含清晰的注释说明每个音效的用途和选择理由
5. THE 所有新音效路径 SHALL 指向现有音效资源（从音效列表中选择）
6. THE 更新 SHALL 不影响其他正常工作的音效配置
7. THE 更新后的音效文件路径 SHALL 使用 compressed 目录下的压缩版本

### Requirement 5: 音效测试验证

**User Story:** 作为开发者，我希望验证新音效配置在游戏中的实际效果，确保音效播放正常且语义匹配。

#### Acceptance Criteria

1. WHEN 测试 CP 音效时，THE System SHALL 在 CP 变化时正确播放对应音效
2. WHEN 测试技能音效时，THE System SHALL 在技能激活时正确播放专属音效
3. WHEN 测试其他更新的音效时，THE System SHALL 在对应事件触发时正确播放音效
4. THE 测试 SHALL 覆盖所有被修改的音效项
5. THE 测试 SHALL 验证音效的音量平衡是否合适
6. THE 测试 SHALL 验证 CP 音效与卡牌售卖音效是否有明显区分
7. THE 测试 SHALL 验证技能音效与通用 ability_activate 音效是否有明显区分
8. IF 发现音效播放异常或语义仍不匹配，THEN THE System SHALL 记录问题并提供修复建议

### Requirement 6: 文档更新

**User Story:** 作为开发者，我希望更新相关文档，记录音效优化的决策和理由，便于未来维护。

#### Acceptance Criteria

1. THE 文档 SHALL 记录每个被替换音效的原因和新音效的选择理由
2. THE 文档 SHALL 记录技能音效的配置方法和最佳实践
3. THE 文档 SHALL 包含音效语义匹配的指导原则
4. THE 文档 SHALL 说明如何为新游戏机制选择合适的音效
5. THE 文档 SHALL 记录音效资源的组织结构和命名规范
6. THE 文档 SHALL 包含音效审查的检查清单
