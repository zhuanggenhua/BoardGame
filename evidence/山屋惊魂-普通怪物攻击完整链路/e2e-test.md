# 山屋惊魂 - 普通怪物攻击完整链路 E2E

## 验证目标

- 验证非专用普通怪物已能从牌桌底部怪物动作槽进入攻击态。
- 验证主路径点击的是地图上的怪物 token 和同房英雄 token 本体，不是旁路文字按钮。
- 验证叛徒和死亡英雄不会成为普通怪物攻击目标。
- 验证点击同房英雄 token 后进入普通攻击骰盘，并生成“攻击”物理伤害分配。

## 执行命令

```powershell
node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/normal-monster-attack.e2e.ts "普通怪物"
```

结果：`1 passed`。

## 截图证据

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-普通怪物攻击完整链路\01-普通怪物攻击前牌桌可操作.jpg`
  - 牌桌处于作祟后怪物回合，底部主动作显示“测试怪物攻击”。
  - 入口大厅能同时看到普通怪物 token、同房英雄 token、叛徒 token 和尸体 token。
  - 英雄 token 在攻击态前没有五边形目标高亮，说明目标热区没有提前常驻。

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-普通怪物攻击完整链路\02-普通怪物与同房英雄目标高亮.jpg`
  - 点击“测试怪物攻击”并点选怪物 token 后，同房存活英雄 token 出现贴合本体的攻击高亮。
  - 叛徒 token 和死亡英雄尸体 token 没有目标高亮。
  - 底部动作提示进入攻击选择态，玩家从地图对象本体继续操作。

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-普通怪物攻击完整链路\03-普通怪物攻击骰盘.jpg`
  - 点击同房英雄 token 后，前景进入攻击骰盘 / 伤害分配界面。
  - 骰盘显示普通怪物攻击造成物理伤害，并等待受伤英雄分配。
  - 地图仍保留在背景，流程从怪物动作槽正确推进到攻击结算入口。

AI 核图联系图：`D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-普通怪物攻击完整链路\_ai-review-contact-sheet.jpg`。

## 边界说明

- 这条链只证明非专用普通怪物的代表链：怪物动作槽 → 怪物 token → 同房存活英雄 token → 攻击骰盘 / 伤害分配。
- 这条链不证明逐作祟特殊攻击覆写、完整多怪物自然回合、通用路径预览 UI 或 50 个作祟怪物定义都已完成。
