## Addendum（2026-05-13）：Home V2 首页按 ig_0623 设计稿重做

### Goal
> 回应用户最新指定：`ig_0623cd92f8bdcbc0016a034df8b4c88199ae0c1276fee29f85.png` 才是要实现的首页设计稿。当前首页必须保留书本主轴、移动端横屏优先，并用真实 React DOM/CSS 实现 3+3 游戏目录、顶部分类索引、右上账号/语言、左页分页和右页继续对局；禁止贴图、搜索框、帮助、Logo、说明文案和“100 游戏说明”。

### Phase
- [x] **Phase A: 失败方向切断**
  - [x] 明确废弃“贴图基线 + 透明热区”口径
  - [x] 不再生成新图，不再把设计稿图片作为页面可见层
  - [x] 保存目标稿到 `artifacts/home-v2-design/home-v2-mobile-book-catalog-target.png`
  - [x] 继续禁止搜索、帮助、Logo 大标题、“100 游戏说明/游戏数量说明”等说明型 UI

- [x] **Phase B: 实现**
  - [x] 生成项目内宽版空书本背景 `public/assets/common/images/home-v2/book-catalog-wide/1.png`
  - [x] `HomeV2.tsx` / `HomeV2Draft.tsx` 首页背景切到宽版空书本，overview stage 恢复上一版 `1864x843`
  - [x] `LobbyDirectory.tsx` 改成 `ig_0623` 结构：左页顶部分类线、右页账号 + 语言、左右 3+3 六条目录、左页底部分页、右页底部继续对局
  - [x] `全部游戏` 只显示 `type === 'game'`，不再混入架构可视化、素材切片机等工具项目
  - [x] 分类文案改为 `全部`，active 态使用页眉选中线/小菱形，不再使用大绿色书签块
  - [x] 删除搜索框、在线大厅第二按钮和底部游戏数量说明
  - [x] 调整条目纵向位置，减少移动横屏上半页空白

- [x] **Phase C: 验证**
  - [x] ESLint
  - [x] Typecheck
  - [x] 同一条 Home V2 移动横屏 E2E
  - [x] 人工复看 `homepage-catalog.png`，确认真实 DOM 已按 `ig_0623` 方向改变：无贴图、无搜索/说明/帮助/Logo，6 个游戏为 3+3，工具未混入全部游戏

- [x] **Phase D: 设计稿逐项对齐规范**
  - [x] 建立本轮视觉对比清单：底部分页与继续对局必须同一中心线；左侧 active 分类必须是页眉分割线上的选中线 + 居中小菱形；不得只凭“大结构像”收口
  - [x] E2E 增加 `bottomControlCenterDelta`、`activeRuleWidthRatio`、`activeRuleHeaderTopDelta`、`activeTextToRuleGap`、`activeMarkerCenterDelta`、`activeRuleMarkerCenterDelta` 量测，避免再次漏看底部和选中态细节
  - [x] 将 active 线/标记从按钮内部拆出，固定到页眉分割线坐标，避免把设计稿里的页眉选中线误当成文字下划线
  - [x] 重新跑 E2E 并复看 `homepage-catalog.png`
  - [x] 回写证据，明确每个被指出的问题位点是否达标

- [x] **Phase E: 登录弹窗设计稿前置盘点**
  - [x] 读取真实 `AuthModal.tsx` / `auth.json`，确认现有登录、注册、重置密码字段与按钮
  - [x] 更新 UI/UX 规范：生图前必须盘点真实 UI 内容，禁止凭常见登录页模式添加不存在的第三方登录、协议勾选、帮助说明等控件
  - [x] 基于真实 AuthModal 内容重新生成登录弹窗设计稿；登录走 modal 覆盖，在线大厅继续走书本
  - [x] 复看生成稿，确认前景只包含真实登录态字段；背景书本大厅已压暗虚化，避免再生成可读的假游戏名

- [x] **Phase F: 登录弹窗实现**
  - [x] 账号入口改为打开 `AuthModal` 覆盖层，不再把登录表单嵌进书页右页
  - [x] `AuthModal` 非 embedded 样式改成紧凑羊皮纸弹窗：暗金细边、小角饰、盒式输入框、深色主按钮
  - [x] E2E 改为验证 `auth-modal` 覆盖书本大厅、`auth-embedded-panel` 不存在、登录态只包含真实字段和登录/注册切换
  - [x] 复看 `auth-modal-overlay.png`，确认书本大厅仍在背景、modal 内容未出现第三方登录/协议勾选/说明区
  - [x] 用户指出弹窗过小后，补目标稿量测：目标 modal 图片量测 `0.2808w / 0.6275h`，当前截图图片量测 `0.2768w / 0.6120h`；E2E DOM 量测 `0.266w / 0.588h`，并把门禁改为参考图比例区间
  - [x] 更正规范落点：`ui-ux.md` 只保留入口提醒；新增 `docs/ai-rules/generated-design-implementation.md` 作为“生图设计稿 -> 实现设计稿”的专项流程
  - [x] 打开截图目录，并复制唯一命名截图 `auth-modal-overlay-20260514-inner-rhythm.png`，避免同名覆盖导致图片查看器缓存误判
  - [x] 为“实现校验”新增项目级 skill：`.windsurf/skills/generated-design-implementation/SKILL.md`，要求同时量外框比例和内部节奏
  - [x] 修正登录态内部节奏：不再让 `body` 吃满剩余高度，`forgot` 到 `submit` 间隙收敛，按钮回到设计稿的中下部位置

