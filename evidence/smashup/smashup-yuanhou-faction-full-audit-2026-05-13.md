# Smash Up yuanhou 四派系全链路重审

## 审计结论

2026-05-15 重审结论：旧的“抽样全链路语义审计完成 / 未新增阻塞 finding / 当前发布口径已收口”全部作废。

2026-05-15 effect atom 口径追加降级：本文件下方“56 对象全链路矩阵”只能作为对象级 rollup 与已发现问题修复记录，不能继续解释为 effect atom 全量完成证明。新的全链路重审入口为 `evidence/smashup/smashup-in-progress-effect-atom-audit-2026-05-15.md`；该文件要求把每张卡/基地继续拆成效果原子，并逐 atom 核销语义、静态绑定、共享合同、本地参数、handler/reducer/UI 和测试证据。

触发原因：抽样发现 `base_isis_swingin_pad` 曾存在 HIGH 级 ID 漂移和语义错误。按 `.spec/knowledge/standards/testing-audit.md` 与 `.spec/skills/smashup-faction-implementation/SKILL.md` 新增门禁，抽样不能外推为全面审计；发现 HIGH/CRITICAL 后必须回到完整对象清单逐项核销。

本次重审范围为 `yuanhou` 图集对应的 48 张卡 + 8 个基地，共 56 个对象。每个对象均按“牌面/原子语义 -> 静态定义 -> 注册入口 -> handler/trigger/reducer -> UI/交互出口 -> 测试证据”建立结论。当前没有未解释的 HIGH/CRITICAL；仍保留的能力边界是 `Copycat` / `Cellular Bonding` 只证明当前实现的代表性复制代理，不声明已经支持任意跨派系能力的完全动态复制 runtime。

## 审计规范更新

- `.spec/knowledge/standards/testing-audit.md`：新增并升级“抽样不得冒充全面审计”“全链路审计必须逐效果原子覆盖”“共享合同可复用但必须可追溯”“语义审计不得被结构审计替代”。
- `.spec/skills/smashup-faction-implementation/SKILL.md`：新增并升级“抽样发现问题后必须回到 effect atom 全量矩阵”“shared-contract dirty/clean 可追溯”。
- `.spec/skills/smashup-faction-intake/SKILL.md`：新增大图读取门禁，超过阈值必须先做低清总览、分块图和单格裁片。
- `.spec/skills/add-new-faction/SKILL.md`：同步新增大 atlas / 扫描图禁止整张反复视觉读取的工作流要求。

## 权威来源

- 图片主真相源：`public/assets/i18n/zh-CN/smashup/cards/yuanhou.png`、`public/assets/i18n/zh-CN/smashup/base/yuanhou.png`。
- 分块核对产物：
  - `temp/smashup-yuanhou-intake/slices/cards-yuanhou-overview-max1600.png`
  - `temp/smashup-yuanhou-intake/slices/cards-yuanhou-8x6-shapeshifters-0-11.png`
  - `temp/smashup-yuanhou-intake/slices/cards-yuanhou-8x6-cyborg-apes-12-23.png`
  - `temp/smashup-yuanhou-intake/slices/cards-yuanhou-8x6-super-spies-24-35.png`
  - `temp/smashup-yuanhou-intake/slices/cards-yuanhou-8x6-time-travelers-36-47.png`
  - `temp/smashup-yuanhou-intake/slices/base-yuanhou-0-7.png`
- 静态合同：`src/games/smashup/__tests__/yuanhouFactionIntake.test.ts`。
- 行为合同：`src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts`。
- 真实入口证据：`e2e/smashup-yuanhou-factions.e2e.ts`。

## 56 对象全链路矩阵

