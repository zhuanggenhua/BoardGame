# 需求文档：召唤师战争全链路审计

## 简介

对召唤师战争（SummonerWars）游戏进行全面的描述→实现全链路审计，覆盖6个阵营的所有能力、事件卡、核心机制。审计遵循 `.spec/knowledge/standards/testing-audit.md`「描述→实现全链路审查规范」执行六步审查流程（锁定权威描述→拆分独立交互链→逐链追踪八层→grep消费点→交叉影响检查→数据查询一致性审查），并修复发现的问题。

## 术语表

- **Audit_Engine**: 审计执行引擎，负责逐链逐步骤检查八层链路
- **Eight_Layer_Check**: 八层链路检查，包含定义层、注册层、执行层、状态层、验证层、UI层、i18n层、测试层
- **Interaction_Chain**: 独立交互链，任何需要独立触发条件、玩家输入或状态变更路径的效果
- **Atomic_Step**: 原子操作步骤，每个动词短语对应一个可验证的代码行为
- **UI_Hint**: UI 操作提示，玩家在执行交互能力时看到的友好提示信息
- **Data_Query_Consistency**: 数据查询一致性，所有消费点必须走统一查询入口（如 `getUnitAbilities`），禁止直接读底层字段
- **Constraint_Enforcement**: 限定条件全程约束，描述中的限定词必须在执行路径全程被强制约束，仅在入口做前置检查但执行时不约束 = ❌
- **Anti_Pattern**: 审计反模式，来自实际遗漏复盘的9条检查清单

## 需求

### 需求 1：核心机制审计

**用户故事：** 作为开发者，我希望验证核心游戏机制的实现与规则文档完全一致，以确保基础玩法正确。

#### 验收标准

1. WHEN Audit_Engine 检查移动机制, THE Audit_Engine SHALL 验证移动规则（最多3个单位各移动2格、禁止对角线、不能穿过卡牌、建筑不可移动）与规则文档一致
2. WHEN Audit_Engine 检查攻击机制, THE Audit_Engine SHALL 验证近战（相邻）和远程（3格直线+遮挡规则+护城墙穿透）的实现与规则文档一致
3. WHEN Audit_Engine 检查召唤机制, THE Audit_Engine SHALL 验证费用扣除、城门相邻放置、无召唤延迟的实现与规则文档一致
4. WHEN Audit_Engine 检查建造机制, THE Audit_Engine SHALL 验证费用扣除、召唤师相邻或后方3行放置的实现与规则文档一致
5. WHEN Audit_Engine 检查魔力机制, THE Audit_Engine SHALL 验证魔力轨道（0-15范围）、弃牌换魔力、摧毁敌方+1魔力的实现与规则文档一致
6. WHEN Audit_Engine 检查抽牌机制, THE Audit_Engine SHALL 验证抽牌至5张、牌组空不洗混弃牌堆的实现与规则文档一致
7. WHEN Audit_Engine 检查阶段流转, THE Audit_Engine SHALL 验证六阶段顺序（召唤→移动→建造→攻击→魔力→抽牌）和不活动惩罚的实现与规则文档一致
8. WHEN Audit_Engine 检查伤害与摧毁, THE Audit_Engine SHALL 验证伤害标记、生命归零摧毁、弃置规则的实现与规则文档一致


### 需求 2：堕落王国（亡灵法师）阵营审计

**用户故事：** 作为开发者，我希望验证堕落王国阵营所有能力和事件卡的实现与规则描述完全一致，以确保该阵营玩法正确。

#### 验收标准

1. WHEN Audit_Engine 检查复活死灵（revive_undead）, THE Audit_Engine SHALL 验证自伤2点、从弃牌堆选择亡灵单位、放置到召唤师相邻空格的完整交互链在八层链路中正确实现
2. WHEN Audit_Engine 检查火祀召唤（fire_sacrifice）, THE Audit_Engine SHALL 验证消灭友方单位并将伊路特-巴尔放置到该位置的完整交互链在八层链路中正确实现
3. WHEN Audit_Engine 检查吸取生命（life_drain）, THE Audit_Engine SHALL 验证消灭2格内友方单位并双倍战力的完整交互链在八层链路中正确实现
4. WHEN Audit_Engine 检查暴怒（rage）, THE Audit_Engine SHALL 验证伤害标记数量加成战力的被动效果在伤害计算中正确实现
5. WHEN Audit_Engine 检查血腥狂怒（blood_rage）, THE Audit_Engine SHALL 验证任意单位被消灭时充能、充能加成战力、回合结束衰减2点的完整链路在八层中正确实现
6. WHEN Audit_Engine 检查献祭（sacrifice）, THE Audit_Engine SHALL 验证被消灭时对相邻敌方造成1伤害的触发链路在八层中正确实现
7. WHEN Audit_Engine 检查无魂（soulless）, THE Audit_Engine SHALL 验证消灭疫病体时不获得魔力的效果在八层中正确实现
8. WHEN Audit_Engine 检查感染（infection）, THE Audit_Engine SHALL 验证消灭敌方单位后从弃牌堆召唤疫病体到被消灭位置的完整交互链在八层中正确实现
9. WHEN Audit_Engine 检查灵魂转移（soul_transfer）, THE Audit_Engine SHALL 验证消灭敌方单位后弓箭手移动到被消灭位置的可选触发链路在八层中正确实现
10. WHEN Audit_Engine 检查堕落王国事件卡（地狱火之刃、葬火、歼灭、血之召唤）, THE Audit_Engine SHALL 验证每张事件卡的效果、费用、施放阶段在八层链路中正确实现

