# Mage Wars Step 1 PC Open Design v23 出图前硬回执

> 状态：`preflight-ready / open-design-artifact-only / media-generate-forbidden / human-review-not-allowed`。本文件是本轮“更新规范重新设计”的 Mage Wars 专项规范包；它不修改真实 Board/UI，不启动真实页面，不进入移动端。

## 本轮前提锁定

| 项 | 锁定结果 |
| --- | --- |
| 问题对象 | Mage Wars 学徒模式 PC Open Design Step 1 运行时主界面设计稿，基于 v21 单基线重做 v23 |
| 真相来源 | 本轮已重读全局 `ui-design-pipeline`、`game-design`、`ui-audit-loop`、`existing-ui-design-baseline`、`ui-ux-pro-max`，项目 `boardgame-ui-imagegen` / `create-new-game` / `ui-change-gates` / `ui-ux` / `asset-pipeline`，以及 Mage Wars 规则和素材合同 |
| 目标入口 / 环境 | Open Design artifact 代码设计稿：`D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v23.html` |
| 验收口径 | 先 AI 图面核验；AI PASS 后才允许打开给用户人工验收。用户批准前实现、真实页面 E2E 和移动端继续冻结 |

## 规范落点裁定

| 层级 | 本轮动作 |
| --- | --- |
| 全局 skill | 既有 `ui-design-pipeline` 已包含“先读 task-relevant skills，再设计”“当前结算浮层”“Open Design artifact 与 media 生图区分”，本轮不再重复扩写全局细节 |
| 项目 skill / 项目规则 | 既有 `.spec/skills/boardgame-ui-imagegen` 和 `.spec/knowledge/README.md` 已把 BoardGame 出稿前硬回执、规则重读、素材输入链、少边框和人工验收门禁写成拦截项 |
| Mage Wars 专项规范 | 本文件新增 v23 的具体画面规则、交互落位、框体职责和失败清单；这是当前重新设计的最近执行真相 |
| 真实实现 | 明确冻结；本轮只产设计稿候选 |

## 本轮规则读取回执

| 来源 | 规则结论 | 画面决策 |
| --- | --- | --- |
| `apprentice-spellbooks.md` / 规则 page_004 | 学徒法师生命 24、初始法力 10、聚魔 10、基础近战 3 颗攻击骰 | 双方法师状态 HUD 使用水平生命 / 法力 / 聚魔读数；不得复现整张状态板，也不得退成蓝圆 |
| `apprentice-zone-layout-contract.md` | 学徒模式是 `2列 x 3行` 六区域，区域是移动、距离、目标和相邻判断单位 | 右半场六区域必须是第一视觉规则；每张场上卡有唯一 `data-zone-id`，中心点不得骑线 |
| `apprentice-spellbooks.md` / 规则 page_009-page_015 | 计划阶段从法术书准备最多 2 张法术；只能施放已计划法术；弃牌堆可检视但通常不作为当前来源 | 底部保留“法术书候选 + 分类 + 分页 + 已计划 2 槽”，火球术来源必须是已计划法术；弃牌堆贴玩家边缘，不能进中央 |
| 隐藏信息合同 | 对手不能知道己方计划法术和隐性结界身份 | 对手已计划法术、隐性结界和未公开法术书内容只显示卡背 / 数量 / 归属，不显示正面或卡名 |
| 攻击 / 伤害规则 page_024 / page_027 | 攻击骰、效果骰、伤害、状态都绑定目标对象 | 当前结算浮层必须靠近西锁骑士和来源-目标动作链；骰子可以在最上层，但不能边栏化或遮挡目标主体 |

## 规则牌区白名单

| 规则名 | UI 名称 | 可见性 | 当前默认位置 | 流转关系 |
| --- | --- | --- | --- | --- |
| 法术书 | 法术书 / 法术候选 | 本人可浏览；对手只见存在 / 数量 | 己方底部开放浏览轨 | 计划阶段从中准备最多 2 张 |
| 已计划法术 | 已计划法术 | 本人见正面；对手见卡背 / 数量 | 法术书浏览轨右侧，当前施法时抬升 | 当前可施放来源 |
| 弃牌堆 | 弃牌堆 | 公开检视 | 所属玩家边缘小入口 | 已消耗公开归档，当前无回收步骤 |
| 隐性结界 | 隐性结界卡背 / 展示后正面 | 对手展示前只见卡背 | 宿主附近附件区 | 触发 / 展示时翻开 |
| 公开场上法术 / 装备 / 生物 | 正式卡面 | 公开 | 对应区域或法师附件附近 | 作为对象本体直接承接阅读 / 目标 |

禁止：`手牌`、`hand`、`opponent-hand`、默认持牌区、文字牌区、中心弃牌堆、对手计划正面。

## 核心交互落位

