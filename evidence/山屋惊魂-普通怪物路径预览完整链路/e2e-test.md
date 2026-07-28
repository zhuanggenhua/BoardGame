# 山屋惊魂 - 普通怪物路径预览完整链路 E2E

## 验证目标

- 验证非专用普通怪物已能从牌桌底部怪物移动槽进入移动态。
- 验证玩家点选地图上的怪物 token 后，真实相邻目标房间会在地图上高亮。
- 验证点击目标房间本体后，怪物位置和剩余移动额度同步更新。

## 执行命令

```powershell
node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/normal-monster-move-target.e2e.ts "普通怪物"
```

结果：`1 passed`。

## 截图证据

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-普通怪物路径预览完整链路\01-普通怪物移动前牌桌可操作.jpg`
  - 牌桌处于作祟后怪物回合，底部主动作显示“移动测试怪物”。
  - 入口大厅能看到普通怪物 token，目标房间尚未高亮，说明路径目标没有提前常驻。

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-普通怪物路径预览完整链路\02-普通怪物路径目标高亮.jpg`
  - 点击“移动测试怪物”并点选怪物 token 后，相邻门厅房间出现绿色房间高亮。
  - 高亮贴合真实房间板块，不是旁路列表或文字代理入口。

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-普通怪物路径预览完整链路\03-普通怪物移动后反馈.jpg`
  - 点击门厅房间本体后，测试怪物 token 移动到目标房间。
  - 反馈显示测试怪物从入口大厅移动到门厅并消耗移动力。
  - 玩家能直接看见移动后的地图状态。

AI 核图联系图：`D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-普通怪物路径预览完整链路\_ai-review-contact-sheet.jpg`。

## 边界说明

- 这条链只证明非专用普通怪物代表链：怪物移动槽 → 怪物 token → 相邻房间高亮 → 点击房间本体移动。
- 这条链不证明完整多怪物 / 多类型自然回合排列、全部怪物类型、全部作祟特殊相邻、逐作祟移动覆写或 50 个作祟怪物定义都已完成。