### 需求 3：欺心巫族阵营审计

**用户故事：** 作为开发者，我希望验证欺心巫族阵营所有能力和事件卡的实现与规则描述完全一致，以确保该阵营玩法正确。

#### 验收标准

1. WHEN Audit_Engine 检查心灵捕获（mind_capture）, THE Audit_Engine SHALL 验证攻击伤害足以消灭目标时提示选择控制或伤害的完整交互链在八层链路中正确实现
2. WHEN Audit_Engine 检查飞行（flying）, THE Audit_Engine SHALL 验证额外移动1格且可穿越所有卡牌的效果在移动验证和执行中正确实现
3. WHEN Audit_Engine 检查浮空术（aerial_strike）, THE Audit_Engine SHALL 验证2格内友方士兵获得飞行的光环效果在八层中正确实现
4. WHEN Audit_Engine 检查高阶念力（high_telekinesis）, THE Audit_Engine SHALL 验证攻击后推拉3格内非召唤师目标1格的完整交互链在八层中正确实现
5. WHEN Audit_Engine 检查稳固（stable）, THE Audit_Engine SHALL 验证免疫推拉效果在推拉解析时正确检查
6. WHEN Audit_Engine 检查读心传念（mind_transmission）, THE Audit_Engine SHALL 验证攻击后给3格内友方士兵额外攻击的完整交互链在八层中正确实现
7. WHEN Audit_Engine 检查迅捷（swift）, THE Audit_Engine SHALL 验证额外移动1格的效果在移动验证和执行中正确实现
8. WHEN Audit_Engine 检查远射（ranged）, THE Audit_Engine SHALL 验证攻击范围扩展到4格的被动效果在攻击验证中正确实现
9. WHEN Audit_Engine 检查念力（telekinesis）, THE Audit_Engine SHALL 验证攻击后推拉2格内非召唤师目标1格的完整交互链在八层中正确实现
10. WHEN Audit_Engine 检查幻化（illusion）, THE Audit_Engine SHALL 验证移动阶段开始时复制3格内士兵技能的完整交互链在八层中正确实现
11. WHEN Audit_Engine 检查迷魂（evasion）, THE Audit_Engine SHALL 验证相邻敌方攻击掷出特殊骰面时减伤1的效果在伤害计算中正确实现
12. WHEN Audit_Engine 检查缠斗（rebound）, THE Audit_Engine SHALL 验证相邻敌方离开时造成1伤害的触发链路在八层中正确实现
13. WHEN Audit_Engine 检查欺心巫族事件卡（心灵操控、风暴侵袭、催眠引诱、震慑）, THE Audit_Engine SHALL 验证每张事件卡的效果、费用、施放阶段在八层链路中正确实现


### 需求 4：先锋军团（圣骑士）阵营审计

**用户故事：** 作为开发者，我希望验证先锋军团阵营所有能力和事件卡的实现与规则描述完全一致，以确保该阵营玩法正确。

#### 验收标准

