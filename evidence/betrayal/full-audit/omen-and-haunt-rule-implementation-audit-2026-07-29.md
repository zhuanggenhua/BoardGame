# 小黑屋预兆与作祟公共规则实现审计（2026-07-29）

> 2026-07-29 接续边界：本文件是预兆逐卡效果与作祟公共规则的下游实现消费索引，只消费 `full-deck-data-intake-contract.md` 已锁合同和当前只读代码/测试证据；它不能替代整牌库 74 张对象全集主合同，也不能授权 Board/UI、E2E、截图或“整牌库完成”宣称。后续引用本文件时，必须同时保留 `min-domain-verified / partial-ui / downstream-open` 口径。

## 审计范围

本文件只审 `src/games/betrayal` 当前 9 张预兆牌和作祟公共规则的实现消费情况。范围包括：书本、狗、面具、头骨、圣符、盔甲、雕像、指环、匕首，以及抽到预兆后的作祟检定、全员当前持有预兆总数、5+ 作祟、最多 8 骰、最后一张预兆自动作祟、作祟翻牌确认队列。

本文件不重新 OCR、不卡图、不查 Wiki、不新增牌效或作祟玩法实现。若发现合同缺失或版本冲突，只登记为 `blocked/disputed`，不在审计阶段现场补录规则。

## 结论等级

结论等级：`omen-haunt-rule-matrix-indexed / min-domain-verified / downstream-open`。

含义：9 张预兆已经进入当前运行池，逐卡有 L1 结构入口和一批 L2 领域代表链；作祟公共规则已经有全员预兆数、抽新预兆骰数、8 骰上限、普通作祟触发和最后一张自动作祟的领域证据。仍不能宣称“9 张预兆逐卡 UI/组合完成”或“作祟揭示/UI/E2E 完成”。

## 权威来源

