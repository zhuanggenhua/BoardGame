# 山屋惊魂全规则交互重设计账本

> 目的：按规则逐条重拆 `betrayal`，保证后续实现不是从现有代码倒推规则，而是从规则细节落到玩家交互、状态真相、命令 / 事件、UI 承接和验证证据。
> 当前状态：design ledger。本文不直接实施代码。

## 0. 真相源与完成口径

### 0.1 本轮锁定

- 问题对象：`betrayal` 全基础规则交互重设计，不是只修用户点名的剧本卡、属性轨、作祟风险条或房间朝向。
- 真相来源：
  - 主真相源：`src/games/betrayal/rule/山屋惊魂小黑屋第三版规则汉化整理.md`。
  - 对照源：`docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md`。
  - 作祟书来源：`docs/games/betrayal/sources/official/betrayal-3e-secrets-of-survival-en.md`、`docs/games/betrayal/sources/official/betrayal-3e-traitors-tome-en.md`。
- 目标入口 / 环境：当前工作区 `D:\gongzuo\webgame\BoardGame`，后续实现仍以联机对局页面和项目测试入口为准。
- 验收口径：每条规则细节必须进入本账本或其子账本；未覆盖项不得被称为完成。

### 0.2 状态定义

| 状态 | 含义 |
| --- | --- |
| `design-ready` | 规则细节已能进入实现拆分 |
| `needs-breakdown` | 已确认是规则，但仍需拆到更细的交互 / 状态 |
| `source-blocked` | 需要回到原 PDF、牌面、剧本书或素材核对 |
| `representative-only` | 只允许作为代表链，不能宣称完整规则 |
| `implemented-needs-remodel` | 已有部分实现或代表链，但仍需继续重构到完整规则合同 |
| `implemented-verified` | 已有领域 / UI / 真实入口 E2E / 截图核验 / 服务器相册证据，只证明该行声明的范围 |
| `contract-ready` | 合同字段和来源已进入账本，可进入实现；不代表功能完成 |
| `out-of-scope-approved` | 明确经用户批准不纳入当前实现 |

### 0.3 不漏细节的硬门槛

- 基础规则书 1-30 节必须全部有映射行。
- 官方英文对照中补出的基础细节必须进账本，例如治疗回绿色起始值、最后一张预兆自动作祟、每回合交易一次、每个特殊行动各一次、刚获得的物品 / 预兆不能立刻执行特殊行动、攻击一次 / 回合、尸体搜刮、障碍物离开耗 2 点移动力。
- 50 个作祟不能用 1/3/12/33 的代表链冒充完整。每个作祟必须有独立子账本：识别、公开介绍、双方设置、目标、特殊规则、特殊行动、指示物、重要地点、怪物盒、胜利文本、失败 / 死亡 / 边界。
- 50 个作祟的目录级索引见 `docs/games/betrayal/haunt-redesign-index.md`；官方源段页码和子账本门禁见 `docs/games/betrayal/haunt-contract-ledger.md`。这两份文档只证明进入追踪和来源已定位，不证明具体作祟完成。
- 中文 OCR 整理版不是逐字录入源；凡涉及牌面或剧本文案逐字展示，必须回原 PDF / 图片校对。

## 1. 全局交互架构

### 1.1 阶段流

| 阶段 | 玩家要做的事 | 状态真相 | UI 承接 | 验收出口 |
| --- | --- | --- | --- | --- |
| 设置 | 选择角色、初始化夹子、洗牌堆、放起始房间、选择剧本卡、确定首玩家 | `setup`, `scenario`, `deckOrders`, `roomTileStack`, `turnOrder` | 设置向导 + 剧本卡选择 + 角色选择 | setup 单测 + 页面进入对局 |
| 作祟前回合 | 移动、探索、交易、特殊行动、抽牌、作祟检定 | `phase=preHaunt`, `turn`, `movement`, `possessions`, `roomGraph`, `hauntRisk` | 开放式牌桌 + 短行动槽 + 对象本体高亮 | 移动 / 探索 / 卡牌 / 交易 / 特殊行动测试 |
| 作祟触发 | 根据剧本卡和预兆找作祟编号、叛徒、公开设置 | `hauntReveal`, `traitorPolicy`, `publicSetup`, `secretScopes` | 作祟揭示层 + 公开设置步骤 + 剧本书入口 | 作祟揭示单测 + 页面截图 |
| 作祟后回合 | 正常回合 + 作祟专属动作 / 胜负 / 怪物 / 障碍物 / 死亡 | `phase=haunt`, `teams`, `hauntRuntime`, `monsterTurns`, `victoryState` | 目标条 + 主动作槽 + 对象附近引导 | 每个作祟子账本对应 E2E |
| 终局 | 读取胜方 If You Win 文本，展示结局 | `sys.gameover`, `winningSide`, `endingTextId` | 终局页 + 剧本文本回看 | 胜负单测 + 终局页面测试 |

### 1.2 状态真相分层

- `catalog`：角色、属性轨、房间板块、卡牌、剧本卡、作祟定义、指示物、怪物模板。
- `setup`：本局候选剧本卡、选定剧本、牌堆顺序、房间堆顺序、首玩家。
- `core`：阶段、回合、探索者、属性轨位置、持有物、地图图结构、已用动作额度、当前作祟运行态。
- `sys.interaction`：等待玩家选择的临时交互，例如伤害分配、房间朝向、交易确认、武器声明、作祟设置选择。
- `read models`：当前属性值、预兆总数、可移动格、可交易对象、作祟风险条、可用特殊行动、合法攻击目标。
- `event stream`：掷骰结果、翻牌亮相、作祟揭示、受击反馈、结局文本。

