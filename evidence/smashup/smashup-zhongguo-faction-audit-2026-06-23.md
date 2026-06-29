# Smash Up zhongguo 四派系实施审计底稿

日期：2026-06-23

## 结论等级

本文件证明 `zhongguo` 四派系已经从 intake 合同继续推进到**对象级 L2 行为验证清空待补证 + 64 个对象级 representative L3/L4 真实入口 E2E / 截图证据 + 1 条基地计分服务端命令链补证**。

当前更准确的结论是：

- `L0/L1`：四派系卡牌、基地、atlas、manifest 合同已存在，见 intake 合同
- `L2`：当前没有继续列为 `L2 未实现` 或 `L2 待补证` 的 zhongguo 新派系对象
- `L3/L4`：当前 `64` 个预期对象都已升级成“`e2e 文件 + 主收口图 + 看图结论`”粒度的 representative 证据；其中“男人雨”与“摇摆仙境”采用的是更直接证明交互合同的 prompt / ready 主图，而不是结算后的普通结果帧；廉价小饭馆另有服务端计分命令链补证
- `整批状态`：四派系对象级 representative 已全部人工核图收口

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
   - 掌握时机（`kung_fu_fighters_expert_timing`）：新增真实页面 E2E，从出牌阶段点击“结束回合”进入计分前响应窗口，在 `beforeScoring` 窗口打出该 special，选择“两者都做”，然后选择《神龙武者》作为额外天赋目标、选择《古老的中国艺术》作为标记来源、选择己方随从作为接收者；当前已证明基地持续战术上的 `powerCounters` 清零、目标随从获得标记、额外天赋 metadata 落地，并清理交互 / 响应窗口 / `triggerQueue`；现已补上真实页面“额外天赋”徽标，可肉眼直接证明“额外天赋已授予”
   - 快如闪电（`kung_fu_fighters_fast_as_lightning`）：新增真实页面 E2E，在出牌阶段打出该动作后先选择目标随从，真实断言目标获得 `+2` 临时战力；随后在同回合真实点击《旋风女侠》触发消灭链，最终断言目标随从不进弃牌堆而是回到拥有者手牌、《旋风女侠》获得 `+1` 力量指示物并标记 `talentUsed=true`，且 `triggerQueue` / 交互 / 响应窗口清空；当前页面语义已补证为“唯一合法目标时可直接结算，不一定弹独立目标 prompt”
   - 人人都是功夫高手（`kung_fu_fighters_everybody_was_kung_fu_fighting`）：新增真实页面 E2E，在出牌阶段打出该动作后，先选择目标基地，再由双方依次各选另一位玩家的随从执行消灭，最终断言双方目标都离场，且 `triggerQueue` / 交互 / 响应窗口清空
   - 平头彼特（`truckers_cab_over_pete`）：新增真实页面 E2E，在出牌阶段真实点击基地持续战术触发其天赋，先选择目标基地，再选择同基地另一张己方战术，最终断言《平头彼特》自身与被选战术一起移动到目标基地、`talentUsed` 落地，且 `triggerQueue` / 交互 / 响应窗口清空
   - 短路点火（`truckers_hotwire`）：新增真实页面 E2E，在出牌阶段打出该动作后，先选择目标基地持续战术，再选择“转移并控权”，最后选择目标基地，最终断言对方基地持续战术移入目标基地且控制权改为己方，并清理 `triggerQueue` / 交互 / 响应窗口
   - 高速追逐战（`truckers_high_speed_chase`）：新增真实页面 E2E，在出牌阶段真实点击基地持续战术触发其天赋，先选择己方随从，再选择目标基地，最终断言该随从与《高速追逐战》一起移动到目标基地、该随从获得 `+3` 临时战力、`talentUsed` 落地，并清理 `triggerQueue` / 交互 / 响应窗口
   - 暴走卡车（`truckers_dekotora`）：新增真实页面 E2E，在出牌阶段真实点击基地持续战术触发其天赋，先选择目标基地，再多选至多 3 个己方随从，最终断言《暴走卡车》自身与被选己方随从一起移动到目标基地、未选随从留在原基地、`talentUsed` 落地，并清理 `triggerQueue` / 交互 / 响应窗口
   - 埃尔班迪多（`truckers_el_bandido`）：新增真实页面 E2E，在出牌阶段把该随从打到目标基地后进入控权提示，选择对方基地战术，最终断言《埃尔班迪多》成功进场且目标基地战术控制权改为己方，并清理 `triggerQueue` / 交互 / 响应窗口
   - 埃尔班迪多（`truckers_el_bandido`）天赋转移：新增真实页面 E2E，真实点击《埃尔班迪多》触发天赋后，依次选择“转移”模式、目标基地战术和目标基地，最终断言目标基地战术被移到另一基地、保留原拥有者且不错误带上控权 metadata，并清理 `triggerQueue` / 交互 / 响应窗口
   - 直面恐惧（`vigilantes_scared_straight`）：新增真实页面 E2E，在出牌阶段打出该动作后先选择一名位于“你有随从的基地”的其他玩家随从，再选择目标基地；随后在同一真实页面断言已获得 1 次本回合额外战术额度，并继续实际打出《最后的舞曲》完成额度消费，最终断言目标随从完成移动、额外战术额度可消费、己方随从被消灭并获得 `1 VP`，且 `triggerQueue` / 交互 / 响应窗口清空
   - 铁杆神探（`vigilantes_shift`）：新增真实页面 E2E，在出牌阶段把该随从打到基地后，无交互直结算断言弃牌堆中至多两个随从被真实移到牌库顶、对应随从离开弃牌堆、非随从弃牌仍留在弃牌堆、《铁杆神探》成功进场，且 `triggerQueue` / 交互 / 响应窗口清空
   - 活着（`disco_dancers_stayin_alive`）：新增真实页面 E2E，在出牌阶段打出该动作后，直接断言弃牌堆中与己方场上同名的随从真实回到手牌、非同名弃牌仍留在弃牌堆、《活着》自身进入弃牌堆，且 `triggerQueue` / 交互 / 响应窗口清空
   - 庆祝（`disco_dancers_celebration`）：新增真实页面 E2E，在出牌阶段打出该动作后，先真实断言己方获得两次额外战术额度；随后在同回合继续实际打出两张《最后的舞曲》完成两次额度消费，最终断言两张额外战术都成功结算、两名己方目标随从离场、己方获得 `2 VP`，且 `actionsPlayed=3` / `actionLimit=3` / `triggerQueue` / 交互 / 响应窗口清空；当前页面前提已补证为需先关闭“已打出特写”遮罩再继续点手牌
   - 迪斯科地狱（`disco_dancers_disco_inferno`）：新增真实页面 E2E，在出牌阶段打出该动作后先选择目标随从，最终断言目标随从真实获得 `1` 枚力量指示物、己方真实抓到 `1` 张牌、《迪斯科地狱》进入弃牌堆，且 `actionsPlayed=1` / `triggerQueue` / 交互 / 响应窗口清空
   - 轮滑舞娘（`disco_dancers_roller`）：新增真实页面 E2E，在《迪斯科地狱》真实选择《轮滑舞娘》本人后，最终断言她先吃到《迪斯科地狱》的 `+1` 指示物，再因自身能力额外补 `1` 枚力量指示物，结算后总力量从 `2` 到 `4`，且 `triggerQueue` / 交互 / 响应窗口清空
   - 破萝飞龙（`vigilantes_stoneford`）：新增真实页面 E2E，在出牌阶段把该随从打到基地后，无交互直结算断言牌库中的第一张战术真实进手牌、该战术离开牌库、非战术仍按相对顺序留在牌库、《破萝飞龙》成功进场，且 `triggerQueue` / 交互 / 响应窗口清空
   - 瞌睡的亨利（`vigilantes_dusty_henry`）：新增真实页面 E2E，在出牌阶段把该随从打到基地后进入真实目标选择 prompt，选择本基地一个随从后，最终断言目标随从离开基地并洗回其拥有者牌库、《瞌睡的亨利》成功进场，且 `triggerQueue` / 交互 / 响应窗口清空
   - 修理（`truckers_fixin_to_fix_it`）：新增真实页面 E2E，在出牌阶段打出该动作后，无交互直结算断言弃牌堆中的战术真实回到手牌、非战术仍留在弃牌堆、《修理》自身进入弃牌堆，且 `actionsPlayed=1` / `triggerQueue` / 交互 / 响应窗口清空
   - 谁爱你，小老弟？（`vigilantes_who_loves_ya_baby`）：新增真实页面 E2E，在出牌阶段打出该动作后，无交互直结算断言仅按“你控制的战力 `4` 或更高随从”数量真实抓牌；当前场上只有两名己方高战力随从符合条件，因此只抓 `2` 张、不会把对手的高战力随从或己方低战力随从计入，且《谁爱你，小老弟？》进入弃牌堆、`triggerQueue` / 交互 / 响应窗口清空
   - 猛龙怪客（`vigilantes_death_wisher`）：新增真实页面 E2E，在对手席位设为 `human` 的最近真实入口上，由对手打出《一天的快乐》消灭你的低战力随从；随后真实进入《猛龙怪客》反杀 prompt，选择消灭者控制的一名随从后，最终断言被消灭的己方随从与被反杀的敌方随从都正确离场、抓牌与弃牌结算完成，且 `triggerQueue` / 交互 / 响应窗口清空
   - 不屑一顾（`vigilantes_shrug_it_off`）：新增真实页面 E2E，在《藏身处》保护已生效、且《不屑一顾》已在当前基地待触发的最近真实入口上，真实点击《不屑一顾》后再打出《打到穿越》；最终断言原本受《藏身处》保护的己方随从重新进入《打到穿越》目标列表，且被选中后真实离开《藏身处》、`talentUsed=true`、`triggerQueue` / 交互 / 响应窗口清空
   - 觉得运气不错？（`vigilantes_feeling_lucky`）：新增真实页面 E2E，在宿主随从已附着《觉得运气不错？》的最近真实入口上，由宿主控制者真实打出战术；最终断言宿主随从被立即消灭、附着一并离场、战术自身进入弃牌堆、抓牌结算完成，且 `triggerQueue` / 交互 / 响应窗口清空
   - 街头正义（`vigilantes_street_justice`）：新增真实页面 E2E，在保护持续战术已在场的最近真实入口上，由当前玩家打出《打到穿越》进入多目标选择 prompt；最终断言被《街头正义》保护的敌方随从不会出现在目标列表里，仅未受保护目标可选，且所选目标被洗回其拥有者牌库、未选目标仍留场、《打到穿越》进入弃牌堆，并清理 `triggerQueue` / 交互 / 响应窗口
   - 一天的快乐（`vigilantes_make_my_day`）：新增真实页面 E2E，在出牌阶段打出该动作后进入真实目标选择 prompt；最终断言只有“有己方随从基地中的战力 3 或更低随从”进入候选，高战力目标不会进入列表，且所选目标被消灭、己方真实抓到 `1` 张牌、《一天的快乐》进入弃牌堆，并清理 `triggerQueue` / 交互 / 响应窗口
   - 凶恶百倍（`vigilantes_a_whole_lot_meaner`）：新增真实页面 E2E，在出牌阶段打出该动作后进入真实目标选择 prompt；最终断言合法目标进入候选后，所选目标真实获得 `+3` 临时战力、未选目标不受影响、《凶恶百倍》进入弃牌堆，并清理 `triggerQueue` / 交互 / 响应窗口
   - 藏身处（`base_hideout`）：新增真实页面 E2E，在该基地保护已生效的最近真实入口上，由当前玩家打出《打到穿越》进入多目标选择 prompt；最终断言藏身处上的己方随从不会出现在目标列表里，仅基地外未受保护目标可选，且所选目标被洗回其拥有者牌库、未选目标仍留场、《打到穿越》进入弃牌堆，并清理 `triggerQueue` / 交互 / 响应窗口
   - 杰基比尔（`vigilantes_jacky_bill`）：新增真实页面 E2E，在出牌阶段先把《杰基比尔》打到基地，再推进到对手回合由对手把《街头正义》真实打到同基地；最终断言《杰基比尔》真实获得 `+2` 临时战力、对手基地战术成功落到该基地、交互 / 响应窗口 / `triggerQueue` 清空
   - 摇摆仙境（`base_boogie_wonderland`）：新增真实页面 E2E，从上一位玩家结束回合推进到你的 `startTurn`，真实断言页面先给出“立刻打出一个额外随从，或放弃这次机会”的低战力额外随从 prompt；随后选择《好伙伴》后直接落到《摇摆仙境》，最终断言该力量 2 随从成功进场、手牌移除、交互 / 响应窗口 / `triggerQueue` 清空；当前页面语义已补证为“单一合法基地时不再额外弹基地选择 prompt，而是直接结算到该基地”
   - 迪斯科·卢（`disco_dancers_ul_disco_lou`）：新增真实页面 E2E，在出牌阶段把该随从打到基地后，无交互直结算断言弃牌堆中的战术真实进入牌库顶、原牌库顶部顺延到第二位、目标战术离开弃牌堆、非战术弃牌仍留在弃牌堆、《迪斯科·卢》成功进场，且 `triggerQueue` / 交互 / 响应窗口清空
   - 今晚嗨起来（`disco_dancers_get_down_tonight`）与舞王（`disco_dancers_dancing_king`）：新增真实页面 E2E，在出牌阶段打出《今晚嗨起来》后先选择原目标随从，再进入《舞王》复制提示，选择同基地另一随从复制效果，最终断言原目标与复制目标都获得 `+2` 临时战力、且己方完成抓牌，并清理 `triggerQueue` / 交互 / 响应窗口
   - 我很亢奋（`disco_dancers_im_so_excited`）与神探布洛杰克（`vigilantes_brojak`）：新增真实页面 E2E，在出牌阶段打出《我很亢奋》后先选择己方随从、再选择目标基地，随后进入《神探布洛杰克》跟随提示，最终断言被移动随从与《神探布洛杰克》都到达目标基地、《神探布洛杰克》获得 `+1` 临时战力、且己方完成抓牌，并清理 `triggerQueue` / 交互 / 响应窗口
   - 最后的舞曲（`disco_dancers_last_dance`）：新增真实页面 E2E，在出牌阶段打出该动作后选择己方目标随从，最终断言目标随从被消灭进己方弃牌堆、己方获得 `1 VP`，且 `triggerQueue` / 交互 / 响应窗口清空
   - 男人雨（`disco_dancers_its_raining_men`）：新增真实页面 E2E，在普通随从额度已用完的出牌阶段打出该动作，先断言己方获得 1 次额外随从额度，再在同一真实页面继续打出额外随从，最终断言额外随从成功落到目标基地，且 `triggerQueue` / 交互 / 响应窗口清空
   - 打到穿越（`vigilantes_knocked_into_next_week`）：新增真实页面 E2E，在出牌阶段打出该动作后选择目标随从，最终断言目标随从离开基地并洗回其拥有者牌库，且 `triggerQueue` / 交互 / 响应窗口清空
   - 廉价小饭馆（`base_the_greasy_spoon`）：新增真实页面 E2E，从出牌阶段点击“结束回合”进入计分，最终断言在该基地有随从的双方各抓 1，并清理交互 / 响应窗口 / `triggerQueue`；另新增服务端计分命令链测试，从 `ADVANCE_PHASE` 到双方 `RESPONSE_PASS` 后验证基地 `afterScoring` 让在场双方各抓 1
   - 卡车服务站（`base_truck_stop`）：新增真实页面 E2E，从出牌阶段点击“结束回合”进入计分，最终断言该基地计分后把这里的随从移动到另一基地，并清理交互 / 响应窗口 / `triggerQueue`
   - 险恶街区（`base_the_mean_streets`）：新增真实页面 E2E，在《迪斯科地狱》真实选择本基地敌方随从后，最终断言目标先吃到动作本身的 `+1` 指示物，再因基地能力额外补 `1` 枚力量指示物，结算后总力量从 `2` 到 `4`，且 `triggerQueue` / 交互 / 响应窗口清空

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
- `npx eslint e2e/smashup/smashup-zhongguo-hotwire.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "短路点火可以把基地战术转移到另一个基地并获得控制权"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-hotwire.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx eslint e2e/smashup/smashup-zhongguo-high-speed-chase.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "高速追逐战天赋会转移自身、移动己方随从并给予 \\+3 战力"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-high-speed-chase.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx eslint e2e/smashup/smashup-zhongguo-dekotora.e2e.ts`（0 error；2 warning，均为 E2E 夹具中的 `any`）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "暴走卡车天赋会转移自身并移动至多 3 个己方随从"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-dekotora.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx eslint e2e/smashup/smashup-zhongguo-everybody-was-kung-fu-fighting.e2e.ts`（0 error）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-everybody-was-kung-fu-fighting.e2e.ts`（zhongguo 新增链路，1 passed；修正前提为 `seat1=human` 后通过）
- `npx eslint e2e/smashup/smashup-zhongguo-everybody-knew-their-part.e2e.ts`（0 error）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-everybody-knew-their-part.e2e.ts`（zhongguo 新增链路，1 passed；补正为把额外小随从打到已有己方基地战术的同基地后，通过真实进场 + 抓牌链路证明额外额度落地）
- `npx eslint e2e/smashup/smashup-zhongguo-a-little-bit-frightening.e2e.ts`（0 error）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-a-little-bit-frightening.e2e.ts`（zhongguo 新增链路，1 passed；真实证明先选参照随从，再消灭同基地更低战力随从，最后给己方目标放置 2 枚力量指示物）
- `npx eslint e2e/smashup/smashup-zhongguo-everybody-was-kung-fu-fighting.e2e.ts`（0 error）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-everybody-was-kung-fu-fighting.e2e.ts`（zhongguo 新增链路，1 passed；真实证明先选基地，再由双方依次各选另一位玩家的一个随从并消灭）
- `npx eslint e2e/smashup/smashup-zhongguo-high-speed-chase.e2e.ts`（0 error；保留既有 `no-explicit-any` warning）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-high-speed-chase.e2e.ts`（zhongguo 补图链路，1 passed；最终截图前显式关闭大卡预览后，主收口图已能肉眼证明《高速追逐战》与目标随从一起移动并获得 `+3` 临时战力）
- `npx eslint e2e/smashup/smashup-zhongguo-dekotora.e2e.ts`（0 error；保留既有 `no-explicit-any` warning）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-dekotora.e2e.ts`（zhongguo 补图链路，1 passed；最终截图前显式关闭大卡预览后，主收口图已能肉眼证明《暴走卡车》与两张己方随从一起移动，未选随从留在原基地）
- `npx eslint e2e/smashup/smashup-zhongguo-get-down-tonight-dancing-king.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "舞王会提示选择同基地另一个随从复制普通战术影响|就在今晚会给所选随从 \\+2 临时战力并抓牌"`（2 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-get-down-tonight-dancing-king.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx eslint e2e/smashup/smashup-zhongguo-im-so-excited-brojak.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "我很亢奋会移动己方随从到其他基地并抓牌|神探布洛杰克会在其他随从移动后跟随到同一基地并获得 \\+1 临时战力"`（2 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-im-so-excited-brojak.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx eslint e2e/smashup/smashup-zhongguo-last-dance.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "最后的舞曲会消灭自己的随从并获得 1 VP"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-last-dance.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx eslint e2e/smashup/smashup-zhongguo-its-raining-men.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "男人雨会给予一次额外随从额度"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-its-raining-men.e2e.ts`（zhongguo 新增链路，1 passed；补上关闭动作牌特写遮罩的页面前提后通过）
- `npx eslint e2e/smashup/smashup-zhongguo-knocked-into-next-week.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "打到穿越会把目标随从洗回其拥有者牌库"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-knocked-into-next-week.e2e.ts`（zhongguo 新增链路，1 passed；补成 2 个合法目标后真实选择 prompt 正常出现）
- `npx eslint e2e/smashup/smashup-zhongguo-el-bandido-take-control.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "埃尔班迪多打出时可以获得基地战术控制权"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-el-bandido-take-control.e2e.ts`（zhongguo 新增链路，1 passed；中途被外部 quality-gate 门禁阻塞一次，放开后重跑通过）
- `npx eslint e2e/smashup/smashup-zhongguo-el-bandido-transfer.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "埃尔班迪多天赋可转移基地战术到另一个基地"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-el-bandido-transfer.e2e.ts`（zhongguo 新增链路，1 passed；中途被外部 fantasyrealms 重任务门禁阻塞一次，放开后重跑通过）
- `npx eslint e2e/smashup/smashup-zhongguo-scared-straight.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "直面恐惧会移动有己方随从基地中的其他玩家随从并给予额外战术"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-scared-straight.e2e.ts`（zhongguo 新增链路，1 passed；补正为 banked 额外战术额度后，在同回合继续实际打出《最后的舞曲》完成消费）
- `npx eslint e2e/smashup/smashup-zhongguo-stayin-alive.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "活着会把弃牌堆中与己方场上同名的随从回手"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-stayin-alive.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx eslint e2e/smashup/smashup-zhongguo-fast-as-lightning.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "快如闪电会给予目标 \+2 战力并在本回合被消灭时改回手牌"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-fast-as-lightning.e2e.ts`（zhongguo 新增链路，1 passed；真实页面补证为唯一合法目标时《旋风女侠》可直接结算，不一定弹独立目标 prompt）
- `npx eslint e2e/smashup/smashup-zhongguo-shift.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "铁杆神探会把弃牌堆至多 2 个随从放到牌库顶并移出弃牌堆"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-shift.e2e.ts`（zhongguo 新增链路，1 passed；中途两次被全局内存预算门禁阻塞，等待可用内存回升后按原链路重跑通过）
- `npx eslint e2e/smashup/smashup-zhongguo-celebration.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "庆祝会给予两次额外战术额度"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-celebration.e2e.ts`（zhongguo 新增链路，1 passed；修正为先关闭已打出特写遮罩，再继续消费两次额外战术后通过）
- `npx eslint e2e/smashup/smashup-zhongguo-disco-inferno.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "迪斯科地狱会给目标随从 \+1 指示物并抓牌"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-disco-inferno.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx eslint e2e/smashup/smashup-zhongguo-stoneford.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "破萝飞龙打出时会找到牌库中的战术并抽到手牌"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-stoneford.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx eslint e2e/smashup/smashup-zhongguo-dusty-henry.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "瞌睡的亨利会把本基地一个随从洗回牌库"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-dusty-henry.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx eslint e2e/smashup/smashup-zhongguo-fixin-to-fix-it.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "修理会把弃牌堆中的战术回收到手牌"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-fixin-to-fix-it.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx eslint e2e/smashup/smashup-zhongguo-who-loves-ya-baby.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "谁爱你，小老弟？按己方战力 4 或更高随从数量抓牌"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-who-loves-ya-baby.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx eslint e2e/smashup/smashup-zhongguo-death-wisher.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "猛龙怪客会在其他玩家消灭别人随从后反杀其一个随从，且每回合仅一次"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-death-wisher.e2e.ts`（zhongguo 新增链路，1 passed；补正真实页前提为 `seat1=human` 后通过）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "不屑一顾天赋会压制所在基地能力|不屑一顾压制后，藏身处不应继续保护本基地己方随从"`（2 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-shrug-it-off.e2e.ts`（zhongguo 新增链路，1 passed；先修正“基地本体保护在基地被压制后仍继续生效”的实现缺口后通过）
- `npx eslint e2e/smashup/smashup-zhongguo-feeling-lucky.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "觉得运气不错？会在宿主控制者打出战术后消灭宿主"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-feeling-lucky.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx eslint e2e/smashup/smashup-zhongguo-street-justice-protection.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "街头正义会保护同基地己方随从不受其他玩家影响"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-street-justice-protection.e2e.ts`（zhongguo 新增链路，1 passed；先后修正为“保护已在场的最近真实入口 + 当前玩家真实打出《打到穿越》 + 至少两个未受保护合法目标”后通过）
- `npx eslint e2e/smashup/smashup-zhongguo-make-my-day.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "一天的快乐会消灭有己方随从基地中战力 3 或更低随从并抓牌"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-make-my-day.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx eslint e2e/smashup/smashup-zhongguo-a-whole-lot-meaner.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "凶恶百倍会给目标随从 \\+3 临时战力"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-a-whole-lot-meaner.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx eslint e2e/smashup/smashup-zhongguo-hideout-protection.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "藏身处会保护本基地己方随从不受其他玩家影响"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-hideout-protection.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx eslint e2e/smashup/smashup-zhongguo-jacky-bill.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "杰基比尔会在其他玩家打出战术后获得 \\+2 临时战力"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-jacky-bill.e2e.ts`（zhongguo 新增链路，1 passed；修正为“对手把《街头正义》真实打到同基地”后通过）
- `npx eslint e2e/smashup/smashup-zhongguo-boogie-wonderland-base.e2e.ts`（0 error；2 warning，均为测试内联谓词的既有 `any` 风格）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "摇摆仙境会在回合开始时给予 2 力量或更低随从额外随从额度"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-boogie-wonderland-base.e2e.ts`（zhongguo 新增链路，1 passed；先识别真实页面语义为 startTurn 立即额外随从 prompt，而非静默额度后通过）
- `npx eslint e2e/smashup/smashup-zhongguo-ul-disco-lou.e2e.ts`（0 error）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "迪斯科·卢会把弃牌堆中的战术放到牌库顶"`（1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-ul-disco-lou.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "轮滑舞娘|险恶街区"`（4 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-roller.e2e.ts`（zhongguo 新增链路，1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-mean-streets-base.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx vitest run src/games/smashup/__tests__/abilities/zhongguo-new-factions.test.ts --testNamePattern "做个了断吧|时髦镇|轮滑舞娘|险恶街区"`（8 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-funky-town-base.e2e.ts`（zhongguo 新增链路，1 passed）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-lets-finish-this.e2e.ts`（zhongguo 新增链路，1 passed；收口口径改为只验证“回合开始时把基地临界点降为 0”，不再把 `scoreBases` 才会锁定的 `scoringEligibleBaseIndices` 误算进同一合同）
- `npx eslint e2e/smashup/smashup-zhongguo-armored-truck-protection.e2e.ts`（0 error）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-armored-truck-protection.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx eslint e2e/smashup/smashup-zhongguo-tough-it-out-protection.e2e.ts`（0 error）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-tough-it-out-protection.e2e.ts`（zhongguo 新增链路，1 passed）
- `npx eslint e2e/smashup/smashup-zhongguo-convoy-base-power.e2e.ts`（0 error）
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-zhongguo-convoy-base-power.e2e.ts`（zhongguo 新增链路，1 passed）

新增 E2E 文件：

- `e2e/smashup/smashup-zhongguo-i-will-survive.e2e.ts`
- `e2e/smashup/smashup-zhongguo-the-revenge.e2e.ts`
- `e2e/smashup/smashup-zhongguo-rally-before-scoring.e2e.ts`
- `e2e/smashup/smashup-zhongguo-turn-the-beat-around-before-scoring.e2e.ts`
- `e2e/smashup/smashup-zhongguo-expert-timing-before-scoring.e2e.ts`
- `e2e/smashup/smashup-zhongguo-cab-over-pete-talent.e2e.ts`
- `e2e/smashup/smashup-zhongguo-hotwire.e2e.ts`
- `e2e/smashup/smashup-zhongguo-high-speed-chase.e2e.ts`
- `e2e/smashup/smashup-zhongguo-dekotora.e2e.ts`
- `e2e/smashup/smashup-zhongguo-everybody-was-kung-fu-fighting.e2e.ts`
- `e2e/smashup/smashup-zhongguo-get-down-tonight-dancing-king.e2e.ts`
- `e2e/smashup/smashup-zhongguo-im-so-excited-brojak.e2e.ts`
- `e2e/smashup/smashup-zhongguo-last-dance.e2e.ts`
- `e2e/smashup/smashup-zhongguo-its-raining-men.e2e.ts`
- `e2e/smashup/smashup-zhongguo-knocked-into-next-week.e2e.ts`
- `e2e/smashup/smashup-zhongguo-el-bandido-take-control.e2e.ts`
- `e2e/smashup/smashup-zhongguo-el-bandido-transfer.e2e.ts`
- `e2e/smashup/smashup-zhongguo-scared-straight.e2e.ts`
- `e2e/smashup/smashup-zhongguo-stayin-alive.e2e.ts`
- `e2e/smashup/smashup-zhongguo-fast-as-lightning.e2e.ts`
- `e2e/smashup/smashup-zhongguo-shift.e2e.ts`
- `e2e/smashup/smashup-zhongguo-celebration.e2e.ts`
- `e2e/smashup/smashup-zhongguo-disco-inferno.e2e.ts`
- `e2e/smashup/smashup-zhongguo-stoneford.e2e.ts`
- `e2e/smashup/smashup-zhongguo-boogie-wonderland-base.e2e.ts`
- `e2e/smashup/smashup-zhongguo-ul-disco-lou.e2e.ts`
- `e2e/smashup/smashup-zhongguo-dusty-henry.e2e.ts`
- `e2e/smashup/smashup-zhongguo-fixin-to-fix-it.e2e.ts`
- `e2e/smashup/smashup-zhongguo-who-loves-ya-baby.e2e.ts`
- `e2e/smashup/smashup-zhongguo-death-wisher.e2e.ts`
- `e2e/smashup/smashup-zhongguo-street-justice-protection.e2e.ts`
- `e2e/smashup/smashup-zhongguo-make-my-day.e2e.ts`
- `e2e/smashup/smashup-zhongguo-a-whole-lot-meaner.e2e.ts`
- `e2e/smashup/smashup-zhongguo-hideout-protection.e2e.ts`
- `e2e/smashup/smashup-zhongguo-jacky-bill.e2e.ts`
- `e2e/smashup/smashup-zhongguo-greasy-spoon-base.e2e.ts`
- `e2e/smashup/smashup-zhongguo-truck-stop-base.e2e.ts`
- `e2e/smashup/smashup-zhongguo-roller.e2e.ts`
- `e2e/smashup/smashup-zhongguo-mean-streets-base.e2e.ts`
- `e2e/smashup/smashup-zhongguo-funky-town-base.e2e.ts`
- `e2e/smashup/smashup-zhongguo-lets-finish-this.e2e.ts`
- `e2e/smashup/smashup-zhongguo-armored-truck-protection.e2e.ts`
- `e2e/smashup/smashup-zhongguo-tough-it-out-protection.e2e.ts`
- `e2e/smashup/smashup-zhongguo-convoy-base-power.e2e.ts`

新增截图证据：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-i-will-survive.e2e\计分后从真实响应窗口打出我会活下去，并把计分基地己方随从返回手牌\zhongguo-i-will-survive-after-scoring-window.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-i-will-survive.e2e\计分后从真实响应窗口打出我会活下去，并把计分基地己方随从返回手牌\zhongguo-i-will-survive-choose-minion.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-i-will-survive.e2e\计分后从真实响应窗口打出我会活下去，并把计分基地己方随从返回手牌\zhongguo-i-will-survive-final-state.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-the-revenge.e2e\计分后从真实响应窗口打出复仇，并把计分基地己方随从移到其他基地\zhongguo-the-revenge-after-scoring-window.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-the-revenge.e2e\计分后从真实响应窗口打出复仇，并把计分基地己方随从移到其他基地\zhongguo-the-revenge-choose-minion.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-the-revenge.e2e\计分后从真实响应窗口打出复仇，并把计分基地己方随从移到其他基地\zhongguo-the-revenge-choose-base.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-the-revenge.e2e\计分后从真实响应窗口打出复仇，并把计分基地己方随从移到其他基地\zhongguo-the-revenge-final-state.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-rally-before-scoring.e2e\计分前从真实响应窗口打出车友聚会，并给己方随从加临时战力\zhongguo-rally-before-scoring-window.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-rally-before-scoring.e2e\计分前从真实响应窗口打出车友聚会，并给己方随从加临时战力\zhongguo-rally-before-scoring-resolved-before-pass.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-rally-before-scoring.e2e\计分前从真实响应窗口打出车友聚会，并给己方随从加临时战力\zhongguo-rally-before-scoring-final-state.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-turn-the-beat-around-before-scoring.e2e\计分前从真实响应窗口打出节拍一转，先给己方随从-+1-再让同基地一个随从-1\zhongguo-turn-the-beat-around-window.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-turn-the-beat-around-before-scoring.e2e\计分前从真实响应窗口打出节拍一转，先给己方随从-+1-再让同基地一个随从-1\zhongguo-turn-the-beat-around-penalty.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-turn-the-beat-around-before-scoring.e2e\计分前从真实响应窗口打出节拍一转，先给己方随从-+1-再让同基地一个随从-1\zhongguo-turn-the-beat-around-resolved-before-pass.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-turn-the-beat-around-before-scoring.e2e\计分前从真实响应窗口打出节拍一转，先给己方随从-+1-再让同基地一个随从-1\zhongguo-turn-the-beat-around-final-state.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-expert-timing-before-scoring.e2e\计分前从真实响应窗口打出掌握时机，并把基地持续战术上的标记转给随从同时授予额外天赋\zhongguo-expert-timing-before-scoring-window.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-expert-timing-before-scoring.e2e\计分前从真实响应窗口打出掌握时机，并把基地持续战术上的标记转给随从同时授予额外天赋\zhongguo-expert-timing-mode.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-expert-timing-before-scoring.e2e\计分前从真实响应窗口打出掌握时机，并把基地持续战术上的标记转给随从同时授予额外天赋\zhongguo-expert-timing-source.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-expert-timing-before-scoring.e2e\计分前从真实响应窗口打出掌握时机，并把基地持续战术上的标记转给随从同时授予额外天赋\zhongguo-expert-timing-final-state.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-cab-over-pete-talent.e2e\真实点击平头彼特后，应移动自身到另一基地并把同基地另一张己方战术一起移动过去\zhongguo-cab-over-pete-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-cab-over-pete-talent.e2e\真实点击平头彼特后，应移动自身到另一基地并把同基地另一张己方战术一起移动过去\zhongguo-cab-over-pete-choose-base.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-cab-over-pete-talent.e2e\真实点击平头彼特后，应移动自身到另一基地并把同基地另一张己方战术一起移动过去\zhongguo-cab-over-pete-choose-card.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-cab-over-pete-talent.e2e\真实点击平头彼特后，应移动自身到另一基地并把同基地另一张己方战术一起移动过去\zhongguo-cab-over-pete-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-hotwire.e2e\打出短路点火后，应转移对方基地战术到另一基地并获得控制权\zhongguo-hotwire-action.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-hotwire.e2e\打出短路点火后，应转移对方基地战术到另一基地并获得控制权\zhongguo-hotwire-mode.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-hotwire.e2e\打出短路点火后，应转移对方基地战术到另一基地并获得控制权\zhongguo-hotwire-base.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-hotwire.e2e\打出短路点火后，应转移对方基地战术到另一基地并获得控制权\zhongguo-hotwire-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-high-speed-chase.e2e\真实点击高速追逐战后，应移动自身和己方随从到另一基地并给该随从-+3-临时战力\zhongguo-high-speed-chase-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-high-speed-chase.e2e\真实点击高速追逐战后，应移动自身和己方随从到另一基地并给该随从-+3-临时战力\zhongguo-high-speed-chase-minion.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-high-speed-chase.e2e\真实点击高速追逐战后，应移动自身和己方随从到另一基地并给该随从-+3-临时战力\zhongguo-high-speed-chase-base.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-high-speed-chase.e2e\真实点击高速追逐战后，应移动自身和己方随从到另一基地并给该随从-+3-临时战力\zhongguo-high-speed-chase-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-dekotora.e2e\真实点击暴走卡车后，应移动自身到另一基地并把至多两个己方随从一起移动过去\zhongguo-dekotora-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-dekotora.e2e\真实点击暴走卡车后，应移动自身到另一基地并把至多两个己方随从一起移动过去\zhongguo-dekotora-base.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-dekotora.e2e\真实点击暴走卡车后，应移动自身到另一基地并把至多两个己方随从一起移动过去\zhongguo-dekotora-minions.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-dekotora.e2e\真实点击暴走卡车后，应移动自身到另一基地并把至多两个己方随从一起移动过去\zhongguo-dekotora-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-everybody-was-kung-fu-fighting.e2e\打出人人都是功夫高手后，应先选基地，再让每位有随从的玩家各消灭另一位玩家的一个随从\zhongguo-everybody-was-base.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-everybody-was-kung-fu-fighting.e2e\打出人人都是功夫高手后，应先选基地，再让每位有随从的玩家各消灭另一位玩家的一个随从\zhongguo-everybody-was-player0-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-everybody-was-kung-fu-fighting.e2e\打出人人都是功夫高手后，应先选基地，再让每位有随从的玩家各消灭另一位玩家的一个随从\zhongguo-everybody-was-player1-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-everybody-was-kung-fu-fighting.e2e\打出人人都是功夫高手后，应先选基地，再让每位有随从的玩家各消灭另一位玩家的一个随从\zhongguo-everybody-was-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-get-down-tonight-dancing-king.e2e\打出今晚嗨起来后，应先给原目标-+2-并抓牌，再由舞王复制给同基地另一随从\zhongguo-get-down-tonight-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-get-down-tonight-dancing-king.e2e\打出今晚嗨起来后，应先给原目标-+2-并抓牌，再由舞王复制给同基地另一随从\zhongguo-dancing-king-copy.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-get-down-tonight-dancing-king.e2e\打出今晚嗨起来后，应先给原目标-+2-并抓牌，再由舞王复制给同基地另一随从\zhongguo-get-down-tonight-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-im-so-excited-brojak.e2e\打出我很亢奋后，应移动己方随从、抓牌，并让神探布洛杰克跟随到同一基地获得-+1-临时战力\zhongguo-im-so-excited-minion.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-im-so-excited-brojak.e2e\打出我很亢奋后，应移动己方随从、抓牌，并让神探布洛杰克跟随到同一基地获得-+1-临时战力\zhongguo-im-so-excited-base.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-im-so-excited-brojak.e2e\打出我很亢奋后，应移动己方随从、抓牌，并让神探布洛杰克跟随到同一基地获得-+1-临时战力\zhongguo-brojak-follow.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-im-so-excited-brojak.e2e\打出我很亢奋后，应移动己方随从、抓牌，并让神探布洛杰克跟随到同一基地获得-+1-临时战力\zhongguo-im-so-excited-brojak-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-last-dance.e2e\打出最后的舞曲后，应消灭己方目标随从并获得-1-VP\zhongguo-last-dance-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-last-dance.e2e\打出最后的舞曲后，应消灭己方目标随从并获得-1-VP\zhongguo-last-dance-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-its-raining-men.e2e\打出男人雨后，在普通随从额度已用完时仍应允许再打出一个随从\zhongguo-its-raining-men-extra-minion-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-its-raining-men.e2e\打出男人雨后，在普通随从额度已用完时仍应允许再打出一个随从\zhongguo-its-raining-men-extra-minion-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-knocked-into-next-week.e2e\打出打到穿越后，应把目标随从洗回其拥有者牌库\zhongguo-knocked-into-next-week-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-knocked-into-next-week.e2e\打出打到穿越后，应把目标随从洗回其拥有者牌库\zhongguo-knocked-into-next-week-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-el-bandido-take-control.e2e\打出埃尔班迪多后，应提示选择基地战术并获得其控制权\zhongguo-el-bandido-take-control-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-el-bandido-take-control.e2e\打出埃尔班迪多后，应提示选择基地战术并获得其控制权\zhongguo-el-bandido-take-control-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-el-bandido-transfer.e2e\真实点击埃尔班迪多后，应把基地战术转移到另一基地\zhongguo-el-bandido-transfer-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-el-bandido-transfer.e2e\真实点击埃尔班迪多后，应把基地战术转移到另一基地\zhongguo-el-bandido-transfer-mode.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-el-bandido-transfer.e2e\真实点击埃尔班迪多后，应把基地战术转移到另一基地\zhongguo-el-bandido-transfer-action.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-el-bandido-transfer.e2e\真实点击埃尔班迪多后，应把基地战术转移到另一基地\zhongguo-el-bandido-transfer-base.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-el-bandido-transfer.e2e\真实点击埃尔班迪多后，应把基地战术转移到另一基地\zhongguo-el-bandido-transfer-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-scared-straight.e2e\打出直面恐惧后，应移动对手随从并立刻获得一次可实际打出的额外战术\zhongguo-scared-straight-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-scared-straight.e2e\打出直面恐惧后，应移动对手随从并立刻获得一次可实际打出的额外战术\zhongguo-scared-straight-base.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-scared-straight.e2e\打出直面恐惧后，应移动对手随从并立刻获得一次可实际打出的额外战术\zhongguo-scared-straight-extra-action-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-scared-straight.e2e\打出直面恐惧后，应移动对手随从并立刻获得一次可实际打出的额外战术\zhongguo-scared-straight-extra-action-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-scared-straight.e2e\打出直面恐惧后，应移动对手随从并立刻获得一次可实际打出的额外战术\zhongguo-scared-straight-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-stayin-alive.e2e\打出活着后，应把弃牌堆中与己方场上同名的随从回手\zhongguo-stayin-alive-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-stayin-alive.e2e\打出活着后，应把弃牌堆中与己方场上同名的随从回手\zhongguo-stayin-alive-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-fast-as-lightning.e2e\打出快如闪电后，应给目标-+2-战力并在本回合被消灭时改回手牌\zhongguo-fast-as-lightning-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-fast-as-lightning.e2e\打出快如闪电后，应给目标-+2-战力并在本回合被消灭时改回手牌\zhongguo-fast-as-lightning-buffed.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-fast-as-lightning.e2e\打出快如闪电后，应给目标-+2-战力并在本回合被消灭时改回手牌\zhongguo-fast-as-lightning-lady-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-fast-as-lightning.e2e\打出快如闪电后，应给目标-+2-战力并在本回合被消灭时改回手牌\zhongguo-fast-as-lightning-opponent-hand-empty-before.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-fast-as-lightning.e2e\打出快如闪电后，应给目标-+2-战力并在本回合被消灭时改回手牌\zhongguo-fast-as-lightning-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-fast-as-lightning.e2e\打出快如闪电后，应给目标-+2-战力并在本回合被消灭时改回手牌\zhongguo-fast-as-lightning-opponent-hand.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-shift.e2e\打出铁杆神探后，应把弃牌堆至多两个随从放到牌库顶并移出弃牌堆\zhongguo-shift-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-shift.e2e\打出铁杆神探后，应把弃牌堆至多两个随从放到牌库顶并移出弃牌堆\zhongguo-shift-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-celebration.e2e\打出庆祝后，应获得两次可实际消费的额外战术额度\zhongguo-celebration-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-celebration.e2e\打出庆祝后，应获得两次可实际消费的额外战术额度\zhongguo-celebration-extra-actions-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-celebration.e2e\打出庆祝后，应获得两次可实际消费的额外战术额度\zhongguo-celebration-first-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-celebration.e2e\打出庆祝后，应获得两次可实际消费的额外战术额度\zhongguo-celebration-second-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-celebration.e2e\打出庆祝后，应获得两次可实际消费的额外战术额度\zhongguo-celebration-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-disco-inferno.e2e\打出迪斯科地狱后，应给目标随从放置-1-枚力量指示物并抓-1-张牌\zhongguo-disco-inferno-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-disco-inferno.e2e\打出迪斯科地狱后，应给目标随从放置-1-枚力量指示物并抓-1-张牌\zhongguo-disco-inferno-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-stoneford.e2e\打出破萝飞龙后，应找到牌库中的第一张战术并抽到手牌\zhongguo-stoneford-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-stoneford.e2e\打出破萝飞龙后，应找到牌库中的第一张战术并抽到手牌\zhongguo-stoneford-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-dusty-henry.e2e\打出瞌睡的亨利后，应选择本基地一个随从洗回其拥有者牌库\zhongguo-dusty-henry-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-dusty-henry.e2e\打出瞌睡的亨利后，应选择本基地一个随从洗回其拥有者牌库\zhongguo-dusty-henry-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-fixin-to-fix-it.e2e\打出修理后，应把弃牌堆中的战术回收到手牌\zhongguo-fixin-to-fix-it-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-fixin-to-fix-it.e2e\打出修理后，应把弃牌堆中的战术回收到手牌\zhongguo-fixin-to-fix-it-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-who-loves-ya-baby.e2e\打出谁爱你，小老弟？后，应按己方战力-4-或更高随从数量抓牌\zhongguo-who-loves-ya-baby-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-who-loves-ya-baby.e2e\打出谁爱你，小老弟？后，应按己方战力-4-或更高随从数量抓牌\zhongguo-who-loves-ya-baby-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-death-wisher.e2e\对手消灭你的随从后，应触发猛龙怪客反杀对手一个随从，且清理交互队列\zhongguo-death-wisher-destroy-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-death-wisher.e2e\对手消灭你的随从后，应触发猛龙怪客反杀对手一个随从，且清理交互队列\zhongguo-death-wisher-revenge-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-death-wisher.e2e\对手消灭你的随从后，应触发猛龙怪客反杀对手一个随从，且清理交互队列\zhongguo-death-wisher-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-shrug-it-off.e2e\真实点击不屑一顾后，应压制当前基地能力，让原本受藏身处保护的随从重新进入打到穿越目标列表\zhongguo-shrug-it-off-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-shrug-it-off.e2e\真实点击不屑一顾后，应压制当前基地能力，让原本受藏身处保护的随从重新进入打到穿越目标列表\zhongguo-shrug-it-off-suppressed.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-shrug-it-off.e2e\真实点击不屑一顾后，应压制当前基地能力，让原本受藏身处保护的随从重新进入打到穿越目标列表\zhongguo-shrug-it-off-target-options.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-shrug-it-off.e2e\真实点击不屑一顾后，应压制当前基地能力，让原本受藏身处保护的随从重新进入打到穿越目标列表\zhongguo-shrug-it-off-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-feeling-lucky.e2e\宿主控制者真实打出战术后，应让附着了觉得运气不错？的宿主随从被消灭\zhongguo-feeling-lucky-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-feeling-lucky.e2e\宿主控制者真实打出战术后，应让附着了觉得运气不错？的宿主随从被消灭\zhongguo-feeling-lucky-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-street-justice-protection.e2e\街头正义在基地生效后，对手的打到穿越目标列表里不应出现被保护的己方随从\zhongguo-street-justice-protection-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-street-justice-protection.e2e\街头正义在基地生效后，对手的打到穿越目标列表里不应出现被保护的己方随从\zhongguo-street-justice-protection-target-options.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-street-justice-protection.e2e\街头正义在基地生效后，对手的打到穿越目标列表里不应出现被保护的己方随从\zhongguo-street-justice-protection-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-make-my-day.e2e\打出一天的快乐后，应只允许选择有己方随从基地中战力-3-或更低的随从，并在消灭后抓-1-张牌\zhongguo-make-my-day-target-options.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-make-my-day.e2e\打出一天的快乐后，应只允许选择有己方随从基地中战力-3-或更低的随从，并在消灭后抓-1-张牌\zhongguo-make-my-day-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-a-whole-lot-meaner.e2e\打出凶恶百倍后，应给目标随从-+3-临时战力并完成结算清理\zhongguo-a-whole-lot-meaner-target-options.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-a-whole-lot-meaner.e2e\打出凶恶百倍后，应给目标随从-+3-临时战力并完成结算清理\zhongguo-a-whole-lot-meaner-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-hideout-protection.e2e\藏身处生效时，对手的打到穿越目标列表里不应出现该基地的己方随从\zhongguo-hideout-protection-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-hideout-protection.e2e\藏身处生效时，对手的打到穿越目标列表里不应出现该基地的己方随从\zhongguo-hideout-protection-target-options.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-hideout-protection.e2e\藏身处生效时，对手的打到穿越目标列表里不应出现该基地的己方随从\zhongguo-hideout-protection-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-jacky-bill.e2e\打出杰基比尔后，对手在同基地打出战术时应让其获得-+2-临时战力\zhongguo-jacky-bill-played.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-jacky-bill.e2e\打出杰基比尔后，对手在同基地打出战术时应让其获得-+2-临时战力\zhongguo-jacky-bill-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-greasy-spoon-base.e2e\计分后廉价小饭馆应让在场双方各抓-1-张牌\zhongguo-greasy-spoon-before-scoring.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-greasy-spoon-base.e2e\计分后廉价小饭馆应让在场双方各抓-1-张牌\zhongguo-greasy-spoon-final-state.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-truck-stop-base.e2e\计分后卡车服务站应把这里的随从移动到另一个基地\zhongguo-truck-stop-before-scoring.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-truck-stop-base.e2e\计分后卡车服务站应把这里的随从移动到另一个基地\zhongguo-truck-stop-final-state.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-roller.e2e\用迪斯科地狱影响轮滑舞娘时，若她原本没有力量指示物，应再给自己补-1-枚\zhongguo-roller-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-roller.e2e\用迪斯科地狱影响轮滑舞娘时，若她原本没有力量指示物，应再给自己补-1-枚\zhongguo-roller-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-mean-streets-base.e2e\在险恶街区用战术影响这里的敌方随从后，应让该敌方随从额外获得-1-枚力量指示物\zhongguo-mean-streets-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-mean-streets-base.e2e\在险恶街区用战术影响这里的敌方随从后，应让该敌方随从额外获得-1-枚力量指示物\zhongguo-mean-streets-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-funky-town-base.e2e\在时髦镇打出影响本基地随从的战术后，应额外给该随从-1-枚力量指示物\zhongguo-funky-town-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-funky-town-base.e2e\在时髦镇打出影响本基地随从的战术后，应额外给该随从-1-枚力量指示物\zhongguo-funky-town-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-lets-finish-this.e2e\控制者回合开始时，若基地上有双方随从，应把该基地临界点降为-0\zhongguo-lets-finish-this-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-tough-it-out-protection.e2e\咬紧牙关附着生效时，对手的一天的快乐目标列表里不应出现宿主随从\zhongguo-tough-it-out-protection-target-options.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-tough-it-out-protection.e2e\咬紧牙关附着生效时，对手的一天的快乐目标列表里不应出现宿主随从\zhongguo-tough-it-out-protection-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-convoy-base-power.e2e\车队在真实页面应只按各自控制的同基地基地战术数量提供基地力量\zhongguo-convoy-base-power-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-convoy-base-power.e2e\车队在真实页面应只按各自控制的同基地基地战术数量提供基地力量\zhongguo-convoy-base-power-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-rubber-chicken-power.e2e\橡皮鸡在真实页面应只按本基地己方基地战术数量获得持续战力\zhongguo-rubber-chicken-power-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-rubber-chicken-power.e2e\橡皮鸡在真实页面应只按本基地己方基地战术数量获得持续战力\zhongguo-rubber-chicken-power-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-foxy-green-counter.e2e\其他玩家在同基地影响随从时，狐狸翠应获得-1-枚力量指示物\zhongguo-foxy-green-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-foxy-green-counter.e2e\其他玩家在同基地影响随从时，狐狸翠应获得-1-枚力量指示物\zhongguo-foxy-green-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-good-buddy-draw.e2e\打出好伙伴到已有己方基地战术的基地后，应抓-1-张牌\zhongguo-good-buddy-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-good-buddy-draw.e2e\打出好伙伴到已有己方基地战术的基地后，应抓-1-张牌\zhongguo-good-buddy-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-skinny-minnie-talent.e2e\真实点击皮包骨米妮后，应移动自己并转移同基地战术\zhongguo-skinny-minnie-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-skinny-minnie-talent.e2e\真实点击皮包骨米妮后，应移动自己并转移同基地战术\zhongguo-skinny-minnie-base.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-skinny-minnie-talent.e2e\真实点击皮包骨米妮后，应移动自己并转移同基地战术\zhongguo-skinny-minnie-action.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-skinny-minnie-talent.e2e\真实点击皮包骨米妮后，应移动自己并转移同基地战术\zhongguo-skinny-minnie-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-drunken-master-talent.e2e\真实点击醉酒宗师后，应给自己放置-1-枚力量指示物并完成结算清理\zhongguo-drunken-master-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-drunken-master-talent.e2e\真实点击醉酒宗师后，应给自己放置-1-枚力量指示物并完成结算清理\zhongguo-drunken-master-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-lady-whirlwind-talent.e2e\真实点击旋风女侠后，应消灭更低战力随从并给自己放置-1-枚力量指示物\zhongguo-lady-whirlwind-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-lady-whirlwind-talent.e2e\真实点击旋风女侠后，应消灭更低战力随从并给自己放置-1-枚力量指示物\zhongguo-lady-whirlwind-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-lady-whirlwind-talent.e2e\真实点击旋风女侠后，应消灭更低战力随从并给自己放置-1-枚力量指示物\zhongguo-lady-whirlwind-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-diva.e2e\打出今晚嗨起来影响同基地己方随从后，主唱应自动复制同样的普通战术影响\zhongguo-diva-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-diva.e2e\打出今晚嗨起来影响同基地己方随从后，主唱应自动复制同样的普通战术影响\zhongguo-diva-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-we-are-family.e2e\打出今晚嗨起来影响宿主同基地其他己方随从后，我们是一家人应让宿主自动复制同样的普通战术影响\zhongguo-we-are-family-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-we-are-family.e2e\打出今晚嗨起来影响宿主同基地其他己方随从后，我们是一家人应让宿主自动复制同样的普通战术影响\zhongguo-we-are-family-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-ancient-chinese-art.e2e\真实点击古老的中国艺术后，应给本基地目标随从放置-1-枚力量指示物并完成结算清理\zhongguo-ancient-chinese-art-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-ancient-chinese-art.e2e\真实点击古老的中国艺术后，应给本基地目标随从放置-1-枚力量指示物并完成结算清理\zhongguo-ancient-chinese-art-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-ancient-chinese-art.e2e\真实点击古老的中国艺术后，应给本基地目标随从放置-1-枚力量指示物并完成结算清理\zhongguo-ancient-chinese-art-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-cricket.e2e\打出蟋蟀后，应依次选择标记来源与目标，并转移-1-枚力量指示物\zhongguo-cricket-source.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-cricket.e2e\打出蟋蟀后，应依次选择标记来源与目标，并转移-1-枚力量指示物\zhongguo-cricket-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-cricket.e2e\打出蟋蟀后，应依次选择标记来源与目标，并转移-1-枚力量指示物\zhongguo-cricket-resolved.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-oh-hoh-hoh-hoah.e2e\对手在同基地打出随从后，哦吼吼吼吼啊应让你给己方目标随从放置-1-枚力量指示物并完成结算清理\zhongguo-oh-hoh-hoh-hoah-ready.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-oh-hoh-hoh-hoah.e2e\对手在同基地打出随从后，哦吼吼吼吼啊应让你给己方目标随从放置-1-枚力量指示物并完成结算清理\zhongguo-oh-hoh-hoh-hoah-target.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-oh-hoh-hoh-hoah.e2e\对手在同基地打出随从后，哦吼吼吼吼啊应让你给己方目标随从放置-1-枚力量指示物并完成结算清理\zhongguo-oh-hoh-hoh-hoah-resolved.png`

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

