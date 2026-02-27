# 需求文档：召唤师战争 D11-D33 维度审计

## 简介

对召唤师战争（SummonerWars, gameId=summonerwars）进行 D11-D33 维度的系统性审计。本次是对已完成两轮审计的补充：v1 覆盖 D1-D5，v2 覆盖 D6-D10。本次不重复已审过的维度。

### 维度适用性评估

| 维度 | 适用性 | 理由 |
|------|--------|------|
| D11 Reducer 消耗路径 | ✅ 高 | reduce.ts 有多种资源消耗分支（魔力、充能、extraAttacks、moveCount） |
| D12 写入-消耗对称 | ✅ 高 | 多个事件写入字段（extraAttacks、boosts、tempAbilities、attachedCards、wasAttackedThisTurn） |
| D13 多来源竞争 | ⚠️ 中 | 充能有多个写入来源（blood_rage、frost_axe、ancestral_bond） |
| D14 回合清理完整 | ✅ 高 | 大量临时状态需回合清理 |
| D15 UI 状态同步 | ✅ 中 | UI 需正确展示生命值/攻击力/移动增强/充能 |
| D16 条件优先级 | ✅ 高 | validate.ts 和 reduce.ts 有多分支条件链 |
| D17 隐式依赖 | ✅ 高 | FlowHooks 阶段触发器依赖执行顺序 |
| D18 否定路径 | ✅ 中 | 额外攻击/治疗模式/充能转移的隔离测试 |
| D19 组合场景 | ✅ 高 | 跨阵营对战时多种机制组合（治疗+交缠、心灵捕获+献祭等） |
| D20 状态可观测性 | ❌ 低 | UI 已有基本展示，跳过 |
| D21 触发频率门控 | ✅ 高 | afterAttack 触发器需验证 usesPerTurn 限制 |
| D22 伤害计算管线 | ❌ 不适用 | 使用自研骰子伤害系统 |
| D23 架构假设一致性 | ✅ 高 | canAttackEnhanced 硬编码、validate.ts 阶段检查 |
| D24 Handler 共返状态 | ⚠️ 低 | 交互 handler 较少同时返回 events+interaction |
| D25 MatchState 传播 | ✅ 高 | 多个能力创建交互 |
| D26 事件设计完整性 | ❌ 低 | 事件类型已稳定 |
| D27 可选参数语义 | ✅ 中 | 多个函数有可选参数影响正确性 |
| D28 白名单完整性 | ✅ 高 | CONFIRMABLE_PHASE_END_ABILITIES 等白名单 |
| D29 PPSE 事件替换 | ❌ 不适用 | 未使用该模式 |
| D30 消灭流程时序 | ✅ 高 | postProcessDeathChecks 有消灭触发器链 |
| D31 效果拦截路径 | ⚠️ 低 | divine_shield 有拦截逻辑 |
| D32 替代路径后处理 | ✅ 高 | 攻击流程有多条路径（正常/治疗/远程/践踏） |
| D33 跨实体同类能力 | ✅ 高 | 6个阵营的同类能力需验证实现路径一致 |

## 术语表

- **审查系统**: 执行本次审查的 AI 代理与测试框架的组合
- **Reducer**: reduce.ts 中的 reduceEvent 函数
- **FlowHooks**: 阶段流转钩子（flowHooks.ts）
- **GameTestRunner**: 引擎层行为测试工具（命令序列+状态断言）
- **postProcessDeathChecks**: 命令执行后的死亡检测后处理
- **canAttackEnhanced**: helpers.ts 中的增强攻击验证函数
- **abilityUsageCount**: 技能使用次数追踪（回合结束清空）
- **CONFIRMABLE_PHASE_END_ABILITIES**: flowHooks.ts 中需要玩家确认的阶段结束技能白名单
- **extraAttacks**: BoardUnit 上的额外攻击次数字段
- **tempAbilities**: BoardUnit 上的临时技能列表（回合结束清除）
- **AbilityExecutorRegistry**: 引擎层能力执行器注册表


## 需求

### 需求 1：Reducer 消耗路径审计（D11）

**用户故事：** 作为开发者，我希望验证 reduce.ts 中所有资源消耗分支逻辑正确，以确保写入的资源在消耗时走正确的分支。

#### 验收标准

