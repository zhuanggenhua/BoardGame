---
name: asset-pipeline
description: 图片资源与发布总规范：资源目录、manifest、上传和运行时加载——改素材链路时查
metadata:
  type: doc
  status: 已交付
---

# 图片资源与发布总规范

本文件只规定运行时媒体资源的准入、路径、压缩、manifest、上传和移动包边界。首屏预加载见 [`critical-image-preload`](critical-image-preload.md)，音频细则见 [`audio-assets`](audio-assets.md)。

## 资源准入

- 规则、组件清单、用户素材或官方素材已经证明存在的卡牌、地图/区域、token、棋子、骰面、角色板、提示板、读本页等对象，必须走正式资源链。
- 正式资源链最低闭合：`真相源 -> 语义命名 -> 正式目录 -> 压缩产物 -> manifest / 索引 -> 运行时引用 -> 测试或截图消费证据`。
- 代码里出现 `tokenAsset`、`portraitAsset`、卡面路径、图集路径、骰面路径或等价资源引用时，验收必须证明该路径能解析到源图、压缩产物和 manifest / 索引 key。
- 图包 intake 必须先做“规则数量 vs 素材实测数量”对账：正面、背面、空格、非对象、复用 alias、缺口和争议分别登记。对不上且不能解释时，状态只能是 `blocked / disputed`。
- HTML/CSS 假图、文字牌、程序化 token、插件默认样式、emoji、临时 SVG、截图裁片和 mock 图片都不是正式素材。除非用户明确批准并写入合同，否则只能标为 `temporary-placeholder`。
- 缺素材时必须写清缺哪个现实对象、已查哪里、为什么不能闭合、最小补源动作；不能用“后续美术优化”或“先跑通 E2E”冒充完成。

## 目录与路径

- 正式运行时图片默认放在 `public/assets/i18n/<locale>/<gameId>/<resource-category>/compressed/<asset>.webp`。
- 语言无关图集配置放 `public/assets/atlas-configs/<gameId>/`；跟随语言、游戏或角色路径读取的运行时本地 JSON 放对应 `i18n/<locale>/<gameId>/...`。
- 原始 PNG/JPG 可留在同资源树用于再压缩，但不得进入正式发布集合、Android file-index、ZIP 或服务器运行时对象。
- `public/assets/**` 只放会被代码、manifest、Web、Android 或服务器正式消费的运行时资源。参考图、设计导出图、OCR 图、联系表、后处理核对图、单格裁片等中间产物放 `temp/**`、`docs/**` 或 evidence，不能进正式资源树。
- 运行时代码传相对路径，例如 `<gameId>/<resource-category>/<asset>`；不要带 `/assets/`、`compressed/`、扩展名拼接或手写 `?v=`。
- 图片路径解析统一走 `AssetLoader`、`OptimizedImage`、`CardPreview`、`getLocalizedImageUrls`、`getOptimizedImageUrls`、`buildLocalizedImageSet` 或同层公共工具；组件内不得自建第二套 URL probe、fallback、语言判断或 ready 状态机。

## 压缩与发布对象

- 正式对局素材只允许从源图转成运行时 WebP，默认不得降采样。卡牌、棋盘/地图、区域板块、角色板、提示板、骰面、token、棋子和读本页都属于正式对局素材。
- 正式素材压缩入口：`npm run compress:images -- <资源根>` 或 `npm run compress:runtime-images -- <资源根>`；展示图才允许用 `npm run compress:display-images -- <资源根>`。
- 正式发布的媒体对象只允许 `compressed/*.webp` 和 `compressed/*.ogg`。运行时 `.svg`、`.json`、OTA / 原生包 / 移动包所需 `.zip`、`.apk` 按消费入口单独判断。
- 若压缩产物尺寸与正式源图不一致，结论是“正式素材误降采样”，不得继续发布或截图验收。
- `assets-manifest.json` 是索引合同，不自动等于远端发布对象。只有它被客户端远端读取、作为服务器活动根或远端 package manifest 时，才必须作为远端 JSON 发布。

## 图集与裁片

- 有正式 atlas 时，运行时优先直接消费 atlas 和 frame / `previewRef` / 裁剪配置；图集加载失败应修图集路径、manifest、注册或裁剪合同，不默认拆成单张图止血。
- 录入阶段可以从正式 atlas 切 `temp/**` 单格图看字，但 `temp/**` 裁片不能反向定义正式 atlas 语义，也不能进入运行时资源树。
- 修改 rows / cols、frame、`previewRef`、split、topCrop 或同类接线前，必须对照正式原图、现有资源配置、同游戏旧实现和专项规范；仍有多种解释时先问用户。
- 卡牌、地图、区域、提示页、角色板等主素材不能从 contact sheet、缩略总览、低清拼图或截图总览裁成正式运行时资源。
- Sprite 背景只允许设置 `backgroundImage`、`backgroundSize`、`backgroundPosition` 等单项属性；不要用 `background` 简写覆盖裁剪参数。
- 精灵图 JSON 的 `meta.image` 若带扩展名，传给 `buildLocalizedImageSet` 前去掉扩展名，避免生成 `*.png.webp`。

## 运行时承载

