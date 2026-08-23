# Smash Up 自动选择代码模式审计

## 1. 基本信息

- 对象：Smash Up 选择型效果里的自动候选、第一候选、无交互态 fallback。
- 日期：2026-08-23
- 作者：Codex
- 文档类型：audit
- 关联需求 / 任务：用户反馈“幽灵捕手、彼得·文克曼、埃贡·斯宾格勒等效果被系统自动选择；代码用到自动选择的地方检查一遍”。

## 2. 审计范围

- 本轮覆盖的游戏 / 模块 / 对象：`src/games/smashup/abilities/**`、`src/games/smashup/domain/**`、`src/games/smashup/Board.tsx`、`src/games/smashup/ui/PromptOverlay.tsx`、`src/games/smashup/ai.ts`、`src/engine/ai/localRunner.ts`、`src/engine/transport/onlineAiRecovery.ts` 中显式自动选择、无交互态 fallback、UI 副作用提交和自动恢复模式；重点复核用户点名的 Wraithrustlers（中文“怨灵捕手”）相关链路。
- 本轮覆盖的规则子句或代码模式：玩家应选择对象、牌、基地、分支、是否执行时，系统不得自动取第一个候选、唯一候选或默认目的地。
- 本轮使用的目标入口 / 环境：本地 TypeScript 源码搜索、领域单测、审计测试、UI 副作用静态门禁、用户点名卡牌的现有专项测试。
- 明确不在本轮范围内的对象：非选择语义的强制自动效果、随机效果、牌库顶固定顺序、已提交选择后的结果裁剪、全牌逐文案重录、真实浏览器 UI 截图验收。

| 对象 | 语义检查状态 | 覆盖方式 | 直接证据 | 一致性核对 | 剩余差异 | 当前裁定 |
| --- | --- | --- | --- | --- | --- | --- |
| `autoResolveIfSingle: true` | 独立完成 | 代码模式扫描 | `src/games/smashup/domain/actionCounter.ts:311` | 只剩行动响应链的单按钮“继续”，不选择目标 / 分支 / 数量 | 无 | 放行 |
| `autoResolveIfSingle` 动态真值 | 独立完成 | 代码模式扫描 + 上下文复核 | `src/games/smashup/abilities/huluwawa.ts:1505` | 只在没有剩余牌可排序时自动继续，不替玩家选择牌 | 无 | 放行 |
| `discardFirstHand*` / `discardCards(...)` 自动弃牌 helper | 独立完成 | 代码模式扫描 | `rg discardFirstHand` 无命中 | 旧“弃第一张牌”入口已删除 | 无 | 已修 |
| Disney 共享 `first*MinionAtBase` / `addCounterToFirstOwnMinion` helper | 独立完成 | 代码模式扫描 + 删除未使用 helper | `rg addCounterToFirstOwnMinion / firstOwnMinionAtBase / firstOtherMinionAtBase` 无实现命中 | 未使用但名字和行为都容易引导“取第一个随从”代选，已删除并加入禁止清单 | 无 | 已清理 |
| `!ctx.matchState` 非空 fallback | 独立完成 | 代码模式扫描 + 定向复核 | 本文第 8 节搜索记录 | 命中项要么只给固定额外行动 / 检视牌库，要么无交互态不做选择分支；`舰长` 旧“抽第一张随从”fallback 已移除 | 全牌逐文案不是本文范围 | 当前锁定代码模式通过 |
| 取第一个候选的代码形态 | 独立完成 | 审计测试清单化 | `abilityBehaviorAudit.test.ts` 新增“取第一个候选的代码点必须留在已复核清单内” | 当前剩余 80 个 `[0]` / `collectMinionTargets(...)[0]` / `random.shuffle(...)[0]` 命中均被锁在已复核清单；新增命中会红灯 | 不替代逐文案规则审计 | 已加门禁 |
| Wraithrustlers 点名链路 | 独立完成 | 专项测试 + 源码复核 | `excellent-movies-teens.test.ts` 怨灵捕手代表测试 | 罗伊、芬克曼、复苏、艾伦、沃森、恶魔犬均保留玩家选择 | 无 | 已验证 |
| AI / 在线 watchdog 自动恢复层 | 独立完成 | 源码扫描 + 行为测试 + 审计门禁 | `src/engine/ai/localRunner.ts`、`src/engine/transport/onlineAiRecovery.ts`、`localRunner.attemptKey.test.ts`、`onlineAiRecovery-gameover.test.ts` | AI 座位可以由策略选择；human 座位在 AI runner 和 watchdog 恢复入口均不得被第一项 / trigger-only fallback 代选 | 不替代真实联网房间截图 | 已加门禁 |
| UI 副作用自动提交 | 独立完成 | UI 文件扫描 + 审计门禁 | `src/games/smashup/Board.tsx`、`src/games/smashup/ui/PromptOverlay.tsx`、`abilityBehaviorAudit.test.ts` | 玩家选择只能由点击 / 确认 handler 提交；`useEffect` / `setTimeout` 不得替当前 prompt 自动发出响应命令 | 不替代真实浏览器截图 | 已加门禁 |

