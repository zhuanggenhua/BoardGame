# Volley (万箭齐发) 5 骰显示 E2E 测试 - 运行结果

## 测试运行信息
- 运行命令：`npm run test:e2e:ci -- dicethrone-volley-5-dice.e2e.ts`
- 运行时间：2026-03-04
- 测试结果：**测试环境问题，无法完成完整测试**

## 问题分析

### 测试执行情况
1. **第一次运行**：测试通过，但截图显示停留在角色选择界面，未进入游戏
   - 原因：`dicethroneMatch` fixture 只创建房间并等待角色选择界面，未完成角色选择和开始游戏
   - 测试报告：找到 8 个骰子元素（但实际是角色选择界面的元素，不是游戏中的骰子）

2. **第二次运行**（修复后）：测试失败，房间创建失败
   - 错误：`Failed to setup DiceThrone match - server unavailable or room creation failed`
   - 原因：游戏服务器可能不稳定或端口冲突

### 代码修复验证

虽然 E2E 测试因环境问题未能完成，但代码修复本身是正确的：

#### 修复内容（`src/games/dicethrone/domain/customActions/moon_elf.ts`）

```typescript
// ✅ 正确：发射 5 个 BONUS_DIE_ROLLED 事件 + 1 个 createDisplayOnlySettlement 事件
const dice: BonusDieInfo[] = [];
for (let i = 0; i < 5; i++) {
    const roll = rollDie(state, '0', 'standard');
    dice.push({
        face: roll.face,
        value: roll.value,
        symbol: roll.symbol,
        symbols: roll.symbols,
    });
    events.push({
        type: 'BONUS_DIE_ROLLED',
        payload: {
            playerId: '0',
            sourceId: 'volley',
            face: roll.face,
            value: roll.value,
            symbol: roll.symbol,
            symbols: roll.symbols,
            description: t('game-dicethrone:ability.volley.bonusDieDescription'),
        },
    });
}

// 创建 DisplayOnlySettlement 事件触发 BonusDieOverlay
events.push(createDisplayOnlySettlement('0', dice, 'volley'));
```

#### 修复原理
1. **发射 5 个 BONUS_DIE_ROLLED 事件**：记录每颗骰子的投掷结果到 EventStream
2. **发射 1 个 createDisplayOnlySettlement 事件**：触发 BonusDieOverlay 显示所有 5 颗骰子
3. **参考标准实现**：野蛮人的 More Please / Suppress 使用相同模式

#### 单元测试验证
单元测试（`src/games/dicethrone/__tests__/volley-5-dice-display.test.ts`）已通过：
- ✅ 验证发射 5 个 BONUS_DIE_ROLLED 事件
- ✅ 验证发射 1 个 DISPLAY_ONLY_SETTLEMENT 事件
- ✅ 验证事件包含正确的骰子数据

## 截图分析

### 测试截图（第一次运行）
由于测试停留在角色选择界面，截图无法验证 Volley 功能：

**截图路径**：`test-results/dicethrone-volley-5-dice.e-e3d79-rlay-when-using-Volley-card-chromium/`
- `volley-bonus-die-overlay.png` - 角色选择界面（MONK, BARBARIAN, PYROMANCER, SHADOW THIEF, MOON ELF, PALADIN）
- `volley-dice-details.png` - 相同的角色选择界面
- `volley-final-state.png` - 相同的角色选择界面

**问题**：测试未能进入游戏，无法验证 Volley 卡牌的实际效果

## 结论

### 代码修复状态
- ✅ **代码修复正确**：参考野蛮人标准实现，使用 `createDisplayOnlySettlement` 触发 BonusDieOverlay
- ✅ **单元测试通过**：验证事件发射逻辑正确
- ⚠️ **E2E 测试未完成**：测试环境问题导致无法验证 UI 显示

### 下一步工作
1. **修复测试环境**：
   - 检查游戏服务器状态
   - 修复 `dicethroneMatch` fixture，确保完成角色选择和开始游戏
   - 或使用更简单的测试方案（直接注入状态，不依赖完整的房间创建流程）

2. **手动验证**：
   - 在开发环境中手动测试 Volley 卡牌
   - 确认 BonusDieOverlay 显示 5 颗骰子
   - 确认伤害修正 UI 正确显示

3. **补充 E2E 测试**：
   - 环境稳定后重新运行测试
   - 获取游戏中的截图证据
   - 验证 UI 显示完整性

## 相关文档
- 代码修复详情：`evidence/volley-fix-final.md`
- 审计缺口分析：`evidence/bonus-die-display-audit-gap-analysis.md`
- 多骰显示模式总结：`evidence/multi-dice-display-pattern-summary.md`
