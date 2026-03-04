# Bug: 神选者交互显示为基地图标导致卡死

## 状态：✅ 已修复

## 问题描述

用户反馈："哪里来的神选者效果"
- 神选者的确认交互（"是否抽一张疯狂卡来获得+2力量？"）显示为**基地卡牌图标**
- 应该显示为"是/否"文字按钮
- 基地图标显示不完整，可能导致交互卡死

## 截图证据

用户提供的截图显示：
- 标题："神选者：是否抽一张疯狂卡来获得+2力量？"
- 显示了基地卡牌图标（伊万斯堡城镇公墓）
- 只看到"否（不触发）"按钮，"是"选项可能被遮挡

## 预期行为

- 神选者的交互应该显示为简单的"是/否"按钮
- 不应该显示基地卡牌图标
- 两个选项都应该清晰可见

## 实际行为

- UI 将交互渲染为"基地选择"模式
- 显示基地卡牌图标而不是文字按钮
- 可能导致选项显示不完整或交互卡死

## 根因分析

### 问题代码（修复前）

`src/games/smashup/abilities/cthulhu.ts` 中的交互选项：

```typescript
{ 
  id: 'yes', 
  label: '是（抽疯狂卡，+2力量）', 
  value: { 
    activate: true, 
    uid: first.uid, 
    baseIndex: first.baseIndex, 
    baseDefId: firstBaseDefId,  // ← 问题：这个字段导致 UI 误判
    controller: first.controller 
  } 
}
```

### UI 判断逻辑

`src/games/smashup/ui/PromptOverlay.tsx` 中的 `isCardOption` 函数：

```typescript
function extractDefId(value: unknown): string | undefined {
    const v = value as Record<string, unknown>;
    if (typeof v.defId === 'string') return v.defId;
    if (typeof v.minionDefId === 'string') return v.minionDefId;
    if (typeof v.baseDefId === 'string') return v.baseDefId;  // ← 检测到 baseDefId
    return undefined;
}

function isCardOption(option): boolean {
    if (option.displayMode === 'button') return false;
    const defId = extractDefId(option.value);
    return !!defId;  // ← 有 defId 就认为是卡牌选项
}
```

### 问题链路

1. 神选者交互选项的 `value` 中包含 `baseDefId` 字段（用于记录上下文）
2. UI 的 `extractDefId` 检测到 `baseDefId`，返回基地的 defId
3. `isCardOption` 判断有 defId，认为这是"卡牌选择"交互
4. UI 渲染成基地卡牌图标，而不是文字按钮
5. 导致显示错误，可能卡死

### 为什么有 `baseDefId`？

检查交互处理器 `cthulhu_chosen_confirm`，发现：
- **处理器完全没有使用 `baseDefId` 字段**
- 只使用了 `activate`、`uid`、`baseIndex`、`controller`
- `baseDefId` 是多余的字段

## 修复方案

### 修复内容

1. **移除不必要的 `baseDefId` 字段**
2. **添加 `displayMode: 'button'` 显式声明按钮模式**

### 修复代码

```typescript
const interaction = createSimpleChoice(
    `cthulhu_chosen_confirm_${ctx.now}`, first.controller,
    '神选者：是否抽一张疯狂卡来获得+2力量？',
    [
        { 
            id: 'yes', 
            label: '是（抽疯狂卡，+2力量）', 
            value: { activate: true, uid: first.uid, baseIndex: first.baseIndex, controller: first.controller },
            displayMode: 'button' as const  // ← 显式声明按钮模式
        },
        { 
            id: 'no', 
            label: '否（不触发）', 
            value: { activate: false },
            displayMode: 'button' as const
        },
    ],
    'cthulhu_chosen_confirm'
);
```

### 为什么两种修复都需要？

1. **移除 `baseDefId`**：清理不必要的字段，避免误导
2. **添加 `displayMode: 'button'`**：防御性编程，即使将来有其他 defId 字段也不会误判

## 影响范围

- 所有使用神选者的对局
- 可能影响其他类似的"确认交互"（需要排查）

## 测试验证

### 单元测试

创建了 `src/games/smashup/__tests__/cthulhu-chosen-display-mode.test.ts`：

1. ✅ 验证选项有 `displayMode: 'button'`
2. ✅ 验证选项 value 不包含 `baseDefId`
3. ✅ 验证链式交互的第二个神选者也有正确的 displayMode

### 手动测试步骤

1. 打出神选者到基地
2. 触发基地计分
3. 验证交互显示为文字按钮，而不是基地图标
4. 验证两个选项都清晰可见
5. 验证点击"是"和"否"都能正常响应

## 相关文件

- ✅ `src/games/smashup/abilities/cthulhu.ts` - 神选者能力定义（已修复）
- `src/games/smashup/ui/PromptOverlay.tsx` - 交互 UI 渲染逻辑
- ✅ `src/games/smashup/__tests__/cthulhu-chosen-display-mode.test.ts` - 新增测试
- ✅ `docs/bugs/smashup-cthulhu-chosen-wrong-player.md` - Bug 文档

## 总结

修复了神选者交互显示错误的问题。通过移除不必要的 `baseDefId` 字段并添加 `displayMode: 'button'`，确保交互正确显示为文字按钮而不是基地卡牌图标。
