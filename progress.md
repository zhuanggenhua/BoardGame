## Session: 2026-04-28 Home V2 详情页 + 翻页效果完全重构（起步）
- **Status:** in_progress
- Actions taken:
  - 继续在 `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2` / `feat/homepage-v2` 内推进，不切新 worktree。
  - 已重新锁定 `D:\gongzuo\webgame\gameasset\v2首页参考` 下的参考素材，并转存到当前 agent 工作区 `out/homev2-reference/ref-01..07.png` 便于后续直接比对。
  - 已复读 `docs/mobile-adaptation.md` 与 `docs/ai-rules/ui-ux.md`，确认这轮详情页/翻页重构必须保持“移动端只条件化收敛，不影响桌面端默认视觉基线”。
  - 已复核当前 Home V2 实现差距：首页 `overview` 已切到独立 spread 渲染；但 `detail` 与翻页仍主要依赖旧 `book-idle` 壳和通用左右翻页序列，属于“首页新稿 + 后续旧稿”混合态。
  - 已把“详情页 + 翻页效果完全重构（参考图一致）”追加到 `task_plan.md / findings.md`，作为当前主任务新阶段。
  - 已在 `src/pages/HomeV2.tsx` 落第一版结构性修复：把 `detail` 状态从旧场景壳里拆出来，改成与首页同类的 **exact spread** 渲染路径；现在首页 `overview` 与详情 `detail` 都是独立按比例 fit 的固定构图舞台，只有中间态继续走翻页动画壳。
  - 详情页现已直接使用 `book-idle/1.png` 作为 detail spread 背景，并把左右页内容和书签点击热点按 artboard 百分比重新定位，避免详情态继续完全依赖旧 scene slot 壳层。
  - 已跑门禁：`npx eslint src/pages/HomeV2.tsx src/components/home-v2/GameDetails.tsx src/components/home-v2/LobbyDirectory.tsx` 通过（仅保留 `LobbyDirectory.tsx` 既有 fast-refresh warning）；`npm run typecheck` 通过；首页→详情 E2E `homeV2Draft 查询参数会切到 V2 首页并可进入详情页` 通过。
### Next
- 再补翻页中间态与详情态之间的统一感，必要时追加 detail 专用背景资源，而不是长期停在 `book-idle` 过渡资产。
- 继续收右页房间账本的版式细节，向参考稿的“表册/账页感”推进，而不只是可用列表。

## Session: 2026-04-28 Home V2 detail 左页视觉收敛
- **Status:** in_progress
- Actions taken:
  - 已将 `src/components/home-v2/GameDetails.tsx` 左页从“轻量标题 + 两个小 tag + 一段摘要”改成更接近参考稿的编辑式书页：上方小号类别眉题、大号标题、密集 badge 带、正文段落与信息卡分层。
  - 同步把右页标题区收成“上小下大”的书页标题结构，避免右页继续像普通卡片列表标题。
  - 已复跑 `npm run typecheck` 通过；首页→详情 E2E `homeV2Draft 查询参数会切到 V2 首页并可进入详情页` 再次通过，首页居中与网格基线未回归。
- Next:
  - 继续把右页房间列表本体向“账本页”质感推进。
  - 如有必要，补 detail 专用背景资源，减少当前对 `book-idle` 的过渡依赖。

## Session: 2026-04-28 Home V2 首页缩略图退步修复（2388x1080）
- **Status:** completed
- Actions taken:
  - 继续在 `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2` / `feat/homepage-v2` 内处理首页，不切分支、不换 worktree。
  - 定位当前首页退步：`LobbyDirectory` 只按 `thumbnailPath` 渲染，导致 `tictactoe` 没复用注册缩略图；`splendor/picture` 真实压缩资源缺失，导致条目变白块。
  - 修改 `src/components/home-v2/LobbyDirectory.tsx`：无 `thumbnailPath` 或图片加载失败时，优先回退到项目注册表里的 `game.thumbnail`。
  - 补齐 `public/assets/i18n/zh-CN/splendor/compressed/picture.webp`，恢复 `splendor` manifest 缩略图路径的实际资源。
  - 复跑首页 E2E，并重新查看 `homepage-catalog.png` / `detail-entry.png`，确认首页右页两张回归缩略图都已恢复显示，且首页进详情链路未断。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/home-v2/LobbyDirectory.tsx` | 0 error | 0 error，1 warning（既有 fast-refresh warning） | ✅ |
| E2E-首页目录链路 | `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 2388x1080 真横屏下目录缩略图恢复显示，首页仍可进入详情页 | 通过；日志 `width=2388 height=1080`、`center=(0.500,0.500)`、`rowDelta=(0.00,0.00,0.00)` | ✅ |

## Session: 2026-04-28 Home V2 首页参考图终态收口（2388x1080）
- **Status:** completed
- Actions taken:
  - 继续在 `D:\\gongzuo\\webgame\\BoardGame\\.worktrees\\homepage-v2` / `feat/homepage-v2` 内推进首页，不切分支、不换 worktree。
  - `src/components/home-v2/LobbyDirectory.tsx` 再次收首页目录页布局：上移并放大首页 6 条目录项，继续把标题、摘要、badge、人数字号与参考图对齐。
  - 补齐首页 badge 的参考稿风格：用手工 curated badge 组合替代重复标签，`cardia / splendor / summonerwars` 等条目不再出现“同义重复 badge”。
  - 继续微调右上角账号 / 概述入口的 rect、图标尺寸、字重与底色，使其更接近参考稿位置和视觉权重。
  - 继续放大 `splendor / summonerwars` 缩略图裁切，进一步吃掉底部浅色边和偏移感。
  - 复跑首页专用 E2E，并重新查看 `homepage-catalog.png`，确认首页仍是前端真实 DOM，且目录内容完整落在书页内。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/home-v2/LobbyDirectory.tsx` | 0 error | 0 error，1 warning（既有 fast-refresh warning） | ✅ |
| E2E-首页目录链路 | `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 2388x1080 真横屏下首页目录、账号入口切 rooms、返回 lobby、进入井字棋详情全部通过 | 通过；日志 `width=2388 height=1080`、`center=(0.500,0.500)`、`rowDelta=(0.00,0.00,0.00)` | ✅ |

