# Smash Up shayu 三派系统一审计

## 结论等级（2026-05-10 修订）

- **本轮新增范围**：`sharks`、`tornados`、`mythic_greeks` 三个派系的素材/R2、静态接入、玩法实现、代表性行为测试、真实入口 E2E 与逐卡/逐基地审计已留档。
- **结论等级**：当前可写为 **“逐卡结构审计通过 + 核心玩法行为已验证 + 新机制真实入口 E2E 已验证”**。本轮整文件 E2E 已从 5 条扩展到 12 条，覆盖消灭、移动、多选、逐目标、attach/detach、基地替换、计分前/后 special、基地移动触发、行动后连锁触发等新增机制。
- **不能偷换的范围**：这不是“每张卡都各有一条 E2E”；低风险同类能力按行为测试/结构审计覆盖，高风险多选、移动、消灭、弃牌洗回、额外行动、计分窗口、attach/detach、基地替换与 once/turn 基地触发均已补真实入口 E2E。
- **残余范围**：仍有少量低风险同类卡未逐卡单独 E2E（如简单额外行动、简单临时 buff、简单 self move），但不再把 `Gone with the Wind`、`Ripped Off`、`Not in Kansas`、`Tornado Alley`、`Dust Devil`、计分前 special 或 `Argonaut` 这类新机制列为未验证专项。

## 2026-05-11 入口语义重审回写

- **旧结论失效项**：`sharks_air_jaws` 原 `L1/L2` 结论曾漏掉“描述动作链第一入口”核对。卡牌文案是“将你的一个仆从移动到另一个基地，然后消灭那里 3- 仆从”，第一用户选择对象应为己方随从；旧数据曾写成 `playNeedsBase: true`，导致 UI 第一入口变成选基地。
- **失效原因**：旧审计只证明 ability 注册、移动/消灭组合 prompt 与部分行为链，没有把 `effectText -> playNeedsBase/playNeedsMinion -> Board 第一入口 -> PLAY_ACTION payload -> handler 消费字段` 串成同一审计门禁。
- **修复证据**：
  - `src/games/smashup/data/factions/sharks.ts`：`sharks_air_jaws` 改为 `playNeedsMinion: true`。
  - `src/games/smashup/abilities/sharks.ts`：入口改为先消费 `targetMinionUid` / 随从 prompt，再选择“另一个基地”，随后执行移动与低战力消灭。
  - `src/games/smashup/__tests__/shayuFactionAbilities.test.ts`：补“飞鲨通过真实行动入口先选择己方随从，再选择另一个基地并消灭低力量随从”。
  - `src/games/smashup/__tests__/abilityBehaviorAudit.test.ts`：新增泛化 standard action 入口审计，不写 `sharks_air_jaws` 单卡特例。
- **验证记录（2026-05-11）**：
  - `npx vitest run src/games/smashup/__tests__/shayuFactionAbilities.test.ts -t "飞鲨"` → 1 passed。
  - `npx vitest run src/games/smashup/__tests__/shayuFactionAbilities.test.ts` → 11 passed。
  - `npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts -t "standard 行动卡的直接入口字段"` → 1 passed。
  - `npx eslint src/games/smashup/__tests__/abilityBehaviorAudit.test.ts src/games/smashup/__tests__/shayuFactionAbilities.test.ts src/games/smashup/abilities/sharks.ts src/games/smashup/data/factions/sharks.ts` → 0 errors。
- **当前结论**：`sharks_air_jaws` 从“旧 L1/L2 结论失效”恢复为“入口语义结构审计通过 + 领域行为回归通过”。本次没有新增浏览器 E2E 截图，因此不得把本条升级成新的 L3 E2E 证据。

## 审计范围

- 新增派系：`sharks`、`tornados`、`mythic_greeks`
- 新增卡牌：Sharks 12 张、Tornados 12 张、Mythic Greeks 15 张，共 39 张。
- 新增基地：`base_shark_reef`、`base_the_deep`、`base_trailer_park`、`base_tornado_alley`、`base_oracle_at_delphi`、`base_wooden_horse`，共 6 张。
- 新增素材：本地源图/压缩图走 R2/CDN，不默认入 git；代码侧提交 manifest/atlas/locale/data/evidence。
- 新增/修改实现：三派系 data、abilities、atlas/manifest、locale、E2E、行为测试、completion guard 与项目新增派系 skill。

## 素材与 R2/CDN 证据

- Intake 合同：`evidence/smashup/smashup-shayu-faction-intake-contract.md`
- Intake 验证：`evidence/smashup/smashup-shayu-faction-intake-verification.md`
- Manifest：`public/assets/i18n/zh-CN/smashup/assets-manifest.json`
- Atlas：`CARDS9` = `cards/shayu.png` 4096x3598，5x8；`BASE7` = `base/shayu.png` 4096x3886，4x3。
- 2026-05-10 远端 HEAD 回查：
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/base/compressed/shayu.webp` → `200`，`Content-Length=416934`
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/shayu.webp` → `200`，`Content-Length=899018`
- 审计结论：`.gitignore` 命中卡图/基地图是符合“运行时素材走 R2/CDN，git 提交代码/manifest/evidence”的预期，不是缺陷。

