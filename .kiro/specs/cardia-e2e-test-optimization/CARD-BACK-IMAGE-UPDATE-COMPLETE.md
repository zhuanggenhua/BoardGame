# 卡背图片更新完成

## 任务目标
修改卡牌背面图片，使用 `public/assets/i18n/zh-CN/cardia/cards/compressed/deck1-back.webp`

## 实现方案

### 修改 CardBack 组件（Board.tsx）✅

**优化前**：
```tsx
const CardBack: React.FC = () => {
    return (
        <div className="w-32 h-48 bg-gradient-to-br from-purple-800 to-blue-800 rounded-lg border-2 border-purple-600 flex items-center justify-center shadow-lg">
            <div className="text-6xl">🎴</div>
        </div>
    );
};
```

**优化后**：
```tsx
const CardBack: React.FC = () => {
    const [imageError, setImageError] = React.useState(false);
    
    return (
        <div className="w-32 h-48 rounded-lg border-2 border-purple-600 shadow-lg overflow-hidden">
            {!imageError ? (
                <OptimizedImage
                    src="cardia/cards/deck1-back"
                    alt="Card Back"
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                />
            ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-800 to-blue-800 flex items-center justify-center">
                    <div className="text-6xl">🎴</div>
                </div>
            )}
        </div>
    );
};
```

## 技术实现

### 1. 使用 OptimizedImage 组件
- 自动处理国际化路径（`i18n/zh-CN/cardia/cards/`）
- 自动处理压缩版本（`compressed/` 子目录）
- 自动选择最佳格式（WebP）
- 路径简化：只需写 `cardia/cards/deck1-back`，框架自动补全

### 2. 错误降级处理
- 添加 `imageError` 状态追踪图片加载失败
- 图片加载失败时，回退到原始的渐变背景 + emoji
- 确保在任何情况下都有可用的卡背显示

### 3. 样式优化
- 添加 `overflow-hidden` 确保图片不溢出边框
- 使用 `object-cover` 确保图片填充整个区域
- 保持原有的尺寸（`w-32 h-48`）和边框样式

## 显示位置

卡背会在以下场景显示：
1. **遭遇序列**：当前遭遇中未翻开的卡牌
2. **对手手牌**：对手的手牌（如果有显示的话）
3. **历史遭遇**：已解析的遭遇会显示翻开的卡牌，不显示卡背

## 图片资源

- **原始图片**：`public/assets/i18n/zh-CN/cardia/cards/deck1-back.jpg`（如果存在）
- **压缩版本**：`public/assets/i18n/zh-CN/cardia/cards/compressed/deck1-back.webp`
- **自动选择**：`OptimizedImage` 会自动选择压缩版本

## 相关文件

- `src/games/cardia/Board.tsx` - CardBack 组件
- `public/assets/i18n/zh-CN/cardia/cards/compressed/deck1-back.webp` - 卡背图片

## 完成时间
2025-01-03
