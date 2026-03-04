# 需求文档：大杀四方全面审计（D1-D47 维度）

## 简介

对大杀四方（Smash Up, gameId: `smashup`）进行基于 `docs/ai-rules/testing-audit.md` D1-D47 全维度框架的系统性审计。本审计为第二阶段，补全第一阶段完全缺失的运行时行为维度。

**第一阶段（已完成）**：
- D1 描述→实现文本一致性审计
- D3 注册覆盖静态属性测试（Property 1-3, 6, 9）
- 覆盖基础版 8 派系
- 发现 3 个 i18n 文本错误（已修复）和 2 个逻辑 bug（待修复）

**第二阶段（本 spec）**：
- 使用 D1-D47 全维度框架进行系统性审计
- 覆盖所有 16 个派系 + 全部基地卡
- 重点关注运行时行为维度（时序、状态一致性、组合场景）
- 使用 GameTestRunner 进行行为测试验证

**审计范围**：
- 基础版 8 派系：Aliens, Dinosaurs, Pirates, Ninjas, Robots, Wizards, Zombies, Tricksters
- 克苏鲁扩展 4 派系：Cthulhu, Elder Things, Innsmouth, Miskatonic University
- 其他派系：Bear Cavalry, Steampunks, Killer Plants, Ghosts
- 全部基地卡（基础版、克苏鲁扩展、Pretty Pretty/AL9000 扩展）

**审计数据源**：
- 主要对照源：SmashUp Wiki + 卡牌图片（图片优先）
- 代码侧数据源：i18n JSON 描述 + 能力注册表 + reducer + validate + UI 组件
- 冲突处理原则：差异累积记录，统一向用户确认后再决定以哪方为准

## 术语表

- **GameTestRunner**: 引擎层行为测试工具，通过命令序列+状态断言验证运行时行为
- **D1-D47**: `docs/ai-rules/testing-audit.md` 中定义的 47 个审计维度
- **afterScoring**: 基地计分后触发的 ongoing trigger 时机
- **ctx.playerId**: trigger 回调中的当前回合玩家 ID（非卡牌 owner）
- **post-reduce**: reducer 执行后的状态（计数器已递增）
- **grantExtraMinion**: 授予额外随从出牌额度的引擎 API
- **createSimpleChoice**: 创建玩家交互选择的引擎 API
- **baseLimitedMinionQuota**: 基地限定的额外随从额度字段
- **filterProtectedEvents**: 过滤受保护实体事件的函数
- **optionsGenerator**: 交互选项动态刷新函数
- **displayMode**: 交互选项 UI 渲染模式（button/card/minion）
- **flowHalted**: 流程控制标志，阻止阶段自动推进

## 需求


### 需求 1：外星人（Aliens）派系 D1-D47 全维度审计

**用户故事：** 作为开发者，我想对外星人派系所有复杂能力进行 D1-D47 全维度审计，确保实现正确性。

#### 验收标准

1. **D1 子项：实体筛选范围语义审计**
   - WHEN 审计 alien_crop_circles（麦田怪圈）时，THE 审计系统 SHALL 验证"任意数量的随从从一个基地中返回"的实现是否正确遍历单个基地的随从，而非全局遍历
   - WHEN 审计 alien_collector（收集者）时，THE 审计系统 SHALL 验证"本基地"限定条件在目标选择和执行层均正确约束范围

2. **D2 子项：打出约束与额度授予约束审计**
   - WHEN 审计 alien_terraform（适居化）时，THE 审计系统 SHALL 验证"额外打出随从"的额度授予是否正确传递约束条件（无基地限定、无力量限制）

3. **D5：交互语义完整性审计**
   - WHEN 审计 alien_supreme_overlord（最高指挥官）时，THE 审计系统 SHALL 验证"你可以将一个随从返回"的可选交互是否使用 `multi: { min: 0, max: 1 }` 配置
   - WHEN 审计 alien_crop_circles 时，THE 审计系统 SHALL 验证"任意数量"是否使用 `multi: { min: 0, max: N }` 配置

4. **D8：时序正确性审计**
   - WHEN 审计 alien_scout（侦察兵）时，THE 审计系统 SHALL 验证 special 触发"基地计分后"的钩子注册时机是否正确

5. **D24：Handler 共返状态一致性审计**
   - WHEN 审计 alien_terraform 时，THE 审计系统 SHALL 验证多步交互（搜寻基地→交换基地→洗混牌库→额外打出随从）中，后续交互的选项是否基于前序 events 生效后的状态计算

6. **D31：效果拦截路径完整性审计**
   - WHEN 审计 alien_scout 时，THE 审计系统 SHALL 验证"放回手牌而非弃牌堆"的拦截逻辑是否在所有随从弃牌路径上生效

7. **D37：交互选项动态刷新完整性审计**
   - WHEN 审计 alien_crop_circles 时，THE 审计系统 SHALL 验证多步选择流程中，后续交互的选项是否自动刷新（框架层自动推断 minionUid 类型）

8. **D46：交互选项 UI 渲染模式声明完整性审计**
   - WHEN 审计所有外星人派系交互时，THE 审计系统 SHALL 验证 `displayMode` 是否正确声明（随从选择 → `'minion'`，基地选择 → `'button'`）

9. **GameTestRunner 行为测试**
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：alien_crop_circles 从单个基地返回多个随从后，其他基地随从不受影响
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：alien_scout 在基地计分后正确触发，随从返回手牌而非弃牌堆

