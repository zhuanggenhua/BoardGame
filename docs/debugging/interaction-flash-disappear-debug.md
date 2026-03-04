# 交互弹窗一闪而过问题 - 调试指南

## 问题描述

用户报告：盘旋机器人（robot_hoverbot）的交互弹窗出现后立即消失，无法选择。

**症状**：
- 弹窗显示："牌库顶是 核弹机器人（力量5），是否作为额外随从打出？"
- 有"放回牌库顶"按钮
- 弹窗出现后立即折叠/消失，无法点击

## 已添加的调试日志

### 1. `queueInteraction` 日志

**位置**：`src/engine/systems/InteractionSystem.ts` - `queueInteraction` 函数

**输出内容**：
```
[InteractionSystem] queueInteraction: 加入交互
  - interactionId: 交互ID
  - playerId: 玩家ID
  - kind: 交互类型
  - sourceId: 来源能力ID
  - hasCurrent: 是否已有当前交互
  - currentQueueLength: 当前队列长度
  - urgent: 是否紧急插队

[InteractionSystem] queueInteraction: 立即生成选项（无当前交互）
  - interactionId: 交互ID
  - originalOptionsCount: 原始选项数量

[InteractionSystem] queueInteraction: optionsGenerator 返回
  - freshOptionsCount: 刷新后选项数量
  - freshOptions: 刷新后的选项列表（id, label, disabled）

[InteractionSystem] queueInteraction: 设置为当前交互 / 加入队列
```

### 2. `resolveInteraction` 日志

**位置**：`src/engine/systems/InteractionSystem.ts` - `resolveInteraction` 函数

**输出内容**：
```
[InteractionSystem] resolveInteraction: 使用 optionsGenerator 刷新选项
  - interactionId: 交互ID
  - playerId: 玩家ID
  - sourceId: 来源能力ID
  - originalOptionsCount: 原始选项数量

[InteractionSystem] resolveInteraction: optionsGenerator 返回
  - freshOptionsCount: 刷新后选项数量
  - freshOptions: 刷新后的选项列表

[InteractionSystem] resolveInteraction: 刷新后选项不足，保持原选项（警告）
  - interactionId: 交互ID
  - freshOptionsCount: 刷新后选项数量
  - requiredMin: 最小要求选项数

[InteractionSystem] resolveInteraction: 弹出下一个交互
  - nextInteractionId: 下一个交互ID
  - nextPlayerId: 下一个交互的玩家ID
  - nextKind: 下一个交互类型
  - remainingQueueLength: 剩余队列长度
```

## 排查步骤

### 1. 复现问题并查看控制台日志

1. 打开浏览器开发者工具（F12）
2. 切换到 Console 标签
3. 打出盘旋机器人
4. 观察日志输出

### 2. 关键日志模式

#### 正常流程（应该看到）：
```
[InteractionSystem] queueInteraction: 加入交互
  interactionId: "robot_hoverbot_1234567890"
  hasCurrent: false
  
[InteractionSystem] queueInteraction: 立即生成选项（无当前交互）
  originalOptionsCount: 2
  
[InteractionSystem] queueInteraction: optionsGenerator 返回
  freshOptionsCount: 2
  freshOptions: [
    { id: "play", label: "打出 核弹机器人", disabled: false },
    { id: "skip", label: "放回牌库顶", disabled: false }
  ]
  
[InteractionSystem] queueInteraction: 设置为当前交互
```

#### 异常模式 A：选项被刷新为空
```
[InteractionSystem] resolveInteraction: 使用 optionsGenerator 刷新选项
  
[InteractionSystem] resolveInteraction: optionsGenerator 返回
  freshOptionsCount: 0  ← 选项为空！
```

**原因**：`optionsGenerator` 中的 `ctx.playerId` 闭包引用失效（已修复）

#### 异常模式 B：交互立即被解决
```
[InteractionSystem] queueInteraction: 设置为当前交互
  interactionId: "robot_hoverbot_1234567890"
  
[InteractionSystem] resolveInteraction: 弹出下一个交互
  nextInteractionId: undefined  ← 交互立即消失！
  remainingQueueLength: 0
```

