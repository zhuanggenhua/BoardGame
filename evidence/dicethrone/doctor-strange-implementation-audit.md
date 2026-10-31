# 奇异博士新增派系实施审计

## 基本信息

- 对象：Dice Throne `doctor_strange`
- `gameId`：`dicethrone`
- 证据类别：`independent`
- 日期：2026-10-26
- 文档类型：`audit`
- 关联任务：`openspec/changes/add-dicethrone-doctor-strange-faction`
- 当前结论：`当前代码验证口径已收口`（仅 doctor_strange）
- 结论等级：当前代码验证口径已收口，仅限下述奇异博士审计范围。
- 当前角色状态：正常可选，无实施中标记

## 审计范围、真相源与证据边界

- 对象范围：32 张实体卡（9 张法术、18 张共享行动牌、5 张角色行动牌）、9 个玩家板槽位、预感/即视感/深红系带、公开法术准备区、预感收入替代、奖励骰和阶段恢复。
- 主真相源：`src/games/dicethrone/rule/奇异博士录入核对.md`、`奇异博士卡牌录入核对.md`、`奇异博士真相源表.md`、用户指定目录的原始图片与 `官方qa.png`。
- 实现入口：`src/games/dicethrone/heroes/doctor_strange/`、`domain/doctorStrange/`、共享 Dice Throne `domain/`、`Board.tsx`、`CenterBoard.tsx` 与真实联机选角页。
- 当前验收包：`evidence/dicethrone/doctor-strange-real-entry-20261026-closeout/`。8条牌桌链来自 `e2e-1792997531872-feplm0`（全文件9/9通过），正式双人链采用补验 `e2e-1793019370902-ksuvti`（1/1通过）；每条链保留实际 sourceRun/sourceRevision/E2E源码摘要。42张图中40张逐图复核，2张与已审原图字节相同而继承审查。内部索引合同通过，未请求或注册Viewer。
- 其余 `setupScene` 注入交互只证明牌桌内的鼠标操作和显示，不外推到选角资格。真实双人链已单独证明奇异博士可以被选择并进入双人牌桌。
- 截图逐图审查仅覆盖目标可见、操作界面、排版可读、错误提示；HP、资源、卡区和阶段由 Vitest/行为 trace 断言，不由视觉审查推断。

## 审计自检表

| 自检项 | 状态 | 直接证据与边界 |
| --- | --- | --- |
| 对象范围与真相源状态 | `passed` | 32卡、9槽、3状态及源图、录入核对、官方QA；逐对象矩阵保留在下文。 |
| 原子语义、实现消费链与最终权威结果 | `passed` | 18张共享牌逐牌真实命令、费用/卡区/结果断言；法术和角色牌专项断言；249项基线及80项增量。 |
| 未收口事务生命周期 | `passed` | 选择帧JSON恢复、攻击后续接、响应收口、护盾和伤害账本有最终状态回归。 |
| 交互真实入口与新交互矩阵 | `passed` | 九条行为链；正式双人入口覆盖建房、选角、准备、开局和双方玩家板。八条规则链初态为内部初始化。 |
| 当前截图PASS清单 | `passed` | 42张图、9条trace；逐图结论、原图路径、SHA和同源字段在当前证据包内；未打开Viewer。 |
| 独立代码复审 | `passed` | 七项P1及两条法术语义修复后整体复核PASS；本范围无未处理P1/P2。 |
| 共享影响与代表链依据 | `passed` | 18行sharedFlowId合同及逐牌行为，cross-hero 74项纳入249项基线；后续无影响改动逐文件审核。 |
| 验证证据与范围归属 | `passed` | 定向lint、production build、规格与证据自检；全仓最新失败与派系通过项分别记录。 |
| 旧evidence与旧结论回写 | `passed` | 旧源码包保留为历史；当前包按独立链实际来源增量组合，未改写旧trace身份。 |
| 完成态与残余范围声明 | `passed` | 用户已要求完成验收；正常可选、无实施中标记由目录单测及真实联机入口验证。全仓/生产部署不在通过声明内。 |

## 32 张实体卡逐项矩阵

共享牌的公共定义来自 `domain/commonCards.ts`，奇异博士图集映射由 `heroes/doctor_strange/cards.ts` 管理，18张共享牌占 atlas 0–17，9张法术占18–26，5张专属行动牌占27–31。18行均以 `dicethrone.common-action-card-resolution` 为共享流程引用；逐牌一致性字段和允许差异见下节。当前逐牌命令链证据来自领域管线测试，不等于逐牌浏览器 E2E。

### 法术牌（9）

