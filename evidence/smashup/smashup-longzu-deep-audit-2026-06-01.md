# SmashUp longzu 三派系对象级深审矩阵（2026-06-01）

## 结论等级

- 当前结论：`旧结论失效 / 仍有残余范围`
- 旧结论：本文原写法把 longzu 三派系表述为`当前发布口径已收口`，并把多个对象的 `shared` 代表链当作对象级完成证据。
- 失效原因：2026-07-18 复盘发现`角色扮演（geeks_cosplay）`旧 `shared:onVpAwarded triggered special` 只证明收到 VP 获得事件后能响应，不证明基地计分这类 VP 来源一定会派发该事件；“shared 已覆盖”口径过宽。2026-08-20 复盘又发现`粉丝（geeks_fan）`旧 `shared:hand special discard-for-draw` 只证明命令层可以直接激活，不证明普通打出与手牌 special 同时合法时，真实手牌入口会让玩家选择“打出 / 使用能力 / 取消或跳过”。
- 替代证据或替代入口：当前替代证据包括 `src/games/smashup/__tests__/abilities/geeks.test.ts` 中角色扮演对基地计分 VP 的定向回归，以及 `e2e/smashup/smashup-geeks-hand-special-and-minmaxing.e2e.ts` 中粉丝真实手牌入口三分支回归；本文档保留为历史矩阵和失效回写，不再单独作为全面收口凭证。
- 降级后当前状态：longzu 大部分对象仍有历史 L2/L3/L4 证据，但凡复用代表链的对象必须重新按“共享链名称 / 代表对象 / 六项判等依据 / 剩余差异”补齐；补齐前只能写`仍有残余范围`。
- 判定依据：
  - 本批对象全集已建表，覆盖龙、超级英雄、极客三派系全部 `38` 张卡与 `6` 个基地。
  - longzu 本轮新增的独立高风险交互 family 已全部补到 direct L3/L4，2026-06-02 复验结果为 `15 passed (4.0m)`。
  - 其余对象均已登记为“合法共享链复用”或“无玩家入口 / 自动结算对象”，并给出对应共享依据。
  - longzu 领域 L2 行为证据、L3/L4 真实入口证据、类型检查与基础接入门禁均已落地，可替代 implementation handoff 作为正式审计凭证。
  - 本次已把每个对象补到独立规则子句 `C1/C2/C3...` 行，并为 shared 对象逐项登记“共享链完全同构，仅配置不同”的复用依据。
- 本文档不再作为当前批次“审计完毕”的对象级权威证明；统一汇总版见 [smashup-longzu-audit-2026-06-01.md](/D:/gongzuo/webgame/BoardGame/evidence/smashup/smashup-longzu-audit-2026-06-01.md)，引用时必须同时带上本节降级说明。

## 审计范围

- 派系：龙、超级英雄、极客
- 卡牌：
  - 龙 `12`
  - 超级英雄 `13`
  - 极客 `13`
- 基地：
  - 龙之荒芜（`base_wyrms_desolation`）
  - 龙穴（`base_dragons_lair`）
  - 改造洞穴（`base_converted_cave`）
  - 水晶堡垒（`base_crystal_fortress`）
  - 桌游桌（`base_tabletop`）
  - 展会（`base_the_con`）
- 权威来源：
  - `public/assets/i18n/zh-CN/smashup/cards/longzu.png`
  - `public/assets/i18n/zh-CN/smashup/base/shayu.png`
  - [smashup-longzu-intake-contract-2026-05-31.md](/D:/gongzuo/webgame/BoardGame/evidence/smashup/smashup-longzu-intake-contract-2026-05-31.md)
  - [smashup-longzu-implementation-handoff-2026-06-01.md](/D:/gongzuo/webgame/BoardGame/evidence/smashup/smashup-longzu-implementation-handoff-2026-06-01.md)
- L2 证据：
  - `npx vitest run src/games/smashup/__tests__/abilities/dragons.test.ts src/games/smashup/__tests__/abilities/superheroes.test.ts src/games/smashup/__tests__/abilities/geeks.test.ts src/games/smashup/__tests__/longzuFactionPrep.test.ts src/games/smashup/__tests__/shayuFactionIntake.test.ts --configLoader native`
  - 结果：`5 files / 93 tests passed`
- L3/L4 证据：
  - `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-longzu-audit.e2e.ts`
  - 2026-06-02 复验结果：`15 passed (4.0m)`

## 2026-06-02 全面审计回写

- 用户指出项目 skill 已把“新增派系审计”默认提升为**全面审计**，不能只靠对象矩阵和代表链口头收口。
- 本次回写补齐了：
  - 每个对象的独立规则子句 `C1/C2/C3...`
  - 对象级 `L0/L1/L2/L3/L4` 层级
  - shared 对象的“共享链完全同构，仅配置不同”复用依据
- 因此 longzu 现有 evidence 已从“对象级矩阵 + 真实入口补证”升级为**新增派系全面审计格式**。

## shared / 无玩家入口 判定口径

- `direct`：本对象或本对象所在独立交互 family 已由 `smashup-longzu-audit.e2e.ts` 从真实入口打穿。
- `shared`：本对象与已验证对象共用同一 handler / interaction family / finalize 链，差异仅剩数值、目标过滤、图集索引或静态配置。
- `无玩家入口`：纯持续修正、被动触发、自动清理或自动结算对象，不新增独立玩家交互；以 L2 权威状态证据为主，必要时由同链 direct family 旁证系统收口。

## 命中维度口径

- `D1`：目标 / 范围 / 归属语义正确
- `D5`：交互完整，不能只停在 prompt 出现
- `D8`：时序、窗口、写入-消费顺序正确
- `D14`：回合 / 阶段清理完整
- `D18`：否定路径、跳过、无候选分支完整
- `D19`：组合场景、共享消费者并存时行为正确
- `D39`：流程控制标志、交互收口与后续推进完整
- `D50`：持续效果 / 持续压制 / 持续保护稳定性

