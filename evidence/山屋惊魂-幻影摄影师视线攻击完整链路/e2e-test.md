# 山屋惊魂幻影摄影师视线攻击 E2E 证据

## 范围

- 规则切片：魔法相机剧本里，幻影摄影师使用神志攻击，可攻击视线内任意英雄，胜出后造成精神伤害。
- 交互口径：视线连线只是非交互反馈；目标选择和执行仍由英雄 token / 队友卡 / 主动作承接，不新增代理列表按钮。
- 真实入口：`/play/betrayal?players=3&seat0=human&seat1=human&seat2=human` 真实牌桌入口，经项目 harness 注入魔法相机作祟代表态。
- 本次只证明“魔法相机幻影摄影师视线攻击代表链”；不能外推为完整怪物系统、所有怪物视线攻击、全部作祟或 50 个作祟合同完成。

## 验证命令

- `$env:PW_USE_DEV_SERVERS='false'; $env:PW_ALLOW_DEV_SERVER_TESTS='false'; npm run test:e2e:ci:file -- e2e/betrayal/non-p0-representative.e2e.ts "幻影摄影师视线攻击"`
  - 结果：通过，`1 passed`。

## 服务器相册

- 详情页：`http://8.148.71.102:18080/#/boardgame/betrayal-phantom-photographer-line-of-sight`
- 回查：远端 `latest/manifest.json` 包含 3 张图，状态为 `passed`，标题为“山屋惊魂幻影摄影师视线攻击”。
- 回查：三张公开图片直链均返回 200，`Content-Type` 为 `image/jpeg`，大小分别为 136407 / 135676 / 118616 字节。
- 浏览器回查：桌面详情页真实加载 3 张 1600x900 图片；根路径仍显示“端到端截图”任务列表，不是单图页或临时替代页。

## 截图

| 文件 | 绝对路径 | 画面结论 |
| --- | --- | --- |
| `01-幻影摄影师攻击前牌桌可操作.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-幻影摄影师视线攻击完整链路\01-幻影摄影师攻击前牌桌可操作.jpg` | 真实牌桌处于作祟后；幻影摄影师在大阶梯，英雄目标在入口大厅；金色虚线从幻影摄影师房间指向目标房间，底部主动作显示“摄影师攻击达里尔·海拉”。 |
| `02-幻影摄影师视线连线与英雄目标高亮.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-幻影摄影师视线攻击完整链路\02-幻影摄影师视线连线与英雄目标高亮.jpg` | 右侧队友卡“达里尔·海拉”带金色选中框，地图上目标英雄 token 仍贴合高亮；视线线保持非交互指向反馈。 |
| `03-幻影摄影师攻击骰盘.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-幻影摄影师视线攻击完整链路\03-幻影摄影师攻击骰盘.jpg` | 点击主动作后进入阻塞式骰盘；骰盘显示“幻影摄影师攻击 / 神志攻击 / 精神伤害 12”，6 颗物理骰分散可见，总点数 12。 |

## 自动断言摘要

- 页面进入真实 `betrayal-board`，注入状态为 `phase = haunt`，当前玩家为叛徒，魔法相机剧本运行态存在幻影摄影师。
- `betrayal-room-monster-grand-staircase-phantom-photographer-1` 可见，证明攻击来源是地图上的幻影摄影师 token。
- `betrayal-line-of-sight-overlay` 可见；`betrayal-line-of-sight-line-grand-staircase-entrance-hall-2` 记录来源房间 `grand-staircase`、来源怪物 `phantom-photographer-1`、目标房间 `entrance-hall`、目标玩家 `2`、类型 `phantom-photographer`。
- 主动作文本显示“摄影师攻击达里尔·海拉”；点击后最新反馈包含“幻影摄影师”，骰盘标题包含“幻影摄影师攻击”。
- 页面没有记录前端致命错误。

## 图面核验

- 通过。三张截图均来自 1600x900 真实牌桌整屏，不是加载页、错误遮罩、局部裁切或替代说明页。
- 通过。前两张均能看到幻影摄影师与目标英雄之间的地图视线线，且目标英雄卡 / token 有选中态。
- 通过。视线线没有成为按钮或列表替代品；玩家仍通过队友卡、地图英雄 token 和主动作理解目标选择。
- 通过。骰盘截图中 6 颗骰子逐颗可辨认，结算文本与幻影摄影师神志攻击、精神伤害一致。

## 未覆盖范围

- 尚未证明完整怪物系统完成。
- 尚未证明所有怪物视线攻击完成；本次只覆盖魔法相机幻影摄影师代表链。
- 尚未证明真实远程牌库完整录入完成。
- 尚未证明 50 个作祟逐条合同完成。
- 尚未证明 P0 全部完成；当前任务状态仍应保持 `in_progress`。