10. IF 发现实现缺失或与描述不一致，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议


### 需求 2：恐龙（Dinosaurs）派系 D1-D47 全维度审计

**用户故事：** 作为开发者，我想对恐龙派系所有复杂能力进行 D1-D47 全维度审计，确保持续效果和条件判断正确。

#### 验收标准

1. **D1 子项：实体筛选范围语义审计**
   - WHEN 审计 dino_survival_of_the_fittest（适者生存）时，THE 审计系统 SHALL 验证"每个基地消灭最低力量随从"的全局扫描是否正确遍历所有基地，而非仅当前基地

2. **D8：时序正确性审计**
   - WHEN 审计 dino_armor_stego（装甲剑龙）时，THE 审计系统 SHALL 验证"在其他玩家的回合中+2力量"的持续修正是否正确判断当前回合玩家（`ctx.playerId !== ownerId`）

3. **D11/D12：额度写入-消耗对称性审计**
   - WHEN 审计 dino_rampage（狂暴）时，THE 审计系统 SHALL 验证"降低临界点等同于己方力量"的临时修正写入路径和回合结束清理路径是否对称

4. **D14：回合清理完整性审计**
   - WHEN 审计 dino_rampage 时，THE 审计系统 SHALL 验证临时临界点修正是否在回合结束时正确清零

5. **D31：效果拦截路径完整性审计**
   - WHEN 审计 dino_tooth_and_claw（全副武装）时，THE 审计系统 SHALL 验证"消灭本卡使能力无效"的拦截器是否在所有能力影响路径上生效
   - WHEN 审计 dino_wildlife_preserve（野生保护区）时，THE 审计系统 SHALL 验证"不会受到其他玩家的战术影响"的保护是否在所有战术效果路径上生效

6. **D33：跨派系同类能力实现路径一致性审计**
   - THE 审计系统 SHALL 对比 dino_natural_selection（物竞天择）和其他派系的"消灭力量更低随从"能力，验证实现路径一致性

7. **GameTestRunner 行为测试**
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：dino_armor_stego 在己方回合力量不变，在对手回合力量+2
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：dino_survival_of_the_fittest 在多个基地同时消灭最低力量随从，平局时玩家选择
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：dino_rampage 降低临界点后，回合结束时临界点恢复原值

8. IF 发现实现缺失或与描述不一致，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议


### 需求 3：海盗（Pirates）派系 D1-D47 全维度审计

**用户故事：** 作为开发者，我想对海盗派系所有复杂能力进行 D1-D47 全维度审计，确保移动、消灭和特殊时机正确。

#### 验收标准

1. **D1 子项：实体筛选范围语义审计**
   - WHEN 审计 pirate_full_sail（全速航行）时，THE 审计系统 SHALL 验证"移动任意数量随从到其他基地"的目标范围是否正确排除当前基地
   - WHEN 审计 pirate_broadside（侧翼开炮）时，THE 审计系统 SHALL 验证"你拥有随从的基地里一个玩家的所有力量为2或以下的随从"的三重条件过滤是否正确实现

2. **D5：交互语义完整性审计**
   - WHEN 审计 pirate_full_sail 时，THE 审计系统 SHALL 验证"移动任意数量随从"的多步循环交互是否使用正确的 `multi` 配置和停止机制

3. **D8：时序正确性审计**
   - WHEN 审计 pirate_king（海盗王）时，THE 审计系统 SHALL 验证 special 触发"基地计分前移动到那里"的钩子注册时机是否正确
   - WHEN 审计 pirate_first_mate（大副）时，THE 审计系统 SHALL 验证"本基地计分后移动两个随从"的触发时机是否在计分后、弃牌前

4. **D31：效果拦截路径完整性审计**
   - WHEN 审计 pirate_buccaneer（海盗）时，THE 审计系统 SHALL 验证"将要被消灭时移动到其他基地代替"的拦截器是否在所有随从消灭路径上生效
   - WHEN 审计 pirate_first_mate 时，THE 审计系统 SHALL 验证"移动到其他基地而非弃牌堆"的拦截逻辑是否在计分后弃牌路径上生效

5. **D33：跨派系同类能力实现路径一致性审计**
   - THE 审计系统 SHALL 对比 pirate_powderkeg（炸药桶）和其他派系的"消灭己方随从→触发效果"能力，验证实现路径一致性

6. **GameTestRunner 行为测试**
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：pirate_full_sail 在基地计分前可打出，移动多个随从后其他基地随从数量正确
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：pirate_buccaneer 被消灭时移动到其他基地，不进入弃牌堆
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：pirate_first_mate 在基地计分后移动随从，不进入弃牌堆

7. IF 发现实现缺失或与描述不一致，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议

### 需求 4：忍者（Ninjas）派系 D1-D47 全维度审计

**用户故事：** 作为开发者，我想对忍者派系所有复杂能力进行 D1-D47 全维度审计，确保特殊时机和条件消灭正确。

#### 验收标准

1. **D1 子项：实体筛选范围语义审计**
   - WHEN 审计 ninja_master（忍者大师）时，THE 审计系统 SHALL 验证"本基地的一个随从"的范围限定是否正确约束目标选择

