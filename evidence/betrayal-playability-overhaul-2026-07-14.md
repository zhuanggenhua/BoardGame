# 山屋惊魂可玩性全面重审计 Evidence（2026-07-14）

## 1. 基本信息

- 对象：山屋惊魂首剧本可玩性、haunt 阶段、圣符/作祟判定、驱魔、骰盘、物品使用、交易、事件/发现链路。
- 日期：2026-07-14
- 文档类型：`audit`
- 关联任务：用户要求“全面细致重审计重构，所有新交互端到端补完，一切以规则为准”。

## 2. 审计范围

- 本轮覆盖文件：
  - `src/games/betrayal/game.ts`
  - `src/games/betrayal/Board.tsx`
  - `src/games/betrayal/scenarioConfig.ts`
  - `src/games/betrayal/possessionEffects.ts`
  - `e2e/betrayal/*.e2e.ts`
  - `public/locales/*/game-betrayal.json`
- 本轮覆盖模块：
  - haunt 阶段探索门禁
  - 预兆《圣符》翻出后的作祟判定 UI
  - 驱魔成功/失败/死亡/终局链
  - 山屋专用骰盘与物理骰显示
  - 物品使用链
  - 交易链
  - 事件/预兆/发现阻塞链
- 明确不在本轮完成口径内：
  - 整个山屋全部扩展牌、所有官方剧本和所有素材录入全量收口，除非后续单独扩范围。

## 2.2 全面审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象全集 | `passed` | 当前范围内对象已在第 5 节逐项列出：BTR-01 到 BTR-07、当前 23 张事件、9 张预兆、11 个物品、房间/骰盘触发家族、交易、移动、角色面板 token 同源和右上角骰盘回归。 |
| 规则子句表 | `passed` | 规则子句已拆为 C1/C2/C3/C4/C5/C6/C7：探索门禁、翻出作祟、驱魔、骰盘、物品/预兆效果、交易、关闭后清理与继续操作。 |
| 完整技能流程矩阵 | `passed` | 六段链统一按“触发前 -> 选择触发对象 -> 牌翻出/对象亮相 -> 选择或投骰前 -> 选择/投骰后 -> 结算结果 -> 关闭后”留证。 |
| L0-L4 证据层级 | `passed` | L0=未接入；L1=静态定义/入口；L2=领域或组件回归；L3=真实入口 E2E + 截图；L4=同源链路/生命周期/无残留证明。本轮完成口径内对象均已达到 L3，死亡保护、驱魔、事件选择、物品使用、交易和移动等高风险链已补最终权威状态与无残留证据。 |
| 命中 D 维度 | `passed` | 第 5 节逐项登记 D1/D5/D7/D8/D12/D15/D34/D39/D48/D51/D55 等维度。 |
| 真实入口 E2E 与截图核验 | `passed` | evidence 目录下已记录各链路原图；AI 只核低清联系图，原图路径保留给用户验收，不用低清图替代原图。 |
| 残余范围声明 | `passed` | 当前边界明确为首剧本当前数据合同、用户点名交互、当前 23 张事件、9 张预兆、11 个物品与已实现房间/骰盘触发家族；官方扩展牌、其它剧本、部署、提交和线上反馈状态不在本轮完成边界。 |
| 旧 evidence / 旧结论对账回写 | `passed` | 第 9 节已把旧“只完成三条事件链”的结论改为历史快照，并登记当前替代证据。 |

### L0/L1/L2/L3/L4 层级矩阵

| 层级 | 含义 | 本轮当前状态 |
| --- | --- | --- |
| L0 | 未接入或未定位 | 当前完成边界内无 L0 对象。 |
| L1 | 静态定义、数据合同或入口可见 | 所有对象至少有数据合同、规则入口或 UI 入口。 |
| L2 | 领域层 / 组件层回归可证明规则消费 | 圣符作祟、预兆作祟逐项骰面、驱魔、角色 token 同源等均有 L2 证据。 |
| L3 | 真实入口 E2E + 原图截图链 | 当前完成边界内的用户点名链路、事件牌、预兆、物品、交易、移动、攻击和骰盘家族均已登记 L3。 |
| L4 | 生命周期、最终权威状态、阶段可继续、无残留 | 驱魔、死亡保护、事件选择、物品/交易/移动、作祟归属、连续移动和骰盘回归均写明最终状态、临时选择清空、阶段可继续或终局页落位。 |

### 图片合同表

| visualRegion / slotId | 图上对象 | 运行时对象 | 允许状态 | 是否可交互 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 事件/发现面板 | 当前翻出的事件、预兆、物品或房间 | `discovery` 与结算面板 | 翻出、选择、结算、关闭 | 是 | 六段截图逐项证明牌翻出、选择/投骰、结果和收口。 |
| 中央开放骰盘区 | 山屋 0/1/2 专用骰面 | `RecentRollPanel` / 物理骰盘 | 投骰、停稳、结果可读 | 是 | 不再使用右上角状态区承接普通/房间效果骰盘。 |
| 地图 token / 角色面板 | 探索者 token、当前角色面板、队友入口 | `ExplorerFigureToken` 同源字段 | 当前玩家、队友、底部入口 | 是 | Board 回归证明玩家/角色/棋子素材同源。 |
| 持有物/预兆牌 | 急救包、兔脚、魔法相机、书本、头骨、指环、匕首等 | 持有区卡牌和规则效果入口 | 可用、被动、消耗或保留 | 视规则而定 | 原图链证明本体可点、被动生效、消耗/保留和关闭后状态。 |

### 最终权威状态与无残留证据

- 最终权威状态：本轮所有完成口径内对象均回到现实结果核对，包括属性变化、伤害/死亡状态、位置移动、持有物转移/消耗、作祟剧本与叛徒归属、终局页、骰面结果和角色 token 同源。
- 流程收口 / 无残留：E2E 均继续到发现/事件/物品/交易/移动选择清空，或进入合法终局页；没有把 prompt、临时选择态、按钮出现或日志出现当成最终证据。

## 3. 结论等级

- 当前结论等级：`当前发布口径已收口`
- 判定理由：本轮已建立专项计划和端到端标准；BTR-01 到 BTR-07、当前 23 张事件、9 张预兆、11 个物品、交易、移动、攻击、房间/骰盘触发家族和用户点名的 UI 回归，均已回到真实入口、规则时序、最终权威状态和关闭后继续操作。该结论只覆盖第 2 节边界；官方扩展牌、其它剧本、部署、提交和线上反馈状态另立任务处理。

## 4. 权威来源

- 主真相源：当前山屋数据合同和运行时代码。
- 对照源：`docs/games/betrayal/sources/official/` 下官方规则书与剧本资料，必要时回到卡图/规则录入合同。
- 当前已锁定规则时序：
  - 蜘蛛！是先神志检定，再选择奖励属性和相邻房间。
  - 一条秘密通道是先知识检定，再选择第二个秘密通道放置房间。
  - 脑状食品是先力量检定，再按命中分支选择奖励属性或伤害属性。
  - 上古旧宅、夜幕众星是先选择属性，再投检定。
  - 大宅饿了是可选作祟家族；跳过作祟前必须先选择奖励属性，跳过后结算所选属性 +1，且不应出现作祟骰盘。
  - 外星几何是牌翻出后自动知识检定，再直接显示属性变化结算结果。
  - 预兆《书本》是先点持有物本体并花 1 神志建立一次性状态，再让下一次非战斗检定按知识值投骰；事件属性检定也必须消费该状态，攻击/作祟/固定骰不得消费。
  - 预兆《雕像》是先由玩家在牌桌声明本次探索跳过事件，再选择真实未知房间；事件牌翻出后只能显示跳过结果，不得抽取/结算事件，也不得扣力量。
  - 预兆《头骨》是死亡保护被动：角色因真实攻击伤害触发死亡边界后投 3 骰，4+ 阻止死亡且属性维持在濒死边界；未达到 4 时按死亡结果落位。
  - 预兆《指环》是攻击武器选择：玩家必须先选指环，再点真实叛徒 token 目标，随后按神志进行攻击投骰并造成精神伤害；不能退化成徒手物理攻击或只看底层配置。
  - 预兆《匕首》是攻击武器选择：玩家必须先选匕首，再点真实叛徒 token 目标，随后按力量 +2 骰进行 6 骰攻击，结算时花费 1 点速度并造成物理伤害；不能只用持有匕首或直接注入伤害冒充完整链。
  - 电话铃声、嘎吱的木门、小机器人是牌翻出后自动投骰并直接结算，分别覆盖伤害、移动、抽物品代表结果。
  - 直接注入 `临时事件选择态` 只能算阶段承接，不算完整端到端。

## 5. 逐项结论矩阵

| 对象               | 规则子句 / 用户断言                                                                          | 实现入口                                                                                                                                                                                                                                                 | 命中维度       | 证据层级                      | 当前结论                                                                                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| haunt 阶段探索门禁 | haunt 后不应继续探索新房间                                                                   | `src/games/betrayal/game.ts` + `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` + `e2e/betrayal/haunt-no-explore.e2e.ts`                                                                                                                      | D1/D5/D8/D15   | L3 真实负向 E2E               | 已收口 BTR-01：haunt 阶段牌桌不暴露探索新房间入口，强制探索命令被规则拒绝                                                                                                                                                              |
| 圣符作祟判定       | 翻出预兆《圣符》后应立刻进行作祟检定并显示骰盘                                               | `src/games/betrayal/game.ts` + `src/games/betrayal/Board.tsx` + `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` + `src/games/betrayal/__tests__/Board.foundation.test.tsx` + `e2e/betrayal/holy-symbol-haunt-roll.e2e.ts`                    | D1/D5/D8/D55   | L3 真实六段 E2E               | 已收口 BTR-02：真实页面从探索前到圣符翻出、作祟骰盘、结果、关闭回牌桌均有截图和断言                                                                                                                                                    |
| “结算房间”文案     | 规则动作应是结束回合；房间停留效果只作为结束回合时处理的提示，不得把“结算房间”外露成玩家动作 | `public/locales/*/game-betrayal.json` + `Board.foundation.test.tsx` + `room-effect-representative.e2e.ts`                                                                                                                                                | D1/D15/D34     | L3                            | 已修正：按钮回到“结束回合”，真实页面火炉房链通过                                                                                                                                                                                       |
| 驱魔成功/失败终局  | 成功、失败、伤害、死亡、终局时序必须符合剧本                                                   | `src/games/betrayal/game.ts` + `src/games/betrayal/Board.tsx` + `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` + `e2e/betrayal/first-scenario-exorcism-failure.e2e.ts` + `e2e/betrayal/first-scenario-exorcism-success.e2e.ts`             | D1/D8/D12/D39  | L3 真实六段 E2E               | 已收口 BTR-04：失败链证明驱魔前、选择杰克之灵房间、失败骰盘、伤害结果、关闭前、关闭后回牌桌；成功链证明驱魔前、杰克之灵目标、成功骰盘、成功结果、确认进入终局、幸存者终局页；领域层同时证明 1 点身体伤害与死亡边界 |
| 山屋骰盘           | 0/1/2 规则骰，开放式物理骰盘，不重叠                                                         | `src/games/betrayal/Board.tsx` + `src/lib/dice-box-threejs/engine.ts` + `src/lib/dice-physics/DiceBoxPhysicsSource.tsx` + `e2e/betrayal/betrayalTestHelpers.ts` + `e2e/betrayal/non-p0-representative.e2e.ts` + `e2e/betrayal/rabbit-foot-reroll.e2e.ts` + `e2e/betrayal/holy-symbol-haunt-roll.e2e.ts` | D5/D15/D34/D48 | L3 家族登记完成 | 普通投骰事件、可选作祟、预兆翻出作祟、房间/结束回合、攻击、驱魔、死亡保护、兔脚重掷均已登记真实链或同构抽样；开放式透明物理骰盘、专用 0/1/2 骰面、多骰不重叠和真实骰子命中区已覆盖到本轮触发家族 |
| 右上角骰盘回归     | 普通 recent roll 与房间效果骰盘不得占用右上状态区，必须走中央开放牌桌区                         | `src/games/betrayal/Board.tsx` + `e2e/betrayal/room-effect-representative.e2e.ts`                                                                                                                                                                        | D15/D34/D48    | L3 几何门禁 + E2E             | 已修正：桌面普通骰盘也使用开放式牌桌形态；倒塌房间和神秘电梯 E2E 均断言 `open-table-transparent`、中心位置、顶部距离和不侵入右侧状态栏；该结论不外推骰盘全家族完成 |
| 角色面板 token 同源 | 地图 token、当前角色面板、桌面队友面板、底部队友入口必须对应同一玩家/角色/棋子素材               | `src/games/betrayal/Board.tsx` + `src/games/betrayal/__tests__/Board.foundation.test.tsx`                                                                                                                                                                | D15/D34         | L2/L3 Board 回归              | 已修正：当前面板和队友入口均渲染同源小 token，并暴露玩家、角色、素材同源字段；基础布局回归已覆盖当前角色、桌面队友面板和底部队友入口三处对应关系 |
| 连续移动体验       | 玩家移动一次后，只要仍有移动点和合法目标，不点“取消移动”也能继续点第二个房间移动                 | `src/games/betrayal/Board.tsx` + `e2e/betrayal/basic-flow.e2e.ts`                                                                                                                                                                                        | D5/D8/D15      | L3 真实运行时 E2E             | 已修正：移动结算后保留移动模式；只有无移动点或无目标时自动退回默认状态。定向 E2E 覆盖入口大厅 -> 门厅 -> 大阶梯，证明不取消也能连续移动 |
| 物品使用           | 真实物品本体可点，选择/结算/清理完整                                                         | `src/games/betrayal/Board.tsx` + `src/games/betrayal/testing/firstScenarioTestUtils.ts` + `e2e/betrayal/betrayalTestHelpers.ts` + `e2e/betrayal/first-scenario-use-possession.e2e.ts` + `public/locales/*/game-betrayal.json`                            | D1/D5/D7/D8    | L3 真实六段 E2E               | 已收口 BTR-06：真实页面从急救包本体、地图队友 token、治疗结算到状态清空回牌桌均有截图和断言；结算后治疗选择器清空，急救包从当前持有区消失                                                                                              |
| 交易               | 对象 + 目标 + 确认完整链，不能默认代点；结算后必须清空临时选择并回到可操作牌桌               | `src/games/betrayal/Board.tsx` + `e2e/betrayal/first-scenario-trade-interaction.e2e.ts`                                                                                                                                                                  | D5/D7/D8/D51   | L3 真实六段 E2E               | 已收口 BTR-07：同房间交易和狗 4 格远距交易均有真实页面六段链；狗链证明可选多张持有物、切换到 4 格内队友、点击地图队友 token、确认交易、物品转移、狗标记已用、清空状态回牌桌                                                            |
| 事件牌完整链路     | 翻牌、选择/投骰前、选择/投骰后、结算、关闭                                                   | `event-choice-coverage.e2e.ts`                                                                                                                                                                                                                           | D5/D8/D15      | L3 23/23                      | 当前数据合同 23 张事件牌已逐张补齐真实六段链：上古旧宅、夜幕众星、蜘蛛！、一条秘密通道、脑状食品、肉质苔癣、一瓶微尘、大宅饿了、说“茄子”！、一抹鲜红、吊死鬼，以及 12 张投骰后直接结算事件牌。该结论只覆盖事件牌，不外推为山屋整体完成 |
| 书本非战斗检定替代 | 花 1 神志后，下一次非战斗检定可用知识替代并在检定后消费状态                                  | `src/games/betrayal/game.ts` + `src/games/betrayal/possessionEffects.ts` + `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` + `e2e/betrayal/event-choice-coverage.e2e.ts`                                                                     | D1/D5/D8/D15   | L3 真实六段 E2E               | 已收口本对象：真实页面点击书本本体，神志 2 -> 1，翻出《小丑房间》后神志检定按知识 5 投 5 骰，总点数 10 无事发生，`nextNonCombatTraitReplacement` 被消费，关闭后回牌桌；不外推头骨、雕像、指环或匕首                                    |
| 雕像探索声明       | 声明后本次探索跳过事件，不抽取/结算事件且不扣力量                                            | `src/games/betrayal/game.ts` + `src/games/betrayal/Board.tsx` + `e2e/betrayal/non-p0-representative.e2e.ts`                                                                                                                                              | D1/D5/D8/D15   | L3 真实六段 E2E               | 已收口本对象：真实页面选择雕像声明，探索翻出《阴影扑面》后显示跳过事件，不抽取或结算事件卡，力量保持 4、事件弃牌数保持 0，关闭后回牌桌；不外推圣符、头骨、指环或匕首                                                                   |
| 头骨死亡保护       | 死亡时投 3 骰，4+ 阻止死亡，未达到则正常死亡                                                 | `src/games/betrayal/game.ts` + `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` + `e2e/betrayal/high-risk-possession-representative.e2e.ts`                                                                                                   | D1/D5/D8/D15   | L3 双分支六段 E2E             | 已收口本对象：真实页面从叛徒 token 攻击入口触发死亡保护，阻止死亡分支证明 3 骰 4+ 后角色不进入死亡列表且四属性停在 1；未阻止死亡分支证明 3 骰不足 4 时正常进入死亡状态；不外推指环、匕首或其它攻击/死亡骰盘                            |
| 指环神志攻击       | 可用神志攻击并造成精神伤害                                                                  | `src/games/betrayal/Board.tsx` + `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` + `src/games/betrayal/__tests__/Board.foundation.test.tsx` + `e2e/betrayal/non-p0-representative.e2e.ts`                                                       | D1/D5/D8/D15   | L3 真实六段 E2E               | 已收口本对象：真实页面先选择《指环》作为攻击武器，再点击叛徒 token，显示 4 骰神志攻击，结算为精神伤害且物理属性不变，指环登记已用并回到可操作牌桌；无武器攻击另有独立链；不外推匕首或其它攻击骰盘                                  |
| 匕首攻击           | 攻击多 2 骰并花费 1 速度                                                                  | `src/games/betrayal/game.ts` + `src/games/betrayal/Board.tsx` + `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` + `src/games/betrayal/__tests__/Board.foundation.test.tsx` + `e2e/betrayal/non-p0-representative.e2e.ts`                      | D1/D5/D8/D15   | L3 真实六段 E2E               | 已收口本对象：真实页面先选择《匕首》作为攻击武器，再点击叛徒 token，显示 6 骰力量攻击，结算为物理伤害并花费 1 点速度，匕首登记已用并回到可操作牌桌；无武器攻击另有独立链；不外推指环或其它攻击骰盘                                |
| 无武器攻击         | 没有武器选择时默认以力量进行物理攻击                                                        | `src/games/betrayal/game.ts` + `src/games/betrayal/Board.tsx` + `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` + `e2e/betrayal/non-p0-representative.e2e.ts`                                                                                  | D1/D5/D8/D15   | L3 真实六段 E2E               | 已收口本对象：真实页面在无持有物/无武器选择器时，由默认攻击提示和叛徒 token 承接选择，显示 4 骰力量攻击，结算为物理伤害，关闭后回到可操作牌桌；不外推指环、匕首或其它攻击骰盘                                          |

