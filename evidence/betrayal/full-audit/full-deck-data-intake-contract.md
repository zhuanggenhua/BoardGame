# 山屋惊魂第三版整牌库 S0 数据录入合同与 S1/S2 补证记录

> 日期：2026-07-28
> 续跑核验：2026-07-29
> 本合同主范围：整牌库 S0 数据录入 / 合同层闭合；2026-07-29 用户已继续授权消费已锁 S0 合同进入 S1/S2 已锁单卡机制补证。此前神秘秒表、牙齿项链、胸针等对象级补证继续作为实现证据保留；本轮已补天使之羽、炸药、奇异护符、技术难点、新增配置事件代表链、7 号作祟镜中提示、镜中怪物最近目标移动 / 平手路径、镜中怪物同房神志攻击最小领域链、幸运硬币在倒塌房间回合末属性检定中的真实效果链组合、9 张预兆逐卡效果领域证据矩阵，以及作祟公共规则（全员当前持有预兆数、交易转移后总数、抽新预兆骰数、8 骰上限、普通预兆触发、最后一张预兆自动触发与翻牌确认队列）最小领域证据。仍不把 Board/UI、E2E 或截图作为当前完成证据。
> 当前总状态：`in_progress / blocked`。官方 74 张对象已经进入同一张合同账本；本轮按用户指定本地图包重新核对，三个项目正式 atlas 与原始 TTS/Mod 图包逐字节一致。事件源图包实际包含 43 张事件正面 + 1 个空黑格 + 1 张事件背面，E43「最深的壁橱」frame 42 已由原始 atlas 直接锁定；旧 `tts-9x5-crop-manifest.json` 原始 `candidateCards` 仍只有 42 个 TTS `ContainedObjects` 候选，但本轮已在同一 manifest 补入 `gridAudit20260728` 全格扫描字段，明确 frame 42 是有效事件正面、frame 43 是空黑格、frame 44 是事件背面。因此这是旧裁图 manifest 生成口径问题，不是图包缺素材。物品源图包实际包含 22 张物品正面 + 1 个空黑格 + 1 张物品背面；当前工作区发现池已扩到 22 张官方物品，项目 atlas alias 已覆盖 22 个官方物品正面。`notebook`、`lantern`、`journal` 仍作为首剧本起始 / legacy alias 保留在运行持有物全集，但不计入官方 22 张独立物品。原审计入口基线仍按 23 事件 / 12 物品 / 9 预兆记录差异，后续工作区配置扩到 43/22/9 只能说明数量接线已变化，不能倒推最初 30 张缺口不存在。当前计数接线已到 74/74，但大量逐卡机制、UI 承接和测试证据仍未闭合，不得进入整牌库完成或 E2E/截图验收阶段。

## 0. 本轮前提锁定

| 项 | 锁定结果 |
| --- | --- |
| 问题对象 | 《山屋惊魂》第三版基础游戏整牌库：事件牌、物品牌、预兆牌 |
| 真相来源 | 官方规则书组件数量：`74 game cards`，拆分为 `9 Omens / 22 Items / 43 Events`；本地素材、atlas、manifest 和当前运行池只作为覆盖对照 |
| 目标入口/环境 | 当前工作区 `D:/gongzuo/webgame/BoardGame`，当前游戏 `src/games/betrayal` |
| 验收口径 | 74 张对象都必须进同一对象全集；每张必须有来源、运行状态、素材状态、合同状态和最小解阻动作；已锁对象可进入 S1/S2 最小领域补证；存在 blocked 时整体仍为 `in_progress / blocked` |

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
| 合计 | 74 | 44 | 30 | 74 | S0 对象/素材/atlas 数量已闭合；整牌库仍保持 `in_progress / blocked` |

## 1. 数量口径与当前工作区差异

本节记录 2026-07-29 当前工作区状态，不替代上面的原审计入口基线差异。

| 类别 | 官方数量 | 当前发现池配置 | 本合同对象行 | 当前缺口结论 |
| --- | ---: | ---: | ---: | --- |
| 事件牌 | 43 | 43 | 43 | 43 个当前配置事件标题已有 atlas 映射；E43「最深的壁橱」已由原始事件 atlas frame 42 锁定，旧 manifest 原候选漏 frame 42 但已补 `gridAudit20260728`；「轮到约拿了」「片刻希望」「游魂」「技术难点」已补最小运行闭合；新增配置事件定向回归已覆盖 20 张新增/补录事件的运行消费入口，其中 9 张待选择事件已补最小指令结算，自动分支已补一批抽物品、属性写入和移动状态断言，失败伤害分支与剩余可配置分支已各补一组代表链；但多张事件仍缺剩余分支、作祟特例、UI 承接和组合测试 |
| 物品牌 | 22 | 22 | 22 | 原始物品 atlas 已锁 22 张正面；当前发现池已扩到 22 个官方物品对象；`notebook / lantern / journal` 作为 legacy alias 保留但不计入官方 22；牙齿项链、胸针、神秘秒表、天使之羽、炸药、奇异护符已补最小领域验证，多张新增物品仍缺完整 UI 承接或组合验证 |
| 预兆牌 | 9 | 9 | 9 | 9 张对象和素材已建合同；作祟公共规则必须独立于单卡效果审；最后一张预兆自动作祟已补最小领域回归 |
| 合计 | 74 | 74 | 74 | 当前配置数量已对齐官方整牌库；但事件与物品仍需逐张机制/UI/测试闭合证据，不能以计数通过冒充整牌库完成 |

### 1.1 本轮合同核验记录

本合同不把 E2E、截图或 Board/UI 当作 S0 完成证据；当前只按 S0 合同层核对代码、atlas 与 manifest。当前工作区已有 43 张事件的配置 / atlas 映射相关改动，但这仍不等于所有事件完成 UI / 素材 / 机制闭合。

