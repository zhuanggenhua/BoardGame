# 需求文档：大杀四方全面语义与实现完整性审查

## 简介

对大杀四方（Smash Up）游戏所有 16 个派系及全部基地中的多步骤/复杂能力进行系统性的「描述→实现全链路审查」。审查范围聚焦于涉及交互、选择、条件判断、持续效果、特殊触发时机的能力，单一效果能力（如"抽一张牌"、"获得1VP"）不在本次审查范围内。

审查依据 `.spec/knowledge/standards/testing-audit.md` 中的「描述→实现全链路审查规范」执行，以 `src/games/smashup/rule/大杀四方规则.md` 和 `public/locales/zh-CN/game-smashup.json` 中的 effectText/abilityText 为权威描述来源，逐条对比代码实现。

## 术语表

- **全链路审查**：按 `.spec/knowledge/standards/testing-audit.md`「描述→实现全链路审查规范」执行的八层审查流程
- **独立交互链**：任何需要独立触发条件、玩家输入或状态变更路径的效果，作为审查的原子单位
- **八层**：定义层、注册层、执行层、状态层、验证层、UI 层、i18n 层、测试层
- **审查矩阵**：独立交互链 × 八层的交叉表，每个交叉点标注 ✅/❌ 及具体证据
- **多步骤能力**：涉及玩家选择、条件分支、多阶段执行、持续效果、特殊触发时机的能力
- **Ability_Registry**：`src/games/smashup/domain/abilityRegistry.ts` 中的能力注册表
- **Ongoing_Effects**：`src/games/smashup/domain/ongoingEffects.ts` 中的持续效果注册表（保护、限制、触发、拦截）
- **Ongoing_Modifiers**：`src/games/smashup/domain/ongoingModifiers.ts` 中的持续力量/临界点修正注册表
- **Interaction_Handler**：处理玩家交互选择的回调函数，注册在各派系的 `registerXxxInteractionHandlers()` 中
- **Base_Ability**：基地能力，通过 `registerBaseAbility` 注册，在特定时机触发
- **effectText**：i18n 文件中行动卡的效果描述文本
- **abilityText**：i18n 文件中随从卡/基地卡的能力描述文本

## 需求

### 需求 1：外星人（Aliens）派系复杂能力审查

**用户故事：** 作为开发者，我想审查外星人派系所有多步骤能力的实现，以确保交互链完整且语义一致。

#### 验收标准

1. WHEN 审查 alien_supreme_overlord（最高指挥官）时，THE 审查者 SHALL 验证"你可以将一个随从返回到其拥有者的手上"的可选交互流程：目标选择 Prompt 生成、跳过选项、MINION_RETURNED 事件产生
2. WHEN 审查 alien_collector（收集者）时，THE 审查者 SHALL 验证"力量为3或以下"的过滤条件在目标选择和执行层均正确实现，且"本基地"限定条件全程约束
3. WHEN 审查 alien_crop_circles（麦田怪圈）时，THE 审查者 SHALL 验证"任意数量的随从从一个基地中返回"的多步选择流程：基地选择→随从多选→批量返回事件
4. WHEN 审查 alien_terraform（适居化）时，THE 审查者 SHALL 验证四步流程完整性：搜寻基地→交换基地（弃掉行动卡）→洗混基地牌库→额外打出随从
5. WHEN 审查 alien_abduction（绑架）时，THE 审查者 SHALL 验证两步流程：返回随从→额外打出随从，且两步均有对应交互
6. WHEN 审查 alien_probe（探究）时，THE 审查者 SHALL 验证两步流程：查看对手手牌→查看牌库顶并选择放回顶部或底部
7. WHEN 审查 alien_invasion（入侵）时，THE 审查者 SHALL 验证随从选择→目标基地选择的两步交互流程
8. WHEN 审查 alien_disintegrator（分解者）时，THE 审查者 SHALL 验证"力量为3或以下"过滤条件和"放到牌库底"（非弃牌堆）的正确实现
9. WHEN 审查 alien_scout（侦察兵）时，THE 审查者 SHALL 验证 special 触发时机"基地计分后"的钩子注册和"放回手牌而非弃牌堆"的拦截逻辑
10. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 2：恐龙（Dinosaurs）派系复杂能力审查

**用户故事：** 作为开发者，我想审查恐龙派系所有多步骤能力的实现，以确保持续效果和条件判断正确。

#### 验收标准

1. WHEN 审查 dino_armor_stego（装甲剑龙）时，THE 审查者 SHALL 验证"在其他玩家的回合中+2力量"的持续力量修正在 ongoingModifiers 中正确注册，且仅在非拥有者回合生效
2. WHEN 审查 dino_war_raptor（战斗迅猛龙）时，THE 审查者 SHALL 验证"每有一个战斗迅猛龙+1力量"的持续修正正确计算同基地同名随从数量
3. WHEN 审查 dino_laser_triceratops（激光三角龙）时，THE 审查者 SHALL 验证"本基地力量为2或以下"的过滤条件和目标选择交互
4. WHEN 审查 dino_natural_selection（物竞天择）时，THE 审查者 SHALL 验证两步流程：选择己方随从→消灭同基地力量更低的随从，且"力量小于"的比较逻辑正确
5. WHEN 审查 dino_survival_of_the_fittest（适者生存）时，THE 审查者 SHALL 验证"每个基地消灭最低力量随从"的全局扫描逻辑、"两个及以上随从且有更高力量"的前置条件、平局时玩家选择的交互
6. WHEN 审查 dino_rampage（狂暴）时，THE 审查者 SHALL 验证"降低临界点等同于己方力量"的临时修正计算和"回合结束清零"的清理逻辑
7. WHEN 审查 dino_tooth_and_claw（全副武装）时，THE 审查者 SHALL 验证"如果能力将影响该随从，消灭本卡使能力无效"的拦截器注册和一次性保护逻辑
8. WHEN 审查 dino_wildlife_preserve（野生保护区）时，THE 审查者 SHALL 验证"你在这里的随从不会受到其他玩家的战术影响"的保护注册
9. WHEN 审查 dino_upgrade（升级）时，THE 审查者 SHALL 验证附着到随从的持续+2力量修正
10. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 3：海盗（Pirates）派系复杂能力审查

