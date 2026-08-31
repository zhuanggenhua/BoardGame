# 法师战争主 UI 设计前置矩阵

> 状态：`historical-preflight / reusable-asset-evidence / v75-open-design-target / correction-ledger-required`。本文件最初是主 UI 设计稿 / HTML 预览 / Open Design artifact / imagegen prompt / AI 图面核验的前置门禁；当前不再是“下一版待生成”入口，而是 v75 设计稿和真实 Board/UI 实现的素材准入证据。Open Design v6-v74 的旧 AI_PASS 均已撤销或被后续版本取代；foundation 真实运行页证据可作为资源链参考，但不能单独证明设计稿或实现通过。旧 `board-ui-preview.html` 仍不得重新解释为可验收设计。

## 本轮已重读来源

| 来源 | 文件 | 直接结论 |
| --- | --- | --- |
| 组件规则原文 | `D:\gongzuo\webgame\gameasset\法师战争\output\pdf\ai_readable_pdf_exports\101721 法师战争 Mage Wars 规则\pages\page_006.md` | 游戏组件包含 1 块竞技场版图、2 本法术书、322 张法术牌、4 张法师牌、2 块法师状态板、8 个状态方块、20 个行动标记、2 个快速施法标记、9 颗攻击骰、1 颗 12 面效果骰、24 枚伤害指示物和 8 枚法力指示物；这些是主 UI 素材对象入口 |
| setup 规则原文 | `D:\gongzuo\webgame\gameasset\法师战争\output\pdf\ai_readable_pdf_exports\101721 法师战争 Mage Wars 规则\pages\page_007.md` | 当前运行只消费标准竞技场 12 区域、正式部署和状态 / 行动标记规则；学徒半场只作历史资料 |
| 学徒规则与法术书 | `docs/games/mage-wars/rule/apprentice-spellbooks.md` | 四名学徒法师属性、生命 24、法术书数量和 `CardID` 候选已锁定 |
| 学徒法术图集 | `docs/games/mage-wars/rule/apprentice-card-atlas-contract.md` | deck 源图和 `CardID` frame 候选已锁；正式 atlas/frame 已由 `apprentice-spell-atlases.json` 和 `CardPreview` 消费 |
| 学徒逐卡字段 | `docs/games/mage-wars/rule/apprentice-card-field-contract.md` | 91 张学徒范围卡牌 S0 字段已录入；临时裁图只作核对 |
| 规则对象素材总矩阵 | `docs/games/mage-wars/intake/rule-object-asset-matrix.md` | 阶段 0 历史快照；当前完成状态以后续资源链和运行时审计为准 |
| 运行时素材计划 | `docs/games/mage-wars/intake/runtime-asset-plan.md` | 34 张首轮素材已正式落盘、压缩并生成 manifest；当前真实运行页与远端 / Android 资源链已完成 foundation 验证 |
| UI 合同 | `design-system/games/mage-wars.md`、`docs/games/mage-wars/design/reference/user-correction-traceability-ledger.md` | 旧 `board-ui-preview.html` 与 Open Design v1-v74 均不得作为当前人工验收候选；v75 / 实现截图必须逐项消费规则牌区白名单、正式素材输入包和用户纠正覆盖账本 |

## 状态口径

