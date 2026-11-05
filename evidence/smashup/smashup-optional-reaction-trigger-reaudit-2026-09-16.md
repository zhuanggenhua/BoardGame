# Smash Up 可选响应触发提交后结算重审 2026-09-16

## 1. 基本信息

- 对象：Smash Up 正式能力注册中的所有 `optional: true` 触发。
- 日期：2026-09-16。
- 作者：Codex。
- 文档类型：audit / closeout。
- 关联反馈：`evidence/feedback-closeout/online-feedback-closeout-2026-09-15.md` 中 `sheep_in_sheeps_clothing` 响应提交后执行失败。
- 结论等级：`当前范围已收口`。
- 判定理由：本轮把审计维度从“响应窗口出现”补到“玩家或 AI 提交响应后，执行器结算、最终权威状态变化、队列和一次性标记清理”；按正式注册入口展开后，78 个注册 / 67 个唯一对象均已有提交后最终状态证据索引或本轮新增直接证据。

## 2. 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | TypeScript AST 展开 `src/games/smashup/abilities` 与 `src/games/smashup/domain` 中 `registerTrigger(..., { optional: true })`，含字符串常量、常量数组和 `for...of` 时机循环，结果 `registrations=78`、`unique=67`、`unresolved=0`。 |
| 真相源状态 | `passed` | 主真相源是当前工作树的正式注册入口；反馈原始事实见 2026-09-15 线上反馈 evidence；本轮不以临时搜索结果作为规则真相。 |
| 原子语义断言 | `passed` | 原子语义拆成 C1 触发进入触发队列、C2 决策者可发动或跳过、C3 提交命中当前触发、C4 后续执行入口结算、C5 最终权威状态变化、C6 流程收口且无残留。 |
| 实现消费链 | `passed` | 实现消费覆盖注册、候选生成、权限判断、`SYS_INTERACTION_RESPOND`、`maybeResolveReactionQueue`、`respondToPromptOption`、具体 handler / reducer、finalState 断言。 |
| 最终权威结果 | `passed` | 本轮新增 12 条直接 finalState 证据，另有 55 个对象已有提交后或共享最终状态证据索引。 |
| 交互真实入口 | `passed` | 证据覆盖响应选择的真实入口、`optionId` 命中当前触发、跳过/负向路径与后续二级选择窗口。 |
| 验证证据 | `passed` | 窄回归 10 个 Smash Up 测试文件全部通过：`10 passed`、`232 passed`；另跑过电锯专项 2 文件 `30 passed`。 |
| 共享影响与代表链依据 | `passed` | `sharedFlowId=smashup-optional-trigger-response-settlement` 仅复用响应入队与提交框架；对象最终状态仍按直接证据或已有对象索引逐项判定。 |
| 缺口分类与范围裁定 | `passed` | 旧缺口分类为审计维度缺口；本轮补规范、补 12 条直接证据，并修正 1 个真实同类归属问题。 |
| 旧 evidence / 旧结论对账回写 | `passed` | 2026-09-15 feedback evidence 的“不更新项目规范”判断由本文替代：本轮确认是项目级审计方法缺口，已更新两个 canonical-source。 |
| 残余范围声明 | `passed` | 当前范围只覆盖正式 `optional: true` 触发的提交后最终状态重审；非 optional 触发、全 Smash Up 规则语义全审、无关历史失败、提交推送部署均在本轮范围外。 |

## 3. 审计范围

- 本轮覆盖的游戏 / 模块 / 对象：Smash Up；`src/games/smashup/abilities` 与 `src/games/smashup/domain` 中正式注册的可选触发。
- 本轮覆盖的规则子句或共享链路：可选触发 / 响应窗口在玩家或 AI 提交后的执行链，包括触发队列、响应入口、提交命中、handler / reducer、最终状态和清理。
- 本轮使用的目标入口 / 环境：Vitest 领域测试、响应窗口提交 helper、触发注册 AST 枚举、规范自检脚本。
- 明确不在本轮范围内的对象：全部非 optional 触发、全 Smash Up 所有卡牌语义重审、线上状态再次回写、提交、推送、部署。

## 4. 权威来源

- 主真相源：当前工作树正式注册入口 `registerTrigger(..., { optional: true })`。
- 对照源：2026-09-15 线上反馈 evidence、当前 Smash Up 能力测试、旧 Smash Up effect atom evidence。
- 关键规则原文 / 裁定：本轮裁定的不是单张卡牌规则文字，而是项目审计方法：可选响应不能停在“窗口出现”，必须追到提交后最终状态。
- 合同状态：`locked`。

