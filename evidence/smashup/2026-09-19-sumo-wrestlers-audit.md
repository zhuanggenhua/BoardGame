# 大杀四方相扑手单派系全面审计

## 基本信息

- 对象：相扑手 `sumo_wrestlers`
- 日期：2026-09-19
- 文档类型：`audit`
- 主真相源：`src/games/smashup/data/factions/international_incident.ts`、`public/locales/zh-CN/game-smashup.json`
- 实现消费源：`src/games/smashup/abilities/international_incident.ts`
- 既有审计源：`evidence/smashup/2026-07-15-international-incident-effect-atom-matrix.md`、`evidence/smashup/2026-09-18-international-incident-audit.md`
- 目标入口 / 环境：Smash Up 领域测试、真实浏览器牌桌入口、资源合同测试；本地 E2E 使用 6174 / 20000 / 21000 测试环境。

## 审计范围

本轮锁定相扑手派系的 12 张唯一卡牌和 2 张基地，共 14 个对象。静态数据为 20 张实体牌：10 张行动牌、10 张随从牌；本轮不扩大到火枪手、骑警、摔角手的规则实现，也不把远端 R2 / CDN 发布作为本地规则正确性的替代证据。

对象清单：

`sumo_wrestlers_technique_prize`、`sumo_wrestlers_performance_prize`、`sumo_wrestlers_head_butt`、`sumo_wrestlers_bulking_stew`、`sumo_wrestlers_body_slam`、`sumo_wrestlers_chikara_mizu`、`sumo_wrestlers_grasp_the_belt`、`sumo_wrestlers_fighting_spirit_prize`、`sumo_wrestlers_yokozuna`、`sumo_wrestlers_third_tier`、`sumo_wrestlers_top_tier`、`sumo_wrestlers_rookie_sumo`、`base_heya_training_stable`、`base_the_dohyo`。

## 结论等级

结论：`规则与真实入口范围已闭合；整体发布仍有残余`。

- 14 个对象的静态归属、规则描述、注册入口、领域执行和最终状态消费均已逐条核对。
- 本轮确认并修复 3 类真实规则 / 交互问题：身体猛击自动取第一项、关胁固定第一目的地且不能跳过、相扑新人有手牌时被迫弃牌。
- 相扑手专属真实入口 E2E 已为 3 条并全部通过，覆盖 14/14 对象的真实牌桌入口；其中 3 类修复的多步选择和最终状态也已直接回查。
- 14 个对象的规则实现、领域行为、真实交互入口和最终状态消费已闭合；当前不再保留“相扑手缺少逐对象浏览器入口”的审计缺口。
- 四派系共享 E2E 当前为 7 条通过、7 条失败；失败集中在选秀虚拟列表定位、其他派系计分前响应 / 额外行动链和共享 targetType 审计，不作为相扑手规则已通过的额外证据。
- 仍有残余的是远端 R2 / CDN 资源公开发布链，以及不属于相扑手本轮的四派系共享基线问题。

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | `international_incident.ts` 的相扑手数组和本文 14 行对象表一致。 |
| 真相源状态 | `passed` | 卡面规则文案、静态卡牌 / 基地定义和既有矩阵均可回查；未使用实现字段替代规则描述。 |
| 原子语义断言 | `passed` | 每个对象单独拆出触发时机、主体、目标、可选性、数值、持续时间和负向路径。 |
| 实现消费链 | `passed` | 已追到注册、候选生成、Choice Request / trigger、事件构造和 reducer 最终状态。 |
| 最终权威结果 | `passed` | 领域测试断言随从位置、力量指示物、临时力量、手牌、弃牌堆、保护和基地触发状态。 |
| 交互真实入口 | `passed` | 相扑手专属 E2E 3 条通过，覆盖 14/14 对象；三段测试分别覆盖修复链、剩余行动牌和横纲 / 大关 / 两座基地。 |
| 验证证据 | `passed_scoped` | 领域 / 资源 / 反应与基地测试共 57 条通过；相扑手专属 E2E 3 条通过；共享 transport 回归测试 30 条通过。 |
| 共享影响与代表链依据 | `scoped_debt` | 共享 move / minion-effect / base-trigger 流程已核对；四派系共享 E2E 与 targetType 审计仍有不属于相扑手修复链的失败。 |
| 缺口分类与范围裁定 | `passed` | 已区分实现问题、共享回归、当前范围验证缺口和远端资源发布残余。 |
| 旧 evidence / 旧结论回写 | `passed` | 本文单独记录 2026-09-19 结论，并在旧四派系审计文档追加相扑手回写。 |
| 残余范围声明 | `scoped_debt` | 相扑手规则与真实入口范围已闭合；整体发布仍因远端 R2 / CDN 未达到公开地址 `HEAD 200` 而保留残余。 |