- [x] **Phase G: 详情/在线大厅书页网格重构**
  - [x] 读取真实 `GameDetails.tsx` 和当前 `detail-entry.png`，确认详情页实际是左页游戏上下文 + 右页房间账本
  - [x] 更正生图 skill：主次不允许打破既有左右平衡；非必要控件不能默认进入生成稿；推荐人数/筛选/底部统计不得被放大成主角
  - [x] 再次更正生图 skill / UIUX：看实际内容是继承内容职责，不是照搬旧载体版式；同级 tab 禁止一大一小，active 态必须保持同一视觉语法
  - [x] 根据用户纠偏停止继续生图，直接重构 `GameDetails.tsx`：左页改为横向封面 + 标题信息 + 正文 + 教程行动的书页网格；右页移除筛选胶囊和底部统计，只保留同级 tab、搜索、创建房间和房间账本
  - [x] E2E 增加详情页布局量测：左页 hero 宽度/顶部、正文顶部、教程按钮顶部、右页账本顶部、tab 字号/基线/高度差、筛选按钮数量
  - [x] 更新生成设计到实现 skill：实现阶段必须量支持区域占位和空白占比，不能让次级区域变成窄内容带 + 大空白
  - [x] 重新按目标稿复核后修正根因：详情页切回宽书本载体，左页 footer 上移收口，右页账本补列分割线
  - [x] 重新跑 ESLint、Typecheck、同一条 Home V2 E2E，并复看 `detail-entry-20260515-wide-ledger.png`
  - [x] 生成同尺度并排图 `artifacts/home-v2-design/compare-crops/detail-target-current-side-by-side-final.png`，作为设计稿实现验收证据
  - [x] 根据用户反馈修正两个细节：返回入口改为轻量 `← 返回目录` 文本，不再是深色胶囊按钮；推荐人数改为 V1 风格数字方框，不再使用横向长条
  - [x] E2E 增加返回按钮背景/宽度和人数方框数量/宽高比量测，并复看 `detail-entry-20260515-back-player-boxes.png`
  - [x] 用户继续指出返回和创建房间按钮过小后，先放大热区；随后纠正动作语义：返回入口按目标稿保持透明轻量导航，不强加按钮背景；创建房间仍作为主操作 prominent 按钮，并补 `backButtonBackgroundAlpha/BorderWidth/Height/WidthRatio/FontSize` 与 `createRoomButtonHeight/WidthRatio/FontSize` 门禁
  - [x] 放大按钮后同步收紧左页简介和右页搜索/账本垂直节奏，避免只修按钮却把内容整体下推
  - [x] 更新生成设计到实现 skill/规范：主操作和导航入口不能因为书本风格被压成装饰性小标签，也不能用固定 px 尺寸冒充已按设计稿比例缩放；同时必须区分动作类型，不能把返回这类轻量导航误套成深色按钮背景

- [x] **Phase H: 详情页其他标签页与创建房间弹窗收口审计**
  - [x] `CreateRoomModal` 可作为通用组件，Home V2 通过 `visualStyle="home-v2"` 保持书本/羊皮纸风格统一，并生成 `detail-create-room-modal-20260516.png`
  - [x] 右页 `更新 / 评价 / 排行榜` 三个标签页已接入真实数据源和 Home V2 书页面板，不添加假数据，并分别生成 `detail-tab-changelog-20260516.png`、`detail-tab-reviews-20260516.png`、`detail-tab-leaderboard-20260516.png`
  - [x] E2E 验证切换上述标签页不触发翻页：`home-v2-fold-line-flip` 保持 `data-flip-mode="detail"` 且 `data-turn-animating="false"`
  - [x] 完成审计：上述截图均来自 2026-05-16 09:54 最新 E2E 运行，已实际打开复看

- [x] **Phase I: V2 首页剩余遗漏审计**
  - [x] `继续对局` 从假 `#A12F` 改为读取真实本地 match credentials / owner active match，并可直接进入真实对局
  - [x] 右上语言入口从假按钮改为真实语言菜单，切换后写入 `bg_locale_preference` 并调用 `i18n.changeLanguage`
  - [x] 账号入口保持“登录走弹窗，大厅走书本”，`HomeV2.tsx` 不再渲染旧 rooms 内嵌登录分支
  - [x] 加密房密码输入改为右页覆盖浮层，不再散在右页底部；E2E 量测 `centerYRatio=0.50`、输入框 `54px`
  - [x] 登录弹窗补注册/重置态截图验收，确认邮箱、验证码、昵称/新密码、确认密码等真实字段可见
  - [x] 静态检查通过；Home V2 两条目标 E2E 单独复跑通过并复看截图
  - [x] 记录剩余非阻塞项：`/dev/home-v2-authoring` 的 `HomeV2Draft.tsx` 仍保留旧 authoring/内嵌登录实现；`lobby.e2e.ts` 整文件混有旧大厅断言，Home V2 环境下 5 条旧用例失败，需要后续按 V1/V2 拆分或改造

