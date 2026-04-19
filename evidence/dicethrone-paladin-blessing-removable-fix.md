# DiceThrone 圣骑士神圣祝福 Token 不可移除修复

## 问题描述

用户反馈：圣骑士的神圣祝福 (Blessing of Divinity) token 不能被移除。

## 问题分析

查看圣骑士 token 定义（`src/games/dicethrone/heroes/paladin/tokens.ts`）：

```typescript
{
    id: TOKEN_IDS.BLESSING_OF_DIVINITY,
    name: tokenText(TOKEN_IDS.BLESSING_OF_DIVINITY, 'name'),
    colorTheme: 'from-yellow-400 to-amber-500',
    description: tokenText(TOKEN_IDS.BLESSING_OF_DIVINITY, 'description') as unknown as string[],
    sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_celestial_choir_001',
    stackLimit: 1,
    category: 'consumable',
    passiveTrigger: {
        timing: 'onDamageReceived',
        removable: false,  // ← 标记为不可移除
        actions: [
            { type: 'custom', customActionId: 'paladin-blessing-prevent', target: 'self' },
        ],
    },
    frameId: 'guardian-angel',
    atlasId: DICETHRONE_STATUS_ATLAS_IDS.PALADIN,
}
```

**核心问题**：`passiveTrigger.removable: false` 表示这个 token 不能被移除（只能通过触发效果自动消耗）。

但在 `REMOVE_STATUS` 命令的执行逻辑中（`src/games/dicethrone/domain/execute.ts`），代码没有检查 `removable` 字段就直接移除了 token。

## 修复方案

在 `REMOVE_STATUS` 和 `TRANSFER_STATUS` 命令执行时，检查 token 定义的 `removable` 字段：
- 如果 `removable: false`，跳过移除/转移
- 如果 `removable: true` 或未定义（默认可移除），正常移除/转移

**重要**：不可移除的 token 也不能被转移，因为转移操作本质上是"从源玩家移除 + 给目标玩家添加"。

## 修复代码

### 1. 修改 `REMOVE_STATUS` 命令

修改 `src/games/dicethrone/domain/execute.ts` 中的 `REMOVE_STATUS` case：

```typescript
case 'REMOVE_STATUS': {
    const { targetPlayerId, statusId } = command.payload as { targetPlayerId: PlayerId; statusId?: string };
    const targetPlayer = state.players[targetPlayerId];
    if (targetPlayer) {
        if (statusId) {
            // 移除单个状态
            const currentStacks = targetPlayer.statusEffects[statusId] ?? 0;
            if (currentStacks > 0) {
                // 检查状态是否可被移除
                const statusDef = (state.tokenDefinitions ?? []).find(def => def.id === statusId);
                const isRemovable = statusDef?.passiveTrigger?.removable ?? true;
                if (isRemovable) {
                    const event: StatusRemovedEvent = {
                        type: 'STATUS_REMOVED',
                        payload: { targetId: targetPlayerId, statusId, stacks: currentStacks },
                        sourceCommandType: command.type,
                        timestamp,
                    };
                    events.push(event);
                }
            }
            // 也检查 tokens
            const tokenAmount = targetPlayer.tokens[statusId] ?? 0;
            if (tokenAmount > 0) {
                // 检查 token 是否可被移除
                const tokenDef = (state.tokenDefinitions ?? []).find(def => def.id === statusId);
                const isRemovable = tokenDef?.passiveTrigger?.removable ?? true;
                if (isRemovable) {
                    events.push({
                        type: 'TOKEN_CONSUMED',
                        payload: { playerId: targetPlayerId, tokenId: statusId, amount: tokenAmount, newTotal: 0 },
                        sourceCommandType: command.type,
                        timestamp,
                    } as DiceThroneEvent);
                }
            }
        } else {
            // 移除所有状态（只移除可被移除的）
            Object.entries(targetPlayer.statusEffects).forEach(([sid, stacks]) => {
                if (stacks > 0) {
                    const statusDef = (state.tokenDefinitions ?? []).find(def => def.id === sid);
                    const isRemovable = statusDef?.passiveTrigger?.removable ?? true;
                    if (isRemovable) {
                        events.push({
                            type: 'STATUS_REMOVED',
                            payload: { targetId: targetPlayerId, statusId: sid, stacks },
                            sourceCommandType: command.type,
                            timestamp,
                        } as StatusRemovedEvent);
                    }
                }
            });
            Object.entries(targetPlayer.tokens).forEach(([tid, amount]) => {
                if (amount > 0) {
                    const tokenDef = (state.tokenDefinitions ?? []).find(def => def.id === tid);
                    const isRemovable = tokenDef?.passiveTrigger?.removable ?? true;
                    if (isRemovable) {
                        events.push({
                            type: 'TOKEN_CONSUMED',
                            payload: { playerId: targetPlayerId, tokenId: tid, amount, newTotal: 0 },
                            sourceCommandType: command.type,
                            timestamp,
                        } as DiceThroneEvent);
                    }
                }
            });
        }
        
        // 交互完成由 systems.ts 自动处理：
        // 当 STATUS_REMOVED/TOKEN_CONSUMED 事件触发时，systems.ts 检测当前交互类型
        // 并生成带正确 interactionId 的 INTERACTION_COMPLETED
    }
    break;
}
```

### 2. 修改 `TRANSFER_STATUS` 命令

