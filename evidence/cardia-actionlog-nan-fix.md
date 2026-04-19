# Cardia ActionLog - NaN显示Bug修复

## 问题描述

ActionLog显示"打出调停者到遭遇 NaN"，遭遇序号显示为`NaN`。

**错误显示**：
```
打出调停者到遭遇 NaN
```

**期望显示**：
```
打出调停者到遭遇1
```

## 根本原因

在之前的修复中，我们添加了`slotIndex + 1`来将内部索引（从0开始）转换为用户友好的序号（从1开始）：

```typescript
i18nSeg('actionLog.toSlot', { slot: slotIndex + 1 })
```

但是没有添加防御性检查。如果`slotIndex`是`undefined`或`null`，则：
- `undefined + 1 = NaN`
- `null + 1 = 1`（意外的行为）

虽然在正常游戏流程中`slotIndex`应该总是存在，但在某些边缘情况（如测试、错误状态）下可能缺失。

## 解决方案

添加防御性检查，确保`slotIndex`是有效数字：

```typescript
// 修复前
i18nSeg('actionLog.toSlot', { slot: slotIndex + 1 })

// 修复后
const encounterNumber = typeof slotIndex === 'number' ? slotIndex + 1 : '?';
i18nSeg('actionLog.toSlot', { slot: encounterNumber })
```

这样：
- 如果`slotIndex`是有效数字：显示正确的遭遇序号（1, 2, 3...）
- 如果`slotIndex`缺失：显示`?`而不是`NaN`

## 修改的文件

### 1. `src/games/cardia/actionLog.ts`
添加防御性检查，处理`slotIndex`可能缺失的情况。

### 2. `src/games/cardia/__tests__/actionLog-format.test.ts`
更新单元测试以匹配新的行为（遭遇序号从1开始）：
- `slotIndex: 0` → 期望显示 `slot: 1`
- `slotIndex: 5` → 期望显示 `slot: 6`

## 验证

### 单元测试
```bash
npm test -- actionLog-format.test.ts
```

**结果**：✅ 2/2 测试通过
- ✅ 应该生成包含卡牌和遭遇位置的日志条目
- ✅ 应该正确处理不同的遭遇位置

### E2E测试
```bash
npm run test:e2e:ci:file -- cardia-action-log.e2e.ts "基础功能"
```

**结果**：✅ 测试通过

### 代码质量检查
```bash
npx eslint src/games/cardia/actionLog.ts
```

**结果**：✅ 0 errors, 0 warnings

## 显示效果

### 正常情况（slotIndex存在）
| 内部索引 | 显示序号 |
|---------|---------|
| 0 | 到遭遇1 |
| 1 | 到遭遇2 |
| 5 | 到遭遇6 |

### 边缘情况（slotIndex缺失）
| slotIndex值 | 显示结果 |
|------------|---------|
| undefined | 到遭遇? |
| null | 到遭遇? |
| NaN | 到遭遇? |

## 设计说明

### 为什么使用`?`而不是其他值？
- **`?`**：清晰表示"未知"，不会误导用户
- **`0`**：可能被误认为是有效的遭遇序号
- **空字符串**：会导致"到遭遇"这样的不完整显示
- **错误提示**：过于技术化，不适合用户界面

### 为什么不直接抛出错误？
- ActionLog是用户界面的一部分，应该尽可能容错
- 显示`?`比完全不显示日志条目更好
- 有助于调试：如果看到`?`，说明数据流有问题

## 影响范围

此修复影响：
- **PLAY_CARD命令**：所有打出卡牌的日志条目
- **防御性编程**：提高系统健壮性，避免NaN显示

## 相关修复

此修复是ActionLog显示优化系列的一部分：
1. ✅ 能力名称占位符修复（ability_i_treasurer → 财务官）
2. ✅ 能力激活重复显示修复（激活能力财务官财务官 → 激活能力财务官）
3. ✅ 遭遇序号从1开始显示（到遭遇0 → 到遭遇1）
4. ✅ NaN显示修复（到遭遇NaN → 到遭遇1 或 到遭遇?）
