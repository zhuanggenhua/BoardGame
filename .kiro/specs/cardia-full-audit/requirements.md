# Requirements Document

## Introduction

本文档定义 Cardia 游戏的全面审计需求。Cardia 是一款 2 人对战卡牌游戏，玩家通过打出角色卡牌进行影响力比拼，首先获得 5 个印戒的玩家获胜。游戏已实现基础功能和 Deck I 的 16 张卡牌，现需要按照 `docs/ai-rules/testing-audit.md` 中的 D1-D49 维度进行系统性审计，发现并修复潜在的实现缺陷。

审计目标：
- 覆盖所有已实现的卡牌、能力、交互链、状态管理
- 发现描述与实现不一致、时序问题、组合场景问题等缺陷
- 补充缺失的测试覆盖（GameTestRunner + E2E）
- 确保代码质量达到"百游戏"标准

## Glossary

- **Cardia**: 游戏名称，卡迪亚
- **Encounter**: 遭遇，一次双方同时打出卡牌的回合
- **Influence**: 影响力，卡牌的战斗力数值
- **Signet**: 印戒，胜利标记，放置在获胜的卡牌上
- **Ability**: 能力，卡牌的特殊效果
- **Instant_Ability**: 即时能力（⚡），立即执行效果后结束
- **Ongoing_Ability**: 持续能力（🔄），放置持续标记，效果持续生效
- **Modifier**: 修正标记，用于增减影响力（+1, +3, +5, -1, -3, -5）
- **Deck_I**: 牌组变体 I，包含 16 张角色卡（影响力 1-16）
- **Faction**: 派系，四大派系：沼泽（Swamp）、学院（Academy）、公会（Guild）、王朝（Dynasty）
- **D1-D49**: 测试审计维度，定义在 `docs/ai-rules/testing-audit.md`

## Requirements

### Requirement 1: 描述→实现全链路审查（D1）

**User Story:** 作为开发者，我希望所有卡牌能力的实现与描述完全一致，以确保游戏规则正确性。

#### Acceptance Criteria

1. THE Audit_System SHALL 对所有 Deck I 卡牌（16 张）执行描述→实现全链路审查
2. WHEN 发现描述与实现不一致时，THE Audit_System SHALL 记录差异并生成修复建议
3. THE Audit_System SHALL 检查以下子维度：
   - 语义保真：实现是否忠实于权威描述（多做/少做/做错）
   - 实体筛选范围：筛选操作的范围是否与描述中的范围限定词一致（"本基地" vs "其他基地" vs "所有基地"）
   - 替代/防止语义：描述包含"防止""改为""而不是"语义的能力是否正确实现
   - 力量修正主语：力量修正的主语是否与描述一致（"你 +N 力量" vs "随从 +N 力量"）
4. THE Audit_System SHALL 输出审查矩阵（卡牌 × 子维度），标注每个检查点的状态（✅/❌/⚠️）

### Requirement 2: 验证-执行前置条件对齐（D2）

**User Story:** 作为开发者，我希望验证层和执行层的前置条件完全一致，以防止非法操作通过验证。

#### Acceptance Criteria

1. THE Audit_System SHALL 检查所有能力的验证层（validate.ts）和执行层（execute.ts）前置条件是否对齐
2. THE Audit_System SHALL 检查以下子维度：
   - 边界完整：所有限定条件是否全程约束
   - 概念载体覆盖：游戏术语在数据层的所有承载形式是否都被筛选覆盖
   - 打出约束：ongoing 行动卡的打出约束是否在数据定义、验证层、UI 层三层体现
   - 额度授予约束：额外出牌额度的约束条件是否在 payload、reduce、validate、UI 四层体现
3. WHEN 发现验证层允许但执行层拒绝的操作时，THE Audit_System SHALL 标记为高优先级缺陷
4. WHEN 发现执行层允许但验证层拒绝的操作时，THE Audit_System SHALL 标记为中优先级缺陷

