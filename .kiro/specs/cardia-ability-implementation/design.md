# Design Document: Cardia 能力系统实现

## Overview

### 目标

实现 Cardia 游戏的完整能力系统，支持 32 张卡牌的能力逻辑。系统需要处理即时能力和持续能力两种类型，涵盖资源操作、影响力修正、信息控制和特殊胜利条件等多种效果。

### 核心挑战

1. **能力分类与复用**：32 个能力需要按效果类型分组，避免硬编码，实现高度复用
2. **持续能力管理**：持续标记的生命周期管理、状态回溯、遭遇结果重新计算
3. **交互处理**：多步骤选择、条件判断、目标过滤
4. **状态一致性**：修正标记改变影响力后的印戒移动、胜利条件检测
5. **特殊能力**：傀儡师（替换卡牌）、机械精灵（条件胜利）、继承者（大规模资源削弱）等独特机制

### 设计原则

- **数据驱动**：能力定义为配置数据，执行器解析配置而非硬编码逻辑
- **效果组合**：单个能力可包含多个效果，按顺序执行
- **注册表模式**：使用引擎层 `ability.ts` 框架，禁止 switch-case 硬编码
- **状态不可变**：所有状态更新通过事件驱动，支持回溯和重放
- **类型安全**：TypeScript 严格类型检查，编译期捕获错误

---

## Architecture

### 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│                        UI 层 (Board.tsx)                     │
│  - 能力按钮渲染                                               │
│  - 交互弹窗（选择卡牌/派系）                                   │
│  - 持续标记显示                                               │
└─────────────────────────────────────────────────────────────┘
                              ↓ dispatch commands
┌─────────────────────────────────────────────────────────────┐
│                      领域层 (domain/)                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ abilityRegistry.ts - 能力定义注册表                      ││
│  │ abilityExecutor.ts - 能力执行器注册表                    ││
│  │ execute.ts         - 命令→事件转换                       ││
│  │ validate.ts        - 命令验证                            ││
│  │ reduce.ts          - 事件→状态更新                       ││
│  │ interactionHandlers.ts - 交互处理                        ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              ↓ uses
┌─────────────────────────────────────────────────────────────┐
│                    引擎层 (engine/primitives/)                │
│  - ability.ts      - 通用能力框架                            │
│  - tags.ts         - 标记容器（持续标记/修正标记）             │
│  - modifier.ts     - 数值修正管线                            │
│  - resources.ts    - 资源管理                                │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

```
用户点击能力按钮
    ↓
dispatch(ACTIVATE_ABILITY, { abilityId, cardId })
    ↓
validate.ts: 检查能力是否可发动
    ↓
execute.ts: 查找执行器 → 执行效果 → 生成事件
    ↓
reduce.ts: 应用事件到状态
    ↓
UI 更新（React 重新渲染）
```

### 能力执行流程

```
1. 遭遇结算 → 判定胜负
2. 失败方可发动能力
3. 玩家选择发动哪个能力（或跳过）
4. 执行能力效果：
   - 即时能力：立即执行 → 产生事件 → 更新状态
   - 持续能力：放置持续标记 → 后续遭遇自动应用
5. 检查胜利条件
6. 进入下一回合
```

---

## Components and Interfaces

### 文件结构规范（强制遵循 create-new-game）

#### domain/ 目录结构

```
domain/
  index.ts           # 领域内核入口（DomainCore 定义）
  types.ts           # re-export barrel（导出 core-types + commands + events）
  core-types.ts      # 状态接口（PlayerState, CardiaCore, 基础类型）
  commands.ts        # 命令类型 + CARDIA_COMMANDS 常量
  events.ts          # 事件类型 + CARDIA_EVENTS 常量
  ids.ts             # 领域 ID 常量表（所有稳定 ID，as const）
  utils.ts           # 游戏内共享工具（从第一天就建立）
  abilityRegistry.ts # 能力定义注册表（使用 engine/primitives/ability.ts）
  abilityExecutor.ts # 能力执行器注册表
  execute.ts         # 命令→事件转换
  validate.ts        # 命令验证
  reduce.ts          # 事件→状态更新
  interactionHandlers.ts # 交互处理
```

**关键约束**：
- **禁止在 `types.ts` 中直接定义类型**，它只是 re-export barrel
- **所有状态接口放在 `core-types.ts`**
- **所有命令类型放在 `commands.ts`**，包含 `CARDIA_COMMANDS` 常量对象
- **所有事件类型放在 `events.ts`**，包含 `CARDIA_EVENTS` 常量对象
- **所有稳定 ID 放在 `ids.ts`**，使用 `as const`，禁止字符串字面量

### 核心类型定义

#### core-types.ts — 状态接口