**原因**：某个逻辑在交互创建后立即调用了 `resolveInteraction`

#### 异常模式 C：交互被另一个交互替换
```
[InteractionSystem] queueInteraction: 设置为当前交互
  interactionId: "robot_hoverbot_1234567890"
  
[InteractionSystem] queueInteraction: 加入交互
  interactionId: "some_other_interaction"
  hasCurrent: true  ← 已有当前交互，应该加入队列
  
[InteractionSystem] queueInteraction: 设置为当前交互  ← 错误！不应该替换当前交互
  interactionId: "some_other_interaction"
```

**原因**：某个逻辑错误地清空了当前交互后又创建了新交互

### 3. 检查 `optionsGenerator` 的返回值

如果看到 `freshOptionsCount: 0` 或 `freshOptionsCount: 1`（只有 skip），检查：

1. **牌库状态**：
   ```javascript
   const playerId = window.__BG_STATE__?.sys.interaction.current?.playerId;
   const deck = window.__BG_STATE__?.core.players[playerId]?.deck;
   console.log('Deck:', deck);
   ```

2. **预期卡牌是否仍在牌库顶**：
   ```javascript
   const expectedUid = '...'; // 从日志中获取
   const deckTopUid = deck[0]?.uid;
   console.log('Match:', deckTopUid === expectedUid);
   ```

### 4. 检查是否有其他能力修改了牌库

搜索 `onMinionPlayed` 触发器，看是否有能力在盘旋机器人打出后修改了牌库：

```bash
grep -r "onMinionPlayed" src/games/smashup/abilities/
grep -r "registerTrigger.*onMinionPlayed" src/games/smashup/
```

### 5. 检查交互解决的时机

在 `src/games/smashup/commands.ts` 中搜索 `resolveInteraction` 的调用点，确认是否有逻辑在不应该的时候解决了交互。

## 已知修复

### 修复 1：`optionsGenerator` 闭包引用问题（已实施）

**问题**：`optionsGenerator` 使用闭包中的 `ctx.playerId`，在交互刷新时可能已失效。

**修复**：使用 `iData.playerId` 参数而非闭包引用。

**文件**：`src/games/smashup/abilities/robots.ts` lines 125-140

## 根因分析（2026-02-28）

### 问题：交互 ID 从 `robot_hoverbot_0` 变成 `robot_hoverbot_1772270392399`

**症状**：
- 日志显示交互 ID 从 `robot_hoverbot_0` 变成了 `robot_hoverbot_1772270392399`
- 说明 `robotHoverbot` 能力被执行了两次，每次使用不同的 `ctx.now` 值
- **关键**：只看到一次 `queueInteraction` 日志，但 UI 显示了两个不同的交互 ID

**根因**：
`onPlay` 能力被触发了两次，每次使用不同的 `now` 值：

1. **第一次执行**（在 `postProcessSystemEvents` 步骤 4.5 中）：
   - `command.timestamp` 可能是 `undefined`，所以 `now = 0`（`reducer.ts` line 72）
   - `robotHoverbot` 被调用，创建交互 ID `robot_hoverbot_0`
   - 生成 `MINION_PLAYED` 事件（timestamp = 0）

2. **第二次执行**（在 `postProcessSystemEvents` 的 afterEvents 循环中）：
   - 从事件中提取 `now`，如果事件的 `timestamp` 是真实时间戳，则 `now = 1772270392399`（`domain/index.ts` line 893）
   - **再次调用 `fireMinionPlayedTriggers`**，其中包含 `onPlay` 能力（line 930+）
   - `robotHoverbot` 被第二次调用，创建交互 ID `robot_hoverbot_1772270392399`
   - 新交互替换了旧交互，导致 UI 闪烁

**为什么会触发两次？**

查看 `src/engine/pipeline.ts`：

1. **第一次**（步骤 4.5，line 636）：
   ```typescript
   // 4.5 领域层后处理（如 onPlay 触发链），在 afterEvents 前执行
   if (domain.postProcessSystemEvents && appliedEvents.length > 0) {
       const processResult = domain.postProcessSystemEvents(
           currentState.core,
           domainEvents as unknown as TEvent[],
           effectiveRandom,
           currentState,
       );
       // ... 处理结果 ...
   }
   ```

