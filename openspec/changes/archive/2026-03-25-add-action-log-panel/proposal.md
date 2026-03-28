# Change: 添加操作日志面板

## Why
玩家需要清晰了解对手的公开操作，但当前 `LogSystem` 仅用于调试/音效，不提供玩家可读日志。本变更引入统一的操作日志面板，日志不持久化，随撤回回滚，保证信息一致。

## What Changes
- 新增 `ActionLogSystem`，记录可撤回的领域操作（与撤回共享白名单，保证可撤回操作必然记录）。
- GameHUD 悬浮球新增“操作日志”入口，展示日志面板。
- 日志条目支持卡牌预览片段，预览仅绑定卡牌定义的 `assets.image/atlasIndex`。
- `UndoSystem` 默认仅保留 1 条快照（单步撤回）。
- 操作日志仅存于对局状态，不做持久化。

## Impact
- Affected specs: 新增 `action-log` capability；修改 `undo-system`。
- Affected code:
  - `src/engine/types.ts`（新增 ActionLog 类型）
  - `src/engine/systems/ActionLogSystem.ts`（新系统）
  - `src/engine/systems/UndoSystem.ts`（默认单步撤回）
  - `src/components/game/GameHUD.tsx` + ActionLog Context/Hooks
  - 各游戏配置（共享 allowlist，作为撤回/日志的单一来源）
  - 卡牌定义（补齐 assets 字段）
