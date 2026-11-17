# 荒野西部免费重投诊断（2026-11-16）

- 对象与规则：枪手“荒野西部！”；每花费一个装填，可免费重投其奖励骰一次，结算该次奖励骰后攻击额外 +1。录入源：`src/games/dicethrone/rule/枪手卡牌录入核对.md`。
- 本轮确认的问题：奖励骰可免费重投，但右侧骰盘未提示玩家点击骰子；普通确认会直接结束这次重投机会。修复为仅在免费重投仍可用时显示现有文案，次数用尽后隐藏。
- 实测范围：Playwright 项目测试环境，使用状态注入建立枪手攻击代表态和两枚装填；打出牌、选择消耗、点击奖励骰、确认均由浏览器操作。随机队列固定第一次骰面 2、重投骰面 6；不是自然开局或真实线上房间。
- 运行：`node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/wild-west-free-reroll.diagnostic.e2e.ts`；结果 1 passed，session `e2e-1794826858592-gne71z`。首次消耗后余 1，重投后仍余 1；第二次消耗后余 0，仍能免费重投一次；确认后无第三次装填入口，最终生命符合两次装填奖励和两次卡牌加值。
- 画面证据：`../../test-results/evidence-screenshots/dicethrone/wild-west-free-reroll.diagnostic.e2e/荒野西部奖励骰免费重投诊断/_runs/e2e-1794826858592-gne71z/wild-west-diagnostic-before-reroll.jpg`；`../../test-results/evidence-screenshots/dicethrone/wild-west-free-reroll.diagnostic.e2e/荒野西部奖励骰免费重投诊断/_runs/e2e-1794826858592-gne71z/wild-west-diagnostic-after-reroll.jpg`。图中骰面从 2 变 6，左侧装填均为 1/2；第一张可见免费重投提示。重投后提示消失。
- 额外验证：`node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/ui/__tests__/RightSidebar.contract.test.tsx src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native -t '免费重投|wild west'`，3 passed；`npx eslint src/games/dicethrone/Board.tsx src/games/dicethrone/ui/RightSidebar.tsx src/games/dicethrone/ui/__tests__/RightSidebar.contract.test.tsx` 通过。
- 旧用例首次失败：`dicethrone-die-reroll.e2e.ts` 在奖励骰前的 tooltip 断言期待“已激活的攻击修正牌”，当前页面实际显示牌名和内容，未进入奖励骰；未将该失败改写为通过。
- 未覆盖：原线上反馈缺具体对局和操作顺序，不能证明“用完指示物仍无限增加”在该线上现场已修复。当前变更只修复已确认的免费重投入口提示；没有修改卡牌结算逻辑。局内用户验收、线上部署与真实线上复现未完成。
