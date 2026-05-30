# Smash Up 实施中派系长描述全链路审计

## 范围与抽取

触发口径：用户要求“抽取新的所有实施中派系，挑描述长的全链路检查”。

当前 `isFactionImplementationInProgress` 命中的派系：

| 派系 | 来源 | 本轮选取对象 |
| --- | --- | --- |
| `fairies` | `IN_PROGRESS_FACTION_IDS` | `fairies_spirit_of_the_forest` |
| `princesses` | `IN_PROGRESS_FACTION_IDS` | `princesses_heirloom` |
| `sharks` | `implementationStatus: in_progress` | `sharks_week_of_sharks` |
| `tornados` | `implementationStatus: in_progress` | `tornados_not_in_kansas` |
| `mythic_greeks` | `implementationStatus: in_progress` | `mythic_greeks_jason`，并保留 `mythic_greeks_favor_of_dionysus` 对照 |
| `shapeshifters` | `implementationStatus: in_progress` | `shapeshifters_gelf`，并追补 `shapeshifters_transmogrify` / `shapeshifters_bacta_the_future` / `shapeshifters_genetic_shift` |
| `cyborg_apes` | `implementationStatus: in_progress` | `cyborg_apes_flying_monkey` |
| `super_spies` | `implementationStatus: in_progress` | `super_spies_moon_zero_three`，并追补 `super_spies_permit_to_kill` |
| `time_travelers` | `implementationStatus: in_progress` | `time_travelers_time_box`，并追补 `time_travelers_time_is_fleeting` |

抽取方法：读取 `public/locales/zh-CN/game-smashup.json` 中 `cards.*.effectText/abilityText` 长度，按每个实施中派系排序，选取每派系最长描述对象；若最长对象是 Titan，则同时检查 `data/titans.ts`、`abilities/titans.ts` 和相关 smoke 测试入口。抽取复核发现旧草稿漏选 `mythic_greeks_jason` 与 `shapeshifters_gelf`，本文件已按实际排序修正。

## 全链路矩阵

