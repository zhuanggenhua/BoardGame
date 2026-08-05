# 召唤师战争：暗影精灵素材与录入合同

## 当前批次范围

- 游戏：召唤师战争（`summonerwars`）
- 派系 ID：`shadow`
- 中文名：暗影精灵
- 当前工作区：`D:\gongzuo\webgame\BoardGame`，`main`
- 用户指定素材目录：`public/assets/i18n/zh-CN/summonerwars/hero/shadow/`
- 发现时间：2026-08-04（Asia/Shanghai）
- 运行时目标：保留原始素材，新增独立的 `cards` 8×2 图集；不修改老派系共享图集合同。

## 审计范围

- 本轮覆盖文件：暗影精灵派系配置、图集与关键图预加载、AI/音频/本地化/manifest、领域能力与事件执行器、暗影精灵定向测试、真实入口 E2E 和本 evidence。
- 本轮覆盖对象：瑟伦达、3 张英雄、4 类士兵、4 张事件、起始城门、普通传送门、30 张预构筑牌组，以及 `cards`/`hero`/`tip` 正式资源。
- 本轮覆盖共享链路：派系解析、牌组注册、卡牌图集回退、InteractionSystem、伤害/离场/死亡/阶段结束触发、持续事件、攻击合法性查询、资源 manifest 和服务器主源。
- 明确不在范围内：被排除的两张混入素材不进入运行时；其它派系独立既有问题、全仓 i18n warning 和 `under_construction` 发布标记不作为暗影精灵机制缺口。

## 全面审计自检表

本表按新增派系全面审计要求维护；出现非 `passed` 项时，整体口径降级为“代表性玩法已验证”或“仍有残余范围”。

| 自检项 | 状态 | 当前证据 |
| --- | --- | --- |
| 对象全集 | `passed` | 1 名召唤师、3 名英雄、4 类士兵、4 张事件、起始城门、普通传送门和 30 张预构筑牌组已在配置与下方矩阵逐项登记 |
| 规则子句表 | `passed` | 下方卡面规则表与对象矩阵逐项登记触发、目标、主效果、可选/否定和清理 |
| 完整技能流程矩阵 | `passed` | 下方“完整技能流程矩阵”覆盖 13 个能力和 4 张事件卡 |
| L0-L4 证据层级 | `passed` | L0-L2、资源合同和同一真实入口整文件 E2E 均通过；11 个场景全部 `passed`，36 张原始截图已逐张完成 UI 审计 |
| 资源链与服务器主源回查 | `passed` | 单派系前缀预检、3 个 WebP 上传、HTTP 200/Content-Length/下载 SHA-256 回查均通过 |
| 阶段/生命周期收口 | `passed` | 交互完成后 `sys.interaction.current` 清空，阶段结束分支在推进前结算，持续事件和替换交互无残留 |
| 命中 D 维度 | `passed` | D1/D2/D3/D4/D5/D6/D7/D8/D9/D11/D12/D14/D15/D18/D21/D23/D52 已登记 |
| 关键组合矩阵 | `passed` | 下方“关键组合与否定路径”覆盖伤害充能、阶段结束、持续替换、双步事件和可选跳过 |
| 框架消费合同矩阵 | `passed` | 下方“框架消费合同”逐项列出生产入口、共享消费者、最终状态和测试 |
| L4 共享链判等矩阵 | `passed` | 下方矩阵明确哪些只复用共享壳、哪些不判定为完全同构并保留独立证据 |
| 真实入口 E2E 与截图核验 | `passed` | 同一 `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-shadow.e2e.ts` 入口完成 `11 passed`（约 `10.9m`），36 张原始截图逐张 UI 审计 `PASS` |
| 测试语义对账 / 旧测试失效检查 | `passed` | 当前 3 个暗影精灵定向测试文件与真实入口结果已对账；未发现旧暗影精灵 evidence |
| 同类扩审记录 | `passed` | 暗影精灵 13 个能力和 4 张事件均已纳入同一批对象矩阵，不以单个代表对象外推 |
| 缺口分类与范围裁定 | `passed` | `under_construction` 被裁定为派系目录发布标记，不是能力实现缺口；范围外 i18n warning 单独列出 |
| 残余范围声明 | `passed` | 文末明确目录发布标记和范围外 warning，不把它们混成规则完成证据 |
| 旧 evidence / 旧结论对账回写 | `passed` | 本文件是当前暗影精灵唯一专项 evidence；历史素材数量说法已按当前文件系统回写 |

## 批次矩阵

| objectId | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `shadow` / 暗影精灵 | `passed` | `passed` | `passed` | `passed` | `passed:同一 CI 入口 11 passed，36 张截图` | `passed` |

## 权威来源与对照源

卡名、卡面字段、规则原文和图集槽位以 `temp/summonerwars-shadow-source-cards/` 中的 11 张完整单卡、正式目录中的 `hero.jpg`/`tip.jpg` 和当前 `cards.jpg` 图集为准；`temp/summonerwars-shadow-excluded-source/` 中的两张混入素材只作为排除记录。现有老派系代码和 `docs/games/summonerwars/workflows/summonerwars-faction-intake.md` 只作为结构与版式对照，不覆盖卡面内容。

正式运行目录当前只有 3 张 JPG 派生/运行时资源，原始单卡核对输入位于 `temp/`，不能把两层混称为同一目录。

### 正式运行目录资源

| 文件 | 用途判定 | 尺寸 | 字节数 | SHA-256 |
| --- | --- | ---: | ---: | --- |
| `hero.jpg` | 召唤师完整卡面 | 786×562 | 112060 | `e04bc9cb1b6c2553757909b145a84bf554b02fcd95f77566577ed3343ddf9622` |
| `cards.jpg` | 11 张暗影精灵单卡手工合成的正式 8×2 图集 | 6288×1124 | 1712169 | `93be01d71bd1971d73111a986afbac7ab34257ac101ac733abef86cf7e73780d` |
| `tip.jpg` | 起始部署与传奇事件提示板 | 786×562 | 114078 | `d90b3f7c34fe363de401a1cf81ab2fb489a36ab241232c88c95a5c24de5953e0` |

### 原始单卡核对输入（`temp/summonerwars-shadow-source-cards/`）

这些文件用于卡面字段回读和图集拼接，不是运行时直接请求的资源：