## 旧派系参考与复用清单

| 机制 | 旧实现参考 | 本轮裁定 |
| --- | --- | --- |
| 低力量消灭 / 消灭后抽牌 | `dinosaurs.ts`、`cthulhu.ts`、`frankenstein.ts` | 复用 `buildValidatedDestroyEvents`、`buildStandardDrawEvents`，Sharks 只补 prompt 组合。 |
| 消灭后触发 / 额外随从 | `frankenstein.ts`、`cthulhu.ts`、`samurai.ts`、`wizards.ts` | 用 `registerTrigger`、`perInstance`、`triggerBase` 与额外打出事件，不写 UI 特判。 |
| 移动 / push-pull / scoring special | `pirates.ts`、`giant_ants.ts`、`domain/baseAbilities.ts` | 复用 `buildValidatedMoveEvents`；Tornados 的方向规则单独建 prompt，避免“统一目标基地”假实现。 |
| Ongoing 转移 / base replace | `bear_cavalry.ts`、`domain/reduce.ts` 的 attach/detach 与 `BASE_REPLACED keepCards` | `Ripped Off` 使用 detach+attach 事件；`Not in Kansas` 使用 `BASE_REPLACED keepCards`。 |
| 额外行动 / 额外仆从 / 弃牌与牌库操作 | `wizards.ts`、`zombies.ts`、deck reveal helper | Mythic Greeks 复用 extra action/minion、discard recovery、deck reveal/pick。 |
| action played trigger | `ongoingEffects.ts` 触发体系 | Odysseus/Jason/Heracles/Spartan 注册 `onActionPlayed`；Argonaut 复用触发队列代表链。 |
| 基地能力 | `domain/baseAbilities.ts` | 6 个新基地均走 base ability 注册/扩展入口。 |

## 逐卡 / 逐基地审计矩阵

证据层级：L1=静态/注册/结构；L2=行为测试/领域状态断言；L3=真实入口 E2E + 截图；L4=真实 scoring/reaction/session 专项。