| 卡牌 ID | 原子语义 | 实现消费与最终状态 | 证据/结论 |
| --- | --- | --- | --- |
| `spell-flames-of-faltine` | 准备时对手受1点伤害；施放时本次攻击+1，之后回手。 | `domain/doctorStrange/` 生成带来源的攻击修正；共享 Dice Throne 事件系统在主伤害已提交时追加正式 `DAMAGE_DEALT`。 | `doctor-strange-lifecycle.test.ts` 真实大顺子链断言 HP 41→40、攻击净伤害9→10、法术回手及攻击帧清理；同测覆盖法瑞拉之牙与艾坎之形追加3/4点。`passed` |
| `spell-rings-of-raggadorr` | 准备获得1预感；施放可从弃牌依序施放至多两张不同法术。 | 法术帧记录已施放法术集合和顺序。 | 法术系统测试覆盖上限、不同法术、私有视图及恢复。`passed` |
| `spell-vapors-of-valtorr` | 准备时治疗任意一名英雄1点；施放获得3预感。 | `domain/doctorStrange/` 目标候选覆盖任意英雄，治疗与预感分别归约。 | `doctor-strange-spell-system.test.ts` 准备时明确选择对手并断言对手HP+1、自身HP不变；施放断言预感+3。`passed` |
| `spell-bolts-of-balthakk` | 准备获得1 CP；施放对手受3点直接伤害。 | 法术执行、伤害来源和 CP/HP 状态。 | 法术系统测试覆盖直接伤害与资源。`passed` |
| `spell-winds-of-watoomb` | 准备时可移除任意一名玩家身上的1个状态；施放先弃置自身，再从弃牌准备法术并恢复原去向。 | 卡区事务与全体玩家状态候选在法术系统/归约中结算。 | `doctor-strange-spell-system.test.ts` 让唯一状态位于对手身上，明确验证对手状态被移除；另覆盖自引用准备、卡牌守恒和跳过可选状态。`passed` |
| `spell-mists-of-morpheus` | 准备时指定一名玩家获得即视感；施放时治疗任意一名英雄3点。 | `domain/doctorStrange/` 目标选择分别消费玩家目标与英雄治疗目标。 | `doctor-strange-spell-system.test.ts` 准备和施放均明确选择对手，断言其即视感/HP变化以及自身状态和HP不变。`passed` |
| `spell-crimson-bands-of-cyttorak` | 准备对手获得深红系带；施放令后续攻击不可防御。 | `domain/doctorStrange/` 状态生命周期与攻击标记。 | 法术系统断言不可防御；真实鼠标 E2E 记录目标选择和对手获得状态。`passed` |
| `spell-fangs-of-farallah` | 准备使对手失去1 CP；施放后续攻击+3。 | 目标选择、资源扣减、攻击修正归约。 | 法术系统测试与全知之眼目标选择链覆盖。`passed` |
| `spell-images-of-ikonn` | 准备无效果；施放按手牌数增加攻击伤害，最多+4。 | 攻击修正取手牌数并受上限约束。 | 法术系统测试覆盖手牌数量边界。`passed` |

### 共享行动牌（18）

| Atlas | 卡牌 ID | 原子语义 | 实现/一致性与测试证据 | 结论 |
| ---: | --- | --- | --- | --- |
| 0 | `card-transfer-status` | 选择状态并将一名玩家身上的1个状态转给另一名玩家。 | `doctor-strange-lifecycle.test.ts` 真实出牌后转移一层 Poison，断言双方层数、CP、弃牌区和交互关闭。 | `passed via shared flow` |
| 1 | `card-what-status` | 选择一名玩家，移除其全部状态。 | Strange 真实出牌后选择对手，清除 Poison 与 Bind，断言最终状态、CP、弃牌区和交互关闭。 | `passed via shared flow` |
| 2 | `card-one-throw-fortune` | 主阶段投1骰，获得其结果一半向上取整的 CP。 | Strange 真实出牌与 bonus-dice 结算，点数4使CP由2升至4；牌进入弃牌区且待结算清理。 | `passed via shared flow` |
| 3 | `card-get-away` | 主阶段选择一名玩家，移除其1个状态。 | Strange 真实出牌后移除对手一层 Poison，断言状态、CP、弃牌区和交互关闭。 | `passed via shared flow` |
| 4 | `card-super-double` | 即时抽3张牌。 | Strange 真实出牌后从本角色牌库实际抽3张，断言牌序、CP与弃牌区。 | `passed via shared flow` |
| 5 | `card-double` | 即时抽2张牌。 | Strange 真实出牌后从本角色牌库实际抽2张，断言牌序、CP与弃牌区。 | `passed via shared flow` |
| 6 | `card-bye-bye` | 即时选择一名玩家，移除其1个状态。 | Strange 真实出牌后移除自身一层 Poison，断言状态、CP、弃牌区和交互关闭；响应窗口共通边界另由 `card-timing-response-boundaries.test.ts` 覆盖。 | `passed via shared flow` |
| 7 | `card-flick` | 即时调整任意1骰±1，结果限制在1–6；可操作锁定骰。 | Strange 真实出牌后将所选骰从1改为2并收口；锁定骰与roll context由 `card-flick-locked-dice.test.ts`、`roll-context.test.ts` 补充覆盖。 | `passed via shared flow` |
| 8 | `card-boss-generous` | 即时获得2 CP。 | Strange 真实出牌后CP由4升至6，牌进入弃牌区。 | `passed via shared flow` |
| 9 | `card-next-time` | 伤害结算前选择一名玩家，防止即将受到的6点伤害；奇异博士专属映射将时机置为 `roll`，作为本英雄的明确配置差异。 | `doctor-strange-lifecycle.test.ts` 直接覆盖 Strange AI 候选、实际出牌、护盾、卡区和 CP；公共防伤效果仍由共享 reducer 执行。 | `passed` |
| 10 | `card-unexpected` | 掷骰后改变任意2骰数值。 | Strange 真实出牌后将所选两骰分别改为6和5，断言骰面、CP、弃牌区和交互关闭。 | `passed via shared flow` |
| 11 | `card-worthy-of-me` | 自己或队友可重掷至多2次；奇异博士允许当前投掷者队友选择目标并保留重复重掷。 | `doctor-strange-lifecycle.test.ts` 四人组队真实命令链覆盖：队友AI合法动作、出牌、当前投掷者骰区选择、同骰两次重掷至6再至5、拒绝对手出牌/操作，最终确认交互关闭、卡入弃牌、CP−1。 | `passed` |
| 12 | `card-surprise` | 掷骰后改变任意1骰数值。 | Strange 真实出牌后将所选骰改为6，断言骰面、CP、弃牌区和交互关闭。 | `passed via shared flow` |
| 13 | `card-me-too` | 至少2骰时，将1骰设为同一掷骰阶段另一骰的数值。 | Strange 真实出牌后按同一投掷中的源骰值修改目标骰，断言最终骰面、CP、弃牌区与交互关闭；锁定骰复制另有共享回归。 | `passed via shared flow` |
| 14 | `card-i-can-again` | 当前玩家进攻投掷阶段可额外重掷至多5骰；奇异博士限定 `offensiveRoll`。 | `doctor-strange-lifecycle.test.ts` 直接以真实进攻骰验证 `offensiveRoll` 放行、`defensiveRoll` 拒绝；公共五骰重掷由共享执行器消费。 | `passed` |
| 15 | `card-give-hand` | 选择对手1骰并强制重掷。 | Strange 在对手确认进攻骰后真实出牌并重掷对手所选骰，断言新骰面、CP、弃牌区和交互关闭。 | `passed via shared flow` |
| 16 | `card-just-this` | 防御投掷阶段重掷至多5骰。 | Strange 在防御阶段真实出牌并重掷自己的防御骰，断言最终骰面、牌区和交互关闭；防御 roll context 另有共享回归。 | `passed via shared flow` |
| 17 | `card-play-six` | 掷骰后将1骰改为6。 | Strange 真实出牌后将所选骰改为6，断言骰面、CP、弃牌区和交互关闭。 | `passed via shared flow` |

