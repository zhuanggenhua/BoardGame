# 图片/音频资源完整规范

> 本文档是 `AGENTS.md` 的补充，包含图片/音频的完整路径规则、压缩流程与示例。
> **触发条件**：新增/修改图片或音频资源引用时阅读。

---

## 🖼️ 图片资源规范

### ⚠️ 强制规则：禁止直接使用未压缩图片

**所有图片必须经过压缩后使用，禁止在代码中直接引用原始 `.png/.jpg` 文件。**

### 资源目录结构（方案 B2：所有语言在 i18n/ 下）

```
public/assets/
├── i18n/
│   ├── zh-CN/                   # 中文资源（当前通过符号链接指向原始路径）
│   │   └── <gameId>/            # 游戏资源（符号链接 → ../../<gameId>）
│   │       └── <资源分类>/
│   │           ├── foo.png      # 原始图片（可选，仅用于重新压缩）
│   │           └── compressed/
│   │               └── foo.webp # 压缩后的图片（必需，运行时使用）
│   └── en/                      # 英文资源（未来）
│       └── <gameId>/
├── atlas-configs/               # 图集配置文件（与语言无关）
│   └── <gameId>/
│       └── xxx.atlas.json       # 图集配置（rows/cols 或精确坐标）
└── <gameId>/                    # 原始资源位置（过渡期保留，通过符号链接被 i18n/zh-CN/ 引用）
    └── <资源分类>/
        ├── foo.png
        └── compressed/
            └── foo.webp
```

**关键规则**：
- **图片文件**：必须在 `i18n/<locale>/<gameId>/<分类>/compressed/` 目录（需要国际化）
- **图集配置 JSON**：必须在 `atlas-configs/<gameId>/` 目录（与语言无关，不需要国际化）
- **原始图片**：可选，仅在需要重新压缩时使用。如果只有 WebP 文件，可以直接放在 `compressed/` 目录

**当前状态（过渡期）**：
- 物理文件仍在 `public/assets/<gameId>/`
- `public/assets/i18n/zh-CN/<gameId>` 为符号链接（Windows junction），指向 `../../<gameId>`
- 代码默认使用 `locale="zh-CN"`，自动访问 `i18n/zh-CN/` 路径
- 符号链接使浏览器能正确加载 `i18n/zh-CN/` 下的资源，无需物理迁移文件

**未来计划（英文版上线时）**：
- 物理迁移中文图片到 `i18n/zh-CN/`
- 删除原始路径 `public/assets/<gameId>/`
- 新增英文图片到 `i18n/en/`
- 删除符号链接

> **禁止**使用无语义的 `images/` 中间目录。直接按业务含义组织：`hero/`、`cards/`、`base/`、`common/` 等。

### 压缩流程

**如果有原始图片**：
1. **压缩命令**：`npm run compress:images -- public/assets/<gameId>`
2. **压缩脚本**：`scripts/assets/compress_images.js`（启动器）+ `scripts/assets/compress_images.py`（实现）
3. **输出位置**：同级 `compressed/` 子目录，生成 `.webp`

**如果只有 WebP 文件**：
- 直接将 `.webp` 文件放入 `i18n/<locale>/<gameId>/<分类>/compressed/` 目录
- 无需原始图片，代码会自动从 `compressed/` 目录加载
- 注意：压缩脚本运行时会清理 `compressed/` 目录，如果没有原始图片，不要运行压缩脚本

### 前端引用方式

| 场景 | 组件/函数 | 示例 |
|------|-----------|------|
| `<img>` 标签 | `OptimizedImage` | `<OptimizedImage src="dicethrone/images/foo.png" />` （自动使用 locale="zh-CN"） |
| CSS 背景 | `buildOptimizedImageSet` | `background: ${buildOptimizedImageSet('dicethrone/images/foo.png')}` |
| 精灵图裁切 | `getOptimizedImageUrls` | `const { webp } = getOptimizedImageUrls('dicethrone/images/foo.png')` |
| 精灵图 CSS 背景 | `buildLocalizedImageSet` | `backgroundImage: buildLocalizedImageSet('dicethrone/images/atlas', locale)` |

