# 山屋惊魂资源结构参照说明

## 1. 目的

这份说明只回答一个问题：为什么 `betrayal` 的正式运行时资源不能继续停留在 `public/assets/betrayal/`，而应迁到 `public/assets/i18n/zh-CN/betrayal/`。

## 2. 现有游戏参照

### 2.1 大杀四方（`smashup`）

- `src/games/smashup/manifest.ts` 中的 `thumbnailPath` 使用逻辑路径：`smashup/thumbnails/smashup`
- 这意味着运行时不会直接引用顶层 `public/assets/smashup/...` 物理目录，而是交给图片解析链路去补齐本地化与压缩路径

### 2.2 七大恨（`qidahen`）

- `src/games/qidahen/rule/七大恨素材接入清单.md` 已明确把旧目录
  `public/assets/qidahen/thumbnails/cover.png`
  标记为废弃
- 正式资源落点写成：
  - `public/assets/i18n/zh-CN/qidahen/`
  - `public/assets/i18n/zh-CN/qidahen/thumbnails/cover.png`

这说明项目里已经有新游戏从“顶层资产目录”迁回“i18n 资源树”的明确先例。

## 3. 运行时合同参照

### 3.1 缩略图组件合同

`src/components/__tests__/ManifestGameThumbnail.test.tsx` 断言：

- `thumbnailPath = demo/thumbnails/cover`
- 实际输出应为  
  `/assets/i18n/zh-CN/demo/thumbnails/compressed/cover.webp`

`src/components/__tests__/HomeV2Thumbnail.test.tsx` 又再次证明：

- 首页目录卡片和详情页缩略图都继续复用同一条 manifest 缩略图链路
- 不走旧的参考图目录

### 3.2 AssetLoader 合同

`src/core/__tests__/AssetLoader.test.ts` 已覆盖：

- `getLocalizedImageUrls('dicethrone/thumbnails/fengm.png', 'zh-CN')`
- 解析结果应命中  
  `/assets/i18n/zh-CN/dicethrone/thumbnails/compressed/fengm.webp`

这说明本地化图片解析是现有正式合同，不是某个单游戏特例。

## 4. 对 betrayal 的直接结论

因此，`betrayal` 当前目录层级应当拆成两层理解：

1. **intake 暂存层**  
   `public/assets/betrayal/`

2. **正式运行时层**  
   `public/assets/i18n/zh-CN/betrayal/`

当前 `public/assets/betrayal/` 里的 59 个对象并不是“白做了”，而是：

- 已完成命名
- 已完成首轮压缩
- 已完成首轮上传与回查

但它们还没完成最后一步：**迁到项目正式资源树并重建 manifest**。

## 5. 对后续实施的影响

在 `betrayal` 开始 `manifest.ts / thumbnail.tsx / Board.tsx` 前，应先接受以下口径：

- `thumbnailPath` 应写逻辑路径，例如 `betrayal/thumbnails/cover`
- 物理资源应放在 `public/assets/i18n/zh-CN/betrayal/...`
- 顶层 `public/assets/betrayal/...` 不能继续被当成正式交付目录

否则后面的 manifest、缩略图、AssetLoader 和本地化图片访问链路都会和项目现有合同分叉。
