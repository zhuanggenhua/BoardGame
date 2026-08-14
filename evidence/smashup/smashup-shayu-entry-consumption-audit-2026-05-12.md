# SmashUp shayu 第一入口直接消费专项全量审计（2026-05-12）

## 结论边界

- **本轮不是抽样**：这是对 shayu 三派系新增对象的“第一入口是否被 handler 直接消费”专项全量重审。
- **审计问题定性**：此前全量矩阵偏 L1 静态判断，能发现 `playNeedsBase/playNeedsMinion` 与文案错配，但没有逐项证明 handler 是否直接消费第一入口，导致 `mythic_greeks_favor_of_zeus`、`tornados_carried_away` 这类“第一入口已确定但又二次选择同类对象”的问题漏掉。
- **当前完成等级**：本专项达到 **L2 行为验证通过**；本轮额外复跑了 3 条真实入口 E2E，覆盖 `tornados_carried_away` 新入口、`tornados_not_in_kansas` 基地替换、`base_tornado_alley` 首次/二次移入链路，因此这些被复跑链路具备本轮 L3 截图证据。未逐对象新增 E2E 的条目仍不得升级为 L3。
- **通用门禁已补强**：`.spec/knowledge/standards/testing-audit.md` 的交互入口语义矩阵新增最低门禁：如果第一入口已由命令 payload / UI 点击对象确定，handler 必须直接消费该入口；不得再创建同 targetType 的二次选择 prompt。

## 审计方法

逐项核对四件事：

1. 静态入口字段：`playNeedsBase` / `playNeedsMinion` / `ongoingTarget` / `specialNeedsBase` / talent 或 trigger 上下文。
2. 第一用户选择对象：玩家第一下到底选 base、minion、card、button，还是无入口。
3. handler 消费方式：是否直接消费 payload / 当前 source / trigger context；是否错误创建同 targetType 二次 prompt。
4. 行为证据：用 `shayuEntryConsumption.test.ts` 和既有 `shayuFactionAbilities.test.ts` 证明关键入口最终进入正确权威状态。

## 全量对象清单与专项结论

