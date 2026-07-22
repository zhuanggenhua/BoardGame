# 山屋惊魂作祟特殊行动预算 E2E 证据

## 范围

- 规则切片：作祟特殊行动每个来源每回合只能使用一次；已使用后不能消失成“没有动作”，而应保留对应作祟主动作入口并显示短禁用原因。
- 真实入口：`/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&playerID=1` 真实牌桌入口，经项目 harness 注入灰尘作祟代表态。
- 本次只证明“作祟特殊行动预算已用状态”的真实页面承接；不能外推为全部特殊行动、全部灰尘剧本或 50 个作祟完成。

## 验证命令

- `$env:PW_USE_DEV_SERVERS='false'; $env:PW_ALLOW_DEV_SERVER_TESTS='false'; npm run test:e2e:ci:file -- e2e/betrayal/haunt-special-action-budget.e2e.ts`
  - 结果：通过，`1 passed`。
- `npx eslint e2e/betrayal/haunt-special-action-budget.e2e.ts`
  - 结果：通过，0 errors。

## 截图

| 文件 | 绝对路径 | 画面结论 |
| --- | --- | --- |
| `01-作祟特殊行动已用禁用原因.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\haunt-special-action-budget\01-作祟特殊行动已用禁用原因.jpg` | 真实牌桌处于作祟后；底部主动作仍显示“寻找解药”，但按钮置灰；动作提示显示“本回合已使用该作祟特殊行动”；底部灰尘进度条仍显示研究、疾病和交换疾病状态。 |

## 自动断言摘要

- 页面进入真实 `betrayal-board`，注入状态为 `phase = haunt`、当前玩家 `1`、当前探索者在 `ground-north`。
- `usedCardIdsThisTurn` 包含 `search-for-cure`，`recommendedAction = use`。
- `betrayal-action-use` 可见，文案包含“寻找解药”。
- `betrayal-action-use` 为 disabled。
- `data-action-disabled-reason` 和 `title` 均为“本回合已使用该作祟特殊行动”。
- `betrayal-action-cue` 显示“本回合已使用该作祟特殊行动”。
- 页面没有记录前端致命错误。

## 图面核验

- 通过。截图是 1600x900 真实牌桌整屏，不是加载页、空白页、错误遮罩或替代说明页。
- 通过。画面顶部显示“恶兆后”，右侧显示作祟已开始，符合灰尘作祟后的验证位点。
- 通过。底部主动作区能看到“寻找解药”保留但置灰，旁边短提示说明“本回合已使用该作祟特殊行动”，不是把动作入口直接移除。
- 通过。底部灰尘进度条仍保留“剧本3查阅 / 灰尘 / 研究0处 / 疾病标记3枚 / 交换疾病可用”，说明预算提示没有替代作祟目标进度。

## 服务器相册

- 已发布：`http://8.148.71.102:18080/#/boardgame/betrayal-haunt-special-action-budget`。
- 服务器健康检查通过：`http://127.0.0.1:18080/health` 返回 `{"status":"ok"}`。
- 远端 `latest` 目录回查通过：包含 `manifest.json` 和 `01-01--.jpg`，图片文件非 0 字节。
- 公开详情页回查通过：手机视口打开相册后加载 1 张图片，实际图片元素类为 `mobile-viewer-image`，标题为“作祟特殊行动已用禁用原因”，图片自然尺寸为 `1600x900`。
- 根路径回查通过：`http://8.148.71.102:18080/` 仍显示任务列表，不是单图页或强制跳转。

## 未覆盖范围

- 尚未证明持有物特殊行动和房间特殊行动的真实入口截图相册完成；本次只覆盖作祟特殊行动预算中的灰尘剧本“寻找解药”已用状态。
- 尚未证明灰尘剧本完整目标、疾病交换、治愈灰尘、死亡、终局或所有边界完成。
- 尚未证明特殊行动切片整体完成；仍需继续补其它真实入口链路和截图证据。
- 尚未证明完整山屋规则实现完成；怪物系统、远程武器 / 视线高亮、尸体搜刮和 50 个作祟逐条合同仍需继续推进。
