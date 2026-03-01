# Cardia - 代码审查报告（Phase 6.2 交互系统）

**审查日期**：2026年2月26日  
**审查范围**：Phase 6.2 交互系统集成代码  
**审查标准**：`.windsurf/workflows/review.md`  
**审查重点**：逻辑错误、边界情况、空引用、并发问题、安全漏洞、资源管理、API 契约、缓存问题、代码模式违规

---

## 执行摘要

✅ **总体评估**：交互系统实现正确，架构清晰，但存在阻塞性问题  
⚠️ **发现问题**：2 个阻塞性问题（P0），3 个高优先级问题（P1），3 个中等优先级问题（P2）  
📋 **代码质量**：良好，遵循项目规范，但测试无法运行

---

## 一、关键发现

### 🟡 中等优先级问题

#### 问题 1：交互 ID 生成存在碰撞风险

**位置**：`src/games/cardia/domain/abilityExecutor.ts`

**问题**：
```typescript
// ❌ 使用 Date.now() 生成交互 ID，快速连续调用会产生相同 ID
const interaction = createSimpleChoice(
    `discard_${ctx.abilityId}_${Date.now()}`,  // 碰撞风险
    targetId,
    '选择要弃掉的卡牌',
    // ...
);
```

**根因**：`Date.now()` 精度为毫秒，同一毫秒内多次调用会返回相同值

**影响**：
- 快速连续触发多个交互能力时，可能生成相同的交互 ID
- InteractionSystem 使用 ID 作为 Map 键，重复 ID 会覆盖前一个交互
- 实际场景：元素师同时触发弃牌和复制能力

**修复方案**：
```typescript
// ✅ 方案 1：使用 ctx.sourceCardUid 作为唯一标识
const interaction = createSimpleChoice(
    `discard_${ctx.abilityId}_${ctx.sourceCardUid}`,
    targetId,
    '选择要弃掉的卡牌',
    // ...
);

// ✅ 方案 2：使用计数器
let interactionCounter = 0;
const interaction = createSimpleChoice(
    `discard_${ctx.abilityId}_${++interactionCounter}`,
    targetId,
    '选择要弃掉的卡牌',
    // ...
);

// ✅ 方案 3：使用 nanoid（如果引擎层提供）
import { nanoid } from 'nanoid';
const interaction = createSimpleChoice(
    `discard_${ctx.abilityId}_${nanoid(8)}`,
    targetId,
    '选择要弃掉的卡牌',
    // ...
);
```

**优先级**：P1（可能导致交互丢失）

---

#### 问题 2：sourceId 生成不一致

**位置**：`src/games/cardia/domain/abilityExecutor.ts` + `interactionHandlers.ts`

**问题**：
```typescript
// abilityExecutor.ts - 创建交互时
{
    sourceId: ctx.sourceCardUid,  // ❌ 使用 sourceCardUid
}

// interactionHandlers.ts - 注册处理器时
registerInteractionHandler(`discard_${ABILITY_IDS.APPRENTICE}`, handleDiscardInteraction);
// ❌ 使用 abilityId，但创建时用的是 sourceCardUid
```

**根因**：sourceId 生成逻辑不一致，导致处理器无法匹配

**影响**：
- 交互解决后，`getInteractionHandler(sourceId)` 返回 `undefined`
- 玩家选择后没有任何效果
- **当前代码实际上完全无法工作**

**修复方案**：
```typescript
// ✅ 统一使用 abilityId 作为 sourceId
// abilityExecutor.ts
const interaction = createSimpleChoice(
    `discard_${ctx.abilityId}_${Date.now()}`,
    targetId,
    '选择要弃掉的卡牌',
    target.hand.map(card => ({
        id: card.uid,
        label: `${card.defId} (影响力 ${card.baseInfluence})`,
        value: { cardUid: card.uid },
        _source: 'hand' as const,
    })),
    {
        sourceId: `discard_${ctx.abilityId}`,  // ✅ 与注册时一致
        multi: { min: count, max: count },
        targetType: 'hand',
    }
);

// interactionHandlers.ts - 保持不变
registerInteractionHandler(`discard_${ABILITY_IDS.APPRENTICE}`, handleDiscardInteraction);
```

**优先级**：P0（阻塞性问题，交互完全无法工作）

---

#### 问题 3：空手牌/弃牌堆边界检查不完整

**位置**：`src/games/cardia/domain/abilityExecutor.ts`

