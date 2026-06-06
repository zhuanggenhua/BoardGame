# Design: Summoner Wars 本地 UI 交互迁移到 InteractionSystem

## 背景
Summoner Wars 当前存在两类“等待玩家输入”路径：
1. 领域事件触发后，`useGameEvents` / `StatusBanners` / `useCellInteraction` 在客户端本地创建 mode（如 `soulTransferMode`、`mindCaptureMode`、`grabFollowMode`、`abilityMode`）
2. 事件卡与技能多步骤选择由 `useEventCardModes` / `abilityMode` 维护本地状态，再组合多个 `PLAY_EVENT` / `ACTIVATE_ABILITY` / `DECLARE_ATTACK` 命令

这些状态不进入 `sys.interaction`，结果是：
- AI 无法从 sharedState / playerView 读取真实待处理交互
- hidden interaction 与本地 mode 形成双轨
- watchdog 只能粗暴止血，不能沿正确交互链闭环

## 设计目标
1. **引擎拥有交互真相源**：所有“等待玩家输入”的状态进入 `sys.interaction`
2. **真人/AI 共用同一交互入口**：UI 与 AI 都消费同一交互描述符，不再各自维护一套真值
3. **先迁移 AI 卡死关键链路，再扩展到其余本地多步骤模式**
4. **不误伤真人**：response-window / active turn / hidden interaction 的真人保护保持不变

## 迁移分层

### Phase A：AI 卡死关键链路（优先）
- `SUMMON_FROM_DISCARD_REQUESTED`（感染）
- `GRAB_FOLLOW_REQUESTED`（抓附跟随）
- `SOUL_TRANSFER_REQUESTED`（灵魂转移）
- `MIND_CAPTURE_REQUESTED`（心灵捕获）
- `ABILITY_TRIGGERED(actionId=ice_shards_damage)`
- `ABILITY_TRIGGERED(actionId=feed_beast_check)`

这些链路的共同特征：
- 由领域事件触发
- 玩家必须/可选完成后续决策
- 当前仅在前端本地 mode 中可见
- 最直接影响 AI 可解性与 watchdog 诊断

### Phase B：本地多步骤技能 / 事件卡链路（逐步）
- `afterAttackAbilityMode`
- `rapidFireMode`
- `withdrawMode`
- `telekinesisTargetMode`
- `eventTargetMode`
- `bloodSummonMode`
- `annihilateMode`
- `mindControlMode`
- `stunMode`
- `hypnoticLureMode`
- `chantEntanglementMode`
- `sneakMode`
- `glacialShiftMode`
- 仍然由 `abilityMode` 驱动的多步技能选择

## 剩余本地等待态分组（2026-04-17 盘点）

### A. 事件卡 presenter / 交互镜像
这些链路引擎侧已经创建了 `sys.interaction`，但 UI 仍在 `useEventCardModes` / `StatusBanners` / `Board` 再镜像一份本地 mode：
- `eventTargetMode`
- `funeralPyreMode`
- `mindControlMode`
- `stunMode`
- `hypnoticLureMode`
- `chantEntanglementMode`
- `withdrawMode`
- `telekinesisTargetMode`
- `afterAttackAbilityMode`

### B. 事件卡复杂累计结果
这些链路仍由本地 mode 保存跨步累计结果，后续最值得抽象为通用多步交互：
- `bloodSummonMode`
- `annihilateMode`
- `sneakMode`
- `glacialShiftMode`

### C. 技能与事件流桥接态
这些状态仍在 `useGameEvents` / `useCellInteraction` 承担“等待玩家输入”职责，不只是展示：
- `abilityMode`
- `pendingBeforeAttack`
- `fireSacrificeSummonMode`
- `rapidFireMode`
- `magicEventChoiceMode`

### D. 不纳入本轮 Phase B 的 phase-local UI 态
这些状态是本地 UI 便利态，但不是 hidden interaction 双轨根因：
- `selectedCardsForDiscard`
- `endPhaseConfirmPending`

## 交互建模原则

### 1. simple-choice
适用于：
- 单步确认/跳过
- 单步位置选择
- 单步单位选择
- 固定数量较小的选项（如“控制/伤害”、“确认/跳过”）

建议 data 结构：
- `title` / `subtitle`
- `options[]`（携带 command 所需 value）
- `targetType`（`button` / `minion` / `generic`）
- `sourceId`
- `autoResolveIfSingle`（只用于真正强制效果）

当前应优先保留/收敛为 `simple-choice` 的链路：
- 单步目标/卡牌/确认：`eventTarget`、`funeral_pyre`、`hypnotic_lure`、`magic_event_choice`
- 固定两步、每一步都可单独排队：`stun`、`withdraw`、`after_attack_telekinesis_*`、`ice_ram_*`、`telekinesis_instead_*`
- 固定多选但本质仍是一次提交：`mind_control`、`chant_entanglement`、`blood_rune`、`before_attack_holy_arrow`、`before_attack_healing`
- 已由领域侧排好 step meta 的阶段/移动后能力：`on_phase_start_illusion`、`on_phase_start_blood_rune`、`after_move_spirit_bond`、`after_move_ancestral_bond`、`after_move_structure_shift_*`、`after_move_frost_axe`

