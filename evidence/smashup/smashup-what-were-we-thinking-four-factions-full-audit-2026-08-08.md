# Smash Up - What Were We Thinking? four-faction full audit evidence

## 1. 基本信息

- 对象：Smash Up / 大杀四方 `What Were We Thinking?` 四派系：Rock Stars、Teddy Bears、Grannies、Explorers。
- 日期：2026-08-08。
- 文档类型：`audit` / `closeout`。
- 关联范围：摇滚明星、泰迪熊、外婆、探险家的静态数据、资源、i18n、能力实现、基地实现、真实入口代表链。

## 2. 审计范围

- 本轮覆盖的文件：
  - `src/games/smashup/data/factions/what_were_we_thinking.ts`
  - `src/games/smashup/abilities/what_were_we_thinking.ts`
  - `src/games/smashup/__tests__/abilities/what-were-we-thinking.test.ts`
  - `src/games/smashup/__tests__/whatWereWeThinkingIntegration.test.ts`
  - `e2e/smashup/smashup-what-were-we-thinking-four-factions.e2e.ts`
  - `src/games/smashup/ui/factionMeta.ts`
- 本轮覆盖的卡牌 / 能力 / 模块：48 张唯一卡面、8 个基地、4 个派系元数据、正式卡牌图集和基地图集、Explorers titan 兼容初始化。
- 本轮覆盖的共享链路：
  - `SC-static-atlas-locale`：卡牌 / 基地定义 -> faction registry -> atlas manifest -> locale。
  - `SC-ability-registry`：`registerAbility` / `registerAbilityProgram` -> `invokeRegisteredAbilityContract` -> command/events -> `finalState`。
  - `SC-trigger-base`：`registerTrigger` / `registerBaseAbility` -> trigger/base pipeline -> prompt 或 events -> `finalState`。
  - `SC-simple-choice-ui`：`createAbilityRuntimeSimpleChoice` / prompt option -> `respondToPromptOption(s)` -> no residual interaction。
  - `SC-real-entry-e2e`：真实派系选择、真实选秀开局、`playCard`、prompt、skip、settled、atlas no shimmer。
- 明确不在本轮范围内的对象：生产部署、远端资源发布观察、非 `What Were We Thinking?` 派系回归。

## 3. 结论等级

结论等级：`当前发布口径已收口`。

判定理由：当前范围内 56 个对象都有对象全集行、规则子句行、实现入口、L0/L1/L2/L3/L4 分级及 D 维度；48 张卡和 8 个基地均有静态 / 资源 / locale 证据，所有带可执行语义的对象均有 L2 行为测试触达最终权威状态，真实入口 E2E 覆盖四派系选择、正式选秀开局、四类代表 prompt / skip / finalState 链路，并用共享链判等覆盖其余对象的同构 UI 入口。当前范围内无阻塞性残余。

## 4. 全面审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象全集 | `passed` | `WHAT_WERE_WE_THINKING_CARDS` 48 张唯一卡面 + `WHAT_WERE_WE_THINKING_BASES` 8 个基地，逐项矩阵见第 7 节。 |
| 规则子句表 | `passed` | 第 6 节按 C1 静态、C2 注册/消费、C3 主效果、C4 分支/负向、C5 生命周期拆分；第 7 节每个对象绑定 C 子句。 |
| 完整技能流程矩阵 | `passed` | 第 7 节记录触发前条件、执行入口、command/handler/reducer 消费、最终状态、后续清理及 UI 共享链。 |
| L0/L1/L2/L3/L4 证据层级 | `passed` | 第 8 节列出 L0-L4：对象全集、结构测试、领域行为、真实入口 E2E、治理收口。 |
| 命中 D 维度 | `passed` | 主要覆盖 D1/D2/D3/D5/D8/D11/D12/D14/D15/D21/D22/D23/D24/D31/D39/D45/D46/D47/D48/D52。 |
| 真实入口 E2E 与截图核验 | `passed` | 第 8.3 节记录真实入口 E2E、截图核验、optionId 点击、skip 按钮隐藏、no shimmer。 |
| 测试语义对账 / 旧测试失效检查 | `passed` | 第 8.2 节列出最终状态断言、负向断言、旧测试过窄风险对账；本轮没有保留被推翻断言。 |
| 同类扩审记录 | `passed` | 横向搜索范围覆盖四派系全部 defId、注册入口、触发入口、基地入口、E2E sourceId；共享调用点按 SC-* 登记。 |
| 分支/可选/数量边界 | `passed` | 空选、少选、skip、重复使用拒绝、保护不应被破坏、敌方不应受己方 buff、数量上限均有 L2 证据。 |
| 阶段/生命周期收口 | `passed` | prompt 后 `respondToPromptOption(s)` 进入 `finalState`，E2E `waitForNoInteraction`；triggerQueue/deferred/finalize 风险按 L4 归入共享链。 |
| 残余范围声明 | `passed` | 当前对象范围内无阻塞性残余；生产部署和远端运行观察是范围外操作。 |
| 旧 evidence / 旧结论对账回写 | `passed` | 旧 evidence `evidence/smashup/2026-07-14-what-were-we-thinking-intake-contract.md` 保持 intake/交付证据定位；本文件补充完整审计 closeout，不推翻旧结论。 |

