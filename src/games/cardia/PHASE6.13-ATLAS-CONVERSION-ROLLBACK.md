# Phase 6.13: 图集转换尝试（已回退）

## 概述

尝试将 Cardia 的卡牌加载方式从单张图片（`OptimizedImage`）转换为图集系统（`CardPreview` + atlas），但由于原始图片缺失（缺少 11.jpg 和 12.jpg），无法创建完整的 48 张卡牌图集，因此回退到原始的单图方案。

## 尝试的变更

### 1. 创建的文件（已删除）

- `src/games/cardia/domain/atlasCatalog.ts` - 图集元数据定义
- `src/games/cardia/ui/cardAtlas.ts` - 图集注册
- `scripts/assets/create_uniform_atlas.py` - 均匀网格图集创建脚本

### 2. 修改的文件（已恢复）

- `src/games/cardia/Board.tsx` - 恢复使用 `OptimizedImage`
- `src/games/cardia/manifest.ts` - 移除 `criticalImages` 配置
- `src/games/cardia/domain/ids.ts` - 移除 `CARDIA_ATLAS_IDS`

## 问题分析

### 缺失的卡牌图片

检查发现 `public/assets/cardia/cards/` 目录中缺少以下图片：
- `11.jpg` - I 牌组第 11 张卡（大师工匠）
- `12.jpg` - I 牌组第 12 张卡（将军）

这导致无法创建完整的 48 张卡牌图集（8x6 网格）。

### 图集创建尝试

使用 `create_uniform_atlas.py` 脚本尝试创建图集：
```bash
python3 scripts/assets/create_uniform_atlas.py \
  public/assets/cardia/cards/compressed \
  --rows 6 --cols 8 \
  --output public/assets/i18n/zh-CN/cardia/cards/cards.png
```

结果：只能创建包含 46 张卡牌的图集（缺少索引 11 和 12）。

## 当前方案（单图模式）

### 优势
- 实现简单，无需额外的图集配置
- 适合卡牌数量较少的游戏（48 张）
- 不依赖完整的图片集合

### 劣势
- 48 个 HTTP 请求（每张卡一个请求）
- 首次加载时间较长

### 代码示例

```typescript
// Board.tsx
<OptimizedImage
    src={`cardia/cards/${card.imageIndex}.jpg`}
    alt={`Card ${card.imageIndex}`}
    className="absolute inset-0 w-full h-full object-cover"
/>
```

## 未来改进建议

如果要切换到图集系统，需要：

1. **补充缺失的卡牌图片**
   - 添加 `11.jpg` 和 `12.jpg` 到 `public/assets/cardia/cards/`
   - 运行 `npm run assets:compress` 生成压缩版本

2. **创建图集**
   ```bash
   python3 scripts/assets/create_uniform_atlas.py \
     public/assets/cardia/cards/compressed \
     --rows 6 --cols 8 \
     --output public/assets/i18n/zh-CN/cardia/cards/cards.png
   ```

3. **恢复图集代码**
   - 恢复 `atlasCatalog.ts` 和 `cardAtlas.ts`
   - 在 `Board.tsx` 中使用 `CardPreview`
   - 在 `manifest.ts` 中添加 `criticalImages`

## 状态

- **图集转换**：❌ 已回退
- **单图方案**：✅ 已恢复
- **代码编译**：✅ 无错误
- **功能正常**：✅ 卡牌显示正常

---

**结论**：由于原始素材不完整，暂时保持单图方案。待补充完整的卡牌图片后，可以再次尝试图集转换。