**locale 处理规则**：
- `OptimizedImage` 默认 `locale="zh-CN"`，自动转换路径为 `i18n/zh-CN/dicethrone/images/foo.png`
- 符号链接使浏览器能正确加载该路径（实际指向 `../../dicethrone/images/foo.png`）
- 未来英文版上线时，传入 `locale="en"` 即可切换到英文资源
- 生产构建会为 `public/assets` 中的资源 URL 自动追加 `?v=<content-hash>`，因此不要手动拼接版本参数；内容变更后缓存会自动失效

### 统一加载链路（强制）

- **禁止在组件内部自建第二套图片加载系统**：自定义图片组件、精灵图组件、3D 骰子组件、状态图标组件、CSS background 精灵图组件，禁止自己再写一套 `fetch`、`Image.onload`、URL probe、同源特判、语言特判或“先判 ready 再渲染”的加载状态机。
- **必须优先复用统一资源工具**：运行时图片路径解析、语言回退、压缩路径选择、缓存与版本参数，统一走 `AssetLoader`、`OptimizedImage`、`CardPreview`、`getLocalizedImageUrls`、`getOptimizedImageUrls`、`buildLocalizedImageSet`。
- **特殊渲染只能包裹统一链路，不能绕开统一链路**：例如 3D 骰子、Canvas 纹理、Sprite Atlas、CSS background-position 裁切，如果最终仍然要展示同一张运行时图片，那么只能在统一链路产出的 URL 或图片对象之上做渲染，不能自己重新决定资源候选、回退顺序或本地/远端判断。
- **同模块已有正确实现时，禁止重发明**：如果同一游戏中已有图片显示稳定的实现（如 `HandArea`/`CardPreview`），其他图片组件必须先对照并沿用该用法；不能因为当前组件表现异常，就在旁边新增一套“只对这个组件生效”的 workaround。
- **修回归先查接线是否偏离统一链路**：当图片出现“之前正常、后来空白/错图/偶发失败”时，优先检查是否绕过了 `AssetLoader`、是否引入组件内特判、是否手动拼接了与统一规则不一致的路径；禁止直接继续堆特例。
- **如确实需要补充共享能力，应下沉到公共层**：如果统一链路不能满足某类图片展示需求，应补到 `AssetLoader` 或通用媒体组件，而不是在单个游戏/单个组件里偷偷复制一份资源加载逻辑。

### 精灵图/图集裁剪安全规则（强制）

- **禁止使用 `background` 简写设置精灵图背景**：`background` 会重置 `background-size / background-position`，导致裁剪参数丢失而出现“图加载了但显示空白/错位”。  
  ✅ 正确：`backgroundImage` + `backgroundSize` + `backgroundPosition`  
  ❌ 错误：`background: linear-gradient(...);`（与裁剪参数共存）
- **图集裁剪必须“先看图，再采样”**：不得仅依赖脚本猜测行列；必须先人工核对图片内容，再确定 `rows/cols/faceMap` 或裁剪坐标。
- **所有图集定义必须写裁剪合同注释**：凡在 `ui/` 内定义 `*ATLAS` 且包含 `cols/rows`，必须添加 `// @atlas-contract ...`，写明图片名称、网格布局与采样依据。
- **修改裁剪配置必须配套测试或契约校验**：至少有一条断言覆盖 `background-size / position` 的关键值，避免回归。

#### ✅ 精灵图正确写法模板（强制参考）

