# Summoner Wars Phase B 增量证据：simple-choice presenter 去镜像

## 范围
- 文件：
  - `src/games/summonerwars/ui/useEventCardModes.ts`
  - `src/games/summonerwars/Board.tsx`
  - `src/games/summonerwars/ui/useGameEvents.ts`
- OpenSpec：`openspec/changes/refactor-summonerwars-local-ui-interactions/`
- 目标：把已经由 `sys.interaction` 表达的 `simple-choice` 事件卡 / 技能链路，从本地 `useState` / `setAbilityMode` 镜像收回到“直接由当前交互派生 presenter / abilityMode”

## 本轮结论
- `event_target`、`funeral_pyre`、`mind_control_select_targets`、`hypnotic_lure_select_target`、`chant_entanglement_select_targets` 不再各自维护独立本地真相源。
- `mind_control` 与 `chant_entanglement` 仍需要本地“已选项”缓存，但缓存对象改为当前交互的 `optionIds`，不再维护游戏专属 `selectedTargets` 真相源；真正的候选来源仍以 `swInteraction.options` 为准。
- `blood_summon`、`annihilate`、`sneak`、`glacial_shift` 已改成“系统态优先 presenter”：UI 直接从当前交互派生 step / meta / highlights，本地只保留 fallback 或必要的 `optionIds` 选择缓存。
- `before_attack_*`、`on_phase_start_*`、`after_move_*` 已改成 `Board` 侧 `swInteraction -> abilityMode` 派生优先；本地 `abilityMode` 不再是这些链路的首要真相源。
- `useGameEvents` 中那份已经失效的 `afterAttackAbilityMode` 本地状态已删除，避免再次形成第二套真相源。

## 直接证据
- `useEventCardModes` 中已删除以下本地 `useState` 真相源：
  - `eventTargetMode`
  - `funeralPyreMode`
  - `mindControlMode`
  - `hypnoticLureMode`
  - `chantEntanglementMode`
- 上述 mode 现改为从 `swInteraction.type/meta/options` 直接 `useMemo` 派生。
- `mind_control` / `chant_entanglement` 的棋盘点击逻辑改为切换当前交互 `optionId` 选择集，再由确认动作统一发 `RESPOND optionIds`。
- `blood_summon` / `annihilate` / `sneak` / `glacial_shift` 的 presenter 不再依赖 `useEffect` 在交互切换时灌本地 mode，而是由当前 `simple-choice` 的 meta / options 直接派生。
- `before_attack_life_drain` / `before_attack_holy_arrow` / `before_attack_healing` 以及 `on_phase_start_*` / `after_move_*` 这批技能链路，已改为 `Board` 侧系统 abilityMode 优先；本地仅保留 `selectedCardIds` 这类临时 UI 草稿。

## 校验
- 命令：`npm run test -- src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts`
- 结果：通过（83 tests passed）
- 命令：`npm run typecheck`
- 结果：通过
- 命令：`npx eslint src/games/summonerwars/Board.tsx src/games/summonerwars/ui/useEventCardModes.ts src/games/summonerwars/ui/useGameEvents.ts`
- 结果：通过

## 仍未收口的风险
- `ice_ram_*`、`fire_sacrifice_summon` 仍有本地桥接职责，尚未完全收进系统派生优先路线。
- `blood_summon`、`annihilate`、`sneak`、`glacial_shift`、`revive_undead` 仍未抽成真正的 `multistep-choice`，目前只是 presenter 层系统态优先。
- `hidden interaction` 的 Summoner Wars 专属 owner/guest UI 级证据、以及 Phase B 代表链路 cancel/skip / 不重触发回归，仍待补齐。
