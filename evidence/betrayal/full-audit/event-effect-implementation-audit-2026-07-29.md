# 小黑屋事件牌效果实现审计（2026-07-29）

> 2026-07-29 接续边界：本文件只作为 43 张事件牌下游效果消费审计索引，消费 `full-deck-data-intake-contract.md` 已锁对象、当前代码和测试证据；它不替代 74 张发现牌 S0 主合同，不授权新增事件实现、Board/UI、E2E 或截图，也不能证明事件牌或整牌库完成。

## 审计范围

本文件只审 `src/games/betrayal` 当前 43 张事件牌的效果实现消费情况，不审物品、预兆、房间效果、木乃伊横行完整剧本流程或全局 UI/E2E 截图闭环。当前事件牌全集为：标本剥制、说“茄子”！、外星几何、小丑房间、咬一口！、吊死鬼、电话铃声、小机器人、嘎吱的木门、脑状食品、片刻希望、上古旧宅、肉质苔癣、夜幕众星、一抹鲜红、一瓶微尘、大宅饿了、一条秘密通道、最深的壁橱、磁带播放器、在你背后！、蜘蛛！、一种怪异的感觉、游魂、葬礼、不可能的房间、地狱蝙蝠、断手、怪异的镜子、花团锦簇、晦暗暴风夜、技术难点、佳馔满桌、禁忌知识、可怜的尤里克、轮到约拿了、秘密升降机、神秘液体、无线电广播、摇曳灯光、一罐器官、一声呼救、着火的人。

本文件不重新录入图包或规则来源，不查 Wiki，不新增事件实现。当前只消费已有合同、代码、测试和 evidence；若某张事件缺合同、缺 UI 或缺组合证据，只登记为 `downstream-open`，不在本审计里补写规则或玩法。

## 结论等级

结论等级：`event-effect-matrix-indexed / broad-domain-and-board-representative-verified / downstream-open`。

含义：43 张事件已经进入当前运行池并有事件正面 atlas 映射；运行时已经有通用事件效果解释器、待选择事件状态、翻牌确认队列、房间目标合法性、最近投骰回滚和一批领域/组件代表链。20 张新增或复杂事件已有运行入口、关键分支、自动分支、失败伤害分支、成功属性分支、剩余分支代表链和 Board 组件承接证据；本轮定向复跑未发现“分支无最终状态写入 / 无玩家选择入口 / 分支后卡住”的 P0 实现阻塞。但逐事件完整真实入口 E2E、截图、死亡保护/伤害减免/重掷/作祟特例/房间目标组合仍未闭合；不能把“43 张进运行池”说成“事件牌全部完成”。

## 权威来源

