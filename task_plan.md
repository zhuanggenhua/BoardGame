## Addendum（2026-04-28）：Home V2 详情页 + 翻页效果完全重构（参考图一致）

### Goal
> 在 `feat/homepage-v2` 工作树内，以 `D:\gongzuo\webgame\gameasset\v2首页参考` 中的详情页 / 登录注册 / 建房密码 / 总览流程参考稿为准，继续推进 Home V2 的**详情页与翻页体验完全重构**：保持首页目录页作为已收口基线，只把后续链路重构到与参考图同一套书本体验，不沿用旧壳子拼补。

### Phase

- [ ] **Phase A: 参考稿与现状对齐**
  - [x] 锁定参考素材目录，并确认后续不止首页：至少包含详情页、登录注册、建房/密码面板、总览流程稿
  - [x] 复核移动端 / UI 约束，确保改动只在受限视口条件下压缩，不影响桌面端默认基线
  - [x] 确认当前首页已经切到独立 spread 渲染，但详情页 / 翻页仍主要依赖旧 `book-idle + page-flip-left/right` 壳层

- [ ] **Phase B: 详情页重构**
  - [ ] 对齐参考稿详情页的信息层级：左页游戏标题/摘要/标签，右页房间列表/操作区/密码区
  - [ ] 必要时补详情页专用背景或 spread 资源接入，避免继续把首页 spread / 旧 idle 壳混用
  - [ ] 保持从首页进入详情、加入房间、创建房间的真实链路不退化

- [ ] **Phase C: 翻页体验重构**
  - [ ] 以参考稿“封面 -> 目录 -> 详情”的书本路径重整状态机与动画节点
  - [ ] 区分首页目录 spread、详情页 spread、翻页中间帧，不再让多个状态共用同一静态壳造成视觉错位
  - [ ] 评估并收口右侧书签 / 返回目录 / 详情返回时的统一交互语义

- [ ] **Phase D: 验证与留档**
  - [ ] 跑首页到详情的 E2E，并补翻页关键截图证据
  - [ ] 若详情页/翻页受移动横屏影响，按 `2388x1080` 真横屏口径复验
  - [ ] 回写 `task_plan.md / findings.md / progress.md / evidence/_shared/home-v2-query-entry-e2e-test.md`

## Addendum（2026-04-28）：Home V2 首页缩略图退步修复（2388x1080）

### Goal
> 修复首页目录页当前“splendor 空白、tictactoe 占位符、缩略图显示链路退步”的回归，只恢复首页真实可见缩略图与详情入口链路，不再改动首页总体布局框架。

### Phase

- [x] **Phase A: 根因定位**
  - [x] 确认 `LobbyDirectory` 当前只按 `thumbnailPath` 渲染，导致 `tictactoe` 没复用项目已注册的缩略图组件
  - [x] 确认 `splendor/picture` canonical 静态资源缺失，直接退化为空白块

- [x] **Phase B: 显示链路修复**
  - [x] `src/components/home-v2/LobbyDirectory.tsx` 增加回退：无 `thumbnailPath` 或加载失败时优先渲染 `game.thumbnail`
  - [x] 补齐 `public/assets/i18n/zh-CN/splendor/compressed/picture.webp`，让 `splendor` canonical 缩略图路径恢复可用

- [x] **Phase C: 回归验证与留档**
  - [x] 运行 `npx eslint src/components/home-v2/LobbyDirectory.tsx`
  - [x] 运行首页 E2E：`homeV2Draft 查询参数会切到 V2 首页并可进入详情页`
  - [x] 复看 `homepage-catalog.png` 与 `detail-entry.png`，并回写 `task_plan.md / findings.md / progress.md / evidence/_shared/home-v2-query-entry-e2e-test.md`

# Task Plan: Smash Up Oops 四派系接入与玩法实施

## Addendum（2026-04-28）：Home V2 首页参考图终态收口（2388x1080）

### Goal
> 在 `feat/homepage-v2` 工作树内，仅针对首页目录页完成真移动端横屏口径（`2388x1080`）的最终收口：确保首页是可交互 DOM、内容完整落在书页内、缩略图/分类/右上角入口/双页节奏对齐参考稿，并保留“从首页进入详情”的真实链路。

### Phase

- [x] **Phase A: 真分辨率基线锁定**
  - [x] 首页 E2E 固定切到 `2388x1080`
  - [x] 复核书页舞台居中与书内内容不出壳
  - [x] 停止使用 `936x432` 代理口径作为首页主验收

