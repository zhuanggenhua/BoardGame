# DiceThrone 本地反馈 69edd4f3：日志里 AI 怎么连续两个回合（2026-08-22）

## 口径

- 本轮口径：本地数据库反馈记录。
- 真实源：`mongodb://127.0.0.1:27017/boardgame.feedbacks`。
- 反馈 ID：`69edd4f3aaf1b13c50d21cf3`
- 原始症状保真版：玩家反馈“日志里ai怎么连续两个回合”。

## 原始反馈命中的症状

反馈自带行动记录是“最新记录在上”。如果只从上往下读，会看到几行 AI 阶段推进挨在一起，容易误以为 AI 连续拿了两个回合。

按时间从旧到新还原，实际顺序是：

- AI 曾在 17:02:25 打出“拜拜了您内！”。
- 玩家游客2141 在 17:02:28 到 17:02:29 经过攻击、主要阶段二、弃牌、维持、收入和主要阶段一。
- AI 2 号位在 17:02:29 到 17:02:40 进行自己的回合。
- 玩家游客2141 在 17:02:40 到 17:02:42 又进行自己的回合。
- AI 2 号位在 17:02:42 到 17:02:54 再进行自己的回合。
- 17:02:54 最新两条是玩家游客2141 抽牌和获得 CP，当前保存状态也停在玩家主要阶段一。

因此这条反馈快照没有复现“AI 连续两个完整回合”；它复现的是日志倒序展示导致的读法误会。

## 当前状态证据

- 反馈当前状态：`phase=main1`，当前行动玩家是游客2141。
- 行动记录中 AI 两段回合之间有玩家游客2141 的回合推进、抽牌、获得 CP 和荣誉获得记录。
- 日志展示工具 `buildActionLogRows` 默认支持按时间排序；当前反馈导出的 `humanReadableLog` 是按最新在上排列。

## 本轮处理

- 本轮未修改代码。
- 本轮按反馈自带行动记录和当前状态还原真实回合顺序，判断为日志倒序造成的误解，不是 AI 轮转 bug。

## 验证

命令：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/components/__tests__/actionLogFormat.test.ts src/games/dicethrone/__tests__/actionLogFormat.test.ts --configLoader native -t "actionLogFormat|advancePhase|confirmRollWithAbility"
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/actionLogFormat.test.ts --configLoader native
```

结果：

- 通用日志格式测试：`1 file passed / 4 tests passed`，另一个专项文件因筛选未命中被跳过。
- DiceThrone 日志格式专项全量复跑：`1 file passed / 15 tests passed`。

## 收口结论

这条反馈不是当前 AI 连续行动 bug。保存的真实记录里，AI 的两个回合之间夹着玩家游客2141 的完整回合；玩家看到“AI 连在一起”是因为反馈导出的日志最新在上，需要反向按时间读。

本地反馈按“规则/日志解释，当前记录未复现 AI 连续两个回合”关闭。
