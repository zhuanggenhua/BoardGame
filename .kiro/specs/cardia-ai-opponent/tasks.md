# Implementation Plan: Cardia AI Opponent

## Overview

本实现计划将 Cardia AI 对手系统的设计方案拆解为可执行的编码任务。系统将复用引擎层 AI 框架 (`src/engine/ai/`)，实现基于策略标签的可配置决策行为。核心包括：合法动作生成、策略标签系统、启发式评分、预设策略配置。

实现将按 6 个阶段推进：基础架构 → 合法动作生成 → 策略标签系统 → 评分系统 → 决策策略 → 测试和优化。

## Tasks

- [x] 1. Phase 1: 基础架构
  - [x] 1.1 创建 AI Runtime 入口文件
    - 创建 `src/games/cardia/ai.ts`
    - 实现 `GameAiRuntime` 接口骨架
    - 定义 `cardiaAiRuntime` 导出对象（包含 `gameId`、`buildLegalActions`、`localPolicies`、`defaultLocalPolicyId`）
    - 注册到引擎 AI 运行时（确认注册机制）
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 定义核心类型
    - 在 `src/games/cardia/ai.ts` 或独立类型文件中定义 `CardiaStrategyTag` 类型（5 种标签）
    - 定义 `CardiaStrategyProfile` 接口（继承 `AiStrategyProfile<CardiaStrategyTag>`）
    - 定义 `CardiaActionMetadata` 接口（包含打牌、能力、交互选择的元数据字段）
    - _Requirements: 5.1, 6.2, 6.3_

- [x] 2. Phase 2: 合法动作生成
  - [x] 2.1 实现主动作生成函数
    - 实现 `buildCardiaAiLegalActions(args: BuildGameAiLegalActionsArgs): AiLegalAction[]`
    - 检查交互状态，优先返回交互动作
    - 根据游戏阶段（`core.phase`）分发到对应子函数
    - 使用 `createAiLegalActionId` 生成唯一动作 ID
    - _Requirements: 11.1, 11.2, 11.6_

  - [x] 2.2 实现打牌动作生成
    - 实现 `buildPlayCardActions(core: CardiaCore, playerId: PlayerId): AiLegalAction[]`
    - 枚举当前玩家手牌中所有卡牌
    - 为每张卡牌生成打牌动作（包含 `PLAY_CARD` 命令）
    - 根据卡牌影响力和能力数量附加策略标签（高影响力 → `aggro`，有能力 → `value`）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 8.6, 8.7, 11.3_

  - [x] 2.3 实现能力动作生成
    - 实现 `buildAbilityActions(core: CardiaCore, playerId: PlayerId): AiLegalAction[]`
    - 检查输掉遭遇战的卡牌是否有可激活能力
    - 为每个能力生成激活动作（包含 `ACTIVATE_ABILITY` 命令）
    - 生成跳过能力动作（包含 `SKIP_ABILITY` 命令）
    - 根据能力类型附加策略标签（即时 → `tempo`，持续 → `value`，跳过 → `economy`）
    - _Requirements: 3.1, 3.2, 3.4, 3.6, 9.5, 9.6, 9.7, 11.4_

  - [x] 2.4 实现交互动作生成
    - 实现 `buildInteractionActions(state: MatchState<CardiaCore>, playerId: PlayerId): AiLegalAction[] | null`
    - 检查当前交互是否属于 AI 玩家
    - 根据交互类型分发到对应子函数（`simple-choice`、`cardia:choose-card`、`cardia:choose-faction`、`cardia:choose-modifier`）
    - 实现各类交互的选项枚举函数
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 11.5_

- [x] 3. Checkpoint - 验证动作生成
  - 确认所有动作生成函数能够正确枚举合法动作
  - 确认动作 ID 唯一性
  - 确认策略标签正确附加
  - 如有问题请向用户反馈

- [x] 4. Phase 3: 策略标签系统
  - [x] 4.1 定义预设策略配置
    - 在 `src/games/cardia/ai.ts` 中定义 `STRATEGY_PROFILES` 常量对象
    - 实现进攻型策略配置（`aggro`：优先高影响力和即时能力）
    - 实现防守型策略配置（`control`：优先修正标记和控制能力）
    - 实现平衡型策略配置（`balanced`：均衡权重）
    - 每个配置包含 `tags`、`tagWeights`、`summary` 字段
    - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 4.2 集成策略标签工具函数
    - 在动作生成函数中使用 `withAiActionStrategyTags` 附加标签
    - 确认标签附加逻辑符合设计文档中的规则
    - _Requirements: 5.2, 5.3, 5.4_

