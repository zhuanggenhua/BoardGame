# 移动端兼容覆盖矩阵（2026-05-24）

## 范围

- 目标：主页 + 当前已启用游戏/工具入口的移动端兼容性覆盖现状
- 口径：优先记录“真实移动 E2E / 截图证据”，源码守卫只作为补充

## 已启用入口

| 入口 | 启用 | 当前证据 | 结论 |
| --- | --- | --- | --- |
| Home / Lobby | 是 | `e2e/_shared/lobby.e2e.ts`，`e2e/lobby.e2e.ts`，`src/pages/__tests__/GlobalCompatSource.test.ts`，`Home.compatSource.test.ts`，`HomeV2.compatSource.test.ts`，`src/components/lobby/__tests__/CreateRoomModal.compatSource.test.ts` | 已补到经典首页活跃房间卡桌面悬浮 + 移动端页内不遮挡游戏卡片、建房键盘安全 + Home V2 横屏目录入详情链 + 纸面认证/建房弹窗键盘稳定证据 |
| 共享系统页（Maintenance / 404 / Compatibility Gate） | 是 | `e2e/_shared/system-routes-mobile.e2e.ts`，`src/pages/__tests__/SystemPages.compatSource.test.ts` | 已补到 `Maintenance / 404 / Compatibility Gate` 竖屏主态完整留屏证据，兼容性拦截页操作按钮不再掉出首屏 |
| TicTacToe | 是 | `e2e/tictactoe/tictactoe-mobile-layout.e2e.ts`，`src/components/common/__tests__/MobileOrientationGuard.test.tsx`，`src/games/tictactoe/__tests__/compatSource.test.ts` | 已补到竖屏主态布局 + 横屏独立方向 gate + 切回竖屏后继续当前对局证据 |
| DiceThrone | 是 | `e2e/dicethrone/character-selection.e2e.ts`，`e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts`，`src/games/dicethrone/ui/__tests__/compatSource.test.ts`，`compatLayout.test.tsx`，`evidence/dicethrone/dicethrone-board-surface-magnify-e2e-test.md`，`evidence/dicethrone/dicethrone-watch-out-spotlight-image-runtime-e2e-2026-05-17.md` | 已补到选角横屏防溢出 + 窄屏手牌长按放大不误出牌 + 面板/提示板放大与视角切换图片存活证据 |
| Cardia | 是 | `e2e/cardia/cardia-smoke-test.e2e.ts`，`e2e/cardia/mobile-orientation.e2e.ts`，`src/games/cardia/__tests__/compatSource.test.ts`，`src/games/cardia/ui/__tests__/compatSource.test.ts` | 已补到竖屏独立横屏 gate + 横屏主态布局 + 横屏真实双方出牌进入 Ability 阶段证据，并为竖屏 smoke 补截图前手牌/战场卡图真实加载守卫 |
| SummonerWars | 是 | `e2e/summonerwars/summonerwars-selection.e2e.ts`，`e2e/summonerwars/summonerwars.e2e.ts`，`src/games/summonerwars/ui/__tests__/compatSource.test.ts`，`evidence/summonerwars/summonerwars-hand-phase-alignment-e2e-test.md`，`evidence/summonerwars/summonerwars-basic-flow-e2e-test-2026-04-12.md` | 已补到选将横屏进局链 + 局内长按放大/阶段说明可达 + 基础召唤移动建造攻击弃牌流程证据，并补手机横屏主态关键控件留屏/可点守卫 |
| SmashUp | 是 | `e2e/smashup/smashup-faction-selection-spacing.e2e.ts`，`e2e/smashup/smashup-4p-layout-test.e2e.ts`，`e2e/smashup/smashup-local-gameplay.e2e.ts`，`e2e/smashup/smashup-tutorial.e2e.ts`，`src/games/smashup/__tests__/FactionSelection.compatSource.test.ts`，`baseZone-mobile-ongoing-actions.test.tsx` | 已补到四人局横屏主态 + 基地/基地 ongoing/附着行动单击或长按放大 + 附着行动不被压成横条的真实移动证据 |
| Splendor | 是 | `e2e/splendor/splendor.e2e.ts`，`src/games/splendor/__tests__/compatSource.test.ts`，`src/games/splendor/__tests__/sprites.test.ts` | 已补到竖屏错方向保护 / 待开局 HUD 避让 + 主态布局 + 横屏真实保留公开牌操作证据，并补 atlas 卡面远端回退与真实渲染断言 |
| AssetSlicer | 是 | `e2e/_shared/tool-routes-mobile.e2e.ts`（手机竖屏打开、无横向溢出、核心内容可见、可切到 `Splendor 映射` 再切回，且切回后主工作区不再被侧栏挤压），`src/pages/devtools/__tests__/AssetSlicer.compatSource.test.ts` | 已补到入口 + 模式切换 + 窄屏主工作区可用 + 收起拉手完整留屏证据 |
| FxPreview | 是 | `e2e/_shared/tool-routes-mobile.e2e.ts`，`src/pages/devtools/__tests__/EffectPreview.compatSource.test.ts` | 已补到窄屏分类抽屉 + 关闭后主预览区恢复完整宽度 + 主区按钮可继续操作证据 |
| AudioBrowser | 是 | `e2e/_shared/tool-routes-mobile.e2e.ts`，`src/pages/devtools/__tests__/AudioBrowser.compatSource.test.ts` | 已补到三栏竖向堆叠 + 搜索栏换行 + 底部历史面板为右下 HUD 让位的真实移动证据 |
| ArchView | 是 | `e2e/_shared/tool-routes-mobile.e2e.ts`（手机竖屏打开、无横向溢出、核心内容可见、可切完整架构图/用户故事并返回），`src/pages/devtools/__tests__/ArchitectureView.compatSource.test.ts` | 已补到入口 + 视图切换 + 用户故事视图在手机竖屏下 6 张阶段卡默认首屏留屏且不重叠的真实几何证据 |

