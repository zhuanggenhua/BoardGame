# DiceThrone 在线 AI batch 拒绝后自动重试 E2E 证据

## 目标

- 验证在线房间里，AI seat 持有仅自己可见的 `multistep-choice` 时：
  - 首轮 `sendBatch(...)` 被拒绝后，不会产生半提交状态；
  - 在线 AI 会清空 attemptKey 并自动重试；
  - retry 成功后，权威状态与房主过滤视角都会解除阻塞。

## 用例

- 测试文件：`e2e/dicethrone-simple-start.e2e.ts`
- 用例名：`Online AI 首轮 batch 被拒后应自动重试并完成隐藏 multistep-choice`
- 运行命令：

```bash
BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online AI 首轮 batch 被拒后应自动重试并完成隐藏 multistep-choice"
```

## 截图

### 1. 首轮被拒后、重试前

![before-retry](../test-results/evidence-screenshots/dicethrone-simple-start.e2e/Online-AI-首轮-batch-被拒后应自动重试并完成隐藏-multistep-choice/15-online-ai-hidden-multistep-rejected-before-retry.png)

- 左侧阶段条仍停在 `4. 强掷攻击阶段`，说明这是同一局内的中间态，不是页面重载或房间重建。
- 右侧前两颗骰子仍是 `1`、`2`，没有出现“第一颗已改、第二颗没改”的半提交痕迹。
- 房主界面依旧没有任何选择框、确认按钮或遮罩层，说明被拒的那轮 batch 没有把 AI 私有交互错误泄漏给人类。

### 2. 自动重试成功后

![after-retry](../test-results/evidence-screenshots/dicethrone-simple-start.e2e/Online-AI-首轮-batch-被拒后应自动重试并完成隐藏-multistep-choice/16-online-ai-hidden-multistep-after-retry.png)

- 房主界面仍没有出现 AI 私有交互 UI，说明 retry 成功后也没有发生“失败转人工”的降级。
- 右侧前两颗骰面已经明显不再是重试前的旧结果，可见 retry 确实推动了骰面更新，而不是只把 `isBlocked` 清掉。
- 右下角仍是正常主战斗 HUD，没有错误 toast、断线蒙层或卡死遮挡层，说明房主过滤视角已恢复可交互。

## 关键状态断言

### 首轮被拒后

- 测试补丁状态：
  - `rejectedCount === 1`
  - `delegatedCount === 0`
- 服务端原始状态：
  - `sys.interaction.current.kind === 'multistep-choice'`
  - `sys.interaction.current.playerId === '1'`
  - `core.dice.slice(0, 2).map(v) === [1, 2]`
- 房主过滤视角：
  - `sys.interaction.current === null/undefined`
  - `sys.interaction.isBlocked === true`
  - `core.dice.slice(0, 2).map(v) === [1, 2]`

### 自动重试成功后

- 测试补丁状态：
  - `rejectedCount === 1`
  - `delegatedCount === 1`
  - `lastCommandCount === 3`
- 服务端原始状态：
  - `sys.interaction.current === null/undefined`
  - `core.dice.slice(0, 2).map(v) === [6, 6]`
- 房主过滤视角：
  - `sys.interaction.current === null/undefined`
  - `sys.interaction.isBlocked === false`
  - `core.dice.slice(0, 2).map(v) === [6, 6]`

## 结论

- 这条 E2E 已补上“在线 AI 首轮 batch 被拒后自动 retry”的真实联机证据。
- 当前可以确认：
  - `batch:rejected` 不会把隐藏多步交互推进到半完成状态；
  - attemptKey 会在拒绝后被释放，AI 会再次提交；
  - retry 成功后，交互会以 `2 次 MODIFY_DIE + 1 次 SYS_INTERACTION_CONFIRM` 的完整 batch 收口，而不是继续卡在选择阶段。
