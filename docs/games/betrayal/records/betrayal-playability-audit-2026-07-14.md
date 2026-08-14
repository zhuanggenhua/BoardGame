# 山屋惊魂可玩性与端到端审计（2026-07-14）

> 2026-07-29 接续裁定：本文是旧可玩性 / 端到端审计入口，正文里的“当前 23 张事件牌”“12 张发现池物品”“23 张运行持有牌”等说法只代表当时首剧本与页面链路现场，不是当前整牌库数量口径。当前发现牌整牌库主合同是 `evidence/betrayal/full-audit/full-deck-data-intake-contract.md`：43 张事件、22 张物品、9 张预兆；本文不得作为阻止 S0 合同层继续补证的理由，也不得作为整牌库完成或当前 UI/E2E/截图验收证据。

## 本轮前提

- 问题对象：山屋惊魂首剧本与事件牌/发现牌交互链，尤其是“牌翻出来 -> 选择 -> 投骰或结算 -> 关闭回牌桌”。
- 真相来源：`src/games/betrayal/scenarioConfig.ts` 的当前事件牌数据合同，后续规则争议必须继续回查官方规则书和卡图录入合同。
- 目标入口：当前仓库 `D:\gongzuo\webgame\BoardGame` 的真实山屋页面 `/play/betrayal` 与 `e2e/betrayal/*.e2e.ts`。
- 验收口径：不能用直接注入最终 `临时事件选择态` 冒充端到端；完整链路必须有真实页面点击、截图链和关闭后状态。

## 正确端到端定义

完整事件牌端到端至少包含 6 个可复查阶段：

1. `触发前`：玩家在牌桌上可行动，能看见当前房间和可探索入口。
2. `选择触发对象`：如果需要选择未知房间、目标房间、目标卡牌，必须点击真实对象本体或贴合高亮。
3. `牌翻出来`：画面能看见同一张事件牌/发现牌的牌面或正式替代牌面，不是只出现文字临时态。
4. `中间选择/投骰`：按规则真实时序显示；先选择后判定的，选择前不得已有本次投骰；先判定后选择的，选择前必须能看见本次投骰结果。
5. `结算结果`：玩家能看见本次选择造成的现实结果，例如属性变化、伤害分配、移动到哪个房间、抽到哪类牌。
6. `关闭后`：阻塞面板已退场，牌桌可继续操作；临时选择态 已清空，不能只关 UI 不清状态。

每一段都必须同时写清 `玩家实际动作`、`自动断言`、`截图文件`、`回应的用户目标`。如果某一段没有截图或断言，当前对象只能记为“阶段承接通过”或“阶段承接链路”，不得写成“完整端到端通过”。

| 阶段         | 玩家实际动作                                     | 必须断言的现实结果                                         | 截图必须看见                        | 用户目标对应               |
| ------------ | ------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------- | -------------------------- |
| 触发前       | 在真实牌桌准备探索、使用物品、交易或执行剧本动作 | 当前入口可见、权限正确、牌桌可操作                         | 房间/角色/持有物/动作入口在同一画面 | 证明不是直接注入中间状态   |
| 选择触发对象 | 点击真实未知房间、持有物、队友、骰子或贴合高亮   | 点击落在对象本体；代理按钮没有替代正式主路径               | 被点对象和高亮边界                  | 证明玩家真的能点到目标     |
| 牌翻出来     | 由上一步触发后出现事件、预兆、物品或发现面板     | 牌名、牌面/正式替代牌面、来源链正确                        | 翻出的牌和当前牌桌上下文            | 证明“牌翻出来”属于同一次链 |
| 选择或投骰前 | 按规则时序进入选择或检定                         | 先选择后投骰时没有本次骰盘；先投骰后选择时已有本次投骰依据 | 当前选择项、骰盘或其明确缺席        | 证明规则时序没有反         |
| 选择/投骰后  | 真实选择属性/目标/骰子，或等待物理骰停稳         | 选项值、目标、高亮、骰面、属性或资源变化可追溯             | 选择结果、骰面或目标对象            | 证明不是只点按钮无后果     |
| 结算结果     | 确认并等待结算落地                               | 伤害、移动、交易物、物品消耗、属性变化、作祟或终局已显示   | 结算文案和对应现实对象变化          | 证明结果与用户目标有关     |
| 关闭后       | 关闭发现/结算/阻塞面板回到牌桌                   | 面板退场、临时状态清空、主界面可继续操作                   | 回牌桌后的完整主画面                | 证明链路收口，不是停在弹层 |

## 事件牌时序家族清单

当前数据合同里需要交互承接的事件牌分组如下：

| 时序家族                 | 事件牌                                                                                                                           | 当前应验内容                                                                              | 当前证据状态                                                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 先选择属性再投检定       | 上古旧宅、夜幕众星                                                                                                               | 牌先翻出，选择前没有本次骰盘；确认后才出现对应属性检定和结算；最后关闭回牌桌              | 已补完整链路 E2E，截图 01-06                                                                                                                                |
| 先投检定再选择后续效果   | 蜘蛛！、一条秘密通道、脑状食品                                                                                                   | 牌翻出后已有本次检定结果；只有命中分支后才显示属性/房间/伤害选择；最后关闭回牌桌          | 蜘蛛！、一条秘密通道、脑状食品已补完整链路                                                                                                                  |
| 可选是否触发判定/作祟    | 说“茄子”！、肉质苔癣、一抹鲜红、一瓶微尘、大宅饿了                                                                               | 牌翻出后显示是否触发；若选择触发，必须看到作祟/事件投骰；若跳过，必须看到跳过后的规则后果 | 说“茄子”！、肉质苔癣、一抹鲜红、一瓶微尘、大宅饿了均已补真实翻牌完整链；其中说“茄子”！和一抹鲜红覆盖选择作祟检定、投作祟骰、失败奖励结算、关闭回牌桌        |
| 自动多属性检定后选择奖励 | 吊死鬼                                                                                                                           | 牌翻出后应先完成四属性检定；只有全部通过才进入奖励属性选择；最后关闭回牌桌                | 已补真实翻牌完整链：牌翻出后四项检定全过，选择知识奖励，结算知识 +1，关闭后回牌桌                                                                           |
| 投骰后直接结算           | 标本剥制、外星几何、小丑房间、咬一口！、电话铃声、小机器人、嘎吱的木门、最深的壁橱、磁带播放器、在你背后！、一种怪异的感觉、葬礼 | 牌翻出、投骰、结算、关闭；无额外选择时不能出现空选择壳                                    | 12/12 已补真实翻牌完整链：每张都覆盖探索前、选择未知房间、事件牌翻出、投骰/检定停稳、结算结果、关闭回牌桌；不得再把“四个代表”当作该家族未逐张完成的当前结论 |

## 预兆全家族矩阵

预兆当前数据合同为 9 张。圣符翻出作祟链、圣符探索声明链、狗远距交易链、面具移动链、盔甲物理减伤链、书本非战斗检定替代链、雕像探索声明链、头骨死亡保护双分支链、指环神志攻击链和匕首攻击链均已单列收口；攻击骰盘另有无武器攻击链已单列收口；这些结论只证明各自对象，不外推成其它骰盘分支或山屋整体完成。

