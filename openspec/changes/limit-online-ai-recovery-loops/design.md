## Context

当前 watchdog 能在一次恢复序列内检测 no-progress / loop，但恢复成功后如果游戏逻辑又把同一交互来源重新挂回，旧 tracker 会被删除，下一轮扫描会重新当作新 incident 处理。这会把同一个卡点变成跨 tick 的 CPU 循环。

## Goals / Non-Goals

- Goals: 限制同一卡点的连续自动恢复次数；达到上限后优先安全强制脱困，不能安全脱困时保留可诊断现场，并避免误结束对局。
- Goals: 对确定性无解交互继续允许应急跳过。
- Non-Goals: 不把未知交互一律强制跳过；不以容器重启替代业务修复。

## Decisions

- 重复键使用 `matchId + playerId + reason + recovery fingerprint`，其中交互 fingerprint 已包含交互来源、标题、选项语义与阶段。
- 达到默认 3 次后，watchdog 不再重复提交同一恢复动作；系统先尝试最终强制脱困，成功时上报 `repeated-recovery-force-unblocked`，状态为 open，明确这是止血而非根因修复。
- 最终强制脱困只允许两类动作：明确属于 AI 自己的普通交互可先 `SYS_INTERACTION_CANCEL`；随后只有在无交互、无响应窗口、当前操作者仍是该 AI、且游戏配置允许 fallback 阶段推进时，才发 `ADVANCE_PHASE` / `sw:end_phase`。
- 如果仍有响应窗口、真人响应者、比较掷骰等特殊交互，或无法确认当前交互可安全取消，则不上裸阶段推进，只上报 `repeated-recovery-suppressed`，状态为 open。
- 不设置 `sys.gameover`，不销毁房间，不替真人或游戏规则选择未知动作。
- 生产 compose 只做 CPU/内存隔离；CPU 高水位重启需要宿主机监控持续窗口，不放进业务 watchdog。
- 交互空选项同类审计放在 `scripts/verify/interaction-empty-options-audit.mjs`：裸 `[]` 视为失败，动态强制选择先作为提醒，避免把已有合法前置条件误判成 blocker。
- CPU 高水位脚本默认 dry-run，只写 `docker stats`、`docker inspect` 和最近日志；每次运行追加 `restart-history.log` 记录 decision/reason/restarted；只有设置 `BG_GAME_SERVER_CPU_WATCH_RESTART=1` 才执行 `docker restart`，并有冷却窗口防止重启风暴。

## Risks / Trade-offs

- 风险：某些合法链路可能需要多次自动恢复同一来源。
  - 缓解：上限可通过 `onlineAiRecoveryRepeatedAttemptLimit` 配置调整；默认 3 次后只执行安全强制脱困，仍保留 open 反馈供后续修根因。
- 风险：强制取消交互可能只是房间脱困，不等于业务规则正确。
  - 缓解：强制脱困反馈保持 open，并在 reason/actionLog 中记录执行过的取消/推进命令。
- 风险：CPU 配额只会限速，不会自动重启。
  - 缓解：文档明确 CPU 重启必须由宿主机监控执行，并先保留日志。
- 风险：静态审计不能证明每个动态候选都有业务级 guard。
  - 缓解：审计输出保留 warning，并允许用 `--strict` 在专项审计时升级为失败。
