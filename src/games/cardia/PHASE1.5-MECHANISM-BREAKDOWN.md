# Cardia - Phase 1.5 机制分解与数据结构设计

## 1. 核心机制映射到引擎原语

### 1.1 区域管理 (Zones)
**游戏机制**：
- 手牌 (hand)
- 牌库 (deck)
- 弃牌堆 (discard)
- 已打出的卡牌序列 (played cards / encounter sequence)

**引擎映射**：
- ✅ 使用 `engine/primitives/zones.ts`
- 手牌/牌库/弃牌堆：标准 `CardLike[]` 数组
- 已打出序列：需要额外的 `playedCards: CardInstance[]` 数组（保持顺序）
- 操作：`drawCards()`, `playFromHand()`, `discardFromHand()`

### 1.2 影响力修正系统 (Influence Modifiers)
**游戏机制**：
- 卡牌基础影响力值 (1-16)
- 修正标记 (+1, +3, +5, -1, -3, -5)
- 修正可叠加

**引擎映射**：
- ✅ 使用 `engine/primitives/modifier.ts`
- 创建 `ModifierStack<CardiaContext>` 用于每张卡牌
- 修正类型：`type: 'flat'`
- 示例：`{ id: 'token_+3', type: 'flat', value: 3, source: 'modifier_token' }`

### 1.3 状态效果系统 (Status/Ongoing Effects)
**游戏机制**：
- 持续效果 (🔄 ongoing abilities)
- 持续效果标记 (ongoing markers)
- 效果可被移除

**引擎映射**：
- ✅ 使用 `engine/primitives/tags.ts`
- 创建 `TagContainer` 用于每个玩家/卡牌
- 持续效果：`addTag(container, 'Ongoing.AbilityId', { stacks: 1, removable: true })`
- 标记：`addTag(container, 'Marker.OngoingAbility', { stacks: 1, source: cardId })`

### 1.4 能力系统 (Abilities)
**游戏机制**：
- 即时能力 (⚡ instant)
- 持续能力 (🔄 ongoing)
- 触发时机：失败者激活
- 能力类型：影响力修正、抽牌、弃牌、复制、激活其他能力等

**引擎映射**：
- ✅ 使用 `engine/primitives/ability.ts`
- 创建 `AbilityRegistry<CardiaAbilityDef>`
- 创建 `AbilityExecutorRegistry<CardiaContext, GameEvent>`
- 触发时机：`trigger: 'onLose' | 'onWin' | 'onPlay' | 'ongoing'`
- 效果类型：定义 `CardiaAbilityEffect` 联合类型

### 1.5 胜利条件 (Win Condition)
**游戏机制**：
- 首先获得5个印戒
- 对手无法打出卡牌
- 能力直接宣告胜利

**引擎映射**：
- ✅ 使用 `sys.gameover` (GameOverSystem)
- 在 `domain/index.ts` 实现 `isGameOver()` 函数
- 检查：`player.signets >= 5` 或 `opponent.hand.length === 0 && opponent.deck.length === 0`

## 2. 数据结构设计

### 2.1 卡牌实例 (CardInstance)
```typescript
interface CardInstance {
  // 基础标识
  uid: string;              // 运行时唯一ID
  defId: string;            // 卡牌定义ID (如 'deck1_card_01')
  ownerId: string;          // 拥有者玩家ID
  
  // 卡牌属性
  baseInfluence: number;    // 基础影响力值 (1-16)
  faction: FactionId;       // 派系 ('swamp' | 'academy' | 'guild' | 'dynasty')
  abilityIds: string[];     // 能力ID列表
  difficulty: number;       // 难度等级 (0-5)
  
  // 运行时状态
  modifiers: ModifierStack<CardiaContext>;  // 影响力修正栈
  tags: TagContainer;       // 状态标签（持续效果等）
  
  // 元数据
  imageIndex?: number;      // 图集索引
}
```

### 2.2 玩家状态 (PlayerState)
```typescript
interface PlayerState {
  id: string;
  name: string;
  
  // 区域
  hand: CardInstance[];
  deck: CardInstance[];
  discard: CardInstance[];
  
  // 游戏状态
  signets: number;          // 印戒数量 (0-5)
  tags: TagContainer;       // 玩家状态标签
  
  // 当前回合状态
  currentCard?: CardInstance;  // 本回合打出的卡牌
  hasPlayed: boolean;       // 本回合是否已打出卡牌
}
```

### 2.3 遭遇战状态 (EncounterState)
```typescript
interface EncounterState {
  // 当前遭遇
  player1Card: CardInstance;
  player2Card: CardInstance;
  
  // 影响力计算
  player1Influence: number;  // 最终影响力（含修正）
  player2Influence: number;
  
  // 结果
  winnerId?: string;         // 胜利者ID (undefined = 平局)
  loserId?: string;          // 失败者ID
  
  // 历史记录（用于"上一次遭遇"等关键词）
  previousEncounter?: {
    winnerId: string;
    winnerCardDefId: string;
    loserCardDefId: string;
  };
}
```