| 预兆 | 规则效果 / 交互点                                                                     | 当前证据状态                                                                                                                      | 当前边界 / 判等依据                                                                           |
| ---- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 书本 | 知识检定被动 +1；可花费神志把下一次非战斗检定改用知识                                 | 已有真实六段 E2E：点击书本本体、花 1 神志建立一次性替代状态、探索翻出小丑房间、5 骰神志检定、替代状态消费、关闭回牌桌             | 已收口本对象；不外推头骨、雕像、指环、匕首或魔法相机                                          |
| 狗   | 速度检定被动 +1；允许 4 格内远距交易                                                  | 已有真实六段 E2E：选择多张持有物、切到 4 格内队友、点击地图队友 token、确认、结算、清空状态                                       | 已收口本对象；不外推面具、书本、盔甲、指环或匕首                                              |
| 面具 | 速度检定被动 +1；移动同板块其他角色到相邻板块                                         | 已有真实六段 E2E：点击面具本体、选择同板块队友、选择相邻房间、确认、移动结算、清空状态                                            | 已收口本对象；不外推书本、盔甲、指环或匕首                                                    |
| 头骨 | 知识检定被动 +1；死亡时投 3 骰，4+ 阻止死亡                                           | 已有真实双分支六段 E2E：攻击前牌桌、真实叛徒 token 目标高亮、死亡保护 3 骰停稳、结果可见、阻止死亡/正常死亡落位、回牌桌或继续查看 | 已收口本对象两条链：阻止死亡分支；未阻止死亡正常死亡分支；不外推指环、匕首或其它死亡/攻击骰盘 |
| 圣符 | 神志检定被动 +1；翻出预兆后立即作祟判定；探索声明可埋葬第一张发现板块并继续发现下一张 | 预兆翻出到作祟判定再关闭回牌桌已 L3 六段收口；探索声明也已 L3 六段收口                                                            | 已收口本对象两条链：翻出作祟链；声明、取消、重新声明、探索替换、事件结算、关闭回牌桌链        |
| 盔甲 | 受到物理伤害时减 1                                                                    | 已有真实六段 E2E：盔甲持有规则可见、电话铃声翻出、物理伤害骰盘停稳、减伤后属性变化正确、关闭回牌桌                                | 已收口本对象；不外推头戴耳机精神减伤、头骨死亡保护或其它预兆                                  |
| 雕像 | 力量检定被动 +1；探索声明可跳过事件                                                   | 已有真实六段 E2E：声明前牌桌、雕像探索声明选中、选择未知房间、事件被跳过、力量未扣且事件未弃置、关闭后回牌桌                      | 已收口本对象；不外推圣符、头骨、指环或匕首                                                    |
| 指环 | 神志检定被动 +1；可用神志攻击并造成精神伤害                                           | 已有真实六段 E2E：攻击前牌桌、指环武器已选中、叛徒目标高亮、4 骰神志攻击停稳、精神伤害结算、回牌桌继续可操作                    | 已收口本对象；无武器攻击另有独立链；不外推匕首、头骨死亡保护或其它攻击骰盘                    |
| 匕首 | 攻击多 2 骰并花费 1 速度                                                              | 已有真实六段 E2E：攻击前牌桌、匕首武器已选中、叛徒目标高亮、6 骰攻击停稳、物理伤害和速度花费结算、回牌桌继续可操作              | 已收口本对象；无武器攻击另有独立链；不外推指环神志攻击、头骨死亡保护或其它攻击骰盘            |

## 物品全家族矩阵

发现池物品当前数据合同为 12 个条目；当前运行持有牌另含首剧本开局额外灯笼、日记，合计 23 张运行持有牌。`map / notebook / journal / manuscript` 共享“放置探索者到已发现房间”效果，`flashlight / lantern` 共享事件检定加骰效果。急救包、奇怪的药品、兔脚、头戴耳机、手电筒/灯笼、魔法相机知识检定替代、奇异护符其它作祟设置和骨制钥匙链不能外推为所有物品使用完成。

| 物品                        | 规则效果 / 交互点                                        | 当前证据状态                                                                                           | 当前边界 / 判等依据                                                                        |
| --------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 魔法相机                    | 知识检定可由神志替代；部分作祟事件可由相机持有者成为叛徒 | 已有两条真实六段 E2E：外星几何链证明知识检定由神志替代；说“茄子”！作祟归属链证明魔法相机持有者成为叛徒 | 已收口本对象两条链；不外推书本或手电筒/灯笼效果                                             |
| 急救包                      | 埋葬后治疗自己或同房间队友的属性                         | 已有真实六段 E2E：本体 -> 地图队友 token -> 治疗 -> 清空状态                                           | 已收口本对象；已纳入本轮物品矩阵                                                           |
| 奇怪的药品                  | 埋葬后治疗自己的力量/速度                                | 已有真实六段 E2E：本体 -> 无需目标直接使用 -> 力量/速度恢复 -> 消耗 -> 清空状态                        | 已收口本对象；已纳入本轮物品矩阵                                                           |
| 手电筒 / 灯笼               | 事件检定额外 +2 骰                                       | 已有真实六段 E2E：两对象持有规则可见、外星几何翻出、知识检定为 5 骰、结算知识 +1、关闭回牌桌           | 已收口共享效果两个对象；不外推魔法相机、书本或其它非战斗检定替代能力                       |
| 头戴耳机                    | 受到精神伤害时减 1                                       | 已有真实六段 E2E：头戴耳机持有规则可见、电话铃声翻出、精神伤害骰盘停稳、减伤后属性变化正确、关闭回牌桌 | 已收口本对象；不外推盔甲物理减伤、手电筒/灯笼加骰或其它物品                                |
| 地图 / 笔记本 / 日记 / 手稿 | 埋葬后把探索者放到已发现房间                             | 地图已补六段链；笔记本、日记、手稿已补各自真实页面六段链：本体可见、选中、房间牌目标、目标已选、探索者落位、收口回牌桌 | 已收口共享效果四个对象；同步修正笔记本/日记/手稿显示名，避免 UI 继续把它们叫成地图 |
| 奇异护符                    | 杰克剧本内只作为通用持有物；其它作祟中承载找回/控制权设置 | 已进入 12 张发现池物品守卫和 23 张运行持有牌矩阵；大宅饿了等其它作祟已有奇异护符设置/控制权领域证据 | 杰克剧本内没有专属主动能力；不应被误判为杰克剧本漏做主动效果 |
| 兔脚                        | 最近一次投骰后重掷一颗骰；也可作为普通交易物             | 交易链证明兔脚可作为交易物完整结算；重掷链已补六段：最近投骰、兔脚本体、骰子目标、重掷、结算、收口     | 已收口兔脚重掷本对象；不外推为其它改骰/死亡保护/攻击分支完成                               |
| 骨制钥匙                    | 移动到同楼层相邻但未连门的已发现房间                     | 已有真实六段 E2E：骨制钥匙本体、打开移动模式、穿墙目标、点击、移动结算、清空状态                       | 已收口本对象；不外推头戴耳机、手电筒/灯笼或其它物品                                        |
| 砍刀                        | 攻击 +1 骰                                               | 已有砍刀攻击链，证明武器选择、目标高亮、攻击骰盘和反馈；指环、匕首、无武器另有独立链                   | 已纳入攻击骰盘家族登记；判等依据是同一叛徒 token 目标、同一攻击骰盘和同一攻击结算 reducer |