| 状态 | 对设计稿的含义 |
| --- | --- |
| `pass` | 可出现在运行时完成截图和人工验收稿；必须已有正式落盘、压缩/manifest 或 atlas config、运行时引用证据 |
| `foundation-runtime-ready` | foundation 范围内已被当前 Board / E2E / 资源链证明可以使用；不代表完整 Mage Wars 所有标准模式能力已完成 |
| `foundation-representative-ready` | foundation 已有正式素材和代表性 UI 表达；完整规则交互或全量槽位后续扩展 |
| `deferred-after-foundation` | 明确不阻塞当前 foundation；进入完整游戏、自由构筑、全卡表或更细交互时再补 |
| `design-asset-ready` | 可出现在位图设计稿、AI 视觉核验图和人工视觉验收候选；源素材已正式落盘、压缩并有 manifest 或 atlas config，但不得用来宣称运行时已完成 |
| `partial-design-asset-ready` | 复合对象中已有部分素材可用于设计稿，但仍有子对象缺正式素材或替代裁定；只允许显示已就绪子对象，不得把整组画成完成态 |
| `source-locked-programmatic` | Workshop 或规则源明确为内置对象、颜色、尺寸或算法表达，没有独立贴图；可按来源程序化渲染，但必须回查来源字段，不能自由替代 |
| `coordinate-contract-ready` | 图面轨道 / 区域坐标已建立设计合同；仍不表示运行时点击或组件已实现 |
| `zone-anchor-contract-required` | 可见主体素材可用，但区域方向、对象锚点、跨区阈值或 token 贴附规则未通过；不得出设计稿 PASS |
| `coordinate-contract-partial` | 坐标或候选区域已有合同，但仍保留方向、半场、运行时命中区或用户裁定缺口 |
| `approved-programmatic` | 可出现在位图设计稿和人工视觉验收候选；仅限规则不需要图片，或用户明确批准程序化替代 |
| `planned-not-moved` | 只能作为内部布局参考；不得出现在人工视觉验收候选里冒充正式素材 |
| `frame-candidate` | 只能作为裁切 / atlas config 输入；不得直接展示为正式卡牌 |
| `temp-only` | 只能作为录入核对图；不得进入设计稿、运行时或人工验收 |
| `blocked` | 不得在人工视觉验收候选中表现为已完成对象 |
| `out-of-scope` | 不属于首轮基础版；不得为了画面丰富而加入 |

## 主 UI 对象准入矩阵

