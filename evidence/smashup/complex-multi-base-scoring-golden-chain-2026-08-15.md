# 大杀四方复杂计分黄金链 E2E 证据

## 目标

验证真实浏览器页面中的复杂计分链路，而不是只看内部状态：

- 四人局三座基地同时达标。
- 玩家进入真实“选择先计分的基地”画面。
- 第一座托尔图加发 VP 后，旧基地仍未清场。
- 托尔图加 After Scoring 清场前选择随从移动。
- 第一座基地清场并替换后，回到剩余达标基地选择。
- 后续基地继续结算，最终无残留交互、无响应窗口、无待处理触发，并证明每座已计分基地没有重复结算 VP。

## 验证命令

```powershell
npx vitest run src/games/smashup/__tests__/ui-runtime-state-normalization.test.ts src/games/smashup/__tests__/local-provider-runtime-normalization.test.tsx src/games/smashup/__tests__/playerView-runtime-contract.test.ts
npm run test:e2e:file -- --file e2e/smashup/smashup-complex-multi-base-scoring.e2e.ts --case 四人三基地同时计分黄金链会截到计分选择、计分后响应、清场换基地和最终VP
```

结果：

- Vitest：3 个文件、9 个测试全部通过。
- Playwright：目标黄金链 1 个用例通过。
- 页面诊断：用例末尾断言没有 React `Received NaN` 警告。

## 截图与观察

截图目录：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-complex-multi-base-scoring.e2e\四人三基地同时计分黄金链会截到计分选择、计分后响应、清场换基地和最终VP`

1. `golden-01-three-scoring-bases-before-finish.jpg`
   - 现实画面：三座基地分别显示 22/21、23/20、24/22，均已达到或超过临界点。
   - 验收结论：起点满足“三基地同时达标”；牌面已加载，不是白牌或占位骨架。

2. `golden-02-real-scoring-screen-three-base-choice.jpg`
   - 现实画面：页面顶部显示“选择先计分的基地”，三座基地都有绿色可选高亮。
   - 验收结论：截到了真实玩家选择计分顺序画面，不是最终态截图冒充流程。

3. `golden-03-vp-awarded-before-clear-old-base-still-visible.jpg`
   - 现实画面：选择托尔图加后，记分板变为 P1=3、AI 2 号位=4；托尔图加旧基地仍在原位置，旧基地上的随从仍可见。
   - 验收结论：证明 VP 已发但旧基地尚未真正清场，符合“After Scoring 前后不能提前清场”的时序要求。

4. `golden-04-tortuga-runner-up-minion-choice-before-clear.jpg`
   - 现实画面：提示为“托尔图加：选择移动一个其他基地上的随从到替换基地”，中间和右侧基地随从出现绿色候选高亮，跳过按钮可见。
   - 验收结论：证明托尔图加 After Scoring 的清场前选择真实打开，并且玩家可在旧基地清场前选择移动对象。

5. `golden-05-after-first-base-cleared-replaced-back-to-scoring-choice.jpg`
   - 现实画面：托尔图加已替换为“中央大脑”，被移动的 Hoverbot 留在替换基地；剩余两座达标基地继续高亮并要求选择先计分基地。
   - 验收结论：证明第一座基地完成清场与替换后，系统正确回到多基地计分选择，没有卡住或漏掉后续基地。

6. `golden-06-final-three-bases-replaced-vp-once-only.jpg`
   - 现实画面：最终回到出牌阶段；分数为 P1=3、AI 2 号位=7、P3=7、P4=7；三座旧基地已替换为新基地。
   - 验收结论：证明 VP 合计 24，三座基地各自只结算一次，没有同一基地重复发 VP；后两座基地清场完成；无残留交互、无响应窗口、无待处理触发。

## 修复说明

- 问题现象：复杂真实页面链路曾出现 React `Received NaN` 警告，说明 UI 正在渲染非法数字。
- 修复位置：`src/games/smashup/ui/normalizeRuntimeState.ts`
- 修复方式：扩展已有“大杀四方运行时状态规范化”入口，统一收敛 UI 会直接显示的非法数字字段，并继续上报异常；没有把兜底散落到 `Board.tsx` 各个显示点。
- 回归保护：`src/games/smashup/__tests__/ui-runtime-state-normalization.test.ts` 新增非法数字字段测试，覆盖玩家 VP/出牌额度、随从力量字段、持续行动力量指示物和泰坦力量指示物。