| 类型 | 当前来源 |
| --- | --- |
| 对象全集 | `evidence/betrayal/full-audit/full-deck-data-intake-contract.md` 第 6.12；`evidence/betrayal/full-audit/object-l0-l4-matrix.md` |
| 运行池配置 | `src/games/betrayal/scenarioConfig.ts` 的 `events`，当前顶层事件对象 43 张 |
| 图集映射 | `src/games/betrayal/discoveryAtlas.ts` 的事件正面标题到 frame 映射 |
| 领域消费 | `src/games/betrayal/game.ts` 的事件效果解释、待选择事件、房间目标、通用伤害、重掷回滚、翻牌确认队列 |
| 页面承接 | `src/games/betrayal/Board.tsx` 的 `betrayal-event-choice-panel`、事件牌正面、属性/物品/伤害/房间选择和确认/跳过按钮 |
| 测试证据 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`、`src/games/betrayal/__tests__/Board.foundation.test.tsx` |
| 2026-07-31 静态复核 | 临时 `npx tsx -` 矩阵脚本直接导入 `BETRAYAL_DISCOVERY_POOLS.events`，递归收集事件效果模式并对照 `game.ts` / `Board.tsx` / 单测 / E2E / audit 文本 |

## 实现入口索引

| 链路 | 当前实现入口 | 审计判断 |
| --- | --- | --- |
| 事件池与配置 | `scenarioConfig.ts:1285` 起的 `events`；20 张新增/复杂事件集中在 `scenarioConfig.ts:1549`、`1963`、`2038-2433` | L1 结构入口存在；数量和配置不能外推为逐事件完成。 |
| 待选择判断 | `game.ts:2993` 的 `eventEffectNeedsPendingEventChoice` | 能把可选、选属性、选物品、选房间、通用伤害等事件转成待选择流程；仍需逐事件验证分支。 |
| 目标房间合法性 | `game.ts:3013`、`3070`、`3173`、`3205` | 已有相邻房间、同区域/不同区域/特定楼层目标合法性检查；仍需 UI 候选和作祟地图限制组合。 |
| 事件快照与回滚 | `game.ts:10073`、`10124`、`10652` | 支撑兔脚、恐怖玩偶等最近事件投骰回滚；新增固定骰或属性检定事件必须继续逐项准入。 |
| 探索抽事件与确认队列 | `game.ts:15918`、`15987`、`18830`、`18909`、`19141` | 探索事件能进入翻牌确认和待选择队列；确认队列存在不等于完整 UI/E2E。 |
| 玩家选择执行 | `game.ts:16197-16725` 的 `RESOLVE_EVENT_CHOICE` | 覆盖 `optionalHauntRoll`、`chooseTraitRoll`、`allTraitChecks`、`traitRoll`、`optionalItemEffect`、`optionalEffect`、`optionalEventRoll` 等通用分支。 |
| Board 事件承接 | `Board.tsx:6952-7115`、`10710-10920`、`14117-14504` | 有通用事件选择面板和属性、物品、房间、通用伤害选择 UI；只证明通用承接，不证明 43 张逐事件 E2E。 |
| 事件效果模式全集消费 | 2026-07-31 临时矩阵脚本统计配置中实际出现的 26 类事件效果模式：`allTraitChecks`、`chooseTraitRoll`、`chosenTrait`、`compound`、`drawPossession`、`fixedDamage`、`generalDamage`、`generalDamageChoice`、`healChosenTrait`、`none`、`optionalEffect`、`optionalEventRoll`、`optionalHauntRoll`、`optionalItemEffect`、`placeBlessingToken`、`placeExplorerInAdjacentRoom`、`placeExplorerInDiscoveredRoomByFloor`、`placeExplorerInDiscoveredRoomByVisualId`、`placeExplorerInFloorStartingRoom`、`placeExplorerInNextFloorStartingRoom`、`placeExplorerInRoom`、`placeObstacleToken`、`placeSecretPassageToken`、`rolledDamage`、`trait`、`traitRoll`；对照 `game.ts` 后 `noApplyMention=[]`。 | 该复核只排除“配置里有某类效果但 reducer 完全不消费”的 P0；`drawPossession`、`fixedDamage`、`rolledDamage` 等纯结算模式不需要单独 Board 模式分支，仍通过发现确认 / 骰盘 / 伤害分配 / 持有区结果承接。不能外推为逐事件真实 E2E 或截图完成。 |

## 逐项结论

### 旧 23 张事件

| 事件范围 | 当前实现消费 | 证据等级 | 残余范围 |
| --- | --- | --- | --- |
| 标本剥制、说“茄子”！、外星几何、小丑房间、咬一口！、吊死鬼、电话铃声、小机器人、嘎吱的木门、脑状食品、上古旧宅、肉质苔癣、夜幕众星、一抹鲜红、一瓶微尘、大宅饿了、一条秘密通道、最深的壁橱、磁带播放器、在你背后！、蜘蛛！、一种怪异的感觉、葬礼 | 旧运行池事件已有普通投骰、属性选择、可选作祟检定、房间目标、通用伤害、事件确认步骤等 family 代表链；`Board.foundation.test.tsx` 覆盖外星几何、上古旧宅、肉质苔癣、蜘蛛！、吊死鬼、一条秘密通道、脑状食品、夜幕众星、一抹鲜红、一瓶微尘、说“茄子”！等 UI/组件代表链。 | `existing-family-covered / representative-ui-covered` | 代表链不是逐事件 L4；旧 23 张如果新增死亡保护、作祟、伤害减免、房间目标或脚注消费者，仍需回到对应事件逐项审。 |
| 上古旧宅（旧 23 单卡补证） | 已有缺目标拒绝、速度成功放置任意板块、力量地面通用伤害、速度地下室精神伤害和非法楼层目标拒绝领域代表链；Board 组件代表链已承接卡面、力量选择、地面目标、目标点击后通用伤害分配和“力量检定 / 放置到门厅 / 通用伤害 1（力量）”反馈。 | `min-branch-verified / Board component representative / partial-ui` | 上层成功 UI、地下室精神伤害 UI、非法目标提示 UI、通用/精神伤害减免与死亡保护、更多楼层 / 作祟地图组合、真实入口 E2E 和截图未闭合。 |
| 肉质苔癣（旧 23 单卡补证） | 已有不吸入无事发生、吸入后固定 2 骰 4+ 待选任意属性、选择知识 +1、0-3 精神伤害、兔脚重掷成功分支保留待选属性不提前结算的领域代表链；Board 组件代表链已承接待选面板、拒绝跳过、吸入投骰、成功后选择知识和“知识 +1”确认步骤，也已承接失败分支“一颗骰子的精神伤害”确认步骤。 | `min-branch-verified / Board component representative / partial-ui` | 精神伤害减免 / 死亡保护、属性上限、更多属性选择、兔脚 UI / 更多重掷组合、真实入口 E2E 和截图未闭合。 |
| 脑状食品（旧 23 单卡补证） | 已有力量检定 5+ 选择力量或速度 +1、1-4 速度 +1 并神志 -1、0 通用伤害 2、缺选择拒绝、确认步骤阻止提前结束、头骨死亡保护和兔脚重掷回滚死亡 / 狂热病患化的领域代表链；Board 组件代表链已承接待选面板、5+ 奖励分支选择速度后“速度 +1”、0 分支分配力量 / 知识后的“通用伤害 2（力量、知识）”，以及 2 点通用伤害分到同一属性轨的预览。 | `min-branch-verified / Board component representative / partial-ui` | 成功力量 UI、更多属性上限、直接属性降低致死 / 死亡保护组合、通用伤害死亡保护 / 减免 / 胸针组合、兔脚 UI / 更多重掷组合、真实入口 E2E 和截图未闭合。 |
| 吊死鬼（旧 23 单卡补证） | 已有力量、速度、知识、神志四项属性连续检定领域链：失败属性各 -1，全部通过后进入任选属性 +1；已覆盖混合成功 / 失败扣减速度与神志、全通过后选择知识 +1、灰尘中全属性失败扣到骷髅时触发头骨死亡保护。Board 组件代表链已承接待选面板、四项属性检定说明、全通过后奖励属性选择和“知识 +1”反馈。 | `min-branch-verified / Board component representative / partial-ui` | 失败属性降低 UI、更多奖励属性选择、属性上下限、直接属性降低致死 / 死亡保护组合、兔脚 UI / 更多重掷组合、真实入口 E2E 和截图未闭合。 |
| 一条秘密通道（旧 23 单卡补证） | 已有知识检定三档领域链：5+ 在当前板块和任意另一已发现板块放置秘密通道标志物并知识 +1，3-4 在当前板块和任意地面板块放置标志物并结束回合，0-2 在当前板块和任意地下室板块放置标志物并神志 -1；已覆盖非法同房 / 非法楼层目标拒绝、发现确认前禁止移动、灰尘中神志 -1 扣到骷髅时触发头骨死亡保护。Board 组件代表链已承接待选面板、第二目标房间候选、点击门厅后两个秘密通道标志物反馈和“知识 +1”确认步骤。 | `min-branch-verified / Board component representative / partial-ui` | 非法原因 UI、更多目标范围、秘密通道标志物移动入口真实可用性、知识上限 / 神志下限、直接神志降低致死 / 死亡保护组合、兔脚 UI / 更多重掷组合、真实入口 E2E 和截图未闭合。 |

### 20 张新增或复杂事件

| 事件 | 当前实现消费 | 证据等级 | 残余范围 |
| --- | --- | --- | --- |
| 不可能的房间 | 已有运行入口；成功抽物品、失败精神伤害代表链；Board 组件代表链已承接卡面、神志检定骰盘、成功分支抽物品进入持有区和失败精神伤害反馈。 | `min-branch-verified / Board component representative / partial-ui` | 抽物品牌堆耗尽、精神伤害减免/死亡保护、更多伤害消费者组合、真实入口 E2E 和截图未闭合。 |
| 地狱蝙蝠 | 已有运行入口、相邻房间目标合法性、失败物理伤害和最小目标选择结算；Board 组件代表链已承接卡面、速度检定骰盘、相邻已发现房间候选、非相邻 / 跨楼层候选不显示、目标点击、当前位置更新，以及 0-3 分支物理伤害反馈。 | `min-branch-verified / Board component representative / partial-ui` | 非法目标提示 UI、物理伤害减免/死亡保护、作祟地图限制、更多门位/连接边界组合、真实入口 E2E 和截图未闭合。 |
| 断手 | 已有运行入口、接受抽物品分支、拒绝分支和 Board 组件确认链；通用可选事件标签传递已补，页面可显示确认/拒绝按钮。 | `min-branch-verified / Board component representative / partial-ui` | 伤害不足/死亡边界、物理伤害减免/改写、物品牌堆耗尽、胸针/盔甲/奇异护符/头骨/兔脚组合和真实入口 E2E / 截图未闭合。 |
| 怪异的镜子 | 已有运行入口；接受检定 0-4、5+ 进入 7 号作祟代表揭示态；秘密组合、事件符号跳过、镜中提示、破咒和镜中怪物已有领域代表链。 | `partial / min-domain-verified / representative-only` | 完整 7 号作祟、镜中怪物专属移动/目标 UI、作祟 E2E、截图链未闭合；不能用代表态声明 7 号作祟完成。 |
| 花团锦簇 | 已有运行入口、温室/同类目标合法性和通用伤害代表链；Board 组件代表链已承接待选事件卡面、地面 / 地下室候选、上层候选不显示、温室强制覆盖、目标点击后通用伤害分配、移动落点和最终反馈。 | `min-branch-verified / Board component representative / partial-ui` | 非法原因 UI、通用伤害死亡保护、更多温室 / 楼层 / 死亡保护组合、真实入口 E2E 和截图未闭合。 |
| 晦暗暴风夜 | 已有运行入口、4+ 神志 +1 和 0-3 精神伤害领域代表链；Board 组件代表链已承接事件房间翻牌后的知识检定骰盘、成功分支“获得 1 点神志 / 神志 +1”和失败分支“受到 1 点精神伤害”。 | `min-branch-verified / Board component representative / partial-ui` | 神志上限、精神伤害减免/死亡保护、重掷组合、真实入口 E2E 和截图未闭合。 |
| 技术难点 | 已有下一楼层起始点移动、地下室 fallback 到上层起始点并承受 1 点精神伤害的领域代表链；Board 组件代表链已承接从地面层事件房间翻出后放置到地下室起始点，以及从地下室事件房间翻出后回上层起始点并显示“受到 1 点精神伤害”。 | `min-verified / Board component representative / partial-ui` | 更多楼层边界、精神伤害减免/死亡保护组合、真实入口 E2E 和截图未闭合。 |
| 佳馔满桌 | 已有运行入口、知识/神志二选一检定、速度提升和通用伤害领域代表链；Board 组件代表链已承接卡面、知识/神志选择、成功分支“速度 +1”、失败分支通用伤害属性分配和“通用伤害 1（力量）”最终反馈。 | `min-branch-verified / Board component representative / partial-ui` | 速度上限、祝福与兔脚/恐怖玩偶/幸运硬币/天使之羽重掷或替代组合、通用伤害死亡保护、真实入口 E2E 和截图未闭合。 |
| 禁忌知识 | 已有运行入口、成功属性提升、失败精神伤害和多段属性变化领域代表链；Board 组件代表链已承接事件房间翻牌后的神志检定骰盘、总点数 2、2-3 分支属性变化详情和“知识 +1 / 神志 -1”确认步骤，也已承接总点数 0 时 0-1 分支“受到两颗骰子的精神伤害”和“受到 2 颗骰子的精神伤害”确认步骤。 | `min-branch-verified / Board component representative / partial-ui` | 属性上下限、直接属性降低致死、死亡保护、精神伤害减免、祝福与兔脚/恐怖玩偶/幸运硬币/天使之羽组合、真实入口 E2E 和截图未闭合。 |
| 可怜的尤里克 | 已有运行入口、知识提升和精神伤害领域代表链；Board 组件代表链已承接事件房间翻牌后的神志检定骰盘，总点数 8 时展示 4+ 分支“获得 1 点知识”和“知识 +1”，总点数 0 时展示 0-3 分支“受到 1 点精神伤害”。 | `min-branch-verified / Board component representative / partial-ui` | 知识上限、精神伤害减免、死亡保护、祝福与兔脚/恐怖玩偶/幸运硬币/天使之羽组合、真实入口 E2E 和截图未闭合。 |
| 轮到约拿了 | 已有缺 cardId 拒绝、武器拒绝、地图弃置、神志 +1 和拒绝精神伤害领域代表链；Board 组件代表链已证明待选事件面板只展示可弃置的非武器物品「地图」、排除武器「砍刀」、未选确认禁用，选择地图后派发 `RESOLVE_EVENT_CHOICE cardId=map`；拒绝“不弃置物品”后待选面板关闭并显示“受到 1 颗骰子的精神伤害”确认步骤。 | `min-verified / Board component representative / partial-ui` | 无非武器物品 UI、已用/不可交易限制、弃置终点可见性、精神伤害减免/死亡保护和真实入口 E2E / 截图未闭合。 |
| 秘密升降机 | 已有运行入口、不同区域放置领域代表链、同区域 / 未发现非法目标拒绝和 Board 组件候选代表链；组件链证明当前区域 / 同区域候选不显示，切换楼层后只显示不同区域已发现起始点，点击地下室起始点会提交目标房间。 | `min-branch-verified / Board component representative / partial-ui` | 作祟地图限制、非法原因 UI、同区域 / 未发现 / 更多楼层组合、移动后续反馈、真实入口 E2E 和截图未闭合。 |
| 神秘液体 | 已有运行入口、可选投骰、拒绝路径、0-6 骰值多分支代表链；Board 组件代表链已承接卡面、拒绝按钮、喝下按钮、固定 3 骰骰盘和分支结果。 | `min-branch-verified / Board component representative / downstream-open` | 属性上下限、直接属性降低致死、死亡保护、固定骰重掷组合、真实入口 E2E 和截图未闭合。 |
| 无线电广播 | 已有运行入口、知识提升/失败精神伤害代表链；Board 组件代表链已承接事件房间翻牌后的固定 2 骰骰盘，总点数 4 时展示 3-4 分支“获得 1 点知识”和“知识 +1”，总点数 0 时展示 0-2 分支“受到一颗骰子的精神伤害”和“受到 1 颗骰子的精神伤害”；脚注被裁定为展示/音频提示，不改变规则结算。 | `min-branch-verified / Board component representative / partial-ui / footnote-contract-set` | 脚注/音频呈现、精神伤害减免/死亡保护、固定骰/最近投骰重掷准入、真实入口 E2E 和截图未闭合。 |
| 摇曳灯光 | 已有运行入口、速度/力量二选一检定、成功属性提升和失败物理伤害代表链；祝福加骰组合已有一条领域链；Board 组件代表链已承接卡面、速度/力量二选一、点击速度后的属性检定骰盘、总点数 8 和速度 +1 分支结果。 | `min-branch-verified / Board component representative / partial-combo` | 速度上限、祝福与兔脚/恐怖玩偶/幸运硬币/天使之羽重掷或替代组合、物理伤害减免/死亡保护、真实入口 E2E 和截图未闭合。 |
| 一罐器官 | 已有运行入口、力量降低和成功抽物品代表链；Board 组件代表链已承接事件房间翻牌后的神志检定骰盘，成功分支可显示“抽取一张物品卡”并把魔法相机加入持有区，失败分支可显示“失去 1 点力量”和“力量 -1”确认步骤。 | `min-branch-verified / Board component representative / partial-ui` | 物品牌堆耗尽、属性下限、直接属性降低致死、死亡保护和真实入口 E2E / 截图未闭合。 |
| 一声呼救 | 已有运行入口、4+ 同区域放置、0-3 精神伤害、同区域 / 不同区域 / 未发现目标合法性领域代表链；Board 组件代表链已承接事件房间翻牌后的卡面、知识检定骰盘、总点数 8、4+ 分支“放置在所在区域的任意板块”、同区域已发现房间候选高亮、不同区域候选不显示，点击门厅后当前位置更新和“放置到门厅”确认步骤；总点数 0 时展示 0-3 分支“受到 1 点精神伤害”和确认步骤。 | `min-branch-verified / Board component representative / partial-ui` | 非法原因 UI、精神伤害减免/死亡保护、更多区域边界组合、真实入口 E2E 和截图未闭合。 |
| 着火的人 | 已有运行入口；4+ 神志、2-3 移动、0-1 物理+精神双伤害代表链；Board 组件代表链已承接事件房间翻牌后的神志检定骰盘、总点数 2、2-3 分支“放置到入口大厅”和当前探险者位置更新；总点数 0 时展示 0-1 分支“双伤害”、物理伤害骰反馈和精神伤害骰反馈。 | `min-branch-verified / Board component representative / partial-ui` | 双伤害分配顺序、减伤/胸针/盔甲/头戴耳机/死亡保护组合、真实入口 E2E 和截图未闭合。 |
| 片刻希望 | 已有最小领域补证，能放置祝福并被后续属性检定消费；Board 组件代表链已显示房间祝福标记。 | `min-verified / Board component representative / partial-combo` | 加骰可见性、兔脚/恐怖玩偶/幸运硬币/天使之羽组合、真实入口 E2E 和截图未闭合。 |
| 游魂 | 已有最小领域补证，覆盖埋葽物品、任意属性选择、抽物品和通用伤害代表分支；Board 组件代表链已承接待选面板、候选物品「地图 / 砍刀」、四项奖励属性、物品 + 属性双选择确认门禁和 `cardId=map / trait=knowledge` 派发。 | `min-verified / Board component representative / partial-ui` | 无物品 UI、抽物品 UI / 物品牌堆耗尽、拒绝失败通用伤害 UI、通用伤害/死亡保护组合、真实入口 E2E 和截图未闭合。 |

## 验证证据

| 检查 | 结果 |
| --- | --- |
| 43 张事件结构入口 | `firstScenarioRuntime.test.ts:2351` 覆盖当前官方事件池；`firstScenarioRuntime.test.ts:2428` 覆盖 43 张事件正面 atlas 映射；`firstScenarioRuntime.test.ts:2487` 覆盖 43 张事件的灰尘死亡保护风险分类。 |
| 事件运行入口 | `firstScenarioRuntime.test.ts:17762-17782` 覆盖 20 张新增/复杂事件探索时进入运行消费入口。 |
| 待选择事件最小结算 | `firstScenarioRuntime.test.ts:17807` 起覆盖地狱蝙蝠、断手、怪异的镜子、花团锦簇、佳馔满桌、秘密升降机、神秘液体、摇曳灯光、一声呼救等最小结算。 |
| 房间目标合法性 | `firstScenarioRuntime.test.ts:17914` 起覆盖地狱蝙蝠、秘密升降机、一声呼救、花团锦簇的非法目标拒绝。 |
| 怪异的镜子与 7 号代表链 | `firstScenarioRuntime.test.ts:18013`、`18218`、`18230`、`18267`、`18330`、`18376`、`18449` 覆盖作祟代表揭示、秘密组合、事件符号跳过、镜中提示、破咒和胜利代表链。 |
| 新增配置事件分支 | `firstScenarioRuntime.test.ts:18487`、`18668`、`18745`、`18767`、`18830` 覆盖剩余可配置分支、自动分支、成功属性分支、失败伤害分支和轮到约拿了/片刻希望/游魂代表链。 |
| Board 通用事件选择 UI | `Board.foundation.test.tsx:5830`、`5913`、`5972`、`6000`、`6042`、`6087`、`6126`、`6203`、`6249`、`6295`、`6337`、`6414`、`6499`、`6571`、`6643`、`6714`、`6799`、`6890`、`6974`、`7061`、`7163`、`7269`、`7328`、`7356`、`7420`、`7470`、`7553`、`7655`、`7720`、`7812`、`7999`、`8045`、`8091`、`8133` 覆盖普通投骰、属性/房间/物品/通用伤害/跳过等代表 UI 链；其中 `6414` 专门覆盖不可能的房间神志检定、成功抽物品和失败精神伤害承接，`6499` 专门覆盖断手可选伤害、抽物品和拒绝路径，`6571` 专门覆盖晦暗暴风夜知识检定、神志 +1 和 0-3 精神伤害承接，`6643` 专门覆盖禁忌知识事件房间翻牌后的神志检定和 2-3 分支属性变化承接，`6714` 专门覆盖可怜的尤里克神志检定、4+ 知识提升和 0-3 精神伤害承接，`6799` 专门覆盖着火的人神志检定、入口大厅移动分支和 0-1 双伤害反馈承接，`6890` 专门覆盖无线电广播固定 2 骰、知识 +1 成功分支和失败精神伤害分支承接，`6974` 专门覆盖一罐器官神志检定、4+ 抽物品进入持有区和 0-3 力量 -1 失败分支承接，`7061` 专门覆盖一声呼救知识检定、同区域已发现房间候选高亮、不同区域候选不显示、点击门厅后的当前位置更新和“放置到门厅”确认步骤，`7163` 专门覆盖花团锦簇待选事件的地面 / 地下室候选、上层候选不显示、温室强制覆盖、目标点击后通用伤害分配和移动反馈，`7553` 专门覆盖地狱蝙蝠速度检定、相邻已发现房间候选高亮、非相邻 / 跨楼层候选不显示、点击门厅后的当前位置更新和“放置到门厅”确认步骤，`7655` 专门覆盖轮到约拿了待选事件只展示可弃置非武器物品、排除武器、未选确认禁用、选择地图后 dispatch 和拒绝后的精神伤害确认步骤，`7720` 专门覆盖游魂物品 / 任意属性双选择，`8091` 专门覆盖秘密升降机待选事件的不同区域已发现房间候选、同区域候选不显示和目标点击 payload，`7356` 专门覆盖神秘液体拒绝不投骰与喝下后固定 3 骰结果承接，`7269` 专门覆盖上古旧宅属性选择、地面目标房间、目标点击后通用伤害分配和“力量检定 / 放置到门厅 / 通用伤害 1（力量）”反馈，`7420` 专门覆盖摇曳灯光速度/力量选择与速度成功分支承接，`7470` 专门覆盖佳馔满桌知识/神志选择、成功分支“速度 +1”和失败分支通用伤害分配，`7812` 专门覆盖肉质苔癣固定 2 骰、成功任选属性和失败精神伤害确认步骤。 |
| 轮到约拿了物品选择 / 拒绝精神伤害 UI | `Board.foundation.test.tsx:7583` 覆盖轮到约拿了待选事件面板显示卡牌名，候选只展示非武器物品「地图」，不展示武器「砍刀」，未选物品时确认禁用，选择地图后派发 `RESOLVE_EVENT_CHOICE` 且 payload 为 `cardId=map`；同一用例覆盖拒绝“不弃置物品”后显示“受到 1 颗骰子的精神伤害”确认步骤。 |
| 上古旧宅属性 / 目标 / 通用伤害 UI | `Board.foundation.test.tsx:7084` 覆盖上古旧宅待选事件面板显示卡面，力量属性 chip 可选且未提前展示确认按钮；选择力量后面板收起并展示地面目标房间，点击门厅后进入通用伤害分配，选择力量后显示“力量检定”“放置到门厅”和“通用伤害 1（力量）”。 |
| 肉质苔癣可选吸入 / 任选属性 / 精神伤害 UI | `Board.foundation.test.tsx:7143` 覆盖肉质苔癣待选事件面板、拒绝“不吸入芳香”后关闭待选面板并显示“无事发生”；`Board.foundation.test.tsx:7717` 覆盖确认“大口吸入芳香”后展示固定 2 骰骰盘，总点数 4 时选择知识并显示“知识 +1”，总点数 0 时显示“受到一颗骰子的精神伤害”和“受到 1 颗骰子的精神伤害”确认步骤。 |
| 脑状食品选择属性 / 通用伤害 UI | `Board.foundation.test.tsx:7824` 覆盖脑状食品待选事件面板、5+ 奖励分支选择速度后显示“速度 +1”、0 分支选择力量 / 知识后显示“通用伤害 2（力量、知识）”，并覆盖通用伤害 2 可分配到同一属性轨的扣减预览。 |
| 片刻希望祝福标记证据 | `Board.foundation.test.tsx:4598` 覆盖房间祝福标记显示在对应房间格；`firstScenarioRuntime.test.ts:19082` 覆盖片刻希望放置祝福并被后续同房间事件属性检定额外投 1 骰消费。 |
| 断手可选伤害 / 抽物品 / 拒绝 UI | `Board.foundation.test.tsx:6499` 覆盖断手从事件符号房间翻出后展示卡面、确认按钮“承受伤害并抽取物品”、拒绝按钮“不触碰断手”；拒绝后显示“无事发生”，接受后显示“受到 2 点物理伤害”“抽取一张物品卡”并把「魔法相机」放入持有区。 |
| 禁忌知识神志检定 UI | `Board.foundation.test.tsx:6571` 覆盖禁忌知识从事件符号房间翻出后展示卡面、4 骰神志检定、总点数 2、2-3 分支“获得 1 点知识并失去 1 点神志”和“知识 +1 / 神志 -1”确认步骤；同一用例还覆盖总点数 0 时 0-1 分支“受到两颗骰子的精神伤害”和“受到 2 颗骰子的精神伤害”确认步骤。 |
| 可怜的尤里克神志检定 UI | `Board.foundation.test.tsx:6616` 覆盖可怜的尤里克从事件符号房间翻出后展示卡面、4 骰神志检定、总点数 8 时展示 4+ 分支“获得 1 点知识”和“知识 +1”，总点数 0 时展示 0-3 分支“受到 1 点精神伤害”。 |
| 着火的人神志检定 / 移动 / 双伤害 UI | `Board.foundation.test.tsx:6701` 覆盖着火的人从事件符号房间翻出后展示卡面、4 骰神志检定、总点数 2、2-3 分支“放置到入口大厅”，并证明当前探险者位置 `data-room-id=entrance-hall`；同一用例还覆盖总点数 0 时的 0-1 分支“双伤害”、物理伤害骰反馈和精神伤害骰反馈。 |
| 无线电广播固定 2 骰 / 精神伤害 UI | `Board.foundation.test.tsx:6746` 覆盖无线电广播从事件符号房间翻出后展示卡面、固定 2 骰骰盘、总点数 4 时展示 3-4 分支“获得 1 点知识”和“知识 +1”，总点数 0 时展示 0-2 分支“受到一颗骰子的精神伤害”和“受到 1 颗骰子的精神伤害”；不覆盖脚注展示或音频资源。 |
| 一罐器官神志检定 / 抽物品 / 属性降低 UI | `Board.foundation.test.tsx:6830` 覆盖一罐器官从事件符号房间翻出后展示卡面、4 骰神志检定、总点数 8 时展示“抽取一张物品卡”并把「魔法相机」放入持有区；总点数 0 时展示“失去 1 点力量”和“力量 -1”确认步骤。 |
| 一声呼救知识检定 / 同区域房间目标 / 精神伤害 UI | `Board.foundation.test.tsx:6917` 覆盖一声呼救从事件符号房间翻出后展示卡面、4 骰知识检定、总点数 8、4+ 分支“放置在所在区域的任意板块”、同区域已发现房间候选高亮、不同区域候选不显示，点击门厅后当前位置 `data-room-id=hallway` 和“放置到门厅”确认步骤；同一用例还覆盖总点数 0 时的 0-3 分支“受到 1 点精神伤害”确认步骤。 |
| 花团锦簇地面 / 地下室 / 温室目标 UI | `Board.foundation.test.tsx:6978` 覆盖花团锦簇待选事件面板显示卡面，普通分支展示地面 `hallway` / `entrance-hall` 与地下室 `basement-landing` 候选且不展示上层候选，点击地下室起始点后进入通用伤害分配，选择力量后当前位置 `data-room-id=basement-landing` 并显示“通用伤害 1（力量）”与“放置到地下室起始点”；温室分支只展示温室候选、不展示其它地面 / 地下室候选，结算后显示“放置到温室”。 |
| 地狱蝙蝠速度检定 / 相邻房间目标 / 物理伤害 UI | `Board.foundation.test.tsx:7422` 覆盖地狱蝙蝠从事件符号房间翻出后展示卡面、4 骰速度检定、总点数 8、4+ 分支“放置到相邻板块”、相邻已发现房间候选高亮、非相邻 / 跨楼层候选不显示，点击门厅后当前位置 `data-room-id=hallway` 和“放置到门厅”确认步骤；同一用例还覆盖总点数 0 时的 0-3 分支“受到 1 点物理伤害”确认步骤。 |
| 秘密升降机不同区域房间目标 UI | `Board.foundation.test.tsx:7782` 覆盖秘密升降机待选事件面板、当前区域 / 同区域候选不显示、切到上层显示上层起始点、切到地下室显示地下室起始点，并证明点击地下室起始点会提交 `targetRoomId=basement-landing`。 |
| 神秘液体 UI 投骰承接 | `Board.foundation.test.tsx:7171` 覆盖神秘液体待选面板显示卡面、可拒绝且不展示投骰、可喝下并展示固定 3 骰骰盘、总点数 6 和“每项属性 +1”确认步骤。 |
| 摇曳灯光选择属性 UI | `Board.foundation.test.tsx:7235` 覆盖摇曳灯光待选面板显示卡面、速度/力量 chip；选择速度后关闭待选面板并展示摇曳灯光发现面板、速度检定、骰盘总点数 8 和“速度 +1”确认步骤。 |
| 佳馔满桌选择属性 / 速度提升 / 通用伤害 UI | `Board.foundation.test.tsx:7398` 覆盖佳馔满桌待选面板显示卡面、知识/神志 chip；成功路径选择知识并选择伤害备选属性后展示知识检定、总点数 8 和“速度 +1”；失败路径选择力量后展示“通用伤害 1（力量）”最终反馈。 |
| 不可能的房间神志检定 / 抽物品 / 精神伤害 UI | `Board.foundation.test.tsx:6414` 覆盖不可能的房间从事件符号房间翻出后展示卡面、4 骰神志检定、总点数 8 时展示“抽取一张物品卡”并把「魔法相机」放入持有区；总点数 2 时展示“受到一颗骰子的精神伤害”和“受到 1 颗骰子的精神伤害”反馈。 |
| 游魂物品 / 任意属性选择 UI | `Board.foundation.test.tsx:7437` 覆盖游魂待选事件面板显示卡面语义、当前持有物品候选「地图 / 砍刀」、力量 / 速度 / 知识 / 神志四项属性候选，只选物品时确认禁用，选择地图 + 知识后派发 `RESOLVE_EVENT_CHOICE cardId=map trait=knowledge`。 |
| 本轮新增验证 | `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "花团锦簇\|秘密升降机\|地狱蝙蝠\|一声呼救"`：4 passed / 151 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声，覆盖花团锦簇、秘密升降机、地狱蝙蝠、一声呼救目标房间 Board 组件代表链；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "一罐器官\|无线电广播\|着火的人\|可怜的尤里克\|禁忌知识\|佳馔满桌\|摇曳灯光\|神秘液体"`：8 passed / 144 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`npx eslint src/games/betrayal/__tests__/Board.foundation.test.tsx scripts/games/betrayal/generate-full-audit-matrix.mjs`：0 errors；`npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/full-deck-data-intake-contract.md evidence/betrayal/full-audit/object-l0-l4-matrix.md`：OK。 |
| 本轮新增验证（轮到约拿了） | `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "轮到约拿了"`：1 passed / 157 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "轮到约拿了"`：2 passed / 693 skipped；`npx eslint src/games/betrayal/__tests__/Board.foundation.test.tsx scripts/games/betrayal/generate-full-audit-matrix.mjs`：0 errors；`npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/full-deck-data-intake-contract.md evidence/betrayal/full-audit/object-l0-l4-matrix.md evidence/betrayal/full-audit/full-deck-scope-audit.md`：OK；`node -e "JSON.parse(...temp/betrayal-full-audit-current-task.json...)"`：OK。 |
| 本轮新增验证（上古旧宅） | `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "上古旧宅"`：1 passed / 154 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "上古旧宅"`：3 passed / 692 skipped；`npx eslint src/games/betrayal/__tests__/Board.foundation.test.tsx scripts/games/betrayal/generate-full-audit-matrix.mjs`：0 errors；`npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/full-deck-data-intake-contract.md evidence/betrayal/full-audit/object-l0-l4-matrix.md`：OK；`node -e "JSON.parse(...temp/betrayal-full-audit-current-task.json...)"`：OK。 |
| 本轮新增验证（肉质苔癣） | `node scripts/games/betrayal/generate-full-audit-matrix.mjs`：Rows 135；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "肉质苔癣"`：2 passed / 156 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "肉质苔癣"`：3 passed / 692 skipped；`npx eslint src/games/betrayal/__tests__/Board.foundation.test.tsx scripts/games/betrayal/generate-full-audit-matrix.mjs`：0 errors；`npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/full-deck-data-intake-contract.md evidence/betrayal/full-audit/object-l0-l4-matrix.md evidence/betrayal/full-audit/full-deck-scope-audit.md`：OK；任务 JSON 可解析。 |
| 本轮新增验证（脑状食品） | `node scripts/games/betrayal/generate-full-audit-matrix.mjs`：Rows 135；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "脑状食品"`：1 passed / 154 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "脑状食品"`：4 passed / 691 skipped；`npx eslint src/games/betrayal/__tests__/Board.foundation.test.tsx scripts/games/betrayal/generate-full-audit-matrix.mjs`：0 errors；`npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/full-deck-data-intake-contract.md evidence/betrayal/full-audit/object-l0-l4-matrix.md`：OK；`node -e "JSON.parse(...temp/betrayal-full-audit-current-task.json...)"`：OK。 |
| 本轮新增验证（吊死鬼） | `node scripts/games/betrayal/generate-full-audit-matrix.mjs`：Rows 135；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "吊死鬼"`：1 passed / 154 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "吊死鬼"`：2 passed / 693 skipped；`npx eslint src/games/betrayal/__tests__/Board.foundation.test.tsx scripts/games/betrayal/generate-full-audit-matrix.mjs`：0 errors；`npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/full-deck-data-intake-contract.md evidence/betrayal/full-audit/object-l0-l4-matrix.md`：OK；`node -e "JSON.parse(...temp/betrayal-full-audit-current-task.json...)"`：OK。 |
| 本轮新增验证（一条秘密通道） | `node scripts/games/betrayal/generate-full-audit-matrix.mjs`：Rows 135；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "一条秘密通道"`：1 passed / 154 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "一条秘密通道"`：2 passed / 693 skipped；`npx eslint src/games/betrayal/__tests__/Board.foundation.test.tsx scripts/games/betrayal/generate-full-audit-matrix.mjs`：0 errors；`npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/full-deck-data-intake-contract.md evidence/betrayal/full-audit/object-l0-l4-matrix.md evidence/betrayal/full-audit/full-deck-scope-audit.md`：OK；`node -e "JSON.parse(...temp/betrayal-full-audit-current-task.json...)"`：OK。 |
| 本轮新增验证（游魂） | `node scripts/games/betrayal/generate-full-audit-matrix.mjs`：Rows 135；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "游魂"`：1 passed / 155 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "游魂"`：2 passed / 693 skipped；`npx eslint src/games/betrayal/__tests__/Board.foundation.test.tsx scripts/games/betrayal/generate-full-audit-matrix.mjs`：0 errors；`npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/full-deck-data-intake-contract.md evidence/betrayal/full-audit/object-l0-l4-matrix.md evidence/betrayal/full-audit/full-deck-scope-audit.md`：OK；`node -e "JSON.parse(...temp/betrayal-full-audit-current-task.json...)"`：OK。 |
| 本轮新增验证（不可能的房间） | `node scripts/games/betrayal/generate-full-audit-matrix.mjs`：Rows 135；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "不可能的房间"`：1 passed / 156 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "不可能的房间"`：1 passed / 694 skipped；`npx eslint src/games/betrayal/__tests__/Board.foundation.test.tsx scripts/games/betrayal/generate-full-audit-matrix.mjs`：0 errors；`npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/full-deck-data-intake-contract.md evidence/betrayal/full-audit/object-l0-l4-matrix.md evidence/betrayal/full-audit/full-deck-scope-audit.md`：OK；`node -e "JSON.parse(...temp/betrayal-full-audit-current-task.json...)"`：OK。 |
| 本轮新增验证（断手） | `node scripts/games/betrayal/generate-full-audit-matrix.mjs`：Rows 135；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "断手"`：1 passed / 157 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "断手"`：1 passed / 694 skipped；`npx eslint src/games/betrayal/__tests__/Board.foundation.test.tsx src/games/betrayal/game.ts scripts/games/betrayal/generate-full-audit-matrix.mjs`：0 errors，`game.ts` 仍有 5 个既有 unused warning；`npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/full-deck-data-intake-contract.md evidence/betrayal/full-audit/object-l0-l4-matrix.md evidence/betrayal/full-audit/full-deck-scope-audit.md`：OK；任务 JSON 可解析；旧口径扫描无命中。 |
| 本轮新增验证（晦暗暴风夜） | `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "晦暗暴风夜"`：1 passed / 158 skipped，退出码 0，尾部有既有 `ECONNRESET` / `AbortError` 噪声；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "晦暗暴风夜"`：1 passed / 694 skipped。 |
| 本轮新增验证（技术难点） | `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "技术难点"`：1 passed / 159 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "技术难点"`：1 passed / 694 skipped。 |
| 本轮新增验证（一罐器官抽物品） | `node scripts/games/betrayal/generate-full-audit-matrix.mjs`：Rows 135；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "一罐器官"`：1 passed / 157 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "一罐器官"`：1 passed / 694 skipped；`npx eslint scripts/games/betrayal/generate-full-audit-matrix.mjs src/games/betrayal/__tests__/Board.foundation.test.tsx`：0 errors；`npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/full-deck-data-intake-contract.md evidence/betrayal/full-audit/object-l0-l4-matrix.md evidence/betrayal/full-audit/full-deck-scope-audit.md`：OK；任务 JSON 可解析；旧口径扫描无命中。 |
| 本轮新增验证（可怜的尤里克精神伤害 UI） | `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "可怜的尤里克"`：1 passed / 157 skipped，退出码 0，尾部有既有 `ECONNRESET` / `AbortError` 噪声；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "可怜的尤里克"`：1 passed / 694 skipped。 |
| 本轮新增验证（无线电广播精神伤害 UI） | `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "无线电广播"`：1 passed / 157 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "无线电广播"`：1 passed / 694 skipped。 |
| 本轮新增验证（一声呼救精神伤害 UI） | `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "一声呼救"`：1 passed / 157 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；领域链沿用 `firstScenarioRuntime.test.ts -t "一声呼救"` 已验证的 0-3 精神伤害和目标合法性代表链。 |
| 本轮新增验证（着火的人双伤害 UI） | `node scripts/games/betrayal/generate-full-audit-matrix.mjs`：Rows 135；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "着火的人"`：1 passed / 157 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "着火的人"`：1 passed / 694 skipped；`npx eslint src/games/betrayal/__tests__/Board.foundation.test.tsx scripts/games/betrayal/generate-full-audit-matrix.mjs`：0 errors；`npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/full-deck-data-intake-contract.md evidence/betrayal/full-audit/object-l0-l4-matrix.md evidence/betrayal/full-audit/full-deck-scope-audit.md`：OK；任务 JSON 可解析；旧“0-1 物理+精神双伤害 UI 未闭合”口径扫描无命中。 |
| 本轮新增验证（地狱蝙蝠物理伤害 UI） | `node scripts/games/betrayal/generate-full-audit-matrix.mjs`：Rows 135；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "地狱蝙蝠"`：1 passed / 157 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "地狱蝙蝠"`：1 passed / 694 skipped；`npx eslint src/games/betrayal/__tests__/Board.foundation.test.tsx scripts/games/betrayal/generate-full-audit-matrix.mjs`：0 errors；`npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/full-deck-data-intake-contract.md evidence/betrayal/full-audit/object-l0-l4-matrix.md evidence/betrayal/full-audit/full-deck-scope-audit.md`：OK；任务 JSON 可解析；旧地狱蝙蝠物理伤害 UI 残缺口径扫描无命中。 |
| 本轮新增验证（禁忌知识低档精神伤害 UI） | `node scripts/games/betrayal/generate-full-audit-matrix.mjs`：Rows 135；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "禁忌知识"`：1 passed / 157 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "禁忌知识"`：1 passed / 694 skipped；`npx eslint src/games/betrayal/__tests__/Board.foundation.test.tsx`：0 errors。 |
| 本轮新增验证（佳馔满桌成功速度 UI） | `node scripts/games/betrayal/generate-full-audit-matrix.mjs`：Rows 135；`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "佳馔满桌"`：1 passed / 157 skipped，退出码 0，尾部有既有 `ECONNRESET` 噪声；`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "佳馔满桌"`：1 passed / 694 skipped；`npx eslint src/games/betrayal/__tests__/Board.foundation.test.tsx`：0 errors。 |
| 当前续跑矩阵回写 | 已同步 `scripts/games/betrayal/generate-full-audit-matrix.mjs` 并重生成 `object-l0-l4-matrix.md`：旧 23 张事件不再使用“已做 E2E 覆盖”式表达，统一改为“Board 组件/领域代表链已补；逐事件真实入口 E2E 和截图未闭合”。 |
| 审计留档自检 | `npm run audit:evidence:selfcheck -- evidence/betrayal/full-audit/event-effect-implementation-audit-2026-07-29.md evidence/betrayal/full-audit/full-deck-data-intake-contract.md evidence/betrayal/full-audit/object-l0-l4-matrix.md`：OK。 |

