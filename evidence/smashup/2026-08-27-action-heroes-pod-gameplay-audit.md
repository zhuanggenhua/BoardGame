# Action Heroes POD 玩法审计证据

## 基本信息

- 对象：Smash Up / Action Heroes POD（`action_heroes_pod`）
- 日期：2026-08-27
- 作者：Codex
- 文档类型：`audit`
- 关联任务：用户要求“审计一个未审计派系”，本轮锁定为动作英雄 POD 玩法审计与 evidence 收口。

## 审计范围

- 本轮覆盖的游戏 / 模块 / 对象：Smash Up 动作英雄 POD 的 17 张卡牌定义、20 张实体牌口径、2 个 POD 基地，以及 POD 变体共享运行时消费链。
- 本轮覆盖的规则子句或共享链路：动作英雄基础版与 POD 图面规则一致；POD 只替换运行时身份、图集、派系和独立基地池。玩法能力、交互、持续效果、基地能力、力量 / 临界点修正按共享流程引用审计。
- 本轮使用的目标入口 / 环境：领域测试、POD 差异回归、基础版动作英雄能力测试、POD 变体注册测试、真实派系选择 E2E。
- 明确不在本轮范围内的对象：Smash Up 其它派系、其它 POD 派系、线上资源发布闭环、每张 POD 卡牌逐一真实 UI E2E。

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | 对象全集包含 17 张 POD 卡牌与 2 个 POD 基地，见“对象全集”。 |
| 真相源状态 | `passed` | 主真相源为 POD 图面合同、基础版动作英雄已审计实现、变体绑定表和运行时消费点，见“权威来源”。 |
| 原子语义断言 | `passed` | 每个对象均列出触发时机、主体、目标、选择 / 跳过边界、数值和最终权威状态，见“原子语义与实现消费”。 |
| 实现消费链 | `passed` | 能力注册、POD 自动别名、交互 handler、持续效果、基地能力别名、状态事件均有直接路径，见“共享流程审计”。 |
| 最终权威结果 | `passed` | 回归断言落到手牌 / storedCards / 临界点 / 保护判定 / VP / 返回手牌等 finalState 或等价权威状态。 |
| 交互真实入口 | `passed` | 真实入口 E2E 验证派系选择详情、POD 图集加载和确认写入 `action_heroes_pod`；玩法交互由共享领域链和 POD 差异直测覆盖。 |
| 验证证据 | `passed` | 红测命中 POD 储存与临界点缺口；修复后定向回归、基础版动作英雄能力测试、POD 注册测试、typecheck 与 E2E 均通过。 |
| 共享影响与代表链依据 | `passed` | `sharedFlowId=smashup.action_heroes.action_family_runtime`，逐项核对触发时机、候选生成、权限判断、payload、执行入口、最终权威状态和清理语义。 |
| 缺口分类与范围裁定 | `passed` | 三个功能实现阻塞已修复并补回归；逐卡真实 UI E2E 和资源发布列为当前范围外边界。 |
| 旧 evidence / 旧结论回写 | `passed` | `evidence/smashup/2026-08-10-action-heroes-pod-intake.md` 只覆盖接入，本文件接管玩法审计结论。 |
| 残余范围声明 | `passed` | 当前范围外边界已明确，不影响动作英雄 POD 玩法审计当前范围已收口。 |

## 结论等级

结论等级：`当前范围已收口`

判定理由：

- 动作英雄 POD 的完整对象全集已建立：17 个唯一定义、20 张实体牌、14 张行动、6 张随从、2 个 POD 基地。
- 共享关系已由 `variantBindings.ts` 锁定：`ability / interaction / ongoing / baseAbility / powerModifier = shared`，`basePool = separate`。
- 当前派系状态表中 `action_heroes_pod` 不在 `in_progress` 名单；本轮新增回归断言固定“非实施中”状态。
- 本轮红测命中了三个 POD 变体身份消费缺口：踢拳兄弟储存、隆布罗临界点、慢动作攻击保护；代码已改为消费 POD 运行时身份，并补了 POD 直接回归。
- 基础版动作英雄行为测试继续作为共享流程一次性审计证据；POD 差异测试覆盖了共享流程最容易失效的运行时身份点。
- 真实入口 E2E 覆盖派系选择、POD 图集加载与确认写入，证明玩家能从正式入口选到该派系；它不被用于证明每张卡牌玩法都在 UI 层逐张执行。