- [ ] **Phase J: V2 首页/详情最终遗漏复查**
  - [x] 复看最新首页、详情、登录、创建房间、密码浮层和其它 tab 截图本体，不再只依赖 E2E 断言
  - [x] 代码检索旧 `GameDetailsModal` 与 Home V2 `GameDetails` 的功能差异
  - [x] 用户纠偏后重做 Home V2 弹窗统一：`AuthModal` / `CreateRoomModal` 复用共享纸面 modal 壳层与通用输入/按钮 token，并用专项 E2E 复验设计稿方向与键盘稳定性
  - [x] 按设计稿重新确认登录 / 创建房间 / 加密房密码三类弹窗：统一为整本书/视口中心的实心纸面 modal，并恢复目标稿要求的压暗 + 轻 blur 背景
  - [x] 用户否定“可实现目标稿”后，直接回到原始 `home-v2-auth-modal-target.png` 实现：登录标题、输入框、按钮、边框/角饰和底部切换按原稿收敛；密码弹窗按内容高度收短但保持同壳层居中
  - [x] 修正移动端全局 `16px !important` 输入规则对 Home V2 纸面 modal 的污染：只在 `.home-v2-paper-modal-frame` 内局部覆盖，避免端到端截图和真机移动端密度继续不一致
  - [x] 最新复跑登录/创建房间统一弹窗与加密房密码专项 E2E，复看截图并回写 `evidence/_shared/home-v2-auth-modal-compact-landscape-e2e-test.md`
  - [x] 继续对齐 Home V2 详情页目标稿：移动横屏 compact 下恢复左页简介/推荐人数，右页房间账本从大卡片列表压回表格密度，并把行高/缩略图/操作按钮纳入 E2E 门禁
  - [x] 新增 `docs/ai-rules/home-v2-design.md` 专项规范，并按该规范继续压详情页：左页缩略图从抢空间改为辅助视觉，描述宽度扩到正文区，教程/创建房间按钮重构为书页控件
  - [x] 按用户最新反馈继续重构详情页搜索和按钮：搜索框改成窄幅书页线框，创建房间下沉到搜索行，房间行内操作统一为书本小按钮；复跑移动横屏专项 E2E 并复看截图
  - [x] 继续按局部截图修正教程/创建/搜索：教程降为纸面次级线性按钮，搜索改为单底线并修正图标对齐，创建房间压薄但保留主操作语义
  - [x] 按用户最新指出的“所有按钮叠层、教程不显眼、人数用 V1 方块、搜索图标歪/输入框怪”继续收敛：按钮统一成单层书本动作语法，状态改为非按钮状态戳，推荐人数保持数字方块，搜索框加入底线与图标居中门禁
  - [x] 确认 Home V2 当前先隐藏 `package-managed` 包管理入口：旧 V1 逻辑保留，V2 书页详情不再展示下载卡片、绿色版本徽记或安装确认弹窗
  - [x] 将 Home V2 包管理专项 E2E 改成隐藏态保护：验证详情左页不显示包管理区域、版本徽记和安装确认弹窗
  - [ ] 决定 `/dev/home-v2-authoring` 的 rooms/auth authoring 分支是否继续保留旧书页登录预览；若要作为 V2 设计入口，也需要跟主链路统一为 modal
  - [ ] 拆分或改造 `lobby.e2e.ts` 中 V1 旧大厅断言与 Home V2 专项断言，避免整文件在 Home V2 环境下长期不绿

## Addendum（2026-05-12）：Home V2 移动横屏首页目录重构

### Goal
> 直接实现用户要求的首页重构：保留书本主轴，面向移动横屏，使用现有首页 UI 元素，删除帮助/说明/“100 游戏说明”等无中生有内容，让首页成为简洁可实现的书本目录页。

### Phase
- [x] **Phase A: 约束收敛**
  - [x] 不再生成设计图，直接改实现
  - [x] 只围绕现有目录元素重排：分类、账号、游戏条目、标签、人数、分页
  - [x] 明确禁止帮助入口和说明文案占据首页

- [x] **Phase B: 实现**
  - [x] 删除 `LobbyDirectory.tsx` 的帮助按钮
  - [x] 删除空状态说明正文
  - [x] 保存新图到 `artifacts/home-v2-design/home-v2-mobile-book-catalog-reference.png`
  - [x] 按新图实现书签分类、左页搜索、右上账号设置、条框目录、底部分页和在线大厅入口
  - [x] 将首页目录改为分类过滤 + 搜索过滤 + 分页切片；`全部游戏` 纳入现有启用条目，首屏按左右各四条展示

- [x] **Phase C: 验证**
  - [x] `npx eslint src/components/home-v2/LobbyDirectory.tsx src/pages/HomeV2.tsx src/pages/HomeV2Draft.tsx e2e/lobby.e2e.ts`
  - [x] `npm run typecheck`
  - [x] 同一条 Home V2 移动横屏 E2E
  - [x] 人工复看 `homepage-catalog.png` 与 `catalog-return-after-flip.png`
  - [x] 回写 `evidence/_shared/home-v2-query-entry-e2e-test.md` / `progress.md` / `findings.md`

## Addendum（2026-05-12）：Home V2 turn.js 翻页 checkpoint 提交

### Goal
> 在用户确认“效果还行，可以先提交一版”后，先固化当前 turn.js 插件翻页版本。当前提交口径：使用 turn.js 插件生成翻页；翻页中保留完整书本壳；中间态不保留真实业务 UI，避免 UI 乱飞；稳态恢复真实目录/详情 UI。

### Phase
- [x] **Phase A: 用户反馈确认**
  - [x] 承认“保留 UI 会乱飞”的视觉反馈成立
  - [x] 明确当前先提交空白纸面翻页 checkpoint，不继续在本轮追求 live UI 跟纸翻

