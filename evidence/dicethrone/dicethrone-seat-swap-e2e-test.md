# 王权骰铸四人准备阶段换位 E2E 证据

## 结论

- 四人准备阶段已改成“点头像换位”，不再是“先选人再点空位”。
- 点到 AI 头像会直接完成换位，不会进入待审批状态。
- 点到真人头像会进入申请流：目标玩家看到“同意换位 / 拒绝”，申请方看到“取消申请”。
- 真人同意后会完成真实换位，申请 UI 消失，队伍展示也随新的座位顺序更新。

## 执行命令

```bash
npx vitest run src/games/dicethrone/__tests__/flow.test.ts
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 4-player seating panel: clicking an AI portrait swaps seats immediately"
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 4-player seating panel: clicking a human portrait enters request UI and approval completes the swap"
```

## 截图与人工观察

### 1. AI 换位前

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-seating-panel-clicking-an-AI-portrait-swaps-seats-immediately\03-four-player-seat-swap-ai-before.png`

![AI 换位前](../../test-results/evidence-screenshots/dicethrone/dicethrone-simple-start.e2e/Online-4-player-seating-panel-clicking-an-AI-portrait-swaps-seats-immediately/03-four-player-seat-swap-ai-before.png)

- 右下 2v2 站位面板已经是四个头像格，不再有“空位插槽”式操作入口。
- 3 号位头像带有明显的 `AI` 徽标，说明测试场景里目标确实是 AI 座位。
- 提示文案明确写着“点目标头像换位：点到 AI 直接换，点到真人会先发申请”。

### 2. AI 换位后

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-seating-panel-clicking-an-AI-portrait-swaps-seats-immediately\04-four-player-seat-swap-ai-after.png`

![AI 换位后](../../test-results/evidence-screenshots/dicethrone/dicethrone-simple-start.e2e/Online-4-player-seating-panel-clicking-an-AI-portrait-swaps-seats-immediately/04-four-player-seat-swap-ai-after.png)

- 2 号位已变成 `P3`，3 号位变成 `P2`，说明点击 AI 头像后座位发生了真实交换。
- `AI` 徽标跟着 `P3` 一起移动到了 2 号位，没有丢失，也没有挂错到其他头像。
- 站位面板内四个座位卡的顺序已随换位变化同步刷新，说明不是单纯前端高亮，而是底层座位顺序已更新。

### 3. 真人申请阶段

申请方截图路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-seating-panel-clicking-a-human-portrait-enters-request-UI-and-approval-completes-the-swap\05-four-player-seat-swap-human-requester.png`

审批方截图路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-seating-panel-clicking-a-human-portrait-enters-request-UI-and-approval-completes-the-swap\06-four-player-seat-swap-human-approver.png`

![真人申请阶段-1](../../test-results/evidence-screenshots/dicethrone/dicethrone-simple-start.e2e/Online-4-player-seating-panel-clicking-a-human-portrait-enters-request-UI-and-approval-completes-the-swap/05-four-player-seat-swap-human-requester.png)

![真人申请阶段-2](../../test-results/evidence-screenshots/dicethrone/dicethrone-simple-start.e2e/Online-4-player-seating-panel-clicking-a-human-portrait-enters-request-UI-and-approval-completes-the-swap/06-four-player-seat-swap-human-approver.png)

- 申请阶段的提示语已经变成“某玩家想和你换位 / 已向某玩家发起换位申请”这类审批语义，不再是移动到空位的旧文案。
- 审批方画面里出现了一块独立的深色审批卡片，里面有醒目的“同意换位”“拒绝”大按钮，视觉层级已经接近撤回审批 UI，不再是右上角难点的小按钮。
- 申请方画面不再出现“空位”或“当前位置”之类旧入口，说明旧的插槽式换位模型已经被替掉。

### 4. 真人批准后

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-seating-panel-clicking-a-human-portrait-enters-request-UI-and-approval-completes-the-swap\07-four-player-seat-swap-human-approved.png`

![真人批准后](../../test-results/evidence-screenshots/dicethrone/dicethrone-simple-start.e2e/Online-4-player-seating-panel-clicking-a-human-portrait-enters-request-UI-and-approval-completes-the-swap/07-four-player-seat-swap-human-approved.png)

- 批准后 2 号位显示为 `P3`、3 号位显示为 `P2`，真人审批通过后也完成了真实换位。
- 原先那块审批卡片已经完全消失，站位面板回到默认提示态，没有残留 pending UI。
- 座位卡顺序与 AI 换位后的稳定态一致，说明真人审批流最终也落到了同一套真实换位结果，而不是只清空了提示条。

## 备注

- 证据判断以我实际打开截图后的肉眼观察为准，不是只根据测试通过下结论。
