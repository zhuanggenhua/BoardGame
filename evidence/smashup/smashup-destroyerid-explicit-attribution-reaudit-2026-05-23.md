# SmashUp destroyerId 显式归因补审（2026-05-23）

## 审计范围

- 范围类型：专项补审，不是全派系全面审计。
- 目标：
  1. 清理旧派系里 `destroyMinion(..., undefined, ...)` 导致的“缺失 destroyerId”历史残余。
  2. 统一 `MINION_DESTROYED.payload.destroyerId` 的合同语义：缺失即“无明确消灭者”，不能再默认推断为当前操作者。
  3. 回归 `Field of Honor` 这类依赖 destroyerId 的共享消费者。

## 权威来源

1. [public/locales/zh-CN/game-smashup.json](/D:/gongzuo/webgame/BoardGame/public/locales/zh-CN/game-smashup.json)
   - `bear_cavalry_bear_hug`：每位其他玩家均消灭自己最弱随从。
   - `dino_survival_of_the_fittest`：每个基地消灭一个最低力量随从，平局由行动使用者选择。
   - `elder_thing_dunwich_horror`：回合结束时消灭该附着随从。
   - `killer_plant_sprout`：在你的回合开始时消灭本卡。
   - `killer_plant_choking_vines`：在你的回合开始时消灭该随从。
   - `robot_nukebot`：本随从被消灭后，消灭本基地上其他玩家的所有随从。
2. 共享消费者合同：
   - [src/games/smashup/__tests__/bases/field-of-honor-base.test.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/bases/field-of-honor-base.test.ts)
   - `destroyerId` 为空时不应给 VP。

## 命中维度

- `D1`：效果主语/执行者归因。
- `D5`：时机与归属语义。
- `D10`：事件 payload 元数据合同。
- `D34`：共享消费者依赖字段一致性。
- `D49`：旧结论外溢到兄弟对象后的补审。

## 对象清单与结论

| 对象 | 真相源语义 | 代码落点 | 本轮结论 |
| --- | --- | --- | --- |
| `robot_nukebot` | 核弹机器人被消灭后，由其控制者连锁消灭同基地其他玩家随从 | [robots.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/abilities/robots.ts:562) | 改为显式写入 `ctx.playerId` |
| `bear_cavalry_bear_hug` | 每位其他玩家消灭自己的最弱随从 | [bear_cavalry.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/abilities/bear_cavalry.ts:442) | 改为显式写入对应对手 `opId` |
| `dino_survival_of_the_fittest` | 行动使用者让各基地最低力量随从被消灭 | [dinosaurs.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/abilities/dinosaurs.ts:770) | 改为显式写入 `ctx.playerId` |
| `elder_thing_dunwich_horror` | 附着行动拥有者在回合结束时消灭宿主随从 | [elder_things.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/abilities/elder_things.ts:2592) | 改为从附着实例 `ownerId` 显式归因 |
| `killer_plant_sprout` | 宿主控制者在自己回合开始时消灭自身 | [killer_plants.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/abilities/killer_plants.ts:307) | 改为显式写入随从控制者 |
| `killer_plant_choking_vines` | 附着行动拥有者在自己回合开始时消灭宿主随从 | [killer_plants.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/abilities/killer_plants.ts:413) | 改为显式写入附着实例 `ownerId` |
| `Field of Honor` 缺失 destroyerId | 没有明确消灭者时不发 VP | [field-of-honor-destroy-processing.test.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/bases/field-of-honor-destroy-processing.test.ts:118) | 旧“默认当前操作者得分”口径已删除 |

## 共享合同修正

- [src/games/smashup/domain/types.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/domain/types.ts:1502)
  - 注释从“缺失时按当前操作者推断”改为“缺失时按无明确消灭者处理”。

## 扫描结论

- 2026-05-23 对 `src/games/smashup/abilities` 与 `src/games/smashup/domain` 运行：
  - `rg -n "destroyMinion\\([^\\n]*undefined" src/games/smashup/abilities src/games/smashup/domain`
- 结果：本轮补审范围内已无残余命中。

