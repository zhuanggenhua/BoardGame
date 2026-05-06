# SmashUp 最后两条人工反馈状态回写与清零复核（2026-05-06）

## 范围

- 时间：`2026-05-06 08:04-08:10 +08`
- 目标反馈：
  - `69fa23e04590ce09779a7c52`：`“嗯？”可以重复使用。`
  - `69fa0bd74590ce09779a7bd6`：`使用尸体商店消灭随从，然后用蚂蚁防止消灭，不会获得标记`
- 来源口径：生产 `feedbacks` 真源，继续沿用 `人类反馈 > 系统自动反馈`

## 正式写入口

- 本轮继续使用生产 Mongo 直连，不走 HTTP：
  - `ssh admin@8.148.71.102`
  - `docker exec -i boardgame-mongodb mongosh --quiet boardgame`
- 原因：
  - 当前任务要求的是正式状态回写；
  - 既有 HTTP 路径此前已核到 `404`，不能充当真实写入口。

## 回写前核对

- 快照：`temp/feedback-closeout/query-feedback-69fa23e0-69fa0bd7-before-writeback-20260506.raw.txt`
- 我实际核对到的结果：
  - 2 条都存在于生产 `feedbacks`
  - 2 条回写前都是 `status: open`
  - 2 条都是 `reporterType=user`、`source=feedback-modal`、`gameId=smashup`

## 判定口径

### 1. `69fa23e04590ce09779a7c52`

- 判定：`resolved`
- 原因：
  - 这是已修未回写，不是新 bug。
  - `world_champs_eh` 的弃牌堆额外行动入口与同回合一次性限制已在当前仓库修好。
  - fresh 证据已覆盖单测与真实入口 E2E。
- 本轮实际核对过的关键截图：
  - `D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-robot-hoverbot-new.e2e/嗯？应在打出第一个行动后从弃牌堆作为额外行动发动并回到手牌/eh-discard-panel-available.png`
  - `D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-robot-hoverbot-new.e2e/嗯？应在打出第一个行动后从弃牌堆作为额外行动发动并回到手牌/eh-minion-prompt-visible.png`
  - `D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-robot-hoverbot-new.e2e/嗯？应在打出第一个行动后从弃牌堆作为额外行动发动并回到手牌/eh-resolved-returned-to-hand.png`
- 我实际看到什么：
  - 弃牌堆里的 `“嗯？”` 在额外行动窗口中可见；
  - 触发后出现真实的随从选择提示，不是空操作；
  - 收口后该牌回到手牌，没有继续卡在弃牌堆或出现重复发动残留。
- 是否达到验收标准：
  - 达到。可以按“已修未回写”处理并回写 `resolved`。

### 2. `69fa0bd74590ce09779a7bd6`

- 判定：`closed`
- 原因：
  - 这条不是实现 bug，而是规则理解偏差。
  - `尸体商店 + 雄蜂` 场景下，“防止被消灭”并不等于“已经被消灭”，因此不会触发靠“消灭”获得标记的语义。
- 我实际看到什么：
  - 这条在本轮生产回写前仍是 `open`；
  - 回写口径不是“修复代码”，而是“按非 bug 关闭”。
- 是否达到验收标准：
  - 达到。应回写 `closed`，而不是 `resolved`。

## 回写执行

- 回显：`temp/feedback-closeout/update-feedback-status-20260506-smashup-human-remaining-two.raw.txt`
- 实际成功写入结果：
  - `69fa23e04590ce09779a7c52`：`matchedCount=1`、`modifiedCount=1`、目标状态 `resolved`
  - `69fa0bd74590ce09779a7bd6`：`matchedCount=1`、`modifiedCount=1`、目标状态 `closed`
  - 实际写入时间：`2026-05-06T00:07:16Z`

## 回写后复核

- 单条回写后快照：`temp/feedback-closeout/query-feedback-69fa23e0-69fa0bd7-after-writeback-20260506.raw.txt`
- 人类未收口最终快照：`temp/feedback-closeout/query-human-open-inprogress-after-final-writeback-20260506.raw.txt`

### 1. 两条目标状态

- 我实际看到什么：
  - `69fa23e04590ce09779a7c52` 已是 `resolved`
  - `69fa0bd74590ce09779a7bd6` 已是 `closed`
  - 两条 `updatedAt` 都更新到本轮写入时间
- 是否达到验收标准：
  - 达到。最后两条人工单已按各自正确口径完成正式回写。

### 2. 人类未收口清零

- 我实际看到什么：
  - 生产 `feedbacks` 中 `reporterType=user && status in [open,in_progress]` 查询结果 `count=0`
  - 返回 `docs=[]`
- 是否达到验收标准：
  - 达到。当前线上人类未收口反馈已经清零。

## 相关证据

- 三条人工单回写证据：`evidence/feedback-closeout/smashup-human-three-writeback-2026-05-06.md`
- 本轮最后两条回写前快照：`temp/feedback-closeout/query-feedback-69fa23e0-69fa0bd7-before-writeback-20260506.raw.txt`
- 本轮最后两条回写回显：`temp/feedback-closeout/update-feedback-status-20260506-smashup-human-remaining-two.raw.txt`
- 本轮最后两条回写后快照：`temp/feedback-closeout/query-feedback-69fa23e0-69fa0bd7-after-writeback-20260506.raw.txt`
- 本轮人类未收口清零快照：`temp/feedback-closeout/query-human-open-inprogress-after-final-writeback-20260506.raw.txt`

## 结论

- 本轮已按生产真源把最后两条 SmashUp 人工反馈分别回写为：
  - `69fa23e04590ce09779a7c52 -> resolved`
  - `69fa0bd74590ce09779a7bd6 -> closed`
- 回写后复核确认：当前线上人类 `open / in_progress` 反馈已清零。
