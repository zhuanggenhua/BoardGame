# 攻击修正徽章 main2 阶段清除修复

## 问题描述

用户反馈：打出攻击修正卡（Volley）后，攻击结束进入第二主要阶段（main2）时，徽章仍然显示，没有清除。

## 根本原因

`useActiveModifiers` Hook 中的阶段变化检测逻辑错误：
- **错误逻辑**：检测离开 `offensiveRoll` 阶段时清空修正卡
- **问题**：攻击结束后的阶段流程是 `offensiveRoll` → `defensiveRoll` → `main2`
- **结果**：离开 `offensiveRoll` 进入 `defensiveRoll` 时会清空，但如果玩家打牌后直接推进阶段（不攻击），则会从 `offensiveRoll` 直接进入 `main2`，此时徽章应该清除但没有清除

## 阶段流程

DiceThrone 的完整阶段流程：
```
upkeep → income → main1 → offensiveRoll → defensiveRoll → main2 → discard
```

攻击修正卡的生命周期：
1. 在 `offensiveRoll` 阶段打出攻击修正卡
2. 攻击结束后，进入 `main2` 阶段
3. 徽章应该在进入 `main2` 阶段时清除

## 修复方案

修改 `useActiveModifiers.ts` 中的阶段变化检测逻辑：
- **修改前**：检测 `from === 'offensiveRoll'`（离开进攻阶段）
- **修改后**：检测 `to === 'main2'`（进入第二主要阶段）

```typescript
// 修改前（错误）
const hasPhaseChangeFromOffensiveRoll = newEntries.some(e => {
    if (e.event.type === 'SYS_PHASE_CHANGED') {
        const payload = e.event.payload as { from?: string; to?: string };
        const isLeavingOffensiveRoll = payload.from === 'offensiveRoll';
        return isLeavingOffensiveRoll;
    }
    return false;
});

// 修改后（正确）
const hasPhaseChangeToMain2 = newEntries.some(e => {
    if (e.event.type === 'SYS_PHASE_CHANGED') {
        const payload = e.event.payload as { from?: string; to?: string };
        const isEnteringMain2 = payload.to === 'main2';
        if (isEnteringMain2) {
            console.log('[useActiveModifiers] 进入 main2 阶段，清空修正卡');
        }
        return isEnteringMain2;
    }
    return false;
});
```

## 为什么这样修复

1. **语义正确**：攻击修正卡的作用范围是"当前攻击"，攻击结束后（进入 main2）应该清除
2. **覆盖所有场景**：
   - 场景 A：正常攻击流程（`offensiveRoll` → `defensiveRoll` → `main2`）✅
   - 场景 B：打牌后不攻击直接推进（`offensiveRoll` → `main2`）✅
3. **与 ATTACK_RESOLVED 事件互补**：
   - `ATTACK_RESOLVED` 事件：攻击完成时清除（场景 A）
   - 进入 `main2` 阶段：兜底清除（场景 B，以及任何其他边缘情况）

## 测试验证

需要测试以下场景：
1. ✅ 打出攻击修正卡 → 攻击 → 攻击结束 → 徽章清除
2. ⏳ 打出攻击修正卡 → 不攻击直接推进阶段 → 徽章清除（本次修复的场景）
3. ✅ 撤回操作后徽章状态正确
4. ✅ 刷新页面后徽章状态正确

## 相关文件

- `src/games/dicethrone/hooks/useActiveModifiers.ts` - 修复阶段变化检测逻辑
- `src/games/dicethrone/domain/core-types.ts` - TurnPhase 定义

## 历史修复

本次修复是攻击修正徽章系列修复的第四次：
1. **首次挂载扫描修复**（`evidence/active-modifier-badge-first-mount-scan-fix.md`）- 修复首次挂载时不扫描历史事件的问题
2. **乐观回滚处理修复**（`evidence/active-modifier-badge-fix-complete.md`）- 修复乐观引擎回滚后状态不同步的问题
3. **ATTACK_RESOLVED 清除修复**（`evidence/active-modifier-badge-fix-complete.md`）- 修复攻击结束时不清除徽章的问题
4. **main2 阶段清除修复**（本次）- 修复不攻击直接推进阶段时徽章不清除的问题

## 下一步

用户需要测试场景 2：打出攻击修正卡后，不攻击直接推进到 main2 阶段，验证徽章是否正确清除。