- [x] 5. Phase 4: 评分系统
  - [x] 5.1 实现卡牌价值评估
    - 实现 `evaluateCardValue(card: CardiaCard, core: CardiaCore, playerId: PlayerId): number`
    - 考虑基础影响力、高影响力奖励、能力数量、派系匹配
    - 使用设计文档中的权重参数（`CARD_VALUE_WEIGHTS`）
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 5.2 实现能力价值评估
    - 实现 `evaluateAbilityValue(abilityId: string, core: CardiaCore, playerId: PlayerId): number`
    - 考虑能力类型（即时/持续）、预期印戒变化、预期影响力变化
    - 使用设计文档中的权重参数（`ABILITY_VALUE_WEIGHTS`）
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 5.3 实现游戏状态评估
    - 实现 `evaluateGameState(core: CardiaCore, playerId: PlayerId): number`
    - 计算印戒差距、手牌数量差距、场上卡牌数量差距、持续能力数量差距
    - 使用设计文档中的权重参数（`STATE_EVAL_WEIGHTS`）
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [x] 5.4 实现打牌动作评分
    - 实现 `scorePlayCardAction(action: AiLegalAction, core: CardiaCore, playerId: PlayerId): number`
    - 调用 `evaluateCardValue` 获取基础分数
    - 考虑当前场面状态和对手可能的卡牌范围
    - _Requirements: 2.5, 7.4, 8.1-8.7_

  - [x] 5.5 实现能力动作评分
    - 实现 `scoreAbilityAction(action: AiLegalAction, core: CardiaCore, playerId: PlayerId): number`
    - 调用 `evaluateAbilityValue` 获取基础分数
    - 考虑能力目标可用性和当前游戏状态
    - _Requirements: 3.3, 7.4, 9.1-9.7_

  - [x] 5.6 实现交互选择评分
    - 实现 `scoreInteractionChoice(action: AiLegalAction, core: CardiaCore, playerId: PlayerId): number`
    - 实现目标选择启发式（修正标记优先接近平局、印戒移除优先对手最多、派系优先场上最多）
    - 使用确定性随机选择处理等价目标
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 5.7 集成 Profile-Aware Scorer
    - 使用 `createProfileAwareActionScorer` 创建评分器
    - 集成自定义启发式评分逻辑（调用 5.4-5.6 实现的函数）
    - 使用 `buildDeterministicAiNoise` 添加随机扰动
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 6. Checkpoint - 验证评分系统
  - 确认评分函数返回合理数值
  - 确认不同策略配置产生不同评分
  - 确认随机扰动正常工作
  - 如有问题请向用户反馈

- [x] 7. Phase 5: 决策策略
  - [x] 7.1 实现 baseline 策略
    - 使用 `createScoredLocalAiPolicy` 创建基础策略
    - 集成 `buildCardiaAiLegalActions` 和评分器
    - 配置默认策略配置（均衡权重）
    - _Requirements: 12.1, 12.2, 12.3, 12.5_

  - [x] 7.2 实现 aggro 策略
    - 基于 `STRATEGY_PROFILES.aggro` 配置创建进攻型策略
    - 确认高影响力卡牌和即时能力得分更高
    - _Requirements: 6.5, 12.5_

  - [x] 7.3 实现 control 策略
    - 基于 `STRATEGY_PROFILES.control` 配置创建防守型策略
    - 确认修正标记和控制能力得分更高
    - _Requirements: 6.5, 12.5_

  - [x] 7.4 实现 balanced 策略
    - 基于 `STRATEGY_PROFILES.balanced` 配置创建平衡型策略
    - 确认各类动作权重均衡
    - _Requirements: 6.5, 12.5_

  - [x] 7.5 实现错误处理和降级
    - 实现动作生成失败时的错误日志
    - 实现动作评分失败时的默认分数处理
    - 实现没有合法动作时返回 null
    - 实现决策超时时选择第一个合法动作
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 7.6 配置决策延迟
    - 在策略配置中添加决策延迟参数（模拟思考时间）
    - _Requirements: 12.6_

