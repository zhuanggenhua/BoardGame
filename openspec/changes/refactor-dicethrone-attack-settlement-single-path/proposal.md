# Change: DiceThrone 攻击结算单一路径重构

## Why
当前 DiceThrone 共享攻击流把“目标确认”“主伤害落地”“攻击后续选择”“攻击收口”拆散在多个 phase exit / autoContinue / custom action 分支里推进，并依赖 `damageResolved`、`bonusDiceResolved`、`offensiveRollEndTokenResolved` 等布尔标记拼接语义。

这导致系统没有把“同一笔攻击的主伤害只能落地一次”建成结构性不变量。`targetingRoll` + `postDamage` 选择的组合场景已经证明：只要流程在错误时点重入，同一笔 `pendingAttack` 就可能重复发出主伤害。

这不是单个英雄脚本问题，而是 DiceThrone 共享攻击结算模型的设计缺口。继续在具体技能上补局部门禁，只会扩大“哪些布尔位组合代表什么阶段”的隐性复杂度。

## What Changes
- 为 DiceThrone 引入显式的攻击结算阶段模型，替代当前依赖多个布尔位拼接的结算推进方式。
- 将 `targetingRoll`、`preDefense`、主伤害落地、`postDamage` 后续选择、`ATTACK_RESOLVED` 收口，统一为单一路径推进。
- 把“当前攻击仍在等待后续选择”与“奖励骰已结算”拆成不同语义，禁止复用同一字段跨职责承载。
- 约束 autoContinue：在当前攻击的选择结果尚未 reduce 进权威状态前，不得重入主伤害入口。
- 为 1v1、4 人 / 2v2、不可防御攻击、奖励骰、Token 响应、`postDamage` 选择等路径补统一回归门禁。

## Impact
- Affected specs:
  - `dicethrone-attack-settlement`
- Affected docs:
  - `docs/ai-rules/doc-index.md`
  - `docs/games/dicethrone/attack-settlement-invariants.md`
- Affected code:
  - `src/games/dicethrone/domain/core-types.ts`
  - `src/games/dicethrone/domain/flowHooks.ts`
  - `src/games/dicethrone/domain/reducer.ts`
  - `src/games/dicethrone/domain/reduceCombat.ts`
  - `src/games/dicethrone/domain/effects.ts`
  - `src/games/dicethrone/domain/customActions/*`
  - `src/games/dicethrone/__tests__/*`