| 核验面 | 结果 | 现实含义 |
| --- | ---: | --- |
| 合同对象行 | 43 事件 / 22 物品 / 9 预兆 | 74 张官方牌已进入同一对象全集账本 |
| 当前发现池配置 | 43 事件 / 22 物品 / 9 预兆 | 当前配置池数量已等于官方 74 张；仍不能冒充逐卡效果、UI 承接和测试闭合 |
| 本轮定向领域回归 | `firstScenarioRuntime.test.ts -t "物品|镜子|持有物|武器|十字弓|电锯|皮夹克|枪"`：83 passed / 561 skipped | 22 张物品运行池、镜子、枪、十字弓、皮夹克、电锯代表链通过；测试内旧“23 张运行持有牌”手抄名单已改为消费当前运行持有牌全集 |
| 牙齿项链定向领域回归 | `firstScenarioRuntime.test.ts -t "牙齿项链"`：8 passed / 644 skipped | 覆盖回合结束出现属性选择、选择濒死属性后提升 1 步、没有濒死属性不拦截回合结束、非法选择非濒死属性被拒且允许跳过 |
| 胸针定向领域回归 | `firstScenarioRuntime.test.ts -t "胸针"`：6 passed / 648 skipped | 覆盖物理伤害可声明使用胸针改成通用伤害、未声明时仍按原伤害类型限制分配、精神伤害也可改成通用伤害 |
| 神秘秒表定向领域回归 | `firstScenarioRuntime.test.ts -t "神秘秒表"`：7 passed / 650 skipped；`firstScenarioRuntime.test.ts -t "牙齿项链|胸针|神秘秒表"`：21 passed / 636 skipped | 覆盖作祟前不能使用、作祟后埋葬并在当前回合结束后仍由当前玩家再行动一轮、未使用时作祟回合结束正常交接且持有者保留秒表 |
| 幸运硬币 / 倒塌房间组合定向领域回归 | `firstScenarioRuntime.test.ts -t "幸运硬币|倒塌房间"`：17 passed / 672 skipped | 覆盖幸运硬币在倒塌房间回合末速度检定中只重掷空白骰；重投为非空白时回滚坠落并按新结果取消房间伤害；重投仍为空白时先进入幸运硬币精神伤害分配，再允许确认倒塌房间坠落伤害并按房间结果推进下一玩家 |
| 天使之羽定向领域回归 | `firstScenarioRuntime.test.ts -t "天使之羽"`：7 passed / 653 skipped | 覆盖使用时必须选择 0-8 整数、使用后埋葬、下一次非战斗属性检定使用所选数字作为投骰结果、仍叠加属性加值、固定骰事件不消费替代状态 |
| 炸药定向领域回归 | `firstScenarioRuntime.test.ts -t "炸药"`：8 passed / 656 skipped | 覆盖当前/相邻已发现板块目标限制、使用后从持有区移除并埋葬、记为本回合已攻击、目标板块探索者分别速度检定、失败探索者进入 4 点物理伤害分配、失败怪物走通用受伤后端 |
| 奇异护符定向领域回归 | `firstScenarioRuntime.test.ts -t "奇异护符"`：12 passed / 655 skipped | 覆盖实际承受物理伤害后神志 +1；通用伤害分配到速度不触发；速度属性直接降低不触发 |
| 技术难点定向领域回归 | `firstScenarioRuntime.test.ts -t "技术难点"`：1 passed / 666 skipped；`firstScenarioRuntime.test.ts -t "新增配置事件"`：26 passed / 646 skipped | 覆盖探索触发后进入新增事件解释器消费入口、将当前探索者放置到下一楼层起始点，并追加覆盖地下室 fallback：从地下室探索时放到上层起始点且承受 1 点精神伤害；仍缺 UI 展示和更多楼层边界组合扩审 |
| 新增配置事件定向领域回归 | `firstScenarioRuntime.test.ts -t "新增配置事件"`：26 passed / 646 skipped；`firstScenarioRuntime.test.ts -t "怪异的镜子|设置阶段必须从七张|新增配置事件"`：28 passed / 646 skipped | 覆盖 20 张新增/补录事件进入运行消费入口；地狱蝙蝠、断手、怪异的镜子、花团锦簇、佳馔满桌、秘密升降机、神秘液体、摇曳灯光、一声呼救完成一个关键分支的最小玩家指令结算；不可能的房间、晦暗暴风夜、可怜的尤里克、禁忌知识、无线电广播、一罐器官、技术难点、着火的人已补一批自动分支状态断言，覆盖抽物品、属性写入、楼层 fallback 和入口大厅移动；不可能的房间、地狱蝙蝠、晦暗暴风夜、禁忌知识、可怜的尤里克、无线电广播、一声呼救、着火的人已补失败伤害分支代表链；断手拒绝路径、佳馔满桌神志成功与失败通用伤害、神秘液体拒绝与 0-5 骰值分支、摇曳灯光力量成功与失败物理伤害已补剩余可配置分支代表链；地狱蝙蝠、花团锦簇、秘密升降机、一声呼救已补房间目标合法性与非法目标拒绝断言；禁忌知识 4+ 知识 +1、着火的人 4+ 神志 +1 已补成功属性分支断言；怪异的镜子已补接受检定 0-4 神志 +1 分支和 5+ 进入 7 号无叛徒代表揭示态，入口大厅放置镜中怪物，setup 队列保留 3 项 manual-check；轮到约拿了、片刻希望、游魂完成更深分支代表链。该结果不等于所有分支/UI/组合闭合，也不等于 7 号作祟完整实现 |
| 7 号作祟怪异的镜子定向领域回归 | `firstScenarioRuntime.test.ts -t "怪异的镜子|Upon Reflection|镜中|事件符号|镜中提示"`：18 passed / 669 skipped | 7 号作祟已补秘密 Trait/Omen/Room 组合的领域状态和私密可见性；`deal-secret-mirror-combination` setup 队列可由领域状态自动 resolved；已补破咒特殊行动命令校验、行动预算、0-4 无反馈、5+ 组合错误只给否定反馈且不泄露秘密项、三项全中进入英雄胜利、作祟揭秘者不能破咒；已补事件符号房间自动不抽事件、不结算事件、不移动事件牌堆且不结束回合的最小领域链；已补作祟揭秘者选择当前事件牌堆事件给任意存活玩家作镜中提示，该事件不结算、不进弃牌堆、从事件牌堆放一边且每回合一次；已补镜中怪物最近目标移动 / 平手路径领域代表链。该结果仍不等于完整 7 号作祟实现，仍缺专属移动/目标选择 UI、E2E、截图和完整怪物回合组合 |
| 7 号作祟镜中怪物移动与攻击定向领域回归 | `firstScenarioRuntime.test.ts -t "镜中怪物"`：4 passed / 683 skipped | 镜中怪物移动目标按已发现房间连接图计算最短路径，只允许走向能缩短到最近可攻击探索者距离的相邻房间；距离平手时允许多个等距下一步，供作祟揭秘者裁决；已同房时不允许离开，且作祟揭秘者自身不作为移动/攻击目标。普通怪物攻击入口已读取 Mirror Being 默认攻击属性，使用神志投骰；对英雄造成伤害时写入 mental damage，待分配伤害只允许知识 / 神志，物理属性轨不扣减。该结果只覆盖领域代表链，不覆盖专属移动/目标选择 UI、E2E、截图或完整怪物回合组合 |
| 作祟公共规则定向领域回归 | `firstScenarioRuntime.test.ts -t "作祟风险\|交易转移预兆\|抽到新预兆\|作祟检定按全员\|普通预兆触发作祟\|抽到最后一张预兆"`：15 passed / 672 skipped | 覆盖作祟风险按所有玩家当前持有预兆总数派生、交易转移预兆后仍按全员总数而非当前玩家持有数派生、抽到新预兆时作祟检定骰数与风险读模型一致、作祟检定最多 8 骰、普通预兆触发作祟时记录剧本卡 / 触发预兆 / 翻牌确认队列，以及最后一张预兆自动触发作祟；该结果只证明公共规则代表链，不等于 9 张预兆逐卡效果全部闭合 |
| 本轮定向组件回归 | `Board.foundation.test.tsx -t "十字弓|枪|武器"`：8 passed / 123 skipped；`Board.foundation.test.tsx -t "角色选择阶段展示七张"`：1 passed / 131 skipped | 枪视线线、十字弓同板块/相邻目标且不画视线线、武器代表链通过；角色选择剧本候选弹窗显示 7 张候选并包含 `upon-reflection` 待接入项；该验证不是 E2E 或截图 |
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
| `evidence/betrayal/betrayal-discovery-effect-audit-2026-07-02.md` | 当前发现池物品/预兆逐卡合同 | 卡面原文、原子子句、已接运行态能力证据 | 只覆盖当前发现池和首剧本补充对象，不覆盖官方 22 物品全集 |
| `src/games/betrayal/possessionAtlas.ts` | 物品/预兆正面 atlas 映射 | 物品 frame、预兆 frame、alias | `partial`：存在复用 frame 与缺 crop |
| `temp/betrayal-possession-contract-crops/manifest.json` | 物品/预兆单卡裁图 manifest | 单卡裁图、frame、hash | `partial`：manifest 原始 21 行缺 `strange-amulet` 和 `lantern` crop；本轮已从正式 item atlas 补 `strange-amulet` 临时完整裁图；`map/notebook/journal/manuscript` 共用 frame/hash |
| `temp/betrayal-possession-contract-crops/item-strange-amulet-full.jpg` | 从正式物品 atlas frame 10 切出的完整单卡核对图 | 奇异护符标题、卡图、规则原文和 frame | `crop-ready`：sha256 `9e25d6048a0b59263723b09da1a467bafee3d69e3c1e08d29d25ad9680693728`；只作为 `temp/**` 录入核对图 |
| `temp/betrayal-possession-contract-crops/item-alias-review.jpg` | 从当前物品裁图生成的 alias 复核联系图 | 手电筒、地图、笔记本、日记、手稿复用关系 | `intake-helper`：证明 `map/notebook/journal/manuscript` 图面同为地图卡；不进入正式资源 |

## 3. 事件牌对象全集：43 / 43

说明：事件牌官方数量锁定为 43。当前合同用 `EVENT_FRONT_ATLAS` 的 frame `0-42` 作为 S0 对象槽位；当前 43 张配置事件标题已有代码 atlas 映射。E43「最深的壁橱」虽然不在旧 `tts-9x5-crop-manifest.json` 原始 `candidateCards` 中，但本轮已回原始事件 atlas 直接裁出 frame 42，确认它是真实事件正面，并已在该 manifest 追加 `gridAudit20260728` 全格扫描字段。原候选漏掉 frame 42 是裁图 manifest 生成口径问题。20 张已从 TTS 图包完整单卡裁图读出中文名与主要效果子句，并已进入 `scenarioConfig.ts` 事件配置和卡面映射；其中「轮到约拿了」「片刻希望」「游魂」「技术难点」已有最小运行/UI 或领域测试证据，新增配置事件定向回归另覆盖 20 张新增/补录事件的运行消费入口、9 张待选择事件的一个关键分支指令结算、一批自动分支的抽物品、属性写入和移动状态断言，以及失败伤害分支与剩余可配置分支代表链。配置池扩容和局部分支/状态补证仍不得冒充官方 43 张事件完整运行闭合。

