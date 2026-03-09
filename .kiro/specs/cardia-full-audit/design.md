# Design Document

## Overview

本设计文档定义 Cardia 游戏全面审计的技术架构、执行流程和验证机制。审计目标是按照 `docs/ai-rules/testing-audit.md` 中的 D1-D49 维度，系统性检查 Cardia 游戏的所有已实现功能（Deck I 的 16 张卡牌 + 基础游戏机制），发现并修复潜在的实现缺陷。

审计范围：
- 16 张 Deck I 卡牌的能力实现（即时能力 + 持续能力）
- 基础游戏机制（遭遇、计分、印戒、修正标记）
- 交互系统（卡牌选择、确认/跳过、交互链）
- 状态管理（reducer、validate、execute）
- UI 层（Board.tsx、HandArea、EncounterZone、SignetDisplay）

审计不包含：
- Deck II/III/IV 的卡牌（尚未实现）
- 高级规则变体（尚未实现）
- 性能优化（非功能性需求）

## Architecture

### 审计工具架构

审计系统采用三层架构：静态扫描 + 动态测试 + 手动审查。


```
┌─────────────────────────────────────────────────────────────┐
│                    审计工具架构                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ 静态扫描层   │  │ 动态测试层   │  │ 手动审查层   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                 │                 │              │
│         ▼                 ▼                 ▼              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ AST 分析     │  │ Property 测试│  │ 审查矩阵     │     │
│  │ Grep 搜索    │  │ GameTestRunner│ │ 问题列表     │     │
│  │ 类型检查     │  │ E2E 测试     │  │ 修复跟踪表   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                 │                 │              │
│         └─────────────────┴─────────────────┘              │
│                           │                                │
│                           ▼                                │
│                  ┌──────────────────┐                      │
│                  │  审计报告生成器  │                      │
│                  └──────────────────┘                      │
│                           │                                │
│                           ▼                                │
│                  ┌──────────────────┐                      │
│                  │  问题优先级排序  │                      │
│                  │  (P0/P1/P2)      │                      │
│                  └──────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

#### 静态扫描层

使用 AST 分析和正则搜索检查代码模式，无需运行代码。

**工具清单**：
- `check-displaymode.mjs`：检查所有 `createSimpleChoice` 调用是否显式声明 `displayMode`
- `check-play-constraint.mjs`：检查 ongoing 行动卡是否有 `playConstraint` 声明
- `check-grant-extra-payload.mjs`：检查 `grantExtraMinion`/`grantExtraAction` 调用的 payload 完整性
- `check-ability-tags.mjs`：检查 `abilityTags` 与触发机制一致性


**检查维度覆盖**：
- D46（交互选项 UI 渲染模式声明完整性）
- D48（UI 交互渲染模式完整性）
- D2 子项（打出约束审计、额度授予约束审计）
- D49（abilityTags 与触发机制一致性）

#### 动态测试层

运行测试代码验证功能正确性，覆盖单元测试、集成测试、E2E 测试。

**工具清单**：
- **Property 测试**：`ability-registry-completeness.test.ts`、`verify-executors.test.ts`
- **GameTestRunner**：`card-abilities.test.ts`、`integration-ongoing-abilities.test.ts`、`interaction.test.ts`
- **E2E 测试**：`cardia-deck1-card*.e2e.ts`（16 张卡牌各一个）

**检查维度覆盖**：
- D3（引擎 API 调用契约审计）
- D5（交互模式语义匹配）
- D7（验证层有效性门控）
- D8（引擎批处理时序与 UI 交互对齐）
- D11-D14（Reducer 消耗路径、写入-消耗对称、多来源竞争、回合清理）
- D19（组合场景测试）
- D47（E2E 测试覆盖完整性）

#### 手动审查层

人工阅读代码和描述，检查语义一致性和逻辑正确性。

**审查工具**：
- 审查矩阵（卡牌 × 维度）：Excel/Markdown 表格，标注每个检查点的状态（✅/❌/⚠️）
- 问题列表：记录发现的所有问题，包含卡牌、能力、代码位置、根因分析、修复建议
- 修复跟踪表：记录每个问题的修复状态（未修复/修复中/已修复/已验证）

**检查维度覆盖**：
- D1（描述→实现全链路审查）
- D2（验证-执行前置条件对齐）
- D4（查询一致性）
- D6（副作用传播完整性）
- D9（幂等与重入）
- D10（元数据一致）
- D15（UI 状态同步）
- D20（状态可观测性）
- D24（Handler 共返状态一致性）
- D35-D37（交互上下文快照、延迟事件补发、交互选项动态刷新）


### 审计执行流程

审计分为 4 个阶段，每个阶段独立可验证，前一阶段完成后才能进入下一阶段。

```
Phase 1: 静态检查（1-2 天）
  ├─ 运行静态扫描工具
  ├─ 生成初步问题列表
  └─ 修复 P0 问题（阻塞后续测试的问题）

Phase 2: 单元测试（2-3 天）
  ├─ 运行 Property 测试
  ├─ 运行 GameTestRunner 测试
  ├─ 补充缺失的测试用例
  └─ 修复测试发现的 P0/P1 问题

Phase 3: 集成测试（2-3 天）
  ├─ 运行组合场景测试
  ├─ 运行交互链测试
  ├─ 补充缺失的集成测试
  └─ 修复测试发现的 P1/P2 问题

Phase 4: E2E 测试（3-4 天）
  ├─ 运行所有 E2E 测试
  ├─ 补充缺失的 E2E 测试
  ├─ 修复测试发现的 P1/P2 问题
  └─ 生成最终审计报告