## 5. 权威来源

- 主真相源：`src/games/smashup/data/factions/what_were_we_thinking.ts` 中的 48 张卡、8 个基地、count、power、breakpoint、VP、previewRef。
- 对照源：中英文 `public/locales/*/game-smashup.json` 结构化卡牌 / 基地文本；正式 atlas manifest；能力实现 `src/games/smashup/abilities/what_were_we_thinking.ts`。
- 关键规则原文 / 裁定：本轮以仓库已录入的 card/base structured locale 和 ability tests 为当前真相源；没有外部规则书改写输入。
- 图片合同表：正式图集由 integration test 校验 `mime`、`bytes > 0`、`SHA256`、根级与游戏级 manifest 一致；E2E 截图直接显示四派系预览、卡牌图加载、无 `.atlas-shimmer`。

### 5.1 图片合同表

| visualRegion / slotId | 图上对象 | 运行时对象 | 允许状态 | 是否可交互 | 结论 |
| --- | --- | --- | --- | --- | --- |
| card atlas index 0-11 | Rock Stars 12 cards | `ROCK_STARS_CARDS` slotMap 0-11 | preview / hand / board | 通过 shared card UI | 一致 |
| card atlas index 12-23 | Teddy Bears 12 cards | `TEDDY_BEARS_CARDS` slotMap 12-23 | preview / hand / board | 通过 shared card UI | 一致 |
| card atlas index 24-35 | Grannies 12 cards | `GRANNIES_CARDS` slotMap 24-35 | preview / hand / board | 通过 shared card UI | 一致 |
| card atlas index 36-47 | Explorers 12 cards | `EXPLORERS_CARDS` slotMap 36-47 | preview / hand / board | 通过 shared card UI | 一致 |
| base atlas index 0-7 | 8 bases | `WHAT_WERE_WE_THINKING_BASES` slotMap 0-7 | preview / active bases | 通过 shared base UI | 一致 |

## 6. 规则子句表

| 子句 | 含义 | 审计口径 |
| --- | --- | --- |
| C1 | 静态录入 | id、faction、type、subtype、power/count/breakpoint/VP、atlas index、locale 均与对象全集一致。 |
| C2 | 注册/共享消费 | 主动能力进 registry；持续、保护、限制、触发、基地进入对应 shared consumer。 |
| C3 | 主效果结算 | handler / program / base ability 产生 events，并经 reducer 到最终权威状态 `finalState`。 |
| C4 | 分支与负向 | skip、空选、少选、重复使用拒绝、目标过滤、保护、敌我边界、数量边界都有断言。 |
| C5 | 生命周期与 UI | prompt/option/response-window/base trigger 通过 shared UI 入口或真实 E2E 代表链收口，`sys.interaction.current` 不应残留。 |

## 7. 逐项结论

