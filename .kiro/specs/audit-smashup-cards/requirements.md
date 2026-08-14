# 需求文档：大杀四方全卡牌与基地全链路审查

## 简介

对大杀四方（Smash Up）游戏的所有卡牌和基地进行系统性的「描述→实现全链路审查」，确保每张卡牌/基地的代码实现与 i18n effectText/abilityText 规则描述完全一致。审查范围覆盖 8 个基础派系、4 个克苏鲁扩展派系、4 个 Awesome Level 9000 扩展派系，以及所有基地卡。

## 术语表

- **全链路审查**：按 `.spec/knowledge/standards/engine-systems.md`「描述→实现全链路审查规范」执行的六层审查流程
- **独立交互链**：任何需要独立触发条件、玩家输入或状态变更路径的效果，作为审查的原子单位
- **六层**：定义层、执行层、状态层、验证层、UI 层、测试层
- **审查矩阵**：独立交互链 × 六层的交叉表，每个交叉点标注 ✅/❌ 及具体证据
- **effectText**：i18n 文件中行动卡的效果描述文本
- **abilityText**：i18n 文件中随从卡/基地卡的能力描述文本
- **Ability_Registry**：`src/games/smashup/domain/abilityRegistry.ts` 中的能力注册表
- **Base_Ability_Registry**：`src/games/smashup/domain/baseAbilities.ts` 中的基地能力注册表
- **Interaction_Handler**：处理玩家交互选择的回调函数，注册在各派系的 `registerXxxInteractionHandlers()` 中

## 需求

### 需求 1：外星人（Aliens）派系审查

**用户故事：** 作为开发者，我想审查外星人派系所有卡牌的实现，以确保每张卡的代码行为与规则描述一致。

#### 验收标准

1. WHEN 审查外星人派系时，THE 审查者 SHALL 对照 `public/locales/zh-CN/game-smashup.json` 中 `alien_*` 的 effectText/abilityText 与 `src/games/smashup/abilities/aliens.ts` 中的实现逐张比对
2. WHEN 发现卡牌描述中包含玩家选择流程时，THE 审查者 SHALL 验证对应的 Interaction_Handler 已注册且选择逻辑完整
3. WHEN 发现卡牌描述中包含持续效果时，THE 审查者 SHALL 验证 `ongoingModifiers.ts` 或 `ongoingEffects.ts` 中已注册对应的持续效果处理
4. WHEN 审查完成时，THE 审查者 SHALL 输出独立交互链 × 六层审查矩阵，每个交叉点标注 ✅/❌ 及具体证据（文件名+函数名）
5. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 2：恐龙（Dinosaurs）派系审查

**用户故事：** 作为开发者，我想审查恐龙派系所有卡牌的实现，以确保每张卡的代码行为与规则描述一致。

#### 验收标准

1. WHEN 审查恐龙派系时，THE 审查者 SHALL 对照 i18n 中 `dino_*` 的描述与 `src/games/smashup/abilities/dinosaurs.ts` 中的实现逐张比对
2. WHEN 发现卡牌描述中包含持续效果（如重装剑龙的回合外+2力量）时，THE 审查者 SHALL 验证持续力量修正在 `ongoingModifiers.ts` 中正确注册
3. WHEN 审查完成时，THE 审查者 SHALL 输出独立交互链 × 六层审查矩阵
4. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 3：幽灵（Ghosts）派系审查

**用户故事：** 作为开发者，我想审查幽灵派系所有卡牌的实现，以确保每张卡的代码行为与规则描述一致。

#### 验收标准

1. WHEN 审查幽灵派系时，THE 审查者 SHALL 对照 i18n 中 `ghost_*` 的描述与 `src/games/smashup/abilities/ghosts.ts` 中的实现逐张比对
2. WHEN 发现卡牌描述中包含条件触发（如"手牌2张或更少"）时，THE 审查者 SHALL 验证条件判断逻辑在执行层和验证层均正确实现
3. WHEN 发现异能（special）类型能力时，THE 审查者 SHALL 验证触发时机和触发条件的实现
4. WHEN 审查完成时，THE 审查者 SHALL 输出独立交互链 × 六层审查矩阵
5. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 4：忍者（Ninjas）派系审查

**用户故事：** 作为开发者，我想审查忍者派系所有卡牌的实现，以确保每张卡的代码行为与规则描述一致。

#### 验收标准

1. WHEN 审查忍者派系时，THE 审查者 SHALL 对照 i18n 中 `ninja_*` 的描述与 `src/games/smashup/abilities/ninjas.ts` 中的实现逐张比对
2. WHEN 发现特殊（special）触发时机（如"基地计分前"）时，THE 审查者 SHALL 验证触发钩子在计分流程中正确调用
3. WHEN 审查完成时，THE 审查者 SHALL 输出独立交互链 × 六层审查矩阵
4. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 5：海盗（Pirates）派系审查

**用户故事：** 作为开发者，我想审查海盗派系所有卡牌的实现，以确保每张卡的代码行为与规则描述一致。

#### 验收标准

