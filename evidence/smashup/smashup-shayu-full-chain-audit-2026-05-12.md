# SmashUp shayu 三派系通用入口矩阵全量重审（2026-05-12）

## 结论边界

- 本轮是按 `.spec/knowledge/standards/testing-audit.md` 新补强的**通用交互入口语义矩阵**做的 shayu 全量 P0/P1 重审。
- 覆盖对象：`sharks` / `tornados` / `mythic_greeks` 三派系 **39 张卡 + 6 张基地**。
- 本轮重点：描述动作链第一入口、目标归属、数量/可选、动作链上下文、UI/validator/handler/reducer 单一真相。
- 本轮没有新增浏览器 E2E 截图，因此结论不升级为“全量 L3 E2E 收口”。已有历史 E2E 继续作为旧证据引用，但本轮新增结论以 L1/L2/P0/P1 为主。

## 权威来源

1. 当前代码静态数据：`src/games/smashup/data/factions/{sharks,tornados,mythic_greeks}.ts`。
2. 当前 zh-CN 文案：`public/locales/zh-CN/game-smashup.json` 中 `cards.<id>.abilityText/effectText`。
3. 当前实现：`src/games/smashup/abilities/{sharks,tornados,mythic_greeks}.ts`、`domain/playLegality.ts`、`Board.tsx`、`domain/utils.ts`。
4. 旧证据回写对象：`evidence/smashup/smashup-shayu-faction-audit.md` 与 `evidence/smashup/smashup-shayu-strict-chain-sample-audit-2026-05-11.md`。

## 通用矩阵落地方式

本轮逐对象检查以下 P0/P1 项：

- **P0 第一入口**：玩家第一下选择的是基地、随从、卡牌、按钮，还是由触发上下文自动确定。
- **P0 目标归属**：`你的 / 对手 / 任意 / 该玩家 / 触发者` 是否在 UI、validator、handler 里一致。
- **P0 数量/可选**：`可以 / 至多 / 任意数量 / 每回合一次 / 任意顺序` 是否有 skip、multi、order、metadata 或等价治理。
- **P1 上下文携带**：多步链是否保存 `sourceUid/baseIndex/defId/cardUid/baseDefId` 等稳定上下文。
- **P1 最终态**：L2 行为测试或既有 E2E 是否证明最终权威状态变化；未覆盖的只标 L1/残余，不冒充收口。

## 全量对象矩阵

层级说明：L1=结构/注册/入口字段；L2=行为测试或领域状态断言；L3=历史真实入口 E2E；L4=响应窗/计分/治理证据。`本轮结论` 只说明 2026-05-12 P0/P1 审计结果。