| 对象 | 规则子句 | 实现入口 | 共享链路 / 复用依据 | 命中维度 | 证据层级 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| `rock_stars_turn_up_to_11` | C1/C2/C3 | `getEffectiveBreakpoint` ongoing modifier consumer | `SC-static-atlas-locale` + ongoing breakpoint query | D1/D3/D22 | L1/L2/L3/L4 | passed |
| `rock_stars_reunion_tour` | C1/C2/C3/C4/C5 | `registerAbilityProgram(... onPlay)` | `SC-ability-registry` + discard selection prompt | D1/D5/D8/D24 | L1/L2/L3/L4 | passed |
| `rock_stars_total_sellout` | C1/C2/C3/C5 | `registerAbility(... special)` | `SC-ability-registry` + afterScoring draw finalState | D1/D8/D39 | L1/L2/L3/L4 | passed |
| `rock_stars_rock_of_luuv` | C1/C2/C3/C4/C5 | `registerAbilityProgram(... onPlay)` | `SC-real-entry-e2e` representative object, deck search prompt | D1/D5/D24/D47 | L1/L2/L3/L4 | passed |
| `rock_stars_guest_star` | C1/C2/C3/C5 | `registerAbilityProgram(... onPlay)` | groupie-search program; extra play limit asserted | D1/D5/D11/D12 | L1/L2/L3/L4 | passed |
| `rock_stars_tour_bus` | C1/C2/C3/C5 | `registerAbilityProgram(... onPlay)` | two-step base/minion movement prompt | D1/D5/D24 | L1/L2/L3/L4 | passed |
| `rock_stars_hot_venue` | C1/C2/C3/C5 | `registerTrigger(... onTurnEnd)` + power modifier | ongoing same-base power and turn-end draw | D1/D8/D14/D22 | L1/L2/L3/L4 | passed |
| `rock_stars_power_ballad` | C1/C2/C3/C5 | `registerAbility(... onPlay/special)` | temp power beforeScoring/onPlay shared ability | D1/D8/D22/D31 | L1/L2/L3/L4 | passed |
| `rock_stars_the_monarch` | C1/C2/C3/C5 | `registerAbilityProgram(... talent)` | groupie-search talent; no extra limit asserted | D1/D5/D11/D21 | L1/L2/L3/L4 | passed |
| `rock_stars_classic_rocker` | C1/C2/C3/C4/C5 | `registerAbilityProgram(... talent, validateUse)` | talent duplicate refusal and `talentUsed` finalState | D1/D5/D21/D23 | L1/L2/L3/L4 | passed |
| `rock_stars_rick_roll` | C1/C2/C3/C5 | `registerAbilityProgram(... onPlay)` | move-own-minion program; low breakpoint filter | D1/D2/D5/D24 | L1/L2/L3/L4 | passed |
| `rock_stars_groupie` | C1/C2/C3/C5 | `registerAbility(... onPlay)` | extra same-name minion limit | D1/D5/D11/D12 | L1/L2/L3/L4 | passed |
| `base_lake_minnetonka` | C1/C2/C3 | `registerBaseAbility(onMinionPlayed)` + `registerTrigger(onMinionMoved)` | base trigger temp power | D1/D8/D22/D45 | L1/L2/L3/L4 | passed |
| `base_palooza` | C1/C2/C3/C4/C5 | `registerBaseAbility(beforeScoring)` + handler | player queue prompt, skip and move finalState | D1/D5/D8/D39/D45 | L1/L2/L3/L4 | passed |
| `teddy_bears_square_deal` | C1/C2/C3 | `registerAbility(... onPlay)` | hand-count draw finalState | D1/D2/D3 | L1/L2/L3/L4 | passed |
| `teddy_bears_love_overload` | C1/C2/C3/C5 | `registerAbility(... special)` | beforeScoring destroy highest, protection respected | D1/D8/D22/D31 | L1/L2/L3/L4 | passed |
| `teddy_bears_group_hug` | C1/C2/C3/C5 | `registerAbilityProgram(... onPlay)` | minion buff prompt; enemy exclusion | D1/D2/D5/D22 | L1/L2/L3/L4 | passed |
| `teddy_bears_care_package` | C1/C2/C3 | `registerAbility(... onPlay)` | draw + extra minion limit | D1/D11/D12 | L1/L2/L3/L4 | passed |
| `teddy_bears_too_cute` | C1/C2/C3 | `registerProtection(... destroy)` | Love Overload protection negative assertion | D1/D22/D31 | L1/L2/L3/L4 | passed |
| `teddy_bears_bear_picnic` | C1/C2/C3/C4 | `registerRestriction(... play_minion)` | low-power play restriction; wrong-base path rejected | D1/D2/D15/D23 | L1/L2/L3/L4 | passed |
| `teddy_bears_cuddle` | C1/C2/C3 | `registerCardAbilitySuppression` | attached minion ability suppression | D1/D3/D31 | L1/L2/L3/L4 | passed |
| `teddy_bears_tea_party` | C1/C2/C3/C5 | `registerAbility(... talent)` | talent draw if base has enough minions and own minion | D1/D2/D5/D21 | L1/L2/L3/L4 | passed |
| `teddy_bears_sir_squeezes` | C1/C2/C3/C4/C5 | `registerAbilityProgram(... onPlay)` | `SC-real-entry-e2e` representative object, extra minion chooser + skip | D1/D5/D11/D24/D47 | L1/L2/L3/L4 | passed |
| `teddy_bears_lovey_bear` | C1/C2/C3 | printed-power/effective-power query | dynamic starting power vs opponent minion | D1/D3/D22 | L1/L2/L3/L4 | passed |
| `teddy_bears_fun_bear` | C1/C2/C3 | `registerTrigger(onMinionPlayed/onMinionMoved)` | power counter after other player enters base | D1/D8/D14/D22 | L1/L2/L3/L4 | passed |
| `teddy_bears_snuggly_bear` | C1/C2/C3/C5 | `registerTrigger(onMinionPlayed)` | first-minion extra same-name play limit | D1/D8/D11/D12 | L1/L2/L3/L4 | passed |
| `base_under_the_bed` | C1/C2/C3 | `registerTrigger(onMinionPlayed)` | immediate extra low-power minion limit | D1/D8/D11/D12 | L1/L2/L3/L4 | passed |
| `base_out_in_the_woods` | C1/C2/C3 | `registerBaseAbility(beforeScoring)` | base-wide temp power finalState | D1/D8/D22/D45 | L1/L2/L3/L4 | passed |
| `grannies_chicken_soup` | C1/C2/C3/C4/C5 | `registerAbility(... onPlay)` | discard-to-top/bottom prompt; empty selection path | D1/D5/D24 | L1/L2/L3/L4 | passed |
| `grannies_grannys_purse` | C1/C2/C3/C4/C5 | `registerAbility(... onPlay)` + handler | top action draw/play branch and extra action limit | D1/D5/D11/D24 | L1/L2/L3/L4 | passed |
| `grannies_always_room_at_grannys` | C1/C2/C3/C4/C5 | `registerAbility(... special)` | afterScoring own-minion top/bottom prompt, skip path | D1/D5/D8/D39 | L1/L2/L3/L4 | passed |
| `grannies_attic_treasures` | C1/C2/C3/C5 | `registerAbility(... onPlay)` | `SC-real-entry-e2e` representative object, hand multi-select -> draw | D1/D5/D24/D47 | L1/L2/L3/L4 | passed |
| `grannies_hush_my_stories_are_on` | C1/C2/C3 | `registerAbility(... onPlay)` | bottom-card draw and conditional extra minion limit | D1/D11/D12 | L1/L2/L3/L4 | passed |
| `grannies_family_reunion` | C1/C2/C3/C5 | `registerTrigger(onMinionPlayed)` | attached-base bottom reveal, minion/action branch | D1/D8/D24 | L1/L2/L3/L4 | passed |
| `grannies_dont_mess_with_my_babies` | C1/C2/C3/C4 | `registerProtection(destroy/move/affect/action)` | protect own minions from other-player cards | D1/D2/D22/D31 | L1/L2/L3/L4 | passed |
| `grannies_knitting_circle` | C1/C2/C3/C4/C5 | `registerAbility(... onPlay)` | action destruction count -> draw; empty selection path | D1/D5/D24/D31 | L1/L2/L3/L4 | passed |
| `grannies_matriarch` | C1/C2/C3 | `registerAbility(... talent)` | bottom two reveal, minion hand, non-minion discard | D1/D5/D21 | L1/L2/L3/L4 | passed |
| `grannies_granny` | C1/C2/C3/C5 | `registerAbility(... talent)` + handler | top/bottom prompt final deck order | D1/D5/D21/D24 | L1/L2/L3/L4 | passed |
| `grannies_nana` | C1/C2/C3/C4 | `registerAbility(... onPlay)` | top action draw/play branch; non-action bottom | D1/D5/D11/D24 | L1/L2/L3/L4 | passed |
| `grannies_grandma` | C1/C2/C3/C5 | `registerAbility(... onPlay)` + handler | top/bottom prompt final deck order | D1/D5/D24 | L1/L2/L3/L4 | passed |
| `base_grandmas_house` | C1/C2/C3/C5 | `registerBaseAbility(onMinionPlayed)` + handler | base top-card prompt final deck order | D1/D5/D8/D45 | L1/L2/L3/L4 | passed |
| `base_retirement_community` | C1/C2/C3/C4/C5 | `registerBaseAbility(afterScoring)` + handler | per-player queue, skip and top/bottom finalState | D1/D5/D8/D39/D45 | L1/L2/L3/L4 | passed |
| `explorers_idaho_smith` | C1/C2/C3/C4/C5 | `registerAbility(... onPlay)` | reveal new base, move self and optional own minion | D1/D5/D24/D45 | L1/L2/L3/L4 | passed |
| `explorers_guide` | C1/C2/C3/C4 | `registerTrigger(onMinionMoved)` | first own move temp power, second move no event | D1/D8/D14/D22 | L1/L2/L3/L4 | passed |
| `explorers_crypt_looter` | C1/C2/C3 | `registerTrigger(onBaseRevealed)` | base-reveal extra self minion limit | D1/D8/D11/D12 | L1/L2/L3/L4 | passed |
| `explorers_glory_hound` | C1/C2/C3/C5 | `registerAbility(... onPlay)` | base deck top/bottom choice final order | D1/D5/D24 | L1/L2/L3/L4 | passed |
| `explorers_lost_city` | C1/C2/C3/C5 | `registerAbility(... special)` | afterScoring base reveal choice + extra limit | D1/D5/D8/D39 | L1/L2/L3/L4 | passed |
| `explorers_you_call_this_archaeology` | C1/C2/C3/C5 | `registerAbility(... onPlay/special)` | two-stage own-minion move prompt | D1/D5/D24/D39 | L1/L2/L3/L4 | passed |
| `explorers_fortune_and_glory` | C1/C2/C3/C4/C5 | `registerAbility(... onPlay)` | source/destination/minion selection, empty selection path | D1/D5/D24 | L1/L2/L3/L4 | passed |
| `explorers_forgotten_horrors` | C1/C2/C3/C5 | `registerTrigger(onMinionPlayed/onMinionMoved)` | draw then move attached action prompt | D1/D8/D14/D24 | L1/L2/L3/L4 | passed |
| `explorers_it_belongs_in_a_museum` | C1/C2/C3/C5 | `registerAbility(... onPlay)` | two-minion swap prompt, final base membership | D1/D2/D5/D24 | L1/L2/L3/L4 | passed |
| `explorers_x_never_marks_the_spot` | C1/C2/C3/C5 | `registerAbility(... onPlay)` | `SC-real-entry-e2e` representative object, each-own-minion move prompt | D1/D5/D24/D47 | L1/L2/L3/L4 | passed |
| `explorers_i_said_no_camels` | C1/C2/C3/C4/C5 | `registerAbility(... onPlay)` | counter/draw branch choice; enemy not affected | D1/D2/D5/D22/D24 | L1/L2/L3/L4 | passed |
| `explorers_dr_livingstone_i_presume` | C1/C2/C3/C5 | `registerAbility(... onPlay)` | lone minion to owner deck finalState | D1/D2/D5/D24 | L1/L2/L3/L4 | passed |
| `base_ancient_temple` | C1/C2/C3 | `registerBaseAbility(onTurnStart)` | solo own minion +5 temp power | D1/D8/D22/D45 | L1/L2/L3/L4 | passed |
| `base_city_of_gold` | C1/C2/C3 | `registerBaseAbility(onTurnStart)` | own minion present -> VP finalState | D1/D8/D45 | L1/L2/L3/L4 | passed |

