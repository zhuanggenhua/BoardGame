---
name: engine-ability-framework
description: 能力框架标准：能力定义、消费点和跨游戏抽象边界——改能力系统时查
metadata:
  type: doc
  status: 已交付
---

# 引擎通用能力框架

## 通用能力框架（强制）

### 核心组件（`engine/primitives/ability.ts`）

- **`AbilityDef<TEffect, TTrigger>`** — 泛型能力定义（id/name/trigger/effects/condition/constraints/tags/cost/cooldown/variants/meta）
- **`AbilityRegistry<TDef>`** — 定义注册表（`register/get/getAll/getByTag/getByTrigger/getRegisteredIds`）
- **`AbilityExecutorRegistry<TCtx, TEvent>`** — 执行器注册表，支持 `id+tag` 复合键（`register/resolve/has/getRegisteredIds`）
- **工具函数**：`checkAbilityCost` / `filterByTags` / `checkAbilityCondition`（委托 `primitives/condition`）
- **i18n 辅助**：`abilityText('frost_axe','name')` → `'abilities.frost_axe.name'`；`abilityEffectText('slash','damage')` → `'abilities.slash.effects.damage'`

### 强制要求

1. 禁止自行实现注册表或全局单例
2. `getRegisteredIds()` 用于 `entity-chain-integrity.test.ts` 契约测试
3. 条件评估复用 `primitives/condition`（`AbilityDef.condition` 使用 `ConditionNode`）
4. **新游戏必须使用 `constraints` 字段声明约束**（见下方「通用能力约束系统」节）

### 两种执行模式（可混合）

- **声明式**：`AbilityDef` 数据 → `AbilityRegistry` → `executeEffects()` 执行效果列表（效果结构统一时）
- **命令式**：`AbilityExecutor` 函数 → `AbilityExecutorRegistry` → `resolve(id, tag?)` 调用（逻辑差异大时）

### 现有游戏迁移状态

**能力系统**：SummonerWars 已完成迁移（引擎层 Registry + ExecutorRegistry）。DiceThrone `CombatAbilityManager`、SmashUp `abilityRegistry.ts` 是历史实现（内部合理但未用引擎层），**新游戏禁止模仿**。

**状态/buff 原语（TagContainer / ModifierStack）**：
- **SummonerWars 历史债务**：`BoardUnit` 上 `tempAbilities`/`boosts`/`extraAttacks`/`healingMode`/`wasAttackedThisTurn`/`originalOwner` 为 ad-hoc 字段，未用 TagContainer，回合清理靠手动解构。**新游戏禁止模仿**，必须用 `createTagContainer()` + `tickDurations`。
- DiceThrone 已用引擎层 TagContainer；SmashUp 无 buff 系统。

**对象生命周期 / 延迟交互历史债务**：
- **SummonerWars 历史债务**：`owner/originalOwner/attachedCards/attachedUnits` 仍是对象身份、临时控制和宿主关系的 ad-hoc 混合表达。**新游戏禁止模仿**，必须先抽稳定 `object ref + provenance`。
- **DiceThrone 历史债务**：`currentChoiceSourceAbilityId + pending state + payload-shaped choice` 仍有较强隐藏耦合。**新游戏禁止模仿**，必须优先设计显式 `deferred snapshot + interaction descriptor`。
- **Cardia 历史债务**：`interaction: any`、`context` 透传、resolve 时再按 `sourceId` 回查 handler。**新游戏禁止模仿**，必须让交互 envelope 自足。

## 被动触发能力（beforeAttack）交互模式（SummonerWars）

> 攻击前自动触发的被动能力（如圣光箭 `holy_arrow`、治疗 `healing`、生命汲取 `life_drain`），使用 `abilityMode` 状态驱动 UI，**不使用弹窗式 `CardSelectorOverlay`**。

### 交互流程

1. 玩家点击攻击目标 → `useCellInteraction` 检测攻击者是否有 `passiveTrigger: 'beforeAttack'` 能力
2. 有被动能力 → 设置 `abilityMode = { step: 'selectCards', context: 'beforeAttack', pendingAttackTarget, ... }`
3. **StatusBanners** 渲染 amber 横幅，显示能力提示文本 + "确认弃牌"按钮 + "跳过"按钮
4. **HandArea** 收到 `abilitySelectingCards=true`，手牌区直接高亮可选，点击手牌切换选中状态（`data-selected="true/false"`）
5. 点击"确认弃牌"（`onConfirmBeforeAttackCards`）→ 发送 `DECLARE_ATTACK` 命令（带 `beforeAttack` payload）
6. 点击"跳过"（`onCancelBeforeAttack`）→ 发送 `DECLARE_ATTACK` 命令（不带 `beforeAttack`）

