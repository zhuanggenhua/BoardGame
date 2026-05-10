# SmashUp 科学小怪蛋与行尸弃牌回归验证

## 范围

- 科学小怪蛋：被消灭后，同基地其他己方随从应可点击并获得 +1 力量指示物。
- 它们不断来临 / 行尸：从弃牌堆额外打出行尸后，行尸自身的牌库顶处理弹窗也必须可收口，不能卡住交互。
- 触发来源选择：`fireTriggerForSource` 仍应在同名来源存在时绑定 `triggerMinionUid` 指向的具体实例，同时 `sourceController` 回合边界触发必须跳过对手来源。

## 验证命令

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/ongoingEffects.test.ts -t "fireTriggerForSource 非 perInstance 来源应优先绑定" --configLoader native`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/turnCycle.test.ts -t "同名 sourceController 回合开始触发应跳过对手来源并选择当前玩家来源" --configLoader native`
- `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-zombie-lord.e2e.ts "zombie_they_keep_coming"`
- `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-chain.e2e.ts "科学小怪蛋"`

## 截图观察

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-chain.e2e\科学小怪蛋：被消灭后应可点击己方随从放置-+1-指示物\igor-counter-before-click.png`
   - 画面显示科学小怪蛋触发提示，左侧同基地己方随从处于绿色可选状态。
   - 目标随从本体可见，不是只有外围遮罩或提示。
   - 达到“力量无法点击”回归的触发前验收点。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-hoverbot-chain.e2e\科学小怪蛋：被消灭后应可点击己方随从放置-+1-指示物\igor-counter-after-click.png`
   - 点击目标后，目标随从旁出现新增 +1 指示物，基地力量从 8 变为 10。
   - 科学小怪蛋交互已离开目标选择态，进入后续响应选择，不再卡在无法点击。
   - 达到本轮科学小怪蛋验收标准。

3. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-they-keep-coming\01-discard-panel.png`
   - 弃牌堆面板显示三张真实弃牌，行尸卡可见并可作为候选。
   - 可选区域没有只高亮同 defId 但无法选择的异常。

4. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-they-keep-coming\02-card-selected.png`
   - 行尸被选中后出现“点击基地部署”提示，三个基地均显示可部署高亮。
   - 说明弃牌堆选择已进入基地落点阶段。

5. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-they-keep-coming\03-after-deploy.png`
   - 行尸已经从弃牌堆部署到中间基地。
   - 后续“牌库顶是顽强丧尸”弹窗已处理完，画面中没有残留交互弹窗。
   - 弃牌区显示顽强丧尸，证明点击“弃掉”后收口成功。

## 结论

- `triggerMinionUid` 不是废弃多重真相；它是 `fireTriggerForSource` 针对同名来源实例的定位输入。修复后只在匹配且通过 eligibility 时采用，避免覆盖 `sourceController` 当前玩家过滤。
- 行尸 E2E 之前失败是因为测试只部署了行尸，没有处理行尸自身的牌库顶按钮交互；补充点击“弃掉”后真实链路通过。
