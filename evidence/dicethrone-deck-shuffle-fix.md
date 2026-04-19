# DiceThrone 起手牌恒定问题修复

## 问题描述

用户反馈：教程和创建房间时，起手牌总是一样的，怀疑随机种子（seed）被固定或复用。

## 根因分析

### 问题链路

```
SELECT_CHARACTER 命令
  ↓ (execute.ts)
使用真实 random.shuffle 生成 initialDeckCardIds ✅
  ↓
CHARACTER_SELECTED 事件
  ↓ (reducer.ts)
提取 initialDeckCardIds 但未存储到 state ❌
  ↓
HERO_INITIALIZED 事件
  ↓ (reducer.ts)
使用 dummyRandom (不洗牌) 重新调用 initHeroState ❌
  ↓ (characters.ts)
getStartingDeck(dummyRandom) → 返回固定顺序 ❌
  ↓
hand/deck 永远是固定顺序 ❌
```

### 关键证据

1. **`execute.ts:148`** - `SELECT_CHARACTER` 命令执行时，使用真实 `random.shuffle` 生成 `initialDeckCardIds` 并写入事件
2. **`reducer.ts:1213`** - `handleCharacterSelected` 提取了 `initialDeckCardIds` 但未存储到 `HeroState`
3. **`reducer.ts:1245`** - `handleHeroInitialized` 使用 `dummyRandom`（不洗牌）重新初始化英雄状态
4. **`characters.ts:99`** - `initHeroState` 再次调用 `getStartingDeck(random)`，但传入的是 `dummyRandom`

### 结论

**即使 seed 每局都变化，起手牌仍然会恒定**，因为 reducer 在初始化英雄时使用了 `dummyRandom`（不洗牌），而没有消费 `CHARACTER_SELECTED` 事件中已经生成的 `initialDeckCardIds`。

## 修复方案

### 架构原则

采用**事件数据驱动**模式：
- `initialDeckCardIds` 已经在 `SELECT_CHARACTER` 时通过真实随机生成
- 应该作为"事件数据"被消费，而不是在 reducer 中重新生成
- 确保同局确定性（回放时使用相同的 `initialDeckCardIds`）
- 确保跨局随机性（每次新建 match 时 seed 变化 → `initialDeckCardIds` 变化）

### 修改内容

#### 1. `reducer.ts` - `handleCharacterSelected`

**修改前**：
```typescript
if (initialDeckCardIds && initialDeckCardIds.length > 0) {
    // 注释说"留给 handleHeroInitialized"，但实际没有传递
}
```

**修改后**：
```typescript
if (initialDeckCardIds && initialDeckCardIds.length > 0) {
    player.initialDeckCardIds = initialDeckCardIds;
}
```

#### 2. `reducer.ts` - `handleHeroInitialized`

**修改前**：
```typescript
const dummyRandom: any = { shuffle: (arr: any[]) => arr };
const heroState = initHeroState(playerId, characterId, dummyRandom);
```

**修改后**：
```typescript
const existingPlayer = newState.players[playerId];
const initialDeckCardIds = existingPlayer?.initialDeckCardIds;

const dummyRandom: any = { shuffle: (arr: any[]) => arr };
const heroState = initHeroState(playerId, characterId, dummyRandom, initialDeckCardIds);
```

#### 3. `characters.ts` - `initHeroState`

**修改前**：
```typescript
export function initHeroState(playerId: PlayerId, characterId: SelectableCharacterId, random: RandomFn): HeroState {
    const deck = data.getStartingDeck(random);
    // ...
}
```

