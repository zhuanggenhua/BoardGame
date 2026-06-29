# 七大恨主页首回合黄金链 E2E 证据

## 本轮目标

- 从真实主页进入《七大恨》详情与创建房间弹窗。
- 通过真实建房链进入 `match` 页面。
- 在正式棋盘上完成大明首个基础回合，并确认控制权切给下一家。

## 用例入口

- `e2e/qidahen/homepage-first-turn.e2e.ts`

## 关键截图

- `test-results/evidence-screenshots/qidahen/homepage-first-turn/七大恨-首页进入并完成首回合-01-首页房间入口.png`
- `test-results/evidence-screenshots/qidahen/homepage-first-turn/七大恨-首页进入并完成首回合-02-进入对局后可操作.png`
- `test-results/evidence-screenshots/qidahen/homepage-first-turn/七大恨-首页进入并完成首回合-03-升级军备弃牌确认.png`
- `test-results/evidence-screenshots/qidahen/homepage-first-turn/七大恨-首页进入并完成首回合-04-首回合完成后.png`

## 执行结果

- 执行命令：`npm run test:e2e:dev:file -- e2e/qidahen/homepage-first-turn.e2e.ts`
- 最近一次结果：`1 passed`

## 肉眼核对结论

### 01 首页房间入口

- 可见真实主页上的《七大恨》详情与创建房间弹窗，不是状态注入页。
- `加入 AI` 已切到 `已开启`，`确认创建` 按钮可直接进入真实建房流程。

### 02 进入对局后可操作

- 已进入正式棋盘，左侧轮盘、右侧行动按钮、底部手牌、地图悬浮信息同时可见。
- 该图能证明首页建房后已经落到真实对局入口，且当前轮到大明执行首回合。
- 因本用例注入了 `skip image gate` 以避免素材门禁卡住，底图与部分卡图是浅底占位，不影响交互链验证。

### 03 升级军备弃牌确认

- `升级军备` 的支付确认面板已弹出。
- 已选中 2 张手牌，`确认执行` 按钮可见，能证明“先显示选择，再确认弃牌”的交互成立。

### 04 首回合完成后

- 右上回合条已经切到 `第 1 轮 · 蒙古 · 行动窗口`。
- 该图直接证明大明首个基础回合已经完成，控制权已交给下一家，链路可继续推进。
