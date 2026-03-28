## Context
- 当前 `LogSystem` 记录 command/event，但为调试/音效用途，非玩家日志。
- `UndoSystem` 支持快照撤回，默认最大快照数为 50（游戏可覆盖）。
- 通用卡牌定义已有 `assets.image/atlasIndex` 字段，可用于卡牌预览。

## Goals / Non-Goals
### Goals
- 只记录玩家可见的“领域行为”，日志不持久化。
- 日志与撤回共享同一 allowlist，确保“可撤回 == 可记录”。
- 默认单步撤回（maxSnapshots=1）。
- 卡牌预览仅依赖卡牌定义的图片属性（无侵入）。
- 日志随撤回回滚，不额外兼容。

### Non-Goals
- 不做完整回放系统。
- 不记录私有信息（手牌/隐藏资源）。
- 不新增外部存储或历史查询 API。

## Decisions
1. **新增 ActionLogSystem**
   - 存储于 `G.sys.actionLog.entries`，跟随对局状态。
   - 默认 `maxEntries=50`，超出按 FIFO 清理。

2. **独立 allowlist（规范更新）**
   - 游戏定义两个独立白名单：`ACTION_ALLOWLIST`（操作日志用）和 `UNDO_ALLOWLIST`（撤回快照用）。
   - `ACTION_ALLOWLIST` 传给 `ActionLogSystem.commandAllowlist`，记录所有有意义的玩家操作（含连锁操作）。
   - `UNDO_ALLOWLIST` 传给 `UndoSystem.snapshotCommandAllowlist`，**只包含玩家主动决策点命令**，连锁/系统命令不产生独立快照。
   - 两者通过同一判定函数过滤（含默认过滤：`SYS_`/`CHEAT_`/`UI_`/`DEV_`）。
   - 详见 `docs/architecture.md` §5.5「白名单拆分规范」。

3. **单步撤回默认值**
   - `UndoSystem` 默认 `maxSnapshots=1`，允许配置覆盖。

4. **日志回滚**
   - ActionLog 存在于快照，撤回直接回滚日志（无额外补丁逻辑）。

5. **卡牌预览片段**
   - 日志条目可包含 `card` 片段，仅引用卡牌定义的 `assets.image` 或 `assets.atlasIndex`。
   - 若卡牌缺少对应资源，视为数据架构问题，必须补齐定义；不提供降级预览实现。

6. **GameHUD 入口**
   - 在 FabMenu 中增加“操作日志”入口。
   - 日志列表以文本 + 卡牌链接片段展示；hover 时展示图片或说明。

## Data Model
- `ActionLogState`：`{ entries: ActionLogEntry[]; maxEntries: number }`
- `ActionLogEntry`：`{ id, timestamp, actorId, kind, segments }`
- `ActionLogSegment`：`text` / `card`
  - `card` 片段携带 `{ cardId, assetRef, previewText? }`

## Risks / Trade-offs
- 日志增加对局状态体积 → 通过 `maxEntries=50` 控制。
- 卡牌资源缺失会阻塞预览 → 需补齐卡牌定义数据。
- allowlist 过窄会导致公开行为缺失，需要在游戏规则层明确取舍。

## Migration Plan
- 引擎新增 ActionLogSystem 与类型。
- `UndoSystem` 默认单步撤回（仍可配置）。
- 游戏配置共享 allowlist；必要时补齐卡牌资源字段。
- GameHUD 增加日志入口与展示。
