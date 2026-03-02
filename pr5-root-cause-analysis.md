# PR #5 根因分析报告

## 📊 问题概览

**当前状态**: 79 个失败测试（97.8% 通过率）
**初始状态**: 20 个失败测试（99.35% 通过率）
**问题加剧**: 失败测试数量增加了 **4倍**

## 🔍 根本原因分析

### 1. PR #5 的核心变更

PR #5 (commit `14670cb`) 合并了 POD 派系支持，主要变更包括：

#### 1.1 删除了 `addPermanentPower` 函数
```typescript
// ❌ 被删除的函数（在 abilityHelpers.ts 中）
export function addPermanentPower(
    minionUid: string,
    baseIndex: number,
    amount: number,
    reason: string,
    now: number
): PermanentPowerAddedEvent {
    return {
        type: SU_EVENTS.PERMANENT_POWER_ADDED,
        payload: { minionUid, baseIndex, amount, reason },
        timestamp: now,
    };
}
```

**影响**: 所有使用 `addPermanentPower` 的能力都失效了，但测试期望它们仍然工作。

#### 1.2 修改了 `robot_microbot_archive` 的逻辑
```typescript
// ❌ PR #5 删除了关键的检查逻辑
-        // "你的"微型机 — 被消灭随从必须属于 archive 控制者
-        if (trigCtx.playerId !== archiveOwner) return [];
-
-        // 判断被消灭的随从是否算微型机
-        const isOriginalMicrobot = MICROBOT_DEF_IDS.has(trigCtx.triggerMinionDefId);
-        if (!isOriginalMicrobot) {
-            // 非原始微型机 defId → 检查 alpha 联动
-            const alphaOnField = trigCtx.state.bases.some(base =>
-                base.minions.some(m => m.defId === 'robot_microbot_alpha' && m.controller === archiveOwner)
-            );
-            if (!alphaOnField) return [];
-        }
```

**影响**: 档案馆的触发逻辑被简化，可能导致不正确的触发。

#### 1.3 添加了大量 POD 派系文件
- 21 个新派系文件（`aliens_pod`, `bear_cavalry_pod`, `cthulhu_pod` 等）
- 新增 `SmashUpCardRenderer` 和 `SmashUpOverlayContext` UI 组件
- 英文图集映射（`englishAtlasMap.json`）

**影响**: 新增了大量未经测试的代码，引入了新的 bug。

### 2. 为什么失败测试数量增加了？

#### 2.1 POD 派系的 ongoing trigger 未正确实现
**失败测试**: 约 50+ 个 `ongoingMinionTriggerAudit.test.ts` 测试

**根因**: POD 派系的 ongoing 卡（如 `ghost_incorporeal_pod`, `elder_thing_dunwich_horror_pod` 等）注册了 `onTurnStart` trigger，但 trigger 回调函数错误地在 `base.ongoingActions` 中查找自己，而不是在 `attachedActions` 中查找。

**示例错误**:
```
AssertionError: [ghost_incorporeal_pod] 注册了 onTurnStart trigger，
但牌在 attachedActions 上时未产生事件。
可能是 trigger 回调错误地在 base.ongoingActions 中查找。
expected 0 to be greater than 0
```

**修复方向**: 检查所有 POD 派系的 trigger 实现，确保它们正确地在 `attachedActions` 中查找自己。

#### 2.2 `robot_microbot_fixer` 和 `robot_microbot_reclaimer` 的额外随从限制未生效
**失败测试**: 2 个测试

**根因**: `grantExtraMinion` 生成的 `LIMIT_MODIFIED` 事件未被正确 reduce 到最终状态。

**调试日志**:
```
[robotMicrobotFixer] minionsPlayed: 1, minionLimit: 1
[robotMicrobotFixer] triggering grantExtraMinion
[postProcessSystemEvents] fireMinionPlayedTriggers returned: {
  defId: 'robot_microbot_fixer',
  eventsCount: 1,
  eventTypes: ['LIMIT_MODIFIED'],
  minionsPlayed: 1
}
```