`L3/L4 representative 已补证`

- `kung_fu_fighters_drunken_master`：`e2e/smashup/smashup-zhongguo-drunken-master-talent.e2e.ts` 已证明“真实页面中点击《醉酒宗师》后，会立即给自己放置 1 枚力量指示物、进入已用态，并完成交互 / 响应窗口 / 队列清理”
- `kung_fu_fighters_lady_whirlwind`：`e2e/smashup/smashup-zhongguo-lady-whirlwind-talent.e2e.ts` 已证明“真实页面中点击《旋风女侠》后，会进入目标选择 prompt，消灭同基地更低战力随从，给自己放置 1 枚力量指示物，并完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-lady-whirlwind-talent.e2e\真实点击旋风女侠后，应消灭更低战力随从并给自己放置-1-枚力量指示物\zhongguo-lady-whirlwind-resolved.png`
  - 看图结论：左侧《廉价小饭馆》下只剩《旋风女侠》和另一张低战力随从；被选中的目标已经离场；《旋风女侠》左上有 `+1` 力量指示物且牌面显示“已用”；页面中没有残留交互壳层，可作为本条 representative 的主收口图
- `kung_fu_fighters_everybody_knew_their_part`：`e2e/smashup/smashup-zhongguo-everybody-knew-their-part.e2e.ts` 已证明“真实页面中打出《各尽其责》并选择高战力己方随从后，即使普通随从额度已用完，仍能在同基地额外打出一个更低战力随从；该额外随从会真实进场并按自身进场能力继续抓牌，且交互 / 响应窗口 / 队列清理都完成”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-everybody-knew-their-part.e2e\打出各尽其责并选择高战力己方随从后，应允许在同基地额外打出一个更低战力随从\zhongguo-everybody-knew-their-part-resolved.png`
  - 看图结论：左侧《廉价小饭馆》下已能看到新打出的《好伙伴》真实落地，基地上方保留己方《车队》，底部新抓到的《修理》已进入手牌区；页面里没有残留交互壳层或无关失败提示，可作为《各尽其责》这条 representative 的主收口图