```typescript
import type { PlayerId } from '../../../engine/types';

// 游戏阶段
export type GamePhase = 
    | 'setup'           // 初始化
    | 'playCard'        // 打牌阶段
    | 'reveal'          // 揭示阶段
    | 'resolveEncounter' // 遭遇结算
    | 'ability'         // 能力阶段
    | 'checkVictory'    // 胜利检测
    | 'endTurn';        // 回合结束

export const PHASE_ORDER: GamePhase[] = [
    'setup',
    'playCard',
    'reveal',
    'resolveEncounter',
    'ability',
    'checkVictory',
    'endTurn',
];

// 派系
export type Faction = 'swamp' | 'academy' | 'guild' | 'dynasty';

// 卡牌数据
export interface CardData {
    id: string;
    defId: string;      // 卡牌定义 ID（指向 cardRegistry）
    owner: PlayerId;
    faction: Faction;
}

// 已打出的卡牌
export interface PlayedCard {
    cardId: string;
    owner: PlayerId;
    baseInfluence: number;
    currentInfluence: number;  // 包含修正后的影响力
    signets: number;           // 该卡牌上的印戒数
    hasOngoingMarker: boolean; // 是否有持续标记
    modifiers: ModifierToken[]; // 该卡牌上的修正标记
}

// 修正标记
export interface ModifierToken {
    cardId: string;         // 目标卡牌 ID
    value: number;          // 修正值（+1/-3/+5）
    source: string;         // 来源能力 ID
    timestamp: number;      // 放置时间戳
}

// 持续能力
export interface OngoingAbility {
    abilityId: string;      // 能力 ID
    cardId: string;         // 卡牌 ID
    playerId: PlayerId;     // 拥有者
    effectType: string;     // 效果类型（从 abilityRegistry 获取）
    timestamp: number;      // 激活时间戳
}

// 延迟效果
export interface DelayedEffect {
    effectType: string;
    target: 'self' | 'opponent';
    value?: number;
    condition: string;      // 触发条件
    sourceAbilityId: string;
    sourcePlayerId: PlayerId;
    timestamp: number;
}

// 场区槽位
export interface FieldSlot {
    index: number;
    card: PlayedCard | null;
}

// 场区状态
export interface FieldState {
    slots: FieldSlot[];  // 4 个槽位
}

// 遭遇状态
export interface EncounterState {
    turn: number;
    slot: number;
    player0Card: PlayedCard;
    player1Card: PlayedCard;
    winner: PlayerId | 'tie';
    loser: PlayerId | null;
    abilityActivated: boolean;  // 是否已发动能力
}

// 玩家状态
export interface PlayerState {
    id: PlayerId;
    hand: CardData[];
    deck: CardData[];
    discard: CardData[];
    signets: number;  // 印戒总数（从场上卡牌统计）
}

// Cardia 核心状态
export interface CardiaCore {
    // 玩家状态
    players: Record<PlayerId, PlayerState>;
    currentPlayer: PlayerId;
    
    // 场区状态
    field: FieldState;
    
    // 遭遇状态
    currentEncounter: EncounterState | null;
    encounterHistory: EncounterState[];
    
    // 能力系统状态
    ongoingAbilities: OngoingAbility[];
    modifierTokens: ModifierToken[];
    delayedEffects: DelayedEffect[];
    
    // 特殊状态标记
    revealFirstNextEncounter: PlayerId | null;  // 下次遭遇先揭示的玩家
    mechanicalSpiritActive: {                   // 机械精灵状态
        playerId: PlayerId;
        cardId: string;
    } | null;
    
    // 游戏状态
    phase: GamePhase;
    turn: number;
    winner: PlayerId | null;
}
```

#### commands.ts — 命令类型

```typescript
import type { Command } from '../../../engine/types';
import type { PlayerId, Faction } from './core-types';

// 命令常量表
export const CARDIA_COMMANDS = {
    PLAY_CARD: 'cardia:play_card',
    ACTIVATE_ABILITY: 'cardia:activate_ability',
    SKIP_ABILITY: 'cardia:skip_ability',
    CHOOSE_CARD: 'cardia:choose_card',
    CHOOSE_FACTION: 'cardia:choose_faction',
    CHOOSE_MODIFIER: 'cardia:choose_modifier',
    CONFIRM_CHOICE: 'cardia:confirm_choice',
} as const;

// 打牌命令
export interface PlayCardCommand extends Command<typeof CARDIA_COMMANDS.PLAY_CARD> {
    payload: {
        cardId: string;
        slotIndex: number;
    };
}

// 激活能力命令
export interface ActivateAbilityCommand extends Command<typeof CARDIA_COMMANDS.ACTIVATE_ABILITY> {
    payload: {
        abilityId: string;
        cardId: string;
        playerId: PlayerId;
    };
}

// 跳过能力命令
export interface SkipAbilityCommand extends Command<typeof CARDIA_COMMANDS.SKIP_ABILITY> {
    payload: {
        playerId: PlayerId;
    };
}

// 选择卡牌命令
export interface ChooseCardCommand extends Command<typeof CARDIA_COMMANDS.CHOOSE_CARD> {
    payload: {
        cardId: string;
        interactionId: string;
    };
}

// 选择派系命令
export interface ChooseFactionCommand extends Command<typeof CARDIA_COMMANDS.CHOOSE_FACTION> {
    payload: {
        faction: Faction;
        interactionId: string;
    };
}

// 选择修正标记命令
export interface ChooseModifierCommand extends Command<typeof CARDIA_COMMANDS.CHOOSE_MODIFIER> {
    payload: {
        value: number;
        interactionId: string;
    };
}

// 确认选择命令
export interface ConfirmChoiceCommand extends Command<typeof CARDIA_COMMANDS.CONFIRM_CHOICE> {
    payload: {
        interactionId: string;
    };
}

// Cardia 命令联合类型
export type CardiaCommand =
    | PlayCardCommand
    | ActivateAbilityCommand
    | SkipAbilityCommand
    | ChooseCardCommand
    | ChooseFactionCommand
    | ChooseModifierCommand
    | ConfirmChoiceCommand;
```