1. WHEN 审查海盗派系时，THE 审查者 SHALL 对照 i18n 中 `pirate_*` 的描述与 `src/games/smashup/abilities/pirates.ts` 中的实现逐张比对
2. WHEN 发现特殊（special）触发时机（如"将要被消灭时"、"基地计分前/后"）时，THE 审查者 SHALL 验证触发钩子正确实现
3. WHEN 审查完成时，THE 审查者 SHALL 输出独立交互链 × 六层审查矩阵
4. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 6：机器人（Robots）派系审查

**用户故事：** 作为开发者，我想审查机器人派系所有卡牌的实现，以确保每张卡的代码行为与规则描述一致。

#### 验收标准

1. WHEN 审查机器人派系时，THE 审查者 SHALL 对照 i18n 中 `robot_*` 的描述与 `src/games/smashup/abilities/robots.ts` 中的实现逐张比对
2. WHEN 发现微型机（Microbot）相关的联动效果时，THE 审查者 SHALL 验证"视为微型机"和"微型机数量加成"等联动逻辑正确实现
3. WHEN 审查完成时，THE 审查者 SHALL 输出独立交互链 × 六层审查矩阵
4. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 7：捣蛋鬼（Tricksters）派系审查

**用户故事：** 作为开发者，我想审查捣蛋鬼派系所有卡牌的实现，以确保每张卡的代码行为与规则描述一致。

#### 验收标准

1. WHEN 审查捣蛋鬼派系时，THE 审查者 SHALL 对照 i18n 中 `trickster_*` 的描述与 `src/games/smashup/abilities/tricksters.ts` 中的实现逐张比对
2. WHEN 发现持续触发效果（如"当其他玩家打出随从到此基地时"）时，THE 审查者 SHALL 验证触发钩子和持续效果注册正确
3. WHEN 审查完成时，THE 审查者 SHALL 输出独立交互链 × 六层审查矩阵
4. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 8：巫师（Wizards）派系审查

**用户故事：** 作为开发者，我想审查巫师派系所有卡牌的实现，以确保每张卡的代码行为与规则描述一致。

#### 验收标准

1. WHEN 审查巫师派系时，THE 审查者 SHALL 对照 i18n 中 `wizard_*` 的描述与 `src/games/smashup/abilities/wizards.ts` 中的实现逐张比对
2. WHEN 发现多步交互流程（如传送的"选择任意数量随从"）时，THE 审查者 SHALL 验证 Interaction_Handler 提供了完整的玩家选择流程
3. WHEN 审查完成时，THE 审查者 SHALL 输出独立交互链 × 六层审查矩阵
4. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 9：僵尸（Zombies）派系审查

**用户故事：** 作为开发者，我想审查僵尸派系所有卡牌的实现，以确保每张卡的代码行为与规则描述一致。

#### 验收标准

1. WHEN 审查僵尸派系时，THE 审查者 SHALL 对照 i18n 中 `zombie_*` 的描述与 `src/games/smashup/abilities/zombies.ts` 中的实现逐张比对
2. WHEN 发现从弃牌堆打出/复活的能力时，THE 审查者 SHALL 验证弃牌堆操作和额外打出逻辑正确实现
3. WHEN 审查完成时，THE 审查者 SHALL 输出独立交互链 × 六层审查矩阵
4. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 10：克苏鲁仆从（Cthulhu）派系审查

**用户故事：** 作为开发者，我想审查克苏鲁仆从派系所有卡牌的实现，以确保每张卡的代码行为与规则描述一致。

#### 验收标准

1. WHEN 审查克苏鲁仆从派系时，THE 审查者 SHALL 对照 i18n 中 `cthulhu_*` 的描述与 `src/games/smashup/abilities/cthulhu.ts` 中的实现逐张比对
2. WHEN 发现疯狂卡（Madness）相关操作时，THE 审查者 SHALL 验证疯狂卡的抽取、弃置、返还逻辑正确实现
3. WHEN 审查完成时，THE 审查者 SHALL 输出独立交互链 × 六层审查矩阵
4. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 11：熊骑兵（Bear Cavalry）派系审查

**用户故事：** 作为开发者，我想审查熊骑兵派系所有卡牌的实现，以确保每张卡的代码行为与规则描述一致。

#### 验收标准

1. WHEN 审查熊骑兵派系时，THE 审查者 SHALL 对照 i18n 中 `bear_cavalry_*` 的描述与 `src/games/smashup/abilities/bear_cavalry.ts` 中的实现逐张比对
2. WHEN 发现强制移动对手随从的效果时，THE 审查者 SHALL 验证移动目标选择和移动执行逻辑正确实现
3. WHEN 审查完成时，THE 审查者 SHALL 输出独立交互链 × 六层审查矩阵
4. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 12：蒸汽朋克（Steampunks）派系审查

**用户故事：** 作为开发者，我想审查蒸汽朋克派系所有卡牌的实现，以确保每张卡的代码行为与规则描述一致。

#### 验收标准