- [x] 8. Phase 6: 测试和优化
  - [x]* 8.1 编写单元测试 - 合法动作生成
    - 测试打牌阶段生成正确数量的动作
    - 测试能力阶段生成激活/跳过动作
    - 测试交互阶段生成所有选项
    - 测试动作 ID 唯一性
    - _Requirements: 15.1, 15.3_

  - [x]* 8.2 编写单元测试 - 策略标签
    - 测试高影响力卡牌标记为 `aggro`
    - 测试持续能力标记为 `value`
    - 测试即时能力标记为 `tempo`
    - _Requirements: 15.1, 15.3_

  - [x]* 8.3 编写单元测试 - 评分器
    - 测试 `scoreActionAgainstStrategyProfile` 返回数值
    - 测试不同策略配置产生不同评分
    - 测试启发式评分函数考虑各种因素
    - _Requirements: 15.1, 15.3_

  - [x]* 8.4 编写单元测试 - 辅助函数
    - 测试 `evaluateCardValue` 返回合理值
    - 测试 `evaluateAbilityValue` 考虑能力类型
    - 测试 `evaluateGameState` 计算印戒差距
    - _Requirements: 15.1, 15.3_

  - [x]* 8.5 编写 E2E 测试 - AI 对局
    - 使用 `setupOnlineMatch` 创建 AI vs AI 对局
    - 验证 AI 能够完成完整游戏流程
    - 验证 AI 能够在打牌阶段选择卡牌
    - 验证 AI 能够在能力阶段做出决策
    - 验证 AI 能够处理交互选择
    - 验证 AI 不会生成非法动作
    - _Requirements: 15.2, 15.3, 15.4, 15.5_

  - [ ]* 8.6 编写 E2E 测试 - 策略差异
    - 运行多局 `aggro` vs `control` 对局
    - 验证不同策略产生不同的行为模式
    - 统计胜率和平均回合数
    - _Requirements: 15.2, 15.6_

  - [ ]* 8.7 编写 E2E 测试 - 边界情况
    - 测试手牌为空时的行为
    - 测试无能力可激活时的行为
    - 测试交互无选项时的行为
    - _Requirements: 15.2, 15.3_

  - [ ] 8.8 调优评分参数
    - 根据测试结果调整 `CARD_VALUE_WEIGHTS`
    - 根据测试结果调整 `ABILITY_VALUE_WEIGHTS`
    - 根据测试结果调整 `STATE_EVAL_WEIGHTS`
    - 确保 AI 行为符合预期
    - _Requirements: 7.4_

- [x] 9. Final Checkpoint - 完整验收
  - 确认所有测试通过
  - 确认 AI 能够完成完整对局
  - 确认不同策略产生不同行为
  - 确认错误处理和降级机制正常工作
  - 向用户汇报完成情况

- [x] 10. 启用首页 AI 对手选项
  - [x] 10.1 修改游戏清单配置
    - 在 `src/games/cardia/manifest.ts` 中将 `ai.localAi` 设置为 `true`
    - 确认 `ai.capture` 已启用（用于数据收集）
    - 确认配置符合 `GameManifestAiSupport` 类型定义
    - _Requirements: 用户可见性、可用性_

  - [x] 10.2 验证 UI 集成
    - 确认 `CreateRoomModal` 组件会根据 manifest 配置显示 AI 选项
    - 确认 AI 选项包含"启用 AI 对手"开关和座位选择
    - 确认房间创建时 `seatControllers` 配置正确传递
    - _Requirements: UI 一致性、用户体验_

  - [x] 10.3 代码质量检查
    - 运行 ESLint 确认无错误
    - 创建验证文档记录修改内容
    - _Requirements: 代码质量、可维护性_

## Notes

- 任务标记 `*` 的为可选测试任务，可根据开发进度和时间安排跳过
- 每个任务都引用了具体的需求编号，确保可追溯性
- Checkpoint 任务用于阶段性验收，确保增量开发质量
- 评分参数（权重）可以在测试阶段根据实际表现调优
- 错误处理和降级机制确保 AI 系统在异常情况下仍能稳定运行
- 本实现计划专注于代码编写和测试，不包括部署、文档编写等非编码任务