- [x] **Phase B: 进度与原因留档**
  - [x] `progress.md` 记录本 checkpoint 取舍
  - [x] `findings.md` 记录 turn.js page-wrapper 重排导致 UI 乱飞的根因

- [x] **Phase C: 提交**
  - [x] 仅暂存 Home V2 turn.js 翻页相关代码、E2E、证据/进度文档和 vendor 脚本
  - [x] 完成 git commit

## Addendum（2026-05-12）：Home V2 翻页改回 turn.js 插件

### Goal
> 回应用户“不是让你用插件翻页吗”的明确纠偏，废弃 2026-05-11 的序列帧收口口径。完成口径：正反向 `25 / 50 / 75` 六帧必须由 turn.js 插件可见折页生成，截图日志能证明插件处于 animating 状态，画面不能再像两本书/两套 UI 平铺。

### Phase
- [x] **Phase A: 否定序列帧路线**
  - [x] 明确 `page-flip-left/right` 序列帧方案作废
  - [x] 不再把“E2E 通过 + 序列帧六帧”作为收口证据

- [x] **Phase B: 恢复 turn.js 可见翻页**
  - [x] `FoldLinePageFlipStage.tsx` 使用 `jquery 1.12.0` + `turn.js 4.1.0`
  - [x] 翻页态挂载真实 `display: double` flipbook
  - [x] turn.js page 使用翻页专用纸面 stage，避免业务 UI 贴在翻动页上
  - [x] 对 turn.js `turning` 动画补线性 easing，让 25 / 50 / 75 对应可见折页进度
  - [x] E2E 抓帧日志补 `pluginPage/pluginView/pluginAnimating/pageWrappers`
  - [x] 补回 flipping state 的完整书本壳底层，避免翻页时只剩内页、外层书本消失

- [x] **Phase C: 验证与留档**
  - [x] `npx ctx7@latest library turn.js ...`
  - [x] `npx ctx7@latest docs /websites/turnjs ...`
  - [x] `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx src/pages/HomeV2Draft.tsx src/pages/HomeV2.tsx e2e/lobby.e2e.ts`
  - [x] `npm run typecheck`
  - [x] `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=600000 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"`
  - [x] 人工复看正反向六张插件翻页截图与 `detail-entry.png`
  - [x] 回写 `evidence/_shared/home-v2-query-entry-e2e-test.md / findings.md / progress.md / task_plan.md`

## Addendum（2026-05-11）：Home V2 翻页改用真实序列帧（已被 2026-05-12 turn.js 插件方案取代）

### Goal
> 回应用户“明显就不像翻页”的最新反馈，废弃 CSS 平面纸片作为最终翻页效果，改用项目已有 `page-flip-left/right` 序列帧。完成口径：正反向 `25 / 50 / 75` 六帧里能看到真实书页翻动的页边、阴影和跨书脊推进；翻页过程中不渲染业务 UI 到纸面上。

### Phase
- [x] **Phase A: 否定上一版 CSS 纸片**
  - [x] 复看上一版 25 / 50 / 75，确认像平面滑片/裁切片，不足以收口
  - [x] 保留“翻页期间隐藏业务 UI”的正确方向

- [x] **Phase B: 切到序列帧翻页**
  - [x] `FoldLinePageFlipStage.tsx` 新增 `PageFlipSequenceOverlay`
  - [x] 正向使用 `page-flip-left/compressed/*.webp`
  - [x] 反向使用 `page-flip-right/compressed/*.webp`
  - [x] 按 `progress` 映射 `1..8` 帧
  - [x] 修正序列帧覆盖层比例，避免“中间小书盖大书”

- [x] **Phase C: 验证与留档**
  - [x] `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx src/pages/HomeV2Draft.tsx src/pages/HomeV2.tsx e2e/lobby.e2e.ts`
  - [x] `npm run typecheck`
  - [x] `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=600000 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"`
  - [x] 人工复看正反向六张截图
  - [x] 回写 `evidence/_shared/home-v2-query-entry-e2e-test.md / findings.md / progress.md / task_plan.md`

## Addendum（2026-05-10）：Home V2 多帧翻页语义收口

### Goal
> 按用户最新反馈，把 Home V2 翻页验收从单张 50% 扩展为正反向 `25 / 50 / 75` 六帧，并修掉“source 和 target 两边同时平铺显示”的结构问题。完成口径：底层是目标完整 spread，顶层只允许单张来源离场页片，且页片随进度连续收缩。

### Phase
- [x] **Phase A: 多帧证据升级**
  - [x] `e2e/lobby.e2e.ts` 固定抓取正向 `25 / 50 / 75`
  - [x] `e2e/lobby.e2e.ts` 固定抓取反向 `25 / 50 / 75`
  - [x] 每次释放冻结后等待 `data-flip-mode` 回到目标稳态，再进入下一轮

- [x] **Phase B: 翻页分层重判**
  - [x] 废弃“source 静态页 + target reveal + 纸片”的多语义叠层
  - [x] 翻页态底层改为目标完整 spread
  - [x] 顶层改为唯一来源离场页片
  - [x] `PagePaperCover` 改为随 progress 收缩的弧形页片，不再是固定矩形白板

