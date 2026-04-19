# Daze 测试修复清单

## 问题总结

Daze 机制已修复为正确实现，但旧测试基于错误理解编写，需要更新。

## 正确的 Daze 机制

1. Player A 攻击 Player B，施加眩晕给 Player B
2. 攻击结算后，立即检查 **Player B（防御方）** 是否有眩晕
3. 如果有，立即移除眩晕 + **Player A（攻击方）** 获得额外攻击
4. 眩晕不会在 buff 区显示（立即移除）

## 需要修复的测试文件

### 1. `barbarian-coverage.test.ts`
- **测试**: "狂怒 (rage) > 5个力量面 [6,6,6,6,6] 造成眩晕 + 15 伤害（0心防御）"
- **问题**: 期望 Player 1 有眩晕状态，但眩晕应该立即移除并触发额外攻击
- **修复**: 
  - 移除 `statusEffects: { [STATUS_IDS.DAZE]: 1 }` 期望
  - 添加额外攻击阶段的命令和断言
  - 期望阶段为 `offensiveRoll`（额外攻击）而非 `main2`

### 2. `interaction-chain-conditional.test.ts`
- **测试1**: "攻击方有 daze  攻击结算后触发对手额外攻击"
- **问题**: 给 Player 0（攻击方）添加眩晕，期望 Player 1 获得额外攻击
- **修复**: 
  - 改为给 Player 1（防御方）添加眩晕
  - 期望 Player 0（攻击方）获得额外攻击
  - 更新命令序列

- **测试2**: "终极技能链 > rage 5个力量面 眩晕 + 15 伤害"
- **问题**: 同上
- **修复**: 同上

### 3. `token-execution.test.ts`
- **测试1**: "不可防御攻击结算后：daze 被移除，进入额外攻击 offensiveRoll"
- **问题**: 给 Player 0（攻击方）添加眩晕
- **修复**: 改为给 Player 1（防御方）添加眩晕

- **测试2**: "可防御攻击 + daze：经过 defensiveRoll 后触发额外攻击"
- **问题**: 同上
- **修复**: 同上

- **测试3**: "额外攻击的 offensiveRoll 骰子状态正确重置"
- **问题**: 同上
- **修复**: 同上

### 4. `pyromancer-behavior.test.ts`
- **测试**: "burn-down-2-resolve (焚尽 II) > 获得1FM后消耗全部，每个4点伤害"
- **问题**: 期望消耗 5 个 FM，实际只有 4 个
- **分析**: 这个测试与 Daze 无关，可能是其他问题

### 5. `shadow-shank-sneak-attack-bug.test.ts`
- **测试1**: "终极技能 shadow-shank + sneak_attack：伤害应包含伏击奖励骰"
- **测试2**: "复现线上场景：CP=6 + gainCp(3) = 9, damage 应为 9+5+dieValue"
- **测试3**: "验证 ActionLog：TOKEN_USED 显示伏击掷骰值，DAMAGE_DEALT 包含总伤害"
- **分析**: 这些测试与 Daze 无关，可能是其他问题

## 修复优先级

1. **高优先级**: Daze 相关测试（1-3）- 必须立即修复
2. **中优先级**: pyromancer-behavior.test.ts（4）- 需要调查
3. **中优先级**: shadow-shank-sneak-attack-bug.test.ts（5）- 需要调查

## 下一步

1. 修复 Daze 相关测试（1-3）
2. 运行测试验证修复
3. 调查其他失败测试（4-5）
