# 图片/音频资源完整规范

> 本文档是 `AGENTS.md` 的补充，包含图片/音频的完整路径规则、压缩流程与示例。
> **触发条件**：新增/修改图片或音频资源引用时阅读。

---

## 规则素材一票否决（新游戏强制）

当规则、物理组件、官方素材或用户素材目录已经指向某个基础版必需对象需要图片、音频或模型资源时，该对象必须走正式资源链：

1. 从真相源锁定源文件、对象或裁片区域。
2. 按规则语义重命名，禁止把随机哈希名、下载流水名或扫描默认名直接作为运行时名。
3. 落到正式资源目录。
4. 生成压缩产物和 manifest / 索引证据。
5. 在运行时引用，并用测试或截图证明目标位置消费的是该正式资源。

找不到素材时，必须把该对象标为 `blocked`，写清已查找位置、失败步骤和最小解阻动作；不得用“后续美术优化”“程序化也能玩”“先跑通 E2E”绕过。

HTML/CSS 绘制的相似物、纯文字牌、程序化牌面、程序化筹码、假 token、mock 图片或占位图默认都不是正式素材。只有规则对象素材矩阵明确裁定该对象不需要图片，或用户明确批准程序化替代，并且批准已写入矩阵和 proposal/tasks/spec，才允许进入完成判断。

E2E、截图、单测、typecheck 或页面可交互只证明资源消费链路的现象，不能反向证明素材 intake 正确。只要素材矩阵未闭合，资源管线状态就是 `in_progress` 或 `blocked`，不得标 complete。

## 正式素材优先与禁止偷懒替代（强制）

当任务目标是“换样式”“还原目标效果”“只替换外观/骰面/牌面/token 样式”“对齐插件或截图效果”，并且仓库、用户上传目录、官方包、图集、PDF、扫描源或解包资源中已经存在对应正式素材时，默认必须使用这些正式素材，或从正式素材中做可追溯的裁切、抽取、压缩、烘焙与适配。

**素材存在即为强制前提，不是可选优化**：只要已知或可在本轮合理查到正式素材，实施前必须先锁定素材来源、运行时路径和消费方式；除非用户当轮明确批准使用替代方案，否则禁止因为“先跑通”“样式差不多”“插件示例更方便”“临时看效果”“实现更简单”而跳过正式素材。未使用正式素材的版本只能算未完成或临时占位，不得汇报为正式效果已达标。

**有素材不用属于禁止行为，不是实现取舍**：已经确认存在正式骰面、牌面、token、角色板、棋盘或其它目标对象素材时，必须把该素材接入目标运行链路；未经用户当轮明确允许，不得用插件默认样式、字母数字、emoji、自绘 canvas、CSS 假图、临时图标、截图裁片或相似素材代替。若因为接入成本、时间、物理/动画兼容、渲染难度而暂时没用正式素材，只能标成未完成 / blocked / temporary-placeholder，不能继续推进为“正式视觉完成”。

**偷懒不使用素材必须立即停下（强制）**：只要正式素材已经被定位、用户已经指出素材存在，或本轮按合理路径能查到对应素材，当前实现仍使用插件示例、默认样式、文字/数字/emoji、自绘图形、CSS 假图、临时占位或未接入正式图集/裁片时，必须先回到素材接线；未经用户当轮明确允许，禁止继续调样式、跑截图验收、提交或汇报完成，也禁止用“先做效果”“物理更稳”“后面再替换”“差不多能看”作为跳过正式素材的理由。

未经用户当轮明确允许，禁止为了省事用以下内容代替正式素材：

1. 字母、数字、emoji、纯文字标签。
2. 抽象几何图形、临时 icon、程序化 canvas、内联 SVG、自绘低保真符号。
3. CSS 画出来的相似外观、假贴图、mock 图片、截图缩略图或无来源占位。
4. 与目标对象不同语义家族的其它素材，例如用状态图标、marker、牌背、小 token 顶替骰面、卡面、角色板或正式 token。

如果素材暂时找不到，必须先说明缺失的具体对象、已查找的目录/文件/资源包、为什么这些来源不能闭合，以及最小解阻动作；不得直接把自绘方案、文字方案或程序化方案包装成最终效果。

如果为了排障或临时演示必须使用替代图形，只能标成 `temporary-placeholder` / “临时占位”或“止血方案”，并写清它不是正式素材接入完成；最终收口仍必须回到正式素材或用户明确批准的替代方案。

**截图验收不能放宽素材门槛**：即使页面可交互、物理效果正常、截图看起来接近目标，只要目标对象仍由占位、自绘、文字、错误图集或无来源派生产物承载，就不能判定为正式视觉验收通过；必须继续接入真实素材，或明确写成用户已批准的替代口径。

## 🖼️ 图片资源规范

### ⚠️ 强制规则：禁止直接使用未压缩图片

**所有图片必须经过压缩后使用，禁止在代码中直接引用原始 `.png/.jpg` 文件。**

