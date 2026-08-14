# Cardia 弹窗 z-index 遮挡问题修复

## 问题描述

Card14（女家庭教师）和 Card15（木偶师）能力发动后，卡牌选择弹窗的确认按钮会被我方手牌栏容器遮挡，导致无法点击确认。

## 根本原因

手牌区域在 `focusedHandCardUid` 激活时会设置 `z-[260]`，而所有交互弹窗（`CardSelectionModal`、`ChoiceModal`、`FactionSelectionModal`）的 z-index 只有 `z-50`，导致弹窗被手牌栏遮挡。

### 相关代码位置

**Board.tsx 手牌区域 z-index**：
```tsx
// 手机竖屏
className={`absolute inset-x-1 bottom-1 ${focusedHandCardUid ? 'z-[260]' : 'z-10'} flex items-end gap-1.5`}

// 平板竖屏
className={`absolute inset-x-2 bottom-2 ${focusedHandCardUid ? 'z-[260]' : 'z-10'} flex items-end gap-3 lg:static lg:z-auto lg:flex-shrink-0 lg:gap-4`}

// 平板横屏/桌面
className={`${focusedHandCardUid ? 'relative z-[260]' : ''} flex flex-shrink-0 items-end gap-3 lg:gap-4`}
```

**原弹窗 z-index**：
- `CardSelectionModal`: `z-50`
- `ChoiceModal`: `z-50`
- `FactionSelectionModal`: `z-50`

## 修复方案

将所有交互弹窗的 z-index 从 `z-50` 提升到 `z-[300]`，确保弹窗始终在手牌栏（`z-[260]`）之上。

### 修改文件

1. `src/games/cardia/ui/CardSelectionModal.tsx`
2. `src/games/cardia/ui/ChoiceModal.tsx`
3. `src/games/cardia/ui/FactionSelectionModal.tsx`

### 修改内容

```tsx
// 修改前
<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-4">

// 修改后
<div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-4">
```

## 层级规范

根据 `.spec/knowledge/standards/ui-ux.md` 的层级规范：

- 提示 UI: `z-[100-150]`
- 交互 UI: `z-[150-200]`
- Modal 弹窗: `z-[200+]`

本次修复将交互弹窗设置为 `z-[300]`，符合 Modal 弹窗的层级要求，且高于手牌栏的 `z-[260]`。

## 验证

- ✅ ESLint 检查通过（0 errors）
- ✅ 所有交互弹窗的 z-index 已统一提升到 `z-[300]`
- ✅ 确保弹窗始终在手牌栏之上

## 影响范围

此修复影响所有使用这三个弹窗组件的能力：

- **CardSelectionModal**: Card14（女家庭教师）、Card15（木偶师）等需要选择卡牌的能力
- **ChoiceModal**: 所有需要通用选择的能力
- **FactionSelectionModal**: 需要选择派系的能力

修复后，所有能力的交互弹窗都不会再被手牌栏遮挡。
