# 忍者侍从 - 额度消耗优先级修复

## 问题描述

用户反馈：忍者侍从使用 special 能力打出自己时，消耗的是通用随从额度而不是基地限定额度。

## 根本原因

在 `src/games/smashup/domain/reduce.ts` 的 `MINION_PLAYED` 事件处理中，额度消耗的优先级逻辑有误：

**旧逻辑（错误）**：
1. 同名额度（当全局额度用完时）
2. 基地限定额度（当全局额度和同名额度都用完时）
3. 全局额度（默认）

这导致忍者侍从场景下：
- `minionsPlayed = 0`（全局额度未用完）
- `baseLimitedMinionQuota[0] = 1`（有基地限定额度）
- 由于 `globalFull = false`，所以 `useBaseQuota = false`
- 最终消耗的是全局额度！

## 修复方案

调整额度消耗优先级，让基地限定额度**优先**消耗：

**新逻辑（正确）**：
1. **基地限定额度**（如果该基地有限定额度，优先消耗）
2. **同名额度**（如果全局额度已用完且有同名额度剩余）
3. **全局额度**（默认）

### 代码变更

```typescript
// 额度消耗优先级（从高到低）：
// 1. 基地限定额度（如果该基地有限定额度，优先消耗）
// 2. 同名额度（如果全局额度已用完且有同名额度剩余）
// 3. 全局额度（默认）

// 1. 基地限定额度：如果该基地有限定额度，优先消耗
const baseQuota = player.baseLimitedMinionQuota?.[baseIndex] ?? 0;
const useBaseQuota = shouldIncrementPlayed && baseQuota > 0;

// 2. 同名额度：全局额度已用完且有同名额度剩余时，消耗同名额度
const sameNameRemaining = player.sameNameMinionRemaining ?? 0;
const globalFull = player.minionsPlayed >= player.minionLimit;
const useSameNameQuota = shouldIncrementPlayed && !useBaseQuota && globalFull && sameNameRemaining > 0;

// 应用额度消耗
if (useBaseQuota) {
    // 消耗基地限定额度，不增加全局 minionsPlayed
    newBaseLimitedMinionQuota = {
        ...player.baseLimitedMinionQuota,
        [baseIndex]: baseQuota - 1,
    };
} else if (useSameNameQuota) {
    // 消耗同名额度，不增加全局 minionsPlayed
    newSameNameRemaining = sameNameRemaining - 1;
    if (newSameNameDefId === null || newSameNameDefId === undefined) {
        newSameNameDefId = defId;
    }
} else if (shouldIncrementPlayed) {
    // 消耗全局额度
    finalMinionsPlayed = player.minionsPlayed + 1;
}
```

## 测试验证

运行 `baseFactionOngoing.test.ts`，所有 41 个测试通过：

```
✓ 忍者 ongoing/special 能力 (22)
  ✓ ninja_acolyte: 忍者侍从 special 能力（点击激活） (4)
    ✓ 基地上有侍从时激活返回手牌并给额外随从额度 1ms
  ✓ consumesNormalLimit: 忍者 special 额外打出不消耗正常额度 (5)
    ✓ ninja_acolyte_play 交互产生 LIMIT_MODIFIED 事件授予基地限定额度 2ms
    ✓ 使用基地限定额度时 reducer 不增加 minionsPlayed 0ms
```

## 影响范围

此修复影响所有使用基地限定额度的场景：
- ✅ 忍者侍从 special 能力
- ✅ 未来可能添加的其他基地限定额度机制

## 设计原则

**基地限定额度应该优先消耗**的理由：
1. **语义正确性**：基地限定额度是"额外"的、有限制的额度，应该优先使用
2. **用户期望**：玩家使用忍者侍从 special 能力时，期望消耗的是 special 授予的额度，而不是通用额度
3. **游戏平衡**：如果基地限定额度不优先消耗，玩家可能会"浪费"这个额度（因为通用额度用完后才能用）

## 相关文件

- `src/games/smashup/domain/reduce.ts` - MINION_PLAYED 事件处理
- `src/games/smashup/abilities/ninjas.ts` - 忍者侍从 special 能力
- `src/games/smashup/__tests__/baseFactionOngoing.test.ts` - 测试文件

## 完成时间

2026-03-04
