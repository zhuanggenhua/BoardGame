# SmashUp 线上反馈 69feede0：场下巨狼之灵不再进入回合开始反应队列

## 反馈范围

- 反馈 ID：`69feede0f0a61f28ba0163df`
- 用户原文：`泰坦在场下也会询问触发，狼人吸血鬼泰坦询问次数非常频繁导致基地计分时阶段被询问窗口打断，进而出现指令bug`
- 本轮先收敛已能从生产快照与实现直接定位的狼人泰坦路径：`werewolves_great_wolf_spirit`

## 生产快照观察

- 生产明细显示当前 `smashup_reaction_choose` 正在处理 `werewolves_great_wolf_spirit` 的 `onTurnStart` 触发。
- 该触发属于巨狼之灵的场上 ongoing：回合开始时，如果它已经在场，才可以询问是否移动到另一个己方战力严格领先的基地。
- 根因在触发注册层：`werewolves_great_wolf_spirit` 的 `onTurnStart` 被登记成 `global` 触发。`collectTriggers()` 对 global source 使用 `isSourceInZones()`，而该函数只要 `state.titans` 里存在同 defId 泰坦就返回 true，没有区分 `base` / `setaside`。因此场下泰坦也会先被放进 reaction queue，造成无意义询问。

## 修复

- `src/games/smashup/abilities/titans.ts`
  - 移除巨狼之灵 `onTurnStart` 触发的 `global: true`。
  - 删除同一 `sourceDefId + timing` 的重复注册块，避免后续维护误读。
- `e2e/src/games/smashup/abilities/titans.ts`
  - 同步镜像逻辑。
- `src/games/smashup/__tests__/turnCycle.test.ts`
  - 新增回归：`线上反馈 69feede0：场下巨狼之灵不应在回合开始入队询问触发`。

## 验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/turnCycle.test.ts --configLoader native --maxWorkers 1 -t "线上反馈 69feede0"`：1 passed
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native --maxWorkers 1 -t "Great Wolf Spirit creates a start-of-turn move interaction"`：1 passed
- `npx eslint src/games/smashup/abilities/titans.ts src/games/smashup/__tests__/turnCycle.test.ts e2e/src/games/smashup/abilities/titans.ts e2e/src/games/smashup/__tests__/turnCycle.test.ts`：0 errors，保留既有 unused warnings。

## 结论

- 场下巨狼之灵不再因为 global trigger 被放进回合开始 reaction queue。
- 场上巨狼之灵的真实移动正路径仍保留：已有 smoke 用例证明在场时仍会创建 `titan_werewolves_great_wolf_spirit_move` 交互。
- 吸血鬼泰坦路径本轮未做行为改动：`vampires_ancient_lord` 的场下 special 本身依赖场下触发，不能按同一方式直接关闭；后续如仍有独立误触发，需要按具体生产快照继续分诊。