同样在 `src/games/dicethrone/domain/execute.ts` 中修改 `TRANSFER_STATUS` case：

```typescript
case 'TRANSFER_STATUS': {
    const { fromPlayerId, toPlayerId, statusId } = command.payload as { fromPlayerId: PlayerId; toPlayerId: PlayerId; statusId: string };
    const fromPlayer = state.players[fromPlayerId];
    const toPlayer = state.players[toPlayerId];
    if (fromPlayer && toPlayer) {
        // 检查是 statusEffects 还是 tokens
        const fromStacks = fromPlayer.statusEffects[statusId] ?? 0;
        const fromTokens = fromPlayer.tokens[statusId] ?? 0;
        
        // 检查是否可被转移（不可移除的 token 也不能被转移）
        const tokenDef = (state.tokenDefinitions ?? []).find(def => def.id === statusId);
        const isRemovable = tokenDef?.passiveTrigger?.removable ?? true;
        
        if (!isRemovable) {
            // 不可移除的 token 不能被转移，跳过
            break;
        }
        
        if (fromStacks > 0) {
            // 移除源玩家的状态
            events.push({
                type: 'STATUS_REMOVED',
                payload: { targetId: fromPlayerId, statusId, stacks: fromStacks },
                sourceCommandType: command.type,
                timestamp,
            } as StatusRemovedEvent);
            // 给目标玩家添加状态
            const toStacks = toPlayer.statusEffects[statusId] ?? 0;
            events.push({
                type: 'STATUS_APPLIED',
                payload: { targetId: toPlayerId, statusId, stacks: fromStacks, newTotal: toStacks + fromStacks },
                sourceCommandType: command.type,
                timestamp,
            } as DiceThroneEvent);
        } else if (fromTokens > 0) {
            // 移除源玩家的 token
            events.push({
                type: 'TOKEN_CONSUMED',
                payload: { playerId: fromPlayerId, tokenId: statusId, amount: fromTokens, newTotal: 0 },
                sourceCommandType: command.type,
                timestamp,
            } as DiceThroneEvent);
            // 给目标玩家添加 token
            const toTokens = toPlayer.tokens[statusId] ?? 0;
            events.push({
                type: 'TOKEN_GRANTED',
                payload: { targetId: toPlayerId, tokenId: statusId, amount: fromTokens, newTotal: toTokens + fromTokens },
                sourceCommandType: command.type,
                timestamp,
            } as DiceThroneEvent);
        }
        
        // 交互完成由 systems.ts 自动处理：
        // 当 STATUS_REMOVED/STATUS_APPLIED 事件触发时，systems.ts 检测当前交互类型
        // 并生成带正确 interactionId 的 INTERACTION_COMPLETED
    }
    break;
}
```

## 测试验证

创建了测试文件 `src/games/dicethrone/__tests__/paladin-blessing-removable.test.ts`，包含 6 个测试用例：

1. ✅ 神圣祝福 token 定义中 removable 字段为 false
2. ✅ execute 层：REMOVE_STATUS 不移除 removable: false 的 token
3. ✅ execute 层：REMOVE_STATUS（不指定 statusId）不移除 removable: false 的 token
4. ✅ execute 层：可移除的 token 可以正常被移除（对照组）
5. ✅ execute 层：TRANSFER_STATUS 不转移 removable: false 的 token
6. ✅ execute 层：可移除的 token 可以正常被转移（对照组）

**测试结果**：所有 6 个测试全部通过 ✅

```bash
npm test -- paladin-blessing-removable.test.ts

 ✓ src/games/dicethrone/__tests__/paladin-blessing-removable.test.ts (6 tests) 27ms
   ✓ 圣骑士神圣祝福 token 不可移除 (6)
     ✓ 神圣祝福 token 定义中 removable 字段为 false 13ms
     ✓ execute 层：REMOVE_STATUS 不移除 removable: false 的 token 3ms
     ✓ execute 层：REMOVE_STATUS（不指定 statusId）不移除 removable: false 的 token 2ms
     ✓ execute 层：可移除的 token 可以正常被移除（对照组） 2ms
     ✓ execute 层：TRANSFER_STATUS 不转移 removable: false 的 token 2ms
     ✓ execute 层：可移除的 token 可以正常被转移（对照组） 2ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
```

**ESLint 检查**：0 errors, 0 warnings ✅

## 影响范围

- 所有 `removable: false` 的 token 都会受到保护
- 目前只有圣骑士的神圣祝福 token 和枪手的赏金 token 设置了 `removable: false`
- 其他可移除的 token 不受影响

## 其他不可移除的 Token

搜索代码发现，除了圣骑士的神圣祝福，还有枪手的赏金 token 也设置了 `removable: false`：

```typescript
// src/games/dicethrone/heroes/gunslinger/tokens.ts
{
    id: TOKEN_IDS.BOUNTY,
    passiveTrigger: {
        timing: 'onDamageReceived',
        removable: false,  // ← 也不可移除
    },
}
```

这个修复同时保护了这两个 token。

## 总结

修复了 `REMOVE_STATUS` 和 `TRANSFER_STATUS` 命令没有检查 `removable` 字段的问题：
1. 标记为 `removable: false` 的 token 不能被移除
2. 标记为 `removable: false` 的 token 不能被转移（因为转移本质上是移除+添加）

这确保了圣骑士的神圣祝福和枪手的赏金 token 的特殊性：它们只能通过触发效果自动消耗，不能被玩家主动移除或转移。