## 权威来源

- 主真相源：`evidence/smashup/2026-08-10-action-heroes-pod-intake.md` 中的用户原图与图面合同；该图 SHA256 为 `EDA3C17D9C5483E0930AB5D8CDFB3AE632C6D1004699C98B79298302D21954BC`，4 x 5 row-major，17 个唯一定义 / 20 张实体牌。
- 对照源：基础版动作英雄数据与能力实现：`src/games/smashup/data/factions/excellent_movies_teens.ts`、`src/games/smashup/abilities/excellent_movies_teens.ts`。
- POD 数据源：`src/games/smashup/data/factions/action_heroes_pod.ts`。
- 变体合同：`src/games/smashup/domain/variantBindings.ts` 中 `ACTION_HEROES -> ACTION_HEROES_POD` 默认共享玩法表面、独立基地池。
- 自动别名和消费入口：`src/games/smashup/abilities/podAutoMapping.ts`、`src/games/smashup/domain/abilityRegistry.ts`、`src/games/smashup/domain/abilityInteractionHandlers.ts`、`src/games/smashup/domain/ongoingEffects.ts`、`src/games/smashup/domain/ongoingModifiers.ts`、`src/games/smashup/domain/baseAbilities.ts`。
- 合同状态：`locked`。POD 图面规则文字与基础版一致；本轮不重新建立外部规则合同。

## 对象全集