| 对象 | 原子语义 | 静态/注册/执行链 | UI/交互出口 | 证据层级 | 结论 |
| --- | --- | --- | --- | --- | --- |
| `shapeshifters_bacta_the_future` | 摧毁任意随从；该随从拥有者可立即额外打 1 个随从。 | `playNeedsMinion:any`；`shapeshiftersBactaTheFuture` 发 `MINION_DESTROYED` + extra minion。 | 目标随从入口；额外随从走 immediate extra prompt。 | L2 | Pass。旧“放牌库底”结论已修复；2026-05-16 追加证明 immediate prompt 选择权归属目标随从 owner，而不是施放者。 |
| `shapeshifters_shell_game` | 附着随从不可被摧毁。 | ongoing minion；`registerProtection(...,'destroy')`。 | 附着行动自动保护。 | L2 | Pass。 |
| `shapeshifters_genetic_shift` | 选择所有你的随从 +1 或你的一个随从 +3 直到回合结束。 | onPlay；有己方目标直接 +3，无目标生成 `shapeshifters_genetic_shift_choose`；direct target 与 interaction handler 都复核目标 controller。 | 模式/目标选择 prompt；all 和 single 都只过滤当前玩家随从，伪造敌方 single 目标不会生效。 | L2 | Pass。旧“全场随从 +1 / 敌方单体 +3”已修复，新增 all/single 与 handler 防线测试。 |
| `shapeshifters_transmogrify` | 摧毁己方随从，搜牌库等/低力量随从打到同基地并洗牌。 | `playNeedsMinion:self`；`queueDeckMinionSearch`。 | deck search interaction 保留原基地、原力量上下文。 | L2 | Pass。多候选可选非第一张。 |
| `shapeshifters_really` | 摧毁己方随从，从弃牌堆额外打等/低力量随从；原文无 `here`，所选随从必须再选择合法基地。 | `playNeedsMinion:self`；`queueDiscardMinionSearch` 后接 `shapeshifters_really_base`。 | discard search interaction -> base choice -> immediate extra minion skip/play。 | L2 | 旧“打到同基地”结论失效，已修复为选牌后选基地；测试覆盖打到另一基地。 |
| `shapeshifters_mimic` | 力量等于场上最高印刷力量。 | `ongoing_modifiers.ts` 读取卡牌静态 `power`，不信任测试夹具 `basePower`。 | 自动有效力量计算。 | L2 | Pass。新增直接有效力量测试，并修正测试夹具使用真实 5 力量卡。 |
| `shapeshifters_cellular_bonding` | 附着随从，选择该随从上一张其他行动，本卡获得其能力。 | onPlay/talent；metadata + talent/protection/trigger/power 代理；handler 复核宿主 baseIndex 且本 Cellular Bonding 真实附着在宿主上。 | `shapeshifters_cellular_bonding_choose` 多候选选择。 | L2 / scoped L3 / 边界声明 | Pass for current proxy。2026-05-15 追加：旧对象级结论未证明 host/bonding 上下文防伪造，本轮已补测试；2026-05-17 再补真实 UI 入口，确认 Monkey on Your Back talent 也可选同基地另一玩家低力量随从并把本卡放到底；不声明完整任意能力复制 runtime。 |
| `shapeshifters_copycat` | 打出时选择另一玩家随从，本随从本回合获得其能力。 | onPlay/talent；metadata + talent/power 代理；handler 复核写入对象必须是当前玩家控制的 Copycat 本体。 | `shapeshifters_copycat_choose` 多敌方随从选择。 | L2 / scoped L3 / 边界声明 | Pass for current proxy。2026-05-15 追加：旧对象级结论未证明 handler 防伪造，本轮已补测试，伪造 `copycatUid` 指向普通随从不会写入 metadata；2026-05-17 真实 UI 再补 Copycat 复制 Baboom 后的 talent 链，以及复制 Furious George 后的持续 +1 链；不声明完整任意能力复制 runtime。 |
| `shapeshifters_splice_as_nice` | 附着随从 +2。 | `registerOngoingPowerModifier(...,'minion','self',2)`。 | 自动有效力量计算。 | L2 | Pass。直接有效力量测试覆盖。 |
| `shapeshifters_gelf` | 天赋：自身洗入牌库，搜力量≤4 且非 G.E.L.F. 随从额外打出并洗牌。 | talent；先 `CARD_TO_DECK_BOTTOM` 让自身回到牌库，再由 `queueDeckMinionSearch` 的 `extraDeckUidsForShuffle` 把自身纳入最终洗牌。 | deck search interaction。 | L2 | Pass。不是固定留在牌库底；测试覆盖非第一张候选选择和自身仍在最终牌库中。 |
| `shapeshifters_mitosis` | 选择己方场上随从，从手牌额外打同名随从。 | `playNeedsMinion:self`；`shapeshifters_mitosis_choose`。 | hand card choice + immediate extra minion。 | L2 / scoped L3 | Pass。多张同名手牌可选具体 cardUid；2026-05-17 已补真实入口 E2E，确认同名候选、skip 与同名额外打出收口。 |
| `shapeshifters_doppelganger` | 从基地进弃牌堆时，从牌库搜随从打到原基地。 | `onMinionDiscardedFromBase` trigger；`queueDeckMinionSearch`。 | deck search interaction。 | L2 | Pass。 |
| `base_the_vats` | 此基地已有同名随从时不能再打同名随从到这里。 | base restriction `sameNameAlreadyAtBase`；`isOperationRestricted`；2026-05-15 补 `meFirst` 随从响应窗口 validate 分支。 | 普通出牌/弃牌堆/响应窗口命令验证；Board/MeFirstOverlay 响应窗口可部署态和提示改用 `validate(G, PLAY_*)` 过滤；`game.ts` response content 粗筛也过滤静态基地限制。 | L2 / scoped L3 | 旧 Pass 失效点：未审 Me First 分支，实际曾绕过基地 restriction。已修复并补普通同名拒绝、不同名允许、Me First 同名拒绝测试；2026-05-17 再补真实入口 E2E，确认 `The Vats` 被置灰/拒绝且同一张手牌仍可改打别的基地并收口。 |
| `base_faceless_city` | 随从打到此基地后，可从牌库找同名随从入手并洗牌。 | `onMinionPlayed` base ability；`base_faceless_city_choose`。 | 同名候选选择 / skip。 | L2 / scoped L3 | 旧 Pass 降级：当时只覆盖 prompt 候选和正向/skip，未证明 handler 拒绝伪造非同名候选。2026-05-15 已补 `allowedCardUids + minionDefId` 复核和负例；2026-05-17 再补真实入口 E2E，确认同名多候选 prompt、skip 按钮和所选第二张同名牌入手并收口。 |
| `cyborg_apes_monkey_on_your_back` | 附着随从；天赋摧毁这里另一玩家力量≤4随从，并把本行动放牌库底。 | ongoing talent；反查宿主和 attached action。 | talent 多候选选择 -> handler 复核目标。 | L2 | 2026-05-15 旧 Pass 失效点：`USE_TALENT` 没有目标 payload，旧实现多候选时自动选第一张，未满足 choose one。已补 `cyborg_apes_monkey_on_your_back_choose`、伪造高力量拒绝和本行动回牌库底测试。 |
| `cyborg_apes_cyberevolution` | 附着随从 +3。 | `registerOngoingPowerModifier(...,3)`。 | 自动有效力量计算。 | L2 | Pass。2026-05-16 已在 effect atom evidence 补每张 +3 与离开后归零测试。 |
| `cyborg_apes_juiced_up` | 附着随从按其身上每张行动 +2。 | custom power modifier；同时识别基础/POD defId，禁止 POD 双算。 | 自动有效力量计算。 | L2 | Pass。2026-05-16 已在 effect atom evidence 补“包含本卡”、POD alias、每实例与动态重算测试。 |
| `cyborg_apes_flying_monkey` | after scoring 可把该随从移到另一基地代替弃牌，然后摧毁本行动。 | afterScoring trigger；`cyborg_apes_flying_monkey_move`。 | 目的地选择 / skip。 | L2 | Pass。 |
| `cyborg_apes_shielding` | 该随从及其行动不受其他玩家行动影响。 | `registerProtection` action/affect；2026-05-15 追加 attached-action host protection。 | 自动保护。 | L2 | 旧 Pass 降级：当时只证明宿主随从保护，漏审 `and other actions on it`。已在 `smashup-in-progress-effect-atom-audit-2026-05-15.md` 拆成 effect atom，并补测试证明宿主上的其他行动不受对手行动影响。 |
| `cyborg_apes_furious_george` | 每有一张附着行动 +1。 | custom power modifier。 | 自动有效力量计算。 | L2 | Pass。2026-05-16 已在 effect atom evidence 补只作用自身、非 Furious 不吃加成与动态重算测试。 |
| `cyborg_apes_going_bananas` | 选择基地，摧毁该基地上和该基地随从上的其他玩家行动。 | `playNeedsBase` onPlay；对 target base 的 `ongoingActions` 与 `minions[].attachedActions` 发 `ONGOING_DETACHED`。 | 基地选择。 | L2 | Pass。2026-05-16 已在 effect atom evidence 拆 choose base、base actions、attached actions，并关联 Shielding 保护链。 |
| `cyborg_apes_baboom` | 天赋：额外打一个行动到 Baboom 自身。 | talent；`grantExtraAction(...playTiming:'immediate', restrictToMinionUid)`。 | talent activation -> immediate extra action。 | L2 | 2026-05-15 重审补强：旧 Pass 未写清 on this minion 限定；现 evidence 记录 `immediate-extra-action` 合同，测试覆盖 base action 不进候选、其他随从不进目标、单合法目标自动附着。 |
| `cyborg_apes_monkey_see_monkey_do` | 展示顶 5，任意数量行动入手，其余洗回牌库。 | onPlay；`cyborg_apes_monkey_see_monkey_do_choose`。 | multi-select interaction。 | L2 | Pass。旧“自动拿所有行动”已修复。 |
| `cyborg_apes_clyde_2_0` | 同基地己方随从上行动离场去弃牌时可改为进手牌。 | reducer `ONGOING_DETACHED` 旁路；2026-05-15 追加 Clyde replacement choice。 | 自动替代去向。 | L2 | 旧 Pass 降级：当时把 `may` 审成自动替代，缺少拒绝分支；已在 `smashup-in-progress-effect-atom-audit-2026-05-15.md` 拆 atom 并补回归。 |
| `cyborg_apes_missing_uplink` | 回合结束每张 Missing Uplink 各抽 1 张额外牌。 | onTurnEnd trigger；按拥有者聚合 live attached Missing Uplink / POD 实例数后一次性 draw count。 | 自动触发。 | L2 | 旧 Pass 降级：只覆盖单实例，未证明多实例逐张抽牌。2026-05-16 已修复“代表 sourceCardUid 只数第一张”的语义 bug，并补拥有者回合/多实例抽两张回归。 |
| `cyborg_apes_cyberback` | 可从弃牌堆打附着随从的持续行动到本随从。 | `Board.tsx` + `commands.ts` + reducer `ACTION_PLAYED fromDiscard` / `ONGOING_ATTACHED`。 | 弃牌堆行动 -> Cyberback 宿主选择。 | L3 | Pass，但旧对象级行不再等同 effect atom 全量证明。2026-05-15 已在新 evidence 追加三条 atom：允许己方弃牌堆持续附着行动、拒绝非持续/非附着行动、拒绝敌方 Cyberback 或己方非 Cyberback 目标。 |
| `base_primate_park` | 赢家可将这里随从上的行动返回拥有者手牌。 | afterScoring base ability；`base_primate_park_return`；候选包含此基地随从上的任意玩家附着行动，并用 `allowedCardUids + baseIndex` 防跨基地伪造。 | 多选附着行动。 | L2 | 2026-05-15 旧 Pass 失效：先前证据没有证明“任意 owner 的行动”和“回各自 owner 手牌”，且曾误限 winner-owned。本轮已修复并补多 owner / 跨基地伪造测试。 |
| `base_monkey_lab` | 此基地每个随从按自身附着行动数量 +1。 | `base_monkey_lab` power modifier。 | 自动有效力量计算。 | L2 | Pass。2026-05-16 已在 effect atom evidence 补 each minion here、本基地限定和动态重算测试。 |
| `super_spies_live_and_let_chum` | before scoring 摧毁这里力量≤3随从。 | special beforeScoring；`super_spies_live_and_let_chum_choose`。 | 多目标选择。 | L2 | Pass。 |
| `super_spies_the_spy_who_ditched_me` | 每位其他玩家弃 1 张随从牌或展示无随从手牌。 | onPlay；per-player discard prompt。 | 被影响玩家选择随从手牌。 | L2 | Pass。 |
| `super_spies_permit_to_kill` | 其他玩家展示顶 2；弃掉展示出的所有随从；其余牌任意顺序回顶。 | onPlay；固定弃展示随从，仅非随从排序。 | top reorder interaction。 | L2 | Pass。旧“力量≤2/可选弃随从”已修复。 |
| `super_spies_for_my_eyes_only` | 看顶 5，任意顺序放顶/底。 | onPlay；top/bottom reorder。 | reorder interaction。 | L2 | 2026-05-15 重审补强：旧 Pass 只证明正向重排，未证明 handler 只接受本次 inspected set；已补 `inspectedUids` 上下文与伪造第 6 张拒绝测试。 |
| `super_spies_the_base_is_not_enough` | before scoring 控制这里力量≤4随从到回合结束。 | special beforeScoring；`changeMinionController`。 | 多目标选择。 | L2 | Pass。回合结束归还走共享控制权清理。 |
| `super_spies_spy` | 看自己顶 3，任意顺序放顶/底。 | minion onPlay；reorder handler。 | reorder interaction。 | L2 | 2026-05-15 重审补强：handler 现在复核 `targetPlayerId + inspectedUids`，伪造未查看牌不会发 `DECK_REORDERED`。 |
| `super_spies_mindraker` | 附着基地，其他玩家在该基地计分时不能打行动。 | restriction `play_action`。 | command validation / restriction 查询。 | L2 / scoped L3 | Pass。覆盖其他玩家受限、拥有者不受限；2026-05-17 真实入口已证明 `Primate Park` 计分窗口里 `Mole` 的唯一候选会被封死并直接收口。 |
| `super_spies_operative` | 先选择任意数量玩家展示顶牌；只能把本次已展示牌中的任意数量放到底，其余留顶。 | minion onPlay；`super_spies_operative_players` -> `super_spies_operative_top_bottom`；二步携带 `revealedByPlayer`。 | player multi-select -> revealed-card multi-select。 | L2 | 旧“自动看每位玩家”结论失效；已修复为可选 0/N 个玩家，并防伪造未展示牌。 |
| `super_spies_from_q_with_love` | 抽 3，弃 2。 | onPlay；基于抽牌后的 projected hand 建 prompt。 | hand multi-select。 | L2 | Pass。覆盖旧手牌 + 新抽牌各弃一张。 |
| `super_spies_mole` | before scoring 可打一个行动作为特殊行动，限定当前计分基地并受计分窗口行动禁令影响。 | special beforeScoring；`grantExtraAction(...restrictToBase, specialActionWindow:'meFirst')`；`extraPlay` 候选/执行复核。 | special activation -> immediate extra action prompt。 | L2 / scoped L3 | 旧“普通额外行动”结论不足；已补同基地与 Mindraker 限制测试；2026-05-17 真实入口已证明唯一候选行动被 restriction 封死时不会错误冒出 Mole special 交互。 |
| `super_spies_discards_are_forever` | 所有玩家展示直到随从，弃所有展示牌。 | onPlay；reveal loop + `CARDS_MILLED`。 | 自动执行。 | L2 | Pass。 |
| `super_spies_secret_agent` | 其他玩家打行动后弃 1 张牌。 | onActionPlayed trigger。 | 打出行动的玩家选择任意手牌弃置。 | L2 | Pass。 |
| `base_secret_volcano_headquarters` | before scoring：所有玩家各展示牌库顶一张，打出展示出的随从到这里。 | beforeScoring base ability。 | 自动 reveal/play。 | L2 | Pass。旧“连续展示直到非随从”方向已修。 |
| `base_isis_swingin_pad` | 赢家看自己顶 3，任意顺序放顶/底。 | afterScoring base ability；真实 ID `base_isis_swingin_pad`。 | winner reorder interaction。 | L2 | 2026-05-15 重审补强：旧 ID 漂移和错误目标玩家已修复；本轮另补 inspected set handler 复核，伪造未查看牌拒绝。 |
| `time_travelers_its_astounding` | 从弃牌堆打一个行动作为额外行动。 | onPlay；discard action choice -> optional target prompt -> `ACTION_PLAYED fromDiscard isExtraAction` -> selected action onPlay / ongoing attach。 | discard action choice；若被选行动需要目标，则进入 `time_travelers_its_astounding_target`。 | L2 | 2026-05-15 旧 Pass 失效：旧实现只移动卡牌，未执行被选行动自身效果，也未保留目标链。本轮已补 `discard-action-extra-play` 合同、目标 prompt、执行链和伪造目标拒绝测试。 |
| `time_travelers_time_is_fleeting` | after scoring 从基地弃牌堆选择新基地代替翻基地。 | special afterScoring；`BASE_DECK_REORDERED`。 | base discard choice。 | L2 | Pass。 |
| `time_travelers_into_the_time_slip` | 将场上的一张牌返回拥有者手牌。 | onPlay；`CARD_TRANSFERRED` 支持 minion / base ongoing / attached action；prompt data 记录 `allowedCardUids`。 | field card choice；handler 只接受本次 prompt 候选集合。 | L2 | 旧 Pass 未证明 attached action 和 handler 候选集防伪造；已补 base ongoing、attached action 与 forged late live card 回归。 |
| `time_travelers_1_21_gigawatts` | 选择行动或随从，把弃牌堆中该类全部洗回牌库。 | onPlay；card type choice + deck reorder。 | type choice interaction。 | L2 | Pass。 |
| `time_travelers_do_over` | 使己方随从回手，可再额外打同名随从。 | `playNeedsMinion:self`；return + same-name immediate extra。 | minion target -> same-name prompt/skip。 | L2 | 旧 Pass 还漏审了 “play it again” 是否被错误锁回原基地。2026-06-01 已修为 returned-card 只锁 `sameNameDefId + specificCardUid`，不锁原 `baseIndex`，并补“返回后可改打另一基地”回归。 |
| `time_travelers_jumper` | 从基地进弃牌堆时可以回手。 | `registerTrigger(...optional:true, globalZones:['discard'])`；玩家选择 trigger 后才 recover。 | `smashup_reaction_choose` optional trigger / pass。 | L2 / scoped L3 | 旧“自动 recover”结论失效；已覆盖 pass 保留弃牌堆和选择 trigger 回手；新增多客户端 E2E 证明 controller=P1 看到 reaction，owner=P0 最终回手。 |
| `time_travelers_stasis_field` | 基地不能计分，拥有者回合开始摧毁本行动。 | base ability suppression + onTurnStart detach。 | 自动。 | L2 | Pass。 |
| `time_travelers_time_raider` | 天赋：弃牌堆选一张放牌库底。 | talent；discard choice + bottom。 | discard choice interaction。 | L2 | Pass。 |
| `time_travelers_time_walk` | 本回合可额外打 1 随从和 1 行动，抽 2，本卡改放牌库底。 | onPlay；banked this-turn grants + draw + bottom。 | 自动 grants，不创建 immediate prompt。 | L2 | 2026-05-15 追加：旧 Pass 把 `this turn` 错审为立即出牌；已改为普通本回合额度，测试断言无 immediate prompt、`minionLimit/actionLimit` +1、抽 2、本卡进牌库底。 |
| `time_travelers_repeater_perfect` | 进场：弃牌堆选行动放牌库顶。 | minion onPlay；discard action choice。 | discard action choice。 | L2 | Pass。 |
| `time_travelers_wormhole` | after scoring：将你在这里的随从洗回牌库代替进弃牌堆。 | special afterScoring；移入牌库后 shuffle。 | special base target。 | L2 | Pass。测试证明不是固定放底。 |
| `time_travelers_doctor_when` | 进场：可以返回另一己方随从；若返回，可以再将其作为额外随从打出。 | minion onPlay；`time_travelers_doctor_when_choose` 含 skip；handler 拒绝自身伪造；return 后授予 same-name immediate extra。 | own minion choice / skip -> immediate extra minion prompt。 | L2 | 旧“有候选就强制返回”结论已失效；此外 2026-06-01 继续回写：旧审计还漏了 returned-card extra minion 被错误锁回原基地，现已改为允许重打到任意合法基地，并补另一基地回归。 |
| `base_the_nexus` | 赢家可从基地弃牌堆选择一个基地代替抽新基地。 | afterScoring base ability；`base_the_nexus_choose`。 | winner base discard choice。 | L2 | Pass。 |
| `base_portal_room` | 赢家可在当前回合后进行额外回合。 | afterScoring base ability；`EXTRA_TURN_QUEUED` + `pendingExtraTurns` / `activeExtraTurn`。 | optional base reaction。 | L2 / scoped L3 | 旧 Pass 降级：当时只直调 executor 证明额外回合队列，没有覆盖 queued optional 选择权归属；2026-05-15 已修复 base ability queue 支持 `ownerPlayerId`，并证明赢家非当前玩家时由赢家 pass/accept；新增多客户端 E2E 证明只有赢家页面能点“传送门”，接受后才在当前回合结束后启动额外回合。 |

