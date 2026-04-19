## 1. Implementation
- [ ] 1.1 为“弹窗内弹窗”建立统一模式：子弹窗通过 `useModalStack.openModal` 打开（记录 modalId 并在关闭时清理）。
- [ ] 1.2 重构 `GameDetailsModal` 的私密房密码弹窗：从 sibling 渲染改为栈打开。
- [ ] 1.3 移除 `PasswordEntryModal` 的临时 z-index 偏移（止血代码），回到统一栈语义。
- [ ] 1.4 更新单测：`GameDetailsModalJoinConfirm.test.ts` 断言“加锁房加入”会触发 openModal 打开密码弹窗（并且关闭/确认回调正确）。
- [ ] 1.5 更新 E2E（如需）：确保点击“加入”后密码弹窗在最上层可见、可输入、确认按钮可点击。

## 2. Verification
- [ ] 2.1 `npx eslint` 覆盖改动文件 0 errors。
- [ ] 2.2 相关单测通过（至少包含 join password 的单测）。
- [ ] 2.3 E2E（如执行）提供截图证据路径。