- `kung_fu_fighters_a_little_bit_frightening`：`e2e/smashup/smashup-zhongguo-a-little-bit-frightening.e2e.ts` 已证明“真实页面中打出《有些胆寒》后，会先选择参照随从，再消灭同基地更低战力敌方随从，最后给己方目标放置 2 枚力量指示物，并完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-a-little-bit-frightening.e2e\打出有些胆寒后，应先选参照随从，再消灭同基地更低战力随从，最后给该基地己方目标放置两枚力量指示物\zhongguo-a-little-bit-frightening-resolved.png`
  - 看图结论：左侧《廉价小饭馆》下低战力敌方《轮滑舞娘》已经离场，高战力敌方《斯通福德》仍在；己方目标《彼特》身上清晰可见两枚力量指示物，另一己方《好伙伴》未被误加；页面里没有残留交互壳层，可作为《有些胆寒》这条 representative 的主收口图
- `kung_fu_fighters_everybody_was_kung_fu_fighting`：`e2e/smashup/smashup-zhongguo-everybody-was-kung-fu-fighting.e2e.ts` 已证明“真实页面中打出《人人都是功夫高手》后，会先选择目标基地，再由双方依次各选择另一位玩家的一个随从并消灭，最终完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-everybody-was-kung-fu-fighting.e2e\打出人人都是功夫高手后，应先选基地，再让每位有随从的玩家各消灭另一位玩家的一个随从\zhongguo-everybody-was-resolved.png`
  - 看图结论：左侧《廉价小饭馆》下双方原本在场的两张随从都已离场，目标基地当前为空，页面中没有残留交互壳层或响应窗口，可作为《人人都是功夫高手》这条 representative 的主收口图