### 2.4 核心状态 (CoreState)
```typescript
interface CoreState {
  // 玩家
  players: Record<string, PlayerState>;
  playerOrder: [string, string];  // [player1Id, player2Id]
  
  // 回合状态
  currentPlayerId: string;
  turnNumber: number;
  phase: GamePhase;  // 'play' | 'ability' | 'end'
  
  // 遭遇战
  currentEncounter?: EncounterState;
  encounterHistory: EncounterState[];  // 完整历史（用于空间关系查询）
  
  // 地点卡（可选规则）
  locationCard?: LocationCard;
  
  // 游戏设置
  deckVariant: 'I' | 'II';  // 牌组变体
  targetSignets: number;    // 目标印戒数（默认5）
}
```

### 2.5 能力定义 (CardiaAbilityDef)
```typescript
type AbilityTrigger = 
  | 'onLose'      // 失败时触发
  | 'onWin'       // 胜利时触发
  | 'onPlay'      // 打出时触发
  | 'ongoing'     // 持续效果
  | 'instant';    // 即时效果

type AbilityEffectType =
  | 'modifyInfluence'    // 修改影响力
  | 'draw'               // 抽牌
  | 'discard'            // 弃牌
  | 'copy'               // 复制能力
  | 'activate'           // 激活其他能力
  | 'grantSignet'        // 获得印戒
  | 'removeSignet'       // 移除印戒
  | 'addOngoing'         // 添加持续效果
  | 'removeOngoing'      // 移除持续效果
  | 'win';               // 直接胜利

interface CardiaAbilityEffect {
  type: AbilityEffectType;
  value?: number;
  target?: 'self' | 'opponent' | 'both';
  condition?: ConditionNode;  // 使用 engine/primitives/condition
  // ... 其他效果特定字段
}

interface CardiaAbilityDef extends AbilityDef<CardiaAbilityEffect, AbilityTrigger> {
  // 继承 AbilityDef 的所有字段
  // 游戏特定扩展
  isInstant: boolean;     // 是否为即时能力
  isOngoing: boolean;     // 是否为持续能力
  requiresMarker: boolean; // 是否需要持续标记
}
```

### 2.6 卡牌定义 (CardDef)
```typescript
interface CardDef {
  id: string;              // 如 'deck1_card_01'
  influence: number;       // 基础影响力 (1-16)
  faction: FactionId;
  abilityIds: string[];    // 能力ID列表
  difficulty: number;      // 难度等级 (0-5)
  deckVariant: 'I' | 'II'; // 所属牌组
  
  // i18n keys
  nameKey: string;         // 'cards.deck1_card_01.name'
  descriptionKey: string;  // 'cards.deck1_card_01.description'
  
  // 图片
  imageIndex: number;      // 图集索引
}
```

## 3. 命令与事件设计

### 3.1 核心命令
```typescript
type GameCommand =
  | { type: 'PLAY_CARD'; cardUid: string }
  | { type: 'ACTIVATE_ABILITY'; abilityId: string; sourceCardUid: string }
  | { type: 'SKIP_ABILITY' }
  | { type: 'ADD_MODIFIER'; cardUid: string; modifier: ModifierDef }
  | { type: 'REMOVE_MODIFIER'; cardUid: string; modifierId: string }
  | { type: 'END_TURN' };
```

### 3.2 核心事件
```typescript
type GameEvent =
  | { type: 'CARD_PLAYED'; playerId: string; cardUid: string; cardDefId: string }
  | { type: 'ENCOUNTER_RESOLVED'; winnerId?: string; loserId?: string; player1Influence: number; player2Influence: number }
  | { type: 'SIGNET_GRANTED'; playerId: string; cardUid: string; newTotal: number }
  | { type: 'ABILITY_ACTIVATED'; playerId: string; abilityId: string; sourceCardUid: string }
  | { type: 'MODIFIER_ADDED'; cardUid: string; modifierId: string; value: number }
  | { type: 'CARD_DRAWN'; playerId: string; count: number }
  | { type: 'CARD_DISCARDED'; playerId: string; cardUid: string }
  | { type: 'ONGOING_ADDED'; targetId: string; abilityId: string }
  | { type: 'ONGOING_REMOVED'; targetId: string; abilityId: string }
  | { type: 'TURN_ENDED'; playerId: string; newTurnNumber: number };
```

## 4. 引擎能力缺口分析

### 4.1 已有能力（可直接使用）
- ✅ 区域管理 (`zones.ts`)
- ✅ 修正系统 (`modifier.ts`)
- ✅ 状态标签 (`tags.ts`)
- ✅ 能力框架 (`ability.ts`)
- ✅ 条件系统 (`condition.ts`)
- ✅ 游戏结束检测 (`sys.gameover`)

### 4.2 需要游戏层实现
- ⚠️ 遭遇战解析逻辑（比较影响力、判定胜负）
- ⚠️ 空间关系查询（previous/past/next encounter）
- ⚠️ 能力链式激活（"激活其他能力"类效果）
- ⚠️ 复制能力机制
- ⚠️ 地点卡规则（可选，Phase 6实现）

