# SmashUp 线上反馈收口（6a2b4d788061c85a5fc8ba83）

## 范围

- 反馈 ID：`6a2b4d788061c85a5fc8ba83`
- 游戏：`smashup`
- 反馈原文：`选牌阶段，就是选2个种族的时候，直接进入游戏。没有手牌，有基地拍，我就选了一个种族就开了。`

## 真相源

- 生产真源：`ssh admin@8.148.71.102` -> `docker exec -i boardgame-mongodb mongosh --quiet boardgame` -> `boardgame.feedbacks`
- 回写前状态快照：`temp/feedback-closeout/query-feedback-6a2b4d78-before-writeback-20260612.raw.txt`
- 回写结果：`temp/feedback-closeout/update-feedback-status-20260612-6a2b4d78-to-resolved.raw.txt`
- 回写后状态快照：`temp/feedback-closeout/query-feedback-6a2b4d78-after-writeback-20260612.raw.txt`
- 回写后人类未收口列表：`temp/feedback-closeout/query-human-open-inprogress-after-20260612-6a2b4d78.raw.txt`

## 根因

- 这条反馈不是“真的只选了 1 个就完成选秀”的领域结算 bug。
- 真正失守的是选种族阶段的残缺运行时状态：
  - 如果 `factionSelect` 阶段丢了“选种族记录”（`factionSelection`），主棋盘 UI 会直接不走选种族页。
  - 同时自动推进逻辑也会把这类残缺状态继续往后推。
- 这正好解释了用户看到的症状：仍在选种族阶段，但已经掉进主棋盘；因为正式开局还没完成，所以没有起手牌；而基地本来就在选秀前预摆，所以用户会看到基地。

## 本轮修复

- `src/games/smashup/Board.tsx`
  - 只要当前阶段还是 `factionSelect`，就强制先走选种族页，不再额外依赖 `core.factionSelection` 是否存在。
- `src/games/smashup/ui/normalizeRuntimeState.ts`
  - 若运行时仍处于 `factionSelect`，但“选种族记录”缺失，自动重建空的选种族状态。
  - 例外：如果所有玩家都已具备双派系和起手牌，说明只是“选秀已完成、等待继续”的中间态，不重建。
- `src/games/smashup/domain/index.ts`
  - `factionSelect` 阶段只有在“选秀其实已经完成”的中间态才允许自动推进。
  - 对于“选种族记录缺失但并未完成选秀”的残缺状态，停止自动推进。
- `src/games/smashup/__tests__/factionSelection.test.ts`
  - 新增：`选种族记录缺失时会重建空选种族状态，并阻止自动推进到开局`

## 本地验证

- 验证命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts src/games/smashup/__tests__/factionSelection.test.ts --configLoader native`
- 结果：
  - `2` 个测试文件通过
  - `131` 条测试通过

## 生产反馈状态

### 1. 回写前

- 生产 `feedbacks` 真源中，这条反馈在回写前仍是 `status: open`。

### 2. 回写执行

- 目标状态：`resolved`
- 真实回写结果：
  - `matchedCount=1`
  - `modifiedCount=1`
  - `updatedAt=2026-06-12T13:30:00.000Z`

### 3. 回写后

- 生产 `boardgame.feedbacks` 中该条反馈已变为 `status: resolved`。
- 回写后生产人工 `feedback-modal` 的 `open/in_progress` 列表为空，`count=0`。

## 收口结论

- `6a2b4d788061c85a5fc8ba83`：`resolved`
- 当前含义：
  - 反馈根因已定位
  - 本地代码已补定向修复与回归测试
  - 生产反馈状态已正式回写
- 当前边界：
  - 本轮没有提交、推送或部署证据，不能把这条结论表述成“生产代码已上线”
