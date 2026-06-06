# SmashUp 人类 open 反馈复核补充收口（2026-06-06）

## 范围

- 目标反馈：
  - `6a223f957d14bb74e8214da8`：`基地爆破有bug，我同时爆破俩基地但是只爆了一个`
  - `6a2301b65ea63084e89bc735`：`海盗那个除冠军外移动的基地，我第二名好像没有结算效果，没有移动`
  - `6a2305bd5ea63084e89bc74a`：`大副移动完也进弃牌堆了`
- 游戏：`smashup`
- 来源：生产 `boardgame.feedbacks`

## 结论口径

- 这 3 条本轮都**不按 `resolved` 收口**。
- 其中需要分开处理：
  - `6a223f957d14bb74e8214da8`：
    - 当前反馈包只保留了 `藏骨堂` 已结算后的事后态，**前提未锁定**。
    - 本轮不能把它直接写成“当前树已恢复，可归档关闭”。
  - `6a2301b65ea63084e89bc735`
  - `6a2305bd5ea63084e89bc74a`
    - 这 2 条《大副》反馈，当前 worktree 已有对位交互合同，且本轮本地复跑通过。
    - 若后续用户明确要求做反馈状态回写，这 2 条可按 `closed` 归档，关闭理由使用“当前树已恢复，当前版本按反馈链路未复现同症状”。

## 证据

### 1. 双基地同时爆破只结算一个

- 反馈：`6a223f957d14bb74e8214da8`
- 本轮 authoritative 真相源：
  - `temp/feedback-6a223f957d14bb74e8214da8.raw.json`
  - `evidence/feedback-closeout/smashup-feedback-6a223f95-insufficient-repro-closeout-2026-06-06.md`
- 本轮判断：
  - 当前包只有 `藏骨堂` 已结算后的事后态。
  - 无法唯一锁定“同时爆俩基地”里的第二个基地是谁。
  - 因此前提未锁定，本轮**不能**把这条直接归档为 `closed`。

### 2. 海盗“除冠军外移动”链第二名未移动

- 反馈：`6a2301b65ea63084e89bc735`
- 本地回放/验证：
  - `e2e/smashup/smashup-ritual-site-first-mate.e2e.ts`
  - `e2e/smashup/smashup-first-mate-4p-afterscoring-order.e2e.ts`
  - `src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts`
  - `src/games/smashup/__tests__/afterScoring-rescoring.test.ts`
  - 命令：
    - `node .\node_modules\playwright\cli.js test --reporter=line`
    - 环境同上，目标用例分别切到上述 2 个文件
    - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/pirates-ongoing.test.ts --configLoader native -t "pirate_first_mate afterScoring|已取得触发资格后，即使先被其他 afterScoring 效果移走，仍可继续结算自己的移动"`
    - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/afterScoring-rescoring.test.ts --configLoader native -t "afterScoring 把随从移到新基地后若使其达标，应继续把新基地纳入本轮计分"`
- 结果：
  - 2 个相关 E2E 均通过
  - 2 个相关 Vitest 定向用例通过
- 本轮判断：
  - 当前树下，afterScoring 触发与第二名移动链可正常继续，不再符合“第二名没有结算效果”的当前活 bug 形状。

### 3. 大副移动后也进弃牌堆

- 反馈：`6a2305bd5ea63084e89bc74a`
- 本地回放/验证：
  - `e2e/smashup/smashup-ritual-site-first-mate.e2e.ts`
  - `e2e/smashup/smashup-first-mate-4p-afterscoring-order.e2e.ts`
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
- 结果：
  - 相关 E2E 通过
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts --configLoader native -t "大副先结算移动后，海怪克拉肯仍应保留替换基地进场交互"` 通过
- 本轮判断：
  - 当前树下，大副移动后的存活/去向符合当前交互合同，未再复现“移动完进弃牌堆”。

## 为什么是 closed，不是 resolved

- `resolved` 适用于：确认这条反馈对应的 bug 本轮已定位、已修复、并能把修复直接归因到这条反馈。
- `6a2301... / 6a2305...` 当前更准确的口径是：
  - 线上仍是 `open`
  - 当前 worktree 用反馈相关链路已无法复现
  - 本轮主要工作是补足本地回放证据与交互合同校准，不是新增一个明确可归因到这 2 条的领域修复提交
- 因此这 2 条应按“当前树已恢复 / 当前版本未复现同症状”归档为 `closed`。
- `6a223...` 不属于这类场景：
  - 当前缺的是原始前态证据，不是“本地已确认恢复”的结论。
  - 因此前提未锁定前，不应在本文件里把它纳入 `closed` 候选。

## 线上回写目标

- `6a2301b65ea63084e89bc735 -> closed`
- `6a2305bd5ea63084e89bc74a -> closed`

## 关闭理由建议

- `当前树已恢复：按反馈链路本地回放，当前版本未复现同症状，归档关闭。`

## 备注

- `6a223f957d14bb74e8214da8` 的当前 authoritative 结论，以上述单独文档为准：
  - `evidence/feedback-closeout/smashup-feedback-6a223f95-insufficient-repro-closeout-2026-06-06.md`
