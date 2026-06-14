## 1. Audit
- [x] 1.1 盘点 Batch 2 的确认范围与审计候选：`remove-status-self`、所有 `allOpponents` 入口，以及 `Soul Burn` 这类仍带多人广播语义疑点的效果。
- [x] 1.2 复核 `effects.ts`、`customActions/pyromancer.ts` 与相关能力定义，确认哪些位置把“所有对手”误实现成“除自己外所有玩家”。
- [x] 1.3 复核现有 Vitest / E2E / 证据文档，明确哪些已覆盖 Batch 1，哪些仍缺少 4 人 / 2v2 下的 self-only 与 enemy-set 证据。

## 2. Implementation
- [x] 2.1 如审计确认存在语义缺口，统一改用团队感知的对手集合解析，禁止继续用 `Object.keys(state.players).filter(id => id !== attackerId)` 代替 `allOpponents`。
- [x] 2.2 补齐 `remove-status-self` 的共享交互测试，覆盖 4 人 / 2v2 下仍只允许选择自身状态 / token 的约束。
- [x] 2.3 补齐代表性规则回归与至少 1 条 4 人在线 E2E，证明 `allOpponents` / self-only 语义在真实页面和权威态都闭环。
- [x] 2.4 若 `Soul Burn` 的规则审计确认当前广播范围不正确，则在本批同步修正并补回回归；若规则来源仍不充分，则显式记录为下一批或 open question，不做猜测修复。

## 3. Validation
- [x] 3.1 `openspec validate update-dicethrone-4p-interactions-batch-2 --strict --no-interactive` 通过。
- [x] 3.2 相关 DiceThrone Vitest 通过。
- [x] 3.3 相关 DiceThrone 4 人 E2E 通过并补证据。
