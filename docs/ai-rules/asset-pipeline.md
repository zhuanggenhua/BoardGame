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
├── atlas-configs/               # 语言无关的图集配置文件
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
- **语言无关的图集配置 JSON**：放在 `atlas-configs/<gameId>/` 目录，例如通用 `xxx.atlas.json`
- **运行时本地 JSON 配置**：如果代码明确通过本地资源链读取，并且文件本身跟随语言/游戏/角色路径组织，则保留在 `i18n/<locale>/<gameId>/...`。这类文件默认不走 R2 正式媒体上传链，属于本地包内配置资源
- **原始图片**：可选，仅在需要重新压缩时使用。如果只有 WebP 文件，可以直接放在 `compressed/` 目录

**DiceThrone 当前例外（必须认现状）**：
- `status-icons-atlas.json` 属于 DiceThrone 运行时本地 JSON 配置，不属于 `atlas-configs/<gameId>/` 那类语言无关图集配置
- 它的当前落点是 `public/assets/i18n/<locale>/dicethrone/images/<hero>/status-icons-atlas.json`
- 运行时代码通过本地资源路径读取它，再从其中解析出 `status-icons-atlas.webp` 的图集图片路径
- 因此，排查 DiceThrone 状态图标问题时，不能把 `status-icons-atlas.json` 是否存在于 R2 当成默认真相源；先看本地包、`/assets/i18n/...` 和 dist 保留规则

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

**关键图片加载合同（强制）**：
- **玩家面板、提示板、地图、角色立绘、卡牌大图等缺失后会破坏主体验的图片，必须使用具备候选链/回退链的加载方式**，优先使用 `OptimizedImage`、`CardPreview` 或等价公共组件。
- **禁止把关键图片降级成裸 CSS background 单路径**。`buildLocalizedImageSet` / `buildOptimizedImageSet` 只负责生成 URL 字符串，不能像 `OptimizedImage` 一样在运行时从本地包、public 资源、manifest/R2 之间逐级回退；浏览器的多 background URL 也不是可靠的失败回退机制。
- **CSS background 只适合两类场景**：一是精灵图/图集裁剪、Canvas/特殊渲染等必须依赖 `background-position` 的场景；二是丢失后不影响主流程的纯装饰背景。前者必须明确仍然复用统一 URL 解析工具，并补测试或截图证明裁剪合同正确。
- **Android 已安装包资源（`/_capacitor_file_/.../game-packages/.../current/assets/...`）默认不要把可识别图标继续做成 CSS background**：像状态图标、token 图标、可识别 atlas 裁片这类一旦丢失就会退化成“纯色壳/空心圆”的内容，在移动端应优先用真实 `<img>` / `OptimizedImage` / 等价候选链组件承接，再通过 `overflow:hidden + absolute positioning` 做裁片；只有纯装饰背景或已经有专项回归证据证明稳定时，才允许继续用 CSS background 方案。
- **发现移动端或离线包中“PC 正常、手机缺图”时，先查该图片是否绕过了统一图片组件**；不得先把问题归因到缓存、旧素材包或 CDN，除非已经证明运行时请求链本身符合回退合同。
- **禁止为游戏正式素材新增假图兜底**：卡牌、基地、泰坦、角色立绘、地图、token 主视觉等正式游戏素材，如果真实素材未命中、R2 返回慢、或本地包里暂时没有，禁止新增内联 SVG、程序生成占位图、临时拼字卡面、截图裁片冒充正式资源。运行时只能显示真实素材或保持真实未加载状态。
- **错误推断不得作为素材兜底（强制）**：素材候选链只能在同一权威对象、同一资源合同、同一语言/压缩/远端链路内兜底；一旦需要靠另一套索引、另一名玩家/英雄、旧共享顺序、数组位置、相似 `cardId`、默认图集或“最像的素材”来推导图片，就必须视为真实素材缺口或接线错误。运行时宁可显示明确缺口态、toast/modal 错误、红字诊断或不上特写，也不得继续显示一张可能错误的正式素材。
- **缺图比错图优先（强制）**：对卡牌、棋盘对象、角色板、token 主视觉等会影响玩家判断的素材，禁止为了“不要空白 / 不要报错 / 体验更顺”而回退到不确定图片。只有能证明 fallback 与原对象共享同一真相源且语义等价时，才允许自动回退；否则必须暴露缺口，方便玩家和排查链路立即发现。
- **数据上线即要求真实正面素材闭环（强制）**：只要某批正式卡牌、基地、角色、房间、地图板块或 token 已进入运行时数据、可被发到真实对局、可出现在玩家持有区/公共区/结算区，就必须同步接入对应真实正面素材、图集坐标或明确的“真实素材缺口”状态。禁止把“规则/数据已接入，但图片以后再补”包装成完整交付；也禁止用文字卡、基础牌占位、牌背弱底纹或旧素材兜底冒充该批内容已完成。
- **扩展内容不得继承基础素材完成状态（强制）**：基础包卡图已完成，只能证明基础包完成；扩展包、替换牌、Promo、变体牌一旦进入运行时数据，必须单独拥有素材清单、源图、运行时路径、压缩产物、图集 frame 映射和测试门禁。没有这些证据时，结论必须写成“扩展数据已接入，但扩展卡图未闭环”，不得写成“该游戏卡图已完成”。
- **真实正面素材缺失时必须诚实展示缺口（强制）**：如果某张正式卡牌当前只有真实牌背、还没有对应正面图或正面 atlas frame，运行时允许显示真实牌背 + 对象名/短状态；**禁止**拿无关 `marker`、属性 token、数字 token、状态图标或其它素材碎片拼成“假正面卡”继续冒充正式卡图。
- **持有区 / 手牌区不能让牌背承担主识别（强制）**：玩家当前持有的卡牌、装备、预兆、手牌等，必须优先显示正式正面或正面 atlas 裁片。若正面确实缺失，牌背只能作为弱底纹，主识别必须是足够大的对象名、类别和短缺口状态；禁止把多张同类牌背直接排在持有区里，再用角落小字让玩家辨认。
- **E2E / 截图验收同样禁止假素材**：如果截图时 R2 资源因为冷启动或远端拉取较慢而尚未出现，这是可记录的真实状态；可以等待更久，也可以保留真实空态截图，但不能为了“让截图好看”在游戏里加假的 fallback 素材。