### Requirement 3: 引擎 API 调用契约审计（D3）

**User Story:** 作为开发者，我希望所有引擎 API 调用符合契约要求，以确保数据流闭环。

#### Acceptance Criteria

1. THE Audit_System SHALL 检查定义→注册→执行→状态→验证→UI→i18n→测试的完整闭环
2. THE Audit_System SHALL 检查以下子维度：
   - 写入→读取 ID 一致性：事件写入的字段名与消费点读取的字段名是否一致
   - 引擎 API 调用契约：调用 `createSimpleChoice`/`grantExtraMinion` 等 API 时参数是否完整
   - 注册表完整性：所有能力是否已注册到 `abilityRegistry` 和 `abilityExecutorRegistry`
3. THE Audit_System SHALL 使用 `ability-registry-completeness.test.ts` 验证注册表完整性
4. THE Audit_System SHALL 使用 `verify-executors.test.ts` 验证执行器注册完整性

### Requirement 4: 交互模式语义匹配（D5）

**User Story:** 作为开发者，我希望所有玩家决策点都有对应的 UI 交互，且交互模式与描述语义匹配。

#### Acceptance Criteria

1. THE Audit_System SHALL 检查所有"你可以"/"选择"等描述是否有对应的交互创建
2. THE Audit_System SHALL 检查以下子维度：
   - 交互完整：玩家决策点是否都有对应 UI
   - 交互模式语义匹配：交互类型（选择卡牌 vs 确认按钮）是否与描述一致
   - 实现模式匹配：额度授予 vs 交互选择的选择是否与描述语义一致
   - UI 组件唯一来源：同类 UI 功能是否复用唯一组件（如 `CardSelectionModal`）
3. THE Audit_System SHALL 检查交互选项的 `displayMode` 声明是否完整（D46）
4. THE Audit_System SHALL 检查交互选项的动态刷新是否正确（D37）

### Requirement 5: 副作用传播完整性（D6）

**User Story:** 作为开发者，我希望新增效果能正确触发已有机制的连锁反应。

#### Acceptance Criteria

1. THE Audit_System SHALL 检查所有能力的副作用是否正确传播
2. THE Audit_System SHALL 检查以下场景：
   - 弃牌能力是否触发"弃牌时"触发器
   - 修正标记添加是否触发"影响力变化时"触发器
   - 印戒移动是否触发"印戒变化时"触发器
   - 持续标记移除是否触发"持续效果失效时"的状态重算
3. THE Audit_System SHALL 使用 GameTestRunner 验证副作用传播的完整性

### Requirement 6: 验证层有效性门控（D7）

**User Story:** 作为开发者，我希望有代价的能力在必然无效果时被验证层拒绝。

#### Acceptance Criteria

1. THE Audit_System SHALL 检查所有有代价的能力（消耗充能/魔力/弃牌等）是否有有效性门控
2. WHEN 能力的所有可能效果都无法产生时，THE Validate_Layer SHALL 拒绝激活
3. THE Audit_System SHALL 检查以下场景：
   - 弃牌能力在手牌为空时是否被拒绝
   - 修正能力在场上无卡牌时是否被拒绝
   - 复制能力在无可复制目标时是否被拒绝
4. THE Audit_System SHALL 检查 `quickCheck` 与 `customValidator` 的前置条件是否对齐

### Requirement 7: 引擎批处理时序与 UI 交互对齐（D8）

**User Story:** 作为开发者，我希望引擎批处理时序与 UI 异步交互正确对齐，避免时序问题。

#### Acceptance Criteria