### 5.1 预兆全家族矩阵

当前预兆数据合同来自 `BETRAYAL_DISCOVERY_POOLS.possessions.omen`，共 9 张。矩阵作用是防止把圣符、狗、头骨或雕像的对象证据外推成预兆全家族完成。

| 预兆 | 规则效果 / 交互点                                                                     | 当前证据层级                          | 当前结论                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 书本 | 知识检定被动 +1；可花费神志把下一次非战斗检定改用知识                                 | L3 六段链                             | 已收口本对象：点书本本体后花 1 神志建立一次性替代状态，小丑房间神志检定按知识 5 投 5 骰，结算无事发生并消费替代状态，关闭后回牌桌 |
| 狗   | 速度检定被动 +1；可用于 4 格内远距交易                                                | L3 六段链                             | 已收口本对象：可选多张持有物、切到 4 格内队友、点击地图队友 token、确认交易、急救包/地图转移、狗标记已用并清空回牌桌              |
| 面具 | 速度检定被动 +1；移动同板块其他角色到相邻板块                                         | L3 六段链                             | 已收口本对象：可点面具本体，选择同板块队友，再选择相邻房间确认移动，结算后队友离开原房间，面具选择器和高亮清空回牌桌              |
| 头骨 | 知识检定被动 +1；死亡时投 3 骰，4+ 阻止死亡                                           | L3 双分支六段链                       | 已收口本对象：真实叛徒 token 攻击触发死亡保护，3 骰阻止死亡分支和未阻止死亡正常死亡分支均有真实页面截图和断言                     |
| 圣符 | 神志检定被动 +1；预兆翻出后立即作祟判定；探索声明可埋葬第一张发现板块并继续发现下一张 | L3 翻出作祟六段链 + L3 探索声明六段链 | 圣符翻出到作祟判定已收口；探索声明链已单列收口：声明、取消、重新声明、探索替换房间、事件结算、关闭回牌桌均有真实页面截图和断言    |
| 盔甲 | 受到物理伤害时减 1                                                                    | L3 六段链                             | 已收口本对象：真实持有区显示盔甲规则，电话铃声翻出后命中两骰物理伤害分支，伤害骰为 4 点时实际只扣 3 点身体属性，关闭后回到牌桌    |
| 雕像 | 力量检定被动 +1；探索声明可跳过事件                                                   | L3 六段链                             | 已收口本对象：真实页面先声明雕像跳过事件，再选择未知房间，翻出《阴影扑面》后显示跳过事件，力量不扣、事件未弃置，关闭后回牌桌      |
| 指环 | 神志检定被动 +1；可用神志攻击并造成精神伤害                                           | L3 六段链                             | 已收口本对象：真实页面选择指环武器、叛徒 token 高亮、4 骰神志攻击停稳、精神伤害结算、指环已用并关闭回牌桌；无武器攻击另有独立链；不外推匕首或其它攻击骰盘 |
| 匕首 | 攻击多 2 骰并花费 1 速度                                                              | L3 六段链                             | 已收口本对象：真实页面选择匕首武器、叛徒 token 高亮、6 骰力量攻击停稳、物理伤害与速度花费结算、匕首已用并关闭回牌桌；无武器攻击另有独立链；不外推指环或其它攻击骰盘 |

### 5.2 物品全家族矩阵

当前物品数据合同来自 `BETRAYAL_DISCOVERY_POOLS.possessions.item`，共 11 个条目。`地图 / 笔记本 / 日记 / 手稿`共享“放置探索者到已发现房间”效果，`手电筒 / 灯笼`共享事件检定加骰效果。急救包、奇怪的药品、兔脚、头戴耳机、手电筒/灯笼、魔法相机知识检定替代和骨制钥匙链只证明各自链路，不能证明全家族完成。

| 物品                        | 规则效果 / 交互点                            | 当前证据层级                   | 当前结论                                                                                                                                             |
| --------------------------- | -------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 魔法相机                    | 知识检定可由神志替代；可参与部分作祟归属     | L3 抽到物品链 + L3 知识检定替代六段链 + L3 作祟归属六段链 | 已收口本对象两条效果：外星几何知识检定从 3 骰改用神志 5 骰并结算知识 +1；《说“茄子”！》触发作祟时剧本 33 生效，叛徒归属为魔法相机持有者而非翻牌者 |
| 急救包                      | 埋葬后治疗自己或同房间队友的属性             | L3 六段链                      | 已收口本对象：本体、地图队友 token、治疗结算、清空状态                                                                                               |
| 奇怪的药品                  | 埋葬后治疗自己的力量/速度                    | L3 六段链                      | 已收口本对象：本体选中、无需目标直接使用、力量/速度恢复、药品消失、清空状态回牌桌                                                                    |
| 手电筒 / 灯笼               | 事件检定额外 +2 骰                           | L3 双对象六段链                | 已收口共享效果的两个对象：真实持有区分别显示手电筒/灯笼规则，外星几何翻出后知识检定从 3 骰变 5 骰，结算知识 +1 并关闭回牌桌                          |
| 头戴耳机                    | 受到精神伤害时减 1                           | L3 六段链                      | 已收口本对象：真实持有区显示头戴耳机规则，电话铃声翻出后命中一骰精神伤害分支，伤害骰为 2 点时实际只扣 1 点精神属性，关闭后回到牌桌                   |
| 地图 / 笔记本 / 日记 / 手稿 | 埋葬后把探索者放到已发现房间                 | L3 四对象六段链                | 地图已补六段链；笔记本、日记、手稿已补各自真实页面六段链：本体可见、选中、房间牌目标、目标已选、探索者落位、收口回牌桌；同步修正笔记本/日记/手稿显示名 |
| 兔脚                        | 最近一次投骰后重掷一颗骰；也可作为普通交易物 | L3 交易链 + L3 重掷链          | 交易链已收口；重掷链已补真实页面六段：最近投骰可见、兔脚本体选中、具体骰子圆形高亮、重掷骰盘更新、结算结果可见、收口回牌桌                           |
| 骨制钥匙                    | 移动到同楼层相邻但未连门的已发现房间         | L3 六段链                      | 已收口本对象：移动前牌桌、骨制钥匙本体、打开移动模式、点击同层相邻但未连门房间、穿墙移动结算、退出移动态回牌桌                                       |
| 砍刀                        | 攻击 +1 骰                                   | L3 代表链                      | 已有攻击代表链；指环、匕首和无武器攻击另有独立链，不由砍刀代表链外推完成                                                                           |

### 5.3 骰盘全家族矩阵

骰盘统一要求：开放式透明物理骰盘、0/1/2 山屋专用骰面、多骰不重叠、结果与玩家目标直接相连。当前通过代表链证明了实现方向，但仍要按触发家族登记覆盖范围。

| 骰盘触发家族            | 当前证据层级    | 当前结论                                                                                                     |
| ----------------------- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| 事件牌检定 / 自动投骰   | L3 23/23        | 事件牌当前数据合同已逐张覆盖；已纳入本轮骰盘家族登记                                                         |
| 可选作祟 / 可选事件投骰 | L3 多对象       | 肉质苔癣、一瓶微尘、说“茄子”！、一抹鲜红、大宅饿了等已覆盖用户点名时序                                       |
| 预兆翻出后的作祟判定    | L3 圣符 + L3 书本抽样 + L2 九张逐项确认 | 圣符完整链覆盖预兆翻出即时作祟骰盘；非圣符《书本》真实抽样链覆盖同构 UI；底层参数化确认 9 张预兆均会记录对应作祟检定骰面 |
| 房间/结束回合检定       | L3 火炉房代表链 + L3 倒塌房间速度坠落链 + L3 神秘电梯移动骰盘链 + L3 洗衣滑槽直接移动链 | 火炉房覆盖结束回合伤害；倒塌房间已翻出后的房间效果链覆盖结束回合 3 骰速度检定、坠落到地下室起始点和回牌桌；神秘电梯覆盖移动类房间 2 骰移动、房间移动到一层开放门位和无弹层回牌桌；洗衣滑槽覆盖真实探索翻出、结束回合无骰盘直接滑回地下室起始点和回牌桌 |
| 攻击骰盘                | L3 砍刀代表链 + L3 指环六段链 + L3 匕首六段链 + L3 无武器六段链 | 砍刀、指环、匕首和无武器分别覆盖普通物理武器、神志/精神伤害攻击、物理攻击加骰并花费速度、无武器默认力量物理攻击差异；判等依据：四条都走真实叛徒 token 目标、同一攻击骰盘组件和同一攻击结算 reducer，但武器规则字段不同 |
| 驱魔骰盘                | L3 失败链 + L3 成功终局链 | 失败分支已覆盖伤害和回牌桌；成功分支已覆盖成功骰盘、成功结果、确认进入终局和幸存者终局页；已纳入本轮骰盘家族登记 |
| 死亡保护骰盘            | L3 头骨双分支链 | 阻止死亡和未阻止死亡两条链均已覆盖 3 骰停稳、结果反馈、属性/死亡状态落位和回牌桌；不外推其它死亡/攻击骰盘    |
| 兔脚重掷骰盘            | L3 六段链       | 已补真实页面链：点击兔脚本体、选择具体骰子、重掷后骰盘更新、反馈和状态消耗可见；不外推其它改骰/死亡/攻击分支 |

## 6. 验证证据

### L1 结构证据

- BTR-03 文案检索命令：`rg -n "结算房间|Resolve Room|actionCueEndTurnRoomEffect|endTurnRoomEffect" public/locales/zh-CN/game-betrayal.json public/locales/en/game-betrayal.json src/games/betrayal/__tests__/Board.foundation.test.tsx e2e/betrayal/room-effect-representative.e2e.ts docs/games/betrayal/records/betrayal-playability-overhaul-plan-2026-07-14.md evidence/betrayal-playability-overhaul-2026-07-14.md`
- 结果：运行时 i18n 已改为 `结束回合` / `End Turn`；“结算房间”只保留在测试负向断言、专项问题描述和 evidence 说明中。
- 结论：用户点名的无规则动作名不再从运行时按钮或主提示文案外露。

### L2 领域行为证据

- BTR-01 haunt 阶段禁探索底层：
  - 命令：`npx eslint src\games\betrayal\game.ts src\games\betrayal\__tests__\firstScenarioRuntime.test.ts`
  - 结果：0 errors，5 个既有 unused warning。
  - 命令：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "haunt 阶段即使走本地测试通道也不能继续探索新房间" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`1 passed`。
  - 结论：haunt 阶段即使走本地测试/同屏调试通道，也不能越过规则校验继续探索未知房间；这证明规则门禁，不单独证明真实页面无入口。
- BTR-02 圣符作祟底层：
  - 命令：`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "圣符|恶兆|haunt|作祟" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过。
  - 结论：翻出预兆《圣符》会记录本次作祟检定骰面、来源牌名、作祟检定标签和未触发/触发结果；这只证明底层规则状态，不证明真实页面完整链路。
- BTR-02 圣符 Board 显示回归：
  - 命令：`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "圣符预兆翻出后同屏显示作祟检定骰盘" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过。
  - 结论：真实 Board 组件探索翻出预兆《圣符》后，同屏显示圣符发现面板与作祟检定骰盘；该层只证明组件回归，完整端到端以 L3 E2E 为准。
- BTR-04 驱魔失败 / 死亡边界领域回归：
  - 命令：`npx eslint src\games\betrayal\__tests__\firstScenarioRuntime.test.ts`
  - 结果：0 errors。
  - 命令：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "最终驱魔失败" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`3 passed`。
  - 结论：当前领域实现不是“失败就突然死亡”：失败后只对每名存活英雄造成 1 点身体伤害；安全属性英雄不死，濒死英雄只有在这 1 点身体伤害后触及当前数值模型死亡边界才死亡；只有全部英雄死亡才进入叛徒胜利终局。该层只证明底层规则，不证明真实页面六段链。
- BTR-04 驱魔失败 UI 收口回归：
  - 命令：`npx eslint src\games\betrayal\Board.tsx e2e\betrayal\first-scenario-exorcism-failure.e2e.ts src\games\betrayal\__tests__\firstScenarioRuntime.test.ts`
  - 结果：0 errors。
  - 命令：`node -e "JSON.parse(require('fs').readFileSync('public/locales/zh-CN/game-betrayal.json','utf8')); JSON.parse(require('fs').readFileSync('public/locales/en/game-betrayal.json','utf8')); console.log('locale json ok')"`
  - 结果：`locale json ok`。
  - 结论：驱魔失败骰盘现在有玩家可见的“返回牌桌”关闭动作；成功驱魔仍沿原按钮进入终局，失败驱魔关闭后回到 haunt 牌桌。

### L3 真实玩法证据

