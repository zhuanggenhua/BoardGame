# 山屋惊魂第三版整牌库 S0 数据录入合同与 S1/S2 补证记录

> 日期：2026-07-28
> 续跑核验：2026-07-29
> 本合同主范围：整牌库 S0 数据录入 / 合同层闭合；2026-07-29 用户已继续授权消费已锁 S0 合同进入 S1/S2 已锁单卡机制补证。此前神秘秒表、牙齿项链、胸针等对象级补证继续作为实现证据保留；本轮已补天使之羽、炸药、奇异护符、技术难点、新增配置事件代表链、7 号作祟镜中提示、镜中怪物最近目标移动 / 平手路径、镜中怪物同房神志攻击最小领域链、幸运硬币在倒塌房间回合末属性检定中的真实效果链组合、9 张预兆逐卡效果领域证据矩阵，以及作祟公共规则（全员当前持有预兆数、交易转移后总数、抽新预兆骰数、8 骰上限、普通预兆触发、最后一张预兆自动触发与翻牌确认队列）最小领域证据。幸运硬币当前已补 Board 组件空白骰选择代表链；牙齿项链当前已补 Board 组件选择 / 跳过代表链；胸针当前已补 Board 组件伤害分配代表链；奇异护符当前已补 Board 摘要 / 日志代表链；圣符 / 雕像当前已补 Board 组件探索声明和刚获得限制代表链；仍不把真实 Playwright、截图或未点名 UI 当作完成证据。
> 当前总状态：`in_progress / downstream-gated`（历史旧别名：`downstream-blocked`）。这里的 `gated / blocked` 只表示**不能宣称整牌库完成、不能进入 Board/UI/E2E/截图验收**；不表示合同层不能继续推进。官方 74 张对象已经进入同一张合同账本；本轮按用户指定本地图包重新核对，三个项目正式 atlas 与原始 TTS/Mod 图包逐字节一致。事件源图包实际包含 43 张事件正面 + 1 个空黑格 + 1 张事件背面，E43「最深的壁橱」frame 42 已由原始 atlas 直接锁定；旧 `tts-9x5-crop-manifest.json` 原始 `candidateCards` 仍只有 42 个 TTS `ContainedObjects` 候选，但本轮已在同一 manifest 补入 `gridAudit20260728` 全格扫描字段，明确 frame 42 是有效事件正面、frame 43 是空黑格、frame 44 是事件背面。因此这是旧裁图 manifest 生成口径问题，不是图包缺素材。物品源图包实际包含 22 张物品正面 + 1 个空黑格 + 1 张物品背面；当前工作区发现池已扩到 22 张官方物品，项目 atlas alias 已覆盖 22 个官方物品正面。`notebook`、`lantern`、`journal` 仍作为首剧本起始 / legacy alias 保留在运行持有物全集，但不计入官方 22 张独立物品。原审计入口基线仍按 23 事件 / 12 物品 / 9 预兆记录差异，后续工作区配置扩到 43/22/9 只能说明数量接线已变化，不能倒推最初 30 张缺口不存在。当前计数接线已到 74/74，但大量逐卡机制、UI 承接和测试证据仍未闭合，不得进入整牌库完成或 E2E/截图验收阶段。

## 0. 本轮前提锁定

| 项 | 锁定结果 |
| --- | --- |
| 问题对象 | 《山屋惊魂》第三版基础游戏整牌库：事件牌、物品牌、预兆牌 |
| 真相来源 | 官方规则书组件数量：`74 game cards`，拆分为 `9 Omens / 22 Items / 43 Events`；本地素材、atlas、manifest 和当前运行池只作为覆盖对照 |
| 目标入口/环境 | 当前工作区 `D:/gongzuo/webgame/BoardGame`，当前游戏 `src/games/betrayal` |
| 验收口径 | 74 张对象都必须进同一对象全集；每张必须有来源、运行状态、素材状态、合同状态和最小解阻动作；已锁对象可进入 S1/S2 最小领域补证；存在下游缺口时整体仍为 `in_progress / downstream-gated`，历史旧别名 `downstream-blocked`，含义是可继续补证但不能收口 |

本轮来源优先级补充：

- 官方规则书只用于锁定组件数量、基础抽牌规则和作祟公共规则，不提供 74 张逐卡牌名全集。
- 逐卡名称、牌面原文、素材槽位、atlas frame、裁图状态和 duplicate-alias 裁定，必须回到用户本地 TTS/Mod 图包、Workshop manifest、正式 atlas 或其完整单卡裁图。
- 百度、搜索结果、Wiki、社区网页或旧 E2E/截图不能作为逐卡录入主真相源；最多只能作为对照线索。若它们和本地图包冲突，合同状态必须保持 `disputed / blocked`，不得标 `locked`。
- 本合同自审口径：凡没有 TTS/Mod 图包、Workshop manifest、正式 atlas 或完整单卡裁图支撑的逐卡字段，不得补牌名、补效果或标 `locked`；当前官方 22 张物品已进运行发现池，但 duplicate-alias 和复杂效果承接缺口继续保留阻塞状态。事件已无配置数量缺口，但仍不能跳过逐张运行闭合证据。

### 0.1 本轮图包与项目导入诊断

| 对象 | 原始图包 / Workshop 证据 | 项目导入证据 | 当前裁定 |
| --- | --- | --- | --- |
| 事件正面 atlas | 原始图包 `Mods/Images/...F454F087E26E7B3812E15CAFC9C941BD5ED49D66.jpg`；尺寸 `6076x6376`；SHA-256 `09C43D68FACFAEB619162C600D95AE91C011C04C29345DCFB9E0C85902E768F5`；Workshop `ObjectStates/18` deck 372 声明 `9x5` 且 `ContainedObjects=42` | `public/assets/i18n/zh-CN/betrayal/cards/event-front-atlas.jpg` 与原图包逐字节一致；临时联系图 `temp/betrayal-asset-source-diagnostics-2026-07-28/event-9x5-last-row-36-44.jpg` 显示 frame 42 是「最深的壁橱」、frame 43 是空黑格、frame 44 是事件背面 | 项目 atlas 复制/导入没错；旧 TTS 裁图 manifest 只按 `ContainedObjects` 生成到 index 41，漏掉有效正面 frame 42 |
| 物品正面 atlas | 原始图包 `Mods/Images/...DB35BA7304F2999D84979FFC9FDC379603C70853.jpg`；尺寸 `5400x3826`；SHA-256 `5C7609535AE034D370D81EED5E9E0A52E1E23F1F5C63DF3F0438E6587D096D30`；Workshop `ObjectStates/19` deck 373 声明 `8x3` 且 `ContainedObjects=22` | `public/assets/i18n/zh-CN/betrayal/cards/item-front-atlas.jpg` 与原图包逐字节一致；临时联系图 `temp/betrayal-asset-source-diagnostics-2026-07-28/item-8x3-all-00-23.jpg` 显示 0-21 为 22 张物品正面、22 为空黑格、23 为物品背面 | 源图包不缺 22 张物品；当前运行发现池已覆盖 22 张官方物品，旧裁图 manifest 仍只覆盖旧批次物品；`map/notebook/journal/manuscript`、`flashlight/lantern` 属于 duplicate-alias / legacy-alias 裁定 |
| 预兆正面 atlas | 原始图包 `Mods/Images/httpssteamusercontentaakamaihdnetugc19168630339958248031296A0A5F30236EF5DB2B389F4C2B0A6BFE7449B.jpg`；尺寸 `3376x2550`；SHA-256 `C09E88AD93036F59022BDFFA00FFCC1F21609A599BBFD95ADD26CEAB6325573F`；Workshop `ObjectStates/20` deck 378 声明 `5x2` 且 `ContainedObjects=9` | `public/assets/i18n/zh-CN/betrayal/cards/omen-front-atlas.jpg` 与原图包逐字节一致；临时联系图 `temp/betrayal-asset-source-diagnostics-2026-07-28/omen-5x2-all-00-09.jpg` 显示 0-8 为 9 张预兆正面、9 为预兆背面 | 预兆素材数量对；仍需保持“逐卡效果合同”和“作祟公共规则合同”两层审计 |

### 0.2 2026-07-29 S0 机器一致性复核

本节只验证 S0 合同、图包和索引一致性，不作为 Board/UI、机制实现、E2E 或截图证据。复核产物：`temp/betrayal-full-deck-s0-consistency-audit-2026-07-29.json`。

| 核验面 | 结果 | 合同裁定 |
| --- | --- | --- |
| 合同对象行 | 74 行，无重复编号；事件 43、物品 22、预兆 9 | S0 对象全集行数已闭合 |
| 当前发现池 | `src/games/betrayal/scenarioConfig.ts` 当前为事件 43、物品 22、预兆 9；`initialDeckCounts` 同步为 `event:43 / item:22 / omen:9` | 运行池数量已对齐官方 74，但不能证明逐卡机制/UI/测试完成 |
| 事件 atlas 映射 | `src/games/betrayal/discoveryAtlas.ts` 有 43 个标题映射，唯一 frame 为 0-42 | E43 不是缺图；旧 manifest 漏 frame 42 是旧生成口径问题 |
| 物品 atlas 映射 | `src/games/betrayal/possessionAtlas.ts` 有 26 个 item alias，唯一 frame 覆盖 0-21；当前 22 张官方运行物品也覆盖唯一 frame 0-21 | 官方 22 张物品素材已覆盖；`lantern/notebook/journal/manuscript` 是非发现池 legacy alias，不计入官方 22 张独立牌 |
| 预兆 atlas 映射 | 9 个 omen alias，唯一 frame 为 0-8 | 9 张预兆正面素材数量正确 |
| 原始图包文件 | `Mods/Images` 共 172 个文件；事件、物品、预兆三张正式 atlas 与项目正式 atlas SHA-256 完全一致 | 图包不缺整牌库 atlas 素材，当前不是导入错误 |

本轮实际读取的规则与合同入口：

- `AGENTS.md`
- `.codex/skill/create-new-game/SKILL.md`
- `.codex/skill/create-new-game/references/preflight-gates.md`
- `.codex/skill/create-new-game/references/mechanics-data-design.md`
- `.codex/skill/data-entry-workflow/SKILL.md`
- `docs/ai-rules/data-entry.md`
- `evidence/betrayal/full-audit/full-deck-scope-audit.md`
- `docs/games/betrayal/intake-contract.md`
- `evidence/betrayal/betrayal-event-card-ingest-2026-07-03.md`
- `src/games/betrayal/scenarioConfig.ts`
- `src/games/betrayal/discoveryAtlas.ts`
- `src/games/betrayal/possessionAtlas.ts`
- `temp/betrayal-possession-contract-crops/manifest.json`
- `temp/betrayal-event-front-atlas-2026-07-03/event-08-tts-9x5-2026-07-04/tts-9x5-crop-manifest.json`

### 0.3 原审计入口基线差异

本表保留用户给出的审计入口基线：当时运行发现池是 44 张（23 事件 / 12 物品 / 9 预兆），不是官方 74 张全集。后续工作区已把配置池扩到 43/22/9，但这不应擦掉原始差异，也不能把后续接线当作逐卡机制完成证据。

| 类别 | 官方数量 | 原审计入口运行池 | 原始数量缺口 | 当前工作区配置 | S0 裁定 |
| --- | ---: | ---: | ---: | ---: | --- |
| 事件牌 | 43 | 23 | 20 | 43 | 原缺口来自旧运行池和旧 manifest 口径；当前数量已接齐，但新增事件仍需逐卡机制/UI/测试闭合 |
| 物品牌 | 22 | 12 | 10 | 22 | 原缺口来自旧运行池、旧裁图 manifest 和 alias 复用口径；当前数量已接齐；天使之羽、炸药、奇异护符已补最小领域承接，其它物品仍有 UI/组合验证或机制承接缺口 |
| 预兆牌 | 9 | 9 | 0 | 9 | 数量对不等于单卡效果和作祟公共规则完成 |
| 合计 | 74 | 44 | 30 | 74 | S0 对象/素材/atlas 数量已闭合；整牌库仍保持 `in_progress / downstream-gated`（历史旧别名：`downstream-blocked`），可继续补证但不能宣称完成 |

## 1. 数量口径与当前工作区差异

本节记录 2026-07-29 当前工作区状态，不替代上面的原审计入口基线差异。

| 类别 | 官方数量 | 当前发现池配置 | 本合同对象行 | 当前缺口结论 |
| --- | ---: | ---: | ---: | --- |
| 事件牌 | 43 | 43 | 43 | 43 个当前配置事件标题已有 atlas 映射；E43「最深的壁橱」已由原始事件 atlas frame 42 锁定，旧 manifest 原候选漏 frame 42 但已补 `gridAudit20260728`；「轮到约拿了」「片刻希望」「游魂」「技术难点」已补最小运行闭合；新增配置事件定向回归已覆盖 20 张新增/补录事件的运行消费入口，其中 9 张待选择事件已补最小指令结算，自动分支已补一批抽物品、属性写入和移动状态断言，失败伤害分支与剩余可配置分支已各补一组代表链；但多张事件仍缺剩余分支、作祟特例、UI 承接和组合测试 |
| 物品牌 | 22 | 22 | 22 | 原始物品 atlas 已锁 22 张正面；当前发现池已扩到 22 个官方物品对象；`notebook / lantern / journal` 作为 legacy alias 保留但不计入官方 22；恐怖玩偶已补 Board 组件全骰选择代表链，幸运硬币已补 Board 组件空白骰选择代表链，牙齿项链已补最小领域验证和 Board 组件选择 / 跳过代表链，胸针已补最小领域验证和 Board 组件伤害分配代表链，奇异护符已补最小领域验证和 Board 摘要 / 日志代表链，神秘秒表、天使之羽、炸药已补最小领域验证或代表链，多张新增物品仍缺完整真实入口 / UI 承接或组合验证 |
| 预兆牌 | 9 | 9 | 9 | 9 张对象和素材已建合同；作祟公共规则必须独立于单卡效果审；最后一张预兆自动作祟已补最小领域回归 |
| 合计 | 74 | 74 | 74 | 当前配置数量已对齐官方整牌库；但事件与物品仍需逐张机制/UI/测试闭合证据，不能以计数通过冒充整牌库完成 |

### 1.1 本轮合同核验记录

本合同不把 E2E、截图或 Board/UI 当作 S0 完成证据；当前只按 S0 合同层核对代码、atlas 与 manifest。当前工作区已有 43 张事件的配置 / atlas 映射相关改动，但这仍不等于所有事件完成 UI / 素材 / 机制闭合。

| 核验面 | 结果 | 现实含义 |
| --- | ---: | --- |
| 合同对象行 | 43 事件 / 22 物品 / 9 预兆 | 74 张官方牌已进入同一对象全集账本 |
| 当前发现池配置 | 43 事件 / 22 物品 / 9 预兆 | 当前配置池数量已等于官方 74 张；仍不能冒充逐卡效果、UI 承接和测试闭合 |
| 本轮定向领域回归 | `firstScenarioRuntime.test.ts -t "物品|镜子|持有物|武器|十字弓|电锯|皮夹克|枪"`：83 passed / 561 skipped | 22 张物品运行池、镜子、枪、十字弓、皮夹克、电锯代表链通过；测试内旧“23 张运行持有牌”手抄名单已改为消费当前运行持有牌全集 |
| 牙齿项链定向领域回归 | `firstScenarioRuntime.test.ts -t "牙齿项链"`：8 passed / 686 skipped | 覆盖回合结束出现属性选择、选择濒死属性后提升 1 步、没有濒死属性不拦截回合结束、非法选择非濒死属性被拒且允许跳过 |
| 牙齿项链 Board 组件回归 | `Board.foundation.test.tsx -t "牙齿项链"`：1 passed / 135 skipped | 覆盖结束回合选择面板显示濒死属性、未选属性时确认禁用、跳过无需先选属性并派发拒绝命令、选择属性后确认派发接受命令 |
| 胸针定向领域回归 | `firstScenarioRuntime.test.ts -t "胸针"`：6 passed / 648 skipped | 覆盖物理伤害可声明使用胸针改成通用伤害、未声明时仍按原伤害类型限制分配、精神伤害也可改成通用伤害 |
| 胸针 Board 组件回归 | `Board.foundation.test.tsx -t "胸针"`：1 passed / 136 skipped | 覆盖伤害分配页出现胸针开关、默认物理伤害只显示力量/速度、开启后显示力量/速度/知识/神志、确认命令带 `useBrooch: true` |
| 神秘秒表定向领域回归 | `firstScenarioRuntime.test.ts -t "神秘秒表"`：7 passed / 650 skipped；`firstScenarioRuntime.test.ts -t "牙齿项链|胸针|神秘秒表"`：21 passed / 636 skipped | 覆盖作祟前不能使用、作祟后埋葬并在当前回合结束后仍由当前玩家再行动一轮、未使用时作祟回合结束正常交接且持有者保留秒表 |
| 幸运硬币 / 倒塌房间组合定向领域回归 | `firstScenarioRuntime.test.ts -t "幸运硬币|倒塌房间"`：17 passed / 672 skipped | 覆盖幸运硬币在倒塌房间回合末速度检定中只重掷空白骰；重投为非空白时回滚坠落并按新结果取消房间伤害；重投仍为空白时先进入幸运硬币精神伤害分配，再允许确认倒塌房间坠落伤害并按房间结果推进下一玩家 |
| 幸运硬币 Board 组件回归 | `Board.foundation.test.tsx -t "幸运硬币"`：1 passed / 142 skipped | 覆盖真实页面选中幸运硬币后，最近属性检定骰盘只生成空白骰重掷目标，非空白骰不生成可重掷目标 |
| 恐怖玩偶 Board 组件回归 | `Board.foundation.test.tsx -t "恐怖玩偶"`：1 passed / 143 skipped；`firstScenarioRuntime.test.ts -t "恐怖玩偶"`：6 passed / 689 skipped | 覆盖真实页面选中恐怖玩偶后，最近属性检定骰盘为全部骰子生成重掷目标；领域链仍只证明已有属性检定消费者，不外推作祟特殊行动属性检定通用回滚快照 |
| 天使之羽定向领域回归 | `firstScenarioRuntime.test.ts -t "天使之羽"`：7 passed / 653 skipped | 覆盖使用时必须选择 0-8 整数、使用后埋葬、下一次非战斗属性检定使用所选数字作为投骰结果、仍叠加属性加值、固定骰事件不消费替代状态 |
| 炸药定向领域回归 | `firstScenarioRuntime.test.ts -t "炸药"`：8 passed / 656 skipped | 覆盖当前/相邻已发现板块目标限制、使用后从持有区移除并埋葬、记为本回合已攻击、目标板块探索者分别速度检定、失败探索者进入 4 点物理伤害分配、失败怪物走通用受伤后端 |
| 奇异护符定向领域回归 | `firstScenarioRuntime.test.ts -t "奇异护符"`：12 passed / 655 skipped | 覆盖实际承受物理伤害后神志 +1；通用伤害分配到速度不触发；速度属性直接降低不触发 |
| 技术难点定向领域 / Board 组件回归 | `firstScenarioRuntime.test.ts -t "技术难点"`：1 passed / 694 skipped；`Board.foundation.test.tsx -t "技术难点"`：1 passed / 159 skipped | 覆盖探索触发后进入新增事件解释器消费入口、将当前探索者放置到下一楼层起始点，并追加覆盖地下室 fallback：从地下室探索时放到上层起始点且承受 1 点精神伤害；Board 组件链已补地面层到地下室起始点、地下室 fallback 到上层起始点和地下室 1 点精神伤害反馈；仍缺更多楼层边界、精神伤害减免/死亡保护组合和真实入口 E2E / 截图 |
| 新增配置事件定向领域回归 | `firstScenarioRuntime.test.ts -t "新增配置事件"`：26 passed / 646 skipped；`firstScenarioRuntime.test.ts -t "怪异的镜子|设置阶段必须从七张|新增配置事件"`：28 passed / 646 skipped | 覆盖 20 张新增/补录事件进入运行消费入口；地狱蝙蝠、断手、怪异的镜子、花团锦簇、佳馔满桌、秘密升降机、神秘液体、摇曳灯光、一声呼救完成一个关键分支的最小玩家指令结算；不可能的房间、晦暗暴风夜、可怜的尤里克、禁忌知识、无线电广播、一罐器官、技术难点、着火的人已补一批自动分支状态断言，覆盖抽物品、属性写入、楼层 fallback 和入口大厅移动；不可能的房间、地狱蝙蝠、晦暗暴风夜、禁忌知识、可怜的尤里克、无线电广播、一声呼救、着火的人已补失败伤害分支代表链；断手拒绝路径、佳馔满桌神志成功与失败通用伤害、神秘液体拒绝与 0-5 骰值分支、摇曳灯光力量成功与失败物理伤害已补剩余可配置分支代表链；地狱蝙蝠、花团锦簇、秘密升降机、一声呼救已补房间目标合法性与非法目标拒绝断言；禁忌知识 4+ 知识 +1、着火的人 4+ 神志 +1 已补成功属性分支断言；怪异的镜子已补接受检定 0-4 神志 +1 分支和 5+ 进入 7 号无叛徒代表揭示态，入口大厅放置镜中怪物，setup 队列保留 3 项 manual-check；轮到约拿了、片刻希望、游魂完成更深分支代表链。该结果不等于所有分支/UI/组合闭合，也不等于 7 号作祟完整实现 |
| 7 号作祟怪异的镜子定向领域回归 | `firstScenarioRuntime.test.ts -t "怪异的镜子|Upon Reflection|镜中|事件符号|镜中提示"`：18 passed / 669 skipped | 7 号作祟已补秘密 Trait/Omen/Room 组合的领域状态和私密可见性；`deal-secret-mirror-combination` setup 队列可由领域状态自动 resolved；已补破咒特殊行动命令校验、行动预算、0-4 无反馈、5+ 组合错误只给否定反馈且不泄露秘密项、三项全中进入英雄胜利、作祟揭秘者不能破咒；已补事件符号房间自动不抽事件、不结算事件、不移动事件牌堆且不结束回合的最小领域链；已补作祟揭秘者选择当前事件牌堆事件给任意存活玩家作镜中提示，该事件不结算、不进弃牌堆、从事件牌堆放一边且每回合一次；已补镜中怪物最近目标移动 / 平手路径领域代表链。该结果仍不等于完整 7 号作祟实现，仍缺专属移动/目标选择 UI、E2E、截图和完整怪物回合组合 |
| 7 号作祟镜中怪物移动与攻击定向领域回归 | `firstScenarioRuntime.test.ts -t "镜中怪物"`：4 passed / 683 skipped | 镜中怪物移动目标按已发现房间连接图计算最短路径，只允许走向能缩短到最近可攻击探索者距离的相邻房间；距离平手时允许多个等距下一步，供作祟揭秘者裁决；已同房时不允许离开，且作祟揭秘者自身不作为移动/攻击目标。普通怪物攻击入口已读取 Mirror Being 默认攻击属性，使用神志投骰；对英雄造成伤害时写入 mental damage，待分配伤害只允许知识 / 神志，物理属性轨不扣减。该结果只覆盖领域代表链，不覆盖专属移动/目标选择 UI、E2E、截图或完整怪物回合组合 |
| 作祟公共规则定向领域回归 | `firstScenarioRuntime.test.ts -t "作祟风险\|交易转移预兆\|抽到新预兆\|作祟检定按全员\|普通预兆触发作祟\|抽到最后一张预兆"`：15 passed / 672 skipped | 覆盖作祟风险按所有玩家当前持有预兆总数派生、交易转移预兆后仍按全员总数而非当前玩家持有数派生、抽到新预兆时作祟检定骰数与风险读模型一致、作祟检定最多 8 骰、普通预兆触发作祟时记录剧本卡 / 触发预兆 / 翻牌确认队列，以及最后一张预兆自动触发作祟；该结果只证明公共规则代表链，不等于 9 张预兆逐卡效果全部闭合 |
| 本轮定向组件回归 | `Board.foundation.test.tsx -t "十字弓|枪|武器"`：8 passed / 123 skipped；`Board.foundation.test.tsx -t "角色选择阶段展示七张"`：1 passed / 131 skipped | 枪视线线、十字弓同板块/相邻目标且不画视线线、武器代表链通过；角色选择剧本候选弹窗显示 7 张候选并包含 `upon-reflection` 待接入项；该验证不是 E2E 或截图 |
| 禁忌知识 Board 组件回归 | `Board.foundation.test.tsx -t "房间文字效果会先于|禁忌知识|佳馔满桌|摇曳灯光|神秘液体"`：5 passed / 143 skipped | 覆盖禁忌知识事件符号房间翻牌后展示卡面、4 骰神志检定、总点数 2、2-3 分支“获得 1 点知识并失去 1 点神志”和“知识 +1 / 神志 -1”确认步骤；同跑礼拜堂房间文字效果防止固定房间夹具回归 |
| 可怜的尤里克 Board 组件回归 | `Board.foundation.test.tsx -t "可怜的尤里克"`：1 passed / 157 skipped；`firstScenarioRuntime.test.ts -t "可怜的尤里克"`：1 passed / 694 skipped | 覆盖可怜的尤里克事件符号房间翻牌后展示卡面、4 骰神志检定；总点数 8 时展示 4+ 分支“获得 1 点知识”和“知识 +1”，总点数 0 时展示 0-3 分支“受到 1 点精神伤害” |
| 着火的人 Board 组件回归 | `Board.foundation.test.tsx -t "着火的人|可怜的尤里克|禁忌知识|佳馔满桌|摇曳灯光|神秘液体"`：6 passed / 144 skipped | 覆盖着火的人事件符号房间翻牌后展示卡面、4 骰神志检定、总点数 2、2-3 分支“放置到入口大厅”、确认步骤和当前探险者位置 `entrance-hall`；同跑相邻事件代表链防止固定房间夹具回归 |
| 无线电广播 Board 组件回归 | `Board.foundation.test.tsx -t "无线电广播"`：1 passed / 157 skipped；`firstScenarioRuntime.test.ts -t "无线电广播"`：1 passed / 694 skipped | 覆盖无线电广播事件符号房间翻牌后展示卡面、固定 2 骰骰盘、总点数 4 时展示 3-4 分支“获得 1 点知识”和“知识 +1”，总点数 0 时展示 0-2 分支“受到一颗骰子的精神伤害”和“受到 1 颗骰子的精神伤害”；脚注展示和音频资源仍未接入 |
| 肉质苔癣 Board 组件回归 | `Board.foundation.test.tsx -t "肉质苔癣"`：2 passed / 156 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`firstScenarioRuntime.test.ts -t "肉质苔癣"`：3 passed / 692 skipped | 覆盖待选事件面板、拒绝“不吸入芳香”后无事发生、接受后固定 2 骰骰盘、成功分支任选知识并显示“知识 +1”、失败分支显示“一颗骰子的精神伤害”；减免 / 死亡保护、属性上限、更多属性选择、兔脚 UI / 更多重掷组合和真实入口 E2E / 截图仍未闭合 |
| 轮到约拿了 Board 组件回归 | `Board.foundation.test.tsx -t "轮到约拿了"`：1 passed / 157 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`firstScenarioRuntime.test.ts -t "轮到约拿了"`：2 passed / 693 skipped | 覆盖待选事件面板只展示非武器物品「地图」、排除武器「砍刀」、未选确认禁用、选择地图后派发 `cardId=map`，以及拒绝“不弃置物品”后显示“受到 1 颗骰子的精神伤害”；无非武器物品、已用 / 不可交易限制、弃置终点可见性、精神伤害减免 / 死亡保护和真实入口 E2E / 截图仍未闭合 |
| 一罐器官 Board 组件回归 | `Board.foundation.test.tsx -t "一罐器官"`：1 passed / 157 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`firstScenarioRuntime.test.ts -t "一罐器官"`：1 passed / 694 skipped | 覆盖一罐器官事件符号房间翻牌后展示卡面、4 骰神志检定、总点数 8 时展示“抽取一张物品卡”并把魔法相机加入持有区；总点数 0 时展示“失去 1 点力量”和“力量 -1”确认步骤；不覆盖物品牌堆耗尽、属性下限、直接属性降低致死、死亡保护或真实入口 E2E / 截图 |
| 本轮静态检查 | `npx eslint` 分段覆盖山屋数据、运行、UI、测试与审计脚本改动；`Board.tsx` 使用 `NODE_OPTIONS=--max-old-space-size=8192` 后通过；`git diff --check` 通过 | ESLint 当前结果为 0 errors；`game.ts` 仅保留既有 5 个 unused warning；`git diff --check` 只有 LF/CRLF 工作区提示 |
| 事件 atlas 标题映射 | 43 | 已覆盖当前 43 张配置事件标题；E43「最深的壁橱」frame 42 已回原始 atlas 复核为真实正面 |
| 事件 TTS manifest | `containedCardIds=42`，`candidateCards=42`，候选 index 只到 41；本轮已补 `gridAudit20260728.slots=45` | 原始 TTS 对象列表仍只有 42 个候选；全格扫描已补正该 manifest 的覆盖口径，证明 frame 42 是有效事件正面、frame 43 是空格、frame 44 是事件背面 |
| 事件缺口 TTS 图包直读 | 20 | 原 unknown-slot 事件已从完整单卡裁图读出中文名和主要效果子句；20 张均已进入配置池并补卡面映射 | 配置录入和卡面映射不等于运行闭合；新增事件仍需补解释器消费、UI 承接和最小验证 |
| 物品/预兆裁图 manifest | 21 行，其中物品 12 行、预兆 9 行 | 物品裁图行数不能直接等同官方 22 张物品；其中 4 个物品别名共用同一地图 frame/hash |
| 物品 atlas alias | 26 个 item alias、9 个 omen alias；当前 22 张官方运行物品覆盖唯一 item frame 0-21 | `lantern` 复用手电筒 frame；`notebook/journal/manuscript` 复用地图 frame；这些只作为 legacy alias 保留，不计入官方 22 张独立牌 |

## 2. 真相源表

| 真相源 | 现实含义 | 覆盖字段 | 当前状态 |
| --- | --- | --- | --- |
| `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:343` | 官方组件总量 `74 game cards: Omens, Items, Events` | 整牌库总数 | `locked-count` |
| `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:382` | 官方类别数量 `X9 X22 X43` | 9 预兆 / 22 物品 / 43 事件 | `locked-count` |
| `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:647,749,755` | 预兆作祟检定公共规则 | 预兆抽取、作祟检定、最后一张预兆自动作祟 | `contract-ready / min-domain-verified`：最后一张预兆自动作祟已补领域回归；作祟 UI 承接和 9 张逐卡预兆效果仍需继续审 |
| `evidence/betrayal/betrayal-event-card-ingest-2026-07-03.md` | 原 23 张事件牌中文卡图录入合同 | 事件名、原文、子句、当前运行接入 | 原文层可支撑旧 23 张；E43 的 9x5 frame 42 已由本轮原始 atlas 复核锁定；新增 20 张不由该旧合同闭合，需继续按本合同和运行测试补证 |
| `src/games/betrayal/discoveryAtlas.ts` | 事件牌 9x5 atlas 和标题到 frame 映射 | 当前事件素材 frame | 43 个当前配置事件标题已有映射；E43 frame 42 已由原始 atlas 锁定 |
| `temp/betrayal-event-front-atlas-2026-07-03/event-08-tts-9x5-2026-07-04/tts-9x5-crop-manifest.json` | 旧 TTS 事件 deck 9x5 裁图 manifest + 本轮全格扫描补注 | 42 个原始候选 CardID / frame；`gridAudit20260728` 覆盖 45 个 atlas 格 | `supplemented-partial`：20 张原非运行池事件已从图包读出并进入配置；原 `candidateCards` 只按 `ContainedObjects` 生成到 index 41，但 `gridAudit20260728` 已明确 frame 42 是「最深的壁橱」、frame 43 是空格、frame 44 是背面 |
| `temp/betrayal-asset-source-diagnostics-2026-07-28/source-atlas-diagnostics.json` | 本轮从原始 TTS/Mod 图包和项目正式 atlas 生成的只读诊断 | hash、尺寸、frame 42、物品 22 正面、空格/牌背位置 | `diagnostic-locked`：证明事件/物品/预兆项目 atlas 与原始图包逐字节一致；证明图包不缺事件 frame 42 或物品 22 正面 |
| `temp/betrayal-event-front-atlas-2026-07-03/event-08-tts-9x5-2026-07-04/review/missing-events-title-text-part1.jpg` / `part2.jpg` / `long-missing-events-bottom-check.jpg` | 从 TTS 完整单卡裁图派生的临时联系图 | 20 张原未知事件标题、规则子句和长卡底部复核 | `intake-helper`：只用于本合同录入核对，仍属于 `temp/**` 中间产物，不进入正式资源 |
| `evidence/betrayal/betrayal-discovery-effect-audit-2026-07-02.md` | 旧发现池效果审计 | 卡面原文、原子子句、已接运行态能力证据、代表性玩法历史证据 | 2026-07-29 已补接续裁定：只作为历史发现池和代表链证据；不覆盖当前 43/22/9 整牌库，也不阻止 S0 合同层继续补证 |
| `evidence/betrayal/betrayal-event-e2e-coverage-2026-07-04.md` | 早期 23 张事件页面承接 E2E 覆盖矩阵 | 23 张 locked 事件的页面选择代表链 | 2026-07-29 已补接续裁定：不能外推为当前 43 张事件或整牌库完成 |
| `evidence/betrayal/final-closeout-readable/README.md` | 作祟 3 / 12 / 33 高清可读产物图索引 | 三个作祟代表链的历史可读产物 | 2026-07-29 已补接续裁定：不能作为当前整牌库 S0、UI/E2E 或截图验收证据 |
| `docs/games/betrayal/workflows/betrayal-playability-audit-2026-07-14.md` | 旧可玩性与端到端审计入口 | 旧首剧本与事件/发现牌页面链路现场 | 2026-07-29 已补接续裁定：旧 23 事件 / 12 物品 / 23 运行持有牌口径不能覆盖当前整牌库主合同 |
| `evidence/betrayal/betrayal-half-implemented-audit-2026-07-18.md` | 半实现专项审计 | 作祟 1/3/12/33 代表链和早期 23 事件运行口径 | 2026-07-29 已补接续裁定：不能作为当前 43/22/9 整牌库完成证据 |
| `docs/games/betrayal/workflows/betrayal-dust-rule-gap-plan-2026-07-26.md` | 作祟 3「灰尘」专项补漏计划 | 灰尘剧本与当时牌池的交叉补证现场 | 2026-07-29 已补接续裁定：旧 23 事件 / 12 物品 / 23 持有牌口径不能覆盖当前整牌库主合同 |
| `docs/games/betrayal/haunts/03-the-dust.md` | 作祟 3「灰尘」交互子账本 | 灰尘专项规则、死亡保护、兔脚、搜尸和持有牌交叉代表链 | 2026-07-29 已补接续裁定：只覆盖灰尘专项，不证明整牌库或其它作祟完成 |
| `src/games/betrayal/possessionAtlas.ts` | 物品/预兆正面 atlas 映射 | 物品 frame、预兆 frame、alias | `partial`：存在复用 frame 与缺 crop |
| `temp/betrayal-possession-contract-crops/manifest.json` | 物品/预兆单卡裁图 manifest | 单卡裁图、frame、hash | `partial`：manifest 原始 21 行缺 `strange-amulet` 和 `lantern` crop；本轮已从正式 item atlas 补 `strange-amulet` 临时完整裁图；`map/notebook/journal/manuscript` 共用 frame/hash |
| `temp/betrayal-possession-contract-crops/item-strange-amulet-full.jpg` | 从正式物品 atlas frame 10 切出的完整单卡核对图 | 奇异护符标题、卡图、规则原文和 frame | `crop-ready`：sha256 `9e25d6048a0b59263723b09da1a467bafee3d69e3c1e08d29d25ad9680693728`；只作为 `temp/**` 录入核对图 |
| `temp/betrayal-possession-contract-crops/item-alias-review.jpg` | 从当前物品裁图生成的 alias 复核联系图 | 手电筒、地图、笔记本、日记、手稿复用关系 | `intake-helper`：证明 `map/notebook/journal/manuscript` 图面同为地图卡；不进入正式资源 |

## 3. 事件牌对象全集：43 / 43

说明：事件牌官方数量锁定为 43。当前合同用 `EVENT_FRONT_ATLAS` 的 frame `0-42` 作为 S0 对象槽位；当前 43 张配置事件标题已有代码 atlas 映射。E43「最深的壁橱」虽然不在旧 `tts-9x5-crop-manifest.json` 原始 `candidateCards` 中，但本轮已回原始事件 atlas 直接裁出 frame 42，确认它是真实事件正面，并已在该 manifest 追加 `gridAudit20260728` 全格扫描字段。原候选漏掉 frame 42 是裁图 manifest 生成口径问题。20 张已从 TTS 图包完整单卡裁图读出中文名与主要效果子句，并已进入 `scenarioConfig.ts` 事件配置和卡面映射；其中「轮到约拿了」「片刻希望」「游魂」「技术难点」已有最小运行/UI 或领域测试证据，新增配置事件定向回归另覆盖 20 张新增/补录事件的运行消费入口、9 张待选择事件的一个关键分支指令结算、一批自动分支的抽物品、属性写入和移动状态断言，以及失败伤害分支与剩余可配置分支代表链。配置池扩容和局部分支/状态补证仍不得冒充官方 43 张事件完整运行闭合。

| # | 中文名 / 槽位 | 英文名或原文名 | 类别 | 官方来源或真相源位置 | 规则原文或效果子句录入状态 | 素材 / atlas / 裁图 / frame 状态 | 当前配置/运行状态 | 能力 / 效果 / UI 后续 | 合同状态 | 阻塞原因与下一步最小解阻动作 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E01 | 标本剥制 | 未锁定 | 事件 | 事件录入合同 index 0；`discoveryAtlas.ts` frame 0；TTS CardID 37200 | `locked` | frame 0 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E02 | 不可能的房间 | 未锁英文名 | 事件 | TTS manifest frame 1 / CardID 37201；`card-01-r0c1-full.jpg` | TTS 图包已读：神志检定；4+ 抽取一张物品卡；0-3 受到一颗骰子的精神伤害 | frame 1 完整裁图存在；sha256 `422d4e1636e24819`；atlas 标题映射已补 | `in-config / min-branch-verified / Board component representative` | 已录入配置；新增配置事件回归覆盖 4+ 抽物品状态和 0-3 骰子精神伤害状态；Board 组件代表链已证明卡面、神志检定骰盘、成功抽物品进入持有区和失败精神伤害反馈；仍缺抽物品牌堆耗尽、精神伤害减免/死亡保护和真实入口 E2E / 截图 | `locked / partial / Board component representative` | S0 字段已锁且已入 `scenarioConfig.ts`；S1/S2 下一步是补抽物品牌堆耗尽、精神伤害减免 / 死亡保护、更多伤害消费者组合和真实入口 E2E / 截图 |
| E03 | 磁带播放器 | 未锁定 | 事件 | 事件录入合同 index 1；`discoveryAtlas.ts` frame 2；TTS CardID 37202 | `locked` | frame 2 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E04 | 大宅饿了 | 未锁定 | 事件 | 事件录入合同 index 2；`discoveryAtlas.ts` frame 3；TTS CardID 37203 | `locked` | frame 3 已映射 | `in-runtime` | 作祟 12 成功链只按现有代表链消费；完整剧本另审 | `locked` | 无 |
| E05 | 地狱蝙蝠 | 未锁英文名 | 事件 | TTS manifest frame 4 / CardID 37204；`card-04-r0c4-full.jpg` | TTS 图包已读：速度检定；4+ 放置到相邻板块；0-3 受到 1 点物理伤害 | frame 4 完整裁图存在；sha256 `a386cc7b99f5c9ce`；atlas 标题映射已补 | `in-config / min-branch-verified / Board component representative` | 已录入配置；已补 4+ 分支的相邻板块放置 pending 与玩家指令结算，并补 0-3 物理伤害状态断言；已补非相邻板块和未发现板块非法目标拒绝；Board 组件代表链已补卡面、速度检定、相邻已发现房间候选高亮、非相邻 / 跨楼层候选不显示、点击门厅后当前位置更新和“放置到门厅”确认步骤，以及 0-3 物理伤害确认步骤；仍缺非法目标提示 UI、物理伤害减免/死亡保护、作祟地图限制、更多门位/连接边界组合和真实入口 E2E / 截图 | `locked / partial / Board component representative` | S0 字段已锁；S1/S2 下一步是补非法目标提示 UI、物理伤害组合、作祟地图限制、更多门位/连接边界和真实入口 E2E / 截图 |
| E06 | 电话铃声 | 未锁定 | 事件 | 事件录入合同 index 3；`discoveryAtlas.ts` frame 5；TTS CardID 37205 | `locked` | frame 5 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E07 | 吊死鬼 | 未锁定 | 事件 | 事件录入合同 index 4；`discoveryAtlas.ts` frame 6；TTS CardID 37206 | `locked` | frame 6 已映射 | `in-runtime / min-branch-verified / Board component representative` | 已有四项属性连续检定、失败属性直接降低、全通过待选奖励属性和头骨死亡保护领域代表链；Board 组件代表链已补待选事件面板、四项属性检定说明、全通过后奖励属性选择和“知识 +1”反馈；仍缺失败属性降低 UI、更多奖励属性、属性上下限、死亡保护/重掷组合和真实入口 E2E / 截图 | `locked / partial / Board component representative` | S0 字段已锁；S1/S2 下一步是补失败属性降低 UI、更多奖励属性、属性上下限、死亡保护/重掷组合和真实入口 E2E / 截图 |
| E08 | 断手 | 未锁英文名 | 事件 | TTS manifest frame 7 / CardID 37207；`card-07-r0c7-full.jpg` | TTS 图包已读：可以选择承受 2 点物理伤害；若如此做，抽取一张物品卡 | frame 7 完整裁图存在；sha256 `fc8f5d6adf7bfc46`；atlas 标题映射已补 | `in-config / min-branch-verified / Board component representative` | 已录入配置；已补接受分支：承受 2 点物理伤害并抽取 1 张物品；已补拒绝分支不抽物品、不受伤且无事发生；Board 组件代表链已证明确认/拒绝按钮、拒绝无事发生、接受后的物理伤害 + 抽物品反馈和持有区写入；仍缺伤害不足/死亡边界、伤害改写/减免/死亡保护组合、物品牌堆耗尽和真实入口 E2E / 截图 | `locked / partial / Board component representative` | S0 字段已锁；S1/S2 下一步是补伤害不足/死亡边界、胸针/奇异护符/盔甲/头骨等消费者、物品牌堆耗尽和真实入口 E2E / 截图 |
| E09 | 嘎吱的木门 | 未锁定 | 事件 | 事件录入合同 index 5；`discoveryAtlas.ts` frame 8；TTS CardID 37208 | `locked` | frame 8 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E10 | 怪异的镜子 | Upon Reflection | 事件 | TTS manifest frame 9 / CardID 37209；`card-09-r1c0-full.jpg`；7 号作祟账本 `docs/games/betrayal/haunts/07-upon-reflection.md` | TTS 图包已读：作祟尚未开始时可作祟检定；5+ 翻开作祟 7 求生手册且无奸徒；0-4 获得 1 点神志；若不检定则抽取一张物品卡；7 号账本已锁公开/私密规则：作祟揭秘者秘密记录 Trait/Omen/Room，英雄可执行破咒，5+ 且三项全中英雄胜利，5+ 组合错误只给否定反馈，0-4 无反馈，事件符号房间不抽事件且不结束回合；Mirror Being 向最近探索者移动，距离平手由作祟揭秘者裁决，已同房时使用神志攻击并造成精神伤害 | frame 9 完整裁图存在；sha256 `9a740101c2e05328`；atlas 标题映射已补 | `in-config / min-branch-verified / haunt-7-min-domain-verified / mirror-hint-min-domain-verified / mirror-being-move-min-domain-verified / mirror-being-attack-min-domain-verified / partial` | 已录入配置；已补拒绝检定后抽取物品分支；已补接受检定 0-4 分支：获得 1 点神志并留在作祟前；已补接受检定 5+ 分支：进入 7 号无叛徒代表揭示态、当前玩家切到揭秘者左侧玩家、入口大厅放置镜中怪物；已补秘密组合领域状态、私密 playerView、`deal-secret-mirror-combination` 自动 resolved、破咒命令校验/执行/reducer/行动预算、破咒成功英雄终局；已补 7 号作祟中探索事件符号房间自动跳过事件牌且不结束回合；已补镜中提示最小领域链：作祟揭秘者每回合一次选择当前事件牌堆事件给存活玩家作提示，事件不结算、不进弃牌堆并从事件牌堆放一边；已补镜中怪物最近目标移动 / 平手路径领域代表链：只允许朝最近可攻击探索者缩短距离、平手允许多个等距路径、已同房不允许离开且不把作祟揭秘者作为目标；已补镜中怪物已同房时普通攻击按神志投骰并进入精神伤害分配 | `locked / partial / min-domain-verified` | S1/S2 最小领域补证已过；不得标完整实现。后续最小解阻为补专属移动/目标选择 UI、E2E、截图和完整怪物回合组合 |
| E11 | 花团锦簇 | 未锁英文名 | 事件 | TTS manifest frame 10 / CardID 37210；`card-10-r1c1-full.jpg` | TTS 图包已读：受到 1 点通用伤害；将探险者放置在任意地面或地下室板块；若温室已发现则必须放置在那里 | frame 10 完整裁图存在；sha256 `0029ac8b5fb7937f`；atlas 标题映射已补 | `in-config / min-branch-verified / Board component representative` | 已录入配置；已补通用伤害分配与放置到门厅的最小指令结算；已补上层非法、地下室合法、温室已发现时强制放置温室且拒绝其它地面板块；Board 组件代表链已补待选事件卡面、地面 / 地下室候选、上层候选不显示、温室强制覆盖、目标点击后通用伤害分配和移动反馈；仍缺非法原因 UI、通用伤害死亡保护、更多温室 / 楼层 / 死亡保护组合和真实入口 E2E / 截图 | `locked / partial / Board component representative` | S0 字段已锁；S1/S2 下一步是补非法原因 UI、通用伤害死亡保护、更多温室 / 楼层 / 死亡保护组合和真实入口 E2E / 截图 |
| E12 | 晦暗暴风夜 | 未锁英文名 | 事件 | TTS manifest frame 11 / CardID 37211；`card-11-r1c2-full.jpg` | TTS 图包已读：知识检定；4+ 获得 1 点神志；0-3 受到 1 点精神伤害 | frame 11 完整裁图存在；sha256 `e4638697e80534f9`；atlas 标题映射已补 | `in-config / min-branch-verified / Board component representative` | 已录入配置；新增配置事件回归覆盖 4+ 神志 +1 和 0-3 精神伤害状态断言；Board 组件代表链已补知识检定骰盘、总点数 8 成功神志 +1 和总点数 0 失败精神伤害反馈 | `locked / partial / Board component representative` | S0 字段已锁；S1/S2 下一步是补精神伤害减免 / 死亡保护、神志上限、重掷组合、真实入口 E2E 和截图 |
| E13 | 技术难点 | 未锁英文名 | 事件 | TTS manifest frame 12 / CardID 37212；`card-12-r1c3-full.jpg` | TTS 图包已读：将探险者放在下一楼层起始点；若已在地下室，则放到上层起始点并受到 1 点精神伤害 | frame 12 完整裁图存在；sha256 `1b0fe2cf63b7a4c5`；atlas 标题映射已补 | `in-config / min-branch-verified / Board component representative` | 已补新增事件解释器消费入口、下一楼层起始点移动，并补地下室 fallback 精神伤害组合：地下室探索后放到上层起始点且精神伤害 1；Board 组件代表链已证明地面层翻出后放到地下室起始点、地下室翻出后放到上层起始点并显示 1 点精神伤害；仍缺更多楼层边界、精神伤害减免/死亡保护组合和真实入口 E2E / 截图 | `locked / min-verified / Board component representative` | S1/S2 最小领域和 Board 代表链补证已过；后续最小解阻为补更多楼层边界、精神伤害减免/死亡保护组合和真实入口 E2E / 截图 |
| E14 | 佳馔满桌 | 未锁英文名 | 事件 | TTS manifest frame 13 / CardID 37213；`card-13-r1c4-full.jpg` | TTS 图包已读：知识或神志检定；5+ 获得 1 点速度；0-4 受到 1 点通用伤害 | frame 13 完整裁图存在；sha256 `0382dac399565e69`；atlas 标题映射已补 | `in-config / min-branch-verified / Board component representative` | 已录入配置；已补选择知识/神志成功后速度 +1 的最小指令结算，并补 0-4 失败通用伤害代表链；Board 组件代表链已承接卡面、知识/神志选择、成功分支“速度 +1”、失败分支通用伤害分配和“通用伤害 1（力量）”最终反馈；仍缺速度上限、通用伤害死亡保护、祝福与重掷/替代组合、真实入口 E2E / 截图 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补速度上限、通用伤害死亡保护、祝福与重掷/替代组合、真实入口 E2E / 截图 |
| E15 | 禁忌知识 | 未锁英文名 | 事件 | TTS manifest frame 14 / CardID 37214；`card-14-r1c5-full.jpg` | TTS 图包已读：神志检定；4+ 获得 1 点知识；2-3 获得 1 点知识并失去 1 点神志；0-1 受到两颗骰子的精神伤害 | frame 14 完整裁图存在；sha256 `2cef83257470174b`；atlas 标题映射已补 | `in-config / min-branch-verified / Board component representative` | 已录入配置；新增配置事件回归覆盖 4+ 知识 +1、2-3 知识 +1 / 神志 -1、0-1 骰子精神伤害状态断言；Board 组件代表链已承接事件房间翻牌后的卡面、神志检定骰盘、总点数 2、2-3 分支详情和“知识 +1 / 神志 -1”确认步骤；总点数 0 时已承接 0-1 分支“受到两颗骰子的精神伤害”和“受到 2 颗骰子的精神伤害”确认步骤；仍缺属性上下限、直接属性降低致死、死亡保护、精神伤害减免、重掷/替代组合和真实入口 E2E / 截图 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补属性上下限、直接属性降低致死、死亡保护、精神伤害减免、重掷/替代组合和真实入口 E2E / 截图 |
| E16 | 可怜的尤里克 | 未锁英文名 | 事件 | TTS manifest frame 15 / CardID 37215；`card-15-r1c6-full.jpg` | TTS 图包已读：神志检定；4+ 获得 1 点知识；0-3 受到 1 点精神伤害 | frame 15 完整裁图存在；sha256 `e7c5b5b1f3c2344e`；atlas 标题映射已补 | `in-config / min-branch-verified / Board component representative` | 已录入配置；新增配置事件回归覆盖 4+ 知识 +1 和 0-3 精神伤害状态断言；Board 组件代表链已承接事件房间翻牌后的卡面、神志检定骰盘、总点数 8 的知识提升分支和总点数 0 的精神伤害分支；仍缺知识上限、精神伤害减免、死亡保护、重掷/替代组合和真实入口 E2E / 截图 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补知识上限、精神伤害减免、死亡保护、重掷/替代组合和真实入口 E2E / 截图 |
| E17 | 轮到约拿了 | 未锁英文名 | 事件 | TTS manifest frame 16 / CardID 37216；`card-16-r1c7-full.jpg` | TTS 图包已读：可以弃置任意一件非武器物品；若如此做获得 1 点神志；否则受到一颗骰子的精神伤害 | frame 16 完整裁图存在；sha256 `9282af69a4c0d494`；atlas 标题映射已补 | `in-config / min-verified / Board component representative` | 已接入非武器物品筛选、弃置选择、神志提升和精神伤害；Board 组件代表链已证明待选面板只展示可弃置非武器物品「地图」、排除武器「砍刀」、未选确认禁用、选中地图后的指令派发，以及拒绝后的“受到 1 颗骰子的精神伤害”确认步骤 | `locked / partial / Board component representative` | 定向领域测试与 Board 物品选择 / 拒绝精神伤害测试已覆盖最小运行闭环；仍缺无非武器物品 UI、已用 / 不可交易限制、弃置终点可见性、精神伤害减免、死亡保护和真实入口 E2E / 截图 |
| E18 | 秘密升降机 | 未锁英文名 | 事件 | TTS manifest frame 17 / CardID 37217；`card-17-r1c8-full.jpg` | TTS 图包已读：可以将自己放置在某个不同区域的任意一张板块上 | frame 17 完整裁图存在；sha256 `20a00e0139c93232`；atlas 标题映射已补 | `in-config / min-branch-verified / Board component representative` | 已录入配置；已补选择上层起始点并移动的最小指令结算；已补同区域和未发现板块非法目标拒绝；Board 组件代表链已补待选面板、当前区域 / 同区域候选不显示、不同区域已发现起始点候选显示和点击地下室起始点提交目标房间；仍缺非法原因 UI、作祟地图限制、更多区域 / 楼层 / 未发现组合、移动后续反馈和真实入口 E2E / 截图 | `locked / Board component representative / partial-ui` | S0 字段已锁；S1/S2 下一步是补非法原因 UI、作祟地图限制、更多区域 / 楼层 / 未发现组合、移动后续反馈和真实入口 E2E / 截图 |
| E19 | 脑状食品 | 未锁定 | 事件 | 事件录入合同 index 6；`discoveryAtlas.ts` frame 18；TTS CardID 37218 | `locked` | frame 18 已映射 | `in-runtime / min-branch-verified / Board component representative` | 已有力量检定 5+ 选择力量或速度 +1、1-4 速度 +1 并神志 -1、0 通用伤害 2、缺选择拒绝、确认步骤阻止提前结束、头骨死亡保护和兔脚重掷回滚死亡 / 狂热病患化的领域代表链；Board 组件代表链已承接 5+ 速度奖励、0 分支通用伤害 2 分配和同属性重复分配预览；仍缺成功力量 UI、属性上下限、直接属性降低致死 / 死亡保护组合、通用伤害死亡保护 / 减免 / 胸针组合、兔脚 UI / 更多重掷组合和真实入口 E2E / 截图 | `locked / Board component representative / partial-ui` | S0 字段已锁；S1/S2 下一步是补成功力量 UI、属性上下限、直接属性降低致死 / 死亡保护、通用伤害消费者组合、兔脚 UI / 更多重掷组合和真实入口 E2E / 截图 |
| E20 | 片刻希望 | 未锁英文名 | 事件 | TTS manifest frame 19 / CardID 37219；`card-19-r2c1-full.jpg` | TTS 图包已读：在你的板块上放置祝福标志物；同位置英雄进行所有属性检定时多投一颗骰子 | frame 19 完整裁图存在；sha256 `d1cb75f8dd637d77`；atlas 标题映射已补 | `in-config / min-verified` | 已接入祝福标志物、位置光环和属性检定加骰；仍需后续整事件池回归扩审 | `locked / min-verified` | 定向领域测试与 Board 房间祝福标记测试已覆盖最小运行闭环；后续不再按 `not-in-runtime` 接续 |
| E21 | 肉质苔癣 | 未锁定 | 事件 | 事件录入合同 index 7；`discoveryAtlas.ts` frame 20；TTS CardID 37220 | `locked` | frame 20 已映射 | `in-runtime / min-branch-verified / Board component representative` | 已有不吸入无事发生、吸入后固定 2 骰 4+ 待选任意属性、选择知识 +1、0-3 精神伤害、兔脚重掷成功分支保留待选属性不提前结算的领域代表链；Board 组件代表链已承接待选面板、拒绝跳过、吸入投骰、成功后选择知识和“知识 +1”确认步骤，以及失败分支“一颗骰子的精神伤害”确认步骤；仍缺精神伤害减免 / 死亡保护、属性上限、更多属性选择、兔脚 UI / 更多重掷组合和真实入口 E2E / 截图 | `locked / Board component representative / partial-ui` | S0 字段已锁；S1/S2 下一步是补精神伤害减免 / 死亡保护、属性上限、更多属性选择、兔脚 UI / 更多重掷组合和真实入口 E2E / 截图 |
| E22 | 上古旧宅 | 未锁定 | 事件 | 事件录入合同 TTS 21；`discoveryAtlas.ts` frame 21；TTS CardID 37221 | `locked` | frame 21 已映射 | `in-runtime / min-branch-verified / Board component representative` | 已有缺目标拒绝、速度成功放置任意板块、力量地面通用伤害、速度地下室精神伤害和非法楼层目标拒绝领域代表链；Board 组件代表链已承接待选面板卡面、力量属性选择、地面目标房间、目标点击后的通用伤害分配，以及“力量检定 / 放置到门厅 / 通用伤害 1（力量）”反馈；仍缺上层成功 UI、地下室精神伤害 UI、非法目标提示 UI、通用/精神伤害减免与死亡保护、更多楼层 / 作祟地图组合和真实入口 E2E / 截图 | `locked / Board component representative / partial-ui` | S0 字段已锁；S1/S2 下一步是补上层成功 UI、地下室精神伤害 UI、非法目标提示 UI、伤害减免 / 死亡保护、更多楼层 / 作祟地图组合和真实入口 E2E / 截图 |
| E23 | 神秘液体 | 未锁英文名 | 事件 | TTS manifest frame 22 / CardID 37222；`card-22-r2c4-full.jpg` | TTS 图包已读：可选择饮下并投 3 颗骰子；6 每项属性 +1；5 力量与速度 +1；4 知识与神志 +1；3 知识 +1 且力量 -1；2 知识与神志 -1；1 力量与速度 -1；0 每项属性 -1 | frame 22 完整裁图存在；sha256 `52027b242fa94594`；atlas 标题映射已补 | `in-config / min-branch-verified / Board component representative` | 已录入配置；已补拒绝路径不改变四属性；接受喝下后 0-6 全骰值属性变化已补领域断言；Board 组件代表链已承接卡面、拒绝按钮、喝下按钮、固定 3 骰骰盘和分支结果；仍缺属性上下限、死亡保护、固定骰重掷组合和真实入口 E2E / 截图 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补属性边界、死亡保护、固定骰重掷组合和真实入口 E2E / 截图 |
| E24 | 说“茄子”！ | 未锁定 | 事件 | 事件录入合同 index 9；`discoveryAtlas.ts` frame 23；TTS CardID 37223 | `locked` | frame 23 已映射 | `in-runtime` | 作祟 33 成功链只按现有代表链消费；完整剧本另审 | `locked` | 无 |
| E25 | 外星几何 | 未锁定 | 事件 | 事件录入合同 index 10；`discoveryAtlas.ts` frame 24；TTS CardID 37224 | `locked` | frame 24 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E26 | 无线电广播 | 未锁英文名 | 事件 | TTS manifest frame 25 / CardID 37225；`card-25-r2c7-full.jpg` | TTS 图包已读：投 2 颗骰子；3-4 获得 1 点知识；0-2 受到一颗骰子的精神伤害；脚注为可播放曲目提示 | frame 25 完整裁图存在；sha256 `cb577aef5a3bad35`；atlas 标题映射已补 | `in-config / min-branch-verified / Board component representative / footnote-contract-set` | 已录入配置；新增配置事件回归覆盖 3-4 知识 +1 和 0-2 骰子精神伤害状态断言；Board 组件代表链已承接事件房间翻牌后的固定 2 骰骰盘、总点数 4 时的 3-4 知识 +1 分支和总点数 0 时的 0-2 骰子精神伤害分支；脚注裁定为玩家可见风味/音频提示，不改变事件检定、伤害或属性结算；正式音频/脚注 UI 仍未接 | `locked / partial` | S0 字段已锁；脚注不再阻塞领域规则代表链，后续最小解阻为补脚注展示或音频资源授权/接入；规则结算仍需补精神伤害减免/死亡保护、固定骰/最近投骰重掷准入和真实入口 E2E / 截图 |
| E27 | 小丑房间 | 未锁定 | 事件 | 事件录入合同 index 11；`discoveryAtlas.ts` frame 26；TTS CardID 37226 | `locked` | frame 26 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E28 | 小机器人 | 未锁定 | 事件 | 事件录入合同 index 12；`discoveryAtlas.ts` frame 27；TTS CardID 37227 | `locked` | frame 27 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E29 | 摇曳灯光 | 未锁英文名 | 事件 | TTS manifest frame 28 / CardID 37228；`card-28-r3c1-full.jpg` | TTS 图包已读：速度或力量检定；5+ 获得 1 点速度；0-4 受到一颗骰子的物理伤害 | frame 28 完整裁图存在；sha256 `e2df64be818b0638`；atlas 标题映射已补 | `in-config / min-branch-verified / Board component representative` | 已录入配置；已补选择速度/力量成功后速度 +1 的最小指令结算，并补 0-4 失败物理伤害代表链；祝福标记加骰代表链也已覆盖；Board 组件代表链已承接卡面、速度/力量二选一、速度检定骰盘和速度 +1 分支结果；仍缺速度上限、物理伤害减免/死亡保护、祝福与重掷/替代组合、真实入口 E2E / 截图 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补速度上限、物理伤害减免/死亡保护、祝福与重掷/替代组合、真实入口 E2E / 截图 |
| E30 | 咬一口！ | 未锁定 | 事件 | 事件录入合同 index 13；`discoveryAtlas.ts` frame 29；TTS CardID 37229 | `locked` | frame 29 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E31 | 夜幕众星 | 未锁定 | 事件 | 事件录入合同 index 14；`discoveryAtlas.ts` frame 30；TTS CardID 37230 | `locked` | frame 30 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E32 | 一罐器官 | 未锁英文名 | 事件 | TTS manifest frame 31 / CardID 37231；`card-31-r3c4-full.jpg` | TTS 图包已读：神志检定；4+ 抽取一张物品卡；0-3 失去 1 点力量 | frame 31 完整裁图存在；sha256 `f296dd2baa9eb082`；atlas 标题映射已补 | `in-config / min-branch-verified / Board component representative` | 已录入配置；新增配置事件回归覆盖 4+ 抽物品分支和 0-3 力量 -1 分支状态断言；Board 组件代表链已承接事件房间翻牌后的神志检定骰盘、成功抽物品进入持有区和失败力量 -1 确认步骤；仍缺物品牌堆耗尽、属性下限、直接属性降低致死、死亡保护和真实入口 E2E / 截图 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补物品牌堆耗尽、属性下限、直接属性降低致死、死亡保护和真实入口 E2E / 截图 |
| E33 | 一抹鲜红 | 未锁定 | 事件 | 事件录入合同 index 15；`discoveryAtlas.ts` frame 32；TTS CardID 37232 | `locked` | frame 32 已映射 | `in-runtime` | 作祟 1 成功链只按现有代表链消费；完整剧本另审 | `locked` | 无 |
| E34 | 一瓶微尘 | 未锁定 | 事件 | 事件录入合同 index 16；`discoveryAtlas.ts` frame 33；TTS CardID 37233 | `locked` | frame 33 已映射 | `in-runtime` | 作祟 3 成功链只按现有代表链消费；完整剧本另审 | `locked` | 无 |
| E35 | 一声呼救 | 未锁英文名 | 事件 | TTS manifest frame 34 / CardID 37234；`card-34-r3c7-full.jpg` | TTS 图包已读：知识检定；4+ 将探险者放置在所在区域的任意板块；0-3 受到 1 点精神伤害 | frame 34 完整裁图存在；sha256 `6343c8474ebf0ff6`；atlas 标题映射已补 | `in-config / min-branch-verified / Board component representative` | 已录入配置；已补 4+ 分支中区域内板块放置到门厅的最小指令结算，并补 0-3 精神伤害状态断言；已补不同区域和未发现板块非法目标拒绝；Board 组件代表链已补卡面、知识检定骰盘、总点数 8、同区域已发现房间候选高亮、不同区域候选不显示、点击门厅后当前位置更新和“放置到门厅”确认步骤；总点数 0 时也会显示 0-3 分支“受到 1 点精神伤害”和确认步骤；仍缺非法原因 UI、精神伤害减免/死亡保护、更多区域边界组合和真实入口 E2E / 截图 | `locked / partial / Board component representative` | S0 字段已锁；S1/S2 下一步是补非法原因 UI、精神伤害组合、更多区域边界和真实入口 E2E / 截图 |
| E36 | 一条秘密通道 | 未锁定 | 事件 | 事件录入合同 index 17；`discoveryAtlas.ts` frame 35；TTS CardID 37235 | `locked` | frame 35 已映射 | `in-runtime / min-branch-verified / Board component representative` | 已有知识检定 5+ / 3-4 / 0-2 三档、秘密通道标志物、第二目标板块、5+ 知识 +1、0-2 神志 -1、非法目标拒绝、发现确认前禁止移动和头骨死亡保护领域代表链；Board 组件代表链已补第二目标房间候选、点击门厅、两个秘密通道标志物反馈和“知识 +1”确认步骤；仍缺非法原因 UI、更多目标范围、秘密通道标志物移动入口、属性上下限、死亡保护/重掷组合和真实入口 E2E / 截图 | `locked / Board component representative / partial-ui` | S0 字段已锁；S1/S2 下一步是补非法原因 UI、更多目标范围、标志物移动入口、属性上下限、死亡保护/重掷组合和真实入口 E2E / 截图 |
| E37 | 一种怪异的感觉 | 未锁定 | 事件 | 事件录入合同 index 18；`discoveryAtlas.ts` frame 36；TTS CardID 37236 | `locked` | frame 36 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E38 | 游魂 | 未锁英文名 | 事件 | TTS manifest frame 37 / CardID 37237；`card-37-r4c1-full.jpg` | TTS 图包已读：可埋葬一件物品；若如此做获得 1 点任意属性；否则进行神志检定，4+ 抽取一张物品牌，0-3 受到 1 点通用伤害 | frame 37 完整裁图存在；sha256 `959d06db248bf5f4`；atlas 标题映射已补 | `in-config / min-verified / Board component representative` | 已接入埋葬物品、任意属性选择、神志检定、抽物品和通用伤害；Board 组件代表链已证明候选物品、四项属性候选、物品 + 属性双选择确认门禁和 `cardId=map / trait=knowledge` 派发；仍需补无物品 UI、抽物品 UI、通用伤害 UI/死亡保护和真实入口 E2E / 截图 | `locked / partial / Board component representative` | 定向领域测试已覆盖接受/拒绝/抽物品/通用伤害最小运行闭环；Board 物品 / 任意属性选择测试已覆盖接受分支 UI 代表链；后续不再按 `not-in-runtime` 接续 |
| E39 | 在你背后！ | 未锁定 | 事件 | 事件录入合同 index 19；`discoveryAtlas.ts` frame 38；TTS CardID 37238 | `locked` | frame 38 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E40 | 葬礼 | Funeral / 部分规则书示例名 | 事件 | 事件录入合同 index 20；`discoveryAtlas.ts` frame 39；TTS CardID 37239 | `locked` | frame 39 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E41 | 着火的人 | 未锁英文名 | 事件 | TTS manifest frame 40 / CardID 37240；`card-40-r4c4-full.jpg` | TTS 图包已读：神志检定；4+ 获得 1 点神志；2-3 将探险者放置在入口大厅；0-1 受到一颗骰子的物理伤害以及一颗骰子的精神伤害 | frame 40 完整裁图存在；sha256 `d480f71c06419dca`；atlas 标题映射已补 | `in-config / min-branch-verified / Board component representative` | 已录入配置；新增配置事件回归覆盖 4+ 神志 +1、2-3 移动到入口大厅、0-1 物理+精神双伤害状态断言；Board 组件代表链已承接事件房间翻牌后的神志检定骰盘、总点数 2、2-3 分支“放置到入口大厅”和当前探险者位置更新；总点数 0 时展示 0-1 双伤害分支、物理伤害骰反馈和精神伤害骰反馈；仍缺双伤害分配顺序、减伤/胸针/盔甲/头戴耳机/死亡保护组合和真实入口 E2E / 截图 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补双伤害分配顺序、减伤/胸针/盔甲/头戴耳机/死亡保护组合和真实入口 E2E / 截图 |
| E42 | 蜘蛛！ | 未锁定 | 事件 | 事件录入合同 index 21；`discoveryAtlas.ts` frame 41；TTS CardID 37241 | `locked` | frame 41 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E43 | 最深的壁橱 | 未锁定 | 事件 | 事件录入合同 index 22；`discoveryAtlas.ts` frame 42；原始事件 atlas `temp/betrayal-asset-source-diagnostics-2026-07-28/event-42-r4c6-full.jpg` | 旧 6x4 事件录入合同原文为 `locked`；本轮原始 atlas frame 42 复核为同一张「最深的壁橱」 | frame 42 已在代码映射；原始 atlas 直接裁图 sha256 `b96c035c2fd5d99f4645d126e8d3e8206e112e4e2b09840f7195ca3d35d0f0c2`；旧 TTS manifest 未生成该候选 | `in-config / source-locked` | 旧实现证据可继续消费；后续只需在重建 manifest 时补回 frame 42 | `locked` | 源图包不缺素材；历史 blocker 改判为“旧裁图 manifest 漏扫有效 frame 42” |

### 3.1 事件牌三方差异表

| 对照项 | 数量 / 范围 | 已对齐 | 缺口 |
| --- | ---: | --- | --- |
| 官方事件牌 | 43 | 本合同 E01-E43 建立对象行；原 20 个 unknown-slot 已从 TTS 图包读出标题和主要规则子句；E43 frame 42 已从原始 atlas 复核锁定；当前 43 张均已进入配置和 atlas 映射；新增配置事件定向回归已覆盖 20 张新增/补录事件的运行消费入口，并补失败伤害分支、成功属性分支与剩余可配置分支代表链 | 多张新增事件仍缺剩余分支、UI 承接和组合测试闭合证据；部分房间合法性与属性分支边界已补证，但仍需更多组合边界 |
| 当前事件配置池 | 43 | 原 23 张 + 20 张 TTS 补录事件均已在 `scenarioConfig.ts` 事件数组中；E17「轮到约拿了」、E20「片刻希望」、E38「游魂」、E13「技术难点」已补最小运行闭合；E05/E08/E10/E11/E14/E18/E23/E29/E35 已补一个关键待选择分支的玩家指令结算 | 事件配置缺口 0；不得把配置闭合或单分支通过等同运行全闭合 |
| TTS 9x5 manifest 候选 | 42 原候选；45 格补注扫描 | 原 `candidateCards` index 0-41 有 CardID；`gridAudit20260728` 已补 frame 0-44 分类；20 张缺口事件均已从对应完整单卡裁图读出字段 | 原候选漏 frame 42；补注已锁 frame 42 是「最深的壁橱」，frame 43 是空黑格、frame 44 是事件背面，不纳入官方 43 正面对象 |
| 当前 `EVENT_FRONT_FRAME_BY_TITLE` | 43 | 43 个当前配置事件标题映射到 frame；E43 frame 42 已由原始 atlas 复核 | 无事件标题映射缺口 |

## 4. 物品牌对象全集：22 / 22

说明：官方数量是 22。本轮回到用户指定原始图包，已确认物品 atlas 的 frame 0-21 是 22 张物品正面，frame 22 是空黑格，frame 23 是物品背面。当前工作区发现池已扩到 22 个官方物品对象，并且 `possessionAtlas.ts` 已为 22 张官方物品接入 atlas frame。`notebook / journal / manuscript` 共用地图 frame/hash，`lantern` 共用手电筒 frame/hash，它们属于首剧本起始或 legacy alias，不能拿来填官方独立牌槽位，也不计入官方 22 张物品。当前物品剩余缺口已从“缺运行对象”转为“部分物品仍需 UI 承接、组合验证或后续机制审计”。

| # | 中文名 / 槽位 | 英文名或原文名 | 类别 | 官方来源或真相源位置 | 规则原文或效果子句录入状态 | 素材 / atlas / 裁图 / frame 状态 | 当前配置/运行状态 | 能力 / 效果 / UI 后续 | 合同状态 | 阻塞原因与下一步最小解阻动作 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| I01 | 魔法相机（camera） | Magic Camera | 物品 | 物品/预兆效果审计表；原始 item atlas frame 0 | `locked` | item frame 0；crop-ready；`source-atlas-diagnostics.json` 复核 | `in-runtime` | 当前能力合同已有证据；新增消费者再审 | `locked` | 无 |
| I02 | 恐怖玩偶 | 未锁英文名 | 物品 | 原始 item atlas frame 1；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-01-r0c1-full.jpg` | TTS 图包已读：你的每个回合可使用一次；可以使用恐怖玩偶重新投掷刚刚进行的属性检定的所有骰子 | item frame 1 已裁完整单卡；sha256 `a4006c186f6d59662c451fe8d553e67bec4a25a682aa18d2f6206216940c7a85`；atlas alias 已接 | `in-runtime / partial-mechanism-covered / Board component representative / partial-ui` | 已补最近属性检定全骰重掷入口：事件属性检定可回写原事件分支结算，房间回合末属性检定入口已开放；Board 组件代表链证明选中恐怖玩偶后最近属性检定骰盘为全部骰子生成重掷目标；固定骰、攻击、作祟检定、作祟特殊行动属性检定不放行 | `locked` | S0 图包字段、属性检定全骰重掷机制和 Board 组件代表链已锁；后续最小解阻为补真实 Playwright / 截图、作祟特殊行动属性检定通用回滚快照和更多重掷消费者组合 |
| I03 | 奇怪的药品（holy-water） | Strange Medicine | 物品 | 物品/预兆效果审计表；原始 item atlas frame 2 | `locked` | item frame 2；crop-ready | `in-runtime` | 当前能力合同已有证据；新增消费者再审 | `locked` | 内部 id 为 legacy alias，不影响当前 S0 |
| I04 | 镜子 | 未锁英文名 | 物品 | 原始 item atlas frame 3；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-03-r0c3-full.jpg` | TTS 图包已读：在你的回合内，可以埋葬此镜子；若如此做，治疗你的知识和神志 | item frame 3 已裁完整单卡；sha256 `fcb43814e5992d433e233d93da28e31c504d6270b72c852daf9ba8cae9631eeb`；atlas alias 已接 | `in-runtime / min-verified` | 已补主动埋葬治疗知识和神志的最小运行承接；后续仍需组合回归 | `locked` | S0 字段与最小效果已接；后续补更多伤害/治疗组合验证 |
| I05 | 急救包（medical-kit） | Medical Kit | 物品 | 物品/预兆效果审计表；原始 item atlas frame 4 | `locked` | item frame 4；crop-ready | `in-runtime` | 当前能力合同已有证据；新增消费者再审 | `locked` | 无 |
| I06 | 幸运硬币 | 未锁英文名 | 物品 | 原始 item atlas frame 5；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-05-r0c5-full.jpg` | TTS 图包已读：你的每个回合可使用一次；可以使用幸运硬币重新投掷刚刚进行的一项属性检定的所有空白骰子；重投结果中每有一个空白骰子，承受 1 点精神伤害 | item frame 5 已裁完整单卡；sha256 `a2661a7da513d14819a70d737667d5ff4db6bf0fef1ee1bbe6b58a45677f354c`；atlas alias 已接 | `in-runtime / combo-domain-verified / Board component representative / partial-ui` | 已补最近属性检定空白骰重掷入口：事件属性检定可重掷所有空白骰，重投后每个空白进入精神伤害分配；Board 组件目标层只允许选择空白骰；固定骰、攻击、作祟检定和作祟特殊行动属性检定不放行；已补倒塌房间回合末真实效果链组合：重投为非空白会回滚坠落并取消房间伤害，重投仍为空白会先分配幸运硬币精神伤害，再确认倒塌房间坠落伤害并推进下一玩家 | `locked` | S0 图包字段、S1/S2 最小领域组合和 Board 组件代表链已锁；后续最小解阻为补真实 Playwright / 截图、作祟特殊行动、死亡保护和更多伤害分配组合回归 |
| I07 | 皮夹克 | 未锁英文名 | 物品 | 原始 item atlas frame 6；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-06-r0c6-full.jpg` | TTS 图包已读：无论何时你防御一次进攻时，多投掷一颗额外的骰子 | item frame 6 已裁完整单卡；sha256 `3669741d0d9bb9a5eddf1acbac13aaea7cfe4b6ea2a188b8e7f6156122d8858a`；atlas alias 已接 | `in-runtime / min-domain-verified / Board component representative` | 已补防御攻击时额外 1 骰的最小运行承接；当前树 Board 组件代表链已证明真实攻击入口结算后，攻击投骰复盘显示进攻总点、防御总点和防御额外 1 骰；后续仍需更多攻击来源组合 | `locked` | S0 字段、最小领域效果和 Board 组件代表链已接；后续补真实 Playwright / 截图、怪物攻击、作祟攻击和更多攻击来源组合验证 |
| I08 | 牙齿项链 | 未锁英文名 | 物品 | 原始 item atlas frame 7；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-07-r0c7-full.jpg` | TTS 图包已读：在你的回合结束时，可以获得 1 点你选择的某项濒死属性 | item frame 7 已裁完整单卡；sha256 `3c2370c1a249401a0db7e32a2bc8c09f8265294e281da8c899097e85c42d7c7a`；atlas alias 已接 | `in-runtime / min-domain-verified / min-ui-representative` | 已补回合结束触发、濒死属性筛选、选择后提升 1 步、跳过和非法属性拒绝；当前树已补 Board 组件选择 / 跳过代表链，但不等同真实 Playwright / 截图闭环 | `locked` | S0 字段、最小领域效果和 Board 组件代表链已接；后续补更多作祟/房间结束/死亡保护组合回归 |
| I09 | 手电筒（flashlight） | Flashlight | 物品 | 物品/预兆效果审计表；原始 item atlas frame 8 | `locked` | item frame 8；crop-ready | `in-runtime` | 当前能力合同已有证据；新增消费者再审 | `locked` | `lantern` 复用同 frame，见 alias 表 |
| I10 | 头戴耳机（radio） | Headphones | 物品 | 物品/预兆效果审计表；原始 item atlas frame 9 | `locked` | item frame 9；crop-ready | `in-runtime` | 当前能力合同已有证据；新增消费者再审 | `locked` | 内部 id 为 legacy alias，不影响当前 S0 |
| I11 | 奇怪的护身符（strange-amulet；代码名“奇异护符”） | 未锁英文名 | 物品 | `scenarioConfig.ts` 运行池；`possessionAtlas.ts` atlas alias；原始 item atlas frame 10；`item-strange-amulet-full.jpg` | TTS/atlas 图包已读：无论何时你受到物理伤害时，获得 1 点神志；通用伤害应用到物理或速度上的效果不算在内，对力量/速度属性的直接降低不算在内 | item frame 10 已从正式 atlas 裁完整单卡；sha256 `9e25d6048a0b59263723b09da1a467bafee3d69e3c1e08d29d25ad9680693728` | `in-runtime / min-domain-verified` | 已补“实际承受物理伤害后获得 1 点神志”的最小领域承接，并排除通用伤害分配到速度、速度属性直接降低两类误触发；仍缺触发 UI/日志提示和更多组合验证 | `locked` | S1/S2 最小领域补证已过；后续最小解阻为补 UI/日志提示、减伤/死亡保护/作祟伤害组合回归 |
| I12 | 胸针 | 未锁英文名 | 物品 | 原始 item atlas frame 11；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-11-r1c3-full.jpg` | TTS 图包已读：无论何时你受到物理或精神伤害时，你可以替换为承受通用伤害 | item frame 11 已裁完整单卡；sha256 `d2f8f52deaec13442770c78e08e3119dd8d6693753bc2812f5c7b5d976914f82`；atlas alias 已接 | `in-runtime / min-domain-verified / min-ui-representative` | 已补待分配物理/精神伤害替换为通用伤害、未声明时仍按原伤害类型限制分配、日志记录；当前树已补 Board 组件伤害分配代表链，但不等同真实 Playwright / 截图闭环 | `locked` | S0 字段、最小领域效果和 Board 组件代表链已接；后续补更多伤害来源、减伤叠加、强制伤害顺序、死亡保护和作祟伤害组合回归 |
| I13 | 枪 | 未锁英文名 | 物品 | 原始 item atlas frame 12；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-12-r1c4-full.jpg` | TTS 图包已读：武器；当你使用此枪进行攻击时，可以攻击视线内的任一目标；你和防御者分别以速度投骰；如果你失败了，你不承受伤害；每次攻击只能使用一把武器，且本回合不能交易已使用过的武器 | item frame 12 已裁完整单卡；sha256 `2d08669f25dca8844e7015fe832069841681aa0a359167ce1aec9d77105b7a5d`；atlas alias 已接 | `in-runtime / min-verified` | 已补速度攻击、视线目标、失败不反伤和本回合用后交易限制的最小运行承接；后续仍需更多目标/怪物组合 | `locked` | S0 字段与最小效果已接；后续补枪攻击 UI/领域组合回归 |
| I14 | 十字弓 | 未锁英文名 | 物品 | 原始 item atlas frame 13；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-13-r1c5-full.jpg` | TTS 图包已读：武器；当你使用十字弓进行攻击时，可以攻击位于你所在板块或某相邻板块的任一角色（探险者或怪物）；你和防御者分别以速度投骰；如果你失败了，你不承受伤害；每次攻击只能使用一把武器，且本回合不能交易已使用过的武器 | item frame 13 已裁完整单卡；sha256 `edfd5550c81550ebbf00f3b74bd3ae08207de836543182ad09189e0fe2ac0b2b`；atlas alias 已接 | `in-runtime / min-verified` | 已补速度攻击、同板块/相邻板块目标、失败不反伤和本回合用后交易限制的最小运行承接；明确不按视线武器处理 | `locked` | S0 字段与最小效果已接；后续补怪物目标和更多 UI 组合回归 |
| I15 | 骨制钥匙（lockpick-tool） | Skeleton Key | 物品 | 物品/预兆效果审计表；原始 item atlas frame 14 | `locked` | item frame 14；crop-ready | `in-runtime` | 当前能力合同已有证据；新增消费者再审 | `locked` | 内部 id 为 legacy alias，不影响当前 S0 |
| I16 | 神秘秒表 | 未锁英文名 | 物品 | 原始 item atlas frame 15；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-15-r1c7-full.jpg` | TTS 图包已读：在你的回合内，可以埋葬此秒表；若你如此做，在本回合结束后再进行一轮行动；你只能在作祟开始后使用此能力 | item frame 15 已裁完整单卡；sha256 `13d87c800b6cadc9bc80f3c3886d81897c6f35c8b346bc2afd7bdd089701f422`；atlas alias 已接 | `in-runtime / min-verified / min-ui-representative` | 已补作祟前禁用、作祟后埋葬、当前回合结束后额外行动一轮、未使用时正常交接的最小领域承接；2026-07-29 已补灰尘主动持有牌真实页面代表链：使用后埋葬，结束回合后仍回到当前玩家 | `locked` | S0 字段与最小效果已接；后续补更多作祟/怪物回合/房间回合末组合回归 |
| I17 | 地图（map） | Map | 物品 | 物品/预兆效果审计表；原始 item atlas frame 16 | `locked` | item frame 16；crop-ready | `in-runtime` | 当前能力合同已有证据；新增消费者再审 | `locked` | `notebook / manuscript / journal` 复用同 frame，不能重复计为独立 locked 官方牌 |
| I18 | 砍刀（hunting-knife） | Machete | 物品 | 物品/预兆效果审计表；原始 item atlas frame 17 | `locked` | item frame 17；crop-ready | `in-runtime` | 当前能力合同已有证据；新增攻击消费者再审 | `locked` | 内部 id 为 legacy alias，不影响当前 S0 |
| I19 | 电锯 | 未锁英文名 | 物品 | 原始 item atlas frame 18；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-18-r2c2-full.jpg` | TTS 图包已读：武器；当你使用电锯进行攻击时，将你的投骰数量增加一颗；每次攻击只能使用一把武器，且本回合不能交易已使用过的武器 | item frame 18 已裁完整单卡；sha256 `38ed8325c0a1c35d3578296fbd25e0bd7ff4de7bd95d67965247443e7adf711e`；atlas alias 已接 | `in-runtime / min-verified` | 已补攻击额外 1 骰和本回合用后交易限制的最小运行承接；后续仍需更多攻击来源组合 | `locked` | S0 字段与最小效果已接；后续补攻击组合回归 |
| I20 | 炸药 | 未锁英文名 | 物品 | 原始 item atlas frame 19；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-19-r2c3-full.jpg` | TTS 图包已读：武器；可以使用炸药来代替一次常规的攻击；若如此做，将炸药埋葬后，选择你所在的板块或相邻的板块；在所选板块上的每个人（探险者或怪物）必须进行一次速度检定：4+ 无事发生，0-3 受到 4 点物理伤害；该板块上的每个人都必须分别投骰并承受伤害；每次攻击只能使用一把武器 | item frame 19 已裁完整单卡；sha256 `cb7456d76090413f124fb59cf0af86ccb4a03451709398f33b73e767fa34307e`；atlas alias 已接 | `in-runtime / min-domain-verified / min-ui-representative` | 已补代替常规攻击、当前/相邻已发现板块目标、使用后埋葬、目标板块每名探索者/怪物分别速度检定、失败探索者进入 4 点物理伤害分配、失败怪物走通用怪物受伤后端的最小领域承接；2026-07-29 已补 Board 页面组件目标态代表链：主动作自动选中炸药，当前 / 相邻已发现房间高亮，点击房间板块派发炸药攻击载荷 | `locked` | S1/S2 最小领域与最小 UI 代表链已过；后续最小解阻为真实 Playwright / 截图链、非法原因展示、更多怪物 / 作祟组合和特殊免疫边界回归 |
| I21 | 天使之羽 | 未锁英文名 | 物品 | 原始 item atlas frame 20；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-20-r2c4-full.jpg` | TTS 图包已读：当你被要求进行一次属性检定时，可以埋葬此天使之羽来代替它；若如此做，选择一个 0-8 之间的数字，使用该数字作为被要求进行的投骰结果；仍可以应用相关属性加成，例如从预兆牌中获得的加值 | item frame 20 已裁完整单卡；sha256 `77de0a0a9c2d132920be72014579829e097d30845d773638fe12b1a25cc9e3f1`；atlas alias 已接 | `in-runtime / min-domain-verified / min-ui-representative` | 已补埋葬、0-8 结果选择、下一次非战斗属性检定投骰结果替代、属性加值叠加、固定骰不消费；2026-07-29 已补真实页面 0-8 数字选择、未选禁用、选择 6 后使用并写入替代总点数；后续仍缺攻击/作祟检定边界扩审、额外骰是否属于“相关属性加成”的规则裁定 | `locked` | S1/S2 最小领域与最小 UI 代表链已过；后续最小解阻为更多组合验证 |
| I22 | 兔脚（rope） | Rabbit's Foot | 物品 | 物品/预兆效果审计表；原始 item atlas frame 21 | `locked` | item frame 21；crop-ready | `in-runtime` | 当前能力合同已有证据；新增投骰消费者再审 | `locked` | 内部 id `rope` 为 legacy alias，玩家名按兔脚 |

### 4.1 物品牌运行池 / 裁图 manifest / atlas alias 差异

| 对象 | 运行池 | 裁图 manifest | atlas alias | 当前裁定 |
| --- | --- | --- | --- | --- |
| 奇异护符（strange-amulet） | 有 | 原 manifest 无；本轮已从正式 atlas 补临时完整裁图 | 有：item frame 10 | `locked / min-domain-verified`：S0 单卡图和原文合同已补齐；已补实际物理伤害触发与通用伤害/属性降低排除的最小领域补证，仍缺 UI/日志提示和更多组合验证 |
| 官方 22 张物品正面 | 当前发现池已接 22 个官方物品对象 | 旧 manifest 只有 12 行物品裁图，且重复地图 frame；本轮诊断裁图已覆盖 22 个 frame | 原始 item atlas frame 0-21 均为正面，运行 atlas alias 已覆盖 22 个官方物品 | `source-complete / in-runtime`：源图包不缺素材；当前缺口从运行接线转为效果消费与测试证据 |
| 原未接唯一物品正面 | 恐怖玩偶、镜子、幸运硬币、皮夹克、牙齿项链、胸针、枪、十字弓、神秘秒表、电锯、炸药、天使之羽均已进入发现池 | 本轮已在 `temp/betrayal-asset-source-diagnostics-2026-07-28/item-*-full.jpg` 生成完整单卡裁图并完成效果子句转写；奇异护符另从正式 atlas frame 10 补完整单卡核对图 | frame 1/3/5/6/7/10/11/12/13/15/18/19/20 | `in-runtime / mixed-implementation`：镜子、恐怖玩偶、幸运硬币、皮夹克、牙齿项链、胸针、枪、十字弓、神秘秒表、电锯、炸药、天使之羽、奇异护符已有最小运行承接或代表链；幸运硬币已补倒塌房间真实效果链组合；仍需逐项补 UI/组合验证 |
| 日记（journal） | 不在发现池；在首剧本起始持有物 | 有 | 有：item frame 16 | `duplicate-alias`：不是当前发现池 22 物品之一 |
| 灯笼（lantern） | 不在发现池；在首剧本起始持有物 | 无 | 有：item frame 8 | `duplicate-alias / crop-missing`：复用手电筒 frame |
| 地图 / 笔记本 / 日记 / 手稿 | 部分在发现池，日记在起始物 | 四个 crop 行同 frame/hash，图面均为“地图” | 均指向 item frame 16 | `duplicate-alias`：已证明四个 alias 不是四张独立牌面，不能按四个独立官方物品锁定 |
| 手电筒 / 灯笼 | 手电筒在发现池，灯笼在起始物 | 手电筒有，灯笼无 | 均指向 item frame 8 | `duplicate-alias`：灯笼不能独立计入发现池物品完成 |

## 5. 预兆牌对象全集：9 / 9

说明：9 张预兆对象、正面 atlas 和逐卡卡面合同已有本地证据；但作祟检定是公共规则，不属于任一单卡效果，必须拆成独立合同。

| # | 中文名 / 槽位 | 英文名或原文名 | 类别 | 官方来源或真相源位置 | 规则原文或效果子句录入状态 | 素材 / atlas / 裁图 / frame 状态 | 当前配置/运行状态 | 能力 / 效果 / UI 后续 | 合同状态 | 阻塞原因与下一步最小解阻动作 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| O01 | 书本（omen-book） | Book | 预兆 | 物品/预兆效果审计表；裁图 manifest `omen-book` | C1-C5 已录入 | omen frame 0；crop-ready | `in-runtime` | 单卡效果合同已存在；后续只在新增消费者时回归 | `locked` | 无 |
| O02 | 狗（dog） | Dog | 预兆 | 物品/预兆效果审计表；裁图 manifest `dog` | C1-C6 已录入 | omen frame 1；crop-ready | `in-runtime` | 单卡效果合同已存在；后续只在新增消费者时回归 | `locked` | 无 |
| O03 | 面具（mask） | Mask | 预兆 | 物品/预兆效果审计表；裁图 manifest `mask` | C1-C6 已录入 | omen frame 2；crop-ready | `in-runtime` | 单卡效果合同已存在；后续只在新增消费者时回归 | `locked` | 无 |
| O04 | 头骨（skull） | Skull | 预兆 | 物品/预兆效果审计表；裁图 manifest `skull` | C1-C5 已录入 | omen frame 3；crop-ready | `in-runtime` | 单卡效果合同已存在；后续只在新增致死来源时回归 | `locked` | 无 |
| O05 | 圣符（holy-symbol） | Holy Symbol | 预兆 | 物品/预兆效果审计表；裁图 manifest `holy-symbol` | C1-C5 已录入 | omen frame 4；crop-ready | `in-runtime` | 单卡效果合同已存在；后续只在新增探索消费者时回归 | `locked` | 无 |
| O06 | 盔甲（armor） | Armor | 预兆 | 物品/预兆效果审计表；裁图 manifest `armor` | C1-C4 已录入 | omen frame 7；crop-ready | `in-runtime` | 单卡效果合同已存在；后续只在新增伤害来源时回归 | `locked` | 无 |
| O07 | 雕像（idol） | Idol | 预兆 | 物品/预兆效果审计表；裁图 manifest `idol` | C1-C3 已录入 | omen frame 8；crop-ready | `in-runtime` | 单卡效果合同已存在；后续只在新增探索消费者时回归 | `locked` | 无 |
| O08 | 指环（ring） | Ring | 预兆 | 物品/预兆效果审计表；裁图 manifest `ring` | C1-C6 已录入 | omen frame 6；crop-ready | `in-runtime` | 单卡效果合同已存在；后续只在新增攻击消费者时回归 | `locked` | 无 |
| O09 | 匕首（dagger） | Dagger | 预兆 | 物品/预兆效果审计表；裁图 manifest `dagger` | C1-C6 已录入 | omen frame 5；crop-ready | `in-runtime` | 单卡效果合同已存在；后续只在新增攻击消费者时回归 | `locked` | 无 |

### 5.0 预兆逐卡效果领域证据矩阵

本节只消费已锁 S0 预兆合同和当前本地领域测试证据，不重新 OCR、不用百度/网页补逐卡规则。作祟检定、全员预兆数和最后一张预兆自动作祟属于 5.1 公共规则，不计入任一单张预兆效果。

| 预兆 | 已有领域效果证据 | 当前状态 | 仍缺口 |
| --- | --- | --- | --- |
| 书本 | 知识检定 +1；每回合一次失去 1 点神志，并让下一次非战斗检定可用知识替换；战斗对攻不被替换；临界神志时不能免费写入替代状态 | `min-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图链、更多非战斗检定消费者、房间检定、作祟特殊行动检定和重掷 / 替代消费者组合 |
| 狗 | 速度检定 +1；每回合一次可请求与 4 格内玩家交易任意数量物品/预兆；需要对方同意；沿用已用牌、刚收到牌等交易限制 | `min-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图链、更多距离/死亡/搜尸/作祟状态组合、收到牌本回合使用限制 UI |
| 面具 | 速度检定 +1；每回合一次移动同板块其他探险者和怪物到已发现相邻板块；支持多目标分别指定目标板块；不能发现新板块 | `min-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图链、死亡目标/怪物回合等更多组合回归 |
| 头骨 | 知识检定 +1；探索者将要死亡前投 3 骰，4-6 阻止死亡并把所有属性调至濒死，0-3 正常死亡；兔脚可重掷该死亡保护骰 | `min-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图链、更多致死来源、作祟终局和遗物掩埋组合回归 |
| 圣符 | 神志检定 +1；发现板块时可埋葬第一张板块并继续发现下一张，且不结算第一张板块效果；本回合刚获得时不能使用 | `min-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图链、更多房间/事件/作祟探索组合回归 |
| 盔甲 | 物理伤害降低 1 点；不会阻挡通用伤害或直接属性降低；不能被通用主动使用入口误当成移动/属性加成 | `min-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图链、更多物理伤害来源、死亡保护和作祟伤害组合回归 |
| 雕像 | 力量检定 +1；发现事件符号板块时可选择不抽事件卡且不结算事件效果；不能在无事件符号或无雕像时声明跳过 | `min-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图链、更多事件堆顺序/作祟探索组合回归 |
| 指环 | 神志检定 +1；只能作为攻击武器显式使用，双方改用神志对攻并造成精神伤害；未声明使用时不会自动改战斗属性 | `min-domain-verified / partial-ui` | 攻击 UI 承接、怪物/多武器/作祟攻击组合回归 |
| 匕首 | 只能作为攻击武器显式使用；使用时攻击者失去 1 点速度并额外投 2 颗骰，造成物理伤害；未声明使用时不会自动生效 | `min-domain-verified / partial-ui` | 攻击 UI 承接、速度濒死/多武器/死亡保护组合回归 |

### 5.1 作祟公共规则合同

| 公共规则 | 真相源位置 | 合同状态 | 运行/实现后续 |
| --- | --- | --- | --- |
| 抽到预兆后进行作祟检定 | 官方规则书 `betrayal-3e-rulebook-en.md:647,749`；当前规则口径按所有玩家当前持有预兆总数计算风险 | `min-domain-verified` | 已覆盖普通预兆抽取后进入作祟检定、记录来源预兆和翻牌确认队列；不归入单张预兆效果，仍缺 UI 承接和更多组合扩审 |
| 作祟检定骰数与所有玩家当前持有的预兆总数相关 | `docs/games/betrayal/full-rule-interaction-redesign.md` 与现有基础规则补证记录；用户本轮明确指定该口径 | `min-domain-verified / Board component representative / partial-ui` | 已覆盖全员当前持有预兆总数派生、交易转移预兆后仍按全员总数派生、抽到新预兆时骰数与风险读模型一致；Board 组件代表链覆盖狗交易预兆后风险条不按当前玩家持有数下降；死亡掉落、搜尸等更多组合仍需扩审 |
| 作祟检定 5+ 开始作祟 | 官方规则书 `betrayal-3e-rulebook-en.md:749` | `min-domain-verified` | 已覆盖普通预兆 5+ 触发作祟并记录剧本卡、作祟揭秘者、叛徒/首玩家代表裁定和触发预兆来源；事件型作祟入口与 UI 承接仍需另审 |
| 作祟检定最多 8 骰 | 规则骰子上限口径；当前风险读模型和投骰入口共同消费 | `min-domain-verified` | 已覆盖全员当前持有 9 张预兆时请求总数为 9，但实际投 8 骰且发现详情显示 8 颗骰子 |
| 最后一张预兆若尚未作祟则自动触发作祟 | 官方规则书 `betrayal-3e-rulebook-en.md:755`；领域回归 `firstScenarioRuntime.test.ts -t "作祟风险\|交易转移预兆\|抽到新预兆\|作祟检定按全员\|普通预兆触发作祟\|抽到最后一张预兆"`：15 passed / 672 skipped | `min-domain-verified` | 已覆盖最后一张预兆抽取后不靠点数直接进入作祟、记录触发预兆与翻牌确认队列；仍缺 UI 承接和更多作祟组合扩审 |

## 6. S0 / 下游缺口清单（不阻塞同层继续）

本节的“缺口”是阶段门禁：不能把未闭合对象升级成整牌库完成，也不能进入 Board/UI、E2E 或截图验收；它不是停工口令。当前没有 S0 图包缺失阻塞，仍可继续在本合同内消费已锁对象、补领域证据、拆 UI/组合缺口和修正状态。

| 缺口项 | 覆盖对象 | 当前层级 / 门禁 | 最小解阻动作 |
| --- | --- | --- | --- |
| 多张新增事件已从 TTS 图包读出、录入配置、补卡面映射并通过运行入口回归，但全分支仍需闭合 | E02/E05/E08/E10-E12/E14-E16/E18/E23/E26/E29/E32/E35/E41 等新增事件 | S1/S2 扩审 | 已通过 `新增配置事件` 定向回归并补一批自动分支状态断言、失败伤害分支代表链、成功属性分支和部分剩余可配置分支代表链；技术难点地下室 fallback 与一罐器官 4+ 抽物品已补；地狱蝙蝠、花团锦簇、秘密升降机、一声呼救、上古旧宅房间目标合法性已补，其中地狱蝙蝠、花团锦簇、秘密升降机、一声呼救和上古旧宅已各有一条 Board 组件目标选择代表链；怪异的镜子接受检定已补 0-4 神志 +1 分支、5+ 进入 7 号代表揭示态、秘密组合私密状态、破咒最小领域链、事件符号房间不抽事件不结束回合、镜中提示最小领域链、镜中怪物最近目标移动 / 平手路径领域代表链和镜中怪物同房神志攻击 / 精神伤害代表链；无线电广播规则结算已补成功知识提升和失败精神伤害 Board 代表链，脚注已裁定为展示/音频提示而非规则结算；下一步补剩余分支、7 号专属移动/目标选择 UI、E2E、截图和组合测试；未完成前只能称为 `in-config / partial` |
| 三张原 `not-in-runtime` 事件配置缺口已解除 | E17「轮到约拿了」/ E20「片刻希望」/ E38「游魂」 | S1/S2 扩审 | 已补静态数据、handler、atlas 映射和最小测试证据；后续只作为整事件池逐张扩审对象，不再按 `not-in-runtime` 接续 |
| 旧 TTS 事件 manifest 原候选漏 frame 42，已补注 | E43 / frame 42 | S0 证据清理 | 已在 `tts-9x5-crop-manifest.json` 补 `gridAudit20260728` 全格扫描字段；原始 `candidateCards` 仍保留 42 个 TTS 候选事实，不再阻塞 E43，也不得再据此误判图包缺素材 |
| 12 张新增物品已进运行池但效果闭合程度不同 | I02/I04/I06/I07/I08/I12/I13/I14/I16/I19/I20/I21 | S1/S2 准入前 | 已从原始 item atlas 锁定标题、frame 和效果子句，并已接发现池和 atlas alias；镜子、恐怖玩偶、幸运硬币、皮夹克、牙齿项链、胸针、枪、十字弓、神秘秒表、电锯、炸药、天使之羽已有最小验证或代表链；幸运硬币已补倒塌房间回合末真实效果链组合；仍需补 UI 承接、更多怪物/作祟组合和剩余物品扩审 |
| 奇怪的护身符已锁 S0，已补被动效果最小领域审计 | I11 | S1/S2 扩审 | 已验证运行时在实际承受物理伤害时获得 1 点神志，并排除通用伤害分配到速度、速度属性直接降低误触发；后续仍需 UI/日志提示、减伤/死亡保护/作祟伤害组合回归 |
| 地图 / 笔记本 / 日记 / 手稿共用 frame/hash | 地图官方物品 I17 及 duplicate aliases | S0 | 已证明图面同为地图卡；`map` 是官方 22 物品之一，`notebook / journal / manuscript` 按 legacy alias 处理，不能再重复计为三张独立官方牌 |
| 灯笼复用手电筒 frame 且不在发现池 | 首剧本起始物 `lantern` | S0 辅助缺口 | 保留为起始持有物 alias，不计入官方 22 物品之外的新牌 |

### 6.1 继续队列拆分（2026-07-29）

本节只拆合同/补证队列，不放行 Board/UI、E2E、截图或新机制实现。当前没有证据显示图包缺整牌库 atlas，也没有证据显示项目正式 atlas 导入错；如果后续要进入 UI 或正式玩法实现，需要另行按对应阶段门禁授权。

| 队列 | 覆盖对象 | 当前能否本地继续 | 下一步最小动作 |
| --- | --- | --- | --- |
| 剩余新增事件分支合同 | E02/E05/E08/E10-E12/E14-E16/E18/E23/E26/E29/E32/E35/E41 等 | 已在 6.3 建成逐事件分支矩阵；不在本轮新增 UI/E2E | 后续消费 6.3 矩阵逐项补组合证据；只把已有证据写成 `min-domain-verified`，未覆盖分支保持 `partial / blocked` |
| 物品组合扩审清单 | 恐怖玩偶、幸运硬币、奇异护符、炸药、天使之羽、枪、十字弓、电锯、皮夹克等 | 已在 6.2 建成“物品 × 消费场景”矩阵；UI 承接需要后续阶段授权 | 后续消费 6.2 矩阵逐项补组合证据；继续区分已过代表链、仍缺 UI、仍缺作祟/死亡保护/怪物组合、仍缺规则裁定，且不得把代表链外推为全组合完成 |
| 预兆后续队列 | 书本、狗、面具、头骨、圣符、盔甲、雕像、指环、匕首 | 逐卡领域证据矩阵已补；6.4 已拆 UI/组合缺口；本轮不重读图包 | 保持两层账本：单卡效果已是 `min-domain-verified / partial-ui`；作祟公共规则已是 `min-domain-verified`；后续消费 6.4 矩阵补 UI 承接、死亡/交易/探索/攻击/作祟组合缺口 |
| 7 号作祟后续队列 | 怪异的镜子触发的 7 号作祟 | 当前只允许维持 `representative / min-domain-verified` 合同；完整实现、UI、E2E、截图均不在本轮 | 把秘密组合、破咒、事件符号房间、镜中提示、镜中怪物移动和神志攻击分别保留为代表链；专属移动/目标选择 UI、完整怪物回合和截图验收继续标为下游缺口 |
| 真正需要用户补充的缺口 | 目前无 S0 图包缺失阻塞 | 暂不需要用户补图才能继续合同整理 | 若后续发现某张完整单卡裁图不可读、原文冲突或 atlas frame 对不上，再点名具体对象、路径和所需补源；当前不应泛泛要求用户重新给整包 |

### 6.2 物品 × 消费场景补证矩阵（2026-07-29）

本矩阵只归档现有 S0 合同、当前本地领域/组件测试证据和仍缺口；不把代表链外推为全组合完成，也不新增 Board/UI、E2E 或截图验收。

| 物品 | 已有消费场景证据 | 当前裁定 | 剩余缺口 / 下一步 |
| --- | --- | --- | --- |
| 魔法相机 | 作祟 setup、灰尘知识检定改用更高神志等现有领域证据 | `covered-by-existing-contract / consumer-review-on-change` | 新增摄影师、作祟或属性检定消费者时再审；不作为本轮缺图或导入阻塞 |
| 恐怖玩偶 | 最近属性检定全骰重掷；事件属性检定可回写原分支，房间回合末入口已开放；Board 组件证明选中后全部骰子均生成重掷目标 | `partial-mechanism-covered / Board component representative / partial-ui` | 真实 Playwright / 截图、作祟特殊行动属性检定通用回滚快照和更多重掷消费者组合仍需补证；固定骰、攻击、作祟检定保持不放行 |
| 奇怪的药品 | 埋葬并治疗当前探索者力量和速度 | `covered-by-existing-contract / consumer-review-on-change` | 新增治疗、交易、死亡保护消费者时再审 |
| 镜子 | 主动埋葬治疗当前探索者知识和神志 | `min-verified / partial-combo` | 更多伤害后治疗、回合时点和作祟状态组合仍需补证 |
| 急救包 | 埋葬治疗自己所有濒死属性；可治疗同板块另一位探索者；不同板块拒绝 | `covered-by-existing-contract / consumer-review-on-change` | 新增同房目标、死亡保护、交易限制消费者时再审 |
| 幸运硬币 | 最近属性检定空白骰重掷；空白精神伤害；倒塌房间回合末速度检定组合已补；Board 组件证明只高亮空白骰、非空白骰不可选 | `combo-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图、作祟特殊行动、死亡保护和更多伤害分配组合回归 |
| 皮夹克 | 防御攻击时额外 1 骰；攻击投骰复盘显示进攻总点、防御总点和防御额外 1 骰 | `min-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图链、更多攻击来源、怪物攻击和作祟攻击组合仍需补证 |
| 牙齿项链 | 回合结束存在濒死属性时可选一项提升 1 步；非法选择拒绝；可跳过；Board 组件面板允许直接跳过或选择濒死属性确认 | `min-domain-verified / min-ui-representative / partial-combo` | 真实 Playwright / 截图链、作祟回合、房间回合末和死亡保护相关结束回合组合仍需补证 |
| 手电筒 | 事件属性检定额外 2 骰；不能主动用作通用移动/属性加成 | `covered-by-existing-contract / consumer-review-on-change` | 新增事件属性检定消费者时再审 |
| 头戴耳机 | 精神伤害降低 1；不会阻挡知识属性直接降低 | `covered-by-existing-contract / Board component representative / consumer-review-on-change` | 真实 Playwright / 截图链、更多精神伤害来源、减伤叠加和死亡保护组合仍需补证 |
| 地图 | 主动埋葬并放置到任意已发现房间；`notebook / journal / manuscript` 复用同 frame | `covered-by-existing-contract / duplicate-alias-guarded` | 新增地图移动消费者时再审；alias 不得重复计数为官方独立牌 |
| 奇异护符 | 实际承受物理伤害后神志 +1；排除通用伤害分配到速度和速度属性直接降低 | `min-domain-verified / partial-ui` | UI/日志提示、减伤/死亡保护/作祟伤害组合回归 |
| 胸针 | 物理或精神伤害可声明改成通用伤害；未声明仍按原类型限制分配；Board 组件伤害分配页可开启胸针并提交 `useBrooch: true` | `min-domain-verified / min-ui-representative / partial-combo` | 真实 Playwright / 截图链、更多伤害来源、减伤叠加、强制伤害顺序、死亡保护和作祟伤害组合回归 |
| 枪 | 视线目标速度攻击；失败不反伤；本回合用后不可交易 | `min-verified / partial-combo` | 枪攻击 UI、怪物目标、视线边界和作祟攻击组合回归 |
| 十字弓 | 同板块或相邻板块速度攻击；失败不反伤；不按视线武器处理 | `min-verified / partial-combo` | 怪物目标、相邻边界和 UI 组合回归 |
| 兔脚 | 事件/房间/攻击/死亡保护等多类最近投骰重掷代表链已有覆盖 | `broad-domain-covered / consumer-review-on-change` | 新增骰子消费者必须逐项确认是否允许兔脚重掷，不能默认全开 |
| 骨制钥匙 | 可穿墙移动到已发现相邻板块；投到空白会埋葬；不能发现新房间；当前树已补真实页面穿墙移动代表链 | `L3 representative / partial-combo` | 墙体 / 门位 / 同层 / 相邻限制全组合、作祟地图规则、特殊移动限制和埋葬随机分支仍需再审 |
| 神秘秒表 | 作祟前禁用；作祟后埋葬并在当前回合结束后再行动一轮；未用正常交接 | `min-verified / min-ui-representative / partial-combo` | 页面代表链已补；更多作祟、怪物回合、房间回合末和结束回合组合回归 |
| 砍刀 | 显式作为攻击武器使用；攻击结果 +1；未声明不会自动生效；用后不可交易 | `covered-by-existing-contract / partial-combo` | 更多攻击来源、怪物攻击和多武器互斥组合回归 |
| 电锯 | 显式攻击时额外 1 骰；用后不可交易 | `min-verified / partial-combo` | 更多攻击来源、多武器互斥和怪物目标组合回归 |
| 炸药 | 代替常规攻击；当前/相邻已发现板块目标；埋葬；板块内每名探索者/怪物分别速度检定；Board 主动作进入房间目标态 | `min-domain-verified / min-ui-representative / partial-combo` | 真实 Playwright / 截图链、非法原因展示、更多怪物/作祟组合和特殊免疫边界回归 |
| 天使之羽 | 埋葬后选择 0-8 作为下一次非战斗属性检定投骰结果；仍叠加属性加值；固定骰不消费 | `min-domain-verified / min-ui-representative / partial-combo` | 页面 0-8 数字选择已补；攻击/作祟检定边界、房间回合末组合、额外骰是否属于相关属性加成的规则裁定仍待补 |

### 6.3 新增 / 补录事件分支补证矩阵（2026-07-29）

本矩阵只覆盖从旧运行池外补入或曾为缺口的 20 张事件；旧 23 张事件仍按各自已锁合同和“新增消费者再审”口径处理。矩阵中的 `min-verified` 只表示已有本地领域或组件代表链，不表示 UI/E2E/截图或所有组合完成。

| 事件 | 已有分支/场景证据 | 当前裁定 | 剩余缺口 / 下一步 |
| --- | --- | --- | --- |
| 不可能的房间 | 4+ 抽物品、0-3 骰子精神伤害均有状态断言；Board 组件代表链已补成功抽物品和失败精神伤害反馈 | `min-branch-verified / Board component representative / partial-ui` | 抽物品牌堆耗尽、精神伤害减免/死亡保护组合、真实入口 E2E / 截图 |
| 地狱蝙蝠 | 4+ 相邻板块放置、0-3 物理伤害、非相邻/未发现非法目标拒绝；Board 组件代表链已证明相邻候选高亮、非相邻 / 跨楼层候选不显示、目标点击后当前位置更新和 0-3 物理伤害确认步骤 | `min-branch-verified / Board component representative / partial-ui` | 非法目标提示 UI、更多房间连接边界、作祟地图限制、伤害减免/死亡保护组合、真实入口 E2E / 截图 |
| 断手 | 接受承受 2 点物理伤害并抽物品；拒绝无事发生；Board 组件代表链已补确认/拒绝按钮、拒绝无事发生、接受后的物理伤害 + 抽物品反馈和持有区写入 | `min-branch-verified / Board component representative / partial-ui` | 伤害不足、死亡保护、胸针/奇异护符/盔甲等伤害改写组合、物品牌堆耗尽、真实入口 E2E / 截图 |
| 怪异的镜子 | 拒绝抽物品；0-4 神志 +1；5+ 进入 7 号代表揭示态；7 号秘密组合/破咒/事件符号跳过/镜中提示/镜中怪物移动与神志攻击均有最小领域链 | `haunt-7-representative / min-domain-verified / partial-ui` | 完整 7 号作祟、专属移动/目标选择 UI、E2E、截图、完整怪物回合组合 |
| 花团锦簇 | 通用伤害分配；地面/地下室放置；上层非法；温室已发现时强制温室；Board 组件代表链已证明地面 / 地下室候选、上层候选不显示、温室强制覆盖、目标点击后通用伤害分配和移动反馈 | `min-branch-verified / Board component representative / partial-ui` | 非法原因 UI、通用伤害死亡保护、更多温室 / 楼层 / 死亡保护组合、真实入口 E2E / 截图 |
| 晦暗暴风夜 | 4+ 神志 +1；0-3 精神伤害 | `min-branch-verified / Board component representative / partial-ui` | Board 组件代表链已补知识检定骰盘、成功神志 +1 和失败精神伤害反馈；仍缺精神伤害减免、死亡保护、神志上限、重掷组合、真实入口 E2E 和截图 |
| 技术难点 | 下一楼层起始点移动；地下室 fallback 到上层起始点并承受 1 点精神伤害 | `min-verified / Board component representative / partial-ui` | Board 组件代表链已补地面层到地下室起始点、地下室 fallback 到上层起始点和地下室 1 点精神伤害反馈；仍缺更多楼层边界、精神伤害减免/死亡保护组合、真实入口 E2E / 截图 |
| 佳馔满桌 | 知识/神志二选一检定；5+ 速度 +1；0-4 通用伤害代表链；Board 组件代表链已覆盖属性选择、成功速度 +1 和失败通用伤害分配路径 | `min-branch-verified / Board component representative / partial-ui` | 速度上限、通用伤害死亡保护、祝福与重掷组合和真实入口 E2E / 截图 |
| 禁忌知识 | 4+ 知识 +1；2-3 知识 +1 且神志 -1；0-1 双骰精神伤害；Board 组件代表链已覆盖 2-3 分支神志检定结果、0-1 双骰精神伤害结果和确认步骤 | `min-branch-verified / Board component representative / partial-ui` | 属性上下限、直接属性降低致死、精神伤害减免、死亡保护、重掷/替代组合和真实入口 E2E / 截图 |
| 可怜的尤里克 | 4+ 知识 +1；0-3 精神伤害；Board 组件代表链已覆盖 4+ 知识提升和 0-3 精神伤害分支的神志检定结果与确认步骤 | `min-branch-verified / Board component representative / partial-ui` | 知识上限、精神伤害减免、死亡保护、重掷/替代组合和真实入口 E2E / 截图 |
| 轮到约拿了 | 非武器物品筛选、弃置选择、神志提升、拒绝后精神伤害；Board 组件代表链已覆盖非武器物品候选、武器排除、未选确认禁用、选择地图后的指令派发和拒绝后的精神伤害确认步骤 | `min-verified / Board component representative / partial-ui` | 无非武器物品 UI、已用/不可交易限制、弃置终点可见性、精神伤害减免、死亡保护和真实入口 E2E / 截图 |
| 秘密升降机 | 不同区域任意已发现板块放置；同区域/未发现非法目标拒绝；Board 组件代表链证明不同区域已发现候选展示与同区域候选不显示 | `min-branch-verified / Board component representative / partial-ui` | 非法原因 UI、更多区域 / 楼层 / 未发现组合、作祟地图限制、移动后续反馈和真实入口 E2E / 截图 |
| 片刻希望 | 房间祝福标记、同位置英雄属性检定加骰 | `min-verified / Board component representative / partial-combo` | 房间祝福标记 UI 已有 Board 组件代表链；仍缺加骰可见性、兔脚/恐怖玩偶/幸运硬币/天使之羽等重掷组合 |
| 神秘液体 | 拒绝路径；接受后 0-6 全骰值属性变化均有断言；Board 组件代表链已覆盖拒绝不投骰与喝下后固定 3 骰结果承接 | `min-branch-verified / Board component representative / partial-ui` | 属性上限/下限、直接属性降低致死、死亡保护、固定骰重掷组合和真实入口 E2E / 截图 |
| 游魂 | 埋葽物品获得任意属性；拒绝后神志检定；成功抽物品；失败通用伤害 | `min-verified / Board component representative / partial-ui` | 已补接受分支物品 / 属性选择 Board 组件代表链；仍缺无物品边界、抽物品 UI、通用伤害组合 |
| 无线电广播 | 3-4 知识 +1；0-2 骰子精神伤害；Board 组件代表链已覆盖固定 2 骰成功知识提升和失败精神伤害结果；脚注裁定为展示/音频提示而非规则结算 | `min-branch-verified / Board component representative / footnote-contract-set / partial-ui` | 脚注展示或音频资源接入授权；精神伤害减免/死亡保护、固定骰/最近投骰重掷准入和真实入口 E2E / 截图 |
| 摇曳灯光 | 速度/力量二选一检定；5+ 速度 +1；0-4 物理伤害代表链；祝福加骰代表链；Board 组件代表链已覆盖速度/力量选择和速度成功检定结果承接 | `min-branch-verified / Board component representative / partial-ui` | 速度上限、祝福与重掷/替代组合、物理伤害减免/死亡保护和真实入口 E2E / 截图 |
| 一罐器官 | 4+ 抽物品；0-3 力量 -1；Board 组件代表链已覆盖成功抽物品和失败力量降低分支 | `min-branch-verified / Board component representative / partial-ui` | 物品牌堆耗尽、属性下限、直接属性降低致死、死亡保护和真实入口 E2E / 截图 |
| 一声呼救 | 4+ 同区域任意板块放置；0-3 精神伤害；不同区域/未发现非法目标拒绝；Board 组件代表链已补同区域房间候选、目标点击结算和失败精神伤害承接 | `min-branch-verified / Board component representative / partial-ui` | 非法原因 UI、精神伤害组合、更多区域边界和真实入口 E2E / 截图 |
| 着火的人 | 4+ 神志 +1；2-3 移动到入口大厅；0-1 物理+精神双伤害；Board 组件代表链已覆盖 2-3 移动分支神志检定结果、确认步骤、当前位置更新和 0-1 双伤害反馈 | `min-branch-verified / Board component representative / partial-ui` | 双伤害分配顺序、双伤害减免、死亡保护和真实入口 E2E / 截图 |

### 6.4 预兆 / 作祟后续缺口矩阵（2026-07-29）

本矩阵承接 5.0 和 5.1：预兆逐卡效果已是本地领域代表链，作祟公共规则也已有最小领域代表链；这里仅拆剩余 UI/组合缺口，不重新录入牌名、原文或 atlas。

| 对象 / 公共规则 | 已有领域证据 | 当前裁定 | 剩余缺口 / 下一步 |
| --- | --- | --- | --- |
| 书本 | 知识检定 +1；每回合一次失去 1 点神志并让下一次非战斗检定可用知识替换；战斗对攻不替换；神志临界时拒绝支付成本 | `min-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图链、更多非战斗检定消费者、房间检定、作祟特殊行动检定和重掷 / 替代消费者组合 |
| 狗 | 速度检定 +1；每回合一次 4 格内交易，需对方同意并沿用交易限制 | `min-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图链、更多距离边界、死亡/搜尸/作祟状态、收到牌本回合使用限制 UI |
| 面具 | 速度检定 +1；每回合一次移动同板块其他探索者和怪物到相邻已发现板块 | `min-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图链、怪物回合、死亡目标、不能发现新板块边界 |
| 头骨 | 知识检定 +1；死亡前 3 骰保护；兔脚可重掷死亡保护骰 | `min-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图链、更多致死来源、作祟终局和遗物掩埋组合 |
| 圣符 | 神志检定 +1；发现板块时可埋葬第一张板块并继续发现下一张；本回合刚获得不能用 | `min-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图链、更多房间/事件/作祟探索组合和牌堆顺序边界 |
| 盔甲 | 物理伤害 -1；不阻挡通用伤害或直接属性降低 | `min-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图链、更多物理伤害来源、死亡保护和作祟伤害组合 |
| 雕像 | 力量检定 +1；发现事件符号板块时可选择不抽事件且不结算事件效果 | `min-domain-verified / Board component representative / partial-ui` | 真实 Playwright / 截图链、更多事件牌堆顺序、作祟探索和无事件符号拒绝 UI 组合 |
| 指环 | 神志检定 +1；显式作为攻击武器时双方用神志对攻并造成精神伤害 | `min-domain-verified / partial-ui` | 攻击 UI、怪物目标、多武器互斥、未声明不自动生效组合 |
| 匕首 | 显式作为攻击武器；使用时失去 1 点速度并额外 2 骰，造成物理伤害 | `min-domain-verified / partial-ui` | 攻击 UI、速度濒死/死亡保护、多武器互斥和怪物目标组合 |
| 抽到预兆后的作祟检定 | 抽新预兆进入作祟检定，记录来源预兆和翻牌确认队列 | `min-domain-verified / partial-ui` | 作祟风险 UI、翻牌确认 UI、事件型作祟入口组合 |
| 全员当前持有预兆总数 | 作祟风险按所有玩家当前持有预兆总数派生；交易转移后仍按全员总数；Board 组件代表链已覆盖狗交易预兆后风险条刷新 | `min-domain-verified / Board component representative / partial-ui` | 死亡掉落/遗物转移/搜尸和更多作祟状态风险 UI 组合 |
| 5+ 开始作祟 | 普通预兆 5+ 触发作祟并记录剧本卡、揭秘者、触发预兆 | `min-domain-verified / partial-ui` | 作祟揭示 UI、首玩家/叛徒裁定显示、更多剧本入口组合 |
| 最多 8 骰 | 全员持有 9 张预兆时请求总数为 9，但实际最多投 8 骰 | `min-domain-verified / partial-ui` | 骰数上限 UI 显示、更多超 8 风险组合 |
| 最后一张预兆自动作祟 | 最后一张预兆抽取后不靠点数直接进入作祟，记录触发预兆与翻牌确认队列 | `min-domain-verified / partial-ui` | 自动作祟 UI、作祟前最后一张被交易/死亡掉落后的组合扩审 |

### 6.5 用户产物要求自检（2026-07-29）

本节只验收“合同层 / 补证层”的产物，不把 Board/UI、E2E、截图或完整机制实现作为本轮完成证据。当前机器复核到对象全集行数为 74 行：事件 43、物品 22、预兆 9；字段完整性复核显示 74 行均为 11 列，无缺合同状态、无缺下一步字段。

| 用户要求 | 当前合同证据 | 当前裁定 | 未闭合边界 / 下一步 |
| --- | --- | --- | --- |
| 新建或更新整牌库 S0 数据录入合同 | 本文件即主合同；顶部已锁定主范围、真相源、当前状态和禁止升级口径 | `pass / in-progress-contract` | 后续继续在本文件追加对象级补证，不另起当前运行池冒充全集 |
| 官方 74 张逐卡对象全集，分事件 43 / 物品 22 / 预兆 9 | 第 3/4/5 节逐行记录 E01-E43、I01-I22、O01-O09；机器复核 74 行 | `pass` | 这只证明对象全集入账，不证明逐卡机制/UI/测试完成 |
| 每张牌至少记录名称、类别、来源、规则/效果、素材槽位、运行状态、后续实现需求、合同状态、阻塞原因和下一步 | 第 3/4/5 节表头覆盖这些字段；未能从图包锁定英文名的对象显式写 `未锁定 / 未锁英文名`，不猜补 | `pass / partial-fields-explicit` | 英文名或原文名未从图包锁定时继续保持未锁，不用百度或社区资料补成 locked |
| 当前 23 事件 / 12 物品 / 9 预兆与官方 74 张做差异表 | 0.3 原审计入口基线差异和第 1 节当前工作区差异已记录：原始缺口 20 事件 + 10 物品；当前配置数 43/22/9 | `pass` | 当前配置数对齐不倒推旧缺口不存在，也不等于机制/UI/测试闭合 |
| 物品牌核对运行池、裁图 manifest、atlas alias 的 duplicate-alias 或名字不一致 | 0.1、4.1、6.2 已记录物品 atlas 0-21 正面、22 空格、23 背面；`map/notebook/journal/manuscript` 与 `flashlight/lantern` 按 legacy / duplicate alias 裁定 | `pass` | legacy alias 仍可作为首剧本起始/历史运行对象，但不计入官方 22 张独立牌 |
| 事件牌核对官方 43、当前运行 23、TTS 9x5 manifest 42 候选之间差异 | 0.1、0.3、3.1 已记录旧 `candidateCards=42` 来自 `ContainedObjects` 扫描口径；原始 atlas 全格扫描锁定 frame 42 为「最深的壁橱」，frame 43 空格，frame 44 背面 | `pass` | 旧 manifest 事实保留，但不再阻塞 E43，也不能据此说图包缺事件 |
| 预兆拆成 9 张逐卡效果合同 + 作祟公共规则合同 | 第 5 节 O01-O09；5.0 逐卡领域证据矩阵；5.1 作祟公共规则；6.4 后续 UI/组合缺口矩阵 | `pass / downstream-partial` | 作祟检定、全员当前持有预兆总数、最后一张自动作祟属于公共规则，不归并成任一单张预兆 |
| 不写 Board/UI，不实现新卡牌效果/房间/作祟/剧本逻辑，不跑 E2E 或截图 | 本文件 7、8 节禁止升级结论；当前改动只落 evidence / temp 状态，未新增 UI/E2E/截图证据 | `pass` | 若后续要进入 UI/E2E/截图，必须另按对应门禁授权 |
| 资料不够时保持 S0/in_progress，不编造牌名、效果或槽位 | 顶部与第 8 节统一为 `in_progress / downstream-gated`（历史旧别名：`downstream-blocked`）；该状态仅拦收口，不拦继续补证 | `pass` | 当前没有 S0 图包缺失或导入错误阻塞；若后续发现单卡不可读或 frame 冲突，再点名具体对象和路径 |

### 6.6 源码覆盖只读复核（2026-07-29）

本节只读当前源码，不改运行配置。复核目标是防止后续把合同数量、运行池数量、atlas 映射或 alias 口径再次混淆。第一次粗脚本曾把「吊死鬼」事件内部效果块的 `name` 误计成第二张事件；复核脚本已改为只统计 `events` 顶层卡对象。

| 复核对象 | 当前源码证据 | 复核结论 | 继续边界 |
| --- | --- | --- | --- |
| 初始牌堆数量 | `BETRAYAL_SHARED_PRE_HAUNT_SETUP.initialDeckCounts`：预兆 9、物品 22、事件 43 | `matched-official-counts` | 只证明 setup 数量；不证明逐卡机制/UI/测试完成 |
| 当前发现池顶层对象数 | `BETRAYAL_DISCOVERY_POOLS.possessions.item` 顶层 22；`omen` 顶层 9；`events` 顶层 43 | `matched-runtime-counts` | 顶层事件计数必须排除事件内部 effect `name` 字段，避免把「吊死鬼」内部效果名误判成 duplicate runtime event |
| 事件 atlas 映射 | `EVENT_FRONT_FRAME_BY_TITLE` 43 个标题，唯一 frame 0-42；当前事件顶层标题无缺失、无多余 atlas 标题 | `matched-event-atlas` | 事件 atlas 映射齐不等于每张事件分支/UI/组合测试齐 |
| 物品 atlas 映射 | 物品视觉映射 26 个运行 id；其中官方发现池 22 个物品 id 全部有 visual，且唯一覆盖 item frame 0-21 | `matched-official-item-visuals` | 26 个运行 id 包含 legacy alias；不能按 26 张官方物品计数 |
| 物品 duplicate / legacy alias | item frame 8：`flashlight / lantern`；item frame 16：`map / notebook / journal / manuscript` | `duplicate-alias-guarded` | `lantern / notebook / journal / manuscript` 只保留为历史/首剧本 alias，不计入官方 22 张独立牌 |
| 预兆 atlas 映射 | 预兆 visual 9 个运行 id，唯一覆盖 omen frame 0-8；无 duplicate frame group | `matched-omen-visuals` | 第 9 以外的预兆 atlas frame 是牌背/非正面，不作为第 10 张预兆 |

### 6.7 证据文件 → 字段覆盖索引（2026-07-29）

本节用于后续接续时快速判断“某个证据能证明什么、不能证明什么”。任何证据都只能覆盖它直接证明的字段，不能外推为整牌库完成。

| 证据文件 / 入口 | 证明的现实字段 | 不能证明的内容 | 后续使用口径 |
| --- | --- | --- | --- |
| `temp/betrayal-full-deck-s0-consistency-audit-2026-07-29.json` | 合同对象行数 74；事件 43、物品 22、预兆 9；事件 frame 0-42；官方运行物品唯一 frame 0-21；预兆 frame 0-8 | 不证明逐卡效果、UI 承接、E2E、截图或完整作祟实现 | 可作为 S0 数量 / atlas / alias 一致性机器复核入口 |
| `temp/betrayal-asset-source-diagnostics-2026-07-28/source-atlas-diagnostics.json` | E43 frame 42 的裁图 bbox、尺寸与 hash；物品 frame 0-21 的裁图路径、bbox、尺寸与 hash | 不证明运行时已经消费每张卡的规则效果；也不证明 UI 呈现正确 | 只用于“图包是否缺素材 / atlas 是否导入错 / frame 是否存在”的字段 |
| `temp/betrayal-event-front-atlas-2026-07-03/event-08-tts-9x5-2026-07-04/tts-9x5-crop-manifest.json` | 旧 TTS `ContainedObjects` 候选为 42；补充 `gridAudit20260728` 后覆盖 45 个 atlas 格，frame 42 是事件正面、frame 43 空格、frame 44 背面 | 原始 `candidateCards=42` 不能证明事件只有 42 张；旧候选列表不能覆盖官方 43 张全集 | 引用时必须同时说明旧候选口径和本轮全格扫描补注，不能只引用 42 候选 |
| `temp/betrayal-possession-contract-crops/manifest.json` | 旧物品/预兆裁图批次、旧 12 个物品行、部分预兆/物品 crop 与 hash | 不证明官方 22 张物品全集；不证明 `strange-amulet` 等后补 frame 已在旧 manifest 原始行内 | 只能作为旧裁图 manifest 对照；官方 22 物品以正式 atlas、源码 visual 和本合同为准 |
| `src/games/betrayal/scenarioConfig.ts` | 当前顶层运行池数量、初始牌堆数量、事件/物品/预兆运行对象名称 | 代码配置不能替代图包主真相源，也不能证明 UI/E2E 完成 | 只作为当前工作区运行覆盖对照；不得倒推旧审计入口缺口不存在 |
| `src/games/betrayal/discoveryAtlas.ts` | 事件标题到 `event-front-atlas` frame 的运行时映射；当前 43 标题唯一覆盖 frame 0-42 | 不证明事件效果分支、作祟特例、UI 或组合测试闭合 | 用于事件卡面 frame 接线核对 |
| `src/games/betrayal/possessionAtlas.ts` | 物品/预兆运行 id 到 atlas frame 的映射；官方 22 物品覆盖 item frame 0-21；预兆覆盖 omen frame 0-8；legacy alias 分组 | 不证明每张物品/预兆效果完整；不证明 alias 是独立官方牌 | 用于物品/预兆卡面 frame 接线和 duplicate-alias 裁定 |
| `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 中的定向领域测试记录 | 已锁对象的最小领域代表链，例如物品代表效果、新增事件部分分支、作祟公共规则、7 号代表链 | 不证明 Board/UI、E2E、截图，也不证明整牌库所有组合完成 | 只能把对应对象提升为 `min-domain-verified / partial-ui` 或类似局部状态 |
| `src/games/betrayal/__tests__/Board.foundation.test.tsx` 中的定向组件测试记录 | 局部组件承接，例如候选列表、物品选择或最近投骰提示的现有代表链 | 不证明真实入口 E2E 或截图验收，也不证明 UI 完整 | 只能作为局部 UI/组件证据；本轮不新增或要求截图 |
| `evidence/betrayal/full-audit/runtime-implementation-consumption-audit-2026-07-29.md` | 下游实现消费审计索引：列出现有领域代表链、局部组件承接、木乃伊首剧本代表链、木乃伊怪物行动真实入口截图链和未来 UI/E2E 缺口 | 不证明 S0 对象全集；不证明整牌库端到端完成；其中 E2E/截图记录不属于当前合同续跑动作 | 只能作为未来 S3/S4 或实现消费审计入口；当前 S0/S1/S2 合同续跑不得据此运行 E2E、补截图或宣称完成 |
| `evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md` | 43 张事件牌下游效果消费索引：旧 23 张代表链、20 张新增/复杂事件入口、关键分支、房间目标合法性和残余组合缺口 | 不证明 S0 对象全集；不证明 43 张事件逐事件 UI、真实入口 E2E、截图或事件牌全部完成；不授权新增事件实现 | 只能作为 6.12 事件缺口桶的专项证据入口；后续仍按 `min-domain-verified / partial-ui / downstream-open` 维护 |
| `evidence/betrayal/full-audit/item-effect-implementation-audit-2026-07-29.md` | 22 张官方物品牌下游效果消费索引：主动使用、攻击武器、重掷、伤害改写/减免、额外行动、炸药、天使之羽等消费桶状态 | 不证明 S0 对象全集；不证明逐物品 UI、组合回归、真实入口 E2E、截图或物品牌全部完成；不授权新增物品实现 | 只能作为 6.13 物品消费场景缺口桶的专项证据入口；新增消费者仍需回到主合同逐项再审 |
| `evidence/betrayal/full-audit/omen-and-haunt-rule-implementation-audit-2026-07-29.md` | 预兆逐卡效果与作祟公共规则的下游实现消费索引：9 张预兆 L1/L2 代表链、全员预兆数、抽新预兆骰数、8 骰上限、普通触发、最后一张自动作祟和翻牌确认队列 | 不证明 74 张对象全集；不证明预兆 UI、作祟揭示 UI、真实入口 E2E、截图或完整 7 号 / 木乃伊流程 | 只能作为 6.14 预兆/作祟缺口桶的专项证据入口；后续仍保持 `min-domain-verified / partial-ui / downstream-open` |
| `evidence/betrayal/full-audit/room-effect-implementation-audit-2026-07-29.md` | 房间效果下游实现消费索引：当前 42 个房间中 11 个显式效果房间、触发时机、领域/页面代表链和残余组合缺口 | 不证明发现牌 74 张对象全集；不证明房间 atlas/门位/无效果房间视觉全部完成；不证明真实入口 E2E、截图或整牌库完成 | 只能作为未来房间效果矩阵入口；当前发现牌整牌库合同仍以本文件 0-6.18 节为准 |
| `docs/games/betrayal/intake-contract.md` | 首轮素材 intake 入口；2026-07-29 已补整牌库接续裁定，明确当前发现牌主合同迁到本文件 | 不证明整牌库完成；旧“后续实施入口”和旧“其它物品正面待确认”不能覆盖本合同 22 张物品 frame 0-21 的裁定 | 只能作为历史素材来源和首轮资源白名单入口；涉及发现牌整牌库时必须回到本合同和 6.18 |
| `docs/games/betrayal/master-spec-view.md` | 整游戏主视角、历史 change 汇总、随机化 / 首剧本 / 教程等整体缺口说明；2026-07-29 已补接续边界 | 不证明发现牌 74 张对象全集完成；旧 `12 张物品 / 23 张事件 / 发现池已完成第一层收口` 不能覆盖当前 43/22/9 主合同；不证明逐卡机制、UI、E2E 或截图完成 | 只能作为整游戏缺口导航；发现牌整牌库数量、atlas、alias 和合同状态必须回到本合同 0-6.18 节 |
| `docs/games/betrayal/full-rule-interaction-redesign.md` | 全规则交互重设计账本；2026-07-29 已补历史 `23 事件 / 12 物品 / 23 运行持有牌` 口径修正 | 不证明发现牌 74 张对象全集完成；不证明所有规则、全部事件/物品/预兆 UI、E2E 或截图完成 | 可作为规则交互导航和后续实现设计参考；发现牌数量、图包、atlas、对象状态仍以本合同为准 |
| `docs/games/betrayal/interaction-redesign-coverage-matrix.md` | P0 交互覆盖矩阵与历史代表链记录；2026-07-29 已补历史数量口径修正 | 不证明发现牌 74 张对象全集完成；不证明 P0 之外规则、全部持有物/事件/房间/作祟或当前 UI/E2E/截图完成 | 只能作为已登记交互切片和旧代表链证据；引用发现牌整牌库时必须回到本合同和 6.18 |

### 6.8 当前续跑分层队列（2026-07-29）

本节回答“现在还能继续做什么、什么时候才需要用户介入”。当前没有图包缺失、atlas 导入错误或 74 张对象全集缺行；因此不得泛泛要求用户补整包素材。后续工作必须按层级推进，不能因为某个下游缺口存在，就把当前合同层误判为停工。

| 层级 | 覆盖对象 / 证据 | 当前是否能继续 | 允许动作 | 禁止 / 完成边界 |
| --- | --- | --- | --- | --- |
| 合同维护与证据索引 | 74 张对象全集、S0 一致性 JSON、source atlas diagnostics、事件/物品/预兆 atlas、legacy alias | 可以继续 | 只读复核、字段完整性检查、证据覆盖范围索引、alias / frame 口径修正、缺口表补强 | 不用百度或社区资料补英文名/效果；不能把运行池或测试当官方全集 |
| 已锁对象的 S1/S2 证据归档 | 6.2 物品矩阵、6.3 新增事件矩阵、6.4 预兆/作祟矩阵、已有领域/组件代表链 | 可以继续归档；若需要新实现则停到后续阶段 | 消费已存在的合同、只读代码、既有领域证据，把对象状态写清为 `min-domain-verified / partial-ui / partial-combo` 等 | 不新增 Board/UI；不把代表链外推为全组合完成；不为了补证临时实现卡牌/房间/作祟逻辑 |
| 下游实现消费审计索引 | `runtime-implementation-consumption-audit-2026-07-29.md`、木乃伊首剧本代表链、木乃伊怪物行动真实入口截图链、局部组件承接材料 | 只能作为索引继续整理 | 标注哪些证据属于未来 S3/S4，哪些只能证明局部承接 | 不在当前合同续跑里执行 E2E、补截图、打开验收图或宣称端到端完成 |
| 需要后续阶段授权 | UI 承接、真实入口 E2E、截图验收、完整木乃伊流程、完整 7 号作祟、脚注音频/展示接入 | 当前不执行 | 只登记为下游缺口，等用户明确授权后按对应门禁推进 | 不能用已有局部测试、旧截图或审计文档替代真实 UI/E2E/截图验收 |
| 需要用户补源 / 裁定 | 仅限未来发现具体单卡不可读、frame/hash 对不上、原文冲突、用户指定替代权威来源 | 当前没有 | 若出现，必须点名具体对象、路径、冲突字段和最小补源动作 | 不得泛泛要求用户重新给整包；不得因普通 `partial-ui` / `partial-combo` 缺口请求补图 |

### 6.9 完成口径审计表（2026-07-29）

本节把“已经完成的合同层工作”和“仍不能宣称完成的下游工作”分开。结论：当前没有卡在 S0 图包或导入问题；当前仍不能把整牌库标为完成，也不能进入 UI/E2E/截图验收口径。

| 完成口径 / 门禁 | 当前证据 | 裁定 | 不能外推的范围 / 下一步 |
| --- | --- | --- | --- |
| S0 对象全集是否成立 | 第 3/4/5 节已有 E01-E43、I01-I22、O01-O09；机器复核 74 行，事件 43、物品 22、预兆 9，无重复 id、无坏行 | `pass` | 只证明对象全集、数量、来源和槽位入账，不证明逐卡效果和 UI/测试闭合 |
| 图包是否缺整牌库素材 | 本合同 0.1/0.2/3.1/4.1：事件 atlas 43 正面 + 空格 + 背面；物品 atlas 22 正面 + 空格 + 背面；预兆 atlas 9 正面；项目 atlas 与用户 Mods/Images 原图 hash 一致 | `pass` | 不需要用户补整包素材；若后续发现单卡不可读，只能点名具体对象和路径 |
| 当前运行池数量是否对齐官方 74 | 6.6 只读复核：initialDeckCounts 9/22/43，顶层发现池 22 物品 / 9 预兆 / 43 事件 | `pass / coverage-count-only` | 运行池数量对齐不能证明机制、UI、E2E 或截图完成 |
| 旧缺口原因是否解释清楚 | 0.3 和 6.7：原审计入口 23 事件 / 12 物品 / 9 预兆；旧事件 manifest `candidateCards=42` 是 `ContainedObjects` 口径漏 frame 42；物品旧缺口来自旧运行池与 legacy alias 口径 | `pass` | 旧缺口被解释不等于下游全部实现完成 |
| 物品 duplicate / legacy alias 是否闭合 | 4.1、6.2、6.6：`flashlight/lantern` 共 frame 8；`map/notebook/journal/manuscript` 共 frame 16；legacy alias 不计入官方 22 张独立牌 | `pass` | alias 裁定只解决计数和素材映射，不解决每张物品所有组合消费 |
| 事件 43 / 原运行 23 / 旧 manifest 42 候选差异是否闭合 | 0.1、0.3、3.1、6.7 均记录同一差异链；E43 frame 42 已由原始 atlas 锁定 | `pass` | 事件配置和 frame 齐不等于 43 张事件所有分支、UI 和组合测试完成 |
| 9 张预兆和作祟公共规则是否分层 | 第 5 节对象表、5.0 逐卡领域证据矩阵、5.1 公共规则合同、6.4 后续缺口矩阵 | `pass / downstream-partial` | 单卡效果和公共作祟规则仍缺 UI 承接、更多组合和真实入口验收 |
| 已锁对象 S1/S2 证据归档是否可继续 | 6.1-6.8 已拆出物品、事件、预兆/作祟和下游实现消费索引；本节 6.9 已补完成口径审计 | `pass / continue` | 可以继续合同维护和证据归档；若要新增实现、UI、E2E 或截图，必须另按后续阶段授权 |
| 整牌库是否可以标 complete | 仍有事件/物品逐卡机制、UI 承接、组合测试、完整 7 号作祟、预兆 UI/组合和真实入口验收缺口 | `not-complete` | 保持 `in_progress / downstream-gated`（历史旧别名：`downstream-blocked`），不能用 S0 通过、运行池数量、局部领域测试或旧截图替代完成 |

### 6.10 合同状态分层统计（2026-07-29）

本节解释对象表状态与下游缺口矩阵的关系，避免把 `locked` 误读为“该牌所有机制/UI/测试都完成”。对象表的 `locked` 主要表示 S0 来源、数量、素材槽位和基础字段已锁；下游机制、UI、组合和真实入口缺口以 6.2、6.3、6.4、6.9 为准。

| 统计口径 | 当前结果 | 说明 | 下一步 |
| --- | --- | --- | --- |
| 74 行对象全集 | 事件 43 / 物品 22 / 预兆 9；无重复 id；无坏行 | S0 对象全集成立 | 继续保留同一合同账本，不另起运行池清单冒充全集 |
| 对象表纯 `locked` 行 | 49 行 | 只证明这些行的 S0 合同字段已锁；其中物品和预兆仍可能在 6.2 / 6.4 有 UI 或组合缺口 | 下游状态引用 6.2 / 6.4，不按对象表 `locked` 宣称完成 |
| 对象表非纯 `locked` 行 | 25 行，全部是事件牌 | 这些事件在对象表内直接保留 `partial / min-verified / Board component representative`，因为它们多数来自旧运行池外补录、旧 23 单卡补证或触发作祟/配置分支扩审 | 继续消费 6.3 逐事件矩阵，不新增 UI/E2E/截图 |
| `locked / partial` | 9 张事件：晦暗暴风夜、佳馔满桌、禁忌知识、可怜的尤里克、神秘液体、无线电广播、摇曳灯光、一罐器官、着火的人 | 已有配置和部分分支/状态代表链；按单对象分别仍缺验证、组合或剩余分支 | 后续按 6.3 补具体分支和组合证据 |
| `locked / partial / Board component representative` | 8 张事件：不可能的房间、地狱蝙蝠、吊死鬼、断手、花团锦簇、轮到约拿了、游魂、一声呼救 | 已有对应 Board 组件代表链；仍不证明真实入口 E2E、截图或全组合 | 后续按单对象补 UI 残余、组合和真实入口 |
| `locked / Board component representative / partial-ui` | 5 张事件：秘密升降机、脑状食品、肉质苔癣、一条秘密通道、上古旧宅 | 已有对应 Board 组件代表链；仍保留 partial-ui 残余边界 | 后续按单对象补 UI 残余、组合和真实入口 |
| `locked / partial / min-domain-verified` | 1 张事件：怪异的镜子 | 7 号作祟相关最小领域代表链已补，但完整 7 号作祟、专属 UI、E2E、截图仍未闭合 | 继续保持代表链状态，不标完整作祟实现 |
| `locked / min-verified` | 2 张事件：技术难点、片刻希望 | 不再按 `not-in-runtime` 接续；已有最小领域/局部 UI 或配置证据 | 后续只在整事件池扩审或新增消费者时回归 |
| 物品 / 预兆对象表均为 `locked` | 22 张物品、9 张预兆 | 这表示 S0 字段和素材/atlas 接线已锁，不表示下游全部完成 | 物品下游看 6.2；预兆与作祟下游看 6.4 |

### 6.11 下一批可执行合同层任务队列（2026-07-29）

本节把 6.2、6.3、6.4、6.9、6.10 的剩余缺口整理成下一批执行队列。当前没有需要用户补整包图包、重新导入 atlas 或重新命名整牌库素材的事项；后续只在出现具体单卡不可读、frame/hash 对不上、规则原文冲突或用户指定替代权威来源时，才点名请求补源或裁定。

| 优先级 | 队列 | 当前可执行动作 | 完成边界 / 禁止外推 |
| --- | --- | --- | --- |
| A | 25 张非纯 `locked` 事件的剩余分支分桶 | 只读消费 6.3：把 17 张含 `partial` 的事件、1 张 `locked / partial / min-domain-verified`、5 张 `Board component representative / partial-ui` 事件、2 张 `locked / min-verified` 事件拆成“剩余分支 / UI 承接 / 组合测试 / 作祟特例”四类缺口，并在每张事件行内保留最小下一步 | 不能新增事件实现、不能跑 E2E/截图、不能把代表链外推为 43 张事件完成 |
| B | 22 张物品的消费场景复核 | 只读消费 6.2：按“攻击武器 / 非攻击使用物 / 检定修正 / 伤害或死亡保护 / 交易限制 / 作祟消费者”归并剩余组合缺口，优先标明哪些对象已经有最小领域证据、哪些只缺 UI 或组合扩审 | 物品对象表 `locked` 只表示 S0 字段和素材接线已锁；不得宣称 22 张物品所有效果都完整闭合 |
| C | 9 张预兆逐卡 UI 与组合缺口 | 只读消费 6.4：逐张保留“领域证据已过 / UI 承接待补 / 交易、死亡、探索、攻击、作祟组合待扩审”的后续状态，不重新 OCR 预兆卡图 | 预兆数量正确和逐卡领域代表链不等于预兆 UI、作祟 UI 或真实入口验收完成 |
| D | 作祟公共规则后续队列 | 继续把“全员当前持有预兆总数、8 骰上限、普通 5+ 作祟、最后一张自动作祟”与未来 UI/组合缺口分离记录；若只做合同层，可继续补字段覆盖索引和后续授权说明 | 作祟公共规则不是任一单张预兆效果；最小领域证据不替代完整 7 号作祟、木乃伊流程、UI 或 E2E |
| E | 下游实现消费审计隔离 | 维护 `runtime-implementation-consumption-audit-2026-07-29.md` 的使用边界，把其中 UI/E2E/截图材料继续标为未来阶段入口 | 当前合同续跑不得执行 UI/E2E/截图，也不得打开验收图或用旧截图收口 |

| 分类 | 当前是否需要用户 | 触发条件 | 最小动作 |
| --- | --- | --- | --- |
| 可继续只读归档 / 合同补强 | 不需要 | 证据已在主合同、atlas、manifest、当前源码或现有 evidence 中 | 继续补对象级缺口分桶、证据索引、状态口径和后续授权边界 |
| 需要后续阶段授权 | 需要另行授权，不是当前阻塞 | 要进入 Board/UI、真实入口 E2E、截图验收、完整作祟实现、脚注音频/展示接入 | 先按对应阶段门禁重新锁定目标和验收，不从 S0/S1/S2 合同队列直接升级 |
| 真实需要用户补源 / 裁定 | 当前没有 | 具体单卡不可读、完整裁图缺失、frame/hash 与项目 atlas 对不上、主图包与其它权威来源冲突、用户要求改用新权威来源 | 点名对象、路径、冲突字段和最小补源动作；不得泛泛要求重给整包 |

下一批合同层默认执行顺序：A 队列的 25 张非纯 `locked` 事件缺口分桶已落到 6.12，B 队列的 22 张物品消费场景分桶已落到 6.13，C/D 队列的预兆逐卡与作祟公共规则分桶已落到 6.14；后续若仍停在合同层，只维护证据索引、状态口径和后续授权边界。若用户明确授权实现、UI、E2E 或截图，才离开本合同层队列进入后续阶段。

### 6.12 A 队列：25 张非纯 `locked` 事件缺口分桶（2026-07-29）

本节只消费 6.3 的既有逐事件矩阵，把下一步拆成可执行的合同层缺口桶；不新增事件实现、Board/UI、E2E、截图，也不重新读取或猜补卡图字段。`UI 承接`、`组合测试`、`作祟特例` 在这里都是后续阶段缺口标签，不是当前动作授权。

| 事件 | 当前合同状态 | 主要缺口桶 | 可继续的合同层动作 | 后续阶段动作 |
| --- | --- | --- | --- | --- |
| 不可能的房间 | `locked / partial / Board component representative` | 抽物品牌堆边界、精神伤害组合、UI/日志承接 | Board 组件代表链已补卡面、神志检定骰盘、成功抽物品进入持有区和失败精神伤害反馈；继续记录抽物品牌堆耗尽、精神伤害减免/死亡保护需要哪些消费者证据 | 抽物品牌堆耗尽、精神伤害减免/死亡保护、更多伤害消费者组合和真实入口 E2E / 截图 |
| 地狱蝙蝠 | `locked / partial / Board component representative` | 房间目标合法性、物理伤害组合、非法提示与作祟地图限制 | 相邻 / 未发现限制已有领域代表链；Board 组件代表链已补相邻候选高亮、非相邻 / 跨楼层候选不显示、目标点击后位置更新和 0-3 物理伤害确认步骤；继续列出门位 / 连接边界扩审点 | 非法目标提示 UI、作祟地图限制、更多连接边界组合和真实入口 E2E / 截图 |
| 吊死鬼 | `locked / partial / Board component representative` | 全属性检定、直接属性降低、奖励属性、死亡保护 | 保留四项属性连续检定、失败属性降低、全通过待选知识 +1 和头骨死亡保护代表链；Board 组件代表链已补全通过奖励属性选择 | 失败属性降低 UI、更多奖励属性、属性上下限、死亡保护/重掷组合和真实入口 E2E / 截图 |
| 断手 | `locked / min-branch-verified / Board component representative` | 伤害消费者、抽物品牌堆边界、真实入口链 | Board 组件代表链已补确认/拒绝按钮、拒绝无事发生、接受后的物理伤害 + 抽物品反馈和持有区写入；继续把胸针、奇异护符、盔甲、死亡保护列成组合消费者 | 伤害不足/死亡边界、伤害改写/减免/死亡保护组合、物品牌堆耗尽和真实入口 E2E / 截图 |
| 怪异的镜子 | `locked / partial / min-domain-verified` | 7 号作祟特例、镜中怪物、专属 UI | 维持代表链状态，分列秘密组合、破咒、镜中提示、事件符号跳过、镜中怪物移动/攻击 | 完整 7 号作祟、专属移动/目标 UI、E2E、截图 |
| 花团锦簇 | `locked / partial / Board component representative` | 楼层/温室目标、通用伤害、Board 目标候选 | 保留温室强制和楼层限制证据；Board 组件代表链已补地面 / 地下室候选、上层候选不显示、温室强制覆盖、目标点击后通用伤害分配和移动反馈；继续登记通用伤害死亡保护消费者 | 非法原因 UI、通用伤害死亡保护、更多温室 / 楼层 / 死亡保护组合和真实入口 E2E / 截图 |
| 晦暗暴风夜 | `locked / partial / Board component representative` | 精神伤害、属性上限、UI/日志 | Board 组件代表链已补知识检定、成功神志 +1 和失败精神伤害反馈；继续列出精神减伤、死亡保护、神志上限消费者 | 精神伤害减免 / 死亡保护、神志上限、重掷组合、真实入口 E2E 和截图 |
| 技术难点 | `locked / min-verified / Board component representative` | 楼层起始点、地下室 fallback、精神伤害 | Board 组件代表链已补地面层到地下室起始点、地下室 fallback 到上层起始点和地下室 1 点精神伤害反馈；继续列出更多楼层边界和精神伤害组合 | 更多楼层边界、精神伤害减免/死亡保护组合、真实入口 E2E / 截图 |
| 佳馔满桌 | `locked / partial / Board component representative` | 二选一检定、速度提升、通用伤害、速度上限/死亡保护 | Board 组件代表链已补选择属性 UI、成功速度 +1 UI 和通用伤害分配失败路径；继续分离速度上限和通用伤害消费者 | 通用伤害组合、速度上限和真实入口 E2E / 截图 |
| 禁忌知识 | `locked / partial / Board component representative` | 多段属性变化、精神伤害、属性上下限/死亡保护 | Board 组件代表链已补 2-3 分支神志检定 UI 和 0-1 双骰精神伤害 UI；继续记录知识提升、神志降低、精神伤害减免 / 死亡保护等消费者组 | 4+ 成功属性上限、直接属性降低致死、精神伤害减免、死亡保护、重掷/替代组合和真实入口 E2E / 截图 |
| 可怜的尤里克 | `locked / partial / Board component representative` | 知识提升、精神伤害、属性上限/死亡保护 | Board 组件代表链已补 4+ 知识提升和 0-3 精神伤害分支 UI；继续归入“成功属性 + 精神伤害”标准桶 | 知识上限、精神伤害减免、死亡保护、重掷/替代组合和真实入口 E2E / 截图 |
| 轮到约拿了 | `locked / min-verified / Board component representative` | 非武器物品筛选、弃置选择、交易限制、精神伤害 | 保留非武器筛选、武器排除、未选确认禁用、选择地图 dispatch 和拒绝精神伤害确认步骤已验；列出无非武器、已用/不可交易、弃置终点可见性、精神伤害减免和死亡保护边界 | 无非武器物品 UI、已用/不可交易限制、弃置终点可见性、精神伤害减免、死亡保护和真实入口 E2E / 截图 |
| 秘密升降机 | `locked / min-branch-verified / Board component representative / partial-ui` | 区域合法性、未发现板块限制、不同区域候选 UI | 保留不同区域/未发现拒绝证据，登记 Board 组件候选代表链，并列出作祟地图限制扩审点 | 非法原因 UI、作祟地图组合、更多区域 / 楼层 / 未发现组合、移动后续反馈、真实入口 E2E / 截图 |
| 一条秘密通道 | `locked / Board component representative / partial-ui` | 知识检定三档、秘密通道标志物、第二目标板块、直接神志降低、移动确认收口 | 保留 5+ 任意另一板块 + 知识 +1、3-4 地面、0-2 地下室 + 神志 -1、非法目标拒绝、发现确认前禁止移动和头骨死亡保护领域代表链；Board 组件代表链已补第二目标房间候选、点击门厅、两个秘密通道标志物和知识 +1 确认步骤 | 非法原因 UI、更多目标范围、秘密通道标志物移动入口真实可用性、属性上下限、直接神志降低致死 / 死亡保护、兔脚 UI / 更多重掷组合和真实入口 E2E / 截图 |
| 脑状食品 | `locked / Board component representative / partial-ui` | 力量检定三档、任选力量/速度、直接属性降低、通用伤害、死亡保护 | 保留力量检定 5+ / 1-4 / 0 三档、缺选择拒绝、头骨死亡保护和兔脚回滚领域代表链；Board 组件代表链已补速度奖励、通用伤害分配和同属性重复分配预览 | 成功力量 UI、属性上下限、直接属性降低致死、通用伤害减免/胸针、兔脚 UI、更多重掷组合和真实入口 E2E / 截图 |
| 片刻希望 | `locked / min-verified / Board component representative` | 房间祝福标记、属性检定加骰、重掷组合 | 记录祝福标记与兔脚/恐怖玩偶/幸运硬币重掷消费者关系；房间祝福标记 UI 已有 Board 组件代表链 | 加骰可见性和重掷组合 |
| 神秘液体 | `locked / partial / Board component representative` | 0-6 骰值分支、固定 3 骰 UI 承接、属性上下限、死亡保护 | 保留 0-6 全分支已验状态；Board 组件代表链已补固定 3 骰 UI 承接；列出属性边界消费者 | 属性边界、死亡保护、固定骰重掷组合和真实入口 E2E / 截图 |
| 游魂 | `locked / partial / Board component representative` | 埋葽物品、任意属性选择、抽物品/通用伤害 | 保留接受/拒绝领域代表链；Board 组件代表链已补候选物品、四项属性候选、双选择确认门禁和 `cardId=map / trait=knowledge` 派发；继续分列无物品、抽物品 UI、通用伤害和物品牌堆耗尽缺口 | 无物品 UI、抽物品 UI / 物品牌堆耗尽、拒绝失败通用伤害 UI、通用伤害死亡保护和真实入口 E2E / 截图 |
| 肉质苔癣 | `locked / Board component representative / partial-ui` | 可选吸入/拒绝、固定 2 骰、任选属性、精神伤害、重掷组合 | 保留不吸入无事发生、吸入后固定 2 骰、成功任选知识 +1、失败精神伤害和兔脚重掷成功保留待选属性领域代表链；Board 组件代表链已补拒绝、成功任选属性和失败精神伤害分支 | 精神伤害减免/死亡保护、属性上限、更多属性选择、兔脚 UI/更多重掷组合和真实入口 E2E / 截图 |
| 无线电广播 | `locked / partial / Board component representative / footnote-contract-set` | 固定 2 骰、知识提升、脚注展示/音频、精神伤害 | Board 组件代表链已补 3-4 知识 +1 成功分支 UI 和 0-2 失败精神伤害 UI；维持脚注为展示/音频提示的裁定，分离规则结算与音频/UI 缺口 | 脚注 UI 或音频资源接入授权；精神伤害减免/死亡保护、固定骰/最近投骰重掷准入和真实入口 E2E / 截图 |
| 摇曳灯光 | `locked / partial / Board component representative` | 二选一检定、物理伤害、祝福加骰、速度上限/死亡保护 | 分离属性选择、物理伤害消费者、祝福加骰消费者；Board 组件代表链已补选择属性 UI | 速度上限、祝福/重掷组合、物理伤害组合和真实入口 E2E / 截图 |
| 一罐器官 | `locked / min-branch-verified / Board component representative` | 抽物品、力量降低、牌堆边界、属性下限/死亡保护 | Board 组件代表链已补 4+ 抽物品进入持有区和 0-3 力量 -1 承接；保留 4+ 抽物品和 0-3 力量 -1 领域已验状态，列出属性下限和牌堆耗尽边界 | 物品牌堆耗尽、属性下限、直接属性降低致死、死亡保护和真实入口 E2E / 截图 |
| 一声呼救 | `locked / partial / Board component representative` | 区域合法性、精神伤害、UI 候选 | 保留同区域/不同区域/未发现限制证据；Board 组件代表链已补卡面、知识检定骰盘、同区域房间候选、不同区域候选不显示、放置到门厅结算和 0-3 精神伤害确认步骤 | 非法原因 UI、精神伤害组合、更多区域边界和真实入口 E2E / 截图 |
| 着火的人 | `locked / partial / Board component representative` | 多段分支、双伤害、入口大厅状态 | Board 组件代表链已补 2-3 移动分支神志检定 UI、当前位置更新和 0-1 物理+精神双伤害反馈 UI；继续分离 4+ 神志、2-3 移动、0-1 双伤害顺序 / 消费者组 | 4+ 神志属性上限、双伤害减免、胸针/盔甲/头戴耳机和死亡保护组合、真实入口 E2E / 截图 |
| 上古旧宅 | `locked / Board component representative / partial-ui` | 速度/力量检定、楼层目标、通用/精神伤害、死亡保护 | 保留缺目标拒绝、速度成功、力量地面通用伤害、速度地下室精神伤害和非法楼层拒绝领域代表链；Board 组件代表链已补力量选择、地面目标和通用伤害分配 | 上层成功 UI、地下室精神伤害 UI、非法目标提示 UI、通用/精神伤害减免、死亡保护、更多楼层/作祟地图组合和真实入口 E2E / 截图 |

按缺口桶归并后的下一步优先级：先补“伤害/死亡保护组合”合同索引，再补“目标候选 UI 需要哪些状态真相”的合同字段，最后补“作祟特例与脚注展示/音频”授权边界。未获后续阶段授权前，这些只保持为合同缺口，不进入实现。

### 6.13 B 队列：22 张物品消费场景缺口分桶（2026-07-29）

本节只消费 6.2 的既有物品矩阵，把 22 张官方物品按消费场景归桶；不新增物品效果、Board/UI、E2E、截图，也不重新读取或猜补卡图字段。`UI 承接`、`组合回归`、`新增消费者再审` 都是后续缺口标签，不是当前实现授权。

| 物品 | 主要消费桶 | 当前证据级别 | 可继续的合同层动作 | 后续阶段动作 |
| --- | --- | --- | --- | --- |
| 魔法相机 | 作祟消费者、属性检定替代 | `covered-by-existing-contract / consumer-review-on-change` | 记录摄影师、作祟和属性检定新消费者出现时需回查 | 新增相关消费者后再补组合验证 |
| 恐怖玩偶 | 属性检定重掷、回滚快照、Board 全骰选择 | `partial-mechanism-covered / Board component representative / partial-ui` | 保留属性检定全骰重掷和 Board 全骰选择已验；标出作祟特殊行动属性检定缺通用回滚快照；固定骰、攻击、作祟检定保持不放行 | 真实 Playwright / 截图、通用回滚快照和更多重掷消费者组合 |
| 奇怪的药品 | 埋葬治疗、属性恢复 | `covered-by-existing-contract / consumer-review-on-change` | 新增治疗、交易、死亡保护消费者时再审 | 组合回归按新增消费者触发 |
| 镜子 | 主动治疗、回合时点 | `min-verified / partial-combo` | 标出伤害后治疗、回合时点、作祟状态组合缺口 | UI/组合授权后补 |
| 急救包 | 同房治疗、濒死属性恢复、目标合法性 | `covered-by-existing-contract / consumer-review-on-change` | 新增同房目标、死亡保护、交易限制消费者时再审 | 目标 UI 和死亡保护组合 |
| 幸运硬币 | 空白骰重掷、精神伤害、房间回合末组合、Board 空白骰选择 | `combo-domain-verified / Board component representative / partial-ui` | 保留倒塌房间组合和 Board 空白骰选择已验，列出作祟/死亡保护等更多伤害分配消费者 | 真实 Playwright / 截图和更多伤害组合 |
| 皮夹克 | 攻击防御额外骰 | `min-domain-verified / Board component representative / partial-ui` | 已补攻击投骰复盘 UI 可见进攻总点、防御总点和防御额外 1 骰；仍列出怪物攻击、作祟攻击、更多攻击来源消费者 | 真实 Playwright / 截图链和攻击来源组合 |
| 牙齿项链 | 回合结束濒死属性恢复、死亡保护 | `min-domain-verified / min-ui-representative / partial-combo` | 标出 Board 组件选择 / 跳过代表链已补；作祟回合、房间回合末、结束回合时点消费者仍需组合审 | 真实 Playwright / 截图链和死亡保护组合 |
| 手电筒 | 事件属性检定加骰 | `covered-by-existing-contract / consumer-review-on-change` | 新增事件属性检定消费者时逐项确认是否加骰 | 事件 UI/组合按新增消费者触发 |
| 头戴耳机 | 精神伤害减免 | `covered-by-existing-contract / Board component representative / consumer-review-on-change` | 已补伤害分配页原始精神伤害、头戴耳机减免和实际分配数组件代表链；继续列出精神伤害来源、减伤叠加和死亡保护消费者 | 真实 Playwright / 截图链和死亡保护组合 |
| 地图 | 主动移动、已发现房间、duplicate alias | `covered-by-existing-contract / duplicate-alias-guarded` | 继续把 `notebook / journal / manuscript` 归为同 frame alias，不重复计数 | 地图移动 UI 或新增移动消费者再审 |
| 奇异护符 | 物理伤害后触发、伤害类型区分 | `min-domain-verified / partial-ui` | 列出减伤、死亡保护、作祟物理伤害消费者 | UI/日志提示和伤害组合 |
| 胸针 | 伤害类型改写、通用伤害 | `min-domain-verified / min-ui-representative / partial-combo` | 已补 Board 组件伤害分配代表链；继续标出更多伤害来源、减伤叠加、强制伤害顺序、死亡保护和作祟伤害消费者 | 真实 Playwright / 截图链与组合回归 |
| 枪 | 视线速度攻击、武器互斥、交易限制 | `min-verified / partial-combo` | 列出怪物目标、视线边界、作祟攻击消费者 | 攻击 UI 和视线组合 |
| 十字弓 | 同板块/相邻速度攻击、武器互斥、交易限制 | `min-verified / partial-combo` | 列出怪物目标、相邻边界和多武器消费者 | 攻击 UI 和相邻边界组合 |
| 兔脚 | 最近投骰重掷、跨消费者准入 | `broad-domain-covered / consumer-review-on-change` | 保持“新增骰子消费者必须逐项确认”口径，不能默认全开 | 按新增事件/房间/攻击/死亡保护消费者回归 |
| 骨制钥匙 | 穿墙移动、门位 / 墙体限制、埋葬 | `L3 representative / partial-combo` | 当前树已补移动模式穿墙目标、点击结算和回到默认牌桌代表链；墙体 / 门位 / 同层 / 相邻限制全组合、作祟地图规则、特殊移动限制和埋葬随机分支仍需再审 | 空间组合和地图规则组合 |
| 神秘秒表 | 作祟后额外行动、结束回合时点 | `min-verified / min-ui-representative / partial-combo` | 标出作祟、怪物回合和结束回合组合消费者；页面代表链已补 | 作祟 / 怪物回合 / 房间回合末组合 |
| 砍刀 | 近战武器、攻击结果 +1、武器互斥、交易限制 | `covered-by-existing-contract / partial-combo` | 列出更多攻击来源、怪物攻击、多武器互斥消费者 | 攻击 UI 和多武器组合 |
| 电锯 | 攻击额外骰、武器互斥、交易限制 | `min-verified / partial-combo` | 列出更多攻击来源、怪物目标和多武器互斥消费者 | 攻击 UI 和怪物目标组合 |
| 炸药 | 代替常规攻击、板块目标、群体速度检定、埋葬、Board 目标态承接 | `min-domain-verified / min-ui-representative / partial-combo` | 已补主动作自动选中炸药和房间板块目标态；仍标出真实入口、非法原因、怪物/作祟组合和特殊免疫边界 | 真实 Playwright / 截图链、非法原因展示和更多作祟/怪物组合 |
| 天使之羽 | 非战斗属性检定投骰结果替代、数值选择 | `min-domain-verified / min-ui-representative / partial-combo` | 0-8 数字选择页面代表链已补；固定骰不消费和攻击/作祟检定边界缺口仍保留；额外骰规则裁定仍待后续 | 攻击/作祟边界、房间回合末与额外骰组合 |

按消费桶归并后的下一步优先级：先保留“伤害减免 / 死亡保护 / 伤害改写”同组合同索引，再保留“武器攻击 / 多武器互斥 / 交易限制”同组合同索引，最后保留“移动 / 目标选择 / 额外行动 / 重掷消费者再审”同组缺口。未获后续阶段授权前，这些只保持为合同缺口，不进入实现。

### 6.14 C/D 队列：预兆逐卡与作祟公共规则缺口分桶（2026-07-29）

本节只消费 6.4 的既有预兆 / 作祟后续缺口矩阵，把“9 张预兆逐卡效果”和“作祟公共规则”分成两层继续队列；不新增预兆效果、作祟实现、Board/UI、E2E、截图，也不重新读取或猜补卡图字段。

#### 6.14.1 C 队列：9 张预兆逐卡效果缺口桶

| 预兆 | 主要消费桶 | 当前证据级别 | 可继续的合同层动作 | 后续阶段动作 |
| --- | --- | --- | --- | --- |
| 书本 | 知识检定加值、非战斗检定替换、神志成本 | `min-domain-verified / Board component representative / partial-ui` | 已补临界神志成本领域门禁、使用后禁用和神志不足提示组件代表链；继续标出非战斗检定消费者、房间检定、作祟特殊行动检定和替代 / 重掷组合边界 | 真实 Playwright / 截图链和更多非战斗检定组合 |
| 狗 | 速度检定加值、4 格交易、同意与交易限制 | `min-domain-verified / Board component representative / partial-ui` | 已补狗交易候选、4 格目标、同意结算、已用牌禁用、灰尘交换疾病冲突和预兆交易后风险条代表链；继续标出更多距离边界、死亡/搜尸/作祟状态、收到牌本回合使用限制 | 真实 Playwright / 截图链和更多死亡/搜尸/作祟组合 |
| 面具 | 同板块移动其他探索者/怪物、相邻已发现板块 | `min-domain-verified / Board component representative / partial-ui` | 已补 Board 多目标选择代表链；继续标出怪物回合、死亡目标、不能发现新板块边界 | 真实 Playwright / 截图链和怪物组合 |
| 头骨 | 知识检定加值、死亡前保护、兔脚重掷 | `min-domain-verified / Board component representative / partial-ui` | 已补 Board 死亡保护骰盘与成功反馈代表链；继续标出更多致死来源、作祟终局和遗物掩埋消费者 | 真实 Playwright / 截图链和致死组合 |
| 圣符 | 神志检定加值、探索时埋葬房间并继续探索、本回合刚获得限制 | `min-domain-verified / Board component representative / partial-ui` | 已补探索声明和刚获得限制 Board 组件代表链；继续标出房间/事件/作祟探索消费者和牌堆顺序边界 | 真实 Playwright / 截图链和更多房间/事件/作祟组合 |
| 盔甲 | 物理伤害减免、非通用伤害/非直接属性降低 | `min-domain-verified / Board component representative / partial-ui` | 已补伤害分配页原始伤害、盔甲减免和实际分配数组件代表链；继续标出物理伤害来源、死亡保护和作祟伤害消费者 | 真实 Playwright / 截图链和更多伤害组合 |
| 雕像 | 力量检定加值、事件符号房间可不抽事件 | `min-domain-verified / Board component representative / partial-ui` | 已补探索声明、连续事件房间和刚获得限制 Board 组件代表链；继续标出事件牌堆顺序、作祟探索和无事件符号拒绝 UI 边界 | 真实 Playwright / 截图链和更多事件牌堆组合 |
| 指环 | 神志检定加值、神志武器攻击、精神伤害 | `min-domain-verified / partial-ui` | 标出怪物目标、多武器互斥、未声明不自动生效消费者 | 攻击 UI 和武器互斥组合 |
| 匕首 | 显式武器攻击、速度成本、额外 2 骰、物理伤害 | `min-domain-verified / partial-ui` | 标出速度濒死/死亡保护、多武器互斥、怪物目标消费者 | 攻击 UI 和速度成本组合 |

#### 6.14.2 D 队列：作祟公共规则缺口桶

| 公共规则 | 主要消费桶 | 当前证据级别 | 可继续的合同层动作 | 后续阶段动作 |
| --- | --- | --- | --- | --- |
| 抽到预兆后的作祟检定 | 抽预兆触发、来源预兆、翻牌确认队列 | `min-domain-verified / partial-ui` | 标出作祟风险 UI、翻牌确认 UI、事件型作祟入口缺口 | 作祟揭示 UI 和入口组合 |
| 全员当前持有预兆总数 | 全员风险计数、交易转移后总数、狗交易后风险条代表链 | `min-domain-verified / Board component representative / partial-ui` | 已补狗交易后风险 UI 代表链；继续标出死亡掉落、遗物转移、搜尸和更多作祟状态消费者 | 真实 Playwright / 截图链和死亡/搜尸/作祟组合 |
| 5+ 开始作祟 | 普通预兆点数触发、剧本卡、揭秘者、触发预兆 | `min-domain-verified / partial-ui` | 标出首玩家/叛徒裁定显示和更多剧本入口缺口 | 作祟揭示 UI 和更多剧本入口 |
| 最多 8 骰 | 全员 9 张预兆时实际最多 8 骰 | `min-domain-verified / partial-ui` | 标出骰数上限 UI 显示和超 8 风险组合缺口 | 风险 UI 和超 8 组合 |
| 最后一张预兆自动作祟 | 不靠点数自动触发、触发预兆、翻牌确认队列 | `min-domain-verified / partial-ui` | 标出最后一张被交易/死亡掉落后的组合扩审点 | 自动作祟 UI 和持有物变化组合 |

按缺口桶归并后的下一步优先级：先维护“预兆逐卡 UI/组合”和“作祟公共规则 UI/组合”的分层索引，再维护“交易 / 死亡掉落 / 探索 / 攻击 / 作祟入口”这些跨消费者缺口。未获后续阶段授权前，这些只保持为合同缺口，不进入实现。

### 6.15 合同层队列收口审计（2026-07-29）

本节只审计 6.11 拆出的 A-E 队列是否已经落到同一合同账本；不新增 Board/UI、E2E、截图、卡牌效果或作祟实现。结论：当前 S0 图包、atlas、74 行对象全集和合同层队列已经可以继续被消费；整牌库仍保持 `in_progress / downstream-gated`（历史旧别名：`downstream-blocked`），因为下游机制/UI/组合验证没有全部闭合。

| 队列 | 覆盖范围 | 合同层当前状态 | 仍未放行的事项 | 下一步最小动作 |
| --- | --- | --- | --- | --- |
| A：25 张非纯 `locked` 事件 | 6.12 已逐张拆出剩余分支、UI 承接、组合测试、作祟特例等缺口桶 | `contract-indexed / downstream-open` | 事件新增实现、真实入口 E2E、截图、把代表链外推为 43 张事件完成 | 只维护缺口桶和证据索引；若后续授权实现，再按 6.12 逐项取数 |
| B：22 张物品消费场景 | 6.13 已按作祟/检定、治疗、重掷、攻击、防御、死亡保护、移动、交易限制等消费桶归并 | `contract-indexed / downstream-open` | 22 张物品所有效果完整闭合、UI 选择承接、组合测试收口 | 只维护消费桶和新增消费者再审口径；不因对象表 `locked` 宣称物品全完成 |
| C：9 张预兆逐卡效果 | 6.14.1 已逐张登记领域证据级别、UI/组合缺口和后续动作 | `contract-indexed / downstream-open` | 预兆 UI、交易/死亡/探索/攻击组合、真实入口验收 | 保留逐卡效果合同；不把 9 张数量正确当作逐卡承接完成 |
| D：作祟公共规则 | 6.14.2 已拆出抽预兆检定、全员预兆数、5+ 作祟、8 骰上限、最后一张自动作祟 | `contract-indexed / downstream-open` | 作祟揭示 UI、翻牌确认 UI、完整 7 号作祟、木乃伊完整流程、E2E/截图 | 保持公共规则独立账本；不并入任一单张预兆 |
| E：下游实现消费审计隔离 | 6.7/6.8 已把 `runtime-implementation-consumption-audit-2026-07-29.md` 标为未来阶段索引 | `isolated-for-future-stage` | 用旧 E2E、旧截图、局部测试或未来阶段索引证明当前整牌库完成 | 后续若授权 UI/E2E/截图，先重新锁定目标、入口和验收口径 |

| 当前判断问题 | 合同层答案 | 用户是否需要补东西 |
| --- | --- | --- |
| 是不是图包缺素材？ | 否。事件、物品、预兆 atlas 与用户本地图包逐字节一致；旧 42 事件候选是旧 manifest 扫描口径漏 frame 42 | 当前不需要补整包图包 |
| 是不是项目 atlas 导入错？ | 当前无证据显示导入错；事件 frame 0-42、物品 frame 0-21、预兆 frame 0-8 均已形成对象合同 | 当前不需要重新导入 |
| 为什么仍然 `downstream-gated`？ | 因为逐卡机制、UI 承接、组合测试、完整作祟和真实入口验收仍未全闭合；这是完成门禁，不是合同层停工；`downstream-blocked` 只作为历史旧别名保留 | 不需要用户补源；需要后续阶段授权才进入实现/UI/E2E |
| 规范是不是导致不能继续？ | 原因是旧 `create-new-game` 入口写着“必须卡住”，容易被误读为停工。本轮已同步为“停在 S0，但不能停工”：`blocked / disputed / unknown-slot / not-in-runtime` 只拦阶段升级和完成宣称，不拦 S0 合同层补证 | 不需要用户补素材；后续模型应继续补合同，不得因 `blocked` 泛化停工 |
| 什么时候才需要问用户？ | 只有具体单卡裁图不可读、frame/hash 冲突、主图包与新权威来源冲突、或用户要求改用其它权威来源时 | 到时必须点名具体牌、路径、字段和最小补源动作 |

合同层后续默认只做三类维护：1）新增证据时更新 6.7 字段覆盖索引；2）对象状态或缺口桶发生变化时同步 6.12-6.14；3）若用户明确授权下游实现/UI/E2E/截图，先按新阶段重新锁定目标和验收，不从本节直接跳级。

### 6.16 旧数量 / 完成口径扫描记录（2026-07-29）

本节只记录接续风险扫描，不新增 Board/UI、E2E、截图或玩法实现。扫描目的不是清空所有历史字样，而是确保会被后续误读成当前整牌库完成证据的入口都有边界。

| 扫描项 | 当前结果 | 合同层裁定 |
| --- | --- | --- |
| 旧数量口径：`当前 23 张`、`23 张运行持有牌`、`12 张发现池物品`、`当前正式运行事件牌堆`、`11 张物品` | 命中的山屋旧入口顶部均已有 2026-07-29 接续裁定或口径修正 | `pass`：旧数量只代表历史现场；不得覆盖当前 43/22/9 主合同 |
| 完成口径：`完整审计`、`完整实现`、`整游戏完成`、`整牌库完成` 等 | 命中包含已加边界的整牌库相关旧入口，也包含单个作祟、设计、首剧本、素材参考等非整牌库入口 | `guarded`：非整牌库入口不自动接管当前任务；后续若引用它们证明整牌库或当前 UI/E2E，必须先回到 6.7/6.16 降级 |
| 新增专项入口 | `omen-and-haunt-rule-implementation-audit-2026-07-29.md` 与 `room-effect-implementation-audit-2026-07-29.md` 均已补顶部接续边界，并已登记到 6.7 与 `full-deck-scope-audit.md` 专项入口边界 | `pass`：前者只作为 6.14 预兆/作祟缺口桶证据入口，后者只作为未来房间效果矩阵入口；二者都不证明整牌库完成 |
| 事件 / 物品专项入口 | `event-effect-implementation-audit-2026-07-29.md` 与 `item-effect-implementation-audit-2026-07-29.md` 均已补顶部接续边界，并已登记到 6.7 与 `full-deck-scope-audit.md` 专项入口边界 | `pass`：前者只作为 6.12 事件缺口桶证据入口，后者只作为 6.13 物品消费桶证据入口；二者都不证明整牌库、UI/E2E、截图或全部效果完成 |
| 整游戏主视角入口 | `docs/games/betrayal/master-spec-view.md` 已补 2026-07-29 接续裁定，明确其旧 `12 张物品 / 23 张事件 / 发现池已完成第一层收口` 只属于历史 change / 随机化 / 首剧本范围 | `guarded`：它可作为整游戏缺口导航，不能替代当前发现牌整牌库主合同；不得据此跳到 UI/E2E/截图或完成宣称 |
| 规则交互设计入口 | `full-rule-interaction-redesign.md` 与 `interaction-redesign-coverage-matrix.md` 已有 2026-07-29 历史数量口径修正，并已登记到 6.7 与 `full-deck-scope-audit.md` 旧文档降级表 | `guarded`：二者只能作为规则交互导航和历史代表链证据，不替代当前发现牌整牌库主合同；不得据此跳到 UI/E2E/截图或完成宣称 |

### 6.17 跨消费者缺口索引（合同层，2026-07-29）

本节只把 6.12-6.14 中反复出现的跨消费者缺口归并成后续可执行索引；不新增卡牌效果、房间效果、作祟逻辑、Board/UI、E2E 或截图。这里的“状态真相”指后续阶段实现或验证前必须能从领域状态读到的事实，不代表本轮已经有玩家可见 UI。

#### 6.17.1 伤害 / 死亡保护 / 改写减免组合索引

| 缺口组 | 已知消费者 | 当前合同证据 | 后续必须锁定的状态真相 | 当前裁定 |
| --- | --- | --- | --- | --- |
| 精神伤害事件 | 不可能的房间、晦暗暴风夜、禁忌知识、可怜的尤里克、轮到约拿了、无线电广播、一声呼救、着火的人 | 6.12 与 `event-effect-implementation-audit-2026-07-29.md` 已登记最小领域或代表链 | 伤害类型、骰值来源、是否可被头戴耳机减免、是否进入头骨死亡保护、是否允许兔脚/幸运硬币等最近投骰消费者 | `contract-indexed / downstream-open`；不补实现或 UI |
| 物理伤害事件 | 地狱蝙蝠、断手、摇曳灯光、着火的人、炸药失败探索者分支 | 6.12 / 6.13 已登记物理伤害、胸针、盔甲、奇异护符、头骨、兔脚等消费者 | 物理伤害是否先被盔甲减免、是否可被胸针改写为通用伤害、奇异护符是否只在实际承受物理伤害后触发、死亡保护窗口顺序 | `contract-indexed / downstream-open`；后续授权后做组合矩阵 |
| 通用伤害 / 选择分配 | 花团锦簇、佳馔满桌、游魂，以及胸针改写后的通用伤害 | 6.12 / 6.13 已将通用伤害归桶 | 可分配属性、分配确认时点、是否触发头骨死亡保护、兔脚成功/失败后对已结算副作用的回滚边界 | `contract-indexed / downstream-open` |
| 直接属性降低 | 神秘液体、一罐器官、禁忌知识的属性变化分支 | 6.12 已登记属性上下限和死亡保护缺口 | 直接降低是否绕过伤害减免、降低到骷髅时是否进入死亡保护、属性上限/下限写入位置 | `contract-indexed / downstream-open` |
| 物品伤害改写 / 减免 | 胸针、盔甲、头戴耳机、奇异护符、皮夹克、幸运硬币、牙齿项链、头骨、兔脚 | 6.13 / 6.14 已按消费桶登记 | 同一伤害来源遇到改写、减免、属性恢复、死亡保护、重掷时的顺序；成功保护后是否回滚死亡、是否保留或掩埋遗物 | `contract-indexed / downstream-open` |
| 作祟 / 房间伤害交叉 | 倒塌房间 + 幸运硬币、火炉房/倒塌房间代表链、灰尘专项代表链、7 号作祟代表链 | `room-effect-implementation-audit-2026-07-29.md`、灰尘专项和 6.13 已登记代表证据 | 房间回合末、作祟动作、怪物攻击、事件伤害之间是否复用同一伤害窗口；哪些证据只是代表链 | `future-stage-indexed`；当前不进入房间/作祟实现 |

#### 6.17.2 目标候选 / 选择 UI 状态真相索引

| 缺口组 | 已知消费者 | 当前合同证据 | 后续 UI/实现前必须能读取的状态真相 | 当前裁定 |
| --- | --- | --- | --- | --- |
| 房间目标事件 | 地狱蝙蝠、花团锦簇、秘密升降机、一声呼救、技术难点、上古旧宅 | 6.12 与事件专项已登记相邻、同区域/不同区域、楼层/温室、起始点 fallback、任意楼层/地面/地下室目标等代表证据；地狱蝙蝠、花团锦簇、秘密升降机、一声呼救和上古旧宅已有 Board 组件目标选择代表链，技术难点已有确定性起始点放置与地下室精神伤害 Board 组件代表链 | 候选房间 id、区域/楼层、是否已发现、是否相邻或同/不同区域、非法原因、选择后是否移动探索者或造成伤害；技术难点不提供自由候选，只消费当前楼层与确定性目的地 | `contract-indexed / Board component representative for 地狱蝙蝠、花团锦簇、秘密升降机、一声呼救、技术难点、上古旧宅 / partial-ui` |
| 物品目标 / 持有物选择 | 轮到约拿了、断手、游魂、地图、急救包、镜子、奇怪的药品 | 6.12 / 6.13 已登记非武器筛选、抽物品、埋葽物品、治疗目标和移动目标缺口 | 可选物品 id、武器/非武器、是否已用或不可交易、目标探索者是否同房/存活、牌堆是否耗尽、选择后是否埋葬或移动 | `contract-indexed / downstream-open` |
| 攻击 / 武器目标 | 枪、十字弓、砍刀、电锯、指环、匕首、炸药、镜中怪物 | 6.13 / 6.14 与事件专项已登记武器、板块目标、同房/相邻/视线、怪物目标缺口 | 攻击来源、目标类型、同房/相邻/视线、是否怪物或探索者、武器互斥、已攻击/已用、失败是否反伤、炸药目标板块内所有目标 | `contract-indexed / downstream-open` |
| 预兆 / 作祟选择 | 狗交易目标、面具移动目标、圣符/雕像探索声明、头骨死亡保护、作祟检定与最后一张自动作祟 | 6.14 已拆逐卡效果与公共规则缺口 | 当前持有者、全员预兆总数、交易/死亡/搜尸后的持有变化、探索声明来源、死亡保护窗口、作祟触发来源和翻牌确认队列 | `contract-indexed / partial-ui` |
| 重掷 / 替代数值选择 | 兔脚、恐怖玩偶、幸运硬币、天使之羽、书本、片刻希望祝福 | 6.13 / 6.14 已登记回滚快照、固定骰不消费、0-8 选择、祝福加骰缺口 | 最近投骰来源、是否允许该消费者、旧分支副作用是否可回滚、替代值或重掷结果、额外骰是否叠加、固定骰/攻击/作祟检定边界 | `contract-indexed / downstream-open` |

### 6.18 离开合同层前的授权门禁（2026-07-29）

本节回答“哪些动作仍不能自动继续”。当前用户授权范围仍是 S0/S1/S2 合同层补证、证据索引和缺口拆分；以下任一项要进入代码实现、Board/UI、E2E 或截图，都必须作为新阶段重新锁定目标、入口和验收。未授权时，只能继续维护合同字段、索引和边界。

| 后续阶段候选 | 可消费的合同入口 | 进入前必须重新锁定 | 当前禁止事项 | 当前最小合同层动作 |
| --- | --- | --- | --- | --- |
| 事件剩余分支实现 | 6.12、6.17、`event-effect-implementation-audit-2026-07-29.md` | 点名事件、分支、伤害/目标/重掷消费者、验证口径 | 不得批量补实现、不得把 `min-domain-verified` 外推为逐事件完成 | 只维护事件缺口桶和状态真相 |
| 物品机制 / UI 组合 | 6.13、6.17、`item-effect-implementation-audit-2026-07-29.md` | 点名物品、消费场景、组合对象、是否需要 UI 或领域验证 | 不得新增物品效果或 UI，不得把 22 张数量对齐当成效果完成 | 只维护消费桶和新增消费者再审口径 |
| 预兆逐卡 UI / 组合 | 6.14.1、6.17、`omen-and-haunt-rule-implementation-audit-2026-07-29.md` | 点名预兆、UI 承接、交易/死亡/探索/攻击组合和验证方式 | 不得因 9 张数量正确或领域代表链通过而宣称逐卡承接完成 | 只维护逐卡 UI/组合缺口 |
| 作祟公共规则 UI | 5.1、6.14.2、6.17 | 作祟风险显示、翻牌确认、全员预兆数、8 骰上限、最后一张自动作祟的真实入口 | 不得把公共规则并入单张预兆，也不得用领域测试替代作祟 UI | 只维护公共规则独立账本 |
| 7 号作祟完整实现 | E10、6.12、6.17、预兆/作祟专项索引 | 完整 7 号目标、秘密/公开信息、镜中怪物移动/攻击、破咒 UI、E2E / 截图验收 | 不得把怪异的镜子 5+ 代表入口、秘密组合或镜中怪物领域链说成完整 7 号作祟 | 只保留 `representative-only / downstream-open` |
| 无线电广播脚注 / 音频 | E26、6.12、事件专项索引 | 是否接入玩家可见脚注、是否接入音频资源、音频来源授权、展示位置 | 不得把脚注当规则效果，也不得无授权接入音频资源 | 只保持“展示/音频提示，不改变规则结算”的合同裁定 |
| 真实入口 E2E / 截图验收 | 6.7、6.9、6.15、各专项入口 | 真实入口、测试文件、截图验收标准、目标对象范围 | 当前合同续跑不得跑 E2E、不得截图、不得打开验收图 | 只登记旧证据边界和未来阶段入口 |

### 6.19 规范残留复核：blocked 不得再被理解为停工（2026-07-29）

本节只记录规范文字层面的二次复核，不新增 Board/UI、机制实现、E2E 或截图。复核对象是本轮必须读取的项目录入规范和 create-new-game 分阶段规范；结论是：裸 `in_progress / blocked` 或“必须卡住”这类容易被误读成停工的表达已改成 `S0-blocked / downstream-blocked` 或已附带“阶段门禁，不是停工口令”的解释。

| 规范入口 | 本轮修正 / 复核结果 | 后续执行口径 |
| --- | --- | --- |
| `.codex/skill/create-new-game/SKILL.md` | 阶段 0 一票否决改为 `in_progress / S0-blocked` 或 `in_progress / downstream-blocked`，并明确 blocked 只拦阶段升级和完成宣称 | S0 缺口存在时继续补合同字段，不进入实现/UI/E2E/截图 |
| `.codex/skill/create-new-game/references/preflight-gates.md` | 提案状态写法改为 `S0-blocked / downstream-blocked`，并保留“停在 S0，但不能停工” | 提案或矩阵只能引用已录入事实，不能写成完成方案 |
| `.codex/skill/create-new-game/references/mechanics-data-design.md` | 数据量大、分批录入两处旧 `in_progress / blocked` 改为 `S0-blocked / downstream-blocked`，并说明不是数据层停工理由 | 可以分批录入已锁数据，但未闭合对象继续留在对象全集和缺口表 |
| `.codex/skill/data-entry-workflow/SKILL.md`、`docs/ai-rules/data-entry.md` | 已有明确规则：`blocked / disputed / unknown-slot / not-in-runtime` 是阶段升级门禁，不是停工口令 | 作为后续继续合同层补证的主执行口径 |

### 6.20 74 行对象表结构完整性复核（2026-07-29）

本节只复核第 3-5 节对象全集表的结构和字段覆盖，不重写牌名、效果、frame 或状态。复核脚本按 `| E/I/O## |` 行扫描对象表，并按真实表头 11 列核对：`# / 中文名 / 英文名或原文名 / 类别 / 官方来源或真相源位置 / 规则原文或效果子句录入状态 / 素材-atlas-裁图-frame 状态 / 当前配置-运行状态 / 能力-效果-UI 后续 / 合同状态 / 阻塞原因与下一步最小解阻动作`。

| 复核项 | 结果 | 合同裁定 |
| --- | --- | --- |
| 对象行数 | 74 行；事件 43、物品 22、预兆 9 | `pass`：满足官方 74 张对象全集同表要求 |
| 表格列数 | 表头 11 列；74 行均为 11 列 | `pass`：没有列错位或缺列 |
| 空字段 | 0 个空字段 | `pass`：每张牌至少有来源、素材、运行、后续、状态和下一步说明 |
| 英文名或原文名 | 20 行已锁英文/原文名；54 行仍写 `未锁定 / 未锁英文名` | `allowed-partial`：用户要求是“如能锁定”；不得用百度或社区表补锁，后续只有从图包、官方对照源或用户指定权威源复核后才能改 |
| 合同状态分布 | `locked` 54 行；`locked / partial` 15 行；`locked / min-verified` 4 行；`locked / partial / min-domain-verified` 1 行 | `not-complete`：对象表结构闭合不等于整牌库机制/UI/测试完成 |
| 下游 follow-up 行 | 33 行含 `partial / min-verified / UI / 组合 / 下一步` 等后续信号：20 张事件、13 张物品、0 张预兆对象行 | `downstream-indexed`：该统计只说明对象行后续字段已写清；预兆的 UI/组合缺口仍以 6.14 为准，不能因对象行未命中 follow-up 就判预兆完成 |

本次结构复核说明：S0 对象全集表已经满足“74 张都进入同一对象全集，并逐行记录最小字段”的结构要求；整牌库仍保持 `in_progress / downstream-blocked`，因为 6.12-6.14、6.17 和 6.18 已登记的机制、UI、组合测试、作祟完整流程和真实入口验收缺口仍未闭合。

### 6.21 对象表证据路径解析审计（2026-07-29）

本节只审计第 3-5 节对象行里的路径类引用是否能在当前工作区解析，不把可解析路径升级为玩法完成证据。审计明细落在 `temp/betrayal-full-deck-path-resolution-audit-2026-07-29.json`；该文件是临时审计产物，用于接续，不进入运行时资源链。

解析根目录按本轮合同事实固定为：仓库根、`src/games/betrayal/`、`temp/betrayal-event-front-atlas-2026-07-03/event-08-tts-9x5-2026-07-04/`、`temp/betrayal-asset-source-diagnostics-2026-07-28/`、`temp/betrayal-possession-contract-crops/`。

| 复核项 | 结果 | 合同裁定 |
| --- | --- | --- |
| 对象行路径类 token | 39 个唯一 token | `pass`：39 个均可解析，0 个 unresolved |
| 事件完整裁图短文件名 | `card-01-r0c1-full.jpg` 等短名全部解析到 `temp/betrayal-event-front-atlas-2026-07-03/event-08-tts-9x5-2026-07-04/` | `pass-with-root`：对象行短名不是缺图；后续引用需带本节解析根，避免误判为路径缺失 |
| E43 补充裁图 | `temp/betrayal-asset-source-diagnostics-2026-07-28/event-42-r4c6-full.jpg` 存在 | `pass`：继续证明 E43「最深的壁橱」不是旧 manifest 缺图，而是旧候选扫描漏 frame 42 |
| 物品/预兆裁图与 atlas 代码入口 | `item-strange-amulet-full.jpg` 解析到 `temp/betrayal-possession-contract-crops/`；`discoveryAtlas.ts`、`possessionAtlas.ts`、`scenarioConfig.ts` 均解析到 `src/games/betrayal/` | `pass-with-root`：短文件名可回访，但正式引用时仍应写清父目录 |
| 裁图数量 | 旧事件裁图目录有 42 个 `card-*-full.jpg`，E43 由补充诊断目录提供；`temp/betrayal-possession-contract-crops/` 有 22 个 full 裁图；`temp/betrayal-asset-source-diagnostics-2026-07-28/` 有 22 个 item full 裁图 | `matched-after-supplement`：路径层不构成图包缺失；仍不证明逐卡机制/UI/测试完成 |

本次路径审计的执行口径：如果后续模型看到对象行只写了 `card-XX-rYcZ-full.jpg` 或 `item-strange-amulet-full.jpg`，不得立刻判为文件缺失；必须先按本节解析根定位。若未来要把短名改成逐行完整路径，属于合同可读性优化，不属于素材补源或玩法实现。

### 6.22 合同 / 运行池 / atlas 三方一致性审计（2026-07-29）

本节只复核三处正式入口是否互相对齐：第 3-5 节 74 行对象表、`scenarioConfig.ts` 的当前发现池、`discoveryAtlas.ts` / `possessionAtlas.ts` 的正式 atlas frame 映射。不新增卡牌效果、Board/UI、E2E 或截图，也不把数量一致外推为机制完成。审计明细落在 `temp/betrayal-full-deck-three-way-consistency-audit-2026-07-29.json`。

| 复核项 | 结果 | 合同裁定 |
| --- | --- | --- |
| 合同对象表 | 事件 43 / 物品 22 / 预兆 9，合计 74 | `pass`：对象全集仍在同一张 S0 合同表内 |
| `BETRAYAL_DISCOVERY_POOLS` 当前发现池 | 事件 43 / 物品 22 / 预兆 9 | `pass`：当前运行发现池数量已与合同对象表一致 |
| 事件标题与事件 atlas | `EVENT_FRONT_FRAME_BY_TITLE` 有 43 个标题，frame 覆盖 0-42，无缺帧、无重复 frame；标题集合与合同事件表、当前事件池完全一致 | `pass`：E43「最深的壁橱」继续锁定为 frame 42；旧 42 候选 manifest 不能再作为缺图结论 |
| 官方物品 ID 与物品 atlas | 22 个官方物品 ID 均能解析到 `item-front-atlas`，官方物品唯一覆盖 frame 0-21，无缺 frame、无官方物品重复 frame | `pass`：物品正面数量与运行池数量一致 |
| 物品 legacy alias | `lantern -> frame 8`；`notebook / journal / manuscript -> frame 16` | `duplicate-alias / legacy-alias`：这些 alias 不是官方 22 张之外的新物品，不得按运行名或 alias 行数重复计数 |
| 官方预兆 ID 与预兆 atlas | 9 个官方预兆 ID 均能解析到 `omen-front-atlas`，唯一覆盖 frame 0-8，无缺 frame、无重复 frame、无额外预兆 alias | `pass`：预兆数量与 atlas 正面一致；预兆逐卡 UI/组合仍看 6.14 |
| 三方差异 | 合同事件名、当前事件池名、事件 atlas 标题三者差异均为空；官方物品/预兆均无缺视觉映射 | `pass / not-complete`：三方一致证明当前没有导入错位或数量缺口；不证明逐卡机制、UI、组合测试或作祟完整流程完成 |

本次审计回答用户追问里的关键点：当前不是图包缺少整牌库素材，也不是项目正式 atlas 导入数量错误；旧阻塞来自旧 manifest / 旧运行池 / alias 口径和下游机制承接未闭合。当前对外状态词统一为 `downstream-gated / 下游门禁中`；历史旧别名 `downstream-blocked` 只表示不能进入完成宣称、UI/E2E/截图或未授权实现，不表示 S0/S1/S2 合同层不能继续。

### 6.23 S0 出口审计：原始交付项闭合与下游边界（2026-07-29）

本节用 6.20-6.22 的最新复核结果重审用户原始交付项。结论是：**S0 数据录入 / 合同层本身已经闭合**，但整牌库实现、逐卡 UI、组合测试、完整作祟、E2E 和截图仍未闭合，因此总体继续保持 `in_progress / downstream-gated`（历史旧别名：`downstream-blocked`）。审计明细落在 `temp/betrayal-full-deck-s0-exit-audit-2026-07-29.json`。

| 原始要求 | 最新证据 | S0 裁定 | 不得外推 |
| --- | --- | --- | --- |
| 新建或更新整牌库 S0 数据录入合同 | 本文件作为主合同，记录真相源、对象全集、差异、alias、路径、三方一致性和后续门禁 | `S0-pass` | 不等于 Board/UI、E2E、截图完成 |
| 官方 74 张逐卡对象全集，分事件 43 / 物品 22 / 预兆 9 | 第 3-5 节对象表；6.20 复核 74 行、11 列、0 空字段；6.22 复核运行池与 atlas 一致 | `S0-pass` | 不等于 74 张牌所有机制和组合完成 |
| 每张牌最小字段齐全 | 6.20 复核每行均有来源、素材、运行、后续、状态和下一步；未从图包锁定英文名的字段显式保留未锁 | `S0-pass-with-allowed-partial` | 不能用百度、社区表或旧实现补英文名 / 原文并标 locked |
| 当前 23 事件 / 12 物品 / 9 预兆与官方 74 张差异 | 0.3 与第 1 节保留原始差异：缺 20 事件 + 10 物品；同时记录当前 43/22/9 已接齐 | `S0-pass` | 当前数量对齐不能倒推旧缺口不存在 |
| 物品运行池、裁图 manifest、atlas alias 和 duplicate-alias | 4.1、6.2、6.6、6.22 均记录官方 22 物品覆盖 frame 0-21；`lantern/notebook/journal/manuscript` 为 legacy alias | `S0-pass` | alias 不能按额外官方物品计数 |
| 事件官方 43、原运行 23、TTS 9x5 manifest 42 候选差异 | 0.1、0.3、3.1、6.7、6.22 记录旧 42 候选来自 `ContainedObjects` 扫描；frame 42 是有效事件正面，43 空格，44 背面 | `S0-pass` | 旧 manifest 不能证明图包缺 E43 |
| 预兆逐卡效果合同 + 作祟公共规则合同 | 第 5 节、5.0、5.1、6.4、6.14 分别维护 9 张预兆和公共作祟规则两层账本 | `S0-pass / downstream-open` | 预兆数量正确不等于预兆 UI 或作祟 UI 完成 |
| 禁止 Board/UI、实现、E2E、截图升级 | 当前 6.20-6.23 只新增 evidence/temp 合同审计；7、8 节继续禁止升级 | `pass` | 若后续进入实现/UI/E2E/截图，必须重新锁定阶段目标和验收 |

S0 出口裁定：

- `S0 合同层完成`：74 张对象、图包主真相源、素材/atlas/frame、旧运行池差异、duplicate alias、预兆 / 作祟两层合同和当前运行池三方一致性均已入同一主合同。
- `整体仍不完成`：事件 / 物品 / 预兆仍有逐卡机制、UI 承接、组合测试、完整作祟流程、真实入口 E2E 和截图缺口；这些只允许作为 `downstream-gated` 后续队列，不允许反过来否定 S0 合同层已闭合。
- `当前不需要用户补整包素材`：只有未来出现具体单卡裁图不可读、frame/hash 对不上、主图包与用户指定新权威来源冲突，才点名请求补源或裁定。

### 6.24 下游阶段切换包（2026-07-29）

本节不新增 Board/UI、E2E、截图或卡牌效果实现，只把 S0 出口后的后续阶段拆成可领取入口，避免把 `继续` 误读成“任意批量实现”或“整牌库完成”。结构化副本落在 `temp/betrayal-full-deck-next-stage-switch-package-2026-07-29.json`。

| 候选阶段 | 可消费合同入口 | 进入前必须重新锁定 | 当前仍禁止 | 本阶段最小可验收证据 |
| --- | --- | --- | --- | --- |
| 事件剩余分支 S1/S2 | 6.12、6.17、`event-effect-implementation-audit-2026-07-29.md` | 点名事件、具体分支、伤害 / 目标 / 重掷消费者、验证范围 | 不得批量补 43 张事件，不得把新增配置事件代表链外推成逐事件完成 | 对应事件缺口桶状态更新；若获授权实现，再补定向领域测试与实现消费审计 |
| 物品机制 / 组合 S1/S2 | 6.13、6.17、`item-effect-implementation-audit-2026-07-29.md` | 点名物品、消费场景、组合对象、是否只做领域链还是要 UI | 不得新增 UI，不得把 22 张数量 / atlas 一致说成物品牌效果完成 | 对应物品消费桶状态更新；若获授权实现，再补组合领域测试和顺序说明 |
| 预兆逐卡 / 作祟公共规则 S1/S2 | 5、5.1、6.14、`omen-and-haunt-rule-implementation-audit-2026-07-29.md` | 点名预兆或公共规则点、交易 / 死亡 / 探索 / 作祟触发组合、验证边界 | 不得因 9 张数量正确或公共规则代表链通过而宣称预兆完成 | 逐卡或公共规则缺口桶更新；若获授权实现，再补领域证据矩阵对应行 |
| 7 号作祟完整流程 S2/S3 | E10、6.14、6.17、`docs/games/betrayal/haunts/07-upon-reflection.md` | 完整目标：秘密组合、镜中怪物移动 / 攻击、镜中提示、破咒 UI、公开 / 私密可见性 | 不得把怪异的镜子 5+ 代表入口、破咒最小领域链或镜中怪物代表链说成完整作祟 | 领域完整链 + UI 承接 + 后续真实入口验证；未授权前只维护子账本 |
| UI 承接 S3 | 6.18、6.17、各专项实现消费索引 | 点名 UI 承接对象、玩家动作、状态提示、真实入口和验收口径 | 当前合同续跑不得改 Board/UI，不得截图，不得用旧截图验收 | 授权后才允许 UI 改动；完成证据必须是对应真实入口验证，而非合同表 |
| E2E / 截图 S3/S4 | 6.7、6.9、6.15、6.18 | 点名测试入口、场景、截图视角、覆盖对象、可接受失败边界 | 当前不得跑 E2E、不得截图、不得打开验收图 | 授权后按真实入口跑；截图只证明截图覆盖的场景，不能外推整牌库 |
| 脚注音频 / 展示资源 S3/S4 | E26、6.18、资源链路规范 | 点名脚注展示还是音频资源、素材来源、上传和远端回查口径 | 不得把无线电广播脚注展示缺口当规则结算缺口，也不得无素材接音频 | 授权后补资源来源、压缩 / 上传 / HEAD 回查和 UI 展示证据 |

切换口径：

1. 当前合同层已经没有“请用户补整包图包素材”的阻塞；若未来需要用户，只能点名到具体单卡、具体 frame/hash、具体不可读裁图或具体来源冲突。
2. 若继续保持合同层，下一步只允许维护缺口桶、专项入口边界、状态口径和授权前检查，不做代码实现。
3. 若用户明确授权进入实现，必须先从上表选一个候选阶段并重新锁定：`问题对象 / 真相来源 / 目标入口 / 验收口径`。
4. 若用户明确授权 UI/E2E/截图，也不能用 UI 绿灯反证规则录入正确；仍要回到本合同和专项入口判断每项证据覆盖范围。

### 6.25 下游具体工作单领取清单（2026-07-29）

本节承接 6.24，只把“后续可以继续做什么”拆成可领取工作单；不新增 Board/UI、E2E、截图、卡牌效果、物品效果、预兆效果或作祟逻辑。结构化副本落在 `temp/betrayal-full-deck-work-orders-2026-07-29.json`。这些工作单的用途是让后续“继续”默认有明确合同入口，不再重复盘点 74 张对象、图包或旧运行池差异。

| 工作单 | 消费入口 | 当前可做的合同动作 | 未授权前禁止 | 进入下游前必须重新锁定 |
| --- | --- | --- | --- | --- |
| WO-01 事件剩余分支 | 6.12、6.17、事件专项实现消费索引 | 逐事件登记剩余分支、伤害 / 目标 / 属性 / 重掷消费者、已存在最小证据和下一步最小补证入口 | 不得批量补 43 张事件；不得跑 E2E / 截图；不得把代表链外推为逐事件完成 | 点名事件、点名分支、消费者边界、验证范围 |
| WO-02 物品机制与组合消费者 | 6.13、6.17、物品专项实现消费索引 | 按作祟检定、治疗、重掷、攻击、防御、死亡保护、移动、交易限制等消费者维护顺序假设和缺口状态 | 不得新增物品 UI；不得改伤害 / 减免 / 死亡保护；不得因 22 张数量一致宣称物品效果完成 | 点名物品、消费场景、组合对象、领域链或 UI 范围 |
| WO-03 预兆逐卡效果 | 第 5 节、6.14、预兆/作祟专项实现消费索引 | 逐卡登记领域代表链、仍缺 UI 承接、交易 / 死亡 / 作祟期组合和不得外推范围 | 不得新增预兆 UI；不得修改预兆效果实现；不得用 9 张数量证明逐卡完成 | 点名预兆、效果分支、组合场景、验证边界 |
| WO-04 作祟公共规则 | 5.1、6.14、预兆/作祟专项实现消费索引 | 保持公共规则独立于单张预兆；登记领域证据、UI 风险显示和翻牌确认缺口 | 不得把作祟检定并入单张预兆；不得新增作祟 UI；不得跑 E2E / 截图 | 公共规则点、组合场景、目标入口、验收口径 |
| WO-05 7 号作祟完整流程子账本 | E10、6.14、6.17、`docs/games/betrayal/haunts/07-upon-reflection.md` | 维护 `representative-only / downstream-open` 子账本，列出最小领域链与缺失 UI/完整流程证据 | 不得把怪异的镜子 5+ 入口、破咒最小链或镜中怪物代表链说成完整 7 号作祟 | 具体 7 号机制节点、公开/私密可见性、UI 承接对象、领域与真实入口验收 |
| WO-06 UI 承接授权前置 | 6.17、6.18、各专项实现消费索引 | 登记未来 UI 需要消费哪条合同、哪个玩家动作和哪个状态真相 | 不得改 Board/UI；不得截图；不得打开图片 | UI 承接对象、玩家动作、真实入口、验收证据 |
| WO-07 E2E 与截图授权前置 | 6.7、6.9、6.15、6.18 | 继续把旧 E2E/截图标为历史代表链；登记未来测试入口覆盖对象和不能外推范围 | 不得运行 E2E；不得截图；不得打开验收图 | 测试入口、场景、截图视角、覆盖对象 |
| WO-08 无线电广播脚注展示/音频资源前置 | E26、6.18、资源链路规范 | 维持脚注为展示/音频提示，不参与规则结算；登记未来资源来源、压缩、上传和 HEAD 回查口径 | 不得新增脚注 UI；不得接入猜测音频；不得跳过资源上传回查 | 展示还是音频、素材来源、运行时落点、远端回查验收 |

工作单裁定：

1. 当前不需要用户补整包图包，也没有发现“导入错 / atlas 缺正面”的阻塞；需要用户的情形只能是未来某个具体单卡、frame/hash、不可读裁图或指定新权威来源冲突。
2. 若仍停在合同层，后续默认从 WO-01 到 WO-08 维护缺口桶、证据边界、状态口径和授权前检查；这仍属于 `in_progress / downstream-gated`（历史旧别名：`downstream-blocked`），不是实现完成。
3. 若用户下一轮明确说“开始实现某个对象 / 做 UI / 跑 E2E / 截图”，必须先选择对应工作单，并重新锁定 `问题对象 / 真相来源 / 目标入口 / 验收口径`。
4. 本节不能被引用为“已经完成下游工作”的证据；它只证明 S0 出口后的下游入口已经拆清楚。

### 6.26 WO-01 领取结果：25 张非纯 `locked` 事件剩余分支合同队列（2026-07-29）

本节领取 6.25 的 WO-01，只消费 6.12、6.17 和 `event-effect-implementation-audit-2026-07-29.md`；不新增事件实现、Board/UI、E2E、截图或图片复读。结构化副本落在 `temp/betrayal-event-branch-work-order-2026-07-29.json`。

| 缺口桶 | 覆盖事件 | 当前合同动作 | 未授权前仍禁止 |
| --- | --- | --- | --- |
| 伤害 / 死亡保护 / 减免组合 | 不可能的房间、地狱蝙蝠、断手、花团锦簇、晦暗暴风夜、佳馔满桌、禁忌知识、可怜的尤里克、轮到约拿了、无线电广播、摇曳灯光、游魂、一声呼救、着火的人、上古旧宅、肉质苔癣、脑状食品、吊死鬼、一条秘密通道 | 消费 6.17 跨消费者索引，补齐伤害类型、减免/改写、直接属性降低和死亡保护顺序说明 | 不改伤害逻辑；不补领域测试；不把代表链外推为组合完成 |
| 目标候选 / 房间合法性 / UI 状态真相 | 地狱蝙蝠、花团锦簇、技术难点、秘密升降机、一条秘密通道、一声呼救、上古旧宅 | 消费 6.17 目标候选状态真相，补候选来源、非法原因和后续 UI 承接字段；当前后续已补地狱蝙蝠、花团锦簇、秘密升降机、一条秘密通道、一声呼救和上古旧宅的 Board 组件目标选择代表链，技术难点已补确定性起始点放置与地下室精神伤害 Board 组件代表链 | 不把 Board 组件代表链外推为真实入口 E2E / 截图；不批量改其它事件 Board/UI；不截图 |
| 物品 / 牌堆 / 持有物选择 | 不可能的房间、断手、轮到约拿了、游魂、一罐器官 | 列明抽物品牌堆耗尽、非武器筛选、已用/不可交易、埋葬/弃置和持有物来源边界 | 不改持有物筛选或牌堆结算；不补 UI 选择 |
| 投骰 / 属性 / 重掷消费者 | 佳馔满桌、禁忌知识、可怜的尤里克、片刻希望、神秘液体、摇曳灯光、着火的人、上古旧宅、肉质苔癣、脑状食品、吊死鬼、一条秘密通道 | 列明属性上下限、固定骰/事件骰、祝福加骰、兔脚/恐怖玩偶/幸运硬币/天使之羽准入边界 | 不改重掷/替代投骰逻辑；不补组合测试 |
| 作祟特例 / 展示音频 | 怪异的镜子、无线电广播 | 保持 7 号代表链和无线电广播脚注展示/音频裁定，不升级为完整作祟或资源接入 | 不实现完整 7 号作祟；不接脚注 UI/音频；不跑 E2E/截图 |

WO-01 当前裁定：

1. 20 张事件仍是 `event-effect-matrix-indexed / broad-domain-partial-verified / downstream-open`，不是完成。
2. 后续若仍按合同层继续，可在上述 5 个缺口桶里继续补证据边界和授权前检查；不需要重新盘点官方 43 张事件数量或回到图包。
3. 后续若要进入实现，必须点名“哪张事件 + 哪个分支 + 哪个消费者组合 + 哪个验证口径”，不得按 20 张或 43 张批量开改。
4. 该节只把 WO-01 变成可消费队列，不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.27 WO-02 领取结果：22 张物品消费者合同队列（2026-07-29）

本节领取 6.25 的 WO-02，只消费 6.13、6.17 和 `item-effect-implementation-audit-2026-07-29.md`；不新增物品效果、Board/UI、E2E、截图或图片复读。结构化副本落在 `temp/betrayal-item-consumer-work-order-2026-07-29.json`。

| 缺口桶 | 覆盖物品 | 当前合同动作 | 未授权前仍禁止 |
| --- | --- | --- | --- |
| 伤害减免 / 伤害改写 / 死亡保护 | 头戴耳机、奇异护符、胸针、皮夹克、幸运硬币、牙齿项链 | 消费 6.17 伤害/死亡保护索引，继续记录减免、改写、实际承受、濒死恢复和死亡保护顺序 | 不改伤害结算；不补组合测试；不把单物品领域链外推为顺序全闭合 |
| 武器攻击 / 多武器互斥 / 交易限制 | 枪、十字弓、砍刀、电锯、炸药 | 记录攻击来源、目标类型、视线/相邻/同板块、怪物目标、用后交易限制和多武器互斥 | 不改攻击 UI；不改交易限制；不补怪物/作祟攻击组合 |
| 治疗 / 属性恢复 / 同房目标 | 奇怪的药品、镜子、急救包、牙齿项链 | 记录治疗目标合法性、回合时点、同房限制、作祟/死亡保护组合 | 不新增治疗 UI；不改死亡保护或回合结束流程 |
| 重掷 / 替代数值 / 属性检定消费者 | 恐怖玩偶、幸运硬币、兔脚、天使之羽、手电筒、魔法相机 | 记录最近投骰回滚、固定骰边界、非战斗检定、祝福/额外骰、作祟特殊行动准入；天使之羽页面 0-8 数字选择代表链已由 2026-07-29 灰尘主动持有牌 E2E 补齐 | 不改重掷/替代投骰逻辑；不补重掷/加骰组合测试；不默认新增消费者全可重掷 |
| 移动 / 地图 / 门位墙体 | 地图、骨制钥匙、急救包、炸药 | 记录已发现房间、同房目标、墙体/门位、目标板块和作祟地图规则缺口 | 不改地图移动 UI；不改房间/门位合法性 |
| 额外行动 / 回合时点 / 作祟状态 | 神秘秒表、牙齿项链、镜子、魔法相机 | 记录作祟前后可用性、回合结束拦截、额外行动交接和作祟消费者再审条件 | 不改回合流转；不补作祟 UI；不跑 E2E/截图 |
| duplicate alias guard | 地图 | 继续把 notebook / journal / manuscript 和 lantern 作为 legacy alias / duplicate-alias，不计入官方 22 张之外的新物品 | 不按 alias 行数新增官方物品；不改 atlas 计数 |

WO-02 当前裁定：

1. 22 张物品仍是 `item-effect-matrix-indexed / mixed-domain-verified / downstream-open`，不是完成。
2. 后续若仍按合同层继续，可在上述 7 个缺口桶里继续维护消费者边界、顺序假设和授权前检查；不需要重新盘点 22 张物品数量或 atlas。
3. 后续若要进入实现，必须点名“哪张物品 + 哪个消费场景 + 哪个组合对象 + 领域链还是 UI 范围”，不得按 22 张批量开改。
4. 该节只把 WO-02 变成可消费队列，不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.28 WO-03/WO-04 领取结果：预兆逐卡与作祟公共规则合同队列（2026-07-29）

本节合并领取 6.25 的 WO-03 和 WO-04，只消费第 5 节、5.1、6.14 和 `omen-and-haunt-rule-implementation-audit-2026-07-29.md`；不新增预兆效果、作祟公共流程、Board/UI、E2E、截图或图片复读。结构化副本落在 `temp/betrayal-omen-haunt-work-order-2026-07-29.json`。

| 缺口桶 | 覆盖对象 / 公共规则 | 当前合同动作 | 未授权前仍禁止 |
| --- | --- | --- | --- |
| 属性检定加值 / 非战斗检定替代 | 书本、狗、面具、头骨、圣符、盔甲、雕像、指环 | 继续登记各预兆的属性加值消费者、书本非战斗检定替代、固定骰/战斗检定排除和濒死成本边界 | 不改检定替代逻辑；不补 UI 数字/按钮；不把代表领域链外推为全部检定消费者闭合 |
| 交易 / 持有物转移 / 已用牌限制 | 狗；作祟公共规则的全员当前持有预兆总数 | 把狗交易与公共作祟风险拆开：狗只负责交易动作，全员预兆数只负责风险读模型；记录交易、死亡掉落、遗物转移、搜尸后的风险刷新缺口 | 不新增交易 UI；不改作祟风险计算；不跑真实入口验证 |
| 探索 / 房间 / 事件符号消费者 | 圣符、雕像；抽到预兆后的作祟检定 | 记录圣符埋葬房间并继续探索、雕像跳过事件符号房间、抽预兆触发作祟检定的边界；继续隔离事件/房间/作祟探索消费者 | 不改探索流程；不补房间或作祟 UI；不把探索代表链外推为所有房间/事件组合完成 |
| 攻击 / 武器 / 伤害类型 | 指环、匕首、盔甲、头骨 | 记录指环/匕首显式武器选择、多武器互斥、速度成本、精神/物理伤害类型、盔甲减伤和头骨死亡保护顺序 | 不改攻击 UI；不改伤害/死亡保护结算；不补怪物/作祟攻击组合测试 |
| 移动 / 多目标 / 怪物与探索者 | 面具 | 记录同板块其他探索者和怪物、多目标分别指定、相邻已发现板块、死亡目标和怪物回合组合缺口 | 不新增多目标 UI；不改怪物移动或目标选择规则 |
| 作祟风险 / 8 骰上限 / 最后一张自动作祟 | 全员当前持有预兆总数、抽预兆检定、5+ 触发、最多 8 骰、最后一张预兆自动作祟 | 保持公共规则独立账本：记录风险 UI、骰盘展示、翻牌确认、剧本卡/揭秘者/触发预兆显示和最后一张自动触发组合缺口 | 不把公共规则并入某张预兆；不新增作祟揭示 UI；不跑 E2E/截图 |
| 翻牌确认队列 / 真实入口承接 | 普通预兆触发作祟、最后一张自动作祟、作祟检定确认 | 登记确认队列、确认前移动拒绝、确认后清队列、作祟揭示与阵营/首行动提示的授权前入口 | 不改 Board 翻牌确认；不截图；不把组件证据外推为真实入口完整链 |

WO-03/WO-04 当前裁定：

1. 9 张预兆仍是 `omen-effect-matrix-indexed / min-domain-verified / partial-ui / downstream-open`，不是逐卡 UI/组合完成。
2. 作祟公共规则仍是 `public-haunt-rule-indexed / min-domain-verified / partial-ui / downstream-open`，不是作祟揭示 UI、完整 7 号作祟、木乃伊完整流程或 E2E/截图完成。
3. 后续若仍按合同层继续，可在上述 7 个缺口桶里维护消费者边界、风险/翻牌 UI 状态真相和授权前检查；不需要重新盘点 9 张预兆数量或回到图包。
4. 后续若要进入实现，必须点名“哪张预兆或哪条公共规则 + 哪个消费场景 + 哪个目标入口 + 领域链还是 UI 范围”，不得按 9 张预兆或整套作祟公共规则批量开改。
5. 该节只把 WO-03/WO-04 变成可消费队列，不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.29 WO-05 领取结果：7 号作祟完整流程子账本合同队列（2026-07-29）

本节领取 6.25 的 WO-05，只消费 E10、6.12、6.17、6.18 和 `docs/games/betrayal/haunts/07-upon-reflection.md`；不新增 7 号作祟实现、专属 UI、E2E、截图或图片复读。结构化副本落在 `temp/betrayal-haunt-07-work-order-2026-07-29.json`。

| 缺口桶 | 覆盖机制 | 当前合同动作 | 未授权前仍禁止 |
| --- | --- | --- | --- |
| 触发入口 / 代表链边界 | 怪异的镜子 5+ 进入 7 号作祟；无叛徒代表揭示态 | 继续把怪异的镜子 5+ 入口标为 `haunt-7-representative / min-domain-verified / partial`，不得把它写成完整 7 号作祟 | 不扩大 `BETRAYAL_IMPLEMENTED_HAUNT_CARD_NUMBERS`；不宣称完整作祟实现 |
| 公开 / 私密可见性 | 作祟揭秘者被困镜中、秘密 Trait/Omen/Room 组合、普通玩家隐藏组合 | 保持秘密组合和 playerView 私密裁定；记录作祟揭秘者沉默只能通过状态短语和后续 UI 承接 | 不新增私密 UI；不把领域状态说成玩家可见承接完成 |
| setup 队列 / manual-check | 作祟揭秘者倒伏沉默、秘密组合抽取、镜中怪物放置、怪物卡位置、首行动玩家 | 区分已能领域自动 resolved 的 `deal-secret-mirror-combination` 与仍需人工/专属 UI 的沉默、怪物卡、首行动确认 | 不把 setup 队列清理写成完整 setup UI；不截图 |
| 破咒特殊行动 | 英雄选择属性、报出持有预兆、当前房间自动带入、5+ 且三项全中英雄胜利 | 保留命令校验、行动预算、0-4 无反馈、组合错误只给否定反馈、全中胜利的最小领域链；列出属性/预兆/房间三联 UI 缺口 | 不改破咒命令；不新增破咒 UI；不跑真实入口 |
| 镜中提示 | 作祟揭秘者每回合一次从事件牌堆选择事件给存活玩家提示，事件不结算并放一边 | 保留 `GIVE_MIRROR_HINT` 领域链；登记私密事件选择、目标玩家选择、放一边牌区和每回合一次提示缺口 | 不新增提示 UI；不改事件牌堆结算 |
| 事件符号房间 | 7 号作祟期间事件符号房间不抽事件、不结算、不结束回合 | 保留事件符号房间跳过事件的最小领域链；记录探索 UI、日志/提示、房间组合缺口 | 不改探索流程；不补房间 E2E |
| 镜中怪物移动 / 平手裁决 | Mirror Being 向最近可攻击探索者移动；平手路径由作祟揭秘者裁决；已同房不离开；不以作祟揭秘者为目标 | 保留最近目标移动、平手路径、已同房不离开和目标过滤领域代表链；登记专属移动/目标选择 UI 和完整怪物回合组合缺口 | 不改怪物移动；不新增专属 UI；不把代表链外推为完整怪物回合 |
| 镜中怪物攻击 / 精神伤害 | Mirror Being 同房普通攻击用神志；造成精神伤害，只能分配知识 / 神志 | 保留神志攻击、mental damage、精神属性分配领域代表链；登记伤害 UI、死亡保护和作祟攻击组合缺口 | 不改攻击/伤害逻辑；不补 E2E/截图 |
| 完整流程验收 | 错误组合反馈、正确组合胜利、秘密提示、怪物回合、公开/私密 UI、真实入口 | 仅维护未来验收入口：领域完整链、专属 UI、真实入口测试和截图仍是下游授权项 | 不跑 E2E；不截图；不打开图片 |

WO-05 当前裁定：

1. 7 号作祟仍是 `haunt-07-subledger-indexed / representative-only / min-domain-verified / downstream-open`，不是完整实现。
2. 已有证据能支撑秘密组合、破咒、事件符号房间、镜中提示、镜中怪物移动/攻击的领域代表链；不能支撑专属 UI、完整怪物回合、真实入口 E2E 或截图。
3. 后续若仍按合同层继续，可维护上述 9 个缺口桶和授权前检查；不需要重新读怪异的镜子卡图或重跑 7 号测试。
4. 后续若要进入实现，必须点名“7 号哪个机制节点 + 公开/私密可见性 + UI 承接对象 + 领域或真实入口验收”，不得以“完整 7 号”泛化开改。
5. 该节只把 WO-05 变成可消费子账本，不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.30 WO-06/WO-07/WO-08 领取结果：UI / E2E / 截图 / 脚注音频授权前置清单（2026-07-29）

本节合并领取 6.25 的 WO-06、WO-07 和 WO-08，只消费 6.7、6.9、6.17、6.18 和结构化工作单清单；不修改 Board/UI，不运行 E2E，不截图，不打开图片，不接入音频或上传资源。结构化副本落在 `temp/betrayal-ui-e2e-asset-preflight-work-order-2026-07-29.json`。

| 前置组 | 覆盖对象 | 当前合同动作 | 未授权前仍禁止 |
| --- | --- | --- | --- |
| UI 承接授权前置 | 事件目标候选与非法原因；物品使用 / 治疗 / 武器 / 重掷 / 死亡保护 / 交易限制 / 移动消费者；预兆逐卡效果、作祟风险、翻牌确认；7 号作祟破咒、镜中提示、镜中怪物移动 / 攻击和公开 / 私密信息 | 登记未来 UI 必须消费的合同、玩家动作、状态真相和最低验收证据；保持 `Board.tsx` 和 UI 组件不变 | 不改 Board/UI；不新增交互入口；不截图；不打开图片 |
| E2E 与截图授权前置 | 旧 E2E / 旧截图历史代表链；未来真实入口 E2E 场景；未来截图视角、覆盖对象和不得外推范围 | 继续把旧 E2E/截图标为历史证据，登记未来测试/截图必须点名的对象、场景和验收口径 | 不运行 Playwright 或其它 E2E；不生成截图；不打开或发布验收图 |
| 无线电广播脚注展示 / 音频资源前置 | 无线电广播脚注展示、可能的音频提示资源、未来资源压缩 / 上传 / HEAD 回查口径 | 维持脚注为展示 / 音频提示，不参与规则结算；仅登记未来资源链路准入条件 | 不新增脚注 UI；不接入音频；不移动或压缩运行时资源；不上传服务器素材主源 |

WO-06/WO-07/WO-08 当前裁定：

1. UI、E2E、截图和脚注音频均进入 `authorization-preflight-indexed / downstream-open`，不是完成。
2. 当前没有需要用户补整包素材的事项；只有未来发现具体单卡裁图不可读、frame/hash 对不上、或用户指定新权威来源与当前合同冲突时，才需要点名请求补源或裁定。
3. 后续若仍按合同层继续，可维护上述 3 个前置组的消费者边界、旧证据降级口径和授权前检查；不得把它当作真实入口验收。
4. 后续若要进入 UI、E2E、截图或音频 / 资源链，必须先点名具体工作单、对象、真相来源、目标入口和验收口径。
5. 该节只把 WO-06/WO-07/WO-08 变成可消费的授权前置清单，不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.31 工作单覆盖闭环审计：WO-01 到 WO-08 均已结构化（2026-07-29）

本节只审计 6.25 工作单清单是否都已经有合同段落和结构化副本；不修改 Board/UI，不运行 E2E，不截图，不接音频，不上传资源。结构化副本落在 `temp/betrayal-full-deck-work-order-coverage-audit-2026-07-29.json`。

| 工作单 | 合同段落 | 结构化副本 | 覆盖状态 | 不得外推 |
| --- | --- | --- | --- | --- |
| WO-01 事件剩余分支 | 6.26 | `temp/betrayal-event-branch-work-order-2026-07-29.json` | `indexed` | 不证明 43 张事件完整机制 / UI / 测试完成 |
| WO-02 物品机制与组合消费者 | 6.27 | `temp/betrayal-item-consumer-work-order-2026-07-29.json` | `indexed` | 不证明 22 张物品 UI、组合和顺序验证完成 |
| WO-03 预兆逐卡效果 | 6.28 | `temp/betrayal-omen-haunt-work-order-2026-07-29.json` | `indexed` | 不证明 9 张预兆逐卡 UI 或组合完成 |
| WO-04 作祟公共规则 | 6.28 | `temp/betrayal-omen-haunt-work-order-2026-07-29.json` | `indexed` | 不证明作祟揭示 UI 或完整作祟流程完成 |
| WO-05 7 号作祟完整流程子账本 | 6.29 | `temp/betrayal-haunt-07-work-order-2026-07-29.json` | `indexed` | 不证明完整 7 号作祟实现 |
| WO-06 UI 承接授权前置 | 6.30 | `temp/betrayal-ui-e2e-asset-preflight-work-order-2026-07-29.json` | `indexed` | 不证明 Board/UI 已修改或验收 |
| WO-07 E2E 与截图授权前置 | 6.30 | `temp/betrayal-ui-e2e-asset-preflight-work-order-2026-07-29.json` | `indexed` | 不证明 E2E 或截图已运行 |
| WO-08 无线电广播脚注展示/音频资源前置 | 6.30 | `temp/betrayal-ui-e2e-asset-preflight-work-order-2026-07-29.json` | `indexed` | 不证明脚注 UI、音频或资源上传完成 |

覆盖闭环裁定：

1. 6.25 列出的 8 个工作单都已进入合同段落和结构化副本；当前合同层队列本身已可追踪。
2. 这只说明工作单覆盖闭环，不说明整牌库完成；整牌库仍是 `in_progress / downstream-blocked`。
3. 后续若继续合同层，应选择某个未闭合缺口桶或授权前置组继续补边界；不需要再重开官方 74 张计数或整包图包核对。
4. 后续若进入实现、UI、E2E、截图、音频或资源上传，必须从某一个具体工作单重新锁定问题对象、真相来源、目标入口和验收口径。

### 6.32 下一对象 / 缺口桶选择器（2026-07-29）

本节只把 6.26-6.30 已形成的工作单缺口桶整理成“下一步怎么继续”的选择器；不修改 Board/UI，不运行 E2E，不截图，不打开图片，不接入音频，不移动、压缩或上传资源。结构化副本落在 `temp/betrayal-full-deck-next-bucket-selector-2026-07-29.json`。

| 下一桶 | 来源工作单 | 覆盖对象 / 规则 | 合同层下一步 | 未授权前禁止 |
| --- | --- | --- | --- | --- |
| NB-01 事件伤害 / 死亡保护 / 减免组合 | WO-01 | 不可能的房间、地狱蝙蝠、断手、花团锦簇、晦暗暴风夜、佳馔满桌、禁忌知识、可怜的尤里克、轮到约拿了、无线电广播、摇曳灯光、游魂、一声呼救、着火的人、上古旧宅、肉质苔癣、脑状食品、吊死鬼、一条秘密通道 | 拆精神伤害、物理伤害、通用伤害、直接属性降低、伤害改写和死亡保护顺序证据边界 | 不改伤害结算；不补组合测试；不新增 UI 伤害分配 |
| NB-02 事件目标候选 / 房间合法性 | WO-01 | 地狱蝙蝠、花团锦簇、技术难点、秘密升降机、一条秘密通道、一声呼救、上古旧宅 | 记录候选来源、非法原因、楼层 / 区域 / 未发现限制和 UI 承接字段；当前后续已补地狱蝙蝠、花团锦簇、秘密升降机、一条秘密通道、一声呼救和上古旧宅的 Board 组件目标选择代表链，技术难点已补确定性起始点放置与地下室精神伤害 Board 组件代表链 | 不把 Board 组件代表链外推为真实入口 E2E / 截图；不批量改其它事件 Board/UI；不截图 |
| NB-03 事件物品 / 牌堆 / 持有物选择 | WO-01 | 不可能的房间、断手、轮到约拿了、游魂、一罐器官 | 登记抽物品牌堆耗尽、非武器筛选、已用 / 不可交易、埋葬 / 弃置和持有物来源边界 | 不改持有物筛选、牌堆结算或 UI 选择 |
| NB-04 事件投骰 / 属性 / 重掷消费者 | WO-01 | 佳馔满桌、禁忌知识、可怜的尤里克、片刻希望、神秘液体、摇曳灯光、着火的人、上古旧宅、肉质苔癣、脑状食品、吊死鬼、一条秘密通道 | 拆属性上下限、固定骰 / 事件骰、祝福加骰、兔脚 / 恐怖玩偶 / 幸运硬币 / 天使之羽准入边界；天使之羽页面 0-8 数字选择已另由物品主动牌代表链补证 | 不改重掷或替代投骰逻辑；不补重掷 / 加骰 / 事件分支组合测试 |
| NB-05 事件作祟特例 / 展示音频 | WO-01 | 怪异的镜子、无线电广播 | 隔离 7 号作祟代表链与无线电广播脚注展示 / 音频资源，不升级为完整作祟或资源接入 | 不实现完整 7 号作祟；不接脚注 UI / 音频；不跑 E2E / 截图 |
| NB-06 物品伤害减免 / 伤害改写 / 死亡保护 | WO-02 | 头戴耳机、奇异护符、胸针、皮夹克、幸运硬币、牙齿项链 | 记录减免、改写、实际承受、濒死恢复和死亡保护顺序 | 不改伤害 / 减免 / 死亡保护规则；不新增组合领域测试 |
| NB-07 物品武器攻击 / 多武器互斥 / 交易限制 | WO-02 | 枪、十字弓、砍刀、电锯、炸药 | 记录攻击来源、目标类型、视线 / 相邻 / 同板块、怪物目标、用后交易限制和多武器互斥 | 不改攻击 UI、交易限制或怪物 / 作祟攻击组合测试 |
| NB-08 物品治疗 / 属性恢复 / 同房目标 | WO-02 | 奇怪的药品、镜子、急救包、牙齿项链 | 记录治疗目标合法性、回合时点、同房限制、作祟 / 死亡保护组合 | 不新增治疗 UI；不改回合时点或死亡保护组合测试 |
| NB-09 物品重掷 / 替代数值 / 属性检定消费者 | WO-02 | 恐怖玩偶、幸运硬币、兔脚、天使之羽、手电筒、魔法相机 | 记录最近投骰回滚、固定骰边界、非战斗检定、祝福 / 额外骰、作祟特殊行动准入；天使之羽页面 0-8 数字选择和使用后状态写入已有 E2E 代表链 | 不改重掷 / 替代投骰逻辑；不补攻击 / 作祟边界或加骰组合测试 |
| NB-10 物品移动 / 地图 / 门位墙体 | WO-02 | 地图、骨制钥匙、急救包、炸药 | 记录已发现房间、同房目标、墙体 / 门位、目标板块和作祟地图规则缺口 | 不改地图移动 UI、房间 / 门位合法性或目标板块选择 |
| NB-11 预兆属性检定加值 / 非战斗检定替代 | WO-03 | 书本、狗、面具、头骨、圣符、盔甲、雕像、指环 | 登记属性加值消费者、书本非战斗检定替代、固定骰 / 战斗排除和濒死成本边界 | 不改检定替代逻辑；不补 UI 数字 / 按钮或组合测试 |
| NB-12 预兆交易 / 持有物转移 / 已用牌限制 | WO-03 | 狗、全员当前持有预兆总数 | 分离狗交易动作与作祟风险读模型，登记死亡掉落、遗物转移、搜尸后的风险刷新缺口 | 不新增交易 UI；不改作祟风险计算或真实入口验证 |
| NB-13 作祟风险 / 8 骰上限 / 最后一张自动作祟 | WO-04 | 全员当前持有预兆总数、抽到预兆后的作祟检定、5+ 开始作祟、最多 8 骰、最后一张预兆自动作祟 | 保持公共规则独立账本，登记风险 UI、骰盘展示、剧本卡 / 揭秘者 / 触发预兆显示和最后一张自动触发组合 | 不新增作祟揭示 UI；不改公共作祟流程；不跑 E2E / 截图 |
| NB-14 7 号作祟公开 / 私密可见性与 setup | WO-05 | 作祟揭秘者、秘密 Trait/Omen/Room 组合、镜中怪物放置、怪物卡、首行动玩家 | 区分领域可自动 resolved 与仍需人工 / 专属 UI 的 setup 项，登记秘密组合与普通玩家隐藏组合 UI 缺口 | 不新增私密 UI、完整 setup UI、E2E 或截图 |
| NB-15 7 号作祟破咒 / 镜中提示 / 镜中怪物移动攻击 | WO-05 | 破咒特殊行动、镜中提示、镜中怪物移动、镜中怪物攻击、完整流程验收 | 登记三联破咒 UI、提示事件选择、平手路径裁决、精神伤害分配和完整流程验收入口 | 不实现完整 7 号作祟；不新增专属 UI；不跑真实入口 E2E 或截图 |
| NB-16 UI / E2E / 截图 / 脚注音频授权前置 | WO-06/WO-07/WO-08 | 发现牌 UI 承接、旧 E2E/截图降级、无线电广播脚注展示 / 音频资源 | 维护未来 UI 消费入口、旧证据降级边界、测试 / 截图覆盖对象和资源链准入条件 | 不改 Board/UI；不运行 E2E；不截图；不打开图片；不接音频或上传资源 |

选择器裁定：

1. 推荐的合同层继续顺序是 NB-01、NB-06、NB-09、NB-13、NB-14、NB-16；这是为了优先维护跨消费者最多、最容易被误读为“已经完成”的缺口桶。
2. 该选择器只提供下一步合同层入口，不授权实现、Board/UI、E2E、截图、图片打开、音频接入或资源上传。
3. 若用户授权进入实现，必须从上表选一个具体桶，再点名一张牌、一个公共规则或一个 7 号作祟机制节点，重新锁定 `问题对象 / 真相来源 / 目标入口 / 验收口径`。
4. 若某个桶暴露具体单卡裁图不可读、frame/hash 对不上或新权威来源冲突，只降级该对象或字段，并点名最小补源动作；不得把整包图包重新判为缺失。
5. 当前总状态继续保持 `in_progress / downstream-blocked`：可以继续合同层补证，但不能把选择器本身当成下游完成证据。

### 6.33 NB-01 领取结果：事件伤害 / 死亡保护 / 减免组合桶（2026-07-29）

本节领取 6.32 的 NB-01，只消费 6.12、6.17、`temp/betrayal-event-branch-work-order-2026-07-29.json` 和 `event-effect-implementation-audit-2026-07-29.md`；不修改伤害结算，不补组合领域测试，不新增 Board/UI，不运行 E2E，不截图，不打开图片，不接入音频或资源。结构化副本落在 `temp/betrayal-event-damage-consumer-bucket-2026-07-29.json`。

| 伤害 / 消费组 | 覆盖事件 | 当前证据级别 | 本合同层只登记的边界 | 未授权前仍禁止 |
| --- | --- | --- | --- | --- |
| 精神伤害消费者 | 不可能的房间、晦暗暴风夜、禁忌知识、可怜的尤里克、轮到约拿了、无线电广播、一声呼救、着火的人、上古旧宅、肉质苔癣 | `min-branch-verified / partial-ui` 或 `min-verified / Board component representative / partial-ui` | 精神伤害减免、死亡保护、属性上下限、UI/日志承接分开登记；轮到约拿了 Board 代表链已补拒绝精神伤害确认步骤，但不外推减免 / 死亡保护 / 真实入口；上古旧宅的地面通用伤害 UI 不能外推为地下室精神伤害 UI；肉质苔癣 Board 代表链已补失败精神伤害 UI，但不外推减免 / 死亡保护 / 真实入口；无线电广播脚注仍只作展示/音频提示；吊死鬼失败属性降低不在本行，另列直接属性降低消费者 | 不改精神伤害减免、死亡保护或脚注 UI / 音频；不补真实入口 |
| 物理伤害消费者 | 地狱蝙蝠、断手、摇曳灯光、着火的人 | `min-branch-verified / partial-ui` | 物理伤害减免、伤害改写、死亡保护、最近投骰重掷或加骰准入分开登记 | 不改物理伤害结算、盔甲/胸针/奇异护符等消费者或组合测试 |
| 通用伤害消费者 | 花团锦簇、佳馔满桌、游魂、上古旧宅、脑状食品 | `min-branch-verified / partial-ui`、`min-verified / Board component representative / partial-ui` 或 `Board component representative / partial-ui` | 通用伤害分配、死亡保护、目标选择和未覆盖对象的选择承接分开登记；游魂当前只补接受分支物品 / 属性选择 Board 代表链，不等于拒绝失败通用伤害 UI；上古旧宅当前只补地面力量分支代表链；脑状食品当前只补 0 分支通用伤害 2 的 Board 组件代表链 | 不把一条代表链外推为全部通用伤害组合完成 |
| 直接属性降低消费者 | 禁忌知识、脑状食品、吊死鬼、一条秘密通道 | `min-branch-verified / partial-ui` 或 `min-branch-verified / Board component representative / partial-ui` | 直接属性降低致死、是否经过伤害减免管线、死亡保护顺序单列；脑状食品 1-4 分支的神志 -1、吊死鬼失败属性各 -1 和一条秘密通道 0-2 神志 -1 都是直接属性降低，不等于普通精神伤害 | 不把直接属性降低当作普通精神伤害处理；不改死亡保护顺序 |
| 双伤害顺序消费者 | 着火的人 | `min-branch-verified / partial-ui` | 物理伤害与精神伤害的顺序、减免/改写/死亡保护叠加、UI 分配承接单列 | 不改双伤害结算顺序；不补 UI/E2E/截图 |

| 事件 | 伤害合同要点 | 当前已证明 | 剩余边界 |
| --- | --- | --- | --- |
| 不可能的房间 | 0-3 为骰子精神伤害；4+ 抽物品属于牌堆桶 | 4+ 抽物品、0-3 精神伤害均有状态断言；Board 组件代表链已补成功抽物品进入持有区和失败精神伤害反馈 | 精神伤害减免、死亡保护、抽物品牌堆耗尽、真实入口 E2E / 截图 |
| 地狱蝙蝠 | 0-3 为 1 点物理伤害；4+ 相邻放置属于目标候选桶 | 0-3 物理伤害、4+ 相邻放置、非法目标拒绝有领域代表链；Board 组件代表链已补 4+ 相邻房间候选、目标点击和 0-3 物理伤害确认步骤 | 物理伤害减免、死亡保护、非法目标提示 UI、作祟地图限制、更多连接边界、真实入口 E2E / 截图 |
| 断手 | 可选择承受 2 点物理伤害以抽物品；拒绝无事发生 | 接受 / 拒绝领域代表链和 Board 组件确认 / 拒绝按钮代表链已过 | 伤害改写、伤害减免、死亡保护、伤害不足仍能否抽物品、物品牌堆耗尽、真实入口 E2E / 截图 |
| 吊死鬼 | 四项属性各检定一次；失败的属性各 -1，全部通过后任选一项属性 +1 | 四项检定成功/失败混合、全通过待选知识 +1、失败扣到骷髅触发头骨死亡保护有领域代表链；Board 组件代表链已补全通过奖励属性选择 | 失败属性降低 UI、更多奖励属性选择、属性上下限、直接属性降低致死 / 死亡保护、兔脚/重掷组合、真实入口 E2E / 截图 |
| 花团锦簇 | 1 点通用伤害后按地面/地下室/温室放置 | 通用伤害分配、楼层/温室代表链已过；Board 组件代表链已补地面 / 地下室候选、上层候选不显示、温室强制覆盖、目标点击后的通用伤害分配和移动反馈 | 非法原因 UI、通用伤害死亡保护、更多温室 / 楼层 / 死亡保护组合、真实入口 E2E / 截图 |
| 上古旧宅 | 力量低分后放置到任意地面层板块并受到 1 点通用伤害；速度低分后放置到任意地下室板块并受到 1 点精神伤害 | 领域链已覆盖力量地面通用伤害、速度地下室精神伤害和非法楼层目标拒绝；Board 组件代表链已补力量选择、地面目标点击和通用伤害分配 | 上层成功 UI、地下室精神伤害 UI、非法目标提示 UI、通用/精神伤害减免、死亡保护、更多楼层 / 作祟地图组合、真实入口 E2E / 截图 |
| 晦暗暴风夜 | 0-3 为 1 点精神伤害；4+ 神志 +1 | 成功属性和失败精神伤害状态断言已过；Board 组件代表链已补知识检定、神志 +1 和失败精神伤害玩家可见反馈 | 精神伤害减免、死亡保护、神志上限、重掷组合、真实入口 E2E / 截图 |
| 佳馔满桌 | 0-4 为 1 点通用伤害；5+ 速度 +1 | 二选一检定、速度 +1、通用伤害领域代表链已过；Board 组件选择 UI、成功速度 +1 UI 与通用伤害分配失败路径已补 | 通用伤害死亡保护、速度上限、祝福/重掷组合 |
| 禁忌知识 | 2-3 含神志 -1 直接属性降低；0-1 为双骰精神伤害 | 4+、2-3、0-1 三段状态断言已过 | 直接属性降低致死、精神伤害减免、死亡保护、属性上下限 |
| 可怜的尤里克 | 0-3 为 1 点精神伤害；4+ 知识 +1 | 成功属性和失败精神伤害状态断言已过，Board 组件代表链已补成功 / 失败分支 UI | 精神伤害减免、死亡保护、知识上限、日志 / 组合 |
| 轮到约拿了 | 未弃置非武器物品时骰子精神伤害；弃置成功则神志 +1 | 非武器筛选、弃置选择、神志提升、拒绝后精神伤害有最小领域证据；Board 组件代表链已覆盖非武器物品候选、武器排除、未选确认禁用、选择地图 dispatch 和拒绝后的精神伤害确认步骤 | 精神伤害减免、死亡保护、无可弃物品、已用/不可交易限制、弃置终点可见性和真实入口 E2E / 截图 |
| 无线电广播 | 0-2 为骰子精神伤害；脚注不改变规则结算 | 知识提升/失败精神伤害领域代表链已过；Board 组件代表链已补成功知识提升和失败精神伤害 UI；脚注用途已裁定 | 精神伤害减免、死亡保护、固定骰/最近投骰重掷准入、脚注展示、音频资源来源 |
| 肉质苔癣 | 0-3 为一颗骰子的精神伤害；4+ 任选属性 +1；拒绝吸入无事发生 | 拒绝 / 成功任选属性 / 失败精神伤害 / 兔脚重掷成功保留待选属性均有领域代表链；Board 组件代表链已补拒绝无事发生、成功知识 +1 和失败精神伤害承接 | 精神伤害减免、死亡保护、属性上限、更多属性选择、兔脚 UI / 更多重掷组合、真实入口 E2E / 截图 |
| 脑状食品 | 5+ 任选力量或速度 +1；1-4 速度 +1 并神志 -1，神志 -1 属直接属性降低；0 为 2 点通用伤害 | 力量检定三档、缺选择拒绝、确认步骤阻止提前结束、头骨死亡保护和兔脚回滚死亡 / 狂热病患化有领域代表链；Board 组件代表链已补速度奖励、力量 / 知识通用伤害分配和同属性重复分配预览 | 成功力量 UI、属性上下限、直接属性降低致死 / 死亡保护、通用伤害死亡保护 / 减免 / 胸针组合、兔脚 UI / 更多重掷组合、真实入口 E2E / 截图 |
| 一条秘密通道 | 0-2 为神志 -1，属于直接属性降低；5+ / 3-4 / 0-2 都放置秘密通道标志物 | 知识检定三档、非法目标拒绝、发现确认前禁止移动、0-2 神志 -1 和灰尘中神志 -1 触发头骨死亡保护有领域代表链；Board 组件代表链已补第二目标房间候选、两个秘密通道标志物和知识 +1 确认步骤 | 非法原因 UI、更多目标范围、标志物移动入口、知识上限 / 神志下限、直接神志降低致死 / 死亡保护、兔脚 UI / 更多重掷组合、真实入口 E2E / 截图 |
| 摇曳灯光 | 0-4 为骰子物理伤害；5+ 速度 +1 | 二选一检定、成功速度 +1、失败物理伤害、祝福加骰代表链已过；Board 组件选择 UI 已补 | 物理伤害减免、死亡保护、祝福/重掷组合、速度上限 |
| 游魂 | 拒绝或失败路径含通用伤害；成功路径含抽物品或属性选择 | 埋葽物品、抽物品、通用伤害代表链已过 | 通用伤害分配、死亡保护、无物品边界、任意属性选择 |
| 一声呼救 | 0-3 为 1 点精神伤害；4+ 同区域放置属于目标候选桶 | 同区域目标合法性和失败精神伤害代表链已过 | 精神伤害减免、死亡保护、区域合法性、目标 UI |
| 着火的人 | 0-1 同时含物理伤害和精神伤害；2-3 移动入口大厅；4+ 神志 +1 | 4+、2-3、0-1 三段代表链已过 | 双伤害顺序、两类减免/改写、死亡保护、入口大厅状态 |

NB-01 裁定：

1. 19 张事件已经按精神伤害、物理伤害、通用伤害、直接属性降低和双伤害顺序五类归桶；这是合同边界，不是组合验证完成。
2. 直接属性降低不得自动当作普通伤害；双伤害不得用单一伤害代表链外推。
3. 后续若仍停在合同层，下一步可转 NB-06 物品伤害 / 死亡保护桶，把头戴耳机、奇异护符、胸针、皮夹克、幸运硬币、牙齿项链等消费者与本节五类事件伤害相互索引。
4. 后续若进入实现或测试，必须点名“事件 + 消费组 + 物品/预兆/作祟消费者 + 验收口径”，不得按 19 张事件或整事件牌批量开改。
5. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.34 NB-06 领取结果：物品伤害减免 / 伤害改写 / 死亡保护桶（2026-07-29）

本节领取 6.32 的 NB-06，只消费 6.13、6.17、6.33、`temp/betrayal-item-consumer-work-order-2026-07-29.json`、`temp/betrayal-event-damage-consumer-bucket-2026-07-29.json` 和 `item-effect-implementation-audit-2026-07-29.md`；不修改伤害、减免、死亡保护、攻击、重掷、Board/UI、E2E、截图、图片、音频或资源。结构化副本落在 `temp/betrayal-item-damage-death-bucket-2026-07-29.json`。

| 物品 | 当前效果合同 | 当前证据级别 | 本合同层只登记的边界 | 未授权前仍禁止 |
| --- | --- | --- | --- | --- |
| 头戴耳机 | 精神伤害 -1 | `covered-by-existing-contract / Board component representative / consumer-review-on-change` | 精神伤害来源枚举、真实 Playwright / 截图、死亡保护窗口、作祟精神伤害组合 | 不改精神伤害减免；不把组件提示代表链外推为真实入口或组合完成 |
| 奇异护符 | 实际承受物理伤害后获得 1 点神志；通用伤害分配到速度或直接属性降低不触发 | `min-domain-verified / partial-ui` | 物理伤害是否先被减免、胸针改写后是否不再触发、死亡保护前后触发顺序、作祟物理伤害组合 | 不把通用伤害或直接属性降低外推为触发；不改触发顺序 |
| 胸针 | 受到物理或精神伤害时，可以替换为承受通用伤害 | `min-domain-verified / min-ui-representative / partial-combo` | 声明改写时点、改写后通用伤害分配、Board 组件伤害分配代表链、头戴耳机/奇异护符是否仍适用、死亡保护窗口、双伤害顺序 | 不把 Board 组件代表链外推为真实 Playwright / 截图闭环或全部来源完成 |
| 皮夹克 | 防御一次进攻时额外投 1 骰 | `min-verified / partial-combo` | 这是攻击结算前骰数消费者，不是事件/房间伤害减免；仍需怪物攻击、作祟攻击、防御 UI 和攻击结果伤害组合 | 不改攻击防御逻辑；不把皮夹克当作通用减伤或死亡保护 |
| 幸运硬币 | 每回合一次，重掷刚刚进行的一项属性检定的所有空白骰；重投结果每有一个空白，承受 1 点精神伤害 | `combo-domain-verified / Board component representative / partial-ui` | 幸运硬币自身产生的精神伤害、事件/房间属性检定、Board 组件空白骰选择、固定骰/攻击/作祟检定排除、死亡保护、作祟特殊行动属性检定待回滚快照 | 不默认允许全部投骰来源重掷；不改死亡保护；不把组件代表链外推为真实 Playwright / 截图闭环 |
| 牙齿项链 | 回合结束时，可以获得 1 点选择的某项濒死属性 | `min-domain-verified / min-ui-representative / partial-combo` | 回合结束恢复消费者；Board 组件选择 / 跳过代表链已补；仍需单列死亡保护后是否仍到回合结束、房间回合末伤害、作祟回合和真实 Playwright / 截图链 | 不把它当作即时伤害减免或即时死亡保护 |

| 6.33 伤害来源组 | 相关物品消费者 | 当前交叉边界 |
| --- | --- | --- |
| 精神伤害 | 头戴耳机、胸针、幸运硬币、牙齿项链 | 头戴耳机是精神伤害减免；胸针是类型改写；幸运硬币可产生精神伤害但不是减免；牙齿项链只在回合结束恢复濒死属性 |
| 物理伤害 | 奇异护符、胸针、皮夹克、牙齿项链 | 奇异护符只在实际承受物理伤害后触发；胸针可改写为通用伤害；皮夹克只影响攻击防御骰，不影响事件/房间物理伤害；牙齿项链仍是回合结束恢复 |
| 通用伤害 | 胸针、牙齿项链 | 通用伤害分配本身不是物理/精神伤害；胸针的职责到改写完成为止；牙齿项链只能在回合结束恢复 |
| 直接属性降低 | 奇异护符、牙齿项链 | 直接属性降低不得自动进入普通伤害减免；奇异护符不触发；若降到濒死或死亡窗口，需另锁死亡保护和回合结束顺序 |
| 双伤害顺序 | 头戴耳机、奇异护符、胸针、牙齿项链 | 物理与精神伤害必须保持可分辨顺序；不能用单一伤害代表链外推减免、改写、实际承受触发和死亡保护叠加 |

NB-06 裁定：

1. 六张物品已经按精神伤害减免、物理伤害实际承受触发、伤害类型改写、攻击防御前骰数修正、重掷后精神自伤、回合结束濒死恢复六类归桶；这是合同边界，不是组合验证完成。
2. 皮夹克只属于攻击防御前消费者，不属于事件/房间伤害减免；牙齿项链只属于回合结束恢复，不属于即时死亡保护。
3. 盔甲、头骨、兔脚是相邻消费者：盔甲和头骨分别留在预兆/伤害跨消费者索引，兔脚留在重掷消费者边界；不得混入本节六张物品牌完成口径。
4. 后续若进入实现或测试，必须点名“物品 + 伤害来源组 + 是否含死亡保护/作祟/房间回合末 + 验收口径”，不得按六张物品或整物品牌批量开改。
5. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.35 NB-09 领取结果：物品重掷 / 替代数值 / 属性检定消费者桶（2026-07-29）

本节领取 6.32 的 NB-09，只消费 6.13、6.17、`temp/betrayal-item-consumer-work-order-2026-07-29.json`、`temp/betrayal-full-deck-next-bucket-selector-2026-07-29.json` 和 `item-effect-implementation-audit-2026-07-29.md`；不修改重掷、替代投骰、加骰、回滚、作祟检定、Board/UI、E2E、截图、图片、音频或资源。结构化副本落在 `temp/betrayal-item-roll-consumer-bucket-2026-07-29.json`。

| 物品 | 当前效果合同 | 当前证据级别 | 本合同层只登记的边界 | 未授权前仍禁止 |
| --- | --- | --- | --- | --- |
| 恐怖玩偶 | 每回合一次，重新投掷刚刚进行的属性检定的所有骰子 | `partial-mechanism-covered / Board component representative / partial-ui` | 事件属性检定和房间回合末属性检定有入口；Board 组件证明选中后全部骰子均可作为重掷目标；固定骰、攻击、作祟检定不放行；作祟特殊行动属性检定仍缺通用回滚快照 | 不新增作祟特殊行动放行；不把组件代表链外推为真实入口或全部重掷消费者完成 |
| 幸运硬币 | 每回合一次，重新投掷刚刚进行的属性检定中所有空白骰；重投结果每有一个空白，承受 1 点精神伤害 | `combo-domain-verified / Board component representative / partial-ui` | 事件/房间属性检定空白骰可重掷；Board 组件只高亮空白骰；固定骰、攻击、作祟检定和作祟特殊行动属性检定不放行；自身精神伤害与死亡保护仍回到 6.34 | 不默认允许全部投骰来源重掷；不改精神自伤；不把组件代表链外推为真实入口完成 |
| 兔脚 | 最近投骰重掷消费者；新增骰子消费者必须逐项确认 | `broad-domain-covered / consumer-review-on-change` | 已有事件、房间、攻击、死亡保护等代表消费者；不能默认扩展到所有新 roll kind | 不新增 roll kind 准入；不把代表链外推为全局重掷完成 |
| 天使之羽 | 埋葬后选择 0-8 作为下一次非战斗属性检定投骰结果；仍应用相关属性加值 | `min-domain-verified / min-ui-representative / partial-combo` | 非战斗属性检定替代已覆盖；真实页面 0-8 数字选择已补；固定骰不消费；攻击/作祟检定边界和额外骰是否属于相关加值仍待裁定 | 不改额外骰或作祟边界；不把页面代表链外推为全部组合完成 |
| 手电筒 | 事件属性检定额外骰 | `covered-by-existing-contract / consumer-review-on-change` | 事件属性检定消费者已有代表链；新增事件属性检定消费者时逐项确认是否加骰 | 不扩展到房间、攻击或作祟检定 |
| 魔法相机 | 属性检定替代、作祟 33 归属相关消费者 | `covered-by-existing-contract / consumer-review-on-change` | 不新增摄影师、作祟或属性检定消费者时不重审 | 不新增作祟或摄影师逻辑 |

| 投骰来源 | 相关物品消费者 | 当前交叉边界 |
| --- | --- | --- |
| 事件属性检定 | 恐怖玩偶、幸运硬币、兔脚、天使之羽、手电筒 | 当前最主要共同入口：恐怖玩偶重掷所有骰，幸运硬币只重掷空白骰并可能自伤，兔脚按白名单重掷，天使之羽替代非战斗属性检定总点数，手电筒给事件属性检定加骰 |
| 房间回合末属性检定 | 恐怖玩偶、幸运硬币、兔脚、天使之羽 | 已有代表链，但 UI、死亡保护、房间伤害回滚和作祟期组合仍不能外推完成 |
| 攻击投骰 | 兔脚 | 恐怖玩偶、幸运硬币和天使之羽当前不放行攻击；兔脚已有代表消费者但新增攻击来源仍需逐项确认 |
| 作祟检定 / 最后一张自动作祟 | 无 | 作祟公共风险归 NB-13；本桶不允许把重掷或替代数值默认接入作祟检定 |
| 作祟特殊行动属性检定 | 恐怖玩偶、幸运硬币、天使之羽、兔脚 | 当前仍是缺口桶：恐怖玩偶/幸运硬币缺通用回滚快照，天使之羽作祟边界待裁定，兔脚新增消费者必须逐项确认 |
| 固定骰 / 事件骰 | 无 | 固定骰与非属性事件骰不得被本桶消费者默认重掷或替代；需要另行点名来源和规则授权 |

NB-09 裁定：

1. 六张物品已经按全骰重掷、空白骰重掷并自伤、白名单最近投骰重掷、非战斗属性检定替代、事件属性检定加骰、按需作祟/属性检定消费者回查六类归桶；这是合同边界，不是组合验证完成。
2. 作祟检定、固定骰、非属性事件骰和攻击投骰不能自动消费恐怖玩偶、幸运硬币或天使之羽；兔脚新增 roll kind 也必须逐项确认。
3. 片刻希望、书本、头骨是相邻消费者：片刻希望属于事件/房间祝福状态，书本和头骨属于预兆账本；不得混入本节六张物品牌完成口径。
4. 后续若进入实现或测试，必须点名“物品 + 投骰来源 + 是否需要回滚旧分支 / 自伤 / 加骰 / 替代值 + 验收口径”，不得按六张物品或整重掷系统批量开改。
5. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.36 NB-13 领取结果：作祟风险 / 8 骰上限 / 最后一张自动作祟桶（2026-07-29）

本节领取 6.32 的 NB-13，只消费 5.1、6.14.2、6.17、6.28、`temp/betrayal-omen-haunt-work-order-2026-07-29.json`、`temp/betrayal-full-deck-next-bucket-selector-2026-07-29.json` 和 `omen-and-haunt-rule-implementation-audit-2026-07-29.md`；不修改作祟公共流程、重掷介入、Board/UI、E2E、截图、图片、音频或资源。结构化副本落在 `temp/betrayal-public-haunt-risk-bucket-2026-07-29.json`。

| 公共规则 | 当前合同 | 当前证据级别 | 本合同层只登记的边界 | 未授权前仍禁止 |
| --- | --- | --- | --- | --- |
| 全员当前持有预兆总数 | 作祟检定骰数按所有玩家当前持有的预兆总数派生，不只看当前抽牌玩家 | `min-domain-verified / partial-ui` | 交易转移后总数已有代表链；死亡掉落、遗物转移、搜尸和风险 UI 刷新仍是后续组合缺口 | 不改风险计算；不新增风险 UI |
| 抽到预兆后的作祟检定 | 作祟开始前抽到预兆时进行作祟检定，并记录来源预兆和作祟确认队列 | `min-domain-verified / partial-ui` | 普通抽预兆入口已有领域链；事件型作祟入口、真实骰盘、翻牌揭示 UI 和真实入口链仍未闭合 | 不新增骰盘或翻牌 UI；不跑真实入口 |
| 5+ 开始作祟 | 作祟检定结果为 5+ 时进入作祟，并记录剧本卡、作祟揭秘者、触发预兆和首行动 / 叛徒代表裁定 | `min-domain-verified / representative-only` | 普通预兆 5+ 触发已有代表链；更多剧本入口、木乃伊触发牌版本冲突和作祟揭示 UI 仍不能外推完成 | 不改剧本入口；不补揭秘 UI |
| 最多 8 骰 | 作祟风险总数可超过 8，但实际作祟检定最多只投 8 颗骰 | `min-domain-verified / partial-ui` | 9 个预兆时实际 8 骰已有领域证据；风险 UI 是否同时显示总数、下次骰数和上限说明仍需后续 UI 合同 | 不改骰数归一化；不补骰盘展示 |
| 最后一张预兆自动作祟 | 若抽到最后一张预兆且作祟尚未开始，作祟自动开始，不依赖 5+ 点数 | `min-domain-verified / partial-ui` | 最后一张抽取自动进入作祟已有领域链；经交易、死亡掉落、强制搜牌后的组合和自动作祟 UI 仍缺 | 不把自动作祟接入重掷或替代数值；不补揭示 UI |

| 风险流程 | 相关公共规则 | 当前交叉边界 |
| --- | --- | --- |
| 普通预兆抽取 | 全员当前持有预兆总数、抽到预兆后的作祟检定、5+ 开始作祟、最多 8 骰 | 抽牌后按全员当前持有预兆总数生成作祟检定；结果 5+ 触发作祟；实际骰数最多 8 |
| 交易 / 转移预兆后的下一次抽预兆 | 全员当前持有预兆总数 | 交易或转移只改变下一次风险读模型，不立即触发作祟检定；死亡掉落、搜尸和遗物转移仍需后续组合审 |
| 全员持有预兆数超过 8 | 全员当前持有预兆总数、最多 8 骰 | 风险总数和实际骰数必须分开表达：可记录 9 张总预兆，但实际最多只投 8 骰 |
| 最后一张预兆 | 最后一张预兆自动作祟 | 自动触发不消费 5+ 点数成功条件，也不得被 NB-09 物品重掷、替代数值或固定骰规则默认介入 |
| 作祟翻牌确认 | 抽到预兆后的作祟检定、5+ 开始作祟、最后一张预兆自动作祟 | 确认队列和揭秘信息是公共作祟承接的一部分；真实 Board 翻牌确认、阵营 / 首行动提示和截图链归后续阶段 |

NB-13 裁定：

1. 作祟风险继续作为公共规则独立账本，不能归并成某一张预兆效果，也不能被 NB-09 物品重掷桶默认消费。
2. 全员当前持有预兆总数和实际最多 8 骰必须分层记录：风险总数可超过 8，实际投骰仍最多 8。
3. 最后一张预兆自动作祟不依赖 5+ 点数，也不授权恐怖玩偶、幸运硬币、天使之羽或兔脚自动介入该流程。
4. 狗交易、死亡掉落、遗物转移和搜尸只作为相邻风险消费者；7 号作祟公开 / 私密 setup 与镜中怪物流程仍归 NB-14 / NB-15。
5. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.37 NB-14 领取结果：7 号作祟公开 / 私密可见性与 setup 桶（2026-07-29）

本节领取 6.32 的 NB-14，只消费 E10、6.29、`temp/betrayal-haunt-07-work-order-2026-07-29.json`、`temp/betrayal-full-deck-next-bucket-selector-2026-07-29.json` 和 `docs/games/betrayal/haunts/07-upon-reflection.md`；不修改 7 号作祟实现、私密 UI、setup UI、Board/UI、E2E、截图、图片、音频或资源。结构化副本落在 `temp/betrayal-haunt07-visibility-setup-bucket-2026-07-29.json`。

| setup / 可见性节点 | 当前合同 | 当前证据级别 | 本合同层只登记的边界 | 未授权前仍禁止 |
| --- | --- | --- | --- | --- |
| 公开无叛徒与作祟揭秘者被困镜中 | 公开没有叛徒；作祟揭秘者仍在游戏中但倒伏，灵魂被困镜中，不能正常交流 | `contract-ready / partial-ui` | 这是公开信息与短状态承接，不是普通玩家可见秘密组合，也不是完整剧情阅读器 | 不新增公开提示 UI；不写长文承接 |
| 秘密 Trait/Omen/Room 组合 | 作祟揭秘者秘密记录正确 Trait、Omen、Room 组合；普通玩家视角必须隐藏组合内容 | `min-domain-verified / partial-ui` | 领域状态和普通玩家隐藏已有代表链；正式私密查看 UI、隐藏断言和人工验收仍未闭合 | 不补私密 UI；不把领域状态外推为真实玩家承接完成 |
| setup 队列自动 resolved 与 manual-check 分层 | `deal-secret-mirror-combination` 已可由领域状态自动 resolved；倒伏沉默、怪物卡位置、首行动玩家和部分桌面 setup 仍保持 manual-check | `partial` | 自动 resolved 只证明秘密组合状态可生成，不证明完整 setup UI 或桌面摆放完成 | 不清理 manual-check 队列；不截图 |
| 镜中怪物放置与怪物卡 | 入口大厅放置 2/3/4/5 个 Mirror Being；Monster Card 放在作祟揭秘者左侧；作祟后首回合由其左侧玩家开始 | `representative-only / partial` | 当前只保留代表放置和后续流程入口；数量按玩家数、怪物卡 UI、首行动提示和完整怪物回合仍未闭合 | 不实现完整 setup；不补怪物卡 UI |
| 作祟揭秘者沟通限制 | 作祟揭秘者不能说话、比划、书写或以其他方式交流，除非规则允许；镜中提示是允许沟通的专门例外 | `contract-ready / downstream-open` | 沟通限制必须作为状态 / UI 约束独立登记；不能用普通聊天、普通提示或日志说明替代 | 不改交流系统；不新增镜中提示 UI |

| 视角 | 应可见 | 不应可见 / 不得外推 | 当前边界 |
| --- | --- | --- | --- |
| 作祟揭秘者 | 秘密 Trait、秘密 Omen、秘密 Room、镜中沉默状态、镜中提示入口 | 不得外推为正式私密 UI、完整 setup UI 或完整镜中提示 UI 已完成 | 可见秘密组合是领域 / 视角合同；正式 UI 承接仍需后续授权 |
| 普通英雄玩家 | 无叛徒公开状态、作祟揭秘者被困镜中、破咒目标入口、镜中怪物威胁 | 不得看到秘密 Trait、秘密 Omen、秘密 Room | 普通玩家只能看到公开状态与可执行目标，不得看到秘密组合内容 |
| 旁观 / 审计视角 | 合同状态、哪些字段仍 partial、哪些 UI/E2E 未授权 | 不得替代玩家视角验收，也不得证明私密 UI 已完成 | 审计视角只能证明合同记录存在，不能证明真实玩家可见性正确 |

| setup 项 | 当前状态 | 后续最小解阻动作 |
| --- | --- | --- |
| 作祟揭秘者倒伏沉默 | `manual-check / ui-needed` | 选择正式 UI 承接对象，验证普通行动入口被正确限制 |
| 秘密组合抽取 | `domain-resolved / private-visibility-partial` | 补作祟揭秘者私密 UI 和普通玩家隐藏断言 |
| 镜中怪物放置 | `representative-placement / partial` | 按玩家数和房间状态补完整 setup 组合与 UI/日志承接 |
| 怪物卡与首行动玩家 | `contract-ready / manual-check` | 补怪物卡可见承接、首行动提示和真实入口验证 |
| Trait token / Number token 回盒 | `contract-ready / no-runtime-proof` | 若进入完整 setup，实现或测试前先裁定 token 是否进入运行时状态 |

NB-14 裁定：

1. 7 号作祟公开 / 私密信息和 setup 队列只证明可见性与 setup 前置边界，不证明破咒、镜中提示、镜中怪物移动攻击或完整流程已完成。
2. `deal-secret-mirror-combination` 自动 resolved 只覆盖秘密组合状态生成；作祟揭秘者倒伏沉默、怪物卡、首行动玩家和完整桌面 setup 仍保持 `manual-check / ui-needed`。
3. 普通英雄玩家不得看到秘密 Trait/Omen/Room；作祟揭秘者可见秘密组合也不能外推为正式私密 UI 已闭合。
4. 后续若进入实现或测试，必须点名“可见性 / setup 节点 + 玩家视角 + UI 承接对象 + 验收口径”，不得以“完整 7 号作祟”泛化开改。
5. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.38 NB-16 领取结果：UI / E2E / 截图 / 脚注音频授权前置桶（2026-07-29）

本节领取 6.32 的 NB-16，只消费 6.7、6.9、6.17、6.18、6.30、`temp/betrayal-full-deck-next-bucket-selector-2026-07-29.json` 和 `temp/betrayal-ui-e2e-asset-preflight-work-order-2026-07-29.json`；不修改 Board/UI，不运行 E2E，不截图，不打开图片，不接入音频，不移动、压缩或上传资源。结构化副本落在 `temp/betrayal-ui-e2e-asset-preflight-bucket-2026-07-29.json`。

| 前置节点 | 覆盖对象 | 当前证据级别 | 本合同层只登记的边界 | 未授权前仍禁止 |
| --- | --- | --- | --- | --- |
| 发现牌 UI 承接入口 | 事件目标候选与非法原因；物品使用 / 治疗 / 武器 / 重掷 / 死亡保护 / 交易限制 / 移动消费者；预兆逐卡效果、作祟风险和翻牌确认；7 号作祟破咒、镜中提示、镜中怪物移动 / 攻击和公开 / 私密信息 | `authorization-preflight-indexed / no-ui-change` | 未来 UI 必须消费已锁合同里的玩家动作、状态真相、非法原因和可见性边界；旧运行 UI 或历史截图不能反向证明当前 UI 已闭合 | 不改 `Board.tsx` 或任意 UI 组件；不新增、改写或重排玩家交互入口 |
| 旧 E2E / 旧截图降级边界 | 早期 23 张事件页面 E2E、首剧本代表链截图、作祟 3 / 12 / 33 高清产物图、旧对象矩阵和旧可玩性审计 | `historical-only / no-new-run` | 旧 E2E 和旧截图只能证明当时代表链或旧运行池，不能证明当前 43/22/9 整牌库 UI、E2E 或截图验收完成 | 不运行 Playwright 或其它 E2E；不生成新截图；不打开图片给用户看 |
| 真实入口 E2E 与截图选择 | 发现牌抽取和分支选择、物品使用和持有物消费者、预兆作祟风险和翻牌确认、7 号作祟公开 / 私密状态与镜中流程 | `authorization-needed` | 未来真实入口验证必须从一个具体对象或机制节点开始，不能用“整牌库 E2E”泛化开跑；截图必须和同一工作区、同一路由、同一状态入口同源 | 不启动浏览器或开发服务器；不跑 E2E；不截图或发布截图 |
| 无线电广播脚注 / 音频 / 资源链 | 无线电广播脚注展示、可能的音频提示资源、未来资源压缩 / 上传 / 远端回查 | `asset-preflight-indexed / no-asset-change` | 脚注只作为展示或音频提示，不进入事件规则结算；音频和资源链必须另行锁定素材来源、运行时落点、压缩产物、上传结果和 HEAD 回查 | 不新增脚注 UI；不接音频；不移动、压缩、上传资源或做远端回查 |

| 若后续授权 | 最小重锁字段 | 当前不得外推 |
| --- | --- | --- |
| UI 承接 | 具体牌或公共规则、玩家动作、UI 承接对象、真实入口、验收证据 | 不能用领域代表链或旧截图证明真实玩家 UI 已完成 |
| E2E / 截图 | 工作单 / NB 桶、具体牌或规则节点、初始状态构造、页面入口、玩家视角、不得外推范围 | 不能用“整牌库”泛化开跑，也不能用历史 E2E 替代当前场景 |
| 脚注音频 / 资源链 | 展示还是音频、素材来源、运行时落点、压缩和 manifest 口径、远端 HEAD 验收 | 不能把无线电广播脚注规则裁定外推为音频或资源已接入 |

NB-16 裁定：

1. 本桶只把 UI、E2E、截图、图片打开、无线电广播脚注音频和资源链的授权前边界补成可消费合同，不证明任何 UI、E2E、截图、音频或资源动作已经发生。
2. 当前没有需要用户补整包图包的事项；只有未来发现具体单卡裁图不可读、frame/hash 对不上或新权威来源冲突时，才点名请求最小补源。
3. 旧 E2E、旧截图、旧完成审计和旧可玩性审计继续只作历史代表链，不得替代当前 43/22/9 整牌库主合同。
4. 后续若进入 UI、E2E、截图、音频或资源链，必须先选择具体工作单或 NB 桶，并重新锁定问题对象、真相来源、目标入口和验收口径。
5. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.39 NB-15 领取结果：7 号作祟破咒 / 镜中提示 / 镜中怪物移动攻击桶（2026-07-29）

本节领取 6.32 的 NB-15，只消费 E10、6.29、6.37、`temp/betrayal-haunt-07-work-order-2026-07-29.json`、`temp/betrayal-full-deck-next-bucket-selector-2026-07-29.json` 和 `docs/games/betrayal/haunts/07-upon-reflection.md`；不修改 7 号作祟实现、Board/UI、E2E、截图、图片、音频或资源。结构化副本落在 `temp/betrayal-haunt07-action-monster-bucket-2026-07-29.json`。

| 行动 / 怪物节点 | 当前合同 | 当前证据级别 | 本合同层只登记的边界 | 后续最小解阻动作 |
| --- | --- | --- | --- | --- |
| 破咒特殊行动 | 英雄选择属性，并报出自己持有的一张预兆；当前房间自动参与组合判断。0-4 无反馈；5+ 组合错误只给否定反馈且不泄露错误项；5+ 且 Trait/Omen/Room 全中英雄胜利 | `min-domain-verified / partial-ui` | 领域命令、校验、行动预算和终局代表链已登记；属性选择、预兆选择、房间确认、反馈呈现和正式玩家 UI 仍未闭合 | 点名破咒 UI 承接对象、玩家视角、错误反馈呈现方式和真实入口验收 |
| 镜中提示 | 仅作祟揭秘者每回合一次，从事件牌堆选择一张事件给任意存活玩家作提示；该事件不结算、不进弃牌堆、从事件牌堆放一边 | `min-domain-verified / partial-ui` | 领域命令链和每回合一次限制已登记；正式私密事件选择 UI、目标玩家选择 UI、被提示玩家展示、放一边牌区和提示不可结算的 UI 仍未闭合 | 点名事件选择入口、目标玩家入口、提示展示范围和事件牌堆 / 放一边区验证 |
| 事件符号房间 | 7 号作祟中发现事件符号房间时不抽事件、不结算事件、不移动事件牌堆，且不因发现事件符号房间结束回合 | `min-domain-verified / partial-ui` | 领域代表链已登记；探索 UI、事件符号提示、玩家可见原因和与其它房间效果组合仍未闭合 | 点名事件符号房间发现入口、回合是否继续的 UI 承接和房间 / 事件组合验收 |
| 镜中怪物移动 / 平手裁决 | 镜中怪物按已发现房间连接图朝最近可攻击探索者移动；只能选择能缩短距离的相邻房间；距离平手时暴露多个等距路径供作祟揭秘者裁决；已同房时不允许离开；作祟揭秘者自身不作为移动 / 攻击目标 | `min-domain-verified / partial-ui` | 最近目标、等距路径和已同房不离开代表链已登记；专属移动目标选择 UI、完整怪物回合队列、多人距离组合和真实入口验收仍未闭合 | 点名怪物、当前房间图、目标探索者集合、平手路径 UI 和怪物回合验收 |
| 镜中怪物攻击 / 精神伤害 | 镜中怪物同房攻击使用神志投骰；对英雄造成伤害时进入精神伤害分配，只允许分配知识 / 神志 | `min-domain-verified / partial-ui` | 攻击属性和精神伤害代表链已登记；伤害分配 UI、死亡保护、减免/改写、怪物多目标和完整作祟攻击组合仍未闭合 | 点名攻击目标、骰子结果、精神伤害消费者、死亡保护边界和 UI/测试验收 |
| 完整流程验收 | 7 号作祟已有秘密组合、破咒、事件符号房间、镜中提示、镜中怪物移动和同房攻击的领域代表链 | `representative-only / downstream-open` | 代表链不能外推为完整 7 号作祟；正式私密 UI、专属移动 / 目标选择 UI、E2E、截图和完整怪物回合组合仍未闭合 | 从一个具体机制节点开始授权；不得以完整 7 号作祟泛化开改 |

| 相邻依赖 | 原因 |
| --- | --- |
| NB-14 公开 / 私密可见性与 setup | 破咒反馈、镜中提示和秘密组合都依赖作祟揭秘者与普通英雄玩家的可见性边界 |
| NB-16 UI / E2E / 截图授权前置 | 本桶只登记 UI/E2E/截图缺口，不能直接执行 UI 或真实入口验收 |
| NB-01 / NB-06 伤害与死亡保护 | 镜中怪物精神伤害可能进入减免、改写和死亡保护组合，但本桶不修改伤害结算 |

NB-15 裁定：

1. 破咒、镜中提示、事件符号房间、镜中怪物移动和平手裁决、镜中怪物精神攻击都已有领域代表链，但仍是 `min-domain-verified / partial-ui`。
2. 代表链不能外推为完整 7 号作祟：正式私密 UI、专属移动 / 目标选择 UI、真实入口 E2E、截图和完整怪物回合组合仍未闭合。
3. 镜中怪物精神伤害若进入后续实现或测试，必须重新点名精神伤害消费者、死亡保护和减免 / 改写边界，不得直接继承普通怪物攻击完成口径。
4. 后续若进入实现或测试，必须点名“7 号行动 / 怪物节点 + 玩家视角 + UI 承接对象 + 验收口径”，不得以“完整 7 号作祟”泛化开改。
5. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.40 NB-12 领取结果：预兆交易 / 持有物转移 / 已用牌限制桶（2026-07-29）

本节领取 6.32 的 NB-12，只消费 6.28、`temp/betrayal-omen-haunt-work-order-2026-07-29.json`、`evidence/betrayal/full-audit/omen-and-haunt-rule-implementation-audit-2026-07-29.md`、`src/games/betrayal/game.ts` 和 `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`；不修改交易、搜尸、作祟风险、死亡掉落、持有物使用、Board/UI、E2E、截图、图片、音频或资源。结构化副本落在 `temp/betrayal-omen-transfer-risk-bucket-2026-07-29.json`。

| 转移 / 风险节点 | 当前合同 | 当前证据级别 | 本合同层只登记的边界 | 后续最小解阻动作 |
| --- | --- | --- | --- | --- |
| 狗 4 格交易 | 狗允许每回合一次与 4 格内玩家请求交易任意数量物品或预兆；死亡探索者不作为目标；交易仍需对方同意 | `min-domain-verified / partial-ui` | `resolveDogTradeTargets`、`canUseDogForTrade` 和领域测试已证明 4 格目标、pending 交易、同意结算和二次使用拒绝；不证明真实交易 UI、距离展示或按钮状态 | 点名狗交易 UI 承接对象、4 格距离读模型、目标玩家视角和真实入口验收 |
| pendingTradeAgreement / 同意结算 | `TRADE_POSSESSION` 只提出请求，`RESOLVE_TRADE_AGREEMENT` 同意后才真实转移持有物；拒绝或请求失效不移动持有物 | `min-domain-verified / partial-ui` | 已登记请求方 / 目标方 inventory 转移、active player 让目标方同意、拒绝和失效边界；不证明 pending 状态跨视角 UI | 点名请求方、目标方、旁观者各自可见信息和同意 / 拒绝入口 |
| `usedCardIdsThisTurn` 已用牌限制 | 本回合已使用的持有物不能交易；狗作为远距交易动作来源时不能同时被交易出去；收到的牌本回合不能立刻使用 | `min-domain-verified / partial-ui` | `resolveBetrayalTradeCardStatus` 已把已用牌和狗动作来源标为不可交易；领域测试覆盖已用牌不能交易、收到牌不能立刻使用；不证明真实 UI 禁用提示 | 点名具体已用牌、交易双方、动作来源和按钮禁用 / 错误提示验收 |
| 交易转移后的作祟风险读模型 | 作祟风险按全员当前持有预兆总数派生，不按当前玩家持有数派生；预兆交易只换持有人，不改变全局总数 | `min-domain-verified / partial-ui` | `resolveBetrayalOmenCount` 汇总所有探索者 inventory 中的预兆；领域测试覆盖交易后当前玩家预兆数变化但全员总数和下次骰数不变；不证明交易后真实风险条刷新 | 后续补 UI/测试时分开验证持有者变化、全局预兆总数、下次骰数和风险条显示 |
| 死亡掉落 / 遗物转移 / 搜尸后的风险刷新 | 尸体上的物品和预兆是持有物转移来源；搜尸同房尸体必须选择具体持有物，同一尸体同回合不能连续搜刮 | `min-domain-indexed / partial-domain / partial-ui` | `resolveCorpseLootTargets`、`LOOT_CORPSE` 和领域测试已覆盖同房尸体、物品/预兆可搜刮与同回合重复限制；本桶只登记预兆进入存活玩家 inventory 后应继续消费全员预兆数读模型 | 点名死亡来源、尸体持有物、搜尸玩家、风险刷新观察点和是否包含 UI |
| 怪物 / 作祟期控制者交易与搜尸限制 | 交易和搜尸必须由合法探索者动作承接；怪物回合或作祟特殊控制回合不能冒充普通探索者交易 / 搜尸 | `boundary-indexed / representative-only` | 现有代表测试已覆盖杰克之灵 / 狂热病患等控制回合拒绝持有物、兔脚、交易或搜尸；不证明所有作祟控制者枚举覆盖或真实 UI 隐藏入口 | 按具体作祟编号、控制者类型、动作入口和 UI/领域验收边界拆分 |

| 相邻依赖 | 原因 |
| --- | --- |
| NB-13 作祟风险 / 8 骰上限 / 最后一张自动作祟 | 交易、死亡掉落、遗物转移和搜尸后的预兆持有人变化必须继续消费全员当前持有预兆数读模型 |
| NB-09 物品重掷 / 替代数值 / 属性检定消费者 | 已用牌限制会影响兔脚、幸运硬币、天使之羽等使用后是否可交易或再次使用 |
| NB-06 伤害 / 死亡保护 | 死亡保护失败、遗物掉落和搜尸后的预兆转移可能影响作祟风险与持有物消费者 |
| NB-16 UI / E2E / 截图授权前置 | 本桶只登记未来 UI/E2E 入口，不能直接执行 UI、E2E、截图、图片打开、音频或资源动作 |

NB-12 裁定：

1. 狗交易、普通交易、同意结算、已用牌限制、交易后全员预兆数、搜尸和控制回合限制已有领域代表链或边界索引，但仍是 `min-domain-verified / partial-ui` 或 `boundary-indexed / representative-only`。
2. 本桶只把预兆交易 / 持有物转移 / 已用牌限制与作祟风险读模型交叉登记，不新增任何交易、搜尸、死亡掉落、作祟风险、Board/UI、E2E、截图、音频或资源逻辑。
3. 预兆交易后的作祟风险必须和狗本身效果分离：狗只提供远距交易动作，作祟风险仍由公共规则的全员当前持有预兆总数派生。
4. 死亡掉落、遗物转移和搜尸后的风险刷新仍缺真实 UI / 组合测试；后续若进入实现或测试，必须点名“死亡来源 / 持有物 / 目标玩家 / 风险读模型 / 验收口径”。
5. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.41 NB-02 领取结果：事件目标候选 / 房间合法性桶（2026-07-29）

本节领取 6.32 的 NB-02，只消费 6.12、6.17、`temp/betrayal-event-branch-work-order-2026-07-29.json`、`temp/betrayal-full-deck-next-bucket-selector-2026-07-29.json`、`event-effect-implementation-audit-2026-07-29.md`、`src/games/betrayal/scenarioConfig.ts`、`src/games/betrayal/game.ts` 和 `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`；不修改事件、房间、移动、伤害、作祟、Board/UI、E2E、截图、图片、音频或资源。结构化副本落在 `temp/betrayal-event-target-candidate-bucket-2026-07-29.json`。

| 事件 / 节点 | 已锁合同边界 | 当前证据状态 | 未闭合原因 | 下步最小解阻动作 |
| --- | --- | --- | --- | --- |
| 地狱蝙蝠 | 速度检定 4+ 后必须选择已发现相邻板块；0-3 物理伤害另归伤害桶 | `min-branch-verified / Board component representative / partial-ui` | 已有相邻放置、非相邻拒绝和未发现拒绝领域代表链；Board 组件代表链已证明相邻已发现候选高亮、非相邻 / 跨楼层候选不显示、点击门厅后当前位置更新和 0-3 物理伤害确认步骤；仍未证明非法原因展示、更多门位 / 连接组合、作祟地图限制和真实入口 E2E / 截图 | 点名当前房间、相邻已发现房间 id、被拒房间 id、拒绝原因、伤害/作祟地图组合和真实入口验收边界 |
| 花团锦簇 | 先承受 1 点通用伤害，再放置到任意地面或地下室已发现板块；温室已发现时强制温室 | `min-branch-verified / Board component representative / partial-ui` | 已有上层非法、地下室合法、温室强制领域代表链；Board 组件代表链已证明普通分支地面 / 地下室候选、上层候选不显示、温室分支强制只显示温室、目标点击后通用伤害分配和移动反馈；仍未证明非法原因 UI、通用伤害死亡保护、更多温室 / 楼层 / 死亡保护组合和真实入口 E2E / 截图 | 点名候选房间的 floor / visualId、温室 override、通用伤害分配边界、非法原因 UI、死亡保护和真实入口验收边界 |
| 技术难点 | 不提供自由目标选择；按规则放到下一楼层起始点，若已在地下室则放到上层起始点并受 1 点精神伤害 | `min-verified / Board component representative / partial-ui` | 已有下一楼层起始点和地下室 fallback 领域证据；Board 组件代表链已证明地面层翻出后放到地下室起始点、地下室翻出后放到上层起始点并显示 1 点精神伤害；未证明更多楼层边界、精神伤害消费者组合、真实入口 E2E / 截图 | 继续作为确定性放置节点记录，不为其虚构候选列表；未来点名来源楼层、目标起始点、伤害消费者和真实入口验收 |
| 秘密升降机 | 可以放置到不同区域 / 不同楼层的任意已发现板块 | `min-branch-verified / Board component representative / partial-ui` | 已有移动到上层起始点、同区域拒绝、未发现拒绝领域代表链；Board 组件代表链已证明同区域候选不显示、切换到上层 / 地下室时不同区域已发现起始点候选显示，并能提交地下室起始点目标；未证明非法原因 UI、作祟地图限制、移动后续反馈、更多区域 / 楼层 / 未发现组合和真实入口 E2E / 截图 | 点名当前楼层、目标楼层、已发现状态、非法原因、移动后续反馈和是否涉及作祟地图规则 |
| 一条秘密通道 | 先在当前板块放置秘密通道标志物，再按分支选择任意另一已发现板块 / 任意地面板块 / 任意地下室板块放置第二个秘密通道标志物 | `min-branch-verified / Board component representative / partial-ui` | 已有 5+ / 3-4 / 0-2 三档、非法同房 / 非法楼层目标拒绝、发现确认前禁止移动和 0-2 神志 -1 领域代表链；Board 组件代表链已证明第二目标房间候选、点击门厅、两个秘密通道标志物和“知识 +1”确认步骤；未证明非法原因 UI、更多目标范围、秘密通道标志物移动入口、属性上下限、死亡保护 / 重掷组合和真实入口 E2E / 截图 | 点名当前房间、第二目标房间、目标 scope、非法原因、标志物移动入口消费者、直接神志降低消费者和真实入口验收边界 |
| 一声呼救 | 知识检定 4+ 后放置到所在区域 / 同楼层任意已发现板块；0-3 精神伤害另归伤害桶 | `min-branch-verified / Board component representative / partial-ui` | 已有同区域放置、不同区域拒绝、未发现拒绝和失败精神伤害代表链；Board 组件代表链已证明合法同区域候选高亮、不同区域候选不显示、目标点击后放置到门厅，以及总点数 0 时的 0-3 精神伤害确认步骤；未证明非法原因展示、精神伤害组合和真实入口 E2E / 截图 | 点名当前区域 / 楼层、合法目标、非法目标、失败伤害桶、UI 承接边界和真实入口残余 |
| 上古旧宅 | 选择速度或力量检定；5+ 可放置到任意已发现板块；3-4 放置到任意地面板块并受 1 点通用伤害；0-2 放置到任意地下室板块并受 1 点精神伤害 | `min-branch-verified / Board component representative / partial-ui` | 已有缺目标拒绝、速度成功放置任意板块、力量地面通用伤害、速度地下室精神伤害和非法楼层目标拒绝领域代表链；Board 组件代表链已证明力量选择、地面目标房间、点击门厅后通用伤害分配和“通用伤害 1（力量）”反馈；未证明上层成功 UI、地下室精神伤害 UI、非法目标提示 UI、通用/精神伤害死亡保护、更多楼层 / 作祟地图组合和真实入口 E2E / 截图 | 点名选择属性、骰值分支、合法目标楼层、非法目标原因、通用/精神伤害消费者和真实入口验收边界 |

| 未来 UI / 实现必须消费的状态真相 | 现实含义 | 适用对象 |
| --- | --- | --- |
| 当前房间与楼层 | 事件结算前探索者站在哪个板块 / 楼层，用于判断相邻、同层、不同层、下一楼层或分支指定楼层 | 地狱蝙蝠、秘密升降机、一声呼救、技术难点、上古旧宅 |
| 候选房间 id 列表 | 当前规则允许点击 / 选择的已发现板块，不包含未发现板块 | 地狱蝙蝠、花团锦簇、秘密升降机、一声呼救、上古旧宅 |
| 强制目标覆盖 | 特定房间已发现时覆盖普通候选，例如温室覆盖花团锦簇普通地面 / 地下室选择 | 花团锦簇 |
| 非法原因 | 点击失败时为什么被拒绝：不相邻、楼层 / 区域不匹配、同区域不合法、未发现 | 地狱蝙蝠、花团锦簇、秘密升降机、一声呼救、上古旧宅 |
| 确定性目的地 | 规则固定放置点，不是玩家自由选择 | 技术难点 |

| 相邻桶 | 原因 |
| --- | --- |
| NB-01 事件伤害 / 死亡保护 / 减免组合 | 地狱蝙蝠、一声呼救失败分支，花团锦簇通用伤害，技术难点地下室 fallback 精神伤害，上古旧宅地面通用伤害和地下室精神伤害仍消费伤害 / 死亡保护边界 |
| NB-10 物品移动 / 地图 / 门位墙体 | 后续地图、门位、墙体和已发现房间合法性需要共享同一套房间图状态真相 |
| NB-15 7 号作祟破咒 / 镜中提示 / 镜中怪物移动攻击 | 镜中怪物移动和平手路径也消费房间图合法性，但本桶不授权 7 号作祟 UI 或怪物逻辑 |
| NB-16 UI / E2E / 截图授权前置 | 本桶只登记未来 UI 必须消费的状态真相；不直接改 UI、不跑真实入口、不截图 |

NB-02 裁定：

1. 地狱蝙蝠、花团锦簇、秘密升降机、一声呼救、上古旧宅的房间目标合法性已有领域代表链；其中地狱蝙蝠、花团锦簇、秘密升降机、一声呼救和上古旧宅当前又补到 Board 组件代表链，分别证明相邻候选、地面 / 地下室 / 温室候选、不同区域候选、同区域候选、上古旧宅地面目标与目标点击承接的代表路径；技术难点是确定性放置节点，当前 Board 组件代表链已补地面层到地下室起始点、地下室 fallback 到上层起始点和地下室 1 点精神伤害反馈，不应被误写成玩家自由选房。
2. 本桶只把候选来源、非法原因、楼层 / 区域 / 已发现限制和未来 UI 状态真相登记清楚，不新增任何房间、移动、事件、伤害、Board/UI、E2E、截图、音频或资源动作。
3. 后续若进入实现或 UI，必须从具体事件开始，点名当前房间、候选房间、非法原因、玩家动作和验收口径；不得以“房间目标事件”泛化批量开改。
4. 当前规范没有把 `blocked` 写成停工口令；本节继续证明 `downstream-blocked` 只拦完成宣称和下游 UI/E2E/截图，不拦合同层补证。
5. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.42 NB-03 领取结果：事件物品 / 牌堆 / 持有物选择桶（2026-07-29）

本节领取 6.32 的 NB-03，只消费 6.12、6.17、`temp/betrayal-event-branch-work-order-2026-07-29.json`、`temp/betrayal-full-deck-next-bucket-selector-2026-07-29.json`、`event-effect-implementation-audit-2026-07-29.md`、`src/games/betrayal/scenarioConfig.ts`、`src/games/betrayal/game.ts` 和 `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`；不修改持有物筛选、物品牌堆结算、弃置 / 埋葬终点、Board/UI、E2E、截图、图片、音频或资源。结构化副本落在 `temp/betrayal-event-possession-deck-bucket-2026-07-29.json`。

| 事件 / 节点 | 已锁合同边界 | 当前证据状态 | 未闭合原因 | 下步最小解阻动作 |
| --- | --- | --- | --- | --- |
| 不可能的房间 | 神志检定 4+ 后从物品牌堆抽 1 张物品牌并加入当前探索者持有区；0-3 精神伤害另归伤害桶 | `min-branch-verified / Board component representative / partial-ui` | 已有抽物品代表链和物品牌堆减少断言；Board 组件代表链已证明抽牌 UI 反馈和抽到物品进入持有区，也证明失败精神伤害反馈；未证明物品牌堆耗尽、精神伤害减免 / 死亡保护和真实入口 E2E / 截图 | 点名当前物品牌堆数量、抽到的物品 id、当前探索者持有区、牌堆耗尽边界和失败伤害消费者边界 |
| 断手 | 接受分支包含 2 点物理伤害和抽 1 张物品牌；拒绝分支无事发生 | `min-branch-verified / Board component representative / partial-ui` | 已有接受/拒绝领域代表链；Board 组件代表链已证明确认/拒绝按钮、拒绝无事发生、接受后的物理伤害 + 抽物品反馈和持有区写入；未证明物理伤害减免 / 改写 / 死亡保护与抽物品顺序、物品牌堆耗尽、真实入口 E2E / 截图 | 点名接受分支、当前伤害消费者、物品牌堆状态和死亡保护预期 |
| 轮到约拿了 | 只允许选择当前探索者持有区里的非武器物品；缺 cardId 或选择武器会被拒绝；成功后弃置该物品并获得 1 点神志；拒绝后受到一颗骰子的精神伤害 | `min-verified / Board component representative / partial-ui` | 已有缺卡拒绝、武器拒绝、地图弃置、神志 +1 和拒绝精神伤害代表链；Board 组件代表链已证明候选持有物只展示地图、武器砍刀被排除、未选物品确认禁用、选择地图后派发 `cardId=map`，并证明拒绝后显示“受到 1 颗骰子的精神伤害”；未证明无非武器物品、已用 / 不可交易限制、弃置终点可见性、精神伤害减免和死亡保护 | 点名候选持有物列表、武器排除列表、已用牌限制是否纳入本动作、弃置终点、精神伤害减免和死亡保护 |
| 游魂 | 接受分支可选择当前探索者持有区内任意物品并埋葬到底部，再选择一项属性 +1；拒绝后神志检定，4+ 抽物品，0-3 通用伤害 | `min-verified / Board component representative / partial-ui` | 已有埋葬地图到底部、任意属性代表、拒绝后抽物品和通用伤害领域代表链；Board 组件代表链已证明地图 / 砍刀候选、力量 / 速度 / 知识 / 神志属性候选、只选物品不能确认、地图 + 知识后派发 `cardId=map / trait=knowledge`；未证明无物品 UI、抽物品 UI / 物品牌堆耗尽、拒绝失败通用伤害 UI、通用伤害 / 死亡保护组合和真实入口 E2E / 截图 | 点名被埋葬物品、物品牌堆底部顺序、选择属性、拒绝分支骰值、抽物品 UI 和通用伤害消费者 |
| 一罐器官 | 神志检定 4+ 后从物品牌堆抽 1 张物品牌并加入当前探索者持有区；0-3 力量 -1 另归属性降低 / 死亡保护边界 | `min-branch-verified / Board component representative / partial-ui` | 已有力量 -1 和抽物品领域代表链；Board 组件代表链已证明神志检定骰盘、成功抽物品进入持有区和失败力量 -1 确认步骤；未证明物品牌堆耗尽、力量降低到下限或致死边界 | 点名物品牌堆耗尽边界、抽到物品和失败分支属性下限 |

| 共享机制 | 当前证据 | 合同层只登记的边界 | 未授权前仍禁止 |
| --- | --- | --- | --- |
| 抽物品牌堆 | `drawPossession(kind='item')`、`createDrawnCard`、持有区写入和 `deckCounts.item` 减少已有代表链 | 代表链只证明抽 1 张物品牌能进入持有区；不证明牌堆耗尽、真实 UI、日志或更多随机顺序组合 | 不改抽牌结算；不补 E2E / 截图 |
| 非武器筛选 | `optionalItemEffect.itemFilter='nonWeaponItem'` 与 `ATTACK_WEAPON_CARD_IDS` 已拒绝砍刀代表链 | 只能证明轮到约拿了的非武器筛选代表链；不能外推为所有交易 / 已用 / 不可交易状态完成 | 不改筛选逻辑或 UI 禁用 |
| 弃置 vs 埋葬 | 轮到约拿了使用 `consumeAction='discard'`；游魂使用 `consumeAction='bury'` 且代表链证明地图进入物品牌堆底部 | 二者终点必须分开记录；不能把“弃置”和“埋葬到底部”混成同一动作 | 不改弃置 / 埋葬终点；不补资源或上传 |

| 相邻桶 | 原因 |
| --- | --- |
| NB-01 事件伤害 / 死亡保护 / 减免组合 | 不可能的房间失败精神伤害、断手物理伤害、轮到约拿了拒绝精神伤害、游魂通用伤害和一罐器官力量降低仍消费伤害 / 属性降低 / 死亡保护边界 |
| NB-06 物品伤害减免 / 死亡保护 | 断手物理伤害可能与胸针、奇异护符、盔甲、头骨和死亡保护交叉 |
| NB-12 预兆交易 / 持有物转移 / 已用牌限制 | 事件消费的是当前探索者持有物；交易、搜尸、死亡掉落和已用牌限制会改变候选来源边界 |
| NB-16 UI / E2E / 截图授权前置 | 本桶只登记未来 UI/E2E 消费入口；不直接执行 Board/UI、真实入口 E2E 或截图 |

NB-03 裁定：

1. 不可能的房间、断手、游魂拒绝成功分支和一罐器官已有抽物品牌堆代表链；轮到约拿了已有非武器筛选与弃置代表链；游魂已有埋葬物品到底部代表链。
2. 本桶只把抽物品牌堆耗尽、非武器筛选、已用 / 不可交易、埋葬 / 弃置和持有物来源边界登记清楚，不新增任何持有物筛选、牌堆结算、事件、伤害、Board/UI、E2E、截图、音频或资源动作。
3. 后续若进入实现或测试，必须从具体事件开始，点名当前持有物列表、牌堆状态、选中 cardId、消费终点和验收口径；不得以“事件物品选择”泛化批量开改。
4. 当前规范没有把 `blocked` 写成停工口令；本节继续证明 `downstream-blocked` 只拦完成宣称和下游 UI/E2E/截图，不拦合同层补证。
5. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.43 NB-04 领取结果：事件投骰 / 属性 / 重掷消费者桶（2026-07-29）

本节领取 6.32 的 NB-04，只消费 6.12、6.17、`temp/betrayal-event-branch-work-order-2026-07-29.json`、`temp/betrayal-full-deck-next-bucket-selector-2026-07-29.json`、`event-effect-implementation-audit-2026-07-29.md`、`item-effect-implementation-audit-2026-07-29.md`、`src/games/betrayal/scenarioConfig.ts`、`src/games/betrayal/game.ts` 和 `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`；不修改重掷、替代投骰、属性上下限、祝福、伤害、死亡保护、Board/UI、E2E、截图、图片、音频或资源。结构化副本落在 `temp/betrayal-event-roll-trait-reroll-bucket-2026-07-29.json`。

| 事件 / 节点 | 已锁合同边界 | 当前证据状态 | 未闭合原因 | 下步最小解阻动作 |
| --- | --- | --- | --- | --- |
| 佳馔满桌 | 选择知识或神志进行事件属性检定；5+ 获得 1 点速度；0-4 受到 1 点通用伤害 | `min-domain-verified / Board component representative / partial-ui` | 已有神志成功、失败通用伤害和最近投骰状态代表链；Board 组件代表链已证明知识/神志选择、成功速度 +1 与失败分支通用伤害分配；未证明速度上限、通用伤害 / 死亡保护、祝福与重掷组合 | 点名选择属性、投骰来源、速度轨上限、通用伤害分配对象和是否允许兔脚 / 恐怖玩偶 / 幸运硬币介入 |
| 禁忌知识 | 神志事件属性检定；4+ 知识 +1；2-3 知识 +1 且神志 -1；0-1 两颗骰子的精神伤害 | `min-domain-verified / Board component representative / partial-ui` | 已有 4+、2-3、0-1 领域代表链；Board 组件代表链已证明事件房间翻牌后的神志检定骰盘、总点数 2、2-3 分支详情和确认步骤，也已证明总点数 0 时 0-1 双骰精神伤害分支和确认步骤；未证明多段属性上下限、神志直接降低致死、精神伤害减免 / 死亡保护、重掷/替代组合和真实入口 E2E / 截图 | 点名骰值分支、知识 / 神志当前轨位、直接属性降低是否触发死亡保护、精神伤害消费者和最近投骰重掷窗口 |
| 可怜的尤里克 | 神志事件属性检定；4+ 知识 +1；0-3 受到 1 点精神伤害 | `min-domain-verified / Board component representative / partial-ui` | 已有成功知识提升和失败精神伤害领域代表链；Board 组件代表链已证明事件房间翻牌后的神志检定骰盘、总点数 8 的知识提升分支和总点数 0 的精神伤害分支；未证明知识上限、精神伤害减免 / 死亡保护、最近投骰重掷后分支回滚和真实入口 E2E / 截图 | 点名神志检定骰值、知识轨上限、精神伤害消费者和是否进入最近投骰重掷窗口 |
| 片刻希望 | 在当前房间放置祝福标记；后续在该房间进行属性检定时额外投 1 骰 | `min-verified / Board component representative / partial-combo` | 已有放置祝福并被后续摇曳灯光属性检定消费的领域代表链；房间祝福标记 UI 已有 Board 组件代表链；未证明加骰可见性、祝福与兔脚 / 恐怖玩偶 / 幸运硬币 / 天使之羽组合顺序 | 点名祝福所在房间、后续检定来源、额外骰是否进入最近投骰快照，以及加骰同屏展示边界 |
| 神秘液体 | 可选择是否投固定 3 骰；接受后按固定骰总点数 0-6 改变一组属性；拒绝无事发生 | `min-branch-verified / Board component representative / downstream-open` | 已有拒绝和 0-6 多分支代表链；Board 组件代表链已证明卡面、拒绝按钮、喝下按钮、固定 3 骰骰盘和分支结果承接；未证明属性上下限、直接属性降低致死、固定骰与属性检定消费者差异、固定骰重掷组合和日志 | 点名接受 / 拒绝、固定 3 骰点数、四项属性轨位、兔脚是否可重掷固定事件骰，以及恐怖玩偶 / 幸运硬币 / 天使之羽是否排除 |
| 肉质苔癣 | 可选择是否吸入芳香；拒绝无事发生；接受后固定 2 骰，4+ 任选属性 +1，0-3 受到一颗骰子的精神伤害 | `min-branch-verified / Board component representative / partial-ui` | 已有不吸入无事发生、吸入后固定 2 骰 4+ 待选任意属性、选择知识 +1、0-3 精神伤害和兔脚重掷成功分支保留待选属性的领域代表链；Board 组件代表链已证明拒绝无事发生、接受后固定 2 骰骰盘、选择知识和“知识 +1”确认步骤，也已证明失败精神伤害确认步骤；未证明精神伤害减免 / 死亡保护、属性上限、更多属性选择、兔脚 UI / 更多重掷组合和真实入口 E2E / 截图 | 点名接受 / 拒绝、固定 2 骰点数、任选属性、精神伤害消费者、兔脚是否介入固定事件骰，以及恐怖玩偶 / 幸运硬币 / 天使之羽是否排除 |
| 脑状食品 | 力量事件属性检定；5+ 任选力量或速度 +1；1-4 速度 +1 并神志 -1；0 受到 2 点通用伤害 | `min-branch-verified / Board component representative / partial-ui` | 已有力量检定三档、缺选择拒绝、确认步骤阻止提前结束、头骨死亡保护和兔脚重掷回滚死亡 / 狂热病患化的领域代表链；Board 组件代表链已证明 5+ 速度奖励、0 分支通用伤害分配和同属性重复分配预览；未证明成功力量 UI、属性上下限、直接属性降低致死 / 死亡保护、通用伤害减免 / 胸针组合、兔脚 UI / 更多重掷组合和真实入口 E2E / 截图 | 点名力量检定骰值、任选力量 / 速度、神志轨位、通用伤害分配对象、直接属性降低 / 通用伤害消费者，以及是否允许兔脚 / 恐怖玩偶 / 幸运硬币 / 天使之羽介入 |
| 吊死鬼 | 力量、速度、知识、神志四项事件属性检定；每项 2+ 成功，失败的属性各 -1；四项全成功后任选一项属性 +1 | `min-branch-verified / Board component representative / partial-ui` | 已有四项属性连续检定、混合成功/失败扣减速度与神志、全通过后知识 +1 和头骨死亡保护领域代表链；Board 组件代表链已证明四项属性检定说明、全通过后奖励属性选择和“知识 +1”反馈；未证明失败属性降低 UI、更多奖励属性、属性上下限、直接属性降低致死 / 死亡保护、兔脚 UI / 更多重掷组合和真实入口 E2E / 截图 | 点名四项检定骰值、失败属性轨位、奖励属性选择、直接属性降低消费者、死亡保护触发边界，以及是否允许兔脚 / 恐怖玩偶 / 幸运硬币 / 天使之羽介入 |
| 一条秘密通道 | 知识事件属性检定；5+ 当前板块 + 任意另一已发现板块放置秘密通道标志物并知识 +1；3-4 当前板块 + 任意地面板块放置标志物；0-2 当前板块 + 任意地下室板块放置标志物并神志 -1 | `min-branch-verified / Board component representative / partial-ui` | 已有 5+ / 3-4 / 0-2 三档、非法同房 / 非法楼层目标拒绝、发现确认前禁止移动、0-2 神志 -1 和头骨死亡保护领域代表链；Board 组件代表链已证明第二目标房间候选、点击门厅、两个秘密通道标志物和“知识 +1”反馈；未证明非法原因 UI、更多目标范围、标志物移动入口、属性上下限、直接神志降低致死 / 死亡保护、兔脚 UI / 更多重掷组合和真实入口 E2E / 截图 | 点名知识检定骰值、目标楼层 / 区域范围、秘密通道标志物移动消费者、知识 / 神志轨位、直接属性降低消费者、死亡保护触发边界，以及是否允许兔脚 / 恐怖玩偶 / 幸运硬币 / 天使之羽介入 |
| 摇曳灯光 | 选择速度或力量进行事件属性检定；5+ 速度 +1；0-4 受到一颗骰子的物理伤害 | `min-domain-verified / Board component representative / partial-combo` | 已有力量成功、失败物理伤害和祝福加骰领域代表链；Board 组件代表链已证明选择速度 UI、速度检定骰盘和成功分支；未证明速度上限、祝福与重掷组合、物理伤害减免 / 死亡保护 | 点名选择属性、祝福房间、骰子数组、速度轨上限、物理伤害消费者和最近投骰重掷窗口 |
| 着火的人 | 神志事件属性检定；4+ 神志 +1；2-3 放置到入口大厅；0-1 同时受到一颗骰子的物理伤害和一颗骰子的精神伤害 | `min-domain-verified / Board component representative / partial-ui` | 已有 4+、2-3、0-1 领域代表链；Board 组件代表链已证明事件房间翻牌后的神志检定骰盘、总点数 2、2-3 分支详情、确认步骤和当前位置更新；总点数 0 时已证明 0-1 双伤害分支、物理伤害骰反馈和精神伤害骰反馈可见；未证明双伤害分配顺序、减伤 / 胸针 / 盔甲 / 头戴耳机 / 死亡保护组合、最近投骰重掷后分支回滚和真实入口 E2E / 截图 | 点名神志骰值、入口大厅目标、两类伤害骰、伤害消费者顺序和是否允许最近投骰重掷 |
| 上古旧宅 | 选择速度或力量进行事件属性检定；5+ 放置到任意板块；3-4 放置到任意地面板块并受 1 点通用伤害；0-2 放置到任意地下室板块并受 1 点精神伤害 | `min-branch-verified / Board component representative / partial-ui` | 已有速度成功、力量地面通用伤害、速度地下室精神伤害和非法楼层目标拒绝领域代表链；Board 组件代表链已证明力量选择、地面目标、目标点击后通用伤害分配和分支反馈；未证明上层成功 UI、地下室精神伤害 UI、属性上下限、通用/精神伤害减免 / 死亡保护、重掷/替代组合和真实入口 E2E / 截图 | 点名选择属性、骰值分支、目标楼层、伤害消费者、最近投骰重掷窗口和真实入口残余 |

| 共享机制 | 当前证据 | 合同层只登记的边界 | 未授权前仍禁止 |
| --- | --- | --- | --- |
| 事件属性检定 | `rollEventTraitCheckWithDice` 会读取当前属性值、被动属性检定加值、事件属性额外骰、房间祝福额外骰和天使之羽下一次非战斗检定替代结果 | 适用于 `trait` roll、`chooseTraitRoll`、一条秘密通道和吊死鬼这类 `allTraitChecks`；当前只能证明代表事件能写入 `recentRoll.kind='eventTraitCheck'` 或 `recentAllTraitCheck` 并结算分支 | 不改属性骰计算、天使之羽消费、被动加值或祝福加骰 |
| 固定事件骰 | `rollEventFixedDice` 使用固定骰数，写入 `recentRoll.kind='eventDiceRoll'`，不读取属性值、祝福、属性加值或天使之羽替代结果 | 神秘液体、肉质苔癣这类固定骰必须与属性检定分开；固定骰可被兔脚类单骰重掷窗口逐项审计，但不自动开放恐怖玩偶 / 幸运硬币 | 不把固定骰当作属性检定；不让固定骰消费天使之羽 |
| 最近投骰重掷窗口 | 兔脚可作为单骰重掷消费者；恐怖玩偶只允许最近属性检定全骰重掷；幸运硬币只允许最近属性检定空白骰重掷且会产生精神伤害 | 当前证据证明事件属性检定、房间回合末属性检定和固定事件骰有不同准入；天使之羽页面 0-8 数字选择已补代表链，但它不是最近投骰重掷窗口本身；新增事件骰消费者必须逐项确认 | 不改重掷准入、不补重掷组合测试、不把天使之羽 UI 代表链外推为全部投骰消费者完成 |
| 祝福额外骰 | 片刻希望可在房间放置祝福，后续事件属性检定读取房间祝福并多投 1 骰 | 已证明一条放置与消费链，并已有房间祝福标记 UI 代表链；祝福额外骰是否与重掷、天使之羽、被动加值同屏展示仍未闭合 | 不新增祝福标记 UI；不把一条代表链外推为所有属性检定完成 |
| 分支回滚快照 | 事件投骰会保留分支阈值和效果快照，重掷后可回滚旧分支并应用新分支 | 只证明部分事件属性检定 / 固定事件骰分支可回滚；未证明所有属性上下限、伤害、死亡保护、作祟状态和 pending 选择链都完整回滚 | 不改 `eventEffectSnapshot` 或回滚逻辑 |

| 相邻桶 | 原因 |
| --- | --- |
| NB-01 事件伤害 / 死亡保护 / 减免组合 | 佳馔满桌、禁忌知识、可怜的尤里克、肉质苔癣、脑状食品、吊死鬼、一条秘密通道、摇曳灯光、着火的人、上古旧宅的失败 / 低分分支仍消费伤害、直接属性降低、死亡保护和双伤害顺序 |
| NB-06 物品伤害减免 / 死亡保护 | 事件投骰失败后的精神 / 物理 / 通用伤害要与头戴耳机、胸针、奇异护符、皮夹克、幸运硬币和牙齿项链边界对齐 |
| NB-09 物品重掷 / 替代数值 / 属性检定消费者 | 恐怖玩偶、幸运硬币、兔脚、天使之羽、手电筒、魔法相机等消费者必须和事件属性检定 / 固定事件骰分开准入 |
| NB-11 预兆属性检定加值 / 非战斗检定替代 | 书本、狗、面具、头骨、圣符、盔甲、雕像、指环等预兆加值或替代消费者会改变属性检定总数 |
| NB-16 UI / E2E / 截图授权前置 | 本桶只登记未来 UI/E2E 消费入口；不直接执行 Board/UI、真实入口 E2E 或截图 |

NB-04 裁定：

1. 十二张事件已按事件属性检定、固定事件骰、祝福额外骰、属性上下限、最近投骰重掷和分支回滚六类归桶；这是合同边界，不是组合验证完成。
2. 神秘液体的固定 3 骰和肉质苔癣的固定 2 骰不得自动视为属性检定；片刻希望本身不投骰，而是给后续属性检定提供祝福额外骰。
3. 兔脚、恐怖玩偶、幸运硬币和天使之羽的准入必须按“事件属性检定 / 固定事件骰 / 作祟检定 / 攻击 / 房间回合末检定”逐项裁定，不能因为有一个代表链就全开。
4. 后续若进入实现或测试，必须从“事件 + 投骰来源 + 消费者 + 预期分支 + 验收口径”开始，不得按十二张事件或整事件牌批量开改。
5. 当前规范没有把 `blocked` 写成停工口令；本节继续证明 `downstream-blocked` 只拦完成宣称和下游 UI/E2E/截图，不拦合同层补证。
6. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.44 NB-05 领取结果：事件作祟特例 / 展示音频桶（2026-07-29）

本节领取 6.32 的 NB-05，只消费 6.12、6.17、6.29、6.30、`temp/betrayal-event-branch-work-order-2026-07-29.json`、`temp/betrayal-full-deck-next-bucket-selector-2026-07-29.json`、`event-effect-implementation-audit-2026-07-29.md`、`docs/games/betrayal/haunts/07-upon-reflection.md`、`src/games/betrayal/scenarioConfig.ts`、`src/games/betrayal/game.ts` 和 `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`；不实现完整 7 号作祟，不新增脚注 UI / 音频，不修改事件符号、作祟、怪物、资源、Board/UI、E2E、截图、图片、音频或上传。结构化副本落在 `temp/betrayal-event-haunt-audio-special-bucket-2026-07-29.json`。

| 事件 / 节点 | 已锁合同边界 | 当前证据状态 | 未闭合原因 | 下步最小解阻动作 |
| --- | --- | --- | --- | --- |
| 怪异的镜子：拒绝分支 | 拒绝进行作祟检定时抽取 1 张物品牌；该分支仍属于事件物品 / 牌堆桶 | `min-domain-verified / downstream-open` | 已有拒绝抽物品代表链；未证明物品牌堆耗尽、抽牌 UI / 日志、与事件选择面板完整承接 | 若进入下游，回到 NB-03 点名牌堆状态、抽到物品和 UI / 日志验收 |
| 怪异的镜子：接受检定 0-4 | 接受作祟检定但未达到 5 时，获得 1 点神志并留在作祟前 | `min-branch-verified / partial-ui` | 已有 0-4 神志 +1 代表链；未证明神志上限、检定 UI、最近投骰边界、日志和真实入口承接 | 点名检定骰值、神志轨位、是否仍允许事件后行动和 UI 展示范围 |
| 怪异的镜子：接受检定 5+ | 进入 7 号无叛徒代表揭示态；写入秘密组合、作祟揭秘者、镜中怪物和 setup 队列，但仍是代表链 | `haunt-7-representative / min-domain-verified / partial` | 已有秘密组合、私密视角、事件符号跳过、镜中提示、破咒、镜中怪物移动 / 神志攻击代表链；未证明完整 7 号作祟、专属 UI、E2E、截图和完整怪物回合组合 | 若进入下游，必须点名 7 号具体机制节点、公开 / 私密视角、专属 UI 对象和验收范围 |
| 无线电广播：规则结算 | 固定投 2 骰；3-4 知识 +1；0-2 受到一颗骰子的精神伤害 | `min-domain-verified / Board component representative / partial-ui` | 已有成功知识提升和失败精神伤害领域代表链；Board 组件代表链已证明固定 2 骰、总点数 4 时展示知识 +1 成功分支和确认步骤，总点数 0 时展示 0-2 精神伤害分支和“受到 1 颗骰子的精神伤害”反馈；未证明精神伤害减免 / 死亡保护、固定骰 / 最近投骰重掷准入和真实入口 E2E / 截图 | 若进入下游，回到 NB-01 / NB-04 点名骰值、知识轨位、精神伤害消费者、减免/死亡保护和 UI / 日志 |
| 无线电广播：脚注 / 音频提示 | 脚注只作为玩家可见展示或可能的音频提示，不改变事件检定、伤害或属性结算 | `footnote-contract-set / asset-preflight-indexed / no-asset-change` | 当前只裁定脚注用途；未接正式脚注 UI，未锁音频素材来源，未压缩 / 上传 / 远端回查 | 先点名是做“脚注展示”还是“音频资源”，再锁素材来源、运行时落点和验收口径 |

| 隔离边界 | 当前合同结论 | 禁止外推 |
| --- | --- | --- |
| 7 号作祟代表链 | 怪异的镜子 5+ 能进入 7 号无叛徒代表揭示态，并已有秘密组合、事件符号跳过、镜中提示、破咒、镜中怪物移动 / 攻击的最小领域链 | 不证明完整 7 号作祟，不证明专属 UI，不证明真实入口 E2E / 截图，不证明完整怪物回合组合 |
| 事件符号房间 | 7 号作祟中事件符号房间已按“镜中沉默”跳过事件牌，不抽取、不结算、不移动事件牌堆且不结束回合 | 不证明所有作祟的事件符号规则，不证明雕像、叛徒跳过事件和其它作祟交互全部闭合 |
| 镜中提示 | 领域命令链可让作祟揭秘者选择当前事件牌堆事件提示存活玩家，事件不结算并放一边 | 不证明正式私密事件牌选择 UI、目标玩家选择 UI、提示展示 UI 或截图完成 |
| 破咒 | 领域链覆盖 0-4 无反馈、5+ 组合错误只给否定反馈、三项全中英雄胜利、作祟揭秘者不能破咒 | 不证明破咒 UI、秘密组合选择提示、玩家可见反馈和完整终局展示完成 |
| 镜中怪物 | 已有最近目标移动 / 平手路径裁决 / 已同房神志攻击和精神伤害代表链 | 不证明专属移动目标选择 UI、完整怪物回合、更多探索者位置组合或 E2E / 截图完成 |
| 无线电广播脚注 | 脚注不是规则效果，只是展示 / 音频提示候选 | 不证明音频资源已存在、已授权、已接入、已压缩上传或已远端回查 |

| 相邻桶 | 原因 |
| --- | --- |
| NB-01 事件伤害 / 死亡保护 / 减免组合 | 无线电广播失败精神伤害、怪异的镜子拒绝抽物品外的事件失败 / 伤害消费者仍需回到伤害桶 |
| NB-03 事件物品 / 牌堆 / 持有物选择 | 怪异的镜子拒绝分支抽物品仍消费物品牌堆边界 |
| NB-04 事件投骰 / 属性 / 重掷消费者 | 怪异的镜子接受检定和无线电广播固定 2 骰仍需区分属性检定 / 固定事件骰 / 最近投骰重掷 |
| NB-14 / NB-15 7 号作祟子账本 | 怪异的镜子 5+ 进入 7 号代表链后，公开 / 私密可见性、setup、破咒、镜中提示、镜中怪物移动攻击均回到 7 号子账本 |
| NB-16 UI / E2E / 截图 / 脚注音频授权前置 | 无线电广播脚注展示 / 音频资源和 7 号专属 UI / E2E / 截图均需单独授权 |

NB-05 裁定：

1. 怪异的镜子已按拒绝抽物品、接受 0-4 神志 +1、接受 5+ 进入 7 号代表揭示态三层隔离；这不等于完整 7 号作祟完成。
2. 无线电广播已按规则结算和脚注 / 音频提示两层隔离；脚注不改变事件规则结算，也不证明音频资源已经接入。
3. 7 号作祟代表链、无线电广播脚注和脚注音频资源必须继续保留不同状态：`representative-only`、`footnote-contract-set`、`asset-preflight-indexed`，不能混成同一个完成项。
4. 后续若进入实现或测试，必须从“怪异的镜子具体 7 号节点”或“无线电广播脚注展示 / 音频资源具体路径”重新锁定问题对象、真相来源、目标入口和验收口径。
5. 当前规范没有把 `blocked` 写成停工口令；本节继续证明 `downstream-blocked` 只拦完成宣称和下游 UI/E2E/截图，不拦合同层补证。
6. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.45 NB-07 领取结果：物品武器攻击 / 多武器互斥 / 交易限制桶（2026-07-29）

本节领取 6.32 的 NB-07，只消费 6.13、6.17、6.27、6.32、`temp/betrayal-item-consumer-work-order-2026-07-29.json`、`temp/betrayal-full-deck-next-bucket-selector-2026-07-29.json`、`item-effect-implementation-audit-2026-07-29.md`、`src/games/betrayal/game.ts`、`src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 和 `src/games/betrayal/__tests__/Board.foundation.test.tsx` 的只读证据；不改攻击 UI、交易限制、怪物 / 作祟攻击组合测试、Board/UI、E2E、截图、图片、音频或上传。结构化副本落在 `temp/betrayal-item-weapon-attack-trade-bucket-2026-07-29.json`。

| 物品 / 节点 | 已锁合同边界 | 当前证据状态 | 未闭合原因 | 下步最小解阻动作 |
| --- | --- | --- | --- | --- |
| 枪 | 作为攻击武器显式声明后，使用速度攻击视线内目标；失败不反伤；使用后进入本回合已用牌，不能交易 | `min-domain-verified / partial-ui / partial-combo` | 已有视线目标、速度攻击、失败不反伤和用后限制代表链；未证明所有视线边界、怪物目标、作祟攻击组合和真实入口完整闭合 | 若进入下游，点名目标房间、视线阻挡 / 同房边界、目标类型和 UI / 组合验证范围 |
| 十字弓 | 作为攻击武器显式声明后，使用速度攻击同板块或相邻板块目标；失败不反伤；使用后进入本回合已用牌，不能交易 | `min-domain-verified / partial-ui / partial-combo` | 已有同板块 / 相邻目标、速度攻击、失败不反伤和用后限制代表链；未证明所有相邻边界、怪物目标、作祟攻击组合和真实入口完整闭合 | 若进入下游，点名相邻判定、目标类型、失败分支和 UI / 组合验证范围 |
| 砍刀 | 作为攻击武器显式声明后，攻击结果 +1；未声明时不自动生效；使用后进入本回合已用牌，不能交易 | `covered-by-existing-contract / min-ui-representative / partial-combo` | 已有显式使用、未声明不自动 +1、攻击入口选择和用后限制代表链；未证明多武器互斥、更多攻击来源组合和完整交易 UI 组合 | 若进入下游，点名攻击来源、武器选择状态、是否已有其它武器已用和交易入口验证范围 |
| 电锯 | 作为攻击武器显式声明后，攻击时额外投 1 骰；使用后进入本回合已用牌，不能交易 | `min-domain-verified / partial-ui / partial-combo` | 已有攻击额外骰和用后限制代表链；未证明怪物目标、多武器互斥、作祟攻击组合和真实入口完整闭合 | 若进入下游，点名攻击来源、额外骰叠加对象、目标类型和组合验证范围 |
| 炸药 | 代替常规攻击，选择当前或相邻的已发现板块；目标板块内探索者 / 怪物分别速度检定；失败探索者进入 4 点物理伤害分配，失败怪物走怪物受伤后端；使用后从持有区移除并埋葬，记为本回合已攻击 / 已用牌 | `min-domain-verified / min-ui-representative / partial-combo` | 已有目标板块、群体速度检定、探索者伤害、怪物受伤、埋葬和已攻击代表链；当前树已补 Board 页面组件目标态代表链；未证明特殊免疫、更多怪物 / 作祟组合、非法原因展示和真实入口完整闭合 | 若进入下游，点名目标板块、目标集合、怪物 / 探索者分支、弃置终点和 UI / 组合验证范围 |

| 共享机制 | 当前证据 | 合同层只登记的边界 | 未授权前仍禁止 |
| --- | --- | --- | --- |
| 显式武器声明 | 攻击武器只有在命令 payload 点名武器后才生效；未声明时砍刀等武器不会自动改写攻击 | 武器效果是攻击消费者，不是持有即自动常驻 | 不改攻击命令结构或自动套用武器效果 |
| 目标范围裁定 | 枪走视线；十字弓走同板块 / 相邻；炸药走当前 / 相邻已发现板块；砍刀、电锯走普通攻击入口 | 范围规则必须和目标类型、房间 / 板块、作祟怪物目标分开审计 | 不新增目标选择 UI，不修改视线 / 相邻 / 板块合法性 |
| 攻击骰 / 属性改写 | 枪、十字弓改用速度攻击；砍刀改写攻击结果 +1；电锯额外投 1 骰；炸药改成目标板块速度检定 | 当前只登记不同武器如何改写攻击消费者；未证明所有叠加、重掷、伤害改写和死亡保护组合 | 不改骰数、属性、伤害类型或重掷消费者 |
| 失败不反伤例外 | 枪、十字弓失败不反伤攻击者 | 该例外只属于这两把远程武器，不外推到普通武器、怪物攻击或炸药 | 不改攻击失败伤害分配 |
| 本回合已用 / 新获得限制 | `usedCardIdsThisTurn` 和本回合新获得原因会让武器在攻击选择读模型中禁用；使用后交易受限 | 只登记“使用后不能交易 / 新获得不能立刻用”的合同边界；交易 UI 和所有转移组合仍未闭合 | 不改交易限制或交易 UI |
| 多武器互斥 | 当前证据能看到武器选择区和已用 / 新获得禁用原因；尚未形成所有武器组合的互斥矩阵 | 多武器互斥是后续组合缺口，不得由单个砍刀 / 枪代表链外推完成 | 不补组合测试，不改攻击 UI 或读模型 |

| 相邻桶 | 原因 |
| --- | --- |
| NB-06 物品伤害减免 / 死亡保护 | 武器攻击、防御、炸药伤害会继续进入伤害减免、改写、死亡保护和分配顺序 |
| NB-09 物品重掷 / 替代数值 / 属性检定消费者 | 攻击投骰、炸药速度检定和远程武器失败分支会与兔脚、幸运硬币、恐怖玩偶、天使之羽等消费者发生准入边界 |
| NB-10 物品移动 / 地图 / 门位墙体 | 炸药目标板块和枪视线边界与已发现房间、相邻板块、墙体 / 门位合法性相关 |
| NB-12 预兆交易 / 持有物转移 / 已用牌限制 | 武器使用后的交易限制和持有物转移需要与狗交易、普通交易、死亡掉落 / 搜尸风险分开审计 |
| NB-15 7 号作祟破咒 / 镜中提示 / 镜中怪物移动攻击 | 作祟怪物目标、作祟攻击和武器攻击组合仍属于 7 号作祟专属缺口 |
| NB-16 UI / E2E / 截图授权前置 | 攻击武器选择、目标高亮、目标板块选择和真实入口验证均需单独授权 |

NB-07 裁定：

1. 枪、十字弓、砍刀、电锯和炸药已按攻击来源、目标范围、骰 / 属性改写、失败例外、用后限制和多武器互斥六类登记；这只是合同边界，不等于攻击 UI 或组合测试完成。
2. 枪和十字弓的失败不反伤只登记为远程武器例外，不能外推到普通攻击、怪物攻击、炸药或其它武器。
3. 炸药是“代替攻击 + 目标板块 + 群体速度检定 + 埋葬”的独立节点，不能只归并成普通武器攻击，也不能只归并成房间 / 地图目标选择。
4. `usedCardIdsThisTurn` 在本节只作为“用后交易限制 / 新获得禁用 / 已用禁用”的合同证据；不授权修改交易限制、持有物转移或 UI。
5. 后续若进入实现或测试，必须从“某一把武器 + 一个攻击来源 + 一个目标类型 + 一个验收入口”开始，不得按五张武器或整物品牌批量开改。
6. 当前规范没有把 `blocked` 写成停工口令；本节继续证明 `downstream-blocked` 只拦完成宣称和下游 UI/E2E/截图，不拦合同层补证。
7. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.46 NB-08 领取结果：物品治疗 / 属性恢复 / 同房目标桶（2026-07-29）

本节领取 6.32 的 NB-08，只消费 6.13、6.17、6.27、6.32、`temp/betrayal-item-consumer-work-order-2026-07-29.json`、`temp/betrayal-full-deck-next-bucket-selector-2026-07-29.json`、`item-effect-implementation-audit-2026-07-29.md`、`src/games/betrayal/possessionEffects.ts`、`src/games/betrayal/game.ts`、`src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 和 `src/games/betrayal/__tests__/Board.foundation.test.tsx` 的只读证据；不新增治疗 UI，不改回合时点、死亡保护、交易限制、Board/UI、E2E、截图、图片、音频或上传。结构化副本落在 `temp/betrayal-item-healing-target-bucket-2026-07-29.json`。

| 物品 / 节点 | 已锁合同边界 | 当前证据状态 | 未闭合原因 | 下步最小解阻动作 |
| --- | --- | --- | --- | --- |
| 奇怪的药品 | 主动埋葬后治疗当前探索者的力量和速度；消耗后离开持有区并进入本回合已用牌 | `covered-by-existing-contract / consumer-review-on-change` | 已有主动使用、埋葬、力量 / 速度恢复代表链；未证明伤害后治疗、死亡保护、交易限制和更多作祟状态组合 | 若进入下游，点名伤害来源、恢复前轨位、是否已用 / 可交易和 UI / 日志验收范围 |
| 镜子 | 主动埋葬后治疗当前探索者的知识和神志；仅以持有者自身为目标 | `min-verified / partial-combo` | 已有主动埋葬治疗知识 / 神志最小运行链；未证明伤害后治疗、作祟状态、交易限制、UI / 日志和更多回合时点组合 | 若进入下游，点名知识 / 神志轨位、使用时点、是否作祟中和 UI / 日志验收范围 |
| 急救包 | 主动埋葬后治疗自己所有濒死属性，或治疗同板块另一位探索者；不同板块目标被拒绝 | `covered-by-existing-contract / min-ui-representative / partial-combo` | 已有自己 / 同板块目标、不同板块拒绝、页面同板块目标选择和预览代表链；未证明所有目标 UI 状态、死亡保护、交易限制、作祟 / 死亡掉落组合 | 若进入下游，点名目标玩家、同板块 / 不同板块状态、濒死属性集合和 UI / 组合验证范围 |
| 牙齿项链 | 回合结束且存在当前濒死属性时，可选择一项濒死属性提升 1 步；无濒死属性不拦截；非法选择拒绝；可跳过 | `min-domain-verified / min-ui-representative / partial-combo` | 已有回合结束拦截、濒死筛选、选择提升、跳过和非法属性拒绝代表链；Board 组件选择 / 跳过代表链已补；未证明真实 Playwright / 截图、作祟回合、房间回合末、死亡保护后顺序和更多组合 | 若进入下游，点名回合结束来源、濒死属性、死亡保护 / 房间伤害前后顺序和真实入口 / 组合验证范围 |

| 共享机制 | 当前证据 | 合同层只登记的边界 | 未授权前仍禁止 |
| --- | --- | --- | --- |
| 治疗属性集合 | `POSSESSION_USE_EFFECTS` 把奇怪的药品映射到力量 / 速度，镜子映射到知识 / 神志，急救包映射到四项属性 | 治疗集合是主动使用合同，不代表所有伤害后恢复、死亡保护或作祟状态组合已验证 | 不改治疗数据或属性恢复算法 |
| 消耗 / 埋葬终点 | 消耗型主动物品使用后离开持有区，并进入本回合已用牌 | 只登记“使用后不可再次使用 / 不可交易”的后续边界；交易 UI 与死亡掉落仍是相邻桶 | 不改交易限制、搜尸或死亡掉落 |
| 目标合法性 | 急救包可目标自己或同板块另一位探索者；不同板块拒绝；奇怪的药品和镜子只治疗持有者自身 | 目标合法性必须和 UI 高亮、目标选择、同房 / 同板块术语边界分开审计 | 不新增治疗目标 UI，不修改同板块判定 |
| 回合结束恢复 | 牙齿项链只在回合结束且存在当前濒死属性时提供选择，选择后继续结束回合 | 牙齿项链不是即时伤害减免，也不是即时死亡保护 | 不改回合流转或死亡保护顺序 |
| 组合消费者 | 治疗 / 恢复可能与死亡保护、房间回合末伤害、作祟状态、交易 / 已用限制相邻 | 当前只登记组合缺口，不外推为完整组合闭合 | 不新增组合领域测试，不跑 E2E / 截图 |

| 相邻桶 | 原因 |
| --- | --- |
| NB-01 事件伤害 / 死亡保护 / 减免组合 | 事件伤害后的濒死 / 死亡保护顺序会影响治疗或牙齿项链回合结束恢复 |
| NB-06 物品伤害减免 / 死亡保护 | 牙齿项链恢复、奇异护符 / 胸针 / 幸运硬币等伤害消费者需要分清即时保护、实际承受和回合结束恢复 |
| NB-10 物品移动 / 地图 / 门位墙体 | 急救包目标合法性与同板块 / 房间目标和未来 UI 高亮相邻；本节不处理地图或门位 |
| NB-12 预兆交易 / 持有物转移 / 已用牌限制 | 使用后的治疗物品不能交易，死亡掉落 / 搜尸后是否刷新可用状态需要单独登记 |
| NB-16 UI / E2E / 截图授权前置 | 治疗目标选择、属性恢复预览、回合结束选择 UI 和真实入口验证均需单独授权 |

NB-08 裁定：

1. 奇怪的药品、镜子、急救包和牙齿项链已按主动治疗、目标合法性、消耗终点、回合结束恢复和组合消费者五类登记；这只是合同边界，不等于治疗 UI 或组合测试完成。
2. 急救包已有真实页面同板块目标选择代表链，但只能证明一条代表 UI 路径，不证明所有目标 UI、死亡保护、交易限制或作祟组合闭合。
3. 牙齿项链只属于回合结束恢复，不属于即时伤害减免或即时死亡保护；后续若处理死亡保护顺序，必须重新点名伤害来源和回合结束来源。
4. 本节里的“镜子”是物品牌“镜子”，不得和事件牌“怪异的镜子”或 7 号作祟镜中怪物 / 镜中提示混用。
5. 后续若进入实现或测试，必须从“某一件治疗物品 + 一个目标 / 回合时点 + 一个验收入口”开始，不得按四张治疗物品或整物品牌批量开改。
6. 当前规范没有把 `blocked` 写成停工口令；本节继续证明 `downstream-blocked` 只拦完成宣称和下游 UI/E2E/截图，不拦合同层补证。
7. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.47 NB-10 领取结果：物品移动 / 地图 / 门位墙体桶（2026-07-29）

本节原领取 6.32 的 NB-10 时，只消费 6.13、6.17、6.27、6.32、`temp/betrayal-item-consumer-work-order-2026-07-29.json`、`temp/betrayal-full-deck-next-bucket-selector-2026-07-29.json`、`item-effect-implementation-audit-2026-07-29.md`、`src/games/betrayal/possessionEffects.ts`、`src/games/betrayal/game.ts`、`src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 和 `src/games/betrayal/__tests__/Board.foundation.test.tsx` 的只读证据；当时不修改地图移动 UI，不改房间 / 门位合法性，不改目标板块选择，不跑 E2E，不截图，不打开图片，不接入音频或资源。后续当前树已对骨制钥匙单点离开合同层，补真实页面穿墙移动 E2E 与 6 张截图代表链；结构化副本仍落在 `temp/betrayal-item-movement-map-bucket-2026-07-29.json`。

| 物品 / 节点 | 已锁合同边界 | 当前证据状态 | 未闭合原因 | 下步最小解阻动作 |
| --- | --- | --- | --- | --- |
| 地图 | 主动埋葬后把当前探索者放置到任一已发现板块；不能放置到未发现板块；`notebook / journal / manuscript` 是 legacy alias / duplicate-alias，不计官方 22 张独立物品 | `covered-by-existing-contract / duplicate-alias-guarded / partial-ui` | 已有主动 `placeExplorer` 配置、已发现板块领域代表链和页面代表链；未证明所有目标 UI、跨楼层显示、非法原因展示、作祟地图限制或新增移动消费者 | 若进入下游，点名当前探索者所在房间、目标已发现板块、目标楼层、非法目标和 UI / 领域验收范围 |
| 骨制钥匙 | 可穿过一格同层相邻墙体移动到已发现板块；不能作为主动移动加成；不能发现新房间；使用后按投骰 / 当前链路处理埋葬边界 | `L3 representative / partial-combo` | 当前树已补穿墙到已发现相邻板块、不能发现新房间、不会作为普通主动移动加成、页面移动模式代表链、点击结算和回到默认牌桌；未证明墙体 / 门位 / 同层 / 相邻限制全组合、作祟地图规则、特殊移动限制或埋葬随机分支 | 后续扩审必须点名起点房间、目标房间、墙体 / 门位状态、是否同层、是否已发现、作祟地图限制是否适用，以及投骰是否进入埋葬分支 |
| 急救包 | 主动埋葬后治疗自己所有濒死属性，或治疗同板块另一位探索者；不同板块目标被拒绝。本桶只作为同板块 / 同房目标语义相邻证据，不重新打开治疗桶 | `covered-by-NB-08 / adjacency-only / partial-ui` | 治疗效果、死亡保护、回合时点和治疗 UI 已归 6.46；本桶只登记同板块 / 同房目标与地图目标读模型相邻 | 若后续处理同板块 UI / 房间目标统一读模型，引用 NB-08 目标合法性并点名目标玩家和房间 id |
| 炸药 | 作为代替攻击使用，选择当前或相邻已发现板块作为目标；目标板块内探索者 / 怪物分别速度检定；使用后埋葬并记为本回合已攻击 | `min-domain-verified / min-ui-representative / map-target-adjacent / partial-combo` | 已有当前 / 相邻已发现板块目标、使用后埋葬、探索者失败伤害和怪物受伤代表链；当前树已补 Board 页面组件目标态代表链；未证明真实 Playwright / 截图链、非法原因展示、更多怪物 / 作祟组合、特殊免疫和墙体 / 门位相邻边界 | 若进入下游，点名攻击者、目标板块、当前 / 相邻关系、已发现状态、目标内探索者 / 怪物集合和 UI / 领域验收范围 |

| 共享机制 | 当前证据 | 合同层只登记的边界 | 未授权前仍禁止 |
| --- | --- | --- | --- |
| 已发现房间 / 板块 | 地图、骨制钥匙、炸药均有“不能指向未发现板块”的代表证据；急救包消费同板块真相 | 只登记目标合法性必须消费已发现 / 同板块状态；不证明所有 UI 高亮、非法原因或跨楼层显示闭合 | 不改房间状态真相，不改 UI |
| 任意已发现房间放置 | 地图类 `placeExplorer` 允许当前探索者放置到任意已发现板块 | 地图放置不同于普通移动门位直连；当前只能证明代表链 | 不新增地图目标 UI 或作祟地图规则 |
| 穿墙到已发现相邻板块 | 骨制钥匙可穿过墙体到已发现相邻板块，且不能探索未知房间；当前树已补真实页面目标高亮、点击结算和移动模式收口代表链 | 只证明骨制钥匙相对普通移动的一个页面代表链；墙体、门位、同层、相邻、埋葬随机分支和作祟限制组合仍未闭合 | 不把代表链外推为完整空间规则完成 |
| 同板块 / 同房目标 | 急救包同板块治疗目标和地图 / 房间目标共享房间真相 | 急救包治疗仍归 NB-08，本桶只作为空间语义相邻索引 | 不改治疗逻辑或目标 UI |
| 当前 / 相邻已发现板块目标 | 炸药目标是板块而不是单个攻击目标，当前或相邻且已发现是最低合法性；当前树 Board 组件目标态已消费该真相 | 炸药同时属于 NB-07 武器攻击和 NB-10 地图目标节点；不能只归普通武器 | 不把组件代表链外推为真实 Playwright / 截图、非法原因、怪物 / 作祟组合或完整空间规则 |
| 门位 / 墙体 / 作祟地图规则缺口 | 普通移动、骨制钥匙、怪物移动、作祟地图限制和炸药相邻目标会共享空间规则 | 当前只登记缺口，不新增任何作祟地图或空间规则 | 不进入完整地图 / 作祟实现 |

| 相邻桶 | 原因 |
| --- | --- |
| NB-02 事件目标候选 / 房间合法性 | 事件放置、楼层 / 区域 / 已发现限制与地图 / 房间目标读模型共享 |
| NB-07 物品武器攻击 / 多武器互斥 / 交易限制 | 炸药同时是代替攻击节点和目标板块节点 |
| NB-08 物品治疗 / 属性恢复 / 同房目标 | 急救包同板块目标合法性已在治疗桶登记，本桶只引用其空间语义 |
| NB-15 7 号作祟破咒 / 镜中提示 / 镜中怪物移动攻击 | 作祟怪物移动和目标选择也消费已发现房间、相邻、路径和平手裁定 |
| NB-16 UI / E2E / 截图授权前置 | 骨制钥匙穿墙移动 UI 已补代表链；地图目标、炸药目标板块、急救包更多目标组合和骨制钥匙空间组合仍需要后续单独授权 |

NB-10 裁定：

1. 地图、骨制钥匙、急救包和炸药已按已发现房间 / 板块、任意已发现房间放置、穿墙到已发现相邻板块、同板块 / 同房目标、当前 / 相邻已发现板块目标和门位 / 墙体 / 作祟地图规则缺口六类登记；骨制钥匙穿墙移动真实入口代表链和炸药目标板块 Board 组件代表链已补，但这不等于地图目标 UI、炸药真实 Playwright / 截图链、非法原因展示或空间组合测试完成。
2. 地图的 `notebook / journal / manuscript` 仍是 legacy alias / duplicate-alias 口径，不计官方 22 张独立物品；本桶不重新打开物品数量或 atlas 导入问题。
3. 骨制钥匙不是普通主动移动加成；后续若处理它，必须以墙体 / 门位 / 同层 / 已发现状态和作祟地图限制为前提，不得泛化成“移动 +1”。
4. 急救包在本桶只作为同板块 / 同房目标语义相邻对象；治疗效果和死亡保护组合仍以 6.46 的 NB-08 为准。
5. 炸药既是代替攻击节点也是目标板块节点；后续若处理 UI 或测试，必须同时点名攻击来源、目标板块、目标集合和相邻 / 已发现合法性。
6. 当前规范没有把 `blocked` 写成停工口令；本节继续证明 `downstream-blocked` 只拦完成宣称和下游 UI/E2E/截图，不拦合同层补证。
7. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.48 NB-11 领取结果：预兆属性检定加值 / 非战斗检定替代桶（2026-07-29）

本节领取 6.32 的 NB-11，只消费 5、5.1、6.14、6.28、6.32、`temp/betrayal-omen-haunt-work-order-2026-07-29.json`、`temp/betrayal-full-deck-next-bucket-selector-2026-07-29.json`、`evidence/betrayal/full-audit/omen-and-haunt-rule-implementation-audit-2026-07-29.md`、`src/games/betrayal/possessionEffects.ts`、`src/games/betrayal/game.ts`、`src/games/betrayal/scenarioConfig.ts`、`src/games/betrayal/possessionAtlas.ts`、`src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 和 `src/games/betrayal/__tests__/Board.foundation.test.tsx` 的只读证据；不改检定替代逻辑，不改被动属性加值逻辑，不补 UI 数字 / 按钮，不补组合测试，不跑 E2E，不截图，不打开图片，不接入音频或资源。结构化副本落在 `temp/betrayal-omen-trait-roll-bucket-2026-07-29.json`。

| 预兆 / 节点 | 已锁合同边界 | 当前证据状态 | 未闭合原因 | 下步最小解阻动作 |
| --- | --- | --- | --- | --- |
| 书本 | 知识检定 +1；每回合一次花 1 神志，让下一次非战斗检定可用知识替代；该替代状态不得被战斗攻击消费；神志临界时不得免费使用 | `L1/L2 + Board component representative / partial-ui / non-combat-replacement-indexed` | 已有事件非战斗检定、灰尘寻找解药、临界神志成本拒绝、使用后禁用和神志不足提示代表链；未证明真实 Playwright / 截图、更多非战斗检定、房间检定、作祟特殊行动检定和重掷 / 替代消费者组合 | 点名书本、具体非战斗检定来源、当前神志轨位、预期替代属性、是否需要真实页面 / 截图和验收入口 |
| 狗 | 速度检定 +1；狗交易另归 NB-12，本桶只登记速度加值消费者和交易后风险读模型相邻关系 | `min-domain-verified / transfer-adjacent / partial-ui` | 已有倒塌房间速度检定 +1、灰尘治愈灰尘被动加值和狗交易代表链；未证明交易 UI、距离显示、交易候选、死亡 / 作祟状态限制和更多速度检定组合 | 若处理速度加值，点名具体速度检定来源、当前狗持有者、骰值、被动加值和 UI / 日志验收；若处理交易，回到 NB-12 |
| 面具 | 速度检定 +1；每回合一次移动同房其他探索者和怪物的主动能力另归移动 / 空间消费者，本桶只登记速度加值 | `min-domain-verified / Board component representative / movement-adjacent / partial-ui` | 已有倒塌房间速度检定 +1、灰尘治愈灰尘被动加值和面具主动移动 Board 组件代表链；未证明真实 Playwright / 截图链、死亡目标过滤、怪物回合、作祟怪物组合和更多速度检定组合 | 若处理速度加值，点名速度检定来源；若处理移动能力，点名同房目标、相邻已发现房间和移动 UI / 领域验收范围 |
| 头骨 | 知识检定 +1；死亡前 3 骰 4+ 阻止死亡的死亡保护另归 NB-01 / NB-06，本桶只登记知识加值与死亡保护相邻关系 | `min-domain-verified / Board component representative / death-protection-adjacent / partial-ui` | 已有灰尘治愈灰尘知识加值和死亡保护 Board 组件代表链；未证明更多致死来源、作祟终局、遗物掩埋、真实 Playwright / 截图链，以及知识加值与更多非战斗消费者组合 | 若处理知识加值，点名具体知识检定来源；若处理死亡保护，回到 NB-01 / NB-06 点名致死来源和死亡保护验收 |
| 圣符 | 神志检定 +1；探索时埋葬第一张板块并继续探索的能力另归探索 / 房间 / 作祟桶，本桶只登记神志加值 | `min-domain-verified / Board component representative / discovery-adjacent / partial-ui` | 已有驱魔神志检定 +1、灰尘治愈灰尘加值、圣符探索埋葬领域链，以及探索声明 / 刚获得限制 Board 组件代表链；未证明真实 Playwright / 截图、更多房间 / 事件 / 作祟探索消费者、牌堆顺序和更多神志检定组合 | 若处理神志加值，点名神志检定来源；若处理探索埋葬，点名房间牌、牌堆顺序、刚获得状态和 UI / 领域验收范围 |
| 盔甲 | 不属于属性检定加值预兆；作为防具受到物理伤害 -1，不阻挡通用伤害或直接属性降低 | `out-of-bucket-guard / covered-by-NB-06 / Board component representative / partial-ui` | 已有物理伤害减免、直接力量降低不被挡、无主动 / 非武器入口和伤害分配页减伤提示代表链；本桶只用于排除盔甲误入属性加值管线 | 若处理盔甲，回到 NB-06 点名更多物理伤害来源、减伤顺序、死亡保护和真实截图验收；不要从 NB-11 开属性加值实现 |
| 雕像 | 力量检定 +1；发现事件符号房间时可选择不抽事件另归探索 / 事件桶，本桶只登记力量加值 | `min-domain-verified / Board component representative / event-skip-adjacent / partial-ui` | 已有灰尘治愈灰尘力量加值、事件符号房间跳过事件、入口矩阵代表链，以及探索声明 / 刚获得限制 Board 组件代表链；未证明真实 Playwright / 截图、更多事件牌堆顺序、作祟探索、无事件符号拒绝 UI 和更多力量检定组合 | 若处理力量加值，点名力量检定来源；若处理跳过事件，点名房间符号、是否作祟、事件牌堆和 UI / 领域验收范围 |
| 指环 | 神志检定 +1；攻击时必须显式选择，双方改用神志对攻并造成精神伤害。攻击武器语义与普通神志加值必须隔离 | `min-domain-verified / weapon-adjacent / partial-ui` | 已有驱魔神志检定 +1、灰尘治愈灰尘加值、显式神志攻击和未声明不自动生效代表链；未证明攻击 UI、怪物目标、多武器互斥、作祟攻击和更多神志检定组合 | 若处理神志加值，点名非攻击神志检定来源；若处理攻击武器，回到 NB-07 / NB-15 点名攻击目标、武器声明和精神伤害验收 |

| 共享机制 | 当前证据 | 合同层只登记的边界 | 未授权前仍禁止 |
| --- | --- | --- | --- |
| 属性检定被动加值消费者 | 书本 / 头骨为知识 +1，狗 / 面具为速度 +1，圣符 / 指环为神志 +1，雕像为力量 +1；盔甲不是属性检定加值消费者 | 只登记被动加值需要按检定来源准入；代表链不等于所有事件、房间、作祟特殊行动、攻击或 UI 完成 | 不改属性骰计算或 UI 展示 |
| 书本非战斗检定替代 | 书本主动使用后花 1 神志，下一次非战斗属性检定可用知识替代原属性骰数；消费后清空，战斗攻击不得消费；神志临界时校验拒绝 | 已补事件 / 灰尘代表链、临界成本负向断言、使用后禁用和神志不足提示组件代表链；更多非战斗来源和组合消费者仍未闭合 | 不把组件代表链外推为真实 Playwright / 截图或全部消费者完成 |
| 固定骰与事件骰排除 | 固定骰、纯事件骰和非属性检定不得自动消费属性加值或书本替代；每个新增消费者需要按来源单独准入 | 神秘液体、无线电广播等固定骰 / 事件骰仍以 NB-04 / NB-05 边界为准 | 不把固定骰当属性检定；不让固定骰消费书本 |
| 战斗检定隔离 | 普通攻击、武器攻击和作祟怪物攻击需要与非战斗属性检定隔离；指环是显式攻击武器，书本替代不得误消费到攻击 | 只登记隔离边界；攻击 UI、怪物目标、多武器互斥和作祟攻击仍归攻击 / 作祟桶 | 不改攻击命令、武器声明或精神伤害结算 |
| 濒死神志成本 | 书本花费神志时若持有者神志已接近临界，必须拒绝免费使用并提示成本不足；不应写入 `nextNonCombatTraitReplacement` 或记录本回合已用 | 已补领域成本门禁和 Board 组件提示代表链；死亡保护组合、真实 Playwright / 截图和更多检定消费者仍未闭合 | 不把神志不足负向链外推为全部支付 / 死亡保护组合完成 |
| 作祟公共规则隔离 | 抽预兆后的作祟检定骰数、5+、8 骰上限和最后一张自动作祟仍归公共作祟规则 | 作祟检定不能并入任一张预兆自身效果 | 不改作祟公共流程或作祟 UI |

| 相邻桶 | 原因 |
| --- | --- |
| NB-04 事件投骰 / 属性 / 重掷消费者 | 事件属性检定、固定事件骰、祝福额外骰和重掷消费者需要和预兆被动加值 / 书本替代逐项准入 |
| NB-09 物品重掷 / 替代数值 / 属性检定消费者 | 恐怖玩偶、幸运硬币、兔脚、天使之羽、手电筒、魔法相机会与预兆加值和书本替代在同一投骰消费者链相遇 |
| NB-12 预兆交易 / 持有物转移 / 已用牌限制 | 狗交易、书本已用状态和预兆交易后的作祟风险读模型需要分层处理 |
| NB-13 作祟风险 / 8 骰上限 / 最后一张自动作祟 | 作祟公共检定不应被预兆逐卡加值桶吞并；风险 UI 和骰盘仍归公共规则桶 |
| NB-15 7 号作祟破咒 / 镜中提示 / 镜中怪物移动攻击 | 驱魔、破咒、镜中怪物攻击等作祟特殊行动会消费神志 / 属性检定和攻击隔离边界 |
| NB-16 UI / E2E / 截图授权前置 | 属性加值展示、书本使用按钮、替代状态提示、战斗排除说明和组合验证都需要后续单独授权 |

NB-11 裁定：

1. 书本、狗、面具、头骨、圣符、雕像和指环已按属性检定被动加值、书本非战斗替代、固定骰 / 战斗排除、临界神志成本门禁和作祟公共规则隔离登记；书本、面具、头骨、圣符、雕像另有 Board 组件代表链，但这仍不等于属性检定、真实 UI、截图或组合测试完成。
2. 盔甲被明确排除在属性检定加值消费者之外；它仍属于物理伤害减免 / 死亡保护相邻桶，不能从 NB-11 误接到属性加值管线。
3. 指环同时有神志检定 +1 和显式攻击武器语义；后续处理时必须先分清“非攻击神志检定”还是“攻击武器神志对攻”，不得互相替代。
4. 书本的替代只限非战斗检定；固定事件骰、作祟公共检定和攻击投骰不得自动消费书本替代；神志不足时不得免费写入替代状态。
5. 作祟检定继续保持公共规则账本：全员当前持有预兆数、5+、8 骰上限和最后一张自动作祟不属于任一张预兆的逐卡效果。
6. 当前规范没有把 `blocked` 写成停工口令；本节继续证明 `downstream-blocked` 只拦完成宣称和下游 UI/E2E/截图，不拦合同层补证。
7. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.49 NB 工作桶覆盖闭环审计（2026-07-29）

本节只对 6.32 的 16 个 NB 合同层入口做覆盖闭环审计：确认每个 NB 都已有主合同段落、结构化副本和状态文件记录。审计脚本采用 PowerShell 兼容 Node 读取当前文件、选择器和状态文件；结构化副本落在 `temp/betrayal-full-deck-nb-bucket-coverage-audit-2026-07-29.json`。本节不改运行代码，不补 Board/UI，不跑 E2E，不截图，不打开图片，不接入音频，不压缩或上传资源。

| 覆盖项 | 审计结果 |
| --- | --- |
| 选择器候选 | 16 / 16：`temp/betrayal-full-deck-next-bucket-selector-2026-07-29.json` 中 NB-01 到 NB-16 均存在 |
| 主合同段落 | 16 / 16：6.33 到 6.48 已覆盖全部 NB 合同桶 |
| 结构化副本 | 16 / 16：`temp/betrayal-*bucket-2026-07-29.json` 里每个 NB 均有对应 canonical 文件 |
| 状态文件记录 | 16 / 16：`temp/betrayal-full-deck-task-state.json` 的 acceptance / notes 已覆盖 NB-01 到 NB-16 |
| 缺失项 | 0：本轮未发现缺合同段、缺结构化副本或缺状态记录的 NB 桶 |
| 阶段状态 | 继续保持 `in_progress / downstream-blocked`，只证明合同层入口齐备，不证明下游完成 |

| NB 桶 | 主合同段 | canonical 结构化副本 | 本节裁定 |
| --- | --- | --- | --- |
| NB-01 事件伤害 / 死亡保护 / 减免组合 | 6.33 | `temp/betrayal-event-damage-consumer-bucket-2026-07-29.json` | `contract-covered` |
| NB-02 事件目标候选 / 房间合法性 | 6.41 | `temp/betrayal-event-target-candidate-bucket-2026-07-29.json` | `contract-covered` |
| NB-03 事件物品 / 牌堆 / 持有物选择 | 6.42 | `temp/betrayal-event-possession-deck-bucket-2026-07-29.json` | `contract-covered` |
| NB-04 事件投骰 / 属性 / 重掷消费者 | 6.43 | `temp/betrayal-event-roll-trait-reroll-bucket-2026-07-29.json` | `contract-covered` |
| NB-05 事件作祟特例 / 展示音频 | 6.44 | `temp/betrayal-event-haunt-audio-special-bucket-2026-07-29.json` | `contract-covered` |
| NB-06 物品伤害减免 / 伤害改写 / 死亡保护 | 6.34 | `temp/betrayal-item-damage-death-bucket-2026-07-29.json` | `contract-covered` |
| NB-07 物品武器攻击 / 多武器互斥 / 交易限制 | 6.45 | `temp/betrayal-item-weapon-attack-trade-bucket-2026-07-29.json` | `contract-covered` |
| NB-08 物品治疗 / 属性恢复 / 同房目标 | 6.46 | `temp/betrayal-item-healing-target-bucket-2026-07-29.json` | `contract-covered` |
| NB-09 物品重掷 / 替代数值 / 属性检定消费者 | 6.35 | `temp/betrayal-item-roll-consumer-bucket-2026-07-29.json` | `contract-covered` |
| NB-10 物品移动 / 地图 / 门位墙体 | 6.47 | `temp/betrayal-item-movement-map-bucket-2026-07-29.json` | `contract-covered` |
| NB-11 预兆属性检定加值 / 非战斗检定替代 | 6.48 | `temp/betrayal-omen-trait-roll-bucket-2026-07-29.json` | `contract-covered` |
| NB-12 预兆交易 / 持有物转移 / 已用牌限制 | 6.40 | `temp/betrayal-omen-transfer-risk-bucket-2026-07-29.json` | `contract-covered` |
| NB-13 作祟风险 / 8 骰上限 / 最后一张自动作祟 | 6.36 | `temp/betrayal-public-haunt-risk-bucket-2026-07-29.json` | `contract-covered` |
| NB-14 7 号作祟公开 / 私密可见性与 setup | 6.37 | `temp/betrayal-haunt07-visibility-setup-bucket-2026-07-29.json` | `contract-covered` |
| NB-15 7 号作祟破咒 / 镜中提示 / 镜中怪物移动攻击 | 6.39 | `temp/betrayal-haunt07-action-monster-bucket-2026-07-29.json` | `contract-covered` |
| NB-16 UI / E2E / 截图 / 脚注音频授权前置 | 6.38 | `temp/betrayal-ui-e2e-asset-preflight-bucket-2026-07-29.json` | `contract-covered` |

6.49 裁定：

1. NB-01 到 NB-16 已完成“合同段落 + 结构化副本 + 状态文件记录”的覆盖闭环；下一轮不应再因“NB 桶未领取”而重复拆同一批入口。
2. 这只证明下一对象 / 缺口桶账本齐备，不证明任何事件、物品、预兆、公共作祟或 7 号作祟的下游机制、UI、E2E、截图、音频或资源链完成。
3. 若后续进入实现、UI、E2E、截图、音频或资源动作，必须重新选择一个具体 NB 桶中的具体对象 / 规则节点，并重新锁定问题对象、真相来源、目标入口和验收口径。
4. 当前规范没有问题：`blocked / downstream-blocked` 仍是阶段升级和完成宣称门禁，不是合同层停工理由。
5. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.50 下游重锁清单 / 交接门（2026-07-29）

本节接在 6.49 之后，只把“从合同层进入下游前必须重新锁定什么”写成交接门。结构化副本落在 `temp/betrayal-full-deck-downstream-relock-gate-2026-07-29.json`。本节不实现卡牌效果，不改 Board/UI，不跑 E2E，不截图，不打开图片，不接入音频，不压缩或上传资源。

| 当前事实 | 裁定 |
| --- | --- |
| S0 对象全集 | 74 张对象已经进入同一主合同：事件 43 / 物品 22 / 预兆 9；图包 / atlas / frame / alias / 运行池差异已闭合到合同层 |
| NB 桶覆盖 | 6.49 已确认 NB-01 到 NB-16 都有合同段落、canonical 结构化副本和状态文件记录 |
| 当前状态 | `in_progress / downstream-blocked`；这是完成宣称和阶段升级门禁，不是合同层停工口令 |
| 是否需要用户补图包 | 当前不需要；只有具体单卡不可读、frame/hash 对不上、原文冲突或用户改指定权威来源时，才请求最小补源 |
| 本节作用 | 给下一阶段重新锁定对象、真相源、入口和验收口径；不能被当作实现、UI、E2E、截图或资源完成证据 |

| 后续动作类型 | 允许的合同层动作 | 离开合同层前必须重新锁定 | 未授权前禁止 |
| --- | --- | --- | --- |
| 继续合同层补证 | 维护缺口桶、证据边界、旧口径降级、状态文件和结构化副本 | 具体 NB 桶、引用的主合同段落、只读证据文件、输出落点 | 不得改运行逻辑、Board/UI、测试或资源 |
| 单卡机制 / 领域测试 | 只登记某张牌的消费者边界、组合缺口、最小解阻动作 | 具体牌名、具体规则子句、图包/合同真相源、目标代码入口、最小领域验收 | 不得按整类牌批量实现，不得用代表链宣称整类完成 |
| 公共作祟规则 | 只维护全员预兆数、8 骰上限、最后一张自动作祟等公共规则边界 | 具体公共规则节点、规则来源、运行入口、骰数 / 触发 / 翻牌验收 | 不得并入任一张预兆自身效果，不得直接补作祟 UI |
| 7 号作祟 | 只维护秘密组合、setup、破咒、镜中提示、镜中怪物移动 / 攻击的子账本边界 | 具体 7 号节点、公开 / 私密可见性、目标入口、领域或 UI 验收范围 | 不得宣称完整 7 号作祟完成，不得补专属 UI / E2E / 截图 |
| Board/UI | 可登记未来承接对象、按钮、状态真相、非法原因和旧截图降级边界 | 具体页面入口、交互载体、状态来源、验收方式、是否允许截图 | 未授权前不得改 Board/UI、不得跑截图或打开图片 |
| E2E / 截图 | 可登记旧 E2E / 旧截图能证明什么、不能证明什么 | 具体真实入口、测试命令、场景状态、目标截图或断言范围 | 未授权前不得运行 E2E、不得生成或打开截图 |
| 音频 / 资源链 | 可登记无线电广播脚注或未来音频资源准入条件 | 具体资源文件、来源授权、导入路径、hash / manifest、运行消费入口 | 未授权前不得接入音频、压缩、上传或远端回查 |

| 下游组 | 覆盖桶 | 重新锁定最小包 |
| --- | --- | --- |
| 事件机制组 | NB-01 到 NB-05 | 一张事件牌 + 一个规则分支 + 该分支消费者 + 一个领域验收入口 |
| 物品机制组 | NB-06 到 NB-10 | 一张物品牌 + 一个使用 / 被动 / 伤害 / 攻击 / 移动消费者 + 一个验收入口 |
| 预兆 / 公共作祟组 | NB-11 到 NB-13 | 一张预兆或一个公共作祟规则节点 + 触发时点 + 骰数 / 风险 / 转移验收 |
| 7 号作祟组 | NB-14 到 NB-15 | 一个 7 号作祟节点 + 玩家视角 / 私密性 + 领域或 UI 验收范围 |
| UI / E2E / 资源组 | NB-16 | 一个真实页面入口或资源节点 + 允许动作 + 验收产物 |

真正需要用户补充的情况只剩四类：

1. 某张牌的本地图包 / 完整裁图不可读，无法锁定规则子句或卡名。
2. 项目 atlas、原始 Mods/Images 图包、manifest 或合同记录出现 frame / hash / 名称冲突。
3. 当前合同里已登记为 `blocked / disputed / unknown-slot / duplicate-alias` 的具体字段，需要用户裁定权威口径。
4. 用户当轮改变真相源，例如要求不用本地图包而改用另一份官方图、规则书或翻译来源。

6.50 裁定：

1. 当前不是图包缺素材，也不是项目导入错；下一步不需要用户重新提供整包图片。
2. 合同层可以继续维护缺口桶和证据边界，但 6.49 之后不应再重复领取 NB-01 到 NB-16。
3. 若进入实现、UI、E2E、截图、音频或资源动作，必须先从上表选择一个具体下游组，并重新锁定具体对象、真相来源、目标入口和验收口径。
4. `downstream-blocked` 继续只拦完成宣称和阶段升级，不拦合同层继续推进。
5. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.51 下游重锁覆盖审计（2026-07-29）

本节只审计 6.50 的下游重锁清单是否完整覆盖 6.49 已确认的 NB-01 到 NB-16。结构化副本落在 `temp/betrayal-full-deck-downstream-relock-coverage-audit-2026-07-29.json`。本节不实现卡牌效果，不改 Board/UI，不跑 E2E，不截图，不打开图片，不接入音频，不压缩或上传资源。

| 审计项 | 结果 |
| --- | --- |
| canonical NB 桶 | 16 / 16：来自 6.49 覆盖审计，NB-01 到 NB-16 均已有合同段落、结构化副本和状态文件记录 |
| 下游重锁矩阵覆盖 | 16 / 16：6.50 的 `downstreamRelockMatrix` 覆盖 NB-01 到 NB-16 |
| 下游组覆盖 | 5 / 5：事件机制组、物品机制组、预兆 / 公共作祟组、7 号作祟组、UI / E2E / 资源组均映射到已覆盖 NB 桶 |
| 多余桶 | 0：6.50 未出现 NB-01 到 NB-16 之外的下游桶 |
| 未映射桶 | 0：6.49 的 canonical NB 桶均被 6.50 下游重锁矩阵覆盖 |
| 阶段状态 | `pass-contract-only`：只证明交接门覆盖完整，不证明下游完成 |

| 下游组 | 映射 NB 桶 | 覆盖裁定 |
| --- | --- | --- |
| 事件机制组 | NB-01、NB-02、NB-03、NB-04、NB-05 | `mapped-to-covered-nb-buckets` |
| 物品机制组 | NB-06、NB-07、NB-08、NB-09、NB-10 | `mapped-to-covered-nb-buckets` |
| 预兆 / 公共作祟组 | NB-11、NB-12、NB-13 | `mapped-to-covered-nb-buckets` |
| 7 号作祟组 | NB-14、NB-15 | `mapped-to-covered-nb-buckets` |
| UI / E2E / 资源组 | NB-16 | `mapped-to-covered-nb-buckets` |

6.51 裁定：

1. 6.50 的下游重锁清单覆盖了 6.49 的全部 NB 桶，没有漏桶或多余桶。
2. 下一轮若仍是合同层续跑，不应重新领取 NB 桶，也不应要求用户补整包图集；只能维护具体缺口桶、证据边界、旧证据降级和重锁清单。
3. 若下一轮进入下游阶段，必须从五个下游组中选一个，并进一步点名具体牌、规则节点、目标入口和验收口径。
4. 本节不证明任何事件、物品、预兆、公共作祟、7 号作祟、Board/UI、E2E、截图、音频或资源链完成。
5. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.52 下一阶段候选授权包（2026-07-29）

本节把 6.50/6.51 的重锁规则转成可领取的最小授权包。结构化副本落在 `temp/betrayal-full-deck-next-authorization-packets-2026-07-29.json`。本节不实现卡牌效果，不改 Board/UI，不跑 E2E，不截图，不打开图片，不接入音频，不压缩或上传资源。

| 授权包 | 下游组 | 候选对象 / 节点 | 离开合同层前最小重锁包 | 未授权前仍禁止 |
| --- | --- | --- | --- | --- |
| AUTH-EVENT-01 | 事件机制组 | 地狱蝙蝠、花团锦簇、轮到约拿了、神秘液体、怪异的镜子、无线电广播 | 一张事件牌 + 一个规则分支 + 一个消费者边界 + 一个目标入口 + 一个验收口径 | 新增事件实现、批量补 43 张事件、Board/UI、E2E、截图、音频接入 |
| AUTH-ITEM-01 | 物品机制组 | 幸运硬币、炸药、奇异护符、恐怖玩偶、地图、骨制钥匙、急救包 | 一张物品牌 + 一个使用 / 被动 / 伤害 / 攻击 / 移动消费者 + 一个组合对象或状态前提 + 一个目标入口 + 一个验收口径 | 新增物品实现、批量补 22 张物品、Board/UI、E2E、截图、资源上传 |
| AUTH-OMEN-HAUNT-01 | 预兆 / 公共作祟组 | 书本、狗、指环、全员当前持有预兆总数、最后一张预兆自动作祟 | 一张预兆或一个公共作祟规则节点 + 一个触发时点 + 一个骰数 / 风险 / 转移状态 + 一个目标入口 + 一个验收口径 | 把公共作祟并入单张预兆、改作祟公共流程、Board/UI、E2E、截图 |
| AUTH-HAUNT07-01 | 7 号作祟组 | 秘密组合、setup manual-check、破咒特殊行动、镜中提示、镜中怪物移动、镜中怪物攻击 | 一个 7 号作祟节点 + 一个玩家视角 / 私密性要求 + 一个目标入口 + 一个领域或 UI 验收范围 | 宣称完整 7 号作祟完成、专属 UI、E2E、截图、图片打开 |
| AUTH-UI-E2E-ASSET-01 | UI / E2E / 资源组 | 发现牌 UI 承接、作祟风险 UI、7 号作祟私密 UI、无线电广播脚注展示 / 音频资源、真实入口 E2E / 截图 | 一个真实页面入口或资源节点 + 一个允许动作 + 一个状态来源 + 一个验收产物 | 改 Board/UI、运行 E2E、截图、打开图片、接入音频、压缩或上传资源 |

6.52 裁定：

1. 当前若用户只说“继续”，默认仍留在合同层，只维护授权包、证据边界、旧证据降级和重锁前置。
2. 下一步不是让用户补整包图集；整包图集和 atlas 数量已经在 S0 合同层闭合。
3. 若用户要离开合同层，应直接点名或授权上述一个授权包；随后再按该包重新锁定具体对象、真相来源、目标入口和验收口径。
4. 任何单个授权包都不能证明整牌库完成；它只允许推进一个具体对象或规则节点。
5. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.53 授权包覆盖审计（2026-07-29）

本节只审计 6.52 的五个候选授权包是否完整覆盖 6.50/6.51 的五个下游组和 NB 桶。结构化副本落在 `temp/betrayal-full-deck-authorization-packet-coverage-audit-2026-07-29.json`。本节不实现卡牌效果，不改 Board/UI，不跑 E2E，不截图，不打开图片，不接入音频，不压缩或上传资源。

| 审计项 | 结果 |
| --- | --- |
| 预期下游组 | 5：事件机制组、物品机制组、预兆 / 公共作祟组、7 号作祟组、UI / E2E / 资源组 |
| 授权包数量 | 5 / 5：`AUTH-EVENT-01`、`AUTH-ITEM-01`、`AUTH-OMEN-HAUNT-01`、`AUTH-HAUNT07-01`、`AUTH-UI-E2E-ASSET-01` |
| 重复授权包 | 0 |
| 缺失下游组 | 0 |
| 多余下游组 | 0 |
| 包内多余 NB 桶 | 0 |
| 未映射 canonical NB 桶 | 0 |
| 阶段状态 | `pass-contract-only`：只证明授权包交接结构完整，不证明下游完成 |

| 授权包 | 下游组 | NB 桶 | 覆盖裁定 |
| --- | --- | --- | --- |
| AUTH-EVENT-01 | 事件机制组 | NB-01、NB-02、NB-03、NB-04、NB-05 | `mapped-to-covered-group-and-nb-buckets` |
| AUTH-ITEM-01 | 物品机制组 | NB-06、NB-07、NB-08、NB-09、NB-10 | `mapped-to-covered-group-and-nb-buckets` |
| AUTH-OMEN-HAUNT-01 | 预兆 / 公共作祟组 | NB-11、NB-12、NB-13 | `mapped-to-covered-group-and-nb-buckets` |
| AUTH-HAUNT07-01 | 7 号作祟组 | NB-14、NB-15 | `mapped-to-covered-group-and-nb-buckets` |
| AUTH-UI-E2E-ASSET-01 | UI / E2E / 资源组 | NB-16 | `mapped-to-covered-group-and-nb-buckets` |

6.53 裁定：

1. 6.52 的五个候选授权包覆盖 6.50/6.51 的五个下游组，没有漏组、多余组、重复包或未映射 NB 桶。
2. 用户只说“继续”时，默认动作仍是合同层维护：证据边界、旧证据降级、重锁前置和交接文件；不是自动进入任一授权包。
3. 若后续用户选择某个授权包，该授权包仍只允许推进一个具体对象或规则节点；不得据此批量实现整组或宣称整牌库完成。
4. 本节不证明任何事件、物品、预兆、公共作祟、7 号作祟、Board/UI、E2E、截图、音频或资源链完成。
5. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`。

### 6.54 状态词澄清 / 规范回查裁定（2026-07-29）

本节回答“为什么 blocked 不能继续、现在规范是否有问题”。结构化副本落在 `temp/betrayal-full-deck-status-term-clarification-2026-07-29.json`。本节不实现卡牌效果，不改 Board/UI，不跑 E2E，不截图，不打开图片，不接入音频，不压缩或上传资源。

| 项目 | 裁定 |
| --- | --- |
| 现实状态 | S0 对象全集、图包数量、atlas/hash 和 74 张合同账本已经闭合；下游机制、UI、组合测试、完整作祟、E2E 和截图仍未闭合 |
| 是否真的不能继续 | 不是。合同层和已授权的 S1/S2 补证可以继续；不能继续的是“宣称整牌库完成”或“未重新锁定就进入 Board/UI/E2E/截图/音频/资源链” |
| 规范是否有问题 | 全局规范和项目录入规范当前没有把 `blocked` 写成停工口令；它们已明确 `blocked` 只是阶段升级和完成宣称门禁 |
| 当前合同表达风险 | 历史旧词 `downstream-blocked` 容易被误读成“停止执行”；后续对用户汇报统一说 `downstream-gated / 下游门禁中` |
| 是否需要用户补整包图集 | 当前不需要。只有具体单卡不可读、frame/hash 对不上、原文冲突，或用户改变主真相源时，才请求最小补源 |
| 下一步可做 | 继续维护缺口桶、证据边界、旧证据降级、授权包字段和状态说明；若要离开合同层，先选一个授权包并重锁具体对象、真相来源、目标入口和验收口径 |

6.54 裁定：

1. 如果之前把 `downstream-blocked` 理解成“不能继续”，那是状态词解释错误，不是素材缺失，也不是项目正式 atlas 导入错误；后续当前状态优先写 `downstream-gated`。
2. 当前规范无需上升修改到全局 AGENTS 或全局 skill；现有规范已足够，当前任务合同只补充人话别名：`downstream-gated / 下游完成门禁`。
3. 后续回复用户时，不得只说“blocked”，必须说明对应现实含义：下游未完成，不能收口或自动升级阶段；合同层仍能继续。
4. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`，对外解释为 `in_progress / downstream-gated`。
5. 本节不授权任何实现、Board/UI、E2E、截图、图片打开、音频接入、资源压缩或上传。

### 6.55 授权包重锁字段模板（2026-07-29）

本节把 6.52 的五个授权包展开成统一的“离开合同层前必须填写字段”。结构化副本落在 `temp/betrayal-full-deck-authorization-relock-field-template-2026-07-29.json`。本节不领取任何授权包，不实现卡牌效果，不改 Board/UI，不跑 E2E，不截图，不打开图片，不接入音频，不压缩或上传资源。

| 必填字段 | 现实含义 |
| --- | --- |
| `authorizationPacketId` | 本次只领取哪一个授权包，不能一次泛化成整组或整牌库 |
| `downstreamGroup` | 下游组：事件机制、物品机制、预兆 / 公共作祟、7 号作祟、UI / E2E / 资源 |
| `concreteObjectOrNode` | 单张牌、单个公共规则节点、单个 UI 节点或单个资源节点；不能写“全部事件 / 全部物品” |
| `specificRuleBranchOrConsumer` | 要处理的具体分支、消费者、状态前提、私密性要求或验收节点 |
| `primaryTruthSource` | 本地图包完整单卡、atlas frame/hash、官方规则段、已锁合同或当前代码证据中哪一个负责真相 |
| `supportingContractLocation` | 主合同对象行、NB 桶、专项账本或结构化副本位置 |
| `targetEntrypointOrContractEntrypoint` | 目标代码入口、测试入口、UI 入口、资源入口或合同入口 |
| `acceptanceEvidenceType` | 合同-only、领域测试、组件测试、UI 审查、E2E、截图、资源上传或远端回查中的哪一种 |
| `explicitlyAllowedActions` | 本次明确允许做什么，必须窄于禁止动作 |
| `stillProhibitedActions` | 本次仍禁止的动作，尤其 Board/UI、E2E、截图、图片打开、音频、资源链 |
| `userInputNeeded` | 是否真的需要用户补源或裁定；默认 false，只有具体字段无法从本地证据锁定时才 true |
| `defaultStatus` | 默认 `unclaimed / contract-only`，不得把模板本身当成授权已领取 |

| 授权包 | 必须点名的最小对象 | 默认真相源 | 默认入口 | 仍禁止 |
| --- | --- | --- | --- | --- |
| `AUTH-EVENT-01` | 一张事件牌 + 一个规则分支 / 消费者 | TTS/Mod 完整单卡、事件 atlas frame/hash、已锁事件合同 | `scenarioConfig.ts`、`game.ts` 事件消费者或合同桶 | 新增事件实现、批量补 43 张事件、Board/UI、E2E、截图、音频 |
| `AUTH-ITEM-01` | 一张物品牌 + 一个使用 / 被动 / 伤害 / 攻击 / 移动消费者 | TTS/Mod 完整单卡、物品 atlas frame/hash、已锁物品合同 | `possessionEffects.ts`、`game.ts` 持有物消费者或合同桶 | 新增物品实现、批量补 22 张物品、Board/UI、E2E、截图、资源上传 |
| `AUTH-OMEN-HAUNT-01` | 一张预兆或一个公共作祟规则节点 | TTS/Mod 完整单卡、官方作祟规则段、已锁预兆 / 作祟合同 | `possessionEffects.ts`、`game.ts` 作祟风险消费者或合同桶 | 把公共作祟并入单张预兆、改公共作祟流程、Board/UI、E2E、截图 |
| `AUTH-HAUNT07-01` | 一个 7 号作祟节点 + 一个玩家视角 / 私密性要求 | `docs/games/betrayal/haunts/07-upon-reflection.md`、已锁合同、当前领域证据 | `game.ts` 7 号消费者、作祟账本或合同桶 | 宣称完整 7 号作祟完成、专属 UI、E2E、截图、图片打开 |
| `AUTH-UI-E2E-ASSET-01` | 一个真实页面入口、测试入口、截图目标、脚注 / 音频或资源节点 | 已锁对象合同、当前 Board/组件入口、资源链规范或测试证据要求 | Board/UI、E2E、截图、音频/资源合同或合同桶 | 改 Board/UI、运行 E2E、截图、打开图片、接入音频、压缩或上传资源 |

6.55 裁定：

1. 五个授权包现在具备同一组最小重锁字段；后续离开合同层时不能只说“继续某个组”，必须填具体对象、真相源、入口和验收证据。
2. 本节没有领取任何授权包，也没有放行实现、Board/UI、E2E、截图、图片打开、音频或资源动作。
3. 如果用户只说“继续”，仍默认留在合同层；如果用户明确选择某个授权包，下一步先填写该包的重锁字段，再判断是否能进入对应下游动作。
4. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`，对外解释为 `in_progress / downstream-gated`。

### 6.56 授权包重锁字段模板覆盖审计（2026-07-29）

本节只审计 6.55 的字段模板是否完整覆盖 6.52 的五个授权包。结构化副本落在 `temp/betrayal-full-deck-authorization-relock-template-coverage-audit-2026-07-29.json`。本节不领取授权包，不实现卡牌效果，不改 Board/UI，不跑 E2E，不截图，不打开图片，不接入音频，不压缩或上传资源。

| 审计项 | 结果 |
| --- | --- |
| 预期授权包 | 5：`AUTH-EVENT-01`、`AUTH-ITEM-01`、`AUTH-OMEN-HAUNT-01`、`AUTH-HAUNT07-01`、`AUTH-UI-E2E-ASSET-01` |
| 模板授权包 | 5 / 5：与预期授权包一一对应 |
| 重复模板 ID | 0 |
| 缺失模板 ID | 0 |
| 多余模板 ID | 0 |
| 统一必填字段 | 12 / 12：每个模板均覆盖 6.55 的必填字段 |
| 默认状态 | 5 / 5 均为 `unclaimed / contract-only` |
| 用户补源需求 | 5 / 5 均为 `userInputNeeded=false` |
| 阶段状态 | `pass-contract-only`：只证明模板覆盖完整，不证明下游完成 |

| 授权包 | 字段完整性 | 仍未领取 | 仍禁止动作已保留 |
| --- | --- | --- | --- |
| `AUTH-EVENT-01` | 12 / 12 | 是 | 是 |
| `AUTH-ITEM-01` | 12 / 12 | 是 | 是 |
| `AUTH-OMEN-HAUNT-01` | 12 / 12 | 是 | 是 |
| `AUTH-HAUNT07-01` | 12 / 12 | 是 | 是 |
| `AUTH-UI-E2E-ASSET-01` | 12 / 12 | 是 | 是 |

6.56 裁定：

1. 五个授权包均已有完整重锁字段模板，没有漏包、重复包、多余包或缺字段。
2. 这些模板仍全部是 `unclaimed / contract-only`；本节没有让任何包进入实现、UI、E2E、截图、图片打开、音频或资源阶段。
3. 当前不需要用户补整包图集，也不需要用户补源；只有后续具体领取某个包且发现单卡不可读、frame/hash 冲突、原文冲突或真相源改变时，才请求最小裁定。
4. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`，对外解释为 `in_progress / downstream-gated`。

### 6.57 授权包未领取 / 下游禁行动作守卫登记簿（2026-07-29）

本节把 6.52-6.56 的五个授权包登记成“未领取守卫”。结构化副本落在 `temp/betrayal-full-deck-authorization-unclaimed-guard-2026-07-29.json`。本节不领取任何授权包，不实现卡牌效果，不改 Board/UI，不跑 E2E，不截图，不打开图片，不接入音频，不压缩或上传资源。

| 守卫项 | 裁定 |
| --- | --- |
| 授权包总数 | 5 / 5：`AUTH-EVENT-01`、`AUTH-ITEM-01`、`AUTH-OMEN-HAUNT-01`、`AUTH-HAUNT07-01`、`AUTH-UI-E2E-ASSET-01` |
| 当前领取状态 | 0 / 5 claimed；5 / 5 仍为 `unclaimed / contract-only` |
| 用户只说“继续”时 | 默认继续合同层维护：缺口桶、证据边界、旧证据降级、重锁清单、状态词解释、授权包字段和覆盖审计 |
| 仍禁止动作 | 实现卡牌效果、修改 Board/UI、运行 E2E、截图或打开图片、接入音频、压缩或上传资源、宣称整牌库完成 |
| 是否需要用户补源 | 当前不需要；只有具体单卡不可读、frame/hash 对不上、原文冲突、用户改变主真相源，或用户要求离开合同层但未点名对象时才请求最小补源 / 裁定 |
| 对外状态词 | 仍为 `in_progress / downstream-gated`；历史旧别名 `downstream-blocked` 只在解释旧证据时使用 |

| 授权包 | 当前状态 | 领取前允许 | 领取前仍禁止 | 领取时必须补齐 |
| --- | --- | --- | --- | --- |
| `AUTH-EVENT-01` | `unclaimed / contract-only` | 维护事件缺口桶、消费者边界、证据索引 | 新增事件实现、批量补 43 张事件、Board/UI、E2E、截图、音频接入 | 一张事件牌 + 一个规则分支 / 消费者 + 主真相源 + 目标入口 + 验收证据类型 + 允许 / 禁行动作 |
| `AUTH-ITEM-01` | `unclaimed / contract-only` | 维护物品消费者桶、组合边界、顺序假设 | 新增物品实现、批量补 22 张物品、Board/UI、E2E、截图、资源上传 | 一张物品牌 + 一个使用 / 被动 / 伤害 / 攻击 / 移动消费者 + 组合前提 + 主真相源 + 目标入口 + 验收证据类型 |
| `AUTH-OMEN-HAUNT-01` | `unclaimed / contract-only` | 维护预兆逐卡桶和公共作祟规则边界 | 把公共作祟并入单张预兆、改公共作祟流程、Board/UI、E2E、截图 | 一张预兆或一个公共作祟规则节点 + 触发时点 + 骰数 / 风险 / 转移状态 + 主真相源 + 目标入口 + 验收证据类型 |
| `AUTH-HAUNT07-01` | `unclaimed / contract-only` | 维护 7 号作祟子账本、公开 / 私密可见性、setup 边界 | 宣称完整 7 号作祟完成、专属 UI、E2E、截图、打开图片 | 一个 7 号作祟节点 + 玩家视角 / 私密性要求 + 主真相源 + 目标入口 + 领域或 UI 验收范围 |
| `AUTH-UI-E2E-ASSET-01` | `unclaimed / contract-only` | 维护未来 UI 承接、旧 E2E / 截图降级、资源准入边界 | 改 Board/UI、运行 E2E、截图、打开图片、接入音频、压缩或上传资源 | 一个真实页面入口或资源节点 + 允许动作 + 状态来源 + 验收产物 |

6.57 裁定：

1. 五个授权包当前全部未领取；这不是卡住，也不是要求用户现在补材料，而是防止“继续”被误解成自动进入实现 / UI / E2E / 截图。
2. 用户只说“继续”时，默认动作仍是合同层维护，不自动领取任何授权包。
3. 若用户明确选择某个授权包，下一步必须先按 6.55 字段补齐具体对象、规则分支 / 消费者、主真相源、目标入口、验收证据、允许动作和仍禁止动作。
4. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`，对外解释为 `in_progress / downstream-gated`。

### 6.58 授权包未领取守卫覆盖审计（2026-07-29）

本节只审计 6.57 的未领取守卫是否完整覆盖五个授权包、是否保留每包禁行动作和领取条件。结构化副本落在 `temp/betrayal-full-deck-authorization-unclaimed-guard-coverage-audit-2026-07-29.json`。本节不领取授权包，不实现卡牌效果，不改 Board/UI，不跑 E2E，不截图，不打开图片，不接入音频，不压缩或上传资源。

| 审计项 | 结果 |
| --- | --- |
| 预期授权包 | 5：`AUTH-EVENT-01`、`AUTH-ITEM-01`、`AUTH-OMEN-HAUNT-01`、`AUTH-HAUNT07-01`、`AUTH-UI-E2E-ASSET-01` |
| 守卫授权包 | 5 / 5：与预期授权包一一对应 |
| 缺失授权包 | 0 |
| 重复授权包 | 0 |
| 多余授权包 | 0 |
| 已领取授权包 | 0 / 5 |
| 未领取授权包 | 5 / 5 |
| `contract-only` 状态 | 5 / 5 |
| 缺少禁行动作的包 | 0 |
| 缺少领取条件的包 | 0 |
| 默认“继续”行为 | 已登记：留在合同层维护，不自动进入下游 |
| 阶段状态 | `pass-contract-only`：只证明守卫覆盖完整，不证明下游完成 |

| 授权包 | 未领取状态 | 禁行动作 | 领取条件 | 覆盖裁定 |
| --- | --- | --- | --- | --- |
| `AUTH-EVENT-01` | 是 | 已登记 | 已登记 | `covered` |
| `AUTH-ITEM-01` | 是 | 已登记 | 已登记 | `covered` |
| `AUTH-OMEN-HAUNT-01` | 是 | 已登记 | 已登记 | `covered` |
| `AUTH-HAUNT07-01` | 是 | 已登记 | 已登记 | `covered` |
| `AUTH-UI-E2E-ASSET-01` | 是 | 已登记 | 已登记 | `covered` |

6.58 裁定：

1. 6.57 的未领取守卫覆盖全部五个授权包，没有漏包、重复包、多余包、缺禁行动作或缺领取条件。
2. 五个授权包仍全部是 `unclaimed / contract-only`；没有任何包被领取。
3. 用户只说“继续”时仍默认合同层维护；离开合同层必须先选择具体授权包并按 6.55 重锁字段。
4. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`，对外解释为 `in_progress / downstream-gated`。

### 6.59 授权包领取指令解析路由（2026-07-29）

本节把用户继续类口令、授权包选择类口令和下游动作类口令映射到合同层或授权包重锁前置。结构化副本落在 `temp/betrayal-full-deck-authorization-command-router-2026-07-29.json`。本节不领取授权包，不实现卡牌效果，不改 Board/UI，不跑 E2E，不截图，不打开图片，不接入音频，不压缩或上传资源。

| 用户口令类型 | 示例 | 当前路由 | 是否领取授权包 | 允许动作 | 禁止 / 需先补齐 |
| --- | --- | --- | --- | --- | --- |
| 继续类 | “继续”、“继续完成任务”、“接着做” | 合同层维护 | 否 | 缺口桶、证据边界、重锁清单、状态词解释、授权包字段 / 守卫 / 覆盖审计 | 不得实现、改 Board/UI、跑 E2E、截图、打开图片、接入音频、压缩 / 上传资源或宣称完成 |
| 明确合同层 | “继续合同层”、“补证据边界”、“更新合同” | 合同层维护 | 否 | 合同文档、结构化副本、状态文件、覆盖审计 | 不得进入下游动作 |
| 只点授权包 / 组 | “做事件机制组”、“领取 AUTH-EVENT-01” | 需要重锁字段 | 否 | 填 6.55 字段 | 不得用包名替代具体对象，不得跳过字段直接实施 |
| 授权包 + 对象 | “领取 AUTH-ITEM-01，处理幸运硬币倒塌房间组合” | 先填重锁字段，再判断是否进入下游 | 字段补齐后才算 pending claim | 填具体对象、规则分支 / 消费者、主真相源、入口、验收证据、允许 / 禁行动作 | 未写字段前不得实施；单对象授权不能外推整牌库完成 |
| 下游动作但未点包 | “直接实现”、“改 UI”、“跑 E2E”、“截图看看” | 被重锁门拦住 | 否 | 先选择具体授权包和对象 | 不得执行下游动作，不得用替代证据冒充完成 |
| 批量完成类 | “把整牌库做完”、“全部实现”、“整组都补” | 拆成单个授权包 | 否 | 先拆一个具体授权包 + 一个具体对象 / 节点 | 不得批量进入实现 / UI / E2E / 截图或宣称完成 |

| 当前最新用户口令 | 分类 | 路由 | 当前是否需要用户补充 |
| --- | --- | --- | --- |
| “继续完成任务” | 继续类 | 合同层维护 | 否 |

6.59 裁定：

1. 当前“继续完成任务”仍按继续类口令处理，不领取任何授权包。
2. 当前可继续合同层维护；不能自动进入卡牌效果实现、Board/UI、E2E、截图、图片打开、音频或资源链。
3. 若后续要离开合同层，必须先选择具体授权包、点名具体对象或规则节点，并补齐 6.55 的重锁字段。
4. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`，对外解释为 `in_progress / downstream-gated`。

### 6.60 授权包领取指令解析覆盖审计（2026-07-29）

本节只审计 6.59 的指令解析路由是否覆盖本阶段需要区分的口令类型，以及是否存在未重锁字段就放行下游动作的路径。结构化副本落在 `temp/betrayal-full-deck-authorization-command-router-coverage-audit-2026-07-29.json`。本节不领取授权包，不实现卡牌效果，不改 Board/UI，不跑 E2E，不截图，不打开图片，不接入音频，不压缩或上传资源。

| 审计项 | 结果 |
| --- | --- |
| 预期口令类型 | 6：继续类、明确合同层、只点授权包 / 组、授权包 + 对象、下游动作但未点包、批量完成类 |
| 路由口令类型 | 6 / 6：与预期口令类型一一对应 |
| 缺失口令类型 | 0 |
| 重复口令类型 | 0 |
| 多余口令类型 | 0 |
| 缺少 route 的类型 | 0 |
| 缺少示例的类型 | 0 |
| 立即领取授权包的类型 | 0 |
| 未重锁字段就允许下游动作的类型 | 0 |
| 当前用户口令 | “继续完成任务” |
| 当前分类 | `continue-only` |
| 当前路由 | `contract-layer-maintenance` |
| 当前是否领取授权包 | 否 |
| 阶段状态 | `pass-contract-only`：只证明路由覆盖完整，不证明下游完成 |

| 口令类型 | 路由 | 是否允许未重锁字段进入下游 | 覆盖裁定 |
| --- | --- | --- | --- |
| `continue-only` | `contract-layer-maintenance` | 否 | `covered` |
| `contract-only-explicit` | `contract-layer-maintenance` | 否 | `covered` |
| `packet-only` | `authorization-relock-required` | 否 | `covered` |
| `packet-plus-object` | `fill-relock-fields-before-downstream` | 否 | `covered` |
| `downstream-action-without-packet` | `blocked-by-relock-gate` | 否 | `covered` |
| `complete-or-batch-claim` | `split-to-single-authorization-packet` | 否 | `covered` |

6.60 裁定：

1. 6.59 的指令解析路由覆盖六类口令，没有漏类、重复类、多余类、缺 route 或缺示例。
2. 没有任何口令类型允许未选择授权包、未点名对象、未补齐 6.55 字段就进入实现、Board/UI、E2E、截图、音频或资源链。
3. 当前“继续完成任务”仍分类为 `continue-only`，路由到合同层维护，不领取授权包。
4. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`，对外解释为 `in_progress / downstream-gated`。

### 6.61 授权包路由退出门 / 下一次离开合同层最小输入表（2026-07-29）

本节只把“什么时候能离开合同层”压成最小输入表，避免把“继续完成任务”误读成实现、Board/UI、E2E、截图、音频或资源链授权。结构化副本落在 `temp/betrayal-full-deck-authorization-exit-minimum-inputs-2026-07-29.json`。本节不领取授权包，不实现卡牌效果，不改 Board/UI，不跑 E2E，不截图，不打开图片，不接入音频，不压缩或上传资源。

| 授权包 | 下游组 | 离开合同层最小输入 | 输入不足的典型口令 |
| --- | --- | --- | --- |
| `AUTH-EVENT-01` | 事件牌机制承接 | 一个具体事件牌或已登记事件缺口桶；具体规则分支 / 消费场景；主合同对象行或 6.12 / 6.26 / 6.33 / 6.41-6.44 中的合同入口；目标入口；验收证据类型与仍禁止动作 | 只说“继续”；只说“把事件都做完”；只说“实现事件牌”但不点名事件或分支 |
| `AUTH-ITEM-01` | 物品牌机制承接 | 一个具体物品牌或已登记物品缺口桶；消费场景；主合同对象行或 6.13 / 6.27 / 6.34-6.35 / 6.45-6.48 中的合同入口；目标入口；验收证据类型与仍禁止动作 | 只说“继续”；只说“处理物品”；只说“全部物品完成”但不点名消费者 |
| `AUTH-OMEN-HAUNT-01` | 预兆逐卡效果与作祟公共规则 | 一个具体预兆、预兆缺口桶或一条作祟公共规则；消费场景；主合同对象行或 6.14 / 6.28 / 6.36 / 6.40 / 6.48 中的合同入口；目标入口；验收证据类型与仍禁止动作 | 只说“继续”；只说“作祟做完”；把 9 张预兆数量正确当作逐卡和公共作祟完成 |
| `AUTH-HAUNT07-01` | 7 号作祟完整流程 | 一个具体 7 号作祟节点；公开 / 私密可见性要求或 setup / 破咒 / 镜中提示 / 镜中怪物节点；主合同 6.29 / 6.37 / 6.39 / 6.44 中的合同入口；目标入口；验收证据类型与仍禁止动作 | 只说“继续”；只说“完整作祟”；只说“7 号完成”但不点名节点或视角 |
| `AUTH-UI-E2E-ASSET-01` | UI / E2E / 截图 / 脚注音频 / 资源链 | 一个真实页面入口、UI 承接对象、测试链或资源节点；允许动作；状态来源；验收产物；仍禁止动作和旧证据降级口径 | 只说“继续”；只说“截图看看”；用旧 E2E、旧截图或旧素材 manifest 冒充当前验收 |

| 当前最新用户口令 | 分类 | 路由 | 是否领取授权包 | 当前是否需要用户补整包图源 |
| --- | --- | --- | --- | --- |
| “继续完成任务” | `continue-only` | `contract-layer-maintenance` | 否 | 否 |

6.61 裁定：

1. 当前不是缺整包图源、不是 atlas 导入错误，也不是规范要求停工；当前只是在未点名下游授权包和具体对象时继续留在合同层。
2. 离开合同层的最小输入不是“补 74 张图”，而是选择一个具体授权包，并点名具体对象、规则节点、目标入口和验收证据。
3. 未满足最小输入时，继续类口令只能维护合同、缺口桶、证据边界、重锁清单和状态口径。
4. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`，对外解释为 `in_progress / downstream-gated`。

### 6.62 授权包退出门最小输入覆盖审计（2026-07-29）

本节只审计 6.61 的五个授权包是否都具备离开合同层的最小输入、输入不足示例，以及是否存在未重锁字段就放行下游动作的路径。结构化副本落在 `temp/betrayal-full-deck-authorization-exit-minimum-inputs-coverage-audit-2026-07-29.json`。本节不领取授权包，不实现卡牌效果，不改 Board/UI，不跑 E2E，不截图，不打开图片，不接入音频，不压缩或上传资源。

| 审计项 | 结果 |
| --- | --- |
| 预期授权包 | 5：`AUTH-EVENT-01`、`AUTH-ITEM-01`、`AUTH-OMEN-HAUNT-01`、`AUTH-HAUNT07-01`、`AUTH-UI-E2E-ASSET-01` |
| 最小输入表授权包 | 5 / 5：与预期授权包一一对应 |
| 缺失授权包 | 0 |
| 重复授权包 | 0 |
| 多余授权包 | 0 |
| 缺少最小输入的包 | 0 |
| 缺少输入不足示例的包 | 0 |
| 立即领取授权包的包 | 0 |
| 未重锁字段就允许下游动作的包 | 0 |
| 当前用户口令 | “继续完成任务” |
| 当前路由 | `contract-layer-maintenance` |
| 当前是否领取授权包 | 否 |
| 当前是否需要用户补整包图源 | 否 |
| 阶段状态 | `pass-contract-only`：只证明退出门覆盖完整，不证明下游完成 |

| 授权包 | 最小输入数量 | 输入不足示例 | 是否允许未重锁字段进入下游 | 覆盖裁定 |
| --- | ---: | --- | --- | --- |
| `AUTH-EVENT-01` | 5 | 已登记 | 否 | `covered` |
| `AUTH-ITEM-01` | 5 | 已登记 | 否 | `covered` |
| `AUTH-OMEN-HAUNT-01` | 5 | 已登记 | 否 | `covered` |
| `AUTH-HAUNT07-01` | 5 | 已登记 | 否 | `covered` |
| `AUTH-UI-E2E-ASSET-01` | 5 | 已登记 | 否 | `covered` |

6.62 裁定：

1. 6.61 覆盖全部五个授权包，没有漏包、重复包、多余包、缺最小输入或缺输入不足示例。
2. 没有任何授权包允许未选择具体对象、规则节点、目标入口和验收证据就进入下游动作。
3. 当前“继续完成任务”仍留在合同层维护，不领取授权包，也不需要用户补整包图源。
4. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`，对外解释为 `in_progress / downstream-gated`。

### 6.63 剩余下游缺口到授权包索引（2026-07-29）

本节只把当前仍未闭合的下游缺口映射到五个授权包，作为未来离开合同层时的领取索引。结构化副本落在 `temp/betrayal-full-deck-residual-downstream-gap-index-2026-07-29.json`。本节不领取授权包，不实现卡牌效果，不改 Board/UI，不跑 E2E，不截图，不打开图片，不接入音频，不压缩或上传资源。

| 授权包 | 合同入口 | 当前剩余缺口 | 当前允许动作 | 当前禁止动作 |
| --- | --- | --- | --- | --- |
| `AUTH-EVENT-01` | 6.12、6.26、6.33、6.41-6.44 | 新增 / 补录事件剩余分支、房间目标候选 UI、抽物品 / 非武器筛选 / 弃置终点组合、事件投骰 / 重掷组合、作祟特例展示或音频提示 | 合同索引维护 | 实现事件效果、改 Board/UI、E2E、截图、打开图片、音频或资源链 |
| `AUTH-ITEM-01` | 6.13、6.27、6.34-6.35、6.45-6.48 | 伤害减免 / 改写 / 死亡保护组合、重掷 / 替代数值 UI、武器攻击 / 多武器互斥、治疗 / 恢复 / 同房目标、移动 / 地图 / 门位墙体 | 合同索引维护 | 实现物品效果、改 Board/UI、E2E、截图、打开图片、音频或资源链 |
| `AUTH-OMEN-HAUNT-01` | 6.14、6.28、6.36、6.40、6.48 | 9 张预兆逐卡 UI、全员预兆数风险承接、作祟检定 / 5+ / 8 骰上限、最后一张自动作祟揭示、预兆交易 / 转移风险刷新 | 合同索引维护 | 实现预兆或作祟规则、改 Board/UI、E2E、截图、打开图片、音频或资源链 |
| `AUTH-HAUNT07-01` | 6.29、6.37、6.39、6.44 | 7 号作祟公开 / 私密可见性 UI、setup 分层、破咒 / 镜中提示 / 事件符号房间、镜中怪物移动 / 平手 / 攻击、完整流程验收 | 合同索引维护 | 实现 7 号作祟流程、改 Board/UI、E2E、截图、打开图片、音频或资源链 |
| `AUTH-UI-E2E-ASSET-01` | 6.30、6.38、6.57-6.62 | 发现牌 UI 承接、旧 E2E / 旧截图降级、真实入口 E2E / 截图 / 打开图片、无线电广播脚注 / 音频提示、资源压缩 / 上传 / 回查 | 合同索引维护 | 改 Board/UI、E2E、截图、打开图片、音频或资源链 |

6.63 裁定：

1. 五个授权包均仍有 `downstream-open` 缺口；这些缺口只能作为后续授权入口，不能反向否定 S0 对象全集、数量和 atlas 合同已闭合。
2. 当前“继续完成任务”仍不领取授权包；当前可做的是合同索引维护，不是下游执行。
3. 当前没有需要用户补整包图源；若未来离开合同层，需要的是点名一个授权包和一个具体对象 / 规则节点 / 目标入口 / 验收证据。
4. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`，对外解释为 `in_progress / downstream-gated`。

### 6.64 剩余下游缺口到授权包索引覆盖审计（2026-07-29）

本节只审计 6.63 的剩余下游缺口索引是否完整覆盖五个授权包，以及是否仍保留合同层禁行动作。结构化副本落在 `temp/betrayal-full-deck-residual-downstream-gap-index-coverage-audit-2026-07-29.json`。本节不领取授权包，不实现卡牌效果，不改 Board/UI，不跑 E2E，不截图，不打开图片，不接入音频，不压缩或上传资源。

| 审计项 | 结果 |
| --- | --- |
| 预期授权包 | 5：`AUTH-EVENT-01`、`AUTH-ITEM-01`、`AUTH-OMEN-HAUNT-01`、`AUTH-HAUNT07-01`、`AUTH-UI-E2E-ASSET-01` |
| 索引授权包 | 5 / 5：与预期授权包一一对应 |
| 缺失授权包 | 0 |
| 重复授权包 | 0 |
| 多余授权包 | 0 |
| 带剩余缺口的授权包 | 5 / 5 |
| 带合同入口的授权包 | 5 / 5 |
| 带当前允许动作的授权包 | 5 / 5，均为合同索引维护 |
| 带当前禁止动作的授权包 | 5 / 5 |
| `downstream-open` 授权包 | 5 / 5 |
| 已领取授权包 | 0 / 5 |
| 未重锁字段放行下游动作 | 0 |
| 当前是否需要用户补整包图源 | 否 |

| 授权包 | 剩余缺口数 | 合同入口数 | 当前状态 | 覆盖裁定 |
| --- | ---: | ---: | --- | --- |
| `AUTH-EVENT-01` | 5 | 4 | `downstream-open` | covered |
| `AUTH-ITEM-01` | 5 | 4 | `downstream-open` | covered |
| `AUTH-OMEN-HAUNT-01` | 5 | 5 | `downstream-open` | covered |
| `AUTH-HAUNT07-01` | 5 | 4 | `downstream-open` | covered |
| `AUTH-UI-E2E-ASSET-01` | 5 | 3 | `downstream-open` | covered |

6.64 裁定：

1. 6.63 的剩余下游缺口索引覆盖全部五个授权包，没有漏包、重复包、多余包或缺字段包。
2. 五个授权包均保留 `downstream-open` 和 `contract-index-only` 口径；没有任何包被领取，也没有放行实现、Board/UI、E2E、截图、图片打开、音频或资源链。
3. 当前不是“规范阻止继续”，而是合同层继续推进时不得自动越过下游授权门；对用户汇报应继续解释为 `downstream-gated / 下游完成门禁`。
4. 当前没有需要用户补整包图源；若后续离开合同层，最小动作仍是选择一个具体授权包，并重锁具体对象、真相来源、目标入口和验收口径。

### 6.65 剩余缺口最小解阻动作索引（2026-07-29）

本节把 6.63 的剩余下游缺口和 6.61 的离开合同层最小输入合并成“缺什么、谁能解、最小动作是什么”的索引。结构化副本落在 `temp/betrayal-full-deck-residual-gap-unblock-action-index-2026-07-29.json`。本节不领取授权包，不实现卡牌效果，不改 Board/UI，不跑 E2E，不截图，不打开图片，不接入音频，不压缩或上传资源。

| 授权包 | 现在缺什么（人话） | 现在是否需要用户补材料 | 当前可继续做 | 如果要离开合同层，用户最小动作 |
| --- | --- | --- | --- | --- |
| `AUTH-EVENT-01` | 事件牌不是缺图；缺部分事件分支、目标候选、抽物品 / 弃置终点、投骰重掷组合和作祟特例的下游消费证据 | 否 | 合同层继续维护事件剩余分支、合同入口和旧证据降级 | 点名一个具体事件牌或事件缺口桶，并说明要做领域补证、UI 承接还是组合测试 |
| `AUTH-ITEM-01` | 物品牌不是缺图，也不是 duplicate-alias 未裁定；缺伤害、重掷、武器、治疗、移动 / 地图等消费者的组合证据或 UI 承接 | 否 | 合同层继续维护物品消费者边界、alias 禁止重复计数和消费场景映射 | 点名一个具体物品牌或物品消费场景，并说明目标入口 |
| `AUTH-OMEN-HAUNT-01` | 9 张预兆数量已对齐；缺逐卡 UI / 组合承接，以及作祟风险、5+、8 骰上限、最后一张自动作祟的完整下游承接 | 否 | 合同层继续维护 9 张预兆逐卡合同与作祟公共规则两层账本 | 点名一个具体预兆、一个预兆缺口桶，或一条作祟公共规则，并说明目标入口 |
| `AUTH-HAUNT07-01` | 7 号作祟已有代表领域链；缺公开 / 私密 UI、setup 完整承接、破咒 / 镜中提示 / 镜中怪物节点和真实入口验收 | 否 | 合同层继续维护 7 号作祟可见性、setup、怪物和行动节点边界 | 点名一个 7 号作祟节点，并说明目标入口 |
| `AUTH-UI-E2E-ASSET-01` | UI、E2E、截图、打开图片、音频和资源链不是本轮授权范围；缺真实页面入口、验收动作和资源节点授权 | 否 | 合同层继续维护旧 E2E / 旧截图降级、UI / E2E / 资源链前置 | 明确授权一个具体动作，例如改某个 UI 承接、跑哪条真实入口 E2E、截图、音频或资源链 |

6.65 裁定：

1. 当前不需要用户补整包图源，也没有发现 atlas 导入错误；本地仍可继续做合同层维护。
2. 现在的“缺”不是图片缺失，而是下游机制消费、UI 承接、组合测试、真实入口验收、音频 / 资源链授权缺口。
3. 如果用户只说“继续”，继续留在合同层；如果用户要我离开合同层，最小动作是选择一个授权包并点名具体对象、规则节点、目标入口和验收口径。
4. 本节不改变整牌库总状态：仍为 `in_progress / downstream-gated`（历史旧别名：`downstream-blocked`）。

### 6.66 剩余缺口最小解阻动作覆盖审计（2026-07-29）

本节只审计 6.65 的最小解阻动作索引是否覆盖全部五个授权包，以及每个包是否都有“现在缺什么、现在是否需要用户补材料、当前可继续做什么、离开合同层的最小用户动作、未重锁前仍禁止什么”五类字段。结构化副本落在 `temp/betrayal-full-deck-residual-gap-unblock-action-coverage-audit-2026-07-29.json`。本节不领取授权包，不实现卡牌效果，不改 Board/UI，不跑 E2E，不截图，不打开图片，不接入音频，不压缩或上传资源。

| 审计项 | 结果 |
| --- | --- |
| 预期授权包 | 5：`AUTH-EVENT-01`、`AUTH-ITEM-01`、`AUTH-OMEN-HAUNT-01`、`AUTH-HAUNT07-01`、`AUTH-UI-E2E-ASSET-01` |
| 实际授权包 | 5 / 5：与预期授权包一一对应 |
| 缺失授权包 | 0 |
| 重复授权包 | 0 |
| 多余授权包 | 0 |
| 带人话缺口字段的授权包 | 5 / 5 |
| 带“当前是否需要用户补材料”的授权包 | 5 / 5；均为不需要 |
| 带“当前可继续做”的授权包 | 5 / 5；均只允许合同层维护 |
| 带“离开合同层最小用户动作”的授权包 | 5 / 5 |
| 带“未重锁前仍禁止动作”的授权包 | 5 / 5 |
| 当前是否需要用户补整包图源 | 否 |
| 当前是否存在 atlas 导入错误 | 否 |
| 已领取授权包 | 0 / 5 |
| 已释放下游动作 | 0 / 5 |

| 授权包 | 字段覆盖 | 当前可否无用户补材料继续合同层 | 禁止动作数 | 覆盖裁定 |
| --- | --- | --- | ---: | --- |
| `AUTH-EVENT-01` | 5 / 5 | 是 | 4 | covered |
| `AUTH-ITEM-01` | 5 / 5 | 是 | 4 | covered |
| `AUTH-OMEN-HAUNT-01` | 5 / 5 | 是 | 4 | covered |
| `AUTH-HAUNT07-01` | 5 / 5 | 是 | 4 | covered |
| `AUTH-UI-E2E-ASSET-01` | 5 / 5 | 是 | 5 | covered |

6.66 裁定：

1. 6.65 的五个授权包均具备最小解阻动作字段，没有漏包、重复包、多余包或缺字段包。
2. 当前“阻塞”不是不能继续；它只是不允许自动越过合同层去做实现、Board/UI、E2E、截图、打开图片、音频或资源链。
3. 当前不需要用户补整包图源，也没有 atlas 导入错误；如果用户只说“继续”，仍可以继续合同层维护。
4. 若后续要离开合同层，必须先选择具体授权包，并重锁具体对象、规则节点、目标入口和验收口径。
5. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`，对外解释为 `in_progress / downstream-gated`。

### 6.67 合同层停线审计：避免无限追加审计冒充进展（2026-07-29）

本节只回答“如果用户继续只说继续，合同层还能不能继续扩展”。结构化副本落在 `temp/betrayal-full-deck-contract-only-stopline-audit-2026-07-29.json`。本节不领取授权包，不实现卡牌效果，不改 Board/UI，不跑 E2E，不截图，不打开图片，不接入音频，不压缩或上传资源。

| 审计面 | 当前裁定 | 证据 |
| --- | --- | --- |
| S0 对象全集 / atlas / legacy alias 账本 | 当前证据下已闭合 | 74 行对象全集、43/22/9 数量、事件 frame 42、物品 frame 0-21、legacy alias 不计官方牌数 |
| 剩余下游缺口索引 | 已覆盖 | 5 个授权包均映射到剩余下游缺口和未重锁前禁止动作 |
| 最小解阻动作索引 | 已覆盖 | 5 个授权包均有人话缺口、当前可继续合同层动作和离开合同层最小用户动作 |
| 最小解阻动作覆盖审计 | 已覆盖 | 6.66 确认缺失字段包为 0，已领取授权包为 0 |
| 当前是否需要用户补整包图源 | 否 | 图包和项目正式 atlas 已逐字节一致；当前缺口不在整包素材 |
| 当前是否存在 atlas 导入错误 | 否 | 事件 / 物品 / 预兆正式 atlas 与原始图包 hash 一致 |
| 当前是否应继续追加同类覆盖审计 | 否，除非出现新证据、新冲突、新授权包或旧停点措辞变脏 | 6.50-6.66 已覆盖重锁、路由、退出门、缺口索引、最小解阻和字段覆盖 |
| 当前是否可自动进入下游动作 | 否 | 未领取授权包，未重锁具体对象 / 节点 / 入口 / 验收口径 |

| 后续动作类型 | 是否可无用户补充继续 | 当前允许动作 | 禁止外推 |
| --- | --- | --- | --- |
| 合同层维护 | 可以，但只限维护 | 修正过时停点、登记新证据冲突、保持旧证据降级、维护授权包字段 | 不要在字段和包不变时继续堆重复覆盖审计 |
| 下游机制 / UI / E2E / 截图 / 音频 / 资源链 | 不可以 | 必须先选择授权包并重锁具体目标 | 不能把“继续”理解成实现、UI、E2E、截图、打开图片、音频、压缩上传或远端回查授权 |

6.67 裁定：

1. 当前不是图包、导入或规范卡住；当前是合同层已经把离开合同层的门槛写清，但用户尚未选择具体下游授权包。
2. 如果后续仍只有“继续”这类口令，正确行为是保持 `in_progress / downstream-gated`，维护停线和新证据，不要为了制造进展继续追加同类覆盖审计。
3. 若要产生实质下游进展，最小用户动作是选择一个授权包：`AUTH-EVENT-01`、`AUTH-ITEM-01`、`AUTH-OMEN-HAUNT-01`、`AUTH-HAUNT07-01` 或 `AUTH-UI-E2E-ASSET-01`，并点名具体牌、规则节点、目标入口和验收证据。
4. 本节不改变整牌库总状态：仍为 `in_progress / downstream-blocked`，对外解释为 `in_progress / downstream-gated`。

## 7. 本轮禁止升级结论

- 当前配置池 `43 事件 / 22 物品 / 9 预兆` 只能证明对象数量进入配置；事件配置、物品 atlas 接线和卡面映射闭合不证明逐卡机制、UI 和测试完成。
- 当前事件 atlas 标题映射已覆盖 43 张配置事件，E43 frame 42 已由原始 atlas 锁定；但配置池扩到 43 张仍不能替代机制/UI/测试闭合。
- 旧 E2E、旧截图和 `object-inventory.json` 只能证明当前运行池和首剧本代表链，不证明官方 74 张都 locked。
- 9 张预兆数量正确不等于整牌库完成，也不等于作祟公共规则无需审计；最后一张预兆自动作祟只完成公共规则最小领域补证，不替代 9 张预兆逐卡效果审计。
- 事件旧 TTS 9x5 manifest 的 42 个候选不能冒充官方 43 张事件全集，也不能反向否定原始 atlas 的 frame 42。
- 旧裁图 manifest 的 12 个物品行不能冒充官方 22 张物品全集；当前运行发现池已是 22 张官方物品，且官方运行物品覆盖唯一 item frame 0-21。`lantern/notebook/journal/manuscript` 仍是 legacy alias / duplicate-alias，不得重复计数为额外官方牌。
- 6.30 的 UI / E2E / 截图 / 脚注音频前置清单只证明授权入口已拆清，不证明 Board/UI、真实入口测试、截图、图片打开、音频接入或资源上传已经发生。
- 6.31 的工作单覆盖闭环只证明 WO-01 到 WO-08 均已有合同入口和结构化副本，不证明任何下游缺口完成。
- 6.32 的下一对象 / 缺口桶选择器只证明后续合同层入口已结构化，不证明任何具体牌、公共作祟、7 号作祟、UI/E2E/截图或资源链缺口已经完成。
- 6.33 的 NB-01 事件伤害消费者桶只证明 19 张事件的伤害 / 死亡保护 / 减免组合边界已登记，不证明任何伤害结算、死亡保护、减免、UI/E2E 或截图缺口已经完成。
- 6.34 的 NB-06 物品伤害 / 死亡保护桶只证明六张物品与五类伤害来源的消费者边界已登记，不证明任何减免、改写、死亡保护、攻击防御、重掷后自伤、UI/E2E 或截图缺口已经完成。
- 6.35 的 NB-09 物品重掷 / 替代数值 / 属性检定消费者桶只证明六张物品与六类投骰来源边界已登记，不证明任何重掷、替代数值、加骰、回滚、作祟特殊行动、UI/E2E 或截图缺口已经完成。
- 6.36 的 NB-13 作祟风险 / 8 骰上限 / 最后一张自动作祟桶只证明五条公共作祟风险规则与五类风险流程边界已登记，不证明作祟揭示 UI、骰盘、翻牌确认、更多剧本入口、E2E 或截图缺口已经完成。
- 6.37 的 NB-14 7 号作祟公开 / 私密可见性与 setup 桶只证明五个可见性 / setup 节点、三类视角边界和五项 setup 分层已登记，不证明私密 UI、完整 setup UI、破咒 UI、镜中怪物完整流程、E2E 或截图缺口已经完成。
- 6.38 的 NB-16 UI / E2E / 截图 / 脚注音频授权前置桶只证明后续授权边界已登记，不证明 Board/UI、真实入口测试、截图、图片打开、音频接入、资源压缩上传或远端回查已经发生。
- 6.39 的 NB-15 7 号作祟破咒 / 镜中提示 / 镜中怪物移动攻击桶只证明六个行动 / 怪物节点的合同边界已登记，不证明完整 7 号作祟、专属 UI、真实入口 E2E、截图或完整怪物回合组合完成。
- 6.40 的 NB-12 预兆交易 / 持有物转移 / 已用牌限制桶原本只证明狗交易、普通交易、同意结算、已用牌限制、交易后全员预兆数、搜尸和控制回合限制的合同边界已登记；后续当前树已补狗交易 Board 组件候选 / 4 格目标 / 同意结算 / 已用牌禁用 / 灰尘冲突 / 风险条代表链，但仍不证明真实入口 E2E、截图、死亡掉落 / 搜尸组合或全部作祟状态完成。
- 6.41 的 NB-02 事件目标候选 / 房间合法性桶原本只证明六张事件的候选来源、非法原因和未来 UI 状态真相已登记；后续当前树已补地狱蝙蝠、花团锦簇、秘密升降机、一条秘密通道、一声呼救和上古旧宅 Board 组件目标选择代表链，也已补技术难点确定性起始点放置与地下室精神伤害 Board 组件代表链，但仍不证明真实入口 E2E、截图、非法目标提示 UI、失败伤害 UI、秘密通道标志物移动入口、地图 / 门位 / 区域组合、温室 / 楼层全部组合、通用伤害死亡保护、精神伤害减免/死亡保护或作祟地图限制完成。
- 6.42 的 NB-03 事件物品 / 牌堆 / 持有物选择桶原本只证明五张事件的抽物品、非武器筛选、弃置 / 埋葬终点和持有物来源边界已登记；后续当前树已补不可能的房间、断手、轮到约拿了和游魂的 Board 组件代表链，其中轮到约拿了已补非武器候选、确认派发和拒绝精神伤害确认步骤，但仍不证明物品牌堆耗尽、无非武器物品 UI、已用 / 不可交易组合、弃置终点可见性、真实入口 E2E 或截图完成。
- 6.43 的 NB-04 事件投骰 / 属性 / 重掷消费者桶只证明十二张事件的事件属性检定、固定事件骰、祝福额外骰、属性上下限和重掷准入边界已登记；天使之羽页面 0-8 数字选择已由物品主动牌 E2E 代表链补证，片刻希望房间祝福标记 UI、上古旧宅力量地面分支、肉质苔癣固定 2 骰成功任选属性分支、脑状食品力量检定高分 / 低分代表分支、吊死鬼全通过奖励属性选择代表分支和一条秘密通道第二目标板块代表路径已由 Board 组件代表链补证，但本桶仍不证明重掷组合、祝福加骰同屏可见性、死亡保护、事件真实入口 E2E 或截图完成。
- 6.44 的 NB-05 事件作祟特例 / 展示音频桶只证明怪异的镜子 7 号代表链和无线电广播脚注 / 音频资源边界已隔离，不证明完整 7 号作祟、脚注 UI、音频资源接入、资源上传、真实入口 E2E 或截图完成。
- 6.45 的 NB-07 物品武器攻击 / 多武器互斥 / 交易限制桶原本只证明枪、十字弓、砍刀、电锯和炸药的攻击消费者边界、用后限制和相邻缺口已登记；后续当前树已补炸药 Board 页面组件目标态代表链，但仍不证明多武器互斥组合、怪物 / 作祟攻击组合、真实入口 E2E 或截图完成。
- 6.46 的 NB-08 物品治疗 / 属性恢复 / 同房目标桶只证明奇怪的药品、镜子、急救包和牙齿项链的治疗 / 恢复边界、目标合法性、用后限制和相邻缺口已登记；后续当前树已补牙齿项链 Board 组件选择 / 跳过代表链，但仍不证明治疗 UI、牙齿项链真实 Playwright / 截图链、死亡保护组合或全部真实入口完成。
- 6.47 的 NB-10 物品移动 / 地图 / 门位墙体桶原本只证明地图、骨制钥匙、急救包和炸药的已发现房间、同板块 / 同房目标、墙体 / 门位、目标板块和作祟地图规则缺口已登记；后续当前树已补骨制钥匙穿墙移动真实入口 E2E 与截图代表链、炸药目标板块 Board 页面组件代表链，但仍不证明地图移动 UI、炸药真实入口 E2E / 截图、非法原因展示、房间 / 门位合法性全组合、作祟地图限制全组合或全部移动消费者完成。
- 6.48 的 NB-11 预兆属性检定加值 / 非战斗检定替代桶原本只证明书本、狗、面具、头骨、圣符、盔甲、雕像和指环的属性加值、书本替代、固定骰 / 战斗排除、濒死成本和相邻桶边界已登记；后续当前树已补书本临界神志成本领域门禁、使用后禁用和神志不足提示 Board 组件代表链，并补面具多目标移动、头骨死亡保护、圣符 / 雕像探索声明与刚获得限制 Board 组件代表链，但仍不证明检定替代逻辑完整、全部 UI、组合测试、真实入口 E2E 或截图完成。
- 6.49 的 NB 工作桶覆盖闭环审计只证明 NB-01 到 NB-16 均有合同段落、结构化副本和状态文件记录，不证明任一桶的下游机制、UI、E2E、截图、音频或资源链完成。
- 6.50-6.67 的下游重锁、授权包、路由、退出门、剩余缺口索引、覆盖审计、最小解阻动作索引、最小解阻动作覆盖审计和合同层停线审计只证明“如何离开合同层”已写清，不证明任何授权包已领取，也不证明卡牌机制、Board/UI、E2E、截图、音频或资源链完成。

## 8. S0 停点与后续准入口径

1. 本轮 S0 合同层可以回答用户问题：图包不缺整牌库 atlas 素材，项目正式 atlas 与原始图包逐字节一致；旧缺口来自旧 manifest/旧运行池口径和后续机制承接，不是导入错。
2. 当前仍保持 `in_progress / downstream-gated`（历史旧别名：`downstream-blocked`），原因不是“缺 74 张对象行”，也不是 S0 合同层不能继续，而是事件和物品有逐卡机制/UI/测试承接缺口；用户已授权继续消费已锁对象进入 S1/S2，但不得把对象级补证外推为整牌库完成。
3. 恐怖玩偶已有属性检定全骰重掷领域链和 Board 组件全骰选择代表链，但仍缺真实 Playwright / 截图、作祟特殊行动属性检定通用回滚快照和更多重掷消费者组合；神秘秒表、胸针、天使之羽、炸药、奇异护符、幸运硬币倒塌房间组合已有 S1/S2 最小领域补证；幸运硬币另有 Board 组件空白骰选择代表链，但仍缺真实 Playwright / 截图、作祟特殊行动、死亡保护和更多伤害分配组合；牙齿项链已有最小领域补证和 Board 组件选择 / 跳过代表链，但仍缺真实 Playwright / 截图、作祟回合、房间回合末和死亡保护组合；书本已有临界神志成本领域门禁、使用后禁用和神志不足提示 Board 组件代表链，但仍缺真实 Playwright / 截图、更多非战斗检定消费者、房间检定、作祟特殊行动检定和重掷 / 替代消费者组合；面具已有同板块队友 / 怪物分别选择相邻板块 Board 组件代表链，但仍缺真实 Playwright / 截图、死亡目标过滤、怪物回合和作祟怪物组合；头骨已有死亡保护 3 骰骰盘、4+ 阻止死亡和头骨反馈 Board 组件代表链，但仍缺真实 Playwright / 截图、更多致死来源、作祟终局和遗物掩埋组合；圣符 / 雕像已有探索声明、连续事件房间和刚获得限制 Board 组件代表链，但仍缺真实 Playwright / 截图、更多房间/作祟探索、无事件符号拒绝 UI 和牌堆顺序组合；新增配置事件已完成一轮运行入口、部分关键分支、自动分支、失败伤害分支、成功属性分支和部分剩余可配置分支代表链补证，并追加覆盖技术难点地下室 fallback、一罐器官成功抽物品、可怜的尤里克成功知识提升 / 失败精神伤害 Board 代表链、无线电广播成功知识提升 / 失败精神伤害 Board 代表链、怪异的镜子接受检定 0-4 / 5+ 代表入口、7 号作祟秘密组合私密状态、破咒最小领域链、事件符号房间不抽事件不结束回合、镜中提示最小领域链、镜中怪物最近目标移动 / 平手路径、镜中怪物同房神志攻击 / 精神伤害代表链、地狱蝙蝠/花团锦簇/秘密升降机/一条秘密通道/一声呼救房间目标合法性、脑状食品力量检定三档 / 伤害与死亡保护相邻链、吊死鬼全属性检定 / 奖励属性选择代表链、一条秘密通道第二目标板块 / 标志物代表链；无线电广播脚注已裁定为展示/音频提示而非规则结算；作祟公共规则已补全员当前持有预兆数、交易转移后总数、抽新预兆骰数、8 骰上限、普通预兆触发和最后一张预兆自动触发的最小领域回归；9 张预兆逐卡领域证据矩阵已补；6.15 已把 A-E 队列做合同层收口审计，6.16 已记录旧数量 / 完成口径扫描，6.17 已把伤害/死亡保护和目标候选 UI 状态真相归并成跨消费者索引，6.18 已补离开合同层前的授权门禁，6.19 已把规范残留的 blocked 停工误读点复核并修正为阶段门禁口径，6.20 已复核 74 行对象表结构完整性，6.21 已复核对象表路径类证据 39 个 token 均可解析，6.22 已复核合同 / 当前运行池 / atlas 三方一致，6.23 已完成 S0 出口审计，6.24 已补下游阶段切换包，6.25 已拆出 8 条可领取工作单，6.26 已领取 WO-01 并把 25 张非纯 `locked` 事件剩余分支归并成 5 个合同缺口桶，6.27 已领取 WO-02 并把 22 张物品消费者归并成 7 个合同缺口桶，6.28 已领取 WO-03/WO-04 并把 9 张预兆逐卡效果与作祟公共规则归并成 7 个合同缺口桶，6.29 已领取 WO-05 并把 7 号作祟完整流程归并成 9 个子账本缺口桶，6.30 已领取 WO-06/WO-07/WO-08 并把 UI / E2E / 截图 / 无线电广播脚注音频资源归并成 3 个授权前置组，6.31 已确认 WO-01 到 WO-08 均有合同段落和结构化副本，6.32 已把下一对象 / 缺口桶选择器整理为 16 个合同层入口，6.33 已领取 NB-01 并把 19 张事件伤害消费者归并成精神伤害、物理伤害、通用伤害、直接属性降低和双伤害顺序 5 个组合边界，6.34 已领取 NB-06 并把头戴耳机、奇异护符、胸针、皮夹克、幸运硬币、牙齿项链与五类伤害来源交叉索引，6.35 已领取 NB-09 并把恐怖玩偶、幸运硬币、兔脚、天使之羽、手电筒、魔法相机与六类投骰来源交叉索引，6.36 已领取 NB-13 并把全员预兆总数、抽预兆作祟检定、5+ 触发、最多 8 骰和最后一张自动作祟与五类风险流程交叉索引，6.37 已领取 NB-14 并把 7 号作祟公开 / 私密可见性、setup 自动 / manual-check 分层、视角矩阵和 setup 项最小解阻动作写入合同，6.38 已领取 NB-16 并把 UI / E2E / 截图 / 脚注音频授权前置拆成发现牌 UI 承接、旧 E2E/截图降级、真实入口 E2E 与截图选择、无线电广播脚注 / 音频 / 资源链 4 个边界，6.39 已领取 NB-15 并把 7 号作祟破咒、镜中提示、事件符号房间、镜中怪物移动 / 平手裁决、镜中怪物攻击 / 精神伤害、完整流程验收拆成 6 个行动 / 怪物节点边界，6.40 已领取 NB-12 并把狗 4 格交易、pendingTradeAgreement / 同意结算、已用牌限制、交易后全员预兆数、死亡掉落 / 搜尸风险刷新和控制回合限制拆成 6 个转移 / 风险节点边界，6.41 已领取 NB-02 并把地狱蝙蝠、花团锦簇、技术难点、秘密升降机、一条秘密通道、一声呼救的候选来源、非法原因、楼层 / 区域 / 已发现限制和未来 UI 状态真相写入合同，6.42 已领取 NB-03 并把不可能的房间、断手、轮到约拿了、游魂、一罐器官的抽物品、非武器筛选、弃置 / 埋葬终点和持有物来源边界写入合同，6.43 已领取 NB-04 并把佳馔满桌、禁忌知识、可怜的尤里克、片刻希望、神秘液体、肉质苔癣、脑状食品、吊死鬼、一条秘密通道、摇曳灯光、着火的人、上古旧宅的事件属性检定、固定事件骰、祝福额外骰、属性上下限、最近投骰重掷和分支回滚边界写入合同，6.44 已领取 NB-05 并把怪异的镜子拒绝 / 0-4 / 5+ 三层、7 号代表链、无线电广播规则结算和脚注 / 音频提示边界写入合同，6.45 已领取 NB-07 并把枪、十字弓、砍刀、电锯和炸药的攻击来源、目标范围、骰 / 属性改写、失败不反伤例外、用后限制和多武器互斥边界写入合同，6.46 已领取 NB-08 并把奇怪的药品、镜子、急救包和牙齿项链的主动治疗、目标合法性、消耗终点、回合结束恢复和组合消费者边界写入合同，6.47 已领取 NB-10 并把地图、骨制钥匙、急救包和炸药的已发现房间、同板块 / 同房目标、墙体 / 门位、目标板块和作祟地图规则缺口写入合同，6.48 已领取 NB-11 并把书本、狗、面具、头骨、圣符、盔甲、雕像和指环的属性检定加值、书本非战斗替代、固定骰 / 战斗排除、濒死神志成本和相邻桶边界写入合同，6.49 已确认 NB-01 到 NB-16 均有合同段落和结构化副本。但后续仍需处理其它剩余物品机制/UI 组合、新增事件剩余分支、7 号专属移动/目标选择 UI、预兆逐卡 UI 承接与组合测试；未闭合前这些继续作为合同缺口清单保留。
4. S0 长段中的 6.41 / 6.43 历史汇总以本轮补正后的 NB-02 / NB-04 正文为准：当前已追加上古旧宅房间目标合法性、属性检定、地面通用伤害和地下室精神伤害边界，并追加肉质苔癣可选拒绝、固定 2 骰、成功任选属性、失败精神伤害和兔脚重掷分支边界，以及脑状食品力量检定三档、任选力量 / 速度、速度 +1 并神志 -1、通用伤害 2、头骨死亡保护和兔脚回滚相邻链，并追加一条秘密通道第二目标板块、秘密通道标志物、知识 +1、神志 -1 和确认收口边界；仍不证明上古旧宅上层成功 UI、地下室精神伤害 UI、非法目标提示 UI，也不证明肉质苔癣精神伤害减免 / 死亡保护、属性上限、更多属性选择、兔脚 UI / 更多重掷组合、真实入口 E2E 或截图完成；也不证明脑状食品成功力量 UI、属性上下限、直接属性降低致死 / 死亡保护、通用伤害减免 / 胸针、兔脚 UI / 更多重掷组合或真实入口 E2E / 截图完成。
5. 后续当前树已补地狱蝙蝠、花团锦簇、秘密升降机、一条秘密通道、一声呼救和上古旧宅 Board 组件目标选择代表链，分别证明相邻目标、地面 / 地下室 / 温室目标、不同区域目标、同区域目标和上古旧宅地面目标的候选展示 / 目标点击承接代表路径；这只降低“目标选择 UI 代表链”缺口，不证明真实入口 E2E / 截图、非法目标提示 UI、失败伤害 UI、作祟地图限制、更多门位 / 连接 / 区域 / 温室 / 楼层组合、通用伤害死亡保护或移动后续反馈完成。
6. 预兆继续保持两层账本：9 张预兆逐卡效果合同 + 作祟公共规则合同；作祟检定不能归并成某一张预兆自身效果。
7. 6.50-6.67 已把下游重锁清单、授权包、口令路由、退出门、剩余缺口索引、索引覆盖审计、最小解阻动作索引、最小解阻动作覆盖审计和合同层停线审计补齐；这些只说明“怎么安全离开合同层、缺口最小怎么解、索引字段是否完整、何时不应继续堆同类审计”，当前没有领取任何授权包，也没有放行实现、Board/UI、E2E、截图、图片打开、音频或资源链。后续对外汇报优先使用 `downstream-gated / 下游门禁中`，只在解释历史证据时提 `downstream-blocked`。
