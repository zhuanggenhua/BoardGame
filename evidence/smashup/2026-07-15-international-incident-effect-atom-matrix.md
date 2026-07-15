# 《环游世界：国际事件》59 对象 effect atom 矩阵

## 结论口径

- 本文件建立 51 张卡牌 + 8 张基地的对象级规则子句 / effect atom / 共享消费合同矩阵，作为 `add-smashup-international-incident-factions` 的 2026-07-15 审计补证。
- 当前结论仍不是“全对象完成”：L1 静态/资源合同已覆盖，L2 行为测试已覆盖大多数对象或代表分支，L3/L4 只有代表链通过；未列为 `representative-passed` 的对象仍需要真实入口、reaction session、triggerQueue/finalState 或 skip UI 补证。
- 资源发布仍 `blocked:R2-env/CDN-404`：本地 PNG/WebP 与 manifest 已闭环；定向上传曾在 R2 远程回查阶段返回 `401`，当前复核 `.env` 不存在且无 R2 环境变量，两个代表 CDN URL 仍为 `404`，尚未达到 `HEAD 200` 门禁。

## 共享消费合同

| 合同 ID | 运行时入口 | 消费语义 | 当前证据 |
| --- | --- | --- | --- |
| SC-STATIC | `international_incident.ts` + `internationalIncidentResourceContract.test.ts` | 51 唯一卡面、80 实体牌、8 基地、atlas 槽位、manifest hash | 资源合同 4 passed |
| SC-MINION-EFFECT | `minionEffectPrompt` / `addPowerCounter` / `addTempPower` | 选随从、单选/多选、力量指示物、临时力量、抽牌后续 | 国际事件 L2 单测 42 passed；`技术奖`、`炖肉`、`斗志奖` E2E representative |
| SC-MOVE | `moveMinionPrompt` / `moveDestinationPrompt` / `buildValidatedMoveEvents` | 合法随从移动、基地目的地过滤、移动后附加效果 | 相扑手、骑警、基地移动 L2；部分真实入口 pending |
| SC-EXTRA-ACTION | `grantContextualExtraAction` / `LIMIT_MODIFIED` / 真实额外行动消费 | 额外行动、immediate、限制到目标随从或基地 | 火枪手、摔角手 L2；`一为全`、`全为一`、`阿拉密斯`、`快速 Set-Up` E2E representative |
| SC-EXTRA-MINION | `grantExtraMinion` / `queueMinionPlayEffect` | 额外随从、额外随从后的绑定行动、基地限定额外随从 | `投入战斗！`、`团队标记` L2 |
| SC-SEARCH | 搜牌 prompt / `recoverCardsFromDiscard` / `DECK_REORDERED` | 牌库/弃牌堆搜行动、跳过、无候选反馈、回收、洗回牌库 | `情谊信物`、`黄色恶魔` L2；`穆乔摔先生大战怪物` E2E representative |
| SC-ONGOING | `registerTrigger` / `registerProtection` / `getEffectivePower` | 持续保护、力量修正、onMinionAffected/onTurnEnd/onCardsDiscarded | 横纲、Porthos、火枪手随从、骑警少校、强力 Set-Up 等 L2；`阿拉密斯` 真实反应窗口 E2E representative |
| SC-RESPONSE | `specialTiming` / response window / beforeScoring trigger | 计分前 special、Me First、可选/跳过、响应窗清理 | `呼叫警徽`、`压制`、`逆转`、`最后一搏`、`红披风（Capa Roja）` E2E representative；其它 pending |
| SC-ATTACH | ongoing target minion/base + attachedActions | 打在随从/基地上的行动、宿主、行动控制者、Set-Up 家族 | 摔角手 Set-Up / Pin / Haich-Q L2 与 E2E representative；`全为一` 真实附着 / 回合末自毁 E2E representative |
| SC-SUPPRESS | `registerCardAbilitySuppression` / scoring power exclusion | 能力取消、计分力量排除 | `压制` L2 + E2E representative |
| SC-BASE | `registerBaseSkeletonAbilities` | 8 张基地触发器、可选分支、每回合一次、随机回收 | 8 基地 L2；`方形擂台`、`圣热尔韦堡垒`、`擂台边` E2E representative |

## 对象级矩阵