## 8. 验证证据

### 8.1 L1 结构证据

- 命令：`npm run test:structure`。
- 结果：passed。
- 结论：测试结构门禁通过。
- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/whatWereWeThinkingIntegration.test.ts --configLoader native`。
- 结果：`8/8 passed`。
- 覆盖：四派系 12 unique / 20 physical、48-slot row-major card atlas、8-slot base atlas、manifest `SHA256` / mime / bytes、Explorers titan 初始化、四派系取消 `implementationStatus: in_progress`、中英文 locale 非占位。

### 8.2 L2 领域行为证据

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/what-were-we-thinking.test.ts --configLoader native`。
- 结果：`61/61 passed`，Classic Rocker 负向用例包含预期 stderr。
- 结论：能力和基地行为均通过领域层测试，且测试断言落到 `finalState` / reducer 后状态，而不是只证明 prompt 出现。
- 测试语义对账：
  - 最终权威状态：hand/deck/discard/base minions/power counters/temp power/VP/limit modified/protection/trigger events 都有 finalState 或 applied events 断言。
  - 负向断言：Classic Rocker 二次 talent 被拒绝并返回“每回合只能使用一个经典摇滚客能力”；Too Cute 保护下 Love Overload 不应消灭受保护随从；Bear Picnic 不应允许低力量随从打到错误基地；Guide 第二次移动不会再给 temp power；敌方随从不应吃己方 buff/counter。
  - 分支/可选/数量边界：Chicken Soup 空选，Reunion Tour 选择 0 张，Fortune and Glory 空选，Knitting Circle 空选，Always Room at Granny's skip，Retirement Community skip，Sir Squeezes 总力量上限，Rock of Luuv 最多 3 张同名低力量，I Said No Camels counter/draw 分支。
  - 旧测试失效检查：本轮没有把只验证注册、只验证 prompt 存在、只验证 fixture id 出现的旧断言当作行为完成证据；对象级行为均要求最终状态或事件载荷。

