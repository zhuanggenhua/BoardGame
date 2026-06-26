# Smash Up zhongguo 四派系实施审计底稿

日期：2026-06-23

## 结论等级

本文件证明 `zhongguo` 四派系已经从 intake 合同继续推进到**对象级 L2 行为验证清空待补证 + 8 条代表性 L3/L4 真实入口 E2E + 1 条基地计分服务端命令链补证**。

当前**不能**写成：

- 四派系玩法完成
- 四派系 L3/L4 收口
- 可发布口径已收口

当前更准确的结论是：

- `L0/L1`：四派系卡牌、基地、atlas、manifest 合同已存在，见 intake 合同
- `L2`：当前没有继续列为 `L2 未实现` 或 `L2 待补证` 的 zhongguo 新派系对象
- `L3/L4`：已新增“我会活下去”计分后真实入口 E2E、“复仇”计分后真实入口 E2E、“车友聚会”计分前真实入口 E2E、“节拍一转”计分前真实入口 E2E、“掌握时机”计分前真实入口 E2E、“平头彼特”天赋真实入口 E2E、“廉价小饭馆”基地计分后真实入口 E2E 与“卡车服务站”基地计分后真实入口 E2E；廉价小饭馆另有服务端计分命令链补证；四派系整体仍未收口
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
4. 功夫斗士
   - 快如闪电（`kung_fu_fighters_fast_as_lightning`）
   - 人人都是功夫高手（`kung_fu_fighters_everybody_was_kung_fu_fighting`）
   - 掌握时机（`kung_fu_fighters_expert_timing`）
5. 卡车车神
   - 平头彼特（`truckers_cab_over_pete`）
6. 本轮续做 L2 补证
   - 凶恶百倍（`vigilantes_a_whole_lot_meaner`）
   - 破萝飞龙（`vigilantes_stoneford`）
   - 杰基比尔（`vigilantes_jacky_bill`）
   - 街头正义（`vigilantes_street_justice`）
   - 打到穿越（`vigilantes_knocked_into_next_week`）
   - 狐狸翠（`vigilantes_foxy_green`）
   - 藏身处（`base_hideout`）
   - 修理（`truckers_fixin_to_fix_it`）
   - 装甲卡车（`truckers_armored_truck`）
7. 侠义义警第二批 L2 补证
   - 不屑一顾（`vigilantes_shrug_it_off`）
   - 直面恐惧（`vigilantes_scared_straight`）
   - 铁杆神探（`vigilantes_shift`）
   - 瞌睡的亨利（`vigilantes_dusty_henry`）
8. 迪厅舞王续做 L2 补证
   - 迪斯科·卢（`disco_dancers_ul_disco_lou`）
   - 迪斯科地狱（`disco_dancers_disco_inferno`）
   - 轮滑舞娘（`disco_dancers_roller`）
   - 庆祝（`disco_dancers_celebration`）
   - 男人雨（`disco_dancers_its_raining_men`）
   - 我很亢奋（`disco_dancers_im_so_excited`）
   - 最后的舞曲（`disco_dancers_last_dance`）
   - 活着（`disco_dancers_stayin_alive`）
9. 剩余基地与触发补证
   - 做个了断吧（`vigilantes_lets_finish_this`）
   - 时髦镇（`base_funky_town`）
   - 廉价小饭馆（`base_the_greasy_spoon`）
   - 卡车服务站（`base_truck_stop`）
   - 摇摆仙境（`base_boogie_wonderland`）
   - 险恶街区（`base_the_mean_streets`）
10. 行为修正
   - 修理（`truckers_fixin_to_fix_it`）从误用普通抽牌事件改为弃牌堆回手事件，L2 已证明弃牌堆战术进入手牌且不错误拿随从
   - 直面恐惧（`vigilantes_scared_straight`）不再依赖普通战术不存在的预选基地，改为从所有“你有随从”的基地选择其他玩家随从
   - 铁杆神探（`vigilantes_shift`）从只重排牌库改为真正把弃牌堆随从移到牌库顶，L2 已证明弃牌堆会移除目标随从
   - 做个了断吧（`vigilantes_lets_finish_this`）从普通卡定义查询改为基地定义查询，L2 已证明可按险恶街区临界点产生临时临界点修正