**问题**：
```typescript
// ✅ executeDiscardSelected 有边界检查
if (target.hand.length === 0) {
    console.warn(`[Cardia] 玩家 ${targetId} 手牌为空，无法弃牌`);
    return [];
}

// ❌ executeRecycle 有边界检查，但 executeDiscard 没有
function executeDiscard(ctx: AbilityExecutionContext, effect: any): CardiaEvent[] {
    const targetId = effect.target === 'opponent' ? getOpponentId(ctx.core, ctx.playerId) : ctx.playerId;
    const target = ctx.core.players[targetId];
    const count = effect.value || 1;
    
    // ❌ 缺少边界检查
    const { createSimpleChoice } = require('../../../engine/systems/InteractionSystem');
    // ...
}
```

**影响**：
- 手牌为空时仍然创建交互，玩家看到空选项列表
- 用户体验差，应该直接跳过

**修复方案**：
```typescript
function executeDiscard(ctx: AbilityExecutionContext, effect: any): CardiaEvent[] {
    const targetId = effect.target === 'opponent' ? getOpponentId(ctx.core, ctx.playerId) : ctx.playerId;
    const target = ctx.core.players[targetId];
    const count = effect.value || 1;
    
    // ✅ 添加边界检查
    if (target.hand.length === 0) {
        console.warn(`[Cardia] 玩家 ${targetId} 手牌为空，无法弃牌`);
        return [];
    }
    
    // ...
}
```

**优先级**：P2（用户体验问题）

---

#### 问题 4：interactionData 传递链路可能丢失数据

**位置**：`src/games/cardia/domain/systems.ts`

**问题**：
```typescript
// systems.ts - 创建交互时
if (payload.targetId) {
    payload.interaction.data = {
        ...payload.interaction.data,  // ❌ 可能覆盖已有的 data
        continuationContext: {
            targetId: payload.targetId,
        },
    };
}

// 后续解决时
const ctx = payload.interactionData?.continuationContext as Record<string, unknown> | undefined;
const interactionData = {
    ...payload.interactionData,
    targetId: ctx?.targetId,  // ❌ 如果 continuationContext 不存在，targetId 为 undefined
};
```

**根因**：
- 创建时直接覆盖 `interaction.data`，可能丢失 `createSimpleChoice` 设置的其他字段
- 解决时假设 `continuationContext` 存在，但可能为 `undefined`

**影响**：
- 巫王能力的派系弃牌无法正确获取目标玩家 ID
- 其他需要传递上下文的能力可能失效

**修复方案**：
```typescript
// ✅ 创建时合并而非覆盖
if (payload.targetId) {
    payload.interaction.data = {
        ...payload.interaction.data,
        continuationContext: {
            ...(payload.interaction.data?.continuationContext || {}),
            targetId: payload.targetId,
        },
    };
}

// ✅ 解决时安全访问
const ctx = payload.interactionData?.continuationContext as Record<string, unknown> | undefined;
const interactionData = {
    ...payload.interactionData,
    targetId: ctx?.targetId || payload.interactionData?.targetId,  // 回退到顶层 targetId
};
```

**优先级**：P1（功能缺陷）

---

#### 问题 5：交互处理器中的类型转换不安全

**位置**：`src/games/cardia/domain/interactionHandlers.ts`

**问题**：
```typescript
function handleDiscardInteraction(
    core: CardiaCore,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    random: RandomFn,
    timestamp: number
): CardiaEvent[] {
    const selectedCards = value as { cardUid: string }[];  // ❌ 不安全的类型断言
    if (!Array.isArray(selectedCards)) return [];  // ✅ 有运行时检查
    
    const events: CardiaEvent[] = [];
    
    for (const selection of selectedCards) {
        events.push({
            type: CARDIA_EVENTS.CARD_DISCARDED,
            timestamp,
            payload: {
                playerId,
                cardUid: selection.cardUid,  // ❌ 如果 selection 不是对象，会崩溃
                fromZone: 'hand',
            },
        });
    }
    
    return events;
}
```

**根因**：
- 类型断言 `as { cardUid: string }[]` 不进行运行时检查
- 只检查了 `Array.isArray`，未检查数组元素结构

**影响**：
- 如果 InteractionSystem 传递了错误格式的 value，会导致运行时错误
- `selection.cardUid` 可能为 `undefined`，导致后续逻辑失败