#### events.ts — 事件类型

```typescript
import type { GameEvent } from '../../../engine/types';
import type { PlayerId } from './core-types';

// 事件常量表
export const CARDIA_EVENTS = {
    CARD_PLAYED: 'cardia:card_played',
    ENCOUNTER_RESOLVED: 'cardia:encounter_resolved',
    ABILITY_ACTIVATED: 'cardia:ability_activated',
    ONGOING_ABILITY_PLACED: 'cardia:ongoing_ability_placed',
    ONGOING_ABILITY_REMOVED: 'cardia:ongoing_ability_removed',
    MODIFIER_TOKEN_PLACED: 'cardia:modifier_token_placed',
    MODIFIER_TOKEN_REMOVED: 'cardia:modifier_token_removed',
    CARD_INFLUENCE_MODIFIED: 'cardia:card_influence_modified',
    ENCOUNTER_RESULT_CHANGED: 'cardia:encounter_result_changed',
    SIGNET_MOVED: 'cardia:signet_moved',
    EXTRA_SIGNET_PLACED: 'cardia:extra_signet_placed',
    CARD_REPLACED: 'cardia:card_replaced',
    CARDS_DISCARDED: 'cardia:cards_discarded',
    CARDS_DISCARDED_FROM_DECK: 'cardia:cards_discarded_from_deck',
    CARD_RECYCLED: 'cardia:card_recycled',
    DECK_SHUFFLED: 'cardia:deck_shuffled',
    DELAYED_EFFECT_REGISTERED: 'cardia:delayed_effect_registered',
    DELAYED_EFFECT_TRIGGERED: 'cardia:delayed_effect_triggered',
    GAME_WON: 'cardia:game_won',
} as const;

// 卡牌打出事件
export interface CardPlayedEvent extends GameEvent<typeof CARDIA_EVENTS.CARD_PLAYED> {
    payload: {
        cardId: string;
        playerId: PlayerId;
        slotIndex: number;
    };
}

// 遭遇结算事件
export interface EncounterResolvedEvent extends GameEvent<typeof CARDIA_EVENTS.ENCOUNTER_RESOLVED> {
    payload: {
        slotIndex: number;
        winner: PlayerId | 'tie';
        loser: PlayerId | null;
    };
}

// 能力激活事件
export interface AbilityActivatedEvent extends GameEvent<typeof CARDIA_EVENTS.ABILITY_ACTIVATED> {
    payload: {
        abilityId: string;
        cardId: string;
        playerId: PlayerId;
        isInstant: boolean;
        isOngoing: boolean;
    };
}

// 持续能力放置事件
export interface OngoingAbilityPlacedEvent extends GameEvent<typeof CARDIA_EVENTS.ONGOING_ABILITY_PLACED> {
    payload: {
        abilityId: string;
        cardId: string;
        playerId: PlayerId;
        effectType: string;
        timestamp: number;
    };
}

// 持续能力移除事件
export interface OngoingAbilityRemovedEvent extends GameEvent<typeof CARDIA_EVENTS.ONGOING_ABILITY_REMOVED> {
    payload: {
        abilityId: string;
        cardId: string;
    };
}

// 修正标记放置事件
export interface ModifierTokenPlacedEvent extends GameEvent<typeof CARDIA_EVENTS.MODIFIER_TOKEN_PLACED> {
    payload: {
        cardId: string;
        value: number;
        source: string;
        timestamp: number;
    };
}

// 修正标记移除事件
export interface ModifierTokenRemovedEvent extends GameEvent<typeof CARDIA_EVENTS.MODIFIER_TOKEN_REMOVED> {
    payload: {
        cardId: string;
        source?: string;  // 可选，移除特定来源的标记
    };
}

// 卡牌影响力修改事件
export interface CardInfluenceModifiedEvent extends GameEvent<typeof CARDIA_EVENTS.CARD_INFLUENCE_MODIFIED> {
    payload: {
        cardId: string;
        oldInfluence: number;
        newInfluence: number;
    };
}

// 遭遇结果改变事件
export interface EncounterResultChangedEvent extends GameEvent<typeof CARDIA_EVENTS.ENCOUNTER_RESULT_CHANGED> {
    payload: {
        slotIndex: number;
        previousWinner: PlayerId | 'tie';
        newWinner: PlayerId | 'tie';
        reason: string;
    };
}

// 印戒移动事件
export interface SignetMovedEvent extends GameEvent<typeof CARDIA_EVENTS.SIGNET_MOVED> {
    payload: {
        fromCardId: string;
        toCardId: string;
        slotIndex: number;
    };
}

// 额外印戒放置事件
export interface ExtraSignetPlacedEvent extends GameEvent<typeof CARDIA_EVENTS.EXTRA_SIGNET_PLACED> {
    payload: {
        cardId: string;
        playerId: PlayerId;
    };
}

// 卡牌替换事件
export interface CardReplacedEvent extends GameEvent<typeof CARDIA_EVENTS.CARD_REPLACED> {
    payload: {
        slotIndex: number;
        oldCardId: string;
        newCardId: string;
        replacedByAbility: boolean;
    };
}

// 卡牌弃掉事件
export interface CardsDiscardedEvent extends GameEvent<typeof CARDIA_EVENTS.CARDS_DISCARDED> {
    payload: {
        playerId: PlayerId;
        cardIds: string[];
        from: 'hand' | 'field';
    };
}

// 从牌库弃牌事件
export interface CardsDiscardedFromDeckEvent extends GameEvent<typeof CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK> {
    payload: {
        playerId: PlayerId;
        count: number;
    };
}

// 卡牌回收事件
export interface CardRecycledEvent extends GameEvent<typeof CARDIA_EVENTS.CARD_RECYCLED> {
    payload: {
        playerId: PlayerId;
        cardId: string;
    };
}

// 牌库混洗事件
export interface DeckShuffledEvent extends GameEvent<typeof CARDIA_EVENTS.DECK_SHUFFLED> {
    payload: {
        playerId: PlayerId;
    };
}

// 延迟效果注册事件
export interface DelayedEffectRegisteredEvent extends GameEvent<typeof CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED> {
    payload: {
        effectType: string;
        target: 'self' | 'opponent';
        value?: number;
        condition: string;
        sourceAbilityId: string;
        sourcePlayerId: PlayerId;
        timestamp: number;
    };
}

// 延迟效果触发事件
export interface DelayedEffectTriggeredEvent extends GameEvent<typeof CARDIA_EVENTS.DELAYED_EFFECT_TRIGGERED> {
    payload: {
        effectType: string;
        targetCardId: string;
    };
}

// 游戏胜利事件
export interface GameWonEvent extends GameEvent<typeof CARDIA_EVENTS.GAME_WON> {
    payload: {
        winner: PlayerId;
        reason: string;
    };
}

// Cardia 事件联合类型
export type CardiaEvent =
    | CardPlayedEvent
    | EncounterResolvedEvent
    | AbilityActivatedEvent
    | OngoingAbilityPlacedEvent
    | OngoingAbilityRemovedEvent
    | ModifierTokenPlacedEvent
    | ModifierTokenRemovedEvent
    | CardInfluenceModifiedEvent
    | EncounterResultChangedEvent
    | SignetMovedEvent
    | ExtraSignetPlacedEvent
    | CardReplacedEvent
    | CardsDiscardedEvent
    | CardsDiscardedFromDeckEvent
    | CardRecycledEvent
    | DeckShuffledEvent
    | DelayedEffectRegisteredEvent
    | DelayedEffectTriggeredEvent
    | GameWonEvent;
```

