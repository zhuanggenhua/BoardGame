# Change: 引擎层通用流程系统 (FlowSystem)

## Why
当前 DiceThrone 的阶段逻辑（TurnPhase、getNextPhase、canAdvancePhase）是游戏层硬编码，引擎层无法复用。为支持 UGC 游戏自定义阶段流程，需要在引擎层新增通用的 FlowSystem。

## What Changes
- **引擎层新增 FlowSystem**：管理阶段推进、事件分发、hook 调度
- **`sys.phase` 成为单一权威**：移除 `core.turnPhase`，所有阶段读写统一到 `sys.phase`
- **游戏层提供 FlowHooks**：`canAdvance`、`getNextPhase`、`onPhaseEnter`、`onPhaseExit`
- **统一 ADVANCE_PHASE 命令**：由 FlowSystem 处理，游戏逻辑通过 hook 介入
- **DiceThrone 迁移**：将现有阶段逻辑迁移为 FlowHooks 实现

## Impact
- Affected specs: 无现有 spec（新增 flow-system）
- Affected code:
  - `src/engine/types.ts` - SystemState.phase 类型增强
  - `src/engine/systems/` - 新增 FlowSystem
  - `src/games/dicethrone/domain/` - 迁移 turnPhase 到 sys.phase
  - `src/games/dicethrone/hooks/` - UI 读取 sys.phase
  - `src/games/dicethrone/ui/` - PhaseIndicator 等组件