**用户故事：** 作为开发者，我想审查海盗派系所有多步骤能力的实现，以确保移动、消灭和特殊时机正确。

#### 验收标准

1. WHEN 审查 pirate_full_sail（全速航行）时，THE 审查者 SHALL 验证"移动任意数量随从到其他基地"的多步循环交互流程，以及 special 时机"基地计分前可打出本卡"的实现
2. WHEN 审查 pirate_king（海盗王）时，THE 审查者 SHALL 验证 special 触发时机"基地计分前移动到那里"的钩子注册
3. WHEN 审查 pirate_buccaneer（海盗）时，THE 审查者 SHALL 验证 special 触发"将要被消灭时移动到其他基地代替"的拦截器逻辑
4. WHEN 审查 pirate_first_mate（大副）时，THE 审查者 SHALL 验证 special 触发"本基地计分后移动两个随从到其他基地而非弃牌堆"的实现
5. WHEN 审查 pirate_powderkeg（炸药桶）时，THE 审查者 SHALL 验证两步流程：消灭己方随从→消灭同基地中力量相等或更低的所有随从
6. WHEN 审查 pirate_broadside（侧翼开炮）时，THE 审查者 SHALL 验证"你拥有随从的基地里一个玩家的所有力量为2或以下的随从"的三重条件过滤
7. WHEN 审查 pirate_dinghy（小船）时，THE 审查者 SHALL 验证"移动至多两个己方随从到其他基地"的多步选择流程
8. WHEN 审查 pirate_cannon（加农炮）时，THE 审查者 SHALL 验证"消灭至多两个力量为2或以下的随从"的多目标选择
9. WHEN 审查 pirate_sea_dogs（水手）时，THE 审查者 SHALL 验证"指定派系→移动所有其他玩家该派系随从从一个基地到另一个"的多步流程
10. WHEN 审查 pirate_shanghai（诱拐）时，THE 审查者 SHALL 验证"移动其他玩家随从到另一个基地"的两步选择
11. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议


### 需求 4：忍者（Ninjas）派系复杂能力审查

**用户故事：** 作为开发者，我想审查忍者派系所有多步骤能力的实现，以确保特殊时机和条件消灭正确。

#### 验收标准

1. WHEN 审查 ninja_shinobi（影舞者）时，THE 审查者 SHALL 验证 special 触发"基地计分前打出到那里"的钩子注册，以及"每个基地只能使用一次忍者能力"的限制实现
2. WHEN 审查 ninja_acolyte（忍者侍从）时，THE 审查者 SHALL 验证 special 触发"回合中未打出随从时放回手中并额外打出随从到这个基地"的条件判断和基地限定
3. WHEN 审查 ninja_master（忍者大师）时，THE 审查者 SHALL 验证"你可以消灭本基地的一个随从"的可选交互和"本基地"限定
4. WHEN 审查 ninja_tiger_assassin（猛虎刺客）时，THE 审查者 SHALL 验证"本基地力量为3或以下"的过滤条件
5. WHEN 审查 ninja_hidden_ninja（便衣忍者）时，THE 审查者 SHALL 验证 special 触发"基地计分前打出一个随从到这"的实现
6. WHEN 审查 ninja_disguise（伪装）时，THE 审查者 SHALL 验证多步流程：选择基地→选择一或两个己方随从→打出等数量随从→将选择的随从拿回手上
7. WHEN 审查 ninja_poison（下毒）时，THE 审查者 SHALL 验证三步效果：打出到随从→消灭其上任意数量战术→持续-4力量（最低0）
8. WHEN 审查 ninja_infiltrate（渗透）时，THE 审查者 SHALL 验证两步效果：消灭基地上已有战术→持续无视基地能力直到下回合
9. WHEN 审查 ninja_smoke_bomb（烟幕弹）时，THE 审查者 SHALL 验证附着到随从的保护效果和"回合开始时消灭本卡"的清理触发
10. WHEN 审查 ninja_assassination（暗杀）时，THE 审查者 SHALL 验证附着到随从的"回合结束时消灭该随从"的触发逻辑
11. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 5：机器人（Robots）派系复杂能力审查

**用户故事：** 作为开发者，我想审查机器人派系所有多步骤能力的实现，以确保微型机联动和条件打出正确。

#### 验收标准

1. WHEN 审查 robot_microbot_alpha（微型机阿尔法号）时，THE 审查者 SHALL 验证两个持续效果：①"每有一个其他微型机在场+1力量"的修正计算 ②"所有随从均视为微型机"的标记逻辑及其对其他微型机能力的联动影响
2. WHEN 审查 robot_microbot_fixer（微型机修理者）时，THE 审查者 SHALL 验证两个效果：①"第一个随从时额外打出"的条件判断 ②"每个微型机+1力量"的持续修正
3. WHEN 审查 robot_microbot_reclaimer（微型机回收者）时，THE 审查者 SHALL 验证两个效果：①"第一个随从时额外打出"的条件判断 ②"从弃牌堆将微型机洗回牌库"的交互
4. WHEN 审查 robot_microbot_archive（微型机存储者）时，THE 审查者 SHALL 验证"微型机被消灭后抽牌"的触发器注册，包括本随从自身被消灭的情况
5. WHEN 审查 robot_microbot_guard（微型机守护者）时，THE 审查者 SHALL 验证"力量低于你在这里随从数量"的动态条件计算
6. WHEN 审查 robot_hoverbot（盘旋机器人）时，THE 审查者 SHALL 验证"展示牌库顶→如果是随从可额外打出→否则放回"的条件分支
7. WHEN 审查 robot_zapbot（高速机器人）时，THE 审查者 SHALL 验证"力量为2或更低的额外随从"的限定条件在执行时全程约束
8. WHEN 审查 robot_warbot（战斗机器人）时，THE 审查者 SHALL 验证"不能被消灭"的保护注册
9. WHEN 审查 robot_nukebot（核弹机器人）时，THE 审查者 SHALL 验证"被消灭后消灭本基地其他玩家所有随从"的触发时机和目标范围
10. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 6：巫师（Wizards）派系复杂能力审查