- [x] **Phase B: 目录页 DOM 视觉收口**
  - [x] 双页 6 条目录项重排到更接近参考稿的行节奏
  - [x] 顶部分类导航与右上角账号/概述入口继续压缩到参考稿布局
  - [x] `splendor` / `summonerwars` 缩略图继续收边，badge 改成参考稿风格的双标签组合

- [x] **Phase C: 端到端验收与留档**
  - [x] 运行首页专用 ESLint 与 `homeV2Draft` 首页 E2E
  - [x] 复看 `homepage-catalog.png`，确认首页为真实 DOM 且内容完整落在书页内
  - [x] 更新 `task_plan.md` / `findings.md` / `progress.md` / `evidence/_shared/home-v2-query-entry-e2e-test.md`

## Addendum（2026-04-26）：Home V2 参考图重构（先做首页）

### Goal
> 在 `feat/homepage-v2` 工作树内，先把 Home V2 首页重构到 `D:\gongzuo\webgame\gameasset\v2首页参考\首页.png / 总览首页.png` 的视觉方向：优先完成首页目录页（背景、书页、分类导航、双页列表），翻页继续保留可演进到前端模拟的实现口径，详情/登录/建房放到后续阶段逐步收口。

### Phase

- [x] **Phase A: 基线同步与参考分析**
  - [x] 在 `homepage-v2` 工作树同步版本号到当前基线（`0.5.61`）
  - [x] 对照参考图与现有 `HomeV2` / `LobbyDirectory` / `GameList` / `home-v2.ui.yaml`
  - [x] 明确首页优先采用“静态背景书页 + 前端排版列表”，暂不把抠图作为首页第一阶段前置条件

- [x] **Phase B: 首页目录页第一阶段重构**
  - [x] 接入用户准备好的首页背景素材
  - [x] 重做首页分类导航与双页游戏列表样式
  - [x] 放弃“背景差分抠图”路线，改为直接使用 `首页.png` 成品图 + 透明热点，避免脏块/透明孔洞
  - [x] 保持现有点击进详情链路可用

- [x] **Phase C: 验证与下一阶段切分**
  - [x] 跑首页相关 ESLint / i18n / 必要 E2E
  - [x] 回看截图并更新 `evidence/_shared/home-v2-query-entry-e2e-test.md`
  - [x] 复核首页截图与参考图的主视觉一致性，确认不再出现差分资产导致的斑驳伪影
  - [x] 明确详情页 / 登录注册 / 建房页继续重构所需素材与前端模拟边界

## Addendum（2026-04-22）：Home V2 终态收口（网格对齐 + 内联登录 + 设备安装）

### Goal
> 按用户最新口径收口 Home V2：目录两排严格对齐、登录注册改为右页内联（不弹窗）、详情与建房链路可读可点，并完成 APK 安装到用户手机。

### Phase

- [x] **Phase A: 视觉与交互修复**
  - [x] 目录 6 卡改为按列统一基线，第六卡不再下沉
  - [x] 登录注册从 modal 改为右页内联认证
  - [x] 书签、详情 tag、按钮字号继续收敛

- [x] **Phase B: 门禁与 E2E 证据**
  - [x] ESLint / Typecheck / i18n:check 通过
  - [x] 两条 HomeV2 核心 E2E 通过（建房进局、密码入房）
  - [x] 证据文档更新：`evidence/_shared/home-v2-query-entry-e2e-test.md`

- [ ] **Phase C: Android 安装交付**
  - [x] 重新打包 `easyboardgame-debug.apk`
  - [ ] 安装到用户手机 `10ADAU063C0010U`
  - [ ] 安装后真机截图复核

## Addendum（2026-04-22）：Home V2 细节收口（二次）

### Goal
> 修复用户新增反馈：文字偏大、书本位置偏下、返回目录/创建房间按钮偏大、建房弹窗超出可视区；并完成同分辨率端到端验证与 Android 安装交付。

### Phase

- [x] **Phase A: UI 细节修复**
  - [x] 书签文字下调（`12px -> 11px`），书本整体上移（`offsetYPct: 1 -> -0.8`）
  - [x] `返回目录 / 创建房间` 按钮缩小，详情页标题与 tag 尺寸收敛
  - [x] 建房弹窗改为 portal 渲染到 `document.body`，避免被书本缩放容器放大并裁切

- [x] **Phase B: 验证与证据**
  - [x] ESLint / TypeScript / i18n 校验通过
  - [x] 两条 HomeV2 核心 E2E 通过，并新增“建房弹窗完全在可视区内”的断言
  - [x] 证据文档更新：`evidence/_shared/home-v2-query-entry-e2e-test.md`

