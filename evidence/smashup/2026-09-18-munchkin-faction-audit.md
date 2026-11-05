# 大杀四方 Munchkin 未收口派系批次审计回写

## 基本信息

- 对象：Smash Up / 大杀四方 Munchkin 新派系批次
- 日期：2026-09-18
- 文档类型：`batch_audit_writeback`
- 关联旧文档：`evidence/smashup/munchkin-new-faction-flow-audit-2026-08-01.md`
- 当前裁定：半身人、盗贼、法师、兽人、勇士达到本地对象级摘牌口径；这不是 Munchkin 整扩展收口。

## 审计范围

- 主真相源：`src/games/smashup/data/factions/munchkin.ts`、`src/games/smashup/abilities/munchkin.ts`、`src/games/smashup/abilities/munchkin_mages.ts`、`src/games/smashup/abilities/munchkin_orcs.ts`、`src/games/smashup/abilities/munchkin_warriors.ts`。
- 覆盖对象：5 个当前未收口候选派系，每派系 12 张唯一卡 + 2 张基地；公共怪物 / 宝藏牌堆不并入本批次的派系摘牌结论。
- 对象全集：
  - 半身人：`munchkin_halflings_shire_marshal`、`munchkin_halflings_pestling`、`munchkin_halflings_bardling`、`munchkin_halflings_quarterling`、`munchkin_halflings_last_call`、`munchkin_halflings_lunch_run`、`munchkin_halflings_out_of_nowhere`、`munchkin_halflings_rude_awakening`、`munchkin_halflings_small_but_tough`、`munchkin_halflings_sneaksy`、`munchkin_halflings_spoiled_brats`、`munchkin_halflings_unexpected_party`、`base_birthday_party`、`base_subterranean_lair`
  - 盗贼：`munchkin_thieves_master_thief`、`munchkin_thieves_fence`、`munchkin_thieves_cat_burglar`、`munchkin_thieves_pickpocket`、`munchkin_thieves_backstab`、`munchkin_thieves_clever_distraction`、`munchkin_thieves_mugging`、`munchkin_thieves_potion_bandolier`、`munchkin_thieves_secret_stash`、`munchkin_thieves_smuggling`、`munchkin_thieves_strip_bare`、`munchkin_thieves_swipe`、`base_the_coffers`、`base_thieves_guild`
  - 法师：`munchkin_mages_blaster_master`、`munchkin_mages_happy_zapper`、`munchkin_mages_wand_whiz`、`munchkin_mages_scroll_shuffler`、`munchkin_mages_charm`、`munchkin_mages_embiggen`、`munchkin_mages_mass_summoning`、`munchkin_mages_portal_to_beyond`、`munchkin_mages_recover_arcane_wisdom`、`munchkin_mages_some_enchanted_evening`、`munchkin_mages_speed_reading`、`munchkin_mages_zzzzzap`、`base_dimension_doors`、`base_mages_tower`
  - 兽人：`munchkin_orcs_sword_lord`、`munchkin_orcs_dork_orc`、`munchkin_orcs_dogpile`、`munchkin_orcs_hammer_slammer`、`munchkin_orcs_topper_chopper`、`munchkin_orcs_and_stay_down`、`munchkin_orcs_angry_pillagers`、`munchkin_orcs_crush`、`munchkin_orcs_death_breath`、`munchkin_orcs_gimme`、`munchkin_orcs_stalling`、`munchkin_orcs_too_tough`、`base_garrison`、`base_the_pits`
  - 勇士：`munchkin_warriors_big_hero`、`munchkin_warriors_berserker`、`munchkin_warriors_star_player`、`munchkin_warriors_taunter`、`munchkin_warriors_campaign`、`munchkin_warriors_cleave`、`munchkin_warriors_war_cry`、`munchkin_warriors_ruckus`、`munchkin_warriors_dumbbells`、`munchkin_warriors_shield_of_ubiquity`、`munchkin_warriors_dungeon_bait`、`munchkin_warriors_eternal_hero`、`base_bastion`、`base_the_gauntlet`
