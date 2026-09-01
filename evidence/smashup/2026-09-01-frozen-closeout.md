# 大杀四方冰雪奇缘对象级审计收口

## 基本信息

- 对象：Smash Up / 大杀四方 `frozen`（冰雪奇缘）
- 日期：2026-09-01
- 文档类型：`closeout`
- 关联旧文档：`evidence/smashup/smashup-disney-four-factions-implementation-audit-2026-07-25.md`

## 审计范围

- 本轮覆盖：冰雪奇缘 15 张牌 + 2 个基地，即 `src/games/smashup/data/factions/frozen.ts` 中 `FROZEN_CARDS` 和 `FROZEN_BASES` 的完整对象清单。
- 本轮覆盖的规则链路：打出时能力、场上天赋、持续力量修正、保护 / 移动阻止、打出限制、基地 VP 修正、基地持续减力。
- 本轮目标入口 / 环境：本地工作区 `D:\gongzuo\webgame\BoardGame`；领域测试覆盖最终权威状态；Playwright 覆盖艾莎场上天赋的真实页面第一入口和基地选择 UI。
- 明确不在本轮范围内：Disney 其它派系（超能陆战队、狮子王、花木兰）的对象级重审；服务器 / 公开资源主源重新上传与 URL 哈希回查；全 Smash Up 批量统一 closeout。

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | `frozen.ts` 列出 15 张牌 + 2 个基地；本文逐项列满 17 行。 |
| 真相源状态 | `passed` | 本轮消费已落库的 Frozen 派系 TS 配置、完整单卡主裁图、裁图清单、SHA-256 intake 旧证据和旧 Disney evidence；没有临时新增规则真相源。 |
| 原子语义断言 | `passed` | 每个对象在“原子语义与实现消费”表中独立写明目标、数量、时机、负向路径或无玩家入口。 |
| 实现消费链 | `passed` | `disney_four_factions.ts` 注册、handler、保护 / 限制 / 修正入口均被对象行引用。 |
| 最终权威结果 | `passed` | Vitest 断言手牌、弃牌堆、基地随从、临时力量、有效力量、保护判断、移动拦截、VP 修正和交互清空。 |
| 交互真实入口 | `passed` | 艾莎新增/修正的场上天赋入口由真实页面点击 `su-minion-frame-elsa-choice` 触发；其它对象复用已存在出牌 / simple-choice 共享交互，按共享流程判等。 |
| 验证证据 | `passed` | Vitest 3 文件 51 例通过；E2E 文件 3 例通过，其中 Frozen 艾莎用例通过并生成本轮截图。 |
| 共享影响与代表链依据 | `passed` | 本文列 `sharedFlowId`、代表对象、判等依据和仅配置差异边界；simple-choice、持续修正、保护/限制、真实牌桌天赋入口均有一致性核对。 |
| 缺口分类与范围裁定 | `passed` | 服务器资源同步与其它派系重审均列为当前范围外，不阻塞 Frozen 本地玩法 closeout。 |
| 旧 evidence / 旧结论回写 | `passed` | 旧 Disney 四派系 evidence 顶部追加 2026-09-01 回写，旧 Frozen `in_progress` 口径被本文替代。 |
| 残余范围声明 | `passed` | 本文“缺口分类与范围裁定”和“对外汇报口径”明确禁止外推到其它实施中派系。 |

## 结论等级

结论等级：`当前范围已收口`。

判定理由：Frozen 当前锁定范围内的 17 个对象都有对象级语义行、实现消费点和最终权威状态证据；本轮修正了艾莎天赋从来源基地自动结算的问题，补成玩家真实点击艾莎后选择目标基地，并只压低所选基地其他玩家角色；`src/games/smashup/domain/ids.ts` 已不再把 `frozen` 放入实施中派系列表，相关配置审查和 Disney intake 测试也改为非实施中。

## 权威来源

