## 1. 引擎层实现
- [x] 1.1-1.8 FlowSystem 完整实现
  - FlowHooks 接口（支持 canAdvance/getNextPhase/onPhaseEnter/onPhaseExit）
  - createFlowSystem 工厂函数
  - beforeCommand 处理 ADVANCE_PHASE
  - afterEvents 同步领域层 PHASE_CHANGED 到 sys.phase
  - 导出到 engine/systems/index.ts
  - FLOW_COMMANDS 加入 adapter.ts 系统命令列表

## 2-3. DiceThrone 迁移（方案调整）
- [x] 保留 core.turnPhase（领域层继续使用）
- [x] FlowSystem.afterEvents 自动同步到 sys.phase
- [x] game.ts 添加 FlowSystem（initialPhase: 'upkeep'）

## 4. UI 层迁移
- [x] 4.1 useDiceThroneState.ts 从 sys.phase 读取 turnPhase
- [x] 4.7 Board.tsx 从 access.turnPhase 读取（来自 sys.phase）
- [x] 其他 UI 组件通过 useDiceThroneState 自动使用 sys.phase

## 5. 测试更新
- [x] 5.1 flow.test.ts 34 个测试全部通过
- [x] 5.2 新增 FlowSystem 单元测试（13 个测试通过）
- [x] 5.3 更新 vitest.config.ts 支持引擎层测试

## 6. 清理
- [x] 6.1 PHASE_ORDER 保留（getNextPhase 仍在使用）
- [x] 6.2 core.turnPhase 保留（领域层依赖），UI 层已迁移到 sys.phase
- [x] 6.3 注释已更新
