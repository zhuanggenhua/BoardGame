# Requirements Document

## Introduction

本需求文档定义了 Cardia 卡组一 E2E 测试优化项目的需求。项目目标是使用新的 `setupCardiaTestScenario` API 重写现有的 16 个卡牌测试，并为每个测试补充完整的回合流程验证，确保测试覆盖从打牌到回合结束的完整游戏流程。

## Glossary

- **E2E 测试 (E2E Test)**: 端到端测试，模拟真实用户操作验证完整功能流程
- **setupCardiaTestScenario**: 新的测试 API，可以通过声明式配置快速创建测试场景
- **完整回合流程 (Full Turn Flow)**: 包含阶段1（打牌）、阶段2（能力激活）、阶段3（回合结束）的完整游戏回合
- **旧 API**: 指 `setupCardiaOnlineMatch` + 手动状态注入的测试方式
- **新 API**: 指 `setupCardiaTestScenario` 声明式配置的测试方式
- **印戒 (Signet)**: 游戏中的胜利点数，达到5个印戒即获胜
- **修正标记 (Modifier Token)**: 临时修改卡牌影响力的标记
- **持续标记 (Ongoing Marker)**: 标记卡牌上有持续生效的能力

## Requirements

### Requirement 1: 使用新 API 重写所有卡牌测试

**User Story:** 作为测试维护者，我希望使用新的 `setupCardiaTestScenario` API 重写所有卡牌测试，以便减少代码量并提高测试可读性。

#### Acceptance Criteria

1. THE Test_Rewriter SHALL 使用 `setupCardiaTestScenario` API 替换所有 16 个卡牌测试中的旧 API
2. WHEN 使用新 API 时，THE Test_Code SHALL 减少至少 60% 的代码行数（从 ~150 行减少到 ~80 行）
3. THE Test_Rewriter SHALL 保持所有现有测试的验证逻辑不变
4. THE Test_Rewriter SHALL 确保所有重写后的测试能够通过
5. THE Test_Rewriter SHALL 为每个测试添加清晰的注释说明测试场景和验证点

### Requirement 2: 补充完整回合流程验证

**User Story:** 作为测试工程师，我希望每个测试都验证完整的回合流程，以便发现阶段推进、印戒放置、抽牌逻辑等方面的 bug。

#### Acceptance Criteria

1. THE Test_Rewriter SHALL 为每个测试补充阶段1验证（打出卡牌）
2. THE Test_Rewriter SHALL 为每个测试补充阶段2验证（影响力比较 → 印戒放置 → 能力激活）
3. THE Test_Rewriter SHALL 为每个测试补充阶段3验证（回合结束 → 抽牌 → 胜利条件检查）
4. WHEN 验证阶段1时，THE Test SHALL 断言双方都打出了卡牌且手牌数量正确减少
5. WHEN 验证阶段2时，THE Test SHALL 断言影响力比较正确、印戒放置在获胜者的牌上、失败者能激活能力
6. WHEN 验证阶段3时，THE Test SHALL 断言双方都抽了1张牌、牌库数量减少、胜利条件检查正确、阶段推进到下一回合

### Requirement 3: 修复 card02 (虚空法师) 测试失败

**User Story:** 作为测试工程师，我希望修复 card02 测试失败问题，以便达到 100% 测试通过率。

#### Acceptance Criteria

1. THE Test_Rewriter SHALL 分析 card02 测试失败的根本原因
2. THE Test_Rewriter SHALL 简化测试场景或使用两轮遭遇来创建有修正标记的场景
3. THE Test_Rewriter SHALL 确保 card02 测试能够稳定通过
4. THE Test_Rewriter SHALL 验证虚空法师能力（移除修正标记和持续标记）正确执行

### Requirement 4: 为关键能力添加特殊验证

**User Story:** 作为测试工程师，我希望为关键能力添加特殊验证，以便确保复杂机制的正确性。

#### Acceptance Criteria

1. WHEN 测试调停者（card04）时，THE Test SHALL 验证平局机制和持续标记放置
2. WHEN 测试占卜师（card06）时，THE Test SHALL 验证揭示顺序变更
3. WHEN 测试傀儡师（card10）时，THE Test SHALL 验证复制能力的完整效果
4. WHEN 测试发明家（card15）时，THE Test SHALL 验证特殊机制的完整流程
5. WHEN 测试精灵（card16）时，THE Test SHALL 验证直接获胜机制（跳过阶段3）