- 不在本轮范围：Munchkin 矮人、木精灵、牧师既有 closeout；公共怪物 / 宝藏牌堆全量审计；服务器资源重新上传与公开 URL 回查；整批移动端逐对象视觉收口。

## 结论等级

结论等级：`部分对象级收口，批次仍有残余范围`。

- 半身人：`object_closeout_passed`。12 张卡 + 2 个基地均有静态对象合同、领域行为、真实入口状态和手动选择 / 限定基地范围证据。
- 盗贼：`object_closeout_passed`。12 张卡 + 2 个基地均有对象级领域证据；盗贼真实入口筛选 13/13 通过，选择权与计分链收口已复核。
- 法师：`object_closeout_passed`。领域行为与负向 / 生命周期审计 19/19 通过；法师专属真实入口筛选 14/14 通过，另有牧师“抓鬼”跨派系联动 1/1 通过。此前“快乐小法师计分前超时”来自测试把场上来源随从的 `field-source-action` 错当成独立按钮，已按正式玩家入口改为点击来源随从本体后通过。
- 兽人：`object_closeout_passed`。14 个对象均有对应领域实现、领域行为证据、真实入口证据，以及无合法目标 / 保护边界 / 响应或计分生命周期中的直接覆盖；本轮 45 条真实入口（44 条兽人对象链 + 1 条跨派系保护联动）全部通过。
- 勇士：`object_closeout_passed`。12 张卡 + 2 个基地均有领域消费、真实入口、最终状态和关键负向 / 清理证据；11/11 条勇士真实入口浏览器用例通过。

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | 本文锁定 5 派系完整 14 对象清单，并分别引用 `munchkin.ts` 的派系数组与基地数组。 |
| 真相源状态 | `passed` | 当前正式 TS 数据、能力注册、领域测试和真实入口 E2E 是主证据；历史总账只作状态回写。 |
| 原子语义断言 | `passed` | 半身人 / 盗贼 / 法师 / 兽人 / 勇士按对象核对“触发、候选、限制、结算、清理”；勇士的战争怒吼无合法目标边界已补回归。 |
| 实现消费链 | `passed` | 入口覆盖 `munchkin.ts`、`munchkin_mages.ts`、`munchkin_orcs.ts`、`munchkin_warriors.ts` 及公共 Munchkin reducer / interaction handler。 |
| 最终权威结果 | `passed` | 证据回到手牌、弃牌堆、基地随从 / 怪物、额外额度、力量修正、响应窗口和 `interactionSourceId` / `sys.interaction.current`。 |
| 交互真实入口 | `passed_scoped` | 半身人 2 条新入口、盗贼 13/13、法师专属 14/14、勇士 11/11，另有牧师“抓鬼”跨派系联动 1/1；兽人本轮重新运行 45/45。 |
| 验证证据 | `passed_scoped` | 法师领域行为与负向 / 生命周期 19/19、响应窗口与交互栏定向测试合计 53 条通过；兽人领域 22/22、兽人相关真实入口本轮重跑 45/45（其中 44 条为兽人对象链、1 条为牧师跨派系联动）；勇士领域测试 10/10、真实入口 11/11。2026-10-23 重跑共享 `interactionTargetTypeAudit` 为 12/14；两条失败分别是 response chooser 的 field-source-action 静态合同片段缺失，以及 `base_uss_undertaking` / 三个 goblins sourceId 混用 targetType，详情见本文件续审记录。 |
| 共享影响与代表链依据 | `passed` | `sharedFlowId` 见下表；代表链只用于共享流程判等，不替代派系对象全集。 |
| 缺口分类与范围裁定 | `passed` | 法师、兽人、勇士已完成当前对象级真实入口收口；牧师抓鬼跨派系联动已复测通过；共享静态合同和公共牌堆仍按各自范围保留。 |
| 旧 evidence / 旧结论对账回写 | `passed` | 旧 Munchkin 总账顶部已追加 2026-09-18 回写；半身人和盗贼旧 `in_progress` 结论被本文件替代。 |
| 残余范围声明 | `passed` | 明确禁止把当前结论外推到公共牌堆或 Munchkin 整扩展；共享 `interactionTargetTypeAudit` 的两类静态失败不构成 Munchkin 对象运行时失败证据，仍需在共享合同范围处理。 |

