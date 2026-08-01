# 小黑屋预兆与作祟公共规则实现审计（2026-07-29）

> 2026-07-29 接续边界：本文件是预兆逐卡效果与作祟公共规则的下游实现消费索引，只消费 `full-deck-data-intake-contract.md` 已锁合同和当前只读代码/测试证据；它不能替代整牌库 74 张对象全集主合同，也不能授权 Board/UI、E2E、截图或“整牌库完成”宣称。后续引用本文件时，必须同时保留 `min-domain-verified / partial-ui / downstream-open` 口径。

## 审计范围

本文件只审 `src/games/betrayal` 当前 9 张预兆牌和作祟公共规则的实现消费情况。范围包括：书本、狗、面具、头骨、圣符、盔甲、雕像、指环、匕首，以及抽到预兆后的作祟检定、全员当前持有预兆总数、5+ 作祟、最多 8 骰、最后一张预兆自动作祟、作祟翻牌确认队列。

本文件不重新 OCR、不卡图、不查 Wiki、不新增牌效或作祟玩法实现。若发现合同缺失或版本冲突，只登记为 `blocked/disputed`，不在审计阶段现场补录规则。

## 结论等级

结论等级：`omen-haunt-rule-matrix-indexed / min-domain-verified / Playwright-representative-for-public-haunt / downstream-open`。