2. **D5：交互语义完整性审计**
   - WHEN 审计 ninja_disguise（伪装）时，THE 审计系统 SHALL 验证多步流程（选择基地→选择随从→打出随从→拿回手牌）的交互链完整性

3. **D8：时序正确性审计**
   - WHEN 审计 ninja_shinobi（影舞者）时，THE 审计系统 SHALL 验证 special 触发"基地计分前打出到那里"的钩子注册时机是否正确
   - WHEN 审计 ninja_acolyte（忍者侍从）时，THE 审计系统 SHALL 验证"回合中未打出随从时"的条件判断是否使用 post-reduce 计数器（`minionsPlayed === 0`）

4. **D8 子项：写入-消费窗口对齐审计**
   - WHEN 审计 ninja_acolyte 时，THE 审计系统 SHALL 验证"额外打出随从到这个基地"的额度授予时机是否在 playCards 阶段可消费

5. **D14：回合清理完整性审计**
   - WHEN 审计 ninja_infiltrate（渗透）时，THE 审计系统 SHALL 验证"持续无视基地能力直到下回合"的效果是否在下回合开始时正确清理

6. **D31：效果拦截路径完整性审计**
   - WHEN 审计 ninja_smoke_bomb（烟幕弹）时，THE 审计系统 SHALL 验证附着到随从的保护效果是否在所有能力影响路径上生效
   - WHEN 审计 ninja_assassination（暗杀）时，THE 审计系统 SHALL 验证"回合结束时消灭该随从"的触发是否在所有回合结束路径上生效

7. **GameTestRunner 行为测试**
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：ninja_shinobi 在基地计分前可打出，且每个基地只能使用一次忍者能力
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：ninja_acolyte 在回合中未打出随从时触发，打出随从后不触发
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：ninja_smoke_bomb 保护随从不受能力影响，回合开始时消灭本卡

8. IF 发现实现缺失或与描述不一致，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议


### 需求 5：机器人（Robots）派系 D1-D47 全维度审计

**用户故事：** 作为开发者，我想对机器人派系所有复杂能力进行 D1-D47 全维度审计，确保微型机联动和条件打出正确。

#### 验收标准

1. **D1 子项：实体筛选范围语义审计**
   - WHEN 审计 robot_microbot_alpha（微型机阿尔法号）时，THE 审计系统 SHALL 验证"所有随从均视为微型机"的标记逻辑是否正确影响所有基地上的所有随从

2. **D8：时序正确性审计**
   - WHEN 审计 robot_microbot_fixer（微型机修理者）时，THE 审计系统 SHALL 验证"第一个随从时额外打出"的条件判断是否使用 post-reduce 计数器（`minionsPlayed === 1`）
   - WHEN 审计 robot_microbot_reclaimer（微型机回收者）时，THE 审计系统 SHALL 验证"第一个随从时额外打出"的条件判断是否使用 post-reduce 计数器

3. **D8 子项：写入-消费窗口对齐审计**
   - WHEN 审计 robot_microbot_fixer 和 robot_microbot_reclaimer 时，THE 审计系统 SHALL 验证额外打出随从的额度授予时机是否在 playCards 阶段可消费

4. **D11/D12：额度写入-消耗对称性审计**
   - WHEN 审计 robot_zapbot（高速机器人）时，THE 审计系统 SHALL 验证"力量为2或更低的额外随从"的限定条件是否在额度授予和消耗时全程约束

5. **D19：组合场景审计**
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：robot_microbot_alpha 在场时，其他派系随从是否正确视为微型机，并触发微型机相关能力

6. **D31：效果拦截路径完整性审计**
   - WHEN 审计 robot_warbot（战斗机器人）时，THE 审计系统 SHALL 验证"不能被消灭"的保护是否在所有随从消灭路径上生效
   - WHEN 审计 robot_nukebot（核弹机器人）时，THE 审计系统 SHALL 验证"被消灭后消灭本基地其他玩家所有随从"的触发是否在所有随从消灭路径上生效

7. **D33：跨派系同类能力实现路径一致性审计**
   - THE 审计系统 SHALL 对比 robot_hoverbot（盘旋机器人）和其他派系的"展示牌库顶→条件打出"能力，验证实现路径一致性

8. **GameTestRunner 行为测试**
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：robot_microbot_fixer 在第一个随从时触发，第二个随从时不触发
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：robot_microbot_alpha 在场时，所有随从视为微型机，robot_microbot_fixer 的力量修正正确计算
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：robot_hoverbot 展示牌库顶，如果是随从可额外打出，否则放回

9. IF 发现实现缺失或与描述不一致，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议

### 需求 6：巫师（Wizards）派系 D1-D47 全维度审计

**用户故事：** 作为开发者，我想对巫师派系所有复杂能力进行 D1-D47 全维度审计，确保牌库操作和额外出牌正确。

#### 验收标准

1. **D5：交互语义完整性审计**
   - WHEN 审计 wizard_portal（传送）时，THE 审计系统 SHALL 验证完整流程（展示牌库顶5张→选择任意数量随从→排列其余）的交互链完整性
   - WHEN 审计 wizard_scry（占卜）时，THE 审计系统 SHALL 验证四步流程（搜寻牌库→选择战术→展示→放入手牌→重洗）的交互链完整性

