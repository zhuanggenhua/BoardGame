## Context

The Gang 是合作排序游戏，需要至少一种玩家可见的人机入口，避免只能依赖多个人工座位完成本地体验与回归验证。

## Goals / Non-Goals

- Goals: 通过共享 AI 决策上下文提供本地 AI 座位。
- Goals: AI 只能从当前合法动作集合中选择动作。
- Non-Goals: 不实现强策略、难度档位、搜索或隐藏信息采样。

## Decisions

- Decision: 新增 The Gang 本地 AI runtime，并在 manifest 中声明 `localAi = true`。
- Decision: 合法动作构建器只暴露当前可选筹码和有效公共推进命令。
- Decision: baseline policy 只做合法动作选择，不尝试推断最优牌力排序。

## Risks / Validation

- Risk: AI 选择被占用筹码或非法推进。Mitigation: `ai.test.ts` 覆盖被占用筹码排除、推进命令合法性和策略返回动作合法性。
- Validation: `openspec validate add-the-gang-ai-test-path --strict --no-interactive`、The Gang 定向测试与 ESLint。