1. WHEN extraAttacks 被授予（连续射击/群情激愤） THEN THE 审查系统 SHALL 验证 CONFIRM_ATTACK reducer 正确消耗 extraAttacks（递减而非清零），且不影响正常 attackCount
2. WHEN 魔力消耗发生（建造/召唤/事件卡/blood_rune/magic_addiction） THEN THE 审查系统 SHALL 验证每种消耗路径的条件分支正确，且 clampMagic 在所有路径生效
3. WHEN 充能消耗发生（ice_shards/frost_axe/ancestral_bond/funeral_pyre/holy_judgment） THEN THE 审查系统 SHALL 验证充能递减分支正确，且充能不低于 0
4. WHEN 移动次数消耗发生 THEN THE 审查系统 SHALL 验证 moveCount 递增正确，且额外移动不消耗正常移动次数
5. THE 审查系统 SHALL 使用 GameTestRunner 构造"授予 extraAttacks 后连续攻击"场景，断言每次攻击正确递减 extraAttacks 且 attackCount 不变

### 需求 2：写入-消耗对称审计（D12）

**用户故事：** 作为开发者，我希望验证所有事件写入的字段在消费点被正确读取，写入路径和消耗路径条件分支对称。

#### 验收标准

1. WHEN extraAttacks 被写入 THEN THE 审查系统 SHALL 验证 validate.ts 中 DECLARE_ATTACK 正确读取 extraAttacks，且 UI 正确展示额外攻击可用
2. WHEN tempAbilities 被写入（幻化复制） THEN THE 审查系统 SHALL 验证 getUnitAbilities 正确合并 tempAbilities，且 TURN_CHANGED 正确清除
3. WHEN attachedCards 被写入（狱火铸剑） THEN THE 审查系统 SHALL 验证攻击力计算正确读取加成，且单位被消灭时 attachedCards 同步弃置
4. WHEN boosts 被写入 THEN THE 审查系统 SHALL 验证攻击力计算正确读取 boosts，且 UI 正确展示增益标记
5. WHEN wasAttackedThisTurn 被写入 THEN THE 审查系统 SHALL 验证庇护能力正确读取该字段，且 TURN_CHANGED 正确清除
6. IF reducer 操作范围超出 payload 声明范围 THEN THE 审查系统 SHALL 标记为 D12 违规

### 需求 3：回合清理完整性审计（D14）

**用户故事：** 作为开发者，我希望验证回合结束时所有临时状态被正确清理，防止状态泄漏到下回合。

#### 验收标准

1. WHEN TURN_CHANGED 被 reduce THEN THE 审查系统 SHALL 验证以下字段全部重置：hasMoved、hasAttacked、extraAttacks、moveCount、attackCount、hasAttackedEnemy、abilityUsageCount、unitKillCountThisTurn
2. WHEN TURN_CHANGED 被 reduce THEN THE 审查系统 SHALL 验证 tempAbilities、healingMode、wasAttackedThisTurn 被清除
3. WHEN TURN_CHANGED 被 reduce THEN THE 审查系统 SHALL 验证 mind_control 控制权归还（originalOwner 恢复）
4. THE 审查系统 SHALL 使用 GameTestRunner 构造完整回合，断言回合切换后所有临时字段已重置
5. THE 审查系统 SHALL 使用 Property 测试列出 BoardUnit 和 PlayerState 上所有可选/临时字段，验证每个字段在 TURN_CHANGED reducer 中有对应清理逻辑


### 需求 4：条件优先级与隐式依赖审计（D16 + D17）

**用户故事：** 作为开发者，我希望验证多分支条件链优先级正确，且功能不依赖未显式检查的调用顺序。

#### 验收标准

1. WHEN DECLARE_ATTACK 验证执行 THEN THE 审查系统 SHALL 验证阶段检查、攻击次数检查、extraAttacks 检查、治疗模式检查的优先级正确
2. WHEN MOVE_UNIT 验证执行 THEN THE 审查系统 SHALL 验证阶段检查、移动次数检查、immobile 检查、路径检查的优先级正确
3. WHEN FlowHooks 的 onPhaseExit 和 onPhaseEnter 执行 THEN THE 审查系统 SHALL 验证阶段触发器不依赖"恰好在某个事件之后执行"的隐式顺序
4. WHEN postProcessDeathChecks 执行 THEN THE 审查系统 SHALL 验证死亡检测不依赖事件处理的特定顺序

### 需求 5：否定路径审计（D18）

**用户故事：** 作为开发者，我希望验证"不应该发生"的场景被正确阻止。

#### 验收标准

