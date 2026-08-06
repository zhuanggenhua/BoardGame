# 山屋惊魂：普通投骰事件代表链验收

> 日期：2026-08-01
> 范围：探索房间触发事件牌、事件牌投骰承接、确认按钮与结果去重。

## 目标合同

- 下一张探索必须稳定命中事件牌 `标本剥制`，不能因随机房间符号漂移成预兆或物品。
- 事件牌正式卡图是主正文承载；卡图已有标题与正文时，UI 不再另铺顶部正文或确认步骤正文。
- 投骰承接必须使用开放透明骰盘，不出现深色大背景、骰盅托盘或封闭面板。
- 骰面合计、加值、总点数必须可见。
- 确认按钮只显示 `确认` 或必要的 `确认 X/Y`，不能退回 `确定` 或重复结果正文。

## 本轮改动

- `e2e/betrayal/non-p0-representative.e2e.ts`：普通投骰事件代表链固定下一间房为事件房间，并增加顶部正文退场、隐藏确认账本、确认按钮文案的断言。
- `src/games/betrayal/Board.tsx`：单步发现牌确认按钮改为发现牌语义 `确认`；多步继续使用 `确认 X/Y`。
- `public/locales/zh-CN/game-betrayal.json` / `public/locales/en/game-betrayal.json`：新增发现牌确认文案。
- `src/games/betrayal/__tests__/Board.foundation.test.tsx`：同步单步确认按钮预期，避免继续固化旧的 `确定`。

## 验证命令

```powershell
$env:PW_USE_DEV_SERVERS='false'; $env:PW_ALLOW_DEV_SERVER_TESTS='false'; npm run test:e2e:ci:file -- e2e/betrayal/non-p0-representative.e2e.ts "普通投骰事件代表链"
```

结果：`1 passed`。

补充验证：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/Board.foundation.test.tsx --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "即时事件效果|肉质苔癣|蜘蛛|大宅饿了|说\u201c茄子\u201d|房间文字效果"
$env:NODE_OPTIONS='--max-old-space-size=12288'; node .\node_modules\eslint\bin\eslint.js src/games/betrayal/Board.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx e2e/betrayal/non-p0-representative.e2e.ts
```

结果：

- Vitest：`1 passed`，`11 passed / 169 skipped`；控制台有开发服务器 `localhost:3000` 未开启导致的异步连接拒绝噪声，但测试进程退出码为 0，相关断言通过。
- ESLint：退出码 0；仅 `Board.tsx` 超大文件的 Babel deoptimise 提示。

## 当前截图

1. `D:/gongzuo/webgame/BoardGame/evidence/betrayal-non-p0-representatives/01-普通投骰事件-探索目标.jpg`
2. `D:/gongzuo/webgame/BoardGame/evidence/betrayal-non-p0-representatives/02-普通投骰事件-卡牌正面.jpg`
3. `D:/gongzuo/webgame/BoardGame/evidence/betrayal-non-p0-representatives/03-普通投骰事件-投掷骰子.jpg`
4. `D:/gongzuo/webgame/BoardGame/evidence/betrayal-non-p0-representatives/04-普通投骰事件-牌面骰盘分支.jpg`

## AI 图面审计

verdict: `PASS`

score: `94/100`

hard_failures: `[]`

图面事实：

- `04-普通投骰事件-牌面骰盘分支.jpg` 中，事件牌 `标本剥制` 的正式卡图是主焦点；右侧没有第二套确认步骤列表，也没有顶部重复正文横幅。
- 骰子直接浮在开放桌面上，未见深色托盘、骰盅式封闭面板或黑盒背景。
- 骰面合计、加值和总点数同时可见；确认按钮显示为 `确认`。
- `03-普通投骰事件-投掷骰子.jpg` 局部图证明骰盘裁图中仍无托盘或背景框，骰面可读。

## 未覆盖

- 本记录只覆盖普通事件投骰代表链；完整牌桌 UI 合同仍需继续补：预兆进度条普通态、最后预兆态、作祟触发剧本阅读承接、作祟开始态、开局过场与过场关闭后牌桌。