## 未启用但本轮补过

| 入口 | 启用 | 当前证据 | 结论 |
| --- | --- | --- | --- |
| Qidahen | 否 | `e2e/qidahen/mobile-layout.e2e.ts`，`src/games/qidahen/__tests__/compatSource.test.ts` | 已补真实移动 smoke，横屏底部操作区问题已修 |

## 本轮新增/补强

- `续审（当前工作树批量回归）`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/_shared/tool-routes-mobile.e2e.ts`：2026-05-24 当前工作树全量复跑通过，`assetslicer / fxpreview / audiobrowser / archview` 4 条手机竖屏共享工具页兼容 smoke 仍全部为绿
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/_shared/system-routes-mobile.e2e.ts`：2026-05-24 当前工作树全量复跑通过，`maintenance / 404 / BrowserCompatibilityGate` 3 条系统页手机竖屏 smoke 仍全部为绿
  - 这次续审未再打出新的共享级移动兼容回归；当前剩余工作更偏向单站点细节加固，而不是成片入口失稳

- `e2e/_shared/tool-routes-mobile.e2e.ts`
  - 从“能打开且不横向溢出”补强为“核心内容可见”
  - 覆盖 `assetslicer` / `fxpreview` / `audiobrowser` / `archview`
  - 本轮继续补强为“模式/视图/状态切换后仍可见且不炸布局”
    - `assetslicer`：切 `Splendor 映射` 再切回
    - `fxpreview`：打开分类抽屉后可关闭，关闭后主区继续可操作
    - `archview`：切 `完整架构图`、`用户故事` 再返回
- `e2e/_shared/system-routes-mobile.e2e.ts`
  - 新增共享系统页真实移动 smoke
  - 覆盖 `maintenance`、`404`、`BrowserCompatibilityGate`