2. **D8 子项：写入-消费窗口对齐审计**
   - WHEN 审计 wizard_archmage（大法师）时，THE 审计系统 SHALL 验证"每回合额外打出一个战术"的持续额度授予是否在 playCards 阶段可消费
   - WHEN 审计 wizard_time_loop（时间圆环）时，THE 审计系统 SHALL 验证"打出两张额外战术"的额度授予时机是否在 playCards 阶段可消费

3. **D11/D12：额度写入-消耗对称性审计**
   - WHEN 审计 wizard_archmage 时，THE 审计系统 SHALL 验证持续额度的写入路径和消耗路径是否对称

4. **D24：Handler 共返状态一致性审计**
   - WHEN 审计 wizard_sacrifice（献祭）时，THE 审计系统 SHALL 验证两步流程（选择随从→抽牌→消灭随从）中，抽牌数量是否基于选择时的随从力量计算

5. **D33：跨派系同类能力实现路径一致性审计**
   - THE 审计系统 SHALL 对比 wizard_neophyte（学徒）和其他派系的"展示牌库顶→条件打出"能力，验证实现路径一致性

6. **GameTestRunner 行为测试**
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：wizard_portal 展示牌库顶5张，选择任意数量随从放入手牌，其余按任意顺序返回牌库顶
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：wizard_archmage 每回合额外打出一个战术，额度在回合结束时清零
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：wizard_sacrifice 选择随从后抽等同力量的牌，然后消灭该随从

7. IF 发现实现缺失或与描述不一致，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议


### 需求 7：僵尸（Zombies）派系 D1-D47 全维度审计

**用户故事：** 作为开发者，我想对僵尸派系所有复杂能力进行 D1-D47 全维度审计，确保弃牌堆操作和复活机制正确。

#### 验收标准

1. **D1 子项：实体筛选范围语义审计**
   - WHEN 审计 zombie_lord（僵尸领主）时，THE 审计系统 SHALL 验证"在每个没有你随从的基地额外打出力量为2或以下的随从"的双重条件过滤是否正确实现
   - WHEN 审计 zombie_outbreak（爆发）时，THE 审计系统 SHALL 验证"在没有你随从的基地额外打出随从"的限定条件是否在执行时全程约束（非仅入口检查）

2. **D5：交互语义完整性审计**
   - WHEN 审计 zombie_not_enough_bullets（子弹不够）时，THE 审计系统 SHALL 验证"任意数量同名随从从弃牌堆置入手牌"的同名判断和多选交互是否正确实现

3. **D8：时序正确性审计**
   - WHEN 审计 zombie_tenacious_z（顽强丧尸）时，THE 审计系统 SHALL 验证 special 触发"从弃牌堆作为额外随从打出"的条件和"每回合只能使用一个顽强丧尸"的限制是否正确实现

4. **D31：效果拦截路径完整性审计**
   - WHEN 审计 zombie_theyre_coming_to_get_you（它们为你而来）时，THE 审计系统 SHALL 验证"从弃牌堆而非手牌打出随从到此基地"的替代打出逻辑是否在所有随从打出路径上生效

5. **D33：跨派系同类能力实现路径一致性审计**
   - THE 审计系统 SHALL 对比 zombie_grave_digger（掘墓者）和其他派系的"从弃牌堆选择卡牌放入手牌"能力，验证实现路径一致性

6. **GameTestRunner 行为测试**
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：zombie_lord 在每个没有己方随从的基地额外打出力量为2或以下的随从
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：zombie_tenacious_z 从弃牌堆作为额外随从打出，每回合只能使用一个
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：zombie_theyre_coming_to_get_you 在场时，随从从弃牌堆打出而非手牌

7. IF 发现实现缺失或与描述不一致，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议

### 需求 8：捣蛋鬼（Tricksters）派系 D1-D47 全维度审计

**用户故事：** 作为开发者，我想对捣蛋鬼派系所有复杂能力进行 D1-D47 全维度审计，确保持续触发和干扰效果正确。

#### 验收标准

1. **D8：时序正确性审计**
   - WHEN 审计 trickster_leprechaun（矮妖）时，THE 审计系统 SHALL 验证持续触发"其他玩家打出力量低于本随从的随从到这时消灭它（先结算能力）"的触发时机和时序是否正确
   - WHEN 审计 trickster_flame_trap（火焰陷阱）时，THE 审计系统 SHALL 验证持续触发"其他玩家打出随从到此基地时消灭它（先结算能力）和本卡"的双消灭时序是否正确

2. **D14：回合清理完整性审计**
   - WHEN 审计 trickster_mark_of_sleep（睡眠印记）时，THE 审计系统 SHALL 验证"该玩家下回合不能打出战术"的限制是否在下回合结束时正确清理

3. **D31：效果拦截路径完整性审计**
   - WHEN 审计 trickster_hideout（藏身处）时，THE 审计系统 SHALL 验证"其他玩家战术影响你在此基地随从时消灭本卡使战术无效"的拦截逻辑是否在所有战术效果路径上生效
   - WHEN 审计 trickster_block_the_path（通路禁止）时，THE 审计系统 SHALL 验证"该派系随从不能打出到此基地"的限制是否在所有随从打出路径上生效

4. **D33：跨派系同类能力实现路径一致性审计**
   - THE 审计系统 SHALL 对比 trickster_brownie（棕仙）和其他派系的"卡牌效果影响本随从时触发"能力，验证实现路径一致性

