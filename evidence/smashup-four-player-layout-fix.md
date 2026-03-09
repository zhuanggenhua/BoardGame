# 大杀四方四人模式布局优化 - 修复记录

## 问题描述

用户反馈四人模式下基地之间间距太大，导致布局溢出。同时，最右侧基地的最右边玩家列的随从，如果有附着的行动卡，行动卡会溢出到屏幕外看不到。

## 修复过程

### 1. 基地间距调整

**初始错误尝试**：
- 最初修改了 `layoutConfig.ts` 中的 `baseGap` 和 `playerColumnGap`
- 但这些配置并未真正控制基地之间的间距

**根本原因发现**：
- 通过用户提供的开发者工具截图，发现真正的间距来源是 `BaseZone.tsx` 中硬编码的 `mx-[1vw]` 类名（左右各 1vw margin）

**最终修复**：
1. 将 `BaseZone.tsx` 第 85 行的硬编码 `mx-[1vw]` 改为动态 `style={{ marginLeft: ${layout.baseGap / 2}vw, marginRight: ${layout.baseGap / 2}vw }}`
2. 将 `layoutConfig.ts` 中四人模式的 `baseGap` 设置为 0

**最终配置（四人模式）**：
```typescript
{
    baseCardWidth: 11,
    baseGap: 0,
    minionCardWidth: 5,
    minionStackOffset: -5,
    playerColumnGap: 0,
    ongoingCardWidth: 3,
    ongoingTopOffset: 5,
    handAreaHeight: 180,
}
```

### 2. 附着行动卡溢出问题

**问题定位**：
- 用户纠正：不是整个最右侧基地，而是"最右侧基地的最右边玩家列"才会溢出
- 附着行动卡默认显示在随从右侧（`left-full`），导致最右侧玩家的行动卡溢出屏幕

**解决方案**：
1. 在 `BaseZone.tsx` 中修改附着行动卡的渲染逻辑
2. 判断条件：`isRightmostBase && isRightmostPlayer`
3. 如果是最右侧基地的最右边玩家，行动卡显示在左侧（`right-full`），否则显示在右侧（`left-full`）

**作用域问题修复**：
- 初始实现在 IIFE 内部使用了 `turnOrder` 变量，但该变量在 IIFE 作用域内不可用
- 修复：将 `turnOrder` 添加到 `MinionCard` 组件的 props 中
- 在 `BaseZone` 组件调用 `MinionCard` 时传递 `turnOrder` prop

## 修改文件

1. `src/games/smashup/ui/layoutConfig.ts`
   - 四人模式 `baseGap: 0`
   - 四人模式 `playerColumnGap: 0`

2. `src/games/smashup/ui/BaseZone.tsx`
   - 第 85 行：将硬编码 `mx-[1vw]` 改为动态 `style={{ marginLeft: ${layout.baseGap / 2}vw, marginRight: ${layout.baseGap / 2}vw }}`
   - 第 631-650 行：添加附着行动卡位置判断逻辑（最右侧基地的最右边玩家显示在左侧）
   - `MinionCard` 组件：添加 `turnOrder` prop
   - `BaseZone` 组件：调用 `MinionCard` 时传递 `turnOrder` prop

## 验证结果

- ESLint 检查通过（0 errors, 1 warning - 未使用的变量 `baseText`）
- 四人模式基地间距为 0，布局紧凑不溢出
- 最右侧基地的最右边玩家的附着行动卡显示在左侧，不会溢出屏幕

## 教训

1. **硬编码 vs 配置驱动**：硬编码的样式类名（如 `mx-[1vw]`）会绕过配置系统，导致配置修改无效。应该使用动态 style 或配置驱动的类名。
2. **精确定位问题**：用户反馈"最右侧的随从"时，需要进一步确认是"整个最右侧基地"还是"最右侧基地的最右边玩家列"，避免误判问题范围。
3. **作用域问题**：在嵌套组件或 IIFE 中使用外部变量时，必须确保变量在作用域内可访问，通过 props 传递或闭包捕获。
4. **开发者工具的重要性**：用户提供的开发者工具截图直接指出了问题根源（硬编码的 `mx-[1vw]`），比猜测配置文件更高效。

## 相关文档

- `docs/ai-rules/ui-ux.md` - UI/UX 规范
- `src/games/smashup/ui/layoutConfig.ts` - 响应式布局配置
- `src/games/smashup/ui/BaseZone.tsx` - 基地区域组件
