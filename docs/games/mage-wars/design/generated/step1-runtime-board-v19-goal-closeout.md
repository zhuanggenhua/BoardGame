# Mage Wars UI 规范失职修复与 v19 重构收口矩阵

> 状态：`ai-closeout-complete / pending-user-human-review / implementation-blocked`。本文件只针对“攻击掷骰被边缘化、未参考成熟游戏交互、规范失职、规则区域锚点失败”这一条设计目标做证据收口。它不表示用户已经批准设计稿，也不允许进入真实 Board/UI 实现。

## 目标拆解

| 用户目标 / 指责 | 必须满足的结果 | 当前证据 | 裁定 |
| --- | --- | --- | --- |
| “一些基本的东西都没做好” | 不能只改图；必须把失败点回代到规范和门禁 | `ui-design-pipeline` 新增核心交互落位、固定区域锚点、当前结算主体规则；`boardgame-ui-imagegen` 和 `ui-change-gates` 增加同类阻断规则 | `DONE` |
| “要不要参考其他游戏的设计” | 读取游戏 UI / UI 设计相关 skill，并只抽成熟游戏交互不变量 | `ui-design-pipeline`、`ui-ux-pro-max`、`game-design`、`ui-audit-loop` 已读；v19 参考基线列出召唤师战争与 DiceThrone 的可抽取 / 禁止复制项 | `DONE` |
| “骰子放到这里是为什么” | 核心交互必须解释空间锚点，不允许“这里有空间”式摆放 | `step1-runtime-board-pc-redesign-v19-reference-baseline.md` 和 v19 audit 记录骰盘应贴目标 / 来源 / 主舞台链路 | `DONE` |
| “一次进攻投掷是核心交互” | 攻击骰 / 效果骰必须是当前主结算反馈，不能放右侧栏或日志区 | v17 `AI_PASS` 已撤销；v19 几何显示骰盘在竞技场内，距目标中心 `139.09px`，未进入右侧栏 | `DONE` |
| “之前说的问题也没解决好” | 历史通过必须撤销，并逐版记录失败原因 | README 记录 v13-v18 撤销原因：压卡、框体抢焦点、挤压、贴边、骰盘边缘化、区域锚点失败 | `DONE` |
| “先做好规范” | 规范层、项目门禁层、Mage Wars 专项合同层均有可拦截规则 | 全局 skill、项目 skill、项目门禁和 Mage Wars 设计系统均有 blocking 条款 | `DONE` |
| “然后重构” | 新稿必须消费规则、素材、参考基线、区域锚点和核心结算门禁 | v19 Open Design artifact、v19 几何审计、v19 图面审计均已生成 | `DONE` |
| “视觉你验收没问题了然后人工验收” | AI 图面核验通过后，才能打开给用户；用户批准前不得实现 | v19 audit 为 `AI_PASS / human-review-allowed`，截图已打开到 PureRef；README 标记实现和移动端冻结 | `PENDING_USER_REVIEW` |

## 关键证据

| 证据 | 文件 / 结果 |
| --- | --- |
| 全局规范回代 | `D:\codex-home\skills\ui-design-pipeline\SKILL.md` |
| 项目生图 / 设计稿 skill 回代 | `.spec/skills/boardgame-ui-imagegen/SKILL.md` |
| 项目 UI 门禁回代 | `.spec/knowledge/standards/ui-change-gates.md` |
| Mage Wars 专项设计系统 | `design-system/games/mage-wars.md` |
| 学徒区域锚点合同 | `docs/games/mage-wars/design/implementable/apprentice-zone-layout-contract.md` |
| v19 前置证据 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v19-preflight.md` |
| v19 参考基线 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v19-reference-baseline.md` |
| v19 Open Design artifact | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v19.html` |
| v19 截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v19.png` |
| v19 几何审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v19-geometry.json` |
| v19 图面审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v19-audit.md` |
| OpenSpec | `openspec validate add-mage-wars-foundation --strict --no-interactive` -> `valid` |
| Skill 校验 | `quick_validate.py` -> `ui-design-pipeline`、`boardgame-ui-imagegen`、`ui-audit-loop` 均 valid |

## 仍不能越过的门禁

- 用户没有明确批准 v19 前，不得进入真实 Board/UI 实现。
- PC 设计稿没有用户批准前，不得推进移动端适配。
- v19 若被用户指出失败，必须降级为 `REVISE`，并回到规则 / 素材 / 区域 / 核心结算门禁重构。
- 当前目标不能标为完全完成，直到用户人工验收明确通过，或用户改口要求继续重构。