## Session: 2026-04-07 Android 本地素材包图片加载故障
- **Status:** in_progress
- Actions taken:
  - 复核 `GamePackagePlugin` / `GamePackageForegroundRuntime` / `packageManagerService` / `AssetLoader` / `OptimizedImage` 链路，确认原生素材包会安装到 `.../current/assets`，问题不在下载落盘本身。
  - 修复 `src/features/mobile-packages/packageManagerService.ts`：`hydrateInstalledNativeGamePackages()` 在没有预注册 `fallbackCache` 时也会构造兜底 state，确保已安装包仍能把 `assetBaseUrl` 注入到 AssetLoader override。
  - 修复 `src/components/common/media/OptimizedImage.tsx`：开发态 `fetch -> blob` workaround 只保留给 public `/assets/...`，Android `/_capacitor_file_/...` 本地包路径改为直接 `<img>` 加载。
  - 修复 `src/features/mobile-packages/nativeGamePackagePlugin.ts`：原生 ack / listener 返回 `running/completed/cancelled` 时先归一化为前端合法状态，避免 `易桌游测试` 把下载按钮直接污染成灰态。
  - 补回归测试：`src/components/common/media/__tests__/CardPreview.i18n.test.tsx` 与 `src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts`。
  - 将包含修复的 `dist/` 覆盖到真机 `top.easyboardgame.app.debug` 当前 OTA 目录 `/data/user/0/top.easyboardgame.app.debug/files/versions/mhvPgIYOyN`，重启后确认加载新 bundle `index-wN3ZSRu0.js`。
  - 真机打开 `王权骰铸` 详情弹窗后，`安装游戏包` 按钮已恢复为可点击态；截图路径：`D:\\gongzuo\\webgame\\BoardGame\\temp\\mobile-debug\\dicethrone-modal-after-open.png`。

## Session: 2026-04-26 Home V2 首页参考图重构（首页起步）
- **Status:** completed
- Actions taken:
  - 在 `D:\\gongzuo\\webgame\\BoardGame\\.worktrees\\homepage-v2` 确认当前分支仍为 `feat/homepage-v2`，继续在该工作树推进。
  - 先同步版本号：`package.json` / `package-lock.json` 已更新到 `0.5.61`。
  - 对照 `D:\\gongzuo\\webgame\\gameasset\\v2首页参考\\首页.png`、`总览首页.png`、`background.png` 与当前 HomeV2 截图，确认首页应从“九宫格卡片目录”切到“顶部分类导航 + 双页信息流列表”。
  - `src/components/home-v2/LobbyDirectory.tsx` 已改为“顶部分类导航 + 右上角账号入口 + 双列目录列表”，并为 `splendor` 缺失缩略图补了钻石 icon fallback。
  - `src/pages/HomeV2.tsx` 继续复用原翻页状态机，但首页只走 `overview_spread_body`；`src/components/system/GlobalHUD.tsx` 对 `/?homeV2Draft=1` 与预览路由隐藏全局悬浮齿轮，避免参考图首页被额外浮层污染。
  - `e2e/lobby.e2e.ts` 收束为“首页目录验收 + 账号入口切到 rooms + 返回 lobby 后进入井字棋详情”的最小链路，移除与本轮首页无关的 rooms 表单模式切换断言。
  - 第二轮视觉压缩继续把首页往参考图收口：放大顶部分类/标题/摘要/人数字号，收紧 badge 样式，首页舞台放大到更贴近 `936x432` 横屏满高展示。
  - 新增 `public/assets/common/images/home-v2/catalog-thumbnails/`，从用户提供的 `首页.png` 裁出 `splendor` / `summonerwars` 局部缩略图并压成 WebP，只作为条目缩略图素材使用，不把整页截图重新塞回首页。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/system/GlobalHUD.tsx e2e/lobby.e2e.ts` | 0 error | 0 error | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| i18n 校验 | `npm run i18n:check` | 无缺失 key | `no missing keys detected` | ✅ |
| E2E-首页链路 | `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 首页目录、rooms 切换、返回 lobby、进入井字棋详情全部通过 | 通过；首页量测 `columns=292.45,640.52`、`rowDelta=(0.00,0.00,0.00)`、`widthRatio=0.805`、`heightRatio=0.981` | ✅ |

## Session: 2026-04-23 Home V2 认证区彻底重构（无真机）
- **Status:** completed
- Actions taken:
  - `src/components/home-v2/HomeTabPanels.tsx` 移除 `AuthModal` 依赖，重写 `HomeV2AuthFormPanel` 为页面原生认证块（登录/注册/重置三态）。
  - 认证区改为统一九宫格 frame（`border-image`），不再使用 modal 外壳视觉。
  - 保留并兼容现有 E2E 选择器（`auth-embedded-panel`、`auth-login-account-input`、`auth-register-send-code` 等），避免流程断言失效。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/home-v2/HomeTabPanels.tsx` | 0 error | 0 error | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| i18n 校验 | `npm run i18n:check` | 无缺失 key | `no missing keys detected` | ✅ |
| E2E-建房主链路 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过 | 通过 | ✅ |
| E2E-密码入房 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 详情页输入房间密码后可加入加密房间"` | 通过 | 通过 | ✅ |

## Session: 2026-04-23 Home V2 黑边回归修复
- **Status:** completed
- Actions taken:
  - 定位到底边突兀感来自两部分叠加：书本素材黑底留边 + HomeV2 背景暗部过重。
  - `src/pages/HomeV2.tsx` / `src/pages/HomeV2Draft.tsx`：背景桌面图固定 `object-cover object-top`，并降低全屏暗化层强度；手机横屏展示比例调整为 `scale=1.62`、`offsetYPct=14`。
  - `src/ugc/runtime/ui-scene/scenes/homeV2BookScene.ts`：书本主序列节点统一 `fit: 'cover'`（裁掉黑底留边，避免黑框进入可视区）。
  - `e2e/lobby.e2e.ts`：增加 Home V2 桌面背景 `objectFit/objectPosition` 校验，防止样式回退。
  - `evidence/_shared/home-v2-query-entry-e2e-test.md`：补充“禁止纯黑底边带、允许低对比桌面暗部”的验收条款。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| E2E-建房主链路 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过 | 通过 | ✅ |

