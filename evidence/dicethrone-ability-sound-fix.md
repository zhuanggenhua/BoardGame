# DiceThrone 技能音效问题修复

## 问题描述

用户反馈：DiceThrone 攻击时不播放音效。

## 正确的设计

1. **选择技能时**：不播放技能的专属音效
2. **攻击发起时**（`ATTACK_INITIATED` 事件）：播放"攻击发起"音效（挥剑音效）
3. **伤害动画播放时**（`DAMAGE_DEALT` 事件）：播放技能的专属音效（`AbilityDef.sfxKey`）或通用打击音

## 根因分析

### 问题定位

有两个问题：

1. **`ABILITY_ACTIVATED` 事件**：即使事件策略是 `'fx'`（不播放音效），`audio.config.ts` 中的 `feedbackResolver` 仍然会检查技能的 `sfxKey` 并返回，导致选择技能时就播放了音效。

2. **`ATTACK_INITIATED` 事件**：`feedbackResolver` 中的逻辑是：如果技能有 `sfxKey`，就返回 `null`（不播放音效），导致攻击时不播放任何音效。

**错误的代码**（`src/games/dicethrone/audio.config.ts`）：
```typescript
// ABILITY_ACTIVATED：检查技能自带音效
if (type === 'ABILITY_ACTIVATED') {
    const payload = (event as AudioEvent & { payload?: { playerId?: string; abilityId?: string } }).payload;
    if (payload?.playerId && payload?.abilityId) {
        const match = findPlayerAbility(G, payload.playerId, payload.abilityId);
        const explicitKey = match?.variant?.sfxKey ?? match?.ability?.sfxKey;
        // 如果技能有自带音效，返回该音效 key
        if (explicitKey) return explicitKey;  // ❌ 选择技能时就播放了音效！
    }
}

// ATTACK_INITIATED：检查技能自带音效
if (type === 'ATTACK_INITIATED') {
    const payload = (event as AudioEvent & { payload?: { attackerId?: string; sourceAbilityId?: string } }).payload;
    if (payload?.attackerId && payload?.sourceAbilityId) {
        const match = findPlayerAbility(G, payload.attackerId, payload.sourceAbilityId);
        const explicitKey = match?.variant?.sfxKey ?? match?.ability?.sfxKey;
        if (explicitKey) return null;  // ❌ 攻击时不播放音效！
    }
}
```

### 回归历史

**引入时间**：2026-03-03 23:54:03（提交 `56b88b7`）

**提交信息**：`fix: 修复代码审查发现的 6 个 bug + 更新 --no-verify 使用规范`

**变更内容**：
```diff
-  ABILITY_ACTIVATED: 'fx',       // 技能激活（技能自带音效）
+  ABILITY_ACTIVATED: 'immediate', // 技能激活（技能自带音效，立即播放）
```

**变更意图**：将技能激活音效从 `'fx'`（动画驱动）改为 `'immediate'`（立即播放），希望技能激活时立即播放音效。

**问题**：
1. 误解了设计意图：技能音效应该在攻击动画时播放，而不是选择技能时播放
2. `audio.config.ts` 中的 `feedbackResolver` 会检查技能的 `sfxKey` 并返回，导致选择技能时就播放了音效

## 修复方案

### 修改内容

1. **恢复 `ABILITY_ACTIVATED` 事件策略为 `'fx'`**（`src/games/dicethrone/domain/events.ts`）
   ```typescript
   ABILITY_ACTIVATED: 'fx',       // 技能激活（技能自带音效，由 FX 系统在攻击动画时播放）
   ```

2. **修改 `feedbackResolver` 中的 `ABILITY_ACTIVATED` 处理**（`src/games/dicethrone/audio.config.ts`）
   ```typescript
   // ABILITY_ACTIVATED：技能激活时不播放音效
   // 技能音效由 FX 系统在攻击动画 onImpact 时播放（useAnimationEffects.findAbilitySfxKey）
   if (type === 'ABILITY_ACTIVATED') {
       return null;
   }
   ```

3. **移除 `feedbackResolver` 中的 `ATTACK_INITIATED` 特殊处理**（`src/games/dicethrone/audio.config.ts`）
   ```typescript
   // ATTACK_INITIATED：总是播放攻击发起音效（挥剑音效）
   // 技能专属音效在伤害动画 onImpact 时播放，不在这里播放
   // 不需要特殊处理，直接回退到框架默认音效
   ```

### 工作原理

1. **选择技能时**：
   - 触发 `ABILITY_ACTIVATED` 事件
   - `feedbackResolver` 返回 `null`
   - 不播放任何音效