| 对象 | 真相源文本（zh-CN locale/卡图合同） | 实现位置 | 旧派系参考 | 覆盖层级 | 风险/结论 |
| --- | --- | --- | --- | --- | --- |
| `sharks_megalodon` | 可消灭这里 4- 仆从；计分前 special 消灭这里 3- 仆从。 | `abilities/sharks.ts` `sharksMegalodon`、`sharksMegalodonBeforeScoring` | destroy threshold、beforeScoring special | L2 | 行为测试覆盖 destroy 链；special 为结构/触发审计，未单独 E2E。 |
| `sharks_great_white` | 天赋：移动自身到另一基地并消灭那里 2- 仆从。 | `abilities/sharks.ts` `sharksGreatWhite` | move + destroy 链 | L1/L2 | 复用移动后销毁 prompt；未单独 E2E。 |
| `sharks_hammerhead` | 这里有仆从被消灭后自身 +1 指示物。 | `abilities/sharks.ts` `sharksDestroyedCounterTrigger` | onMinionDestroyed trigger | L2/L3 | `Torn Apart` 行为与 E2E 证明消灭后指示物链路未断。 |
| `sharks_mako` | 你消灭任意基地仆从后，可作为额外仆从打到那里。 | `abilities/sharks.ts` `sharksMakoTrigger` | extra minion / destroy trigger | L1 | 已注册 `perInstance + triggerBase`；未单独 E2E。 |
| `sharks_blood_in_the_water` | 打到基地；这里有仆从被消灭后，可额外打出 3- 仆从到这里。 | `abilities/sharks.ts` `sharksBloodInTheWaterTrigger` | base ongoing trigger | L1/L2 | 行为层覆盖同类 destroy trigger；未单独 E2E。 |
| `sharks_week_of_sharks` | 打到基地；若你这里有仆从，回合结束额外抽 1；每回合只用一个。 | `abilities/sharks.ts` `sharksWeekOfSharksTrigger` | endTurn draw | L1 | 静态/注册通过；once/turn 行为未专项。 |
| `sharks_torn_apart` | 消灭一个 3- 仆从并抽 1。 | `abilities/sharks.ts` `sharksTornApart` | destroy + draw | L2/L3 | 行为测试与 E2E 都覆盖真实手牌入口。 |
| `sharks_chum` | 打到仆从；任意仆从被消灭后此仆从 +1。 | `abilities/sharks.ts` `sharksDestroyedCounterTrigger` | attached ongoing trigger | L1/L2 | 与 Hammerhead 共享触发实现；未单独 E2E。 |
| `sharks_dangerous_waters` | 打到基地；天赋使这里一个仆从 -2 到回合结束。 | `abilities/sharks.ts` `sharksDangerousWaters` | temporary modifier | L1 | 静态/注册通过；未专项行为测试。 |
| `sharks_feeding_frenzy` | 选择基地，消灭那里任意数量 2- 仆从。 | `abilities/sharks.ts` `sharksFeedingFrenzy`、`sharksMultiDestroyPromptProgram` | multi destroy prompt | L2/L3 | 行为测试与 E2E 覆盖多选消灭，已纠正“自动全灭”风险。 |
| `sharks_air_jaws` | 移动你的一个仆从到另一基地，然后消灭那里 3- 仆从。 | `abilities/sharks.ts` `sharksAirJaws` | move then destroy | L1/L2 | 2026-05-11 已重审入口语义：旧 `playNeedsBase` 结论失效，已改为 `playNeedsMinion`；行为测试证明先选己方随从、再选另一基地并消灭低战力目标。未新增单独 E2E。 |
| `sharks_freakin_laser_beam` | 选你的仆从，消灭同基地战力不高于该仆从的仆从。 | `abilities/sharks.ts` `sharksFreakinLaserBeam` | threshold destroy by source power | L1 | 静态/注册通过；未专项行为测试。 |
| `base_shark_reef` | 摧毁这里仆从的玩家，可给自己任意仆从 +1。 | `abilities/sharks.ts` `baseSharkReef` | destroyerId base ability | L1/L2 | 已修正用 `destroyerId`，不是被消灭者 owner；未单独 E2E。 |
| `base_the_deep` | 打出 4+ 仆从到这里后，可消灭这里更低战力仆从。 | `abilities/sharks.ts` `baseTheDeep` | onMinionPlayed base ability | L1/L2 | 已修正 4+ 阈值并改玩家选择；E2E 场景中基地可见。 |
| `tornados_monster_tornado` | 天赋：4- 仆从从这里移出，或从别处移入这里。 | `abilities/tornados.ts` `tornadosMonsterTornado` | push-pull move | L2 | 行为测试覆盖外部低力量随从移入。 |
| `tornados_cyclone` | 天赋：将本仆从移至另一个基地。 | `abilities/tornados.ts` `tornadosCyclone` | self move talent | L1 | 简单移动注册通过；未专项行为/E2E。 |
| `tornados_twister` | 打出时可移动 3- 仆从：这里移出或别处移入这里。 | `abilities/tornados.ts` `tornadosTwister` | onPlay push-pull | L2/L3 | Whirlwinds E2E 场景可见 Twister；方向逻辑由行为测试覆盖。 |
| `tornados_dust_devil` | 计分前 special：可移动本仆从到计分基地。 | `abilities/tornados.ts` `tornadosDustDevilBeforeScoring` | beforeScoring may prompt | L3/L4 | E2E 证明 beforeScoring prompt 真实出现，选择移动后 `Dust Devil` 进入计分基地；后续仍可继续响应窗口。 |
| `tornados_trade_winds` | 选择两个 3- 仆从，互换所在基地。 | `abilities/tornados.ts` `tornadosTradeWinds` | swap/move two targets | L1 | 静态/注册通过；未专项行为测试。 |
| `tornados_carried_away` | 将一个仆从移动到另一基地。 | `abilities/tornados.ts` `tornadosCarriedAway` | single target move | L2/L3 | 行为测试与 E2E 覆盖真实手牌入口与移动结果。 |
| `tornados_whirlwinds` | 任意数量你的仆从移到其他基地。 | `abilities/tornados.ts` `tornadosWhirlwinds`、`whirlwindsDestinationPromptProgram` | multi move + per-target destination | L2/L3 | 行为测试与 E2E 覆盖每个被选随从分别选目标基地。 |
| `tornados_gone_with_the_wind` | 计分后 special：你的一个仆从从该基地移走，替代弃牌。 | `abilities/tornados.ts` `tornadosGoneWithTheWind` | afterScoring special / deferred events | L3/L4 | E2E 证明 afterScoring 真实窗口打出，随从移离计分基地；清场后该随从仍在安全基地且不进弃牌。 |
| `tornados_ripped_off` | 转移打在基地/仆从上的行动到另一个基地/仆从。 | `abilities/tornados.ts` `tornadosRippedOff` | attach/detach ongoing transfer | L3 | E2E 同时覆盖基地持续行动转移与随从附着行动转移；断言源宿主移除、目标宿主附着。 |
| `tornados_picked_up` | 计分前 special：将该基地一个仆从移到另一基地。 | `abilities/tornados.ts` `tornadosPickedUp` | beforeScoring special move | L3/L4 | E2E 从 Me First 窗口真实打出并把刚移入计分基地的随从再移出。 |
| `tornados_not_in_kansas` | 摧毁基地和附着行动；用牌库顶基地替换，原仆从保留。 | `abilities/tornados.ts` `tornadosNotInKansas` | base replace keepCards | L3 | E2E 证明基地替换后原随从保留、基地/随从行动被清理，baseDeck 顺序符合预期。 |
| `tornados_over_the_rainbow` | 计分前 special：把你另一基地仆从移到计分基地。 | `abilities/tornados.ts` `tornadosOverTheRainbow` | beforeScoring move-in special | L3/L4 | E2E 从 Me First 窗口真实打出，随从从非计分基地移入计分基地。 |
| `base_trailer_park` | 仆从移动到这里后，其上 +1 指示物。 | `abilities/tornados.ts` `baseTrailerPark` | onMinionMoved base ability | L1/L2 | 共享 move hook；Whirlwinds/Carried Away 行为链覆盖移动，指示物未单独 E2E。 |
| `base_tornado_alley` | 每回合第一次仆从移到这里后，可把另一个仆从移到这里。 | `abilities/tornados.ts` `baseTornadoAlley` | once/turn base move hook | L3 | 旧结论只证明“同回合首次触发 + 第二次不重复”，未覆盖 once 状态跨回合清理。2026-06-01 已补 `tornado-alley-base.test.ts`，证明上一位玩家回合残留记录不会阻止新回合首次移入触发。 |
| `mythic_greeks_odysseus` | 你打出行动后，在你的一个仆从上放 +1 指示物。 | `abilities/mythic_greeks.ts` `odysseusActionTrigger` | onActionPlayed trigger | L2 | Argonaut 行为测试覆盖代表触发。 |
| `mythic_greeks_argonaut` | 触发所有因你打出行动而触发的能力；可替代行动打出。 | `abilities/mythic_greeks.ts` `argonautOnPlay` | action trigger replay / special play | L2/L3 | 行为测试与 E2E 覆盖 Mythic Greeks 内 Odysseus/Heracles/Spartan action-trigger 代表链；跨派系泛化由共享注册表审计兜底。 |
| `mythic_greeks_jason` | 每回合一次，打出行动后选基地，你在那里的仆从 +1 到回合结束。 | `abilities/mythic_greeks.ts` `jasonActionTrigger` | once/turn action trigger | L2 / scoped L3 | 行为链复用 trigger；Argonaut 真实入口已补 Jason base prompt 与 chosen-base buff E2E，不再是“未单独 E2E”。 |
| `mythic_greeks_heracles` | 任意玩家打出行动后，本仆从 +1 到回合结束。 | `abilities/mythic_greeks.ts` `heraclesActionTrigger` | action trigger temp buff | L2 | Argonaut 行为测试覆盖代表触发。 |
| `mythic_greeks_spartan` | 每回合一次，打出行动后本仆从 +1 指示物。 | `abilities/mythic_greeks.ts` `spartanActionTrigger` | once/turn counter trigger | L2/L3 | Apollo E2E 里 Spartan 出现在手牌，行为测试覆盖 trigger。 |
| `mythic_greeks_favor_of_hades` | 从弃牌堆将一张行动回手。 | `abilities/mythic_greeks.ts` `favorOfHades` | discard recovery | L1 | 结构与 helper 路径通过；未专项行为测试。 |
| `mythic_greeks_favor_of_ares` | 你的一个仆从 +3 到回合结束。 | `abilities/mythic_greeks.ts` `favorOfAres` | temporary buff | L1 | 简单 buff 路径；未专项行为测试。 |
| `mythic_greeks_favor_of_aphrodite` | 打出一名额外仆从。 | `abilities/mythic_greeks.ts` `favorOfAphrodite` | extra minion | L1 | 复用额外仆从事件；未专项 E2E。 |
| `mythic_greeks_favor_of_dionysus` | 仆从 +1；额外行动；可放回牌库顶替代弃牌。 | `abilities/mythic_greeks.ts` `favorOfDionysus` | temp buff + extra action + top deck prompt | L2 | 行为测试覆盖可选放顶；E2E 未纳入，见风险。 |
| `mythic_greeks_favor_of_hera` | 至多两个仆从各 +1 指示物。 | `abilities/mythic_greeks.ts` `favorOfHera` | multi target counters | L2/L3 | 2026-06-04 已按卡面 `temp/smashup-hera-card-crop-20260604-r5c8/slot-33.webp` 回写旧“己方”误判；行为测试与 E2E 已补可选对手随从。 |
| `mythic_greeks_favor_of_athena` | 展示牌库顶 5，取 1 张行动，其余任意顺序回牌库顶。 | `abilities/mythic_greeks.ts` `favorOfAthena` | reveal/pick deck helper | L1 | 复用 revealAndPick；未专项行为测试。 |
| `mythic_greeks_favor_of_apollo` | 抽 1 并额外行动。 | `abilities/mythic_greeks.ts` `favorOfApollo` | draw + extra action | L2/L3 | 行为测试与 E2E 覆盖 `actionLimit=2`。 |
| `mythic_greeks_favor_of_hermes` | 打出两个额外行动。 | `abilities/mythic_greeks.ts` `favorOfHermes` | extra action x2 | L1 | 简单额外行动路径；未专项行为测试。 |
| `mythic_greeks_favor_of_poseidon` | 弃牌堆至多 3 张洗回牌库。 | `abilities/mythic_greeks.ts` `favorOfPoseidon` | discard-to-deck multi select | L2/L3 | 行为测试与 E2E 覆盖弃牌多选洗回。 |
| `mythic_greeks_favor_of_zeus` | 一个基地破坏点 -5 到回合结束。 | `abilities/mythic_greeks.ts` `favorOfZeus` | temporary base modifier | L2 | 2026-05-12 抽样发现并修复二次 base prompt；已补行为测试证明直接消费第一入口并降低目标基地爆破点。 |
| `base_oracle_at_delphi` | 打出仆从到这里后展示牌库顶；行动入手，否则放回顶。 | `abilities/mythic_greeks.ts` `oracleAtDelphi` | deck peek/reveal | L1 | 结构注册通过；未专项行为测试。 |
| `base_wooden_horse` | 任意玩家打出行动后，可使这里一个仆从 +2 到回合结束。 | `abilities/mythic_greeks.ts` `woodenHorse` | onActionPlayed base ability | L1/L2 | 已改可选一个目标而非全体；未单独 E2E。 |