## 14 个对象逐项审计

| 对象 | 原子语义断言 | 实现消费点 | 最终权威结果 | 真实入口 / 验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| `sumo_wrestlers_technique_prize` 技术奖 | 打出行动后，必须选择一个己方随从，放置 3 个 +1 力量指示物；不能加到敌方随从。 | `sumoTechniquePrize` -> `runMinionEffect` -> `addPowerCounter`；注册为 `onPlay`。 | 目标随从的 `powerCounters` 增加 3，其他随从不变。 | `international-incident.test.ts:319`；专属 E2E `e2e/smashup/smashup-international-incident-sumo-audit.e2e.ts:275-584`。 | 无；真实手牌入口与最终状态已通过。 | 功能实现与真实入口均已验证。 |
| `sumo_wrestlers_yokozuna` 横纲 | 持续效果：其他玩家的卡牌不能移动你的随从；天赋二选一：抽 1 张，或把另一位玩家在这里的一个随从移动到另一个基地；移动不可行时抽牌。 | `protectionHasYokozuna` 注册为 `move` 保护；`sumoYokozunaTalent` -> `yokozunaModePrompt` -> `moveMinionPrompt` / 抽牌。 | 受保护随从的基地位置不变；抽牌写入手牌；移动写入目标基地。 | `international-incident.test.ts:453` 直接证明保护；专属 E2E `e2e/smashup/smashup-international-incident-sumo-audit.e2e.ts:586-782` 覆盖抽牌与移动两分支。 | 无；两分支真实入口与最终状态已通过。 | 功能实现与真实入口均已验证。 |
| `sumo_wrestlers_performance_prize` 表演奖 | 打出后抽 3 张牌；抽牌数量和手牌最终状态必须一致。 | `sumoPerformancePrize` -> `buildStandardDrawEvents`；注册为 `onPlay`。 | 牌库减少 3，手牌增加对应 3 张牌。 | `international-incident.test.ts:2694`；专属 E2E `e2e/smashup/smashup-international-incident-sumo-audit.e2e.ts:275-321`，并保存抽牌后截图。 | 无；真实牌桌入口与最终状态已通过。 | 功能实现与真实入口均已验证。 |
| `sumo_wrestlers_head_butt` 头槌 | 选择一个你有随从的基地，再从该基地选择另一位玩家打在基地或其随从上的一个行动并摧毁；没有合法行动时不能伪造成功。 | `sumoHeadButt` -> `sumoHeadButtPrompt` -> `buildValidatedOngoingDetachEvents`；候选限制到己方随从所在基地和其他玩家行动。 | 行动从随从 / 基地脱离并进入控制者弃牌堆，其他行动保持不变。 | `international-incident.test.ts:1816`；专属 E2E `e2e/smashup/smashup-international-incident-sumo-audit.e2e.ts:275-584` 覆盖敌方附着行动被摧毁。 | 无；真实目标选择与弃牌结果已通过。 | 功能实现与真实入口均已验证。 |
| `sumo_wrestlers_bulking_stew` 炖肉 | 可弃任意数量手牌，包括 0 张；每弃 1 张，在一个己方随从上放 1 个指示物；0 张时不进入目标选择、不改变状态。 | `sumoBulkingStew` -> `bulkingStewDiscardPrompt` 的 `multi.min=0` -> `bulkingStewTargetPrompt` -> 弃牌和 `addPowerCounter`。 | 空选保持手牌 / 指示物不变；多选后弃牌数量等于新增指示物数量。 | `international-incident.test.ts:1816`；专属 E2E `e2e/smashup/smashup-international-incident-sumo-audit.e2e.ts:586-782` 覆盖弃牌、监听器与力量指示物最终状态。 | 无；真实弃牌与触发结果已通过。 | 功能实现与真实入口均已验证。 |
| `sumo_wrestlers_body_slam` 身体猛击 | 选择另一位玩家、选择你有随从且该玩家有随从的来源基地，再选择另一座目的基地；移动该玩家在来源基地的全部随从。 | `sumoBodySlam` -> `bodySlamPlayerPrompt` -> `bodySlamBasePrompt` -> `bodySlamDestinationPrompt` -> `buildValidatedMoveEvents`。 | 只有所选玩家、所选来源基地的随从移动；来源基地和目的基地均按玩家选择落地。 | `international-incident.test.ts:182`；相扑手 E2E 通过，实际选择非第一位玩家、非第一来源基地、非第一目的基地。 | 已修复后验证；不再存在自动取第一项。 | 功能实现已验证；真实入口已证实。 |
| `sumo_wrestlers_chikara_mizu` 力量满溢 | 选择一个己方随从，选择直到回合结束 +2，或弃 1 张牌改为 +4；没有可弃牌时不显示 +4。 | `sumoChikaraMizu` -> `chikaraMizuTargetPrompt` -> `chikaraMizuModePrompt` / `chikaraMizuDiscardPrompt`。 | `+2` / `+4` 进入临时力量状态并在回合结束按共享清理；+4 分支同时写入弃牌堆。 | `international-incident.test.ts:351`；专属 E2E `e2e/smashup/smashup-international-incident-sumo-audit.e2e.ts:275-584` 覆盖 +2 与弃牌 +4 两分支。 | 无；两分支真实入口与最终状态已通过。 | 功能实现与真实入口均已验证。 |
| `sumo_wrestlers_grasp_the_belt` 抓住腰带 | 选择一个你有随从的基地，在该基地选择一个随从，移动到另一个基地；目标可以是任意控制者的随从。 | `sumoGraspTheBelt` -> `runMoveMinion` -> `moveMinionPrompt` / `moveDestinationPrompt`。 | 只有所选随从改变基地位置，其他随从不动。 | `international-incident.test.ts:2694`；专属 E2E `e2e/smashup/smashup-international-incident-sumo-audit.e2e.ts:275-584` 覆盖敌方随从移动。 | 无；真实目标选择与目的地结果已通过。 | 功能实现与真实入口均已验证。 |
| `sumo_wrestlers_fighting_spirit_prize` 斗志奖 | 抽 2 张牌，并在己方随从上总共放置 2 个指示物；可集中给 1 个或分给 2 个，不能给敌方。 | `sumoFightingSpiritPrize` -> `runMinionEffect`，配置 `drawAfter=2`、`multiMax=2`、`singleGetsAll=true`。 | 牌库减少 2、手牌增加 2；指示物总数为 2，敌方随从保持不变。 | `international-incident.test.ts:2694`；专属 E2E `e2e/smashup/smashup-international-incident-sumo-audit.e2e.ts:275-584` 覆盖双目标分配与抽牌结果。 | 无；真实多目标选择与最终状态已通过。 | 功能实现与真实入口均已验证。 |
| `sumo_wrestlers_top_tier` 大关 | 持续监听己方从手牌弃掉一张或多张牌；每次满足条件只在此随从上放 1 个指示物。 | `sumoTopTierOnCardsDiscarded` 注册为 `onCardsDiscarded`；限制 `discardedFromZone='hand'`、控制者匹配、弃牌数量大于 0。 | 大关本体的 `powerCounters` 每次合格弃牌事件增加 1；非手牌来源不触发。 | `international-incident.test.ts:1816`；专属 E2E `e2e/smashup/smashup-international-incident-sumo-audit.e2e.ts:586-782` 由炖肉弃牌触发并回查指示物。 | 无；真实弃牌监听与最终状态已通过。 | 功能实现与真实入口均已验证。 |
| `sumo_wrestlers_third_tier` 关胁 | 天赋可跳过；选择这里另一位玩家力量 3 或以下的一个随从，移动到另一个基地后抽 1 张牌；不移动则不抽牌。 | `sumoThirdTierTalent` -> `runMoveMinion`，按 `getEffectivePower <= 3` 过滤并启用 `allowSkip`，移动完成后共享 `drawAfter`。 | 跳过时基地、手牌、弃牌堆均不变；选择移动时只有目标随从换基地并抽 1 张。 | `international-incident.test.ts:251`；相扑手 E2E 通过，覆盖跳过和非第一目的基地。 | 已修复后验证；不再固定第一座目的基地，也不再强迫移动。 | 功能实现已验证；真实入口已证实。 |
| `sumo_wrestlers_rookie_sumo` 相扑新人 | 天赋可跳过；选择并弃 1 张手牌，再选择一个己方随从放置 2 个指示物；跳过时不弃牌、不加指示物、不进入第二步。 | `sumoRookieSumoTalent` -> `rookieSumoDiscardPrompt` -> `rookieSumoTargetPrompt`；弃牌与加指示物在同一最终事件链中结算。 | 跳过保持手牌 / 弃牌堆 / 指示物不变；确认弃牌后目标随从增加 2。 | `international-incident.test.ts:74`、`:139`；相扑手 E2E 通过跳过路径。 | 已修复后验证；不再把“你可以”实现成有手牌必弃。 | 功能实现已验证；真实入口已证实。 |
| `base_heya_training_stable` 训练馆 | 你的回合开始时可跳过；否则弃 1 张牌并给训练馆上的一个己方随从放 1 个指示物。 | `baseHeyaTrainingStableTurnStart` / `heyaTrainingStablePrompt`；候选为手牌 × 该基地己方随从，显式提供跳过。 | 跳过无事件；确认后对应手牌进入弃牌堆，目标随从指示物 +1。 | `international-incident.test.ts:2396`；专属 E2E `e2e/smashup/smashup-international-incident-sumo-audit.e2e.ts:586-782` 覆盖回合开始触发与最终状态。 | 无；真实基地触发入口已通过。 | 功能实现与真实入口均已验证。 |
| `base_the_dohyo` 土俵 | 你的回合中第一次在这里打出随从后可跳过；否则将这里另一位玩家的一个随从移动到另一个基地。 | `baseTheDohyoMinionPlayed` / `canTriggerBaseTheDohyoMinionPlayed`；限制 `playedCount === 1`，候选按敌方随从 × 其他基地生成。 | 跳过不移动；确认后所选敌方随从换到所选目的基地，触发队列清空。 | `international-incident.test.ts:2396`；专属 E2E `e2e/smashup/smashup-international-incident-sumo-audit.e2e.ts:586-782` 覆盖真实打出随从后的基地移动入口。 | 无；真实基地触发与最终位置已通过。 | 功能实现与真实入口均已验证。 |