| 文件 | 用途判定 | 尺寸 | 字节数 | SHA-256 |
| --- | --- | ---: | ---: | --- |
| `httpcloud...9181159...9545.jpg` | 传奇事件：隐入黑暗 | 786×562 | 105398 | `5ac3fab0f58ad8c52fb667c40964bb55b7ef73aba7c1a3a1701244666d4b285f` |
| `httpcloud...918128044...74F3.jpg` | 普通事件：玛尔典籍 | 786×562 | 105091 | `38029a8e6119bbf223ec47491a92190ca06c93b1b0596752300ec44b745097ea` |
| `httpcloud...918136421...B820.jpg` | 普通事件：迅如闪电 | 786×562 | 98800 | `ba8875519331835b49587947ca3ef1693f8d022598c4292ff415914d0999983e` |
| `httpcloud...9181446...B58B.jpg` | 普通事件：暗影脉冲 | 786×562 | 97009 | `66030645a0d2d039cde0f227a2de3923a9c08ec950584f1a92b116dc07d2098c` |
| `httpcloud...91815287...85D6.jpg` | 士兵：暗影法师 | 786×562 | 119597 | `ceefb33968bf1dc8fd805976a0e6a92d6e6364fc2a3612e1e19ac00805202bb` |
| `httpcloud...918161847...1853E.jpg` | 士兵：真实探求者 | 786×562 | 102469 | `5cad1c079bcc1f243d4a8e01c64ed9635103401be9cedc8552ce5d4e2c0ecd6d` |
| `httpcloud...9181741...CA461.jpg` | 士兵：暗影骑士 | 786×562 | 115627 | `4e22c36ddf7cf1acb1df3a1ddcc16d85029f317eef15e4bc3d6aa05703cee6a6` |
| `httpcloud...9181854...A968.jpg` | 士兵：圣贤巡游者 | 786×562 | 108997 | `72da3f6fca5578e695a43b95a3eef5dc33ebe8484a3e461d183b9205a94b8d01` |
| `httpcloud...918194666...C5DD.jpg` | 英雄：虚梦安 | 786×562 | 96494 | `da05ec656a89f20c4979bc175c5c2ec23ae94005f1e2d9933b7383b41789eeea4` |
| `httpcloud...9182034...A0083.jpg` | 英雄：塔莉娅 | 786×562 | 95143 | `a4939210f4f7e7d77b918631b01468570958d3f4917889ac2965489c12a6d086` |
| `httpcloud...9182146...9A4.jpg` | 英雄：萨玛拉 | 786×562 | 94180 | `535ec15a3e165a3d9f46245c7622bc5c8a642addf7dafb4b18a23e22bb523070` |

### 排除素材（`temp/summonerwars-shadow-excluded-source/`）

| 文件 | 排除原因 | 尺寸 | 字节数 | SHA-256 |
| --- | --- | ---: | ---: | --- |
| `mixed-cloud-wanderer-summoner.jpg` | 云游行者召唤师，不属于暗影精灵，不进入牌组或图集 | 786×562 | 110820 | `e5ac567b1ee26ac2bfcaa22c397601232515e9a88afafb52bf9a3c3f9093598` |
| `mixed-gem-dancer-ancestral-navigator-setup.jpg` | 宝石舞者/祖灵航海家部署参考图，不属于标准暗影精灵卡面 | 786×562 | 109492 | `65d731d8330871a7376a7b96e6d147aa11360cf6ad57a6ab9aa7004640b0901d` |

## 图面字段版式合同

- 卡名：完整卡面左上大标题。
- 卡牌类型与阶段：标题下方蓝色栏；“英雄单位/士兵单位/传奇事件/普通事件”决定运行时对象类别，“召唤阶段/移动阶段/建造阶段/攻击阶段”决定事件时机。
- 费用：卡面左上黑色费用框第一个数字。
- 生命：单位左上红心数字；召唤师同样读取红心数字。
- 战力与攻击类型：单位右下圆牌数字；圆牌内弓形标记为远程，剑形标记为近战。
- 牌组符号：费用/生命栏右侧符号条；暗影精灵召唤师卡显示月亮与星形，运行时符号合同为 `moon` + `star`。
- 召唤师：运行时 `cost: 0`，来源为 `hero.jpg`，使用独立 `hero` 图集单帧。
- 城门与起始单位：`tip.jpg` 负责名称和位置；本批起始单位为圣贤巡游者（▲）与暗影法师（■），传奇事件为隐入黑暗×2。
- 地图式参考图：`...8750726...54B8.jpg` 只作为来源记录，不属于标准卡面，不能进入运行时卡池或 `cards` 图集。

## 正式 cards 图集槽位合同

由于本批素材中真正属于暗影精灵的是 11 张独立卡面，且单格尺寸为 786×562，正式图集采用现有新派系统一的 8 列×2 行、无间距、原尺寸拼接；slot 11-15 保留为空白占位。槽位按下表固定，所有运行时 `spriteIndex` 必须引用该表：

| slot | 对象 | 类型 | 运行时 ID |
| ---: | --- | --- | --- |
| 0 | 虚梦安 | 英雄 | `shadow-xumengan` |
| 1 | 塔莉娅 | 英雄 | `shadow-talia` |
| 2 | 萨玛拉 | 英雄 | `shadow-samara` |
| 3 | 暗影法师 | 士兵 | `shadow-shadow-mage` |
| 4 | 真实探求者 | 士兵 | `shadow-truth-seeker` |
| 5 | 暗影骑士 | 士兵 | `shadow-shadow-knight` |
| 6 | 圣贤巡游者 | 士兵 | `shadow-sage-rover` |
| 7 | 隐入黑暗 | 传奇事件 | `shadow-hide-in-darkness` |
| 8 | 玛尔典籍 | 普通事件 | `shadow-marl-grimoire` |
| 9 | 迅如闪电 | 普通事件 | `shadow-lightning-step` |
| 10 | 暗影脉冲 | 普通事件 | `shadow-shadow-pulse` |

图集合同：`imageW=6288`、`imageH=1124`、`cols=8`、`rows=2`；每列宽 `786`，每行高 `562`。slot 11-15 为空白；两张混入素材不占槽位。

## 卡面字段与规则原文初录

以下内容均来自完整单卡图，简体字只做项目文案统一，不改变规则语义。

