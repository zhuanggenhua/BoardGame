# Cardia 场上机制实现完成报告

## 实施日期
2026-02-27

## 问题描述
根据规则图片（第3页），发现三个关键机制缺失：

1. ❌ **卡牌应留在场上**：打出的牌应以互相对抗的形式留在场上形成"遭遇序列"，可以受到能力影响。当前实现是直接进入弃牌堆。
2. ❌ **印戒应为卡牌标记**：印戒应以标记的形式放在获胜的那张牌上，玩家总印戒数 = 所有场上卡牌的印戒之和。当前实现是直接计分到玩家总数。
3. ❌ **缺少持续能力标记机制**：需要可见的 🔄 标记显示在卡牌上。

## 实施方案

### 1. 数据结构变更

#### 1.1 PlayedCard 接口（`core-types.ts`）
```typescript
export interface PlayedCard {
    // 继承 CardInstance 的所有字段
    uid: string;
    defId: string;
    ownerId: PlayerId;
    baseInfluence: number;
    faction: FactionType;
    abilityIds: AbilityId[];
    difficulty: number;
    modifiers: ModifierStack<CardiaContext>;
    tags: TagContainer;
    signets: number;          // 这张牌上的印戒数量
    ongoingMarkers: AbilityId[];  // 持续能力标记列表
    imageIndex?: number;
    imagePath?: string;
    
    // PlayedCard 特有字段
    encounterIndex: number;   // 遭遇序号（第几次遭遇，从1开始）
}
```

#### 1.2 PlayerState 新增字段（`core-types.ts`）
```typescript
export interface PlayerState {
    // ... 其他字段
    playedCards: PlayedCard[];  // 场上卡牌（遭遇序列）
    signets: number;  // 已废弃，使用 getTotalSignets() 计算
}
```

### 2. 核心逻辑变更

#### 2.1 印戒计算（`utils.ts`）
```typescript
/**
 * 计算玩家的总印戒数（从所有场上卡牌的印戒标记求和）
 */
export function getTotalSignets(player: PlayerState): number {
    return player.playedCards.reduce((sum, card) => sum + card.signets, 0);
}
```

#### 2.2 印戒授予事件（`events.ts`）
- **移除字段**：`newTotal`（不再需要，印戒直接加到卡牌上）
- **保留字段**：`playerId`, `cardUid`

```typescript
export interface SignetGrantedEvent extends GameEvent<'SIGNET_GRANTED'> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        // newTotal 已移除
    };
}
```

#### 2.3 印戒归约逻辑（`reduce.ts`）
```typescript
function reduceSignetGranted(core, event) {
    // 在场上卡牌中查找目标卡牌
    const cardIndex = player.playedCards.findIndex(c => c.uid === cardUid);
    
    // 更新卡牌上的印戒数量
    const updatedCard = {
        ...player.playedCards[cardIndex],
        signets: player.playedCards[cardIndex].signets + 1,
    };
    
    // 更新 playedCards 数组
}
```

#### 2.4 回合结束逻辑（`reduce.ts`）
```typescript
function reduceTurnEnded(core, event) {
    // 将当前卡牌移至场上（playedCards）
    for (const playerId of core.playerOrder) {
        if (player.currentCard) {
            const playedCard = {
                ...player.currentCard,
                encounterIndex: core.turnNumber,
            };
            newPlayedCards = [...player.playedCards, playedCard];
        }
    }
}
```

#### 2.5 游戏结束判定（`domain/index.ts`）
```typescript
isGameOver: (core) => {
    const getTotalSignets = (player) => {
        return player.playedCards.reduce((sum, card) => sum + card.signets, 0);
    };
    
    // 检查是否有玩家获得足够的印戒（从场上卡牌计算）
    for (const playerId of core.playerOrder) {
        const totalSignets = getTotalSignets(player);
        if (totalSignets >= core.targetSignets) {
            return { winner: playerId };
        }
    }
}
```

### 3. UI 变更

#### 3.1 遭遇序列显示（`Board.tsx`）
```typescript
{/* 场上卡牌序列（遭遇序列） */}
{player.playedCards.length > 0 && (
    <div className="mb-2">
        <div className="text-xs text-gray-400 mb-1">{t('encounterSequence')}</div>
        <div className="flex gap-1 overflow-x-auto">
            {player.playedCards.map((card) => (
                <MiniCardDisplay key={card.uid} card={card} />
            ))}
        </div>
    </div>
)}
```

#### 3.2 迷你卡牌组件（`Board.tsx`）
```typescript
const MiniCardDisplay: React.FC<MiniCardDisplayProps> = ({ card }) => {
    return (
        <div className="relative w-16 h-24 rounded border">
            {/* 背景颜色 */}
            <div className={`bg-gradient-to-br ${bgColor}`} />
            
            {/* 影响力值 */}
            <div className="absolute top-0.5 left-0.5">
                {card.baseInfluence}
            </div>
            
            {/* 印戒标记 */}
            {card.signets > 0 && (
                <div className="absolute bottom-0.5">
                    {Array.from({ length: card.signets }).map((_, i) => (
                        <div key={i} className="w-2 h-2 bg-yellow-400 rounded-full" />
                    ))}
                </div>
            )}
            
            {/* 持续能力标记 */}
            {card.ongoingMarkers && card.ongoingMarkers.length > 0 && (
                <div className="absolute top-0.5 right-0.5">🔄</div>
            )}
        </div>
    );
};
```

#### 3.3 玩家信息显示（`Board.tsx`）
```typescript
// 计算总印戒数（从场上卡牌）
const getTotalSignets = (player) => {
    return player.playedCards.reduce((sum, card) => sum + card.signets, 0);
};
const mySignets = getTotalSignets(myPlayer);
const opponentSignets = getTotalSignets(opponent);

// 传递给 PlayerArea 组件
<PlayerArea totalSignets={mySignets} />
```

