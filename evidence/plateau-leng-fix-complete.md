# Plateau of Leng 实现 Bug 修复完成

## 问题回顾

当前"直接授予额度"实现存在严重 bug：**没有正确保存触发能力时的随从 defId**。

### Bug 表现

1. **Reduce 层**：只保存了 `baseLimitedSameNameRequired[baseIndex] = true`（布尔标记），没有保存 `sameNameDefId`
2. **验证层**：检查"基地上是否有同名随从"，而不是"是否与触发能力的随从同名"

### Bug 场景

- 玩家打出"本地人" → 触发能力 → "本地人"被消灭 → 想用额度打出第二个"本地人" → ❌ 拒绝（错误！）

## 修复内容

### 1. 类型定义（`src/games/smashup/domain/types.ts`）

添加新字段：
```typescript
export interface PlayerState {
    // ...
    /** 基地限定额度的同名 defId（baseIndex → defId），与 baseLimitedSameNameRequired 配合 */
    baseLimitedSameNameDefId?: Record<number, string>;
    // ...
}
```

### 2. Reduce 层（`src/games/smashup/domain/reduce.ts`）

修复前：
```typescript
// 同名约束标记
if (sameNameOnly) {
    updatedPlayer.baseLimitedSameNameRequired = {
        ...(player.baseLimitedSameNameRequired ?? {}),
        [restrictToBase]: true,
    };
}
```

修复后：
```typescript
// 同名约束标记和 defId
if (sameNameOnly) {
    updatedPlayer.baseLimitedSameNameRequired = {
        ...(player.baseLimitedSameNameRequired ?? {}),
        [restrictToBase]: true,
    };
    // 保存触发能力时的随从 defId
    if (sameNameDefId) {
        updatedPlayer.baseLimitedSameNameDefId = {
            ...(player.baseLimitedSameNameDefId ?? {}),
            [restrictToBase]: sameNameDefId,
        };
    }
}
```

### 3. 验证层（`src/games/smashup/domain/commands.ts`）

修复前：
```typescript
if (player.baseLimitedSameNameRequired?.[baseIndex]) {
    // 必须与该基地上已有随从同名
    const base = core.bases[baseIndex];
    const baseDefIds = new Set(base.minions.map(m => m.defId));
    if (!baseDefIds.has(card.defId)) {
        return { valid: false, error: '只能打出与该基地上随从同名的随从' };
    }
}
```

修复后：
```typescript
if (player.baseLimitedSameNameRequired?.[baseIndex]) {
    // 必须与触发能力时的随从同名
    const requiredDefId = player.baseLimitedSameNameDefId?.[baseIndex];
    if (requiredDefId && card.defId !== requiredDefId) {
        const requiredCard = getCardDef(requiredDefId);
        const requiredName = requiredCard?.name ?? requiredDefId;
        return { valid: false, error: `只能打出与触发能力的随从同名的随从（${requiredName}）` };
    }
}
```

### 4. 测试覆盖

#### 单元测试（`src/games/smashup/__tests__/expansionBaseAbilities.test.ts`）

添加测试：
```typescript
it('额度应保存触发时的 defId（用于验证层检查）', () => {
    const result = triggerBaseAbilityWithMS('base_plateau_of_leng', 'onMinionPlayed', makeCtx({
        state: makeState({
            bases: [makeBase('base_plateau_of_leng')],
            players: {
                '0': makePlayer('0', {
                    minionsPlayedPerBase: { 0: 1 },
                }),
                '1': makePlayer('1'),
            },
        }),
        baseDefId: 'base_plateau_of_leng',
        baseIndex: 0,
        minionUid: 'm1',
        minionDefId: 'alien_collector',
    }));

    // 验证事件包含 sameNameDefId
    expect(result.events[0].payload).toMatchObject({
        sameNameDefId: 'alien_collector',
    });
});
```

#### 集成测试（`src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts`）