### 1.3 UI 原则

- 玩家能在真实对象上直接选择时，必须点对象本体或贴合命中区：角色、房间门位、房间板块、持有卡、目标、尸体、怪物、武器。
- 主 UI 常驻文字只保留对象名、数值、短状态和按钮标签；完整规则正文进卡牌详情、剧本书、帮助层或一次性提示。
- 风险 / 进度类规则必须有可见承接：作祟风险条、计数轨、作祟目标条、怪物状态、死亡 / 尸体状态。
- 单候选不等于自动选。只要规则语义是玩家选择，就必须进入选择态，除非用户明确批准程序化。

## 2. 基础规则逐条覆盖矩阵

| 规则源 | 规则细节 | 交互设计 | 状态真相 | UI 承接 | 验证证据 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 0 文档索引 | 基础规则、叛徒秘籍、生存秘诀、扩展手册是不同真相源 | 建立来源类型和录入状态，禁止用基础规则覆盖作祟书 | `sourceRegistry` | 开发 / 审计文档，不进玩家主 UI | 来源清单测试 / 文档审计 | `design-ready` |
| 1 游戏目标 | 作祟前探索并增强；作祟后按阵营目标争胜 | 阶段模型必须区分 `preHaunt` 和 `haunt`，目标条随阶段切换 | `phase`, `objectiveSummary` | 顶部短目标条 | 阶段切换单测 | `design-ready` |
| 2 规则书结构 | 准备、配件、作祟前、作祟后、索引 | 设计和测试按同样分区组织，避免只测代表链 | `ruleCoverageSections` | 不进主 UI | 覆盖矩阵完整性检查 | `design-ready` |
| 3.1 剧本卡 | 开局团队翻阅五张剧本卡并选择一张；作祟时由剧本卡 + 预兆确定编号和叛徒 | 设置阶段必须有剧本卡候选、提议、确认和锁定流程 | `scenarioCandidates`, `scenarioId`, `triggerOmenId` | 剧本卡选择面板 | 候选池 / 锁定 / 非法选择测试 | `design-ready` |
| 3.2 作祟检定 | 抽预兆后按所有玩家已持有预兆总数掷骰，5+ 开始作祟，掷骰者为作祟揭秘者 | 作祟风险条 + 抽预兆后检定流程 | `omenCount`, `hauntRoll`, `hauntRevealerPlayerId` | 主 HUD 风险条 + 骰盘 | 多人预兆 / 阈值测试 | `design-ready` |
| 3.3 探索结束回合 | 探索并放置新房间，结算房间 / 卡牌后回合结束；可自愿结束 | 探索结算链完成后锁定“结束回合”动作 | `turnEndedByDiscovery`, `pendingDiscoveryResolution` | 行动槽短状态 | 探索成功 / 失败分支测试 | `design-ready` |
| 3.4 作祟开始公开介绍和设置 | 英雄、叛徒先公开读介绍和设置，再分开读秘密目标 | 作祟揭示层必须先执行公开步骤，秘密内容按阵营显示 | `publicIntroRead`, `publicSetupSteps`, `secretScopes` | 揭示层 + 剧本书 | 公开设置顺序测试 | `design-ready` |
| 4 配件 | 角色板、立牌、夹子、骰子、指示物、卡牌、房间、剧本卡、参考卡、作祟书 | 每类配件进入 `componentCatalog`，记录类型、资源、owner 范围、是否公开、是否可交互；参考卡和作祟书只进帮助 / 剧本书入口，不挤占主 UI | `componentCatalog`, `componentResourceState`, `componentOwnerScope` | 当前相关对象本体 + 帮助入口 | catalog 类型 / owner / 资源状态测试 | `design-ready` |
| 5.1 作祟书放一边 | 作祟书作祟后才用 | 作祟前剧本书入口只允许剧本卡；作祟书锁定 | `hauntBooksLockedUntilHaunt` | 剧本书入口禁用短提示 | 阶段权限测试 | `design-ready` |
| 5.2 选角色 | 玩家选择角色、角色面板、立牌、底座 | 角色选择必须锁定唯一角色和座位 | `players[].characterId`, `figureId` | 角色选择页 | 重复角色 / 座位测试 | `design-ready` |
| 5.3 属性夹子 | 四个夹子放绿色起始值 | 初始化属性轨位置，不初始化裸数值 | `traitTracks[trait].position` | 角色板属性轨 | 起始位置测试 | `design-ready` |
| 5.4 骰子 | 8 枚骰子全员可用 | 骰子池上限 8，掷骰动作按规则请求数量 | `dicePoolSize=8`, `rollRequests` | 骰盘 | 超过骰数 / 点数测试 | `design-ready` |
| 5.5 三类牌堆 | 事件、物品、预兆分类洗混面朝下 | 已补领域代表链：事件牌结算后掩埋回事件牌堆底部，牌堆数量不减少且不进入弃牌；物品 / 预兆获得后才离开对应牌堆；器械库展示出的非武器物品牌掩埋回物品牌堆底部；兔脚回滚事件效果时会恢复持有牌牌堆顺序快照；仍缺牌堆区可视化和完整逐步牌面确认 UI | `eventOrder`, `possessionOrderByKind`, `deckCounts`, `discardCounts`, `recentRoll.eventEffectSnapshot` | 牌堆区 / 翻牌详情 | 事件掩埋、器械库展示牌掩埋、兔脚回滚测试 | `implemented-needs-ui` |
| 5.6 参考卡 | 怪物参考卡、叛徒参考卡公开可见，玩家参考卡发给玩家 | 参考卡作为帮助层资源，不替代交互 | `referenceCards` | 参考卡按钮 / 帮助层 | 资源加载测试 | `design-ready` |
| 5.8 起始房间 | 三个起始板块置中，保留探索空间 | 起始地图图结构必须固定，未来房间从开放门位扩展 | `roomGraph`, `startingTiles` | 中央地图 | 起始拓扑测试 | `design-ready` |
| 5.9 房间堆 | 剩余房间洗混成堆 | 房间堆按区域和顺序建模，不能固定下一房间 | `roomTileStack`, `roomDiscoveryOrderByFloor` | 牌堆 / 探索状态 | 房间池测试 | `design-ready` |
| 5.10 起始位置 | 探索者放入口大厅 | 所有角色 figure 起点一致，除非剧本 / 效果改写 | `explorers[].tileId` | 角色 token | 初始位置测试 | `design-ready` |
| 5.11 剧本卡选择 | 团队翻阅五张选一张 | 见 3.1，不能单剧本冒充完整 | `scenarioCandidates`, `scenarioId` | 剧本选择面板 | 页面选择测试 | `design-ready` |
| 5.12 首玩家 | 按规则决定第一个玩家，顺时针轮流行动；作祟 setup 可指定叛徒左侧玩家先行动 | 首玩家规则 catalog 化，setup 首玩家、作祟后首玩家和作祟覆盖规则分开记录，不允许硬编码代表玩家 | `firstPlayerRule`, `turnOrder`, `hauntFirstPlayerOverride` | 设置摘要 + 作祟设置完成提示 | 首玩家 / 作祟首玩家覆盖测试 | `design-ready` |
| 6.1 房间板块区域 | 房间背面标明地下室 / 一楼 / 二楼；正面可能有事件 / 物品 / 预兆符号 | 房间 catalog 存区域、门位、符号、文字效果 | `roomTileCatalog`, `roomInstances` | 房间板块本体 | 房间数据完整性测试 | `design-ready` |
| 6.2 事件卡 | 朗读斜体文本，按指示，检定表只读匹配结果，完成后掩埋到底部 | 已补事件牌堆顺序语义：探索抽事件牌堆顶，结算后把该事件牌放回事件牌堆底部，`discardCounts.event` 保持 0；事件选择和兔脚重掷链路仍可复用该牌堆快照；仍需完整阻塞式事件牌逐步确认 UI | `eventOrder`, `latestDiscovery`, `pendingEventChoice`, `recentRoll.eventEffectSnapshot` | 翻牌亮相 + 当前结果 | 事件掩埋到底部测试 + 事件选择回归 | `implemented-needs-ui` |
| 6.3 物品卡 | 朗读，牌面朝上放自己面前，之后可用 / 交易 / 转移 | 物品 owner 进入持有区，效果注册到可用行动 / 被动修正 | `possessions[itemId]`, `ownerPlayerId` | 持有物区卡牌本体 | 获得 / 转移测试 | `design-ready` |
| 6.4 预兆卡 | 朗读，获得，立即作祟检定 | 预兆和物品一样 owner 化，但额外触发作祟检定 | `possessions[omenId]`, `hauntRollPending` | 持有区 + 风险条 + 骰盘 | 预兆抽取测试 | `design-ready` |
| 6.5 指示物 | 多数用于作祟，作用由作祟规则解释；每个作祟子账本必须声明 token 数量、owner、位置、可见性、拾取/交易/攻击/触发规则 | token 由基础 `tokenInstances` 承载，具体语义在 50 个作祟子账本中闭合，不能用通用 token 名代替作祟状态 | `tokenInstances`, `hauntRuntime.tokens[]` | 地图 / 角色 / 作祟目标条 | 每个作祟 token 合同字段机检 + 子账本测试 | `contract-ready` |
| 7 属性 | 力量、速度、知识、神志公开，用夹子记录 | 属性是轨道位置，不是裸数值；当前数值派生 | `traitTracks`, `currentTraits` | 角色板属性轨 | 轨道派生测试 | `design-ready` |
| 7 官方补充：提升 / 下降 | Gain/Lose 移动夹子一格，可能不改变数值；最高值不能再升 | trait event 必须按步移动并处理重复数字 | `TRAIT_STEP_CHANGED` | 轨道移动动画 | 非线性轨测试 | `design-ready` |
| 7 官方补充：治疗 | Heal trait 回到绿色起始值；已在或高于起始值则不降 | 治疗不是加 N，也不是回满最高 | `HEAL_TRAIT_TO_START` | 轨道预览 | 治疗边界测试 | `design-ready` |
| 7.1 临界 / 死亡 | 最低红值为临界；作祟前不会死；作祟后到骷髅死亡 | 死亡规则依赖阶段 | `criticalPosition`, `skullPosition`, `deathState` | 角色板红色警示 / 死亡反馈 | 作祟前后死亡测试 | `design-ready` |
| 8 伤害 | 物理分配力量 / 速度；精神分配知识 / 神志；一般由玩家选择属性 | 伤害分配必须玩家确认，不自动扣 | `DamageAllocationInteraction` | 伤害分配面板 + 轨道预览 | 分配合法性测试 | `design-ready` |
| 8 官方补充：按步扣 | 伤害降低的是属性轨步数，不是数值差 | 扣减事件使用 steps，不用 `value -= damage` | `TRAIT_STEP_CHANGED` | 轨道预览 | 重复数字伤害测试 | `design-ready` |
| 8 官方补充：临界分配限制 | 作祟前不能把伤害分到已临界属性，如果还有其他可降属性 | 伤害分配选项要动态禁用临界属性 | `allocationOptions` | 禁用原因短提示 | 临界属性分配测试 | `design-ready` |
| 9 骰子 | 8 枚骰子，每面 0/1/2，结果为点数和 | 骰子系统要记录每颗骰面和总和 | `diceRollResult` | 物理骰盘 / 结果条 | 骰值范围测试 | `design-ready` |
| 9.1 属性检定 | 按当前属性值掷骰，执行对应结果表 | 检定请求要记录属性、骰数、结果表分支 | `TraitRollRequest` | 骰盘 + 当前分支 | 检定分支测试 | `design-ready` |
| 9.2 作祟检定 | 按预兆总数掷骰，5+ 作祟，掷骰者为揭秘者 | 见 3.2；作祟检定不是属性检定 | `HauntRollRequest` | 风险条 + 骰盘 | 作祟检定不受属性修正测试 | `design-ready` |
| 9 官方补充：普通掷骰 | 效果可要求掷若干骰，这不是属性检定，不受只影响属性检定的效果 | roll 类型必须区分 trait / haunt / raw dice | `rollKind` | 骰盘标题短标签 | 修正适用性测试 | `design-ready` |
| 9.3 攻击检定 | 攻击者和防御者掷同一属性，低者按差值受伤；平局无伤 | 攻击 resolution 保存双方骰、属性、差值和伤害类型 | `AttackResolution` | 攻击面板 + 骰盘 | 攻击 / 平局测试 | `design-ready` |
| 10 作祟前回合 | 移动、探索、交易、特殊行动可任意顺序；探索结束回合 | 行动系统不能固定顺序；探索成功后终止剩余行动 | `turnActionState` | 行动槽 + 当前可点对象 | 行动任意顺序测试 | `design-ready` |
| 11.1 移动力 | 回合开始看速度；中途速度变化不改本回合移动力 | 回合开始写移动快照 | `turnStartSpeed`, `movesRemaining` | HUD 移动力 | 中途速度变化测试 | `design-ready` |
| 11.2 相邻 | 共享直连门位才相邻；特殊文字可声明相邻；假门不相邻 | 地图图结构必须表达门位和特殊边 | `roomConnections`, `specialAdjacency` | 地图门位高亮 | 相邻 / 假门测试 | `design-ready` |
| 11.3 强制移动 | 若效果写“最多移动 N”，执行移动的人决定移动多远，即使移动别人 | 面具代表链已由执行者给每个同房间目标指定去向；后续泛化成通用强制移动交互和路径预览 | `targetRoomIdsByTokenId`, `ForcedMoveInteraction` | 目标路径选择 | 面具强制移动 owner 测试 | `implemented-needs-remodel` |
| 12 探索入口 | 在有未探索走廊的房间上，可穿过该门探索 | 入口门位来自地图对象本体选择 | `entryDoorway` | 未探索门位高亮 | 门位点击测试 | `design-ready` |
| 12 区域匹配 | 翻房间堆顶；区域匹配才可翻开放置 | 已补统一房间堆翻找：区域不匹配板块记为掩埋并放回堆底，继续翻找当前区域；放置面板会提示本次已掩埋房间；真实入口截图已覆盖塔楼 / 储物间掩埋后继续翻到火炉房 | `roomDiscoveryDeck`, `RoomDrawResolution`, `buriedRoomTiles`, `latestRoomDrawResolution` | 放置面板短提示 | 区域不匹配掩埋领域测试 + 牌桌组件提示测试 + `evidence/betrayal-core-interactions/room-discovery-failures/e2e-test.md` | `implemented-verified` |
| 12 玩家放置方向 | 新房间任一走廊与当前未探索走廊相连即可，不要求所有门匹配 | 玩家选择连接边 / 朝向；自动旋转只能代表模式 | `orientation`, `connectedDoorways` | 房间预览旋转 / 确认 | 朝向选择测试 | `design-ready` |
| 12 放置角色 | 新房间放置后把探索者移动到新房间 | 探索成功事件同时移动探索者 | `explorer.tileId` | 角色 token 移动 | 探索移动测试 | `design-ready` |
| 12 房间文字 / 符号 | 先结算房间文字，再按符号抽事件 / 物品 / 预兆 | 已补两个领域代表链：书房 / 图书馆这类“发现时提升属性”的房间会先影响随后事件属性检定骰数，`ROOM_EXPLORED` 仍只落地一次房间文字；器械库先按房间文字展示物品牌直到武器，非武器展示牌掩埋回物品牌堆底部，再按物品符号另抽下一张物品牌，不能把两次抽牌合并；牌桌发现详情会合并显示器械库文字奖励、展示后掩埋和符号抽牌，避免房间文字奖励被后续抽牌淹没；后续仍需完整阻塞式结算队列和更多房间文字 / 符号组合 | `resolveCoreAfterRoomDiscoveryText`, `eventTraitCheck`, `roomDiscoveryCards`, `drawnCard`, `possessionOrderByKind` | 事件骰盘读取房间文字后的属性；发现详情合并显示房间文字奖励和符号抽牌 | 房间文字先于事件检定测试 + 器械库房间文字 / 物品符号分离 / 展示牌掩埋测试 + 器械库牌桌发现详情组件测试 + 探索结算相关回归 | `implemented-needs-remodel` |
| 12.1 区域耗尽 | 区域房间用完时不消耗移动，继续回合 | 已补对应楼层发现池为空时的安全守门：预览为空、命令拒绝、移动力和回合结束状态不变；牌桌选择未知门位时显示“{{楼层}}房间已耗尽”；真实入口 E2E、截图核验和服务器相册已回填 | `resolveRoomPlacementPreview`, `roomDiscoveryDeck`, `roomDiscoveryOrderByFloor`, `pendingRoomPlacementFailure` | 短提示 + 回到移动 | 耗尽领域测试 + 牌桌提示测试 + `evidence/betrayal-core-interactions/room-discovery-failures/e2e-test.md` | `implemented-verified` |
| 12.2 保持可探索 | 放置后所在区域必须仍有至少一个可通行走廊；唯一封死的板块掩埋重抽；若仍无法放置，最小调整已有板块 | 已补封死区域重抽：候选房间所有合法朝向都会封死当前区域、且后续仍有同区域房间时，记录 `sealedRegion` 掩埋并继续翻；若这是最后一张同区域房间且会封死区域，则房间放置面板列出最小调整候选，玩家选择已有板块的新位置 / 入口 / 朝向后才能确认放置；当前代表切片验证会移动一个已有同区域房间并保留开放走廊，不外推为所有现实桌面极端调整方案完成 | `RoomDrawResolution.buriedRoomTiles`, `RoomDrawResolution.requiresTileAdjustment`, `roomTileAdjustment`, `selectedRoomRequiresOpenFrontier`, `regionOpenDoorways`, `tileAdjustmentEvent` | 放置预览 + 调整候选 + 选中后确认 | 封死区域 / 最小调整领域测试 + 牌桌完整选择组件测试 + `evidence/betrayal-core-interactions/room-discovery-failures/e2e-test.md` | `implemented-verified` |
| 13 抽牌 | 带符号房间抽对应牌堆顶 | 已补领域抽牌顺序：事件从 `eventOrder[0]` 读取；物品 / 预兆从当前持有牌堆顶部读取，获得才移出牌堆；仍缺牌面逐张确认队列 | `cardDrawRequest`, `eventOrder`, `possessionOrderByKind` | 牌堆翻牌 | 抽牌顺序 / 掩埋回底测试 | `implemented-needs-ui` |
| 13.1 事件 | 事件完成后掩埋到底部；只读匹配结果 | 见 6.2；当前已验证事件牌回到底部且事件弃牌数不增加 | `eventOrder` | 事件翻牌 | 事件掩埋测试 | `implemented-needs-ui` |
| 13.2 物品 | 物品获得，后续可使用 / 交易 / 转移 | 见 6.3 | `possessions` | 持有物区 | 获得物品测试 | `design-ready` |
| 13.3 预兆 | 预兆获得并进行作祟检定；最后一张预兆自动开始作祟 | 抽最后预兆绕过 5+ 阈值直接进入作祟揭示 | `omenDeck.remaining`, `hauntAutoStartReason` | 风险条显示“最后预兆” | 最后一张预兆测试 | `design-ready` |
| 14 交易 | 每回合一次；同房间；双方同意；可任意数量 / 不等价 / 一方给或拿 | 交易是双方确认的多选交互 | `TradeAgreementInteraction`, `tradeUsedThisTurn` | 持有物多选 + 双方确认 | 交易 E2E | `design-ready` |
| 14 官方补充：交易限制 | 本回合已用特殊行动的物品 / 预兆不能交易；本回合用过攻击的武器不能交易 | 已补交易卡状态读模型，区分可交易、已用、狗作为交易来源、缺失持有物；后续统一牌面禁用提示 | `resolveBetrayalTradeCardStatus`, `usedCardIdsThisTurn` | 禁用原因短提示 | 交易限制测试 | `implemented-needs-remodel` |
| 15 特殊行动 | 标特殊行动符号；总是可选；每个可用特殊行动每回合一次；不能重复 | 持有物、神秘电梯房间效果和作祟特殊行动已补预算读模型；Board 作祟主动作已接入已用禁用原因；灰尘剧本“寻找解药”已用状态已补真实入口 E2E / 截图相册；仍需继续收口其它特殊行动真实入口预算证据 | `resolveBetrayalPossessionSpecialActionStatus`, `resolveBetrayalRoomSpecialActionStatus`, `resolveBetrayalHauntSpecialActionStatus`, `usedCardIdsThisTurn`, `usedRoomEffectIdsThisTurn` | 卡牌本体 / 房间效果 / 作祟主动作按钮 | 持有物、房间效果、作祟特殊行动预算单测 + 作祟按钮禁用组件测试 + `evidence/betrayal-core-interactions/haunt-special-action-budget/e2e-test.md` | `implemented-needs-remodel` |
| 15 官方补充：刚获得限制 | 不能用本回合开始时未持有的物品 / 预兆做特殊行动 | 持有物读模型已校验回合开始持有物快照 | `turnStartPossessionIds` | 禁用原因短提示 | 刚获得限制测试 | `implemented-needs-remodel` |
| 15 官方补充：非特殊被动 | 有些物品 / 预兆效果不是特殊行动，只要持有就生效 | 持有物效果已区分主动 / 被动；被动不从通用主动入口使用 | `effectKind` | 被动图标 / 无按钮 | 被动不可主动使用测试 | `implemented-needs-remodel` |
| 16 作祟流程 | 50 个作祟，各有英雄和叛徒版本；作祟由预兆触发 | 作祟定义必须按编号和双方版本建模；50 个子账本已分别覆盖公开/私密/setup/目标/行动/触发/token/怪物/UI/验证 | `hauntDefinitions`, `hauntRuntime`, `hauntContracts[1..50]` | 作祟揭示 / 剧本书 / 目标条 | 子账本必填字段机检 + 作祟目录测试 | `contract-ready` |
| 16 作祟定位 | 用开局剧本卡找到触发预兆对应编号和叛徒 | 剧本卡 + 预兆映射表必须覆盖全部组合；揭示层保存剧本卡、触发预兆、作祟编号、揭秘者、叛徒策略和双方书页 | `scenarioOmenHauntMap`, `hauntRevealerPlayerId`, `traitorResolver` | 作祟揭示层 | 映射完整性测试 + 50 个源段页码账本 | `contract-ready` |
| 17 作祟类型 | 无叛徒 / 一名叛徒 / 隐藏叛徒 / 自由混战 | 阵营模型支持合作、一对多、隐藏身份、自由混战 | `teamModel`, `hiddenRoleState` | 目标条和可攻击对象 | 四类型代表测试 | `design-ready` |
| 18 开始作祟 | 英雄介绍和设置 -> 叛徒介绍和设置 -> 分开读秘密目标 / 规则 | 作祟 setup 是有序队列，不能直接跳剧本书 | `hauntSetupQueue` | 公开揭示层 + 设置步骤 | 设置顺序测试 | `design-ready` |
| 18 官方补充：秘密信息 | 作祟书信息默认对另一方保密；但使用规则 / 特殊行动时对方可要求朗读相关段落 | 剧本书段落要有 visibility 和 reveal-on-use | `secretScopes`, `revealedHauntParagraphs` | 公开 / 私密分区 | 可见性测试 | `design-ready` |
| 19 攻击时机 | 作祟开始后可攻击同房间敌方探索者 / 怪物；每回合只能攻击一次 | 攻击动作只在作祟后开放，目标按阵营过滤 | `attackUsedThisTurn`, `teams` | 目标高亮 | 攻击时机测试 | `design-ready` |
| 19 攻击结算 | 默认力量攻击；高者赢；低者受差值伤害；平局无伤；知识 / 神志攻击造成精神伤害 | 攻击声明保存属性和伤害类型映射 | `attackTrait`, `damageType` | 攻击面板 / 骰盘 | 属性攻击测试 | `design-ready` |
| 19.1 武器 | 每次攻击最多一件；可选择不用；攻击后本回合不能交易；刚获得不能用；不能防御 | 武器声明 interaction 必须让玩家选“不使用 / 某一件合法武器” | `AttackDeclarationInteraction` | 武器选择面板 | 武器边界测试 | `design-ready` |
| 19.2 视线 | 同方向且不换区域可视线，中间可隔房间；房间内所有角色都在视线内 | 已补基础读模型，按同楼层 / 同一直线 / 连续已发现板块判断房间视线；远程武器领域校验代表链已接入通用英雄 / 叛徒目标范围，近战和徒手仍限同房间；牌桌目标高亮和视线线条代表链已接入当前选中武器的合法目标，弩可高亮并连线视线内非同房间叛徒；弩真实入口 E2E、截图核验和服务器相册已补证据；魔法相机幻影摄影师可攻击视线内英雄的代表链已补目标切换、视线线、骰盘、截图核验和服务器相册；仍需完整怪物系统、所有怪物视线攻击和真实远程牌面完整录入 | `lineOfSightGraph` / `resolveBetrayalLineOfSightRoomIds`, `rangedAttackWeaponIds`, `resolveBetrayalAttackTargetPlayerIds` | 目标高亮 / 视线线条 | 基础视线单测已覆盖，同楼层直线、跨楼层、未发现目标和中间断点；远程武器代表单测覆盖视线内可攻击、视线外不可攻击、近战 / 徒手不可跨房间；Board 组件测试覆盖弩选择后高亮并连线视线内非同房间叛徒；真实入口 E2E：`e2e/betrayal/non-p0-representative.e2e.ts "弩远程视线"`，1 passed；证据：`evidence/山屋惊魂-弩远程视线完整链路/e2e-test.md`；魔法相机幻影摄影师代表链真实入口 E2E：`e2e/betrayal/non-p0-representative.e2e.ts "幻影摄影师视线攻击"`，1 passed；证据：`evidence/山屋惊魂-幻影摄影师视线攻击完整链路/e2e-test.md` | `implemented-needs-remodel` |
| 官方补充：尸体搜刮 | 死者仍持有物品 / 预兆；同房间每回合可拿一个，不需同意 | 已补基础尸体搜刮代表链：死亡探索者保留为尸体对象，同房间存活探索者必须点选尸体和具体物品 / 预兆；同一尸体本回合拿 1 张后禁用二次搜刮；不外推为特殊作祟尸体用途或完整怪物尸体系统 | `LOOT_CORPSE`, `resolveCorpseLootTargets`, `corpseLootedByPlayerIdsThisTurn` | 尸体 token + 物品 / 预兆选择 | 领域定向测试、组件测试、`e2e/betrayal/first-scenario-corpse-loot.e2e.ts`、`evidence/betrayal-first-scenario-corpse-loot/betrayal-first-scenario-corpse-loot-e2e-test.md`、服务器相册 `http://8.148.71.102:18080/#/boardgame/betrayal-first-scenario-corpse-loot` | `implemented-verified` |
| 官方补充：障碍物 | 障碍物所在房间离开耗 2 移动力；作祟后敌对探索者 / 怪物也算障碍物 | 已补基础移动成本读模型：房间障碍标记、作祟后同房间敌对探索者、英雄同房间怪物都会把离开成本抬到 2；仍需路径预览和完整怪物阵营模型 | `movementCost` / `resolveBetrayalMoveCost`, `obstacles` | 路径预览显示耗费 | 房间标记 / 敌对探索者 / 怪物障碍物移动测试已覆盖 | `implemented-needs-remodel` |
| 20 作祟条目结构 | 识别、介绍设置、目标、指示物、重要地点、其他规则、If You Win、怪物盒 | 每个作祟录入必须按字段拆，不允许整段文本壳 | `HauntDefinition` | 剧本书分区 + 目标条 | 作祟 schema 测试 | `design-ready` |
| 20 怪物盒 | 怪物名、属性、特殊规则、特殊行动仅适用于该怪物 | 怪物 template 和 action list 归属作祟 | `monsterDefinitions` | 怪物卡 / token | 怪物定义测试 | `design-ready` |
| 21 进行作祟 | 仍按正常回合，使用新行动和目标；不再作祟检定；敌对方成为障碍物 | 作祟后复用基础回合，但加入目标、阵营、怪物、障碍物 | `hauntRuntime`, `teams`, `monsterTurns` | 目标条 + 主动作槽 | 作祟后回合测试 | `design-ready` |
| 22 计数轨 | 某些作祟用 0-9 计数轨记录时间 / 进度 / 力量等 | 计数轨是通用 haunt runtime primitive | `numberTracks[]` | 进度条 / 计数轨 | 计数轨测试 | `design-ready` |
| 23 寻找特定板块 | 可查看房间堆作为参考，必要时搜索，完成后重洗 | 搜索房间堆是显式作祟辅助流程，不当作作弊 | `tileStackSearch`, `reshuffleAfterSearch` | 搜索面板 / 自动重洗提示 | 搜索重洗测试 | `design-ready` |
| 24 叛徒选择 | 通常为作祟揭秘者；也可能最高 / 最低属性，平局从揭秘者最近的回合顺序判定；左侧叛徒排除揭秘者 | 叛徒选择 resolver 必须支持策略和 tie-break | `traitorResolver`, `turnOrderDistance` | 揭示层解释短原因 | 叛徒策略测试 | `design-ready` |
| 24 自愿替代叛徒 | 指定叛徒不愿意时可由其他玩家自愿，交换位置并传递触发卡 | 作祟揭示时进入 `TraitorVolunteerInteraction`：指定叛徒可接受 / 拒绝；拒绝后其他玩家可自愿；有志愿者则交换座位/位置并转移触发卡；无人自愿则按原指定叛徒继续或进入规则阻塞提示 | `traitorVolunteerInteraction`, `volunteerCandidates`, `triggerCardTransfer` | 揭示层确认弹窗 + 短原因 | 接受 / 拒绝 / 志愿者 / 无志愿者测试 | `design-ready` |
| 25 叛徒能力 | 可忽略伤害性房间效果；仍需掷神秘电梯 / 滑洗衣滑槽；可忽略事件符号，但若抽事件必须正常结算 | 叛徒权限改变房间 / 符号触发选项，不直接免全部房间文本 | `traitorPowers` | 房间效果是否触发选择 | 叛徒能力测试 | `design-ready` |
| 26 怪物属性 | 怪物通常固定属性，不升降 | 怪物属性不是 trait track | `monsterTraits` | 怪物卡 | 固定属性测试 | `design-ready` |
| 26 怪物受伤 | 通常受伤变击晕；回合开始若已击晕则翻正并结束该怪物回合；有些被杀死 / 不能击晕 | 怪物状态机支持 active / stunned / killed / cannotStun | `monsterStatus` | 怪物 token 翻面 | 击晕 / 杀死测试 | `design-ready` |
| 26 怪物移动 | 怪物回合开始按速度掷骰决定移动，至少 1；同类型怪物只掷一次，多类型各掷一次 | 怪物移动力是按类型 roll，不按每个 token roll | `monsterMovementRollByType` | 怪物行动提示 | 怪物移动测试 | `design-ready` |
| 26 怪物邻接 | 怪物可把地下室平台和一楼楼梯视为相邻 | 怪物有专属特殊相邻边 | `monsterSpecialAdjacency` | 路径预览 | 怪物楼梯测试 | `design-ready` |
| 26 怪物攻击 / 限制 | 默认力量攻击；可忽略伤害性房间；不能持有物品 / 预兆；不能探索新板块 | 怪物动作列表与探索者不同 | `monsterActionSet` | 怪物动作槽 | 怪物动作测试 | `design-ready` |
| 27 死亡 | 作祟后才会死亡；死亡时立牌倒在房间变尸体，持有物保留在角色板旁，可被搜刮 | 已验证基础搜尸代表链会保留尸体和持有物 owner，但完整死亡 UI、倒伏立牌表现、所有作祟死亡变体和特殊尸体用途仍需继续拆 | `deathState`, `corpseTileId`, `corpseInventory`, `corpseLootedByPlayerIdsThisTurn` | 倒伏角色 / 尸体 marker / 搜尸选择器 | 基础搜尸 E2E 已覆盖尸体可搜刮；完整死亡链仍需补测 | `implemented-needs-remodel` |
| 27 终局 | 首个达成作祟目标的阵营获胜，朗读该方 If You Win | 胜负由作祟目标 resolver 触发，终局文本按阵营显示 | `winningSide`, `endingTextId` | 终局页 | 胜利文本测试 | `design-ready` |
| 28 角色描述 | 背景用于代入，不直接改变基础规则；角色板属性才是规则数据 | 角色 lore 与规则属性分离 | `characterLore`, `traitTracks` | 角色详情页 | 角色 catalog 测试 | `design-ready` |
| 29 索引 | 移动、攻击、作祟、卡牌、房间、属性、伤害死亡、骰子、计数轨、掩埋 | 索引入口全部能回链到账本行 | `ruleIndexMap` | 帮助层搜索 | 覆盖检查 | `design-ready` |
| 30 录入口径 | 基础规则优先中文扫描；作祟书单独；扩展单独；素材回图片；英文只对照 | source policy 写入项目文档，代码注释不得反向覆盖规则 | `sourcePolicy` | 开发文档 | 文档审计 | `design-ready` |

