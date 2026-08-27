# 2026-08-27 本地反馈收口：Dice Throne 奖励骰响应窗口

## 口径

- 本轮口径：本地数据库反馈。
- 真实读写源：本机 MongoDB `mongodb://127.0.0.1:27017/boardgame` 的 `feedbacks` 集合。
- 本地状态镜像：`temp/feedback-closeout/status-board.json`，只作镜像，不替代本地数据库当前状态。
- 统计时间：2026-08-27 09:07:17 +08:00。
- 初始状态：本地反馈库 `closed=70 / resolved=1 / in_progress=2`；本轮接手的奖励骰相关未收口项为 2 条。

## 原始反馈

### 6a8f8416dae4c8df32251a83

- 反馈内容：`精力充沛怎么没有弹出特写，奖励骰应该是各自确认吧，这样才能改骰子啊，别人确认了难道 整个骰子视图就更新吗，还是要在我这里临时显示旧的，但是可以改骰子`
- 保真拆分：
  - 玩家认为“精力充沛”打出后没有弹出特写。
  - 玩家认为奖励骰不应由别人直接确认完，应先给能改骰的人响应机会。
  - 玩家不确定别人确认后自己的骰子视图是否还能保持可改骰状态。
- 反馈日志命中链路：AI 打出“精力充沛！”后，立即出现“奖励骰掷出：[1]”和“奖励骰确认结果：[1] 抽 1 张牌”，后续进入防御流程。

### 6a8da6725b6a95d4c9d5126a

- 反馈内容：`效果对不上`
- 反馈日志命中链路：AI 打出“顿悟！”后，出现“奖励骰掷出：[5]”和“奖励骰确认结果：[5] 抽 1 张牌”；同一日志中也出现普通投掷确认后由对手打出“弹一手！”修改骰子的链路。
- 归并判断：这条文字较短，但反馈状态、游戏、日志和奖励骰/改骰时机与上一条同属“奖励骰结算前响应窗口缺失或顺序不清”的问题组。

## 合同与分流

- 当前 Dice Throne 奖励骰合同：奖励骰不是攻击骰；奖励骰投出后必须保留在右侧当前骰盘作为唯一可见骰区。
- 若存在可用通用改骰牌、Token 或能力，必须先打开掷骰确认后的响应窗口；响应者让过或响应交互收口后，才进入骰主右侧骰盘普通确认。
- 没有可响应者时，仍直接停在右侧骰盘，等待骰主点击普通确认后才结算。
- 中央奖励骰特写、卡牌特写内嵌骰子和 `BonusDieOverlay` 不是当前奖励骰流程的展示或交互入口。

## 根本机制

- 现实故障现象：奖励骰掷出后，玩家看起来被直接带到骰主确认/结算，能改骰的一方没有先获得清晰响应窗口。
- 直接触发条件：`BONUS_DICE_REROLL_REQUESTED` 进入事件系统后，旧逻辑直接排入骰主的 `dt:bonus-dice` 右侧骰盘确认。
- 根本机制：旧分支没有在奖励骰结算前复用“掷骰确认后”的响应者队列判断，因此即使对手有可用改骰牌，也不会先打开 `afterRollConfirmed` 响应窗口。
- 为什么能解释原始症状：反馈日志里的“奖励骰掷出”紧跟“奖励骰确认结果”，与旧逻辑直接排骰主确认一致；玩家提出的“各自确认才能改骰”正是缺失响应窗口后的玩家可见困惑。

## 修复

- `src/games/dicethrone/domain/systems.ts`
  - `BONUS_DICE_REROLL_REQUESTED` 现在先计算本次奖励骰的掷骰签名和响应者队列。
  - 若奖励骰允许改骰、该掷骰签名还没有处理过响应窗口，且存在可响应者，则先发出 `RESPONSE_WINDOW_OPENED`，窗口类型为 `afterRollConfirmed`。
  - 打牌响应期间不提前排入骰主 `dt:bonus-dice`，避免响应窗口和骰主确认抢顺序。
  - 响应者让过或响应交互收口后，沿既有 `RESPONSE_WINDOW_CLOSED` 分支再排骰主右侧骰盘普通确认。
  - 无响应者时保留原体验：直接进入骰主右侧骰盘普通确认，不自动结算。

- `docs/games/dicethrone/card-timing-terms.md`
  - 同步奖励骰合同：有可用通用改骰牌、Token 或能力时，奖励骰先开响应窗口，再由骰主普通确认。
  - 保留右侧骰盘为唯一可见骰区；不恢复中央奖励骰特写或专用确认入口。

- 测试同步：
  - `src/games/dicethrone/__tests__/flow.test.ts` 覆盖“一掷千金”：奖励骰先给对手响应，对手改骰收口后才由骰主确认并按最终点数结算。
  - `src/games/dicethrone/__tests__/bonus-dice-confirmation-contract.test.ts` 覆盖“有响应者先开窗口、无响应者直接右侧确认”的合同。
  - `src/games/dicethrone/__tests__/thunder-strike.test.ts` 覆盖“雷霆万钧”和“风暴突袭 II”的奖励骰改骰、确认和后续气增伤链路。
  - `src/games/dicethrone/__tests__/volley-5-dice-display.test.ts` 覆盖“万箭齐发”奖励骰响应后按最终弓面结算。

