# Design Document - Cardia E2E 测试优化

## Overview

本设计文档定义了 Cardia 卡组一 E2E 测试优化项目的技术方案。项目目标是使用新的 `setupCardiaTestScenario` API 重写现有的 16 个卡牌测试，并为每个测试补充完整的回合流程验证（阶段1、阶段2、阶段3），确保测试覆盖从打牌到回合结束的完整游戏流程。

## Architecture

### 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    E2E 测试层                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  16个卡牌测试文件（card01-card16.e2e.ts）            │  │
│  │  - 使用 setupCardiaTestScenario API                  │  │
│  │  - 完整回合流程验证（阶段1/2/3）                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  测试辅助函数层（e2e/helpers/cardia.ts）            │  │
│  │  - setupCardiaTestScenario（声明式场景配置）        │  │
│  │  - readCoreState / readLiveState（状态读取）        │  │
│  │  - playCard / waitForPhase（交互操作）              │  │
│  │  - applyCoreStateDirect（状态注入）                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Playwright 测试框架                                 │  │
│  │  - Browser / Page / Context 管理                     │  │
│  │  - 调试面板交互                                      │  │
│  │  - 断言和验证                                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 三层测试模型

1. **测试场景层**（Test Scenario Layer）
   - 职责：定义测试场景和验证逻辑
   - 文件：`e2e/cardia-deck1-card*.e2e.ts`
   - 特点：声明式配置，代码简洁（~80行）

2. **测试辅助层**（Test Helper Layer）
   - 职责：提供通用测试工具和API
   - 文件：`e2e/helpers/cardia.ts`
   - 特点：可复用，封装复杂逻辑

3. **测试框架层**（Test Framework Layer）
   - 职责：提供底层测试能力
   - 框架：Playwright
   - 特点：稳定可靠，跨浏览器支持



## Components and Interfaces

### 核心组件

#### 1. setupCardiaTestScenario API

**职责**：声明式配置测试场景，一次性创建完整的游戏状态

**接口定义**：
```typescript
interface CardiaTestScenario {
    player1: PlayerScenario;
    player2: PlayerScenario;
    phase?: 'play' | 'ability' | 'end';
    modifierTokens?: ModifierToken[];
    ongoingAbilities?: OngoingAbility[];
    revealFirstNextEncounter?: string;
    currentEncounter?: {
        player1Influence: number;
        player2Influence: number;
        winnerId?: string;
    };
}

interface PlayerScenario {
    hand: string[];              // 手牌（defId数组）
    deck?: string[];             // 牌库（可选）
    playedCards?: PlayedCardScenario[];  // 已打出的牌（可选）
    discard?: string[];          // 弃牌堆（可选）
}

interface PlayedCardScenario {
    defId: string;
    signets?: number;            // 印戒数量
    ongoingMarkers?: string[];   // 持续标记
    modifiers?: Array<{ value: number; source: string }>;
}
```

**使用示例**：
```typescript
const setup = await setupCardiaTestScenario(browser, {
    player1: {
        hand: ['deck_i_card_03'],  // 外科医生
        deck: ['deck_i_card_01', 'deck_i_card_02'],
    },
    player2: {
        hand: ['deck_i_card_06'],  // 占卜师
        deck: ['deck_i_card_07', 'deck_i_card_08'],
    },
    phase: 'play',
});
```

**优势**：
- 代码量减少 80%（从 ~150 行减少到 ~30 行）
- 声明式配置，易读易维护
- 自动处理卡牌实例创建和状态注入
- 支持复杂场景（多回合、修正标记、持续能力）



#### 2. 状态读取 API

**readCoreState**：从调试面板读取 core 状态
```typescript
const state = await readCoreState(page);
// 返回：{ players, phase, modifierTokens, ongoingAbilities, ... }
```

**readLiveState**：从 `window.__BG_STATE__` 读取实时状态
```typescript
const state = await readLiveState(page);
// 返回：{ core, sys: { gameover, interaction, ... } }
```

**使用场景**：
- `readCoreState`：验证游戏逻辑状态（手牌、牌库、印戒）
- `readLiveState`：验证系统状态（游戏结束、交互状态）

#### 3. 交互操作 API

**playCard**：打出指定索引的手牌
```typescript
await playCard(page, 0);  // 打出第一张手牌
```

**waitForPhase**：等待游戏进入指定阶段
```typescript
await waitForPhase(page, 'ability', 10000);  // 等待进入能力阶段
```

**applyCoreStateDirect**：直接注入 core 状态
```typescript
await applyCoreStateDirect(page, modifiedState);
```

#### 4. 测试文件结构

**标准测试文件模板**：
```typescript
import { test, expect } from '@playwright/test';
import { 
    setupCardiaTestScenario,
    readCoreState,
    playCard,
    waitForPhase,
} from './helpers/cardia';

test.describe('Cardia 一号牌组 - 卡牌名称', () => {
    test('影响力X - 卡牌名称：能力描述', async ({ browser }) => {
        // 1. 场景配置（使用新API）
        const setup = await setupCardiaTestScenario(browser, {
            player1: { hand: ['deck_i_card_XX'], deck: [...] },
            player2: { hand: ['deck_i_card_YY'], deck: [...] },
            phase: 'play',
        });
        
        try {
            // 2. 记录初始状态
            const initialState = await readCoreState(setup.player1Page);
            
            // 3. 阶段1：打出卡牌
            await playCard(setup.player1Page, 0);
            await playCard(setup.player2Page, 0);
            
            // 验证阶段1
            const afterPlay = await readCoreState(setup.player1Page);
            expect(afterPlay.phase).toBe('ability');
            
            // 4. 阶段2：激活能力
            await waitForPhase(setup.player1Page, 'ability');
            // ... 能力特定逻辑 ...
            
            // 5. 阶段3：回合结束验证
            await waitForPhase(setup.player1Page, 'play', 15000);
            const afterDraw = await readCoreState(setup.player1Page);
            
            // 验证抽牌
            expect(afterDraw.players['0'].hand.length).toBe(initialHandSize);
            expect(afterDraw.players['0'].deck.length).toBe(initialDeckSize - 1);
            
        } finally {
            await setup.player1Context.close();
            await setup.player2Context.close();
        }
    });
});
```



## Data Models

### 游戏状态数据模型