| 对象 | 长描述语义 | 静态定义 | 执行/handler/reducer | UI/交互出口 | 测试证据 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| `fairies_spirit_of_the_forest` | 代替通常随从和通常行动打出；每回合一次把 “or” 效果两项都用；泰坦交锋失败时可移动到另一基地。 | `data/titans.ts`：`summonMode: insteadOfRegularMinionAndAction`，`abilityTags: special/ongoing`。 | `abilities/titans.ts`：special 进场；`abilityHelpers.ts` 提供 forest/or helper；`domain/index.ts` 处理 clash move。 | `titan_fairies_spirit_of_the_forest_clash_move`；真实入口补了 `Titania + Spirit` 的 OR 分支连续 prompt 链。 | `commandsValidation.test.ts`、`newFactionAbilities.test.ts`、`smashup.smoke.test.ts` 已覆盖 summon / or / clash move；另有 [`smashup-feedback-69f385d7-spirit-of-the-forest-puck-local-closeout-2026-05-04.md`](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/evidence/smashup/smashup-feedback-69f385d7-spirit-of-the-forest-puck-local-closeout-2026-05-04.md>) 锁定与 `Puck` 共享的额度语义；[`e2e/smashup-fairies-spirit-of-the-forest.e2e.ts`](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/e2e/smashup-fairies-spirit-of-the-forest.e2e.ts>) 已补 `Titania 在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过`。 | Pass。当前已补到 scoped L3：真实浏览器链证明 `Spirit of the Forest` 在场时，`Titania` 的 OR 效果会先执行已选分支，再给剩余分支与跳过，并在第二分支结清后把 `spiritOfTheForestUsedTurn` 写入当前回合。 |
| `princesses_heirloom` | 附着随从；每张 Heirloom +1；本卡不能被摧毁。 | `data/factions/princesses.ts`：ongoing minion，count 3。 | `ongoing_modifiers.ts`：`princesses_heirloom` power modifier；`princesses.ts` interceptor 阻止 destroy detach。 | 附着行动走通用 minion target；真实链中还经过 `CardSpotlightQueue` 非阻塞提示层。 | `newFactionAbilities.test.ts` 已补 `每张都会给宿主 +1 力量` 与 `只会拦截 destroy 原因的离场`；[`e2e/smashup-princesses-heirloom.e2e.ts`](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/e2e/smashup-princesses-heirloom.e2e.ts>) 已补 `公主-Heirloom-真实入口附着两张后被 Ninja Poison 命中 destroy 链时仍保留在宿主上`；[`actionSpotlightSuppression.test.tsx`](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/src/games/smashup/__tests__/actionSpotlightSuppression.test.tsx>) 已锁定 spotlight 非阻塞合同。 | Pass。当前已补到 scoped L3：真实入口可先后附着两张 `Heirloom` 到同一宿主，`Ninja Poison` 的 `destroy` 链命中后两张 `Heirloom` 仍保留在宿主上，同时 shared spotlight 不再拦截后续操作。 |
| `sharks_week_of_sharks` | 附着基地；若你在这里有随从，回合结束额外抽 1；每回合只用一个 Week of Sharks。 | `data/factions/sharks.ts`：ongoing base。 | `sharks.ts`：`sharksWeekOfSharksTrigger` 用 owner set 限每回合一次，并要求该基地有 owner 控制的随从。 | 自动 turn-end trigger。 | `shayuFactionAbilities.test.ts` 覆盖多张只抽一次；[`smashup-shayu-strict-chain-sample-audit-2026-05-11.md`](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/evidence/smashup/smashup-shayu-strict-chain-sample-audit-2026-05-11.md>) 与 [`smashup-shayu-full-chain-audit-2026-05-12.md`](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/evidence/smashup/smashup-shayu-full-chain-audit-2026-05-12.md>) 已把 once-per-turn 语义锁到 L2；[`e2e/smashup-yuanhou-factions.e2e.ts`](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/e2e/smashup-yuanhou-factions.e2e.ts>) 现已补 `鲨鱼-Week of Sharks-真实回合结束两张实例都满足时也只额外抽一张`。 | Pass。当前已补到 scoped L3：真实结束回合入口下，两张实例同时满足时仍只额外抽 1，再叠加正常结束回合抽 2，并在进入下一玩家回合后无残留 prompt 收口。 |
| `tornados_not_in_kansas` | 摧毁/替换一个基地及打在其上或其随从上的行动；新基地替换，随从保留。 | `data/factions/tornados.ts`：standard action。 | `tornados.ts`：detach base ongoing 与 attached actions 后发 `BASE_REPLACED keepCards:true`。 | 基地目标入口。 | [`smashup-shayu-full-chain-audit-2026-05-12.md`](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/evidence/smashup/smashup-shayu-full-chain-audit-2026-05-12.md>) 已记录 `L3`：真实入口证明基地替换后原随从保留、基地/随从行动被清理，baseDeck 顺序符合预期。 | Pass。当前已有 scoped L3 级真实链路，不应继续按“只核到 reducer”低估。 |
| `mythic_greeks_jason` | 每回合一次，在你打出行动后选择一个基地，使你在该基地的随从 +1 到回合结束。 | `data/factions/mythic_greeks.ts`：ongoing minion。 | `mythic_greeks.ts`：`onActionPlayed` trigger 生成 `mythic_greeks_jason` 基地选择，resolver 只强化所选基地中当前玩家控制的随从，并写入本回合已用 metadata。 | `mythic_greeks_jason` base prompt。 | `shayuFactionAbilities.test.ts` 已新增真实行动入口测试，覆盖同基地敌方不加、其他基地己方不加。 | Fixed。旧草稿误选较短 `favor_of_dionysus` 作为神话希腊最长描述；本轮已补 Jason 全链路。 |
| `mythic_greeks_favor_of_dionysus` | 己方一个随从 +1；额外行动；可将本卡放牌库顶代替弃牌。 | `data/factions/mythic_greeks.ts`。 | `mythic_greeks.ts`：先选己方随从，发 temp power + extra action，再进入 top/skip prompt。 | `mythic_greeks_favor_of_dionysus_minion` -> `mythic_greeks_favor_of_dionysus_top`。 | `shayuFactionAbilities.test.ts` 覆盖。 | Pass。作为旧草稿保留对照，不再作为该派系最长描述代表。 |
| `shapeshifters_gelf` | 天赋：从牌库搜非 G.E.L.F. 且力量≤4 的随从；本卡洗入牌库并将该随从作为额外随从打到这里；之后洗牌。 | `data/factions/shapeshifters.ts`：talent minion。 | `yuanhou.ts`：先发 `CARD_TO_DECK_BOTTOM` 使自身回到牌库，再由 `queueDeckMinionSearch` live 候选选择牌库随从；最终 `deckReordered` 对剩余牌库和自身 uid 一起洗牌，避免固定牌库底。 | `shapeshifters_gelf_search`。 | `yuanhouFactionAbilities.test.ts` 覆盖可选择非第一张合格随从，且 G.E.L.F. 回到牌库、被选随从离开牌库进场。 | Pass。旧草稿漏审该派系最长描述，已追补。 |
| `shapeshifters_transmogrify` | 摧毁你的一个随从；搜牌库等/低力量随从额外打到这里；洗牌。 | `data/factions/shapeshifters.ts`：`playTargetMinionController: self`。 | `yuanhou.ts`：`queueDeckMinionSearch` 带 `baseIndex/maxPower/reason`，先 destroy 后搜索。 | `shapeshifters_transmogrify_search`。 | `yuanhouFactionAbilities.test.ts` 覆盖多候选选择非第一张。 | Pass。 |
| `shapeshifters_bacta_the_future` | 摧毁一个随从；该随从拥有者立即额外打随从。 | `data/factions/shapeshifters.ts`：target any。 | `yuanhou.ts`：destroy + `grantExtraMinion(target.owner)`。 | minion target；immediate extra minion prompt。 | `yuanhouFactionAbilities.test.ts` 覆盖敌方目标与额度归属。 | Fixed。中英文 i18n 曾误写“洗入牌库”，本轮改为“摧毁”。 |
| `shapeshifters_genetic_shift` | 你的所有随从 +1，或你的一个随从 +3。 | `data/factions/shapeshifters.ts`：不强制前置 target，进入模式选择。 | `yuanhou.ts`：direct target、prompt candidates、interaction handler 均复核当前玩家控制的随从；敌方 direct target 返回 no valid targets，伪造 single 目标不会生效。 | `shapeshifters_genetic_shift_choose`。 | `yuanhouFactionAbilities.test.ts` 已覆盖敌方不出现在 single 候选、伪造敌方 single option 不加力。 | Fixed。此前 single 分支允许敌方随从 +3，测试真值也错；本轮补齐 handler 防线。 |
| `cyborg_apes_flying_monkey` | 附着己方随从；计分后可移动该随从到另一基地代替弃牌；然后摧毁本行动。 | `data/factions/cyborg_apes.ts`：ongoing minion，target self。 | `yuanhou.ts`：afterScoring trigger 保留 `minionUid/actionUid/fromBaseIndex/toBaseIndex`，move 后 detach 本行动。 | `cyborg_apes_flying_monkey_move`。 | `yuanhouFactionAbilities.test.ts` 已覆盖目的地选择与伪造拒绝；[`e2e/smashup-yuanhou-factions.e2e.ts`](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/e2e/smashup-yuanhou-factions.e2e.ts>) 已补 `真实计分后可移动宿主到另一基地并摧毁本行动` 与 `真实计分后跳过移动时应按正常计分清场进入弃牌堆`。 | Pass。当前已补到 scoped L3：真实计分入口下 move/skip 双分支都可复查。 |
| `super_spies_moon_zero_three` | 无其他玩家随从的基地上代替通常随从打出；每回合第一次检索/查看/展示牌库加 1；天赋查看任一牌库顶并放顶/底。 | `data/titans.ts`：`summonMode: insteadOfRegularMinion`，special/ongoing/talent。 | `titans.ts`：special validator、`onDeckInspected` 每回合一次计数、talent 两段选择并可 bottom。`reduce.ts` 记录每回合触发。 | Titan rail special 与 `titan_super_spies_moon_zero_three_choose_player -> ..._resolve`。 | `smashup.smoke.test.ts` 覆盖基础 play / counter / talent；[`smashup-in-progress-effect-atom-audit-2026-05-15.md`](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/evidence/smashup/smashup-in-progress-effect-atom-audit-2026-05-15.md>) 已补 scoped L3：真实 special 从 rail 打到合法基地、armed cancel、与 `Time Box` 同时可用时的 rail 切换竞争，以及真实 talent-self / talent-other / `Spy` / `For My Eyes Only` 四条 inspect 计数浏览器链。 | Pass。当前已有 clean L2 / scoped L3，不应继续写成“只有 smoke”。 |
| `super_spies_permit_to_kill` | 每位其他玩家展示顶 2；弃掉展示出的所有随从；其余任意顺序回顶。 | `data/factions/super_spies.ts`。 | `yuanhou.ts`：`revealedMinions` 全部 mill，仅非随从进入 reorder。 | `super_spies_permit_to_kill_order`。 | `yuanhouFactionAbilities.test.ts` 覆盖高力量随从也不会回顶。 | Fixed。中英文 i18n 曾误写“力量 2 或更少”，本轮改为所有展示随从。 |
| `time_travelers_time_box` | 计数到 5 后可移除计数打出；天赋额外打 2 力或更低随从和/或额外行动。 | `data/titans.ts`：explicit，special/talent。 | `titans.ts`：onTurnStart / onCardReturnedToHand 加计数；达到 5 先进入 owner-only `smashup_reaction_choose`，再起 `titan_time_travelers_time_box_play`；special 清零并 play titan；talent 发 low-power extra minion + extra action。 | `smashup_reaction_choose` -> `titan_time_travelers_time_box_play`；talent 分支进入 hand choice + board direct。 | `smashup.smoke.test.ts` 覆盖基础计数/进场/talent；[`e2e/smashup-yuanhou-factions.e2e.ts`](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/e2e/smashup-yuanhou-factions.e2e.ts>) 已补 `真实天赋可在正常额度用尽后额外打低战力随从与额外行动`、`真实第5枚计数进场 prompt 可把 Titan 打到基地并清零计数`；[`e2e/smashup-yuanhou-jumper-multiplayer.e2e.ts`](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/e2e/smashup-yuanhou-jumper-multiplayer.e2e.ts>) 已补 `真实多客户端下回合开始应只给 owner 页面第5枚计数反应与进场选择` 与 `恢复可见触发 manual-resync 后 owner-only reaction 与进场 prompt 仍只归 owner 页面`。 | Pass。当前已补到 scoped L3：真实 talent 棋盘直选、真实第 5 枚计数进场并清零、owner-only 多客户端与 manual-resync 双阶段归属；不再只靠 smoke 外推。 |
| `time_travelers_time_is_fleeting` | after scoring：基地弃牌堆有基地时，选择其中一个代替抽新基地。 | `data/factions/time_travelers.ts`：special afterScoring。 | `yuanhou.ts`：单候选自动置顶，多候选进入 `time_travelers_time_is_fleeting_choose`；`reduce.ts` 从 baseDiscard 移除并置顶；多客户端链路先经赢家页 owner-only `smashup_reaction_choose` 再进入基地弃牌堆选择。 | `smashup_reaction_choose` -> `time_travelers_time_is_fleeting_choose`。 | `yuanhouFactionAbilities.test.ts` 已覆盖单候选自动分支；[`e2e/smashup-yuanhou-factions.e2e.ts`](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/e2e/smashup-yuanhou-factions.e2e.ts>) 已补 `时间旅行者-The Nexus-真实计分后赢家可选择基地弃牌堆基地代替抽新基地` 与让过分支；[`e2e/smashup-yuanhou-jumper-multiplayer.e2e.ts`](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/e2e/smashup-yuanhou-jumper-multiplayer.e2e.ts>) 已补 `真实多客户端下赢家不是当前回合玩家时应只给赢家页面弃牌堆基地选择权` 与 `恢复可见触发 manual-resync 后赢家页弃牌堆基地选择权仍只归赢家页面`。 | Pass。当前已补到 scoped L3：单候选自动分支、The Nexus 真实计分选择/让过、赢家页 owner-only 多客户端与 manual-resync 归属；不再只靠 unit 外推。 |

