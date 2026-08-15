# DiceThrone Duel 右侧骰盘改骰翻盘 E2E 证据

## 目标

验证 Duel / compare-roll 链路中，玩家打出改骰牌后，骰子交互发生在右侧 2D 骰盘，而不是中间骰子特写；改骰结果必须改变 Duel 胜负结果。

## 执行记录

- 类型检查：`npx tsc --noEmit --pretty false`，通过。
- 项目规范检查：`npm run spec:lint`，通过。
- 相关单测：`npx vitest run src/games/dicethrone/__tests__/roll-context.test.ts src/games/dicethrone/ui/__tests__/CompareRollOverlay.test.tsx src/games/dicethrone/ui/__tests__/DiceTray.test.tsx src/games/dicethrone/ui/__tests__/diceStagePolicy.test.ts`，4 个文件 / 72 条测试通过。
- Playwright：`PW_E2E_SERVICE_REUSE=isolated node scripts/infra/run-e2e-command.mjs isolated e2e/dicethrone/dicethrone-duel-shared-compare-roll.e2e.ts --grep "枪手 Duel compare-roll 通过右侧骰盘改骰后应从失败翻成胜利"`，`1 passed (1.4m)`。
- Playwright 整文件回归：`PW_E2E_SERVICE_REUSE=isolated node scripts/infra/run-e2e-command.mjs isolated e2e/dicethrone/dicethrone-duel-shared-compare-roll.e2e.ts`，`2 passed (2.2m)`。
- 运行边界：该 E2E 在建房阶段使用 `skipImageGate: true` 避免角色选择页被素材加载门禁阻塞；本用例证明 Duel 改骰交互、右侧骰盘承接和结果翻盘，不证明完整素材 bootstrap 链路。

## 兜底皮肤排查

- 失败证据：补充皮肤断言后，首跑失败显示右侧 Duel 第一颗骰子的现实归属是枪手，但渲染出来的骰子图片 URL 是武僧骰子图片：`dicethrone/images/monk/compressed/dice.webp`。
- 根本机制：枪手 Duel / Showdown 创建对掷骰时把骰子定义写成 `compare:玩家ID` 这类内部占位值；右侧 `Dice2D` 找不到这个骰子定义后，会按默认武僧皮肤路径渲染，所以枪手骰看起来像兜底/错皮。
- 修复方式：对掷骰现在直接写入玩家真实英雄骰子定义，例如枪手为 `gunslinger-dice`、武僧为 `monk-dice`；如果玩家没有可解析的英雄骰子定义，则抛出明确错误，不再静默生成占位骰子。
- 回归保护：Duel E2E 截图前会等待两颗右侧骰子都完成图片加载，并断言枪手骰 URL 包含 `dicethrone/images/gunslinger`、武僧骰 URL 包含 `dicethrone/images/monk`，同时断言没有数字兜底面。

## 截图证据

截图目录：`test-results/evidence-screenshots/dicethrone/dicethrone-duel-shared-compare-roll.e2e/枪手-Duel-compare-roll-通过右侧骰盘改骰后应从失败翻成胜利/`

1. `01-枪手Duel右侧骰盘显示对掷初始结果二比五.jpg`
   - 看到 Duel 进入右侧骰盘对掷状态，枪手初始为 2，对手为 5。
   - 截图前已断言枪手骰使用枪手皮肤、武僧骰使用武僧皮肤，且没有数字兜底面。
   - 中间没有骰子特写。
2. `02-枪手Duel打出改骰牌准备把己方骰改成六.jpg`
   - 看到玩家打出改骰牌，进入“把己方骰改成 6”的链路。
   - 这张图证明可介入对象来自真实手牌动作，不是直接注入最终态。
3. `03-枪手Duel右侧骰盘可直接点己方骰子.jpg`
   - 看到右侧骰盘承接目标选择，己方骰子可点击，对手骰子不可点击。
   - 证明改骰目标选择发生在右侧骰子本体上。
4. `04-枪手Duel改骰后右侧骰盘显示六比五等待普通确认.jpg`
   - 看到右侧骰盘从 2 比 5 变成 6 比 5。
   - 改骰后仍断言枪手骰保持枪手皮肤，未回退到默认武僧皮肤或数字兜底面。
   - 仍等待右侧普通确认，说明不是自动跳过确认。
5. `05-枪手Duel确认后按六比五获得胜利结果选项.jpg`
   - 点击右侧普通确认后，结果从原本失败翻成胜利。
   - 胜利选项出现，且中间结果层没有骰子特写。
6. `06-枪手Duel选择胜利结果后回到防御流程.jpg`
   - 选择胜利结果后，结果层关闭。
   - 页面回到防御流程，证明临时 Duel 结果已收口。

## 最终结论

- Duel / compare-roll 的改骰目标选择、改后展示和普通确认都在右侧骰盘完成。
- 把枪手 Duel 骰从 2 改成 6 后，Duel 结果按 6 比 5 生效，从失败翻成胜利。
- 对掷骰已不再使用 `compare:*` 占位骰子定义；右侧骰盘会按玩家真实英雄骰子皮肤渲染。
- 本轮图像证据是 6 张同链路截图组；旧的单张最终截图只能作为历史产物，不再作为完整链路证据。
