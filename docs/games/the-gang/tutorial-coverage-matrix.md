# 纸牌帮 The Gang 教程闭环覆盖矩阵

## 判层结果

- 跨游戏判断方法：基础教程不能只证明按钮能点，必须覆盖一个玩家可感知的最小乐趣闭环：真实选择、可见因果、结果反馈。
- 当前游戏专项答案：The Gang 首教闭环落在“读底牌牌力 -> 读牌型强弱 -> 拿筹码表达排名 -> 公共牌改变判断 -> 红筹码锁定最终排序 -> 摊牌结算并读懂结果”。
- 专项答案下沉位置：`src/games/the-gang/tutorial.ts`、`public/locales/*/game-the-gang.json`、`src/games/the-gang/__tests__/tutorial.test.tsx` 和本文档。

## 当前真相

| 项 | 当前状态 | 证据 |
| --- | --- | --- |
| 规则真相源 | 基础版 3-6 人，4 轮抢劫，3 成功胜利 / 3 失败失败 | `docs/games/the-gang/base-rules-contract.md` |
| 正式桌面入口 | 已有底牌、筹码区、公共牌区、下一轮、摊牌、摊牌结果锚点 | `src/games/the-gang/Board.tsx` |
| 旧教程缺口 | 只有 `TAKE_CHIP` 一个真实动作，未把推进公共牌和摊牌反馈纳入教程动作链；牌型强弱只以短标签出现，未明确教学；摊牌读法只说结果存在，未教玩家如何判断顺序是否对上 | `src/games/the-gang/tutorial.ts` 旧步骤 |
| 本次修正 | 增加 4 轮筹码、公共牌推进、红筹码最终承诺、牌型强弱参考与摊牌读法步骤，并补语言包、单测与桌面 E2E 截图链 | 当前补丁；`npx vitest run src/games/the-gang/__tests__/tutorial.test.tsx --configLoader native` 通过；`node scripts/infra/run-e2e-single.mjs ci e2e/the-gang/the-gang-tutorial.e2e.ts "桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈"` 2026-07-05 17:06 以 1920×1080 基线通过，并包含公共牌、历史筹码、当前筹码图片真实加载断言 |

## 桌面教程 E2E 截图链

截图目录：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\the-gang\the-gang-tutorial.e2e\桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈`

| 截图 | 绝对路径 | 肉眼核对点 |
| --- | --- | --- |
| 教程开场目标和胜负条件 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\the-gang\the-gang-tutorial.e2e\桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈\教程开场目标和胜负条件.jpg` | 开场先讲 3 成功 / 3 失败和基础回合目标 |
| 教程读底牌和当前牌型 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\the-gang\the-gang-tutorial.e2e\桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈\教程读底牌和当前牌型.jpg` | 玩家可见自己的底牌、当前牌型和读牌力提示 |
| 教程牌型强弱参考 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\the-gang\the-gang-tutorial.e2e\桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈\教程牌型强弱参考.jpg` | 明确教学高牌到皇家同花顺的强弱顺序 |
| 教程首轮全员拿白筹码 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\the-gang\the-gang-tutorial.e2e\桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈\教程首轮全员拿白筹码.jpg` | 三名玩家均有白筹码，下一轮按钮可推进 |
| 教程推进后公共牌出现 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\the-gang\the-gang-tutorial.e2e\桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈\教程推进后公共牌出现.jpg` | 公共牌从 0 张推进到 3 张，玩家重新估牌力 |
| 教程红筹码最终承诺 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\the-gang\the-gang-tutorial.e2e\桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈\教程红筹码最终承诺.jpg` | 已经过黄/橙筹码和 5 张公共牌，进入红筹码最终判断 |
| 教程满元素待摊牌 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\the-gang\the-gang-tutorial.e2e\桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈\教程满元素待摊牌.jpg` | 三名玩家均有历史筹码和当前红筹码，中央有 5 张公共牌，摊牌按钮可用 |
| 教程摊牌结果反馈 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\the-gang\the-gang-tutorial.e2e\桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈\教程摊牌结果反馈.jpg` | 摊牌结果区显示成功/失败、玩家红筹码与牌型反馈 |
| 教程摊牌读法 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\the-gang\the-gang-tutorial.e2e\桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈\教程摊牌读法.jpg` | 明确教学先看每位玩家牌型，再看红筹码数字是否与真实牌力顺序一致 |

补充复核：`教程满元素待摊牌.jpg` 与 `教程摊牌结果反馈.jpg` 已在 PureRef 打开；AI 复看 `temp/the-gang-intake/the-gang-1920-desktop-contact.jpg` 确认教程图里公共牌、历史筹码、当前红筹码和摊牌反馈可见，不再是资源白块。

## 教程覆盖矩阵

