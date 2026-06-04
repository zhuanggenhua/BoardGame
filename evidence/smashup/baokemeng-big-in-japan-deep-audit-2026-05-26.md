# SmashUp baokemeng / Big in Japan 对象级深审矩阵（2026-05-26）

## 结论等级

- 当前结论：`对象级全面审计完成`
- 判定依据：
  - 本批对象全集已建表，逐对象写明 L2、direct L3/L4 或合法共享链复用依据。
  - 所有独立交互 family 均已有真实入口证据；不再存在“只到 L2 的待补 prompt/timing/cleanup 家族”。
  - 全量 direct E2E 已跑通：`npm run test:e2e:file -- e2e/smashup/smashup-baokemeng-big-in-japan.e2e.ts` -> `35 passed (3.9m)`。
- 本文档是当前批次“审计完毕”的权威证明；`baokemeng-big-in-japan-audit-2026-05-26.md` 为统一汇总版。

## 审计范围

- 派系：`Itty Critters`、`Kaiju`、`Magical Girls`、`Mega Troopers`
- 基地：`base_critter_combat_club`、`base_itty_city`、`base_tokyo`、`base_kaiju_island`、`base_akihabara_high`、`base_q_point`、`base_moon_dumpster`、`base_juice_bar`
- 权威来源：
  - `public/assets/i18n/zh-CN/smashup/cards/baokemeng.png`
  - `public/assets/i18n/zh-CN/smashup/base/baokemeng.png`
  - `evidence/smashup/baokemeng-big-in-japan-intake-2026-05-25.md`
- L2 证据：
  - `evidence/smashup/baokemeng-itty-critters-l2-2026-05-26.md`
  - `evidence/smashup/baokemeng-kaiju-l2-2026-05-26.md`
  - `evidence/smashup/baokemeng-magical-girls-l2-2026-05-26.md`
  - `evidence/smashup/baokemeng-mega-troopers-l2-2026-05-26.md`
- L3/L4 证据：
  - `e2e/smashup/smashup-baokemeng-big-in-japan.e2e.ts`
  - 截图根目录：`test-results/evidence-screenshots/smashup/smashup-baokemeng-big-in-japan.e2e/`

## 本轮 direct L3/L4 结果

- 真实入口覆盖总数：`35`
- 全量结果：`35 passed (3.9m)`
- 其中本轮补齐的末段家族包括：
  - Itty Critters：`super_effective`、`leafaroo`、`calicoin`、`tadpour`、`base_itty_city`
  - Kaiju：`pick_up_a_bus`、`they_say_hes_got_to_go`、`radioactive_breath`、`tail_smash`
  - Magical Girls：`coronet_attack`、`kiss_the_sky_spell`、`purge_the_demon`、`coordination`、`white_magicat`、`power_maid`
  - Mega Troopers：`lightning_crystal`、`its_blitzin_time`、`mega_attack`、`lightning_rescue`、`blitzing_sword_attack`、`yellow_trooper`、`pink_trooper`、`base_juice_bar`

## 对象级矩阵

状态约定：

- `通过`：对象级子句已由 L2 + direct L3/L4 或 L2 + 无玩家入口证据覆盖。
- `共享`：本对象复用同一共享链，且差异只剩配置项；复用依据已逐对象登记。

### Itty Critters

