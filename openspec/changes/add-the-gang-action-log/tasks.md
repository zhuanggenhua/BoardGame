## 0. Approval Gate
- [x] 0.1 Approval Gate：`add-the-gang-action-log` 的 proposal / design / tasks / spec delta 支持基础版完整闭环中的玩家可见公开日志边界：记录选筹码、推进轮次、摊牌结果和下一次抢劫，不泄露隐藏手牌。用户已明确本轮判断口径是“不是所有扩展，而是全部基本功能都能完成”，该能力属于当前基础版玩家可见闭环，因此本 Approval Gate 关闭。

## 1. Implementation
- [x] 1.1 Add The Gang action-log formatter for all public business commands
- [x] 1.2 Wire the formatter into `createBaseSystems` with the undo allowlist
- [x] 1.3 Add zh-CN/en i18n strings for log entries
- [x] 1.4 Add pipeline-level tests proving entries are written and private hand details are not exposed

## 2. Verification
- [x] 2.1 `openspec validate add-the-gang-action-log --strict --no-interactive`
- [x] 2.2 `npx vitest run src/games/the-gang --configLoader native`
- [x] 2.3 `npx eslint src/games/the-gang --ext .ts,.tsx`