```typescript
// Core 状态（游戏逻辑状态）
interface CoreState {
    players: Record<string, PlayerState>;
    phase: 'play' | 'ability' | 'end';
    modifierTokens: ModifierToken[];
    ongoingAbilities: OngoingAbility[];
    revealFirstNextEncounter?: string;
    currentEncounter?: EncounterState;
}

// 玩家状态
interface PlayerState {
    hand: CardInstance[];           // 手牌
    deck: CardInstance[];           // 牌库
    playedCards: PlayedCard[];      // 已打出的牌
    discard: CardInstance[];        // 弃牌堆
}

// 卡牌实例
interface CardInstance {
    uid: string;                    // 唯一ID
    defId: string;                  // 卡牌定义ID
    ownerId: string;                // 所有者ID
    baseInfluence: number;          // 基础影响力
    faction: string;                // 派系
    abilityIds: string[];           // 能力ID列表
    difficulty: number;             // 难度
    modifiers: unknown[];           // 修正（已废弃，使用 modifierTokens）
    tags: unknown[];                // 标签
    signets: number;                // 印戒数量
    ongoingMarkers: string[];       // 持续标记
    imageIndex: number;             // 图片索引
    imagePath: string;              // 图片路径
    encounterIndex: number;         // 遭遇索引
}

// 修正标记
interface ModifierToken {
    cardId: string;                 // 目标卡牌UID
    value: number;                  // 修正值
    source: string;                 // 来源（能力ID）
}

// 持续能力
interface OngoingAbility {
    abilityId: string;              // 能力ID
    cardId: string;                 // 目标卡牌UID
    data?: Record<string, unknown>; // 能力数据
}

// 系统状态（引擎状态）
interface SystemState {
    gameover?: {
        winner?: string;            // 获胜者ID
        draw?: boolean;             // 是否平局
    };
    interaction?: {
        current?: Interaction;      // 当前交互
        queue: Interaction[];       // 交互队列
    };
}
```

### 测试场景数据模型

```typescript
// 测试场景配置（简化版，用于测试）
interface CardiaTestScenario {
    player1: PlayerScenario;
    player2: PlayerScenario;
    phase?: 'play' | 'ability' | 'end';
    modifierTokens?: ModifierToken[];
    ongoingAbilities?: OngoingAbility[];
    revealFirstNextEncounter?: string;
}

// 玩家场景配置（简化版）
interface PlayerScenario {
    hand: string[];                 // 手牌（defId数组）
    deck?: string[];                // 牌库（defId数组）
    playedCards?: PlayedCardScenario[];  // 已打出的牌
    discard?: string[];             // 弃牌堆（defId数组）
}

// 已打出的牌配置（简化版）
interface PlayedCardScenario {
    defId: string;                  // 卡牌定义ID
    signets?: number;               // 印戒数量
    ongoingMarkers?: string[];      // 持续标记
    modifiers?: Array<{ value: number; source: string }>;
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 测试场景配置完整性

*For any* 测试场景配置，所有必需字段（player1.hand, player2.hand）必须存在且非空，可选字段（deck, playedCards）如果存在则必须符合类型定义。

**Validates: Requirements 1.1, 1.2**

### Property 2: 阶段推进正确性

*For any* 完整回合流程测试，阶段推进顺序必须为 `play` → `ability` → `end` → `play`（下一回合），且每个阶段的验证点必须在正确的阶段执行。

**Validates: Requirements 2.2, 2.3, 2.6**

### Property 3: 状态变更原子性

*For any* 状态读取操作（readCoreState / readLiveState），返回的状态必须是某个时间点的完整快照，不存在部分更新的中间状态。

**Validates: Requirements 1.3**

### Property 4: 印戒放置正确性

*For any* 遭遇结果，印戒必须且仅能放置在获胜者的牌上，平局时双方都不获得印戒，且印戒数量必须为1（单次遭遇）。

**Validates: Requirements 2.5**

### Property 5: 抽牌逻辑正确性

*For any* 回合结束阶段，双方玩家必须各抽1张牌（如果牌库不为空），手牌数量增加1，牌库数量减少1，牌库为空时不抽牌且不报错。

**Validates: Requirements 2.6**

### Property 6: 胜利条件检查正确性

*For any* 回合结束阶段，如果某玩家场上所有卡牌的印戒总和≥5，游戏必须结束且该玩家获胜；如果双方印戒总和均≥5且相等，游戏继续直到分出多少。

**Validates: Requirements 2.6**

### Property 7: 能力激活权限正确性

*For any* 能力阶段，只有失败者可以激活能力，获胜者不能激活能力，平局时双方都不能激活能力。

**Validates: Requirements 2.5**

### Property 8: 测试资源清理完整性

*For any* 测试执行，无论测试通过或失败，所有创建的 BrowserContext 必须在 finally 块中正确关闭，不泄漏资源。

**Validates: Requirements 5.4**

### Property 9: 修正标记持久性

*For any* 添加到卡牌上的修正标记，必须在后续回合中持续生效，直到被移除或游戏结束。

**Validates: Requirements 4.4**

### Property 10: 持续能力标记持久性

*For any* 放置在卡牌上的持续标记，必须在后续回合中持续生效，直到被移除或游戏结束。

**Validates: Requirements 4.1**



## Error Handling

### 错误处理策略

#### 1. 测试设置失败

**场景**：`setupCardiaTestScenario` 创建对局失败

**处理**：
```typescript
try {
    const setup = await setupCardiaTestScenario(browser, scenario);
    // ... 测试逻辑 ...
} catch (error) {
    console.error('Failed to setup test scenario:', error);
    throw error;  // 让测试失败，不继续执行
} finally {
    // 确保资源清理
    if (setup) {
        await setup.player1Context.close();
        await setup.player2Context.close();
    }
}
```

#### 2. 状态读取失败

**场景**：`readCoreState` / `readLiveState` 读取失败

**处理**：
```typescript
try {
    const state = await readCoreState(page);
    // ... 使用状态 ...
} catch (error) {
    console.error('Failed to read state:', error);
    // 截图保存现场
    await page.screenshot({ 
        path: testInfo.outputPath('state-read-error.png') 
    });
    throw error;
}
```

#### 3. 交互操作超时

**场景**：`playCard` / `waitForPhase` 等待超时

**处理**：
```typescript
try {
    await waitForPhase(page, 'ability', 10000);
} catch (error) {
    console.error('Phase transition timeout:', error);
    // 读取当前状态用于调试
    const currentState = await readCoreState(page).catch(() => null);
    console.log('Current state:', currentState);
    throw error;
}
```

#### 4. 断言失败

**场景**：测试断言失败

**处理**：
```typescript
try {
    expect(actualValue).toBe(expectedValue);
} catch (error) {
    console.error('Assertion failed:', {
        expected: expectedValue,
        actual: actualValue,
        diff: actualValue - expectedValue,
    });
    // 截图保存现场
    await page.screenshot({ 
        path: testInfo.outputPath('assertion-failed.png') 
    });
    throw error;
}
```

#### 5. 资源清理失败

**场景**：BrowserContext 关闭失败

**处理**：
```typescript
finally {
    try {
        await setup.player1Context.close();
    } catch (error) {
        console.warn('Failed to close player1 context:', error);
        // 不抛出错误，避免掩盖测试失败的真实原因
    }
    
    try {
        await setup.player2Context.close();
    } catch (error) {
        console.warn('Failed to close player2 context:', error);
    }
}
```

### 错误日志规范

**日志级别**：
- `console.log`：正常流程日志（阶段推进、状态变更）
- `console.warn`：警告信息（资源清理失败、非关键错误）
- `console.error`：错误信息（测试失败、断言失败）

**日志格式**：
```typescript
console.log('=== 阶段1：打出卡牌 ===');
console.log('初始状态:', { p1Hand: 2, p2Hand: 2 });
console.log('✅ 阶段1验证通过');
console.error('❌ 断言失败:', { expected, actual });
```



## Testing Strategy

### 测试方法论

#### 双重测试策略

**Unit Tests（单元测试）**：
- 职责：验证单个函数/组件的正确性
- 工具：Vitest
- 范围：测试辅助函数（`buildStateFromScenario`, `createCardInstances`）
- 优先级：P2（可选）

**E2E Tests（端到端测试）**：
- 职责：验证完整的用户流程
- 工具：Playwright
- 范围：16个卡牌测试 + 通用回合流程测试
- 优先级：P0（必须）

#### 测试覆盖策略

**三阶段验证模式**（每个测试必须包含）：

1. **阶段1验证**（打出卡牌）
   - 双方都能打出卡牌
   - 卡牌正确添加到 `playedCards` 数组
   - 手牌数量减少1
   - 阶段自动推进到 `ability`

2. **阶段2验证**（激活能力）
   - 影响力比较正确（基础值 + 修正标记）
   - 胜负判定正确
   - 印戒放置正确（放在获胜的那张牌上）
   - 只有失败者能激活能力
   - 能力效果正确执行
   - 持续能力正确放置持续标记
   - 平局时跳过能力阶段

3. **阶段3验证**（回合结束）
   - 双方都抽1张牌（如果牌库不为空）
   - 手牌数量增加1
   - 牌库数量减少1
   - 牌库为空时不抽牌（不报错）
   - 胜利条件检查正确
   - 阶段自动推进到下一回合的 `play`

#### 测试配置

**Playwright 配置**：
```typescript
{
    workers: 4,                    // 并行执行4个测试
    timeout: 30000,                // 单个测试超时30秒
    retries: 1,                    // 失败重试1次
    preserveOutput: 'always',      // 保留所有测试输出
    use: {
        screenshot: 'only-on-failure',  // 失败时截图
        video: 'retain-on-failure',     // 失败时录屏
    }
}
```

**测试标签**：
```typescript
// 标记关键能力测试
test('影响力4 - 调停者：强制平局', { tag: '@critical' }, async ({ browser }) => {
    // ...
});