### Requirement 5: 保持测试稳定性和可维护性

**User Story:** 作为测试维护者，我希望测试代码清晰易读且稳定可靠，以便长期维护。

#### Acceptance Criteria

1. THE Test_Rewriter SHALL 为每个测试添加清晰的场景说明注释
2. THE Test_Rewriter SHALL 使用一致的验证模式（初始状态 → 执行操作 → 验证结果）
3. THE Test_Rewriter SHALL 确保所有测试都有适当的超时设置和错误处理
4. THE Test_Rewriter SHALL 确保所有测试都正确清理资源（关闭浏览器上下文）
5. THE Test_Rewriter SHALL 确保测试输出包含清晰的日志信息，便于调试

### Requirement 6: 测试覆盖率要求

**User Story:** 作为质量保证工程师，我希望测试覆盖所有关键场景，以便确保游戏逻辑的正确性。

#### Acceptance Criteria

1. THE Test_Suite SHALL 覆盖所有 16 个卡牌的能力测试
2. THE Test_Suite SHALL 覆盖即时能力（onLose）、持续能力（ongoing）、交互能力（卡牌选择、派系选择）
3. THE Test_Suite SHALL 覆盖修正标记添加和移除
4. THE Test_Suite SHALL 覆盖印戒放置和胜利条件检查
5. THE Test_Suite SHALL 覆盖平局场景和牌库为空场景
6. THE Test_Suite SHALL 达到 100% 测试通过率（16/16）

### Requirement 7: 性能和执行时间要求

**User Story:** 作为 CI/CD 工程师，我希望测试执行时间合理，以便不影响开发效率。

#### Acceptance Criteria

1. THE Test_Suite SHALL 在 5 分钟内完成所有 16 个测试（使用并行执行）
2. WHEN 单个测试失败时，THE Test SHALL 在 30 秒内超时并报告错误
3. THE Test_Rewriter SHALL 使用适当的等待策略（waitForPhase、waitForTimeout）避免不必要的延迟
4. THE Test_Rewriter SHALL 确保测试不会因为过长的等待时间而影响 CI/CD 流水线

### Requirement 8: 文档和示例要求

**User Story:** 作为新加入的开发者，我希望有清晰的文档和示例，以便快速理解测试结构和编写新测试。

#### Acceptance Criteria

1. THE Test_Rewriter SHALL 保留 `cardia-deck1-card03-surgeon-new-api.e2e.ts` 作为新 API 的参考实现
2. THE Test_Rewriter SHALL 确保每个测试文件都有清晰的文件头注释说明测试目标
3. THE Test_Rewriter SHALL 确保测试代码结构一致，便于复制和修改
4. THE Test_Rewriter SHALL 在测试中使用清晰的变量命名和注释

### Requirement 9: 边界条件和异常场景测试

**User Story:** 作为测试工程师，我希望测试覆盖边界条件和异常场景，以便发现潜在的 bug。

#### Acceptance Criteria

1. WHEN 测试破坏者（card05）时，THE Test SHALL 验证对手牌库不足2张时的处理
2. WHEN 测试财务官（card12）时，THE Test SHALL 验证条件满足和不满足两种情况
3. WHEN 测试沼泽守卫（card13）时，THE Test SHALL 验证派系匹配和不匹配两种情况
4. WHEN 测试钟表匠（card11）时，THE Test SHALL 验证回收卡牌后的手牌状态
5. WHEN 牌库为空时，THE Test SHALL 验证游戏不会崩溃且正确触发游戏结束

### Requirement 10: 回归测试保护

**User Story:** 作为项目负责人，我希望测试能够防止回归 bug，以便保持代码质量。

#### Acceptance Criteria

1. THE Test_Suite SHALL 在每次代码变更后自动运行
2. WHEN 测试失败时，THE Test SHALL 提供清晰的错误信息和失败原因
3. THE Test_Suite SHALL 能够检测到阶段推进逻辑的变更
4. THE Test_Suite SHALL 能够检测到印戒放置逻辑的变更
5. THE Test_Suite SHALL 能够检测到抽牌逻辑的变更
6. THE Test_Suite SHALL 能够检测到胜利条件检查逻辑的变更