```ts
const hasSprite = Boolean(spriteUrl);
const backgroundImage = hasSprite
  ? `url("${spriteUrl}")`
  : 'linear-gradient(145deg, rgba(0,0,0,0.7), rgba(0,0,0,0.9))';

style={{
  backgroundImage,
  backgroundSize: hasSprite ? '300% 300%' : undefined,
  backgroundPosition: hasSprite ? '0% 50%' : undefined,
  backgroundRepeat: hasSprite ? 'no-repeat' : undefined,
}}
```

> **禁止**在同一元素同时使用 `background:` 简写与 `backgroundSize/backgroundPosition`。

### 路径规则（强制）

- `src` 传相对路径（如 `dicethrone/images/foo.png`），**不带** `/assets/` 前缀
- 内部自动补全 `/assets/` 并转换为 `compressed/foo.webp`
- **禁止在路径中硬编码 `compressed/` 子目录**（如 `'dicethrone/images/compressed/foo.png'`）
- **禁止手动拼 `?v=` / 时间戳参数**，统一交给 `AssetLoader` 的内容 hash 机制处理
- **原因**：`getOptimizedImageUrls()` 会自动插入 `compressed/`，硬编码会导致路径重复（`compressed/compressed/`）

### 图集语义判定门禁（强制）

- 素材外观不等于运行时语义。看到空白格、黑边、角落装饰、额外立绘、复合排版时，禁止直接推断它“不是卡”“要裁掉”“要拆成两张”或“必须改单元格配置”。
- 修改 atlas 用法、`previewRef` 指向、rows/cols、frame 映射、split/topCrop 之类资源接线前，必须先对照同游戏旧实现、现有资源配置和专项规范。
- 如果旧实现和现有文档仍不能唯一说明这张图该怎么接，必须先问用户，不能靠肉眼猜图。
- 允许存在“一张正式图对应多个运行时对象”的复用模式；这种关系必须体现在配置或专项文档里，不能在代码里临时脑补。

### 精灵图路径处理规范（强制）

**核心原则**：精灵图 JSON 中的 `meta.image` 字段包含扩展名（如 `"status-icons-atlas.png"`），但传递给 `buildLocalizedImageSet` 的路径必须**去掉扩展名**。

**原因**：`buildLocalizedImageSet` 内部会自动：
1. 调用 `getLocalizedAssetPath` 添加 `i18n/{locale}/` 前缀
2. 调用 `buildOptimizedImageSet` 生成 `compressed/*.webp` 的 URL

**正确流程**：
```typescript
// 1. 加载 JSON（路径包含 .json 扩展名）
const jsonPath = 'dicethrone/images/paladin/status-icons-atlas.json';
const url = getLocalizedAssetPath(jsonPath);
const data = await fetch(url).then(r => r.json());

// 2. 提取图片路径（去掉 .png 扩展名）
const baseDir = jsonPath.substring(0, jsonPath.lastIndexOf('/') + 1);
const imagePath = `${baseDir}${data.meta.image.replace('.png', '')}`;
// 结果：'dicethrone/images/paladin/status-icons-atlas'

// 3. 在 CSS 中使用（buildLocalizedImageSet 自动处理）
backgroundImage: buildLocalizedImageSet(imagePath, locale)
// 生成：url('/assets/i18n/zh-CN/dicethrone/images/paladin/compressed/status-icons-atlas.webp')
```

**错误示例**：
```typescript
// ❌ 错误 1：保留了 .png 扩展名
const imagePath = `${baseDir}${data.meta.image}`;
// 结果：'dicethrone/images/paladin/status-icons-atlas.png'
// buildLocalizedImageSet 会生成错误路径：.../compressed/status-icons-atlas.png.webp

// ❌ 错误 2：没有去掉扩展名就传给 getOptimizedImageUrls
const { webp } = getOptimizedImageUrls(imagePath);
// 结果：.../compressed/status-icons-atlas.png.webp（错误）
```

### ✅ 正确示例