**locale 处理规则**：
- `OptimizedImage` 默认 `locale="zh-CN"`，自动转换路径为 `i18n/zh-CN/dicethrone/images/foo.png`
- 符号链接使浏览器能正确加载该路径（实际指向 `../../dicethrone/images/foo.png`）
- 未来英文版上线时，传入 `locale="en"` 即可切换到英文资源
- 生产构建会为 `public/assets` 中的资源 URL 自动追加 `?v=<content-hash>`，因此不要手动拼接版本参数；内容变更后缓存会自动失效

### 统一加载链路（强制）

- **禁止在组件内部自建第二套图片加载系统**：自定义图片组件、精灵图组件、3D 骰子组件、状态图标组件、CSS background 精灵图组件，禁止自己再写一套 `fetch`、`Image.onload`、URL probe、同源特判、语言特判或“先判 ready 再渲染”的加载状态机。
- **必须优先复用统一资源工具**：运行时图片路径解析、语言回退、压缩路径选择、缓存与版本参数，统一走 `AssetLoader`、`OptimizedImage`、`CardPreview`、`getLocalizedImageUrls`、`getOptimizedImageUrls`、`buildLocalizedImageSet`。
- **特殊渲染只能包裹统一链路，不能绕开统一链路**：例如 3D 骰子、Canvas 纹理、Sprite Atlas、CSS background-position 裁切，如果最终仍然要展示同一张运行时图片，那么只能在统一链路产出的 URL 或图片对象之上做渲染，不能自己重新决定资源候选、回退顺序或本地/远端判断。
- **Sprite / atlas 裁片允许用“真实 `<img>` + 裁剪容器”替代 `background-position`**：如果目标运行态包含 Android 已安装包、本地 `_capacitor_file_`、WebView 兼容问题或手机端已出现“图存在但背景图不显示/只剩底色”，优先考虑保留统一候选链，再把裁片实现切成 `<img>` 绝对定位，而不是继续在 `background-image` 上堆特判。
- **同模块已有正确实现时，禁止重发明**：如果同一游戏中已有图片显示稳定的实现（如 `HandArea`/`CardPreview`），其他图片组件必须先对照并沿用该用法；不能因为当前组件表现异常，就在旁边新增一套“只对这个组件生效”的 workaround。
- **固定资源合同先找同类正式基线（强制）**：像牌背、对手手牌牌背、公共牌预览、弃牌堆背面、通用角色肖像、卡图预览这类在同仓通常已有固定接线写法的资源，动手前必须先搜同类正式实现与专项文档；若仓内已有稳定基线，就直接沿用该基线，不得在单个游戏里再发明一套“只服务这张图/这个组件”的加载链、候选链或 ready 判定。
- **文档或现成基线已覆盖时，禁止擅自加料（强制）**：如果 `asset-pipeline`、专项设计文档、同游戏旧实现或同类游戏正式实现，已经明确这类资源该走哪一个公共组件/工具，就必须按该合同接线；不得因为“我担心这里会丢图”“这张牌背比较特殊”“顺手做得更稳一点”就额外塞入自定义 atlas-ready、手写 fallback probe、组件内 URL 切换或额外资源回退层。要补共享能力，只能先证明统一链路本身缺能力，再下沉到公共层。
- **修回归先查接线是否偏离统一链路**：当图片出现“之前正常、后来空白/错图/偶发失败”时，优先检查是否绕过了 `AssetLoader`、是否引入组件内特判、是否手动拼接了与统一规则不一致的路径；禁止直接继续堆特例。
- **回归修复不得引入跨真相 fallback**：如果当前组件丢失了对象自带的 `previewRef`、frame、atlasId、owner/hero provenance 或其它权威图片引用，修复方向是把权威引用补回事件/状态/对象本身；禁止在 UI 消费层用当前视角、当前数组下标、默认角色、旧顺序或全局 map 重新猜一张图。猜不到就显式失败，不能错图静默通过。
- **如确实需要补充共享能力，应下沉到公共层**：如果统一链路不能满足某类图片展示需求，应补到 `AssetLoader` 或通用媒体组件，而不是在单个游戏/单个组件里偷偷复制一份资源加载逻辑。

