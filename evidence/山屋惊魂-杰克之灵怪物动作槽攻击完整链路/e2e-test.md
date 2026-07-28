# 山屋惊魂 - 杰克之灵怪物动作槽攻击完整链路 E2E

## 验证目标

- 验证首剧本「赤红杰克归来」中，叛徒操控杰克之灵时，可以从牌桌底部怪物动作槽进入攻击态。
- 验证主路径点击的是地图上的怪物 token 和同房英雄 token 本体，不是旁路文字按钮。
- 验证点击同房英雄 token 后进入普通攻击骰盘，并显示杰克之灵攻击反馈。

## 执行命令

```powershell
node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/first-scenario-jack-spirit-monster-attack.e2e.ts "杰克之灵"
```

结果：`1 passed`。

## 预览相册

- 服务器相册：`http://8.148.71.102:18080/#/boardgame/betrayal-jack-spirit-monster-attack`
- 回查结果：服务器健康检查 `ok`；相册详情页 HTTP 200；三张公开图片和 `manifest.json` 均 HTTP 200。

## 截图证据

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-杰克之灵怪物动作槽攻击完整链路\01-杰克之灵攻击前牌桌可操作.jpg`
  - 牌桌处于作祟后怪物回合，底部主动作显示“杰克之灵攻击”。
  - 地下室东区能同时看到杰克之灵 token 和同房英雄 token。
  - 英雄 token 在攻击态前没有五边形目标高亮，说明目标热区没有提前常驻。

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-杰克之灵怪物动作槽攻击完整链路\02-杰克之灵与同房英雄目标高亮.jpg`
  - 点击“杰克之灵攻击”并点选杰克之灵 token 后，同房英雄 token 出现贴合本体的目标高亮。
  - 底部动作提示进入攻击选择态，玩家能从地图对象本体继续操作。
  - 画面没有出现替代列表或长规则正文抢占主交互。

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-杰克之灵怪物动作槽攻击完整链路\03-杰克之灵攻击骰盘.jpg`
  - 点击同房英雄 token 后，前景进入攻击骰盘。
  - 骰盘显示杰克之灵使用力量攻击，防守方为同房英雄。
  - 地图仍保留在背景，流程从怪物动作槽正确推进到攻击结算入口。

AI 核图联系图：`D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-杰克之灵怪物动作槽攻击完整链路\_ai-review-contact-sheet.jpg`。

## 边界说明

- 这条链只证明首剧本杰克之灵代表链：怪物动作槽 → 杰克之灵 token → 同房英雄 token → 攻击骰盘。
- 这条链不证明所有怪物的通用攻击目标 UI、逐作祟特殊攻击、完整多怪物回合排列、路径预览 UI 或 50 个作祟怪物定义都已完成。
