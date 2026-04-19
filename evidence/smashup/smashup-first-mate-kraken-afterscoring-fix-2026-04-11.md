# SmashUp 反馈 69d8569740fc4706b5b878c6 修复记录（2026-04-11）

## 反馈

> 大副会吃掉海怪的结算（使用大副技能后没法用海怪登场）

诊断包：`temp/feedback-closeout/2026-04-10T16-45-00-000Z/69d8569740fc4706b5b878c6.md`
原始快照：`temp/feedback-closeout/2026-04-10T16-45-00-000Z/69d8569740fc4706b5b878c6.full.json`

## 诊断结论

- 动作日志显示：基地替换后，`pirate_first_mate_pod` 的 afterScoring 交互已经执行，大副被移动到了其他基地。
- 用户描述的异常是：**一旦先结算大副移动，海怪克拉肯的“进入替换基地”机会就消失**。
- 根因不在海盗/泰坦单卡文本，而在 **afterScoring 反应队列按顺序结算时，Kraken 仍用“当前基地上的控制者”判断资格**。
- 当大副先移动离开计分基地后，当前状态里该玩家已不再“在计分基地上有己方随从”，导致 `pirates_the_kraken` 触发器在后续结算时误判为不满足条件。

## 修复方案

- 在触发器入队时，给 `TriggerInstance` 增加 `triggerBaseControllersAtTrigger` 快照，记录**触发瞬间**计分基地上仍在场的控制者集合。
- `piratesTheKrakenAfterScoring` 改为优先使用该快照判定 Kraken 是否有资格在替换基地进场，而不是依赖经过其它 afterScoring 交互修改后的当前状态。
- 这样即使大副先被移动走，Kraken 仍会按照“计分当下的资格”保留进场交互。

## 涉及文件

- `src/games/smashup/domain/ongoingEffects.ts`
- `src/games/smashup/domain/types.ts`
- `src/games/smashup/domain/reactionQueueHandlers.ts`
- `src/games/smashup/abilities/titans.ts`
- `src/games/smashup/__tests__/smashup.smoke.test.ts`

## 新增回归测试

- 文件：`src/games/smashup/__tests__/smashup.smoke.test.ts`
- 用例：`大副先结算移动后，海怪克拉肯仍应保留替换基地进场交互`

该用例显式复现：

1. 计分基地上有 `pirate_first_mate`
2. `pirates_the_kraken` 处于 `setaside`
3. 先在 reaction queue 中选择结算大副 afterScoring
4. 再继续结算 Kraken afterScoring
5. 断言仍会出现 `titan_pirates_the_kraken_play_replacement` 交互

## 验证

1. `npx eslint src/games/smashup/domain/ongoingEffects.ts src/games/smashup/domain/types.ts src/games/smashup/domain/reactionQueueHandlers.ts src/games/smashup/abilities/titans.ts src/games/smashup/__tests__/smashup.smoke.test.ts --quiet`
   - 结果：通过
2. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "大副先结算移动后，海怪克拉肯仍应保留替换基地进场交互"`
   - 结果：通过
3. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "海怪克拉肯"`
   - 结果：通过（5 个 Kraken 相关回归全部通过）

## 结论

- 该反馈已从“afterScoring 链顺序导致 Kraken 资格丢失”修复为“按触发瞬间资格保留 Kraken 交互”。
- 结合新增回归与既有 Kraken 回归，这条反馈已具备回写 `resolved` 的证据基础。