### 正式对局素材禁止降采样（强制）

**只要玩家会在对局、结算、放大预览、持有区、棋盘、地图、角色/派系面板、卡牌/事件/技能/帮助页、token/棋子/状态图中看到并据此识别对象、读取规则或判断状态，该图片就是正式对局素材。正式对局素材只允许从源图转成运行时 WebP，默认禁止改变像素尺寸。**

- **禁止降采样对象**：卡牌图集、单张卡面、棋盘/地图、房间/区域板块、角色板、派系板、帮助/参考卡、骰面、token、棋子、状态图标、玩家提示板、剧本页，以及任何对局内可读/可识别的正式素材。
- **禁止行为**：禁止把正式素材交给展示图/缩略图压缩参数处理；禁止用“端到端截图看得到”“网页加载更快”“文件太大”“只是 WebP”作为降采样理由；禁止在未获用户当轮明确授权时设置 `IMAGE_MAX_EDGE`、`--max-edge` 或其它方式缩小正式素材。
- **唯一默认入口**：正式素材压缩必须使用 `npm run compress:images -- <资源根>` 或 `npm run compress:runtime-images -- <资源根>`；这两个入口默认 `runtime` 模式，不降采样，并会在发现旧的低分辨率 WebP 产物时按源图尺寸重生成。
- **展示图例外**：只有游戏入口封面、列表缩略图、纯装饰背景、营销/相册预览这类不承担规则识别和对局判断的图片，才允许使用 `npm run compress:display-images -- <资源根>`；这类输出不得被接入卡面、图集、棋盘、token 或其它正式对局素材路径。
- **验收门槛**：正式素材压缩后必须核对源图尺寸与 `compressed/*.webp` 尺寸一致；尺寸不一致时，结论必须写成“压缩流程误降采样 / 正式素材产物不合格”，不得继续发布、截图验收或提交。

### 正式线上素材只发布运行时交付物（强制）

正式服务器素材源、移动素材包、file-index、服务器活动版本 `current` 都只能包含运行时交付物：

- 图片只允许 `compressed/` 目录下的 `.webp`。
- 音频只允许 `compressed/` 目录下的 `.ogg`。
- 允许直接发布的非媒体运行时对象仅限 `.svg`、运行时 `.json` 配置、OTA / 原生包 / 移动包所需的 `.zip`、`.apk`。
- `.png/.jpg/.jpeg/.mp3/.wav` 只能作为本地源素材留在资源树中用于重新压缩，不得进入 `assets-manifest.json` 递归得到的服务器活动集合、Android file-index 或 ZIP。
- 如果 `assets-manifest.json` 同时记录了源图片变体和压缩变体，正式发布裁剪必须忽略源图片变体，只把压缩运行时变体纳入服务器 `current`。

如果发现线上 `current`、移动包或 file-index 中出现源 PNG/JPG/WAV/MP3，结论必须写成“发布门禁失效 / 正式素材链路污染”，不得把它说成“素材比较大”或“服务器带宽问题”。

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
- **运行时本地 JSON 配置**：如果代码明确通过本地资源链读取，并且文件本身跟随语言/游戏/角色路径组织，则保留在 `i18n/<locale>/<gameId>/...`。这类文件默认不走远程正式媒体发布链，属于本地包内配置资源
- **原始图片**：可选，仅在需要重新压缩时使用。如果只有 WebP 文件，可以直接放在 `compressed/` 目录