### 8.3 L3 真实玩法证据

- 真实入口命令：
  - `$env:PW_E2E_SERVICE_REUSE='isolated'; node scripts/infra/run-e2e-single.mjs isolated e2e/smashup/smashup-what-were-we-thinking-four-factions.e2e.ts "派系选择页能看到摇滚明星、泰迪熊、外婆、探险家并加载新图集"` -> `1/1 passed`。
  - `$env:PW_E2E_SERVICE_REUSE='isolated'; node scripts/infra/run-e2e-single.mjs isolated e2e/smashup/smashup-what-were-we-thinking-four-factions.e2e.ts "真实选秀后可开局，并完成四派系代表能力链"` -> `1/1 passed`。
- 操作链路：
  - 四派系选择页逐个打开 detail panel，验证 released 状态、12 张 `faction-preview-card`、image `src`、无 `.atlas-shimmer`。
  - 真实选秀：P0 选 Rock Stars + Teddy Bears，P1 选 Grannies + Explorers，进入手牌区域并通过 state 确认 factions。
  - Rock Stars：`playCard('rock_stars_rock_of_luuv')` -> deck multi-select -> `waitForNoInteraction` -> hand/deck finalState。
  - Teddy Bears：`playCard('teddy_bears_sir_squeezes')` -> extra minion chooser -> “放弃这次额外随从”按钮可见后隐藏 -> base/hand finalState。
  - Grannies：`playCard('grannies_attic_treasures')` -> hand multi-select -> draw/bottom finalState。
  - Explorers：`playCard('explorers_x_never_marks_the_spot')` -> minion move options -> all selected minions moved -> no shimmer。