| 对象 | 语义审计状态 | 覆盖方式 | sharedFlowId / 直接证据 | 一致性核对 | 剩余差异 | 当前裁定 |
| --- | --- | --- | --- | --- | --- | --- |
| `action_heroes_all_out_of_bubblegum_pod` | `独立完成` | `共享流程引用` | `smashup.action_heroes.action_family_runtime`; `actionHeroesAllOutOfBubblegum`; POD 静态合同判等测试 | 触发时机 / 候选生成 / 权限 / payload / 执行入口 / 最终权威状态 / 清理语义均与基础版一致 | POD 身份、图集 slot、派系 | passed（共享流程引用） |
| `action_heroes_get_to_the_choppa_pod` | `独立完成` | `共享流程引用` | `actionHeroesGetToTheChoppa`; `action_heroes_get_to_the_choppa` handler; POD 静态合同判等测试 | 同上，交互 payload 保留 `minionUid/fromBaseIndex/onlyHereBeforeMove` | POD 身份、图集 slot、派系 | passed（共享流程引用） |
| `action_heroes_slo_mo_attack_pod` | `独立完成` | `直接验证` | POD 回归：保护己方随从免受其他玩家行动影响；`matchesRuntimeDefId(action.defId, 'action_heroes_slo_mo_attack')` | talent 降临界点走共享 handler；保护消费点已直测 POD 身份 | POD 身份、图集 slot、派系 | passed（POD 差异直测） |
| `action_heroes_final_stand_pod` | `独立完成` | `共享流程引用` | `actionHeroesFinalStand`; `action_heroes_final_stand` handler; 基础版行为测试 | beforeScoring、仅己方唯一随从、选择敌方 3 力及以下随从、摧毁事件一致 | POD 身份、图集 slot、派系 | passed（共享流程引用） |
| `action_heroes_hostage_rescue_pod` | `独立完成` | `共享流程引用` | `actionHeroesHostageRescue`; `reorderDeckWithCardOnTop`; 基础版行为测试 | 查牌库、候选为随从、选择后置顶、无目标不改状态一致 | POD 身份、图集 slot、派系 | passed（共享流程引用） |
| `action_heroes_walk_away_slowly_pod` | `独立完成` | `共享流程引用` | `actionHeroesWalkAwaySlowly`; `buildValidatedReturnEvents`; 基础版行为测试 | afterScoring 响应、己方随从候选、选择后返回手牌一致 | POD 身份、图集 slot、派系 | passed（共享流程引用） |
| `action_heroes_lone_wolf_pod` | `独立完成` | `共享流程引用` | `registerCustomPowerModifiers`; `runtimeIdentity: 'actionFamily'`; 基础版修正测试 | 持续附着行动、力量修正计算、唯一己方随从时 +4 否则 +2 一致 | POD 身份、图集 slot、派系 | passed（共享流程引用） |
| `action_heroes_friends_through_eternity_pod` | `独立完成` | `共享流程引用` | `actionHeroesFriendsThroughEternity`; `handleDiscardForExtraActions`; 基础版行为测试 | 手牌候选、选择弃牌、授予两个额外行动一致 | POD 身份、图集 slot、派系 | passed（共享流程引用） |
| `action_heroes_pushing_the_limit_pod` | `独立完成` | `共享流程引用` | `actionHeroesPushingTheLimit`; `action_heroes_pushing_the_limit` handler; 基础版行为测试 | 每个“仅有一个己方随从”的基地依次选择 +2 指示物或抽 1，负向候选一致 | POD 身份、图集 slot、派系 | passed（共享流程引用） |
| `action_heroes_the_right_person_pod` | `独立完成` | `共享流程引用` | `actionHeroesTheRightPerson`; `grantContextualExtraMinion`; 基础版行为测试 | 额外行动、无己方随从基地候选、选择后额外随从限制一致 | POD 身份、图集 slot、派系 | passed（共享流程引用） |
| `action_heroes_collateral_damage_pod` | `独立完成` | `共享流程引用` | `actionHeroesCollateralDamage`; `modifyBreakpoint(-5)`; 基础版注册与行为测试 | 目标基地、临界点 -5、无基地不改状态一致 | POD 身份、图集 slot、派系 | passed（共享流程引用） |
| `action_heroes_gracie_brones_pod` | `独立完成` | `共享流程引用` | `registerTrigger('action_heroes_gracie_brones', 'onTurnStart')`; POD 自动别名 | 回合开始、来源控制者、唯一己方随从、+1 指示物与临时力量一致 | POD 身份、图集 slot、派系 | passed（共享流程引用） |
| `action_heroes_commandbro_pod` | `独立完成` | `共享流程引用` | `registerTrigger('action_heroes_commandbro', 'onTurnEnd')`; POD 自动别名 | 回合结束、唯一己方随从、抽 1 张牌、无牌库边界一致 | POD 身份、图集 slot、派系 | passed（共享流程引用） |
| `action_heroes_kickboxbro_pod` | `独立完成` | `直接验证` | POD 回归：回合结束选择手牌后 storedCards 写入 POD 牌下；基础版存牌 / 打储存行动测试 | onTurnEnd 存牌、talent / beforeScoring 打储存行动、skip 分支、storedUnderDefId 清理一致 | POD 身份、图集 slot、派系 | passed（POD 差异直测） |
| `action_heroes_robobro_pod` | `独立完成` | `共享流程引用` | `registerTrigger('action_heroes_robobro', 'onMinionPlayed/onMinionMoved')`; POD 自动别名 | 对手随从进入同基地时给自身 +1 指示物，自己行动负向路径一致 | POD 身份、图集 slot、派系 | passed（共享流程引用） |
| `action_heroes_warbro_pod` | `独立完成` | `共享流程引用` | `actionHeroesWarbro`; `action_heroes_warbro` handler; 基础版行为测试 | talent、选择另一个仅有己方一个随从的基地、临界点 -3 一致 | POD 身份、图集 slot、派系 | passed（共享流程引用） |
| `action_heroes_rumbro_pod` | `独立完成` | `直接验证` | POD 回归：控制者自己回合且该基地只有它一个己方随从时临界点 -4；负向路径不改 | `runtimeIdentity: 'actionFamily'`; `matchesRuntimeDefId(minion.defId, 'action_heroes_rumbro')` | POD 身份、图集 slot、派系 | passed（POD 差异直测） |
| `base_building_rooftop_pod` | `独立完成` | `共享流程引用` | `registerPodBaseAbilityAliases`; 基础版 `base_building_rooftop` onTurnStart / whenScoring 测试 | POD 基地身份独立；基地能力表面共享；回合开始选择降低临界点、跳过、计分 VP 一致 | POD 基地 ID、POD 基地池；baseAbility shared | passed（共享流程引用） |
| `base_jungle_camp_pod` | `独立完成` | `共享流程引用` | `registerPodBaseAbilityAliases`; 基础版 `base_jungle_camp` afterScoring 测试 | POD 基地身份独立；基地能力表面共享；冠军可选择返回己方随从、跳过不变一致 | POD 基地 ID、POD 基地池；baseAbility shared | passed（共享流程引用） |