1. WHEN extraAttacks 被消耗 THEN THE 审查系统 SHALL 验证正常 attackCount 不受影响（否定：额外攻击不消耗正常攻击次数）
2. WHEN 治疗模式攻击执行 THEN THE 审查系统 SHALL 验证治疗只对友方生效（否定：治疗模式不对敌方造成治疗效果）
3. WHEN 充能转移执行（ancestral_bond） THEN THE 审查系统 SHALL 验证源单位减少量等于目标单位增加量（否定：转移不凭空创造或消灭充能）
4. WHEN 玩家 A 的临时状态变化 THEN THE 审查系统 SHALL 验证玩家 B 的状态不受影响（玩家隔离）

### 需求 6：多来源竞争审计（D13）

**用户故事：** 作为开发者，我希望验证同一资源有多个写入来源时消耗逻辑正确区分来源。

#### 验收标准

1. WHEN 充能有多个来源（blood_rage 自动充能 + ancestral_bond 转移充能） THEN THE 审查系统 SHALL 验证充能叠加规则正确（累加而非覆盖）
2. WHEN 多个能力同时修改同一单位的 boosts THEN THE 审查系统 SHALL 验证 boosts 值正确累加
3. WHEN 多个事件卡同时生效（activeEvents 中有多张） THEN THE 审查系统 SHALL 验证各事件卡效果独立生效不互相干扰

### 需求 7：组合场景审计（D19）— 运行时行为测试

**用户故事：** 作为开发者，我希望验证两个独立正确的机制组合使用时仍然正确。

#### 验收标准

1. WHEN 治疗模式（圣殿牧师）+ 交缠（交缠颂歌）同时生效 THEN THE 审查系统 SHALL 使用 GameTestRunner 验证治疗攻击是否正确触发交缠效果
2. WHEN 心灵捕获（欺心巫族）+ 献祭（蛮族）同时存在 THEN THE 审查系统 SHALL 使用 GameTestRunner 验证被控制单位被消灭时献祭触发器的归属判定正确
3. WHEN 群情激愤（事件卡）+ extraAttacks 同时生效 THEN THE 审查系统 SHALL 使用 GameTestRunner 验证跨阶段攻击与额外攻击次数的交互正确
4. WHEN 冰霜战斧（attachedUnits）+ 单位被消灭 THEN THE 审查系统 SHALL 使用 GameTestRunner 验证附加单位卡同步弃置且魔力归属正确
5. WHEN 幻化复制（tempAbilities）+ 原单位被消灭 THEN THE 审查系统 SHALL 使用 GameTestRunner 验证复制的技能在原单位消灭后仍正常工作直到回合结束

### 需求 8：触发频率门控审计（D21）— 运行时行为测试

**用户故事：** 作为开发者，我希望验证触发型技能有正确的使用次数限制。

#### 验收标准

1. WHEN afterAttack 触发器执行（telekinesis/soul_transfer/rapid_fire/fortress_power） THEN THE 审查系统 SHALL 验证每个触发器有 usesPerTurn 或等效限制，防止无限重复使用
2. WHEN 阶段触发器执行（guidance/illusion/blood_rune） THEN THE 审查系统 SHALL 验证每个阶段触发器在同一阶段内不重复触发
3. THE 审查系统 SHALL 使用 GameTestRunner 构造"同一单位连续攻击两次"场景，断言 afterAttack 触发器在第二次攻击后不再触发（如有 usesPerTurn=1）
4. THE 审查系统 SHALL 使用 Property 测试 grep 所有 trigger 非 activated/passive 的技能定义，验证每个都有频率限制或在白名单中

### 需求 9：架构假设一致性审计（D23）— 运行时行为测试

**用户故事：** 作为开发者，我希望验证底层架构的硬编码假设不阻止特殊语义实现。

#### 验收标准

1. WHEN canAttackEnhanced 执行 THEN THE 审查系统 SHALL 验证治疗模式（healingMode）能正确绕过"禁止攻击友军"的硬编码约束
2. WHEN validate.ts 阶段检查执行 THEN THE 审查系统 SHALL 验证群情激愤（rallying_cry）能正确绕过"攻击只能在攻击阶段"的硬编码约束
3. WHEN canMoveTo 路径检查执行 THEN THE 审查系统 SHALL 验证飞行/穿越能力能正确绕过路径阻挡检查
4. THE 审查系统 SHALL 使用 GameTestRunner 构造"治疗模式攻击友军"场景，断言攻击命令被 validate 接受且正确执行治疗效果
5. THE 审查系统 SHALL 列出所有底层验证函数中的硬编码约束，对每个约束检查是否有描述中的反例需要绕过