**用户故事：** 作为开发者，我想审查巫师派系所有多步骤能力的实现，以确保牌库操作和额外出牌正确。

#### 验收标准

1. WHEN 审查 wizard_portal（传送）时，THE 审查者 SHALL 验证完整流程：展示牌库顶5张→选择任意数量随从放入手牌→将其他牌以任意顺序返回牌库顶
2. WHEN 审查 wizard_scry（占卜）时，THE 审查者 SHALL 验证四步流程：搜寻牌库→选择战术→展示给所有玩家→放入手牌→重洗牌库
3. WHEN 审查 wizard_sacrifice（献祭）时，THE 审查者 SHALL 验证两步流程：选择己方随从→抽等同力量的牌→消灭该随从
4. WHEN 审查 wizard_neophyte（学徒）时，THE 审查者 SHALL 验证条件分支：展示牌库顶→如果是战术可放入手牌或额外打出→如果不是放回牌库顶
5. WHEN 审查 wizard_mass_enchantment（聚集秘术）时，THE 审查者 SHALL 验证多步流程：展示每个对手牌库顶→选择其中一张战术额外打出→将未使用的放回拥有者牌库顶
6. WHEN 审查 wizard_archmage（大法师）时，THE 审查者 SHALL 验证"每回合额外打出一个战术"的持续效果注册和额度授予
7. WHEN 审查 wizard_winds_of_change（变化之风）时，THE 审查者 SHALL 验证三步流程：手牌洗回牌库→抽5张→额外打出一个战术
8. WHEN 审查 wizard_time_loop（时间圆环）时，THE 审查者 SHALL 验证"打出两张额外战术"的额度授予
9. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 7：僵尸（Zombies）派系复杂能力审查

**用户故事：** 作为开发者，我想审查僵尸派系所有多步骤能力的实现，以确保弃牌堆操作和复活机制正确。

#### 验收标准

1. WHEN 审查 zombie_lord（僵尸领主）时，THE 审查者 SHALL 验证"从弃牌堆在每个没有你随从的基地额外打出力量为2或以下的随从"的多步流程：遍历无己方随从的基地→每个基地选择弃牌堆中合格随从→打出，且"没有你随从的基地"和"力量为2或以下"的限定全程约束
2. WHEN 审查 zombie_tenacious_z（顽强丧尸）时，THE 审查者 SHALL 验证 special 触发"从弃牌堆作为额外随从打出"的条件和"每回合只能使用一个顽强丧尸"的限制
3. WHEN 审查 zombie_grave_digger（掘墓者）时，THE 审查者 SHALL 验证"从弃牌堆选择随从放入手牌"的可选交互
4. WHEN 审查 zombie_walker（行尸）时，THE 审查者 SHALL 验证"查看牌库顶→弃掉或放回"的二选一交互
5. WHEN 审查 zombie_outbreak（爆发）时，THE 审查者 SHALL 验证"在没有你随从的基地额外打出随从"的限定条件在执行时全程约束（非仅入口检查）
6. WHEN 审查 zombie_not_enough_bullets（子弹不够）时，THE 审查者 SHALL 验证"任意数量同名随从从弃牌堆置入手牌"的同名判断和多选交互
7. WHEN 审查 zombie_mall_crawl（进发商场）时，THE 审查者 SHALL 验证"搜寻牌库中任意数量同名卡→置入弃牌堆→重洗牌库"的流程
8. WHEN 审查 zombie_they_keep_coming（它们不断来临）时，THE 审查者 SHALL 验证"从弃牌堆额外打出随从"的交互
9. WHEN 审查 zombie_overrun（泛滥横行）时，THE 审查者 SHALL 验证持续效果"其他玩家不能打出随从到此基地"的限制注册和"回合开始消灭本战术"的清理
10. WHEN 审查 zombie_theyre_coming_to_get_you（它们为你而来）时，THE 审查者 SHALL 验证持续效果"从弃牌堆而非手牌打出随从到此基地"的替代打出逻辑
11. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 8：捣蛋鬼（Tricksters）派系复杂能力审查

**用户故事：** 作为开发者，我想审查捣蛋鬼派系所有多步骤能力的实现，以确保持续触发和干扰效果正确。

#### 验收标准

1. WHEN 审查 trickster_leprechaun（矮妖）时，THE 审查者 SHALL 验证持续触发"其他玩家打出力量低于本随从的随从到这时消灭它（先结算能力）"的触发器注册和时序
2. WHEN 审查 trickster_brownie（棕仙）时，THE 审查者 SHALL 验证持续触发"其他玩家卡牌效果影响本随从时，该玩家随机弃两张手牌"的触发条件判断
3. WHEN 审查 trickster_gremlin（小鬼）时，THE 审查者 SHALL 验证"被消灭后抽一张卡且每个其他玩家随机弃一张卡"的触发时机
4. WHEN 审查 trickster_gnome（侏儒）时，THE 审查者 SHALL 验证"力量少于你在这个基地随从数量"的动态条件和可选交互
5. WHEN 审查 trickster_flame_trap（火焰陷阱）时，THE 审查者 SHALL 验证持续触发"其他玩家打出随从到此基地时消灭它（先结算能力）和本卡"的双消灭逻辑
6. WHEN 审查 trickster_block_the_path（通路禁止）时，THE 审查者 SHALL 验证"选择派系→该派系随从不能打出到此基地"的限制注册和派系选择交互
7. WHEN 审查 trickster_hideout（藏身处）时，THE 审查者 SHALL 验证"其他玩家战术影响你在此基地随从时消灭本卡使战术无效"的拦截逻辑
8. WHEN 审查 trickster_pay_the_piper（留下买路钱）时，THE 审查者 SHALL 验证持续触发"其他玩家打出随从到此基地后弃一张手牌"的触发器
9. WHEN 审查 trickster_enshrouding_mist（隐蔽迷雾）时，THE 审查者 SHALL 验证"在你的回合额外打出随从到此基地"的持续额度授予和基地限定
10. WHEN 审查 trickster_mark_of_sleep（睡眠印记）时，THE 审查者 SHALL 验证"选择玩家→该玩家下回合不能打出战术"的限制实现和回合清理
11. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议


