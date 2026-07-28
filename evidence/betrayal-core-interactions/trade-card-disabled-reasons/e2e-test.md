# 山屋惊魂交易限制牌面禁用提示 E2E 证据

目标状态：active
当前目标：交易候选区中不可交易牌不再消失，而是保留牌面、禁用并显示玩家可读原因。
非当前历史背景：普通多选交易、每回合一次交易、特殊行动预算已在其它证据目录覆盖。
禁止自动接管：本证据只证明交易候选牌面禁用提示，不代表攻击声明、狗完整交易链、全部特殊行动或 50 个作祟已完成。
更新时间：2026-07-25

## 规则真相

- 本回合已经作为特殊行动、攻击武器或狗交易来源使用过的持有物，不能再被交易。
- 不可交易不应让牌从候选区消失；玩家需要看到是哪张牌不可交易以及原因。
- 交易读模型统一来自 `resolveBetrayalTradeCardStatus`；领域交易校验、普通交易 UI、对方给回候选和狗交易候选都消费同一状态。

## 实现证据

- `src/games/betrayal/game.ts`：`resolveBetrayalTradeCardStatus` 对已用、狗交易来源和不存在持有物返回 `canTrade=false` 与原因；攻击结算会把使用过的武器加入本回合已用持有物。
- `src/games/betrayal/Board.tsx`：持有物牌面按钮写入 `data-trade-card-status` 和 `data-trade-card-disabled-reason`，不可交易时禁用按钮但仍渲染牌面、放大入口和短原因。
- `src/games/betrayal/__tests__/Board.foundation.test.tsx`：覆盖普通交易己方给出、普通交易对方给回、狗交易候选三类禁用提示。
- `e2e/betrayal/trade-card-disabled-reasons.e2e.ts`：真实牌桌状态注入 E2E，覆盖三张截图与点击禁用牌不会选中的断言。

## 自动验证

- `npx eslint src/games/betrayal/Board.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx e2e/betrayal/trade-card-disabled-reasons.e2e.ts`：0 errors。
- `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "狗交易候选区会保留|普通交易会保留" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：2 passed / 90 skipped；进程退出码 0，末尾 socket 断开为测试环境噪声。
- `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "狗交易沿用正常交易限制|砍刀只能作为攻击武器" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：2 passed / 199 skipped。
- `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "交易卡状态区分" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：1 passed / 200 skipped。
- `$env:PW_USE_DEV_SERVERS='false'; $env:PW_ALLOW_DEV_SERVER_TESTS='false'; npm run test:e2e:ci:file -- e2e/betrayal/trade-card-disabled-reasons.e2e.ts`：1 passed。

## 截图证据

| 截图 | 绝对路径 | 肉眼观察 | 验收结论 |
| --- | --- | --- | --- |
| 普通交易己方已用牌保留禁用原因 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\trade-card-disabled-reasons\01-普通交易己方已用牌保留禁用原因.jpg` | 真实牌桌中己方持有区仍能看到已用牌面，牌面旁显示“本回合已经使用过的持有物不能交易”，可交易牌仍可选中。 | 达标：不可交易牌没有被过滤消失，禁用原因可见。 |
| 普通交易对方已用牌保留禁用原因 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\trade-card-disabled-reasons\02-普通交易对方已用牌保留禁用原因.jpg` | 选择交易目标后，对方给回候选区仍显示已用地图牌面和禁用原因；未用牌仍保持可选。 | 达标：对方给回候选同样消费交易状态。 |
| 狗交易已用牌保留禁用原因 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\trade-card-disabled-reasons\03-狗交易已用牌保留禁用原因.jpg` | 狗交易候选区保留已用急救包牌面并显示不可交易原因，未用地图可正常选择。 | 达标：狗交易候选不再因已用牌过滤掉牌面。 |

## AI 核图

- 核图方式：生成低清联系图 `_ai-audit-contact-sheet.jpg` 后人工核对三张 1600x900 原始截图的缩略整体。
- 结论：三张都是真实牌桌，不是加载页、失败页或旧相册图；禁用牌面、禁用原因和仍可选牌面都可见。
- 不外推：本切片没有证明完整攻击声明 UI、所有武器牌完整录入、狗远距交易全流程、全部作祟特殊交易限制或山屋完整规则。

## 服务器相册

- 详情页：`http://8.148.71.102:18080/#/boardgame/betrayal-trade-card-disabled-reasons`
- 服务器本机：`curl -fsS http://127.0.0.1:18080/health` 返回 `{"status":"ok"}`。
- 服务器目录：`/home/admin/image-preview/data/projects/boardgame/tasks/betrayal-trade-card-disabled-reasons/latest` 包含 `manifest.json` 和三张 JPG。
- 公开页回查：桌面布局能加载三张 1600x900 图片；三张远端 JPG 直链分别返回 200，大小为 123283 / 132832 / 128368 字节。