- BTR-01 haunt 阶段禁探索真实页面负向链：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/haunt-no-explore.e2e.ts "haunt 阶段真实页面不暴露探索入口并拒绝探索命令"`
  - 结果：`1 passed`
  - 截图：`evidence/山屋惊魂-haunt阶段禁探索/01-haunt阶段-牌桌无探索入口.jpg`
  - 截图：`evidence/山屋惊魂-haunt阶段禁探索/02-haunt阶段-探索命令被拒绝.jpg`
  - 自审：目标明确为“haunt 阶段不能继续探索新房间”；流程先证明真实牌桌不再给玩家暴露探索新房间入口，再强制派发探索命令并看到规则拒绝结果；这条只证明 BTR-01，不证明驱魔、骰盘、物品或交易已收口。
- BTR-02 圣符作祟判定真实页面六段链：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/holy-symbol-haunt-roll.e2e.ts "预兆圣符从探索翻出到作祟检定和关闭回牌桌"`
  - 结果：`1 passed`
  - 截图：`evidence/山屋惊魂-圣符作祟判定/01-圣符作祟判定-探索前.jpg`
  - 截图：`evidence/山屋惊魂-圣符作祟判定/02-圣符作祟判定-选择未知房间.jpg`
  - 截图：`evidence/山屋惊魂-圣符作祟判定/03-圣符作祟判定-圣符翻出.jpg`
  - 截图：`evidence/山屋惊魂-圣符作祟判定/04-圣符作祟判定-作祟骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-圣符作祟判定/05-圣符作祟判定-结果可见.jpg`
  - 截图：`evidence/山屋惊魂-圣符作祟判定/06-圣符作祟判定-关闭后回牌桌.jpg`
  - AI 核图：低清联系图 `evidence/山屋惊魂-圣符作祟判定/圣符作祟判定-六段联系图-低清核验.jpg` 已确认六张图属于同一条圣符链，能看到圣符翻出、作祟骰盘停稳、结果可见、关闭后回牌桌。
  - 自审：目标明确为“预兆《圣符》翻出后立即作祟判定并关闭回牌桌”；流程从真实探索按钮和真实未知房间选择开始，不是直接注入 临时事件态；这条只证明 BTR-02。BTR-01 haunt 禁探索另有独立负向链证据，其它对象必须看各自链路证据。
- 非圣符预兆作祟判定抽样与逐项确认：
  - 静态检查：`npx eslint e2e\betrayal\holy-symbol-haunt-roll.e2e.ts src\games\betrayal\__tests__\firstScenarioRuntime.test.ts` 通过，0 errors。
  - Vitest：`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "预兆.*作祟检定骰面|最后一张恶兆" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`10 passed`，覆盖 9 张预兆逐项作祟检定骰面记录和最后一张恶兆自动触发。
  - E2E：`npm run test:e2e:file -- e2e/betrayal/holy-symbol-haunt-roll.e2e.ts "非圣符预兆书本"` 通过，`1 passed`。
  - 截图：`evidence/山屋惊魂-预兆作祟判定抽样完整链路/书本作祟判定-01-探索前.jpg`
  - 截图：`evidence/山屋惊魂-预兆作祟判定抽样完整链路/书本作祟判定-02-选择未知房间.jpg`
  - 截图：`evidence/山屋惊魂-预兆作祟判定抽样完整链路/书本作祟判定-03-书本翻出.jpg`
  - 截图：`evidence/山屋惊魂-预兆作祟判定抽样完整链路/书本作祟判定-04-作祟骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-预兆作祟判定抽样完整链路/书本作祟判定-05-结果可见.jpg`
  - 截图：`evidence/山屋惊魂-预兆作祟判定抽样完整链路/书本作祟判定-06-关闭后回牌桌.jpg`
  - AI 核图：低清联系图 `temp/betrayal-book-omen-haunt-roll-sample-contact-lowres.jpg` 已确认六张图属于同一条非圣符预兆作祟链，能看到《书本》翻出、开放式作祟骰盘停稳、结果可见和关闭后回牌桌。
  - 自审：目标明确为“预兆翻出后的作祟判定不是圣符专属壳层”。《书本》作为非圣符预兆从真实探索入口起跑，显示预兆牌面、作祟检定骰盘、结果和回牌桌；领域测试逐项确认当前 9 张预兆均记录对应作祟检定骰面。该链证明预兆翻出作祟的共享合同，特殊能力仍按各自对象链单独审。
- 圣符探索声明真实页面六段链：
  - 命令：`npx eslint src\games\betrayal\Board.tsx e2e\betrayal\holy-symbol-explore-declaration.e2e.ts`
  - 结果：0 errors。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/holy-symbol-explore-declaration.e2e.ts "真实页面声明圣符、取消、重新声明、探索并收口"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-圣符探索声明完整链路/01-圣符声明前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-圣符探索声明完整链路/02-圣符探索声明已选中.jpg`
  - 截图：`evidence/山屋惊魂-圣符探索声明完整链路/03-取消圣符声明后回到未声明.jpg`
  - 截图：`evidence/山屋惊魂-圣符探索声明完整链路/04-重新声明后选择未知房间.jpg`
  - 截图：`evidence/山屋惊魂-圣符探索声明完整链路/05-圣符替换房间并结算事件.jpg`
  - 截图：`evidence/山屋惊魂-圣符探索声明完整链路/06-关闭后回牌桌继续可操作.jpg`
  - AI 核图：低清联系图 `temp/betrayal-holy-symbol-explore-declaration-contact-lowres.jpg` 已确认六张图属于同一条圣符探索声明链，能看到声明、取消、重新声明、探索、圣符替换房间并结算事件、关闭后回牌桌。
  - 自审：目标明确为“圣符探索声明必须先由玩家声明，可取消并重新声明，探索时埋葬第一张发现板块并继续发现下一张，最终事件结算后关闭回牌桌”；流程从真实牌桌按钮和真实未知房间选择开始，不是直接注入替换结果。E2E 同步断言了声明按钮热区不小于 34px、保持透明开放式且无多余背景框、取消后回到未声明、重新声明后探索、日志包含“圣符埋葬倒塌房间”和“继续发现神秘电梯”、倒塌房间坠落效果没有落到牌桌、事件《滑落阶梯》结算速度 -1、关闭后发现/事件选择清空且牌桌继续可操作。该链只证明圣符探索声明，不外推其它预兆、雕像探索声明或全家族完成。
- BTR-03 房间停留效果真实页面链：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/room-effect-representative.e2e.ts "火炉房代表停留效果 family：真实页面提示结束回合伤害并结算反馈"`
  - 结果：`1 passed`
  - 截图：`evidence/betrayal-room-effect-representatives/03-火炉房-结束回合前提示.jpg`
  - 截图：`evidence/betrayal-room-effect-representatives/04-火炉房-结算后反馈.jpg`
  - 自审：目标明确为“结束回合时处理房间停留效果”；流程是先看到结束回合前提示，再点击结束回合，随后看到火炉房 1 点物理伤害反馈；这条只证明 BTR-03，不证明 haunt、圣符、驱魔、骰盘、物品或交易已收口。
- 倒塌房间速度坠落房间效果真实页面六段链：
  - 静态检查：`npx eslint e2e\betrayal\room-effect-representative.e2e.ts` 通过，0 errors。
  - 领域回归：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "倒塌房间" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`4 passed`。
  - 命令：`PW_E2E_SERVICE_REUSE=isolated node scripts\infra\run-e2e-single.mjs ci e2e/betrayal/room-effect-representative.e2e.ts "倒塌房间速度坠落真实链路"`。
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-倒塌房间速度检定完整链路/01-倒塌房间已翻出牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-倒塌房间速度检定完整链路/02-倒塌房间结束回合检定状态可见.jpg`
  - 截图：`evidence/山屋惊魂-倒塌房间速度检定完整链路/03-倒塌房间速度坠落提示可见.jpg`
  - 截图：`evidence/山屋惊魂-倒塌房间速度检定完整链路/04-结束回合触发速度检定前.jpg`
  - 截图：`evidence/山屋惊魂-倒塌房间速度检定完整链路/05-速度检定骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-倒塌房间速度检定完整链路/06-坠落后地下室起始点回牌桌可操作.jpg`
  - AI 核图：低清联系图 `temp/betrayal-collapsed-room-speed-check-full-chain-contact-lowres.jpg` 已确认六张图属于同一条倒塌房间结束回合速度坠落链，能看到倒塌房间已在牌桌上、结束回合检定提示、3 骰速度检定骰盘停稳、坠落后地下室起始点回牌桌可操作。
  - 自审：目标明确为“倒塌房间已翻出后，结束回合触发速度检定，失败后坠落到地下室起始点并回到可操作牌桌”。E2E 同步断言了倒塌房间标题、结束回合检定提示、`recentRoll.kind=roomEndTurnTraitCheck`、来源为倒塌房间、属性为速度、骰子数量为 3、结果为“坠落到地下室起始点”、当前探索者落到地下室起始点并受到 1 点身体伤害、发现/事件面板清空、行动栏仍可见。该链只证明“房间已出现后的结束回合房间效果链”；移动类房间骰盘和无骰盘房间移动已在神秘电梯、洗衣滑槽行单独登记。
- 神秘电梯移动骰盘房间效果真实页面六段链：
  - 静态检查：`npx eslint e2e\betrayal\room-effect-representative.e2e.ts` 通过，0 errors。
  - 领域回归：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "神秘电梯" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`2 passed`。
  - 命令：`PW_E2E_SERVICE_REUSE=isolated node scripts\infra\run-e2e-single.mjs ci e2e/betrayal/room-effect-representative.e2e.ts "神秘电梯移动骰盘真实链路"`。
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-神秘电梯移动骰盘完整链路/01-神秘电梯已翻出牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-神秘电梯移动骰盘完整链路/02-神秘电梯房间效果按钮可见.jpg`
  - 截图：`evidence/山屋惊魂-神秘电梯移动骰盘完整链路/03-启动神秘电梯前.jpg`
  - 截图：`evidence/山屋惊魂-神秘电梯移动骰盘完整链路/04-神秘电梯2骰移动骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-神秘电梯移动骰盘完整链路/05-神秘电梯移动到一层开放门位.jpg`
  - 截图：`evidence/山屋惊魂-神秘电梯移动骰盘完整链路/06-神秘电梯移动后回牌桌继续可操作.jpg`
  - AI 核图：低清联系图 `temp/betrayal-mystic-elevator-move-roll-full-chain-contact-lowres.jpg` 已确认六张图属于同一条神秘电梯移动骰盘链，能看到神秘电梯已在牌桌上、房间效果按钮可见、2 骰移动骰盘停稳、移动到一层开放门位并回到可操作牌桌。该联系图只用于 AI 核图，不替代原始截图。
  - 自审：目标明确为“神秘电梯已翻出后，玩家启动房间效果，投 2 颗山屋骰决定移动楼层，房间移动到一层开放门位并回到可操作牌桌”。E2E 同步断言了神秘电梯标题、房间效果按钮、启动前没有本次骰盘、`recentRoll.kind=mysticElevator`、来源为神秘电梯、骰子数量为 2、骰面为 `[1, 1]`、结果为“移动到未探索”、神秘电梯房间移动到一层、房间效果本回合已使用、发现/事件面板清空、行动栏仍可见。该链只证明神秘电梯移动类房间骰盘链；洗衣滑槽直接移动已按无骰盘房间移动单独登记。
- 洗衣滑槽直接移动真实页面六段链：
  - 静态检查：`npx eslint e2e\betrayal\room-effect-representative.e2e.ts` 通过，0 errors。
  - 命令：`npm run test:e2e:file -- e2e/betrayal/room-effect-representative.e2e.ts "洗衣滑槽直接移动真实链路"`。
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-洗衣滑槽直接移动完整链路/01-地下室起始点探索前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-洗衣滑槽直接移动完整链路/02-选择地下未知房间目标.jpg`
  - 截图：`evidence/山屋惊魂-洗衣滑槽直接移动完整链路/03-洗衣滑槽翻出并落位.jpg`
  - 截图：`evidence/山屋惊魂-洗衣滑槽直接移动完整链路/04-结束回合滑落提示可见.jpg`
  - 截图：`evidence/山屋惊魂-洗衣滑槽直接移动完整链路/05-结束回合后滑落到地下室起始点.jpg`
  - 截图：`evidence/山屋惊魂-洗衣滑槽直接移动完整链路/06-洗衣滑槽结算后回牌桌继续可操作.jpg`
  - AI 核图：低清联系图 `temp/betrayal-laundry-chute-full-chain-contact-lowres.jpg` 已确认六张图属于同一条真实链，能看到地下室起始点探索前、选择地下未知房间、洗衣滑槽翻出、结束回合滑落提示、滑回地下室起始点、发现/事件面板清空并回到可操作牌桌。
  - 自审：目标明确为“洗衣滑槽是结束回合无骰盘直接移动，不是房间效果骰盘”。流程从真实探索入口和地下未知房间选择开始，不是直接注入已发现房间；E2E 同步断言洗衣滑槽房间牌翻出、当前探索者落位、结束回合提示包含地下室起始点、结束回合后玩家 0 被放回地下室起始点、`recentRoll` 为空且页面没有 recent roll 骰盘、发现/事件面板清空并保留行动栏。该链只证明洗衣滑槽直接移动，不外推倒塌房间速度检定或神秘电梯移动骰盘。
- BTR-04 驱魔失败伤害真实页面六段链：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/first-scenario-exorcism-failure.e2e.ts "最终驱魔失败从真实入口到伤害结算再关闭回牌桌"`
  - 结果：`1 passed`
  - 截图：`evidence/山屋惊魂-驱魔失败伤害链/01-驱魔失败伤害链-驱魔前.jpg`
  - 截图：`evidence/山屋惊魂-驱魔失败伤害链/02-驱魔失败伤害链-选择杰克之灵房间.jpg`
  - 截图：`evidence/山屋惊魂-驱魔失败伤害链/03-驱魔失败伤害链-骰盘停稳失败.jpg`
  - 截图：`evidence/山屋惊魂-驱魔失败伤害链/04-驱魔失败伤害链-失败伤害结果.jpg`
  - 截图：`evidence/山屋惊魂-驱魔失败伤害链/05-驱魔失败伤害链-关闭前.jpg`
  - 截图：`evidence/山屋惊魂-驱魔失败伤害链/06-驱魔失败伤害链-关闭后回牌桌.jpg`
  - AI 核图：低清联系图 `evidence/山屋惊魂-驱魔失败伤害链/驱魔失败伤害链-六段联系图-低清核验.jpg` 已确认六张图属于同一条驱魔失败链，能看到驱魔前、房间目标、失败骰盘、结果、关闭按钮、关闭后回牌桌。
  - 自审：目标明确为“驱魔失败不能突然误死，必须按失败伤害结算并能关闭回牌桌”；流程从真实驱魔入口和真实房间本体选择开始，不是直接注入失败结果；该链只证明 BTR-04，不证明骰盘全家族、物品使用或交易已收口。
- BTR-04 驱魔成功终局真实页面六段链：
  - 静态检查：`npx eslint e2e\betrayal\first-scenario-exorcism-success.e2e.ts` 通过，0 errors。
  - Vitest：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "英雄线可击倒叛徒|最终驱魔成功|驱魔结算" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`1 passed`。
  - 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/first-scenario-exorcism-success.e2e.ts "最终驱魔成功从真实入口到幸存者终局"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-驱魔成功终局完整链路/01-驱魔成功前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-驱魔成功终局完整链路/02-杰克之灵目标高亮.jpg`
  - 截图：`evidence/山屋惊魂-驱魔成功终局完整链路/03-驱魔成功骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-驱魔成功终局完整链路/04-驱魔成功结果可见.jpg`
  - 截图：`evidence/山屋惊魂-驱魔成功终局完整链路/05-确认进入终局前.jpg`
  - 截图：`evidence/山屋惊魂-驱魔成功终局完整链路/06-幸存者终局页可见.jpg`
  - AI 核图：低清联系图 `temp/betrayal-exorcism-success-full-chain-contact-lowres.jpg` 已确认六张图属于同一条驱魔成功链，能看到驱魔前、杰克之灵目标、成功骰盘停稳、成功结果、确认进入终局和幸存者终局页。
  - 自审：目标明确为“驱魔成功必须从真实驱魔入口进入成功骰盘，再进入幸存者终局”。流程从真实牌桌的驱魔动作和真实杰克之灵房间目标起跑，不是直接注入终局页；E2E 同步断言 `phase=endgame`、`recentRoll.latestLabel=驱魔成功`、`endgameResult.outcome=survivors`、杰克之灵已释放，最终终局页显示“幸存者逃脱”。该链只证明 BTR-04 的成功分支和终局承接，不证明其它骰盘或物品全家族已收口。