| 对象 | 动作链 / 触发链 | 第一入口 | 字段/上下文 | P0/P1 结论 | 层级 |
| --- | --- | --- | --- | --- | --- |
| `sharks_megalodon` | onPlay 可消灭本基地 4-；beforeScoring special 可消灭本基地 3- | onPlay 源随从所在基地；special 计分基地上下文 | `ctx.baseIndex/sourceCardUid`，destroy prompt 可 skip | 入口不依赖 playNeeds；计分前上下文明确，消灭目标排除自身；无新增问题 | L2 |
| `sharks_great_white` | 天赋：移动自身到另一基地 → 消灭目的地 2- | 天赋按钮/自身 | `sourceMinionUid/sourceBaseIndex` → 目标基地 prompt → destroy prompt | A→B 顺序正确，目的地未误当前置入口；上下文携带完整 | L1/L2 |
| `sharks_hammerhead` | 本基地有仆从被消灭后自身 +1 | onMinionDestroyed 触发 | `sourceScope: triggerBase` | 触发范围为本基地；最终加到 Hammerhead 自身；共享 destroy trigger 已覆盖 | L2/L3 |
| `sharks_mako` | 你消灭任意基地仆从后，可作为额外随从打到那里 | onMinionDestroyed 全局手牌触发 | `destroyerId/baseIndex/globalZones:['hand']` | 入口是触发者手牌额外打出，不是常规手牌点击；上下文用 destroyer/baseIndex，未发现反转 | L1 |
| `sharks_blood_in_the_water` | 打到基地；这里仆从被消灭后额外打 3- 到这里 | 打出目标基地 | `ongoingTarget:'base'` + `playNeedsBase` + `triggerBase` | 第一入口是基地，与文案一致；额外随从目标由上下文基地限定 | L1/L2 |
| `sharks_week_of_sharks` | 打到基地；回合结束若你这里有仆从抽 1；每回合只一个 | 打出目标基地 | `ongoingTarget:'base'` + owner set once/turn | 基地入口一致；once/turn 不是 UI 选择，用 owner set 治理；2026-06-02 已补“同回合只触发一次 + 跨到下一次自己回合结束仍可再次抽牌” | L2 |
| `sharks_torn_apart` | 选择 3- 随从消灭并抽 1 | onPlay prompt 选随从 | 无 playNeeds，handler prompt `targetType:minion` | 第一选择是随从，未误用基地；最终 destroy+draw 有 L2/L3 | L2/L3 |
| `sharks_chum` | 打到随从；任意仆从被消灭后宿主 +1 | 打出目标随从 | `ongoingTarget:'minion'` + `playNeedsMinion` | 第一入口是随从，与“打出到仆从上”一致；触发时使用 attached 宿主上下文 | L1/L2 |
| `sharks_dangerous_waters` | 打到基地；天赋选择这里随从 -2 | 打出基地；后续天赋随从 prompt | `ongoingTarget:'base'` + `ctx.baseIndex` | 打出入口基地一致；天赋目标被限定在该基地，未发现跨基地泄漏 | L1 |
| `sharks_feeding_frenzy` | 选择基地 → 消灭该基地任意数量 2- 随从 | 基地 | `playNeedsBase`；multi `{min:0,max:n}` | 第一入口基地正确；任意数量由 multi 覆盖，空选不会强制消灭 | L2/L3 |
| `sharks_air_jaws` | 选择你的随从 → 移到另一基地 → 消灭那里 3- | 己方随从 | `playNeedsMinion` + `playTargetMinionController:'self'`；`sourceMinionUid/sourceBaseIndex` | 2026-05-11 旧结论失效已修；本轮复核入口/上下文正确 | L2 |
| `sharks_freakin_laser_beam` | 选择你的随从 → 同基地消灭战力≤源随从的随从 | 己方随从 | `playNeedsMinion` + `playTargetMinionController:'self'`；sourcePower 快照 | UI/validator/handler 归属一致；高战力目标排除；已有 L2 | L2 |
| `base_shark_reef` | 摧毁这里仆从的玩家可给自己任意仆从 +1 | destroyer 触发后随从 prompt | `destroyerId`，targets = destroyer controlled minions，skip | “他任意1个仆从”按 destroyer 自己的随从裁定；归属一致 | L1/L2 |
| `base_the_deep` | 4+ 随从打到这里后，可消灭这里更低战力随从 | onMinionPlayed 触发 | `minionPower/baseIndex/minionUid`，optional destroy prompt | 触发入口是打到本基地；目标限定同基地且低于新随从；可选 skip 存在 | L1/L2 |
| `tornados_monster_tornado` | 天赋：4- 随从从这里移出或从别处移入这里 | 天赋按钮后选随从 | `anchorBaseIndex=currentBase`，根据选择来源决定固定/目标 prompt | A=随从，B=目的地；push/pull 语义由 anchorBaseIndex 保持，已有 L2 | L2 |
| `tornados_cyclone` | 天赋：本随从移到另一基地 | 天赋按钮/自身 | `sourceUid/baseIndex` → base prompt | 自身为 A、目标基地为 B；上下文明确 | L1 |
| `tornados_twister` | 打出后可移动 3-：从这里移出或别处移入这里 | onPlay 后随从 prompt | `anchorBaseIndex=currentBase`，optional 语义由无候选反馈/玩家选择承载 | 第一入口是随从 prompt，不是基地；方向上下文存在 | L2/L3 |
| `tornados_dust_devil` | beforeScoring 可移动本随从到计分基地 | 计分前 button prompt | `sourceCardUid/sourceBaseIndex/scoringBaseIndex`，skip | 可选按钮存在；上下文携带源/目标基地；历史 L4 覆盖 | L3/L4 |
| `tornados_trade_winds` | 选择两个 3- 随从 → 互换基地 | 第一随从 → 第二随从 | `first` context，第二候选排除同一随从/同基地/>3 | 两目标顺序正确；第二步携带 first；已有 L2 | L2 |
| `tornados_carried_away` | 选择一个随从 → 移到另一基地 | 随从 | `playNeedsMinion`；未限制归属；后续 base prompt | 文案未限定你的/敌方，any 随从可选；目的地为第二步 | L2/L3 |
| `tornados_whirlwinds` | 任意数量你的随从 → 每个分别选其他基地 | 多选己方随从 → 逐个基地 | candidates 控制者 self；multi min0；remaining/current context | 数量/归属/逐目标上下文均存在；已有 L2/L3 | L2/L3 |
| `tornados_gone_with_the_wind` | afterScoring 打出；可将该基地你的随从移走替代弃牌 | 计分基地上下文 → 己方随从 → 目标基地 | `specialNeedsBase` + scoringBaseIndex；skip/后续 dest | 真实入口是 afterScoring；A=该基地己方随从，B=另一基地；历史 L4 覆盖 | L3/L4 |
| `tornados_ripped_off` | 选择附着行动卡 → 按原类型选新基地/新随从 | 行动卡 | action context: cardUid/defId/ownerId/targetType/fromBase/fromMinion | 第一入口不是基地/随从而是卡牌；targetType 决定第二入口；上下文完整 | L3 |
| `tornados_picked_up` | beforeScoring 打出；将该基地一个随从移到另一基地 | 计分基地上下文 → 随从 | `specialNeedsBase`；targetBaseIndex/baseIndex | 第一真实选择是随从，但 special 上下文先确定计分基地；B=目标基地后选 | L3/L4 |
| `tornados_not_in_kansas` | 选择基地 → 销毁基地/附着行动 → 替换基地保留随从 | 基地 | `playNeedsBase`；`BASE_REPLACED keepCards` | 第一入口基地正确；清理 action 与保留 minion 的 reducer 事件完整 | L3 |
| `tornados_over_the_rainbow` | beforeScoring 打出；你另一基地随从移入计分基地 | 计分基地上下文 → 己方随从 | `specialNeedsBase`；fixedDestinationBaseIndex=scoring | special 上下文确定目标基地；第一用户选择是己方随从，归属/基地排除正确 | L3/L4 |
| `base_trailer_park` | 仆从移动到这里后，在其上 +1 | onMinionMoved 触发 | `minionUid/baseIndex` | 移入对象由移动事件携带；无额外选择；最终状态是 power counter | L1/L2 |
| `base_tornado_alley` | 每回合第一次移入后，可把另一个随从移到这里 | onMinionMoved → optional minion prompt | `usedBaseAbilitiesThisTurn` + skip + reason 防自触发 | once/turn、另一个、可选均有治理；2026-06-01 已补跨回合清理回归，旧结论已回写 | L3 |
| `mythic_greeks_odysseus` | 你打出行动后，在你的一个随从上 +1 | onActionPlayed → 己方随从 prompt | `playerContext:sourceController`，targets self | 触发者归属正确；第一选择随从；Argonaut 行为覆盖代表链 | L2 |
| `mythic_greeks_argonaut` | 触发行动态能力；可代替行动打出 | 打出随从入口/特殊打出入口 | action-trigger replay 手写代表链，special 语义注册 | 本轮 P0 关注 action-trigger 入口，已有 L2/L3；跨派系泛化仍为残余范围 | L2/L3 |
| `mythic_greeks_jason` | 每回合一次，行动后选基地，你在那里的随从 +1 | onActionPlayed → 基地 prompt | metadata once/turn，sourceUid，self minions on chosen base | 第一入口基地正确；once/turn metadata 存在；Argonaut 真实入口 E2E 已把 Jason prompt 和 chosen-base buff 跑通；2026-06-02 已补跨回合 metadata 不残留回归 | L2 / scoped L3 |
| `mythic_greeks_heracles` | 任意玩家行动后，本随从 +1 临时 | onActionPlayed 自动 | `sourceCardUid/sourceBaseIndex` | 无玩家选择；“任意玩家”与 trigger 不限 sourceController 一致 | L2 |
| `mythic_greeks_spartan` | 每回合一次，你行动后本随从 +1 指示物 | onActionPlayed 自动 | sourceController self + metadata once/turn | 无用户入口；once/turn metadata 存在；2026-06-02 已补跨回合 metadata 不残留回归 | L2/L3 |
| `mythic_greeks_favor_of_hades` | 从你的弃牌堆选择一张行动回手 | 弃牌行动卡 prompt/单张自动 | discard filter action + recover | 第一入口是卡牌；归属 self discard；单张自动不违背“将一张” | L1 |
| `mythic_greeks_favor_of_ares` | 你的一个随从 +3 临时 | 己方随从 | `playNeedsMinion` + `playTargetMinionController:'self'` | UI/validator/handler self 归属一致 | L1 |
| `mythic_greeks_favor_of_aphrodite` | 打出额外仆从 | 无目标按钮/额度事件 | `grantContextualExtraMinion` | 无入口目标；额度写入事件 | L1 |
| `mythic_greeks_favor_of_dionysus` | 己方随从 +1 → 额外行动 → 可放回牌库顶 | 己方随从 → button skip/top | `playNeedsMinion+self`；`cardUid/defId` context；skip | 三段链入口/归属/可选均存在；已有 L2 | L2 |
| `mythic_greeks_favor_of_hera` | 至多两个随从各 +1 指示物 | 多选任意随从 | 2026-06-04 按 `temp/smashup-hera-card-crop-20260604-r5c8/slot-33.webp` 回写：旧 `targets self` 结论失效，改为全场随从；multi min0 max2；optional | “至多”与全场目标范围均有 UI/handler/测试约束；新增对手随从门禁 | L2/L3 |
| `mythic_greeks_favor_of_athena` | 展示顶5 → 可选一张行动入手 → 其余任意顺序回顶 | 卡牌选择/skip → 排序 | `revealed` snapshot；pick prompt；order prompt | 2026-05-11 修复自动选择/排序；本轮复核上下文完整 | L2 |
| `mythic_greeks_favor_of_apollo` | 抽 1 → 额外行动 | 无目标 | draw + extra action events | 无用户入口；最终权威状态有 L2/L3 | L2/L3 |
| `mythic_greeks_favor_of_hermes` | 打出两个额外行动 | 无目标 | extra action x2 events | 无用户入口；低风险额度事件，未单独 L2 | L1 |
| `mythic_greeks_favor_of_poseidon` | 至多3张弃牌洗回牌库 | 弃牌卡多选 | discard self；multi min0 max3；random.shuffle selected | “至多”与 self discard 均有约束；已有 L2/L3 | L2/L3 |
| `mythic_greeks_favor_of_zeus` | 选择基地，破坏点 -5 临时 | 基地 | `playNeedsBase` + `ctx.targetBaseIndex ?? ctx.baseIndex` | 2026-05-12 抽样发现旧实现二次弹 base prompt；已改为直接消费第一入口并补 L2 | L2 |
| `base_oracle_at_delphi` | 仆从打到这里后展示顶牌；行动入手，否则回顶 | onMinionPlayed 自动 | `playerId` + peek.card.type | 2026-05-11 修复行动入手；两分支已有 L2 | L2 |
| `base_wooden_horse` | 任意玩家行动后，该玩家可使这里一个随从 +2 | onActionPlayed → optional minion prompt | `playerId` 为行动玩家；targets 本基地任意随从；skip | “任意玩家/他能/这里一个”已按行动玩家控制选择权；可选 skip 存在 | L1/L2 |