| 对象 | L2 | L3/L4 | 共享链 / 复用依据 | 当前结论 |
| --- | --- | --- | --- | --- |
| `itty_critters_i_select_you` | 有 | direct | `IC_TEMP_MINION_ANY_BASE`；牌库检索 -> 选随从 -> 选基地 -> 回合结束回底 | 通过 |
| `itty_critters_recall_critter` | 有 | shared | 与 `i_select_you` 共用 temporary minion choice/base prompt/return-bottom；差异仅来源区 `deck -> discard` | 共享 |
| `itty_critters_evolution` | 有 | direct | `IC_EVOLUTION_DESTROY_THEN_REPLACE` | 通过 |
| `itty_critters_gotta_get_em_all` | 有 | 无玩家入口 | 纯弃牌堆去重洗回 | 通过 |
| `itty_critters_critter_cube` | 有 | 无玩家入口 | 纯计数器加成；无 prompt | 通过 |
| `itty_critters_super_effective` | 有 | direct | `IC_DESTROY_ONGOING_CHOICE`；真实手牌行动选择附着行动 | 通过 |
| `itty_critters_ittypedia` | 有 | 无玩家入口 | 被动同基地随从打出后临时加力 | 通过 |
| `itty_critters_coach_combat` | 有 | 无玩家入口 | 纯加指示物；无 prompt | 通过 |
| `itty_critters_leafaroo` | 有 | direct | `IC_DISCARD_SHUFFLE_ONE`；真实打出入口选择弃牌洗回 | 通过 |
| `itty_critters_flooffairy` | 有 | direct | 在 `i_select_you` direct E2E 中真实出现并走 `跳过` | 通过 |
| `itty_critters_calicoin` | 有 | direct | `IC_OPTIONAL_MINION_EFFECT`；有合法目标时可真实跳过 | 通过 |
| `itty_critters_tadpour` | 有 | direct | `IC_MOVE_OTHER_MINION`；两段移动链真实触发 | 通过 |
| `itty_critters_krakatoad` | 有 | shared | 与 `calicoin/shellshock` 共用 optional minion effect family；差异仅 effect=`temp_power` | 共享 |
| `itty_critters_critter_coach` | 有 | shared | 与 `i_select_you` 共用 temporary deck minion family；差异仅固定基地为自身基地 | 共享 |
| `itty_critters_shellshock` | 有 | shared | 与 `calicoin/krakatoad` 共用 optional minion effect family；差异仅 effect=`destroy` | 共享 |
| `itty_critters_critter_champion` | 有 | 无玩家入口 | 纯 talent 加力量 | 通过 |
| `base_critter_combat_club` | 有 | direct | `IC_TEMP_MINION_FROM_HAND_FIXED_BASE` | 通过 |
| `base_itty_city` | 有 | direct | `IC_BASE_ITTY_CITY_TRIGGER_BUTTON`；首次打出后真实基地 prompt 触发 | 通过 |

### Kaiju

| 对象 | L2 | L3/L4 | 共享链 / 复用依据 | 当前结论 |
| --- | --- | --- | --- | --- |
| `kaiju_there_goes_tokyo` | 有 | direct | `KJ_TITAN_MOVE_AND_BASE_REPLACE` | 通过 |
| `kaiju_kaiju_conflict` | 有 | 无玩家入口 | 纯额外行动链的授予动作本体；无独立选择 prompt | 通过 |
| `kaiju_kaiju_alliance` | 有 | 无玩家入口 | 纯 breakpoint 修饰 | 通过 |
| `kaiju_pick_up_a_bus` | 有 | direct | `KJ_RECOVER_BASE_ACTION`；真实手牌行动多目标回收 | 通过 |
| `kaiju_they_say_hes_got_to_go` | 有 | direct | `KJ_MOVE_ANY_TITAN`；先选泰坦再选基地 | 通过 |
| `kaiju_oh_no` | 有 | shared | 与 `tiny_priestesses` 共用 `buildMoveOrPlayGorgodzollaEvents`；差异仅来源区 | 共享 |
| `kaiju_radioactive_breath` | 有 | direct | `KJ_OPTIONAL_MULTI_DESTROY`；真实多选消灭 + 持续 `+3` 总力量 | 通过 |
| `kaiju_the_folly_of_men` | 有 | 无玩家入口 | action-only protection/interceptor | 通过 |
| `kaiju_tail_smash` | 有 | direct | `KJ_REQUIRED_SINGLE_DESTROY`；真实单目标消灭 | 通过 |
| `kaiju_stomp` | 有 | direct | 在 `base_tokyo` direct E2E 中从真实手牌打到基地 | 通过 |
| `kaiju_wade_through_the_buildings` | 有 | 无玩家入口 | 纯 detach opposing actions | 通过 |
| `kaiju_johnny` | 有 | direct | `KJ_RETURN_ONGOING_AND_IMMEDIATE_REPLAY` | 通过 |
| `kaiju_tiny_priestesses` | 有 | shared | 与 `oh_no` 同 Gorgodzolla play/move chain，差异仅来源从随从改行动 | 共享 |
| `kaiju_kaijookey` | 有 | 无玩家入口 | 纯持续力量修正 | 通过 |
| `base_tokyo` | 有 | direct | `KJ_ACTION_TO_BASE_TEMP_BASE_POWER` | 通过 |
| `base_kaiju_island` | 有 | 无玩家入口 | 纯 titan count power modifier | 通过 |

### Magical Girls

