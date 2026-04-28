## Addendum（2026-04-28）：Home V2 详情页 + 翻页效果完全重构（起步分析）
- 参考稿目录已复核，当前至少可以明确分成 4 组：
  - `background.png`：封面/底图基底；
  - 首页目录 spread：已基本收口，可作为后续重构基线；
  - 详情/登录注册/建房密码相关稿：说明后续不该继续沿用首页那套简化壳；
  - 总览流程稿：明确目标不是单页修补，而是“封面 -> 目录 -> 详情 -> 规则/进入游戏”的统一书本路径。
- 当前实现状态的关键差距：
  - 首页 `overview` 已切成独立 spread（`HomeV2.tsx` 直接渲染 `overview-spread/1.png` + `LobbyDirectory.OverviewSpread`），这部分方向对了；
  - 但 `detail` 与翻页仍主要依赖 `src/ugc/runtime/ui-scene/scenes/homeV2BookScene.ts` 里的旧 `book-idle` 壳 + 通用 `page-flip-left/right` 序列，说明“首页新稿”和“详情/翻页旧稿”目前还是两套混合态；
  - `GameDetails.tsx` 现在只是把标题、meta tag、房间列表、密码区做了局部收敛，还没有进入“按参考图整页重构”的阶段。
- 已落的结构修复：
  - `detail` 状态已从旧 scene renderer 常驻壳层中拆出，和首页一样走独立 fixed-composition 舞台，符合“固定构图类优先 scale-to-fit，而不是局部 vw/reflow”的移动端约束；
  - 详情左右页内容与书签点击区现已按 artboard 百分比直挂到 detail spread 上，避免继续被旧场景壳的 slot/clip 逻辑牵着走。
- 现阶段仍然保留的差距：
  - detail spread 目前先复用 `book-idle/1.png` 作为专用背景，结构已经拆开，但视觉尚未完全到参考稿终态；
  - 翻页中间帧仍沿用现有 `page-flip-left/right` 资源，所以当前是“结构已解耦、动画资产未完全换代”的中间态。
- 已新增的视觉结论：
  - 详情左页若继续沿用“标题 + 两个小 tag + 一段短摘要”的轻量卡片式结构，会明显弱于参考稿的书页气质；更合适的是“眉题 + 大标题 + 稠密 badge + 段落正文 + 小信息卡”的编辑式排法。
  - 右页标题区也不宜继续只做普通 section header；至少要先收成书页式的上下层级，再谈房间列表细节。
- 这意味着下一轮重点不再是“能不能拆出来”，而是：**给 detail spread 补齐更像参考稿的视觉基底，并让翻页中间帧和 detail 落地态的观感统一起来**。

## Addendum（2026-04-28）：Home V2 首页缩略图退步修复（2388x1080）
- 本轮首页退步的直接根因有两条：
  - `src/components/home-v2/LobbyDirectory.tsx` 只认 `game.thumbnailPath`，没有复用项目注册表里已经存在的 `game.thumbnail`，所以 `tictactoe` 从 v1 的霓虹缩略图退化成了纯字符占位。
  - `splendor` manifest 挂的是 `splendor/picture`，但 `public/assets/i18n/zh-CN/splendor/compressed/picture.webp` 当时并不存在，所以目录页右上条目直接显示成空白块。
- 修法保持最小风险：
  - `tictactoe` 不再手绘新假图，直接回退到项目已注册的真实缩略图组件（即当前系统里本来就在用的井字棋霓虹缩略图）。
  - `splendor` 不再让首页吃空白，占用当前首页定稿使用的缩略图资源，补齐到 canonical 路径 `splendor/picture`，让所有消费该 manifest 路径的地方都能拿到图。
- 最新目录截图已恢复两个问题位点：
  - `splendor` 卡位不再是白块，缩略图主体可见；
  - `tictactoe` 不再是 `#` 占位，而是实际缩略图内容；
  - 右页两条目录项都保持在书页内容区内，没有出现新的黄边/白边露出。
- 本轮关键截图：
  - 目录页：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-homepage-catalog.png`
  - 详情入口：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-detail-entry.png`
- 结论：这次修复只处理“首页缩略图显示回归”，没有再把首页改回假缩略图占位，也没有扩大到详情页重构。

# Findings & Resources

## Addendum（2026-04-28）：Home V2 首页参考图终态收口（2388x1080）
- 真分辨率口径已经固定到 `2388x1080`；首页 E2E 日志持续打印 `home-v2-viewport width=2388 height=1080`，不再回退到 `936x432` 代理口径。
- 书页主体在当前口径下保持 `widthRatio=0.798 / heightRatio=0.993 / center=(0.500,0.500)`，说明首页没有缩到左上角，也没有脱离同一视觉坐标系。
- 首页目录最终采用“静态书页底图 + DOM 导航 + DOM 列表”的做法是可行的：即便 `tictactoe` 缩略图仍为前端绘制态，首页依然证明这不是一张整页截图，而是真实前端页面。
- 当前最终版比上一轮继续收口了三件事：
  - 条目 rect、缩略图尺寸、标题/摘要/人数字号都继续往参考图靠拢；
  - `splendor` / `summonerwars` 参考缩略图继续上移放大，压掉了底部偏色边；
  - badge 改为更接近参考稿的双标签组合（如 `卡牌 + 策略`、`收集 + 策略`、`战棋 + 卡牌`），不再出现重复标签。
- 右上角账号/概述入口也继续缩放和提权，当前截图里已能稳定落在参考图同一区域内，且点击账号入口仍能切到 rooms 页。
- 本轮判断：在用户要求的“只做首页 + 真移动端横屏 + 内容在书页里 + 前端真实可用”范围内，当前首页目录页已经达到可收口状态；后续若再迭代，应属于新一轮“详情/登录/翻页深化”，不再属于这次首页收口范围。