### 需求 9：幽灵（Ghosts）派系复杂能力审查

**用户故事：** 作为开发者，我想审查幽灵派系所有多步骤能力的实现，以确保手牌条件判断和弃牌堆打出正确。

#### 验收标准

1. WHEN 审查 ghost_spectre（幽灵之主）时，THE 审查者 SHALL 验证 special 触发"手牌2张或更少时从弃牌堆打出代替正常打出"的条件判断和替代打出逻辑
2. WHEN 审查 ghost_haunting（不散阴魂）时，THE 审查者 SHALL 验证持续效果"手牌2张或更少时+3力量且不受其他玩家卡牌影响"的双重条件修正和保护
3. WHEN 审查 ghost_spirit（幽灵侍者）时，THE 审查者 SHALL 验证"选择随从→弃置等同力量数量的卡来消灭它"的可选多步交互
4. WHEN 审查 ghost_the_dead_rise（亡者崛起）时，THE 审查者 SHALL 验证"弃掉任意数量卡→从弃牌堆打出力量少于弃牌数的额外随从"的两步流程和力量限制
5. WHEN 审查 ghost_across_the_divide（越过边界）时，THE 审查者 SHALL 验证"选择卡名→将弃牌堆中所有同名随从放入手牌"的搜索和批量操作
6. WHEN 审查 ghost_make_contact（交朋友）时，THE 审查者 SHALL 验证"唯一手牌时才能打出"的前置条件和"该随从视作你的随从"的控制权转移持续效果
7. WHEN 审查 ghost_door_to_the_beyond（彼岸之门）时，THE 审查者 SHALL 验证"手牌2张或更少时此基地每个己方随从+2力量"的条件持续修正
8. WHEN 审查 ghost_seance（招魂）时，THE 审查者 SHALL 验证"手牌2张或更少时抽牌直到5张"的条件判断和抽牌数量计算
9. WHEN 审查 ghost_ghostly_arrival（悄然而至）时，THE 审查者 SHALL 验证"额外打出一个随从和/或一个行动"的双额度授予
10. WHEN 审查 ghost_incorporeal（幽灵化）时，THE 审查者 SHALL 验证附着到随从的"不受其他玩家卡牌影响"保护注册
11. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 10：熊骑兵（Bear Cavalry）派系复杂能力审查

**用户故事：** 作为开发者，我想审查熊骑兵派系所有多步骤能力的实现，以确保强制移动和保护效果正确。

#### 验收标准

1. WHEN 审查 bear_cavalry_general_ivan（伊万将军）时，THE 审查者 SHALL 验证"你的随从不能被消灭"的全局保护注册和作用范围（所有基地上的己方随从）
2. WHEN 审查 bear_cavalry_polar_commando（极地突击队员）时，THE 审查者 SHALL 验证"唯一己方随从时+2力量且不能被消灭"的双重条件持续效果
3. WHEN 审查 bear_cavalry_bear_cavalry（黑熊骑兵）时，THE 审查者 SHALL 验证"将其他玩家在本基地的随从移动到另一个基地"的两步交互
4. WHEN 审查 bear_cavalry_cub_scout（幼熊斥候）时，THE 审查者 SHALL 验证持续触发"其他玩家随从移动到本基地后，力量低于本随从则消灭"的触发条件和力量比较
5. WHEN 审查 bear_cavalry_bear_hug（黑熊擒抱）时，THE 审查者 SHALL 验证"每位其他玩家消灭自己最低力量随从（平局由拥有者选择）"的全局扫描和平局交互
6. WHEN 审查 bear_cavalry_youre_screwed（你们已经完蛋）时，THE 审查者 SHALL 验证"选择有己方随从的基地→移动另一位玩家在这里的随从到其他基地"的三步交互
7. WHEN 审查 bear_cavalry_youre_pretty_much_borscht（你们都是美食）时，THE 审查者 SHALL 验证"选择有己方随从的基地→将其他玩家在该基地所有随从移动到其他基地"的批量移动
8. WHEN 审查 bear_cavalry_commission（委任）时，THE 审查者 SHALL 验证两步流程：额外打出随从→将该随从所在基地另一位玩家的随从移动到其他基地
9. WHEN 审查 bear_cavalry_superiority（全面优势）时，THE 审查者 SHALL 验证"你在这里的随从不能被其他玩家消灭、移动或返回"的多重保护注册
10. WHEN 审查 bear_cavalry_high_ground（制高点）时，THE 审查者 SHALL 验证"有己方随从时消灭其他玩家移动到这里的随从"的触发条件
11. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 11：蒸汽朋克（Steampunks）派系复杂能力审查

**用户故事：** 作为开发者，我想审查蒸汽朋克派系所有多步骤能力的实现，以确保战术回收和附着联动正确。

#### 验收标准