5. **GameTestRunner 行为测试**
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：trickster_leprechaun 在其他玩家打出力量低于本随从的随从时消灭它，先结算能力
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：trickster_flame_trap 在其他玩家打出随从时消灭它和本卡，先结算能力
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：trickster_hideout 在其他玩家战术影响己方随从时消灭本卡使战术无效

6. IF 发现实现缺失或与描述不一致，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议


### 需求 9：幽灵（Ghosts）派系 D1-D47 全维度审计

**用户故事：** 作为开发者，我想对幽灵派系所有复杂能力进行 D1-D47 全维度审计，确保手牌条件判断和弃牌堆打出正确。

#### 验收标准

1. **D8：时序正确性审计**
   - WHEN 审计 ghost_spectre（幽灵之主）时，THE 审计系统 SHALL 验证 special 触发"手牌2张或更少时从弃牌堆打出代替正常打出"的条件判断时机是否正确

2. **D31：效果拦截路径完整性审计**
   - WHEN 审计 ghost_haunting（不散阴魂）时，THE 审计系统 SHALL 验证"手牌2张或更少时不受其他玩家卡牌影响"的保护是否在所有卡牌效果路径上生效
   - WHEN 审计 ghost_incorporeal（幽灵化）时，THE 审计系统 SHALL 验证附着到随从的"不受其他玩家卡牌影响"保护是否在所有卡牌效果路径上生效

3. **GameTestRunner 行为测试**
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：ghost_spectre 在手牌2张或更少时从弃牌堆打出，手牌3张或更多时正常打出
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：ghost_haunting 在手牌2张或更少时+3力量且不受其他玩家卡牌影响

4. IF 发现实现缺失或与描述不一致，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议


### 需求 10：熊骑兵（Bear Cavalry）派系 D1-D47 全维度审计

**用户故事：** 作为开发者，我想对熊骑兵派系所有复杂能力进行 D1-D47 全维度审计，确保强制移动和保护效果正确。

#### 验收标准

1. **D1 子项：实体筛选范围语义审计**
   - WHEN 审计 bear_cavalry_youre_pretty_much_borscht（你们都是美食）时，THE 审计系统 SHALL 验证"选择有己方随从的基地→将其他玩家在该基地所有随从移动到其他基地"的范围限定是否正确实现

2. **D31：效果拦截路径完整性审计**
   - WHEN 审计 bear_cavalry_general_ivan（伊万将军）时，THE 审计系统 SHALL 验证"你的随从不能被消灭"的全局保护是否在所有随从消灭路径上生效
   - WHEN 审计 bear_cavalry_superiority（全面优势）时，THE 审计系统 SHALL 验证"你在这里的随从不能被其他玩家消灭、移动或返回"的多重保护是否在所有相关路径上生效

3. **GameTestRunner 行为测试**
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：bear_cavalry_general_ivan 在场时，己方所有随从不能被消灭
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：bear_cavalry_superiority 在场时，该基地己方随从不能被其他玩家消灭、移动或返回

4. IF 发现实现缺失或与描述不一致，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议


### 需求 11：蒸汽朋克（Steampunks）派系 D1-D47 全维度审计

**用户故事：** 作为开发者，我想对蒸汽朋克派系所有复杂能力进行 D1-D47 全维度审计，确保战术回收和附着联动正确。

#### 验收标准

1. **D1 子项：实体筛选范围语义审计**
   - WHEN 审计 steampunk_mechanic（机械师）时，THE 审计系统 SHALL 验证"从弃牌堆选择可打到基地上的战术"的过滤条件是否正确排除不能打到基地上的战术

2. **D31：效果拦截路径完整性审计**
   - WHEN 审计 steampunk_steam_queen（蒸汽女皇）时，THE 审计系统 SHALL 验证"你的战术不会被其他玩家卡牌影响"的保护是否在所有卡牌效果路径上生效
   - WHEN 审计 steampunk_escape_hatch（逃生通道）时，THE 审计系统 SHALL 验证"随从被消灭时放到手牌而非弃牌堆"的拦截器是否在所有随从消灭路径上生效

3. **GameTestRunner 行为测试**
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：steampunk_mechanic 从弃牌堆选择可打到基地上的战术作为额外战术打出
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：steampunk_escape_hatch 在场时，随从被消灭时放到手牌而非弃牌堆

4. IF 发现实现缺失或与描述不一致，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议


### 需求 12：食人花（Killer Plants）派系 D1-D47 全维度审计

**用户故事：** 作为开发者，我想对食人花派系所有复杂能力进行 D1-D47 全维度审计，确保搜牌、繁殖和持续效果正确。

#### 验收标准

1. **D5：交互语义完整性审计**
   - WHEN 审计 killer_plant_blossom（繁荣生长）时，THE 审计系统 SHALL 验证"打出至多三个同名额外随从"的同名判断和数量限制是否正确实现

2. **D8：时序正确性审计**
   - WHEN 审计 killer_plant_sprout（幼苗）时，THE 审计系统 SHALL 验证"回合开始消灭本卡→搜寻力量为3或以下随从→额外打出到此基地→重洗牌库"的四步流程时序是否正确

3. **D14：回合清理完整性审计**
   - WHEN 审计 killer_plant_weed_eater（野生食人花）时，THE 审计系统 SHALL 验证"打出回合中-2力量"的临时力量修正是否在回合结束时正确清理

