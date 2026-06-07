# 自动反馈错标用户单与剩余 watchdog 收口（2026-06-06）

## 范围

- 生产真源：`boardgame.feedbacks`
- 本轮处理对象分两组：
  - 历史错标成 `reporterType=user` 的自动反馈 11 条
  - 仍处于 `reporterType=system` 且 `status=open` 的 watchdog 2 条

## 回写前生产真相

### 1. `reporterType=user` 的未收口项

- 共 `11` 条
- 全部不是 `feedback-modal` 人工直报，而是自动反馈源：
  - `client-window-error`
  - `client-unhandled-rejection`
- 明细：
  - `6a2371125ea63084e89bc7f0` `dicethrone` `[auto][window.error] Maximum call stack size exceeded`
  - `6a2351975ea63084e89bc777` `dicethrone` `[auto][window.error] Maximum call stack size exceeded`
  - `6a22fd085ea63084e89bc731` `dicethrone` `[auto][window.error] Maximum call stack size exceeded`
  - `6a22ec7a5ea63084e89bc684` `dicethrone` `[auto][window.error] Maximum call stack size exceeded`
  - `6a22ba6b7d14bb74e821519c` `client` `[auto][unhandledrejection] "App" plugin is not implemented on android`
  - `6a22ba6b7d14bb74e821519a` `client` `[auto][unhandledrejection] "CapacitorUpdater" plugin is not implemented on android`
  - `6a2229c77d14bb74e8214d92` `client` `[auto][window.error] Maximum call stack size exceeded`
  - `6a2181087d14bb74e8214cd4` `client` `[auto][window.error] Cannot read properties of undefined (reading 'logout')`
  - `6a21516d7d14bb74e8214c6c` `dicethrone` `[auto][window.error] LIDNotifyId is not defined`
  - `6a214e277d14bb74e8214bf7` `client` `[auto][window.error] LIDNotifyId is not defined`
  - `6a2149ad7d14bb74e8214bd1` `client` `[auto][window.error] LIDNotifyId is not defined`

### 2. `reporterType=system` 的剩余未收口项

- 共 `2` 条
- 明细：
  - `6a22f0005ea63084e89bc6a3`
    - `dicethrone`
    - `[system][online-ai-watchdog] force-end-turn-failed visible-interaction:recover-interaction:legal_action_command_failed:ADVANCE_PHASE:请先完成当前交互`
  - `6a22e9d95ea63084e89bc666`
    - `smashup`
    - `[system][online-ai-watchdog] force-end-turn-failed visible-interaction:recover-interaction:legal_action_command_failed:SYS_INTERACTION_RESPOND:无效的选择`

## 当前树归类

### A. Howler BGM 递归崩溃，按 `resolved`

- 目标：
  - `6a2371125ea63084e89bc7f0`
  - `6a2351975ea63084e89bc777`
  - `6a22fd085ea63084e89bc731`
  - `6a22ec7a5ea63084e89bc684`
  - `6a2229c77d14bb74e8214d92`
- 归因：
  - 与 `evidence/feedback-closeout/howler-bgm-recursion-closeout-2026-06-04.md` 同根因
  - 共享音频层 `html5` BGM 使用 Howler 内建 `loop: true` 时，异常媒体状态下会形成 `_ended -> play` 递归
- 结论：
  - 当前 worktree 已覆盖该共享真 bug
  - 这 5 条只是 2026-06-05/06 在旧生产代码窗口继续冒出的历史单
  - 状态应为 `resolved`
  - 同时把 `reporterType` 正式归一化为 `system`

### B. Android 旧壳缺插件降级，按 `resolved`

- 目标：
  - `6a22ba6b7d14bb74e821519c`
  - `6a22ba6b7d14bb74e821519a`
- 归因：
  - 与 `evidence/feedback-closeout/client-auto-feedback-noise-and-android-plugin-closeout-2026-06-04.md` 同根因
  - 旧 Android 壳缺少 `App` / `CapacitorUpdater` 原生实现时，桥接层未做静默降级
- 结论：
  - 当前 worktree 已完成缺插件降级
  - 这 2 条不是新的业务逻辑 bug
  - 状态应为 `resolved`
  - 同时把 `reporterType` 正式归一化为 `system`

### C. 匿名页面顶层注入噪音，按 `closed`

- 目标：
  - `6a2181087d14bb74e8214cd4`
  - `6a21516d7d14bb74e8214c6c`
  - `6a214e277d14bb74e8214bf7`
  - `6a2149ad7d14bb74e8214bd1`
- 归因：
  - 当前 `src/lib/feedback/clientAutoReport.ts` 已把这两类统一识别为匿名页面级注入噪音：
    - `LIDNotifyId is not defined`
    - `Cannot read properties of undefined (reading 'logout')`
  - 对应回归在 `src/lib/__tests__/clientAutoReport.test.ts`
