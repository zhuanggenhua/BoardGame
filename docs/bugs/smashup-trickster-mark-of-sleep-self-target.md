# Bug: 睡眠印记不能选择自己

## 状态：✅ 已修复

## 问题描述

睡眠印记（Mark of Sleep）卡牌的描述是"选择一个玩家，该玩家不能在他的下个回合中打出战术"（Choose a player），但实际实现中只能选择对手，不能选择自己。

## 卡牌信息

- **中文名**：睡眠印记
- **英文名**：Mark of Sleep
- **派系**：Tricksters（戏谑妖精）
- **类型**：行动卡
- **效果**：选择一个玩家，该玩家不能在他的下个回合中打出战术。

## 预期行为

根据卡牌描述"选择一个玩家"（Choose a player），应该可以选择任何玩家，包括：
- 自己（可能用于配合某些策略）
- 任何对手

## 实际行为

只能选择对手，不能选择自己。

## 根因分析

### 问题代码（修复前）

`src/games/smashup/abilities/tricksters.ts` 中的 `tricksterMarkOfSleep` 函数：

```typescript
function tricksterMarkOfSleep(ctx: AbilityContext): AbilityResult {
    const opponents = ctx.state.turnOrder.filter(pid => pid !== ctx.playerId);
    if (opponents.length === 0) return { events: [] };
    const options = opponents.map((pid, i) => ({
        id: `opp-${i}`, label: getOpponentLabel(pid), value: { pid },
    }));
    const interaction = createSimpleChoice(
        `trickster_mark_of_sleep_${ctx.now}`, ctx.playerId,
        '选择一个对手（其下回合不能打行动卡）', options as any[],
        { sourceId: 'trickster_mark_of_sleep', autoCancelOption: true },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}
```

### 问题分析

1. **过滤逻辑错误**：`opponents = turnOrder.filter(pid => pid !== playerId)` 排除了自己
2. **标题文本错误**：交互标题写的是"选择一个对手"，而不是"选择一个玩家"
3. **与卡牌描述不符**：卡牌描述明确说"选择一个玩家"，应该包括所有玩家

## 修复方案

### 修复内容

1. **移除过滤逻辑**：允许选择所有玩家（包括自己）
2. **更新标题文本**：改为"选择一个玩家"
3. **添加自己的标签**：当选项是自己时，显示"你自己"

### 修复代码

```typescript
function tricksterMarkOfSleep(ctx: AbilityContext): AbilityResult {
    // 可以选择任何玩家（包括自己）
    const allPlayers = ctx.state.turnOrder;
    const options = allPlayers.map((pid, i) => ({
        id: `player-${i}`, 
        label: pid === ctx.playerId ? '你自己' : getOpponentLabel(pid), 
        value: { pid },
    }));
    const interaction = createSimpleChoice(
        `trickster_mark_of_sleep_${ctx.now}`, ctx.playerId,
        '选择一个玩家（其下回合不能打行动卡）', options as any[],
        { sourceId: 'trickster_mark_of_sleep', autoCancelOption: true },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}
```

### 修复要点

1. **`allPlayers = ctx.state.turnOrder`**：不再过滤，包含所有玩家
2. **`label: pid === ctx.playerId ? '你自己' : getOpponentLabel(pid)`**：自己显示为"你自己"
3. **标题更新**：从"选择一个对手"改为"选择一个玩家"

## 影响范围

- 所有使用睡眠印记的对局
- 可能影响游戏策略（现在可以选择自己来配合某些组合技）

## 测试验证

### 单元测试

创建了 `src/games/smashup/__tests__/trickster-mark-of-sleep-self-target.test.ts`：

1. ✅ 验证选项中包含自己
2. ✅ 验证选项中包含对手
3. ✅ 验证可以选择自己
4. ✅ 验证可以选择对手

### 手动测试步骤

1. 打出睡眠印记
2. 验证选项中包含"你自己"和所有对手
3. 选择"你自己"，验证下回合自己不能打行动卡
4. 选择对手，验证对手下回合不能打行动卡

## 相关文件

- ✅ `src/games/smashup/abilities/tricksters.ts` - 睡眠印记能力定义（已修复）
- ✅ `src/games/smashup/__tests__/trickster-mark-of-sleep-self-target.test.ts` - 新增测试
- ✅ `docs/bugs/smashup-trickster-mark-of-sleep-self-target.md` - Bug 文档

## 总结

修复了睡眠印记只能选择对手的问题。现在可以选择任何玩家（包括自己），与卡牌描述"选择一个玩家"保持一致。