## 5. 原子语义与实现消费

| 对象 | 原子语义断言 | 实现消费点 | 最终权威结果 | 真实入口 / 验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 12 个本轮补证对象 | C1-C6 全链：入队、可发动/跳过、提交命中、执行结算、finalState、流程收口无残留。 | 各对象注册入口、`maybeResolveReactionQueue`、`respondToPromptOption`、对应 ability handler / reducer。 | 移动、弃置、抽牌、额外行动额度、额外随从额度、入手、揭示埋葬牌、临时加力、一次性标记等最终状态。 | 本轮新增或更新的能力测试。 | 旧审计维度缺口，已补证。 | passed |
| 55 个已有证据对象 | C1-C6 全链逐项复核为已有提交后或共享最终状态证据索引。 | 当前注册入口与既有对象级测试 / evidence 对账。 | 对应对象已有 finalState 或对象索引证明，不再只停留在注册、按钮或队列存在。 | 既有 Smash Up 测试与 evidence 索引。 | 无新增实现阻塞。 | passed |
| `diy_killers_chainsaw` | 电锯是附着行动；响应权现实上属于电锯来源控制者，不属于被消灭随从事件玩家。 | `src/games/smashup/abilities/diy_killers.ts` 的注册选项增加 `playerContext: 'sourceController'`；`triggerCanTriggerAlignment.test.ts` 同步从来源控制者身份收集。 | 响应后宿主移动到玩家选择的基地，附着行动仍跟随宿主；选择权给来源控制者。 | `diy-killers.test.ts` 电锯响应提交测试、`triggerCanTriggerAlignment.test.ts` Chainsaw queue alignment。 | 语义不一致，已修复。 | passed |

## 6. 本轮新增直接证据

| 对象 | 新增 / 更新测试证据 | 直接证明的最终权威状态 |
| --- | --- | --- |
| `sheep_in_sheeps_clothing` | `promos-sheep-all-stars.test.ts`：羊皮狼响应同基地随从移走。 | 宿主随从移动到目标基地，附着行动进入弃牌堆。 |
| `ancient_incas_child_of_the_sun` | `ancient-incas.test.ts`：太阳之子响应提交。 | 行动额度 +1，同回合已触发标记写入，重复触发被挡住。 |
| `mermaids_shipwreck_cove_pod` | `mermaids.test.ts`：POD 沉船湾响应提交。 | 持续行动从原基地移到目标基地。 |
| `beauty_and_the_beast_break_the_curse` | `disney-factions-abilities.test.ts`：打破诅咒从弃牌后响应提交。 | 从弃牌堆作为特殊额外行动打出，并给目标基地己方角色 +1。 |
| `lion_king_circle_of_life` | `disney-four-factions.test.ts`：生命的循环响应提交。 | 授予力量不超过 3 的额外角色额度，强度超限角色被拒绝，合格角色可打出。 |
| `ancient_egyptians_pharaoh_pod` | `ancient-egyptians.test.ts`：POD 法老计分前响应提交。 | 埋葬牌翻开后进入基地，选择权保持给来源控制者。 |
| `diy_killers_leatherface` | `diy-killers.test.ts`：人皮脸响应提交。 | 弱随从被消灭，本回合已发动标记写入。 |
| `diy_killers_chainsaw` | `diy-killers.test.ts` 与 queue alignment：电锯响应提交。 | 宿主移动到选择基地；响应决策者改为来源控制者。 |
| `rock_stars_hot_venue` | `what-were-we-thinking.test.ts`：火热场地回合结束响应提交。 | 控制者抽 1 张牌，触发队列清理。 |
| `explorers_crypt_looter` | `what-were-we-thinking.test.ts`：古墓掠夺者响应提交。 | 写入只限自身、只限新基地的额外随从额度。 |
| `nightmare_before_christmas_zero` | `disney-factions-abilities.test.ts`：Zero 计分后响应提交。 | Zero 从基地回到拥有者手牌，触发队列清理。 |
| `russian_fairy_tales_the_birch_woman` | `russian-fairy-tales.test.ts`：白桦木女神响应提交。 | 白桦木从牌库进入手牌，牌库移除该牌。 |

## 7. 共享影响与残余范围

