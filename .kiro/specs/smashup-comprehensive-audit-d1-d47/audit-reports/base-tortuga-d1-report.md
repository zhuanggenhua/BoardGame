# base_tortuga（托尔图加）D1 审计报告

## 审计概要

**审计日期**: 2025-01-29
**审计维度**: D1 - 实体筛选范围语义
**审计对象**: base_tortuga（托尔图加）基地卡
**审计结果**: ✅ **通过** - 范围限定实现正确

## 审计内容

### 验证点

1. **亚军身份验证**：只有亚军（第2名）可以移动随从
2. **范围限定**：只能移动其他基地上的随从（非托尔图加本身）
3. **边界条件**：亚军在其他基地没有随从时不触发
4. **D8 时序**：不误用 `ctx.playerId`，正确使用 `rankings[1].playerId`

### 代码审查

**文件**: `src/games/smashup/domain/baseAbilities.ts`

**关键实现**（第 1063-1118 行）：

```typescript
registerBaseAbility('base_tortuga', 'afterScoring', (ctx) => {
    // 1. 验证亚军存在
    if (!ctx.rankings || ctx.rankings.length < 2) {
        return { events: [] };
    }
    const runnerUpId = ctx.rankings[1].playerId; // ✅ 正确使用 rankings[1]
    
    // 2. 收集亚军在其他基地上的随从
    const otherMinions: { uid: string; defId: string; owner: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        if (i === ctx.baseIndex) continue; // ✅ 排除托尔图加本身
        const base = ctx.state.bases[i];
        for (const m of base.minions) {
            if (m.controller !== runnerUpId) continue; // ✅ 只收集亚军的随从
            // ... 收集随从信息
        }
    }
    
    // 3. 没有符合条件的随从时不触发
    if (otherMinions.length === 0) {
        return { events: [] };
    }
    
    // 4. 创建交互
    const interaction = createSimpleChoice(
        `base_tortuga_${ctx.now}`, runnerUpId, // ✅ 交互给亚军
        '托尔图加：选择移动一个其他基地上的随从到替换基地', options,
        { sourceId: 'base_tortuga', targetType: 'minion' },
    );
    // ...
});
```

### 测试覆盖

**测试文件**: `src/games/smashup/__tests__/audit-d1-base-tortuga.test.ts`

**测试用例**（7 个，全部通过）：

1. ✅ **只有亚军（第2名）可以移动随从**
   - 验证交互的 `playerId` 是亚军 '1'
   
2. ✅ **冠军不能移动随从（即使有随从在其他基地）**
   - 验证选项中只包含亚军的随从，不包含冠军的随从
   
3. ✅ **不能移动托尔图加本身的随从**
   - 验证选项中只包含其他基地的随从（m3），不包含托尔图加本身的随从（m2）
   - 验证 `fromBaseIndex` 正确指向其他基地
   
4. ✅ **可以移动多个其他基地上的随从**
   - 验证选项包含所有符合条件的随从（m3 和 m4）
   - 验证不包含托尔图加本身的随从（m2）
   
5. ✅ **亚军在其他基地没有随从时不触发**
   - 验证不创建交互（`interactions.length === 0`）
   
6. ✅ **只有一个玩家时不触发（无亚军）**
   - 验证不创建交互
   
7. ✅ **afterScoring 使用 rankings[1].playerId 而非 ctx.playerId**
   - 模拟 `ctx.playerId` 是冠军 '0'
   - 验证交互的 `playerId` 仍然是亚军 '1'

### 审计发现

#### ✅ 正确实现

1. **亚军判定正确**：使用 `rankings[1].playerId` 而非 `ctx.playerId`，避免 D8 时序问题
2. **范围限定正确**：通过 `if (i === ctx.baseIndex) continue` 排除托尔图加本身
3. **玩家过滤正确**：通过 `if (m.controller !== runnerUpId) continue` 只收集亚军的随从
4. **边界条件处理正确**：
   - 无亚军时提前返回
   - 无符合条件的随从时提前返回
5. **交互创建正确**：交互的 `playerId` 是亚军，选项包含所有符合条件的随从

#### ❌ 未发现问题

无

## 审计结论

**base_tortuga（托尔图加）的 D1 范围限定实现完全正确**：

1. ✅ 只有亚军可以移动随从
2. ✅ 只能移动其他基地上的随从（非托尔图加本身）
3. ✅ 边界条件处理正确
4. ✅ 不存在 D8 时序问题（正确使用 `rankings[1].playerId`）

**测试覆盖**: 7/7 通过（100%）

**建议**: 无需修改，实现符合规范。

## 附录：测试日志

```
✓ src/games/smashup/__tests__/audit-d1-base-tortuga.test.ts (7 tests) 24ms
  ✓ D1 审计: base_tortuga 范围限定 (7)
    ✓ 亚军身份验证 (2)
      ✓ 只有亚军（第2名）可以移动随从 4ms
      ✓ 冠军不能移动随从（即使有随从在其他基地） 1ms
    ✓ 范围限定：只能移动其他基地上的随从 (2)
      ✓ 不能移动托尔图加本身的随从 2ms
      ✓ 可以移动多个其他基地上的随从（选项包含所有符合条件的随从） 2ms
    ✓ 边界条件 (2)
      ✓ 亚军在其他基地没有随从时不触发 1ms
      ✓ 只有一个玩家时不触发（无亚军） 0ms
    ✓ D8 时序验证：不误用 ctx.playerId (1)
      ✓ afterScoring 使用 rankings[1].playerId 而非 ctx.playerId 1ms

Test Files  1 passed (1)
     Tests  7 passed (7)
```

## 审计人员

- AI Agent (Kiro)
- 审计框架: D1-D47 全维度审计规范
- 参考文档: `docs/ai-rules/testing-audit.md`
