# POD 版本能力自动映射重构

## 概述

POD (Print-on-Demand) 版本是大杀四方的最新英文版卡牌。本文档说明**能力层**的自动映射系统。

**重要**：自动映射只适用于**能力注册**（trigger/restriction/protection/ability/interaction），**不适用于数据定义**（卡牌的 power/abilityTags 等字段）。数据定义必须完整定义，不自动继承。详见 `docs/refactor/pod-system-architecture.md`。

## 问题背景

### 原始问题
用户报告"侦察兵在普通基地触发不了"，实际上是 **POD 版本（`alien_scout_pod`）没有注册 afterScoring 触发器**。

### 根本原因
POD 版本的卡牌与基础版本能力相同，但是能力注册需要手动为每个 POD 版本调用一次注册函数：

```typescript
// ❌ 旧方式：需要手动注册每个 POD 版本
registerTrigger('alien_scout', 'afterScoring', alienScoutAfterScoring);
registerTrigger('alien_scout_pod', 'afterScoring', alienScoutAfterScoring); // 容易遗漏

registerAbility('zombie_they_keep_coming', 'onPlay', zombieTheyKeepComing);
registerAbility('zombie_they_keep_coming_pod', 'onPlay', zombieTheyKeepComing); // 重复代码
```

**问题**：
1. **容易遗漏**：新增卡牌时容易忘记注册 POD 版本
2. **重复代码**：每个 POD 版本都要写一行重复的注册代码
3. **维护成本高**：修改基础版本时容易忘记同步 POD 版本

## 解决方案

### 核心思路
1. **基础版本正常注册**：只注册基础版本的能力
2. **POD 版本自动映射**：框架自动创建 `xxx_pod` → `xxx` 的映射
3. **显式覆盖优先**：如果 POD 版本规则不同，显式注册会覆盖自动映射（选择性覆盖）

### 关键特性：选择性覆盖

**自动映射机制完全支持选择性覆盖**：

```typescript
// ✅ 场景 1：POD 版本与基础版本相同（自动映射）
registerTrigger('alien_scout', 'afterScoring', alienScoutAfterScoring);
// alien_scout_pod 会自动映射，无需手动注册

// ✅ 场景 2：POD 版本规则不同（显式覆盖）
registerAbility('dino_laser_triceratops', 'onPlay', dinoLaserTriceratops);
registerAbility('dino_laser_triceratops_pod', 'onPlay', dinoLaserTriceratopsPod);
// 显式注册会覆盖自动映射
```

**工作原理**：
```typescript
// 如果 POD 版本已经注册，跳过（不覆盖显式注册）
const alreadyRegistered = triggerRegistry.some(
    e => e.sourceDefId === podDefId && e.timing === timing
);
if (alreadyRegistered) continue;
```

### 实现

#### 1. 新增 `registerPodOngoingAliases()` 函数

在 `src/games/smashup/domain/ongoingEffects.ts` 中添加：

```typescript
/**
 * 为所有 POD 版本的卡牌批量注册 trigger/restriction/protection 别名
 * 
 * POD 版 defId 格式为"原版defId + _pod"（如 alien_scout_pod）。
 * 此函数遍历已注册表，将符合原始形式的 defId 的所有 trigger/restriction/protection 复制给对应的 _pod 版本。
 * 这样无需为每个 POD 卡单独编写 trigger 代码，就能让其自动继承基础版的全套游戏逻辑。
 * 
 * 必须在所有派系注册完毕后调用此函数。
 */
export function registerPodOngoingAliases(): void {
    // 自动映射 trigger/restriction/protection/baseAbilitySuppression
    // 详见实现代码
}
```

#### 2. 在初始化流程中调用

在 `src/games/smashup/abilities/index.ts` 中：

```typescript
export function initAllAbilities(): void {
    // ... 所有派系注册 ...
    
    // === POD 版本能力别名注册 ===
    registerPodAbilityAliases();        // 已有：映射 registerAbility
    registerPodInteractionAliases();    // 已有：映射交互处理器
    registerPodOngoingAliases();        // 新增：映射 trigger/restriction/protection
    
    initPodStubRegistrations();
}
```

#### 3. 简化派系注册代码

```typescript
// ✅ 新方式：只注册基础版本
export function registerAlienAbilities(): void {
    registerTrigger('alien_scout', 'afterScoring', alienScoutAfterScoring);
    // POD 版本会通过 registerPodOngoingAliases() 自动映射，无需手动注册
}

export function registerZombieAbilities(): void {
    registerAbility('zombie_they_keep_coming', 'onPlay', zombieTheyKeepComing);
    // POD 版本会通过 registerPodAbilityAliases() 自动映射
}
```

### 特殊情况：POD 版本规则不同（选择性覆盖）

如果 POD 版本的规则与基础版本不同，显式注册会覆盖自动映射：

```typescript
export function registerDinosaurAbilities(): void {
    // 基础版本：使用当前力量（包含修正）
    registerAbility('dino_laser_triceratops', 'onPlay', dinoLaserTriceratops);
    
    // POD 版本规则不同：使用印制力量（不含修正）
    // 显式注册会覆盖自动映射
    registerAbility('dino_laser_triceratops_pod', 'onPlay', dinoLaserTriceratopsPod);
}
```

**注册顺序要求**：显式注册必须在 `registerPodOngoingAliases()` 调用之前完成。

```typescript
export function initAllAbilities(): void {
    // 1. 所有派系注册（包括显式的 POD 覆盖）
    registerDinosaurAbilities();  // 包含 dino_laser_triceratops_pod 的显式注册
    
    // 2. 自动映射（会跳过已显式注册的 POD 版本）
    registerPodOngoingAliases();  // ✅ 跳过 dino_laser_triceratops_pod
}
```

## 效果

### 自动映射统计

测试日志显示：
```
[POD Ongoing Aliases] 自动映射 72 个 POD 版本的 trigger/restriction/protection
```

### 代码简化

- **删除重复代码**：不再需要为每个 POD 版本写一行注册代码
- **防止遗漏**：新增卡牌时只需注册基础版本，POD 版本自动映射
- **易于维护**：修改基础版本时，POD 版本自动同步

### 测试验证

创建了 `alien-scout-pod-afterscore.test.ts`，覆盖：
- POD 版本单独触发 ✅
- 基础版本单独触发 ✅
- 两个版本同时存在时的链式处理 ✅

## 相关文件

- `src/games/smashup/domain/ongoingEffects.ts` - 新增 `registerPodOngoingAliases()`
- `src/games/smashup/abilities/index.ts` - 调用自动映射函数
- `src/games/smashup/abilities/aliens.ts` - 简化注册代码（移除手动 POD 注册）
- `src/games/smashup/__tests__/alien-scout-pod-afterscore.test.ts` - 测试验证

## 已有机制

项目中已经有类似的自动映射机制：
- `registerPodAbilityAliases()` - 映射 `registerAbility` (onPlay/talent/special)
- `registerPodInteractionAliases()` - 映射交互处理器

本次重构补充了 `registerTrigger`/`registerRestriction`/`registerProtection` 的自动映射。

## 未来改进

可以考虑进一步优化：
1. **验证工具**：开发时自动检查是否有 POD 卡牌缺失能力注册
2. **类型安全**：通过 TypeScript 类型系统确保 POD 版本与基础版本的一致性
3. **文档生成**：自动生成 POD 版本的能力文档