| 对象 | 卡面字段 | 规则子句 |
| --- | --- | --- |
| 瑟伦达 | 召唤师，生命11，战力5，远程，符号月亮+星形 | 鲜血魔法：你的回合中，每次在本单位3个区格以内的一张友方卡牌被造成1点或更多伤害后，将本单位充能。回归暗影：你的回合中，你可以消耗2点充能，以指定本单位3个区格以内的一个友方单位为目标。将目标返回到你的手牌。 |
| 虚梦安 | 英雄，费用5，生命8，战力3，远程，月亮+星形 | 黑暗预言：每当一个友方单位离开战场时，将本单位充能。审判：在本单位移动之后，你可以消耗任意数量充能，以对一个相邻士兵或英雄造成相同点数的伤害。 |
| 塔莉娅 | 英雄，费用5，生命7，战力3，近战，星形 | 撕裂帷幕：每回合一次，在本单位移动之后，如果和一个已受伤害的敌方传送门相邻，则你可以将战场上一个友方士兵放置到该传送门相邻的区格。 |
| 萨玛拉 | 英雄，费用5，生命7，战力4，近战，月亮 | 难逃厄运：在你的攻击阶段结束时，如果本单位在本回合中消灭了敌方单位，则对敌方召唤师造成1点伤害；否则，对你的召唤师造成1点伤害。 |
| 暗影法师 | 士兵，费用2，生命4，战力3，远程，月亮 | 禁忌学识：在本单位移动之后，你可以对本单位或一个相邻传送门造成1点伤害，以抓取一张卡牌。 |
| 真实探求者 | 士兵，费用1，生命3，战力1，近战，星形 | 猛攻：本单位在被召唤的回合中，获得战力+2。佯攻：在本单位攻击之后，你可以将其推拉至2个区格。 |
| 暗影骑士 | 士兵，费用1，生命5，战力2，近战，月亮 | 暗影召唤：当召唤本单位时，指定一张没有暗影召唤技能的友方卡牌为目标。将本单位放置到目标相邻的区格，对目标造成1点伤害。死亡契约：本单位被消灭之后，对你的召唤师造成1点伤害。 |
| 圣贤巡游者 | 士兵，费用1，生命3，战力2，远程，星形 | 穿透之光：本单位在被召唤的回合中，其攻击可以穿过单位。急袭：在召唤本单位之后，你可以将其推拉1个区格。 |
| 隐入黑暗 | 传奇事件，建造阶段，费用0，无牌组符号 | 指定你的召唤师3个区格以内一个剩余生命为5点或更低的传送门或士兵为目标。将目标和其底层的所有卡牌返回到各自拥有者的手牌。 |
| 玛尔典籍 | 普通事件，召唤阶段，费用1，月亮+星形 | 从你的弃牌堆中拿取一张除了玛尔典籍和传奇事件以外的卡牌，展示并加入手牌。将“对一个友方单位造成1点伤害”结算两次。 |
| 迅如闪电 | 普通事件，攻击阶段，费用0，星形 | 持续。你的召唤师获得以下技能：迅闪步。在你的回合中，本单位3个区格以内的一个单位离开战场之后，你可以使用本单位替换该单位。 |
| 暗影脉冲 | 普通事件，攻击阶段，费用0，月亮 | 指定任意数量和一个或更多已受伤害的传送门相邻的单位为目标。对每个目标造成1点伤害。 |

## 规则子句表

| 对象 | 规则子句拆分 |
| --- | --- |
| 瑟伦达 | C1 当前回合且 3 格内友方卡牌受至少 1 伤时充能；C2 可消耗 2 充能选择 3 格内友方单位回手；C3 无目标/跳过不改变状态 |
| 虚梦安 | C1 友方单位离场时充能；C2 移动后可消耗任意充能选择相邻士兵/英雄并造成等量伤害；C3 敌方离场和跳过不触发主效果 |
| 塔莉娅 | C1 移动后检查每回合一次；C2 受伤敌方传送门相邻时选择友方士兵和邻格部署；C3 条件不满足/跳过保持原位 |
| 萨玛拉 | C1 攻击阶段结束检查本回合击杀；C2 击杀分支伤害敌方召唤师；C3 未击杀分支伤害己方召唤师；C4 两分支都在阶段推进前收口 |
| 暗影法师 | C1 移动后选择自身或相邻传送门；C2 目标受 1 伤并抓 1 张牌；C3 跳过/非法远处目标不执行 |
| 真实探求者 | C1 召唤当回合战力 +2；C2 攻击后可推拉至 2 格；C3 后续回合和跳过不保留额外战力/位移 |
| 暗影骑士 | C1 召唤后选择无同技能友方卡牌；C2 选择相邻部署位置并对目标造成 1 伤；C3 被消灭后己方召唤师受 1 伤；C4 无目标/跳过不部署 |
| 圣贤巡游者 | C1 召唤当回合远程攻击可穿单位；C2 建筑仍阻挡；C3 召唤后可推拉 1 格；C4 后续回合和跳过不放宽规则 |
| 隐入黑暗 | C1 建造阶段选择召唤师 3 格内目标；C2 目标生命 ≤5 且为传送门/士兵；C3 目标及底层卡牌回各自手牌；C4 非法目标不可选 |
| 玛尔典籍 | C1 召唤阶段从弃牌堆选择合法卡；C2 排除自身与传奇事件并回手；C3 选择友方单位承受 1 伤两次；C4 过滤、两次伤害和交互清理 |
| 迅如闪电 | C1 攻击阶段打出持续事件；C2 当前回合召唤师 3 格内单位离场时出现替换选择；C3 选择后召唤师替换离场单位；C4 跳过/超范围不替换并清理一次性交互 |
| 暗影脉冲 | C1 攻击阶段选择任意数量目标；C2 每个目标须邻接受伤传送门；C3 每个目标受 1 伤；C4 安全目标排除且空选完成后清理 |

上述对象行对应 13 个能力和 4 张事件卡；每个 C 子句均在“完整技能流程矩阵”中对应实现入口、最终状态和否定路径。

## 当前合同状态

- 素材来源与尺寸/hash：`locked`
- 卡面对象全集：`locked`（11 张暗影精灵运行时卡面 + 2 张明确的其它派系混入素材）
- 图集槽位：`locked`
- 提示板起始位置：已锁定对象名，代码坐标合同复核通过：瑟伦达 `(0,3)`、起始城门 `(1,3)`、圣贤巡游者 `(2,3)`、暗影法师 `(2,2)`。
- 规则机制：13 个能力和 4 张事件卡均已有领域/InteractionSystem L2 实现与定向测试；当前真实入口已覆盖派系选择/初始化、多目标事件、移动后能力、召唤后能力、主动能力与持续替换、阶段结束分支、攻击后推拉和死亡/穿透攻击等交互族。
- 资源压缩、manifest、服务器主源：`passed`（正式 WebP、游戏级/根级 manifest 已锁定；3 个 WebP 已上传并完成远端 HTTP/hash 回查）
- 真实入口 E2E 与审计：`passed`（同一 CI 入口最终 `11 passed`，约 `10.9m`）；当前工作区有 36 张同一真实入口截图并已逐张做 UI 审计 `PASS`。

