---
name: engine-damage-pipeline
description: 伤害管线标准：伤害计算、结算时机和跨层消费——改伤害或生命值流程时查
metadata:
  type: doc
  status: 已交付
---

# 引擎伤害计算管线

本文档定义 `engine/primitives/damageCalculation.ts` 的使用合同；相关实施指南见 `docs/damage-calculation-pipeline-migration-guide.md`。

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

  // 攻击上下文（由游戏层把自己的攻击账本投影成通用合同）
  attackDamageContext?: {
    attackerId: PlayerId;
    defenderId: PlayerId;
    bonusDamage?: number;
    isUltimate?: boolean;
  };

  // 自动收集开关（默认 true）
  autoCollectTokens?: boolean;    // 自动收集 Token 修正
  autoCollectStatus?: boolean;    // 自动收集状态修正
  autoCollectShields?: boolean;   // 自动收集护盾减免
  autoCollectBonusDamage?: boolean; // 自动收集 attackDamageContext.bonusDamage

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

#### 攻击上下文修正
攻击限定修正、终极攻击判定和攻击加伤必须通过 `attackDamageContext` 传入。引擎层不得读取某个游戏的攻击状态字段（例如 pending attack、combat session 或等价私有账本）；游戏层负责把它们投影为 `attackerId / defenderId / bonusDamage / isUltimate`。

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

### 正式净掉血合同（强制）

- `DAMAGE_DEALT.payload.amount` 表示进入扣血处理的伤害输入；它可以来自技能计算、奖励骰、Token 或其它规则结算。
- `DAMAGE_DEALT.payload.actualDamage` 在伤害事件被 reducer 结算后，必须表示本次事件造成的**正式净掉血**：护盾、防止、闪避、无敌、HP 下限钳制和队伍共享 HP 同步都已经处理完。
- reducer 是正式 HP / 队伍 HP 的唯一写入口。动画、行动日志、当前伤害摘要和 AI 后续结算只能读取 reducer 已经写入的正式 HP 或 reducer 回填的正式净掉血；不得再按护盾消耗、技能预估、骰面、custom action 估算或 UI 展示值二次推导一个“最终伤害”。
- 任何会把致死伤害替换成“保留 1 点生命 / 防止死亡 / 消耗保命资源”的规则，必须在正式扣血入口保留不变量；事件构造阶段可以提前产生日志和副作用，但不能成为唯一保护点。旧手写 `DAMAGE_DEALT`、状态伤害、Token 反伤、奖励骰伤害和迁移中入口都不得绕过最终保命规则。
- 如果某个游戏的事件系统不能安全回填原事件，必须由 reducer 产出等价的 post-settlement 事件或结果字段；不得让表现层自己复算正式数值。

### 注意事项

1. **自动收集依赖 tokenDefinitions**：如果 `state.core.tokenDefinitions` 为空或未正确设置，自动收集不会工作，需要手动添加修正。
2. **先授予 Token 再造成伤害**：必须手动添加修正，因为 state 还未更新。禁用 `autoCollectTokens` 避免读取旧状态。
3. **修正优先级**：
   - 基础伤害：priority = 0
   - Token/状态修正：priority = 10-20
   - 护盾减免：priority = 100（最后应用）
4. **攻击上下文由游戏层投影**：`DamageCalculation` 只能消费 `attackDamageContext`，不能直接认识某个游戏的 `pendingAttack`、攻击阶段或卡牌专属加伤账本。
5. **伤害不会为负数**：`resolve()` 会自动将负数伤害钳制为 0。
6. **向后兼容**：旧的手动 `modifiers` 格式仍可正常工作，ActionLog 会降级渲染。
7. **玩家摘要不是规则真相**：当前伤害摘要、ActionLog 展示、hover 文案和动画数值只能从已经写入的规则状态或提交事件读取。若 `pendingAttack.damage`、`pendingDamage.currentDamage`、奖励骰结算或 `DAMAGE_DEALT` 尚未给出正式值，摘要不得从 AI 估算、custom action `estimateDamage`、技能定义或动画骰面补算一个正式伤害。
8. **动态估算必须限定用途**：DiceThrone 这类 custom action 动态伤害可以保留规则门槛 / AI 专用估算 helper，例如暴击 Token 门槛或 AI 选招评分；该 helper 不得被最终 HP 结算、玩家正式当前伤害摘要或响应窗口当前伤害账本消费。

### 迁移指南

详见 `docs/damage-calculation-pipeline-migration-guide.md`。

### 测试

- 单元测试：`src/engine/primitives/__tests__/damageCalculation.test.ts`
- 集成测试：`src/games/dicethrone/domain/__tests__/damage-pipeline-migration.test.ts`
- 迁移示例：`src/games/dicethrone/domain/customActions/pyromancer.ts`