## 本轮发现项

### 新增 P0/P1 blocker

- 本轮未发现新的 P0/P1 blocker。

### 旧结论继续降级的范围

- 2026-05-11 已确认旧 shayu 总审计文档不能继续解释为“全量 L3 E2E 已收口”。本轮全量 P0/P1 清单完成后，当前可说：**全量入口矩阵 P0/P1 已审；L3 仍按历史代表性 E2E，不是逐对象全覆盖**。

### 残余范围

1. 未新增浏览器 E2E 截图；不得宣称“本轮 E2E 已通过/已看图”。
2. `mythic_greeks_argonaut` 跨派系 action-trigger 泛化仍属于后续专项；本轮只重审 shayu 内部代表链。
3. 低风险无目标额度类对象（如 `mythic_greeks_favor_of_hermes`）仍停在 L1，未单独补 L2 行为断言。

## 验证记录

- `python` 自检 `src/games/smashup/data/factions/{sharks,tornados,mythic_greeks}.ts` + 本 evidence：确认 39 张卡 + 6 张基地均出现在全量矩阵，矩阵行数 45，缺失对象 `[]`。
- `npx vitest run src/games/smashup/__tests__/shayuFactionAbilities.test.ts` → 1 file / 16 tests passed。
- `npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts -t "直接入口字段|控制者约束"` → 1 file / 2 tests passed，24 skipped。
- `npm run typecheck -- --pretty false` → `tsc --noEmit` passed；npm 输出 `--pretty` unknown config warning，不影响 typecheck 结果。
- `git diff --check -- .spec/knowledge/standards/testing-audit.md evidence/smashup/smashup-shayu-full-chain-audit-2026-05-12.md evidence/smashup/smashup-shayu-faction-audit.md task_plan.md findings.md progress.md temp/smashup-shayu-full-audit-2026-05-12.json` → exit 0；仅提示 `progress.md` 工作区 LF→CRLF。