### UI 选择器（E2E 测试强制）

| 元素 | 正确选择器 | ❌ 错误选择器 |
|------|-----------|-------------|
| 确认弃牌按钮 | `button:has-text("Confirm Discard")` 或 `button:has-text("确认弃牌")` | ❌ `[data-testid="sw-card-selector-overlay"] button` |
| 跳过按钮 | `button:has-text("Skip")` 或 `button:has-text("跳过")` | ❌ overlay 内的跳过按钮 |
| 手牌选择 | `[data-testid="sw-hand-area"] [data-card-type="unit"]` 直接点击 | ❌ `[data-testid="sw-card-selector-overlay"] [data-card-type]` |
| 选中状态验证 | `[data-selected="true"]` | — |

### 关键文件

- `useCellInteraction.ts` — `handleCellClick` 中检测被动能力并设置 `abilityMode`
- `StatusBanners.tsx` — 渲染 `abilityMode.step === 'selectCards'` 时的横幅和按钮
- `HandArea.tsx` — `abilitySelectingCards` prop 控制手牌选择模式（绕过魔力检查）
- `abilities-paladin.ts` — `holy_arrow`/`healing` 的 `passiveTrigger: 'beforeAttack'` 定义

### 教训

此模式从"青色波纹按钮手动触发"重构为"攻击时自动弹出确认横幅"。重构后 E2E 测试未同步更新选择器（仍查找 `sw-card-selector-overlay`），导致测试从未真正执行过弃牌选择流程。**重构 UI 交互模式后，必须同步更新所有 E2E 测试的选择器**。

## 通用能力约束系统（强制）

> **新游戏必须使用**。现有游戏（SummonerWars）标记为过时但保持兼容。

### 设计原则

- **数据驱动**：约束声明在 `AbilityDef.constraints` 中，验证逻辑在引擎层统一处理
- **可组合**：多个约束可同时生效（行动消耗 + 实体状态 + 资源 + 使用次数）
- **可扩展**：游戏层可注册自定义约束检查器
- **类型安全**：通过泛型保持上下文类型

### 核心 API（`engine/primitives/abilityConstraints.ts`）

```typescript
// 主检查函数
checkAbilityConstraints(
  constraints: AbilityConstraints | undefined,
  ctx: ConstraintContext,
  registry?: ConstraintHandlerRegistry,
): ConstraintCheckResult

// 自定义约束注册
createConstraintHandlerRegistry(): ConstraintHandlerRegistry
registerConstraintHandler(registry, name, handler): void
```

### 约束类型

| 约束类型 | 用途 | 配置示例 |
|---------|------|---------|
| `actionCost` | 消耗行动次数（移动/攻击） | `{ type: 'move', count: 1 }` |
| `entityState` | 实体状态检查（未移动/未攻击） | `{ notMoved: true, notAttacked: true }` |
| `resource` | 资源数量要求（充能/魔力/生命值） | `{ charge: { min: 1 }, magic: { exact: 3 } }` |
| `usageLimit` | 使用次数限制 | `{ perTurn: 1, perBattle: 3 }` |
| `custom` | 自定义约束处理器 | `[{ handler: 'adjacentAlly', params: {} }]` |

### 使用示例

#### 1. 在 AbilityDef 中声明约束

```typescript
const prepareAbility: AbilityDef = {
  id: 'prepare',
  name: abilityText('prepare', 'name'),
  description: abilityText('prepare', 'description'),
  constraints: {
    actionCost: { type: 'move', count: 1 },  // 消耗一次移动
    entityState: { notMoved: true },          // 要求未移动
    resource: { charge: { min: 0 } },         // 可选：需要充能槽
  },
  effects: [{ type: 'grantCharge', value: 1 }],
};
```

#### 2. 在验证层调用

