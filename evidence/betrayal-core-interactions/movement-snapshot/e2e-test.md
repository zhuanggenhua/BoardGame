# 山屋惊魂移动力快照 E2E 证据

## 范围

- 规则切片：回合开始按当前速度锁定本回合移动力；回合中速度变化不刷新本回合锁定移动力或剩余移动；下位玩家回合重新按其速度锁定。
- 真实入口：`/play/betrayal` 真实牌桌入口，经项目 harness 注入首剧本代表态；移动、使用物品和结束回合走正式牌桌命令链。
- 本次只证明“移动力快照”这一 P0 切片；不能外推为山屋惊魂全部基础规则完成。

## 验证命令

- `npx eslint e2e/betrayal/movement-snapshot.e2e.ts`
  - 结果：通过，0 errors。
- `npx tsc --noEmit --pretty false --skipLibCheck false --project tsconfig.json --incremental false`
  - 结果：通过。
- `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "回合开始按速度锁定移动力" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过，`1 passed / 164 skipped`。
- `$env:PW_USE_DEV_SERVERS='false'; $env:PW_ALLOW_DEV_SERVER_TESTS='false'; npm run test:e2e:ci:file -- e2e/betrayal/movement-snapshot.e2e.ts`
  - 结果：通过，`1 passed`。

## 截图

| 文件 | 绝对路径 | 画面结论 |
| --- | --- | --- |
| `01-回合开始移动力快照.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\movement-snapshot\01-回合开始移动力快照.jpg` | 玩家杰登·琼斯回合开始，右上移动 HUD 显示 `3/3` 和 `本回合 3`。 |
| `02-速度变化后移动力不回填.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\movement-snapshot\02-速度变化后移动力不回填.jpg` | 玩家先移动一步后使用奇怪的药品提升速度，右上移动 HUD 仍显示 `2/3`，证明速度变化没有回填本回合移动力。 |
| `03-下个玩家回合重新锁定移动力.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\movement-snapshot\03-下个玩家回合重新锁定移动力.jpg` | 结束回合后切到 AI 2 号位，右上移动 HUD 显示 `5/5` 和 `本回合 5`，证明新回合按新行动者速度重新锁定。 |

## 自动断言摘要

- 回合开始：`turnStartSpeed = 3`，`movesRemaining = 3`，HUD `data-turn-start-speed="3"` / `data-moves-remaining="3"`，可见文本包含 `3/3`。
- 真实移动一步后：`movesRemaining = 2`，`turnStartSpeed = 3`。
- 点击持有物本体“奇怪的药品”并执行使用后：当前速度提升到 `4`，但 `turnStartSpeed` 仍为 `3`，`movesRemaining` 仍为 `2`，HUD 可见文本为 `2/3`。
- 奇怪的药品已从持有区移除，`usedCardIdsThisTurn` 包含 `holy-water`，活动日志记录“埋葬奇怪的药品”。
- 点击结束回合后：当前玩家切为 `1`，当前速度为 `5`，`turnStartSpeed = 5`，`movesRemaining = 5`，HUD 可见文本为 `5/5`。

## 图面核验

- 通过。整屏 contact sheet 能看出三张截图来自同一真实牌桌入口，画面没有加载页、错误遮罩或替代页面。
- 通过。HUD 局部原图核验显示三态分别为 `3/3`、`2/3`、`5/5`，与规则断言一致。
- 通过。HUD 使用短状态和数值表达，没有在常驻主 UI 上写长规则说明。

## 服务器相册

- 链接：`http://8.148.71.102:18080/#/boardgame/betrayal-movement-snapshot`
- 回查：服务器本机 `/health` 返回 `{"status":"ok"}`。
- 回查：远端 `latest/manifest.json` 包含 3 张图，文件均存在且非 0 字节。
- 回查：浏览器打开详情页后，轮播第 1 张“回合开始移动力快照”、第 2 张“速度变化后移动力不回填”、第 3 张“下个玩家回合重新锁定移动力”均完成加载，尺寸均为 `1600x900`。
- 回查：根路径 `http://8.148.71.102:18080/` 仍显示任务列表，不是单图页或强制跳转。

## 未覆盖范围

- 尚未证明探索失败 / 区域耗尽不消耗移动力。
- 尚未证明障碍物离开成本、强制移动 owner、假门 / 门位相邻等移动规则细节。
- 尚未证明交易 / 特殊行动 / 攻击限制、怪物系统和 50 个作祟逐条合同完成。
- 尚未证明完整山屋规则实现完成；本截图组只作为 P0 移动力快照切片的 E2E 证据。