// 标记边界条件测试
test('影响力5 - 破坏者：牌库不足2张', { tag: '@edge-case' }, async ({ browser }) => {
    // ...
});
```

#### 测试执行策略

**开发阶段**：
```bash
# 运行单个测试（快速验证）
npx playwright test cardia-deck1-card03-surgeon-new-api.e2e.ts

# 运行所有卡牌测试（完整验证）
npx playwright test cardia-deck1-card*.e2e.ts

# 运行关键能力测试
npx playwright test --grep @critical
```

**CI/CD 阶段**：
```bash
# 运行所有测试（并行执行）
npx playwright test --workers=4

# 生成测试报告
npx playwright show-report
```



### 测试优先级分级

#### P0（必须完成）- 16个卡牌测试重写

**目标**：使用新API重写所有测试，补充完整回合流程验证

**文件列表**：
1. `cardia-deck1-card01-mercenary-swordsman.e2e.ts` - 雇佣剑士
2. `cardia-deck1-card02-void-mage.e2e.ts` - 虚空法师（需修复）
3. `cardia-deck1-card03-surgeon.e2e.ts` - 外科医生
4. `cardia-deck1-card04-mediator.e2e.ts` - 调停者
5. `cardia-deck1-card05-saboteur.e2e.ts` - 破坏者
6. `cardia-deck1-card06-diviner.e2e.ts` - 占卜师
7. `cardia-deck1-card07-court-guard.e2e.ts` - 宫廷卫士
8. `cardia-deck1-card08-judge.e2e.ts` - 审判官
9. `cardia-deck1-card09-ambusher.e2e.ts` - 伏击者
10. `cardia-deck1-card10-puppeteer.e2e.ts` - 傀儡师
11. `cardia-deck1-card11-clockmaker.e2e.ts` - 钟表匠
12. `cardia-deck1-card12-treasurer.e2e.ts` - 财务官
13. `cardia-deck1-card13-swamp-guard.e2e.ts` - 沼泽守卫
14. `cardia-deck1-card14-governess.e2e.ts` - 女导师
15. `cardia-deck1-card15-inventor.e2e.ts` - 发明家
16. `cardia-deck1-card16-elf.e2e.ts` - 精灵

**验收标准**：
- ✅ 所有测试使用 `setupCardiaTestScenario` API
- ✅ 所有测试包含三阶段验证
- ✅ 所有测试通过（16/16）
- ✅ 代码量减少至少60%

#### P1（高优先级）- 关键能力特殊验证

**目标**：为关键能力添加特殊验证逻辑

**文件列表**：
1. `card04-mediator.e2e.ts` - 平局机制验证
2. `card06-diviner.e2e.ts` - 揭示顺序验证
3. `card10-puppeteer.e2e.ts` - 复制能力验证
4. `card15-inventor.e2e.ts` - 特殊机制验证
5. `card16-elf.e2e.ts` - 直接获胜验证

**验收标准**：
- ✅ 平局时印戒归还验证
- ✅ 揭示顺序变更验证
- ✅ 复制能力完整效果验证
- ✅ 特殊机制完整流程验证
- ✅ 直接获胜跳过阶段3验证

#### P2（中优先级）- 边界条件测试

**目标**：补充边界条件和异常场景测试

**场景列表**：
1. 牌库不足时的处理（破坏者）
2. 条件满足/不满足两种情况（财务官、沼泽守卫）
3. 牌库为空时的游戏结束
4. 双方同时达到5印戒的平局处理

**验收标准**：
- ✅ 边界条件不报错
- ✅ 异常场景有合理降级
- ✅ 错误信息清晰

#### P3（低优先级）- 性能优化

**目标**：优化测试执行时间

**优化方向**：
1. 减少不必要的等待时间
2. 优化状态读取频率
3. 并行执行测试
4. 复用 BrowserContext

**验收标准**：
- ✅ 测试套件在5分钟内完成
- ✅ 单个测试在30秒内完成



## Implementation Details

### 测试重写流程

#### 步骤1：分析现有测试

**目标**：理解现有测试的验证逻辑和特殊场景

**检查清单**：
- [ ] 卡牌能力描述（影响力、能力效果）
- [ ] 测试场景配置（手牌、牌库、已打出的牌）
- [ ] 能力激活流程（是否需要交互、选择）
- [ ] 验证点（状态变更、事件触发）
- [ ] 特殊逻辑（平局、直接获胜、条件判断）

**示例**（外科医生）：
```typescript
// 现有测试（旧API）
const setup = await setupCardiaOnlineMatch(browser);
await injectHandCards(p1Page, '0', [{ defId: 'deck_i_card_03' }]);
await injectHandCards(p2Page, '1', [{ defId: 'deck_i_card_06' }]);
await setPhase(p1Page, 'play');
// ... 约150行代码 ...
```

#### 步骤2：使用新API重写

**目标**：用 `setupCardiaTestScenario` 替换旧API

**转换规则**：
```typescript
// 旧API（手动注入）
await injectHandCards(p1Page, '0', [{ defId: 'deck_i_card_03' }]);
await injectHandCards(p2Page, '1', [{ defId: 'deck_i_card_06' }]);
await setPhase(p1Page, 'play');

