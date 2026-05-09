# SmashUp 2026-05-09 扩展基地触发合同反馈收口

## 范围

- `69feca4bf0a61f28ba015d7e`：印斯茅斯弃牌区为空时触发后无法发动/跳过。
- `69fecbb9f0a61f28ba015d9e`：印斯茅斯效果触发不了。
- `69fec94df0a61f28ba015d49`：温室 bug 无法执行。

## 根因

线上快照灌入 `resolveSmashUpReactionChoice` 后，三条都命中 queued reaction 执行路径：

- `base_innsmouth_base@onMinionPlayed` 读取 `state.players.*` 枚举/弃牌堆，但 `effectContract.reads` 只声明了 `minionBoardState/baseState/discardState`。
- `base_greenhouse@afterScoring` 读取冠军玩家 `state.players[winnerId]` 的牌库，但 `effectContract.reads` 只声明了 `deckState`。

运行时 `triggerEffectContract` 代理因此抛出 `SmashUp effect contract 违规`，用户表现为 reaction 按钮点下后能力无法继续执行。

## 修复

- `src/games/smashup/domain/baseAbilities_expansion.ts`
  - `base_innsmouth_base` 的 `reads` 补充 `controllerState`。
  - `base_greenhouse` 的 `reads` 补充 `controllerState`。
- `src/games/smashup/__tests__/expansionBaseAbilities.test.ts`
  - 新增印斯茅斯 queued reaction 回归：选择 trigger 后不再抛合同错误，并能进入选择弃牌堆玩家。
  - 新增温室 queued reaction 回归：选择 trigger 后不再抛合同错误，并能进入温室选牌交互。

## 验证

- `npx vitest run src/games/smashup/__tests__/expansionBaseAbilities.test.ts -t "queued reaction"`：2 passed。
- `npx vitest run src/games/smashup/__tests__/expansionBaseAbilities.test.ts`：48 passed。
- `npx eslint src/games/smashup/domain/baseAbilities_expansion.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts`：0 errors，保留既有 unused warnings。
- 线上 3 条反馈的 `stateSnapshot` 本地灌入 `resolveSmashUpReactionChoice` 复测：
  - `69feca4bf0a61f28ba015d7e`：空弃牌堆场景消费 trigger，不再打开后续无效选牌。
  - `69fecbb9f0a61f28ba015d9e`：消费 trigger 后排入 `base_innsmouth_base_choose_player`。
  - `69fec94df0a61f28ba015d49`：消费 trigger 后打开 `base_greenhouse` 交互。

## 残余

本证据只覆盖 2026-05-09 三条扩展基地 effect contract 反馈。线上同批剩余 Cardia 教程、SmashUp AI/卡住、泰坦询问等反馈仍需继续分诊。
