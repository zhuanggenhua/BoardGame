# SmashUp 线上反馈收口（6a2c9661717d92971c9e3b53）

## 范围

- 反馈 ID：`6a2c9661717d92971c9e3b53`
- 游戏：`smashup`
- 反馈原文：`间谍的效果发动后完成的按钮不在屏幕里`

## 结论

- 本轮结论：`closed`
- 关闭理由：
  - 生产反馈快照显示，这条问题命中的是 Android 横屏 `768x360` 下的 `间谍（super_spies_spy）` 牌库顶重排交互。
  - 当前代码已经对 `super_spies_spy_reorder` 面板加上纵向滚动上限与 `overflow-y-auto`，目的就是防“确认/完成按钮掉出屏幕”。
  - 仓库里已有定向回归测试，且本轮复跑通过，说明当前版本对这类移动横屏露出问题已经有覆盖。
  - 因此这条反馈不属于“当前版本仍存在的现存问题”，应按“当前版本复核无现存缺口”归档关闭。

## 是否需要更新规范

- 不需要。
- 原因：
  - 现有规范已经允许对“当前版本复核无问题、旧态已被后续实现覆盖”的反馈走 `closed`
  - 这条不需要再为它额外发明新规则

## 真相源

- 生产真源：
  - `ssh admin@8.148.71.102` -> `docker exec -i boardgame-mongodb mongosh --quiet boardgame` -> `boardgame.feedbacks`
- 回写前状态快照：
  - `temp/feedback-closeout/query-feedback-6a2c9661-before-writeback-20260615.raw.txt`
- 回写结果摘要：
  - `temp/feedback-closeout/update-feedback-status-20260615-6a2c9661-to-closed.raw.txt`
- 回写后状态快照：
  - `temp/feedback-closeout/query-feedback-6a2c9661-after-writeback-20260615.raw.txt`

## 现场证据

- 反馈客户端现场：
  - 路由：`/play/smashup/match/5Js9pF4fSo6?playerID=0`
  - 平台：`android`
  - 视口：`768 x 360`
  - 最近操作日志：
    - `随从登场：间谍 → 神秘花园`
    - `展示牌库顶（3张）：思维探测器、放射性吐息、额外打出两个法术（原因：间谍）`
- 说明这条反馈的真实对象是 `间谍` 触发后的牌库顶重排/确认面板，不是主页、不是建房、也不是别的交互壳层。

## 本地规则证据

- 面板实现位置：
  - `src/games/smashup/ui/PromptOverlay.tsx`
    - `DECK_REORDER_SOURCE_IDS` 已包含 `super_spies_spy_reorder`
    - 重排面板启用纵向滚动上限与滚动容器
- 棋盘入口说明：
  - `src/games/smashup/Board.tsx`
    - 非卡牌“完成/跳过”选项已统一走浮动操作或 Overlay 面板链路
- 现有定向测试：
  - `src/games/smashup/__tests__/PromptOverlay.interactions.test.tsx`
    - `间谍牌库重排面板启用纵向滚动上限，避免确认按钮掉出屏幕`

## 本地验证

- 验证命令：
  - `pnpm vitest run src/games/smashup/__tests__/PromptOverlay.interactions.test.tsx --testNamePattern "间谍牌库重排面板启用纵向滚动上限，避免确认按钮掉出屏幕"`
- 结果：
  - `1` 条目标测试通过

## 生产反馈状态

### 1. 回写前

- 生产 `feedbacks` 真源中该条反馈仍为 `status: open`。

### 2. 回写执行

- 目标状态：`closed`
- 关闭理由写入：
  - `生产反馈快照显示这是 Android 横屏 768x360 下的间谍牌库重排交互。当前代码已对 super_spies_spy_reorder 面板加上纵向滚动上限与 overflow-y-auto，并有定向回归测试覆盖“确认按钮不掉出屏幕”；按当前版本复核未见现存规则缺口，归档关闭。`
- 真源回写结果：
  - `matchedCount=1`
  - `modifiedCount=1`
  - `updatedAt=2026-06-15T03:00:00.000Z`

### 3. 回写后

- 生产 `boardgame.feedbacks` 中该条反馈已变为 `status: closed`。
- 回写后人工 `feedback-modal` 的 `open/in_progress` 计数为 `0`。

## 收口边界

- 本轮没有新增业务修复代码。
- 这条收口不是“本轮新修一个 UI bug”，而是“当前树已有该问题的定向防回归实现与测试，复核后确认无现存缺口”。