- `共享系统页（Maintenance / 404 / Compatibility Gate）`
  - 本轮补强：
    - `e2e/_shared/system-routes-mobile.e2e.ts`：把原先偏弱的 `toBeVisible` 升级为几何断言，直接校验系统页主按钮矩形完整留在手机竖屏视口内
    - 首次补断言时命中真实问题：`BrowserCompatibilityGate` 的 `继续访问（可能异常）` 底边掉到 `1177px`，超出 `390x844` 视口，说明兼容性拦截页正文过高时首屏看不到操作按钮
    - `src/pages/BrowserCompatibility.tsx`：把兼容性面板改为“正文区内部滚动 + 底部操作区固定留屏”，并顺手压缩移动端标题/icon/padding，避免再次把操作按钮挤出首屏
    - `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/SystemPages.compatSource.test.ts --configLoader native`：2026-05-24 实测通过
    - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/_shared/system-routes-mobile.e2e.ts`：2026-05-24 先红后绿，最终全量通过
  - 本轮实际看图确认：
    - `browser-compatibility-mobile.png`：兼容性拦截页首屏已能直接看到 `返回首页 / 继续访问（可能异常） / 重新检测` 三个操作按钮，不再需要下滚才能继续
- `e2e/tictactoe/tictactoe-mobile-layout.e2e.ts`
  - 从“横竖屏都继续渲染主界面”改为“竖屏主态 + 横屏独立方向 gate”
  - 额外验证切到错方向后进入 gate，切回竖屏后仍保留当前对局并可继续落子
- `src/components/common/MobileOrientationGuard.tsx`
  - 为游戏错方向补全屏 blocker，避免 `portrait-adapted` 游戏在横屏下继续渲染残缺主界面
- `e2e/cardia/mobile-orientation.e2e.ts`
  - 从“错方向 banner 可关闭”改为“竖屏独立横屏 gate，转正方向后正常进入对局”
  - 同时补一条首页竖屏不被游戏 gate 误伤的共享证据
- `TicTacToe`
  - 本轮实际看图确认：
    - `tictactoe-mobile-landscape-orientation-gate.png`：横屏下看到独立竖屏提示 gate，不再出现棋盘被挤到上半区、底部大块黑边的残缺构图
    - `tictactoe-mobile-portrait-after-second-move.png`：切回竖屏后保留已落子状态，并可继续当前对局
  - 本轮补修：
    - `src/games/tictactoe/Board.tsx`：窄屏底部 HUD 额外让出右下安全区，避免 `GameDebugPanel` 浮动入口压住右侧比分和当前回合文案
    - `e2e/tictactoe/tictactoe-mobile-layout.e2e.ts`：补“调试入口”和右侧比分/当前回合文案矩形不重叠的断言
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/tictactoe/__tests__/compatSource.test.ts --configLoader native`：2026-05-24 实测通过
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/tictactoe/tictactoe-mobile-layout.e2e.ts`：2026-05-24 实测通过
- `Cardia`
  - 本轮实际看图确认：
    - `cardia-portrait-orientation-gate.png`：竖屏下进入独立横屏 gate，不再是可关闭 banner + 背后继续渲染对局
    - `cardia-landscape-board-visible.png`：转到横屏后 gate 消失，对局主界面正常出现
- `e2e/splendor/splendor.e2e.ts`
  - 在原有“手机竖屏待开局浮层 + 手机横屏主态布局”基础上，补强为“手机横屏下可真实保留公开牌且操作后不溢出”
- `Splendor`
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/splendor/__tests__/compatSource.test.ts --configLoader native`：2026-05-24 实测通过
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/splendor/__tests__/sprites.test.ts --configLoader native`：2026-05-24 实测通过
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/splendor/splendor.e2e.ts "Splendor：手机竖屏联机待开局浮层不应横向溢出"`：2026-05-24 实测通过
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/splendor/splendor.e2e.ts "Splendor：手机横屏主态不应触发横向溢出，核心区应保持可见"`：2026-05-24 实测通过
  - 本轮修复：
    - `src/games/splendor/Board.tsx`：竖屏待开局浮层底边抬高，给游戏页右下 HUD 让位，避免“开始游戏”主按钮被覆盖
    - `e2e/splendor/splendor.e2e.ts`：补“开始游戏按钮”和游戏页悬浮 HUD 矩形不重叠”的断言
    - `src/games/splendor/ui/SpriteSurface.tsx`：卡面 / 贵族 sprite 改为裁切 `<img>` 渲染，复用 `OptimizedImage` 的候选 URL 回退，不再依赖会命中 404 的 CSS `background-image` atlas 路径
    - `src/games/splendor/ui/SpritePreview.tsx`、`src/games/splendor/cardPreview.tsx`：统一接到 `SpriteSurface`
    - `e2e/splendor/splendor.e2e.ts`、`src/games/splendor/__tests__/sprites.test.ts`：补 atlas 实际加载与缓存回退断言
  - 本轮实际看图确认：
    - `splendor-mobile-pregame-panel.png`：当前竖屏实测已进入横屏继续 gate，不再把待开局主按钮暴露在错误方向下直接操作
    - `Splendor：手机横屏主态不应触发横向溢出，核心区应保持可见-splendor-mobile-landscape-main-layout.png`：手机横屏下市场公开牌与贵族牌面已恢复真实卡图，不再是黑块
  - 本轮补强证据：
    - 复核启用入口矩阵后，发现 `Splendor：手机横屏下应可保留公开牌且操作后仍不触发横向溢出` 的旧证据图仍有黑块占位，无法直接证明“保留公开牌后卡图已真实加载”
    - `e2e/splendor/splendor.e2e.ts`：为该用例补 `waitForSplendorSpriteReady`，在前后两张移动横屏截图前都显式等待公开牌与贵族 sprite 真正加载完成
    - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/splendor/splendor.e2e.ts "Splendor：手机横屏下应可保留公开牌且操作后仍不触发横向溢出"`：2026-05-24 针对新取证门槛复跑通过
    - 新图 `Splendor：手机横屏下应可保留公开牌且操作后仍不触发横向溢出-splendor-mobile-landscape-reserve-before.png` / `...reserve-after.png`：横屏保留前后都能直接看到真实公开牌卡图，不再是深色占位块
