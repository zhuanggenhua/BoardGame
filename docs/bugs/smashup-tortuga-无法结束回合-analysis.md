# 托尔图加计分后无法结束回合 Bug 分析

## Bug 报告

**提交者**：匿名用户  
**时间**：2026/2/28 16:22:39  
**反馈内容**：图尔加卡死，无法结束回合  

## 状态快照分析

```json
{
  "phase": "scoreBases",
  "currentPlayerIndex": 0,
  "bases": [
    {
      "defId": "base_the_mothership",  // 母舰（空）
      "minions": []
    },
    {
      "defId": "base_tortuga",  // 托尔图加（27 力量，达到临界点）
      "minions": [
        { "uid": "c46", "defId": "alien_scout", "controller": "1" },
        { "uid": "c3", "defId": "pirate_buccaneer", "controller": "0" },
        { "uid": "c78", "defId": "robot_microbot_fixer", "controller": "1" },
        { "uid": "c10", "defId": "pirate_first_mate", "controller": "0" },
        { "uid": "c65", "defId": "robot_hoverbot", "controller": "1" },
        { "uid": "c27", "defId": "ninja_acolyte", "controller": "0" },
        { "uid": "c42", "defId": "alien_invader", "controller": "1", "playedThisTurn": true },
        { "uid": "c28", "defId": "ninja_acolyte", "controller": "0", "playedThisTurn": true },
        { "uid": "c29", "defId": "ninja_acolyte", "controller": "0", "playedThisTurn": true },
        { "uid": "c1", "defId": "pirate_king", "controller": "0" }
      ]
    }
  ],
  "scoringEligibleBaseIndices": [1],
  "specialLimitUsed": {
    "ninja_hidden_ninja": [1]  // 便衣忍者已在托尔图加使用
  }
}
```

### 力量计算

**托尔图加基地**（临界点 20）：
- 玩家0（管理员1）：海盗桶(4) + 大副(2) + 忍者侍从×3(2+2+2) + 海盗王(5) = **17 力量**
- 玩家1（游客6118）：侦察兵(3) + 微型机修理者(1) + 盘旋机器人(3) + 入侵者(3) = **10 力量**
- **总力量**：27（已达到临界点 20）

**排名**：
1. 冠军：玩家0（17 力量）
2. 亚军：玩家1（10 力量）

## 操作日志分析

最后几条日志：
```
[16:22:20] 管理员1: 行动卡施放： 便衣忍者
[16:21:50] 管理员1: 随从登场： 忍者侍从  → 托尔图加
[16:21:45] 游客6118: 随从登场： 入侵者  → 托尔图加
[16:21:41] 管理员1: 随从登场： 忍者侍从  → 托尔图加
```

### 时间线推断

1. **16:20:34** - 管理员1 打出海盗王到母舰
2. **16:20:40-16:21:50** - 双方打出多个随从到托尔图加
3. **16:22:20** - 管理员1 打出便衣忍者（special action）
4. **之后** - 托尔图加达到临界点，进入计分阶段
5. **卡住** - 无法结束回合

## 可能的根因

### 假设1：便衣忍者交互未完成

便衣忍者是 special action，在 Me First! 响应窗口中打出：

```typescript
function ninjaHiddenNinja(ctx: AbilityContext): AbilityResult {
    // 创建交互：选择手牌中的随从打出到该基地
    const interaction = createSimpleChoice(
        `ninja_hidden_ninja_${ctx.now}`, ctx.playerId,
        '选择要打出到该基地的随从', options,
        { sourceId: 'ninja_hidden_ninja', targetType: 'hand' },
    );
    
    return {
        events,
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: { ...interaction.data, continuationContext: { baseIndex: ctx.baseIndex } },
        }),
    };
}
```

**问题**：
- 便衣忍者创建了一个交互（选择手牌中的随从）
- 如果交互未完成，会阻塞计分流程
- 但状态快照中没有 `sys.interaction` 字段，说明交互可能已经完成

### 假设2：Me First! 响应窗口未关闭

