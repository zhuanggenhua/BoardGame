# 山屋惊魂木乃伊剧本流程 E2E 证据（2026-07-29）

## 范围

- 目标：验证当前首剧本「木乃伊横行」的公开揭示、分阵营剧本阅读、目标承接、英雄/叛徒结局朗读是否由真实 Board 入口消费。
- 非目标：不证明全牌库、全部房间效果、所有作祟、木乃伊自然整局长链已完成。
- 版本冲突：当前 74 张牌库合同只有 9 张预兆且不含「女孩」；本 E2E 按当前运行事实验证触发牌「书本」，木乃伊旧版触发示例里的「女孩」继续保留为 `disputed / representative-only`。

## 命令

```text
node scripts/infra/run-e2e-single.mjs default e2e/betrayal/scenario-flow-new-rules.e2e.ts
```

结果：通过；2 passed。shared-single runtime 端口复用失败后自动回退 isolated runtime，Playwright 进程最终退出码为 0。

## 截图核验

| 截图 | 绝对路径 | 肉眼观察结论 |
| --- | --- | --- |
| 公开揭示 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-scenario-flow-new-rules\01-公开揭示-作祟开始横幅.jpg` | 顶部横幅显示“公开揭示：作祟开始”；来源显示“剧本卡 木乃伊横行 / 触发 书本 / 作祟 1”；右侧作祟风险进度条可见。 |
| 开局叙事 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-scenario-flow-new-rules\02-开局叙事-独立电影字幕幕.jpg` | 以独立电影字幕幕显示木乃伊开场叙事，来源状态为“本地规则源正文”，不是旧“山屋异象”摘要。 |
| 英雄手册 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-scenario-flow-new-rules\03-英雄视角-秘密阅读-英雄手册.jpg` | 英雄视角显示驱逐目标和 6+ 知识考验；没有叛徒目标、怪物规则和叛徒结局。 |
| 叛徒手册 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-scenario-flow-new-rules\04-叛徒视角-秘密阅读-叛徒手册.jpg` | 叛徒视角显示木乃伊持有女孩、圣符/指环目标和木乃伊属性/攻击规则；没有英雄手册。 |
| 目标承接 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-scenario-flow-new-rules\05-目标承接-牌桌任务入口.jpg` | 牌桌任务入口显示“驱逐木乃伊”，右侧承接文字包含木乃伊、石棺和知识标记。 |
| 英雄结局 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-scenario-flow-new-rules\06-结局朗读-幸存者胜利.jpg` | 结局朗读显示“木乃伊犹如细砂随风飞散”等英雄结局正文；来源状态为“官方 If You Win 原文 / 正式翻译”；画面未显示翻译 key。 |
| 叛徒结局 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-scenario-flow-new-rules\07-结局朗读-叛徒胜利.jpg` | 结局朗读显示“整个世界不久都将臣服于我俩脚下”等叛徒结局正文；来源状态为“官方 If You Win 原文 / 正式翻译”；画面未混入杰克结局。 |

## 结论

- 当前结论等级：代表性玩法已验证。
- 已覆盖：剧本阅读信息流、阵营可见性、结局朗读正文、终局正文 key 消费、公开揭示真实运行来源。
- 未覆盖：全牌库逐卡 UI、全部房间效果、木乃伊中段自然流程、版本冲突裁定。