// 新API（声明式配置）
const setup = await setupCardiaTestScenario(browser, {
    player1: { hand: ['deck_i_card_03'], deck: ['deck_i_card_01', 'deck_i_card_02'] },
    player2: { hand: ['deck_i_card_06'], deck: ['deck_i_card_07', 'deck_i_card_08'] },
    phase: 'play',
});
```

**代码量对比**：
- 旧API：~150行（手动注入 + 状态管理）
- 新API：~80行（声明式配置 + 验证逻辑）
- 减少：~70行（约47%）

#### 步骤3：补充完整回合流程验证

**目标**：为每个测试添加三阶段验证

**验证模板**：
```typescript
// 记录初始状态
const initialState = await readCoreState(setup.player1Page);
const initialP1HandSize = initialState.players['0'].hand.length;
const initialP1DeckSize = initialState.players['0'].deck.length;

// ===== 阶段1：打出卡牌 =====
await playCard(setup.player1Page, 0);
await playCard(setup.player2Page, 0);

const afterPlay = await readCoreState(setup.player1Page);
expect(afterPlay.players['0'].playedCards.length).toBe(1);
expect(afterPlay.phase).toBe('ability');

// ===== 阶段2：激活能力 =====
await waitForPhase(setup.player1Page, 'ability');
// ... 能力特定逻辑 ...

// ===== 阶段3：回合结束 =====
await waitForPhase(setup.player1Page, 'play', 15000);

const afterDraw = await readCoreState(setup.player1Page);
expect(afterDraw.players['0'].hand.length).toBe(initialP1HandSize);
expect(afterDraw.players['0'].deck.length).toBe(initialP1DeckSize - 1);
expect(afterDraw.phase).toBe('play');
```

#### 步骤4：添加特殊验证

**目标**：为关键能力添加特殊验证逻辑

**特殊场景清单**：

1. **调停者（card04）**：平局机制
```typescript
// 验证：平局时印戒归还
const beforeAbility = await readCoreState(setup.player1Page);
const p1Card = beforeAbility.players['0'].playedCards[0];
const p2Card = beforeAbility.players['1'].playedCards[0];

// 激活调停者能力后，双方影响力相等
const afterAbility = await readCoreState(setup.player1Page);
expect(p1Card.signets || 0).toBe(0);  // 印戒归还
expect(p2Card.signets || 0).toBe(0);
```

2. **占卜师（card06）**：揭示顺序
```typescript
// 验证：下回合对手先揭示
const afterAbility = await readCoreState(setup.player1Page);
expect(afterAbility.revealFirstNextEncounter).toBe('1');  // P2先揭示
```

3. **傀儡师（card10）**：复制能力
```typescript
// 验证：复制对手的牌
const afterAbility = await readCoreState(setup.player1Page);
const p1PlayedCards = afterAbility.players['0'].playedCards;
const p2PlayedCards = afterAbility.players['1'].playedCards;

// P1的牌被替换为P2的牌
expect(p1PlayedCards[0].defId).toBe(p2PlayedCards[0].defId);
```

4. **精灵（card16）**：直接获胜
```typescript
// 验证：直接获胜，跳过阶段3
const endgameOverlay = setup.player1Page.locator('[data-testid="endgame-overlay"]');
await endgameOverlay.waitFor({ state: 'visible', timeout: 10000 });

const finalState = await readLiveState(setup.player1Page);
expect(finalState.sys?.gameover?.winner).toBe('0');  // P1直接获胜
```



#### 步骤5：修复 card02 测试失败

**问题分析**：
- 虚空法师能力：移除修正标记和持续标记
- 前置条件：场上需要有修正标记
- 当前问题：单回合无法创建修正标记场景

**解决方案A**：简化测试场景
```typescript
const setup = await setupCardiaTestScenario(browser, {
    player1: {
        hand: ['deck_i_card_02'],  // 虚空法师
        deck: ['deck_i_card_01'],
        playedCards: [
            { 
                defId: 'deck_i_card_03',  // 已有修正标记的牌
                modifiers: [{ value: 5, source: 'ability_i_surgeon' }]
            }
        ],
    },
    player2: {
        hand: ['deck_i_card_06'],
        deck: ['deck_i_card_07'],
    },
    phase: 'play',
    modifierTokens: [
        { cardId: 'test_0_2000', value: 5, source: 'ability_i_surgeon' }
    ],
});
```

**解决方案B**：使用两轮遭遇
```typescript
// 第一轮：外科医生添加修正标记
const setup = await setupCardiaTestScenario(browser, {
    player1: {
        hand: ['deck_i_card_03', 'deck_i_card_02'],  // 外科医生 + 虚空法师
        deck: ['deck_i_card_01'],
    },
    player2: {
        hand: ['deck_i_card_06', 'deck_i_card_07'],
        deck: ['deck_i_card_08'],
    },
    phase: 'play',
});

