# 山屋惊魂作祟 3「灰尘」控制冲动交换疾病标记 E2E 证据

> 证据状态：通过。
> 范围：只证明作祟 3「灰尘」中“控制冲动”主动发起、目标同意 / 拒绝、随机交换或不交换，以及目标同意后全员感染触发叛徒胜利的代表链，不代表灰尘完整作祟完成。

## 验证命令

```powershell
node scripts\infra\vitest-cli-safe.mjs run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts --configLoader native -t "灰尘剧本控制冲动"
```

结果：`2 passed / 282 skipped`。

```powershell
node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\the-dust-control-impulses-sickness-exchange.e2e.ts "控制冲动"
```

结果：`2 passed`。

```powershell
node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\the-dust-control-impulses-sickness-exchange.e2e.ts "永久感染"
```

结果：`1 passed`。

## 覆盖点

- 控制冲动入口必须从真实牌桌发起，并要求玩家点击同房探索者 token，而不是系统自动选择目标。
- 发起后会把操作权交给目标玩家，目标玩家视角显示同意 / 拒绝按钮。
- 目标同意后，系统随机交换双方 1 个疾病标记；编号 1 流入发起方后，发起方永久成为叛徒；双方写入本回合已交换记录。
- 目标拒绝后，等待态被清空，双方疾病标记不变，永久叛徒名单不变，且不写入本回合已交换记录。
- 如果目标同意后所有存活探索者都已永久感染，且其余探索者已死亡，真实终局页会进入灰尘剧本的叛徒胜利。

## 截图核验

| 截图 | 绝对路径 | 实际看到 | 验收结论 |
| --- | --- | --- | --- |
| 发起前 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-control-impulses-sickness-exchange\01-控制冲动发起前.jpg` | 真实牌桌处于剧本 3「灰尘」，当前玩家与杰登同房，灰尘状态条显示本人疾病 `4 / 5 / 6`、永久感染为否，底部有“交换疾病”入口。 | 达标：进入真实牌桌原位点，证明控制冲动入口和同房目标都存在。 |
| 等待同意 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-control-impulses-sickness-exchange\02-控制冲动等待同意.jpg` | 发起方点同房目标后，底部横幅显示“已向杰登·琼斯发送疾病交换请求，等待杰登·琼斯同意”。 | 达标：控制权切到目标玩家前，发起方处于等待目标同意状态。 |
| 同意后交换 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-control-impulses-sickness-exchange\03-控制冲动同意后交换疾病.jpg` | 目标玩家同意后返回牌桌；目标视角疾病变为 `4 / 7 / 8`，仍永久感染为是，等待横幅消失。 | 达标：同意分支完成交换；领域断言另证明发起方获得编号 1 并永久感染。 |
| 拒绝等待 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-control-impulses-sickness-exchange\04-控制冲动拒绝等待同意.jpg` | 发起方再次发起控制冲动，底部横幅处于等待目标同意状态。 | 达标：拒绝分支使用同一真实入口和目标同意面板。 |
| 拒绝后未交换 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-control-impulses-sickness-exchange\05-控制冲动拒绝后未交换.jpg` | 目标玩家拒绝后返回牌桌；目标视角仍显示原疾病 `1 / 7 / 8`、永久感染为是，等待横幅消失。 | 达标：拒绝分支清空等待态且不交换疾病；领域断言另证明发起方疾病仍为 `4 / 5 / 6`。 |
| 全员感染叛徒胜利 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-control-impulses-sickness-exchange\06-控制冲动全员感染叛徒胜利.jpg` | 剧本结果页显示剧本“灰尘”，中央为“失败 / 叛徒得逞”，右侧赢家为叛徒；终局叙事写明疾病吞没探索者、山屋只剩灰雾与低语。 | 达标：目标同意交换后，所有存活者永久感染这一胜利条件进入真实终局页。 |

## 不外推

- 未覆盖寻找治愈线索成功放置研究 token 的真实入口全路径。
- 未覆盖治愈灰尘成功后的英雄胜利真实入口全路径。
- 未覆盖其它交换来源、其它伤害来源或死亡事件触发全员感染 / 死亡叛徒怪物化的全排列回归。
