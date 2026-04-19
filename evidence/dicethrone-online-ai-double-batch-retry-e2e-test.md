# DiceThrone 在线 AI 双重 batch 拒绝后自动重试 E2E 证据

## 目标

- 验证在线房间里，AI seat 持有仅自己可见的 `multistep-choice` 时：
  - 前两轮 `sendBatch(...)` 都被拒绝后，仍不会出现半提交；
  - 在线 AI 会继续释放 attemptKey 并进入第三轮重试；
  - 第三轮 retry 成功后，权威状态与房主过滤视角都会解除阻塞。

## 用例

- 测试文件：`e2e/dicethrone-simple-start.e2e.ts`
- 用例名：`Online AI 连续两轮 batch 被拒后仍应自动重试并完成隐藏 multistep-choice`
- 运行命令：

```bash
BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online AI 连续两轮 batch 被拒后仍应自动重试并完成隐藏 multistep-choice"
```

## 截图

### 1. 连续两轮被拒后、第三轮重试前

![before-third-attempt](../test-results/evidence-screenshots/dicethrone-simple-start.e2e/Online-AI-连续两轮-batch-被拒后仍应自动重试并完成隐藏-multistep-choice/17-online-ai-hidden-multistep-rejected-twice-before-retry.png)

- 左侧阶段条仍停在 `4. 强掷攻击阶段`，说明两次拒绝都发生在同一条真实对局链里。
- 右侧骰列依旧保留旧结果，没有出现“第一轮拒绝后落一颗、第二轮再落一颗”的半提交状态。
- 房主界面没有选择框、确认弹层或异常遮罩，说明多轮拒绝也没有把 AI 私有交互错误转交给人类。

### 2. 第三轮重试成功后

![after-third-attempt](../test-results/evidence-screenshots/dicethrone-simple-start.e2e/Online-AI-连续两轮-batch-被拒后仍应自动重试并完成隐藏-multistep-choice/18-online-ai-hidden-multistep-after-third-attempt.png)

- 房主界面仍然没有出现 AI 私有交互 UI，说明第三轮成功也没有发生“失败过两次就转人工”的降级路径。
- 右侧骰列已经明显不再是前一张图的旧结果，可见第三轮 retry 确实推动了骰面更新。
- 右下角保持正常战斗 HUD，没有断线层、错误 toast 或卡死遮挡层，说明房主过滤视角已恢复可交互。

## 关键状态断言

### 连续两轮被拒后

- 测试补丁状态：
  - `rejectLimit === 2`
  - `rejectedCount === 2`
  - `delegatedCount === 0`
- 服务端原始状态：
  - `sys.interaction.current.kind === 'multistep-choice'`
  - `sys.interaction.current.playerId === '1'`
  - `core.dice.slice(0, 2).map(v) === [1, 2]`
- 房主过滤视角：
  - `sys.interaction.current === null/undefined`
  - `sys.interaction.isBlocked === true`
  - `core.dice.slice(0, 2).map(v) === [1, 2]`

### 第三轮重试成功后

- 测试补丁状态：
  - `rejectLimit === 2`
  - `rejectedCount === 2`
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

- 这条 E2E 已补上“连续两轮 `batch:rejected` 后仍能自动 retry 成功”的真实联机证据。
- 当前可以确认：
  - 多轮拒绝下，隐藏多步交互仍不会被推进到半完成状态；
  - attemptKey 不会因为重复拒绝而永久锁死；
  - 第三轮成功时，交互仍会以 `2 次 MODIFY_DIE + 1 次 SYS_INTERACTION_CONFIRM` 的完整 batch 收口。
