# Design Document: Cardia AI Opponent

## Overview

本文档设计 Cardia 游戏的 AI 对手系统。系统将复用项目统一的引擎层 AI 框架 (`src/engine/ai/`),参考 Dice Throne 和 Summoner Wars 的实现模式,使用策略标签系统实现可配置的决策行为。

### 核心目标

1. **复用引擎层 AI 框架**:使用 `GameAiRuntime` 接口、`AiStrategyProfile`、`LocalAiActionScorer` 等统一抽象
2. **策略标签驱动**:通过策略标签 (`aggro`/`control`/`economy`/`tempo`/`value`) 标记动作特征,支持可配置的 AI 行为
3. **合法动作生成**:枚举打牌、能力激活、交互选择等所有合法动作
4. **启发式评分**:基于卡牌影响力、能力价值、场面状态等因素为动作打分
5. **预设策略配置**:提供进攻型/防守型/平衡型等至少 3 种预设策略

### 技术约束

- 必须实现 `GameAiRuntime` 接口
- 使用 `createProfileAwareActionScorer` 创建评分器
- 使用 `withAiActionStrategyTags` 为动作附加标签
- 使用 `createScoredLocalAiPolicy` 实现决策逻辑

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Engine AI Framework                       │
│  (GameAiRuntime, AiStrategyProfile, LocalAiActionScorer)   │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ implements
                            │
┌─────────────────────────────────────────────────────────────┐
│                   Cardia AI Runtime                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  buildLegalActions(state, playerId)                 │   │
│  │    ├─ buildPlayCardActions()                        │   │
│  │    ├─ buildAbilityActions()                         │   │
│  │    └─ buildInteractionActions()                     │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Local Policies                                      │   │
│  │    ├─ baseline (createScoredLocalAiPolicy)          │   │
│  │    ├─ aggro (进攻型)                                 │   │
│  │    ├─ control (防守型)                               │   │
│  │    └─ balanced (平衡型)                              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ uses
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Action Scorers                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Profile-Aware Scorer                                │   │
│  │    └─ scoreActionAgainstStrategyProfile()           │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Heuristic Scorers                                   │   │
│  │    ├─ scorePlayCardAction()                         │   │
│  │    ├─ scoreAbilityAction()                          │   │
│  │    └─ scoreInteractionChoice()                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ uses
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Helper Functions                            │
│  ├─ evaluateCardValue()                                     │
│  ├─ evaluateAbilityValue()                                  │
│  ├─ evaluateGameState()                                     │
│  └─ selectBestTarget()                                      │
└─────────────────────────────────────────────────────────────┘
```

### 模块划分

#### 1. AI Runtime (`src/games/cardia/ai.ts`)

主入口文件,实现 `GameAiRuntime` 接口:

```typescript
export const cardiaAiRuntime: GameAiRuntime = {
    gameId: 'cardia',
    buildLegalActions: buildCardiaAiLegalActions,
    localPolicies: {
        baseline: baselineLocalPolicy,
        aggro: aggroLocalPolicy,
        control: controlLocalPolicy,
        balanced: balancedLocalPolicy,
    },
    defaultLocalPolicyId: 'baseline',
};
```

#### 2. Legal Actions Builder (`buildLegalActions`)

负责枚举所有合法动作:

- `buildPlayCardActions()`: 枚举手牌中可打出的卡牌
- `buildAbilityActions()`: 枚举可激活的能力(激活/跳过)
- `buildInteractionActions()`: 枚举交互选择(卡牌/派系/修正标记)

#### 3. Action Scorers

负责为动作打分:

- `createProfileAwareActionScorer()`: 基于策略配置的评分器
- `scorePlayCardAction()`: 打牌动作启发式评分
- `scoreAbilityAction()`: 能力激活启发式评分
- `scoreInteractionChoice()`: 交互选择启发式评分

#### 4. Helper Functions

辅助函数:

- `evaluateCardValue()`: 评估卡牌价值
- `evaluateAbilityValue()`: 评估能力价值
- `evaluateGameState()`: 评估游戏状态
- `selectBestTarget()`: 选择最佳目标

## Components and Interfaces

### 核心类型定义

```typescript
/**
 * Cardia 策略标签
 */