| 对象 | 类型/入口来源 | 第一入口 | handler 消费结论 | 本轮证据等级 |
| --- | --- | --- | --- | --- |
| `sharks_megalodon` | minion onPlay + beforeScoring special | onPlay/计分基地上下文后选择低力量随从 | 无 playNeeds 直接入口；候选由所在基地/计分基地上下文派生，非同类二次 prompt | L1/L2 |
| `sharks_great_white` | talent | 该天赋自身 → 目标基地/低力量随从 | talent source 是自身；后续 prompt 是新语义目标 | L1/L2 |
| `sharks_hammerhead` | ongoing trigger | 被消灭事件 | 无用户第一入口；消费 destroy event | L2 |
| `sharks_mako` | special trigger | 被消灭事件的基地 | 无用户第一入口；消费 destroy event 上下文 | L1 |
| `sharks_blood_in_the_water` | ongoingTarget=base + playNeedsBase | 基地 | 直接附着到 payload 基地，不再二次选择基地 | L2 |
| `sharks_week_of_sharks` | ongoingTarget=base + playNeedsBase | 基地 | 直接附着到 payload 基地，不再二次选择基地 | L2 |
| `sharks_torn_apart` | standard action | 低力量随从 prompt | 无直接 playNeeds 字段；handler 创建 minion prompt 合理 | L2/L3(既有) |
| `sharks_chum` | ongoingTarget=minion + playNeedsMinion | 随从 | 直接附着到 payload 随从，不再二次选择随从 | L2 |
| `sharks_dangerous_waters` | ongoingTarget=base + playNeedsBase + talent | 打出入口是基地；天赋入口是 attached base 上随从 | 打出直接附着基地；天赋 prompt 是新语义随从目标 | L2 |
| `sharks_feeding_frenzy` | playNeedsBase | 基地 | 直接消费 payload 基地；后续 prompt 是该基地低力量随从，不是二次基地 | L2/L3(既有) |
| `sharks_air_jaws` | playNeedsMinion + self | 己方随从 | 直接消费 payload 随从；后续 prompt 是“另一个基地”，不是二次随从 | L2 |
| `sharks_freakin_laser_beam` | playNeedsMinion + self | 己方随从 | 直接消费 payload 随从；后续 prompt 是同基地可消灭目标，不含源随从 | L2 |
| `base_shark_reef` | onMinionDestroyed base ability | destroyer 上下文 | 无用户第一入口；后续选择 destroyer 的己方随从 | L1/L2 |
| `base_the_deep` | onMinionPlayed base ability | played minion/base 上下文 | 无直接 playNeeds；后续选择该基地更低战力随从 | L1/L2 |
| `tornados_monster_tornado` | talent | 该天赋自身上下文 → 低力量随从 | 后续 prompt 是要移动的随从；不是重复选择 source | L2 |
| `tornados_cyclone` | talent | 该天赋自身 | 后续 prompt 只选目标基地；源随从由 talent source 确定 | L2 |
| `tornados_twister` | onPlay minion | 打出随从所在基地上下文 | prompt 选择可移动低力量随从，后续选择目标基地；无重复第一入口 | L2/L3(既有) |
| `tornados_dust_devil` | beforeScoring special | 计分窗口中的自身/计分基地 | special 上下文确定 source；后续选择是否移动到计分基地 | L3/L4(既有) |
| `tornados_trade_winds` | standard action | 第一个随从 prompt | 无 playNeeds 直接入口；多步 prompt 分别携带 first minion/base context | L2 |
| `tornados_carried_away` | playNeedsMinion | 随从 | **已修复**：直接消费 payload 随从；第一个 prompt 现在是目标基地 `tornados_carried_away_dest` | L2 |
| `tornados_whirlwinds` | standard action | 多选己方随从 | 无 playNeeds 直接入口；逐个 destination prompt 携带每个 source uid/base | L2/L3(既有) |
| `tornados_gone_with_the_wind` | specialNeedsBase | 计分基地上下文后选择己方随从 | special base 不是玩家重复选基地；handler 选择随从再选目标基地 | L3/L4(既有) |
| `tornados_ripped_off` | standard action | ongoing 行动/附着对象 prompt | 无 playNeeds 直接入口；handler 选择可移动 ongoing 后再选目标 | L2/L3(既有) |
| `tornados_picked_up` | specialNeedsBase | 被计分基地上下文 | 直接消费 special base；后续选择该基地随从并移动 | L1/L2 |
| `tornados_not_in_kansas` | playNeedsBase | 基地 | 直接消费 payload 基地并替换；**已修复**同一 action 替换基地后误触发新基地 onActionPlayed | L2 |
| `tornados_over_the_rainbow` | specialNeedsBase | 计分基地上下文 | 直接消费计分基地；后续选择其它基地己方随从移入 | L3/L4(既有) |
| `base_trailer_park` | onMinionMoved base ability | moved minion/base event | 无用户入口；直接消费移动事件 | L1/L2 |
| `base_tornado_alley` | onMinionMoved base ability | moved minion/base event 后 optional minion | first event 直接消费；后续 prompt 是“另一个随从”新语义目标 | L3(既有) |
| `mythic_greeks_odysseus` | onActionPlayed trigger | action played context → 己方随从 | 无直接 playNeeds；后续 minion prompt 是能力目标 | L2 |
| `mythic_greeks_argonaut` | onPlay + special | 打出自身/行动触发上下文 | action-trigger/special 代表链已有；跨派系泛化仍是残余专项，不作为本轮完成项扩大 | L2/L3(既有代表链) |
| `mythic_greeks_jason` | onActionPlayed trigger | action played context → 基地 | 无 playNeeds 直接入口；base prompt 是能力第一目标 | L1/L2 |
| `mythic_greeks_heracles` | onActionPlayed trigger | action played context | 无用户入口；直接消费 trigger source | L2 |
| `mythic_greeks_spartan` | onActionPlayed trigger | action played context | 无用户入口；直接消费 trigger source 与 once/turn metadata | L2 |
| `mythic_greeks_favor_of_hades` | standard action | 弃牌区行动卡 | 无 playNeeds；handler 创建 discard-card prompt 合理 | L1 |
| `mythic_greeks_favor_of_ares` | playNeedsMinion + self | 己方随从 | 直接消费 payload 随从并 +3，不再二次选择随从 | L2 |
| `mythic_greeks_favor_of_aphrodite` | standard no target | 无目标按钮 | 无 interaction；直接写额外随从额度 | L1 |
| `mythic_greeks_favor_of_dionysus` | playNeedsMinion + self | 己方随从 | 直接消费 payload 随从；后续 optional 回顶 prompt 是新语义 | L2 |
| `mythic_greeks_favor_of_hera` | standard action | 至多两个任意随从多选 | 2026-06-04 已按 `temp/smashup-hera-card-crop-20260604-r5c8/slot-33.webp` 回写旧“己方随从”误判；无 playNeeds；multi prompt 是能力第一目标，skip/数量语义存在 | L2/L3(已更新) |
| `mythic_greeks_favor_of_athena` | standard action | 顶牌行动选择/排序 | 无 playNeeds；deck reveal snapshot 携带上下文 | L2 |
| `mythic_greeks_favor_of_apollo` | standard no target | 无目标按钮 | 无 interaction；抽牌 + 额外行动 | L2 |
| `mythic_greeks_favor_of_hermes` | standard no target | 无目标按钮 | 无 interaction；直接写两个额外行动 | L2 |
| `mythic_greeks_favor_of_poseidon` | standard action | 弃牌卡多选 | 无 playNeeds；discard prompt 是能力第一目标，至多 3 语义存在 | L2/L3(既有) |
| `mythic_greeks_favor_of_zeus` | playNeedsBase | 基地 | **已修复**：直接消费 `ctx.targetBaseIndex ?? ctx.baseIndex`，不再创建 base prompt | L2 |
| `base_oracle_at_delphi` | onMinionPlayed base ability | played minion/base event | 无用户入口；直接消费触发事件并处理顶牌 | L2 |
| `base_wooden_horse` | onActionPlayed base ability | action played event/player | 无直接 playNeeds；optional minion prompt 属于基地能力目标；Not in Kansas 替换同基地后已禁止误触发新基地 | L2 |