- `e2e/cardia/cardia-smoke-test.e2e.ts`
  - 在原有“手机横竖屏布局完整展示战场与手牌”基础上，补强为“手机横屏下双方真实出牌后可进入 Ability 阶段且不溢出”
- `Home / Lobby`
  - 复核当前工作树中的首页移动链路，并修复 Home V2 纸面弹窗键盘稳定性回归：
    - `node scripts/infra/run-e2e-single.mjs ci e2e/_shared/lobby.e2e.ts "首页活跃房间浮层在桌面端居中且移动端不溢出"`：2026-05-24 实测通过
    - `node scripts/infra/run-e2e-single.mjs ci e2e/_shared/lobby.e2e.ts "移动端创建房间输入聚焦后不应把弹窗顶飞出可视区"`：2026-05-24 实测通过
    - `node scripts/infra/run-e2e-single.mjs ci e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"`：2026-05-24 实测通过
    - `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/GlobalCompatSource.test.ts src/pages/__tests__/Home.compatSource.test.ts src/pages/__tests__/HomeV2.compatSource.test.ts src/components/lobby/__tests__/CreateRoomModal.compatSource.test.ts --configLoader native`：2026-05-24 实测通过
  - 本轮修复：
    - `src/pages/Home.tsx`：经典首页活跃房间卡改为“桌面端底部悬浮、移动端页内提示卡”，避免 390 宽视口下遮挡底部游戏卡片
    - `e2e/_shared/lobby.e2e.ts`：补“移动端活跃房间卡位于游戏列表上方而不是覆盖列表”的几何断言
    - `src/components/common/overlays/ModalBase.tsx`：Home V2 纸面 modal 锁定 `layout viewport`，键盘弹出时不再把认证弹窗整体压缩上移
    - `src/components/lobby/CreateRoomModal.tsx`：Home V2 建房纸面 modal 改为使用锁定布局高度与稳定底部 inset，键盘弹出后不再漂移
    - `src/components/layout/CategoryPills.tsx`：经典首页分类栏在手机窄屏下改为自动换行居中，不再依赖横向滚动才能点到 `战棋 / 休闲 / 工具`
    - `e2e/_shared/lobby.e2e.ts`：补 `390x844` 竖屏下全部分类按钮仍在屏内、`工具` 可直接点击生效且页面无顶层横向溢出的断言
    - `src/pages/__tests__/Home.compatSource.test.ts`：补分类栏窄屏布局守卫，防止回退到 `overflow-x-auto + min-w-max` 的长条实现
    - `src/components/lobby/GameDetailsModal.tsx`：经典首页详情弹窗的移动 tab 头改为紧凑标签与更紧凑间距，避免英文 `Leaderboard` 在窄屏下被挤断
    - `public/locales/en/lobby.json`、`public/locales/zh-CN/lobby.json`：为详情弹窗 tab 补紧凑版文案，移动端分别使用 `Lobby / Updates / Reviews / Rank` 与 `大厅 / 更新 / 评价 / 排行`
    - `src/components/lobby/__tests__/GameDetailsModal.compatSource.test.ts`：补详情弹窗移动 tab 头源码守卫
    - `e2e/_shared/lobby.e2e.ts`：补移动端作者入口链路与网页 package-managed 详情链路的 tab 几何断言，确保最后一个 tab 不会再被关闭按钮挤断
    - `e2e/_shared/lobby.e2e.ts`：把“网页版详情应显示移动包管理入口”的过期断言改为当前真实合同：**网页版不显示移动包下载入口，但详情头部仍应完整**
    - `e2e/lobby.e2e.ts`：同步对齐同一条 package-managed 详情断言，避免主大厅 E2E 与共享大厅 E2E 口径互相冲突
  - 本轮实际看图确认：
    - `lobby-home-active-match-mobile-safe.png`：手机竖屏下活跃房间卡位于分类栏与游戏列表之间，不再压住底部两张游戏卡片标题和按钮
    - `lobby-mobile-web-package-entry-absent.png`：手机竖屏下详情弹窗 tab 头现在能完整显示 `大厅 / 更新 / 评价 / 排行`，不再出现旧图里 `Leaderboard` 被截断的情况
  - `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/Home.compatSource.test.ts --configLoader native`：2026-05-24 实测通过
  - `node scripts/infra/vitest-cli-safe.mjs run src/components/lobby/__tests__/GameDetailsModal.compatSource.test.ts --configLoader native`：2026-05-24 实测通过
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/_shared/lobby.e2e.ts "经典首页分类栏在手机竖屏下不应把后半段分类挤到屏外"`：2026-05-24 实测通过
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/_shared/lobby.e2e.ts "移动端游戏详情隐藏描述和推荐人数，作者入口位于右上角且无包围框"`：2026-05-24 实测通过
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/_shared/lobby.e2e.ts "网页版 package-managed 游戏详情在移动端不应显示包管理入口，但详情头部仍应完整"`：2026-05-24 实测通过
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/lobby.e2e.ts "网页版 package-managed 游戏详情在移动端不应显示包管理入口，但详情头部仍应完整"`：2026-05-24 实测通过
- `全局方向提示 / board-shell`
  - 本轮补强：
    - `src/components/common/MobileOrientationGuard.tsx`：当仅显示“建议旋转”顶条而不进入全屏 gate 时，向根节点下发 `--mobile-orientation-banner-offset`
    - `src/index.css`：`board-shell` 游戏在移动端消费该顶部 offset，避免保留内容挂载场景里主界面被方向提示条压住
    - `src/components/common/__tests__/MobileOrientationGuard.test.tsx`：补 banner offset 的挂载与卸载行为测试
    - `src/pages/__tests__/GlobalCompatSource.test.ts`：补 `board-shell` 顶部让位源码守卫
  - `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/GlobalCompatSource.test.ts src/components/common/__tests__/MobileOrientationGuard.test.tsx --configLoader native`：2026-05-24 实测通过
  - 已补真实证据：
    - `e2e/cardia/cardia-smoke-test.e2e.ts`：布局 smoke 改为复用 `setupCardiaTestScenario` 的真实房间注入链，不再依赖已失效的 `openTestGame('cardia')` harness 入口；同时为这组真实建房 + 注入场景 smoke 补 90s 超时预算
    - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/cardia/cardia-smoke-test.e2e.ts "手机竖屏布局应完整展示战场与手牌"`：2026-05-24 实测通过
    - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/cardia/cardia-smoke-test.e2e.ts "手机横屏布局应完整展示战场与手牌"`：2026-05-24 实测通过
    - `cardia-mobile-portrait-layout.png`：竖屏下顶部方向建议 banner 已让开主状态区，战场与手牌仍完整可见，不再停留在“源码硬化未取证”
  - 本轮补强证据：
    - 复核 `cardia-mobile-portrait-layout.png` 时，发现旧图可能存在“截图时手牌卡图尚未完全落地”的疑点；这更像取证时机问题，不像布局本体异常
    - `e2e/cardia/cardia-smoke-test.e2e.ts`：新增 `waitForCardiaCardArtReady`，在布局 smoke 截图前显式等待手牌区与战场区可见卡图 `img.complete && naturalWidth > 0`
    - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/cardia/cardia-smoke-test.e2e.ts "手机竖屏布局应完整展示战场与手牌"`：2026-05-24 针对新取证门槛复跑通过
- `DiceThrone`
  - 复核当前工作树中的移动链路，确认旧证据不是过期文档：
    - `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/character-selection.e2e.ts "手机横屏下选角界面不应出现顶层横向滚动"`：2026-05-24 实测通过
    - `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "mobile long press hand card should open magnify without playing card"`：2026-05-24 实测通过
    - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/ui/__tests__/compatSource.test.ts src/games/dicethrone/ui/__tests__/compatLayout.test.tsx --configLoader native`：2026-05-24 实测通过
  - 本轮新增收口：
    - `e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts`：给 `mobile narrow viewport should keep magnify entries visible and clickable` 补主态手牌几何断言，直接校验手牌区与首张手牌在移动横屏下仍有可用高度且不掉出视口
    - 首次补断言时命中真实问题：首张手牌底边掉出 `375` 高视口约 `13px`，说明主态虽可玩，但底排扇形手牌仍有轻微裁切
    - `src/games/dicethrone/ui/HandArea.tsx`：把粗指针移动端手牌卡的底部负偏移从固定 `-2vw` 收窄到 `0vw`，避免移动横屏下底排卡面被吃掉
    - `src/games/dicethrone/ui/__tests__/compatLayout.test.tsx`：补 `HandArea` 显式宽高公式守卫，防止旧 WebView 再把扇形手牌压成横条
    - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "mobile narrow viewport should keep magnify entries visible and clickable"`：2026-05-24 先红后绿，最终实测通过
    - `10-mobile-main-board-state.png`：修复后底排四张手牌已完整落在视口内，不再像之前那样被底边裁掉
  - 本轮补强证据：
    - 复核 `mobile narrow viewport should keep magnify entries visible and clickable` 的移动证据图时，发现 `14-mobile-discard-pile-inspect-open.png` 里残留了上一拍“请先确认投掷结果”的 toast，属于取证污染，不适合继续作为主证据
    - `e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts`：在故意点击高亮技能槽触发提示后，显式等待该 warning toast 退场，再继续后续弃牌堆放大截图
    - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "mobile narrow viewport should keep magnify entries visible and clickable"`：2026-05-24 针对净化后的取证链路复跑通过
    - 新图 `14-mobile-discard-pile-inspect-open.png`：弃牌堆放大证据已不再被无关 toast 覆盖，可直接阅读移动窄屏下的放大构图