```

#### Phase 1: 静态检查

**目标**：发现代码模式问题，无需运行代码。

**执行步骤**：
1. 运行 `node scripts/audit/check-displaymode.mjs`
2. 运行 `node scripts/audit/check-play-constraint.mjs`
3. 运行 `node scripts/audit/check-grant-extra-payload.mjs`
4. 运行 `node scripts/audit/check-ability-tags.mjs`
5. 汇总问题列表，按优先级排序
6. 修复所有 P0 问题（阻塞后续测试的问题）

**输出**：
- `audit-phase1-report.md`：静态检查报告
- `audit-phase1-issues.json`：问题列表（JSON 格式，便于后续处理）

**验收标准**：
- 所有静态扫描工具运行成功
- 所有 P0 问题已修复
- 问题列表已生成并按优先级排序


#### Phase 2: 单元测试

**目标**：验证单个能力/命令的正确性。

**执行步骤**：
1. 运行 `npm run test:games -- cardia`（所有 Cardia 单元测试）
2. 检查测试覆盖率（`npm run test:coverage -- cardia`）
3. 识别缺失的测试用例（参照 D1-D49 维度）
4. 补充缺失的测试用例
5. 修复测试发现的 P0/P1 问题
6. 重新运行测试验证修复效果

**输出**：
- `audit-phase2-report.md`：单元测试报告
- `audit-phase2-coverage.html`：测试覆盖率报告
- `audit-phase2-issues.json`：新发现的问题列表

**验收标准**：
- 所有单元测试通过
- 测试覆盖率 ≥ 80%（行覆盖率）
- 所有 P0 问题已修复，P1 问题已记录

#### Phase 3: 集成测试

**目标**：验证多个能力/机制组合使用时的正确性。

**执行步骤**：
1. 运行 `integration-ongoing-abilities.test.ts`（持续能力组合）
2. 运行 `integration-ability-copy.test.ts`（复制能力组合）
3. 运行 `interaction.test.ts`（交互链完整性）
4. 识别缺失的组合场景（参照 D19 维度）
5. 补充缺失的集成测试
6. 修复测试发现的 P1/P2 问题
7. 重新运行测试验证修复效果

**输出**：
- `audit-phase3-report.md`：集成测试报告
- `audit-phase3-issues.json`：新发现的问题列表

**验收标准**：
- 所有集成测试通过
- 关键组合场景已覆盖（持续能力 + 修正标记、复制能力 + 被复制能力、交互链）
- 所有 P1 问题已修复，P2 问题已记录


#### Phase 4: E2E 测试

**目标**：验证完整的命令执行流程（WebSocket 同步 + UI 交互）。

**执行步骤**：
1. 运行 `npm run test:e2e -- cardia`（所有 Cardia E2E 测试）
2. 检查 E2E 测试覆盖率（每张卡牌至少一个 E2E 测试）
3. 识别缺失的 E2E 测试（参照 D47 维度）
4. 补充缺失的 E2E 测试
5. 修复测试发现的 P1/P2 问题
6. 重新运行测试验证修复效果
7. 生成最终审计报告

**输出**：
- `audit-phase4-report.md`：E2E 测试报告
- `audit-phase4-issues.json`：新发现的问题列表
- `audit-final-report.md`：最终审计报告（汇总所有阶段）
- `audit-fix-tracking.md`：修复跟踪表

**验收标准**：
- 所有 E2E 测试通过
- 所有 Deck I 卡牌（16 张）都有 E2E 测试覆盖
- 所有 P1 问题已修复，P2 问题已记录
- 最终审计报告已生成

### 问题分类与优先级

问题按严重程度分为 P0/P1/P2 三个优先级：

**P0（阻塞性问题）**：
- 功能完全无效（如能力从不触发）
- 导致游戏崩溃或卡死
- 数据损坏或状态不一致
- 阻塞后续测试的问题

**P1（高优先级问题）**：
- 功能部分无效（如某些场景下不触发）
- 描述与实现不一致（如伤害目标错误）
- 验证层与执行层不对齐
- UI 显示错误但不影响功能

**P2（低优先级问题）**：
- 代码质量问题（如重复代码、命名不规范）
- 测试覆盖不足
- 文档缺失或过时
- 性能优化建议


### 修复验证机制

每个问题修复后必须经过以下验证流程：

```
问题修复 → 单元测试验证 → 集成测试验证 → E2E 测试验证 → 标记为"已验证"
```

**验证清单**：
1. 修复代码已提交（commit message 包含问题编号）
2. 相关单元测试通过
3. 相关集成测试通过
4. 相关 E2E 测试通过
5. 回归测试通过（确保修复未引入新问题）
6. 代码审查通过（如果是 P0/P1 问题）

**回归测试范围**：
- 修复涉及的卡牌的所有测试
- 修复涉及的机制的所有测试
- 全量单元测试（快速，必须运行）
- 关键 E2E 测试（慢速，选择性运行）

## Components and Interfaces

### 静态扫描工具接口

所有静态扫描工具遵循统一接口：

```typescript
interface StaticScannerTool {
  name: string;
  description: string;
  run(): Promise<ScanResult>;
}

interface ScanResult {
  toolName: string;
  timestamp: string;
  issues: Issue[];
  summary: {
    total: number;
    p0: number;
    p1: number;
    p2: number;
  };
}