## Addendum（2026-04-26）：Home V2 首页参考图重构（起步分析）
- 版本基线：`homepage-v2` 工作树原先仍停在 `0.5.59`，已先同步到当前主工作区同口径 `0.5.61`，避免后续首页重构落在过旧版本号上。
- 参考图判断：
  - `首页.png` 不是“六宫格卡面目录”，而是**双页书本上的信息流列表**：顶部跨页分类导航 + 每页 3 条游戏行，每条包含缩略图、标题、描述、tag、人数。
  - `总览首页.png` 说明首页最终是“封面 -> 打开动画 -> 目录页 -> 详情页”的统一书本体验；当前首页只覆盖了“打开后目录页”的简化版。
- 当前实现差距：
  - `src/pages/HomeV2.tsx` 仍以 `activeTab=lobby|rooms` 驱动；首页主内容是 `LobbyDirectory.Left` 的 3x2 九宫格卡片，不是跨页分类导航 + 双列列表。
  - `src/ui-scenes/home-v2/home-v2.ui.yaml` / `homeV2BookScene.ts` 仍保留右侧书签区（`tab_lobby/tab_rooms`），与参考图顶部导航不一致。
  - `src/components/lobby/GameList.tsx` 的 `homeV2Compact` 变体只适合“缩略图+标题”卡片，不适合参考图这种“行项目录”。
- 资源判断：
  - 用户提供的 `background.png` 已经是完整打开书本底图，**首页第一阶段不需要抠图也能落地**；顶部导航、分类高亮、列表分隔线、tag、人数都可纯前端实现。
  - 真正更适合后续新增素材/抠图的部分，主要是：更精致的分类高亮底托、右上角头像/设置徽章、详情页专用按钮底板、若要完全替换旧翻页序列时所需的新中间帧。
- 第一阶段最小切入点：
  - 保留现有 `HomeV2` 状态机与点击进详情逻辑；
  - 先把 `overview` 态改成“静态书本底图 + 前端跨页导航 + 左右页行项目录”；
  - 旧 `rooms` / `detail` / `create-room` 先不一起重做，避免一次性改坏整个工作树里的既有 E2E。
- 本轮首页收口补充：
  - `background.png` 已作为首页打开书本底图接入 `public/assets/common/images/home-v2/book-idle/1.png`，并压缩生成 `compressed/1.webp`；当前首页目录与参考图一样直接建立在完整打开书页背景上。
  - 首页目录最终采用“顶部分类导航 + 双列信息流”而非旧九宫格卡片；`overview_spread_body` 现在统一承载 6 个游戏条目，E2E 量测结果为两列、三行严格对齐（`leftColumnDelta=0.00`、`rightColumnDelta=0.00`、`rowDelta=(0.00,0.00,0.00)`）。
  - 仅靠“缩略图 fallback + 默认字号”会让首页看起来像可用 UI，但不够接近参考图；需要继续把首页舞台放大，并把顶部分类、标题、摘要、人数标签按参考图比例整体放大。
  - `splendor` 原缩略图缺失会形成白块；继续往参考图压时，最稳妥的做法是只裁切**局部缩略图素材**（而不是把整页截图重新当 UI）。本轮已从用户提供的 `首页.png` 裁出 `splendor` / `summonerwars` 局部图并压成 WebP，作为条目 thumbnail 使用。
  - 参考图首页不应带全局悬浮控件；原右下角白色齿轮来自 `GlobalHUD`，现已在 `/?homeV2Draft=1` 与 Home V2 预览路由直接隐藏，首页证据截图里已不再出现该浮层。
  - 首页 E2E 的 rooms 中转只保留“右上角账号入口可切到 rooms，且 rooms 页内联登录输入框出现”这条最小链路；注册/重置切换属于后续登录页重构范围，不再作为首页验收阻塞项。

## Addendum（2026-04-22）：Home V2 细节二次收口
- 根因 1（字过大）：手机横屏下 HomeV2 叠加缩放偏高（`wideLandscapeShellScale` + `presentationOverride`），导致书签字与页内标题观感偏大。修复为：`HOME_V2_PHONE_PRESENTATION_SCALE 1.42 -> 1.28`、`wideLandscapeShellScale 1.18 -> 1.14`，并下调书签字 `12px -> 11px`。
- 根因 2（书本偏下）：场景 presentation 纵向偏移量过大。修复为：`HOME_V2_BOOK_SCENE.presentation.offsetYPct 1 -> -0.8`，将书本整体上移一档。
- 根因 3（详情页按钮/tag 抢空间）：`返回目录/创建房间` 和房间操作 tag 视觉权重偏高。修复为按钮尺寸分级整体收缩（`tiny/compact`）、详情左页 meta tag 保持单行小标签、右页操作 tag 改为更小的同排右对齐样式。
- 根因 4（建房弹窗超出视口）：`CreateRoomModal` 在 HomeV2 里挂在被 transform 的书本容器中渲染，`position: fixed` 实际被父级变换放大，出现 `top<0 / bottom>viewport`。修复为 `createPortal(..., document.body)`，并补 `maxHeight` 与安全区边距约束。
- 量化验证（E2E 日志）：`[home-v2-create-room-modal] top=25.25, bottom=419.83, viewportHeight=432`，确认弹窗完整位于可视区内。

## Addendum（2026-04-22）：Home V2 登录/详情 UI
- 登录页问题根因：原 `AuthModal` 始终居中（`ModalBase` 内部固定 `justify-center`），导致登录入口和弹窗视觉挤压在同一区域。修复为 `AuthModal placement="right"`，并在 `ModalBase` 增加 `contentWrapperClassName` 支持右侧布局。
- 详情页问题根因：类型/人数 tag 与房间操作 tag 尺寸偏大，且房间操作 tag 独立占一行，压缩描述信息空间。修复为单行小 tag（左页）+ 同行右对齐小 tag（右页）。
- 验证口径：统一使用 `BG_HOME_V2_VIEWPORT=2388x1080` 跑 HomeV2 两条核心 E2E，确保和用户当前验收分辨率一致。