#### types.ts — re-export barrel

```typescript
// 状态类型
export * from './core-types';

// 命令类型
export * from './commands';

// 事件类型
export * from './events';
```

#### 能力定义（使用 engine/primitives/ability.ts）

**强制要求**：必须使用 `engine/primitives/ability.ts` 框架，禁止自行实现能力注册表。

```typescript
// domain/abilityRegistry.ts
import { createAbilityRegistry } from '../../../engine/primitives/ability';
import type { AbilityDef } from '../../../engine/primitives/ability';

// 能力效果类型（20 种基础效果类型）
export type AbilityEffectType =
    | 'discardBothCards'       // 弃掉本牌和相对的牌
    | 'removeAllMarkers'       // 移除所有修正标记和持续标记
    | 'modifyInfluence'        // 修改影响力
    | 'forceTie'               // 强制平局
    | 'discardFromDeck'        // 从牌库顶弃牌
    | 'revealFirst'            // 对手先揭示
    | 'conditionalInfluence'   // 条件影响力（派系选择）
    | 'winTies'                // 赢得所有平局
    | 'discardByFaction'       // 派系弃牌
    | 'replaceOpponentCard'    // 替换对手卡牌
    | 'modifyMultipleCards'    // 修改多张牌
    | 'extraSignet'            // 额外印戒
    | 'recycleCard'            // 回收卡牌
    | 'copyAbility'            // 复制能力
    | 'win'                    // 直接胜利
    | 'draw'                   // 抽牌
    | 'discard'                // 弃牌
    | 'shuffle'                // 混洗牌库
    | 'conditionalDiscard'     // 条件弃牌
    | 'delayedModify'          // 延迟修改
    | 'conditionalWin';        // 条件胜利

// 能力效果定义
export interface CardiaAbilityEffect {
    type: AbilityEffectType;
    value?: number;                    // 数值
    target?: 'self' | 'opponent' | 'any'; // 目标
    modifierValue?: number;            // 修正标记值
    requiresChoice?: boolean;          // 是否需要玩家选择
    factionFilter?: boolean;           // 是否按派系过滤
    condition?: string;                // 条件描述
}

// 能力触发时机
export type AbilityTrigger = 
    | 'onLose'      // 失败时触发（默认）
    | 'onWin'       // 胜利时触发
    | 'onPlay'      // 打出时触发
    | 'ongoing';    // 持续效果

// Cardia 能力定义
export interface CardiaAbilityDef extends AbilityDef<CardiaAbilityEffect, AbilityTrigger> {
    isInstant: boolean;     // 是否为即时能力
    isOngoing: boolean;     // 是否为持续能力
    requiresMarker: boolean; // 是否需要持续标记
}

// 创建能力注册表（使用引擎层框架）
export const abilityRegistry = createAbilityRegistry<CardiaAbilityDef>('cardia-abilities');
```