**修改后**：
```typescript
export function initHeroState(
    playerId: PlayerId, 
    characterId: SelectableCharacterId, 
    random: RandomFn,
    initialDeckCardIds?: string[]
): HeroState {
    let deck: AbilityCard[];
    
    if (initialDeckCardIds && initialDeckCardIds.length > 0) {
        // 使用事件数据驱动的顺序
        const fullDeck = data.getStartingDeck({ shuffle: (arr) => arr });
        const cardMap = new Map(fullDeck.map(card => [card.id, card]));
        deck = initialDeckCardIds
            .map(id => cardMap.get(id))
            .filter((card): card is AbilityCard => card !== undefined);
        
        // 安全检查：如果顺序不完整，回退到重新洗牌
        if (deck.length !== fullDeck.length) {
            console.warn(`[DiceThrone] initialDeckCardIds 不完整，回退到重新洗牌`);
            deck = data.getStartingDeck(random);
        }
    } else {
        // 没有提供顺序，使用随机洗牌（向后兼容）
        deck = data.getStartingDeck(random);
    }
    
    const startingHand = deck.splice(0, 4);
    // ...
}
```

## 测试结果

运行 `npm test -- src/games/dicethrone/__tests__/ --run`：

- ✅ 70 个流程测试全部通过
- ✅ 8 个英雄选择测试全部通过
- ✅ 所有测试（97 个）全部通过

## 代码清理

修复完成并经用户确认后，清理了所有调试日志：

### 已清理的文件

1. **src/games/dicethrone/domain/execute.ts**
   - 移除 `[PLAY_CARD]` 日志
   - 移除 `[isDefendableAttack]` 日志
   - 移除 `[SKIP_TOKEN_RESPONSE]` 相关的 4 条日志（第 825-858 行）

2. **src/games/dicethrone/domain/effects.ts**
   - 移除 `[DiceThrone][handleGrantExtraRoll]` 日志
   - 移除 `[DiceThrone][handleModifyDieCopy]` 日志

3. **src/games/dicethrone/domain/commands.ts**
   - 移除 `[validatePlayCard] 验证成功` 日志

4. **src/games/dicethrone/domain/attack.ts**
   - 移除 `[resolveAttack]` 日志

### 保留的日志

- `console.warn` 用于错误提示的日志（如 `[DiceThrone] SKIP_TOKEN_RESPONSE: no pending damage`）
- `console.warn` 用于安全检查的日志（如 `[DiceThrone] initialDeckCardIds 不完整，回退到重新洗牌`）

### 清理后测试

```bash
npm test -- src/games/dicethrone/__tests__/ --run
```

**结果**：97 个测试全部通过 ✅（包括 70 个流程测试 + 27 个其他测试）

## 预期效果

### 修复前
- 每次新建房间/教程/Rematch，起手牌总是一样的
- 原因：reducer 使用 `dummyRandom` 重新生成牌库，导致固定顺序

### 修复后
- 每次新建房间/Rematch，起手牌会随机变化（因为 seed 变化 → `initialDeckCardIds` 变化）
- 同一局内回放时，起手牌保持一致（因为使用相同的 `initialDeckCardIds`）
- Tutorial 模式：如果需要固定开局，可以在 `execute.ts` 的 `SELECT_CHARACTER` 中注入固定顺序

### 用户确认

✅ 用户已确认修复成功（需要重启服务器后生效）

## 总结

- **根因**：事件数据流断裂，`initialDeckCardIds` 未被消费
- **修复方案**：事件数据驱动，确保架构正确性优先于改动最小
- **影响范围**：所有模式（教程/创建房间/重赛）
- **测试覆盖**：97 个测试全部通过
- **代码质量**：已清理所有调试日志，保留必要的错误提示和安全检查

## 相关文件

- `src/games/dicethrone/domain/execute.ts` - 命令执行层（生成 `initialDeckCardIds`）
- `src/games/dicethrone/domain/reducer.ts` - 事件处理层（消费 `initialDeckCardIds`）
- `src/games/dicethrone/domain/characters.ts` - 英雄初始化逻辑
- `src/games/dicethrone/domain/types.ts` - `HeroState.initialDeckCardIds` 字段定义

## 日期

2025-01-01