- 资源必须属于同一语义家族：规则对象是 `card / token / figure / board / tile / dice / reference`，运行时就优先使用同族真实素材。
- 地图或区域上的位置、占位和状态默认由地图 / tile / 对象本体承载；边栏、日志、摘要区只能辅助说明，不能替代主承载。
- 错图比缺图更严重。无法证明 fallback 与目标对象共享同一真相源且语义等价时，宁可显示缺口态，也不得显示“最像”的正式素材。
- 素材存在后必须接入目标链路；不能继续保留 CSS 假图、文字卡、旧占位、低保真图或插件默认样式作为正式 UI。
- 关键图片在移动端或离线包里缺失时，先查是否绕过统一图片组件和候选链；不要先归因缓存、CDN 或旧素材包，除非请求链已闭合。

## Manifest

- 默认 `npm run assets:manifest` / `npm run assets:validate` 是增量模式：更新本地存在的资源，保留 manifest 中已有但本地缺失的远端资源条目。
- 只有确认本地拥有完整资源镜像时，才用 `npm run assets:manifest:full` / `npm run assets:validate:full`；full 模式会把 manifest 当成本地目录快照。
- 语言目录内的游戏级 manifest 必须用对应语言根生成，例如 `--root public/assets/i18n/zh-CN --id <gameId>`，确保 `basePrefix` 指向 `official/i18n/<locale>/<gameId>/`。
- 构建和开发注入的资源索引必须同时读取本地文件和 manifest；本地缺图但 manifest 已登记的远端资源应进入官方资源域名候选链。
- 新增、移动或重建 manifest 后，必须展开新增或变更的运行时对象引用，回查对应 `compressed/*.webp`、`compressed/*.ogg`、运行时 JSON/SVG 是否已远端可达。

## 服务器与移动包

- 公开资源域名保持 `https://assets.easyboardgame.top/official/...`；协作者默认走 `npm run assets:check` / `npm run assets:upload` 和直连发布 token，不静默改走 SSH。
- 上传完成不等于交付完成。收口至少抽查主资源和代表性子资源的公开 URL，确认本次大小、哈希或 `200`。
- 若用户问题发生在线上、手机、已安装包或官方资源包，本地文件、manifest 和截图只能算本地准备；最终修复必须闭合到服务器对象、App file-index / manifest 或真机下载证据。
- 上传失败必须明说未上传资源、失败原因和当前运行风险。`--asset-prefix` 指定后 0 个对象视为失败，不能解释成“已经传过”。
- 服务器发布成功后 `current` 原子切换；历史 release 默认只保留最近 5 个，且必须保留当前 `current`。空间不足先核对 release 占用并清历史快照，再重跑原发布流程。
- `npm run assets:download -- --game <gameId>` 只按游戏拉取运行时对象、语言目录、atlas 配置和共享运行时依赖；`--list`、无明确游戏目标和共享测试不得扩大为全站下载。
- `dev:lite` 只证明本地代码和内存游戏服可跑；运行时媒体默认可走公开资源域名，不要求本地完整素材镜像。

## OTA 与 Android

- OTA 只承载 Web 本体、样式、`locales/**`、字体、必要小公共文件和资源索引；嵌套运行时媒体默认不进 OTA。
- Android 游戏包和共享音频包只发布压缩运行时交付物：图片 `.webp`、音频 `.ogg`、必要运行时 JSON/SVG。源图、源音频、设计源、临时文件、备份和测试文件不得进 file-index 或 ZIP。
- App 素材包必须由同一份路径 / hash / size 索引派生；禁止手工改 ZIP、手工改 manifest，或只更新服务器单文件却不更新 App 可见索引。
- 小素材替换的正式方向是差异化更新：上传变更对象，服务器刷新关联游戏 file-index / latest manifest，客户端只下载缺失或 hash 变化文件。全量 ZIP 只能作为首装、清缓存、旧客户端兼容或大量重排的兜底。
- 共享音频包未完成自动闭合时，发现共享音频对象上传必须中断并转专项流程，不得只上传 OGG 后宣称 App 包已更新。

## 故障定位

- 先确认当前 worktree、资源根、manifest、代码引用和真实请求 URL，避免在错误工作区判断“文件不存在”。
- 404 排查看最终请求路径：语言前缀、`compressed/`、扩展名、manifest `basePrefix`、官方域名和移动包路径都要对上。
- 运行时通过统一图片工具加载的裁切图，实际文件必须位于对应 `compressed/` 子目录；只有 `crops/foo.webp` 没有 `crops/compressed/foo.webp` 视为资源不完整。
- 出现错图、空图、低清、四角异常或整图叠层时，先查实际请求文件、frame / atlas 坐标、上层 DOM、计算后样式和裁剪参数，再改资源或样式。
- 资源链结论必须拆开本地文件、包内索引、服务器对象、线上 / 手机可见性；任一项未闭合就标为未完成或有风险。

## 分流入口

- 关键首屏、warm 资源、教程模式和新增游戏图片预加载：见 [`critical-image-preload`](critical-image-preload.md)。
- 音频 key、共享音频包、移动端音频读取和音效触发：见 [`audio-assets`](audio-assets.md) 和项目 [`audio-integration`](../../skills/audio-integration/SKILL.md)。
