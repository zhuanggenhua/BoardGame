# Smash Up Oops POD 卡牌中文悬浮文案核对（2026-04-14）

## 范围

- 仅核对 `Ancient Egyptians / Cowboys / Samurai / Vikings` 四个派系的 `*_pod` 卡牌中文悬浮文案。
- 本轮只修 `public/locales/zh-CN/game-smashup.json` 中这些 `*_pod` 卡牌的 `abilityText / effectText`。
- 不扩散修改基础版同名卡的中文文案；基础版若仍有同类问题，后续再单独收口。

## 真相源

| 类型 | 路径 | 用途 |
| --- | --- | --- |
| 主真相源 | `public/locales/en/game-smashup.json` | 以当前仓库已接入的 POD 英文规则文本为准，核对每张 POD 卡的实际机制语义 |
| 对照源 | `public/locales/zh-CN/game-smashup.json` | 定位现有中文悬浮文案的乱码、漏词、数值错误与 POD 语义错位 |
| 对照源 | `src/games/smashup/data/factions/*_pod.ts` | 确认本轮 card id 清单与派系归属，避免误改到其他派系 |

## 本轮命中的问题类型

- 多张 `*_pod` 文案出现明显 OCR / 录入损坏，文本中包含乱码、错字、丢字、断句错位。
- 少数卡牌存在实质语义错误：
  - `ancient_egyptians_mummy_strength_pod` 把 `+4 power` 错写成了 `+3 战力`
  - `samurai_ronin_pod` 把 `two +1 power counters` 错写成了 `1 枚`
  - `vikings_berserk_pod` 把 `+4 power` 错写成了 `+3 战力`
- 若继续保留这些 zh 文案，POD 英文卡图上的中文悬浮层会直接向玩家显示错误规则。

## 本轮修复对象

- Ancient Egyptians POD:
  - `ancient_egyptians_mummy_pod`
  - `ancient_egyptians_pyramid_engineer_pod`
  - `ancient_egyptians_priest_of_anubis_pod`
  - `ancient_egyptians_pharaoh_pod`
  - `ancient_egyptians_lost_knowledge_pod`
  - `ancient_egyptians_you_can_take_it_with_you_pod`
  - `ancient_egyptians_plague_of_locusts_pod`
  - `ancient_egyptians_mummy_strength_pod`
  - `ancient_egyptians_tomb_trap_pod`
  - `ancient_egyptians_ancient_curse_pod`
  - `ancient_egyptians_blessing_of_anubis_pod`
  - `ancient_egyptians_seal_the_tomb_pod`
- Cowboys POD:
  - `cowboys_deputy_pod`
  - `cowboys_gunfighter_pod`
  - `cowboys_pinkerton_pod`
  - `cowboys_sheriff_pod`
  - `cowboys_form_a_posse_pod`
  - `cowboys_quick_draw_pod`
  - `cowboys_gold_in_them_thar_hills_pod`
  - `cowboys_stagecoach_pod`
  - `cowboys_run_em_off_pod`
  - `cowboys_high_noon_pod`
  - `cowboys_dynamite_surprise_pod`
  - `cowboys_gold_strike_pod`
- Samurai POD:
  - `samurai_samurai_chan_pod`
  - `samurai_ronin_pod`
  - `samurai_bushi_pod`
  - `samurai_shogun_pod`
  - `samurai_honor_the_fallen_pod`
  - `samurai_honorable_combat_pod`
  - `samurai_final_haiku_pod`
  - `samurai_heart_of_the_battle_pod`
  - `samurai_code_of_bushido_pod`
  - `samurai_honor_the_ancestors_pod`
  - `samurai_yokai_attack_pod`
  - `samurai_way_of_the_warrior_pod`
- Vikings POD:
  - `vikings_huscarl_pod`
  - `vikings_shield_maiden_pod`
  - `vikings_raider_pod`
  - `vikings_valkyrie_pod`
  - `vikings_ransack_pod`
  - `vikings_pillage_pod`
  - `vikings_viking_funeral_pod`
  - `vikings_cast_the_runes_pod`
  - `vikings_raiding_party_pod`
  - `vikings_berserk_pod`
  - `vikings_tribute_pod`
  - `vikings_combat_training_pod`

## 验证口径

- 静态核对：逐张把 `zh-CN` 的 `*_pod` 文案与 `en` POD 文案对齐。
- 关键回归点：
  - 木乃伊之力必须保留 `+4 / +2` 分支
  - 浪人 POD 必须是 `2 枚 +1 战力指示物`
  - 狂战 POD 必须是 `+4 战力`
- 运行环境限制：
  - 当前工作区缺少本地 `vitest / esbuild` 依赖，无法在本轮直接跑 Vitest，只能先完成静态核对与文件级校验。