type CardiaStrategyTag =
    | 'aggro'        // 进攻型:打出高影响力卡牌,争夺印戒
    | 'control'      // 控制型:使用修正标记和控制能力
    | 'economy'      // 经济型:抽牌、回收资源
    | 'tempo'        // 节奏型:激活即时能力
    | 'value';       // 价值型:激活持续能力

/**
 * 策略配置文件
 */
interface CardiaStrategyProfile extends AiStrategyProfile<CardiaStrategyTag> {
    tags: CardiaStrategyTag[];
    tagWeights: Partial<Record<CardiaStrategyTag, number>>;
    summary: string[];
}

/**
 * 动作元数据
 */
interface CardiaActionMetadata extends AiActionMetadata {
    // 打牌动作
    cardUid?: string;
    cardInfluence?: number;
    cardFaction?: FactionType;
    cardAbilityCount?: number;
    
    // 能力动作
    abilityId?: string;
    abilityType?: 'instant' | 'ongoing';
    expectedSignetChange?: number;
    expectedInfluenceChange?: number;
    
    // 交互选择
    targetCardUid?: string;
    targetFaction?: FactionType;
    modifierValue?: number;
    
    // 策略标签
    strategyTags?: CardiaStrategyTag[];
}
```

### 合法动作生成接口

```typescript
/**
 * 构建合法动作
 */
function buildCardiaAiLegalActions(args: BuildGameAiLegalActionsArgs): AiLegalAction[] {
    const { state, playerId } = args;
    const core = state.core as CardiaCore;
    const actions: AiLegalAction[] = [];
    
    // 1. 检查交互
    const interactionActions = buildInteractionActions(state, playerId);
    if (interactionActions) {
        return interactionActions;
    }
    
    // 2. 根据阶段生成动作
    switch (core.phase) {
        case 'play':
            return buildPlayCardActions(core, playerId);
        case 'ability':
            return buildAbilityActions(core, playerId);
        case 'end':
            return []; // 回合结束阶段无需 AI 决策
        default:
            return [];
    }
}
```

### 打牌动作生成

```typescript
/**
 * 生成打牌动作
 */
function buildPlayCardActions(
    core: CardiaCore,
    playerId: PlayerId,
): AiLegalAction[] {
    const player = core.players[playerId];
    const actions: AiLegalAction[] = [];
    
    for (const card of player.hand) {
        const influence = card.baseInfluence;
        const abilityCount = card.abilityIds.length;
        
        // 确定策略标签
        const strategyTags: CardiaStrategyTag[] = [];
        if (influence >= 12) {
            strategyTags.push('aggro');
        }
        if (abilityCount > 0) {
            strategyTags.push('value');
        }
        
        actions.push({
            actionId: createAiLegalActionId('play-card', card.uid),
            kind: 'play-card',
            label: `打出卡牌 ${card.defId}`,
            commands: [{
                type: CARDIA_COMMANDS.PLAY_CARD,
                payload: { cardUid: card.uid, slotIndex: 0 },
            }],
            metadata: withAiActionStrategyTags({
                cardUid: card.uid,
                cardInfluence: influence,
                cardFaction: card.faction,
                cardAbilityCount: abilityCount,
            }, strategyTags),
        });
    }
    
    return actions;
}
```

### 能力动作生成

```typescript
/**
 * 生成能力动作
 */
