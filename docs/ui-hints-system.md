# UI 提示系统使用指南

> **引擎层轻量级 UI 提示系统**，用于在 UI 层显示"可交互实体"的视觉提示

## 概述

UI 提示系统提供了一个标准化的方式来查询和显示可交互实体（如可移动的单位、可使用技能的单位、可放置卡牌的位置）。

### 设计原则

1. **职责分离**：引擎层定义接口，游戏层实现逻辑，UI 层消费数据
2. **轻量级**：引擎层只有类型定义和工具函数，无具体实现
3. **可选使用**：游戏可以选择不使用此系统
4. **类型安全**：使用 TypeScript 泛型，编译时检查

### 三层架构

```
┌─────────────────────────────────────────────────────────┐
│ UI 层 (useCellInteraction.ts)                          │
│ - 调用 getXxxUIHints()                                 │
│ - 使用 extractPositions() 提取位置                     │
│ - 渲染视觉效果（边框/波纹/高亮）                       │
└─────────────────────────────────────────────────────────┘
                          ↓ 调用
┌─────────────────────────────────────────────────────────┐
│ Domain 层 (uiHints.ts)                                  │
│ - 实现 getXxxUIHints()                                 │
│ - 调用业务逻辑函数                                      │
│ - 返回 UIHint[]                                         │
└─────────────────────────────────────────────────────────┘
                          ↓ 使用
┌─────────────────────────────────────────────────────────┐
│ 引擎层 (engine/primitives/uiHints.ts)                  │
│ - 定义 UIHint 类型                                      │
│ - 定义 UIHintProvider 接口                             │
│ - 提供工具函数                                          │
└─────────────────────────────────────────────────────────┘
```

## 核心类型

### UIHint

```typescript
interface UIHint {
  /** 提示类型 */
  type: 'actionable' | 'ability' | 'target' | 'placement' | 'selection';
  /** 实体位置 */
  position: Position;
  /** 实体 ID（可选） */
  entityId?: string;
  /** 可用的操作列表（可选） */
  actions?: string[];
  /** 额外元数据（游戏特定） */
  meta?: Record<string, unknown>;
}
```

### UIHintType

- `actionable` - 可执行操作（移动/攻击）
- `ability` - 可使用技能
- `target` - 可选择目标
- `placement` - 可放置位置
- `selection` - 可选择实体

### UIHintProvider

```typescript
type UIHintProvider<TCore = unknown> = (
  core: TCore,
  filter?: UIHintFilter
) => UIHint[];
```

### UIHintFilter

```typescript
interface UIHintFilter {
  /** 只返回指定类型的提示 */
  types?: UIHintType[];
  /** 只返回指定阶段的提示 */
  phase?: string;
  /** 只返回指定玩家的提示 */
  playerId?: string;
  /** 游戏特定过滤条件 */
  custom?: Record<string, unknown>;
}
```

## 使用流程

### 1. 游戏层实现 UIHintProvider

在 `games/<gameId>/domain/uiHints.ts` 中实现：

```typescript
import type { UIHint, UIHintFilter } from '../../../engine/primitives/uiHints';
import type { MyGameCore, PlayerId, GamePhase } from './types';

export function getMyGameUIHints(
  core: MyGameCore,
  filter?: UIHintFilter
): UIHint[] {
  const hints: UIHint[] = [];
  const playerId = filter?.playerId as PlayerId;
  const phase = filter?.phase as GamePhase;
  const types = filter?.types;

  // 可移动/攻击的单位
  if (!types || types.includes('actionable')) {
    hints.push(...getActionableUnitHints(core, playerId, phase));
  }

  // 可使用技能的单位
  if (!types || types.includes('ability')) {
    hints.push(...getAbilityReadyHints(core, playerId, phase));
  }

  return hints;
}

// 内部辅助函数
function getActionableUnitHints(
  core: MyGameCore,
  playerId: PlayerId,
  phase: GamePhase
): UIHint[] {
  const hints: UIHint[] = [];
  const units = getPlayerUnits(core, playerId);

  for (const unit of units) {
    if (canUnitAct(unit, phase)) {
      hints.push({
        type: 'actionable',
        position: unit.position,
        entityId: unit.id,
        actions: getAvailableActions(unit, phase),
      });
    }
  }

  return hints;
}
```

### 2. UI 层消费数据

在 UI Hook 中调用：

```typescript
import { getMyGameUIHints } from '../domain/uiHints';
import { extractPositions } from '../../../engine/primitives/uiHints';

const abilityReadyPositions = useMemo(() => {
  if (!isMyTurn) return [];
  
  const hints = getMyGameUIHints(core, {
    types: ['ability'],
    playerId: myPlayerId,
    phase: currentPhase,
  });
  
  return extractPositions(hints);
}, [core, currentPhase, isMyTurn, myPlayerId]);

const actionablePositions = useMemo(() => {
  if (!isMyTurn) return [];
  
  const hints = getMyGameUIHints(core, {
    types: ['actionable'],
    playerId: myPlayerId,
    phase: currentPhase,
  });
  
  return extractPositions(hints);
}, [core, currentPhase, isMyTurn, myPlayerId]);
```

### 3. 渲染视觉提示

在 UI 组件中：