## 测试语义对账

| 证据桶 | 测试断言证明的最终状态 | 不能外推的事项 |
| --- | --- | --- |
| 数量与 atlas | 43 张事件在当前运行池中，标题唯一映射到事件正面 atlas frame。 | 不证明任一事件规则效果、UI、E2E 或组合完成。 |
| 运行入口 | 20 张新增/复杂事件能从探索发现进入事件效果消费链，并生成翻牌确认或待选择状态。 | 不证明每张事件所有分支都能完成，也不证明真实玩家 UI 已逐张可用。 |
| 领域代表链 | 多个事件的成功/失败分支能写入属性、移动、抽物品、伤害或作祟代表状态。 | 不证明死亡保护、减伤、重掷、胸针/盔甲/头戴耳机、作祟状态和房间目标组合全部正确。 |
| Board 组件代表链 | 通用事件面板能展示事件牌、投骰结果、属性 chip、物品 chip、房间候选、通用伤害选择、确认/跳过按钮；禁忌知识专属代表链已证明事件房间翻牌后的神志检定骰盘、2-3 分支详情和确认步骤可见，也已证明 0-1 双骰精神伤害分支和确认步骤可见；可怜的尤里克专属代表链已证明事件房间翻牌后的神志检定骰盘、4+ 知识提升分支和 0-3 精神伤害分支可见；着火的人专属代表链已证明事件房间翻牌后的神志检定骰盘、2-3 移动分支详情、确认步骤、当前探险者位置更新、0-1 双伤害分支、物理伤害骰反馈和精神伤害骰反馈可见；无线电广播专属代表链已证明事件房间翻牌后的固定 2 骰骰盘、3-4 知识 +1 分支和 0-2 精神伤害分支详情可见；一罐器官专属代表链已证明事件房间翻牌后的神志检定骰盘、4+ 抽物品进入持有区和 0-3 力量 -1 分支详情可见；一声呼救专属代表链已证明事件房间翻牌后的知识检定骰盘、4+ 同区域房间候选高亮、不同区域候选不显示、目标点击和当前位置更新可见，并已证明 0-3 精神伤害确认步骤可见；花团锦簇专属代表链已证明待选事件面板的地面 / 地下室候选、上层候选不显示、温室强制覆盖、目标点击后通用伤害分配和移动反馈可见；地狱蝙蝠专属代表链已证明事件房间翻牌后的速度检定骰盘、4+ 相邻房间候选高亮、非相邻 / 跨楼层候选不显示、目标点击、当前位置更新和 0-3 物理伤害反馈可见；神秘液体专属代表链已证明拒绝不投骰、喝下后固定 3 骰与分支结果可见；摇曳灯光专属代表链已证明属性二选一、速度检定骰盘和成功分支可见；佳馔满桌专属代表链已证明属性二选一、成功分支“速度 +1”和失败分支通用伤害分配可见。 | 不证明 43 张逐事件真实入口 E2E；组件级代表链不能替代截图验收，也不能替代禁忌知识的属性上下限、直接属性降低致死、死亡保护、精神伤害减免和重掷 / 替代组合；也不能替代可怜的尤里克的知识上限、精神伤害减免、死亡保护和重掷 / 替代组合；也不能替代着火的人的双伤害分配顺序、减伤 / 胸针 / 盔甲 / 头戴耳机 / 死亡保护组合；也不能替代无线电广播的脚注/音频呈现、精神伤害减免/死亡保护和固定骰/重掷准入边界；也不能替代一罐器官的物品牌堆耗尽、属性下限、直接属性降低致死和死亡保护；也不能替代一声呼救的非法原因 UI、精神伤害减免/死亡保护、更多区域边界组合和真实入口 E2E / 截图；也不能替代花团锦簇的非法原因 UI、通用伤害死亡保护、更多温室 / 楼层 / 死亡保护组合和真实入口 E2E / 截图；也不能替代地狱蝙蝠的非法目标提示 UI、物理伤害减免/死亡保护、作祟地图限制、更多门位/连接边界组合和真实入口 E2E / 截图；也不能替代神秘液体的属性上下限、死亡保护和固定骰重掷组合，或摇曳灯光 / 佳馔满桌的速度上限、伤害减免 / 死亡保护、祝福与重掷 / 替代组合。 |
| 轮到约拿了物品选择 / 拒绝精神伤害 UI | Board 组件代表链证明非武器物品筛选、确认派发和拒绝精神伤害确认步骤可见：只显示地图、排除砍刀、未选确认禁用、选择地图后提交 `cardId=map`，拒绝“不弃置物品”后显示“受到 1 颗骰子的精神伤害”。 | 不证明无非武器物品时的 UI、已用 / 不可交易限制、弃置终点可见性、精神伤害减免、死亡保护或真实入口 E2E / 截图。 |
| 上古旧宅属性 / 目标 / 通用伤害 UI | Board 组件代表链证明属性选择、目标房间和通用伤害分配可见：选择力量后展示地面目标房间，点击门厅后进入通用伤害分配，选择力量后显示“力量检定”“放置到门厅”和“通用伤害 1（力量）”。 | 不证明上层成功 UI、地下室精神伤害 UI、非法目标提示 UI、通用/精神伤害减免、死亡保护、更多楼层 / 作祟地图组合或真实入口 E2E / 截图。 |
| 肉质苔癣可选吸入 / 任选属性 / 精神伤害 UI | Board 组件代表链证明可选拒绝路径、成功任选属性确认步骤和失败精神伤害确认步骤可见：拒绝后显示“无事发生”；接受后展示 2 骰骰盘，总点数 4 时选择知识并显示“知识 +1”，总点数 0 时显示“受到一颗骰子的精神伤害”和“受到 1 颗骰子的精神伤害”。 | 不证明精神伤害减免 / 死亡保护、属性上限、更多属性选择、兔脚 UI / 更多重掷组合或真实入口 E2E / 截图。 |
| 脑状食品选择属性 / 通用伤害 UI | Board 组件代表链证明高分奖励分支可选择速度并显示“速度 +1”，低分通用伤害 2 可选择力量 / 知识或重复分配到同一属性轨并显示扣减预览。 | 不证明成功力量 UI、属性上下限、直接属性降低致死 / 死亡保护组合、通用伤害死亡保护 / 减免 / 胸针组合、兔脚 UI / 更多重掷组合或真实入口 E2E / 截图。 |
| 吊死鬼全属性检定 / 奖励属性 UI | Board 组件代表链证明待选事件面板可见“四项属性检定”，全通过后可选择知识并显示“知识 +1”；领域链证明混合成功 / 失败时扣减对应失败属性，全部通过后待选奖励属性，灰尘中全失败扣到骷髅会触发头骨死亡保护。 | 不证明失败属性降低 UI、更多奖励属性选择、属性上下限、直接属性降低致死 / 死亡保护组合、兔脚 UI / 更多重掷组合或真实入口 E2E / 截图。 |
| 一条秘密通道标志物 / 第二目标板块 UI | Board 组件代表链证明待选事件面板可见第二目标房间候选，点击门厅后显示当前板块和门厅均放置秘密通道标志物并显示“知识 +1”；领域链证明 5+ / 3-4 / 0-2 三档、非法目标拒绝、发现确认前禁止移动和灰尘中神志 -1 触发头骨死亡保护。 | 不证明非法原因 UI、更多目标范围、秘密通道标志物移动入口真实可用性、属性上下限、直接神志降低致死 / 死亡保护组合、兔脚 UI / 更多重掷组合或真实入口 E2E / 截图。 |
| 不可能的房间神志检定 / 抽物品 / 精神伤害 UI | Board 组件代表链证明事件房间翻牌后可见不可能的房间卡面、神志检定骰盘、成功分支抽物品结果和失败精神伤害反馈；领域链证明 4+ 抽物品和 0-3 骰子精神伤害。 | 不证明物品牌堆耗尽、精神伤害减免、死亡保护、更多伤害消费者组合或真实入口 E2E / 截图。 |
| 游魂物品 / 任意属性选择 UI | Board 组件代表链证明待选事件面板可见当前探索者物品候选和四项奖励属性候选，确认按钮需要物品与属性都已选中，选择地图 + 知识后派发 `RESOLVE_EVENT_CHOICE cardId=map trait=knowledge`；领域链证明接受分支埋葽物品并属性 +1、拒绝分支 4+ 抽物品、0-3 通用伤害。 | 不证明无物品 UI、拒绝成功抽物品 UI、拒绝失败通用伤害 UI、物品牌堆耗尽、通用伤害死亡保护或真实入口 E2E / 截图。 |
| 怪异的镜子 | 7 号作祟关键领域链有代表证据。 | 不证明完整作祟、专属 UI、镜中怪物目标选择、秘密阅读和 E2E 截图闭合。 |
| 最近投骰回滚 | 兔脚、恐怖玩偶等能回写部分事件检定或固定骰事件分支。 | 新增骰子消费者必须逐项确认是否允许重掷，不能默认所有事件骰都可重掷。 |

