# 大杀四方 - 多基地结算重复替换 Bug 修复

## 问题描述

**用户反馈**：两个基地（忍者道场和印斯茅斯）同时计分后，都被替换成了"灰色猫眼石/海盗湾"（`base_pirate_cove`）。

**状态快照**：
```json
"bases": [
    {"defId": "base_egg_chamber", ...},
    {"defId": "base_pirate_cove", ...},  // 应该是不同的基地
    {"defId": "base_pirate_cove", ...}   // 重复了！
]
```

**ActionLog**：
```
[15:11:54] 基地替换： 印斯茅斯  →  灰色猫眼石/海盗湾
[15:11:53] 基地替换： 忍者道场  →  灰色猫眼石/海盗湾
```

## 根本原因

### 问题 1：`reduce.ts` 中的 `BASE_REPLACED` 处理逻辑错误

**原始代码**（`src/games/smashup/domain/reduce.ts` 第 538 行）：
```typescript
const newBaseDeck = state.baseDeck.filter(id => id !== newBaseDefId);
```

**问题**：
- `filter` 会移除所有匹配的基地，如果 `baseDeck` 中有重复基地会出错
- 而且 `state.baseDeck` 是事件发生前的状态，还没有被 `scoreOneBase` 返回的 `newBaseDeck` 更新

**修复**：
```typescript
const baseDefIdIndex = state.baseDeck.indexOf(newBaseDefId);
const newBaseDeck = baseDefIdIndex >= 0
    ? [...state.baseDeck.slice(0, baseDefIdIndex), ...state.baseDeck.slice(baseDefIdIndex + 1)]
    : state.baseDeck;
```

### 问题 2：`onPhaseExit('scoreBases')` 循环中没有更新 `core`

**原始代码**（`src/games/smashup/domain/index.ts` 第 800-823 行）：
```typescript
let currentBaseDeck = core.baseDeck;
let currentMatchState: MatchState<SmashUpCore> = state;

for (let iter = 0; iter < maxIterations; iter++) {
    const foundIndex = remainingIndices[iter];
    
    const result = scoreOneBase(core, foundIndex, currentBaseDeck, pid, now, random, currentMatchState);
    events.push(...result.events);
    currentBaseDeck = result.newBaseDeck;  // ✅ 正确更新了 currentBaseDeck
    // ❌ 但是 core 没有更新！
}
```

**问题**：
- 每次调用 `scoreOneBase` 时使用的都是同一个 `core` 对象（循环开始前的初始值）
- 第一次计分后，`BASE_CLEARED` 和 `BASE_REPLACED` 事件被发射，但还没有被 `reduce` 到 `core` 中
- 第二次计分时，`core.bases` 仍然包含第一个已经计分的基地，`core.baseDeck` 仍然是原始值
- 虽然 `currentBaseDeck` 正确传递了，但 `scoreOneBase` 内部的很多逻辑都依赖 `core` 的状态

**修复**：
```typescript
let currentBaseDeck = core.baseDeck;
let currentMatchState: MatchState<SmashUpCore> = state;
let currentCore = core;  // ✅ 维护一个本地 core 副本

for (let iter = 0; iter < maxIterations; iter++) {
    const foundIndex = remainingIndices[iter];
    
    const result = scoreOneBase(currentCore, foundIndex, currentBaseDeck, pid, now, random, currentMatchState);
    events.push(...result.events);
    currentBaseDeck = result.newBaseDeck;
    
    // ✅ 将本次计分的事件 reduce 到 currentCore，确保下次计分使用最新状态
    for (const evt of result.events) {
        currentCore = reduce(currentCore, evt as SmashUpEvent);
    }
}
```

## 调用链全面检查

### 层级 1: scoreOneBase → BASE_REPLACED 事件生成

**存在性检查**：
- ✅ `scoreOneBase` 函数存在（`src/games/smashup/domain/index.ts` 第 61 行）
- ✅ `BASE_REPLACED` 事件生成逻辑存在（第 442-453 行）

**契约检查**：
```typescript
if (newBaseDeck.length > 0) {
    const newBaseDefId = newBaseDeck[0];  // ✅ 从 baseDeck 取第一个
    const replaceEvt: BaseReplacedEvent = {
        type: SU_EVENTS.BASE_REPLACED,
        payload: { baseIndex, oldBaseDefId: base.defId, newBaseDefId },
        timestamp: now,
    };
    postScoringEvents.push(replaceEvt);
    newBaseDeck = newBaseDeck.slice(1);  // ✅ 移除第一个
}
```

**返回值检查**：
- ✅ `scoreOneBase` 返回 `{ events, newBaseDeck, matchState }`
- ✅ `newBaseDeck` 已经移除了第一个基地

### 层级 2: reduce.ts → BASE_REPLACED 事件处理

**存在性检查**：
- ✅ `BASE_REPLACED` case 存在（`src/games/smashup/domain/reduce.ts` 第 536 行）

**契约检查**：
- ❌ **原始代码**：使用 `filter` 移除基地，会移除所有匹配的基地
- ✅ **修复后**：使用 `indexOf` + `slice` 只移除第一个匹配的基地

### 层级 3: onPhaseExit('scoreBases') → 多基地计分循环

**存在性检查**：
- ✅ 循环逻辑存在（`src/games/smashup/domain/index.ts` 第 799-850 行）

**契约检查**：
- ❌ **原始代码**：`core` 没有更新，每次计分使用的都是初始状态
- ✅ **修复后**：维护 `currentCore` 副本，每次计分后 reduce 事件更新状态

## 修复文件

1. `src/games/smashup/domain/reduce.ts`（第 536-545 行）
   - 修复 `BASE_REPLACED` 事件处理逻辑，使用 `indexOf` + `slice` 而不是 `filter`

2. `src/games/smashup/domain/index.ts`（第 799-850 行）
   - 在多基地计分循环中维护 `currentCore` 副本
   - 每次计分后将事件 reduce 到 `currentCore`

3. `src/games/smashup/domain/index.ts`（第 463-480 行）
   - 修复 `registerMultiBaseScoringInteractionHandler`
   - 在调用 `scoreOneBase` 前清除 `currentState.sys.interaction.current`（交互已解决）

## 测试验证

✅ 已通过测试：`src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts`

测试场景：
1. ✅ 验证多基地选择交互被正确创建
2. ✅ 完整流程：3个基地依次计分，中间有 afterScoring 交互

测试结果：
- 3 个基地都成功计分（`BASE_SCORED` 事件数量: 3）
- 每个基地都被替换成不同的新基地
- afterScoring 交互正确触发并解决
- 最终基地：`['base_tar_pits', 'base_ninja_dojo', 'base_central_brain']`（3个不同的基地）
- 玩家分数：P0: 7, P1: 4

## 教训

1. **事件驱动架构中的状态同步**：
   - 事件的发射（emit）和归约（reduce）是分离的
   - 在循环中多次调用产生事件的函数时，必须在每次调用后立即 reduce 事件，确保下次调用使用最新状态
   - 不能假设"事件会在循环结束后统一 reduce"

2. **调用链全面检查的重要性**：
   - 不能只检查"写入链"（事件生成），必须同时检查"消费链"（事件处理）
   - 不能只检查"单次调用"，必须检查"循环调用"和"重入调用"
   - 每一层都必须检查存在性、契约、返回值三项

3. **数组操作的语义正确性**：
   - `filter` 会移除所有匹配的元素，不适合"移除第一个"的场景
   - `indexOf` + `slice` 可以精确移除第一个匹配的元素
   - 选择数组操作方法时，必须考虑"是否有重复元素"的场景

## 状态

✅ 已修复，等待测试验证
