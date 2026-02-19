# 精灵图渲染经验教训

> 记录 Summoner Wars 卡牌精灵图渲染过程中的尝试和教训，避免重复踩坑。

## 问题描述

卡牌精灵图（横向排列多帧）在渲染时出现黑色区域，尝试多种方法未能完全解决。

## 尝试过的方案

### 1. `<img>` + `transform: translateX()`
```tsx
<img
  style={{
    width: `${totalFrames * 100}%`,
    transform: `translateX(-${offsetPercent}%)`,
  }}
/>
```
**问题**：黑色区域仍然存在，可能是容器高度计算问题。

### 2. `<img>` + `margin-left`
```tsx
<img
  className="h-full"
  style={{
    width: `${totalFrames * 100}%`,
    marginLeft: `${-frameIndex * 100}%`,
  }}
/>
```
**问题**：同上，黑色区域仍在。

### 3. CSS `background-image` + `background-position`
```tsx
<div style={{ 
  aspectRatio: `${frameWidth / frameHeight}`,
  backgroundImage: `url(${webp})`,
  backgroundSize: `${totalFrames * 100}% 100%`,
  backgroundPosition: `${bgPositionX}% 0`,
}}/>
```
**问题**：黑色区域依然存在。

### 4. `object-fit: cover` + `object-position`
```tsx
<img
  className="w-full h-full object-cover"
  style={{ objectPosition: `${offsetPercent}% 0` }}
/>
```
**问题**：裁切不准确，`object-position` 百分比计算与预期不符。

## 关键教训

### 1. 精灵图宽高比 vs 容器宽高比
- **精灵图**：总宽度 = 帧数 × 单帧宽度，宽高比 = (帧数 × 帧宽) / 帧高
- **容器**：应使用单帧宽高比 = 帧宽 / 帧高
- **渲染时**：图片宽度 = 帧数 × 100%，图片高度 = 100%

### 2. `aspectRatio` CSS 属性
- 设置容器的 `aspectRatio` 可以自动计算高度
- 但需要确保宽度有明确值（如 `width: 85%`）

### 3. 网格和卡牌应分层
- **网格层**：可点击，用于游戏交互
- **卡牌层**：`pointer-events-none`，不遮挡网格点击
- 卡牌定位在格子中心，尺寸略小于格子（如 85%）方便堆叠

### 4. 调试技巧
- 使用 E2E 测试截图验证渲染效果
- 检查实际 URL 是否指向正确的压缩图片
- 确认精灵图本身没有问题（黑色边框等）

## 待验证

1. **精灵图本身是否有黑色区域**：需要直接查看原始 PNG 文件
2. **压缩后的图片是否完整**：检查 WebP 转换是否损坏
3. **帧尺寸配置是否正确**：512x376 是否与实际图片匹配

## 推荐方案

如果精灵图本身没问题，推荐使用 `background-image` 方案：

```tsx
const CardSprite: React.FC<{ sprite: SpriteSlice }> = ({ sprite }) => {
  const { spriteSheet, frameIndex, totalFrames, frameWidth, frameHeight } = sprite;
  const { webp } = getOptimizedImageUrls(spriteSheet);
  
  return (
    <div style={{ 
      aspectRatio: frameWidth / frameHeight,
      backgroundImage: `url(${webp})`,
      backgroundSize: `${totalFrames * 100}% 100%`,
      backgroundPosition: `${(frameIndex / (totalFrames - 1)) * 100}% 0`,
    }}/>
  );
};
```

## 最终解决方案

参考 dicethrone 的 `CardAtlasConfig` 方式，使用精确的帧配置：

```typescript
// ui/cardAtlas.ts
export interface SpriteAtlasConfig {
  imageW: number;      // 图集总宽度
  imageH: number;      // 图集总高度
  cols: number;        // 列数
  rows: number;        // 行数
  colStarts: number[]; // 每列起始 X
  colWidths: number[]; // 每列宽度
  rowStarts: number[]; // 每行起始 Y
  rowHeights: number[]; // 每行高度（内容高度，不含黑边）
}

// 死灵法师精灵图配置（扫描结果）
export const NECROMANCER_ATLAS: SpriteAtlasConfig = {
  imageW: 2088,
  imageH: 1458,
  cols: 2,
  rows: 1,
  colStarts: [0, 1045],
  colWidths: [1044, 1043],
  rowStarts: [0],
  rowHeights: [729], // 实际内容高度，裁切掉底部黑边
};
```

**关键点**：`rowHeights` 设置为实际内容高度（729px），而非精灵图总高度（1458px），从而裁切掉底部黑色填充区域。

## 更新日志

- 2026-02-04：初始记录，多种方案尝试后黑色区域问题仍存在
- 2026-02-04：参考 dicethrone 的 CardAtlasConfig 方式解决，精确配置每帧尺寸
- 2026-02-04：使用 scan_sprite_bounds.py 扫描得到 2088x1458 / 2 帧 / 内容高 729