## 命中 D 维度

| 维度 | 本文件中的命中点 |
| --- | --- |
| D1 语义保真 | 事件效果不能只按配置数量判通过；每张事件的伤害类型、目标房间、属性变化、可选/强制分支需要逐项对照。 |
| D3 数据流闭环 | `scenarioConfig.ts` 定义、`game.ts` 解释器、`Board.tsx` 承接、测试和 evidence 必须闭环；当前多张事件仍停在领域或代表 UI。 |
| D5 交互完整 | 选属性、选物品、选房间、通用伤害、跳过/确认都需要真实 UI；当前只有通用面板和代表链。 |
| D8 时序正确 | 翻牌确认队列、事件投骰、最近投骰回滚、待选择事件和后续结算必须按顺序收口。 |
| D12 写入-消耗对称 | 事件写入的伤害、属性变化、祝福、目标移动、待选择状态必须被 reducer、UI 和回滚链读取同一份状态。 |
| D15 UI 状态同步 | Board 面板展示的候选、已选属性/物品/房间和确认按钮必须与领域合法性一致；当前需继续补逐事件 UI。 |
| D18 否定路径 | 非法房间目标、拒绝可选效果、无可弃物品、死亡保护失败和跳过作祟需要逐项负向断言。 |
| D35/D36 延迟交互 | 待选择事件、翻牌确认队列、镜中提示、最近投骰回滚都需要上下文快照和最终消费证明。 |
| D55 多消费者一致性 | 房间目标合法性、重掷准入、死亡保护、作祟特例同时被领域、UI、最近投骰和作祟系统消费，不能只打一层。 |

