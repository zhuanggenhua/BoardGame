# 线上反馈 69c92aa：阿努比斯祭司误显示 +2

## 反馈原文

`木乃伊的阿努比斯祭司在基地没有自己的埋葬牌后依旧处于+2状态`

## 发现的问题

这是历史现场反馈。卡面原文为：`持续：若此处有你埋葬的牌，此随从+2战力。`
完整卡面来源：`public/assets/i18n/zh-CN/smashup/cards/compressed/aiji.webp`，图集索引 34。
反馈快照中，阿努比斯祭司由 0 号玩家控制，基地唯一埋葬牌的 `controllerId` 为 1；按卡面不应获得 +2。
当前工作树的 ongoing modifier 已按 `controllerId === ctx.minion.controller` 判断归属，现场不再复现。

## 处理方式 / 验证结果

- 补充单测：对手埋葬牌不增加阿努比斯祭司力量，`getEffectivePower(...)` 返回印刷力量 4。
- 隔离真实浏览器入口回放：重建“己方祭司 + 对手埋葬牌”的基地，画面不出现力量 +2 角标。
- 验证命令：
  - `npx vitest run src/games/smashup/__tests__/abilities/ancient-egyptians.test.ts src/games/smashup/__tests__/abilities/aliens.test.ts`
  - `PW_E2E_SERVICE_REUSE=isolated node scripts/infra/run-e2e-single.mjs default e2e/smashup/smashup-ancient-egyptians-probe-anubis.e2e.ts`
- 结果：单测 25/25 通过；真实浏览器 2/2 通过。本轮未修改规则实现，只补齐归属回归保护与现场证据。

## 漏审复盘

旧测试覆盖了己方埋葬牌加成，但没有覆盖“只有对手埋葬牌”的反向边界；现有反馈规范已覆盖规则原文、归属字段和同入口回放，本轮补齐最窄回归测试。
