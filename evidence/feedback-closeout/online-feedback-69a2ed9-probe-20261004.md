# 线上反馈 69a2ed9：探究未生效

## 反馈原文

`外星人探究未生效`

## 效果描述原文

`查看另一个玩家的手牌并选择一张随从。那个玩家弃掉这张随从。`

来源：`public/assets/i18n/zh-CN/smashup/cards/compressed/cards1.webp`，图集索引 33；完整卡面已核对。

## 发现的问题

反馈没有附错误或堆栈，只能确认历史现场曾出现“探究”打出后没有完成目标选择 / 弃牌。当前运行时实现已经按卡面拆成两步：先选对手，再从对手手牌选择随从；行动牌本身进入弃牌堆，目标随从由对手弃掉。

## 处理方式 / 验证结果

- 核对 `src/games/smashup/abilities/aliens.ts` 的 `alienProbeChooseTargetPromptProgram` 与 `alienProbeDiscardPromptProgram`，确认目标玩家、目标手牌筛选和 `CARDS_DISCARDED` 消费链一致。
- 隔离真实浏览器入口回放：从玩家 0 真实手牌打出“探究”，先选择玩家 1，再选择玩家 1 手中的 `pirate_first_mate`；结果为该随从进入玩家 1 弃牌堆，另一张行动牌仍留在手牌。
- 验证命令：
  - `npx vitest run src/games/smashup/__tests__/abilities/ancient-egyptians.test.ts src/games/smashup/__tests__/abilities/aliens.test.ts`
  - `PW_E2E_SERVICE_REUSE=isolated node scripts/infra/run-e2e-single.mjs default e2e/smashup/smashup-ancient-egyptians-probe-anubis.e2e.ts`
- 结果：单测 25/25 通过；真实浏览器 2/2 通过。当前工作树已恢复该玩家链路。

## 漏审复盘

旧诊断只有一句反馈和状态快照，没有把“探究”拆成两步交互验证；现有规则 / 交互规范已覆盖多段选择的逐段验证，本轮补齐直接入口 E2E。