- [x] **Phase C: Android 交付**
  - [x] 重新打包 debug APK：`android/app/build/outputs/apk/debug/easyboardgame-debug.apk`
  - [x] 安装到用户设备成功（serial：`10ADAU063C0010U`）

## Addendum（2026-04-22）：Home V2 登录/详情 UI 收敛

### Goal
> 修复用户指出的两处核心体验问题：登录页信息密度过高（登录弹窗应右侧出现）、详情页 tag 过大挤占描述区；并在同分辨率（`2388x1080`）下完成端到端复验与截图留证。

### Phase

- [x] **Phase A: UI 修复**
  - [x] 登录页保留最小入口，登录弹窗改为右半屏出现
  - [x] 详情左页类型/人数 tag 缩成单行小标签，描述区恢复可读
  - [x] 详情右页房间操作 tag 收敛为同行右对齐小标签

- [x] **Phase B: 回归验证**
  - [x] ESLint / TypeScript / i18n 校验通过
  - [x] 两条 HomeV2 核心 E2E 在 `BG_HOME_V2_VIEWPORT=2388x1080` 下通过
  - [x] 证据文档更新：`evidence/_shared/home-v2-query-entry-e2e-test.md`

## Addendum（2026-04-21）：Home V2 手机端适配与发布闭环

### Goal
> 以用户手机横屏为固定验收口径，修复 Home V2 首页/详情/建房弹窗“显示不全、信息重叠、入口不可见”问题，完成端到端流程验证，并产出可直接安装的 Android debug 包。

### Phase

- [x] **Phase A: 体验回归修复**
  - [x] 纠正 Home V2 手机端缩放策略（从过小态恢复）
  - [x] 登录页去重（去掉“账号+账号登录”叠词、去外层重复背景框、保留按钮素材框）
  - [x] 详情页房间卡改成纵向信息流，避免标签挤压正文
  - [x] 密码输入占位文案与字号收敛，避免“请输入密码”显示不全
  - [x] 返回目录与 tag 统一改为素材边框风格

- [x] **Phase B: 端到端验证**
  - [x] ESLint / TypeScript / i18n 门禁通过
  - [x] 核心 E2E（建房进局、密码入房）通过并复看截图
  - [x] 证据文档更新：`evidence/_shared/home-v2-query-entry-e2e-test.md`

- [x] **Phase C: 真机复核与交付**
  - [x] 重新打包 Android debug：`easyboardgame-debug.apk`
  - [x] 安装到用户设备成功（serial：`10ADAU063C0010U`）
  - [x] 真机复核截图补齐（首页/详情/建房弹窗整图已补齐）

## Addendum（2026-04-07）：Android 本地素材包图片加载故障

### Goal
> 修复 App 端“素材包已下载但进入游戏后图片仍全部加载中”的问题，确保前端能在未走大厅包管理 hook 的情况下接住已安装游戏包，并且不会把 Android `/_capacitor_file_/...` 本地路径误套进开发态图片 fetch/blob workaround。

### Phase

- [x] **Phase A: 链路排查与根因确认**
  - [x] 复核原生安装目录、前端 asset override 注入点、MatchRoom 关键图片加载链路
  - [x] 确认启动期 hydration 会跳过“未预注册 fallbackState 的已安装包”
  - [x] 确认 `OptimizedImage` 会把 `/_capacitor_file_/...` 本地包路径误走开发态 `fetch -> blob` workaround

- [x] **Phase B: 修复与回归**
  - [x] 修复 `hydrateInstalledNativeGamePackages()` 对已安装包的兜底 hydration
  - [x] 收窄 `OptimizedImage` 的 blob-fetch workaround，只保留开发态 public `/assets/...`
  - [x] 补定向测试并完成 eslint / vitest 校验

## Goal
> 分两阶段完成 Smash Up `Oops, You Did It Again` 四个派系（埃及、牛仔、武士、维京人）的完整交付：先完成图片 intake、可复刻工作流与静态接入；再按 `Ancient Egyptians → Vikings → Cowboys → Samurai` 的顺序逐派系实施正式玩法、补齐 UI、新交互类型 E2E、统一审计与证据留档。

## Phases

- [x] **Phase 1: 发现与设计（intake）**
  - [x] 阅读 AGENTS、OpenSpec、资产/录入/测试/审计规范
  - [x] 创建独立 worktree 与任务分支
  - [x] 盘点现有 Smash Up 图片接入链路、脚本、数据结构与目标素材
  - [x] 创建 OpenSpec proposal/tasks/design/spec delta