4. **GameTestRunner 行为测试**
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：killer_plant_sprout 在回合开始时消灭本卡，搜寻力量为3或以下随从额外打出到此基地
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：killer_plant_blossom 打出至多三个同名额外随从

5. IF 发现实现缺失或与描述不一致，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议


### 需求 13：克苏鲁仆从（Cthulhu）派系 D1-D47 全维度审计

**用户故事：** 作为开发者，我想对克苏鲁仆从派系所有复杂能力进行 D1-D47 全维度审计，确保疯狂卡操作和献祭机制正确。

#### 验收标准

1. **D8：时序正确性审计**
   - WHEN 审计 cthulhu_chosen（神选者）时，THE 审计系统 SHALL 验证 special 触发"基地计分前抽疯狂卡并+2力量直到回合结束"的时机和临时修正清理是否正确

2. **D14：回合清理完整性审计**
   - WHEN 审计 cthulhu_chosen 时，THE 审计系统 SHALL 验证"+2力量直到回合结束"的临时修正是否在回合结束时正确清理

3. **GameTestRunner 行为测试**
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：cthulhu_chosen 在基地计分前抽疯狂卡并+2力量，回合结束时力量修正清零
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：cthulhu_complete_the_ritual（完成仪式）在回合开始时将基地上所有随从和战术放回拥有者牌库底，然后交换基地

4. IF 发现实现缺失或与描述不一致，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议


### 需求 14：远古物种（Elder Things）派系 D1-D47 全维度审计

**用户故事：** 作为开发者，我想对远古物种派系所有复杂能力进行 D1-D47 全维度审计，确保疯狂卡散播和二选一效果正确。

#### 验收标准

1. **D5：交互语义完整性审计**
   - WHEN 审计 elder_thing_shoggoth（修格斯）时，THE 审计系统 SHALL 验证三重效果（只能打到至少6点力量的基地→每位其他玩家可以抽疯狂卡→不抽的玩家消灭一个在此基地的随从）的交互链完整性

2. **D31：效果拦截路径完整性审计**
   - WHEN 审计 elder_thing_elder_thing（远古之物）时，THE 审计系统 SHALL 验证"不受对手卡牌影响"的保护是否在所有卡牌效果路径上生效

3. **GameTestRunner 行为测试**
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：elder_thing_shoggoth 只能打到至少6点力量的基地，每位其他玩家可以抽疯狂卡，不抽的玩家消灭一个在此基地的随从
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：elder_thing_elder_thing 不受对手卡牌影响

4. IF 发现实现缺失或与描述不一致，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议


### 需求 15：印斯茅斯（Innsmouth）派系 D1-D47 全维度审计

**用户故事：** 作为开发者，我想对印斯茅斯派系所有复杂能力进行 D1-D47 全维度审计，确保同名随从联动和疯狂卡交互正确。

#### 验收标准

1. **D5：交互语义完整性审计**
   - WHEN 审计 innsmouth_the_locals（本地人）时，THE 审计系统 SHALL 验证"展示牌库顶3张→将其中本地人放入手牌→其余放牌库底"的搜索流程和同名判断是否正确实现

2. **D8：时序正确性审计**
   - WHEN 审计 innsmouth_return_to_the_sea（重返深海）时，THE 审计系统 SHALL 验证 special 触发"基地计分后将同名随从返回手中而非弃牌堆"的拦截逻辑时机是否正确

3. **GameTestRunner 行为测试**
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：innsmouth_the_locals 展示牌库顶3张，将其中本地人放入手牌，其余放牌库底
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：innsmouth_return_to_the_sea 在基地计分后将同名随从返回手中而非弃牌堆

4. IF 发现实现缺失或与描述不一致，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议


### 需求 16：米斯卡塔尼克（Miskatonic University）派系 D1-D47 全维度审计

**用户故事：** 作为开发者，我想对米斯卡塔尼克派系所有复杂能力进行 D1-D47 全维度审计，确保疯狂卡利用和搜牌正确。

#### 验收标准

1. **D8 子项：写入-消费窗口对齐审计**
   - WHEN 审计 miskatonic_professor（教授）时，THE 审计系统 SHALL 验证天赋"弃掉疯狂卡→额外打出战术和/或随从"的双额度授予时机是否在 playCards 阶段可消费

2. **GameTestRunner 行为测试**
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：miskatonic_professor 弃掉疯狂卡后额外打出战术和/或随从
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：miskatonic_mandatory_reading（最好不知道的事）在基地计分前选择一个随从，抽最多3张疯狂卡，每抽1张该随从+2力量

3. IF 发现实现缺失或与描述不一致，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议


### 需求 17：基地卡 D1-D47 全维度审计（高风险卡牌重点）

**用户故事：** 作为开发者，我想对所有具有复杂能力的基地卡进行 D1-D47 全维度审计，重点关注已知高风险卡牌。

#### 验收标准

1. **D1 子项：实体筛选范围语义审计（高风险）**
   - WHEN 审计 base_tortuga（托尔图加）时，THE 审计系统 SHALL 验证"计分后亚军可移动随从到替换基地"的范围限定是否正确约束为亚军的随从，而非所有玩家的随从
   - WHEN 审计 base_temple_of_goju（刚柔流寺庙）时，THE 审计系统 SHALL 验证"计分后每位玩家最高力量随从放入牌库底"的全局扫描是否正确遍历所有玩家