function buildAbilityActions(
    core: CardiaCore,
    playerId: PlayerId,
): AiLegalAction[] {
    const actions: AiLegalAction[] = [];
    
    // 检查是否有输掉的卡牌可以激活能力
    const loserCard = getLoserCard(core, playerId);
    if (!loserCard || loserCard.abilityIds.length === 0) {
        return [];
    }
    
    // 生成激活能力动作
    for (const abilityId of loserCard.abilityIds) {
        const abilityDef = abilityRegistry.get(abilityId);
        if (!abilityDef) continue;
        
        const strategyTags: CardiaStrategyTag[] = [];
        if (abilityDef.isInstant) {
            strategyTags.push('tempo');
        }
        if (abilityDef.isOngoing) {
            strategyTags.push('value');
        }
        
        actions.push({
            actionId: createAiLegalActionId('activate-ability', abilityId),
            kind: 'activate-ability',
            label: `激活能力 ${abilityId}`,
            commands: [{
                type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
                payload: { abilityId, sourceCardUid: loserCard.uid },
            }],
            metadata: withAiActionStrategyTags({
                abilityId,
                abilityType: abilityDef.isOngoing ? 'ongoing' : 'instant',
            }, strategyTags),
        });
    }
    
    // 生成跳过能力动作
    actions.push({
        actionId: createAiLegalActionId('skip-ability'),
        kind: 'skip-ability',
        label: '跳过能力',
        commands: [{
            type: CARDIA_COMMANDS.SKIP_ABILITY,
            payload: { playerId },
        }],
        metadata: {
            strategyTags: ['economy'], // 跳过能力保留资源
        },
    });
    
    return actions;
}
```

### 交互动作生成

```typescript
/**
 * 生成交互动作
 */
function buildInteractionActions(
    state: MatchState<CardiaCore>,
    playerId: PlayerId,
): AiLegalAction[] | null {
    const current = state.sys.interaction?.current;
    if (!current || current.playerId !== playerId) {
        return null;
    }
    
    // 根据交互类型生成动作
    switch (current.kind) {
        case 'simple-choice':
            return buildSimpleChoiceActions(state, current);
        case 'cardia:choose-card':
            return buildChooseCardActions(state, current);
        case 'cardia:choose-faction':
            return buildChooseFactionActions(state, current);
        case 'cardia:choose-modifier':
            return buildChooseModifierActions(state, current);
        default:
            return [];
    }
}
```

## Data Models

### 策略配置数据

```typescript
/**
 * 预设策略配置
 */
const STRATEGY_PROFILES: Record<string, CardiaStrategyProfile> = {
    // 进攻型:优先打出高影响力卡牌,争夺印戒
    aggro: {
        tags: ['aggro', 'tempo'],
        tagWeights: {
            aggro: 2.0,
            tempo: 1.5,
            value: 0.5,
            control: 0.3,
            economy: 0.2,
        },
        summary: ['优先打出高影响力卡牌', '争夺印戒', '激活即时能力'],
    },
    
    // 防守型:优先使用修正标记和控制能力
    control: {
        tags: ['control', 'value'],
        tagWeights: {
            control: 2.0,
            value: 1.5,
            economy: 1.0,
            tempo: 0.5,
            aggro: 0.3,
        },
        summary: ['使用修正标记', '激活控制能力', '保持资源优势'],
    },
    
    // 平衡型:均衡考虑各类动作
    balanced: {
        tags: ['aggro', 'control', 'value'],
        tagWeights: {
            aggro: 1.0,
            control: 1.0,
            value: 1.0,
            tempo: 0.8,
            economy: 0.8,
        },
        summary: ['均衡考虑影响力和能力', '根据场面调整策略'],
    },
};
```

### 启发式评分数据

```typescript
/**
 * 卡牌价值评估参数
 */
const CARD_VALUE_WEIGHTS = {
    INFLUENCE_BASE: 10,      // 基础影响力权重
    INFLUENCE_HIGH: 15,      // 高影响力(≥12)额外权重
    ABILITY_COUNT: 20,       // 每个能力的权重
    FACTION_BONUS: 5,        // 派系匹配奖励
};

/**
 * 能力价值评估参数
 */
const ABILITY_VALUE_WEIGHTS = {
    INSTANT_BASE: 30,        // 即时能力基础价值
    ONGOING_BASE: 50,        // 持续能力基础价值
    SIGNET_CHANGE: 100,      // 印戒变化权重
    INFLUENCE_CHANGE: 15,    // 影响力变化权重
    DRAW_CARD: 25,           // 抽牌价值
    RECYCLE_CARD: 20,        // 回收卡牌价值
};

/**
 * 游戏状态评估参数
 */
