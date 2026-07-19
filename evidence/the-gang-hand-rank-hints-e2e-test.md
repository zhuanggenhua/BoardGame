# 纸牌帮手牌当前牌型提示统一 E2E 证据

## 问题

- 用户指出单副手牌和两副手牌的当前牌型提示口径不统一。
- 本轮确认：左下角“牌型”是牌型强弱速查入口，不是当前手牌结果提示；当前手牌结果应显示在本地手牌旁。

## 修复口径

- 单副手牌：本地手牌旁显示 `手牌：<当前牌型>`。
- 两副手牌：本地上排显示 `上手：<当前牌型>`，下排显示 `下手：<当前牌型>`。
- 双手和单手共用同一套手牌行提示组件，不再只让两副手牌分支有当前牌型结果。

## 截图证据

| 截图 | 路径 | 肉眼结论 |
| :--- | :--- | :--- |
| 单副手牌当前牌型提示 | `test-results/evidence-screenshots/the-gang/hand-rank-hints-current/01-单副手牌当前牌型提示.jpg` | 自己手牌左侧显示 `手牌：一对`，能看出这是当前两张手牌结合公共牌后的结果提示。 |
| 两副手牌上下当前牌型提示 | `test-results/evidence-screenshots/the-gang/hand-rank-hints-current/02-两副手牌上下当前牌型提示.jpg` | 上排显示 `上手：高牌`，下排显示 `下手：两对`，两副手牌各自有独立当前牌型提示。 |

## 预览相册

- 详情页：`http://8.148.71.102:18080/#/boardgame/the-gang-hand-rank-hints`
- 服务器回查：预览服务 `/health` 返回 `{"status":"ok"}`，相册 `latest` 目录包含 2 张图片和 `manifest.json`。
- 浏览器回查：公网详情页可加载第一张，点击下一张后可显示第二张；两张图片的实际尺寸均为 `1366x768`。

## 验证命令

- `npx eslint src/games/the-gang/Board.tsx src/games/the-gang/__tests__/Board.runtime.test.tsx e2e/the-gang/the-gang-runtime.e2e.ts`
- `npx vitest run src/games/the-gang/__tests__/Board.runtime.test.tsx`
- `node scripts/infra/run-e2e-single.mjs default e2e/the-gang/the-gang-runtime.e2e.ts "桌面端单副手牌在公共牌出现后显示当前牌型提示"`
- `node scripts/infra/run-e2e-single.mjs default e2e/the-gang/the-gang-runtime.e2e.ts "桌面端两副手牌投票后进入手牌调换阶段并可交换上下手牌"`

## 规范更新

- 已在 `docs/ai-rules/ui-change-gates.md` 增加“单对象 / 多对象分支不得分裂状态提示家族”门禁。
- 规则要求：当多对象分支新增当前结果、状态徽章、选中态、可用态或确认反馈时，必须回查旧单对象分支是否需要同一信息家族，并用截图或测试证明口径一致。