1. THE Audit_System SHALL 检查所有能力的触发顺序和生命周期是否正确
2. THE Audit_System SHALL 检查以下子维度：
   - 阶段结束技能时序：阶段结束时需要玩家确认的技能是否正确阻止阶段推进
   - 事件产生门控普适性：门控函数是否对所有同类技能生效（禁止硬编码特定 abilityId）
   - 写入-消费窗口对齐：状态写入时机是否在消费窗口内（写入后是否有机会被消费）
   - 交互解决后自动推进：交互解决后是否自动恢复流程推进（D8.4）
   - 多系统协作优先级：同批事件的处理顺序是否导致状态驱动检查误触发
3. THE Audit_System SHALL 使用 `auto-advance-after-interaction.test.ts` 验证自动推进机制
4. THE Audit_System SHALL 使用 `court-guard-turn-advance.test.ts` 验证阶段推进时序

### Requirement 8: Reducer 消耗路径审计（D11-D14）

**User Story:** 作为开发者，我希望 reducer 的消耗路径、写入-消耗对称、多来源竞争、回合清理都正确实现。

#### Acceptance Criteria

1. THE Audit_System SHALL 检查所有事件的 reducer 消耗路径是否正确
2. THE Audit_System SHALL 检查以下维度：
   - D11 Reducer 消耗路径：事件写入的资源/额度/状态在 reducer 消耗时走的分支是否正确
   - D12 写入-消耗对称：能力/事件写入的字段在所有消费点是否被正确读取和消耗
   - D13 多来源竞争：同一资源有多个写入来源时，消耗逻辑是否正确区分来源
   - D14 回合清理完整：回合/阶段结束时临时状态是否全部正确清理
3. THE Audit_System SHALL 使用 `reduce.test.ts` 验证 reducer 逻辑正确性
4. THE Audit_System SHALL 使用 `reduce-encounter-fix.test.ts` 验证遭遇结算逻辑

### Requirement 9: UI 状态同步与门控（D15）

**User Story:** 作为开发者，我希望 UI 展示的数值/状态与 core 状态完全一致。

#### Acceptance Criteria

1. THE Audit_System SHALL 检查所有 UI 组件读取的字段是否与 reducer 实际写入的字段一致
2. THE Audit_System SHALL 检查以下子维度：
   - UI 状态同步：UI 展示的数值/状态是否与 core 状态一致
   - UI 计算参考点：UI 计算参考点是否与描述语义一致
   - UI 交互门控：UI 交互门控是否与 validate 合法路径对齐
   - UI 门控系统优先级：多个独立的 UI 门控系统是否存在优先级冲突（D38）
3. THE Audit_System SHALL 检查 `Board.tsx` 中的状态读取是否正确
4. THE Audit_System SHALL 检查 UI 组件中的 `disabled*`/`*DisabledUids` 计算是否正确

### Requirement 10: 组合场景测试（D19）

**User Story:** 作为开发者，我希望两个独立正确的机制组合使用时仍然正确。

#### Acceptance Criteria

1. THE Audit_System SHALL 识别所有可能的组合场景
2. THE Audit_System SHALL 检查以下组合场景：
   - 持续能力 + 修正标记的叠加效果
   - 多个能力同时触发的优先级
   - 能力链式反应（如调解人移除印戒后触发其他效果）
   - 复制能力 + 被复制能力的交互
   - 弃牌能力 + 牌库为空的边界条件
3. THE Audit_System SHALL 使用 `integration-ongoing-abilities.test.ts` 验证持续能力组合
4. THE Audit_System SHALL 使用 `integration-ability-copy.test.ts` 验证复制能力组合

### Requirement 11: 状态可观测性（D20）

**User Story:** 作为玩家，我希望能从 UI 上区分不同来源的资源/额度/状态。

#### Acceptance Criteria

1. THE Audit_System SHALL 检查所有状态是否在 UI 上可观测
2. THE Audit_System SHALL 检查以下场景：
   - 修正标记的来源是否可追溯（哪张卡牌添加的）
   - 持续能力的效果是否可见（持续标记显示）
   - 印戒的归属是否清晰（放置在哪张卡牌上）
   - 影响力的计算过程是否可见（基础值 + 修正标记）