## 本轮发现与修复

- `shapeshifters_bacta_the_future`：描述层仍写“洗入牌库”，与图片和实现不一致。已修正 zh-CN / en effectText。
- `super_spies_permit_to_kill`：描述层仍写“力量 2 或更少”，与图片和实现不一致。已修正 zh-CN / en effectText。
- `shapeshifters_genetic_shift`：single 分支实现允许敌方随从 +3，测试也按错误真值断言；追审时又发现 handler 只信 prompt 候选，没有二次归属复核。已修正实现、测试和 zh-CN / en effectText。
- `mythic_greeks_jason` / `shapeshifters_gelf`：旧草稿没有按实际长度选择这两个派系最长描述对象。已补入全链路矩阵，并补 `Jason` 真实行动触发回归。
- `princesses_heirloom` 真实入口追审时发现两处 shared 问题：
  - `GameTestContext.playCard(...)` 会对“需要随从目标”的牌误做二次手牌点击，导致已选中的 `ongoing-minion` 目标链被取消；
  - `CardSpotlightQueue` 的整屏遮罩会拦截后续手牌点击，看起来像非阻塞提示，实际却是隐藏门禁。
  这轮已分别修正 helper 和 shared spotlight contract，并补回归锁定。

## 验证记录

- `npm run test -- src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts src/games/smashup/__tests__/shayuFactionAbilities.test.ts`：2 files / 79 tests passed。
- `npm run test -- src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/commandsValidation.test.ts src/games/smashup/__tests__/smashup.smoke.test.ts`：3 files / 379 passed / 1 skipped。
- `npx eslint src/games/smashup/abilities/yuanhou.ts src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts src/games/smashup/__tests__/shayuFactionAbilities.test.ts`：通过。
- `npm run i18n:check`：`no missing keys detected`。
- `npm run typecheck`：通过。
- `git diff --check`：通过，仅有 LF/CRLF 工作区提示。
- `PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true PW_ISOLATE_PORTS=true PW_RUNTIME_SCOPE=week-of-sharks-legacy PW_WORKERS=1 PW_HEADED=false PW_USE_DEV_SERVERS=false PW_HAS_EXPLICIT_TARGET=true PW_TEST_TARGET=e2e/smashup-yuanhou-factions.e2e.ts PW_TEST_MATCH=e2e/smashup-yuanhou-factions.e2e.ts node node_modules/playwright/cli.js test e2e/smashup-yuanhou-factions.e2e.ts --grep "鲨鱼-Week of Sharks-真实回合结束两张实例都满足时也只额外抽一张"`：`1 passed`。
- `npm run test -- src/games/smashup/__tests__/actionSpotlightSuppression.test.tsx`：`4 passed`。
- `PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true PW_ISOLATE_PORTS=true PW_RUNTIME_SCOPE=heirloom-final PW_WORKERS=1 PW_HEADED=false PW_USE_DEV_SERVERS=false PW_HAS_EXPLICIT_TARGET=true PW_TEST_TARGET=e2e/smashup-princesses-heirloom.e2e.ts PW_TEST_MATCH=e2e/smashup-princesses-heirloom.e2e.ts node node_modules/playwright/cli.js test e2e/smashup-princesses-heirloom.e2e.ts --grep "Heirloom-真实入口"`：`1 passed`。
- `PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true PW_ISOLATE_PORTS=true PW_RUNTIME_SCOPE=spirit-focused PW_WORKERS=1 PW_HEADED=false PW_USE_DEV_SERVERS=false PW_HAS_EXPLICIT_TARGET=true PW_TEST_TARGET=e2e/smashup-fairies-spirit-of-the-forest.e2e.ts PW_TEST_MATCH=e2e/smashup-fairies-spirit-of-the-forest.e2e.ts node node_modules/playwright/cli.js test e2e/smashup-fairies-spirit-of-the-forest.e2e.ts --grep "Titania 在丛林之灵在场时会先执行已选分支"`：`1 passed`。
- 关键截图：
  - [sharks-week-of-sharks-before-end-turn.png](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/test-results/evidence-screenshots/_shared/smashup-yuanhou-factions.e2e/鲨鱼-Week-of-Sharks-真实回合结束两张实例都满足时也只额外抽一张/sharks-week-of-sharks-before-end-turn.png>)
  - [sharks-week-of-sharks-end-turn-drew-once.png](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/test-results/evidence-screenshots/_shared/smashup-yuanhou-factions.e2e/鲨鱼-Week-of-Sharks-真实回合结束两张实例都满足时也只额外抽一张/sharks-week-of-sharks-end-turn-drew-once.png>)
  - [princesses-heirloom-two-attached-before-poison.png](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/test-results/evidence-screenshots/_shared/smashup-princesses-heirloom.e2e/公主-Heirloom-真实入口附着两张后被-Ninja-Poison-命中-destroy-链时仍保留在宿主上/princesses-heirloom-two-attached-before-poison.png>)
  - [princesses-heirloom-survived-ninja-poison-destroy-attempt.png](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/test-results/evidence-screenshots/_shared/smashup-princesses-heirloom.e2e/公主-Heirloom-真实入口附着两张后被-Ninja-Poison-命中-destroy-链时仍保留在宿主上/princesses-heirloom-survived-ninja-poison-destroy-attempt.png>)
  - [fairies-spirit-branch-prompt-visible.png](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/test-results/evidence-screenshots/_shared/smashup-fairies-spirit-of-the-forest.e2e/Fairies-OR-分支：Titania-在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过/fairies-spirit-branch-prompt-visible.png>)
  - [fairies-spirit-return-target-visible.png](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/test-results/evidence-screenshots/_shared/smashup-fairies-spirit-of-the-forest.e2e/Fairies-OR-分支：Titania-在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过/fairies-spirit-return-target-visible.png>)
  - [fairies-spirit-follow-up-prompt-visible.png](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/test-results/evidence-screenshots/_shared/smashup-fairies-spirit-of-the-forest.e2e/Fairies-OR-分支：Titania-在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过/fairies-spirit-follow-up-prompt-visible.png>)
  - [fairies-spirit-sequential-resolved.png](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/test-results/evidence-screenshots/_shared/smashup-fairies-spirit-of-the-forest.e2e/Fairies-OR-分支：Titania-在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过/fairies-spirit-sequential-resolved.png>)
  - 实图观察：第一张里可见两座基地上各有一张己方随从、两张 `Week of Sharks` 都已在场，右下仍是 `结束回合` 可操作态；第二张里回合标记已切到下一位玩家，中央没有任何额外 draw/prompt overlay，说明真实入口按自动触发链直接收口。由于当前资源链未渲染出完整卡面，精确抽牌张数以同条 E2E 的权威状态断言 `hand=3 / deck=2 / interaction.current=null` 为准，这轮截图主要证明“真实结束回合链无多余交互、收口正常”。
  - `Heirloom` 两张截图观察：第一张可直接看到同一宿主上已有两张 `Heirloom` 附着，右下仍保持正常可继续操作态，不再被 spotlight 全屏门禁卡住；第二张里 `Ninja Poison` 也已附着到同一宿主，而两张 `Heirloom` 仍留在宿主上，没有被 `destroy` 链错误移除。
  - `Spirit of the Forest` 四张截图观察：第一张里 `Titania` 首段 prompt 同时提供“额外打出一个随从”和“将一个随从移回其拥有者手牌”；第二张里第一分支切到了真实棋盘直选而不是 overlay 按钮墙；第三张里在第一分支结清后，只剩“额外打出一个随从/跳过”两项，原回手分支已退出；第四张里 `Titania` 已留在基地、`enemy-first-mate` 回到其拥有者手牌，说明 OR 连续链真实收口。

