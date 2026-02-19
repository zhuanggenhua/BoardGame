# 实现计划：统一伤害/Buff 系统

## 概述

按优先级分三阶段实现：先修复王权骰铸的伤害路径和 Pyromancer bug（高优先级），再增强召唤师战争日志（中优先级），最后增强大杀四方日志（低优先级）。

## 任务

- [x] 1. 增强 DamageCalculation 引擎原语
  - [x] 1.1 扩展 DamageResult 接口，添加 `sideEffectEvents: GameEvent[]` 字段
    - 修改 `src/engine/primitives/damageCalculation.ts`
    - 在 `DamageResult` 接口中添加 `sideEffectEvents` 字段
    - 在 `resolve()` 方法中初始化为空数组
    - _Requirements: 3.3, 3.5_
  - [x] 1.2 添加 PassiveTriggerHandler 接口和 DamageCalculationConfig 扩展
    - 在 `damageCalculation.ts` 中定义 `PassiveTriggerHandler` 接口
    - 在 `DamageCalculationConfig` 中添加可选的 `passiveTriggerHandler` 字段
    - _Requirements: 3.1_
  - [x] 1.3 增强 collectStatusModifiers 以支持 removeStatus 和 custom 动作
    - 在 `collectStatusModifiers()` 中，对 `onDamageReceived` 时机的 PassiveTrigger 动作：
      - `modifyStat`: 保持现有逻辑（已支持）
      - `removeStatus`: 生成 STATUS_REMOVED 事件，添加到 sideEffectEvents
      - `custom`: 调用 passiveTriggerHandler.handleCustomAction，将 preventAmount 转为负值 flat modifier，将副作用事件添加到 sideEffectEvents
    - _Requirements: 1.2, 1.3, 3.2, 3.3, 3.4, 3.5_
  - [x] 1.4 编写 DamageCalculation PassiveTrigger 增强的属性测试
    - **Property 2: PassiveTrigger custom/PREVENT_DAMAGE 处理**
    - **Property 3: PassiveTrigger removeStatus 处理**
    - **Validates: Requirements 1.2, 1.3, 3.3, 3.4, 3.5**

- [x] 2. 迁移王权骰铸 resolveEffectAction.damage 到 createDamageCalculation
  - [x] 2.1 实现 DiceThrone PassiveTriggerHandler
    - 在 `src/games/dicethrone/domain/effects.ts` 中创建 `createDTPassiveTriggerHandler` 函数
    - 封装现有 `applyOnDamageReceivedTriggers` 中 `custom` case 的逻辑
    - 实现 `PassiveTriggerHandler` 接口
    - _Requirements: 1.2, 3.4, 3.5_
  - [x] 2.2 重写 resolveEffectAction 的 damage case
    - 将手动伤害计算替换为 `createDamageCalculation` 调用
    - 保持 Token 响应窗口逻辑（shouldOpenTokenResponse 检查）不变
    - 保持 `target: 'all'/'allOpponents'` 的全体伤害逻辑不变
    - 处理 sideEffectEvents（添加到 events 数组）
    - _Requirements: 1.1, 1.5_
  - [x] 2.3 移除 applyOnDamageReceivedTriggers 函数
    - 删除 `applyOnDamageReceivedTriggers` 函数定义
    - 确认无其他调用点引用该函数
    - _Requirements: 1.4_
  - [x] 2.4 编写伤害路径统一回归属性测试
    - **Property 1: 伤害路径统一回归一致性**
    - **Property 5: Token 响应窗口行为保持**
    - **Validates: Requirements 1.1, 1.5, 1.6**

- [x] 3. 修复 Pyromancer autoCollect bug
  - [x] 3.1 移除 Pyromancer custom actions 中的 autoCollect*: false
    - 修改 `src/games/dicethrone/domain/customActions/pyromancer.ts`
    - 将所有 `autoCollectStatus: false, autoCollectTokens: false, autoCollectShields: false` 改为使用默认值（true）
    - 对确实需要跳过的场景添加注释说明原因
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 3.2 编写 Pyromancer 状态效果应用属性测试
    - **Property 4: Pyromancer 伤害正确应用所有修正**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 4. 检查点 - 王权骰铸伤害路径统一完成
  - 确保所有现有王权骰铸测试通过
  - 确保所有新增属性测试通过
  - 如有问题请询问用户