## 2026-05-12 再次抽样调查回写

- 追加证据：`evidence/smashup/smashup-shayu-strict-sample-audit-2026-05-12.md`。
- 抽样对象：`sharks_dangerous_waters`、`tornados_cyclone`、`mythic_greeks_favor_of_hermes`、`mythic_greeks_favor_of_zeus`、`base_wooden_horse`。
- 发现并修复：`mythic_greeks_favor_of_zeus` 原实现没有直接消费 `playNeedsBase` 的第一入口，而是二次弹出 base prompt；现已改为直接写入 `BREAKPOINT_MODIFIED`。
- 口径修正：此前“未发现新的 P0/P1 blocker”应按当时静态矩阵理解；再次抽样发现并修复了一个 L2 行为缺口。当前结论为：抽样对象 L2 通过，仍不宣称全量 L3 E2E。

## Addendum（2026-05-12 08:38 +08）：第一入口直接消费专项全量重审

- **旧结论再次降级**：此前“全量矩阵 + 抽样复审”没有逐项验证 handler 是否直接消费第一入口，因此只能作为 L1/L2 部分证据，不能再单独支撑“入口审计完成”。
- **新增专项证据**：`evidence/smashup/smashup-shayu-entry-consumption-audit-2026-05-12.md`。
- **本次发现并修复**：
  1. `mythic_greeks_favor_of_zeus`：`playNeedsBase` 后 handler 又二次 base prompt；已改为直接消费 `targetBaseIndex/baseIndex`。
  2. `tornados_carried_away`：`playNeedsMinion` 后 handler 又二次 minion prompt；已改为直接弹目标基地 prompt。
  3. `tornados_not_in_kansas`：替换目标基地后同一 `ACTION_PLAYED` 误触发新基地 `onActionPlayed`；已跳过同 timestamp 同 baseIndex 被替换的新基地触发。
