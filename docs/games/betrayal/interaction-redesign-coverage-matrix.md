# 山屋惊魂交互重拆覆盖矩阵

> 目的：先设计交互，再执行实现。本文是首批 P0 实现切片，不是全规则完成口径。
> 当前状态：design draft。全量规则逐条账本见 `docs/games/betrayal/full-rule-interaction-redesign.md`。
> 真相源：`src/games/betrayal/rule/山屋惊魂小黑屋第三版规则汉化整理.md`、`docs/games/betrayal/master-spec-view.md`、当前 `src/games/betrayal/*` 实现审计。

## 0. 本轮前提锁定

- 问题对象：`betrayal` 的基础规则交互重拆，不是某一个 E2E 截图或单个作祟剧本。
- 真相来源：本地规则整理和 `docs/games/betrayal` 现有主视角文档；当前实现只作为差距证据，不能反向覆盖规则。
- 目标入口 / 环境：当前工作区 `D:\gongzuo\webgame\BoardGame`，后续真实入口仍以联机对局页面和现有测试入口为准。
- 验收口径：实现前先完成全规则账本和本 P0 切片；实现后每条 P0 规则必须回填状态真相、命令/事件、UI 承接和测试/截图证据。非 P0 规则不得因 P0 通过而默认完成。
- 关键纠偏：用户点名的剧本卡、属性轨、作祟风险条和房间朝向只是最先暴露的 P0 缺口，不是完整规则缺口清单；完整范围以 `full-rule-interaction-redesign.md` 和本矩阵新增的“用户点名外缺口”共同约束。

## 1. 状态标记

| 状态 | 含义 |
| --- | --- |
| `design-ready` | 交互合同清楚，可进入实现拆分 |
| `needs-design` | 规则已确认，但交互或状态模型还没设计完整 |
| `blocked` | 缺规则、素材、剧本文档或用户裁定 |
| `representative-only` | 当前只允许作为代表链 / MVP，不得宣称完整规则 |
| `implemented-needs-remodel` | 现有实现可跑，但模型不符合规则语义，需要重构 |
| `implemented-verified` | 已按本切片合同落地，并完成单测、真实入口 E2E、截图核验和服务器相册证据回填 |

## 2. P0 基础交互覆盖矩阵

