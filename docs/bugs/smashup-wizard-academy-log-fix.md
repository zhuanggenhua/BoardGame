# Bug 修复：巫师学院日志显示错误基地名称

## 问题描述

用户反馈"巫师学院无效果"。实际问题是：操作日志中显示随从"登场 → 巫师学院"，但状态快照中巫师学院已被替换为其他基地，导致日志显示的基地名称与实际不符。

## 根本原因

`actionLog.ts` 中格式化 `MINION_PLAYED` 事件时，使用**当前状态**（`state.core.bases[baseIndex]`）来查找基地名称，而不是事件发生时的基地。当基地被替换后，`baseIndex` 指向的基地已经变成了新基地，导致显示错误的基地名称。

```typescript
// 错误的实现（修复前）
case SU_EVENTS.MINION_PLAYED: {
    const payload = event.payload as { defId: string; baseIndex: number };
    const baseLabel = formatBaseLabel(getBaseDefId(payload.baseIndex), payload.baseIndex);
    // ↑ 从当前状态查找基地，如果基地已被替换则显示错误
}
```

## 解决方案

在 `MINION_PLAYED` 事件的 payload 中添加 `baseDefId` 字段，确保日志记录的是事件发生时的基地名称，而不是当前状态的基地。

### 修改内容

1. **类型定义**（`src/games/smashup/domain/types.ts`）
   - 在 `MinionPlayedEvent.payload` 中添加 `baseDefId?: string` 字段（可选，用于向后兼容测试代码）

2. **事件生成**（`src/games/smashup/domain/reducer.ts` + 所有能力文件）
   - 在构建 `MINION_PLAYED` 事件时，添加 `baseDefId: core.bases[baseIndex].defId`
   - 修改了以下文件：
     - `src/games/smashup/domain/reducer.ts`（主命令处理）
     - `src/games/smashup/abilities/aliens.ts`
     - `src/games/smashup/abilities/bear_cavalry.ts`
     - `src/games/smashup/abilities/ghosts.ts`
     - `src/games/smashup/abilities/killer_plants.ts`
     - `src/games/smashup/abilities/ninjas.ts`
     - `src/games/smashup/abilities/robots.ts`
     - `src/games/smashup/abilities/vampires.ts`
     - `src/games/smashup/abilities/zombies.ts`
     - `src/games/smashup/domain/baseAbilities_expansion.ts`

3. **日志格式化**（`src/games/smashup/actionLog.ts`）
   - 优先使用 payload 中的 `baseDefId`，fallback 到当前状态查找

```typescript
// 正确的实现（修复后）
case SU_EVENTS.MINION_PLAYED: {
    const payload = event.payload as { defId: string; baseIndex: number; baseDefId?: string };
    // 优先使用 payload 中的 baseDefId（事件发生时的基地），fallback 到当前状态查找
    const baseLabel = formatBaseLabel(payload.baseDefId ?? getBaseDefId(payload.baseIndex), payload.baseIndex);
}
```

## 架构意义

这个修复体现了一个重要的架构原则：**事件应该是自包含的，不应依赖外部状态来解释**。

- ✅ 正确：事件 payload 包含所有必要信息（包括基地名称）
- ❌ 错误：事件只包含索引，依赖当前状态来查找名称（"时间旅行"问题）

这个原则适用于所有需要显示历史信息的场景（日志、回放、审计等）。

## 测试验证

修复后，即使基地被替换，历史日志仍然显示正确的基地名称（事件发生时的基地）。

## 相关文件

- `src/games/smashup/domain/types.ts`（类型定义）
- `src/games/smashup/domain/reducer.ts`（主命令处理）
- `src/games/smashup/actionLog.ts`（日志格式化）
- `src/games/smashup/abilities/*.ts`（能力系统）
- `src/games/smashup/domain/baseAbilities_expansion.ts`（基地能力）
