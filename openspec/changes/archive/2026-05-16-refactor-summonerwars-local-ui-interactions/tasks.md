## 1. 方案与设计
- [x] 1.1 盘点 Summoner Wars 当前所有“等待玩家输入”本地 mode，并按来源分组（领域事件触发 / 事件卡多步骤 / after-attack / after-move / active-event）
- [x] 1.2 明确哪些交互迁移为 `simple-choice`，哪些迁移为 `multistep-choice`，以及每条链路的取消/跳过/确认语义
- [x] 1.3 明确 `playerView` 隐藏、AI 可见性、真人保护门禁与 watchdog 配合边界

## 2. 领域与引擎实现
- [x] 2.1 将 AI 关键的领域事件后续交互改为引擎交互创建（不再只靠 UI `setMode`）
- [x] 2.2 迁移 Summoner Wars 的本地多步选择链路到 `InteractionSystem` / `useMultistepInteraction`
  - 2026-04-17 第一批已完成：`useEventCardModes` 中 `event_target` / `funeral_pyre` / `mind_control` / `hypnotic_lure` / `chant_entanglement` 改为直接从当前 `simple-choice` 交互派生 presenter，移除对应本地真相源
  - 2026-04-18 第二批已完成：`magic_event_choice` / `stun` / `withdraw` / `after_attack_*` / `telekinesis_*` 改为系统态优先；`before_attack_*`、`on_phase_start_*`、`after_move_*` 改为 `Board` 侧 `swInteraction -> abilityMode` 派生优先，不再先桥接出整份本地 `abilityMode`
  - 2026-04-18 事件卡多步 presenter 已完成系统态优先：`blood_summon` / `annihilate` / `sneak` / `glacial_shift` 现由当前交互派生 presenter；本地仅保留必要 fallback / 选择缓存
  - 2026-04-18 第三批已完成：`ice_ram_target` / `ice_ram_push` / `fire_sacrifice_summon` 的点击链路改为系统交互优先（`INTERACTION_RESPOND`），避免落回旧 `ACTIVATE_ABILITY` 本地分支
  - 2026-04-18 Phase B 收口口径：已完成“系统交互优先 + 去双轨真相源 + 代表链路动态验证”，满足 Phase B 验收目标
  - 后续独立变更（Phase C）：`blood_summon` / `annihilate` / `sneak` / `glacial_shift` / `revive_undead` 的真正 `multistep-choice` 通用抽象
- [x] 2.3 清理已被引擎交互替代的本地 UI 状态机职责，避免双轨真相源
- [x] 2.4 更新 `ai.ts`，确保 AI 能消费新交互并在无解时走合法 cancel/skip/pass

## 3. 验证与审计
- [x] 3.1 补充/更新最相关的 Vitest 用例，验证 AI 能看到并解决这些交互
- [x] 3.2 覆盖 hidden interaction / 真人不受影响 / 无解交互可收口 / 交互链不重触发
  - 已有：transport / watchdog / stale-seat 在线房覆盖 hidden interaction、真人保护、emergency skip
  - 2026-04-18 已补 Summoner Wars 专属 owner/guest 可见性 UI 证据：`structure_shift` / `holy_arrow` / `blood_rune`
  - 2026-04-18 已补 Phase B 代表链路 cancel/skip 闭环：`holy_arrow skip`、`ice_ram skip`（单测）
  - 2026-04-18 已补代表链路不重触发回归：`ice_ram` 系统交互单测
- [x] 3.3 回写 `evidence/summonerwars/` 与 `evidence/engine/` 审计文档
- [x] 3.4 运行 `openspec validate refactor-summonerwars-local-ui-interactions --strict --no-interactive`