1. WHEN Audit_Engine 检查城塞之力（fortress_power）, THE Audit_Engine SHALL 验证攻击后从弃牌堆拿取城塞单位到手牌的完整交互链在八层链路中正确实现
2. WHEN Audit_Engine 检查指引（guidance）, THE Audit_Engine SHALL 验证召唤阶段开始时抓2张牌的效果在八层中正确实现
3. WHEN Audit_Engine 检查城塞精锐（fortress_elite）, THE Audit_Engine SHALL 验证2格内每有一个友方城塞单位+1战力的被动效果在伤害计算中正确实现
4. WHEN Audit_Engine 检查辉光射击（radiant_shot）, THE Audit_Engine SHALL 验证每2点魔力+1战力的被动效果在伤害计算中正确实现
5. WHEN Audit_Engine 检查神圣护盾（divine_shield）, THE Audit_Engine SHALL 验证3格内友方城塞被攻击时投骰减伤的效果在八层中正确实现
6. WHEN Audit_Engine 检查治疗（healing）, THE Audit_Engine SHALL 验证攻击友方时弃牌将伤害转为治疗的完整交互链在八层中正确实现
7. WHEN Audit_Engine 检查裁决（judgment）, THE Audit_Engine SHALL 验证攻击后按特殊骰面数量抓牌的效果在八层中正确实现
8. WHEN Audit_Engine 检查缠斗（entangle）, THE Audit_Engine SHALL 验证相邻敌方远离时造成1伤害的触发链路在八层中正确实现
9. WHEN Audit_Engine 检查守卫（guardian）, THE Audit_Engine SHALL 验证相邻敌方攻击时必须攻击守卫单位的效果在攻击验证中正确实现
10. WHEN Audit_Engine 检查圣光箭（holy_arrow）, THE Audit_Engine SHALL 验证攻击前弃牌获得魔力和战力加成的完整交互链在八层中正确实现
11. WHEN Audit_Engine 检查先锋军团事件卡（重燃希望、圣洁审判、圣灵庇护、群体治疗）, THE Audit_Engine SHALL 验证每张事件卡的效果、费用、施放阶段在八层链路中正确实现

### 需求 5：洞穴地精阵营审计

**用户故事：** 作为开发者，我希望验证洞穴地精阵营所有能力和事件卡的实现与规则描述完全一致，以确保该阵营玩法正确。

#### 验收标准

1. WHEN Audit_Engine 检查神出鬼没（vanish）, THE Audit_Engine SHALL 验证攻击阶段与0费友方单位交换位置的完整交互链在八层链路中正确实现
2. WHEN Audit_Engine 检查鲜血符文（blood_rune）, THE Audit_Engine SHALL 验证攻击阶段开始时自伤1或花1魔力充能的二选一交互链在八层中正确实现
3. WHEN Audit_Engine 检查力量强化（power_boost for 布拉夫）, THE Audit_Engine SHALL 验证充能加成战力的被动效果在伤害计算中正确实现且与亡灵战士共享定义
4. WHEN Audit_Engine 检查魔力成瘾（magic_addiction）, THE Audit_Engine SHALL 验证回合结束花1魔力或自毁的自动触发效果在八层中正确实现
5. WHEN Audit_Engine 检查凶残（ferocity）, THE Audit_Engine SHALL 验证可作为额外攻击单位（不计入3次限制）的被动效果在攻击验证中正确实现
6. WHEN Audit_Engine 检查喂养巨食兽（feed_beast）, THE Audit_Engine SHALL 验证攻击阶段结束未击杀则吃相邻友方或自毁的完整交互链在八层中正确实现
7. WHEN Audit_Engine 检查攀爬（climb）, THE Audit_Engine SHALL 验证额外移动1格且可穿过建筑的效果在移动验证和执行中正确实现
8. WHEN Audit_Engine 检查冲锋（charge）, THE Audit_Engine SHALL 验证1-4格直线移动且3格以上+1战力的效果在移动验证和伤害计算中正确实现
9. WHEN Audit_Engine 检查禁足（immobile）, THE Audit_Engine SHALL 验证不能移动的被动效果在移动验证中正确实现
10. WHEN Audit_Engine 检查抓附（grab）, THE Audit_Engine SHALL 验证友方从相邻开始移动后可跟随的完整交互链在八层中正确实现
11. WHEN Audit_Engine 检查洞穴地精事件卡（不屈不挠、成群结队、群情激愤、潜行）, THE Audit_Engine SHALL 验证每张事件卡的效果、费用、施放阶段在八层链路中正确实现


### 需求 6：极地矮人阵营审计

**用户故事：** 作为开发者，我希望验证极地矮人阵营所有能力和事件卡的实现与规则描述完全一致，以确保该阵营玩法正确。

#### 验收标准