- 主真相源：`src/games/smashup/data/factions/frozen.ts`，包含 Frozen 15 张卡、2 个基地、数量、力量、能力标签、图集位置、基地临界点和 VP 奖励。
- 图片合同证据：旧 Disney evidence 已记录原图 SHA-256 `4e28237e91b60a3a4faa48aa57b6c0404574cdd372017fa5104781219e1216b0`、完整单卡主裁图 `temp/smashup-disney-four-factions-intake/cards/slot-00-r1c1.png` 至 `slot-59-r6c10.png`、裁图清单 / crop manifest `temp/smashup-disney-four-factions-intake/source-and-grid-feasibility.json`，本轮未改图集几何。
- 规则实现消费源：`src/games/smashup/abilities/disney_four_factions.ts`。
- 旧审计来源：`evidence/smashup/smashup-disney-four-factions-implementation-audit-2026-07-25.md`，其中 2026-08-19 回写曾把 Frozen 标为 `in_progress`。
- 合同状态：`locked`。本轮没有发现卡名、数量、图集索引、能力标签或基地元信息需要回到 intake 重新裁定。

## 共享流程审计与引用复用

| sharedFlowId | 代表对象 | 流程职责 | 一次性审计证据 | 一致性核对 / 判等依据 | 允许配置差异 | 失效影响面 |
| --- | --- | --- | --- | --- | --- | --- |
| `smashup-shared-simple-choice-minion` | 迷你雪人、雪宝、放手吧、驯鹿、汉斯 | 从能力 handler 打开随从选择，玩家点候选后写入最终事件并清空交互。 | `snowgie`、`olaf`、`letItGo`、`reindeers`、`hans` 行为测试。 | 触发时机来自 onPlay/talent；候选生成由 handler 明确过滤；权限判断来自当前玩家；payload 带 `minionUid/baseIndex`；执行入口是 `disney_four_factions.ts` 对应 handler；最终权威状态是力量、移动、返回、摧毁；清理语义是 `sys.interaction.current` 关闭。对象之间仅配置差异为来源卡、目标过滤、数值、后续抽牌或给额外行动。 | 来源卡、目标过滤、数值、是否后续抽牌 / 给额外行动。 | 任一 simple-choice 目标过滤或响应收口 bug 需要重审引用该流程的 Frozen 选择类对象。 |
| `smashup-shared-simple-choice-card-pool` | 斯文、你想和我堆个雪人吗 | 从牌库 / 弃牌堆候选池选择卡牌并回到手牌。 | `sven`、`buildSnowman` 行为测试。 | 触发时机 onPlay；候选生成按牌名/力量过滤；权限为来源玩家；payload 是 `cardUid` 或多选列表；执行入口是 recoverCards handler；最终状态是手牌、弃牌堆、牌库变化；清理语义是选择窗口关闭。对象之间仅配置差异为最大选择数量、是否可跳过、候选来源区域。 | 最大选择数量、是否可跳过、候选来源区域。 | recoverCards 共享 handler 改动时需重审斯文与堆雪人。 |
| `smashup-shared-ongoing-modifier-protection` | 棉花糖、克里斯托弗、安娜、冻结的港口、锁上大门、冰宫、阿伦黛尔 | 持续力量、保护、限制和事件拦截由 registry 在权威状态计算 / 命令验证 / 后处理消费。 | 棉花糖、克里斯托弗、安娜、冻结的港口、锁上大门、冰宫、阿伦黛尔行为测试。 | 触发时机由持续状态实时计算；候选生成为当前基地 / 当前命令；权限判断含来源玩家和控制者；执行入口为 `registerCustomPowerModifiers`、`registerProtection`、`registerRestriction`、`registerInterceptor`、`registerBaseVpModifier`；最终权威状态是有效力量、能否影响/移动/打出、VP 修正；清理语义不产生未关闭交互。对象之间仅配置差异为 sourceDefId、数值、限制阈值、基地 defId。 | sourceDefId、数值、限制阈值、基地 defId。 | 持续修正或保护注册消费变动时重审引用对象。 |
| `smashup-field-talent-base-choice` | 艾莎 | 场上可发动随从天赋从卡牌本体进入，再选择目标基地。 | 艾莎行为测试 + 本轮 Playwright E2E + 三张截图。 | 触发时机 playCards；候选生成为全部基地；权限为艾莎控制者；payload 从真实点击艾莎卡本体产生 `minionUid/baseIndex`，再由基地选项带 `baseIndex`；执行入口是 `elsaTalent` 和 `baseTempPowerOtherPlayers` prompt handler；最终权威状态是所选基地其他玩家角色 `tempPowerModifier -1`；清理语义是交互关闭且艾莎标记已用。目标基地数量随牌桌基地数变化，属于仅配置差异。 | 目标基地数量随牌桌基地数变化。 | 新增场上天赋基地选择类 UI 时可引用，但目标效果不同仍需独立最终状态断言。 |

