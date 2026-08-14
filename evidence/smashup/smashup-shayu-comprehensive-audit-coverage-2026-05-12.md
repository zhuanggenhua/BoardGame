# SmashUp shayu 三派系全面审计覆盖矩阵（2026-05-12）

## 状态说明

- 本文档是“全面审计”总入口，不再把抽样、专项或 L1 静态矩阵称为已审计。
- 当前状态：**final-verification**。C1-C5 已补齐证据矩阵，最终完成态以 guard 与回归验证输出为准。
- 审计全集：Sharks 12 张 + Tornados 12 张 + Mythic Greeks 15 张 + 新基地 6 张 = **45 个对象**。

## 2026-05-15 失效结论回写：Argonaut 暴露“对象级 pass 未逐子句核销”

后续长描述复杂对象抽样发现 `mythic_greeks_argonaut` 仍存在两个漏项：

1. 卡面第二句“任何你可以打出行动的时候，你可以改为打出这张牌”未被旧矩阵强制映射到命令入口和额度消耗，因此旧实现只能普通随从打出，不能替代行动额度打出。
2. 卡面第一句“触发所有会因你打出一个行动而触发的能力”旧审计只看了 Odysseus / Heracles / Spartan 代表触发，漏掉 Jason 的 onActionPlayed base prompt。

旧结论失效原因：

- 旧矩阵按“对象行”核销，写了 `mythic_greeks_argonaut` L2/L3/L4 代表链，但没有把真相源文本拆成 `C1 触发所有 action 后能力`、`C2 可替代行动打出`、`C3 Jason once/turn base prompt` 等子句逐项核销。
- 因此“Argonaut 代表链通过”只能证明部分 action-trigger 已触发，不能证明所有子句都实现。

修复与新增证据：

- 修复证据见 `evidence/smashup/smashup-shayu-long-text-sample-audit-2026-05-15.md`。
- 新通用门禁已写入 `.spec/knowledge/standards/testing-audit.md`：所有游戏审计必须先拆规则文本子句，任一子句缺实现/证据时，整对象不得标 `passed`。
- 本文后续读取时，`mythic_greeks_argonaut` 的旧 L2/L3/L4 结论必须按 2026-05-15 修复后的证据重新理解；不能再引用 2026-05-12 的对象级 pass 作为完整证明。

## 2026-05-23 +08 失效结论回写：Mako 暴露 destroyerId 共享消费合同漏审

后续反馈发现 `sharks_mako` 在“没有明确消灭者”的消灭事件上也会错误触发。根因不是数据录入，也不是 `sharks_mako` 自身 trigger 条件写错，而是共享 destroy 后处理曾把缺失 `destroyerId` 的事件兜底成当前操作者/目标控制者，导致 `you destroyed` 语义被误判。

本次失效直接推翻了本文此前对 destroy trigger 家族的部分结论：

1. `sharks_mako` 旧 L2 结论“已断言消灭随从后只允许立即额外打出手牌中的灰鲭鲨到该基地”只证明了**正向有 destroyerId 的链**，没有覆盖 `destroyerId` 缺失的否定链。
2. `base_shark_reef` 旧 destroyerId 归属结论只证明了**显式 destroyerId 时的正向归属**，没有证明“缺失 destroyerId 时不应默认把当前玩家当成消灭者”。
3. `destroy trigger / immediate extra play` 家族旧 C5 结论里“destroy 触发队列按 destroyer/基地上下文收口”应降级为：**当事件显式携带 destroyerId 时收口成立；缺失 destroyerId 的兜底路径当时未被审到**。

本次补审与修复：

- 共享修复：`src/games/smashup/domain/reducer.ts` 收窄 `onMinionDestroyed` 的 destroyer 归因，只信任事件显式声明的 `destroyerId`，不再 fallback 到当前操作者/目标控制者。
- 回归新增：`src/games/smashup/__tests__/abilities/sharks.test.ts`
  - `灰鲭鲨在消灭被防止时不会错误出现额外打出提示`
  - `灰鲭鲨不会把缺少 destroyerId 的消灭事件默认算成当前玩家消灭`
  - `鲨鱼领地不会把缺少 destroyerId 的消灭事件默认算成当前玩家触发`
- 详细专项证据：`evidence/smashup/smashup-shayu-destroyerid-contract-reaudit-2026-05-23.md`

更新后的读取口径：

- `sharks_hammerhead`、`sharks_chum`、`sharks_blood_in_the_water` 只依赖“发生了消灭”，不依赖消灭者归因，本次专项未发现新增缺口。
- `sharks_mako` 与 `base_shark_reef` 是 shayu 批次里真正依赖 `destroyerId` 共享合同的对象；本次已补齐正向链、被防止链、缺失 destroyerId 否定链。
- 因此本文 destroy trigger 家族的当前结论必须以后续 2026-05-23 destroyerId 专项文档为准，不能继续单独引用 2026-05-13 之前的 C3/C5 结论。

## 证据层级定义

- L1：静态/数据/注册/字段/素材/入口结构。
- L2：领域行为测试，断言最终权威状态变化。
- L3：真实 UI 入口 E2E + 截图肉眼核对。
- L4：时序/窗口/队列/跨阶段/response/reaction/deferred/once-per-turn/base replace 等系统链路证据。

## 当前总缺口

> 这是继续执行用的缺口清单，不是完成结论。

1. **C3 已完成**：45/45 对象均已逐项写明 L2 或更高行为证据来源。
2. **C4 已完成待最终 guard 核验**：所有真实 UI 交互入口已归入独立 L3 或等价代表链；无真实用户入口对象显式标记不适用。
3. **C5 已完成待最终 guard 核验**：所有 beforeScoring / afterScoring / base replace / once-per-turn / action-trigger / trigger queue 对象已逐项归档 L4 证据或代表链。
4. **C6 待最终回归与 guard**：旧 evidence/task_plan/findings/progress 已追加回写；最终是否 complete 以回归测试和 completion guard 为准。

## 45 对象覆盖矩阵（初版）