| # | 规则语义 | 当前实现判断 | 目标交互合同 | 状态真相 | UI 承接 | 验证计划 | 状态 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | 开局玩家共同翻阅五张剧本卡并选择一张作为本局剧本 | 只有 `first-scenario` 单例，UI 标成当前选择 | `ScenarioSelectionInteraction`：展示候选池、记录共同选择、允许明确的代表 MVP | `scenarioCatalog`, `setup.scenarioCandidates`, `core.scenarioId` | 建房设置或角色选择前的剧本选择面板 | 单测覆盖候选池和非法 scenario；页面测试覆盖选择后进入角色选择 | `implemented-needs-remodel` |
| 2 | 每个探索者四项属性来自角色面板轨道，提升/下降移动标记，不一定等价裸数值加减 | 角色属性是裸数字，多处直接 `+1/-1` | `TraitTrackModel`：`trackId + position + values + critical/skull/max`，效果按 step 修改 | `explorer.traitTracks[trait]`，派生 `currentTraits` | 角色板轨道标记、伤害分配和治疗选择 | 单测覆盖非线性轨、上限、作祟前不死、作祟后死亡 | `implemented-needs-remodel` |
| 3 | 抽到预兆后按所有玩家当前持有预兆总数掷骰，5+ 开始作祟 | 骰数逻辑基本存在；UI 主要在发现详情 / 骰盘表达 | `HauntRiskStatus`：当前预兆总数、下一次骰数、阈值、触发状态 | 从所有探索者持有物派生，必要时缓存读模型 | 主 HUD 的预兆风险条 / 牌堆区风险徽章，不只靠日志 | 单测覆盖多人持有预兆；页面测试覆盖风险条和骰盘一致 | `design-ready` |
| 4 | 探索新房间时，玩家从未探索走廊进入，翻出匹配区域房间，并选择新板块任一走廊连接入口 | 当前选择目标未知门位，但房间朝向自动适配 | `RoomPlacementInteraction`：入口门位、候选房间、合法连接边、旋转/朝向选择、确认放置 | `roomTileInstance.orientation`, `entryDoor`, `connectedDoorways` | 地图上高亮入口，弹出房间预览和旋转 / 确认控件 | 单测覆盖合法朝向、非法无连接、保留未来可探索走廊；页面测试覆盖旋转选择 | `implemented-needs-remodel` |
| 5 | 顶部板块区域不匹配时掩埋，继续翻找匹配区域；区域耗尽时不消耗移动 | 已补统一房间堆翻找、区域不匹配掩埋到底部、封死区域重抽、最后同区域死路房最小调整候选、最近翻找结果、放置面板掩埋提示和区域耗尽短提示 | `RoomDrawResolution`：候选池、掩埋记录、匹配结果、耗尽反馈、调整候选 | `roomDiscoveryDeck`, `roomDiscoveryOrderByFloor`, `buriedRoomTiles`, `latestRoomDrawResolution`, `pendingRoomPlacementFailure`, `requiresTileAdjustment`, `roomTileAdjustment` | 放置面板显示“已掩埋：...”；区域耗尽时显示“{{楼层}}房间已耗尽”；最后同区域死路房提示并列出调整已有板块候选，选中后可确认放置 | 已补区域不匹配掩埋领域测试、封死区域重抽领域测试、最后死路房调整并放置领域测试、牌桌组件完整选择测试、耗尽不消耗移动领域测试、耗尽提示组件测试；四条探索失败边界真实入口 E2E、截图核验和服务器相册已回填 | `implemented-verified` |
| 6 | 探索并结算新房间后回合结束 | 已有回合结束标记和推荐结束 | 保留现有路径，但绑定到放置确认后的结算完成事件 | `turnEndedByDiscovery`, `recommendedAction` | 行动区只保留结束回合 / 确认结果 | 回归现有探索后结束回合测试 | `design-ready` |
| 7 | 回合开始按速度确定移动力；回合中速度变化不改变本回合已确定移动力 | 已新增回合开始速度快照，速度变化不回填本回合移动力 | `TurnMovementSnapshot`：回合开始锁定速度值和剩余移动 | `turnStartSpeed`, `movesRemaining` | HUD 短状态显示剩余移动 / 本回合锁定移动力 | 单测、真实入口 E2E、截图核验和服务器相册已覆盖 | `implemented-verified` |
| 8 | 物理 / 精神 / 一般伤害由玩家在指定属性之间分配 | 当前存在部分自动顺序扣减和部分选择 | `DamageAllocationInteraction`：伤害类型、可选属性、点数、确认分配 | `pendingDamageAllocation` 或 InteractionSystem snapshot | 伤害分配面板，显示属性轨后果 | 单测覆盖非法分配、临界/死亡；页面测试覆盖一次真实分配 | `implemented-needs-remodel` |
| 9 | 同房间探索者可交易任意数量物品 / 预兆，双方同意 | 已有交易链路，但需对齐“双方同意”和任意数量 | `TradeAgreementInteraction`：发起方、目标方、给出/拿取列表、双方确认 | InteractionSystem / trade snapshot | 双方确认面板和持有物多选 | 回归现有交易 E2E，并补拒绝/空交易边界 | `design-ready` |
| 10 | 每个可用特殊行动 / 来源每回合各一次；本回合新获得的物品 / 预兆不能立刻用；被动效果不占特殊行动 | 已补持有物、神秘电梯房间效果和作祟特殊行动读模型：主动、被动、已用、刚获得、探索后结束回合、作祟前后阶段都能给出状态原因；Board 作祟主动作按钮已接入统一预算禁用原因；灰尘剧本“寻找解药”已用状态已补真实入口 E2E / 截图相册；仍需继续收口其它特殊行动真实入口预算证据 | `SpecialActionBudget` / `PossessionSpecialActionStatus` / `RoomSpecialActionStatus` / `HauntSpecialActionStatus`：按行动来源、行动类型、回合开始持有快照和被动 / 主动类型记录限制 | `usedCardIdsThisTurn`, `usedRoomEffectIdsThisTurn`, `turnStartPossessionIds`, `effectKind` | 持有物 / 房间效果 / 作祟动作按钮禁用原因短提示 | 领域单测覆盖持有物主动、被动、已用、刚获得；神秘电梯可用、已用、探索后结束回合、错误房间；作祟特殊行动预算和灰尘作祟按钮禁用原因组件测试；作祟预算已用状态真实入口 E2E 与相册见证据索引 | `implemented-needs-remodel` |
| 11 | 攻击时玩家声明是否使用武器；每次攻击最多一件武器，本回合刚获得不能使用 | 已有攻击面板武器选择、徒手默认、攻击后武器记录和刚获得限制单测 / 代表 E2E；但仍需纳入统一攻击声明交互和视线合同 | `AttackDeclarationInteraction`：目标、属性、武器选择、确认 | `attackDeclaration`, `turnStartInventoryCardIds` | 攻击面板中的武器选择 / 不使用武器 | 单测覆盖多武器、刚获得武器、武器交易限制；代表 E2E 覆盖徒手 / 砍刀 / 指环 / 匕首 | `implemented-needs-remodel` |
| 12 | 作祟触发后，用游戏开始选择的剧本卡和触发预兆确定作祟编号与叛徒 | 当前多个代表作祟链存在，但剧本卡选择不完整 | `HauntRevealResolution`：选中剧本、触发预兆、作祟编号、叛徒策略、公开设置 | `scenarioRuntime.hauntCardNumber`, `hauntRevealerPlayerId`, `traitorPlayerId` | 剧本书打开前的公开揭示层和双方设置步骤 | 单测覆盖 scenario + omen 映射；页面测试覆盖公开设置后进入剧本书 | `representative-only` |

## 2.1 用户点名外的必补缺口总表

> 本表不是替代全规则账本，而是防止实施时只盯住用户举例。所有条目都必须进入实施 backlog；当前 P0 完成也不能自动代表这些条目完成。

