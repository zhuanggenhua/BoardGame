# Smash Up zhongguo 四派系实施审计底稿

日期：2026-06-23

## 结论等级

本文件证明 `zhongguo` 四派系已经从 intake 合同继续推进到**对象级 L2 行为验证清空待补证 + 37 条代表性 L3/L4 真实入口 E2E + 1 条基地计分服务端命令链补证**。

当前**不能**写成：

- 四派系玩法完成
- 四派系 L3/L4 收口
- 可发布口径已收口

当前更准确的结论是：

- `L0/L1`：四派系卡牌、基地、atlas、manifest 合同已存在，见 intake 合同
- `L2`：当前没有继续列为 `L2 未实现` 或 `L2 待补证` 的 zhongguo 新派系对象
- `L3/L4`：已新增“我会活下去”计分后真实入口 E2E、“复仇”计分后真实入口 E2E、“车友聚会”计分前真实入口 E2E、“节拍一转”计分前真实入口 E2E、“掌握时机”计分前真实入口 E2E、“快如闪电”出牌阶段真实入口 E2E、“人人都是功夫高手”出牌阶段真实入口 E2E、“平头彼特”天赋真实入口 E2E、“短路点火”出牌阶段真实入口 E2E、“高速追逐战”天赋真实入口 E2E、“暴走卡车”天赋真实入口 E2E、“埃尔班迪多”打出后控权真实入口 E2E、“埃尔班迪多”天赋转移真实入口 E2E、“直面恐惧”出牌阶段真实入口 E2E、“铁杆神探”出牌阶段真实入口 E2E、“活着”出牌阶段真实入口 E2E、“庆祝”出牌阶段真实入口 E2E、“迪斯科地狱”出牌阶段真实入口 E2E、“破萝飞龙”出牌阶段真实入口 E2E、“瞌睡的亨利”出牌阶段真实入口 E2E、“修理”出牌阶段真实入口 E2E、“谁爱你，小老弟？”出牌阶段真实入口 E2E、“猛龙怪客”对手消灭后反杀真实入口 E2E、“街头正义”保护过滤真实入口 E2E、“一天的快乐”出牌阶段真实入口 E2E、“凶恶百倍”出牌阶段真实入口 E2E、“藏身处”保护过滤真实入口 E2E、“杰基比尔”出牌后被他人战术触发真实入口 E2E、“今晚嗨起来”与“舞王”联动真实入口 E2E、“我很亢奋”与“神探布洛杰克”联动真实入口 E2E、“最后的舞曲”出牌阶段真实入口 E2E、“男人雨”出牌阶段真实入口 E2E、“打到穿越”出牌阶段真实入口 E2E、“廉价小饭馆”基地计分后真实入口 E2E 与“卡车服务站”基地计分后真实入口 E2E；廉价小饭馆另有服务端计分命令链补证；四派系整体仍未收口
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
   - 轮滑舞娘（`disco_dancers_roller`）真实页试探：对象级已过，但当前用《迪斯科地狱》影响《轮滑舞娘》本人后，真实页面只拿到《迪斯科地狱》自己的 `+1` 指示物，未拿到《轮滑舞娘》追加 `+1`；暂不计入 representative 已完成
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
   - 险恶街区（`base_the_mean_streets`）真实页试探：对象级已过，但当前用《迪斯科地狱》影响本基地敌方随从后，真实页面只拿到动作自己的 `+1` 指示物，未拿到基地追加 `+1`；暂不计入 representative 已完成
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
   - 破萝飞龙（`vigilantes_stoneford`）：新增真实页面 E2E，在出牌阶段把该随从打到基地后，无交互直结算断言牌库中的第一张战术真实进手牌、该战术离开牌库、非战术仍按相对顺序留在牌库、《破萝飞龙》成功进场，且 `triggerQueue` / 交互 / 响应窗口清空
   - 瞌睡的亨利（`vigilantes_dusty_henry`）：新增真实页面 E2E，在出牌阶段把该随从打到基地后进入真实目标选择 prompt，选择本基地一个随从后，最终断言目标随从离开基地并洗回其拥有者牌库、《瞌睡的亨利》成功进场，且 `triggerQueue` / 交互 / 响应窗口清空
   - 修理（`truckers_fixin_to_fix_it`）：新增真实页面 E2E，在出牌阶段打出该动作后，无交互直结算断言弃牌堆中的战术真实回到手牌、非战术仍留在弃牌堆、《修理》自身进入弃牌堆，且 `actionsPlayed=1` / `triggerQueue` / 交互 / 响应窗口清空
   - 谁爱你，小老弟？（`vigilantes_who_loves_ya_baby`）：新增真实页面 E2E，在出牌阶段打出该动作后，无交互直结算断言仅按“你控制的战力 `4` 或更高随从”数量真实抓牌；当前场上只有两名己方高战力随从符合条件，因此只抓 `2` 张、不会把对手的高战力随从或己方低战力随从计入，且《谁爱你，小老弟？》进入弃牌堆、`triggerQueue` / 交互 / 响应窗口清空
   - 猛龙怪客（`vigilantes_death_wisher`）：新增真实页面 E2E，在对手席位设为 `human` 的最近真实入口上，由对手打出《一天的快乐》消灭你的低战力随从；随后真实进入《猛龙怪客》反杀 prompt，选择消灭者控制的一名随从后，最终断言被消灭的己方随从与被反杀的敌方随从都正确离场、抓牌与弃牌结算完成，且 `triggerQueue` / 交互 / 响应窗口清空
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
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-zhongguo-fast-as-lightning.e2e\打出快如闪电后，应给目标-+2-战力并在本回合被消灭时改回手牌\zhongguo-fast-as-lightning-resolved.png`
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
   - 人人都是功夫高手（`kung_fu_fighters_everybody_was_kung_fu_fighting`）已覆盖真实页面双人顺序选择链与最终状态清理
   - 短路点火（`truckers_hotwire`）已覆盖真实页面三段选择链：目标基地持续战术、模式选择、目标基地，以及最终状态清理
   - 高速追逐战（`truckers_high_speed_chase`）已覆盖真实点击天赋、选择己方随从、选择目标基地，以及最终状态清理
   - 暴走卡车（`truckers_dekotora`）已覆盖真实点击天赋、选择目标基地、多选己方随从，以及最终状态清理
   - 埃尔班迪多（`truckers_el_bandido`）已覆盖真实页面“随从打出 -> 控权 prompt -> 获得对方基地战术控制权”整段入口链与最终状态清理
   - 埃尔班迪多（`truckers_el_bandido`）已覆盖真实页面“点击随从触发天赋 -> 选择转移模式 -> 选择基地战术 -> 选择目标基地”整段入口链与最终状态清理
   - 快如闪电（`kung_fu_fighters_fast_as_lightning`）已覆盖真实页面“打出动作 -> 选择目标随从 -> 获得 `+2` -> 同回合真实点击《旋风女侠》完成消灭 -> 目标改回拥有者手牌”整段入口链与最终状态清理，并补证唯一合法目标可直接结算
   - 直面恐惧（`vigilantes_scared_straight`）已覆盖真实页面“选择其他玩家随从 -> 选择目标基地 -> 获得 banked 额外战术额度 -> 同回合继续实际打出额外战术”整段入口链与最终状态清理
   - 铁杆神探（`vigilantes_shift`）已覆盖真实页面“打出随从 -> 无交互直结算把弃牌堆至多两个随从移到牌库顶 -> 弃牌堆清理 -> 进场完成”整段入口链与最终状态清理
   - 活着（`disco_dancers_stayin_alive`）已覆盖真实页面无交互直结算链：同名弃牌随从回手、异名弃牌保留、行动自身进入弃牌堆，以及最终状态清理
   - 庆祝（`disco_dancers_celebration`）已覆盖真实页面“打出动作 -> 获得两次额外战术额度 -> 关闭已打出特写遮罩 -> 同回合继续实际打出两张额外战术”整段入口链与最终状态清理
   - 迪斯科地狱（`disco_dancers_disco_inferno`）已覆盖真实页面“打出动作 -> 选择目标随从 -> 放置 `+1` 力量指示物 -> 抓 `1` 张牌”整段入口链与最终状态清理
   - 破萝飞龙（`vigilantes_stoneford`）已覆盖真实页面“打出随从 -> 无交互直结算找到牌库第一张战术 -> 抽到手牌 -> 成功进场”整段入口链与最终状态清理
   - 瞌睡的亨利（`vigilantes_dusty_henry`）已覆盖真实页面“打出随从 -> 进入目标选择 prompt -> 选择本基地随从 -> 洗回拥有者牌库 -> 成功进场”整段入口链与最终状态清理
   - 修理（`truckers_fixin_to_fix_it`）已覆盖真实页面“打出动作 -> 无交互直结算回收弃牌堆战术到手牌 -> 非战术保留弃牌堆 -> 自身进入弃牌堆”整段入口链与最终状态清理
   - 廉价小饭馆（`base_the_greasy_spoon`）已覆盖服务端计分命令链与浏览器真实入口，并取得页面截图证据
   - 卡车服务站（`base_truck_stop`）已覆盖浏览器真实入口的计分后移动随从链路，并取得页面截图证据
   - 今晚嗨起来（`disco_dancers_get_down_tonight`）与舞王（`disco_dancers_dancing_king`）已覆盖真实页面双段提示链与最终状态清理
   - 我很亢奋（`disco_dancers_im_so_excited`）与神探布洛杰克（`vigilantes_brojak`）已覆盖真实页面移动 + 跟随提示链与最终状态清理
   - 最后的舞曲（`disco_dancers_last_dance`）已覆盖真实页面单段目标选择链、己方随从消灭进弃牌堆、获得 `1 VP` 与最终状态清理
   - 男人雨（`disco_dancers_its_raining_men`）已覆盖真实页面“普通随从额度已耗尽 -> 额外随从额度生效 -> 继续打出额外随从”整段门禁链与最终状态清理
   - 打到穿越（`vigilantes_knocked_into_next_week`）已覆盖真实页面目标选择链、目标随从离开基地并回到拥有者牌库，以及最终状态清理
   - 如继续加深基地能力覆盖，可继续补更多多对象交互和计分后替代清理路径
   - 仍需把 `reaction session` 的队列/清理状态纳入更多 representative 链路

## 本轮不宣称完成的原因

1. 当前已清空对象级 `L2` 待补证，但只有三十七条代表性真实入口 E2E，仍不能直接代表四派系 L3/L4 全收口
2. 我会活下去（`disco_dancers_i_will_survive`）、复仇（`vigilantes_the_revenge`）、车友聚会（`truckers_rally`）、节拍一转（`truckers_turn_the_beat_around`）、掌握时机（`kung_fu_fighters_expert_timing`）、快如闪电（`kung_fu_fighters_fast_as_lightning`）、人人都是功夫高手（`kung_fu_fighters_everybody_was_kung_fu_fighting`）、平头彼特（`truckers_cab_over_pete`）、短路点火（`truckers_hotwire`）、高速追逐战（`truckers_high_speed_chase`）、暴走卡车（`truckers_dekotora`）、埃尔班迪多（`truckers_el_bandido`）打出控权、埃尔班迪多（`truckers_el_bandido`）天赋转移、直面恐惧（`vigilantes_scared_straight`）、铁杆神探（`vigilantes_shift`）、活着（`disco_dancers_stayin_alive`）、庆祝（`disco_dancers_celebration`）、迪斯科地狱（`disco_dancers_disco_inferno`）、破萝飞龙（`vigilantes_stoneford`）、瞌睡的亨利（`vigilantes_dusty_henry`）、修理（`truckers_fixin_to_fix_it`）、谁爱你，小老弟？（`vigilantes_who_loves_ya_baby`）、猛龙怪客（`vigilantes_death_wisher`）、今晚嗨起来 + 舞王（`disco_dancers_get_down_tonight` + `disco_dancers_dancing_king`）、我很亢奋 + 神探布洛杰克（`disco_dancers_im_so_excited` + `vigilantes_brojak`）、最后的舞曲（`disco_dancers_last_dance`）、男人雨（`disco_dancers_its_raining_men`）、打到穿越（`vigilantes_knocked_into_next_week`）、廉价小饭馆（`base_the_greasy_spoon`）与卡车服务站（`base_truck_stop`）已覆盖 `finalState / triggerQueue / 响应窗口或交互清理`，但更多多对象交互与更多 representative 链路仍缺 L4 页面证据
3. 本文件只是实施审计底稿，不是最终 rollup