11. 静态语义修正
   - `truckers_rally` 改为 `special + beforeScoring + specialNeedsBase`
   - `truckers_turn_the_beat_around` 改为 `special + beforeScoring + specialNeedsBase`
   - `disco_dancers_i_will_survive` 已在本轮前半段修正为 `special + afterScoring + specialNeedsBase`
   - `vigilantes_the_revenge` 改为 `special + afterScoring + specialNeedsBase`
   - `kung_fu_fighters_expert_timing` 改为 `special + beforeScoring`，不强制计分基地目标；其实际效果选择牌/随从而不是选择计分基地
12. L3/L4 真实入口补证
   - 我会活下去（`disco_dancers_i_will_survive`）：新增真实页面 E2E，从出牌阶段点击“结束回合”进入计分响应窗口，在 `afterScoring` 窗口打出该 special，选择计分基地己方随从，最终断言随从回到手牌、计分基地移除该随从、`pendingAfterScoringSpecials` / `triggerQueue` / 交互 / 响应窗口清空
   - 复仇（`vigilantes_the_revenge`）：新增真实页面 E2E，从出牌阶段点击“结束回合”进入计分响应窗口，在 `afterScoring` 窗口打出该 special，选择计分基地己方随从，再选择另一基地，最终断言随从离开计分基地并移动到目标基地，且 `pendingAfterScoringSpecials` / `triggerQueue` / 交互 / 响应窗口清空
   - 车友聚会（`truckers_rally`）：新增真实页面 E2E，从出牌阶段点击“结束回合”进入计分前响应窗口，在 `beforeScoring` 窗口打出该 special，选择计分基地己方随从，最终断言按己方基地持续战术数量获得临时战力，并清理交互 / `triggerQueue`
   - 节拍一转（`truckers_turn_the_beat_around`）：新增真实页面 E2E，从出牌阶段点击“结束回合”进入计分前响应窗口，在 `beforeScoring` 窗口打出该 special，先选择计分基地己方随从获得 +1，再选择同基地一个随从获得 -1，最终断言双方临时战力修正正确落地，并清理交互 / 响应窗口 / `triggerQueue`
   - 掌握时机（`kung_fu_fighters_expert_timing`）：新增真实页面 E2E，从出牌阶段点击“结束回合”进入计分前响应窗口，在 `beforeScoring` 窗口打出该 special，选择“两者都做”，然后选择《神龙武者》作为额外天赋目标、选择《古老的中国艺术》作为标记来源、选择己方随从作为接收者，最终断言基地持续战术上的 `powerCounters` 清零、目标随从获得标记、额外天赋 metadata 落地，并清理交互 / 响应窗口 / `triggerQueue`
   - 平头彼特（`truckers_cab_over_pete`）：新增真实页面 E2E，在出牌阶段真实点击基地持续战术触发其天赋，先选择目标基地，再选择同基地另一张己方战术，最终断言《平头彼特》自身与被选战术一起移动到目标基地、`talentUsed` 落地，且 `triggerQueue` / 交互 / 响应窗口清空
   - 廉价小饭馆（`base_the_greasy_spoon`）：新增真实页面 E2E，从出牌阶段点击“结束回合”进入计分，最终断言在该基地有随从的双方各抓 1，并清理交互 / 响应窗口 / `triggerQueue`；另新增服务端计分命令链测试，从 `ADVANCE_PHASE` 到双方 `RESPONSE_PASS` 后验证基地 `afterScoring` 让在场双方各抓 1
   - 卡车服务站（`base_truck_stop`）：新增真实页面 E2E，从出牌阶段点击“结束回合”进入计分，最终断言该基地计分后把这里的随从移动到另一基地，并清理交互 / 响应窗口 / `triggerQueue`

## 本轮验证

已通过：