## Addendum（2026-04-21）：Home V2 手机端适配（固定横屏口径）
- 根因 1（过小）：此前为避免遮挡把 Home V2 手机横屏 presentation scale 压到 `1.0`，导致书本在真机上过小。已改为“手机横屏固定口径”使用 `1.2`（仅 `<=1100x520` 生效）。
- 根因 2（信息显示不全）：详情页房间卡原“同一行正文 + 标签”在窄高度下挤压严重。已改为“标题/座位信息/标签”纵向排列，降低字号并允许换行。
- 根因 3（密码文案截断）：`请输入密码...` 在当前密度下易被裁切，已改为短文案 `输入密码`（英文 `Password`），并下调输入框字号与 padding。
- 根因 4（视觉风格不一致）：用户要求“返回目录、tag 用素材而不是自定义底色”，已统一采用 `holders/compressed/1.webp` 边框素材。
- 真机发布状态：
  - `npm run mobile:android:build:debug` 成功；
  - `adb -s 10ADAU063C0010U install -r ...easyboardgame-debug.apk` 成功；
  - 真机复核截图已补齐：`homev2-deeplink-20260421-233448.png`、`homev2-detail2-20260421-233536.png`、`homev2-create-modal-20260421-233551.png`；
  - 结论：Home V2 手机端“安装 -> 启动 -> 首页/详情/建房弹窗”闭环已完成。

## Addendum（2026-04-07）：Android 本地素材包图片加载故障
- 原生安装链路本身正常：`GamePackageForegroundRuntime`/`GamePackagePlugin` 会把游戏包解压到 `.../files/game-packages/<gameId>/current/assets`，并通过 `assetRootPath` 回传前端。
- 启动期丢本地素材的首个根因在 `src/features/mobile-packages/packageManagerService.ts`：
  - `hydrateInstalledNativeGamePackages()` 之前只会处理已经存在 `fallbackCache` 的游戏。
  - `fallbackCache` 主要由大厅里的 `useGamePackageState()` 注册；如果用户没先经过这层 hook，已安装包会被 hydration 直接跳过。
  - 结果是 `setGameAssetBaseOverride(gameId, assetBaseUrl)` 没有执行，AssetLoader 继续按远端资源域名取图。
- 图片长时间“加载中”的第二个根因在 `src/components/common/media/OptimizedImage.tsx`：
  - 组件原先把所有“非 http(s) 本地路径”都走成开发态 `/assets/...` 的 `fetch -> blob` workaround。
  - Android 已安装包路径 `/_capacitor_file_/...` 也会落进这个分支，导致本地包图片被误伤，停在加载态。
- 本轮修复策略：
  - `hydrateInstalledNativeGamePackages()` 在 fallbackState 缺失时，使用已安装包信息构造兜底 state，再继续 emit/apply override。
  - `OptimizedImage` 的 blob-fetch workaround 收窄为“仅开发态 public `/assets/...`”；对 `/_capacitor_file_/...` 直接交给 `<img>` 原生加载。
  - `nativeGamePackagePlugin.ts` 对原生首次 ack / installState listener 返回的 `running/completed/cancelled` 做前端状态归一化，禁止把非法状态直接写进 `StoredGamePackageState.status`。
- 第二轮真机排障确认了更前置的一层 bug：
  - `易桌游测试(top.easyboardgame.app.debug)` 当前私有目录里没有 `dicethrone` 已安装包，也没有 `install-state.json`。
  - 但旧 H5 bundle 仍可能把原生 ack 的 `status: "running"` 直接写进前端状态，导致下载按钮被判成“处理中”并直接变灰。
  - 这会掩盖后续“是否正确使用本地素材包”的真实状态，所以必须先修状态机污染，再继续看图片链路。
- 定向验证：
  - `src/components/common/media/__tests__/CardPreview.i18n.test.tsx` 新增断言：游戏包 override 生效时，`OptimizedImage` 不得触发 fetch/blob workaround。
  - `src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts` 新增断言：即使未先进入大厅包管理 hook，启动期 hydration 也能把原生已安装包同步进状态缓存。
  - 真机 `易桌游测试` OTA 目录已覆盖最新 `dist/`，启动日志确认加载的是新 bundle `http://localhost/assets/index-wN3ZSRu0.js`。
  - 真机截图与 `uiautomator dump` 已确认 `王权骰铸 -> 安装游戏包` 按钮处于可点击态，不再是“直接变灰”的脏状态。

## Requirements Checklist
- [x] 使用中文沟通与文档
- [x] 涉及图片资源时遵循 `docs/ai-rules/asset-pipeline.md`
- [x] 涉及图片驱动录入时遵循 `docs/ai-rules/data-entry.md`
- [x] 涉及审计时先遵循 `docs/ai-rules/testing-audit.md`
- [x] 涉及自动化测试与 E2E 时遵循 `docs/testing-best-practices.md` 与 `docs/automated-testing.md`
- [x] 本次任务需要独立 worktree、OpenSpec、可复刻工作流文档、Vitest、E2E、evidence

## Addendum（2026-03-28）：Dice Throne AI 审计收口
- 本轮 Dice Throne AI 卡死主链路已收口，核心根因确认是 token response 关闭后，只 resolve 交互，没有同步清理 `sys.responseWindow.current`。
- 修复点：`src/games/dicethrone/domain/systems.ts` 在 `TOKEN_RESPONSE_CLOSED` 路径显式清空 `sys.responseWindow.current`，避免领域层已关闭、系统层仍残留响应窗口。
- 同步校正了一条过期回归：Monk 太极在当前 token 规则下，单个响应窗口内只允许合法使用一次；旧的“双太极再 skip”预期不是当前真相。
- 回归测试已改成当前真实行为：
  - `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts` 断言 AI 执行 `['token-response', 'skip-token-response']`
  - 断言 `state.sys.responseWindow?.current` 被清空
  - 断言后续 AI 返回正常 `advance-phase`