| objectId | 中文名 | 规则子句 / effect atom | 共享合同 | 当前 L0-L4 结论 |
| --- | --- | --- | --- | --- |
| `sumo_wrestlers_technique_prize` | 技术奖 | C1 选择你的一个随从；C2 放置 3 个 +1 力量指示物。 | SC-STATIC, SC-MINION-EFFECT | L1 passed；L2 passed；L3/L4 representative-passed（真实手牌入口 +3）；多目标边界 pending。 |
| `sumo_wrestlers_yokozuna` | 横纲 | C1 持续保护你的随从不被其他玩家卡牌移动；C2 天赋抽 1；C3 天赋移动这里另一玩家随从到其它基地。 | SC-STATIC, SC-ONGOING, SC-MOVE | L1 passed；L2 partial（保护已测）；天赋真实入口与分支 L3/L4 pending。 |
| `sumo_wrestlers_performance_prize` | 表演奖 | C1 抽 3 张牌。 | SC-STATIC, SC-MINION-EFFECT | L1 passed；L2 passed；L3/L4 pending。 |
| `sumo_wrestlers_head_butt` | 头槌 | C1 选择你有随从的基地；C2 摧毁另一玩家打在该基地或其随从上的一个行动。 | SC-STATIC, SC-MOVE, SC-ATTACH | L1 passed；L2 passed；目标选择真实入口 pending。 |
| `sumo_wrestlers_bulking_stew` | 炖肉 | C1 弃任意数量手牌；C2 每弃 1 张，在你的一个随从上放 1 个 +1 指示物；C3 允许 0/空选。 | SC-STATIC, SC-MINION-EFFECT | L1 passed；L2 passed（合法候选存在时空选不改状态；选择 2 张手牌后给所选随从 +2 指示物）；L3/L4 representative-passed（真实手牌入口：空选后手牌/指示物不变；多选 2 张后进入目标随从 prompt，并给相扑新人 +2）。 |
| `sumo_wrestlers_body_slam` | 身体猛击 | C1 选择另一位玩家；C2 选择你有随从的基地；C3 将该玩家在那里所有随从移动到另一个基地。 | SC-STATIC, SC-MOVE | L1 passed；L2 partial；多玩家/多目标基地真实入口 pending。 |
| `sumo_wrestlers_chikara_mizu` | 力量满溢 | C1 选择你的一个随从；C2 +2 直到回合结束；C3 可弃 1 张改为 +4。 | SC-STATIC, SC-MINION-EFFECT | L1 passed；L2 passed（+2/+4）；真实入口分支截图 pending。 |
| `sumo_wrestlers_third_tier` | 关胁 | C1 天赋可选；C2 移动这里另一玩家力量 3 或以下随从；C3 抽 1。 | SC-STATIC, SC-MOVE | L1 passed；L2 partial；天赋真实入口 pending。 |
| `sumo_wrestlers_grasp_the_belt` | 抓住腰带 | C1 选择你有随从的基地；C2 移动那里的一个随从到另一个基地。 | SC-STATIC, SC-MOVE | L1 passed；L2 passed；候选/可选真实入口 pending。 |
| `sumo_wrestlers_fighting_spirit_prize` | 斗志奖 | C1 抽 2；C2 在你的随从上总共放置 2 个 +1 指示物；C3 可分配给一个或多个随从。 | SC-STATIC, SC-MINION-EFFECT | L1 passed；L2 passed（集中给 1 个随从 +2；分给 2 个随从各 +1）；L3/L4 representative-passed（真实手牌入口抽 2，并把 2 个指示物分给两个己方随从）；集中给 1 个随从的真实入口边界待扩展。 |
| `sumo_wrestlers_top_tier` | 大关 | C1 持续监听你从手牌弃一张或多张牌；C2 本随从获得 1 个 +1 指示物。 | SC-STATIC, SC-ONGOING | L1 passed；L2 passed；触发边界 L3/L4 pending。 |
| `sumo_wrestlers_rookie_sumo` | 相扑新人 | C1 天赋可弃 1 张；C2 在你的一个随从上放置 2 个 +1 指示物。 | SC-STATIC, SC-MINION-EFFECT | L1 passed；L2 partial；天赋真实入口 pending。 |
| `base_heya_training_stable` | 训练馆 | C1 回合开始触发；C2 可弃 1 张；C3 给这里你的一个随从 +1 指示物；C4 可跳过。 | SC-STATIC, SC-BASE, SC-MINION-EFFECT | L1 passed；L2 passed（skip + 选择）；真实入口 pending。 |
| `base_the_dohyo` | 土俵 | C1 你的回合第一次在这里打出随从后；C2 可移动这里另一玩家一个随从到其它基地；C3 可跳过。 | SC-STATIC, SC-BASE, SC-MOVE | L1 passed；L2 passed（skip + 选择）；真实入口 pending。 |
| `musketeers_on_a_roll` | 连连获胜 | C1 选择同一个随从；C2 至多 2 张直接影响该随从的行动作为额外行动；C3 额外行动均受同随从限制。 | SC-STATIC, SC-EXTRA-ACTION | L1 passed；L2 passed；真实额外行动消费链 pending。 |
| `musketeers_make_way` | 让路 | C1 移动你的一个随从到另一个基地；C2 可额外打出一个行动。 | SC-STATIC, SC-MOVE, SC-EXTRA-ACTION | L1 passed；L2 passed；真实入口 pending。 |
| `musketeers_en_garde` | 预备姿势 | C1 选择一个随从；C2 +1 直到回合结束；C3 抽 1；C4 可额外打出一个行动。 | SC-STATIC, SC-MINION-EFFECT, SC-EXTRA-ACTION | L1 passed；L2 passed；更多触发对象 L3/L4 pending。 |
| `musketeers_biding_time` | 等待时机 | C1 选择一个随从；C2 +2 直到回合结束；C3 可额外打出一个直接影响此随从的行动。 | SC-STATIC, SC-MINION-EFFECT, SC-EXTRA-ACTION | L1 passed；L2 passed；真实额外行动消费链 pending。 |
| `musketeers_to_battle` | 投入战斗！ | C1 额外打出一个随从；C2 可额外打出一个直接影响该随从的行动；C3 skip/不打随从时清理 pending effect。 | SC-STATIC, SC-EXTRA-MINION, SC-EXTRA-ACTION | L1 passed；L2 passed；skip 真实链 pending。 |
| `musketeers_porthos` | 波尔托斯 | C1 持续不受其他玩家行动影响；C2 不保护己方行动或非行动来源。 | SC-STATIC, SC-ONGOING | L1 passed；L2 passed；真实入口 pending。 |
| `musketeers_athos` | 阿多斯 | C1 你打出行动直接影响这里一个或多个你的其他随从后；C2 那些随从各 +1 至回合结束。 | SC-STATIC, SC-ONGOING, SC-MINION-EFFECT | L1 passed；L2 passed；once/边界 pending。 |
| `musketeers_one_for_all` | 一为全 | C1 选择一个基地；C2 你在那里每个随从 +1 至回合结束；C3 可额外打出一个行动。 | SC-STATIC, SC-MINION-EFFECT, SC-EXTRA-ACTION | L1 passed；L2 passed；L3/L4 representative-passed；其它边界 pending。 |
| `musketeers_young_musketeer` | 年轻的火枪手 | C1 每回合第一次你打出直接影响此随从的行动后；C2 此随从 +1 至回合结束。 | SC-STATIC, SC-ONGOING | L1 passed；L2 passed；触发边界 pending。 |
| `musketeers_last_stand` | 最后一搏 | C1 特殊：基地计分前；C2 你在那里的一个随从 +2 至回合结束；C3 抽 1。 | SC-STATIC, SC-RESPONSE, SC-MINION-EFFECT | L1 passed；L2 passed；L3/L4 representative-passed（真实结束回合进入计分前 Me First 窗口后打出，土俵己方年轻的火枪手从 8 力量经 `最后一搏` +2 与自身触发反超到 11，P1 获得 3 VP，抽到 `预备姿势`，responseWindow / interaction / triggerQueue 清空）。 |
| `musketeers_dartagnan` | 达达尼昂 | C1 你打出直接影响此随从的行动后；C2 抽 1。 | SC-STATIC, SC-ONGOING | L1 passed；L2 passed；触发边界 pending。 |
| `musketeers_all_for_one` | 全为一 | C1 打在一个随从上；C2 可额外打出行动；C3 你再打出另一个直接影响宿主的行动后宿主 +1；C4 回合末摧毁此卡。 | SC-STATIC, SC-ATTACH, SC-EXTRA-ACTION, SC-ONGOING | L1 passed；L2 passed；L3/L4 representative-passed（真实手牌入口附着到波尔托斯后授予额外行动；再用 `预备姿势` 直接影响宿主，宿主获得 `预备姿势` +1 与 `全为一` +1；回合结束后 `全为一` 自动脱离并进入弃牌堆，interaction 清空）。 |
| `musketeers_token_of_affection` | 情谊信物 | C1 从牌库和/或弃牌堆搜直接影响随从的行动；C2 置入手牌；C3 可作为额外行动打出；C4 可跳过/无候选反馈。 | SC-STATIC, SC-SEARCH, SC-EXTRA-ACTION | L1 passed；L2 passed；真实入口 pending。 |
| `musketeers_aramis` | 阿拉密斯 | C1 你的回合中一次；C2 在你打出直接影响此随从的行动后；C3 可额外打出一个直接影响此随从的行动。 | SC-STATIC, SC-ONGOING, SC-EXTRA-ACTION | L1 passed；L2 passed；L3/L4 representative-passed（真实手牌入口用 `预备姿势` 直接影响阿拉密斯后出现真实反应窗口，选择阿拉密斯反应获得 immediate restricted extra action，再消费 `等待时机` 只能继续影响阿拉密斯本人；阿拉密斯累计 +3 临时力量，`预备姿势` 与 `等待时机` 均进入弃牌堆，interaction 清空）。 |
| `base_bastion_saint_gervais` | 圣热尔韦堡垒 | C1 每回合一次；C2 你打出直接影响这里己方随从的行动后；C3 可额外打出一个行动。 | SC-STATIC, SC-BASE, SC-EXTRA-ACTION | L1 passed；L2 passed；L3/L4 representative-passed（真实手牌入口打出 `廉价欢呼` 直接影响圣热尔韦堡垒上的己方疯狂之花后，玩家 actionLimit 从 1 提升到 2，并成功消费该额度打出 `团队标记`；interaction / triggerQueue 清空；同回合第二次不触发仍由 L2 覆盖）。 |
| `base_the_golden_lily` | 黄金百合 | C1 你的回合结束时；C2 如果你在这里有随从；C3 抽 1。 | SC-STATIC, SC-BASE | L1 passed；L2 passed；无己方随从拒绝路径 pending。 |
| `mounties_eh` | 嗯？ | C1 特殊：你每回合打出第一个行动后；C2 从弃牌堆作为额外行动；C3 你的一个随从 +1 至回合结束；C4 此卡回手而非弃牌；C5 每回合一次。 | SC-STATIC, SC-RESPONSE, SC-MINION-EFFECT | L1 passed；L2 passed；L3/L4 representative-passed；once/turn 边界 pending。 |
| `mounties_bring_em_in` | 带进来 | C1 打在一个随从上；C2 宿主移动到另一个基地后；C3 在宿主上放置 1 个 +1 指示物。 | SC-STATIC, SC-ATTACH, SC-ONGOING | L1 passed；L2 passed；真实移动事件链 pending。 |
| `mounties_mountie_major` | 骑警少校 | C1 按这里“拥有最多随从的另一位玩家”的随从数；C2 本随从持续获得等量 +1。 | SC-STATIC, SC-ONGOING | L1 passed；L2 passed；多玩家并列边界 pending。 |
| `mounties_northern_mover` | 北方搬运者 | C1 天赋选择你的另一个随从；C2 移动到另一个基地；C3 或 +1 至回合结束。 | SC-STATIC, SC-MOVE, SC-MINION-EFFECT | L1 passed；L2 passed；真实天赋入口 pending。 |
| `mounties_war_canuck` | 战争骑警 | C1 天赋检查这里有另一玩家随从；C2 本随从 +2 持续到你的下个回合开始。 | SC-STATIC, SC-MINION-EFFECT | L1 passed；L2 passed；无目标拒绝路径 pending。 |
| `mounties_when_calls_the_badge` | 呼叫警徽 | C1 打出时选择一个你有随从的基地；C2 该基地每个己方随从各 +1 指示物；C3 特殊：基地计分前打出。 | SC-STATIC, SC-RESPONSE, SC-MINION-EFFECT | L1 passed；L2 passed；L3/L4 representative-passed；更多响应轮次 pending。 |
| `mounties_dudlee` | 达德利 | C1 天赋移动此随从到有另一玩家随从的基地；C2 此随从 +1 至回合结束。 | SC-STATIC, SC-MOVE, SC-MINION-EFFECT | L1 passed；L2 passed；真实天赋入口 pending。 |
| `mounties_always_get_our_man` | 总能抓到目标 | C1 移动你的一个随从到有较低力量另一玩家随从的基地；C2 回合结束摧毁那个目标随从。 | SC-STATIC, SC-MOVE, SC-ONGOING | L1 passed；L2 passed；多候选/真实入口 pending。 |
| `mounties_battle_moose` | 战斗麋鹿 | C1 打在你的一个随从上；C2 你在这里的随从不能被其他玩家卡牌摧毁。 | SC-STATIC, SC-ATTACH, SC-ONGOING | L1 passed；L2 passed；真实入口 pending。 |
| `mounties_power_poutine` | 力量肉汁薯条 | C1 选择一个基地；C2 你在那里至多两个随从各 +2 至回合结束；C3 可空选。 | SC-STATIC, SC-MINION-EFFECT | L1 passed；L2 passed（空选 + 双选）；命令层基地选择 pending。 |
| `mounties_move_aboot` | 挪过去 | C1 选择有另一玩家随从的基地；C2 从另一个基地移动你的一个随从到那里；C3 +2 至回合结束。 | SC-STATIC, SC-MOVE, SC-MINION-EFFECT | L1 passed；L2 passed；真实入口 pending。 |
| `mounties_haich_q` | H 骑警 | C1 打在基地上；C2 你在这里每个随从 +1；C3 天赋将你的一个随从移入或移出此基地。 | SC-STATIC, SC-ATTACH, SC-ONGOING, SC-MOVE | L1 passed；L2 passed；真实天赋入口 pending。 |
| `base_strategic_syrup_reserve` | 战略枫糖储备 | C1 你在这里打出随从后；C2 可将另一玩家在你有随从的另一基地的一个随从移动到这里；C3 可跳过。 | SC-STATIC, SC-BASE, SC-MOVE | L1 passed；L2 passed（skip + 选择）；真实入口 pending。 |
| `base_great_white_north_eh` | 大白北方，嗯？ | C1 此基地计分前；C2 每位玩家可移动这里自己的一个随从到其它基地；C3 该随从 +1 至回合结束；C4 可跳过。 | SC-STATIC, SC-BASE, SC-RESPONSE, SC-MOVE | L1 passed；L2 passed（逐玩家 skip + 选择）；真实计分入口 pending。 |
| `luchadors_quick_set_up` | 快速铺垫 | C1 打在另一玩家一个随从上；C2 可额外打出一个行动；C3 额外行动可继续附着。 | SC-STATIC, SC-ATTACH, SC-EXTRA-ACTION | L1 passed；L2 passed；L3/L4 representative-passed；更多 Set-Up 边界 pending。 |
| `luchadors_smart_set_up` | 聪明铺垫 | C1 打在另一玩家一个随从上；C2 每回合第一次有随从打到宿主基地后；C3 行动控制者抽 1。 | SC-STATIC, SC-ATTACH, SC-ONGOING | L1 passed；L2 passed；L3 representative via `快速铺垫`；真实触发抽牌链 pending。 |
| `luchadors_yellow_demon` | 黄色恶魔 | C1 可搜牌库和/或弃牌堆；C2 目标限 Set-Up 行动；C3 置入手牌；C4 可跳过/无候选反馈。 | SC-STATIC, SC-SEARCH | L1 passed；L2 passed；真实入口 pending。 |
| `luchadors_reversal` | 逆转 | C1 特殊：一个你未领先的基地计分前；C2 获得那里一个带 Set-Up 行动随从控制权至回合结束；C3 摧毁该随从上任意数量你的行动；C4 可空选。 | SC-STATIC, SC-RESPONSE, SC-ATTACH, SC-ONGOING | L1 passed；L2 passed（空选仍夺控且不摧毁；多选摧毁所选己方 Set-Up 行动；回合末归还控制权）；L3/L4 representative-passed（真实计分前窗口打出，选择摧毁 2 张己方 Set-Up，临时夺控使玩家 0 在擂台边获得 4 VP，responseWindow / interaction / triggerQueue 清空；回合末归还仍由 L2 覆盖）。 |
| `luchadors_pin` | 压制 | C1 打在一个带有你的行动的随从上；C2 取消该随从能力；C3 该随从力量不计入控制者在这里总力量。 | SC-STATIC, SC-ATTACH, SC-SUPPRESS | L1 passed；L2 passed；L3/L4 representative-passed；合法目标/能力取消边界 pending。 |
| `luchadors_senor_muchoslam` | 穆乔摔先生 | C1 打出时从弃牌堆回收一个行动；C2 天赋将一个行动作为额外行动打在另一玩家随从上。 | SC-STATIC, SC-SEARCH, SC-EXTRA-ACTION | L1 passed；L2 passed；天赋目标限制消费 pending。 |
| `luchadors_powerful_set_up` | 强力铺垫 | C1 打在另一玩家一个随从上；C2 你在宿主基地每个随从 +1。 | SC-STATIC, SC-ATTACH, SC-ONGOING | L1 passed；L2 passed；suppress 边界 pending。 |
| `luchadors_tag_team` | 团队标记 | C1 在一个你有随从的基地；C2 额外打出一个随从；C3 额外随从限制到所选基地。 | SC-STATIC, SC-EXTRA-MINION | L1 passed；L2 passed；真实额外随从消费 pending。 |
| `luchadors_capa_roja` | 红披风 | C1 特殊：此基地计分前；C2 可为每位其他玩家选择至多一个印制力量 3 或以下随从；C3 摧毁所选；C4 可跳过。 | SC-STATIC, SC-RESPONSE, SC-MINION-EFFECT | L1 passed；L2 passed；L3/L4 representative-passed（真实结束回合进入计分前 Me First 窗口后触发，选择另一玩家印制力量 3 的年轻的火枪手并摧毁，擂台边由红披风反超计分，玩家 0 获得 4 VP，responseWindow / interaction / triggerQueue 清空；跳过路径仍由 L2 覆盖）。 |
| `luchadors_out_for_the_count` | 点名出局 | C1 选择一个其上有你的行动的随从；C2 将其中一个你的行动回手；C3 摧毁该随从。 | SC-STATIC, SC-ATTACH | L1 passed；L2 passed；多行动选择/真实入口 pending。 |
| `luchadors_senor_muchoslam_vs_the_monsters` | 穆乔摔先生大战怪物 | C1 从弃牌堆选择任意数量行动；C2 一个可打在随从上的行动入手；C3 其余洗入牌库；C4 可空选。 | SC-STATIC, SC-SEARCH | L1 passed；L2 passed（空选不回收/不洗牌；选择行动后回收可打在随从上的行动并洗回其余所选行动）；L3/L4 representative-passed（真实手牌入口：空选后弃牌堆原行动与牌库不变；多选 `压制` + `团队标记` 后，`压制` 回手、`团队标记` 洗回牌库）。 |
| `luchadors_flor_loca` | 疯狂之花 | C1 若这里另一玩家随从上有你的行动；C2 此随从 +2。 | SC-STATIC, SC-ONGOING | L1 passed；L2 passed；suppress 边界 pending。 |
| `luchadors_cheap_pop` | 廉价欢呼 | C1 你的一个随从 +2 至回合结束；C2 若那里有带 Set-Up 行动的随从，改为 +4。 | SC-STATIC, SC-MINION-EFFECT | L1 passed；L2 passed；真实入口 pending。 |
| `base_ringside` | 擂台边 | C1 你打出直接影响这里另一玩家随从的行动后；C2 抽 1。 | SC-STATIC, SC-BASE | L1 passed；L2 passed；L3/L4 representative-passed（真实手牌入口将 `压制` 打到这里另一玩家带己方 Set-Up 行动的达达尼昂后，玩家 0 抽到牌库顶 `团队标记`，牌库清空，`压制` 附着完成，interaction / triggerQueue 清空）。 |
| `base_the_squared_circle` | 方形擂台 | C1 每回合第一次你在这里打出随从后；C2 可随机回收弃牌堆一个行动。 | SC-STATIC, SC-BASE, SC-SEARCH | L1 passed；L2 passed；L3/L4 representative-passed（真实手牌入口将疯狂之花打到方形擂台，弃牌堆唯一行动 `压制` 随机回手，弃牌堆清空，方形擂台出现所打随从，interaction / triggerQueue 清空；无弃牌堆行动边界仍待补）。 |