**注**：所有类型定义已在上文"文件结构规范"中完整定义，此处不再重复。

### 能力执行器接口

```typescript
// domain/abilityExecutor.ts
import { createAbilityExecutorRegistry } from '../../../engine/primitives/ability';
import type { AbilityContext, AbilityResult } from '../../../engine/primitives/ability';
import type { GameEvent } from '../../../engine/types';
import type { CardiaCore, PlayerId, Faction } from './types';

// Cardia 能力执行上下文
export interface CardiaAbilityContext extends AbilityContext {
    core: CardiaCore;
    abilityId: string;
    cardId: string;
    playerId: PlayerId;
    opponentId: PlayerId;
    timestamp: number;
    // 交互结果（如果有）
    selectedCardId?: string;
    selectedFaction?: Faction;
    selectedModifier?: number;
}

// 能力执行器函数签名
export type CardiaAbilityExecutor = (
    ctx: CardiaAbilityContext
) => AbilityResult<GameEvent>;

// 创建执行器注册表（使用引擎层框架）
export const abilityExecutorRegistry = createAbilityExecutorRegistry<
    CardiaAbilityContext,
    GameEvent
>('cardia-ability-executors');
```

**关键约束**：
- **禁止在 validate.ts 中用 switch-case 硬编码技能验证**（每个技能一个 case）
- **禁止在 UI 组件中用 if 语句硬编码技能按钮**（每个技能一个 if）
- **禁止在 execute.ts 中硬编码特定技能的逻辑**（如 rapid_fire）
- **正确做法**：在 `CardiaAbilityDef` 中声明 `validation` 和 `ui` 配置，使用通用验证函数和自动按钮渲染

详见 `docs/ai-rules/engine-systems.md`「技能系统反模式清单」节。

### 交互处理接口

```typescript
// domain/interactionHandlers.ts
import type { PlayerId, Faction } from './types';

export interface CardSelectionInteraction {
    type: 'card_selection';
    interactionId: string;
    playerId: PlayerId;
    title: string;
    description: string;
    availableCards: string[];  // 可选卡牌 ID 列表
    minSelect: number;
    maxSelect: number;
    filter?: CardFilter;
}

export interface FactionSelectionInteraction {
    type: 'faction_selection';
    interactionId: string;
    playerId: PlayerId;
    title: string;
    description: string;
}

export interface ModifierSelectionInteraction {
    type: 'modifier_selection';
    interactionId: string;
    playerId: PlayerId;
    title: string;
    description: string;
    availableModifiers: number[];  // 可选修正值
}

export type CardiaInteraction = 
    | CardSelectionInteraction
    | FactionSelectionInteraction
    | ModifierSelectionInteraction;

export interface CardFilter {
    maxInfluence?: number;
    minInfluence?: number;
    hasInstantAbility?: boolean;
    faction?: Faction;
    owner?: PlayerId;
    location?: 'field' | 'hand' | 'discard';
}
```