## 原子语义与实现消费

| 对象 | 原子语义断言 | 实现消费点 | 最终权威结果 | 真实入口 / 验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| Bubblegum POD | 打出时选己方随从 +2 临时力量；若该基地只有这一个己方随从，获得额外行动；无合法目标不改状态。 | `actionHeroesAllOutOfBubblegum`; POD 能力别名；`grantContextualExtraAction` | 目标随从有效力量变化，玩家额外行动额度变化。 | 基础版行为测试 + POD 静态合同判等。 | 无 | passed |
| Choppa POD | 打出时选己方随从，再选另一个基地移动；若移动前为唯一己方随从，获得额外行动；目的基地必须不同。 | `actionHeroesGetToTheChoppa`; `buildValidatedMoveEvents`; handler continuation | 随从所在基地变化，必要时额外行动额度变化，prompt 无残留。 | 基础版行为测试 + POD 静态合同判等。 | 无 | passed |
| Slo-Mo Attack POD | 持续行动贴基地；talent 在只有一个己方随从时本基地 -3；同时保护己方随从不受其他玩家行动影响，己方行动和非行动来源不触发保护。 | `actionHeroesSloMoAttack`; `actionHeroesSloMoProtection`; `matchesRuntimeDefId` | 临界点变化；保护判定返回 true / false。 | POD 直接回归断言保护正向、非行动负向、己方行动负向。 | 已修复功能实现阻塞 | passed |
| Final Stand POD | 计分前特殊；当该基地只有一个己方随从时，按对手选择 3 力及以下敌方随从并摧毁；无候选不改状态。 | `actionHeroesFinalStand`; `getActionHeroesFinalStandCandidates`; `buildValidatedDestroyEvents` | 目标敌方随从从基地移除并进入摧毁流程，交互队列收口。 | 基础版行为测试 + POD 共享能力别名。 | 无 | passed |
| Hostage Rescue POD | 打出时查看自己牌库，选择一个随从置于牌库顶；无随从候选不改状态。 | `actionHeroesHostageRescue`; `inspectDeck`; `reorderDeckWithCardOnTop` | 牌库顺序更新，选择的随从成为牌库顶。 | 基础版行为测试 + POD 静态合同判等。 | 无 | passed |
| Walk Away Slowly POD | 计分后特殊；在该基地选择一个己方随从返回手牌；跳过或无目标不改变状态。 | `actionHeroesWalkAwaySlowly`; `buildValidatedReturnEvents` | 随从离开基地并回到手牌，交互清理。 | 基础版行为测试 + POD 静态合同判等。 | 无 | passed |
| Lone Wolf POD | 持续行动贴己方随从；附着随从 +2，若该基地只有一个己方随从则 +4；多个同名附着按数量叠加。 | `registerCustomPowerModifiers`; `helpers.countMinionAttachmentsMatchingRuntimeDefId` | 有效力量修正。 | 基础版修正测试 + `runtimeIdentity: 'actionFamily'`。 | 无 | passed |
| Friends Through Eternity POD | 打出时选择一张手牌弃掉，获得两个额外行动；无手牌不产生流程。 | `actionHeroesFriendsThroughEternity`; `handleDiscardForExtraActions` | 手牌进入弃牌堆，额外行动额度 +2。 | 基础版行为测试 + POD 静态合同判等。 | 无 | passed |
| Pushing the Limit POD | 打出时遍历每个“你在此只有一个随从”的基地；每个基地选择 +2 指示物或抽 1；非唯一基地不入候选。 | `getActionHeroesPushingCandidates`; `queueActionHeroesPushingChoice`; handler continuation | 指示物增加或手牌增加，多个候选逐项收口，无残留。 | 基础版行为测试断言分支、负向候选和 finalState。 | 无 | passed |
| The Right Person POD | 打出时获得额外行动；若存在没有己方随从的基地，选择一个基地获得额外随从机会；无候选仍保留额外行动。 | `actionHeroesTheRightPerson`; `grantContextualExtraMinion` | 额外行动额度变化，特定基地额外随从额度写入。 | 基础版行为测试 + POD 静态合同判等。 | 无 | passed |
| Collateral Damage POD | 打出时选择基地，临界点 -5；无目标基地不改变状态。 | `actionHeroesCollateralDamage`; `modifyBreakpoint` | 基地临界点修正事件。 | 基础版注册 / 行为测试 + POD 静态合同判等。 | 无 | passed |
| Gracie Brones POD | 回合开始时若只有这一个己方随从在此，给自己 +1 指示物并按现有指示物数量获得临时力量；非唯一不触发。 | `actionHeroesGracieTurnStart`; POD trigger 别名 | 自身指示物与有效力量变化。 | 基础版触发测试 + POD 自动别名注册。 | 无 | passed |
| Commandbro POD | 回合结束时若只有这一个己方随从在此，抽 1 张牌；非唯一不触发。 | `actionHeroesCommandbroTurnEnd`; `buildStandardDrawEvents`; POD trigger 别名 | 玩家手牌增加，牌库减少。 | 基础版触发测试 + POD 自动别名注册。 | 无 | passed |
| Kickboxbro POD | 回合结束时选择一张手牌储存在本牌下，可跳过；talent / 计分前特殊可从本牌下选储存行动作为额外行动打出；POD 来源必须仍在场。 | `actionHeroesKickboxbroTurnEnd`; `action_heroes_kickboxbro_store`; `actionHeroesKickboxbroPlayStored` | 手牌移入 `storedCards` 且 `storedUnderDefId=action_heroes_kickboxbro_pod`；额外行动限制指向储存行动；prompt 清理。 | POD 直接回归断言 storedCards finalState；基础版存牌与打储存行动测试。 | 已修复功能实现阻塞 | passed |
| Robobro POD | 对手打出或移动随从到本基地时，给 Robobro +1 指示物；自己打出 / 移动不触发。 | `actionHeroesRobobroTrigger`; POD trigger 别名 | 自身指示物增加。 | 基础版触发测试 + POD 自动别名注册。 | 无 | passed |
| Warbro POD | talent 选择另一个“你在此只有一个随从”的基地，使该基地临界点 -3；当前基地和非唯一基地不入候选。 | `actionHeroesWarbro`; `action_heroes_warbro` handler | 目标基地临界点修正事件。 | 基础版行为测试 + POD 静态合同判等。 | 无 | passed |
| Rumbro POD | 持续效果：控制者自己回合，若此基地只有该玩家一个己方随从且 Rumbro 在场，本基地临界点 -4；别人回合或有其它己方随从不改。 | `registerCustomBreakpointModifiers`; `runtimeIdentity: 'actionFamily'`; `matchesRuntimeDefId` | `getEffectiveBreakpoint` 返回基础临界点 -4 或基础值。 | POD 直接回归断言正向、非控制者回合负向、同基地有己方随从负向。 | 已修复功能实现阻塞 | passed |
| Building Rooftop POD | 回合开始时，若玩家在此恰好有 1 个随从，可选择按该随从战力降低临界点；计分时每个在此恰好有 1 个随从的玩家 +1VP。 | `registerPodBaseAbilityAliases`; `base_building_rooftop` onTurnStart / whenScoring; handler | 临界点修正事件或跳过无事件；计分 VP 事件。 | 基础版基地能力测试 + POD 基地池注册测试。 | 无 | passed |
| Jungle Camp POD | 计分后冠军可选择将其在此的 1 个随从返回手牌；跳过不改变状态。 | `registerPodBaseAbilityAliases`; `base_jungle_camp` afterScoring; handler | 随从从基地移除并加入冠军手牌，或跳过无事件。 | 基础版基地能力测试 + POD 基地池注册测试。 | 无 | passed |

