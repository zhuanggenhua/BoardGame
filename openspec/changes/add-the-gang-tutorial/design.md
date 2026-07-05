## Context

The Gang 基础版需要让玩家理解合作目标、隐藏手牌、筹码排序、轮次推进、摊牌和胜负轨道。空教程 manifest 会让教程入口没有实际教学价值。

## Goals / Non-Goals

- Goals: 提供基础教程步骤和稳定 Board 高亮锚点。
- Goals: 教程只解释基础版公开规则和玩家可见操作。
- Non-Goals: 不覆盖 7-10 人扩展、Joker、工具牌、Dealer、挑战/专家卡或强策略教学。

## Decisions

- Decision: tutorial manifest 按目标、手牌、筹码选择、轮次、玩家区、摊牌、结束分步。
- Decision: Board 暴露稳定 `data-tutorial-id` 锚点，避免教程依赖易变文案。
- Decision: 教程文案通过 `game-the-gang` i18n namespace 提供。

## Risks / Validation

- Risk: 高亮锚点和实际 Board 脱节。Mitigation: `tutorial.test.tsx` 覆盖 manifest 与 Board anchors。
- Validation: `openspec validate add-the-gang-tutorial --strict --no-interactive`、The Gang 定向测试与 ESLint。