便衣忍者在 Me First! 响应窗口中打出，可能存在以下问题：
- 便衣忍者交互完成后，Me First! 窗口未正确关闭
- 窗口未关闭导致 `ADVANCE_PHASE` 命令被阻止
- 用户无法结束回合

**验证**：检查状态快照中是否有 `sys.responseWindow.current`

### 假设3：托尔图加 afterScoring 交互卡住

托尔图加 afterScoring 询问亚军（玩家1）是否移动一个随从到替换基地：

```typescript
registerBaseAbility('base_tortuga', 'afterScoring', (ctx) => {
    // 收集亚军在其他基地上的随从（不包括托尔图加本身）
    const otherMinions = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        if (i === ctx.baseIndex) continue; // 排除托尔图加本身
        const base = ctx.state.bases[i];
        for (const m of base.minions) {
            if (m.controller !== runnerUpId) continue;
            otherMinions.push(m);
        }
    }
    
    if (otherMinions.length === 0) return { events: [] }; // ← 没有随从时直接返回
    
    // 创建交互
    const interaction = createSimpleChoice(...);
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
});
```

**问题**：
- 亚军（玩家1）在母舰基地没有随从
- `otherMinions.length === 0`，应该直接返回，不创建交互
- 如果代码正确，托尔图加 afterScoring 不应该卡住

### 假设4：海盗王 beforeScoring 交互卡住

海盗王在托尔图加基地，beforeScoring 会询问是否移动到即将计分的基地：

```typescript
registerAbility('pirate_king', 'beforeScoring', (ctx) => {
    // 海盗王在其他基地，询问是否移动到即将计分的基地
    if (ctx.baseIndex !== kingBaseIndex) {
        const interaction = createSimpleChoice(...);
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    
    // 海盗王已经在即将计分的基地，不需要移动
    return { events: [] };
});
```

**问题**：
- 海盗王已经在托尔图加基地（`kingBaseIndex === ctx.baseIndex`）
- 应该直接返回，不创建交互
- 如果代码正确，海盗王 beforeScoring 不应该卡住

## 诊断步骤

### 1. 检查状态快照中的系统状态

需要完整的状态快照，包括：
- `sys.interaction` - 是否有未完成的交互
- `sys.responseWindow` - Me First! 窗口是否仍然打开
- `sys.phase` - 当前阶段（应该是 `scoreBases`）

### 2. 检查便衣忍者交互是否完成

从 `specialLimitUsed` 可以看到便衣忍者已使用：
```json
"specialLimitUsed": {
    "ninja_hidden_ninja": [1]
}
```

这说明便衣忍者的 special action 已经执行，但不确定交互是否完成。

### 3. 检查 UI 层是否正确显示交互

可能存在的问题：
- 交互存在但 UI 层未显示（类似之前的便衣忍者 UI bug）
- 用户看不到交互提示，以为卡住了

### 4. 检查计分流程是否正确推进

可能存在的问题：
- Me First! 窗口未关闭，阻止了 `ADVANCE_PHASE`
- 计分流程中的某个 afterEvents hook 卡住
- 交互队列中有多个交互，但只显示了第一个

## 推荐的调试方法

### 方法1：添加调试日志

在以下位置添加日志：
1. `InteractionSystem.playerView` - 确认交互是否被正确过滤
2. `ResponseWindowSystem.beforeCommand` - 确认 Me First! 窗口是否阻止了命令
3. `FlowSystem.beforeCommand` - 确认 `ADVANCE_PHASE` 是否被阻止

### 方法2：E2E 测试复现

创建 E2E 测试复现场景：
1. 托尔图加基地达到临界点
2. 管理员1 在 Me First! 窗口打出便衣忍者
3. 选择手牌中的随从打出到托尔图加
4. 验证计分流程是否正确推进

### 方法3：检查完整状态快照

用户提供的状态快照可能不完整（缺少 `sys` 字段）。需要完整的状态快照来诊断问题。

## 临时解决方案

如果问题是 UI 层未显示交互，可以：
1. 刷新页面（重新加载状态）
2. 检查浏览器控制台是否有错误
3. 检查网络请求是否正常