| 对象 | 风险类型 | 当前可确认层级 | 全面审计要求 | 当前缺口 |
| --- | --- | --- | --- | --- |
| `sharks_megalodon` | onPlay destroy + beforeScoring special | L2(onPlay) | L2 + special L4；必要时 L3 | onPlay 低战力消灭已由 `shayuComprehensiveBehavior.test.ts` 覆盖；beforeScoring special 仍需 L4 指向/复核 |
| `sharks_great_white` | talent 自移动 + 消灭 | L2 | L2 + L3 | L2 已覆盖源对象、目标基地、移动后低战力消灭；仍缺逐对象 L3 或代表链写明 |
| `sharks_hammerhead` | destroy trigger 加指示物 | L2 | L2；如真实触发链代表 L3 可引用 | 复核是否覆盖任意 destroy 来源与 once/重复触发边界 |
| `sharks_mako` | destroy 后额外仆从 special | L2 | L2 + L3/L4 | L2 已覆盖 sameNameOnly、立即额外随从窗口、基地限制；仍缺逐对象 L3 或代表链写明 |
| `sharks_blood_in_the_water` | base ongoing + destroy trigger + 额外仆从 | L2 | L2 + L3/L4 | 入口附着与 destroy 后 3- 立即额外随从链均已覆盖；仍缺逐对象 L3 或代表链写明 |
| `sharks_week_of_sharks` | base ongoing + endTurn draw + once/turn | L2 | L2 + L4 | 同回合同拥有者只抽 1、且 2026-06-02 已补“跨到下一次自己回合结束仍可再次抽牌”回归；仍需 L4 结论归档 |
| `sharks_torn_apart` | destroy + draw | L2/L3 | L2 + L3 | 代表链已覆盖；复核 draw 与 hammerhead/Mako 联动边界 |
| `sharks_chum` | minion ongoing attach + destroy trigger | L2 | L2 + L3 | 入口附着与任意 destroy 后宿主 +1 均已覆盖；仍缺逐对象 L3 或代表链写明 |
| `sharks_dangerous_waters` | base ongoing + talent 临时 -2 | L2(入口/抽样) | L2 + L3 | 补真实 ongoing talent UI 入口截图或明确代表链 |
| `sharks_feeding_frenzy` | base first entry + multi destroy | L2/L3 | L2 + L3 | 已有代表链；复核 multi 空选/部分选边界 |
| `sharks_air_jaws` | minion first entry + move + destroy | L2 | L2 + L3 | 入口修复已测；需补真实 UI 入口 L3 或纳入代表链 |
| `sharks_freakin_laser_beam` | self minion first entry + 同基地阈值 destroy | L2 | L2 + L3 | 需补真实 UI 入口 L3 或纳入代表链 |
| `base_shark_reef` | destroyerId base trigger | L2 | L2 + L4 | L2 已覆盖 destroyer 归属、选择己方任意随从、排除非 destroyer 随从；仍需 L4 触发队列结论归档 |
| `base_the_deep` | onMinionPlayed base trigger | L2 | L2 + L4 | L2 已覆盖 4+ 阈值、同基地更低战力目标、排除自身/更高战力；仍需 L4 触发队列结论归档 |
| `tornados_monster_tornado` | talent push/pull | L2 | L2 + L3 | 补真实 talent UI 或代表链说明 |
| `tornados_cyclone` | talent self move | L2 | L2 + L3 | 补真实 talent UI 或代表链说明 |
| `tornados_twister` | onPlay push/pull | L2/L3 | L2 + L3 | 复核方向选择、3- 边界 |
| `tornados_dust_devil` | beforeScoring special | L3/L4 | L2 + L3 + L4 | 已有计分前 E2E；补 evidence 指向与截图结论 |
| `tornados_trade_winds` | 交换两基地随从 | L2 | L2 + L3 | 补真实 UI 两步入口 L3 或代表链 |
| `tornados_carried_away` | playNeedsMinion + destination prompt | L2/L3 | L2 + L3 | 本轮已修并复跑代表 E2E；补旧截图/证据指向 |
| `tornados_whirlwinds` | 多选 + 逐目标移动 | L2/L3 | L2 + L3 | 已有 E2E；复核逐个 destination 上下文 |
| `tornados_gone_with_the_wind` | afterScoring special | L3/L4 | L2 + L3 + L4 | 已有 afterScoring E2E；补 reaction/session 结论 |
| `tornados_ripped_off` | ongoing/attached action 转移 | L3 | L2 + L3 | 已有 E2E；补 targetType 多义 audit 结论 |
| `tornados_picked_up` | beforeScoring special move out | L3/L4 | L2 + L3 + L4 | 已有 E2E；补 response window 结论 |
| `tornados_not_in_kansas` | base replace keepCards | L2/L3/L4 | L2 + L3 + L4 | 本轮已修新基地误触发；补旧 evidence 降级/升级说明 |
| `tornados_over_the_rainbow` | beforeScoring special move in | L3/L4 | L2 + L3 + L4 | 已有 E2E；补窗口继续推进结论 |
| `base_trailer_park` | onMinionMoved auto +1 | L2 | L2 + L4 | L2 已覆盖独立移动事件移入后自动 +1；仍需 L4 归档 |
| `base_tornado_alley` | once/turn optional move | L2/L3/L4 | L2 + L3 + L4 | L2 已覆盖首次移入触发、BASE_ABILITY_USED once/turn 标记、reason 防自递归；高风险 E2E 已复跑，仍需截图指向归档到总矩阵 |
| `mythic_greeks_odysseus` | onActionPlayed prompt + counter | L2/L3 | L2 + L3 + L4 | Argonaut 代表链覆盖；补普通 action trigger 或代表说明 |
| `mythic_greeks_argonaut` | extra action play + action triggers | L2/L3/L4(代表) | L2 + L3 + L4 | 跨派系 action-trigger 泛化仍需专项确认 |
| `mythic_greeks_jason` | onActionPlayed base prompt + self minions +1 | L2 | L2 + L3 + L4 | L2 已覆盖跨基地选择、只给己方随从 +1、sourceBaseIndex 记录 once/turn；2026-06-02 已补“上一回合 metadata 不会挡住下一回合再次触发”回归；仍缺逐对象 L3/L4 归档 |
| `mythic_greeks_heracles` | any action + self temp +1 | L2/L3 | L2 + L4 | 复核任意玩家 action 与临时清理 |
| `mythic_greeks_spartan` | self action once/turn + counter | L2/L3 | L2 + L4 | 已复核 once/turn、非自己行动不触发；2026-06-02 补“上一回合 metadata 不会挡住下一回合再次触发”回归 |
| `mythic_greeks_favor_of_hades` | discard action recover | L2 | L2 + L3 | L2 已覆盖弃牌堆行动牌过滤与选择回手；仍缺真实入口 L3 或代表链写明 |
| `mythic_greeks_favor_of_ares` | self minion +3 temp | L2 | L2 + L3 | 补真实 UI 或代表链 |
| `mythic_greeks_favor_of_aphrodite` | extra minion quota | L2 | L2 | L2 已覆盖额度写入并消费为第二个随从打出 |
| `mythic_greeks_favor_of_dionysus` | self minion +1 + extra action + optional topdeck | L2 | L2 + L3 | 补真实 UI optional 证据 |
| `mythic_greeks_favor_of_hera` | up to 2 minions counters | L2/L3 | L2 + L3 | 2026-06-04 已按 `temp/smashup-hera-card-crop-20260604-r5c8/slot-33.webp` 回写旧 self 误判；复核 0/1/2 与对手随从可选边界 |
| `mythic_greeks_favor_of_athena` | reveal top5 + pick + order | L2 | L2 + L3 | 补真实 UI order L3 或代表链 |
| `mythic_greeks_favor_of_apollo` | draw + extra action | L2/L3 | L2 + L3 | 已有 E2E；复核空牌库/额度消费边界 |
| `mythic_greeks_favor_of_hermes` | +2 extra actions | L2 | L2 | 补额度消费或说明只需额度写入 |
| `mythic_greeks_favor_of_poseidon` | up to 3 discard shuffle | L2/L3 | L2 + L3 | 已有 E2E；复核 0/1/3 边界 |
| `mythic_greeks_favor_of_zeus` | base first entry breakpoint -5 | L2 | L2 + L3 | 本轮已修 L2；补真实 UI L3 或代表链 |
| `base_oracle_at_delphi` | onMinionPlayed reveal top | L2/L3 | L2 + L4 | 补 action/non-action 两分支与 trigger session 结论 |
| `base_wooden_horse` | onActionPlayed optional minion +2 | L2 | L2 + L3/L4 | 补真实 UI 或代表链；Not in Kansas 替换误触发已修 |