- [x] **Phase C: 验证与留档**
  - [x] `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx src/pages/HomeV2Draft.tsx src/pages/HomeV2.tsx e2e/lobby.e2e.ts`
  - [x] `npm run typecheck`
  - [x] `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=600000 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"`
  - [x] 人工复看正反向六张截图
  - [x] 回写 `evidence/_shared/home-v2-query-entry-e2e-test.md / findings.md / progress.md / task_plan.md`

## Addendum（2026-05-02）：Home V2 方案 B 最终收口（翻页层只翻纸）

### Goal
> 在 `feat/homepage-v2` 工作树内，把 Home V2 首页翻页链路从“50% 虽然抓准了，但 UI 还贴在翻页层上”继续收口到用户要求的最终语义：**UI 不动，翻的是纸**。只处理首页目录 <-> 详情这条链路，并在真移动端横屏口径下重新做端到端验收。

### Phase
- [x] **Phase A: 重新裁决根因**
  - [x] 承认上一轮问题不只是抓帧误差，而是翻页层里仍带着 live UI
  - [x] 停止继续调折角参数，切到方案 B：底层 UI 静止、顶层只翻纸张

- [x] **Phase B: 改写可见翻页层**
  - [x] `src/components/home-v2/FoldLinePageFlipStage.tsx` 删除本轮可见翻页层对 live stage 的依赖
  - [x] 翻页中间态改为纯纸张层 + 阴影层 + 高光层
  - [x] 保留 turn.js runtime 与 50% 冻结抓帧能力，不再让翻页层承载真实 UI 内容

- [x] **Phase C: 真横屏验收与回写**
  - [x] `npx eslint .\src\components\home-v2\FoldLinePageFlipStage.tsx .\e2e\lobby.e2e.ts`
  - [x] `npm run typecheck`
  - [x] `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"`
  - [x] 复看 `page-flip-to-detail-50.png / page-flip-back-to-catalog-50.png / homepage-catalog.png / detail-entry.png`
  - [x] 回写 `evidence/_shared/home-v2-query-entry-e2e-test.md / findings.md / progress.md / task_plan.md`

## Addendum（2026-05-01）：Home V2 翻页改成 page-owned content（修正 UI 挡住折角）

> 用户最后一轮指出的问题是对的：之前不是单纯 z-index，而是 **UI 没有属于被翻的那张纸**。这轮只继续在 `feat/homepage-v2` 工作树内修正翻页层归属，让翻页时移动的是 page 自己的内容，而不是底层完整 UI 上再贴一个 curl。

- [x] **Phase A: 按 turn.js page 结构重判归属**
  - [x] 复查 turn.js 文档：page HTML 本来就应放在各自 page element 内，翻动的是 page 自身
  - [x] 确认旧实现的问题是 `baseStage(完整 detail UI) + curl overlay(再贴一层)`，导致 25% 中间帧像“UI 盖在纸上”

- [x] **Phase B: 重写可见翻页层**
  - [x] `src/components/home-v2/FoldLinePageFlipStage.tsx` 改为 `shell + static pages + turning sheet(front/back)`
  - [x] 正向翻页：`overview right page -> detail left page(backface)`，`detail right page` 作为底层被揭开页
  - [x] 反向翻页：`detail left page -> overview right page(backface)`，`overview left page` 作为底层被揭开页
  - [x] 保留 `turn.js` / `jquery 1.12.0` 官方运行时接线，不再把旧错误的可见层结构当最终实现

- [x] **Phase C: 真移动端横屏验证与回写**
  - [x] `npm run typecheck`
  - [x] `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"`
  - [x] 复看关键截图并回写 `evidence/_shared/home-v2-query-entry-e2e-test.md`、`findings.md`、`progress.md`


## Addendum（2026-04-30）：Home V2 首页折角与翻页最终收口

### Goal
> 在 `feat/homepage-v2` 工作树内继续只收首页，把首页/详情 steady state 的折角与首页 <-> 详情的翻页中间帧一起压到可端到端验收：移动端横屏、内容留在书本里、不再出现 turn.js overlay 那种中间小册子。

### Phase
- [x] **Phase A: 折角/翻页根因定位**
  - [x] 确认 turn.js 官方脚本接线已成功落地，但直接常驻 overlay 会把正文区压成中间小册子
  - [x] 确认 React 复用被 turn.js 改写过的 DOM 会触发 `The page 2 does not exist`
- [x] **Phase B: 可见层裁决**
  - [x] 保留官方 `turn.js + jquery 1.12.0` 脚本接线
  - [x] steady state 改为前端折角样式
  - [x] flipping state 改为前端整页折页 sheet，可见中间帧不再是小矩形块
- [x] **Phase C: 验证与留档**
  - [x] `eslint` + `typecheck` 通过
  - [x] 首页 -> 详情 -> 返回目录 E2E 通过
  - [x] 复看 `homepage-catalog / page-flip-to-detail-25 / detail-entry / page-flip-back-to-catalog-25 / catalog-return-after-flip`
  - [x] 回写 `task_plan.md / findings.md / progress.md / evidence/_shared/home-v2-query-entry-e2e-test.md`

## Addendum（2026-04-30）：Home V2 翻页切到官方 turn.js（移动端横屏）

### Goal
> 停止继续使用自制 `rotateY` 翻页作为最终实现，把 Home V2 的 `overview -> detail -> overview` 正式切到 `turnjs.com` 官方插件路线；同时保留当前首页/详情真实 DOM 内容，并确保书本舞台继续统一为首页标准尺寸。