- 截图核验路径：
  - `D:\GA\BoardGame-sync-main-clean-20260808\test-results\evidence-screenshots\smashup\smashup-what-were-we-thinking-four-factions.e2e\派系选择页能看到摇滚明星、泰迪熊、外婆、探险家并加载新图集\01-我们到底在想什么-四派系选择页可见.jpg`
  - `D:\GA\BoardGame-sync-main-clean-20260808\test-results\evidence-screenshots\smashup\smashup-what-were-we-thinking-four-factions.e2e\真实选秀后可开局，并完成四派系代表能力链\02-摇滚明星-派系预览.jpg`
  - `D:\GA\BoardGame-sync-main-clean-20260808\test-results\evidence-screenshots\smashup\smashup-what-were-we-thinking-four-factions.e2e\真实选秀后可开局，并完成四派系代表能力链\03-外婆-派系预览.jpg`
  - `D:\GA\BoardGame-sync-main-clean-20260808\test-results\evidence-screenshots\smashup\smashup-what-were-we-thinking-four-factions.e2e\真实选秀后可开局，并完成四派系代表能力链\04-探险家-派系预览.jpg`
  - `D:\GA\BoardGame-sync-main-clean-20260808\test-results\evidence-screenshots\smashup\smashup-what-were-we-thinking-four-factions.e2e\真实选秀后可开局，并完成四派系代表能力链\05-泰迪熊-派系预览.jpg`
  - `D:\GA\BoardGame-sync-main-clean-20260808\test-results\evidence-screenshots\smashup\smashup-what-were-we-thinking-four-factions.e2e\真实选秀后可开局，并完成四派系代表能力链\06-我们到底在想什么-真实选秀开局完成.jpg`
  - `D:\GA\BoardGame-sync-main-clean-20260808\test-results\evidence-screenshots\smashup\smashup-what-were-we-thinking-four-factions.e2e\真实选秀后可开局，并完成四派系代表能力链\07-爱之摇滚-牌库选择中.jpg`
  - `D:\GA\BoardGame-sync-main-clean-20260808\test-results\evidence-screenshots\smashup\smashup-what-were-we-thinking-four-factions.e2e\真实选秀后可开局，并完成四派系代表能力链\08-爱之摇滚-检索入手后.jpg`
  - `D:\GA\BoardGame-sync-main-clean-20260808\test-results\evidence-screenshots\smashup\smashup-what-were-we-thinking-four-factions.e2e\真实选秀后可开局，并完成四派系代表能力链\09-挤挤爵士-额外手牌随从选择中.jpg`
  - `D:\GA\BoardGame-sync-main-clean-20260808\test-results\evidence-screenshots\smashup\smashup-what-were-we-thinking-four-factions.e2e\真实选秀后可开局，并完成四派系代表能力链\10-挤挤爵士-剩余额外随从可放弃.jpg`
  - `D:\GA\BoardGame-sync-main-clean-20260808\test-results\evidence-screenshots\smashup\smashup-what-were-we-thinking-four-factions.e2e\真实选秀后可开局，并完成四派系代表能力链\11-挤挤爵士-额外随从打出后.jpg`
  - `D:\GA\BoardGame-sync-main-clean-20260808\test-results\evidence-screenshots\smashup\smashup-what-were-we-thinking-four-factions.e2e\真实选秀后可开局，并完成四派系代表能力链\12-阁楼宝藏-手牌选择中.jpg`
  - `D:\GA\BoardGame-sync-main-clean-20260808\test-results\evidence-screenshots\smashup\smashup-what-were-we-thinking-four-factions.e2e\真实选秀后可开局，并完成四派系代表能力链\13-阁楼宝藏-置底抽牌后.jpg`
  - `D:\GA\BoardGame-sync-main-clean-20260808\test-results\evidence-screenshots\smashup\smashup-what-were-we-thinking-four-factions.e2e\真实选秀后可开局，并完成四派系代表能力链\14-X从不标记地点-移动目标选择中.jpg`
  - `D:\GA\BoardGame-sync-main-clean-20260808\test-results\evidence-screenshots\smashup\smashup-what-were-we-thinking-four-factions.e2e\真实选秀后可开局，并完成四派系代表能力链\15-X从不标记地点-全部移动后.jpg`