```typescript
// manifest 配置（路径不变，内部自动处理 locale）
thumbnailPath: 'dicethrone/thumbnails/fengm'

// ASSETS 常量（路径不变）
CARD_BG: 'dicethrone/images/Common/card-background'
AVATAR: 'dicethrone/images/Common/character-portraits'

// 组件使用（自动使用 locale="zh-CN"）
<OptimizedImage src="dicethrone/images/Common/background" />

// 显式指定 locale（未来英文版）
<OptimizedImage src="dicethrone/images/monk/player-board" locale="en" />
```

### ❌ 错误示例

```typescript
// ❌ 硬编码 compressed/
thumbnailPath: 'dicethrone/thumbnails/compressed/fengm'
CARD_BG: 'dicethrone/images/Common/compressed/card-background'
<OptimizedImage src="dicethrone/images/Common/compressed/background" />

// ❌ 直接使用原始图片
<img src="/assets/dicethrone/images/foo.png" />

// ❌ 手动拼接 webp
<img src="/assets/dicethrone/images/compressed/foo.webp" />
```

### 新增游戏资源检查清单

1. ✅ 原始图片放入 `public/assets/<gameId>/` 对应目录（如果有原始图片）
2. ✅ 运行 `npm run compress:images -- public/assets/<gameId>`（如果有原始图片）
3. ✅ 确认 `compressed/` 子目录生成 `.webp` 文件（或直接放入 WebP 文件）
4. ✅ **图集配置 JSON 放入 `public/assets/atlas-configs/<gameId>/`**（不要放在 `i18n/` 目录）
5. ✅ 代码中使用 `OptimizedImage` 或 `getOptimizedImageUrls`
6. ✅ **确认路径中不含 `compressed/` 子目录**
7. ❌ **禁止**直接写 `<img src="/assets/xxx.png" />`
8. ❌ **禁止**硬编码 `compressed/` 路径

## R2 / CDN 上传与排查规则（强制）

适用于任意游戏的图片、音频、atlas、裁图、图标、提示板切片等运行时资源。

### 上传收口

1. **录入或资源改动完成后，AI 必须主动上传**：只要本轮改动涉及运行时资源新增、替换、移动或裁图派生，就必须主动执行 manifest 重建、`assets:check` / `assets:upload` 或等价上传流程，不等待用户额外提醒。
2. **没有远端回查不算完成**：上传后至少抽查 1 个主资源 URL 和 1-3 个代表性裁图 / 子资源 URL，确认远端返回 `200`。
3. **本地存在不代表交付完成**：即使本地文件、manifest、代码引用都已齐全，只要默认资源基址仍指向 R2 / CDN，就必须把远端状态作为最终完成判据。
4. **上传失败必须显式告知用户**：如果因为 `.env` / `.env.example` 缺失、权限不足、脚本报错、网络失败或用户明确要求暂不上传而没有完成上传，最终汇报必须明确写出“未上传资源列表 + 原因 + 当前运行态风险”，禁止省略。
5. **该规则不分游戏**：`dicethrone`、`smashup`、`summonerwars` 以及后续新游戏都按同一口径执行。

### 故障排查

1. **先查对应任务 worktree，不查错工作区**：如果问题来自某个任务分支 / 独立 `git worktree`，必须先到该 worktree 下核对 `public/assets/`、`assets-manifest.json` 与相关代码引用，禁止只在当前根工作区下判断“文件是否存在”。
2. **先核对运行时真实请求路径**：图片运行时会自动补 `i18n/<locale>/` 与 `compressed/`，排查 404 时必须以最终请求 URL 为准，而不是只看源码里的相对路径。
3. **裁切图也必须满足 `compressed/` 约定**：凡是运行时通过 `OptimizedImage` / `CardPreview` / `getOptimizedImageUrls()` 加载的裁切图，实际可访问文件必须位于对应目录的 `compressed/` 子目录；仅有 `crops/foo.webp` 而没有 `crops/compressed/foo.webp`，视为资源不完整。
4. **上传前先重建清单**：资源目录有新增/移动后，先执行 `npm run assets:manifest` 或定向执行 `node scripts/assets/generate_asset_manifests.js --root public/assets/i18n/zh-CN --id <gameId>`，再上传到 R2。
5. **上传脚本环境变量位置**：`scripts/assets/upload-to-r2.js` 会优先读取仓库根目录 `.env`；如果不存在 `.env`，会自动回退读取 `.env.example`。排查“为什么本机能传/不能传”时，必须先确认当前 worktree 根目录这两个文件的实际情况。
6. **出现“多叠一层整图/四角异常”先查叠层来源（通用规则）**：优先用 DevTools 选中异常区域，检查上层元素是否存在整图覆盖；查看 **计算后** `opacity/visibility/filter/transform` 是否被脚本改写；必要时用 `elementsFromPoint()` 或逐层禁用 DOM 来定位真正的上层来源。该步骤必须在调整裁剪/圆角/纹理之前完成。

