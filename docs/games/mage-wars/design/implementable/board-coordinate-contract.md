# 法师战争主 UI 坐标与内置物件合同

> 状态：`formal-4x3-runtime-coordinate-source / current`。运行时只使用正式 `4列 x 3行` 竞技场；“学徒”仅保留在角色名和迁移期历史数据中，不再作为地图模式或运行时分支。

## 本轮重读证据

| 来源 | 路径 | 本轮直接结论 |
| --- | --- | --- |
| 历史学徒规则（不作为当前目标） | `D:\gongzuo\webgame\gameasset\法师战争\output\pdf\ai_readable_pdf_exports\101721 法师战争 Mage Wars 规则\pages\page_004.md` | 仅保留作历史规则 / 角色命名对照；当前运行不使用 `2x3` 学徒竞技场。 |
| 组件清单 | `D:\gongzuo\webgame\gameasset\法师战争\output\pdf\ai_readable_pdf_exports\101721 法师战争 Mage Wars 规则\pages\page_006.md` | 基础组件包含标准竞技场、法师状态板、状态方块、行动标记、快速施法标记、攻击骰、12 面效果骰、伤害指示物和法力指示物。 |
| 设置规则 | `D:\gongzuo\webgame\gameasset\法师战争\output\pdf\ai_readable_pdf_exports\101721 法师战争 Mage Wars 规则\pages\page_007.md` | 标准竞技场共 `12` 区域；相邻只按水平 / 垂直共享边，不按对角；每名玩家拿 `3` 个黑色状态方块、`1` 个红色状态方块和 `1` 个黑色快速施法标记；状态板用状态方块记录初始聚魔、法力池、生命和伤害。 |
| 正式竞技场素材 | `public/assets/i18n/zh-CN/mage-wars/board/standard-arena.jpg` | 源尺寸 `3210x2407`；图面为 `4` 列 x `3` 行标准竞技场。 |
| 正式状态板素材 | `public/assets/i18n/zh-CN/mage-wars/boards/mage-status/mage-status-board.png` | 源尺寸 `3093x1628`；图面包含聚魔 `4x4`、法力池 `5x7`、生命 / 伤害 `6x7` 三块轨道。 |
| Workshop 存档 | `D:\gongzuo\webgame\gameasset\法师战争\Mods\Workshop\2607721556.json` | 状态方块是内置 `BlockSquare`，红 / 黑色源自 `ColorDiffuse`；效果骰是内置 `Die_12`，不是普通 D6，也没有独立贴图源。 |

## 竞技场坐标合同

标准竞技场以源图完整画布作为唯一视觉主体，不允许用 CSS 网格、抽象色块或临时截图替代。

| 字段 | 值 |
| --- | --- |
| 素材路径 | `public/assets/i18n/zh-CN/mage-wars/board/standard-arena.jpg` |
| 源尺寸 | `3210x2407` |
| 标准区域网格 | `4` 列 x `3` 行，共 `12` 区域 |
| 区域坐标公式 | `left=(col-1)/4`、`top=(row-1)/3`、`width=1/4`、`height=1/3` |
| 邻接公式 | 两区域共享水平或垂直边才相邻；对角不相邻 |
| 印刷门位 | 图面可见门位在左上角区域和右下角区域；只能作为视觉证据，不自动决定学徒半场方向 |

| 标准区 ID | row | col | normalized rect |
| --- | ---: | ---: | --- |
| `std-r1c1` | 1 | 1 | `0.00, 0.00, 0.25, 0.3333` |
| `std-r1c2` | 1 | 2 | `0.25, 0.00, 0.25, 0.3333` |
| `std-r1c3` | 1 | 3 | `0.50, 0.00, 0.25, 0.3333` |
| `std-r1c4` | 1 | 4 | `0.75, 0.00, 0.25, 0.3333` |
| `std-r2c1` | 2 | 1 | `0.00, 0.3333, 0.25, 0.3333` |
| `std-r2c2` | 2 | 2 | `0.25, 0.3333, 0.25, 0.3333` |
| `std-r2c3` | 2 | 3 | `0.50, 0.3333, 0.25, 0.3333` |
| `std-r2c4` | 2 | 4 | `0.75, 0.3333, 0.25, 0.3333` |
| `std-r3c1` | 3 | 1 | `0.00, 0.6667, 0.25, 0.3333` |
| `std-r3c2` | 3 | 2 | `0.25, 0.6667, 0.25, 0.3333` |
| `std-r3c3` | 3 | 3 | `0.50, 0.6667, 0.25, 0.3333` |
| `std-r3c4` | 3 | 4 | `0.75, 0.6667, 0.25, 0.3333` |