// 第一轮：打出外科医生，添加修正标记
await playCard(setup.player1Page, 0);
await playCard(setup.player2Page, 0);
await waitForPhase(setup.player1Page, 'ability');
// ... 激活外科医生能力 ...

// 等待回合结束，进入下一回合
await waitForPhase(setup.player1Page, 'play', 15000);

// 第二轮：打出虚空法师，移除修正标记
await playCard(setup.player1Page, 0);  // 虚空法师
await playCard(setup.player2Page, 0);
await waitForPhase(setup.player1Page, 'ability');
// ... 激活虚空法师能力 ...

// 验证：修正标记被移除
const afterAbility = await readCoreState(setup.player1Page);
expect(afterAbility.modifierTokens.length).toBe(0);
```

**推荐方案**：方案A（简化测试场景）
- 优点：代码简洁，测试稳定
- 缺点：需要手动构造 modifierTokens
- 理由：测试重点是"移除修正标记"，不是"创建修正标记"

#### 步骤6：运行测试并验证

**验证清单**：
- [ ] 所有测试通过（16/16）
- [ ] 代码量减少至少60%
- [ ] 三阶段验证完整
- [ ] 特殊验证逻辑正确
- [ ] 错误日志清晰
- [ ] 资源清理完整

**测试命令**：
```bash
# 运行单个测试
npx playwright test cardia-deck1-card03-surgeon-new-api.e2e.ts

# 运行所有卡牌测试
npx playwright test cardia-deck1-card*.e2e.ts --workers=4

# 生成测试报告
npx playwright show-report
```



### 测试辅助函数设计

#### 1. calculateInfluence（计算影响力）

**职责**：计算卡牌的当前影响力（基础值 + 修正标记）

**接口**：
```typescript
function calculateInfluence(
    card: { uid: string; baseInfluence: number },
    modifierTokens: ModifierToken[]
): number {
    const modifiers = modifierTokens
        .filter(m => m.cardId === card.uid)
        .reduce((sum, m) => sum + m.value, 0);
    return card.baseInfluence + modifiers;
}
```

**使用场景**：
```typescript
const p1Card = state.players['0'].playedCards[0];
const p2Card = state.players['1'].playedCards[0];
const p1Influence = calculateInfluence(p1Card, state.modifierTokens);
const p2Influence = calculateInfluence(p2Card, state.modifierTokens);

console.log('影响力比较:', { p1Influence, p2Influence });
expect(p2Influence).toBeGreaterThan(p1Influence);
```

#### 2. waitForAbilityButton（等待能力按钮）

**职责**：等待能力按钮出现或确认不出现

**接口**：
```typescript
async function waitForAbilityButton(
    page: Page,
    shouldAppear: boolean,
    timeout = 5000
): Promise<boolean> {
    const button = page.locator('[data-testid="cardia-activate-ability-btn"]');
    
    if (shouldAppear) {
        await button.waitFor({ state: 'visible', timeout });
        return true;
    } else {
        try {
            await button.waitFor({ state: 'visible', timeout: 1000 });
            return true;  // 按钮出现了（不符合预期）
        } catch {
            return false;  // 按钮未出现（符合预期）
        }
    }
}
```

**使用场景**：
```typescript
// P1失败，应该有能力按钮
const hasButton = await waitForAbilityButton(setup.player1Page, true);
expect(hasButton).toBe(true);

// P2获胜，不应该有能力按钮
const hasButton = await waitForAbilityButton(setup.player2Page, false);
expect(hasButton).toBe(false);
```

#### 3. endTurn（结束回合）

**职责**：点击"结束回合"按钮或跳过能力

**接口**：
```typescript
async function endTurn(page: Page): Promise<void> {
    // 尝试点击跳过能力按钮
    const skipButton = page.locator('[data-testid="cardia-skip-ability-btn"]');
    if (await skipButton.isVisible().catch(() => false)) {
        await skipButton.click();
        await page.waitForTimeout(500);
    }
    
    // 尝试点击结束回合按钮
    const endButton = page.locator('[data-testid="cardia-end-turn-btn"]');
    if (await endButton.isVisible().catch(() => false)) {
        await endButton.click();
        await page.waitForTimeout(500);
    }
}
```

**使用场景**：
```typescript
// 阶段2结束后，结束回合
await waitForPhase(setup.player1Page, 'ability');
await endTurn(setup.player1Page);

// 等待进入下一回合
await waitForPhase(setup.player1Page, 'play', 15000);
```

#### 4. verifyPhase1（验证阶段1）

**职责**：验证阶段1的所有验证点

**接口**：
```typescript
async function verifyPhase1(
    page: Page,
    initialState: { p1HandSize: number; p2HandSize: number }
): Promise<void> {
    const afterPlay = await readCoreState(page);
    const players = afterPlay.players as Record<string, PlayerState>;
    
    // 验证：场上有牌
    expect(players['0'].playedCards.length).toBe(1);
    expect(players['1'].playedCards.length).toBe(1);
    
    // 验证：手牌减少
    expect(players['0'].hand.length).toBe(initialState.p1HandSize - 1);
    expect(players['1'].hand.length).toBe(initialState.p2HandSize - 1);
    
    // 验证：阶段推进
    expect(afterPlay.phase).toBe('ability');
    
    console.log('✅ 阶段1验证通过');
}
```

#### 5. verifyPhase3（验证阶段3）

**职责**：验证阶段3的所有验证点

**接口**：
```typescript
async function verifyPhase3(
    page: Page,
    initialState: { 
        p1HandSize: number; 
        p2HandSize: number;
        p1DeckSize: number;
        p2DeckSize: number;
    }
): Promise<void> {
    const afterDraw = await readCoreState(page);
    const players = afterDraw.players as Record<string, PlayerState>;
    
    // 验证：双方抽牌
    expect(players['0'].hand.length).toBe(initialState.p1HandSize);
    expect(players['1'].hand.length).toBe(initialState.p2HandSize);
    
    // 验证：牌库减少
    expect(players['0'].deck.length).toBe(initialState.p1DeckSize - 1);
    expect(players['1'].deck.length).toBe(initialState.p2DeckSize - 1);
    
    // 验证：阶段推进
    expect(afterDraw.phase).toBe('play');
    
    console.log('✅ 阶段3验证通过');
}
```



## Performance Considerations

### 性能优化策略

#### 1. 并行执行测试

**目标**：减少测试总执行时间

**配置**：
```typescript
// playwright.config.ts
export default defineConfig({
    workers: 4,  // 并行执行4个测试
    fullyParallel: true,
});
```

**效果**：
- 串行执行：16个测试 × 30秒 = 8分钟
- 并行执行：16个测试 ÷ 4 workers = 4组 × 30秒 = 2分钟
- 提升：75%

#### 2. 减少不必要的等待

**问题**：过度使用 `page.waitForTimeout()`

**优化前**：
```typescript
await playCard(page, 0);
await page.waitForTimeout(2000);  // 固定等待2秒
```

**优化后**：
```typescript
await playCard(page, 0);
await waitForPhase(page, 'ability', 5000);  // 等待阶段推进，最多5秒
```

**效果**：
- 优化前：每个操作固定等待2秒
- 优化后：阶段推进后立即继续，平均等待0.5秒
- 提升：75%

#### 3. 复用 BrowserContext

**问题**：每个测试都创建新的 BrowserContext

**优化前**：
```typescript
test('测试1', async ({ browser }) => {
    const setup = await setupCardiaTestScenario(browser, ...);
    // ...
    await setup.player1Context.close();
    await setup.player2Context.close();
});

