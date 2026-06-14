## 1. Audit
- [x] 1.1 盘点第一批 4 人玩家目标交互能力：任意玩家授 token、任意玩家移除状态、状态/可移除 token 转移。
- [x] 1.2 对照代码与现有测试，记录仍带 2 人假设的验证层、UI 组件和 E2E 入口。

## 2. Implementation
- [x] 2.1 收紧 `GRANT_TOKENS` 与 `TRANSFER_STATUS` 的交互期验证：目标玩家必须属于候选集，转移目标不得等于来源玩家，交互上下文必须完整。
- [x] 2.2 改造 `InteractionOverlay` / `Board.tsx` 的玩家选择渲染与提交流程，使 4 人候选目标可稳定区分并可测试。
- [x] 2.3 确认 `TRANSFER_STATUS` 在 4 人模式下对状态与可移除 token 的双阶段交互都能正确执行。
- [x] 2.4 补齐第一批代表性多人能力的规则/组件测试，覆盖 `Transfer Status`、`Consecrate`、`remove-status-1`、`remove-all-status` 与 `Vengeance II`。
- [x] 2.5 修正共享攻击流程对“无单一敌方目标、无伤害、但仍会触发交互 / postDamage”的技能支持，避免 4 人模式下误进 `targetingRoll` 或提前吞掉 `INTERACTION_REQUESTED`。
- [x] 2.6 补齐 4 人在线 E2E，覆盖 `Transfer Status`、`Consecrate`、`remove-status-1`、`remove-all-status` 与 `Vengeance II` 的真实链路。

## 3. Validation
- [x] 3.1 `openspec validate update-dicethrone-4p-player-target-interactions --strict --no-interactive` 通过。
- [x] 3.2 相关 DiceThrone Vitest 通过，包括 `rule-consistency.test.ts` 中的 4 人玩家目标交互与无 defender 流程回归。
- [x] 3.3 相关 DiceThrone 4 人 E2E 通过并补证据，当前 `e2e/dicethrone/dicethrone-simple-start.e2e.ts` 已覆盖 12 条在线用例。