## E2E 新增交互覆盖矩阵

| E2E 用例 | 覆盖的新交互 | 截图路径 | 肉眼观察 / 是否达标 |
| --- | --- | --- | --- |
| 派系选择页能看到三派系与素材卡 | 静态入口与素材可见（不抵扣玩法交互数） | `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\派系选择页能看到-Sharks-Tornados-Mythic-Greeks-与素材卡\shayu-faction-selection-visible.png` | 实际看到鲨鱼/龙卷风/希腊神话派系卡图本体，并在三张卡图上看到黄色黑条“实施中”横幅；入口、素材显示与实施中标识达标，但不抵扣玩法交互。 |
| Sharks 与 Tornados 代表行动 | 1) `Torn Apart` 手动选目标消灭并抽牌；2) `Carried Away` 选随从后选目标基地移动 | `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-与-Tornados-代表行动可从手牌真实打出并完成交互\shayu-sharks-torn-apart-after-destroy.png`；`...\shayu-tornados-carried-away-after-move.png` | 第一张实际看到 `Torn Apart` 已在弃牌区、低力量目标消失；第二张实际看到 `Mako` 已移到 `Tornado Alley`、`Carried Away` 在弃牌区，无待处理交互。达标。 |
| Mythic Greeks Apollo | 3) `Favor of Apollo` 抽牌 + 额外行动 | `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-代表行动可从手牌真实打出并改变权威状态\shayu-mythic-greeks-apollo-after-action.png` | 实际看到 `Favor of Apollo` 已打出，手牌区出现 `Spartan`；测试同时断言额外行动额度。达标。 |
| Sharks Feeding Frenzy + Tornados Whirlwinds | 4) `Feeding Frenzy` 多选消灭；5) `Whirlwinds` 多选后逐目标选择目标基地 | `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-疯狂进食与-Tornados-旋风群覆盖多选和逐目标移动交互\shayu-sharks-feeding-frenzy-after-multi-destroy.png`；`...\shayu-tornados-whirlwinds-after-per-minion-destinations.png` | 第一张实际看到低力量目标被销毁后只剩未选参照；第二张实际看到两个 `Twister` 分别落到不同基地，不是统一移动到同一目标。达标。 |
| Mythic Greeks Hera + Poseidon | 6) `Favor of Hera` 任意随从多选放指示物；7) `Favor of Poseidon` 弃牌多选洗回牌库 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-赫拉与波塞冬覆盖随从多选和弃牌多选交互\shayu-mythic-greeks-hera-after-two-counters.png`；`...\shayu-mythic-greeks-poseidon-after-discard-shuffle.png` | 2026-06-04 回写：旧“己方随从”结论被 `slot-33.webp` 卡面推翻。现已要求 Hera 真实入口能同时选己方与对手随从；第一张截图来自本工作树复跑后的修复验证。 |
| Tornados Ripped Off | 8) 基地持续行动 detach+attach 转移；9) 随从附着行动 detach+attach 转移 | `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-扯走覆盖基地持续行动与随从附着行动的-detach-+-attach-转移\shayu-tornados-ripped-off-base-action-transferred.png`；`...\shayu-tornados-ripped-off-minion-action-transferred.png` | 实际看到持续行动从源基地/源随从离开并附着到新目标；测试断言源宿主数组为空、目标宿主包含对应 action uid。达标。 |
| Tornados Not in Kansas | 10) 基地替换 + 保留随从 + 清理基地/随从行动 | `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-不在堪萨斯替换基地时保留随从并清理基地-随从行动卡\shayu-tornados-not-in-kansas-after-base-replace.png` | 实际看到基地已替换，随从仍在对应基地；测试断言原基地 ongoing 与随从 attached action 被清空，牌库顺序更新。达标。 |
| Tornado Alley | 11) 基地移动触发 may prompt；12) once/turn 第二次移入不重复触发 | `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornado-Alley-基地能力在本回合首次移入时触发，第二次移入不重复触发\shayu-tornado-alley-trigger-open.png`；`...\shayu-tornado-alley-second-move-no-repeat-trigger.png` | 第一张实际看到 Tornado Alley 触发交互；第二张第二次移入后没有重复拉入 prompt，测试断言 `second-trigger-target` 未被再次移动。达标。 |
| Mythic Greeks Argonaut | 13) 真实打出 Argonaut 后触发 action-played 能力队列 | `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Mythic-Greeks-阿尔戈英雄真实入场会触发奥德修斯-赫拉克勒斯-斯巴达人的行动后能力\shayu-mythic-greeks-argonaut-odysseus-prompt.png`；`...\shayu-mythic-greeks-argonaut-jason-prompt.png`；`...\shayu-mythic-greeks-argonaut-after-action-triggers.png` | 实际看到 Odysseus 选择提示、Jason 基地选择提示和后续结算状态；测试断言 Odysseus/Spartan 获得 +1、Heracles 获得临时 +1，并记录 Spartan once/turn metadata，Jason 选中基地的己方随从 +1。达标。 |
| Tornados beforeScoring specials | 14) `Over the Rainbow` 从 Me First 移入计分基地；15) `Picked Up` 从 Me First 移出计分基地 | `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-计分前特殊牌从-Me-First-窗口打出并完成移入-移出计分基地\shayu-tornados-before-scoring-me-first-open.png`；`...\shayu-tornados-over-the-rainbow-after-move-in.png`；`...\shayu-tornados-picked-up-after-move-out.png` | 实际看到 Me First 真实响应入口；移入后目标随从进入计分基地，随后 `Picked Up` 又将其移出。达标。 |
| Tornados Dust Devil | 16) beforeScoring 在场 special may prompt，可选择移入计分基地 | `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-尘卷风计分前触发可选移动到计分基地\shayu-tornados-dust-devil-before-scoring-prompt.png`；`...\shayu-tornados-dust-devil-after-move-to-scoring.png` | 第一张实际看到“尘卷风：是否移动到即将计分的基地？”提示与尘卷风本体；第二张实际看到尘卷风进入海渊，计分分数从 16 变 18，并仍处于可继续响应窗口。达标。 |
| Tornados Gone with the Wind | 17) afterScoring special 从真实窗口打出；18) 清场前把随从移走并避免弃牌 | `D:\gongzuo\webgame\BoardGame\.worktrees\smashup-shayu-factions\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-随风而逝从-afterScoring-窗口打出并让随从逃离清场\shayu-tornados-gone-with-the-wind-after-scoring-open.png`；`...\shayu-tornados-gone-with-the-wind-after-scoring-cleanup.png` | 第一张实际看到 afterScoring 反应选择中有“随风而逝”；清场后截图显示 `Twister` 留在 Trailer Park，进入出牌阶段，测试断言它不在弃牌堆。达标。 |

## 已跑验证（2026-05-10）

- ESLint：
  - `npx eslint e2e/smashup-shayu-factions.e2e.ts` → 0 errors。
  - 早前定向能力/测试 ESLint 已通过；`.windsurf/skills/.../SKILL.md` 仅 File ignored warning，无 error。
- Vitest：
  - `..\..\node_modules\.bin\vitest.cmd run src/games/smashup/__tests__/shayuFactionIntake.test.ts src/games/smashup/__tests__/shayuFactionAbilities.test.ts src/games/smashup/__tests__/cardI18nIntegrity.test.ts src/games/smashup/__tests__/factionSelection.test.ts src/games/smashup/__tests__/factionVariantGroups.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts src/engine/ai/__tests__/seatDisplayName.test.ts --configLoader native --maxWorkers 1` → 7 files / 100 tests passed。
- E2E：
  - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup-shayu-factions.e2e.ts` → 12 tests passed。