test('测试2', async ({ browser }) => {
    const setup = await setupCardiaTestScenario(browser, ...);
    // ...
});
```

**优化后**（可选，P3优先级）：
```typescript
test.describe.serial('Cardia 卡组一测试', () => {
    let sharedSetup: CardiaMatchSetup;
    
    test.beforeAll(async ({ browser }) => {
        sharedSetup = await setupCardiaTestScenario(browser, ...);
    });
    
    test.afterAll(async () => {
        await sharedSetup.player1Context.close();
        await sharedSetup.player2Context.close();
    });
    
    test('测试1', async () => {
        // 使用 sharedSetup
    });
    
    test('测试2', async () => {
        // 使用 sharedSetup
    });
});
```

**注意**：
- 优点：减少 BrowserContext 创建开销
- 缺点：测试之间可能相互影响
- 推荐：仅在测试完全独立时使用

#### 4. 优化状态读取频率

**问题**：频繁读取状态导致性能下降

**优化前**：
```typescript
const state1 = await readCoreState(page);
console.log('状态1:', state1.phase);

const state2 = await readCoreState(page);
console.log('状态2:', state2.players);

const state3 = await readCoreState(page);
console.log('状态3:', state3.modifierTokens);
```

**优化后**：
```typescript
const state = await readCoreState(page);
console.log('状态:', {
    phase: state.phase,
    players: state.players,
    modifierTokens: state.modifierTokens,
});
```

**效果**：
- 优化前：3次状态读取 × 100ms = 300ms
- 优化后：1次状态读取 × 100ms = 100ms
- 提升：67%

### 性能监控

**测试执行时间监控**：
```typescript
test('影响力3 - 外科医生', async ({ browser }) => {
    const startTime = Date.now();
    
    // ... 测试逻辑 ...
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`测试执行时间: ${duration}ms`);
    
    // 警告：测试执行时间超过30秒
    if (duration > 30000) {
        console.warn('⚠️ 测试执行时间过长:', duration);
    }
});
```

**性能基准**：
- 单个测试：< 30秒
- 测试套件（16个测试）：< 5分钟（并行执行）
- 状态读取：< 100ms
- 交互操作：< 500ms



## Security Considerations

### 测试安全性

#### 1. 测试隔离

**原则**：每个测试必须完全独立，不依赖其他测试的状态

**实现**：
```typescript
test('测试1', async ({ browser }) => {
    const setup = await setupCardiaTestScenario(browser, ...);
    
    try {
        // 测试逻辑
    } finally {
        // 确保资源清理
        await setup.player1Context.close();
        await setup.player2Context.close();
    }
});
```

**验证**：
- 测试可以单独运行
- 测试顺序不影响结果
- 测试失败不影响其他测试

#### 2. 敏感信息保护

**原则**：测试代码不包含敏感信息（密码、Token、API密钥）

**实现**：
```typescript
// ❌ 错误：硬编码敏感信息
const apiKey = 'sk-1234567890abcdef';

// ✅ 正确：使用环境变量
const apiKey = process.env.API_KEY;
```

**检查清单**：
- [ ] 无硬编码密码
- [ ] 无硬编码 API 密钥
- [ ] 无硬编码用户凭证
- [ ] 无硬编码数据库连接字符串

#### 3. 测试数据安全

**原则**：测试使用模拟数据，不访问生产数据

**实现**：
```typescript
// ✅ 正确：使用测试数据
const setup = await setupCardiaTestScenario(browser, {
    player1: { hand: ['deck_i_card_01'] },  // 测试卡牌
    player2: { hand: ['deck_i_card_02'] },
});

// ❌ 错误：访问生产数据
const realUserData = await fetchProductionUserData();
```

#### 4. 资源清理

**原则**：测试结束后必须清理所有资源，防止资源泄漏

**实现**：
```typescript
test('测试', async ({ browser }) => {
    const setup = await setupCardiaTestScenario(browser, ...);
    
    try {
        // 测试逻辑
    } finally {
        // 确保资源清理（即使测试失败）
        try {
            await setup.player1Context.close();
        } catch (error) {
            console.warn('Failed to close player1 context:', error);
        }
        
        try {
            await setup.player2Context.close();
        } catch (error) {
            console.warn('Failed to close player2 context:', error);
        }
    }
});
```

### 测试环境安全

#### 1. 测试服务器隔离

**原则**：测试使用独立的测试服务器，不影响生产环境

**配置**：
```typescript
// .env.test
VITE_FRONTEND_URL=http://localhost:5173
GAME_SERVER_PORT=18000
API_SERVER_PORT=18001
```

#### 2. 测试数据库隔离

**原则**：测试使用独立的测试数据库，不污染生产数据

**配置**：
```typescript
// .env.test
MONGODB_URI=mongodb://localhost:27017/cardia_test
```

#### 3. 网络隔离

**原则**：测试不访问外部网络，所有依赖都在本地

**实现**：
- 使用本地服务器（localhost）
- 不访问外部 API
- 不发送真实邮件/短信



## Deployment and Operations

### 测试部署策略

#### 1. 本地开发环境

**目标**：开发者在本地运行测试

**前置条件**：
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

**运行测试**：
```bash
# 运行单个测试
npx playwright test cardia-deck1-card03-surgeon-new-api.e2e.ts

# 运行所有卡牌测试
npx playwright test cardia-deck1-card*.e2e.ts