- `kung_fu_fighters_fast_as_lightning`：`e2e/smashup/smashup-zhongguo-fast-as-lightning.e2e.ts` 已证明“真实页面中打出《快如闪电》后，会给目标随从 `+2` 临时战力；同回合再由《旋风女侠》真实消灭该目标时，目标不会进入弃牌堆，而是回到其拥有者手牌，并完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-fast-as-lightning.e2e\打出快如闪电后，应给目标-+2-战力并在本回合被消灭时改回手牌\zhongguo-fast-as-lightning-opponent-hand.png`
  - 看图结论：结算后切到对手视角，底部对手手牌区能看到目标《杰基比尔》已回到手牌；同一张图里左侧《廉价小饭馆》下只剩《旋风女侠》，说明目标已离开基地；对照 `zhongguo-fast-as-lightning-opponent-hand-empty-before.png` 可知结算前对手手牌区为空，因此这组前后图可以直接证明“本回合被消灭时改回拥有者手牌”这段结果
- `kung_fu_fighters_dragon_warrior`：`e2e/smashup/smashup-zhongguo-dragon-warrior-talent.e2e.ts` 已证明“真实页面中点击《神龙武者》后，会先选择指示物来源随从，再选择接收指示物的另一个随从，最后通过数量滑杆转移指定数量的力量指示物，并完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-dragon-warrior-talent.e2e\真实点击神龙武者后，应转移指定数量的力量指示物并完成结算清理\zhongguo-dragon-warrior-resolved.png`
  - 看图结论：左侧《古道场》下《神龙武者》已经进入“已用”态；中间《廉价小饭馆》下来源《好伙伴》不再显示 `+2` 指示物；右侧《比赛会场》下目标《杰基比尔》清晰显示 `+2` 指示物，因此这张图已能直接证明《神龙武者》把两枚力量指示物从来源随从转移到了目标随从
