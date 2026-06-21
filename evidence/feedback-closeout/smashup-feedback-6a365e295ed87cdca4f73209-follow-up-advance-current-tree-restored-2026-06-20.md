# SmashUp 线上反馈 6a365e295ed87cdca4f73209 当前树核对

- 时间：2026-06-20
- 来源口径：线上真实反馈诊断包 `temp/feedback-closeout/2026-06-20T10-02-27-163Z/6a365e295ed87cdca4f73209.md`
- 反馈含义：watchdog 在大杀四方 `scoreBases` 阶段恢复交互后，只剩自然过阶段时仍记成 `follow-up-advance:no_progress`。

## 本轮结论

- 归类：当前树已恢复
- 现实含义：当前 transport/watchdog 链已经能在“只剩 `ADVANCE_PHASE`”的现场继续补最后一步，不再把这种 legal-only 现场误记成 no_progress。

## 证据

- 历史收口文档：
  - `evidence/feedback-closeout/smashup-watchdog-follow-up-advance-no-progress-current-production-restored-2026-06-18.md`
- 本轮复核命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 -t "online AI watchdog 在交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE 而不是把 legal-only 当失败|smashup 持久化 stale reaction choice 走 watchdog 恢复时，不应落成 blocker_persisted"`
- 结果：
  - 通过
  - 说明当前树下 watchdog 已覆盖这类 follow-up 收口场景

## 说明

- 本轮未新增 SmashUp 业务代码修改来处理这组 no_progress。
- 结论是：这条代表项属于旧现场/旧部署阶段残留的系统反馈，当前树对应链路已恢复。