interface Issue {
  id: string;              // 唯一标识符（如 "D46-001"）
  dimension: string;       // 审计维度（如 "D46"）
  priority: 'P0' | 'P1' | 'P2';
  title: string;           // 问题标题
  description: string;     // 详细描述
  location: {
    file: string;          // 文件路径
    line?: number;         // 行号（可选）
    code?: string;         // 相关代码片段（可选）
  };
  suggestion: string;      // 修复建议
  status: 'open' | 'fixing' | 'fixed' | 'verified';
}
```


### 测试工具接口

#### Property 测试

```typescript
// 注册表完整性测试
describe('Ability Registry Completeness', () => {
  test('所有能力都已注册到 abilityRegistry', () => {
    const allAbilityIds = getAllAbilityIdsFromCards();
    const registeredIds = abilityRegistry.getAllIds();
    
    const missing = allAbilityIds.filter(id => !registeredIds.includes(id));
    expect(missing).toEqual([]);
  });
  
  test('所有能力都有对应的执行器', () => {
    const allAbilityIds = abilityRegistry.getAllIds();
    const executorIds = abilityExecutorRegistry.getAllIds();
    
    const missing = allAbilityIds.filter(id => !executorIds.includes(id));
    expect(missing).toEqual([]);
  });
});
```

#### GameTestRunner 测试

```typescript
// 能力行为测试
describe('Card Abilities', () => {
  test('Card01 Elf - 即时能力：抽1张牌', async () => {
    const runner = new GameTestRunner({
      gameId: 'cardia',
      random: () => 0.5, // 固定随机数
    });
    
    const { state } = await runner.runCommands([
      { type: 'SETUP_GAME', players: ['p0', 'p1'] },
      { type: 'PLAY_CARD', playerId: 'p0', cardUid: 'elf-1', position: 0 },
    ]);
    
    // 验证状态变更
    expect(state.core.players.p0.hand.length).toBe(initialHandSize + 1);
  });
});
```

#### E2E 测试

```typescript
// 完整交互流程测试
test('Card02 Void Mage - 弃牌交互', async ({ page }) => {
  const ctx = await GameTestContext.create(page, 'cardia');
  
  // 注入初始状态
  await ctx.injectState({
    currentPlayer: 'p0',
    players: {
      p0: { hand: [{ defId: 'void_mage', uid: 'vm-1' }] },
    },
  });
  
  // 打出卡牌
  await ctx.playCard('p0', 'vm-1', 0);
  
  // 验证交互出现
  await expect(page.locator('[data-testid="card-selection-modal"]')).toBeVisible();
  
  // 选择弃牌
  await page.locator('[data-card-uid="card-1"]').click();
  await page.locator('button:has-text("确认")').click();
  
  // 验证状态变更
  const finalState = await ctx.readCoreState();
  expect(finalState.players.p0.discard.length).toBe(1);
});
```


### 审计报告接口

```typescript
interface AuditReport {
  phase: 'phase1' | 'phase2' | 'phase3' | 'phase4' | 'final';
  timestamp: string;
  summary: {
    totalIssues: number;
    p0Issues: number;
    p1Issues: number;
    p2Issues: number;
    fixedIssues: number;
    openIssues: number;
  };
  dimensionCoverage: {
    [dimension: string]: {
      checked: boolean;
      passed: boolean;
      issues: string[]; // Issue IDs
    };
  };
  cardCoverage: {
    [cardId: string]: {
      tested: boolean;
      passed: boolean;
      issues: string[]; // Issue IDs
    };
  };
  issues: Issue[];
}
```

### 审查矩阵接口

审查矩阵是一个二维表格，行为卡牌，列为审计维度。

```markdown
| 卡牌 | D1 | D2 | D3 | D5 | D7 | D8 | ... | 备注 |
|------|----|----|----|----|----|----|-----|------|
| Card01 Elf | ✅ | ✅ | ✅ | N/A | ✅ | ✅ | ... | 无交互 |
| Card02 Void Mage | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ... | D2: 验证层需加强 |
| Card03 Dwarf | ❌ | ✅ | ✅ | N/A | ✅ | ✅ | ... | D1: 描述不一致 |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |
```

**图例**：
- ✅：通过检查
- ❌：发现问题
- ⚠️：部分通过（有轻微问题）
- N/A：不适用（如无交互的卡牌不检查 D5）

## Data Models

### 问题数据模型

```typescript
interface Issue {
  // 基本信息
  id: string;              // 唯一标识符（格式：D{维度}-{序号}，如 "D46-001"）
  dimension: string;       // 审计维度（如 "D46"）
  priority: 'P0' | 'P1' | 'P2';
  
  // 问题描述
  title: string;           // 问题标题（简短描述）
  description: string;     // 详细描述（包含根因分析）
  
  // 位置信息
  location: {
    file: string;          // 文件路径（相对于项目根目录）
    line?: number;         // 行号（可选）
    code?: string;         // 相关代码片段（可选）
    cardId?: string;       // 相关卡牌 ID（可选）
    abilityId?: string;    // 相关能力 ID（可选）
  };
  
  // 修复信息
  suggestion: string;      // 修复建议（具体的代码修改方案）
  status: 'open' | 'fixing' | 'fixed' | 'verified';
  fixCommit?: string;      // 修复提交的 commit hash（可选）
  
  // 元数据
  discoveredBy: 'static' | 'unit-test' | 'integration-test' | 'e2e-test' | 'manual';
  discoveredAt: string;    // 发现时间（ISO 8601 格式）
  fixedAt?: string;        // 修复时间（可选）
  verifiedAt?: string;     // 验证时间（可选）
}
```


### 审计配置模型

```typescript
interface AuditConfig {
  // 审计范围
  scope: {
    gameId: 'cardia';
    cards: string[];       // 要审计的卡牌 ID 列表（空数组表示全部）
    dimensions: string[];  // 要检查的维度列表（空数组表示全部 D1-D49）
  };
  
  // 工具配置
  tools: {
    staticScanners: {
      enabled: boolean;
      tools: string[];     // 要运行的静态扫描工具列表
    };
    unitTests: {
      enabled: boolean;
      coverageThreshold: number; // 测试覆盖率阈值（0-100）
    };
    integrationTests: {
      enabled: boolean;
    };
    e2eTests: {
      enabled: boolean;
      headless: boolean;   // 是否无头模式运行
    };
  };
  
  // 输出配置
  output: {
    reportDir: string;     // 报告输出目录
    format: 'markdown' | 'json' | 'html';
    includeCodeSnippets: boolean;
  };
  