### 旧学徒半场资料（不再作为运行目标）

- 旧规则资料曾记录学徒模式只使用标准竞技场一半，即 `2x3` 六区域；该模式已从当前运行目标移除。
- 视觉源已锁：当前正式竞技场素材是 `4x3`，因此图面上的完整半场候选是左半场或右半场。
- 代码现状：`src/games/mage-wars/domain/ids.ts` 只提供逻辑区域 `a1/a2/a3/b1/b2/b3`，`createApprenticeArena()` 只证明抽象 `2x3` 结构，不证明它对应标准图的左半场或右半场。
- 当前复核：半场资料不再进入当前设计稿或运行时；所有新设计和实现只消费完整 `4列 x 3行` 标准坐标。
- 旧运行时裁定：当前 Board 曾采用玩家可见 `3列 x 2行` 舞台并通过 foundation 技术验证；该证据只能保留为历史实现状态，不能反向证明下一版设计稿区域方向正确。
- 当前禁止：不得重新引入 `2x3` 学徒地图分支或把半场截图当正式地图验收稿；所有运行时区域必须回到本文件的 `4×3` 标准坐标。

### 历史运行时玩家可见 2x3 舞台映射（仅供追溯）

`src/games/mage-wars/Board.tsx` 曾叠加一个玩家可见的 `3列 x 2行` 交互舞台。该段只解释历史 E2E，不是当前实现坐标源；当前 Board 已使用完整 `4×3` 区域映射。

| 逻辑区 ID | row | col | Board 舞台百分比 rect |
| --- | ---: | ---: | --- |
| `a1` | 0 | 0 | `left=4.5%, top=7%, width=29%, height=39%` |
| `a2` | 0 | 1 | `left=35.5%, top=7%, width=29%, height=39%` |
| `a3` | 0 | 2 | `left=66.5%, top=7%, width=29%, height=39%` |
| `b1` | 1 | 0 | `left=4.5%, top=54%, width=29%, height=39%` |
| `b2` | 1 | 1 | `left=35.5%, top=54%, width=29%, height=39%` |
| `b3` | 1 | 2 | `left=66.5%, top=54%, width=29%, height=39%` |

FX 层旧实现使用逻辑 `row / col` 的 `3x2` 单元格公式：`left=(col/3)*100`、`top=(row/2)*100`、`width=100/3`、`height=100/2`。后续若进入真实 Board/UI 修正，必须由已批准的 `2列 x 3行` 设计合同反推实现，不得在设计稿未批前改运行时代码。

## 法师状态板轨道合同

状态板源图本身是正式素材，但在 Step 1 主界面中只作为 `reference-only` 规则 / setup / 详情来源。轨道坐标用于解释状态方块如何在原板面记录聚魔、法力池、生命和伤害；主界面常驻读数必须使用贴近法师牌的自制生命 / 法力 / 聚魔 HUD，不得把整张状态板或裁切状态板当玩家面板，也不得用脱离对象的普通资源栏冒充运行态 HUD。

| 轨道 | 素材区域像素 rect | normalized rect | 网格 | 数值范围 | 数值映射 |
| --- | --- | --- | --- | --- | --- |
| 聚魔 | `x=28,y=214,w=806,h=849` | `0.0091,0.1314,0.2606,0.5215` | `4x4` | `5-20` | `row=floor((value-5)/4)+1`，`col=((value-5)%4)+1` |
| 法力池 | `x=846,y=214,w=1012,h=1391` | `0.2735,0.1314,0.3272,0.8544` | `5x7` | `0-34` | `row=floor(value/5)+1`，`col=(value%5)+1` |
| 生命 / 伤害 | `x=1912,y=214,w=1138,h=1391` | `0.6185,0.1314,0.3679,0.8544` | `6x7` | `0-41` | `row=floor(value/6)+1`，`col=(value%6)+1` |

