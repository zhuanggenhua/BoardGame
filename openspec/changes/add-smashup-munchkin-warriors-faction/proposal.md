# Change: 接入 Smash Up 萌奇金勇士派系玩法

## Why

- 勇士 12 张卡牌、2 个基地、图集索引和双语文案已经完成静态录入，但运行时没有能力注册与对象级行为证据。
- 勇士引入怪物摧毁后的派系触发、怪物奖励宝藏的即时额外出牌、附着行动替代回手和怪物数量动态力量修正，命中现有 Munchkin 事件与 Smash Up 交互链的共享扩展边界。
- 需要按卡牌和基地逐项实现、验证并审计，不能把静态卡面存在误报成勇士可玩完成。

## What Changes

- 为大英雄、明星勇士、狂战士、嘲讽者接入天赋、怪物触发、怪物摧毁和可选怪物打出。
- 为领导运动、斩杀、地牢诱饵、骚乱、战争怒吼接入显式模式 / 目标选择、怪物入场、怪物摧毁、奖励宝藏与临时力量。
- 为哑铃、永恒的英雄、无处不在之盾接入附着、持续力量和替代回手。
- 为堡垒、锦标赛接入同基地怪物摧毁后的抽宝藏 / 补怪物触发。
- 所有模式、目标、是否发动、支付和部分使用决策，即使只有一个合法候选，也必须保留真实手动选择。
- 补对象级 L2 测试、真实入口 E2E、截图审计和 evidence 回写；未覆盖对象继续标记为 scoped debt。

## Scope

- 本 change 只覆盖 `munchkin_warriors` 的 12 张卡牌和 2 个基地。
- 复用现有 Munchkin 怪物 / 宝藏牌库、即时额外出牌、附着行动与 Smash Up 触发器；不重写静态规则真相源。
- 其它 Munchkin 派系、公共怪物 / 宝藏的全量收口不属于本 change 的完成条件。

## Impact

- Affected specs: `smashup-faction-batch-workflow`、`smashup-ability-runtime`、`smashup-ongoing-effect-authoring`。
- Affected code: 勇士能力 owner、统一怪物摧毁触发上下文、Munchkin 怪物击败事件奖励字段、随从回手附着行动去向和统一力量修正 owner。
- Affected evidence: `evidence/smashup/munchkin-new-faction-flow-audit-2026-08-01.md` 与勇士真实入口截图。

## Acceptance Boundary

- 只有 12 张勇士卡牌和 2 个基地均有独立 L2 结论，并且每个交互 / 流程态对象有 L3/L4 结论后，才能把勇士标记为对象级完成。
- 用户已在当前任务线明确要求继续实施，proposal 与测试设计先行；若实现证据不足，必须保留 blocked / scoped-debt，不得扩大完成口径。