- 人工观察结论：截图链能看到四派系资源、真实选秀开局、prompt 选择中、选择后 settled 的棋盘状态；E2E 同时读取 `game.getState()` 核对 finalState。
- 代表链判等依据：
  - 共享链路 ID：`SC-real-entry-e2e`。
  - 代表对象：`rock_stars_rock_of_luuv`、`teddy_bears_sir_squeezes`、`grannies_attic_treasures`、`explorers_x_never_marks_the_spot`。
  - 判等依据：其余对象的 UI 入口只在 `sourceId`、候选过滤、数量上限、目标类型、最终事件 payload 上存在配置差异；实际入口均复用 shared `playCard`、`USE_TALENT`、base trigger、response-window/simple-choice overlay、optionId resolve、`waitForNoInteraction` 收口链。
  - 对象特有差异：特有语义由第 7 节逐对象 L2 finalState 行锁定；L3 代表链只复用共享 UI 容器、点击/选择/skip/settled 生命周期，不替代对象专属数值和过滤语义。

### 8.4 L4 治理证据

- 残余范围：当前 56 个对象范围内无阻塞性残余；生产部署、远端服务观察、全站 changed suite 运行时长控制不是当前规则正确性证据的一部分。
- 共享根因：无新增共享根因缺陷；本轮只把 release 状态、manifest 容错、E2E UI 稳定断言和 evidence closeout 补齐。
- 阶段/生命周期收口：beforeScoring / afterScoring / onTurnStart / onMinionPlayed / onMinionMoved 等高风险链路均至少有 L2 finalState；真实 UI representative chain 覆盖 prompt -> resolve -> `waitForNoInteraction`；triggerQueue/deferred/finalize 风险没有新增残留迹象。
- 旧 summary 降级：不需要；旧 intake contract 仍作为交付证据，本 closeout 是更高层级证据。

