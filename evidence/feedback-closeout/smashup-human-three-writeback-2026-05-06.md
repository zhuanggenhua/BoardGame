# SmashUp 三条人工反馈状态回写（2026-05-06）

## 范围

- 时间：`2026-05-06 07:42 +08`
- 目标反馈：
  - `69f96a734590ce09779a7205`：大杀四方战斗力相等的情况下是取第二位分
  - `69f9623c4590ce09779a715f`：熊的泰坦不能用额外随车打出
  - `69f961ca4590ce09779a715a`：多人观战有 bug 看不了其他人
- 来源口径：线上真实反馈

## 正式写入口

- 本轮没有使用开放 HTTP 反馈接口。
- 原因：
  - `GET https://api.easyboardgame.top/feedback/open?status=open&page=1&limit=10` 返回 `404`
  - 因此当前不存在可用的真实列表入口，不能按 skill 里的 HTTP 路径继续回写。
- 本轮改用的真实写入口：
  - `ssh admin@8.148.71.102`
  - `docker exec -i boardgame-mongodb mongosh --quiet boardgame`
  - 直接更新生产 `feedbacks` 集合

## 回写前核对

- 单条目标快照：`temp/feedback-closeout/query-feedback-69f96a-69f9623c-69f961ca-before-20260506.raw.txt`
- 我实际核对到的结果：
  - 3 条都存在于生产 `feedbacks`
  - 3 条在回写前都是 `status: open`
  - `source=feedback-modal`、`reporterType=user`、`gameId=smashup`

## 回写执行

- 回写脚本：`temp/feedback-closeout/update-feedback-status-20260506-smashup-human-three-to-resolved.js`
- 实际成功写入时的结果：
  - `matchedCount=3`
  - `modifiedCount=3`
  - 写入时间：`2026-05-05T23:42:00.000Z`
- 说明：
  - 后续为了补存档又重复执行过同一脚本一次；
  - 因为 3 条已经处于 `resolved`，补执行时返回 `matchedCount=0 / modifiedCount=0`；
  - 所以本轮“真正发生状态变化”的直接证据，以回写前后查询结果为准。

## 回写后复核

- 单条目标回写后快照：`temp/feedback-closeout/query-feedback-69f96a-69f9623c-69f961ca-after-20260506.raw.txt`
- 人类未收口列表回写后快照：`temp/feedback-closeout/query-human-open-inprogress-after-writeback-20260506.raw.txt`

### 1. 目标 3 条状态

- 我实际看到什么：
  - `69f96a734590ce09779a7205` 已变为 `resolved`
  - `69f9623c4590ce09779a715f` 已变为 `resolved`
  - `69f961ca4590ce09779a715a` 已变为 `resolved`
  - 三条的 `updatedAt` 都已更新为 `2026-05-05T23:42:00.000Z`
- 是否达到验收标准：
  - 达到。说明这 3 条的线上真实反馈状态已完成正式回写。

### 2. 人类未收口剩余情况

- 我实际看到什么：
  - 回写后生产 `feedbacks` 中 `reporterType=user && status in [open,in_progress]` 仍剩 `2` 条
  - 剩余 ID：
    - `69fa23e04590ce09779a7c52`
    - `69fa0bd74590ce09779a7bd6`
- 是否达到验收标准：
  - 对“本轮这 3 条状态回写”而言达到。
  - 对“线上人类反馈全量清零”而言未达到，本轮没有宣称总收口。

## 本地状态板同步

- 状态板：`temp/feedback-closeout/status-board.json`
- 本轮已同步：
  - 补入 3 条缺失反馈项
  - 挂接各自 local closeout evidence / verification
  - 远端回写后把 `lastFetchedStatus` 同步为 `resolved`
- 校验结果：
  - `node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json`
  - 输出：`feedback-status: ok`

## 相关本地修复证据

- `evidence/smashup/smashup-feedback-69f96a734590ce09779a7205-tied-base-scoring-local-closeout-2026-05-05.md`
- `evidence/smashup/smashup-feedback-69f9623c4590ce09779a715f-extra-minion-titan-local-closeout-2026-05-05.md`
- `evidence/smashup/smashup-feedback-69f961ca4590ce09779a715a-multi-opponent-view-local-closeout-2026-05-05.md`

## 结论

- 本轮通过生产 Mongo 真实写入口，已将指定 3 条 SmashUp 人工反馈从 `open` 正式回写为 `resolved`。
- 当前线上人类未收口反馈仍剩 2 条，所以下一轮只能说“这 3 条已回写完成”，不能说“整批人类反馈已清零”。