- [x] **Phase 2: 资产处理与录入（intake）**
  - [x] 锁定权威来源与图片清单，建立 Markdown 核对契约
  - [x] 完成图片压缩、图集/切片配置与资源落盘
  - [x] 完成 i18n / 静态数据 / atlas / faction metadata 的同步录入
  - [x] 沉淀“给一批图片即可录入”的复刻工作流文档

- [x] **Phase 3: 审计与验证（intake）**
  - [x] 对照描述、资源路径、加载链路做 intake 审计
  - [x] 运行相关 Vitest / 审计脚本
  - [x] 编写并运行相关 E2E，用截图留证
  - [x] 汇总 evidence、结果与残留风险

- [x] **Phase 4: 玩法提案与实施设计（gameplay）**
  - [x] 创建 `add-smashup-oops-faction-gameplay` OpenSpec 变更
  - [x] 明确用户要求的实施顺序：逐派系实现，全部完成后统一审计与 E2E
  - [x] 将 bury UI 与新交互类型纳入正式 scope
  - [x] 运行 `openspec validate add-smashup-oops-faction-gameplay --strict --no-interactive`
  - [x] 等待用户确认 proposal 后进入 `Ancient Egyptians`

- [x] **Phase 5: Ancient Egyptians**
  - [x] 补齐 card defs 元数据与 `abilityTags`
  - [x] 实现埋葬、翻开、替代去向与相关 base/action/minion ability
  - [x] 补齐 owner-visible bury UI 与对手隐藏占位
  - [x] 补领域测试与统一 E2E 证据收口

- [x] **Phase 6: Vikings**
  - [x] 按官方规则书 / Fandom 口径修正 defs、locale 与 ability metadata
  - [x] 实现 deck-top / discard / steal / extra-action 联动与相关基地能力
  - [x] 补领域测试并完成增量门禁验证
  - [x] 统一 E2E 与更严格语义收口已在四派系统一审计阶段完成

- [x] **Phase 7: Cowboys**
  - [x] 实现官方 duel 内核、move / destroy / ongoing draw 与相关 metadata
  - [x] 补决斗/目标选择最小交互断言
  - [x] 补完整 duel 浏览器 E2E 与证据收口

- [x] **Phase 8: Samurai**
  - [x] 按官方规则书 / Fandom 口径修正 defs、locale 与 ability metadata
  - [x] 实现 honor / duel / destroy / temporary-buff / ongoing draw 与相关基地能力
  - [x] Samurai 专项浏览器 E2E、临时触发精细语义与更严格审计已在统一审计阶段完成

- [x] **Phase 9: 统一审计与收尾**
  - [x] 四派系完成后再统一做 gameplay 审计
  - [x] 运行相关 Vitest / typecheck / OpenSpec 校验
  - [x] 运行覆盖新交互类型的 E2E 并留证
  - [x] 汇总最终 evidence、残留风险与后续扩展点

## Technical Decisions
| Decision | Rationale | Status |
| :--- | :--- | :--- |
| 使用独立 worktree `feat/smashup-base-faction-assets` | 根工作区已有并行任务与规划文件，隔离当前任务避免串改 | Approved |
| 使用 OpenSpec + planning-with-files 双轨记录 | 本次既要落地实现，也要沉淀可复刻流程和验收证据 | Approved |
| 以用户提供图片作为当前任务的直接权威来源 | 符合数据录入规范第 3 优先级，可直接用于资源与索引录入 | Approved |
| Smash Up 规则文本与审计必须走 Wiki 爬虫 | 项目专用强制规范，不能只凭图片或记忆录入 | Approved |
| 本轮 scope 以 intake/静态接入为准 | 用户要求整条资源接入链路，但 OpenSpec 已收束为图片、atlas、静态数据、文档、测试、E2E；不在本 change 内补完四派系完整 gameplay ability | Approved |
| `aiji.png` 按 `7x7`、`aiji_base.png` 按 `2x4` row-major 切片 | 已通过直接看图确认 48 张卡 + 1 尾格、8 张基地；后续 atlas/index 以此为唯一切片基准 | Approved |
| 武士基地 defId 使用 canonical 英文名，图面英文差异写入证据文档 | 图面为 `Kyuden Konbini / Sakura Shigemi`，TTS / Wiki canonical 为 `Shogun's Palace / Sakura Garden`；运行时名称与来源说明必须分离 | Approved |
| 先完整录入 locale 文本，再最小化卡牌结构标签 | 为避免把“未实现玩法”误录成“已实现 ability”，本轮卡牌 defs 仅承载图片、数量、力量、所属派系与最小结构，详细文本放入 locale | Approved |
| gameplay 以独立 OpenSpec change 推进，而不与 intake 混写 | intake 已完成并可单独验收；玩法补完涉及新交互类型、UI 与审计范围，必须单独建模 | Approved |
| gameplay 实施顺序固定为 `Ancient Egyptians → Vikings → Cowboys → Samurai` | 先打通 bury 主链路与 UI，再做 duel / movement / replacement，更容易收敛和审计 | Approved |
| bury UI 必须纳入 Ancient Egyptians 第一波范围 | 用户已指出吸血鬼 pod 时 bury 体系只有领域逻辑，没有正式 UI；若继续只做逻辑会重复留下未完成实现 | Approved |

