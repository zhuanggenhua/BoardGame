# 本地反馈 6aa5f347：共享乐观更新导致打出“起开！”后交互已过期

- 口径：本地数据库反馈记录。
- 统计时间：2026-09-13T10:52:40+08:00。
- 反馈 ID：`6aa5f347a6cec03d979a427f`。
- 反馈原文：`打卡牌tmd交互已过期，乐观重构的有问题吗`
- 游戏：DiceThrone。
- 口径纠偏：DiceThrone 是这条反馈的现场和真实快照样本；本轮故障层是共享乐观传输 / Provider 连续命令合同，不是 DiceThrone 单游戏规则问题。
- 原始入口：`/play/dicethrone/match/SbVsYB0f3dm?playerID=0`，`mode=online`，`playerId=0`，`appCommitSha=49574b290901`。

## 效果描述原文

- 当前运行中文描述：`起开！`，`从 1 名玩家身上移除 1 个状态效果。`（`public/locales/zh-CN/game-dicethrone.json`）
- Wiki 快照原文：`Remove 1 status effect from any player.`（`src/games/dicethrone/__tests__/fixtures/wikiSnapshots.ts:556`）
- 当前实现合同：`card-get-away` 是主阶段牌，效果走 `remove-status-1`，目标为玩家选择（`src/games/dicethrone/domain/commonCards.ts:274-281`）。

## 反馈现场

- 玩家提交反馈前最近记录包含：`[08:49:50] 游客7424: 打出卡牌 起开！`。
- 反馈状态快照处于 `main2`。
- 当前等待交互存在：`dt-interaction-card-get-away-1789260590683`。
- 交互现实含义：玩家 0 正在选择要从哪名玩家身上移除哪个状态。
- 交互数据里的旧内部 ID 是 `card-get-away-1789260590683`，当前 live 交互 ID 是 `dt-interaction-card-get-away-1789260590683`。

## 根因分层

- 现实故障现象：玩家打出“起开！”后，状态选择确认被提示为“交互已过期 / 旧版本”，无法按当前可见交互完成移除。
- 直接拒绝条件：后续 `REMOVE_STATUS` 等 DiceThrone 旧卡牌交互命令没有稳定携带当前 live 交互 ID，或在乐观 pending 后没有声明应接在预测后的状态版本执行。
- 止血/恢复动作：本轮不是跳过拒绝，而是让玩家/AI 后续命令命中当前交互身份，并让传输层把这类后续命令发送到 pending 链之后。
- 根本机制：乐观更新先把 `PLAY_CARD` 预测成“已有当前交互”的 UI；玩家可马上点确认，但共享 Provider 重构后没有给“上一条乐观命令打开的后续交互命令”保留明确发送合同。旧游戏私有交互命令没有进入 pending companion 合同，且 DiceThrone 旧命令路径仍可能使用内层旧 ID。于是确认命令会按旧权威版本或内层旧 ID 去校验，被判成过期/不匹配。

## 修复内容

- 传输层新增显式的 `pendingCompanionCommands` 配置；这类命令在已有乐观 pending 时不再重新预测，而是先 flush 已排队命令，再用 `expectedStateID = lastStateID + pendingCount` 单独发送。
- 共享 Provider 只允许内置 `SYS_INTERACTION_*` 交互命令或游戏显式声明的后续命令接在 pending 后发送，不再用“payload 里带 `interactionId`”这种隐式猜测扩大放行范围。
- DiceThrone 配置把 `REMOVE_STATUS`、`TRANSFER_STATUS`、`GRANT_TOKENS`、`RESOLVE_INTERACTION` 声明为旧卡牌交互的 pending companion。
- DiceThrone UI moves 与 Board 确认路径会把当前 live 交互 ID 写入 `REMOVE_STATUS`、`TRANSFER_STATUS`、`RESOLVE_INTERACTION`。
- DiceThrone 领域校验用当前 `sys.interaction.current.id` 作为 live 交互身份，不再用 `current.data.id` 的内层旧 ID 做玩家提交校验。
- DiceThrone AI 生成的同族后续命令也携带当前 live 交互 ID，避免 AI 路径继续沿旧合同提交。
- 领域校验新增交互 ID 匹配检查：携带过期 ID 的后续命令会被拒绝，且不会误移除状态。

## 真实快照回放

使用本地数据库反馈记录的 `stateSnapshot` 直接回放：

```json
{
  "currentInteractionId": "dt-interaction-card-get-away-1789260590683",
  "innerInteractionId": "card-get-away-1789260590683",
  "sourceCardId": "card-get-away",
  "type": "selectStatus",
  "targetPlayerIds": ["0", "1"],
  "stale": {
    "success": false,
    "error": "interaction_id_mismatch",
    "mesmerizeAfter": 1,
    "interactionIdAfter": "dt-interaction-card-get-away-1789260590683"
  },
  "currentId": {
    "success": true,
    "mesmerizeAfter": 0,
    "interactionAfter": null
  }
}
```

结论：旧交互 ID 被拒绝且不会移除状态；当前 live 交互 ID 能移除催眠并关闭交互。

## 验证命令

- `npx vitest run --config vitest.config.ts --configLoader native src/games/dicethrone/__tests__/response-window-interaction-lock.test.ts --reporter=dot`
  - 结果：1 个文件通过，27 个测试通过。
- `npx vitest run --config vitest.config.ts --configLoader native src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --reporter=dot`
  - 结果：1 个文件通过，164 个测试通过。
- `npx vitest run --config vitest.config.ts --configLoader native src/engine/transport/__tests__/react.test.tsx --reporter=dot`
  - 结果：1 个文件通过，26 个测试通过。
- `npx vitest run --config vitest.config.ts --configLoader native src/games/dicethrone/ui/__tests__/resolveMoves.test.ts --reporter=dot`
  - 结果：1 个文件通过，2 个测试通过。
- `npm run typecheck`
  - 结果：通过。

## 同类扩审

- 搜索 DiceThrone AI 对 `RESOLVE_INTERACTION`、`REMOVE_STATUS`、`TRANSFER_STATUS` 的命令生成点，已把同族旧卡牌交互后续命令统一补上当前 live 交互 ID。
- 搜索 DiceThrone UI 与 hooks 中 `pendingInteraction.id` 消费点；会发命令的 Board / moves 路径已改为 live ID，其它读取点仅用于展示或本地状态重置。
- `GRANT_TOKENS` 已作为 pending companion 保留在配置和校验合同里；当前未命中 AI/UI 直接生成点。

## 漏审复盘 / 规范回代判断

- 漏审类型：共享乐观传输重构没有覆盖“上一条乐观命令打开当前交互后，玩家马上提交后续确认命令”的场景；旧测试只覆盖了交互出现或单步命令合法，没有覆盖“打牌乐观预测后马上确认状态选择”的连续时序，也没有覆盖“不能因为 payload 带 `interactionId` 就隐式绕过 pending”的共享层边界。
- 现有规范是否覆盖：`.spec/knowledge/standards/engine-transport.md` 已要求连续乐观操作要在最新乐观状态上继续预测/发送，业务事务不能被 pending 吞掉；`.spec/knowledge/standards/rule-driven-interaction-design.md` 已要求后续提交命中当前 live 交互合同；`.spec/knowledge/standards/regression-closeout.md` 已要求验证用户原始失败位点和同类扩审。
- 本轮判断：不需要新增项目规范；这是已有规范未被旧乐观重构完整执行。已在代码和测试中补回该合同。
