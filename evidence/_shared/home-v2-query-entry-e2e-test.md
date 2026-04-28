# Home V2 详情页 exact spread 首轮落地证据（2026-04-28，2388x1080 真移动端横屏）

## 本轮范围（首页 -> 详情主链路）

- worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2`
- 分支：`feat/homepage-v2`
- 本轮目标：不改首页既有收口基线，继续把 **详情页状态** 从旧通用 scene 壳层中拆出来，改成与首页同类的固定构图 exact spread；中间翻页仍保留现有动画资源。
- 移动端约束：按 `docs/mobile-adaptation.md` / `docs/ai-rules/ui-ux.md` 执行，固定构图类界面优先 `scale-to-fit`，移动端只条件化压缩，不改桌面端默认语义与结构。

## 本轮运行与校验

```bash
npx eslint src/pages/HomeV2.tsx src/components/home-v2/GameDetails.tsx src/components/home-v2/LobbyDirectory.tsx
npm run typecheck
PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"
```

- 结果：
  - ESLint：0 error（保留 `LobbyDirectory.tsx` 1 条既有 fast-refresh warning）
  - Typecheck：通过
  - E2E：通过
  - 首页真分辨率日志：`width=2388, height=1080`
  - 首页书页舞台日志：`widthRatio=0.798, heightRatio=0.993, center=(0.500,0.500)`
  - 首页网格日志：`leftColumnDelta=0.00`、`rightColumnDelta=0.00`、`rowDelta=(0.00,0.00,0.00)`

## 本轮关键截图（绝对路径）

### 1) 首页目录页仍保持既有基线

- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-homepage-catalog.png`
- 肉眼结论：
  - 首页仍是 `2388x1080` 真移动端横屏口径，书页主体没有缩在左上角，也没有误回退成窄布局。
  - 双页 6 条目录项仍保持对齐，没有因为这次切详情页渲染路径而把首页基线带歪。

### 2) 详情页现在走独立 exact spread，而不是完全挂在旧 scene 壳里

- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-detail-entry.png`
- 肉眼验收口径：
  - 点击目录项后，详情页左右页内容仍完整落在书页内部，说明 detail 舞台比例与内容定位没有炸开。
  - 详情态与首页态现在都属于固定构图舞台；差别变成“首页 spread / 详情 spread / 中间翻页动画”三段，而不是继续把 detail 直接塞在旧首页场景壳里。
  - 右页房间列表、密码区、创建房间入口仍然存在，当前结构改造没有打断真实操作链路。

## 本轮结论

- 本轮已经把 Home V2 最关键的结构问题先拆掉：**首页是 exact spread，详情现在也变成 exact spread，中间翻页才是动画态**。
- 当前仍未完全收口的部分是 detail spread 的最终视觉与翻页帧资源统一；但“详情页继续完全依赖旧 scene 壳”的问题已经解除。

# Home V2 首页缩略图退步修复证据（2026-04-28，2388x1080 真移动端横屏）

## 本轮范围（仅首页回归修复）

- worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2`
- 分支：`feat/homepage-v2`
- 问题范围：只修首页目录页缩略图退步；当前用户指出的是“有不显示的”，即 `splendor` 白块与 `tictactoe` 退化成占位符。
- 修复边界：不重做首页布局，不扩散到详情页视觉改版，只恢复目录页真实可见缩略图与现有详情入口链路。

## 本轮运行与校验

```bash
npx eslint src/components/home-v2/LobbyDirectory.tsx
PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"
```

- 结果：
  - ESLint：0 error（保留 1 条既有 fast-refresh warning）
  - E2E：通过
  - 首页真分辨率日志：`width=2388, height=1080`
  - 书页舞台日志：`widthRatio=0.798, heightRatio=0.993, center=(0.500,0.500)`
  - 首页网格日志：`leftColumnDelta=0.00`、`rightColumnDelta=0.00`、`rowDelta=(0.00,0.00,0.00)`

## 本轮关键截图（绝对路径）

### 1) 首页目录页：两个回归缩略图已恢复显示

- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-homepage-catalog.png`
- 肉眼结论：
  - `splendor` 条目不再是白块，现在能直接看到缩略图主体；这说明 `splendor/picture` 路径已经恢复到可加载状态。
  - `tictactoe` 条目不再是 `#` 占位符，现在显示为项目注册的霓虹缩略图组件；也就是说首页已经重新接回真实前端缩略图，而不是字符兜底。
  - `summonerwars` 仍保持正常封面比例，没有因为这次修复再次歪斜；右页三条目录项都完整落在书页内容区内。
  - 当前截图里看不到新的白边/黄边溢出，也没有因为补图把目录行高或列对齐再次打歪。

### 2) 从首页进入详情页的最小链路仍然成立

- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-detail-entry.png`
- 肉眼结论：
  - 点击井字棋后，左页仍能进入详情态，说明这次只修缩略图显示，没有把首页点击链路改坏。
  - 右页房间列表与创建房间入口仍然存在，当前回归修复没有引入新的详情页空白或流程断裂。

## 本轮结论

- 首页当前“有不显示的”这两个回归位点已经修复：`splendor` 恢复可见缩略图，`tictactoe` 恢复真实缩略图组件。
- 首页继续保持真前端 DOM + 真移动端横屏 `2388x1080` 的验收口径，没有回退成假页面或整图热区。

# Home V2 首页参考稿终态收口（2026-04-28，2388x1080 真移动端横屏）

## 本轮范围（仅首页）

- worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2`
- 分支：`feat/homepage-v2`
- 验收口径：只收首页目录页；详情页仅保留“从首页点击后仍能进入”的最小链路证明。
- 首页实现口径：`background.png` 作为书页底图，分类导航 / 右上角入口 / 双页 6 条目录项全部由真实 DOM 渲染；缩略图只作为局部素材，不把整页参考图回灌成假页面。
- 固定验收分辨率：`2388 x 1080`

## 本轮运行与校验

```bash
npx eslint src/components/home-v2/LobbyDirectory.tsx
PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"
```

- 结果：
  - ESLint：0 error（保留 1 条既有 fast-refresh warning）
  - E2E：通过
  - 首页真分辨率日志：`width=2388, height=1080`
  - 书页舞台日志：`widthRatio=0.798, heightRatio=0.993, center=(0.500,0.500)`
  - 首页网格日志：`leftColumnDelta=0.00`、`rightColumnDelta=0.00`、`rowDelta=(0.00,0.00,0.00)`

## 本轮关键截图（绝对路径）

### 1) 首页目录页

- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-homepage-catalog.png`
- 肉眼结论：
  - 当前截图已经是 `2388x1080` 真移动端横屏口径，不再是之前的 `936x432` 代理视口。
  - 书页主体完整居中，首页没有缩在左上角，也没有被误改成窄布局；目录内容完整落在书页内部。
  - 顶部分类、右上角账号/概述入口、6 条目录项全部是可交互 DOM，不是整张参考图热区壳。
  - 左右两页三行目录项节奏已经统一：标题、摘要、badge、人数都处在同一套行基线内，双列不再错位。
  - `splendor / summonerwars` 缩略图底部浅色边已被继续压掉；badge 改成更接近参考稿的双标签组合，不再出现重复标签。
  - 仍保留用户明确要求的“选中态不加整块背景”，当前只用文字提权 + 细下划线描绘选中。

### 2) 从首页进入详情的最小链路

- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-detail-entry.png`
- 肉眼结论：
  - 从首页点击井字棋后，仍可进入详情页，说明首页重构没有把真实链路做成假页面。
  - 本轮只收首页，因此详情页保留最小可进证明，不继续扩展到详情视觉重构。

## 本轮结论

- 在用户要求的“只做首页、必须是真前端、必须在工作树里、必须按真移动端横屏分辨率验收”的范围内，本轮已收口。
- 当前首页目录页可以作为后续新会话的稳定基线；若下一轮继续推进，应切到详情页 / 登录页 / 翻页深化，而不是继续把首页目录页当未完成状态。

# Home V2 首页参考图重构证据（2026-04-26）

## 本轮范围（仅首页）

- worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2`
- 分支：`feat/homepage-v2`
- 验收口径：只收首页目录页；详情页仅保留“从首页点击后仍能进入”的最小链路证明，不继续扩 scope 到详情/登录/建房的视觉重构。
- 首页实现口径：`background.png` 作为书页底图，分类导航/账号入口/六个游戏条目全部用真实 DOM 渲染；不再使用差分抠图资产，也不再整张首页截图直出。
- 固定验收分辨率：`936 x 432`（手机横屏）

## 本轮运行与校验

```bash
npx eslint src/components/home-v2/LobbyDirectory.tsx src/pages/HomeV2.tsx e2e/lobby.e2e.ts
npm run typecheck
npm run i18n:check
BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_HEAVY_WAIT_FOR_BUDGET=1 BG_HEAVY_WAIT_TIMEOUT_MS=600000 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"
```

- 结果：
  - ESLint：0 error（`LobbyDirectory.tsx` 仅保留 1 条 fast-refresh warning）
  - Typecheck：通过
  - i18n：`no missing keys detected`
  - E2E：首页目录、右上角账号入口切到 rooms、返回 lobby、进入井字棋详情全部通过

## 本轮关键截图（绝对路径）

### 1) 首页目录页

- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-homepage-catalog.png`
- 肉眼结论：
  - 现在首页已经不是整张截图，而是前端真实排版：顶部分类、右上角账号入口、6 个目录条目都是可交互 DOM。
  - 画面里已经看不到此前差分资产导致的脏块/透明孔洞；书页底纹、分隔线、缩略图和文字都连续可见。
  - 顶部分类导航、标题字号、人数标签和条目缩略图尺寸已继续向参考图收紧；`splendor`、`summonerwars` 缩略图改为从用户参考图裁出的局部素材，其余条目仍保持真实前端列表结构。
  - 当前 `936x432` 横屏视口下，书页主体完整落在屏内，没有出现“缩在左上角”或被误修成窄布局。
  - `tictactoe` 仍由前端样式绘制，说明首页并不是把整页截图糊上去；即使个别游戏缺完整原始缩略图，当前 DOM 结构与点击链路仍保持可用。

### 2) 从首页进入井字棋详情的最小链路

- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-detail-entry.png`
- 肉眼结论：
  - 从首页点击井字棋后，左页已切到详情态，能看到标题“井字棋”和描述正文，说明首页点击链路仍然有效。
  - 右页能看到注入的房间卡与“创建房间”入口，证明首页重构没有打断“进详情后继续操作”的最小后续流程。
  - 这张图仍保留旧详情页/右侧书签视觉，符合本轮“只做首页，详情页先不重构”的范围控制。

## 本轮结论

- 首页重构已从“截图直出”纠偏回“前端真实 UI”：当前首页主视觉由 DOM + 书页底图组成，适用于移动端横屏交互。
- 端到端验收已通过：首页可进入、可切 rooms、可返回 lobby、并能继续点击井字棋进入详情。
- 当前仍未纳入本轮的内容：详情页视觉统一、登录注册页进一步贴近参考图、建房页/翻页动效深化；这些留到首页之后的下一阶段。

---

# Home V2 移动端最少可玩链路证据（2026-04-23）

## 范围

- worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2`
- 分支：`feat/homepage-v2`
- 固定验收分辨率：`936 x 432`（手机横屏）
- 本轮关注点：
  - 登录/注册不再走弹窗，改为右页内联表单。
  - 左页 6 卡两排对齐，第六个卡位不再下沉，卡面恢复九宫格素材边框。
  - 详情页 tag 收敛，不再压住正文。
  - 创建房间弹窗完整留在可视区内。
  - 首页底部收敛为低对比桌面暗部，不再出现突兀纯黑硬边。

## 本轮补充规范（防止底边视觉回归）

- Home V2 背景桌面图层必须固定为 `object-fit: cover` + `object-position: top`，避免素材底缘黑带进入可视区。
- Home V2 证据截图验收必须显式检查底部：不得出现贯穿整屏的纯黑底边带；若存在暗部，需与桌面背景低对比融合。

## 运行与校验

```bash
npx eslint src/components/home-v2/LobbyDirectory.tsx src/components/lobby/GameList.tsx src/components/home-v2/HomeTabPanels.tsx src/components/auth/AuthModal.tsx src/pages/HomeV2.tsx src/pages/HomeV2Draft.tsx src/ugc/runtime/ui-scene/prefabs.tsx e2e/lobby.e2e.ts
npm run typecheck
npm run i18n:check
BG_HEAVY_MEMORY_MIN_FREE_GB=1.0 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 node scripts/infra/run-e2e-single.mjs ci e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"
BG_HEAVY_MEMORY_MIN_FREE_GB=1.0 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 node scripts/infra/run-e2e-single.mjs ci e2e/lobby.e2e.ts "homeV2Draft 详情页输入房间密码后可加入加密房间"
```