**修复方案**：
```typescript
function handleDiscardInteraction(
    core: CardiaCore,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    random: RandomFn,
    timestamp: number
): CardiaEvent[] {
    // ✅ 完整的类型守卫
    if (!Array.isArray(value)) {
        console.warn('[Cardia] handleDiscardInteraction: value 不是数组');
        return [];
    }
    
    const events: CardiaEvent[] = [];
    
    for (const selection of value) {
        // ✅ 检查每个元素的结构
        if (!selection || typeof selection !== 'object' || !('cardUid' in selection)) {
            console.warn('[Cardia] handleDiscardInteraction: 无效的选项格式', selection);
            continue;
        }
        
        const cardUid = (selection as any).cardUid;
        if (typeof cardUid !== 'string') {
            console.warn('[Cardia] handleDiscardInteraction: cardUid 不是字符串', cardUid);
            continue;
        }
        
        events.push({
            type: CARDIA_EVENTS.CARD_DISCARDED,
            timestamp,
            payload: {
                playerId,
                cardUid,
                fromZone: 'hand',
            },
        });
    }
    
    return events;
}
```

**优先级**：P2（防御性编程）

---

#### 问题 6：require() 动态导入可能失败

**位置**：`src/games/cardia/domain/abilityExecutor.ts` + `interactionHandlers.ts`

**问题**：
```typescript
// ❌ 使用 require() 动态导入，可能在某些环境下失败
const { createSimpleChoice } = require('../../../engine/systems/InteractionSystem');
const cardRegistry = require('./cardRegistry').default;
const { FACTION_IDS } = require('./ids');
```

**根因**：
- 混用 ES6 import 和 CommonJS require
- require() 在某些打包配置下可能失败
- TypeScript 无法检查 require() 的类型

**影响**：
- 打包后可能无法正确解析模块
- 类型安全性降低

**修复方案**：
```typescript
// ✅ 统一使用 ES6 import
import { createSimpleChoice } from '../../../engine/systems/InteractionSystem';
import cardRegistry from './cardRegistry';
import { FACTION_IDS } from './ids';
```

**优先级**：P2（代码质量）

---

### 🟢 低优先级优化建议

#### 优化 1：未使用的导入和参数

**位置**：多个文件

**问题**：
- `interactionHandlers.ts`: `FACTION_IDS` 导入但未使用
- `abilityExecutor.ts`: `ABILITY_IDS`, `CardInstance`, `timestamp` 导入但未使用
- 多个函数的 `core`, `random`, `interactionData` 参数未使用

**建议**：
```typescript
// ✅ 移除未使用的导入
// import { FACTION_IDS } from './ids';  // 删除

// ✅ 未使用的参数加下划线前缀
function handleDiscardInteraction(
    _core: CardiaCore,  // 标记为未使用
    playerId: PlayerId,
    value: unknown,
    _interactionData: Record<string, unknown> | undefined,
    _random: RandomFn,
    timestamp: number
): CardiaEvent[] {
    // ...
}
```

---

#### 优化 2：重复的 target 解析逻辑

**位置**：`src/games/cardia/domain/abilityExecutor.ts`

**问题**：每个 execute 函数都重复相同的 target 解析逻辑

**建议**：
```typescript
// ✅ 提取公共函数
function resolveTarget(ctx: AbilityExecutionContext, effect: any): PlayerId {
    return effect.target === 'opponent' 
        ? getOpponentId(ctx.core, ctx.playerId) 
        : ctx.playerId;
}

// 使用
function executeDraw(ctx: AbilityExecutionContext, effect: any): CardiaEvent[] {
    const targetId = resolveTarget(ctx, effect);
    const count = effect.value || 1;
    // ...
}
```

---

#### 优化 3：缺少 JSDoc 文档

**位置**：`src/games/cardia/domain/interactionHandlers.ts`

**问题**：交互处理器函数缺少详细文档

**建议**：
```typescript
/**
 * 处理弃牌交互
 * 
 * @param core - 游戏核心状态
 * @param playerId - 执行弃牌的玩家 ID
 * @param value - 玩家选择的卡牌数组，格式：[{ cardUid: string }, ...]
 * @param interactionData - 交互上下文数据（未使用）
 * @param random - 随机数生成器（未使用）
 * @param timestamp - 事件时间戳
 * @returns 生成的 CARD_DISCARDED 事件数组
 * 
 * @example
 * // 玩家选择弃掉 2 张牌
 * handleDiscardInteraction(core, 'p1', [
 *   { cardUid: 'card-1' },
 *   { cardUid: 'card-2' }
 * ], undefined, random, Date.now());
 */
function handleDiscardInteraction(
    core: CardiaCore,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    random: RandomFn,
    timestamp: number
): CardiaEvent[] {
    // ...
}
```

