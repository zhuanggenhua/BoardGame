# Smash Up shayu / Sharks 派系能力证据

## 审计范围

- 数据：`src/games/smashup/data/factions/sharks.ts`
- 实现：`src/games/smashup/abilities/sharks.ts`、`src/games/smashup/abilities/shayu_common.ts`
- 覆盖卡牌：`sharks_megalodon`、`sharks_great_white`、`sharks_hammerhead`、`sharks_mako`、`sharks_blood_in_the_water`、`sharks_week_of_sharks`、`sharks_torn_apart`、`sharks_chum`、`sharks_dangerous_waters`、`sharks_feeding_frenzy`、`sharks_air_jaws`、`sharks_freakin_laser_beam`
- 覆盖基地：`base_the_deep`、`base_shark_reef`

## 真相源与旧实现参考

- 真相源：本轮本地 `shayu` 卡图/基地图、`public/locales/*/game-smashup.json` 文案、派系数据文件。
- 旧实现参考：
  - destroy / threshold：`dinosaurs.ts`、`cthulhu.ts`、`frankenstein.ts`
  - onMinionDestroyed：`samurai.ts`、`frankenstein.ts`、`cthulhu.ts`
  - base destroyer 归属：`domain/baseAbilities.ts`

## 逐项结论

- 低力量消灭：`Torn Apart` 通过真实行动入口选择并消灭低力量随从。
- 消灭后收益：`Hammerhead`、`Chum`、`Blood in the Water` 使用 `perInstance + triggerBase`，避免只扫单一来源。
- 多选消灭：`Feeding Frenzy` 已改为玩家选择任意数量，而不是自动全灭。
- 基地：
  - `The Deep` 使用力量 4+ 阈值并改为玩家选择。
  - `Shark Reef` 使用 `destroyerId` 作为受益玩家，而不是误用被消灭随从 owner。

## 验证证据

- `src/games/smashup/__tests__/shayuFactionAbilities.test.ts`
  - `鲨鱼：撕裂可通过真实行动入口消灭低力量随从并抽牌，锤头鲨获得指示物`
  - `鲨鱼：疯狂进食按玩家多选消灭任意数量低力量随从`
- E2E：`e2e/smashup-shayu-factions.e2e.ts`
  - 截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-与-Tornados-代表行动可从手牌真实打出并完成交互\shayu-sharks-torn-apart-after-destroy.png`
  - 肉眼观察：截图中 `The Deep / 海渊` 可见，`Torn Apart / 撕裂` 已进入弃牌堆，原目标 `p1-victim` 不在基地上，仍有另一张 `Mako / 灰鲭鲨` 作为未被误消灭的参照。

## 未覆盖风险

- E2E 只取 `Torn Apart` 代表真实入口；其余 Sharks 卡以行为测试和静态审计覆盖。

## 2026-05-10 E2E 补充观察

- `node scripts/infra/run-e2e-single.mjs ci e2e/smashup-shayu-factions.e2e.ts`：5 tests passed。
- 新增 Sharks 玩法截图：`D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-疯狂进食与-Tornados-旋风群覆盖多选和逐目标移动交互\shayu-sharks-feeding-frenzy-after-multi-destroy.png`
  - 实际看到：`Feeding Frenzy` 已进入弃牌区，低力量目标被多选销毁；未被选择的参照目标仍在场，证明不是自动全灭。
  - 是否达标：达标，覆盖 Sharks 新增“任意数量低力量目标多选消灭”交互。
