# 山屋惊魂探索失败边界 E2E 证据

## 范围

- 规则切片：区域房间耗尽时，探索不能消耗移动力，也不能结束回合；玩家在真实牌桌选择未知门位后应看到短提示，而不是静默失败或误打开房间放置面板。
- 规则切片：正式翻找房间堆时，区域不匹配和会封死当前区域的房间应被记录为已掩埋，并继续翻到可放置房间；真实牌桌应在房间放置面板展示已掩埋房间列表。
- 规则切片：最后一张同区域房间若能连接入口但会封死该区域，不能自动确认放置；真实牌桌应提示先最小调整本区域已有板块，列出调整候选，玩家选中后才能确认放置。
- 真实入口：`/play/betrayal` 真实牌桌入口，经项目 harness 注入区域耗尽、区域不匹配、封死重抽、最后同区域房间需调整四个代表态。
- 本次证明“区域耗尽短提示 / 不打开放置面板 / 不改变回合状态”“区域不匹配 / 封死区域掩埋提示”和“最小调整已有板块候选选择后确认放置”的代表合法切片；不能外推为所有现实桌面极端调整方案或山屋惊魂全部 P0 规则完成。

## 验证命令

- `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "区域不匹配|封死|调整已有板块|区域房间池耗尽" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过，`4 passed / 172 skipped`。
- `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "区域耗尽|区域不匹配|调整已有板块|探索放置" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过，`3 passed / 75 skipped`。
  - 备注：测试结束后仍有 happy-dom teardown 的既有 `ECONNRESET` 噪声，但 Vitest 退出码为 0。
- `npx eslint src/games/betrayal/game.ts src/games/betrayal/Board.tsx src/games/betrayal/__tests__/firstScenarioRuntime.test.ts src/games/betrayal/__tests__/Board.foundation.test.tsx e2e/betrayal/room-discovery-failures.e2e.ts public/locales/zh-CN/game-betrayal.json public/locales/en/game-betrayal.json`
  - 结果：通过，0 errors；仍有既有 React compiler / 未用 helper / JSON ignored warning。
- `npx eslint e2e/betrayal/room-discovery-failures.e2e.ts`
  - 结果：通过，0 errors。
- `$env:PW_USE_DEV_SERVERS='false'; $env:PW_ALLOW_DEV_SERVER_TESTS='false'; npm run test:e2e:ci:file -- e2e/betrayal/room-discovery-failures.e2e.ts`
  - 结果：通过，`4 passed`。
- `openspec validate refactor-betrayal-core-interactions --strict --no-interactive`
  - 结果：通过。

## 截图

| 文件 | 绝对路径 | 画面结论 |
| --- | --- | --- |
| `01-区域房间耗尽提示.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\room-discovery-failures\01-区域房间耗尽提示.jpg` | 玩家处在真实牌桌探索态；一层未知房间仍高亮；左上显示“一层房间已耗尽”；画面没有出现“放置新房间”面板。 |
| `02-区域不匹配掩埋提示.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\room-discovery-failures\02-区域不匹配掩埋提示.jpg` | 玩家在一层未知门位探索时，正式房间堆先翻到二层“塔楼”和地下“储物间”并掩埋，继续翻到一层“火炉房”；放置面板显示“已掩埋：塔楼、储物间”。 |
| `03-封死区域掩埋重抽提示.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\room-discovery-failures\03-封死区域掩埋重抽提示.jpg` | 玩家在一层未知门位探索时，会封死当前区域的“测试死路房”被掩埋，继续重抽到“测试开放房”；放置面板显示“已掩埋：测试死路房”。 |
| `04-选择调整已有板块并确认.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\room-discovery-failures\04-选择调整已有板块并确认.jpg` | 玩家在一层未知门位探索到最后一张同区域死路房；放置面板显示“需先最小调整本区域已有板块，保留开放走廊”，并列出调整候选；第一项候选已被选中，确认放置按钮恢复可用。 |

## 自动断言摘要

