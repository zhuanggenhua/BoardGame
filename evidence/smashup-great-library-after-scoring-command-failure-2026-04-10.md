# 大杀四方反馈修复：大图书馆 afterScoring 执行命令异常（2026-04-10）

- 反馈 ID：`69d71fc0932fe508b2420ca9`
- 结论：`resolved`
- 范围：SmashUp / `base_great_library` / afterScoring 反应队列

## 现象

用户反馈“执行大图书馆基地效果执行命令异常”。诊断包对应状态处于：

- `phase = scoreBases`
- `currentPlayerId = 1`
- `triggerQueue` 中同时存在：
  - `afterScoring:base_great_library:0:0`
  - `afterScoring:alien_scout:0:0`

这说明问题发生在 **计分后的多触发排序窗口**，而不是普通出牌阶段的主动基地能力。

## 根因

`base_great_library` 的 afterScoring 结算会给“该基地上有随从的每位玩家”各抽 1 张牌，内部调用：

- `buildStandardDrawEvents(state, playerId, 1, ctx.random, ctx.now)`

但基地能力上下文 `BaseAbilityContext` 之前没有把 `random` 沿着这条链路稳定传下去：

- `triggerAllBaseAbilities(...)` 直调基地能力时没有传 `random`
- `baseAbilityQueue.ts` 把基地能力包装成 queued trigger executor 时也没有传 `random`
- `reducer.ts` / `bury.ts` 某些直接触发基地能力的路径同样没补 `random`

因此一旦大图书馆结算到“牌库为空、需要把弃牌堆洗回牌库再抽”的玩家，就会在：

- `drawCards(...).shuffle(...)`

这里因为 `random` 是 `undefined` 而抛异常，最终表现为命令执行失败。

## 为什么这个反馈会撞到

该诊断包里 AI 2 号位满足：

- `deck = []`
- `discard` 非空

所以大图书馆在 afterScoring 结算到 AI 时，必须先洗弃牌堆再抽牌，正好命中这条缺失 `random` 的路径。

## 修复

已把 `random` 补到基地能力上下文的运行时链路：

- `src/games/smashup/domain/baseAbilities.ts`
- `src/games/smashup/domain/baseAbilityQueue.ts`
- `src/games/smashup/domain/reducer.ts`
- `src/games/smashup/domain/bury.ts`
- `src/games/smashup/domain/index.ts`

并新增回归测试，覆盖“反应队列中先结算大图书馆，且抽牌玩家需要洗弃牌堆”的真实链路：

- `src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts`

## 验证

1. ESLint：
   - `npx eslint src/games/smashup/domain/baseAbilities.ts src/games/smashup/domain/baseAbilityQueue.ts src/games/smashup/domain/reducer.ts src/games/smashup/domain/bury.ts src/games/smashup/domain/index.ts src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts --quiet`
2. 定向单测：
   - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts --configLoader native -t "大图书馆 afterScoring 通过反应队列结算时，弃牌堆洗回抽牌不应抛出命令异常"`

## 结果

回归测试通过，且验证了：

- 反应队列结算大图书馆不再抛命令异常
- 需要 reshuffle 的玩家能正常把弃牌堆洗回并抽牌
- 结算后剩余的 `alien_scout` afterScoring 交互仍能继续生成