## 3. 作祟剧本全量子账本规则

### 3.1 50 个作祟不允许代表冒充

当前已有部分代表链，但它们只能证明对应作祟局部流程。后续每个作祟必须建立独立文件或表格，建议落点：

`docs/games/betrayal/haunts/<haunt-number>-interaction-contract.md`

每个作祟子账本必须包含：

| 字段 | 必填内容 |
| --- | --- |
| 作祟识别 | 作祟编号、剧本卡、触发预兆、叛徒规则、英雄书 / 叛徒书定位 |
| 公开介绍 | 哪些介绍必须对所有玩家公开读，哪些只是风味 |
| 英雄设置 | 按顺序列出设置步骤、指示物、房间、角色变化 |
| 叛徒设置 | 按顺序列出设置步骤、指示物、怪物、叛徒属性变化 |
| 阵营 / 可见性 | 谁看什么、隐藏叛徒何时揭露、自由混战如何隐藏 / 公开 |
| 目标 | 双方或多方胜利条件，触发时机，平局 / 同时完成处理 |
| 特殊规则 | 持续规则、触发规则、房间规则、死亡规则、交易 / 移动限制 |
| 特殊行动 | 行动名称、使用者、条件、目标、骰子 / 检定、次数限制、结果 |
| 指示物 | token 类型、数量、owner、位置、状态、可移动 / 可拾取 / 可攻击 |
| 重要地点 | 需要搜索 / 放置 / 高亮的房间与区域 |
| 怪物盒 | 怪物属性、移动、攻击、受伤、特殊动作、行动顺序 |
| If You Win | 胜方文本来源和终局展示 |
| 验证 | 单测、页面测试、E2E、截图、未覆盖边界 |

