# 山屋惊魂房间朝向选择 E2E 证据

## 范围

- 规则切片：探索新房间时，玩家从未探索走廊进入，翻出匹配区域房间，并决定新板块哪个走廊连接入口。
- 真实入口：`/play/betrayal` 真实牌桌入口，经项目 harness 注入代表态。
- 本次只证明“房间朝向选择 / 旋转 / 确认放置”这一新增交互；不能外推为山屋惊魂全部 P0 规则完成。

## 验证命令

- `npx eslint src/games/betrayal/Board.tsx src/games/betrayal/game.ts e2e/betrayal/room-placement-orientation.e2e.ts e2e/betrayal/explore-unknown-room.e2e.ts`
  - 结果：通过，0 errors；仍有既有 React compiler / 未用 helper warning。
- `npx eslint e2e/betrayal/room-placement-orientation.e2e.ts`
  - 结果：通过，0 errors。
- `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts src/games/betrayal/__tests__/Board.foundation.test.tsx --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过，`238 passed`。
  - 备注：测试结束后仍有 happy-dom 尝试连接 `localhost:3000` 的既有 `ECONNREFUSED` / `AbortError` 噪音，但 Vitest 结果为通过。
- `$env:PW_USE_DEV_SERVERS='false'; $env:PW_ALLOW_DEV_SERVER_TESTS='false'; npm run test:e2e:ci:file -- e2e/betrayal/room-placement-orientation.e2e.ts`
  - 结果：通过，`1 passed`。
- `$env:PW_USE_DEV_SERVERS='false'; $env:PW_ALLOW_DEV_SERVER_TESTS='false'; npm run test:e2e:ci:file -- e2e/betrayal/explore-unknown-room.e2e.ts`
  - 结果：通过，`1 passed`。

## 截图

| 文件 | 画面结论 |
| --- | --- |
| `01-选择未知门位.jpg` | 玩家已进入探索模式，地图上多个一层未知房间高亮；底部行动区停在“探索”，证明不是点房间即自动放置。 |
| `02-房间朝向选择.jpg` | 点击未知门位后出现“放置新房间”短操作面板；面板展示新房间预览、入口方向、当前旋转角度、左右旋转和确认放置按钮；面板已避开左侧角色信息区。 |
| `03-确认朝向后放置.jpg` | 确认后新房间“温室”已翻开放在所选门位，当前探索者 token 位于该房间，底部主动作切为“结束回合”。 |

## 自动断言摘要

- 旋转前后 `data-room-orientation-turns` 发生变化，且朝向值在 `0..3` 范围内。
- 朝向面板记录的入口边为 `north/east/south/west` 之一，且预览图中有一个门标记为连接入口。
- 确认后目标房间状态为 `discovered`，当前探索者房间和 active room 均为 `ground-north`。
- 目标房间保存的 `orientationTurns` 等于 UI 选择值。
- 目标房间门数据包含一条连接到原房间 `hallway` 的入口门。

## 图面核验

- 通过。第一张能看出玩家先选择未知门位，仍处于探索选择态。
- 通过。第二张能看出新房间由玩家旋转并确认，不再是自动朝向；面板位置没有压住左侧角色面板。
- 通过。第三张能看出放置结果回到牌桌态，新房间已经落到地图并承接探索者。

## 服务器相册

- 链接：`http://8.148.71.102:18080/#/boardgame/betrayal-room-placement-orientation`
- 回查：服务器本机 `/health` 返回 `{"status":"ok"}`。
- 回查：远端 `latest/manifest.json` 包含 3 张图，文件均存在且非 0 字节。
- 回查：浏览器打开详情页后，轮播第 1 张“选择未知门位”、第 2 张“房间朝向选择”、第 3 张“确认朝向后放置”均完成加载，尺寸均为 `1600x900`。
- 回查：根路径 `http://8.148.71.102:18080/` 仍显示任务列表，不是单图页或强制跳转。

## 未覆盖范围

- 尚未证明区域不匹配房间掩埋、区域耗尽不消耗移动力、完整未来可探索走廊保留。
- 尚未证明移动力快照、交易 / 特殊行动 / 攻击限制、怪物系统和 50 个作祟逐条合同完成。
- 尚未证明完整山屋规则实现完成；本截图组只作为 P0 房间朝向选择切片的 E2E 证据。