| # | 缺口域 | 规则真实含义 | 当前风险 | 设计 / 实现落点 |
| ---: | --- | --- | --- | --- |
| 13 | 设置组件与计数轨 | 计数轨、指针、参考卡、怪物参考卡和作祟书都有阶段权限；计数轨常用于作祟进度 | 只实现首剧本时容易没有通用计数轨和参考入口 | `numberTracks[]`, `referenceCards`, setup 摘要 / 帮助层 |
| 14 | 首玩家与回合顺序 | 开局首玩家、顺时针行动、作祟 setup 后可能由规则改写首玩家 | 代表链硬编码玩家顺序会污染作祟后行动 | `firstPlayerRule`, `turnOrder`, `hauntFirstPlayerOverride` |
| 15 | 卡牌结算顺序 | 事件只执行命中结果表分支并掩埋到底部；物品 / 预兆获得后进入持有区；最后一张预兆自动作祟 | 已补领域代表链：事件牌结算后回到事件牌堆底部且不增加事件弃牌数；物品牌只有获得才离开牌堆，器械库展示出的非武器物品牌掩埋回物品牌堆底部；兔脚回滚会恢复持有牌牌堆快照；仍缺完整阻塞式牌面逐步确认 UI | `eventOrder`, `possessionOrderByKind`, `deckCounts`, `discardCounts`, `hauntAutoStartReason`, 后续 `pendingCardResolution` |
| 16 | 房间文字优先 | 探索新房间时先结算房间文字，再按符号抽事件 / 物品 / 预兆 | 已补两个领域代表链：书房发现时先获得 1 点知识，随后外星几何按提升后的知识值投 4 骰并走成功分支；器械库先按房间文字抽到武器并掩埋非武器展示牌到底部，再按物品符号另抽下一张物品牌；牌桌发现详情和最新反馈会同时说明器械库获得的武器、被掩埋展示牌和符号抽到的物品牌；仍缺完整阻塞式结算队列、牌面逐步确认和所有房间文字 / 符号组合 | `resolveCoreAfterRoomDiscoveryText`, `eventTraitCheck`, `roomDiscoveryCards`, `drawnCard`, `possessionOrderByKind`, 后续 `discoveryResolutionQueue` |
| 17 | 探索失败边界 | 区域不匹配房间要掩埋继续翻；区域耗尽不耗移动、不结束回合；放置后要保持未来可探索；最后同区域死路房需要先最小调整已有板块 | 已补区域不匹配、区域耗尽、封死区域重抽、耗尽短提示和最小调整已有板块选择；四条代表失败边界均已补真实入口 E2E、截图核验和服务器相册；当前调整候选覆盖“移动一个已有同区域房间并重接入口”的最小合法切片，不外推为所有桌面极端调整方案 | `RoomDrawResolution`, `buriedRoomTiles`, `regionOpenDoorways`, `pendingRoomPlacementFailure`, `requiresTileAdjustment`, `roomTileAdjustment` |
| 18 | 移动规则细节 | 回合开始锁移动力；门位才相邻；强制移动由执行效果者决定移动多远；障碍物影响离开成本 | 回合开始移动力、门位连接、房间障碍标记、作祟后敌对探索者 / 怪物离开成本已有领域覆盖；面具代表链已覆盖执行者指定每个目标去向；仍缺通用强制移动合同和路径预览显示 | `turnStartSpeed`, `roomConnections`, `targetRoomIdsByTokenId`, `ForcedMoveInteraction`, `movementCost`, `resolveBetrayalMoveCost` |
| 19 | 骰子与检定类型 | 属性检定、作祟检定、普通掷骰、攻击检定适用不同修正和结果表 | 混成一个 roll 会导致卡牌修正错用 | `rollKind`, `TraitRollRequest`, `HauntRollRequest`, `AttackResolution` |
| 20 | 治疗 / 伤害 / 死亡 | 治疗回绿色起点；伤害按属性轨步数分配；作祟前临界不死，作祟后到骷髅死亡 | 裸数值加减会错过重复数值、临界和死亡边界 | `TraitTrackModel`, `DamageAllocationInteraction`, `deathState` |
| 21 | 交易限制 | 同房间、双方同意、每回合一次、任意数量；本回合用过特殊行动的物品 / 预兆和攻击过的武器不能交易 | 已有请求 / 同意 / 拒绝 / 任意数量 / 每回合一次 / 狗交易；新增 `resolveBetrayalTradeCardStatus` 统一单卡可交易状态和原因；仍需 UI 牌面禁用提示完全收口 | `TradeAgreementInteraction`, `tradeUsedThisTurn`, `resolveBetrayalTradeCardStatus`, `usedCardIdsThisTurn` |
| 22 | 攻击与武器 | 作祟后才攻击；每回合一次；默认力量；武器必须声明，最多一件，可不用；远程武器需要视线 | 武器声明代表链、基础视线读模型、远程武器领域校验代表链和牌桌目标高亮 / 视线线条代表链已有单测；通用英雄 / 叛徒目标校验会允许远程武器攻击视线内非同房间目标，徒手和近战仍限同房间；选中弩后牌桌会高亮并连线视线内非同房间叛徒，且已补弩真实入口 E2E、截图核验和服务器相册；魔法相机幻影摄影师视线攻击已补目标选择、视线连线、骰盘和相册代表链；仍缺完整怪物系统、所有怪物视线攻击和真实远程牌面完整录入 | `AttackDeclarationInteraction`, `attackUsedThisTurn`, `lineOfSightGraph`, `resolveBetrayalLineOfSightRoomIds`, `resolveBetrayalAttackTargetPlayerIds`, `rangedAttackWeaponIds` |
| 23 | 偷窃 / 尸体搜刮 | 第三版默认不能靠力量攻击偷物品；死亡留下尸体，同房间每回合可拿一个物品 / 预兆 | 已补基础尸体搜刮代表链：死亡探索者仍保留为尸体对象，同房间存活探索者必须点击尸体并选择具体物品 / 预兆；同一尸体本回合搜刮后入口禁用。当前只证明第一剧本基础链路，不外推为完整死亡 UI、特殊作祟尸体用途或完整怪物尸体系统 | `LOOT_CORPSE`, `resolveCorpseLootTargets`, `corpseLootedByPlayerIdsThisTurn`, corpse token, `betrayal-corpse-loot-card-selector` |
| 24 | 作祟揭示顺序 | 作祟开始先公开读双方介绍和设置，完成公开设置后再按阵营看秘密目标 | 已补作祟揭示代表读模型和牌桌短步骤：一名叛徒作祟显示英雄介绍 / 英雄设置 / 叛徒介绍 / 叛徒设置，无叛徒作祟只显示英雄公开步骤；秘密边界提示“之后分开阅读目标，使用规则时可公开对应文本”。当前仍是代表揭示层，不等于完整 `hauntSetupQueue`、每作祟公开 setup 队列、隐藏叛徒 / 自由混战和段落级 reveal-on-use 完成 | `resolveBetrayalHauntRevealProtocol`, `publicSteps`, `secretBoundary`, `BetrayalHauntRevealCue` |
| 25 | 作祟类型与叛徒选择 | 支持无叛徒、一名叛徒、隐藏叛徒、自由混战；叛徒可能按最高 / 最低属性、回合顺序平局、自愿替代决定 | 只支持“揭秘者是叛徒”会错大量作祟 | `teamModel`, `hiddenRoleState`, `traitorResolver`, `TraitorVolunteerInteraction` |
| 26 | 叛徒能力 | 叛徒可忽略部分伤害性房间效果和事件符号，但不是免疫全部房间文字 | 简化成“叛徒不吃房间效果”会错电梯、滑槽等例外 | `traitorPowers`, room / symbol trigger options |
| 27 | 怪物系统 | 怪物按类型掷移动、通常受伤击晕、不能持有物品 / 预兆、不能探索新房间，有些作祟改写 | 只把怪物当敌方探索者会错移动、受伤、行动限制 | `monsterDefinitions`, `monsterMovementRollByType`, `monsterStatus`, `monsterActionSet` |
| 28 | 作祟 token / 重要地点 | 每个作祟的 token、重要房间、搜索房间堆、重洗和计数轨都要有状态真相 | 只画 marker 不够，必须知道 owner、位置、可见性、能否拾取 / 攻击 / 交易 | `tokenInstances`, `tileStackSearch`, `numberTracks[]` |
| 29 | 50 个作祟逐条合同 | 1/3/12/33 只能作为代表链；50 个作祟都要独立拆公开 / 私密 / setup / 目标 / 特殊行动 / 怪物 / 终局 | 代表链通过不能证明正式游戏完成 | `docs/games/betrayal/haunts/*`, `hauntDefinitions`, 每作祟 E2E / 截图 |
| 30 | 终局与胜利文本 | 首个达成目标的阵营获胜，展示对应 If You Win 文本；同时达成 / 平局由作祟定义处理 | 只给通用胜负页会漏作祟专属结局 | `winningSide`, `endingTextId`, `sys.gameover` |

