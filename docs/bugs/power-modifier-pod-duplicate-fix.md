# Bug 修复：力量修正 POD 版本重复调用

## 问题描述

**症状**：`steampunk_steam_man_pod`（蒸汽人 POD 版本）在基地有行动卡时，力量修正为 +2 而不是 +1。

**根本原因**：POD 别名系统为已内置 POD 支持的修正函数创建了重复注册，导致同一个函数被调用两次。

## 技术细节

### 问题根源

力量修正系统存在两种不同的设计模式混用：

#### 模式 1：修正函数内部处理 POD（内置支持）
```typescript
registerPowerModifier('steampunk_steam_man', (ctx) => {
    const baseId = ctx.minion.defId.replace(/_pod$/, ''); // 内部去掉 _pod
    if (baseId !== 'steampunk_steam_man') return 0;
    // ...
});
```
- 一个注册项，函数内部同时处理基础版和 POD 版
- **不需要** POD 别名

#### 模式 2：依赖 POD 别名系统（外部支持）
```typescript
registerPowerModifier('ghost_haunting', (ctx) => {
    if (ctx.minion.defId !== 'ghost_haunting') return 0; // 精确匹配
    // ...
});
// POD 别名系统自动创建：
// registerPowerModifier('ghost_haunting_pod', 同一个函数);
```
- 两个注册项（基础版 + POD 版），共享同一个函数
- **需要** POD 别名

### Bug 触发流程

当计算 `steampunk_steam_man_pod` 的力量时：

1. `getOngoingPowerModifier` 遍历所有注册项
2. 遇到 `sourceDefId: 'steampunk_steam_man'` 的条目，调用修正函数
   - 函数内部：`baseId = 'steampunk_steam_man_pod'.replace(/_pod$/, '')` → `'steampunk_steam_man'`
   - 匹配成功，返回 +1
3. 遇到 `sourceDefId: 'steampunk_steam_man_pod'` 的条目，调用**同一个**修正函数
   - 函数内部：`baseId = 'steampunk_steam_man_pod'.replace(/_pod$/, '')` → `'steampunk_steam_man'`
   - 匹配成功，再返回 +1
4. 总共 +2（错误）

**关键问题**：POD 别名系统为已内置 POD 支持的函数创建了不必要的别名，导致函数被调用两次。

## 解决方案

### 方案对比

#### 方案 A：计算层去重（初步修复）
```typescript
export function getOngoingPowerModifier(...) {
    const calledModifiers = new Set<PowerModifierFn>();
    for (const entry of modifierRegistry) {
        if (calledModifiers.has(entry.modifier)) continue; // 去重
        calledModifiers.add(entry.modifier);
        total += entry.modifier(ctx);
    }
}
```
- ✅ 简单直接，改动最小
- ❌ 在计算层做去重，不够清晰
- ❌ 治标不治本

#### 方案 B：注册层标记（最终方案）✅
```typescript
// 1. 修正函数注册时标记
registerPowerModifier('steampunk_steam_man', modifierFn, { 
    handlesPodInternally: true  // 标记：已内置 POD 支持
});

// 2. POD 别名系统跳过已标记的函数
export function registerPodPowerModifierAliases(): void {
    for (const entry of modifierRegistry) {
        if (entry.handlesPodInternally) continue; // 跳过
        // 创建 POD 别名...
    }
}
```
- ✅ 问题在源头解决
- ✅ 显式声明设计意图
- ✅ 计算层保持简单
- ✅ 易于维护

#### 方案 C：统一模式（理想但改动大）
```typescript
// 所有修正函数都使用精确匹配，完全依赖 POD 别名系统
registerPowerModifier('steampunk_steam_man', (ctx) => {
    if (ctx.minion.defId !== 'steampunk_steam_man') return 0;
    // ...
});
```
- ✅ 架构最清晰
- ❌ 需要修改所有使用 `baseId` 模式的函数
- ❌ 改动太大，风险高

### 最终实现（方案 B）

#### 1. 修改类型定义
```typescript
interface ModifierEntry {
    sourceDefId: string;
    modifier: PowerModifierFn;
    handlesPodInternally?: boolean; // 新增标记
}
```

#### 2. 修改注册函数
```typescript
export function registerPowerModifier(
    sourceDefId: string,
    modifier: PowerModifierFn,
    options?: { handlesPodInternally?: boolean }
): void {
    if (modifierRegistry.some(e => e.sourceDefId === sourceDefId)) return;
    modifierRegistry.push({ 
        sourceDefId, 
        modifier, 
        handlesPodInternally: options?.handlesPodInternally 
    });
}
```

#### 3. 修改 POD 别名系统
```typescript
export function registerPodPowerModifierAliases(): void {
    let mappedCount = 0;
    let skippedCount = 0;
    
    for (const entry of modifierRegistry) {
        if (!entry.sourceDefId.endsWith('_pod')) {
            const podId = entry.sourceDefId + '_pod';
            if (!modifierRegistry.some(e => e.sourceDefId === podId)) {
                // 跳过已内置 POD 支持的修正
                if (entry.handlesPodInternally) {
                    skippedCount++;
                    continue;
                }
                powerModsToAdd.push({ sourceDefId: podId, modifier: entry.modifier });
                mappedCount++;
            }
        }
    }
    
    console.log(`[POD Power Modifier Aliases] 自动映射 ${mappedCount} 个 POD 版本的力量修正，跳过 ${skippedCount} 个已内置 POD 支持的修正`);
}
```