## Session: 2026-04-22 Home V2 终态收口（三次）
- **Status:** in_progress
- Actions taken:
  - 目录两排对齐修复复核：`LobbyDirectory` 改为按列统一变换，`GameList` 标题高度收敛，消除第六张卡下沉。
  - 登录页改为右页内联认证（不再弹窗）：`HomeV2/HomeV2Draft/HomeTabPanels/AuthModal` 已同步。
  - 重跑两条核心 E2E 并复看关键截图，确认“建房进局 + 密码入房”链路仍可用。
  - 回写证据文档：`evidence/_shared/home-v2-query-entry-e2e-test.md` 已改成“右页内联认证 + 网格基线量测”口径。
  - 重新打包 Android debug APK：`android/app/build/outputs/apk/debug/easyboardgame-debug.apk`。
  - 安装阻塞确认：`adb -s 10ADAU063C0010U install -r ...` 返回 `device not found`，当前未完成用户手机安装。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/home-v2/LobbyDirectory.tsx src/components/lobby/GameList.tsx src/components/home-v2/HomeTabPanels.tsx src/components/auth/AuthModal.tsx src/pages/HomeV2.tsx src/pages/HomeV2Draft.tsx src/ugc/runtime/ui-scene/prefabs.tsx e2e/lobby.e2e.ts` | 0 error | 0 error，3 warning（既有） | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| i18n 校验 | `npm run i18n:check` | 无缺失 key | `no missing keys detected` | ✅ |
| E2E-建房进局 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过 | 通过，网格量测 `rowDelta=(0.51,0.51)`、`colGapDelta=0.00` | ✅ |
| E2E-密码入房 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 详情页输入房间密码后可加入加密房间"` | 通过 | 通过 | ✅ |
| Android 打包 | `npm run mobile:android:build:debug` | 成功产出 APK | 成功 | ✅ |
| Android 安装 | `adb -s 10ADAU063C0010U install -r ...easyboardgame-debug.apk` | 成功 | `device not found` | ⚠️ |

### 当前阻塞
| Timestamp | Blocker | Impact | Next Step |
|-----------|---------|--------|-----------|
| 2026-04-22 22:47 | 用户手机序列号 `10ADAU063C0010U` 不在线 | APK 无法安装到目标手机，真机复核暂停 | 待设备重新连接后立刻重跑 `adb install -r` 并补最新真机截图 |

## Session: 2026-04-22 Home V2 细节二次收口（字/对齐/弹窗）
- **Status:** completed
- Actions taken:
  - 书签字下调：`src/ugc/runtime/ui-scene/prefabs.tsx` 从 `12px` 调整为 `11px`。
  - 书本整体上移：`src/ugc/runtime/ui-scene/scenes/homeV2BookScene.ts` 中 `offsetYPct` 从 `1` 调整到 `-0.8`。
  - 手机横屏缩放收敛：`HomeV2/HomeV2Draft` 中 `HOME_V2_PHONE_PRESENTATION_SCALE 1.42 -> 1.28`，`wideLandscapeShellScale 1.18 -> 1.14`。
  - 详情页按钮与 tag 收敛：`src/components/home-v2/GameDetails.tsx` 缩小 `tiny/compact` 按钮尺寸、缩小 meta/操作 tag，并降低“创建房间”按钮最大宽度。
  - 修复建房弹窗超视口：`src/components/lobby/CreateRoomModal.tsx` 改为 `createPortal(..., document.body)`，并加可视区高度约束与安全区内边距。
  - `e2e/lobby.e2e.ts` 增加建房弹窗可视区断言（`top >= 4` 且 `bottom <= viewportHeight - 4`）。
  - 重新打包并安装 Android debug 到用户设备 `10ADAU063C0010U`。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/ugc/runtime/ui-scene/prefabs.tsx src/ugc/runtime/ui-scene/scenes/homeV2BookScene.ts src/pages/HomeV2.tsx src/pages/HomeV2Draft.tsx src/components/home-v2/GameDetails.tsx src/components/lobby/CreateRoomModal.tsx e2e/lobby.e2e.ts` | 0 error | 0 error（CreateRoomModal 既有 warning） | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| i18n 校验 | `npm run i18n:check` | 无缺失 key | `no missing keys detected` | ✅ |
| E2E-首页到详情到建房 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过 | 通过；弹窗量测 `top=25.25/bottom=419.83/viewport=432` | ✅ |
| E2E-密码入房 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 详情页输入房间密码后可加入加密房间"` | 通过 | 通过 | ✅ |
| Android 打包 | `npm run mobile:android:build:debug` | 成功产出 APK | 成功 | ✅ |
| Android 安装 | `adb -s 10ADAU063C0010U install -r ...easyboardgame-debug.apk` | 成功 | `Success` | ✅ |

## Session: 2026-04-22 Home V2 登录/详情 UI 收敛
- **Status:** completed
- Actions taken:
  - `AuthModal` 增加 `placement`，HomeV2 登录入口改为右侧弹窗（不再居中压书页）。
  - 详情页左侧类型/人数 tag 改为单行小标签；右侧房间操作 tag 与座位信息同行右对齐。
  - `e2e/lobby.e2e.ts` 新增回归断言：登录弹窗中心点在右半屏、详情 tag 单行且尺寸收敛。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/common/overlays/ModalBase.tsx src/components/auth/AuthModal.tsx src/components/home-v2/HomeTabPanels.tsx src/components/home-v2/GameDetails.tsx e2e/lobby.e2e.ts` | 0 error | 0 error | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| i18n 校验 | `npm run i18n:check` | 无缺失 key | `no missing keys detected` | ✅ |
| E2E-查询入口链路 | `BG_HOME_V2_VIEWPORT=2388x1080 ... npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过 | 通过 | ✅ |
| E2E-加密房加入 | `BG_HOME_V2_VIEWPORT=2388x1080 ... npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 详情页输入房间密码后可加入加密房间"` | 通过 | 通过 | ✅ |

