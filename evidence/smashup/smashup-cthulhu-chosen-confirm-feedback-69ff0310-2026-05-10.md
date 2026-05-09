# SmashUp 线上反馈 69ff0310 天选之人确认交互卡住收口

## 反馈范围

- 反馈 ID：`69ff0310f0a61f28ba0167d6`
- 用户内容：`卡住不能动了。`
- 数据来源：生产 Mongo 真实反馈快照，详见 `temp/feedback-closeout/query-feedback-details-20260510.raw.txt`
- 核对时间：`2026-05-10 05:12:50 +08:00`

## 现场结论

生产快照停在 SmashUp `scoreBases`：

- `flowHalted=true`
- 当前交互为 `cthulhu_chosen_confirm_c23_0`
- `playerId=0`，即 human 玩家需要响应
- `sourceId=cthulhu_chosen_confirm`
- 旧快照里该确认交互的 `targetType=minion`

这与交互语义不匹配：`cthulhu_chosen_confirm` 是“是否抽一张疯狂牌来获得 +2 力量”的 yes/no 确认，不应该要求玩家点击场上随从。旧 `targetType=minion` 会让 UI 进入随从直点口径，表现为用户认为“卡住不能动”。

## 当前实现核对

- `src/games/smashup/abilities/cthulhu.ts` 的 `cthulhuChosenConfirmPromptProgram` 创建交互时已显式写入 `{ sourceId: 'cthulhu_chosen_confirm', targetType: 'generic' }`。
- `src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts` 的 targetType 白名单已要求 `cthulhu_chosen_confirm` 为 `generic`。
- `src/games/smashup/__tests__/cthulhu-chosen-display-mode.test.ts` 已覆盖直接触发层：确认交互是 `generic`，选项为 `yes/no`，且选项 `displayMode` 为 `button`。
- `src/games/smashup/__tests__/specialInteractionChain.test.ts` 本轮补充真实阶段链路：从 `ADVANCE_PHASE` 进入 `scoreBases`，触发 `cthulhu_chosen_confirm`，断言其为 `generic` 按钮交互，并选择 `no` 后成功响应，不再停留在同一个交互。
- `src/games/smashup/ui/interactionMode.ts` 新增 `shouldForceSmashUpPromptOverlay()`：即使旧生产快照仍持久化为 `targetType=minion`，只要选项均为 `displayMode=button`，UI 也强制走按钮 PromptOverlay，而不是进入随从直点模式。
- `src/games/smashup/Board.tsx` 的基地/随从直点分支已加 PromptOverlay guard，避免这类按钮确认交互被目标类型误分流。

## 验证

命令：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/specialInteractionChain.test.ts --configLoader native --maxWorkers 1 -t "69ff0310"
```

结果：`1 passed`。

命令：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/cthulhu-chosen-display-mode.test.ts --configLoader native --maxWorkers 1 -t "69ff0310"
```

结果：`1 passed`。

命令：

```bash
npx eslint src/games/smashup/__tests__/specialInteractionChain.test.ts e2e/src/games/smashup/__tests__/specialInteractionChain.test.ts src/games/smashup/__tests__/cthulhu-chosen-display-mode.test.ts e2e/src/games/smashup/__tests__/cthulhu-chosen-display-mode.test.ts
```

结果：`0 errors`。

命令：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/cthulhu-chosen-display-mode.test.ts --configLoader native --maxWorkers 1
```

结果：`4 passed`。

命令：

```bash
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1 -t "hand targetType"
```

结果：`1 passed`。

命令：

```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-cthulhu.e2e.ts "线上反馈 69ff0310：旧天选之人确认交互应显示按钮弹层并可关闭"
```

结果：`1 passed`。

## UI 截图证据

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-cthulhu.e2e\线上反馈-69ff0310：旧天选之人确认交互应显示按钮弹层并可关闭\69ff0310-chosen-confirm-button-overlay.png`
  - 肉眼观察：棋盘中央显示“天选之人：是否抽一张疯狂牌来获得 +2 力量？”提示，并显示“是（抽疯狂牌，+2力量）/ 否（不触发）”两个按钮。
  - 验收结论：达标。旧 `targetType=minion` 快照没有进入随从直点或卡牌选择口径，用户可见的是明确的按钮弹层。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-cthulhu.e2e\线上反馈-69ff0310：旧天选之人确认交互应显示按钮弹层并可关闭\69ff0310-chosen-confirm-after-no.png`
  - 肉眼观察：点击“否”后确认弹层消失，右侧出现“结束回合”按钮，棋盘回到可继续操作状态。
  - 验收结论：达标。该确认交互可以关闭，不再把玩家留在无可见按钮的卡住状态。

## 残余风险

本轮已覆盖旧生产 `targetType=minion` 快照下的浏览器 UI 兼容路径，以及当前实现新建 `generic` 交互的领域结构路径。若后续出现移动端布局、按钮遮挡或点击命中区域问题，应按独立 UI 布局反馈另行分诊。
