# Smash Up zhongguo 四派系实施审计底稿

日期：2026-06-23

## 结论等级

本文件只证明 `zhongguo` 四派系已经从 intake 合同继续推进到**对象级实现盘点 + 局部 L2 行为验证**。

当前**不能**写成：

- 四派系玩法完成
- 四派系对象级全面审计完成
- 四派系 L3/L4 收口
- 可发布口径已收口

当前更准确的结论是：

- `L0/L1`：四派系卡牌、基地、atlas、manifest 合同已存在，见 intake 合同
- `L2`：部分对象已有运行时行为测试
- `L3/L4`：四派系整体仍大面积缺失
- `整批状态`：仍在实施中

关联 intake 合同：

- `evidence/smashup/smashup-zhongguo-faction-intake-contract-2026-06-19.md`

## 本轮新增推进

本轮新增落地：

1. 迪厅舞王
   - `disco_dancers_diva`
   - `disco_dancers_we_are_family`
   - `disco_dancers_dancing_king`
   - `disco_dancers_i_will_survive`
2. 卡车车神
   - `truckers_rally`
   - `truckers_turn_the_beat_around`
3. 侠义义警
   - `vigilantes_death_wisher`
   - `vigilantes_the_revenge`
   - `vigilantes_brojak`
4. 静态语义修正
   - `truckers_rally` 改为 `special + beforeScoring + specialNeedsBase`
   - `truckers_turn_the_beat_around` 改为 `special + beforeScoring + specialNeedsBase`
   - `disco_dancers_i_will_survive` 已在本轮前半段修正为 `special + afterScoring + specialNeedsBase`
   - `vigilantes_the_revenge` 改为 `special + afterScoring + specialNeedsBase`

## 本轮验证

已通过：

- `npx tsc --noEmit --pretty false`
- `npx eslint src/games/smashup/abilities/zhongguo.ts src/games/smashup/data/factions/zhongguo.ts src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts`
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts`
- `npx vitest run src/games/smashup/__tests__/afterscoring-card-registration.test.ts`
- `npx vitest run src/games/smashup/__tests__/variantBindingRuntime.test.ts`

## 批次矩阵（按对象粒度分组）

说明：

- `L0/L1 已过`：静态接入、图面索引、locale、注册合同已存在
- `L2 已证实`：有当前可复查的运行时行为测试
- `L2 待补证`：代码里已有实现或保护/触发接入，但当前还没有明确对象级测试证据
- `L2 未实现`：当前连对象级玩法实现都还没落代码
- 本表**不把字符串命中、顺手当目标牌、间接出场**算作对象级测试证据

### 功夫斗士（12 张牌 + 2 个基地）

`L2 已证实`

- `kung_fu_fighters_cricket`
- `kung_fu_fighters_dragon_warrior`
- `kung_fu_fighters_drunken_master`
- `kung_fu_fighters_lady_whirlwind`
- `kung_fu_fighters_ancient_chinese_art`
- `kung_fu_fighters_everybody_knew_their_part`
- `kung_fu_fighters_a_little_bit_frightening`
- `kung_fu_fighters_lets_get_it_on`
- `kung_fu_fighters_oh_hoh_hoh_hoah`
- `base_ancient_dojo`
- `base_tournament_site`

`L2 未实现`

- `kung_fu_fighters_fast_as_lightning`
- `kung_fu_fighters_everybody_was_kung_fu_fighting`
- `kung_fu_fighters_expert_timing`

### 侠义义警（18 张牌 + 2 个基地）

`L2 已证实`

- `vigilantes_who_loves_ya_baby`
- `vigilantes_make_my_day`
- `vigilantes_death_wisher`
- `vigilantes_the_revenge`
- `vigilantes_brojak`
- `vigilantes_tough_it_out`
- `vigilantes_feeling_lucky`

`L2 待补证`

- `vigilantes_shrug_it_off`
- `vigilantes_scared_straight`
- `vigilantes_a_whole_lot_meaner`
- `vigilantes_stoneford`
- `vigilantes_jacky_bill`
- `vigilantes_street_justice`
- `vigilantes_shift`
- `vigilantes_dusty_henry`
- `vigilantes_knocked_into_next_week`
- `vigilantes_lets_finish_this`
- `vigilantes_foxy_green`
- `base_hideout`
- `base_the_mean_streets`

### 卡车车神（13 张牌 + 2 个基地）

`L2 已证实`

- `truckers_good_buddy`
- `truckers_hotwire`
- `truckers_skinny_minnie`
- `truckers_el_bandido`
- `truckers_high_speed_chase`
- `truckers_dekotora`
- `truckers_rubber_chicken`
- `truckers_convoy`
- `truckers_rally`
- `truckers_turn_the_beat_around`

`L2 待补证`

- `truckers_fixin_to_fix_it`
- `truckers_armored_truck`
- `base_the_greasy_spoon`
- `base_truck_stop`

`L2 未实现`

- `truckers_cab_over_pete`

### 迪厅舞王（13 张牌 + 2 个基地）

`L2 已证实`

- `disco_dancers_get_down_tonight`
- `disco_dancers_diva`
- `disco_dancers_we_are_family`
- `disco_dancers_dancing_king`
- `disco_dancers_i_will_survive`

`L2 待补证`

- `disco_dancers_ul_disco_lou`
- `disco_dancers_disco_inferno`
- `disco_dancers_roller`
- `disco_dancers_celebration`
- `disco_dancers_its_raining_men`
- `disco_dancers_im_so_excited`
- `disco_dancers_last_dance`
- `disco_dancers_stayin_alive`
- `base_funky_town`
- `base_boogie_wonderland`

## 当前明确未实现对象

截至本轮，确认还没落对象级玩法实现的卡：

- 功夫斗士：`3`
  - `kung_fu_fighters_fast_as_lightning`
  - `kung_fu_fighters_everybody_was_kung_fu_fighting`
  - `kung_fu_fighters_expert_timing`
- 卡车车神：`1`
  - `truckers_cab_over_pete`

合计：`4` 张牌仍是明确未实现。

## 当前批次剩余项

按优先级建议：

1. 先补明确未实现的 `4` 张牌
   - 功夫斗士 `3`
   - 卡车车神 `1`
2. 再补 `L2 待补证` 对象的对象级测试
   - 重点先补义警与迪厅的 ongoing / trigger / protection 家族
3. 最后再补 `L3/L4`
   - 真实计分前 / 计分后入口
   - reaction session
   - finalState / triggerQueue

## 本轮不宣称完成的原因

1. 仍有 `4` 张牌未实现
2. 仍有大量对象只有静态接入或代码接入，没有对象级测试
3. 还没有四派系的真实入口 E2E
4. 还没有四派系的 L4 收口证据
5. 本文件只是第一版批次清单，不是最终 rollup