- 本轮补齐的 AI 覆盖重点：setup 选角/ready 视角切换、main1 可行动作优先级、defensiveRoll 连续决策、attemptKey 去重、response-play-card 优先级、passive draw-card 优先级、token-response 关闭清理。
- 验证结果：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native --maxWorkers 1` → `26 passed`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/token-response-window.test.ts --configLoader native --maxWorkers 1` → `8 passed`
- 结论：这次 Dice Throne AI 审计暴露的缺口不在单一领域规则，而在“本地 AI 连续决策链 + 响应关闭后的系统态清理 + 过期回归未同步当前 token 规则”三者叠加。

## Research Findings

### 规范与流程
- 根工作区已有并行任务改动，且根目录 `task_plan.md` 正服务其他主题，当前任务必须隔离执行。
- 图片资源运行时禁止直接引用原始 `.png/.jpg`，需要走 `compressed/*.webp` 路径，由项目工具自动映射。
- 图片录入属于“先文档后实现”任务，需要先锁定来源、建立核对契约，再落运行时代码。
- 新的 E2E 必须使用 `e2e/framework` 的 `GameTestContext` API，并将显式证据截图写入 `test-results/evidence-screenshots/_shared/`。
- 用户本轮已明确要求：spec、审计、测试、E2E 全部包含在交付范围内。

### 当前工作区状态
- 新 worktree：`D:\\gongzuo\\webgame\\BoardGame-wt-smashup-base-faction-assets`
- 分支：`feat/smashup-base-faction-assets`
- 基线：`main` 分支提交 `8dc480cd`

### 当前素材核对结论
- 原工作区存在未纳入 `main` 的 Smash Up 中文原图：`public/assets/i18n/zh-CN/smashup/base/aiji_base.png` 与 `public/assets/i18n/zh-CN/smashup/cards/aiji.png`。
- `aiji_base.png` 尺寸为 `4096x1458`，视觉内容与目标四派系基地一致，包含：
  - `Saloon` / `So-So Corral`
  - `Pyramids` / `Star Portal`
  - `Kyuden Konbini` / `Sakura Shigemi`
  - `Drakkar` / `Longhouse`
- 用户已修正 `aiji.png`，当前 worktree 内文件尺寸为 `2914x4096`，内容确认为 `Ancient Egyptians / Cowboys / Samurai / Vikings` 四派系统一卡图。
- `aiji.png` 的真实切片结构为 `7x7` row-major，共 `49` 格：
  - 前 `48` 格是四个派系的卡牌
  - 最后 `1` 格是 `Smash Up` 尾格，不参与卡牌录入
- `aiji_base.png` 的真实切片结构为 `2x4` row-major，共 `8` 张基地。
- 本轮已执行 `npm run compress:images -- public/assets/i18n/zh-CN/smashup`，产物为：
  - `public/assets/i18n/zh-CN/smashup/cards/compressed/aiji.webp`
  - `public/assets/i18n/zh-CN/smashup/base/compressed/aiji_base.webp`

### TTS / 英文资源发现
- `public/assets/atlas-configs/smashup/2833984701.json`（TTS 源数据）中可定位到四个目标派系的 kit：
  - `Ancient Egyptians Kit`
  - `Cowboys Kit`
  - `Samurai Kit`
  - `Vikings Kit`
- 可确认的基地与英文卡堆如下：
  - Ancient Egyptians：`Pyramids`、`Star Portal`
  - Cowboys：`Saloon`、`So-So Corral`
  - Samurai：`Shogun's Palace`、`Sakura Garden`
  - Vikings：`Longhouse`、`Drakkar`
- 四个 faction deck 的 TTS `CustomDeck` 已定位：
  - Ancient Egyptians：deck `79`
  - Cowboys：deck `54`
  - Samurai：deck `55`
  - Vikings：deck `56`
- 这意味着即使中文 cards 原图缺失，仍可先从 TTS / Wiki 锁定派系列表、英文 defId 候选、卡牌数量与基础数据结构。

### 已确认的切片索引与命名差异
- `aiji.png` 的 row-major 顺序按 faction 分块稳定，依次为：
  - Vikings：索引 `0-11`
  - Samurai：索引 `12-23`
  - Ancient Egyptians：索引 `24-35`
  - Cowboys：索引 `36-47`
- `aiji_base.png` 的 row-major 顺序为：
  - `0 Saloon`
  - `1 So-So Corral`
  - `2 Pyramids`
  - `3 Star Portal`
  - `4 Kyuden Konbini`
  - `5 Sakura Shigemi`
  - `6 Drakkar`
  - `7 Longhouse`
- 武士基地存在来源差异：
  - 图片图面英文：`Kyuden Konbini` / `Sakura Shigemi`
  - TTS / Wiki canonical：`Shogun's Palace` / `Sakura Garden`
  - 结论：base def 采用 canonical 英文名与 defId，图面差异必须写入 workflow / evidence 契约。

### Smash Up 专项规则
- 根 `AGENTS.md` 明确要求：Smash Up 的数据录入、数据核对、审计、效果描述查询必须先跑 Wiki 爬虫，不能只凭图片或记忆。
- 因此本次正式录入的权威链路应为：
  - 图片：用于资源文件、atlas 切片、中文图面与索引确认
  - Wiki / 项目爬虫：用于卡牌/基地描述、名称、效果与数据审计

### 本轮实现边界
- OpenSpec `add-smashup-oops-faction-intake` 已将本变更边界定义为：
  - 图片压缩与 atlas 接入
  - faction / cards / bases 静态数据录入
  - locale / UI faction metadata 接入
  - intake 流程文档、证据文档、Vitest、E2E
- 不在本轮内：
  - 四个派系完整 ability handler / ongoing registry / trigger registry 的 gameplay 补完

## Gameplay Proposal Findings