| sharedFlowId | 流程职责 | 一次性审计证据 | 流程不变量 | 允许配置差异 | 失效影响面 |
| --- | --- | --- | --- | --- | --- |
| `smashup-optional-trigger-response-settlement` | 可选触发进入响应选择，并在玩家或 AI 提交后交给对象执行器。 | AST 展开 78 个注册 / 67 个唯一对象；窄回归 10 文件 232 条测试通过；12 条新增直接 finalState 证据。 | 触发时机正确、候选生成正确、权限判断正确、payload / command 命中当前 trigger、执行入口调用对象 handler、最终权威状态落地、清理语义完成、AI 或自动推进不抢阶段。 | 对象 ID、数值、目标集合、二级选择窗口、最终权威状态类型可以不同；差异必须由对象测试或已有 evidence 索引覆盖。 | 若入队、响应提交或清理框架再出问题，最小重审范围仍是正式 `optional: true` 注册全集。 |

| 本对象 | 独立语义结论 | sharedFlowId | 一致性核对 | 剩余差异 | 是否需要直测 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 67 个唯一对象 | 可选响应窗口提交后不再只靠按钮或队列证明；每个对象至少落到已有 finalState 索引或本轮直接测试。 | `smashup-optional-trigger-response-settlement` | 触发时机 / 候选生成 / 权限判断 / payload / command 结构 / 执行入口 / 最终权威状态 / 清理语义均已对账。 | 无当前范围内剩余差异。 | 12 个本轮直测；55 个复用已有对象索引。 | passed |

判等依据：代表对象是本轮 12 个新增直接证据对象；其余 55 个对象只复用“响应入队与提交框架”，不是复用单张卡牌结果。仅配置不同的部分是对象 ID、时机、目标集合、数值和最终状态类型；一旦对象引入新的最终权威状态，就按直接测试或旧 evidence 对象索引覆盖。

## 8. 同类扩审记录

- 搜索范围：`src/games/smashup/abilities`、`src/games/smashup/domain`、`src/games/smashup/__tests__`、`evidence/smashup`、`evidence/feedback-closeout`。
- 搜索了什么：正式 `registerTrigger(..., { optional: true })` 注册、`sourceDefIds` 定点触发、`maybeResolveReactionQueue` 响应入口、`respondToPromptOption` 提交入口、`finalState` 断言、旧 effect atom evidence 中的同类记录。
- 根因关键词：可选触发、响应窗口、提交后执行、最终权威状态、清理语义、来源控制者、事件玩家。
- 扩审范围：78 个正式注册、67 个唯一对象；其中 12 个本轮补直接证据，55 个已有提交后或共享最终状态证据索引。
- 命中项：`diy_killers_chainsaw` 的响应决策者归属错误，已修正到来源控制者。
- 漏审归因：旧审计的证据停在中间态，能看到响应窗口和队列，但没有强制追到提交后的执行器、最终权威状态和清理语义；同时审计对象没建全集，只从反馈对象扩出去查 import / builder，没有按正式 optional trigger 注册全集建立最小受影响对象集。

## 9. 对象全集