## 对象实现与既有证据矩阵（2026-08-04）

状态含义：`L1` = 静态数据/图集/文案，`L2` = 领域权威状态测试，`L3` = 真实入口成功路径，`L4` = 复杂交互最终收口。

本表中的 L3/L4 由当前工作区同一真实入口整文件 E2E 与截图共同支撑；本轮最终取得 11 个场景的完整 Playwright 汇总，当前批次状态以顶部批次矩阵和“结论等级”区块为准。

| 对象 | 规则子句 | 当前实现入口 | L1 | L2 | L3/L4 | 当前状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 瑟伦达 | 鲜血魔法：当前回合、3 格内友方卡牌每次受伤充能 | `execute/helpers.ts:getShadowBloodMagicChargeEvents` | passed | `abilities-shadow.test.ts` 正向/范围/敌方否定 | `summonerwars-shadow.e2e` 真实受伤结算/充能截图 | `passed:L3/L4` |
| 瑟伦达 | 回归暗影：消耗 2 充能、选择 3 格内友方单位回手 | `systems.ts` 目标交互 → `executors/shadow.ts` | passed | `shadow-event-interactions.test.ts` 目标选择/回手/充能消费 | `summonerwars-shadow.e2e` 主动技能入口/目标选择/回手 | `passed:L3/L4` |
| 虚梦安 | 黑暗预言：己方单位离场充能 | `emitDestroyWithTriggers` → `onUnitDestroyed` | passed | `abilities-shadow.test.ts` 己方正向/敌方否定 | `summonerwars-shadow.e2e` 真实单位离场/充能截图 | `passed:L3/L4` |
| 虚梦安 | 审判：移动后消耗任意充能，对相邻单位造成等量伤害 | `systems.ts` 移动后交互 → `executors/shadow.ts` | passed | `shadow-event-interactions.test.ts` 选择/伤害/跳过 | `summonerwars-shadow.e2e` 移动后目标/充能选择与伤害结算 | `passed:L3/L4` |
| 塔莉娅 | 撕裂帷幕：移动后向受伤敌方传送门邻格部署友方士兵，每回合一次 | `systems.ts` 移动后交互 → `executors/shadow.ts` | passed | `shadow-event-interactions.test.ts` 传送/跳过/每回合一次 | `summonerwars-shadow.e2e` 真实传送选择/结算/跳过截图 | `passed:L3/L4` |
| 萨玛拉 | 难逃厄运：攻击阶段结束按本回合击杀与否伤害对应召唤师 | `customActionHandlers.ts` → `flowHooks.ts` 阶段结束 | passed | `abilities-shadow.test.ts` 击杀/未击杀两分支 | `summonerwars-shadow.e2e` 击杀与未击杀两条真实结算截图 | `passed:L3/L4` |
| 暗影法师 | 禁忌学识：移动后自伤或伤害相邻传送门并抓牌 | `systems.ts` 移动后交互 → `executors/shadow.ts` | passed | `shadow-event-interactions.test.ts` 自伤/跳过/抓牌 | `summonerwars-shadow.e2e` 移动后自伤/传送门选择与抓牌 | `passed:L3/L4` |
| 真实探求者 | 猛攻：召唤当回合战力 +2 | `abilityResolver.calculateEffectiveStrength` | passed | `abilities-shadow.test.ts` 召唤回合正向/后回合否定 | `summonerwars-shadow.e2e` 真实攻击事件显示 3 个骰子并进入佯攻选择 | `passed:L3/L4` |
| 真实探求者 | 佯攻：攻击后可推拉本单位至 2 格 | `systems.ts` 攻击后交互 → `executors/shadow.ts` | passed | `shadow-event-interactions.test.ts` 选择/跳过/路径限制 | `summonerwars-shadow.e2e` 真实两格推拉选择/跳过/结算截图 | `passed:L3/L4` |
| 暗影骑士 | 暗影召唤：召唤时选择无同技能友方卡牌、相邻部署并造成 1 伤害 | `systems.ts` 召唤后交互 → `executors/shadow.ts` | passed | `shadow-event-interactions.test.ts` 合法目标/部署/伤害/跳过 | `summonerwars-shadow.e2e` 召唤后目标/位置选择与伤害 | `passed:L3/L4` |
| 暗影骑士 | 死亡契约：被消灭后伤害己方召唤师 | `onDeath` → `shadow_death_pact_damage` | passed | `abilities-shadow.test.ts` 伤害断言 | `summonerwars-shadow.e2e` 真实消灭后己方召唤师受伤截图 | `passed:L3/L4` |
| 圣贤巡游者 | 穿透之光：召唤当回合远程攻击可穿过单位，建筑仍阻挡 | `helpers.canAttack/canAttackEnhanced` | passed | `abilities-shadow.test.ts` 召唤回合正向/后回合/建筑否定 | `summonerwars-shadow.e2e` 真实隔单位远程攻击结算截图 | `passed:L3/L4` |
| 圣贤巡游者 | 急袭：召唤后可推拉 1 格 | `systems.ts` 召唤后交互 → `executors/shadow.ts` | passed | `shadow-event-interactions.test.ts` 选择/跳过/距离限制 | `summonerwars-shadow.e2e` 召唤后推拉选择与结算 | `passed:L3/L4` |
| 隐入黑暗 | 3 格内、生命≤5 的传送门/士兵及底层卡牌回手 | `systems.ts` 目标交互 → `execute/eventCards.ts` | passed | `shadow-event-interactions.test.ts` 敌方受伤士兵目标/回手 | `summonerwars-shadow.e2e` 事件目标高亮/回手 | `passed:L3/L4` |
| 玛尔典籍 | 弃牌堆取回合法卡牌，并将友方单位受伤结算两次 | `systems.ts` 弃牌选择/两次伤害交互 → `execute/eventCards.ts` | passed | `shadow-event-interactions.test.ts` 合法弃牌过滤/两次伤害/清理 | `summonerwars-shadow.e2e` 弃牌回收/两次友方伤害/清理 | `passed:L3/L4` |
| 迅如闪电 | 持续替换 3 格内离场单位 | `systems.ts` 离场触发/替换交互与持续事件清理 | passed | `shadow-event-interactions.test.ts` 打出/离场/替换/跳过/距离否定 | `summonerwars-shadow.e2e` 替换提示/召唤师替换 | `passed:L3/L4` |
| 暗影脉冲 | 任意数量、与受伤传送门相邻的单位各受 1 伤 | `systems.ts` 多目标交互 → `execute/eventCards.ts` | passed | `shadow-event-interactions.test.ts` 多选/完成/安全目标排除 | `summonerwars-shadow.e2e` 多目标高亮/完成与伤害 | `passed:L3/L4` |

