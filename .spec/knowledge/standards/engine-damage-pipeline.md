---
name: engine-damage-pipeline
description: 伤害管线标准：伤害计算、结算时机和跨层消费——改伤害或生命值流程时查
metadata:
  type: doc
  status: 已交付
---

# 引擎伤害计算管线

> 来源：从 `.spec/knowledge/standards/engine-systems.md` 无损拆出。本文档承载 `engine/primitives/damageCalculation.ts` 的使用合同；迁移步骤另见 `docs/damage-calculation-pipeline-migration-guide.md`。

## 伤害计算管线（`engine/primitives/damageCalculation.ts`）（强制）

> **迁移状态**: ✅ DiceThrone 完成（26/27，96%）
> **历史遗留**: SummonerWars/SmashUp 保持现有实现
> **新游戏规范**: 必须使用伤害计算管线，禁止手动构建 DAMAGE_DEALT 事件

### 概述

伤害计算管线是基于 `modifier.ts` 的专用包装器，提供：
- **自动收集修正**：从 Token/状态/护盾自动收集伤害修正
- **完整 breakdown**：生成包含基础伤害 + 每步修正的计算链路
- **ActionLog 集成**：breakdown 结构直接用于 ActionLog 显示
- **向后兼容**：旧的手动 modifiers 格式仍可正常工作

**DiceThrone 迁移完成度**: 26/27 个伤害计算点（96%），1 个遗留（PyroBlast 奖励骰结算，涉及奖励骰系统，优先级低）。

### 核心 API

```typescript
// 创建伤害计算实例
function createDamageCalculation(config: DamageCalculationConfig): DamageCalculation

// 批量计算（AOE 技能优化）
function createBatchDamageCalculation(
  config: Omit<DamageCalculationConfig, 'target'> & { targets: DamageTarget[] }
): DamageCalculation[]

// DamageCalculation 类方法
class DamageCalculation {
  resolve(): DamageResult        // 计算最终伤害
  toEvents(): GameEvent[]        // 生成 DAMAGE_DEALT 事件
}
```

### 配置选项

```typescript
interface DamageCalculationConfig {
  source: DamageSource;           // 伤害来源（playerId + abilityId）
  target: DamageTarget;           // 伤害目标（playerId）
  baseDamage: number;             // 基础伤害值
  state: any;                     // 游戏状态（用于自动收集）
  timestamp?: number;             // 时间戳

  // 自动收集开关（默认 true）
  autoCollectTokens?: boolean;    // 自动收集 Token 修正
  autoCollectStatus?: boolean;    // 自动收集状态修正
  autoCollectShields?: boolean;   // 自动收集护盾减免

  // 手动添加的修正
  additionalModifiers?: ModifierDef<DamageContext>[];
}
```

### 使用场景

#### 场景 1：基础伤害（无修正）

```typescript
const damageCalc = createDamageCalculation({
  source: { playerId: attackerId, abilityId: 'fireball' },
  target: { playerId: defenderId },
  baseDamage: 5,
  state: ctx.state,
  timestamp: ctx.timestamp,
  autoCollectTokens: false,
  autoCollectStatus: false,
  autoCollectShields: false,
});
events.push(...damageCalc.toEvents());
```

#### 场景 2：自动收集 Token 修正

```typescript
// 假设攻击方有 3 个火焰精通 Token（damageBonus: 1）
const damageCalc = createDamageCalculation({
  source: { playerId: attackerId, abilityId: 'flame-strike' },
  target: { playerId: defenderId },
  baseDamage: 5,
  state: ctx.state,
  timestamp: ctx.timestamp,
  autoCollectTokens: true,  // 自动加上 3 点伤害
  autoCollectStatus: false,
  autoCollectShields: false,
});
// 最终伤害：5 + 3 = 8
```

#### 场景 3：手动添加修正（先授予 Token 再造成伤害）

```typescript
// 1. 先授予 2 个火焰精通
const currentFM = getFireMasteryCount(ctx);
const updatedFM = Math.min(currentFM + 2, limit);
events.push({
  type: 'TOKEN_GRANTED',
  payload: { targetId: attackerId, tokenId: 'fire_mastery', amount: 2, newTotal: updatedFM },
  // ...
});

// 2. 造成伤害（基于授予后的 FM）
// 注意：必须手动添加修正，因为 state 还未更新
const damageCalc = createDamageCalculation({
  source: { playerId: attackerId, abilityId: 'fiery-combo' },
  target: { playerId: defenderId },
  baseDamage: 5,
  state: ctx.state,
  timestamp: ctx.timestamp + 0.1,
  additionalModifiers: updatedFM > 0 ? [{
    id: 'fiery-combo-fm',
    type: 'flat',
    value: updatedFM,  // 使用授予后的值
    priority: 10,
    source: 'fire_mastery',
    description: 'tokens.fire_mastery.name',
  }] : [],
  autoCollectTokens: false,  // 禁用自动收集（会读取旧状态）
});
events.push(...damageCalc.toEvents());
```

#### 场景 4：乘法修正

