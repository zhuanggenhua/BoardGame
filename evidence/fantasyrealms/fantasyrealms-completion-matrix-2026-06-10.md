# Fantasy Realms Completion Matrix（2026-06-10）

## 审计口径

- 目标来源：`task_plan.md` 当前 `Goal / Current Scope`
- 结论口径：
  - `已证明`：当前代码与现役证据已经足以证明该 requirement 成立
  - `现存证据`：仓内已有现役证据，但本轮未重新执行
  - `证据不足`：当前还不能据此宣称 requirement 已完成
- 本轮直接复核：
  - `npm run test:e2e:ci:file -- e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts` -> `13 passed`
  - `npx vitest run src/games/fantasyrealms/__tests__/ai.test.ts` -> `10 passed`
  - `pnpm vitest run src/games/fantasyrealms/__tests__/runtimeSkeleton.test.ts` -> `13 passed`
  - `pnpm vitest run src/games/fantasyrealms/__tests__/officialCardData.test.ts` -> `5 passed`
  - `pnpm vitest run src/games/fantasyrealms/__tests__/scoring.test.ts` -> `6 passed`
  - `npx vitest run src/engine/transport/__tests__/server.test.ts -t "Fantasy Realms"` -> `5 passed`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/fantasyrealms/fantasyrealms-online-ai-review.e2e.ts` -> `5 passed (1.2m)`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts` -> `27 passed (3.8m)`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts` -> `10 passed (7.2m)`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/fantasyrealms/fantasyrealms-online-ai-deep.e2e.ts` -> `7 passed (3.0m)`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/fantasyrealms/fantasyrealms-online-ai-golden.e2e.ts` -> `5 passed (13.3m)`

## Requirement Matrix

| Requirement | 状态 | Authoritative evidence | 本轮复核 | 备注 |
| --- | --- | --- | --- | --- |
| live 进行时桌面已收成左上牌库、顶部中轴、右上分数窄带、中央交错牌河、底部连续手牌，以及“仅在需要确认时出现”的手牌区确认位 | 已证明 | `src/games/fantasyrealms/Board.tsx`；`src/games/fantasyrealms/__tests__/Board.foundation.test.tsx`；`e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts`；截图 `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-live-flow.e2e/顶部-live-HUD-保持左上牌库、居中状态轴与右上分数窄带三段锚点/顶部-live-HUD-保持左上牌库、居中状态轴与右上分数窄带三段锚点-live-hud-three-anchor-topbar.png` 与 `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-live-flow.e2e/手牌区确认按钮会在拿牌确认与弃牌确认之间复用，且保持同一手牌区锚点/手牌区确认按钮会在拿牌确认与弃牌确认之间复用，且保持同一手牌区锚点-live-action-hand-zone-confirm-take.png` | 是 | 当前 live-flow 正式合同已切到手牌区确认位；旧 `_shared` 右下按钮证据已退出真相源 |
| 本地 live 页面不是空壳，`/play/fantasyrealms?playerID=0` 可自然完成抓牌/弃牌 | 已证明 | `e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts` 第 3 条 `左上牌库可真实完成摸2弃1链路` | 是 | 这条已经直接否定“本地页面链缺失”这一旧误判 |
| 双人 duel 变体 `摸1后继续弃1` 与 `满手拿弃牌后继续弃1` 语义成立 | 已证明 | `fantasyrealms-live-flow.e2e.ts` 第 4 / 11 条；`runtimeSkeleton.test.ts` | 是 | live-flow 本轮全量已复核 |
| 3 人基础版 `拿公开弃牌后必须继续弃1`、`首回合空弃牌只能摸1`、`10 张阈值终局` 语义成立 | 已证明 | `fantasyrealms-live-flow.e2e.ts` 第 7 / 10 / 12 条；`fantasyrealms-online-basic.e2e.ts` | 是 | local live 与 online 两层证据都在 |
| 终局会展示胜者与最终排名 | 已证明 | `fantasyrealms-live-flow.e2e.ts` 第 5 / 6 / 7 条；`fantasyrealms-online-basic.e2e.ts`；`fantasyrealms-online-ai-review.e2e.ts` | 是 | 本轮已重跑 `online-basic 27 passed` 与 `online-ai-review 5 passed`，并实际查看终局排名图 |
| 官方 53 张基础卡、中文展示名、`textZh`、atlas face、locale fallback 已进入 runtime | 已证明 | `src/games/fantasyrealms/data/cards.ts`；`src/games/fantasyrealms/__tests__/officialCardData.test.ts`；`src/games/fantasyrealms/rule/official-card-table-contract.md` | 是 | 本轮 `officialCardData.test.ts -> 5 passed`，合同文档中的旧“未完成”残留也已核对为非 blocker |
| 计分与平分裁定遵从正式口径 | 已证明 | `src/games/fantasyrealms/domain/scoring.ts`；`src/games/fantasyrealms/__tests__/scoring.test.ts`；`src/games/fantasyrealms/__tests__/ai.test.ts` 的 `tiebreakBaseScore` case | 是 | 本轮 `scoring.test.ts -> 6 passed`，`ai.test.ts -> 10 passed` |
| 进行中 hidden-info/playerView 已阻止对手手牌与牌库实体泄露 | 已证明 | `src/games/fantasyrealms/domain/view.ts`；`src/games/fantasyrealms/__tests__/ai.test.ts`；`fantasyrealms-online-basic.e2e.ts`；`fantasyrealms-online-ai.e2e.ts` | 是 | 本轮 `ai.test.ts` 与 `online-basic 27 passed` 已共同覆盖等待页 / spectator / hidden-hand no-leak |
| 本地 AI runtime 已接入，且 `draw / discard` 决策不偷看牌库顺序 | 已证明 | `src/games/fantasyrealms/ai.ts`；`src/games/fantasyrealms/manifest.ts`；`src/games/fantasyrealms/game.ts`；`src/games/fantasyrealms/__tests__/ai.test.ts` | 是 | 本轮 `ai.test.ts -> 10 passed` |
| 在线房 2~6 人真实链、自然拿弃牌分支、近终局自动结算、spectator/waiting/reload/review 成立 | 已证明 | `e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts`；`task_plan.md` 的 `Current Verification`；截图 `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图-ui-full-flow-final-standings-review-other-player.png` | 是 | 本轮已重跑整份 `online-basic`，并实际查看终局榜单切换他人手牌图 |
| 在线 local AI 的真实页面链成立：`2/3/6` 人 full-game、`4/5` 人 opening roundtrip、refresh/review/mixed-room 成立 | 现存证据 | `e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts`、`...-deep.e2e.ts`、`...-review.e2e.ts`、`...-golden.e2e.ts`；截图归档规则已切到 `test-results/evidence-screenshots/fantasyrealms/...` | 否 | 这些用例需要按新归档规则补跑后，文档里的旧 `_shared` 路径才能整体替换成当前正式路径 |
| transport/watchdog 已锁住 Fantasy Realms 深分支恢复语义 | 已证明 | `src/engine/transport/server.ts`；`src/engine/transport/__tests__/server.test.ts`；`task_plan.md` 的 4 条 transport 回归记录 | 是 | 本轮 `server.test.ts -t "Fantasy Realms" -> 5 passed` |
| 合法页面测试入口上的 local AI seat 自动推进已经有真实页面证据 | 已证明 | `src/pages/TestMatchRoom.tsx`；`src/pages/__tests__/TestMatchRoom.test.tsx`；`e2e/fantasyrealms/fantasyrealms-test-route-local-ai.e2e.ts`；截图 `test-results/evidence-screenshots/fantasyrealms/fantasyrealms-test-route-local-ai.e2e/合法测试入口里-human-首手后，seat1-local-ai-会真实接手并把回合交回/合法测试入口里-human-首手后，seat1-local-ai-会真实接手并把回合交回-test-route-local-ai-roundtrip-back-to-human.png` | 是 | 本轮已把 `seatControllers` 正式接到 `/play/:gameId`，并重新验证该截图已进入游戏自有证据目录 |

## 当前结论

- 当前 `Fantasy Realms` 不是“还差一堆基础实现没做”；大部分 live/online/AI/runtime 合同都已经有现役证据。
- 当前 top-level scope 中列出的 live UI、真实流程链与本地 AI 自动推进合同，现已全部被当前代码与本轮现役证据覆盖。
- 原先最明确的 `local AI seat` 页面缺口已经补齐：
  - 合法测试入口 `/play/:gameId` 现在已正式承载 `seatControllers`，并已有 Fantasy Realms 自己的页面级证据。
- 本轮直接复核已覆盖：
  - `live-flow 12 passed`
  - `ai.test.ts 10 passed`
  - `runtimeSkeleton 13 passed`
  - `officialCardData 5 passed`
  - `scoring 6 passed`
  - `transport Fantasy Realms 5 passed`
  - `online-basic 27 passed`
  - `online-ai main 10 passed`
  - `online-ai-deep 7 passed`
  - `online-ai-review 5 passed`
  - `online-ai-golden 5 passed`

## 下一步最窄动作

1. 若后续仍要继续推进，不再优先补“同层重复证明”，而应转向新的玩法面、扩展规则、或用户后续指定的新风险点。
2. 受控 E2E 运行器当前不允许同类重任务并发；本轮并跑暴露的 `EBUSY / heavy-task-guard / global-heavy-budget cooldown` 属于测试基础设施约束，不是 Fantasy Realms 业务红灯。