## 3. 结论等级

- 结论等级：`功能实现已验证`
- 判定理由：本轮按自动选择代码模式完成搜索、修复新增命中的玩家选择 fallback，并对用户点名的 Wraithrustlers 选择链路复核现有行为测试。该结论只覆盖本轮锁定的自动代选代码模式，不替代全牌规则审计。

## 4. 权威来源

- 主真相源：`.spec/knowledge/standards/rule-driven-interaction-design.md`，要求玩家选择对象、分支、数量、顺序或是否执行时，系统不能因唯一合法候选、默认分支、旧 fallback 或 AI 便利替玩家提交。
- 对照源：当前卡牌中英文描述、已有专项测试、现有 interaction 源码。
- 关键规则原文 / 裁定：`散播谣言` 选择场上一个随从名；`开始召唤` 选择弃牌堆一个随从；`抛弃我的间谍` 由对应玩家选择弃一张随从；`舰长` 选择牌库中的一个随从加入手牌；Wraithrustlers 的 `复苏`、`芬克曼`、`罗伊`、`艾伦`、`沃森`、`恶魔犬` 均有明确玩家选择语义。
- 合同状态：`locked`

## 5. 原子语义与实现消费

| 对象 | 原子语义断言 | 实现消费点 | 最终权威状态 / finalState | 真实入口 / 验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| `innsmouth_spreading_the_word` | 玩家选择场上一个随从名；唯一匹配名也要确认 | `src/games/smashup/abilities/innsmouth.ts` | 无交互态不产生 `LIMIT_MODIFIED`；确认后才授予同名额外随从额度 | `innsmouth.test.ts` 唯一候选 prompt 测试；`automatic-choice-fallback.test.ts` 负向断言 | 无 | 已修 |
| `all_stars_begin_the_summoning` | 玩家选择弃牌堆一个随从放牌库顶；固定额外行动可直接授予 | `src/games/smashup/abilities/all_stars.ts` | 无交互态只产生额外行动，不产生 `CARD_TO_DECK_TOP` | `promos-sheep-all-stars.test.ts` 真实选择第二张；`automatic-choice-fallback.test.ts` 负向断言 | 无 | 已修 |
| `super_spies_the_spy_who_ditched_me` | 每名有随从手牌的其他玩家自己选择弃一张随从牌 | `src/games/smashup/abilities/yuanhou.ts` | 无交互态不产生 `CARDS_DISCARDED`；唯一随从仍等待对应玩家确认 | `yuanhouFactionAbilities.test.ts` 三条抛弃我的间谍测试；`automatic-choice-fallback.test.ts` 负向断言 | 无 | 已修 |
| `aladdin_discard_action_cost` | 弃行动牌作为费用时由玩家选择具体行动牌 | `src/games/smashup/abilities/aladdin.ts`、`src/games/smashup/abilities/disney_shared.ts` | 无交互态不弃第一张行动牌；旧 helper 已删除 | `disney-factions-abilities.test.ts` 茉莉公主 / 王宫守卫；`rg discardFirstHand` 无命中 | 无 | 已修 |
| `star_roamers_ships_captain` | 玩家选择牌库中的一个随从加入手牌；不能在无交互态自动抽牌库第一张随从 | `src/games/smashup/abilities/cease_and_desist.ts` | 无交互态不产生 `CARDS_DRAWN` / `DECK_REORDERED`；有交互态时 prompt 可选第二张随从 | `cease-and-desist.test.ts` “舰长搜索牌库时必须选择随从”；`automatic-choice-fallback.test.ts` 负向断言 | 无 | 已修 |
| `wraithrustlers_demon_dogs` | 玩家可从手牌或弃牌堆选择力量 3 或更低的随从储存在恶魔犬下方，也可跳过 | `src/games/smashup/abilities/excellent_movies_teens.ts` | 确认后 `storedCards` 写入所选牌的 `storedUnderUid / storedUnderDefId`；摧毁后授予限定额外随从 | `excellent-movies-teens.test.ts` “恶魔狗存放弱随从必须由玩家从手牌或弃牌堆选择” | 无 | 已验证 |
| `wraithrustlers_resurgence` | 玩家先选择基地上的行动，再选择摧毁或转移；转移时再选目标基地 | `src/games/smashup/abilities/excellent_movies_teens.ts` | 选择目标基地 2 后，行动只移动到基地 2，不落到第一个基地 | `excellent-movies-teens.test.ts` “复苏转移行动时必须由玩家选择行动、模式和目标基地” | 无 | 已验证 |
| `wraithrustlers_funkman` | 计分前由玩家选择要把行动转移到哪个基地 | `src/games/smashup/abilities/excellent_movies_teens.ts` | 选择目标基地 2 后，行动只移动到基地 2 | `excellent-movies-teens.test.ts` “芬克曼计分前转移行动时必须由玩家选择目标基地” | 无 | 已验证 |
| `wraithrustlers_roy` / `wraithrustlers_ellen` / `wraithrustlers_watson` | 罗伊选择转移的己方行动；艾伦选择摧毁的己方行动；沃森先选模式，再选要摧毁的行动 | `src/games/smashup/abilities/excellent_movies_teens.ts` | finalState 只消费玩家选中的行动，未选中的行动仍留在原区域 | `excellent-movies-teens.test.ts` 罗伊 / 艾伦 / 沃森专项断言 | 无 | 已验证 |
| 已有同链路对象 | 计分前移动、接收者、是否发动、目标摧毁、加 / 移除指示物等选择不得自动默认 | 对应 ability / base ability 文件 | 无交互态不产生对应选择结果 | `automatic-choice-fallback.test.ts` 8 条总回归 | 无 | 已覆盖 |
| AI / 在线 watchdog 自动恢复层 | AI 座位可由 AI 策略或 watchdog 收口；human 座位的选择语义不能被 `optionIds[0]`、`legalActions[0]`、trigger-only 第一项或 response fallback 代选 | `src/games/smashup/ai.ts`、`src/engine/ai/localRunner.ts`、`src/engine/transport/onlineAiRecovery.ts` | human seat 不进入 AI legal action 构建；真人 trigger-only `smashup_reaction_choose` 返回 `null`，不产生 `SYS_INTERACTION_RESPOND` | `localRunner.attemptKey.test.ts` human 座位负向测试；`onlineAiRecovery-gameover.test.ts` trigger-only AI 正向 + human 负向测试；`abilityBehaviorAudit.test.ts` AI / 自动恢复层静态门禁 | 无 | 已覆盖 |
| UI prompt 提交层 | UI 可以在点击、确认、手牌 / 基地 / 随从对象 handler 中提交当前玩家已选的 option；不能在 `useEffect` / timer 里直接替玩家提交 prompt | `src/games/smashup/Board.tsx`、`src/games/smashup/ui/PromptOverlay.tsx` | 当前审计门禁要求 UI 副作用扫描返回空；新增副作用提交会使审计测试失败 | `abilityBehaviorAudit.test.ts` “Smash Up UI 副作用不得自动提交当前选择” | 无 | 已加门禁 |