## 共享流程审计与代表链依据

| sharedFlowId | 代表对象 | 一致性核对 | 允许配置差异 | 当前裁定 |
| --- | --- | --- | --- | --- |
| `smashup-munchkin-manual-card-cost` | 盗贼药水腰带、法师勤读者 / 快速阅读、快乐小法师 | 触发时机为出牌或天赋；候选是玩家手牌；权限是来源玩家；payload 是被弃牌 UID；执行入口是对应 handler；最终状态是弃牌堆、抽牌、临时力量或交互清空；清理语义是 `sys.interaction.current` 关闭。 | 成本数量、后续抽牌数量、是否给额外额度或临时力量。 | 半身人 / 盗贼 / 法师均已通过；快乐小法师的正式入口是场上来源随从本体，不是另行生成的能力按钮。 |
| `smashup-munchkin-minion-target-choice` | 半身人季度人、盗贼打劫 / 药水腰带、勇士战争怒吼 | 候选必须落在真实基地 / 随从本体，单候选不得静默代选；payload 带 `minionUid` / `baseIndex`；执行后回到基地、力量或手牌最终状态；无残留交互。 | 同基地限制、力量阈值、控制者范围、额外额度。 | 半身人 / 盗贼 / 勇士均已通过；战争怒吼额外要求第一步怪物所在基地存在可合法加力量随从。 |
| `smashup-munchkin-scoring-response` | 盗贼转移注意力、法师快乐小法师、兽人躺下 / 愤怒的掠夺者、勇士计分前模式 | 计分前后响应窗口、来源卡归属、玩家提交、triggerQueue、最终计分 / VP / 临时力量或保护效果和清理均核对。 | beforeScoring / afterScoring、目标卡类型、VP、临时力量或保护效果。 | 盗贼 / 法师 / 兽人 / 勇士对象链均已通过；共享静态合同残余另行处理。 |

## 原子语义与实现消费