## 2026-05-19 owner prompt 结束回合簇 shared UX 复审

- 新 dirty reason：
  - 用户指出 `fairies-spirit-branch-prompt-visible.png` 虽然候选只有 2 个，但右下仍保留 `结束回合 + 徽章 + 显隐切换`，会把一条真实 prompt 链拍成“两组入口同屏”。
  - 这不是 `Spirit of the Forest` 单卡语义错，而是 shared `Board` 结束回合簇在 owner prompt 期间没有退场。
- 已修正：
  - [src/games/smashup/Board.tsx](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/src/games/smashup/Board.tsx>) 现改为：`activePromptSurface !== 'none'` 时，当前玩家右下结束回合簇不再渲染；prompt 解完后再恢复。
  - [e2e/smashup-fairies-spirit-of-the-forest.e2e.ts](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/e2e/smashup-fairies-spirit-of-the-forest.e2e.ts>) 已把这条 shared UX 收口到真实链：prompt 激活时三项 `su-end-turn-action-button / su-end-turn-hints / su-end-turn-visibility-toggle` 都应为 `0`；最终收口后 `su-end-turn-action-button` 重新可见。
  - [docs/ai-rules/ui-ux.md](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/docs/ai-rules/ui-ux.md>) / [docs/ai-rules/testing-audit.md](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/docs/ai-rules/testing-audit.md>) 已补 owner prompt 期间不得暴露结束回合簇的门禁。