## 交互入口语义矩阵

本节按 `.spec/knowledge/standards/testing-audit.md` 的“交互入口语义矩阵”补齐所有含选择、移动、排序、可选执行或后续连锁的对象；纯自动光环/持续加力/保护类对象以 56 对象矩阵中的自动出口为准，不再伪造不存在的玩家入口。

| 对象 | 动作链 | 第一入口 | 字段/命令 | 目标归属 | 数量/可选 | 上下文携带 | 验证层级 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `shapeshifters_bacta_the_future` | 选择随从 -> 摧毁 -> 该随从拥有者立即额外打随从 | 场上随从 | `PLAY_ACTION.targetMinionUid` | any；额外额度给被摧毁随从 owner | exact 1 | `minionUid/baseIndex/owner` 来自目标实体 | L2 | Pass，未把额外额度错误给施放者。 |
| `shapeshifters_genetic_shift` | 选择模式 -> all 己方 +1 或 single 己方单随从 +3 | 模式按钮或随从 | `shapeshifters_genetic_shift_choose.value` | all/single 均限当前玩家控制；handler 二次复核 | choose one | `mode/minionUid` | L2 | Pass，all、single 和伪造 single 分支均不再影响敌方随从。 |
| `shapeshifters_transmogrify` | 选己方随从 -> 摧毁 -> 牌库选等/低力量随从打到同基地 | 己方随从 | `PLAY_ACTION.targetMinionUid` + deck search choice | source self；deck 候选 owner self | exact 1 + exact 1 | `baseIndex/maxPower/reason` | L2 | Pass，后续搜索保留原基地和力量上限。 |
| `shapeshifters_really` | 选己方随从 -> 摧毁 -> 弃牌堆选等/低力量随从 -> 选择打出基地 | 己方随从，再选弃牌堆随从，再选基地 | `PLAY_ACTION.targetMinionUid` + `shapeshifters_really_search.cardUid` + `shapeshifters_really_base.baseIndex` | source self；discard 候选 owner self；base any legal | exact 1 + exact 1 + exact 1 | `maxPower/reason/selectedCardUid/baseIndex` | L2 | 已修复旧“同基地”误判；无 `here` 时不能偷锁原基地。 |
| `shapeshifters_cellular_bonding` | 附着随从 -> 选择同宿主另一张行动 -> 记录复制能力 | 宿主随从，再选附着行动 | `targetMinionUid` / `shapeshifters_cellular_bonding_choose.actionUid` | 宿主 any；复制候选限定同宿主且非本卡 | exact 1；多候选时选择 | `hostMinionUid/hostBaseIndex/bondingCardUid/actionUid`，handler 复核本卡真实附着在该 host | L2 / 边界 | Pass for current proxy；拒绝伪造 hostBaseIndex / bondingCardUid；不声明任意能力动态复制。 |
| `shapeshifters_copycat` | 进场 -> 选择另一玩家随从 -> 本回合代理其已实现能力面 | 其他玩家随从 | `shapeshifters_copycat_choose.minionUid` | opponent only；metadata 写入对象必须是己方 Copycat 本体 | exact 1 | `copycatUid/copiedAbilityUntilTurn` | L2 / 边界 | Pass for current proxy；handler 拒绝复制己方随从，也拒绝伪造 `copycatUid` 写入非 Copycat。 |
| `shapeshifters_gelf` | 天赋 -> 自身回牌库并纳入洗牌 -> 牌库选力量≤4非 G.E.L.F. 随从打到同基地 | deck search 候选 | `shapeshifters_gelf_search.cardUid` | self deck | exact 1 | `baseIndex/excludeDefId/maxPower/extraDeckUidsForShuffle` | L2 | Pass，先回牌库再最终洗牌的上下文已保留。 |
| `shapeshifters_mitosis` | 选己方场上随从 -> 手牌选同名随从额外打到同基地 | 己方随从，再选手牌同名 | `PLAY_ACTION.targetMinionUid` / `shapeshifters_mitosis_choose.cardUid` | source self；hand self | exact 1 + exact 1 | `baseIndex/sameNameDefId/cardUid` | L2 / scoped L3 | Pass，多张同名手牌可精确选；真实入口已证明 `same-b` 可被选中并打到 `The Vats`，而 `same-a`/`wrong-name` 留在手牌。 |
| `shapeshifters_doppelganger` | 从基地进弃牌堆触发 -> 牌库选随从打到原基地 | deck search 候选 | `shapeshifters_doppelganger_search.cardUid` | self deck | exact 1 | `baseIndex/reason` | L2 | Pass，触发时保留原基地。 |
| `base_faceless_city` | 随从打到此基地 -> 可搜同名随从入手并洗牌 | deck 同名候选或 skip | `base_faceless_city_choose.cardUid/skip` | played minion owner | optional exact 1 | `playedDefId/playerId` | L2 / scoped L3 | 2026-05-15 重审修复：handler 现在复核本次同名候选集合，伪造非同名牌不会入手；2026-05-17 真实入口证据已确认 `same-a/same-b/skip` 只列同名候选，并在选中 `same-b` 后把剩余牌库收口为 `same-a,other-card`。 |
| `cyborg_apes_monkey_on_your_back` | 天赋 -> 选同基地另一玩家力量≤4随从摧毁 -> 本行动回牌库底 | 目标随从 | `cyborg_apes_monkey_on_your_back_choose.minionUid` | opponent at same base | exact 1 | `actionUid` 反查宿主；handler 复核 base/controller/power | L2 | 2026-05-15 重审修复：旧行错误写成 talent payload `minionUid`，实际命令无目标；已补多目标 prompt 和伪造高力量拒绝。 |
| `cyborg_apes_flying_monkey` | after scoring -> 可选目的基地移动宿主 -> 摧毁本行动 | 目的基地或 skip | `cyborg_apes_flying_monkey_move.toBaseIndex/skip` | host owner | optional exact 1 | `minionUid/actionUid/fromBaseIndex/toBaseIndex/reason` | L2 | Pass，移动对象和被摧毁行动不混淆。 |
| `cyborg_apes_going_bananas` | 选基地 -> 摧毁该基地和该基地随从上的其他玩家行动 | 基地 | `PLAY_ACTION.targetBaseIndex` | any base | exact 1 | `baseIndex` | L2 | 2026-05-16 effect atom evidence 已补 base ongoing actions 与 attached actions 两条摧毁链，旧 interaction row “只清 attached actions”表述不完整。 |
| `cyborg_apes_baboom` | 天赋 -> 额外打一个行动到 Baboom 自己身上 | talent 按钮 | talent command -> immediate extra action | self | optional activation / skip | `playerId/reason/restrictToBase/restrictToMinionUid` | L2 | 2026-05-15 重审补强：shared-contract 为 `immediate-extra-action`，执行前复核 `restrictToMinionUid`；单合法目标自动附着。 |
| `cyborg_apes_monkey_see_monkey_do` | 展示顶 5 -> 选择任意数量行动入手 -> 其余洗回 | 多选行动 | `cyborg_apes_monkey_see_monkey_do_choose.cardUids` | self deck reveal | any number incl 0 | `revealedUids/selectedUids` | L2 | Pass，已修复旧“自动拿所有行动”。 |
| `cyborg_apes_cyberback` | 从弃牌堆选择持续行动 -> 选择 Cyberback 宿主 -> 附着 | 弃牌堆行动，再选宿主 | discard play command / `targetMinionUid` | self discard；host self Cyberback | exact 1 + exact 1 | `cardUid/fromDiscard/targetMinionUid` | L3 | Pass，E2E 证明多宿主不会自动附第一只；2026-05-15 追加 L2 负例证明普通行动、敌方 Cyberback、己方非 Cyberback 均不能绕过 validator。该三条负例在 `Board.tsx` 中本来就被 `cyberbackDiscardActionOptions` / `cyberbackDiscardTargetUids` 预过滤，不存在独立真实可点击 browser 分支。 |
| `base_primate_park` | after scoring -> 赢家可选择这里随从上的行动回手 | attached action 多选 | `base_primate_park_return.cardUids` | winner choice；任意 owner 的 attached action；card owner receives | any number incl 0 | `allowedCardUids/baseIndex/cardUid` 活体重定位 | L2 | 已修复旧 winner-owned 误限；覆盖多 owner 回各自手牌与跨基地伪造拒绝。 |
| `super_spies_live_and_let_chum` | before scoring -> 选这里力量≤3随从摧毁 | 目标随从 | `super_spies_live_and_let_chum_choose.minionUid` | any at scoring base | exact 1 | `baseIndex/minionUid` | L2 | Pass，handler 复核同基地与力量上限。 |
| `super_spies_the_spy_who_ditched_me` | 每位其他玩家选择弃 1 张随从；无随从则展示 | 被影响玩家手牌随从 | per-player discard prompt `cardUid` | each opponent | exact 1 or reveal-none | `affectedPlayerId/cardUid` | L2 | Pass，选择权归被影响玩家。 |
| `super_spies_permit_to_kill` | 其他玩家展示顶 2 -> 展示随从强制弃 -> 非随从任意顺序回顶 | 非随从排序 | `super_spies_permit_to_kill_order` | each opponent deck | order remaining | `targetPlayerId/revealedUids/discardUids/topUids` | L2 | Pass，已修复旧“可选弃随从/力量≤2”语义。 |
| `super_spies_for_my_eyes_only` | 看自己顶 5 -> 任意顺序放顶/底 | 排序/分区 | `super_spies_for_my_eyes_only_reorder` | self deck | order all inspected | `targetPlayerId/inspectedUids/topUids/bottomUids` | L2 | 2026-05-15 重审补强：prompt data 写入 inspectedUids，handler 拒绝夹带未查看牌。 |
| `super_spies_the_base_is_not_enough` | before scoring -> 选这里力量≤4随从控制到回合结束 | 目标随从 | `super_spies_the_base_is_not_enough_choose.minionUid` | any at scoring base | exact 1 | `baseIndex/minionUid/originalController` | L2 | Pass，回合结束归还。 |
| `super_spies_spy` | 进场 -> 看自己顶 3 -> 任意顺序放顶/底 | 排序/分区 | `super_spies_spy_reorder` | self deck | order all inspected | `targetPlayerId/inspectedUids/topUids/bottomUids` | L2 | 2026-05-15 重审补强：handler 复核完整 inspected set，伪造未查看 `deck-d` 不发重排事件。 |
| `super_spies_operative` | 选择任意数量玩家 -> 展示所选玩家顶牌 -> 可把任意数量已展示牌放到底 | 玩家多选，再选已展示牌 | `super_spies_operative_players.targetPlayerId[]` -> `super_spies_operative_top_bottom.cardUid[]` | any player；第二步仅本次 revealed cards | any number incl 0 / any number incl 0 | `revealedByPlayer` 绑定第一步结果 | L2 | 已修复旧“自动看全体”和 handler 可伪造未展示牌风险。 |
| `super_spies_from_q_with_love` | 抽 3 -> 弃 2 | 手牌多选 | discard prompt `cardUids` | self hand after draw | exact 2 | projected hand includes drawn cards | L2 | Pass，覆盖新旧手牌混弃。 |
| `super_spies_mole` | before scoring -> 可打一个行动作为特殊行动 | special activation -> immediate extra action | special command + extra action prompt | self；限定当前计分基地 | optional activation；extra action 可 skip | `playerId/reason/restrictToBase/specialActionWindow` | L2 | 已补同基地限制与 Mindraker 计分窗口禁令测试；2026-05-17 重审补强：reaction session 记录 `consumedSpecialCardUids`，skip 后不会重开同一张 Mole 的 response choose。 |
| `super_spies_secret_agent` | 其他玩家打行动后 -> 该玩家弃 1 张牌 | 打行动玩家手牌 | `super_spies_secret_agent_discard.cardUid` | action player | exact 1 | `playerId/cardUid` | L2 | Pass。 |
| `base_isis_swingin_pad` | after scoring -> 赢家看自己顶 3 -> 任意顺序放顶/底 | 赢家排序/分区 | `base_isis_swingin_pad_reorder` | winner deck | order inspected | `winnerId/targetPlayerId/inspectedUids/topUids/bottomUids` | L2 | 2026-05-15 重审补强：旧 ID 漂移和目标玩家错误已修复；本轮补 handler inspected set 防伪造。 |
| `time_travelers_its_astounding` | 从弃牌堆选行动 -> 若该行动需要目标则继续选目标 -> 作为额外行动从弃牌堆真实打出并执行被选行动效果 | 弃牌堆行动；后续目标取决于被选行动 | `time_travelers_its_astounding_choose.cardUid` -> `time_travelers_its_astounding_target.targetBaseIndex/targetMinionUid` | self discard；目标归属继承被选行动自身语义 | exact 1；目标 exact 1 when required | `cardUid/targetBaseIndex/targetMinionUid/fromDiscard/isExtraAction` | L2 | 2026-05-15 重审修复：旧 interaction row 未覆盖目标链与 onPlay 执行链，已用 Time Walk 和 Going Bananas 行为测试补证。 |
| `time_travelers_time_is_fleeting` | after scoring -> 从基地弃牌堆选基地置顶代替翻新基地 | 基地弃牌堆基地 | `time_travelers_time_is_fleeting_choose.baseDefId` | shared base discard | exact 1 | `baseDefId/reason` | L2 | Pass。 |
| `time_travelers_into_the_time_slip` | 选择场上的一张牌 -> 返回拥有者手牌 | 场上牌 | `time_travelers_into_the_time_slip_choose.cardUid` | any in-play card | exact 1 | `allowedCardUids/cardUid/type/ownerId/baseIndex`，handler 复核本次候选集合 | L2 | Pass，覆盖基地持续行动、附着行动和伪造晚加入场上牌拒绝。 |
| `time_travelers_1_21_gigawatts` | 选择行动或随从 -> 弃牌堆该类全部洗回牌库 | 类型按钮 | `time_travelers_1_21_gigawatts_choose.cardType` | self discard | choose one type | `cardType` | L2 | Pass。 |
| `time_travelers_do_over` | 选己方随从回手 -> 可额外打同名随从到任意合法基地 | 己方随从 | `PLAY_ACTION.targetMinionUid` | self minion | exact 1 | `sameNameDefId/specificCardUid`，不锁原 `baseIndex` | L2 | 旧 interaction 口径把 `again` 误审成“回原基地重打”；2026-06-01 已修正并补“返回 `Jumper` 后改打到另一基地”回归。 |
| `time_travelers_time_raider` | 天赋 -> 弃牌堆选一张牌放牌库底 | 弃牌堆牌 | `time_travelers_time_raider_choose.cardUid` | self discard | exact 1 | `cardUid/reason` | L2 | Pass。 |
| `time_travelers_repeater_perfect` | 进场 -> 弃牌堆选行动放牌库顶 | 弃牌堆行动 | `time_travelers_repeater_perfect_choose.cardUid` | self discard | exact 1 | `cardUid/reason` | L2 | Pass。 |
| `time_travelers_wormhole` | after scoring -> 选这里己方随从洗回牌库代替弃牌 | 己方随从 | special target payload | self at scoring base | optional exact 1 | `minionUid/baseIndex` | L2 | Pass，测试证明洗牌而非固定放底。 |
| `time_travelers_doctor_when` | 进场 -> 可跳过或选另一己方随从回手 -> 若回手则可额外打同名随从到任意合法基地 | skip 或己方随从 | `time_travelers_doctor_when_choose.skip/minionUid` | self minion；not self Doctor | optional exact 0/1 | `doctorUid/sameNameDefId/specificCardUid`，不锁原 `baseIndex` | L2 | 已修复 `may`，并拒绝 forged self；2026-06-01 继续锁定 returned minion 不会被错误限制在原基地重打。 |
| `base_the_nexus` | after scoring -> 赢家可选基地弃牌堆基地置顶 | 基地弃牌堆基地或 skip | `base_the_nexus_choose.baseDefId/skip` | winner choice | optional exact 1 | `baseDefId` | L2 | Pass。 |
| `base_portal_room` | after scoring -> 赢家可排入额外回合 | base reaction choice | base ability command / skip | winner | optional | `winnerId/returnToPlayerIndex` | L2 / scoped L3 | 2026-05-15 重审修复：queued optional trigger owner 曾默认当前回合玩家，现通过 `BaseAbilityRegistrationOptions.ownerPlayerId` 指向 rankings winner；测试覆盖赢家 P1 pass 不排队、accept 排队；2026-05-17 再补多客户端真实入口，证明 only winner page gets the choice. |