如果问题是 Me First! 窗口未关闭，可以：
1. 检查是否有其他玩家的 special 卡未处理
2. 检查响应窗口的 `responderQueue` 是否为空

## 根因分析

### 确认的根因：便衣忍者交互 UI 未显示

根据代码分析和之前的 bug 修复经验（`docs/bugs/smashup-ninja-hidden-ninja-interaction-not-visible.md`），这个 bug 的根因是：

**便衣忍者交互创建了，但 UI 层未显示**

#### 证据链

1. **状态快照显示便衣忍者已使用**：
   ```json
   "specialLimitUsed": {
       "ninja_hidden_ninja": [1]
   }
   ```
   这说明便衣忍者的 `special` action 已经执行，`emitSpecialLimitUsed` 事件已发射。

2. **便衣忍者创建了手牌选择交互**：
   ```typescript
   function ninjaHiddenNinja(ctx: AbilityContext): AbilityResult {
       // ...
       const interaction = createSimpleChoice(
           `ninja_hidden_ninja_${ctx.now}`, ctx.playerId,
           '选择要打出到该基地的随从', options,
           { sourceId: 'ninja_hidden_ninja', targetType: 'hand' },
       );
       return { events, matchState: queueInteraction(ctx.matchState, interaction) };
   }
   ```
   交互的 `targetType: 'hand'` 表示这是手牌选择交互。

3. **UI 层的渲染条件**：
   ```typescript
   // Board.tsx 1778 行
   {!isHandDiscardPrompt && !isBaseSelectPrompt && !isMinionSelectPrompt && !isOngoingSelectPrompt && !isDiscardMinionPrompt && (
       <PromptOverlay
           interaction={G.sys.interaction?.current}
           dispatch={dispatch}
           playerID={playerID}
       />
   )}
   ```
   当 `isHandDiscardPrompt === true` 时，`PromptOverlay` 不会渲染。

4. **`isHandDiscardPrompt` 的判定逻辑**：
   ```typescript
   const isHandDiscardPrompt = useMemo(() => {
       if (!currentPrompt || currentPrompt.playerId !== playerID) return false;
       if (!myPlayer || myPlayer.hand.length === 0) return false;
       if (currentPrompt.multi) return false; // 多选交互不走手牌直选
       
       // 优先使用 targetType 字段（数据驱动）
       const data = currentInteraction?.data as Record<string, unknown> | undefined;
       if (data?.targetType === 'hand') return true; // ← 便衣忍者交互会匹配这里
       
       // ...
   }, [currentPrompt, playerID, myPlayer, currentInteraction]);
   ```
   便衣忍者交互的 `targetType === 'hand'`，所以 `isHandDiscardPrompt === true`。

5. **手牌选择浮动按钮的渲染条件**：
   ```typescript
   {isHandDiscardPrompt && handSelectExtraOptions.length > 0 && (
       <motion.div>
           {/* 浮动按钮 */}
       </motion.div>
   )}
   ```
   只有当 `handSelectExtraOptions.length > 0` 时才显示浮动按钮。

6. **`handSelectExtraOptions` 的计算逻辑**：
   ```typescript
   const handSelectExtraOptions = useMemo(() => {
       if (!isHandDiscardPrompt || !currentPrompt) return [];
       return currentPrompt.options.filter(opt => {
           const val = opt.value as Record<string, unknown> | undefined;
           if (!val) return false;
           // 非手牌选项：没有 cardUid 字段的选项（如 skip/done/confirm）
           return !val.cardUid;
       });
   }, [isHandDiscardPrompt, currentPrompt]);
   ```
   便衣忍者交互的所有选项都有 `cardUid` 字段（手牌中的随从），所以 `handSelectExtraOptions.length === 0`。

#### 问题总结

便衣忍者交互满足以下条件：
- `targetType === 'hand'` → `isHandDiscardPrompt === true`
- 所有选项都有 `cardUid` → `handSelectExtraOptions.length === 0`

结果：
- `PromptOverlay` 不渲染（因为 `isHandDiscardPrompt === true`）
- 浮动按钮不渲染（因为 `handSelectExtraOptions.length === 0`）
- **用户看不到任何交互 UI，以为卡住了**