## Session: 2026-04-21 Home V2 手机端端到端修复
- **Status:** completed
- Actions taken:
  - 已完成 Home V2 手机横屏固定口径缩放修正：`HomeV2/HomeV2Draft` 在 `<=1100x520` 视口下使用 `presentationOverride.scaleMultiplier=1.2`，避免页面过小。
  - 已修复登录页重复信息与重复背景：标题保留“登录”，去掉外层额外背景框，登录/注册按钮保留素材边框。
  - 已修复详情页“房间显示不全”与“tag风格不一致”：房间卡改为纵向信息流，返回目录与 tag 全部切为素材边框。
  - 已修复密码输入“显示不全”：输入框字号/内边距收敛，占位文案改为 `输入密码`（英文 `Password`）。
  - 已打包并安装 Android debug 包：`android/app/build/outputs/apk/debug/easyboardgame-debug.apk`。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/pages/HomeV2.tsx src/pages/HomeV2Draft.tsx src/components/home-v2/GameDetails.tsx src/components/lobby/CreateRoomModal.tsx src/lib/homeV2Routing.ts src/components/home-v2/HomeTabPanels.tsx src/ugc/runtime/ui-scene/UISceneRenderer.tsx src/ugc/runtime/ui-scene/HomeSceneRenderer.tsx e2e/lobby.e2e.ts` | 0 error | 0 error（CreateRoomModal 既有 5 warning） | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| i18n 校验 | `npm run i18n:check` | 无缺失 | `no missing keys detected` | ✅ |
| E2E-建房链路 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过 | 通过 | ✅ |
| E2E-密码入房 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 详情页输入房间密码后可加入加密房间"` | 通过 | 通过 | ✅ |
| Android 打包 | `npm run mobile:android:build:debug` | 成功产出 APK | 成功 | ✅ |
| Android 安装 | `adb -s 10ADAU063C0010U install -r ...easyboardgame-debug.apk` | 成功 | 通过（Success） | ✅ |
| 真机复核截图 | `adb screencap + adb pull` | 首页/详情/建房弹窗整图齐全 | 已补齐（3 张） | ✅ |

### 当前阻塞
| Timestamp | Blocker | Impact | Next Step |
|-----------|---------|--------|-----------|
| 2026-04-21 23:35（已解除） | 初次安装曾被设备侧权限拦截（`INSTALL_FAILED_ABORTED`） | 一度阻塞真机闭环 | 已重试安装成功并补齐真机截图，当前无阻塞 |

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/features/mobile-packages/packageManagerService.ts src/components/common/media/OptimizedImage.tsx src/components/common/media/__tests__/CardPreview.i18n.test.tsx src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts` | 0 error | 0 error，`OptimizedImage.tsx` 有 1 条 `react-refresh/only-export-components` warning | ✅ |
| 图片链路回归 | `node scripts/infra/vitest-cli-safe.mjs run src/components/common/media/__tests__/CardPreview.i18n.test.tsx --configLoader native --maxWorkers 1` | 通过 | `8 passed` | ✅ |
| 启动期 hydration 回归 | `node scripts/infra/vitest-cli-safe.mjs run src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts -t "mobile package bootstrap hydration" --configLoader native --maxWorkers 1` | 通过 | `1 passed, 54 skipped` | ✅ |

### Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-04-07 | 启动期已安装游戏包在未注册 `fallbackCache` 时被直接跳过，资源 override 未生效 | 1 | `hydrateInstalledNativeGamePackages()` 对缺失 fallback 的游戏构造兜底 state 后继续 emit/apply override |
| 2026-04-07 | `OptimizedImage` 把 Android `/_capacitor_file_/...` 本地包路径误走开发态 fetch/blob workaround，图片停在加载态 | 1 | 将 workaround 收窄为“仅开发态 public `/assets/...`”，本地包路径直接 `<img>` 加载 |
| 2026-04-07 | 原生首次 ack 返回 `running`，旧前端把非法状态直接写进安装状态，导致下载按钮提前灰死 | 1 | `nativeGamePackagePlugin.ts` 归一化原生状态后再写入前端缓存，并已用真机新 bundle 确认按钮恢复可点 |

## Session: 2026-03-28 Dice Throne AI 审计收口
- **Status:** completed
- Actions taken:
  - 复核 `src/games/dicethrone/ai.ts`、`domain/executeTokens.ts`、`domain/commandValidation.ts`、`domain/tokenResponse.ts`，确认 Monk 太极当前规则是“单响应窗口最多 1 次合法使用”。
  - 修复 `src/games/dicethrone/domain/systems.ts` 中 `TOKEN_RESPONSE_CLOSED` 未同步清空 `sys.responseWindow.current` 的状态残留问题。
  - 更新 `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts` 中的太极回归，使其断言当前真实行为：单次 token 响应后 `skip-token-response`，并在关闭窗口后恢复正常推进。
  - 继续强化太极回归，补断言验证 `skip-token-response` 后 `sys.interaction.current` 也被清空，且操作权仍回到玩家 `0`，下一拍继续返回 `advance-phase`。
  - 同型扫描 `ResponseWindowSystem` 后，补了一条锁定语义回归到 `src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts`：交互创建并锁定响应窗口期间，`RESPONSE_PASS` 必须失败，且不得提前清掉 `sys.interaction.current` / `pendingInteractionId`。
  - 复跑 Dice Throne AI 关键回归，确认本地 AI 不再在太极响应链路上卡死。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| AI 基础命令覆盖 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native --maxWorkers 1` | 全部通过，且太极链路按当前规则关闭窗口并恢复推进 | `26 passed` | ✅ |
