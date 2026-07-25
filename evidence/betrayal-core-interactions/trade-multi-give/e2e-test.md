# 山屋惊魂普通交易多张给出 E2E 证据

## 范围

- 规则切片：普通同房间探索者交易允许发起方一次给出任意数量物品 / 预兆，交易必须先等待接收方同意，同意后才结算。
- 真实入口：`/play/betrayal?players=3&seat0=human&seat1=human&seat2=human` 真实牌桌入口，经项目 harness 注入普通同房交易代表态；选择兔脚、书本、队友地图、提出请求和接收方同意都走正式牌桌命令链。
- 本次证明“普通同房交易多张给出 + 双方同意”代表链；不能外推为狗远距交易、交易牌面禁用提示完全收口、攻击后武器禁交易 UI、完整特殊行动预算或全部山屋规则完成。

## 验证命令

- `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "普通同房交易能在真实页面选择多张己方持有物并等待接收方同意" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过，`1 passed / 86 skipped`。
  - 备注：测试结束后仍有 happy-dom teardown 的既有 `ECONNRESET` 噪声，但 Vitest 退出码为 0。
- `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "同房间交易允许发起方一次给出任意多张持有物，接收方同意后才结算" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过，`1 passed / 200 skipped`。
- `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "交易" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过，`13 passed / 188 skipped`。
- `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/trade-multi-give.e2e.ts`
  - 结果：通过，`1 passed`。
- `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/first-scenario-trade-interaction.e2e.ts`
  - 结果：通过，`5 passed`。
  - 备注：首次运行被陈旧重任务预算记录拦截；对应 PID 已不存在，重试时由流程清理后通过。
- `npx eslint src/games/betrayal/Board.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx src/games/betrayal/__tests__/firstScenarioRuntime.test.ts e2e/betrayal/trade-multi-give.e2e.ts`
  - 结果：通过，0 errors；仅有 Babel 大文件提示。

## 截图

| 文件 | 绝对路径 | 画面结论 |
| --- | --- | --- |
| `01-普通交易选择多张己方持有物.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\trade-multi-give\01-普通交易选择多张己方持有物.jpg` | 普通交易流程条显示“你给出 兔脚、书本”，发起方持有区两张牌同时处于选中态，证明不再只能单选一张己方持有物。 |
| `02-普通交易选择对方地图.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\trade-multi-give\02-普通交易选择对方地图.jpg` | 交易摘要显示发起方给出兔脚和书本，并选择对方地图作为拿取项；这是不等价双方交换的代表态。 |
| `03-普通交易等待接收方同意.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\trade-multi-give\03-普通交易等待接收方同意.jpg` | 提出交易后进入“交易请求”阶段，底部出现“同意交易 / 拒绝”入口；交易尚未结算，仍需接收方确认。 |
| `04-普通交易同意后结算.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\trade-multi-give\04-普通交易同意后结算.jpg` | 接收方同意后请求消失；发起方持有区不再显示兔脚 / 书本，对方持有区出现兔脚和书本，发起方获得地图。 |

## 自动断言摘要

- 真实牌桌进入 `/play/betrayal?players=3&seat0=human&seat1=human&seat2=human`，注入普通同房交易代表态。
- 发起方在普通交易模式下连续点击兔脚和书本，页面状态同步保留两个已选中的己方持有物。
- 发起方选择同房队友后，可再选择对方地图作为拿取项，提交条件允许双方不等价交换。
- 提出交易后，领域状态进入 `pendingTradeAgreement`，活动玩家切到接收方；交易物没有跳过同意直接转移。
- 接收方同意后，兔脚和书本转给接收方，地图转给发起方；待同意交易清空。
- 旧交易 E2E 同时回归普通交易每回合一次、接收方同意和结算后行动区禁用状态，防止多选改动破坏既有交易链路。

## 图面核验

- 通过。四张图都来自真实牌桌入口，没有加载页、错误遮罩、静态草图或候选调试页。
- 通过。第 1、2 张能看出发起方一次选中两张己方持有物，并可继续选择对方地图。
- 通过。第 3 张能看出交易进入接收方确认，不是发起方提交后立即转移。
- 通过。第 4 张能看出同意后持有物实际换手，兔脚 / 书本从发起方侧消失并出现在接收方侧。

## 服务器相册

- 预览地址：`http://8.148.71.102:18080/#/boardgame/betrayal-trade-multi-give`
- 发布范围：只应更新 `boardgame/betrayal-trade-multi-give` 任务数据目录，不修改预览站根页或应用壳层。
- 服务器回查：`/health` 返回 `{"status":"ok"}`；远端 `latest/` 含 4 张 JPG 和 `manifest.json`。
- API 回查：`/api/tasks/boardgame/betrayal-trade-multi-give` 返回 `manifest.title = 山屋惊魂普通交易多张给出`、`status = passed`、`images.length = 4`。
- 原图直链回查：4 张 `/artifacts/projects/boardgame/tasks/betrayal-trade-multi-give/latest/...` 均返回 `200 image/jpeg`，长度分别为 `132037 / 134084 / 122124 / 106941` 字节。
- 浏览器回查：公开详情页标题显示“山屋惊魂普通交易多张给出”，显示 `4 张`；移动端首图 `选择多张己方持有物` 成功加载为 `1600x900`；桌面轮播能切到 `1 / 4` 至 `4 / 4`，四张图资源均为 `1600x900`。

## 未覆盖范围

- 本次不证明狗远距交易；狗交易任意数量与 4 格范围仍看既有狗交易代表链。
- 本次不证明交易牌面禁用原因 UI 完全收口；本回合已用持有物、狗作为来源不能同时交易、攻击后武器禁交易等仍按交易卡状态读模型 / 后续 UI 收口跟进。
- 本次不证明完整特殊行动预算、攻击声明、怪物系统、50 个作祟或完整山屋规则完成。