- 结果：
  - ESLint：0 error，6 warning（`LobbyDirectory.tsx` fast-refresh + `CreateRoomModal.tsx` 既有 warning）
  - Typecheck：通过
  - i18n：`no missing keys detected`
  - E2E：两条核心链路均通过

## 关键截图（绝对路径）

### 1) 登录页签：右页内联认证（非弹窗）

- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-login-tab.png`
- 肉眼结论：
  - 左页只保留“登录/注册”入口，不再出现“账号 + 账号登录”重复口径。
  - 右页直接展示认证输入区与提交按钮，不再弹出居中 modal。
  - 登录区域风格与书页保持同源材质，不是悬浮外来块。

### 2) 目录页：两排网格基线一致

- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-rooms-tab.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-catalog-return.png`
- 肉眼结论：
  - 左页保持 3x2 网格，第六个卡位不再明显下沉。
  - 第二排与第一排列间距一致，卡片标题区高度稳定。
  - 右页保持留白，不再被拆成双页目录。
- E2E 量测日志（同一次通过用例）：
  - `firstRow=(133.38,129.39,133.38)`
  - `secondRow=(273.66,269.67,273.66)`
  - `rowDelta=(3.99,3.99)`
  - `colGap=(140.29,140.29,140.29)`
  - `colGapDelta=0.00`

### 3) 详情页：tag 缩小且不挤占描述

- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-detail-open.png`
- 肉眼结论：
  - 左页类型/人数 tag 尺寸收敛，描述正文可连续阅读。
  - 右页房间项保持“标题+座位+tag 同行尾部”紧凑布局，tag 不再挤压描述主文本。
  - “返回目录”“创建房间”按钮可见且可点击。

### 4) 建房弹窗：完整在视口内

- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-create-room-modal.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-create-room-success.png`
- 肉眼结论：
  - 弹窗首屏可完整看到 `取消/确认创建`，不需要先滚动。
  - 输入区字号、内边距已下调，阅读密度更稳定。
  - E2E 量测：`top=24.03`、`bottom=423.69`、`viewportHeight=432`，未超出可视区。
  - 点击 `确认创建` 后成功进入对局页面。

### 5) 密码入房链路：输入与收口完整

- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-详情页输入房间密码后可加入加密房间\homeV2Draft-详情页输入房间密码后可加入加密房间-locked-room-password-panel.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-详情页输入房间密码后可加入加密房间\homeV2Draft-详情页输入房间密码后可加入加密房间-locked-room-join-success.png`
- 肉眼结论：
  - 点击加密房后出现密码输入面板，输入框文案“输入密码”可完整显示。
  - `取消/确定` 与 `创建房间` 同屏可见，不遮挡流程。
  - 输入正确密码后进入对局，链路从详情页成功收口。

## 结论

- 当前 HomeV2 在 `936 x 432` 口径下已跑通两条核心链路：`创建房间进局`、`密码入房进局`。
- 登录已改为右页内联认证，目录网格对齐问题与弹窗越界问题均已被截图和量测共同证明已收敛。


---

# Home V2 首页参考稿重构（2026-04-27，2388x1080 真移动端口径）

## 本轮运行命令

```bash
PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 npm run test:e2e:ci:file -- e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"
```

## 本轮关键截图（绝对路径）

- `D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2	est-results\evidence-screenshots\_shared\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-homepage-catalog.png`

## 肉眼结论

- 这张图已经不是 `936x432` 代理视口，而是 `2388x1080` 真移动端横屏口径；E2E 日志中 `home-v2-viewport` 已明确打印 `width=2388, height=1080`。
- 书页主体仍完整落在屏幕中央，没有出现“缩在左上角”或内容跑出书壳的情况。
- 顶部导航、右上角账号入口、六个目录条目都已经按真分辨率重新放大和重排，比上一轮更接近参考图节奏。
- 当前截图仍未完全达到“一模一样”：右上角入口还可继续精修；左右两列条目的纵向节奏还可继续收；`splendor / summonerwars` 缩略图边缘仍值得再做最后一轮清边。