| 对象 | L2 | L3/L4 | 共享链 / 复用依据 | 当前结论 |
| --- | --- | --- | --- | --- |
| `magical_girls_coronet_attack` | 有 | direct | `MG_DESTROY_MINION_TARGET`；真实手牌行动多候选消灭 | 通过 |
| `magical_girls_lunar_healing_love_spell` | 有 | direct | `MG_MULTI_RECOVER_PER_PLAYER` | 通过 |
| `magical_girls_magical_staff` | 有 | 无玩家入口 | 持续 +1 与 detach->deckTop interceptor | 通过 |
| `magical_girls_kiss_the_sky_spell` | 有 | direct | `MG_RECOVER_AND_EXTRA_ACTION`；真实手牌行动回手并接额外行动链 | 通过 |
| `magical_girls_purge_the_demon` | 有 | direct | `MG_DETACH_OR_REMOVE_COUNTERS`；真实 generic choice 消耗 | 通过 |
| `magical_girls_celestial_teleport` | 有 | direct | `MG_MOVE_OWN_MINION` | 通过 |
| `magical_girls_coordination` | 有 | direct | `MG_EXTRA_MINION_OR_PLAY_WALKING_CASTLE`；真实选 Walking Castle 分支 | 通过 |
| `magical_girls_silver_shard` | 有 | 无玩家入口 | 纯洗回各玩家弃牌堆随从 | 通过 |
| `magical_girls_lunar_captain` | 有 | 无玩家入口 | 纯数量缩放 talent | 通过 |
| `magical_girls_technomagical_lass` | 有 | 无玩家入口 | 纯数量缩放 talent | 通过 |
| `magical_girls_bewitching_gal` | 有 | 无玩家入口 | 纯数量缩放 talent | 通过 |
| `magical_girls_sakura_warrior` | 有 | 无玩家入口 | L2 已覆盖真实 target 消费；无额外 prompt family | 通过 |
| `magical_girls_rainbow_girl` | 有 | 无玩家入口 | 纯临时力量修正 | 通过 |
| `magical_girls_white_magicat` | 有 | direct | `MG_SEARCH_NAMED_MINION`；真实打出入口在牌库/弃牌堆同名目标间选择 | 通过 |
| `magical_girls_power_maid` | 有 | direct | `MG_TALENT_MOVE_OTHER_MINION`；真实天赋入口移动低力量随从 | 通过 |
| `magical_girls_black_magicat` | 有 | shared | 与 `white_magicat` 同 named minion search family；差异仅目标 defId / zone 组合 | 共享 |
| `magical_girls_fancy_suit_lad` | 有 | 无玩家入口 | protection only | 通过 |
| `base_akihabara_high` | 有 | 无玩家入口 | 同基地其他己方随从临时 +1 | 通过 |
| `base_q_point` | 有 | direct | `MG_BASE_Q_POINT_KEEP_ONE_PER_PLAYER` | 通过 |

### Mega Troopers

