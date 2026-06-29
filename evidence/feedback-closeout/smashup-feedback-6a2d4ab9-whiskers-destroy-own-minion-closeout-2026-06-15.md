# SmashUp 线上反馈收口（6a2d4ab98b110d6694bb8dfd）

## 范围

- 反馈 ID：`6a2d4ab98b110d6694bb8dfd`
- 游戏：`smashup`
- 反馈原文：`猫咪卡组威斯克的效果是消灭一个自己的随从不是给自己一个随从战力加一`

## 真相源

- 生产真源：
  - `ssh admin@8.148.71.102` -> `docker exec -i boardgame-mongodb mongosh --quiet boardgame` -> `boardgame.feedbacks`
- 反馈快照包：
  - `temp/feedback-6a2d4ab9-record.json`
- 回写前状态快照：
  - `temp/feedback-closeout/query-feedback-6a2d4ab9-before-writeback-20260615.raw.txt`
- 回写结果：
  - `temp/feedback-closeout/update-feedback-status-20260615-6a2d4ab9-to-resolved.raw.txt`
- 回写后状态快照：
  - `temp/feedback-closeout/query-feedback-6a2d4ab9-after-writeback-20260615.raw.txt`
- 回写后人工 open/in_progress 列表：
  - `temp/feedback-closeout/query-human-open-inprogress-after-20260615-6a2d4ab9.raw.txt`

## 反馈真相

- 生产反馈快照里，`威斯克（kitty_cats_whiskers）` 发动后，并没有消灭己方随从。
- 现场结果反而是：
  - `顽强丧尸（zombie_tenacious_z）` 留在 `诡猫巷（base_cat_fanciers_alley）`
  - 该随从带有 `tempPowerModifier: 1`
  - `威斯克（kitty_cats_whiskers）` 自己仍留在 `Q Point（base_q_point）`
- 这与用户描述一致，说明这条反馈是**真实业务 bug**，不是旧态误报。

## 本轮修复

- `src/games/smashup/abilities/kitty_cats.ts`
  - 把“消灭己方随从”的交互处理抽成 `handleDestroyOwnMinion`
  - 为 `威斯克（kitty_cats_whiskers）` 单独注册 `handleWhiskersDestroy`
  - 明确发出真实的随从销毁事件，而不是沿用错误处理
  - `九条命（kitty_cats_nine_lives）` 单独走 `handleNineLivesDestroy`，保留其额外行动逻辑
- `src/games/smashup/__tests__/abilities/kitty-cats.test.ts`
  - 补强 `kitty_cats_whiskers` 的断言：
    - 目标己方随从会被真正消灭
    - 事件里会带上 `sourceDefId: kitty_cats_whiskers`
    - 额外行动额度保持正确

## 本地验证

- 验证命令：
  - `pnpm vitest run src/games/smashup/__tests__/abilities/kitty-cats.test.ts --testNamePattern "kitty_cats_whiskers|kitty_cats_nine_lives"`
- 结果：
  - `2` 条目标测试通过

## 生产反馈状态

### 1. 回写前

- 生产 `feedbacks` 真源中该条反馈仍为 `status: open`。

### 2. 回写执行

- 目标状态：`resolved`
- 真源回写结果：
  - `matchedCount=1`
  - `modifiedCount=1`
  - `updatedAt=2026-06-15T02:37:00.000Z`

### 3. 回写后

- 生产 `boardgame.feedbacks` 中该条反馈已变为 `status: resolved`。
- 回写后人工 `feedback-modal` 的 `open/in_progress` 计数为 `4`。

## 收口结论

- `6a2d4ab98b110d6694bb8dfd`：`resolved`
- 理由：
  - 这条反馈命中的是当前代码的真实业务问题，不是误报或旧态，所以不应写成 `closed`
  - 当前已经具备 `反馈快照命中 + 本地修复落地 + 定向测试通过 + 真源回写`
- 当前边界：
  - 本轮没有部署证据，不能把该结论表述成“线上代码已上线”