# 运行测试并生成报告
npx playwright test --reporter=html
npx playwright show-report
```

#### 2. CI/CD 环境

**目标**：自动化测试集成到 CI/CD 流水线

**GitHub Actions 配置**：
```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Start services
        run: npm run dev &
        
      - name: Wait for services
        run: npx wait-on http://localhost:5173
      
      - name: Run E2E tests
        run: npx playwright test cardia-deck1-card*.e2e.ts --workers=4
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

#### 3. 测试报告

**HTML 报告**：
```bash
# 生成 HTML 报告
npx playwright test --reporter=html

# 查看报告
npx playwright show-report
```

**JSON 报告**：
```bash
# 生成 JSON 报告
npx playwright test --reporter=json --output=test-results.json
```

**自定义报告**：
```typescript
// playwright.config.ts
export default defineConfig({
    reporter: [
        ['html', { outputFolder: 'playwright-report' }],
        ['json', { outputFile: 'test-results.json' }],
        ['junit', { outputFile: 'test-results.xml' }],
    ],
});
```

### 测试维护策略

#### 1. 测试失败处理

**流程**：
1. 查看测试报告，定位失败的测试
2. 查看截图和录屏，分析失败原因
3. 本地复现问题
4. 修复代码或更新测试
5. 重新运行测试，确认通过

**常见失败原因**：
- 超时：增加超时时间或优化等待策略
- 断言失败：检查预期值是否正确
- 元素未找到：检查选择器是否正确
- 状态不一致：检查状态注入是否正确

#### 2. 测试更新策略

**场景1：游戏规则变更**
- 更新测试场景配置
- 更新验证逻辑
- 更新预期值

**场景2：UI 变更**
- 更新选择器（data-testid）
- 更新交互逻辑
- 更新截图基准

**场景3：新增卡牌**
- 复制现有测试模板
- 修改卡牌配置
- 添加特殊验证逻辑

#### 3. 测试清理策略

**定期清理**：
- 删除过时的测试文件
- 删除未使用的辅助函数
- 删除重复的测试逻辑

**测试输出清理**：
```bash
# 清理测试输出
rm -rf playwright-report/
rm -rf test-results/
rm -rf test-results.json
```

### 监控和告警

#### 1. 测试通过率监控

**指标**：
- 测试通过率：通过测试数 / 总测试数
- 目标：≥ 95%

**告警**：
- 测试通过率 < 95%：发送告警通知
- 连续3次测试失败：升级告警

#### 2. 测试执行时间监控

**指标**：
- 单个测试执行时间：< 30秒
- 测试套件执行时间：< 5分钟

**告警**：
- 单个测试执行时间 > 30秒：记录警告
- 测试套件执行时间 > 5分钟：发送告警通知

#### 3. 测试稳定性监控

**指标**：
- 测试稳定性：连续通过次数 / 总运行次数
- 目标：≥ 98%

**告警**：
- 测试稳定性 < 98%：标记为不稳定测试
- 不稳定测试数量 > 3：发送告警通知



## Migration Strategy

### 迁移计划

#### 阶段1：准备阶段（1小时）

**目标**：准备迁移环境和工具

**任务清单**：
- [x] 确认 `setupCardiaTestScenario` API 可用
- [x] 确认参考实现（card03-surgeon-new-api）可用
- [x] 准备测试文件清单（16个文件）
- [x] 准备验证清单（三阶段验证）

**产出**：
- 测试文件清单
- 验证清单
- 迁移模板

#### 阶段2：批量迁移（8-12小时）

**目标**：重写所有16个测试文件

**迁移顺序**（按复杂度排序）：

**简单能力（4小时，6个文件）**：
1. card01 - 雇佣剑士（即时能力，弃牌）
2. card03 - 外科医生（即时能力，添加修正）
3. card05 - 破坏者（即时能力，弃牌库）
4. card08 - 审判官（持续能力）
5. card11 - 钟表匠（即时能力，回收）
6. card12 - 财务官（条件能力，抽牌）

**中等复杂度（4小时，6个文件）**：
7. card04 - 调停者（持续能力，平局）
8. card06 - 占卜师（即时能力，揭示顺序）
9. card07 - 宫廷卫士（条件能力，派系）
10. card09 - 伏击者（即时能力，揭示顺序）
11. card13 - 沼泽守卫（条件能力，派系）
12. card14 - 女导师（特殊能力）

**复杂能力（4小时，4个文件）**：
13. card02 - 虚空法师（即时能力，移除修正，需修复）
14. card10 - 傀儡师（即时能力，复制）
15. card15 - 发明家（特殊机制）
16. card16 - 精灵（直接获胜）

**每个文件的迁移流程**（约30-45分钟）：
1. 分析现有测试（5分钟）
2. 使用新API重写（10分钟）
3. 补充三阶段验证（15分钟）
4. 添加特殊验证（5分钟）
5. 运行测试并修复（5分钟）

#### 阶段3：验证阶段（2小时）

**目标**：确保所有测试通过

**验证清单**：
- [ ] 所有测试使用新API
- [ ] 所有测试包含三阶段验证
- [ ] 所有测试通过（16/16）
- [ ] 代码量减少至少60%
- [ ] 特殊验证逻辑正确
- [ ] 错误日志清晰
- [ ] 资源清理完整

**验证命令**：
```bash
# 运行所有测试
npx playwright test cardia-deck1-card*.e2e.ts --workers=4

# 生成测试报告
npx playwright show-report

# 检查代码量
wc -l e2e/cardia-deck1-card*.e2e.ts
```

#### 阶段4：清理阶段（1小时）

**目标**：清理旧代码和文档

**任务清单**：
- [ ] 删除旧测试文件（如果有备份）
- [ ] 更新测试文档
- [ ] 更新 README
- [ ] 提交代码

### 回滚策略

**场景1：新API不稳定**
- 回滚到旧API
- 保留旧测试文件作为备份

**场景2：测试通过率下降**
- 分析失败原因
- 修复问题或回滚

**场景3：性能下降**
- 优化测试代码
- 调整并行度

### 风险管理

**风险1：迁移时间超预期**
- 影响：延迟交付
- 缓解：按优先级迁移，先完成简单能力
- 应对：延长迁移时间或减少范围

**风险2：测试通过率下降**
- 影响：测试质量下降
- 缓解：每个文件迁移后立即验证
- 应对：回滚到旧API

**风险3：新API有bug**
- 影响：测试不稳定
- 缓解：使用参考实现验证API
- 应对：修复API或回滚

**风险4：特殊验证逻辑遗漏**
- 影响：测试覆盖不完整
- 缓解：使用验证清单检查
- 应对：补充遗漏的验证逻辑



## Appendix

### A. 测试文件清单

