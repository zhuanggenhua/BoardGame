# 作祟 3「灰尘」房间伤害致死代表链 E2E 证据

## 覆盖范围

- 目标对象：作祟 3「灰尘」中，永久叛徒因火炉房这类非攻击房间伤害死亡后的狂热病患化链路。
- 真相来源：`docs/games/betrayal/haunts/03-the-dust.md` 中“叛徒死亡时用小怪物 token 替代成为 Feverish”的规则合同，以及当前伤害分配合同。
- 验收入口：真实牌桌 `/play/betrayal?players=3&playerID=1&seat0=human&seat1=human&seat2=human&seed=the-dust-room-damage-death`，通过状态注入直达灰尘作祟代表态。
- 当前边界：本文件只证明火炉房房间伤害代表链；倒塌房间坠落伤害已由领域测试覆盖。它不代表其它死亡保护组合、其它全部伤害来源或死亡叛徒怪物化全排列完成。

## 执行记录

- 静态检查：`npx eslint src/games/betrayal/game.ts src/games/betrayal/__tests__/firstScenarioRuntime.test.ts e2e/betrayal/betrayalTestHelpers.ts e2e/betrayal/the-dust-room-damage-death.e2e.ts`，0 errors / 5 existing warnings。
- 领域测试：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts --testNamePattern "灰尘永久叛徒因作祟后" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，2 passed / 296 skipped。
- 真实入口 E2E：`node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\the-dust-room-damage-death.e2e.ts "房间伤害"`，1 passed。

## 截图核验

| 截图 | 实际看到什么 | 是否达到验收标准 |
| --- | --- | --- |
| `01-火炉房伤害前.jpg` | 玩家 1「丽贝卡·艾伦博士」位于火炉房；顶部灰尘进度条显示剧本 3、研究 0、疾病标记 3、本人疾病 `4 / 5 / 6`、永久感染“是”、交换疾病需同房；底部结束回合按钮提示“火炉房：结束回合受伤，留在这里结束回合会受到 1 点物理伤害”。 | 达标。截图证明起点是灰尘作祟中的永久叛徒，且伤害来源是房间回合末效果。 |
| `02-火炉房伤害分配面板.jpg` | 点击结束回合后出现“伤害分配”面板，来源为“火炉房”，目标仍是玩家 1，伤害为 `1 点物理伤害`；可分配属性只有力量和速度，未选择时确认按钮禁用。 | 达标。截图证明火炉房伤害没有绕过玩家分配，也没有在确认前直接杀死玩家或生成狂热病患。 |
| `03-确认分配后狂热病患生成.jpg` | 选择力量并确认后，面板关闭；火炉房内保留玩家 1 的头像，同时新增狂热病患 token；当前回合交给玩家 2「达里尔·海拉」，未出现终局页。右侧队友列表中玩家 1 仍显示在火炉房，属性已到死亡态。 | 达标。截图证明确认分配后，永久叛徒因房间伤害死亡并生成 `feverish-1` 狂热病患，且本代表态没有错误触发终局。 |

## 结论

- 火炉房这类非攻击房间伤害已经接入灰尘永久叛徒死亡 -> 狂热病患化链路。
- 倒塌房间坠落伤害同一规则路径已有领域测试覆盖，但本截图组不展示倒塌房间 UI。
- 仍未完成：其它死亡保护组合、其它伤害来源和死亡叛徒怪物化路径全排列回归。
