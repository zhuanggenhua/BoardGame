# Phase 6.13: 卡牌图集系统转换

> **⚠️ 已回滚**：此阶段的图集系统已在 Phase 6.16 回滚到单图模式。详见 `PHASE6.16-ATLAS-ROLLBACK.md`。

## 概述

将 Cardia 的卡牌加载方式从单张图片（`OptimizedImage`）转换为图集系统（`CardPreview` + atlas），参考 SmashUp 的实现模式。

## 变更内容

### 1. 新增文件

#### `src/games/cardia/domain/atlasCatalog.ts`
- 定义图集元数据（唯一数据源）
- 48张卡牌使用 8x6 网格布局
- 图片路径：`cardia/cards/cards`

```typescript
export const CARDIA_ATLAS_DEFINITIONS: readonly CardiaAtlasDefinition[] = [
    {
        id: CARDIA_ATLAS_IDS.CARDS,
        image: 'cardia/cards/cards',
        grid: { rows: 6, cols: 8 },
    },
];
```

#### `src/games/cardia/ui/cardAtlas.ts`
- 注册图集到全局注册表
- 使用懒解析模式（`registerLazyCardAtlasSource`）
- 模块加载时同步注册，零延迟

```typescript
export function initCardiaAtlases() {
    for (const atlas of CARDIA_ATLAS_DEFINITIONS) {
        registerLazyCardAtlasSource(atlas.id, {
            image: atlas.image,
            grid: atlas.grid,
        });
    }
}

// 模块加载时立即注册
initCardiaAtlases();
```

### 2. 修改文件

#### `src/games/cardia/domain/ids.ts`
- 新增 `CARDIA_ATLAS_IDS` 常量
- 定义图集 ID：`'cardia:cards'`

#### `src/games/cardia/Board.tsx`
- 移除 `OptimizedImage` 导入
- 新增 `CardPreview` 导入
- 导入 `./ui/cardAtlas` 触发图集注册
- 修改 `CardDisplay` 组件：
  - 移除派系颜色映射（不再需要）
  - 计算图集索引：`imageIndex - 1`（图集从0开始）
  - 使用 `CardPreview` 组件：
    ```typescript
    <CardPreview
        previewRef={{
            type: 'atlas',
            atlasId: CARDIA_ATLAS_IDS.CARDS,
            index: atlasIndex,
        }}
        className="absolute inset-0 w-full h-full object-cover"
    />
    ```

#### `src/games/cardia/manifest.ts`
- 新增 `criticalImages` 配置
- 从 `atlasCatalog` 获取图集路径
- 确保图集在 Board 渲染前预加载

```typescript
criticalImages: [
    getCardiaAtlasImageById(CARDIA_ATLAS_IDS.CARDS)!,
],
```

### 3. 图集布局

```
8列 x 6行 = 48个格子

行1: 卡牌 1-8   (I牌组: 盗贼-骑士)
行2: 卡牌 9-16  (I牌组: 刺客-精灵)
行3: 卡牌 17-24 (II牌组: 间谍-骑士队长)
行4: 卡牌 25-32 (II牌组: 影刃-继承者)
行5: 预留
行6: 预留
```

## 技术细节

### 懒解析模式

使用 `registerLazyCardAtlasSource` 而非 `registerCardAtlasSource`：
- **优势**：无需硬编码图片像素尺寸
- **原理**：首次渲染时从预加载缓存读取 `HTMLImageElement.naturalWidth/naturalHeight`
- **前提**：`CriticalImageGate` 已预加载图片（通过 `manifest.criticalImages`）

### 图集索引映射

- **卡牌数据**：`imageIndex` 字段值为 1-32（人类友好）
- **图集索引**：从 0 开始（程序索引）
- **转换公式**：`atlasIndex = imageIndex - 1`

### CardPreview API

```typescript
<CardPreview
    previewRef={{
        type: 'atlas',      // 图集类型
        atlasId: string,    // 图集ID（来自 CARDIA_ATLAS_IDS）
        index: number,      // 图集索引（0-based）
    }}
    className?: string
    locale?: string         // 可选，默认从 i18next 获取
/>
```

## 待办事项

### 必须完成（阻塞）

1. **创建图集图片**
   - [ ] 将 48 张单独的卡牌图片合并为一个 8x6 网格的图集
   - [ ] 保存为 `public/assets/i18n/zh-CN/cardia/cards/cards.png`
   - [ ] 运行 `npm run assets:compress` 生成 WebP 压缩版本

2. **验证图集加载**
   - [ ] 启动游戏，检查卡牌是否正确显示
   - [ ] 检查浏览器控制台是否有图片加载错误
   - [ ] 验证图集索引映射是否正确（每张卡显示正确的图片）

3. **更新 E2E 测试**
   - [ ] 运行 `npm run test:e2e` 确认测试通过
   - [ ] 如果测试失败，检查是否因为图片加载方式变更导致

### 可选优化

- [ ] 如果需要英文版，创建 `public/assets/i18n/en/cardia/cards/cards.png`
- [ ] 考虑是否需要为不同卡牌尺寸创建多个图集（当前所有卡牌使用相同尺寸）

## 对比：单图 vs 图集

### 单图模式（之前）
```typescript
<OptimizedImage
    src={`cardia/cards/${card.imageIndex}.jpg`}
    className="..."
/>
```
- **优势**：实现简单，适合少量卡牌（<50张）
- **劣势**：48个 HTTP 请求，首次加载慢

### 图集模式（现在）
```typescript
<CardPreview
    previewRef={{
        type: 'atlas',
        atlasId: 'cardia:cards',
        index: card.imageIndex - 1,
    }}
    className="..."
/>
```
- **优势**：1个 HTTP 请求，加载快，适合大量卡牌
- **劣势**：需要预先制作图集图片

## 参考实现

- **SmashUp**：5个卡牌图集（cards1-5）+ 4个基地图集（base1-4）
- **SummonerWars**：类似的图集系统
- **引擎层**：`src/engine/primitives/spriteAtlas.ts`（图集计算）
- **注册表**：`src/components/common/media/cardAtlasRegistry.ts`（全局注册）

## 验收标准

- [x] 代码编译无错误（TypeScript）
- [ ] 图集图片已创建并放置在正确位置
- [ ] 游戏中卡牌正确显示（视觉验证）
- [ ] E2E 测试通过
- [ ] 浏览器控制台无图片加载错误

## 状态

- **代码实现**：✅ 完成
- **图集图片**：✅ 完成
  - 图集路径：`public/assets/i18n/zh-CN/cardia/cards/compressed/cards.webp`
  - 图集尺寸：10624x12288 (8列 x 6行)
  - 单元格尺寸：1328x2048
  - 文件大小：17MB (WebP 格式，quality=90)
  - 卡牌数量：46/48 (缺少 11 和 12 号卡牌图片)
- **测试验证**：⏳ 待进行

---

**下一步**：启动游戏验证卡牌显示是否正确。
