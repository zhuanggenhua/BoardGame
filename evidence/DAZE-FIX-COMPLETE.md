# 眩晕（Daze）机制修复 - 完成总结

## 修复内容

### 问题描述
用户反馈：眩晕（Daze）机制不正确，应该是"防御方被眩晕时，攻击方获得额外攻击"，但实际实现是"攻击方被眩晕时，防御方获得额外攻击"。

### 正确机制（已确认）
1. 攻击方攻击防御方
2. 防御方有 Daze 状态
3. 攻击结算完成
4. 立即移除防御方的 Daze
5. **攻击方**获得额外攻击（进入 offensiveRoll 阶段）

### 修复位置
**文件**: `src/games/dicethrone/domain/flowHooks.ts`

**修改内容**:
```typescript
// ❌ 旧代码（错误）
const defenderHasDaze = core.players[attackerId]?.statusEffects?.daze > 0;
if (defenderHasDaze) {
    // 给防御方额外攻击（错误）
    events.push({
        type: 'GRANT_TOKENS',
        payload: {
            playerId: defenderId,  // ❌ 错误：给防御方
            tokens: { extraAttack: 1 },
        },
    });
}

// ✅ 新代码（正确）
const defenderHasDaze = core.players[defenderId]?.statusEffects?.daze > 0;
if (defenderHasDaze) {
    // 给攻击方额外攻击（正确）
    events.push({
        type: 'GRANT_TOKENS',
        payload: {
            playerId: attackerId,  // ✅ 正确：给攻击方
            tokens: { extraAttack: 1 },
        },
    });
}
```

**关键变更**:
1. 检查 Daze 的目标：从 `attackerId` 改为 `defenderId`
2. 授予额外攻击的目标：从 `defenderId` 改为 `attackerId`

## 测试验证

### 更新的测试文件
1. `src/games/dicethrone/__tests__/daze-extra-attack-simple.test.ts` - 简单场景测试（已通过）
2. `src/games/dicethrone/__tests__/barbarian-coverage.test.ts` - 狂战士技能测试（已通过）
3. `src/games/dicethrone/__tests__/interaction-chain-conditional.test.ts` - 交互链测试（已通过）
4. `src/games/dicethrone/__tests__/token-execution.test.ts` - Token 执行测试（已通过）

### 测试结果
```
✓ src/games/dicethrone/__tests__/daze-extra-attack-simple.test.ts (1 test)
✓ src/games/dicethrone/__tests__/barbarian-coverage.test.ts (21 tests)
✓ src/games/dicethrone/__tests__/interaction-chain-conditional.test.ts (7 tests)
✓ src/games/dicethrone/__tests__/token-execution.test.ts (15 tests)
```

**所有 Daze 相关测试均已通过！**

### 测试覆盖场景
1. ✅ 防御方有 Daze → 攻击方获得额外攻击
2. ✅ 防御方无 Daze → 无额外攻击
3. ✅ 不可防御攻击 + Daze → 正确触发额外攻击
4. ✅ 可防御攻击 + Daze → 经过防御投掷后触发额外攻击
5. ✅ 额外攻击的骰子状态正确重置
6. ✅ 狂战士 Rage 技能（5个力量面）→ 造成眩晕 + 15 伤害 + 额外攻击

## 剩余失败测试（与 Daze 无关）

以下测试失败与 Daze 修复无关，是其他系统的已知问题：

1. **Pyromancer burn-down-2-resolve** (1 failure)
   - 问题：FM 消耗数量计算错误（期望 5，实际 4）
   - 影响：烈焰术士技能

2. **Shadow Thief shadow-shank + sneak_attack** (3 failures)
   - 问题：伤害计算不正确
   - 影响：暗影盗贼终极技能 + 伏击 Token 组合

## 总结

✅ **眩晕（Daze）机制修复完成**

修复了 `src/games/dicethrone/domain/flowHooks.ts` 中的 Daze 机制逻辑：
- 检查 Daze 的目标：从攻击方改为防御方
- 授予额外攻击的目标：从防御方改为攻击方

✅ **localStorage 服务端错误修复**

修复了 `src/games/dicethrone/ui/AutoResponseToggle.tsx` 中的服务端崩溃问题：
- `getAutoResponseEnabled()` 添加环境检查
- 服务端环境返回默认值 `true`
- 防止 `ReferenceError: localStorage is not defined`

所有 Daze 相关测试已更新并通过（44 个测试）。剩余 4 个失败测试与 Daze 无关，是其他系统的已知问题（Pyromancer FM 消耗、Shadow Thief 伤害计算）。