| 派系 | 对象级原子语义与实现消费 | 最终权威结果 | 真实入口 / 测试证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 半身人 | 夏尔首领选择基地并只授予该基地额度；调皮鬼 / 吟游诗人按同基地和条件授予额外随从；季度人只在自己是该基地唯一己方随从时开放同基地第二个随从；行动牌分别覆盖计分前打出、基地选择、牌库展示、回手、附着保护、额外随从和弃牌堆回收。实现消费为 `munchkin.ts` 的半身人 handler、基地限制 validator 和共享手动选择入口。 | 目标基地 / 随从、额外随从额度、手牌 / 弃牌堆变化与 `interactionSourceId=null` 均有断言；额外随从不能打到其它基地。 | `munchkin-new-faction-flow-audit-2026-08-01.md` 半身人对象矩阵；当前 E2E：半身人雇佣兵、半身人同基地额外随从 2/2 通过；`munchkinIntake.test.ts` 与 Munchkin 领域测试通过。 | 无当前对象级阻塞。 | `passed` |
| 盗贼 | 盗贼大师 / 销赃犯的天赋抽 / 弃宝藏；猫咪窃贼 / 扒手的同基地和重复扒手条件；背刺、打劫、药水腰带、走私、剥光的弃宝藏成本与目标选择；顺手拿走、秘密藏匿处、转移注意力、金库覆盖普通抽牌和计分响应。实现消费为 `munchkin.ts` 盗贼 handler、目标过滤、响应归属和计分后奖励。 | 13/13 真实入口均回到手牌、弃牌堆、附着行动、基地计分、VP / 抽宝藏和交互清空；单候选不自动代选。 | 旧总账 2026-08-05 盗贼批次记录；盗贼 13/13 E2E、12/12 领域行为、3/3 运行时交互审计；药水腰带、打劫、金库计分链截图已复核。 | 无当前对象级阻塞。 | `passed` |
| 法师 | 4 随从 + 8 行动 + 2 基地；领域层覆盖弃牌成本、力量目标、额外出牌、怪物召唤、抽牌、计分前特殊和基地触发。实现消费为 `munchkin_mages.ts` 的弃牌成本、随从目标、模式选择、牌库 / 怪物牌库和基地能力 handler。 | 领域层最终状态通过；法师专属真实入口筛选 14/14 通过，覆盖弃牌成本、力量目标、额外出牌、怪物选择、抽牌和计分前来源随从本体入口；响应清理、临时力量、受控怪物力量计入和回合结束恢复均回到权威状态。 | `munchkin-mages.test.ts` 19/19；`response-window-skip.test.ts` 21/21；`Board.interactionBars.test.ts` 13/13；法师专属真实入口 14/14；牧师“抓鬼”跨派系联动 1/1。关键图组见下方“法师真实入口证据”。 | 当前没有法师对象级运行时阻塞；共享 `interactionTargetTypeAudit` 的 2 条静态合同残余仍不归入法师运行时缺陷。 | `object_closeout_passed` |
| 兽人 | 12 卡 + 2 基地；剑王持续加力、呆瓜兽人 / 坑洞保护、重击者 / 狗堆 / 挤碎目标选择、给我 / 太难了 / 洗手间附着链、躺下 / 愤怒的掠夺者计分前响应、要塞 / 坑洞基地效果。实现消费为 `munchkin_orcs.ts`、`ongoing_modifiers.ts` 与公共保护 / 附着 / 计分框架。 | 14 个对象逐项矩阵已回查；领域测试 22/22；兽人相关真实入口 45/45，其中 44 条为兽人对象链、1 条为牧师跨派系保护联动。 | 当前 E2E 覆盖桌面、移动端、无合法目标、保护边界、响应窗、计分、移动后恢复和最终清理。 | 无当前对象级运行时阻塞；共享测试入口曾有遮罩阻塞，已修复并复测。 | `object_closeout_passed` |
| 勇士 | 12 卡 + 2 基地；大英雄、狂战士、嘲讽者、领导运动、斩杀、地牢诱饵、骚乱、战争怒吼、哑铃、无处不在之盾、永恒的英雄、明星勇士和两张基地能力均追到领域消费、玩家入口、最终状态与清理。实现消费为 `munchkin_warriors.ts`、`ongoing_modifiers.ts`、共享多步交互和计分框架。 | 11/11 条真实入口浏览器用例通过；领域测试 10/10 通过；战争怒吼无可合法目标时不再暴露死路窗口。 | `smashup-munchkin-monster-treasure-ui.e2e.ts` 勇士 11/11；`munchkin-warriors.test.ts` 10/10；`munchkinIntake.test.ts` 状态回写通过。 | 无当前对象级运行时阻塞。 | `object_closeout_passed` |

### 兽人 14 个对象逐项映射

