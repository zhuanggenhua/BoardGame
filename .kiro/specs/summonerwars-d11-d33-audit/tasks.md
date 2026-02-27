# 实施计划：召唤师战争 D11-D33 维度审计

## 概述

双轨审计策略：静态 Property 测试（fast-check）覆盖注册表完整性与字段清理；运行时 GameTestRunner 行为测试覆盖组合场景、时序正确性、架构绕过与副作用传播。所有测试位于 `src/games/summonerwars/__tests__/`，TypeScript + Vitest。

## 任务

- [x] 1. D11 Reducer 消耗路径 + D12 写入-消耗对称（静态 Property 测试）
  - [x] 1.1 创建 `d11-reducer-consumption.property.test.ts`
    - 使用 fast-check 生成随机 extraAttacks 值，构造 CONFIRM_ATTACK 事件序列，断言递减而非清零且 attackCount 不变
    - 验证魔力消耗路径（建造/召唤/事件卡/blood_rune/magic_addiction）clampMagic 生效
    - 验证充能消耗路径（ice_shards/frost_axe/ancestral_bond/funeral_pyre/holy_judgment）充能不低于 0
    - 验证 moveCount 递增正确，额外移动不消耗正常移动次数
    - _需求: R1.1, R1.2, R1.3, R1.4_
  - [x] 1.2 创建 `d12-write-consume-symmetry.property.test.ts`
    - **Property 1: extraAttacks 写入-消耗对称**
    - 验证 extraAttacks 写入后 validate.ts DECLARE_ATTACK 正确读取
    - **Property 2: tempAbilities 写入-消耗对称**
    - 验证 tempAbilities 写入后 getUnitAbilities 正确合并，TURN_CHANGED 正确清除
    - **Property 3: attachedCards 写入-消耗对称**
    - 验证 attachedCards 写入后攻击力计算正确读取加成
    - **Property 4: boosts 写入-消耗对称**
    - 验证 boosts 写入后攻击力计算正确读取
    - **Property 5: wasAttackedThisTurn 写入-消耗对称**
    - 验证 wasAttackedThisTurn 写入后庇护能力正确读取，TURN_CHANGED 正确清除
    - **Property 6: Reducer 操作范围不超出 payload 声明**
    - **验证: 需求 R2.1, R2.2, R2.3, R2.4, R2.5, R2.6**
  - [x] 1.3 使用 GameTestRunner 构造"授予 extraAttacks 后连续攻击"场景
    - 断言每次攻击正确递减 extraAttacks 且 attackCount 不变
    - _需求: R1.5_

- [x] 2. D14 回合清理完整性（静态 Property 测试 + GameTestRunner）
  - [x] 2.1 创建 `d14-turn-cleanup.property.test.ts`
    - **Property 7: BoardUnit 临时字段清理完整性**
    - 列出 BoardUnit 所有可选/临时字段，验证 TURN_CHANGED reducer 有对应清理逻辑
    - **Property 8: PlayerState 回合字段清理完整性**
    - 列出 PlayerState 回合字段，验证 TURN_CHANGED 重置
    - **Property 9: mind_control 控制权归还**
    - 验证 TURN_CHANGED 时 originalOwner 恢复
    - **验证: 需求 R3.1, R3.2, R3.3, R3.5**
  - [x] 2.2 使用 GameTestRunner 构造完整回合，断言回合切换后所有临时字段已重置
    - 构造含 extraAttacks、tempAbilities、healingMode、wasAttackedThisTurn 的状态
    - 执行 TURN_CHANGED 后断言全部清理
    - _需求: R3.4_

- [x] 3. Checkpoint - 确保 D11/D12/D14 测试全部通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 4. D16+D17 条件优先级与隐式依赖（GameTestRunner 运行时行为测试）
  - [x] 4.1 创建 `d16-d17-condition-priority.test.ts`
    - 使用 GameTestRunner 验证 DECLARE_ATTACK 验证链优先级：阶段检查 > 攻击次数 > extraAttacks > 治疗模式
    - 使用 GameTestRunner 验证 MOVE_UNIT 验证链优先级：阶段检查 > 移动次数 > immobile > 路径
    - 验证 FlowHooks onPhaseExit/onPhaseEnter 不依赖隐式执行顺序
    - 验证 postProcessDeathChecks 不依赖事件处理特定顺序
    - _需求: R4.1, R4.2, R4.3, R4.4_