## 3. 交互执行顺序

1. 先做 `ScenarioSelectionInteraction`，因为它决定后续作祟入口不能再假装完整。
2. 再做 `TraitTrackModel`，因为属性轨会影响移动、检定、伤害、死亡和叛徒判定。
3. 再做 `HauntRiskStatus`，这是作祟前玩家需要持续理解的风险关系，且实现成本低于空间系统。
4. 再做 `RoomPlacementInteraction`，替换自动朝向，并为后续完整空间数据打底。
5. 最后重排伤害、交易、特殊行动、武器声明等局部交互，避免在旧裸数值模型上补 UI。

## 4. P0 交互详细设计

### 4.1 共同选择剧本卡

- 玩家目标：所有玩家在创建对局 / 角色选择前看到五张候选剧本卡，并明确决定本局使用哪一张。
- 默认交互：房主或当前 setup 主持者点选一张剧本卡作为提议；其他玩家看到“待确认 / 已同意”；全部确认后锁定本局剧本。若后续要简化，只能标为用户批准的代表 MVP。
- 状态模型：`setup.scenarioCandidates` 存五张候选；`setup.proposedScenarioId` 存当前提议；`setup.scenarioConfirmations` 存玩家确认；`core.scenarioId` 只在确认后写入。
- UI 承接：剧本卡必须作为可点对象展示；常驻主 UI 只显示短状态，例如“选择剧本卡”“等待确认”；完整介绍放剧本卡详情或剧本书，不写成长说明栏。
- 错误处理：非法剧本、未在候选池、重复确认、未确认就开始游戏都必须被拒绝并给出短提示。
- 验收点：setup 单测覆盖候选池、非法选择和确认锁定；页面测试覆盖从剧本选择进入角色选择。

### 4.2 探索者属性轨

- 玩家目标：属性提升 / 下降移动的是角色面板上的夹子位置，当前数值由位置派生，而不是裸数值直接加减。
- 默认交互：正常状态下角色板展示四条属性轨和当前夹子；治疗、奖励、伤害分配时高亮将要移动的属性和移动后的后果。
- 状态模型：每个探索者保存 `traitTracks[trait] = { trackId, position }`，轨道定义保存 `values`、起始位置、临界位置、最高位置和骷髅位置；`currentTraits` 是派生读模型。
- UI 承接：属性轨使用角色板本体承接，不用单独数字芯片替代。伤害分配时要预览“力量 -1 步 / 速度 -2 步”及是否到临界或死亡。
- 错误处理：超过上限不再提升；作祟前伤害不把探索者推入死亡；作祟后任一属性到骷髅触发死亡检查。
- 验收点：单测覆盖非线性轨、上限、临界、作祟前不死、作祟后死亡；页面测试覆盖一次伤害分配预览。

### 4.3 预兆总数与作祟风险条