## 本轮发现与修复

### F1：`mythic_greeks_favor_of_zeus` 第一入口基地被二次选择（已修复）

- 根因：数据 `playNeedsBase: true` 已让 UI/validator 第一入口确定为基地，但 handler 旧实现仍调用 `greekBasePromptProgram` 再弹 base prompt。
- 修复：`src/games/smashup/abilities/mythic_greeks.ts` 的 `favorOfZeus` 改为直接发 `modifyBreakpoint(ctx.targetBaseIndex ?? ctx.baseIndex, -5, ...)`。
- 测试：`shayuEntryConsumption.test.ts` 断言无 interaction 且 `tempBreakpointModifiers[1] = -5`；`shayuFactionAbilities.test.ts` 抽样复审用例也覆盖无二次 prompt。

### F2：`tornados_carried_away` 第一入口随从被二次选择（已修复）

- 根因：数据 `playNeedsMinion: true` 已让 payload 确定要移动的随从，但 handler 旧实现仍用 `runChooseMove(... [located])` 再弹 minion prompt。
- 修复：`src/games/smashup/abilities/tornados.ts` 在 `ctx.targetMinionUid` 存在时定位该随从，然后直接创建目标基地 prompt `sourceId='tornados_carried_away_dest'`。
- 测试：`shayuEntryConsumption.test.ts` 断言第一个 prompt 为 base；`shayuFactionAbilities.test.ts` 真实行动入口用例已改为直接选择目标基地并验证随从移动。

### F3：`tornados_not_in_kansas` 替换基地后误触发新基地 `onActionPlayed`（已修复）

- 根因：action 已在目标基地执行并产生 `BASE_REPLACED`，同一 `ACTION_PLAYED` 后处理继续按同一个 `targetBaseIndex` 收集新基地能力，导致新翻出的 `base_wooden_horse` 在同一行动里误触发。
- 修复：`src/games/smashup/domain/index.ts` 增加 `targetBaseWasReplacedByThisAction` 判断；若同 timestamp 同 baseIndex 出现 `BASE_REPLACED`，跳过该目标基地本次 `onActionPlayed` 收集。
- 测试：`shayuEntryConsumption.test.ts` 的 Kansas 场景断言替换为 `base_wooden_horse` 后没有 `sys.interaction.current`，且原基地随从保留。

## 验证记录

