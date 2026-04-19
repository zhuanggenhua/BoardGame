# ActionLog 卡牌预览功能实现

## 需求

在 GameHUD 的行为日志中，当鼠标移到卡牌名称上时，显示卡牌图片预览（Tooltip）。

## 实现方案

### 架构设计

采用**注册表模式**，确保框架层与游戏层解耦：

1. **框架层**（`src/components/game/`）：
   - 提供通用的卡牌预览 Tooltip 组件
   - 提供 ActionLog 片段渲染组件
   - 提供卡牌预览函数注册表

2. **游戏层**（`src/games/dicethrone/`）：
   - 提供游戏特定的卡牌查找函数
   - 在游戏入口处注册到全局注册表

### 新增文件

#### 1. `src/components/game/CardPreviewTooltip.tsx`
卡牌预览 Tooltip 组件，实现：
- 鼠标 hover 时显示卡牌图片
- 使用 `CardPreview` 组件渲染图片
- 卡牌名称带虚线下划线样式
- Tooltip 定位在文本上方，带小三角箭头

#### 2. `src/components/game/ActionLogSegments.tsx`
ActionLog 片段渲染组件，实现：
- 遍历 `ActionLogSegment[]` 数组
- `text` 类型：直接显示文本
- `card` 类型：使用 `CardPreviewTooltip` 显示可 hover 的卡牌名称

#### 3. `src/components/game/cardPreviewRegistry.ts`
卡牌预览函数注册表，实现：
- `registerCardPreviewGetter(gameId, getter)` - 注册函数
- `getCardPreviewGetter(gameId)` - 获取函数

#### 4. `src/games/dicethrone/ui/cardPreviewHelper.ts`
DiceThrone 卡牌查找辅助函数，实现：
- 初始化所有英雄卡牌的 `cardId -> previewRef` 映射
- `getDiceThroneCardPreviewRef(cardId)` - 根据 ID 获取预览引用

### 修改文件

#### 1. `src/components/game/actionLogFormat.ts`
- 在 `ActionLogRow` 类型中新增 `segments: ActionLogSegment[]` 字段
- 在 `buildActionLogRows` 函数中保留原始片段结构

#### 2. `src/components/game/GameHUD.tsx`
- 导入 `ActionLogSegments` 和 `getCardPreviewGetter`
- 从注册表获取当前游戏的卡牌预览函数
- 使用 `ActionLogSegments` 替换原来的纯文本显示

#### 3. `src/games/dicethrone/game.ts`
- 在文件末尾注册 DiceThrone 的卡牌预览函数

## 技术细节

### 1. 卡牌预览数据流

```
ActionLog 系统记录操作
  ↓
formatDiceThroneActionEntry 生成 ActionLogEntry
  ↓ (包含 segments: [{ type: 'card', cardId, previewText }])
GameHUD 获取 actionLog.entries
  ↓
buildActionLogRows 保留 segments
  ↓
ActionLogSegments 渲染片段
  ↓
CardPreviewTooltip 显示 hover 预览
  ↓
CardPreview 渲染卡牌图片（使用 previewRef）
```

### 2. previewRef 获取流程

```
用户 hover 卡牌名称
  ↓
ActionLogSegments 调用 getCardPreviewRef(cardId)
  ↓
cardPreviewRegistry 查找对应游戏的 getter
  ↓
getDiceThroneCardPreviewRef 从卡牌映射表获取 previewRef
  ↓
CardPreviewTooltip 使用 previewRef 渲染图片
```

### 3. 样式设计

- **卡牌名称**：虚线下划线（`decoration-dotted`），hover 时变亮
- **Tooltip 位置**：文本上方居中（`bottom-full mb-2`）
- **卡牌尺寸**：`w-48 h-[308px]`（保持卡牌比例）
- **阴影效果**：`drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5))`
- **小三角**：CSS border 实现，指向文本

## 优势

1. **框架复用**：通用组件可用于其他游戏
2. **解耦设计**：框架层不依赖具体游戏
3. **易于扩展**：新游戏只需注册自己的 getter
4. **性能优化**：卡牌映射表只初始化一次
5. **类型安全**：完整的 TypeScript 类型支持

## 测试验证

### 手动测试步骤

1. 启动 DiceThrone 游戏
2. 打出一张卡牌（如"顿悟！"）
3. 打开 GameHUD 的行为日志面板
4. 鼠标移到日志中的卡牌名称上
5. 验证：
   - ✅ 卡牌名称有虚线下划线
   - ✅ hover 时显示卡牌图片预览
   - ✅ 预览图片位置正确（文本上方）
   - ✅ 预览图片内容正确（对应卡牌）

### 预期效果

```
行为日志：
┌─────────────────────────────────┐
│ 12:34:56          玩家 0        │
│ 打出卡牌 顿悟！                 │  ← hover 这里
│         ~~~~~~                   │
└─────────────────────────────────┘
         ↑
    ┌────────┐
    │ [卡牌] │  ← 显示预览图片
    │ [图片] │
    └────────┘
```

## 后续优化

- [ ] 支持键盘导航（Tab + Enter 显示预览）
- [ ] 添加预览图片加载动画
- [ ] 支持移动端长按预览
- [ ] 添加预览图片缓存机制

## 相关文件

- `src/components/game/CardPreviewTooltip.tsx`
- `src/components/game/ActionLogSegments.tsx`
- `src/components/game/cardPreviewRegistry.ts`
- `src/components/game/actionLogFormat.ts`
- `src/components/game/GameHUD.tsx`
- `src/games/dicethrone/ui/cardPreviewHelper.ts`
- `src/games/dicethrone/game.ts`
