# Bug: 侧翼开炮不能选择自己

## 状态：✅ 已修复

## 问题描述

侧翼开炮（Broadside）卡牌的描述是"消灭一个玩家的所有力量为2或以下的随从"（Destroy all of one player's minions），但实际实现中只能选择对手，不能选择自己。

## 卡牌信息

- **中文名**：侧翼开炮（图片上显示为"圆翼开炮"）
- **英文名**：Broadside
- **派系**：Pirates（海盗）
- **类型**：行动卡
- **效果**：消灭一个你拥有一个随从的基地里的一个玩家的所有力量为2或以下的随从。
- **英文原文**：Destroy all of one player's minions of power 2 or less at a base where you have a minion.

## 预期行为

根据卡牌描述"一个玩家"（one player），应该可以选择任何玩家，包括：
- 自己（可能用于清理自己的弱随从来触发某些效果）
- 任何对手

## 实际行为

只能选择对手，不能选择自己。

## 根因分析

### 问题代码（修复前）

`src/games/smashup/abilities/pirates.ts` 中的 `pirateBroadside` 函数：

```typescript
function pirateBroadside(ctx: AbilityContext): AbilityResult {
    // 收集所有可能的 (基地, 对手) 组合
    const candidates: { baseIndex: number; opponentId: string; count: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        if (!base.minions.some(m => m.controller === ctx.playerId)) continue;
        const opponentCounts = new Map<string, number>();
        for (const m of base.minions) {
            if (m.controller !== ctx.playerId && getMinionPower(ctx.state, m, i) <= 2) {
                opponentCounts.set(m.controller, (opponentCounts.get(m.controller) || 0) + 1);
            }
        }
        // ...
    }
}
```

### 问题分析

1. **过滤逻辑错误**：`m.controller !== ctx.playerId` 排除了自己的随从
2. **变量命名误导**：使用 `opponentCounts` 和 `opponentId` 暗示只能选择对手
3. **与卡牌描述不符**：卡牌描述明确说"一个玩家"，应该包括所有玩家

## 修复方案

### 修复内容

1. **移除过滤逻辑**：允许统计所有玩家（包括自己）的弱随从
2. **更新变量命名**：从 `opponentId` 改为 `targetPlayerId`
3. **添加自己的标签**：当选项是自己时，显示"你自己"
4. **更新交互标题**：从"选择基地和对手"改为"选择基地和玩家"

### 修复代码

```typescript
function pirateBroadside(ctx: AbilityContext): AbilityResult {
    // 收集所有可能的 (基地, 玩家) 组合
    const candidates: { baseIndex: number; targetPlayerId: string; count: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        // 必须有己方随从
        if (!base.minions.some(m => m.controller === ctx.playerId)) continue;
        
        // 统计每个玩家（包括自己）在该基地的弱随从数量
        const playerCounts = new Map<string, number>();
        for (const m of base.minions) {
            if (getMinionPower(ctx.state, m, i) <= 2) {
                playerCounts.set(m.controller, (playerCounts.get(m.controller) || 0) + 1);
            }
        }
        
        const baseDef = getBaseDef(base.defId);
        const baseName = baseDef?.name ?? `基地 ${i + 1}`;
        for (const [pid, count] of playerCounts) {
            const playerLabel = pid === ctx.playerId ? '你自己' : getOpponentLabel(pid);
            candidates.push({ 
                baseIndex: i, 
                targetPlayerId: pid, 
                count, 
                label: `${baseName}（${playerLabel}，${count}个弱随从）` 
            });
        }
    }
    
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    
    const options = candidates.map((c, i) => ({ 
        id: `target-${i}`, 
        label: c.label, 
        value: { baseIndex: c.baseIndex, targetPlayerId: c.targetPlayerId } 
    }));
    const interaction = createSimpleChoice(
        `pirate_broadside_${ctx.now}`, ctx.playerId,
        '选择基地和玩家，消灭该玩家所有力量≤2的随从', options, 'pirate_broadside',
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}
```

### 交互处理器修复

```typescript
registerInteractionHandler('pirate_broadside', (state, playerId, value, _iData, _random, timestamp) => {
    const { baseIndex, targetPlayerId } = value as { baseIndex: number; targetPlayerId: string };
    const base = state.core.bases[baseIndex];
    if (!base) return undefined;
    const events: SmashUpEvent[] = [];
    for (const m of base.minions) {
        if (m.controller === targetPlayerId && getMinionPower(state.core, m, baseIndex) <= 2) {
            events.push(destroyMinion(m.uid, m.defId, baseIndex, m.owner, playerId, 'pirate_broadside', timestamp));
        }
    }
    return { state, events };
});
```

### 修复要点

1. **移除 `m.controller !== ctx.playerId` 过滤**：现在统计所有玩家的弱随从
2. **变量重命名**：`opponentId` → `targetPlayerId`，`opponentCounts` → `playerCounts`
3. **标签区分**：`pid === ctx.playerId ? '你自己' : getOpponentLabel(pid)`
4. **标题更新**：从"选择基地和对手"改为"选择基地和玩家"

## 影响范围

- 所有使用侧翼开炮的对局
- 可能影响游戏策略（现在可以选择自己来清理弱随从）

## 测试验证

### 单元测试

创建了 `src/games/smashup/__tests__/pirate-broadside-self-target.test.ts`：

1. ✅ 验证选项中包含自己（当自己有弱随从时）
2. ✅ 验证可以选择自己并消灭自己的弱随从
3. ✅ 验证可以选择对手并消灭对手的弱随从
4. ✅ 验证没有己方随从的基地不会出现在选项中

### 手动测试步骤

1. 在有己方随从的基地上打出侧翼开炮
2. 验证选项中包含"你自己"和所有对手
3. 选择"你自己"，验证自己的弱随从（力量≤2）被消灭
4. 选择对手，验证对手的弱随从被消灭

## 相关文件

- ✅ `src/games/smashup/abilities/pirates.ts` - 侧翼开炮能力定义（已修复）
- ✅ `src/games/smashup/__tests__/pirate-broadside-self-target.test.ts` - 新增测试
- ✅ `docs/bugs/smashup-pirate-broadside-self-target.md` - Bug 文档

## 总结

修复了侧翼开炮只能选择对手的问题。现在可以选择任何玩家（包括自己），与卡牌描述"消灭一个玩家的所有力量为2或以下的随从"保持一致。
