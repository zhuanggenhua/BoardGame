## Addendum（2026-05-13）：首页必须按 ig_0623 真实实现，不是贴图

- 用户最新指定稿是 `ig_0623cd92f8bdcbc0016a034df8b4c88199ae0c1276fee29f85.png`，不是之前几张生成稿；已复制到 `artifacts/home-v2-design/home-v2-mobile-book-catalog-target.png` 作为本轮实现目标。
- 当前裁决已修正：废弃“参考图贴图基线 + 透明热区”，也废弃上一轮搜索/8 条/在线大厅第二按钮方向。Home V2 首页稳态使用宽版空书本 `book-catalog-wide/1.png` 作为背景，`LobbyDirectory.tsx` 负责渲染真实可见 DOM。
- 本轮关键取舍：不加 Logo、不加帮助、不加搜索、不加说明段落、不显示“100 游戏说明/游戏数量说明”；`全部游戏` 只展示 `type === 'game'`，不再把工具项目塞进游戏目录。
- 新增视觉验收规范：不能只看“大结构像不像”，必须对照设计稿逐项核对关键几何位点。本轮先把用户指出的两个位点落成硬量测：底部分页与继续对局中心线必须对齐；左侧 active 分类必须是落在页眉分割线上的选中线 + 居中小标记，不能再把设计稿里的页眉选中线误命名成文本下划线，也不能出现线和标记不同心。
- 生图规范已补强：生成设计稿前必须先读取真实组件、字段、按钮、状态、i18n 文案和交互入口；本项目不接受凭通用模板添加不存在的微信/QQ 登录、协议勾选、帮助说明、Logo、搜索框或游戏数量解释。
- 真实 Auth 内容已盘点：`AuthModal.tsx` 支持 `login / register / reset` 三态；登录态是邮箱、密码、忘记密码、提交和登录/注册切换；注册态是邮箱、发送验证码、验证码、昵称、密码、确认密码、注册；重置态是邮箱、发送验证码、验证码、新密码、确认密码、重置。当前没有第三方登录和协议勾选，登录仍应走 modal 覆盖，在线大厅继续走书本。
- 登录弹窗目标稿已重新生成并复看：`artifacts/home-v2-design/home-v2-auth-modal-target.png`。前景不再包含第三方登录、协议勾选、Logo 或说明区；背景书本大厅被压暗虚化，避免生成可读的假游戏名。这个稿只作为 AuthModal 样式目标，不改变“大厅走书本”的页面主轴。
- 登录弹窗已落真实实现：`home-v2-account-entry` 打开覆盖层 `auth-modal`，不再进入 `auth-embedded-panel`；E2E 同时验证背景书本仍可见、modal 尺寸紧凑居中、前景没有第三方登录/协议勾选/说明区。用户指出上一版视觉不合理后，已修正“普通浅卡片”问题：补内外边框、角线、标题/底部装饰线、小菱形、深绿主按钮，并减少背景过度模糊。
- 这次问题本质不是单纯审美规范缺失，而是“生图设计稿 -> 实现设计稿”流程缺了硬几何门禁：只校验字段和 modal 存在，没量目标稿占屏比例。用户指出规范落点后已修正：专项流程落到 `docs/ai-rules/generated-design-implementation.md`；`docs/ai-rules/ui-ux.md` 只作为 UI 通用原则和专项流程入口；`docs/ai-rules/doc-index.md` 已加入该场景索引。当前目标 modal 图片量测为 `0.2808w / 0.6275h`，实现截图图片量测为 `0.2768w / 0.6120h`；E2E DOM 量测为 `0.266w / 0.588h`。
- 同名截图会造成查看器缓存误判，不能再作为唯一确认方式。已复制唯一命名截图 `auth-modal-overlay-20260514-inner-rhythm.png`，后续复看优先打开该文件或记录 `LastWriteTime`。
- 用户继续指出“间隙很大”后，本质进一步修正：只量外框仍不够，必须量内部节奏。当前新增项目级 skill `.windsurf/skills/generated-design-implementation/SKILL.md`，并在 `docs/ai-rules/generated-design-implementation.md` 加入表单/弹窗内部间距门禁。最新 E2E 内部量测为 `forgotToSubmitGapRatio=0.057`、`submitTopRatio=0.685`。
- 详情页“左页太空 / 右页不像表格”的根因不是单个控件大小，而是实现阶段没有按目标稿复核载体比例和内部语法：旧实现继续使用窄高 `book-idle` 舞台，左页有效内容变成窄带，右页房间区只是列表。当前修正为宽书本载体，左页横向 hero + 正文 + 推荐人数/教程行动节奏，右页删除非必要筛选/统计，tab 保持同级语法，房间区改成带列分割的账本表格；E2E 已量 `stageAspectRatio=2.21`、`tutorialTopRatio=0.82`、`headerDividerCount=3`、`firstRowDividerCount=3`、`filterButtonCount=0`，并生成同尺度并排图 `artifacts/home-v2-design/compare-crops/detail-target-current-side-by-side-final.png`。
- 用户指出返回按钮和人数样式后，本轮细节裁决：返回目录是页面导航入口，应轻量贴在书页左上角，不应画成深色主按钮；推荐人数是辅助元信息，应沿用 V1 数字方框语法，不能再做成长条或放大成主视觉。当前 E2E 已量 `backButtonBackgroundAlpha=0.00`、`backButtonBorderWidth=0.00`、`backButtonWidthRatio=0.24`、`playerCountBoxCount=2`、`firstPlayerCountBoxAspectRatio=1.00`。
- 用户继续指出按钮过小后，本轮修正根因分两层：上一版把“轻量 / 不占主内容”误写成“只满足最低触控下限”，但后续又把“热区足够”误修成“返回也必须有深色按钮背景”。当前不变量已补到生图实现流程：创建/确认/加入等主操作要有可见承载；返回/关闭/回目录等导航入口必须跟随目标稿语义，目标稿是透明轻量导航时不得强加背景。所有动作仍需验证高度、宽度占比、字号、热区、位置和相邻内容节奏，不能用固定 px 小控件冒充设计稿缩放。
- 本轮目标的完成边界已审计：创建房间弹窗仍走通用 `CreateRoomModal`，Home V2 用 `visualStyle="home-v2"` 保持风格；右页其它 tab 不是翻页，而是在同一详情 spread 内切换内容。E2E 已覆盖 `更新 / 评价 / 排行榜` 三个 tab 的可见面板、截图产物和“不翻页”属性断言。
- V2 首页剩余遗漏审计结论：用户主链路上还缺的实现已经补齐，包括真实继续对局、真实语言切换、登录 modal 覆盖、加密房密码浮层、注册/重置态截图验收。仍需另起后续任务处理的是工程整理项：`/dev/home-v2-authoring` 的 `HomeV2Draft.tsx` 仍保留旧 authoring/内嵌登录分支；`lobby.e2e.ts` 整文件混合 V1 旧大厅断言和 V2 专项断言，在 Home V2 环境下整文件不绿，需要拆分或改造旧用例。
- 2026-05-16 复查修正：Home V2 的 package-managed 包管理下载能力已经证明可以接入，但这不是当前产品口径。用户最新要求是 `V2 先隐藏`，因为现阶段风格不统一；因此 V2 详情页现在有意不展示下载卡片、安装确认弹窗和绿色版本徽记，旧 V1 `GameDetailsModal` 继续保留原能力。后续若恢复，必须按统一书页风格重新设计后再接回。
- 视觉复查结论：最新首页、登录、详情主面、创建房间、密码浮层和其它 tab 的书本主轴基本成立；当前更像“可继续精修”而非“方向错误”。井字棋这类信息量少的详情左页仍会显得偏空，但当前不允许用风格未统一的包管理入口去填空；后续只能接入真正统一的书页能力区，不能添加无意义装饰或非必要筛选。
- 2026-05-16 继续修正：上条“当前更像可继续精修”只对首页/详情主轴成立，不适用于上一轮 auth modal。用户纠偏后已确认真实根因不是“太接近全屏”本身，而是偏离了设计稿和同类通用弹窗语法。当前已抽出共享 `HomeV2PaperModalFrame` 与 `homeV2PaperModalTheme`，`AuthModal` / `CreateRoomModal` 复用同一纸面壳层、标题/分割线、输入框和主按钮语法；专项 E2E 已通过，截图与量测见 `evidence/_shared/home-v2-auth-modal-compact-landscape-e2e-test.md`。
- 2026-05-17 再修正：不能再把“可实现目标稿”当设计真相源。当前直接按原始 `artifacts/home-v2-design/home-v2-auth-modal-target.png` 收敛真实组件；登录弹窗恢复 `欢迎回来`、薄输入框、深绿细边主按钮和底部登录/注册切换，密码弹窗按内容收短但保持同壳层居中。创建房间内容量大于登录稿，当前边界是同壳层、可滚动表单、键盘不位移，后续若精修应压内部密度而不是回到满屏弹窗。
- 2026-05-17 最终复核：登录、创建房间、加密房密码三类弹窗的共享纸面壳层已稳定在原稿附近。当前最新量测是登录 `widthRatio=0.261 / heightRatio=0.537 / passwordInputHeight=17.89`，加密房密码 `surfaceWidthRatio=0.29 / surfaceHeightRatio=0.48 / inputHeight=17.89 / confirmHeight=19.58`；`topDelta=0 / centerYDelta=0` 说明键盘聚焦不会把弹窗顶走。这个版本的主要残留只剩创建房间内容量较大，不应再用全屏化或普通网页卡片去补。
- 最新截图复看结论：`homepage-catalog.png` 中左页顶部为分类索引，右页顶部为账号/语言，目录为 3+3 六个真实游戏，左页底部是分页，右页底部是继续对局；右页不再出现架构可视化/素材切片机；页面不再是贴图，也不再回到普通 dashboard。