---

## 🚀 关键图片预加载规范（criticalImageResolver）

> **触发条件**：新增游戏、新增角色/派系、修改游戏 Board 中使用的图片资源时必读。

### 机制概述

项目采用**两阶段预加载**策略，防止进入对局时出现白屏/闪烁：

- **关键图片（critical）**：阻塞渲染，加载完成前显示 LoadingScreen，10 秒超时后放行
- **暖图片（warm）**：后台异步加载，不阻塞对局渲染

门禁落在 `MatchRoom` 入口层，各游戏通过 `criticalImageResolver.ts` 提供动态解析。

**locale 处理**：
- `CriticalImageGate` 从 `GameBoardProps` 提取 `locale` 参数（默认 `zh-CN`）
- 传递给 `preloadCriticalImages` 和 `preloadWarmImages`
- 预加载函数自动将路径转换为 `i18n/{locale}/` 格式
- 精灵图初始化函数（如 `initSpriteAtlases`）也需要接收 `locale` 参数并传递给 `getLocalizedAssetPath`

### 强制规则

1. **Board 中使用的所有图片必须出现在 criticalImageResolver 中**：要么在 `critical` 列表（首屏必需），要么在 `warm` 列表（后台预取）。
2. **首屏可见的图片必须放 critical**：背景图、玩家面板、提示板、地图等进入对局立即可见的资源。
3. **按需加载的图片放 warm**：未选角色/派系的资源、非首屏展示的图集。
4. **路径格式与图片引用一致**：相对于 `/assets/`，不含 `compressed/`（预加载 API 内部自动处理）。
5. **解析器必须按游戏阶段动态返回**：选角/选派系阶段 vs 游戏进行阶段，关键资源不同。
6. **phaseKey 必须稳定**：`CriticalImageGate` 依据 `phaseKey` 判断是否重新预加载，未变化时不会重复触发。
7. **教程模式 setup 阶段跳过全量选角资源（强制）**：教程会自动执行 aiActions（SELECT_CHARACTER/SELECT_FACTION + HOST_START_GAME），用户看不到选角界面。resolver 必须检查 `state.sys?.tutorial?.active === true`，在教程 setup 阶段只返回通用资源（背景/地图等），不预加载全部角色/阵营的选角资源。等 aiActions 执行完进入 playing 阶段后，再按实际选角结果预加载。
8. **教程模式 playing 阶段只加载已选阵营/角色/派系的资源（强制）**：教程阵营/角色/派系固定，未选的永远不会出现。resolver 在教程 playing 阶段必须只加载已选项对应的图集，`warm` 为空数组，避免浪费连接和带宽。各游戏实现方式：
   - **DiceThrone**：按角色独立打包，只加载已选角色图集
   - **SummonerWars**：按阵营独立打包，只加载已选阵营图集
   - **SmashUp**：多派系共享图集，通过 `FACTION_CARD_ATLAS` / `FACTION_BASE_ATLAS` 映射表只加载包含已选派系的图集（如教程恐龙+米斯卡塔尼克 vs 机器人+巫师 → 只需 cards1/cards2/cards4 + base1/base4，跳过 cards3/base2/base3）