## 9. 禁止假阳性检查

- 是否误用“选择页 / 横幅 / 静态展示 E2E”充当玩法收口：否。选择页只支撑 release/atlas；玩法收口由 L2 finalState 和 L3 representative playCard 链共同支撑。
- 是否误用“测试里出现 id / registerAbility 覆盖”充当行为完整：否。注册测试只算 C2；对象行为均绑定 finalState、event payload、protection/restriction 或 trigger outcome。
- 是否误用“注入型 interaction E2E”充当真实入口玩法证据：否。E2E 先真实选秀开局，再用 `playCard` 走实际手牌入口；setupScene 只用于构造可控局面。
- 是否只证明 prompt 出现、未证明最终权威状态变化：否。E2E 每条代表链都有 prompt 前截图、settled 后截图和 `game.getState()` finalState 断言。

## 10. 共享根因与残余范围

- 共享根因项：无新增共享根因缺陷。
- 对象级局部问题：无阻塞项。
- 扩审范围：横向搜索覆盖 `rock_stars_`、`teddy_bears_`、`grannies_`、`explorers_`、`base_*` 在 data、ability、unit tests、integration tests、E2E 中的注册和消费。
- 当前范围边界：本证据覆盖仓库当前发布口径；生产部署和远端服务发布观察按部署流程另行执行。

## 11. 修订 / 失效记录

- 旧文档路径：`evidence/smashup/2026-07-14-what-were-we-thinking-intake-contract.md`。
- 旧结论：旧文档记录资源交付、静态接入和代表行为测试，是 intake / delivery contract。
- 失效原因：无新的失效项。
- 替代旧结论的新证据：本文件增加对象全集、规则子句矩阵、L0-L4 分层、完整技能流程矩阵、真实入口截图和 selfcheck。
- 新增回归 / 新增真实入口验证：本轮代码改动已补 integration 和 E2E release 断言；行为与真实入口验收命令见第 8 节。

## 12. 对外汇报口径

- 允许说：`What Were We Thinking? 四派系当前发布口径已收口，审计证据见 evidence/smashup/smashup-what-were-we-thinking-four-factions-full-audit-2026-08-08.md`。
- 允许说：`对象全集 48 张卡 + 8 个基地已有 L1/L2/L3/L4 分层证据；真实入口 E2E 有截图链和 finalState 断言`。
- 禁止说：`已经完成生产部署`、`已验证远端线上资源`、`全仓库 changed suite 本轮完整通过`。