- i18n：
  - `npm run i18n:check` → no missing keys detected（早前已跑）。
- `git diff --check`：
  - exit 0；仅 LF/CRLF 工作区提示（早前已跑）。

## 审计维度命中

- D1/D2：派系/卡牌/基地/i18n/atlas/manifest 接入完整性由 intake 合同与静态测试覆盖。
- D8/D12：关键状态变化由行为测试断言最终 core，不只断言事件发射。
- D18/D21/D49：多步交互、多选、逐目标、response/interaction 由 E2E 与行为测试分层覆盖；未覆盖项明确降级为风险。
- D31/D36：素材上传与运行时资源链路由 R2 HEAD、manifest、截图可见性共同证明。
- D50（本轮新增自定义）：外部交付目标必须远端回查；本地 ignored 图不作为交付证明。
- 2026-05-11 追加通用维度：交互入口语义审计，覆盖 D1/D3/D8/D15/D23/D33 的交叉风险，要求描述动作链第一选择对象与 UI/command/validator/handler 入口字段一致。

## 当前风险登记

1. 低风险同类能力仍按 L1/L2 覆盖，不逐卡单独做 E2E：例如 `tornados_cyclone` self move、`tornados_trade_winds` 双目标互换、`mythic_greeks_favor_of_ares/hermes/zeus` 等。它们不属于本轮“新机制高风险链路”残余。
2. `mythic_greeks_argonaut` 已用 Mythic Greeks 内 Odysseus/Heracles/Spartan 证明 action-trigger 代表链；若未来接入跨派系 action-trigger 组合包，建议另做参数化审计工厂，但本轮新机制 E2E 不再缺口。
3. 派系选择页截图可见新增素材，但顶部选中槽存在灰底占位；这不是玩法阻塞，但不能把入口截图冒充玩法完成。