## Addendum（2026-05-12）：Home V2 首页目录应是可用书页，不是说明页

- 用户反馈成立：前几轮把首页理解成设计展示或说明信息，偏离了现有产品交互。当前首页应只保留用户马上能操作的元素：分类、账号入口、游戏目录、游戏标签、人数、分页/翻页能力。
- 本轮删除帮助入口和说明型文案后，首页不再出现“帮助”“100 游戏说明”这类无中生有内容。`100 个游戏`只作为目录分页能力承载，不作为主界面解释文案。
- 本轮新图基线已保存：`artifacts/home-v2-design/home-v2-mobile-book-catalog-reference.png`。实现按这个方向重排为书签分类、左页搜索、右上账号设置、条框目录、底部分页和在线大厅入口。
- 目录条目应继续保持书页双栏，而不是普通网页网格。当前实现把数据从硬编码 6 个条目改为分类过滤 + 搜索过滤 + 分页切片；`全部游戏` 纳入现有启用条目，首屏为 8 条、左右各四条；后续游戏数量增加时继续按每页最多 8 条翻页。
- 截图复看结论：`homepage-catalog.png` 里书本仍为主轴，已经不是旧裸条目布局，未出现帮助入口和说明段落；`catalog-return-after-flip.png` 证明翻页返回后目录稳态未漂移。

## Addendum（2026-05-12）：为什么 turn.js 翻页中不能保留真实 UI

- 当前不是“技术上完全不能把 DOM 放进 page”，而是这套 Home V2 业务 UI 不适合在翻页中作为 live DOM 保留。turn.js 会接管 page DOM，给 `.page-wrapper` 写入绝对定位、overflow、z-index、transform 和内部裁切；这会把原本按整本书舞台定位的目录/详情 UI 改投影到单页局部坐标系。
- 即使冻结 React 状态也不解决，因为问题不是数据继续变化，而是 DOM 被插件重排和 3D/2D 变换后，业务 UI 的坐标系、滚动容器、按钮层、图片裁切和阴影都跟着页片透视移动。视觉结果会变成 UI 乱飞、镜像到纸背、被裁掉或同时露出两套页面。
- 本轮保留的取舍是：翻页中间态只显示书壳 + turn.js 纸面材质；真实业务 UI 只在 overview/detail 稳态出现。这牺牲了“UI 贴在纸上翻”的细节，但避免了用户已经指出的“两本书”“两套 UI 同时显示”“书本消失”和“UI 乱飞”。