| 核心对象 | 玩家当前问题 | 空间锚点 | 让位对象 | v23 设计要求 |
| --- | --- | --- | --- | --- |
| 当前目标 | 火球术打谁？ | `B2` 西锁骑士卡本体 | 说明文字、右侧摘要 | 目标卡和守卫 / 伤害 token 保持无遮挡；目标高亮只做轻量角标 / 光晕 |
| 当前结算浮层 | 掷了什么、造成什么？ | 西锁骑士右上与火球术路径附近 | 右侧栏、日志、装饰面板 | 攻击骰、蓝色效果骰、伤害和燃烧 token 形成一条短链，浮在主舞台上层 |
| 已计划火球术 | 这张法术从哪来？ | 底部已计划 2 槽，当前火球术可抬升 | 非当前候选卡 | 不能从法术书全库直接施放，不能叫手牌 |
| 法术书浏览 | 如何检索 / 计划？ | 己方底部开放贴边浏览轨 | 面板背景、说明卡 | 候选卡本体 + 分类 + 分页，减少整块容器感 |
| 确认 / 取消 | 我下一步点什么？ | 当前施法链右下，靠近目标与费用 | 历史摘要、装饰按钮 | 两个 44px+ 明确按钮；不是小字或侧栏仪表盘 |

## 素材进入 artifact 链

| 画面主体 | 输入素材 / 来源 | v23 呈现 | 裁定 |
| --- | --- | --- | --- |
| 标准竞技场 | `refs/mage-wars-step1/standard-arena.jpg` | 主棋盘可见主体，左半场退场 | `visible-subject` |
| 法师牌 | `mage-warlock-card.png`、`mage-priestess-card.png` | 双方法师对象 | `visible-subject` |
| 法术候选与已计划法术 | `spell-1700-fireball.png`、`spell-1804-mage-bane.png`、`spell-1806-block.png`、`spell-1901-nullify.png`、`spell-3704-equipment.png` | 底部法术书浏览轨与已计划槽 | `visible-subject` |
| 场上生物 / 魔物 | `spell-2909-knight-of-westlock.png`、`spell-2801-firebrand-imp.png`、`spell-2803-flaming-hellion.png`、`spell-2224-conjuration.png` | 六区域内卡牌本体 | `visible-subject` |
| 法术卡背 | `spell-card-back.jpg` | 对手已计划、隐性结界、法术书与弃牌堆背面 | `hidden-info visible-subject` |
| 行动 / 快速施法 token | `action-marker-*.png`、`quickcast-marker-front.png` | 法师旁短状态 | `visible-subject` |
| 攻击骰 | `attack-die-face-*.png` | 当前结算浮层骰面 | `visible-subject` |
| 效果骰、生命、法力、聚魔、费用 | 规则来源与状态板 reference-only | 自制运行态 UI，必须有材质、水平读数和对象锚点 | `approved-programmatic-runtime-ui` |
| 燃烧 / 守卫 / 伤害 | `guard-token.png`、`damage-token-front.png`、`burn-token.png` | 贴近西锁骑士和结算结果 | `visible-subject` |

## 框体职责与少边框策略

| 非素材边界 | 是否保留 | 职责 |
| --- | --- | --- |
| 六区域规则线 | 保留但低厚度 | 这是规则区域单位，不是装饰框 |
| 已计划槽轻描边 | 保留 | 指明当前可施放来源与可点击卡位 |
| 分类 / 分页 / 确认按钮底板 | 保留 | 真实点击命中区，44px+ |
| 底部整块深色面板 | 删除 / 降级为开放桌面阴影 | v21 的大面板感过重，v23 只用贴底轨、卡牌阴影和小标签组织 |
| 右侧大信息区 | 删除 / 降级为轻量动作簇 | 当前结算和确认不能像仪表盘 |
| 骰盘外框 / 红方块占位 | 删除 | 骰子和 token 本体承担主反馈 |

## 前置硬失败禁止清单

- 出现 `手牌 / hand / opponent-hand` 或等价默认持牌区。
- 场上卡牌中心落在区域线、区域缝隙、未使用半场或跨区归属不可辨。
- 攻击骰 / 效果骰 / 伤害 / 燃烧被放进边栏、日志、角落或法术书旁作为当前主反馈。
- 骰子、血条、蓝条、费用、状态点像默认 CSS 圆球、普通蓝圆、粗糙红块或无材质占位。
- 弃牌堆进入中央施法链或确认按钮旁。
- 对手已计划、法术书或隐性结界泄露正面 / 卡名。
- 主界面常驻规则解释句、教程句、验收话术或内部字段。
- 图面第一眼看到的是容器、边框、面板，而不是竞技场、卡牌、法师和当前施法链。
- v21 基线被覆盖或删除；v6 同构失败稿被继续继承。
- 用户批准前启动真实 Board/UI、真实页面 E2E 或移动端。

## 基线与人工验收

- v21 保留为单基线：`docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v21.png`。
- v23 是重新设计候选，不覆盖 v21。
- 出图前：`human-review-not-allowed`。
- 只有 v23 的截图、几何审计和 AI 图面核验均 PASS 后，才允许打开给用户人工验收。