含义：9 张预兆已经进入当前运行池，逐卡有 L1 结构入口和一批 L2 领域代表链；作祟公共规则已经有全员预兆数、抽新预兆骰数、8 骰上限、普通作祟触发、最后一张自动作祟的领域证据，并补到 Board 组件代表链和真实 Playwright 代表链：风险条、最后一张预兆自动作祟、作祟揭示横幅和翻牌确认队列均能被页面承接。仍不能宣称“9 张预兆逐卡真实 UI / 组合完成”或“作祟公共规则自然整局 / 全组合完成”。

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
| 书本 | 知识检定 +1；每回合一次花 1 神志，让下一次非战斗检定可用知识替代 | `POSSESSION_USE_EFFECTS` 记录主动模式 `nextNonCombatTraitReplacement`；领域测试覆盖神志成本、每回合一次、非战斗限定、战斗不消费和临界神志不可免费使用；Board 持有物说明显示知识加成，组件代表链覆盖使用后禁用和神志不足提示；真实页面链证明可从持有区使用书本并保留下次非战斗检定替换状态 | `L1/L2 + Board component representative + Playwright representative / partial-ui` | 仍需补更多非战斗检定消费者、房间检定、作祟特殊行动检定和重掷 / 替代消费者组合；不得把一条真实入口外推为全部消费者闭合。 |
| 狗 | 速度检定 +1；每回合一次与 4 格内玩家交易任意数量物品或预兆，同意后结算 | 领域测试覆盖狗交易 pending、同意结算、二次使用拒绝、交易状态区分和已用牌限制；Board 组件代表链覆盖狗交易候选区、多张牌选择、4 格目标高亮、灰尘交换疾病冲突、已用牌禁用原因，以及预兆经狗交易结算后风险条仍显示全员预兆总数；真实页面链覆盖选择多张持有物、4 格内目标、等待接收方同意、同意后转移并清空狗交易状态。 | `L1/L2 + Board component representative + Playwright representative / partial-ui` | 仍需补更多距离边界、死亡/搜尸/作祟状态组合、收到牌本回合使用限制 UI；不得把一条远距交易链外推为全部交易 / 搜尸 / 作祟组合闭合。 |
| 面具 | 速度检定 +1；每回合一次把同房其他探索者和怪物移到相邻已发现房间 | `POSSESSION_USE_EFFECTS` 记录主动模式 `moveOthersInRoom`；领域测试覆盖不能发现新房间、移动探索者/怪物、多目标分别指定方向、每回合一次；Board 组件代表链和真实页面链覆盖给同板块队友和怪物分别选择相邻已发现板块并完成移动。 | `L1/L2 + Board component representative + Playwright representative / partial-ui` | 仍需补死亡目标、怪物回合和作祟怪物组合；不得把一条真实入口外推为全部目标过滤和作祟组合闭合。 |
| 头骨 | 知识检定 +1；死亡前投 3 骰，4+ 阻止死亡并把属性调到濒死，0-3 正常死亡 | 领域测试覆盖成功阻止死亡、失败死亡、兔脚重掷死亡保护；灰尘作祟中另有致死与掩埋组合代表链；Board 组件代表链覆盖攻击伤害分配进入死亡保护后显示 3 骰骰盘、4+ 阻止死亡和头骨反馈。 | `L1/L2 + Board component representative / partial-ui` | 仍需补真实 Playwright / 截图链、更多致死来源、作祟终局和遗物掩埋组合。 |
| 圣符 | 神志检定 +1；探索时可埋葬第一张板块并继续探索；本回合刚获得不可用 | 领域测试覆盖神志加成、埋葬房间并继续发现、不结算第一张效果、无圣符或刚获得时拒绝；Board 组件代表链覆盖探索声明按钮、连续事件房间中先埋葬第一张再继续发现下一张，以及刚获得时页面不显示圣符声明按钮；真实页面链覆盖声明、取消、重新声明、选择未知门位、埋葬倒塌房间、确认新房间朝向、继续发现长廊事件并关闭回牌桌。 | `L1/L2 + Board component representative + Playwright representative / partial-ui` | 仍需补更多房间/事件/作祟探索消费者、更多牌堆顺序、刚获得限制真实 UI 和无合法目标/无事件符号边界。 |
| 盔甲 | 受到物理伤害 -1；不阻挡通用伤害或直接属性降低 | 领域测试覆盖物理伤害减免、直接力量降低不被挡、通用伤害不被挡；特殊行动预算确认不是主动使用牌；Board 组件代表链覆盖伤害分配页显示原始物理伤害、盔甲减免和实际分配数。 | `L1/L2 + Board component representative / partial-ui` | 仍需补真实 Playwright / 截图链、更多物理伤害来源、死亡保护和作祟伤害消费者。 |
| 雕像 | 力量检定 +1；发现事件符号房间时可选择不抽事件 | 领域测试覆盖跳过事件且不结算事件效果、力量检定 +1、无雕像或非事件符号房间拒绝；Board 持有物说明显示跳过事件提示；Board 组件代表链覆盖探索声明按钮、圣符埋葬后仍可对下一张事件符号房间声明雕像跳过，以及刚获得时页面不显示雕像声明按钮；真实入口代表链覆盖声明雕像、选择未知房间、跳过事件、不扣力量和回到牌桌 | `L1/L2 + Board component representative + Playwright representative / partial-ui` | 仍需补更多事件牌堆顺序、作祟探索和无事件符号拒绝 UI 边界。 |
| 指环 | 神志检定 +1；攻击时显式选择，双方改用神志对攻并造成精神伤害 | 攻击武器状态把指环登记为武器；领域测试覆盖显式使用、精神伤害、未声明不自动生效、交易限制；Board 持有物说明显示神志武器语义；Board 组件代表链覆盖攻击入口选择指环、目标高亮、等待精神伤害分配和已用禁用原因；真实页面链覆盖选择指环、目标高亮、神志对攻骰盘、精神伤害结算和回牌桌。 | `L1/L2 + Board component representative + Playwright representative / partial-ui` | 仍需补怪物目标、多武器互斥、作祟攻击、未声明不自动生效真实负向和更多神志检定消费者。 |
| 匕首 | 攻击时显式选择，失去 1 速度并额外投 2 骰，造成物理伤害 | 攻击武器状态把匕首登记为武器；领域测试覆盖显式使用、速度成本、额外骰、未声明不自动生效、交易限制；Board 持有物说明显示武器语义；Board 组件代表链覆盖攻击入口选择匕首、目标高亮、等待物理伤害分配和刚获得禁用原因；真实页面链覆盖选择匕首、目标高亮、6 骰攻击骰盘、速度花费、物理伤害结算和回牌桌。 | `L1/L2 + Board component representative + Playwright representative / partial-ui` | 仍需补速度濒死/死亡保护、多武器互斥、怪物目标、作祟攻击和刚获得限制真实负向。 |