## 剩余补证清单

- **真实入口优先级 1**：`大白北方，嗯？` 等计分前响应窗仍需要更多 L3/L4；`红披风（Capa Roja）` 已补真实计分入口摧毁低印制力量随从并反超计分截图链。
- **真实入口优先级 2**：任意数量 / 至多 / 可跳过 UI 的 L2 已补齐；`炖肉`、`穆乔摔先生大战怪物` 已补真实入口空选与多选截图链，`斗志奖` 已补真实入口抽牌与分配指示物截图链，`逆转` 已补真实计分前窗口夺控 + 多选摧毁 Set-Up 截图链，`最后一搏` 已补真实计分前窗口反超计分 + 抽牌截图链。
- **真实入口优先级 3**：触发器 finalState / triggerQueue / reaction session 中，`阿拉密斯`、`全为一` 已补真实入口与最终状态；基地 `方形擂台` 已补真实打出随从入口随机回收行动，`圣热尔韦堡垒` 已补真实行动影响己方随从后授予并消费额外行动，`擂台边` 已补真实行动影响另一玩家随从后抽牌链。
- **资源门禁**：使用有效 R2 凭据重新上传 `international_incident.webp` 与 `international_incident_bases.webp`，并拿到 CDN `HEAD 200`。

## 本轮验证

