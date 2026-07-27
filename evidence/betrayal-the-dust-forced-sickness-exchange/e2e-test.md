# 山屋惊魂作祟 3「灰尘」同房强制交换疾病标记 E2E 证据

> 证据状态：通过。
> 范围：只证明作祟 3「灰尘」中“当前探索者结束回合时与多名同房探索者逐个强制随机交换疾病标记”，以及该来源导致所有存活探索者永久感染后进入叛徒胜利的代表链；不代表灰尘完整作祟完成。

## 验证命令

```powershell
node scripts\infra\vitest-cli-safe.mjs run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts --configLoader native -t "灰尘剧本回合结束会逐个|灰尘剧本回合内没有交换|灰尘隐藏叛徒因未交换"
```

结果：`3 passed / 276 skipped`。

```powershell
node scripts\infra\vitest-cli-safe.mjs run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts --configLoader native -t "同房强制交换后若所有存活者"
```

结果：`1 passed / 291 skipped`。

```powershell
node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\the-dust-forced-sickness-exchange.e2e.ts "强制交换"
```

结果：`2 passed`。

```powershell
node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\the-dust-forced-sickness-exchange.e2e.ts "所有存活者"
```

结果：`1 passed`。

```powershell
npx eslint src\games\betrayal\__tests__\firstScenarioRuntime.test.ts e2e\betrayal\the-dust-forced-sickness-exchange.e2e.ts
```

结果：`0 errors`。

## 修复点

- 根因：回合末强制交换原先先批量预览所有交换，再统一应用；当前玩家连续与多名同房探索者交换时，第二次预览可能仍引用第一次交换前的旧疾病标记，导致后续交换被跳过。
- 修复：`resolveDustEndTurn()` 改为按同房目标顺序“生成一次交换 -> 立即应用到预览状态 -> 再生成下一次交换”，保证多目标强制交换逐个吃到最新疾病标记状态。
- 领域断言：玩家 1 与同房玩家 0、2 结束回合时交换 2 次疾病标记；不会进入“灰尘冲动”伤害；编号 1 的中间持有人和最终持有人都永久感染；进入下一玩家回合后本回合交换记录清空。
- 新增代表断言：若同房强制交换后所有存活探索者都已经永久感染，且剩余探索者已死亡，结算后进入灰尘叛徒胜利终局。

## 截图核验

| 截图 | 绝对路径 | 实际看到 | 验收结论 |
| --- | --- | --- | --- |
| 结束回合前 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-forced-sickness-exchange\01-灰尘同房强制交换结束回合前.jpg` | 真实牌桌处于剧本 3「灰尘」，顶部显示研究 / 疾病标记 / 交换疾病状态；当前玩家是丽贝卡，房间「门厅」内可见三名探索者同房，底部“结束回合”可点击。 | 达标：进入真实牌桌原位点，能证明当前探索者与多名探索者同房，且不是加载页、错误页或临时页面。 |
| 交换后交接 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-forced-sickness-exchange\02-灰尘同房强制交换后交接.jpg` | 伤害分配面板没有出现，当前回合切到达里尔；地图仍显示多名探索者在门厅，顶部灰尘状态条和牌堆区作祟状态仍正常显示。 | 达标：多目标同房强制交换后直接交接，不触发未交换疾病的冲动伤害分配。 |
| 全员感染叛徒胜利 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-forced-sickness-exchange\03-同房强制交换全员感染叛徒胜利.jpg` | 真实终局页显示剧本「灰尘」，中央为“失败 / 叛徒得逞”，右侧赢家阵营为叛徒。 | 达标：证明同房强制交换这一来源也能在所有存活者永久感染后进入灰尘叛徒胜利，而不是只停在交接状态。 |

## 服务器相册

- 详情链接：`http://8.148.71.102:18080/#/boardgame/betrayal-the-dust-forced-sickness-exchange`
- 发布范围：只更新 `boardgame/betrayal-the-dust-forced-sickness-exchange` 任务相册数据目录，不改预览站壳层。
- 服务器回查：`http://127.0.0.1:18080/health` 返回 `{"status":"ok"}`；远端 `latest` 目录包含 `manifest.json` 和 3 张图片。
- 浏览器核验：公开详情页返回 HTTP 200；远端 manifest 标题为“山屋惊魂灰尘同房强制交换代表链”，包含 3 张图片；三张图片直链均返回 HTTP 200，尺寸源图均为 `1600x900`。

## 不外推

- 未覆盖主动“控制冲动”的同意 / 拒绝全路径。
- 未覆盖寻找治愈线索或治愈失败时与左侧玩家的随机交换触发全员感染终局。
- 未覆盖隐藏编号完整可见性：自己可见、他人不可见、死亡不揭示、永久感染状态不泄露。
- 未覆盖研究 / 治愈全路径 UI、同时胜负政策或完整终局边界。