## 逐项结论

上表和“完整技能流程矩阵”逐项覆盖每个新增对象；没有用单个代表对象替代兄弟对象。每一行同时给出规则子句、实现入口、领域测试、真实入口证据和最终状态/清理结论。

## 完整技能流程矩阵

下表按规则子句记录候选入口、命令/执行、限制、最终权威状态、否定路径和清理；`L0-L4` 表示素材、静态、领域、真实入口和复杂交互均已有证据。

| objectId | 真相源 / 静态定义 | 候选 / 入口 | 命令 / 执行 | 消耗 / 限制 | 主效果 | 分支 / 否定 | 清理 | 证据层级 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 瑟伦达·鲜血魔法 | 召唤师卡 / `shadow_blood_magic` | 友方卡牌受伤事件 | 伤害后处理 → `getShadowBloodMagicChargeEvents` | 当前回合、3 格内、伤害至少 1 | 召唤师充能 +1 | 敌方、超范围、0 伤害不充能；同一伤害只算一次 | 充能保留至消耗 | L0-L4 | `passed` |
| 瑟伦达·回归暗影 | 召唤师卡 / `shadow_return_to_shadow` | 主动能力按钮 → 友方单位选择 | `systems.ts` → `executors/shadow.ts` | 消耗 2 充能、3 格内 | 目标单位回到所属手牌 | 无合法目标或玩家跳过时不回手、不扣充能 | 成功后扣 2 充能并清空交互 | L0-L4 | `passed` |
| 虚梦安·黑暗预言 | 英雄卡 / `shadow_dark_prophecy` | 友方单位离场事件 | `emitDestroyWithTriggers` → `onUnitDestroyed` | 仅友方单位 | 虚梦安充能 +1 | 敌方单位离场不充能 | 充能保留至审判消耗 | L0-L4 | `passed` |
| 虚梦安·审判 | 英雄卡 / `shadow_judgment` | 移动后按钮 → 邻近士兵/英雄与充能数量 | `systems.ts` → `executors/shadow.ts` | 任意数量充能，不超过现有充能 | 对相邻目标造成等量伤害 | 无合法目标或跳过不伤害、不扣充能 | 成功后按选择数量扣充能 | L0-L4 | `passed` |
| 塔莉娅·撕裂帷幕 | 英雄卡 / `shadow_tear_the_veil` | 移动后按钮 → 友方士兵与传送门邻格 | `systems.ts` → `executors/shadow.ts` | 每回合一次；敌方传送门已受伤且相邻 | 将友方士兵放到传送门邻格 | 条件不满足或跳过保持原位；同回合不重复 | 交互完成后清除等待中的交互状态 | L0-L4 | `passed` |
| 萨玛拉·难逃厄运 | 英雄卡 / `shadow_inescapable_doom` | 攻击阶段结束自动触发 | `flowHooks.ts` → `customActionHandlers.ts` | 检查本回合是否消灭敌方单位 | 击杀则敌方召唤师受伤，否则己方召唤师受伤 | 两个分支都必须结算，不能因无击杀跳过 | 阶段结束标记消费并进入下一阶段 | L0-L4 | `passed` |
| 暗影法师·禁忌学识 | 士兵卡 / `shadow_forbidden_knowledge` | 移动后按钮 → 自伤或相邻传送门 | `systems.ts` → `executors/shadow.ts` | 目标必须是自身或相邻传送门 | 目标受 1 伤并抓 1 张牌 | 跳过不伤害、不抓牌；非法远处目标不可选 | 交互完成后清除等待中的交互状态 | L0-L4 | `passed` |
| 真实探求者·猛攻 | 士兵卡 / `shadow_fierce_assault` | 召唤回合攻击时自动计算 | `abilityResolver.calculateEffectiveStrength` | `summonedTurnNumber === turnNumber` | 战力临时 +2，攻击骰增加 | 后续回合不加；不改变基础卡面战力 | 回合边界后派生值恢复 | L0-L4 | `passed` |
| 真实探求者·佯攻 | 士兵卡 / `shadow_feint` | 攻击后按钮 → 2 格内位置 | `systems.ts` → `executors/shadow.ts` | 路径合法、最多 2 格 | 推拉自身到所选位置 | 跳过保持原位；超范围/阻挡位置不可选 | 交互完成后清除等待中的交互状态 | L0-L4 | `passed` |
| 暗影骑士·暗影召唤 | 士兵卡 / `shadow_shadow_summon` | 召唤后按钮 → 无同技能友方卡牌与邻格 | `systems.ts` → `executors/shadow.ts` | 目标不能拥有同技能；目标须为友方 | 暗影骑士部署到目标邻格并对目标造成 1 伤 | 无合法目标或跳过不部署、不伤害 | 交互完成后清除等待中的交互状态 | L0-L4 | `passed` |
| 暗影骑士·死亡契约 | 士兵卡 / `shadow_death_pact` | 暗影骑士被消灭自动触发 | `onDeath` → `shadow_death_pact_damage` | 仅己方暗影骑士被消灭 | 己方召唤师受 1 伤 | 其他单位死亡不触发 | 消灭后处理完成后不残留触发标记 | L0-L4 | `passed` |
| 圣贤巡游者·穿透之光 | 士兵卡 / `shadow_piercing_light` | 攻击合法性查询 | `helpers.canAttack/canAttackEnhanced` | 仅被召唤当回合；建筑仍阻挡 | 远程攻击可穿过单位 | 后续回合或穿过建筑仍不可攻击 | 回合边界后能力不再放宽攻击 | L0-L4 | `passed` |
| 圣贤巡游者·急袭 | 士兵卡 / `shadow_sudden_assault` | 召唤后按钮 → 1 格内位置 | `systems.ts` → `executors/shadow.ts` | 最多 1 格、路径合法 | 推拉自身 1 格 | 跳过保持原位；超范围位置不可选 | 交互完成后清除等待中的交互状态 | L0-L4 | `passed` |
| 隐入黑暗 | 传奇事件卡 / `shadow-hide-in-darkness` | 建造阶段事件按钮 → 目标单位/传送门 | `systems.ts` → `execute/eventCards.ts` | 召唤师 3 格内且生命 ≤5 | 目标与底层卡牌各回所属手牌 | 满血、超范围或非法类型不可选 | 结算后事件离开手牌并清除选择 | L0-L4 | `passed` |
| 玛尔典籍 | 普通事件卡 / `shadow-marl-grimoire` | 召唤阶段事件按钮 → 弃牌选择 → 友方单位选择 | `systems.ts` → `execute/eventCards.ts` | 排除自身和传奇事件；伤害选择分两次 | 合法卡回手，并对友方单位造成 1 伤两次 | 非法弃牌不在候选；跳过伤害子步骤不误回收 | 弃牌筛选、两次伤害和交互全部清理 | L0-L4 | `passed` |
| 迅如闪电 | 普通事件卡 / `shadow-lightning-step` | 攻击阶段打出 → 友方单位离场替换提示 | `systems.ts` 持续事件与替换执行 | 召唤师 3 格内、当前回合 | 召唤师替换离场单位 | 超范围或跳过不替换；持续效果不跨错误玩家 | 离场触发完成后清除一次性替换交互，持续事件按生命周期清理 | L0-L4 | `passed` |
| 暗影脉冲 | 普通事件卡 / `shadow-shadow-pulse` | 攻击阶段事件按钮 → 任意数量目标 → 完成 | `systems.ts` → `execute/eventCards.ts` | 目标须与一个或更多受伤传送门相邻 | 每个目标受 1 伤 | 安全目标不可选；允许空选完成且不造成伤害 | 完成后清空多目标选择和事件状态 | L0-L4 | `passed` |