## L1 通用声明

- 本批对象的 `L1` 静态合同已统一核对，通用落点如下：
  - 角色 / 行动静态定义：`src/games/smashup/data/factions/dragons.ts`、`src/games/smashup/data/factions/superheroes.ts`、`src/games/smashup/data/factions/geeks.ts`
  - 基地静态定义：`src/games/smashup/data/cards.ts`
  - 运行时注册入口：`src/games/smashup/abilities/dragons.ts`、`src/games/smashup/abilities/superheroes.ts`、`src/games/smashup/abilities/geeks.ts`
- 因此下方矩阵默认所有对象 `L1=有`；逐行主要展开 L2/L3/L4、适用维度与实现入口 / 共享链依据。

## 实现入口索引

| 入口族 | 主要实现落点 |
| --- | --- |
| `DG_FORCE_DISCARD_AFTER_PLAY` / `DG_BEFORE_SCORING_EXTRA_MINION_ON_BASE` / `DG_REPLACE_BASE_KEEP_MINIONS` / `DG_SEARCH_ACTION_FROM_DECK_OR_DISCARD_TO_BASE` | `src/games/smashup/abilities/dragons.ts` |
| `VP_BASE_MODIFIER` / `BASE_ABILITY_SUPPRESSION` | `src/games/smashup/abilities/dragons.ts` |
| `BASE_WYRMS_DESOLATION_POWER_MODIFIER` | `src/games/smashup/abilities/ongoing_modifiers.ts` |
| `BASE_DRAGONS_LAIR_AFTER_SCORING` | `src/games/smashup/domain/baseAbilities.ts` |
| `SH_MINION_SUPPRESSION_UNTIL_NEXT_TURN` / `SH_SELF_DESTROY_THEN_SEARCH_5PLUS` / `SH_DESTROY_OWN_MINION_SEARCH_STRICTLY_HIGHER` / `SH_MULTI_RECOVER_OR_DECK_BOTTOM` / `SH_EXTRA_MINION_POWERMAX` | `src/games/smashup/abilities/superheroes.ts` |
| `SH_DESTROY_PROTECTION` / `SH_ATTACHED_SUPPRESSION` | `src/games/smashup/abilities/superheroes.ts` |
| `BASE_CONVERTED_CAVE_DESTROY_PROTECTION` | `src/games/smashup/abilities/superheroes.ts` |
| `BASE_CRYSTAL_FORTRESS_RECOVER_TO_DECK_BOTTOM` | `src/games/smashup/domain/baseAbilities_expansion.ts` |
| `GK_ACTION_COUNTER_STACK` / `GK_COUNTER_PLAY_MINION_TO_BASE` / `GK_TRIGGERED_CONTROL_UNTIL_TURN_END` / `GK_EXTRA_ACTION_THEN_RETURN_PROMPT` / `GK_MOVE_ONGOING_WITHOUT_OWNER_CHANGE` / `GK_REVEAL_TOP5_DRAW_ALL_OR_KEEP` | `src/games/smashup/abilities/geeks.ts`、`src/games/smashup/domain/actionCounter.ts` |
| `GK_VP_TRIGGERED_SPECIAL` / `GK_HAND_SPECIAL_DRAW` / `GK_BATCH_MOVE_ALL_MINIONS` / `GK_REVEAL_HAND_AND_BORROW_ACTION` / `GK_MULTI_OPPONENT_BRANCHING` | `src/games/smashup/abilities/geeks.ts` |
| `GK_ONGOING_PROTECTION` | `src/games/smashup/abilities/geeks.ts` |
| `BASE_TABLETOP_AFTER_SCORING_DRAW_THEN_DISCARD` / `BASE_THE_CON_FACTION_BUFF` | `src/games/smashup/domain/baseAbilities_expansion.ts` |

## 本轮 direct L3/L4 结果

- 真实入口覆盖总数：`15`
- 全量结果：`15 passed (4.0m)`
- 已打穿的独立 family：
  - 龙：侧翼攻击、烧毁它、险地、推倒城墙
  - 超级英雄：心灵女士、温和市民、放射暴露、水晶堡垒
  - 极客：维尔的力量、维尔、控制仆从、无限循环、规则咬定者、妙力一击、桌游桌

## 逐对象子句级全面审计矩阵

说明：

- 不会机械把每个对象都再独立重跑一遍同类 E2E。
- 但**每个对象都必须有自己的子句行**；只有当共享链、触发窗口、候选生成、skip/拒绝路径、finalize/清理都完全同构，才允许复用既有深层证据。
- 下表里：
  - `direct` = 本对象或本 family 已有独立真实入口 L3/L4
  - `shared:<对象/链>` = 本对象只复用已验证对象的同构共享链，不重复跑同链 E2E
  - `无玩家入口` = 自动结算 / 持续修正对象，不新增玩家交互，L3 为 `N/A`

### 龙

