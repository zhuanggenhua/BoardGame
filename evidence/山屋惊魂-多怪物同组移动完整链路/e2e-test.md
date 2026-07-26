# 山屋惊魂 - 多怪物同组移动完整链路 E2E

## 验证目标

- 验证同类型普通怪物只需要一次移动骰组结果，就会给同组每只怪物写入移动额度。
- 验证玩家进入怪物移动模式后，可直接点击地图上的不同怪物 token 来切换当前移动怪物。
- 验证两只怪物逐只点击真实房间本体移动时，位置和剩余移动额度按怪物分别扣减，不会互相覆盖。

## 执行命令

```powershell
node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/normal-monster-multi-move.e2e.ts "多怪物"
```

结果：`1 passed`。

配套领域回归：

```powershell
npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "同类型普通怪物共用一次移动骰" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
```

结果：`1 passed / 257 skipped`。

## 截图证据

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-多怪物同组移动完整链路\01-同组多怪物移动前牌桌可操作.jpg`
  - 牌桌处于作祟后怪物回合，入口大厅里能看到两只“测试怪物”token。
  - 底部主动作显示“移动测试怪物”，说明玩家从正式怪物移动槽进入，而不是走调试代理入口。

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-多怪物同组移动完整链路\02-第一只怪物目标房间高亮.jpg`
  - 点击移动槽并点选第一只怪物 token 后，目标房间出现绿色高亮。
  - 高亮贴合真实房间板块，玩家的下一步是点击房间本体完成移动。

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-多怪物同组移动完整链路\03-第一只移动后第二只仍可移动.jpg`
  - 第一只怪物移动到目标房间后，第二只怪物仍停留在入口大厅并继续显示可移动 token 状态。
  - 这证明移动额度不是整个同组一次性耗尽，而是按怪物分别扣减。

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-多怪物同组移动完整链路\04-第二只移动后同组额度各自结算.jpg`
  - 第二只怪物点击同一目标房间后，两只怪物都位于目标房间。
  - 底部不再显示怪物移动槽，说明两只怪物的本轮移动额度都已分别消耗完。

AI 核图联系图：`D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-多怪物同组移动完整链路\_ai-review-contact-sheet.jpg`。

## 边界说明

- 这条链证明“同类型两只普通怪物”代表链：同组一次移动骰、逐只点怪物 token、逐只点房间本体移动、各自扣减移动额度。
- 这条链不证明多类型怪物自然回合全排列、逐作祟特殊移动覆写、全部作祟特殊相邻、全部怪物定义或 50 个作祟完整怪物系统都已完成。
