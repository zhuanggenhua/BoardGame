# 本地反馈收口：6aa66a9f77c06bd47ca227df

- 反馈原文：一直在移动，不明原因。
- 录入 / 真相源：反馈操作日志明确指向 Smash Up「爆破手」`goblins_blaster`；卡牌定义、中文录入和能力注册一致，无录入错版。
- 根因：计分前爆破手反面移动后，旧逻辑没有把“本回合已使用”限制随随从带到新基地，导致新基地再次触发 `goblins_blaster_tails`，形成往返循环。
- 修复：`src/games/smashup/abilities/goblins.ts` 与 `src/games/smashup/domain/commands.ts` 记录并校验 `goblinsBlasterUsedTurn` / `SPECIAL_LIMIT_USED`，同一回合再次发动被拒绝。
- 规则回归：`src/games/smashup/__tests__/abilities/goblins.test.ts` 反馈回归通过。
- 真实入口：`node scripts/infra/run-e2e-single.mjs default e2e/smashup/smashup-feedback-closeout-20260918.e2e.ts "反馈回归：爆破手真实入口移动后本回合不会再次循环移动"`；结果 `1 passed (52.4s)`。
- 结果：第一次移动成功，第二次反向移动命令不改变状态，循环停止。
- 本轮边界：只做本地验证，未做线上验证。
