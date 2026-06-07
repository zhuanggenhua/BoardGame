# SmashUp 计分后响应手牌承接 + MeFirst 提示弹窗回归证据

## 目标定义

- 用户要恢复的交互对象：手牌里的现有卡图《我们乃最强》。
- 用户要恢复的交互路径：计分后响应时，先直接点手牌卡图，再点基地，再继续卡牌自己的后续选择链。
- 中间提示 UI：`MeFirstOverlay` 只负责显示“计分后响应”和“让过”，不是新的交互承接层。
- 本轮明确不该恢复成的错误方向：`PromptOverlay` 上的“选择一个响应动作”按钮承接。

## 改动范围

- [`src/games/smashup/domain/reactionSession.ts`](</D:/gongzuo/webgame/BoardGame/src/games/smashup/domain/reactionSession.ts>)
  - 保留真正的领域修复：`smashup_reaction_choose` 产出领域事件后，清 reaction session，但不再额外 `resolveInteraction(...)` 把链路提前改写掉。
- [`src/games/smashup/ui/MeFirstOverlay.tsx`](</D:/gongzuo/webgame/BoardGame/src/games/smashup/ui/MeFirstOverlay.tsx>)
  - `sourceId === 'smashup_reaction_choose'` 时继续显示 `MeFirstOverlay`，避免把“有 interaction.current”误判成“应该隐藏提示 UI”。
- [`src/games/smashup/Board.tsx`](</D:/gongzuo/webgame/BoardGame/src/games/smashup/Board.tsx>)
  - `smashup_reaction_choose` 不再走 `PromptOverlay` 承接；手牌点击后仍进入基地高亮和后续卡牌交互。
- [`src/games/smashup/__tests__/MeFirstOverlay.test.tsx`](</D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/MeFirstOverlay.test.tsx>)
  - 补组件层回归：`smashup_reaction_choose` 作为计分响应承载时，中间 `MeFirstOverlay` 仍应可见。
- [`e2e/smashup/smashup-base-minion-selection.e2e.ts`](</D:/gongzuo/webgame/BoardGame/e2e/smashup/smashup-base-minion-selection.e2e.ts>)
  - 将用例标题改成真实目标：`计分后响应应保持手牌承接，并显示 MeFirst 提示弹窗`。

## 验证命令

```powershell
npm run typecheck
npx vitest run src/games/smashup/__tests__/Board.interactionBars.test.ts src/games/smashup/__tests__/MeFirstOverlay.test.tsx
$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'
$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'
npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "反馈回归：计分后响应应保持手牌承接，并显示 MeFirst 提示弹窗"
```

## 关键截图与肉眼结论

### 1. 进入计分后响应时的初始画面

- 路径：[smashup-champions-mefirst-before-click.png](</D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈回归：计分后响应应保持手牌承接，并显示-MeFirst-提示弹窗/smashup-champions-mefirst-before-click.png>)
- 肉眼看到：
  - 屏幕中间是 `MeFirst` 风格的“计分后响应”提示卡，带“让过”按钮。
  - 底部仍直接显示手牌《我们乃最强》卡图，没有被替换成“选择一个响应动作”的中央按钮选择。
  - 这张图同时证明了“中间有提示 UI”与“手牌仍是交互对象”这两件事。

### 2. 点击手牌后基地进入高亮

- 路径：[smashup-champions-mefirst-base-highlight.png](</D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈回归：计分后响应应保持手牌承接，并显示-MeFirst-提示弹窗/smashup-champions-mefirst-base-highlight.png>)
- 肉眼看到：
  - 点击《我们乃最强》后，目标基地直接进入绿色高亮可选态。
  - 说明响应承接点确实是手牌卡图点击，而不是先点中间弹窗里的动作按钮。
  - 场景操作继续落在现有基地对象上，没有新造中间交互对象。

### 3. 点基地后进入卡牌自己的后续 prompt

- 路径：[smashup-champions-mefirst-choose-source.png](</D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈回归：计分后响应应保持手牌承接，并显示-MeFirst-提示弹窗/smashup-champions-mefirst-choose-source.png>)
- 肉眼看到：
  - 顶部标题已经变成“我们乃最强：选择转出力量指示物的随从”。
  - 家园上的来源随从被高亮，进入了这张卡本来的下一步交互。
  - 这证明 `MeFirst` 只是前置提示 UI，没有吞掉后续卡牌交互链。

### 4. 完整结算后的收口画面

- 路径：[smashup-champions-mefirst-resolved.png](</D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈回归：计分后响应应保持手牌承接，并显示-MeFirst-提示弹窗/smashup-champions-mefirst-resolved.png>)
- 肉眼看到：
  - 中央大脑上的己方随从从 4 力量升到 6 力量。
  - 家园上的来源随从从 27 降到 25，说明 2 个力量指示物已按链路转移成功。
  - 页面回到正常棋盘态，没有残留“选择一个响应动作”或脏的中间承接层。

## 结论

- 本轮回归已恢复到用户点名的正确形态：`手牌承接点击 + MeFirst 中间提示 UI`。
- 没有再把交互改成 `PromptOverlay / 选择一个响应动作`。
- 这次 evidence 以实际截图为准，不再沿用之前错误命名的“中间承载层”口径。
