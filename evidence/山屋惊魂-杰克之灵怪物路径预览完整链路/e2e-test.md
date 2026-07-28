# 山屋惊魂 - 杰克之灵怪物路径预览完整链路 E2E

## 验证目标

- 验证首剧本「赤红杰克归来」中，叛徒操控杰克之灵时，可以从底部怪物移动槽进入移动态。
- 验证玩家点选地图上的杰克之灵 token 后，真实相邻目标房间会在地图上高亮。
- 验证点击目标房间本体后，杰克之灵 token、专用杰克之灵房间状态和剩余移动额度同步更新。

## 本轮修复

- 修复 `MONSTER_MOVED` 事件只更新怪物列表位置、未同步杰克之灵专用房间状态的问题。
- 现在杰克之灵通过通用怪物移动命令移动后，会同步更新杰克之灵所在房间、杰克之灵已移动标记和当前控制位置。

## 执行命令

```powershell
npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "杰克之灵通过通用怪物移动命令" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1
node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/first-scenario-jack-spirit-monster-move-target.e2e.ts "杰克之灵"
```

结果：

- 领域回归：`1 passed / 252 skipped`。
- 真实入口 E2E：`1 passed`。

## 预览相册

- 服务器相册：`http://8.148.71.102:18080/#/boardgame/betrayal-jack-spirit-monster-move-target`
- 回查结果：
  - 服务器健康检查返回 `{"status":"ok"}`。
  - 相册接口 `http://8.148.71.102:18080/api/tasks/boardgame/betrayal-jack-spirit-monster-move-target` 返回 HTTP 200，`manifest` 记录 3 张图片。
  - 三张公开图片均返回 HTTP 200，大小分别为 99,121 / 100,875 / 101,369 bytes。
  - 移动端宽度浏览器打开详情页后，逐页切换验证 `截图 1 / 3`、`截图 2 / 3`、`截图 3 / 3` 均加载为 1600x900 图片。

## 截图证据

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-杰克之灵怪物路径预览完整链路\01-杰克之灵移动前牌桌可操作.jpg`
  - 牌桌处于作祟后怪物回合，底部主动作显示“移动杰克之灵”。
  - 地下室东区可见杰克之灵 token，目标房间尚未高亮，说明路径目标没有提前常驻。

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-杰克之灵怪物路径预览完整链路\02-杰克之灵路径目标高亮.jpg`
  - 点击“移动杰克之灵”并点选杰克之灵 token 后，地下室起始点出现绿色房间高亮。
  - 高亮贴合真实房间板块，不是旁路列表或文字代理入口。

- `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-杰克之灵怪物路径预览完整链路\03-杰克之灵移动后反馈.jpg`
  - 点击地下室起始点后，杰克之灵 token 移动到目标房间。
  - 反馈显示杰克之灵从裂隙移动到地下室起始点并消耗移动力。
  - 楼层切换器仍停在地下室，玩家能直接看见移动后的地图状态。

AI 核图联系图：`D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-杰克之灵怪物路径预览完整链路\_ai-review-contact-sheet.jpg`。

## 边界说明

- 这条链只证明首剧本杰克之灵代表链：怪物移动槽 → 杰克之灵 token → 相邻房间高亮 → 点击房间本体移动。
- 这条链不证明完整多怪物 / 多类型自然回合排列、全部怪物类型、全部作祟特殊相邻、完整路径预览系统或 50 个作祟怪物定义都已完成。
