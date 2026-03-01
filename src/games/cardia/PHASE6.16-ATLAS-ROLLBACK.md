# Phase 6.16: 图集系统回滚

## 概述

将 Cardia 的卡牌加载方式从图集系统（`CardPreview` + atlas）回滚到单张图片模式（`OptimizedImage`），恢复到 Phase 6.13 之前的实现。

## 回滚原因

- 图集制作和维护成本较高
- 32 张卡牌的规模下，单图加载性能完全可接受
- 简化实现，减少抽象层

## 变更内容

### 1. 清理文件

已确认以下文件不存在或已被清理：
- ❌ `src/games/cardia/domain/atlasCatalog.ts` - 不存在
- ❌ `src/games/cardia/ui/cardAtlas.ts` - 不存在
- ✅ `src/games/cardia/ui/` - 目录为空

### 2. 修改文件

#### `src/games/cardia/domain/cardRegistry.ts`
- ✅ 删除 `getAtlasIndex()` 函数（图集索引转换）
- ✅ 更新 `imageIndex` 字段注释：从"图集索引"改为"图片文件编号，对应 cardia/cards/{imageIndex}.jpg"

#### `src/games/cardia/Board.tsx`
- ✅ 已使用 `OptimizedImage` 组件（无需修改）
- ✅ 图片路径：`cardia/cards/${card.imageIndex}.jpg`
- ✅ 无 `CardPreview` 或图集相关导入

#### `src/games/cardia/manifest.ts`
- ✅ 无 `criticalImages` 配置（无需修改）

#### `src/games/cardia/domain/ids.ts`
- ✅ 无 `CARDIA_ATLAS_IDS` 常量（无需修改）

## 技术细节

### 单图模式

```typescript
// Board.tsx - CardDisplay 组件
const imagePath = card.imageIndex ? `cardia/cards/${card.imageIndex}.jpg` : undefined;

<OptimizedImage
    src={imagePath}
    alt={`Card ${card.imageIndex}`}
    className="absolute inset-0 w-full h-full object-cover"
/>
```

### 图片路径规范

- **路径格式**：`cardia/cards/{imageIndex}.jpg`
- **imageIndex 范围**：1-32（I 牌组 1-16，II 牌组 17-32）
- **实际文件位置**：`public/assets/i18n/zh-CN/cardia/cards/{imageIndex}.jpg`
- **压缩版本**：`public/assets/i18n/zh-CN/cardia/cards/compressed/{imageIndex}.webp`

### OptimizedImage 自动处理

`OptimizedImage` 组件会自动：
1. 添加 `i18n/{locale}/` 前缀
2. 查找 `compressed/` 目录下的 WebP 版本
3. 提供 fallback 到原始图片

## 对比：图集 vs 单图

### 图集模式（已回滚）
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
- **优势**：1个 HTTP 请求，加载快
- **劣势**：需要制作图集，维护成本高，缺失卡牌（11、12）导致索引映射复杂

### 单图模式（当前）
```typescript
<OptimizedImage
    src={`cardia/cards/${card.imageIndex}.jpg`}
    className="..."
/>
```
- **优势**：实现简单，维护方便，适合少量卡牌（<50张）
- **劣势**：32个 HTTP 请求（但有浏览器缓存和 HTTP/2 多路复用）

## 性能考虑

### 为什么 32 张卡牌不需要图集？

1. **HTTP/2 多路复用**：现代浏览器支持并行加载多个资源
2. **浏览器缓存**：卡牌图片加载一次后会被缓存
3. **WebP 压缩**：压缩后的图片体积小，加载快
4. **按需加载**：只有显示在屏幕上的卡牌才会加载

### 何时需要图集？

- 卡牌数量 > 100 张
- 需要频繁切换显示大量卡牌
- 移动端网络环境较差

## 验收标准

- [x] 代码编译无错误（TypeScript）
- [x] 删除所有图集相关代码
- [x] `imageIndex` 字段语义正确（对应文件名）
- [ ] 游戏中卡牌正确显示（视觉验证）
- [ ] E2E 测试通过

## 状态

- **代码清理**：✅ 完成
- **文档更新**：✅ 完成
- **测试验证**：⏳ 待进行

---

**注意**：Phase 6.13-6.15 的图集系统已在 Phase 6.16 回滚到单图模式。详见 `PHASE6.16-ATLAS-ROLLBACK.md`。

**下一步**：启动游戏验证卡牌显示是否正确。