1. WHEN Audit_Engine 检查结构变换（structure_shift）, THE Audit_Engine SHALL 验证移动后推拉3格内友方建筑1格的完整交互链在八层链路中正确实现
2. WHEN Audit_Engine 检查寒流（cold_snap）, THE Audit_Engine SHALL 验证3格内友方建筑+1生命的被动光环效果在八层中正确实现
3. WHEN Audit_Engine 检查威势（imposing）, THE Audit_Engine SHALL 验证攻击后充能（每回合一次）的效果在八层中正确实现
4. WHEN Audit_Engine 检查寒冰碎屑（ice_shards）, THE Audit_Engine SHALL 验证建造阶段结束消耗充能对建筑相邻敌方造成1伤的完整交互链在八层中正确实现
5. WHEN Audit_Engine 检查冰霜飞弹（frost_bolt）, THE Audit_Engine SHALL 验证相邻每有一个友方建筑+1战力的被动效果在伤害计算中正确实现
6. WHEN Audit_Engine 检查高阶冰霜飞弹（greater_frost_bolt）, THE Audit_Engine SHALL 验证2格内每有一个友方建筑+1战力的被动效果在伤害计算中正确实现
7. WHEN Audit_Engine 检查践踏（trample）, THE Audit_Engine SHALL 验证穿过士兵并造成1伤的效果在移动验证和执行中正确实现
8. WHEN Audit_Engine 检查冰霜战斧（frost_axe）, THE Audit_Engine SHALL 验证移动后充能或消耗充能附加到3格内友方士兵的完整交互链在八层中正确实现
9. WHEN Audit_Engine 检查活体传送门（living_gate）, THE Audit_Engine SHALL 验证寒冰魔像视为传送门（可在其相邻召唤）的效果在召唤验证中正确实现
10. WHEN Audit_Engine 检查活体结构（mobile_structure）, THE Audit_Engine SHALL 验证寒冰魔像视为建筑但可移动的效果在移动验证和建筑相关逻辑中正确实现
11. WHEN Audit_Engine 检查缓慢（slow）, THE Audit_Engine SHALL 验证减少移动1格的效果在移动验证中正确实现
12. WHEN Audit_Engine 检查极地矮人事件卡（寒冰冲撞、冰川位移、寒冰修补、护城墙）, THE Audit_Engine SHALL 验证每张事件卡的效果、费用、施放阶段在八层链路中正确实现

### 需求 7：炽原精灵阵营审计

**用户故事：** 作为开发者，我希望验证炽原精灵阵营所有能力和事件卡的实现与规则描述完全一致，以确保该阵营玩法正确。

#### 验收标准

1. WHEN Audit_Engine 检查祖灵羁绊（ancestral_bond）, THE Audit_Engine SHALL 验证移动后充能3格内友方单位并转移自身充能的完整交互链在八层链路中正确实现
2. WHEN Audit_Engine 检查力量强化（power_up）, THE Audit_Engine SHALL 验证每点充能+1战力（最多+5）的被动效果在伤害计算中正确实现
3. WHEN Audit_Engine 检查预备（prepare）, THE Audit_Engine SHALL 验证充能代替移动（本回合未移动才可使用）的完整交互链在八层中正确实现
4. WHEN Audit_Engine 检查连续射击（rapid_fire）, THE Audit_Engine SHALL 验证攻击后消耗1充能额外攻击（每回合一次）的完整交互链在八层中正确实现
5. WHEN Audit_Engine 检查启悟（inspire）, THE Audit_Engine SHALL 验证移动后将相邻友方单位充能的效果在八层中正确实现
6. WHEN Audit_Engine 检查撤退（withdraw）, THE Audit_Engine SHALL 验证攻击后消耗1充能或1魔力推拉自身1-2格的完整交互链在八层中正确实现
7. WHEN Audit_Engine 检查威势（intimidate）, THE Audit_Engine SHALL 验证攻击后充能（每回合一次）的效果在八层中正确实现
8. WHEN Audit_Engine 检查生命强化（life_up）, THE Audit_Engine SHALL 验证每点充能+1生命（最多+5）的被动效果在生命计算中正确实现
9. WHEN Audit_Engine 检查速度强化（speed_up）, THE Audit_Engine SHALL 验证每点充能+1移动（最多+5）的被动效果在移动验证中正确实现
10. WHEN Audit_Engine 检查聚能（gather_power）, THE Audit_Engine SHALL 验证召唤后充能的效果在八层中正确实现
11. WHEN Audit_Engine 检查祖灵交流（spirit_bond）, THE Audit_Engine SHALL 验证移动后充能自身或消耗充能给3格内友方的完整交互链在八层中正确实现
12. WHEN Audit_Engine 检查炽原精灵事件卡（力量颂歌、生长颂歌、交缠颂歌、编织颂歌）, THE Audit_Engine SHALL 验证每张事件卡的效果、费用、施放阶段在八层链路中正确实现


### 需求 8：UI 交互提示友好性审查

**用户故事：** 作为玩家，我希望所有需要交互的能力都有清晰友好的操作提示，以便我理解当前可以执行的操作。