2. **第二次**（afterEvents 循环，line 348）：
   ```typescript
   // 领域层系统事件后处理（如 trigger 回调），在 reduce 前追加派生事件
   if (roundEvents.length > 0 && domain.postProcessSystemEvents) {
       const processResult = domain.postProcessSystemEvents(
           currentState.core,
           domainEvents as unknown as TEvent[],
           random,
           currentState,
       );
       // ... 处理结果 ...
   }
   ```

**问题**：`postProcessSystemEvents` 被调用了两次，每次都处理了 `MINION_PLAYED` 事件，导致 `onPlay` 能力被触发两次。

### 修复方案

**方案 A：在 `postProcessSystemEvents` 中标记已处理的事件**

修改 `src/games/smashup/domain/index.ts` 中的 `postProcessSystemEvents`，在处理 `MINION_PLAYED` 事件后添加标记：

```typescript
for (const event of afterAffect.events) {
    if (event.type === SU_EVENTS.MINION_PLAYED) {
        // 检查是否已经处理过
        if ((event as any).__triggersProcessed) {
            continue; // 跳过已处理的事件
        }
        
        // ... 调用 fireMinionPlayedTriggers ...
        
        // 标记为已处理
        (event as any).__triggersProcessed = true;
    } else {
        prePlayEvents.push(event);
    }
}
```

**方案 B：只在第一次调用时处理 `MINION_PLAYED`**

修改 `src/engine/pipeline.ts`，在 afterEvents 循环中跳过 `MINION_PLAYED` 事件：

```typescript
// 在 executeAfterEventsLoop 中（line 348）
if (roundEvents.length > 0 && domain.postProcessSystemEvents) {
    const domainEvents = roundEvents.filter((e) => !e.type.startsWith('SYS_'));
    // 过滤掉 MINION_PLAYED 事件（已在步骤 4.5 中处理）
    const eventsToProcess = domainEvents.filter((e) => e.type !== 'su:minion_played');
    if (eventsToProcess.length > 0) {
        const processResult = domain.postProcessSystemEvents(
            currentState.core,
            eventsToProcess as unknown as TEvent[],
            random,
            currentState,
        );
        // ... 处理结果 ...
    }
}
```

**方案 C：使用唯一的交互 ID 生成策略**

修改 `robotHoverbot` 能力，使用更稳定的 ID 生成策略（不依赖 `ctx.now`）：

```typescript
// 使用卡牌 UID 作为交互 ID 的一部分，确保唯一性
const interaction = createSimpleChoice(
    `robot_hoverbot_${ctx.cardUid}`,  // 使用 cardUid 而非 ctx.now
    ...
);
```

**推荐方案**：方案 A，因为它：
1. 最小化修改范围（只改 SmashUp 的 `postProcessSystemEvents`）
2. 不影响引擎层的通用逻辑
3. 明确标记已处理的事件，避免重复触发
4. 不改变交互 ID 的生成策略（保持一致性）

## 下一步调试

### 需要收集的日志

已在 `robotHoverbot` 函数入口添加了详细日志。请用户：

1. **清空控制台**
2. **打出盘旋机器人**
3. **截图完整的控制台日志**（从命令开始到交互消失）

**关键日志标记**：
- `[DEBUG] robotHoverbot: 能力被调用` - 确认调用次数和 `ctx.now` 值
- `[DEBUG] robotHoverbot: 创建交互` - 确认交互 ID
- `[InteractionSystem] queueInteraction` - 确认交互加入队列
- `[DEBUG] processDestroyMoveCycle` - 确认事件处理流程

### 预期结果

**正常情况**（只调用一次）：
```
[DEBUG] robotHoverbot: 能力被调用 {now: 0, ...}
[DEBUG] robotHoverbot: 创建交互 {interactionId: "robot_hoverbot_0", ...}
[InteractionSystem] queueInteraction: 加入交互 {interactionId: "robot_hoverbot_0", ...}
```