| Token 响应窗口回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/token-response-window.test.ts --configLoader native --maxWorkers 1` | 响应窗口开闭与交接链路稳定 | `8 passed` | ✅ |
| 响应窗口锁定回归 | `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts --configLoader native --maxWorkers 1` | 交互锁定期间 `RESPONSE_PASS` 被拒绝，现有锁定/取消链路保持通过 | `7 passed` | ✅ |

### Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-03-28 | 太极响应结束后 AI 仍看到残留 response window，继续跑出 `response-pass` | 1 | 在 `TOKEN_RESPONSE_CLOSED` 路径同步清空 `sys.responseWindow.current` |
| 2026-03-28 | 旧回归仍期待“双太极再 skip”，与当前 token 规则不符 | 1 | 按当前 `getMaxTokenUseAmount` / `tokenUsageTotals` 真相改写测试，断言单次 token 后直接 `skip-token-response` |

# Progress Log

## Session: 2026-03-28

### Phase: 初始化
**Status**: Complete

- **[10:00] Action**: 检查根工作区、规划文件占用情况与相关规范
  - Result: 确认根工作区存在并行任务，且 `task_plan.md/findings.md/progress.md` 已服务其他主题；已读取资产、录入、审计、测试、OpenSpec 规范
  - Next: 创建独立 worktree 并初始化本任务规划文件

- **[10:05] Action**: 创建独立 worktree 与分支 `feat/smashup-base-faction-assets`
  - Result: 新工作目录 `D:\\gongzuo\\webgame\\BoardGame-wt-smashup-base-faction-assets` 已创建，工作区干净
  - Next: 盘点现有 Smash Up 图片接入链路和目标素材清单

### Phase: 发现与设计
**Status**: Complete

- **[10:08] Action**: 初始化 `task_plan.md`、`findings.md`、`progress.md`
  - Result: 本任务已建立独立的磁盘规划上下文，后续发现与验证可持续追加
  - Next: 扫描 `public/assets`、现有 Smash Up faction 资源与相关代码/脚本

- **[10:22] Action**: 核对原工作区 Smash Up 新原图与现有压缩产物
  - Result: `aiji_base.png` 与目标四派系基地匹配，但 `aiji.png` 实际是 Pretty Pretty 四派系卡图；旧 `cards5.webp` / `base4.webp` 不是本次目标内容
  - Next: 用 TTS / Wiki 源数据锁定四派系的正式卡牌与基地清单，判断中文 cards 原图缺口是否阻塞实现

- **[10:28] Action**: 解析 TTS 源数据 `2833984701.json`
  - Result: 已确认 Ancient Egyptians / Cowboys / Samurai / Vikings 四个 kit 均存在，且能提取对应 bases / deck / titan / CustomDeck 信息
  - Next: 按 Smash Up 专项规范运行 Wiki 爬虫，建立本次录入契约与 spec 范围

- **[10:40] Action**: 起草并校验 OpenSpec change `add-smashup-oops-faction-intake`
  - Result: `proposal.md` / `tasks.md` / `design.md` / spec delta 已创建，`openspec validate add-smashup-oops-faction-intake --strict --no-interactive` 通过
  - Next: 向用户确认 cards 原图来源；确认后再进入 apply 阶段

### Phase: 资产处理与录入
**Status**: Complete

- **[10:48] Action**: 用户修正并确认 `aiji.png` 为正确图片
  - Result: 当前 worktree 中 `public/assets/i18n/zh-CN/smashup/cards/aiji.png` 已变为 Oops, You Did It Again 四派系卡图
  - Next: 重新核定 atlas 网格、切片顺序与卡牌索引

- **[10:54] Action**: 直接查看并核对 `aiji.png` 与 `aiji_base.png`
  - Result: 已确认 `aiji.png` 为 `7x7` row-major（48 卡 + 1 尾格），`aiji_base.png` 为 `2x4` row-major（8 基地）
  - Next: 以该索引顺序生成 faction/base/card 接入清单

- **[10:58] Action**: 压缩 Smash Up 新原图
  - Result: 已生成 `cards/compressed/aiji.webp` 与 `base/compressed/aiji_base.webp`
  - Next: 在 atlasCatalog / ids / static defs 中接入新 atlas

- **[11:05] Action**: 复核 TTS `2833984701.json` 的四个目标 kit
  - Result: 已确认四派系的英文卡名、卡牌数量与基地清单，足以作为 defId / count / canonical base name 的英文来源
  - Next: 补 Wiki 抓取映射并开始正式录入

- **[11:40] Action**: 完成 Oops 四派系静态接入
  - Result: 已补 `ids.ts`、`atlasCatalog.ts`、4 个 faction 文件、8 个 base def、locale、`factionMeta.ts`，并修复 `registerPodBaseSkeletons()` 对非 POD 派系误生成 `_pod` 基地的问题
  - Next: 跑 Vitest / typecheck / E2E 并处理截图异常

### Phase: 审计与验证
**Status**: Complete

- **[12:00] Action**: 运行 Vitest、typecheck 与 OpenSpec 校验
  - Result: `CardPreview.i18n`、`criticalImageResolver`、`factionSelection`、`cardI18nIntegrity`、`typecheck`、`openspec validate` 全部通过
  - Next: 完成 E2E 证据与上传验证

- **[12:10] Action**: 排查 E2E 白板问题
  - Result: 确认根因不是 atlas 索引，而是 `AtlasCard` 用多层 `background-image` 充当 fallback，导致 Playwright 证据截图里 atlas 呈现白板
  - Next: 修复渲染策略并复跑 E2E

- **[12:25] Action**: 上传新 atlas 到 R2 并修复 `AtlasCard` 渲染策略
  - Result: `aiji.webp` 与 `aiji_base.webp` 已上传到 `official/i18n/zh-CN/smashup/...`，`HEAD` 均为 `200`；`AtlasCard` 已改为选择单个已加载成功的 URL 作为最终背景图
  - Next: 复跑 E2E 并留证

- **[12:35] Action**: 复跑 intake E2E 并自审截图
  - Result: `Oops 四派系在派系选择与注入场景中都能显示资源` 已通过，派系选择与棋盘截图均显示真实卡图/基地图
  - Next: 补 workflow / evidence 文档并回填计划文件

- **[12:50] Action**: 沉淀 workflow / contract / E2E evidence 文档
  - Result: 已新增 `docs/games/smashup/workflows/smashup-faction-intake.md`、`evidence/smashup/smashup-oops-faction-intake-contract.md`、`evidence/smashup/smashup-oops-faction-intake-e2e-test.md`
  - Next: 整理最终交付摘要

### Phase: gameplay proposal
**Status**: In Progress

- **[13:42] Action**: 为玩法补完创建 OpenSpec change `add-smashup-oops-faction-gameplay`
  - Result: `proposal.md` / `design.md` / `tasks.md` / spec delta 已落盘，范围明确为四派系正式玩法、新交互类型 UI、统一审计与 E2E
  - Next: 结合用户最新指令确认实施顺序与阶段边界

- **[13:47] Action**: 根据用户要求收敛实施顺序与收尾方式
  - Result: 已明确“一个一个派系实施，全部完成后再统一审计，然后端到端测新交互类型”；Gameplay 波次固定为 `Ancient Egyptians → Vikings → Cowboys → Samurai`
  - Next: 运行 OpenSpec 严格校验并回填 planning 文件

- **[13:49] Action**: 运行 `openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive`
  - Result: 校验通过，proposal 进入可评审状态
  - Next: 更新 `task_plan.md / findings.md / progress.md`，准备向用户汇报 proposal 核心范围与第一波实施入口

### Phase: Ancient Egyptians implementation
**Status**: In Progress

- **[14:10] Action**: 实现 Ancient Egyptians 的埋葬/翻开主链路与专属能力
  - Result: 已新增 `src/games/smashup/abilities/ancient_egyptians.ts`，接入 `Mummy / Pyramid Engineer / Priest of Anubis / Pharaoh / Lost Knowledge / Seal the Tomb / Tomb Trap / Blessing of Anubis / You Can Take It With You / Plague of Locusts / Mummy Strength / Ancient Curse`，并在 `domain/bury.ts` 增加可复用的 `buildBuryCardEvents()` / `uncoverBuriedCard()`，支持 `onUncover`、非法时机翻开 special 直接弃置、`onCardBuried / onBuriedCardUncovered` 触发。
  - Next: 完成 bury UI、同步 locale / OpenSpec，并跑相关验证。

- **[14:22] Action**: 落地 bury UI 与 Ancient Egyptians 正确文本
  - Result: `BaseZone.tsx` 已显示埋葬牌条带；控制者可见真实卡面并可检视，对手仅见隐藏占位与数量/控制者标识。`public/locales/en/game-smashup.json` 与 `public/locales/zh-CN/game-smashup.json` 已修正 Ancient Egyptians 与 `base_star_portal` 文本。
  - Next: 补最小 Vitest、复跑 typecheck / OpenSpec 校验。

- **[14:38] Action**: 补 Ancient Egyptians 最小测试并复核门禁
  - Result: 已在现有测试文件补 `buryEngine.test.ts` 与 `newBaseAbilities.test.ts`，覆盖“翻开后只结算 uncover 文本并弃置”“从场上埋葬确实离场”“Pyramids / Star Portal 基地入口”；`npx vitest run src/games/smashup/__tests__/buryEngine.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts` 通过，`npm run typecheck` 通过，`openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 通过。
  - Next: 回填 planning / spec 后进入 Vikings。