## 6. 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞当前验证口径 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| 全仓 UI displayMode / 旧 audit 红灯 | 非阻塞扩展 | 否 | 否 | 当前范围外 | 另开 UI / 审计债任务处理 |
| 全牌逐文案审计 | 非阻塞扩展 | 否 | 否 | 当前范围外 | 若用户要求“全牌规则审计”，按 game-audit-workflow 建对象全集 |
| 旧 evidence 中 `The Spy Who Ditched Me` 曾记录“单随从自动弃” | 审计留档缺口 | 否 | 否 | 当前范围外但已在本文标记当前实现口径 | 如整理旧总账，原地回写旧 evidence 失效段 |

## 7. 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | passed | 本文第 2 节列出自动选择代码模式、取第一个候选清单和用户点名 Wraithrustlers 范围 |
| 真相源状态 | passed | 规则驱动交互标准 + 当前卡牌描述 / 现有测试 |
| 原子语义断言 | passed | 本文第 5 节逐对象拆分 |
| 实现消费链 | passed | 直接修改或复核 ability 消费点 |
| 最终权威结果 | passed | 第 5 / 9 节记录 finalState、事件不存在断言和确认后状态变化 |
| 交互真实入口 | passed | Innsmouth / All-Stars / Yuanhou / Aladdin / Star Roamers / Wraithrustlers 专项测试；UI 副作用层有静态门禁防止自动提交 |
| 验证证据 | passed | 本文第 9 节命令 |
| 共享影响与代表链依据 | passed | 本轮不使用共享流程外推；按代码模式和点名对象逐项记录 |
| 缺口分类与范围裁定 | passed | 本文第 6 节 |
| 旧 evidence / 旧结论回写 | passed | 本文第 10 节记录旧口径失效；旧总账整理不阻塞当前功能验证 |
| 残余范围声明 | passed | 本文明确不覆盖全牌逐文案和 UI audit 旧红灯 |

