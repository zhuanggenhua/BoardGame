# 线上反馈收口证据（2026-09-04）

## 本轮口径

- 处理口径：线上真实反馈。
- 真实读取入口：`https://api.easyboardgame.top/admin-api/feedback`。
- 真实写回入口：项目反馈状态脚本在无管理 token 时使用生产 Mongo SSH 写入口。
- 本地镜像：`temp/feedback-closeout/status-board.json`，只作为线上状态镜像，不是正式源。

## 线上读取

- 首次抓取：北京时间 2026-09-04 08:22:05，`open=4`，`in_progress=0`，归并为 4 个代表项。
- 接手后复查：北京时间 2026-09-04 08:35:31，`open=0`，`in_progress=4`，归并为 4 个代表项。
- 诊断包目录：
  - `temp/feedback-closeout/online-20260904-082153/`
  - `temp/feedback-closeout/online-20260904-continue-check/`

## 反馈逐条结论

### 6a98e4b59f15a22949111bfd

- 游戏：DiceThrone。
- 反馈原文：`[system][online-ai-watchdog] force-end-turn-failed visible-interaction:recover-interaction:legal_action_command_failed`
- 现实含义：线上 AI 自动检测到一个由卡牌“转移状态”造成的可见交互卡住；系统尝试按合法动作恢复时，某个合法动作执行失败。
- 原始对局：`4QIzKTOoK3L`。
- 当前证据：生产 Mongo 中已查不到该对局，不能回放原始现场；当前代码已补“AI 枚举出的转移状态动作可以真实执行并关闭交互”的回归测试。
- 处理结论：按“生产现场已失效 + 当前树已补同类链路回归”关闭；不声称原始事故根因已完整定位。

### 6a98e4b69f15a22949111c05

- 游戏：DiceThrone。
- 反馈原文：`[system][online-ai-watchdog] repeated-recovery-force-unblocked visible-interaction:repeat-limit-force-unblock:3/3:commands=SYS_INTERACTION_CANCEL+ADVANCE_PHASE`
- 现实含义：同一类线上 AI 卡住恢复连续触发到上限，系统最后用取消交互和推进阶段的方式强制恢复。
- 原始对局：`4QIzKTOoK3L`。
- 当前证据：生产 Mongo 中已查不到该对局，不能回放原始现场；watchdog 合法动作切换和后续恢复相关回归通过。
- 处理结论：按同组生产现场已失效关闭；不声称原始事故根因已完整定位。

### 6a991bdb9f15a22949111d9c

- 游戏：Summoner Wars。
- 反馈原文：`[auto][window.error] ResizeObserver loop completed with undelivered notifications.`
- 现实含义：浏览器布局观察器发出的循环通知噪声；反馈包没有玩家文字、业务堆栈或可见规则错误。
- 原始对局：`MLhqCtJhM6H`。
- 当前证据：生产 Mongo 中已查不到该对局；当前代码已在客户端自动反馈入口加入这两类精确 ResizeObserver 循环通知过滤，随下一次发布后同类噪声不会自动入库。
- 处理结论：按浏览器噪声关闭；这是降噪收口，不是游戏规则 bug 根因修复，也不代表本轮已经完成部署。

### 6a996d829f15a2294911238a

- 游戏：DiceThrone。
- 反馈原文：`太卡了`
- 现实含义：玩家体验 / 性能反馈，只有一句主观卡顿描述。
- 原始对局：`sVJ2TR0PbjV`。
- 当前证据：生产 Mongo 中已查不到该对局；反馈包无截图、无性能 trace、无 FPS / 长任务 / DOM 数等指标。
- 处理结论：保留 `in_progress`，等待性能专项复测或用户决定是否关闭；不能凭一句“太卡了”自动改默认性能策略或宣称已修复。

## 本轮代码改动

- `src/lib/feedback/clientAutoReport.ts`：新增精确过滤，只在客户端窗口错误自动反馈里过滤 ResizeObserver 循环通知。
- `src/lib/__tests__/clientAutoReport.test.ts`：新增自动反馈过滤回归。
- `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`：新增 DiceThrone 线上反馈 `6a98e4b5` 对应的 `TRANSFER_STATUS` 合法动作闭环回归。

## 验证

- 生产原始对局回查：
  - 命令：`Get-Content temp/feedback-closeout/read-production-match-summary-20260904.js | ssh admin@8.148.71.102 "docker exec -i boardgame-mongodb mongosh boardgame --quiet"`
  - 结果：`[]`
- 关联测试：
  - 命令：`node scripts/infra/vitest-cli-safe.mjs run src/lib/__tests__/clientAutoReport.test.ts src/games/dicethrone/__tests__/basic-commands-coverage.test.ts src/engine/transport/__tests__/onlineAiWatchdogLegalOnlyIncidentTransition.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 结果：3 个测试文件通过，205 个测试通过。

## 实际状态回写

- 北京时间 2026-09-04 08:40:18：`6a98e4b59f15a22949111bfd` 已通过生产 Mongo SSH 写回 `closed`。
- 北京时间 2026-09-04 08:40:41：`6a98e4b69f15a22949111c05` 已通过生产 Mongo SSH 写回 `closed`。
- 北京时间 2026-09-04 08:44:52：`6a991bdb9f15a22949111d9c` 已通过生产 Mongo SSH 写回 `closed`，关闭理由已注明代码改动随下一次发布生效。
- `6a996d829f15a2294911238a` 保留 `in_progress`，本地镜像已同步为接手中。

## 最终回查

- 北京时间 2026-09-04 08:45:31，线上 `open=0`，`in_progress=1`，剩余项只有 `6a996d829f15a2294911238a`。
- 生产精确状态回读：
  - `6a98e4b59f15a22949111bfd`：`closed`
  - `6a98e4b69f15a22949111c05`：`closed`
  - `6a991bdb9f15a22949111d9c`：`closed`
  - `6a996d829f15a2294911238a`：`in_progress`
- 本地镜像 `temp/feedback-closeout/status-board.json` 已对齐以上四条状态，并保留本文件作为证据。