## 共享根因与残余范围

共享根因：旧矩阵容易把“事件进入运行池 / atlas 有图 / 能产生一个待选择状态 / 有一条代表领域测试”混成“事件牌效果完成”。事件牌尤其容易被通用 `UseEffectProfile` 解释器掩盖独有消费者：伤害类型、死亡保护、房间目标、可选拒绝、作祟特例、重掷回滚、祝福加骰、埋葬/弃置物品和脚注/音频都不能从代表链外推。

残余范围：

- 20 张新增/复杂事件已有领域和 Board 代表链；仍需逐张补真实入口 E2E、截图和组合测试。
- 43 张事件缺逐事件真实入口 E2E 和截图链；当前 Board 测试只是通用/代表组件证据。
- 所有造成伤害或直接降属性的事件仍需补死亡保护、胸针、盔甲、头戴耳机、奇异护符、头骨、兔脚组合矩阵。
- 房间目标类事件仍需补真实地图候选、非法目标 UI 提示、作祟地图限制和新房间/已发现房间边界。
- 事件投骰类仍需补最近投骰回滚、祝福、手电筒、书本、天使之羽、兔脚、恐怖玩偶、幸运硬币的准入矩阵。
- 怪异的镜子仍是 7 号作祟代表链状态，不是完整作祟实现完成。

