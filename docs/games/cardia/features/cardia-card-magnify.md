# Cardia 卡牌放大镜功能

## 功能概述

为 Cardia 游戏添加了卡牌放大镜功能，参考 SmashUp 的实现。玩家可以通过点击卡牌右上角的放大镜按钮查看卡牌的大图。

## 实现细节

### 新增文件

1. **`src/games/cardia/ui/CardMagnifyOverlay.tsx`**
   - 卡牌放大预览覆盖层组件
   - 基于通用的 `MagnifyOverlay` 组件
   - 显示卡牌的完整信息：
     - 卡牌图片（支持 OptimizedImage）
     - 影响力值（左上角）
     - 修正标记（右上角，绿色为正值，红色为负值）
     - 持续能力标记（紫色 🔄 图标）
     - 印戒标记（底部黄色圆点）
     - 卡牌名称和元数据（底部渐变背景）

### 修改文件

1. **`src/games/cardia/Board.tsx`**
   - 导入 `CardMagnifyOverlay` 组件
   - 添加 `magnifyTarget` 状态管理
   - 在 `PlayerArea` 和 `EncounterSequence` 中传递 `onMagnifyCard` 回调
   - 在返回的 JSX 中添加 `CardMagnifyOverlay` 组件

2. **`CardDisplay` 组件**
   - 添加 `onMagnify` 可选属性
   - 在卡牌容器上添加 `group` 类（用于 hover 效果）
   - 添加放大镜按钮（右上角）：
     - 默认隐藏，hover 时显示
     - 使用搜索图标 SVG
     - 点击时调用 `onMagnify` 回调
   - 调整修正标记和持续能力标记的位置，避免与放大镜按钮重叠

3. **`PlayerArea` 组件**
   - 添加 `onMagnifyCard` 可选属性
   - 将回调传递给 `CardDisplay` 组件

4. **`EncounterPair` 组件**
   - 添加 `onMagnifyCard` 可选属性
   - 将回调传递给场上卡牌的 `CardDisplay` 组件

5. **`EncounterSequence` 组件**
   - 添加 `onMagnifyCard` 可选属性
   - 将回调传递给 `EncounterPair` 组件

## 使用方式

1. **手牌区域**：鼠标悬停在手牌上时，右上角会显示放大镜按钮，点击即可查看大图
2. **场上卡牌**：鼠标悬停在场上的卡牌上时，右上角会显示放大镜按钮，点击即可查看大图
3. **关闭大图**：点击覆盖层背景或右上角的关闭按钮（✕）即可关闭

## 设计特点

1. **一致性**：与 SmashUp 的放大镜功能保持一致的交互体验
2. **响应式**：放大镜按钮在 hover 时才显示，不影响正常游戏体验
3. **信息完整**：大图显示所有卡牌信息，包括修正标记、持续能力标记、印戒等
4. **视觉优化**：
   - 使用渐变背景显示卡牌信息
   - 修正标记使用颜色区分正负值
   - 持续能力标记使用紫色和 🔄 图标
   - 印戒使用黄色圆点显示

## 技术实现

- 使用 React Hooks 管理状态
- 使用 Portal 渲染覆盖层，避免被父级裁剪
- 使用 Tailwind CSS 实现响应式布局和动画效果
- 复用通用的 `MagnifyOverlay` 组件，保持代码 DRY 原则

## 测试建议

1. 在手牌区域测试放大镜功能
2. 在场上卡牌测试放大镜功能
3. 测试不同状态的卡牌（有修正标记、持续能力标记、印戒等）
4. 测试关闭功能（点击背景、点击关闭按钮）
5. 测试响应式布局（不同屏幕尺寸）