2. **D8：时序正确性审计（高风险）**
   - WHEN 审计 base_tortuga 时，THE 审计系统 SHALL 验证 afterScoring trigger 回调中是否误用 `ctx.playerId` 作为亚军判定（应遍历所有玩家的计分结果独立判断）
   - WHEN 审计 base_temple_of_goju 时，THE 审计系统 SHALL 验证 afterScoring trigger 的执行时机是否在计分完成后、弃牌前

3. **D8 子项：写入-消费窗口对齐审计（高风险）**
   - WHEN 审计 base_homeworld（家园）时，THE 审计系统 SHALL 验证"随从打出后额外打出力量为2或以下的随从"的额度授予时机是否在 playCards 阶段可消费
   - WHEN 审计 base_fairy_ring（仙灵圈）时，THE 审计系统 SHALL 验证"首次打出随从后额外打出随从到这或额外打出战术"的额度授予时机是否在 playCards 阶段可消费

4. **D11/D12/D13：额度写入-消耗对称性审计（高风险）**
   - WHEN 审计 base_homeworld 时，THE 审计系统 SHALL 验证"力量为2或以下"的限定条件是否在额度授予和消耗时全程约束
   - WHEN 审计 base_secret_garden（神秘花园）时，THE 审计系统 SHALL 验证"额外打出力量为2或以下随从到这里"的基地限定和力量限定是否在额度授予和消耗时全程约束

5. **D19：组合场景审计（高风险）**
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：base_homeworld（全局 minionLimit+1, 力量≤2）+ base_secret_garden（baseLimitedMinionQuota+1, 力量≤2, 限定到该基地）同时生效时，两种额度互不干扰

6. **D31：效果拦截路径完整性审计**
   - WHEN 审计 base_tar_pits（焦油坑）时，THE 审计系统 SHALL 验证"随从被消灭后放到牌库底而非弃牌堆"的拦截器是否在所有随从消灭路径上生效
   - WHEN 审计 base_ritual_site（仪式场所）时，THE 审计系统 SHALL 验证"计分后随从洗回牌库而非弃牌堆"的拦截是否在计分后弃牌路径上生效

7. **GameTestRunner 行为测试（高风险卡牌）**
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：base_tortuga 计分后亚军可移动随从到替换基地，冠军和第三名不能移动
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：base_temple_of_goju 计分后每位玩家最高力量随从放入牌库底
   - THE 审计系统 SHALL 使用 GameTestRunner 构造测试：base_fairy_ring 首次打出随从后额外打出随从到这或额外打出战术，第二次打出随从不触发

8. IF 发现实现缺失或与描述不一致，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议


### 需求 18：D37 交互选项动态刷新完整性审计（全局）

**用户故事：** 作为开发者，我想审计所有交互选项的动态刷新机制，确保框架层自动推断选项类型并正确刷新。

#### 验收标准

1. THE 审计系统 SHALL 检查所有 `createSimpleChoice` 调用点，验证选项类型（cardUid/minionUid/baseIndex）是否被框架层自动推断
2. THE 审计系统 SHALL 检查是否存在手动实现 `optionsGenerator` 的情况，验证是否为复杂刷新逻辑（如从弃牌堆/牌库/continuationContext 中过滤）
3. WHEN 发现手动实现 `optionsGenerator` 但逻辑为简单的手牌/场上单位过滤时，THE 审计系统 SHALL 标记为 ⚠️ 可简化（框架层已自动处理）
4. THE 审计系统 SHALL 使用 GameTestRunner 构造测试：多个交互同时触发时，后续交互的选项是否自动刷新（已失效的手牌/随从不出现在选项中）
5. IF 发现选项刷新不完整或错误，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议

### 需求 19：D39 流程控制标志清除完整性审计（全局）

**用户故事：** 作为开发者，我想审计所有 `flowHalted` 标志的清除逻辑，确保清除条件检查背后的状态而非仅检查标志本身。

#### 验收标准

1. THE 审计系统 SHALL grep 所有设置 `flowHalted = true` 的位置，追踪对应的清除条件
2. THE 审计系统 SHALL 检查清除条件是否检查背后的状态（如 `sys.interaction.current === null`），而非仅检查 `flowHalted` 标志
3. WHEN 发现清除条件仅检查 `flowHalted` 标志时，THE 审计系统 SHALL 标记为 ❌ 清除条件不完整
4. THE 审计系统 SHALL 使用 GameTestRunner 构造测试：阶段结束技能阻止阶段推进后，玩家跳过交互时流程正确恢复
5. IF 发现流程控制标志清除不完整，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议


### 需求 20：D40 后处理循环事件去重完整性审计（全局）

**用户故事：** 作为开发者，我想审计后处理循环中的事件去重逻辑，确保去重集合从正确的事件源构建。

#### 验收标准

1. THE 审计系统 SHALL grep 所有后处理循环（如 `processDestroyTriggers`、`processOngoingTriggers`），检查去重集合的构建来源
2. THE 审计系统 SHALL 验证去重集合是否从输入事件构建（正确），而非从输出事件构建（错误）
3. WHEN 发现去重集合从输出事件构建时，THE 审计系统 SHALL 标记为 ❌ 去重逻辑错误
4. THE 审计系统 SHALL 使用 GameTestRunner 构造测试：触发链递归时，相同事件不会被重复处理
5. IF 发现事件去重逻辑错误，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议

### 需求 21：D45 Pipeline 多阶段调用去重审计（全局）

