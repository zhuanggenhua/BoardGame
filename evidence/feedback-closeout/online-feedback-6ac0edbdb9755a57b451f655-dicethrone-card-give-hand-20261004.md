# 线上系统反馈收口：6ac0edbdb9755a57b451f655

## 反馈内容 / 现实症状

> [system][online-ai-watchdog] unsatisfiable-interaction-auto-skipped empty-options

来源：线上 `https://api.easyboardgame.top/admin-api/feedback`，反馈创建时间 `2026-10-03T11:57:49.250Z`。

## 发现的问题

- 自动检测场景：DiceThrone `main1` 阶段，`card-give-hand` 打开 `multistep-choice` 选骰交互；诊断包中的 `options=[]`、`sharedSelectability=0`、`seatSelectability=0`，唯一合法动作是 `SYS_INTERACTION_CANCEL`，因此 AI watchdog 只能执行“跳过（无可用选项）”。
- 根因：奖励骰 / 临时骰仍由 `pendingBonusDiceSettlement` 或当前 roll context 持有，但 AI 的选骰动作枚举只读空的 legacy `core.dice`，没有从当前奖励骰上下文恢复可操作骰，导致合法动作集合被错误计算为空。

## 处理方式 / 修复结果

- `resolveCurrentRollContext` 在当前上下文缺失或只剩 replay-only 时，从当前 `pendingBonusDiceSettlement` 恢复奖励骰上下文；AI 被动重掷与 `selectDie` 交互统一读取该上下文的骰子。
- `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts` 新增两条线上反馈回归：奖励骰上下文存在时应生成 `REROLL_DIE`，已确认普通骰区也应生成可执行重掷；整文件验证结果为 `164 passed`。
- 生产部署核对：`git rev-parse HEAD` 与生产 `boardgame-game-server` 镜像 revision 均为 `802e34d9d9c68d75c113e1f21c065a748b865304`；容器启动时间为 `2026-10-04T00:34:25.473076907Z`。
- 生产健康核对：`2026-10-04T00:43:28.701Z` `/health` 返回 `{"status":"ok"}`。

## 漏审复盘 / 规范回代判断

- 旧测试覆盖了普通奖励骰和多步选骰，但没有把“奖励骰仍在 settlement、legacy dice 为空、AI 只能发紧急取消”作为跨状态表示回归；属于测试缺口，现已由两条最小反馈回归补上。
- 现有反馈规范已经覆盖系统告警需保留现场、根因、处理和验证证据，本轮不新增第二套规范源。

## 状态

根因、代码修复、回归验证和生产 revision 回查均完成，写回 `resolved`。真实浏览器专项回放曾被同工作树已有 E2E 重任务排队占用，未把排队状态冒充为额外通过证据；本条为系统自动反馈，关闭依据为最小根因回归与生产 revision/健康回查。