## 2026-05-11 严格抽样重审追加结论：旧“已审计”结论降级

本轮后续严格抽样审计发现，原 shayu 审计结论对“描述入口 → UI/validator/handler 单一真相”的覆盖仍不够，不能继续按“所有复杂交互已完全收口”理解。

新增失效点：

1. `sharks_freakin_laser_beam` 暴露出通用字段缺口：`playNeedsMinion` 只能表达“要选随从”，不能表达“必须选你的随从”。已新增 `playTargetMinionController` 通用字段并扩到 UI/validator。
2. `mythic_greeks_favor_of_athena` 旧实现自动选择第一张行动牌并固定回顶顺序，漏掉“你可以选择其中一张行动牌”和“任意顺序回顶”。已改为选择行动牌 + 排序交互链。
3. `base_oracle_at_delphi` 旧实现只展示牌库顶，未在顶牌为行动牌时加入手牌。已补行动牌入手分支。
4. 同类扩审命中旧非 shayu 对象 `samurai_way_of_the_warrior` / `samurai_way_of_the_warrior_pod`，说明这是通用入口契约问题，不是鲨鱼单卡特例。

新增证据文档：`evidence/smashup/smashup-shayu-strict-chain-sample-audit-2026-05-11.md`。

当前口径：shayu 三派系已有 L1/L2 代表性链路增强，但仍不能宣称全量 L3 E2E 收口。后续若要发布级全收口，需要继续按对象清单逐项补真实入口 E2E/截图证据。

