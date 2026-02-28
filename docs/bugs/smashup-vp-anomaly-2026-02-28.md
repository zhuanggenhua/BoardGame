# SmashUp VP 异常问题分析

## 问题描述

用户反馈：游戏结束时 VP 异常高
- 玩家 0：16 VP
- 玩家 1：15 VP
- 回合数：5
- 计分基地：托尔图加（VP 奖励 [4, 3, 2]）

**异常点**：单次基地计分最多给 7 VP（4+3），但双方总共有 31 VP。

## 根本问题

**用户反馈中的 Action Log 不完整**：
1. 日志只显示了最后的随从登场操作
2. 没有显示任何 `BASE_SCORED` 或 `VP_AWARDED` 事件
3. 无法确认是否有重复计分或 VP 累加 bug

## 可能的原因

### 假设 1：日志导出功能有问题
- 用户反馈系统可能只导出了部分日志
- Action Log 容量限制（默认 50 条）导致早期记录被挤出
- 需要检查反馈系统的日志导出逻辑

### 假设 2：重复计分 bug
- 某个基地被重复计分多次
- 需要检查 `scoreOneBase` 是否被重复调用
- 需要完整日志才能确认

### 假设 3：VP 累加 bug
- `BASE_SCORED` 事件的 reduce 逻辑有问题
- VP 被重复累加
- 需要完整日志才能确认

## Action Log 系统分析

### 当前实现
- **容量**：默认 50 条（`maxEntries = 50`）
- **白名单**：只记录特定命令产生的事件
  - `PLAY_MINION`
  - `PLAY_ACTION`
  - `USE_TALENT`
  - `DISCARD_TO_LIMIT`
  - `ADVANCE_PHASE` ✅（触发计分）
  - `RESPOND` ✅（交互解决）

### 计分事件应该被记录
`ADVANCE_PHASE` 命令会触发：
1. `scoreBases` 阶段
2. 产生 `BASE_SCORED` 事件（包含排名和 VP）
3. 产生 `VP_AWARDED` 事件（如果有额外 VP）
4. 这些事件应该被 `formatSmashUpActionEntry` 格式化并记录

### 为什么用户反馈中没有计分记录？

**可能原因**：
1. **日志被截断**：反馈系统只导出了最后 N 条记录
2. **日志容量不足**：50 条容量在长时间游戏中不够用
3. **日志导出 bug**：反馈系统的导出逻辑有问题

## 解决方案

### 方案 1：检查反馈系统的日志导出逻辑（优先）

检查 bug 反馈表单是否正确导出完整的 Action Log：

```typescript
// 需要检查的位置：反馈表单提交逻辑
// 确保导出 state.sys.actionLog.entries 的完整数组
```

### 方案 2：增强服务端日志（已完成 ✅）

在 `GameTransportServer` 中添加关键事件日志：
- 记录所有 `BASE_SCORED` 事件
- 记录所有 `VP_AWARDED` 事件
- 日志持久化到 `logs/app-*.log`

**优点**：
- 不依赖客户端 Action Log
- 可追溯完整历史
- 按日期轮转，保留 30 天

### 方案 3：在 Action Log 中添加 VP 快照

在每次 VP 变更后，记录当前所有玩家的 VP 总和：

```typescript
case SU_EVENTS.BASE_SCORED: {
    // ... 现有逻辑 ...
    
    // 添加 VP 快照（用于审计）
    const vpSnapshot = Object.entries(state.core.players)
        .map(([pid, p]) => `${pid}:${p.vp}`)
        .join(' ');
    segments.push(textSegment(` [VP: ${vpSnapshot}]`));
    
    pushEntry(event.type, segments, actorId, entryTimestamp, index);
    break;
}
```

**优点**：
- 可以直观看到 VP 累加过程
- 容易发现异常（如 VP 突然跳变）

**缺点**：
- 增加日志冗余度

### 方案 4：添加 VP 变更审计日志（临时调试）

在 `reduce.ts` 中添加 console.log：

```typescript
case SU_EVENTS.BASE_SCORED: {
    const { rankings } = event.payload;
    let newPlayers = state.players;
    for (const r of rankings) {
        const p = newPlayers[r.playerId];
        if (!p) continue;
        const oldVp = p.vp;
        const newVp = p.vp + r.vp;
        
        // 审计日志（临时）
        console.log(`[VP_AUDIT] BASE_SCORED: player=${r.playerId} ${oldVp} -> ${newVp} (+${r.vp})`);
        
        newPlayers = {
            ...newPlayers,
            [r.playerId]: { ...p, vp: newVp },
        };
    }
    return { ...state, players: newPlayers };
}
```

## 推荐行动

1. **立即**：检查反馈系统的日志导出逻辑（方案 1）
2. **已完成**：增强服务端日志（方案 2）✅
3. **短期**：在 Action Log 中添加 VP 快照（方案 3）
4. **临时**：添加 VP 变更审计日志（方案 4），等待用户再次复现

## 后续跟进

- [ ] 检查反馈系统日志导出逻辑
- [ ] 实施方案 3（VP 快照）
- [ ] 等待用户再次复现，收集完整日志
- [ ] 分析日志，确认根本原因
- [ ] 修复 bug（如果存在）
- [ ] 添加回归测试

## 相关文件

- `src/games/smashup/actionLog.ts` - Action Log 格式化
- `src/games/smashup/domain/reduce.ts` - VP 累加逻辑
- `src/engine/systems/ActionLogSystem.ts` - 日志系统
- `src/engine/transport/server.ts` - 服务端事件日志（已增强）
- `server/logger.ts` - 服务端日志系统