---

#### 问题 7：Board.tsx 未使用 calculateInfluence 计算影响力

**位置**：`src/games/cardia/Board.tsx:CardDisplay`

**问题**：
```typescript
// ❌ 直接显示 baseInfluence，未应用修正标记和持续效果
<div className="text-2xl font-bold text-white">{card.baseInfluence}</div>
```

**根因**：UI 层直接读取 `card.baseInfluence`，未调用 `calculateInfluence(card, core)`

**影响**：
- 修正标记（+3/-5）不显示在 UI 上
- 持续效果（德鲁伊+1、行会长+2）不显示在 UI 上
- 玩家看到的影响力与实际计算结果不一致

**修复方案**：
```typescript
// ✅ 使用 calculateInfluence 计算最终影响力
import { calculateInfluence } from './domain/utils';

const CardDisplay: React.FC<CardDisplayProps> = ({ card }) => {
    const { t } = useTranslation('game-cardia');
    
    // 从上层传入 core（需要修改 CardDisplay props）
    const finalInfluence = calculateInfluence(card, core);
    
    return (
        <div className={`w-32 h-48 bg-gradient-to-br ${bgColor} rounded-lg border-2 border-white/20 p-2 flex flex-col justify-between shadow-lg`}>
            <div className="text-center">
                <div className="text-2xl font-bold text-white">{finalInfluence}</div>
                {/* 如果有修正，显示基础值 */}
                {finalInfluence !== card.baseInfluence && (
                    <div className="text-xs text-gray-400">({card.baseInfluence})</div>
                )}
                <div className="text-xs text-white/80">{t(`factions.${card.faction}`)}</div>
            </div>
            {/* ... */}
        </div>
    );
};
```

**优先级**：P1（UI 显示错误，影响游戏体验）

---

#### 问题 8：E2E 测试使用不存在的 data-testid

**位置**：`e2e/cardia-basic-flow.e2e.ts`

**问题**：
```typescript
// ❌ Board.tsx 中不存在这些 data-testid
await expect(p1Page.locator('[data-testid="cardia-phase-indicator"]')).toContainText('打牌阶段');
await p1Page.locator('[data-testid="cardia-hand-area"]');
await p1Page.locator('[data-testid="cardia-battlefield"]');
await p1Page.locator('[data-testid="cardia-skip-ability-btn"]');
await p1Page.locator('[data-testid="cardia-end-turn-btn"]');
```

**根因**：E2E 测试编写时假设了 UI 结构，但 Board.tsx 实际未添加这些 data-testid

**影响**：
- E2E 测试无法运行（所有 locator 都会失败）
- 测试无法验证交互系统是否正常工作

**修复方案**：
```typescript
// ✅ 在 Board.tsx 中添加 data-testid
<div className="bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 text-white" data-testid="cardia-phase-indicator">
    <div className="text-xs text-gray-400">{t('phase')}</div>
    <div className="text-lg font-bold">{t(`phases.${phase}`)}</div>
</div>

<div className="flex gap-2 overflow-x-auto" data-testid="cardia-hand-area">
    {player.hand.map((card: any) => (
        <button
            key={card.uid}
            data-testid={`card-${card.uid}`}
            onClick={() => onPlayCard?.(card.uid)}
            // ...
        >
            <CardDisplay card={card} />
        </button>
    ))}
</div>

<button
    onClick={handleSkipAbility}
    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
    data-testid="cardia-skip-ability-btn"
>
    {t('skip')}
</button>

<button
    onClick={handleEndTurn}
    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
    data-testid="cardia-end-turn-btn"
>
    {t('endTurn')}
</button>
```

**优先级**：P1（测试无法运行）

---

#### 问题 9：game.ts 中 systems 顺序可能导致问题

**位置**：`src/games/cardia/game.ts`

**问题**：
```typescript
const systems = [
    createFlowSystem<CardiaCore>({ hooks: cardiaFlowHooks }),
    ...createBaseSystems<CardiaCore>(),  // 包含 InteractionSystem (priority: 20)
    createCardiaEventSystem(),           // priority: 50
    createCheatSystem<CardiaCore>(cardiaCheatModifier),
];
```