**DiceThrone 当前例外（必须认现状）**：
- `status-icons-atlas.json` 属于 DiceThrone 运行时本地 JSON 配置，不属于 `atlas-configs/<gameId>/` 那类语言无关图集配置
- 它的当前落点是 `public/assets/i18n/<locale>/dicethrone/images/<hero>/status-icons-atlas.json`
- 运行时代码通过本地资源路径读取它，再从其中解析出 `status-icons-atlas.webp` 的图集图片路径
- 因此，排查 DiceThrone 状态图标问题时，真相源是移动游戏包、服务器资源主源、file-index 和客户端实际请求链；不要把 `status-icons-atlas.json` 或 `compressed/status-icons-atlas.webp` 加回 `dist/` / Android embedded 白名单来补图
- 如果手机端只命中本地 `status-icons-atlas.json`，但同包/同源没有对应 `compressed/status-icons-atlas.webp`，结论应写成“游戏包/服务器资源链不完整或请求链选错源”，而不是“dist 缺图”

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
1. **正式素材压缩命令**：`npm run compress:images -- public/assets/<gameId>` 或 `npm run compress:runtime-images -- public/assets/<gameId>`（默认不降采样）
2. **展示图压缩命令**：仅对非对局识别素材使用 `npm run compress:display-images -- <展示图资源目录>`（允许长边缩放）
3. **压缩脚本**：`scripts/assets/compress_images.js`（启动器）+ `scripts/assets/compress_images.py`（实现）
4. **输出位置**：同级 `compressed/` 子目录，生成 `.webp`

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
- **禁止把关键图片降级成裸 CSS background 单路径**。`buildLocalizedImageSet` / `buildOptimizedImageSet` 只负责生成 URL 字符串，不能像 `OptimizedImage` 一样在运行时从本地包、public 资源、manifest/远程资源之间逐级回退；浏览器的多 background URL 也不是可靠的失败回退机制。
- **CSS background 只适合两类场景**：一是精灵图/图集裁剪、Canvas/特殊渲染等必须依赖 `background-position` 的场景；二是丢失后不影响主流程的纯装饰背景。前者必须明确仍然复用统一 URL 解析工具，并补测试或截图证明裁剪合同正确。
- **图集裁片必须让素材本身承担主信息（强制）**：卡牌、房间、参考页、骰面等正式素材以图集裁片进入运行时时，裁片本身就是标题、正文、点数和结果说明的主承载。UI 只允许补必要确认、选择、归属或无障碍文本；不得在裁片旁可见复读同一标题、同一规则正文、同一“已抽到/已翻开”说明。若用户看不清，先修图集坐标、裁切比例、显示尺寸、放大/居中承接或压缩产物，不得用旁边正文替代素材。
- **Android 已安装包资源（`/_capacitor_file_/.../game-packages/.../current/assets/...`）默认不要把可识别图标继续做成 CSS background**：像状态图标、token 图标、可识别 atlas 裁片这类一旦丢失就会退化成“纯色壳/空心圆”的内容，在移动端应优先用真实 `<img>` / `OptimizedImage` / 等价候选链组件承接，再通过 `overflow:hidden + absolute positioning` 做裁片；只有纯装饰背景或已经有专项回归证据证明稳定时，才允许继续用 CSS background 方案。
- **发现移动端或离线包中“PC 正常、手机缺图”时，先查该图片是否绕过了统一图片组件**；不得先把问题归因到缓存、旧素材包或 CDN，除非已经证明运行时请求链本身符合回退合同。
- **禁止为游戏正式素材新增假图兜底**：卡牌、基地、泰坦、角色立绘、地图、token 主视觉等正式游戏素材，如果真实素材未命中、远程资源返回慢、或本地包里暂时没有，禁止新增内联 SVG、程序生成占位图、临时拼字卡面、截图裁片冒充正式资源。运行时只能显示真实素材或保持真实未加载状态。
- **错误推断不得作为素材兜底（强制）**：素材候选链只能在同一权威对象、同一资源合同、同一语言/压缩/远端链路内兜底；一旦需要靠另一套索引、另一名玩家/英雄、旧共享顺序、数组位置、相似 `cardId`、默认图集或“最像的素材”来推导图片，就必须视为真实素材缺口或接线错误。运行时宁可显示明确缺口态、toast/modal 错误、红字诊断或不上特写，也不得继续显示一张可能错误的正式素材。
- **缺图比错图优先（强制）**：对卡牌、棋盘对象、角色板、token 主视觉等会影响玩家判断的素材，禁止为了“不要空白 / 不要报错 / 体验更顺”而回退到不确定图片。只有能证明 fallback 与原对象共享同一真相源且语义等价时，才允许自动回退；否则必须暴露缺口，方便玩家和排查链路立即发现。
- **缺关键素材时必须请求素材或锁定补源路径（强制）**：只要正式对局数据已经会把某张卡牌、房间、角色、token、骰面或剧本页发到玩家面前，却缺少对应真实正面素材、图集坐标或运行时资源，处理者必须先回到资源 intake：列出缺的具体对象、已查过的来源、仍缺什么，并向用户索要素材或给出最小补源路径。禁止只把 `缺正面 / 缺图` 文案删掉、改成牌背弱底纹或降低存在感后继续声称 UI 已收口；这种只能算临时降噪，不是素材问题修复。
- **数据上线即要求真实正面素材闭环（强制）**：只要某批正式卡牌、基地、角色、房间、地图板块或 token 已进入运行时数据、可被发到真实对局、可出现在玩家持有区/公共区/结算区，就必须同步接入对应真实正面素材、图集坐标或明确的“真实素材缺口”状态。禁止把“规则/数据已接入，但图片以后再补”包装成完整交付；也禁止用文字卡、基础牌占位、牌背弱底纹或旧素材兜底冒充该批内容已完成。
- **素材存在时必须接入，不得继续保留代替品（强制）**：只要已经从权威来源包、Workshop JSON、解包模型、图集、PDF 原件或扫描源里锁定某个正式素材，运行时就必须接入该真实素材或它的可追溯派生产物；不得因为已有 CSS 图形、文字壳、旧占位、低保真等价图、示意图能“表达规则”，就继续把代替品留作正式 UI。若派生产物来自模型烘焙、图集裁切或 OCR/扫描处理，必须记录源文件、派生方式、运行时路径和验证证据。
- **规则 token / 筹码禁止文字化替代（强制）**：当规则或外部素材源已经证明某个对象是 token、筹码、棋子或状态标记时，运行时主视觉必须由同一语义家族的真实素材承载；文字按钮、CSS badge、普通标签、数字圆点或相似图标只能作为无障碍文本或临时诊断，不能作为正式图面完成口径。
- **扩展内容不得继承基础素材完成状态（强制）**：基础包卡图已完成，只能证明基础包完成；扩展包、替换牌、Promo、变体牌一旦进入运行时数据，必须单独拥有素材清单、源图、运行时路径、压缩产物、图集 frame 映射和测试门禁。没有这些证据时，结论必须写成“扩展数据已接入，但扩展卡图未闭环”，不得写成“该游戏卡图已完成”。
- **真实正面素材缺失时必须诚实暴露给资源链，不是暴露给玩家（强制）**：如果某张正式卡牌当前只有真实牌背、还没有对应正面图或正面 atlas frame，运行时最多允许显示真实牌背 + 对象名/类别维持可玩性；素材缺口必须写入 intake、manifest、审计 evidence 或任务阻塞，并按上一条向用户索要素材或锁定补源路径。**禁止**拿无关 `marker`、属性 token、数字 token、状态图标或其它素材碎片拼成“假正面卡”继续冒充正式卡图，也禁止把 `缺正面 / 缺图` 这类排障词当玩家状态。
- **持有区 / 手牌区不能让牌背承担主识别（强制）**：玩家当前持有的卡牌、装备、预兆、手牌等，必须优先显示正式正面或正面 atlas 裁片。若正面确实缺失，牌背只能作为弱底纹，主识别必须是足够大的对象名和类别；禁止把多张同类牌背直接排在持有区里，再用角落小字让玩家辨认。该状态不得收口为完成，必须回到资源补齐链。
- **E2E / 截图验收同样禁止假素材**：如果截图时远程资源因为冷启动或拉取较慢而尚未出现，这是可记录的真实状态；可以等待更久，也可以保留真实空态截图，但不能为了“让截图好看”在游戏里加假的 fallback 素材。
- **上传成功不等于手机可见（强制）**：服务器上传脚本返回成功只能证明对象写入了发布目标；若用户问题是“手机看不到 / 线上缺图 / 安装包缺图”，必须继续回查公开资源 URL、服务器活动集合 `current`、运行时 manifest / file-index、Android 已安装素材包或目标端请求链。只要公开 URL 仍是 404、manifest 未收录、或手机包未更新，就只能写“发布链路未闭合 / 手机仍未证明可见”，不得把“本地文件存在”“manifest 本地有条目”或“upload completed”说成移动端已修好。

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
- **错派系/错图源必须修素材绑定，不得改成无图替代（强制）**：如果运行时显示了错误派系、错误牌组、错误图集槽位或其它对象的正式素材，修复对象是素材真相源、图集索引、牌组映射、`previewRef` 或资源 manifest。禁止为了消除错误画面，改用 HTML/CSS 卡面、文字卡、占位图、默认图或隐藏原图来收口；正确素材未找到时，验收结论只能是“素材来源未闭环/blocked”，不能说问题已修好。
- **如确实需要补充共享能力，应下沉到公共层**：如果统一链路不能满足某类图片展示需求，应补到 `AssetLoader` 或通用媒体组件，而不是在单个游戏/单个组件里偷偷复制一份资源加载逻辑。

