# Card07 - TypeScript 编译错误分析

## 问题根源
代码修改后存在 TypeScript 编译错误，导致代码无法被加载，因此 `[CardiaEventSystem]` 日志从未出现。

## 编译错误列表

### 错误 1: INTERACTION_CREATED 事件不存在
**位置**：`src/games/cardia/domain/systems.ts` 第 186 行

**错误信息**：
```
Property 'INTERACTION_CREATED' does not exist on type CARDIA_EVENTS
```

**原因**：
- 代码中使用了 `CARDIA_EVENTS.INTERACTION_CREATED`
- 但 `CARDIA_EVENTS` 中不存在这个事件类型
- 正确的事件类型是 `CARDIA_EVENTS.ABILITY_INTERACTION_REQUESTED`

**修复方案**：
删除监听 `INTERACTION_CREATED` 事件的代码块，因为：
1. Cardia 不需要监听通用的 `INTERACTION_CREATED` 事件
2. Cardia 只需要监听 `ABILITY_INTERACTION_REQUESTED` 事件（已经有了）
3. 交互创建后会自动被 `InteractionSystem` 处理

### 错误 2: interactionType 字段不存在
**位置**：`src/games/cardia/domain/systems.ts` 第 105 行

**错误信息**：
```
Object literal may only specify known properties, and 'interactionType' does not exist in type 'SimpleChoiceData<unknown>'
```

**原因**：
- `interaction.data` 的类型是 `SimpleChoiceData<unknown>`
- 该类型不包含 `interactionType` 字段
- 这是一个自定义字段，用于 UI 层识别交互类型

**修复方案**：
使用类型断言 `(interaction.data as any).interactionType = ...`

### 错误 3: gameover 类型不匹配
**位置**：`src/games/cardia/domain/systems.ts` 第 156 行

**错误信息**：
```
Type '{ isGameOver: boolean; winnerId: string; }' has no properties in common with type 'GameOverResult'
```

**原因**：
- `sys.gameover` 的类型是 `GameOverResult`
- 但代码中使用了 `{ isGameOver: boolean; winnerId: string; }`
- 类型不匹配

**修复方案**：
使用正确的 `GameOverResult` 类型：
```typescript
sys: {
    ...state.sys,
    gameover: {
        winnerId: payload.winnerId,
    },
}
```

### 错误 4: RandomFn 类型不匹配
**位置**：`src/games/cardia/domain/systems.ts` 第 258 行

**错误信息**：
```
Argument of type '() => number' is not assignable to parameter of type 'RandomFn'
```

**原因**：
- `handler` 函数期望 `RandomFn` 类型
- 但传递了 `() => Math.random()`
- 类型签名不匹配

**修复方案**：
导入正确的 `RandomFn` 类型并使用：
```typescript
import type { RandomFn } from '../../../engine/types';

// 在调用 handler 时
const random: RandomFn = () => Math.random();
handler(newState, playerId, value, interactionData, random, eventTimestamp);
```

## 修复优先级
1. **错误 1（最关键）**：删除 `INTERACTION_CREATED` 事件监听代码
2. **错误 2**：使用类型断言修复 `interactionType`
3. **错误 3**：修复 `gameover` 类型
4. **错误 4**：修复 `RandomFn` 类型

## 预期结果
修复所有编译错误后：
1. 代码能够正常编译和加载
2. `[CardiaEventSystem]` 日志会出现在服务器输出中
3. 测试应该通过

## 教训
- **必须运行 `getDiagnostics` 检查编译错误**
- 代码修改后如果日志没有出现，首先检查是否有编译错误
- TypeScript 编译错误会导致代码无法加载，但不会有明显的运行时错误提示
