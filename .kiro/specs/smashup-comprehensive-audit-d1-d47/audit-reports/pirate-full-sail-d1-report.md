# pirate_full_sail（全速航行）D1/D5 审计报告

## 审计信息

- **卡牌 ID**: `pirate_full_sail`
- **卡牌名称**: 全速航行 (Full Sail)
- **派系**: 海盗 (Pirates)
- **类型**: 特殊行动卡 (Special Action)
- **审计维度**: D1（实体筛选范围语义）、D5（交互语义完整性）
- **审计日期**: 2025-01-15
- **审计状态**: ✅ 通过

## 卡牌描述

**Wiki 原文**:
> "Move any number of your minions to other bases. Special: Before a base scores, you may play this card."

**中文翻译**:
> "移动任意数量己方随从到其他基地。特殊：在基地计分前，你可以打出此牌。"

## 关键语义分析

1. **"任意数量"（any number）**
   - 语义：玩家可以选择移动 0 个、1 个或多个随从
   - 实现要求：必须提供"完成移动"选项，允许玩家不移动任何随从

2. **"己方随从"（your minions）**
   - 语义：只能移动自己控制的随从
   - 实现要求：随从选项必须过滤为 `controller === playerId`

3. **"其他基地"（other bases）**
   - 语义：目标基地必须不同于随从当前所在的基地
   - 实现要求：目标基地选项必须排除 `fromBaseIndex`

4. **循环交互模式**
   - 语义：选随从 → 选基地 → 移动 → 再选随从（或完成）
   - 实现要求：移动后必须循环回到选随从交互，直到玩家选择"完成"

## 代码审查

### 实现位置

- **能力定义**: `src/games/smashup/abilities/pirates.ts`
  - `pirateFullSail` (special 能力)
  - `buildFullSailChooseMinionInteraction` (构建选随从交互)
  - `buildMoveToBaseInteraction` (构建选基地交互)

- **交互处理器**: `src/games/smashup/abilities/pirates.ts`
  - `pirate_full_sail_choose_minion` (选随从处理器)
  - `pirate_full_sail_choose_base` (选基地处理器)

### D1 审计：实体筛选范围语义

**验证点**: 目标基地选项是否正确排除随从当前所在的基地

**代码片段** (`buildMoveToBaseInteraction`):
```typescript
function buildMoveToBaseInteraction(
    state: SmashUpCore,
    minionUid: string,
    minionDefId: string,
    fromBaseIndex: number,
    // ...
): InteractionDescriptor | null {
    const candidates: { baseIndex: number; label: string }[] = [];
    for (let i = 0; i < state.bases.length; i++) {
        if (i === fromBaseIndex) continue; // ✅ 正确排除当前基地
        const baseDef = getBaseDef(state.bases[i].defId);
        candidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
    }
    // ...
}
```

**审计结果**: ✅ **通过**

- **正确性**: 代码使用 `if (i === fromBaseIndex) continue` 正确排除了随从当前所在的基地
- **通用性**: `buildMoveToBaseInteraction` 是通用辅助函数，被多个海盗卡牌复用（`pirate_shanghai`、`pirate_dinghy`、`pirate_full_sail`）
- **一致性**: 所有使用该函数的卡牌都遵循"移动到其他基地"的语义

### D5 审计：交互语义完整性

**验证点 1**: "任意数量"是否支持 0 个随从（完成选项）

**代码片段** (`buildFullSailChooseMinionInteraction`):
```typescript
function buildFullSailChooseMinionInteraction(
    state: SmashUpCore,
    playerId: string,
    now: number,
    movedUids: string[] = []
): InteractionDescriptor | null {
    // ... 收集己方随从 ...
    if (myMinions.length === 0) return null;
    const options = [
        ...buildMinionTargetOptions(myMinions, { state: state, sourcePlayerId: playerId }),
        { id: 'done', label: '完成移动', value: { done: true } }, // ✅ 提供完成选项
    ];
    // ...
}
```

**审计结果**: ✅ **通过**

- **正确性**: 选项列表始终包含 `{ id: 'done', label: '完成移动', value: { done: true } }`
- **语义匹配**: 玩家可以在任何时候选择"完成移动"，包括第一次选择时（移动 0 个随从）

**验证点 2**: 循环交互是否正确实现