**用户故事：** 作为开发者，我想审计 Pipeline 中 `postProcessSystemEvents` 的多阶段调用，确保不会重复处理相同事件。

#### 验收标准

1. THE 审计系统 SHALL 检查 `executePipeline` 中 `postProcessSystemEvents` 的调用位置（步骤 4.5 和步骤 5）
2. THE 审计系统 SHALL 验证两次调用是否有去重机制，防止相同事件被重复处理
3. WHEN 发现两次调用无去重机制时，THE 审计系统 SHALL 标记为 ⚠️ 潜在重复处理风险
4. THE 审计系统 SHALL 使用 GameTestRunner 构造测试：一个命令产生多个事件时，每个事件只被后处理一次
5. IF 发现重复处理问题，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议


### 需求 22：D46 交互选项 UI 渲染模式声明完整性审计（全局）

**用户故事：** 作为开发者，我想审计所有交互选项的 UI 渲染模式声明，确保 `displayMode` 正确声明或自动推断。

#### 验收标准

1. THE 审计系统 SHALL grep 所有 `createSimpleChoice` 调用点，检查 `displayMode` 是否正确声明
2. THE 审计系统 SHALL 验证以下映射关系：
   - 随从选择 → `displayMode: 'minion'`（或自动推断）
   - 卡牌选择 → `displayMode: 'card'`（或自动推断）
   - 基地选择 → `displayMode: 'button'`（或自动推断）
   - 通用选项 → `displayMode: 'button'`（默认）
3. WHEN 发现 `displayMode` 声明与选项类型不匹配时，THE 审计系统 SHALL 标记为 ❌ 渲染模式错误
4. THE 审计系统 SHALL 检查同类型交互（如"选随从→逐张选手牌"模式）的 `displayMode` 是否跨派系一致
5. IF 发现渲染模式声明不完整或错误，THEN THE 审计系统 SHALL 记录具体差异并标注修复建议

### 需求 23：跨能力交叉影响审计（全局）

**用户故事：** 作为开发者，我想审计不同派系能力之间的交叉影响，确保组合使用时不会产生语义冲突。

#### 验收标准

1. WHEN 审查保护效果叠加时，THE 审计系统 SHALL 验证多个"不能被消灭"/"不受影响"保护同时存在时的优先级和互斥逻辑
2. WHEN 审查限制效果叠加时，THE 审计系统 SHALL 验证多个"不能打出到这里"/"不能移动"限制同时存在时的合并逻辑
3. WHEN 审查触发链时，THE 审计系统 SHALL 验证一个事件触发多个持续效果时的执行顺序和状态一致性
4. WHEN 审查"视为微型机"与其他派系交互时，THE 审计系统 SHALL 验证 robot_microbot_alpha 的"所有随从视为微型机"对其他派系随从的影响范围
5. WHEN 审查疯狂卡机制与非克苏鲁派系交互时，THE 审计系统 SHALL 验证非克苏鲁派系的弃牌/搜牌能力对疯狂卡的处理是否正确
6. IF 发现交叉影响导致的语义冲突，THEN THE 审计系统 SHALL 记录冲突场景和建议的解决方案


### 需求 24：审计结果汇总与优先级排序

**用户故事：** 作为开发者，我想获得所有审计结果的汇总报告，以便快速了解整体实现质量和需要修复的问题。

#### 验收标准

1. WHEN 所有派系和基地审查完成后，THE 审计系统 SHALL 生成一份汇总报告，列出所有发现的问题
2. THE 汇总报告 SHALL 按严重程度分类：
   - ❌ 缺失实现（无代码）
   - ❌ 语义偏差（有代码但行为不一致）
   - ⚠️ 潜在风险（可能在特定场景下失效）
   - 📝 测试缺失（功能正确但无测试覆盖）
3. THE 汇总报告 SHALL 包含每个派系的审计通过率（✅ 数量 / 总交互链数量）
4. THE 汇总报告 SHALL 按修复优先级排序：
   - P0：影响游戏正确性的问题（缺失实现、语义偏差）
   - P1：潜在风险（特定场景下可能失效）
   - P2：测试缺失（功能正确但无测试覆盖）
5. THE 汇总报告 SHALL 特别标注审计反模式清单中的违规项：
   - 限定条件仅入口检查（D1 子项）
   - 可选效果自动执行（D5）
   - afterScoring 误用 ctx.playerId（D8）
   - post-reduce 计数器阈值错误（D8）
   - 写入-消费窗口不对齐（D8 子项）
   - 额度消耗优先级错误（D11/D12/D13）
   - 回合清理遗漏（D14）
   - UI 状态不同步（D15）
   - 效果拦截路径遗漏（D31）
   - 跨派系同类能力实现路径不一致（D33）
   - Handler 共返状态不一致（D24）
   - 交互选项动态刷新不完整（D37）
   - 流程控制标志清除不完整（D39）
   - 后处理循环事件去重错误（D40）
   - Pipeline 多阶段调用重复处理（D45）
   - 交互选项 UI 渲染模式声明错误（D46）
6. THE 汇总报告 SHALL 包含高风险卡牌的审计结果摘要（base_tortuga、alien_crop_circles、pirate_full_sail、robot_microbot_reclaimer、base_fairy_ring）
7. THE 汇总报告 SHALL 提供修复建议和参考实现（如有）

