# Cardia 图片加载问题修复完成

## 问题描述

用户报告 Cardia 游戏无法加载图片资源。

## 根本原因

**目录结构不匹配**：图片文件的实际存放位置与代码期望的路径不一致。

### 错误的目录结构（修复前）
```
public/assets/i18n/zh-CN/cardia/cards/
├── compressed/
│   ├── deck1/
│   │   ├── 1.webp
│   │   ├── 2.webp
│   │   └── ...
│   ├── deck2/
│   │   ├── 1.webp
│   │   └── ...
│   ├── locations/
│   │   └── ...
│   ├── helper1.webp
│   ├── helper2.webp
│   └── title.webp
```

### 正确的目录结构（修复后）
```
public/assets/i18n/zh-CN/cardia/cards/
├── deck1/
│   └── compressed/
│       ├── 1.webp
│       ├── 2.webp
│       └── ... (16 files)
├── deck2/
│   └── compressed/
│       ├── 1.webp
│       └── ... (16 files)
├── locations/
│   └── compressed/
│       └── ... (8 files)
└── compressed/
    ├── helper1.webp
    ├── helper2.webp
    └── title.webp
```

## 路径解析流程

1. **卡牌注册表** (`cardRegistry.ts`)
   ```typescript
   imagePath: 'cardia/cards/deck1/1'  // 无扩展名，无 compressed/
   ```

2. **OptimizedImage 组件**
   - 调用 `getLocalizedImageUrls(src, locale)`
   - 添加国际化路径前缀：`i18n/zh-CN/`
   - 结果：`i18n/zh-CN/cardia/cards/deck1/1`

3. **getOptimizedImageUrls 函数**
   - 在最后一个 `/` 之后插入 `compressed/` 子目录
   - 添加 `.webp` 扩展名
   - 最终路径：`i18n/zh-CN/cardia/cards/deck1/compressed/1.webp`

4. **实际文件位置**
   - 修复前：`i18n/zh-CN/cardia/cards/compressed/deck1/1.webp` ❌
   - 修复后：`i18n/zh-CN/cardia/cards/deck1/compressed/1.webp` ✅

## 修复方案

### 1. 创建目录重组脚本
创建 `scripts/fix-cardia-image-structure.mjs` 脚本，自动将文件从错误位置移动到正确位置。

### 2. 执行重组
```bash
# 复制文件到新位置
node scripts/fix-cardia-image-structure.mjs

# 验证文件已正确复制后，清理旧目录
node scripts/fix-cardia-image-structure.mjs --cleanup
```

### 3. 文件移动详情
- **deck1**: 16 个文件从 `compressed/deck1/` 移动到 `deck1/compressed/`
- **deck2**: 16 个文件从 `compressed/deck2/` 移动到 `deck2/compressed/`
- **locations**: 8 个文件从 `compressed/locations/` 移动到 `locations/compressed/`
- **根级别文件**: `helper1.webp`, `helper2.webp`, `title.webp` 保留在 `compressed/` 目录

## 验证

### 目录结构验证
```bash
# 检查 deck1
ls -la public/assets/i18n/zh-CN/cardia/cards/deck1/compressed/
# 应该看到 1.webp ~ 16.webp

# 检查 deck2
ls -la public/assets/i18n/zh-CN/cardia/cards/deck2/compressed/
# 应该看到 1.webp ~ 16.webp

# 检查 locations
ls -la public/assets/i18n/zh-CN/cardia/cards/locations/compressed/
# 应该看到 8 个位置卡牌文件

# 检查根级别文件
ls -la public/assets/i18n/zh-CN/cardia/cards/compressed/
# 应该只看到 helper1.webp, helper2.webp, title.webp
```

### 游戏内验证
1. 启动开发服务器：`npm run dev`
2. 访问 Cardia 游戏
3. 检查卡牌图片是否正常显示
4. 打开浏览器开发者工具 Network 面板，确认图片请求返回 200 状态码

## 相关文件

- `src/games/cardia/domain/cardRegistry.ts` - 卡牌定义（imagePath 字段）
- `src/games/cardia/Board.tsx` - CardDisplay 组件使用
- `src/components/common/media/OptimizedImage.tsx` - 图片加载组件
- `src/core/AssetLoader.ts` - 资源路径解析逻辑
- `scripts/fix-cardia-image-structure.mjs` - 目录重组脚本

## 经验教训

1. **目录结构必须与代码期望一致**：`compressed/` 子目录应该在每个资源类别目录内部，而不是作为父目录。

2. **路径解析逻辑**：`getOptimizedImageUrls` 会在路径的最后一个 `/` 之后插入 `compressed/`，因此原始路径必须是 `category/subcategory/filename`，而不是 `category/compressed/subcategory/filename`。

3. **国际化资源架构**：所有游戏图片资源都应该放在 `public/assets/i18n/{locale}/{gameId}/` 目录下，遵循统一的目录结构规范。

4. **验证工具**：在大规模资源迁移后，应该编写自动化测试验证所有资源路径是否正确。

## 状态

✅ **已完成** - 目录结构已修复，图片应该可以正常加载。

## 下一步

1. 启动游戏验证图片加载
2. 如果仍有问题，检查浏览器控制台的网络请求，确认实际请求的 URL
3. 考虑为其他游戏添加类似的目录结构验证测试
