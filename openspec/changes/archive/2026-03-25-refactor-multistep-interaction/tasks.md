## 1. 引擎交互模型
- [x] 1.1 在 `InteractionSystem.ts` 中新增 `MultistepChoiceData`、`createMultistepChoice`、`asMultistepChoice`
- [x] 1.2 新增 `src/engine/systems/MultistepChoiceSystem.ts`
- [x] 1.3 在 `src/engine/systems/index.ts` 中导出 multistep 相关 API

## 2. UI 本地状态消费
- [x] 2.1 新增 `src/engine/systems/useMultistepInteraction.ts`
- [x] 2.2 为 Hook 补齐 `step / confirm / cancel / auto-confirm / getCompletedSteps` 覆盖测试

## 3. DiceThrone 迁移
- [x] 3.1 将骰子修改类交互迁移为 `multistep-choice`
- [x] 3.2 将选骰重掷类交互迁移为 `multistep-choice`
- [x] 3.3 删除旧的 UI 本地骰子预览补丁状态与 `_diceModCount` 计数器
- [x] 3.4 保留状态选择类 `dt:card-interaction`，不与骰子交互混用

## 4. 兼容与补偿
- [x] 4.1 在客户端通过 `meta` 补水 `localReducer` / `toCommands`
- [x] 4.2 在无 React 的测试/引擎路径中补足 auto-confirm 语义
- [x] 4.3 将 `createMultistepChoiceSystem()` 接入各游戏系统数组

## 5. 验证与收口
- [x] 5.1 保留并扩展引擎层 multistep Hook 测试
- [x] 5.2 保留并扩展 DiceThrone 的 multistep / interaction lock / undo 相关测试
- [x] 5.3 修正 change 文档到真实现状，准备归档