| 对象 | 规则原子与实现消费 | 真实入口 / 最终状态证据 | 负向 / 生命周期结论 |
| --- | --- | --- | --- |
| 剑王 | 持续：同基地、同控制者、排除自身的其他随从各得 +1；消费 `ongoing_modifiers.ts` 自定义力量修正。 | `兽人剑王真实入口显示同基地己方力量加成并排除自身、对手和其他基地`；桌面与移动端均回查力量标记和权威力量。 | 同基地 / 对手 / 其他基地边界通过；随状态派生，无残留交互。 |
| 粉碎者 | 天赋“什么都不做”；注册为真实天赋入口，结算由通用已使用状态负责。 | `兽人粉碎者真实入口保留手动天赋按钮并记录已使用状态`、移动端同链；手动入口可见，使用后记录收口。 | 不自动代用、不生成隐藏目标；天赋生命周期通过。 |
| 重击者 | 出场后手动选择力量不超过 2 的随从并摧毁；消费 `munchkin_orcs_hammer_slammer_target` 与 validated destroy。 | 桌面、移动端正向和 `兽人重击者移动端无合法目标时不生成隐藏目标或假结算`；合法目标进入弃牌，行动完成。 | 单候选仍停在手动选择；无合法目标时随从留场、卡不假结算。 |
| 呆瓜兽人 | 不受其他玩家行动影响；保护只按 `action` 与来源玩家判断。 | 桌面 / 移动端《挤碎》真实入口过滤保护目标；另有牧师跨派系联动。 | 自己行动、非行动来源和同基地普通随从边界通过；保护目标不被错误摧毁。 |
| 躺下！ | 计分前手动响应；本基地己方总力量最高时压制其他玩家特殊能力。 | 桌面、移动端正向、平手最高、落后不响应；压制写入后计分清场，卡进弃牌，响应和交互清空。 | 最高 / 平手 / 落后均已覆盖；压制随计分生命周期清理。 |
| 愤怒的掠夺者 | 计分前手动响应；领先第二名至少 3 力量时获得 1 VP。 | 桌面、移动端正向与领先不足 3 点负向；VP、卡牌、响应窗回查。 | 阈值不足不展示响应、不奖励额外 VP；正向结算后清理通过。 |
| 挤碎 | 依次手动选基地、仆从更少的玩家、该玩家随从；消费三段 interaction handler 与保护过滤。 | 桌面 / 移动端三步真实选择和最终摧毁；无合法目标场景保持手牌。 | 单步不自动跳过；保护目标被过滤，交互完成后无残留。 |
| 死亡之息 | 手动选择力量不超过 4 的随从，放入拥有者牌库底。 | 桌面 / 移动端正向、太难了保护目标、全目标受保护、坑洞离开后恢复、坑洞控制者自身行动均通过。 | 无合法目标保持手牌；跨基地保护不延续；目标进入正确拥有者牌库底，卡进弃牌。 |
| 狗堆 | 普通打出与计分前特殊均按“先选己方随从、再选至少有两个己方随从的基地”；消费同一 handler 的两个入口。 | 领域普通 / 特殊双入口，桌面 / 移动端计分前真实链，坑洞离开链；移动事件与最终基地状态回查。 | 无合法目标不生成隐藏基地交互；叠卡场景已修正为点击顶部可见源随从。 |
| 给我！ | 手动选附着行动，摧毁原宿主，再手动选己方新宿主并转移行动。 | 桌面 / 移动端两段真实选择；原宿主离场、行动仍附着新宿主、交互清空。 | 原宿主不能作为新宿主；附着行动未落地时不假成功。 |
| 洗手间 | 附着基地；其他玩家在同基地打行动时，由牌主手动选择己方随从保护或明确跳过。 | 桌面 / 移动端正向、跨玩家承接、明确跳过；保护元数据、目标结算和窗口清理回查。 | 自己行动、其他基地行动不触发；跳过不写保护状态。 |
| 太难了 | 附着随从；该随从不受其他玩家行动影响；消费通用 action protection。 | 桌面 / 移动端真实附着；死亡之息真实目标筛选同时证明保护生效。 | 自己行动与非行动不被错误阻断；受保护目标不进入死亡之息候选。 |
| 要塞 | 总力量达到 22 时，前三名玩家各额外 +1 VP；消费基地 VP modifier。 | 桌面 / 移动端正向、低于 22、并列第三 / 并列最高计分；权威 `base_scored` 与 VP 回查。 | 低于门槛不奖励；并列名次不漏发；计分后基地清场和公共牌入口正常。 |
| 坑洞 | 坑洞内随从不受其他玩家行动影响；保护绑定基地，不跨基地延续。 | 桌面 / 移动端行动过滤、离开后恢复、控制者自身行动、其他玩家非行动效果、达到 16 计分清场均通过。 | 行动保护、来源玩家、非行动来源、跨基地移动和计分生命周期全部覆盖；无残留保护状态。 |

**兽人本轮审计裁定**：`object_closeout_passed`。上述 14 行均有直接对象证据或同一对象的独立生命周期 / 负向证据；44 条兽人对象入口全部通过，另有 1 条跨派系保护联动通过，不能再把兽人保留为“仅代表性验证”。