### 2. multistep-choice
适用于：
- 需要先选目标，再选位置/方向/卡牌的链路
- 需要保留本地中间进度，但最终由一次确认生成业务命令
- 需要 AI 读取“当前已经走到哪一步”

建议 data 结构：
- `presentation.kind`（如 `sw:board-sequence`）
- `steps[]`（每步类型：unit/position/card/confirm）
- `initialResult`
- `localReducer`
- `canConfirm`
- `toCommands`
- `sourceId`

当前更值得抽为 `multistep-choice` 的链路：
- `blood_summon`
- `annihilate`
- `sneak`
- `glacial_shift`
- `revive_undead`

这些链路的共同点是：本地现在既负责展示当前 step，也负责保存跨步累计结果，如 `completedCount`、`selectedTargets`、`currentTargetIndex`、`damageTargets`、`recorded`。

## Phase B 批次顺序

### Batch 1：先清掉 simple-choice 镜像
优先把以下链路改为“直接由当前交互派生 presenter，不再各自持有本地真相源”：
- `magicEventChoiceMode`
- `eventTargetMode`
- `funeralPyreMode`
- `hypnoticLureMode`
- `stunMode`
- `withdrawMode`
- `afterAttackAbilityMode`
- `telekinesisTargetMode`
- `mindControlMode`
- `chantEntanglementMode`

> 2026-04-18 进展：上述 Batch 1 链路已改成“系统态优先 presenter”；其中 `withdrawMode` / `telekinesisTargetMode` 仍保留本地 fallback，但当前 `simple-choice` 存在时一律以交互元数据派生为准。

### Batch 2：再拆掉事件流/技能桥接态
- `before_attack_*`
- `on_phase_start_illusion`
- `on_phase_start_blood_rune`
- `after_move_spirit_bond`
- `after_move_ancestral_bond`
- `after_move_structure_shift_*`
- `after_move_frost_axe`
- `ice_ram_*`
- `fire_sacrifice_summon`

> 2026-04-18 进展：`before_attack_*`、`on_phase_start_*`、`after_move_*` 已改成 `Board` 侧 `swInteraction -> abilityMode` 派生优先；`useGameEvents` 仅保留无交互 fallback，不再是这些链路的首要真相源。当前 Batch 2 主要剩余 `ice_ram_*` 与 `fire_sacrifice_summon`。

### Batch 3：最后抽公共复杂多步交互（移交 Phase C）
- `blood_summon`
- `annihilate`
- `sneak`
- `glacial_shift`
- `revive_undead`

> 2026-04-18 收口说明：Phase B 的验收目标是“移除本地等待态真相源、以 `sys.interaction` 为单一交互入口、补齐 owner/guest 可见性与 cancel/skip/不重触发证据”。该目标已达成。上述 Batch 3 属于进一步的通用抽象优化，迁移到后续独立变更（Phase C）执行，不再阻塞 Phase B 关闭。

## 风险与缓解

### 风险 1：本地 mode 与引擎交互双轨并存
- **风险**：UI 仍读旧 mode，AI 读新 interaction，产生双真相源
- **缓解**：每迁移一条链路，就删除对应 mode 的“等待玩家输入”职责，仅保留纯展示状态

### 风险 2：隐藏信息泄露
- **风险**：把原本只在本地看见的目标/手牌候选暴露给对手
- **缓解**：交互描述符严格通过 `playerView` 过滤；需要隐藏的 value 只对 owner 可见

### 风险 3：迁移后出现空选项/无解交互
- **风险**：InteractionSystem 接入不完整导致新卡死
- **缓解**：每条交互必须显式声明 cancel/skip/done/autoResolve 语义，并补 AI 无解测试

### 风险 4：response-window / phase-halt 与新交互冲突
- **风险**：同一时刻既有响应窗口又有新交互，造成门禁冲突
- **缓解**：遵循现有 InteractionSystem/ResponseWindowSystem 锁语义；不新增旁路 UI 状态机

## 验证策略
- Summoner Wars 最相关现有测试文件内补用例，不新建散乱测试文件
- 覆盖：
  - AI 能从 `sys.interaction` 看见并解决交互
  - hidden interaction 仅 owner 可见，但服务端/AI seat 可诊断
  - human responder / human active turn 不被 AI 恢复逻辑误伤
  - 无解选项可 cancel/skip，不会卡死
- 当前已确认的边界：
  - `hidden interaction` 在 transport / watchdog / stale-seat 在线房链路已有覆盖，但还缺一条 Summoner Wars 专属的“owner 看得到、guest 看不到”UI 级证据
  - 真人不受 AI watchdog 误伤已有 transport + 在线房证据
  - 无解交互可通过 `skip/pass/emergency skip` 收口已有引擎级证据，但还缺一条 Phase B 代表链路的 cancel/skip 直测
  - `Phase B` 运行时“链不重触发”已有局部去重证据，但还缺一条代表链路的闭环回归
- 回写 `evidence/summonerwars/` 与 `evidence/engine/`
