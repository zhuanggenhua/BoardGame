# Change: 重拆山屋惊魂核心交互合同

## Why

当前 `betrayal` 已有多条最小可玩链路，但基础规则语义没有先被完整拆成“玩家决策点 -> 状态真相 -> 命令/事件 -> UI 承接 -> 验证证据”的合同。结果是部分基础规则被实现自动代选、裸数值或结果日志替代，导致后续实现容易继续堆补丁。

## What Changes

- 建立 `betrayal` 的全规则交互设计账本和 P0 基础规则语义覆盖矩阵，先设计交互再实施。
- 明确 P0 交互重拆范围：剧本选择、属性轨、作祟风险表达、房间放置朝向、伤害分配、移动力快照、交易和特殊行动。
- 补入规则逐条覆盖门禁：基础规则 1-30 节、官方对照补充细节、50 个作祟源段映射和作祟书子账本都必须有明确状态，未覆盖不得冒充完成。
- 约束后续实现：没有交互合同、状态真相和验证点的基础规则，不得进入代码实施或宣称基础版完成。
- 将当前只能代表首剧本/低保真链路的部分标为 `representative-only` 或 `blocked`，避免继续包装成完整规则。

## Impact

- Affected specs: `betrayal-core-interactions`
- Affected docs: `docs/games/betrayal/full-rule-interaction-redesign.md`, `docs/games/betrayal/haunt-redesign-index.md`, `docs/games/betrayal/haunt-contract-ledger.md`, `docs/games/betrayal/interaction-redesign-coverage-matrix.md`
- Affected code later: `src/games/betrayal/game.ts`, `src/games/betrayal/scenarioConfig.ts`, `src/games/betrayal/roomSetup.ts`, `src/games/betrayal/Board.tsx`, `src/games/betrayal/__tests__/*`, `e2e/betrayal/*`
- This change is design-first. Implementation must wait until the matrix is reviewed or explicitly approved.