### 用户最新实施要求
- 已明确改为玩法阶段，不再停留在静态录入验收。
- 实施顺序必须是“一个一个派系来”，不能四个派系并行混改。
- 四个派系全部完成后再做统一审计。
- E2E 重点不是再次验证静态图片，而是覆盖本轮新增交互类型。

### 已建立的 gameplay proposal
- OpenSpec change：`add-smashup-oops-faction-gameplay`
- 校验结果：`openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 已通过
- 主要范围：
  - `Ancient Egyptians`：bury、unbury、replacement destination、owner-visible bury UI
  - `Vikings`：bury/discard synergy、buried recovery
  - `Cowboys`：duel、hand-size checks、movement、destroy
  - `Samurai`：honor-based destruction、reactive movement、replacement destination
  - UI：必须端到端支撑 bury source/target、duel target、replacement destination

### 玩法实施顺序裁定
- 第一波：`Ancient Egyptians`
  - 原因：先把 bury 主链路与 UI 做成正式能力，解决已有体系“有领域没 UI”的缺口。
- 第二波：`Vikings`
  - 原因：复用 bury / discard / hidden info 处理，能直接验证第一波设计是否足够通用。
- 第三波：`Cowboys`
  - 原因：决斗和手牌数量判定依赖不同交互模型，应与 bury 稳定后分开调试。
- 第四波：`Samurai`
  - 原因：替代去向与响应移动更偏 after-event / replacement 语义，放在最后更利于集中验证。

### 现有代码事实（对 gameplay 有直接影响）
- bury 领域模型已存在：
  - `src/games/smashup/domain/bury.ts`
  - `src/games/smashup/domain/types.ts`
  - `src/games/smashup/domain/reduce.ts`
  - `src/games/smashup/domain/index.ts`
- `vampires_pod` 已有 bury 先例，但 UI 仍未正式完成：
  - `src/games/smashup/abilities/vampires.ts`
- Smash Up UI 中目前基本没有 bury 渲染入口：
  - `src/games/smashup/ui/BaseZone.tsx` 是后续 bury UI 主要落点之一

### proposal 阶段的关键结论
- intake 与 gameplay 必须分成两个 OpenSpec change，不能混写。
- bury UI 不能再延后到“最后统一补”，否则 Ancient Egyptians 第一波无法算完整实现。
- 新交互类型的 E2E 应围绕“能不能从 UI 完成整条链路”设计，而不是只断言领域状态存在。

## Ancient Egyptians 实施发现

- Ancient Egyptians 的旧 locale 文本与当前 Wiki/Fandom 口径存在系统性偏差，已按当前口径修正 `Mummy / Pyramid Engineer / Priest of Anubis / Pharaoh / Lost Knowledge / You Can Take It With You / Tomb Trap / Seal the Tomb / Plague of Locusts / Mummy Strength / Blessing of Anubis / Ancient Curse / Pyramids / Star Portal`。
- bury 体系仅有“从埋葬翻开并额外打出”的半成品实现，不足以支持 Ancient Egyptians：
  - 需要区分 `onUncover` 与“正常额外打出”
  - 需要支持非法时机翻开 `special` 时直接弃置
  - 需要支持 `CARD_BURIED` 的 `buriedFrom: 'play'` 真正把场上实体移出
- 以 `onCardBuried / onBuriedCardUncovered` 作为通用触发时机后，`base_star_portal` 与 `Pharaoh` 可以直接复用反应队列，不再把 Ancient Egyptians 特判塞进 UI 或 reducer。
- bury UI 现已落在 `src/games/smashup/ui/BaseZone.tsx`：
  - 当前玩家通过 `playerView` 保留真实 `defId`，因此可直接渲染真实卡面
  - 非控制者继续看到 `buried_unknown`，UI 只渲染隐藏占位，不会泄露真实信息

## Vikings 实施发现

- 仓库原有 Vikings locale 与官方 Oops 规则书 / Fandom 口径明显冲突，不能继续当作实现基线；本轮已整体改回官方语义。
- 当前 Vikings 的实现主轴不是 bury，而是 `deck top / discard / steal / extra-action` 联动，核心文本基线为：
  - `Huscarl`：天赋，手牌压回牌库顶，本回合自身 `+2`
  - `Shield Maiden`：展示另一位玩家牌库顶；若为行动或力量 `<= 3` 的随从，则加入你手牌
  - `Raider`：天赋，至多三张手牌压顶，本回合自身每张 `+1`
  - `Valkyrie`：从另一位玩家弃牌堆取一张随从到你手牌
  - `Viking Funeral`：附着力量 `5+` 随从；当其进入弃牌堆时你得 `1 VP`；若你拥有该随从则改为回盒
  - `Ransack / Pillage / Cast the Runes / Raiding Party / Berserk / Tribute / Combat Training`
  - `Drakkar / Longhouse`
- `base_drakkar` 不能走 `CARD_TRANSFERRED` 的同玩家 `deck -> hand` 路径；该 reducer 分支会被相同 key 覆盖。当前已改用 `CARDS_DRAWN`，测试通过。
- 已落地的 Vikings 行为包括：
  - `Huscarl / Shield Maiden / Raider / Valkyrie`
  - `Ransack / Pillage / Cast the Runes / Raiding Party / Berserk / Tribute / Combat Training`
  - `Viking Funeral`
  - `base_drakkar / base_longhouse`
- 仍需在统一收尾阶段重点复核的近似实现点：
  - `Raiding Party` 目前是“先入手再给额外同类打出额度”的近似语义，不是严格的“从揭示区立即打出”
  - `Raiding Party` 未实现“其余牌任意顺序放回牌库顶”的完整交互
  - `Viking Funeral` 目前只有最小覆盖测试，后续统一审计时应补更强回归用例

## Cowboys 实施发现

- 仓库原有 Cowboys locale 与官方 Oops 规则书 / Fandom 口径冲突明显，不能继续沿用；本轮已将 `Deputy / Gunfighter / Pinkerton / Sheriff / Stagecoach / Run 'Em Off / Quick Draw / High Noon / Gold Strike / Gold in Them Thar Hills / Form a Posse / Dynamite Surprise / So-So Corral` 切回官方文本。
- Cowboys 第一轮已落地的玩法主链路包括：
  - `Gunfighter`：打出后在同基地选择敌方随从决斗，并按胜负消灭失败者
  - `High Noon`：先选己方随从再选敌方随从决斗；己方获胜时给予该基地额外随从额度
  - `Run 'Em Off`：决斗后给予胜者 `+3` 临时力量，并把失败者移动到另一基地
  - `Quick Draw`：已实现“普通场景 `+2` / active duel 中 `+4`”两条分支
  - `Gold Strike`：打出到基地后，在你打出随从到这里时抽牌
  - `Sheriff / Saloon / So-So Corral`
