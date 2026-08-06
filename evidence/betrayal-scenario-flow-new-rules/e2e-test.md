# 山屋惊魂木乃伊剧本流程 E2E 证据（2026-08-06）

## 范围

- 目标：验证首剧本「木乃伊横行」的公开揭示、开局剧情幕、英雄/叛徒分阵营阅读、真实翻页、正文末段滚动、目标承接和两种结局朗读。
- 本轮排除：房门、旋转和房间连接数据。
- 触发事实：当前运行夹具使用「书本」触发木乃伊横行；当前 74 张牌库合同不含「女孩」，女孩仅作为叛徒剧本中木乃伊持有的预兆牌同伴显示。

## 命令与结果

```text
npm run test:e2e:file -- e2e/betrayal/scenario-flow-new-rules.e2e.ts --workers=1
```

结果：`2 passed`，两条用例均从真实 `/play/betrayal` 入口完成；无业务致命前端错误。

翻页证据的门禁不是只看状态字段：E2E 会等待真实 V2 帧序列进入中间帧、确认当前帧图片已加载，再保存整屏截图；英雄和叛徒中间帧均与各自最终页不同。左右展开页分别检查正文滚动承载，短页不被错误要求滚动，长页滚到末端后保存末段截图。

## 当前截图核验

| 顺序 | 绝对路径 | 肉眼观察结论 |
| --- | --- | --- |
| 01 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-scenario-flow-new-rules\01-公开揭示-作祟开始横幅.jpg` | 牌桌上显示公开揭示横幅、木乃伊横行来源和作祟进度；不是剧本阅读页。 |
| 02 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-scenario-flow-new-rules\02-开局叙事-独立电影字幕幕.jpg` | 开局剧情幕使用黑幕压暗牌桌背景，正文与继续按钮位于中央；背景仍可辨认，不是纯黑不透明遮罩。 |
| 03a | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-scenario-flow-new-rules\03a-英雄视角-秘密阅读-真实翻页中.jpg` | 英雄阅读从 V2 本地 8 帧真实翻页序列取中间帧，翻页纸张覆盖在书面上，右页目标正文从纸后露出。 |
| 03 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-scenario-flow-new-rules\03-英雄视角-秘密阅读-英雄手册.jpg` | 英雄剧本显示驱逐目标和知识考验；没有叛徒/怪物/结局章节。 |
| 03b | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-scenario-flow-new-rules\03b-英雄视角-秘密阅读-正文末段.jpg` | 英雄长正文已滚到末段，短页保持完整；下一页按钮为禁用态。 |
| 04a | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-scenario-flow-new-rules\04a-叛徒视角-秘密阅读-真实翻页中.jpg` | 叛徒视角同样显示 V2 真实翻页中间帧，未用最终页静态图冒充。 |
| 04 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-scenario-flow-new-rules\04-叛徒视角-秘密阅读-叛徒手册.jpg` | 叛徒剧本显示木乃伊持有女孩、圣符和木乃伊战斗规则；没有英雄章节。 |
| 04b | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-scenario-flow-new-rules\04b-叛徒视角-秘密阅读-正文末段.jpg` | 叛徒长正文已滚到末段；结局章节未混进当前阅读页。 |
| 05 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-scenario-flow-new-rules\05-目标承接-牌桌任务入口.jpg` | 关闭剧本后回到真实牌桌，当前动作入口显示“驱逐木乃伊”，目标承接仍可找到。 |
| 06 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-scenario-flow-new-rules\06-结局朗读-幸存者胜利.jpg` | 幸存者结局以黑幕压暗背景展示最终正文与查看结果报告按钮；背景不是纯黑遮死。 |
| 07 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-scenario-flow-new-rules\07-结局朗读-叛徒胜利.jpg` | 叛徒结局同样以黑幕压暗背景展示正文与继续入口；未混入其他剧本结局。 |

## 结论

- 当前剧本流程 E2E：通过。
- 当前剧本截图视觉审计：11 张当前原图逐张检查，通过；翻页中间帧、开局/结局半透明压暗背景、分阵营内容隔离和正文末段均有直接图证。
- 未覆盖：全牌库逐卡 UI、全部房间效果、房门/旋转/房间连接数据、木乃伊自然整局长链。
