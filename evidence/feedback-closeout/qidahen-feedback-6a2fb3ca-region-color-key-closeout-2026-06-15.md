# 七大恨线上反馈收口（6a2fb3cac1f9d45aea62b84e）

## 范围

- 反馈 ID：`6a2fb3cac1f9d45aea62b84e`
- 游戏：`qidahen`
- 反馈原文：`[auto][window.error] qidahenRegionColorKey is not defined`

## 真相源

- 生产真源：
  - `ssh admin@8.148.71.102` -> `docker exec -i boardgame-mongodb mongosh --quiet boardgame` -> `boardgame.feedbacks`
- 回写前状态快照：
  - `temp/feedback-closeout/query-feedback-6a2fb3ca-before-writeback-20260615.raw.txt`
- 回写结果：
  - `temp/feedback-closeout/update-feedback-status-20260615-6a2fb3ca-to-resolved.raw.txt`
- 回写后状态快照：
  - `temp/feedback-closeout/query-feedback-6a2fb3ca-after-writeback-20260615.raw.txt`

## 反馈真相

- 生产真源直接命中前端崩溃：
  - 报错：`qidahenRegionColorKey is not defined`
  - 页面：`/play/qidahen/match/PuChyjd5ZYc?playerID=0`
  - 用户最后动作：点击 `确认投票`
- 这说明问题不是“误报”或“旧快照解释偏差”，而是七大恨在真实线上页面里，确认投票后访问了一个未导入符号，前端直接抛 `ReferenceError`。

## 本轮修复

- `src/games/qidahen/Board.tsx`
  - 补回缺失导入：
    - `QIDAHEN_REGION_ID_BY_MASK_COLOR`
    - `qidahenRegionColorKey`
- `src/games/qidahen/__tests__/Board.test.ts`
  - 增加结构门禁，防止再次漏掉上述两个符号。

## 本地验证

- 定向测试：
  - `npx vitest run src/games/qidahen/__tests__/Board.test.ts`
- 结果：
  - `171 passed`

## 生产反馈状态

### 1. 回写前

- 生产 `feedbacks` 真源中该条反馈为 `status: open`。

### 2. 回写执行

- 目标状态：`resolved`
- 真源回写结果：
  - `matchedCount=1`
  - `modifiedCount=1`
  - `updatedAt=2026-06-15T13:05:00.000Z`

### 3. 回写后

- 生产 `boardgame.feedbacks` 中该条反馈已变为 `status: resolved`。

## 收口结论

- `6a2fb3cac1f9d45aea62b84e`：`resolved`
- 理由：
  - 这条反馈命中的是当前代码里的真实前端崩溃，不是误报或已失效噪音。
  - 当前已经具备 `生产真源命中 + 代码修复 + 定向测试通过 + 真源回写`。
  - 这类真实 bug 即使当前仓库已修，也不应写成 `closed`；`closed` 只适合非 bug、重复、误报或无效反馈。
- 当前边界：
  - 本轮没有部署证据，不能把结论表述成“生产代码已上线验证通过”。
