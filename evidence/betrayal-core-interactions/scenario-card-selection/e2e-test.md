# 山屋惊魂剧本卡候选选择 E2E 证据

## 范围

- 规则切片：开局翻阅七张剧本卡、默认提议当前可运行的「木乃伊横行」、已选探索者共同确认剧本卡、共同确认进度、待接入剧本不能开局、回选可运行剧本后进入恶兆前牌桌。
- 真实入口：`/play/betrayal`，未使用状态注入。
- 不代表完成：其它作祟逐条运行时、属性轨、房间朝向、移动力快照、伤害分配、交易限制、武器声明等仍按全规则账本继续排队。

## 验证命令

- `npx eslint e2e/betrayal/scenario-card-selection.e2e.ts`
- `node scripts/infra/run-e2e-single.mjs default e2e/betrayal/scenario-card-selection.e2e.ts`

## 结果

- ESLint：`0 errors`。
- E2E：`1 passed`。
- 图面核验：通过。三张新图分别覆盖七张候选与 `剧本确认 0/1`、待接入「赤红杰克归来」确认后 `剧本确认 1/1` 仍不能开始、确认「木乃伊横行」后进入恶兆前牌桌。

## 截图

| 文件 | 画面结论 |
| --- | --- |
| `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\scenario-card-selection\01-七张剧本卡候选.jpg` | 弹窗显示七张候选剧本卡和共同确认进度 `剧本确认 0/1`；「木乃伊横行」是当前提议并标为可开局；「赤红杰克归来」显示待接入。 |
| `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\scenario-card-selection\02-待接入剧本卡不能开始.jpg` | 「赤红杰克归来」被确认后显示 `剧本确认 1/1`，但主按钮仍显示规则待接入、不能开始，并处于禁用态。 |
| `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\scenario-card-selection\03-确认木乃伊横行后进入牌桌.jpg` | 回选「木乃伊横行」并确认后进入恶兆前真实牌桌；右侧显示预兆 9、物品 22、事件 43 和作祟风险条。 |

## 历史旧图

- `01-五张剧本卡候选.jpg` 与 `03-确认赤红杰克后进入牌桌.jpg` 是 2026-07-24 的旧规则口径证据，只能作为历史记录；当前验收以本文件上方三张 2026-07-29 新截图为准。