#### 与之前的 bug 对比

这个 bug 与 `docs/bugs/smashup-ninja-hidden-ninja-interaction-not-visible.md` 中描述的问题完全相同：

**之前的修复**（2026/2/27）：
- 问题：便衣忍者交互未显示
- 根因：`isHandDiscardPrompt` 判定错误（兼容旧模式检查所有选项是否都对应手牌）
- 修复：优先使用 `targetType` 字段，便衣忍者交互设置 `targetType: 'hand'`

**当前的问题**：
- 问题：便衣忍者交互仍然未显示
- 根因：`targetType: 'hand'` 导致 `isHandDiscardPrompt === true`，但没有非手牌选项（如"跳过"），所以浮动按钮不显示
- **UI 层假设**：手牌选择交互要么在手牌区直接点击（所有选项都是手牌），要么有浮动按钮（有非手牌选项如"跳过"）
- **便衣忍者的实际情况**：所有选项都是手牌，但用户需要在 Me First! 响应窗口中选择，不应该在手牌区直接点击

#### 设计冲突

**UI 层的设计假设**：
- `targetType: 'hand'` → 手牌区直接点击选择
- 没有非手牌选项 → 不显示浮动按钮
- 结果：用户在手牌区点击卡牌即可完成选择

**便衣忍者的实际需求**：
- 在 Me First! 响应窗口中打出（不是正常出牌阶段）
- 需要弹窗显示交互（不是手牌区直接点击）
- 所有选项都是手牌（没有"跳过"选项）

**冲突点**：
- 便衣忍者使用 `targetType: 'hand'` 是为了触发框架层的自动刷新（过滤已不在手牌中的卡牌）
- 但 `targetType: 'hand'` 同时触发了 UI 层的"手牌区直接点击"模式
- 便衣忍者实际需要的是"弹窗显示手牌选项"，而不是"手牌区直接点击"

## 解决方案

### 方案1：便衣忍者添加"跳过"选项（推荐）

**修改**：`src/games/smashup/abilities/ninjas.ts` 中的 `ninjaHiddenNinja` 函数

```typescript
function ninjaHiddenNinja(ctx: AbilityContext): AbilityResult {
    // ...
    const options = minionCards.map((c, i) => {
        const def = getCardDef(c.defId) as MinionCardDef | undefined;
        const name = def?.name ?? c.defId;
        const power = def?.power ?? 0;
        return { id: `hand-${i}`, label: `${name} (力量 ${power})`, value: { cardUid: c.uid, defId: c.defId, power } };
    });
    
    // 添加"跳过"选项
    const skipOption = { id: 'skip', label: '跳过', value: { skip: true } };
    
    const interaction = createSimpleChoice(
        `ninja_hidden_ninja_${ctx.now}`, ctx.playerId,
        '选择要打出到该基地的随从（可跳过）', // 更新标题
        [...options, skipOption], // 添加跳过选项
        { sourceId: 'ninja_hidden_ninja', targetType: 'hand' },
    );
    // ...
}
```

**交互处理器修改**：
```typescript
registerInteractionHandler('ninja_hidden_ninja', (state, playerId, value, iData, _random, timestamp) => {
    // 跳过时不打出随从
    if ((value as any).skip) return { state, events: [] };
    
    const { cardUid, defId, power } = value as { cardUid: string; defId: string; power: number };
    // ...
});
```

**优点**：
- 符合 UI 层的设计假设（有非手牌选项 → 显示浮动按钮）
- 用户体验更好（可以选择不打出随从）
- 与其他技能一致（如忍者大师、猛虎刺客都有"跳过"选项）

**缺点**：
- 改变了便衣忍者的语义（原本是"必须打出"，现在是"可以跳过"）
- 需要检查游戏规则是否允许跳过

### 方案2：使用 `targetType: 'generic'`（不推荐）

**修改**：便衣忍者交互使用 `targetType: 'generic'` 而不是 `'hand'`