| 对象 | 注册入口 | 覆盖方式 | 当前裁定 |
| --- | --- | --- | --- |
| `anansi_tales_mboro_hornet` | `src/games/smashup/abilities/anansi_tales.ts:1550` | 已有提交后或共享最终状态证据索引 | passed |
| `anansi_tales_onini_the_python` | `src/games/smashup/abilities/anansi_tales.ts:1543` | 已有提交后或共享最终状态证据索引 | passed |
| `ancient_egyptians_mummy` | `src/games/smashup/abilities/ancient_egyptians.ts:99` | 已有提交后或共享最终状态证据索引 | passed |
| `ancient_egyptians_mummy_pod` | `src/games/smashup/abilities/ancient_egyptians.ts:106` | 已有提交后或共享最终状态证据索引 | passed |
| `ancient_egyptians_pharaoh` | `src/games/smashup/abilities/ancient_egyptians.ts:113` | 已有提交后或共享最终状态证据索引 | passed |
| `ancient_egyptians_pharaoh_pod` | `src/games/smashup/abilities/ancient_egyptians.ts:120` | 本轮补直接证据 | passed |
| `ancient_incas_child_of_the_sun` | `src/games/smashup/abilities/ancient_incas.ts:741` | 本轮补直接证据 | passed |
| `ancient_incas_fortress_walls` | `src/games/smashup/abilities/ancient_incas.ts:735` | 已有提交后或共享最终状态证据索引 | passed |
| `ancient_incas_royal_highway` | `src/games/smashup/abilities/ancient_incas.ts:758` | 已有提交后或共享最终状态证据索引 | passed |
| `ancient_incas_temple_of_the_sun` | `src/games/smashup/abilities/ancient_incas.ts:729` | 已有提交后或共享最终状态证据索引 | passed |
| `base_enchanted_castle` | `src/games/smashup/abilities/beauty_and_the_beast.ts:941` | 已有提交后或共享最终状态证据索引 | passed |
| `base_jungle_paradise` | `src/games/smashup/abilities/disney_four_factions.ts:2095`, `:2103` | 已有提交后或共享最终状态证据索引 | passed |
| `bear_cavalry_major_ursa` | `src/games/smashup/abilities/titans.ts:6076`, `:6086` | 已有提交后或共享最终状态证据索引 | passed |
| `beauty_and_the_beast_break_the_curse` | `src/games/smashup/abilities/beauty_and_the_beast.ts:870` | 本轮补直接证据 | passed |
| `beauty_and_the_beast_discover_the_library` | `src/games/smashup/abilities/beauty_and_the_beast.ts:870` | 已有提交后或共享最终状态证据索引 | passed |
| `beauty_and_the_beast_enchanted_objects` | `src/games/smashup/abilities/beauty_and_the_beast.ts:919` | 已有提交后或共享最终状态证据索引 | passed |
| `beauty_and_the_beast_ever_a_surprise` | `src/games/smashup/abilities/beauty_and_the_beast.ts:870` | 已有提交后或共享最终状态证据索引 | passed |
| `beauty_and_the_beast_petals_of_the_rose` | `src/games/smashup/abilities/beauty_and_the_beast.ts:929` | 已有提交后或共享最终状态证据索引 | passed |
| `cowboys_sheriff` | `src/games/smashup/abilities/cowboys.ts:229` | 已有提交后或共享最终状态证据索引 | passed |
| `dinosaurs_fort_titanosaurus` | `src/games/smashup/abilities/titans.ts:5574` | 已有提交后或共享最终状态证据索引 | passed |
| `diy_clowns_mrs_clown` | `src/games/smashup/abilities/diy_clowns.ts:820` | 已有提交后或共享最终状态证据索引 | passed |
| `diy_killers_chainsaw` | `src/games/smashup/abilities/diy_killers.ts:1807` | 本轮补直接证据并修归属 | passed |
| `diy_killers_jason` | `src/games/smashup/abilities/diy_killers.ts:1777` | 已有提交后或共享最终状态证据索引 | passed |
| `diy_killers_leatherface` | `src/games/smashup/abilities/diy_killers.ts:1771` | 本轮补直接证据 | passed |
| `diy_killers_michael_myers` | `src/games/smashup/abilities/diy_killers.ts:1783` | 已有提交后或共享最终状态证据索引 | passed |
| `diy_killers_oh_no` | `src/games/smashup/abilities/diy_killers.ts:1790` | 已有提交后或共享最终状态证据索引 | passed |
| `explorers_crypt_looter` | `src/games/smashup/abilities/what_were_we_thinking.ts:2833` | 本轮补直接证据 | passed |
| `frankenstein_the_bride` | `src/games/smashup/abilities/titans.ts:5672` | 已有提交后或共享最终状态证据索引 | passed |
| `geeks_control_minion` | `src/games/smashup/abilities/geeks.ts:2569` | 已有提交后或共享最终状态证据索引 | passed |
| `geeks_cosplay` | `src/games/smashup/abilities/geeks.ts:2562` | 已有提交后或共享最终状态证据索引 | passed |
| `grimms_fairy_tales_the_frog_prince` | `src/games/smashup/abilities/grimms_fairy_tales.ts:884` | 已有提交后或共享最终状态证据索引 | passed |
| `ignobles_the_hill_that_strolls` | `src/games/smashup/abilities/titans.ts:5823` | 已有提交后或共享最终状态证据索引 | passed |
| `killer_plants_killer_kudzu` | `src/games/smashup/abilities/titans.ts:5656` | 已有提交后或共享最终状态证据索引 | passed |
| `lion_king_circle_of_life` | `src/games/smashup/abilities/disney_four_factions.ts:2090` | 本轮补直接证据 | passed |
| `lion_king_lion_cub` | `src/games/smashup/abilities/disney_four_factions.ts:2026` | 已有提交后或共享最终状态证据索引 | passed |
| `mermaids_shipwreck_cove` | `src/games/smashup/abilities/mermaids.ts:1257` | 已有提交后或共享最终状态证据索引 | passed |
| `mermaids_shipwreck_cove_pod` | `src/games/smashup/abilities/mermaids.ts:1264` | 本轮补直接证据 | passed |
| `munchkin_elves_fae_fighter` | `src/games/smashup/abilities/munchkin_elves.ts:457` | 已有提交后或共享最终状态证据索引 | passed |
| `nightmare_before_christmas_jack_skellington` | `src/games/smashup/abilities/nightmare_before_christmas.ts:857` | 已有提交后或共享最终状态证据索引 | passed |
| `nightmare_before_christmas_sandy_claws_costume` | `src/games/smashup/abilities/nightmare_before_christmas.ts:873` | 已有提交后或共享最终状态证据索引 | passed |
| `nightmare_before_christmas_zero` | `src/games/smashup/abilities/nightmare_before_christmas.ts:866` | 本轮补直接证据 | passed |
| `ninjas_invisible_ninja` | `src/games/smashup/abilities/titans.ts:5601`, `:5607`, `:5613` | 已有提交后或共享最终状态证据索引 | passed |
| `pirates_the_kraken` | `src/games/smashup/abilities/titans.ts:6204` | 已有提交后或共享最终状态证据索引 | passed |
| `rock_stars_hot_venue` | `src/games/smashup/abilities/what_were_we_thinking.ts:2759` | 本轮补直接证据 | passed |
| `russian_fairy_tales_go_see_my_sister` | `src/games/smashup/abilities/russian_fairy_tales.ts:1320` | 已有提交后或共享最终状态证据索引 | passed |
| `russian_fairy_tales_the_birch` | `src/games/smashup/abilities/russian_fairy_tales.ts:1335` | 已有提交后或共享最终状态证据索引 | passed |
| `russian_fairy_tales_the_birch_woman` | `src/games/smashup/abilities/russian_fairy_tales.ts:1328` | 本轮补直接证据 | passed |
| `shapeshifters_copycat` | `src/games/smashup/abilities/yuanhou.ts:2836` | 已有提交后或共享最终状态证据索引 | passed |
| `sheep_hello_dolly` | `src/games/smashup/abilities/sheep.ts:870` | 已有提交后或共享最终状态证据索引 | passed |
| `sheep_in_sheeps_clothing` | `src/games/smashup/abilities/sheep.ts:960` | 本轮补直接证据 | passed |
| `skeletons_gravestones` | `src/games/smashup/abilities/skeletons.ts:641`, `:648` | 已有提交后或共享最终状态证据索引 | passed |
| `skeletons_lord_of_bones` | `src/games/smashup/abilities/skeletons.ts:635` | 已有提交后或共享最终状态证据索引 | passed |
| `skeletons_returned_one` | `src/games/smashup/abilities/skeletons.ts:629` | 已有提交后或共享最终状态证据索引 | passed |
| `time_travelers_jumper` | `src/games/smashup/abilities/yuanhou.ts:2975` | 已有提交后或共享最终状态证据索引 | passed |
| `time_travelers_time_box` | `src/games/smashup/abilities/titans.ts:5843`, `:5849` | 已有提交后或共享最终状态证据索引 | passed |
| `tornados_category_5` | `src/games/smashup/abilities/titans.ts:5971` | 已有提交后或共享最终状态证据索引 | passed |
| `vampire_buffet_pod` | `src/games/smashup/abilities/vampires.ts:379` | 已有提交后或共享最终状态证据索引 | passed |
| `vampire_fledgling_vampire_pod` | `src/games/smashup/abilities/vampires.ts:429` | 已有提交后或共享最终状态证据索引 | passed |
| `vampire_mad_monster_party_pod` | `src/games/smashup/abilities/vampires.ts:403` | 已有提交后或共享最终状态证据索引 | passed |
| `vampire_the_count_pod` | `src/games/smashup/abilities/vampires.ts:252` | 已有提交后或共享最终状态证据索引 | passed |
| `vampires_ancient_lord` | `src/games/smashup/abilities/titans.ts:6106` | 已有提交后或共享最终状态证据索引 | passed |
| `werewolves_great_wolf_spirit` | `src/games/smashup/abilities/titans.ts:6124` | 已有提交后或共享最终状态证据索引 | passed |
| `world_champs_aramis` | `src/games/smashup/abilities/world_champs.ts:1678` | 已有提交后或共享最终状态证据索引 | passed |
| `world_champs_diva` | `src/games/smashup/abilities/world_champs.ts:1684` | 已有提交后或共享最终状态证据索引 | passed |
| `world_champs_mummy` | `src/games/smashup/abilities/world_champs.ts:1720` | 已有提交后或共享最终状态证据索引 | passed |
| `world_champs_sheriff` | `src/games/smashup/abilities/world_champs.ts:1690` | 已有提交后或共享最终状态证据索引 | passed |
| `wreck_it_ralph_sugar_rush_racer` | `src/games/smashup/abilities/wreck_it_ralph.ts:1630` | 已有提交后或共享最终状态证据索引 | passed |