```typescript
import { checkAbilityConstraints, type ConstraintContext } from '../../../engine/primitives/abilityConstraints';

function validateAbilityActivation(core, playerId, payload) {
  const ability = abilityRegistry.get(payload.abilityId);
  if (!ability) return { valid: false, error: '未知技能' };

  // 构建约束检查上下文
  const ctx: ConstraintContext = {
    actionCounts: { move: core.players[playerId].moveCount, attack: core.players[playerId].attackCount },
    actionLimits: { move: 3, attack: 3 },
    entityState: { hasMoved: sourceUnit.hasMoved, hasAttacked: sourceUnit.hasAttacked },
    resources: { charge: sourceUnit.boosts ?? 0, magic: core.players[playerId].magic },
  };

  // 检查约束
  const result = checkAbilityConstraints(ability.constraints, ctx);
  if (!result.valid) return { valid: false, error: result.error };

  // ... 其他验证逻辑
  return { valid: true };
}
```

#### 3. 自定义约束处理器（可选）

```typescript
import { createConstraintHandlerRegistry, registerConstraintHandler } from '../../../engine/primitives/abilityConstraints';

const constraintRegistry = createConstraintHandlerRegistry();

// 注册自定义约束：要求相邻有友方单位
registerConstraintHandler(constraintRegistry, 'adjacentAlly', (params, ctx) => {
  const adjacentAllies = getAdjacentAllies(ctx.sourcePosition, ctx.core);
  if (adjacentAllies.length === 0) {
    return { valid: false, error: '附近没有友方单位', failedConstraint: 'custom.adjacentAlly' };
  }
  return { valid: true };
});

// 在 AbilityDef 中使用
const ability: AbilityDef = {
  id: 'rally',
  constraints: {
    custom: [{ handler: 'adjacentAlly' }],
  },
  // ...
};

// 验证时传入注册表
checkAbilityConstraints(ability.constraints, ctx, constraintRegistry);
```

### 迁移指南（现有游戏）

**旧代码（SummonerWars 当前模式）**：
```typescript
// abilities-barbaric.ts
export const prepareAbility: AbilityDef = {
  id: 'prepare',
  costsMoveAction: true,  // ad-hoc 字段
  validation: {
    customValidator: (ctx) => {
      if (ctx.sourceUnit.hasMoved) return { valid: false, error: '该单位本回合已移动' };
      if (ctx.core.players[ctx.playerId].moveCount >= 3) return { valid: false, error: '移动次数已用完' };
      return { valid: true };
    },
  },
};

// abilityValidation.ts
if (ability.costsMoveAction && player.moveCount >= MAX_MOVES_PER_TURN) {
  return { valid: false, error: '本回合移动次数已用完' };
}
```

**新代码（推荐模式）**：
```typescript
// abilities-barbaric.ts
export const prepareAbility: AbilityDef = {
  id: 'prepare',
  constraints: {
    actionCost: { type: 'move', count: 1 },
    entityState: { notMoved: true },
  },
};

// abilityValidation.ts
const ctx: ConstraintContext = {
  actionCounts: { move: player.moveCount, attack: player.attackCount },
  actionLimits: { move: MAX_MOVES_PER_TURN, attack: MAX_ATTACKS_PER_TURN },
  entityState: { hasMoved: sourceUnit.hasMoved, hasAttacked: sourceUnit.hasAttacked },
};
const result = checkAbilityConstraints(ability.constraints, ctx);
if (!result.valid) return { valid: false, error: result.error };
```

### 优势

1. **数据驱动**：约束声明在数据中，无需手写验证逻辑
2. **可组合**：多种约束类型可同时生效，自动合并检查
3. **可扩展**：通过 `custom` 约束支持游戏特定规则
4. **类型安全**：`ConstraintContext` 通过泛型保持类型
5. **可测试**：约束检查逻辑独立，易于单元测试
6. **可复用**：所有游戏共享同一套约束系统，避免重复实现

### 禁止事项

- ❌ 禁止在游戏层重新实现约束检查逻辑（如 `costsMoveAction` + 手写验证）
- ❌ 禁止在 `customValidator` 中检查通用约束（行动次数/资源/状态）
- ❌ 禁止用可选参数掩盖约束依赖（如 `state?: TCore`）— 应拆分为两个函数
- ✅ 新游戏必须使用 `constraints` 字段
- ✅ 现有游戏可保持当前模式（已标记为过时），但新增技能推荐迁移