### 需求 4：条件优先级与隐式依赖审计（D16 + D17）

**用户故事：** 作为开发者，我希望验证多分支条件链优先级正确，且功能不依赖未显式检查的调用顺序。

#### 验收标准

1. WHEN DECLARE_ATTACK 验证执行 THEN THE 审查系统 SHALL 验证阶段检查、攻击次数检查、extraAttacks 检查、治疗模式检查的优先级正确
2. WHEN MOVE_UNIT 验证执行 THEN THE 审查系统 SHALL 验证阶段检查、移动次数检查、immobile 检查、路径检查的优先级正确
3. WHEN FlowHooks 的 onPhaseExit 和 onPhaseEnter 执行 THEN THE 审查系统 SHALL 验证阶段触发器不依赖隐式执行顺序
4. WHEN postProcessDeathChecks 执行 THEN THE 审查系统 SHALL 验证死亡检测不依赖事件处理的特定顺序

### 需求 5：否定路径审计（D18）

**用户故事：** 作为开发者，我希望验证"不应该发生"的场景被正确阻止。

#### 验收标准

1. WHEN extraAttacks 被消耗 THEN THE 审查系统 SHALL 验证正常 attackCount 不受影响
2. WHEN 治疗模式攻击执行 THEN THE 审查系统 SHALL 验证治疗只对友方生效
3. WHEN 充能转移执行（ancestral_bond） THEN THE 审查系统 SHALL 验证源单位减少量等于目标单位增加量
4. WHEN 玩家 A 的临时状态变化 THEN THE 审查系统 SHALL 验证玩家 B 的状态不受影响

### 需求 6：多来源竞争审计（D13）

**用户故事：** 作为开发者，我希望验证同一资源有多个写入来源时消耗逻辑正确。

#### 验收标准

1. WHEN 充能有多个来源（blood_rage + ancestral_bond） THEN THE 审查系统 SHALL 验证充能叠加规则正确
2. WHEN 多个能力同时修改同一单位的 boosts THEN THE 审查系统 SHALL 验证 boosts 正确累加
3. WHEN 多个事件卡同时生效 THEN THE 审查系统 SHALL 验证各事件卡效果独立生效

### 需求 7：组合场景审计（D19）— GameTestRunner 运行时行为测试

**用户故事：** 作为开发者，我希望验证两个独立正确的机制组合使用时仍然正确。

#### 验收标准

1. THE 审查系统 SHALL 使用 GameTestRunner 验证治疗模式 + 交缠同时生效时的交互正确
2. THE 审查系统 SHALL 使用 GameTestRunner 验证心灵捕获 + 献祭同时存在时消灭归属判定正确
3. THE 审查系统 SHALL 使用 GameTestRunner 验证群情激愤 + extraAttacks 的跨阶段攻击交互正确
4. THE 审查系统 SHALL 使用 GameTestRunner 验证冰霜战斧 + 单位消灭时附加卡同步弃置
5. THE 审查系统 SHALL 使用 GameTestRunner 验证幻化复制 + 原单位消灭后复制技能仍工作

### 需求 8：触发频率门控审计（D21）— GameTestRunner 运行时行为测试

**用户故事：** 作为开发者，我希望验证触发型技能有正确的使用次数限制。

#### 验收标准

1. THE 审查系统 SHALL 验证每个 afterAttack 触发器有 usesPerTurn 或等效限制
2. THE 审查系统 SHALL 验证阶段触发器在同一阶段内不重复触发
3. THE 审查系统 SHALL 使用 GameTestRunner 构造"同一单位连续攻击两次"场景，断言 afterAttack 触发器频率限制生效
4. THE 审查系统 SHALL 使用 Property 测试 grep 所有触发型技能定义，验证频率限制覆盖

### 需求 9：架构假设一致性审计（D23）— GameTestRunner 运行时行为测试

**用户故事：** 作为开发者，我希望验证底层硬编码假设不阻止特殊语义实现。

#### 验收标准

1. THE 审查系统 SHALL 使用 GameTestRunner 验证治疗模式能绕过 canAttackEnhanced 的友军限制
2. THE 审查系统 SHALL 使用 GameTestRunner 验证群情激愤能绕过 validate.ts 的阶段限制
3. THE 审查系统 SHALL 使用 GameTestRunner 验证飞行/穿越能力能绕过路径阻挡检查
4. THE 审查系统 SHALL 列出所有底层验证函数的硬编码约束，检查是否有描述反例需要绕过