### 法师 14 个对象逐项映射

| 对象 | 规则原子 | 领域 / 真实入口证据 | 负向 / 生命周期证据 |
| --- | --- | --- | --- |
| 爆破大师 | 弃 1 张牌；摧毁力量不超过 2 的仆从 | `munchkin-mages.test.ts`：弃牌后再选目标；E2E：真实手牌成本与低力量目标 | 无合法目标不生成弃牌交互 |
| 快乐小法师 | 天赋弃 1 张牌得 +2；计分前可从来源随从本体复用天赋 | `munchkin-mages.test.ts`：天赋与 special 各 1 条；E2E：计分前真实响应入口 | 临时力量结算后回权威状态；计分前来源入口已修正 |
| 魔杖天才 | 弃 1 张牌；额外随从或额外行动二选一 | `munchkin-mages.test.ts`：成本与模式选择；E2E：成本与额外出牌类型 | 两种模式均落到对应额度事件 |
| 勤读者 | 弃 1 张牌，抽 1 张牌 | `munchkin-mages.test.ts` 与 E2E 均覆盖弃牌堆来源校验 | 交互完成后手牌、弃牌堆和窗口收口 |
| 魅力 | 控制一个未被控制的怪物直到回合结束 | `munchkin-mages.test.ts` 与 E2E 覆盖怪物行手动选择 | 已控制怪物排除；受控怪物计入基地力量；回合结束恢复公共控制 |
| 大上一倍 | 选仆从；任意弃牌；每张弃牌 +1 力量 | `munchkin-mages.test.ts` 与 E2E 覆盖先目标后多选弃牌 | 零选择与多选均由玩家提交，临时力量回权威状态 |
| 大召唤 | 每个基地打出 1 个怪物 | `munchkin-mages.test.ts` 与 E2E 覆盖逐基地怪物行 | 怪物牌库为空时不生成虚假怪物 |
| 通往次元之门 | 持续行动落在基地；天赋弃 1 张牌在该基地打出怪物 | `munchkin-mages.test.ts` 与 E2E 覆盖卡本体天赋和基地范围 | 怪物牌库为空时不创建弃牌成本交互 |
| 恢复奥术智慧 | 抽牌直到手上有 5 张 | `munchkin-mages.test.ts` 与 E2E 覆盖手牌补足 | 抽牌数量以来源牌离手后的手牌数为准 |
| 神奇的夜晚 | 任意弃牌；每张牌给 1 个力量不超过 3 的额外随从额度 | `munchkin-mages.test.ts` 与 E2E 覆盖多选弃牌与额度 | 允许零选，不产生弃牌或额外额度 |
| 快速阅读 | 弃 1 张牌，抽 3 张牌 | `munchkin-mages.test.ts` 与 E2E 覆盖成本与三张抽牌 | 弃牌成本来源和抽牌最终状态均回查 |
| 快速攻击！ | 弃 1 张牌；摧毁力量不超过 3 的仆从 | `munchkin-mages.test.ts` 与 E2E 覆盖成本与力量目标 | 高于 3 的目标不进入候选 |
| 次元之门 | 每回合第一次在此打出仆从后，可弃牌额外打出仆从 | `munchkin-mages.test.ts` 与 E2E 覆盖手动弃牌 / 跳过 | 第二次触发由基地触发队列资格检查拦截 |
| 法师之塔 | 在此打出仆从后，可抽 1 张牌 | `munchkin-mages.test.ts` 与 E2E 覆盖抽牌 / 跳过按钮 | 空牌库选择抽牌不生成抽牌事件；跳过正常收口 |

## 缺口分类与范围裁定

