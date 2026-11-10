# 线上反馈收口：翘课天才临时同名未被扒手消费

- 反馈 ID：`6ab6c61353f9291a46439f4e`
- 反馈原文：`翘课天才的卡牌描述是等同于我所有仆从的名字，那我打出扒手的话，应该能触发其效果，当有另一张扒手时，抽一张宝藏`
- 规则原文：翘课天才：“直到你的下个回合开始，此佣兵也拥有你拥有的每个其他佣兵的相同名称。”扒手要求同基地有另一张扒手时抽 1 张宝藏。
- 录入源：`public/locales/zh-CN/game-smashup.json`；英文合同草稿 `evidence/smashup/2026-07-25-excellent-movies-teens-intake-contract-draft.md` 仍标记 `alias-review-required`，本轮不把草稿状态冒充完整锁定。
- 线上现场：操作日志显示 Abe Frohman 写入 `teensAbeFrohmanNames`，随后打出 `munchkin_thieves_pickpocket`，但没有 `MUNCHKIN_TREASURES_DRAWN`。
- 根因：`pickpocketOnPlay` 只做 `minion.defId === THIEVES_PICKPOCKET`，没有读取 Abe 的当前回合临时名称元数据。
- 处理方式：在 `src/games/smashup/domain/abilityHelpers.ts` 增加唯一的有效名称 helper，并接入扒手；同一名称语义链同步复核青少年派系的 `hasTeensMinionAtBase`、`firstOwnDifferentNamePrintedPower3Minion`、`countBrunchBunchNames`。别名严格按 `teensAbeFrohmanTurn === core.turnNumber` 生效，过回合自动失效。
- 同类扩审：按共享元数据、名称比较、能力 handler 和 UI 消费链扩展，不替换 UID/定义校验、牌库卡片匹配或来源身份校验。
- 验证：
  - 新增 Vitest：临时同名触发扒手；下一回合别名失效；魔杖天才 skip 回归。
  - `npx vitest run src/games/smashup/__tests__/abilities/munchkin-mages.test.ts src/games/smashup/__tests__/munchkinMechanics.test.ts src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts`：3 files / 208 tests passed。
  - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/feedback-closeout-20260926.e2e.ts`：2 tests passed，包含真实出牌入口和宝藏牌结果。
- 状态：本地已修复并完成真实入口验证；线上代码尚未发布。
