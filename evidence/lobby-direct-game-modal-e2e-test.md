# 大厅直达游戏详情 E2E 证据

## 用例

- `node scripts/infra/run-e2e-single.mjs ci e2e/lobby.e2e.ts "Dice Throne 直达链接会直接打开详情弹窗"`
- `node scripts/infra/run-e2e-single.mjs ci e2e/lobby.e2e.ts "移动端游戏详情隐藏描述和推荐人数，作者入口位于右上角且无包围框"`

## 截图

- 修复后直达链接截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\lobby-dicethrone-direct-modal-fixed.png`

## 肉眼观察

- `/?game=dicethrone` 进入后，页面中央直接出现了王权骰铸详情弹窗，不再停留在只有卡片墙的大厅状态。
- 背景大厅被正常虚化，说明模态层已经真正挂进 `modal-root`，不是只改了 URL 没开弹窗。
- 左侧操作区仍可见 `对战AI` 和 `教程模式` 两个按钮，右侧在线大厅区可见 `创建房间` 和空房间提示，详情结构完整。

## 结论

- 首页首次带 `game` 查询参数进入时，URL 驱动详情弹窗已恢复正常。
- 本次修复没有破坏移动端作者入口这条已有大厅详情链路。