## 共享流程审计

判等依据：Action Heroes POD 的图面规则与基础版一致；POD 静态合同测试在排除 `id/faction/previewRef` 后与基础版逐字段相等；变体绑定表声明玩法表面 shared、basePool separate；本轮又对 POD source def id 最容易断开的 storedCards、effectiveBreakpoint、protection 三个最终状态做了直测。

| sharedFlowId | 流程职责 | 一次性审计证据 | 流程不变量 | 允许配置差异 | 失效影响面 |
| --- | --- | --- | --- | --- | --- |
| `smashup.action_heroes.action_family_runtime` | 动作英雄基础版与 POD 共享能力、交互、持续效果、力量 / 临界点修正和基地能力运行时链路。 | `excellent-movies-teens.test.ts` 覆盖基础版动作英雄能力；`actionHeroesPodIntegration.test.ts` 覆盖 POD 静态合同、别名注册、POD 基地池、POD 差异回归；`variantBindings.ts` 锁定共享表面。 | 触发时机、候选生成、权限判断、payload / command 结构、执行入口、最终权威状态、清理语义、AI 或自动推进消费都不因 POD 身份改变。 | source def id、派系 id、图集 slot、POD 基地 id、POD basePool 独立。 | 若共享 handler 或自动别名失效，需重审动作英雄基础版与动作英雄 POD；若仅 POD 身份判定失效，最小影响集为 POD 变体运行时身份消费点。 |