#### 共享流程审计资产与逐牌一致性

- 一致性核对与判等依据：18张共享牌是逐项核对的对象全集，不用单张代表替代其余牌。触发时机、费用、候选生成、权限判断、payload、执行入口与清理均见下表；只有显式列出的三项角色配置差异，且分别有角色行为断言。
- 完整单卡与SHA256登记在 `src/games/dicethrone/rule/奇异博士卡牌录入核对.md`；原图和玩家板登记在 `奇异博士真相源表.md`，临时裁图只作reference，正式atlas映射占0–31帧。
- `sharedFlowId`：`dicethrone.common-action-card-resolution`。
- 审计范围：手牌/响应区候选 → UI `PLAY_CARD` → `commandValidation` / `checkPlayCard` 时机、费用与 `playCondition` → `executeCards` 扣费、移牌与效果执行 → `customActions` / 领域事件归约及选择帧 → 权威卡区、资源、骰面或状态 → 交互/响应帧清理；`ai.ts` 的合法动作生成复用同一规则候选。
- 不变量与清理语义：命令 payload 为 `{ cardId }`；费用只扣一次；行动牌从手牌离开并进入弃牌区；骰子/状态/资源效果使用其登记的公共 action；需要选目标或骰子的牌继续等待同一个正式选择/骰子交互完成后才关闭事务；AI候选不得绕过命令验证。共享卡变更对这18个引用对象构成最小重审集。
- 声明差异：本角色独立 atlas slot / preview；`card-next-time` 的 `timing: instant → roll`；`card-i-can-again` 增加 `phase: offensiveRoll`；`card-worthy-of-me` 把 `requireIsRoller` 换成 `requireIsRollerOrTeammate` 并把重掷目标从 `self` 改为 `select`。最后一项扩大了合法操作玩家和目标骰区，不能仅靠配置对照推定行为等价，须由角色专属行为证据覆盖。
- 一致性直接证据：`doctor-strange-lifecycle.test.ts` 对18张牌逐条与 `COMMON_CARDS` 比较，断言 atlas slot，并逐字段应用且仅应用上述三项差异；18张共享牌均有逐牌实际命令链与最终状态断言。扩展共享消费链9文件269/269通过；配置、通用合法性和角色实际效果互相对应。