- [x] 5. D18 否定路径（GameTestRunner 运行时行为测试）
  - [x] 5.1 创建 `d18-negation-path.test.ts`
    - 使用 GameTestRunner 验证额外攻击消耗不影响正常 attackCount
    - 使用 GameTestRunner 验证治疗模式只对友方生效，不对敌方造成治疗
    - 使用 GameTestRunner 验证 ancestral_bond 充能转移守恒（源减少 = 目标增加）
    - 使用 GameTestRunner 验证玩家隔离（A 的临时状态变化不影响 B）
    - _需求: R5.1, R5.2, R5.3, R5.4_

- [x] 6. D13 多来源竞争（GameTestRunner 运行时行为测试）
  - [x] 6.1 创建 `d13-multi-source-competition.test.ts`
    - 使用 GameTestRunner 验证充能多来源叠加（blood_rage + ancestral_bond 累加而非覆盖）
    - 使用 GameTestRunner 验证多个能力同时修改 boosts 正确累加
    - 使用 GameTestRunner 验证多张 activeEvents 同时生效互不干扰
    - _需求: R6.1, R6.2, R6.3_

- [x] 7. Checkpoint - 确保 D16-D18/D13 测试全部通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 8. D19 组合场景审计（GameTestRunner 运行时行为测试）
  - [x] 8.1 创建 `d19-combination-scenarios.test.ts` — 治疗模式 + 交缠
    - 使用 GameTestRunner 构造圣殿牧师（healingMode）+ 交缠颂歌同时生效场景
    - 断言治疗攻击是否正确触发交缠效果
    - _需求: R7.1_
  - [x] 8.2 心灵捕获 + 献祭组合
    - 使用 GameTestRunner 构造被控制单位被消灭场景
    - 断言献祭触发器的归属判定正确
    - _需求: R7.2_
  - [x] 8.3 群情激愤 + extraAttacks 组合
    - 使用 GameTestRunner 验证跨阶段攻击与额外攻击次数的交互正确
    - _需求: R7.3_
  - [x] 8.4 冰霜战斧 + 单位消灭组合
    - 使用 GameTestRunner 验证附加单位卡同步弃置且魔力归属正确
    - _需求: R7.4_
  - [x] 8.5 幻化复制 + 原单位消灭组合
    - 使用 GameTestRunner 验证复制技能在原单位消灭后仍正常工作直到回合结束
    - _需求: R7.5_

- [x] 9. D21 触发频率门控审计（Property 测试 + GameTestRunner 运行时行为测试）
  - [x] 9.1 在 `d21-trigger-frequency.test.ts` 中添加 Property 测试
    - **Property 10: 所有触发型技能频率限制覆盖**
    - grep 所有 trigger 非 activated/passive 的技能定义，验证每个都有 usesPerTurn 或在白名单中
    - **验证: 需求 R8.4**
  - [x] 9.2 使用 GameTestRunner 验证 afterAttack 触发器频率限制
    - 构造"同一单位连续攻击两次"场景（telekinesis/soul_transfer/rapid_fire/fortress_power）
    - 断言 afterAttack 触发器在第二次攻击后不再触发（usesPerTurn=1）
    - _需求: R8.1, R8.3_
  - [x] 9.3 使用 GameTestRunner 验证阶段触发器不重复触发
    - 构造 guidance/illusion/blood_rune 在同一阶段内的场景
    - 断言每个阶段触发器只触发一次
    - _需求: R8.2_

- [x] 10. D23 架构假设一致性审计（GameTestRunner 运行时行为测试）
  - [x] 10.1 创建 `d23-architecture-bypass.test.ts` — 治疗模式绕过友军限制
    - 使用 GameTestRunner 构造"治疗模式攻击友军"场景
    - 断言 canAttackEnhanced 允许治疗模式攻击友军，且正确执行治疗效果
    - _需求: R9.1, R9.4_
  - [x] 10.2 群情激愤绕过阶段限制
    - 使用 GameTestRunner 验证 rallying_cry 能绕过"攻击只能在攻击阶段"的硬编码约束
    - _需求: R9.2_
  - [x] 10.3 飞行/穿越绕过路径阻挡
    - 使用 GameTestRunner 验证飞行/穿越能力能绕过路径阻挡检查
    - _需求: R9.3_
  - [x] 10.4 列出所有底层验证函数硬编码约束
    - 静态分析 validate.ts/helpers.ts 中的硬编码约束，检查是否有描述反例需要绕过
    - _需求: R9.5_

- [x] 11. Checkpoint - 确保 D19/D21/D23 测试全部通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 12. D25+D27 MatchState 传播与可选参数审计（静态分析 + GameTestRunner）
  - [x] 12.1 创建 `d25-d27-matchstate-optional.test.ts`
    - grep 所有 createSimpleChoice/queueInteraction 调用点，验证 matchState 传递正确
    - 使用 GameTestRunner 通过完整命令链路触发交互创建，断言交互被正确排队
    - 验证可选参数在 undefined 时有合理降级行为
    - _需求: R10.1, R10.2, R10.3_

