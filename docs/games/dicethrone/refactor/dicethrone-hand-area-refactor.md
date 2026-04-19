# Dicethrone HandArea 重构计划

## 背景

当前 `dicethrone` 的 `HandArea.tsx` 有 690 行代码，完全自己实现拖拽、布局、选中等逻辑，没有复用通用框架 `HandAreaSkeleton`。

## 目标

让 `dicethrone/ui/HandArea.tsx` 复用 `/components/game/framework/HandAreaSkeleton.tsx`，减少重复代码，统一行为。

## 通用框架能力

`HandAreaSkeleton` 已支持：
- `cards` - 卡牌列表
- `renderCard` - 卡牌渲染函数
- `layoutCode` - 布局代码（AI生成）
- `selectEffectCode` - 选中效果代码（AI生成）
- `canDrag` / `canSelect` - 交互控制
- `onPlayCard` / `onSellCard` - 回调
- `dragThreshold` / `sellZoneRef` - 拖拽配置
- `dealAnimation` - 发牌动画

## 重构步骤

1. **分析当前实现**
   - 提取 `HandArea.tsx` 中的业务逻辑
   - 识别与 `HandAreaSkeleton` 重复的部分

2. **迁移到通用框架**
   - 用 `HandAreaSkeleton` 替代拖拽/布局/选中逻辑
   - 业务特化逻辑通过 `renderCard` 和回调注入

3. **保留游戏特化**
   - 飞出动画（`flyingOutCard`）
   - 返回动画（`returningCardMap`）
   - 弃牌模式（`isDiscardMode`）
   - 撤销提示（`undoCardId`）

4. **验证功能**
   - 拖拽打出、售卖
   - 选中效果
   - 发牌动画
   - 飞出/返回动画

## 预期收益

- 减少 ~500 行重复代码
- 统一拖拽/布局/选中行为
- 未来其他游戏可直接复用

## 风险

- 动画复杂度：`HandAreaSkeleton` 可能需要扩展以支持飞出/返回动画
- 兼容性：需要仔细测试确保现有行为不变

## 状态

- [ ] 待执行
