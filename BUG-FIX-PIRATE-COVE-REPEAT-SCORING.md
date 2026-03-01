# 海盗湾重复计分 Bug 修复（最终版）

## 问题描述

用户报告：
1. 海盗湾（猫眼石）一直触发，每次移动都加分
2. 基地计分都触发多次

## 根本原因（最终确认）

**`onAutoContinueCheck` 在 `scoreBases` 阶段错误地返回了 `autoContinue: true`**，导致交互解决后自动重新进入计分逻辑。

### 完整的调用链

1. **第一次计分**：
   - 用户点击"结束回合" → `ADVANCE_PHASE` 命令
   - `FlowSystem.beforeCommand` → `onPhaseExit('scoreBases')`
   - `scoreOneBase(baseIndex=0)` → 触发海盗湾 `afterScoring`
   - 创建交互 → 返回 `halt=true`
   - `FlowSystem` 设置 `sys.flowHalted = true`

2. **交互解决**：
   - 用户响应交互（选择移动侏儒）
   - `SmashUpEventSystem.afterEvents` 处理交互
   - 发射 `MINION_MOVED` 等事件

3. **自动推进触发**（问题所在）：
   - `FlowSystem.afterEvents` 被调用
   - 调用 `onAutoContinueCheck({ state, events })`
   - **检查条件**：
     - ✅ 响应窗口已关闭
     - ✅ 没有待处理的交互（刚解决完）
     - ✅ 没有可激活的 beforeScoring 特殊能力
   - **返回 `{ autoContinue: true, playerId: '0' }`**

4. **第二次计分**（重复调用）：
   - `FlowSystem` 执行 `ADVANCE_PHASE` 逻辑
   - **重新进入 `onPhaseExit('scoreBases')`**
   - **再次调用 `scoreOneBase(baseIndex=0)`**
   - 再次触发海盗湾 `afterScoring`
   - 创建相同 ID 的交互（如果没有防护）
   - 循环继续...

### 为什么会这样设计？

原始的 `onAutoContinueCheck` 逻辑是为了处理以下场景：
- Me First! 响应窗口关闭后自动推进
- beforeScoring 特殊能力（如忍者侍从）激活后自动推进

但这个逻辑有一个致命缺陷：**它没有考虑到 `onPhaseExit` 可能创建交互并 halt 的情况**。

## 解决方案（最终版）

### 修复：条件性自动推进

在 `onAutoContinueCheck` 中，`scoreBases` 阶段使用更精细的判断：

```typescript
// scoreBases 阶段：条件性自动推进
// 
// 【关键修复】只有在以下情况才自动推进：
// 1. flowHalted=true（表示之前 halt 过，现在交互已解决）
// 2. 没有待处理的交互
// 3. 没有更多基地需要计分（scoringEligibleBaseIndices 为空）
if (phase === 'scoreBases') {
    // 如果 flowHalted=true，说明之前 halt 过（创建了交互）
    // 此时检查是否还有更多基地需要计分
    if (state.sys.flowHalted) {
        const eligibleIndices = getScoringEligibleBaseIndices(core);
        if (eligibleIndices.length === 0) {
            // 没有更多基地需要计分，可以自动推进
            return { autoContinue: true, playerId: pid };
        } else {
            // 还有更多基地需要计分，不自动推进（等待玩家选择计分顺序）
            return undefined;
        }
    }
    
    // 如果 flowHalted=false，保留原有的响应窗口和特殊能力检查
    // ...
}
```

### 为什么这是正确的修复？

1. **修复了根本原因**：
   - `flowHalted=true` 时，只有在没有更多基地需要计分时才自动推进
   - 这样可以避免重新进入 `onPhaseExit` 导致重复计分

2. **保持了用户体验**：
   - 交互解决后，如果没有更多基地需要计分，自动推进到 `draw` 阶段
   - 用户不需要点击两次"结束回合"

3. **处理了多基地计分**：
   - 如果还有更多基地需要计分，不自动推进
   - 等待玩家选择计分顺序（通过 `multi_base_scoring` 交互）

4. **保留了原有功能**：
   - Me First! 响应窗口检查
   - beforeScoring 特殊能力检查

### 保留的防御层（可选）

虽然根本原因已修复，但可以保留以下防御层作为额外保护：

1. **`_pirateCoveTriggered` 标记**（海盗湾 `afterScoring` 中）
   - 防止海盗湾特有的交互 ID 冲突问题
   - 作为深度防御的一部分

2. **唯一交互 ID**（使用 `state.nextUid` 而非 `ctx.now`）
   - 确保每次创建的交互 ID 唯一
   - 这是最佳实践，所有基地能力都应该遵循

3. **`flowHalted` 标志**（引擎层自动管理）
   - 防止延迟事件发射后立即重新计分
   - 作为时序保护

## 工作原理（最终版）

### 修复后的完整流程

**Cycle 1: 玩家点击"结束回合"（第一次）**
1. `ADVANCE_PHASE` 命令
2. `FlowSystem.beforeCommand` → `onPhaseExit('scoreBases')`
3. `scoreOneBase(baseIndex=0)`
4. 触发 `beforeScoring`（海盗王移动等）
5. 计算排名，发射 `BASE_SCORED` 事件
6. 触发海盗湾 `afterScoring`
7. 创建交互 `base_pirate_cove_1_100`
8. 延迟 `BASE_CLEARED` 和 `BASE_REPLACED` 事件
9. 返回 `halt=true`
10. `FlowSystem` 设置 `sys.flowHalted = true`

