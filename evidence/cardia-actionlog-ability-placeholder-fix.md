# Cardia ActionLog - 显示优化修复（完整版）

## 问题描述

ActionLog存在三个显示问题：

### 问题1：能力激活显示重复
**错误显示**：
```
激活能力财务官财务官
```

**原因**：Cardia游戏中每张卡只有一个能力，能力名称就是卡牌名称，所以显示卡牌名+能力名会重复。

**期望显示**：
```
激活能力财务官
```

### 问题2：打出卡牌缺少遭遇序号
**错误显示**：
```
打出伏击者到遭遇
```

**原因**：`slotIndex`参数存在但显示为空，因为索引从0开始但UI显示应该从1开始。

**期望显示**：
```
打出伏击者到遭遇1
```

### 问题3：遭遇序号显示为"?"（新发现）
**错误显示**：
```
打出钟表匠到遭遇 ?
```

**根因**：Board.tsx 的 `handlePlayCard` 函数在 dispatch PLAY_CARD 命令时缺少 `slotIndex` 参数，导致 `slotIndex` 为 `undefined`，actionLog.ts 的防御性检查将其显示为"?"。

**期望显示**：
```
打出钟表匠到遭遇1
```

## 解决方案

### 修复1：简化能力激活日志
移除重复的能力名称显示，只保留卡牌名：

```typescript
// 修复前
segments: [
    i18nSeg('actionLog.activateAbility'),
    cardSeg,
    i18nSeg(`abilities.${abilityId}.name`),  // 重复显示能力名
]

// 修复后
segments: [
    i18nSeg('actionLog.activateAbility'),
    cardSeg,  // 只显示卡牌名，因为能力名=卡牌名
]
```

### 修复2：遭遇序号从1开始显示
将内部索引（从0开始）转换为用户友好的序号（从1开始）：

```typescript
// 修复前
i18nSeg('actionLog.toSlot', { slot: slotIndex })  // 0, 1, 2...

// 修复后
i18nSeg('actionLog.toSlot', { slot: slotIndex + 1 })  // 1, 2, 3...
```

### 修复3：Board.tsx 补全 slotIndex 参数
在 dispatch PLAY_CARD 命令时添加 `slotIndex` 参数：

**文件**: `src/games/cardia/Board.tsx`

```typescript
// 修复前
dispatch(CARDIA_COMMANDS.PLAY_CARD, { cardUid });

// 修复后
dispatch(CARDIA_COMMANDS.PLAY_CARD, { cardUid, slotIndex: core.turnNumber });
```

**调用链分析**：
```
Board.tsx (handlePlayCard)
  ↓ dispatch({ cardUid, slotIndex: core.turnNumber })  ← 补全参数
execute.ts (executePlayCard)
  ↓ slotIndex = core.turnNumber
CARD_PLAYED event
  ↓ payload.slotIndex = core.turnNumber
actionLog.ts (formatCardiaActionEntry)
  ↓ encounterNumber = slotIndex + 1
UI 显示: "打出钟表匠到遭遇1"  ✅
```

## 修改的文件

### `src/games/cardia/actionLog.ts`
1. **PLAY_CARD命令**：`slotIndex + 1`确保显示从1开始
2. **ACTIVATE_ABILITY命令**：移除能力名称segment，避免重复
3. **防御性检查**：当 `slotIndex` 为 `undefined` 时显示"?"（用于捕获未来的类似bug）

### `src/games/cardia/Board.tsx`
1. **handlePlayCard函数**：添加 `slotIndex: core.turnNumber` 到 dispatch payload

## 验证

### 单元测试
```bash
npm run test -- actionLog-format.test.ts
```

**结果**：✅ 2/2 测试通过
- ✅ slotIndex = 0 → 显示 1
- ✅ slotIndex = 5 → 显示 6

### E2E测试
运行了所有ActionLog E2E测试：

```bash
npm run test:e2e:ci -- cardia-action-log.e2e.ts
```

**结果**：✅ 4/4 测试通过

测试覆盖：
- ✅ 基础功能：打出卡牌后生成日志条目
- ✅ 日志内容验证：包含正确的卡牌名称和操作描述
- ✅ 日志顺序：按时间倒序显示
- ✅ 多种操作类型：验证不同命令都能正确记录

### 代码质量检查

```bash
npx eslint src/games/cardia/actionLog.ts
npx eslint src/games/cardia/Board.tsx
npm run i18n:check
```

**结果**：
- ✅ ESLint: 0 errors（只有既有warnings）
- ✅ i18n check: 所有键存在

## 显示效果对比

### 打出卡牌
| 修复前 | 修复后 |
|--------|--------|
| 打出伏击者到遭遇 | 打出伏击者到遭遇1 |
| 打出财务官到遭遇 | 打出财务官到遭遇1 |
| 打出钟表匠到遭遇 ? | 打出钟表匠到遭遇1 |

### 激活能力
| 修复前 | 修复后 |
|--------|--------|
| 激活能力财务官财务官 | 激活能力财务官 |
| 激活能力调停者调停者 | 激活能力调停者 |
| 激活能力傀儡师傀儡师 | 激活能力傀儡师 |

## 设计说明

### 为什么能力名称=卡牌名称？
Cardia游戏的设计特点：
- 每张卡只有一个能力
- 能力是卡牌的核心特征
- 能力名称在游戏规则中就是用卡牌名称表示

因此在ActionLog中只显示卡牌名即可，无需重复显示能力名。

### 为什么遭遇序号从1开始？
- **内部实现**：数组索引从0开始（`slotIndex: 0, 1, 2...`）
- **用户界面**：遭遇序号从1开始显示更符合用户习惯
- **一致性**：与UI中的遭遇序列显示保持一致

### 为什么需要防御性检查？
actionLog.ts 中的防御性检查：
```typescript
const encounterNumber = typeof slotIndex === 'number' ? slotIndex + 1 : '?';
```

这个检查的作用：
1. **捕获bug**：当 Board.tsx 缺少 `slotIndex` 时，显示"?"而不是"NaN"
2. **可调试性**：用户看到"?"时能立即发现问题
3. **向后兼容**：即使未来有新的调用路径忘记传 `slotIndex`，也不会崩溃

## 影响范围

此修复影响所有ActionLog条目：
- **PLAY_CARD**：所有打出卡牌的日志
- **ACTIVATE_ABILITY**：所有能力激活的日志

所有日志现在都更简洁、更易读，且遭遇序号显示正确。

## 技术债务清理

### 已删除文件
- `e2e/cardia-actionlog-debug.e2e.ts`：调试用临时测试文件，问题已定位，不再需要

### 新增证据文档
- `evidence/cardia-actionlog-slotindex-fix.md`：详细记录 slotIndex 修复的根因分析和调用链