## 2026-05-12 通用入口矩阵全量重审回写

- **旧结论进一步限定**：2026-05-10 的“新机制真实入口 E2E 已验证”只能按当时的代表性 E2E 覆盖理解，不能解释为 39 张卡 + 6 张基地逐对象 L3 全覆盖。
- **本轮新增证据**：`evidence/smashup/smashup-shayu-full-chain-audit-2026-05-12.md`。
- **本轮审计口径**：按 `.spec/knowledge/standards/testing-audit.md` 新补强的通用交互入口语义矩阵，对 shayu 三派系全部对象做 P0/P1 重审，逐项核对第一入口、目标归属、数量/可选、上下文携带、UI/validator/handler/reducer 单一真相。
- **新结论**：截至本轮静态 + 行为证据复核，未发现新的 P0/P1 blocker；但本轮未新增浏览器 E2E 截图，因此不能把本轮结论升级为“全量 L3 E2E 收口”。
- **当前等级**：shayu 三派系可表述为“全量入口矩阵 P0/P1 已审 + 代表性 L2/L3 已验证 + 仍保留非逐对象 L3 残余范围”。

## 2026-05-23 +08 destroyerId 共享合同补审回写

- **旧结论失效项**：
  1. `sharks_mako` 旧条目“已注册 `perInstance + triggerBase`；未单独 E2E”不足以证明规则正确，因为问题不在卡牌注册，而在共享 destroyer 归因消费。
  2. `base_shark_reef` 旧条目“已修正用 `destroyerId`，不是被消灭者 owner”只证明了正向归属，未覆盖 destroyerId 缺失时的否定链。
- **真实根因**：`src/games/smashup/domain/reducer.ts` 旧逻辑会把缺失 `destroyerId` 的 `MINION_DESTROYED` 事件兜底成当前操作者/目标控制者，误触发 `you destroyed` 类能力。
- **本次补审范围**：仅 shayu 批次中真正依赖 `destroyerId` 的对象：`sharks_mako`、`base_shark_reef`。
- **新增证据**：
  - `src/games/smashup/__tests__/abilities/sharks.test.ts`
    - `灰鲭鲨不会把缺少 destroyerId 的消灭事件默认算成当前玩家消灭`
    - `鲨鱼领地不会把缺少 destroyerId 的消灭事件默认算成当前玩家触发`
  - 专项 evidence：`evidence/smashup/smashup-shayu-destroyerid-contract-reaudit-2026-05-23.md`
- **更新后口径**：shayu 新派系 destroy trigger 家族必须以后续 destroyerId 专项文档为准，旧本文条目不再单独支撑“destroyer 共享合同已收口”。

## 2026-05-12 再次抽样调查回写

- 新增证据：`evidence/smashup/smashup-shayu-strict-sample-audit-2026-05-12.md`。
- 旧结论修订：`mythic_greeks_favor_of_zeus` 不能再保留为“低风险未单独 L2”；抽样发现其 handler 二次弹出基地选择，已修复并补 L2 行为测试。
- 本次抽样未发现 `sharks_dangerous_waters`、`tornados_cyclone`、`mythic_greeks_favor_of_hermes`、`base_wooden_horse` 新 blocker。

## Addendum（2026-05-12 08:38 +08）：第一入口直接消费专项全量重审

