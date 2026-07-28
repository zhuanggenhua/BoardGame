# 山屋惊魂幻影摄影师视线攻击 E2E 证据

## 范围

- 规则切片：作祟 33「魔法相机」中，幻影摄影师使用神志攻击，可攻击同楼层同直线视线内的英雄，胜出后造成精神伤害。
- 交互口径：攻击必须先走通用怪物动作槽「幻影摄影师攻击」；点击动作槽后，玩家再点摄影师 token 选定攻击者，再点英雄 token 结算。视线连线是反馈，不是代理按钮。
- 真实入口：`/play/betrayal?players=3&seat0=human&seat1=human&seat2=human` 真实牌桌入口，经项目 harness 注入魔法相机作祟代表态。
- 本次只证明“魔法相机幻影摄影师视线攻击代表链”；不能外推为完整怪物系统、所有怪物视线攻击、全部作祟或 50 个作祟合同完成。

## 验证命令

- `$env:PW_USE_DEV_SERVERS='false'; $env:PW_ALLOW_DEV_SERVER_TESTS='false'; npm run test:e2e:ci:file -- e2e/betrayal/non-p0-representative.e2e.ts "幻影摄影师视线攻击"`
  - 结果：通过，`1 passed`。

## 服务器相册

- 详情页：`http://8.148.71.102:18080/#/boardgame/betrayal-phantom-photographer-line-of-sight`
- 本地任务目录：`D:\gongzuo\webgame\image-preview\data\projects\boardgame\tasks\betrayal-phantom-photographer-line-of-sight\latest`
- 远端回查：`/home/admin/image-preview/data/projects/boardgame/tasks/betrayal-phantom-photographer-line-of-sight/latest/manifest.json` 包含 3 张图，状态为 `passed`，标题为“山屋惊魂幻影摄影师视线攻击”。
- 远端服务健康：`curl -fsS http://127.0.0.1:18080/health` 返回 `{"status":"ok"}`。
- 公开回查：详情页 HTTP 200；桌面宽度加载 3 张当前图片，图片均为 `1600x900`；根路径仍显示任务列表，不是单图页或临时替代页。

## 截图

| 文件 | 绝对路径 | 画面结论 |
| --- | --- | --- |
| `01-幻影摄影师攻击前牌桌可操作.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-幻影摄影师视线攻击完整链路\01-幻影摄影师攻击前牌桌可操作.jpg` | 真实牌桌处于作祟后；底部动作栏只显示「幻影摄影师攻击」动作槽；没有视线线、没有英雄目标外框、右侧队友卡没有“摄影师攻击”标签。 |
| `02-幻影摄影师视线连线与英雄目标高亮.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-幻影摄影师视线攻击完整链路\02-幻影摄影师视线连线与英雄目标高亮.jpg` | 点击「幻影摄影师攻击」后，地图上的摄影师 token 出现“攻击”短标签；入口大厅英雄 token 出现贴合外框，摄影师房间到英雄房间出现非交互视线线；右侧队友卡出现“摄影师攻击”短标签。 |
| `03-幻影摄影师攻击骰盘.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\山屋惊魂-幻影摄影师视线攻击完整链路\03-幻影摄影师攻击骰盘.jpg` | 点击英雄 token 后进入阻塞式骰盘；画面显示“幻影摄影师攻击 / 神志攻击 / 精神伤害 12”，6 颗骰子分散可见，总点数 12；骰盘不遮挡本轮关键起点关系。 |

## 自动断言摘要

- 页面进入真实 `betrayal-board`，注入状态为 `phase = haunt`，当前玩家为叛徒，作祟号为 33。
- 攻击前存在 `betrayal-action-monsterAttack`，文本为“幻影摄影师攻击”；不存在英雄目标外框和视线 overlay。
- 点击 `monsterAttack` 后按钮转为“取消攻击”；摄影师 token 可点，目标英雄 token 变成真实可点目标。
- `betrayal-line-of-sight-line-grand-staircase-entrance-hall-2` 记录来源房间 `grand-staircase`、来源怪物 `phantom-photographer-1`、目标房间 `entrance-hall`、目标玩家 `2`、类型 `phantom-photographer`。
- 点击英雄 token 后，最新反馈包含“幻影摄影师”和“精神伤害”，骰盘标题包含“幻影摄影师攻击”。
- 页面没有记录前端致命错误。

## 图面核验

- 通过。三张截图均来自 1600x900 真实牌桌整屏，不是加载页、错误遮罩、局部裁切或替代说明页。
- 通过。第一张没有提前显示视线线、目标高亮或队友“摄影师攻击”标签，证明攻击前状态没有泄漏选择态。
- 通过。第二张点击攻击槽后才显示摄影师“攻击”短标签、英雄目标外框和非交互视线线，交互入口落在真实 token 上。
- 通过。第三张骰盘可读，6 颗骰子逐颗可辨认，结算文本与幻影摄影师神志攻击、精神伤害一致。

## 未覆盖范围

- 尚未证明完整怪物系统完成。
- 尚未证明所有怪物视线攻击完成；本次只覆盖魔法相机幻影摄影师代表链。
- 尚未证明真实远程牌库完整录入完成。
- 尚未证明 50 个作祟逐条合同完成。
- 尚未证明 P0 全部完成；当前任务状态仍应保持 `in_progress`。