```typescript
const fm = getFireMasteryCount(ctx);
const damageCalc = createDamageCalculation({
  source: { playerId: attackerId, abilityId: 'ignite' },
  target: { playerId: defenderId },
  baseDamage: 4,
  state: ctx.state,
  timestamp: ctx.timestamp,
  additionalModifiers: fm > 0 ? [{
    id: 'ignite-fm-multiplier',
    type: 'flat',
    value: fm * 2,  // 2x FM 乘法修正
    priority: 10,
    source: 'fire_mastery',
    description: 'tokens.fire_mastery.name',
  }] : [],
  autoCollectTokens: false,
});
// 最终伤害：4 + (fm * 2)
```

#### 场景 5：条件修正

```typescript
const damageCalc = createDamageCalculation({
  source: { playerId: attackerId, abilityId: 'burn-strike' },
  target: { playerId: defenderId },
  baseDamage: 5,
  state: ctx.state,
  timestamp: ctx.timestamp,
  additionalModifiers: [{
    id: 'burn-bonus',
    type: 'flat',
    value: 2,
    priority: 10,
    source: 'burn-bonus',
    condition: (ctx) => {
      // 只有目标有燃烧状态时才加成
      const target = ctx.state.core.players[ctx.target.playerId];
      return (target.statusEffects.burn || 0) > 0;
    },
  }],
});
```

### 自动收集机制

#### Token 修正
从 `state.core.players[attackerId].tokens` 读取，查找 `tokenDefinitions` 中有 `damageBonus` 的 Token：

```typescript
// tokenDefinitions 示例
[
  { id: 'fire_mastery', name: 'tokens.fire_mastery.name', damageBonus: 1 },
  { id: 'taiji', name: 'tokens.taiji.name', damageBonus: 1 },
]

// 如果攻击方有 3 个 fire_mastery，自动添加 +3 伤害修正
```

#### 状态修正
从 `state.core.players[defenderId].statusEffects` 读取，查找 `tokenDefinitions` 中有 `damageReduction` 的状态：

```typescript
// tokenDefinitions 示例
[
  { id: 'armor', name: 'status.armor.name', damageReduction: 1 },
]

// 如果目标有 2 层护甲，自动添加 -2 伤害修正
```

#### 护盾修正
从 `state.core.players[defenderId].damageShields` 读取，累加所有护盾值：

```typescript
// 如果目标有 [{ value: 2 }, { value: 3 }]，自动添加 -5 伤害修正
```

### Breakdown 结构

```typescript
interface DamageBreakdown {
  base: {
    value: number;              // 基础伤害
    sourceId: string;           // 来源 ID（abilityId）
    sourceName?: string;        // 来源名称（i18n key 或文本）
    sourceNameIsI18n?: boolean; // 是否为 i18n key
  };
  steps: DamageBreakdownStep[]; // 修正步骤列表
}

interface DamageBreakdownStep {
  type: string;                 // 修正类型（flat/percent）
  value: number;                // 修正值
  sourceId: string;             // 来源 ID
  sourceName?: string;          // 来源名称
  sourceNameIsI18n?: boolean;   // 是否为 i18n key
  runningTotal: number;         // 应用后的累计值
}
```

### ActionLog 集成

新的 `DAMAGE_DEALT` 事件包含 `breakdown` 字段：

```typescript
interface DamageDealtEvent {
  type: 'DAMAGE_DEALT';
  payload: {
    targetId: PlayerId;
    amount: number;
    actualDamage: number;
    sourceAbilityId?: string;
    modifiers?: DamageModifier[];  // 旧格式（向后兼容）
    breakdown?: DamageBreakdown;   // 新格式（优先使用）
  };
}
```

ActionLog 格式化逻辑优先使用 `breakdown`，降级到 `modifiers`：

```typescript
// 优先使用新格式
if (breakdown) {
  breakdownLines.push({
    label: breakdown.base.sourceName || breakdown.base.sourceId,
    value: breakdown.base.value,
    color: 'neutral',
  });
  breakdown.steps.forEach(step => {
    breakdownLines.push({
      label: step.sourceName || step.sourceId,
      value: step.value,
      color: step.value > 0 ? 'positive' : 'negative',
    });
  });
}
// 降级到旧格式
else if (modifiers && modifiers.length > 0) {
  // ...
}
```

### 注意事项

1. **自动收集依赖 tokenDefinitions**：如果 `state.core.tokenDefinitions` 为空或未正确设置，自动收集不会工作，需要手动添加修正。
2. **先授予 Token 再造成伤害**：必须手动添加修正，因为 state 还未更新。禁用 `autoCollectTokens` 避免读取旧状态。
3. **修正优先级**：
   - 基础伤害：priority = 0
   - Token/状态修正：priority = 10-20
   - 护盾减免：priority = 100（最后应用）
4. **伤害不会为负数**：`resolve()` 会自动将负数伤害钳制为 0。
5. **向后兼容**：旧的手动 `modifiers` 格式仍可正常工作，ActionLog 会降级渲染。

### 迁移指南

详见 `docs/damage-calculation-pipeline-migration-guide.md`。

### 测试

- 单元测试：`src/engine/primitives/__tests__/damageCalculation.test.ts`
- 集成测试：`src/games/dicethrone/domain/__tests__/damage-pipeline-migration.test.ts`
- 迁移示例：`src/games/dicethrone/domain/customActions/pyromancer.ts`
