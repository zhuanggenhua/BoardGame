## 0. Approval Gate
- [x] 0.1 Approval Gate：`add-the-gang-undo-ui` 的 proposal / design / tasks / spec delta 支持基础版完整闭环中的共享撤回 UI 桥边界：Board 提供共享 `UndoProvider` 状态，撤回白名单独立于日志白名单；专属撤回面板属于后续 UI 增强，不阻塞基础版完成。用户已明确本轮判断口径是“不是所有扩展，而是全部基本功能都能完成”，因此本 Approval Gate 关闭。

## 1. Implementation
- [x] 1.1 Add explicit The Gang undo snapshot allowlist
- [x] 1.2 Wrap The Gang Board with shared `UndoProvider`
- [x] 1.3 Add runtime test coverage for undo state provisioning
- [x] 1.4 Update The Gang capability-alignment docs

## 2. Verification
- [x] 2.1 `openspec validate add-the-gang-undo-ui --strict --no-interactive`
- [x] 2.2 `npx vitest run src/games/the-gang --configLoader native`
- [x] 2.3 `npx eslint src/games/the-gang --ext .ts,.tsx`
- [x] 2.4 `npm run typecheck`
