# 本地反馈收口：6aabe67f8e41d08302190f00

- 反馈原文：摧毁了恶魔狗，但是没有额外打出我放置在下面的随从。
- 录入 / 真相源：`public/locales/zh-CN/game-smashup.json` 的 `wraithrustlers_demon_dogs`；牌面语义为被摧毁后可将牌下储存的 1 个佣兵作为额外佣兵打出。
- 录入结论：恶魔犬 defId、牌下储存字段和额外随从消费映射一致，没有发现录入错版。
- 实现：`src/games/smashup/abilities/excellent_movies_teens.ts` 与共享 `src/games/smashup/domain/extraPlay.ts` 在恶魔犬被正式摧毁后生成限定 `smashup_immediate_extra_minion`，并限制到原基地。
- 规则回归：`excellent-movies-teens.test.ts` 已覆盖恶魔犬存放、摧毁和额外出牌提示。
- 真实入口：isolated runtime 执行 `node scripts/infra/run-e2e-single.mjs default e2e/smashup/smashup-feedback-closeout-20260918.e2e.ts "反馈回归：摧毁恶魔犬后真实打出牌下暂存随从"`；结果 `1 passed (20.2s)`。
- 结果：真实点击/选择摧毁恶魔犬、牌下暂存随从和基地后，暂存随从进入基地，牌下暂存区清空。
- 本轮边界：只做本地验证，未做线上验证。