## 本轮修复

- 修复 `shapeshifters_genetic_shift`：无目标入口不再静默当作“所有你的随从 +1”，而是创建 `shapeshifters_genetic_shift_choose`，玩家可选 all 或 single；all 只影响当前玩家控制的随从。
- 2026-05-15 追补修复 `shapeshifters_genetic_shift`：single 分支也必须只允许“你的一个随从 +3”，direct target、交互候选和 handler 均拒绝敌方随从；同步修正中英文 effectText。
- 2026-05-15 长描述复审修正 `shapeshifters_gelf` 证据口径：规则是“洗入牌库”，不是固定“回牌库底”。当前实现通过先入牌库再纳入 `deckReordered` 洗牌达成该语义；测试名称与证据已同步。
- 修复 `cyborg_apes_juiced_up`：POD 自动别名曾导致基础版 `Juiced Up` 被基础版和 `_pod` source 双重计数；现改为内部同时识别基础/POD defId，并声明 `handlesPodInternally`，避免重复加力。
- 修正测试真值：`shapeshifters_mimic` 测试不再把夹具 `basePower=5` 当作印刷力量证据，改用真实印刷力量为 5 的 `sharks_megalodon`。
- 2026-05-16 effect atom 追补修复 `shapeshifters_bacta_the_future` 证据口径：旧对象级 Pass 只证明 `LIMIT_MODIFIED` 给目标 owner，未证明 postProcess 后的 immediate prompt 也归属目标 owner；已补 `finalState.sys.interaction.current.playerId === target.owner` 断言。
- 修正持续力量测试隔离：`Furious George` 的直接测试不再同时挂 `Splice as Nice`，避免把两个力量能力叠加后误判。
- 2026-05-15 effect atom 追补修复 `shapeshifters_really`：原文没有 `here`，弃牌堆随从选择后必须再选打出基地；旧“打到同基地”对象级结论失效。
- 2026-05-15 effect atom 追补修复 `super_spies_operative`：先选择任意数量玩家再展示顶牌；第二步只能操作本次已展示牌，空选不会 reveal。
- 2026-05-15 effect atom 追补修复 `super_spies_mole`：额外行动携带 `restrictToBase` 与 `specialActionWindow`，作为计分前特殊行动受当前基地和 Mindraker 等计分窗口限制约束。
- 2026-05-17 重审追补 `super_spies_mole`：旧结论把“出现 skip prompt”误当成“整条链已收口”；现以 reaction session 局部消费记录锁住已用 Mole，`Mole -> immediate extra -> skip` 后不再回到同一张 Mole 的入口。
- 2026-05-15 effect atom 追补修复 `time_travelers_doctor_when`：补 `may` 的 skip 入口，并拒绝伪造返回 Doctor When 自身。
- 2026-05-15 effect atom 追补修复 `time_travelers_jumper`：注册为 optional trigger，真实入口通过 `smashup_reaction_choose` 选择 trigger 或 pass，不再把 may 当自动强制。
- 2026-05-15 effect atom 追补修复 `base_primate_park`：旧 Pass 没有证明“这里随从上的任意行动回各自拥有者手牌”，并曾误限 winner-owned；现候选包含任意 owner 的 attached actions，handler 用 `allowedCardUids + baseIndex` 拒绝跨基地伪造。
- 2026-05-15 effect atom 追补修复 `time_travelers_time_box`：旧 counter 证据只覆盖弃牌堆 recover，漏掉 `from play` 的 `CARD_TRANSFERRED` 后处理；现 `processReturnToHandTriggers` 已覆盖场上/弃牌堆回手，并用 Primate Park 场上附着行动回手触发 Time Box 加到 5 的测试证明。
- 2026-05-15 effect atom 追补修复 `shapeshifters_copycat`：旧对象级结论只证明选敌方目标，没有证明 metadata 写入本体；现 handler 复核写入对象必须是当前玩家控制的 Copycat，并补伪造 `copycatUid` 指向普通随从无效的回归。
- 2026-05-15 effect atom 追补修复 `shapeshifters_cellular_bonding`：旧对象级结论只证明能记录 copied action，没有证明 host/base/bonding uid 上下文；现 handler 复核 host baseIndex 和本 Cellular Bonding 真实附着在宿主上，并补伪造上下文无效回归。
- 2026-05-15 effect atom 追补修复 `base_the_vats`：旧 Pass 只覆盖普通打出，漏掉 `meFirst` 响应窗口中 beforeScoringPlayable 随从可绕过 `sameNameAlreadyAtBase`；现 `commands.validate` 的响应窗口分支补 `isOperationRestricted`/playConstraint，Board/MeFirstOverlay 响应窗口可部署态和提示用 `validate(G, PLAY_*)` 过滤，`game.ts` response content 粗筛也过滤静态基地限制，并新增 Me First 同名 `ninja_shinobi` 拒绝回归。
- 2026-05-15 effect atom 追补修复 `time_travelers_into_the_time_slip`：旧 Pass 只证明可选基地持续行动，未证明附着行动，也未绑定本次 prompt 候选集合；现 prompt 写入 `allowedCardUids`，handler 拒绝伪造/晚加入 live card，并补 attached action 回 owner hand 测试。

