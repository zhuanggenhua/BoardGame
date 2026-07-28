# 山屋惊魂 - 多类型怪物移动骰组真实入口 E2E

## 验证目标

- 验证不同名称 / 不同速度的普通怪物会拆成多个移动骰组，而不是只用一个代表按钮吞掉后续组。
- 验证第一组移动骰掷完并关闭骰盘后，动作栏会继续开放第二组移动骰入口。
- 验证全部移动骰组掷完后，怪物移动槽才出现，并且玩家可直接点击地图上的怪物 token 进入移动目标选择。

## 执行命令

```powershell
node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/normal-monster-movement-groups.e2e.ts "多类型怪物移动骰组"
```

结果：`1 passed`。

配套领域回归：

```powershell
npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "多类型普通怪物移动骰组" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
```

结果：`1 passed / 258 skipped`。

## 截图证据

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-多类型怪物移动骰组真实入口\01-慢速怪物移动骰入口.jpg`
  - 牌桌处于作祟后怪物回合，入口大厅里能看到慢速怪物和快速怪物 token。
  - 底部动作栏先显示“慢速怪物移动骰”，说明第一个移动骰组来自正式动作槽，而不是调试代理入口。

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-多类型怪物移动骰组真实入口\02-慢速怪物移动骰结果.jpg`
  - 点击慢速怪物移动骰后，阻塞式骰盘展示“慢速怪物移动”和“每只可移动 2 间”。
  - 该图证明第一组掷骰有真实骰盘确认步骤，不是后台静默写状态。

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-多类型怪物移动骰组真实入口\03-快速怪物移动骰入口.jpg`
  - 关闭慢速怪物骰盘后，底部动作栏继续显示“快速怪物移动骰”。
  - 这直接覆盖“第一组掷完后第二组仍开放”的真实入口风险点。

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-多类型怪物移动骰组真实入口\04-两组掷完后怪物移动入口.jpg`
  - 快速怪物骰盘关闭后，移动骰入口消失，底部动作栏改为“移动慢速怪物”。
  - 地图上两只怪物 token 仍在入口大厅，说明此时进入的是怪物移动阶段，而不是漏掉第二组后提前结束。

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-多类型怪物移动骰组真实入口\05-慢速怪物目标房间高亮.jpg`
  - 点击怪物移动槽并点慢速怪物 token 后，真实相邻房间出现绿色高亮。
  - 高亮贴合房间板块，下一步交互对象是房间本体。

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-多类型怪物移动骰组真实入口\06-快速怪物目标房间高亮.jpg`
  - 在同一移动模式下再点快速怪物 token，目标房间同样出现高亮。
  - 该图证明两组移动骰都完成后，两种怪物都可从真实 token 进入路径预览。

AI 核图联系图：`D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-多类型怪物移动骰组真实入口\_ai-review-contact-sheet.jpg`。

## 边界说明

- 这条链证明“多类型普通怪物移动骰组”的代表链：慢速怪物先掷骰、快速怪物后掷骰、全部掷完后进入真实怪物 token 移动入口。
- 这条链不证明完整多怪物自然回合全排列、逐作祟特殊移动覆写、全部作祟特殊相邻、全部怪物定义或 50 个作祟完整怪物系统都已完成。