### Fixed References
- 本地参考图：
  - `D:\gongzuo\webgame\gameasset\v2首页参考\首页.png`
  - `D:\gongzuo\webgame\gameasset\v2首页参考\详情页.png`
  - `D:\gongzuo\webgame\gameasset\v2首页参考\登录注册.png`
  - `D:\gongzuo\webgame\gameasset\v2首页参考\background.png`
- 官方翻页参考：
  - `http://www.turnjs.com/#`
  - `https://juejin.cn/post/6844903665216520206`

### Phase
- [x] **Phase A: 锁官方插件路线**
  - [x] 读取 turn.js 官方 / Context7 资料，确认必须走 jQuery 插件初始化路线
  - [x] 明确不再把自制 `FoldLinePageFlipStage` 视觉参数调优当最终方向
- [x] **Phase B: 接入官方脚本并替换运行时**
  - [x] 在 `public/vendor/turnjs/turn.min.js` 落官方 `turn.js 4.1.0` 脚本
  - [x] 将 Home V2 翻页 runtime 改为 `jquery 1.12.0 + 官方 turn.min.js` 动态注入
  - [x] 首页与详情 steady state 共用统一 `bookStageLayout`，保持整本书尺寸一致
- [x] **Phase C: 验证与证据**
  - [x] 运行 `eslint` / `typecheck`
  - [x] 复跑 `homeV2Draft 查询参数会切到 V2 首页并可进入详情页`
  - [x] 回看首页 / 详情 / 正反向翻页截图，并回写 evidence / findings / progress

## Addendum（2026-04-29）：Home V2 详情页书本尺寸统一到首页标准

### Goal
> 把 Home V2 详情页的书本整体舞台尺寸统一到和首页目录页相同的标准，不再让首页是 `1672x941`、详情页却继续按旧 `896x720` 基线缩放；改完后复跑同一条首页->详情 E2E，并把结果回写计划与证据。

### Phase

- [x] **Phase A: 根因确认**
  - [x] 确认首页 `overview` 舞台已经按 `1672x941` 基线 fit
  - [x] 确认详情 `detail` 舞台仍错误使用 `896x720` 基线
  - [x] 确认 `overview-spread/1.png` 与 `book-idle/1.png` 的实际图尺寸都属于首页同一套书本标准

- [x] **Phase B: 舞台统一**
  - [x] `src/pages/HomeV2.tsx` 删除 detail 对旧 `896x720` 基线的依赖
  - [x] detail 舞台切到和首页一致的 `1672x941` 标准比例与缩放基线
  - [x] 保留详情页左右内容区 rect，不在本轮扩散重排 detail 内容结构

- [x] **Phase C: 验证与留档**
  - [x] 运行 `npx eslint src/pages/HomeV2.tsx`
  - [x] 复跑 `homeV2Draft 查询参数会切到 V2 首页并可进入详情页`
  - [x] 复看 `homepage-catalog.png` 与 `detail-entry.png`，确认首页和详情页书本整体占画面比例已回到同一标准
  - [x] 回写 `task_plan.md / findings.md / progress.md / evidence/_shared/home-v2-query-entry-e2e-test.md`

## Addendum（2026-04-28）：Home V2 井字棋缩略图去假收口（2388x1080）

### Goal
> 在首页目录页继续清掉剩余假缩略图，把 `tictactoe` 从前端生成霓虹占位图切到真实游戏截图封面链路，同时不破坏当前首页布局和详情入口。

### Phase

- [x] **Phase A: 真缩略图来源确认**
  - [x] 确认 `evidence/tictactoe/screenshots/tictactoe.png` 是实际游戏画面截图，可作为封面源
  - [x] 确认当前 `tictactoe` 仍走 `NeonTicTacToeThumbnail`，不符合“去掉假东西”的收口口径

- [x] **Phase B: Canonical 封面接线**
  - [x] 生成 `public/assets/i18n/zh-CN/tictactoe/thumbnails/cover.png` 与 `compressed/cover.webp`
  - [x] `src/games/tictactoe/manifest.ts` 增加 `thumbnailPath: 'tictactoe/thumbnails/cover'`
  - [x] `src/games/tictactoe/thumbnail.tsx` 改为复用 `ManifestGameThumbnail`

- [x] **Phase C: 回归验证**
  - [x] ESLint 通过（0 error）
  - [x] 首页 E2E 通过并复看 `homepage-catalog.png`
  - [x] 回写 `task_plan.md / findings.md / progress.md / evidence/_shared/home-v2-query-entry-e2e-test.md`

## Addendum（2026-04-28）：Home V2 详情页 + 翻页效果完全重构（参考图一致）

### Goal
> 在 `feat/homepage-v2` 工作树内，以 `D:\gongzuo\webgame\gameasset\v2首页参考` 中的详情页 / 登录注册 / 建房密码 / 总览流程参考稿为准，继续推进 Home V2 的**详情页与翻页体验完全重构**：保持首页目录页作为已收口基线，只把后续链路重构到与参考图同一套书本体验，不沿用旧壳子拼补。

### Phase