## Addendum（2026-05-12）：序列帧方案作废，必须使用 turn.js 插件翻页

- 用户明确指出“我让你用序列帧了吗”“不是让你用插件翻页吗”，所以 2026-05-11 的序列帧裁决是错误方向，不能继续当完成证据。
- 当前正确裁决是：Home V2 翻页中间态必须由 turn.js 插件生成可见折页结构；`page-flip-left/right` 序列图不得再作为最终方案。
- turn.js 默认 `turnPage` 使用 ease-out，导致按时间抓 25% 时视觉上已经接近翻完，只剩窄边，容易看成“两本书/残边”。本轮通过包裹 jQuery `animatef`，仅对 `turning` 动画补线性 easing，让 25 / 50 / 75 更接近插件视觉进度。
- 翻页页内容也不能塞业务 UI：当前 turn.js page 使用翻页专用纸面 stage，真实目录/详情 UI 只在稳态恢复，避免把业务界面贴到翻动纸面上。
- 最新六帧人工复看结论：正反向 25 / 50 / 75 都能看到 turn.js 的折页、页边和阴影；截图日志同时证明插件处于 `animating=true`，不再是序列帧或 CSS 纸片。
- 后续用户指出“翻页的时候书本消失了”同样成立。根因是 flipping state 只渲染 turn.js 内页 union rect，没有保留完整书本壳。当前已在 turn.js flipbook 下方补目标方向的无业务 UI 书本壳，最新截图确认外层封边、书脊和底部书签在翻页中仍可见。

## Addendum（2026-05-11）：CSS 纸片不达标，必须回到翻页序列帧（已被 2026-05-12 否定）

- 用户指出“明显就不像翻页”是正确的：上一版虽然解决了“两套页面同时平铺”和“业务 UI 贴在纸上”的问题，但可见层本质仍是一块 CSS 纸片在透视/裁切，缺少真实页边、纸堆、阴影和跨书脊的连续动作。
- 本轮裁决更新为：Home V2 翻页中间态不再接受 `PagePaperCover` 这类单平面 CSS 几何作为最终效果；应使用项目已有 `page-flip-left/right` 序列帧，或未来替换为同等语义的高分辨率序列素材。
- 正向目录到详情使用 `page-flip-left`，反向详情到目录使用 `page-flip-right`，这与现有 UI scene / runtime 测试里的素材方向一致。
- 序列帧第一次接入时出现“中间小书盖大书”，根因是素材内容区小于整张 webp 画布；最终通过覆盖层横纵向分开缩放，让翻页帧和当前书本底图回到同一视觉坐标系。
- 最新六帧人工复看结论：正反向 25 / 50 / 75 都能看到真实页边和阴影推进，不再是平面滑片；但素材本身分辨率偏低，放大后有颗粒感，后续若继续追质感应换高分辨率素材。

## Addendum（2026-05-10）：Home V2 “两边都显示”的根因与最终裁决

- 用户指出“翻页怎么两边都显示了”是结构问题，不是纸张阴影问题。前一版的缺陷是把 source 静态页、target reveal 和额外纸片同时放进 flipping state，导致 25 / 50 / 75 多帧都像两套页面摊平后再盖一张纸。
- 本轮正确裁决是：翻页态只保留两层语义：
  1. **底层目标完整 spread**：正向为详情 spread，反向为目录 spread；
  2. **顶层来源离场页片**：正向为目录页片离场，反向为详情页片离场。
- `PagePaperCover` 现在不是固定矩形遮挡块，而是随 progress 生成弧形 polygon，并且可承载来源页内容；其可见宽度按 `1 - progress` 收缩，所以 25% / 50% / 75% 有明确连续变化。
- 最新六帧人工复看结论：不再出现 source 与 target 两整套页面同时平铺；75% 时只剩来源页窄边，目标 spread 已成为主视觉。

## Addendum（2026-05-03）：正向 50% 折页仍偏浅的直接原因
- 当前 `page-flip-to-detail-50.png` 的缺口不再是“翻页层没有内容”，而是**纸面材质层仍然把源页内容冲淡了**：高光和纸色叠层减弱后有所改善，但正向页片仍没有反向那样扎实。
- 这说明当前结构方向基本对：顶层折页已经遮住目标 UI，反向 50% 也能看到完整翻回目录；剩下是正向折页材质权重问题，不是页面归属或测试抓帧问题。

## Addendum（2026-05-03）：Home V2 正向 50% 折页当前主要问题
- 当前 `page-flip-to-detail-50.png` 的首要问题不是布局错位，而是**折起层内容感太弱**：纸张高光/泛白过重，导致翻起页片更像半透明纸片，而不像带着页面内容的真实书页。
- 同一轮复看的 `page-flip-back-to-catalog-50.png` 相对更接近目标，说明当前几何/裁切大方向可用，主要缺口集中在正向折页层的贴图与材质权重，而不是 steady state 布局。
- 因此下一刀不该再碰首页 steady state 或详情 steady state，而应继续只收 `FoldLinePageFlipStage.tsx`：减轻正向折页层泛白、增强页内容可见度、保留顶层遮挡关系。

## Addendum（2026-05-02）：Home V2 方案 B 才真正解决“UI 在纸上面”的问题

- 这轮最重要的判断修正是：**“50% 中间帧抓准了”不等于“翻页方向就对了”**。用户继续指出“UI 还在纸上面”是对的，说明上一轮仍然停在“证据口径修正”，没有真正修正可见翻页层语义。
- 当前应把问题拆成两层：
  1. **抓帧是否可信**：通过 `window.__BG_HOME_V2_E2E_HOLD_PROGRESS__` 已经解决；
  2. **翻页层语义是否正确**：必须进一步把翻起层从 live UI 剥离，只剩纸张/阴影/高光。