| 本对象 | 独立语义结论 | sharedFlowId | 一致性核对 | 剩余差异 | 是否需要直测 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 14 个 POD 共享卡牌对象 | 图面规则与基础版一致 | `smashup.action_heroes.action_family_runtime` | 触发时机、候选生成、权限判断、交互入口、payload、执行入口、最终权威状态、清理语义逐项一致；POD 自动别名给 `_pod` defId 接入同一执行链。 | 仅 POD 身份、图集和派系。 | 否：仅配置差异 | passed |
| Kickboxbro / Rumbro / Slo-Mo Attack POD | 语义与基础版一致，但运行时身份消费点曾需要 POD 直测 | `smashup.action_heroes.action_family_runtime` | 共享链路不变；本轮对 storedCards、effectiveBreakpoint、protection 三个最终状态补 POD 直接回归。 | 仅 POD source def id。 | 是：运行时身份消费点 | passed |
| 2 个 POD 基地 | 基地能力语义与基础版一致，基地池身份独立 | `smashup.action_heroes.action_family_runtime` | `registerPodBaseAbilityAliases` 复制基础版基地能力时机；`getBaseDefIdsForFactions` 返回 POD 独立基地池。 | `basePool=separate`，`baseAbility=shared`。 | 否：仅配置差异 | passed |

## 配置差异复核表