#### 验收标准

1. WHEN 玩家激活需要选择目标的能力, THE UI_Hint SHALL 显示清晰的操作提示说明需要选择什么目标
2. WHEN 玩家面临二选一决策（如鲜血符文、祖灵交流）, THE UI_Hint SHALL 显示两个选项的明确描述
3. WHEN 玩家可以选择取消操作（如预备代替移动）, THE UI_Hint SHALL 显示取消选项和操作后果说明
4. WHEN 能力有前置条件不满足（如充能不足、无合法目标）, THE UI_Hint SHALL 显示禁用状态和原因说明
5. WHEN 被动能力自动触发（如血腥狂怒充能、献祭伤害）, THE UI_Hint SHALL 通过视觉反馈告知玩家效果已触发
6. WHEN 攻击后触发可选能力（如念力推拉、灵魂转移）, THE UI_Hint SHALL 显示确认/跳过选项和操作说明
7. WHEN 事件卡需要选择目标（如歼灭、心灵操控）, THE UI_Hint SHALL 显示目标选择提示和合法目标高亮

### 需求 9：审计反模式与数据查询一致性检查

**用户故事：** 作为开发者，我希望审计过程严格遵循反模式清单和数据查询一致性规范，避免遗漏已知的常见错误模式。

#### 验收标准

1. WHEN Audit_Engine 审查任何"可以/可选"效果, THE Audit_Engine SHALL 验证实现包含玩家确认 UI（确认/跳过按钮），禁止自动执行（Anti_Pattern #1）
2. WHEN Audit_Engine 审查测试层, THE Audit_Engine SHALL 验证测试覆盖"命令→事件→状态变更"全链路，事件发射 ≠ 状态生效，仅断言事件发射不可标 ✅（Anti_Pattern #2, #4）
3. WHEN Audit_Engine 审查代码, THE Audit_Engine SHALL grep `as any` 并逐个验证是否绕过类型检查访问不存在的字段（Anti_Pattern #3）
4. WHEN Audit_Engine 审查描述含限定条件的能力, THE Audit_Engine SHALL 验证限定词在执行路径全程被强制约束（Constraint_Enforcement），仅在入口做前置检查但执行时不约束 = ❌（Anti_Pattern #9）
5. WHEN Audit_Engine 完成八层链路审查后, THE Audit_Engine SHALL 执行数据查询一致性审查：grep `\.card\.abilities`、`\.card\.strength`、`\.card\.life` 的直接访问，排除合法场景后确认所有消费点走统一查询入口（Anti_Pattern #5, #6, #7）
6. WHEN Audit_Engine grep 数据查询一致性, THE Audit_Engine SHALL 范围必须包含 `.tsx` 文件，UI 层是最常见的绕过位置（Anti_Pattern #10）

### 需求 10：已知问题修复

**用户故事：** 作为开发者，我希望修复之前审计发现的4个低严重度问题，以提升代码质量。

#### 验收标准

1. WHEN 检查 useGameEvents.ts 第300行附近, THE Audit_Engine SHALL 确认遗留调试日志 [rapid_fire-debug] 已被清理
2. WHEN 检查感染（infection）验证逻辑, THE Audit_Engine SHALL 确认疫病体判断使用 ID 常量而非字符串匹配
3. WHEN 检查交缠颂歌（chant_of_entanglement）共享逻辑, THE Audit_Engine SHALL 确认技能共享读取 getUnitAbilities（含 tempAbilities）而非仅 card.abilities
4. WHEN 检查念力推拉在对角线目标时的方向选择, THE Audit_Engine SHALL 确认方向自动选择逻辑合理或提供玩家选择

### 需求 11：交叉影响检查

**用户故事：** 作为开发者，我希望验证不同阵营的能力之间不存在意外的交叉影响，以确保跨阵营对战的正确性。

#### 验收标准

1. WHEN 两个阵营对战时, THE Audit_Engine SHALL 验证共享技能 ID（如 power_boost、entangle/rebound）在不同阵营单位上正确独立工作
2. WHEN 控制权转移（心灵捕获、心灵操控）发生时, THE Audit_Engine SHALL 验证被控制单位的能力在新控制者下正确触发
3. WHEN 临时能力（幻化复制、交缠共享、力量颂歌授予）与永久能力叠加时, THE Audit_Engine SHALL 验证能力叠加和清理逻辑正确
4. WHEN 推拉效果（念力、高阶念力、震慑、结构变换）与稳固（stable）交互时, THE Audit_Engine SHALL 验证免疫逻辑在所有推拉来源中一致生效
