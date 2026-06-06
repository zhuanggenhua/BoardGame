# 幻想国度 UI 多风格静态稿审查

> 日期：`2026-06-05`
>
> 页面：`evidence/fantasyrealms/fantasyrealms-ui-style-lab.html`
>
> 设计规范：`design-system/games/fantasyrealms.md`

## 共同验收点

- 7 张手牌是第一视觉对象，未再缩成装饰条。
- 焦点牌、当前组合得分、弃置动作围绕手牌组织。
- 抽牌来源和弃牌区按规则保留为次级但常驻信息。
- 弃牌 `7 / 10` 终局进度清晰可见。
- 未引入地图、行动点、任务栏、科技树或常驻日志。

## 四版结论

| 版本 | 截图 | 适用判断 |
|---|---|---|
| 实体牌桌 | `fantasyrealms-ui-style-tabletop.png` | 最接近真实桌游，推荐作为默认方向继续实现 |
| 奥术计分 | `fantasyrealms-ui-style-arcane.png` | 题材感最强，但背景装饰更重，适合作为高级皮肤方向 |
| 亮面计分册 | `fantasyrealms-ui-style-ledger.png` | 可读性强，适合教学、结算或移动横屏降级方向 |
| 竞技清晰 | `fantasyrealms-ui-style-tournament.png` | 信息边界清楚，适合线上对局，但幻想感弱于实体牌桌 |

## 推荐

首版可运行 UI 建议以“实体牌桌”为主方向，吸收“竞技清晰”的按钮与状态可读性，不采用“奥术计分”的强放射背景作为默认。

“亮面计分册”可保留给规则教学、结算页或移动端低干扰版本。