| `sharedFlowId` / 卡牌 | 时机 / 候选 / 权限 | payload / 执行器 | 最终状态 / 清理 | AI / 自动推进与证据 |
| --- | --- | --- | --- | --- |
| `dicethrone.common-action-card-resolution` · `card-transfer-status` | `main`；主阶段且棋盘有状态；2 CP。 | `{cardId}` → `transfer-status`。 | 所选状态从来源玩家移至目标玩家；两段选择收口，手牌→弃牌。 | Strange 真实出牌后转移一层 Poison，断言双方状态层数、CP和最终卡区。 |
| `dicethrone.common-action-card-resolution` · `card-what-status` | `main`；主阶段且棋盘有状态；2 CP。 | `{cardId}` → `remove-all-status`。 | 所选玩家的状态清空；选择帧关闭，手牌→弃牌。 | Strange 真实选择对手并清除 Poison/Bind，断言两项状态、CP和交互关闭。 |
| `dicethrone.common-action-card-resolution` · `card-one-throw-fortune` | `main`；主阶段；0 CP。 | `{cardId}` → `one-throw-fortune-cp`。 | 单骰结果的一半向上取整加到 CP；骰子选择/结算帧收口，手牌→弃牌。 | Strange 真实 bonus-dice 点数4，CP 2→4，待结算清理且牌入弃牌。 |
| `dicethrone.common-action-card-resolution` · `card-get-away` | `main`；主阶段且棋盘有状态；1 CP。 | `{cardId}` → `remove-status-1`。 | 玩家选择的1个状态移除；目标选择关闭，手牌→弃牌。 | Strange 真实出牌后移除对手一层 Poison，断言状态、CP、卡区与交互收口。 |
| `dicethrone.common-action-card-resolution` · `card-super-double` | `instant`；即时可用；2 CP。 | `{cardId}` → `drawCard(3)`。 | 牌库顶3张进入手牌；无选择帧，手牌→弃牌。 | Strange 真实抽取本角色牌库顶三张，断言顺序、CP和弃牌区。 |
| `dicethrone.common-action-card-resolution` · `card-double` | `instant`；即时可用；1 CP。 | `{cardId}` → `drawCard(2)`。 | 牌库顶2张进入手牌；无选择帧，手牌→弃牌。 | Strange 真实抽取本角色牌库顶两张，断言顺序、CP和弃牌区。 |
| `dicethrone.common-action-card-resolution` · `card-bye-bye` | `instant`；即时且棋盘有状态；2 CP。 | `{cardId}` → `remove-status-1`。 | 移除所选1个状态；目标选择关闭，手牌→弃牌。 | Strange 真实移除自身一层 Poison；响应窗口边界另由 `card-timing-response-boundaries.test.ts` 覆盖。 |
| `dicethrone.common-action-card-resolution` · `card-flick` | `instant`；已有骰面；1 CP。 | `{cardId}` → `modify-die-adjust-1`。 | 所选骰面±1并限制在1–6；骰面交互关闭，手牌→弃牌。 | Strange 真实将骰面1调整至2；锁定骰与roll context另有共享回归。 |
| `dicethrone.common-action-card-resolution` · `card-boss-generous` | `instant`；即时可用；0 CP。 | `{cardId}` → `grant-cp-2`。 | 当前玩家 CP +2；无选择帧，手牌→弃牌。 | Strange 真实出牌后CP 4→6，牌进入弃牌区。 |
| `dicethrone.common-action-card-resolution` · `card-next-time` | Strange `roll`；`afterAttackResolved` 且 `伤害响应类型=beforeDamageReceived`、玩家为受伤目标；1 CP。 | `{cardId}` → 公共 `grantDamageShield(6)`。 | 6点护盾写入受伤者权威状态；手牌→弃牌、CP−1。该 Strange 专项断言到护盾授予，不单独声称该伤害完成最终HP结算。 | Strange 生命周期测试覆盖 AI 选中和出牌结算；共享防伤窗口扩展消费链269/269通过。 |
| `dicethrone.common-action-card-resolution` · `card-unexpected` | `roll`；掷骰后且至少2骰；3 CP。 | `{cardId}` → `modify-die-any-2`。 | 玩家选择2骰并写回骰面；多步交互收口，手牌→弃牌。 | Strange 真实修改两骰为6、5，断言骰面、CP、弃牌区与交互收口。 |
| `dicethrone.common-action-card-resolution` · `card-worthy-of-me` | `roll`；当前投掷者或队友、已掷骰；1 CP；Strange 队友可选择当前投掷者骰区。 | `{cardId}` → `reroll-die-2`（目标 `select`）；骰子交互由队友提交两次重掷。 | 同一骰子由1变6再变5；选择帧关闭、手牌→弃牌、CP−1；对手不能出牌或代操作。 | `doctor-strange-lifecycle.test.ts` 直接覆盖四人组队 AI 合法动作和命令链；`roll-context.test.ts` 覆盖公共骰子上下文。 |
| `dicethrone.common-action-card-resolution` · `card-surprise` | `roll`；掷骰后且存在骰子；2 CP。 | `{cardId}` → `modify-die-any-1`。 | 所选1骰改值；骰子选择帧关闭，手牌→弃牌。 | Strange 真实将所选骰改为6，断言骰面、CP、弃牌区与交互收口。 |
| `dicethrone.common-action-card-resolution` · `card-me-too` | `roll`；当前投掷者、已掷骰且至少2骰；1 CP。 | `{cardId}` → `modify-die-copy`。 | 目标骰复制同次投掷的另一骰结果；选择帧关闭，手牌→弃牌。 | Strange 真实选择源骰并修改目标骰，断言最终骰面和卡区；锁骰复制及负向权限另有共享回归。 |
| `dicethrone.common-action-card-resolution` · `card-i-can-again` | Strange `roll` + `offensiveRoll`；当前投掷者且已掷骰；1 CP。 | `{cardId}` → `reroll-die-5`。 | 至多5颗当前进攻骰重掷并更新骰区；重掷帧关闭，手牌→弃牌。 | Strange 直接边界测试确认进攻投掷放行、防御投掷拒绝；公共重掷流由共享执行器消费。 |
| `dicethrone.common-action-card-resolution` · `card-give-hand` | `roll`；非当前投掷者、对手骰已确认且存在；1 CP。 | `{cardId}` → `reroll-opponent-die-1`。 | 对手所选骰重掷；骰主/目标选择按公共上下文结算后关闭，手牌→弃牌。 | Strange 在对手确认进攻骰后真实重掷其骰，断言新骰面、CP、弃牌区与交互收口。 |
| `dicethrone.common-action-card-resolution` · `card-just-this` | `roll` + `defensiveRoll`；当前防御投掷者已掷骰；0 CP。 | `{cardId}` → `reroll-die-5`。 | 至多5颗防御骰重掷；防御骰子帧关闭，手牌→弃牌。 | Strange 防御阶段真实重掷自己的防御骰；防御 roll context 另有共享回归。 |
| `dicethrone.common-action-card-resolution` · `card-play-six` | `roll`；当前投掷者已掷骰且有骰；1 CP。 | `{cardId}` → `modify-die-to-6`。 | 所选骰设为6；骰子选择帧关闭，手牌→弃牌。 | Strange 真实将所选骰设为6，断言骰面、CP、弃牌区与交互收口。 |