| 对象 | 规则子句 | L0 | L1 | L2 | L3 | L4 | 子句级复用 / 证据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 巨龙（`dragons_great_wyrm`） | `C1` 在基地上持续生效；`C2` 其他玩家在这里计分时基础名次 VP -1；`C3` 不影响额外能力发放的 VP | passed | passed | passed | N/A | passed | `VP_BASE_MODIFIER`；与 废墟 同 modifier 链，仅来源对象不同 |
| 飞龙（`dragons_wyvern`） | `C1` 打出时消灭同基地力量 ≤3 随从；`C2` talent：本回合该基地 breakpoint -3 | passed | passed | passed | shared | shared | `shared:飞龙/同基地低力量消灭+talent breakpoint`；同对象两子句均已由 L2 覆盖，未新增 longzu 独有流程态 |
| 帝国龙（`dragons_imperial_dragon`） | `C1` 其他玩家打出随从到这里时摸 1；`C2` 其他玩家移入随从到这里时摸 1 | passed | passed | passed | shared | shared | `shared:帝国龙/他人打出或移入见证摸牌`；Felicia Day FAQ 已旁证 move witness 收口 |
| 幼龙（`dragons_hatchling`） | `C1` 其他玩家打出随从到这里时该随从本回合 -1；`C2` 其他玩家移入随从到这里时该随从本回合 -1 | passed | passed | passed | shared | shared | `shared:帝国龙/他人打出或移入见证链`；仅主效果从摸牌改为 temp power |
| 险地（`dragons_dangerous_ground`） | `C1` 持续打在基地上；`C2` 其他玩家在这里打出随从后必须弃 1；`C3` 只剩 1 张合法手牌时自动弃掉；`C4` 多张时创建 live hand prompt | passed | passed | passed | direct | direct | `DG_FORCE_DISCARD_AFTER_PLAY`；E2E direct |
| 废墟（`dragons_ruins`） | `C1` 持续打在基地上；`C2` 其他玩家在这里计分时基础名次 VP -1；`C3` 不影响额外能力 VP | passed | passed | passed | N/A | passed | `VP_BASE_MODIFIER`；与 巨龙 同链，仅来源从随从改为基地持续行动 |
| 烧毁它（`dragons_burn_it_down`） | `C1` 选择一个基地；`C2` 摧毁该基地上的基地持续行动；`C3` 以基地牌库顶牌或基地弃牌堆选牌替换该基地；`C4` 保留原基地随从与随从附着行动；`C5` 收敛 `baseDeck/baseDiscard` 最终态 | passed | passed | passed | direct | direct | `DG_REPLACE_BASE_KEEP_MINIONS`；E2E direct |
| 夷平（`dragons_raze`） | `C1` 持续打在基地上；`C2` 在其留场期间取消该基地能力 | passed | passed | passed | N/A | shared | `BASE_ABILITY_SUPPRESSION`；与水晶堡垒/龙穴等基地能力消费面共享，差异仅 suppress source |
| 推倒城墙（`dragons_bring_down_the_walls`） | `C1` 持续打在基地上；`C2` 该基地计分前你可在这里额外打 1 个随从；`C3` 在非 `playCards` 时仍通过 immediate extra-minion 收口 | passed | passed | passed | direct | direct | `DG_BEFORE_SCORING_EXTRA_MINION_ON_BASE`；E2E direct |
| 龙之领地（`dragons_dragon_lands`） | `C1` 你在这里的随从持续 +1；`C2` 可在 `beforeScoring` 作为 special 打到基地 | passed | passed | passed | shared | shared | `shared:推倒城墙/beforeScoring 基地 special 入口`；仅主效果改为持续 +1 |
| 威压（`dragons_intimidating_presence`） | `C1` 其他玩家在这里的随从持续 -1；`C2` 可在 `beforeScoring` 作为 special 打到基地 | passed | passed | passed | shared | shared | `shared:龙之领地/beforeScoring 基地 special 入口`；仅主效果改为敌方持续 -1 |
| 侧翼攻击（`dragons_flank_attack`） | `C1` 选择搜索来源：牌库/弃牌堆/两者；`C2` 选择一张可打在基地上的行动；`C3` 选择目标基地；`C4` 立刻额外打出该行动；`C5` 若搜了两者且拿的是弃牌堆，牌库仍需洗切；`C6` 不增加 `actionsPlayed` | passed | passed | passed | direct | direct | `DG_SEARCH_ACTION_FROM_DECK_OR_DISCARD_TO_BASE`；E2E direct |
| 龙之荒芜（`base_wyrms_desolation`） | `C1` 这里的所有随从持续 -1 | passed | passed | passed | N/A | passed | `BASE_WYRMS_DESOLATION_POWER_MODIFIER`；纯基地持续修正 |
| 龙穴（`base_dragons_lair`） | `C1` 这里计分后冠军摸 3 | passed | passed | passed | N/A | passed | `BASE_DRAGONS_LAIR_AFTER_SCORING`；与桌游桌同 afterScoring 奖励族，但自身无二段交互 |

### 超级英雄