1. WHEN 审查 steampunk_mechanic（机械师）时，THE 审查者 SHALL 验证"从弃牌堆选择可打到基地上的战术→作为额外战术打出"的两步交互和"可打到基地上"的过滤条件
2. WHEN 审查 steampunk_steam_man（蒸汽人）时，THE 审查者 SHALL 验证"本基地有至少一个己方战术附属时+1力量"的持续修正条件判断
3. WHEN 审查 steampunk_captain_ahab（亚哈船长）时，THE 审查者 SHALL 验证天赋"移动到附属有己方战术的基地"的目标过滤
4. WHEN 审查 steampunk_steam_queen（蒸汽女皇）时，THE 审查者 SHALL 验证"你的战术不会被其他玩家卡牌影响"的保护注册
5. WHEN 审查 steampunk_ornate_dome（华丽穹顶）时，THE 审查者 SHALL 验证两步效果：摧毁其他玩家在此的战术→持续限制其他玩家不能打出战术到此基地
6. WHEN 审查 steampunk_aggromotive（蒸汽机车）时，THE 审查者 SHALL 验证"有随从在此基地时+5力量"的持续修正条件
7. WHEN 审查 steampunk_zeppelin（齐柏林飞艇）时，THE 审查者 SHALL 验证天赋"从另一个基地移动随从到这里，或从这里到另一个基地"的双向移动选择
8. WHEN 审查 steampunk_change_of_venue（集结号角）时，THE 审查者 SHALL 验证"将己方已打出的战术拿回手牌→作为额外战术打出"的两步流程
9. WHEN 审查 steampunk_escape_hatch（逃生通道）时，THE 审查者 SHALL 验证"随从被消灭时放到手牌而非弃牌堆"的拦截器注册
10. WHEN 审查 steampunk_difference_engine（差分机）时，THE 审查者 SHALL 验证"有随从在此基地时回合结束多抽一张牌"的条件触发
11. WHEN 审查 steampunk_rotary_slug_thrower（转轮式喷射机枪）时，THE 审查者 SHALL 验证"你在这里的每个随从+2力量"的持续修正
12. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 12：食人花（Killer Plants）派系复杂能力审查

**用户故事：** 作为开发者，我想审查食人花派系所有多步骤能力的实现，以确保搜牌、繁殖和持续效果正确。

#### 验收标准

1. WHEN 审查 killer_plant_venus_man_trap（维纳斯捕食者）时，THE 审查者 SHALL 验证天赋"搜寻牌库力量为2或以下的随从→额外打出到此基地→重洗牌库"的三步流程
2. WHEN 审查 killer_plant_sprout（幼苗）时，THE 审查者 SHALL 验证"回合开始消灭本卡→搜寻力量为3或以下随从→额外打出到此基地→重洗牌库"的四步流程
3. WHEN 审查 killer_plant_water_lily（浇花睡莲）时，THE 审查者 SHALL 验证"回合开始抽一张卡"的持续触发和"每回合只能使用一次"的限制
4. WHEN 审查 killer_plant_weed_eater（野生食人花）时，THE 审查者 SHALL 验证"打出回合中-2力量"的临时力量修正和回合结束清理
5. WHEN 审查 killer_plant_budding（出芽生殖）时，THE 审查者 SHALL 验证"选择场中随从→搜寻牌库同名卡→加入手牌→重洗牌库"的流程
6. WHEN 审查 killer_plant_blossom（繁荣生长）时，THE 审查者 SHALL 验证"打出至多三个同名额外随从"的同名判断和数量限制
7. WHEN 审查 killer_plant_sleep_spores（睡眠孢子）时，THE 审查者 SHALL 验证"其他玩家在此基地随从-1力量（最低0）"的持续修正
8. WHEN 审查 killer_plant_overgrowth（过度生长）时，THE 审查者 SHALL 验证"回合开始时将临界点降低到0"的持续效果
9. WHEN 审查 killer_plant_choking_vines（食人藤蔓）时，THE 审查者 SHALL 验证"回合开始时消灭该随从"的附着触发
10. WHEN 审查 killer_plant_entangled（藤蔓缠绕）时，THE 审查者 SHALL 验证"有己方随从的基地里随从不能被移动或返回手牌"的全局限制和"回合开始消灭本卡"的清理
11. WHEN 审查 killer_plant_deep_roots（深根）时，THE 审查者 SHALL 验证"你在此基地的随从不能因其他玩家能力移动或返回手牌"的保护注册
12. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议


### 需求 13：克苏鲁仆从（Cthulhu）派系复杂能力审查

**用户故事：** 作为开发者，我想审查克苏鲁仆从派系所有多步骤能力的实现，以确保疯狂卡操作和献祭机制正确。

#### 验收标准

1. WHEN 审查 cthulhu_star_spawn（星之眷族）时，THE 审查者 SHALL 验证天赋"将手中疯狂卡转移给另一个玩家"的目标选择交互
2. WHEN 审查 cthulhu_chosen（神选者）时，THE 审查者 SHALL 验证 special 触发"基地计分前抽疯狂卡并+2力量直到回合结束"的时机和临时修正
3. WHEN 审查 cthulhu_servitor（仆人）时，THE 审查者 SHALL 验证天赋"消灭本卡→从弃牌堆选择战术放到牌库顶"的两步流程
4. WHEN 审查 cthulhu_altar（克苏鲁祭坛）时，THE 审查者 SHALL 验证持续效果"打出随从到这时额外打出一个战术"的触发和额度授予
5. WHEN 审查 cthulhu_recruit_by_force（强制招募）时，THE 审查者 SHALL 验证"任意数量力量为3或以下的随从从弃牌堆放到牌库顶"的多选交互和力量过滤
6. WHEN 审查 cthulhu_complete_the_ritual（完成仪式）时，THE 审查者 SHALL 验证"回合开始时将基地上所有随从和战术放回拥有者牌库底→交换基地"的复杂流程
7. WHEN 审查 cthulhu_furthering_the_cause（深化目标）时，THE 审查者 SHALL 验证"回合结束时检查本回合是否有对手随从在此基地被消灭→获得1VP"的条件判断
8. WHEN 审查 cthulhu_corruption（腐化）时，THE 审查者 SHALL 验证"抽疯狂卡→消灭一个随从"的两步流程
9. WHEN 审查 cthulhu_fhtagn（克苏鲁的馈赠）时，THE 审查者 SHALL 验证"从牌库顶展示直到2张战术→放入手牌→其余放牌库底"的搜索流程
10. WHEN 审查 cthulhu_madness_unleashed（疯狂解放）时，THE 审查者 SHALL 验证"弃掉任意数量疯狂卡→每弃一张抽一张卡并额外打出一个战术"的多步联动
11. WHEN 审查 cthulhu_it_begins_again（再次降临）时，THE 审查者 SHALL 验证"将弃牌堆任意数量战术洗回牌库"的多选交互
12. WHEN 审查 cthulhu_whispers_in_darkness（在黑暗中低语）时，THE 审查者 SHALL 验证"抽疯狂卡→额外打出两个战术"的流程
13. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 14：远古物种（Elder Things）派系复杂能力审查