### 作祟公共规则

| 公共规则 | 当前实现消费 | 证据等级 | 残余范围 |
| --- | --- | --- | --- |
| 全员当前持有预兆总数 | `resolveBetrayalOmenCount` 按所有探索者当前 inventory 中的预兆求和，不只看当前玩家；Board 组件代表链覆盖狗交易把书本移出当前玩家后，风险条仍显示全员总预兆数。 | `L2 + Board component representative / partial-ui` | 死亡掉落、遗物转移、搜尸和更多作祟状态风险 UI 消费者仍需继续审。 |
| 抽到预兆后的作祟检定 | `resolveHauntRoll` 仅在作祟前且抽到预兆时生成；骰数读取风险读模型，最近投骰记录为 `hauntRoll`；Board 组件代表链覆盖首剧本作祟检定写入作祟开始状态时不自动打开剧本书，但保留手动查阅入口；真实 Playwright 代表链覆盖自然探索抽到最后一张预兆后进入作祟。 | `L2 + Board component representative + Playwright representative / partial-ui` | 普通骰盘视觉、分阵营阅读、跨回合自然整局和更多预兆来源组合仍需补。 |
| 5+ 开始作祟 | 作祟检定总点数达到阈值时写入作祟状态、触发预兆、剧本卡、揭秘者、叛徒/首行动玩家裁定。 | `L2 + representative-only` | 木乃伊当前运行触发牌与旧版「女孩」合同存在版本冲突，仍保持 `disputed / representative-only`。更多剧本入口未完成。 |
| 最多 8 骰 | 风险读模型通过 `normalizeBetrayalDiceCount` 把下次投骰数量限制到 8；领域测试覆盖 9 个预兆时仍只投 8 颗骰。 | `L2 + partial-ui` | 风险 UI 的超 8 组合和完整骰盘展示仍需补。 |
| 最后一张预兆自动作祟 | 当预兆堆剩余 1 张且作祟未开始，抽到该预兆时不靠点数，直接自动触发作祟；真实 Playwright 代表链覆盖风险条显示“下张预兆自动作祟”、探索抽到最后预兆、进入作祟、关闭横幅并完成两步确认。 | `L2 + Playwright representative / partial-ui` | 最后一张经交易/死亡掉落/强制搜牌后的组合扩审仍需补。 |
| 翻牌确认队列 | 作祟触发后 `pendingCardResolutionQueue` 同时保留抽到的预兆和作祟检定确认；确认前拒绝继续移动；Board 组件和真实 Playwright 代表链覆盖作祟触发后关闭揭示横幅仍保留两步翻牌确认，且当前 9 张预兆均可进入持有区。 | `L2 + Board component representative + Playwright representative / partial-ui` | 分阵营阅读、跨回合自然整局和更多交易 / 死亡 / 搜尸组合仍需补。 |
| 作祟风险进度条 | Board 常驻 `betrayal-haunt-risk-status` 与 `betrayal-haunt-risk-progress`，显示总预兆数、下次骰数、阈值和进度百分比；Board 组件代表链覆盖风险条常驻、狗交易后全员预兆数刷新，以及灰尘隐藏叛徒作祟揭示期关闭横幅前不显示作祟后进度；真实 Playwright 代表链覆盖三预兆下次四骰与最后预兆自动作祟提示。 | `L3 component representative + Playwright representative / partial-ui` | 死亡掉落、搜尸、交易后风险刷新和作祟期特殊来源仍需继续分层补证。 |
| 作祟揭示横幅 | Board 作祟揭示阶段显示可关闭横幅，隐藏叛徒场景关闭前不提前显示作祟后进度；切到下一行动者后仍保留手动查阅入口；真实 Playwright 代表链覆盖横幅显示时翻牌确认面板不共存，关闭后再进入两步确认。 | `L3 component representative + Playwright representative / partial-ui` | 分阵营阅读、剧本书阅读差异和跨回合自然整局承接仍需补。 |