| 对象 | 规则子句 | L0 | L1 | L2 | L3 | L4 | 子句级复用 / 证据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 超赞男（`superheroes_awesome_guy`） | `C1` 你在这里的随从不会被其他玩家的卡牌消灭 | passed | passed | passed | N/A | passed | `SH_DESTROY_PROTECTION`；与 秘密基地/改造洞穴 同 destroy restriction 合同，仅保护范围不同 |
| 温和市民（`superheroes_mild_mannered_citizen`） | `C1` 你的回合开始时你可以自毁；`C2` 若如此，搜索牌库 1 个力量 5+ 随从；`C3` 在原基地额外打出；`C4` 洗牌/重排剩余牌库；`C5` 可主动跳过且不继续检索 | passed | passed | passed | direct | direct | `SH_SELF_DESTROY_THEN_SEARCH_5PLUS`；E2E direct |
| 心灵女士（`superheroes_mind_lady`） | `C1` 选择另一名玩家的一个随从；`C2` 压制其能力直到你下回合开始；`C3` 到时自动恢复 | passed | passed | passed | direct | direct | `SH_MINION_SUPPRESSION_UNTIL_NEXT_TURN`；E2E direct |
| 惊奇队长（`superheroes_captain_amazing`） | `C1` talent；`C2` 这里你当前在场的每个随从本回合 +1 | passed | passed | passed | N/A | passed | `src/games/smashup/abilities/superheroes.ts`；同基地群体 temp power，无额外交互 |
| 爆发（`superheroes_the_burst`） | `C1` 任意玩家在别的基地打出随从后可触发；`C2` 你可以把它移动到这里；`C3` 也可以选择留在原地；`C4` 若本就在同基地则不创建交互 | passed | passed | passed | shared | shared | `shared:爆发/打出后可移入本基地`；L2 已覆盖 move/stay/same-base |
| 并没真死（`superheroes_not_really_dead`） | `C1` 从弃牌堆选择至多 2 个力量 ≤2 随从；`C2` 它们回到手牌；`C3` 允许空选/少选 | passed | passed | passed | shared | shared | `shared:并没真死/可选多选 discard->hand`；与黄金时代同多选 family，仅 zone/limit 不同 |
| 正义伙伴（`superheroes_justice_friends`） | `C1` 你当前力量 5+ 的随从本回合 +2；`C2` 跨基地生效；`C3` 不影响敌方且按当前有效力量判断资格 | passed | passed | passed | N/A | passed | `src/games/smashup/abilities/superheroes.ts`；纯临时增益，无交互 |
| 黄金时代（`superheroes_golden_age`） | `C1` 从弃牌堆选择至多 3 个随从；`C2` 依选择顺序放到牌库底；`C3` 允许空选/少选 | passed | passed | passed | shared | shared | `shared:黄金时代/可选多选 discard->deckBottom`；与并没真死同多选 family，仅目标 zone/limit 不同 |
| 助手（`superheroes_sidekick`） | `C1` 选择一个你有力量 5+ 随从的基地；`C2` 你获得一个限定到该基地的额外随从额度；`C3` 该额外随从必须力量 ≤2 | passed | passed | passed | shared | shared | `shared:推倒城墙/extra minion 消费链`；仅前置筛选与 `powerMax` 不同 |
| 强化能力（`superheroes_expanded_power`） | `C1` 附着到一个随从；`C2` 该随从 +1 力量；`C3` 该随从不会被其他玩家消灭 | passed | passed | passed | N/A | passed | `SH_DESTROY_PROTECTION`；与超赞男同保护链，额外多一条 attached +1 |
| 放射暴露（`superheroes_radioactive_exposure`） | `C1` 选择你的一个随从；`C2` 消灭它；`C3` 搜索一个力量严格更高的随从；`C4` 在原基地额外打出；`C5` 洗牌/重排剩余牌库；`C6` 无候选时只消灭目标 | passed | passed | passed | direct | direct | `SH_DESTROY_OWN_MINION_SEARCH_STRICTLY_HIGHER`；E2E direct |
| 秘密基地（`superheroes_secret_base`） | `C1` 这里你力量 ≤3 的随从不会被其他玩家消灭 | passed | passed | passed | N/A | passed | `SH_DESTROY_PROTECTION`；与超赞男/改造洞穴同链，仅筛选门槛不同 |
| 我唯一的弱点（`superheroes_my_only_weakness`） | `C1` 附着到一个随从；`C2` 附着期间压制其能力；`C3` 失去附着后恢复 | passed | passed | passed | N/A | passed | `SH_ATTACHED_SUPPRESSION`；与心灵女士共用 suppression 基础设施，仅持续条件不同 |
| 改造洞穴（`base_converted_cave`） | `C1` 这里力量 ≤2 的随从不能被其控制者以外的人消灭 | passed | passed | passed | N/A | passed | `BASE_CONVERTED_CAVE_DESTROY_PROTECTION`；与超赞男/秘密基地同链，仅保护判定不同 |
| 水晶堡垒（`base_crystal_fortress`） | `C1` 你在这里打出随从后可触发；`C2` 可把弃牌堆 1 个随从放到牌库底；`C3` 可以跳过；`C4` 无候选时不创建交互 | passed | passed | passed | direct | direct | `BASE_CRYSTAL_FORTRESS_RECOVER_TO_DECK_BOTTOM`；E2E direct |

### 极客

