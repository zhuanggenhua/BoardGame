## Context

The Gang 已有领域状态快照能力，但 Board 没有把当前状态交给共享撤回 HUD，上层玩家看不到撤回入口。

## Goals / Non-Goals

- Goals: 通过共享 `UndoProvider` 暴露撤回所需状态。
- Goals: 让 The Gang 使用独立撤回快照白名单。
- Non-Goals: 不新增 The Gang 专属撤回面板，不改变共享撤回系统交互。

## Decisions

- Decision: 在 The Gang Board 外层挂接共享 `UndoProvider`。
- Decision: 从日志白名单中拆出 `THE_GANG_UNDO_ALLOWLIST`，明确撤回快照策略。
- Decision: 用 runtime test 探针验证共享 HUD 可读到 The Gang 撤回状态。

## Risks / Validation

- Risk: 撤回状态只在后端存在，UI 无法读取。Mitigation: `Board.runtime.test.tsx` 覆盖 `UndoProvider` 状态输出。
- Validation: `openspec validate add-the-gang-undo-ui --strict --no-interactive`、The Gang 定向测试、ESLint 与 typecheck。