  // 修复配置
  fix: {
    autoFix: boolean;      // 是否自动修复（仅限静态扫描发现的问题）
    createIssues: boolean; // 是否创建 GitHub Issues
  };
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 静态扫描工具完整性

*For any* 审计维度 D，如果该维度可以通过静态扫描检查，则必须存在对应的静态扫描工具。

**Validates: Requirements 1.1, 15.2, 16.1, 20.2**

### Property 2: 测试工具选型正确性

*For any* 审计维度 D，使用的测试工具类型（Property/GameTestRunner/E2E）必须与该维度的检查内容匹配。

**Validates: Requirements 18.1, 18.2, 18.3**

### Property 3: 问题优先级一致性

*For any* 问题 I，其优先级（P0/P1/P2）必须与问题的严重程度一致（功能完全无效 → P0，部分无效 → P1，代码质量 → P2）。

**Validates: Requirements 19.1**


### Property 4: 修复验证完整性

*For any* 已修复的问题 I，必须经过单元测试、集成测试、E2E 测试三层验证后才能标记为"已验证"。

**Validates: Requirements 19.4**

### Property 5: 审查矩阵覆盖完整性

*For any* Deck I 卡牌 C 和适用的审计维度 D，审查矩阵中必须存在对应的检查点（C, D）。

**Validates: Requirements 1.4, 19.2**

### Property 6: 问题 ID 唯一性

*For any* 两个不同的问题 I1 和 I2，它们的 ID 必须不同。

**Validates: Requirements 19.1**

### Property 7: 阶段顺序正确性

*For any* 审计执行，Phase 1 必须在 Phase 2 之前完成，Phase 2 必须在 Phase 3 之前完成，Phase 3 必须在 Phase 4 之前完成。

**Validates: Requirements 20.1**

### Property 8: P0 问题阻塞性

*For any* 阶段 P，如果存在未修复的 P0 问题，则不能进入下一阶段。

**Validates: Requirements 19.1**

### Property 9: 测试覆盖率阈值

*For any* 单元测试运行，行覆盖率必须 ≥ 80%。

**Validates: Requirements 18.1**

### Property 10: E2E 测试覆盖完整性

*For any* Deck I 卡牌 C，必须存在至少一个 E2E 测试覆盖该卡牌的核心功能。

**Validates: Requirements 17.1, 17.2, 17.3**

### Property 11: 回归测试必须性

*For any* 问题修复，必须运行回归测试确保修复未引入新问题。

**Validates: Requirements 19.4**

### Property 12: 审计报告生成完整性

*For any* 审计阶段 P，完成后必须生成对应的审计报告（包含问题列表、汇总统计、维度覆盖情况）。

**Validates: Requirements 19.1, 19.2**


## Error Handling

### 静态扫描工具错误处理

**场景 1：文件不存在**
- 错误：静态扫描工具尝试读取不存在的文件
- 处理：记录警告日志，跳过该文件，继续扫描其他文件
- 恢复：在报告中标注"文件缺失"

**场景 2：AST 解析失败**
- 错误：代码语法错误导致 AST 解析失败
- 处理：记录错误日志，标记为 P0 问题（阻塞性问题）
- 恢复：提示用户修复语法错误后重新运行

**场景 3：工具执行超时**
- 错误：静态扫描工具执行时间超过阈值（如 5 分钟）
- 处理：终止工具执行，记录超时错误
- 恢复：提示用户检查工具配置或代码复杂度

### 测试执行错误处理

**场景 1：测试失败**
- 错误：单元测试/集成测试/E2E 测试失败
- 处理：记录失败详情（错误消息、堆栈跟踪、截图）
- 恢复：生成问题报告，标记为 P0/P1 问题

**场景 2：测试超时**
- 错误：测试执行时间超过阈值（如 30 秒）
- 处理：终止测试执行，记录超时错误
- 恢复：检查测试代码是否有死循环或异步等待问题

**场景 3：测试环境异常**
- 错误：测试环境启动失败（如端口占用、数据库连接失败）
- 处理：记录环境错误，终止测试执行
- 恢复：提示用户检查环境配置（如运行 `npm run test:e2e:cleanup`）

### 修复验证错误处理

**场景 1：修复引入新问题**
- 错误：修复某个问题后，回归测试发现新问题
- 处理：回滚修复，重新分析根因
- 恢复：生成新的问题报告，标记为 P0 问题

**场景 2：修复不完整**
- 错误：修复后测试仍然失败
- 处理：标记为"修复中"，继续调试
- 恢复：补充修复代码，重新运行测试

**场景 3：修复冲突**
- 错误：多个问题的修复代码冲突
- 处理：合并冲突，重新测试
- 恢复：确保所有相关测试通过


## Testing Strategy

### 双重测试方法

审计系统本身也需要测试，确保审计工具的正确性。

**单元测试**：
- 测试静态扫描工具的解析逻辑
- 测试问题优先级分类逻辑
- 测试报告生成逻辑

**集成测试**：
- 测试完整的审计流程（Phase 1 → Phase 2 → Phase 3 → Phase 4）
- 测试问题修复验证流程
- 测试回归测试流程

**Property 测试**：
- 验证问题 ID 唯一性（Property 6）
- 验证审查矩阵覆盖完整性（Property 5）
- 验证测试覆盖率阈值（Property 9）

### 测试配置

**Property 测试配置**：
- 最小迭代次数：100 次
- 标签格式：`Feature: cardia-full-audit, Property {number}: {property_text}`

**GameTestRunner 配置**：
- 使用固定随机数种子（`random: () => 0.5`）
- 每个测试用例独立运行（不共享状态）
- 测试超时时间：30 秒

**E2E 测试配置**：
- 使用 `GameTestContext` API
- 使用状态注入方案（跳过前置步骤）
- 测试超时时间：60 秒
- 截图保存路径：`test-results/cardia-audit/`

### 测试覆盖目标

**单元测试覆盖**：
- 行覆盖率 ≥ 80%
- 分支覆盖率 ≥ 70%
- 函数覆盖率 ≥ 90%

**E2E 测试覆盖**：
- 所有 Deck I 卡牌（16 张）都有至少一个 E2E 测试
- 关键交互路径（onPlay/onDestroy/响应窗口/交互链）都有 E2E 测试
- 组合场景（持续能力 + 修正标记、复制能力 + 被复制能力）都有 E2E 测试

### 测试执行顺序

1. **静态扫描**：最快，无需运行代码，优先执行
2. **Property 测试**：快速，验证数据定义契约
3. **单元测试**：中速，验证单个能力/命令
4. **集成测试**：中速，验证组合场景
5. **E2E 测试**：最慢，验证完整流程，最后执行

### 测试失败处理

**单元测试失败**：
- 记录失败详情（错误消息、堆栈跟踪）
- 生成问题报告（标记为 P0/P1）
- 阻塞后续阶段（如果是 P0 问题）

**E2E 测试失败**：
- 保存截图和视频
- 记录失败详情（错误消息、堆栈跟踪、页面状态）
- 生成问题报告（标记为 P1/P2）
- 不阻塞后续阶段（除非是 P0 问题）


## Implementation Notes

### 静态扫描工具实现

所有静态扫描工具使用 Node.js + TypeScript 实现，放置在 `scripts/audit/` 目录下。

**工具模板**：
```typescript
// scripts/audit/check-displaymode.mjs
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface Issue {
  id: string;
  dimension: string;
  priority: 'P0' | 'P1' | 'P2';
  title: string;
  description: string;
  location: { file: string; line?: number; code?: string };
  suggestion: string;
}

function scanFile(filePath: string): Issue[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues: Issue[] = [];
  
  lines.forEach((line, index) => {
    // 检查 createSimpleChoice 调用
    if (line.includes('createSimpleChoice') && !line.includes('displayMode')) {
      issues.push({
        id: `D46-${issues.length + 1}`,
        dimension: 'D46',
        priority: 'P1',
        title: '缺少 displayMode 声明',
        description: `createSimpleChoice 调用缺少 displayMode 声明`,
        location: { file: filePath, line: index + 1, code: line.trim() },
        suggestion: '添加 displayMode: "card" 或 displayMode: "button"',
      });
    }
  });
  
  return issues;
}

function main() {
  const gameDir = 'src/games/cardia';
  const files = readdirSync(gameDir, { recursive: true })
    .filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
  
  const allIssues: Issue[] = [];
  files.forEach(file => {
    const filePath = join(gameDir, file);
    const issues = scanFile(filePath);
    allIssues.push(...issues);
  });
  
  console.log(JSON.stringify({
    toolName: 'check-displaymode',
    timestamp: new Date().toISOString(),
    issues: allIssues,
    summary: {
      total: allIssues.length,
      p0: allIssues.filter(i => i.priority === 'P0').length,
      p1: allIssues.filter(i => i.priority === 'P1').length,
      p2: allIssues.filter(i => i.priority === 'P2').length,
    },
  }, null, 2));
}

main();
```

### 审计报告生成

审计报告使用 Markdown 格式，包含以下部分：

```markdown
# Cardia 游戏全面审计报告 - Phase {N}

## 执行摘要

- 审计阶段：Phase {N}
- 执行时间：{timestamp}
- 总问题数：{total}
  - P0：{p0}
  - P1：{p1}
  - P2：{p2}
- 已修复：{fixed}
- 待修复：{open}

## 维度覆盖情况

| 维度 | 状态 | 问题数 | 备注 |
|------|------|--------|------|
| D1   | ✅   | 0      | 通过 |
| D2   | ⚠️   | 2      | 2 个 P1 问题 |
| D3   | ❌   | 1      | 1 个 P0 问题 |
| ...  | ...  | ...    | ...  |

## 卡牌覆盖情况

| 卡牌 | 测试状态 | 问题数 | 备注 |
|------|----------|--------|------|
| Card01 Elf | ✅ | 0 | 通过 |
| Card02 Void Mage | ⚠️ | 1 | 1 个 P1 问题 |
| Card03 Dwarf | ❌ | 2 | 1 个 P0 + 1 个 P1 |
| ...  | ...  | ...    | ...  |

## 问题列表

### P0 问题

#### D3-001: 能力未注册到执行器

- **卡牌**：Card03 Dwarf
- **位置**：`src/games/cardia/domain/abilities/group1-basic.ts:45`
- **描述**：Dwarf 的能力已定义但未注册到 `abilityExecutorRegistry`
- **修复建议**：在 `abilityResolver.ts` 中添加执行器注册
- **状态**：待修复

### P1 问题

#### D2-001: 验证层缺少前置条件检查

- **卡牌**：Card02 Void Mage
- **位置**：`src/games/cardia/domain/commands.ts:123`
- **描述**：验证层未检查手牌是否为空
- **修复建议**：在 `customValidator` 中添加 `player.hand.length > 0` 检查
- **状态**：待修复

## 下一步行动

1. 修复所有 P0 问题
2. 修复所有 P1 问题
3. 运行回归测试
4. 进入下一阶段
```


### 修复跟踪表

修复跟踪表使用 Markdown 表格格式，记录每个问题的修复进度：

```markdown
# Cardia 审计问题修复跟踪表

| 问题 ID | 优先级 | 标题 | 状态 | 修复人 | 修复提交 | 验证时间 |
|---------|--------|------|------|--------|----------|----------|
| D3-001  | P0     | 能力未注册 | 已验证 | @dev | abc1234 | 2024-01-15 |
| D2-001  | P1     | 验证层缺少检查 | 修复中 | @dev | - | - |
| D46-001 | P1     | 缺少 displayMode | 待修复 | - | - | - |
| ...     | ...    | ...  | ...  | ...    | ...      | ...      |

## 修复进度统计

- 总问题数：50
- 已验证：10 (20%)
- 修复中：15 (30%)
- 待修复：25 (50%)

## 按优先级统计

- P0：5 个（已修复 3 个，修复中 2 个）
- P1：20 个（已修复 5 个，修复中 10 个，待修复 5 个）
- P2：25 个（已修复 2 个，修复中 3 个，待修复 20 个）
```

### CI 集成

审计流程集成到 CI 流程中，PR 必须通过审计检查才能合并。

**GitHub Actions 配置**：
```yaml
name: Cardia Audit

on:
  pull_request:
    paths:
      - 'src/games/cardia/**'
      - 'e2e/cardia-*.e2e.ts'

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run static scanners
        run: |
          node scripts/audit/check-displaymode.mjs > audit-displaymode.json
          node scripts/audit/check-play-constraint.mjs > audit-play-constraint.json
          node scripts/audit/check-grant-extra-payload.mjs > audit-grant-extra.json
          node scripts/audit/check-ability-tags.mjs > audit-ability-tags.json
      
      - name: Check for P0 issues
        run: |
          # 检查是否有 P0 问题
          if grep -q '"priority": "P0"' audit-*.json; then
            echo "Found P0 issues, failing build"
            exit 1
          fi
      
      - name: Run unit tests
        run: npm run test:games -- cardia
      
      - name: Check test coverage
        run: |
          npm run test:coverage -- cardia
          # 检查覆盖率是否 >= 80%
          coverage=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$coverage < 80" | bc -l) )); then
            echo "Test coverage is below 80%: $coverage%"
            exit 1
          fi
      
      - name: Upload audit reports
        uses: actions/upload-artifact@v3
        with:
          name: audit-reports
          path: audit-*.json
```


### 自动化脚本

提供一键运行所有审计检查的脚本：

```bash
#!/bin/bash
# scripts/audit/run-full-audit.sh

set -e

echo "========================================="
echo "Cardia 游戏全面审计"
echo "========================================="

# Phase 1: 静态检查
echo ""
echo "Phase 1: 静态检查"
echo "-----------------------------------------"
node scripts/audit/check-displaymode.mjs > reports/audit-phase1-displaymode.json
node scripts/audit/check-play-constraint.mjs > reports/audit-phase1-play-constraint.json
node scripts/audit/check-grant-extra-payload.mjs > reports/audit-phase1-grant-extra.json
node scripts/audit/check-ability-tags.mjs > reports/audit-phase1-ability-tags.json

# 检查 P0 问题
p0_count=$(cat reports/audit-phase1-*.json | jq '[.issues[] | select(.priority == "P0")] | length')
if [ "$p0_count" -gt 0 ]; then
  echo "发现 $p0_count 个 P0 问题，请先修复后再继续"
  exit 1
fi

echo "Phase 1 完成，未发现 P0 问题"

# Phase 2: 单元测试
echo ""
echo "Phase 2: 单元测试"
echo "-----------------------------------------"
npm run test:games -- cardia --coverage
npm run test:coverage -- cardia

# 检查覆盖率
coverage=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
if (( $(echo "$coverage < 80" | bc -l) )); then
  echo "测试覆盖率低于 80%: $coverage%"
  exit 1
fi

echo "Phase 2 完成，测试覆盖率: $coverage%"

# Phase 3: 集成测试
echo ""
echo "Phase 3: 集成测试"
echo "-----------------------------------------"
npm run test:games -- cardia integration

echo "Phase 3 完成"

# Phase 4: E2E 测试
echo ""
echo "Phase 4: E2E 测试"
echo "-----------------------------------------"
npm run test:e2e -- cardia

echo "Phase 4 完成"

# 生成最终报告
echo ""
echo "生成最终审计报告"
echo "-----------------------------------------"
node scripts/audit/generate-final-report.mjs

echo ""
echo "========================================="
echo "审计完成！"
echo "报告已生成到 reports/audit-final-report.md"
echo "========================================="
```

### 问题自动修复

对于静态扫描发现的简单问题，提供自动修复脚本：

```typescript
// scripts/audit/auto-fix-displaymode.mjs
import { readFileSync, writeFileSync } from 'fs';

function autoFixDisplayMode(filePath: string): number {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let fixCount = 0;
  
  const fixedLines = lines.map(line => {
    // 检查 createSimpleChoice 调用
    if (line.includes('createSimpleChoice') && !line.includes('displayMode')) {
      // 简单启发式：如果选项包含 cardUid，默认为 'card'，否则为 'button'
      const hasCardUid = line.includes('cardUid');
      const displayMode = hasCardUid ? 'card' : 'button';
      
      // 在选项对象中添加 displayMode
      const fixed = line.replace(
        /(\{[^}]*)\}/,
        `$1, displayMode: '${displayMode}' as const }`
      );
      
      fixCount++;
      return fixed;
    }
    return line;
  });
  
  if (fixCount > 0) {
    writeFileSync(filePath, fixedLines.join('\n'), 'utf-8');
  }
  
  return fixCount;
}

// 使用示例
const files = process.argv.slice(2);
let totalFixes = 0;

files.forEach(file => {
  const fixes = autoFixDisplayMode(file);
  if (fixes > 0) {
    console.log(`${file}: 修复了 ${fixes} 处`);
    totalFixes += fixes;
  }
});

console.log(`总共修复了 ${totalFixes} 处问题`);
```