## 10. 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞已审计 / 已收口口径 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| 旧审计停在响应窗口生成，没有把提交后的执行器和最终状态作为强制审计项 | 审计留档缺口 | 否 | 是 | 当前范围内，已补规范与 evidence | 更新项目审计主源并补本轮重审 evidence。 |
| `diy_killers_chainsaw` 响应决策者从事件玩家推导，现实上应为电锯来源控制者 | 语义不一致 | 是 | 是 | 当前范围内，已修复 | 注册增加 `playerContext: 'sourceController'`，同步 queue alignment 测试。 |
| 非 optional trigger、全卡牌规则语义、生产部署 | 非阻塞扩展 | 否 | 否 | 当前范围外 | 单独授权后另开范围。 |

## 11. 验证证据

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/diy-killers.test.ts src/games/smashup/__tests__/triggerCanTriggerAlignment.test.ts --configLoader native`
- 结果：`2 passed`，`30 passed`。
- 证明了什么：电锯响应权归属已改为来源控制者；人皮脸和电锯提交后 finalState 断言通过；同类 queue alignment 没有把无关对象入队。
- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/promos-sheep-all-stars.test.ts src/games/smashup/__tests__/abilities/ancient-incas.test.ts src/games/smashup/__tests__/abilities/mermaids.test.ts src/games/smashup/__tests__/abilities/disney-factions-abilities.test.ts src/games/smashup/__tests__/abilities/disney-four-factions.test.ts src/games/smashup/__tests__/abilities/ancient-egyptians.test.ts src/games/smashup/__tests__/abilities/diy-killers.test.ts src/games/smashup/__tests__/abilities/what-were-we-thinking.test.ts src/games/smashup/__tests__/abilities/russian-fairy-tales.test.ts src/games/smashup/__tests__/triggerCanTriggerAlignment.test.ts --configLoader native`
- 结果：`10 passed`，`232 passed`。
- 证明了什么：本轮补证对象和相关同类测试在当前工作树通过；响应提交后最终权威状态、负向路径、跳过/强度限制、流程收口和无残留均有覆盖。
- 没有证明什么：没有证明非 optional 触发、全 Smash Up 规则语义、浏览器 UI 截图链、生产部署状态。

