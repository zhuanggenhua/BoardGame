# 山屋惊魂作祟 3「灰尘」失败行动交换疾病标记 E2E 证据

> 证据状态：通过。
> 范围：只证明作祟 3「灰尘」中“寻找治愈线索失败 / 治愈灰尘失败时，与左侧存活玩家随机交换 1 个疾病标记”的代表链；寻找治愈线索失败和治愈灰尘失败都已有真实入口全员感染终局截图。不代表灰尘完整作祟完成。

## 验证命令

```powershell
node scripts\infra\vitest-cli-safe.mjs run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts --configLoader native -t "灰尘剧本寻找解药失败|灰尘剧本治愈灰尘失败"
```

结果：`2 passed / 280 skipped`。

```powershell
node scripts\infra\vitest-cli-safe.mjs run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts --configLoader native -t "寻找解药失败后若所有存活者|治愈灰尘失败后若所有存活者"
```

结果：`2 passed / 292 skipped`。

```powershell
node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\the-dust-failed-action-sickness-exchange.e2e.ts "寻找解药失败"
```

结果：`1 passed`。

```powershell
node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\the-dust-failed-action-sickness-exchange.e2e.ts "所有存活者"
```

结果：`1 passed`。

```powershell
node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\the-dust-failed-action-sickness-exchange.e2e.ts "治愈灰尘失败"
```

结果：`1 passed`。

```powershell
npx eslint src\games\betrayal\__tests__\firstScenarioRuntime.test.ts e2e\betrayal\betrayalTestHelpers.ts e2e\betrayal\the-dust-failed-action-sickness-exchange.e2e.ts
```

结果：`0 errors`。

## 覆盖点

- 寻找治愈线索失败时，系统会跳过死亡玩家，找到左侧下一名存活玩家并随机交换疾病标记。
- 治愈灰尘失败时，领域层按研究 token 加值计算失败结果，并复用同一条左侧存活玩家随机交换逻辑。
- 随机交换会实际改写双方疾病标记；编号 1 流入行动玩家后，该玩家永久成为叛徒。
- 本回合已交换疾病的玩家会写入交换记录；随后结束回合不会再触发“灰尘冲动”伤害分配。
- 寻找治愈线索失败后，如果交换疾病使所有存活探索者永久感染，真实终局页进入灰尘叛徒胜利。
- 治愈灰尘失败后，如果交换疾病使所有存活探索者永久感染，真实终局页进入灰尘叛徒胜利。

## 截图核验

| 截图 | 绝对路径 | 实际看到 | 验收结论 |
| --- | --- | --- | --- |
| 寻找解药失败前 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-failed-action-sickness-exchange\01-寻找解药失败前.jpg` | 真实牌桌处于剧本 3「灰尘」，当前玩家在预兆房间，底部主动作显示“寻找解药”，灰尘状态条显示本人疾病 `4 / 5 / 6`、永久感染为否。 | 达标：进入真实牌桌原位点，能证明行动入口来自灰尘特殊行动，不是临时页面。 |
| 失败后交换疾病 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-failed-action-sickness-exchange\02-寻找解药失败后交换疾病.jpg` | 投骰结果层显示“寻找解药 / 知识检定 / 交换疾病标记 / 总点数 0 / 返回牌桌”。 | 达标：失败结果进入“交换疾病标记”，而不是放置研究 token 或直接忽略失败后果。 |
| 结束回合不触发冲动伤害 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-failed-action-sickness-exchange\03-失败交换后结束回合不触发冲动伤害.jpg` | 返回牌桌后本人疾病变为 `1 / 5 / 6`，永久感染为是；点击结束回合后没有伤害分配面板，回合直接交给左侧存活玩家。 | 达标：失败交换已计入本回合交换记录，并阻止“灰尘冲动”伤害。 |
| 寻找解药失败全员感染叛徒胜利 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-failed-action-sickness-exchange\04-寻找解药失败全员感染叛徒胜利.jpg` | 终局页显示剧本结果“失败 / 叛徒得逞”，剧本为“灰尘”；右侧胜方栏显示叛徒得胜。 | 达标：寻找解药失败交换疾病后，全体存活探索者永久感染会进入灰尘叛徒胜利，而不是停在中间骰盘或回合继续。 |
| 治愈灰尘失败全员感染叛徒胜利 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-failed-action-sickness-exchange\05-治愈灰尘失败全员感染叛徒胜利.jpg` | 终局页显示剧本结果“失败 / 叛徒得逞”，剧本为“灰尘”；右侧胜方栏显示叛徒得胜。 | 达标：治愈灰尘失败交换疾病后，全体存活探索者永久感染会进入灰尘叛徒胜利，而不是停在中间骰盘或回合继续。 |

## 服务器相册

- 详情链接：`http://8.148.71.102:18080/#/boardgame/betrayal-the-dust-failed-action-sickness-exchange`
- 发布范围：只更新 `boardgame/betrayal-the-dust-failed-action-sickness-exchange` 任务相册数据目录，不改预览站壳层。
- 服务器回查：`http://127.0.0.1:18080/health` 返回 `{"status":"ok"}`；远端 `latest` 目录包含 `manifest.json` 和 5 张图片。
- 公开回查：详情页返回 HTTP 200；任务 API 返回 5 张图片；五张图片直链均返回 HTTP 200、`image/jpeg`，源图尺寸均为 `1600x900`。

## 不外推

- 未覆盖主动“控制冲动”的同意 / 拒绝全路径。
- 未覆盖寻找治愈线索成功放置研究 token 的真实入口全路径。
- 未覆盖治愈灰尘成功后的英雄胜利真实入口全路径。
- 未覆盖 If You Win 原文展示、逐属性 / 多研究 token 排列、同时胜负政策和死亡叛徒怪物化路径回归。

