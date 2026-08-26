# 线上反馈收口记录（2026-08-25）

## 口径

- 本轮口径：线上真实反馈。
- 线上读取源：`https://api.easyboardgame.top/admin-api/feedback`。
- 首次统计时间：2026-08-25 22:15:01 +08:00。
- 首次抓取结果：`open=3`、`in_progress=0`，归并为 3 个代表项。
- 诊断包目录：`temp/feedback-closeout/2026-08-25T22-15-00-current/`。

## 反馈结论

| 反馈 ID | 游戏 | 现实症状 | 本轮结论 | 处理状态 |
| --- | --- | --- | --- | --- |
| `6a8d388ca8a2c06e0d649f7b` | Smash Up | 线上 AI watchdog 在派系选择阶段尝试恢复，阶段推进被拒绝。 | 同一旧局残态：当前被指派 AI 玩家已选满两组派系，但系统仍停在派系选择阶段且没有合法动作。当前证据不足以定位可复现业务根因；公开预开局派系选择阶段不能强行 `ADVANCE_PHASE`。 | `closed` |
| `6a8d388da8a2c06e0d649f83` | Smash Up | 同一房间同一残态重复恢复 3 次后被 watchdog 抑制。 | 与上一条同房间同状态，属于自动恢复重复告警；没有交互、响应窗口或合法动作可执行。 | `closed` |
| `6a8d7ee8a8a2c06e0d64a2b8` | Dice Throne | `main1` 中 `card-give-hand` 的多步选骰交互在 AI 席位变成空选项，被自动取消。 | 当前代码树已能从当前奖励骰区枚举可重掷骰子；线上诊断包没有完整 core 状态，无法证明旧局根因。已补同形态 AI 回归，防止再次退回空选项取消。 | `closed` |

## 代码与验证

- 新增回归：`src/games/dicethrone/__tests__/basic-commands-coverage.test.ts` 中增加 `main1 + card-give-hand + 当前奖励骰区 + allowedDieIds=[0]` 的 AI legal actions 测试。
- 验证 1：`node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native -t "线上反馈：main1 中抬一手"`，结果 1 passed。
- 验证 2：`node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/card-give-hand-boundary.test.ts src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native -t "抬一手|card-give-hand|selectDie"`，结果 2 files passed，27 passed，152 skipped。

## Smash Up 分诊证据

- 两条反馈来自同一房间 `TKC3pjzM-UP`，阶段均为 `factionSelect`，当前玩家均为 `1`。
- 状态快照显示玩家 1 已有 `all_stars,robots`，玩家 2 已有 `teens,nightmare_before_christmas`，玩家 0 为空。
- 状态快照显示没有当前交互、没有响应窗口、没有 AI 决策候选，`legalActions.total=0`。
- 现有配置只允许派系选择阶段使用公开预开局合法动作，不允许在该残态下裸推进阶段；因此本轮只关闭这两条旧局自动恢复告警，不称为业务根因修复。

## 剩余风险

- 本轮没有生产部署动作；反馈状态收口只表示当前反馈记录已按证据处理。
- Dice Throne 的线上诊断包没有完整 core 状态，只能证明当前代码树覆盖同形态；如果新线上局再次出现同一卡点，需要补完整状态快照或服务器回放证据后再定位。

## 二次拉取新增反馈（2026-08-25 22:35:22 +08:00）

- 重新拉取源：`https://api.easyboardgame.top/admin-api/feedback`。
- 拉取结果：`open=2`、`in_progress=0`，归并为 2 个代表项。
- 诊断包目录：`temp/feedback-closeout/2026-08-25T22-35-30-recheck/`。