---

## 领域层编码规范（强制遵循 create-new-game）

### Reducer 必须结构共享（强制）

`reduce(core, event)` 中**禁止 `JSON.parse(JSON.stringify())`**（全量深拷贝）。

**正确做法**：只 spread 变更路径。例：

```typescript
// ✅ 正确：结构共享
case CARDIA_EVENTS.MODIFIER_TOKEN_PLACED: {
    const { cardId, value, source, timestamp } = event.payload;
    const token: ModifierToken = { cardId, value, source, timestamp };
    
    return {
        ...core,
        modifierTokens: [...core.modifierTokens, token],
    };
}

// ❌ 错误：全量深拷贝
case CARDIA_EVENTS.MODIFIER_TOKEN_PLACED: {
    const newCore = JSON.parse(JSON.stringify(core));  // 性能灾难
    newCore.modifierTokens.push(event.payload);
    return newCore;
}
```

**嵌套更新**：超过 3 层时，提取 helper 到 `domain/utils.ts`：

```typescript
// domain/utils.ts
export function updatePlayer(
    core: CardiaCore,
    playerId: PlayerId,
    patch: Partial<PlayerState>
): CardiaCore {
    const player = core.players[playerId];
    if (!player) return core;
    
    return {
        ...core,
        players: {
            ...core.players,
            [playerId]: { ...player, ...patch },
        },
    };
}

// 使用
return updatePlayer(core, playerId, { signets: newSignets });
```

详见 `docs/ai-rules/engine-systems.md`「Reducer 结构共享范例」。

### 文件结构默认拆分（强制）

> 原则：中等以上复杂度的游戏（命令数 ≥5 或有多阶段回合）从第一天就用拆分结构，不等超限。

- **types 默认拆分**：`core-types.ts`（状态接口）+ `commands.ts`（命令类型）+ `events.ts`（事件类型），`types.ts` 为 re-export barrel。仅当命令+事件总共 <10 个时允许合并在单文件。
- **game.ts 默认拆分**：FlowHooks → `domain/flowHooks.ts`，CheatModifier → `domain/cheatModifier.ts`。game.ts 只做组装。
- **Board.tsx 默认拆分**：业务 hooks → `hooks/`，子区域组件 → `ui/`。Board.tsx 只做布局组装。
- **reducer.ts / execute.ts**：当命令/事件类型超过 15 个时，按实体/子系统拆分到子目录，主文件只做分发。
- **统一底线**：无论是否默认拆分，任何单文件超过 1000 行必须立即拆分。

### 目录结构规范（强制）

- **按子域分类建目录**：新增文件时按业务子域归入对应子目录，禁止平铺堆积在父目录。同一目录下同级文件不得超过 15 个（不含 index.ts/types.ts）。
- **子目录命名**：kebab-case，反映业务含义（`combat/`、`overlays/`、`cards/`），禁止 `misc/`、`utils/`、`new/` 等无意义名称。
- **拆分后保留 barrel**：父目录 `index.ts` 统一 re-export，消费方 import 路径不变。
- **嵌套深度上限 5 层**（从 `src/` 起算），超过优先扁平化。

### 游戏内工具函数单一来源（强制）

每个游戏的 `domain/utils.ts` **从第一天就建立**，放置 `applyEvents`、`getOpponentId`、`updatePlayer` 等共享工具。

```typescript
// domain/utils.ts
import type { CardiaCore, PlayerId, PlayerState } from './types';
import type { GameEvent } from '../../../engine/types';

// 获取对手 ID
export function getOpponentId(core: CardiaCore, playerId: PlayerId): PlayerId {
    const playerIds = Object.keys(core.players) as PlayerId[];
    return playerIds.find(id => id !== playerId)!;
}

// 更新玩家状态
export function updatePlayer(
    core: CardiaCore,
    playerId: PlayerId,
    patch: Partial<PlayerState>
): CardiaCore {
    const player = core.players[playerId];
    if (!player) return core;
    
    return {
        ...core,
        players: {
            ...core.players,
            [playerId]: { ...player, ...patch },
        },
    };
}

// 应用事件列表
export function applyEvents(core: CardiaCore, events: GameEvent[]): CardiaCore {
    return events.reduce((acc, event) => reduce(acc, event), core);
}

// 获取玩家场上卡牌
export function getPlayerFieldCards(core: CardiaCore, playerId: PlayerId): string[] {
    return core.field.slots
        .filter(slot => slot.card && slot.card.owner === playerId)
        .map(slot => slot.card!.cardId);
}

// 计算卡牌当前影响力
export function calculateCurrentInfluence(
    baseInfluence: number,
    modifiers: ModifierToken[]
): number {
    return modifiers.reduce((acc, mod) => acc + mod.value, baseInfluence);
}
```