### 需求 10：MatchState 传播与可选参数审计（D25 + D27）

**用户故事：** 作为开发者，我希望验证创建交互的能力在调用链中正确传递 matchState。

#### 验收标准

1. THE 审查系统 SHALL grep 所有 createSimpleChoice/queueInteraction 调用点，验证 matchState 传递正确
2. THE 审查系统 SHALL 使用 GameTestRunner 通过完整命令链路触发交互创建，断言交互被正确排队
3. WHEN 可选参数在运行时为 undefined THEN THE 审查系统 SHALL 验证函数有合理降级行为

### 需求 11：白名单完整性审计（D28）

**用户故事：** 作为开发者，我希望验证所有白名单覆盖所有已知场景。

#### 验收标准

1. THE 审查系统 SHALL 验证 CONFIRMABLE_PHASE_END_ABILITIES 包含所有需确认的阶段结束技能
2. THE 审查系统 SHALL grep 所有 trigger='onPhaseEnd' 且描述含"你可以" 的技能，验证都在白名单中
3. THE 审查系统 SHALL 验证每个白名单定义处有注释说明加入条件

### 需求 12：消灭流程时序审计（D30）— GameTestRunner 运行时行为测试

**用户故事：** 作为开发者，我希望验证消灭触发器链的时序正确。

#### 验收标准

1. THE 审查系统 SHALL 使用 GameTestRunner 验证 onDestroy 触发器在确认消灭后执行
2. THE 审查系统 SHALL 使用 GameTestRunner 验证连锁消灭递归处理正确且无无限循环
3. THE 审查系统 SHALL 使用 GameTestRunner 验证 divine_shield 拦截后 onDestroy 不执行

### 需求 13：替代路径后处理对齐审计（D32）— GameTestRunner 运行时行为测试

**用户故事：** 作为开发者，我希望验证攻击流程所有路径的后处理检查集一致。

#### 验收标准

1. THE 审查系统 SHALL 列出攻击流程所有路径：正常近战、远程、治疗模式、践踏、额外攻击
2. THE 审查系统 SHALL 提取规范路径的后处理检查集并逐条比对替代路径
3. THE 审查系统 SHALL 使用 GameTestRunner 验证远程攻击后 afterAttack 触发器正确执行
4. THE 审查系统 SHALL 使用 GameTestRunner 验证治疗模式攻击后 afterAttack 触发器正确执行

### 需求 14：跨阵营同类能力一致性审计（D33）— 静态 Property 测试 + 运行时行为测试

**用户故事：** 作为开发者，我希望验证6个阵营中语义相同的能力使用一致的实现路径。

#### 验收标准

1. THE 审查系统 SHALL 按语义类别分组所有能力：伤害、治疗、抽牌、移动、状态修正、额外行动、充能
2. THE 审查系统 SHALL 使用 Property 测试自动提取所有 executor 的事件类型使用情况，生成跨阵营一致性矩阵
3. THE 审查系统 SHALL 验证同类能力使用一致的事件类型和注册模式
4. THE 审查系统 SHALL 使用 GameTestRunner 对代表性同类能力（如蛮族伤害 vs 冰霜伤害）验证运行时行为一致
5. WHEN 发现不一致 THEN THE 审查系统 SHALL 区分合理差异和不合理差异

### 需求 15：UI 状态同步审计（D15）

**用户故事：** 作为开发者，我希望验证 UI 展示的数值与 core 状态一致。

#### 验收标准

1. THE 审查系统 SHALL 验证 UI 生命值展示调用 getEffectiveLife 而非直接读原始字段
2. THE 审查系统 SHALL 验证 UI 攻击力展示调用 getEffectiveStrengthValue 而非直接读原始字段
3. THE 审查系统 SHALL 验证 UI 移动距离展示调用 getUnitMoveEnhancements 而非硬编码
4. THE 审查系统 SHALL 验证 UI 充能状态正确读取 activeEvents 中的 charges 字段

### 需求 16：效果拦截路径审计（D31）

**用户故事：** 作为开发者，我希望验证拦截机制在所有事件产生路径上生效。

#### 验收标准

1. WHEN divine_shield 拦截逻辑存在 THEN THE 审查系统 SHALL 验证拦截在直接命令执行和交互解决路径上都生效
2. IF 存在其他拦截机制 THEN THE 审查系统 SHALL 列出所有事件产生路径，验证过滤函数在每条路径上被调用