## 验证记录

- `npm run test -- src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts`：1 file / 62 tests passed。
- `npm run test -- src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts src/games/smashup/__tests__/shayuFactionAbilities.test.ts`：2 files / 79 tests passed。
- `npm run test -- src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/commandsValidation.test.ts src/games/smashup/__tests__/smashup.smoke.test.ts`：3 files / 379 passed / 1 skipped。
- `npm run test -- src/games/smashup/__tests__/yuanhouFactionIntake.test.ts`：1 file / 9 tests passed。
- `npm run test -- src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts src/games/smashup/__tests__/yuanhouFactionIntake.test.ts src/games/smashup/__tests__/cardI18nIntegrity.test.ts src/components/common/media/__tests__/CardPreview.i18n.test.tsx src/games/smashup/__tests__/criticalImageResolver.test.ts src/games/smashup/__tests__/factionSelection.test.ts`：6 files / 158 tests passed。
- `npm run typecheck`：通过。
- `npm run i18n:check`：`no missing keys detected`。
- `node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/zh-CN --id smashup`：通过。
- `git diff --check`：通过，仅有 LF/CRLF 工作区提示。
- `npx eslint src/games/smashup/abilities/yuanhou.ts src/games/smashup/abilities/ongoing_modifiers.ts src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts src/games/smashup/__tests__/yuanhouFactionIntake.test.ts`：通过。
- `npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts`：3 tests passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native -t "鼹鼠在真实计分窗口放弃额外行动后必须正常收口" --pool forks --no-file-parallelism --maxWorkers 1`：1 file / 1 test passed。
- `npm run test:e2e:ci:file -- e2e/smashup-yuanhou-factions.e2e.ts "超级间谍-Mindraker-真实计分窗口会禁止其他玩家通过Mole打行动到这里"`：1 test passed。
- `npm run test:e2e:ci:file -- e2e/smashup-yuanhou-jumper-multiplayer.e2e.ts "时间旅行者-Jumper-真实多客户端下应先给 owner 的 Bacta extra prompt，再给 controller 的 optional reaction，并最终回 owner 手牌"`：1 test passed。
- `npm run test:e2e:ci:file -- e2e/smashup-yuanhou-jumper-multiplayer.e2e.ts "时间旅行者-Portal Room-真实多客户端下赢家不是当前回合玩家时应只给赢家页面额外回合选择权"`：1 test passed。
- 2026-05-15 追补：`npm run test -- src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts`：1 file / 69 tests passed。
- 2026-05-15 追补：`npm run test -- src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts`：1 file / 71 tests passed。
- 2026-05-15 追补：`npm run test -- src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts`：1 file / 72 tests passed。
- 2026-05-15 追补：`npm run test -- src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts`：1 file / 82 tests passed。
- 2026-05-15 追补：`npx eslint src/games/smashup/domain/commands.ts src/games/smashup/Board.tsx src/games/smashup/ui/MeFirstOverlay.tsx src/games/smashup/game.ts src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts`：0 errors（保留既有 warnings）。
- 2026-05-15 追补：`npm run typecheck`：通过。
- 2026-05-15 追补：`git diff --check`：通过，仅 LF/CRLF 工作区提示。
- 2026-05-15 追补：`npm run test -- src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts`：1 file / 83 tests passed。

## E2E 截图核对

- `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\派系选择页能看到四个新派系、实施中标记与素材卡\yuanhou-faction-selection-visible.png`
  - 肉眼观察：`变形者`、`电子猿`、`超级间谍`、`时间旅行者` 四个 yuanhou 派系入口可见，卡面来自 yuanhou 图集并带“实施中”标记。旧派系仍有白卡不属于本轮对象。
- `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Cyberback-可从弃牌堆真实选择持续行动并打到自己身上\yuanhou-cyberback-discard-action-visible.png`
  - 肉眼观察：P1 出牌阶段，Monkey Lab 上有己方 Cyberback；弃牌堆面板展开，`Cyberevolution` 可见并高亮，证明真实 UI 暴露弃牌堆行动入口。
- `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Cyberback-可从弃牌堆真实选择持续行动并打到自己身上\yuanhou-cyberback-action-attached.png`
  - 肉眼观察：`Cyberevolution` 已附着到 Cyberback，Monkey Lab 总力量从 5 变为 9，弃牌堆计数从 1 变为 0；这证明不是仅 UI 高亮，而是弃牌堆行动真实进入 attachedActions。
- `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Cyberback-多宿主时可精确选择附着目标\yuanhou-cyberback-multi-target-selectable.png`
  - 肉眼观察：同一 Monkey Lab 上有两只 Cyberback，选中 `Shielding` 后进入随从选择状态，没有自动附着第一只。
- `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\电子猿-Cyberback-多宿主时可精确选择附着目标\yuanhou-cyberback-multi-target-attached-to-second.png`
  - 肉眼观察：`Shielding` 附着标记出现在第二只 Cyberback 旁，第一只没有该附着行动；E2E 状态断言同步确认 `shield-discard` 已从弃牌堆移除。
- `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\变形者基地-The-Vats-真实入口会把同名随从所在基地置灰并只允许打到别的基地\yuanhou-the-vats-same-name-base-blocked-other-base-still-legal.png`
  - 肉眼观察：`The Vats` 卡面已变灰，当前手牌里的 `Mako` 仍在手牌区，而 `Portal Room` 保持可点；这证明同名基地会被真实 UI 置灰/拒绝，而不是整个出牌链被锁死。
- `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\变形者基地-The-Vats-真实入口会把同名随从所在基地置灰并只允许打到别的基地\yuanhou-the-vats-same-name-minion-played-to-other-base.png`
  - 肉眼观察：`Portal Room` 上出现新的 `Mako` 本体，`The Vats` 仍保留原有同名随从，桌面没有残留 prompt；这证明受限基地点击后不会偷偷进场，改点另一基地后真实入口正常收口。
- `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-Mindraker-真实计分窗口会禁止其他玩家通过Mole打行动到这里\yuanhou-mindraker-mole-reaction-choice.png`
  - 肉眼观察：真实计分场景中已经弹出 `smashup_reaction_choose`，中间可见 `内鬼特殊能力` 与 `让过` 两个按钮，不是伪造独立面板。
- `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-Mindraker-真实计分窗口会禁止其他玩家通过Mole打行动到这里\yuanhou-mindraker-skip-only-extra-action-prompt.png`
  - 肉眼观察：额外行动 prompt 明确显示 `放弃这次额外战术`，`Going Bananas` 虽在手里但没有被自动打出；这证明 skip prompt 本身是正确语义。
- `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\超级间谍-Mindraker-真实计分窗口会禁止其他玩家通过Mole打行动到这里\yuanhou-mindraker-scoring-resolved-without-mole-action.png`
  - 肉眼观察：画面已回到出牌阶段，场上只剩 `The Nexus` / `Portal Room`，没有残留 reaction choose 或额外行动 prompt，说明 skip 后链路已正常收口。
- `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\时间旅行者-Jumper-真实多客户端下应先给-owner-的-Bacta-extra-prompt，再给-controller-的-optional-reaction，并最终回-owner-手牌\yuanhou-jumper-owner-extra-prompt-host.png`
  - 肉眼观察：owner 页先弹出 `立刻打出一个额外随从，或放弃这次机会`，说明 Bacta 的 immediate extra prompt 先由 owner 消费；`stolen-jumper` 仍在场上待处理，没有直接回手。
- `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\时间旅行者-Jumper-真实多客户端下应先给-owner-的-Bacta-extra-prompt，再给-controller-的-optional-reaction，并最终回-owner-手牌\yuanhou-jumper-controller-reaction-prompt-guest.png`
  - 肉眼观察：controller 页出现 `选择一个反应动作`，按钮是 `跳跃者 / 让过`，证明 optional reaction 的选择权属于当前控制者而不是 owner。
- `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\时间旅行者-Jumper-真实多客户端下应先给-owner-的-Bacta-extra-prompt，再给-controller-的-optional-reaction，并最终回-owner-手牌\yuanhou-jumper-returned-card-in-owner-hand.png`
  - 肉眼观察：`Jumper` 已出现在 owner 手牌区，说明 controller 触发后最终回到的是 owner=P0 的手牌，而不是 controller 页。
- `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\时间旅行者-Portal-Room-真实多客户端下赢家不是当前回合玩家时应只给赢家页面额外回合选择权\yuanhou-portal-room-current-player-no-choice-host.png`
  - 肉眼观察：host 页只显示 `等待 Guest-SU-E2E 响应...`，没有 `传送门` 按钮；说明 Portal Room 的选择权确实没有落到当前回合玩家页。
- `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\时间旅行者-Portal-Room-真实多客户端下赢家不是当前回合玩家时应只给赢家页面额外回合选择权\yuanhou-portal-room-winner-prompt-guest.png`
  - 肉眼观察：winner 页出现 `选择一个反应动作`，按钮包含 `传送门` 与 `让过`，证明选择权只在赢家页面。
- `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-yuanhou-factions\test-results\evidence-screenshots\_shared\smashup-yuanhou-jumper-multiplayer.e2e\时间旅行者-Portal-Room-真实多客户端下赢家不是当前回合玩家时应只给赢家页面额外回合选择权\yuanhou-portal-room-extra-turn-started-for-winner-guest.png`
  - 肉眼观察：额外回合启动后，winner 页顶端出现 `轮到你了`，右上比分为 `0 / 2`，场上已换成 `Faceless City` 和 `The Nexus`；这说明不是在计分窗口里提前切回，而是先收口当前回合再启动额外回合。

## 当前边界

- 本次可以声明：56 个 yuanhou 对象已有对象级 rollup，且 `time_travelers_jumper` / `base_portal_room` 已补多客户端真实入口 scoped L3；对象级重审中发现的 HIGH/CRITICAL 语义错误均已修复或降级为明确边界。
- 本次不能声明：56 个 yuanhou 对象已经完成 effect atom 级全量审计。后续必须以 `smashup-in-progress-effect-atom-audit-2026-05-15.md` 的 atom inventory 为准继续核销。
- 本次不能声明：`Copycat` / `Cellular Bonding` 已经支持任意跨派系 onPlay / special / trigger 的完全动态复制 runtime。当前只证明已实现的代表性代理链路；若未来要把这两张牌升级为完整动态复制，需要另开专项机制，而不能复用本证据冒充已完成。

## 2026-06-01 回写：`从头来过 / 时间博士` 旧审计结论失效

- **旧结论是什么**：
  - `time_travelers_do_over` 旧条目只把风险写成“same-name prompt 不应误放行非同名”。
  - `time_travelers_doctor_when` 旧条目只把风险写成“may/skip 与 forged self”。
  - 交互入口矩阵还把两者 continuation 记成了 `sameNameDefId/baseIndex` 与 `doctorUid/sameNameDefId/baseIndex`。
- **为何失效**：旧审计把 `play it again / returned card` 只审成“同名 + 指定卡”语义，漏掉了另一个高风险限定词 `again` 不等于“回原基地再打一次”。实现当时把 returned minion 的 immediate extra 绑定到原 `baseIndex`，导致从基地回手后不能改打到别的合法基地。
- **新增证据**：
  - [src/games/smashup/abilities/yuanhou.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/abilities/yuanhou.ts:1341)：`time_travelers_doctor_when` / `time_travelers_do_over` 改为 `grantExtraMinion(..., undefined, { sameNameDefId, specificCardUid })`，去掉原基地绑定。
  - [src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts:7462)：新增“时间旅行者：从头来过允许把刚返回的随从重新打到另一基地”。
  - [src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts:11481)：新增“时间旅行者：时间博士允许把刚返回的随从重新打到另一基地”。
  - 验证：`npx vitest run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --config vitest.config.ts -t "从头来过|时间博士"`。
- **新结论**：这两张时间旅行者牌现在都按 returned-card extra minion 语义执行：只锁“刚回手的那张牌”，不锁“必须回原基地”。这次漏审命中 D1/D5/D18/D49：旧审计把对象语义拆得不够细，只证明了 specific-card / same-name，没有把“again 的空间约束”核到 handler 参数层。