## 骰盘全家族矩阵

骰盘统一要求是开放式透明物理骰盘、0/1/2 山屋专用骰面、多骰不重叠、结果与规则目标直接相连。本轮已按触发家族登记覆盖范围和判等依据。

| 骰盘触发家族            | 当前证据状态                                                            | 当前边界 / 判等依据                                      |
| ----------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| 事件牌检定 / 自动投骰   | 23 张事件牌已逐张六段覆盖，含 2/3/4+ 骰场景                             | 已纳入本轮骰盘家族登记                                   |
| 可选作祟 / 可选事件投骰 | 肉质苔癣、一瓶微尘、说“茄子”！、一抹鲜红、大宅饿了等已覆盖用户点名时序  | 已纳入本轮骰盘家族登记                                   |
| 预兆翻出后的作祟判定    | 圣符六段链覆盖翻出后立即作祟骰盘；书本非圣符抽样链通过；9 张预兆逐项确认作祟检定骰面 | 已纳入本轮预兆作祟登记                                   |
| 房间/结束回合检定       | 火炉房真实页面链覆盖结束回合伤害；倒塌房间、神秘电梯和洗衣滑槽分别覆盖速度检定、移动骰盘和无骰盘直接移动 | 已按有骰盘/无骰盘差异单独登记                           |
| 攻击骰盘                | 砍刀、指环、匕首和无武器链已覆盖武器选择/无武器提示、叛徒目标高亮、4/6 骰攻击、物理/精神伤害差异和速度花费 | 已按攻击入口同构和武器字段差异登记                       |
| 驱魔骰盘                | 驱魔失败六段链已覆盖失败骰盘、伤害和关闭；驱魔成功六段链已覆盖成功骰盘、成功结果、确认进入终局和幸存者终局页 | 已纳入本轮骰盘家族登记                                   |
| 死亡保护骰盘            | 头骨双分支六段链覆盖 3 骰、总点数、阻止死亡反馈、未阻止死亡正常死亡落位 | 已纳入本轮骰盘家族登记                                   |
| 兔脚重掷骰盘            | 已补真实页面六段链：点击兔脚本体、选择具体骰子、重掷后更新结果和收口    | 已纳入本轮骰盘家族登记                                   |

## 本轮 UI / 体验回归补充

| 用户反馈目标 | 当前证据状态 | 当前边界 |
| ------------ | ------------ | -------- |
| 右上角不再出现骰盘区域 | 桌面 recent roll 统一改为中央开放牌桌；倒塌房间和神秘电梯 E2E 已断言 `open-table-transparent`、居中、不贴顶部、不侵入右侧状态栏 | 只证明本轮普通/房间效果代表链，不外推骰盘全家族完成 |
| 角色面板与角色 token 对应 | 当前面板、当前属性区、桌面队友面板、底部队友入口均写入玩家/角色/棋子素材同源字段；基础布局单测已覆盖同源断言 | 队友可能不在当前楼层，因此不把队友地图 token 作为强制断言前提 |
| 不点取消连续移动 | 移动后继续保留移动模式；定向 E2E 已覆盖入口大厅 -> 门厅 -> 大阶梯 | 只证明普通移动连续体验，不外推面具、骨制钥匙等特殊移动全家族 |

## 已确认规则时序

- 蜘蛛！不是“先选择线路再判定”。它是先进行神志检定；如果结果达到 `4+`，再进入本次 `4+` 效果处理：选择获得神志或速度，并选择一个相邻板块放置。这里的房间选择属于规则效果处理 / 结算输入；若当前没有兔脚改骰、后续选择或其它可操作内容，点选相邻板块后应直接回到牌桌并让属性、位置和日志落位，不再打开只能点“返回牌桌”的结果特写。
- 上古旧宅和夜幕众星才是当前数据合同里的“先选择属性再投检定”。这类测试必须证明选择前没有本次骰盘，确认后才出现检定。
- 一瓶微尘不是“跳过按钮阶段承接就算完整”。完整链必须从真实探索翻牌开始，玩家选择“进行作祟检定”后才出现作祟骰盘；若未触发作祟，必须继续证明神志奖励结算和关闭回牌桌。
- 大宅饿了的跳过分支也不是“按钮存在就算完整”。完整链必须从真实探索翻牌开始，先证明翻牌后出现作祟/跳过选择，未选择属性前跳过不可用；选择奖励属性后再跳过作祟，必须证明不出现作祟骰盘、所选属性 +1、`临时事件选择态` 清空、关闭后回牌桌。
- 说“茄子”！和一抹鲜红不是“有可选作祟按钮就算完整”。完整链必须从真实探索翻牌开始，选择进行作祟检定后才出现作祟骰盘；失败后分别证明抽到物品 / 速度 +1 的现实结果，再关闭回牌桌。
- 吊死鬼不是“直接给奖励属性选项就算完整”。完整链必须从真实探索翻牌开始，先显示四项属性检定结果；只有四项均通过后才允许选择奖励属性，确认后必须证明所选属性 +1 和关闭回牌桌。
- 直接注入 `临时事件选择态` 只能证明阶段 UI 承接，不证明牌从规则入口真实翻出，也不证明关闭后能回到牌桌。
- 倒塌房间速度坠落链属于“房间已在牌桌上，结束回合触发房间效果”的代表链。该链必须证明倒塌房间对象已出现、结束回合检定提示、3 骰速度检定骰盘、坠落到地下室起始点、结算后回到可操作牌桌；但不能写成“从未知房间自然探索翻出倒塌房间并完整收口”。
- 神秘电梯移动骰盘链属于“房间已在牌桌上，玩家启动房间效果”的代表链。该链必须证明神秘电梯对象已出现、房间效果按钮、启动前没有本次骰盘、2 骰移动骰盘、房间移动到对应开放门位、结算后回到可操作牌桌；但不能写成“从未知房间自然探索翻出神秘电梯并完整收口”，也不能外推洗衣滑槽直接移动。
- 洗衣滑槽直接移动链属于“真实探索翻出房间后，结束回合触发无骰盘直接移动”。该链必须证明地下室起始点探索前、选择地下未知房间、洗衣滑槽翻出并落位、结束回合滑落提示、结束回合后玩家滑回地下室起始点、无 recent roll 骰盘且回到可操作牌桌。

## 本轮验证记录