- **旧结论再次降级**：此前“全量矩阵 + 抽样复审”没有逐项验证 handler 是否直接消费第一入口，因此只能作为 L1/L2 部分证据，不能再单独支撑“入口审计完成”。
- **新增专项证据**：`evidence/smashup/smashup-shayu-entry-consumption-audit-2026-05-12.md`。
- **本次发现并修复**：
  1. `mythic_greeks_favor_of_zeus`：`playNeedsBase` 后 handler 又二次 base prompt；已改为直接消费 `targetBaseIndex/baseIndex`。
  2. `tornados_carried_away`：`playNeedsMinion` 后 handler 又二次 minion prompt；已改为直接弹目标基地 prompt。
  3. `tornados_not_in_kansas`：替换目标基地后同一 `ACTION_PLAYED` 误触发新基地 `onActionPlayed`；已跳过同 timestamp 同 baseIndex 被替换的新基地触发。
- **验证**：`shayuFactionAbilities.test.ts + shayuEntryConsumption.test.ts` 共 27 passed；专项 audit 2 passed；`npm run typecheck` passed；相关文件 eslint 0 errors。
- **当前等级**：第一入口直接消费专项达到 L2；本轮追加复跑 3 条高风险真实入口 E2E 并核对截图；仍不宣称 45 对象全量逐项 L3。


## 2026-05-12 22:50 +08 全面审计 L2 补强回写

旧结论继续限定：本文档早期“已审计/已收口”只能作为当时代表链证据，不能替代新的全面审计 guard。当前总入口仍是 `evidence/smashup/smashup-shayu-comprehensive-audit-coverage-2026-05-12.md`。

本轮新增/扩展 L2：

- `sharks_chum`：宿主附着鲨鱼诱饵后，同基地任意随从被消灭会给宿主 +1。
- `base_the_deep`：4+ 随从打入后，仅同基地更低力量目标可被可选消灭。
- `mythic_greeks_favor_of_hades`：只从弃牌堆行动牌中选择一张回手，非行动牌不进候选。
- `base_trailer_park`：随从移入后自动给该随从 +1。
- `base_tornado_alley`：首次移入触发可选拉入另一个随从，写入 once/turn 标记，且 `reason=base_tornado_alley` 不递归再触发。

验证：`npx vitest run src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 12 passed；`npx eslint src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 0 errors。

仍未完成：45 对象逐行 L2 核销、全交互 L3/代表链、全部时序/窗口/队列 L4。


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
- C6 已完成回写；最终是否 COMPLETE 以 `temp/smashup-shayu-comprehensive-audit-2026-05-12.json` 与 guard 检查为准。


## 2026-05-13 01:03 +08 最终回归验证

- `npx eslint e2e/smashup-shayu-factions.e2e.ts src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 0 errors。
- `npx vitest run src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts` → 13 passed。
- `$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'; npm run test:e2e:ci -- e2e/smashup-shayu-factions.e2e.ts` → 14 passed。
- 本轮实际核对截图包括：
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-great-white-talent-destination-open.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Sharks-高风险链覆盖大白鲨天赋结算、飞鲨与激光束真实入口\shayu-sharks-great-white-after-move-destroy.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-随风而逝从-afterScoring-窗口打出并让随从逃离清场\shayu-tornados-gone-with-the-wind-after-scoring-open.png`
  - `D:\gongzuo\webgame\BoardGame	est-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornado-Alley-基地能力在本回合首次移入时触发，第二次移入不重复触发\shayu-tornado-alley-trigger-open.png`

## 2026-06-01 回写：`龙卷风走廊` 旧审计结论失效

- **旧结论是什么**：本文 `base_tornado_alley` 条目此前写的是“首次移入触发可选拉入，且同回合第二次移入不重复触发”。
- **为何失效**：旧证据只打到了对象级 happy path，没有打穿共享回合态 `usedBaseAbilitiesThisTurn` 的生命周期。旧实现会在 `TURN_STARTED` 时仅按 `playerId` 过滤 once 记录，而 `龙卷风走廊` 的判重只看 `baseIndex + baseDefId`，不看触发玩家，因此上一位玩家回合残留的记录会错误挡住下一位玩家本回合第一次移入触发。
- **新增证据**：
  - [src/games/smashup/domain/reduce.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/domain/reduce.ts:1739)：新回合开始时整组清空 `usedBaseAbilitiesThisTurn`。
  - [src/games/smashup/__tests__/bases/tornado-alley-base.test.ts](/D:/gongzuo/webgame/BoardGame/src/games/smashup/__tests__/bases/tornado-alley-base.test.ts:72)：新增“上一位玩家回合留下的 once 记录不应阻止新回合首次移入触发”。
  - 验证：`npx vitest run src/games/smashup/__tests__/bases/tornado-alley-base.test.ts --config vitest.config.ts`、`npx vitest run src/games/smashup/__tests__/abilities/tornados.test.ts --config vitest.config.ts`。
- **新结论**：`龙卷风走廊（base_tornado_alley）` 现在不仅验证“同回合只触发一次”，也验证“跨回合必须重置 once 状态”。本次漏审命中 D5/D8/D18/D49：旧审计把共享 turn-state 边界遗漏成了对象已通过，不能再把“代表性 E2E 已验证”解释成 once/turn 生命周期已全面收口。