- `SummonerWars`
  - 复核当前工作树中的移动链路，确认矩阵没有低估现有覆盖：
    - `node scripts/infra/run-e2e-single.mjs ci e2e/summonerwars/summonerwars-selection.e2e.ts "mobile landscape flow captures full selection-to-start chain"`：2026-05-24 实测通过
    - `node scripts/infra/run-e2e-single.mjs ci e2e/summonerwars/summonerwars.e2e.ts "移动横屏：长按放大与阶段说明在手机可达"`：2026-05-24 实测通过
    - `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/ui/__tests__/compatSource.test.ts --configLoader native`：2026-05-24 实测通过
  - 本轮补强：
    - `e2e/summonerwars/summonerwars.e2e.ts`：给两条手机横屏主态用例补 `assertMobileLandscapeFrameReachable`，直接校验 `map-container`、手牌区、牌库、弃牌入口、结束阶段按钮、阶段条、能量条都完整留在视口内
    - 同时补 `sw-deck-discard` 指针命中断言，避免“主态看着还行，但右侧弃牌入口被遮住或掉出屏外”的回退
    - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/summonerwars/summonerwars.e2e.ts "移动横屏：长按放大与阶段说明在手机可达"`：2026-05-24 实测通过
    - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/summonerwars/summonerwars.e2e.ts "移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌"`：2026-05-24 实测通过