### 精灵图/图集裁剪安全规则（强制）

- **有正式图集就必须优先使用图集裁切显示**：只要游戏素材已经提供正式卡牌图集、状态图集、token 图集或等价 sprite atlas，运行时必须直接加载图集并通过 `registerLazyCardAtlasSource` / `registerCardAtlasSource` / `background-position` / 裁剪容器等方式显示对应裁片。禁止为了“使用方便”“预加载检测”“组件更简单”再把图集切成单张卡图、单张 token 图或单张状态图作为正式运行时素材。
- **图集优先约束运行时接线，不限制录入切图（强制）**：录入时可以查看从正式 atlas/正式原图切出的 `temp/**` 裁图；但只要问题进入运行时接线、atlas 语义、slot 归属、`previewRef.index`、frame 映射或审计定性，最终仍必须回到正式 atlas/正式原图。`temp/**` 裁片只能辅助看清，不能反向定义正式 atlas 语义。
- **禁止把图集拆图当成默认修复手段**：图集加载失败、裁剪错位、首屏 loading、远程资源路径错误或缓存问题，应优先修图集路径、manifest、criticalImageResolver、atlas 注册或裁剪合同；不得绕过图集链路改成 `cards/faces/<id>.png`、`crops/<id>.webp` 这类单张派生路径来“止血”。只有用户明确要求导出单张素材、规则书本身只提供单图、或某平台已证明无法稳定渲染图集且已写明专项兼容方案时，才允许使用单张派生图；这种情况必须在文档或代码注释中说明例外原因。
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