## Design Decisions

### 决策 1：分阶段执行 vs 一次性执行

**选择**：分阶段执行（Phase 1 → Phase 2 → Phase 3 → Phase 4）

**理由**：
- 早期发现问题：静态检查可以在不运行代码的情况下发现问题，节省时间
- 阻塞性问题优先：P0 问题必须在进入下一阶段前修复，避免浪费时间在后续测试上
- 渐进式验证：每个阶段完成后生成报告，便于跟踪进度
- 灵活性：可以根据需要跳过某些阶段（如只运行静态检查）

**权衡**：
- 优点：早期发现问题，节省时间，便于跟踪进度
- 缺点：需要手动触发每个阶段（可通过自动化脚本缓解）

### 决策 2：静态扫描 vs 运行时检查

**选择**：优先使用静态扫描，运行时检查作为补充

**理由**：
- 速度快：静态扫描无需运行代码，速度远快于运行时检查
- 覆盖全面：静态扫描可以检查所有代码路径，运行时检查只能覆盖执行到的路径
- 早期发现：静态扫描可以在编码阶段发现问题，运行时检查需要等到测试阶段

**权衡**：
- 优点：速度快，覆盖全面，早期发现
- 缺点：静态扫描无法检查运行时行为（如状态变更、副作用），需要运行时检查补充