## 原子语义与实现消费

| 对象 | 原子语义断言 | 实现消费点 | 最终权威结果 | 真实入口 / 验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 迷你雪人 / `frozen_snowgie` | 打出到基地后，玩家必须选择该基地一个角色；被选角色本回合 +1；不能自动给第一张，也不能选外基地。 | `snowgie()` -> `promptMinion(kind: addTempPower)`，候选过滤 `baseIndex === ctx.baseIndex`。 | 选择 `chosen-target` 后只给它 `TEMP_POWER_ADDED +1`，`first-target` 保持 0，外基地不进候选。 | Vitest：`冰雪奇缘：迷你雪人必须选择同基地角色...`；共享流程 `smashup-shared-simple-choice-minion`。 | 无 | `passed` |
| 棉花糖 / `frozen_marshmallow` | 持续效果只压低同基地其他玩家角色 -1；己方和其它基地不受影响。 | `registerCustomPowerModifiers({ sourceDefId: frozen_marshmallow })`。 | 同基地敌方有效力量从 2 到 1；己方 2 不变；外基地敌方 2 不变。 | Vitest：`冰雪奇缘：棉花糖只压制同基地敌方角色...`；共享流程 `smashup-shared-ongoing-modifier-protection`。 | 无 | `passed` |
| 雪宝 / `frozen_olaf` | 打出后选择这里一个己方角色，再选择其它基地移动，并抽 1 张；不能自动移动第一个。 | `olaf()` -> `promptMinion(kind: moveMinionTarget, requireOwnTarget, drawAfterMove: 1)`。 | `chosen-ally` 从基地 0 移到基地 1；`first-ally` 留在原地；玩家抽到 `olaf-draw`。 | Vitest：`冰雪奇缘：雪宝必须先选择要移动的己方角色...`；共享流程 `smashup-shared-simple-choice-minion`。 | 无 | `passed` |
| 斯文 / `frozen_sven` | 打出后可从弃牌堆选择力量 4 或更低角色回手，也可跳过；不能自动拿第一张。 | `sven()` -> `recoverDiscardByPower(..., optional: true)` -> `recoverCards`。 | 跳过时手牌不变、弃牌堆不变；选择 `second-low-power` 时该牌进手牌，未选牌留弃牌堆。 | Vitest：`冰雪奇缘：斯文可跳过弃牌堆回收...`；共享流程 `smashup-shared-simple-choice-card-pool`。 | 无 | `passed` |
| 安娜 / `frozen_anna` | 克里斯托弗在同基地同阵营时，其他玩家不能影响安娜；己方来源不被阻止。 | `annaProtection()` + `registerProtection('frozen_anna', 'affect', ...)`。 | 敌方 action affect 返回受保护；安娜控制者自己的 affect 不受阻止。 | Vitest：`冰雪奇缘：冻结的港口...安娜保护按同基地条件生效`；共享流程 `smashup-shared-ongoing-modifier-protection`。 | 无 | `passed` |
| 克里斯托弗 / `frozen_kristoff` | 与己方安娜在同基地时，克里斯托弗自身 +2。 | `registerCustomPowerModifiers({ sourceDefId: frozen_kristoff })`。 | `boosted-kristoff` 有己方安娜同基地时有效力量 6。 | Vitest：同上，单独无冰宫干扰场景断言克里斯托弗 +2。 | 无 | `passed` |
| 艾莎 / `frozen_elsa` | 每回合天赋从艾莎场上卡牌本体发动；玩家选择一个基地；只让所选基地其他玩家角色本回合 -1，不影响己方或未选基地。 | `BaseZone.tsx` 点击随从本体派发 `USE_TALENT`；`elsaTalent()` 打开 `baseTempPowerOtherPlayers` 基地选择；选择后 `addTempPower(..., -1)`。 | 选基地 1 后，来源基地敌方 0、目标基地己方 0、目标基地两个对手角色分别 -1；交互关闭。 | Vitest：`冰雪奇缘：艾莎天赋必须先选择基地...`；E2E：`冰雪奇缘艾莎天赋必须从真实页面进入基地选择...`；截图见验证证据。 | 无 | `passed` |
| 真爱的行为 / `frozen_act_of_true_love` | 打出后先抽 1 张，再选择己方一个角色获得本回合临时保护。 | `actOfTrueLove()` -> `buildStandardDrawEvents` + `promptMinion(kind: protectMinionAffect)`。 | 抽到 `love-draw`；选择 `ally` 后写入 `tempProtectAffectUntilTurnNumber` 和来源玩家。 | Vitest：`冰雪奇缘：棉花糖...真爱的行为先抽牌再给所选角色临时保护`；共享流程 `smashup-shared-simple-choice-minion`。 | 无 | `passed` |
| 夏天大盛宴 / `frozen_big_summer_blowout` | 打出后玩家选择一个基地，按该基地己方角色数抽牌；对手角色不计数。 | `bigSummerBlowout()` -> `runPrompt(kind: baseDrawOwnMinions)`。 | 选基地 1，那里己方 2 个角色，抽 2 张；第 3 张留牌库。 | Vitest：`冰雪奇缘：夏天大盛宴按所选基地己方角色数量抽牌`；共享流程 `smashup-shared-simple-choice-minion` 的基地选择变体。 | 无 | `passed` |
| 你想和我堆个雪人吗? / `frozen_do_you_want_to_build_a_snowman` | 从牌库和弃牌堆合并候选中选择至多 2 张迷你雪人回手；可少选 / 跳过；非迷你雪人不进候选。 | `buildSnowman()` -> `recoverCards(maxChoices: 2, optional: true, genericIntent: card-pool)`。 | 选择弃牌堆 1 张 + 牌库 1 张后，两张进手牌；未选弃牌堆牌留弃牌堆；非迷你雪人留牌库；无 matchState 时不伪造交互。 | Vitest：`冰雪奇缘：你想堆雪人吗必须从牌库和弃牌堆合并候选中选择至多两张`；共享流程 `smashup-shared-simple-choice-card-pool`。 | 无 | `passed` |
| 冻结的港口 / `frozen_frozen_port` | 持续行动附在基地；其他玩家不能移动这里的角色；不阻止正常打出角色。 | `frozenPortMoveRestriction()`、`frozenPortInterceptor()`、`registerProtection('move')`、`registerInterceptor`。 | 敌方移动安娜事件被拦截为 null；己方移动不拦截；敌方仍能把普通随从打到该基地。 | Vitest：`冰雪奇缘：冻结的港口不阻止打出角色...`；共享流程 `smashup-shared-ongoing-modifier-protection`。 | 无 | `passed` |
| 汉斯·韦斯特加德 / `frozen_hans_westergaard` | 打出到目标基地后，必须让玩家选择该基地力量 3 或更低角色摧毁；4 力量角色不进候选；不能自动摧毁第一张。 | `hans()` -> `promptMinion(kind: destroyMinion)`，候选用 `getMinionPower <= 3`。 | 只列两个低力量目标；选择 `chosen-low-target` 后它被摧毁；4 力量目标留场。 | Vitest：`冰雪奇缘：汉斯必须选择目标基地力量 3 或更低角色...`；共享流程 `smashup-shared-simple-choice-minion`。 | 无 | `passed` |
| 放手吧 / `frozen_let_it_go` | 打出后玩家选择己方一个角色回手，并获得额外行动额度；不能自动返回第一张。 | `letItGo()` -> `promptMinion(kind: returnMinion, extraActionAfter: true)`。 | `chosen-ally` 从基地移除回手；`first-ally` 留场；产生 action limit 增加事件。 | Vitest：`冰雪奇缘：放手吧必须选择要返回的己方角色...`；共享流程 `smashup-shared-simple-choice-minion`。 | 无 | `passed` |
| 锁上大门 / `frozen_lock_the_gates` | 持续行动附在基地；只阻止其他玩家在该基地打出力量 3 或更低角色；允许对手力量 4；允许控制者低力量。 | `lockTheGatesRestriction()` + `registerRestriction('play_minion')`。 | 对手 2 力量打出被拒绝；对手 4 力量成功；控制者 2 力量成功。 | Vitest：`冰雪奇缘：锁上大门只阻止其他玩家在该基地打出力量 3 或更低角色`；共享流程 `smashup-shared-ongoing-modifier-protection`。 | 无 | `passed` |
| 驯鹿的心地比人好 / `frozen_reindeers_are_better_than_people` | 打出后玩家必须选择己方一个角色，本回合 +2；若斯文在场则 +4；敌方不进候选。 | `reindeers()` -> `promptMinion(kind: addTempPower)`，`amount` 由 `hasDefInPlay(frozen_sven)` 决定。 | 无斯文时选中己方 +2；有斯文时选中己方 +4；敌方不进候选。 | Vitest：`冰雪奇缘：驯鹿的心地比人好必须选择己方角色...`；共享流程 `smashup-shared-simple-choice-minion`。 | 无 | `passed` |
| 冰宫 / `base_ice_palace` | 基地临界点 22、VP 4/2/1；这里有对手角色时角色有效力量 -1。 | 静态 `FROZEN_BASES`；`registerCustomPowerModifiers({ sourceDefId: base_ice_palace })`。 | `icePalace` 审查行有 22 和 4/2/1；同基地存在对手时安娜和普通随从有效力量均降低 1。 | Vitest：`configReviewAdapter` 基地行；`冰雪奇缘：冻结的港口...冰宫减力...`。 | 无 | `passed` |
| 阿伦黛尔 / `base_arendelle` | 基地临界点 20、VP 3/2/1；计分时角色最多的玩家额外 +1 VP，并列最多可同时获得。 | 静态 `FROZEN_BASES`；`registerBaseVpModifier('base_arendelle', ...)`。 | 玩家 0 原 3 仍 3；玩家 1 原 2 因角色最多额外到 3。 | Vitest：`冰雪奇缘：阿伦黛尔只在基地计分 VP 奖励时给最多角色玩家额外 1 VP`。 | 无 | `passed` |