- 玩家目标：玩家在抽预兆前后都能理解“当前所有玩家持有的预兆总数会决定本次作祟检定掷几颗骰，5+ 开始作祟”。
- 默认交互：主 HUD 或牌堆区显示短风险条：`预兆 N / 掷 N 颗 / 5+ 作祟`。抽到预兆时，检定弹层复用同一数值，不另算一套。
- 状态模型：预兆总数从所有探索者持有的预兆派生；若为了动画或复盘缓存，缓存字段必须能回查到持有物真相。
- UI 承接：风险条是常驻或半常驻短状态；抽牌详情和日志只做补充，不能成为唯一承接。
- 错误处理：多人持有预兆、交易预兆、死亡掉落预兆后，总数和下一次骰数必须同步；作祟开始后风险条切换为“已作祟”，不再提示作祟检定。
- 验收点：单测覆盖多人预兆总数和交易后变化；页面测试覆盖风险条与检定骰数一致。

### 4.4 房间探索、放置与朝向

- 玩家目标：玩家从当前房间的未探索走廊进入，翻出匹配区域的新房间，并决定新板块哪个走廊连到入口。
- 默认交互：玩家先点地图上的未探索走廊；系统翻找匹配区域房间；出现新房间预览、入口边和可连接边高亮；玩家旋转 / 选择朝向后确认放置。
- 状态模型：运行态保存房间实例、区域、朝向、入口门位、连接边和仍可探索门位；掩埋记录单独保存，不能只存在日志。
- UI 承接：地图入口边必须高亮；新房间预览可旋转；合法连接显示为绿色或同场景可操作色；非法朝向不可确认。
- 错误处理：区域不匹配的房间进入掩埋记录并继续翻；会封死区域的候选房间记录为封死掩埋并继续翻；区域耗尽时不消耗移动力，并回到移动态；无合法连接时不能放置。
- 验收点：单测覆盖匹配、区域不匹配掩埋、封死区域重抽、耗尽不消耗移动、非法朝向；真实页面测试覆盖一次玩家旋转确认。

### 4.5 探索后结束回合与移动力快照

- 玩家目标：回合开始时先按速度确定本回合移动力；中途速度变化不刷新本回合移动力；探索并结算新房间后回合结束。
- 默认交互：HUD 显示 `本回合移动力 X / 剩余 Y`；属性变化后如果速度变了，HUD 继续显示本回合剩余移动，并用短提示说明“下回合生效”。探索结算完成后主动作切换为“结束回合”。
- 状态模型：`turnStartSpeed` 和 `movesRemaining` 在回合开始写入；速度轨变化只改变派生属性，不改本回合快照。
- UI 承接：移动力在 HUD 承接；探索结算不靠日志收尾，而是由行动区明确进入结束回合态。
- 错误处理：探索失败 / 区域耗尽不触发回合结束；探索成功但卡牌结算未完成时不能结束结算链。
- 验收点：单测覆盖中途速度变化不刷新移动力、探索失败不结束回合、探索成功结算后结束回合。

### 4.6 伤害分配

- 玩家目标：受到物理、精神或一般伤害时，玩家按规则在允许属性之间分配点数，并能看到属性轨后果。
- 默认交互：出现伤害分配面板；物理伤害只开放力量 / 速度，精神伤害只开放知识 / 神志，一般伤害按效果开放；玩家用加减或点轨方式分配，确认后结算。
- 状态模型：交互快照保存伤害类型、总点数、可选属性、已分配点数、来源和受伤者；正式属性改变仍走属性轨事件。
- UI 承接：面板必须展示属性轨预览，不只展示“伤害 2”；确认按钮只有在分配总数合法时可用。
- 错误处理：非法属性、分配不足、分配过量、死亡边界、作祟前临界停留都必须被拒绝或正确结算。
- 验收点：单测覆盖所有伤害类型和非法分配；页面测试覆盖一次真实分配到属性轨。

### 4.7 交易、特殊行动与武器声明

- 玩家目标：同房间探索者能交易任意数量物品 / 预兆且双方同意；每回合只能做一次特殊行动；攻击时玩家声明是否使用一件合法武器。
- 默认交互：交易是双方确认的多选交换；特殊行动按钮从物品 / 预兆本体进入，显示禁用原因；攻击流程先选目标，再选择“不使用武器 / 使用某一件合法武器”，最后确认。
- 状态模型：交易快照保存发起方、目标方、给出 / 拿取列表和双方确认；特殊行动保存本回合已用来源；攻击声明保存目标、属性、武器选择和本回合开始时持有物快照。
- UI 承接：持有物卡牌本体承接交易和特殊行动；武器选择在攻击面板承接；不能用默认第一件武器或自动不使用武器替玩家决定。
- 错误处理：不同房间不能交易；空交易需要明确允许或拒绝；同回合第二次特殊行动禁用；本回合刚获得武器不可用于攻击；攻击后本回合用过的武器不可交易。
- 验收点：交易 E2E 覆盖双方确认和拒绝；单测覆盖特殊行动额度、多武器选择、刚获得武器和攻击后交易限制。

### 4.8 作祟揭示与代表剧本边界

- 玩家目标：作祟触发后，系统用开局选定的剧本卡和触发预兆确定作祟编号、作祟揭秘者、叛徒规则和公开设置入口。
- 默认交互：先出现公开揭示层，短标签说明“作祟开始”“剧本卡 + 触发预兆 -> 作祟编号”；完成公开介绍和设置后，才进入英雄 / 叛徒各自剧本书。
- 状态模型：`scenarioRuntime.hauntCardNumber`、`hauntRevealerPlayerId`、`triggeringOmenId`、`traitorPlayerId`、阵营公开 / 隐藏策略必须可追溯。
- UI 承接：揭示层和剧本目标条承接阶段切换；剧本书是可回看和阅读入口，不是唯一继续按钮。
- 错误处理：没有选定剧本卡时不能揭示完整作祟，只能停在代表 MVP；未知预兆映射必须标为 blocked 或 representative-only。
- 验收点：单测覆盖剧本卡 + 预兆映射；页面测试覆盖作祟公开揭示、设置完成和剧本书进入。