### 精灵图/图集裁剪安全规则（强制）

- **有正式图集就必须优先使用图集裁切显示**：只要游戏素材已经提供正式卡牌图集、状态图集、token 图集或等价 sprite atlas，运行时必须直接加载图集并通过 `registerLazyCardAtlasSource` / `registerCardAtlasSource` / `background-position` / 裁剪容器等方式显示对应裁片。禁止为了“使用方便”“预加载检测”“组件更简单”再把图集切成单张卡图、单张 token 图或单张状态图作为正式运行时素材。
- **图集优先约束运行时接线，不限制录入切图（强制）**：录入时可以查看从正式 atlas/正式原图切出的 `temp/**` 裁图；但只要问题进入运行时接线、atlas 语义、slot 归属、`previewRef.index`、frame 映射或审计定性，最终仍必须回到正式 atlas/正式原图。`temp/**` 裁片只能辅助看清，不能反向定义正式 atlas 语义。
- **禁止把图集拆图当成默认修复手段**：图集加载失败、裁剪错位、首屏 loading、R2 路径错误或缓存问题，应优先修图集路径、manifest、criticalImageResolver、atlas 注册或裁剪合同；不得绕过图集链路改成 `cards/faces/<id>.png`、`crops/<id>.webp` 这类单张派生路径来“止血”。只有用户明确要求导出单张素材、规则书本身只提供单图、或某平台已证明无法稳定渲染图集且已写明专项兼容方案时，才允许使用单张派生图；这种情况必须在文档或代码注释中说明例外原因。
- **运行时主素材禁止从索引图 / 联系表 / 缩略总览裁切（强制）**：卡牌、房间牌、地图板块、角色板、玩家提示板、剧本页等需要在主界面阅读的正式素材，必须来自原始图集、原始单图、或可证明同等清晰度的源文件。`contact-*`、`all-by-size-*`、截图总览、缩略索引页、低清拼图只能用于识别位置和建立索引，禁止裁成 `public/assets/**` 下的正式运行时资源。
- **从图集导出单图必须保留源图合同（强制）**：如果为了运行时性能或统一加载链路需要把 atlas 单格导出成独立图片，导出源必须是原始 atlas；资源映射必须记录原始 atlas 文件、裁剪坐标、导出尺寸和验收截图。禁止只记录“某个 contact 图裁出来了”。
- **临时占位必须显式降级（强制）**：如果当前只能用低清索引图裁片临时跑通流程，资源映射和验收文档必须写成 `temporary-runtime-placeholder` / “临时占位”，不得写成正式 `runtime`，也不得把截图结论表述为“已接入真实房间素材并可验收”。
- **发现主素材发糊先查源图链路（强制）**：当运行时卡牌、房间、地图、角色板比素材原图明显糊时，第一步必须核对实际请求文件、`runtime-resource-map` 或同类资源映射、源图尺寸和是否来自索引图；不得先通过 CSS 放大、锐化、阴影或 UI 重排掩盖低清来源。
- **禁止使用 `background` 简写设置精灵图背景**：`background` 会重置 `background-size / background-position`，导致裁剪参数丢失而出现“图加载了但显示空白/错位”。  
  ✅ 正确：`backgroundImage` + `backgroundSize` + `backgroundPosition`  
  ❌ 错误：`background: linear-gradient(...);`（与裁剪参数共存）
