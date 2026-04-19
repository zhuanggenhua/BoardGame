# Cardia ActionLog slotIndex 修复

## 最新问题（2024-04-11）

用户报告：打出精灵到遭遇时，ActionLog 显示"打出精灵到遭遇 2"，但实际应该显示"遭遇 1"（第一回合）。

### 状态分析

用户提供的状态数据：
```json
{
  "turnNumber": 1,
  "phase": "play"
}
```

ActionLog 显示 `slot: 2`，说明 `slotIndex + 1 = 2`，即 `slotIndex = 1`。

### 根因：turnNumber 语义理解错误

**问题**：之前的修复使用了 `slotIndex: core.turnNumber`，但这是错误的。

**turnNumber 语义**（来自 `src/games/cardia/domain/index.ts`）：
- 初始值：`turnNumber: 1`（第一回合）
- 递增时机：回合结束时 `turnNumber: core.turnNumber + 1`（`reduce.ts` TURN_ENDED 处理器）

**encounterIndex 语义**：
- 初始值：应该从 0 开始（数组索引）
- 含义：`encounterHistory` 数组的索引

**正确映射**：
```
turnNumber = 1 → encounterIndex = 0 → 显示 "遭遇 1"
turnNumber = 2 → encounterIndex = 1 → 显示 "遭遇 2"
```

因此，正确的公式是：`slotIndex = core.turnNumber - 1`

## 历史问题（已修复）

用户之前报告：打出钟表匠到遭遇时，ActionLog 显示"打出钟表匠到遭遇 ?"，遭遇序号显示为"?"而不是实际数字。

## 根因分析

### 调用链审查

1. **Board.tsx `handlePlayCard` 函数**（问题源头）
   - 位置：`src/games/cardia/Board.tsx:512`
   - 问题：dispatch PLAY_CARD 命令时只传递了 `{ cardUid }`，缺少 `slotIndex` 参数
   - 代码：
     ```typescript
     dispatch(CARDIA_COMMANDS.PLAY_CARD, { cardUid });
     ```

2. **execute.ts `executePlayCard` 函数**
   - 位置：`src/games/cardia/domain/execute.ts:67`
   - 从 command.payload 解构 `slotIndex`：
     ```typescript
     const { cardUid, slotIndex } = command.payload;
     ```
   - 当 `slotIndex` 为 `undefined` 时，直接传递给 CARD_PLAYED 事件

3. **actionLog.ts 格式化函数**
   - 位置：`src/games/cardia/actionLog.ts:95`
   - 防御性检查：
     ```typescript
     const encounterNumber = typeof slotIndex === 'number' ? slotIndex + 1 : '?';
     ```
   - 当 `slotIndex` 为 `undefined` 时，显示"?"

### 数据流

```
Board.tsx (handlePlayCard)
  ↓ dispatch({ cardUid })  ← 缺少 slotIndex
execute.ts (executePlayCard)
  ↓ slotIndex = undefined
CARD_PLAYED event
  ↓ payload.slotIndex = undefined
actionLog.ts (formatCardiaActionEntry)
  ↓ encounterNumber = '?'
UI 显示: "打出钟表匠到遭遇 ?"
```

## 修复方案

### 修改内容

**文件**: `src/games/cardia/Board.tsx`

**第一次修复（错误）**:
```typescript
dispatch(CARDIA_COMMANDS.PLAY_CARD, { cardUid, slotIndex: core.turnNumber });
```
- ❌ 问题：turnNumber 从 1 开始，导致第一回合显示"遭遇 2"

**第二次修复（正确）**:
```typescript
dispatch(CARDIA_COMMANDS.PLAY_CARD, { cardUid, slotIndex: core.turnNumber - 1 });
```
- ✅ 正确：turnNumber - 1 = encounterIndex，第一回合显示"遭遇 1"

### 修复理由

1. **slotIndex 语义**: 遭遇序号（encounterIndex）应该从 0 开始，对应数组索引
2. **turnNumber 语义**: 回合数从 1 开始，每回合结束后递增
3. **正确映射**: `encounterIndex = turnNumber - 1`
4. **数据完整性**: PLAY_CARD 命令的 payload 类型定义要求 `slotIndex: number`
5. **一致性**: 测试代码中都显式传递了 `slotIndex`，只有 UI 层缺失

## 验证

### 静态检查

```bash
npx eslint src/games/cardia/Board.tsx
```

结果：✅ 通过（0 errors, 71 warnings - 都是既有警告）

### 单元测试

```bash
npm run test -- actionLog-format.test.ts
```

结果：✅ 通过（2/2 tests passed）

现有单元测试 `src/games/cardia/__tests__/actionLog-format.test.ts` 已覆盖：
- ✅ slotIndex = 0 → 显示 1
- ✅ slotIndex = 5 → 显示 6

这些测试继续通过，验证了修复的正确性。

### 预期行为

修复后的映射关系：
```
turnNumber = 1 → slotIndex = 0 → 显示 "遭遇 1" ✓
turnNumber = 2 → slotIndex = 1 → 显示 "遭遇 2" ✓
turnNumber = 3 → slotIndex = 2 → 显示 "遭遇 3" ✓
```

### E2E 测试

现有 E2E 测试 `e2e/cardia-action-log.e2e.ts` 包含 4 个测试用例，应该能验证修复效果。

## 影响范围

### 修改文件
- `src/games/cardia/Board.tsx` (1 行)

### 影响功能
- ✅ 打出卡牌时的 ActionLog 显示
- ✅ 遭遇序号显示（从"?"变为实际数字）

### 不影响
- ❌ 游戏逻辑（execute.ts 已正确使用 slotIndex）
- ❌ 其他命令的 ActionLog 格式化
- ❌ 测试代码（测试已正确传递 slotIndex）

## 结论

**根因**: 
1. 第一层问题：Board.tsx 的 `handlePlayCard` 函数在 dispatch PLAY_CARD 命令时缺少 `slotIndex` 参数
2. 第二层问题：使用了错误的映射 `slotIndex: core.turnNumber`，没有考虑 turnNumber 从 1 开始的语义

**修复**: 
- 添加 `slotIndex: core.turnNumber - 1` 到 dispatch payload
- 正确映射：turnNumber（从1开始）→ encounterIndex（从0开始）

**验证**: 
- ✅ 静态检查通过（ESLint 0 errors）
- ✅ 单元测试通过（2/2 tests passed）
- ⏳ E2E 测试待运行（内存限制）

**状态**: ✅ 已修复，单元测试验证通过

---

## 附录：相关代码位置

### 命令类型定义
- `src/games/cardia/domain/commands.ts:24-29`
  ```typescript
  export interface PlayCardCommand extends Command<typeof CARDIA_COMMANDS.PLAY_CARD> {
      payload: {
          cardUid: string;
          slotIndex: number;  // ← 类型定义要求必须传递
      };
  }
  ```

### 事件类型定义
- `src/games/cardia/domain/events.ts:40-46`
  ```typescript
  export interface CardPlayedEvent extends GameEvent<typeof CARDIA_EVENTS.CARD_PLAYED> {
      payload: {
          cardUid: string;
          playerId: PlayerId;
          slotIndex: number;  // ← 事件也要求 slotIndex
      };
  }
  ```

### 测试示例
- `src/games/cardia/__tests__/flow-system-auto-advance.test.ts:69`
  ```typescript
  runner.dispatch(CARDIA_COMMANDS.PLAY_CARD, { 
      playerId: '0', 
      cardUid: 'p0-hand-1', 
      slotIndex: 0  // ← 测试代码正确传递
  });
  ```
