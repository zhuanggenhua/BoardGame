# 山屋惊魂探索后结束回合 E2E 证据

## 范围

- 规则切片：玩家探索并放置新房间后，先结算房间 / 对应发现牌；发现结果仍阻塞时不能提前换人；玩家关闭发现结果后，本回合只能结束。
- 真实入口：`/play/betrayal` 真实牌桌入口，经项目 harness 注入恶兆前运行时，再由玩家真实点击移动、探索、选择门位、确认房间朝向、关闭发现结果和结束回合。
- 本次证明“探索完成后行动区收敛为结束回合”的 UI/规则承接；不能外推为完整探索异常、完整房间文字队列、完整物品 / 预兆 / 事件逐步确认 UI 或全部山屋规则完成。

## 验证命令

- `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "正式探索会从真实开放门位动态生成下一批未知房间，并在探索后结束当前回合" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过，`1 passed / 199 skipped`。
- `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "探索结算结束后行动栏只保留结束回合入口" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过，`1 passed / 85 skipped`。
  - 备注：测试结束后仍有 happy-dom teardown 的既有 `ECONNRESET` 噪声，但 Vitest 退出码为 0。
- `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/discovery-end-turn.e2e.ts`
  - 结果：通过，`1 passed`。
- `npx eslint src/games/betrayal/Board.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx e2e/betrayal/discovery-end-turn.e2e.ts public/locales/zh-CN/game-betrayal.json public/locales/en/game-betrayal.json`
  - 结果：通过，0 errors；两份 JSON 仍按项目 ESLint 配置显示 ignored warnings。
- `python D:\codex-home\skills\task-completion-guard\scripts\check_completion.py --state temp\betrayal-discovery-end-turn-guard.json`
  - 结果：通过，`COMPLETE`。

## 截图

| 文件 | 绝对路径 | 画面结论 |
| --- | --- | --- |
| `01-探索后结束回合-选择未知门位.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\discovery-end-turn\01-探索后结束回合-选择未知门位.jpg` | 玩家已移动到门厅并进入探索态；未知房间本体高亮，底部仍是正常行动栏。 |
| `02-探索后结束回合-确认新房间朝向.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\discovery-end-turn\02-探索后结束回合-确认新房间朝向.jpg` | 放置面板显示新房间、入口和确认朝向入口；规则仍处在探索结算中。 |
| `03-探索后结束回合-发现结果仍阻塞.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\discovery-end-turn\03-探索后结束回合-发现结果仍阻塞.jpg` | 新房间已经放置并出现发现结果；当前行动者仍是探索玩家，发现结果未关闭前不会提前切到下一位。 |
| `04-探索后结束回合-只剩结束回合.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\discovery-end-turn\04-探索后结束回合-只剩结束回合.jpg` | 发现浮层关闭后，底部行动区只剩“结束回合”；移动 / 探索 / 交易 / 使用 / 房间效果入口没有并列残留。 |
| `05-探索后结束回合-结束后下一位行动.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\discovery-end-turn\05-探索后结束回合-结束后下一位行动.jpg` | 玩家点击“结束回合”后行动者切到 AI 2 号，探索结束标记清空，下一位正常接手。 |

## 服务器相册

- 预览地址：`http://8.148.71.102:18080/#/boardgame/betrayal-discovery-end-turn`
- 发布范围：只更新 `boardgame/betrayal-discovery-end-turn` 任务数据目录，不修改预览站根页或应用壳层。
- 服务器回查：`/health` 返回 `{"status":"ok"}`；`latest/manifest.json` 状态为 `passed`，包含 5 张图。
- 浏览器回查：公开详情页标题显示“山屋惊魂探索后结束回合”，显示 `5 张`；移动端当前图 `选择未知门位` 成功加载为 `1600x900`。
- 原图直链回查：5 张 JPG 均返回 `200 image/jpeg`，长度分别为 `111745 / 120131 / 122248 / 122553 / 126424` 字节。

## 自动断言摘要

- 真实牌桌进入 `/play/betrayal`，注入恶兆前运行时。
- 玩家点击移动到门厅，再点击探索，未知门位本体高亮。
- 玩家点击 `ground-north` 并确认房间放置后，发现结果浮层可见，状态仍保持当前行动者为玩家 0。
- 关闭发现结果后，harness 状态满足 `turnEndedByDiscovery = true`、`recommendedAction = "endTurn"`、`currentPlayer = "0"`。
- 关闭发现结果后的行动区断言：`betrayal-action-endTurn` 可见且可点；`move / explore / trade / use / roomEffect` 五个行动入口均不存在。
- 点击“结束回合”后，状态切到 `currentPlayer = "1"`，且 `turnEndedByDiscovery = false`。

## 图面核验

- 通过。第 1、2 张证明玩家从真实牌桌对象进入探索和房间朝向确认，不是状态直塞最终图。
- 通过。第 3 张发现结果仍是阻塞阅读 / 确认态，行动权未提前交给下一位。
- 通过。第 4 张能直接看见底部只剩“结束回合”，没有并列的移动、探索、交易、使用或房间效果按钮；玩家第一眼知道下一步是结束回合。
- 通过。第 5 张证明点击结束回合后确实交给下一位玩家，而不是只隐藏按钮。

## 未覆盖范围

- 本次不证明所有房间文字 / 符号组合已经完整做成阻塞式结算队列。
- 本次不证明区域耗尽、区域不匹配、封死区域重抽或最小调整已有板块；这些见 `evidence/betrayal-core-interactions/room-discovery-failures/e2e-test.md`。
- 本次不证明完整怪物系统、完整作祟后回合规则或 50 个作祟逐条合同完成。