- `public/assets/**` 只允许放**正式运行时资源**：代码真实引用、允许进入 `dist/`、允许发布到服务器资源主源、允许被 Web/Android 正式包请求的文件。
- **参考图、生成对照图、设计稿导出图、预览脚本专用图、人工核对中间产物**，禁止放在 `public/assets/**`。这些文件必须放到 `docs/`、`temp/`、专项 evidence 或其他非运行时目录。
- **录入切图一律不进正式资源树，也不进远程资源主源（强制）**：凡是为了业务录入生成的单格裁片、整卡裁片、放大图、局部图、OCR 图、人工比对图，即使只是从正式 atlas 做最普通的几何裁切、没有任何额外后处理，也只能留在 `temp/**`。这类文件不能落在 `public/assets/**`，不能进入 manifest，不能发布到服务器资源主源，更不能因为目录名看起来像 `crops/`、`slots/`、`faces/` 就被误当正式资源。
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
6. ✅ 运行 `npm run compress:images -- public/assets/<gameId>` 或 `npm run compress:runtime-images -- public/assets/<gameId>`（如果有原始图片；正式素材默认不降采样）
7. ✅ 确认 `compressed/` 子目录生成 `.webp` 文件（或直接放入 WebP 文件），并核对正式素材源图与 WebP 尺寸一致
8. ✅ 先判断 JSON 是**语言无关图集配置**还是**运行时本地 JSON 配置**：前者放 `public/assets/atlas-configs/<gameId>/`，后者按实际读取链保留在 `public/assets/i18n/<locale>/<gameId>/...`
9. ✅ 代码中使用 `OptimizedImage` 或 `getOptimizedImageUrls`
10. ✅ **确认路径中不含 `compressed/` 子目录**
11. ❌ **禁止**直接写 `<img src="/assets/xxx.png" />`
12. ❌ **禁止**硬编码 `compressed/` 路径
13. ❌ **禁止**把 `candidate/excluded` 文件混入正式资源树后继续执行 `assets:manifest`、`assets:check`、`assets:upload`

## 移动 OTA 资源边界（强制）

1. **OTA 与 embedded APK 使用不同白名单**：embedded APK 可以为首装或离线兜底保留明确批准的最小资源；OTA zip 不得直接复用 embedded 白名单。
2. **OTA 只承载 Web 本体**：允许 H5 代码、样式、`locales/zh-CN/**`、字体、必要的小型公共文件和 `assets-manifest.json`。
3. **嵌套运行时资源默认不进 OTA**：`assets/atlas-configs/**`、`assets/common/**`、`assets/i18n/**`、`logos/**` 下除资源清单外的图片、音频、图集配置、缩略图、状态图集 JSON 和二维码必须从 OTA 排除。
4. **Vite 根级产物可以保留**：`dist/assets/` 根目录下由 Vite 生成的 JS、CSS、按代码 import 生成的哈希文件属于 Web 本体；不得因为扩展名是图片就盲目删除。
5. **资源继续走服务器主源或移动游戏包**：被 OTA / embedded dist 排除的正式运行时资源必须能通过服务器资源主源、移动游戏包或已安装资源读取；不得用“从 dist/OTA 删掉了”替代资源链验收，也不得把对局图片、状态图集或 token 图集重新加回 dist 当修复。
6. **发布后必须检查 ZIP 文件清单**：至少确认首页大图、游戏缩略图、`assets/atlas-configs/**`、状态图集 JSON 和支付二维码没有进入 OTA。

## 服务器资源发布与排查规则（强制）

适用于任意游戏的图片、音频、atlas、裁图、图标、提示板切片等运行时资源。

### 服务器主源（强制）

1. **公开资源域名和协作者入口保持不变**：正式资源仍通过现有命令发布，运行时仍使用 `https://assets.easyboardgame.top/official/...`。不得要求协作者改成服务器 IP、隐藏源域名或另一套上传命令。
2. **服务器是发布与在线下载主源**：发布脚本通过受限 SSH 将本批对象写入新 release，完成路径、大小和哈希校验后原子切换 `/home/admin/storage/assets/current`。所有 `official/**` 公网读取首先使用该活动版本。
3. **禁止对象存储回退和灾备队列**：服务器切换成功后不再生成对象存储灾备队列；对象存储不可用、凭据缺失或容量问题不得参与正式发布判断，也不得把服务器回滚到旧远端对象状态。
4. **发布完成必须验证本次服务器对象**：大型 bundle / APK / 游戏包必须返回 `X-Asset-Source: server`，且 `Content-Length` 与本次产物一致；file-index / latest manifest 等小型 JSON 必须从服务器读取正文并校验本次 SHA-256。旧同路径对象、旧缓存或 `server-error` 都不能作为本次发布成功证据。
5. **服务器活动集合必须闭合到真实对象**：所有 `official/**/assets-manifest.json` 都是普通素材根，必须按 `basePrefix + files 键 + variants 扩展名` 展开真实对象；移动包 `file-index.files[].path` 必须映射为 `official/<path>`。OTA、游戏包和原生安装包仍只保留当前公开清单递归引用对象，不复制历史全集。活动集合默认上限为 4GiB，切换后必须至少保留 5GiB 磁盘空闲。
6. **公开链路验证最多等待 30 分钟**：服务器原子切换完成后，发布脚本等待公开 URL 返回 `X-Asset-Source: server`，默认上限为 30 分钟（`BG_ASSET_SERVER_PROPAGATION_TIMEOUT_MS=1800000`）。该等待只处理 Tunnel、Worker 或缓存传播；URL 类型、目标结构、预期大小或摘要无效时必须首轮立即失败，禁止进入传播重试。