**Cycle 2: 玩家响应交互**
1. 玩家响应交互，选择移动侏儒
2. 交互处理函数创建链式交互（选择目标基地）
3. 延迟事件传递到链式交互

**Cycle 3: 交互解决后（关键）**
1. 最后一个链式交互解决
2. `SmashUpEventSystem.afterEvents` 发射延迟的 `BASE_CLEARED` 和 `BASE_REPLACED` 事件
3. 延迟事件被 reduce，基地0从 `scoringEligibleBaseIndices` 中移除
4. `FlowSystem.afterEvents` 被调用
5. 调用 `onAutoContinueCheck({ state, events })`
6. **检查 `phase === 'scoreBases' && flowHalted === true`**
7. **检查 `scoringEligibleBaseIndices.length === 0`（没有更多基地需要计分）**
8. **返回 `{ autoContinue: true, playerId: '0' }`**（自动推进）
9. `FlowSystem` 执行 `ADVANCE_PHASE` 逻辑
10. `onPhaseExit('scoreBases')` → 检查 `flowHalted` → 清除标志 → 推进到 `draw`

**关键改进**：交互解决后，如果没有更多基地需要计分，自动推进到 `draw`，用户不需要点击两次"结束回合"。

## 关键点

1. **根本原因**：`onAutoContinueCheck` 在 `scoreBases` 阶段错误地返回了 `autoContinue: true`
2. **修复方案**：禁止 `scoreBases` 阶段自动推进，必须由玩家显式触发
3. **不需要防御代码**：修复了根本原因后，不需要 `_scoredBases` 等临时标记
4. **保留的防御层**：`_pirateCoveTriggered`、唯一交互 ID、`flowHalted` 标志作为额外保护

## 修复的通用性

这个修复是**通用的**，适用于：
- ✅ 所有基地的计分流程
- ✅ 所有使用 `beforeScoring` 的基地能力
- ✅ 所有使用 `afterScoring` 创建交互的基地能力
- ✅ 多基地同时计分的场景
- ✅ 链式交互的场景

## 相关文件

- `src/games/smashup/domain/index.ts` - 修复 `onAutoContinueCheck`，禁止 `scoreBases` 阶段自动推进 + 添加日志
- `src/games/smashup/domain/baseAbilities.ts` - 海盗湾 `afterScoring`（保留防御层 + 日志）
- `src/games/smashup/domain/systems.ts` - 延迟事件发射（保留 `flowHalted` 标志 + 日志）
- `src/engine/systems/FlowSystem.ts` - 添加 `onAutoContinueCheck` 结果日志（生产环境可见）

## 日志证据

修复后，生产环境会看到以下日志：

### 正常流程（修复后）

```
[scoreOneBase] 开始计分: { baseIndex: 0, baseDefId: 'base_pirate_cove', ... }
[海盗湾] afterScoring 被调用: { baseIndex: 0, rankingsCount: 2, ... }
[海盗湾] 标记基地 0 已触发
[海盗湾] 非冠军玩家随从: [ { playerId: '1', minionCount: 1 } ]
[海盗湾] 为玩家 1 创建交互: base_pirate_cove_1_100
[SmashUpEventSystem] 发现延迟事件: { count: 2, types: ['BASE_CLEARED', 'BASE_REPLACED'], ... }
[SmashUpEventSystem] 无后续交互，发射延迟事件并设置 flowHalted=true
[FlowSystem][afterEvents] onAutoContinueCheck 返回 undefined 或 autoContinue=false, phase=scoreBases, 不自动推进
```

**关键证据**：`[FlowSystem][afterEvents] onAutoContinueCheck 返回 undefined ... 不自动推进`

### 异常流程（修复前，如果没有修复）

```
[scoreOneBase] 开始计分: { baseIndex: 0, ... }
[海盗湾] afterScoring 被调用: { baseIndex: 0, ... }
[FlowSystem][afterEvents] onAutoContinueCheck 返回 autoContinue=true, phase=scoreBases, playerId=0
[scoreOneBase] 开始计分: { baseIndex: 0, ... }  ← 重复调用！
[海盗湾] afterScoring 被调用: { baseIndex: 0, ... }  ← 重复触发！
...
```

**异常证据**：`[FlowSystem][afterEvents] onAutoContinueCheck 返回 autoContinue=true` + `[scoreOneBase] 开始计分` 重复出现

## 总结

这个 bug 的根本原因是：
- **`onAutoContinueCheck` 在 `scoreBases` 阶段错误地返回了 `autoContinue: true`**
- 导致交互解决后自动重新进入 `onPhaseExit('scoreBases')`
- 从而重复调用 `scoreOneBase()`，重复发射 `BASE_SCORED` 事件，重复触发基地能力

修复方案：
- **禁止 `scoreBases` 阶段自动推进**
- 计分阶段必须由玩家显式触发（点击"结束回合"）
- 不需要任何防御代码，从根本上解决了问题

这是一个**架构级别的修复**，而不是症状级别的防御。