### 决策 3：自动修复 vs 手动修复

**选择**：简单问题自动修复，复杂问题手动修复

**理由**：
- 效率：简单问题（如缺少 displayMode）可以通过启发式规则自动修复，节省时间
- 安全性：复杂问题（如描述与实现不一致）需要人工判断，自动修复可能引入新问题
- 可控性：自动修复提供预览和确认机制，用户可以选择接受或拒绝

**权衡**：
- 优点：简单问题快速修复，复杂问题人工审查
- 缺点：自动修复可能误判，需要人工验证

### 决策 4：问题优先级分类

**选择**：P0/P1/P2 三级分类

**理由**：
- P0（阻塞性）：功能完全无效或导致崩溃，必须立即修复
- P1（高优先级）：功能部分无效或描述不一致，应尽快修复
- P2（低优先级）：代码质量或测试覆盖问题，可延后修复

**权衡**：
- 优点：清晰的优先级，便于资源分配
- 缺点：边界模糊（如"部分无效"vs"代码质量"），需要人工判断


### 决策 5：测试工具选型

**选择**：Property 测试 + GameTestRunner + E2E 测试三层覆盖

**理由**：
- Property 测试：验证数据定义契约（结构完整性 + 语义正确性），快速覆盖大量场景
- GameTestRunner：验证引擎层逻辑（命令序列 + 状态断言），无需启动服务器
- E2E 测试：验证完整流程（WebSocket 同步 + UI 交互），发现 pipeline 外部的问题

**权衡**：
- 优点：三层覆盖互补，Property 测试快速覆盖，GameTestRunner 验证逻辑，E2E 验证完整流程
- 缺点：E2E 测试慢速，需要启动服务器和浏览器

### 决策 6：审查矩阵格式

**选择**：Markdown 表格格式

**理由**：
- 可读性：Markdown 表格易于阅读和编辑
- 版本控制：纯文本格式，便于 Git 跟踪变更
- 工具支持：大多数编辑器和 CI 工具支持 Markdown

**权衡**：
- 优点：可读性好，版本控制友好，工具支持广泛
- 缺点：大型矩阵（如 16 卡牌 × 49 维度）难以在编辑器中查看（可通过生成 HTML 报告缓解）

### 决策 7：CI 集成策略

**选择**：PR 必须通过审计检查才能合并

**理由**：
- 质量门禁：确保所有代码变更都经过审计检查
- 早期发现：在 PR 阶段发现问题，避免合并后再修复
- 自动化：CI 自动运行审计检查，无需人工触发

**权衡**：
- 优点：质量门禁，早期发现，自动化
- 缺点：CI 运行时间增加（可通过并行执行和缓存优化）