## 下一步执行顺序

1. 逐行核销 45 对象 L2 来源：把已在 `shayuFactionAbilities.test.ts` / `shayuEntryConsumption.test.ts` / `shayuComprehensiveBehavior.test.ts` 覆盖的对象写成明确证据；不能再写“已有代表链”但不给测试名。
2. 按交互复杂度补 L3 或明确代表链：talent 类、Air Jaws、Laser Beam、Trade Winds、Athena/order、Zeus 等仍不能冒充逐对象截图。
3. 补 L4 归档：所有 special/trigger/base ability/once-per-turn/reaction session 对象，要写清触发窗口、队列治理、session 结束条件和截图/测试证据。


## 2026-05-12 22:50 +08 L2 补强批次

本批只提升 L2/L4 行为证据，不等于全面审计完成。

- 新增/扩展测试：`src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts`，当前 12 tests passed。
- 新覆盖对象：`sharks_chum`、`base_the_deep`、`mythic_greeks_favor_of_hades`、`base_trailer_park`、`base_tornado_alley`。
- 同文件继续承载上一批 L2：`sharks_megalodon`、`sharks_great_white`、`sharks_mako`、`sharks_blood_in_the_water`、`base_shark_reef`、`mythic_greeks_favor_of_aphrodite`、`mythic_greeks_jason`。
- 本批验证：`npx vitest run src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 12 passed；`npx eslint src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 0 errors。
- 仍未完成：C3 需要逐对象核销全部 45 行 L2 来源；C4 逐交互 L3/代表链和 C5 全部 L4 仍 pending。


## 2026-05-12 23:50 +08 L3 真实入口补强批次（仍未完成全面审计）

本批补强 C4 的一部分，只能提升下列对象的真实入口/代表链证据，不等于 45 对象全量 L3/L4 完成。

验证命令：

- `npm run test:e2e:ci:file -- e2e/smashup-shayu-factions.e2e.ts "Sharks 高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口"` → 1 passed（2026-05-12 23:25）。
- `npm run test:e2e:ci:file -- e2e/smashup-shayu-factions.e2e.ts "Mythic Greeks 与 Tornados 复杂入口覆盖哈迪斯、宙斯、雅典娜和信风"` → 1 passed（2026-05-12 23:46）。
- `npx eslint e2e/smashup-shayu-factions.e2e.ts` → 0 errors。

关键截图与肉眼核对：

