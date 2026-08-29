# 精灵图渲染经验归档

本文是 Summoner Wars 卡牌精灵图裁切问题的历史记录。当前图集问题优先回到现有 atlas 配置、裁图脚本和资源验收流程；本文保留当时已经验证过的失败路径和最终有效做法，避免重复试错。

## 当时问题

卡牌精灵图横向排列多帧时，运行时渲染出现黑色区域。问题不是单纯“图片没加载”，而是容器比例、帧裁切和真实内容区域没有对齐。

## 已尝试但不稳定的方案

### img + transform

```tsx
<img
  style={{
    width: `${totalFrames * 100}%`,
    transform: `translateX(-${offsetPercent}%)`,
  }}
/>
```

问题：黑色区域仍然存在，疑似容器高度和图片实际内容高度不一致。

### img + margin-left

```tsx
<img
  className="h-full"
  style={{
    width: `${totalFrames * 100}%`,
    marginLeft: `${-frameIndex * 100}%`,
  }}
/>
```

问题：仍然无法裁掉黑边。

### background-position

```tsx
<div
  style={{
    aspectRatio: `${frameWidth / frameHeight}`,
    backgroundImage: `url(${webp})`,
    backgroundSize: `${totalFrames * 100}% 100%`,
    backgroundPosition: `${bgPositionX}% 0`,
  }}
/>
```

问题：如果帧的真实内容高度不是整张图高度，仍会显示填充区。

### object-fit / object-position

```tsx
<img
  className="w-full h-full object-cover"
  style={{ objectPosition: `${offsetPercent}% 0` }}
/>
```

问题：百分比定位不适合精确帧裁切，容易裁偏。

## 当时关键教训

- 精灵图宽高比不是单帧宽高比。容器应按单帧宽高比布局，图片或背景再按帧数展开。
- `aspectRatio` 只解决容器高度，不解决图片真实内容区域和填充区问题。
- 网格交互层和卡牌显示层要分开：网格负责点击，卡牌层使用 `pointer-events: none`，避免遮挡交互。
- 渲染问题必须同时检查源图、压缩图、帧尺寸配置、实际 URL 和 E2E 截图。

## 最终有效方案

旧文档记录最终参考 DiceThrone 的 `CardAtlasConfig` 思路，使用精确帧配置，而不是假设等分图集：

```ts
export interface SpriteAtlasConfig {
  imageW: number;
  imageH: number;
  cols: number;
  rows: number;
  colStarts: number[];
  colWidths: number[];
  rowStarts: number[];
  rowHeights: number[];
}
```

旧记录中的死灵法师示例：

```ts
export const NECROMANCER_ATLAS: SpriteAtlasConfig = {
  imageW: 2088,
  imageH: 1458,
  cols: 2,
  rows: 1,
  colStarts: [0, 1045],
  colWidths: [1044, 1043],
  rowStarts: [0],
  rowHeights: [729],
};
```

关键点：`rowHeights` 用真实内容高度 `729`，不是整张图高度 `1458`，从而裁掉底部黑色填充区。

## 当前使用口径

- 不要把“显示黑边”直接归因成 CSS 或压缩失败；先量源图真实内容区域。
- 图集配置需要记录每行/每列真实起点和尺寸。
- 正式修复必须用当前图集、当前压缩产物和真实截图验证。
- 本文只是历史经验，不定义当前 Summoner Wars 或其它游戏的正式 atlas 合同。
