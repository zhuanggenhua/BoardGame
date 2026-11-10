# 线上反馈收口：魔杖天才不可取消

- 反馈 ID：`6ab6c50353f9291a46439f43`
- 反馈原文：`不可以取消效果`
- 线上现场：打出 `munchkin_mages_wand_whiz` 后，自动弹出“法师：选择一张手牌作为弃牌成本”，没有跳过入口。
- 规则真相源：`public/locales/zh-CN/game-smashup.json` 中魔杖天才规则是“你可以丢弃一张牌来打出一个额外的仆从或打出一个额外的行动”。“可以”要求效果可放弃。
- 根因：共享 `buildDiscardCostInteraction` 默认把弃牌成本建成强制单选；魔杖天才没有传入可跳过语义，handler 也没有 skip 终止分支。
- 处理方式：仅为魔杖天才开启 `createSkipOption('不使用效果', 'ui.skip')`；响应 skip 时直接结束，不产生 `CARDS_DISCARDED`，不进入额外出牌模式。其他需要支付成本的法师牌保持强制成本。
- 同类扩审：检查同 helper 的 Blaster Master、Happy Zapper、Scroll Shuffler、Speed Reading、Zzzzap、Embiggen、Portal to Beyond、Some Enchanted Evening；仅魔杖天才依据规则文本开放跳过。
- 验证：
  - `npx vitest run src/games/smashup/__tests__/abilities/munchkin-mages.test.ts src/games/smashup/__tests__/munchkinMechanics.test.ts src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts`：3 files / 208 tests passed。
  - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/feedback-closeout-20260926.e2e.ts`：2 tests passed，包含真实手牌点击、落基地、skip 入口和交互关闭。
- 状态：本地已修复并完成真实入口验证；线上代码尚未发布。
