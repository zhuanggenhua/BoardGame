# Plateau of Leng 实现 Bug

## 问题

当前"直接授予额度"实现存在严重 bug：**没有正确保存触发能力时的随从 defId**。

## 当前实现

### 1. 基地能力（正确）
```typescript
// src/games/smashup/domain/baseAbilities_expansion.ts
registerBaseAbility('base_plateau_of_leng', 'onMinionPlayed', (ctx) => {
    // ...
    return {
        events: [
            grantExtraMinion(
                ctx.playerId,
                'base_plateau_of_leng',
                ctx.now,
                ctx.baseIndex, // 限定到此基地
                { sameNameOnly: true, sameNameDefId: ctx.minionDefId }, // ✅ 传递了 defId
            ),
        ],
    };
});
```

### 2. Reduce 层（❌ 错误）
```typescript
// src/games/smashup/domain/reduce.ts
case SU_EVENTS.LIMIT_MODIFIED: {
    const { playerId, limitType, delta, restrictToBase, powerMax, sameNameOnly, sameNameDefId } = event.payload;
    const player = state.players[playerId];
    if (limitType === 'minion') {
        if (restrictToBase !== undefined) {
            const updatedPlayer: typeof player = {
                ...player,
                baseLimitedMinionQuota: {
                    ...oldQuota,
                    [restrictToBase]: (oldQuota[restrictToBase] ?? 0) + delta,
                },
            };
            // ❌ 只保存了布尔标记，没有保存 defId
            if (sameNameOnly) {
                updatedPlayer.baseLimitedSameNameRequired = {
                    ...(player.baseLimitedSameNameRequired ?? {}),
                    [restrictToBase]: true,
                };
            }
            return {
                ...state,
                players: { ...state.players, [playerId]: updatedPlayer },
            };
        }
        // ...
    }
}
```

### 3. 验证层（❌ 错误）
```typescript
// src/games/smashup/domain/commands.ts
if (player.baseLimitedSameNameRequired?.[baseIndex]) {
    // ❌ 检查"基地上是否有同名随从"，而不是"是否与触发能力的随从同名"
    const base = core.bases[baseIndex];
    const baseDefIds = new Set(base.minions.map(m => m.defId));
    if (!baseDefIds.has(card.defId)) {
        return { valid: false, error: '只能打出与该基地上随从同名的随从' };
    }
}
```

## Bug 场景

### 场景 1：随从被消灭（❌ 会失败）
1. 玩家打出第一个"本地人"到 Plateau of Leng → 触发能力，授予额度
2. "本地人"被对手消灭或移走
3. 玩家想用额度打出第二个"本地人"
4. **验证层检查**：基地上是否有"本地人" → ❌ 没有 → **拒绝**（错误！）

### 场景 2：先打出其他随从（✅ 会成功，但逻辑错误）
1. 玩家打出第一个"本地人"到 Plateau of Leng → 触发能力，授予额度
2. 玩家打出"其他随从"到同一基地
3. 玩家想用额度打出第二个"本地人"
4. **验证层检查**：基地上是否有"本地人" → ✅ 有（第一个） → **允许**（碰巧正确）

### 场景 3：本地人的 onPlay 能力（❌ 会失败）
1. 玩家打出第一个"本地人"到 Plateau of Leng → 触发能力，授予额度
2. "本地人"的 onPlay 能力：翻开牌库顶 3 张，把"本地人"放入手牌
3. 玩家想用额度打出新获得的"本地人"
4. **验证层检查**：基地上是否有"本地人" → ✅ 有（第一个） → **允许**（碰巧正确）
5. 但如果第一个"本地人"在此期间被消灭 → ❌ 拒绝（错误！）

## 正确实现

### 1. 类型定义（需要添加）
```typescript
// src/games/smashup/domain/types.ts
export interface PlayerState {
    // ...
    /** 基地限定额度是否要求同名（baseIndex → true），与 baseLimitedMinionQuota 配合 */
    baseLimitedSameNameRequired?: Record<number, boolean>;
    /** 基地限定额度的同名 defId（baseIndex → defId），与 baseLimitedSameNameRequired 配合 */
    baseLimitedSameNameDefId?: Record<number, string>; // ✅ 新增字段
    // ...
}
```

### 2. Reduce 层（需要修复）
```typescript
// src/games/smashup/domain/reduce.ts
case SU_EVENTS.LIMIT_MODIFIED: {
    const { playerId, limitType, delta, restrictToBase, powerMax, sameNameOnly, sameNameDefId } = event.payload;
    const player = state.players[playerId];
    if (limitType === 'minion') {
        if (restrictToBase !== undefined) {
            const updatedPlayer: typeof player = {
                ...player,
                baseLimitedMinionQuota: {
                    ...oldQuota,
                    [restrictToBase]: (oldQuota[restrictToBase] ?? 0) + delta,
                },
            };
            // ✅ 保存同名约束标记和 defId
            if (sameNameOnly) {
                updatedPlayer.baseLimitedSameNameRequired = {
                    ...(player.baseLimitedSameNameRequired ?? {}),
                    [restrictToBase]: true,
                };
                // ✅ 保存触发能力时的随从 defId
                if (sameNameDefId) {
                    updatedPlayer.baseLimitedSameNameDefId = {
                        ...(player.baseLimitedSameNameDefId ?? {}),
                        [restrictToBase]: sameNameDefId,
                    };
                }
            }
            return {
                ...state,
                players: { ...state.players, [playerId]: updatedPlayer },
            };
        }
        // ...
    }
}
```

### 3. 验证层（需要修复）
```typescript
// src/games/smashup/domain/commands.ts
if (player.baseLimitedSameNameRequired?.[baseIndex]) {
    // ✅ 检查"是否与触发能力的随从同名"
    const requiredDefId = player.baseLimitedSameNameDefId?.[baseIndex];
    if (requiredDefId && card.defId !== requiredDefId) {
        return { valid: false, error: `只能打出与触发能力的随从同名的随从（${requiredDefId}）` };
    }
}
```

## 影响范围

### 受影响的能力
1. **Plateau of Leng**（冷原高地）- 本次修复的目标
2. **Innsmouth: Spreading the Word**（印斯茅斯：传播福音）- 也使用了 `sameNameOnly` + `restrictToBase` 的组合

### 测试覆盖
- ❌ 现有测试没有覆盖"随从被消灭后使用额度"的场景
- ❌ 现有测试没有覆盖"本地人 onPlay 能力获得新卡后使用额度"的场景

## 修复优先级

**高优先级** - 这是一个严重的逻辑错误，会导致玩家无法使用合法的额度。

## 修复步骤

1. 添加类型定义：`baseLimitedSameNameDefId?: Record<number, string>`
2. 修复 reduce 层：保存 `sameNameDefId` 到 `baseLimitedSameNameDefId[baseIndex]`
3. 修复验证层：检查 `card.defId === player.baseLimitedSameNameDefId?.[baseIndex]`
4. 添加测试：覆盖"随从被消灭后使用额度"的场景
5. 回归测试：确保 Plateau of Leng 和 Innsmouth 的所有场景都正确

## 参考

- 实现文件：`src/games/smashup/domain/baseAbilities_expansion.ts`
- Reduce 文件：`src/games/smashup/domain/reduce.ts`
- 验证文件：`src/games/smashup/domain/commands.ts`
- 类型定义：`src/games/smashup/domain/types.ts`
- 测试文件：`src/games/smashup/__tests__/expansionBaseAbilities.test.ts`
