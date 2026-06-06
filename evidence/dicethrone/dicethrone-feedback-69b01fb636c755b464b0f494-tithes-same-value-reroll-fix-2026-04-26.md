# DiceThrone 反馈 69b01fb636c755b464b0f494 修复证据

> 2026-06-06 当前有效口径：本文只对应反馈 `69b01fb636c755b464b0f494` 这一条 `Paladin.tithes` 同值重掷历史修复证据，不是当前 DiceThrone 所有 reroll/confirm/reset 时序问题都已全面收口的证明，也不是新英雄补审出口。阅读时应把它当作单条反馈修复记录。

- 日期：2026-04-26
- 反馈 ID：`69b01fb636c755b464b0f494`
- 反馈原文：`重置前后一致，不止一次出现了`
- 游戏：`dicethrone`
- 本轮范围：`Paladin / tithes / 同值重掷后的状态重置链`

## 1. 线上实际观察

### 1.1 原始反馈记录（只读查询）
- 读取方式：SSH 到生产机后，只读查询 `boardgame-mongodb.feedbacks`。
- 反馈内 `actionLog` 关键片段：
  - `[21:41:14] 游客6847: 重投骰子 #2：2 → 2`
  - `[21:41:14] 游客6847: 消耗 1 CP（tithes）`
  - `[21:41:09] 游客6847: 重投骰子 #4：1 → 1`
  - `[21:41:09] 游客6847: 消耗 1 CP（tithes）`
- 反馈内 `stateSnapshot` 关键状态：
  - `phase=offensiveRoll`
  - `activePlayerId='1'`
  - `characterId='paladin'`
  - `rollCount=3`
  - `rollConfirmed=false`

### 1.2 实际观察结论
- 这条反馈对应的不是奖励骰，也不是改骰卡，而是 `Paladin.tithes` 的被动重掷。
- 线上至少两次出现“重掷后骰值完全没变”（`1 -> 1`、`2 -> 2`）。
- 旧实现里，只要 `DIE_REROLLED / DIE_MODIFIED` 来自当前 roller，就会无条件把 `rollConfirmed` 清回 `false`。
- 这意味着即使骰面语义完全没变，系统也会把这次操作当成一次有效“状态重置”，重新开放确认链路；这正是“重置前后一致”的具体异常。

## 2. 最小可复现

### 2.1 复现条件
- 角色：`paladin`
- 阶段：`offensiveRoll`
- 前置状态：
  - `rollCount=1`
  - `rollConfirmed=true`
  - `CP >= 1`
  - 存在可重掷骰子
- 操作：执行 `USE_PASSIVE_ABILITY`，参数：
  - `passiveId='tithes'`
  - `actionIndex=0`
  - `targetDieId=0`
- 随机结果：返回与原骰值相同的点数

### 2.2 修复前问题点
- 旧 reducer 对 `DIE_REROLLED / DIE_MODIFIED` 的处理是：
  - 只要操作者是当前 roller，且 `rollConfirmed=true`，就直接清成 `false`
  - 不区分“骰值有变化”还是“骰值没变化”
- 因此同值重掷会错误触发“确认态被清空”。

## 3. 修复方案

### 3.1 实现修复
- 文件：`src/games/dicethrone/domain/reducer.ts`
- 镜像同步：`e2e/src/games/dicethrone/domain/reducer.ts`
- 修复内容：
  - 为 `handleDieModified()` / `handleDieRerolled()` 增加 `didDieValueChange` 判断
  - 只有当当前骰子的值真的变化时，才允许把 `rollConfirmed` 从 `true` 清成 `false`
- 保留行为：
  - 同值重掷仍然会正常消耗 CP、记录日志、保留事件
  - 异值重掷仍然会触发原有的确认态重置

### 3.2 回归测试
- 文件：`src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`
- 镜像同步：`e2e/src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`
- 新增用例：
  - `教皇税同值重掷不应清掉已确认骰面`
  - `教皇税异值重掷仍应清掉已确认骰面`

## 4. 验证结果

### 4.1 已运行命令
1. `npx vitest run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts -t '教皇税同值重掷不应清掉已确认骰面|教皇税异值重掷仍应清掉已确认骰面'`
2. `npx vitest run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`

### 4.2 通过结果
- 命令 1：`1 passed`，命中新增的 2 条回归用例，均通过。
- 命令 2：`82 passed`，整份 `basic-commands-coverage` 文件通过。

### 4.3 未运行项
- 本轮未跑浏览器 E2E。
- 原因：该反馈对应的是领域状态重置链，不是 UI 展示或交互浮层错位问题；本轮收口依据是线上 actionLog + 领域回归测试。
- 说明：`e2e/src/**` 镜像测试文件已同步修改，但它不在当前 Vitest include 范围内，直接运行会返回 `No test files found`，因此不计入通过结果。

## 5. 是否达标

### 5.1 我实际看到什么
- 线上反馈明确显示：用户在 `tithes` 重掷时，至少两次遇到“骰值前后相同”。
- 旧代码会把这种“同值重掷”也当成一次有效状态变化，错误清掉 `rollConfirmed`。
- 修复后，新增回归证明：
  - 同值重掷后 `rollConfirmed` 保持 `true`
  - 异值重掷后 `rollConfirmed` 仍会变回 `false`

### 5.2 是否达到本轮验收标准
- 达到。
- 原因：
  - 已定位到具体异常链路：`tithes -> DIE_REROLLED -> reducer 无条件清 confirmed`
  - 已做最小实现修复，而不是只改测试或只改状态注入
  - 已补现有测试文件回归并实际运行通过

## 6. 结论
- 这条反馈可按“已修复”处理。
- 建议状态：`resolved`
- 依据：同值重掷不再触发无意义的确认态重置，且现有相关命令覆盖测试已全绿。

---

**当前阅读说明**：本文只能证明 `tithes` 同值重掷导致确认态重置这条专项问题曾被修复，不能外推为当前所有 reroll 语义、所有 `rollConfirmed` 时序或 DiceThrone 当前整体审计都已收口。
