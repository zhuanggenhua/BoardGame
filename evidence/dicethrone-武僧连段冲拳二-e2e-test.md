# DiceThrone 武僧连段冲拳② E2E 证据

## 验收结论

- 规则真相源来自卡图：拳面增加 2 伤害，掌面增加 3 伤害，太极面获得 2 × 太极数量的气，莲花面获得闪避或净化。
- 真实 E2E 链路覆盖：使用前、技能选中、防御入口、奖励骰后当前 5 伤害 + 4 气、最终回到主要阶段（2）。
- 奖励骰结果中两颗奖励骰固定为 4 和 5，均为太极面；攻击方获得 4 气，当前伤害仍为 5。
- 最终整屏截图中，顶部对手条应显示对手生命为 45；左侧攻击方仍显示 4 气，内部状态断言同步证明攻击方气为 4。
- 无莲花结果时，净化和闪避都保持 0，没有错误出现选择窗口。

## 证据文件

- 奖励骰后当前 5 伤害 4 气：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone.e2e\regression-武僧连段冲拳②两颗太极奖励骰结算为5伤害加4气\07-武僧连段冲拳二-奖励骰后-当前5伤害4气.jpg`
- 最终 45 血 4 气无遮挡：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone.e2e\regression-武僧连段冲拳②两颗太极奖励骰结算为5伤害加4气\08-武僧连段冲拳二-最终45血4气无遮挡.jpg`
- 链路总览辅助图：`D:\gongzuo\webgame\BoardGame\evidence\dicethrone\monk-taiji-combo-chain-2026-07-05\武僧连段冲拳二-5伤害4气链路总览.jpg`

## 验证命令

- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/monk-coverage.test.ts --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --testNamePattern "连段冲拳②"`
- `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/dicethrone.e2e.ts "regression: 武僧连段冲拳②两颗太极奖励骰结算为5伤害加4气"`
- `npx eslint e2e/dicethrone/dicethrone.e2e.ts src/games/dicethrone/__tests__/monk-coverage.test.ts src/games/dicethrone/heroes/monk/tokens.ts .spec/knowledge/standards/e2e-verification.md evidence/dicethrone-monk-taiji-combo-e2e-test.md evidence/dicethrone-武僧连段冲拳二-e2e-test.md`

## 结论

- 正确链路不是“太极面直接加伤害”，而是“5 基础伤害 + 两颗太极奖励骰获得 4 气”。
- 当前 E2E 已端到端证明对手最终 50 到 45，攻击方最终保留 4 气。
