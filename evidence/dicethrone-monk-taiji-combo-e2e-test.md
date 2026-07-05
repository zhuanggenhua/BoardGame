# DiceThrone 武僧连段冲拳②回归 E2E 证据

## 验收对象

- 对象：武僧“连段冲拳② / 太极连环拳 II”。
- 场景：进攻方使用“连段冲拳②”，防御方结算后，进攻方两颗奖励骰固定为 4、5，均为太极面。
- 规则真相源：卡图写明“造成 5 伤害并投掷 2 骰；拳面增加 2 伤害；掌面增加 3 伤害；太极面获得 2 × 太极数量的气；莲花面获得闪避或净化”。
- 当前正确预期：两颗太极奖励骰结算为基础 5 伤害 + 4 气；太极面本身不是直接加伤害。跳过额外 Token 响应后，对手从 50 血降到 45，攻击方保留 4 气。
- 负向预期：没有莲花时，不应出现净化或闪避选择。

## 执行命令

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/monk-coverage.test.ts --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --testNamePattern "连段冲拳②"
node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/dicethrone.e2e.ts "regression: 武僧连段冲拳②两颗太极奖励骰结算为5伤害加4气"
npx eslint e2e/dicethrone/dicethrone.e2e.ts src/games/dicethrone/domain/tokenResponse.ts src/games/dicethrone/domain/attack.ts src/games/dicethrone/domain/flowHooks.ts src/games/dicethrone/heroes/monk/tokens.ts src/games/dicethrone/ui/TokenResponseModal.tsx src/games/dicethrone/__tests__/monk-coverage.test.ts src/games/dicethrone/domain/effects.ts src/games/dicethrone/domain/executeTokens.ts src/games/dicethrone/domain/systems.ts
```

## 验证结果

- 领域聚焦测试：1 个测试文件通过，3 passed / 20 skipped。
- 目标 E2E：1 passed。
- ESLint：0 errors，4 warnings；warnings 为 Markdown 证据/规范文件未纳入 ESLint 配置，以及 `tokens.ts` 既有未使用变量告警，本轮未新增错误。
- 状态断言证明：
  - 奖励骰后，当前待结算伤害仍为 5，攻击方气为 4。
  - 跳过额外 Token 响应后，当前技能只按卡图太极面结算为 5 伤害 + 4 气。
  - 最终对手生命从 50 变为 45，证明实际造成 5 点伤害。
  - 最终没有待结算伤害、没有奖励骰展示残留、没有交互残留。
  - 攻击方净化为 0、闪避为 0，证明没有错误触发净化/闪避选择。
  - 事件流包含两颗奖励骰：4 太极、5 太极；最终伤害事件来源为“连段冲拳②”，伤害值为 5。

## 截图证据

- 奖励骰后：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone.e2e\regression-武僧连段冲拳②两颗太极奖励骰结算为5伤害加4气\07-武僧连段冲拳二-奖励骰后-当前5伤害4气.jpg`
  - 画面来自真实 DiceThrone E2E，不是临时页面或合成图。
  - 截图用于证明奖励骰结果后，当前待结算伤害仍为 5，攻击方获得 4 气。
- 最终状态：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone.e2e\regression-武僧连段冲拳②两颗太极奖励骰结算为5伤害加4气\08-武僧连段冲拳二-最终45血4气无遮挡.jpg`
  - 截图用于证明技能使用后状态：对手血量为 45，攻击方仍显示 4 气；内部状态断言同步证明攻击方气为 4。
- 链路总览辅助图：`D:\gongzuo\webgame\BoardGame\evidence\dicethrone\monk-taiji-combo-chain-2026-07-05\武僧连段冲拳二-5伤害4气链路总览.jpg`
  - 该图由 04/05/06/07/08 五张真实 E2E 截图拼接，用于快速核对“使用前 → 使用时 → 防御入口 → 奖励骰后 → 最终状态”的完整链路，不替代原始截图真相。

## 结论

- 端到端已证明“连段冲拳②”两颗太极奖励骰的正确链路是：基础 5 伤害 → 奖励骰给 4 气 → 跳过额外 Token 响应 → 最终对手 50 到 45，攻击方 4 气。
- 之前“4 气本次加伤到 9”的证据和测试口径已经失效；当前证据以卡图合同的 5 伤害 + 4 气为准。
- 本回归没有触发净化或闪避选择，也没有留下未完成交互。
