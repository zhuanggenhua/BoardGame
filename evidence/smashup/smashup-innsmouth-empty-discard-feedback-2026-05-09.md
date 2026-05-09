# SmashUp 印斯茅斯空弃牌堆反馈收口证据

## 范围

- 反馈：`69feca4bf0a61f28ba015d7e`、`69fecbb9f0a61f28ba015d9e`
- 游戏：`smashup`
- 线上局：`sm-xoO0DISX`
- 问题：三名玩家弃牌堆都为空时，印斯茅斯基地仍进入 `smashup_reaction_choose`，暴露一个实际无可执行效果的基地触发。

## 线上现场

生产 Mongo 快照显示：

- 当前阶段：`playCards`
- 当前交互：`smashup_reaction_choose`
- 选项：`base_innsmouth_base` 触发项 + `Pass`
- 三名玩家弃牌堆：均为空
- 印斯茅斯基地上刚打出的随从：`innsmouth_the_locals`

这说明问题不是卡牌移动执行错误，而是反应队列把“当前没有合法弃牌目标”的印斯茅斯基地能力暴露成了可点触发。

## 修复

- `BaseAbilityRegistrationOptions` 增加 `canTrigger` 谓词。
- `collectBaseAbilityTriggers` 在入队前执行 `canTrigger`，不可执行时不生成 trigger。
- `base_innsmouth_base` 仅在未被 `ninja_infiltrate` 忽略且至少一个玩家弃牌堆非空时入队。

## 验证

- `npx eslint src/games/smashup/domain/baseAbilities.ts src/games/smashup/domain/baseAbilityQueue.ts src/games/smashup/domain/baseAbilities_expansion.ts src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts`
  - 结果：0 errors，5 个既有 warnings。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts --configLoader native --maxWorkers 1 -t "线上反馈 69feca4b/69fecbb9"`
  - 结果：1 passed。
  - 肉眼核对：新增回归断言覆盖三名玩家弃牌堆为空、打出 `innsmouth_the_locals` 到印斯茅斯后，`triggerQueue` 不再包含 `base_innsmouth_base`，也不会出现 `smashup_reaction_choose`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/expansionBaseAbilities.test.ts --configLoader native --maxWorkers 1 -t "base_innsmouth_base"`
  - 结果：3 passed。
  - 肉眼核对：弃牌堆有卡时仍会生成印斯茅斯选择玩家交互，所有弃牌堆为空时直接无事发生，过期卡选择不会错误放回牌库底。

## 已知验证缺口

- 曾尝试整文件运行 `baseAbilityIntegrationE2E.test.ts`，新增用例通过，但该文件其他 16 个既有用例因 effect contract 声明旧债失败，失败模块包括鬼屋、疯人院、温室等，非本次印斯茅斯回归。