| 对象 | 规则子句 | L0 | L1 | L2 | L3 | L4 | 子句级复用 / 证据 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 菲丽希亚（`geeks_felicia_day`） | `C1` 打出后把其他所有随从移到这个基地；`C2` 作为同批移动一次性结算；`C3` 同批移入者不会互相见证彼此 arrival；`C4` 不会反向见证 Felicia 自己的 onPlay | passed | passed | passed | shared | shared | `shared:Felicia Day/批量移动同批见证过滤`；L2 已覆盖 FAQ 边界 |
| 维尔（`geeks_wil_wheaton`） | `C1` 当对手打出行动时可从手牌作为 triggered special 打出；`C2` 先选择一个基地把维尔打到那里；`C3` 然后使目标行动无效 | passed | passed | passed | direct | direct | `GK_COUNTER_PLAY_MINION_TO_BASE`；E2E direct |
| 游戏专家（`geeks_game_guru`） | `C1` 不受其他玩家能力影响；`C2` 不会错误免疫其他玩家的行动牌 | passed | passed | passed | N/A | passed | `GK_ONGOING_PROTECTION`；纯持续保护，已覆盖 `action/nonAction` 边界 |
| 粉丝（`geeks_fan`） | `C1` 你的回合中可从手牌作为 special 发动；`C2` 结算时弃掉自己；`C3` 摸 1；`C4` 普通打出与 special 同时合法时，真实手牌入口必须先让玩家选择打出 / 使用能力 / 取消或跳过 | passed | passed | passed | direct | direct | 2026-08-20 修订：旧 `shared:粉丝/hand special discard-for-draw` 只覆盖命令层直激活，漏掉真实入口多动作仲裁；现由 `e2e/smashup/smashup-geeks-hand-special-and-minmaxing.e2e.ts` 覆盖额度满 special、普通+special 同时合法时取消/使用能力、选择打出为随从三条真实入口 |
| 角色扮演（`geeks_cosplay`） | `C1` 当你获得 1+ VP 时进入反应队列；`C2` 你可以从手牌打出或跳过；`C3` 若打出则额外获得 1 VP | passed | passed | passed | shared 降级 | shared 降级 | 2026-07-18 修订：旧 `shared:角色扮演/onVpAwarded triggered special` 只证明“收到 VP 获得事件后能响应”，不证明所有 VP 来源都会派发该事件；基地计分 VP 来源曾暴露缺口，旧 shared 不能继续当对象级已收口证据 |
| 维尔的力量（`geeks_force_of_wil`） | `C1` 当对手打出行动时可从手牌反制；`C2` 普通行动不会继续结算；`C3` ongoing 不会附着但仍入原拥有者弃牌堆；`C4` 支持 `Force of Wil -> Force of Wil` 嵌套反制 | passed | passed | passed | direct | direct | `GK_ACTION_COUNTER_STACK`；E2E direct |
| 规则咬定者（`geeks_rules_lawyer`） | `C1` 选择一个已在场的基地持续行动或随从附着行动；`C2` 若是基地行动则移到另一基地；`C3` 若是随从附着行动则移到另一随从；`C4` 不改变 owner/sourceController 语义 | passed | passed | passed | direct | direct | `GK_MOVE_ONGOING_WITHOUT_OWNER_CHANGE`；E2E direct |
| 禁卡表（`geeks_banned_list`） | `C1` 对每个其他玩家先命名一张牌；`C2` 然后只向施放者 reveal 该玩家手牌；`C3` 该玩家把所有同名牌放到底牌；`C4` `_pod` 与基础版按同名处理；`C5` 空手对手自动跳过 | passed | passed | passed | shared | shared | `shared:禁卡表/reveal-hand + exact-name + bottom-of-deck`；作为 无限循环 被重放时已走到真实后续 prompt 前 |
| 嘲讽（`geeks_griefer`） | `C1` 按 turn order 逐个处理其他玩家；`C2` 每人可选随机弃 1 / 毁 1 个自己的随从 / 把自己的弃牌堆洗回牌库；`C3` 无合法分支时自动跳过；`C4` “毁自己的随从”按目标玩家自己的 destroy 身份结算 | passed | passed | passed | shared | shared | `shared:嘲讽/多对手顺序分支链`；同构分支 family 已由 L2 覆盖 |
| 妙力一击（`geeks_mulligan`） | `C1` 查看牌库顶 5；`C2` 牌库不足时先把弃牌堆洗回补足快照；`C3` 只存在“全部拿进手牌”或“完全不拿、保持原顺序”两条分支；`C4` 若拿进手牌，只把其余手牌洗回 | passed | passed | passed | direct | direct | `GK_REVEAL_TOP5_DRAW_ALL_OR_KEEP`；E2E direct |
| 控制仆从（`geeks_control_minion`） | `C1` 正常打出时选择一个随从，本回合控制它；`C2` 当其他玩家打出随从时，可从手牌作为 triggered special 直接接管那个新随从；`C3` 不论在哪个回合接管，都在该当前回合结束时归还 | passed | passed | passed | direct | direct | `GK_TRIGGERED_CONTROL_UNTIL_TURN_END`；E2E direct |
| 无限循环（`geeks_non_infinite_loop`） | `C1` 额外打 1 张标准行动；`C2` 该行动仍走真实 `PLAY_ACTION` 与目标 prompt；`C3` 其自身交互先收口；`C4` 之后你可以把这张行动改为回手而不是去原本去向 | passed | passed | passed | direct | direct | `GK_EXTRA_ACTION_THEN_RETURN_PROMPT`；E2E direct |
| 平衡（`geeks_min_maxing`） | `C1` 看一名对手的手牌；`C2` 你可以从其手牌额外打 1 张行动；`C3` 无目标行动立即结算，需目标行动继续真实 prompt；`C4` 打出的牌保持原拥有者与弃牌归属 | passed | passed | passed | shared | shared | `shared:平衡/borrowed CARD_TRANSFERRED + real PLAY_ACTION`；同构链已由 L2 覆盖 |
| 桌游桌（`base_tabletop`） | `C1` 这里计分后冠军摸 3；`C2` 然后弃 2；`C3` 手牌不足时自动弃尽；`C4` 抽牌后的 live discard prompt 必须先收口 | passed | passed | passed | direct | direct | `BASE_TABLETOP_AFTER_SCORING_DRAW_THEN_DISCARD`；E2E direct |
| 展会（`base_the_con`） | `C1` 有随从打到这里时触发；`C2` 这里其他与该随从同派系的随从本回合 +1；`C3` 不影响刚打出的随从或不同派系随从 | passed | passed | passed | N/A | passed | `BASE_THE_CON_FACTION_BUFF`；纯基地触发，无玩家交互 |

## 对象级矩阵

状态约定：

- `通过`：对象级子句已由 L2 + direct L3/L4，或 L2 + 合法共享 / 无玩家入口证据覆盖。
- `共享`：对象不再单独重复深审，但已登记共享链与“只差配置”的依据。

### 龙