- `src/pages/devtools/AudioBrowser.tsx`
  - 修复手机竖屏三栏横向撑爆
- `AudioBrowser`
  - `node scripts/infra/vitest-cli-safe.mjs run src/pages/devtools/__tests__/AudioBrowser.compatSource.test.ts --configLoader native`：2026-05-24 实测通过
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/_shared/tool-routes-mobile.e2e.ts "audiobrowser 在手机竖屏下应可打开且不出现顶层横向溢出"`：2026-05-24 实测通过
  - 本轮修复：
    - `src/pages/devtools/AudioBrowser.tsx`：移动端给底部历史面板追加 HUD 安全区，并把历史面板主体横向收窄，避免右下全局设置悬浮球压住面板
    - `e2e/_shared/tool-routes-mobile.e2e.ts`：`audiobrowser` 用例改为直接校验“历史面板主体”和“设置悬浮球”矩形不重叠，而不是只看固定底边距离
  - 本轮实际看图确认：
    - `audiobrowser-mobile.png`：手机竖屏下右下设置悬浮球落在历史面板右侧空白区，不再覆盖历史面板本体
- `ArchView`
  - `node scripts/infra/vitest-cli-safe.mjs run src/pages/devtools/__tests__/ArchitectureView.compatSource.test.ts --configLoader native`：2026-05-24 实测通过
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/_shared/tool-routes-mobile.e2e.ts "archview 在手机竖屏下应可打开且不出现顶层横向溢出"`：2026-05-24 实测通过
  - 本轮修复：
    - `src/pages/devtools/ArchitectureView.tsx`：用户故事视图在手机窄屏下切到紧凑移动布局，隐藏右侧关联标签、收窄 `viewBox`、放大阶段卡，并为阶段卡补稳定 `data-testid`
    - `src/pages/devtools/ArchitectureView.tsx`：用户故事视图的返回入口改为稳定单行，不再在手机竖屏首屏被标题挤成两行
    - `e2e/_shared/tool-routes-mobile.e2e.ts`：`archview` 用例补“用户故事首尾阶段卡在首屏可见，且阶段卡尺寸不再缩成小条”的几何断言
    - `e2e/_shared/tool-routes-mobile.e2e.ts`：补“返回入口高度保持单行”的几何断言
  - 本轮实际看图确认：
    - `archview-mobile.png`：手机竖屏下用户故事视图首个阶段卡明显放大，不再是之前顶部一小条难以阅读的构图；返回入口也恢复成单行
  - 本轮补强证据：
    - `e2e/_shared/tool-routes-mobile.e2e.ts`：把 `ArchView` 用户故事校验从 `toBeVisible()` 升级成真实首屏几何断言，直接校验 6 张阶段卡默认不触发页面滚动、全部留在首屏内且上下不重叠
    - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/_shared/tool-routes-mobile.e2e.ts "archview 在手机竖屏下应可打开且不出现顶层横向溢出"`：2026-05-24 针对新几何断言复跑通过
- `src/pages/devtools/AssetSlicer.tsx`
  - 修复手机竖屏下默认 320px 侧栏把主工作区挤成窄条的问题
  - 窄屏改为默认收起侧栏，打开时走覆盖式抽屉，不再占用主工作区宽度
- `src/pages/devtools/EffectPreview.tsx`
  - 修复手机竖屏下左侧分类栏长期占半屏、把预览区挤窄的问题
  - 窄屏改为默认收起分类栏；打开时走覆盖式抽屉，并提供显式关闭按钮
- `FxPreview`
  - `node scripts/infra/vitest-cli-safe.mjs run src/pages/devtools/__tests__/EffectPreview.compatSource.test.ts --configLoader native`：2026-05-24 实测通过
  - `node scripts/infra/run-e2e-single.mjs ci e2e/_shared/tool-routes-mobile.e2e.ts "fxpreview 在手机竖屏下应可打开且不出现顶层横向溢出"`：2026-05-24 实测通过
  - `node scripts/infra/run-e2e-single.mjs ci e2e/_shared/tool-routes-mobile.e2e.ts`：2026-05-24 全量工具页回归通过
  - 本轮修复：
    - `src/pages/devtools/cards/shared.tsx`：特效预览卡标题区改为手机窄屏自动拆行，性能栏独立让位，不再和标题/描述挤成一团
    - `src/pages/devtools/EffectPreview.tsx`：手机竖屏主预览区增加顶部安全间距，避免左上角 `分类` 悬浮按钮压住首个预览卡标题
    - `e2e/_shared/tool-routes-mobile.e2e.ts`：补 `FxPreview` 工具栏标题块、性能栏与左上角侧栏按钮互不遮挡的几何断言
  - 本轮实际看图确认：
    - `fxpreview-mobile.png`：竖屏下默认不再保留半屏分类栏，主预览区恢复为完整宽度；首个预览卡标题也不再被左上角 `分类` 按钮压住
- `AssetSlicer`
  - `node scripts/infra/vitest-cli-safe.mjs run src/pages/devtools/__tests__/AssetSlicer.compatSource.test.ts --configLoader native`：2026-05-24 实测通过
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-single.mjs ci e2e/_shared/tool-routes-mobile.e2e.ts "assetslicer 在手机竖屏下应可打开且不出现顶层横向溢出"`：2026-05-24 实测通过
  - `node scripts/infra/run-e2e-single.mjs ci e2e/_shared/tool-routes-mobile.e2e.ts`：2026-05-24 全量工具页实测通过
  - 本轮修复：
    - `src/pages/devtools/AssetSlicer.tsx`：移动端收起侧栏时把左侧拉手完整留在视口内，并补稳定 test id
    - `e2e/_shared/tool-routes-mobile.e2e.ts`：`assetslicer` 用例改为先显式打开侧栏，再校验收起拉手矩形不掉出左边界
  - 本轮实际看图确认：
    - `assetslicer-mobile.png`：切回切片模式后，主工作区 `无图片` 占位框保持完整横向可读，收起拉手不再只剩半截露在屏外