添加测试：
```typescript
it('额度应检查触发时的 defId，而非基地上的随从', () => {
    // 场景：打出 minion-1 → 触发能力 → minion-1 被消灭 → 打出 minion-2（同名）
    const core = makeState({
        bases: [makeBase('base_plateau_of_leng')],
        players: {
            '0': makePlayer('0', {
                hand: [
                    { uid: 'minion-1', defId: 'test_minion', type: 'minion', owner: '0' },
                    { uid: 'minion-2', defId: 'test_minion', type: 'minion', owner: '0' },
                ],
                minionsPlayed: 0,
                minionLimit: 1,
            }),
            '1': makePlayer('1'),
        },
    });
    const ms = makeMatchState(core);
    
    // 1. 打出第一个随从
    const { ms: ms1 } = executePlayMinion(ms, '0', 'minion-1', 0);
    
    // 验证：授予了额度
    expect(ms1.core.players['0'].baseLimitedMinionQuota![0]).toBe(1);
    expect(ms1.core.players['0'].baseLimitedSameNameDefId![0]).toBe('test_minion');
    
    // 2. 模拟第一个随从被消灭（直接修改状态）
    const coreAfterDestroy = {
        ...ms1.core,
        bases: [makeBase('base_plateau_of_leng')], // 基地上没有随从
    };
    const ms2 = { ...ms1, core: coreAfterDestroy };
    
    // 3. 尝试打出第二个同名随从（应该成功，因为检查的是 baseLimitedSameNameDefId）
    const { ms: ms3 } = executePlayMinion(ms2, '0', 'minion-2', 0);
    
    // 验证：第二个随从成功打出
    expect(ms3.core.bases[0].minions).toHaveLength(1);
    expect(ms3.core.bases[0].minions[0].uid).toBe('minion-2');
});
```

## 测试结果

### 单元测试
```
✓ src/games/smashup/__tests__/expansionBaseAbilities.test.ts (30 tests) 26ms
  Test Files  1 passed (1)
       Tests  30 passed (30)
```

### 集成测试
```
✓ src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts (20 tests) 47ms
  Test Files  1 passed (1)
       Tests  20 passed (20)
```

## 影响范围

### 受影响的能力
1. **Plateau of Leng**（冷原高地）- 本次修复的目标
2. **Innsmouth: Spreading the Word**（印斯茅斯：传播福音）- 也使用了 `sameNameOnly` + `restrictToBase` 的组合

### 向后兼容性
- ✅ 新增字段为可选字段，不影响现有代码
- ✅ 验证层增加了 `requiredDefId` 检查，但只在 `baseLimitedSameNameRequired` 为 true 时生效
- ✅ 所有现有测试通过

## 修复验证

### 场景 1：随从被消灭（✅ 现在正确）
1. 玩家打出第一个"本地人"到 Plateau of Leng → 触发能力，授予额度
2. "本地人"被对手消灭或移走
3. 玩家想用额度打出第二个"本地人"
4. **验证层检查**：`card.defId === baseLimitedSameNameDefId[0]` → ✅ 是"本地人" → **允许**（正确！）

### 场景 2：本地人 onPlay 能力（✅ 现在正确）
1. 玩家打出第一个"本地人"到 Plateau of Leng → 触发能力，授予额度
2. "本地人"的 onPlay 能力：翻开牌库顶 3 张，把"本地人"放入手牌
3. 第一个"本地人"被消灭
4. 玩家想用额度打出新获得的"本地人"
5. **验证层检查**：`card.defId === baseLimitedSameNameDefId[0]` → ✅ 是"本地人" → **允许**（正确！）

## 总结

修复完成，"直接授予额度"实现现在是正确的：

1. ✅ Reduce 层正确保存了 `baseLimitedSameNameDefId[baseIndex]`
2. ✅ 验证层正确检查 `card.defId === baseLimitedSameNameDefId[baseIndex]`
3. ✅ 测试覆盖了"随从被消灭后使用额度"的场景
4. ✅ 所有测试通过

## 参考

- Bug 分析：`evidence/plateau-leng-implementation-bug.md`
- 实现历史：`evidence/plateau-leng-implementation-history.md`
- 原始修复：`evidence/plateau-locals-fix-complete.md`