说明：这条扫描只覆盖显式 `destroyMinion(..., undefined, ...)` 调用，不等于整个 SmashUp 所有“中性消灭”来源都已做完全面审计；若后续通过别的事件构造路径写出 `MINION_DESTROYED`，仍需继续按 destroyerId 合同复核。

## 自动化证据

### L2 领域行为

- `npx vitest run src/games/smashup/__tests__/abilities/bear-cavalry.test.ts`
  - `32 passed`
- `npx vitest run src/games/smashup/__tests__/abilities/robots.test.ts src/games/smashup/__tests__/abilities/dinosaurs.test.ts src/games/smashup/__tests__/abilities/elder-things.test.ts src/games/smashup/__tests__/abilities/killer-plants.test.ts src/games/smashup/__tests__/bases/field-of-honor-base.test.ts src/games/smashup/__tests__/bases/field-of-honor-destroy-processing.test.ts src/games/smashup/__tests__/reactionQueueDestroyerId.test.ts src/games/smashup/__tests__/feedback-high-ground-destroyer.test.ts src/games/smashup/__tests__/madMonsterPartyPreventedDestroy.test.ts`
  - `158 passed`

关键覆盖点：

- `robot_nukebot` 连锁消灭事件携带 `destroyerId='1'`
- `bear_cavalry_bear_hug` 无平局/平局响应都携带受害对手自己的 `destroyerId`
- `dino_survival_of_the_fittest` 全局消灭事件携带行动使用者 `destroyerId`
- `elder_thing_dunwich_horror` / `killer_plant_sprout` / `killer_plant_choking_vines` 触发事件都携带明确消灭者
- `Field of Honor` 缺失 destroyerId 时不再错误发 VP

### L3 真实入口 E2E

1. `适者生存无需选择基地；全局结算后若最低力量平局则进入平局选择`
   - 命令：
     - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-gameplay.e2e.ts "适者生存无需选择基地；全局结算后若最低力量平局则进入平局选择"`
   - 结果：`1 passed`
   - 截图：
     - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\适者生存无需选择基地；全局结算后若最低力量平局则进入平局选择\sotf-after-card-click-selected-global-action.png`
     - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\适者生存无需选择基地；全局结算后若最低力量平局则进入平局选择\sotf-after-global-action-awaiting-tiebreak.png`
     - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-gameplay.e2e\适者生存无需选择基地；全局结算后若最低力量平局则进入平局选择\sotf-tiebreak-candidates-visible.png`
   - 肉眼结论：
     - 点卡后没有错误进入“先选基地”的旧链路。
     - 全局最低力量结算后，真实 UI 进入平局选择 prompt。
     - 候选随从与测试场景中的平局对象一致。

2. `嫩芽牌库检索交互应显示卡牌选项并允许跳过`
   - 命令：
     - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "嫩芽牌库检索交互应显示卡牌选项并允许跳过"`
   - 结果：`1 passed`
   - 截图：
     - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\嫩芽牌库检索交互应显示卡牌选项并允许跳过\sprout-prompt-visible.png`
     - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-new.e2e\嫩芽牌库检索交互应显示卡牌选项并允许跳过\sprout-prompt-skipped.png`
   - 肉眼结论：
     - `Sprout` 真实入口能弹出牌库检索 prompt，而不是卡死或错位到别的交互。
     - prompt 中存在两个卡牌选项和一个 `skip` 入口。
     - 选择 `skip` 后 prompt 正常收口，没有残留旧交互。

## 本轮附带修正

- [e2e/smashup/smashup-robot-hoverbot-new.e2e.ts](/D:/gongzuo/webgame/BoardGame/e2e/smashup/smashup-robot-hoverbot-new.e2e.ts:5165)
  - 旧断言把 `Sprout` prompt optionId 写死成 `minion-*`。
  - 现改为更稳的业务断言：保留 `skip`，并断言有两个非 `skip` 卡牌选项，不再绑定内部前缀。

## 残余风险

- 本文档不是 SmashUp 全量 destroyerId 全面审计；它只覆盖本轮由鲨鱼补审反查出的“旧派系显式归因缺失”残余。
- 若未来新增通过别的 helper / synthetic event 直接写 `MINION_DESTROYED` 的路径，仍需继续检查 destroyerId 是否显式传递到共享消费者。