- `kung_fu_fighters_expert_timing`：`e2e/smashup/smashup-zhongguo-expert-timing-before-scoring.e2e.ts` 已证明“真实页面中在计分前响应窗口打出《掌握时机》后，可以选择‘两者都做’，并完成额外天赋目标选择与基地持续战术标记转移，最终完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-expert-timing-before-scoring.e2e\计分前从真实响应窗口打出掌握时机，并把基地持续战术上的标记转给随从同时授予额外天赋\zhongguo-expert-timing-final-state.png`
  - 看图结论：上方《古老的中国艺术》已经不再显示力量指示物，说明基地持续战术上的标记已被转走；左下《神龙武者》顶部新增绿色“额外天赋”徽标，肉眼可直接确认这次额外天赋已经授予且尚未消费；同基地另一张己方随从左侧可见 `+2` 指示物，说明本次标记转移结果也已真实落地，因此这张图已足够作为《掌握时机》这条 representative 的主收口图
- `kung_fu_fighters_ancient_chinese_art`：`e2e/smashup/smashup-zhongguo-ancient-chinese-art.e2e.ts` 已证明“真实页面中点击《古老的中国艺术》后，会进入本基地目标选择 prompt，给目标随从放置 1 枚力量指示物，并完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-ancient-chinese-art.e2e\真实点击古老的中国艺术后，应给本基地目标随从放置-1-枚力量指示物并完成结算清理\zhongguo-ancient-chinese-art-resolved.png`
  - 看图结论：上方能看到《古老的中国艺术》已进入“已用”态；左侧《廉价小饭馆》下目标《杰基比尔》有 `+1` 力量指示物，另一张《好伙伴》未被误加；页面中没有残留交互壳层，可作为《古老的中国艺术》这条 representative 的主收口图
