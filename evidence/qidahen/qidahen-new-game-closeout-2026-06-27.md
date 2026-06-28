# 七大恨新游戏收口证据

## 本轮目标

- 补齐七大恨作为“新游戏收工”缺的真实实现与真实证据，不再把“只补规范/只去掉 under_construction 标记”当完成。

## 本轮补齐内容

### 1. 教程入口不再只是路由存在，而是教程浮层真实可用

- 实现：
  - [src/games/qidahen/tutorial.ts](/D:/gongzuo/webgame/BoardGame/src/games/qidahen/tutorial.ts)
  - [src/games/qidahen/Board.tsx](/D:/gongzuo/webgame/BoardGame/src/games/qidahen/Board.tsx)
- 这轮把教程 manifest 接入了真实棋盘锚点：
  - `qidahen-map-layer`
  - `qidahen-action-wheel`
  - `qidahen-actions-zone`
  - `qidahen-hand-zone`
  - `qidahen-turn-banner`
- 肉眼结果：
  - 教程模式进入后直接落在局内棋盘，不再弹单独前置页。
  - 教程浮层显示的是中文真实文案，不是 i18n key。
  - 地图高亮步骤能真实挂在棋盘对象上，不是“有教程 step 但没有画面锚点”。

### 2. 终局遮罩已经接到七大恨真实棋盘

- 实现：
  - [src/games/qidahen/game.ts](/D:/gongzuo/webgame/BoardGame/src/games/qidahen/game.ts)
  - [src/games/qidahen/Board.tsx](/D:/gongzuo/webgame/BoardGame/src/games/qidahen/Board.tsx)
- 这轮补了：
  - `createTutorialSystem()`
  - `createEventStreamSystem()`
  - `useEndgame(...)`
  - `EndgameOverlay`
- 肉眼结果：
  - 向测试壳注入 `sys.gameover` 后，终局遮罩会真实叠在当前棋盘上。
  - 遮罩文案显示 `胜利`，不是只有 DOM 挂载、没有真实可见结果。

### 3. 新游戏通用能力补齐：音频接入与 manifest 收口

- 实现：
  - [src/games/qidahen/audio.config.ts](/D:/gongzuo/webgame/BoardGame/src/games/qidahen/audio.config.ts)
  - [src/games/qidahen/game.ts](/D:/gongzuo/webgame/BoardGame/src/games/qidahen/game.ts)
  - [src/games/qidahen/manifest.ts](/D:/gongzuo/webgame/BoardGame/src/games/qidahen/manifest.ts)
  - [src/games/manifest.client.generated.tsx](/D:/gongzuo/webgame/BoardGame/src/games/manifest.client.generated.tsx)
- 当前结果：
  - 七大恨已导出 `audioConfig` 并在 Board 接入 `useGameAudio(...)`。
  - manifest 已具备 `loadTutorial`。
  - 这轮只补齐“新游戏共用壳层能力”，不把它直接上升为“可以摘掉实施中状态”。

## 验证结果

### 静态门禁

- `npm run typecheck` 通过
- `npx vitest run src/games/qidahen/__tests__/Board.test.ts` 通过
  - 结果：`182 passed`

### 真实 E2E

- 命令：

```powershell
node scripts/infra/run-e2e-single.mjs ci e2e/qidahen/qidahen-closeout.e2e.ts
```

- 结果：
  - `2 passed (36.1s)`

### 关键截图

- 教程浮层：
  - [01-教程浮层-主棋盘四区引导可见.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/qidahen-新游戏收口/01-教程浮层-主棋盘四区引导可见.png)
  - 肉眼结论：当前真实显示的是“这是七大恨的主棋盘”教程说明；下一步按钮可见；棋盘、轮盘、行动区、手牌区同时在同一张真实图里。
- 终局遮罩：
  - [02-终局遮罩-注入胜利后显示.png](/D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/_shared/qidahen-新游戏收口/02-终局遮罩-注入胜利后显示.png)
  - 肉眼结论：终局遮罩已经真实叠到当前棋盘上，能看到 `胜利` 和操作按钮，不是只改了状态层。

## 本机开图记录

- 已调用仓库脚本真实打开：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\qidahen-新游戏收口\01-教程浮层-主棋盘四区引导可见.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\qidahen-新游戏收口\02-终局遮罩-注入胜利后显示.png`
- 成功证据：
  - `OPENED_IMAGE=D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\qidahen-新游戏收口\01-教程浮层-主棋盘四区引导可见.png`
  - `OPENED_IMAGE=D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\qidahen-新游戏收口\02-终局遮罩-注入胜利后显示.png`

## 当前结论

- 这轮缺的“教程入口真实可用 / 终局遮罩真实出现 / 音频接入”三件事都已经补齐。
- 基础玩法端到端截图链此前已存在：
  - [qidahen-basic-flow-e2e-2026-06-27.md](/D:/gongzuo/webgame/BoardGame/evidence/qidahen/qidahen-basic-flow-e2e-2026-06-27.md)
- 这份证据当前只证明《七大恨》的教程、终局遮罩与音频壳层已经补齐；它本身不是“整体已脱离实施中”的单独证据，不能单靠本文去摘掉 `under_construction` 状态。
