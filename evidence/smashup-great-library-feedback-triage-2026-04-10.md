# SmashUp 大图书馆基地效果“执行命令异常”反馈分诊

## 反馈
- 反馈 ID：`69d71fc0932fe508b2420ca9`
- 标题：执行大图书馆基地效果执行命令异常

## 我实际核对到的状态
- 诊断包：`temp/feedback-closeout/2026-04-09T16-03-47-321Z/69d71fc0932fe508b2420ca9.md`
- 快照里当前阶段是 `scoreBases`，当前玩家是 `1`（AI）。
- 人类视角快照里：
  - `sys.interaction.current === undefined`
  - `sys.interaction.isBlocked === true`
  - `core.triggerQueue` 里同时挂着两个 `afterScoring` 触发：
    1. `afterScoring:base_great_library:0:0`
    2. `afterScoring:alien_scout:0:0`

这说明人类客户端看到的是“被 AI 私有隐藏交互阻塞”，不是“大图书馆本身没有触发”。

## 根因判断
- 这是 **在线 AI 隐藏交互卡住** 的同根因问题，不是 `base_great_library` 规则实现错误。
- 大图书馆 afterScoring 会与同时触发的其他 afterScoring（本例里还有 `alien_scout`）一起进入 reaction queue。
- 当轮到 AI 处理这类隐藏交互、但房主视角拿不到可见 prompt 时，共享状态会表现成：
  - `current` 不可见
  - `isBlocked === true`
- 这和本轮已经修过的在线 AI 超时恢复问题完全一致。

## 现有修复证据
- `evidence/smashup-online-ai-timeout-recovery-e2e-test.md`
  - 已覆盖“AI 隐藏交互卡住 → 4 秒自动跳过 / 8 秒强制收口”的真实联机链路。
- `src/pages/__tests__/matchSeatValidation.test.ts`
  - 用例：`隐藏交互卡住 8 秒后，应先单独收口交互，等待确认后再决定是否推进阶段`

## 本轮补充验证
- `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native -t "隐藏交互卡住 8 秒后，应先单独收口交互，等待确认后再决定是否推进阶段"`

## 结论
- 该反馈属于 **已修复的在线 AI 隐藏交互收口问题**。
- 大图书馆效果本身不是缺实现；阻塞点是 AI seat 的隐藏 afterScoring 交互当时没被及时收口。