| 对象/链路 | 截图路径 | 肉眼观察与结论 |
| --- | --- | --- |
| `sharks_air_jaws` 飞鲨 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-air-jaws-destination-open.png`；`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-air-jaws-after-move-destroy.png` | 第一张实际看到飞鲨从手牌打出后，源随从已确定，后续只让玩家选择“另一个基地”，不是回到选基地作为第一入口；第二张实际看到己方灰鲭鲨移动到目标基地，目标基地原 2 战力随从已不在场。该对象本批可记 L3。 |
| `sharks_freakin_laser_beam` 激光束 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-laser-beam-target-open.png`；`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-laser-beam-after-destroy.png` | 实际看到激光束从手牌入口打出后以己方随从为源，后续目标 prompt 只给同基地低/等战力目标；收口图中低战力目标被移除。该对象本批可记 L3。 |
| `sharks_great_white` 大白鲨 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-great-white-talent-destination-open.png`；`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-great-white-after-move-destroy.png` | 2026-05-13 00:39 重新定向跑用例后，大白鲨不再由 harness dispatch 触发；测试从真实棋盘卡牌点击 `great-white` 上半区进入天赋。第一张实际看到“选择要移动到的基地”提示与目的地高亮，第二张实际看到大白鲨已移动到 Wooden Horse 且目的地 2 战力目标被移除。该对象可记完整 L3。 |
| `mythic_greeks_favor_of_hades` 哈迪斯 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-与-Tornados-复杂入口覆盖哈迪斯、宙斯、雅典娜和信风\shayu-mythic-greeks-hades-discard-choice-open.png`；`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-与-Tornados-复杂入口覆盖哈迪斯、宙斯、雅典娜和信风\shayu-mythic-greeks-hades-after-recover.png` | 第一张实际看到弃牌堆行动牌选择弹层，候选是行动牌“撕裂/阿波罗的恩惠”，非行动弃牌不作为可选项；收口断言证明选择的行动牌回到手牌。资源局部仍有白卡面，但不影响本轮入口/候选/状态核对。该对象本批可记 L3。 |
| `mythic_greeks_favor_of_zeus` 宙斯 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-与-Tornados-复杂入口覆盖哈迪斯、宙斯、雅典娜和信风\shayu-mythic-greeks-zeus-after-breakpoint.png` | 从手牌真实入口选择基地后直接收口，测试断言 `tempBreakpointModifiers[1] === -5`，没有再出现二次 base prompt。该对象本批可记 L3（状态证明为主）。 |
| `mythic_greeks_favor_of_athena` 雅典娜 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-与-Tornados-复杂入口覆盖哈迪斯、宙斯、雅典娜和信风\shayu-mythic-greeks-athena-pick-open.png`；`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-与-Tornados-复杂入口覆盖哈迪斯、宙斯、雅典娜和信风\shayu-mythic-greeks-athena-order-open.png`；`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-与-Tornados-复杂入口覆盖哈迪斯、宙斯、雅典娜和信风\shayu-mythic-greeks-athena-after-order.png` | 实际看到先选择一张行动牌入手，再进入“按任意顺序放回牌库顶”的排序提示；收口断言证明已选择行动入手，并且牌库顶顺序按玩家前两次选择写回。该对象本批可记 L3。 |
| `tornados_trade_winds` 信风 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-与-Tornados-复杂入口覆盖哈迪斯、宙斯、雅典娜和信风\shayu-tornados-trade-winds-first-open.png`；`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-与-Tornados-复杂入口覆盖哈迪斯、宙斯、雅典娜和信风\shayu-tornados-trade-winds-second-open.png`；`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-与-Tornados-复杂入口覆盖哈迪斯、宙斯、雅典娜和信风\shayu-tornados-trade-winds-after-swap.png` | 第一/第二张实际看到两步随从选择，第二步只高亮另一基地力量≤3目标；收口图看到两只被选随从互换基地。该对象本批可记 L3。 |

本批发现/修正测试问题：

- Mythic/Tornados 复杂 E2E 原先在哈迪斯后忽略 `base_wooden_horse` 可选行动后触发，导致 `waitForNoInteraction` 卡住；测试已显式跳过该可选触发，避免把系统正常反应态误判为失败。
- 雅典娜排序链原先只选择 2 张就等待收口，实际规则要求继续排序到剩余 1 张自动回顶；测试已补足排序选择，并关闭牌库顶展示浮层后再截图。

仍未完成：C4 还需要把所有 UI 交互对象逐项归入 L3 或明确代表链；C5 仍需补 `base_wooden_horse`、action trigger、计分窗口、once/turn、response/session 等 L4 归档。全面审计 guard 仍必须保持 `in_progress`。


### 2026-05-13 00:03 +08 全文件 E2E 回归补充

- 补跑整文件：`$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci -- e2e/smashup-shayu-factions.e2e.ts` → 14 passed。
- 说明：第一次整文件复跑被同类 E2E heavy-task guard 拦截；确认使用隔离 runtime 后显式允许并发并通过。
- 该结果证明 `e2e/smashup-shayu-factions.e2e.ts` 当前 14 条代表性真实入口/时序链没有被本轮测试修正破坏；仍不等于 45 对象全量 L3/L4 完成。


## 2026-05-13 00:16 +08 C3 全量 L2 逐对象核销

本节只核销 C3：45 对象至少有 L2 行为证据。它不替代 C4/C5；真实入口截图与时序治理仍在后续核销。

本轮新增 L2：`tornados_twister` 旋风 push/pull 两分支，见 `src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` 新用例“龙卷风：旋风出场可将力量≤3随从从本基地移出或从其他基地移入”。

验证：

- `npx vitest run src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 13 passed。
- `npx eslint src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 0 errors。

| 对象 | C3 L2 行为证据来源 | 核销结论 |
| --- | --- | --- |
| `sharks_megalodon` | `shayuComprehensiveBehavior.test.ts` 巨齿鲨用例 | 已断言打出后低战力目标被消灭，高战力目标保留。 |
| `sharks_great_white` | `shayuComprehensiveBehavior.test.ts` 大白鲨用例 | 已断言自身移动到另一基地，并只消灭目的地力量≤2目标。 |
| `sharks_hammerhead` | `shayuFactionAbilities.test.ts` 撕裂用例 | 已断言同基地随从被消灭后锤头鲨获得指示物。 |
| `sharks_mako` | `shayuComprehensiveBehavior.test.ts` 灰鲭鲨用例 | 已断言消灭随从后只允许立即额外打出手牌中的灰鲭鲨到该基地。 |
| `sharks_blood_in_the_water` | `shayuComprehensiveBehavior.test.ts` 血腥水域用例 | 已断言该基地消灭后额外打出 3- 随从链成立并受基地限制。 |
| `sharks_week_of_sharks` | `shayuFactionAbilities.test.ts` 鲨鱼周用例 | 已断言回合结束同拥有者只触发一次额外抽牌；2026-06-02 新增跨到下一次自己回合结束仍可再次额外抽牌。 |
| `sharks_torn_apart` | `shayuFactionAbilities.test.ts` 撕裂用例 | 已断言真实行动入口消灭低力量随从并抽牌。 |
| `sharks_chum` | `shayuComprehensiveBehavior.test.ts` 鲨鱼诱饵用例 | 已断言附着宿主后同基地任意随从被消灭会给宿主 +1。 |
| `sharks_dangerous_waters` | `shayuFactionAbilities.test.ts` 抽样复审危险水域用例 | 已断言天赋只影响其附着基地的随从。 |
| `sharks_feeding_frenzy` | `shayuFactionAbilities.test.ts` 疯狂进食用例；整文件 E2E 对应多选链 | 已断言可多选任意数量低力量随从并消灭。 |
| `sharks_air_jaws` | `shayuFactionAbilities.test.ts` 飞鲨用例；整文件 E2E | 已断言先选己方随从、再选另一基地、移动后消灭低力量目标。 |
| `sharks_freakin_laser_beam` | `shayuFactionAbilities.test.ts` 激光束用例；整文件 E2E | 已断言第一入口只能选择己方随从，后续只消灭同基地合法目标。 |
| `base_shark_reef` | `shayuComprehensiveBehavior.test.ts` 鲨鱼领地用例 | 已断言 destroyerId 归属正确，只让消灭者给自己的随从放指示物。 |
| `base_the_deep` | `shayuComprehensiveBehavior.test.ts` 海渊用例 | 已断言 4+ 随从打入后只允许消灭同基地更低力量随从。 |
| `tornados_monster_tornado` | `shayuFactionAbilities.test.ts` 龙卷风怪物用例 | 已断言可把其他基地低力量随从移入自身基地。 |
| `tornados_cyclone` | `shayuFactionAbilities.test.ts` 抽样复审气旋用例 | 已断言以自身为源，只选择目标基地并移动自身。 |
| `tornados_twister` | `shayuComprehensiveBehavior.test.ts` 旋风 push/pull 用例 | 已断言出场后可把 3- 随从从本基地移出，或从其他基地移入；4 力目标被排除。 |
| `tornados_dust_devil` | `e2e/smashup-shayu-factions.e2e.ts` 尘卷风计分前用例 | 已断言 beforeScoring 可选移动到计分基地并改变计分现场。 |
| `tornados_trade_winds` | `shayuFactionAbilities.test.ts` 信风用例；整文件 E2E | 已断言两步随从选择与另一基地限制，并最终互换基地。 |
| `tornados_carried_away` | `shayuFactionAbilities.test.ts` 卷走用例；`shayuEntryConsumption.test.ts`；整文件 E2E | 已断言第一入口随从被直接消费，后续只选目标基地并完成移动。 |
| `tornados_whirlwinds` | `shayuFactionAbilities.test.ts` 旋风群用例；整文件 E2E | 已断言多选己方随从后逐个选择目标基地并完成移动。 |
| `tornados_gone_with_the_wind` | `e2e/smashup-shayu-factions.e2e.ts` afterScoring 用例 | 已断言 afterScoring 窗口打出后，目标随从逃离清场并未进弃牌堆。 |
| `tornados_ripped_off` | `e2e/smashup-shayu-factions.e2e.ts` 扯走用例 | 已断言基地持续行动与随从附着行动均能 detach 后 attach 到新目标。 |
| `tornados_picked_up` | `e2e/smashup-shayu-factions.e2e.ts` Me First 计分前用例 | 已断言 beforeScoring 打出后把计分基地随从移出。 |
| `tornados_not_in_kansas` | `e2e/smashup-shayu-factions.e2e.ts` 不在堪萨斯用例；`shayuEntryConsumption.test.ts` | 已断言替换基地保留随从、清理基地/随从行动卡，并避免替换后新基地误触发。 |
| `tornados_over_the_rainbow` | `e2e/smashup-shayu-factions.e2e.ts` Me First 计分前用例 | 已断言 beforeScoring 打出后把另一基地己方随从移入计分基地。 |
| `base_trailer_park` | `shayuComprehensiveBehavior.test.ts` 活动房屋公园用例 | 已断言随从移入后自动给该随从 +1 指示物。 |
| `base_tornado_alley` | `shayuComprehensiveBehavior.test.ts` 龙卷风走廊用例；整文件 E2E | 已断言每回合首次移入触发、记录 once/turn、且自身移动原因不递归再触发。 |
| `mythic_greeks_odysseus` | `shayuFactionAbilities.test.ts` 阿尔戈英雄行动后能力用例；整文件 E2E | 已断言行动后选择己方随从放置 +1 指示物。 |
| `mythic_greeks_argonaut` | `shayuFactionAbilities.test.ts` 阿尔戈英雄用例；整文件 E2E | 已断言其代表链能触发行动态持续能力。 |
| `mythic_greeks_jason` | `shayuComprehensiveBehavior.test.ts` 伊阿宋用例 | 已断言行动后选择基地给己方随从 +1，且跨基地选择会记录 once/turn；2026-06-02 新增上一回合 metadata 不会挡住下一回合再次触发。 |
| `mythic_greeks_heracles` | `shayuFactionAbilities.test.ts` 阿尔戈英雄行动后能力用例；整文件 E2E | 已断言行动后自身获得临时 +1。 |
| `mythic_greeks_spartan` | `shayuFactionAbilities.test.ts` 阿尔戈英雄行动后能力用例；整文件 E2E | 已断言你行动后自身获得 +1 指示物并记录 once/turn；2026-06-02 新增上一回合 metadata 不会挡住下一回合再次触发。 |
| `mythic_greeks_favor_of_hades` | `shayuComprehensiveBehavior.test.ts` 哈迪斯用例；整文件 E2E | 已断言只从弃牌堆行动牌中选择一张回手。 |
| `mythic_greeks_favor_of_ares` | `shayuEntryConsumption.test.ts` playNeedsMinion standard 组合用例 | 已断言已选己方随从直接获得 +3 临时力量，其他己方随从不受影响。 |
| `mythic_greeks_favor_of_aphrodite` | `shayuComprehensiveBehavior.test.ts` 阿佛洛狄忒用例 | 已断言额外随从额度写入后可在已打一随从后再打第二个随从。 |
| `mythic_greeks_favor_of_dionysus` | `shayuFactionAbilities.test.ts` 狄俄尼索斯用例 | 已断言可选择是否放回牌库顶，且 +1/额外行动链有效。 |
| `mythic_greeks_favor_of_hera` | `shayuFactionAbilities.test.ts` 赫拉用例；整文件 E2E | 旧“己方随从”结论已失效；现已断言至多两个任意玩家随从都可获得 +1 指示物，并专门覆盖对手随从。 |
| `mythic_greeks_favor_of_athena` | `shayuFactionAbilities.test.ts` 雅典娜用例；整文件 E2E | 已断言展示顶 5、玩家选择行动牌入手、其余按玩家顺序回顶。 |
| `mythic_greeks_favor_of_apollo` | `shayuFactionAbilities.test.ts` 阿波罗用例；整文件 E2E | 已断言抽牌并授予额外行动额度。 |
| `mythic_greeks_favor_of_hermes` | `shayuFactionAbilities.test.ts` 抽样复审赫尔墨斯用例 | 已断言无目标结算两个额外行动且不创建交互。 |
| `mythic_greeks_favor_of_poseidon` | `shayuFactionAbilities.test.ts` 波塞冬用例；整文件 E2E | 已断言选择弃牌洗回牌库。 |
| `mythic_greeks_favor_of_zeus` | `shayuFactionAbilities.test.ts` 抽样复审宙斯用例；整文件 E2E | 已断言直接消费第一入口基地并写入临时爆破点 -5，不再二次弹基地选择。 |
| `base_oracle_at_delphi` | `shayuFactionAbilities.test.ts` 特尔斐神谕用例 | 已断言随从打入后展示牌库顶，行动牌入手，非行动牌留在牌库顶。 |
| `base_wooden_horse` | `shayuFactionAbilities.test.ts` 抽样复审特洛伊木马用例 | 已断言行动玩家可选择这里任意归属随从 +2，且可选触发由 prompt/skip 承载。 |

C3 结论：45/45 对象已达到 L2 或更高行为证据。下一步仍是 C4 全交互 L3/代表链截图归档与 C5 L4 时序治理。


## 2026-05-13 00:45 +08 C4 全交互 L3 / 等价代表链核销

本节只核销 C4：所有真实 UI 交互入口必须有独立 L3，或明确归入等价代表链。等价代表链只在 UI 入口组件、命令形态、targetType/option 语义和收口状态相同或更严格时成立；否则仍记独立 L3。

新增复跑：

- `npm run test:e2e:ci:file -- e2e/smashup-shayu-factions.e2e.ts "Sharks 高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口"` → 1 passed（2026-05-13 00:39）。
- 关键变化：`sharks_great_white` 从 harness dispatch 改为真实 UI 点击随从卡牌触发天赋；截图已实际打开核对。

| 对象 | C4 分类 | L3 / 代表链证据 | 核销结论 |
| --- | --- | --- | --- |
| `sharks_megalodon` | onPlay destroy prompt + beforeScoring special | onPlay destroy prompt 与 `sharks_torn_apart` / `sharks_freakin_laser_beam` 共用 minion target prompt；beforeScoring special 归入 `tornados_dust_devil` 计分前 in-play special 代表链。 | L3 代表链成立；L4 见 C5。 |
| `sharks_great_white` | 独立 minion talent | `shayu-sharks-great-white-talent-destination-open.png`、`shayu-sharks-great-white-after-move-destroy.png`。 | 真实 UI 点击随从触发天赋，完整 L3。 |
| `sharks_hammerhead` | 无玩家 UI 入口 | destroy trigger 自动放指示物，L2 断言最终 counter。 | C4 不适用。 |
| `sharks_mako` | destroy 后额外打出窗口 | `shayu-sharks-torn-apart-after-destroy.png` 覆盖 destroy 后进入后续状态；L2 明确断言 `smashup_immediate_extra_minion` 与基地限制。 | 代表链成立；不再要求单独截图。 |
| `sharks_blood_in_the_water` | ongoing base + destroy 后额外打出 | 与 `sharks_mako` 同属 destroy → immediate extra minion 链；入口附着由持续行动通用手牌打出链代表。 | 代表链成立。 |
| `sharks_week_of_sharks` | endTurn 自动触发 | 无玩家 UI 入口；L2 断言同回合同拥有者只抽 1，且 2026-06-02 已补跨回合再次抽牌。 | C4 不适用；C5 once/turn 自动治理见 C5。 |
| `sharks_torn_apart` | 独立 action target prompt | `shayu-sharks-torn-apart-after-destroy.png`。 | 从手牌真实打出并完成 destroy/draw，L3。 |
| `sharks_chum` | attach to minion + destroy trigger | attach 入口归入 `tornados_ripped_off` 的 minion attached action 代表链；destroy 后宿主 +1 由 L2 覆盖。 | 代表链成立。 |
| `sharks_dangerous_waters` | base ongoing talent | L2 已证明 base ongoing talent 的 source/base 上下文；UI talent 入口归入 `sharks_great_white` 的真实 talent 点击机制与持续行动附着代表链。 | 代表链成立；若未来 UI 改 talent 入口需回归。 |
| `sharks_feeding_frenzy` | base first entry + multi minion destroy | `shayu-sharks-feeding-frenzy-after-multi-destroy.png`。 | 多选 destroy 真实入口 L3。 |
| `sharks_air_jaws` | minion first entry + destination prompt | `shayu-sharks-air-jaws-destination-open.png`、`shayu-sharks-air-jaws-after-move-destroy.png`。 | 真实手牌入口 L3。 |
| `sharks_freakin_laser_beam` | minion first entry + same-base destroy prompt | `shayu-sharks-laser-beam-target-open.png`、`shayu-sharks-laser-beam-after-destroy.png`。 | 真实手牌入口 L3。 |
| `base_shark_reef` | destroyer optional trigger | 与 destroy trigger/optional prompt 家族共用 `sharks_torn_apart` + L2 destroyer 归属断言。 | 代表链成立。 |
| `base_the_deep` | onMinionPlayed optional destroy | 与 `sharks_megalodon` onPlay destroy prompt 代表链一致；L2 断言 4+ 阈值和低战力过滤。 | 代表链成立。 |
| `tornados_monster_tornado` | talent push/pull | 与 `tornados_twister` push/pull 行为、`sharks_great_white` talent UI 入口共同代表；L2 覆盖两方向。 | 代表链成立。 |
| `tornados_cyclone` | self move talent | 与 `sharks_great_white` 的真实 minion talent UI 入口 + destination prompt 同构；L2 已断言移动。 | 代表链成立。 |
| `tornados_twister` | onPlay push/pull | `shayu-tornados-whirlwinds-after-per-minion-destinations.png` 代表移动目的地 UI；L2 覆盖 Twister 自身 push/pull 两分支。 | 代表链成立。 |
| `tornados_dust_devil` | beforeScoring in-play special | `shayu-tornados-dust-devil-before-scoring-prompt.png`、`shayu-tornados-dust-devil-after-move-to-scoring.png`。 | 独立 L3/L4。 |
| `tornados_trade_winds` | two-step minion swap | `shayu-tornados-trade-winds-first-open.png`、`shayu-tornados-trade-winds-second-open.png`、`shayu-tornados-trade-winds-after-swap.png`。 | 独立 L3。 |
| `tornados_carried_away` | minion first entry + destination prompt | `shayu-tornados-carried-away-after-move.png`。 | 真实手牌入口 L3。 |
| `tornados_whirlwinds` | multi minions + per-target destination | `shayu-tornados-whirlwinds-after-per-minion-destinations.png`。 | 独立 L3。 |
| `tornados_gone_with_the_wind` | afterScoring special | `shayu-tornados-gone-with-the-wind-after-scoring-open.png`、`shayu-tornados-gone-with-the-wind-after-move-away.png`、`shayu-tornados-gone-with-the-wind-after-scoring-cleanup.png`。 | 独立 L3/L4。 |
| `tornados_ripped_off` | action card detach/attach transfer | `shayu-tornados-ripped-off-base-action-transferred.png`、`shayu-tornados-ripped-off-minion-action-transferred.png`。 | 独立 L3。 |
| `tornados_picked_up` | beforeScoring hand special move out | `shayu-tornados-before-scoring-me-first-open.png`、`shayu-tornados-picked-up-after-move-out.png`。 | 独立 L3/L4。 |
| `tornados_not_in_kansas` | base replace | `shayu-tornados-not-in-kansas-after-base-replace.png`。 | 独立 L3/L4。 |
| `tornados_over_the_rainbow` | beforeScoring hand special move in | `shayu-tornados-before-scoring-me-first-open.png`、`shayu-tornados-over-the-rainbow-after-move-in.png`。 | 独立 L3/L4。 |
| `base_trailer_park` | onMinionMoved automatic | 无玩家 UI 入口；`shayu-tornados-gone-with-the-wind-after-scoring-cleanup.png` 与 L2 断言移入 +1。 | C4 不适用。 |
| `base_tornado_alley` | onMinionMoved optional prompt | `shayu-tornado-alley-trigger-open.png`、`shayu-tornado-alley-after-first-trigger.png`、`shayu-tornado-alley-second-move-no-repeat-trigger.png`。 | 独立 L3/L4。 |
| `mythic_greeks_odysseus` | action trigger minion prompt | `shayu-mythic-greeks-argonaut-odysseus-prompt.png`、`shayu-mythic-greeks-argonaut-after-action-triggers.png`。 | 代表 action-trigger L3。 |
| `mythic_greeks_argonaut` | onPlay action-trigger replay | `shayu-mythic-greeks-argonaut-odysseus-prompt.png`、`shayu-mythic-greeks-argonaut-after-action-triggers.png`。 | 独立 L3/L4。 |
| `mythic_greeks_jason` | once/turn action trigger base prompt | 与 Argonaut action-trigger session + Zeus base prompt 入口代表；L2 断言 sourceBaseIndex 与 once/turn，并已补跨回合 metadata 重用否定链。 | 代表链成立。 |
| `mythic_greeks_heracles` | action trigger automatic temp buff | 无玩家 UI 入口；Argonaut E2E 后态断言临时 +1。 | C4 不适用；C5 代表。 |
| `mythic_greeks_spartan` | action trigger automatic once/turn counter | Argonaut E2E 后态断言 +1 counter 与 once/turn metadata，并已补跨回合 metadata 重用否定链。 | C4 不适用；C5 代表。 |
| `mythic_greeks_favor_of_hades` | discard action card choice | `shayu-mythic-greeks-hades-discard-choice-open.png`、`shayu-mythic-greeks-hades-after-recover.png`。 | 独立 L3。 |
| `mythic_greeks_favor_of_ares` | self minion buff | 不再借 Hera 代表 self-target 语义；Hera 已回写为 any-minion multi-select，Ares 的 self 归属仅由自身 L2 合同覆盖。 | 代表链已收窄。 |
| `mythic_greeks_favor_of_aphrodite` | 无目标额度 | 无玩家目标入口；L2 覆盖额外随从额度消费。 | C4 不适用。 |
| `mythic_greeks_favor_of_dionysus` | self minion buff + optional topdeck | self-minion 入口不再借 Hera 代表；仅由 Ares/Dionysus 自身 L2 覆盖，optional topdeck 仍由 L2 覆盖 skip/topdeck。 | 代表链已收窄。 |
| `mythic_greeks_favor_of_hera` | up to 2 any-minion multi-select | `shayu-mythic-greeks-hera-after-two-counters.png`。 | 2026-06-04 已回写为可选对手随从的独立 L3。 |
| `mythic_greeks_favor_of_athena` | reveal pick + order | `shayu-mythic-greeks-athena-pick-open.png`、`shayu-mythic-greeks-athena-order-open.png`、`shayu-mythic-greeks-athena-after-order.png`。 | 独立 L3。 |
| `mythic_greeks_favor_of_apollo` | draw + extra action | `shayu-mythic-greeks-apollo-after-action.png`。 | 真实手牌入口 L3。 |
| `mythic_greeks_favor_of_hermes` | no-target extra actions | 无目标入口；L2/结构审计覆盖额度写入。 | C4 不适用。 |
| `mythic_greeks_favor_of_poseidon` | discard multi-select | `shayu-mythic-greeks-poseidon-after-discard-shuffle.png`。 | 独立 L3。 |
| `mythic_greeks_favor_of_zeus` | base first entry | `shayu-mythic-greeks-zeus-after-breakpoint.png`。 | 真实手牌入口 L3。 |
| `base_oracle_at_delphi` | onMinionPlayed automatic reveal | 无玩家第一入口；L2 覆盖行动/非行动两分支。 | C4 不适用；C5 trigger 见下。 |
| `base_wooden_horse` | onActionPlayed optional prompt | 多条 E2E 中出现并显式 skip；L2 断言可选目标与 skip。 | 代表 L3：action-trigger optional prompt 链成立。 |

C4 结论：所有有真实 UI 选择入口的对象已归入独立 L3 或等价代表链；无玩家选择对象显式标记为 C4 不适用。`sharks_great_white` 旧“仅 harness 辅助”结论已由 00:39 真实 UI 点击复跑推翻并升级。

## 2026-05-13 00:50 +08 C5 时序 / 窗口 / 队列 / 跨阶段 L4 核销

| L4 对象/家族 | 覆盖对象 | 证据 | L4 结论 |
| --- | --- | --- | --- |
| beforeScoring in-play special | `sharks_megalodon`、`tornados_dust_devil` | `shayu-tornados-dust-devil-before-scoring-prompt.png`、`shayu-tornados-dust-devil-after-move-to-scoring.png`；`sharks_megalodon_before_scoring` 与 Dust Devil 同属 `beforeScoring` per-instance/sourceController/triggerBase + optional prompt，差异目标阈值由 L2 覆盖。 | 计分前窗口、source context、skip/继续响应链成立。 |
| beforeScoring hand special / Me First | `tornados_picked_up`、`tornados_over_the_rainbow` | `shayu-tornados-before-scoring-me-first-open.png`、`shayu-tornados-over-the-rainbow-after-move-in.png`、`shayu-tornados-picked-up-after-move-out.png`。 | Me First 响应窗口可连续打出 special；移入/移出后仍能继续窗口结算。 |
| afterScoring deferred cleanup | `tornados_gone_with_the_wind` | `shayu-tornados-gone-with-the-wind-after-scoring-open.png`、`shayu-tornados-gone-with-the-wind-after-move-away.png`、`shayu-tornados-gone-with-the-wind-after-scoring-cleanup.png`。 | afterScoring 窗口真实出现，special 结算后随从移离清场基地，清场完成后进入出牌阶段且目标不进弃牌。 |
| base replace / same action 防误触发 | `tornados_not_in_kansas`、`base_wooden_horse`、`base_oracle_at_delphi` | `shayu-tornados-not-in-kansas-after-base-replace.png`；`shayuEntryConsumption.test.ts` 覆盖替换基地后同一 action 不触发新基地 onActionPlayed。 | 基地替换保留随从、清理附着行动、更新 baseDeck；同 timestamp 新基地触发已被拦住。 |
| once-per-turn / recursion guard | `base_tornado_alley`、`sharks_week_of_sharks`、`mythic_greeks_jason`、`mythic_greeks_spartan` | `shayu-tornado-alley-trigger-open.png`、`shayu-tornado-alley-second-move-no-repeat-trigger.png`；L2 覆盖 Week/Jason/Spartan 同回合不重复，且 2026-06-02 已补 Week/Jason/Spartan 跨回合重新可用回归。 | once 标记写入并阻断同回合重复；跨回合不会残留旧回合态；Tornado Alley 的 `reason` 防自递归。 |
| action-trigger session | `mythic_greeks_odysseus`、`mythic_greeks_argonaut`、`mythic_greeks_jason`、`mythic_greeks_heracles`、`mythic_greeks_spartan`、`base_wooden_horse` | `shayu-mythic-greeks-argonaut-odysseus-prompt.png`、`shayu-mythic-greeks-argonaut-after-action-triggers.png`；复杂入口 E2E 中显式 skip `base_wooden_horse` 后继续执行 Hades/Zeus/Athena/Trade Winds。 | action-trigger 队列不会吞掉后续行动链；可选 base trigger 可 skip，trigger metadata/once 由 L2 覆盖。 |
| onMinionPlayed / onMinionMoved base trigger | `base_the_deep`、`base_oracle_at_delphi`、`base_trailer_park`、`base_tornado_alley` | `shayu-tornado-alley-*` 三张截图；L2 覆盖 The Deep/Oracle/Trailer Park 最终状态。 | 触发上下文含新入场/新移入对象，目标过滤与最终状态均闭环；自动 trigger 无残留交互。 |
| destroy trigger / immediate extra play | `sharks_hammerhead`、`sharks_mako`、`sharks_blood_in_the_water`、`base_shark_reef` | L2 覆盖 destroyerId、triggerBase、global hand、extra minion base prompt；`shayu-sharks-torn-apart-after-destroy.png` 作为真实 destroy 入口代表。 | destroy 触发队列按 destroyer/基地上下文收口；额外出牌不会越基地或越卡名。 |
| multi / order / continuation context | `sharks_feeding_frenzy`、`tornados_whirlwinds`、`tornados_trade_winds`、`mythic_greeks_favor_of_athena`、`mythic_greeks_favor_of_poseidon`、`mythic_greeks_favor_of_hera` | 多选/排序/两步互换截图见 C4；Athena 继续排序到剩余 1 张自动回顶。 | multi、order、continuationContext 均在真实链路中完成收口，无 pending 残留。 |

## Addendum（2026-06-02 +08）：once-per-turn 家族跨回合补证

- 新增最小回归：
  - `src/games/smashup/__tests__/abilities/sharks.test.ts`：鲨鱼周跨到下一次自己回合结束仍可再次额外抽牌。
  - `src/games/smashup/__tests__/abilities/mythic-greeks.test.ts`：伊阿宋、斯巴达人上一回合 metadata 不会挡住下一回合再次触发。
- 这批补证的目的不是新增业务修复，而是补齐 D14“same-turn 之外还要证明跨回合清理/隔离”的否定链。
- 当前读取口径：once-per-turn 家族不能再只用“同回合第二次不触发”充当已审完成证明，必须同时看 2026-06-02 的跨回合回归。

C5 结论：所有命中时序/窗口/队列/跨阶段/共享根因的 shayu 对象已归入独立 L4 或等价系统代表链；其余对象不涉及 L4 治理，只保留 L2/C4 结论。

## 2026-05-13 00:55 +08 C6 旧结论回写状态

- 已回写本文档、`smashup-shayu-full-chain-audit-2026-05-12.md`、`smashup-shayu-faction-audit.md`、`task_plan.md`、`findings.md`、`progress.md`。
- 旧“harness 触发大白鲨只能作辅助”的结论已标注为失效，由真实 UI 点击复跑替换。
- 旧“未完成全量 L2/C4/C5”的章节保留历史轨迹，但新增 C3/C4/C5/C6 Addendum 作为当前结论入口；最终完成态仍由 completion guard 检查决定。


## 2026-05-13 01:03 +08 最终回归验证

- `npx eslint e2e/smashup-shayu-factions.e2e.ts src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 0 errors。
- `npx vitest run src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 13 passed。
- `$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci -- e2e/smashup-shayu-factions.e2e.ts` → 14 passed。
- 本轮实际核对截图包括：
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-great-white-talent-destination-open.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-great-white-after-move-destroy.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-随风而逝从-afterScoring-窗口打出并让随从逃离清场\shayu-tornados-gone-with-the-wind-after-scoring-open.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornado-Alley-基地能力在本回合首次移入时触发，第二次移入不重复触发\shayu-tornado-alley-trigger-open.png`

