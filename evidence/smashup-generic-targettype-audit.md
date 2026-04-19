# SmashUp `generic` / `player` / `button` targetType 审计记录

## 目标

在 `Board.tsx` 已完成 hand/base/minion/ongoing/discard_minion 显式分流之后，继续收口 SmashUp 交互语义：

1. 把**纯玩家选择**从 `generic` 中抽出来，升级成显式 `player`；
2. 把**纯按钮/分支选择**从 `generic` 中抽出来，升级成显式 `button`；
3. 让审计同时覆盖 `createSimpleChoice` 和 `resolveOrPrompt`，避免包装调用漏检；
4. 明确哪些 `generic` 仍然是合法保留，而不是“懒得分类”。

## 本轮改动

- 在 `src/engine/systems/InteractionSystem.ts` 中新增 `SimpleChoiceTargetType = 'player' | 'button'`。
- 将 3 个纯玩家选择交互改为显式 `player`：
  - `alien_probe_choose_target`
  - `base_innsmouth_base_choose_player`
  - `trickster_mark_of_sleep`
- 将一批纯按钮/分支选择交互改为显式 `button`：
  - `base_the_asylum`
  - `base_miskatonic_university_base`
  - `special_madness`
  - `elder_thing_elder_thing_choice`
  - `elder_thing_shoggoth_opponent`
  - `elder_thing_mi_go`
  - `wizard_neophyte`
  - `zombie_walker`
  - `innsmouth_recruitment`
  - `innsmouth_mysteries_of_the_deep`
  - `miskatonic_mandatory_reading_draw`
  - `miskatonic_psychologist`
  - `miskatonic_researcher`
- 扩展 `src/games/smashup/__tests__/helpers/simpleChoiceAst.ts`：
  - `resolveOrPrompt(...)` 现在和 `createSimpleChoice(...)` 一样进入静态审计；
  - `interactionTargetTypeAudit` 与 `interactionDisplayModeAudit` 共用同一入口。
- 在 `src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts` 中新增：
  - 纯玩家选择必须显式声明 `player`
  - 纯按钮/分支选择必须显式声明 `button`
- 给新纳入审计范围的合法 `generic` 补登记理由：
  - `bear_cavalry_bear_necessities`
  - `vampire_crack_of_dusk`
- `miskatonic_mandatory_reading_draw` 额外做了兼容收口：运行态改走 `continuationContext`，同时保留对旧 payload 形状的兼容读取，避免直接调用 handler 的测试/历史状态回归。

## 验证命令

```bash
npx tsc --noEmit
npx vitest run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --pool threads --maxWorkers 1
npx vitest run src/games/smashup/__tests__/interactionDisplayModeAudit.test.ts --config vitest.config.audit.ts --pool threads --maxWorkers 1
npx vitest run src/games/smashup/__tests__/alien-probe-bug.test.ts src/games/smashup/__tests__/baseFactionOngoing.test.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts --pool threads --maxWorkers 1
npx vitest run src/games/smashup/__tests__/interactionDisplayModeAudit.test.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts src/games/smashup/__tests__/expansionOngoing.test.ts src/games/smashup/__tests__/madnessAbilities.test.ts src/games/smashup/__tests__/factionAbilities.test.ts src/games/smashup/__tests__/zombieWizardAbilities.test.ts src/games/smashup/__tests__/newOngoingAbilities.test.ts src/games/smashup/__tests__/elderThingAbilities.test.ts --pool threads --maxWorkers 1
```

## 当前已明确拆出的显式语义

### `player`

以下交互现在不再混用 `generic`，而是明确声明为“玩家选择”：

- `alien_probe_choose_target`
- `base_innsmouth_base_choose_player`
- `trickster_mark_of_sleep`

这类交互的共同特征是：候选项只表达“选哪个玩家”，不携带卡牌、基地、随从等额外实体语义。

### `button`

以下交互现在不再混用 `generic`，而是明确声明为“纯按钮/分支选择”：

- `base_the_asylum`
- `base_miskatonic_university_base`
- `special_madness`
- `elder_thing_elder_thing_choice`
- `elder_thing_shoggoth_opponent`
- `elder_thing_mi_go`
- `wizard_neophyte`
- `zombie_walker`
- `innsmouth_recruitment`
- `innsmouth_mysteries_of_the_deep`
- `miskatonic_mandatory_reading_draw`
- `miskatonic_psychologist`
- `miskatonic_researcher`

这类交互的共同特征是：候选项表达的是“选哪个处理分支 / 数量 / 来源按钮”，而不是点击某个实体目标。

## 当前保留 `generic` 的合法类型

### 1. 抽象分支 / 数值选择

- 纯数量选择：`giant_ant_under_pressure_choose_amount`、`giant_ant_we_are_the_champions_choose_amount`
- 仍非按钮化的抽象模式选择：`elder_thing_begin_the_summoning`

### 2. 非棋盘卡池 / 静态快照选择

- 弃牌堆 / 牌库卡面：`zombie_grave_digger`、`zombie_grave_robbing`、`steampunk_scrap_diving`、`cthulhu_servitor`
- 多选 discard / hand 卡面：`cthulhu_recruit_by_force`、`cthulhu_it_begins_again`、`cthulhu_madness_unleashed`、`robot_microbot_reclaimer`、`zombie_lend_a_hand`
- 牌库搜索 / 揭示卡面：`killer_plant_sprout_search`、`killer_plant_venus_man_trap_search`、`wizard_scry`、`base_greenhouse`
- 弃牌堆静态快照：`vampire_crack_of_dusk`、`ghost_across_the_divide`
- 计分后快照：`giant_ant_we_are_the_champions_choose_snapshot_source`
- 排序类：`wizard_portal_order`

### 3. 复合维度选择

- 基地 + 玩家：`pirate_broadside`
- 玩家 + 卡牌：`alien_probe`、`base_innsmouth_base_choose_card`
- 随从 + 持续行动混合目标：`bear_cavalry_bear_necessities`

### 4. 规则上下文 / 特殊资源语义

- `wizard_mass_enchantment`
- `steampunk_mechanic`
- `trickster_block_the_path`
- `miskatonic_book_of_iter_the_unseen`
- `innsmouth_spreading_the_word`
- `alien_terraform_choose_replacement`
- `ghost_across_the_divide`

## 结论

当前 SmashUp 的交互语义收口到四层：

1. **运行时显式分流**：`Board.tsx` 只接手真正的 hand/base/minion/ongoing/discard_minion 直点。
2. **显式玩家语义**：纯“选玩家”交互不再挤在 `generic` 里，而是单独声明 `player`。
3. **显式按钮语义**：纯“选分支/数量/来源按钮”交互不再挤在 `generic` 里，而是单独声明 `button`。
4. **静态审计兜底**：
   - 纯直点必须声明正确 `targetType`
   - 纯玩家选择必须声明 `targetType: 'player'`
   - 纯按钮/分支选择必须声明 `targetType: 'button'`
   - 单选 hand 直选必须显式声明 `_source: 'hand'`
   - 所有 `generic` 都必须登记保留理由
   - `resolveOrPrompt` 不再绕过审计

## 后续优先项

下一轮最值得继续拆语义的，仍是“规则标识 / 静态卡池 / 复合卡面型 `generic`”：

- `steampunk_mechanic`
- `trickster_block_the_path`
- `ghost_across_the_divide`
- `innsmouth_spreading_the_word`
- `base_innsmouth_base_choose_card`

这批不是错误用法，但已经足够集中，适合后续进一步评估是否值得提炼成新的跨游戏显式语义（例如派系选择、卡名选择、静态卡池选择等）。
