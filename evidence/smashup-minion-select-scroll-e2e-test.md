# 大杀四方选择随从队列滚动 E2E 证据

## 本轮要求

- 选择随从时，随从队列只半展开，不完全拉开。
- 少量随从没有超过半展开高度时，不启用滚动列表。
- 随从内容真正超过半展开高度后，才启用可滚动列表。
- 滚动列表不显示滚动条，但仍能滚动看到下方随从。
- 给用户看滚动前后端到端截图。

## 入口与场景

- E2E 文件：`e2e/smashup/smashup-minion-select-scroll.e2e.ts`
- 入口：`/play/smashup`，通过项目 `game.openTestGame('smashup')` 进入真实游戏页。
- 视口：移动横屏 `852x393`。
- 代表态：基地 0 上放置 8 张不同随从，注入当前玩家的 `targetType: "minion"` 随从选择交互。

## 验收结果

- 短队列单测通过：3 张随从进入选择态时 `data-minion-select-mode="true"`，但 `data-minion-select-list="false"`；没有 `overflow-y-auto`，没有 `no-scrollbar`，也没有 `maxHeight`。
- 长队列单测通过：6 张随从超过半展开高度时，才出现 `data-minion-select-list="true"`、`overflow-y-auto` 和 `no-scrollbar`。
- 端到端滚动状态通过：8 张随从时容器进入滚动列表，`data-minion-select-list="true"`，样式包含 `overflow-y-auto` 和 `no-scrollbar`，计算滚动行为为 `overflowY: "auto"`。
- 半展开间距命中：第 2 张起的堆叠间距为 `calc(var(--mobile-layout-inline-unit, 1vw) * -3.5203)`，不是完全展开。
- 队列确实可滚动：滚动前 `clientHeight=237`、`scrollHeight=432`、`scrollTop=0`；滚动后 `clientHeight=237`、`scrollHeight=431`、`scrollTop=194`。
- 我实际看到的截图证据：滚动前图显示列表顶部一段，滚动后图显示同一队列下方一段；两帧可见随从范围从 1-5 号变化到 4-8 号。

## 截图

- 原始图 1：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-minion-select-scroll.e2e/选择随从队列半展开并能滚动显示下方随从/01-选择随从-滚动前.jpg`
- 原始图 2：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-minion-select-scroll.e2e/选择随从队列半展开并能滚动显示下方随从/02-选择随从-滚动后.jpg`
- PureRef 标记图组：
  - `D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-minion-select-scroll.e2e/选择随从队列半展开并能滚动显示下方随从/_labeled-for-pureref/00-sequence-index.png`
  - `D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-minion-select-scroll.e2e/选择随从队列半展开并能滚动显示下方随从/_labeled-for-pureref/01-labeled-01-选择随从-滚动前.png`
  - `D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-minion-select-scroll.e2e/选择随从队列半展开并能滚动显示下方随从/_labeled-for-pureref/02-labeled-02-选择随从-滚动后.png`

## 验证命令

```powershell
npx vitest run src/games/smashup/__tests__/baseZone-mobile-ongoing-actions.test.tsx --configLoader native
npm run test:e2e:file -- e2e/smashup/smashup-minion-select-scroll.e2e.ts
```

结果：

- Vitest：`11 passed`。
- Playwright：`1 passed`。