- **图集裁剪必须“先看图，再采样”**：不得仅依赖脚本猜测行列；必须先人工核对图片内容，再确定 `rows/cols/faceMap` 或裁剪坐标。
- **大图禁止直接喂给视觉读取工具（强制）**：单边超过 `2500px`、总像素超过 `8MP`、或文件超过 `8MB` 的 atlas / 扫描图 / 拼图，必须先用脚本读取尺寸和生成降采样总览、分块切片、单格裁图；禁止直接 `view_image` / 截整图后人工读。总览图最长边建议不超过 `1600px`，分块图最长边建议不超过 `1400px`；文字或索引看不清时继续裁单格，不得放大整张大图反复读取。
- **大图核对必须留三类产物**：尺寸记录、低清总览、关键分块或单格裁图。只有低清总览用于判断布局/行列，具体卡名、数字、效果文本必须从对应分块或单格裁图核对。
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

### `public/assets` 作用域门禁（强制）

- `public/assets/**` 只允许放**正式运行时资源**：代码真实引用、允许进入 `dist/`、允许上传到 R2/CDN、允许被 Web/Android 正式包请求的文件。
- **参考图、生成对照图、设计稿导出图、预览脚本专用图、人工核对中间产物**，禁止放在 `public/assets/**`。这些文件必须放到 `docs/`、`temp/`、专项 evidence 或其他非运行时目录。
- **录入切图一律不进正式资源树，也不进 R2（强制）**：凡是为了业务录入生成的单格裁片、整卡裁片、放大图、局部图、OCR 图、人工比对图，即使只是从正式 atlas 做最普通的几何裁切、没有任何额外后处理，也只能留在 `temp/**`。这类文件不能落在 `public/assets/**`，不能进入 manifest，不能上传到 R2/CDN，更不能因为目录名看起来像 `crops/`、`slots/`、`faces/` 就被误当正式资源。
- 原因不是“目录好不好看”，而是打包行为：`public/**` 会被构建原样复制到 `dist/`；进入 `dist/` 后，Web 发布、Android embedded、OTA/静态上传链路都会把它当成正式资源继续带走。
- 当同一目录里同时出现“运行时资源”和“参考图/生成图”时，必须先拆目录再继续发布；禁止依赖“反正代码没引用到它”侥幸过关。

### 图集语义判定门禁（强制）

- 素材外观不等于运行时语义。看到空白格、黑边、角落装饰、额外立绘、复合排版时，禁止直接推断它“不是卡”“要裁掉”“要拆成两张”或“必须改单元格配置”。
- 修改 atlas 用法、`previewRef` 指向、rows/cols、frame 映射、split/topCrop 之类资源接线前，必须先对照同游戏旧实现、现有资源配置和专项规范。
- 如果旧实现和现有文档仍不能唯一说明这张图该怎么接，必须先问用户，不能靠肉眼猜图。
- **禁止拿 `temp/` 裁片反向升格正式语义（强制）**：如果某张 `temp/**` 裁片看起来像“双卡合一”“读字不同”“留白更多”“边框缺失”，只能说明当前核对图链路可能有问题，不能直接把它升级成“正式 atlas 就该这么改”的证据。先回到正式原图/图集，再决定是录入错、切图错还是运行时消费错；不要直接把录入核对图接上运行时。
- 如果当前规则、设计稿或运行时语义已经明确需要某类素材，但仓内盘点后仍缺对应正面图、token 图、atlas frame 或同语义对象图，必须主动问用户素材位置、额外目录或未 intake 批次；不得等用户催，也不得先拿别的面板、marker、牌背或无关小图顶上。
- token / 棋子默认保持素材原形态与原宽高比：正式 token、人物棋子、怪物圆片、立式纸板等若已有清晰原图，运行时应优先按素材原轮廓和原宽高比显示。不得为了“更像 UI 组件”额外加黑色底座、通用徽章壳、顶部名字条、重复名字标签或强制改成另一种几何裁切，除非原素材本身就带这些结构。
- 允许存在“一张正式图对应多个运行时对象”的复用模式；这种关系必须体现在配置或专项文档里，不能在代码里临时脑补。
- **图集内容与目标对象家族不一致时必须立刻断开接线（强制）**：如果核图后发现某张 atlas 实际是房间/地图/板块/参考页，却被接到了卡牌正面、角色牌、token 主视觉等其它对象家族上，必须直接撤掉该接线，并回退到真实缺口态；禁止继续靠改 `rows/cols`、重排 frame、局部裁切，把错误素材硬切成“像是对的”。