| 类型 | 当前来源 |
| --- | --- |
| 对象全集 | `evidence/betrayal/full-audit/full-deck-data-intake-contract.md` 第 5 节与 6.14；`evidence/betrayal/full-audit/object-l0-l4-matrix.md` |
| 运行池配置 | `src/games/betrayal/scenarioConfig.ts` 的 `initialDeckCounts.omen = 9` 与当前 9 张预兆池 |
| 主动使用定义 | `src/games/betrayal/possessionEffects.ts` 的 `POSSESSION_USE_EFFECTS` |
| 领域消费 | `src/games/betrayal/game.ts` 的预兆数、作祟风险、抽预兆检定、作祟触发、持有物能力、攻击武器、死亡保护、交易、探索声明等消费链 |
| 页面承接 | `src/games/betrayal/Board.tsx` 的持有物说明、持有物动作入口、作祟风险状态和进度条 |
| 测试证据 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`、`src/games/betrayal/__tests__/Board.foundation.test.tsx` |

## 逐项结论

### 9 张预兆

| 预兆 | 规则/效果桶 | 当前实现消费 | 证据等级 | 残余范围 |
| --- | --- | --- | --- | --- |
| 书本 | 知识检定 +1；每回合一次花 1 神志，让下一次非战斗检定可用知识替代 | `POSSESSION_USE_EFFECTS` 记录主动模式 `nextNonCombatTraitReplacement`；领域测试覆盖神志成本、每回合一次、非战斗限定、战斗不消费和临界神志不可免费使用；Board 持有物说明显示知识加成，组件代表链覆盖使用后禁用和神志不足提示 | `L1/L2 + Board component representative / partial-ui` | 仍需补真实 Playwright / 截图链、更多非战斗检定消费者、房间检定、作祟特殊行动检定和重掷 / 替代消费者组合。 |
| 狗 | 速度检定 +1；每回合一次与 4 格内玩家交易任意数量物品或预兆，同意后结算 | 领域测试覆盖狗交易 pending、同意结算、二次使用拒绝、交易状态区分和已用牌限制；Board 组件代表链覆盖狗交易候选区、多张牌选择、4 格目标高亮、灰尘交换疾病冲突、已用牌禁用原因，以及预兆经狗交易结算后风险条仍显示全员预兆总数。 | `L1/L2 + Board component representative / partial-ui` | 仍需补真实 Playwright / 截图链、更多距离边界、死亡/搜尸/作祟状态组合、收到牌本回合使用限制 UI。 |
| 面具 | 速度检定 +1；每回合一次把同房其他探索者和怪物移到相邻已发现房间 | `POSSESSION_USE_EFFECTS` 记录主动模式 `moveOthersInRoom`；领域测试覆盖不能发现新房间、移动探索者/怪物、多目标分别指定方向、每回合一次；Board 组件代表链覆盖真实页面给同板块队友和怪物分别选择相邻板块。 | `L1/L2 + Board component representative / partial-ui` | 仍需补真实 Playwright / 截图链、死亡目标、怪物回合和作祟怪物组合。 |
| 头骨 | 知识检定 +1；死亡前投 3 骰，4+ 阻止死亡并把属性调到濒死，0-3 正常死亡 | 领域测试覆盖成功阻止死亡、失败死亡、兔脚重掷死亡保护；灰尘作祟中另有致死与掩埋组合代表链；Board 组件代表链覆盖攻击伤害分配进入死亡保护后显示 3 骰骰盘、4+ 阻止死亡和头骨反馈。 | `L1/L2 + Board component representative / partial-ui` | 仍需补真实 Playwright / 截图链、更多致死来源、作祟终局和遗物掩埋组合。 |
| 圣符 | 神志检定 +1；探索时可埋葬第一张板块并继续探索；本回合刚获得不可用 | 领域测试覆盖神志加成、埋葬房间并继续发现、不结算第一张效果、无圣符或刚获得时拒绝；Board 组件代表链覆盖探索声明按钮、连续事件房间中先埋葬第一张再继续发现下一张，以及刚获得时页面不显示圣符声明按钮 | `L1/L2 + Board component representative / partial-ui` | 仍需补真实 Playwright / 截图链、更多房间/事件/作祟探索消费者、更多牌堆顺序组合。 |
| 盔甲 | 受到物理伤害 -1；不阻挡通用伤害或直接属性降低 | 领域测试覆盖物理伤害减免、直接力量降低不被挡、通用伤害不被挡；特殊行动预算确认不是主动使用牌；Board 组件代表链覆盖伤害分配页显示原始物理伤害、盔甲减免和实际分配数。 | `L1/L2 + Board component representative / partial-ui` | 仍需补真实 Playwright / 截图链、更多物理伤害来源、死亡保护和作祟伤害消费者。 |
| 雕像 | 力量检定 +1；发现事件符号房间时可选择不抽事件 | 领域测试覆盖跳过事件且不结算事件效果、力量检定 +1、无雕像或非事件符号房间拒绝；Board 持有物说明显示跳过事件提示；Board 组件代表链覆盖探索声明按钮、圣符埋葬后仍可对下一张事件符号房间声明雕像跳过，以及刚获得时页面不显示雕像声明按钮 | `L1/L2 + Board component representative / partial-ui` | 仍需补真实 Playwright / 截图链、更多事件牌堆顺序、作祟探索和无事件符号拒绝 UI 边界。 |
| 指环 | 神志检定 +1；攻击时显式选择，双方改用神志对攻并造成精神伤害 | 攻击武器状态把指环登记为武器；领域测试覆盖显式使用、精神伤害、未声明不自动生效、交易限制；Board 持有物说明显示神志武器语义；Board 组件代表链覆盖攻击入口选择指环、目标高亮、等待精神伤害分配和已用禁用原因。 | `L1/L2 + Board component representative / partial-ui` | 仍需补真实 Playwright / 截图链、怪物目标、多武器互斥、作祟攻击和未声明不自动生效消费者。 |
| 匕首 | 攻击时显式选择，失去 1 速度并额外投 2 骰，造成物理伤害 | 攻击武器状态把匕首登记为武器；领域测试覆盖显式使用、速度成本、额外骰、未声明不自动生效、交易限制；Board 持有物说明显示武器语义；Board 组件代表链覆盖攻击入口选择匕首、目标高亮、等待物理伤害分配和刚获得禁用原因。 | `L1/L2 + Board component representative / partial-ui` | 仍需补真实 Playwright / 截图链、速度濒死/死亡保护、多武器互斥和怪物目标消费者。 |

### 作祟公共规则

| 公共规则 | 当前实现消费 | 证据等级 | 残余范围 |
| --- | --- | --- | --- |
| 全员当前持有预兆总数 | `resolveBetrayalOmenCount` 按所有探索者当前 inventory 中的预兆求和，不只看当前玩家；Board 组件代表链覆盖狗交易把书本移出当前玩家后，风险条仍显示全员总预兆数。 | `L2 + Board component representative / partial-ui` | 死亡掉落、遗物转移、搜尸和更多作祟状态风险 UI 消费者仍需继续审。 |
| 抽到预兆后的作祟检定 | `resolveHauntRoll` 仅在作祟前且抽到预兆时生成；骰数读取风险读模型，最近投骰记录为 `hauntRoll`。 | `L2 + partial-ui` | 作祟检定 UI、骰盘展示和翻牌揭示 UI 尚未逐项闭合。 |
| 5+ 开始作祟 | 作祟检定总点数达到阈值时写入作祟状态、触发预兆、剧本卡、揭秘者、叛徒/首行动玩家裁定。 | `L2 + representative-only` | 木乃伊当前运行触发牌与旧版「女孩」合同存在版本冲突，仍保持 `disputed / representative-only`。更多剧本入口未完成。 |
| 最多 8 骰 | 风险读模型通过 `normalizeBetrayalDiceCount` 把下次投骰数量限制到 8；领域测试覆盖 9 个预兆时仍只投 8 颗骰。 | `L2 + partial-ui` | 风险 UI 的超 8 组合和完整骰盘展示仍需补。 |
| 最后一张预兆自动作祟 | 当预兆堆剩余 1 张且作祟未开始，抽到该预兆时不靠点数，直接自动触发作祟。 | `L2 + partial-ui` | 最后一张经交易/死亡掉落/强制搜牌后的组合扩审，以及自动作祟 UI 尚未闭合。 |
| 翻牌确认队列 | 作祟触发后 `pendingCardResolutionQueue` 同时保留抽到的预兆和作祟检定确认；确认前拒绝继续移动。 | `L2 + partial-ui` | 真实 Board 翻牌确认 UI 与完整截图链仍需补。 |
| 作祟风险进度条 | Board 常驻 `betrayal-haunt-risk-status` 与 `betrayal-haunt-risk-progress`，显示总预兆数、下次骰数、阈值和进度百分比。 | `L3 component / partial` | 组件测试证明页面组件可见，不等于真实探索抽预兆到作祟揭示的 E2E 完整链。 |

## 验证证据

| 检查 | 结果 |
| --- | --- |
| 9 张预兆结构入口 | `firstScenarioRuntime.test.ts` 中“当前 9 张预兆牌均登记真实能力入口而不是只登记翻牌确认”覆盖主动使用、攻击武器、圣符探索、雕像跳过事件的入口矩阵。 |
| 书本、狗、面具、头骨、圣符、盔甲、雕像、指环、匕首领域代表链 | `firstScenarioRuntime.test.ts` 已覆盖各自至少一条领域行为链和部分负向路径；书本、狗、面具、头骨、圣符、盔甲、雕像、指环、匕首已另补 Board 组件代表链，但仍不能外推为 9 张预兆 UI / 组合完成。 |
| 作祟公共规则领域链 | `firstScenarioRuntime.test.ts` 覆盖交易转移预兆后总数不变、抽新预兆骰数与读模型一致、8 骰上限、普通预兆触发作祟、最后一张预兆自动作祟、翻牌确认队列。 |
| 作祟风险页面组件 | `Board.foundation.test.tsx` 覆盖 `data-omen-count=3`、`data-next-dice-count=4`、`progress=38` 和展示文案“预兆 3 / 下次掷 4 颗 / 5+ 作祟”；新增狗交易组件代表链覆盖书本经狗交易移出当前玩家后，风险条仍为 `data-omen-count=2`。 |
| 本轮新增验证 | 书本已新增领域与 Board 组件代表链：`firstScenarioRuntime.test.ts -t "书本"` 13 passed / 682 skipped；`Board.foundation.test.tsx -t "书本\|真实 reducer 驱动下可以使用物品"` 2 passed / 136 skipped；狗已新增 Board 组件代表链：`Board.foundation.test.tsx -t "狗"` 4 passed / 135 skipped；`firstScenarioRuntime.test.ts -t "交易转移预兆\|狗每回合\|交易卡状态\|狗交易沿用"` 4 passed / 691 skipped；面具已新增 Board 组件多目标选择代表链：`Board.foundation.test.tsx -t "面具"` 3 passed / 139 skipped；头骨已新增 Board 组件死亡保护代表链：`Board.foundation.test.tsx -t "头骨"` 1 passed / 141 skipped，`firstScenarioRuntime.test.ts -t "头骨"` 214 passed / 481 skipped；指环 / 匕首已新增攻击武器 Board 组件代表链：`Board.foundation.test.tsx -t "匕首\|指环\|攻击武器选择区"` 3 passed / 139 skipped，`firstScenarioRuntime.test.ts -t "匕首\|指环"` 26 passed / 669 skipped；圣符 / 雕像已新增探索声明 Board 组件代表链：`Board.foundation.test.tsx -t "圣符\|雕像"` 3 passed / 137 skipped；`firstScenarioRuntime.test.ts -t "圣符\|雕像"` 22 passed / 673 skipped；盔甲已新增 Board 组件减伤提示代表链：`Board.foundation.test.tsx -t "盔甲"` 1 passed / 140 skipped；`firstScenarioRuntime.test.ts -t "盔甲"` 12 passed / 683 skipped；相关 ESLint 0 errors，Board 组件测试尾部仍有既有 `ECONNRESET` 噪声但退出码为 0。未跑真实 Playwright / 截图链。 |

## 测试语义对账

| 对象/规则 | 测试断言证明的最终状态 | 旧测试失效检查 |
| --- | --- | --- |
| 书本 | 使用后 `usedCardIdsThisTurn` 记录书本、当前神志减少、`nextNonCombatTraitReplacement` 写入知识替代；战斗对攻后该替代状态仍保留；神志临界时校验拒绝使用且不写入替代状态。 | 旧测试未覆盖临界神志成本，现已补领域负向断言；Board 组件代表链已补使用后禁用和神志不足提示，但仍不是真实 Playwright / 截图证据。 |
| 狗 | 发起后进入 `pendingTradeAgreement`，同意后双方 inventory 真实转移，狗进入 `usedCardIdsThisTurn`，二次狗交易被拒绝；Board 组件测试证明候选区、4 格目标高亮、等待同意、灰尘交换疾病冲突、已用牌不可选、狗交易预兆后风险条继续按全员总数显示。 | 旧领域测试未失效；本轮补上 Board 组件代表链并修正灰尘 Board 夹具缺事件房导致的前置失败，但仍不是真实 Playwright / 截图证据。 |
| 面具 | 使用后同房其他探索者和怪物的 `roomId` 变成指定已发现相邻房间，当前玩家不移动，面具保留在持有区且进入已用列表；Board 组件测试证明真实页面可为队友和怪物分别选相邻目标板块。 | 旧领域测试未失效；Board 组件代表链已补多目标选择，但仍不是真实 Playwright / 截图证据，也不证明怪物回合 UI、死亡目标过滤或作祟怪物组合。 |
| 头骨 | 致死伤害分配后成功路径不进入死亡列表并把属性调到濒死；失败路径进入死亡列表；兔脚重掷能改变死亡保护结果；Board 组件测试证明死亡保护骰盘、4+ 成功反馈和头骨结果会显示到页面。 | 旧领域测试未失效；已有灰尘组合代表链和 Board 组件代表链，但仍不能外推到所有致死来源、作祟终局、遗物掩埋或真实截图链。 |
| 圣符 | 探索时使用圣符会埋葬第一张房间、继续发现下一张且不结算第一张效果；无圣符或本回合刚获得时命令非法；页面组件中刚获得时不会显示圣符声明按钮。 | 旧领域测试未失效；Board 组件代表链已补探索声明和刚获得限制，但仍不是真实 Playwright / 截图证据。 |
| 盔甲 | 物理伤害最终扣减减少 1；直接属性降低和通用伤害不被盔甲拦截；Board 伤害分配页能显示原始物理伤害、盔甲减免和实际分配数。 | 旧领域测试未失效；Board 组件代表链已补减伤提示，但仍不是真实 Playwright / 截图证据，也不证明更多物理伤害来源、死亡保护或作祟伤害消费者闭合。 |
| 雕像 | 使用雕像探索事件符号房间时不抽取、不结算事件且事件弃牌数不增加；力量检定路径最终按 +1 后分支结算；无雕像或非事件符号房间命令非法；页面组件中刚获得时不会显示雕像声明按钮。 | 旧领域测试未失效；Board 组件代表链已补探索声明、连续事件房间与刚获得限制，但仍不是真实 Playwright / 截图证据。 |
| 指环 | 显式武器攻击后进入已用列表，攻击使用神志语义并造成精神伤害；未声明时不会自动改写攻击；Board 组件测试证明页面可选择指环、点击目标并进入精神伤害分配，已用时显示禁用原因。 | 旧领域测试未失效；Board 组件代表链已补攻击入口和已用禁用原因，但仍不是真实 Playwright / 截图证据，也不证明怪物目标、多武器互斥或作祟攻击组合。 |
| 匕首 | 显式武器攻击后进入已用列表，攻击额外投骰并支付速度；未声明时不会自动额外投骰或失去速度；Board 组件测试证明页面可选择匕首、点击目标并进入物理伤害分配，刚获得时显示禁用原因。 | 旧领域测试未失效；Board 组件代表链已补攻击入口和刚获得限制，但仍不是真实 Playwright / 截图证据，也不证明速度濒死/死亡保护、多武器互斥或怪物目标组合。 |
| 全员预兆数 | 交易后当前玩家预兆数可变，但 `resolveBetrayalOmenCount` 和风险读模型仍按全员当前持有总数计算。 | 旧测试未失效；仍缺死亡掉落、搜尸和 UI 风险刷新组合。 |
| 作祟检定与 8 骰上限 | 抽新预兆后 `recentRoll.kind = hauntRoll`，骰子数量等于风险读模型；9 个预兆时仍只投 8 颗骰，`latestDiscovery.detail` 显示 8 颗。 | 旧测试未失效；仍缺真实骰盘和作祟揭示 UI。 |
| 最后一张预兆自动作祟 | 预兆堆剩 1 张时 `nextOmenAutomatic=true`；抽到后 `phase=haunt`、`hauntTriggered=true`、触发预兆名写入，并产生作祟确认队列。 | 旧测试未失效；仍缺最后一张组合和自动作祟 UI。 |
| 翻牌确认队列 | 普通作祟触发后队列先确认抽到预兆，再确认作祟检定；确认前移动命令非法，两个确认完成后队列清空。 | 旧测试未失效；仍缺真实 Board 翻牌确认 UI。 |

## 共享根因与残余范围

共享根因：旧矩阵容易把“9 张预兆数量已对齐”“持有区能显示”“领域代表链存在”误读成“9 张预兆逐卡和作祟公共规则已完成”。这会掩盖 UI 承接、交易/死亡/搜尸/探索/攻击组合、作祟揭示和翻牌确认队列的真实入口缺口。

残余范围：

- 9 张预兆仍需逐卡补真实 UI：书本、狗、圣符、雕像已有 Board 组件代表链但缺真实 Playwright / 截图；其余仍需武器选择、多目标移动、死亡保护骰盘和减伤提示。
- 预兆组合仍需扩审：交易、死亡掉落、搜尸、作祟期行动、怪物攻击、房间伤害、重掷/替换、濒死和死亡保护。
- 作祟公共规则仍需补真实链路：探索抽预兆、作祟检定骰盘、5+ 揭示、翻牌确认队列、阵营/首行动提示、最后一张自动作祟；狗交易后的风险条刷新已有 Board 组件代表链，但不等于真实 Playwright / 截图链。
- 木乃伊触发牌仍保持版本冲突：当前 9 张预兆没有「女孩」，当前运行可代表性进入木乃伊，但不能声明触发表完全匹配旧版剧本书。

## 修订记录

| 项 | 结论 |
| --- | --- |
| 旧矩阵风险 | `object-l0-l4-matrix.md` 先前容易把 `L2 已覆盖 / family 代表链` 读成逐预兆完成。 |
| 本轮修订 | 本文件把 9 张预兆逐卡效果和作祟公共规则拆成两个专项账本，并明确当前等级为 `downstream-open`。 |
| 书本补检 | 旧结论把“临界神志成本、使用后按钮禁用”列为未覆盖；本轮已补领域成本门禁和 Board 组件代表链。新结论为 `L1/L2 + Board component representative / partial-ui`，仍不外推到真实 Playwright / 截图、全部非战斗消费者或作祟特殊行动组合。 |
| 狗补检 | 旧结论把狗保留为“交易 UI 全链、交易后风险 UI 均待补”；本轮已补 Board 组件代表链：狗交易候选、4 格目标、同意结算、已用牌禁用、灰尘交换疾病冲突，以及预兆转移后风险条仍按全员总数显示。新结论为 `L1/L2 + Board component representative / partial-ui`，仍不外推到真实 Playwright / 截图、死亡掉落、搜尸或更多作祟组合。 |
| 圣符 / 雕像补检 | 旧结论把探索声明 UI、刚获得限制和事件跳过页面承接列为未覆盖；本轮固定连续事件房间夹具，并补 Board 组件代表链：圣符按钮传入埋葬声明、雕像按钮传入跳过事件声明、刚获得圣符或雕像时页面不显示声明按钮。新结论为 `L1/L2 + Board component representative / partial-ui`，仍不外推到真实 Playwright / 截图、更多房间/作祟探索、无事件符号拒绝 UI 或全部牌堆顺序组合。 |
| 当前状态 | `min-domain-verified / partial-ui / downstream-open`，不是完成。 |