#### 4. 标记已内置 POD 支持的修正函数
```typescript
// dino_armor_stego
registerPowerModifier('dino_armor_stego', (ctx) => {
    const baseId = ctx.minion.defId.replace(/_pod$/, '');
    if (baseId !== 'dino_armor_stego') return 0;
    // ...
}, { handlesPodInternally: true });

// dino_war_raptor
registerPowerModifier('dino_war_raptor', (ctx) => {
    const baseId = ctx.minion.defId.replace(/_pod$/, '');
    if (baseId !== 'dino_war_raptor') return 0;
    // ...
}, { handlesPodInternally: true });

// robot_microbot_alpha
registerPowerModifier('robot_microbot_alpha', (ctx) => {
    const baseId = ctx.minion.defId.replace(/_pod$/, '');
    if (baseId !== 'robot_microbot_alpha') return 0;
    // ...
}, { handlesPodInternally: true });

// steampunk_steam_man
registerPowerModifier('steampunk_steam_man', (ctx) => {
    const baseId = ctx.minion.defId.replace(/_pod$/, '');
    if (baseId !== 'steampunk_steam_man') return 0;
    // ...
}, { handlesPodInternally: true });
```

## 影响范围

修复同时解决了所有使用 `baseId = defId.replace(/_pod$/, '')` 模式的力量修正函数的重复调用问题：

- `dino_armor_stego`（重装剑龙）
- `dino_war_raptor`（战争猛禄龙）
- `robot_microbot_alpha`（微型机阿尔法号）
- `steampunk_steam_man`（蒸汽人）

## 测试覆盖

新增测试用例验证修复：

```typescript
describe('Bug Fix: steampunk_steam_man POD 版本不应该翻倍', () => {
    it('steampunk_steam_man_pod 应该只给 +1 力量，不是 +2', () => {
        const m0 = makeMinion('m0', 'steampunk_steam_man_pod', '0', 3, { powerModifier: 0, powerCounters: 0 });
        const base = {
            defId: 'base_a',
            minions: [m0],
            ongoingActions: [
                { uid: 'action1', defId: 'test_action', ownerId: '0' },
            ],
        };
        const state = makeState({ bases: [base] });
        
        expect(getEffectivePower(state, m0, 0)).toBe(4); // 3 (base) + 1 (action bonus)
    });
    
    it('steampunk_steam_man 基础版本也应该只给 +1 力量', () => {
        const m0 = makeMinion('m0', 'steampunk_steam_man', '0', 3, { powerModifier: 0, powerCounters: 0 });
        const base = {
            defId: 'base_a',
            minions: [m0],
            ongoingActions: [
                { uid: 'action1', defId: 'test_action', ownerId: '0' },
            ],
        };
        const state = makeState({ bases: [base] });
        
        expect(getEffectivePower(state, m0, 0)).toBe(4); // 3 (base) + 1 (action bonus)
    });
});
```

所有测试通过 ✅

## 未来开发指南

新增力量修正时，选择以下两种模式之一：

### 模式 1：默认模式（推荐）
精确匹配 + POD 别名系统

```typescript
registerPowerModifier('my_card', (ctx) => {
    if (ctx.minion.defId !== 'my_card') return 0;
    // ...
});
// POD 版本自动创建
```

**适用场景**：
- POD 版本与基础版行为完全相同
- 不需要在函数内部区分 POD 版本

### 模式 2：内置 POD 支持
仅当有特殊需求时使用

```typescript
registerPowerModifier('my_card', (ctx) => {
    const baseId = ctx.minion.defId.replace(/_pod$/, '');
    if (baseId !== 'my_card') return 0;
    const isPod = ctx.minion.defId.endsWith('_pod');
    // 根据 isPod 做不同处理
}, { handlesPodInternally: true });
```

**适用场景**：
- POD 版本与基础版行为不同（如 `dino_armor_stego_pod` 需要 `talentUsed` 标记）
- 需要统计基础版和 POD 版的总数（如 `dino_war_raptor`）

## 相关文件

- `src/games/smashup/domain/ongoingModifiers.ts` - 力量修正系统核心
- `src/games/smashup/abilities/ongoing_modifiers.ts` - 力量修正注册
- `src/games/smashup/abilities/index.ts` - POD 别名系统调用
- `src/games/smashup/__tests__/steampunk-aggromotive-fix.test.ts` - 测试用例
- `docs/refactor/pod-system-architecture.md` - POD 系统架构文档

## 教训

1. **混用设计模式容易出 bug**：两种模式（内置 POD 支持 vs 外部 POD 别名）混用导致了重复调用问题
2. **显式声明优于隐式行为**：`handlesPodInternally: true` 明确表达设计意图，避免混淆
3. **问题应在源头解决**：在注册层解决问题，而不是在计算层打补丁
4. **测试覆盖很重要**：如果有测试覆盖 POD 版本的力量修正，这个 bug 会更早被发现

## 版本信息

- **修复日期**：2026-03-02
- **影响版本**：v0.5.0 之前的所有版本
- **修复版本**：v0.5.1
- **修复方式**：注册层标记（方案 B）