- 静态检查：`npx eslint e2e/betrayal/event-choice-coverage.e2e.ts` 通过。
- 文档格式：`npx prettier --write .spec/knowledge/standards/e2e-verification.md docs/games/betrayal/records/betrayal-playability-audit-2026-07-14.md` 已执行。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "外星几何真实链路从探索翻牌到自动投骰结算关闭"` 通过，`1 passed`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "电话铃声伤害直接结算真实链路从探索翻牌到投骰结算关闭"` 通过，`1 passed`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "嘎吱的木门移动直接结算真实链路从探索翻牌到投骰结算关闭"` 通过，`1 passed`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "小机器人抽物品直接结算真实链路从探索翻牌到投骰结算关闭"` 通过，`1 passed`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "一条秘密通道真实链路从探索翻牌到检定后选房间结算关闭"` 通过，`1 passed`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "脑状食品真实链路从探索翻牌到检定后选属性结算关闭"` 通过，`1 passed`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "肉质苔癣真实链路从探索翻牌到选择吸入投骰再选属性结算关闭"` 通过，`1 passed`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "一瓶微尘真实链路从探索翻牌到选择作祟检定投骰结算关闭"` 通过，`1 passed`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "大宅饿了真实链路从探索翻牌到跳过作祟选择属性结算关闭"` 通过，`1 passed`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "说茄子真实链路从探索翻牌到作祟失败抽物品关闭"` 通过，`1 passed`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "一抹鲜红真实链路从探索翻牌到作祟失败速度奖励关闭"` 通过，`1 passed`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "吊死鬼真实链路从探索翻牌到四项检定后选奖励关闭"` 通过，`1 passed`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "标本剥制伤害和障碍物直接结算真实链路从探索翻牌到投骰结算关闭"` 通过，`1 passed`。
- E2E：新增直接结算 7 条定向链顺序跑通：小丑房间、咬一口！、最深的壁橱、磁带播放器、在你背后！、一种怪异的感觉、葬礼；脚本输出 `ALL_TARGETED_E2E_PASSED=7`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts` 在十五条阶段通过 `27 passed`；新增 8 张直接结算牌后，本轮记录以逐条定向通过和对应六段截图为 23/23 事件牌证据，不把旧 `27 passed` 冒充新增后的整文件全量复跑。
- 静态检查：`npx eslint e2e\betrayal\room-effect-representative.e2e.ts` 通过，0 errors。
- Vitest：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "倒塌房间" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`4 passed`。
- E2E：`PW_E2E_SERVICE_REUSE=isolated node scripts\infra\run-e2e-single.mjs ci e2e/betrayal/room-effect-representative.e2e.ts "倒塌房间速度坠落真实链路"` 通过，`1 passed`。
- AI 核图：`temp/betrayal-collapsed-room-speed-check-full-chain-contact-lowres.jpg` 已确认六张图属于同一条倒塌房间结束回合速度坠落链，能看到倒塌房间已在牌桌上、结束回合检定提示、3 骰速度检定骰盘停稳、坠落后地下室起始点回牌桌可操作。该联系图只用于 AI 核图，不替代原始截图。
- Vitest：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "神秘电梯" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`2 passed`。
- E2E：`PW_E2E_SERVICE_REUSE=isolated node scripts\infra\run-e2e-single.mjs ci e2e/betrayal/room-effect-representative.e2e.ts "神秘电梯移动骰盘真实链路"` 通过，`1 passed`。
- AI 核图：`temp/betrayal-mystic-elevator-move-roll-full-chain-contact-lowres.jpg` 已确认六张图属于同一条神秘电梯移动骰盘链，能看到神秘电梯已在牌桌上、房间效果按钮、2 骰移动骰盘停稳、移动到一层开放门位并回到可操作牌桌。该联系图只用于 AI 核图，不替代原始截图。
- 静态检查：`npx eslint src\games\betrayal\Board.tsx src\games\betrayal\__tests__\Board.foundation.test.tsx e2e\betrayal\basic-flow.e2e.ts e2e\betrayal\room-effect-representative.e2e.ts` 通过，0 errors。
- Board 定向：`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx --testNamePattern "真实运行时基础布局"` 通过，`1 passed`；尾部 `socket hang up / ECONNRESET` 只作为命令退出后既有噪声记录，退出码为 0。
- E2E：`npm run test:e2e:file -- e2e/betrayal/basic-flow.e2e.ts "运行时移动后不点取消也能连续移动到第二个房间"` 通过，`1 passed`。
- E2E：`npm run test:e2e:file -- e2e/betrayal/room-effect-representative.e2e.ts "倒塌房间速度坠落真实链路"` 通过，`1 passed`；该用例额外断言骰盘不在右上角、不贴顶部状态区、不侵入右侧状态栏。
- E2E：`npm run test:e2e:file -- e2e/betrayal/room-effect-representative.e2e.ts "神秘电梯移动骰盘真实链路"` 通过，`1 passed`；该用例额外断言骰盘走中央开放牌桌。
- AI 核图：`temp/betrayal-current-fixes-contact.jpg` 已确认本轮五张图覆盖连续移动三段、倒塌房间中央骰盘和神秘电梯中央骰盘；该联系图只用于 AI 核图，不替代原始截图。
- 静态检查：`npx eslint src\games\betrayal\scenarioConfig.ts src\games\betrayal\game.ts src\games\betrayal\__tests__\firstScenarioRuntime.test.ts src\games\betrayal\__tests__\Board.foundation.test.tsx e2e\betrayal\inventory-density.e2e.ts` 通过，0 errors（保留既有未用函数 warning）。
- Vitest：`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "map|notebook|journal|manuscript|地图|笔记本|日记|手稿" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`8 passed`。
- Board 定向：`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "map|notebook|journal|manuscript|地图|笔记本|日记|手稿" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`5 passed`；尾部 `socket hang up / ECONNRESET` 只作为既有命令退出噪声记录，退出码为 0。
- E2E：`npm run test:e2e:file -- e2e/betrayal/inventory-density.e2e.ts "共享放置物品链路"` 通过，`3 passed`，覆盖笔记本、日记、手稿各自六段链。
- AI 核图：`temp/betrayal-shared-place-explorer-items-contact-lowres.jpg` 已确认三组低清联系图均属于共享放置物品链；该联系图只用于 AI 核图，不替代原始截图。
- E2E：`npm run test:e2e:file -- e2e/betrayal/room-effect-representative.e2e.ts "洗衣滑槽直接移动真实链路"` 通过，`1 passed`。
- AI 核图：`temp/betrayal-laundry-chute-full-chain-contact-lowres.jpg` 已确认洗衣滑槽六段属于同一条真实链，能看到探索前、选择未知房间、洗衣滑槽翻出、结束回合滑落提示、滑回地下室起始点和回牌桌；该联系图只用于 AI 核图，不替代原始截图。
- AI 核图：`temp/betrayal-alien-geometry-full-chain-contact-lowres.jpg` 已确认外星几何六段属于同一条真实链，能看到探索前、选择未知房间、事件牌翻出、知识检定骰盘停稳、结算结果和关闭后回牌桌。
- AI 核图：`temp/betrayal-phone-ring-direct-roll-contact-lowres.jpg` 已确认电话铃声六段属于同一条真实链，能看到探索前、选择未知房间、事件牌翻出、2 颗骰子直接结算物理伤害和关闭后回牌桌。
- AI 核图：`temp/betrayal-creaking-door-direct-roll-contact-lowres.jpg` 已确认嘎吱的木门六段属于同一条真实链，能看到探索前、选择未知房间、事件牌翻出、知识检定直接结算移动到上层起始点和关闭后回牌桌。
- AI 核图：`temp/betrayal-toy-monkey-direct-roll-contact-lowres.jpg` 已确认小机器人六段属于同一条真实链，能看到探索前、选择未知房间、事件牌翻出、知识检定直接结算抽物品和关闭后回牌桌。
- AI 核图：`temp/betrayal-secret-passage-full-chain-contact-lowres.jpg` 已确认一条秘密通道六段属于同一条真实链，能看到探索前、选择未知房间、事件牌翻出、知识检定、选择门厅作为第二秘密通道、结算标志物和关闭后回牌桌。
- AI 核图：`temp/betrayal-brain-food-full-chain-contact-lowres.jpg` 已确认脑状食品六段属于同一条真实链，能看到探索前、选择未知房间、事件牌翻出、力量检定、选择速度奖励、结算结果和关闭后回牌桌。
- AI 核图：`temp/betrayal-dusty-vial-full-chain-contact-lowres.jpg` 已确认一瓶微尘六段属于同一条真实链，能看到探索前、选择未知房间、事件牌翻出可选择作祟检定、选择后作祟骰盘停稳、神志奖励结算和关闭后回牌桌。
- AI 核图：`temp/betrayal-hungry-house-full-chain-contact-lowres.jpg` 已确认大宅饿了六段属于同一条真实链，能看到探索前、选择未知房间、事件牌翻出可选择作祟检定、选择知识奖励后准备跳过作祟、知识 +1 结算和关闭后回牌桌。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/holy-water-use.e2e.ts "真实页面选择奇怪的药品、直接使用并恢复力量速度收口"` 通过，`1 passed`。
- AI 核图：`temp/betrayal-holy-water-use-full-chain-contact-lowres.jpg` 已确认奇怪的药品六段属于同一条真实链，能看到药品本体选中、无需队友目标选择、使用后力量/速度恢复反馈、药品从持有区消失并回到可操作牌桌。该联系图只用于 AI 核图，不替代原始截图。
- 静态检查：`npx eslint src\games\betrayal\Board.tsx e2e\betrayal\holy-symbol-explore-declaration.e2e.ts` 通过，0 errors。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/holy-symbol-explore-declaration.e2e.ts "真实页面声明圣符、取消、重新声明、探索并收口"` 通过，`1 passed`。
- AI 核图：`temp/betrayal-holy-symbol-explore-declaration-contact-lowres.jpg` 已确认圣符探索声明六段属于同一条真实链，能看到声明、取消、重新声明、探索替换房间、事件结算和关闭后回牌桌。该联系图只用于 AI 核图，不替代原始截图。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/first-scenario-trade-interaction.e2e.ts "狗远距交易真实链路可选择多张持有物、4格内目标并收口"` 通过，`1 passed`。
- AI 核图：`temp/betrayal-dog-trade-full-chain-contact-lowres.jpg` 已确认狗远距交易六段属于同一条真实链，能看到狗交易前牌桌、选择急救包和地图、切到 4 格内队友所在楼层、点击远距队友 token、确认后物品转移、狗标记已用并清空状态回牌桌。该联系图只用于 AI 核图，不替代原始截图。
- 静态检查：`npx eslint src/games/betrayal/Board.tsx src/games/betrayal/testing/firstScenarioTestUtils.ts src/games/betrayal/__tests__/Board.foundation.test.tsx e2e/betrayal/betrayalTestHelpers.ts e2e/betrayal/first-scenario-use-possession.e2e.ts` 通过，0 errors。
- Vitest：`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "面具|moveOthers|持有物" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`5 passed`。
- Board 定向：`node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/Board.foundation.test.tsx --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "面具会在真实页面给同板块队友和怪物分别选择相邻板块"` 通过，`1 passed`；尾部 `socket hang up / ECONNRESET` 只作为命令退出后噪声记录。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/first-scenario-use-possession.e2e.ts "面具真实链路选择同房间队友、相邻房间并完成移动收口"` 通过，`1 passed`。
- AI 核图：`temp/betrayal-mask-move-full-chain-contact-lowres.jpg` 已确认面具移动六段属于同一条真实链，能看到面具使用前、选中面具、同房间队友目标激活、相邻房间高亮、确认后队友离开原房间、最后面具选择器和高亮清空回牌桌。该联系图只用于 AI 核图，不替代原始截图。
- 静态检查：`npx eslint src/games/betrayal/testing/firstScenarioTestUtils.ts e2e/betrayal/betrayalTestHelpers.ts e2e/betrayal/first-scenario-use-possession.e2e.ts` 通过，0 errors。
- Vitest：`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "骨制钥匙" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`2 passed`。
- Board 定向：`node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/Board.foundation.test.tsx --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "骨制钥匙会在真实页面移动模式显示穿墙目标并传入领域命令"` 通过，`1 passed`；尾部 `socket hang up / ECONNRESET` 只作为命令退出后噪声记录。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/first-scenario-use-possession.e2e.ts "骨制钥匙真实链路打开移动模式、选择穿墙目标并完成移动收口"` 通过，`1 passed`。
- AI 核图：`temp/betrayal-skeleton-key-move-full-chain-contact-lowres.jpg` 已确认骨制钥匙穿墙移动六段属于同一条真实链，能看到移动前、物品本体、打开移动模式、点击穿墙目标前、移动结算反馈和回牌桌。该联系图只用于 AI 核图，不替代原始截图。
- 静态检查：`npx eslint e2e\betrayal\event-choice-coverage.e2e.ts` 通过，0 errors。
- Vitest：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "盔甲" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`4 passed`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "盔甲真实链路从电话铃声翻牌到物理伤害减伤结算关闭"` 通过，`1 passed`。
- AI 核图：`temp/betrayal-armor-physical-reduction-full-chain-contact-lowres.jpg` 已确认盔甲物理减伤六段属于同一条真实链，能看到盔甲持有区、选择未知房间、电话铃声翻出、物理伤害骰盘停稳、减伤结算和关闭后回牌桌。该联系图只用于 AI 核图，不替代原始截图。
- 静态检查：`npx eslint e2e\betrayal\event-choice-coverage.e2e.ts` 通过，0 errors。
- Vitest：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "头戴耳机" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`3 passed`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "头戴耳机真实链路从电话铃声翻牌到精神伤害减伤结算关闭"` 通过，`1 passed`。
- AI 核图：`temp/betrayal-radio-mental-reduction-full-chain-contact-lowres.jpg` 已确认头戴耳机精神减伤六段属于同一条真实链，能看到头戴耳机持有区、选择未知房间、电话铃声翻出、精神伤害骰盘停稳、减伤结算和关闭后回牌桌。该联系图只用于 AI 核图，不替代原始截图。
- 静态检查：`npx eslint e2e\betrayal\event-choice-coverage.e2e.ts src\games\betrayal\scenarioConfig.ts` 通过，0 errors。
- Vitest：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "手电筒" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`1 passed`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "手电筒真实链路从外星几何翻牌到事件检定额外加骰结算关闭"` 通过，`1 passed`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "灯笼真实链路从外星几何翻牌到事件检定额外加骰结算关闭"` 通过，`1 passed`。
- AI 核图：`temp/betrayal-flashlight-lantern-event-check-full-chain-contact-lowres.jpg` 已确认手电筒/灯笼两行均属于事件属性检定加骰链，能看到持有规则、选择未知房间、外星几何翻出、5 骰知识检定、结算和关闭后回牌桌。该联系图只用于 AI 核图，不替代原始截图。
- 静态检查：`npx eslint e2e\betrayal\event-choice-coverage.e2e.ts` 通过，0 errors。
- Vitest：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "魔法相机" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`2 passed`。
- E2E：`node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/event-choice-coverage.e2e.ts "魔法相机真实链路"` 通过，`1 passed`。
- AI 核图：`temp/betrayal-magic-camera-knowledge-replacement-full-chain-contact-lowres.jpg` 已确认六张图属于同一条魔法相机知识检定替代链，能看到相机持有规则、选择未知房间、外星几何翻出、5 骰知识检定、结算和关闭后回牌桌。该联系图只用于 AI 核图，不替代原始截图。
- 静态检查：`npx eslint e2e\betrayal\event-choice-coverage.e2e.ts src\games\betrayal\game.ts src\games\betrayal\__tests__\firstScenarioRuntime.test.ts` 通过，0 errors（保留既有未用函数 warning）。
- Vitest：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "书本" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`4 passed`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "书本真实链路从本体使用到小丑房间非战斗检定替代结算关闭"` 通过，`1 passed`。
- AI 核图：`temp/betrayal-omen-book-non-combat-replacement-full-chain-contact-lowres.jpg` 已确认书本非战斗检定替代六段属于同一条真实链，能看到书本持有区、本体选中、花 1 神志后选择未知房间、小丑房间翻出、5 骰神志检定、替代状态消费和关闭后回牌桌。该联系图只用于 AI 核图，不替代原始截图。
- 静态检查：`npx eslint e2e\betrayal\non-p0-representative.e2e.ts` 通过。
- Vitest：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "雕像" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`4 passed`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/non-p0-representative.e2e.ts "雕像探索声明真实链路从声明到跳过事件结算关闭"` 通过，`1 passed`。
- AI 核图：`temp/betrayal-idol-explore-declaration-full-chain-contact-lowres.jpg` 已确认雕像探索声明六段属于同一条真实链，能看到声明前、声明选中、选择未知房间、跳过事件结果、未扣力量且事件未弃置、关闭后回牌桌。该联系图只用于 AI 核图，不替代原始截图。
- 静态检查：`npx eslint e2e\betrayal\high-risk-possession-representative.e2e.ts` 通过。
- Vitest：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "头骨" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`5 passed`。
- E2E：`npm run test:e2e:ci:file -- e2e/betrayal/high-risk-possession-representative.e2e.ts "头骨死亡保护真实链路"` 通过，`2 passed`。
- AI 核图：`temp/betrayal-skull-death-prevention-full-chain-contact-lowres.jpg` 已确认头骨死亡保护双分支十二张图属于真实攻击链，能看到阻止死亡分支的攻击前、目标高亮、3 骰死亡保护、阻止结果、濒死未死亡和回牌桌，也能看到未阻止死亡分支的攻击前、目标高亮、3 骰死亡保护、正常死亡结果、死亡状态落位和牌桌仍可查看。该联系图只用于 AI 核图，不替代原始截图。
- 静态检查：`npx eslint e2e\betrayal\non-p0-representative.e2e.ts` 通过，0 errors。
- Vitest：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "无武器|徒手|攻击" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过。
- E2E：`node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/non-p0-representative.e2e.ts "无武器攻击真实链路"` 通过，`1 passed`。
- AI 核图：`temp/betrayal-unarmed-attack-full-chain-contact-lowres.jpg` 已确认无武器攻击六段属于同一条真实链，能看到无持有物/默认攻击提示、叛徒目标高亮、4 骰力量攻击、物理伤害反馈和关闭后回牌桌。该联系图只用于 AI 核图，不替代原始截图。
- 静态检查：`npx eslint e2e\betrayal\first-scenario-exorcism-success.e2e.ts` 通过，0 errors。
- Vitest：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "英雄线可击倒叛徒|最终驱魔成功|驱魔结算" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`1 passed`。
- E2E：`node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/first-scenario-exorcism-success.e2e.ts "最终驱魔成功从真实入口到幸存者终局"` 通过，`1 passed`。
- AI 核图：`temp/betrayal-exorcism-success-full-chain-contact-lowres.jpg` 已确认驱魔成功六段属于同一条真实链，能看到驱魔前、杰克之灵目标、成功骰盘停稳、成功结果、确认进入终局和幸存者终局页。该联系图只用于 AI 核图，不替代原始截图。
- 运行阻塞记录：前两次 E2E 启动被重任务守卫拦截，原因是已有同类 E2E 正在运行；未使用并发绕过，等守卫释放后重跑正式链路。

## 本轮截图证据

- 上古旧宅完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/上古旧宅-完整链路-01-探索前.jpg` 到 `上古旧宅-完整链路-06-关闭后.jpg`。
- 夜幕众星完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/夜幕众星-完整链路-01-探索前.jpg` 到 `夜幕众星-完整链路-06-关闭后.jpg`。
- 外星几何完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/外星几何-完整链路-01-探索前.jpg` 到 `外星几何-完整链路-06-关闭后.jpg`。
- 电话铃声完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/电话铃声-完整链路-01-探索前.jpg` 到 `电话铃声-完整链路-06-关闭后.jpg`。
- 嘎吱的木门完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/嘎吱的木门-完整链路-01-探索前.jpg` 到 `嘎吱的木门-完整链路-06-关闭后.jpg`。
- 小机器人完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/小机器人-完整链路-01-探索前.jpg` 到 `小机器人-完整链路-06-关闭后.jpg`。
- 一条秘密通道完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/一条秘密通道-完整链路-01-探索前.jpg` 到 `一条秘密通道-完整链路-06-关闭后.jpg`。
- 脑状食品完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/脑状食品-完整链路-01-探索前.jpg` 到 `脑状食品-完整链路-06-关闭后.jpg`。
- 蜘蛛！完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/蜘蛛-完整链路-01-探索前.jpg` 到 `蜘蛛-完整链路-06-关闭后.jpg`。
- 肉质苔癣完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/肉质苔癣-完整链路-01-探索前.jpg` 到 `肉质苔癣-完整链路-06-关闭后回牌桌.jpg`。
- 一瓶微尘完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/一瓶微尘-完整链路-01-探索前.jpg` 到 `一瓶微尘-完整链路-06-关闭后回牌桌.jpg`。
- 大宅饿了完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/大宅饿了-完整链路-01-探索前.jpg` 到 `大宅饿了-完整链路-06-关闭后回牌桌.jpg`。
- 说“茄子”！完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/说茄子-完整链路-01-探索前.jpg` 到 `说茄子-完整链路-06-关闭后回牌桌.jpg`。
- 一抹鲜红完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/一抹鲜红-完整链路-01-探索前.jpg` 到 `一抹鲜红-完整链路-06-关闭后回牌桌.jpg`。
- 吊死鬼完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/吊死鬼-完整链路-01-探索前.jpg` 到 `吊死鬼-完整链路-06-关闭后回牌桌.jpg`。
- 标本剥制完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/标本剥制-完整链路-01-探索前.jpg` 到 `标本剥制-完整链路-06-关闭后.jpg`。
- 小丑房间完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/小丑房间-完整链路-01-探索前.jpg` 到 `小丑房间-完整链路-06-关闭后.jpg`。
- 咬一口！完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/咬一口-完整链路-01-探索前.jpg` 到 `咬一口-完整链路-06-关闭后.jpg`。
- 最深的壁橱完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/最深的壁橱-完整链路-01-探索前.jpg` 到 `最深的壁橱-完整链路-06-关闭后.jpg`。
- 磁带播放器完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/磁带播放器-完整链路-01-探索前.jpg` 到 `磁带播放器-完整链路-06-关闭后.jpg`。
- 在你背后！完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/在你背后-完整链路-01-探索前.jpg` 到 `在你背后-完整链路-06-关闭后.jpg`。
- 一种怪异的感觉完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/一种怪异的感觉-完整链路-01-探索前.jpg` 到 `一种怪异的感觉-完整链路-06-关闭后.jpg`。
- 葬礼完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/葬礼-完整链路-01-探索前.jpg` 到 `葬礼-完整链路-06-关闭后.jpg`。
- 蜘蛛！关键证明图：`蜘蛛-完整链路-03-事件牌翻出已有神志检定.jpg`，用于证明它是“先神志检定，再在 `4+` 效果处理中选择奖励属性和相邻房间；无后续可操作内容时，点击相邻房间后直接回到牌桌并完成位置/属性落位”。
- 兔脚重掷完整链路：`evidence/山屋惊魂-兔脚重掷完整链路/01-兔脚重掷前最近投骰可见.jpg` 到 `06-收口后回牌桌可操作.jpg`，用于证明兔脚是“最近投骰可见 -> 点兔脚本体 -> 直接点具体骰子 -> 重掷后更新结算 -> 清空选中态回牌桌”。
- 奇怪的药品完整链路：`evidence/山屋惊魂-奇怪的药品使用完整链路/01-药品使用前牌桌可操作.jpg` 到 `06-收口后牌桌继续可操作.jpg`，用于证明奇怪的药品是“点药品本体 -> 无需目标直接使用 -> 力量/速度恢复 -> 药品消失 -> 清空选中态回牌桌”。
- 圣符探索声明完整链路：`evidence/山屋惊魂-圣符探索声明完整链路/01-圣符声明前牌桌可操作.jpg` 到 `06-关闭后回牌桌继续可操作.jpg`，用于证明圣符声明是“声明 -> 取消 -> 重新声明 -> 探索替换房间 -> 事件结算 -> 清空状态回牌桌”。
- 狗远距交易完整链路：`evidence/山屋惊魂-狗远距交易完整链路/01-狗交易前牌桌可操作.jpg` 到 `06-狗交易后回牌桌状态清空.jpg`，用于证明狗远距交易是“选择多张可交易持有物 -> 切到 4 格内队友所在楼层 -> 点击地图队友 token -> 确认交易 -> 急救包和地图转移 -> 狗标记已用并清空状态回牌桌”。
- 连续移动体验链路：`evidence/betrayal-basic-flow/07c-山屋惊魂-运行时-移动模式选择门厅.jpg`、`07d-山屋惊魂-运行时-移动后仍可继续选择大阶梯.jpg`、`07e-山屋惊魂-运行时-不取消连续移动完成.jpg`，用于证明“进入移动模式 -> 点门厅移动 -> 不取消直接继续点大阶梯 -> 角色 token 落位”。
- 右上角骰盘回归关键图：`evidence/山屋惊魂-倒塌房间速度检定完整链路/05-速度检定骰盘停稳.jpg` 和 `evidence/山屋惊魂-神秘电梯移动骰盘完整链路/04-神秘电梯2骰移动骰盘停稳.jpg`，用于证明房间效果骰盘在中央开放牌桌，不回到右上角骰盘区域。
- 角色面板 token 对应关系：`src/games/betrayal/__tests__/Board.foundation.test.tsx` 基础布局回归证明当前地图 token、当前面板 token、当前属性区、桌面队友面板和底部队友入口拥有一致的玩家/角色/棋子素材字段。
- 面具移动完整链路：`evidence/山屋惊魂-面具移动完整链路/01-面具使用前牌桌可操作.jpg` 到 `06-面具使用后回牌桌状态清空.jpg`，用于证明面具移动是“点面具本体 -> 选择同板块队友 -> 选择相邻房间 -> 确认移动 -> 队友移动结算 -> 面具选择器和高亮清空回牌桌”。
- 骨制钥匙穿墙移动完整链路：`evidence/山屋惊魂-骨制钥匙穿墙移动完整链路/01-骨制钥匙移动前牌桌可操作.jpg` 到 `06-骨制钥匙移动后回牌桌状态清空.jpg`，用于证明骨制钥匙是“移动前 -> 骨制钥匙本体 -> 打开移动模式 -> 选择同层相邻但未连门房间 -> 穿墙移动结算 -> 清空移动态回牌桌”。
- 盔甲物理减伤完整链路：`evidence/山屋惊魂-盔甲物理减伤完整链路/01-盔甲减伤前牌桌可操作.jpg` 到 `06-关闭后回牌桌状态清空.jpg`，用于证明盔甲是“持有规则可见 -> 电话铃声翻出命中物理伤害分支 -> 伤害骰盘停稳 -> 4 点物理伤害实际只扣 3 点身体属性 -> 关闭后回牌桌”。
- 头戴耳机精神减伤完整链路：`evidence/山屋惊魂-头戴耳机精神减伤完整链路/01-头戴耳机减伤前牌桌可操作.jpg` 到 `06-关闭后回牌桌状态清空.jpg`，用于证明头戴耳机是“持有规则可见 -> 电话铃声翻出命中精神伤害分支 -> 伤害骰盘停稳 -> 2 点精神伤害实际只扣 1 点精神属性 -> 关闭后回牌桌”。
- 手电筒事件检定加骰完整链路：`evidence/山屋惊魂-手电筒事件检定加骰完整链路/01-手电筒加骰前牌桌可操作.jpg` 到 `06-关闭后回牌桌状态清空.jpg`，用于证明手电筒是“持有规则可见 -> 外星几何翻出 -> 3 点知识触发 5 骰检定 -> 知识 +1 结算 -> 关闭后回牌桌”。
- 灯笼事件检定加骰完整链路：`evidence/山屋惊魂-灯笼事件检定加骰完整链路/01-灯笼加骰前牌桌可操作.jpg` 到 `06-关闭后回牌桌状态清空.jpg`，用于证明灯笼是“持有规则可见 -> 外星几何翻出 -> 3 点知识触发 5 骰检定 -> 知识 +1 结算 -> 关闭后回牌桌”。
- 魔法相机知识检定替代完整链路：`evidence/山屋惊魂-魔法相机知识检定替代完整链路/01-魔法相机替代前牌桌可操作.jpg` 到 `06-关闭后回牌桌状态清空.jpg`，用于证明魔法相机是“持有规则可见 -> 外星几何翻出 -> 3 点知识用 5 点神志替代为 5 骰知识检定 -> 知识 +1 结算 -> 关闭后回牌桌”。
- 书本非战斗检定替代完整链路：`evidence/山屋惊魂-书本非战斗检定替代完整链路/01-书本使用前牌桌可操作.jpg` 到 `06-关闭后回牌桌状态清空.jpg`，用于证明书本是“点击书本本体 -> 花 1 神志建立一次性状态 -> 探索翻出小丑房间 -> 用知识 5 进行 5 骰神志检定 -> 无事发生并消费状态 -> 关闭后回牌桌”。
- 雕像探索声明完整链路：`evidence/山屋惊魂-雕像探索声明完整链路/01-雕像声明前牌桌可操作.jpg` 到 `06-关闭后回牌桌状态清空.jpg`，用于证明雕像是“声明跳过事件 -> 选择真实未知房间 -> 阴影扑面翻出但不抽取/结算事件 -> 力量不扣且事件未弃置 -> 关闭后回牌桌”。
- 头骨死亡保护完整链路：`evidence/山屋惊魂-头骨死亡保护完整链路/01-头骨阻止死亡-攻击前牌桌可操作.jpg` 到 `12-头骨未阻止死亡-牌桌仍可查看.jpg`，用于证明头骨是“真实叛徒 token 攻击 -> 死亡保护 3 骰停稳 -> 阻止死亡或正常死亡结果可见 -> 属性/死亡状态落位 -> 回牌桌或继续查看”的双分支链。
- 指环神志攻击完整链路：`evidence/山屋惊魂-指环神志攻击完整链路/01-指环攻击前牌桌可操作.jpg` 到 `06-指环攻击后回牌桌继续可操作.jpg`，用于证明指环是“选择指环作为攻击武器 -> 叛徒 token 高亮 -> 4 骰神志攻击停稳 -> 精神伤害结算 -> 指环已用并回牌桌继续可操作”的攻击武器链。
- 匕首攻击完整链路：`evidence/山屋惊魂-匕首攻击完整链路/01-匕首攻击前牌桌可操作.jpg` 到 `06-匕首攻击后回牌桌继续可操作.jpg`，用于证明匕首是“选择匕首作为攻击武器 -> 叛徒 token 高亮 -> 6 骰攻击停稳 -> 物理伤害与速度花费结算 -> 匕首已用并回牌桌继续可操作”的攻击武器链。
- 无武器攻击完整链路：`evidence/山屋惊魂-无武器攻击完整链路/01-无武器攻击前牌桌可操作.jpg` 到 `06-无武器攻击后回牌桌继续可操作.jpg`，用于证明无武器攻击是“无持有物/默认攻击提示 -> 叛徒 token 高亮 -> 4 骰力量攻击停稳 -> 物理伤害结算 -> 回牌桌继续可操作”的默认攻击链。
- 驱魔成功终局完整链路：`evidence/山屋惊魂-驱魔成功终局完整链路/01-驱魔成功前牌桌可操作.jpg` 到 `06-幸存者终局页可见.jpg`，用于证明驱魔成功是“真实驱魔入口 -> 杰克之灵房间目标高亮 -> 神志驱魔骰盘停稳 -> 驱魔成功结果 -> 确认进入终局 -> 幸存者终局页”的成功分支链。
- 外星几何关键证明图：`外星几何-完整链路-04-骰盘停稳直接结算.jpg`，用于证明它没有中间选择壳，是牌翻出后自动知识检定并直接进入结算结果。
- 一条秘密通道关键证明图：`一条秘密通道-完整链路-03-事件牌翻出已有知识检定.jpg` 和 `一条秘密通道-完整链路-04-选择门厅作为第二秘密通道.jpg`，用于证明它是“先知识检定，再选择第二个秘密通道房间”。
- 脑状食品关键证明图：`脑状食品-完整链路-03-事件牌翻出已有力量检定.jpg` 和 `脑状食品-完整链路-04-选择速度奖励.jpg`，用于证明它是“先力量检定，再选择奖励属性”。
- 说“茄子”！关键证明图：`说茄子-完整链路-03-事件牌翻出可选择作祟检定.jpg`、`说茄子-完整链路-04-选择作祟检定后骰盘停稳.jpg` 和 `说茄子-完整链路-05-抽物品结算结果可见.jpg`，用于证明它是“先选择作祟检定，再投作祟骰，失败后抽物品”。
- 一抹鲜红关键证明图：`一抹鲜红-完整链路-03-事件牌翻出可选择作祟检定.jpg`、`一抹鲜红-完整链路-04-选择作祟检定后骰盘停稳.jpg` 和 `一抹鲜红-完整链路-05-速度奖励结算结果可见.jpg`，用于证明它是“先选择作祟检定，再投作祟骰，失败后速度 +1”。
- 吊死鬼关键证明图：`吊死鬼-完整链路-03-事件牌翻出四项检定全过.jpg`、`吊死鬼-完整链路-04-选择知识奖励.jpg` 和 `吊死鬼-完整链路-05-知识奖励结算结果可见.jpg`，用于证明它是“四项检定全部通过后才选择奖励属性”。

## 残余范围

- 圣符触发作祟判定、圣符探索声明、haunt 阶段禁探索、驱魔失败死亡、驱魔成功终局、急救包/奇怪的药品/地图/笔记本/日记/手稿/兔脚/头戴耳机/手电筒/灯笼/魔法相机知识检定替代与作祟归属、骨制钥匙、书本、雕像、头骨、指环、匕首、无武器攻击、神秘电梯、洗衣滑槽、同房间交易、狗远距交易、面具移动、盔甲物理减伤、右上角骰盘回归、角色面板 token 同源、普通连续移动体验和骰盘触发家族均已回到规则真相与真实入口 E2E。
- 本文档的完成边界是当前首剧本数据合同、当前 23 张事件牌、9 张预兆、12 张发现池物品、2 张首剧本开局额外持有牌、已实现房间/骰盘触发家族和用户点名 UI 回归；官方扩展牌、其它剧本、部署、提交和线上反馈状态不在本文档边界。