9. **音频预加载等待关键图片彻底完成（强制）**：`AudioManager.preloadKeys` 在每批加载前调用 `waitForCriticalImages()`（`AssetLoader` 导出的全局信号），等关键图片预加载完成后再通过 `requestIdleCallback` + 小批量（每批 2 个）空闲调度发起音频 XHR。信号由 `preloadCriticalImages` 完成时 resolve，`CriticalImageGate` 快速路径（缓存命中）和 `enabled=false` 时也会 resolve。`resetCriticalImagesSignal` 不 resolve 旧 Promise（避免音频提前开始），`preloadKeys` 每批重新获取最新信号。15s 保底超时防止异常阻塞。
10. **warm 预加载取消恢复机制（框架层保证）**：`cancelWarmPreload()` 取消当前 warm 队列时，未完成的路径会被暂存到 `_pendingWarmPaths`。下一次 `preloadWarmImages()` 调用时自动合并暂存路径（已加载的由 `preloadOptimizedImage` 内部跳过）。保证 warm 资源"延迟但不丢失"——任何游戏的 phaseKey 变化触发二次预加载时，第一轮被取消的 warm 资源会在第二轮 critical 完成后自动恢复加载。
11. **精灵图初始化（统一模式）**：
   - **均匀网格**：使用 `registerLazyCardAtlasSource(id, { image, grid: { rows, cols } })`，尺寸从 `CriticalImageGate` 预加载缓存中的 `HTMLImageElement.naturalWidth/Height` 自动解析，零配置文件、零额外网络请求。SmashUp 和 SummonerWars 均使用此模式。
   - **不规则网格**：使用 `registerCardAtlasSource(id, { image, config })`，config 从静态 JSON 文件 import（构建时内联）。DiceThrone 使用此模式（`ability-cards-common.atlas.json`）。
   - **注册时机**：所有游戏在模块顶层同步注册（`initXxxAtlases()`），确保首帧渲染时 atlas 已可用。禁止在 `useEffect` 中异步注册。
   - **SummonerWars 的 `initSpriteAtlases(locale)`**：同时注册 `cardAtlasRegistry`（懒解析）和 `globalSpriteAtlasRegistry`（即时解析），后者需要 locale 构建完整 URL，必须在组件 `useEffect` 中调用并监听 `i18n.language`。
   - **图片资源需要国际化**：图片路径通过 `getLocalizedAssetPath` 或组件自动处理 `/i18n/{locale}/` 前缀。图集注册时 `image` 字段传相对路径，渲染层（`buildLocalizedImageSet`）按语言解析 URL。

### 解析器模板

```typescript
import type { CriticalImageResolver, CriticalImageResolverResult } from '../../core/types';
import type { MatchState } from '../../engine/types';

export const <gameId>CriticalImageResolver: CriticalImageResolver = (
    gameState: unknown,
): CriticalImageResolverResult => {
    const state = gameState as MatchState<YourCoreType>;
    const core = state?.core;
    // 1. 无状态时：预加载选择界面所需资源
    // 2. 选择阶段：
    //    - 教程模式（state.sys?.tutorial?.active）→ 只返回通用资源，跳过全量选角
    //    - 正常模式 → 所有可选项的预览图为 critical
    // 3. 游戏进行中：已选项的完整资源为 critical，未选项放 warm
    return {
        critical: [...],
        warm: [...],
        phaseKey: 'setup',
    };
};
```

### 注册方式

在游戏入口 `index.ts` 中注册：

```typescript
import { registerCriticalImageResolver } from '../../core';
import { <gameId>CriticalImageResolver } from './criticalImageResolver';

registerCriticalImageResolver('<gameId>', <gameId>CriticalImageResolver);
```