- `npx eslint src/games/smashup/domain/index.ts src/games/smashup/abilities/tornados.ts src/games/smashup/abilities/mythic_greeks.ts src/games/smashup/__tests__/shayuEntryConsumption.test.ts src/games/smashup/__tests__/shayuFactionAbilities.test.ts` → 0 errors，25 warnings（均来自既有 `domain/index.ts` unused/any 警告）。
- `npx vitest run src/games/smashup/__tests__/shayuFactionAbilities.test.ts src/games/smashup/__tests__/shayuEntryConsumption.test.ts` → 2 files passed，27 tests passed。
- `npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts -t "直接入口字段|控制者约束"` → 2 passed / 24 skipped。
- `npm run typecheck` → passed。
- `git diff --check -- .spec/knowledge/standards/testing-audit.md src/games/smashup/abilities/mythic_greeks.ts src/games/smashup/abilities/tornados.ts src/games/smashup/domain/index.ts src/games/smashup/__tests__/shayuEntryConsumption.test.ts src/games/smashup/__tests__/shayuFactionAbilities.test.ts e2e/src/games/smashup/__tests__/shayuFactionAbilities.test.ts` → passed，仅 line-ending warning。

## 仍不得偷换的范围

- 本专项全量对象均完成第一入口直接消费 L2 审计；本轮只对 3 条高风险真实入口链补充 L3 E2E，不是 45 个对象逐项 L3。
- `mythic_greeks_argonaut` 跨派系 action-trigger 泛化仍按既有残余专项处理，不能在本轮顺手宣布全项目泛化完成。
- `greekBasePromptProgram` 中保留 `mythic_greeks_favor_of_zeus` legacy resolver 分支，只用于兼容已存在的旧 queued prompt；新出牌入口不再创建该 prompt。

## 本轮追加真实入口 E2E 截图核对（2026-05-12 08:46 +08）

> 下面 3 条是本轮实际复跑并打开截图核对过的高风险入口链；截图为真实页面原位截图，不是 DOM 克隆摆拍。

| E2E 用例 | 关键截图 | 肉眼观察结论 |
| --- | --- | --- |
| `Sharks 与 Tornados 代表行动可从手牌真实打出并完成交互` | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-与-Tornados-代表行动可从手牌真实打出并完成交互\shayu-tornados-carried-away-after-move.png` | 截图中 `Mako` 已从 `The Deep` 移动到中间的 `Tornado Alley`；右下手牌区仍可见已出过的 `Carried Away`，说明真实手牌入口完成移动链。 |
| `Tornados 不在堪萨斯替换基地时保留随从并清理基地/随从行动卡` | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-不在堪萨斯替换基地时保留随从并清理基地-随从行动卡\shayu-tornados-not-in-kansas-after-base-replace.png` | 左侧基地已替换为 `Oracle at Delphi`；两个随从仍留在新基地；原附着/基地行动已清理；画面没有新 `Wooden Horse` 选择弹窗，符合“替换后不误触发新基地 onActionPlayed”。 |
| `Tornado Alley 基地能力在本回合首次移入时触发，第二次移入不重复触发` | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornado-Alley-基地能力在本回合首次移入时触发，第二次移入不重复触发\shayu-tornado-alley-trigger-open.png` / `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornado-Alley-基地能力在本回合首次移入时触发，第二次移入不重复触发\shayu-tornado-alley-second-move-no-repeat-trigger.png` | 首图能看到 `Tornado Alley` 触发“可把另一个随从移动到这里”的选择；末图能看到第二次移入后中间基地已有 3 个随从、`usedBaseAbilityCount` 对应状态断言为 1，且没有再次弹基地能力交互。 |

E2E 命令：

- `npm run test:e2e:ci:file -- e2e/smashup-shayu-factions.e2e.ts "Sharks 与 Tornados 代表行动可从手牌真实打出并完成交互"` → 1 passed。
- `npm run test:e2e:ci:file -- e2e/smashup-shayu-factions.e2e.ts "Tornados 不在堪萨斯替换基地时保留随从并清理基地/随从行动卡"` → 1 passed。
- `npm run test:e2e:ci:file -- e2e/smashup-shayu-factions.e2e.ts "Tornado Alley 基地能力在本回合首次移入时触发，第二次移入不重复触发"` → 1 passed。
