# 大杀四方联机 AI 超时自动收口 E2E 证据

## 目标

- 验证联机房间里，房主视角看不到 AI seat 私有交互时：
  - `4 秒` 可安全跳过的隐藏 `simple-choice` 会被系统自动跳过；
  - `8 秒` 内没有任何真实进展的 AI 会被系统自动强制结束当前回合；
  - 两种兜底最终都会推进权威状态，而不是只把前端提示层收掉；
  - `8 秒` 兜底内部必须走“先解卡住，再按最新权威状态单独 `ADVANCE_PHASE`”，避免 stale batch 回滚后反复重试，或误把人类回合一起推进掉。

## 用例

- 测试文件：`e2e/smashup-phase-transition-simple.e2e.ts`
- 用例 1：`在线 AI 的盘旋机器人隐藏交互卡住时，应在 4 秒后自动跳过并恢复对局`
- 用例 2：`在线 AI 连续 8 秒没有任何实际进展时，应自动强制结束当前回合`
- 辅助单测：`src/pages/__tests__/matchSeatValidation.test.ts`
- 运行命令：

```bash
BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 npm run test:e2e:ci:file -- e2e/smashup-phase-transition-simple.e2e.ts "在线 AI 的盘旋机器人隐藏交互卡住时，应在 4 秒后自动跳过并恢复对局"
BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 npm run test:e2e:ci:file -- e2e/smashup-phase-transition-simple.e2e.ts "在线 AI 连续 8 秒没有任何实际进展时，应自动强制结束当前回合"
BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 npm run test:e2e:ci:file -- e2e/smashup-phase-transition-simple.e2e.ts "在线 AI 连续 8 秒没有任何实际进展时，应自动强制结束当前回合"
node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native --maxWorkers 1
```

## 截图

### 1. 4 秒自动跳过触发时

![hoverbot-force-skip-toast](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/在线-AI-的盘旋机器人隐藏交互卡住时，应在-4-秒后自动跳过并恢复对局/在线-AI-的盘旋机器人隐藏交互卡住时，应在-4-秒后自动跳过并恢复对局-online-ai-hoverbot-force-skip-toast.png)

- 左上角回合条仍显示 `回合3 / 对手 / 出牌阶段`，说明这不是页面刷新重进，而是 AI 当前回合中的超时收口。
- 棋盘中央仍只看到 AI 的 `盘旋机器人`，房主界面没有出现 hoverbot 的选择面板，符合“隐藏交互只属于 AI seat”。
- 右上角 toast 标题为 `AI 响应超时`，正文明确写出“已在 4 秒超时后自动跳过”，且没有“继续等待 / 强制跳过”按钮残留。

### 2. 4 秒自动跳过完成后

![hoverbot-force-skip-after](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/在线-AI-的盘旋机器人隐藏交互卡住时，应在-4-秒后自动跳过并恢复对局/在线-AI-的盘旋机器人隐藏交互卡住时，应在-4-秒后自动跳过并恢复对局-online-ai-hoverbot-force-skip-after-resolve.png)

- 盘旋机器人仍在基地上，说明系统执行的是“跳过额外打出牌库顶随从”，而不是粗暴结束整个 AI 回合。
- 右上角超时 toast 已经收起，页面上没有遗留错误条、按钮或遮罩。
- 房主仍停在 `对手 / 出牌阶段` 视角，但共享阻塞已解除，符合“只收口当前隐藏可选效果”的预期。

### 3. 8 秒强制结束回合触发前

![force-end-turn-before](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/在线-AI-连续-8-秒没有任何实际进展时，应自动强制结束当前回合/在线-AI-连续-8-秒没有任何实际进展时，应自动强制结束当前回合-online-ai-force-end-turn-before-timeout.png)

- 左上角显示 `回合3 / 对手 / 出牌阶段`，当前控制权仍在 AI。
- 基地上只有 AI 的 `影舞者`，而房主界面没有“牺牲随从抽牌”的提示框，说明交互仍然是 AI seat 私有、且房主处于被隐藏交互阻塞的状态。
- 画面上还没有强制结束回合 toast，说明此图记录的是 8 秒兜底触发前的真实卡住现场。

### 4. 8 秒强制结束回合完成后

![force-end-turn-after](../test-results/evidence-screenshots/smashup-phase-transition-simple.e2e/在线-AI-连续-8-秒没有任何实际进展时，应自动强制结束当前回合/在线-AI-连续-8-秒没有任何实际进展时，应自动强制结束当前回合-online-ai-force-end-turn-after-resolve.png)

- 左上角回合条已变成 `回合4 / 你自己 / 出牌阶段`，中央还出现“轮到你了！”便签，说明系统真的把当前回合交还给房主。
- 右上角 toast 标题为 `AI 强制结束回合`，正文明确写出“AI 连续 8 秒没有任何进展”，对应这次新增的自动兜底链路。
- 右侧已经出现人类玩家自己的大号 `结束回合` 主按钮和弃牌区，说明当前界面已经回到“我可以正常操作”的可交互状态，没有再被额外自动跳过或继续卡在 AI 隐藏交互里。
- 基地上的 `影舞者` 仍保留在场上，说明这次处理不是执行原本的 sacrifice 选择，而是取消卡住交互后安全收掉 AI 当前回合。

## 关键状态断言

### 4 秒自动跳过场景

- 处理前：
  - 共享过滤视角：`sys.interaction.current === null`、`sys.interaction.isBlocked === true`
  - 权威状态：AI 隐藏交互 `sourceId === 'robot_hoverbot'`
- 处理后：
  - 补丁状态：`rejectedCount > 0`、`delegatedCount === 1`、`forceSkipDelegated === true`
  - 权威状态：`sys.interaction.current === null`
  - 棋盘状态：基地仍有 `ai-hoverbot-on-base`，牌库顶仍是 `robot_zapbot`

### 8 秒强制结束回合场景

- 处理前：
  - 共享过滤视角：`sys.interaction.current === null`、`sys.interaction.isBlocked === true`、`currentPlayerIndex === 1`
  - 权威状态：AI 隐藏交互 `sourceId === 'wizard_sacrifice'`
- 处理后：
  - 补丁状态：`rejectedCount > 0`、`delegatedCount === 2`、`forceEndTurnDelegated === true`
  - 内部链路：第 1 次 delegated batch 只负责 `CANCEL/RESPOND/PASS` 解卡住；第 2 次 delegated batch 才在最新权威状态下单独发 `ADVANCE_PHASE`
  - 权威状态：`sys.interaction.current === null`
  - 棋盘状态：`currentPlayerIndex === 0`、基地仍保留 `ai-sacrifice-target`
  - 单测补充：`46 passed` 中新增覆盖“恢复确认返回的人类回合状态下，桥接层不会再生成 follow-up ADVANCE_PHASE”

## 结论

- 当前共享桥接层已经不再依赖“用户手动点强制跳过”。
- 对于可安全跳过的隐藏 AI 交互，系统会在 `4 秒` 后自动收口当前交互。
- 对于 `8 秒` 内完全没有真实进展的 AI，系统会自动强制结束当前回合，把控制权交还给人类玩家。
- 本轮回归确认：`8 秒` 兜底已不再把“解交互/Pass 窗口”和 `ADVANCE_PHASE` 绑成同一个 batch，因此没有复现“强制结束失败后无限重试”或“直接把我方回合也一起跳过”的问题位点。