### Phase: Vikings implementation
**Status**: In Progress

- **[15:05] Action**: 按官方口径重建 Vikings 文本基线与能力范围
  - Result: 已确认仓库原有 Vikings locale 与 Oops 官方规则书 / Fandom 口径冲突，当前实现不再沿用旧文本；`Huscarl / Shield Maiden / Raider / Valkyrie / Viking Funeral / Ransack / Pillage / Cast the Runes / Raiding Party / Berserk / Tribute / Combat Training / Drakkar / Longhouse` 均已切到官方语义。
  - Next: 落能力文件、metadata 和基地触发实现。

- **[15:18] Action**: 接入 Vikings ability 与静态 metadata
  - Result: 已新增 `src/games/smashup/abilities/vikings.ts` 并在 `abilities/index.ts` 注册；`src/games/smashup/data/factions/vikings.ts` 已修正 `Huscarl / Raider` 为 `talent`、`Shield Maiden / Berserk` 为 `onPlay`、`Viking Funeral` 为 `ongoing` 且 `ongoingTarget: 'minion'`。
  - Next: 修正 locale、补最小行为测试并验证基地入口。

- **[15:34] Action**: 补 Vikings 最小测试并复核门禁
  - Result: 已在 `newFactionAbilities.test.ts` 覆盖 `vikings_huscarl / vikings_shield_maiden / vikings_pillage`，在 `newBaseAbilities.test.ts` 覆盖 `base_drakkar / base_longhouse`；`npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts` 通过，`npm run typecheck` 通过，`openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 通过。
  - Next: 回填 planning 文件后进入 Cowboys。

## 5-Question Reboot Check
| Question | Answer |
| :--- | :--- |
| Current Phase? | Phase 9 收尾阶段：统一审计、gameplay E2E 与 evidence 已完成，剩余是确认门禁与向用户汇报真实残留缺口 |
| Goal? | 在已完成 intake、四派系第一轮实现的基础上，完成统一 gameplay 审计、浏览器层新交互 E2E 和证据收口，并明确真实残留风险 |
| Key Knowledge? | 统一审计已通过；共享官方 duel 内核已落地并完成 Cowboys 浏览器 full-chain 出图验证，`Stagecoach` 仍是最小移动语义；`Ancient Egyptians / Samurai` 仍主要是交互注入型 E2E |
| Last Action? | 已修复 `Deputy` 目标选择后的阶段推进 bug，并复跑 `newFactionAbilities` / `newBaseAbilities` 与 Cowboys 决斗 E2E |
| Next Step? | 向用户汇报官方 duel 收口结果、截图证据绝对路径，以及仍然真实存在的 Samurai 专项 E2E 与 `Stagecoach` 语义缺口 |

### Phase: Cowboys implementation
**Status**: In Progress

- **[16:10] Action**: 按官方口径修正 Cowboys 文本基线与 metadata
  - Result: 已将 `Deputy / Gunfighter / Pinkerton / Sheriff / Stagecoach / Run 'Em Off / Quick Draw / High Noon / Gold Strike / Gold in Them Thar Hills / Form a Posse / Dynamite Surprise / So-So Corral` 的中英文 locale 改回官方语义；`src/games/smashup/data/factions/cowboys.ts` 已补 `special / ongoing / onPlay` metadata。
  - Next: 收敛 duel MVP 实现，修复错误事件字段并补最小测试。

- **[16:24] Action**: 落地 Cowboys 第一轮 duel / move / destroy / draw 实现
  - Result: `src/games/smashup/abilities/cowboys.ts` 已接入 `Gunfighter / Quick Draw / High Noon / Run 'Em Off / Gold in Them Thar Hills / Form a Posse / Dynamite Surprise / Sheriff / Gold Strike / Saloon / So-So Corral`；同时移除了旧错误的 `Saloon` 决斗内偷触发和 `Dynamite Surprise` 伪 buff 逻辑，并改用现有 `grantExtraMinion / grantExtraAction` 契约。
  - Next: 在现有测试文件补 Cowboys 最小覆盖，并复跑门禁。

- **[16:29] Action**: 补 Cowboys 最小测试并复核门禁
  - Result: 已在 `newFactionAbilities.test.ts` 覆盖 `cowboys_gunfighter / cowboys_quick_draw / cowboys_high_noon / cowboys_gold_strike`，在 `newBaseAbilities.test.ts` 覆盖 `base_saloon / base_so_so_corral`；`npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts` 通过，`npm run typecheck` 通过，`openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 通过。
  - Next: 回填 Cowboy 残留缺口后进入 Samurai。

### Phase: Samurai implementation
**Status**: In Progress

- **[16:54] Action**: 按官方口径修正 Samurai 文本基线与 metadata
  - Result: 已将 `Samurai-Chan / Ronin / Bushi / Shogun / Yokai Attack! / Way of the Warrior / Honorable Combat / Honor the Fallen / Honor the Ancestors / Heart of the Battle / Final Haiku / Code of Bushido / Shogun's Palace / Sakura Garden` 的中英文 locale 改回官方语义；`src/games/smashup/data/factions/samurai.ts` 已补 `special / ongoing / onPlay` metadata。
  - Next: 落地第一轮 duel / honor / destroy / ongoing draw 实现并接入注册入口。