## 12. 修订或失效记录

- 旧文档路径：`evidence/feedback-closeout/online-feedback-closeout-2026-09-15.md`。
- 旧结论：当时写为“不更新项目规范”，认为只是对象级测试覆盖缺口。
- 失效原因：用户追问审计漏项后，本轮复盘确认缺的不是单对象测试数量，而是项目级审计维度没有把“响应提交后最终权威状态”作为可选触发的最低收口项。
- 替代旧结论的新证据：`.spec/knowledge/standards/description-to-implementation-audit.md` 与 `.spec/knowledge/standards/regression-closeout.md` 已加入可选触发 / 响应窗口提交后最终状态与正式注册入口全集展开要求；本文记录 78 / 67 同类重审。
- 新结论：是审计维度漏审；本轮已更新项目级规范，并完成当前锁定范围的针对性重审。
- 是否需要修改旧文档正文中的误导行：已在旧 feedback evidence 中追加 2026-09-16 后续回写说明。

## 13. 对外汇报口径

- 允许说：这次确实是审计漏项，具体漏的是可选响应提交后的最终状态维度；项目规范已更新；Smash Up 正式 optional trigger 同类范围 78 个注册 / 67 个唯一对象已针对性重审；本轮补 12 条直接证据，并修复电锯响应权归属问题。
- 禁止说：全 Smash Up 所有规则都已重新审完、所有非 optional trigger 都已覆盖、已经提交推送部署、线上生产代码已更新。
