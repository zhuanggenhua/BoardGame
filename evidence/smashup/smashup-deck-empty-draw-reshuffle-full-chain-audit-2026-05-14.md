# 大杀四方牌库见底洗牌全链路审查 2026-05-14

## 范围

- 游戏：`Smash Up / 大杀四方`
- 用户反馈：牌出完后洗牌流程疑似有问题。
- 审查对象：抽牌阶段、普通抽牌能力、Effect DSL 抽牌 primitive、牌库空时弃牌堆洗回并继续抽牌的事件链。

## 权威规则

- `src/games/smashup/rule/大杀四方规则.md`：牌库耗尽时洗混弃牌堆构建新牌库。
- `src/games/smashup/rule/wiki-rules-coverage.md`：Draw 链路应为 `DECK_RESHUFFLED` -> `CARDS_DRAWN`；Reveal/Search/Look 使用 `DECK_REORDERED` 类重排链路。

## 审查维度

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| D3 数据流闭环 | 发现问题并已修复 | 多个能力直接 `drawCards()` 后只发 `CARDS_DRAWN`，缺少 `DECK_RESHUFFLED`，reducer 在旧空 deck 中找不到抽到的 uid。 |
| D8 时序正确 | 通过 | 修复后空牌库抽牌先生成洗回事件，再生成抽牌事件。 |
| D12 写入-消耗对称 | 通过 | `DECK_RESHUFFLED` 先把弃牌堆卡移入牌库，`CARDS_DRAWN` 再从当前牌库消费同一批 uid。 |
| D14 临时/区域状态清理 | 通过 | 新增用例分别证明行动卡自身不会被误洗回、先弃牌再抽牌时弃牌事件先于洗回/抽牌事件。 |

## 根因

标准链路 `buildStandardDrawEvents()` 已正确处理 `drawCards()` 的 `reshuffledDeckUids`，但一些能力绕过它：

- `werewolves.ts`
- `robots.ts`
- `ghosts.ts`
- `elder_things.ts`
- `titans.ts`
- `effectDsl.ts` 的 `drawCardsPrimitive`
- `bear_cavalry.ts`
- `cthulhu.ts`
- `innsmouth.ts`
- `killer_plants.ts`
- `miskatonic.ts`
- `steampunks.ts`

这些旁路在 `deck = []` 且 `discard` 非空时，要么直接返回“牌库为空”，要么只发 `CARDS_DRAWN`。后一种情况下日志/事件看起来像抽牌了，但 reducer 实际无法把弃牌堆里的卡放进手牌。

## 修复

- 将上述能力抽牌旁路统一改为 `buildStandardDrawEvents()`。
- `drawCardsPrimitive()` 现在在需要洗回弃牌堆时也会先发 `DECK_RESHUFFLED`，再发 `CARDS_DRAWN`。
- 对“先弃疯狂卡再抽牌”的路径，先用 `reduce` 模拟弃牌事件后的状态，再基于新状态生成标准抽牌事件，保证事件顺序和区域状态一致。
- 保留行动卡自身的结算边界：行动卡打出后进入弃牌堆，但若能力计算的洗回列表不包含它，`DECK_RESHUFFLED` reducer 会把它留在弃牌堆，不会误洗回牌库。

## 验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/expansionAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "ghost_seance"`：3 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/expansionOngoing.test.ts --configLoader native --maxWorkers 1 --testNamePattern "killer_plant_water_lily"`：5 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "miskatonic_librarian"`：3 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "fairies_puck 在丛林之灵在场时会先执行已选分支"`：1 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/turnCycle.test.ts --configLoader native --maxWorkers 1 --testNamePattern "draw phase reshuffles after drawing the last card in deck"`：1 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/factionAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "69feac13|wizard_enchantress|wizard_mystic_studies|wizard_neophyte_pod"`：3 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/zombieWizardAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "wizard_winds_of_change"`：2 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/factionAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "robot_tech_center"`：1 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/elderThingAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "elder_thing_mi_go"`：3 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/cthulhuExpansionAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "innsmouth_mysteries_of_the_deep"`：1 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newOngoingAbilities.test.ts --configLoader native --maxWorkers 1 --testNamePattern "special_madness|bear_cavalry_high_ground"`：5 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/expansionOngoing.test.ts --configLoader native --maxWorkers 1 --testNamePattern "steampunk_difference_engine"`：3 passed。
- `npm run typecheck`：passed。
- `npx eslint src/games/smashup/abilities/bear_cavalry.ts src/games/smashup/abilities/cthulhu.ts src/games/smashup/abilities/elder_things.ts src/games/smashup/abilities/ghosts.ts src/games/smashup/abilities/innsmouth.ts src/games/smashup/abilities/killer_plants.ts src/games/smashup/abilities/miskatonic.ts src/games/smashup/abilities/robots.ts src/games/smashup/abilities/steampunks.ts src/games/smashup/abilities/titans.ts src/games/smashup/abilities/werewolves.ts src/games/smashup/domain/effectDsl.ts src/games/smashup/__tests__/expansionAbilities.test.ts src/games/smashup/__tests__/expansionOngoing.test.ts src/games/smashup/__tests__/newFactionAbilities.test.ts`：0 errors，82 existing warnings。
- `git diff --check`：无空白错误，仅工作区 LF/CRLF warning。

## 残余范围

- 本轮覆盖“抽牌导致牌库见底洗回”的共享链路。
- Reveal/Search/Look 链路仍使用 `DECK_REORDERED`，本轮未改动；既有规则文档已标注其事件语义与 Draw 链不完全统一。