## 8. 同类扩审与残余范围

同类扩审记录：

| 搜索范围 | 命中项 | 处理结论 |
| --- | --- | --- |
| `rg -n "autoResolveIfSingle\\s*:\\s*true" src/games/smashup -g "*.ts"` | 仅 `src/games/smashup/domain/actionCounter.ts:311` | 纯“继续结算行动响应链”按钮，不选择牌 / 基地 / 目标，放行 |
| `rg -n "autoResolveIfSingle" ... | Select-String -NotMatch "autoResolveIfSingle:\\s*false"` | `abilityHelpers` 配置读取、`actionCounter.ts:311`、`huluwawa.ts:1505`、测试断言 | `huluwawa.ts:1505` 为无剩余牌可排序时自动继续；其余为配置结构或测试 |
| `rg -n "discardFirstHand(Action\|Any\|Card)\|discardCards\\(" src/games/smashup -g "*.ts"` + `abilityBehaviorAudit.test.ts` helper 门禁 | 无命中 | 旧自动弃第一张手牌 helper 已清理；新增同类 helper 会红灯 |
| `rg -n "addCounterToFirstOwnMinion\|firstOwnMinionAtBase\|firstOtherMinionAtBase" src/games/smashup/abilities src/games/smashup/domain -g "*.ts"` | 无实现命中 | Disney 共享里三个未使用“第一随从” helper 已删除，并在 helper 门禁禁止恢复 |
| `abilityBehaviorAudit.test.ts` 无交互态非空事件门禁 | 仅 `avengers.ts`、`diy_clowns.ts`、`diy_killers.ts`、`magical_girls.ts` 四个已复核机械事件 | 固定检视牌库或固定额外行动放行；`star_roamers_ships_captain` 旧无交互态抽第一张随从 fallback 已删除 |
| `abilityBehaviorAudit.test.ts` 取第一个候选清单门禁 | 当前剩余 80 个第一项命中锁在 `reviewedFirstCandidateSites` | 新增 `candidates[0]`、`targets[0]`、`options[0]`、`actions[0]`、`minions[0]`、`ownMinions[0]`、`collectMinionTargets(...)[0]`、`random.shuffle(...)[0]` 等形态会红灯，必须复核为随机 / 固定流程 / 已提交选择后的消费，不能静默代选 |
| `rg -n "autoResolveIfSingle\|autoSubmit\|autoSelect\|selectFirst\|firstOption\|defaultOption\|optionIds\\[0\\]\|options\\[0\\]\|legalActions\\[0\\]" src/engine src/games/smashup -g "*.ts" -g "*.tsx"` | `src/games/smashup/ai.ts` 的 AI option payload、`src/engine/ai/localRunner.ts` 的 AI legal action fallback、`src/engine/transport/onlineAiRecovery.ts` 的 trigger-only watchdog、`src/games/smashup/game.ts` 的 `smashup_reaction_choose` 配置 | AI / watchdog 命中已复核：AI runner 跳过 human seat；watchdog 对 visible / hidden human interaction 均返回空或只关闭 human 响应窗口，不提交业务选项；新增了 human 负向测试和静态门禁 |
| `abilityBehaviorAudit.test.ts` UI 副作用自动提交门禁 | 扫描 `src/games/smashup/Board.tsx`、`src/games/smashup/ui/PromptOverlay.tsx` 的 `useEffect(() => { ... })` 和 `setTimeout(() => { ... })` | 当前无 `respondCurrentPrompt`、`lockedPromptRespond`、`SYS_INTERACTION_RESPOND`、`INTERACTION_COMMANDS.RESPOND` 等交互提交调用出现在副作用自动执行体内；新增命中会红灯 |
| `rg -n "length === 1 ..."` | 多个唯一候选 / 单元素代码 | 已通过 `abilityBehaviorAudit.test.ts` 的玩家选择语义、单候选旁路检查和取第一个候选清单；另复核 `huluwawa`、`ghosts`、Wraithrustlers 相关命中 |
| `rg -n "wraithrustlers_..." src/games/smashup/abilities/excellent_movies_teens.ts src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts` | 恶魔犬、罗伊、芬克曼、复苏、艾伦、沃森、灵质一号 | 点名链路均有 prompt 和 `autoResolveIfSingle:false` 断言，目标基地 / 行动由玩家确认 |