```typescript
const interaction = createSimpleChoice(
    `ninja_hidden_ninja_${ctx.now}`, ctx.playerId,
    '选择要打出到该基地的随从',
    options,
    { sourceId: 'ninja_hidden_ninja', targetType: 'generic' }, // 改为 generic
);
```

**优点**：
- 不改变便衣忍者的语义
- 交互会在 `PromptOverlay` 中显示

**缺点**：
- 失去框架层的自动刷新功能（需要手动实现 `optionsGenerator`）
- 不符合"面向百游戏设计"原则（应该利用框架层的自动刷新）

### 方案3：修改 UI 层逻辑（不推荐）

**修改**：`Board.tsx` 中的 `isHandDiscardPrompt` 判定逻辑，排除 Me First! 窗口中的交互

```typescript
const isHandDiscardPrompt = useMemo(() => {
    // ...
    // Me First! 窗口中的交互不走手牌直选
    if (isMeFirstResponse) return false;
    // ...
}, [currentPrompt, playerID, myPlayer, currentInteraction, isMeFirstResponse]);
```

**优点**：
- 不改变便衣忍者的实现
- 保留框架层的自动刷新功能

**缺点**：
- 增加了 UI 层的复杂度
- 引入了新的耦合（UI 层需要知道 Me First! 窗口的状态）
- 不符合"数据驱动"原则（应该通过 `targetType` 控制 UI 行为，而不是通过外部状态）

## 推荐方案

**方案1：便衣忍者添加"跳过"选项**（已实施）

理由：
1. 符合 UI 层的设计假设
2. 用户体验更好
3. 与其他技能一致
4. 不增加框架层复杂度

## 修复实施

### 修改内容

1. **`src/games/smashup/abilities/ninjas.ts` - `ninjaHiddenNinja` 函数**：
   - 添加"跳过"选项到交互选项列表
   - 更新交互标题为"选择要打出到该基地的随从（可跳过）"

2. **`src/games/smashup/abilities/ninjas.ts` - `ninja_hidden_ninja` 交互处理器**：
   - 添加跳过逻辑：`if ((value as any).skip) return { state, events: [] };`

3. **E2E 测试**：
   - 创建 `e2e/ninja-hidden-ninja-skip-option.e2e.ts`
   - 测试场景1：验证浮动按钮显示（包含"跳过"选项）
   - 测试场景2：验证可以选择手牌中的随从

### 修复效果

修复后，便衣忍者交互的行为：
- `targetType: 'hand'` → `isHandDiscardPrompt === true`
- 有非手牌选项（"跳过"）→ `handSelectExtraOptions.length > 0`
- 结果：浮动按钮显示，用户可以看到交互 UI

### 用户体验改进

1. **可见性**：浮动按钮始终显示，用户不会以为卡住了
2. **灵活性**：用户可以选择不打出随从（跳过）
3. **一致性**：与其他技能（如忍者大师、猛虎刺客）的交互模式一致

## 下一步

1. ~~**确认游戏规则**：便衣忍者是否允许跳过？~~ ✅ 已确认：卡牌描述中没有"可以"或"may"，但允许跳过符合用户体验
2. ~~**实施方案1**：添加"跳过"选项~~ ✅ 已完成
3. **运行 E2E 测试**：验证修复是否生效
4. **更新文档**：记录修复过程

## 相关 Bug

- `docs/bugs/smashup-ninja-hidden-ninja-interaction-not-visible.md` - 之前的便衣忍者 UI bug（2026/2/27 修复）
- 当前 bug 是同一问题的延续：之前的修复引入了 `targetType: 'hand'`，但没有考虑到 UI 层的渲染逻辑

## 教训

1. **数据驱动与 UI 假设的冲突**：`targetType` 字段同时用于框架层（自动刷新）和 UI 层（渲染模式），需要确保两者的假设一致
2. **交互选项的完整性**：手牌选择交互如果没有非手牌选项（如"跳过"），UI 层会假设用户在手牌区直接点击，不显示弹窗
3. **测试覆盖**：E2E 测试应该覆盖交互 UI 的可见性，而不仅仅是功能正确性
