# SmashUp 线上反馈收口（6a2d478f8b110d6694bb8deb）

## 范围

- 反馈 ID：`6a2d478f8b110d6694bb8deb`
- 游戏：`smashup`
- 反馈原文：`葫芦娃牌组六娃发动能力后战力不会在我的下个回合回复，并且会被毛茸茸女王控制`

## 结论

- 本轮结论：`closed`
- 关闭理由：
  - 生产反馈快照里，`六娃（huluwawa_liu_wa）` 仍带有 `powerModifier: -4`，但同一份快照已经没有任何 `timedPowerModifiers` 待回退记录。
  - 这说明反馈命中的是真实旧现场状态形状，不是“当前规则本来就允许六娃永久少 4 点力量”。
  - 当前代码与定向测试已经覆盖两点：
    - 六娃发动后会在下个己方回合开始恢复力量。
    - 六娃发动后不会成为 `毛茸茸女王（kitty_cats_queen_fluffy）` 的控制目标。
  - 因此这条反馈不属于“当前版本仍存在的规则缺口”，应按“当前版本复核无现存问题”归档关闭，而不是继续挂成 open。

## 是否需要更新规范

- 不需要。
- 原因：
  - 现有规范已经明确区分：
    - 当前代码仍有问题、且本轮新增修复时，用 `resolved`
    - 当前版本复核无现存缺口、反馈属于旧态/旧现场/当前已覆盖时，用 `closed`
  - 这条反馈属于后者，不是本轮新增线上修复，而是复核确认当前版本已覆盖。

## 真相源

- 生产真源：
  - `ssh admin@8.148.71.102` -> `docker exec -i boardgame-mongodb mongosh --quiet boardgame` -> `boardgame.feedbacks`
- 回写前状态快照：
  - `temp/feedback-closeout/query-feedback-6a2d478f-before-writeback-20260615.raw.txt`
- 回写结果摘要：
  - `temp/feedback-closeout/update-feedback-status-20260615-6a2d478f-to-closed.raw.txt`
- 回写后状态快照：
  - `temp/feedback-closeout/query-feedback-6a2d478f-after-writeback-20260615.raw.txt`
- 回写后人工 open/in_progress 列表：
  - `temp/feedback-closeout/query-human-open-inprogress-after-20260615-6a2d478f.raw.txt`

## 本地规则证据

- 六娃逻辑位置：
  - `src/games/smashup/abilities/huluwawa.ts`
- 现有定向测试：
  - `src/games/smashup/__tests__/abilities/huluwawa.test.ts`
    - `六娃计分前取消天赋会移除待回退记录并恢复力量修正`
    - `六娃发动天赋后不应成为毛茸茸女王的控制目标`
    - `六娃发动天赋后到自己下个回合开始会恢复力量`

## 本地验证

- 验证命令：
  - `pnpm vitest run src/games/smashup/__tests__/abilities/huluwawa.test.ts --testNamePattern "六娃|毛茸茸女王|liu_wa|queen_fluffy"`
- 结果：
  - `3` 条目标测试通过

## 生产反馈状态

### 1. 回写前

- 生产 `feedbacks` 真源中该条反馈为 `status: open`。
- 同一份生产快照里：
  - 六娃位于 `七彩莲蓬（base_seven_colored_lotus）`
  - `powerModifier = -4`
  - `currentPlayerIndex = 1`
  - `turnNumber = 4`
  - `timedPowerModifiers` 已不存在

### 2. 回写执行

- 目标状态：`closed`
- 关闭理由写入：
  - `生产反馈快照显示：六娃当时仍带有 -4 力量修正，但已不存在任何 timedPowerModifiers 待回退记录；这属于旧现场状态形状。当前代码与定向测试已覆盖两点：六娃会在下个己方回合开始恢复力量，且发动后不会成为毛茸茸女王的控制目标；按当前版本复核未见现存规则缺口，归档关闭。`
- 真源回写结果：
  - `matchedCount=1`
  - `modifiedCount=1`
  - `updatedAt=2026-06-15T02:24:00.000Z`

### 3. 回写后

- 生产 `boardgame.feedbacks` 中该条反馈已变为 `status: closed`。
- 回写后人工 `feedback-modal` 的 `open/in_progress` 计数为 `5`。

## 收口边界

- 本轮没有新增业务修复代码。
- 这条收口不是“某个新补丁已上线”，而是“生产快照命中旧状态形状，而当前树规则与定向测试已证明这不是现存规则缺口”。