## 已发现并修复的问题

### 1. 身体猛击错误自动取第一项

- 现实问题：原实现不让玩家选择另一位玩家、来源基地和目的基地，直接取搜索到的第一项；多玩家、多基地时会把规则选择权变成固定顺序。
- 修复：拆成 `sumo_wrestlers_body_slam_player`、`sumo_wrestlers_body_slam_base`、`sumo_wrestlers_body_slam_destination` 三个真实交互，最终移动所选玩家在所选来源基地的全部随从。
- 证据：`international_incident.ts:990-1124`、`international-incident.test.ts:182`、`smashup-international-incident-sumo-audit.e2e.ts:75-99`。

### 2. 关胁错误固定第一目的地并缺少跳过

- 现实问题：原实现固定移动到第一座其它基地，而且有合法目标时没有“可以不做”的入口。
- 修复：恢复目的地选择；共享移动交互增加可配置 `allowSkip`，仅关胁启用；跳过时不移动也不抽牌。
- 证据：`international_incident.ts:941-987`、`international_incident.ts:1762-1776`、`international-incident.test.ts:251`、相扑手 E2E 的两个关胁分支。

### 3. 相扑新人错误强制弃牌

- 现实问题：原实现有手牌时直接进入弃牌路径，违反“你可以弃 1 张牌”。
- 修复：弃牌交互加入“跳过（不弃牌）”；跳过直接结束，不进入目标随从选择，也不产生弃牌或力量指示物。
- 证据：`international_incident.ts:1832-1878`、`international-incident.test.ts:139`、相扑手 E2E 的跳过路径。