## 未覆盖项

- “精力充沛没有卡牌/中央特写”本轮没有改成弹出特写。
- 原因：当前 Dice Throne 合同明确要求奖励骰、临时骰、改骰和普通确认都由右侧 2D 骰盘承接，中央奖励骰特写、卡牌特写内嵌骰子和 `BonusDieOverlay` 不是该流程入口。
- 本轮只能把这部分写成产品合同取舍：确认/改骰顺序已修；中央特写未改，不作为本次奖励骰响应窗口 bug 的修复范围。

## 验证

- 修复前红测：`npx vitest run src/games/dicethrone/__tests__/flow.test.ts -t "一掷千金奖励骰结算前先给对手改骰响应窗口" --configLoader native`
  - 首跑失败点：期望打开 `afterRollConfirmed` 响应窗口，实际 `sys.responseWindow.current` 为空。
- 修复后验证：
  - `npx vitest run src/games/dicethrone/__tests__/flow.test.ts -t "一掷千金" --configLoader native`
  - 结果：1 个测试文件通过，4 个测试通过。
  - `npx vitest run src/games/dicethrone/__tests__/bonus-dice-confirmation-contract.test.ts src/games/dicethrone/__tests__/thunder-strike.test.ts src/games/dicethrone/__tests__/volley-5-dice-display.test.ts src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts src/games/dicethrone/__tests__/ai-main-phase-turn-gating.test.ts --configLoader native`
  - 结果：5 个测试文件通过，51 个测试通过。
  - `npx vitest run src/games/dicethrone/__tests__/useCardSpotlight.rollback.test.tsx -t "奖励骰" --configLoader native`
  - 结果：1 个测试文件通过，2 个奖励骰特写/右侧骰盘合同测试通过。
  - `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-golden-full-flow.e2e.ts "DiceThrone 黄金全流程：覆盖开局、卖牌换CP、攻骰改骰、攻击修正奖励骰、防御响应、伤害、弃牌和回合交接"`
  - 结果：1 个浏览器 E2E 用例通过；万箭齐发奖励骰先进入防御方响应窗口，响应交互收口后回到攻击方右侧骰盘确认。

## 同类扩审

- 搜索维度：`BONUS_DICE_REROLL_REQUESTED`、`dt:bonus-dice`、`shouldQueueBonusDiceAfterResponseWindow`、`getResponderQueue`、`BonusDieOverlay`、奖励骰合同文档。
- 已覆盖对象：
  - 一掷千金：奖励骰先响应、响应收口后骰主确认。
  - 雷霆万钧：奖励骰先响应、响应改骰后按最终点数结算。
  - 风暴突袭 II：奖励骰伤害进入待处理伤害后仍可使用气增伤。
  - 万箭齐发：奖励骰先响应、改骰后按最终弓面数结算。
  - 通用响应窗口锁定：打改骰牌后的多步交互期间不提前让响应窗口收口。
  - AI 主要阶段门控：奖励骰和响应窗口不放行主要阶段误打掷骰时机牌。
- 旧测试未挡住原因：旧合同曾断言“奖励骰即使对手有改骰牌也不打开响应窗口”，测试把右侧骰主确认当成唯一等待点，漏掉了奖励骰结算前仍应开放通用改骰响应窗口的顺序要求。

## 状态回写与最终回查

- 状态回写时间：2026-08-27 09:14:35 +08:00。
- 真实源回写入口：本机 MongoDB `mongodb://127.0.0.1:27017/boardgame` 的 `feedbacks` 集合。
- `6a8da6725b6a95d4c9d5126a`：已回写为 `resolved`。
  - 回写文案：已修复奖励骰结算顺序。现在奖励骰掷出后，如果对手有可用改骰牌，会先进入对手响应窗口；所有响应结束后才轮到骰主在右侧骰盘确认，并按最终骰面结算。
- `6a8f8416dae4c8df32251a83`：已回写为 `resolved`。
  - 回写文案：已修复奖励骰确认/改骰顺序。现在奖励骰掷出后，会先给有可用改骰牌的一方响应机会，响应结束后才由骰主在右侧骰盘确认，并按最终骰面结算。你提到的卡牌/中央特写本轮没有恢复；当前 Dice Throne 约定是奖励骰统一由右侧骰盘展示，不再弹中央奖励骰特写。
- 最终 Mongo 回查：本地反馈库 `closed=70 / resolved=3`，`open=0 / in_progress=0`；奖励骰/改骰相关开放项为 0。
- 本地状态镜像：`temp/feedback-closeout/status-board.json` 已追加本地两条镜像记录，二者 `status=resolved` 且 `lastFetchedStatus=resolved`。
- 镜像校验：`node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json` 返回 `feedback-status: ok`。