| 学徒初始记录 | 数值 | 轨道格 | 方块 |
| --- | ---: | --- | --- |
| 聚魔 | 10 | 聚魔 row 2 / col 2 | 黑色状态方块 |
| 法力池 | 10 | 法力池 row 3 / col 1 | 黑色状态方块 |
| 生命 | 24 | 生命 / 伤害 row 5 / col 1 | 黑色状态方块 |
| 伤害 | 0 | 生命 / 伤害 row 1 / col 1 | 红色状态方块 |

## Workshop 内置物件裁定

这些对象没有独立图片贴图，但 Workshop 已提供内置对象类型、颜色和尺寸语义。后续设计稿 / 实现若使用程序化形状，必须回查本表；不能把它们降级为泛用圆点、普通数字或相似 token。

| 规则对象 | Workshop 证据 | 视觉裁定 | 当前状态 |
| --- | --- | --- | --- |
| 黑色状态方块 | `BlockSquare`；`ColorDiffuse r=0.0980377,g=0.0980377,b=0.0980377`；`scale=0.7000003` | 只在 setup、详情层或规则回看中贴到状态板轨道坐标；Step 1 主界面不得复现状态板轨道或把方块当资源点 | `source-locked-programmatic / reference-only-for-main-ui` |
| 红色状态方块 | `BlockSquare`；`ColorDiffuse r=0.856,g=0.099998,b=0.093998`；`scale=0.7000003` | 只在 setup、详情层或规则回看中贴到状态板伤害轨道；Step 1 主界面伤害读数走贴近法师牌的自制 HUD | `source-locked-programmatic / reference-only-for-main-ui` |
| 效果骰 | `ObjectStates.2` 无限袋 `效果骰`；Contained `Die_12`；`ColorDiffuse r=0.117999949,g=0.53,b=1` | 当前 Board 以蓝色 `d12` 程序化对象表达效果骰；不得画成普通 D6 或百分比文本 | `source-locked-programmatic / foundation-runtime-ready` |
| 法师法力池 | 规则页 7 要求用黑色状态方块记录所有法师起始 10 点法力 | 状态板法力池只作为 `reference-only` 规则 / setup 来源；主界面法力必须走贴近法师牌的自制法力 HUD，不能用状态板轨道或独立法力 token 顶替 | `reference-only-for-main-ui` |
| 独立法力指示物 | 规则页 6 列出 8 枚法力指示物；本轮本地正式图片目录和 Workshop 昵称搜索未命中独立可用素材 | 非状态板法力 token 仍为 blocked；即使主界面使用自制法力 HUD，也不能把独立法力指示物画成已完成素材 | `blocked` |

## 当前 foundation 影响

- 当前 Board 已使用正式竞技场图、完整 `4列 x 3行` 区域映射、蓝色 12 面效果骰程序化对象和正式起始法术书 atlas；桌面 / 移动横屏真实入口 E2E 是运行时证据，但不替代完整 Mage Wars 范围声明。
- 正式状态板图、状态板轨道坐标和红 / 黑状态方块仍只作为 `reference-only` 规则 / setup / 详情输入，不能成为 Step 1 主界面常驻玩家面板。
- 标准竞技场源图按完整 `4列 x 3行` 坐标合同消费；旧半场方向选择不再是当前实现或设计稿前置条件。
- 独立法力指示物仍未闭合；当前 foundation 通过贴近法师牌的自制法力 HUD 避开该对象，不把非状态板法力 token 画成已完成素材。
- 服务器 / Android 资源回查、真实截图和 E2E 证据见 `runtime-resource-chain-audit.md` 与 `test-results/evidence-screenshots/mage-wars/foundation-board-runtime/evidence.md`。