**根因**：
- `createCardiaEventSystem` 的 priority 是 50，在 InteractionSystem (20) 之后执行
- 但 `createCardiaEventSystem` 需要在 `afterEvents` 中调用 `queueInteraction`
- 如果 InteractionSystem 在同一批事件中也处理交互，可能导致时序问题

**影响**：
- 交互创建和解决的时序可能不正确
- 可能导致交互丢失或重复

**分析**：
- 当前设计是正确的：CardiaEventSystem 在 InteractionSystem 之后执行
- CardiaEventSystem 监听 `INTERACTION_CREATED` 事件，调用 `queueInteraction`
- InteractionSystem 在下一轮 `afterEvents` 中处理队列中的交互
- 这是正确的两阶段处理

**结论**：无问题，当前设计正确

---

#### 问题 10：flowHooks.ts 中 onPhaseEnter 只处理了大法师

**位置**：`src/games/cardia/domain/flowHooks.ts:onPhaseEnter`

**问题**：
```typescript
// ✅ 大法师：每回合抽1张
if (player.tags.tags[`Ongoing.${ABILITY_IDS.ARCHMAGE}`]) {
    events.push({
        type: CARDIA_EVENTS.CARD_DRAWN,
        timestamp,
        payload: {
            playerId,
            count: 1,
        },
    });
}
// ❌ 缺少其他持续效果的处理
```

**根因**：AUDIT-REPORT.md 中提到"德鲁伊、大法师、行会长等持续效果能力"，但只实现了大法师

**影响**：
- 德鲁伊和行会长的持续效果在 `calculateInfluence` 中处理（正确）
- 但如果有其他"回合开始时"触发的持续效果，需要在这里添加

**分析**：
- 德鲁伊（Druid）：每张牌+1影响力 → 在 `calculateInfluence` 中处理 ✅
- 行会长（Guildmaster）：每张牌+2影响力 → 在 `calculateInfluence` 中处理 ✅
- 大法师（Archmage）：每回合抽1张 → 在 `onPhaseEnter` 中处理 ✅

**结论**：当前实现正确，无问题

---

## 二、边界情况分析

### ✅ 已处理的边界情况

1. **空手牌**：`executeDiscardSelected` 和 `executeRecycle` 有检查
2. **空弃牌堆**：`executeRecycle` 有检查
3. **空数组检查**：`handleDiscardInteraction` 检查 `Array.isArray`

### ⚠️ 未处理的边界情况

1. **空手牌**：`executeDiscard` 缺少检查（问题 3）
2. **无即时卡牌**：`executeCopy` 有检查，但未测试
3. **派系不存在**：`handleDiscardByFactionInteraction` 未检查派系是否有效
4. **卡牌不在手牌中**：`handleDiscardInteraction` 未验证 cardUid 是否真的在手牌中

---

## 三、并发与竞态条件

### ✅ 无明显竞态条件

- InteractionSystem 使用队列管理交互，串行处理
- 事件归约是同步的，无并发问题
- 状态更新使用结构共享，无副作用

### ⚠️ 潜在问题

1. **交互 ID 碰撞**：快速连续调用可能生成相同 ID（问题 1）
2. **状态过期**：交互创建时的状态可能在解决时已过期（框架层已处理）

---

## 四、资源管理

### ✅ 无资源泄漏

- 交互处理器注册在模块顶层，生命周期与应用一致
- 无需手动清理
- 事件数组按需创建，GC 自动回收

### ✅ 内存使用合理

- 交互描述符大小适中（< 1KB）
- 事件数组长度有限（通常 < 10）
- 无大对象缓存

---

## 五、API 契约验证

### ⚠️ 契约不一致

1. **sourceId 不匹配**：创建时用 `sourceCardUid`，注册时用 `abilityId`（问题 2）
2. **value 格式假设**：处理器假设 value 格式，但未在创建时强制（问题 5）

### ✅ 契约正确

1. **事件格式**：所有事件符合 `CardiaEvent` 类型定义
2. **交互格式**：使用 `createSimpleChoice` 创建，符合 InteractionSystem 契约

---

## 六、代码模式违规

### ⚠️ 违规项

1. **混用 import 和 require**：违反 ES6 模块规范（问题 6）
2. **不安全的类型断言**：`as` 断言未配合运行时检查（问题 5）
3. **未使用的导入**：违反代码整洁原则（优化 1）

