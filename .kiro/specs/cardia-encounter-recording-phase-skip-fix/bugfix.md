# Bugfix Requirements Document

## Introduction

本文档描述 Cardia 游戏中遭遇记录丢失与阶段跳过的 bug 修复需求。该 bug 导致游戏进行几次遭遇后，新的遭遇不再被记录到 `encounterHistory` 数组中，同时阶段流程出现异常（从 play 阶段直接跳回 play 阶段，跳过了 ability 和 end 阶段）。

该 bug 影响游戏的核心机制，导致：
- 遭遇历史记录不完整，影响依赖空间关系的能力（如顾问、调停者）
- 阶段流程混乱，玩家无法正常激活能力和进行回合结束流程
- 游戏状态不同步（`sys.turnNumber` 与 `core.turnNumber` 不一致）

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 游戏进行几次遭遇后 THEN 新的遭遇不再被添加到 `core.encounterHistory` 数组中

1.2 WHEN 遭遇战解析完成后 THEN 阶段从 play 直接跳回 play，跳过了 ability 和 end 阶段

1.3 WHEN 阶段流程异常时 THEN `sys.turnNumber` 保持为 0，而 `core.turnNumber` 正常递增，导致状态不同步

1.4 WHEN 遭遇战解析时 THEN `ENCOUNTER_RESOLVED` 事件可能未被正确发射或处理

### Expected Behavior (Correct)

2.1 WHEN 每次遭遇战解析完成后 THEN 该遭遇必须被添加到 `core.encounterHistory` 数组中

2.2 WHEN 遭遇战解析完成后 THEN 阶段必须按照 play → ability → end → play 的顺序正确流转

2.3 WHEN 阶段流程正常时 THEN `sys.turnNumber` 和 `core.turnNumber` 必须保持同步

2.4 WHEN 遭遇战解析时 THEN `ENCOUNTER_RESOLVED` 事件必须被正确发射，并由 `reduceEncounterResolved` 处理以更新 `encounterHistory`

2.5 WHEN 平局发生时（原始判定为平局，不考虑审判官等持续能力）THEN 必须跳过 ability 阶段，直接执行回合结束逻辑（抽牌、回合结束事件、推进到下一回合）

2.6 WHEN 有胜负的遭遇解析后 THEN FlowSystem 必须自动检测 `currentEncounter.loserId` 并推进到 ability 阶段

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 遭遇战有明确胜负时 THEN 失败者必须能够在 ability 阶段激活能力

3.2 WHEN 玩家跳过能力或能力执行完成后 THEN 必须正确推进到 end 阶段

3.3 WHEN 回合结束阶段完成后 THEN 双方玩家必须各抽 1 张牌

3.4 WHEN 持续能力（如审判官、调停者）影响遭遇结果时 THEN 必须正确应用这些效果

3.5 WHEN 修正标记添加到已完成的遭遇中的卡牌时 THEN 必须触发状态回溯，重新计算影响力和遭遇结果

3.6 WHEN 交互系统有待处理的交互时 THEN FlowSystem 不得自动推进阶段