## 5. 实施前禁止项

- 禁止继续把单剧本选项说成完整剧本选择。
- 禁止继续用裸数值直接代表属性轨完整规则。
- 禁止用作祟结果详情或日志替代作祟风险表达。
- 禁止把房间自动朝向说成玩家已决定放置方向。
- 禁止用 E2E 绿灯证明本矩阵未覆盖的基础规则已完成。

## 6. 下一步实施拆分建议

| 实施批次 | 内容 | 可验证出口 |
| --- | --- | --- |
| A | 剧本候选池和选择 UI / 状态 | setup 单测 + 建房/角色选择页面测试 |
| B | 属性轨模型和派生适配器 | 属性轨单测 + 现有角色板回归 |
| C | 作祟风险条 | recent roll 单测 + 页面风险条截图 / DOM 断言 |
| D | 房间放置朝向交互 | 领域合法性测试 + 真实页面旋转确认 E2E |
| E | 伤害分配 / 交易 / 特殊行动整合 | 对应局部交互测试和核心 E2E 回归 |
| F | 攻击 / 武器 / 视线 / 障碍物 / 尸体搜刮 / 怪物通用合同 | 单测 + 代表作祟 E2E + 截图 |
| G | 作祟揭示、叛徒选择、秘密可见性和 50 个作祟逐条合同 | 子账本 + 单测 + 每作祟真实入口证据 |

## 7. 已实现切片证据索引

