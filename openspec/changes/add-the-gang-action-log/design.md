## Context

The Gang 的基础版流程已经有公开命令：选筹码、推进轮次、摊牌、开始下一次抢劫。默认空日志无法向玩家解释这些公开进展。

## Goals / Non-Goals

- Goals: 记录玩家可见的公开进展，并接入现有 action-log HUD。
- Goals: 不泄露任何隐藏手牌或未公开牌力细节。
- Non-Goals: 不新增独立日志 UI，不改变 The Gang 领域规则。

## Decisions

- Decision: 使用 The Gang 专属 action-log formatter，把公开命令映射成 i18n segment。
- Decision: 日志只记录公开动作和结算摘要，不记录底牌明文。
- Decision: 撤回快照白名单独立于日志白名单，避免把“可记录”和“可撤回”混成一套策略。

## Risks / Validation

- Risk: 日志误泄露隐藏手牌。Mitigation: `actionLog.test.ts` 覆盖日志内容不包含隐藏牌细节。
- Validation: `openspec validate add-the-gang-action-log --strict --no-interactive`、The Gang 定向测试与 ESLint。