- `npx tsc --noEmit --pretty false`
- `npx eslint e2e/smashup/smashup-zhongguo-expert-timing-before-scoring.e2e.ts src/games/smashup/abilities/zhongguo.ts src/games/smashup/domain/types.ts src/games/smashup/domain/abilityHelpers.ts src/games/smashup/domain/reduce.ts src/games/smashup/domain/commands.ts src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts`（0 error；剩余 warning 主要为本仓库既有 shared/domain 层 warning）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts`（59 passed）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts src/games/smashup/__tests__/afterscoring-card-registration.test.ts src/games/smashup/__tests__/variantBindingRuntime.test.ts`（65 passed）
- `npm run test:e2e:file -- e2e/smashup/smashup-afterscoring-simple-complete.e2e.ts`（对照链路，1 passed）
- `npm run test:e2e:file -- e2e/smashup/smashup-zhongguo-i-will-survive.e2e.ts`（zhongguo 新增链路，1 passed）
- `npm run test:e2e:file -- e2e/smashup/smashup-zhongguo-rally-before-scoring.e2e.ts`（zhongguo 新增链路，1 passed）
- `npm run test:e2e:file -- e2e/smashup/smashup-zhongguo-greasy-spoon-base.e2e.ts`（zhongguo 新增基地链路，1 passed）
- `npm run test:e2e:file -- e2e/smashup/smashup-zhongguo-truck-stop-base.e2e.ts`（zhongguo 新增基地移动链路，1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-expert-timing-before-scoring.e2e.ts`（zhongguo 新增链路，1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-the-revenge.e2e.ts`（zhongguo 新增链路，1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-cab-over-pete-talent.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "节拍一转会先让计分基地目标随从 \\+1，再让同基地一个随从 -1"`（1 passed）
- `npx eslint e2e/smashup/smashup-zhongguo-turn-the-beat-around-before-scoring.e2e.ts`（0 error；3 warning，均为 E2E 夹具里的既有 `any` 风格）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-turn-the-beat-around-before-scoring.e2e.ts`（zhongguo 新增链路，1 passed）

新增 E2E 文件：

- `e2e/smashup/smashup-zhongguo-i-will-survive.e2e.ts`
- `e2e/smashup/smashup-zhongguo-the-revenge.e2e.ts`
- `e2e/smashup/smashup-zhongguo-rally-before-scoring.e2e.ts`
- `e2e/smashup/smashup-zhongguo-turn-the-beat-around-before-scoring.e2e.ts`
- `e2e/smashup/smashup-zhongguo-expert-timing-before-scoring.e2e.ts`
- `e2e/smashup/smashup-zhongguo-cab-over-pete-talent.e2e.ts`
- `e2e/smashup/smashup-zhongguo-greasy-spoon-base.e2e.ts`
- `e2e/smashup/smashup-zhongguo-truck-stop-base.e2e.ts`