## 共享影响与未扩大问题

| 发现 | 现实含义 | 是否属于相扑手本轮实现问题 | 当前处理 |
| --- | --- | --- | --- |
| 四派系真实入口 E2E 为 7 通过、7 失败 | 共享测试中有旧的选秀虚拟列表定位问题，以及其他派系计分前 / 额外行动 / 附着链超时或断言失败。 | 否；失败堆栈未落在相扑手能力执行函数或相扑手专属 E2E。 | 记录为共享回归 / 其他派系残余，不把它们算作相扑手规则通过证据，也不在本轮扩修其他派系。 |
| `interactionTargetTypeAudit.test.ts` 12 通过、2 失败 | 失败来自 `smashup_reaction_choose` 文本合同和 `base_uss_undertaking` / `goblins_*` 的既有 sourceId 多义，均不涉及相扑手 sourceId。 | 否。 | 保留为共享审计基线问题。 |
| 远端 R2 / CDN | 本地 atlas、压缩资源和 manifest 合同可用，但本轮没有重新做远端公开地址回查。 | 否；属于发布链残余。 | 不把本地资源合同通过写成远端发布完成。 |

## 同类扩审与搜索范围

- 搜索范围：相扑手全部 12 张唯一卡、2 张基地；国际事件共享的 `runMinionEffect`、`runMoveMinion`、`moveMinionPrompt`、`buildValidatedMoveEvents`、弃牌触发、临时力量清理、基地 trigger queue、保护注册和真实 `SYS_INTERACTION_RESPOND` 入口。
- 搜索维度：相扑手 `sumo_wrestlers_*` / `base_heya_training_stable` / `base_the_dohyo` 的注册点、候选过滤、可选 / 跳过分支、事件写入、最终状态和清理；同时横向检查同一共享移动提示、同一共享随从效果提示、同一基地移动提示和同一 `onCardsDiscarded` 触发模式。
- 命中项：身体猛击、关胁、相扑新人确实存在实现缺陷，已分别修复；其他 11 个相扑手对象未发现同形的“自动取第一项 / 把可选做成强制 / 固定错误目的地”问题。
- 共享链命中：共享 targetType 审计仍命中 `smashup_reaction_choose`、`base_uss_undertaking`、`goblins_*`，但没有命中相扑手 sourceId；四派系 E2E 失败命中选秀虚拟列表和其他派系计分前 / 额外行动 / 附着链，未命中相扑手专属 E2E。
- 残余扩审范围：尚未为 14 个对象逐一补独立浏览器入口；尚未对远端 R2 / CDN 做公开地址回查；共享 targetType 基线和其他派系 E2E 失败另开范围处理。

