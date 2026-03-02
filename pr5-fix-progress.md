# PR #5 修复进度报告

## 当前状态

**核心测试通过率**: 3042/3049 (99.77%) ✅

**所有核心功能测试通过！** 🎉

## 已修复问题

### 1. miskatonic_mandatory_reading - 永久力量修正 ✅

**问题**: PR #5 删除了 `addPermanentPower` 函数，导致"最好不知道的事"卡牌使用错误的事件类型

**根因**:
- Handler 使用 `addPowerCounter` (POWER_COUNTER_ADDED) 创建力量指示物事件
- 但该卡牌应该使用永久力量修正 (PERMANENT_POWER_ADDED)
- 测试期望 `powerModifier` 字段被更新，但实际更新的是 `powerCounters` 字段

**修复**:
1. 重新添加 `addPermanentPower` 函数到 `src/games/smashup/domain/abilityHelpers.ts`
2. 修改 `miskatonic_mandatory_reading_draw` handler 使用 `addPermanentPower` 而非 `addPowerCounter`
3. 修复测试断言从 `tempPowerModifier` 改为 `powerModifier`

**文件变更**:
- `src/games/smashup/domain/abilityHelpers.ts` - 添加 `addPermanentPower` 函数
- `src/games/smashup/abilities/miskatonic.ts` - 修改 handler 和 import
- `src/games/smashup/__tests__/madnessAbilities.test.ts` - 修复测试断言

### 2. robot_hoverbot - 牌库顶检查 ✅

**问题**: 从牌库打出随从时，onPlay 触发器看到的是旧的牌库状态（卡牌未被移除）

**根因**: `postProcessSystemEvents` 在调用 `fireMinionPlayedTriggers` 时，对于从牌库打出的随从（`fromDeck: true`），没有先 reduce MINION_PLAYED 事件来更新牌库状态

**修复**: 在 `postProcessSystemEvents` 中，对于 `fromDeck: true` 的 MINION_PLAYED 事件，在调用 `fireMinionPlayedTriggers` 前先 reduce 该事件，确保 onPlay 触发器看到更新后的牌库状态

**文件变更**:
- `src/games/smashup/domain/index.ts` - 修改 `postProcessSystemEvents` 函数

### 3. robot_microbot_fixer & robot_microbot_reclaimer ✅

**状态**: 与 robot_hoverbot 同时修复

**说明**: 通过只对 `fromDeck: true` 的事件进行 reduce，避免了对从手牌打出的随从重复计算 `minionsPlayed`，从而修复了 microbot 测试

### 4. coreProperties - 力量指示物属性测试 ✅

**问题**: 测试错误地期望 `POWER_COUNTER_ADDED` 事件更新 `powerModifier` 字段，但实际应该更新 `powerCounters` 字段

**修复**: 修正测试断言，从检查 `powerModifier` 改为检查 `powerCounters`

**文件变更**:
- `src/games/smashup/__tests__/properties/coreProperties.test.ts` - 修正测试断言

## 修复完成

所有 4 个核心功能测试失败已全部修复！✅

## 最终测试结果

```
Test Files: 229 passed | 3 skipped (232)
Tests: 3042 passed | 7 skipped (3049)
```

**通过率**: 99.77% ✅

## 测试命令

```bash
# 运行核心功能测试（排除审计和属性测试）
npm run test:games:core

# 运行审计测试
npm run test:games:audit

# 运行所有测试
npm run test:games
```