### 上传收口

1. **录入或资源改动完成后，AI 必须主动上传**：只要本轮改动涉及运行时资源新增、替换、移动或裁图派生，就必须主动执行 manifest 重建、`assets:check` / `assets:upload` 或等价上传流程，不等待用户额外提醒。
2. **没有远端回查不算完成**：上传后至少抽查 1 个主资源 URL 和 1-3 个代表性裁图 / 子资源 URL，确认远端返回 `200`。
3. **本地存在不代表交付完成**：即使本地文件、manifest、代码引用都已齐全，只要默认资源基址仍指向官方资源域名，就必须把服务器主源状态作为最终完成判据。
4. **改本地资源不是修复完成（强制）**：当 Web、Android、线上反馈或用户明确说明“资源用的是官方资源包 / CDN / 服务器资源主源”时，`public/assets/**` 文件替换、压缩 WebP、manifest 改哈希、合成验收图都只能算“本地准备 / 预验证”。最终修复对象必须是服务器资源主源对象或重新发布后的游戏资源包；没有上传和远端回查，禁止回复“资源已修好”“线上会生效”“手机会吃到新图”。
5. **本地验收图只证明坐标/裁切，不证明资源链生效**：用本地图片生成的截图、contact sheet、实叠图、E2E 截图，只能证明当前工作区渲染逻辑或素材内容本身；如果运行时默认从官方资源域名或已安装包取资源，还必须用最终请求 URL、资源包 manifest、服务器主源哈希或真机下载后的文件哈希回查。禁止拿本地截图替代服务器资源/包链路验收。
6. **最终汇报必须拆开本地与远端状态**：涉及运行时资源时，收口回复必须分别说明：本地文件是否已改、manifest 是否已更新、服务器资源主源是否已发布、线上/手机/资源包是否已验证。任一项未完成都要明确标为“未完成/有风险”，不得把本地完成混成整体完成。
7. **`git ignore` 与服务器发布是两回事**：文件是否被 Git 忽略，只影响它会不会自动进入提交，不影响它是不是运行时资源。只要资源已经放进 `public/assets/**` 且代码/manifest 会引用它，就仍然必须按资源流程重建 manifest、发布到服务器资源主源并做远端回查；**禁止**把“文件被 ignore 了”当成可以不上传、不中断收口的理由。
8. **上传失败必须显式告知用户**：如果因为 `.env` / `.env.example` 缺失、权限不足、脚本报错、网络失败或用户明确要求暂不上传而没有完成上传，最终汇报必须明确写出“未上传资源列表 + 原因 + 当前运行态风险”，禁止省略。
9. **`远程有图` 或 `E2E 截图里有图` 不等于本地资源链已闭环**：如果用户问的是“本地为什么看不到素材”“为什么当前实现还在依赖远端”“为什么换机/离线会丢图”，必须回到 `public/assets/i18n/<locale>/<gameId>/`、压缩产物、manifest 和最终请求路径逐项核对；禁止只因为远端 `200` 或截图里最终显示出了图片，就跳过本地正式资源树检查。
10. **带路径过滤上传时 0 个对象必须视为失败**：`assets:check` / `assets:upload -- --asset-prefix <path>` 只能作为“本地发布计划”检查，不能当远端验证。若指定了 `--asset-prefix`，输出 0 个待发布对象必须立即中断并修正路径；禁止把 0 对象成功退出解释成“已经传过 / 没有变化”。文件级前缀优先写完整相对路径（例如 `i18n/zh-CN/smashup/cards/compressed/foo.webp`），也允许使用已被脚本支持的同名无扩展名前缀，但必须先看到对应 `待发布: official/...` 行。
11. **发布 manifest 前必须做清单闭合回查**：只要本轮新增、移动或重建了 `assets-manifest.json`，不能只抽查单张图；必须展开该 manifest 的运行时对象引用（`basePrefix + files 键 + variants 扩展名`，源 PNG/JPG/WAV/MP3 除外），对新增或变更涉及的 `compressed/*.webp` / `compressed/*.ogg` / 运行时 JSON/SVG 做远端 `HEAD 200` 或等价服务器活动集合校验。发现任一缺失对象时，先补发缺失对象，再发布 manifest / 刷新 App file-index。
12. **游戏级 manifest 的 `basePrefix` 必须匹配清单实际目录**：位于 `public/assets/i18n/zh-CN/<gameId>/assets-manifest.json` 的清单必须发布到 `official/i18n/zh-CN/<gameId>/`，不得继续引用旧的 `official/<gameId>/`。上传或刷新 Android file-index 前，必须校验所有本地 `assets-manifest.json` 的 `basePrefix` 与所在目录一致；否则服务器活动清单会递归追到旧路径并在发布阶段失败或线上缺图。
13. **该规则不分游戏**：`dicethrone`、`smashup`、`summonerwars` 以及后续新游戏都按同一口径执行。

