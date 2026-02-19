# 国际化资源架构

## 概述

项目采用**语言目录方案**：所有游戏图片资源统一放在 `i18n/{locale}/` 目录下。
原始路径（`public/assets/<gameId>/`）已删除，CDN 上只有国际化目录的素材。

## 目录结构

```
public/assets/
├── i18n/
│   ├── zh-CN/                   # 中文资源（当前唯一语言）
│   │   ├── dicethrone/
│   │   ├── smashup/
│   │   ├── summonerwars/
│   │   └── tictactoe/
│   └── en/                      # 英文资源（未来）
│       ├── dicethrone/
│       ├── smashup/
│       ├── summonerwars/
│       └── tictactoe/
└── common/                      # 语言无关的通用资源（音频等）
    ├── audio/
    └── images/
```

**重要**：原始路径 `public/assets/<gameId>/` 已删除，不存在 fallback。所有图片请求必须带 `/i18n/{locale}/` 前缀。

## 代码使用

### 全链路路径转换

代码中传入相对路径（不带 `/assets/`、不带 `/i18n/`、不带 `compressed/`），系统自动完成：

```
输入: 'smashup/cards/cards1'
  ↓ getLocalizedAssetPath(src, 'zh-CN')
中间: 'https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/cards1'
  ↓ getOptimizedImageUrls(localizedPath)
输出: {
  avif: 'https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/cards1.webp',
  webp: 'https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/cards1.webp'
}
```

### OptimizedImage（`<img>` 标签场景）

自动从 `i18next` 获取 locale，使用 `<img>` 标签加载 webp 格式：

```tsx
// 自动使用当前语言
<OptimizedImage src="dicethrone/images/pyromancer/player-board" />

// 显式指定语言（未来英文版）
<OptimizedImage src="dicethrone/images/pyromancer/player-board" locale="en" />
```

### buildLocalizedImageSet（CSS background-image 场景）

用于精灵图等需要 CSS 背景的场景，只返回 WebP 格式的 `url()`：

```tsx
const bg = buildLocalizedImageSet('smashup/cards/cards1', locale);
// 返回: url("https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/cards1.webp")
```

**注意**：此函数只返回 WebP 格式，不使用 `image-set()` 语法。原因：
- 所有素材只在国际化目录下，不需要 fallback
- `image-set()` 会导致浏览器同时请求多种格式，浪费带宽
- 现代浏览器都支持 WebP，avif 收益不大且增加复杂度


## 精灵图（Sprite Atlas）本地化

项目中有两套并行的精灵图注册系统，都需要正确处理本地化：

### 系统 A：`registerSpriteAtlas`（用于直接渲染）

注册时必须传入**完整的本地化 URL**：

```typescript
// ✅ 正确：先本地化，再优化
const heroBase = 'summonerwars/hero/Frost/hero';
const localizedBase = getLocalizedAssetPath(heroBase, locale);
const urls = getOptimizedImageUrls(localizedBase);
registerSpriteAtlas('sw:frost:hero', {
  image: urls.webp,
  config: HERO_ATLAS,
});

// ❌ 错误：直接优化，缺少 i18n 前缀
const urls = getOptimizedImageUrls('summonerwars/hero/Frost/hero');
```

### 系统 B：`registerCardAtlasSource`（用于 CardPreview/AtlasCard）

注册时传入**原始相对路径**，渲染时由 `AtlasCard` 组件自动本地化：

```typescript
// ✅ 正确：传入原始路径，config 通过图片尺寸探测生成
const config = await loadCardAtlasConfig('smashup/base/base1', { rows: 4, cols: 4 });
registerCardAtlasSource('smashup:base1', {
  image: 'smashup/base/base1',  // 原始路径，AtlasCard 渲染时自动加 i18n 前缀
  config,
});

// ❌ 错误：传入已本地化的路径（会导致双重本地化）
registerCardAtlasSource('smashup:cards1', {
  image: getLocalizedAssetPath('smashup/cards/cards1', locale),
  config,
});
```

### 图集配置加载

图集配置文件（`.atlas.json`）与语言无关，统一存放在 `/assets/atlas-configs/` 目录。

```
public/assets/atlas-configs/
└── dicethrone/
    └── ability-cards-common.atlas.json   # DiceThrone 非规则网格，需要精确裁切坐标
```

**各游戏策略**：
- **DiceThrone**：`loadCardAtlasConfig()` 从 `/assets/atlas-configs/dicethrone/` 加载 JSON（非规则网格）
- **SmashUp**：`loadCardAtlasConfig(path, defaultGrid)` 通过 `getLocalizedAssetPath()` + 固定 locale 探测图片尺寸 + 行列数生成配置（规则网格，不需要 JSON，尺寸与语言无关但文件在 i18n/ 目录下）
- **SummonerWars**：`initSpriteAtlases(locale)` 使用硬编码的 `SpriteAtlasConfig` 常量（规则网格，不需要 JSON）

### 各游戏图集加载模式

| 游戏 | 加载方式 | 说明 |
|------|----------|------|
| SmashUp | `loadCardAtlasConfig(path, defaultGrid)` | 图片尺寸探测走 `getLocalizedAssetPath()` + 固定 locale（文件在 i18n/ 目录下），注册到系统 B |
| DiceThrone | `loadCardAtlasConfig()` | 共享 JSON 配置（语言无关），注册到系统 B |
| SummonerWars | `initSpriteAtlases(locale)` | 内部调用 `getLocalizedAssetPath`，注册到系统 A |

## CDN 部署

```bash
npm run assets:upload -- --sync
```

上传 `public/assets/i18n/` 下的所有文件到 CDN，删除 CDN 上多余的文件。

## 添加新语言

1. 创建语言目录：`mkdir -p public/assets/i18n/en`
2. 复制/翻译图片资源到对应目录
3. 运行压缩脚本：`npm run assets:compress`
4. 上传到 CDN：`npm run assets:upload -- --sync`
5. 代码无需修改（组件自动从 i18next 获取当前语言）

## 相关文件

| 文件 | 职责 |
|------|------|
| `src/core/AssetLoader.ts` | 资源路径转换、预加载、`buildLocalizedImageSet` |
| `src/components/common/media/OptimizedImage.tsx` | `<img>` 图片组件，自动 locale |
| `src/components/common/media/CardPreview.tsx` | 卡牌预览组件（系统 B），`AtlasCard` |
| `src/engine/primitives/spriteAtlas.ts` | 精灵图系统（系统 A） |
| `docs/ai-rules/asset-pipeline.md` | 资源管道完整规范 |