- **[17:02] Action**: 落地 Samurai 第一轮 duel / destroy / draw / counter 实现并复核门禁
  - Result: 已新增 `src/games/smashup/abilities/samurai.ts` 并在 `abilities/index.ts` 注册，接入 `Ronin / Samurai-Chan / Bushi / Shogun / Yokai Attack! / Honorable Combat / Code of Bushido / Heart of the Battle / Honor the Fallen / base_shoguns_palace / base_sakura_garden`；已在 `newFactionAbilities.test.ts` 覆盖 `samurai_ronin / samurai_yokai_attack / samurai_honorable_combat / samurai_code_of_bushido / samurai_honor_the_fallen`，在 `newBaseAbilities.test.ts` 覆盖 `base_shoguns_palace / base_sakura_garden`；`npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts` 通过，`npm run typecheck` 通过，`openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 通过。
  - Next: 继续补齐 Samurai 第一轮遗漏能力，再统一回填残留语义。

- **[17:10] Action**: 补完 Samurai 第一轮遗漏能力并复跑门禁
  - Result: `src/games/smashup/abilities/samurai.ts` 已继续接入 `Honor the Ancestors / Way of the Warrior(+3 分支) / Final Haiku / Sakura Garden` 的第一轮能力；`newFactionAbilities.test.ts` 已新增 `samurai_samurai_chan / samurai_honor_the_ancestors / samurai_shogun / samurai_final_haiku` 覆盖，`newBaseAbilities.test.ts` 已补 `base_shoguns_palace / base_sakura_garden` 强化断言；`npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts` 通过，`npm run typecheck` 通过，`openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 通过。
  - Next: 转入四派系统一审计与新交互 E2E 收口。

### Phase: 统一审计与收尾
**Status**: Complete

- **[17:18] Action**: 运行四派系统一 gameplay 审计并修复显式硬错误
  - Result: 已确认默认 `vitest` 配置会排除 `*audit*.test.ts`，必须改用 `vitest.config.audit.ts`；`npx vitest run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native` 最终 `21 passed`。过程中额外发现 `cowboys_stagecoach` 存在 `abilityTags: ['onPlay']` 但未注册执行器的硬错误，现已补 `Stagecoach` 的 MVP 实现与 `newFactionAbilities.test.ts` 最小回归。
  - Next: 跑浏览器层新交互 E2E，并输出证据文档。

- **[17:32] Action**: 跑通三条 Oops gameplay E2E 并留存截图
  - Result: `e2e/smashup/smashup-phase-transition-simple.e2e.ts` 已新增 `Ancient Egyptians bury/uncover`、`Cowboys duel direct click`、`Samurai extra play` 三条用例；三条命令均通过，并生成对应的 before/after 显式证据截图。
  - Next: 写统一 evidence，并把真实覆盖边界回填到 planning 文件。

- **[17:40] Action**: 汇总 gameplay E2E evidence 与残留风险
  - Result: 已新增 `evidence/smashup/smashup-oops-faction-gameplay-e2e-test.md`，明确三条浏览器交互证据、截图绝对路径与限制说明；`task_plan.md`、`findings.md`、`progress.md` 已同步回填统一审计入口、`Stagecoach` MVP 范围，以及 `Ancient Egyptians / Samurai` 两条 E2E 属于“注入当前交互”而非 full-chain 的事实边界。
  - Next: 复跑最终门禁，确认本轮可交付状态。

- **[17:43] Action**: 复跑最终门禁并确认收尾状态
  - Result: `npm run typecheck` 通过，`npx openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive` 通过，`npx vitest run src/games/smashup/__tests__/newFactionAbilities.test.ts --configLoader native` 通过（`76 passed, 1 skipped`），`npx vitest run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native` 通过（`21 passed`）。
  - Next: 向用户汇报已完成范围、证据落点与仍需后续补完的官方语义缺口。

### Phase: duel official-chain validation
**Status**: Complete

- **[18:34] Action**: 将 Cowboys 决斗浏览器用例升级为官方链路并补关键截图点
  - Result: `e2e/smashup/smashup-phase-transition-simple.e2e.ts` 中的 Cowboys 用例已从“选中敌方随从后直接结算”升级为完整 `Pinkerton -> 决斗牌 -> Deputy -> 结算` 链路，并新增 `pinkerton / duel-card / deputy-card / deputy-target / resolve` 五张显式证据截图。
  - Next: 运行用例并核对画面。

- **[18:37] Action**: 借助 E2E 暴露并修复 Deputy 收尾的真实链路 bug
  - Result: 发现 `smashup_duel_deputy_target` 在推进下一阶段时使用了弃牌前旧状态，导致 `Deputy` 已弃置却又被重新排入同一玩家提示；现已在 `src/games/smashup/domain/duel.ts` 中先模拟 `CARDS_DISCARDED + addTempPower` 再推进阶段，消除重复提示并确保决斗正常收口。
  - Next: 复跑单测与 E2E。

- **[18:39] Action**: 复跑决斗门禁并人工核图
  - Result: `node .\\scripts\\infra\\vitest-cli-safe.mjs run src\\games\\smashup\\__tests__\\newFactionAbilities.test.ts src\\games\\smashup\\__tests__\\newBaseAbilities.test.ts --configLoader native` 通过；`npm run test:e2e:ci:file -- smashup-phase-transition-simple.e2e.ts "Oops Cowboys 决斗交互应按官方链路完成 Pinkerton/决斗牌/Deputy/结算"` 通过；已人工核对五张截图，确认决斗横幅、Pinkerton 按钮、决斗牌跳过按钮、Deputy 选牌/选目标与结算后敌方离场全部符合预期。
  - Next: 回填 evidence / planning 文件并向用户汇报。