- `e2e/qidahen/mobile-layout.e2e.ts`
  - 新增真实移动横屏 smoke
- `src/games/qidahen/Board.tsx`
  - 修复横屏底部确认/取消掉出视口
- `src/games/smashup/ui/BaseZone.tsx`
  - 为旧端比例盒不稳补 `paddingTop` 正方形兜底，降低“基地/附着区被压成横条”的风险
- `SmashUp`
  - 回到用户最早点名的基地/附着区链路，复核当前工作树中的真实移动证据：
    - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-4p-layout-test.e2e.ts "移动端横屏应保持四人局布局可用，并支持手牌长按看牌与战场拖拽放大"`：2026-05-24 实测通过
    - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseZone-mobile-ongoing-actions.test.tsx --configLoader native`：2026-05-24 实测通过
  - 本轮实际看图确认：
    - `05-mobile-single-tap-expands-attached-actions.png`：宿主随从展开后，附着行动卡保持正常卡面比例，不是细横条
    - `06b-mobile-attached-action-single-tap-magnify.png`：附着行动单击后可正常放大，源卡本体尺寸可辨认
    - `09-mobile-base-ongoing-long-press-magnify.png`：基地 ongoing 长按后可正常放大，说明不是“没图就塌成条”
  - 当前判断更接近旧手机 / 旧 WebView 的比例盒兼容风险，现有 `paddingTop` 兜底已覆盖这一类塌高场景
  - 本轮补强证据有效性：
    - `e2e/helpers/smashup.ts`：新增截图取证前隐藏 `debug-toggle` 浮层的辅助函数
    - `e2e/smashup/smashup-4p-layout-test.e2e.ts`：主态与交互截图前统一隐藏调试浮层，避免 DEV 入口污染移动主态证据
    - 新图 `04-mobile-landscape-layout.png`、`05-mobile-single-tap-expands-attached-actions.png` 已确认不再带调试浮层，能直接看主界面布局与附着行动构图

## 剩余风险

- 工具页当前最弱的入口级证据已经补到“基础交互可达”。若后续继续加固，优先补更细的可操作链路，而不是再扩大到新入口。
- `Qidahen` 当前仍是未启用状态；若后续转为启用，需要再按正式入口回归一次。