新增截图证据：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-i-will-survive.e2e\计分后从真实响应窗口打出我会活下去，并把计分基地己方随从返回手牌\zhongguo-i-will-survive-after-scoring-window.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-i-will-survive.e2e\计分后从真实响应窗口打出我会活下去，并把计分基地己方随从返回手牌\zhongguo-i-will-survive-choose-minion.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-i-will-survive.e2e\计分后从真实响应窗口打出我会活下去，并把计分基地己方随从返回手牌\zhongguo-i-will-survive-final-state.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-the-revenge.e2e\计分后从真实响应窗口打出复仇，并把计分基地己方随从移到其他基地\zhongguo-the-revenge-after-scoring-window.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-the-revenge.e2e\计分后从真实响应窗口打出复仇，并把计分基地己方随从移到其他基地\zhongguo-the-revenge-choose-minion.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-the-revenge.e2e\计分后从真实响应窗口打出复仇，并把计分基地己方随从移到其他基地\zhongguo-the-revenge-choose-base.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-the-revenge.e2e\计分后从真实响应窗口打出复仇，并把计分基地己方随从移到其他基地\zhongguo-the-revenge-final-state.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-rally-before-scoring.e2e\计分前从真实响应窗口打出车友聚会，并给己方随从加临时战力\zhongguo-rally-before-scoring-window.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-rally-before-scoring.e2e\计分前从真实响应窗口打出车友聚会，并给己方随从加临时战力\zhongguo-rally-before-scoring-final-state.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-turn-the-beat-around-before-scoring.e2e\计分前从真实响应窗口打出节拍一转，先给己方随从-+1-再让同基地一个随从-1\zhongguo-turn-the-beat-around-window.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-turn-the-beat-around-before-scoring.e2e\计分前从真实响应窗口打出节拍一转，先给己方随从-+1-再让同基地一个随从-1\zhongguo-turn-the-beat-around-penalty.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-turn-the-beat-around-before-scoring.e2e\计分前从真实响应窗口打出节拍一转，先给己方随从-+1-再让同基地一个随从-1\zhongguo-turn-the-beat-around-final-state.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-expert-timing-before-scoring.e2e\计分前从真实响应窗口打出掌握时机，并把基地持续战术上的标记转给随从同时授予额外天赋\zhongguo-expert-timing-before-scoring-window.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-expert-timing-before-scoring.e2e\计分前从真实响应窗口打出掌握时机，并把基地持续战术上的标记转给随从同时授予额外天赋\zhongguo-expert-timing-mode.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-expert-timing-before-scoring.e2e\计分前从真实响应窗口打出掌握时机，并把基地持续战术上的标记转给随从同时授予额外天赋\zhongguo-expert-timing-source.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-expert-timing-before-scoring.e2e\计分前从真实响应窗口打出掌握时机，并把基地持续战术上的标记转给随从同时授予额外天赋\zhongguo-expert-timing-final-state.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-cab-over-pete-talent.e2e\真实点击平头彼特后，应移动自身到另一基地并把同基地另一张己方战术一起移动过去\zhongguo-cab-over-pete-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-cab-over-pete-talent.e2e\真实点击平头彼特后，应移动自身到另一基地并把同基地另一张己方战术一起移动过去\zhongguo-cab-over-pete-choose-base.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-cab-over-pete-talent.e2e\真实点击平头彼特后，应移动自身到另一基地并把同基地另一张己方战术一起移动过去\zhongguo-cab-over-pete-choose-card.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-cab-over-pete-talent.e2e\真实点击平头彼特后，应移动自身到另一基地并把同基地另一张己方战术一起移动过去\zhongguo-cab-over-pete-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-greasy-spoon-base.e2e\计分后廉价小饭馆应让在场双方各抓-1-张牌\zhongguo-greasy-spoon-before-scoring.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-greasy-spoon-base.e2e\计分后廉价小饭馆应让在场双方各抓-1-张牌\zhongguo-greasy-spoon-final-state.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-truck-stop-base.e2e\计分后卡车服务站应把这里的随从移动到另一个基地\zhongguo-truck-stop-before-scoring.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-truck-stop-base.e2e\计分后卡车服务站应把这里的随从移动到另一个基地\zhongguo-truck-stop-final-state.png`

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
- `kung_fu_fighters_fast_as_lightning`
- `kung_fu_fighters_dragon_warrior`
- `kung_fu_fighters_drunken_master`
- `kung_fu_fighters_lady_whirlwind`
- `kung_fu_fighters_ancient_chinese_art`
- `kung_fu_fighters_everybody_knew_their_part`
- `kung_fu_fighters_everybody_was_kung_fu_fighting`
- `kung_fu_fighters_expert_timing`
- `kung_fu_fighters_a_little_bit_frightening`
- `kung_fu_fighters_lets_get_it_on`
- `kung_fu_fighters_oh_hoh_hoh_hoah`
- `base_ancient_dojo`
- `base_tournament_site`

### 侠义义警（18 张牌 + 2 个基地）

`L2 已证实`

- `vigilantes_who_loves_ya_baby`
- `vigilantes_make_my_day`
- `vigilantes_death_wisher`
- `vigilantes_the_revenge`
- `vigilantes_brojak`
- `vigilantes_tough_it_out`
- `vigilantes_feeling_lucky`
- `vigilantes_a_whole_lot_meaner`
- `vigilantes_stoneford`
- `vigilantes_jacky_bill`
- `vigilantes_street_justice`
- `vigilantes_knocked_into_next_week`
- `vigilantes_foxy_green`
- `base_hideout`
- `vigilantes_shrug_it_off`
- `vigilantes_scared_straight`
- `vigilantes_shift`
- `vigilantes_dusty_henry`
- `vigilantes_lets_finish_this`
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
- `truckers_cab_over_pete`
- `truckers_fixin_to_fix_it`
- `truckers_armored_truck`
- `base_the_greasy_spoon`
- `base_truck_stop`

### 迪厅舞王（13 张牌 + 2 个基地）

`L2 已证实`

- `disco_dancers_get_down_tonight`
- `disco_dancers_diva`
- `disco_dancers_we_are_family`
- `disco_dancers_dancing_king`
- `disco_dancers_i_will_survive`
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

截至当前状态，前一版列出的 `4` 张明确未实现牌已经补到对象级 `L2` 行为验证：

- 快如闪电（`kung_fu_fighters_fast_as_lightning`）：打出选随从、本回合 +2、被消灭时改回拥有者手牌，且已补证“基地计分清场进入弃牌堆”也会改回拥有者手牌
- 人人都是功夫高手（`kung_fu_fighters_everybody_was_kung_fu_fighting`）：选基地后，该基地每位有随从的玩家各选另一位玩家随从并消灭
- 掌握时机（`kung_fu_fighters_expert_timing`）：计分前特殊窗口可打出，已覆盖“转移全部随从 +1 标记”“给己方随从额外一次天赋”以及“基地持续战术上的 +1 标记转移给随从”，并已有真实 `beforeScoring` 页面链路
- 平头彼特（`truckers_cab_over_pete`）：天赋转移自身到另一基地，并移动同基地另一张己方牌；当前 L2 已覆盖己方基地持续战术目标与己方随从目标

当前没有继续列为 `L2 未实现` 或 `L2 待补证` 的 zhongguo 新派系牌；但这不等于整批完成，见下方剩余项和残余风险。

## 当前批次剩余项

按优先级建议：

1. 继续补 `L3/L4`
   - 我会活下去（`disco_dancers_i_will_survive`）已覆盖真实页面按钮推进、`afterScoring` 响应窗口、最终状态清理
   - 车友聚会（`truckers_rally`）已覆盖真实页面按钮推进、`beforeScoring` 响应窗口、最终状态清理
   - 节拍一转（`truckers_turn_the_beat_around`）已覆盖真实页面按钮推进、`beforeScoring` 双段选择链、最终状态清理
   - 掌握时机（`kung_fu_fighters_expert_timing`）已覆盖真实页面按钮推进、`beforeScoring` 响应窗口、模式选择、额外天赋目标与基地持续战术标记转移
   - 廉价小饭馆（`base_the_greasy_spoon`）已覆盖服务端计分命令链与浏览器真实入口，并取得页面截图证据
   - 卡车服务站（`base_truck_stop`）已覆盖浏览器真实入口的计分后移动随从链路，并取得页面截图证据
   - 如继续加深基地能力覆盖，可继续补更多多对象交互和计分后替代清理路径
   - 仍需把 `reaction session` 的队列/清理状态纳入更多 representative 链路

## 本轮不宣称完成的原因

1. 当前已清空对象级 `L2` 待补证，但只有八条代表性真实入口 E2E，不能代表四派系 L3/L4 全收口
2. 我会活下去（`disco_dancers_i_will_survive`）、复仇（`vigilantes_the_revenge`）、车友聚会（`truckers_rally`）、节拍一转（`truckers_turn_the_beat_around`）、掌握时机（`kung_fu_fighters_expert_timing`）、平头彼特（`truckers_cab_over_pete`）、廉价小饭馆（`base_the_greasy_spoon`）与卡车服务站（`base_truck_stop`）已覆盖 `finalState / triggerQueue / 响应窗口或交互清理`，但更多多对象交互与更多 representative 链路仍缺 L4 页面证据
3. 本文件只是实施审计底稿，不是最终 rollup