- **验证**：`shayuFactionAbilities.test.ts + shayuEntryConsumption.test.ts` 共 27 passed；专项 audit 2 passed；`npm run typecheck` passed；相关文件 eslint 0 errors。
- **当前等级**：第一入口直接消费专项达到 L2；本轮追加复跑 3 条高风险真实入口 E2E 并核对截图；仍不宣称 45 对象全量逐项 L3。


## 2026-05-12 22:50 +08 被全面审计 guard 取代后的补充

本文档仍可作为“通用入口矩阵/P0/P1”历史证据，但不再是 shayu 全面审计的完成入口。当前 completion guard 是 `temp/smashup-shayu-comprehensive-audit-2026-05-12.json`，状态仍为 `in_progress`。

本轮新增 L2 证据已落入 `shayuComprehensiveBehavior.test.ts`，覆盖鲨鱼诱饵、海渊、哈迪斯、活动房屋公园、龙卷风走廊 once/recurse 等此前未充分核销对象。该补强不改变本文档“不能宣称全量 L3 E2E 收口”的边界。


## Addendum（2026-05-12 23:50 +08）：L3 真实入口补强批次

- 已补强并实际看图核对 2 条高风险 E2E：
  - Sharks：大白鲨结算辅助、飞鲨真实入口、激光束真实入口。
  - Mythic Greeks / Tornados：哈迪斯、宙斯、雅典娜、信风真实入口。
- 本批新截图与肉眼结论已回写总入口：`evidence/smashup/smashup-shayu-comprehensive-audit-coverage-2026-05-12.md`。
- 重要限定：`sharks_great_white` 这次仍由 test harness dispatch 触发天赋，只能算结算辅助证据，不算完整真实 UI 天赋入口 L3。
- 当前可升级为 L3 的对象：`sharks_air_jaws`、`sharks_freakin_laser_beam`、`mythic_greeks_favor_of_hades`、`mythic_greeks_favor_of_zeus`、`mythic_greeks_favor_of_athena`、`tornados_trade_winds`。
- 当前仍不得宣称全面审计完成：45 对象全量 L2 核销、全部 L3 代表链、全部 L4 时序治理仍未完成。