- 本轮顺手修掉了 `cowboys.ts` 中两处会制造假阳性的旧逻辑：
  - 额外出牌额度事件误写成 `amount`，现已改回 reducer 约定的 `delta`
  - `Saloon` 曾被错误塞进 duel 结算里直接抽牌；现已只保留官方的 `onMinionDestroyed` 基地触发
- 当前 Cowboys 已切到官方 duel 内核共享实现；已覆盖并验证的链路包括：
  - `Pinkerton`：决斗前为己方决斗随从放置 `+1` 指示物
  - `双方各可选择 1 张 duel card 或跳过`
  - `Deputy`：弃置手牌中的 `Deputy`，再选择一个随从获得直到回合结束 `+2` 力量
  - `destroy_loser / high_noon / run_em_off / vp_to_winner / draw2_to_winner` 等结局分支复用同一 duel 状态机
- Cowboys 决斗链此前还存在一处 UI 文案层的 i18n 断裂：
  - `Board.tsx` 顶部决斗横幅与卡名已经跟随 locale 渲染
  - 但 `src/games/smashup/domain/duel.ts` 的阶段标题、跳过按钮、Pinkerton 数量按钮仍是硬编码中文
  - 同时 `Board.tsx` 里用于手牌/基地/随从直点交互的快捷按钮没有复用 `PromptOverlay` 的 i18n 解析
  - 结果就是英文 locale 下会出现“英文横幅 + 中文交互标题/按钮”的混搭
- 本轮修复后：
  - `PromptOption` 新增 `labelKey / labelParams`
  - `PromptOverlay.tsx` 支持把整句 `ui.xxx` 直接解析成翻译文本
  - `Board.tsx` 的 hand/base/minion 快捷按钮也统一走同一套 label 解析
  - `duel.ts` 的 `Pinkerton / duel card / Deputy / Run 'Em Off` 相关提示全部改成 locale key
  - 复跑 Cowboys 浏览器 E2E 后，决斗横幅、阶段提示与跳过按钮已经统一成同一语言，不再混搭
- 本轮 E2E 还额外暴露并修复了一个真实的 duel 收尾 bug：
  - `smashup_duel_deputy_target` 之前会在弃掉 `Deputy` 后继续用旧状态推进阶段，导致同一玩家再次收到已失效的 `Deputy` 提示
  - 现已改为先模拟 `CARDS_DISCARDED + addTempPower` 再推进下一阶段，浏览器与单测都已验证修复
- Cowboys 当前仍需在后续阶段复核的缺口：
  - `Stagecoach` 的 `move / transfer` 完整语义尚未接入
  - `Dynamite Surprise` 的“对方查看/展示你手牌或牌库时反制消灭”尚未接入
  - `Form a Posse` 目前只有 `+1` 力量，尚未实现“不能被消灭/移动/回手”的完整保护
  - `Gold in Them Thar Hills` 当前仍是“抽到手里 + 给额外额度”的近似实现，不是严格的“立刻额外打出并把余牌任意排序放回”
- `So-So Corral` 已重新按官方口径收敛为“决斗并消灭失败者”；之前基于不完整摘录的“不消灭”判断已确认错误，后续统一审计不得再回退到那套口径。
- 统一审计阶段额外暴露出一个结构性硬错误：`cowboys_stagecoach` 已标注 `abilityTags: ['onPlay']`，但当时没有实际执行器；现已补上最小可运行实现与测试。
- 当前 `Stagecoach` 的明确 MVP 范围是：
  - 先选来源基地
  - 再选同一基地上 `1-2` 个己方随从
  - 最后把它们移动到另一基地
- 当前 `Stagecoach` 仍未覆盖的语义包括：
  - 更完整的 `transfer` 语义
  - 与附着行动牌、基地持续牌、其他联动对象一起搬运时的细粒度行为

## Samurai 实施发现

- 仓库原有 Samurai locale 与官方 Oops 规则书 / Fandom 口径冲突明显，不能继续沿用；本轮已将 `Samurai-Chan / Ronin / Bushi / Shogun / Yokai Attack! / Way of the Warrior / Honorable Combat / Honor the Fallen / Honor the Ancestors / Heart of the Battle / Final Haiku / Code of Bushido / Shogun's Palace / Sakura Garden` 切回官方文本。
- Samurai 第一轮已落地的玩法主链路包括：
  - `Ronin`：当它是你在该基地唯一的己方随从时，可放置两个 `+1` 指示物
  - `Samurai-Chan`：从场上进入弃牌堆后抽一张牌
  - `Bushi`：从场上进入弃牌堆且力量 `>= 5` 时获得 `1 VP`
  - `Shogun`：你另一个随从从场上进入弃牌堆后，在此随从上放置 `+1` 指示物
  - `Yokai Attack!`：消灭你的一个随从，获得额外随从与额外行动额度
  - `Honorable Combat`：两段选择后按 duel MVP 比较力量，胜者控制者获得 `1 VP`
  - `Code of Bushido`：通过三段交互把总计三个 `+1` 指示物分配给你的随从
  - `Honor the Ancestors`：当前第一轮会先给己方随从放置 `+1` 指示物，并按“其他玩家数量上限”自动把弃牌堆中的随从洗回牌库
  - `Way of the Warrior`：当前第一轮已接入对目标随从的 `+3` 临时力量
  - `Final Haiku`：附着随从离场后，当前场上的己方随从都会获得直到回合结束 `+2` 力量
  - `Heart of the Battle`：计分前 special，决斗后消灭失败者
  - `Honor the Fallen`：你此处随从进入弃牌堆后抽牌
  - `base_shoguns_palace / base_sakura_garden`