## Critical Errors / Blockers
| Error | Impact | Resolution |
| :--- | :--- | :--- |
| 根工作区 `task_plan.md/findings.md/progress.md` 已服务其他任务 | 不能在原工作区继续维护本次计划 | 新建独立 worktree 承载本任务 |

## Addendum（2026-04-23）：Home V2 UI 视觉统一收口

### Goal
> 以 `936x432` 手机横屏作为唯一验收口径，完成 Home V2 “黑边、目录卡变平、登录右页外来感、建房弹窗越界”四类体验问题收口，并通过两条核心 E2E 证明流程可玩。

### Phase

- [x] **Phase A: 视觉基线回归**
  - [x] 目录卡改回九宫格边框（禁用 `background-image 100% 100%` 伪框）
  - [x] 左页目录固定 6 槽位双排骨架，保证第二排与第一排同节奏
  - [x] 详情页 tag 与按钮尺寸继续收敛，避免压住正文主信息
  - [x] 登录右页切成同材质内联容器，取消 embedded 自动聚焦引发的视口漂移

- [x] **Phase B: 舞台与背景收敛**
  - [x] 调整 HomeV2 手机横屏 presentation 参数（`scale=1.36`、`offsetYPct=1.5`）
  - [x] 移除 `bookClip` 裁切链路，恢复书本壳和翻页素材原始边界
  - [x] 收敛背景暗化强度，避免底部出现突兀纯黑硬边

- [x] **Phase C: 弹窗与端到端验证**
  - [x] 创建房间弹窗按 `--runtime-viewport-height` 控制 maxHeight，并加 `overscroll-contain`
  - [x] 通过 `eslint / typecheck / i18n:check`
  - [x] 两条核心 E2E（查询入口 + 密码入房）均通过并更新证据文档


## Addendum（2026-04-27）：Home V2 首页参考稿重构（二次，2388x1080 真移动端口径）

### Goal
> 不再使用 `936x432` 作为首页主验收口径，改为以 `2388x1080` 真实移动端横屏分辨率继续收口 Home V2 首页目录页，重点解决顶部导航节奏、右上角身份/工具入口、六个条目的纵向节奏以及参考裁图边缘脏边问题。

### Phase

- [x] **Phase A: 验收口径切换到真移动端**
  - [x] 将 `e2e/lobby.e2e.ts` 的 Home V2 默认横屏视口切换到 `2388x1080`
  - [x] 复跑首页查询入口 E2E，确认 `home-v2-viewport` 日志已变为 `2388x1080`

- [x] **Phase B: 2388x1080 首轮布局重排**
  - [x] 按真分辨率重新放大顶部导航与分类占位
  - [x] 按真分辨率重新放大六个目录条目、标题、简介与人数标签
  - [x] 将右上角账号/工具入口重新收进书页右上角，而不是沿用小视口补丁位置

- [x] **Phase C: 真分辨率回归验证**
  - [x] `npx eslint src/components/home-v2/LobbyDirectory.tsx e2e/lobby.e2e.ts` 通过（仅既有 fast-refresh warning）
  - [x] 使用 `PW_E2E_SERVICE_REUSE=shared-single + 37974/30180/30181` 复跑首页查询入口 E2E 并通过
  - [x] 复看 `homepage-catalog.png`，确认当前截图为 `2388x1080` 真移动端口径

- [ ] **Phase D: 下一会话继续精修**
  - [ ] 继续收右上角账号/工具入口的最终尺寸与相对位置
  - [ ] 继续收六条目的纵向节奏，让标题/简介/人数更贴近参考图
  - [ ] 对 `splendor / summonerwars` 裁图边缘再做最后一轮清边与构图收口