### 各游戏 critical 资源清单参考

| 游戏 | 选择阶段 critical | 游戏阶段 critical |
|------|-------------------|-------------------|
| DiceThrone | 背景图、卡背、头像图集、所有角色 player-board + tip | 背景图、卡背、头像图集、已选角色 player-board + tip + ability-cards + dice + status-icons-atlas |
| SummonerWars | 地图、卡背、所有阵营 hero 图集 | 地图、卡背、传送门、骰子、已选阵营 hero + cards 图集 |
| SmashUp | 所有卡牌图集（4个） | 已选派系卡牌图集 + 已选派系基地图集（教程）；全部卡牌+基地图集（正常） |

### 新增角色/派系检查清单

- [ ] 新资源路径已加入 `criticalImageResolver.ts` 的对应阶段
- [ ] 选择阶段：预览图（player-board/hero/tip）在 critical 中
- [ ] 游戏阶段：完整资源（卡牌图集/骰子/状态图标）在 critical 中
- [ ] 教程模式 setup 阶段：检查 `sys.tutorial.active`，只返回通用资源
- [ ] 精灵图初始化函数已支持 `locale` 参数（从 Board props 提取并传递）
- [ ] 系统 A 注册时调用 `getLocalizedAssetPath` → `getOptimizedImageUrls`
- [ ] 系统 B 注册时传递原始路径（不调用 `getLocalizedAssetPath`）
- [ ] 运行相关单测：`npm test -- criticalImageResolver`

### 参考实现

- `src/games/dicethrone/criticalImageResolver.ts` — 按角色 + 游戏阶段动态解析
- `src/games/summonerwars/criticalImageResolver.ts` — 按阵营 + 游戏阶段动态解析
- `src/games/smashup/criticalImageResolver.ts` — 按派系图集分组

---

## 🔊 音频资源规范

> 新增音频全链路流程详见：`docs/audio/add-audio.md`

### 音频资源架构（强制）

**三层架构**：
1. **通用注册表**（`src/assets/audio/registry.json`，构建时从 `public/assets/common/audio/` 生成）：所有音效资源的唯一来源，包含 key 和物理路径映射。代码中通过静态 import 加载，Vite 会自动打包。
2. **游戏配置**（`src/games/<gameId>/audio.config.ts`）：定义事件→音效的映射规则（`feedbackResolver`），使用通用注册表中的 key。
3. **FX 系统**（`src/games/<gameId>/ui/fxSetup.ts`）：直接使用通用注册表中的 key 定义 `FeedbackPack`，不依赖游戏配置常量。

**核心原则**：
- **禁止重复定义**：音效 key 只在通用注册表中定义一次，游戏层和 FX 层直接引用 key 字符串，不再定义常量。
- **禁止**在游戏层定义音频资源（`audio.config.ts` 不得声明 `basePath/sounds`）。
- **禁止**使用旧短 key（如 `click` / `dice_roll` / `card_draw`）。
- **必须**使用 registry 的完整 key（如 `ui.general....uiclick_dialog_choice_01_krst_none`）。
- **路径规则**：`getOptimizedAudioUrl()` 自动插入 `compressed/`，配置中**不得**手写 `compressed/`。

### ✅ 音效触发规范（当前 + 长期规划）

#### 当前架构（过渡期）

**音效两条路径 + UI 交互音**：
1. **路径① 即时播放（feedbackResolver）**：无动画的事件音（投骰子/出牌/阶段切换/魔法值变化）走 EventStream，`feedbackResolver` 返回 `SoundKey`（纯字符串）即时播放。有动画的事件（伤害/状态/Token）`feedbackResolver` 返回 `null`，由动画层在 `onImpact` 回调中直接 `playSound(key)` 播放。
2. **路径② 动画驱动（params.soundKey / onImpact）**：有 FX 特效的事件音（召唤光柱/攻击气浪/充能旋涡）通过 `FeedbackPack` 在 `fxSetup.ts` 注册时声明，`useFxBus` 在 push 时从 `event.params.soundKey` 读取 key。飞行动画（伤害数字/状态增减/Token 获得消耗）在 `onImpact` 回调中直接 `playSound(resolvedKey)` 播放。
3. **UI 交互音**：UI 点击音走 `GameButton`，拒绝音走 `playDeniedSound()`，key 来自通用注册表。