### 决策 8：报告格式

**选择**：Markdown + JSON 双格式

**理由**：
- Markdown：人类可读，便于查看和分享
- JSON：机器可读，便于后续处理（如生成 HTML 报告、导入到问题跟踪系统）

**权衡**：
- 优点：Markdown 可读性好，JSON 可编程处理
- 缺点：需要维护两种格式（可通过自动生成缓解）


## Risks and Mitigations

### 风险 1：审计工具误报

**描述**：静态扫描工具可能误判代码模式，产生误报（false positive）。

**影响**：浪费时间调查不存在的问题，降低对审计工具的信任。

**缓解措施**：
- 人工审查：所有 P0 问题必须经过人工审查确认
- 白名单机制：允许标注已知的误报，工具自动跳过
- 持续改进：根据误报反馈优化工具规则

### 风险 2：测试覆盖不足

**描述**：测试用例可能遗漏某些边界条件或组合场景，导致问题未被发现。

**影响**：审计通过但实际存在问题，降低审计的有效性。

**缓解措施**：
- 参照 D1-D49 维度：系统性检查所有维度，避免遗漏
- 组合场景测试：补充持续能力 + 修正标记、复制能力 + 被复制能力等组合场景
- E2E 测试覆盖：确保所有卡牌都有 E2E 测试

### 风险 3：修复引入新问题

**描述**：修复某个问题时可能引入新问题（regression）。

**影响**：修复后测试失败，需要回滚或重新修复。

**缓解措施**：
- 回归测试：修复后运行全量单元测试和关键 E2E 测试
- 代码审查：P0/P1 问题的修复必须经过代码审查
- 小步迭代：每次只修复一个问题，避免大范围修改

### 风险 4：审计时间过长

**描述**：审计流程可能耗时过长（如 E2E 测试慢速），影响开发进度。

**影响**：开发者等待时间长，降低开发效率。

**缓解措施**：
- 并行执行：静态扫描、单元测试、E2E 测试并行运行
- 增量审计：只审计变更的卡牌和相关代码
- 缓存优化：CI 缓存依赖和测试结果，避免重复运行


### 风险 5：维度覆盖不完整

**描述**：D1-D49 维度可能无法覆盖所有类型的问题。

**影响**：某些问题未被审计发现，降低审计的全面性。

**缓解措施**：
- 持续更新：根据实际发现的问题补充新维度
- 手动审查：人工阅读代码和描述，发现维度未覆盖的问题
- 社区反馈：收集用户反馈，补充遗漏的检查点

### 风险 6：问题优先级判断错误

**描述**：问题优先级分类可能不准确（如将 P1 误判为 P0）。

**影响**：资源分配不合理，P0 问题未优先修复。

**缓解措施**：
- 明确标准：P0/P1/P2 的判断标准清晰定义
- 人工审查：所有 P0 问题必须经过人工审查确认
- 优先级调整：允许在审计过程中调整问题优先级

### 风险 7：自动修复误操作

**描述**：自动修复脚本可能误判代码意图，引入错误修复。

**影响**：修复后功能异常，需要回滚。

**缓解措施**：
- 预览机制：自动修复前显示修改内容，用户确认后执行
- 限制范围：只对简单问题（如缺少 displayMode）自动修复
- 回滚支持：提供一键回滚功能，快速恢复原始代码

## Performance Considerations

### 静态扫描性能

**目标**：所有静态扫描工具在 5 分钟内完成。

**优化策略**：
- 并行扫描：多个工具并行运行
- 增量扫描：只扫描变更的文件
- 缓存结果：缓存 AST 解析结果，避免重复解析

### 测试执行性能

**目标**：
- 单元测试：5 分钟内完成
- 集成测试：10 分钟内完成
- E2E 测试：30 分钟内完成

**优化策略**：
- 并行执行：多个测试用例并行运行
- 状态注入：E2E 测试使用状态注入跳过前置步骤
- 选择性运行：只运行变更相关的测试（增量测试）


### CI 性能优化

**目标**：CI 审计流程在 15 分钟内完成。

**优化策略**：
- 并行 Job：静态扫描、单元测试、E2E 测试并行运行
- 缓存依赖：缓存 `node_modules` 和测试结果
- 增量审计：只审计 PR 变更的文件
- 快速失败：发现 P0 问题立即终止，避免浪费时间

## Security Considerations

### 代码注入风险

**场景**：静态扫描工具执行用户提供的代码或配置。

**风险**：恶意代码可能通过审计工具执行。

**缓解措施**：
- 沙箱执行：审计工具在隔离环境中运行
- 输入验证：验证所有用户输入（如文件路径、配置参数）
- 最小权限：审计工具只读取必要的文件，不修改系统文件

### 敏感信息泄露

**场景**：审计报告可能包含敏感信息（如 API 密钥、用户数据）。

**风险**：敏感信息通过报告泄露。

**缓解措施**：
- 脱敏处理：自动检测并脱敏敏感信息（如替换为 `***`）
- 访问控制：审计报告只对授权用户可见
- 定期清理：定期删除旧的审计报告

### 依赖安全

**场景**：审计工具依赖第三方库，可能存在安全漏洞。

**风险**：漏洞可能被利用攻击系统。

**缓解措施**：
- 依赖审计：定期运行 `npm audit` 检查依赖漏洞
- 版本锁定：使用 `package-lock.json` 锁定依赖版本
- 及时更新：发现漏洞后及时更新依赖

## Maintenance and Evolution

### 维护计划

**日常维护**：
- 每周运行一次全量审计，确保代码质量
- 每月更新审计工具规则，根据新发现的问题补充检查点
- 每季度审查审计流程，优化性能和覆盖范围

**版本升级**：
- 新增卡牌时，补充对应的测试用例和审计检查
- 引擎层变更时，更新审计工具以适配新接口
- 框架层变更时，更新审计维度以覆盖新机制


### 演进路线

**短期（1-3 个月）**：
- 完成 Deck I 的全面审计
- 修复所有 P0 和 P1 问题
- 建立审计流程和工具链

**中期（3-6 个月）**：
- 扩展到 Deck II/III/IV 的审计
- 补充更多审计维度（如性能、可访问性）
- 优化审计工具性能（并行执行、增量审计）

**长期（6-12 个月）**：
- 建立审计知识库（常见问题、修复模式）
- 开发 IDE 插件（实时审计反馈）
- 推广到其他游戏（SmashUp、DiceThrone、SummonerWars）