残余范围：本文只证明“自动代选代码模式”和用户点名 Wraithrustlers 链路；不证明全牌逐文案、所有 UI 渲染路径或真实浏览器截图链路已经完成。

## 9. 验证证据

- 命令：`npx vitest run src/games/smashup/__tests__/automatic-choice-fallback.test.ts --configLoader native`
- 结果：通过，1 file / 8 tests passed。
- 证明了什么：无交互态不会自动取第一个候选、唯一候选、默认目的地、默认“是”或第一分支。
- 没有证明什么：不证明全牌逐文案已经重审。

- 命令：`npx vitest run src/games/smashup/__tests__/abilities/cease-and-desist.test.ts --configLoader native --testNamePattern "舰长"`
- 结果：通过，1 file / 1 test passed / 25 skipped。
- 证明了什么：`舰长` 正常入口会要求玩家选择牌库随从，并能选择第二张随从加入手牌。
- 没有证明什么：不覆盖 Cease and Desist 全派系其它能力。

- 命令：`npx vitest run src/games/smashup/__tests__/abilities/innsmouth.test.ts --configLoader native --testNamePattern "spreading_the_word|散播谣言"`
- 结果：通过，1 file / 1 test passed。
- 证明了什么：`散播谣言` 唯一匹配名仍出 prompt，确认后才授予额度。
- 没有证明什么：不覆盖印斯茅斯其它非选择能力。

- 命令：`npx vitest run src/games/smashup/__tests__/abilities/promos-sheep-all-stars.test.ts --configLoader native --testNamePattern "开始召唤"`
- 结果：通过，1 file / 1 test passed。
- 证明了什么：`开始召唤` 真实入口不自动拿第一张弃牌堆随从。
- 没有证明什么：不覆盖 All-Stars 全派系。

- 命令：`npx vitest run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native --testNamePattern "抛弃我的间谍"`
- 结果：通过，1 file / 3 tests passed。
- 证明了什么：`抛弃我的间谍` 由受影响玩家选择，唯一随从也要求确认，handler 拒绝非候选。
- 没有证明什么：不覆盖 Yuanhou 全文件其它能力。

- 命令：`npx vitest run src/games/smashup/__tests__/abilities/disney-factions-abilities.test.ts --configLoader native --testNamePattern "茉莉公主|王宫守卫"`
- 结果：通过，1 file / 2 tests passed。
- 证明了什么：阿拉丁弃行动牌费用路径不再用无交互态弃第一张行动牌兜底。
- 没有证明什么：不覆盖 Disney 全派系。