| 切片 | 已覆盖内容 | 证据 |
| --- | --- | --- |
| 房间放置朝向交互 | 玩家点未知门位后进入朝向选择面板，可旋转房间、确认合法入口门连接，并把 `orientationTurns` 保存到房间实例 | `evidence/betrayal-core-interactions/room-placement-orientation/e2e-test.md`；服务器相册 `http://8.148.71.102:18080/#/boardgame/betrayal-room-placement-orientation` |
| 移动力快照 | 回合开始锁定速度和剩余移动；真实移动后剩余减少；奇怪的药品提升速度后 HUD 仍显示 `2/3`；结束回合后下位玩家重新锁定为 `5/5` | `evidence/betrayal-core-interactions/movement-snapshot/e2e-test.md`；服务器相册 `http://8.148.71.102:18080/#/boardgame/betrayal-movement-snapshot` |
| 普通交易每回合一次 | 普通同房间交易必须先提出请求并等待接收方同意；同意结算后发起方本回合普通交易额度锁定，交易按钮禁用；结束回合后下一名玩家交易额度恢复 | `evidence/betrayal-core-interactions/trade-turn-limit/e2e-test.md`；服务器相册 `http://8.148.71.102:18080/#/boardgame/betrayal-trade-turn-limit` |
| 基础尸体搜刮 | 死亡探索者不被删除，仍作为尸体对象留在同房间；同房间存活探索者通过正式 `搜尸` 动作点选尸体和具体物品 / 预兆，每回合从同一尸体拿 1 张后禁用二次搜刮 | `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "尸体上的 Item/Omen|搜尸前置态" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，2 passed / 178 skipped；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "搜尸必须" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，1 passed / 79 skipped；`node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/first-scenario-corpse-loot.e2e.ts`，1 passed；证据：`evidence/betrayal-first-scenario-corpse-loot/betrayal-first-scenario-corpse-loot-e2e-test.md`；服务器相册 `http://8.148.71.102:18080/#/boardgame/betrayal-first-scenario-corpse-loot` |
| 作祟揭示顺序 / 秘密边界代表链 | 作祟开场揭示层读取同源 `resolveBetrayalHauntRevealProtocol`：一名叛徒作祟先列英雄公开介绍 / 设置，再列叛徒公开介绍 / 设置；无叛徒作祟不列叛徒公开步骤；牌桌在自动打开剧本书时仍保留公开步骤短标签和“分开阅读目标 / 使用规则时可朗读”的秘密边界提示；首剧本只写“作祟开始”也会被识别为作祟开场 | `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "作祟揭示|秘密|公开" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，3 passed / 179 skipped；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "作祟揭示|剧本书|首剧本作祟" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，4 passed / 77 skipped；`npx eslint src/games/betrayal/Board.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx e2e/betrayal/haunt-reveal-protocol.e2e.ts`，0 errors；`node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/haunt-reveal-protocol.e2e.ts`，2 passed；证据：`evidence/betrayal-core-interactions/haunt-reveal-protocol/e2e-test.md`；服务器相册 `http://8.148.71.102:18080/#/boardgame/betrayal-haunt-reveal-protocol` |
| 攻击与武器声明代表链 | 真实页面先点攻击动作进入目标选择；可选择徒手、砍刀、指环或匕首；攻击骰盘记录武器 / 伤害类型 / 匕首速度花费；攻击结算后回到同一玩家牌桌继续可操作，不自动结束回合 | `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，166 passed；`npm run test:e2e:ci:file -- e2e/betrayal/non-p0-representative.e2e.ts`，6 passed；关键截图目录：`evidence/betrayal-non-p0-representatives`、`evidence/山屋惊魂-无武器攻击完整链路`、`evidence/山屋惊魂-指环神志攻击完整链路`、`evidence/山屋惊魂-匕首攻击完整链路` |
| 基础视线读模型 | 房间视线按同楼层、同一直线、连续已发现板块派生；同一板块可见、跨楼层不可见、未发现目标不可见、中间断点会阻断远端目标 | `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "基础视线" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，1 passed |
| 远程武器视线攻击领域 + 目标高亮 / 视线线条代表链 | 远程武器可攻击视线内非同房间目标；徒手和砍刀仍不能跨房间；远程武器攻击视线外目标会被拒绝；牌桌攻击入口会按声明武器派生目标，选中弩后视线内非同房间叛徒会同时高亮和连线；当前不证明怪物攻击或真实远程牌面完整录入 | `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "远程武器" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，1 passed；`-t "视线|远程武器|砍刀|匕首|指环|攻击"`，19 passed / 161 skipped；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "弩" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，1 passed；当前完整 Board 回归 79 passed；本轮新增线条后定向弩组件验证 1 passed / 78 skipped，完整 Board 回归 79 passed，`-t "远程武器|视线"` 领域回归 3 passed / 177 skipped；真实入口 E2E：`$env:PW_USE_DEV_SERVERS='false'; $env:PW_ALLOW_DEV_SERVER_TESTS='false'; npm run test:e2e:ci:file -- e2e/betrayal/non-p0-representative.e2e.ts "弩远程视线"`，1 passed；证据：`evidence/山屋惊魂-弩远程视线完整链路/e2e-test.md`；服务器相册 `http://8.148.71.102:18080/#/boardgame/betrayal-crossbow-line-of-sight` |
| 魔法相机幻影摄影师视线攻击代表链 | 幻影摄影师作为魔法相机剧本怪物，可攻击视线内任意英雄；牌桌会从同源作祟目标读模型派生可攻击英雄，队友卡 / 地图 token 可切换目标，目标态显示非交互视线线，点击主动作进入神志攻击骰盘；当前只证明该剧本代表链，不证明完整怪物系统、所有怪物视线攻击、真实远程牌库完整录入或 50 个作祟完成 | `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "多个幻影摄影师目标" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，1 passed / 79 skipped；真实入口 E2E：`$env:PW_USE_DEV_SERVERS='false'; $env:PW_ALLOW_DEV_SERVER_TESTS='false'; npm run test:e2e:ci:file -- e2e/betrayal/non-p0-representative.e2e.ts "幻影摄影师视线攻击"`，1 passed；证据：`evidence/山屋惊魂-幻影摄影师视线攻击完整链路/e2e-test.md`；服务器相册 `http://8.148.71.102:18080/#/boardgame/betrayal-phantom-photographer-line-of-sight` |
| 基础障碍物移动成本 | 离开带障碍标记房间耗 2 移动；作祟后同房间敌对探索者会形成障碍；英雄同房间怪物会形成障碍；校验和实际扣移动力共用 `resolveBetrayalMoveCost` | `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "障碍物" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，5 passed；完整领域回归 170 passed |
| 持有物特殊行动预算读模型 | 持有物主动特殊行动、被动效果、已用过、本回合新获得不可立刻使用，都由 `resolveBetrayalPossessionSpecialActionStatus` 给出统一状态和原因 | `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "特殊行动|主动使用|通用使用入口|本回合新获得" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，11 passed / 159 skipped；完整领域回归 170 passed；ESLint 0 errors / 6 existing warnings |
| 房间特殊行动状态读模型 | 神秘电梯房间效果由 `resolveBetrayalRoomSpecialActionStatus` 给出可用、已用、本回合探索后结束、错误房间等状态原因；`USE_ROOM_EFFECT` 校验复用同一读模型 | `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "神秘电梯|房间效果" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，2 passed / 168 skipped；完整领域回归 170 passed；ESLint 0 errors / 6 existing warnings |
| 卡牌结算顺序 / 掩埋语义 | 事件牌从事件牌堆顶结算后放回底部，事件牌堆数量不减少且不进入弃牌；物品 / 预兆只有实际获得才离开对应牌堆；器械库展示出的非武器物品牌掩埋回物品牌堆底部；兔脚重掷事件效果时恢复持有牌牌堆顺序快照 | `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "事件牌结算后|器械库|兔脚|小机器人|说“茄子”|最深的壁橱|抽到预兆|最后一张恶兆" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，18 passed / 161 skipped；完整领域回归 179 passed；ESLint 0 errors / 6 existing warnings |
| 房间文字先于事件 / 符号结算 | 探索到书房时，发现文字先把知识属性轨前进 1 步；随后抽到外星几何时，事件知识检定按提升后的知识值投 4 骰，命中“获得 1 点知识”分支；探索到器械库且房间符号为物品时，先展示到武器并获得砍刀，非武器展示牌掩埋回底部，再按物品符号另抽手电筒；牌桌发现详情不再只显示最后一张符号抽牌，会同时显示器械库获得砍刀和展示牌掩埋；属性变化和牌堆变化仍只在 `ROOM_EXPLORED` 落地一次 | `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "房间文字提升属性" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，1 passed / 176 skipped；`-t "器械库"`，2 passed / 176 skipped；探索结算相关回归：`-t "房间文字|图书馆|书房|器械库|外星几何|抽到预兆|最后一张恶兆|区域不匹配|封死|调整已有板块|区域房间池耗尽"`，21 passed / 157 skipped；卡牌结算顺序定向回归 18 passed / 161 skipped；发现详情组件定向验证 1 passed / 78 skipped；当前完整领域回归 180 passed；当前 Board 全量回归 79 passed；ESLint 0 errors / 28 existing warnings；OpenSpec valid |
| 作祟特殊行动预算读模型 / UI 禁用原因 | 作祟特殊行动由 `resolveBetrayalHauntSpecialActionStatus` 给出可用、已用、作祟阶段和角色存活原因；Board 作祟主动作按钮在已用状态下保留对应入口并禁用，`data-action-disabled-reason` / `title` / 行动提示同步显示预算原因；灰尘剧本“寻找解药”已用状态已补真实页面截图和服务器相册 | `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "特殊行动|作祟特殊行动|寻找解药|治愈灰尘|疾病交换|调查杰克|研究驱魔|驱魔|魔法相机|献祭" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，21 passed / 154 skipped；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "作祟入口显示统一预算禁用原因|寻找解药" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，2 passed / 75 skipped；合并回归 252 passed；新增真实入口 E2E：`e2e/betrayal/haunt-special-action-budget.e2e.ts`，1 passed；证据：`evidence/betrayal-core-interactions/haunt-special-action-budget/e2e-test.md`；服务器相册 `http://8.148.71.102:18080/#/boardgame/betrayal-haunt-special-action-budget`；ESLint 0 errors / existing warnings |
| 区域耗尽安全守门 / 玩家短提示 | 对应楼层发现池为空时，房间放置预览返回空，探索命令被拒绝，且原移动力、回合结束状态和未探索门位保持不变；牌桌选择该未知门位时显示“{{楼层}}房间已耗尽”，不打开放置面板 | `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "区域不匹配|封死|调整已有板块|区域房间池耗尽" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，4 passed / 172 skipped；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "区域耗尽|区域不匹配|调整已有板块|探索放置" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，3 passed / 75 skipped；真实入口 E2E：`e2e/betrayal/room-discovery-failures.e2e.ts`，4 passed；截图证据：`evidence/betrayal-core-interactions/room-discovery-failures/e2e-test.md`；服务器相册 `http://8.148.71.102:18080/#/boardgame/betrayal-room-discovery-failures`；ESLint 0 errors / existing warnings |
| 统一房间堆翻找 / 区域不匹配、封死区域掩埋与调整已有板块 | 正式探索按统一房间堆顺序翻找；区域不匹配的塔楼、储物间被记录为 `areaMismatch` 并放回堆底，继续翻到当前区域火炉房；会封死同区域开放走廊的测试死路房被记录为 `sealedRegion` 并继续翻到测试开放房；若这是最后一张同区域房间且放置会封死区域，则放置面板列出最小调整候选，玩家选择后可确认放置，且区域仍保留开放走廊 | `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "区域不匹配|封死|调整已有板块|区域房间池耗尽" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，4 passed / 172 skipped；牌桌完整选择定向验证 3 passed / 75 skipped；真实入口 E2E：`e2e/betrayal/room-discovery-failures.e2e.ts`，4 passed；截图证据：`evidence/betrayal-core-interactions/room-discovery-failures/e2e-test.md`；服务器相册 `http://8.148.71.102:18080/#/boardgame/betrayal-room-discovery-failures`；ESLint 0 errors / existing warnings |
| 交易卡状态读模型 | 普通交易和狗交易校验复用 `resolveBetrayalTradeCardStatus`，单卡状态能区分可交易、已用过、狗作为交易来源不能同时交易、持有物不存在 | `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "普通交易|同房间交易|狗交易|交易卡状态|本回合不能交易" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，10 passed / 162 skipped；完整领域回归 172 passed；ESLint 0 errors / 6 existing warnings |
| 强制移动 owner 代表链 | 面具特殊行动由执行者为同房间探索者和怪物分别指定目标房间，不能让被移动者决定，也不能移动到未发现房间 | `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "面具" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`，4 passed / 168 skipped；ESLint 0 errors / 6 existing warnings |

> 注意：本表只证明已登记切片完成；卡牌结算顺序 / 掩埋语义目前是领域代表链加牌桌合并摘要，不等于完整阻塞式牌面逐步确认 UI；基础视线读模型和远程武器领域校验 / 目标高亮 / 视线线条代表链即使已补弩真实入口 E2E 和相册证据，也不等于真实远程牌面完整录入完成；魔法相机幻影摄影师视线攻击即使已补目标切换、视线线、骰盘、E2E 和相册证据，也只证明该剧本代表链，不等于完整怪物系统或所有怪物视线攻击完成；基础障碍物移动成本不等于完整怪物系统或路径预览完成，基础尸体搜刮只证明第一剧本同房间尸体拿 1 张物品 / 预兆的代表链，不等于完整死亡 UI、特殊作祟尸体用途或完整怪物尸体系统完成；作祟揭示顺序 / 秘密边界代表链只证明揭示层短步骤、无叛徒分支和基础秘密边界提示，不等于完整 `hauntSetupQueue`、每作祟公开 setup、隐藏叛徒 / 自由混战或段落级 reveal-on-use 完成；强制移动 owner 代表链不等于所有强制移动都已有路径预览，作祟特殊行动预算已用状态的真实入口证据只覆盖灰尘剧本“寻找解药”，不等于全部特殊行动或全部作祟完成，区域耗尽 / 区域不匹配 / 封死区域重抽 / 最小调整已有板块四条探索失败边界已补真实入口 E2E 和相册证据；其中最小调整只证明“选择一个已有板块调整并确认放置”的代表合法切片，不等于完整探索规则或所有现实桌面极端调整方案完成，交易卡状态读模型不等于交易 UI 牌面禁用提示完全完成，怪物系统和 50 个作祟逐条合同仍需继续推进。