此表把每张共享牌的时机、候选条件、权限/费用、命令 payload、执行器、最终状态、清理与 AI 消费点逐行对应。18张牌均由奇异博士真实领域命令链逐牌验证；这不等于18张牌逐张跑过浏览器真实玩家 E2E。

### 奇异博士专属行动牌（5）

| Atlas | 卡牌 ID | 原子语义 | 实现消费与直接最终状态证据 | 结论 |
| ---: | --- | --- | --- | --- |
| 27 | `card-strange-see-the-future` | 主阶段获得2预感。 | `premonition-two`；角色生命周期测试断言资源与卡区最终值。 | `passed` |
| 28 | `card-strange-icy-tendrils` | 花费1 CP 投2骰：曼荼罗+1攻击伤害、魔法书施放1法术、斗篷+2伤害、护身符施加1深红系带。 | `tendrils`；生命周期测试断言骰面、伤害、状态、资源及卡区。 | `passed` |
| 29 | `card-strange-shield-of-seraphim` | 仅受攻击且伤害前可打；花费1 CP 投2骰，依骰面防止1/2/3伤害或获得1预感。 | `shield` + `beforeDamageReceived`；生命周期测试断言减伤和预感。 | `passed` |
| 30 | `card-strange-cast-away` | 投掷阶段施放1个法术。 | `cast-one`；生命周期测试断言法术去向、资源和攻击操作帧续接。 | `passed` |
| 31 | `card-strange-time-loop` | 即时花费2 CP，指定一名玩家获得1枚即视感。 | `grant-deja-vu`；生命周期测试断言目标、资源与 Token。 | `passed` |

## 玩家板技能与状态

| 对象 | 原子语义/最终状态 | 当前直接证据 | 结论 |
| --- | --- | --- | --- |
| 预兆 | 两魔法书+两护身符；造成8点攻击伤害前先获得即视感。 | 玩家板骰面和生命周期专项断言先核对即视感已授予、攻击仍待结算且预期伤害为8，再核对HP与攻击结算为8点。 | `passed` |
| 宇宙感知 | 四魔法书；牌桌内真实操作抽牌、目标选择和法术准备。 | 桌面及812×375手机横屏两条链、10张图均通过；卡区/CP由trace与Vitest断言。 | `passed` |
| 维山帝之书 | 被动准备区占物理被动槽，满足阶段/每回合限制。 | 法术区组件、HandArea 费用 UI 和资源/卡区测试。 | `passed` |
| 星际侵入 | 四类奖励骰按最终骰面追加伤害/状态。 | 真实确认奖励骰的E2E链；奖励骰已确认后仍处于伤害前阶段，trace未宣称伤害已结算。 | `passed` |
| 秘术雷击 | 小顺子6伤、大顺子9伤；主攻击伤害后可施放1法术。 | 生命周期专项断言两分支伤害和 postDamage 法术帧。 | `passed` |
| 瓦图姆魔杖 | 四护身符；攻击不可防御，伤害后准备法术。 | 生命周期专项断言目标、不可防御、准备区与攻击后流程。 | `passed` |
| 束缚术 | 两曼荼罗+两斗篷；对手获得深红系带。 | 骰面和状态生命周期专项断言。 | `passed` |
| 悬浮斗篷 | 防御两骰，按结果减伤/反击/获得状态。 | 生命周期专项覆盖目标路由、攻击者/自身 HP 和一次防御推进后的收口。 | `passed` |
| 全知之眼 | 五护身符触发不可防御10伤；顶五最多准备两张不同法术、重排余牌并可施法。 | 7步真实鼠标 E2E链和专项最终伤害/法术区域断言。 | `passed` |
| 预感 | 收入阶段可不使用、花1抽2、花3抽3；仅从本次抽牌选择返顶/底。 | 法术系统断言数量、候选隐私、返还位置；E2E覆盖花3抽3并放牌库底。 | `passed` |
| 即视感 | 攻击掷骰后可结束本阶段并以清理后的状态重新投掷。 | lifecycle测试断言Token消耗、次数归零与阶段状态；真实token点击E2E通过。 | `passed` |
| 深红系带 | 受影响玩家下次进攻流程受牌限制；获得回合延迟激活，完整投掷流程后清理。 | lifecycle负向路径覆盖角色牌阻止、targeting/defense阶段不提前清理；E2E覆盖真实对手状态施加。 | `passed` |

## 验证与证据

