# SmashUp 人类 open 反馈复核补充收口（2026-06-06）

## 范围

- 目标反馈：
  - `6a223f957d14bb74e8214da8`：`基地爆破有bug，我同时爆破俩基地但是只爆了一个`
  - `6a2301b65ea63084e89bc735`：`海盗那个除冠军外移动的基地，我第二名好像没有结算效果，没有移动`
  - `6a2305bd5ea63084e89bc74a`：`大副移动完也进弃牌堆了`
- 游戏：`smashup`
- 来源：生产 `boardgame.feedbacks`

## 结论口径

- 这 3 条本轮不按 `resolved` 收口。
- 原因不是“没处理”，而是**当前 worktree 已恢复，且本轮没有新增对位领域修复需要归因到这 3 条反馈本体**。
- 因此线上状态应回写为 `closed`，关闭理由使用“当前树已恢复，当前版本按反馈链路未复现同症状”。

## 证据

### 1. 双基地同时爆破只结算一个

- 反馈：`6a223f957d14bb74e8214da8`
- 本地回放/验证：
  - `e2e/smashup/smashup-complex-multi-base-scoring.e2e.ts`
  - 命令：
    - `node .\node_modules\playwright\cli.js test --reporter=line`
    - 环境：
      - `PW_RUNTIME_SCOPE=manual-smashup-feedback`
      - `PW_PORT=6274`
      - `PW_GAME_SERVER_PORT=20101`
      - `PW_API_SERVER_PORT=21101`
      - `PW_TEST_MATCH=e2e/smashup/smashup-complex-multi-base-scoring.e2e.ts`
- 结果：
  - 通过
- 本轮判断：
  - 当前树下，多基地结算链路可正常完成，不再符合“当前活 bug”形状。

### 2. 海盗“除冠军外移动”链第二名未移动

- 反馈：`6a2301b65ea63084e89bc735`
- 本地回放/验证：
  - `e2e/smashup/smashup-ritual-site-first-mate.e2e.ts`
  - `e2e/smashup/smashup-first-mate-4p-afterscoring-order.e2e.ts`
  - 命令：
    - `node .\node_modules\playwright\cli.js test --reporter=line`
    - 环境同上，目标用例分别切到上述 2 个文件
- 结果：
  - 2 个相关 E2E 均通过
- 本轮判断：
  - 当前树下，afterScoring 触发与第二名移动链可正常继续，不再符合“第二名没有结算效果”的当前活 bug 形状。

### 3. 大副移动后也进弃牌堆

- 反馈：`6a2305bd5ea63084e89bc74a`
- 本地回放/验证：
  - `e2e/smashup/smashup-ritual-site-first-mate.e2e.ts`
  - `e2e/smashup/smashup-first-mate-4p-afterscoring-order.e2e.ts`
- 结果：
  - 相关 E2E 通过
- 本轮判断：
  - 当前树下，大副移动后的存活/去向符合当前交互合同，未再复现“移动完进弃牌堆”。

## 为什么是 closed，不是 resolved

- `resolved` 适用于：确认这条反馈对应的 bug 本轮已定位、已修复、并能把修复直接归因到这条反馈。
- 这 3 条当前更准确的口径是：
  - 线上仍是 `open`
  - 当前 worktree 用反馈相关链路已无法复现
  - 本轮主要工作是补足本地回放证据与交互合同校准，不是新增一个明确可归因到这 3 条的领域修复提交
- 因此应按“当前树已恢复 / 当前版本未复现同症状”归档为 `closed`。

## 线上回写目标

- `6a223f957d14bb74e8214da8 -> closed`
- `6a2301b65ea63084e89bc735 -> closed`
- `6a2305bd5ea63084e89bc74a -> closed`

## 关闭理由建议

- `当前树已恢复：按反馈链路本地回放，当前版本未复现同症状，归档关闭。`
