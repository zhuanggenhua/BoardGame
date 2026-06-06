## Context
- Batch 1 已经把当前活跃的显式多人玩家目标 handler 收口完毕，继续沿原 change 追加同类 requirement 会掩盖“Batch 1 已完成”的事实。
- 但当前“玩家目标交互”主线上还留有两类未收口风险：
  - `remove-status-self` 仍走共享 `selectStatus` 交互链，但只被 `flow.test.ts` 浅锁到“会创建仅限自身的交互”；
  - `allOpponents` / 广播式目标集合在 4 人 / 2v2 下仍有把 ally 一并打进去的风险，当前 `effects.ts` 与 `customActions/pyromancer.ts` 都存在 `Object.keys(state.players).filter(id => id !== attackerId)` 这种实现口径。
- `Soul Burn` 原先是最值得警惕的相邻高风险入口：代码曾把它广播到所有非自己玩家，但能力定义和 wiki snapshot 都更接近“当前目标/defender”语义；本轮审计后已按该口径修正实现与本地化文本。

## Goals
- 明确 4 人 / 2v2 下 self-only 与 enemy-set 语义的真实边界：共享交互与执行层不能再偷用 2 人“self/opponent”近似。
- 若当前实现存在语义缺口，给出最小正确修复路径，而不是继续堆卡名级重复测试。
- 让 Batch 2 与 Batch 1 拥有清晰分批边界，便于后续继续做 Batch 3/4 审计。

## Non-Goals
- 不回头重写 Batch 1 已完成的任意玩家授 token / 任意玩家移除状态 / 状态转移 / 无默认 defender 流程。
- 不在 proposal 阶段直接承诺扩到所有多人攻击技能；本批只收口 self-only 与 enemy-set 这两个剩余共享根因。

## Audit Questions
1. `remove-status-self` 在 4 人 / 2v2 下是否仍完整沿用共享 `selectStatus` UI / validation / execution 链，而没有被多人候选集逻辑污染？
2. `allOpponents` 在 4 人 / 2v2 下是否应严格命中真实敌方集合，而不是“所有非自己玩家”？
3. `Soul Burn` 等相邻广播式伤害是否真属于“所有对手”语义，还是当前代码过度扩张了目标集合？

## Decision Gate
- 如果审计证明 `remove-status-self` 与 `allOpponents` 只是测试缺口：
  - Batch 2 以“补规则回归 + 在线证据 + 文档收口”为主，不扩大共享模型。
- 如果审计证明当前实现确有语义错误：
  - 优先在共享规则层统一改用团队感知的目标集合 helper，再同步收紧 validation / UI / E2E。
- `Soul Burn` 的本轮裁决：
  - 以能力定义中的 `target: 'opponent'`、升级变体一致性和 wiki snapshot 的单体描述为准；
  - 将 `customActions/pyromancer.ts` 从“所有非自己玩家”改回“当前 defender/目标玩家”；
  - 同步修正文案，避免本地化继续把它描述成“所有对手”。
