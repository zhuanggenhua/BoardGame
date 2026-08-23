# 法师战争 Step 1 运行时主界面设计前置包

> 状态：`historical-brief / rule-ui-semantics-failed / media-route-not-current / human-review-blocked`。本文件不是设计稿，不是 HTML 预览，也不是人工验收图；它是历史文件名含 `imagegen` 的规则 / 素材前置包。用户已明确“使用 Open Design，不要生图”，因此当前路线是 Open Design artifact；但 v6 / v7 的旧 AI_PASS 已撤销，本文件不得作为当前 prompt 或人工验收依据。

## 0. 前提锁定

| 项 | 当前裁定 |
| --- | --- |
| 问题对象 | Mage Wars / 法师战争两人学徒模式运行时主界面 Step 1 结构稿 |
| 真相来源 | 规则 PDF Markdown 导出第 4 / 6 / 7 页、Mage Wars 规则 / 素材合同、当前正式资源目录 |
| 目标入口 | 当前 worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\mage-wars` |
| 验收口径 | 旧候选已撤销；下一稿必须先通过法术书 / 已计划法术 / 弃牌堆语义审查与 AI 图面核验，才允许人工验收 |

## 1. 本轮实际读取的规则文件 / 页段

| 来源 | 路径 | 本轮直接使用的结论 |
| --- | --- | --- |
| 学徒模式规则 | `D:\gongzuo\webgame\gameasset\法师战争\output\pdf\ai_readable_pdf_exports\101721 法师战争 Mage Wars 规则\pages\page_004.md` | 学徒模式使用 `2x3` 区域竞技场，是标准竞技场一半；学徒法师统一为 `10` 聚魔、`24` 生命和 `3` 颗基础近战攻击骰；每位玩家使用预设法术书。 |
| 组件清单 | `D:\gongzuo\webgame\gameasset\法师战争\output\pdf\ai_readable_pdf_exports\101721 法师战争 Mage Wars 规则\pages\page_006.md` | 主 UI 必须以真实组件为对象：竞技场、法术书、法术牌、法师牌、行动标记、快速施法标记、攻击骰、12 面效果骰、伤害 / 状态标记；法师状态板与状态方块只作为 `reference-only` setup / 轨道语义来源。 |
| 设置规则 | `D:\gongzuo\webgame\gameasset\法师战争\output\pdf\ai_readable_pdf_exports\101721 法师战争 Mage Wars 规则\pages\page_007.md` | 标准竞技场共 `12` 区域；相邻只按水平 / 垂直共享边，不按对角；每名玩家拿 `3` 个黑色状态方块、`1` 个红色状态方块和 `1` 个黑色快速施法标记；行动标记和快速施法标记放在法师牌上，状态板记录聚魔、法力池、生命和伤害。 |
| 学徒法术书 | `docs/games/mage-wars/rule/apprentice-spellbooks.md` | 四名学徒法师、预设法术书数量、Workshop `CardID` 候选和别名裁定已锁；本轮不做自由构筑或全 322 张卡。 |
| 学徒法术字段 | `docs/games/mage-wars/rule/apprentice-card-field-contract.md` | 91 张学徒范围卡牌的费用、类型、目标、效果等 S0 字段合同已录入；设计稿只能用正式 atlas / config，不得用 `temp/` 核对裁图。 |

## 2. 规则对象结论

- 学徒模式不是完整标准局：主棋盘必须显示正式竞技场素材，但本轮可玩范围只能表达为 `2x3` 半场候选；未锁定左半 / 右半前，不得把某一侧当最终定稿。
- 法师状态不能继续贴整张状态板：聚魔、法力池、生命、伤害在 Step 1 运行时主界面中必须用贴近法师牌的自制状态 HUD 表达；正式法师状态板只作为 setup、规则来源、轨道坐标和详情检视参考。
- 法师、法术牌、法术卡背是主视觉对象：法术书、已计划法术、弃牌堆、结界、生物、装备等必须用正式卡面 / 卡背 / atlas frame 表达，不得用文字列表、灰色卡壳或其它游戏卡图替代。
- 行动与快速施法是实体标记：红 / 蓝行动标记、黑色快速施法标记、就绪 / 冷却标记必须用正式 token 表达，不得用普通圆点开关替代。
- 随机源必须区分：攻击骰使用正式攻击骰贴图；效果骰是来源锁定的蓝色 12 面骰，不得画成普通 D6 或文本结果。
- 玩家隐藏信息必须保留：自己的已计划法术可见；对手的已计划法术、未公开法术书内容和隐藏结界默认用法术卡背或视角过滤表达，不得把对手私有卡名公开，不得称为手牌。

## 3. 规则结论到画面决策映射

| 规则结论 | 影响的画面主体 | 设计决策 | 禁止项 |
| --- | --- | --- | --- |
| 学徒模式使用标准竞技场的一半，即 `2x3` 区域 | 竞技场主画布、可移动 / 可选区域 | 完整显示正式 `4x3` 竞技场素材，只用轻量 overlay 表达学徒半场候选 | 不得画成独立 CSS 六格棋盘；不得锁死左半或右半为最终裁定 |
| 法师起始位置与标准游戏相同，在版图两个对角 | 法师牌、法师所在区域、行动 / 快速施法标记 | 法师牌必须贴回候选半场对角区域，行动和快速施法标记贴在法师牌附近 | 不得用圆点或通用头像代表法师；不得把法师放到无规则依据的中心区 |
| 学徒法师统一 `10` 聚魔、`24` 生命、`3` 颗基础近战攻击骰 | 法师牌旁状态 HUD、攻击骰 | 生命 / 伤害 / 法力 / 聚魔用自制运行态 UI；攻击骰用正式攻击骰贴图派生骰面 | 不得把整张状态板或状态板裁切当玩家面板；不得用普通 D6 或数字气泡替代攻击骰 |
| 每名玩家拿 `3` 黑状态方块、`1` 红状态方块、`1` 黑快速施法标记 | 状态来源、快速施法标记 | 黑 / 红状态方块只保留为状态板 reference-only 来源；快速施法标记作为独立实体 token | 不得用普通圆点、emoji、开关、badge 代替快速施法和行动标记 |
| 相邻只按水平 / 垂直共享边，对角不相邻 | 区域高亮、目标选择 | 可选区域高亮只贴水平 / 垂直相邻区域；对角区域不得作为相邻可选目标亮起 | 不得用泛化战棋邻接模板把对角也标成可移动 |
| 对手计划法术、未公开法术书内容和隐藏结界是隐藏信息 | 对手计划卡背、法术书未知内容、隐藏结界 | 对手私有牌用正式法术卡背或视角过滤表达 | 不得公开对手卡名、卡面或效果文本；不得称为对手手牌 |

## 4. 可见主体素材账本

| 现实对象 | 正式素材 / config | 当前状态 | 下一版图面呈现方式 | 是否允许进入 Step 1 |
| --- | --- | --- | --- | --- |
| 标准竞技场 | `public/assets/i18n/zh-CN/mage-wars/board/standard-arena.jpg`，尺寸 `3210x2407` | `design-asset-ready / coordinate-contract-ready` | 作为画面第一主体完整使用；只允许轻量半场候选 overlay | 允许 |
| 学徒半场 | 依附 `standard-arena.jpg`；坐标见 `docs/games/mage-wars/design/implementable/board-coordinate-contract.md` | `coordinate-contract-partial / side-selection-pending` | 标注 `left-half-candidate` 或 `right-half-candidate`；不得最终锁定 | 仅候选允许 |
| 法师状态板 | `public/assets/i18n/zh-CN/mage-wars/boards/mage-status/mage-status-board.png`，尺寸 `3093x1628` | `reference-only / coordinate-contract-ready` | 仅作为 setup、规则来源、轨道坐标和详情检视参考；不得在 Step 1 主界面可见 | 不允许作为主界面主体 |
| 黑 / 红状态方块 | Workshop 内置 `BlockSquare`；颜色见 `board-coordinate-contract.md` | `source-locked-programmatic / reference-only-for-main-ui` | 仅作为状态板规则来源或详情层轨道标记；主界面状态 HUD 可用颜色语义但不复现状态板轨道 | 不允许作为普通圆点或状态板替代 |
| 四名学徒法师 | `public/assets/i18n/zh-CN/mage-wars/cards/mages/mages-core-atlas.png` + `public/assets/atlas-configs/mage-wars/mages-core-atlas.json`，`8` 个 frame | `design-asset-ready` | 法师牌 / 肖像 frame 作为玩家身份和法师所在区域对象 | 允许 |
| 学徒法术牌 | `public/assets/i18n/zh-CN/mage-wars/cards/spells/*.png` + `public/assets/atlas-configs/mage-wars/apprentice-spell-atlases.json`，`91` 张 cards | `design-asset-ready` | 法术书入口、已计划法术、弃牌堆、结界 / 生物 / 装备详情使用正式 atlas frame | 允许 |
| 法术卡背 | `public/assets/i18n/zh-CN/mage-wars/cards/backs/spell-card-back.jpg`，尺寸 `992x1391` | `design-asset-ready` | 对手隐藏卡、计划法术、面朝下结界使用正式卡背 | 允许 |
| 攻击骰 | `public/assets/i18n/zh-CN/mage-wars/dice/attack-die-texture.png`，尺寸 `1280x1280` | `design-asset-ready / foundation-runtime-ready` | 作为攻击骰视觉基底；不得使用普通 D6 点数 | 允许 |
| 效果骰 | Workshop 内置 `Die_12`，蓝色来源见 `board-coordinate-contract.md` | `source-locked-programmatic / foundation-runtime-ready` | 蓝色 12 面骰程序化对象 | 允许 |
| 行动标记 | `tokens/action/action-marker-red-front.png`、`action-marker-blue-front.png` 等，尺寸 `86x78` | `design-asset-ready` | 贴在法师牌附近表示行动可用 / 已用 | 允许 |
| 快速施法标记 | `tokens/quickcast/quickcast-marker-front.png` `80x80`、`quickcast-marker-back.jpg` `86x78` | `design-asset-ready` | 独立黑色快速施法标记，不能用行动标记替代 | 允许 |
| 就绪 / 冷却标记 | `tokens/action/ready-token-front.png`、`ready-token-back.png`，尺寸 `329x329` | `design-asset-ready` | 只在召唤物或对象需要 ready/spent 时出现 | 允许 |
| 伤害 / 聚魔 token | `tokens/damage/damage-token-front.png`、`tokens/channeling/channeling-token-front.png` 等 | `design-asset-ready / damage-token-asset-only` | 伤害物理 token 只证明素材存在；当前真实 Board 默认用对象本体受伤覆盖层 + 数字徽章表达伤害。聚魔可作为对象附近状态增强；常驻法师生命 / 法力 / 聚魔仍走自制 HUD | 伤害不强制贴图，聚魔按阶段裁定 |
| 守卫 / 燃烧 / 腐化 / 眩晕 / 昏迷 / 沉睡 | `tokens/status/{guard,burn,rot,daze,stun,sleep}-token.png` | `design-asset-ready` | 只在对应状态存在时贴近对象显示 | 允许 |
| 独立法力指示物 | 未定位正式素材；规则列出但当前素材链未闭合 | `blocked` | 不得画成完成态；法师法力必须通过贴近法师牌的自制法力 HUD 表达，状态板法力池只作 `reference-only` 规则来源 | 不允许 |
| 墙体 / 豪华竞技场 / 四人模式对象 | 本轮 foundation 不覆盖 | `out-of-scope` | 不出现在 Step 1 | 不允许 |

## 5. 素材复查证据

> 复查时间：2026-07-27。本节只证明素材可作为设计输入，不证明运行时代码已接线。

| 对象 | 复查证据 | 当前裁定 |
| --- | --- | --- |
| 标准竞技场 | `path-exists`；`standard-arena.jpg` 尺寸 `3210x2407` | 可作为主画布输入 |
| 法师状态板 | `path-exists`；`mage-status-board.png` 尺寸 `3093x1628` | `reference-only`，不得作为 Step 1 主界面可见状态面板 |
| 法师 atlas | `source-image-exists`；`mages-core-atlas.png` 尺寸 `4096x3302`；`mages-core-atlas.json` 命中 `8` 个 frame | 可作为法师牌 / 肖像输入 |
| 学徒法术 atlas | `source-image-exists`；`apprentice-spell-atlases.json` 命中 `91` 张 cards | 可作为学徒法术卡输入 |
| 法术卡背 | `path-exists`；`spell-card-back.jpg` 尺寸 `992x1391` | 可作为隐藏信息 / 计划卡背输入 |
| 攻击骰 | `path-exists`；`attack-die-texture.png` 尺寸 `1280x1280` | 可作为攻击骰视觉基底 |
| 行动标记 | `path-exists`；`action-marker-red-front.png` 尺寸 `86x78`；蓝方同组路径存在于正式 token 目录 | 可作为行动标记输入 |
| 快速施法标记 | `path-exists`；`quickcast-marker-front.png` 尺寸 `80x80` | 可作为快速施法标记输入 |
| 伤害 / 状态 token | `path-exists`；`damage-token-front.png` 尺寸 `283x283`；`guard-token.png` 尺寸 `339x339` | 只证明素材存在；伤害默认走现代受伤覆盖层 + 数字徽章，守卫 / 燃烧等离散状态可作为 token 输入 |
| 黑 / 红状态方块、效果骰 | 来源锁定到规则页与 Workshop / 坐标合同；非图片素材 | 仅允许按来源锁定程序化对象表达 |

## 6. 已看主素材的图面结论

- `standard-arena.jpg` 是完整 `4x3` 石质竞技场图，图面自带区域分隔线和角落门位；它必须作为主画布，不得被 CSS 六格棋盘替代。
- `mage-status-board.png` 自带聚魔、法力池、生命 / 伤害三组轨道和回合流程提示；这证明它能作为规则来源和详情检视参考，但 Step 1 主界面不应直接复现整张状态板或状态板裁切。
- `mages-core-atlas.png` 包含四名学徒相关法师牌 / 肖像；玩家身份、法师对象和法师牌预览必须从该 atlas 取，不得用通用头像。

## 7. 禁止替代清单

- 禁止用 CSS / HTML 方格、抽象色块或线框替代正式竞技场。
- 禁止把整张法师状态板或状态板裁切当作运行时玩家血量 / 蓝量面板；也禁止脱离法师牌的普通数字面板。运行态必须使用贴近法师牌的自制生命 / 法力 / 聚魔 HUD。
- 禁止用文字列表、灰色卡壳、临时裁图或相似卡图替代正式法术牌、法师牌和法术卡背。
- 禁止用普通圆点、emoji、通用 badge 替代行动标记、快速施法标记、伤害 / 聚魔 / 状态 token。
- 禁止把攻击骰或效果骰画成普通 D6、百分比文字或数字气泡。
- 禁止常驻规则说明正文；主 UI 只能保留对象名、数值、短状态、按钮标签和单步动作提示。
- 禁止为了“清楚”套多层外框、内框、玻璃板、黑色面板或分栏壳；除素材自带印刷边、可点击对象轻量高亮、必要按钮底板外，其它框默认删除。

## 8. 边框职责清单

| 边框 / 底板类型 | 允许性 | 理由 |
| --- | --- | --- |
| 棋盘、卡牌、token 自带印刷边 | 允许 | 真实素材的一部分 |
| 状态板自带印刷边 | 仅 reference-only | 状态板不进入 Step 1 主界面；只可在 setup / 详情 / 规则参考中出现 |
| 学徒半场候选高亮 | 允许但必须轻 | 表达当前可用半场候选，不替代棋盘 |
| 当前可点击区域 / 目标对象描边 | 允许但必须贴对象 | 表达交互命中区 |
| 按钮底板 | 允许但数量最小 | 只承载确认 / 结束 / 帮助等命令 |
| 面板外框、卡壳、分栏框、黑色玻璃板 | 默认禁止 | 没有现实桌游对象对应，且会抢走正式素材主语 |

## 9. Design I/O 声明

### spec

- 目标用户：第一次进入两人学徒模式的玩家。
- 现实任务：看清竞技场、自己法师状态、自己可用法术 / 行动、当前可选目标，并能推进一次基础行动。
- 主路径：进入对局 → 查看双方学徒法师和自制状态 HUD → 选择计划 / 执行法术或移动 / 攻击 → 消耗行动或快速施法标记 → 看到状态 / 伤害 / token 变化。
- 边界：本轮只做 Step 1 运行时结构稿；不做自由构筑、四人模式、全 322 张法术、完整 AI、教程系统或撤回 UI。
- 验收标准：AI 图面核验必须确认主视觉来自正式素材、规则对象没有缺行、少框体成立、玩家第一眼能知道当前可点击对象。

### domain

- 业务对象：竞技场区域、法师、法师牌旁自制状态 HUD、法术牌 / 卡背、法术书、已计划法术、弃牌堆、行动标记、快速施法标记、骰子、状态 token；法师状态板只作 reference-only 来源。
- 对象状态：可行动 / 已行动、快速施法可用 / 已用、隐藏 / 公开、计划 / 执行中、伤害 / 状态叠加。
- 敏感信息：对手已计划法术、未公开法术书内容和隐藏结界不得公开正面。
- 禁止混用：快速施法标记不能用行动标记替代；法力池不能用聚魔 token 顶替；效果骰不能用攻击骰或 D6 顶替。

### template

- 主视线：正式竞技场居中最大；学徒半场只做轻量候选覆盖。
- 玩家信息：两侧或上下贴边放法师牌 + 自制状态 HUD + 行动 / 快速施法 token，减少额外面板。
- 当前决策：自己的已计划法术和当前可点击区域贴近棋盘；法术书与弃牌堆作为入口，不做整列说明栏。
- 辅助信息：骰子、token、帮助入口按需贴边；日志 / 撤回不进入 Step 1 主视觉。
- 最大承载量：Step 1 只展示最多 2 张已计划法术、法术书 / 弃牌堆入口和区域对象，但布局必须预留卡牌详情和区域堆叠扩展，不把卡缩成点。

### components

| 信息 / 动作 | 现实语义 | 承载 | 禁止替代 |
| --- | --- | --- | --- |
| 竞技场区域 | 移动、射程、目标选择 | 正式竞技场图 + 轻量命中高亮 | CSS 六格棋盘 |
| 法师生命 / 法力 / 聚魔 / 伤害 | 法师状态 | 自制运行态 HUD，贴近法师牌 | 状态板原图、状态板裁切、脱离对象的普通数字面板 |
| 法术书 / 已计划法术 / 弃牌堆 | 私有决策对象与公开弃牌入口 | 正式法术牌 / 卡背 / atlas frame | 文字列表或规则不存在的手牌区 |
| 行动 / 快速施法 | 实体标记消耗 | 正式行动标记 / 快速施法标记 | 圆点开关 |
| 攻击 / 效果掷骰 | 规则随机源 | 攻击骰贴图 / 蓝色 12 面骰 | 普通 D6 |

### craft

- 画面应像“正式桌游素材驱动的 2D 运行时界面”，不是后台面板、仪表盘或线框图。
- 框体数量必须少于素材主体数量；第一眼看到的必须是竞技场、法师牌、卡牌、token 和当前动作，而不是状态板或大面板。
- 主 UI 不写规则解释句；提示只能是短状态或临时浮层。
- 氛围材质可以降级，前端必须守住构图、对象层级、尺寸关系和交互入口。

## 10. 出图前正式素材输入包门禁

> 当前状态：`historical-preflight / asset-input-package-ready / reusable-for-v8 / design-pass-not-proven`。正式素材输入包已经创建，但 v6 / v7 的旧 AI_PASS 已撤销；素材包只能作为 v8 输入，不能证明设计通过。

### 10.1 输入包落点

| 用途 | 落点 | 当前状态 |
| --- | --- | --- |
| Open Design 输入副本 | Open Design 项目 `mage-wars-ui-design` 下的 `refs/mage-wars-step1/` | 已创建；已被 Open Design v6 artifact 路线消费 |
| 生成用 reference sheet | `refs/mage-wars-step1/step1-runtime-board-reference-sheet.png` | 已创建，尺寸 `1920x1080` |
| 当前 worktree 可审计清单 | `docs/games/mage-wars/design/reference/step1-runtime-board-asset-input-manifest.md` | 已创建 |
| 机器清单 | `docs/games/mage-wars/design/reference/asset-input/step1-runtime-board/asset-input-manifest.json` | 已创建 |
| AI 审图证据 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v7-audit.md` | v7 为 `AI_PASS_REVOKED / rule-ui-semantics-failed / human-review-blocked`；v8 必须重审 |

### 10.2 必须进入输入包的主体素材

| 主体 | 输入要求 | 不允许的替代 |
| --- | --- | --- |
| 标准竞技场 | 复制正式 `standard-arena.jpg`，作为主画布输入或 reference sheet 最大主体 | CSS 六格、手绘棋盘、抽象场地 |
| 法师状态板 | 可进入输入包但必须标为 `reference-only`；只用于推导状态 HUD 语义，不得作为输出可见主体 | 把状态板或裁切状态板画进主界面 |
| 法师牌 / 肖像 | 从正式 `mages-core-atlas.png` + config 生成可追溯 crop，或把 atlas 与 frame 清单一并作为输入 | 通用头像、文字名牌 |
| 学徒法术牌 | 从正式学徒法术 atlas/config 选代表性已计划法术、公开卡牌、隐藏结界卡背 crop 输入 | 灰色卡壳、文字列表、临时 `temp/` 裁图、其它游戏卡图 |
| 法术卡背 | 复制正式 `spell-card-back.jpg`，用于对手隐藏信息和计划卡背 | 普通背面图、锁图标 |
| 行动 / 快速施法 / 状态 token | 复制正式 token 图片，作为实体标记输入 | 圆点、badge、开关 |
| 攻击骰 / 效果骰 | 攻击骰使用正式贴图；效果骰使用来源锁定的程序化蓝色 12 面骰 reference | 普通 D6、数字气泡 |

### 10.3 生成链硬门槛

- 输入包必须被实际传给生成链路：Open Design 使用项目相对 `image` / `images` / composition；其它 imagegen 链路必须记录对应输入文件。
- 如果工具一次不能吃完全部素材，先生成 reference sheet / composition，把正式棋盘、代表性卡牌、卡背、token 和骰子放进 visible-subject 输入，把状态板单独标为 reference-only；不得让生成器把状态板样本当布局复现。
- 设计稿审计必须能逐项回答：`正式资源 -> 输入包文件 -> 生成输入参数 -> 图面主体位置`。任一段断开，结论为 `REVISE`。
- 只在 prompt 里写素材路径、只把素材作为小角标、或让主体视觉由边框 / 面板 / 文字壳承担，都视为未使用正式素材。

## 10.4 出图前硬回执

> 当前状态：`historical-preflight-receipt / ai-pass-revoked / human-review-blocked`。本文件曾提供 Step 1 设计稿所需的规则 / 素材前置内容，但已被“手牌”语义事故废弃为历史参考；当前没有可人工验收候选。历史 media 生图链路阻塞记录保留在 `docs/games/mage-wars/design/generated/step1-runtime-board-v1-generation-blocker.md`。

| 回执项 | 必须填写的证据 | 缺失时状态 |
| --- | --- | --- |
| 本轮规则读取 | 本轮实际读取过的规则页段 / 合同文件；至少三条规则对象结论 | `blocked-rule-source-not-reread` |
| 规则到画面映射 | 每条关键规则对应的画面主体、设计决策和禁止项 | `blocked-rule-not-mapped-to-layout` |
| 素材进入生成输入 | `正式资源 -> 输入包文件 -> 生成命令参数 / 图像输入 -> 预期图面主体职责` | `blocked-asset-not-in-generation-input` |
| 框体职责 | 每个非素材自带边框 / 底板 / 面板对应的真实交互对象；无职责则删除或降级 | `blocked-border-duty-unproven` |
| 人工验收状态 | 生成前固定为“禁止人工验收”；AI 图面核验 PASS 后才可变更 | 当前为 `human-review-blocked`；v8 之前不得变更 |

执行裁定：如果 Open Design / imagegen 生成命令发生在本硬回执补齐之前，该输出默认不是当前有效设计稿，只能作为过程图或失败候选，必须重新补回执后再生成。

### 10.4.1 本轮规则读取回执

| 本轮读取来源 | 路径 / 页段 | 可用于出图的规则对象结论 |
| --- | --- | --- |
| 学徒模式规则 | `D:\gongzuo\webgame\gameasset\法师战争\output\pdf\ai_readable_pdf_exports\101721 法师战争 Mage Wars 规则\pages\page_004.md` | 学徒模式只使用标准竞技场的一半，即 `2x3` 六区域；学徒法师统一 `10` 聚魔、`24` 生命、`3` 颗基础近战攻击骰；每位玩家使用预设法术书。 |
| 组件清单 | `D:\gongzuo\webgame\gameasset\法师战争\output\pdf\ai_readable_pdf_exports\101721 法师战争 Mage Wars 规则\pages\page_006.md` | 图面可见主体必须来自真实组件：竞技场、法术书、法术牌、法师牌、行动标记、快速施法标记、攻击骰、12 面效果骰、伤害 / 状态标记；法师状态板与状态方块只作为 `reference-only` setup / 轨道语义来源。 |
| 设置规则 | `D:\gongzuo\webgame\gameasset\法师战争\output\pdf\ai_readable_pdf_exports\101721 法师战争 Mage Wars 规则\pages\page_007.md` | 标准竞技场共 `12` 区域；相邻只按水平 / 垂直共享边，不按对角；每名玩家拿 `3` 个黑色状态方块、`1` 个红色状态方块、`1` 个黑色快速施法标记；法师牌放在近侧角落区域，行动标记和快速施法标记放在法师牌上，状态板用方块记录聚魔、法力池、生命和伤害。 |
| 坐标合同 | `docs/games/mage-wars/design/implementable/board-coordinate-contract.md` | 正式竞技场是 `4x3` 源图，学徒半场只能标为左半 / 右半候选；状态板轨道坐标只用于 `reference-only` setup / 详情来源，主界面状态读数走自制 HUD；效果骰是来源锁定的蓝色 `Die_12`，不是普通 D6。 |
| 素材输入清单 | `docs/games/mage-wars/design/reference/step1-runtime-board-asset-input-manifest.md` 与 `asset-input-manifest.json` | 工作树输入包和 Open Design `refs/mage-wars-step1/` 输入均已复查存在；reference sheet 尺寸 `1920x1080`，sha16 `7857393c78306728`。 |

### 10.4.2 规则到画面映射回执

| 规则结论 | 影响的画面主体 | 下一版设计决策 | 禁止项 |
| --- | --- | --- | --- |
| 学徒模式为标准竞技场一半，`2x3` 六区域 | 中央竞技场、可用半场 overlay、区域高亮 | 使用完整正式 `standard-arena.jpg` 作为第一主体；只用极轻 overlay 标出候选半场，半场方向继续标候选不标 locked | 禁止 CSS 六格棋盘；禁止裁掉另一半后冒充最终版；禁止把候选半场打开为最终验收图 |
| 标准竞技场相邻只按水平 / 垂直共享边 | 移动 / 射程 / 目标高亮 | 只对共享边相邻区域做薄高亮；对角区域不亮 | 禁止泛化战棋式八方向邻接 |
| 学徒法师统一 `10` 聚魔、`24` 生命、`3` 颗攻击骰 | 法师牌旁自制状态 HUD、攻击骰 | 法师生命 / 伤害 / 法力 / 聚魔以贴近法师牌的自制运行态 HUD 表达；攻击用正式攻击骰贴图表达 | 禁止状态板原图、状态板裁切、普通数字资源栏；禁止普通 D6 或数字气泡替代攻击骰 |
| 每名玩家有行动标记和快速施法标记 | 法师牌附近的实体 token | 行动标记、快速施法标记必须使用正式 token，并贴近法师牌和自制状态 HUD | 禁止普通圆点、开关、badge 替代 |
| 对手已计划法术、未公开法术书内容、隐藏结界是隐藏信息 | 对手已计划法术卡背、未知法术书内容、隐藏结界 | 对手私有信息只使用正式法术卡背或视角过滤，不公开正面 | 禁止显示对手卡名、卡面和效果正文；禁止称为对手手牌 |
| 组件清单包含状态 / 守卫 / 伤害等实体标记 | 对象旁 token 与状态增强 | 只在有关对象附近使用正式 token；没有触发状态时不常驻堆满 | 禁止用一排抽象状态栏、相似图标或文字壳替代 token |

### 10.4.3 素材进入生成输入回执

以下命令是历史 media / imagegen 路线恢复命令，不属于当前有效 Open Design artifact v6 路线。只有用户重新明确要求图片模型生图时，才允许恢复使用：

```powershell
node D:\codex-home\tools\open-design\apps\daemon\bin\od.mjs media generate --project mage-wars-ui-design --surface image --model codex-gpt-image-2 --aspect 16:9 --output step1-runtime-board-v1.png --image refs/mage-wars-step1/step1-runtime-board-reference-sheet.png --prompt-file docs\games\mage-wars\design\reference\step1-runtime-board-imagegen-prompt.md
```

| 主体对象 | 正式资源 / 输入包文件 | 生成输入参数 | 图面主体职责 |
| --- | --- | --- | --- |
| 标准竞技场 | `public/assets/i18n/zh-CN/mage-wars/board/standard-arena.jpg` -> `refs/mage-wars-step1/standard-arena.jpg`；reference sheet 内最大主体 | `--image refs/mage-wars-step1/step1-runtime-board-reference-sheet.png` | 中央第一视觉、完整 `4x3` 标准竞技场 |
| 学徒半场候选 | 依附 `standard-arena.jpg` 与 `board-coordinate-contract.md` 坐标 | 同一 reference sheet | 轻量候选 overlay，不锁定最终左右半场 |
| 法师状态板 | `mage-status-board.png` -> `refs/mage-wars-step1/mage-status-board.png` | 同一 reference sheet，但必须标 `reference-only` | 只提供聚魔、法力池、生命 / 伤害轨道语义；不得作为 Step 1 主界面可见主体 |
| 状态方块 | `BlockSquare` 来源锁定；轨道坐标见 `board-coordinate-contract.md` | prompt 说明 + reference-only 状态板输入 | 只用于解释原状态板记录方式；主界面不把黑 / 红方块当普通圆点或常驻资源栏 |
| 法师牌 | `mages-core-atlas.json` crop -> `refs/mage-wars-step1/mage-*.png` | 同一 reference sheet | 玩家身份、法师所在区域和法师牌主视觉 |
| 学徒法术牌 | `apprentice-spell-atlases.json` crop -> `refs/mage-wars-step1/spell-*.png` | 同一 reference sheet | 法术书入口、已计划法术、弃牌堆、结界 / 生物 / 装备代表卡 |
| 法术卡背 | `spell-card-back.jpg` -> `refs/mage-wars-step1/spell-card-back.jpg` | 同一 reference sheet | 对手隐藏卡、计划卡、隐藏结界背面 |
| 行动 / 快速施法 / 就绪 token | `action-marker-*`、`quickcast-marker-front.png`、`ready-token-front.png` -> `refs/mage-wars-step1/` | 同一 reference sheet | 实体行动消耗、快速施法和就绪状态 |
| 伤害 / 聚魔 / 守卫 token | `damage-token-front.png`、`channeling-token-front.png`、`guard-token.png` -> `refs/mage-wars-step1/` | 同一 reference sheet | 伤害 token 图只作素材存在证据，不是运行时默认承载；伤害用本体覆盖层 + 数字徽章，守卫等离散状态贴近宿主；不得成为大面板资源栏 |
| 攻击骰 / 效果骰 | `attack-die-texture.png` -> `refs/mage-wars-step1/attack-die-texture.png`；效果骰为来源锁定蓝色 `Die_12` | 同一 reference sheet + prompt 说明 | 攻击骰视觉和蓝色 12 面效果骰；禁止普通 D6 |

素材复查结果：2026-07-27 本轮脚本已确认 `asset-input-manifest.json` 中的工作树输入文件、Open Design `refs/mage-wars-step1/` 文件和 `step1-runtime-board-reference-sheet.png` 均存在；因此当前状态为 `asset-input-package-ready`。

### 10.4.4 框体职责回执

| 常驻边界 / 底板 | 允许性 | 真实职责 | 出图要求 |
| --- | --- | --- | --- |
| 棋盘、卡牌、token 自带印刷边 | 允许 | 正式素材自带边界 | 保留，不另套容器 |
| 状态板自带印刷边 | 仅 reference-only | 规则 / setup / 详情来源 | 不进入 Step 1 主界面 |
| 学徒半场候选 overlay | 允许但必须极轻 | 指示当前学徒范围候选 | 薄高亮、低透明，不遮挡竞技场 |
| 当前可点击区域 / 目标对象描边 | 允许但必须贴对象 | 表示当前命中区或可选目标 | 只贴区域 / 卡牌 / token，不做大面板 |
| 动作按钮底板 | 允许但数量最小 | 承载 `移动`、`施法`、`守卫`、`结束` 等短命令 | 小尺寸、贴边，不压过卡牌、token、骰盘或自制状态 HUD |
| 面板外框、黑色玻璃板、分栏框、卡片壳 | 不允许 | 无现实桌游对象职责，会抢素材主语 | 生成前禁止写入 prompt；若图中出现，AI 审计判 `REVISE` |

### 10.4.5 人工验收状态回执

- 当前人工验收：`human-review-blocked`。
- 当前有效候选：暂无；v6 / v7 均为历史失败候选，v8 必须重做。
- 历史 media / imagegen 路线：仍不是当前路线；只有用户重新明确要求图片模型生图时，才恢复 10.4.3 命令。
- 打开给用户验收条件：AI 审计逐项确认规则、素材链、少框体、隐藏信息、规则牌区白名单和可复刻门禁全部 `PASS`；当前没有候选满足。

## 11. Step 1 Open Design 候选说明

```text
Step 1 structure draft for Mage Wars apprentice mode runtime board UI.

Use a 2D printed board game UI concept, implementable runtime layout, and real Mage Wars assets as the visual subject. The full standard arena image must be the central canvas, not redrawn as CSS cells or abstract tiles. Show the apprentice 2x3 half-arena only as a lightweight candidate overlay on top of the official arena image; do not lock left or right half as final.

Visible rules to preserve:
- apprentice mode uses a 2x3 half arena from the standard arena;
- apprentice mages have 10 channeling, 24 life, and 3 basic melee attack dice;
- each player uses a mage card, action marker, quickcast marker, spell cards, card backs, attack dice, effect die, damage/channeling/status tokens, plus custom runtime life/mana/channeling HUD attached to the mage card;
- adjacent zones are horizontal/vertical only, not diagonal;
- opponent hidden information must stay face-down or filtered.

Visible assets must be actual source images or traceable atlas crops:
- standard arena: public/assets/i18n/zh-CN/mage-wars/board/standard-arena.jpg;
- mage status board: public/assets/i18n/zh-CN/mage-wars/boards/mage-status/mage-status-board.png is reference-only for setup and track semantics; it must not appear as the runtime player panel;
- apprentice mage card or portrait frames from public/assets/atlas-configs/mage-wars/mages-core-atlas.json;
- apprentice spell card frames from public/assets/atlas-configs/mage-wars/apprentice-spell-atlases.json;
- spell-card-back.jpg for hidden or face-down cards;
- action-marker-red/blue, quickcast-marker, ready-token, damage-token, channeling-token, guard/burn/rot/daze/stun/sleep tokens from the formal token paths;
- attack-die-texture.png for attack dice;
- blue source-locked d12 for effect die.

Layout:
- central official arena dominates the screen;
- player mage cards sit close to the arena edges with custom runtime life/mana/channeling HUD attached; official mage status boards must not appear as visible runtime panels;
- spellbook, prepared spell slots, discard pile, hidden enchantments, and public spell cards use real card fronts or card backs and remain readable enough to show that card decisions drive play; do not introduce a hand zone;
- action and quickcast markers are physical tokens near the mage card;
- current selectable zones use thin object-attached highlight only;
- dice and status tokens appear only where relevant, close to the affected object.

Visual restrictions:
- no dashboard layout, no generic side panels, no glass containers, no thick borders, no nested cards inside cards;
- no CSS grid board, no placeholder cards, no text-only spell list, no generic fantasy avatars;
- no ordinary D6 for the effect die;
- no independent mana token unless formal asset is supplied;
- no permanent rule explanation paragraphs in the main UI;
- buttons may only use short labels such as "移动", "施法", "守卫", "结束".

Open Design 候选应导出为单张 1920x1080 PNG/JPG/WebP 审计图。它是设计稿候选，不是真实页面截图；AI 图面核验 `PASS` 前不得打开给用户人工验收。
```

## 12. AI 图面自检表

| 检查项 | PASS 条件 |
| --- | --- |
| 规则证据 | 图前审计能回到第 4 / 6 / 7 页和本文件规则结论，且每条关键规则能映射到画面决策 |
| 素材输入包 | 所有主体对象能回到正式资源、输入包文件、生成输入参数和图面主体位置 |
| 素材主体 | 竞技场、法师、卡牌、卡背、token、骰子均由正式素材或来源锁定程序化对象承担；状态板仅可作为 `reference-only` 输入 |
| 素材复查 | 图中主体对象能回查到路径存在、尺寸、atlas frame 或来源锁定程序化证据 |
| 少边框 | 外框 / 分栏 / 玻璃板没有抢过正式素材；边框只服务印刷边、命中高亮或按钮底板 |
| 隐藏信息 | 对手私有卡不公开正面或卡名 |
| 阻塞对象 | 独立法力指示物、未锁半场方向、墙体 / 四人对象没有被画成完成态 |
| 可复刻 | 去掉随机纹理、光效、装饰后，构图、层级和交互入口仍成立 |
| 玩家第一眼 | 玩家能先看到棋盘、自己状态、自己可行动卡 / 区域和推进入口 |

## 13. 当前人工验收状态

- 当前允许人工验收：无。
- 下一步允许动作：继续走 Open Design artifact 路线，先生成 v8 硬回执和规则牌区白名单，再重做 AI 图面核验。
- 下一步禁止动作：恢复旧 `board-ui-preview.html`、使用 media / imagegen 生图路线、打开 v1-v7 或失败候选给用户验收，或把 v6 / v7 说成“用户已批准 / AI_PASS 当前有效”。