| 本对象 | sharedFlowId | 变更字段和值 | 允许配置差异证据 | 流程不变量未变证据 | 最小验证 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 17 张 POD 卡牌 | `smashup.action_heroes.action_family_runtime` | `id/faction/previewRef`：基础版 -> `_pod` / `action_heroes_pod` / `smashup:action-heroes-pod-cards` | `variantBindings.ts` 默认允许 source def id、派系和图集差异；玩法表面 shared。 | POD 静态合同判等测试排除 `id/faction/previewRef` 后与基础版相等。 | `actionHeroesPodIntegration.test.ts` 的 17 定义、20 实体、静态合同、图集槽位断言。 | `passed（配置差异复核）` |
| `base_building_rooftop_pod` / `base_jungle_camp_pod` | `smashup.action_heroes.action_family_runtime` | 基础版基地 -> POD 基地 id；basePool separate；baseAbility shared。 | `getSmashUpVariantSurfaceRelation('basePool') === 'separate'`；`baseAbility === 'shared'`。 | `registerPodBaseAbilityAliases` 为 POD 基地接入基础版时机与 handler。 | POD 基地池测试 + 基础版基地能力测试。 | `passed（配置差异复核）` |

## 本轮发现与修复

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞已审计 / 已收口口径 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| POD 踢拳兄弟回合结束能弹出选择，但选择手牌后没有储存在 POD 牌下。 | `功能实现阻塞` | 是 | 是 | 当前范围内 | handler 消费 continuation 中的 POD `kickboxbroDefId`，并把 storedCards 的 `storedUnderDefId/reason` 写为 POD 来源；补 POD finalState 回归。 |
| POD 隆布罗在控制者自己回合且基地只有它一个己方随从时，没有降低临界点。 | `功能实现阻塞` | 是 | 是 | 当前范围内 | 临界点修正注册改为 action family 身份，并用 `matchesRuntimeDefId` 判断 POD / 基础版同族；补正向和两个负向回归。 |
| POD 慢动作攻击作为 POD 持续行动时，保护来源只认基础版 ID。 | `功能实现阻塞` | 是 | 是 | 当前范围内 | 保护检查改为 `matchesRuntimeDefId(action.defId, 'action_heroes_slo_mo_attack')`；补其他玩家行动、非行动、己方行动三条断言。 |
| 逐卡真实 UI E2E | `非阻塞扩展` | 否 | 否 | 当前范围外 | 当前 evidence 已通过共享流程判等 + POD 差异直测覆盖玩法；真实入口 E2E 只证明派系选择和图集加载。 |
| 线上资源发布闭环 | `非阻塞扩展` | 否 | 否 | 当前范围外 | 资源发布属于素材发布专项，不改变本轮玩法最终权威状态。 |

## 同类扩审与影响面

- 横向搜索范围：`excellent_movies_teens.ts` 中所有 `action_heroes_*` 能力、trigger、interaction handler、protection、powerModifier、breakpointModifier；`variantBindings.ts` 中动作英雄 POD 表面关系；`baseAbilities.ts` 中 POD 基地能力别名；POD 集成测试与基础版动作英雄能力测试。
- 根因分级：现实故障是 POD 牌进入共享流程后结果状态不正确；直接条件是执行消费点只比较基础版 defId；止血动作不是跳过流程，而是把消费者改为同族运行时身份；根本机制是共享流程虽然有 POD 自动别名，但部分深层 handler / modifier 没有继续消费 POD source def id。
- 命中项：Kickboxbro 存牌、Rumbro 临界点、Slo-Mo Attack 保护。
- 排除项：其它动作英雄 POD 对象的实现入口通过共享 handler 或 `runtimeIdentity: 'actionFamily'` / POD 自动别名消费，静态合同和基础版行为测试未发现新的 POD 身份断点。
- 影响面裁定：本轮最小受影响集为 Action Heroes POD；不外推到其它 POD 派系。

## 验证证据