### 2026-05-13 00:03 +08 全文件 E2E 回归补充

- 补跑整文件：`$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci -- e2e/smashup-shayu-factions.e2e.ts` → 14 passed。
- 说明：第一次整文件复跑被同类 E2E heavy-task guard 拦截；确认使用隔离 runtime 后显式允许并发并通过。
- 该结果证明 `e2e/smashup-shayu-factions.e2e.ts` 当前 14 条代表性真实入口/时序链没有被本轮测试修正破坏；仍不等于 45 对象全量 L3/L4 完成。


## Addendum（2026-05-13 00:16 +08）：C3 全量 L2 核销

- 新增 `tornados_twister` 旋风 push/pull L2 行为测试。
- `shayuComprehensiveBehavior.test.ts` 当前 13 passed；`npx eslint src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` 0 errors。
- 已在全面审计总入口逐对象写清 45/45 的 L2 行为证据来源；C3 可标 pass。
- 仍未完成：C4 全交互 L3/代表链截图归档、C5 全部时序/窗口/队列 L4、C6 最终修复/旧 evidence 全量回写。


## Addendum（2026-05-13 00:55 +08）：全面审计 C4/C5/C6 回写

- 总入口仍是 `evidence/smashup/smashup-shayu-comprehensive-audit-coverage-2026-05-12.md`。
- `sharks_great_white` 已重新用真实 UI 点击随从触发天赋，旧“仅 harness 辅助”结论失效。
- C4 已逐对象归档：所有真实 UI 交互入口均为独立 L3 或等价代表链；无用户入口对象显式标记 C4 不适用。
- C5 已逐家族归档：beforeScoring、afterScoring、base replace、once/turn、action-trigger、base trigger、destroy trigger、multi/order/continuationContext 均有 L4 或系统代表链证据。

## Addendum（2026-06-02 +08）：once-per-turn 家族扩审

- `sharks_week_of_sharks`、`mythic_greeks_jason`、`mythic_greeks_spartan` 已新增跨回合重新可用回归，补齐旧矩阵只证明“同回合不重复”的缺口。
- 当前 once/turn 家族读取口径：
  - `base_tornado_alley` 代表共享回合态跨回合清理。
  - `sharks_week_of_sharks` 代表自动 endTurn once/turn 的跨回合再触发。
  - `mythic_greeks_jason`、`mythic_greeks_spartan` 代表 metadata once/turn 的跨回合再触发。
- C6 已完成回写；最终是否 COMPLETE 以 `temp/smashup-shayu-comprehensive-audit-2026-05-12.json` 与 guard 检查为准。

## 2026-05-23 +08 destroyerId 专项回写

- 旧条目 `sharks_mako` 的 P0/P1 结论“上下文用 destroyer/baseIndex，未发现反转”现需降级：它只证明了 trigger 自身消费字段方向正确，没有反查到共享 reducer 会在 destroyerId 缺失时做错误兜底。
- 旧条目 `base_shark_reef` 的 destroyer 归属结论也需降级：它只证明了**显式 destroyerId** 时候选归属正确，没有证明 destroyerId 缺失时不会错误给当前玩家 prompt。
- 共享根因与新增否定链证据见：`evidence/smashup/smashup-shayu-destroyerid-contract-reaudit-2026-05-23.md`。
- 当前读取口径：本文件 destroy trigger 家族结论必须与 2026-05-23 destroyerId 专项一起看，不能再单独作为“缺失 destroyerId 否定链已审”的证明。


## 2026-05-13 01:03 +08 最终回归验证

- `npx eslint e2e/smashup-shayu-factions.e2e.ts src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 0 errors。
- `npx vitest run src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 13 passed。
- `$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci -- e2e/smashup-shayu-factions.e2e.ts` → 14 passed。
- 本轮实际核对截图包括：
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-great-white-talent-destination-open.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-great-white-after-move-destroy.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-随风而逝从-afterScoring-窗口打出并让随从逃离清场\shayu-tornados-gone-with-the-wind-after-scoring-open.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornado-Alley-基地能力在本回合首次移入时触发，第二次移入不重复触发\shayu-tornado-alley-trigger-open.png`
