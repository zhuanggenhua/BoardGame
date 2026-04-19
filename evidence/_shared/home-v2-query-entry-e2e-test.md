# Home V2 运行态入口 E2E 证据（登录 + 创建房间 + 已有房间 UI）

## 范围

- worktree：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2`
- 分支：`feat/homepage-v2`
- 目标：
  - `/?homeV2Draft=1` 可进入运行态 `HomeV2`
  - 首页目录、详情页（房间簿）链路可用
  - 登录本身可走通（账号登录成功并回写到书页登录面板）
  - 创建房间流程可走通（从详情页创建后进入对局）
  - 已有房间 UI 可见（注入房间记录 + 加入入口）
  - 书签切换走翻页动画（非瞬切）
  - 无权威来源的“实时排行”能力已下线（不再渲染榜单页内容）
  - 新增的 `登录 / 更新日志` 页签按统一书本风格渲染
  - 详情页“创建房间”按钮继续使用九宫格素材边框
  - 目录图标卡位弧线保持：第 3 张（大杀四方）略高于第 2 张（王权骰铸）

## 验证命令

```bash
npx eslint src/components/home-v2/HomeTabPanels.tsx src/components/home-v2/GameDetails.tsx src/components/lobby/GameList.tsx e2e/lobby.e2e.ts
npm run typecheck
npm run i18n:check
BG_HEAVY_MEMORY_MIN_FREE_GB=1.0 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 node scripts/infra/run-e2e-single.mjs ci e2e/lobby.e2e.ts "homeV2Draft 查询参数会切到 V2 首页并可进入详情页"
BG_HEAVY_MEMORY_MIN_FREE_GB=1.0 PW_E2E_SERVICE_REUSE=shared-single PW_E2E_FRONTEND_PORT=37974 PW_E2E_GAME_SERVER_PORT=30180 PW_E2E_API_SERVER_PORT=30181 node scripts/infra/run-e2e-single.mjs ci e2e/lobby.e2e.ts "homeV2Draft 详情页输入房间密码后可加入加密房间"
```

## 截图证据（2026-04-19）

### 0) 书本素材加载门禁（新增）

- 在 `e2e/lobby.e2e.ts` 新增 `ensureHomeV2BookMaterialsReady()`，强制检查以下素材必须 `ok`：
  - `/assets/common/images/home-v2/book-desk/compressed/1.webp`
  - `/assets/common/images/home-v2/book-idle/compressed/1.webp`
  - `/assets/common/images/home-v2/side-tabs-static/compressed/1.webp`
- 若命中 `missing/loading/broken`，测试直接失败，避免再出现“素材没加载却误收口”。

### 1) 登录页签（真实账号登录）

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-login-tab.png`
- 观察：
  - E2E 在点击书签后先捕获 `data-testid="home-v2-tab-flipping"`，确认切换过程经过翻页动画，再进入目标页签。
  - 右页同步展示“已存在房间”列表，可见注入房间 `书页演示房-xxxx`，证明首页层面的房间 UI 已接通。
  - 使用 `admin@example.com / admin1234` 在 `AuthModal` 中提交后，登录弹窗关闭。
  - 左页标题从“账号登录”切换为“管理员”，证明登录状态已回写到 HomeV2 登录面板。
  - 右侧书签文本为“大厅 / 登录 / 更新”，不再出现“当前开局”。

### 2) 更新日志页签

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-changelog-tab.png`
- 观察：
  - 左页标题为“最近更新”，右页为登录面板，页签结构统一。
  - 加载态位于素材边框容器内，未出现额外白底容器。

### 2.1) 书签页签对齐测量（像素）

- 测量口径：读取 `data-scene-node=tab_button_{lobby|rooms|changelog}` 三个点击区的屏幕中心点。
- E2E 日志：
  - `[home-v2-tabs] centers(px): lobby=(1178.00,210.41), rooms=(1178.00,269.66), changelog=(1178.00,328.97), spacing=(59.26,59.30)`
- 观察：
  - 三个页签 `centerX` 一致，说明没有左右偏移错位。
  - 相邻间距 `spacing` 基本一致（`59.26 / 59.30`），且处于预期范围（45~70）。
  - 已移除 `tab_button_leaderboard` 隐形点击区，避免出现“看不见的排行榜页签热点”。

### 3) 详情页（房间簿）

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-detail-open.png`
- 观察：
  - 左页“类型 / 建议人数 + 正文描述”信息保持简洁，无“玩法概览”重复标题。
  - 右页“房间簿”展示注入房间；“加入”动作位于房间卡右侧中线附近。
  - 底部“创建房间”按钮仍是素材九宫格边框（E2E 已校验 `borderImageSource` 指向 `holders/compressed/1.webp`）。
  - 同时可见公开房间与加锁房间记录（`书页演示房-xxxx`、`移动端密码房-xxxx`）。
  - 加锁房间右侧显示“加密”标记，可和普通“加入”房间区分。