### 4.3 不需要的引擎能力
- ❌ 骰子系统 (`dice.ts`) - 本游戏无随机性
- ❌ 网格系统 (`grid.ts`) - 无棋盘
- ❌ 伤害计算 (`damageCalculation.ts`) - 无战斗伤害

## 5. 百游戏设计自检

### 5.1 显式 > 隐式 ✅
- 所有配置在 `CardDef` 和 `AbilityDef` 中显式声明
- 不依赖命名推断（如"卡牌名包含'火'就是火属性"）

### 5.2 智能默认 + 可覆盖 ✅
- 默认触发时机：`trigger: 'onLose'`（90%的能力）
- 默认目标：`target: 'self'`
- 可覆盖：特殊能力可指定 `trigger: 'onWin'` 或 `target: 'opponent'`

### 5.3 单一真实来源 ✅
- 卡牌属性：`CardDef` 唯一定义
- 能力效果：`AbilityDef` 唯一定义
- 不在多处重复声明

### 5.4 类型安全 ✅
- 所有类型在 `domain/core-types.ts` 定义
- 使用 TypeScript 联合类型确保编译期检查
- 命令/事件使用 discriminated union

### 5.5 最小化游戏层代码 ✅
- 新增卡牌：只需在 `cardRegistry.ts` 添加 `CardDef`（~10行）
- 新增能力：只需在 `abilityRegistry.ts` 添加 `AbilityDef` + 执行器（~20行）
- 无需修改 `validate.ts` / `execute.ts` / UI组件

### 5.6 框架可进化 ✅
- 引擎层可添加新的 `AbilityEffectType` 而不影响现有卡牌
- 可添加新的触发时机（如 `onDraw`）而不破坏现有能力

## 6. 关键设计决策

### 6.1 影响力计算时机
**决策**：在 `PLAY_CARD` 命令执行时立即计算最终影响力
**理由**：
- 简化状态管理（不需要延迟计算）
- 能力可以在解析前修改影响力
- 符合游戏流程（打出→修正→比较）

### 6.2 遭遇战历史存储
**决策**：保留完整的 `encounterHistory` 数组
**理由**：
- 支持"上一次遭遇"/"过去的遭遇"等关键词
- 支持空间关系查询（previous/next）
- 内存开销可控（每局最多~20次遭遇）

### 6.3 能力激活顺序
**决策**：失败者先激活，按卡牌打出顺序
**理由**：
- 符合规则（只有失败者激活能力）
- 简化逻辑（无需处理同时激活）
- 持续效果在下次遭遇前生效

### 6.4 修正标记的持久性
**决策**：修正标记永久存在直到被移除
**理由**：
- 规则未说明自动移除时机
- 使用 `ModifierStack` 的 `duration: undefined`（永久）
- 能力可以显式移除修正

## 7. 下一步行动

### Phase 2: 数据录入
1. 创建完整的规则文档（`rule/卡迪亚规则.md`）
2. 定义所有卡牌（32张，16张/牌组）
3. 定义所有能力（~20-30个独特能力）
4. 定义派系数据
5. 更新 domain types

### Phase 3: 领域核心实现
1. 实现 `validate.ts`（命令验证）
2. 实现 `execute.ts`（命令执行）
3. 实现 `reduce.ts`（事件归约）
4. 实现 `domain/index.ts`（isGameOver等）

### Phase 4: FlowSystem & 系统组装
1. 定义 `FlowHooks`（回合流程）
2. 组装 `game.ts`
3. 配置 CheatModifier

### Phase 5: Board/UI 实现
1. 实现 `Board.tsx`（游戏界面）
2. 实现子组件（手牌、遭遇区、印戒显示等）
3. 实现能力激活UI

### Phase 6: 打磨
1. 完善 i18n（中英文）
2. 添加音效配置
3. 实现教学模式
4. 添加卡牌图片
5. 实现地点卡（可选规则）

## 8. 风险与缓解

### 8.1 能力复杂度
**风险**：某些能力可能需要复杂的交互链
**缓解**：
- 使用 `InteractionChain` 声明多步交互
- 参考 SummonerWars 的能力实现模式
- 优先实现简单能力，复杂能力后续迭代

### 8.2 空间关系查询
**风险**："上一次遭遇"等查询可能复杂
**缓解**：
- 在 `domain/utils.ts` 实现专用查询函数
- 使用 `encounterHistory` 数组简化查询
- 添加单元测试确保正确性

### 8.3 能力链式激活
**风险**："激活其他能力"可能导致无限循环
**缓解**：
- 在执行器中添加激活深度限制
- 记录已激活能力防止重复
- 参考 DiceThrone 的能力链实现

## 9. 总结

本设计完全基于引擎层现有能力，无需新增引擎原语。核心机制映射清晰，数据结构符合"面向百游戏"原则。下一步可以安全地进入 Phase 2 数据录入阶段。
