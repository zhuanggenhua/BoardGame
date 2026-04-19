# Smash Up 反馈修复：duplicated-minion-copy（2026-04-14）

## 反馈信息
- 反馈 ID：`69db210f09efdb7249bd5385`
- conflictKey：`smashup::duplicated-minion-copy`
- 标题：`这个基地跟那个战术一起用的时候似乎每次触发效果都会复制出来一张随从`
- 反馈包：`D:\gongzuo\webgame\BoardGame\temp\feedback-closeout\2026-04-13T16-09-31-728Z\69db210f09efdb7249bd5385.md`
- 截图：`D:\gongzuo\webgame\BoardGame\temp\feedback-closeout\2026-04-13T16-09-31-728Z\images\69db210f09efdb7249bd5385-01.jpg`

## 现场证据
- 实际查看反馈包与截图后，玩家手牌里出现了**同 uid 的重复随从**：`c5` 重复、`c6` 重复。
- ActionLog 只看到正常的“拉莱耶 + 逃生舱回手”链路，没有看到规则上应当合法生成第二张同 uid 随从的依据。
- 这说明问题不是“多生成了合法新卡”，而是**同一张卡被重复落到手牌**，表现成“复制出一张随从”。

## 根因
- `src/games/smashup/domain/reduce.ts` 的 `SU_EVENTS.MINION_RETURNED` 分支此前会无条件把返回随从 append 到 `owner.hand`。
- 当 `base_rlyeh` 的消灭被 `steampunk_escape_hatch(_pod)` 替换成 `MINION_RETURNED` 后，只要这条 return 因重复处理/重复落地再次归约一次，就会把同 uid 再塞进手牌，造成状态污染。
- 同样的重复 `MINION_RETURNED` 在本地可直接复现为：同一 uid 被加入手牌两次。

## 修复
### 代码
- `src/games/smashup/domain/reduce.ts`
  - `MINION_RETURNED` 现在要求源基地与目标随从真实存在；不存在时直接 no-op，避免 stale event 凭空造卡。
  - 若目标玩家手牌里已存在同 uid，则不再重复 append，保证回手归约幂等。

### 测试
- `src/games/smashup/__tests__/architecture-duplicate-processing.test.ts`
  - 新增回归：重复 `MINION_RETURNED` 事件不会把同一 uid 随从复制进手牌。

## 验证
### 自动验证
1. `npx vitest run src/games/smashup/__tests__/architecture-duplicate-processing.test.ts`
   - 结果：通过（4 tests passed）
2. `npx vitest run src/games/smashup/__tests__/expansionOngoing.test.ts -t "steampunk_escape_hatch"`
   - 结果：通过（2 tests passed）
3. `npx eslint src/games/smashup/domain/reduce.ts src/games/smashup/__tests__/architecture-duplicate-processing.test.ts`
   - 结果：0 errors，warnings 为文件既有 `any` 警告

## 结论
- 该反馈判定为**真实 bug**。
- 本地已修复并通过针对性回归验证。
- 下一步：更新 `temp/feedback-closeout/status-board.json` 为 `resolved`，并回写生产 Mongo。