| 命令 / 检查 | 结果 | 证明了什么 | 没有证明什么 |
| --- | --- | --- | --- |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/actionHeroesPodIntegration.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --testTimeout 120000` | Passed：1 file / 11 tests | POD 静态合同、POD 图集、POD 基地池、POD 能力别名、非实施中状态，以及 Kickboxbro / Rumbro / Slo-Mo Attack 三个 POD 差异 finalState 回归通过。 | 不代表每张 POD 卡牌都在真实 UI 逐张执行。 |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/actionHeroesPodIntegration.test.ts src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts src/games/smashup/__tests__/podPowerModifierRegistration.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 --testTimeout 120000` | Passed：3 files / 108 tests | POD 差异回归、基础版共享行为、POD 修正注册共同通过；测试语义对账覆盖选择、跳过、负向路径和最终状态断言。 | 不覆盖全 Smash Up 派系。 |
| `npm run typecheck` | Passed | TypeScript 编译通过，改动没有引入类型错误。 | 不替代玩法断言。 |
| `node scripts/infra/run-e2e-single.mjs default e2e/smashup/smashup-action-heroes-pod-atlas.e2e.ts` | Passed：1 test | 真实派系选择入口能打开 Action Heroes，切换 POD，加载 17 个 POD 图集节点，确认后写入 `action_heroes_pod`。 | 不证明每张 POD 牌的玩法 UI 独立执行。 |

测试语义对账：

- 红测：修复前 POD Kickboxbro 储存和 POD Rumbro 临界点两条 finalState 断言失败，说明缺口是真实玩法结果错误，不只是文案或按钮问题。
- 修复后：Kickboxbro 断言手牌清空、storedCards 写入 POD defId；Rumbro 断言控制者回合正向 -4、别人回合与有己方同伴两条负向；Slo-Mo Attack 断言其他玩家行动被保护、非行动和己方行动不被保护。
- 生命周期：涉及 prompt / simple-choice 的流程均通过 `respondToPromptOption` 回到 finalState；交互响应后 `SYS_INTERACTION_RESOLVED` 之外无业务残留，triggerQueue / 阶段收口语义由共享测试链覆盖。

截图 / 录像 / 日志路径：

- 真实入口截图：`test-results/evidence-screenshots/smashup/smashup-action-heroes-pod-atlas.e2e/派系选择详情应加载-Action-Heroes-POD-卡牌图集/action-heroes-pod-faction-preview-atlas.jpg`
- 人工观察结论：截图只作为派系选择和图集加载证据，不作为玩法规则正确性的证据。

## 修订 / 失效记录

- 旧文档路径：`evidence/smashup/2026-08-10-action-heroes-pod-intake.md`
- 旧结论：动作英雄 POD 接入已覆盖静态数据、资源、派系注册、POD 基地身份、图集、本地化、预加载和真实派系选择预览。
- 失效原因：旧文档不是玩法审计 evidence，没有声明 POD 共享 handler、持续效果和临界点修正的最终权威状态已验证，因此不用于玩法收口。
- 替代旧结论的新证据：本文对象全集、共享流程审计、POD 差异回归、基础版动作英雄行为测试、真实入口 E2E。
- 新结论：动作英雄 POD 玩法审计当前范围已收口；旧 intake 结论仍作为接入证据保留。
- 是否需要修改旧文档正文中的误导行：否。旧文档已明确“基础版动作英雄的既有规则文本与能力实现不是本次改写范围”，没有把玩法审计宣称为完成。

## 对外汇报口径

- 允许说：动作英雄 POD 当前锁定玩法审计范围已收口；本轮发现并修复了三个 POD 运行时身份消费缺口；验证覆盖为共享流程判等 + POD 差异回归 + 真实派系选择入口。
- 禁止说：全 Smash Up 已审计；所有 POD 派系已审计；动作英雄 POD 每张牌都跑过独立真实 UI E2E；资源服务器发布闭环已完成。