### 运行时承载语义门禁（强制）

- **地图 / 棋盘 / 房间 tile 上的对象，先对规则和官方素材再决定承载物**：玩家、怪物、房间对象、基地对象、附着物、token 的运行时承载，不得只因为“某张 marker 看起来也像圆形图标”就直接拿来顶替。
- **承载物必须属于同一语义家族**：规则写的是 `figure`、`token`、`card`、`board`、`tile`，实现就必须优先使用对应家族的真实素材；若当前没有完全匹配的独立资产，只能用同对象的真实肖像或同对象裁片做最小代用，**不能**跨语义借用别的 marker / trait token / 数字 token。
- **棋盘对象默认以棋盘为主承载**：玩家位置、怪物位置、房间状态等如果在规则上属于地图 / tile 事实，运行时默认应先落在地图 / tile 本体上；边栏、底栏、摘要区只能做辅助浏览、焦点定位或补充信息，不能替代主承载。
- **面板不能代替地图指示物（强制）**：如果规则对象实际在地图 / tile 上移动或占位，左侧玩家面板、右侧摘要、日志或底部状态只能说明它是谁，不能充当它在地图上的玩家指示物 / 怪物 token。地图上至少要有同对象真实素材或同对象真实裁片承载；找不到独立 token 素材时必须明确降级为“同对象素材代用”，不得改成面板存在即算完成。
- **用户补充素材后必须重跑同族 intake（强制）**：当用户提供了具体素材目录、文件名哈希、截图名或指出“这里有 token/头像/棋子素材”时，必须回到该素材同尺寸组或同语义族重新生成联系表/分块图并打开核对；禁止继续引用旧的资源缺口结论，也禁止用玩家面板、怪物卡、文字缩写或临时 marker 代替已可定位的正式 token。
- **参考同类游戏时优先借“接线原则”不是借“长相”**：看别的游戏现成实现时，优先复用“真实素材怎么进运行时”“主对象落在哪个载体”“缺资源时如何诚实降级”；禁止机械照搬另一个游戏的图标、token 或卡面伪装法。

### 精灵图路径处理规范（强制）

**核心原则**：精灵图 JSON 中的 `meta.image` 字段包含扩展名（如 `"status-icons-atlas.png"`），但传递给 `buildLocalizedImageSet` 的路径必须**去掉扩展名**。

**原因**：`buildLocalizedImageSet` 内部会自动：
1. 调用语言化图片路径解析，添加 `i18n/{locale}/` 前缀
2. 调用 `buildOptimizedImageSet` 生成 `compressed/*.webp` 的 URL