## D52 可视合同测试对账

`factions.test.ts` 锁定真实媒体尺寸、两个 manifest 的本地 hash/字节数、slot 0-10 的对象映射和不存在 slot 11-15 的运行时对象；`summonerwars-shadow.e2e.ts` 的开局与各交互截图锁定真实对象本体、高亮与结算后的可读性。图集配置 `SHADOW_CARDS_ATLAS` 与 `SHADOW_HERO_ATLAS` 由同一测试锁定尺寸和行列，不用旧派系的共享尺寸推断。

## 框架消费合同矩阵

| 合同 | 生产入口 | 真实消费者 | 最终权威状态 | 对账证据 |
| --- | --- | --- | --- | --- |
| 派系名与目录 | `FACTION_NAME_TO_ID`、`FACTION_CATALOG` | 派系选择、牌组构建、`resolveFactionId` | 选中派系为 `shadow`，可创建暗影精灵牌组 | `factions.test.ts`、开局 E2E |
| 卡牌归属与图集 | `shadow.ts` 的 `faction/spriteAtlas/spriteIndex` | `cardRegistry`、`resolveCardAtlasId`、`CardSprite` | 卡牌从暗影精灵图集渲染；缺失 faction 时按 `shadow-` 前缀回退 | `factions.test.ts`、D52 合同 |
| 能力注册 | `abilities-shadow.ts` | ability registry、AI profile、音频能力键、能力提示 | 13 个能力可被领域和 UI 识别 | 定向能力测试、AI/音频配置扫描 |
| 自动触发 | 伤害/离场/死亡/阶段结束 hooks | `flowHooks.ts`、`customActionHandlers.ts`、`onUnitDestroyed` | 充能、召唤师伤害和阶段分支写入 core 事件 | `abilities-shadow.test.ts`、阶段 E2E |
| 移动/召唤/攻击后选择 | `systems.ts` 创建 `sys.interaction` | UI interaction adapter、`executors/shadow.ts` | 位置、伤害、回手、抓牌和 skip 结果进入 core | `shadow-event-interactions.test.ts`、真实入口 E2E |
| 事件卡多步流程 | `systems.ts` 的 `shadow_marl_*`/`shadow_pulse_*` | `execute/eventCards.ts`、弃牌/手牌/active events | 事件结算、手牌、伤害和交互清理闭合 | 事件交互测试、事件 E2E |
| 持续替换 | `shadow-lightning-step` 打出和离场触发 | `systems.ts` 持续状态/替换 resolver | 离场单位被召唤师替换或玩家跳过 | 事件交互测试、替换 E2E |
| 攻击查询修正 | `shadow_piercing_light`、`shadow_fierce_assault` | `helpers.canAttackEnhanced`、`abilityResolver.calculateEffectiveStrength` | 攻击候选和骰子数量按回合语义变化 | 能力测试、穿透/猛攻 E2E |

## L4 共享链判等矩阵

本批只复用共享框架壳，不把“都显示一个选择框”误判为六项完全同构。凡候选过滤、payload、最终状态或清理不同的对象，均保留独立对象级 L4 证据。

| 对象组 | 共享链名称 | 触发时机 | 候选生成 | 交互入口 | payload / resolver | 最终状态 | 判等结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 虚梦安·审判 / 塔莉娅·撕裂帷幕 / 暗影法师·禁忌学识 | `after-move-shadow-choice-shell` | 都在移动后检查 | 目标类型、范围和条件各不相同 | 同为棋盘位置直选 + skip | 各自 `sourceAbilityId` 与 `executors/shadow.ts` handler | 伤害/部署/抓牌不同 | 不判等；三条独立 L3/L4 |
| 暗影骑士·暗影召唤 / 圣贤巡游者·急袭 | `after-summon-push-shell` | 都在召唤后 | 一个先选单位再选邻格，一个只选位置 | 同为召唤后位置选择 | payload 字段与距离不同 | 伤害+部署 vs 推拉不同 | 不判等；两条独立 L3/L4 |
| 瑟伦达·鲜血魔法 / 虚梦安·黑暗预言 / 暗影骑士·死亡契约 | `destroy-or-damage-trigger-pipeline` | 伤害/离场/死亡时机不同 | 无玩家候选，但来源筛选不同 | 自动事件链 | handler/sourceAbilityId 各不相同 | 充能 vs 召唤师伤害不同 | 不判等；各自有正负测试 |
| 玛尔典籍 / 暗影脉冲 | `multi-step-event-interaction-shell` | 召唤阶段两步 vs 攻击阶段多目标 | 弃牌+友方单位 vs 传送门邻接单位 | 都由 `sys.interaction` 承接 | `shadow_marl_*` 与 `shadow_pulse_*` 独立 payload | 回手+两次伤害 vs 多目标伤害 | 不判等；各自有最终清理证据 |