| 条目 | 分类 | 现实影响 | 最小补救 |
| --- | --- | --- | --- |
| 共享 `interactionTargetTypeAudit` 两条静态测试失败 | 共享流程审计残余 | 2026-10-23 结果为 12/14：一条检查缺 `FIELD_SOURCE_ACTION_PROMPT_TARGET_TYPE` 与对应 `targetType` 片段；另一条发现 `base_uss_undertaking`（Cease and Desist / Half the Battle）及 `goblins_chaos_lord`、`goblins_blaster`、`goblins_demolition` 的 sourceId 跨调用混用 targetType。当前没有 Munchkin sourceId 出现在这四项冲突中，也没有 Munchkin 运行时失败证据。 | 在共享合同专项中裁定 response chooser 的 source-action 语义及 sourceId 冲突；不据此回退五个 Munchkin 派系的对象级结论。 |
| 测试共享入口的卡牌特写遮罩 | `confirmed_test_harness_gap`，已修复 | `GameTestContext.playCard` 先点击手牌时未复用已有遮罩关闭入口，现实后果是可见手牌存在但真实点击被特写层拦截；规则源码没有因此失败。 | 已在 `e2e/framework/GameTestContext.ts` 的 `playCard` 开头调用 `dismissRevealOverlayIfPresent()`；坑洞离场后死亡之息原始用例已重新通过。 |
| 战争怒吼候选生成过宽 | `功能实现阻塞`，已修复 | 旧实现先展示没有可加力量仆从的基地怪物，玩家选中后第二步没有合法目标，形成无法完成的玩家流程。 | 候选生成与刷新统一先检查同基地合法仆从，再暴露怪物；已补红绿回归测试。 |
| 公共怪物 / 宝藏牌堆 | 非本批次范围 | 其状态仍不能由半身人 / 盗贼摘牌外推。 | 继续沿 Munchkin 公共牌堆独立 evidence 收口。 |

## 验证证据

- `munchkinIntake.test.ts`：状态断言已将半身人、盗贼、法师、矮人、木精灵、牧师、兽人、勇士一起视为已配置。
- `src/games/smashup/__tests__/abilities/munchkin-mages.test.ts`：19/19 通过；新增无合法目标、空怪物牌库、零选择、重复基地触发、受控怪物力量和空牌库基地选择覆盖。
- 真实入口：半身人 2/2 通过；盗贼 13/13 通过；法师专属筛选 14/14 通过；牧师“抓鬼”跨派系联动 1/1 通过；勇士 11/11 通过；兽人本轮重新运行 45/45。法师关键图组见下方路径。
- 本轮勇士负向审计发现：战争怒吼初始候选只按“未被控制的怪物”筛选，没有同时要求该基地存在可合法加力量的仆从；修复后候选生成和动态刷新都复用同一条合法目标判断，避免玩家进入无法完成的第二步。

### 法师真实入口证据

- 计分前来源入口：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\法师快乐小法师在计分前从真实响应窗口手动激活特殊能力\法师-快乐小法师特殊-手动选择特殊能力.jpg`
  - 画面可见计分前响应窗口、场上快乐小法师本体和绿色可操作高亮；没有把能力伪装成独立按钮。
- 弃牌成本窗口：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\法师快乐小法师在计分前从真实响应窗口手动激活特殊能力\法师-快乐小法师特殊-手动选择弃牌成本.jpg`
  - 画面回到玩家手牌，两张手牌作为弃牌成本候选可见并高亮，说明点击来源随从后确实进入正式弃牌选择。
- 结算后收口：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\法师快乐小法师在计分前从真实响应窗口手动激活特殊能力\法师-快乐小法师特殊-结算后.jpg`
  - 画面已退出响应层并回到出牌阶段；测试同时断言临时力量事件、弃牌落入弃牌堆、响应来源和响应窗口均清空。
- 跨派系联动：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\牧师抓鬼从真实法师天赋入口拦截亡灵怪物并保留普通怪物\牧师-抓鬼-亡灵怪物被放回怪物牌库底.jpg` 与 `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-munchkin-monster-treasure-ui.e2e\牧师抓鬼从真实法师天赋入口拦截亡灵怪物并保留普通怪物\牧师-抓鬼-普通怪物保留在基地下方.jpg`
  - 前者证明亡灵怪物被放回怪物牌库底，后者证明普通怪物仍留在基地下方；两段都从法师“通往次元之门”真实天赋入口进入。

## 旧 evidence / 旧结论对账回写