**正确流程**：
```typescript
// 1. 加载本地 JSON（路径包含 .json 扩展名）
const jsonPath = 'dicethrone/images/paladin/status-icons-atlas.json';
const url = getLocalizedLocalAssetPath(jsonPath, locale);
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

1. ✅ 先从规则书、配件表、用户指定素材清单或当前 MVP 需求建立正式资源准入白名单，给每个源文件标记 `runtime/reference/candidate/excluded`
2. ✅ 只有 `runtime` 或明确 `reference` 的图片允许进入 `public/assets/<gameId>/` 或 `public/assets/i18n/<locale>/<gameId>/`
3. ✅ TTS/Workshop 材质色块、编辑器占位图、下载站装饰图、无规则对象对应的贴图、重复导出必须标为 `excluded` 或留在 `temp/<gameId>-intake/`，不得压缩、上传或引用
4. ✅ 正式文件名必须使用稳定语义名（小写 kebab-case），能回溯到图面语义和规则配件表；看不清或无法对应规则表时先留在 `candidate`
5. ✅ 原始图片放入 `public/assets/<gameId>/` 对应目录（如果有原始图片）
6. ✅ 运行 `npm run compress:images -- public/assets/<gameId>`（如果有原始图片）
7. ✅ 确认 `compressed/` 子目录生成 `.webp` 文件（或直接放入 WebP 文件）
8. ✅ 先判断 JSON 是**语言无关图集配置**还是**运行时本地 JSON 配置**：前者放 `public/assets/atlas-configs/<gameId>/`，后者按实际读取链保留在 `public/assets/i18n/<locale>/<gameId>/...`
9. ✅ 代码中使用 `OptimizedImage` 或 `getOptimizedImageUrls`
10. ✅ **确认路径中不含 `compressed/` 子目录**
11. ❌ **禁止**直接写 `<img src="/assets/xxx.png" />`
12. ❌ **禁止**硬编码 `compressed/` 路径
13. ❌ **禁止**把 `candidate/excluded` 文件混入正式资源树后继续执行 `assets:manifest`、`assets:check`、`assets:upload`

## R2 / CDN 上传与排查规则（强制）

适用于任意游戏的图片、音频、atlas、裁图、图标、提示板切片等运行时资源。

### 上传收口

1. **录入或资源改动完成后，AI 必须主动上传**：只要本轮改动涉及运行时资源新增、替换、移动或裁图派生，就必须主动执行 manifest 重建、`assets:check` / `assets:upload` 或等价上传流程，不等待用户额外提醒。
2. **没有远端回查不算完成**：上传后至少抽查 1 个主资源 URL 和 1-3 个代表性裁图 / 子资源 URL，确认远端返回 `200`。
3. **本地存在不代表交付完成**：即使本地文件、manifest、代码引用都已齐全，只要默认资源基址仍指向 R2 / CDN，就必须把远端状态作为最终完成判据。
4. **改本地资源不是修复完成（强制）**：当 Web、Android、线上反馈或用户明确说明“资源用的是 R2 / 官方资源包 / CDN”时，`public/assets/**` 文件替换、压缩 WebP、manifest 改哈希、合成验收图都只能算“本地准备 / 预验证”。最终修复对象必须是远端 R2/CDN 对象或重新发布后的游戏资源包；没有上传和远端回查，禁止回复“资源已修好”“线上会生效”“手机会吃到新图”。
5. **本地验收图只证明坐标/裁切，不证明资源链生效**：用本地图片生成的截图、contact sheet、实叠图、E2E 截图，只能证明当前工作区渲染逻辑或素材内容本身；如果运行时默认从 R2/CDN/已安装包取资源，还必须用最终请求 URL、资源包 manifest、远端哈希或真机下载后的文件哈希回查。禁止拿本地截图替代 R2/包链路验收。
6. **最终汇报必须拆开本地与远端状态**：涉及运行时资源时，收口回复必须分别说明：本地文件是否已改、manifest 是否已更新、R2/CDN 是否已上传、线上/手机/资源包是否已验证。任一项未完成都要明确标为“未完成/有风险”，不得把本地完成混成整体完成。
7. **`git ignore` 与 R2 上传是两回事**：文件是否被 Git 忽略，只影响它会不会自动进入提交，不影响它是不是运行时资源。只要资源已经放进 `public/assets/**` 且代码/manifest 会引用它，就仍然必须按资源流程重建 manifest、上传 R2 并做远端回查；**禁止**把“文件被 ignore 了”当成可以不上传、不中断收口的理由。
8. **上传失败必须显式告知用户**：如果因为 `.env` / `.env.example` 缺失、权限不足、脚本报错、网络失败或用户明确要求暂不上传而没有完成上传，最终汇报必须明确写出“未上传资源列表 + 原因 + 当前运行态风险”，禁止省略。
9. **`R2 有图` 或 `E2E 截图里有图` 不等于本地资源链已闭环**：如果用户问的是“本地为什么看不到素材”“为什么当前实现还在依赖远端”“为什么换机/离线会丢图”，必须回到 `public/assets/i18n/<locale>/<gameId>/`、压缩产物、manifest 和最终请求路径逐项核对；禁止只因为远端 `200` 或截图里最终显示出了图片，就跳过本地正式资源树检查。
10. **该规则不分游戏**：`dicethrone`、`smashup`、`summonerwars` 以及后续新游戏都按同一口径执行。

### R2 与 App 素材包的单一真相源（强制）

1. **R2 文件对象 + 文件索引才是运行时资源真相源**：同一张图片、音频、图集配置只能有一份路径与哈希真相。Web 直连 R2、Android 已安装素材包、离线缓存、CDN URL 都必须引用同一组 `path/hash/size`；禁止让“R2 单文件”和“App ZIP 包内文件”各自维护一套独立事实。
2. **App 素材包必须由同一份索引派生**：`mobile-packages/android/<channel>/file-index/...json` 里的每个 `files[].path/hash/size` 必须能回到正式资源清单或 R2 对象本身；禁止手工改 ZIP、手工改 manifest，或只更新 R2 单文件却不更新 App 可见索引。
3. **差异化更新是默认目标，不是可选优化**：当只替换少量资源时，正确目标应是：上传变更文件到 R2 → 更新文件索引 / 包 manifest → App 客户端比较本地 file-index 与远端 file-index → 只下载缺失或哈希变化的文件。禁止把“为了让 App 吃到一张新图，重发整包 ZIP”当长期正式方案。
4. **全量 ZIP 只能作为 bootstrap / 兼容兜底**：完整游戏 ZIP 适合作为首次安装、清缓存重建、旧客户端不支持差异下载、或大量资源重排后的兜底包。若当前工具链暂时只能重发整包，最终汇报必须明确写成“当前工具链全量重发，不是差异化更新”，不得包装成商业级素材热更新已完成。
5. **单一真相的版本号应来自内容索引**：素材包版本应由 file-index checksum、内容哈希集合或明确的资源版本生成；时间戳只能作为发布审计信息。禁止把时间戳 ZIP 版本当成唯一真相，否则同一内容会产生多个等价包，App 难以判断是否真有差异。
6. **商业游戏常见做法口径**：正式项目通常采用 CDN 上的内容寻址对象、版本 manifest、按资源组拆分 bundle、文件级或 chunk 级 patch；客户端只拉新增/变更 bundle，旧 bundle 留在本地缓存。大包全量下载一般只用于首装、强制修复或跨大版本迁移，不用于每次小素材替换。
7. **Android 游戏包只发布压缩运行时交付物**：`mobile-packages/android` 的游戏包媒体文件只能来自 `compressed/` 目录下的 `.webp` / `.ogg`；运行时 JSON/SVG 配置可入包，但不得携带源图片、源音频、设计源文件或临时文件。`.png/.jpg/.jpeg/.mp3/.wav/.psd/.ai/.aseprite/.kra/.xcf/.tmp/.bak` 以及路径中含 `temp/tmp/bak/backup/old/copy/副本/临时/测试/test` 的文件一律不得进入 file-index 或 ZIP。源文件可以留在本地资源树用于再压缩，但不能随 App 素材包发布。
8. **共享音频包只发布压缩 OGG**：Android 共享音频包 `common-audio` 只允许 `common/audio/**/compressed/*.ogg` 进入 file-index 或 ZIP。`public/assets/common/audio/registry.json`、`phrase-mappings.zh-CN.json` 等构建/开发用配置不进入共享音频包；运行时音频映射由 App 内置的精简注册表提供。若未来确需把某个配置随包下发，必须先明确它是运行时配置而非素材源文件，并补四层路径合同与回归测试。
9. **重复素材必须收口到路径合同，不能只在发布层盲删**：发现同哈希重复文件时，先判断每条路径是否仍被运行时代码、manifest、图集配置或历史客户端引用；只有确认某条路径是旧别名/废弃路径，且运行时不再请求它，才允许从发布候选中排除或迁移。禁止单纯按哈希去重导致客户端按旧路径请求时缺图。

### assets-manifest 生成模式（强制）

1. **默认是增量合并，不要求本地全量资源镜像**：`npm run assets:manifest` 会读取现有 `assets-manifest.json`，只更新/新增本地存在的资源条目，并保留 manifest 中已有但本地缺失的旧条目。禁止把“本地没下载某张 R2 图”解释成“这张图应该从 manifest 删除”。
2. **默认校验也是增量校验**：`npm run assets:validate` 只校验“manifest 已登记且本地也存在”的资源是否一致；manifest 中已有但本地缺失的远端资源条目允许保留，本地存在但未登记的其他任务资源/目录也不阻断。
3. **全量重建必须显式使用 full 模式**：只有确认当前工作树已经下载完整资源镜像时，才允许执行 `npm run assets:manifest:full` 或 `npm run assets:validate:full`。full 模式会把 manifest 当成本地目录快照处理，本地缺失的条目会被删除/判错。
4. **运行时索引必须吃 manifest**：构建/开发注入的语言化图片索引必须同时读取本地文件与 `assets-manifest.json`；本地缺图但 manifest 已登记的远端资源应进入候选链，并在本地 `/assets` 不可用时自动回退官方 R2。
5. **资源交付仍必须远端回查**：增量 manifest 只解决协作者不必下载全量资源的问题，不替代 R2/CDN 上传和 200/hash 回查。

### 故障排查

1. **先查对应任务 worktree，不查错工作区**：如果问题来自某个任务分支 / 独立 `git worktree`，必须先到该 worktree 下核对 `public/assets/`、`assets-manifest.json` 与相关代码引用，禁止只在当前根工作区下判断“文件是否存在”。
2. **先核对运行时真实请求路径**：图片运行时会自动补 `i18n/<locale>/` 与 `compressed/`，排查 404 时必须以最终请求 URL 为准，而不是只看源码里的相对路径。
3. **裁切图也必须满足 `compressed/` 约定**：凡是运行时通过 `OptimizedImage` / `CardPreview` / `getOptimizedImageUrls()` 加载的裁切图，实际可访问文件必须位于对应目录的 `compressed/` 子目录；仅有 `crops/foo.webp` 而没有 `crops/compressed/foo.webp`，视为资源不完整。
4. **上传前先重建清单**：资源目录有新增/移动后，先执行默认增量 `npm run assets:manifest`，再上传到 R2；只有完整资源维护任务才使用 full 模式。
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

> 音频 workflow 优先走 `./.codex/skill/audio-integration/SKILL.md`；新增外部素材的产物合同详见：`docs/audio/add-audio.md`

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
- **移动端已安装包音频直链禁令（强制）**：当音频资源来自 Android 已安装游戏包 / 共享音频包（`/_capacitor_file_/.../game-packages/.../current/assets/...`）时，**禁止**只依赖浏览器直接解码该本地 URL 并在失败后“换个 URL 就算修好”。必须保证：
  1. 首个本地候选失败后，优先走原生 `readInstalledAsset -> blob URL` 或等价桥接读取；
  2. 当前这一次播放请求会续到新候选实例上（BGM / SFX 都一样），不能只替换 `Howl` 实例却不重放；
  3. 官方远端 URL 只能作为最后一道兜底，不能充当对本地包媒体兼容问题的主修复。

### 共享音频包路径合同（强制）

- **单一真相源**：共享音频包 `common-audio` 的运行时相对路径，唯一真相源是 `public/assets` 下的相对路径，例如 `common/audio/bgm/...`、`common/audio/sfx/...`。
- **四层必须同构**：以下四层必须使用同一份相对路径合同，禁止任意一层私自裁前缀、改根目录或只改其中一处：
  1. 打包脚本写入 zip entry 的路径
  2. file index / installed-files-index 中记录的路径
  3. 原生 `current/assets` 下的实际落盘路径
  4. H5 运行时传给 `readInstalledAsset` 的 `relativePath`
- **BGM / SFX 不得各自发明目录语义**：`bgm/...`、`sfx/...` 只是 `common/audio/...` 下的子树，不是独立根路径。禁止因为“只有 BGM 挂了”就单独改 BGM 调用链去迁就目录错位。
- **先确认合同落点，再决定修复层**：当真实机出现“已安装共享音频包但读不到本地文件”时，必须先确认失配发生在上面四层中的哪一层，再决定修打包、原生、索引还是 H5 兼容。禁止在还没确认合同宿主前，直接把问题归因到 BGM 选择逻辑、自动播放策略或 Howler 参数。
- **兼容补丁的适用边界**：只有在已确认问题来自历史已发包与当前合同不一致、且短期内不能要求所有设备重装/重下资源包时，才允许在 H5 / bridge 层补“历史路径兼容读取”。这种兼容必须：
  1. 明确标注兼容的是哪一版历史目录布局
  2. 优先保留当前标准合同不变
  3. 补回归测试锁住“标准路径 + 历史路径”两条读取链
- **R2 兜底不是合同修复**：`官方远端 URL / R2` 只负责兜底可用性，不能作为“本地包路径合同已经正确”的证明。只要真实机日志里仍出现本地 `readInstalledAsset` 找不到文件，就不得把问题表述成“音频链路已完全修好”。

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
- **详见入口**：`./.codex/skill/audio-integration/SKILL.md`（workflow） + `docs/audio/audio-usage.md`（架构与运行时合同）

**相关提案**：`openspec/changes/refactor-audio-common-layer/specs/audio-path-auto-compression.md`