- BTR-05 山屋骰盘代表链：
  - 根因定位：`BetrayalHouseDice3DGroup` 原先所有实例都传 `canvasTestId="betrayal-house-dice-box-canvas"`；多个 RecentRollPanel 同屏或前后残留时，E2E 可能读取旧骰盘或错误骰盘的 Three.js 调试快照。
  - 本轮修正：`RecentRollPanel` 现在按 `roll.id` 生成独立山屋骰盘 canvas 调试键；E2E helper 改为从当前 roll panel 内的 canvas / dice group 读取对应调试快照；`DiceBoxThreeEngine.destroy()` 只清理本实例注册的调试函数，避免旧实例滞留；山屋骰盘 profile 改为相机可视区内投掷和落定散布，`DiceBoxPhysicsSource` 在冻结采样前执行落定分散，`settleDiceIntoSafeSpread()` 已支持 2/3/4/5 颗骰子。
  - 静态验证：`npx eslint src\games\betrayal\Board.tsx src\lib\dice-physics\DiceBoxPhysicsSource.tsx src\lib\dice-box-threejs\engine.ts e2e\betrayal\betrayalTestHelpers.ts e2e\betrayal\non-p0-representative.e2e.ts` 通过。
  - 已通过代表链：`npm run test:e2e:ci:file -- e2e/betrayal/non-p0-representative.e2e.ts "普通投骰事件代表链：真实页面同屏展示牌面、骰盘和分支结果"` 通过；截图刷新到 `evidence/betrayal-non-p0-representatives/01-普通投骰事件-探索目标.jpg` 到 `04-普通投骰事件-牌面骰盘分支.jpg`。
  - 已通过代表链：`npm run test:e2e:ci:file -- e2e/betrayal/non-p0-representative.e2e.ts "砍刀攻击武器代表链：真实页面可选择武器并完成攻击反馈"` 通过；截图刷新到 `evidence/betrayal-non-p0-representatives/08-砍刀攻击武器-选择前.jpg` 到 `11-砍刀攻击武器-攻击反馈.jpg`。
  - AI 核图：低清联系图 `temp/betrayal-hunting-knife-chain-contact-lowres.jpg` 已确认四段属于同一条砍刀攻击链，能看到选择前、目标高亮、攻击投骰和攻击反馈；攻击投骰图里 4 颗山屋专用骰分开可辨认，不再中心塌缩或明显重叠。
  - 自审：这次不放宽开放式骰盘、多骰不重叠、专用 0/1/2 骰面门禁；修复直接作用于真实物理骰落定布局和当前面板快照读取。BTR-05 家族登记已由普通投骰、攻击、驱魔、兔脚重掷、死亡保护、预兆作祟和房间检定链共同覆盖；当前边界外骰盘另立任务。
- 2026-07-15 右上角骰盘回归补充：
  - 代码修正：`src/games/betrayal/Board.tsx` 中桌面 recent roll 面板统一使用中央开放牌桌形态，`openTable` 不再只限移动横屏；桌面布局从右上/顶部区域改为主牌桌居中区域，避免侵入右上状态信息。
  - E2E 几何门禁：`e2e/betrayal/room-effect-representative.e2e.ts` 新增 `expectRollPanelUsesCentralOpenTable()`，断言骰盘面板为 `open-table-transparent`、中心接近视口中央、top 不贴顶部状态区，且不与右侧状态栏重叠。
  - 命令：`npm run test:e2e:file -- e2e/betrayal/room-effect-representative.e2e.ts "倒塌房间速度坠落真实链路"` 通过，`1 passed`。
  - 命令：`npm run test:e2e:file -- e2e/betrayal/room-effect-representative.e2e.ts "神秘电梯移动骰盘真实链路"` 通过，`1 passed`。
  - 原图：`evidence/山屋惊魂-倒塌房间速度检定完整链路/05-速度检定骰盘停稳.jpg`。
  - 原图：`evidence/山屋惊魂-神秘电梯移动骰盘完整链路/04-神秘电梯2骰移动骰盘停稳.jpg`。
  - 自审：这项只证明本轮点名的“右上角骰盘区域不该出现，普通/房间效果骰盘走中央开放区”回归，不外推为骰盘全家族已完成。
- 2026-07-15 角色面板与角色 token 同源补充：
  - 代码修正：`ExplorerFigureToken` 暴露玩家、角色、棋子素材和色调同源字段；当前角色面板、当前属性区、桌面队友面板和底部队友入口均使用同一 token 组件或同源字段，避免面板头像与地图棋子无法对应。
  - 验证：`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx --testNamePattern "真实运行时基础布局"` 通过，`1 passed`；退出后 `socket hang up / ECONNRESET` 只作为既有噪声记录，命令退出码为 0。
  - 静态检查：`npx eslint src\games\betrayal\__tests__\Board.foundation.test.tsx` 通过，0 errors。
  - 自审：测试覆盖当前地图 token 与当前面板 token/属性区同源，也覆盖桌面队友面板和底部队友入口同源；不把队友地图 token 强行作为断言前提，因为队友可能不在当前楼层。
- 2026-07-15 连续移动体验补充：
  - 代码修正：移动命令结算后保留移动模式；`baseCore` 同步 preview state 时，如果仍有移动点且仍有普通/骨制钥匙合法移动目标，则继续继承 `interactionMode="move"`；无移动点或无目标时才自动退回默认。
  - E2E：`npm run test:e2e:file -- e2e/betrayal/basic-flow.e2e.ts "运行时移动后不点取消也能连续移动到第二个房间"` 通过，`1 passed`。
  - 原图：`evidence/betrayal-basic-flow/07c-山屋惊魂-运行时-移动模式选择门厅.jpg`。
  - 原图：`evidence/betrayal-basic-flow/07d-山屋惊魂-运行时-移动后仍可继续选择大阶梯.jpg`。
  - 原图：`evidence/betrayal-basic-flow/07e-山屋惊魂-运行时-不取消连续移动完成.jpg`。
  - AI 核图：低清联系图 `temp/betrayal-current-fixes-contact.jpg` 已确认三张连续移动图能看到候选房间持续高亮，最终角色 token 到达大阶梯；该图只用于 AI 核图，不替代原始截图。
  - 自审：这项只证明普通移动中“移动一次后无需点取消即可继续移动”的用户体验，不外推骨制钥匙、面具或其它特殊移动全家族。
