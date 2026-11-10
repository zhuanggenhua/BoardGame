# 本地反馈收口：6aabf48a8e41d08302191006

- 反馈原文：别人的回合摧毁了我的九头蛇特工，我不能打额外随从吗？
- 效果描述原文 / 来源：`public/locales/zh-CN/game-smashup.json` 的九头蛇特工录入；能力语义为“此牌被摧毁后，其控制者可立即额外打出一个随从”。
- 录入结论：`hydra_hydra_agent` 的中英文录入、defId 和 Smash Up 消费映射一致；没有发现录入缺失或错版。
- 消费映射：`src/games/smashup/abilities/marvel_villains.ts` 通过正式摧毁事件创建 `smashup_immediate_extra_minion`，并把控制者作为 `playerId`；后续基地选择由 `smashup_immediate_extra_minion_base` 继续完成。
- 实现 / 测试：修正本地 E2E 夹具，让 `trickster_gnome` 与九头蛇特工同基地，并补足两个合法侏儒目标；控制者页面同步已结算快照后，按真实手牌直选和基地直选完成后续操作。规则回归 `src/games/smashup/__tests__/abilities/marvel-villains.test.ts` 通过。
- 真实入口：`node scripts/infra/run-e2e-single.mjs default e2e/smashup/smashup-feedback-closeout-20260918.e2e.ts "九头蛇特工在对手回合被摧毁后，控制者仍能真实打出额外随从"`；结果 `1 passed (25.0s)`。
- 结果：对手回合摧毁九头蛇特工后，控制者页面真实选择额外随从并选择原基地，额外随从成功进入基地。
- 本轮边界：只做本地验证，未做线上验证。