**用户故事：** 作为开发者，我想审查远古物种派系所有多步骤能力的实现，以确保疯狂卡散播和二选一效果正确。

#### 验收标准

1. WHEN 审查 elder_thing_elder_thing（远古之物）时，THE 审查者 SHALL 验证"消灭两个己方其他随从或将本随从放到牌库底"的二选一交互，以及"不受对手卡牌影响"的保护效果
2. WHEN 审查 elder_thing_shoggoth（修格斯）时，THE 审查者 SHALL 验证三重效果：①"只能打到至少6点力量的基地"的前置验证 ②"每位其他玩家可以抽疯狂卡"的选择 ③"不抽的玩家消灭一个在此基地的随从"的惩罚
3. WHEN 审查 elder_thing_mi_go（米-格）时，THE 审查者 SHALL 验证"每个其他玩家可以抽疯狂卡→不抽的让你抽一张卡"的二选一交互
4. WHEN 审查 elder_thing_byakhee（拜亚基）时，THE 审查者 SHALL 验证"如果其他玩家有随从在这个基地则抽疯狂卡"的条件判断（给谁抽？描述指"抽一张疯狂卡"主语是拜亚基的拥有者还是其他玩家）
5. WHEN 审查 elder_thing_the_price_of_power（力量的代价）时，THE 审查者 SHALL 验证 special 触发"基地计分前→其他玩家展示手牌→每张疯狂卡使己方随从+2力量"的计算
6. WHEN 审查 elder_thing_unfathomable_goals（深不可测的目的）时，THE 审查者 SHALL 验证"其他玩家展示手牌→有疯狂卡的玩家消灭一个己方随从"的条件执行
7. WHEN 审查 elder_thing_spreading_horror（散播恐怖）时，THE 审查者 SHALL 验证"每位其他玩家随机弃牌直到弃出非疯狂卡"的循环弃牌逻辑
8. WHEN 审查 elder_thing_dunwich_horror（敦威治恐怖）时，THE 审查者 SHALL 验证"附着到随从+5力量→回合结束消灭该随从"的两步效果
9. WHEN 审查 elder_thing_begin_the_summoning（开始召唤）时，THE 审查者 SHALL 验证"弃牌堆随从放到牌库顶→额外打出战术"的两步流程
10. WHEN 审查 elder_thing_power_of_madness（疯狂之力）时，THE 审查者 SHALL 验证"其他玩家展示手牌→弃掉所有疯狂卡→将弃牌堆洗回牌库"的三步流程
11. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 15：印斯茅斯（Innsmouth）派系复杂能力审查

**用户故事：** 作为开发者，我想审查印斯茅斯派系所有多步骤能力的实现，以确保同名随从联动和疯狂卡交互正确。

#### 验收标准

1. WHEN 审查 innsmouth_the_locals（本地人）时，THE 审查者 SHALL 验证"展示牌库顶3张→将其中本地人放入手牌→其余放牌库底"的搜索流程和同名判断
2. WHEN 审查 innsmouth_sacred_circle（宗教圆环）时，THE 审查者 SHALL 验证天赋"额外打出与这里随从同名的随从到这里"的同名过滤和基地限定
3. WHEN 审查 innsmouth_return_to_the_sea（重返深海）时，THE 审查者 SHALL 验证 special 触发"基地计分后将同名随从返回手中而非弃牌堆"的拦截逻辑
4. WHEN 审查 innsmouth_mysteries_of_the_deep（深潜者的秘密）时，THE 审查者 SHALL 验证"基地有3个或更多同名随从时抽3张→可选额外抽2张和2张疯狂卡"的条件和可选分支
5. WHEN 审查 innsmouth_spreading_the_word（散播谣言）时，THE 审查者 SHALL 验证"额外打出至多两个与场中随从同名的随从"的同名判断和数量限制
6. WHEN 审查 innsmouth_recruitment（招募）时，THE 审查者 SHALL 验证"抽取至多三张疯狂卡→每抽一张额外打出一个随从"的联动额度
7. WHEN 审查 innsmouth_in_plain_sight（一目了然）时，THE 审查者 SHALL 验证"力量为2或以下的己方随从不受对手卡牌影响"的条件保护
8. WHEN 审查 innsmouth_new_acolytes（新人）时，THE 审查者 SHALL 验证"所有玩家将弃牌堆随从洗回牌库"的全局操作
9. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 16：米斯卡塔尼克（Miskatonic University）派系复杂能力审查

**用户故事：** 作为开发者，我想审查米斯卡塔尼克派系所有多步骤能力的实现，以确保疯狂卡利用和搜牌正确。

#### 验收标准