| 命令 | 结果 |
| --- | --- |
| `node` 矩阵行数检查 | passed：对象行 `59`，重复 ID `none` |
| `git diff --check -- evidence/smashup/2026-07-15-international-incident-effect-atom-matrix.md evidence/smashup/2026-07-13-international-incident-intake-contract.md openspec/changes/add-smashup-international-incident-factions/tasks.md` | passed |
| `openspec validate add-smashup-international-incident-factions --strict --no-interactive` | passed |
| `npx eslint src/games/smashup/abilities/international_incident.ts src/games/smashup/__tests__/abilities/international-incident.test.ts e2e/smashup/smashup-international-incident-four-factions.e2e.ts` | passed |
| `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts src/games/smashup/__tests__/internationalIncidentResourceContract.test.ts --reporter=dot` | passed：2 files / 45 tests |
| `npx eslint src/games/smashup/abilities/international_incident.ts src/games/smashup/__tests__/abilities/international-incident.test.ts` | passed |
| `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts --reporter=dot` | passed：1 file / 41 tests；新增覆盖 `炖肉` 空选/选择弃牌、`斗志奖` 分配到 2 个随从、`逆转` 空选/任意数量摧毁、`穆乔摔先生大战怪物` 空选/选择行动 |
| `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts src/games/smashup/__tests__/internationalIncidentResourceContract.test.ts --reporter=dot` | passed：2 files / 45 tests |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native --reporter=dot` | passed：1 file / 8 tests |
| `npx tsc --noEmit --pretty false` | passed |
| `npm run i18n:check` | passed：no missing keys detected |
| `npm run assets:validate` | passed：incremental manifest 校验通过，覆盖根级与 Smash Up 游戏级 manifest |
| `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "逆转可从真实计分前窗口夺控并摧毁己方 Set-Up 行动"` | passed：1 Playwright test；`逆转` 从真实计分前窗口打出，选择摧毁 2 张己方 Set-Up，玩家 0 通过夺控目标随从获得擂台边 4 VP，responseWindow / interaction / triggerQueue 收口 |
| `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "最后一搏可从真实计分前窗口反超计分并抽牌"` | passed：1 Playwright test；`最后一搏` 从真实计分前窗口打出，己方年轻的火枪手反超获得土俵 3 VP，抽到 `预备姿势`，responseWindow / interaction / triggerQueue 收口 |
| `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "Capa Roja 可从真实计分前窗口摧毁低印制力量随从并反超计分"` | passed：1 Playwright test；`红披风（Capa Roja）` 从真实计分前窗口选择并摧毁另一玩家印制力量 3 的年轻的火枪手，玩家 0 在擂台边获得 4 VP，responseWindow / interaction / triggerQueue 收口 |
| `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "阿拉密斯可从真实反应窗口获得并消费限定额外行动"` | passed：1 Playwright test；`阿拉密斯` 从真实反应窗口获得限定额外行动并消费 `等待时机`，阿拉密斯累计 +3 临时力量，关键行动进入弃牌堆，interaction 收口 |
| `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "全为一可从真实手牌附着、触发加力并在回合结束自毁"` | passed：1 Playwright test；`全为一` 从真实手牌附着到波尔托斯，触发宿主 +1 并在回合结束自动进入弃牌堆，interaction 收口 |
| `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "方形擂台可从真实打出随从入口随机回收弃牌堆行动"` | passed：1 Playwright test；`方形擂台` 从真实打出随从入口触发，弃牌堆唯一行动 `压制` 回到手牌，弃牌堆清空，interaction / triggerQueue 收口 |
| `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "圣热尔韦堡垒可从真实行动影响己方随从入口授予额外行动"` | passed：1 Playwright test；`圣热尔韦堡垒` 从真实手牌行动触发，`廉价欢呼` 影响己方疯狂之花后授予额外行动，玩家继续打出 `团队标记`，interaction / triggerQueue 收口 |
| `npx vitest run src/games/smashup/__tests__/abilities/international-incident.test.ts --reporter=dot` | passed：1 file / 42 tests；新增覆盖 `擂台边` 识别 `压制` 的真实 `ONGOING_ATTACHED` 事件并抽牌，防止附着行动只带 `payload.defId` 时被误过滤 |
| `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts "擂台边可从真实行动影响另一玩家随从入口抽牌"` | passed：1 Playwright test；`压制` 从真实手牌入口附着到这里另一玩家带己方 Set-Up 行动的达达尼昂后，玩家 0 抽到 `团队标记`，牌库清空，interaction / triggerQueue 收口 |
| `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts` | passed：14 Playwright tests；完整文件复跑通过，覆盖 `四派系代表能力` 中 `聪明 Set-Up` 附着后由 `擂台边` 抽到 `团队标记` 与 `廉价欢呼`、`圣热尔韦堡垒` 真实行动影响己方随从后授予并消费额外行动、`方形擂台` 真实打出随从入口随机回收弃牌堆行动、`擂台边` 真实行动影响另一玩家随从后抽牌，以及 `全为一` 真实附着 / 触发加力 / 回合末自毁、`阿拉密斯` 真实反应窗口 + 限定额外行动消费等代表链 |
| `openspec validate add-smashup-international-incident-factions --strict --no-interactive` | passed |
| `.gitignore` 资源入仓例外复核 | passed：四个国际事件资源文件已从忽略规则中放行，`git status --short` 可见 `public/assets/i18n/zh-CN/smashup/cards/international_incident.png`、`cards/compressed/international_incident.webp`、`base/international_incident_bases.png`、`base/compressed/international_incident_bases.webp` |
| CDN `HEAD`：`official/i18n/zh-CN/smashup/cards/compressed/international_incident.webp` / `official/i18n/zh-CN/smashup/base/compressed/international_incident_bases.webp` | blocked：`.env` missing、`.env.example` present；两个 URL 当前均 `404` |
| `npm run assets:check` | blocked：R2 远程文件列表获取返回 `401 Unauthorized`；仍是凭据 / 环境 blocker，不是本地资源合同失败 |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionCompletenessAudit.test.ts src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts src/games/smashup/__tests__/audit-interaction-chain.property.test.ts --config vitest.config.audit.ts --configLoader native --reporter=dot` | blocked：当前全局历史基线仍含 penguins / marvel_villains / skeletons 等 sourceId / orphan handler 失败；本轮新增国际事件 sourceId 未出现在缺 handler 列表 |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native --reporter=dot` | blocked：当前全局历史基线仍含旧 runtime 迁移、未注册 ongoing、旧能力标签等失败；已修正 `压制` “带有你的行动的随从”被误判为“你的随从”的审计推断，复跑后该项不再出现在失败列表 |
| `npx vitest run src/games/smashup/__tests__/interactionCompletenessAudit.test.ts src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts src/games/smashup/__tests__/ongoingMinionTriggerAudit.test.ts src/games/smashup/__tests__/ongoingModifiers.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts src/games/smashup/__tests__/internationalIncidentResourceContract.test.ts --reporter=dot` | passed：命令退出 `0`，Vitest 报告 3 files / 101 tests |
| `npx vitest run src/games/smashup/__tests__/audit-ability-coverage.property.test.ts src/games/smashup/__tests__/audit-ongoing-coverage.property.test.ts src/games/smashup/__tests__/audit-interaction-chain.property.test.ts src/games/smashup/__tests__/baseAbilities.test.ts src/games/smashup/__tests__/baseAbilityIntegration.test.ts --reporter=dot` | passed：命令退出 `0`，Vitest 报告 2 files / 40 tests；`baseAbilityIntegration` stderr 为预期管线校验日志，未失败 |
| `.env` / CDN HEAD 复核 | blocked：`.env` missing、`.env.example` present、当前进程无 R2 相关环境变量；`international_incident.webp` = 404，`international_incident_bases.webp` = 404 |