| 对象 | L2 | L3/L4 | 适用维度 | 实现入口 / 共享链 / 复用依据 | 当前结论 |
| --- | --- | --- | --- | --- | --- |
| 巨龙（`dragons_great_wyrm`） | 有 | 无玩家入口 | `D1/D8/D14/D50` | `VP_BASE_MODIFIER`；纯计分名次 VP 修正，与 废墟 共用 `getModifiedBaseVp()`，差异仅来源从随从改为基地持续行动 | 通过 |
| 飞龙（`dragons_wyvern`） | 有 | shared | `D1/D5/D8/D14` | `src/games/smashup/abilities/dragons.ts`；复用成熟“同基地低力量消灭 + talent 临时 breakpoint 修正”链，无 longzu 新共享根因 | 共享 |
| 帝国龙（`dragons_imperial_dragon`） | 有 | shared | `D1/D8/D19/D50` | `src/games/smashup/abilities/dragons.ts`；复用“他人打出/移入 -> 摸牌”触发链，Felicia Day FAQ 已由 L2 旁证 move witness 收口 | 共享 |
| 幼龙（`dragons_hatchling`） | 有 | shared | `D1/D8/D19/D50` | 与 帝国龙 共用“他人打出/移入见证”触发族，差异仅主效果改为临时 `-1 power` | 共享 |
| 险地（`dragons_dangerous_ground`） | 有 | direct | `D1/D5/D8/D18/D39` | `DG_FORCE_DISCARD_AFTER_PLAY`；真实对手打出随从后 live hand prompt / 自动弃牌双分支 | 通过 |
| 废墟（`dragons_ruins`） | 有 | 无玩家入口 | `D1/D8/D14/D50` | `VP_BASE_MODIFIER`；与 巨龙 共用基础 VP 修正链，已验证不影响额外 `VP_AWARDED` | 通过 |
| 烧毁它（`dragons_burn_it_down`） | 有 | direct | `D1/D5/D8/D18/D39` | `DG_REPLACE_BASE_KEEP_MINIONS`；基地弃牌堆选替代基地并收敛 `baseDeck/baseDiscard` | 通过 |
| 夷平（`dragons_raze`） | 有 | shared | `D1/D8/D14/D50` | `BASE_ABILITY_SUPPRESSION`；持续型基地能力压制，与 烧毁它 / 水晶堡垒 所在基地能力消费面相邻，L2 已覆盖 suppression 生效与恢复 | 共享 |
| 推倒城墙（`dragons_bring_down_the_walls`） | 有 | direct | `D1/D5/D8/D14/D39` | `DG_BEFORE_SCORING_EXTRA_MINION_ON_BASE`；真实计分前 reaction 入口消费额外随从额度 | 通过 |
| 龙之领地（`dragons_dragon_lands`） | 有 | shared | `D1/D8/D14/D50` | 与 推倒城墙 共用 `beforeScoring` 反应入口与基地选择语义，差异仅改为基地持续 `+1` 修正 | 共享 |
| 威压（`dragons_intimidating_presence`） | 有 | shared | `D1/D8/D14/D50` | 与 龙之领地 共用 `beforeScoring` 反应入口，差异仅改为敌方随从持续 `-1` 修正 | 共享 |
| 侧翼攻击（`dragons_flank_attack`） | 有 | direct | `D1/D5/D8/D18/D39` | `DG_SEARCH_ACTION_FROM_DECK_OR_DISCARD_TO_BASE`；deck/discard/both 三段真实交互 | 通过 |
| 龙之荒芜（`base_wyrms_desolation`） | 有 | 无玩家入口 | `D1/D8/D14/D50` | `BASE_WYRMS_DESOLATION_POWER_MODIFIER`；纯基地级持续 `-1 power`，无独立 prompt | 通过 |
| 龙穴（`base_dragons_lair`） | 有 | 无玩家入口 | `D1/D8/D14/D39` | `BASE_DRAGONS_LAIR_AFTER_SCORING`；纯计分后冠军摸 `3`，与 桌游桌 同属 `afterScoring` 基地奖励族，但自身不新增后续交互 | 通过 |

### 超级英雄

| 对象 | L2 | L3/L4 | 适用维度 | 实现入口 / 共享链 / 复用依据 | 当前结论 |
| --- | --- | --- | --- | --- | --- |
| 超赞男（`superheroes_awesome_guy`） | 有 | 无玩家入口 | `D1/D8/D14/D50` | `SH_DESTROY_PROTECTION`；纯 destroy protection，与 秘密基地 / 改造洞穴 共用保护消费链，只差保护范围 | 通过 |
| 温和市民（`superheroes_mild_mannered_citizen`） | 有 | direct | `D1/D5/D8/D18/D39` | `SH_SELF_DESTROY_THEN_SEARCH_5PLUS`；真实回合开始确认自毁 / 跳过双分支 | 通过 |
| 心灵女士（`superheroes_mind_lady`） | 有 | direct | `D1/D5/D8/D14/D50` | `SH_MINION_SUPPRESSION_UNTIL_NEXT_TURN`；真实打出入口选敌方随从并验证定时恢复 | 通过 |
| 惊奇队长（`superheroes_captain_amazing`） | 有 | 无玩家入口 | `D1/D8/D14` | `src/games/smashup/abilities/superheroes.ts`；talent 触发后只做同基地己方随从临时加力，不新增二段 prompt | 通过 |
| 爆发（`superheroes_the_burst`） | 有 | shared | `D1/D5/D8/D18/D39` | `src/games/smashup/abilities/superheroes.ts`；复用“他人打出随从后可移动该随从” family，L2 已覆盖 move / stay / same-base 不起 prompt 三分支 | 共享 |
| 并没真死（`superheroes_not_really_dead`） | 有 | shared | `D1/D5/D8/D18/D39` | `SH_MULTI_RECOVER_OR_DECK_BOTTOM`；复用可选多选弃牌回手链，差异仅过滤 `power <= 2` 与数量上限 `2` | 共享 |
| 正义伙伴（`superheroes_justice_friends`） | 有 | 无玩家入口 | `D1/D8/D14` | `src/games/smashup/abilities/superheroes.ts`；纯当回合跨基地力量阈值增益，无额外交互 | 通过 |
| 黄金时代（`superheroes_golden_age`） | 有 | shared | `D1/D5/D8/D18/D39` | `SH_MULTI_RECOVER_OR_DECK_BOTTOM`；复用可选多选弃牌 -> 牌库底链，差异仅数量上限 `3` | 共享 |
| 助手（`superheroes_sidekick`） | 有 | shared | `D1/D5/D8/D18/D39` | `SH_EXTRA_MINION_POWERMAX`；复用额外随从额度 + `powerMax` 限制，与 推倒城墙 同属 extra-minion 消费链 | 共享 |
| 强化能力（`superheroes_expanded_power`） | 有 | 无玩家入口 | `D1/D8/D14/D50` | `SH_DESTROY_PROTECTION`；附着 `+1 power` + destroy protection，不新增独立交互 | 通过 |
| 放射暴露（`superheroes_radioactive_exposure`） | 有 | direct | `D1/D5/D8/D18/D39` | `SH_DESTROY_OWN_MINION_SEARCH_STRICTLY_HIGHER`；真实手牌行动选择己方随从并检索更高力量随从 | 通过 |
| 秘密基地（`superheroes_secret_base`） | 有 | 无玩家入口 | `D1/D8/D14/D50` | `SH_DESTROY_PROTECTION`；与 超赞男 / 改造洞穴 共用 destroy restriction 消费链，差异仅基地持续过滤 `power <= 3` | 通过 |
| 我唯一的弱点（`superheroes_my_only_weakness`） | 有 | 无玩家入口 | `D1/D8/D14/D50` | `SH_ATTACHED_SUPPRESSION`；附着型持续压制，与 心灵女士 共用 suppression 基础设施，差异仅持续条件从“到你下回合开始”改为“附着在场期间” | 通过 |
| 改造洞穴（`base_converted_cave`） | 有 | 无玩家入口 | `D1/D8/D14/D50` | `BASE_CONVERTED_CAVE_DESTROY_PROTECTION`；基地级 destroy restriction，与 超赞男 / 秘密基地 共享保护消费链，差异仅按“非控制者”判定 | 通过 |
| 水晶堡垒（`base_crystal_fortress`） | 有 | direct | `D1/D5/D8/D18/D39` | `BASE_CRYSTAL_FORTRESS_RECOVER_TO_DECK_BOTTOM`；真实打随从后触发成功 / 跳过 / 无候选三分支 | 通过 |