### 3.2 当前已知作祟目录状态

目录级索引见 `docs/games/betrayal/haunt-redesign-index.md`，源段映射见 `docs/games/betrayal/haunt-contract-ledger.md`。当前 50 个作祟都已建立独立交互子账本；`source-mapped-contract-pending` 只保留为历史状态定义，不再作为本轮作祟行状态。

| 范围 | 当前状态 | 后续要求 |
| --- | --- | --- |
| 作祟 1 | 子账本已补齐；现有代表链只能作为实现差距参考 | 后续实现必须按子账本重验，不得只跑黄金路径 |
| 作祟 3 | 子账本已补齐；现有代表链只能作为实现差距参考 | 后续实现检查事件触发、目标和边界 |
| 作祟 12 | 子账本已补齐；现有代表链只能作为实现差距参考 | 后续实现检查奇异护符、巨魔手控制和自由混战 |
| 作祟 33 | 子账本已补齐；现有代表链只能作为实现差距参考 | 后续实现检查相机 / Essence / 叛徒口径 |
| 作祟 2-50 | 全部已有源段映射和独立子账本 | 后续逐条进入实现、测试和截图证据回填 |

## 4. 实施顺序重排

### 4.1 第一批：修基础规则骨架

1. 剧本卡候选和选择。
2. 属性轨 / 治疗 / 伤害按步。
3. 作祟风险条、最后预兆自动作祟。
4. 移动力快照、相邻 / 假门 / 特殊连接。
5. 房间探索、朝向、开放门位、区域不可封死。