- [x] 13. D28 白名单完整性审计（静态 Property 测试）
  - [x] 13.1 创建 `d28-whitelist-completeness.property.test.ts`
    - **Property 11: CONFIRMABLE_PHASE_END_ABILITIES 白名单完整性**
    - grep 所有 trigger='onPhaseEnd' 且描述含"你可以"的技能，验证都在白名单中
    - **Property 12: 白名单定义处注释完整性**
    - 验证每个白名单定义处有注释说明加入条件
    - **验证: 需求 R11.1, R11.2, R11.3**

- [x] 14. D30 消灭流程时序审计（GameTestRunner 运行时行为测试）
  - [x] 14.1 创建 `d30-destruction-timing.test.ts` — onDestroy 触发器时序
    - 使用 GameTestRunner 验证 onDestroy 触发器在确认消灭后执行
    - _需求: R12.1_
  - [x] 14.2 连锁消灭递归处理
    - 使用 GameTestRunner 验证连锁消灭递归处理正确且无无限循环
    - _需求: R12.2_
  - [x] 14.3 divine_shield 拦截后 onDestroy 不执行
    - 使用 GameTestRunner 验证 divine_shield 拦截后 onDestroy 不执行
    - _需求: R12.3_

- [x] 15. D31 效果拦截路径审计（GameTestRunner 运行时行为测试）
  - [x] 15.1 创建 `d31-effect-interception.test.ts`
    - 使用 GameTestRunner 验证 divine_shield 拦截在直接命令执行路径上生效
    - 使用 GameTestRunner 验证 divine_shield 拦截在交互解决路径上生效
    - 列出所有事件产生路径，验证过滤函数在每条路径上被调用
    - _需求: R16.1, R16.2_

- [x] 16. D32 替代路径后处理对齐审计（GameTestRunner 运行时行为测试）
  - [x] 16.1 创建 `d32-alternative-path.test.ts` — 攻击流程路径枚举
    - 列出攻击流程所有路径：正常近战、远程、治疗模式、践踏、额外攻击
    - 提取规范路径的后处理检查集并逐条比对替代路径
    - _需求: R13.1, R13.2_
  - [x] 16.2 远程攻击后 afterAttack 触发器
    - 使用 GameTestRunner 验证远程攻击后 afterAttack 触发器正确执行
    - _需求: R13.3_
  - [x] 16.3 治疗模式攻击后 afterAttack 触发器
    - 使用 GameTestRunner 验证治疗模式攻击后 afterAttack 触发器正确执行
    - _需求: R13.4_

- [x] 17. Checkpoint - 确保 D25-D32 测试全部通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 18. D33 跨阵营同类能力一致性审计（Property 测试 + GameTestRunner）
  - [x] 18.1 创建 `d33-cross-faction-consistency.property.test.ts`
    - **Property 13: 跨阵营能力语义分类完整性**
    - 按语义类别分组所有能力：伤害、治疗、抽牌、移动、状态修正、额外行动、充能
    - **Property 14: 跨阵营 executor 事件类型一致性矩阵**
    - 自动提取所有 executor 的事件类型使用情况，生成跨阵营一致性矩阵
    - **Property 15: 同类能力注册模式一致性**
    - 验证同类能力使用一致的事件类型和注册模式
    - **验证: 需求 R14.1, R14.2, R14.3**
  - [x] 18.2 使用 GameTestRunner 对代表性同类能力验证运行时行为一致
    - 选取蛮族伤害 vs 冰霜伤害等代表性同类能力
    - 断言运行时行为一致，区分合理差异和不合理差异
    - _需求: R14.4, R14.5_

- [x] 19. D15 UI 状态同步审计（静态分析）
  - [x] 19.1 创建 `d15-ui-state-sync.test.ts`
    - 验证 UI 生命值展示调用 getEffectiveLife 而非直接读原始字段
    - 验证 UI 攻击力展示调用 getEffectiveStrengthValue 而非直接读原始字段
    - 验证 UI 移动距离展示调用 getUnitMoveEnhancements 而非硬编码
    - 验证 UI 充能状态正确读取 activeEvents 中的 charges 字段
    - _需求: R15.1, R15.2, R15.3, R15.4_

- [x] 20. 最终 Checkpoint - 确保所有审计测试通过
  - 确保所有测试通过，如有问题请向用户确认。

## 备注

- 标记 `*` 的任务为可选，可跳过以加速 MVP
- 每个任务引用具体需求以确保可追溯性
- Property 测试验证注册表/字段级别的通用正确性属性
- GameTestRunner 测试验证运行时行为、时序正确性和组合场景
- Checkpoint 确保增量验证