| 反馈 ID | 游戏 | 现实症状 | 本轮结论 | 处理状态 |
| --- | --- | --- | --- | --- |
| `6a8da592a8a2c06e0d64a68a` | Smash Up | 线上 AI watchdog 在 `scoreBases` 计分阶段尝试强制推进后，现场没有变化，报告 `active-turn:follow-up-advance:no_progress`。 | 已定位并修复：计分后响应轮里没有任何玩家有可响应内容时，后续恢复管线仍被“刚让过后保留响应轮”的保护条件挡住，导致空的 `score-after` 响应框架保持运行，AI 没有合法动作也不能自然推进。 | `resolved` |
| `6a8da593a8a2c06e0d64a692` | Smash Up | 同一房间同一卡点重复恢复 3 次后被 watchdog 抑制，报告 `force_unblock_no_progress`。 | 与上一条同一根机制：空 `score-after` 响应框架未在后续恢复轮自动收口。修复后空响应轮会由 Smash Up 事件系统收口，AI 可继续拿到自然阶段推进动作。 | `resolved` |

## Smash Up 计分卡死根因分层

- 现实故障：AI 席位在 `scoreBases` 阶段没有交互、没有响应窗口、没有合法动作，卡在 `score-after:0:0` 计分后响应框架。
- 直接触发：online watchdog 尝试 `ADVANCE_PHASE` 后，进度指纹未变化，因此上报 `follow-up-advance:no_progress`。
- 修复动作：`src/games/smashup/domain/systems.ts` 只在同一条 afterEvents 派生轮中保留“刚让过后的 optional 响应轮”；后续恢复命令进入新的 afterEvents 第 0 轮时，若当前响应者没有可响应内容，会继续调用 Smash Up 反应队列收口。
- 相邻修复：`src/games/smashup/domain/reactionSession.ts` 修正直接反应命令的状态返回，直接调用时保留已落地 core；管线内 `materializeDomainEvents=false` 时仍保留原 core 引用，避免领域事件被提前归约。

## Smash Up 验证

- 新增回归：`src/games/smashup/__tests__/scoreBases-auto-continue.test.ts` 增加 `线上反馈：score-after 空响应轮在后续恢复轮应自动收口`。
- 验证 1：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/scoreBases-auto-continue.test.ts --configLoader native`，结果 37 passed。
- 验证 2：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/response-window-skip.test.ts --configLoader native`，结果 20 passed。
- 验证 3：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/afterscoring-response-window-execution.test.ts src/games/smashup/__tests__/afterscoring-interaction-lock.test.ts --configLoader native`，结果 7 passed。
- 验证 4：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native -t "active-turn legal-only"`，结果 6 passed、275 skipped。
- 验证 5：`npx eslint src/games/smashup/domain/systems.ts src/games/smashup/domain/reactionSession.ts src/games/smashup/__tests__/scoreBases-auto-continue.test.ts`，结果 0 errors；`reactionSession.ts` 仍有既有 `any` / 未使用 helper warnings。

## 状态回写与最终回查

- 回写入口：缺少可复用 HTTP 管理 token 时，按反馈收口规范使用生产 Mongo SSH 写入口 `mongo-ssh`。
- `6a8da592a8a2c06e0d64a68a`：线上真实反馈记录已回写为 `resolved`，`matchedCount=1`、`modifiedCount=1`，本地状态镜像同步为 `resolved`。
- `6a8da593a8a2c06e0d64a692`：线上真实反馈记录已回写为 `resolved`，`matchedCount=1`、`modifiedCount=1`，本地状态镜像同步为 `resolved`。
- 回写工具补丁：`.spec/skills/feedback-closeout/scripts/lib/feedback-status-writer.mjs` 生成的 Mongo 脚本打印结果后显式 `quit(0)`，避免交互式 `mongosh` 在 SSH 管道里不退出，导致状态回写已发起但脚本不返回。
- 最终线上回查：`node .spec/skills/feedback-closeout/scripts/triage-open-feedback.mjs --statuses open,in_progress --limit 100 --slots 4 --out-dir temp/feedback-closeout/2026-08-26T00-23-30-final-recheck`，结果 `open=0`、`in_progress=0`、`totalFetched=0`、`uniqueGroups=0`。
- 当前补充验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/scoreBases-auto-continue.test.ts --configLoader native`，结果 37 passed。
- 当前补充验证：`node --test .spec/skills/feedback-closeout/scripts/lib/feedback-status-writer.test.mjs`，结果 9 passed。