- `kung_fu_fighters_cricket`：`e2e/smashup/smashup-zhongguo-cricket.e2e.ts` 已证明“真实页面中打出《蟋蟀》后，会先进入标记来源选择，再进入目标选择，并把 1 枚力量指示物转移到另一随从，且不再弹数量滑条，最终完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-cricket.e2e\打出蟋蟀后，应依次选择标记来源与目标，并转移-1-枚力量指示物\zhongguo-cricket-resolved.png`
  - 看图结论：左侧《廉价小饭馆》下《蟋蟀》已经进场；来源《好伙伴》不再有 `+1` 指示物，目标《杰基比尔》明确有 `+1` 指示物；页面里没有数量滑条或残留交互壳层，可作为《蟋蟀》这条 representative 的主收口图
- `kung_fu_fighters_lets_get_it_on`：`e2e/smashup/smashup-zhongguo-lets-get-it-on.e2e.ts` 已证明“真实页面中打出《让我们躁起来》后，会先选择己方来源随从，再以多选交互选择该基地中任意数量的不高于其战力的随从并一起消灭，且完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-lets-get-it-on.e2e\打出让我们躁起来后，应消灭所选己方随从所在基地中任意数量的不高于其战力的随从\zhongguo-lets-get-it-on-resolved.png`
  - 看图结论：左侧《廉价小饭馆》下来源《平头彼特》仍在，战力为 `4` 的《斯通福德》也仍在；原本战力 `4` 的《杰基比尔》和战力 `2` 的《轮滑舞娘》都已离场，因此这张图已能直接证明《让我们躁起来》只消灭了被多选选中的、且战力不高于来源随从的目标
- `kung_fu_fighters_oh_hoh_hoh_hoah`：`e2e/smashup/smashup-zhongguo-oh-hoh-hoh-hoah.e2e.ts` 已证明“真实页面中当对手在同基地打出随从后，《哦吼吼吼吼啊》会触发你的目标选择 prompt，给己方目标随从放置 1 枚力量指示物，并完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-oh-hoh-hoh-hoah.e2e\对手在同基地打出随从后，哦吼吼吼吼啊应让你给己方目标随从放置-1-枚力量指示物并完成结算清理\zhongguo-oh-hoh-hoh-hoah-resolved.png`
  - 看图结论：左侧《廉价小饭馆》下能看到对手刚打出的《大副》已经进场；己方目标《杰基比尔》有 `+1` 指示物，另一张《好伙伴》未被误加；中间出现的是一次性“触发”提示而不是残留交互壳层，可作为《哦吼吼吼吼啊》这条 representative 的主收口图
- `base_ancient_dojo`：`e2e/smashup/smashup-zhongguo-ancient-dojo-base.e2e.ts` 已证明“真实页面中在《古道场》打出随从后，会给同基地更低战力的己方随从各放置 1 枚力量指示物，等战力己方随从和敌方随从不会被误加，且完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-ancient-dojo-base.e2e\在古道场打出随从后，应给同基地更低战力的己方随从各放置-1-枚力量指示物\zhongguo-ancient-dojo-resolved.png`
  - 看图结论：左侧《古道场》下新打出的《神龙武者》已经进场；《好伙伴》左上可见 `+1`，而另一张等战力己方《杰基比尔》仍是 `0`、敌方《轮滑舞娘》也未被误加，因此这张图已足够作为《古道场》这条 representative 的主收口图
- `base_tournament_site`：`e2e/smashup/smashup-zhongguo-tournament-site-base.e2e.ts` 已证明“真实页面中《比赛会场》在唯一第一名时，会按零战力玩家数给额外 VP，且真实页面会出现对应的 +3 VP 提示”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-tournament-site-base.e2e\比赛会场在唯一第一名时，应按零战力玩家数给额外-VP\zhongguo-tournament-site-vp-feedback.png`
  - 看图结论：右上记分板里 P1 已从 `0` 变为 `3`；中间还能看到“P1 获得 +3 VP”的真实提示；左侧《比赛会场》下只有己方《神龙武者》一位唯一第一名，因此这张图已能直接证明《比赛会场》的额外 VP 合同真实落地

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
- `vigilantes_tough_it_out`
- `vigilantes_foxy_green`
- `base_hideout`
- `vigilantes_shrug_it_off`
- `vigilantes_scared_straight`
- `vigilantes_shift`
- `vigilantes_dusty_henry`
- `vigilantes_lets_finish_this`
- `base_the_mean_streets`

`L3/L4 representative 已补证`

- `vigilantes_the_revenge`：`e2e/smashup/smashup-zhongguo-the-revenge.e2e.ts` 已证明“真实页面中在计分后响应窗口打出《复仇》后，会先选择计分基地己方随从，再选择另一基地，最终把该随从移出计分基地并完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-the-revenge.e2e\计分后从真实响应窗口打出复仇，并把计分基地己方随从移到其他基地\zhongguo-the-revenge-final-state.png`
  - 看图结论：计分基地《绿洲丛林》下已经看不到原目标己方随从；中间《中央大脑》下能看到被转移过去的《埃尔班迪多》；页面里没有残留交互壳层，只剩一次性“复仇触发”横幅，可作为《复仇》这条 representative 的主收口图
- `vigilantes_scared_straight`：`e2e/smashup/smashup-zhongguo-scared-straight.e2e.ts` 已证明“真实页面中打出《直面恐惧》后，会先移动对手随从，再立即获得一次可实际消费的额外战术额度，且完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-scared-straight.e2e\打出直面恐惧后，应移动对手随从并立刻获得一次可实际打出的额外战术\zhongguo-scared-straight-resolved.png`
  - 看图结论：上方出现“获得1次额外行动机会”提示；右侧行动面板已显示额外战术可用；原目标对手随从已从《险恶街区》移到《时髦镇》，可以直接证明《直面恐惧》的移动和额外战术额度都已真实落地
- `vigilantes_death_wisher`：`e2e/smashup/smashup-zhongguo-death-wisher.e2e.ts` 已证明“对手消灭己方随从后，真实页面会触发《猛龙怪客》反杀对手一个随从，并完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-death-wisher.e2e\对手消灭你的随从后，应触发猛龙怪客反杀对手一个随从，且清理交互队列\zhongguo-death-wisher-resolved.png`
  - 看图结论：《时髦镇》下能看到《猛龙怪客》仍在场，而被反杀的对手目标已离场；画面中只剩一次性“猛龙怪客触发”提示，没有残留选择壳层，可作为《猛龙怪客》这条 representative 的主收口图
- `vigilantes_shift`：`e2e/smashup/smashup-zhongguo-shift.e2e.ts` 已证明“真实页面中打出《铁杆神探》后，会把弃牌堆中至多两个随从放到牌库顶，并把这些随从从弃牌堆移出，且完成最终状态清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-shift.e2e\打出铁杆神探后，应把弃牌堆至多两个随从放到牌库顶并移出弃牌堆\zhongguo-shift-resolved.png`
  - 看图结论：左侧《藏身处》下新打出的《铁杆神探》已经落场；左下牌堆计数显示已回升，说明弃牌堆里的目标随从已被放回牌库顶；页面中没有残留交互壳层，可作为《铁杆神探》这条 representative 的主收口图
- `vigilantes_foxy_green`：`e2e/smashup/smashup-zhongguo-foxy-green-counter.e2e.ts` 已证明“真实页面中其他玩家在同基地影响随从时，《狐狸翠》会获得 1 枚力量指示物”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-foxy-green-counter.e2e\其他玩家在同基地影响随从时，狐狸翠应获得-1-枚力量指示物\zhongguo-foxy-green-resolved.png`
  - 看图结论：左侧《廉价小饭馆》下《狐狸翠》头上能看到两枚 `+1` 力量指示物，其中新增的那枚来自这次敌方影响随从触发；页面里没有残留交互壳层，可作为《狐狸翠》这条 representative 的主收口图
- `vigilantes_tough_it_out`：`e2e/smashup/smashup-zhongguo-tough-it-out-protection.e2e.ts` 已证明“附着保护生效时，对手真实打出《一天的快乐》不会把宿主随从列入消灭目标；其他合法低战力目标仍可被正常消灭”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-tough-it-out-protection.e2e\咬紧牙关附着生效时，对手的一天的快乐目标列表里不应出现宿主随从\zhongguo-tough-it-out-protection-resolved.png`
  - 看图结论：《险恶街区》下带有《咬紧牙关》附着标记的宿主随从仍然留场；未受保护的另一低战力己方随从已被正常移除；页面中没有残留目标选择壳层，可作为《咬紧牙关》这条 representative 的主收口图
- `vigilantes_who_loves_ya_baby`：`e2e/smashup/smashup-zhongguo-who-loves-ya-baby.e2e.ts` 已证明“真实页面中打出《谁爱你，小老弟？》后，会只按你控制的战力 4 或更高随从数量抓牌”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-who-loves-ya-baby.e2e\打出谁爱你，小老弟？后，应按己方战力-4-或更高随从数量抓牌\zhongguo-who-loves-ya-baby-resolved.png`
  - 看图结论：右下手牌区已新增抓到的牌，场上只保留两名符合条件的己方高战力随从，没有把敌方高战力随从或己方低战力随从误算进抓牌结果，可作为《谁爱你，小老弟？》这条 representative 的主收口图
- `vigilantes_make_my_day`：`e2e/smashup/smashup-zhongguo-make-my-day.e2e.ts` 已证明“真实页面中打出《一天的快乐》后，只会让有己方随从基地中的战力 3 或更低随从进入目标列表，并在消灭后抓 1 张牌”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-make-my-day.e2e\打出一天的快乐后，应只允许选择有己方随从基地中战力-3-或更低的随从，并在消灭后抓-1-张牌\zhongguo-make-my-day-resolved.png`
  - 看图结论：被消灭的低战力目标已经离场，右下手牌区已出现新抓牌，页面中没有残留选择壳层，可直接证明《一天的快乐》的目标过滤和抓牌结果都已真实落地
- `vigilantes_brojak`：`e2e/smashup/smashup-zhongguo-im-so-excited-brojak.e2e.ts` 已证明“真实页面中《我很亢奋》结算后，《神探布洛杰克》会跟随移动到同一基地并获得 +1 临时战力”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-im-so-excited-brojak.e2e\打出我很亢奋后，应移动己方随从、抓牌，并让神探布洛杰克跟随到同一基地获得-+1-临时战力\zhongguo-im-so-excited-brojak-resolved.png`
  - 看图结论：右侧《时髦镇》下能同时看到《神探布洛杰克》和被移动过去的己方随从；《神探布洛杰克》身上有绿色 `+1` 临时战力标记，中间没有残留交互壳层，可作为《神探布洛杰克》这条 representative 的主收口图
- `vigilantes_feeling_lucky`：`e2e/smashup/smashup-zhongguo-feeling-lucky.e2e.ts` 已证明“真实页面中宿主控制者打出战术后，《觉得运气不错？》会让宿主随从被立即消灭”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-feeling-lucky.e2e\宿主控制者真实打出战术后，应让附着了觉得运气不错？的宿主随从被消灭\zhongguo-feeling-lucky-resolved.png`
  - 看图结论：原宿主随从与附着都已离开基地，右下手牌与弃牌结果已更新，页面中没有残留触发壳层，可作为《觉得运气不错？》这条 representative 的主收口图
- `vigilantes_a_whole_lot_meaner`：`e2e/smashup/smashup-zhongguo-a-whole-lot-meaner.e2e.ts` 已证明“真实页面中打出《凶恶百倍》后，目标随从会获得 +3 临时战力并完成结算清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-a-whole-lot-meaner.e2e\打出凶恶百倍后，应给目标随从-+3-临时战力并完成结算清理\zhongguo-a-whole-lot-meaner-resolved.png`
  - 看图结论：目标随从左上清晰可见 `+3` 临时战力标记，未见残留目标选择壳层，可直接证明《凶恶百倍》的结果已经真实落地
- `vigilantes_stoneford`：`e2e/smashup/smashup-zhongguo-stoneford.e2e.ts` 已证明“真实页面中打出《破萝飞龙》后，会把牌库中的第一张战术抽到手牌”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-stoneford.e2e\打出破萝飞龙后，应找到牌库中的第一张战术并抽到手牌\zhongguo-stoneford-resolved.png`
  - 看图结论：新抓到的战术已经进入手牌区，《破萝飞龙》本人成功进场，页面中没有残留交互壳层，可作为《破萝飞龙》这条 representative 的主收口图
- `vigilantes_jacky_bill`：`e2e/smashup/smashup-zhongguo-jacky-bill.e2e.ts` 已证明“真实页面中《杰基比尔》在对手于同基地打出战术后，会获得 +2 临时战力”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-jacky-bill.e2e\打出杰基比尔后，对手在同基地打出战术时应让其获得-+2-临时战力\zhongguo-jacky-bill-resolved.png`
  - 看图结论：《杰基比尔》仍在原基地，左上能看到新增的 `+2` 临时战力标记，对手战术也已成功落到同基地，可作为《杰基比尔》这条 representative 的主收口图