### 文档更新

**审计文档**：
- `docs/ai-rules/testing-audit.md`：补充新发现的维度和检查点
- `docs/automated-testing.md`：更新测试工具使用指南
- `docs/testing-best-practices.md`：补充审计最佳实践

**游戏文档**：
- `src/games/cardia/rule/卡迪亚规则.md`：根据审计发现更新规则描述
- `src/games/cardia/README.md`：补充审计流程和工具使用说明

## Appendix

### 附录 A：D1-D49 维度速查表

| 维度 | 名称 | 检查方法 | 适用场景 |
|------|------|----------|----------|
| D1   | 描述→实现全链路审查 | 手动审查 | 所有卡牌 |
| D2   | 验证-执行前置条件对齐 | 手动审查 + 单元测试 | 所有能力 |
| D3   | 引擎 API 调用契约审计 | Property 测试 | 所有能力 |
| D5   | 交互模式语义匹配 | 手动审查 + E2E 测试 | 有交互的能力 |
| D7   | 验证层有效性门控 | 单元测试 | 有代价的能力 |
| D8   | 引擎批处理时序与 UI 交互对齐 | 单元测试 + E2E 测试 | 阶段结束技能 |
| D11  | Reducer 消耗路径审计 | 单元测试 | 所有事件 |
| D12  | 写入-消耗对称 | 单元测试 | 所有状态字段 |
| D13  | 多来源竞争 | 单元测试 | 有多来源的资源 |
| D14  | 回合清理完整 | 单元测试 | 临时状态 |
| D15  | UI 状态同步 | E2E 测试 | 所有 UI 组件 |
| D19  | 组合场景测试 | 集成测试 | 多机制组合 |
| D20  | 状态可观测性 | E2E 测试 | 所有状态 |
| D24  | Handler 共返状态一致性 | 单元测试 | 交互 handler |
| D35  | 交互上下文快照完整性 | 单元测试 | 交互链 |
| D36  | 延迟事件补发的健壮性 | 单元测试 | 延迟事件 |
| D37  | 交互选项动态刷新完整性 | 单元测试 | 多交互场景 |
| D46  | 交互选项 UI 渲染模式声明完整性 | 静态扫描 | 所有交互 |
| D47  | E2E 测试覆盖完整性 | E2E 测试 | 所有卡牌 |
| D48  | UI 交互渲染模式完整性 | 静态扫描 + E2E 测试 | 所有交互 |
| D49  | abilityTags 与触发机制一致性 | 静态扫描 + Property 测试 | 所有卡牌 |


### 附录 B：Deck I 卡牌清单

| 卡牌 ID | 中文名 | 影响力 | 能力类型 | 派系 |
|---------|--------|--------|----------|------|
| card01_elf | 精灵 | 1 | 即时 | 学院 |
| card02_void_mage | 虚空法师 | 2 | 即时 | 学院 |
| card03_dwarf | 矮人 | 3 | 即时 | 公会 |
| card04_mediator | 调解人 | 4 | 即时 | 公会 |
| card05_swamp_guard | 沼泽守卫 | 5 | 持续 | 沼泽 |
| card06_diviner | 占卜师 | 6 | 即时 | 学院 |
| card07_court_guard | 宫廷守卫 | 7 | 即时 | 王朝 |
| card08_treasurer | 财务官 | 8 | 即时 | 公会 |
| card09_assassin | 刺客 | 9 | 即时 | 公会 |
| card10_puppeteer | 傀儡师 | 10 | 即时 | 沼泽 |
| card11_clockmaker | 钟表匠 | 11 | 即时 | 公会 |
| card12_oracle | 神谕者 | 12 | 即时 | 学院 |
| card13_emperor | 皇帝 | 13 | 持续 | 王朝 |
| card14_governess | 女总督 | 14 | 即时 | 王朝 |
| card15_witch | 女巫 | 15 | 即时 | 沼泽 |
| card16_dragon | 龙 | 16 | 持续 | 王朝 |

### 附录 C：审计工具清单

| 工具名称 | 类型 | 检查维度 | 输出格式 |
|----------|------|----------|----------|
| check-displaymode.mjs | 静态扫描 | D46, D48 | JSON |
| check-play-constraint.mjs | 静态扫描 | D2 子项 | JSON |
| check-grant-extra-payload.mjs | 静态扫描 | D2 子项 | JSON |
| check-ability-tags.mjs | 静态扫描 | D49 | JSON |
| ability-registry-completeness.test.ts | Property 测试 | D3 | Vitest |
| verify-executors.test.ts | Property 测试 | D3 | Vitest |
| card-abilities.test.ts | GameTestRunner | D1, D2, D7 | Vitest |
| integration-ongoing-abilities.test.ts | 集成测试 | D19 | Vitest |
| integration-ability-copy.test.ts | 集成测试 | D19 | Vitest |
| interaction.test.ts | 集成测试 | D24, D35-D37 | Vitest |
| cardia-deck1-card*.e2e.ts | E2E 测试 | D5, D15, D20, D47 | Playwright |

### 附录 D：参考文档

- `docs/ai-rules/testing-audit.md`：D1-D49 维度定义（唯一权威来源）
- `docs/automated-testing.md`：测试工具选型和使用指南
- `docs/testing-best-practices.md`：测试编写最佳实践
- `docs/ai-rules/engine-systems.md`：引擎系统架构和使用规范
- `src/games/cardia/rule/卡迪亚规则.md`：游戏规则文档

### 附录 E：常见问题 FAQ

**Q1：审计发现的问题必须全部修复吗？**

A：P0 问题必须修复（阻塞性问题），P1 问题应尽快修复（高优先级），P2 问题可延后修复（低优先级）。

**Q2：审计工具误报怎么办？**

A：可以在代码中添加注释标注已知误报（如 `// audit-ignore: D46`），工具会自动跳过。

**Q3：如何增量审计？**

A：使用 `--changed-only` 参数只审计变更的文件，或在 CI 中配置只审计 PR 变更的文件。

**Q4：审计报告如何分享？**

A：审计报告生成 Markdown 和 JSON 两种格式，Markdown 可直接查看，JSON 可导入到问题跟踪系统。

**Q5：如何添加新的审计维度？**

A：在 `docs/ai-rules/testing-audit.md` 中补充新维度定义，然后实现对应的静态扫描工具或测试用例。