2. **攻击发起时**：
   - 触发 `ATTACK_INITIATED` 事件
   - `feedbackResolver` 回退到框架默认音效
   - 播放 `ATTACK_INITIATE_KEY`（挥剑音效）

3. **伤害动画播放时**：
   - 触发 `DAMAGE_DEALT` 事件
   - `useAnimationEffects.buildDamageStep` 构建动画参数
   - `findAbilitySfxKey(sourceAbilityId)` 查找技能的 `sfxKey`
   - 伤害动画 `onImpact` 时播放技能音效（如果有），否则播放通用打击音

## 技能音效播放机制

### 音效来源

技能音效定义在 `AbilityDef.sfxKey` 或 `AbilityVariantDef.sfxKey`：

```typescript
export interface AbilityDef {
    id: string;
    name: string;
    type: AbilityType;
    sfxKey?: string;  // 技能音效 key
    // ...
}
```

### 播放流程

1. **技能执行** → 产生 `DAMAGE_DEALT` 事件（包含 `sourceAbilityId`）
2. **伤害动画** → `useAnimationEffects.buildDamageStep` 构建动画参数
3. **查找音效** → `findAbilitySfxKey(sourceAbilityId)` 查找技能的 `sfxKey`
4. **播放音效** → 伤害动画 `onImpact` 时播放技能音效（如果有），否则播放通用打击音

### 代码位置

**音效查找**（`src/games/dicethrone/hooks/useAnimationEffects.ts`）：
```typescript
const findAbilitySfxKey = useCallback((abilityId: string | undefined): string | undefined => {
    if (!abilityId) return undefined;
    const allAbilities: AbilityDef[] = [
        ...(player?.abilities ?? []),
        ...(opponent?.abilities ?? []),
    ];
    for (const ability of allAbilities) {
        // 先检查变体 ID
        if (ability.variants?.length) {
            const variant = ability.variants.find(v => v.id === abilityId);
            if (variant) {
                return variant.sfxKey ?? ability.sfxKey;
            }
        }
        if (ability.id === abilityId) {
            return ability.sfxKey;
        }
    }
    return undefined;
}, [player?.abilities, opponent?.abilities]);
```

**音效应用**（`src/games/dicethrone/hooks/useAnimationEffects.ts`）：
```typescript
const buildDamageStep = useCallback((dmgEvent: DamageDealtEvent, ...): AnimStep | null => {
    // ...
    const sourceId = dmgEvent.payload.sourceAbilityId ?? '';
    const isDot = sourceId.startsWith('upkeep-');
    const cue = isDot ? DT_FX.DOT_DAMAGE : DT_FX.DAMAGE;
    
    // 技能专属音效优先（如和尚拳法、雷霆万钧各有独立音效），
    // 找不到时回退到通用打击音（按伤害量区分轻/重击）
    const abilitySfx = isDot ? undefined : findAbilitySfxKey(sourceId || undefined);
    const soundKey = abilitySfx ?? (isDot ? undefined : resolveDamageImpactKey(damage, targetId, currentPlayerId));
    // ...
}, [/* ... */]);
```

## 验证

### ESLint 检查

```bash
npx eslint src/games/dicethrone/domain/events.ts
npx eslint src/games/dicethrone/audio.config.ts
```

结果：✅ 通过（0 errors，6 warnings 为已存在的未使用变量）

### 预期行为

1. **选择技能时**：不播放音效
2. **攻击发起时**：播放"攻击发起"音效（挥剑音效，`ATTACK_INITIATE_KEY`）
3. **伤害动画播放时**：播放技能的专属音效（如果技能定义了 `sfxKey`），否则播放通用打击音

## 教训

1. **理解设计意图**：修改前必须理解原始设计的意图，不能凭直觉修改
2. **全链路检查**：音效配置不仅在事件定义中，还在 `feedbackResolver` 中，必须两处都检查
3. **测试音效播放时机**：音效配置修改后应该测试音效在什么时候播放
4. **提交信息应该记录所有变更**：`56b88b7` 提交修复了 6 个 bug，但没有记录 `ABILITY_ACTIVATED` 的修改，导致回归时难以追溯

## 相关文件

- `src/games/dicethrone/domain/events.ts` - 事件定义（已修复）
- `src/games/dicethrone/audio.config.ts` - 音频配置（已修复）
- `src/games/dicethrone/hooks/useAnimationEffects.ts` - 动画效果（包含音效播放逻辑）
- `src/games/dicethrone/domain/combat/types.ts` - 技能定义（包含 `sfxKey` 字段）
- `docs/ai-rules/engine-systems.md` - 音频架构规范
- `AGENTS.md` - 音频事件定义规范
