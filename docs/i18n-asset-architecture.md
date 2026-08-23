# 国际化资源架构

本文记录图片资源国际化目录和代码入口。资源准入、压缩、manifest、上传和移动包边界以 [`asset-pipeline`](../.spec/knowledge/standards/asset-pipeline.md) 为准。

## 当前目录

```text
public/assets/
├── i18n/
│   └── zh-CN/<gameId>/...
├── atlas-configs/<gameId>/...
└── common/
    ├── audio/
    └── images/
```

原始 `public/assets/<gameId>/` 已删除，不存在 fallback。运行时图片请求必须进入 `i18n/<locale>/` 目录。

## 路径合同

- 代码传入相对资源语义路径，例如 `<gameId>/cards/cards1`。
- 调用侧不要带 `/assets/`、`/i18n/`、`compressed/`、扩展名或手写查询参数。
- `getLocalizedAssetPath` 负责补语言目录和官方资源域名。
- `getOptimizedImageUrls` 负责指向 `compressed/*.webp`。
- CSS 背景图使用 `buildLocalizedImageSet`，当前只返回 WebP `url()`，不使用 `image-set()`。

示例：

```ts
const localized = getLocalizedAssetPath('<gameId>/cards/cards1', 'zh-CN');
const urls = getOptimizedImageUrls(localized);
```

## 图片组件

| 场景 | 入口 |
| --- | --- |
| `<img>` | `src/components/common/media/OptimizedImage.tsx` |
| 卡牌预览 / atlas card | `src/components/common/media/CardPreview.tsx` |
| 通用路径解析 | `src/core/AssetLoader.ts` |
| 直接 sprite atlas | `src/engine/primitives/spriteAtlas.ts` |

## 图集注册

项目同时存在两类图集入口：

| 入口 | image 参数 | 适用 |
| --- | --- | --- |
| `registerSpriteAtlas` | 完整本地化 URL | 直接渲染 sprite |
| `registerCardAtlasSource` / `registerLazyCardAtlasSource` | 原始相对路径 | `CardPreview` / `AtlasCard` |

不要把已本地化 URL 传给 `registerCardAtlasSource`，否则会双重本地化。不要把原始相对路径直接传给 `registerSpriteAtlas`，否则缺少 `i18n` 前缀。

`.atlas.json` 与语言无关，统一放 `public/assets/atlas-configs/<gameId>/`。

所有游戏应在模块顶层或明确初始化入口注册 atlas，避免首帧渲染时图集未登记。具体游戏采用哪种注册模式，以对应 `src/games/<gameId>/` 的资源初始化代码为准，不写进本通用文档。

## 新语言接入

1. 创建 `public/assets/i18n/<locale>/<gameId>/`。
2. 放入对应语言资源。
3. 运行 `npm run compress:images -- public/assets/i18n/<locale>/<gameId>`。
4. 生成 / 校验 manifest。
5. 通过服务器素材主源发布并回查公开 URL。
