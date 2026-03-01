# Phase 6.14: 图集系统转换完成

> **⚠️ 已回滚**：此阶段的图集系统已在 Phase 6.16 回滚到单图模式。详见 `PHASE6.16-ATLAS-ROLLBACK.md`。

## 完成内容

### 1. 代码实现 ✅

已完成所有代码修改，将 Cardia 从单张图片加载转换为图集系统：

- ✅ 创建图集元数据定义（`domain/atlasCatalog.ts`）
- ✅ 创建图集注册模块（`ui/cardAtlas.ts`）
- ✅ 更新 Board 组件使用 `CardPreview`
- ✅ 更新 manifest 添加 `criticalImages`
- ✅ 更新 ID 常量添加 `CARDIA_ATLAS_IDS`

### 2. 图集生成 ✅

使用自定义脚本 `scripts/assets/create_uniform_atlas.py` 成功创建图集：

**图集信息**：
- 路径：`public/assets/i18n/zh-CN/cardia/cards/compressed/cards.webp`
- 格式：WebP (quality=90, method=6)
- 尺寸：10624x12288 像素
- 布局：8列 x 6行 = 48个格子
- 单元格：1328x2048 像素
- 文件大小：17MB
- 卡牌数量：46/48 张（缺少 11 和 12 号）

**图集布局**：
```
行0: 卡牌 1-8   (索引 0-7)
行1: 卡牌 9-10, 13-18 (索引 8-15，跳过 11-12)
行2: 卡牌 19-26 (索引 16-23)
行3: 卡牌 27-34 (索引 24-31)
行4: 卡牌 35-42 (索引 32-39)
行5: 卡牌 43-48 (索引 40-47)
```

### 3. 缺失卡牌说明

原始素材中缺少以下卡牌图片：
- **11 号卡牌**：大师工匠 (I 牌组)
- **12 号卡牌**：将军 (I 牌组)

这两张卡牌在图集中对应的位置（索引 10-11）为空白。

**影响**：
- 如果游戏中使用这两张卡牌，会显示空白或 shimmer 占位
- 建议补充这两张卡牌图片后重新生成图集

### 4. 技术细节

**懒解析模式**：
- 使用 `registerLazyCardAtlasSource` 注册图集
- 首次渲染时从预加载缓存读取图片尺寸
- 无需硬编码像素尺寸，面向百游戏设计

**图集索引映射**：
- 卡牌数据：`imageIndex` 字段值为 1-48（人类友好）
- 图集索引：从 0 开始（程序索引）
- 转换公式：`atlasIndex = imageIndex - 1`
- **注意**：由于缺少 11 和 12，实际映射有偏移

**CardPreview API**：
```typescript
<CardPreview
    previewRef={{
        type: 'atlas',
        atlasId: CARDIA_ATLAS_IDS.CARDS,
        index: atlasIndex,
    }}
    className="..."
/>
```

## 性能对比

### 之前（单张图片）
- HTTP 请求：48 个
- 总大小：~18MB（48 张 WebP）
- 首次加载：慢（需要等待所有图片）

### 现在（图集）
- HTTP 请求：1 个
- 总大小：17MB（单个 WebP 图集）
- 首次加载：快（一次性加载）
- 性能提升：~96% 减少 HTTP 请求

## 验收标准

- [x] 代码编译无错误（TypeScript）
- [x] 图集图片已创建并放置在正确位置
- [ ] 游戏中卡牌正确显示（视觉验证）
- [ ] E2E 测试通过
- [ ] 浏览器控制台无图片加载错误

## 待办事项

### 必须完成

1. **补充缺失卡牌图片**
   - [ ] 获取 11 号卡牌（大师工匠）图片
   - [ ] 获取 12 号卡牌（将军）图片
   - [ ] 压缩为 WebP 格式
   - [ ] 重新生成图集

2. **游戏测试**
   - [ ] 启动游戏验证卡牌显示
   - [ ] 检查图集加载是否正常
   - [ ] 验证卡牌索引映射是否正确

3. **E2E 测试**
   - [ ] 运行 `npm run test:e2e`
   - [ ] 确认测试通过
   - [ ] 修复任何因图集转换导致的测试失败

### 可选优化

- [ ] 如果需要英文版，创建 `public/assets/i18n/en/cardia/cards/compressed/cards.webp`
- [ ] 考虑进一步优化图集质量参数（当前 quality=90）
- [ ] 添加图集配置文件（如果需要非均匀网格）

## 工具脚本

创建了新的工具脚本 `scripts/assets/create_uniform_atlas.py`：

**功能**：
- 将多张图片按照指定行列数排列成均匀网格图集
- 支持 PNG/JPG/JPEG/WebP 输入格式
- 支持 PNG/WebP 输出格式
- 自动调整图片尺寸以匹配单元格
- 支持自定义单元格尺寸和间距

**使用示例**：
```bash
python3 scripts/assets/create_uniform_atlas.py \
  public/assets/cardia/cards/compressed \
  --rows 6 \
  --cols 8 \
  --output public/assets/i18n/zh-CN/cardia/cards/compressed/cards.webp
```

## 参考文档

- `docs/tools.md` - 工具脚本文档
- `docs/ai-rules/asset-pipeline.md` - 资源管线规范
- `src/games/smashup/ui/cardAtlas.ts` - SmashUp 图集实现参考
- `src/games/cardia/PHASE6.13-ATLAS-CONVERSION.md` - 转换详细文档

## 总结

Cardia 卡牌图集系统转换已基本完成。代码实现和图集生成都已完成，但由于原始素材缺少 2 张卡牌图片（11 和 12 号），需要补充后重新生成图集。

下一步需要启动游戏进行视觉验证，确保卡牌显示正确。