| 对象 | L2 | L3/L4 | 共享链 / 复用依据 | 当前结论 |
| --- | --- | --- | --- | --- |
| `mega_troopers_form_megabot` | 有 | direct | `MT_PLAY_OR_MOVE_MEGABOT_TO_ELIGIBLE_BASE` | 通过 |
| `mega_troopers_lightning_crystal` | 有 | direct | `MT_DESTROY_ACTION_ATTACHMENT`；真实手牌行动多行动目标选择 | 通过 |
| `mega_troopers_its_blitzin_time` | 有 | direct | `MT_TARGET_OWN_MINION_TEMP_POWER` | 通过 |
| `mega_troopers_mega_attack` | 有 | direct | `MT_DESTROY_BY_OWN_POWER_SUM` | 通过 |
| `mega_troopers_plan_for_more` | 有 | direct | `MT_REVEAL_TOP3_TAKE_PLAY_REORDER` | 通过 |
| `mega_troopers_red_trooper` | 有 | shared | 与 `form_megabot` 共用 `buildMegabotToBaseEvents`；差异仅门槛 `2 -> 1` | 共享 |
| `mega_troopers_lightning_rescue` | 有 | direct | `MT_SPECIAL_PLAY_EXTRA_ACTION`；真实 reaction 入口选手牌行动并接上 immediate extra action 链 | 通过 |
| `mega_troopers_blitzing_sword_attack` | 有 | direct | `MT_SPECIAL_DESTROY_IF_NOT_FIRST`；真实 reaction 入口消灭低力量随从 | 通过 |
| `mega_troopers_power_pose` | 有 | 无玩家入口 | 纯 special draw | 通过 |
| `mega_troopers_beta_6` | 有 | direct | `MT_BEFORE_SCORING_SELF_POWER_SPECIAL`；含 reaction session 与 `specialLimitUsed` | 通过 |
| `mega_troopers_blue_trooper` | 有 | shared | 与 `beta_6` 同 special family；差异仅数值 | 共享 |
| `mega_troopers_green_trooper` | 有 | 无玩家入口 | 纯 special 额外随从额度 | 通过 |
| `mega_troopers_yellow_trooper` | 有 | direct | `MT_SPECIAL_MOVE_OTHER_OWN_MINION`；真实 reaction 入口移动己方随从 | 通过 |
| `mega_troopers_pink_trooper` | 有 | direct | `MT_SPECIAL_RETURN_SMALL_OWN_MINION`；先让过前置 beforeScoring，再在 afterScoring 真实回手 | 通过 |
| `mega_troopers_black_trooper` | 有 | shared | 由 `beta_6` direct E2E 已真实证明 `SPECIAL_LIMIT_USED -> +1` interceptor | 共享 |
| `base_moon_dumpster` | 有 | 无玩家入口 | `onBaseRevealed` 自动 reveal/play | 通过 |
| `base_juice_bar` | 有 | direct | `MT_BASE_JUICE_BAR_BEFORE_SCORING_CHOOSE_MINION`；真实计分前基地 prompt 按已用 special 次数加力 | 通过 |

## 当前残余范围

- 本轮对象级审计残余：`无`
- 当前批次没有仍只到 L2 的独立交互 family。

## 已跑验证

| 命令 | 结果 |
| --- | --- |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/magical-girls.test.ts src/games/smashup/__tests__/abilities/itty-critters.test.ts src/games/smashup/__tests__/abilities/kaiju.test.ts src/games/smashup/__tests__/abilities/mega-troopers.test.ts src/games/smashup/__tests__/abilityRegistry.test.ts src/games/smashup/__tests__/abilityInteractionRegistry.test.ts --configLoader native` | `6 files / 82 tests passed` |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native` | `1 file / 27 tests passed` |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native` | `1 file / 7 tests passed` |
| `npm run typecheck` | `通过` |
| `npx eslint e2e/smashup/smashup-baokemeng-big-in-japan.e2e.ts` | `0 errors`，仅既有 `no-explicit-any` warnings |
| `npm run test:e2e:file -- e2e/smashup/smashup-baokemeng-big-in-japan.e2e.ts "Lightning Rescue"` | `1 passed` |
| `npm run test:e2e:file -- e2e/smashup/smashup-baokemeng-big-in-japan.e2e.ts "Blitzing Sword Attack"` | `1 passed` |
| `npm run test:e2e:file -- e2e/smashup/smashup-baokemeng-big-in-japan.e2e.ts "Yellow Trooper"` | `1 passed` |
| `npm run test:e2e:file -- e2e/smashup/smashup-baokemeng-big-in-japan.e2e.ts "Pink Trooper"` | `1 passed` |
| `npm run test:e2e:file -- e2e/smashup/smashup-baokemeng-big-in-japan.e2e.ts "Juice Bar"` | `1 passed` |
| `npm run test:e2e:file -- e2e/smashup/smashup-baokemeng-big-in-japan.e2e.ts "Lunar Healing Love Spell"` | `1 passed` |
| `npm run test:e2e:file -- e2e/smashup/smashup-baokemeng-big-in-japan.e2e.ts` | `35 passed (3.9m)` |

## 非阻塞后续项

- `kaiju.ts`、`magical_girls.ts`、`mega_troopers.ts` 仍在 legacy ability / interaction 注册层上运行；这是**后续工程演进债**，不是本轮对象级审计阻塞。
- `zombies.ts` legacy runtime 为历史基线债，不属于本批新增对象的审计缺口。

## 结论

- 旧“代表性玩法已验证”口径已失效，并已由本文件替换为对象级矩阵。
- 现在所有对象要么已有 direct L3/L4，要么已明确登记“同链路仅配置不同”的合法共享依据。
- 因此本批 `baokemeng / Big in Japan` 已满足“审计=彻底做到底，除非相同链路只是配置不同”的收口要求，可以对外表述为：`对象级全面审计完成`。