3. THE Audit_System SHALL 检查 UI 组件是否提供足够的视觉反馈

### Requirement 12: 交互链完整性（D24, D35, D36, D37）

**User Story:** 作为开发者，我希望交互链的创建、解决、上下文传递都正确实现。

#### Acceptance Criteria

1. THE Audit_System SHALL 检查所有交互链的完整性
2. THE Audit_System SHALL 检查以下维度：
   - D24 Handler 共返状态一致性：交互 handler 同时返回 events 和新 interaction 时，新 interaction 的选项是否基于 events 已生效后的状态计算
   - D35 交互上下文快照完整性：交互创建时是否保存了所有必要的上下文信息到 `continuationContext`
   - D36 延迟事件补发的健壮性：延迟事件的补发是否依赖脆弱的条件
   - D37 交互选项动态刷新完整性：同时触发多个交互时，后续交互的选项是否自动刷新
3. THE Audit_System SHALL 使用 `interaction.test.ts` 验证交互系统基础功能
4. THE Audit_System SHALL 使用 `governess-copy-logic.test.ts` 验证复杂交互链

### Requirement 13: 流程控制标志清除完整性（D39）

**User Story:** 作为开发者，我希望流程控制标志的清除条件完整，避免卡住问题。

#### Acceptance Criteria

1. THE Audit_System SHALL 检查所有流程控制标志（`flowHalted`/`isProcessing`/`isPending`）的清除条件
2. THE Audit_System SHALL 检查以下场景：
   - 守卫逻辑是否同时检查标志和背后的状态（如 `flowHalted && sys.interaction.current`）
   - 所有退出路径（正常/取消/错误/超时）是否都正确清除标志
   - 多个系统共享同一标志时，标志所有权是否明确
3. THE Audit_System SHALL 使用 `court-guard-turn-advance.test.ts` 验证流程控制标志清除

### Requirement 14: 后处理循环事件去重完整性（D40）

**User Story:** 作为开发者，我希望后处理循环中的事件去重逻辑正确，避免重复触发。

#### Acceptance Criteria

1. THE Audit_System SHALL 检查所有后处理循环中的去重集合构建是否正确
2. THE Audit_System SHALL 检查以下场景：
   - 去重集合是否从输入事件构建（而非输出事件）
   - 循环中去重集合是否正确更新（累加新处理的事件）
   - 循环不变式是否正确维护
3. THE Audit_System SHALL 使用 `reduce.test.ts` 验证后处理循环逻辑

### Requirement 15: 交互选项 UI 渲染模式完整性（D46, D48）

**User Story:** 作为开发者，我希望所有交互选项都显式声明 `displayMode`，确保 UI 渲染正确。

#### Acceptance Criteria

1. THE Audit_System SHALL 检查所有交互选项是否显式声明 `displayMode`
2. THE Audit_System SHALL 检查以下场景：
   - 卡牌选择交互是否声明 `displayMode: 'card'`
   - 确认/取消交互是否声明 `displayMode: 'button'`
   - 选项的 `value` 字段是否包含会被 UI 误判的字段（`defId`/`cardUid`）
3. THE Audit_System SHALL 使用静态扫描工具检查所有 `createSimpleChoice` 调用
4. THE Audit_System SHALL 使用 E2E 测试验证 UI 渲染是否符合预期

### Requirement 16: abilityTags 与触发机制一致性（D49）

**User Story:** 作为开发者，我希望卡牌定义的 `abilityTags` 与实际触发机制一致，避免 UI 错误高亮。

#### Acceptance Criteria

1. THE Audit_System SHALL 检查所有卡牌的 `abilityTags` 是否与实际触发机制一致
2. THE Audit_System SHALL 检查以下场景：
   - 主动激活能力是否有 `abilityTags: ['special']`
   - 被动触发器（`beforeScoring`/`afterScoring`/`onMinionDestroyed` 等）是否没有 `abilityTags: ['special']`
   - 混合模式（既有主动又有被动）是否正确拆分或使用条件判断