### 远端对象与 App 素材包的单一内容真相（强制）

1. **服务器对象 + 文件索引是内容真相**：同一张图片、音频、图集配置只能有一份路径与哈希真相。服务器活动版本、Android 已安装素材包、离线缓存和公开 URL 都必须引用同一组 `path/hash/size`；禁止让“服务器文件”和“App ZIP 包内文件”各自维护独立事实。
2. **App 素材包必须由同一份索引派生**：`mobile-packages/android/<channel>/file-index/...json` 里的每个 `files[].path/hash/size` 必须能回到正式资源清单或服务器主源对象本身；禁止手工改 ZIP、手工改 manifest，或只更新服务器单文件却不更新 App 可见索引。
3. **差异化更新是默认目标，不是可选优化**：当只替换少量资源时，正确目标应是：把变更文件和索引原子发布到服务器主源 → App 客户端比较本地 file-index 与远端 file-index → 只下载缺失或哈希变化的文件。禁止把“为了让 App 吃到一张新图，重发整包 ZIP”当长期正式方案。
4. **全量 ZIP 只能作为 bootstrap / 兼容兜底**：完整游戏 ZIP 适合作为首次安装、清缓存重建、旧客户端不支持差异下载、或大量资源重排后的兜底包。若当前工具链暂时只能重发整包，最终汇报必须明确写成“当前工具链全量重发，不是差异化更新”，不得包装成商业级素材热更新已完成。
5. **单一真相的版本号应来自内容索引**：素材包版本应由 file-index checksum、内容哈希集合或明确的资源版本生成；时间戳只能作为发布审计信息。禁止把时间戳 ZIP 版本当成唯一真相，否则同一内容会产生多个等价包，App 难以判断是否真有差异。
6. **商业游戏常见做法口径**：正式项目通常采用 CDN 上的内容寻址对象、版本 manifest、按资源组拆分 bundle、文件级或 chunk 级 patch；客户端只拉新增/变更 bundle，旧 bundle 留在本地缓存。大包全量下载一般只用于首装、强制修复或跨大版本迁移，不用于每次小素材替换。
7. **Android 游戏包只发布压缩运行时交付物**：`mobile-packages/android` 的游戏包媒体文件只能来自 `compressed/` 目录下的 `.webp` / `.ogg`；运行时 JSON/SVG 配置可入包，但不得携带源图片、源音频、设计源文件或临时文件。`.png/.jpg/.jpeg/.mp3/.wav/.psd/.ai/.aseprite/.kra/.xcf/.tmp/.bak` 以及路径中含 `temp/tmp/bak/backup/old/copy/副本/临时/测试/test` 的文件一律不得进入 file-index 或 ZIP。源文件可以留在本地资源树用于再压缩，但不能随 App 素材包发布。
8. **共享音频包只发布压缩 OGG**：Android 共享音频包 `common-audio` 只允许 `common/audio/**/compressed/*.ogg` 进入 file-index 或 ZIP。`public/assets/common/audio/registry.json`、`phrase-mappings.zh-CN.json` 等构建/开发用配置不进入共享音频包；运行时音频映射由 App 内置的精简注册表提供。若未来确需把某个配置随包下发，必须先明确它是运行时配置而非素材源文件，并补四层路径合同与回归测试。
9. **重复素材必须收口到路径合同，不能只在发布层盲删**：发现同哈希重复文件时，先判断每条路径是否仍被运行时代码、manifest、图集配置或历史客户端引用；只有确认某条路径是旧别名/废弃路径，且运行时不再请求它，才允许从发布候选中排除或迁移。禁止单纯按哈希去重导致客户端按旧路径请求时缺图。
10. **清理并重新下载必须证明真实下载模式已切换**：处理移动端素材包“增量文件校验失败 / 本地临时文件校验失败 / 清理后仍提示旧错误”时，不能只改提示文案或只清 H5 状态。修复必须闭合到三层证据：① 清理动作清空本地包目录、状态文件和活动任务；② 下一次安装即使拿到旧 `diffOnly` / file-index manifest，也强制以完整 ZIP 进入原生安装；③ 真机或等价原生日志证明 `fileIndexUrl` 为空、`incrementalMode` 为 false，且不再出现 `incremental-file` 单文件校验。没有第③层证据时，只能说“代码层已加保护，真机原始位点未验收”，不得宣称问题已彻底修复。

### assets-manifest 生成模式（强制）