## 关键组合与否定路径

| 组合 / 否定路径 | 权威断言 | 证据 |
| --- | --- | --- |
| 暗影脉冲伤害 → 鲜血魔法 | 同一次伤害只给瑟伦达充能一次 | 能力定向回归、充能截图 |
| 友方离场 → 黑暗预言；敌方离场 | 只有友方单位离场增加虚梦安充能 | 能力定向回归、离场截图 |
| 难逃厄运击杀 / 未击杀 | 两条阶段结束分支分别伤害敌方/己方召唤师 | 能力定向回归、两条 E2E |
| 可选移动后能力选择 / 跳过 | 有合法候选时选择生效，跳过不改变位置/生命/资源 | 事件交互测试、撕裂帷幕和佯攻截图 |
| 玛尔典籍非法弃牌 / 合法弃牌 | 自身与传奇事件不进候选；合法卡回手后才进入两次伤害子步骤 | 事件交互测试、两步 E2E |
| 暗影脉冲安全目标 / 空选 | 不与受伤传送门相邻的目标不进候选，允许空选完成 | 事件交互测试、目标高亮与完成截图 |
| 迅如闪电范围 / 跳过 | 仅 3 格内候选可替换，跳过后离场单位不被召唤师替代 | 事件交互测试、替换 E2E |

## L0-L4 与消费者合同

- `L0` 素材源：正式运行目录 3 张 JPG、`temp` 中 11 张原始单卡和 2 张排除素材的尺寸、hash、对象归属已锁定；两张混入素材明确排除，运行时只消费正式目录资源。
- `L1` 静态消费：派系目录、30 张牌组、8×2 cards 图集、hero/tip 图、关键图预加载、中文/英文文案和 manifest 已通过定向合同测试；缺失 faction 的 `shadow-` ID 回退也已锁定。
- `L2` 领域权威状态：13 个能力和 4 张事件卡均有领域/InteractionSystem 定向测试；当前 3 个暗影精灵定向测试文件共 `29 passed`。
- `L3` 真实入口：整文件 `e2e/summonerwars/summonerwars-shadow.e2e.ts` 完成 `11 passed`，并产出 36 张截图，覆盖派系选择/初始化和全部新增交互族。
- `L4` 复杂交互：13 个能力和 4 张事件卡均有当前真实入口截图与最终结算断言；整文件汇总已通过，按对象矩阵收口为浏览器级 L3/L4 证据。

适用 D 维度：`D1` 素材来源/归属、`D2` 字段与图集槽位、`D3` 静态配置/牌组/预加载/manifest、`D4` 触发器/执行器/归约、`D5` InteractionSystem 选择与跳过、`D6` 事件持续状态与清理、`D7` 真实入口与 UI 截图。各维度的当前证据和未覆盖边界已在上表逐对象登记。

## 当前验证记录

- 暗影精灵定向测试：`3` 个测试文件、`29 passed`（StatusBanners 回归 6，事件交互 15，能力规则 8）；派系/资源合同测试另为 `23 passed`。
- 召唤师战争完整回归：`68` 个测试文件、`1437 passed`。
- `npm run typecheck`：通过。
- 真实入口 E2E：`e2e/summonerwars/summonerwars-shadow.e2e.ts` 为 `11 passed`，总耗时约 `10.9m`；当前保留 36 张同入口原图作为逐图 UI 审计证据。
- UI 审计：36 张原始整屏截图逐张 `PASS`；目标本体、合法高亮、提示文案、玩家 HUD、手牌/资源、阶段按钮和结算状态均可见，无硬失败项。
- OpenSpec：`openspec validate add-summonerwars-shadow-faction --strict --no-interactive` 已通过，输出为 `Change 'add-summonerwars-shadow-faction' is valid`。
- 资源：`cards.jpg` 为 `6288×1124`、`8×2`；`cards.webp`、`hero.webp`、`tip.webp` 远端 `HEAD` 均为 `200`，Content-Length 与本地一致，下载 hash 与本地/manifest 一致；上传批次 `serverPrimaryRelease=20260804031315120`。

## 验证证据

### L2 领域行为证据

- 定向命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/StatusBanners.render.test.tsx src/games/summonerwars/__tests__/shadow-event-interactions.test.ts src/games/summonerwars/__tests__/abilities-shadow.test.ts --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
- 结果：3 个测试文件、29 个测试通过；分别覆盖状态横幅 6、事件交互 15、能力规则 8。
- 领域结论：伤害、充能、回手、抓牌、推拉、替换、阶段结束分支、死亡触发和攻击查询均回到 core 最终状态，而不是只验证提示出现。

### L3/L4 真实入口证据

- 真实入口：Summoner Wars `/play/summonerwars/match/:matchId`，当前工作区 `main`。
- 证据：同一 `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-shadow.e2e.ts` 入口完成 `11 passed`（约 `10.9m`），生成 36 张整屏截图；截图记录了玩家选择、适用的跳过、最终棋盘/手牌/资源状态。
- 生命周期收口：选择完成或跳过后 `sys.interaction.current` 清空；持续事件保留到其生命周期结束；阶段结束分支在阶段推进前完成伤害，真实入口随后进入下一阶段，流程无残留。
- 最终状态证据：定向交互测试直接断言回手、伤害、充能、active event、位置和 `sys.interaction.current`，E2E 再核对同一真实入口的可见状态。
- 每回合一次证据：撕裂帷幕定向用例覆盖同回合限制，运行时使用 `abilityUsageCount` 记录使用次数；真实入口覆盖选择后和跳过后的结果。

### 资源与 manifest 证据

- 预检：`node scripts/assets/upload-to-server.js --check --asset-prefix i18n/zh-CN/summonerwars/hero/shadow` 命中 3 个 WebP。
- 上传：同一前缀正式上传 3 个 WebP，服务器返回 `serverPrimaryPublish=completed objects=3`。
- 回查：3 个远端 URL 的 `HEAD` 均为 200，下载后的字节数和 SHA-256 与本地及游戏级/根级 manifest 一致。

## 远端资源回查明细

回查地址前缀：`https://assets.easyboardgame.top/official/i18n/zh-CN/summonerwars/hero/shadow/compressed/`