**禁止**：
- 在 `game.ts`、`execute.ts`、`reduce.ts` 中重复定义相同逻辑的辅助函数
- 引擎层已提供的能力（如游戏模式判断）在游戏层重新实现，应 import 引擎层导出

### Core 状态准入（强制）

**准入条件**：字段必须被 `reduce()` 消费，且影响 `validate()` / `execute()` / `isGameOver()` 的决策。

**禁止放入 core 的**：
- 纯 UI 展示状态（如 `lastPlayedCard`、`lastBonusDieRoll`）→ 应通过 EventStreamSystem 事件传递给 UI
- 交互等待状态（如 `pendingXxx`）→ 应使用 `sys.interaction`

**例外**：如果某个"展示"字段同时影响规则判定（如 `pendingAttack` 影响防御阶段流转），则允许放在 core，但必须注释说明其规则依赖。

**Cardia 能力系统状态字段的准入理由**：
- `ongoingAbilities`：影响遭遇结算（强制平局、赢得平局、额外印戒、条件胜利）
- `modifierTokens`：影响卡牌影响力计算，进而影响遭遇结果和印戒放置
- `delayedEffects`：影响下次打牌时的效果触发
- `revealFirstNextEncounter`：影响下次遭遇的揭示顺序
- `mechanicalSpiritActive`：影响胜利条件检测

所有字段均影响规则判定，符合准入条件。

---

## Data Models

### 状态结构设计

**注**：所有状态接口已在"文件结构规范 → core-types.ts"中完整定义，此处不再重复。

### 能力效果分类

根据 32 个能力的效果类型，我们将其分为以下几类：

#### 1. 资源操作类（8 个能力）

- **抽牌**：无
- **弃牌**：破坏者、革命者、伏击者、巫王、继承者
- **回收**：沼泽守卫
- **混洗**：巫王
- **牌库操作**：破坏者、巫王

#### 2. 影响力修正类（12 个能力）

- **单目标修正**：外科医生、税务官、天才、使者
- **多目标修正**：发明家、钟表匠
- **条件修正**：宫廷卫士、毒师
- **延迟修正**：图书管理员、工程师
- **标记移动**：念动力法师

#### 3. 持续能力类（4 个能力）

- **强制平局**：调停者
- **赢得平局**：审判官
- **额外印戒**：财务官、顾问
- **条件胜利**：机械精灵

#### 4. 特殊机制类（8 个能力）

- **卡牌替换**：傀儡师
- **能力复制**：女导师、幻术师、元素师
- **标记移除**：虚空法师
- **弃掉双方卡牌**：雇佣剑士
- **先揭示**：占卜师
- **直接胜利**：精灵
- **额外印戒**：贵族

### 数据流设计

#### 能力发动流程

```
1. 遭遇结算 → 产生 ENCOUNTER_RESOLVED 事件
2. reduce: 更新 currentEncounter.winner/loser
3. UI: 显示失败方的能力按钮
4. 玩家点击 → dispatch(ACTIVATE_ABILITY)
5. validate: 检查是否为失败方、能力是否可用
6. execute: 
   - 查找 abilityExecutorRegistry.resolve(abilityId)
   - 执行器返回事件列表
   - 如需交互，返回 interaction 对象
7. reduce: 应用事件到状态
8. UI: 更新显示
```

#### 持续能力应用流程

```
1. 持续能力发动 → 产生 ONGOING_ABILITY_PLACED 事件
2. reduce: 添加到 core.ongoingAbilities
3. 下次遭遇结算时：
   - execute: 检查 core.ongoingAbilities
   - 应用持续效果（如强制平局、赢得平局）
   - 产生 ENCOUNTER_RESULT_CHANGED 事件
4. 持续标记被移除 → 产生 ONGOING_ABILITY_REMOVED 事件
5. reduce: 从 core.ongoingAbilities 移除
6. 回溯：重新计算所有受影响的遭遇结果
```

#### 修正标记应用流程

```
1. 能力添加修正标记 → 产生 MODIFIER_TOKEN_PLACED 事件
2. reduce: 
   - 添加到 core.modifierTokens
   - 更新目标卡牌的 currentInfluence
3. 检查遭遇结果是否改变：
   - 如果改变 → 产生 ENCOUNTER_RESULT_CHANGED 事件
   - 移动印戒 → 产生 SIGNET_MOVED 事件
4. 标记被移除 → 产生 MODIFIER_TOKEN_REMOVED 事件
5. reduce: 
   - 从 core.modifierTokens 移除
   - 重新计算 currentInfluence
   - 检查遭遇结果是否改变
```

### 能力执行器实现策略

#### 按效果类型分组实现

我们将 20 种效果类型分为以下几组，每组共享实现逻辑：

