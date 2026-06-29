# SmashUp 线上反馈收口（6a2e36eed789d530ed325519）

## 范围

- 反馈 ID：`6a2e36eed789d530ed325519`
- 游戏：`smashup`
- 反馈原文：`看不到卡`

## 真相源

- 生产真源：`ssh admin@8.148.71.102` -> `docker exec boardgame-mongodb mongosh --quiet boardgame` -> `boardgame.feedbacks`
- 回写前状态快照：`temp/feedback-closeout/query-feedback-6a2e36-before-writeback-20260615.raw.txt`
- 回写结果：`temp/feedback-closeout/update-feedback-status-20260615-6a2e36-to-resolved.raw.txt`
- 回写后状态快照：`temp/feedback-closeout/query-feedback-6a2e36-after-writeback-20260615.raw.txt`
- 回写后人工 open/in_progress 列表：`temp/feedback-closeout/query-human-open-inprogress-after-20260615-6a2e36.raw.txt`

## 根因

- 这条反馈不是“手牌数据没了”，而是页面进入时把历史展示事件当成了当前展示事件重播。
- 具体遮挡来源有两类：
  - 行动卡特写队列
  - 牌库顶展示浮层
- 反馈快照里残留了更早时间戳的 `su:reveal_deck_top` 历史事件；旧实现没有按“当前页面会话时间”过滤，导致一进页面就把牌桌和手牌盖住，用户看到的现实表现就是“看不到卡”。

## 本轮修复

- `src/components/game/framework/hooks/useCardSpotlightQueue.ts`
  - 新增 `ignoreEventsBefore`，过滤早于当前页面会话的旧特写事件。
- `src/games/smashup/ui/RevealOverlay.tsx`
  - 新增 `ignoreEventsBefore`，过滤早于当前页面会话的旧展示事件。
- `src/games/smashup/Board.tsx`
  - 进入页面时记录 `visualEventFloor`
  - 传给特写队列和展示浮层
  - 有行动卡特写时，不再同时渲染展示浮层，避免双层遮挡。
- 回归测试：
  - `src/components/game/framework/hooks/__tests__/useCardSpotlightQueue.test.ts`
  - `src/games/smashup/__tests__/revealSystem.test.ts`

## 本地验证

- 定向测试：
  - `node scripts/infra/vitest-cli-safe.mjs run src/components/game/framework/hooks/__tests__/useCardSpotlightQueue.test.ts src/games/smashup/__tests__/revealSystem.test.ts --configLoader native`
  - 结果：`2` 个文件、`15` 条测试通过
- 定向 ESLint：
  - `npx eslint src/games/smashup/__tests__/revealSystem.test.ts`
  - 结果：`0 error / 2 warning`
- 本地快照注入回放：
  - 路由：`http://127.0.0.1:6278/play/smashup/local?seed=feedback-6a2e36&players=2&playerID=1`
  - 文字证据：`temp/feedback-6a2e36/11-after-6278-longwait-metrics.json`
  - 截图证据：`temp/feedback-6a2e36/12-修复后-6278-长等待-932x347.png`
- 验证结论：
  - 页面可见手牌与牌桌
  - 没再自动弹出“牌库顶展示”“展示待查看”遮挡层

## 生产反馈状态

### 1. 回写前

- 生产 `feedbacks` 真源中该条反馈仍为 `status: open`。

### 2. 回写执行

- 目标状态：`resolved`
- 真实回写结果：
  - `matchedCount=1`
  - `modifiedCount=1`
  - `updatedAt=2026-06-15T01:27:10.217Z`

### 3. 回写后

- 生产 `boardgame.feedbacks` 中该条反馈已变为 `status: resolved`。

## 收口结论

- `6a2e36eed789d530ed325519`：`resolved`
- 理由：
  - 这是确认为真的业务 bug，不是误报、重复或已失效，所以不应写成 `closed`
  - 当前已经具备 `根因定位 + 修复落地 + 定向测试 + 本地快照回放 + 真源回写`
- 当前边界：
  - 本轮没有部署证据，不能把该结论表述成“线上代码已上线”