1. **默认是增量合并，不要求本地全量资源镜像**：`npm run assets:manifest` 会读取现有 `assets-manifest.json`，只更新/新增本地存在的资源条目，并保留 manifest 中已有但本地缺失的旧条目。禁止把“本地没下载某张远程图”解释成“这张图应该从 manifest 删除”。
2. **默认校验也是增量校验**：`npm run assets:validate` 只校验“manifest 已登记且本地也存在”的资源是否一致；manifest 中已有但本地缺失的远端资源条目允许保留，本地存在但未登记的其他任务资源/目录也不阻断。
3. **全量重建必须显式使用 full 模式**：只有确认当前工作树已经下载完整资源镜像时，才允许执行 `npm run assets:manifest:full` 或 `npm run assets:validate:full`。full 模式会把 manifest 当成本地目录快照处理，本地缺失的条目会被删除/判错。
4. **运行时索引必须吃 manifest**：构建/开发注入的语言化图片索引必须同时读取本地文件与 `assets-manifest.json`；本地缺图但 manifest 已登记的远端资源应进入候选链，并在本地 `/assets` 不可用时使用官方资源域名。
5. **资源交付仍必须远端回查**：增量 manifest 只解决协作者不必下载全量资源的问题，不替代服务器资源主源发布和 200/hash 回查。
6. **嵌套语言目录清单必须用对应 root 重建**：如果需要单独重建 `public/assets/i18n/<locale>/<gameId>/assets-manifest.json`，必须使用该语言根作为 `--root`（例如 `node scripts/assets/generate_asset_manifests.js --root public/assets/i18n/zh-CN --id smashup`），确保 `basePrefix` 指向 `official/i18n/<locale>/<gameId>/`。禁止用旧根或手工编辑留下 `official/<gameId>/` 前缀。
7. **manifest 前缀漂移必须有测试守住**：修复或新增 manifest 生成/发布链路时，必须有测试覆盖“本地素材清单 `basePrefix` 匹配清单所在目录”和“服务器活动集合能按清单展开到真实对象”。不能只靠当轮人工检查。

### 故障排查

1. **先查对应任务 worktree，不查错工作区**：如果问题来自某个任务分支 / 独立 `git worktree`，必须先到该 worktree 下核对 `public/assets/`、`assets-manifest.json` 与相关代码引用，禁止只在当前根工作区下判断“文件是否存在”。
2. **先核对运行时真实请求路径**：图片运行时会自动补 `i18n/<locale>/` 与 `compressed/`，排查 404 时必须以最终请求 URL 为准，而不是只看源码里的相对路径。
3. **裁切图也必须满足 `compressed/` 约定**：凡是运行时通过 `OptimizedImage` / `CardPreview` / `getOptimizedImageUrls()` 加载的裁切图，实际可访问文件必须位于对应目录的 `compressed/` 子目录；仅有 `crops/foo.webp` 而没有 `crops/compressed/foo.webp`，视为资源不完整。
4. **上传前先重建清单**：资源目录有新增/移动后，先执行默认增量 `npm run assets:manifest`，再发布到服务器资源主源；只有完整资源维护任务才使用 full 模式。
5. **上传脚本入口**：当前正式入口是 `npm run assets:upload` / `npm run assets:check`，底层调用 `scripts/assets/upload-to-server.js`。排查“为什么本机能传/不能传”时，必须先确认服务器发布脚本、受限 SSH 配置和目标服务器活动目录。
6. **出现“多叠一层整图/四角异常”先查叠层来源（通用规则）**：优先用 DevTools 选中异常区域，检查上层元素是否存在整图覆盖；查看 **计算后** `opacity/visibility/filter/transform` 是否被脚本改写；必要时用 `elementsFromPoint()` 或逐层禁用 DOM 来定位真正的上层来源。该步骤必须在调整裁剪/圆角/纹理之前完成。

---

## 关键图片预加载入口（criticalImageResolver）

> 完整规范已拆到 `docs/ai-rules/critical-image-preload.md`。本文档只保留入口，避免资源总览继续承载首屏预加载百科。

- 新增游戏、新增角色/派系、修改游戏 Board 中使用的图片资源时必读。
- Board 中使用的所有图片必须出现在 `criticalImageResolver` 中；首屏可见资源放 `critical`，按需资源放 `warm`。素材存在、已压缩、已进 manifest 不等于已接好加载链。
- 按需弹窗、规则卡网格、工具/专家牌列表、帮助页图片默认保留 `OptimizedImage` 的加载占位；只有进入 `critical` 或已有稳定骨架/明确空态时，才允许关闭占位。
- 教程模式、warm 取消恢复、图集初始化、`locale` 路径和新增角色/派系检查清单见专项文档。

## 音频资源入口

> 完整规范已拆到 `docs/ai-rules/audio-assets.md`；音频 workflow 优先走 `./.codex/skill/audio-integration/SKILL.md`。

- 音效 key 只在通用注册表中定义一次，游戏层和 FX 层直接引用完整 key。
- 共享音频包路径合同、移动端已安装包读取、音效触发路径和工具链见 `audio-assets.md`。