| 检查 | 结果与证据 | 直接边界 |
| --- | --- | --- |
| 12文件规则/共享/UI回归 | `verification/doctor-strange-regression-current-20261026-closeout.log`：249/249，源码前后为 `e56782a9…`。 | 包含生命周期59、跨英雄74、18张共享牌及伤害账本组合；不等于全量游戏测试。 |
| 后续增量回归 | `verification/doctor-strange-incremental-tests-20261026-closeout.log`：4文件80/80（59+15+4+2）。 | 当前角色生命周期、法术、角色目录及手牌法术费用。 |
| 同端口真实E2E | `verification/doctor-strange-e2e-final-current-20261026-run14.log`：9/9；`verification/doctor-strange-online-entry-current-20261026-final.log`：最新入口1/1。 | 均使用6174/20000/21000；运行前后源码与runtime一致、后端输入匹配。 |
| 截图与行为包 | `evidence/dicethrone/doctor-strange-real-entry-20261026-closeout/`：42图、9trace、逐图审查及内部索引合同通过。 | 图面仅证明操作目标、布局和反馈；数值由trace/Vitest证明。八条规则链内部初始化，联机链正式入口。 |
| 目标ESLint | `verification/doctor-strange-eslint-current-20261026-run1.log`，增量 `verification/doctor-strange-eslint-20261026-closeout.log`。 | Doctor Strange实现、相关测试及HandArea；0错误，HandArea保留1条无必要hook依赖警告；不声明全仓lint。 |
| production build | `verification/doctor-strange-build-current-20261026-closeout.log`：退出0，6115模块，2m10s；后续改动按影响记录。 | 打包通过；保留既有CSS优化、导入和chunk大小警告，不代替TypeScript全检。 |
| OpenSpec/spec lint/审计自检 | `verification/doctor-strange-openspec-strict-20261026-closeout.log`、`verification/doctor-strange-spec-lint-20261026-closeout.log`、`verification/doctor-strange-audit-selfcheck-20261026-closeout.log`。 | 关闭记录后重跑；仅证明对应文档结构与证据合同。 |
| 最新全仓TypeScript | `verification/doctor-strange-typecheck-20261026-final.log`：失败，4859条诊断/2695项去重/325文件；DiceThrone331项/62文件，Doctor Strange命名路径0项。 | 源码前后均为 `2a7d7b50…`。改动坐标交集仅天使两处；详见 attribution-20261026-final.json，坐标归属不等于因果证明。 |
| 最新全仓i18n | `verification/doctor-strange-i18n-20261026-final.log`：失败，Treant英文2缺键、7处locale结构缺项，109条警告。 | 同一 `2a7d7b50…` 快照；未见奇异博士缺键。 |
| 最新全仓资源 | `verification/doctor-strange-assets-20261026-final.log`：失败点仍是共享 `common/audio/registry.json` 的hash/bytes；角色manifest定向复核见 `verification/doctor-strange-assets-dicethrone-20261026-final.log`。 | 同一源码快照；保留全仓失败状态，不修改共享音频对象。 |
| 全仓TypeScript历史残余 | `verification/doctor-strange-typecheck-current-20261026-run3.log`：在 `cd6a41a8…` 失败，4872诊断/2653去重项/328文件；DiceThrone320项/62文件、Doctor Strange命名路径0项。 | 历史诊断数量不冒充当前数量；归属JSON仅有两处改动坐标交集，均为天使文件，坐标相交不证明因果。 |
| 全仓i18n历史残余 | `verification/doctor-strange-i18n-current-20261026-run3.log`：Treant英文2缺键、7处locale结构缺项及107警告，GameHints动态键已修复。 | 该源码快照未见Doctor Strange缺键；不声明当前全仓i18n通过。 |
| 资源校验/远端回查 | root与DiceThrone定向manifest日志run2通过；全仓assets run3在共享 `common/audio/registry.json` hash/bytes失败。12个角色资源远端HTTP200且同源的10月25日回查保留。 | 本地资源映射和当时公开对象；不证明已部署最新代码。 |

### 当前源码归属与增量验收

- 牌桌全运行 `e2e-1792997531872-feplm0`：前端与runtime均为 `4b2f9c85ee2bc6a7498f1b2a5109be4de5afd81d611d77839d6b45f1335824ae`；后端输入匹配。E2E文件摘要为 `8280dad9d916b668d4c4b5c4e85c64e7689cc6627696f932bf50a4aadca1528d`。
- 最新正式双人链 `e2e-1793019370902-ksuvti`：前后源码与runtime均为 `01e88285a349eb3ef26d165915024fccf39ed815e3981b02827dd9b0cc65cc4b`，后端输入匹配；入口范围摘要前后均 `3f08db77d48594973b062cce4e65facbd280be133d0135f3f2834336690350a6`。记录：`verification/doctor-strange-online-runtime-identity-20261026-final.json`。
- `verification/doctor-strange-source-scope-20261026-closeout.json`保存牌桌依赖逐文件摘要。之后首页两份CSS已用最新联机入口补验；GameHUD新增七大恨教程横屏分支在本角色不成立，TutorialOverlay只影响活跃教程，engine/types变更为擦除的接口字段。各文件前后SHA和理由见 `verification/doctor-strange-incremental-impact-20261026-final.json`；未将未知变化笼统视为通过。
- 音频精简索引属于生成资源映射，不参与上述规则/交互断言；后续生产打包覆盖其读取。其它游戏专属源码和语言包不属于本角色范围。独立链各自保持截图、trace、sourceRun和sourceRevision一致，不宣称九链来自同一次运行。
- 视觉边界：常规手牌扇形延伸至底缘，未遮挡本链目标；队友骰悬停预览可覆盖禁用确认区，移至骰子后主动确认入口可见；旋转骰截图不证明最终数值；联机开局手牌仍可能翻转，本链不证明发牌动画完成。

## 新交互覆盖矩阵

下列路径均相对当前证据包。42张图与9条trace完整保留。