| # | 中文名 / 槽位 | 英文名或原文名 | 类别 | 官方来源或真相源位置 | 规则原文或效果子句录入状态 | 素材 / atlas / 裁图 / frame 状态 | 当前配置/运行状态 | 能力 / 效果 / UI 后续 | 合同状态 | 阻塞原因与下一步最小解阻动作 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E01 | 标本剥制 | 未锁定 | 事件 | 事件录入合同 index 0；`discoveryAtlas.ts` frame 0；TTS CardID 37200 | `locked` | frame 0 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E02 | 不可能的房间 | 未锁英文名 | 事件 | TTS manifest frame 1 / CardID 37201；`card-01-r0c1-full.jpg` | TTS 图包已读：神志检定；4+ 抽取一张物品卡；0-3 受到一颗骰子的精神伤害 | frame 1 完整裁图存在；sha256 `422d4e1636e24819`；atlas 标题映射已补 | `in-config / min-branch-verified` | 已录入配置；新增配置事件回归覆盖 4+ 抽物品状态和 0-3 骰子精神伤害状态；仍缺 UI/组合测试 | `locked / partial` | S0 字段已锁且已入 `scenarioConfig.ts`；S1/S2 下一步是补 UI/组合承接 |
| E03 | 磁带播放器 | 未锁定 | 事件 | 事件录入合同 index 1；`discoveryAtlas.ts` frame 2；TTS CardID 37202 | `locked` | frame 2 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E04 | 大宅饿了 | 未锁定 | 事件 | 事件录入合同 index 2；`discoveryAtlas.ts` frame 3；TTS CardID 37203 | `locked` | frame 3 已映射 | `in-runtime` | 作祟 12 成功链只按现有代表链消费；完整剧本另审 | `locked` | 无 |
| E05 | 地狱蝙蝠 | 未锁英文名 | 事件 | TTS manifest frame 4 / CardID 37204；`card-04-r0c4-full.jpg` | TTS 图包已读：速度检定；4+ 放置到相邻板块；0-3 受到 1 点物理伤害 | frame 4 完整裁图存在；sha256 `a386cc7b99f5c9ce`；atlas 标题映射已补 | `in-config / min-branch-verified` | 已录入配置；已补 4+ 分支的相邻板块放置 pending 与玩家指令结算，并补 0-3 物理伤害状态断言；已补非相邻板块和未发现板块非法目标拒绝；仍缺 UI 可选目标展示和更多组合边界 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补 UI 承接和更多组合边界 |
| E06 | 电话铃声 | 未锁定 | 事件 | 事件录入合同 index 3；`discoveryAtlas.ts` frame 5；TTS CardID 37205 | `locked` | frame 5 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E07 | 吊死鬼 | 未锁定 | 事件 | 事件录入合同 index 4；`discoveryAtlas.ts` frame 6；TTS CardID 37206 | `locked` | frame 6 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E08 | 断手 | 未锁英文名 | 事件 | TTS manifest frame 7 / CardID 37207；`card-07-r0c7-full.jpg` | TTS 图包已读：可以选择承受 2 点物理伤害；若如此做，抽取一张物品卡 | frame 7 完整裁图存在；sha256 `fc8f5d6adf7bfc46`；atlas 标题映射已补 | `in-config / min-branch-verified` | 已录入配置；已补接受分支：承受 2 点物理伤害并抽取 1 张物品；已补拒绝分支不抽物品、不受伤且无事发生；仍缺伤害不足/死亡边界和 UI 确认承接 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补伤害不足/死亡边界与 UI 确认承接 |
| E09 | 嘎吱的木门 | 未锁定 | 事件 | 事件录入合同 index 5；`discoveryAtlas.ts` frame 8；TTS CardID 37208 | `locked` | frame 8 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E10 | 怪异的镜子 | Upon Reflection | 事件 | TTS manifest frame 9 / CardID 37209；`card-09-r1c0-full.jpg`；7 号作祟账本 `docs/games/betrayal/haunts/07-upon-reflection.md` | TTS 图包已读：作祟尚未开始时可作祟检定；5+ 翻开作祟 7 求生手册且无奸徒；0-4 获得 1 点神志；若不检定则抽取一张物品卡；7 号账本已锁公开/私密规则：作祟揭秘者秘密记录 Trait/Omen/Room，英雄可执行破咒，5+ 且三项全中英雄胜利，5+ 组合错误只给否定反馈，0-4 无反馈，事件符号房间不抽事件且不结束回合；Mirror Being 向最近探索者移动，距离平手由作祟揭秘者裁决，已同房时使用神志攻击并造成精神伤害 | frame 9 完整裁图存在；sha256 `9a740101c2e05328`；atlas 标题映射已补 | `in-config / min-branch-verified / haunt-7-min-domain-verified / mirror-hint-min-domain-verified / mirror-being-move-min-domain-verified / mirror-being-attack-min-domain-verified / partial` | 已录入配置；已补拒绝检定后抽取物品分支；已补接受检定 0-4 分支：获得 1 点神志并留在作祟前；已补接受检定 5+ 分支：进入 7 号无叛徒代表揭示态、当前玩家切到揭秘者左侧玩家、入口大厅放置镜中怪物；已补秘密组合领域状态、私密 playerView、`deal-secret-mirror-combination` 自动 resolved、破咒命令校验/执行/reducer/行动预算、破咒成功英雄终局；已补 7 号作祟中探索事件符号房间自动跳过事件牌且不结束回合；已补镜中提示最小领域链：作祟揭秘者每回合一次选择当前事件牌堆事件给存活玩家作提示，事件不结算、不进弃牌堆并从事件牌堆放一边；已补镜中怪物最近目标移动 / 平手路径领域代表链：只允许朝最近可攻击探索者缩短距离、平手允许多个等距路径、已同房不允许离开且不把作祟揭秘者作为目标；已补镜中怪物已同房时普通攻击按神志投骰并进入精神伤害分配 | `locked / partial / min-domain-verified` | S1/S2 最小领域补证已过；不得标完整实现。后续最小解阻为补专属移动/目标选择 UI、E2E、截图和完整怪物回合组合 |
| E11 | 花团锦簇 | 未锁英文名 | 事件 | TTS manifest frame 10 / CardID 37210；`card-10-r1c1-full.jpg` | TTS 图包已读：受到 1 点通用伤害；将探险者放置在任意地面或地下室板块；若温室已发现则必须放置在那里 | frame 10 完整裁图存在；sha256 `0029ac8b5fb7937f`；atlas 标题映射已补 | `in-config / min-branch-verified` | 已录入配置；已补通用伤害分配与放置到门厅的最小指令结算；已补上层非法、地下室合法、温室已发现时强制放置温室且拒绝其它地面板块；仍缺 UI 承接和更多组合测试 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补 UI 承接和更多组合测试 |
| E12 | 晦暗暴风夜 | 未锁英文名 | 事件 | TTS manifest frame 11 / CardID 37211；`card-11-r1c2-full.jpg` | TTS 图包已读：知识检定；4+ 获得 1 点神志；0-3 受到 1 点精神伤害 | frame 11 完整裁图存在；sha256 `e4638697e80534f9`；atlas 标题映射已补 | `in-config / min-branch-verified` | 已录入配置；新增配置事件回归覆盖 4+ 神志 +1 和 0-3 精神伤害状态断言；仍缺 UI/组合测试 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补 UI/组合承接 |
| E13 | 技术难点 | 未锁英文名 | 事件 | TTS manifest frame 12 / CardID 37212；`card-12-r1c3-full.jpg` | TTS 图包已读：将探险者放在下一楼层起始点；若已在地下室，则放到上层起始点并受到 1 点精神伤害 | frame 12 完整裁图存在；sha256 `1b0fe2cf63b7a4c5`；atlas 标题映射已补 | `in-config / min-branch-verified` | 已补新增事件解释器消费入口、下一楼层起始点移动，并补地下室 fallback 精神伤害组合：地下室探索后放到上层起始点且精神伤害 1；仍缺 UI 展示和更多楼层边界回归 | `locked / min-verified` | S1/S2 最小领域补证已过；后续最小解阻为补 UI 承接和更多楼层边界组合 |
| E14 | 佳馔满桌 | 未锁英文名 | 事件 | TTS manifest frame 13 / CardID 37213；`card-13-r1c4-full.jpg` | TTS 图包已读：知识或神志检定；5+ 获得 1 点速度；0-4 受到 1 点通用伤害 | frame 13 完整裁图存在；sha256 `0382dac399565e69`；atlas 标题映射已补 | `in-config / min-branch-verified` | 已录入配置；已补选择知识/神志成功后速度 +1 的最小指令结算，并补 0-4 失败通用伤害代表链；仍缺 UI 承接和组合测试 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补 UI 承接和组合测试 |
| E15 | 禁忌知识 | 未锁英文名 | 事件 | TTS manifest frame 14 / CardID 37214；`card-14-r1c5-full.jpg` | TTS 图包已读：神志检定；4+ 获得 1 点知识；2-3 获得 1 点知识并失去 1 点神志；0-1 受到两颗骰子的精神伤害 | frame 14 完整裁图存在；sha256 `2cef83257470174b`；atlas 标题映射已补 | `in-config / min-branch-verified` | 已录入配置；新增配置事件回归覆盖 4+ 知识 +1、2-3 知识 +1 / 神志 -1、0-1 骰子精神伤害状态断言；仍缺 UI/组合测试 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补 UI/组合承接 |
| E16 | 可怜的尤里克 | 未锁英文名 | 事件 | TTS manifest frame 15 / CardID 37215；`card-15-r1c6-full.jpg` | TTS 图包已读：神志检定；4+ 获得 1 点知识；0-3 受到 1 点精神伤害 | frame 15 完整裁图存在；sha256 `e7c5b5b1f3c2344e`；atlas 标题映射已补 | `in-config / min-branch-verified` | 已录入配置；新增配置事件回归覆盖 4+ 知识 +1 和 0-3 精神伤害状态断言；仍缺 UI/组合测试 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补 UI/组合承接 |
| E17 | 轮到约拿了 | 未锁英文名 | 事件 | TTS manifest frame 16 / CardID 37216；`card-16-r1c7-full.jpg` | TTS 图包已读：可以弃置任意一件非武器物品；若如此做获得 1 点神志；否则受到一颗骰子的精神伤害 | frame 16 完整裁图存在；sha256 `9282af69a4c0d494`；atlas 标题映射已补 | `in-config / min-verified` | 已接入非武器物品筛选、弃置选择、神志提升和精神伤害；仍需后续整事件池回归扩审 | `locked / min-verified` | 定向领域测试与 Board 物品选择测试已覆盖最小运行闭环；后续不再按 `not-in-runtime` 接续 |
| E18 | 秘密升降机 | 未锁英文名 | 事件 | TTS manifest frame 17 / CardID 37217；`card-17-r1c8-full.jpg` | TTS 图包已读：可以将自己放置在某个不同区域的任意一张板块上 | frame 17 完整裁图存在；sha256 `20a00e0139c93232`；atlas 标题映射已补 | `in-config / min-branch-verified` | 已录入配置；已补选择上层起始点并移动的最小指令结算；已补同区域和未发现板块非法目标拒绝；仍缺 UI 候选展示和更多组合测试 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补 UI 候选展示和更多组合测试 |
| E19 | 脑状食品 | 未锁定 | 事件 | 事件录入合同 index 6；`discoveryAtlas.ts` frame 18；TTS CardID 37218 | `locked` | frame 18 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E20 | 片刻希望 | 未锁英文名 | 事件 | TTS manifest frame 19 / CardID 37219；`card-19-r2c1-full.jpg` | TTS 图包已读：在你的板块上放置祝福标志物；同位置英雄进行所有属性检定时多投一颗骰子 | frame 19 完整裁图存在；sha256 `d1cb75f8dd637d77`；atlas 标题映射已补 | `in-config / min-verified` | 已接入祝福标志物、位置光环和属性检定加骰；仍需后续整事件池回归扩审 | `locked / min-verified` | 定向领域测试与 Board 房间祝福标记测试已覆盖最小运行闭环；后续不再按 `not-in-runtime` 接续 |
| E21 | 肉质苔癣 | 未锁定 | 事件 | 事件录入合同 index 7；`discoveryAtlas.ts` frame 20；TTS CardID 37220 | `locked` | frame 20 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E22 | 上古旧宅 | 未锁定 | 事件 | 事件录入合同 TTS 21；`discoveryAtlas.ts` frame 21；TTS CardID 37221 | `locked` | frame 21 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E23 | 神秘液体 | 未锁英文名 | 事件 | TTS manifest frame 22 / CardID 37222；`card-22-r2c4-full.jpg` | TTS 图包已读：可选择饮下并投 3 颗骰子；6 每项属性 +1；5 力量与速度 +1；4 知识与神志 +1；3 知识 +1 且力量 -1；2 知识与神志 -1；1 力量与速度 -1；0 每项属性 -1 | frame 22 完整裁图存在；sha256 `52027b242fa94594`；atlas 标题映射已补 | `in-config / min-branch-verified` | 已录入配置；已补拒绝路径不改变四属性；接受喝下后 0-6 全骰值属性变化已补领域断言；仍缺 UI 投骰承接和组合测试 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补 UI 投骰承接和组合测试 |
| E24 | 说“茄子”！ | 未锁定 | 事件 | 事件录入合同 index 9；`discoveryAtlas.ts` frame 23；TTS CardID 37223 | `locked` | frame 23 已映射 | `in-runtime` | 作祟 33 成功链只按现有代表链消费；完整剧本另审 | `locked` | 无 |
| E25 | 外星几何 | 未锁定 | 事件 | 事件录入合同 index 10；`discoveryAtlas.ts` frame 24；TTS CardID 37224 | `locked` | frame 24 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E26 | 无线电广播 | 未锁英文名 | 事件 | TTS manifest frame 25 / CardID 37225；`card-25-r2c7-full.jpg` | TTS 图包已读：投 2 颗骰子；3-4 获得 1 点知识；0-2 受到一颗骰子的精神伤害；脚注为可播放曲目提示 | frame 25 完整裁图存在；sha256 `cb577aef5a3bad35`；atlas 标题映射已补 | `in-config / min-branch-verified / footnote-contract-set` | 已录入配置；新增配置事件回归覆盖 3-4 知识 +1 和 0-2 骰子精神伤害状态断言；脚注裁定为玩家可见风味/音频提示，不改变事件检定、伤害或属性结算；正式音频/脚注 UI 仍未接 | `locked / partial` | S0 字段已锁；脚注不再阻塞领域规则代表链，后续最小解阻为补脚注展示或音频资源授权/接入与 UI 组合测试 |
| E27 | 小丑房间 | 未锁定 | 事件 | 事件录入合同 index 11；`discoveryAtlas.ts` frame 26；TTS CardID 37226 | `locked` | frame 26 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E28 | 小机器人 | 未锁定 | 事件 | 事件录入合同 index 12；`discoveryAtlas.ts` frame 27；TTS CardID 37227 | `locked` | frame 27 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E29 | 摇曳灯光 | 未锁英文名 | 事件 | TTS manifest frame 28 / CardID 37228；`card-28-r3c1-full.jpg` | TTS 图包已读：速度或力量检定；5+ 获得 1 点速度；0-4 受到一颗骰子的物理伤害 | frame 28 完整裁图存在；sha256 `e2df64be818b0638`；atlas 标题映射已补 | `in-config / min-branch-verified` | 已录入配置；已补选择速度/力量成功后速度 +1 的最小指令结算，并补 0-4 失败物理伤害代表链；祝福标记加骰代表链也已覆盖；仍缺 UI 承接和组合测试 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补 UI 承接和组合测试 |
| E30 | 咬一口！ | 未锁定 | 事件 | 事件录入合同 index 13；`discoveryAtlas.ts` frame 29；TTS CardID 37229 | `locked` | frame 29 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E31 | 夜幕众星 | 未锁定 | 事件 | 事件录入合同 index 14；`discoveryAtlas.ts` frame 30；TTS CardID 37230 | `locked` | frame 30 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E32 | 一罐器官 | 未锁英文名 | 事件 | TTS manifest frame 31 / CardID 37231；`card-31-r3c4-full.jpg` | TTS 图包已读：神志检定；4+ 抽取一张物品卡；0-3 失去 1 点力量 | frame 31 完整裁图存在；sha256 `f296dd2baa9eb082`；atlas 标题映射已补 | `in-config / min-branch-verified` | 已录入配置；新增配置事件回归覆盖 4+ 抽物品分支和 0-3 力量 -1 分支状态断言；仍缺 UI/组合测试 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补 UI 承接和组合测试 |
| E33 | 一抹鲜红 | 未锁定 | 事件 | 事件录入合同 index 15；`discoveryAtlas.ts` frame 32；TTS CardID 37232 | `locked` | frame 32 已映射 | `in-runtime` | 作祟 1 成功链只按现有代表链消费；完整剧本另审 | `locked` | 无 |
| E34 | 一瓶微尘 | 未锁定 | 事件 | 事件录入合同 index 16；`discoveryAtlas.ts` frame 33；TTS CardID 37233 | `locked` | frame 33 已映射 | `in-runtime` | 作祟 3 成功链只按现有代表链消费；完整剧本另审 | `locked` | 无 |
| E35 | 一声呼救 | 未锁英文名 | 事件 | TTS manifest frame 34 / CardID 37234；`card-34-r3c7-full.jpg` | TTS 图包已读：知识检定；4+ 将探险者放置在所在区域的任意板块；0-3 受到 1 点精神伤害 | frame 34 完整裁图存在；sha256 `6343c8474ebf0ff6`；atlas 标题映射已补 | `in-config / min-branch-verified` | 已录入配置；已补 4+ 分支中区域内板块放置到门厅的最小指令结算，并补 0-3 精神伤害状态断言；已补不同区域和未发现板块非法目标拒绝；仍缺 UI 承接和更多组合测试 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补 UI 承接和更多组合测试 |
| E36 | 一条秘密通道 | 未锁定 | 事件 | 事件录入合同 index 17；`discoveryAtlas.ts` frame 35；TTS CardID 37235 | `locked` | frame 35 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E37 | 一种怪异的感觉 | 未锁定 | 事件 | 事件录入合同 index 18；`discoveryAtlas.ts` frame 36；TTS CardID 37236 | `locked` | frame 36 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E38 | 游魂 | 未锁英文名 | 事件 | TTS manifest frame 37 / CardID 37237；`card-37-r4c1-full.jpg` | TTS 图包已读：可埋葬一件物品；若如此做获得 1 点任意属性；否则进行神志检定，4+ 抽取一张物品牌，0-3 受到 1 点通用伤害 | frame 37 完整裁图存在；sha256 `959d06db248bf5f4`；atlas 标题映射已补 | `in-config / min-verified` | 已接入埋葬物品、任意属性选择、神志检定、抽物品和通用伤害；仍需后续整事件池回归扩审 | `locked / min-verified` | 定向领域测试已覆盖接受/拒绝/抽物品/通用伤害最小运行闭环；后续不再按 `not-in-runtime` 接续 |
| E39 | 在你背后！ | 未锁定 | 事件 | 事件录入合同 index 19；`discoveryAtlas.ts` frame 38；TTS CardID 37238 | `locked` | frame 38 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E40 | 葬礼 | Funeral / 部分规则书示例名 | 事件 | 事件录入合同 index 20；`discoveryAtlas.ts` frame 39；TTS CardID 37239 | `locked` | frame 39 已映射 | `in-runtime` | 已有当前实现证据；新增消费者再审 | `locked` | 无 |
| E41 | 着火的人 | 未锁英文名 | 事件 | TTS manifest frame 40 / CardID 37240；`card-40-r4c4-full.jpg` | TTS 图包已读：神志检定；4+ 获得 1 点神志；2-3 将探险者放置在入口大厅；0-1 受到一颗骰子的物理伤害以及一颗骰子的精神伤害 | frame 40 完整裁图存在；sha256 `d480f71c06419dca`；atlas 标题映射已补 | `in-config / min-branch-verified` | 已录入配置；新增配置事件回归覆盖 4+ 神志 +1、2-3 移动到入口大厅、0-1 物理+精神双伤害状态断言；仍缺 UI/组合测试 | `locked / partial` | S0 字段已锁；S1/S2 下一步是补 UI/组合承接 |
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
| I02 | 恐怖玩偶 | 未锁英文名 | 物品 | 原始 item atlas frame 1；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-01-r0c1-full.jpg` | TTS 图包已读：你的每个回合可使用一次；可以使用恐怖玩偶重新投掷刚刚进行的属性检定的所有骰子 | item frame 1 已裁完整单卡；sha256 `a4006c186f6d59662c451fe8d553e67bec4a25a682aa18d2f6206216940c7a85`；atlas alias 已接 | `in-runtime / partial-mechanism-covered` | 已补最近属性检定全骰重掷入口：事件属性检定可回写原事件分支结算，房间回合末属性检定入口已开放；固定骰、攻击、作祟检定、作祟特殊行动属性检定不放行 | `locked` | S0 图包字段已锁；后续最小解阻为补作祟特殊行动属性检定的通用回滚快照后再评估是否放行 |
| I03 | 奇怪的药品（holy-water） | Strange Medicine | 物品 | 物品/预兆效果审计表；原始 item atlas frame 2 | `locked` | item frame 2；crop-ready | `in-runtime` | 当前能力合同已有证据；新增消费者再审 | `locked` | 内部 id 为 legacy alias，不影响当前 S0 |
| I04 | 镜子 | 未锁英文名 | 物品 | 原始 item atlas frame 3；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-03-r0c3-full.jpg` | TTS 图包已读：在你的回合内，可以埋葬此镜子；若如此做，治疗你的知识和神志 | item frame 3 已裁完整单卡；sha256 `fcb43814e5992d433e233d93da28e31c504d6270b72c852daf9ba8cae9631eeb`；atlas alias 已接 | `in-runtime / min-verified` | 已补主动埋葬治疗知识和神志的最小运行承接；后续仍需组合回归 | `locked` | S0 字段与最小效果已接；后续补更多伤害/治疗组合验证 |
| I05 | 急救包（medical-kit） | Medical Kit | 物品 | 物品/预兆效果审计表；原始 item atlas frame 4 | `locked` | item frame 4；crop-ready | `in-runtime` | 当前能力合同已有证据；新增消费者再审 | `locked` | 无 |
| I06 | 幸运硬币 | 未锁英文名 | 物品 | 原始 item atlas frame 5；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-05-r0c5-full.jpg` | TTS 图包已读：你的每个回合可使用一次；可以使用幸运硬币重新投掷刚刚进行的一项属性检定的所有空白骰子；重投结果中每有一个空白骰子，承受 1 点精神伤害 | item frame 5 已裁完整单卡；sha256 `a2661a7da513d14819a70d737667d5ff4db6bf0fef1ee1bbe6b58a45677f354c`；atlas alias 已接 | `in-runtime / combo-domain-verified / partial-ui` | 已补最近属性检定空白骰重掷入口：事件属性检定可重掷所有空白骰，重投后每个空白进入精神伤害分配；UI 目标层只允许选择空白骰；固定骰、攻击、作祟检定和作祟特殊行动属性检定不放行；已补倒塌房间回合末真实效果链组合：重投为非空白会回滚坠落并取消房间伤害，重投仍为空白会先分配幸运硬币精神伤害，再确认倒塌房间坠落伤害并推进下一玩家 | `locked` | S0 图包字段与 S1/S2 最小领域组合已锁；后续最小解阻为补 UI 承接、作祟/死亡保护等更多伤害分配组合回归 |
| I07 | 皮夹克 | 未锁英文名 | 物品 | 原始 item atlas frame 6；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-06-r0c6-full.jpg` | TTS 图包已读：无论何时你防御一次进攻时，多投掷一颗额外的骰子 | item frame 6 已裁完整单卡；sha256 `3669741d0d9bb9a5eddf1acbac13aaea7cfe4b6ea2a188b8e7f6156122d8858a`；atlas alias 已接 | `in-runtime / min-verified` | 已补防御攻击时额外 1 骰的最小运行承接；后续仍需更多攻击来源组合 | `locked` | S0 字段与最小效果已接；后续补攻击来源组合验证 |
| I08 | 牙齿项链 | 未锁英文名 | 物品 | 原始 item atlas frame 7；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-07-r0c7-full.jpg` | TTS 图包已读：在你的回合结束时，可以获得 1 点你选择的某项濒死属性 | item frame 7 已裁完整单卡；sha256 `3c2370c1a249401a0db7e32a2bc8c09f8265294e281da8c899097e85c42d7c7a`；atlas alias 已接 | `in-runtime / min-verified` | 已补回合结束触发、濒死属性筛选、选择后提升 1 步、跳过和非法属性拒绝；复用现有事件选择承接，不新增 Board/UI | `locked` | S0 字段与最小领域效果已接；后续补更多作祟/房间结束组合回归 |
| I09 | 手电筒（flashlight） | Flashlight | 物品 | 物品/预兆效果审计表；原始 item atlas frame 8 | `locked` | item frame 8；crop-ready | `in-runtime` | 当前能力合同已有证据；新增消费者再审 | `locked` | `lantern` 复用同 frame，见 alias 表 |
| I10 | 头戴耳机（radio） | Headphones | 物品 | 物品/预兆效果审计表；原始 item atlas frame 9 | `locked` | item frame 9；crop-ready | `in-runtime` | 当前能力合同已有证据；新增消费者再审 | `locked` | 内部 id 为 legacy alias，不影响当前 S0 |
| I11 | 奇怪的护身符（strange-amulet；代码名“奇异护符”） | 未锁英文名 | 物品 | `scenarioConfig.ts` 运行池；`possessionAtlas.ts` atlas alias；原始 item atlas frame 10；`item-strange-amulet-full.jpg` | TTS/atlas 图包已读：无论何时你受到物理伤害时，获得 1 点神志；通用伤害应用到物理或速度上的效果不算在内，对力量/速度属性的直接降低不算在内 | item frame 10 已从正式 atlas 裁完整单卡；sha256 `9e25d6048a0b59263723b09da1a467bafee3d69e3c1e08d29d25ad9680693728` | `in-runtime / min-domain-verified` | 已补“实际承受物理伤害后获得 1 点神志”的最小领域承接，并排除通用伤害分配到速度、速度属性直接降低两类误触发；仍缺触发 UI/日志提示和更多组合验证 | `locked` | S1/S2 最小领域补证已过；后续最小解阻为补 UI/日志提示、减伤/死亡保护/作祟伤害组合回归 |
| I12 | 胸针 | 未锁英文名 | 物品 | 原始 item atlas frame 11；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-11-r1c3-full.jpg` | TTS 图包已读：无论何时你受到物理或精神伤害时，你可以替换为承受通用伤害 | item frame 11 已裁完整单卡；sha256 `d2f8f52deaec13442770c78e08e3119dd8d6693753bc2812f5c7b5d976914f82`；atlas alias 已接 | `in-runtime / min-verified` | 已补待分配物理/精神伤害替换为通用伤害、未声明时仍按原伤害类型限制分配、日志记录；不新增 Board/UI | `locked` | S0 字段与最小领域效果已接；后续补更多伤害来源、减伤叠加和 UI 提示组合回归 |
| I13 | 枪 | 未锁英文名 | 物品 | 原始 item atlas frame 12；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-12-r1c4-full.jpg` | TTS 图包已读：武器；当你使用此枪进行攻击时，可以攻击视线内的任一目标；你和防御者分别以速度投骰；如果你失败了，你不承受伤害；每次攻击只能使用一把武器，且本回合不能交易已使用过的武器 | item frame 12 已裁完整单卡；sha256 `2d08669f25dca8844e7015fe832069841681aa0a359167ce1aec9d77105b7a5d`；atlas alias 已接 | `in-runtime / min-verified` | 已补速度攻击、视线目标、失败不反伤和本回合用后交易限制的最小运行承接；后续仍需更多目标/怪物组合 | `locked` | S0 字段与最小效果已接；后续补枪攻击 UI/领域组合回归 |
| I14 | 十字弓 | 未锁英文名 | 物品 | 原始 item atlas frame 13；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-13-r1c5-full.jpg` | TTS 图包已读：武器；当你使用十字弓进行攻击时，可以攻击位于你所在板块或某相邻板块的任一角色（探险者或怪物）；你和防御者分别以速度投骰；如果你失败了，你不承受伤害；每次攻击只能使用一把武器，且本回合不能交易已使用过的武器 | item frame 13 已裁完整单卡；sha256 `edfd5550c81550ebbf00f3b74bd3ae08207de836543182ad09189e0fe2ac0b2b`；atlas alias 已接 | `in-runtime / min-verified` | 已补速度攻击、同板块/相邻板块目标、失败不反伤和本回合用后交易限制的最小运行承接；明确不按视线武器处理 | `locked` | S0 字段与最小效果已接；后续补怪物目标和更多 UI 组合回归 |
| I15 | 骨制钥匙（lockpick-tool） | Skeleton Key | 物品 | 物品/预兆效果审计表；原始 item atlas frame 14 | `locked` | item frame 14；crop-ready | `in-runtime` | 当前能力合同已有证据；新增消费者再审 | `locked` | 内部 id 为 legacy alias，不影响当前 S0 |
| I16 | 神秘秒表 | 未锁英文名 | 物品 | 原始 item atlas frame 15；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-15-r1c7-full.jpg` | TTS 图包已读：在你的回合内，可以埋葬此秒表；若你如此做，在本回合结束后再进行一轮行动；你只能在作祟开始后使用此能力 | item frame 15 已裁完整单卡；sha256 `13d87c800b6cadc9bc80f3c3886d81897c6f35c8b346bc2afd7bdd089701f422`；atlas alias 已接 | `in-runtime / min-verified` | 已补作祟前禁用、作祟后埋葬、当前回合结束后额外行动一轮、未使用时正常交接的最小领域承接；未新增 Board/UI | `locked` | S0 字段与最小效果已接；后续补更多作祟/怪物回合/回合结束组合回归 |
| I17 | 地图（map） | Map | 物品 | 物品/预兆效果审计表；原始 item atlas frame 16 | `locked` | item frame 16；crop-ready | `in-runtime` | 当前能力合同已有证据；新增消费者再审 | `locked` | `notebook / manuscript / journal` 复用同 frame，不能重复计为独立 locked 官方牌 |
| I18 | 砍刀（hunting-knife） | Machete | 物品 | 物品/预兆效果审计表；原始 item atlas frame 17 | `locked` | item frame 17；crop-ready | `in-runtime` | 当前能力合同已有证据；新增攻击消费者再审 | `locked` | 内部 id 为 legacy alias，不影响当前 S0 |
| I19 | 电锯 | 未锁英文名 | 物品 | 原始 item atlas frame 18；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-18-r2c2-full.jpg` | TTS 图包已读：武器；当你使用电锯进行攻击时，将你的投骰数量增加一颗；每次攻击只能使用一把武器，且本回合不能交易已使用过的武器 | item frame 18 已裁完整单卡；sha256 `38ed8325c0a1c35d3578296fbd25e0bd7ff4de7bd95d67965247443e7adf711e`；atlas alias 已接 | `in-runtime / min-verified` | 已补攻击额外 1 骰和本回合用后交易限制的最小运行承接；后续仍需更多攻击来源组合 | `locked` | S0 字段与最小效果已接；后续补攻击组合回归 |
| I20 | 炸药 | 未锁英文名 | 物品 | 原始 item atlas frame 19；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-19-r2c3-full.jpg` | TTS 图包已读：武器；可以使用炸药来代替一次常规的攻击；若如此做，将炸药埋葬后，选择你所在的板块或相邻的板块；在所选板块上的每个人（探险者或怪物）必须进行一次速度检定：4+ 无事发生，0-3 受到 4 点物理伤害；该板块上的每个人都必须分别投骰并承受伤害；每次攻击只能使用一把武器 | item frame 19 已裁完整单卡；sha256 `cb7456d76090413f124fb59cf0af86ccb4a03451709398f33b73e767fa34307e`；atlas alias 已接 | `in-runtime / min-domain-verified` | 已补代替常规攻击、当前/相邻已发现板块目标、使用后埋葬、目标板块每名探索者/怪物分别速度检定、失败探索者进入 4 点物理伤害分配、失败怪物走通用怪物受伤后端的最小领域承接；未新增 Board/UI | `locked` | S1/S2 最小领域补证已过；后续最小解阻为补 UI 目标选择承接、更多怪物/作祟组合和特殊免疫边界回归 |
| I21 | 天使之羽 | 未锁英文名 | 物品 | 原始 item atlas frame 20；`temp/betrayal-asset-source-diagnostics-2026-07-28/item-20-r2c4-full.jpg` | TTS 图包已读：当你被要求进行一次属性检定时，可以埋葬此天使之羽来代替它；若如此做，选择一个 0-8 之间的数字，使用该数字作为被要求进行的投骰结果；仍可以应用相关属性加成，例如从预兆牌中获得的加值 | item frame 20 已裁完整单卡；sha256 `77de0a0a9c2d132920be72014579829e097d30845d773638fe12b1a25cc9e3f1`；atlas alias 已接 | `in-runtime / min-domain-verified` | 已补埋葬、0-8 结果选择、下一次非战斗属性检定投骰结果替代、属性加值叠加、固定骰不消费；后续仍缺真实 UI 数字选择承接、攻击/作祟检定边界扩审、额外骰是否属于“相关属性加成”的规则裁定 | `locked` | S1/S2 最小领域补证已过；后续最小解阻为补 UI 数字选择和更多组合验证 |
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
| 书本 | 知识检定 +1；每回合一次失去 1 点神志，并让下一次非战斗检定可用知识替换；战斗对攻不被替换 | `min-domain-verified / partial-ui` | 更多非战斗检定消费者、UI 提示和组合回归 |
| 狗 | 速度检定 +1；每回合一次可请求与 4 格内玩家交易任意数量物品/预兆；需要对方同意；沿用已用牌、刚收到牌等交易限制 | `min-domain-verified / partial-ui` | 交易 UI、更多距离/死亡/作祟状态组合回归 |
| 面具 | 速度检定 +1；每回合一次移动同板块其他探险者和怪物到已发现相邻板块；支持多目标分别指定目标板块；不能发现新板块 | `min-domain-verified / partial-ui` | 目标选择 UI、死亡目标/怪物回合等更多组合回归 |
| 头骨 | 知识检定 +1；探索者将要死亡前投 3 骰，4-6 阻止死亡并把所有属性调至濒死，0-3 正常死亡；兔脚可重掷该死亡保护骰 | `min-domain-verified / partial-ui` | 死亡保护 UI、更多致死来源和作祟终局组合回归 |
| 圣符 | 神志检定 +1；发现板块时可埋葬第一张板块并继续发现下一张，且不结算第一张板块效果；本回合刚获得时不能使用 | `min-domain-verified / partial-ui` | 探索 UI 承接、更多房间/事件/作祟探索组合回归 |
| 盔甲 | 物理伤害降低 1 点；不会阻挡通用伤害或直接属性降低；不能被通用主动使用入口误当成移动/属性加成 | `min-domain-verified / partial-ui` | 减伤提示 UI、更多伤害来源/死亡保护/作祟组合回归 |
| 雕像 | 力量检定 +1；发现事件符号板块时可选择不抽事件卡且不结算事件效果；不能在无事件符号或无雕像时声明跳过 | `min-domain-verified / partial-ui` | 探索 UI 承接、更多事件堆顺序/作祟探索组合回归 |
| 指环 | 神志检定 +1；只能作为攻击武器显式使用，双方改用神志对攻并造成精神伤害；未声明使用时不会自动改战斗属性 | `min-domain-verified / partial-ui` | 攻击 UI 承接、怪物/多武器/作祟攻击组合回归 |
| 匕首 | 只能作为攻击武器显式使用；使用时攻击者失去 1 点速度并额外投 2 颗骰，造成物理伤害；未声明使用时不会自动生效 | `min-domain-verified / partial-ui` | 攻击 UI 承接、速度濒死/多武器/死亡保护组合回归 |

### 5.1 作祟公共规则合同

| 公共规则 | 真相源位置 | 合同状态 | 运行/实现后续 |
| --- | --- | --- | --- |
| 抽到预兆后进行作祟检定 | 官方规则书 `betrayal-3e-rulebook-en.md:647,749`；当前规则口径按所有玩家当前持有预兆总数计算风险 | `min-domain-verified` | 已覆盖普通预兆抽取后进入作祟检定、记录来源预兆和翻牌确认队列；不归入单张预兆效果，仍缺 UI 承接和更多组合扩审 |
| 作祟检定骰数与所有玩家当前持有的预兆总数相关 | `docs/games/betrayal/full-rule-interaction-redesign.md` 与现有基础规则补证记录；用户本轮明确指定该口径 | `min-domain-verified` | 已覆盖全员当前持有预兆总数派生、交易转移预兆后仍按全员总数派生、抽到新预兆时骰数与风险读模型一致；死亡掉落等更多组合仍需扩审 |
| 作祟检定 5+ 开始作祟 | 官方规则书 `betrayal-3e-rulebook-en.md:749` | `min-domain-verified` | 已覆盖普通预兆 5+ 触发作祟并记录剧本卡、作祟揭秘者、叛徒/首玩家代表裁定和触发预兆来源；事件型作祟入口与 UI 承接仍需另审 |
| 作祟检定最多 8 骰 | 规则骰子上限口径；当前风险读模型和投骰入口共同消费 | `min-domain-verified` | 已覆盖全员当前持有 9 张预兆时请求总数为 9，但实际投 8 骰且发现详情显示 8 颗骰子 |
| 最后一张预兆若尚未作祟则自动触发作祟 | 官方规则书 `betrayal-3e-rulebook-en.md:755`；领域回归 `firstScenarioRuntime.test.ts -t "作祟风险\|交易转移预兆\|抽到新预兆\|作祟检定按全员\|普通预兆触发作祟\|抽到最后一张预兆"`：15 passed / 672 skipped | `min-domain-verified` | 已覆盖最后一张预兆抽取后不靠点数直接进入作祟、记录触发预兆与翻牌确认队列；仍缺 UI 承接和更多作祟组合扩审 |

## 6. S0 阻塞清单

| 阻塞项 | 覆盖对象 | 阻塞阶段 | 最小解阻动作 |
| --- | --- | --- | --- |
| 多张新增事件已从 TTS 图包读出、录入配置、补卡面映射并通过运行入口回归，但全分支仍需闭合 | E02/E05/E08/E10-E12/E14-E16/E18/E23/E26/E29/E32/E35/E41 等新增事件 | S1/S2 扩审 | 已通过 `新增配置事件` 定向回归并补一批自动分支状态断言、失败伤害分支代表链、成功属性分支和部分剩余可配置分支代表链；技术难点地下室 fallback 与一罐器官 4+ 抽物品已补；地狱蝙蝠、花团锦簇、秘密升降机、一声呼救房间目标合法性已补；怪异的镜子接受检定已补 0-4 神志 +1 分支、5+ 进入 7 号代表揭示态、秘密组合私密状态、破咒最小领域链、事件符号房间不抽事件不结束回合、镜中提示最小领域链、镜中怪物最近目标移动 / 平手路径领域代表链和镜中怪物同房神志攻击 / 精神伤害代表链；无线电广播脚注已裁定为展示/音频提示而非规则结算；下一步补剩余分支、7 号专属移动/目标选择 UI、E2E、截图和组合测试；未完成前只能称为 `in-config / partial` |
| 三张原 `not-in-runtime` 事件配置阻塞已解除 | E17「轮到约拿了」/ E20「片刻希望」/ E38「游魂」 | S1/S2 扩审 | 已补静态数据、handler、atlas 映射和最小测试证据；后续只作为整事件池逐张扩审对象，不再按 `not-in-runtime` 接续 |
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
| 7 号作祟后续队列 | 怪异的镜子触发的 7 号作祟 | 当前只允许维持 `representative / min-domain-verified` 合同；完整实现、UI、E2E、截图均不在本轮 | 把秘密组合、破咒、事件符号房间、镜中提示、镜中怪物移动和神志攻击分别保留为代表链；专属移动/目标选择 UI、完整怪物回合和截图验收继续标为后续阻塞 |
| 真正需要用户补充的阻塞 | 目前无 S0 图包缺失阻塞 | 暂不需要用户补图才能继续合同整理 | 若后续发现某张完整单卡裁图不可读、原文冲突或 atlas frame 对不上，再点名具体对象、路径和所需补源；当前不应泛泛要求用户重新给整包 |

### 6.2 物品 × 消费场景补证矩阵（2026-07-29）

本矩阵只归档现有 S0 合同、当前本地领域/组件测试证据和仍缺口；不把代表链外推为全组合完成，也不新增 Board/UI、E2E 或截图验收。

| 物品 | 已有消费场景证据 | 当前裁定 | 剩余缺口 / 下一步 |
| --- | --- | --- | --- |
| 魔法相机 | 作祟 setup、灰尘知识检定改用更高神志等现有领域证据 | `covered-by-existing-contract / consumer-review-on-change` | 新增摄影师、作祟或属性检定消费者时再审；不作为本轮缺图或导入阻塞 |
| 恐怖玩偶 | 最近属性检定全骰重掷；事件属性检定可回写原分支，房间回合末入口已开放 | `partial-mechanism-covered` | 作祟特殊行动属性检定仍缺通用回滚快照；固定骰、攻击、作祟检定保持不放行 |
| 奇怪的药品 | 埋葬并治疗当前探索者力量和速度 | `covered-by-existing-contract / consumer-review-on-change` | 新增治疗、交易、死亡保护消费者时再审 |
| 镜子 | 主动埋葬治疗当前探索者知识和神志 | `min-verified / partial-combo` | 更多伤害后治疗、回合时点和作祟状态组合仍需补证 |
| 急救包 | 埋葬治疗自己所有濒死属性；可治疗同板块另一位探索者；不同板块拒绝 | `covered-by-existing-contract / consumer-review-on-change` | 新增同房目标、死亡保护、交易限制消费者时再审 |
| 幸运硬币 | 最近属性检定空白骰重掷；空白精神伤害；倒塌房间回合末速度检定组合已补 | `combo-domain-verified / partial-ui` | UI 承接、作祟/死亡保护等更多伤害分配组合回归 |
| 皮夹克 | 防御攻击时额外 1 骰 | `min-verified / partial-combo` | 更多攻击来源、怪物攻击和作祟攻击组合仍需补证 |
| 牙齿项链 | 回合结束存在濒死属性时可选一项提升 1 步；非法选择拒绝；可跳过 | `min-verified / partial-combo` | 作祟回合、房间回合末和死亡保护相关结束回合组合仍需补证 |
| 手电筒 | 事件属性检定额外 2 骰；不能主动用作通用移动/属性加成 | `covered-by-existing-contract / consumer-review-on-change` | 新增事件属性检定消费者时再审 |
| 头戴耳机 | 精神伤害降低 1；不会阻挡知识属性直接降低 | `covered-by-existing-contract / consumer-review-on-change` | 更多精神伤害来源、减伤叠加和死亡保护组合仍需补证 |
| 地图 | 主动埋葬并放置到任意已发现房间；`notebook / journal / manuscript` 复用同 frame | `covered-by-existing-contract / duplicate-alias-guarded` | 新增地图移动消费者时再审；alias 不得重复计数为官方独立牌 |
| 奇异护符 | 实际承受物理伤害后神志 +1；排除通用伤害分配到速度和速度属性直接降低 | `min-domain-verified / partial-ui` | UI/日志提示、减伤/死亡保护/作祟伤害组合回归 |
| 胸针 | 物理或精神伤害可声明改成通用伤害；未声明仍按原类型限制分配 | `min-verified / partial-combo` | 更多伤害来源、减伤叠加和 UI 提示组合回归 |
| 枪 | 视线目标速度攻击；失败不反伤；本回合用后不可交易 | `min-verified / partial-combo` | 枪攻击 UI、怪物目标、视线边界和作祟攻击组合回归 |
| 十字弓 | 同板块或相邻板块速度攻击；失败不反伤；不按视线武器处理 | `min-verified / partial-combo` | 怪物目标、相邻边界和 UI 组合回归 |
| 兔脚 | 事件/房间/攻击/死亡保护等多类最近投骰重掷代表链已有覆盖 | `broad-domain-covered / consumer-review-on-change` | 新增骰子消费者必须逐项确认是否允许兔脚重掷，不能默认全开 |
| 骨制钥匙 | 可穿墙移动到已发现相邻板块；投到空白会埋葬；不能发现新房间 | `covered-by-existing-contract / consumer-review-on-change` | 新增墙体、门位、移动限制或作祟地图规则时再审 |
| 神秘秒表 | 作祟前禁用；作祟后埋葬并在当前回合结束后再行动一轮；未用正常交接 | `min-verified / partial-combo` | 更多作祟、怪物回合和结束回合组合回归 |
| 砍刀 | 显式作为攻击武器使用；攻击结果 +1；未声明不会自动生效；用后不可交易 | `covered-by-existing-contract / partial-combo` | 更多攻击来源、怪物攻击和多武器互斥组合回归 |
| 电锯 | 显式攻击时额外 1 骰；用后不可交易 | `min-verified / partial-combo` | 更多攻击来源、多武器互斥和怪物目标组合回归 |
| 炸药 | 代替常规攻击；当前/相邻已发现板块目标；埋葬；板块内每名探索者/怪物分别速度检定 | `min-domain-verified / partial-ui` | UI 目标选择、更多怪物/作祟组合和特殊免疫边界回归 |
| 天使之羽 | 埋葬后选择 0-8 作为下一次非战斗属性检定投骰结果；仍叠加属性加值；固定骰不消费 | `min-domain-verified / partial-ui` | UI 数字选择、攻击/作祟检定边界、额外骰是否属于相关属性加成的规则裁定 |

### 6.3 新增 / 补录事件分支补证矩阵（2026-07-29）

本矩阵只覆盖从旧运行池外补入或曾为缺口的 20 张事件；旧 23 张事件仍按各自已锁合同和“新增消费者再审”口径处理。矩阵中的 `min-verified` 只表示已有本地领域或组件代表链，不表示 UI/E2E/截图或所有组合完成。

| 事件 | 已有分支/场景证据 | 当前裁定 | 剩余缺口 / 下一步 |
| --- | --- | --- | --- |
| 不可能的房间 | 4+ 抽物品、0-3 骰子精神伤害均有状态断言 | `min-branch-verified / partial-ui` | UI/日志承接、抽物品牌堆边界、精神伤害减免/死亡保护组合 |
| 地狱蝙蝠 | 4+ 相邻板块放置、0-3 物理伤害、非相邻/未发现非法目标拒绝 | `min-branch-verified / partial-ui` | UI 可选目标展示、更多房间连接边界、伤害组合 |
| 断手 | 接受承受 2 点物理伤害并抽物品；拒绝无事发生 | `min-branch-verified / partial-ui` | 伤害不足、死亡保护、胸针/奇异护符/盔甲等伤害改写组合和 UI 确认 |
| 怪异的镜子 | 拒绝抽物品；0-4 神志 +1；5+ 进入 7 号代表揭示态；7 号秘密组合/破咒/事件符号跳过/镜中提示/镜中怪物移动与神志攻击均有最小领域链 | `haunt-7-representative / min-domain-verified / partial-ui` | 完整 7 号作祟、专属移动/目标选择 UI、E2E、截图、完整怪物回合组合 |
| 花团锦簇 | 通用伤害分配；地面/地下室放置；上层非法；温室已发现时强制温室 | `min-branch-verified / partial-ui` | UI 候选展示、温室/楼层更多边界、通用伤害组合 |
| 晦暗暴风夜 | 4+ 神志 +1；0-3 精神伤害 | `min-branch-verified / partial-ui` | UI/组合测试；精神伤害减免、死亡保护和属性上限边界 |
| 技术难点 | 下一楼层起始点移动；地下室 fallback 到上层起始点并承受 1 点精神伤害 | `min-verified / partial-ui` | UI 展示、更多楼层边界、精神伤害组合 |
| 佳馔满桌 | 知识/神志二选一检定；5+ 速度 +1；0-4 通用伤害代表链 | `min-branch-verified / partial-ui` | UI 承接、选择属性边界、通用伤害组合 |
| 禁忌知识 | 4+ 知识 +1；2-3 知识 +1 且神志 -1；0-1 双骰精神伤害 | `min-branch-verified / partial-ui` | UI/组合测试；直接属性降低、精神伤害减免和死亡保护边界 |
| 可怜的尤里克 | 4+ 知识 +1；0-3 精神伤害 | `min-branch-verified / partial-ui` | UI/组合测试；精神伤害减免、死亡保护和属性上限边界 |
| 轮到约拿了 | 非武器物品筛选、弃置选择、神志提升、拒绝后精神伤害 | `min-verified / partial-ui` | UI 选择承接、无非武器物品、死亡保护和交易限制组合 |
| 秘密升降机 | 不同区域任意已发现板块放置；同区域/未发现非法目标拒绝 | `min-branch-verified / partial-ui` | UI 候选展示、区域判定、作祟地图限制组合 |
| 片刻希望 | 房间祝福标记、同位置英雄属性检定加骰 | `min-verified / partial-ui` | UI 标记展示、祝福加骰与兔脚/恐怖玩偶/幸运硬币等重掷组合 |
| 神秘液体 | 拒绝路径；接受后 0-6 全骰值属性变化均有断言 | `min-branch-verified / partial-ui` | UI 投骰承接、属性上限/下限、死亡保护组合 |
| 游魂 | 埋葽物品获得任意属性；拒绝后神志检定；成功抽物品；失败通用伤害 | `min-verified / partial-ui` | UI 物品/属性选择、无物品边界、通用伤害组合 |
| 无线电广播 | 3-4 知识 +1；0-2 骰子精神伤害；脚注裁定为展示/音频提示而非规则结算 | `min-branch-verified / footnote-contract-set / partial-ui` | 脚注展示或音频资源接入授权；精神伤害组合 |
| 摇曳灯光 | 速度/力量二选一检定；5+ 速度 +1；0-4 物理伤害代表链；祝福加骰代表链 | `min-branch-verified / partial-ui` | UI 承接、选择属性边界、物理伤害组合 |
| 一罐器官 | 4+ 抽物品；0-3 力量 -1 | `min-branch-verified / partial-ui` | UI/组合测试；属性下限、死亡保护、抽物品牌堆边界 |
| 一声呼救 | 4+ 同区域任意板块放置；0-3 精神伤害；不同区域/未发现非法目标拒绝 | `min-branch-verified / partial-ui` | UI 候选展示、区域边界、精神伤害组合 |
| 着火的人 | 4+ 神志 +1；2-3 移动到入口大厅；0-1 物理+精神双伤害 | `min-branch-verified / partial-ui` | UI/组合测试；双伤害减免、死亡保护和入口大厅状态边界 |

### 6.4 预兆 / 作祟后续缺口矩阵（2026-07-29）

本矩阵承接 5.0 和 5.1：预兆逐卡效果已是本地领域代表链，作祟公共规则也已有最小领域代表链；这里仅拆剩余 UI/组合缺口，不重新录入牌名、原文或 atlas。

| 对象 / 公共规则 | 已有领域证据 | 当前裁定 | 剩余缺口 / 下一步 |
| --- | --- | --- | --- |
| 书本 | 知识检定 +1；每回合一次失去 1 点神志并让下一次非战斗检定可用知识替换；战斗对攻不替换 | `min-domain-verified / partial-ui` | UI 提示、更多非战斗检定消费者、濒死神志/死亡保护组合 |
| 狗 | 速度检定 +1；每回合一次 4 格内交易，需对方同意并沿用交易限制 | `min-domain-verified / partial-ui` | 交易 UI、距离边界、死亡/作祟状态、收到已用牌限制组合 |
| 面具 | 速度检定 +1；每回合一次移动同板块其他探索者和怪物到相邻已发现板块 | `min-domain-verified / partial-ui` | 多目标选择 UI、怪物回合、死亡目标、不能发现新板块边界 |
| 头骨 | 知识检定 +1；死亡前 3 骰保护；兔脚可重掷死亡保护骰 | `min-domain-verified / partial-ui` | 死亡保护 UI、更多致死来源、作祟终局和遗物掩埋组合 |
| 圣符 | 神志检定 +1；发现板块时可埋葬第一张板块并继续发现下一张；本回合刚获得不能用 | `min-domain-verified / partial-ui` | 探索 UI、房间/事件/作祟探索组合、刚获得限制边界 |
| 盔甲 | 物理伤害 -1；不阻挡通用伤害或直接属性降低 | `min-domain-verified / partial-ui` | 减伤提示 UI、物理伤害来源、死亡保护和作祟伤害组合 |
| 雕像 | 力量检定 +1；发现事件符号板块时可选择不抽事件且不结算事件效果 | `min-domain-verified / partial-ui` | 探索 UI、事件牌堆顺序、作祟探索和无事件符号拒绝组合 |
| 指环 | 神志检定 +1；显式作为攻击武器时双方用神志对攻并造成精神伤害 | `min-domain-verified / partial-ui` | 攻击 UI、怪物目标、多武器互斥、未声明不自动生效组合 |
| 匕首 | 显式作为攻击武器；使用时失去 1 点速度并额外 2 骰，造成物理伤害 | `min-domain-verified / partial-ui` | 攻击 UI、速度濒死/死亡保护、多武器互斥和怪物目标组合 |
| 抽到预兆后的作祟检定 | 抽新预兆进入作祟检定，记录来源预兆和翻牌确认队列 | `min-domain-verified / partial-ui` | 作祟风险 UI、翻牌确认 UI、事件型作祟入口组合 |
| 全员当前持有预兆总数 | 作祟风险按所有玩家当前持有预兆总数派生；交易转移后仍按全员总数 | `min-domain-verified / partial-ui` | 死亡掉落/遗物转移/搜尸/交易后风险 UI 组合 |
| 5+ 开始作祟 | 普通预兆 5+ 触发作祟并记录剧本卡、揭秘者、触发预兆 | `min-domain-verified / partial-ui` | 作祟揭示 UI、首玩家/叛徒裁定显示、更多剧本入口组合 |
| 最多 8 骰 | 全员持有 9 张预兆时请求总数为 9，但实际最多投 8 骰 | `min-domain-verified / partial-ui` | 骰数上限 UI 显示、更多超 8 风险组合 |
| 最后一张预兆自动作祟 | 最后一张预兆抽取后不靠点数直接进入作祟，记录触发预兆与翻牌确认队列 | `min-domain-verified / partial-ui` | 自动作祟 UI、作祟前最后一张被交易/死亡掉落后的组合扩审 |

## 7. 本轮禁止升级结论

- 当前配置池 `43 事件 / 22 物品 / 9 预兆` 只能证明对象数量进入配置；事件配置、物品 atlas 接线和卡面映射闭合不证明逐卡机制、UI 和测试完成。
- 当前事件 atlas 标题映射已覆盖 43 张配置事件，E43 frame 42 已由原始 atlas 锁定；但配置池扩到 43 张仍不能替代机制/UI/测试闭合。
- 旧 E2E、旧截图和 `object-inventory.json` 只能证明当前运行池和首剧本代表链，不证明官方 74 张都 locked。
- 9 张预兆数量正确不等于整牌库完成，也不等于作祟公共规则无需审计；最后一张预兆自动作祟只完成公共规则最小领域补证，不替代 9 张预兆逐卡效果审计。
- 事件旧 TTS 9x5 manifest 的 42 个候选不能冒充官方 43 张事件全集，也不能反向否定原始 atlas 的 frame 42。
- 旧裁图 manifest 的 12 个物品行不能冒充官方 22 张物品全集；当前运行发现池已是 22 张官方物品，且官方运行物品覆盖唯一 item frame 0-21。`lantern/notebook/journal/manuscript` 仍是 legacy alias / duplicate-alias，不得重复计数为额外官方牌。

## 8. S0 停点与后续准入口径

1. 本轮 S0 合同层可以回答用户问题：图包不缺整牌库 atlas 素材，项目正式 atlas 与原始图包逐字节一致；旧缺口来自旧 manifest/旧运行池口径和后续机制承接，不是导入错。
2. 当前仍保持 `in_progress / blocked`，原因不是“缺 74 张对象行”，而是事件和物品有逐卡机制/UI/测试承接缺口；用户已授权继续消费已锁对象进入 S1/S2，但不得把对象级补证外推为整牌库完成。
3. 神秘秒表、牙齿项链、胸针、天使之羽、炸药、奇异护符、幸运硬币倒塌房间组合已有 S1/S2 最小领域补证；新增配置事件已完成一轮运行入口、部分关键分支、自动分支、失败伤害分支、成功属性分支和部分剩余可配置分支代表链补证，并追加覆盖技术难点地下室 fallback、一罐器官成功抽物品、怪异的镜子接受检定 0-4 / 5+ 代表入口、7 号作祟秘密组合私密状态、破咒最小领域链、事件符号房间不抽事件不结束回合、镜中提示最小领域链、镜中怪物最近目标移动 / 平手路径、镜中怪物同房神志攻击 / 精神伤害代表链、地狱蝙蝠/花团锦簇/秘密升降机/一声呼救房间目标合法性；无线电广播脚注已裁定为展示/音频提示而非规则结算；作祟公共规则已补全员当前持有预兆数、交易转移后总数、抽新预兆骰数、8 骰上限、普通预兆触发和最后一张预兆自动触发的最小领域回归；9 张预兆逐卡领域证据矩阵已补，但后续仍需处理其它剩余物品机制/UI 组合、新增事件剩余分支、7 号专属移动/目标选择 UI、预兆逐卡 UI 承接与组合测试；未闭合前这些继续作为合同阻塞清单保留。
4. 预兆继续保持两层账本：9 张预兆逐卡效果合同 + 作祟公共规则合同；作祟检定不能归并成某一张预兆自身效果。
