# SmashUp 基地限制标识 UI

## 概述

基地限制标识系统是一个通用的 UI 功能，用于在基地卡片**内部顶部**显示当前生效的限制信息（如 Block the Path 封锁的派系图标）。

## 设计原则

- **通用性**：不只针对 Block the Path，未来其他限制类型（如 Ornate Dome 禁止打行动卡）也能复用
- **数据驱动**：UI 层通过 `getBaseRestrictions()` 函数获取限制信息，不需要硬编码特定卡牌逻辑
- **可扩展性**：新增限制类型只需在 `getBaseRestrictions()` 中添加检测逻辑，UI 层自动渲染
- **视觉清晰**：使用派系 SVG 图标 + 红色斜杠，直观表达"禁止"含义

## 架构

### 数据层（`domain/ongoingEffects.ts`）

```typescript
/** 基地限制信息（用于 UI 显示） */
export interface BaseRestrictionInfo {
    /** 限制类型 */
    type: 'blocked_faction' | 'blocked_action';
    /** 显示文本（如派系 ID） */
    displayText: string;
    /** 来源卡牌 defId */
    sourceDefId: string;
}

/**
 * 获取基地上的所有限制信息（用于 UI 显示）
 */
export function getBaseRestrictions(state: SmashUpCore, baseIndex: number): BaseRestrictionInfo[]
```

### UI 层（`ui/BaseZone.tsx`）

- 在基地卡片**内部顶部**（`top-[0.6vw]`）居中显示限制标识
- 红色圆形背景 + 派系 SVG 图标 + 白色斜杠
- 使用 framer-motion 旋转缩放动画入场
- 支持多个限制同时显示（水平排列）

## 当前支持的限制类型

### 1. Block the Path（通路禁止）

- **类型**：`blocked_faction`
- **显示**：红色圆形徽章 + 派系 SVG 图标 + 白色斜杠
- **数据来源**：`base.ongoingActions` 中 `defId === 'trickster_block_the_path'` 的卡牌的 `metadata.blockedFaction`
- **图标来源**：`getFactionMeta(factionId).icon`（来自 `ui/factionMeta.ts`）

## 未来扩展

### 添加新限制类型的步骤

1. **在 `BaseRestrictionInfo.type` 中添加新类型**（如 `'blocked_action'`）
2. **在 `getBaseRestrictions()` 中添加检测逻辑**：
   ```typescript
   const domeAction = base.ongoingActions.find(o => o.defId === 'steampunk_ornate_dome');
   if (domeAction) {
       restrictions.push({
           type: 'blocked_action',
           displayText: 'action',
           sourceDefId: 'steampunk_ornate_dome',
       });
   }
   ```
3. **在 `BaseZone.tsx` 中添加渲染逻辑**：
   ```tsx
   if (restriction.type === 'blocked_action') {
       return (
           <motion.div className="...">
               {/* 自定义图标（如禁止符号） */}
           </motion.div>
       );
   }
   ```

## 测试

测试文件：`src/games/smashup/__tests__/ongoingEffects.test.ts`

- ✅ 返回 Block the Path 限制信息
- ✅ 无限制时返回空数组
- ✅ Block the Path 无 metadata 时不返回限制

## 视觉效果

- **位置**：基地卡片内部顶部 0.6vw，居中对齐
- **层级**：`z-20`（在基地图片之上，在放大镜按钮之下）
- **尺寸**：圆形徽章 2.5vw × 2.5vw，图标 1.4vw × 1.4vw
- **颜色**：红色背景（`bg-red-600/95`）+ 红色边框（`border-red-400`）+ 白色图标和斜杠
- **动画**：旋转缩放入场（从 -180° 旋转到 0°，spring 动画）
- **交互**：鼠标悬停显示完整提示文本（派系名称 + 限制说明）

## 相关文件

- `src/games/smashup/domain/ongoingEffects.ts` - 数据层
- `src/games/smashup/ui/BaseZone.tsx` - UI 层
- `src/games/smashup/ui/factionMeta.ts` - 派系元数据和图标
- `src/games/smashup/__tests__/ongoingEffects.test.ts` - 测试