- 因此本轮 `FoldLinePageFlipStage.tsx` 的正确裁决不是继续调 curl 参数，而是：
  - 底层保留真实页面 steady state；
  - 翻页层只渲染纸张材质；
  - 让“书页翻起”发生在 UI 上层，而不是让 UI 贴在翻页层里一起飞。
- 最新人工复看的 4 张图说明：
  - `page-flip-to-detail-50.png`：右页翻起层不再挂在线大厅房间列表；
  - `page-flip-back-to-catalog-50.png`：左页翻起层不再挂目录项；
  - `homepage-catalog.png`：召唤师战争等缩略图仍完整落在书页内，没有白边/黄边回退；
  - `detail-entry.png`：详情 steady state 仍是实际可交互前端页，不是假页截图。
- 所以这轮之后，Home V2 首页翻页链路的判断标准应更新为：
  - 不只看“有没有 50%”；
  - 还要看“50% 里翻的是不是纸，而不是 UI”。

## Addendum（2026-05-01）：Home V2 翻页真正根因是 page ownership，不是 z-index

- 用户最后一轮判断是对的：上一版真正的错不在“折角参数”本身，而在 **完整 detail UI 先画在底层，再额外挂一层 curl**。这样 25% 中间帧里，视觉上就会像“书页上方漂着一层 UI”，而不是“那张纸自己带着内容在翻”。
- 这轮补查 turn.js 文档后，结论进一步坐实：官方 flipbook 结构本来就是 **每个 page element 里放自己的 HTML 内容**；翻页时动的是 page 自身，不是底层完整 spread + 上层贴片。
- 因此当前正确裁决不是继续调 curl 参数，而是把 `FoldLinePageFlipStage` 的可见层重写成：
  - `shell stage`（只保留书本壳）
  - `static source/target pages`（只放当前静止页）
  - `turning sheet front/back`（前面是源页，背面是目标页）
- 新截图已证明：`page-flip-to-detail-25.png` 不再是一整本 detail 提前露出来再贴一个小角，而是源右页真的在翻、目标右页在底下被揭开。


## Addendum（2026-04-30）：Home V2 折角语义修正

- 用户指出得对：上一版虽然有角，也有翻页，但语义上仍是“整页翻 + 角标”，不是“折角带动翻页”。
- 本轮已经把可见翻页层从“整页从侧边立起”改成“页角起卷”的局部 curl sheet；E2E 25% 中间帧里能直接看到右下角卷起，再露出目标页。
- 当前这版依然不是 turn.js 原生那种完整 page curl 物理模型，但至少在用户可见语义上，已经从“整页翻”修正到“页角先翻”。

## Addendum（2026-04-30）：Home V2 首页折角 + 翻页最终可见层裁决

- 这轮真正定位到的根因不是“折角参数不对”，而是 **官方 turn.js overlay 直接常驻在这套书本素材上时，会把正文区渲染成中间小册子**；即使脚本接线成功，steady state 和中间帧截图也会明显偏离参考稿。
- turn.js 接线里还踩到一个 React 集成问题：翻页容器被插件直接改写 DOM 后，下一次模式切换如果复用同一个节点，`turn.js` 会报 `The page 2 does not exist`。当前通过给 flipbook 容器加 mode/size key 重建节点，避免拿到被插件改坏的旧 DOM。
- 因此本轮最终裁决不是“继续强行把 turn.js 常驻可见”，而是：
  - **保留官方脚本接线**，作为兼容和后续继续研究的基础；
  - **steady state 可见层改成前端折角样式**；
  - **flipping state 可见层改成前端整页折页 sheet**；
  - 这样才能同时满足“移动端横屏、内容在书里、不是假页面、看图能收口”。
- 当前 2388x1080 复看结论：
  - 首页/详情 steady state 都已摆脱 turn.js overlay 的中间小册子问题；
  - 正反向翻页中间帧都已经有可见整页折起视觉，不再只有中间矩形块或空白壳。

## Addendum（2026-04-30）：Home V2 翻页切到官方 turn.js 运行时

- 用户最终口径已经固定为 `turnjs.com` / `turn.js` 插件路线，因此当前实际运行时不再依赖上一轮自制 `rotateY` 翻页实现；`src/components/home-v2/FoldLinePageFlipStage.tsx` 现在只是一个 React wrapper，内部在翻页态动态挂载官方 turn.js。
- 直接使用 npm `turn.js` 包不够稳妥：官方站点实际提供的是 `turn.js 4.1.0` 脚本，而 npm 包来源和版本语义不够清晰；本轮最终把官方脚本落到 `public/vendor/turnjs/turn.min.js`，运行时按 `window.jQuery` 路线注入，避免再偏离 `turnjs.com`。
- `jquery` 已固定到 `1.12.0`，并在加载官方脚本前显式挂到 `window.$ / window.jQuery`；这与官方站点“jQuery 插件初始化”的接线方式一致。
- `HomeV2.tsx` 现已把首页与详情 steady state 统一到同一个 `bookStageLayout`；之前首页 / 详情舞台大小分叉的问题不再存在，书本整体占画面比例继续保持首页标准。
- 这轮复跑截图说明：目录页与详情页 steady state 仍是当前真实前端 DOM；翻页中间帧已不再依赖旧 `page-flip-left/right` 序列资源，而是由官方 turn.js 驱动。

## Addendum（2026-04-29）：Home V2 翻页中间帧截图补录
- 现在缺口已经从“没有翻页证据”变成“翻页证据已齐，但资源风格还可继续收口”。
- 本轮没有新造第二条 Playwright 测试，而是直接扩展现有 `homeV2Draft 查询参数会切到 V2 首页并可进入详情页`：
  - 点击 `dicethrone` 后，在 `flippingToDetail` 动画进行中补录 `page-flip-to-detail-mid.png`
  - 点击“返回目录”后，在 `flippingToOverview` 动画进行中补录 `page-flip-back-to-catalog-mid.png`
  - 翻页结束回到目录 spread 后，再补 `catalog-return-after-flip.png`
