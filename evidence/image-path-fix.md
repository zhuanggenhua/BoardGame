# 图片路径修复 - 移除硬编码的 compressed 路径

## 问题描述

所有图片引用都丢失了，浏览器尝试加载 `compressed/compressed/` 的重复路径。

## 根本原因

代码中存在两种不同的图片路径处理方式混用：

1. **旧方式**：在路径中硬编码 `compressed/` 子目录
   - 例如：`'dicethrone/images/Common/compressed/background'`
   
2. **新方式**：`getOptimizedImageUrls()` 自动插入 `compressed/` 子目录
   - 输入：`'dicethrone/images/Common/background'`
   - 输出：`'/assets/dicethrone/images/Common/compressed/background.avif'`

当两者混用时，导致路径重复：
```
❌ /assets/dicethrone/images/Common/compressed/compressed/background.avif
✅ /assets/dicethrone/images/Common/compressed/background.avif
```

## 解决方案

**统一使用新方式**：移除所有硬编码的 `compressed/`，让 `getOptimizedImageUrls()` 统一处理。

### 修改清单

#### 1. `src/games/dicethrone/ui/assets.ts`

**修改前**：
```typescript
const getCharacterAssetBase = (charId: string = 'monk') => (
    charId === 'barbarian'
        ? `dicethrone/images/${charId}`
        : `dicethrone/images/${charId}/compressed`  // ❌ 硬编码 compressed
);

export const ASSETS = {
    // ...
    CARD_BG: 'dicethrone/images/Common/compressed/card-background',  // ❌
    AVATAR: 'dicethrone/images/Common/compressed/character-portraits',  // ❌
};
```

**修改后**：
```typescript
const getCharacterAssetBase = (charId: string = 'monk') => (
    `dicethrone/images/${charId}`  // ✅ 移除 compressed
);

export const ASSETS = {
    // ...
    CARD_BG: 'dicethrone/images/Common/card-background',  // ✅
    AVATAR: 'dicethrone/images/Common/character-portraits',  // ✅
};
```

#### 2. `src/games/dicethrone/Board.tsx`

**修改前**：
```typescript
<OptimizedImage
    src={getLocalizedAssetPath('dicethrone/images/Common/compressed/background', locale)}
    fallbackSrc="dicethrone/images/Common/compressed/background"
/>
```

**修改后**：
```typescript
<OptimizedImage
    src={getLocalizedAssetPath('dicethrone/images/Common/background', locale)}
    fallbackSrc="dicethrone/images/Common/background"
/>
```

#### 3. `src/games/dicethrone/ui/HeroSelectionOverlay.tsx`

同上，移除路径中的 `compressed/`。

#### 4. `src/games/dicethrone/ui/CharacterSelectionAdapter.tsx`

**修改前**：
```typescript
backgroundAsset: 'dicethrone/images/Common/compressed/background',
```

**修改后**：
```typescript
backgroundAsset: 'dicethrone/images/Common/background',
```

#### 5. `src/games/dicethrone/manifest.ts`

**修改前**：
```typescript
thumbnailPath: 'dicethrone/thumbnails/compressed/fengm',
```

**修改后**：
```typescript
thumbnailPath: 'dicethrone/thumbnails/fengm',
```

#### 6. `src/games/dicethrone/__tests__/StatusEffectsIcons.test.tsx`

更新测试断言以匹配新的路径格式。

## 音频路径说明

**音频配置中的 `compressed/` 保持不变**，因为：

1. 音频使用 `assetsPath()` 而非 `getOptimizedImageUrls()`
2. `assetsPath()` 不会自动插入 `compressed/` 子目录
3. 音频配置中的路径是相对于 `basePath` 的完整路径

示例（正确）：
```typescript
// src/lib/audio/common.config.ts
dice_roll: { src: 'dice/compressed/Dice_Roll_Velvet_001.ogg', ... }
```

## 设计原则

### 图片路径规范

1. **配置中使用原始路径**（不含 `compressed/`）
   ```typescript
   thumbnailPath: 'dicethrone/thumbnails/fengm'
   CARD_BG: 'dicethrone/images/Common/card-background'
   ```

2. **由 `OptimizedImage` 组件自动处理压缩格式**
   - 内部调用 `getOptimizedImageUrls()`
   - 自动生成 `.avif` 和 `.webp` 路径
   - 自动插入 `compressed/` 子目录

3. **文件系统结构**
   ```
   public/assets/dicethrone/images/Common/
   ├── background.jpg          # 原始文件
   ├── card-background.jpg     # 原始文件
   └── compressed/             # 压缩输出目录
       ├── background.avif
       ├── background.webp
       ├── card-background.avif
       └── card-background.webp
   ```

### 音频路径规范

1. **配置中使用完整路径**（含 `compressed/`）
   ```typescript
   dice_roll: { src: 'dice/compressed/Dice_Roll_Velvet_001.ogg' }
   ```

2. **由 `AudioManager` 使用 `assetsPath()` 处理**
   - 仅添加 `/assets/` 前缀
   - 不自动插入子目录

## 验证

修改后，所有图片路径应正确解析为：
```
/assets/dicethrone/images/Common/compressed/background.avif
/assets/dicethrone/images/Common/compressed/background.webp
/assets/dicethrone/images/monk/compressed/monk-player-board.avif
/assets/dicethrone/thumbnails/compressed/fengm.avif
```

## 日期

2026-02-04