## 验证证据

| 检查 | 结果 |
| --- | --- |
| 9 张预兆结构入口 | `firstScenarioRuntime.test.ts` 中“当前 9 张预兆牌均登记真实能力入口而不是只登记翻牌确认”覆盖主动使用、攻击武器、圣符探索、雕像跳过事件的入口矩阵。 |
| 书本、狗、面具、头骨、圣符、盔甲、雕像、指环、匕首领域代表链 | `firstScenarioRuntime.test.ts` 已覆盖各自至少一条领域行为链和部分负向路径；书本、狗、面具、头骨、圣符、盔甲、雕像、指环、匕首已另补 Board 组件代表链，且当前 9 张预兆均已有至少一条真实 Playwright / 截图代表链或专项真实入口代表链，但仍不能外推为 9 张预兆逐消费者、负向 UI、作祟期和组合完成。 |
| 作祟公共规则领域链 | `firstScenarioRuntime.test.ts` 覆盖交易转移预兆后总数不变、抽新预兆骰数与读模型一致、8 骰上限、普通预兆触发作祟、最后一张预兆自动作祟、翻牌确认队列。 |
| 作祟公共规则 Board 组件代表链 | `Board.foundation.test.tsx` 覆盖 `data-omen-count=3`、`data-next-dice-count=4`、`progress=38` 和展示文案“预兆 3 / 下次掷 4 颗 / 5+ 作祟”；狗交易组件代表链覆盖书本经狗交易移出当前玩家后，风险条仍为 `data-omen-count=2`；作祟揭示组件代表链覆盖横幅关闭、手动查阅入口、隐藏叛徒场景关闭前不提前显示作祟后进度，以及普通预兆触发作祟后的翻牌确认入口。 |
| 本轮作祟公共规则补检 | `Board.foundation.test.tsx -t "作祟风险\|作祟揭示\|首剧本作祟检定\|翻牌确认"` 5 passed / 172 skipped；`firstScenarioRuntime.test.ts -t "作祟风险\|抽到新预兆\|最后一张预兆\|作祟检定按全员预兆\|普通预兆触发作祟\|翻牌确认队列"` 10 passed / 688 skipped；`npx eslint src/games/betrayal/__tests__/Board.foundation.test.tsx` 0 errors。Board 测试夹具仅补入下一张探索房间为事件符号房间，用于生成“说“茄子”！”事件选择；这不是规则实现本体修复。 |
| 2026-07-31 作祟真实入口补证 | `npm run test:e2e:file -- e2e/betrayal/haunt-risk-status.e2e.ts`：2 passed，覆盖三预兆风险条、最后一张预兆自动作祟、揭示横幅关闭后两步确认和截图；`npm run test:e2e:file -- e2e/betrayal/haunt-reveal-discovery-confirmation.e2e.ts`：4 passed，覆盖普通触发 / 未触发作祟的两步确认、当前 9 张预兆未触发与触发作祟后的确认和持有区结果。 |
| 本轮新增验证 | 当前 9 张预兆均已有至少一条真实 Playwright / 截图代表链或专项真实入口代表链：书本、狗、面具、雕像已有真实 Playwright / 截图代表链；头骨已有木乃伊攻击致死后的死亡保护成功 / 失败与兔脚重掷真实入口代表链；盔甲已有木乃伊攻击物理减伤真实入口代表链；圣符本轮复跑并修正过期 E2E 后新增真实入口代表链：`npx eslint e2e/betrayal/holy-symbol-explore-declaration.e2e.ts` 0 errors，`npm run test:e2e:file -- e2e/betrayal/holy-symbol-explore-declaration.e2e.ts "圣符探索声明"` 1 passed，截图目录 `evidence/山屋惊魂-圣符探索声明完整链路/`；指环 / 匕首真实入口代表链已复跑：`npm run test:e2e:file -- e2e/betrayal/non-p0-representative.e2e.ts "指环神志攻击真实链路"` 1 passed，`npm run test:e2e:file -- e2e/betrayal/non-p0-representative.e2e.ts "匕首攻击真实链路"` 1 passed，截图目录 `evidence/山屋惊魂-指环神志攻击完整链路/` 与 `evidence/山屋惊魂-匕首攻击完整链路/`。结论仍是代表链，不外推为逐消费者、全负向和全组合完成。 |
| 2026-07-31 P0 复核 | `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "当前 9 张预兆\|书本\|狗\|面具\|头骨\|圣符\|盔甲\|雕像\|指环\|匕首\|交易转移预兆\|作祟风险\|抽到新预兆\|最后一张预兆\|作祟检定按全员预兆\|普通预兆触发作祟\|翻牌确认队列"`：291 passed / 407 skipped；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "书本\|狗\|面具\|头骨\|圣符\|雕像\|盔甲\|指环\|匕首\|攻击武器选择区\|作祟风险\|作祟揭示\|翻牌确认"`：21 passed / 156 skipped，退出码 0，尾部仍有既有 `ECONNRESET` 噪声。结论：当前未发现“某张预兆完全无入口 / 自动消费者缺失 / 命令不消费 / 状态不收口”的 P0 逐卡入口阻塞；残余继续按真实 Playwright / 截图和组合验证分层处理。 |

## 测试语义对账

| 对象/规则 | 测试断言证明的最终状态 | 旧测试失效检查 |
| --- | --- | --- |
| 书本 | 使用后 `usedCardIdsThisTurn` 记录书本、当前神志减少、`nextNonCombatTraitReplacement` 写入知识替代；战斗对攻后该替代状态仍保留；神志临界时校验拒绝使用且不写入替代状态；真实页面可从持有区使用书本并保留下次非战斗检定替换状态。 | 旧测试未覆盖临界神志成本，现已补领域负向断言；Board 组件代表链已补使用后禁用和神志不足提示；真实 Playwright / 截图代表链已补，但仍不证明全部非战斗消费者、房间检定、作祟特殊行动检定或重掷 / 替代组合。 |
| 狗 | 发起后进入 `pendingTradeAgreement`，同意后双方 inventory 真实转移，狗进入 `usedCardIdsThisTurn`，二次狗交易被拒绝；真实页面可选择多张给出牌、切到 4 格内目标楼层、点击队友 token、等待接收方同意、同意后完成转移并回到牌桌。 | 旧领域测试未失效；本轮补上 Board 组件代表链和真实 Playwright / 截图代表链，但仍不证明死亡 / 搜尸 / 作祟状态组合或收到牌本回合使用限制全部闭合。 |
| 面具 | 使用后同房其他探索者和怪物的 `roomId` 变成指定已发现相邻房间，当前玩家不移动，面具保留在持有区且进入已用列表；真实页面可为队友和狂热病患分别选择相邻已发现目标板块并完成移动。 | 旧领域测试未失效；Board 组件和真实 Playwright / 截图代表链已补多目标选择，但仍不证明怪物回合 UI、死亡目标过滤或作祟怪物组合。 |
| 头骨 | 致死伤害分配后成功路径不进入死亡列表并把属性调到濒死；失败路径进入死亡列表；兔脚重掷能改变死亡保护结果；Board 组件测试证明死亡保护骰盘、4+ 成功反馈和头骨结果会显示到页面；木乃伊攻击真实入口已覆盖头骨成功、失败正常死亡以及头骨失败后兔脚重掷阻止死亡。 | 旧领域测试未失效；已有灰尘组合代表链、Board 组件代表链和真实 Playwright / 截图代表链，但仍不能外推到所有致死来源、作祟终局、遗物掩埋或更多兔脚死亡保护组合。 |
| 圣符 | 探索时使用圣符会埋葬第一张房间、继续发现下一张且不结算第一张效果；无圣符或本回合刚获得时命令非法；页面组件中刚获得时不会显示圣符声明按钮；真实页面链覆盖声明、取消、重新声明、埋葬倒塌房间、确认新房间朝向、继续发现长廊事件并回到牌桌。 | 旧领域测试未失效；Board 组件代表链和真实 Playwright / 截图代表链已补，但仍不证明更多房间/事件/作祟探索消费者、刚获得限制真实负向、无合法目标/无事件符号边界或全部牌堆顺序组合。 |
| 盔甲 | 物理伤害最终扣减减少 1；直接属性降低和通用伤害不被盔甲拦截；Board 伤害分配页能显示原始物理伤害、盔甲减免和实际分配数；木乃伊攻击真实入口已覆盖物理伤害减免链。 | 旧领域测试未失效；Board 组件代表链和真实 Playwright / 截图代表链已补，但仍不证明更多物理伤害来源、死亡保护或作祟伤害消费者闭合。 |
| 雕像 | 使用雕像探索事件符号房间时不抽取、不结算事件且事件弃牌数不增加；力量检定路径最终按 +1 后分支结算；无雕像或非事件符号房间命令非法；页面组件中刚获得时不会显示雕像声明按钮。 | 旧领域测试未失效；Board 组件代表链已补探索声明、连续事件房间与刚获得限制；真实 Playwright / 截图代表链已补声明雕像、选择未知房间、跳过事件、不扣力量和回牌桌状态清理。 |
| 指环 | 显式武器攻击后进入已用列表，攻击使用神志语义并造成精神伤害；未声明时不会自动改写攻击；Board 组件测试证明页面可选择指环、点击目标并进入精神伤害分配，已用时显示禁用原因；真实页面链覆盖选择指环、目标高亮、神志对攻骰盘、精神伤害结算和回牌桌。 | 旧领域测试未失效；Board 组件代表链和真实 Playwright / 截图代表链已补，但仍不证明怪物目标、多武器互斥、作祟攻击或未声明不自动生效真实负向。 |
| 匕首 | 显式武器攻击后进入已用列表，攻击额外投骰并支付速度；未声明时不会自动额外投骰或失去速度；Board 组件测试证明页面可选择匕首、点击目标并进入物理伤害分配，刚获得时显示禁用原因；真实页面链覆盖选择匕首、目标高亮、6 骰攻击骰盘、速度花费、物理伤害结算和回牌桌。 | 旧领域测试未失效；Board 组件代表链和真实 Playwright / 截图代表链已补，但仍不证明速度濒死/死亡保护、多武器互斥、怪物目标、作祟攻击或刚获得限制真实负向。 |
| 全员预兆数 | 交易后当前玩家预兆数可变，但 `resolveBetrayalOmenCount` 和风险读模型仍按全员当前持有总数计算。 | 旧测试未失效；仍缺死亡掉落、搜尸和 UI 风险刷新组合。 |
| 作祟检定与 8 骰上限 | 抽新预兆后 `recentRoll.kind = hauntRoll`，骰子数量等于风险读模型；9 个预兆时仍只投 8 颗骰，`latestDiscovery.detail` 显示 8 颗。 | 旧测试未失效；作祟揭示 UI 已有真实入口代表链，仍缺普通骰盘视觉和更多组合。 |
| 最后一张预兆自动作祟 | 预兆堆剩 1 张时 `nextOmenAutomatic=true`；抽到后 `phase=haunt`、`hauntTriggered=true`、触发预兆名写入，并产生作祟确认队列；真实入口证明风险条、揭示横幅和两步确认可走通。 | 旧测试未失效；仍缺最后一张经交易/死亡掉落/强制搜牌后的组合。 |
| 翻牌确认队列 | 普通作祟触发后队列先确认抽到预兆，再确认作祟检定；确认前移动命令非法，两个确认完成后队列清空；真实入口证明横幅与确认面板不会同时抢焦点，关闭横幅后两步确认可完成。 | 旧测试未失效；仍缺分阵营阅读、跨回合自然整局和更多组合。 |

## 共享根因与残余范围

共享根因：旧矩阵容易把“9 张预兆数量已对齐”“持有区能显示”“领域代表链存在”误读成“9 张预兆逐卡和作祟公共规则已完成”。这会掩盖 UI 承接、交易/死亡/搜尸/探索/攻击组合、作祟揭示和翻牌确认队列的真实入口缺口。

残余范围：

- 9 张预兆均已有至少一条真实 Playwright / 截图代表链或专项真实入口代表链；当前残余不再是“首条真实入口缺失”，而是逐消费者、负向 UI、作祟期、死亡 / 搜尸、怪物攻击、房间伤害、重掷 / 替代和多武器互斥等组合未全闭合。
- 预兆组合仍需扩审：交易、死亡掉落、搜尸、作祟期行动、怪物攻击、房间伤害、重掷/替换、濒死和死亡保护。
- 作祟公共规则真实链路已补一层：风险条、最后一张预兆自动作祟、作祟揭示横幅、翻牌确认队列已有 Playwright / 截图代表链；仍缺逐预兆真实 UI、阵营/首行动提示、分阵营阅读、跨回合自然整局和交易 / 死亡 / 搜尸等组合。
- 木乃伊触发牌仍保持版本冲突：当前 9 张预兆没有「女孩」，当前运行可代表性进入木乃伊，但不能声明触发表完全匹配旧版剧本书。

## 同类扩审记录

| 项 | 记录 |
| --- | --- |
| 搜索范围 | 横向搜索 `create.*HauntReveal.*Core`、`RESOLVE_EVENT_CHOICE`、`pendingEventChoice`、`setNextBoardDiscoveryRoom`、`setNextDiscoverySymbolRoomsForAllFloors`，覆盖 `src/games/betrayal/__tests__` 和 `src/games/betrayal/testing`；另搜索 `betrayal-haunt-risk-status`、`betrayal-haunt-risk-progress`、`betrayal-haunt-reveal-cue`、`pendingCardResolutionQueue`、`ACKNOWLEDGE_CARD_RESOLUTION`、`resolveBetrayalHauntRisk`，覆盖 `src/games/betrayal`。 |
| 命中项 | 领域测试的事件探索夹具普遍通过 `setNextDiscoverySymbolRoomsForAllFloors(core, 'event')` 固定事件符号房间；Board 测试中 `createDustHauntRevealBoardCore` 已固定 `setNextBoardDiscoveryRoom(core, 'ground', 'kitchen')`；本轮命中的同族缺口是 `createMagicCameraHauntRevealBoardCore` 在调用 `RESOLVE_EVENT_CHOICE` 前没有固定事件符号房间，导致没有生成“说“茄子”！”事件选择。 |
| 修正范围 | 仅修正 Board 测试夹具：在 `createMagicCameraHauntRevealBoardCore` 中固定下一张地面探索房间为事件符号房间 `kitchen`。正式游戏实现、规则合同、牌库和 Board 运行逻辑未改。 |
| 残余扩审 | 作祟公共规则已补风险条、最后一张预兆自动作祟、揭示横幅和两步确认的真实 Playwright / 截图代表链；仍保留分阵营阅读、跨回合自然整局、死亡掉落 / 搜尸 / 遗物转移后的风险条刷新为验证层级缺口；这些不是当前实现阻塞。 |
| 漏审归因 | 旧 Board 代表链测试断言依赖“探索会生成指定事件选择”的中间态，但夹具没有像领域测试一样固定事件符号房间，属于测试断言前置条件过窄、证据停在中间态的文档 / 测试夹具缺口；不是规则实现本体漏实现。 |

## 修订记录

| 项 | 结论 |
| --- | --- |
| 旧矩阵风险 | `object-l0-l4-matrix.md` 先前容易把 `L2 已覆盖 / family 代表链` 读成逐预兆完成。 |
| 本轮修订 | 本文件把 9 张预兆逐卡效果和作祟公共规则拆成两个专项账本，并明确当前等级为 `downstream-open`。 |
| 书本补检 | 旧结论把“临界神志成本、使用后按钮禁用”列为未覆盖；本轮已补领域成本门禁、Board 组件代表链和真实 Playwright / 截图代表链。新结论为 `L1/L2 + Board component representative + Playwright representative / partial-ui`，仍不外推到全部非战斗消费者、房间检定、作祟特殊行动或重掷 / 替代组合。 |
| 狗补检 | 旧结论把狗保留为“交易 UI 全链、交易后风险 UI 均待补”；本轮已补 Board 组件代表链和真实 Playwright / 截图代表链：狗交易候选、4 格目标、同意结算、已用牌禁用、灰尘交换疾病冲突、预兆转移后风险条仍按全员总数显示，以及真实页面多张持有物远距交易收口。新结论为 `L1/L2 + Board component representative + Playwright representative / partial-ui`，仍不外推到死亡掉落、搜尸或更多作祟组合。 |
| 圣符 / 雕像补检 | 旧结论把探索声明 UI、刚获得限制和事件跳过页面承接列为未覆盖；本轮固定连续事件房间夹具，并补 Board 组件代表链：圣符按钮传入埋葬声明、雕像按钮传入跳过事件声明、刚获得圣符或雕像时页面不显示声明按钮。雕像真实链证明可声明雕像、选择未知事件房间、跳过事件、不扣力量并回到牌桌；圣符真实链证明可声明、取消、重新声明、埋葬倒塌房间、确认新房间朝向、继续发现长廊事件并关闭回牌桌。新结论为 `L1/L2 + Board component representative + Playwright representative / partial-ui`，仍不外推到更多房间/作祟探索、无事件符号拒绝 UI 或全部牌堆顺序组合。 |
| 作祟公共规则 UI 消费补检 | 旧结论把“作祟揭示 UI、翻牌确认 UI、风险条消费”保留在实现正确性候选；本轮补检证明当前实现已有 Board 组件代表链和领域链，暂无实现阻塞。补丁只修正 Board 测试夹具缺事件符号房间导致无法生成事件选择的问题，不是规则实现本体修复。新结论为 `L2/L3 Board component representative / partial-ui`，仍不外推到真实 Playwright / 截图或自然整局端到端。 |
| 作祟公共规则真实入口补证 | 本轮发现并修正作祟揭示横幅与翻牌确认面板同时显示的 UI 顺序问题；同时把真实入口用例固定为抽牌玩家视角，保留“必须由抽到该卡的玩家确认”的规则校验。新结论为公共作祟规则已有 Playwright / 截图代表链，但仍不外推为逐预兆真实 UI、分阵营阅读、自然整局或全部组合完成。 |
| 2026-07-31 作祟横幅队列回归修复 | 本轮真实入口复核又发现一条实现问题：旧作祟开场横幅关闭后仍可留在发现队列首位，并错误使用后续发现的 key 重新弹出，压住「书本 / 圣符」等作祟后预兆发现面板；另一个分支是“最后一张预兆自动触发作祟”未进入作祟揭示判定。已修正 Board 的作祟开场发现识别、队列 key 选择和关闭横幅时的旧条目清理。验证：复现 `mummy-rampage-forced-omen-draw.e2e.ts` 2 failed，失败点为发现面板不可见；修复后 `mummy-rampage-forced-omen-draw.e2e.ts` 2 passed、`haunt-risk-status.e2e.ts` 2 passed、`haunt-reveal-discovery-confirmation.e2e.ts` 4 passed、`NODE_OPTIONS=--max-old-space-size=8192 npx eslint src/games/betrayal/Board.tsx` 0 errors。 |
| 当前状态 | `min-domain-verified / Playwright-representative-for-public-haunt / downstream-open`，不是完成。 |