- `vigilantes_street_justice`：`e2e/smashup/smashup-zhongguo-street-justice-protection.e2e.ts` 已证明“真实页面中《街头正义》保护生效后，对手的目标列表里不会出现被保护的己方随从”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-street-justice-protection.e2e\街头正义在基地生效后，对手的打到穿越目标列表里不应出现被保护的己方随从\zhongguo-street-justice-protection-resolved.png`
  - 看图结论：受《街头正义》保护的己方随从仍然留在基地，而被选中的其他合法目标已离场，页面中没有残留目标选择壳层，可作为《街头正义》这条 representative 的主收口图
- `vigilantes_knocked_into_next_week`：`e2e/smashup/smashup-zhongguo-knocked-into-next-week.e2e.ts` 已证明“真实页面中打出《打到穿越》后，会把目标随从洗回其拥有者牌库”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-knocked-into-next-week.e2e\打出打到穿越后，应把目标随从洗回其拥有者牌库\zhongguo-knocked-into-next-week-resolved.png`
  - 看图结论：被选中的目标随从已从基地消失，页面里没有残留目标选择壳层，可直接证明《打到穿越》的回牌库结果已真实落地
- `base_hideout`：`e2e/smashup/smashup-zhongguo-hideout-protection.e2e.ts` 已证明“真实页面中《藏身处》生效后，对手的目标列表里不会出现该基地的己方随从”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-hideout-protection.e2e\藏身处生效时，对手的打到穿越目标列表里不应出现该基地的己方随从\zhongguo-hideout-protection-resolved.png`
  - 看图结论：《藏身处》上的己方随从仍留在基地，而其他合法目标已被正常处理，页面中没有残留交互壳层，可作为《藏身处》这条 representative 的主收口图
- `vigilantes_shrug_it_off`：`e2e/smashup/smashup-zhongguo-shrug-it-off.e2e.ts` 已证明“真实页面中点击《不屑一顾》后，会压制当前基地能力，让原本受保护随从重新进入《打到穿越》目标列表”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-shrug-it-off.e2e\真实点击不屑一顾后，应压制当前基地能力，让原本受藏身处保护的随从重新进入打到穿越目标列表\zhongguo-shrug-it-off-resolved.png`
  - 看图结论：原本受《藏身处》保护的随从已被重新纳入处理并离场，《不屑一顾》进入已用态，页面中没有残留交互壳层，可作为《不屑一顾》这条 representative 的主收口图
- `vigilantes_dusty_henry`：`e2e/smashup/smashup-zhongguo-dusty-henry.e2e.ts` 已证明“真实页面中打出《瞌睡的亨利》后，会把本基地一个随从洗回其拥有者牌库”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-dusty-henry.e2e\打出瞌睡的亨利后，应选择本基地一个随从洗回其拥有者牌库\zhongguo-dusty-henry-resolved.png`
  - 看图结论：《瞌睡的亨利》已留场，而被选中的目标随从已从同基地消失，页面中没有残留交互壳层，可作为《瞌睡的亨利》这条 representative 的主收口图
- `vigilantes_lets_finish_this`：`e2e/smashup/smashup-zhongguo-lets-finish-this.e2e.ts` 已证明“真实页面中《做个了断吧》会在控制者回合开始时把有双方随从的基地临界点降为 0”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-lets-finish-this.e2e\控制者回合开始时，若基地上有双方随从，应把该基地临界点降为-0\zhongguo-lets-finish-this-resolved.png`
  - 看图结论：目标基地右上临界点旁已显示额外的临时修正结果，页面中没有残留开始回合触发壳层，可作为《做个了断吧》这条 representative 的主收口图
- `base_the_mean_streets`：`e2e/smashup/smashup-zhongguo-mean-streets-base.e2e.ts` 已证明“真实页面中在《险恶街区》用战术影响敌方随从后，会让该敌方随从额外获得 1 枚力量指示物”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-mean-streets-base.e2e\在险恶街区用战术影响这里的敌方随从后，应让该敌方随从额外获得-1-枚力量指示物\zhongguo-mean-streets-resolved.png`
  - 看图结论：被战术影响的目标随从头上能看到新增的 `+1` 力量指示物，页面中没有残留交互壳层，可作为《险恶街区》这条 representative 的主收口图

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

`L3/L4 representative 已补证`

- `truckers_armored_truck`：`e2e/smashup/smashup-zhongguo-armored-truck-protection.e2e.ts` 已证明“保护生效时，对手真实打出《直面恐惧》不会把同基地受保护己方随从列入移动目标；未受保护目标仍可被正常移动”
- `truckers_convoy`：`e2e/smashup/smashup-zhongguo-convoy-base-power.e2e.ts` 已证明“真实页面中双方各自只按自己控制的同基地基地战术数量获得基地力量；同基地的敌方基地战术不会并入你的基地力量”
- `truckers_good_buddy`：`e2e/smashup/smashup-zhongguo-good-buddy-draw.e2e.ts` 已证明“真实页面中好伙伴打到已有己方基地战术的基地后会抓 1 张牌”
- `truckers_rally`：`e2e/smashup/smashup-zhongguo-rally-before-scoring.e2e.ts` 已证明“真实页面中在计分前响应窗口打出《车友聚会》后，会对计分基地一个己方随从按己方该基地持续战术数量给予临时战力，且完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-rally-before-scoring.e2e\计分前从真实响应窗口打出车友聚会，并给己方随从加临时战力\zhongguo-rally-before-scoring-resolved-before-pass.png`
  - 看图结论：计分基地《廉价小饭馆》下方目标《好伙伴》左上清晰可见绿色 `+2` 临时战力标记；同基地另有己方《橡皮鸡》在场，可与上方己方基地持续战术《车队》共同对应这次 `+2` 的来源；页面中虽已有单条计分横幅，但未遮住关键 `+2` 结果点，可作为《车友聚会》这条 representative 的主收口图
- `truckers_turn_the_beat_around`：`e2e/smashup/smashup-zhongguo-turn-the-beat-around-before-scoring.e2e.ts` 已证明“真实页面中在计分前响应窗口打出《节拍一转》后，会先给计分基地一个己方随从 `+1` 临时战力，再让同基地另一个随从获得 `-1` 临时战力，且完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-turn-the-beat-around-before-scoring.e2e\计分前从真实响应窗口打出节拍一转，先给己方随从-+1-再让同基地一个随从-1\zhongguo-turn-the-beat-around-resolved-before-pass.png`
  - 看图结论：同一张主图里，上方目标《好伙伴》左上清晰可见绿色 `+1` 临时战力标记；更下方的减益目标左侧清晰可见红色 `-1` 临时战力标记；虽然中间仍有单条计分横幅，但两个关键结果点都已露出，足以直接证明《节拍一转》这条 `+1 / -1` 双段结果已经真实落地
- `truckers_hotwire`：`e2e/smashup/smashup-zhongguo-hotwire.e2e.ts` 已证明“真实页面中打出《短路点火》后，会先选择目标基地持续战术，再选择‘转移并控权’，最后选择目标基地，最终把对方基地战术移到另一基地并把控制权改为己方，且完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-hotwire.e2e\打出短路点火后，应转移对方基地战术到另一基地并获得控制权\zhongguo-hotwire-resolved.png`
  - 看图结论：原基地《廉价小饭馆》上方已经看不到那张《车队》基地战术；中间《中央大脑》上方能看到被转移过去的《车队》，其下方己方红色基地战术数量显示为 `1`、蓝色为 `0`，可以直接证明控制权已改为己方；页面中没有残留交互壳层，可作为《短路点火》这条 representative 的主收口图
- `truckers_dekotora`：`e2e/smashup/smashup-zhongguo-dekotora.e2e.ts` 已证明“真实页面中点击《暴走卡车》后，会先选择目标基地，再选择至多两张己方随从，最终把《暴走卡车》自身与被选己方随从一起移动到另一基地，未被选中的己方随从会留在原基地，且完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-dekotora.e2e\真实点击暴走卡车后，应移动自身到另一基地并把至多两个己方随从一起移动过去\zhongguo-dekotora-resolved.png`
  - 看图结论：中间《中央大脑》上方能看到《暴走卡车》已移动过去且进入“已用”态；《好伙伴》和《橡皮鸡》也都已移动到《中央大脑》，而左侧原基地《廉价小饭馆》下仍保留未被选择的《猛龙怪客》；页面中没有残留交互壳层，可作为《暴走卡车》这条 representative 的主收口图
- `truckers_high_speed_chase`：`e2e/smashup/smashup-zhongguo-high-speed-chase.e2e.ts` 已证明“真实页面中点击《高速追逐战》后，会先选择己方随从，再选择目标基地，最终把《高速追逐战》自身与目标随从一起移动到另一基地，并给该随从 `+3` 临时战力，且完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-high-speed-chase.e2e\真实点击高速追逐战后，应移动自身和己方随从到另一基地并给该随从-+3-临时战力\zhongguo-high-speed-chase-resolved.png`
  - 看图结论：中间《中央大脑》上方能看到《高速追逐战》已移动过去且进入“已用”态；己方《好伙伴》也已移动到《中央大脑》，左上有 `+4` 标记、左下总战力显示为 `6`，可直接证明本次获得了 `+3` 临时战力；原基地《廉价小饭馆》下只剩敌方《主唱》，页面中没有残留交互壳层，可作为《高速追逐战》这条 representative 的主收口图
- `truckers_skinny_minnie`：`e2e/smashup/smashup-zhongguo-skinny-minnie-talent.e2e.ts` 已证明“真实页面中点击《皮包骨米妮》后，会先选择目标基地，再选择同基地基地战术，最终把自己与该基地战术一起移动到目标基地，且同拥有者战术不会错误带上额外控权 metadata”
- `truckers_cab_over_pete`：`e2e/smashup/smashup-zhongguo-cab-over-pete-talent.e2e.ts` 已证明“真实页面中点击《平头彼特》后，会先选择目标基地，再选择同基地另一张己方牌，最终把自己与该牌一起移动到目标基地，且完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-cab-over-pete-talent.e2e\真实点击平头彼特后，应移动自身到另一基地并把同基地另一张己方战术一起移动过去\zhongguo-cab-over-pete-resolved.png`
  - 看图结论：中间《中央大脑》上方能看到《平头彼特》与被带走的《车队》已经一起移动到目标基地；原基地《廉价小饭馆》下只剩未被带走的《好伙伴》；页面里没有残留交互壳层，可作为《平头彼特》这条 representative 的主收口图
- `truckers_rubber_chicken`：`e2e/smashup/smashup-zhongguo-rubber-chicken-power.e2e.ts` 已证明“真实页面中橡皮鸡只按本基地己方基地战术数量获得持续战力；同基地的敌方基地战术不会并入橡皮鸡战力”
- `truckers_el_bandido`：`e2e/smashup/smashup-zhongguo-el-bandido-take-control.e2e.ts` 已证明“真实页面中打出《埃尔班迪多》后，会提示选择基地战术并获得其控制权”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-el-bandido-take-control.e2e\打出埃尔班迪多后，应提示选择基地战术并获得其控制权\zhongguo-el-bandido-take-control-resolved.png`
  - 看图结论：《埃尔班迪多》已经成功进场，原本位于《廉价小饭馆》的基地战术《车队》已转为己方控制并显示在左侧基地上方，可作为《埃尔班迪多》这条 representative 的主收口图
- `truckers_fixin_to_fix_it`：`e2e/smashup/smashup-zhongguo-fixin-to-fix-it.e2e.ts` 已证明“真实页面中打出《修理》后，会把弃牌堆中可对基地打出的战术回收到手牌”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-fixin-to-fix-it.e2e\打出修理后，应把弃牌堆中的战术回收到手牌\zhongguo-fixin-to-fix-it-resolved.png`
  - 看图结论：回收到手牌的《车队》已经重新出现在右下手牌区，《修理》自身进入弃牌堆，页面中没有残留交互壳层，可作为《修理》这条 representative 的主收口图
- `base_the_greasy_spoon`：`e2e/smashup/smashup-zhongguo-greasy-spoon-base.e2e.ts` 已证明“真实页面中《廉价小饭馆》计分后，会让在场双方各抓 1 张牌”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-greasy-spoon-base.e2e\计分后廉价小饭馆应让在场双方各抓-1-张牌\zhongguo-greasy-spoon-final-state.png`
  - 看图结论：计分基地仍显示刚完成计分的结果，双方场上随从仍在，手牌与牌堆计数已完成同步更新，可作为《廉价小饭馆》这条 representative 的主收口图