| 序号 | 文件名 | 卡牌名称 | 影响力 | 能力类型 | 复杂度 | 状态 |
|------|--------|----------|--------|----------|--------|------|
| 1 | card01-mercenary-swordsman.e2e.ts | 雇佣剑士 | 1 | 即时（弃牌） | 简单 | 待迁移 |
| 2 | card02-void-mage.e2e.ts | 虚空法师 | 2 | 即时（移除修正） | 复杂 | 待修复 |
| 3 | card03-surgeon.e2e.ts | 外科医生 | 3 | 即时（添加修正） | 简单 | ✅ 已完成 |
| 4 | card04-mediator.e2e.ts | 调停者 | 4 | 持续（平局） | 中等 | 待迁移 |
| 5 | card05-saboteur.e2e.ts | 破坏者 | 5 | 即时（弃牌库） | 简单 | 待迁移 |
| 6 | card06-diviner.e2e.ts | 占卜师 | 6 | 即时（揭示顺序） | 中等 | 待迁移 |
| 7 | card07-court-guard.e2e.ts | 宫廷卫士 | 7 | 条件（派系） | 中等 | 待迁移 |
| 8 | card08-judge.e2e.ts | 审判官 | 8 | 持续 | 简单 | 待迁移 |
| 9 | card09-ambusher.e2e.ts | 伏击者 | 9 | 即时（揭示顺序） | 中等 | 待迁移 |
| 10 | card10-puppeteer.e2e.ts | 傀儡师 | 10 | 即时（复制） | 复杂 | 待迁移 |
| 11 | card11-clockmaker.e2e.ts | 钟表匠 | 11 | 即时（回收） | 简单 | 待迁移 |
| 12 | card12-treasurer.e2e.ts | 财务官 | 12 | 条件（抽牌） | 简单 | 待迁移 |
| 13 | card13-swamp-guard.e2e.ts | 沼泽守卫 | 13 | 条件（派系） | 中等 | 待迁移 |
| 14 | card14-governess.e2e.ts | 女导师 | 14 | 特殊 | 中等 | 待迁移 |
| 15 | card15-inventor.e2e.ts | 发明家 | 15 | 特殊 | 复杂 | 待迁移 |
| 16 | card16-elf.e2e.ts | 精灵 | 16 | 直接获胜 | 复杂 | 待迁移 |

### B. 验证清单模板

```markdown
## 测试验证清单

### 基础验证
- [ ] 使用 `setupCardiaTestScenario` API
- [ ] 代码量 < 100行
- [ ] 包含 try-finally 资源清理
- [ ] 包含清晰的日志输出

### 阶段1验证（打出卡牌）
- [ ] 双方都打出卡牌
- [ ] 卡牌添加到 `playedCards`
- [ ] 手牌数量减少1
- [ ] 阶段推进到 `ability`

### 阶段2验证（激活能力）
- [ ] 影响力比较正确
- [ ] 胜负判定正确
- [ ] 印戒放置正确
- [ ] 能力激活权限正确
- [ ] 能力效果正确执行

### 阶段3验证（回合结束）
- [ ] 双方都抽1张牌
- [ ] 手牌数量恢复
- [ ] 牌库数量减少1
- [ ] 胜利条件检查正确
- [ ] 阶段推进到下一回合

### 特殊验证（如适用）
- [ ] 修正标记持久性
- [ ] 持续标记持久性
- [ ] 平局机制
- [ ] 揭示顺序
- [ ] 直接获胜
- [ ] 边界条件
```

### C. 参考资源

**文档**：
- 需求文档：`.kiro/specs/cardia-e2e-test-optimization/requirements.md`
- 设计文档：`.kiro/specs/cardia-e2e-test-optimization/design.md`（本文档）
- 审计计划：`.kiro/specs/cardia-ability-implementation/E2E-DECK1-FULL-TURN-AUDIT-PLAN.md`
- 游戏规则：`src/games/cardia/rule/卡迪亚规则.md`

**参考实现**：
- 新API示例：`e2e/cardia-deck1-card03-surgeon-new-api.e2e.ts`
- 通用回合流程：`e2e/cardia-full-turn-flow.e2e.ts`
- 测试辅助函数：`e2e/helpers/cardia.ts`

**工具**：
- Playwright 文档：https://playwright.dev/
- TypeScript 文档：https://www.typescriptlang.org/

### D. 术语表

| 术语 | 英文 | 定义 |
|------|------|------|
| E2E测试 | E2E Test | 端到端测试，模拟真实用户操作验证完整功能流程 |
| 印戒 | Signet | 游戏中的胜利点数，达到5个印戒即获胜 |
| 修正标记 | Modifier Token | 临时修改卡牌影响力的标记 |
| 持续标记 | Ongoing Marker | 标记卡牌上有持续生效的能力 |
| 影响力 | Influence | 卡牌的战斗力值，用于比较胜负 |
| 遭遇 | Encounter | 一次完整的回合，包括打牌、比较、能力激活 |
| 阶段 | Phase | 回合中的子阶段（play/ability/end） |
| 派系 | Faction | 卡牌所属的派系（如：军事、魔法、自然） |

### E. 变更历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| 1.0 | 2026-03-01 | AI Assistant | 初始版本，完整设计文档 |

---

## 总结

本设计文档定义了 Cardia E2E 测试优化项目的完整技术方案，包括：

1. **架构设计**：三层测试模型（场景层/辅助层/框架层）
2. **核心组件**：`setupCardiaTestScenario` API 和测试辅助函数
3. **数据模型**：游戏状态和测试场景的数据结构
4. **正确性属性**：10个核心属性确保测试质量
5. **错误处理**：完善的错误处理和日志策略
6. **测试策略**：三阶段验证模式和测试优先级分级
7. **实现细节**：6步测试重写流程和辅助函数设计
8. **性能优化**：并行执行、减少等待、优化状态读取
9. **安全考虑**：测试隔离、敏感信息保护、资源清理
10. **部署运维**：本地开发、CI/CD集成、监控告警
11. **迁移策略**：4阶段迁移计划和风险管理

**预期成果**：
- ✅ 代码量减少 80%（从 ~150行 减少到 ~80行）
- ✅ 测试通过率 100%（16/16）
- ✅ 测试覆盖完整（三阶段验证）
- ✅ 测试稳定可靠（资源清理、错误处理）
- ✅ 测试易于维护（声明式配置、清晰日志）

**下一步行动**：
1. 开始阶段2批量迁移（按优先级顺序）
2. 每个文件迁移后立即验证
3. 完成后运行完整测试套件
4. 生成测试报告并提交代码

