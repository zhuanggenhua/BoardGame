# Design: Summoner Wars InteractionSystem Migration

## Scope（本次迁移）
**事件驱动且需要玩家选择/确认的交互**：
1. `SUMMON_FROM_DISCARD_REQUESTED`（感染：从弃牌堆选卡召唤）
2. `GRAB_FOLLOW_REQUESTED`（抓附跟随：选择跟随位置）
3. `SOUL_TRANSFER_REQUESTED`（灵魂转移：确认/跳过）
4. `MIND_CAPTURE_REQUESTED`（心灵捕获：控制 vs 伤害二选一）
5. `ABILITY_TRIGGERED` 中 `ice_shards_damage`（寒冰碎屑确认）
6. `ABILITY_TRIGGERED` 中 `feed_beast_check`（喂养巨食兽强制选择）

> 其他本地 abilityMode（如 afterMove 链、telekinesis 等）不在本次强制迁移范围，后续单独扩展。

## Interaction 映射（建议）

### 1) 感染（Summon From Discard）
- **类型**：`simple-choice`
- **选项**：可用弃牌堆卡牌（plague zombie）
- **响应**：`SYS_INTERACTION_RESPOND` → `SW_COMMANDS.ACTIVATE_ABILITY`（abilityId: infection, targetCardId, targetPosition）
- **无可选**：不创建交互，直接跳过

### 2) 抓附跟随（Grab Follow）
- **类型**：`simple-choice`
- **选项**：移动后单位相邻空格（可用位置）
- **响应**：`SW_COMMANDS.ACTIVATE_ABILITY`（abilityId: grab, targetPosition）
- **无可选**：不创建交互，直接跳过

### 3) 灵魂转移（Soul Transfer）
- **类型**：`simple-choice`
- **选项**：confirm / skip
- **响应**：confirm → `SW_COMMANDS.ACTIVATE_ABILITY`（abilityId: soul_transfer）
- **响应**：skip → `SW_COMMANDS.ACTIVATE_ABILITY`（abilityId: soul_transfer, skip: true）或专用取消分支

### 4) 心灵捕获（Mind Capture）
- **类型**：`simple-choice`
- **选项**：control / damage
- **响应**：`SW_COMMANDS.ACTIVATE_ABILITY`（abilityId: mind_capture_resolve, choice: control|damage）

### 5) 寒冰碎屑（Ice Shards）
- **类型**：`simple-choice`
- **选项**：confirm / skip
- **响应**：confirm → `SW_COMMANDS.ACTIVATE_ABILITY`（abilityId: ice_shards, targetUnitId）
- **响应**：skip → `SW_COMMANDS.ACTIVATE_ABILITY`（abilityId: ice_shards, skip: true）

### 6) 喂养巨食兽（Feed Beast）
- **类型**：`simple-choice`
- **选项**：相邻友方单位（必须选）或“自毁”选项（如果规则允许）
- **响应**：`SW_COMMANDS.ACTIVATE_ABILITY`（abilityId: feed_beast, targetUnitId / selfDestruct）
- **强制性**：交互创建时必须保证至少 1 个合法选项

## UI 迁移原则
- `useGameEvents` 只负责把事件转为交互（或由系统层直接创建交互），不再 set 本地 mode 作为真相。
- UI 通过 InteractionSystem 描述渲染：
  - 简单选择 → `sys.interaction.current.kind === 'simple-choice'`
  - 多步选择 → `useMultistepInteraction`
- `useIsInteractionBusy` 作为交互阻塞唯一来源。

## 风险控制
- 所有交互仅对 owner 可见（`playerView` 过滤）。
- 创建交互前必须判空；无解直接跳过，不允许空 options。
- 对强制交互（feed_beast）必须确保存在收口命令。