## 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞已审计 / 已收口口径 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| Disney 其它派系对象级重审 | `非阻塞扩展` | 否 | 否 | 当前范围外；本轮只取消 Frozen 实施中。 | 按用户“继续”逐个派系执行对象级审计，不批量取消。 |
| 服务器 / 公开资源主源重新上传与 URL 哈希回查 | `非阻塞扩展` | 否 | 否 | 当前范围外；本文只证明本地玩法和 UI 实施状态。 | 进入统一发布或资源 closeout 时，按资源发布链另跑上传与公开 URL 回查。 |
| 艾莎真实页面第一入口 | `当前范围验证缺口` -> 已补齐 | 是，补齐前会阻止取消 Frozen 实施中 | 是，补齐前不能称真实入口已证实 | 当前范围内，已由本轮 E2E 覆盖。 | 已改为点击艾莎卡牌本体触发，不再用测试命令代替第一入口。 |
| 旧 Disney evidence 仍写 Frozen 实施中 | `审计留档缺口` -> 已补齐 | 否 | 是，补齐前会传播旧结论 | 当前范围内，已原地回写。 | 已追加 2026-09-01 状态回写并指向本文。 |

## 验证证据

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/disney-four-factions.test.ts src/games/smashup/__tests__/disneyFourFactionsIntake.test.ts src/games/smashup/__tests__/configReviewAdapter.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
- 结果：`3 passed`、`51 passed`。输出中的“命令验证失败: su:play_minion ... 该基地禁止打出该随从”来自锁上大门负向路径预期拒绝，不是测试失败。
- 证明了什么：Frozen 17 个对象的最终权威状态、选择候选、负向路径、实施中标记取消和配置审查状态。
- 没有证明什么：不证明服务器资源已经重新发布；不证明 Disney 其它派系对象级审计已完成。
- 命令：`node scripts/infra/run-e2e-command.mjs isolated e2e/smashup/smashup-disney-four-factions-baymax-frozen-lion-mulan.e2e.ts "冰雪奇缘艾莎"`
- 结果：Playwright 实际运行同文件 3 例，`3 passed`；Frozen 艾莎用例通过。
- 证明了什么：玩家在真实牌桌点击艾莎卡牌本体后进入“艾莎：选择基地”，基地候选高亮，选择目标基地后只压低目标基地对手角色并关闭交互。
- 没有证明什么：该文件其它两个 Disney 用例只是邻近回归，不构成其它派系对象级 closeout。
- 截图路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-disney-four-factions-baymax-frozen-lion-mulan.e2e\冰雪奇缘艾莎天赋必须从真实页面进入基地选择并只压低所选基地对手角色\frozen-elsa-talent-ready.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-disney-four-factions-baymax-frozen-lion-mulan.e2e\冰雪奇缘艾莎天赋必须从真实页面进入基地选择并只压低所选基地对手角色\frozen-elsa-base-choice-prompt.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-disney-four-factions-baymax-frozen-lion-mulan.e2e\冰雪奇缘艾莎天赋必须从真实页面进入基地选择并只压低所选基地对手角色\frozen-elsa-talent-resolved.jpg`
- 人工观察结论：
  - 入口图：艾莎卡牌本体有黄色可发动高亮，牌桌不是错误页。
  - 选择图：点击艾莎后出现“艾莎：选择基地”，三张基地都有绿色可选框，说明玩家在选基地而不是测试脚本暗中替选。
  - 结算图：选择框关闭；目标基地两个对手角色显示减力，艾莎所在基地对手角色没有被压低。

## 修订 / 失效记录

- 旧文档路径：`evidence/smashup/smashup-disney-four-factions-implementation-audit-2026-07-25.md`
- 旧结论：2026-08-19 回写将 Frozen 标为 `in_progress`，并列出 9 个缺对象级验证的对象。
- 失效原因：本轮已补齐 Frozen 17 个对象的对象级行为证据、艾莎真实页面入口 E2E 和旧 evidence 回写；旧 `in_progress` 不再代表当前本地玩法状态。
- 替代旧结论的新证据：本文 + 上述 Vitest / E2E / 截图。
- 新结论：Frozen 本地玩法对象级审计当前范围已收口；`frozen` 已从实施中派系列表移除。
- 是否需要修改旧文档正文中的误导行：已在旧文档顶部追加状态回写；旧历史正文保留，不删除。

## 对外汇报口径

- 允许说：本轮完成冰雪奇缘这个派系的本地玩法对象级审计，并取消 Frozen 的“实施中”状态。
- 允许说：艾莎天赋已从真实页面点击艾莎卡牌本体进入基地选择，不再只靠测试命令触发。
- 禁止说：Disney 四派系已全部重新完成对象级审计。
- 禁止说：所有 Smash Up 实施中派系都已完成。
- 禁止说：服务器资源主源已重新发布并通过公开 URL 回查。
