# Requirements Document

## Introduction

本规范定义 Cardia 游戏 Deck I (card01-card16) 的全面审计需求，系统性地审查所有卡牌效果实现和 E2E 测试覆盖。审计基于 `.spec/knowledge/standards/testing-audit.md` 的 D1-D49 维度框架，确保实现完整性、测试覆盖完整性和质量标准。

## Glossary

- **Deck I**: Cardia 游戏的 I 牌组，包含 16 张卡牌（影响力 1-16）
- **Ability**: 卡牌能力，分为即时能力（onLose）和持续能力（ongoing）
- **Implementation**: 能力的代码实现，包括 abilityRegistry 定义和 group*.ts 执行器
- **E2E Test**: 端到端测试，验证完整的用户交互流程
- **Audit Dimension**: 审计维度，来自 `.spec/knowledge/standards/testing-audit.md` 的 D1-D49 检查项
- **AUDIT-REPORT.md**: 现有审计报告，位于 `.kiro/specs/cardia-ability-implementation/AUDIT-REPORT.md`

## Requirements

### Requirement 1: 实现完整性审计

**User Story:** 作为开发者，我想要系统性地审查每张卡牌的能力实现，确保代码与规则描述完全一致。

#### Acceptance Criteria

1. THE Audit_System SHALL 对每张卡牌执行 D1（语义保真）检查
2. WHEN 发现描述与实现不一致，THE Audit_System SHALL 记录具体差异和修复建议
3. THE Audit_System SHALL 检查所有能力执行器是否已注册
4. THE Audit_System SHALL 验证能力触发时机与描述一致
5. THE Audit_System SHALL 检查能力效果的目标选择是否正确

### Requirement 2: E2E 测试覆盖审计

**User Story:** 作为开发者，我想要评估现有 E2E 测试是否全面覆盖所有卡牌的核心场景。

#### Acceptance Criteria

1. THE Audit_System SHALL 列出所有现有 E2E 测试文件
2. THE Audit_System SHALL 对每张卡牌评估测试覆盖状态
3. WHEN 卡牌有 E2E 测试，THE Audit_System SHALL 验证测试是否覆盖核心场景
4. WHEN 卡牌缺少 E2E 测试，THE Audit_System SHALL 记录为测试缺口
5. THE Audit_System SHALL 识别测试重复或冗余的情况

### Requirement 3: 测试质量审计

**User Story:** 作为开发者，我想要检查测试是否真正验证了功能正确性，而不是只截图不验证。

#### Acceptance Criteria

1. THE Audit_System SHALL 检查每个 E2E 测试是否包含状态断言
2. WHEN 测试只有截图没有断言，THE Audit_System SHALL 标记为质量问题
3. THE Audit_System SHALL 验证测试是否使用了正确的测试模式（online mode + state injection）
4. THE Audit_System SHALL 检查测试是否验证了最终状态而非中间状态
5. THE Audit_System SHALL 识别"假通过"的测试（测试通过但功能实际有问题）

### Requirement 4: 边界场景审计

**User Story:** 作为开发者，我想要识别缺失的边界测试场景，确保异常情况也被覆盖。

#### Acceptance Criteria

1. THE Audit_System SHALL 对每张卡牌识别关键边界场景
2. THE Audit_System SHALL 检查是否有"无效目标"场景的测试
3. THE Audit_System SHALL 检查是否有"资源不足"场景的测试
4. THE Audit_System SHALL 检查是否有"能力被取消"场景的测试
5. THE Audit_System SHALL 检查是否有"多个能力交互"场景的测试

### Requirement 5: 审计报告生成

**User Story:** 作为开发者，我想要获得结构化的审计报告，清晰展示所有发现的问题和修复建议。

#### Acceptance Criteria

1. THE Audit_System SHALL 生成每张卡牌的审计条目
2. THE Audit_System SHALL 按优先级分类问题（P0/P1/P2）
3. THE Audit_System SHALL 为每个问题提供具体的修复建议
4. THE Audit_System SHALL 生成测试补充计划
5. THE Audit_System SHALL 输出 Markdown 格式的审计报告

### Requirement 6: D1-D49 维度覆盖

**User Story:** 作为开发者，我想要确保审计覆盖 `.spec/knowledge/standards/testing-audit.md` 定义的所有关键维度。

#### Acceptance Criteria

1. THE Audit_System SHALL 应用 D1（语义保真）检查所有能力描述与实现
2. THE Audit_System SHALL 应用 D2（边界完整）检查限定条件
3. THE Audit_System SHALL 应用 D3（数据流闭环）检查定义→注册→执行链路
4. THE Audit_System SHALL 应用 D5（交互完整）检查玩家决策点
5. THE Audit_System SHALL 应用 D7（验证层有效性门控）检查代价操作
6. THE Audit_System SHALL 应用 D47（E2E 测试覆盖完整性）检查测试覆盖
7. THE Audit_System SHALL 记录每个维度的检查结果

### Requirement 7: 现有审计报告整合

**User Story:** 作为开发者，我想要基于现有的 AUDIT-REPORT.md 继续审计，避免重复工作。

#### Acceptance Criteria

1. THE Audit_System SHALL 读取 `.kiro/specs/cardia-ability-implementation/AUDIT-REPORT.md`
2. THE Audit_System SHALL 识别已修复的问题
3. THE Audit_System SHALL 识别仍待修复的问题
4. THE Audit_System SHALL 补充新发现的问题
5. THE Audit_System SHALL 更新审计报告的完成状态

### Requirement 8: 卡牌列表完整性

**User Story:** 作为开发者，我想要确保审计覆盖 Deck I 的所有 16 张卡牌。

#### Acceptance Criteria

1. THE Audit_System SHALL 列出 Deck I 的所有 16 张卡牌
2. THE Audit_System SHALL 验证每张卡牌的能力 ID 与 cardRegistry 一致
3. THE Audit_System SHALL 验证每张卡牌的描述与规则文档一致
4. THE Audit_System SHALL 检查是否有遗漏的卡牌
5. THE Audit_System SHALL 检查是否有重复的卡牌

### Requirement 9: 测试文件命名规范

**User Story:** 作为开发者，我想要确保 E2E 测试文件遵循统一的命名规范。

#### Acceptance Criteria

1. THE Audit_System SHALL 检查测试文件名是否符合 `cardia-deck1-card{NN}-{name}.e2e.ts` 格式
2. WHEN 测试文件名不符合规范，THE Audit_System SHALL 记录为命名问题
3. THE Audit_System SHALL 检查测试文件是否与卡牌编号对应
4. THE Audit_System SHALL 检查是否有孤立的测试文件（对应卡牌不存在）
5. THE Audit_System SHALL 建议重命名不规范的测试文件

### Requirement 10: 审计优先级排序

**User Story:** 作为开发者，我想要根据问题严重程度和影响范围确定修复优先级。

#### Acceptance Criteria

1. THE Audit_System SHALL 将"描述与实现完全不一致"标记为 P0
2. THE Audit_System SHALL 将"缺少核心场景测试"标记为 P1
3. THE Audit_System SHALL 将"测试质量问题"标记为 P1
4. THE Audit_System SHALL 将"缺少边界场景测试"标记为 P2
5. THE Audit_System SHALL 将"命名规范问题"标记为 P2

