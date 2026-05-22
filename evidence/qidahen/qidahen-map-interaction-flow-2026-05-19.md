# 七大恨地图交互与行动流程证据（2026-05-19）

## 本轮目标

- 依据实际主地图素材选择地图交互方向，不凭空猜 UI。
- 地图区域点击、高亮、tooltip、领域结算使用同一份区域定义。
- 轮盘分支不再常驻 `走 1 / 走 2 / 走 3` 按钮；移动摘要只在轮盘 hover/focus tip 出现。
- 右侧行动按钮点击即执行，不再出现同义 `执行` 按钮、支付状态、弃置数量或花费圆章。

## 实现方向裁决

- 实际素材 `public/assets/i18n/zh-CN/qidahen/board/main-board.png` 是静态印刷主地图，区域边界和 token 位置都在同一张图上；当前不需要 Three.js/WebGL。
- 当前选择：同源 polygon 数据 -> 离屏 2D canvas hitmap 负责点击/hover 命中，SVG overlay 负责可见高亮，tooltip 和领域结算回到同一 region id。
- WebGL color picking 只作为后续升级路线：当全图区域数量、缩放拖拽或动态高亮性能证明 2D canvas 不够时再切换。

## 截图证据

### 桌面地图与 HUD

截图：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-board-desktop-current.png`

- 我实际看到：真实主地图已经进入中央玩法层，锦州区域被点击后出现红色区域边界和纸签 tooltip，tooltip 显示 `锦州 · 后金`、兵力和人口。
- 我实际看到：左上只保留前端 HUD 轮盘作为可交互轮盘；主图原生轮盘残留已用 `left-top-clean-patch-v2` 清理，没有再和 HUD 轮盘形成两个完整轮盘。
- 我实际看到：轮盘没有常驻 `走 1 / 走 2 / 走 3` 按钮；移动结果摘要只作为轮盘 hover tip 出现。
- 我实际看到：右侧行动是短纸签按钮，没有 `执行` 二次按钮、支付面板、弃牌数量或花费圆章。

结论：桌面端达到本轮地图交互基础验收。剩余风险是当前只录入了可玩切片区域 polygon，不是全图所有区域。

### 行动结算链路

截图：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-board-action-flow-current.png`

- 我实际看到：先点击锦州，再点击 `赐印招安` 后，tooltip 从 `锦州 · 后金` 变为 `锦州 · 大明`，控制 marker 同步变为大明。
- 我实际看到：大明手牌从 5/15 变为 2/15，手牌区剩 3 张，弃牌堆从 7 变为 10；这证明按钮点击直接完成自动弃牌和结算。
- 我实际看到：结算后仍没有支付面板或同义执行按钮回流。

结论：当前可玩切片的地图目标选择 -> 行动按钮 -> 自动支付 -> 地图控制权变更链路已跑通。

### 手机横屏

截图：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-board-mobile-landscape-current.png`

- 我实际看到：手机横屏没有缩在左上角，地图、轮盘、玩家条、右侧行动和底部手牌仍在同一缩放舞台内。
- 我实际看到：地图和 HUD 没有变成窄布局；右侧行动按钮仍是短按钮，底部抽牌、手牌、弃牌都保持可见。
- 我实际看到：地图在横屏下可读性下降但仍可识别，属于缩放视口限制，不是布局错位；选中区域 tooltip 显示 `汉城 · 大明`，与地图素材区域名一致。

结论：移动横屏达到“不缩角、不窄化、不丢 HUD”的基础验收。

## 验证命令

- `npx eslint src/games/qidahen/Board.tsx src/games/qidahen/domain/index.ts src/games/qidahen/criticalImageResolver.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/payment-selection.test.ts e2e/qidahen-basic-flow.e2e.ts`
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx vitest run src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/payment-selection.test.ts --pool threads --no-file-parallelism --maxWorkers 1`
- `$env:PYTHONUTF8='1'; python D:\codex-home\skills\.system\skill-creator\scripts\quick_validate.py .windsurf\skills\boardgame-ui-imagegen`
- `$env:PW_WORKERS='1'; $env:PW_ISOLATE_PORTS='true'; npm run test:e2e:ci:file -- e2e/qidahen-basic-flow.e2e.ts`

验证结果：ESLint 通过；Vitest 2 files / 105 tests 通过；skill quick_validate 通过；Playwright 3 passed。

## 完成审计

| 目标要求 | 当前证据 | 结论 |
| --- | --- | --- |
| 以地图边界线作为区域划分依据 | `mapRegions.ts` 定义当前可玩切片 polygon；新增单测要求领域区域与 polygon 双向存在、名称一致、点位在地图范围内 | 当前可玩切片达标；不是全 35 区域 |
| 失败则换方案 | 2D canvas hitmap 在 E2E 中通过点击锦州、hover/selected 高亮与结算验证；未触发换 WebGL 条件 | 当前无需换方案 |
| 正式实施游戏 | 已接入真实地图、轮盘、行动按钮、自动弃牌、区域控制权和 marker 更新 | 当前是可玩纵切，不是完整全规则实现 |
| 自己端到端测试 | `e2e/qidahen-basic-flow.e2e.ts` 3 passed，并实际查看三张截图 | 达标 |
| 用户角度友好交互 | 地图区域直接点击；轮盘分支在轮盘本体 hover/tap；行动按钮点击即结算；无常驻说明块、无同义执行按钮 | 当前纵切达标 |
| 跑一个完整流程 | 锦州选中 -> `赐印招安` -> 自动弃 3 张 -> 锦州控制权变大明 -> marker/手牌/弃牌同步 | 达标 |

## E2E 运行备注

默认 managed isolated E2E 入口误拿到已占用的 multi-worker 基准端口 `6273/20100/21100`，本轮没有清理该运行中的其它任务。实际通过显式 `PW_WORKERS=1` + `PW_ISOLATE_PORTS=true` 使用 `6174/20000/21000` 完成隔离运行。