### 4. 国际化

#### 4.1 新增翻译键
```json
// zh-CN
{
  "played": "场上",
  "encounterSequence": "遭遇序列"
}

// en
{
  "played": "Played",
  "encounterSequence": "Encounter Sequence"
}
```

## 测试更新

### 4.1 reduce.test.ts
```typescript
describe('SIGNET_GRANTED', () => {
    it('should add signet to card on board', () => {
        // 先将卡牌放到场上
        const playedCard = { ...card, encounterIndex: 1 };
        const stateWithPlayedCard = {
            ...state,
            players: {
                ...state.players,
                '0': {
                    ...state.players['0'],
                    playedCards: [playedCard],
                },
            },
        };
        
        // 验证卡牌上的印戒数量增加
        expect(newState.players['0'].playedCards[0].signets).toBe(1);
    });
});
```

### 4.2 game-flow.test.ts
```typescript
it('应该在玩家达到目标印戒数时结束游戏', () => {
    // 创建一张有5个印戒的场上卡牌
    const playedCard = {
        ...card,
        encounterIndex: 1,
        signets: 5,
    };
    
    // 将卡牌放到场上
    core.players['0'].playedCards = [playedCard];
    
    // 验证游戏结束
    const gameOver = CardiaDomain.isGameOver?.(core);
    expect(gameOver).toBeDefined();
    expect(gameOver.winner).toBe('0');
});
```

## 测试结果

```
✓ src/games/cardia/__tests__/smoke.test.ts (3 tests)
✓ src/games/cardia/__tests__/utils.test.ts (5 tests)
✓ src/games/cardia/__tests__/execute.test.ts (9 tests)
✓ src/games/cardia/__tests__/reduce.test.ts (9 tests)
✓ src/games/cardia/__tests__/interaction.test.ts (10 tests)
✓ src/games/cardia/__tests__/game-flow.test.ts (4 tests)
✓ src/games/cardia/__tests__/validate.test.ts (13 tests)
✓ src/games/cardia/__tests__/ability-executor.test.ts (4 tests)

Test Files  8 passed (8)
Tests  57 passed (57)
```

## 架构优势

### 1. 符合规则
- ✅ 卡牌留在场上形成遭遇序列
- ✅ 印戒作为卡牌标记，玩家总数 = 场上卡牌印戒之和
- ✅ 持续能力标记可见（🔄）

### 2. 可扩展性
- ✅ 支持能力影响场上卡牌（如移除印戒、修改影响力）
- ✅ 支持空间关系查询（上一次遭遇、过去的遭遇）
- ✅ 支持持续能力标记管理

### 3. 数据一致性
- ✅ 单一真实来源：印戒数据存储在卡牌上
- ✅ 计算函数：`getTotalSignets()` 统一计算逻辑
- ✅ 类型安全：PlayedCard 接口明确定义

### 4. UI 可读性
- ✅ 遭遇序列可视化
- ✅ 印戒标记直观显示
- ✅ 持续能力标记清晰标识

## 后续工作

### 1. 能力系统集成
- [ ] 更新能力执行器以支持场上卡牌操作
- [ ] 实现"移除印戒"类能力
- [ ] 实现"修改场上卡牌影响力"类能力

### 2. 持续能力标记
- [ ] 完善 `ongoingMarkers` 的添加/移除逻辑
- [ ] 在 `reduceOngoingAdded` 中更新卡牌的 `ongoingMarkers`
- [ ] 在 UI 中显示持续能力的具体效果

### 3. E2E 测试
- [ ] 添加场上卡牌序列的 E2E 测试
- [ ] 验证印戒标记的视觉显示
- [ ] 验证持续能力标记的交互

## 文件变更清单

### 核心逻辑
- `src/games/cardia/domain/core-types.ts` - 新增 PlayedCard 接口，PlayerState 新增 playedCards 字段
- `src/games/cardia/domain/events.ts` - 移除 SIGNET_GRANTED 的 newTotal 字段
- `src/games/cardia/domain/reduce.ts` - 更新 reduceSignetGranted 和 reduceTurnEnded
- `src/games/cardia/domain/execute.ts` - 移除 SIGNET_GRANTED 事件的 newTotal 参数
- `src/games/cardia/domain/utils.ts` - 新增 getTotalSignets() 和 toPlayedCard()
- `src/games/cardia/domain/index.ts` - 更新 isGameOver 使用 getTotalSignets()

### UI
- `src/games/cardia/Board.tsx` - 新增遭遇序列显示和 MiniCardDisplay 组件

### 国际化
- `public/locales/zh-CN/game-cardia.json` - 新增 "played" 和 "encounterSequence"
- `public/locales/en/game-cardia.json` - 新增 "played" 和 "encounterSequence"

### 测试
- `src/games/cardia/__tests__/reduce.test.ts` - 更新 SIGNET_GRANTED 测试
- `src/games/cardia/__tests__/game-flow.test.ts` - 更新游戏结束测试

## 总结

成功实现了 Cardia 的三个关键场上机制：

1. **卡牌留在场上**：打出的卡牌不再进入弃牌堆，而是留在 `playedCards` 数组中形成遭遇序列
2. **印戒作为卡牌标记**：印戒存储在每张卡牌的 `signets` 字段，玩家总印戒数通过 `getTotalSignets()` 计算
3. **持续能力标记**：卡牌的 `ongoingMarkers` 字段存储持续能力 ID，UI 显示 🔄 标记

所有 57 个单元测试通过，架构符合"面向百游戏设计"原则，数据驱动，类型安全，可扩展。