- **[21:10] Action**: 收口 Cowboys 决斗链 i18n 混用
  - Result: 已确认根因是 `src/games/smashup/domain/duel.ts` 的阶段标题/跳过按钮仍是硬编码中文，而 `Board.tsx` 决斗横幅已走 locale；现已给交互选项补 `labelKey/labelParams` 渲染入口，补齐 `duel.ts` 的 locale key，并让 `PromptOverlay.tsx` 与 `Board.tsx` 的快捷按钮统一解析这些 key。`npm run typecheck` 通过，`newFactionAbilities + newBaseAbilities` 共 `123 passed, 1 skipped`，`npm run test:e2e:ci:file -- smashup-phase-transition-simple.e2e.ts "Oops Cowboys 决斗交互应按官方链路完成 Pinkerton/决斗牌/Deputy/结算"` 再次通过。
  - Next: 提交、推送并为这轮 i18n 收尾补开新 PR。

## Session: 2026-04-23 Home V2 视觉统一二次收口
- **Status:** in_progress
- Actions taken:
  - 将 `HomeV2/HomeV2Draft` 手机横屏展示参数收敛为 `scale=1.36`、`offsetYPct=1.5`，并同步背景暗化强度，避免底部硬黑边。
  - 移除 `homeV2BookScene` 的 `bookClip` 裁切链路，恢复书本壳与翻页素材原始边界，减少矩形裁切感。
  - `homeV2Compact` 游戏卡从 `background-image` 改为统一 `border-image` 九宫格；并恢复 `object-contain`，避免缩略图裁切不一致。
  - 左页目录改成固定 `6` 槽位双排骨架，保持第二排与第一排同节奏，避免第六张下沉。
  - 登录右页改为同材质九宫格容器，且 embedded Auth 取消 `autoFocus`，解决“右页顶端被吃/像弹窗漂移”。
  - 创建房间弹窗改用 `--runtime-viewport-height` 计算最大高度，并收紧间距，确保移动横屏下首屏可见底部动作按钮。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/auth/AuthModal.tsx src/pages/HomeV2.tsx src/pages/HomeV2Draft.tsx src/ugc/runtime/ui-scene/scenes/homeV2BookScene.ts src/components/lobby/GameList.tsx src/components/home-v2/LobbyDirectory.tsx src/components/home-v2/HomeTabPanels.tsx src/components/home-v2/GameDetails.tsx src/components/lobby/CreateRoomModal.tsx e2e/lobby.e2e.ts` | 0 error | 0 error（6 warning，均既有规则告警） | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| i18n 校验 | `npm run i18n:check` | 无缺失 | `no missing keys detected` | ✅ |
| E2E-查询入口链路 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过 | 通过（重跑后稳定通过） | ✅ |
| E2E-密码入房链路 | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 详情页输入房间密码后可加入加密房间"` | 通过 | 通过 | ✅ |

## Session: 2026-04-26 Home V2 首页参考稿重构（首页先行）
- **Status:** in_progress
- Actions taken:
  - 在 `.worktrees\homepage-v2\` 中先执行版本更新；当前工作树版本已到 `0.5.61`。
  - 对照参考图确认首页当前主要差距：现状仍偏“书页上的卡片宫格 + 右侧书签”，目标是“顶部分类导航 + 双页目录列表 + 右上角身份/帮助入口”。
  - 首轮已把首页目录结构改成单个 spread 区内的前端排版版本：顶部分类按钮、右上角账号入口、左右两列目录条目、每条目缩略图/标题/简介/tag/人数信息。
  - 这一轮先保持旧书页舞台与右侧书签链路不动，目的是先把首页目录信息架构切到参考稿方向，下一轮再接 `background.png` 与更强的翻页/舞台背景收敛。
  - 用户进一步明确“要前端可用、移动端横屏 UI”，因此已放弃“整张首页截图直出”的误路线；现在首页回到真实 DOM 方案：`background.png` 作为书页底图，分类导航/账号入口/六个游戏条目全部由前端渲染。
  - `HomeV2.tsx` 现已在 `sceneState === overview && activeTab === lobby` 时走独立横屏舞台：按 `1672x941` 书页底图等比适配到手机横屏，不再复用旧 896x720 overview shell，也不再直接展示 `首页.png`。
  - `LobbyDirectory.tsx` 已重写为可交互目录页：顶部分类按钮为真实按钮；右上角账号入口真实可点；六个游戏条目为真实 DOM 卡片；点击仍能进入旧详情链路。
  - 为避免首页白块，`splendor` 与 `tictactoe` 缩略图改为前端绘制 fallback，而不是依赖缺失资源路径。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint | `npx eslint src/components/home-v2/LobbyDirectory.tsx src/pages/HomeV2.tsx public/locales/zh-CN/lobby.json public/locales/en/lobby.json` | 0 error | 0 error，3 warning（JSON 文件未纳入 eslint + 组件文件既有 fast-refresh warning） | ✅ |
| Typecheck | `npm run typecheck` | 通过 | 通过 | ✅ |
| ESLint（exact homepage 收口） | `npx eslint src/pages/HomeV2.tsx e2e/lobby.e2e.ts` | 0 error | 0 error | ✅ |
| E2E-查询入口链路（前端可用横屏首页） | `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=600000 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过 | 通过；首页目录、右上角账号入口、返回 lobby、进入井字棋详情链路都通过 | ✅ |


## Session: 2026-04-27 Home V2 首页参考稿重构（2388x1080 真移动端继续收口）
- **Status:** in_progress
- Actions taken:
  - 将 `e2e/lobby.e2e.ts` 中 Home V2 首页查询入口的默认横屏视口从 `936x432` 切换到 `2388x1080`，防止后续会话回退到代理口径。
  - 按 `2388x1080` 真移动端分辨率重排 `LobbyDirectory.tsx`：放大顶部导航占位、放大六个目录条目、重新收右上角账号/工具入口，并继续收缩略图裁图脏边。
  - 初次复跑 E2E 遇到共享 single-worker 端口 `6273/20100/21100` 冲突；随后改用 `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181` 成功跑通首页查询入口。

### Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| ESLint（2388x1080 口径） | `npx eslint src/components/home-v2/LobbyDirectory.tsx e2e/lobby.e2e.ts` | 0 error | 0 error，1 warning（既有 `react-refresh/only-export-components`） | ✅ |
| E2E-查询入口链路（真移动端默认口径） | `npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"` | 通过 | 首次因共享端口被占用失败；改用 `PW_E2E_SERVICE_REUSE=shared-single + 37974/30180/30181` 后通过 | ✅ |
| E2E-真分辨率量测 | 同上 | `home-v2-viewport=2388x1080` 且书页居中 | `width=2388 height=1080`；`widthRatio=0.798 heightRatio=0.993 center=(0.500,0.500)` | ✅ |