| 交互 | 图数 | 直接行为与证据 | 边界 |
| --- | ---: | --- | --- |
| 正式双人选角开局 | 7 | 建房、房主奇异博士、客人武僧准备、开局与各自玩家板；`traces/online-selection-and-start.trace.json` | 真实入口；最新首页补验。 |
| 宇宙感知桌面 | 5 | 技能、弃牌法术、目标及准备区；`traces/awareness-desktop.trace.json` | 内部初态后真实鼠标。 |
| 宇宙感知手机横屏 | 5 | 812×375同链；`traces/awareness-mobile.trace.json` | 内部初态后真实鼠标。 |
| 即视感 | 3 | 悬停说明、点击并重新投掷；`traces/deja-vu.trace.json` | 内部初态。 |
| 预感收入 | 4 | 花3抽3、选择返还并放底；`traces/premonition-income.trace.json` | 数值由trace断言。 |
| 全知之眼 | 7 | 顶五准备、目标、排序、施法并结束；`traces/all-seeing-eye.trace.json` | 内部初态。 |
| 星际侵入 | 4 | 奖励骰与真实确认；`traces/astral-invasion.trace.json` | 确认后仍在伤害前，最终伤害由领域测试覆盖。 |
| 深红系带 | 3 | 手牌施法、目标和对手状态；`traces/crimson-bands.trace.json` | 内部初态。 |
| 四人队友骰 | 4 | 真实拖牌、选队友两骰、确认与弃牌；`traces/worthy-teammate.trace.json` | 四人组队初态注入；重复重掷/AI另有单测。 |

## 本轮独立审计发现与修复

- **P1：攻击后施放的增伤法术未落入正式HP。** 大顺子先提交9点伤害并进入 `攻击后法术选择帧`；随后法术只产生 `BONUS_DAMAGE_ADDED`，reducer 只把1点写入 `待结算攻击的增伤字段`。攻击结束时实际净伤害仍为9，新增修正随 `待结算攻击` 清理丢失。修复后，法术事件明确标注 `applyToResolvedAttack`，Dice Throne 共享事件系统经伤害计算原语生成增量 `DAMAGE_DEALT`，再由正式 reducer 消耗护盾、更新HP和本次攻击 `resolvedDamage`。完整管线回归覆盖法尔特之焰+1、法瑞拉之牙+3、艾坎之形+4，并断言HP、`lastResolvedAttackDamage`、卡区和帧清理。
- **P1：百分比减伤下攻击后增伤被全额追加。** 主攻击9经眩光减半后应结算5；若攻击后再施放+3法术，新增伤害应为 `ceil((9+3)×0.5)-ceil(9×0.5)=1`，旧处理却将3全额结算。现保存本次攻击百分比步骤前的累计基数，并严格复用主攻击的向上取整后只结算净差额；缺失基数时显式暴露不变量错误。回归覆盖眩光和蜘蛛感应下三种增伤（+1/+3/+4）及眩光+3增伤+固定护盾组合，断言最终HP与攻击账本。
- **P1：主伤害被防御响应减为0后，攻击累计基数丢失。** 眩光大顺子主伤害9经减半为5，守护合法消耗后降到0；因为正伤害路径不会发出 `DAMAGE_DEALT`，随后施放法尔特之焰原会因缺少百分比前基数抛错。现在 Token 响应关闭时，仅在主攻击、非完全闪避且最终伤害为0的路径保存 `attackDamageBeforePercent`；后置增伤仍经累计差额计算，回归断言守护后的HP不变、攻击伤害为0、法术打出且攻击正常结束。
- **P1：守护减伤未延续到同次攻击的后置法术。** 主伤害响应正确把眩光+守护降为0，但攻击记录未保存守护次数与眩光半伤语义，较大的后置法术会绕过这次响应额外扣血。现在主攻击关闭 Token 响应时保存 Protect 使用次数和眩光半伤标记；增伤按整次攻击累计基数先算百分比，再应用一次守护减半，眩光与守护或两次守护仍为0。回归覆盖完全免伤下+1/+3/+4法术，以及无眩光时主伤害9经守护减至4、施放+3后总伤害6的部分减伤路径。
- **P1：固定护盾+守护下，后置法术累计伤害多1点。** 雷击9、固定盾1、Protect1时主伤害为4；法瑞拉之牙+3应按整次攻击重算为5点总伤害，追加量为1。旧逻辑只复用Protect次数，未保存已提交护盾，按 `floor(12/2)-floor(9/2)` 多追加1点，最终HP44/总伤害6。现在主攻击记录实际提交的百分比护盾与固定护盾吸收量，后置增伤按百分比修正、已提交护盾、Protect顺序重新计算累计净差额；新回归断言最终HP45、总伤害5、法术增量1且该盾只消费一次。
- **P1：单独百分比护盾未触发后置法术累计重算。** 雷击9被50%护盾减为4后，法瑞拉之牙+3应按整次攻击重算：12点经50%护盾减为6，追加量为2。旧逻辑虽已保存护盾快照，却只在攻击百分比修正或Protect存在时进入重算；因此把+3全额追加，错误结果为HP43/总伤害7。现将已提交护盾快照也纳入重算入口；无Token响应的正式攻击回归断言HP44/总伤害6、追加2点、护盾清空且来源只消费一次。
- **P1：第一张后置法术覆盖主攻击护盾快照，连续施法丢失百分比减伤。** 瓦图姆魔杖5点主伤害遇50%盾+固定盾5时，主命中提交百分比减伤3、固定吸收2，剩余固定盾3。后置法尔特之焰+1再消耗固定盾1；旧 reducer 因无Token响应时 `damageResolved` 仍为 false，把该增量误当主伤害并将快照覆盖为“固定吸收1”，后续法瑞拉之牙+3便绕开50%减伤，复现HP49/总伤1。现只在携带 `attackDamageBeforePercent` 的主伤害事件建立一次护盾快照，追加伤害不能覆盖；真实连续施法回归断言最终HP50、总伤0、两个增量各1、百分比盾只记录一次且固定盾累计吸收4。
- **P2：两行法术审计语义错误。** 瓦尔托尔之汽是治疗任意英雄1点；墨菲斯之雾准备时指定玩家获得即视感、施放时治疗任意英雄3点。测试现在明确选择对手并分别核对两名玩家的HP/状态，审计表已同步锁定合同。
- **漏审原因：** 旧测试验证了法术时机和中间事件，却没有断言最终HP、百分比修正后的总伤害与归零响应后的累计基数；初轮 Protect 回归未组合固定盾与响应，百分比盾快照虽已保存但单盾组合未触发重算，后置增量又可覆盖无 Token 主伤害快照；目标选择测试默认取第一个候选，无法证明“任意英雄”。