**组 1：简单资源操作**
- `draw`、`discard`、`shuffle`、`discardFromDeck`
- 实现：直接操作 player.hand/deck/discard

**组 2：影响力修正**
- `modifyInfluence`、`modifyMultipleCards`、`delayedModify`
- 实现：创建 ModifierToken，更新 currentInfluence

**组 3：持续效果**
- `forceTie`、`winTies`、`extraSignet`、`conditionalWin`
- 实现：创建 OngoingAbility，在遭遇结算时应用

**组 4：条件效果**
- `conditionalInfluence`、`conditionalDiscard`
- 实现：先创建交互，根据玩家选择执行

**组 5：特殊机制**
- `replaceOpponentCard`、`copyAbility`、`removeAllMarkers`、`discardBothCards`
- 实现：每个能力独立实现

**组 6：派系相关**
- `discardByFaction`
- 实现：先选择派系，再过滤目标

**组 7：胜利条件**
- `win`
- 实现：直接设置 core.winner

#### 执行器注册示例

**关键约束**：
- **禁止技能系统硬编码**：不得在 validate.ts 中用 switch-case 硬编码技能验证
- **数据驱动优先**：能力定义包含 validation 配置，使用通用验证函数
- **注册表模式**：使用 `abilityExecutorRegistry.register(id, executor)`

```typescript
// domain/abilityExecutor.ts
import { ABILITY_IDS } from './ids';
import { CARDIA_EVENTS } from './events';
import { abilityExecutorRegistry } from './abilityRegistry';
import { getPlayerFieldCards, getOpponentId } from './utils';

// 组 1：简单资源操作
abilityExecutorRegistry.register(ABILITY_IDS.SABOTEUR, (ctx) => {
    // 破坏者：对手弃掉牌库顶 2 张牌
    return {
        events: [
            {
                type: CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK,
                payload: {
                    playerId: ctx.opponentId,
                    count: 2,
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});

// 组 2：影响力修正
abilityExecutorRegistry.register(ABILITY_IDS.SURGEON, (ctx) => {
    // 外科医生：为你一张打出的牌添加+5影响力
    // 需要玩家选择目标卡牌
    if (!ctx.selectedCardId) {
        // 创建交互
        return {
            events: [],
            interaction: {
                type: 'card_selection',
                interactionId: `${ctx.abilityId}_${ctx.timestamp}`,
                playerId: ctx.playerId,
                title: '选择目标卡牌',
                description: '为你的一张打出的牌添加+5影响力',
                availableCards: getPlayerFieldCards(ctx.core, ctx.playerId),
                minSelect: 1,
                maxSelect: 1,
            },
        };
    }
    
    // 玩家已选择，执行效果
    return {
        events: [
            {
                type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
                payload: {
                    cardId: ctx.selectedCardId,
                    value: 5,
                    source: ctx.abilityId,
                    timestamp: ctx.timestamp,
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});

// 组 3：持续效果
abilityExecutorRegistry.register(ABILITY_IDS.MEDIATOR, (ctx) => {
    // 调停者：🔄 这次遭遇为平局
    return {
        events: [
            {
                type: CARDIA_EVENTS.ONGOING_ABILITY_PLACED,
                payload: {
                    abilityId: ctx.abilityId,
                    cardId: ctx.cardId,
                    playerId: ctx.playerId,
                    effectType: 'forceTie',
                    timestamp: ctx.timestamp,
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});

// 组 5：特殊机制
abilityExecutorRegistry.register(ABILITY_IDS.PUPPETEER, (ctx) => {
    // 傀儡师：弃掉相对的牌，替换为从对手手牌随机抽取的一张牌
    const opponentCard = getOppositeCard(ctx.core, ctx.cardId);
    if (!opponentCard) {
        return { events: [] };
    }
    
    const opponentHand = ctx.core.players[ctx.opponentId].hand;
    if (opponentHand.length === 0) {
        return { events: [] };
    }
    
    // 随机选择一张手牌
    const randomIndex = Math.floor(Math.random() * opponentHand.length);
    const randomCard = opponentHand[randomIndex];
    
    return {
        events: [
            {
                type: CARDIA_EVENTS.CARD_REPLACED,
                payload: {
                    slotIndex: opponentCard.slotIndex,
                    oldCardId: opponentCard.cardId,
                    newCardId: randomCard.id,
                    replacedByAbility: true,
                },
                timestamp: ctx.timestamp,
            }
        ],
    };
});
```

**面向百游戏设计检查**：
- ✅ 使用注册表模式，不是 switch-case 硬编码
- ✅ 执行器函数签名统一，可复用
- ✅ 交互创建标准化，不是每个技能自定义
- ✅ 事件类型统一，不是每个技能自定义事件
- ✅ 新增技能只需注册，不需要修改 validate/execute/UI

---