| 规则条目 | 教程步骤 | 真实承接物 | 当前状态 | 证据截图 |
| --- | --- | --- | --- | --- |
| 3 次抢劫成功获胜，3 次失败失败 | `intro`、`goal-track` | 标题区、金条/警报轨 | 已覆盖 | `教程开场目标和胜负条件.jpg` |
| 玩家看自己的两张底牌并估牌力 | `hand` | 本地手牌区与牌型短标签 | 已覆盖 | `教程读底牌和当前牌型.jpg` |
| 德州扑克基础牌型强弱 | `hand-rank-reference` | 牌型强弱参考 | 已补为明确教学项，不再只依赖短标签 | `教程牌型强弱参考.jpg` |
| 每轮用筹码表达相对牌力 | `chip-choice`、`yellow-chip`、`orange-chip`、`final-chip` | 当前颜色筹码按钮 | 已覆盖，玩家真实执行 `TAKE_CHIP` | `教程首轮全员拿白筹码.jpg`、`教程红筹码最终承诺.jpg`、`教程满元素待摊牌.jpg` |
| 选筹码阶段只公开筹码，不公开他人手牌 | `table-response`、`yellow-response`、`orange-response`、`final-response` | 玩家区历史/当前筹码 | 已覆盖 | `教程首轮全员拿白筹码.jpg`、`教程满元素待摊牌.jpg` |
| Round 2 翻 3 张公共牌 | `advance-round`、`community-cards` | `下一轮` 按钮、公共牌区 | 已覆盖，玩家真实执行 `END_ROUND` | `教程推进后公共牌出现.jpg` |
| Round 3/4 继续翻公共牌并重估 | `yellow-chip`、`turn-round`、`turn-card`、`orange-chip`、`river-round`、`final-chip` | 公共牌区、黄/橙/红筹码区 | 已覆盖，玩家真实执行中间轮次 `TAKE_CHIP` 与 `END_ROUND`，E2E 覆盖到 5 张公共牌 | `教程红筹码最终承诺.jpg`、`教程满元素待摊牌.jpg` |
| 第 4 轮红筹码决定最终判定 | `final-chip`、`final-response` | 红筹码按钮 | 已覆盖，玩家真实执行 `TAKE_CHIP`，三名玩家红筹码齐全 | `教程满元素待摊牌.jpg` |
| 摊牌比较真实牌力顺序和红筹码顺序 | `reveal-showdown`、`showdown`、`showdown-reading` | `摊牌` 按钮、摊牌结果区 | 已覆盖，玩家真实执行 `REVEAL_SHOWDOWN`，并明确教学“看牌型 -> 看红筹码数字 -> 判断顺序是否对上” | `教程摊牌结果反馈.jpg`、`教程摊牌读法.jpg` |

## 一级交互审查表

| 规则动作 | 当前正式局入口 | 真实承接物 | 提示 UI | 状态 |
| --- | --- | --- | --- | --- |
| 拿当前轮筹码 | 当前轮筹码按钮 | `RoundChipColumn` 内按钮 | 教程气泡只提示 | 真实可用 |
| 推进到下一轮 | 所有人拿完筹码后出现/启用 `下一轮` | `the-gang-next-round` 按钮 | 教程气泡只提示 | 真实可用 |
| 摊牌 | 第 4 轮所有人拿完红筹码后出现/启用 `摊牌` | `the-gang-reveal-showdown` 按钮 | 教程气泡只提示 | 真实可用 |
| 查看摊牌结果 | 摊牌后结果区 | `the-gang-showdown-area` | 教程气泡解释牌型、红筹码和成功/失败关系 | 真实可用 |

## 教学闭环表

| 教学目标 | 真实案例 | 结果反馈 | 当前状态 |
| --- | --- | --- | --- |
| 理解赢法 | 金条/警报轨展示 3 成功 / 3 失败 | 胜负进度可见 | 已覆盖 |
| 做出真实选择 | 玩家选择当前可用筹码 | 当前玩家筹码出现在手牌区和玩家区 | 已覆盖 |
| 看到因果 | 所有人拿完筹码后推进轮次 | 公共牌从 0 张变 3 张，再到 5 张 | 单测与桌面教程 E2E 均已覆盖 |
| 看到结算收益 | 红筹码后摊牌 | 摊牌结果、成功/失败、金条/警报变化 | 单测与桌面教程 E2E 均已覆盖 |

## 仍未关闭的缺口

- 桌面教程 E2E 截图链已补齐；仍需按最终收口范围继续处理手机验收与用户桌面验收。
- The Gang 本轮新增压缩资源的远端发布与回查已完成；手机验收仍属于 `add-the-gang-data-and-runtime-closeout` 的继续范围，不因教程补丁自动完成。当前和后续资源验收统一以服务器素材主源为准。
- `教程满元素待摊牌.jpg` 与 `教程摊牌结果反馈.jpg` 已用 PureRef 打开给用户看；运行时满元素和摊牌结果图也已同时打开。本次 PureRef 新建了 4 个进程 `21064,22068,29900,42044` 而非复用旧窗口。这只关闭“桌面教程关键图已交付”，不代表用户已经验收桌面 UI。
- 当前文档不得作为最终完成证明；最终仍需回到真实教程页面截图链、手机验收和用户验收。