1. WHEN 审查 miskatonic_professor（教授）时，THE 审查者 SHALL 验证天赋"弃掉疯狂卡→额外打出战术和/或随从"的条件触发和双额度授予
2. WHEN 审查 miskatonic_librarian（图书管理员）时，THE 审查者 SHALL 验证天赋"弃掉疯狂卡→抽一张牌"的条件触发
3. WHEN 审查 miskatonic_psychologist（心理学家）时，THE 审查者 SHALL 验证"从手牌或弃牌堆返回疯狂卡到疯狂牌库"的可选交互和双来源选择
4. WHEN 审查 miskatonic_book_of_iter（金克丝!）时，THE 审查者 SHALL 验证"从手牌和弃牌堆返回至多两张疯狂卡到疯狂卡牌堆"的可选交互和多来源选择
5. WHEN 审查 miskatonic_mandatory_reading（最好不知道的事）时，THE 审查者 SHALL 验证"special：基地计分前选择一个随从→抽最多3张疯狂卡→每抽1张该随从+2力量"的流程
6. WHEN 审查 miskatonic_lost_knowledge（通往超凡的门）时，THE 审查者 SHALL 验证"ongoing talent：抽一张疯狂卡→额外打出一个随从到此基地"的流程
7. WHEN 审查 miskatonic_thing_on_the_doorstep（老詹金斯!?）时，THE 审查者 SHALL 验证"special：基地计分前→消灭该基地最高力量随从"的流程
8. WHEN 审查 miskatonic_it_might_just_work（它可能有用）时，THE 审查者 SHALL 验证"弃掉一张疯狂卡→己方全体随从+1力量直到回合结束"的前置条件和效果
9. WHEN 审查 miskatonic_field_trip（实地考察）时，THE 审查者 SHALL 验证"从手牌放任意数量卡到牌库底→每放一张抽一张"的多步交互
10. WHEN 审查 miskatonic_those_meddling_kids（这些多管闲事的小鬼）时，THE 审查者 SHALL 验证"消灭基地上任意数量战术"的多选交互
11. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 17：基地卡复杂能力审查

**用户故事：** 作为开发者，我想审查所有具有复杂能力的基地卡实现，以确保触发时机、交互流程和限制效果正确。

#### 验收标准

1. WHEN 审查 base_the_homeworld（家园）时，THE 审查者 SHALL 验证"随从打出后额外打出力量为2或以下的随从"的触发和力量限定全程约束
2. WHEN 审查 base_mushroom_kingdom（蘑菇王国）时，THE 审查者 SHALL 验证"回合开始时移动其他玩家随从到这"的交互流程
3. WHEN 审查 base_pirate_cove（海盗湾）时，THE 审查者 SHALL 验证"计分后非冠军可移动随从到其他基地而非弃牌堆"的交互
4. WHEN 审查 base_tortuga（托尔图加）时，THE 审查者 SHALL 验证"计分后亚军可移动随从到替换基地"的交互
5. WHEN 审查 base_wizard_academy（巫师学院）时，THE 审查者 SHALL 验证"计分后冠军查看基地牌库顶3张→选择替换→排列其余"的多步交互
6. WHEN 审查 base_ninja_dojo（忍者道场）时，THE 审查者 SHALL 验证"计分后冠军可消灭任意一个随从"的交互
7. WHEN 审查 base_temple_of_goju（刚柔流寺庙）时，THE 审查者 SHALL 验证"计分后每位玩家最高力量随从放入牌库底"的全局扫描
8. WHEN 审查 base_cave_of_shinies（闪光洞穴）时，THE 审查者 SHALL 验证"随从被消灭后拥有者获得1VP"的触发器
9. WHEN 审查 base_tar_pits（焦油坑）时，THE 审查者 SHALL 验证"随从被消灭后放到牌库底而非弃牌堆"的拦截器
10. WHEN 审查 base_the_mothership（母舰）时，THE 审查者 SHALL 验证"计分后冠军可返回力量为3或以下的随从到手牌"的交互和力量过滤
11. WHEN 审查 base_central_brain（中央大脑）时，THE 审查者 SHALL 验证"每个随从+1力量"的持续修正
12. WHEN 审查 base_haunted_house_al9000（鬼屋）时，THE 审查者 SHALL 验证"打出随从后必须弃一张卡"的强制触发
13. WHEN 审查 base_the_field_of_honor（荣誉之地）时，THE 审查者 SHALL 验证"随从被消灭时消灭者获得1VP"的触发和"消灭者"判定
14. WHEN 审查 base_tsars_palace（沙皇宫殿）时，THE 审查者 SHALL 验证"力量为2或以下随从不能打出到这里"的验证层限制
15. WHEN 审查 base_dread_lookout（恐怖眺望台）时，THE 审查者 SHALL 验证"不能打出战术到这里"的验证层限制
16. WHEN 审查 base_the_factory（436-1337工厂）时，THE 审查者 SHALL 验证"计分时冠军每5力量获得1VP"的额外VP计算
17. WHEN 审查 base_rhodes_plaza（罗德百货商场）时，THE 审查者 SHALL 验证"计分时每位玩家每有一个随从获得1VP"的额外VP计算
18. WHEN 审查 base_the_workshop（工坊）时，THE 审查者 SHALL 验证"打出战术到此基地时额外打出一张战术"的触发和额度授予
19. WHEN 审查 base_north_pole（北极基地）时，THE 审查者 SHALL 验证"每回合只能打出一个随从到这里"的限制
20. WHEN 审查 base_ritual_site（仪式场所）时，THE 审查者 SHALL 验证"计分后随从洗回牌库而非弃牌堆"的拦截
21. WHEN 审查 base_rlyeh（拉莱耶）时，THE 审查者 SHALL 验证"回合开始时可消灭己方随从获得1VP"的可选交互
22. WHEN 审查 base_mountains_of_madness（疯狂山脉）时，THE 审查者 SHALL 验证"随从打出后拥有者抽疯狂卡"的触发
23. WHEN 审查 base_the_pasture（牧场）时，THE 审查者 SHALL 验证"首次移动随从到这后移动另一基地随从到这"的触发和"首次"限制
24. WHEN 审查 base_sheep_shrine（绵羊神社）时，THE 审查者 SHALL 验证"入场后每位玩家可移动随从到这"的一次性触发
25. WHEN 审查 base_locker_room（更衣室）时，THE 审查者 SHALL 验证"回合开始时有随从在这则抽牌"的条件触发
26. WHEN 审查 base_stadium（体育场）时，THE 审查者 SHALL 验证"随从被消灭后控制者抽牌"的触发
27. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议


