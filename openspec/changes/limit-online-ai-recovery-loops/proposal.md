# Change: Limit repeated online AI recovery loops

## Why

线上 AI 自动恢复曾在同一对局、同一玩家、同一交互来源上反复恢复但没有真正推进，导致 game-server CPU 被持续拉高。

## What Changes

- 为服务端 online AI watchdog 增加同一卡点重复恢复上限，默认同一房间、同一 AI、同一恢复签名最多自动恢复 3 次。
- 达到上限后先尝试安全的最终强制脱困：可明确取消 AI 自己的普通交互时先取消，再在没有交互/响应窗口且当前操作者仍是 AI 时推进阶段；不安全时保留对局状态并自动提交高优先级诊断反馈。
- 保留已存在的确定性无解交互应急跳过；只有能证明安全的 `__emergency_skip__` / 空选择 / cancel 类路径才自动跳过。
- 为生产 `game-server` 增加 CPU 与内存资源隔离；重启只作为运维止血，不作为业务根因修复。
- 增加可重复运行的交互空选项审计脚本，用于扫描同类 `createSimpleChoice` 裸空数组与动态强制选择候选。
- 增加宿主机 `game-server` CPU 持续高水位止血脚本，先保留现场证据，再在显式开启时重启容器。

## Impact

- Affected specs: `online-ai-recovery`
- Affected code: `src/engine/transport/server.ts`, `src/engine/transport/__tests__/server.test.ts`
- Affected tooling: `scripts/verify/interaction-empty-options-audit.mjs`, `scripts/deploy/watch-game-server-cpu.sh`
- Affected deployment config: `docker-compose.prod.yml`, `docs/deploy.md`