**问题**: 事件被生成了，但 `minionLimit` 没有从 1 增加到 2。

**可能原因**:
1. `postProcessSystemEvents` 返回的事件没有被 `executePipeline` 正确 reduce
2. `LIMIT_MODIFIED` 事件的 reduce 逻辑有问题
3. 事件被生成后又被某个地方过滤掉了

#### 2.3 `robot_hoverbot` 的牌库顶检查失效
**失败测试**: 2 个测试

**根因**: PR #5 修改了 `postProcessSystemEvents` 的逻辑，在 `fireMinionPlayedTriggers` 之前先 reduce 了 `MINION_PLAYED` 事件，导致牌库顶检查时看到的是更新后的牌库（已经抽走了牌库顶的卡）。

**修复前的逻辑**:
```typescript
// 【修复】先 reduce 当前 MINION_PLAYED 事件，再触发 onPlay
// 这样 onPlay 能力（如盘旋机器人）能看到更新后的牌库顶
tempCore = reduce(tempCore, event);

const triggers = fireMinionPlayedTriggers({
    core: tempCore,  // ❌ 牌库已经更新，牌库顶已经变了
    ...
});
```

**问题**: 盘旋机器人的 onPlay 能力需要检查"打出这张牌之前"的牌库顶，但现在看到的是"打出这张牌之后"的牌库顶。

### 3. 为什么 PR #5 会把本地修改标记为删除？

**答案**: 这是 Git 合并冲突的正常行为。

#### 3.1 合并策略
PR #5 的合并提交信息显示：
```
冲突解决策略：
- 保留本地的核心 bug 修复（海盗王重复触发、MINION_PLAYED 去重、计分流程优化）
- 接受 PR 的新增文件和功能
- 国际化文件保留本地版本（POD factions 会有自己的 i18n key）
```

#### 3.2 实际发生的事情
1. **本地分支** (e0bfb32) 有一些 bug 修复和优化
2. **PR #5 分支** (6ea1f9f) 基于更早的提交，没有这些修复
3. **合并时** Git 发现两个分支修改了同一个文件的同一部分
4. **冲突解决** 选择了 PR #5 的版本（因为它有更多新功能），导致本地修复被覆盖

#### 3.3 被覆盖的关键修复
- `addPermanentPower` 函数被删除（本地可能有使用它的代码）
- `robot_microbot_archive` 的检查逻辑被简化（本地可能有更严格的检查）
- `postProcessSystemEvents` 的 reduce 时机被修改（本地可能有不同的实现）

## 🎯 问题分类

### A. POD 派系相关问题（约 50+ 个失败测试）
**根因**: POD 派系代码质量不高，未经充分测试就合并了。

**具体问题**:
1. Ongoing trigger 回调函数错误地在 `base.ongoingActions` 中查找自己
2. 应该在 `attachedActions` 中查找（因为 `ongoingTarget: 'minion'`）

**修复方向**:
1. 检查所有 POD 派系的 `registerTrigger` 调用
2. 确保 trigger 回调函数正确地在 `attachedActions` 中查找
3. 参考非 POD 派系的正确实现

### B. 引擎层问题（约 20+ 个失败测试）
**根因**: PR #5 修改了 `postProcessSystemEvents` 的逻辑，破坏了事件处理的时序。

**具体问题**:
1. `LIMIT_MODIFIED` 事件未被正确 reduce
2. `robot_hoverbot` 的牌库顶检查失效（看到的是更新后的牌库）
3. 其他依赖事件处理时序的能力可能也受影响

**修复方向**:
1. 回滚 `postProcessSystemEvents` 中的 reduce 时机修改
2. 或者修改 `robot_hoverbot` 的实现，使其不依赖牌库顶检查
3. 确保 `LIMIT_MODIFIED` 事件被正确 reduce