### 响应事务生命周期证据

- 攻击后法术选择窗口打开前，主攻击的已提交结果由正式伤害事件保留；完整管线先投掷、确认、选技能、推进及防御，再处理法术选择，避免把主伤害和追加量分别当作两次攻击。
- 窗口内新增效果为法术产生的攻击增量，复用同一事务累计投影、主攻击护盾提交记录和Protect次数；固定盾+Protect测试断言追加伤害1点、总伤害5点、最终HP45且盾只消费一次；单独50%盾测试断言追加2点、总伤害6点、HP44。
- 窗口关闭后的最终权威状态与清理：守护叠加眩光的三种增伤测试断言HP50、总伤0、攻击帧清空、Token消费及法术最终卡区；所有路径阶段可继续到main2，流程收口。连续施法测试核对百分比盾仅一次、固定吸收累计4及两张法术去向。直接断言见 doctor-strange-lifecycle.test.ts:1030、1083、1109、1135，均纳入本次80项增量回归。

### 同类扩审与漏审归因

- **横向搜索范围：** 以 `BONUS_DAMAGE_ADDED`、`applyToResolvedAttack`、`attackDamageBeforePercent`、`mainAttackShieldPreventions`、`tokenResponseProtectUses`、`shieldsConsumed`、`reductionPercent`、`DAMAGE_DEALT`、`handleTokenResponseClosed` 和 `commitDiceThroneDamagePrevention` 搜索 postDamage 伤害、攻击账本、响应消费和固定/百分比护盾消费者。
- **命中项与处理：** 命中共享 `systems.ts` 的后置伤害差额计算、`reduceCombat.ts` 的 Token 响应收口与正式HP归约、`damagePreventionCommit.ts` 的百分比/固定护盾提交，以及 `待结算攻击类型` 伤害快照。当前修复落在共享消费链，不只覆盖奇异博士；12文件定向回归249/249、扩展共享消费链269/269、宽共享回归308/308均通过。
- **残余扩审范围：** 18张共享行动牌均已补奇异博士实际命令链和最终状态断言；全量 Dice Throne 测试与生产部署不属于本轮直接验证；本地正式双人选角已单独验证。
- **漏审归因：** 旧测试断言过窄，并且证据停在中间态/分开的组合：只测单次 Protect、眩光与护盾等部分组合，没有组合已提交固定盾+Protect+postDamage增伤并断言最终HP、攻击总账和盾消费数；汽/雾测试默认第一个候选，也没有验证任意英雄的对手目标。

## 缺口与最小补救

| 条目 | 当前裁定 | 剩余动作 |
| --- | --- | --- |
| 角色实施、对象审计、九链及42图 | 本范围通过；完成态已验证，无未处理P1/P2。 | 无。 |
| 全仓TypeScript/i18n/共享音频manifest | 保留上述最新失败、历史结果与精确归属，不将历史数量表述为当前结果。 | 由对应全仓任务处理；不扩大本派系修改范围。 |
| 全量游戏测试、教程、线上部署及用户查看器 | 本次未做，也不在本次通过声明内。 | 如单独提出对应目标，再按专项流程执行。 |

## 当前裁定

本派系当前代码验证口径已收口：32张实体卡、9个玩家板槽位及3种状态完成实施与对象审计，独立复审发现的七项攻击P1和两条法术语义问题均有修复与回归，本范围无未处理P1/P2。角色正常可选，已移除实施中标记。12文件回归249/249通过，随后角色/法术/目录/手牌费用增量回归80/80通过；两次运行分别记录，不相加。九条独立行为链、42张截图完成验收；8条牌桌链由内部初始化后使用真实鼠标操作，另1条由正式建房入口完成双人选角和开局。全仓TypeScript、i18n及共享音频清单的最新失败与历史结果均保留，不声称全仓通过。未提交、推送或部署。

## 2026-10-27 交互截图交付

- 本轮补交奇异博士真实交互整屏截图：42张、9条独立行为链，桌面和手机横屏覆盖法术准备、施放、预感、即视感、奖励骰、队友骰及正式双人选角。实际运行来源、每条截图与行为记录的关联、源代码范围及逐图审查均保存在 evidence/dicethrone/doctor-strange-ui-delivery-20261027/。
- 图审发现法术选择弹窗截图截在淡入过程、即视感说明遮住另外两个状态标记；前者通过等待实际动画结束重拍，后者由状态组边界定位说明，实测标记及资源可见。九链全跑和受后续变化影响的两链补跑均通过；提示框和侧栏11项、骰子交互7项、角色80项回归分别通过。
- 准备区三张牌的场景，截图只直接显示前两张；奖励骰和开局手牌的运动由截图记录到对应画面，单帧不证明动作完成或最终骰值。截图供用户查看，并未声称用户已验收完整视觉设计。
- 已注册本地查看器 http://127.0.0.1:4867/?key=8a9a4b634a92，目录索引、42张图和中文步骤经查看器接口核对。