**异常情况**（调用两次）：
```
[DEBUG] robotHoverbot: 能力被调用 {now: 0, ...}
[DEBUG] robotHoverbot: 创建交互 {interactionId: "robot_hoverbot_0", ...}
[InteractionSystem] queueInteraction: 加入交互 {interactionId: "robot_hoverbot_0", ...}
[DEBUG] robotHoverbot: 能力被调用 {now: 1772270392399, ...}  ← 第二次调用！
[DEBUG] robotHoverbot: 创建交互 {interactionId: "robot_hoverbot_1772270392399", ...}
[InteractionSystem] queueInteraction: 加入交互 {interactionId: "robot_hoverbot_1772270392399", ...}
```

### 分析方向

根据日志结果：

1. **如果只看到一次调用**：
   - 问题不在 `postProcessSystemEvents` 重复调用
   - 可能是 UI 层读取错误或状态更新问题
   - 需要检查 `Board.tsx` 中 `currentPrompt` 的更新逻辑

2. **如果看到两次调用**：
   - 确认两次调用的堆栈跟踪（`stackTrace`）
   - 确认两次调用的 `now` 值来源
   - 检查是否有其他代码路径会触发 `onPlay` 能力

### 可能的根因假设

1. **假设 A：`postProcessSystemEvents` 被调用两次**
   - 步骤 4.5 调用一次
   - afterEvents 循环调用一次
   - 但 afterEvents 循环应该只处理系统 hooks 产生的新事件，不应该包含 `MINION_PLAYED`

2. **假设 B：UI 层状态更新问题**
   - 交互只创建了一次（`robot_hoverbot_0`）
   - 但 UI 层读取了错误的交互 ID
   - 可能是 React 状态更新时序问题

3. **假设 C：事件重播问题**
   - 某个系统（如 EventStreamSystem）重播了历史事件
   - 导致 `MINION_PLAYED` 事件被重新处理

## 临时解决方案（如果确认是重复调用）

如果确认 `robotHoverbot` 被调用了两次，可以使用以下临时方案：

### 方案 1：使用 cardUid 作为交互 ID

```typescript
// 使用 cardUid 而非 ctx.now，确保同一张卡只创建一个交互
const interaction = createSimpleChoice(
    `robot_hoverbot_${ctx.cardUid}`,  // 使用 cardUid
    ctx.playerId,
    `牌库顶是 ${name}（力量 ${power}），是否作为额外随从打出？`,
    [
        { id: 'play', label: `打出 ${name}`, value: { cardUid: peek.card.uid, defId: peek.card.defId, power } },
        { id: 'skip', label: '放回牌库顶', value: { skip: true } },
    ],
    'robot_hoverbot',
);
```

### 方案 2：在 `queueInteraction` 中检查重复

```typescript
// 在 InteractionSystem.ts 的 queueInteraction 中添加重复检查
if (current && current.id === interaction.id) {
    console.warn('[InteractionSystem] 跳过重复交互', { interactionId: interaction.id });
    return state; // 跳过重复的交互
}
```

## 相关文件

- `src/games/smashup/abilities/robots.ts` - 已添加调试日志
- `src/engine/pipeline.ts` - 管线执行流程
- `src/games/smashup/domain/index.ts` - `postProcessSystemEvents` 实现
- `src/engine/systems/InteractionSystem.ts` - 交互系统
- `docs/bugs/smashup-robot-hoverbot-interaction-double-trigger.md` - Bug 报告

## 临时解决方案

如果问题是 `isSubmitLocked` 导致的（用户点击后锁定，但交互未正常解决），可以添加调试按钮强制解锁：

```typescript
// 在 PromptOverlay.tsx 中添加
{process.env.NODE_ENV === 'development' && isSubmitLocked && (
    <button
        onClick={() => setSubmittingInteractionId(null)}
        className="fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded z-[9999]"
    >
        强制解锁（调试）
    </button>
)}
```

## 相关文件

- `src/engine/systems/InteractionSystem.ts` - 交互系统（已添加日志）
- `src/games/smashup/abilities/robots.ts` - 盘旋机器人能力（已修复闭包问题）
- `src/games/smashup/ui/PromptOverlay.tsx` - UI 层交互渲染
- `docs/bugs/smashup-robot-hoverbot-button-unclickable.md` - Bug 报告