**选择原则**：有 FX 特效 → 路径②（FeedbackPack）；有飞行动画无特效 → 路径②（onImpact 回调）；无动画 → 路径①；UI 交互 → UI 交互音。

**避免重复**：同一事件只能选择一条路径，有动画的事件 `feedbackResolver` 必须返回 `null`。

**已废弃**：`DeferredSoundMap` 已删除，`AudioTiming`/`EventSoundResult` 已移除，`feedbackResolver` 不再返回 `{ key, timing }` 对象。

**过渡方案（未迁移到 FX 引擎的游戏）**：
- 创建 `domain/animationSoundConfig.ts` 集中管理所有 `onImpact` 音效配置
- 提供音效解析函数（如 `resolveDamageImpactKey`）
- 在 `useAnimationEffects.ts` 中从配置读取音效 key，而不是硬编码
- 详见 `docs/refactor/audio-architecture-improvement.md`

#### 长期目标架构（FeedbackPack 单一配置源）

> **详见**：`docs/refactor/audio-architecture-improvement.md`

**核心变化**：
- `feedbackResolver` 只处理"无动画的即时音效"（如投骰子、阶段切换）
- 所有有动画的事件音效统一在 `fxSetup.ts` 的 `FeedbackPack` 中声明
- 删除动画层的硬编码 `playSound()` 调用，由 FxLayer 自动触发

**迁移状态**：
- ✅ SummonerWars：已完成迁移，参考实现
- ✅ DiceThrone：已完成迁移到 FX 引擎
- ⏸️ SmashUp：无事件音效系统，暂不处理

**新游戏规范**：新增游戏必须直接采用长期架构，禁止使用过渡期的"两条路径"模式。

### ✅ 当前正确示例（音频）

```typescript
// ===== 路径① 示例：feedbackResolver 返回 SoundKey =====
feedbackResolver: (event): SoundKey | null => {
  if (event.type === 'CELL_OCCUPIED') {
    return 'system.general.casual_mobile_sound_fx_pack_vol.interactions.puzzles.heavy_object_move';
  }
  // 有动画的事件返回 null，音效由动画层 onImpact 播放
  if (event.type === 'DAMAGE_DEALT') return null;
  return null;
}

// ===== 路径② 示例：FX 系统 FeedbackPack（source: 'params'）=====
// src/games/summonerwars/ui/fxSetup.ts
const COMBAT_DAMAGE_FEEDBACK: FeedbackPack = {
  sound: {
    source: 'params',   // 从 event.params.soundKey 读取
  },
  shake: { intensity: 'normal', type: 'impact', timing: 'on-impact' },
};

// ===== 路径② 示例：飞行动画 onImpact 直接播放 =====
const impactKey = resolveDamageImpactKey(damage, targetId, currentPlayerId);
pushFlyingEffect({
  type: 'damage',
  content: `-${damage}`,
  onImpact: () => { playSound(impactKey); },
});
```

### 音频工具链

- **压缩脚本**：`npm run compress:audio -- public/assets/common/audio`
- **生成 registry**：`node scripts/audio/generate_common_audio_registry.js`
- **生成语义目录**：`npm run audio:catalog`（产出 `docs/audio/audio-catalog.md`，AI 查找音效首选）
- **资源清单**：`node scripts/audio/generate_audio_assets_md.js`
- **详见文档**：`docs/audio/audio-usage.md`

**相关提案**：`openspec/changes/refactor-audio-common-layer/specs/audio-path-auto-compression.md`