### 极客

| 对象 | L2 | L3/L4 | 适用维度 | 实现入口 / 共享链 / 复用依据 | 当前结论 |
| --- | --- | --- | --- | --- | --- |
| 菲丽希亚（`geeks_felicia_day`） | 有 | shared | `D1/D8/D19/D50` | `GK_BATCH_MOVE_ALL_MINIONS`；复用成熟批量移动链，L2 已额外覆盖同批 move witness FAQ、帝国龙见证边界与组内互不反向见证 | 共享 |
| 维尔（`geeks_wil_wheaton`） | 有 | direct | `D1/D5/D8/D18/D39` | `GK_COUNTER_PLAY_MINION_TO_BASE`；真实 hand triggered special 打到基地并反制目标行动 | 通过 |
| 游戏专家（`geeks_game_guru`） | 有 | 无玩家入口 | `D1/D8/D14/D50` | `GK_ONGOING_PROTECTION`；纯持续保护，L2 已覆盖 `action` / `nonAction` 来源区分与 live target filtering | 通过 |
| 粉丝（`geeks_fan`） | 有 | direct | `D1/D5/D8/D14/D39` | `GK_HAND_SPECIAL_DRAW + HAND_ACTION_CHOICE`；2026-08-20 修订：旧共享证据只能证明 `ACTIVATE_SPECIAL` from hand 命令合同，不能证明玩家真实入口。现已补真实手牌 E2E，覆盖普通可打时弹出“打出为随从 / 使用能力 / 取消或跳过”，并分别验证取消不消耗、使用能力弃自身摸 1、打出为随从进入基地 | 通过 |
| 角色扮演（`geeks_cosplay`） | 有 | shared 降级 | `D1/D5/D8/D18/D39` | 2026-07-18 修订：旧 `GK_VP_TRIGGERED_SPECIAL` 共享链只覆盖收到 `VP_AWARDED` 后的 hand triggered special；不覆盖基地计分 VP 是否正确派生 `VP_AWARDED`。该行不能再作为对象级全链路收口证据 | 仍有残余范围 |
| 维尔的力量（`geeks_force_of_wil`） | 有 | direct | `D1/D5/D8/D18/D39` | `GK_ACTION_COUNTER_STACK`；真实 reaction 入口反制普通行动 / ongoing / counter-on-counter | 通过 |
| 规则咬定者（`geeks_rules_lawyer`） | 有 | direct | `D1/D5/D8/D18/D39` | `GK_MOVE_ONGOING_WITHOUT_OWNER_CHANGE`；真实手牌行动移动基地持续行动 | 通过 |
| 禁卡表（`geeks_banned_list`） | 有 | shared | `D1/D5/D8/D18/D39` | `GK_REVEAL_HAND_AND_BORROW_ACTION` 邻近共享链；复用 reveal-hand + same-name normalization + hand -> deck-bottom，作为 无限循环 被重放行动已走到真实后续 prompt 前 | 共享 |
| 嘲讽（`geeks_griefer`） | 有 | shared | `D1/D5/D8/D18/D19/D39` | `GK_MULTI_OPPONENT_BRANCHING`；复用“按对手顺序逐个处理”的多分支链，差异仅分支组合为随机弃牌 / 自毁随从 / 洗弃牌堆 | 共享 |
| 妙力一击（`geeks_mulligan`） | 有 | direct | `D1/D5/D8/D18/D39` | `GK_REVEAL_TOP5_DRAW_ALL_OR_KEEP`；真实入口查看顶五并选择全部拿进手牌 | 通过 |
| 控制仆从（`geeks_control_minion`） | 有 | direct | `D1/D5/D8/D14/D39/D50` | `GK_TRIGGERED_CONTROL_UNTIL_TURN_END`；真实 triggered special 夺取新打出随从并验证回合结束归还 | 通过 |
| 无限循环（`geeks_non_infinite_loop`） | 有 | direct | `D1/D5/D8/D18/D39` | `GK_EXTRA_ACTION_THEN_RETURN_PROMPT`；先完成被重放行动交互，再出现回手 prompt | 通过 |
| 平衡（`geeks_min_maxing`） | 有 | shared | `D1/D5/D8/D18/D39` | `GK_REVEAL_HAND_AND_BORROW_ACTION`；复用 borrowed `CARD_TRANSFERRED` + 真实 `PLAY_ACTION` 链，差异仅入口来自对手手牌 reveal | 共享 |
| 桌游桌（`base_tabletop`） | 有 | direct | `D1/D5/D8/D18/D39` | `BASE_TABLETOP_AFTER_SCORING_DRAW_THEN_DISCARD`；真实计分后摸三再强制弃二 | 通过 |
| 展会（`base_the_con`） | 有 | 无玩家入口 | `D1/D8/D14/D50` | `BASE_THE_CON_FACTION_BUFF`；纯基地触发临时同派系加力，无独立玩家 prompt | 通过 |