### 4.2 第二批：修玩家行动与限制

1. 事件 / 物品 / 预兆卡通用 resolution。
2. 交易每回合一次、双方同意、已使用物品限制。
3. 特殊行动每来源一次、刚获得不可用、被动效果区分。
4. 攻击一次 / 回合、武器声明、视线、障碍物。
5. 死亡、尸体搜刮、终局文本。

### 4.3 第三批：修作祟系统

1. 作祟映射表覆盖所有剧本卡 + 预兆。
2. 作祟揭示公开步骤和秘密可见性。
3. 阵营模型支持四类作祟。
4. 怪物行动、击晕、移动和特殊能力。
5. 计数轨、特定房间搜索、叛徒选择策略。

### 4.4 第四批：逐作祟补齐

每个作祟按子账本执行，不能用“通用作祟系统已完成”替代具体剧本规则。

## 5. 实施前禁止项

- 禁止把当前 `first-scenario` 或少数代表作祟说成剧本卡系统已完整。
- 禁止把角色属性当作裸数值加减。
- 禁止忽略治疗回绿色起始值、伤害按步、临界分配限制。
- 禁止只在日志里表达作祟风险、最后预兆、计数轨或作祟目标。
- 禁止自动选择房间朝向、伤害分配、武器、交易对象或强制移动距离。
- 禁止遗漏交易每回合一次、特殊行动每来源一次、刚获得不可用、攻击一次 / 回合。
- 禁止把死亡角色删除；必须保留尸体和搜刮规则。
- 禁止把作祟书长文当 UI 主动作；主动作必须落到真实对象和短提示。
- 禁止只跑 E2E happy path 就宣称规则完成。