- 旧总账曾把半身人写成“能力未建模”，把盗贼写成“仅第一批对象完成”；当前证据已推翻这两条旧状态，故本轮删除它们在 `ids.ts` 的 `in_progress` 标记。
- 旧总账对法师的“窄链已补齐”与“真实入口阻塞”结论均已失效：快乐小法师失败点是测试把 `field-source-action` 当成独立按钮，未按正式来源随从本体语义操作；牧师“抓鬼”失败点是测试把直接手牌选择当成弹窗卡片并额外点击确认。两处均已按正式玩家入口修正，法师专属筛选 14/14、跨派系联动 1/1 通过，并回写为 `object_closeout_passed`。
- 旧总账对兽人的“代表性 / 实施中”结论已被本轮 2026-09-18 的 45/45 对象级真实入口、22/22 领域测试和 14 对象矩阵替代；兽人已同步移除 `ids.ts` 的 `in_progress` 标记。勇士本轮完成 11/11 真实入口、10/10 领域测试和对象级负向收口，也已同步移除 `ids.ts` 的 `in_progress` 标记。

## 残余范围声明

本文件只完成 Munchkin 五个候选派系的当前证据对账与状态分流。它不证明 Munchkin 整扩展、公共怪物 / 宝藏牌堆、移动端全扩展逐对象图面或服务器资源发布链已完成。

## 对外汇报口径

- 可以说：半身人、盗贼、法师、兽人和勇士已完成当前本地对象级审计并摘牌。
- 必须说：牧师“抓鬼”与呆瓜兽人跨派系联动已复测通过；共享静态合同、公共牌堆和整批移动端图面仍保留各自残余。
- 禁止说：19 个实施中派系已全部审计完成，或 Munchkin 整扩展已收口。

## 2026-10-23 续审：共享 targetType 合同扫描

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`。
- 结果：14 项中 12 通过、2 失败；扫描耗时约 137 秒。第一项失败要求 `smashup_reaction_choose` 的场上 special 来源本体确认包含 `FIELD_SOURCE_ACTION_PROMPT_TARGET_TYPE` 及 `targetType: FIELD_SOURCE_ACTION_PROMPT_TARGET_TYPE` 两个共享合同片段。第二项失败报告四个跨调用 sourceId 冲突：`base_uss_undertaking` 为 `generic/minion`，`goblins_chaos_lord` 为 `minion/generic`，`goblins_blaster` 为 `generic/button`，`goblins_demolition` 为 `generic/minion`。
- 责任边界：这些是全局静态合同扫描失败，不是五个 Munchkin 派系对象的运行时失败；当前错误清单没有 Munchkin sourceId。五派系对象级结论保持原范围，公共静态合同债务仍未关闭。

## 同类扩审与漏审归因

- 搜索范围：共享静态扫描器当前遍历全部 Smash Up abilities 与 domain base-ability 源；另以精确 sourceId 搜索复核 Munchkin 五派系能力注册和本文件记录的对象级真实入口结论。
- 命中项：本轮扫描失败仅为 `smashup_reaction_choose` 中缺少 field-source-action 合同片段，以及 `base_uss_undertaking`、`goblins_chaos_lord`、`goblins_blaster`、`goblins_demolition` 的跨调用 targetType 语义冲突。错误清单未包含 Munchkin sourceId；没有发现 Munchkin 对象级运行时失败。
- 漏审归因：旧 evidence 将“共享扫描仍红”概括为两条 Munchkin 共享合同残余，没有保留当前失败测试名、静态错误位置或受影响对象，导致范围看起来像 Munchkin 专属问题。本次已将它校正为全局静态审计基线，未把全局失败转嫁为 Munchkin 规则缺陷。
- 残余扩审范围：共享 response chooser 的来源本体确认合同和四个冲突 sourceId 仍需单独裁定；五个 Munchkin 派系对象级结论与公共怪物 / 宝藏牌堆范围继续分开管理。要声称共享扫描通过，需在完成共享合同处理后重跑完整 `interactionTargetTypeAudit.test.ts`。