- 命令：`npx vitest run src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts --configLoader native --testNamePattern "怨灵|恶魔狗|复苏|芬克曼|罗伊|艾伦|沃森"`
- 结果：通过，1 file / 18 tests passed / 62 skipped。
- 证明了什么：用户点名的怨灵捕手链路中，恶魔犬储存、罗伊 / 芬克曼 / 复苏转移、艾伦 / 沃森摧毁都保留玩家选择。
- 没有证明什么：不覆盖该文件全部 80 条测试以外的所有派系。

- 命令：`npx vitest run src/games/smashup/__tests__/abilityBehaviorAudit.test.ts --config vitest.config.audit.ts --configLoader native --testNamePattern "UI 副作用|AI 与自动恢复层|玩家选择语义|单候选目标|弃第一张|无交互态|取第一个候选"`
- 结果：通过，1 file / 7 tests passed / 27 skipped。
- 证明了什么：当前自动选择审计规则未发现 `autoResolveIfSingle:true` 误用、已登记单候选硬结算旁路、弃第一张 / 第一随从 helper、未复核无交互态非空事件、未复核第一候选代码点，AI / 自动恢复层的 human seat 跳过保护和 Smash Up AI 第一项 payload 位置仍符合门禁，且 Smash Up UI 副作用层没有自动提交当前 prompt 的交互响应。
- 没有证明什么：不证明其它 audit 配置下的旧跨游戏审计红灯已清零。

- 命令：`npx vitest run src/engine/ai/__tests__/localRunner.attemptKey.test.ts --configLoader native --testNamePattern "human 座位"`
- 结果：通过，1 file / 1 test passed / 5 skipped。
- 证明了什么：AI runner 遇到 human seat 时不会构建 AI legal actions，也不会执行本地策略或 fallback 代选。
- 没有证明什么：不覆盖在线 watchdog 的 trigger-only 恢复分支。

- 命令：`npx vitest run src/engine/transport/__tests__/onlineAiRecovery-gameover.test.ts --configLoader native --testNamePattern "trigger-only simple-choice"`
- 结果：通过，1 file / 2 tests passed / 58 skipped。
- 证明了什么：trigger-only simple-choice 对 AI 座位可按配置自动收口；同一 `smashup_reaction_choose` 若属于 human 座位，则 watchdog 返回空，不提交第一项 trigger。
- 没有证明什么：不证明真实联网房间截图链路。

- 命令：`npx tsc --noEmit --pretty false --skipLibCheck --noErrorTruncation`
- 结果：通过，无输出。
- 证明了什么：本轮 TypeScript 改动类型检查通过。
- 没有证明什么：不证明真实浏览器 UI 交互截图。

## 10. 修订 / 失效记录

- 旧文档路径：`evidence/smashup/smashup-in-progress-effect-atom-audit-2026-05-15.md`
- 旧结论：`The Spy Who Ditched Me` 曾记录“只剩 1 张随从则直接自动弃掉”。
- 失效原因：当前规则驱动交互标准要求唯一候选也保留玩家确认；当前源码和测试已改成唯一随从仍出 prompt。
- 替代旧结论的新证据：`src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts` 中“真实入口遇到唯一随从时仍要求对应玩家确认弃牌”。
- 新结论：`super_spies_the_spy_who_ditched_me` 不再允许自动弃第一张随从牌。
- 是否需要修改旧文档正文中的误导行：是，若后续整理旧总账，应原地回写该段为历史失效口径。

## 11. 对外汇报口径

- 允许说：已按自动选择代码模式扫过本轮锁定范围，修复新增命中的 `散播谣言`、`开始召唤`、`抛弃我的间谍`、`舰长`，清理阿拉丁旧自动弃牌 helper 和 Disney 未使用的“第一随从” helper，并把无交互态非空事件、第一候选代码点、危险 helper 名、AI / watchdog human seat 边界、UI 副作用自动提交加入审计门禁；用户点名的怨灵捕手链路已复核，相关定向测试通过。
- 禁止说：全牌规则审计完成、所有 UI / audit 旧红灯清零、所有 Smash Up 选择交互都做过真实浏览器截图验收。