### C. 数据一致性问题（约 10 个失败测试）
**根因**: PR #5 删除了 `addPermanentPower` 函数，但没有更新所有使用它的代码。

**具体问题**:
1. `innsmouth_the_deep_ones` 使用了 `addTempPower`，但测试期望 `TEMP_POWER_ADDED` 事件
2. 其他能力可能也有类似问题

**修复方向**:
1. 搜索所有使用 `addPermanentPower` 的代码
2. 替换为 `addTempPower` 或其他合适的函数
3. 更新测试期望

## 📝 修复优先级

### 优先级 1: POD 派系 ongoing trigger（约 50+ 个失败测试）
**原因**: 这是最大的问题集群，修复后可以大幅提升通过率。

**修复步骤**:
1. 列出所有失败的 POD 派系 ongoing 卡
2. 检查它们的 trigger 实现
3. 修改 trigger 回调函数，使其在 `attachedActions` 中查找自己
4. 运行测试验证

### 优先级 2: 引擎层事件处理时序（约 20+ 个失败测试）
**原因**: 这是核心问题，影响多个派系的能力。

**修复步骤**:
1. 分析 `postProcessSystemEvents` 的 reduce 时机
2. 确定是回滚修改还是调整能力实现
3. 修复 `LIMIT_MODIFIED` 事件未被 reduce 的问题
4. 修复 `robot_hoverbot` 的牌库顶检查
5. 运行测试验证

### 优先级 3: 数据一致性（约 10 个失败测试）
**原因**: 这是局部问题，影响范围较小。

**修复步骤**:
1. 搜索所有使用 `addPermanentPower` 的代码
2. 替换为合适的函数
3. 更新测试期望
4. 运行测试验证

## 🔧 修复策略

### 策略 A: 渐进式修复（推荐）
1. 先修复 POD 派系 ongoing trigger（优先级 1）
2. 再修复引擎层事件处理时序（优先级 2）
3. 最后修复数据一致性（优先级 3）
4. 每修复一个优先级后运行测试，确认进展

### 策略 B: 回滚 PR #5（激进）
1. 回滚整个 PR #5 合并
2. 重新审查 POD 派系代码
3. 修复所有问题后再次合并
4. 风险：会丢失 PR #5 的所有新功能

### 策略 C: 部分回滚（折中）
1. 保留 POD 派系的数据文件（factions/*.ts）
2. 回滚 `postProcessSystemEvents` 的修改
3. 回滚 `robot_microbot_archive` 的简化
4. 修复 POD 派系的 trigger 实现
5. 重新测试

## 📊 预期修复效果

| 优先级 | 修复内容 | 预期减少失败数 | 预期通过率 |
|--------|----------|----------------|------------|
| 当前 | - | 79 失败 | 97.8% |
| 优先级 1 | POD trigger | -50 | 99.3% |
| 优先级 2 | 引擎时序 | -20 | 99.8% |
| 优先级 3 | 数据一致性 | -9 | 100% |

## 🎯 结论

1. **PR #5 引入的问题远多于解决的问题**
   - 新增了 50+ 个 POD 派系相关的失败测试
   - 破坏了引擎层的事件处理时序
   - 删除了关键函数但没有更新所有使用它的代码

2. **当前问题与 POD 高度相关**
   - 约 70% 的失败测试直接由 POD 派系代码引起
   - 约 25% 的失败测试由引擎层修改引起
   - 约 5% 的失败测试由数据一致性问题引起

3. **修复路径清晰**
   - 优先修复 POD 派系 ongoing trigger（最大收益）
   - 然后修复引擎层事件处理时序（核心问题）
   - 最后修复数据一致性（局部问题）

4. **建议采用策略 A（渐进式修复）**
   - 风险最小
   - 可以保留 PR #5 的新功能
   - 每一步都有明确的验证点