```typescript
// 绿色边框（可移动/攻击）
{actionablePositions.map(pos => (
  <div
    key={`actionable-${pos.row}-${pos.col}`}
    className="absolute inset-0 border-2 border-green-500 rounded pointer-events-none"
  />
))}

// 青色波纹（可使用技能）
{abilityReadyPositions.map(pos => (
  <AbilityReadyIndicator
    key={`ability-${pos.row}-${pos.col}`}
    position={pos}
  />
))}
```

## 工具函数

### extractPositions

提取位置列表：

```typescript
const positions = extractPositions(hints);
// [{ row: 0, col: 0 }, { row: 1, col: 1 }, ...]
```

### filterUIHints

过滤提示：

```typescript
const abilityHints = filterUIHints(hints, {
  types: ['ability'],
});
```

### groupUIHintsByType

按类型分组：

```typescript
const groups = groupUIHintsByType(hints);
// Map {
//   'actionable' => [hint1, hint2],
//   'ability' => [hint3, hint4],
// }
```

## 完整示例

### 召唤师战争

```typescript
// games/summonerwars/domain/uiHints.ts
export function getSummonerWarsUIHints(
  core: SummonerWarsCore,
  filter?: UIHintFilter
): UIHint[] {
  const hints: UIHint[] = [];
  const playerId = (filter?.playerId ?? '0') as PlayerId;
  const phase = (filter?.phase ?? core.phase) as GamePhase;
  const types = filter?.types;

  // 可移动/攻击的单位
  if (!types || types.includes('actionable')) {
    const units = getPlayerUnits(core, playerId);
    
    if (phase === 'move') {
      const remainingMoves = MAX_MOVES_PER_TURN - core.players[playerId].moveCount;
      for (const u of units) {
        if (!u.hasMoved && canMove(u)) {
          hints.push({
            type: 'actionable',
            position: u.position,
            entityId: u.cardId,
            actions: ['move'],
          });
          if (hints.length >= remainingMoves) break;
        }
      }
    }
  }

  // 可使用技能的单位
  if (!types || types.includes('ability')) {
    const units = getPlayerUnits(core, playerId);
    
    for (const u of units) {
      if (phase === 'move' && u.hasMoved) continue;
      
      const activatableAbilities = getActivatableAbilities(u, phase);
      const usableAbilities = activatableAbilities.filter(abilityId =>
        canActivateAbility(core, u, abilityId, playerId)
      );
      
      if (usableAbilities.length > 0) {
        hints.push({
          type: 'ability',
          position: u.position,
          entityId: u.cardId,
          actions: usableAbilities,
        });
      }
    }
  }

  return hints;
}

// games/summonerwars/ui/useCellInteraction.ts
const abilityReadyPositions = useMemo(() => {
  if (!isMyTurn) return [];
  
  const hints = getSummonerWarsUIHints(core, {
    types: ['ability'],
    playerId: myPlayerId,
    phase: currentPhase,
  });
  
  return extractPositions(hints);
}, [core, currentPhase, isMyTurn, myPlayerId]);
```

## 最佳实践

### 1. 使用 useMemo 缓存

```typescript
const hints = useMemo(() => {
  return getMyGameUIHints(core, filter);
}, [core, filter]);
```

### 2. 只计算需要的类型

```typescript
// ✅ 好：只计算技能提示
const hints = getMyGameUIHints(core, { types: ['ability'] });

// ❌ 差：计算所有类型再过滤
const allHints = getMyGameUIHints(core);
const abilityHints = allHints.filter(h => h.type === 'ability');
```

### 3. 不要在 core 中存储 UI 提示

```typescript
// ❌ 错误：UI 提示不应该在 core 中
interface GameCore {
  availableAbilityUnits: Position[];  // 错误！
}

// ✅ 正确：UI 提示是派生数据，在需要时计算
const hints = getMyGameUIHints(core, filter);
```

### 4. 封装内部辅助函数

```typescript
// ✅ 好：封装内部逻辑
function getAbilityReadyHints(core, playerId, phase): UIHint[] {
  // 复杂的业务逻辑
}

export function getMyGameUIHints(core, filter): UIHint[] {
  // 只负责组合和过滤
  if (!filter?.types || filter.types.includes('ability')) {
    hints.push(...getAbilityReadyHints(core, playerId, phase));
  }
}
```

## 注意事项

1. **不要在 UI 层计算业务逻辑**：所有业务规则判断应该在 domain 层
2. **使用过滤器提高性能**：只计算需要的提示类型
3. **保持类型安全**：使用 TypeScript 类型系统
4. **测试 domain 层**：UIHintProvider 是纯函数，易于测试

## 参考实现

- 引擎层：`src/engine/primitives/uiHints.ts`
- 召唤师战争：`src/games/summonerwars/domain/uiHints.ts`
- UI 层使用：`src/games/summonerwars/ui/useCellInteraction.ts`
- E2E 测试：`e2e/summonerwars/summonerwars-ability-indicators.e2e.ts`

## 未来扩展

### 支持更多提示类型

```typescript
type UIHintType =
  | 'actionable'
  | 'ability'
  | 'target'
  | 'placement'
  | 'selection'
  | 'warning'      // 警告提示（如危险区域）
  | 'suggestion';  // 建议提示（如最佳移动位置）
```

### 支持优先级和动画

```typescript
interface UIHint {
  // ...
  priority?: number;
  animation?: {
    type: 'pulse' | 'glow' | 'shake';
    duration?: number;
  };
}
```
