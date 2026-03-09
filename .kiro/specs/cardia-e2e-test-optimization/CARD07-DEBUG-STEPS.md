# Card07 (宫廷卫士) 调试步骤

## 问题描述
用户报告"第一次弹窗都没有出现了"，后台日志显示 P2 可以看到交互（`hasFilteredCurrent: true`），但 P1 看不到（`hasFilteredCurrent: false`）。

## 问题分析

### 1. 交互流程
宫廷卫士能力有两步交互：
1. **第一步（P1）**：选择派系（faction selection）
2. **第二步（P2）**：选择是否弃牌（choice interaction）

### 2. 后台日志分析
从用户提供的日志来看，当前显示的是 `ability_i_court_guard_opponent_` 交互，这是**第二步交互**（对手选择），不是第一步。

这说明：
- 第一步交互（派系选择）已经完成
- 第二步交互（对手选择）已创建
- P2 应该能看到这个交互（`playerId: '1'`）
- P1 不应该看到这个交互（因为不是他的交互）

### 3. 可能的问题

#### 问题 A：第一步交互被跳过
- 可能原因：派系选择交互没有正确创建或被自动解决
- 检查点：查看是否有 `ability_i_court_guard_<timestamp>` 交互被创建

#### 问题 B：第二步交互 UI 没有显示
- 可能原因：Board 组件没有正确检测到 `choice` 类型交互
- 检查点：查看前端控制台日志，确认 `interactionType` 是否为 `'choice'`

## 调试步骤

### 步骤 1：检查前端控制台日志
添加了详细的调试日志到 `Board.tsx`，运行测试后查看：

```
[Board] Interaction state changed: {
  hasInteraction: true/false,
  interactionId: '...',
  interactionPlayerId: '0' or '1',
  myPlayerId: '0' or '1',
  isMyInteraction: true/false,
  interactionType: 'choice' or 'faction-selection' or 'card-selection',
  hasCardiaInteraction: true/false,
  cardiaInteractionType: 'choice' or 'faction_selection' or 'card_selection'
}
```

### 步骤 2：检查 ChoiceModal 渲染
如果 `showChoice` 为 `true`，应该看到：

```
[Board] Rendering ChoiceModal: {
  showChoice: true,
  hasCurrentInteraction: true,
  hasCardiaInteraction: true,
  title: '选择是否弃牌',
  optionsCount: 2,
  options: [
    { id: 'discard', label: '弃掉一张手牌', description: '...' },
    { id: 'decline', label: '不弃牌', description: '...' }
  ]
}
```

### 步骤 3：检查后端日志
查看完整的后端日志，确认：
1. 是否有第一步交互（派系选择）被创建
2. 第一步交互是如何被解决的
3. 第二步交互的 `playerId` 是否正确

### 步骤 4：手动测试
1. 启动开发服务器：`npm run dev`
2. 创建 Cardia 在线对局
3. 使用调试面板注入测试状态（`CARD07-COURT-GUARD-INJECT-STATE.json`）
4. P1 点击激活能力按钮
5. 观察是否出现派系选择弹窗
6. 选择 "Swamp" 派系
7. 观察 P2 是否出现选择弹窗

## 预期行为

### 正常流程
1. P1 激活宫廷卫士能力
2. P1 看到派系选择弹窗（4 个选项：swamp, academy, guild, dynasty）
3. P1 选择 "Swamp"
4. 后端检查 P2 手牌中是否有 Swamp 派系的牌
5. P2 手牌中有 card05 (Saboteur, faction: swamp)
6. P2 看到选择弹窗（2 个选项：弃牌 / 不弃牌）
7. P2 选择其中一个选项
8. 根据选择执行相应逻辑

### 当前问题
- 用户报告"第一次弹窗都没有出现"
- 后台日志显示第二步交互已创建
- 说明第一步交互可能被自动跳过或快速完成

## 可能的修复方案

### 方案 A：检查派系选择交互是否正确创建
查看 `group2-modifiers.ts` 中 `COURT_GUARD` 的 executor：

```typescript
abilityExecutorRegistry.register(ABILITY_IDS.COURT_GUARD, (ctx: CardiaAbilityContext) => {
    const interaction = createFactionSelectionInteraction(
        `${ctx.abilityId}_${ctx.timestamp}`,
        ctx.abilityId,
        ctx.playerId,  // ← 应该是 P1 的 ID
        '选择派系',
        '...'
    );
    
    (interaction as any).cardId = ctx.cardId;
    
    return {
        events: [],
        interaction,  // ← 应该返回交互
    };
});
```

### 方案 B：检查 wrapCardiaInteraction 是否正确处理 choice 类型
查看 `systems.ts` 中 `wrapCardiaInteraction` 函数：

```typescript
} else if (cardiaInteraction.type === 'choice') {
    interactionType = 'choice';  // ← 应该设置为 'choice'
    
    const choiceOptions = (cardiaInteraction as any).options || [];
    options = choiceOptions.map((opt: any) => ({
        id: opt.id,
        label: opt.label,
        value: { option: opt.id },
        description: opt.description,
    }));
}
```

### 方案 C：检查 Board 组件是否正确检测 choice 类型
查看 `Board.tsx` 中的 useEffect：

```typescript
if (data.interactionType === 'choice') {
    setShowChoice(true);  // ← 应该设置为 true
}
```

## 下一步
1. 运行手动测试，查看前端控制台日志
2. 根据日志输出确定问题所在
3. 应用相应的修复方案