## 2026-08-20 粉丝同类扩审记录

- 原始漏审症状：`粉丝（geeks_fan）`在己方出牌阶段既能普通打出、又能从手牌作为 special 发动时，真实手牌入口没有让玩家选择“打出 / 使用能力 / 取消或跳过”，导致 special 被普通出牌路径遮蔽。
- 漏审归因：这不是简单“测试数量不够”。旧证据属于**证据停在中间态**，只证明 `ACTIVATE_SPECIAL` 命令层可以直接激活粉丝；旧测试属于**测试断言过窄**，没有构造“普通打出与手牌 special 同时合法”的并存场景；旧 shared 结论属于**共享抽象没扩审**，把 hand special 执行链当成真实手牌入口完成，漏掉点击 / 拖拽第一入口的动作仲裁。
- 搜索范围：
  - `rg -n -C 2 "kind:\s*'special',\s*zone:\s*'hand'|zone:\s*'hand',\s*window:\s*'playCards'" src/games/smashup/data/factions`：定位所有“出牌阶段手牌 special”静态定义。
  - `rg -n "shouldOfferHandSpecialActionChoice|shouldPreferHandSpecialSelection|getHandSpecialPlayableBaseIndices|ACTIVATE_SPECIAL, \{ handCardUid|hand-special" src/games/smashup e2e/smashup public/locales/zh-CN/game-smashup.json public/locales/en/game-smashup.json evidence/smashup/smashup-longzu-deep-audit-2026-06-01.md`：核对共享 UI 判定、点击 / 拖拽入口、命令提交、测试和文案落点。
  - `rg -n "hand special|手牌 special|手牌特殊|ACTIVATE_SPECIAL from hand|GK_HAND_SPECIAL|HAND_ACTION_CHOICE|shared:hand" evidence src/games/smashup/__tests__ e2e/smashup`：核对旧测试 / 旧 evidence 是否还把命令层直激活误写成真实入口收口。
- 命中项：
  - 当前 longzu 范围内命中 `geeks_fan`；已由 `shouldOfferHandSpecialActionChoice(...)`、Board 点击 / 拖拽入口和 `e2e/smashup/smashup-geeks-hand-special-and-minmaxing.e2e.ts` 三条粉丝用例直接覆盖。
  - 同类静态定义还命中 `all_stars_fan` 与 `penguins_dancing_penguin`。二者共享同一个 Board 手牌入口和 `handSpecialSelection` 判定，因此会受本轮共享 UI 修复保护；但它们不属于 longzu 三派系对象级审计，本文件不把它们外推成对象级已收口。
  - 极客里 `geeks_cosplay`、`geeks_wil_wheaton`、`geeks_control_minion` 属于响应窗口手牌 special，不是己方出牌阶段“普通打出 + hand special”同时合法的第一入口冲突；本轮只确认它们不属于粉丝同类根因，不重写其既有对象结论。
- 残余扩审范围：粉丝当前点位已补真实入口三分支；跨派系同类对象若后续要对外宣称对象级收口，需要分别在对应派系 evidence 中补本对象真实入口验证或共享流程判等表。

## 当前残余范围

- 当前 longzu 玩法审计残余：`无`
- 当前 longzu 审计非阻塞工程边界：
  - `npm run i18n:check` 仍失败，但失败点是既有 DiceThrone 缺 key：`src/games/dicethrone/ui/InteractionOverlay.tsx:468`
  - 这不是 longzu 三派系的 locale JSON 或 SmashUp 接入缺口，因此不阻塞本轮审计结论

## 已跑验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run src/games/smashup/__tests__/abilities/dragons.test.ts src/games/smashup/__tests__/abilities/superheroes.test.ts src/games/smashup/__tests__/abilities/geeks.test.ts src/games/smashup/__tests__/longzuFactionPrep.test.ts src/games/smashup/__tests__/shayuFactionIntake.test.ts --configLoader native` | `5 files / 93 tests passed` |
| `BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-longzu-audit.e2e.ts` | `15 passed (4.0m)` |
| `npx tsc --noEmit` | `通过` |
| `npm run i18n:check` | `失败`，阻塞点为 DiceThrone 既有缺 key，不属于 longzu 审计阻塞 |

## 结论

- 旧的 implementation handoff 只能证明“实现已落地”，不能替代正式审计；本文件现在承担 longzu 三派系的对象级审计证明。
- 目前 longzu 范围内的独立高风险交互 family 已全部具备 direct L3/L4，剩余对象也都登记了合法共享或无玩家入口依据。
- 本次已补齐逐对象规则子句 `C1/C2/C3...` 与对象级 `L0/L1/L2/L3/L4` 行，并把 shared 对象的“同链仅配置不同”依据显式登记。
- 2026-07-18 修订：由于`角色扮演`暴露出 shared 代表链过宽，本批 longzu 三派系不得继续按本文件单独对外表述为`当前发布口径已收口`；当前口径降级为`仍有残余范围`，直到 shared 对象逐项补齐六项判等依据或独立 L3/L4。