- 这样当前同一条链路的证据已经覆盖 5 个落点：
  - `homepage-catalog`
  - `page-flip-to-detail-mid`
  - `detail-entry`
  - `page-flip-back-to-catalog-mid`
  - `catalog-return-after-flip`
- 结论上，现在可以明确说：Home V2 的目录 -> 详情 -> 返回目录并不是跳切，而是有真实前端翻页过程，只是翻页中间帧仍沿用旧 `page-flip-left/right` 资产。

## Addendum（2026-04-29）：Home V2 翻页中间帧去空白壳
- 当前翻页链路的真实问题不是“动画有没有动”，而是 **翻到详情的中间帧目标页曾经是空白 detail 壳**：`FoldLinePageFlipStage` 已经接管了中间态，但 `HomeV2.tsx` 在 `flippingToDetail` 时仍只按 `selectedGameId` 渲染 detail 内容，导致 50% 翻页截图里右页只剩空白纸页。
- 已修正为 staged detail game 逻辑：在 `flippingToDetail` 期间，detail 舞台优先消费刚点击的 pending game，而不是等动画结束后才第一次拿到目标游戏。
- 最新 `page-flip-to-detail-50.png` 里，正在翻出的页已经带着王权骰铸的真实详情内容和右页大厅表格，不再是“翻到空白壳再瞬间填内容”。
- `page-flip-back-to-catalog-50.png` 也已复看：返回目录的中间帧继续保持目录页作为目标页、详情页作为翻出页，说明当前已经具备“目录态 / 详情态 / 中间帧”三段分离，而不是继续共用一张静态壳。

## Addendum（2026-04-29）：Home V2 详情页书本尺寸统一到首页标准
- 本轮退步根因不在 detail 内容区，而在 `src/pages/HomeV2.tsx` 的舞台基线：首页 `overview` 已经按 `1672x941` fit，但详情 `detail` 仍沿用旧 `896x720`，所以 detail 看起来会比首页整本书更小一圈。
- 这不是素材本身尺寸差异：当前 `overview-spread/1.png` 与 `book-idle/1.png` 都属于同一套首页标准书本资源，因此继续保留 `896x720` 只会制造错误缩放。
- 已修正为统一基线：`HomeV2.tsx` 现在让首页与详情都共用 `1672x941` 的 stage width / height / aspect ratio / scale 基线，detail 不再单独按旧 artboard 缩小。
- 本轮没有扩散去重排 detail 左右页内容区；`HOME_V2_DETAIL_LEFT_RECT / RIGHT_RECT` 保持不变，先只解决“整本书大小不一致”的问题。
- 最新截图复看结论：
  - 首页 `homepage-catalog.png` 仍保持原先居中与占画面比例，没有因为 detail 修正而回退；
  - 详情 `detail-entry.png` 现在整本书的外轮廓占画面比例已和首页一致，不再明显小一圈，内容也仍完整留在书页内。

## Addendum（2026-04-29）：Home V2 详情页参考稿收口（Dice Throne 真实链路）
- 本轮把详情页演示目标从 `tictactoe` 切到 `dicethrone`，不是为了摆拍，而是因为 Dice Throne 的真实封面、标题、推荐人数和房间表更接近参考稿的视觉结构；这样能在不造假内容的前提下，把 detail 图做得更像参考页。
- `src/components/home-v2/GameDetails.tsx` 左页已改成编辑式结构：封面图改为 `object-contain`，避免继续裁切出白边/黄边；正文改成大标题 + 正文段落；底部改成推荐人数块 + 教程模式按钮。
- 右页现在不再是“一个 section 标题 + 稀疏列表”，而是更像账页：顶端有在线大厅主标签、搜索输入、创建房间按钮、筛选 pills；主体是一张固定列宽的房间表。
- 本轮的 detail 演示房间不是静态文本，而是 6 条真实 Dice Throne 房间：同时注入了 open / locked / full 混合状态，因此右页状态列和操作列终于有真实差异，而不是清一色占位文案。
- 最新 `detail-entry.png` 肉眼可见 6 行房间全部落在书页内，底部还能看到 `2/2` 已满房；说明这页已经不是“有链路但太空”，而是具备参考稿要求的信息密度。
- 当前尚未完全收口的只剩翻页资产：detail 现在虽然已经走独立 exact spread，但背景仍复用 `book-idle/1.png`，真正还没统一的是“目录 -> 详情”的翻页中间帧与 detail 终态的资源风格。

## Addendum（2026-04-28）：Home V2 井字棋缩略图去假收口（2388x1080）
- 当前首页剩余最明显的“假东西”是 `tictactoe`：虽然它不再是 `#` 字符占位，但仍然走 `NeonTicTacToeThumbnail` 前端生成图，不是实际游戏封面链路。
- 本轮已切到真实截图封面：
  - 源图使用 `evidence/tictactoe/screenshots/tictactoe.png`，这是实际游戏画面，不是参考页裁片。
  - 从中裁出标题 + 棋盘主体，生成 `public/assets/i18n/zh-CN/tictactoe/thumbnails/cover.png` 和运行时 `compressed/cover.webp`。
  - `src/games/tictactoe/manifest.ts` 已补 `thumbnailPath: 'tictactoe/thumbnails/cover'`；`src/games/tictactoe/thumbnail.tsx` 也已切到 `ManifestGameThumbnail`，让首页和大厅其它入口统一吃同一张真实封面。
- 最新目录截图里，右下角井字棋缩略图已经变成实际游戏截图，不再是前端生成的霓虹占位画。
- 需要注意：本轮新增的 `png/webp` 位于仓库默认忽略规则下（`**/*.png` 与 `public/**/*.webp`）。如果下一步要提交，这两张资源需要显式纳入提交范围。

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