| 规则对象 | 规则依据 | 基础版主 UI 可见 | 应用素材 / 正式素材要求 | 当前素材状态 | 允许画面表达 | 禁止替代方式 | 进入下一版设计稿前动作 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 标准竞技场 | 规则页竞技场与区域规则；`rule-object-asset-matrix.md` | 是，第一视觉主体 | `board/standard-arena.jpg`，并需要完整 4x3 区域热区坐标合同 | `foundation-runtime-ready / coordinate-contract-ready` | 当前 Board 用 `OptimizedImage` 渲染完整正式竞技场；真实入口截图已验证 | 纯 CSS 棋盘、抽象 2x3 色块、旧 HTML 背景图或半场裁切冒充正式棋盘 | 后续只扩展标准竞技场规则对象，不再建立学徒地图分支 |
| 历史学徒半场 | 历史规则资料；不属于当前运行目标 | 否，out-of-scope | 仅保留文档 / 迁移对照 | `historical / out-of-scope` | 不进入当前 Board、E2E 或人工验收图 | 把半场当当前区域、高亮或正式入口 | 不再为其新增布局、入口或实现 |
| 四名学徒法师 | `apprentice-spellbooks.md`；法师牌 atlas 计划 | 是 | `cards/mages/mages-core-atlas.png` + 四名法师 frame | `foundation-runtime-ready / atlas-loader-ready` | 当前 Board 用 `CardPreview` 渲染正式法师 atlas | 圆形头像、字母徽章、通用 fantasy 头像 | 扩展法师留到 foundation 后 |
| 法师状态板 | 规则起始生命、法力、聚魔、行动标记 | 否，主界面只作参考来源 | `boards/mage-status/mage-status-board.png`；状态方块与轨道坐标见 `board-coordinate-contract.md` | `reference-only / coordinate-contract-ready / preloaded-reference` | 状态板不进入主界面；当前 Board 使用贴近法师牌的自制生命 / 法力 / 聚魔 HUD | 把整张状态板或裁切状态板当玩家血量 / 蓝量面板；把 reference sheet 里的状态板复现到主界面 | 状态板详情层留到 foundation 后 |
| 法术书 / 已计划法术 / 弃牌堆 | 规则计划与隐藏信息；`apprentice-spellbooks.md`；用户纠正覆盖账本 | 是，本人可见；对手隐藏信息保密 | 通用法术卡背、学徒法术牌 atlas/frame、私密可见规则 | `foundation-runtime-ready / hidden-info-boundary-verified / v75-layout-locked` | v75 目标：法术书当前页 6 张、已计划 2 张同尺寸、对手已计划左上卡背、公开弃牌堆在右侧竖向空位并显示紧凑顶牌正面 / 半露正面 + 数量；实现必须逐项复刻这些职责 | 文字列表、灰色卡壳、临时裁图当正式卡；公开弃牌堆不得用卡背误导成未知牌；禁止命名为手牌或对手手牌；不得把已计划和已选法术重复画成两个实体 | 实现前列明 `规则名 -> UI 名称 -> 可见性 -> 流转关系 -> 可操作入口 -> v75 图面承载` |
| 学徒法术牌正面 | 91 张字段合同；`apprentice-card-field-contract.md` | 是，选牌 / 详情时可见 | deck `17/18/19/22/28/29/34/35/36/37` 的正式 atlas config | `foundation-runtime-ready / atlas-loader-ready` | 当前 `apprentice-spell-atlases.json` 覆盖 91 张，`CardPreview` 已消费 | `temp/mage-wars/apprentice-card-crops/*.png` 进入设计稿；CSS 卡面冒充正式卡 | 全 322 张法术留到后续 change |
| 通用法术卡背 | 法术书未知内容、对手已计划法术、隐性结界 | 是 | `cards/backs/spell-card-back.jpg` | `foundation-runtime-ready` | 对手已计划法术、未公开法术书内容和隐性结界使用正式卡背；不得泄露正面或卡名 | 纯色背面、锁图标、任意牌背替代；公开弃牌堆顶牌不得用卡背伪装成隐藏信息；禁止称为对手手牌 | 无 |
| 装备 / 装备栏 | deck `37` 装备字段；法师附件规则 | 是，公开附件 | 装备卡 atlas frame；装备槽位合同 | `foundation-representative-ready / full-slot-contract-deferred-after-foundation` | 装备卡 atlas frame 已在 91 张学徒范围内；v8 应以公开附件摘要表达 | 普通小 badge 或文字属性替代装备卡 | 完整装备槽规则留到 foundation 后 |
| 结界 / 隐性结界 | 结界字段、展示费用、隐藏信息规则 | 是，但身份按视角隐藏 | 结界卡正面、通用卡背、附件区显示规则 | `foundation-representative-ready / hidden-card-boundary-ready / reveal-contract-deferred-after-foundation` | v8 必须保持对手隐藏信息边界；正式卡背可用 | 对手视角公开卡名；用普通状态文字替代结界卡；称为对手手牌 | 展示费用 / 强制展示完整流程留到 foundation 后 |
| 生物 / 魔物 | deck `22/28/29` 字段；召唤与区域对象规则 | 是 | 对应生物 / 魔物卡面 atlas frame，区域内对象状态 | `foundation-representative-ready / zone-anchor-contract-required-for-design` | 生物 / 魔物卡面已在正式学徒 atlas 中；下一稿必须把每张场上卡放进唯一所属区域，不能靠自由坐标摆放 | 小圆点、通用怪物头像、文字 count 替代卡面；借用其它游戏卡图；卡牌骑在区域线或格外 | 多对象区域堆叠和召唤流程留到 foundation 后，但基础区域锚点必须先过 |
| 墙体 | 规则含墙体；首轮学徒范围未锁正式墙体卡 | 仅后续或出现相关牌时 | 横向卡背和墙体卡 atlas | `out-of-scope` / `blocked` | 不出现在下一版基础验收稿 | 为了丰富棋盘随手画墙 | 若基础牌实际引入墙体，再补墙体规则与素材矩阵 |
| 攻击骰 | 攻击法术、生物攻击、治疗掷骰 | 是，结算时可见，且是当前攻击主反馈 | 攻击骰贴图或正式 2D 骰面方案；必须锚在目标 / 来源 / 主舞台链路 | `foundation-runtime-ready / texture-backed-2d / v75-settlement-placement-locked` | v75 目标：攻击骰位于主舞台上层并贴近来源 / 目标 / 动作链；实现不得省略或边栏化 | 普通 D6 点数、随机数字气泡替代攻击骰；当前攻击骰放右侧栏、角落、日志或牌区旁作为主反馈 | 实现截图补核心结算落位几何检查；完整骰面动画留到 foundation 后 |
| 效果骰 | 攻击条效果、燃烧 / 眩晕 / 昏迷等 | 是，附加效果结算时可见，且与目标状态相邻 | Workshop 内置 `Die_12`；蓝色 12 面骰，见 `board-coordinate-contract.md`；必须锚在目标 / 状态结果附近 | `source-locked-programmatic / foundation-runtime-ready / v75-settlement-placement-locked` | v75 目标：效果骰与攻击骰、目标状态和 token 构成同一结算链；允许程序化，但不能退成普通蓝圆或右侧摘要 | 普通 D6、百分比、文本结果替代骰子；把当前效果骰降级到右侧摘要或日志；粗糙普通蓝圆 | 实现截图补核心结算落位和视觉质量检查；完整 12 面骰结果动画留到 foundation 后 |
| 行动 / 快速施法 / 就绪标记 | 回合行动、快速施法和冷却规则 | 是 | 红 / 蓝行动标记、就绪 / 冷却 token、黑色快速施法标记 | `foundation-runtime-ready` | 当前 Board 用正式就绪 / 快速施法 token 表达状态 | 普通灰色 chip、圆点开关替代；用红 / 蓝行动标记替代黑色快速施法标记 | 无 |
| 生命 / 法力 / 聚魔 / 伤害运行态读数 | 学徒起始法力、聚魔、伤害与生命 | 是，但用自制运行态 UI | 规则来源为状态板轨道；伤害用对象本体覆盖层 + 数字徽章，聚魔 token 可在对象附近作增强；独立法力指示物仍缺源 | `approved-programmatic-runtime-ui / foundation-runtime-ready / independent-mana-token-deferred-after-foundation` | 当前 Board 使用贴近法师牌的生命条、法力蓝条、聚魔短读数和伤害数值；状态板只作 reference-only 来源 | 把状态板原图当常驻面板；纯文字资源栏脱离法师对象；用聚魔 token 顶替法力；把独立法力 token 画成已完成对象；为了贴伤害 token 图遮挡卡面 | 独立法力 token 留到 foundation 后 |
| 守卫、燃烧、腐化、眩晕、昏迷、沉睡 token | 状态规则与逐卡字段 | 是，状态出现时可见 | 对应状态 token 图 | `foundation-runtime-ready-for-guard-and-core-status / full-status-tooltip-deferred-after-foundation` | 当前 Board 已接守卫、燃烧、腐化、眩晕、昏迷 token；沉睡素材已进资源链，执行器后续；伤害另走现代数值状态 UI | 通用彩色 badge、emoji、纯文字替代离散状态 token | 完整状态层数、沉睡执行器和 tooltip 留到 foundation 后 |
| 法术释放 FX | 用户硬需求；事件驱动 FX 合同 | 是，结算时可见 | 程序化 FX 可行，但必须由规则事件驱动 | `foundation-runtime-ready / event-driven-fx-verified` | `EventStreamSystem` 事件映射到 `FxLayer`，单测和真实入口通过 | 点击按钮直接播成功特效；用 FX 掩盖缺卡面 / token | 更丰富法术粒子留到 foundation 后 |
| 日志 / 撤回 / 帮助 | 通用 HUD / FAB 承载，非主视觉 | 可按需入口 | 复用通用组件，不需要游戏素材 | `out-of-scope` for visual subject | 只能是轻量入口或展开层 | 常驻大面板、解释性正文墙、第二套行动日志 | Board 实现阶段接通 ActionLog / Undo；设计稿不把它们做成主视觉 |

## 当前 foundation 收口结论

- **Open Design v6-v74 均保留为历史候选**：它们只作为失败证据、历史基线或被取代的中间稿。当前 PC 目标稿是 v75，且实现必须逐项消费用户纠正覆盖账本。
- **真实运行页已完成 foundation 层技术验证**：`Board.tsx` 使用正式竞技场、法师 atlas、学徒法术 atlas、卡背、token、攻击骰和来源锁定效果骰 UI；桌面与移动横屏 E2E 曾通过并落图，但这不能证明当前设计稿的区域锚点通过。
- **资源链已闭合 foundation 范围**：服务器主源、Android 游戏素材包、atlas JSON 和本地 manifest 的回查证据见 `runtime-resource-chain-audit.md`。
- **仍不得扩展完成口径**：本文件不证明全 322 张法术、自由构筑、四人模式、豪华竞技场、扩展法师、完整 AI、教程、行动日志 UI 或撤回 UI 完成。
- **后续进入高保真实现的门槛**：v75 目标稿必须先有用户明确人工批准；进入实现后，真实截图必须同时对照 v75 原图、v75 审计、几何证据和用户纠正覆盖账本，不得用 E2E 通过或“整体像”替代。