- [ ] **Phase A: 参考稿与现状对齐**
  - [x] 锁定参考素材目录，并确认后续不止首页：至少包含详情页、登录注册、建房/密码面板、总览流程稿
  - [x] 参考图主目录固定为 `D:\gongzuo\webgame\gameasset\v2首页参考\`
  - [x] 当前对照使用的参考图文件固定为：
    - `D:\gongzuo\webgame\gameasset\v2首页参考\首页.png`
    - `D:\gongzuo\webgame\gameasset\v2首页参考\总览首页.png`
    - `D:\gongzuo\webgame\gameasset\v2首页参考\详情页.png`
    - `D:\gongzuo\webgame\gameasset\v2首页参考\登录注册.png`
    - `D:\gongzuo\webgame\gameasset\v2首页参考\创建房间.png`
    - `D:\gongzuo\webgame\gameasset\v2首页参考\输入密码.png`
    - `D:\gongzuo\webgame\gameasset\v2首页参考\background.png`
  - [x] 复核移动端 / UI 约束，确保改动只在受限视口条件下压缩，不影响桌面端默认基线
  - [x] 确认当前首页已经切到独立 spread 渲染，但详情页 / 翻页仍主要依赖旧 `book-idle + page-flip-left/right` 壳层

- [x] **Phase B: 详情页重构**
  - [x] 对齐参考稿详情页的信息层级：左页游戏标题/摘要/标签，右页房间列表/操作区/密码区
  - [x] 先用独立 exact spread + detail 专用排版收掉主要视觉差距，避免继续把首页 spread / 旧 idle 壳混用
  - [x] 保持从首页进入详情、加入房间、创建房间的真实链路不退化

- [ ] **Phase C: 翻页体验重构**
  - [ ] 以参考稿“封面 -> 目录 -> 详情”的书本路径重整状态机与动画节点
  - [x] 区分首页目录 spread、详情页 spread、翻页中间帧，不再让多个状态共用同一静态壳造成视觉错位
  - [x] 目录页 / 登录页 / 详情页 steady state 不再渲染右侧书签语义，统一改为顶部导航 + 页内返回入口

- [x] **Phase D: 验证与留档**
  - [x] 跑首页到详情的 E2E，并补详情关键截图证据
  - [x] 按 `2388x1080` 真横屏口径复验详情页主链路
  - [x] 回写 `task_plan.md / findings.md / progress.md / evidence/_shared/home-v2-query-entry-e2e-test.md`

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

## Addendum（2026-04-30）：Home V2 登录页 / 详情页二次压稿（移动端横屏）

### Goal
> 继续沿 `D:\gongzuo\webgame\gameasset\v2首页参考\登录注册.png` 与 `详情页.png` 收 Home V2 的 rooms/login 与 detail 两个 steady state：去掉过强卡片感，提升右页表单可读性，并把详情左页正文/按钮与右页房间表密度继续压回书页稿方向。

### Phase

- [x] **Phase A: rooms/login steady state 改回书页语义**
  - [x] 左页底部模式切换从厚按钮改成低存在感文字导航
  - [x] 右页移除大白卡式容器，认证表单改回页内直排结构
  - [x] 认证区继续保留真实前端输入链路与现有 E2E 选择器

- [x] **Phase B: detail steady state 继续压稿**
  - [x] 左页缩短纵向节奏，保证封面 / 标题 / 描述 / 推荐人数 / 教程按钮首屏完整落在书页内
  - [x] 右页房间表压缩列宽、行高与按钮尺寸，降低“现代卡片列表”感
  - [x] 保留 Dice Throne 真实房间链路，不回退成假数据/假详情

- [x] **Phase C: 回归验证与留档**
  - [x] `npx eslint src/components/home-v2/HomeTabPanels.tsx src/components/home-v2/GameDetails.tsx src/components/auth/AuthModal.tsx`
  - [x] `npm run typecheck`
  - [x] 复跑 `homeV2Draft 查询参数会切到 V2 首页并可进入详情页`
  - [x] 复看 `rooms-auth-entry.png` / `detail-entry.png` / `homepage-catalog.png`
  - [x] 回写 `task_plan.md / findings.md / progress.md / evidence/_shared/home-v2-query-entry-e2e-test.md`

## Addendum（2026-04-30）：Home V2 翻页结构改为页级 rotateY（按掘金折线翻页思路）

### Goal
> 不再让整张 spread 的内容一起跟着翻页层运动；翻页改成“静态底页 + 单张纸 front/back + rotateY 折线翻转”的页级结构，方向参考掘金文章《怎么实现一个3d翻书效果》：https://juejin.cn/post/6844903665216520206

### Phase

- [x] **Phase A: 根因定位**
  - [x] 确认旧实现把整张 `sourceStage/targetStage` 塞进单页 rect 内做 3D 旋转，导致目录与详情内容一起被压进翻页层运动
  - [x] 确认目标应改成“单张纸 front/back 裁切 + rotateY”，而不是继续调旧参数

- [x] **Phase B: 结构重写**
  - [x] `FoldLinePageFlipStage.tsx` 改成页级裁切：base stage、revealed target page、turning source front、turning target back
  - [x] `HomeV2.tsx` 补 stage size / leftPageRect / rightPageRect 传参，停止把整张 stage 直接塞入单页翻转层
  - [x] 保留当前首页/详情 steady state 与 E2E 链路，不扩散去改业务状态机

- [x] **Phase C: 验证**
  - [x] `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx src/pages/HomeV2.tsx e2e/lobby.e2e.ts`
  - [x] `npm run typecheck`
  - [x] 复跑 `homeV2Draft 查询参数会切到 V2 首页并可进入详情页`
  - [x] 复看 `page-flip-to-detail-50.png` / `page-flip-back-to-catalog-50.png` / `detail-entry.png`

## Addendum（2026-05-02）：Home V2 50% 半页折页收口

### Goal
> 以用户最终口径收口 Home V2 首页翻页：50% 中间帧必须看出半页翻起、目标页 UI 静止、折页压在 UI 上层，且首页/详情 steady state 不回退。

### Phase

- [x] **Phase A: 废弃旧 25% 收口口径**
  - [x] 改以 50% 中间帧作为唯一翻页验收口径
  - [x] 明确旧“小角贴层”结论失效，不能再作为本轮收口依据

- [x] **Phase B: 半页折页可见层重构**
  - [x] 保留 `turn.js` runtime 与现有首页/详情状态机
  - [x] 重做 `FoldLinePageFlipStage.tsx` 的可见层：底层目标页 + 中层 source 裁切 + 顶层大面积纸张折页遮挡层
  - [x] 增加最短可见动画时长门槛，保证 50% 中间帧稳定可截图

- [x] **Phase C: 真移动端横屏验收**
  - [x] `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx`
  - [x] `npm run typecheck`
  - [x] 复跑 `homeV2Draft 查询参数会切到 V2 首页并可进入详情页`
  - [x] 复看 `page-flip-to-detail-50.png` / `page-flip-back-to-catalog-50.png` / `homepage-catalog.png` / `detail-entry.png`
- [ ] 继续收正向 50% 折页层内容感（当前仍过于泛白/半透明，未达可验收）

- [x] **Phase D: 修正 50% 证据抓帧口径**
  - [x] 识别上一轮 `page-flip-to-detail-50.png` 存在 steady state 误抓
  - [x] 给 `FoldLinePageFlipStage.tsx` 增加测试态进度冻结能力
  - [x] 给 `e2e/lobby.e2e.ts` 增加“冻结到目标进度再截图”的抓帧流程
  - [x] 复跑并重新复看正反向真实 50% 中间帧

## Addendum（2026-05-08）：Home V2 正向 50% 收口状态更新

### Goal
> 继续把 Home V2 目录 -> 详情的正向 50% 中间帧收过“均匀发白硬片/厚板感”这条验收线，同时不带坏反向回翻与稳态页。

### Phase
- [x] 复跑 `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx src/pages/HomeV2Draft.tsx e2e/lobby.e2e.ts`
- [x] 复跑 `npm run typecheck`
- [x] 复跑 `homeV2Draft 查询参数会切到 V2 首页并可进入详情页`
- [x] 复看 `page-flip-to-detail-50.png` / `page-flip-back-to-catalog-50.png` / `detail-entry.png` / `homepage-catalog.png`
- [x] 确认正向 50% 已越过“均匀发白硬片/厚板感”验收线
- [x] 将“继续收正向 50% 折页层内容感（当前仍过于泛白/半透明，未达可验收）”视为已完成，旧口径失效

## Addendum（2026-05-08）：Home V2 反向 50% 最终结构收口

### Goal
> 修掉反向回目录 50% 中间帧里的重复内容与窄缝详情内容泄漏，让翻页层只承担纸张装饰，真实业务页面只由 baseStage 承载。

### Phase
- [x] 清理 `CornerCurlOverlay` 的失效内容参数与 DOM 克隆承载逻辑
- [x] 删除 `HomeV2.tsx` / `HomeV2Draft.tsx` 中不再使用的 `renderDetailShellStage`
- [x] 将隐藏 turn.js 驱动页改成透明占位页，避免 detail/overview DOM 泄漏进可见 50% 中间帧
- [x] 复跑 `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx src/pages/HomeV2.tsx src/pages/HomeV2Draft.tsx e2e/lobby.e2e.ts`
- [x] 复跑 `npm run typecheck`
- [x] 复跑 `homeV2Draft 查询参数会切到 V2 首页并可进入详情页`
- [x] 实际复看 `page-flip-back-to-catalog-50.png`：无重复王权、无房间列表窄缝泄漏，右页是目录目标页
- [x] 实际复看 `page-flip-to-detail-50.png`：正向 50% 未被带坏
- [x] 回写 `evidence/_shared/home-v2-query-entry-e2e-test.md` / `progress.md` / `findings.md`

## Addendum（2026-05-18）：Android 首页 V1/V2 分流修复

### Goal
> 查清“安装到手机后为什么还是 V1 首页”，修正 Android 包的首页真相源，并重新安装到真机确认启动落点已经是 Home V2。

### Phase
- [x] 核对 `HomeEntry` / `homeV2Routing` / `MainActivity` / `android-build-meta.json` 链路
- [x] 确认手机之前运行的仍是旧包 `0.5.59`
- [x] 修复 Android build meta，把 `homeV2DraftEnabled` 与 Android 首页默认 V2 的路由口径对齐
- [x] 新增 `homeV2Routing` 回归测试，锁住 Android shell/native runtime 默认进 V2
- [x] 复跑 `npm run typecheck`
- [x] 复跑 `npx vitest run src/lib/__tests__/homeV2Routing.test.ts`
- [x] 重新执行 `npm run mobile:android:build:release`
- [x] 真机 `10ADAU063C0010U` 成功覆盖安装到 `0.5.61 / 561`
- [x] 真机拉起 App 并抓图确认当前首页已经是 Home V2：`C:\Users\zhuagenbao\AppData\Local\Temp\easyboardgame-home-20260518.png`