- 验证：
  - `PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true PW_ISOLATE_PORTS=true PW_RUNTIME_SCOPE=spirit-owned-prompt-focus PW_WORKERS=1 PW_HEADED=false PW_USE_DEV_SERVERS=false PW_HAS_EXPLICIT_TARGET=true PW_TEST_TARGET=e2e/smashup-fairies-spirit-of-the-forest.e2e.ts PW_TEST_MATCH=e2e/smashup-fairies-spirit-of-the-forest.e2e.ts node node_modules/playwright/cli.js test e2e/smashup-fairies-spirit-of-the-forest.e2e.ts --grep "Titania 在丛林之灵在场时会先执行已选分支"`：`1 passed`。
- 真实截图复核：
  - [fairies-spirit-branch-prompt-visible.png](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/test-results/evidence-screenshots/_shared/smashup-fairies-spirit-of-the-forest.e2e/Fairies-OR-分支：Titania-在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过/fairies-spirit-branch-prompt-visible.png>)：中央只剩标题 + 两个候选按钮，右下结束回合簇已退出，当前截图不再像“同时给了 prompt 和结束回合两组主入口”。
  - [fairies-spirit-return-target-visible.png](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/test-results/evidence-screenshots/_shared/smashup-fairies-spirit-of-the-forest.e2e/Fairies-OR-分支：Titania-在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过/fairies-spirit-return-target-visible.png>)：这一步已经退出 overlay，转入棋盘直选；页面只剩顶部指令和真实目标随从，右下结束回合簇同样未出现，说明 suppression 不是只在 overlay 分支成立。
  - [yuanhou-bacta-shell-protected-host-extra-minion-prompt.png](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/test-results/evidence-screenshots/_shared/smashup-yuanhou-factions.e2e/变形者-Bacta-the-Future-真实入口目标受Shell-Game保护时仍给其拥有者立即额外随从机会/yuanhou-bacta-shell-protected-host-extra-minion-prompt.png>)：进入 hand 直承的 immediate extra minion prompt 后，中央是候选手牌 + 跳过入口，右下没有结束回合簇，说明 suppression 也覆盖 hand surface。
  - [fairies-spirit-sequential-resolved.png](</D:/gongzuo/webgame/BoardGame/.worktrees/smashup-yuanhou-factions/test-results/evidence-screenshots/_shared/smashup-fairies-spirit-of-the-forest.e2e/Fairies-OR-分支：Titania-在丛林之灵在场时会先执行已选分支，再给剩余分支与跳过/fairies-spirit-sequential-resolved.png>)：OR 链收口后，右下结束回合与额度徽章恢复可见，说明本轮共享减法只作用于 prompt 激活窗口。

## 当前边界

本轮是“所有实施中派系中，每个派系最长描述对象”的全链路审计，并追补了抽取过程中暴露的问题对象；它不替代所有实施中派系的逐卡全量重审。已发现的问题均已修复；未抽中的短描述对象仍以各自既有专项 evidence 为准。

当前这份长描述矩阵里，证据强度已经明确分层：

- 已补到 `scoped L3` 或可反查真实入口的对象：
  - `tornados_not_in_kansas`
  - `cyborg_apes_flying_monkey`
  - `super_spies_moon_zero_three`
  - `time_travelers_time_box`
  - `time_travelers_time_is_fleeting`
- 当前已无 `L2 only` 残留；后续若继续推进，不应再把“实施中派系最长描述对象”这条矩阵说成未闭合。

因此，下一轮若继续推进，应切到新的 `dirty reason` 或 shared seam，而不是回头重复扩写已经闭合的 `fairies / princesses / sharks / time_travelers / super_spies / cyborg_apes / tornados` 长描述链。