## 验证证据

1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/international-incident.test.ts src/games/smashup/__tests__/internationalIncidentResourceContract.test.ts src/games/smashup/__tests__/reactionQueueBaseAbilities.test.ts --configLoader native`
   - 结果：3 个文件、57 条测试通过。
   - 证明：相扑手规则执行、共享反应 / 基地队列和国际事件资源合同通过。
   - 不证明：14 个对象全部拥有独立浏览器入口截图。
2. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native`
   - 结果：12 条通过、2 条失败。
   - 失败不是相扑手 sourceId；失败详情已在“共享影响与未扩大问题”记录。
3. `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-sumo-audit.e2e.ts`
   - 结果：3 条通过；本轮重新执行后 `test-results/playwright-artifacts/.last-run.json` 为 `passed` 且无失败用例。
   - 证明：14/14 对象均从真实牌桌入口完成至少一条规则路径，并回到最终权威状态；修复链、剩余行动牌、横纲 / 大关 / 两座基地分别有独立测试。
   - 本轮截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-international-incident-sumo-audit.e2e\相扑手剩余行动牌真实入口覆盖抽牌、力量模式、行动摧毁与移动\相扑手-剩余行动牌-真实入口收口.jpg`；`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-international-incident-sumo-audit.e2e\横纲、大关与两座相扑基地从真实触发入口收口\相扑手-横纲大关基地-真实触发收口.jpg`。
4. `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-international-incident-four-factions.e2e.ts`
   - 结果：7 条通过、7 条失败，10.4 分钟。
   - 证明：共享四派系代表链仍有可运行样本；不证明四派系当前全绿，也不把失败自动归因到相扑手。
5. `npm run typecheck`
   - 结果：通过。
6. `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/react.test.tsx src/engine/transport/__tests__/stateNormalization.test.ts --configLoader native`
   - 结果：2 个文件、30 条测试通过；补证了本轮共享座位控制器稳定性修复。
7. `git diff --check`
   - 结果：通过。
8. `node scripts/verify/audit-evidence-completeness.mjs evidence/smashup/2026-09-19-sumo-wrestlers-audit.md`
   - 结果：`OK`。
9. 远端公开资源 `HEAD`
   - 结果：`international_incident.webp` 与 `international_incident_bases.webp` 当前均为 `404`；工作区存在 `.env`，但当前进程没有可见的 R2 / CDN 环境变量，因此不能声称已上传或发布完成。

## 旧结论回写

- 旧文档：`evidence/smashup/2026-09-18-international-incident-audit.md`。
- 旧结论：相扑手只保留在四派系代表性验证和 `in_progress` 状态，身体猛击、关胁、相扑新人仍是未闭合交互缺口。
- 当前修订：三类相扑手实现缺陷已经修复并有领域测试和专属真实入口 E2E；因此旧文档中“这三项尚未修复”的表达失效。
- 当前修订：相扑手 14/14 对象的规则与真实入口证据已经闭合，不再因逐对象浏览器缺口保留审计残余；整体发布口径仍因远端资源链 404 而保留残余。

## 对外汇报口径

允许说：

- 相扑手本轮全面对象审计已完成，确认 3 类真实规则 / 交互问题并已修复。
- 相扑手 14/14 对象的专属真实入口 E2E、领域行为测试、共享 transport 回归和资源合同测试已通过。
- 仍未收口的是远端发布链和四派系共享基线失败；它们不是本轮已证明的相扑手规则错误。

禁止说：

- “整体发布已经完全收口”。相扑手规则与真实入口已闭合，但远端资源发布仍阻塞。
- “四派系共享 E2E 已通过”。当前实际结果是 7 条通过、7 条失败。
- “远端资源已经发布完成”。本轮只有本地资源合同证据。
