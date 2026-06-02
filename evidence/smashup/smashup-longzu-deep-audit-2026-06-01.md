# SmashUp longzu 三派系对象级深审矩阵（2026-06-01）

## 结论等级

- 当前结论：`仍有残余范围`
- 判定依据：
  - 本批对象全集已建表，覆盖龙、超级英雄、极客三派系全部 `38` 张卡与 `6` 个基地。
  - longzu 本轮新增的独立高风险交互 family 已全部补到 direct L3/L4，2026-06-02 复验结果为 `15 passed (4.0m)`。
  - 其余对象均已登记为“合法共享链复用”或“无玩家入口 / 自动结算对象”，并给出对应共享依据。
  - longzu 领域 L2 行为证据、L3/L4 真实入口证据、类型检查与基础接入门禁均已落地，可替代 implementation handoff 作为正式审计凭证。
  - 但按 `.windsurf/skills/smashup-faction-addition/SKILL.md`、`.windsurf/skills/add-new-faction/SKILL.md` 与 `docs/ai-rules/audit-evidence-template.md` 的当前门禁，新增派系若要称为“全面审计完成”，还必须为每个对象补齐显式的规则子句 `C1/C2/C3...` 与对象级子句证据；当前文档尚未补到这一级。
- 本文档是当前批次“审计完毕”的对象级权威证明；统一汇总版见 [smashup-longzu-audit-2026-06-01.md](/D:/gongzuo/webgame/BoardGame/evidence/smashup/smashup-longzu-audit-2026-06-01.md)。

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

## 2026-06-02 降级说明

- 触发原因：
  - 项目新增派系 skill 已更新，默认审计口径是“全面审计 / 做到底”，不是“对象矩阵已齐即可收口”。
  - 当前 longzu evidence 已具备对象全集、L1/L2/L3/L4 证据与共享链依据，但**还没有逐对象显式展开规则子句 `C1/C2/C3...`**。
- 因此：
  - 这份文档当前可以证明“对象级矩阵、真实入口验证、共享链追溯已补齐”。
  - 但还**不能**证明“新增派系全面审计完成”。
  - 当前总口径必须降级为：`仍有残余范围`。

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
| 粉丝（`geeks_fan`） | 有 | shared | `D1/D5/D8/D14` | `GK_HAND_SPECIAL_DRAW`；复用“手牌手动 special -> 弃自身 -> 摸牌”链，L2 已覆盖 `ACTIVATE_SPECIAL` from hand 合同 | 共享 |
| 角色扮演（`geeks_cosplay`） | 有 | shared | `D1/D5/D8/D18/D39` | `GK_VP_TRIGGERED_SPECIAL`；复用全局 `onVpAwarded` 触发 + hand triggered special，差异仅结算结果为额外 `+1 VP` | 共享 |
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

## 当前残余范围

- 当前 longzu 玩法审计残余：
  - 仍缺逐对象规则子句表：每张卡 / 每个基地都还需要显式拆出 `C1/C2/C3...`
  - 仍缺按子句粒度的对象级证据行：当前矩阵是对象摘要，不是 effect atom / 子句级核销
  - 因此当前不能把“对象矩阵 + shared chain + direct E2E”直接升级表述成“新增派系全面审计完成”
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
- 但按当前新增派系 skill，规则子句 `C1/C2/C3...` 仍未逐对象显式落表；因此本批 longzu 三派系**还不能**对外表述为“全面审计完成”。
- 当前准确口径应为：`对象级矩阵与真实入口证据已补齐，但全面审计仍有残余范围`。
