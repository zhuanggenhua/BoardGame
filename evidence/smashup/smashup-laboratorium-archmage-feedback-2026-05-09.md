# SmashUp 线上反馈 69ff7291：实验工坊 + 大法师触发收口

## 反馈范围

- 反馈 ID：`69ff7291f0a61f28ba0189b9`
- 用户内容：`实验工坊有bug`
- 生产快照时间：`2026-05-09T17:44:49.567Z`
- 游戏：`smashup`

## 生产现场

生产快照显示 AI 在 `playCards` 阶段把 `wizard_archmage` 打到 `base_laboratorium`：

- `base_laboratorium` 上已有 `wizard_archmage(c61)`，`powerCounters=0`
- `triggerQueue` 同时残留：
  - `onMinionPlayed:base_laboratorium:...`
  - `onMinionPlayed:wizard_archmage:...`
- `sys.interaction=null`、`responseWindow=null`、`flowHalted=false`

这说明现场不是卡牌未打出，而是“实验工坊 + 大法师”同一 `onMinionPlayed` frame 的触发队列没有被收口到最终效果。

## 根因

实验工坊需要判断“本回合第一个打到该基地的随从”，旧实现把这个判断放在 queued trigger 执行阶段，并在 effect contract 中声明读取 `playLimits`。大法师打出时也会写入 `playLimits`（额外行动）。

这会把两个本可自动连续结算的强制触发误判为有排序冲突，导致同一 frame 中同时残留 `base_laboratorium` 与 `wizard_archmage` trigger。

同类问题也影响 `base_moot_site`；本轮顺带把 `base_hall_of_fame` 按同一模式修正，避免既有“大法师 + 名人堂自动收口”回归被 effect contract 守卫拦住。

## 修复

- `src/games/smashup/domain/baseAbilities.ts`
  - 给基地能力注册增加 `canTrigger` 预筛。
  - `base_laboratorium` / `base_moot_site` 在入队前判断“是否本回合该基地首次打出随从”。
  - queued 执行期不再读取 `minionsPlayedPerBase`，effect contract 不再声明 `playLimits`。
- `src/games/smashup/domain/baseAbilities_expansion.ts`
  - `base_hall_of_fame` 同步改为入队前 `canTrigger` 判断，避免无意义排序冲突。
- `e2e/src/...` 镜像同步。
- `src/games/smashup/__tests__/archmageE2E.test.ts`
  - 新增 `线上反馈 69ff7291：在实验工坊打出大法师时应自动结算实验工坊与大法师触发`。

## 验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/archmageE2E.test.ts --configLoader native --maxWorkers 1 -t "69ff7291"`：`1 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/archmageE2E.test.ts --configLoader native --maxWorkers 1`：`9 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newBaseAbilities.test.ts --configLoader native --maxWorkers 1 -t "base_laboratorium|base_moot_site"`：`7 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/expansionBaseAbilities.test.ts --configLoader native --maxWorkers 1 -t "base_hall_of_fame"`：`1 passed`
- `npx eslint src/games/smashup/domain/baseAbilities.ts src/games/smashup/domain/baseAbilities_expansion.ts src/games/smashup/__tests__/archmageE2E.test.ts e2e/src/games/smashup/domain/baseAbilities.ts e2e/src/games/smashup/domain/baseAbilities_expansion.ts e2e/src/games/smashup/__tests__/archmageE2E.test.ts`：`0 errors`，保留既有 `baseAbilities_expansion.ts` unused warnings。

## 结论

本轮回归明确证明：在实验工坊打出大法师后，最终态不再残留 `triggerQueue` 或 `sys.interaction.current`；大法师会给玩家额外行动，实验工坊会给该大法师放置 `+1` 力量指示物。该反馈可回写为 `resolved`。

## 2026-05-10 补充复核：旧生产队列兼容

后续复核发现生产快照里的 `triggerQueue` 已经持久化了旧 `effectContract.reads = ['playLimits', 'minionBoardState', 'baseState']`。如果只修“未来入队”的合同，新局不会再卡，但旧局仍可能继续被排序系统判为与大法师 `playLimits` 写入冲突。

本轮补充修复：

- `src/games/smashup/domain/reactionOrdering.ts`
  - 对已持久化的 `base_laboratorium` / `base_moot_site` 旧版首随从基地触发做兼容归一化。
  - 归一化只作用于 `onMinionPlayed`、写 `triggerMinionPower`、旧 reads 含 `playLimits` 的基地触发；排序物化时移除旧 `playLimits` 读足迹。
- `src/games/smashup/__tests__/newBaseAbilities.test.ts`
  - 新增旧队列回归：`线上反馈 69ff7291：已持久化的旧实验工坊队列也应自动恢复收口`。
- `e2e/src/...` 镜像同步。

补充验证：

- `npx vitest run src/games/smashup/__tests__/newBaseAbilities.test.ts -t "69ff7291"`：`3 passed`
- 生产快照只读灌入 `temp/feedback-closeout/query-feedback-69ff7291-state-json.raw.txt` 后调用 `maybeResolveReactionQueue`：
  - `triggerQueueLength=0`
  - `currentInteractionSourceId=null`
  - `archmagePowerCounters=1`
  - `actionLimit=2`
  - `consumedEvents=2`
- `npx vitest run src/games/smashup/__tests__/newBaseAbilities.test.ts`：`59 passed`
- `npx vitest run src/games/smashup/__tests__/reactionQueueOrdering.test.ts`：`18 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/archmageE2E.test.ts --configLoader native --maxWorkers 1 -t "69ff7291"`：`1 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/expansionBaseAbilities.test.ts --configLoader native --maxWorkers 1 -t "base_hall_of_fame"`：`1 passed`
- `npx eslint src/games/smashup/domain/baseAbilities.ts src/games/smashup/domain/baseAbilityQueue.ts src/games/smashup/domain/reactionOrdering.ts src/games/smashup/__tests__/newBaseAbilities.test.ts`：`0 errors`

补充结论：该修复同时覆盖新入队场景与已经卡在生产快照中的旧队列场景，可以继续按 `resolved` 收口。

## 2026-05-10 补充复核：同根因反馈 69ff720c

反馈 `69ff720cf0a61f28ba01897d` 的用户内容为“非常多bug，海盗的bug很多”，但生产快照实际卡点仍是实验工坊：

- 最近 Action Log：AI 将 `robot_hoverbot`（盘旋机器人）打到 `base_laboratorium`（实验工坊）。
- 当前 `triggerQueue` 仅剩一条旧版 `base_laboratorium@onMinionPlayed` mandatory trigger。
- 该 trigger 的旧 `effectContract.reads` 同样包含 `playLimits`。
- 快照里没有新的海盗触发、海盗移动或海盗结算错误信号；用户标题中的“海盗”无法从该现场单独证明为另一个 bug。

只读灌入生产快照 `temp/feedback-closeout/query-feedback-69ff720c-detail-20260510.raw.txt` 后调用 `maybeResolveReactionQueue`：

- `triggerQueueLength=0`
- `currentInteractionSourceId=null`
- `hoverbotPowerCounters=1`
- `consumedEvents=1`
- 产生事件：`su:trigger_consumed`、`su:power_counter_added`

结论：`69ff720c` 是 `69ff7291` 同根因的实验工坊旧队列残留问题，本轮同一修复已覆盖，可按 `resolved` 回写；若未来用户提供独立海盗卡牌现场，再作为新反馈处理。