- 真实牌桌进入 `/play/betrayal`，注入一层、二层、地下房间发现池均为空的代表态。
- 玩家点击“探索”后，`ground-north` 未知房间显示探索目标高亮。
- 点击 `ground-north` 后，页面出现 `betrayal-room-placement-failure`，文本为“一层房间已耗尽”。
- 页面没有 `betrayal-room-placement-panel`，证明不会误导玩家进入放置确认。
- harness 状态保持：`movesRemaining` 未变化，`turnEndedByDiscovery = false`，`ground-north.state = unexplored`。
- 区域不匹配链路：放置面板展示“火炉房”，`latestRoomDrawResolution.buriedRoomTiles` 和 `buriedRoomTiles` 均记录“塔楼、储物间”，确认后房间落在 `ground-north` 且回合因发现结束。
- 封死区域链路：放置面板展示“测试开放房”，`latestRoomDrawResolution.buriedRoomTiles` 和 `buriedRoomTiles` 均记录“测试死路房:sealedRegion”，确认后仍保留一层未探索边界。
- 最后一张同区域死路房链路：放置面板展示“测试最后死路房”和最小调整提示；未选择调整时确认按钮禁用，harness 状态保持 `ground-north.state = unexplored`、`movesRemaining` 未变化、`turnEndedByDiscovery = false`、`latestRoomDrawResolution = null`。
- 选择第一个调整候选后，候选按钮进入已选态，确认按钮恢复可用；点击确认后 `ground-north` 放置为“测试最后死路房”，区域仍有一层开放走廊，`latestRoomDrawResolution.requiresTileAdjustment = true`，玩家日志包含“先调整房间板块”。

## 图面核验

- 通过。截图来自真实牌桌入口，没有加载页、错误遮罩、替代页面或规则说明长文案。
- 通过。左上短提示清晰显示“一层房间已耗尽”；地图上的未知房间仍处于可见探索现场。
- 通过。画面中没有房间放置面板，符合“区域耗尽不翻新房间、不结束回合”的交互预期。
- 通过。区域不匹配截图显示放置面板中的“火炉房”和“已掩埋：塔楼、储物间”，证明不是直接吞掉错误房间，也不是停在错误楼层。
- 通过。封死区域截图显示“测试开放房”和“已掩埋：测试死路房”，证明会封死区域的候选房被记录并继续重抽。
- 通过。最小调整截图显示“测试最后死路房”和“需先最小调整本区域已有板块，保留开放走廊”，下方存在多个调整候选；第一项显示“已选”，确认放置按钮恢复可用，证明玩家已完成一个代表合法调整选择。

## 服务器相册

- 已发布：`http://8.148.71.102:18080/#/boardgame/betrayal-room-discovery-failures`。
- 服务器健康检查通过：`http://127.0.0.1:18080/health` 返回 `{"status":"ok"}`。
- 远端 `latest` 目录回查通过：包含 `manifest.json` 和 4 张截图文件；manifest 标题为“山屋惊魂探索失败边界”，图片标题包含“区域房间耗尽提示”“区域不匹配掩埋提示”“封死区域掩埋重抽提示”“选择调整已有板块并确认”。
- 浏览器真实加载回查通过：详情页显示 `1 / 4` 和 4 个缩略入口；四张公开 artifact 图片均完成加载，尺寸均为 1600x900，第四张标题为“选择调整已有板块并确认”；根路径 `http://8.148.71.102:18080/` 仍显示任务列表，没有被改成单图页。

## 未覆盖范围

- 尚未把完整探索规则宣称完成：本次只覆盖区域耗尽、区域不匹配、封死区域重抽和一个最小调整已有板块代表合法切片；其它探索异常和所有现实桌面极端调整方案仍需继续收口。
- 尚未证明特殊行动统一预算、远程武器 / 视线高亮、怪物系统和 50 个作祟逐条合同完成。
- 尚未证明完整山屋规则实现完成；本截图组只作为 P0 探索失败边界切片的 E2E 证据。
