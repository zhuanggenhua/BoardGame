# 盘旋机器人交互一闪而过问题 - 根本原因与修复

## 问题描述

用户报告盘旋机器人（robot_hoverbot）的交互弹窗"一闪而过"，无法选择。

## 根本原因

**`postProcessSystemEvents` 被调用两次，导致 `onPlay` 能力被触发两次，第二次创建的交互覆盖了第一次。**

### 调用链路

1. **`execute()` 中**：`PLAY_MINION` 命令产生 `MINION_PLAYED` 事件
2. **`pipeline.ts` 步骤 4.5**：调用 `postProcessSystemEvents`，它检测到 `MINION_PLAYED` 事件，调用 `fireMinionPlayedTriggers`
3. **`fireMinionPlayedTriggers`** 中：调用 `resolveOnPlay(defId)` 执行 `robotHoverbot`，创建交互 `robot_hoverbot_0`（使用 `now: 0`）
4. **`pipeline.ts` 步骤 5（afterEvents 循环）**：再次调用 `postProcessSystemEvents`，它又检测到 `MINION_PLAYED` 事件，再次调用 `fireMinionPlayedTriggers`
5. **第二次 `fireMinionPlayedTriggers`**：再次调用 `robotHoverbot`，创建交互 `robot_hoverbot_1772271532566`（使用新的时间戳），覆盖了第一个

### 证据

用户提供的日志显示：

```
robots.ts:174 [robotHoverbot] After queueInteraction 
  {currentInteraction: 'robot_hoverbot_0', ...}

PromptOverlay.tsx:136 [PromptOverlay] Props changed: 
  {interactionId: 'robot_hoverbot_1772271532566', ...}
```

交互 ID 从 `robot_hoverbot_0` 变成了 `robot_hoverbot_1772271532566`，说明 `robotHoverbot` 被调用了两次。

## 修复方案

在 `postProcessSystemEvents` 中添加去重逻辑：**只处理来自 `PLAY_MINION` 命令的 `MINION_PLAYED` 事件**（有 `sourceCommandType` 字段），跳过派生事件（如 `onPlay` 能力产生的 `MINION_PLAYED`，没有 `sourceCommandType`）。

### 修复代码

```typescript
// src/games/smashup/domain/index.ts
function postProcessSystemEvents(...) {
    // ...
    for (const event of afterAffect.events) {
        if (event.type === SU_EVENTS.MINION_PLAYED) {
            const playedEvt = event as MinionPlayedEvent;
            // 去重：只处理来自命令的 MINION_PLAYED（有 sourceCommandType），
            // 跳过派生事件（如 onPlay 能力产生的 MINION_PLAYED）
            if (!playedEvt.sourceCommandType) {
                prePlayEvents.push(event);
                continue;
            }
            // ... 触发 onPlay 能力
        }
    }
}
```

## 影响范围

**所有 `onPlay` 能力都受影响**，不仅仅是盘旋机器人。任何创建交互的 `onPlay` 能力都会被触发两次，导致交互被覆盖。

## 测试验证

修复后需要验证：
1. 盘旋机器人的交互正常显示，不会一闪而过
2. 其他创建交互的 `onPlay` 能力（如微型机守护者、微型机回收者）也正常工作
3. 派生的 `MINION_PLAYED` 事件（如盘旋机器人打出牌库顶的随从）仍然能正确触发 `onPlay` 能力

## 相关文件

- `src/games/smashup/domain/index.ts` - `postProcessSystemEvents` 函数
- `src/games/smashup/domain/abilityHelpers.ts` - `fireMinionPlayedTriggers` 函数
- `src/engine/pipeline.ts` - 管线执行流程
- `src/games/smashup/abilities/robots.ts` - 盘旋机器人能力实现

## 教训

1. **事件去重**：当同一个事件可能被多次处理时，必须添加去重逻辑
2. **调用链路追踪**：复杂的管线流程需要详细的日志来追踪调用链路
3. **设计问题**：`postProcessSystemEvents` 被调用两次是设计问题，应该在管线层面避免重复调用，而不是在领域层做去重
