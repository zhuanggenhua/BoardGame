# Smash Up 反馈 69f385d7 本地验收收口说明（2026-05-04）

## 反馈原文

- `大杀四方  小妖精的泰坦效果没有触发  效果是触发有或者的效果时  一回合一次能两个效果全部触发   但我只能选择一个触发`

线上反馈对应：

- feedbackId：`69f385d75cacc4e6b5cdbd4a`
- gameId：`smashup`
- route：`/play/smashup/match/k7QoohFeCbY?playerID=0`
- appVersion：`production`

## 线上现场能确认到什么

- 现场主角是 `Puck` 与 Fairy Titan `Spirit of the Forest`：
  - action log 已出现 `Puck -> 436-1337工厂`
  - 当前场上有 `fairies_spirit_of_the_forest`
- 现场快照末尾事件里已经能看到 `Puck` 的分支交互：
  - 一个分支是 `extra_action`
  - 另一个分支是 `draw_card`
- 用户反馈描述的是：在 Titan 的“一回合一次 OR 两边都触发”语义下，自己只能完成一个分支，没能继续执行剩余分支。

## 代码与现有回归对照

- 当前仓库已经有与该反馈直接同构的精确回归：
  - `src/games/smashup/__tests__/newFactionAbilities.test.ts`
    - `fairies_puck 在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过`
  - 该测试覆盖的就是：
    1. `Puck` 打出后先出现 `draw_card / extra_action`
    2. 先选择其中一个分支
    3. 系统继续弹出只剩“另一分支 + 跳过”的 follow-up prompt
    4. 选完第二个分支后，Titan 的 `spiritOfTheForestUsedTurn` 才真正写入本回合
- 另外还有约束回归：
  - `src/games/smashup/__tests__/commandsValidation.test.ts`
    - `fairies_spirit_of_the_forest special 需要同时保留通常随从与通常行动额度`
  - 这条用于防止 Titan 特权把正常行动额度错误吃掉或提前锁死。

## 本地验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/commandsValidation.test.ts --configLoader native --maxWorkers 1 --testNamePattern "fairies_puck 在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过|fairies_spirit_of_the_forest special 需要同时保留通常随从与通常行动额度"`

结果：

- `commandsValidation.test.ts`：`1 passed`
- `newFactionAbilities.test.ts`：`1 passed`
- 合计：`2 passed`

## 收口结论

- 当前任务口径下，`resolved` 表示“本地已经修好并完成本地验收”，不代表已上传/已上线。
- 这条反馈描述的 `Puck + Spirit of the Forest` 双分支补发语义，当前代码基线已经有精确回归覆盖，且本轮复跑通过。
- 因此这条应按“已修未回写”处理，可直接转 `resolved`。