3. THE Audit_System SHALL 使用 Property 测试遍历所有 special 卡牌，检查是否有对应的处理器

### Requirement 17: E2E 测试覆盖完整性（D47）

**User Story:** 作为开发者，我希望 E2E 测试覆盖完整的命令执行流程，而不仅仅是引擎层。

#### Acceptance Criteria

1. THE Audit_System SHALL 检查所有关键交互路径是否有 E2E 测试覆盖
2. THE Audit_System SHALL 检查以下场景：
   - 所有 Deck I 卡牌（16 张）是否都有 E2E 测试
   - 关键交互路径（onPlay/onDestroy/响应窗口/交互链）是否有 E2E 测试
   - E2E 测试是否使用 `GameTestContext` API（而非旧的 helper 函数）
3. THE Audit_System SHALL 使用 `e2e/cardia-deck1-card*.e2e.ts` 验证 E2E 测试覆盖
4. THE Audit_System SHALL 确保所有 E2E 测试使用联机模式（`setupOnlineMatch`）

### Requirement 18: 测试工具选型与覆盖

**User Story:** 作为开发者，我希望使用正确的测试工具覆盖不同层级的功能。

#### Acceptance Criteria

1. THE Audit_System SHALL 使用 GameTestRunner 覆盖引擎层逻辑（命令序列 + 状态断言）
2. THE Audit_System SHALL 使用 E2E 测试覆盖完整的命令执行流程（WebSocket 同步 + UI 交互）
3. THE Audit_System SHALL 使用 Property 测试覆盖数据定义契约（结构完整性 + 语义正确性）
4. THE Audit_System SHALL 使用 `entityIntegritySuite` 覆盖实体引用链验证（≥20 实体时必选）
5. THE Audit_System SHALL 使用 `interactionChainAudit` 覆盖 UI 状态机 payload 覆盖（多步 UI 交互时必选）
6. THE Audit_System SHALL 使用 `interactionCompletenessAudit` 覆盖 Interaction handler 注册覆盖（有 InteractionSystem 时必选）

### Requirement 19: 审计输出与修复跟踪

**User Story:** 作为开发者，我希望审计输出清晰的问题列表和修复建议，便于跟踪修复进度。

#### Acceptance Criteria

1. THE Audit_System SHALL 输出审计报告，包含以下内容：
   - 问题列表（按优先级排序：P0/P1/P2）
   - 每个问题的详细描述（卡牌/能力/代码位置/根因分析）
   - 修复建议（具体的代码修改方案）
   - 测试覆盖情况（已有测试/缺失测试）
2. THE Audit_System SHALL 输出审查矩阵（卡牌 × 维度），标注每个检查点的状态（✅/❌/⚠️）
3. THE Audit_System SHALL 输出修复跟踪表，记录每个问题的修复状态（未修复/修复中/已修复/已验证）
4. THE Audit_System SHALL 在所有问题修复后，重新运行审计验证修复效果

### Requirement 20: 审计自动化与 CI 集成

**User Story:** 作为开发者，我希望审计过程尽可能自动化，并集成到 CI 流程中。

#### Acceptance Criteria

1. THE Audit_System SHALL 提供自动化审计脚本，可一键运行所有审计检查
2. THE Audit_System SHALL 提供静态扫描工具，检查以下内容：
   - 所有 `createSimpleChoice` 调用是否显式声明 `displayMode`
   - 所有 ongoing 行动卡是否有 `playConstraint` 声明（如果描述中有条件性打出目标）
   - 所有 `grantExtraMinion`/`grantExtraAction` 调用是否包含完整的约束 payload
3. THE Audit_System SHALL 集成到 CI 流程中，PR 必须通过审计检查才能合并
4. THE Audit_System SHALL 在审计失败时提供清晰的错误信息和修复建议