### 需求 18：克苏鲁扩展基地复杂能力审查

**用户故事：** 作为开发者，我想审查克苏鲁扩展基地的复杂能力实现，以确保疯狂卡相关基地效果正确。

#### 验收标准

1. WHEN 审查 base_the_asylum（庇护所）时，THE 审查者 SHALL 验证"随从打出后可返回手中疯狂卡到疯狂牌库"的可选交互
2. WHEN 审查 base_innsmouth_base（印斯茅斯）时，THE 审查者 SHALL 验证"随从打出后可将任意玩家弃牌堆卡置入牌库底"的交互
3. WHEN 审查 base_miskatonic_university_base（米斯卡塔尼克大学）时，THE 审查者 SHALL 验证"计分后冠军可搜寻手牌和弃牌堆疯狂卡返回疯狂牌库"的多选交互
4. WHEN 审查 base_plateau_of_leng（伦格高原）时，THE 审查者 SHALL 验证"首次打出随从后可额外打出同名随从到这里"的同名判断和"首次"限制
5. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 19：Pretty Pretty / AL9000 扩展基地复杂能力审查

**用户故事：** 作为开发者，我想审查 Pretty Pretty 和 AL9000 扩展基地的复杂能力实现。

#### 验收标准

1. WHEN 审查 base_cat_fanciers_alley（诡猫巷）时，THE 审查者 SHALL 验证"每回合一次消灭己方随从以抽牌"的可选交互和"每回合一次"限制
2. WHEN 审查 base_house_of_nine_lives（九命之家）时，THE 审查者 SHALL 验证"随从在其他基地被消灭时可移动到这里代替"的拦截器和可选交互
3. WHEN 审查 base_enchanted_glade（迷人峡谷）时，THE 审查者 SHALL 验证"打出战术到随从上后抽牌"的触发条件（必须是附着到随从的战术）
4. WHEN 审查 base_fairy_ring（仙灵圈）时，THE 审查者 SHALL 验证"首次打出随从后额外打出随从到这或额外打出战术"的"首次"限制和二选一
5. WHEN 审查 base_beautiful_castle（美丽城堡）时，THE 审查者 SHALL 验证"力量为5或以上随从不受对手牌影响"的保护注册
6. WHEN 审查 base_castle_of_ice（冰之城堡）时，THE 审查者 SHALL 验证"随从不能被打出到这"的验证层限制
7. WHEN 审查 base_land_of_balance（平衡之地）时，THE 审查者 SHALL 验证"打出随从后可从另一基地移动己方随从到这"的可选交互
8. WHEN 审查 base_pony_paradise（小马乐园）时，THE 审查者 SHALL 验证"有两个或以上随从时随从不能被消灭"的条件保护
9. WHEN 审查 base_greenhouse（温室）时，THE 审查者 SHALL 验证"计分后冠军搜寻牌库随从打出到替换基地"的交互
10. WHEN 审查 base_secret_garden（神秘花园）时，THE 审查者 SHALL 验证"额外打出力量为2或以下随从到这里"的持续额度和力量限定
11. WHEN 审查 base_inventors_salon（发明家沙龙）时，THE 审查者 SHALL 验证"计分后冠军从弃牌堆选取战术到手牌"的交互
12. WHEN 审查 base_evans_city_cemetery（伊万斯堡城镇公墓）时，THE 审查者 SHALL 验证"计分后冠军弃掉手牌并抽5张"的流程
13. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 20：跨能力交叉影响审查

**用户故事：** 作为开发者，我想审查不同派系能力之间的交叉影响，以确保组合使用时不会产生语义冲突。

#### 验收标准

1. WHEN 审查保护效果叠加时，THE 审查者 SHALL 验证多个"不能被消灭"/"不受影响"保护同时存在时的优先级和互斥逻辑
2. WHEN 审查限制效果叠加时，THE 审查者 SHALL 验证多个"不能打出到这里"/"不能移动"限制同时存在时的合并逻辑
3. WHEN 审查触发链时，THE 审查者 SHALL 验证一个事件触发多个持续效果时的执行顺序和状态一致性
4. WHEN 审查"视为微型机"与其他派系交互时，THE 审查者 SHALL 验证 robot_microbot_alpha 的"所有随从视为微型机"对其他派系随从的影响范围
5. WHEN 审查疯狂卡机制与非克苏鲁派系交互时，THE 审查者 SHALL 验证非克苏鲁派系的弃牌/搜牌能力对疯狂卡的处理是否正确
6. IF 发现交叉影响导致的语义冲突，THEN THE 审查者 SHALL 记录冲突场景和建议的解决方案

### 需求 21：审查结果汇总

**用户故事：** 作为开发者，我想获得所有审查结果的汇总报告，以便快速了解整体实现质量和需要修复的问题。

#### 验收标准

1. WHEN 所有派系和基地审查完成后，THE 审查者 SHALL 生成一份汇总报告，列出所有发现的问题
2. THE 汇总报告 SHALL 按严重程度分类：缺失实现（❌ 无代码）、语义偏差（⚠️ 有代码但行为不一致）、测试缺失（📝 功能正确但无测试覆盖）
3. THE 汇总报告 SHALL 包含每个派系的审查通过率（✅ 数量 / 总交互链数量）
4. THE 汇总报告 SHALL 按修复优先级排序：影响游戏正确性的问题优先于测试缺失
5. THE 汇总报告 SHALL 特别标注审计反模式清单中的违规项（如限定条件仅入口检查、可选效果自动执行等）