- 兔脚重掷真实页面六段链：
  - 代码/测试更新：新增 `e2e/betrayal/rabbit-foot-reroll.e2e.ts`，从最近投骰可见状态起跑，后续通过真实页面点击兔脚本体和骰子圆形命中区，不直接派发重掷命令。
  - 静态验证：`npx eslint e2e/betrayal/rabbit-foot-reroll.e2e.ts` 通过。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/rabbit-foot-reroll.e2e.ts "兔脚从最近投骰点击本体、选择骰子、重掷结算并收口"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-兔脚重掷完整链路/01-兔脚重掷前最近投骰可见.jpg`
  - 截图：`evidence/山屋惊魂-兔脚重掷完整链路/02-兔脚本体已选中.jpg`
  - 截图：`evidence/山屋惊魂-兔脚重掷完整链路/03-选择具体骰子高亮.jpg`
  - 截图：`evidence/山屋惊魂-兔脚重掷完整链路/04-重掷后骰盘更新.jpg`
  - 截图：`evidence/山屋惊魂-兔脚重掷完整链路/05-重掷结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-兔脚重掷完整链路/06-收口后回牌桌可操作.jpg`
  - 自审：目标明确为“兔脚必须作为真实物品本体介入最近投骰，玩家直接点具体骰子完成重掷，结算结果更新并清空选中态”。E2E 断言了兔脚本体 `data-roll-modifier-available=true`、选骰层 `betrayal-rabbit-foot-dice` 出现后消失、没有旧的数字按钮 `betrayal-rabbit-foot-die-1`、骰子目标为圆形命中区、重掷后骰面从 `2,0,0` 更新为 `2,2,0`、反馈显示“使用兔脚重掷第 2 颗骰子”、`usedCardIdsThisTurn` 与 `consumedRabbitFootCardIds` 记录兔脚、最终选中物品和选骰层清空回牌桌。该链只证明兔脚重掷骰盘，不证明其它改骰、死亡保护或攻击分支全部收口。
- BTR-06 物品使用真实页面六段链：
  - 代码修正：`src/games/betrayal/testing/firstScenarioTestUtils.ts` 增加急救包可用代表态；`src/games/betrayal/Board.tsx` 将治疗目标提示改为“急救包治疗”，让玩家知道目标选择属于哪张物品；`public/locales/*/game-betrayal.json` 增加对应文案。
  - 命令：`npx eslint e2e\betrayal\first-scenario-use-possession.e2e.ts`
  - 结果：通过。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/first-scenario-use-possession.e2e.ts "真实页面选择急救包、选队友目标并完成治疗收口"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-物品使用完整链路/01-使用前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-物品使用完整链路/02-急救包本体已选中.jpg`
  - 截图：`evidence/山屋惊魂-物品使用完整链路/03-同房间队友目标可选.jpg`
  - 截图：`evidence/山屋惊魂-物品使用完整链路/04-同房间队友目标已选中.jpg`
  - 截图：`evidence/山屋惊魂-物品使用完整链路/05-急救包结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-物品使用完整链路/06-物品使用后回牌桌状态清空.jpg`
  - AI 核图：低清联系图 `evidence/山屋惊魂-物品使用完整链路/物品使用完整链路-六段联系图-低清核验.jpg` 已确认六张图属于同一条急救包链，能看到急救包本体被选中、同房间队友 token 可选并被选中、治疗结算结果可见、使用后回到牌桌清空状态。
  - 自审：目标明确为“物品使用必须按物品本体 -> 目标 -> 结算 -> 收口走完整链”；流程从真实持有物急救包牌面和真实地图队友 token 起跑，不是侧边文字代理或直接 dispatch；结算后急救包从当前持有区消失、治疗目标选择器清空，队友若仍有高亮只能是同房间常驻候选态，不是治疗已选残留。该链只证明 BTR-06，不证明骰盘全家族已收口。
- 奇怪的药品真实页面六段链：
  - 代码/测试更新：新增 `createHolyWaterUseReadyCore` 和 `createHolyWaterUseReadyRuntimeCore`，并新增 `e2e/betrayal/holy-water-use.e2e.ts`。测试从真实页面药品本体起跑，点击 `奇怪的药品` 牌面和使用按钮，不直接派发使用命令。
  - 静态验证：`npx eslint src/games/betrayal/testing/firstScenarioTestUtils.ts e2e/betrayal/betrayalTestHelpers.ts e2e/betrayal/holy-water-use.e2e.ts` 通过。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/holy-water-use.e2e.ts "真实页面选择奇怪的药品、直接使用并恢复力量速度收口"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-奇怪的药品使用完整链路/01-药品使用前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-奇怪的药品使用完整链路/02-奇怪的药品本体已选中.jpg`
  - 截图：`evidence/山屋惊魂-奇怪的药品使用完整链路/03-药品无需目标可直接使用.jpg`
  - 截图：`evidence/山屋惊魂-奇怪的药品使用完整链路/04-药品结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-奇怪的药品使用完整链路/05-药品使用后回牌桌状态清空.jpg`
  - 截图：`evidence/山屋惊魂-奇怪的药品使用完整链路/06-收口后牌桌继续可操作.jpg`
  - AI 核图：低清联系图 `temp/betrayal-holy-water-use-full-chain-contact-lowres.jpg` 已确认六张图属于同一条奇怪的药品链，能看到药品本体选中、无需队友目标选择、使用后力量/速度恢复反馈、药品从持有区消失并回到可操作牌桌。该联系图只用于 AI 核图，不替代原始截图。
  - 自审：目标明确为“奇怪的药品必须作为真实物品本体使用，治疗当前探索者力量和速度并收口”。流程从真实持有物牌面起跑，不是直接 dispatch；E2E 证明了使用前按钮禁用、选中药品后不出现队友目标选择器且使用按钮可用、结算后 `usedCardIdsThisTurn` 记录药品、力量/速度恢复、药品消失、已选物品和目标选择提示清空。该链只证明奇怪的药品本对象，不外推到手电筒 / 灯笼 / 头戴耳机 / 骨制钥匙等其它物品。
- 地图物品放置探索者六段链：
  - 代码/测试更新：`e2e/betrayal/inventory-density.e2e.ts` 将“地图物品通过房间牌本体选择目标并放置探索者”从两段截图扩为六段截图，并补充使用前禁用、选物品后禁用、选目标后可用、结算后物品消失、目标选择器清空和回牌桌断言。
  - 静态验证：`npx eslint e2e/betrayal/inventory-density.e2e.ts` 通过。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/inventory-density.e2e.ts "地图物品通过房间牌本体选择目标并放置探索者"`
  - 结果：`1 passed`。
  - 截图：`evidence/betrayal-inventory-density/06-山屋惊魂-地图物品-使用前牌桌可操作.jpg`
  - 截图：`evidence/betrayal-inventory-density/07-山屋惊魂-地图物品-地图本体已选中.jpg`
  - 截图：`evidence/betrayal-inventory-density/08-山屋惊魂-地图物品-房间牌直选目标.jpg`
  - 截图：`evidence/betrayal-inventory-density/09-山屋惊魂-地图物品-房间目标已选中.jpg`
  - 截图：`evidence/betrayal-inventory-density/10-山屋惊魂-地图物品-使用后探索者落位.jpg`
  - 截图：`evidence/betrayal-inventory-density/11-山屋惊魂-地图物品-收口后回牌桌.jpg`
  - 自审：目标明确为“地图类物品必须按物品本体 -> 房间牌目标 -> 确认使用 -> 探索者落位 -> 状态清空回牌桌走完整链”。该链从真实持有物地图和真实房间牌本体起跑，不是直接 dispatch；E2E 证明了未选物品前使用禁用、已选地图但未选房间前使用仍禁用、选中上层起始点后使用可点、结算后反馈包含地图和上层起始点、探索者 token 落到上层起始点、地图从当前持有区消失、已选物品和目标选择器清空。该链只证明地图这一共享效果代表，不直接证明笔记本 / 日记 / 手稿全量无接线偏差。
- 笔记本 / 日记 / 手稿共享放置物品六段链：
  - 代码/测试更新：`src/games/betrayal/scenarioConfig.ts` 将 `notebook / journal / manuscript` 的中文显示名修正为“笔记本 / 日记 / 手稿”；`e2e/betrayal/inventory-density.e2e.ts` 新增三条共享放置物品真实页面六段链。
  - 静态验证：`npx eslint src\games\betrayal\scenarioConfig.ts src\games\betrayal\game.ts src\games\betrayal\__tests__\firstScenarioRuntime.test.ts src\games\betrayal\__tests__\Board.foundation.test.tsx e2e\betrayal\inventory-density.e2e.ts` 通过，0 errors（保留既有未用函数 warning）。
  - 领域回归：`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "map|notebook|journal|manuscript|地图|笔记本|日记|手稿" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`8 passed`。
  - Board 定向：`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "map|notebook|journal|manuscript|地图|笔记本|日记|手稿" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`5 passed`；尾部 `socket hang up / ECONNRESET` 只作为既有噪声记录，退出码为 0。
  - E2E：`npm run test:e2e:file -- e2e/betrayal/inventory-density.e2e.ts "共享放置物品链路"` 通过，`3 passed`。
  - 截图：`evidence/山屋惊魂-共享放置物品完整链路/笔记本-放置链路-01-使用前牌桌可操作.jpg` 到 `笔记本-放置链路-06-收口后回牌桌.jpg`。
  - 截图：`evidence/山屋惊魂-共享放置物品完整链路/日记-放置链路-01-使用前牌桌可操作.jpg` 到 `日记-放置链路-06-收口后回牌桌.jpg`。
  - 截图：`evidence/山屋惊魂-共享放置物品完整链路/手稿-放置链路-01-使用前牌桌可操作.jpg` 到 `手稿-放置链路-06-收口后回牌桌.jpg`。
  - AI 核图：低清联系图 `temp/betrayal-shared-place-explorer-items-contact-lowres.jpg` 已确认三组 6 段均属于共享放置物品链，能看到各自物品本体、选中、房间牌目标、探索者落位和回牌桌；该联系图只用于 AI 核图，不替代原始截图。
  - 自审：目标明确为“笔记本、日记、手稿不是地图别名，而是与地图同源效果的三个独立物品对象”。流程从真实持有区物品本体和真实房间牌目标起跑，不是拿地图链代表；E2E 对三张牌分别断言使用前按钮禁用、选中后显示各自名称、未选目标前使用仍禁用、房间目标可选、目标已选后可用、结算反馈包含各自名称和上层起始点、物品从持有区消失、目标选择器清空并回牌桌。该链收口共享放置效果四对象，但不外推其它物品能力。
- 已有代表链：
  - 上古旧宅完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/上古旧宅-完整链路-01-探索前.jpg` 到 `上古旧宅-完整链路-06-关闭后.jpg`
  - 夜幕众星完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/夜幕众星-完整链路-01-探索前.jpg` 到 `夜幕众星-完整链路-06-关闭后.jpg`
  - 蜘蛛！完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/蜘蛛-完整链路-01-探索前.jpg` 到 `蜘蛛-完整链路-06-关闭后.jpg`
  - 外星几何完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/外星几何-完整链路-01-探索前.jpg` 到 `外星几何-完整链路-06-关闭后.jpg`
  - 电话铃声完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/电话铃声-完整链路-01-探索前.jpg` 到 `电话铃声-完整链路-06-关闭后.jpg`
  - 嘎吱的木门完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/嘎吱的木门-完整链路-01-探索前.jpg` 到 `嘎吱的木门-完整链路-06-关闭后.jpg`
  - 小机器人完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/小机器人-完整链路-01-探索前.jpg` 到 `小机器人-完整链路-06-关闭后.jpg`
  - 一条秘密通道完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/一条秘密通道-完整链路-01-探索前.jpg` 到 `一条秘密通道-完整链路-06-关闭后.jpg`
  - 脑状食品完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/脑状食品-完整链路-01-探索前.jpg` 到 `脑状食品-完整链路-06-关闭后.jpg`
  - 肉质苔癣完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/肉质苔癣-完整链路-01-探索前.jpg` 到 `肉质苔癣-完整链路-06-关闭后回牌桌.jpg`
  - 一瓶微尘完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/一瓶微尘-完整链路-01-探索前.jpg` 到 `一瓶微尘-完整链路-06-关闭后回牌桌.jpg`
  - 大宅饿了完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/大宅饿了-完整链路-01-探索前.jpg` 到 `大宅饿了-完整链路-06-关闭后回牌桌.jpg`
  - 说“茄子”！完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/说茄子-完整链路-01-探索前.jpg` 到 `说茄子-完整链路-06-关闭后回牌桌.jpg`
  - 一抹鲜红完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/一抹鲜红-完整链路-01-探索前.jpg` 到 `一抹鲜红-完整链路-06-关闭后回牌桌.jpg`
  - 吊死鬼完整链路：`evidence/山屋惊魂-事件牌页面承接E2E/吊死鬼-完整链路-01-探索前.jpg` 到 `吊死鬼-完整链路-06-关闭后回牌桌.jpg`
- 外星几何完整链路补证：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "外星几何真实链路从探索翻牌到自动投骰结算关闭"`
  - 结果：`1 passed`
  - AI 核图：低清联系图 `temp/betrayal-alien-geometry-full-chain-contact-lowres.jpg` 已确认六张图属于同一条外星几何链，能看到探索前、选择未知房间、事件牌翻出、知识检定骰盘停稳、结算结果、关闭后回牌桌。
  - 自审：目标明确为“牌翻出来后自动投骰、直接结算并关闭回牌桌”；流程从真实探索入口和未知房间选择开始，不是直接注入 临时事件态；该链只证明投骰后直接结算家族里的属性变化代表结果，不能外推到伤害、移动或抽牌代表结果。
- 电话铃声完整链路补证：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "电话铃声伤害直接结算真实链路从探索翻牌到投骰结算关闭"`
  - 结果：`1 passed`
  - AI 核图：低清联系图 `temp/betrayal-phone-ring-direct-roll-contact-lowres.jpg` 已确认六张图属于同一条电话铃声链，能看到探索前、选择未知房间、事件牌翻出、2 颗骰子直接结算物理伤害和关闭后回牌桌。
  - 自审：目标明确为“牌翻出来后自动投骰并直接结算伤害”；流程从真实探索入口和未知房间选择开始，不是直接注入 临时事件态；该链补齐投骰后直接结算家族中的伤害代表结果。
- 嘎吱的木门完整链路补证：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "嘎吱的木门移动直接结算真实链路从探索翻牌到投骰结算关闭"`
  - 结果：`1 passed`
  - AI 核图：低清联系图 `temp/betrayal-creaking-door-direct-roll-contact-lowres.jpg` 已确认六张图属于同一条嘎吱的木门链，能看到探索前、选择未知房间、事件牌翻出、知识检定直接结算移动到上层起始点和关闭后回牌桌。
  - 自审：目标明确为“牌翻出来后自动投骰并直接结算移动”；流程从真实探索入口和未知房间选择开始，不是直接注入 临时事件态；该链补齐投骰后直接结算家族中的移动代表结果。
- 小机器人完整链路补证：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "小机器人抽物品直接结算真实链路从探索翻牌到投骰结算关闭"`
  - 结果：`1 passed`
  - AI 核图：低清联系图 `temp/betrayal-toy-monkey-direct-roll-contact-lowres.jpg` 已确认六张图属于同一条小机器人链，能看到探索前、选择未知房间、事件牌翻出、知识检定直接结算抽物品和关闭后回牌桌。
  - 自审：目标明确为“牌翻出来后自动投骰并直接结算抽物品”；流程从真实探索入口和未知房间选择开始，不是直接注入 临时事件态；该链补齐投骰后直接结算家族中的抽物品代表结果。
- 一条秘密通道完整链路补证：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "一条秘密通道真实链路从探索翻牌到检定后选房间结算关闭"`
  - 结果：`1 passed`
  - AI 核图：低清联系图 `temp/betrayal-secret-passage-full-chain-contact-lowres.jpg` 已确认六张图属于同一条一条秘密通道链，能看到探索前、选择未知房间、事件牌翻出、知识检定、选择门厅作为第二秘密通道、结算标志物和关闭后回牌桌。
  - 自审：目标明确为“牌翻出来后先知识检定，再选择第二个秘密通道房间，结算后关闭回牌桌”；流程从真实探索入口和未知房间选择开始，不是直接注入 `临时事件选择态`；该链补齐了先检定再选择后续效果家族中的房间目标选择代表结果。
- 脑状食品完整链路补证：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "脑状食品真实链路从探索翻牌到检定后选属性结算关闭"`
  - 结果：`1 passed`
  - 整文件复跑：新增肉质苔癣完整链路后的旧整文件计数已被后续《一瓶微尘》《大宅饿了》《说“茄子”！》《一抹鲜红》《吊死鬼》和直接结算剩余 8 张补证覆盖；新增 8 张后的当前证据以逐条定向通过为准。
  - AI 核图：低清联系图 `temp/betrayal-brain-food-full-chain-contact-lowres.jpg` 已确认六张图属于同一条脑状食品链，能看到探索前、选择未知房间、事件牌翻出、力量检定、选择速度奖励、结算结果和关闭后回牌桌。
  - 自审：目标明确为“牌翻出来后先力量检定，再选择奖励属性并结算关闭”；流程从真实探索入口和未知房间选择开始，不是直接注入 `临时事件选择态`；该链补齐了先检定再选择后续效果家族中的奖励属性选择代表结果。
- 肉质苔癣完整链路补证：
  - 命令：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "肉质苔癣" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`2 passed`。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "肉质苔癣真实链路从探索翻牌到选择吸入投骰再选属性结算关闭"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/肉质苔癣-完整链路-01-探索前.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/肉质苔癣-完整链路-02-选择未知房间.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/肉质苔癣-完整链路-03-事件牌翻出可选择吸入.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/肉质苔癣-完整链路-04-选择吸入后骰盘停稳并出现属性选项.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/肉质苔癣-完整链路-05-选择知识奖励后结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/肉质苔癣-完整链路-06-关闭后回牌桌.jpg`
  - 自审：目标明确为“牌先翻出来，再由玩家先选择是否吸入，吸入后才投 2 颗骰，成功后才出现属性奖励选择，选择知识后结算并关闭回牌桌”；流程从真实探索入口和未知房间选择开始，不是直接注入 `临时事件选择态`。E2E 同步断言了选择吸入前没有骰盘和属性选项、吸入后骰盘停稳且属性选项才出现、选项尺寸可读可点、事件选择面板为开放式无背景框、属性选项不是同一颜色、滚动容器滚动后目标属性仍可见、2 颗山屋物理骰分开可辨认、结算后 `临时事件选择态` 清空并保留本次骰盘依据。该链只证明可选事件投骰家族中的《肉质苔癣》，不能外推到说“茄子”！、一抹鲜红、一瓶微尘、大宅饿了。
  - 整文件复跑：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts`
  - 结果：该轮整文件复跑已通过；新增 8 张直接结算牌后不再把该旧计数作为当前全量计数。
- 一瓶微尘完整链路补证：
  - 命令：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "一瓶微尘" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`2 passed`。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "一瓶微尘真实链路从探索翻牌到选择作祟检定投骰结算关闭"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一瓶微尘-完整链路-01-探索前.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一瓶微尘-完整链路-02-选择未知房间.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一瓶微尘-完整链路-03-事件牌翻出可选择作祟检定.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一瓶微尘-完整链路-04-选择作祟检定后骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一瓶微尘-完整链路-05-神志奖励结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一瓶微尘-完整链路-06-关闭后回牌桌.jpg`
  - AI 核图：低清联系图 `temp/betrayal-dusty-vial-full-chain-contact-lowres.jpg` 已确认六张图属于同一条一瓶微尘链，能看到探索前、选择未知房间、事件牌翻出可选择作祟检定、选择后作祟骰盘停稳、神志奖励结算、关闭后回牌桌。
  - 自审：目标明确为“牌先翻出来，再由玩家先选择是否进行作祟检定，选择检定后才按当前预兆数投作祟骰，失败后结算神志 +1 并关闭回牌桌”；流程从真实探索入口和未知房间选择开始，不是直接注入 `临时事件选择态`。E2E 同步断言了选择前没有最近投骰面板、两个选项尺寸可读可点、事件选择面板为开放式无背景框、选择作祟检定后骰盘点数与规则状态一致、未触发作祟时仍处于恶兆前、`临时事件选择态` 清空、力量不变、神志 +1、关闭后回到可操作牌桌。该链只证明可选作祟事件中的《一瓶微尘》，不能外推到说“茄子”！、一抹鲜红、大宅饿了或吊死鬼。
  - 整文件复跑：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts`
  - 结果：该轮整文件复跑已通过；新增 8 张直接结算牌后不再把该旧计数作为当前全量计数。
- 大宅饿了完整链路补证：
  - 命令：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "大宅饿了" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`2 passed`。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "大宅饿了真实链路从探索翻牌到跳过作祟选择属性结算关闭"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/大宅饿了-完整链路-01-探索前.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/大宅饿了-完整链路-02-选择未知房间.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/大宅饿了-完整链路-03-事件牌翻出可选择作祟检定.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/大宅饿了-完整链路-04-选择知识奖励后准备跳过作祟.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/大宅饿了-完整链路-05-知识奖励结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/大宅饿了-完整链路-06-关闭后回牌桌.jpg`
  - AI 核图：低清联系图 `temp/betrayal-hungry-house-full-chain-contact-lowres.jpg` 已确认六张图属于同一条大宅饿了链，能看到探索前、选择未知房间、事件牌翻出可选择作祟检定、选择知识奖励后准备跳过作祟、知识奖励结算结果可见、关闭后回牌桌。
  - 自审：目标明确为“牌先翻出来，再由玩家先选择奖励属性，然后跳过作祟，结算所选属性 +1 并关闭回牌桌”；流程从真实探索入口和未知房间选择开始，不是直接注入 `临时事件选择态`。E2E 同步断言了未选择奖励属性前跳过作祟按钮不可用、选择知识后跳过按钮可用、跳过分支不出现作祟骰盘、知识 +1、神志和力量不变、`临时事件选择态` 清空、`phase=preHaunt`、`hauntTriggered=false`、关闭后回到可操作牌桌。该链只证明可选作祟家族中的《大宅饿了》，不能外推到说“茄子”！、一抹鲜红或吊死鬼。
  - 整文件复跑：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts`
  - 结果：该轮整文件复跑已通过；新增 8 张直接结算牌后不再把该旧计数作为当前全量计数。
- 说“茄子”！完整链路补证：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "说茄子真实链路从探索翻牌到作祟失败抽物品关闭"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/说茄子-完整链路-01-探索前.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/说茄子-完整链路-02-选择未知房间.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/说茄子-完整链路-03-事件牌翻出可选择作祟检定.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/说茄子-完整链路-04-选择作祟检定后骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/说茄子-完整链路-05-抽物品结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/说茄子-完整链路-06-关闭后回牌桌.jpg`
  - 自审：目标明确为“牌先翻出来，再由玩家选择进行作祟检定，作祟失败后抽取物品并关闭回牌桌”；流程从真实探索入口和未知房间选择开始，不是直接注入 `临时事件选择态`。E2E 同步断言了选择前没有最近投骰面板、可选作祟按钮可见、选择后按当前预兆数投作祟骰、骰盘数量和总点数与规则状态一致、骰盘停稳且多骰分离、未触发作祟时仍处于恶兆前、`临时事件选择态` 清空、抽到《魔法相机》、关闭后物品仍在持有区并回到可操作牌桌。该链证明说“茄子”！的可选作祟失败抽物品链，不外推到其它事件牌。
- 一抹鲜红完整链路补证：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "一抹鲜红真实链路从探索翻牌到作祟失败速度奖励关闭"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一抹鲜红-完整链路-01-探索前.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一抹鲜红-完整链路-02-选择未知房间.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一抹鲜红-完整链路-03-事件牌翻出可选择作祟检定.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一抹鲜红-完整链路-04-选择作祟检定后骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一抹鲜红-完整链路-05-速度奖励结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一抹鲜红-完整链路-06-关闭后回牌桌.jpg`
  - 自审：目标明确为“牌先翻出来，再由玩家选择进行作祟检定，作祟失败后结算速度 +1 并关闭回牌桌”；流程从真实探索入口和未知房间选择开始，不是直接注入 `临时事件选择态`。E2E 同步断言了选择前没有最近投骰面板、选择后才出现作祟骰盘、骰盘数量和总点数与规则状态一致、骰盘停稳且多骰分离、未触发作祟时仍处于恶兆前、没有错误结算物理伤害、`临时事件选择态` 清空、速度从 4 变为 5、关闭后回到可操作牌桌。该链证明一抹鲜红的可选作祟失败速度奖励链，不外推到其它事件牌。
- 吊死鬼完整链路补证：
  - 命令：`npx eslint src/games/betrayal/Board.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx e2e/betrayal/event-choice-coverage.e2e.ts`
  - 结果：通过。
  - 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/Board.foundation.test.tsx --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "吊死鬼待选事件能在真实页面选择奖励属性"`
  - 结果：`1 passed`；结束后有 `ECONNRESET/socket hang up` 噪声，但测试结果为通过。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "吊死鬼真实链路从探索翻牌到四项检定后选奖励关闭"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/吊死鬼-完整链路-01-探索前.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/吊死鬼-完整链路-02-选择未知房间.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/吊死鬼-完整链路-03-事件牌翻出四项检定全过.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/吊死鬼-完整链路-04-选择知识奖励.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/吊死鬼-完整链路-05-知识奖励结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/吊死鬼-完整链路-06-关闭后回牌桌.jpg`
  - 自审：目标明确为“牌先翻出来，自动完成四项属性检定，四项均通过后才允许选择奖励属性，选择知识后结算知识 +1 并关闭回牌桌”；流程从真实探索入口和未知房间选择开始，不是直接注入 `allPassEffect` 子效果。E2E 同步断言了牌面可见、四项检定结果均显示 `6 / 通过`、未选属性前确认按钮禁用、四个奖励属性选项可见、选择知识后确认按钮启用、结算面板显示“每项属性均通过”和“知识 +1”、`临时事件选择态` 清空、知识从 3 变为 4、关闭后回到可操作牌桌。该链证明吊死鬼的自动多属性检定后选择奖励家族，不外推到其它事件牌。
- 投骰后直接结算剩余 8 张逐张补证：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "标本剥制伤害和障碍物直接结算真实链路从探索翻牌到投骰结算关闭"`
  - 结果：`1 passed`。
  - 命令：顺序定向运行小丑房间、咬一口！、最深的壁橱、磁带播放器、在你背后！、一种怪异的感觉、葬礼 7 条完整链。
  - 结果：每条均为 `1 passed`，顺序脚本输出 `ALL_TARGETED_E2E_PASSED=7`。
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/标本剥制-完整链路-01-探索前.jpg` 到 `标本剥制-完整链路-06-关闭后.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/小丑房间-完整链路-01-探索前.jpg` 到 `小丑房间-完整链路-06-关闭后.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/咬一口-完整链路-01-探索前.jpg` 到 `咬一口-完整链路-06-关闭后.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/最深的壁橱-完整链路-01-探索前.jpg` 到 `最深的壁橱-完整链路-06-关闭后.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/磁带播放器-完整链路-01-探索前.jpg` 到 `磁带播放器-完整链路-06-关闭后.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/在你背后-完整链路-01-探索前.jpg` 到 `在你背后-完整链路-06-关闭后.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/一种怪异的感觉-完整链路-01-探索前.jpg` 到 `一种怪异的感觉-完整链路-06-关闭后.jpg`
  - 截图：`evidence/山屋惊魂-事件牌页面承接E2E/葬礼-完整链路-01-探索前.jpg` 到 `葬礼-完整链路-06-关闭后.jpg`
  - 自审：这 8 张都属于“牌翻出后自动投骰/检定并直接结算”家族，完整链必须证明没有空选择壳、结算结果落位且关闭后回牌桌。至此事件牌当前数据合同为 23/23 逐张完整链；该结论只覆盖事件牌，不覆盖预兆、物品全家族或骰盘全家族。
- 事件牌完整链整文件复跑：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts`
  - 结果：十五条阶段为 `27 passed`；新增 8 张直接结算牌后本轮以逐条定向通过和六段截图作为 23/23 证据，未把旧 `27 passed` 计数冒充新增后的整文件全量复跑。
- 六段验收口径：每条卡牌翻出链必须同时有 `翻出前`、`翻出后`、`选择或投骰前`、`选择/投骰后`、`结算后`、`关闭后` 六类证据；缺任一类只能登记为阶段承接。
- BTR-07 交易真实页面六段链：
  - 代码修正：`src/games/betrayal/Board.tsx` 在确认交易后同时清空已选持有物和已选交易目标，避免物品已转移但目标/选中态仍残留。
  - 命令：`npx eslint src\games\betrayal\Board.tsx e2e\betrayal\first-scenario-trade-interaction.e2e.ts`
  - 结果：通过。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/first-scenario-trade-interaction.e2e.ts "真实页面可选物品、选目标并确认交易"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-交易完整链路/01-交易前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-交易完整链路/02-物品兔脚本体已选中.jpg`
  - 截图：`evidence/山屋惊魂-交易完整链路/03-地图队友目标已选中.jpg`
  - 截图：`evidence/山屋惊魂-交易完整链路/04-确认交易前.jpg`
  - 截图：`evidence/山屋惊魂-交易完整链路/05-交易结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-交易完整链路/06-交易后回牌桌状态清空.jpg`
  - AI 核图：低清联系图 `evidence/山屋惊魂-交易完整链路/交易完整链路-六段联系图-低清核验.jpg` 已确认六张图属于同一条交易链，能看到兔脚本体被选中、地图队友 token 被选中、确认交易、兔脚转移后主牌桌回到清空状态。
  - 自审：目标明确为“交易必须按对象 -> 目标 -> 确认 -> 结算 -> 收口走完整链”；流程从真实持有物牌面和真实地图队友 token 起跑，不是侧边文字代理或直接 dispatch；该链只证明 BTR-07，不证明物品使用链或骰盘全家族已收口。
- 狗远距交易真实页面六段链：
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/first-scenario-trade-interaction.e2e.ts "狗远距交易真实链路可选择多张持有物、4格内目标并收口"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-狗远距交易完整链路/01-狗交易前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-狗远距交易完整链路/02-用狗选择要送的持有物.jpg`
  - 截图：`evidence/山屋惊魂-狗远距交易完整链路/03-切到目标楼层看到4格内队友.jpg`
  - 截图：`evidence/山屋惊魂-狗远距交易完整链路/04-选择远距目标并确认前.jpg`
  - 截图：`evidence/山屋惊魂-狗远距交易完整链路/05-狗交易结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-狗远距交易完整链路/06-狗交易后回牌桌状态清空.jpg`
  - AI 核图：低清联系图 `temp/betrayal-dog-trade-full-chain-contact-lowres.jpg` 已确认六张图属于同一条狗远距交易链，能看到交易前牌桌、狗交易物选择、切到目标楼层看到 4 格内队友、点击远距队友 token、急救包和地图转移给队友、狗标记已用、交易状态清空回牌桌。
  - 自审：目标明确为“狗作为交易媒介 -> 选择多张可交易持有物 -> 选择 4 格内队友 -> 确认 -> 结算 -> 收口”。流程从真实狗交易选择器和地图队友 token 起跑，不是同房间交易、不是侧栏文字目标、不是直接 dispatch；E2E 同步断言狗本身不能被当作要送出的持有物、狗交易不退回同房间队友按钮、4 格目标有贴合 token 的五边形高亮、确认后当前玩家只剩狗、队友获得急救包和地图、`usedCardIdsThisTurn` 记录狗、狗交易选择器和远距目标高亮清空。该链只证明预兆《狗》的远距交易本对象，不外推面具、书本、盔甲、指环或匕首。
- 面具移动真实页面六段链：
  - 命令：`npx eslint src/games/betrayal/Board.tsx src/games/betrayal/testing/firstScenarioTestUtils.ts src/games/betrayal/__tests__/Board.foundation.test.tsx e2e/betrayal/betrayalTestHelpers.ts e2e/betrayal/first-scenario-use-possession.e2e.ts`
  - 结果：通过。
  - 命令：`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "面具|moveOthers|持有物" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`5 passed`。
  - 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/Board.foundation.test.tsx --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "面具会在真实页面给同板块队友和怪物分别选择相邻板块"`
  - 结果：`1 passed`；命令尾部出现 `socket hang up / ECONNRESET` 噪声，但测试结果已通过。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/first-scenario-use-possession.e2e.ts "面具真实链路选择同房间队友、相邻房间并完成移动收口"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-面具移动完整链路/01-面具使用前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-面具移动完整链路/02-面具本体已选中.jpg`
  - 截图：`evidence/山屋惊魂-面具移动完整链路/03-同房间队友目标已激活.jpg`
  - 截图：`evidence/山屋惊魂-面具移动完整链路/04-选择相邻房间并确认前.jpg`
  - 截图：`evidence/山屋惊魂-面具移动完整链路/05-面具移动结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-面具移动完整链路/06-面具使用后回牌桌状态清空.jpg`
  - AI 核图：低清联系图 `temp/betrayal-mask-move-full-chain-contact-lowres.jpg` 已确认六张图属于同一条面具移动链，能看到面具使用前、选中面具、同房间队友目标激活、相邻房间高亮、确认后队友离开原房间、最后选择器和高亮清空回牌桌。
  - 自审：目标明确为“点面具本体 -> 选择同板块其他角色 -> 选择相邻已发现房间 -> 确认移动 -> 结算 -> 收口”。流程从真实持有物《面具》和地图队友 token 起跑，不是组件层直接 dispatch，不是只看目标按钮存在；E2E 同步断言同房间队友成为可选目标、相邻房间成为目标房间、确认后队友移动到相邻房间、已选面具、面具目标选择器和房间/目标高亮清空。该链只证明预兆《面具》的移动同板块角色能力，不外推书本、盔甲、指环或匕首。
- 骨制钥匙穿墙移动真实页面六段链：
  - 命令：`npx eslint src/games/betrayal/testing/firstScenarioTestUtils.ts e2e/betrayal/betrayalTestHelpers.ts e2e/betrayal/first-scenario-use-possession.e2e.ts`
  - 结果：通过。
  - 命令：`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "骨制钥匙" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`2 passed`。
  - 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/Board.foundation.test.tsx --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "骨制钥匙会在真实页面移动模式显示穿墙目标并传入领域命令"`
  - 结果：`1 passed`；命令尾部出现 `socket hang up / ECONNRESET` 噪声，但测试结果已通过。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/first-scenario-use-possession.e2e.ts "骨制钥匙真实链路打开移动模式、选择穿墙目标并完成移动收口"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-骨制钥匙穿墙移动完整链路/01-骨制钥匙移动前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-骨制钥匙穿墙移动完整链路/02-骨制钥匙本体规则可见.jpg`
  - 截图：`evidence/山屋惊魂-骨制钥匙穿墙移动完整链路/03-打开移动模式看到穿墙目标.jpg`
  - 截图：`evidence/山屋惊魂-骨制钥匙穿墙移动完整链路/04-点击穿墙目标前.jpg`
  - 截图：`evidence/山屋惊魂-骨制钥匙穿墙移动完整链路/05-骨制钥匙移动结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-骨制钥匙穿墙移动完整链路/06-骨制钥匙移动后回牌桌状态清空.jpg`
  - AI 核图：低清联系图 `temp/betrayal-skeleton-key-move-full-chain-contact-lowres.jpg` 已确认六张图属于同一条骨制钥匙穿墙移动链，能看到移动前、物品本体、打开移动模式、点击穿墙目标前、移动到目标房间后的反馈、最后退出移动态并回到可操作牌桌。
  - 自审：目标明确为“骨制钥匙不是主动使用按钮，而是移动模式里的穿墙移动来源”。流程从真实骨制钥匙持有物、真实移动按钮和真实房间牌目标起跑，不是直接 dispatch；E2E 同步断言目标房间同层相邻但未连门、普通移动无效、进入移动模式后目标房间可点、点击后领域命令携带 `useSkeletonKey` 语义并写出“使用骨制钥匙穿过墙壁”反馈、当前位置和活动房间移动到图书馆、剩余移动点减少、移动目标高亮清空回牌桌。该链只证明物品《骨制钥匙》的穿墙移动能力，不外推头戴耳机、手电筒/灯笼或其它物品。
- 盔甲物理减伤真实页面六段链：
  - 命令：`npx eslint e2e\betrayal\event-choice-coverage.e2e.ts`
  - 结果：通过。
  - 命令：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "盔甲" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`4 passed`。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "盔甲真实链路从电话铃声翻牌到物理伤害减伤结算关闭"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-盔甲物理减伤完整链路/01-盔甲减伤前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-盔甲物理减伤完整链路/02-选择未知房间前.jpg`
  - 截图：`evidence/山屋惊魂-盔甲物理减伤完整链路/03-电话铃声翻出并显示物理伤害分支.jpg`
  - 截图：`evidence/山屋惊魂-盔甲物理减伤完整链路/04-物理伤害骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-盔甲物理减伤完整链路/05-盔甲减伤结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-盔甲物理减伤完整链路/06-关闭后回牌桌状态清空.jpg`
  - AI 核图：低清联系图 `temp/betrayal-armor-physical-reduction-full-chain-contact-lowres.jpg` 已确认六张图属于同一条盔甲物理减伤链，能看到盔甲持有区、选择未知房间、电话铃声翻出、物理伤害骰盘停稳、减伤结算和关闭后回牌桌。
  - 自审：目标明确为“盔甲是被动物理减伤，不是主动使用牌”。流程从真实持有区《盔甲》、真实探索按钮和真实未知房间目标起跑，不是直接注入伤害结果；E2E 同步断言盔甲规则摘要可见、事件牌《电话铃声》真实翻出并命中“受到两颗骰子的物理伤害”分支、伤害骰实际为 `[2, 2]`、身体属性总和从 8 只降到 5（减 3 而不是减 4）、发现面板关闭后 `discovery/event choice` 面板清空且牌桌动作栏可见。该链只证明预兆《盔甲》的物理减伤能力，不外推头戴耳机精神减伤、头骨死亡保护、攻击武器或其它预兆能力。
- 头戴耳机精神减伤真实页面六段链：
  - 命令：`npx eslint e2e\betrayal\event-choice-coverage.e2e.ts`
  - 结果：通过。
  - 命令：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "头戴耳机" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`3 passed`。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "头戴耳机真实链路从电话铃声翻牌到精神伤害减伤结算关闭"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-头戴耳机精神减伤完整链路/01-头戴耳机减伤前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-头戴耳机精神减伤完整链路/02-选择未知房间前.jpg`
  - 截图：`evidence/山屋惊魂-头戴耳机精神减伤完整链路/03-电话铃声翻出并显示精神伤害分支.jpg`
  - 截图：`evidence/山屋惊魂-头戴耳机精神减伤完整链路/04-精神伤害骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-头戴耳机精神减伤完整链路/05-头戴耳机减伤结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-头戴耳机精神减伤完整链路/06-关闭后回牌桌状态清空.jpg`
  - AI 核图：低清联系图 `temp/betrayal-radio-mental-reduction-full-chain-contact-lowres.jpg` 已确认六张图属于同一条头戴耳机精神减伤链，能看到头戴耳机持有区、选择未知房间、电话铃声翻出、精神伤害骰盘停稳、减伤结算和关闭后回牌桌。
  - 自审：目标明确为“头戴耳机是被动精神减伤，不是主动使用牌”。流程从真实持有区《头戴耳机》、真实探索按钮和真实未知房间目标起跑，不是直接注入精神伤害结果；E2E 同步断言头戴耳机规则摘要可见、事件牌《电话铃声》真实翻出并命中“受到一颗骰子的精神伤害”分支、伤害骰实际为 `[2]`、精神属性总和从 8 只降到 7（减 1 而不是减 2），知识为 3、神志为 4，发现面板关闭后 `discovery/event choice` 面板清空且牌桌动作栏可见。该链只证明物品《头戴耳机》的精神减伤能力，不外推盔甲物理减伤、头骨死亡保护、手电筒/灯笼加骰或其它物品能力。
- 手电筒/灯笼事件检定加骰真实页面六段链：
  - 命令：`npx eslint e2e\betrayal\event-choice-coverage.e2e.ts src\games\betrayal\scenarioConfig.ts`
  - 结果：通过。
  - 命令：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "手电筒" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`1 passed`。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "手电筒真实链路从外星几何翻牌到事件检定额外加骰结算关闭"`
  - 结果：`1 passed`。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "灯笼真实链路从外星几何翻牌到事件检定额外加骰结算关闭"`
  - 结果：`1 passed`。
  - 截图：`evidence/山屋惊魂-手电筒事件检定加骰完整链路/01-手电筒加骰前牌桌可操作.jpg` 到 `06-关闭后回牌桌状态清空.jpg`。
  - 截图：`evidence/山屋惊魂-灯笼事件检定加骰完整链路/01-灯笼加骰前牌桌可操作.jpg` 到 `06-关闭后回牌桌状态清空.jpg`。
  - AI 核图：低清联系图 `temp/betrayal-flashlight-lantern-event-check-full-chain-contact-lowres.jpg` 已确认两行分别属于手电筒和灯笼同源加骰链，能看到各自持有区、选择未知房间、外星几何翻出、5 骰知识检定骰盘停稳、结算和关闭后回牌桌。
  - 自审：目标明确为“手电筒和灯笼是事件属性检定被动加骰，不是主动使用牌”。流程从真实持有区、真实探索按钮和真实事件牌《外星几何》起跑；E2E 对手电筒和灯笼分别断言持有区规则摘要可见、外星几何知识检定显示为 10、物理骰盘为 5 颗且 `data-dice-rule-subtotal=10`、知识从 3 升到 4，关闭后发现面板和事件选择面板清空且牌桌动作栏可见。同步修正 `lantern` 起始持有物中文名为“灯笼”，避免 UI 把两种对象都显示成“手电筒”。该链证明 `flashlight` 与 `lantern` 两个同源对象的事件检定加骰能力，不外推魔法相机替代检定、书本替代检定或其它物品能力。
- 魔法相机知识检定替代真实页面六段链：
  - 静态检查：`npx eslint e2e\betrayal\event-choice-coverage.e2e.ts` 通过，0 errors。
  - Vitest：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "魔法相机" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`2 passed`。
  - E2E：`node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/event-choice-coverage.e2e.ts "魔法相机真实链路"` 通过，`1 passed`。
  - 截图：`evidence/山屋惊魂-魔法相机知识检定替代完整链路/01-魔法相机替代前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-魔法相机知识检定替代完整链路/02-选择未知房间前.jpg`
  - 截图：`evidence/山屋惊魂-魔法相机知识检定替代完整链路/03-外星几何翻出并显示5骰知识检定.jpg`
  - 截图：`evidence/山屋惊魂-魔法相机知识检定替代完整链路/04-5骰相机替代检定骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-魔法相机知识检定替代完整链路/05-魔法相机替代检定结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-魔法相机知识检定替代完整链路/06-关闭后回牌桌状态清空.jpg`
  - AI 核图：低清联系图 `temp/betrayal-magic-camera-knowledge-replacement-full-chain-contact-lowres.jpg` 已确认六张图属于同一条魔法相机知识检定替代链，能看到魔法相机持有区、选择未知房间、外星几何翻出、5 骰知识检定、知识 +1 结算和关闭后回牌桌。
  - 自审：目标明确为“魔法相机是被动替代知识检定，不是主动使用牌，也不是书本的一次性状态”。流程从真实持有区《魔法相机》、真实探索按钮和真实事件牌《外星几何》起跑，不是直接注入检定结果；E2E 同步断言魔法相机规则摘要可见、主动使用按钮不可用、3 点知识因 5 点神志替代显示为 5 颗骰且 `data-dice-rule-subtotal=10`、知识从 3 升到 4、神志保持 5、魔法相机仍在持有区且未进入 `usedCardIdsThisTurn`，关闭后发现面板和事件选择面板清空且牌桌动作栏可见。该链只证明物品《魔法相机》的知识检定替代能力，不外推“说茄子！”作祟归属、书本一次性替代或手电筒/灯笼加骰能力。
- 魔法相机作祟归属真实页面六段链：
  - 静态检查：`npx eslint e2e\betrayal\event-choice-coverage.e2e.ts` 通过，0 errors。
  - E2E：`npm run test:e2e:file -- e2e/betrayal/event-choice-coverage.e2e.ts "魔法相机持有者成为叛徒"` 通过，`1 passed`。
  - 截图：`evidence/山屋惊魂-魔法相机作祟归属完整链路/魔法相机作祟归属-01-探索前.jpg`
  - 截图：`evidence/山屋惊魂-魔法相机作祟归属完整链路/魔法相机作祟归属-02-选择未知房间.jpg`
  - 截图：`evidence/山屋惊魂-魔法相机作祟归属完整链路/魔法相机作祟归属-03-事件牌翻出可选择作祟检定.jpg`
  - 截图：`evidence/山屋惊魂-魔法相机作祟归属完整链路/魔法相机作祟归属-04-选择作祟检定后触发作祟.jpg`
  - 截图：`evidence/山屋惊魂-魔法相机作祟归属完整链路/魔法相机作祟归属-05-魔法相机持有者成为叛徒结果可见.jpg`
  - 截图：`evidence/山屋惊魂-魔法相机作祟归属完整链路/魔法相机作祟归属-06-关闭后进入作祟牌桌.jpg`
  - AI 核图：低清联系图 `temp/betrayal-magic-camera-haunt-owner-contact-lowres.jpg` 已确认六张图属于同一条《说“茄子”！》触发剧本 33 链，能看到探索前、选择未知房间、事件牌翻出、选择作祟后触发剧本 33、结果可见、关闭后进入作祟牌桌。
  - 自审：目标明确为“《说“茄子”！》触发作祟时，叛徒必须是魔法相机持有者，不是翻牌玩家”。流程从真实探索入口和真实事件牌起跑；E2E 断言 `hauntCardNumber=33`、翻牌者为玩家 0、叛徒为持有《魔法相机》的玩家 1，页面日志显示“作祟触发：剧本33”，关闭后进入作祟阶段且探索入口消失。该链证明作祟归属，不把成功触发后的结果页误写成骰盘保留链。
- 书本非战斗检定替代真实页面六段链：
  - 规则修复：`src/games/betrayal/game.ts` 让事件属性检定读取同一个非战斗检定值计算入口，保留手电筒/灯笼事件额外骰叠加，并在事件属性检定结算落地后消费《书本》的一次性替代状态；攻击骰、作祟骰和固定骰不消费该状态。
  - 静态检查：`npx eslint e2e\betrayal\event-choice-coverage.e2e.ts src\games\betrayal\game.ts src\games\betrayal\__tests__\firstScenarioRuntime.test.ts` 通过，0 errors（保留既有未用函数 warning）。
  - Vitest：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "书本" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`4 passed`。
  - E2E：`npm run test:e2e:ci:file -- e2e/betrayal/event-choice-coverage.e2e.ts "书本真实链路从本体使用到小丑房间非战斗检定替代结算关闭"` 通过，`1 passed`。
  - 截图：`evidence/山屋惊魂-书本非战斗检定替代完整链路/01-书本使用前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-书本非战斗检定替代完整链路/02-书本本体已选中准备使用.jpg`
  - 截图：`evidence/山屋惊魂-书本非战斗检定替代完整链路/03-书本已使用并选择未知房间前.jpg`
  - 截图：`evidence/山屋惊魂-书本非战斗检定替代完整链路/04-小丑房间5骰神志检定停稳.jpg`
  - 截图：`evidence/山屋惊魂-书本非战斗检定替代完整链路/05-书本替代检定结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-书本非战斗检定替代完整链路/06-关闭后回牌桌状态清空.jpg`
  - AI 核图：低清联系图 `temp/betrayal-omen-book-non-combat-replacement-full-chain-contact-lowres.jpg` 已确认六张图属于同一条书本非战斗检定替代链，能看到书本持有区、本体选中、花 1 神志后选择未知房间、小丑房间翻出、5 骰神志检定停稳、结算无事发生和关闭后回牌桌。该联系图只用于 AI 核图，不替代原始截图。
  - 自审：目标明确为“书本不是事件牌本身，而是预兆本体先使用，再影响下一次非战斗检定”。流程从真实持有物《书本》本体和真实探索入口起跑，不是直接注入小丑房间结果；E2E 同步断言书本规则摘要可见、使用后神志从 2 降到 1、`nextNonCombatTraitReplacement` 建立，探索翻出事件牌《小丑房间》后用知识 5 投出 5 颗骰、总点数 10、无事发生，结算后替代状态清空，关闭后发现面板和事件选择面板清空且牌桌动作栏可见。该链只证明预兆《书本》的非战斗检定替代能力，不外推头骨、雕像、指环、匕首或魔法相机。
- 雕像探索声明真实页面六段链：
  - 静态检查：`npx eslint e2e\betrayal\non-p0-representative.e2e.ts` 通过。
  - Vitest：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "雕像" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`4 passed`。
  - E2E：`npm run test:e2e:ci:file -- e2e/betrayal/non-p0-representative.e2e.ts "雕像探索声明真实链路从声明到跳过事件结算关闭"` 通过，`1 passed`。
  - 截图：`evidence/山屋惊魂-雕像探索声明完整链路/01-雕像声明前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-雕像探索声明完整链路/02-雕像探索声明已选中.jpg`
  - 截图：`evidence/山屋惊魂-雕像探索声明完整链路/03-选择未知房间前.jpg`
  - 截图：`evidence/山屋惊魂-雕像探索声明完整链路/04-雕像跳过事件结果可见.jpg`
  - 截图：`evidence/山屋惊魂-雕像探索声明完整链路/05-雕像跳过事件结算未扣力量.jpg`
  - 截图：`evidence/山屋惊魂-雕像探索声明完整链路/06-关闭后回牌桌状态清空.jpg`
  - AI 核图：低清联系图 `temp/betrayal-idol-explore-declaration-full-chain-contact-lowres.jpg` 已确认六张图属于同一条雕像探索声明链，能看到声明前、声明选中、选择未知房间、《阴影扑面》被跳过、力量未扣且事件未弃置、关闭后回牌桌。该联系图只用于 AI 核图，不替代原始截图。
  - 自审：目标明确为“雕像探索声明是玩家先声明本次探索跳过事件，不是事件牌自身选项”。流程从真实牌桌上的雕像声明入口和真实未知房间目标起跑，不是直接注入跳过结果；E2E 同步断言声明按钮从未选中变为选中、真实探索翻出事件牌《阴影扑面》、详情显示“没有抽取或结算事件卡”、反馈显示“使用雕像跳过了事件：阴影扑面”、力量保持 4、事件弃牌数保持 0、雕像仍在持有区，关闭后发现面板和事件选择面板清空且牌桌动作栏可见。该链只证明预兆《雕像》的探索声明跳过事件能力，不外推圣符、头骨、指环或匕首。
- 头骨死亡保护真实页面双分支六段链：
  - 静态检查：`npx eslint e2e\betrayal\high-risk-possession-representative.e2e.ts`
  - 结果：通过。
  - 命令：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "头骨" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`5 passed`。
  - 命令：`npm run test:e2e:ci:file -- e2e/betrayal/high-risk-possession-representative.e2e.ts "头骨死亡保护真实链路"`
  - 结果：`2 passed`。
  - 截图：`evidence/山屋惊魂-头骨死亡保护完整链路/01-头骨阻止死亡-攻击前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-头骨死亡保护完整链路/02-头骨阻止死亡-叛徒目标高亮.jpg`
  - 截图：`evidence/山屋惊魂-头骨死亡保护完整链路/03-头骨阻止死亡-死亡保护3骰停稳.jpg`
  - 截图：`evidence/山屋惊魂-头骨死亡保护完整链路/04-头骨阻止死亡-结果可见.jpg`
  - 截图：`evidence/山屋惊魂-头骨死亡保护完整链路/05-头骨阻止死亡-属性濒死未死亡.jpg`
  - 截图：`evidence/山屋惊魂-头骨死亡保护完整链路/06-头骨阻止死亡-回牌桌继续操作.jpg`
  - 截图：`evidence/山屋惊魂-头骨死亡保护完整链路/07-头骨未阻止死亡-攻击前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-头骨死亡保护完整链路/08-头骨未阻止死亡-叛徒目标高亮.jpg`
  - 截图：`evidence/山屋惊魂-头骨死亡保护完整链路/09-头骨未阻止死亡-死亡保护3骰停稳.jpg`
  - 截图：`evidence/山屋惊魂-头骨死亡保护完整链路/10-头骨未阻止死亡-正常死亡结果可见.jpg`
  - 截图：`evidence/山屋惊魂-头骨死亡保护完整链路/11-头骨未阻止死亡-死亡状态落位.jpg`
  - 截图：`evidence/山屋惊魂-头骨死亡保护完整链路/12-头骨未阻止死亡-牌桌仍可查看.jpg`
  - AI 核图：低清联系图 `temp/betrayal-skull-death-prevention-full-chain-contact-lowres.jpg` 已确认两行分别属于头骨死亡保护阻止死亡和未阻止死亡链，能看到真实攻击前牌桌、叛徒 token 目标高亮、死亡保护 3 骰停稳、结果反馈、属性/死亡状态落位和回牌桌或继续查看。
  - 自审：目标明确为“头骨是死亡保护被动，不是主动使用牌，也不是事件伤害减免”。流程从真实牌桌上的叛徒 token 攻击入口起跑，不是直接注入死亡结果；E2E 同步断言当前英雄持有《头骨》、叛徒目标 `data-direct-target=true` 且贴合高亮、死亡保护面板显示 3 颗山屋骰和“头骨死亡保护”、阻止死亡分支中英雄不进入死亡列表且四属性保持 1、未阻止死亡分支中英雄进入死亡列表，最终回到牌桌或可继续查看。该链只证明预兆《头骨》的死亡保护双分支，不外推指环神志攻击、匕首攻击多骰、无武器攻击或其它骰盘分支。
- 指环神志攻击真实页面六段链：
  - 静态检查：`npx eslint src\games\betrayal\Board.tsx e2e\betrayal\non-p0-representative.e2e.ts` 通过，0 errors。
  - Vitest：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "指环" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`3 passed`。
  - Board 定向：`npx vitest run src\games\betrayal\__tests__\Board.foundation.test.tsx -t "指环" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`1 passed`；尾部 `socket hang up` 只作为命令退出后既有噪声记录，退出码为 0。
  - E2E 单条：`node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/non-p0-representative.e2e.ts "指环神志攻击真实链路"` 通过，`1 passed`。
  - E2E 整份：`node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/non-p0-representative.e2e.ts` 通过，`4 passed`，覆盖普通投骰事件、雕像探索声明、砍刀攻击和指环神志攻击。
  - 截图：`evidence/山屋惊魂-指环神志攻击完整链路/01-指环攻击前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-指环神志攻击完整链路/02-指环武器已选中.jpg`
  - 截图：`evidence/山屋惊魂-指环神志攻击完整链路/03-叛徒目标高亮.jpg`
  - 截图：`evidence/山屋惊魂-指环神志攻击完整链路/04-指环神志攻击骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-指环神志攻击完整链路/05-精神伤害结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-指环神志攻击完整链路/06-指环攻击后回牌桌继续可操作.jpg`
  - AI 核图：低清联系图 `temp/betrayal-ring-sanity-attack-full-chain-contact-lowres.jpg` 已确认六张图属于同一条真实链，能看到指环选中、叛徒 token 高亮、4 骰神志攻击、`mental damage` 反馈、指环已用并回牌桌。该联系图只用于 AI 核图，不替代原始截图。
  - 自审：目标明确为“指环是攻击武器选择，不是普通徒手攻击，也不是头骨死亡保护”。流程从真实牌桌的指环持有物和真实叛徒 token 起跑，不是直接注入攻击结果；E2E 同步断言 `weaponCardId=ring`、`weaponAttackTrait=sanity`、伤害类型为精神伤害、叛徒精神属性下降且物理属性不变、攻击者属性不变、`usedCardIdsThisTurn` 记录指环，关闭后回到可操作牌桌。该链只证明预兆《指环》的神志攻击能力，不外推匕首多骰/花费速度、无武器攻击或其它攻击骰盘分支。
- 匕首攻击真实页面六段链：
  - 静态检查：`npx eslint src\games\betrayal\Board.tsx e2e\betrayal\non-p0-representative.e2e.ts` 通过，0 errors。
  - Vitest：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "匕首" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`2 passed`。
  - Board 定向：`npx vitest run src\games\betrayal\__tests__\Board.foundation.test.tsx -t "匕首" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过，`1 passed`；尾部 `socket hang up` 只作为命令退出后既有噪声记录，退出码为 0。
  - E2E 单条：`node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/non-p0-representative.e2e.ts "匕首攻击真实链路"` 通过，`1 passed`。
  - 截图：`evidence/山屋惊魂-匕首攻击完整链路/01-匕首攻击前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-匕首攻击完整链路/02-匕首武器已选中.jpg`
  - 截图：`evidence/山屋惊魂-匕首攻击完整链路/03-叛徒目标高亮.jpg`
  - 截图：`evidence/山屋惊魂-匕首攻击完整链路/04-匕首6骰攻击骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-匕首攻击完整链路/05-物理伤害与速度花费结果可见.jpg`
  - 截图：`evidence/山屋惊魂-匕首攻击完整链路/06-匕首攻击后回牌桌继续可操作.jpg`
  - AI 核图：低清联系图 `temp/betrayal-dagger-attack-full-chain-contact-lowres.jpg` 已确认六张图属于同一条真实链，能看到匕首选中、叛徒 token 高亮、6 颗骰子骰盘、物理伤害反馈、速度花费和回牌桌。该联系图只用于 AI 核图，不替代原始截图。
  - 自审：目标明确为“匕首是攻击武器选择，规则是力量攻击 +2 骰并花费 1 点速度，不是普通徒手攻击，也不是指环神志攻击”。流程从真实牌桌的匕首持有物和真实叛徒 token 起跑，不是直接注入攻击结果；E2E 同步断言 `weaponCardId=dagger`、`weaponAttackTrait=might`、`weaponExtraDice=2`、`weaponSpeedCost=1`、`recentRoll.kind=attackRoll`、骰子数量为 6、伤害类型为物理伤害、攻击者速度减少 1、叛徒物理属性下降且精神属性不变、`usedCardIdsThisTurn` 记录匕首，关闭后回到可操作牌桌。该链只证明预兆《匕首》的攻击加骰和速度花费能力，不外推指环神志攻击、无武器攻击或其它攻击骰盘分支。
- 无武器攻击真实页面六段链：
  - 静态检查：`npx eslint e2e\betrayal\non-p0-representative.e2e.ts` 通过，0 errors。
  - Vitest：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts -t "无武器|徒手|攻击" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 通过。
  - E2E 单条：`node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/non-p0-representative.e2e.ts "无武器攻击真实链路"` 通过，`1 passed`。
  - 截图：`evidence/山屋惊魂-无武器攻击完整链路/01-无武器攻击前牌桌可操作.jpg`
  - 截图：`evidence/山屋惊魂-无武器攻击完整链路/02-无武器直接攻击提示可见.jpg`
  - 截图：`evidence/山屋惊魂-无武器攻击完整链路/03-叛徒目标高亮.jpg`
  - 截图：`evidence/山屋惊魂-无武器攻击完整链路/04-无武器4骰攻击骰盘停稳.jpg`
  - 截图：`evidence/山屋惊魂-无武器攻击完整链路/05-物理伤害结算结果可见.jpg`
  - 截图：`evidence/山屋惊魂-无武器攻击完整链路/06-无武器攻击后回牌桌继续可操作.jpg`
  - AI 核图：低清联系图 `temp/betrayal-unarmed-attack-full-chain-contact-lowres.jpg` 已确认六张图属于同一条真实链，能看到无持有物/默认攻击提示、叛徒 token 目标高亮、4 骰力量攻击、物理伤害反馈和关闭后回牌桌。该联系图只用于 AI 核图，不替代原始截图。
  - 自审：目标明确为“没有武器时仍能走完整默认攻击，而不是缺一个徒手按钮”。流程从真实牌桌的无持有物/默认攻击提示和真实叛徒 token 起跑，不是直接注入攻击结果；E2E 同步断言页面不存在 `betrayal-attack-weapon-selector` 和徒手按钮，`weaponCardId`、`weaponAttackTrait`、`weaponExtraDice`、`weaponSpeedCost` 均为空，`recentRoll.kind=attackRoll`、骰子数量为 4、伤害类型为物理伤害、`usedCardIdsThisTurn` 只包含 `haunt-attack` 且不包含 `dagger`/`ring`，关闭后回到可操作牌桌。该链只证明无武器默认攻击能力，不外推指环神志攻击、匕首加骰/速度花费或其它攻击骰盘分支。
- 本轮 C5 交互链路登记：
  - 魔法相机作祟归属已补真实六段链；砍刀攻击链已登记到攻击骰盘家族；预兆翻出作祟判定已补 9 张底层逐项确认和《书本》非圣符真实抽样链；骰盘触发家族已按事件、可选作祟、预兆作祟、房间/结束回合、攻击、驱魔、死亡保护、兔脚重掷完成登记。

### L4 治理证据

- 当前边界：见第 8 节。
- 通用端到端规范已补强：`.spec/knowledge/standards/e2e-verification.md` 现在要求流程截图证据链按六段登记 `玩家实际动作 / 自动断言 / 截图文件 / 用户目标对应`，并要求滚动、选项尺寸、背景框、属性颜色、骰子重叠、效果触发等用户点名目标必须在同一条主链中被证明；同时新增“端到端结果必须回扣本轮问题”，要求测试名、断言、截图和 evidence 命中用户点名的现实结果。无弹层流程也必须证明临时选择/目标锁定清空和主牌桌继续可操作；缺列或缺段必须降级为阶段承接链路。`docs/testing-best-practices.md` 也已同步把“完整流程 E2E”收紧为六段链，避免旧口径继续把“入口 -> 中间步骤 -> 结算”误写成完整端到端。
- 共享根因：待定位。
- 旧结论失效：事件牌阶段承接证据不得再升级为完整可玩性证据；已在专项工作流文档降级。

## 7. 禁止假阳性检查

- 是否误用中间态 / 直接注入状态充当完整玩法：已补对象均回到真实入口或明确标注为 L2 底层逐项确认；预兆作祟的 UI 抽样另有《书本》真实链。
- 是否只证明按钮存在：新增收口链均继续到现实结果、状态清理或作祟阶段。
- 是否只证明日志/文案出现：BTR-01 已补规则拒绝和真实页面负向链；BTR-03 已补真实页面点击链，倒塌房间已补结束回合速度检定坠落链，神秘电梯已补房间效果按钮、2 骰移动骰盘、移动落位和无弹层收口链，洗衣滑槽已补真实探索翻出、结束回合直接滑落和无骰盘回牌桌链；BTR-02 已补底层、Board 回归和真实页面六段链；圣符探索声明已补真实声明/取消/重新声明/探索替换/事件结算/关闭回牌桌链；BTR-04 已补驱魔失败伤害六段链和驱魔成功终局六段链；BTR-06 已补急救包真实物品本体、地图目标、治疗结算和收口清理链；奇怪的药品已补真实物品本体、无需目标、治疗结算和收口清理链；BTR-07 已补真实物品本体、地图目标、确认、结算和收口清理链；狗远距交易已补多张持有物、4 格内队友 token、确认、结算和收口清理链；面具移动已补真实面具本体、同板块队友目标、相邻房间目标、移动结算和收口清理链；盔甲已补真实持有区规则、电话铃声翻出、物理伤害骰盘、减伤后属性变化和收口清理链；头戴耳机已补真实持有区规则、电话铃声翻出、精神伤害骰盘、减伤后属性变化和收口清理链；手电筒/灯笼已补真实持有区规则、外星几何翻出、5 骰知识检定骰盘、加骰后属性变化和收口清理链；魔法相机已补真实持有区规则、外星几何翻出、3 点知识用 5 点神志替代为 5 骰知识检定、知识 +1 结算和关闭回牌桌链；书本已补真实持有物本体、花 1 神志建立状态、小丑房间翻出、5 骰神志检定、替代状态消费和关闭回牌桌链；雕像已补真实声明入口、未知房间目标、阴影扑面翻出、跳过事件结果、力量未扣和事件未弃置、关闭回牌桌链；头骨已补真实叛徒 token 攻击入口、死亡保护 3 骰、阻止死亡/未阻止死亡结果、属性或死亡状态落位和回牌桌链；指环已补真实持有物武器选择、叛徒 token 目标、神志攻击骰盘、精神伤害结算和回牌桌链；匕首已补真实持有物武器选择、叛徒 token 目标、6 骰力量攻击、物理伤害与速度花费结算和回牌桌链；无武器已补无持有物/默认攻击提示、叛徒 token 目标、4 骰力量攻击、物理伤害结算和回牌桌链；骨制钥匙已补真实物品本体、移动模式、同层相邻未连门房间目标、穿墙移动结算和收口清理链；地图/笔记本/日记/手稿已补各自真实物品本体、房间牌目标、放置结算和回牌桌链；事件牌当前数据合同 23/23 已逐张完整链通过。
- 本轮交互缺口：当前 C5 无剩余交互链路缺口；发布、提交、部署和官方扩展牌不在本轮边界。
- 是否只证明骰子 DOM/canvas 存在但没有物理可读、不重叠和开放式承接：BTR-05 代表链已用真实 Three.js / dice-box canvas、专用 0/1/2 骰面、透明开放式骰区和多骰几何门禁验证；兔脚重掷链已补真实物品本体、骰子圆形命中区、重掷后骰面更新和状态消耗断言；剩余对象不得外推。

## 8. 共享根因与残余范围

- 共享根因项：已发现并修复 BTR-05 的两个骰盘根因：一是山屋多个物理骰盘实例共用同一 Three.js 调试键，且旧实例销毁时没有清理调试 registry；二是 4 颗骰子自然落定后仍可能中心塌缩，冻结采样前没有强制安全分散。普通投骰事件、可选作祟、预兆作祟、神秘电梯移动、倒塌房间速度检定、砍刀/指环/匕首/无武器攻击、驱魔、兔脚重掷和头骨死亡保护双分支链均已登记；洗衣滑槽登记为无骰盘直接移动。
- 对象级局部问题：驱魔失败死亡链和驱魔成功终局链均已补真实页面六段链；急救包、奇怪的药品、地图/笔记本/日记/手稿共享放置、兔脚重掷、头戴耳机精神减伤、手电筒/灯笼事件检定加骰、魔法相机知识检定替代、魔法相机作祟归属、书本非战斗检定替代、雕像探索声明、头骨死亡保护双分支、指环神志攻击、匕首攻击、无武器攻击和骨制钥匙穿墙移动等链路已补真实页面六段链；同房间交易、狗远距交易、面具移动和盔甲物理减伤均已补真实页面六段链；倒塌房间速度坠落、神秘电梯移动骰盘和洗衣滑槽直接移动均已补真实页面六段链；haunt 禁探索真实页面负向链已补，圣符和书本覆盖预兆翻出作祟真实 UI，9 张预兆作祟骰面记录已底层逐项确认；事件牌当前数据合同 23/23 已逐张补齐完整链。
- 已登记的合法代表链复用：砍刀、指环、匕首、无武器共享同一攻击入口、叛徒 token 目标、攻击骰盘和攻击 reducer；判等依据是 UI 入口与结算链同构，差异只在 `weaponCardId`、攻击属性、额外骰、速度花费和伤害类型。房间/结束回合家族按触发差异分别登记了倒塌房间、神秘电梯和洗衣滑槽，没有把有骰盘链外推到无骰盘链。
- 当前边界：本轮覆盖当前首剧本数据合同、用户点名交互、当前 23 张事件、9 张预兆、11 个物品及已实现房间/骰盘触发家族；官方扩展牌、其它剧本、部署、提交和线上反馈状态不在本轮完成边界。

## 9. 修订 / 失效记录

- 旧文档路径：`docs/games/betrayal/records/betrayal-playability-audit-2026-07-14.md`
- 旧结论：只建立事件牌家族清单并完成三条事件牌完整链路。
- 失效/降级原因：该旧结论不覆盖 haunt、圣符、驱魔、骰盘、物品、交易全量可玩性；当前文件已分对象更新，仍不得把已收口对象外推到预兆、物品全家族或骰盘全家族。
- 替代旧结论的新证据：当前事件牌完整链路已从三条扩展到当前数据合同 23/23 张逐张完整链。新增证据包含先选择属性再投检定的上古旧宅、夜幕众星；先投检定再选择后续效果的蜘蛛！、一条秘密通道、脑状食品；可选是否触发判定/作祟的肉质苔癣、一瓶微尘、大宅饿了、说“茄子”！、一抹鲜红；自动多属性检定后选择奖励的吊死鬼；以及 12 张投骰后直接结算事件牌的逐张六段截图。该结论只覆盖事件牌，不是山屋整体完成结论。

## 10. 对外汇报口径

- 允许说：当前已进入山屋可玩性全面重审计，已建立对象清单与 guard；haunt 阶段禁探索真实页面负向链已收口；当前数据合同 23/23 张事件牌已有从真实探索翻牌到关闭回牌桌的逐张完整证据，五个规则时序家族都已覆盖；圣符作祟判定从翻出到关闭回牌桌的六段真实页面链已收口；圣符探索声明已从声明、取消、重新声明、探索替换、事件结算到关闭回牌桌完成真实页面六段 E2E；驱魔失败伤害链已从真实驱魔入口、失败骰盘、伤害结算到关闭回牌桌完成真实页面六段 E2E；驱魔成功终局链已从真实驱魔入口、成功骰盘、成功结果、确认进入终局到幸存者终局页完成真实页面六段 E2E；物品使用链已从急救包本体、地图队友目标、治疗结算到状态清空完成真实页面六段 E2E；交易链已从兔脚本体、地图队友目标、确认、结算到状态清空完成真实页面六段 E2E；狗远距交易已从狗交易物选择、4 格内队友 token 选择、确认、结算、清空状态完成真实页面六段 E2E；面具移动已从面具本体选择、同板块队友目标、相邻房间目标、确认移动、结算到清空状态完成真实页面六段 E2E；盔甲物理减伤已从盔甲持有规则、电话铃声翻出、物理伤害骰盘、减伤属性变化、关闭回牌桌完成真实页面六段 E2E；头戴耳机精神减伤已从头戴耳机持有规则、电话铃声翻出、精神伤害骰盘、减伤属性变化、关闭回牌桌完成真实页面六段 E2E；手电筒/灯笼事件检定加骰已从持有规则、外星几何翻出、5 骰知识检定骰盘、知识奖励结算、关闭回牌桌完成真实页面六段 E2E；魔法相机知识检定替代已从持有规则、外星几何翻出、3 点知识用 5 点神志替代为 5 骰知识检定、知识奖励结算、关闭回牌桌完成真实页面六段 E2E；书本非战斗检定替代已从书本本体使用、花费神志、探索翻出小丑房间、5 骰神志检定、替代状态消费、关闭回牌桌完成真实页面六段 E2E；雕像探索声明已从声明跳过事件、选择未知房间、阴影扑面翻出但不结算、力量未扣且事件未弃置、关闭回牌桌完成真实页面六段 E2E；头骨死亡保护已从真实叛徒 token 攻击、死亡保护 3 骰、阻止死亡和未阻止死亡双分支、属性或死亡状态落位、回牌桌/继续查看完成真实页面 E2E；指环神志攻击已从选择指环武器、叛徒目标高亮、4 骰神志攻击、精神伤害结算到指环已用并回牌桌完成真实页面六段 E2E；匕首攻击已从选择匕首武器、叛徒目标高亮、6 骰力量攻击、物理伤害与速度花费结算到匕首已用并回牌桌完成真实页面六段 E2E；无武器攻击已从无持有物/默认攻击提示、叛徒目标高亮、4 骰力量攻击、物理伤害结算到回牌桌完成真实页面六段 E2E；骨制钥匙穿墙移动已从骨制钥匙本体、打开移动模式、穿墙目标房间、移动结算到清空状态完成真实页面六段 E2E；兔脚重掷链已从最近投骰、兔脚本体、具体骰子目标、重掷、结算更新到清空状态完成真实页面六段 E2E；骰盘 BTR-05 已完成普通投骰事件、砍刀攻击、指环神志攻击、匕首攻击、无武器攻击、驱魔失败、驱魔成功、兔脚重掷和头骨死亡保护代表链，证明开放式透明物理骰盘、专用 0/1/2 骰面、多骰不重叠和真实骰子命中区。
- 禁止说：已经覆盖官方扩展牌、其它剧本、部署或提交；截图交付不能把低清联系图冒充原图。