const STATE_EVAL_WEIGHTS = {
    SIGNET_DIFF: 200,        // 印戒差距权重
    HAND_SIZE_DIFF: 15,      // 手牌数量差距权重
    FIELD_CARD_DIFF: 30,     // 场上卡牌数量差距权重
    ONGOING_ABILITY_DIFF: 40, // 持续能力数量差距权重
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 合法动作完整性

*For any* 游戏状态和玩家 ID,`buildLegalActions` 应生成所有当前阶段的合法动作,且每个动作都有唯一的 `actionId`

**Validates: Requirements 2.1, 2.2, 3.1, 3.2, 4.1-4.4, 11.1-11.3**

### Property 2: 策略标签一致性

*For any* 生成的动作,如果 `metadata.strategyTags` 存在,则必须是 `CardiaStrategyTag` 类型的非空数组

**Validates: Requirements 2.3, 3.4, 5.2, 5.3**

### Property 3: 动作合法性

*For any* 生成的动作,其 `commands` 列表中的每个命令在当前状态下都应该是合法的(通过 `CardiaDomain.validate` 验证)

**Validates: Requirements 11.7**

### Property 4: 评分器返回值

*For any* 动作和策略配置,`scoreActionAgainstStrategyProfile` 应返回数值评分,且评分应随策略权重单调变化

**Validates: Requirements 7.2, 7.3**

### Property 5: 决策返回最优动作

*For any* 非空动作列表,`createScoredLocalAiPolicy` 返回的动作应是得分最高的动作(或得分最高的动作之一,如果有多个同分动作)

**Validates: Requirements 2.6, 12.3**

### Property 6: 打牌动作数量

*For any* 打牌阶段的游戏状态,生成的打牌动作数量应等于当前玩家手牌数量

**Validates: Requirements 2.1**

### Property 7: 能力动作数量

*For any* 能力阶段的游戏状态,如果输掉的卡牌有 N 个能力,则应生成 N+1 个动作(N 个激活动作 + 1 个跳过动作)

**Validates: Requirements 3.2**

### Property 8: 交互选项完整性

*For any* 交互状态,生成的交互动作应覆盖所有可用选项(对于单选交互,动作数等于选项数;对于多选交互,动作数等于合法组合数)

**Validates: Requirements 4.1-4.4**

## Error Handling

### 错误处理策略

1. **动作生成失败**
   - 记录错误日志(包含状态快照和玩家 ID)
   - 返回空数组,触发降级逻辑

2. **动作评分失败**
   - 记录警告日志
   - 使用默认分数 0
   - 继续评分其他动作

3. **没有合法动作**
   - 返回 `null`(而不是抛出异常)
   - 由引擎层处理(可能触发游戏结束或跳过回合)

4. **决策超时**
   - 选择第一个合法动作
   - 记录超时日志

5. **命令验证失败**
   - 在生成阶段过滤掉非法命令
   - 确保返回的动作都是合法的

### 降级机制

```typescript
/**
 * 降级策略:当主评分器失败时,使用简单随机选择
 */
function createFallbackPolicy(): LocalAiPolicy {
    return {
        id: 'fallback',
        decide: (context) => {
            if (context.legalActions.length === 0) {
                return null;
            }
            // 随机选择一个动作
            const randomIndex = Math.floor(Math.random() * context.legalActions.length);
            return {
                actionId: context.legalActions[randomIndex].actionId,
                confidence: 0.1,
                reasoningSummary: 'Fallback: random selection',
            };
        },
    };
}
```

## Testing Strategy

### 单元测试

**目标**:验证核心逻辑的正确性

1. **合法动作生成测试**
   - 测试打牌阶段生成正确数量的动作
   - 测试能力阶段生成激活/跳过动作
   - 测试交互阶段生成所有选项
   - 测试动作的 `actionId` 唯一性

2. **策略标签测试**
   - 测试高影响力卡牌标记为 `aggro`
   - 测试持续能力标记为 `value`
   - 测试即时能力标记为 `tempo`

3. **评分器测试**
   - 测试 `scoreActionAgainstStrategyProfile` 返回数值
   - 测试不同策略配置产生不同评分
   - 测试启发式评分函数考虑各种因素

4. **辅助函数测试**
   - 测试 `evaluateCardValue` 返回合理值
   - 测试 `evaluateAbilityValue` 考虑能力类型
   - 测试 `evaluateGameState` 计算印戒差距

### 集成测试

**目标**:验证 AI 系统与游戏引擎的集成

1. **完整对局测试**
   - 创建 AI vs AI 对局
   - 验证 AI 能够完成完整游戏流程
   - 验证 AI 不会生成非法动作

2. **策略差异测试**
   - 运行多局 `aggro` vs `control` 对局
   - 验证不同策略产生不同的行为模式
   - 统计胜率和平均回合数

3. **边界情况测试**
   - 测试手牌为空时的行为
   - 测试无能力可激活时的行为
   - 测试交互无选项时的行为

### E2E 测试

**目标**:验证 AI 在真实游戏环境中的表现

1. **AI 对局测试**
   - 使用 `setupOnlineMatch` 创建 AI 对局
   - 验证 AI 能够打出卡牌
   - 验证 AI 能够激活能力
   - 验证 AI 能够处理交互选择

2. **UI 集成测试**
   - 验证 AI 决策后 UI 正确更新
   - 验证 AI 动作触发正确的动画
   - 验证 AI 决策延迟符合预期

### 属性测试配置

由于 Cardia AI 系统主要是决策逻辑和启发式评分,不涉及复杂的数据转换或状态机,**不适合使用属性测试**。测试策略以单元测试和集成测试为主:

- **单元测试**:验证具体场景下的决策正确性(如高影响力卡牌得分更高)
- **集成测试**:验证 AI 能够完成完整对局,不会生成非法动作
- **E2E 测试**:验证 AI 在真实游戏环境中的表现

## Implementation Notes

### 开发顺序

1. **Phase 1: 基础架构**
   - 创建 `src/games/cardia/ai.ts`
   - 实现 `GameAiRuntime` 接口
   - 注册到引擎 AI 运行时

2. **Phase 2: 合法动作生成**
   - 实现 `buildPlayCardActions`
   - 实现 `buildAbilityActions`
   - 实现 `buildInteractionActions`

3. **Phase 3: 策略标签系统**
   - 定义 `CardiaStrategyTag` 类型
   - 实现策略标签附加逻辑
   - 创建预设策略配置

4. **Phase 4: 评分系统**
   - 实现 `scorePlayCardAction`
   - 实现 `scoreAbilityAction`
   - 实现 `scoreInteractionChoice`
   - 集成 `createProfileAwareActionScorer`

5. **Phase 5: 决策策略**
   - 实现 `baselineLocalPolicy`
   - 实现 `aggroLocalPolicy`
   - 实现 `controlLocalPolicy`
   - 实现 `balancedLocalPolicy`

6. **Phase 6: 测试和优化**
   - 编写单元测试
   - 编写集成测试
   - 编写 E2E 测试
   - 调优评分参数

### 技术债务

1. **能力目标选择**:当前设计只支持简单的目标选择启发式,复杂能力(如需要多步选择)可能需要额外的状态跟踪

2. **对手建模**:当前设计不包含对手建模(预测对手手牌/策略),未来可以扩展

3. **学习机制**:当前设计是静态启发式,未来可以考虑引入强化学习或进化算法

### 性能考虑

1. **动作生成优化**:缓存合法动作列表,避免重复计算
2. **评分并行化**:对于大量动作,可以考虑并行评分
3. **状态评估缓存**:缓存游戏状态评估结果,避免重复计算

### 可扩展性

1. **新策略添加**:通过添加新的 `CardiaStrategyProfile` 配置即可
2. **新启发式添加**:通过添加新的 `LocalAiActionScorer` 即可
3. **新能力支持**:通过扩展 `evaluateAbilityValue` 函数即可

## References

- `src/engine/ai/types.ts`: AI 框架核心类型
- `src/games/dicethrone/ai.ts`: Dice Throne AI 实现参考
- `src/games/summonerwars/ai.ts`: Summoner Wars AI 实现参考
- `.kiro/specs/cardia-ai-opponent/requirements.md`: 需求文档