### 4) 创建房间弹窗（详情页右页触发）

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-create-room-modal.png`
- 观察：
  - 在详情页点击“创建房间”后，`create-room-modal` 弹窗出现，说明入口可用。
  - 弹窗内可填写房间名称并点击确认按钮（`create-room-confirm-button`）。

### 5) 返回目录页

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-catalog-return.png`
- 观察：
  - 目录图标仅保留单层素材底框，不再叠加额外边框层。
  - 第 3 张“大杀四方”卡位略高于第 2 张“王权骰铸”。
  - 测量日志：`cardia=167.16px, dicethrone=159.16px, smashup=158.36px`（相对 `home-v2-book-stage` 顶部）。

### 6) 创建成功进入对局

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\lobby.e2e\homeV2Draft-查询参数会切到-V2-首页并可进入详情页\homeV2Draft-查询参数会切到-V2-首页并可进入详情页-create-room-success.png`
- 观察：
  - 点击创建确认后，URL 进入 `/play/tictactoe/match/<matchId>?playerID=0`。
  - 本轮已补回 `src/pages/matchHudPresence.ts`，创建后不再出现 `MatchRoom.tsx` 的 import 解析报错遮罩。
  - 截图时处于“对局资源加载中”阶段（非报错/回跳），并已通过 URL 命中与后续 E2E 断言证明链路已打通。

### 7) 加密房间输入密码后加入

- 路径（密码面板）：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\lobby.e2e\homeV2Draft-详情页输入房间密码后可加入加密房间\homeV2Draft-详情页输入房间密码后可加入加密房间-locked-room-password-panel.png`
- 路径（加入成功）：`D:\gongzuo\webgame\BoardGame\.worktrees\homepage-v2\test-results\evidence-screenshots\lobby.e2e\homeV2Draft-详情页输入房间密码后可加入加密房间\homeV2Draft-详情页输入房间密码后可加入加密房间-locked-room-join-success.png`
- 观察：
  - 点击“加密”房间后，右页底部出现内联密码面板（非浮层弹窗），字段与“取消/确定”按钮可见。
  - 输入正确密码并确认后，E2E 已断言 URL 命中 `/play/tictactoe/match/<lockedMatchId>?playerID=...`，链路进入真实对局路由。
  - “加入成功”截图已进入棋盘主界面（可见棋盘、玩家名和当前回合文案），未出现回退到首页或报错遮罩。

## UI 统一性复审（加密相关）

- 书签页签只保留真实存在的三项：`大厅 / 登录 / 更新`，移除不存在的排行榜页签点击区。
- 书签连续排列，不再留空档位。测量日志：`spacing=(59.26,59.30)`，三枚书签中心间距一致。
- 加密标识统一为文本形态：
  - 登录页房间列表：显示为 `... · 加密`（去掉圆形白底 badge）。
  - 详情页房间簿：右侧操作位显示 `加密`，与“加入/观战”同一视觉体系。
- 加密密码输入区采用极简样式：
  - 去掉解释性副文案，仅保留标题、输入框、取消/确定；
  - 容器为轻边框无重底色，按钮沿用书页边框按钮，避免风格分叉。

## 结论

- 本轮核心流程已覆盖：登录成功、已有房间可见（含锁房密码入口）、详情页创建房间并进入对局。
- 目录→详情→返回目录闭环保持可用，且详情右页房间簿与创建按钮样式符合书本素材风格。
- 用户明确反感的文案/页面形态已收敛：不再出现“当前开局”“热度榜”表述，主界面不再展示操作教学式说明。