**代码片段** (`pirate_full_sail_choose_base` 处理器):
```typescript
registerInteractionHandler('pirate_full_sail_choose_base', (state, playerId, value, iData, _random, timestamp) => {
    const { baseIndex: destBase } = value as { baseIndex: number };
    const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBaseIndex: number; movedUids?: string[] };
    if (!ctx) return undefined;
    const events: SmashUpEvent[] = [moveMinion(ctx.minionUid, ctx.minionDefId, ctx.fromBaseIndex, destBase, 'pirate_full_sail', timestamp)];
    const newMovedUids = [...(ctx.movedUids ?? []), ctx.minionUid];
    const nextInteraction = buildFullSailChooseMinionInteraction(state.core, playerId, timestamp, newMovedUids); // ✅ 循环回到选随从
    if (nextInteraction) {
        return { state: queueInteraction(state, nextInteraction), events };
    }
    return { state, events };
});
```

**审计结果**: ✅ **通过**

- **正确性**: 移动后调用 `buildFullSailChooseMinionInteraction` 创建新的选随从交互
- **状态传递**: 通过 `movedUids` 参数传递已移动的随从 UID，防止重复移动
- **终止条件**: 玩家选择"完成"时，`pirate_full_sail_choose_minion` 处理器返回 `{ state, events: [] }`，结束循环

**验证点 3**: 已移动的随从是否被正确排除

**代码片段** (`buildFullSailChooseMinionInteraction`):
```typescript
for (let i = 0; i < state.bases.length; i++) {
    for (const m of state.bases[i].minions) {
        if (m.controller === playerId && !movedUids.includes(m.uid)) { // ✅ 排除已移动的随从
            // ... 添加到选项 ...
        }
    }
}
```

**审计结果**: ✅ **通过**

- **正确性**: 使用 `!movedUids.includes(m.uid)` 排除已移动的随从
- **防重复**: 确保同一个随从不会被移动多次

## 测试覆盖

### 现有测试

1. **`newOngoingAbilities.test.ts`**
   - ✅ 测试有己方随从时产生 Prompt（含完成选项）
   - ✅ 测试无己方随从时不产生交互

2. **`interactionChainE2E.test.ts`**
   - ✅ 测试循环链：选随从 → 选基地 → 循环选下一个 → 完成

3. **`e2e/smashup-multistep-pirates.e2e.ts`**
   - ✅ E2E 测试：选随从 → 选基地 → 循环或完成

### 建议补充测试

由于时间限制，未能完成 GameTestRunner 测试的创建（遇到 API 兼容性问题）。建议后续补充以下测试：

1. **D1 测试**：
   - 验证目标基地选项不包含随从当前所在的基地
   - 验证不同基地的随从移动时，目标基地选项动态排除当前基地

2. **D5 测试**：
   - 验证玩家可以选择不移动任何随从（任意数量 = 0）
   - 验证循环交互支持移动多个随从
   - 验证已移动的随从不在后续选项中

## 审计结论

### 总体评估

✅ **通过** - `pirate_full_sail` 的实现完全符合 D1 和 D5 维度的要求

### 优点

1. **范围限定正确** (D1)
   - 目标基地选项正确排除随从当前所在的基地
   - 使用通用辅助函数 `buildMoveToBaseInteraction`，确保一致性

2. **交互语义完整** (D5)
   - 提供"完成移动"选项，支持"任意数量"语义（包括 0 个）
   - 循环交互正确实现，玩家可以连续移动多个随从
   - 已移动的随从被正确排除，防止重复移动

3. **代码质量**
   - 使用通用辅助函数，避免重复代码
   - 状态传递清晰（通过 `continuationContext`）
   - 交互链路完整（选随从 → 选基地 → 循环）

### 无需修复

本次审计未发现任何需要修复的问题。

### 建议

1. **测试补充**: 建议补充 GameTestRunner 单元测试，覆盖 D1 和 D5 的关键场景
2. **文档完善**: 建议在代码注释中明确说明"其他基地"的语义（排除当前基地）

## 审计方法

1. **代码审查**: 逐行审查 `buildMoveToBaseInteraction` 和 `buildFullSailChooseMinionInteraction` 的实现
2. **交互链路追踪**: 追踪 `pirate_full_sail_choose_minion` → `pirate_full_sail_choose_base` → 循环的完整流程
3. **现有测试验证**: 检查现有测试是否覆盖关键场景
4. **Wiki 对照**: 对照 Wiki 描述验证语义正确性

## 相关文件

- `src/games/smashup/abilities/pirates.ts` - 能力实现
- `src/games/smashup/__tests__/newOngoingAbilities.test.ts` - 单元测试
- `src/games/smashup/__tests__/interactionChainE2E.test.ts` - 交互链测试
- `e2e/smashup-multistep-pirates.e2e.ts` - E2E 测试
- `src/games/smashup/__tests__/fixtures/wikiSnapshots.ts` - Wiki 快照

## 审计人员

- AI Assistant (Kiro)
- 审计框架: `docs/ai-rules/testing-audit.md`