- 结论：
  - 这 4 条不是站内真实业务堆栈
  - 不应继续占据任何用户反馈或系统 bug 队列
  - 状态应为 `closed`
  - 同时把 `reporterType` 正式归一化为 `system`

### D. 剩余 2 条 watchdog，按 `resolved`

- `6a22f0005ea63084e89bc6a3`
  - 当前归因仍是 DiceThrone `dt:defender-choice` 恢复态噪音，不是新的选目标活 bug
  - 对位证据沿用 `evidence/feedback-closeout/system-auto-feedback-closeout-2026-06-04-remaining-watchdogs.md`
- `6a22e9d95ea63084e89bc666`
  - 当前归因仍是 visible `simple-choice` 语义已漂移但旧 watchdog 进度判定未识别新 prompt 的 shared transport seam
  - 对位证据沿用：
    - `evidence/feedback-closeout/system-auto-feedback-closeout-2026-06-04-remaining-watchdogs.md`
    - `evidence/smashup/smashup-feedback-6a2013a1-action-counter-watchdog-closeout-2026-06-04.md`
- 结论：
  - 这 2 条都不是当前树仍未修复的活缺口
  - 状态应为 `resolved`

## 本轮本地验证

### 1. 自动噪音过滤

命令：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/lib/__tests__/clientAutoReport.test.ts src/lib/audio/__tests__/audioManager.test.ts src/lib/audio/__tests__/useGameAudio.test.ts --config vitest.config.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1
```

结果：

- `clientAutoReport.test.ts` 定向 4 条通过
- `audioManager.test.ts` `6 passed`
- `useGameAudio.test.ts` `2 passed`

### 2. 剩余 watchdog seam

命令：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --config vitest.config.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --testNamePattern "dt:defender-choice 已经是 0 个目标的恢复态时，不应再持久化系统反馈|online AI watchdog 在 visible simple-choice 的 option value 漂移但 progress marker 未变时，应继续沿新 prompt 收口而不是上报 no_progress"
```

结果：

- `2 passed`

### 3. 验证时补的一处测试基线对齐

- 文件：`src/engine/transport/__tests__/server.test.ts`
- 调整：
  - 给 `createEngineConfigWithId('dicethrone')` 补回真实 `onlineAiRecovery.shouldSuppressUnsatisfiableInteractionFeedback`
- 原因：
  - 这是测试 helper 漏同步真实引擎配置，不是本轮新改业务逻辑
  - 不补这段，本地会把已被 suppress 的 `dt:defender-choice` 恢复态噪音误判成仍会持久化

## 本轮线上回写目标

### `resolved`

- `6a2371125ea63084e89bc7f0`
- `6a2351975ea63084e89bc777`
- `6a22fd085ea63084e89bc731`
- `6a22ec7a5ea63084e89bc684`
- `6a22ba6b7d14bb74e821519c`
- `6a22ba6b7d14bb74e821519a`
- `6a2229c77d14bb74e8214d92`
- `6a22f0005ea63084e89bc6a3`
- `6a22e9d95ea63084e89bc666`

### `closed`

- `6a2181087d14bb74e8214cd4`
- `6a21516d7d14bb74e8214c6c`
- `6a214e277d14bb74e8214bf7`
- `6a2149ad7d14bb74e8214bd1`

### `reporterType`

- 上述前 11 条历史错标自动反馈统一从 `user` 归一化为 `system`

## 预期回写后结果

- 生产 `reporterType=user AND status in ['open','in_progress']` 应为 `0`
- 生产 `reporterType=system AND status in ['open','in_progress']` 应为 `0`
- 用户筛选“用户反馈”时，不应再看到这批自动反馈残余

## 实际回写结果

- 正式回写脚本：
  - `temp/feedback-closeout/update-feedback-status-20260606-auto-user-mislabels-and-watchdogs.js`
- 正式回写时间：
  - `2026-06-06 11:10 +08:00`
- 实际结果：
  - 13 条全部 `matchedCount=1`
  - 13 条全部 `modifiedCount=1`

## 回写后复核

### 1. 单条抽样

- `6a2371125ea63084e89bc7f0`
  - `status=resolved`
  - `reporterType=system`
- `6a22f0005ea63084e89bc6a3`
  - `status=resolved`
  - `reporterType=system`

### 2. 队列余量

- 生产 `reporterType=user AND status=open`：`0`
- 生产 `reporterType=user AND status=in_progress`：`0`
- 生产 `reporterType=system AND status=open`：`0`
- 生产 `reporterType=system AND status=in_progress`：`0`

### 3. 本地台账

- `temp/feedback-closeout/status-board.json`
  - 已补入这 13 条
- 校验：
  - `node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json`
  - 结果：`feedback-status: ok`

## 最终结论

- 当前线上未收口的人类反馈已保持 `0`
- 本轮新增把 11 条历史错标自动反馈正式从 `user` 归一化为 `system`
- 剩余 2 条 `system open` watchdog 也已按当前树证据正式推进 `resolved`
- 回写后，生产 `open / in_progress` 在这两条主口径下都已清零
