## 1. Audit
- [x] 1.1 复核 `modifyDie` / `selectDie` / `shadow_thief-shadow-manipulation` 的共享入口、合法窗口与 2v2 spec 边界。
- [x] 1.2 复核 `targetOpponentDice`、`rollerId`、`getContextualOpponentId`、`getResponderQueue` 等共享语义是否仍残留 2 人假设。
- [x] 1.3 复核现有 Vitest / UI 测试 / Playwright，明确哪些仍有复用价值，哪些旧专项文件应退役。

## 2. Implementation
- [x] 2.1 如审计确认共享缺口，收口多步骰子交互的元数据模型，显式表达当前骰池归属/观察视角，不再只靠 `targetOpponentDice:boolean`。
- [x] 2.2 对齐 4 人 / 2v2 下合法改骰窗口与同队响应队列边界，确保“队友可改骰”与“队友不响应队友”同时成立。
- [x] 2.3 补齐代表性规则/UI 回归，覆盖通用 `modifyDie/selectDie` 入口与 `shadow_thief-shadow-manipulation`。
- [x] 2.4 补齐至少 1 条现役 4 人在线 E2E 证据，并清理或降级旧 `dicethrone-die-modification.e2e.ts` / `dicethrone-die-reroll.e2e.ts` 的证据地位。

## 3. Validation
- [x] 3.1 `openspec validate update-dicethrone-4p-interactions-batch-3 --strict --no-interactive` 通过。
- [x] 3.2 相关 DiceThrone Vitest / UI 测试通过。
- [x] 3.3 相关 DiceThrone 4 人 E2E 通过并补证据。