- [x] 5. 召唤师战争战力 Breakdown 增强
  - [x] 5.1 重构 calculateEffectiveStrength 返回 StrengthResult
    - 修改 `src/games/summonerwars/domain/abilityResolver.ts`
    - 定义 `StrengthResult` 接口（baseStrength, finalStrength, modifiers）
    - 重构 `calculateEffectiveStrength` 在每个 buff 计算点记录 modifier 明细
    - 添加 `getEffectiveStrengthValue` 便捷函数保持向后兼容
    - 更新所有调用点使用 `getEffectiveStrengthValue`（仅需数值的场景）
    - _Requirements: 4.1, 4.2, 4.5_
  - [x] 5.2 实现召唤师战争 DamageSourceResolver
    - 在 `src/games/summonerwars/actionLog.ts` 中扩展现有 `swDamageSourceResolver`
    - 确保能解析所有 buff 来源 ID（能力 ID、事件卡 ID 等）
    - _Requirements: 4.4_
  - [x] 5.3 更新 ActionLog 使用 breakdown segment
    - 修改 `DECLARE_ATTACK` 命令的日志格式化
    - 当 `StrengthResult.modifiers` 非空时，使用 `buildDamageBreakdownSegment` 生成 tooltip
    - 当无 buff 时保持现有格式
    - _Requirements: 4.1, 4.3, 4.5_
  - [x] 5.4 编写召唤师战争 Breakdown 属性测试
    - **Property 6: 召唤师战争战力 Breakdown 完整性**
    - **Property 7: 召唤师战争 DamageSourceResolver 完整性**
    - **Property 8: 召唤师战争日志向后兼容**
    - **Validates: Requirements 4.1, 4.2, 4.4, 4.5**

- [x] 6. 检查点 - 召唤师战争增强完成
  - 确保所有现有召唤师战争测试通过
  - 确保新增属性测试通过
  - 如有问题请询问用户

- [x] 7. 大杀四方力量 Breakdown 增强
  - [x] 7.1 实现 getOngoingPowerModifierDetails
    - 修改 `src/games/smashup/domain/ongoingModifiers.ts`
    - 定义 `PowerModifierDetail` 接口
    - 新增 `getOngoingPowerModifierDetails` 函数，遍历注册表收集每个非零修正的来源信息
    - 新增 `getEffectivePowerBreakdown` 函数，组合所有修正来源
    - 不修改现有 `getOngoingPowerModifier` 和 `getEffectivePower` 函数
    - _Requirements: 5.4, 5.5_
  - [x] 7.2 更新 ActionLog 使用力量 breakdown
    - 修改 `src/games/smashup/actionLog.ts`
    - 在基地结算日志中，当随从有力量修正时使用 breakdown 格式
    - 当无修正时保持普通数值显示
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 7.3 编写大杀四方 Breakdown 属性测试
    - **Property 9: 大杀四方力量明细总和一致性**
    - **Property 10: 大杀四方力量 Breakdown 完整性**
    - **Validates: Requirements 5.1, 5.2, 5.4, 5.5**

- [x] 8. buildDamageBreakdownSegment 通用化
  - [x] 8.1 扩展 buildDamageBreakdownSegment 支持自定义基础值标签
    - 修改 `src/engine/primitives/actionLogHelpers.ts`
    - 添加可选的 `options` 参数（baseLabel, baseLabelIsI18n, baseLabelNs）
    - 当无 breakdown 且无 modifiers 时，使用自定义 baseLabel 替代默认标签
    - _Requirements: 6.1_

- [x] 9. 最终检查点 - 全部完成
  - 确保所有三个游戏的现有测试通过
  - 确保所有新增属性测试通过
  - 如有问题请询问用户

## 备注

- 标记 `*` 的任务为可选测试任务，可跳过以加速 MVP
- 每个任务引用具体需求以确保可追溯性
- 检查点确保增量验证
- 属性测试验证通用正确性属性，单元测试验证具体示例和边界条件
