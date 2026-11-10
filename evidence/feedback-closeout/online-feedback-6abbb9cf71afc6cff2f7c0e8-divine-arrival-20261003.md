# 线上反馈修复：6abbb9cf71afc6cff2f7c0e8

## 反馈内容 / 现实症状

> 王权骰铸炽天使的神圣降临状态，应该不可被转移才对，现在是可以被手牌效果转移

线上来源：`https://api.easyboardgame.top/admin-api/feedback`，2026-10-03 拉取；反馈记录未附截图、操作日志或状态快照。

## 发现的问题

- 游戏与对象已由反馈原文锁定为 Dice Throne / 炽天使（Tianshi）/ `divine_arrival`（神圣降临）。
- 主真相源效果原文：`自己的维持阶段，对所有真实对手各造成等同于神圣降临层数的伤害。不可转移，可被移除。`（`public/locales/zh-CN/game-dicethrone.json`，`tokens.divine_arrival.description`）。
- 英文同源原文：`During your Upkeep, deal damage equal to your Divine Arrival stacks to each real opponent. Cannot be transferred; can be removed.`（`public/locales/en/game-dicethrone.json`）。
- 根因是转移状态链只消费 `removable`，没有同时消费 `transferable`；因此手牌 `card-transfer-status` 的候选 UI 与执行路径都可能把 `divine_arrival` 当成可转移对象。

## 处理方式 / 修复结果

- `src/games/dicethrone/heroes/tianshi/tokens.ts`：为 `divine_arrival` 明确写入 `transferable: false`，保留 `removable: true`。
- `src/games/dicethrone/domain/statusRemoval.ts`：新增 `isTransferableStatusId` 与 `canTransferStatus`，统一要求可转移、可移除，并保留眩晕类同队限制。
- `src/games/dicethrone/domain/commandValidation.ts` 与 `src/games/dicethrone/domain/execute.ts`：`TRANSFER_STATUS` 校验和执行共同消费 `canTransferStatus`，非法转移不再产生扣除 / 授予事件。
- `src/games/dicethrone/ui/InteractionOverlay.tsx`：手牌转移状态候选过滤 `transferable: false`；`divine_arrival` 不再出现在候选列表。
- 回归保护：`src/games/dicethrone/__tests__/tianshi-behavior.test.ts`、`src/games/dicethrone/ui/__tests__/InteractionOverlay.test.tsx`，并新增真实浏览器入口 `e2e/dicethrone/dicethrone-status-interaction-complete.e2e.ts` 场景。

## 验证

- Dice Throne 定向单测：3 个文件、104 项通过。
- 真实浏览器入口：`node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-status-interaction-complete.e2e.ts "神圣降临不可作为手牌转移候选"`，1 项通过；画面保留可转移的赏金，隐藏神圣降临。
- 同文件全量 E2E 另有 1 个既有 `selectPlayer` 文案断言失败（找不到“无状态”提示），与本反馈场景无关；本反馈新增场景已独立通过。

## 漏审复盘 / 规范回代

此前只覆盖了“不可移除”Token 的转移拦截，没有覆盖“可移除但不可转移”的组合；本轮补齐领域、命令、执行器、UI 和真实入口的同一字段合同。现有 `feedback-closeout` 与 `rule-contract-audit` 已覆盖该类链路，本轮不新增项目级规范。

## 线上边界

本轮完成本地源码修复与真实入口验证；当前工作树包含该修复但尚未执行本轮生产部署，因此写回的 `resolvedMethod` 明确标注“本地已修复，生产待发布 / 待回查”。