1. WHEN 审查蒸汽朋克派系时，THE 审查者 SHALL 对照 i18n 中 `steampunk_*` 的描述与 `src/games/smashup/abilities/steampunks.ts` 中的实现逐张比对
2. WHEN 发现战术卡回收/重打效果时，THE 审查者 SHALL 验证从弃牌堆取回战术并作为额外战术打出的完整流程
3. WHEN 审查完成时，THE 审查者 SHALL 输出独立交互链 × 六层审查矩阵
4. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 13：食人花（Killer Plants）派系审查

**用户故事：** 作为开发者，我想审查食人花派系所有卡牌的实现，以确保每张卡的代码行为与规则描述一致。

#### 验收标准

1. WHEN 审查食人花派系时，THE 审查者 SHALL 对照 i18n 中 `killer_plant_*` 的描述与 `src/games/smashup/abilities/killer_plants.ts` 中的实现逐张比对
2. WHEN 发现从牌库搜寻随从的效果时，THE 审查者 SHALL 验证搜寻条件（如力量限制）和重洗牌库逻辑正确实现
3. WHEN 审查完成时，THE 审查者 SHALL 输出独立交互链 × 六层审查矩阵
4. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 14：远古物种（Elder Things）派系审查

**用户故事：** 作为开发者，我想审查远古物种派系所有卡牌的实现，以确保每张卡的代码行为与规则描述一致。

#### 验收标准

1. WHEN 审查远古物种派系时，THE 审查者 SHALL 对照 i18n 中 `elder_thing_*` 的描述与 `src/games/smashup/abilities/elder_things.ts` 中的实现逐张比对
2. WHEN 发现"其他玩家可以选择抽疯狂卡或承受惩罚"的二选一效果时，THE 审查者 SHALL 验证选择交互和两个分支的执行逻辑均正确实现
3. WHEN 审查完成时，THE 审查者 SHALL 输出独立交互链 × 六层审查矩阵
4. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 15：印斯茅斯（Innsmouth）派系审查

**用户故事：** 作为开发者，我想审查印斯茅斯派系所有卡牌的实现，以确保每张卡的代码行为与规则描述一致。

#### 验收标准

1. WHEN 审查印斯茅斯派系时，THE 审查者 SHALL 对照 i18n 中 `innsmouth_*` 的描述与 `src/games/smashup/abilities/innsmouth.ts` 中的实现逐张比对
2. WHEN 发现"同名随从"相关效果时，THE 审查者 SHALL 验证同名判断逻辑（基于 defId）正确实现
3. WHEN 审查完成时，THE 审查者 SHALL 输出独立交互链 × 六层审查矩阵
4. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 16：米斯卡塔尼克（Miskatonic University）派系审查

**用户故事：** 作为开发者，我想审查米斯卡塔尼克派系所有卡牌的实现，以确保每张卡的代码行为与规则描述一致。

#### 验收标准

1. WHEN 审查米斯卡塔尼克派系时，THE 审查者 SHALL 对照 i18n 中 `miskatonic_*` 的描述与 `src/games/smashup/abilities/miskatonic.ts` 中的实现逐张比对
2. WHEN 发现疯狂卡弃置换取效果的能力时，THE 审查者 SHALL 验证疯狂卡检测、弃置和效果触发的完整流程
3. WHEN 审查完成时，THE 审查者 SHALL 输出独立交互链 × 六层审查矩阵
4. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 17：基地卡全链路审查

**用户故事：** 作为开发者，我想审查所有基地卡的实现，以确保每张基地的能力代码与规则描述一致。

#### 验收标准

1. WHEN 审查基地卡时，THE 审查者 SHALL 对照 i18n 中 `base_*` 的 abilityText 与 `src/games/smashup/domain/baseAbilities.ts` 和 `baseAbilities_expansion.ts` 中的实现逐张比对
2. WHEN 发现基地能力包含计分时触发（如"计分后冠军可以…"）时，THE 审查者 SHALL 验证计分流程中的触发钩子和冠军/亚军判定逻辑正确实现
3. WHEN 发现基地能力包含持续效果（如"每当有随从打出到这里"）时，THE 审查者 SHALL 验证事件监听和持续效果注册正确
4. WHEN 发现基地能力包含限制效果（如"不能打出随从/战术到这里"）时，THE 审查者 SHALL 验证验证层（validate）正确拦截被禁止的操作
5. WHEN 审查完成时，THE 审查者 SHALL 输出独立交互链 × 六层审查矩阵
6. IF 发现实现缺失或与描述不一致，THEN THE 审查者 SHALL 记录具体差异并标注修复建议

### 需求 18：审查结果汇总

**用户故事：** 作为开发者，我想获得所有审查结果的汇总报告，以便快速了解整体实现质量和需要修复的问题。

#### 验收标准

1. WHEN 所有派系和基地审查完成后，THE 审查者 SHALL 生成一份汇总报告，列出所有发现的问题
2. THE 汇总报告 SHALL 按严重程度分类：缺失实现（❌ 无代码）、实现偏差（⚠️ 有代码但行为不一致）、测试缺失（📝 功能正确但无测试覆盖）
3. THE 汇总报告 SHALL 包含每个派系的审查通过率（✅ 数量 / 总交互链数量）
4. THE 汇总报告 SHALL 按修复优先级排序：影响游戏正确性的问题优先于测试缺失