## Addendum（2026-04-29）：Home V2 steady state 去除旧右侧书签语义
- 用户最后一轮口径已经明确：当前不是“收右侧书签样式”，而是“右侧书签本来就不该再存在，按设计稿彻底重做”。
- 真正要拔掉的是 `HomeV2` 运行时的旧 scene tab 语义，而不是只在视觉上把书签藏起来。关键残留点此前在 `sceneContext.showLegacyTabs`、`openLobbyTab/openRoomsTab`、`overview_left_page/overview_right_page` 以及 `HomeSceneRenderer -> tabs` 这条链路上。
- 这轮确认后的最小正确方案是：`HomeSceneRenderer` 只保留 `open` 开场动画，目录页 / 登录页 / 详情页 steady state 一律走 exact stage；这样既不影响现有翻页资源，也能保证 steady state 彻底不再渲染旧书签节点。
- `HomeV2.tsx` 现在已经采用这条方案：开场动画结束直接进入 `overview`，不再经过 `tabs`；目录/登录/详情 steady state 都不再挂旧 scene tab。
- E2E 已补硬断言验证这一点：目录页、登录页、详情页都要求 `home-v2-tab-lobby / home-v2-tab-rooms / tab_button_lobby / tab_button_rooms` 节点数量为 `0`。
- 首次复跑首页 E2E 时，Playwright 在 `2388x1080` 全页截图阶段触发 Node heap OOM；增加 `NODE_OPTIONS=--max-old-space-size=4096` 后同一条链路稳定通过，因此当前大图截图的已知运行门槛是需要显式加大 Node 堆。

## Addendum（2026-04-29）：Home V2 登录页 / 详情页视觉二次收口
- 登录页上一轮最明显的问题不是“结构错了”，而是页内表单材质过花、重复标题太多，导致右页虽然是真表单，但看起来像占位层。处理方式是：
  - 左页改成品牌说明页，承担参考稿中的“易桌游 + 卖点”语义；
  - 右页顶部只保留一层模式切换条，内嵌 `AuthModal` 隐藏重复标题。
- 详情页当时最明显的问题是顶部动作和房间表对比度过弱，导致截图里“创建房间 / 返回目录 / 房间列表”像浅色贴纸。历史处理曾把操作按钮统一换成深色按钮语义；后续已修正为按动作类型区分：创建房间保留主按钮承载，返回目录按目标稿保持透明轻量导航。
- 当前登录页 `rooms-auth-entry.png` 已经证明：目录页进入账号页后，steady state 不再是旧书签页，而是独立的左右书页登录态。

## Addendum（2026-04-30）：Home V2 登录页 / 详情页二次压稿（移动端横屏）
- 这轮真正要修的不是交互链路，而是 steady state 视觉口径：rooms/login 之前主要问题是右页一整块高亮白卡太像 modal 残留，detail 之前主要问题是左页纵向节奏过长、教程按钮首屏压不全，右页房间表也偏现代卡片列表。
- 已改的 rooms/login 方向：
  - `src/components/home-v2/HomeTabPanels.tsx` 左页底部模式切换改成低存在感文字导航，不再继续用厚按钮卡片；
  - 右页认证区移除大白卡容器，只保留页内 tabs + 分隔线 + 内嵌真实表单；
  - `src/components/auth/AuthModal.tsx` embedded 模式下强化了字号、输入框边界、提交按钮尺寸与表单宽度，继续保留真实输入链路和现有测试选择器。
- 已改的 detail 方向：
  - `src/components/home-v2/GameDetails.tsx` 左页再次收纵向高度：封面缩一档、标题和正文压紧、教程按钮回到首屏完整可见；
  - 右页去掉过强表格容器感，改成更轻的账页式表头 / 行分隔 / 小按钮密度，6 行 Dice Throne 真房间仍完整落在书页里。
- 本轮看图结论：
  - `detail-entry.png` 已经满足“首屏完整落在书页内”这条底线：左页教程按钮不再被截断，右页房间表仍保持 6 行真实房间。
  - `rooms-auth-entry.png` 已经摆脱上轮那种大白卡 modal 残留，但右页表单对比度仍弱于参考图 `登录注册.png`，属于“方向已对，仍可继续提对比度”的剩余差距；因此当前更适合表述为**继续收口中**，不应把登录页说成终稿。
- 关键参考图路径仍固定为：
  - `D:\gongzuo\webgame\gameasset\v2首页参考\登录注册.png`
  - `D:\gongzuo\webgame\gameasset\v2首页参考\详情页.png`
  - `D:\gongzuo\webgame\gameasset\v2首页参考\首页.png`

## Addendum（2026-04-30）：Home V2 翻页结构改为页级 rotateY（按掘金折线翻页思路）
- 用户这轮指出的问题是对的：旧 `FoldLinePageFlipStage` 的根因不是“曲率不够”，而是**把整张 spread stage 直接塞进单页翻转 rect 里**。这样一翻，目录和详情整页内容会一起被压缩并跟着翻页层动，视觉上就不是“翻一张纸”，而是“拖着整个页面动”。
- 参考源已核实：掘金文章《怎么实现一个3d翻书效果》核心是“整页 rotateY + 3D 属性 + front/back 页面关系计算”，不是继续拿整张 spread 做假 clip。链接：`https://juejin.cn/post/6844903665216520206`
- 本轮已改成页级结构：
  - base layer 改回 source stage，而不是一上来就把整张 target stage 铺满；
  - revealed layer 只显示目标页被揭开的那一页；
  - turning layer 拆成 source front / target back 两面，并按 page rect 做真实裁切；
  - `HomeV2.tsx` 额外传 `overviewStageSize/detailStageSize + leftPageRect/rightPageRect`，不再让翻页组件自己拿整张 stage 硬塞。
- 看图后的结论：
  - `page-flip-to-detail-50.png` 现在已经不是“整张内容一起挤着动”，而是左页保留目录、右页显示被揭开的目标页，中间只有单张纸在翻；这是这轮最关键的修复。
  - `page-flip-back-to-catalog-50.png` 反向翻页也回到同一结构，不再出现整张 detail spread 被一起塞进翻页层的错误。