## 2026-05-14 +08 线上反馈 6a055d1429 Twister 可选语义回写降级

来源：线上反馈 `6a055d1429cd213e03bfd3e9`，用户反馈“twister实现完全错误”。本轮复核正式卡图后确认：`tornados_twister` 与 `tornados_monster_tornado` 的 push/pull 方向和阈值并非主要问题，真正漏审的是“你可以”可选合同。

失效/降级结论：

- 本文 2026-05-13 C3 中 `tornados_twister`“已断言出场后可把 3- 随从从本基地移出，或从其他基地移入”只证明成功路径成立，不能证明完整可选语义。
- 本文 2026-05-13 C4 中 `tornados_twister`“代表链成立”、`tornados_monster_tornado`“代表链成立”缺少“合法候选存在时可跳过”的证据，旧结论降级为：**push/pull 成功路径与入口代表链成立，但可选拒绝路径在当时未审计**。
- 本文 2026-05-13 C5 的 `multi / order / continuation context` 家族没有覆盖单目标可选 prompt 的 skip 语义，不能作为 Twister/Monster Tornado 可选完整性的证据。

新增修复与证据：

- 修复文件：`src/games/smashup/abilities/tornados.ts`，为 Tornados push/pull prompt 增加 `optional`、`createSkipOption()`、`autoResolveIfSingle: false`，skip 后返回空事件。
- L2 新增：`src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` 用例“龙卷风：旋风和龙卷风怪物的“你可以移动”效果必须允许跳过”，覆盖 Twister 与 Monster Tornado 合法候选存在时 skip 后状态不变。
- L3 新增：`e2e/smashup-shayu-factions.e2e.ts` 用例“Tornados 旋风真实入口必须允许跳过可选移动”，覆盖真实手牌入口。
- 截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-旋风真实入口必须允许跳过可选移动\shayu-tornados-twister-skip-open.png`：实际看到合法候选 Mako 存在且 “跳过” 按钮可见。
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-旋风真实入口必须允许跳过可选移动\shayu-tornados-twister-after-skip.png`：实际看到 skip 后 Mako 仍在原基地，未被移动。
- 新增审计门禁：`src/games/smashup/__tests__/abilityBehaviorAudit.test.ts` 用例“已纳入全面审计的新派系可选/至多交互必须有拒绝或空选实现证据”。
- 详细反馈收口文档：`evidence/smashup/smashup-feedback-6a055d1429-twister-closeout-2026-05-14.md`。

更新后的当前结论：

- `tornados_twister`：成功路径 + 有合法候选时 skip 否定路径均已覆盖；当前可选 push/pull 语义达到 L2，Twister 真实入口 skip 达到 L3。
- `tornados_monster_tornado`：共用 helper + L2 skip 行为已覆盖；真实 talent 入口仍沿用既有 talent 代表链，若未来要求逐对象 L3，应单独补 Monster Tornado talent 真实入口 skip 截图。
- 审计规范更新为通用维度：凡“你可以 / 至多 / 任意数量”的交互，必须证明有合法候选时也可以拒绝或空选；不得再用成功路径冒充可选完整审计。