### ✅ 符合规范

1. **事件驱动架构**：正确使用事件系统
2. **注册表模式**：交互处理器使用注册表管理
3. **结构共享**：reducer 正确使用结构共享

---

## 七、测试覆盖分析

### ✅ 单元测试通过

- 34/34 测试通过
- 覆盖 validate, execute, reduce 三层

### ❌ 测试缺口

1. **交互能力未测试**：7 个交互能力没有单元测试
2. **边界情况未测试**：空手牌、空弃牌堆等场景
3. **错误处理未测试**：无效 value 格式、sourceId 不匹配等

**建议补充测试**：
```typescript
describe('Interaction Abilities', () => {
    it('should handle discard interaction', () => {
        // 测试弃牌交互完整流程
    });
    
    it('should handle empty hand gracefully', () => {
        // 测试空手牌边界情况
    });
    
    it('should handle invalid value format', () => {
        // 测试错误处理
    });
});
```

---

## 八、修复优先级

### P0 - 阻塞性问题（必须立即修复）

1. **问题 2**：sourceId 生成不一致 → 交互完全无法工作
2. **问题 8**：E2E 测试使用不存在的 data-testid → 测试无法运行

### P1 - 核心功能缺陷（尽快修复）

1. **问题 1**：交互 ID 碰撞风险
2. **问题 4**：interactionData 传递链路可能丢失数据
3. **问题 7**：Board.tsx 未使用 calculateInfluence → UI 显示错误

### P2 - 用户体验/代码质量（可延后）

1. **问题 3**：空手牌边界检查不完整
2. **问题 5**：类型转换不安全
3. **问题 6**：混用 import 和 require

### P3 - 优化改进（低优先级）

1. **优化 1**：清理未使用的导入和参数
2. **优化 2**：提取重复的 target 解析逻辑
3. **优化 3**：补充 JSDoc 文档

---

## 九、结论

### 总体评估

交互系统的架构设计良好，遵循了事件驱动和注册表模式。但存在一个**阻塞性问题**（sourceId 不匹配）导致交互功能完全无法工作，必须立即修复。

### 主要优点

1. ✅ 架构清晰：事件驱动 + 注册表模式
2. ✅ 职责分明：executor 创建交互，handler 处理响应
3. ✅ 可扩展：新增交互能力只需注册处理器
4. ✅ 测试通过：34/34 单元测试全部通过

### 主要缺陷

1. ❌ **P0 问题**：sourceId 不匹配，交互完全无法工作
2. ❌ **P0 问题**：E2E 测试无法运行（缺少 data-testid）
3. ⚠️ **P1 问题**：交互 ID 碰撞风险，数据传递可能丢失，UI 显示错误
4. ⚠️ **P2 问题**：边界检查不完整，类型转换不安全

### 建议

**立即修复（P0）**：
1. 统一 sourceId 生成逻辑（问题 2）
2. 运行 E2E 测试验证交互功能

**短期修复（P1）**：
1. 修复交互 ID 生成（问题 1）
2. 修复 interactionData 传递（问题 4）
3. 补充交互能力单元测试

**中期优化（P2-P3）**：
1. 完善边界检查和错误处理
2. 统一使用 ES6 import
3. 清理未使用代码
4. 补充文档

---

## 十、审查方法论

本次审查严格遵循 `.windsurf/workflows/review.md` 的规范：

1. **逻辑错误**：发现 sourceId 不匹配的关键缺陷
2. **边界情况**：识别空手牌/弃牌堆等未处理场景
3. **空引用**：发现类型转换不安全问题
4. **并发问题**：分析交互 ID 碰撞风险
5. **资源管理**：确认无内存泄漏
6. **API 契约**：发现 sourceId 契约不一致
7. **代码模式**：识别 import/require 混用问题

审查覆盖：
- ✅ 所有新增代码（interactionHandlers.ts, systems.ts）
- ✅ 所有修改代码（abilityExecutor.ts, events.ts, reduce.ts, game.ts）
- ✅ 相关测试代码（__tests__/）
- ✅ 架构文档（PHASE6.2-INTERACTION-SYSTEM-COMPLETE.md）

---

**审查人**：Kiro AI Assistant  
**审查完成时间**：2026年2月26日 21:35  
**下次审查建议**：修复 P0 问题后重新审查