- `base_truck_stop`：`e2e/smashup/smashup-zhongguo-truck-stop-base.e2e.ts` 已证明“真实页面中《卡车服务站》计分后，会把这里的随从移动到另一个基地”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-truck-stop-base.e2e\计分后卡车服务站应把这里的随从移动到另一个基地\zhongguo-truck-stop-final-state.png`
  - 看图结论：《卡车服务站》下已经清空，原本在此的随从都已移动到《中央大脑》，可直接证明基地计分后的整体搬迁结果已真实落地

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

`L3/L4 representative 已补证`

- `disco_dancers_diva`：`e2e/smashup/smashup-zhongguo-diva.e2e.ts` 已证明“真实页面中打出《今晚嗨起来》并选择同基地己方随从后，《主唱》会自动复制同样的普通战术影响，且抓牌、交互 / 响应窗口 / 队列清理都完成”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-diva.e2e\打出今晚嗨起来影响同基地己方随从后，主唱应自动复制同样的普通战术影响\zhongguo-diva-resolved.png`
  - 看图结论：左侧《廉价小饭馆》下《主唱》和《好伙伴》都显示 `+2` 临时战力；抓到的《车队》已经进入手牌区；页面中没有残留交互壳层，可作为《主唱》这条 representative 的主收口图
- `disco_dancers_we_are_family`：`e2e/smashup/smashup-zhongguo-we-are-family.e2e.ts` 已证明“真实页面中打出《今晚嗨起来》并选择宿主同基地其他己方随从后，《我们是一家人》会让宿主自动复制同样的普通战术影响，且抓牌、交互 / 响应窗口 / 队列清理都完成”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-we-are-family.e2e\打出今晚嗨起来影响宿主同基地其他己方随从后，我们是一家人应让宿主自动复制同样的普通战术影响\zhongguo-we-are-family-resolved.png`
  - 看图结论：左侧《廉价小饭馆》下宿主《好伙伴》和目标《杰基比尔》都显示 `+2` 临时战力，宿主上能看到《我们是一家人》附着标记；抓到的《车队》已经进入手牌区；页面中没有残留交互壳层，可作为《我们是一家人》这条 representative 的主收口图
- `disco_dancers_i_will_survive`：`e2e/smashup/smashup-zhongguo-i-will-survive.e2e.ts` 已证明“真实页面中在计分后响应窗口打出《我会活下去》后，会选择计分基地一个己方随从并把它返回手牌，且完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-i-will-survive.e2e\计分后从真实响应窗口打出我会活下去，并把计分基地己方随从返回手牌\zhongguo-i-will-survive-final-state.png`
  - 看图结论：计分基地《绿洲丛林》下只剩《好伙伴》在场，原目标己方随从已不在基地；右下弃牌区能看到《我会活下去》，页面里没有残留交互壳层，只剩一次性触发横幅，可作为《我会活下去》这条 representative 的主收口图
- `disco_dancers_dancing_king`：`e2e/smashup/smashup-zhongguo-get-down-tonight-dancing-king.e2e.ts` 已证明“真实页面中打出《今晚嗨起来》后，《舞王》会复制这次普通战术影响到同基地另一随从，且抓牌与交互清理都完成”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-get-down-tonight-dancing-king.e2e\打出今晚嗨起来后，应先给原目标-+2-并抓牌，再由舞王复制给同基地另一随从\zhongguo-get-down-tonight-resolved.png`
  - 看图结论：左侧《廉价小饭馆》下原目标《好伙伴》和被《舞王》复制影响的《杰基比尔》都显示 `+2` 临时战力；《舞王》本人仍在同基地；抓到的《车队》已进入手牌区，可直接证明这次复制影响已经真实落地
- `disco_dancers_disco_inferno`：`e2e/smashup/smashup-zhongguo-disco-inferno.e2e.ts` 已证明“真实页面中打出《迪斯科地狱》后，会给目标随从放置 1 枚力量指示物并抓 1 张牌，且完成交互 / 响应窗口 / 队列清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-disco-inferno.e2e\打出迪斯科地狱后，应给目标随从放置-1-枚力量指示物并抓-1-张牌\zhongguo-disco-inferno-resolved.png`
  - 看图结论：左侧《时髦镇》下目标《好伙伴》头上清晰可见新增的 `+1` 力量指示物；右下手牌区已出现《迪斯科地狱》之外的新抓牌；页面里没有残留交互壳层，可作为《迪斯科地狱》这条 representative 的主收口图
- `disco_dancers_roller`：`e2e/smashup/smashup-zhongguo-roller.e2e.ts` 已证明“真实页面中当《迪斯科地狱》影响原本没有力量指示物的《轮滑舞娘》时，她会再给自己补 1 枚力量指示物，且完成交互清理”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-roller.e2e\用迪斯科地狱影响轮滑舞娘时，若她原本没有力量指示物，应再给自己补-1-枚\zhongguo-roller-resolved.png`
  - 看图结论：左侧《舞夜城》下《轮滑舞娘》头上同时能看到两枚新增的 `+1` 力量指示物，说明既吃到了《迪斯科地狱》的指示物，也吃到了自己的补 1 触发；页面里没有残留交互壳层，可作为《轮滑舞娘》这条 representative 的主收口图
- `disco_dancers_celebration`：`e2e/smashup/smashup-zhongguo-celebration.e2e.ts` 已证明“真实页面中打出《庆祝》后，会获得两次可实际消费的额外战术额度，并在同回合完成真实消费”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-celebration.e2e\打出庆祝后，应获得两次可实际消费的额外战术额度\zhongguo-celebration-resolved.png`
  - 看图结论：右下手牌区只剩多张已消费后的余牌；计分板已显示本回合新增 `1 VP`；页面中没有残留额外战术选择壳层或提示浮层，可作为《庆祝》这条 representative 的主收口图
- `disco_dancers_get_down_tonight`：`e2e/smashup/smashup-zhongguo-get-down-tonight-dancing-king.e2e.ts` 已证明“真实页面中打出《今晚嗨起来》后，会先给原目标 +2 临时战力并抓 1 张牌”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-get-down-tonight-dancing-king.e2e\打出今晚嗨起来后，应先给原目标-+2-并抓牌，再由舞王复制给同基地另一随从\zhongguo-get-down-tonight-resolved.png`
  - 看图结论：原目标《好伙伴》头上有清晰的 `+2` 临时战力标记，右下手牌区已出现这次抓到的牌，可作为《今晚嗨起来》这条 representative 的主收口图
- `disco_dancers_ul_disco_lou`：`e2e/smashup/smashup-zhongguo-ul-disco-lou.e2e.ts` 已证明“真实页面中打出《迪斯科·卢》后，会把弃牌堆中的战术放到牌库顶”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-ul-disco-lou.e2e\打出迪斯科·卢后，应把弃牌堆中的战术放到牌库顶\zhongguo-ul-disco-lou-resolved.png`
  - 看图结论：《迪斯科·卢》已成功进场，左下牌堆计数与右下弃牌结果已完成更新，页面中没有残留交互壳层，可作为《迪斯科·卢》这条 representative 的主收口图
- `disco_dancers_its_raining_men`：`e2e/smashup/smashup-zhongguo-its-raining-men.e2e.ts` 已证明“真实页面中打出《男人雨》后，即使普通随从额度已用完，仍会立刻给出一次额外随从机会”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-its-raining-men.e2e\打出男人雨后，在普通随从额度已用完时仍应允许再打出一个随从\zhongguo-its-raining-men-extra-minion-ready.png`
  - 看图结论：画面上方已明确提示“获得 1 次额外随从机会”，手牌区同时能看到仍可继续打出的额外随从目标，因此这张 ready 图比结算后结果帧更直接证明《男人雨》的主合同
- `disco_dancers_im_so_excited`：`e2e/smashup/smashup-zhongguo-im-so-excited-brojak.e2e.ts` 已证明“真实页面中打出《我很亢奋》后，会移动己方随从、抓牌，并触发联动跟随”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-im-so-excited-brojak.e2e\打出我很亢奋后，应移动己方随从、抓牌，并让神探布洛杰克跟随到同一基地获得-+1-临时战力\zhongguo-im-so-excited-brojak-resolved.png`
  - 看图结论：被移动的己方随从已经到达目标基地，右下手牌区完成抓牌更新，同时联动角色也已跟随到同一基地，可作为《我很亢奋》这条 representative 的主收口图
- `disco_dancers_last_dance`：`e2e/smashup/smashup-zhongguo-last-dance.e2e.ts` 已证明“真实页面中打出《最后的舞曲》后，会消灭己方目标随从并获得 1 VP”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-last-dance.e2e\打出最后的舞曲后，应消灭己方目标随从并获得-1-VP\zhongguo-last-dance-resolved.png`
  - 看图结论：上方提示已显示本次《最后的舞曲》获得 `1 VP`，目标随从已不在原基地，页面中没有残留目标选择壳层，可作为《最后的舞曲》这条 representative 的主收口图
- `disco_dancers_stayin_alive`：`e2e/smashup/smashup-zhongguo-stayin-alive.e2e.ts` 已证明“真实页面中打出《活着》后，会把弃牌堆中与己方场上同名的随从回到手牌”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-stayin-alive.e2e\打出活着后，应把弃牌堆中与己方场上同名的随从回手\zhongguo-stayin-alive-resolved.png`
  - 看图结论：同名随从已回到手牌区，场上同名宿主仍然留场，《活着》自身进入弃牌结算，可作为《活着》这条 representative 的主收口图
- `base_funky_town`：`e2e/smashup/smashup-zhongguo-funky-town-base.e2e.ts` 已证明“真实页面中在《时髦镇》打出影响本基地随从的战术后，会额外给该随从 1 枚力量指示物”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-funky-town-base.e2e\在时髦镇打出影响本基地随从的战术后，应额外给该随从-1-枚力量指示物\zhongguo-funky-town-resolved.png`
  - 看图结论：目标随从头上同时能看到这次额外补上的力量指示物和战术影响带来的临时增益，页面中没有残留交互壳层，可作为《时髦镇》这条 representative 的主收口图
- `base_boogie_wonderland`：`e2e/smashup/smashup-zhongguo-boogie-wonderland-base.e2e.ts` 已证明“真实页面中《摇摆仙境》会在回合开始立刻给出低战力额外随从机会”
  - 主收口图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-boogie-wonderland-base.e2e\摇摆仙境应在回合开始立刻给出低战力额外随从机会，并允许把力量-2-随从打到该基地\zhongguo-boogie-wonderland-immediate-extra-prompt.png`
  - 看图结论：页面顶部直接出现“立刻打出一个额外随从，或放弃这次机会”的 prompt，下方同时列出合法的低战力随从和“放弃”按钮，这张 prompt 图就是《摇摆仙境》最直接的主收口证据

## 当前明确未实现对象

截至当前状态，前一版列出的 `4` 张明确未实现牌已经补到对象级 `L2` 行为验证：

- 快如闪电（`kung_fu_fighters_fast_as_lightning`）：打出选随从、本回合 +2、被消灭时改回拥有者手牌，且已补证“基地计分清场进入弃牌堆”也会改回拥有者手牌
- 人人都是功夫高手（`kung_fu_fighters_everybody_was_kung_fu_fighting`）：选基地后，该基地每位有随从的玩家各选另一位玩家随从并消灭
- 掌握时机（`kung_fu_fighters_expert_timing`）：计分前特殊窗口可打出，已覆盖“转移全部随从 +1 标记”“给己方随从额外一次天赋”以及“基地持续战术上的 +1 标记转移给随从”，并已有真实 `beforeScoring` 页面链路与可直接显示“额外天赋”徽标的 representative 主收口图
- 平头彼特（`truckers_cab_over_pete`）：天赋转移自身到另一基地，并移动同基地另一张己方牌；当前 L2 已覆盖己方基地持续战术目标与己方随从目标

当前没有继续列为 `L2 未实现`、`L2 待补证`、`L3/L4 仅机械命中` 的 zhongguo 新派系对象；当前主要缺口已完成从“实现 / E2E 缺口”到“最终总表收口”的最后一跳。

## 当前批次收口结果

1. `64` 个预期对象都已命中 `zhongguo` E2E 文件与 evidence screenshot 目录
2. `64` 个对象都已升级成“`e2e 文件 + 主收口图 + 看图结论`”粒度的 representative 证据
3. 当前底稿与最终总表可以共同作为这批 `zhongguo` 四派系的最终收口真相源
