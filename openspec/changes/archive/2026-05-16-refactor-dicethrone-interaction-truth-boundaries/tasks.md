## 1. Spec
- [x] 1.1 为 `interaction-system` 增加“交互语义唯一边界”与“专用 defender choice”约束
- [x] 1.2 为 `manage-modals` 增加“阻塞前台默认走 modal stack”约束

## 2. DiceThrone Interaction Refactor
- [x] 2.1 从 targetingRoll 中拆出专用 defender-choice 请求/解决链路
- [x] 2.2 让 `useCurrentChoice()` 只服务真正的 simple-choice，并为 defender-choice 增加专用 UI 读取入口
- [x] 2.3 为 defender-choice 增加专用 modal，而不是复用 ChoiceModal

## 3. Blocking Foreground Ownership
- [x] 3.1 将 `compare-roll-choice` 前台改为 modal stack entry
- [x] 3.2 将非 `displayOnly` 的 `dt:bonus-dice` 前台改为 modal stack entry
- [x] 3.3 保留纯展示 bonus die 为 overlay，并清理重复前台渲染

## 4. Verification
- [x] 4.1 更新 DiceThrone 现有测试，覆盖 targetingRoll 不再走 simple-choice
- [x] 4.2 更新 DiceThrone 现有测试，覆盖阻塞 bonus/compare 进入 modal stack
- [x] 4.3 更新通用规范文档并补充证据