- 当前 Samurai 仍然只是第一轮实现，不是完整官方语义；统一收尾阶段必须复核以下缺口：
  - 仍未实现官方 duel 的完整 duel-card 内核，当前 `Honorable Combat / Heart of the Battle / Shogun's Palace` 仍使用力量比较型 MVP
  - `Way of the Warrior` 目前只实现了 `+3` 临时力量，尚未接入“本回合进入弃牌堆时抽牌”的正式临时触发语义
  - `Honor the Ancestors` 目前是“按其他玩家数量上限自动取弃牌堆前 N 张随从洗回牌库”的 MVP，尚未接入更精细的玩家选择 / may 语义
  - `Final Haiku` 已接入核心离场加成，但仍需在统一审计阶段复核其与附着目标离场、结算时序、后进场随从的严格官方语义
  - `Sakura Garden` 已覆盖 `onMinionDestroyed / onMinionDiscardedFromBase` 两条入口，但“同回合首次”门控目前仍更偏 destroy 记录，需在统一收尾阶段复核 discard-from-base 路径的去重语义

## 统一审计与 Gameplay E2E 发现

- `abilityBehaviorAudit.test.ts` 默认不会被普通 `vitest` 配置执行；必须使用：
  - `npx vitest run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native`
- 统一审计当前已通过，结果为 `21 passed`；说明四派系第一轮实现至少已经满足现有描述-元数据-注册链路的一致性门槛。
- 新增的三条 gameplay E2E 当前覆盖的是“浏览器层新交互类型能否走通”，不是“所有正式出牌链都已 full-chain 覆盖”。
- 三条 gameplay E2E 的真实覆盖口径如下：
  - `Ancient Egyptians`：验证埋葬条带显示、翻开选择、翻开后弃置与抓牌结算
  - `Cowboys`：验证真实打出 `Gunfighter` 后，浏览器里可以完整走通 `Pinkerton -> 决斗牌 -> Deputy -> 结算`
  - `Samurai`：验证目标点击、己方随从离场，以及额外随从/行动额度兑现
- 其中两条是明确的“交互注入型 E2E”：
  - `Ancient Egyptians` 直接注入 `ancient_egyptians_seal_the_tomb_uncover`
  - `Samurai` 直接注入 `samurai_yokai_attack`
- 因此这两条只能证明：
  - bury / extra-play 这两类新 UI 交互在浏览器中可操作
  - 交互选择后的 reducer/额度/UI 联动能兑现
- 但它们不能替代：
  - `Ancient Egyptians / Samurai` 从手牌正常打出该牌到最终结算的 full-chain E2E
  - Samurai outcome 专项在浏览器中的独立出图证明（当前仍以领域测试为主）

## Visual / Browser Data
- E2E 最初出现“卡图/基地图白板”现象，但不是 atlas 索引错误：
  - 远端 `aiji.webp` / `aiji_base.webp` 可正常下载
  - 页面内 `new Image()` 可拿到正确 `naturalWidth / naturalHeight`
  - 真正根因是 `CardPreview` 以前使用多层 `background-image` 充当 locale fallback，Playwright 截图路径下会把 atlas 渲染成白板
- 已修复为：运行时选择“实际加载成功的单个 URL”作为最终 `backgroundImage`。
- 新 atlas 已上传到 R2，并验证：
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/aiji.webp` → `200`
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/aiji_base.webp` → `200`
- E2E 最终证据截图：
  - `test-results/evidence-screenshots/smashup/smashup-phase-transition-simple.e2e/Oops-四派系在派系选择与注入场景中都能显示资源/oops-faction-selection-visible.png`
  - `test-results/evidence-screenshots/smashup/smashup-phase-transition-simple.e2e/Oops-四派系在派系选择与注入场景中都能显示资源/oops-faction-intake-board.png`

## Technical notes
```text
关键规范：
- AGENTS.md
- openspec/AGENTS.md
- docs/ai-rules/asset-pipeline.md
- docs/ai-rules/data-entry.md
- docs/ai-rules/testing-audit.md
- docs/testing-best-practices.md
- docs/automated-testing.md

关键原图：
- D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\smashup\base\aiji_base.png
- D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\smashup\cards\aiji.png

当前 worktree 压缩产物：
- D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\public\assets\i18n\zh-CN\smashup\base\compressed\aiji_base.webp
- D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\public\assets\i18n\zh-CN\smashup\cards\compressed\aiji.webp

最终 evidence：
- D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\evidence\smashup\smashup-oops-faction-intake-contract.md
- D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\evidence\smashup\smashup-oops-faction-intake-e2e-test.md
- D:\gongzuo\webgame\BoardGame-wt-smashup-base-faction-assets\docs\games\smashup\workflows\smashup-faction-intake.md
```

## 2026-03-31 feedback closeout

### ���޸����������鵵��
- `69c8c039`�������ı����� DiceThrone����ʵ�ʶ�Ӧ SmashUp Samurai ͬʱ�������⣻���� `393b83b3` ���ǡ�
- `69c8c230` / `69c8c419` / `69c8c4f8`��Samurai ���������� `393b83b3` �޸���
- `69c903f3`��AI �Ʒֽ׶� special ���������� `d8ec6aad` �޸���
- `69c92631`����������ѡĹ����Ӻ���ѡ���ش�������� `22713717` �޸���
- `69c92aa4` / `69c92bca`��Ancient Egyptians ǰ���������� `05db8831` �޸���
- `69c92d8d` / `69c9319f`��Ancient Egyptians ʣ������������ `fa9a4c02` �޸���
- `69c92e82`���������������⣬���߼�����ȷ��ȱ�ؼ��ع鸲�ǣ��Ѳ����Բ������޸��鵵��`3dd374b2`����
- `69c93b65`���������� / afterScoring ���ⴰ���쳣������ `4ec96272` �޸���
- `69c942f0`��һĿ��Ȼ vs ɱ����������ȷ���� bug ���� `74d8e513` �޸���

### �ѹر�
- `69c93d98`��֤�ݲ��㣻����ʵ������ػع�δ�����Դ��ڵ����� bug���ȹرա�
- `69c8f2f4`���߸����ѱ������޸����ǣ���ǰ `mobileSupport` ���� zero-height �ع��� Gunslinger `The Law` 1v1/����Ŀ��ѡ��ع��ͨ������ȱ����ʵ�豸/Ŀ�����������ê��ǰ���رչ鵵��

### ����������Ӧ�ύ
- `74d8e513` fix(smashup): respect in plain sight against entangled
- `393b83b3` fix(smashup): tighten samurai trigger regressions
- `4ec96272` fix(smashup): skip pirate king afterscoring window when unplayable
- `fa9a4c02` fix(smashup): cover ancient egyptians tomb trap and seal the tomb
- `22713717` fix(smashup): support dead rise discard-base quick play
- `3dd374b2` fix(smashup): cover drakkar reshuffle handoff
- `05db8831` fix(smashup): close ancient egyptians feedback regressions
- `d8ec6aad` fix(smashup): resolve open feedback regressions

## Addendum（2026-04-23）：Home V2 视觉统一二次收口
- 底部黑边根因并非单一背景图，而是“书本舞台 + 认证区输入自动聚焦”叠加引发的视觉漂移：进入登录页签后自动焦点会触发视口滚动感，截图呈现出上沿被吃与底部暗带放大。
- 目录卡“变平”的根因是 `homeV2Compact` 仍混用 `background-image: 100% 100%`，与九宫格实现不一致；改为统一 `border-image` 后，边框细节恢复且与书页材质一致。
- 左页网格“第六张偏低”风险通过固定 `6` 槽位骨架 + 双排布局约束收敛，E2E 量测 `rowDelta=3.99`（阈值 < 10）通过。
- 登录右页改为同材质框体（九宫格）并取消 embedded 自动聚焦，避免“外来弹窗感”和顶端被裁切。
- 创建房间弹窗改为按 `--runtime-viewport-height` 计算最大高度，叠加 `overscroll-contain`，在 `936x432` 下保持按钮首屏可见。

## Addendum（2026-04-26）：Home V2 首页参考稿重构（首页先行）
- 参考稿首页的核心变化不是“把 6 张卡摆得更好看”，而是信息架构从“单页宫格”切成“顶部分类 + 双页目录列表”；这决定了首页应优先重做目录排版，而不是先微调旧宫格间距。
- 当前工作树里的 `HomeV2.tsx` 已经改成优先消费 `overview_spread_body` 槽位，这意味着首页目录最正确的切入点是 spread 级内容组件，而不是继续在 `overview_left_page` / `overview_right_page` 上拼补丁。
- 用户给的 `background.png` 是整张书页底图（含桌面/书壳），更适合在下一阶段作为首页 overview 背景统一接管；若直接塞进当前 896x720 书本壳而不调整舞台比例，容易出现裁切或留黑边。
- 因此本轮先保留旧舞台素材与书签链路，把目录结构先切到参考稿方向；等首页目录稳定后，再处理背景底图与翻页表现，风险更可控。
- 后续实测证明“参考图减背景图”的差分抠图路线不可用：即使静态查看 `overview-homepage/1.png` 看似正常，浏览器里仍会透出大量透明孔洞，Playwright 截图会出现成片斑驳。
- 根因不是热点层，也不是 WebP 单独压缩问题，而是差分产物本身仍残留大量透明区域；因此要达成“和参考图一模一样”，首页正确方案不是继续抠图，而是直接把 `首页.png` 当成成品图渲染。
- `936x432` 横屏视口比参考图 `1152x768` 更宽；若强行 cover 会裁掉上下导航与页边，因此最终采用“参考图原图直出 + 两侧暗场留边”的策略，保证书页主体一像素不裁切。
- 但用户随后明确指出“要前端可用的移动端横屏 UI”，这意味着“整张截图直出 + 透明热点”仍然不符合需求：视觉虽像，但不是实际前端界面。
- 因此首页最终正确路线被再次收敛为：`background.png` 只做书页底图；顶部分类、右上角账号入口、六个游戏条目全部重新用 DOM 排版。这样既保留参考稿结构，也保留真实交互与后续可演进空间。


## Addendum（2026-04-27）：Home V2 真实移动端分辨率口径
- 用户已明确指出“不要偷懒，要真实移动端分辨率”，因此首页主验收口径不能继续停留在 `936x432` 代理视口；后续首页默认验收应切到 `2388x1080`。
- `e2e/lobby.e2e.ts` 中 Home V2 查询入口用例已把默认横屏视口改成 `2388x1080`，避免新会话误回到代理口径。
- 切到 `2388x1080` 后，书页舞台量测为 `widthRatio=0.798 / heightRatio=0.993 / center=(0.500,0.500)`，说明书页主体已经按真分辨率稳定居中，不存在“缩在左上角”。
- 真分辨率下比小视口更容易暴露的问题是：顶部导航节奏、右上角入口太小、条目纵向节奏偏散；因此后续精修应优先看 `2388x1080` 图，而不是再盯 `936x432`。
- 由于共享 single-worker 固定端口 `6273/20100/21100` 被其他任务占用，本轮首页 E2E 最终改用 `PW_E2E_SERVICE_REUSE=shared-single + 37974/30180/30181` 完成验证；下个会话若再次遇到端口冲突，可直接沿用这组共享端口方案。