| 文件 | HTTP HEAD | 远端字节数 | 本地字节数 | 远端 SHA-256 = 本地/manifest |
| --- | ---: | ---: | ---: | --- |
| `cards.webp` | 200 | 1392428 | 1392428 | `5c123ef9633982a1f85d9cbf98e606bf26d518ecadb88e75cf495cdf795324fc` |
| `hero.webp` | 200 | 124048 | 124048 | `c6dfde095ec62bc89689d4dc9eab6ef851536adb09a5661d0ebdbf8076151f53` |
| `tip.webp` | 200 | 137360 | 137360 | `5b648edcdc9dc451bea09e18649957193454f57e1373d2ff549eeebdd2afaab7` |

## 真实截图与逐张 UI 审计

运行现场：当前工作区 `D:\gongzuo\webgame\BoardGame`，`main`；真实入口为 Summoner Wars `/play/summonerwars/match/:matchId`；目标视口为 E2E 使用的桌面参考视口；原始截图生成时间为 2026-08-04 07:06-10:35（Asia/Shanghai）。

以下目录内共 36 张原始整屏 JPG，已逐张用玩家视角审计，结论均为 `PASS`：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-shadow.e2e\从派系选择到真实开局生成暗影精灵起始部署\`：3 张，派系入口、派系选择、真实开局布局。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-shadow.e2e\真实页面打出暗影脉冲并完成多目标选择\`：2 张，多目标选择前、结算后。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-shadow.e2e\真实页面完成移动后审判与禁忌学识选择\`：4 张，审判选择/结算、禁忌学识选择/结算。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-shadow.e2e\真实页面完成暗影召唤与急袭召唤后选择\`：4 张，暗影召唤选择/结算、急袭选择/结算。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-shadow.e2e\真实页面完成回归暗影并触发迅如闪电替换\`：3 张，回归暗影入口、迅如闪电替换提示/结算。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-shadow.e2e\真实页面完成隐入黑暗与玛尔典籍两步事件选择\`：5 张，隐入黑暗选择/结算、玛尔典籍弃牌选择/目标选择/结算。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-shadow.e2e\真实页面触发鲜血魔法与黑暗预言的离场结算\`：3 张，暗影脉冲受伤前、鲜血魔法充能、黑暗预言离场充能。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-shadow.e2e\真实页面完成撕裂帷幕传送并验证可跳过\`：3 张，传送选择、传送结算、跳过后原位。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-shadow.e2e\真实页面结算难逃厄运的击杀与未击杀分支\`：4 张，击杀分支前后、未击杀分支前后。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-shadow.e2e\真实页面验证死亡契约与穿透之光最终结算\`：2 张，死亡契约伤害、穿透之光隔单位攻击。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-shadow.e2e\真实页面验证真实探求者猛攻与佯攻的攻击后选择\`：3 张，猛攻攻击/佯攻选择、推拉结算、跳过后原位。

逐图审计结论：提示条均避开右上玩家 HUD；事件卡名称在隐入黑暗、玛尔典籍和暗影脉冲的目标提示中可读；事件目标、召唤/移动目标、死亡触发对象和穿透攻击对象本体均可见；选择高亮没有覆盖卡面；结算后的伤害、回手、替换、充能和资源变化仍可从真实棋盘读取。猛攻/佯攻首张截图已在关闭骰子结果层后重拍，攻击双方卡牌和佯攻位置按钮同时可读。逐图 UI 审计结论为 `PASS`，综合评分 `93/100`，没有硬失败项。

## 结论等级

结论等级：`本批验收通过，保留产品发布标记边界`

理由：对象全集、规则子句、L0-L2、框架消费合同、D52 图像合同、资源主源和同一真实入口整文件 E2E 均已通过；11 个场景全部 `passed`，36 张截图逐张 UI 审计 `PASS`。`under_construction` 仍只是派系目录的产品发布标记，本轮保留它，不将其解释成能力实现缺口。

## 修订与失效记录

- 本轮修订：把“目录内 15 张素材”改成正式运行目录、`temp` 原始单卡输入和排除素材三层；把服务器资源状态从未重查改为已上传并远端 hash 对账；补入全面审计自检表、规则子句表、完整技能流程矩阵、框架消费合同、L4 判等矩阵和 D52 可视合同。
- 失效结论：旧正文中把 15 张 JPG 直接归为用户指定正式目录、以及在未重做远端回查时直接写服务器主源通过的说法不再有效；当前以本文件的分层资源表和远端回查明细为准。
- 未发现其它暗影精灵专项 evidence；没有需要迁移或删除的第二份有效审计正文。

## 共享根因与残余范围

- 本轮暴露的审计留档根因：派生图集、原始单卡和排除素材曾被写成同一资源层，且 evidence 缺少审计脚本要求的正式矩阵；已通过分层资源表和自检区块修正。
- 资源链直接触发条件：单派系预检发现远端缺少 3 个 WebP；已在同一资源前缀完成上传并用 HTTP 200、长度、下载 hash 回查止住该缺口。
- 同类扩审：沿同一维度检查了所有 13 个能力、4 张事件、所有 0-10 槽位、两个 manifest 和暗影精灵所有图集消费者；未把代表链外推为兄弟对象完成。
- 非阻塞边界：`FACTION_CATALOG.shadow.statusTag` 仍为 `under_construction`，这是目录发布状态，不是规则缺口；其它派系已有的 i18n warning 也不改变本批暗影精灵结论。
- 已解除的验证阻塞：整文件命令此前两次受 5 分钟等待窗口和共享 E2E 预算影响；本轮等待同仓库其它 E2E 自然释放、回收 stale runtime 后，使用同一正式入口取得 `11 passed`，没有抢占或终止其它任务。
- 后续入口：若要把派系目录从实施中改为正式发布，需要单独确认产品发布标记；本轮不自动改变该状态。

## 残余风险与完成级别

- 领域和 InteractionSystem L2 已闭合；13 个能力和 4 张事件卡均已有浏览器级 L3/L4 证据，包含真实选择、适用的跳过路径和最终结算。
- 派系目录仍保留 `under_construction` 状态标记；本轮没有把它擅自改成正式完成标记。
- `npm run i18n:check` 的已知 `characters.tianshi` 缺失和 Munchkin raw prompt warning 属于范围外问题，本轮不纳入暗影精灵结论。
- 因上述边界，本批完成级别是“静态接入 + 全部规则 L2 + 全部能力/事件卡真实入口 L3/L4 + 整文件 `11 passed` + 36 张逐图 UI 审计通过”；暗影精灵派系目录仍保留 `under_construction` 状态标记，本轮没有把它擅自改为正式发布标记。