## 同类扩审记录

| 项 | 本轮实际范围 |
| --- | --- |
| 搜索范围 | `full-deck-data-intake-contract.md`、`object-l0-l4-matrix.md`、`scenarioConfig.ts`、`game.ts`、`Board.tsx`、`firstScenarioRuntime.test.ts`、`Board.foundation.test.tsx` |
| 根因关键词 | `events`、`eventEffectNeedsPendingEventChoice`、`RESOLVE_EVENT_CHOICE`、`pendingEventChoice`、`pendingCardResolutionQueue`、`betrayal-event-choice-panel`、`新增配置事件`、`房间目标合法性`、`怪异的镜子` |
| 横向搜索命中 | 事件池 43 张、20 张新增/复杂事件配置、通用事件解释器、Board 通用事件选择面板、领域分支测试和代表 UI 测试均存在；逐事件 UI/E2E/截图和组合测试仍未逐项闭合。 |
| 当前裁定 | 事件剩余分支已从 P0 实现阻塞候选降为 P1 验证层级缺口；不需要倒退到图包/录入。但当前只能给 `broad-domain-and-board-representative-verified / downstream-open`，不能给完成口径。 |

## 修订记录

| 项 | 结论 |
| --- | --- |
| 旧矩阵风险 | `object-l0-l4-matrix.md` 与总合同中对事件牌使用了 `partial`、`min-verified`、`representative` 等混合口径，容易被误读成“43 张事件都已经完成”。 |
| 本轮修订 | 本文件把 43 张事件按旧 23 张和 20 张新增/复杂事件分账，并明确数量/atlas、领域代表链、Board 代表链和逐事件 UI/E2E 是四个不同层级；当前续跑已把生成器和总矩阵中的旧 E2E 过度口径改为 `event-effect downstream-open`。 |
| 事件剩余分支 P0 复核 | `firstScenarioRuntime.test.ts -t "新增配置事件\|不可能的房间\|地狱蝙蝠\|断手\|怪异的镜子\|花团锦簇\|晦暗暴风夜\|技术难点\|佳馔满桌\|禁忌知识\|可怜的尤里克\|轮到约拿了\|秘密升降机\|神秘液体\|无线电广播\|摇曳灯光\|一罐器官\|一声呼救\|着火的人\|游魂\|脑状食品\|吊死鬼\|一条秘密通道\|肉质苔癣\|上古旧宅"` 46 passed / 652 skipped；`Board.foundation.test.tsx -t "事件\|不可能的房间\|地狱蝙蝠\|断手\|花团锦簇\|晦暗暴风夜\|技术难点\|佳馔满桌\|禁忌知识\|可怜的尤里克\|轮到约拿了\|秘密升降机\|神秘液体\|无线电广播\|摇曳灯光\|一罐器官\|一声呼救\|着火的人\|游魂\|脑状食品\|吊死鬼\|一条秘密通道\|肉质苔癣\|上古旧宅"` 34 passed / 143 skipped，退出码 0。Board 测试夹具补充把事件牌用例的下一张探索房间固定为事件符号房，属于测试真相源修正，不是规则实现本体修改。 |
| 事件效果模式全集静态复核 | 2026-07-31 临时 `npx tsx -` 矩阵脚本直接导入 `BETRAYAL_DISCOVERY_POOLS.events` 后递归收集所有子效果，得到 43 张事件实际使用 26 类效果模式；对照 `game.ts` 中 `applyEventEffect`、`materializeEventEffect`、`RESOLVE_EVENT_CHOICE` 和相关校验后，`noApplyMention=[]`。脚本同时显示 20 张事件未被真实 E2E 文件按中文名直接命中，这被归类为 P1 真实入口 / 截图补证，不是 P0 reducer 消费缺失。 |
| 神秘液体 UI 投骰缺口修订 | 旧结论“UI 投骰承接未闭合”已被 `Board.foundation.test.tsx:7171` 替代：当前可见卡面、拒绝按钮、喝下按钮、固定 3 骰骰盘、总点数和分支结果；新结论降级为 Board 组件代表链已补，仍不外推真实入口 E2E / 截图、属性上下限、死亡保护和固定骰重掷组合。 |
| 摇曳灯光选择属性 UI 缺口修订 | 旧结论“选择属性 UI 未闭合”已被 `Board.foundation.test.tsx:7235` 替代：当前可见卡面、速度/力量 chip，点击速度后进入摇曳灯光属性检定结果，展示骰盘、总点数 8 和速度 +1；新结论降级为 Board 组件代表链已补，仍不外推真实入口 E2E / 截图、速度上限、祝福与重掷/替代组合、物理伤害减免和死亡保护。 |
| 佳馔满桌选择属性 / 速度提升 / 通用伤害 UI 缺口修订 | 旧结论“选择属性 UI 只到代表链 / UI 承接未闭合”已被 `Board.foundation.test.tsx:7398` 细化：当前可见卡面、知识/神志 chip，点击知识并选择伤害备选属性后，总点数 8 时展示“速度 +1”，总点数 0 时进入通用伤害分配，选择力量后展示“通用伤害 1（力量）”；新结论降级为 Board 组件代表链已补成功速度 +1 UI 与失败通用伤害 UI，仍不外推真实入口 E2E / 截图、速度上限、祝福与重掷/替代组合、死亡保护。 |
| 禁忌知识神志检定 UI 缺口修订 | 旧通用 UI 缺口已被 `Board.foundation.test.tsx:6571` 细化：当前从事件符号房间翻出禁忌知识后可见卡面、4 骰神志检定、总点数 2、2-3 分支详情和“知识 +1 / 神志 -1”确认步骤；同一用例还补充总点数 0 时的 0-1 分支“受到两颗骰子的精神伤害”和“受到 2 颗骰子的精神伤害”确认步骤。新结论降级为 Board 组件代表链已补 2-3 分支 UI 与 0-1 双骰精神伤害 UI，仍不外推真实入口 E2E / 截图、属性上下限、直接属性降低致死、死亡保护、精神伤害减免和重掷/替代组合。 |
| 可怜的尤里克神志检定 UI 缺口修订 | 旧通用 UI 缺口已被 `Board.foundation.test.tsx:6616` 细化：当前从事件符号房间翻出可怜的尤里克后可见卡面、4 骰神志检定、总点数 8 时展示 4+ 分支详情和“知识 +1”，总点数 0 时展示 0-3 分支“受到 1 点精神伤害”；新结论降级为 Board 组件代表链已补成功 / 失败分支 UI，仍不外推真实入口 E2E / 截图、知识上限、精神伤害减免、死亡保护和重掷/替代组合。 |
| 着火的人神志检定 / 移动 / 双伤害 UI 缺口修订 | 旧通用 UI 缺口已被 `Board.foundation.test.tsx:6701` 细化：当前从事件符号房间翻出着火的人后可见卡面、4 骰神志检定、总点数 2、2-3 分支“放置到入口大厅”和当前探险者位置更新；同一用例追加总点数 0 时的 0-1 分支“受到一颗骰子的物理伤害和一颗骰子的精神伤害”、物理伤害骰反馈和精神伤害骰反馈。新结论降级为 Board 组件代表链已补 2-3 移动分支 UI 与 0-1 双伤害反馈 UI，仍不外推真实入口 E2E / 截图、双伤害分配顺序、减伤 / 胸针 / 盔甲 / 头戴耳机 / 死亡保护组合。 |
| 无线电广播固定 2 骰 / 精神伤害 UI 缺口修订 | 旧通用 UI 缺口已被 `Board.foundation.test.tsx:6746` 细化：当前从事件符号房间翻出无线电广播后可见卡面、固定 2 骰骰盘、总点数 4 时展示 3-4 分支详情和“知识 +1”确认步骤，总点数 0 时展示 0-2 分支“受到一颗骰子的精神伤害”和“受到 1 颗骰子的精神伤害”；新结论降级为 Board 组件代表链已补规则结算成功分支和失败精神伤害 UI，仍不外推真实入口 E2E / 截图、脚注展示、音频资源、精神伤害减免/死亡保护和固定骰/重掷准入边界。 |
| 游魂物品 / 任意属性选择 UI 缺口修订 | 旧结论“任意属性选择、埋葽物品 UI 未闭合”已被 `Board.foundation.test.tsx:7437` 细化：当前待选事件面板可见候选物品、四项奖励属性和双选择确认门禁，并能派发 `cardId=map / trait=knowledge`；新结论降级为 Board 组件代表链已补接受分支 UI，仍不外推无物品 UI、抽物品 UI、通用伤害/死亡保护、真实入口 E2E / 截图。 |
| 不可能的房间抽物品 / 精神伤害 UI 缺口修订 | 旧通用 UI 缺口已被 `Board.foundation.test.tsx:6414` 细化：当前可见卡面、神志检定骰盘、成功抽物品进入持有区和失败精神伤害反馈；新结论降级为 Board 组件代表链已补成功 / 失败分支 UI，仍不外推物品牌堆耗尽、精神伤害减免 / 死亡保护和真实入口 E2E / 截图。 |
| 一罐器官神志检定 / 抽物品 / 属性降低 UI 缺口修订 | 旧成功抽物品页面缺口已被 `Board.foundation.test.tsx:6830` 细化：当前从事件符号房间翻出一罐器官后可见卡面、4 骰神志检定、总点数 8 时展示“抽取一张物品卡”并把魔法相机加入持有区，总点数 0 时展示“失去 1 点力量”和“力量 -1”确认步骤；新结论降级为 Board 组件代表链已补成功抽物品与失败属性降低分支 UI，仍不外推真实入口 E2E / 截图、物品牌堆耗尽、属性下限、直接属性降低致死和死亡保护。 |
| 一声呼救知识检定 / 同区域目标 / 精神伤害 UI 缺口修订 | 旧结论“目标房间 UI 未闭合”已被 `Board.foundation.test.tsx:6917` 细化：当前从事件符号房间翻出一声呼救后可见卡面、4 骰知识检定、总点数 8、4+ 分支详情、同区域已发现房间候选高亮、不同区域候选不显示，点击门厅后可见当前位置更新和“放置到门厅”确认步骤；同一用例已追加总点数 0 时的 0-3 分支“受到 1 点精神伤害”确认步骤。新结论降级为 Board 组件代表链已补成功目标选择分支 UI 与失败精神伤害 UI，仍不外推真实入口 E2E / 截图、非法原因 UI、精神伤害减免 / 死亡保护和更多区域边界组合。 |
| 花团锦簇地面 / 地下室 / 温室目标 UI 缺口修订 | 旧结论“楼层/温室目标 UI、通用伤害分配未闭合”已被 `Board.foundation.test.tsx:6978` 细化：当前待选事件面板显示花团锦簇卡面，普通分支可见地面 / 地下室候选且不显示上层候选，温室分支强制只显示温室，点击目标后进入通用伤害分配，选择力量后可见当前位置更新和放置目标反馈；新结论降级为 Board 组件代表链已补目标选择 + 通用伤害分配代表路径，仍不外推真实入口 E2E / 截图、非法原因 UI、通用伤害死亡保护和更多温室 / 楼层 / 死亡保护组合。 |
| 地狱蝙蝠速度检定 / 相邻目标 / 物理伤害 UI 缺口修订 | 旧的目标选择展示和失败伤害反馈残缺口径已被 `Board.foundation.test.tsx:7422` 细化：当前从事件符号房间翻出地狱蝙蝠后可见卡面、4 骰速度检定、总点数 8、4+ 分支详情、相邻已发现房间候选高亮、非相邻 / 跨楼层候选不显示，点击门厅后可见当前位置更新和“放置到门厅”确认步骤；同一用例还覆盖总点数 0 时的 0-3 分支“受到 1 点物理伤害”确认步骤。新结论降级为 Board 组件代表链已补成功目标选择分支 UI 与失败物理伤害 UI，仍不外推真实入口 E2E / 截图、非法目标提示 UI、物理伤害减免 / 死亡保护、作祟地图限制和更多门位 / 连接边界组合。 |
| 秘密升降机不同区域目标 UI 缺口修订 | 旧结论“UI 候选展示未闭合 / 未证明候选 UI”已被 `Board.foundation.test.tsx:7782` 细化：当前待选事件面板显示秘密升降机，当前区域 / 同区域候选不显示，切换到上层后显示上层起始点，切换到地下室后显示地下室起始点，点击地下室起始点会提交 `targetRoomId=basement-landing`；新结论降级为 Board 组件代表链已补不同区域已发现候选 UI，仍不外推真实入口 E2E / 截图、非法原因 UI、作祟地图限制、更多区域 / 楼层 / 未发现组合和移动后续反馈。 |
| 轮到约拿了物品选择 / 拒绝精神伤害 UI 缺口修订 | 旧结论曾把“UI 选择承接”和“拒绝伤害确认”一起列为未补；现已被 `Board.foundation.test.tsx:7583` 细化：当前待选事件面板显示轮到约拿了，候选只展示非武器物品「地图」、排除武器「砍刀」、未选确认禁用，选择地图后派发 `RESOLVE_EVENT_CHOICE cardId=map`；拒绝“不弃置物品”后面板关闭，并显示“受到 1 颗骰子的精神伤害”。新结论降级为 Board 组件代表链已补非武器候选、确认派发和拒绝精神伤害确认步骤，仍不外推无非武器物品 UI、已用 / 不可交易限制、弃置终点可见性、精神伤害减免 / 死亡保护或真实入口 E2E / 截图。 |
| 上古旧宅属性 / 目标 / 通用伤害 UI 缺口修订 | 旧结论“旧 23 张事件只在 family 代表链里，未单列上古旧宅属性 / 目标 / 通用伤害 UI”已被 `Board.foundation.test.tsx:7084` 细化：当前待选事件面板显示上古旧宅，力量属性选择后隐藏待选面板并展示地面目标房间，点击门厅后进入通用伤害分配，选择力量后显示“力量检定”“放置到门厅”和“通用伤害 1（力量）”；新结论降级为 Board 组件代表链已补地面力量分支，仍不外推上层成功 UI、地下室精神伤害 UI、非法目标提示 UI、通用/精神伤害减免、死亡保护、更多楼层 / 作祟地图组合或真实入口 E2E / 截图。 |
| 肉质苔癣可选吸入 / 任选属性 / 精神伤害 UI 缺口修订 | 旧结论“旧 23 张事件只在 family 代表链里，未单列肉质苔癣可选吸入 / 任选属性 UI”已被 `Board.foundation.test.tsx:7143` 和 `Board.foundation.test.tsx:7717` 细化：当前可见拒绝路径“无事发生”，也可确认吸入后展示 2 骰骰盘；总点数 4 时选择知识后显示“知识 +1”，总点数 0 时显示“受到一颗骰子的精神伤害”和“受到 1 颗骰子的精神伤害”。新结论降级为 Board 组件代表链已补拒绝、成功任选属性和失败精神伤害分支，仍不外推精神伤害减免 / 死亡保护、属性上限、更多属性选择、兔脚 UI / 更多重掷组合或真实入口 E2E / 截图。 |
| 脑状食品选择属性 / 通用伤害 UI 缺口修订 | 旧结论“脑状食品只在旧 23 张 family 代表链里，未单列力量检定三档、属性选择和通用伤害 UI”已被 `firstScenarioRuntime.test.ts:17224` 和 `Board.foundation.test.tsx:7824` 细化：当前领域链覆盖 5+ 任选力量 / 速度、1-4 速度 +1 且神志 -1、0 通用伤害 2、头骨死亡保护和兔脚回滚相邻链；Board 组件代表链覆盖速度奖励、力量 / 知识通用伤害分配和同属性重复分配预览；新结论降级为 Board 组件代表链已补高分 / 低分代表路径，仍不外推成功力量 UI、属性上下限、直接属性降低致死、死亡保护、减免 / 胸针、兔脚 UI / 更多重掷组合或真实入口 E2E / 截图。 |
| 吊死鬼全属性检定 / 奖励属性 UI 缺口修订 | 旧结论“吊死鬼只在旧 23 张 family 代表链里，未单列全属性连续检定、失败属性降低和全通过奖励属性 UI”已被 `firstScenarioRuntime.test.ts:17627`、`firstScenarioRuntime.test.ts:12894` 和 `Board.foundation.test.tsx:7690` 细化：当前领域链覆盖四项属性检定、失败属性各 -1、全通过后知识 +1 和灰尘中全失败死亡保护；Board 组件代表链覆盖四项属性检定说明、奖励属性选择和“知识 +1”反馈；新结论降级为 Board 组件代表链已补全通过奖励代表路径，仍不外推失败属性降低 UI、更多奖励属性、属性上下限、死亡保护 / 头骨 / 兔脚组合或真实入口 E2E / 截图。 |
| 一条秘密通道标志物 / 第二目标板块 UI 缺口修订 | 旧结论“一条秘密通道只在旧 23 张 family 代表链里，未单列秘密通道标志物、第二目标板块、直接神志降低和发现确认收口”已被 `firstScenarioRuntime.test.ts:17730`、`firstScenarioRuntime.test.ts:12429` 和 `Board.foundation.test.tsx:7736` 细化：当前领域链覆盖 5+ / 3-4 / 0-2 三档、非法目标拒绝、发现确认前禁止移动、神志 -1 触发头骨死亡保护；Board 组件代表链覆盖第二目标房间候选、目标点击、两个秘密通道标志物和“知识 +1”反馈；新结论降级为 Board 组件代表链已补第二目标代表路径，仍不外推非法原因 UI、更多目标范围、秘密通道标志物移动入口真实可用性、属性上下限、死亡保护 / 头骨 / 兔脚组合或真实入口 E2E / 截图。 |
| 晦暗暴风夜知识检定 / 神志提升 / 精神伤害 UI 缺口修订 | 旧结论“UI/日志未闭合”已被 `Board.foundation.test.tsx:6571` 细化：当前事件房间翻出晦暗暴风夜后可见知识检定骰盘，总点数 8 时显示“获得 1 点神志”和“神志 +1”，总点数 0 时显示“受到 1 点精神伤害”。新结论降级为 Board 组件代表链已补成功神志提升和失败精神伤害反馈，仍不外推神志上限、精神伤害减免 / 死亡保护、重掷组合、真实入口 E2E 或截图。 |
| 技术难点楼层起始点 / 地下室精神伤害 UI 缺口修订 | 旧结论“楼层起始点 UI、地下室/未发现楼层边界、精神伤害组合未闭合”已被 `Board.foundation.test.tsx:6643` 细化：当前从地面层事件房间翻出技术难点后会显示“放置到下一楼层起始点”并把探索者放到地下室起始点；从地下室事件房间翻出后会把探索者放到上层起始点，并在发现详情与确认步骤显示“受到 1 点精神伤害”。新结论降级为 Board 组件代表链已补确定性放置与地下室 fallback 伤害反馈，仍不外推更多楼层边界、精神伤害减免 / 死亡保护组合、真实入口 E2E 或截图。 |
| 当前状态 | `event-effect-matrix-indexed / broad-domain-and-board-representative-verified / downstream-open`，P0 实现消费候选已降级；不是完成。 |