- 当前剩余差距不再是结构性错误，而是**折线层数/纸张厚度/阴影质感**仍可继续向参考实现压；但“内容在一起动”的核心 bug 已经被结构重写消掉。
## Addendum（2026-05-02）：Home V2 50% 半页折页收口
- 用户这轮把验收口径重新钉死成了三件事：**必须看 50%**、**目标页 UI 不能跟着翻**、**折页必须在 UI 上层且不能只是一个小角**。
- 因此问题根因已经不再是“是否接了 turn.js”，而是**可见折页层仍然过小/过弱**，50% 时肉眼看不出半页翻起。
- 当前修法保留了 `turn.js` runtime，但重做了 `FoldLinePageFlipStage.tsx` 的可见层分工：
  1. 底层始终渲染目标页 steady state；
  2. 中层只保留 source page 的可见裁切区；
  3. 顶层新增大面积纸张折页遮挡层，保证折页压在 UI 之上；
  4. 翻页完成回调增加最短可见动画时长门槛，避免 50% 截图只抓到末帧。
- 2026-05-02 最新 50% 截图已经显示：正向与反向翻页都不再是小角贴层，而是明确可见的半页折起；首页与详情 steady state 继续保持在书页内。
## Addendum（2026-05-02）：Home V2 50% 证据冻结修正
- 我重新主动看图后发现：上一轮 `page-flip-to-detail-50.png` 实际上抓成了 steady state 详情页，说明当时的“50% 证据”并不可信。
- 根因不是前端翻页本身没到 50%，而是 **Playwright 在 full-page 截图时，动画已经继续跑到收口态**；也就是说，之前的问题已经从“翻页方向错了”升级成“证据抓帧口径错了”。
- 当前已修正：
  - `src/components/home-v2/FoldLinePageFlipStage.tsx` 新增测试态 `window.__BG_HOME_V2_E2E_HOLD_PROGRESS__`，到目标进度后先冻结可见层；
  - `e2e/lobby.e2e.ts` 的 `captureHomeV2FlipFrameAtProgress` 改成“先设置冻结目标 -> 等进度到位 -> 截图 -> 再释放冻结”。
- 现在最新 `page-flip-to-detail-50.png` / `page-flip-back-to-catalog-50.png` 已经是真正的 50% 中间帧：
  - 正向图能看到右页 source 内容正在翻走，而不是直接跳成详情稳态；
  - 反向图能看到左页 detail 内容正在折回目录，而不是只剩书页终态。

## Addendum（2026-05-03）：Home V2 正向 50% 折页继续压实（2388x1080 真移动端横屏）
- 本轮只继续收 `src/components/home-v2/FoldLinePageFlipStage.tsx`，不碰 steady state 首页/详情布局。
- 根因判断：正向 `page-flip-to-detail-50.png` 之前已经摆脱“空白纸板”，但折起页片仍偏浅，书页内容感和折痕阴影弱于反向 50%。
- 这轮实际调整：
  - `buildFoldGeometry('br')`：减小正向折页的 `rotateY`，略放大 `sheetScaleX`，并加重 `underShadow / outerShadow`，让翻起页片更像一整张纸而不是轻薄透明膜；
  - `CornerCurlOverlay`：按正向折页单独收紧泛白 screen wash、降低纸张蒙层、提高 source 内容对比度，并补一条更明确的 fold crease 阴影；
  - 反向 `bl` 分支基本保持原力度，避免把已经较稳的回翻质感带坏。
- 本轮运行：
  - `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx e2e/lobby.e2e.ts`
  - `npm run typecheck`
  - `PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"`
- 结果：全部通过；E2E 日志继续明确抓到真实 `raw=0.500` 的正向/反向中间帧。
- 最新关键截图：
  - 正向 50%：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-50.png`
  - 反向 50%：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-50.png`
- 我实际看图后的结论：
  - 正向 50% 已经比上轮更像“带冻结内容的一整张书页”在翻：右页列表缩略图和标题不再只剩一层发白薄膜，折线与落影也更明确。
  - 反向 50% 没被本轮调坏，仍然是当前更稳的参照。
  - 但当前仍不应宣称彻底收口：正向 50% 虽然已经明显摆脱“空白纸片感”，整体仍略偏浅，后续仍可继续加厚纸感与折痕立体度。

## Addendum（2026-05-03）：Home V2 正向翻页切到冻结 DOM 克隆
- 本轮不再继续在“live DOM + 渐变纸片”上死调；已把正向 `flippingToDetail` 的翻起层切成 **steady state DOM 冻结克隆**，目标是不再让活的右页 UI 跟着翻页层跑。
- 实际落点：`src/components/home-v2/FoldLinePageFlipStage.tsx`
  - 新增可见 steady stage 捕获根 `visibleStageCaptureRef`；
  - 在 `mode==='overview' / 'detail'` 时预热克隆 HTML 快照；
  - 正向翻页时折页层与 flat 层吃冻结克隆；
  - 反向翻页暂时回退为旧 live 路线，因为克隆版本会在 `page-flip-back-to-catalog-50.png` 顶部打出黑块，当前不值得强推。
- 本轮命令：
  - `npx eslint src/components/home-v2/FoldLinePageFlipStage.tsx e2e/lobby.e2e.ts`
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=600000 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 BG_HOME_V2_VIEWPORT=2388x1080 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"`
- 我实际看图后的结论：
  - 正向 50%：`page-flip-to-detail-50.png` 现在至少已经变成“冻结页内容在翻”，不是之前那种纯 live DOM 互相透；但仍偏浅，纸感还不够实，离“像真书页”仍有差距。
  - 反向 50%：当前保留旧路线后又回到较稳状态，没有再出现那块黑色矩形。
  - 因此这轮只能算**方向修正成功，但视觉还没收口**；下一步仍应继续压正向折页的遮挡实感和厚度。
