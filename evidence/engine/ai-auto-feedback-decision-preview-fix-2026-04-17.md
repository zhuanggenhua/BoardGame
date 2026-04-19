# AI 自动反馈决策预览补强（2026-04-17）

## 背景
- 之前服务端 `online-ai-watchdog` / `unsatisfiable-interaction-auto-skipped` 自动反馈，已经能带 `reason`、`trackerKey`、`stateSnapshot`、`actionLog`。
- 但反馈里仍缺少 **AI 当时可见的合法动作** 与 **本地策略视角下的决策预览**，排查时只能知道“为什么卡住/为什么不能选”，不知道“如果让 AI 继续，它理论上会选什么”。

## 本轮修改
- 文件：`src/engine/transport/server.ts`
- 补强点：
  1. watchdog 成功/失败反馈的 `stateSnapshot` 新增：
     - `seatControllerType`
     - `legalActions`
     - `aiDecisionPreview`
  2. `unsatisfiable-interaction-auto-skipped` 的 `stateSnapshot` 同步新增相同字段，确保两条自动反馈链口径一致。
  3. `aiDecisionPreview` 目前走 **本地策略预览**：
     - `local-ai`：使用 seat 当前 local policy
     - `remote-ai`：使用 fallback local policy 做预览，不触发远程 provider 网络调用

## 预期收益
- 反馈不再只有“不能选/卡住”的消极诊断，还能看到：
  - AI 当前有哪些合法动作
  - 本地策略预览会选哪个动作
  - 决策摘要 `reasoningSummary`
  - 置信度 `confidence`
- 对 admin 侧排查更直接：能区分“没有动作可选”与“有动作但策略/接线选错了”

## 验证
- 测试文件：`src/engine/transport/__tests__/server.test.ts`
- 新增/增强断言：
  - watchdog 失败反馈包含 `legalActions` + `aiDecisionPreview`
  - unsatisfiable feedback 也包含统一的 `seatControllerType` / `legalActions` / `aiDecisionPreview`

## 本轮命令
- `npx eslint src/engine/transport/server.ts src/engine/transport/__tests__/server.test.ts`
- `npx vitest run src/engine/transport/__tests__/server.test.ts`
- `npm run typecheck`

## 风险与边界
- `aiDecisionPreview` 是 **本地策略预览**，不是远程 provider 的真实返回；对 `remote-ai` 只作为排障辅助，不应误解为“远程模型实际会这样选”。
- 本轮没有解决 **UI 本地 mode 等待态** 的结构性问题；如果等待态根本没进入服务端可见状态机，自动反馈仍然拿不到完整真相源。