- 追加一轮正向 50% 收口：把前表面 source 内容重新贴回翻起页，并补一条右侧背页厚度边；同一条 E2E 再次通过。
- 最新正向截图：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-50.png`
- 我实际看到：当前 50% 已经不再是“空白竖板”，而是书脊侧翻出的整页，且目录内容确实贴在翻起层；但背页厚度和遮挡实感仍不足，仍不能收口。

## Addendum（2026-05-08）：Home V2 正向 50% 过线判断
- 本轮重新实际看图后，当前最关键的判断发生变化：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-to-detail-50.png` **已经不应再记为“未达标”**。
- 现在的正向 50% 页片虽然仍有一点中缝偏挺感，但它已经不是早前那种“均匀发白的半透明硬片/厚板”；肉眼第一感受已经变成“单张薄纸在翻”。
- 反向 `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-50.png` 仍稳，`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-detail-entry.png` 与 `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-homepage-catalog.png` 也没有回退，因此当前已不存在阻止本轮收口的核心 blocker。
- 若后续还有精修，只该算可选 polish：继续软化中缝亮带，而不是再回到大幅改几何/重造翻页结构。

## Addendum（2026-05-08）：反向 50% 的真实根因与当前状态
- 用户指出 `page-flip-back-to-catalog-50.png` “王权显示了两个、翻页不是这么翻”是对的；根因不是纸感，而是反向链路的**层职责错了**。
- 旧反向 50% 同时存在：底层 overview、flat detail、turning detail，所以会出现内容重复与画面秩序混乱。
- 这轮改完后，`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-page-flip-back-to-catalog-50.png` 已经去掉重复 source 叠画，当前首先看到的是“单张左页从中缝回翻”，而不是三层内容同时抢画面。
- 当前剩余如果还要 polish，也应该只做轻量纸感/中缝细节，不该再回到旧方向上磨参数。
## Addendum（2026-05-08）：反向 50% 泄漏根因最终确认
- 反向 50% 的“王权显示两个”和窄缝房间列表不是单纯透明度问题，而是两个不同来源叠加：
  - 可见层曾经混入了 detail source / overview target / turning leaf 多套职责；
  - 隐藏 turn.js 驱动页内部仍塞着真实 overview/detail DOM，一旦 turn.js 生成的中间结构参与可见画面，就会把 detail 右页房间列表露进反向回目录动画。
- 最终正确边界：
  - `baseStage` 承载真实业务页面；
  - `CornerCurlOverlay` 只承载纸张、折痕、阴影，不承载任何业务 DOM 或截图克隆；
  - turn.js 隐藏页只保留透明占位页，用来驱动页码/翻页事件，不承载真实内容。
- 最新截图结论：
  - `page-flip-back-to-catalog-50.png` 已无重复王权，也无房间列表窄缝泄漏；
  - `page-flip-to-detail-50.png` 未被带坏，仍保持正向目标详情页与中缝纸边关系；
  - 当前问题从结构 blocker 降为纸感 polish。

## Addendum（2026-05-16）：详情密码浮层统一后的当前边界
- 用户这轮纠偏是对的：错误不在“弹窗别太大”这个表象，而在我一度偏离设计稿和主链路通用 UI，自行造了一套不统一的弹窗语法。
- 当前修正后的正确边界：
  - `AuthModal`、`CreateRoomModal`、Home V2 详情页加密房密码浮层都统一到 `HomeV2PaperModalFrame` + `homeV2PaperModalTheme`；
  - 用户最新口径已覆盖上一条旧边界：密码弹窗也必须和其它弹窗一样居中在整本书/视口中心，因此现在改为全局 portal 居中，不再是右页内容区覆盖层；
  - Home V2 弹窗必须按目标稿保留深色压暗 + 轻 blur 背景，不能再把“透明点击层”误当视觉目标；透明层只负责交互拦截，不负责视觉呈现；
  - 输入聚焦后的附加门禁必须保留“modal 本体不位移”，不能为了可输入再推动整个面板。
- 2026-05-16 实际 E2E 与看图结论：
  - `homeV2Draft 登录与创建房间弹窗统一使用纸面 modal` 与 `homeV2Draft 详情页输入房间密码后可加入加密房间` 已复跑通过；
  - `auth-modal-unified-20260516.png`、`create-room-modal-unified-20260516.png`、`locked-room-password-panel.png` 肉眼可见三类弹窗都位于整本书/视口中心，背景有目标稿方向的压暗和轻 blur，弹窗本体是实心纸面；
  - `locked-room-join-success.png` 证明输入密码后的真实加入链路没有被这次统一改坏。
- 当前仍不能宣称“全部风格统一已彻底收口”：
  - `/dev/home-v2-authoring` 里的旧 auth/rooms authoring 仍是 dev 残留；
  - `AccountSettingsModal` 仍保留旧语法，但它不在当前 Home V2 未登录主链路里。

## Addendum（2026-05-16）：全面风格复查后的主链路边界
- 本轮把“全面检查风格不统一”收窄成**当前 Home V2 真实主链路**，而不是把旧大厅、旧详情 modal、移动端旧 sidebar 全部混进来。
- 已实际复看的主链路状态包括：
  - 首页目录与语言菜单；
  - 登录弹窗；
  - 创建房间弹窗；
  - 详情页在线大厅空态；
  - 详情页加密房密码浮层；
  - 详情页 `更新 / 评价 / 排行榜` 三个 tab；
  - package-managed UI 按当前产品口径隐藏后的详情页。
- 复查结论：
  - 以上状态当前都维持在同一套书页/纸面语法里，没有再发现新的“某个浮层突然变成另一套网页 modal / 白板 / 后台菜单”式冲突；
  - 当前剩余的风格残留不在主链路：`/dev/home-v2-authoring` 仍保留旧 authoring；`AccountSettingsModal` 与旧 `/?game=...` 详情路线仍是旧语法。
- 因此这轮“全面检查”如果只针对 Home V2 当前真实主链路，可以视为已完成；若要扩大到 dev authoring 和旧详情体系，则需要另开任务，不应混在这轮主链路结论里。
