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
| 1 游戏目标 | 作祟前探索并增强；作祟后按阵营目标争胜 | 已补阶段模型和代表目标承接：作祟前通过探索 / 持有物 / 属性轨增强，作祟后进入剧本目标页和目标计数轨；1 / 3 / 12 / 33 已有剧本目标页文案，1 / 3 / 33 还能从运行态派生作祟目标计数轨。当前只证明代表剧本目标展示和阶段切换，不代表 50 个作祟目标、平局 / 同时完成、完整秘密目标或所有目标触发器完成 | `phase`, `hauntCardNumber`, `endgameResult`, `numberTracks[]` | 剧本入口目标页 / 牌堆区作祟目标计数轨 / 终局页 | 目标计数轨领域测试 + 剧本目标页 Board 测试 + 首剧本 / 灰尘 / 魔法相机代表终局领域测试 | `implemented-needs-remodel` |
| 2 规则书结构 | 准备、配件、作祟前、作祟后、索引 | 设计和测试按同样分区组织，避免只测代表链 | `ruleCoverageSections` | 不进主 UI | 覆盖矩阵完整性检查 | `design-ready` |
| 3.1 剧本卡 | 开局团队翻阅五张剧本卡并选择一张；作祟时由剧本卡 + 预兆确定编号和叛徒 | 已补设置阶段剧本卡候选、提议、已选探索者共同确认、确认进度和锁定流程；未全员确认不能开始，待接入剧本即使确认也不能开局；作祟揭示代表链会保存开局剧本卡、触发预兆和作祟编号并显示短溯源，但全量剧本卡 × 预兆映射仍未完成 | `scenarioCandidateIds`, `proposedScenarioCardId`, `scenarioCardConfirmations`, `scenarioId`, `triggerOmenId`, `hauntScenarioCardId`, `triggeringOmenName` | 剧本卡选择面板 + 角色选择页剧本卡按钮；作祟揭示横幅短显示“剧本卡 / 触发 / 作祟编号” | 设置阶段领域单测、组件测试和真实入口 E2E 已覆盖候选池、提议清空确认、多人确认、待接入阻止开局、共同确认进度和进入牌桌；作祟揭示代表链证据见 `evidence/betrayal-core-interactions/haunt-reveal-protocol/e2e-test.md` | `implemented-needs-remodel` |
| 3.2 作祟检定 | 抽预兆后按所有玩家已持有预兆总数掷骰，5+ 开始作祟，掷骰者为作祟揭秘者 | 已补作祟风险计数轨读模型：`resolveBetrayalNumberTracks` 会从全员当前持有预兆派生 `haunt-risk`，记录当前预兆、下次骰数、5+ 阈值、自动作祟和进度百分比；牌堆区现有风险块消费同源进度条，抽预兆时作祟检定骰数仍与 `resolveBetrayalHauntRisk` 一致；物品 / 预兆抽牌已开始接入 `pendingCardResolutionQueue`，器械库代表链会逐步确认 1/3、2/3、3/3，普通圣符预兆代表链会在作祟骰盘同屏时要求确认 1/1。仍缺交易 / 死亡掉落后真实入口风险条回归、更多预兆组合真实入口回归和通用发现结算队列 | `omenCount`, `hauntRoll`, `hauntRevealerPlayerId`, `numberTracks[]`, `pendingCardResolutionQueue` | 牌堆区风险条 + 骰盘 + 发现面板确认按钮 | 领域单测覆盖全员预兆总数、下次骰数、`haunt-risk` 计数轨、器械库逐步确认队列和普通预兆 1/1 确认队列；Board 组件测试覆盖牌堆区进度条、器械库逐步确认按钮和圣符预兆作祟骰盘旁的确认 1/1 | `implemented-needs-remodel` |
| 3.3 探索结束回合 | 探索并放置新房间，结算房间 / 卡牌后回合结束；可自愿结束 | 已补探索结算后的行动收敛：发现结果未关闭前仍阻塞当前探索者，关闭后写明“探索完成，结束回合”，行动区只保留结束回合入口；移动 / 探索 / 交易 / 使用 / 房间效果不会继续并列暴露；点击结束回合后才切到下一位。仍不代表完整房间文字 / 符号逐步队列或全部探索异常完成 | `turnEndedByDiscovery`, `recommendedAction` | 发现浮层 + 行动槽短状态 + 单一结束回合入口 | 领域测试、Board 组件测试和真实入口 E2E 已覆盖；证据见 `evidence/betrayal-core-interactions/discovery-end-turn/e2e-test.md` | `implemented-verified` |
| 3.4 作祟开始公开介绍和设置 | 英雄、叛徒先公开读介绍和设置，再分开读秘密目标 | 已补代表读模型和牌桌揭示层短提示：一名叛徒作祟提示公开读英雄介绍 / 设置，再公开读叛徒介绍 / 设置；灰尘按隐藏叛徒处理，只提示英雄公开读法、不要公开谁是叛徒，之后各自阅读自己的目标 / 秘密规则；牌桌保留手动剧本书入口，不能把 setup 队列明细、状态或秘密分发项堆成前景信息墙；作祟揭示期必须保持单主焦点，作祟后进度条 / 主动作 / 交换或攻击提示 / 武器选择在玩家点“返回牌桌”后才出现，不能通过可见层、sr-only、aria/status 或 title 和揭示提示同屏抢焦点；首剧本只写“作祟开始”也按作祟开场处理；新增 `resolveBetrayalHauntSetupCommandPreviews`，能把当前 setup 队列拆成“可由当前状态确认 / 仍需人工确认”的命令预览，并列出隐藏疾病、研究 token、奇异护符、巨魔手、幻影摄影师、魔法相机、Essence 和首玩家目标。仍缺正式 setup 确认命令写状态、UI 承接、段落级秘密可见性、隐藏叛徒完整阵营和自由混战 | `resolveBetrayalHauntRevealProtocol`, `resolveBetrayalHauntSetupQueue`, `resolveBetrayalHauntSetupProgress`, `resolveBetrayalHauntSetupCommandPreviews`, `publicSteps`, `secretBoundary`, `hauntSetupQueue` | 轻量揭示提示 + 剧本书入口；setup 队列和命令预览仅作领域/内部合同 | 公开设置顺序领域测试 + 灰尘隐藏叛徒领域测试 + 魔法相机 setup 队列领域测试 + setup 命令预览领域测试 + 真实入口 E2E 截图 | `implemented-needs-remodel` |
| 4 配件 | 角色板、立牌、夹子、骰子、指示物、卡牌、房间、剧本卡、参考卡、作祟书 | 每类配件进入 `componentCatalog`，记录类型、资源、owner 范围、是否公开、是否可交互；参考卡和作祟书只进帮助 / 剧本书入口，不挤占主 UI | `componentCatalog`, `componentResourceState`, `componentOwnerScope` | 当前相关对象本体 + 帮助入口 | catalog 类型 / owner / 资源状态测试 | `design-ready` |
| 5.1 作祟书放一边 | 作祟书作祟后才用 | 作祟前剧本书入口只允许剧本卡；作祟书锁定 | `hauntBooksLockedUntilHaunt` | 剧本书入口禁用短提示 | 阶段权限测试 | `design-ready` |
| 5.2 选角色 | 玩家选择角色、角色面板、立牌、底座 | 角色选择必须锁定唯一角色和座位 | `players[].characterId`, `figureId` | 角色选择页 | 重复角色 / 座位测试 | `design-ready` |
| 5.3 属性夹子 | 四个夹子放绿色起始值 | 初始化属性轨位置，不初始化裸数值 | `traitTracks[trait].position` | 角色板属性轨 | 起始位置测试 | `design-ready` |
| 5.4 骰子 | 8 枚骰子全员可用 | 已补统一骰池上限：属性检定、作祟检定、普通事件骰、死亡保护、怪物移动和攻击等通用投骰入口都经同一骰面函数，单颗骰面只会是 0/1/2，投骰数量最多 8；作祟风险条显示的下一次骰数也按 8 骰上限表达 | `BETRAYAL_DICE_POOL_SIZE=8`, `normalizeBetrayalDiceCount`, `recentRoll.dice[]` | 骰盘 / 结果条 / 作祟风险骰数 | 骰池上限领域测试 + 作祟风险骰数测试；仍需逐作祟怪物骰和全部 UI 回归 | `implemented-needs-remodel` |
| 5.5 三类牌堆 | 事件、物品、预兆分类洗混面朝下 | 已补领域代表链：事件牌结算后掩埋回事件牌堆底部，牌堆数量不减少且不进入弃牌；物品 / 预兆获得后才离开对应牌堆；器械库展示出的非武器物品牌掩埋回物品牌堆底部，且发现摘要会记录“房间获得武器 / 掩埋展示牌 / 符号抽牌入持有区”的结构化步骤；器械库代表链已把这些步骤写入 `pendingCardResolutionQueue`，发现面板必须按 1/3、2/3、3/3 逐步确认，普通圣符预兆也会生成 1/1 确认，确认完关闭后牌堆区保留最近结算短状态，避免玩家丢失刚才展示 / 掩埋 / 获得的牌面结果；兔脚回滚事件效果时会恢复持有牌牌堆顺序快照；事件牌页面承接 E2E 已覆盖当前接入事件池的翻牌、选择、投骰、结果和关闭链；当前正式运行事件池已按 23 张官方事件合同收口，不再把“未录入事件牌”列作当前缺口。仍缺完整牌堆区实体化可视化、物品 / 预兆更多真实入口、领域级通用发现结算队列和未来新增卡牌的独立合同 | `eventOrder`, `possessionOrderByKind`, `deckCounts`, `discardCounts`, `latestDiscovery.resolutionSteps`, `pendingCardResolutionQueue`, `ACKNOWLEDGE_CARD_RESOLUTION`, `recentRoll.eventEffectSnapshot` | 牌堆区 / 翻牌详情 / 逐步确认按钮 / 最近结算短状态 | 事件掩埋、器械库展示牌掩埋、兔脚回滚测试、器械库结构化发现步骤测试、器械库逐步确认队列测试、普通预兆 1/1 确认测试、牌堆区最近结算组件测试、`event-choice-coverage.e2e.ts` 当前接入事件池代表链 | `implemented-needs-remodel` |
| 5.6 参考卡 | 怪物参考卡、叛徒参考卡公开可见，玩家参考卡发给玩家 | 参考卡作为帮助层资源，不替代交互 | `referenceCards` | 参考卡按钮 / 帮助层 | 资源加载测试 | `design-ready` |
| 5.8 起始房间 | 三个起始板块置中，保留探索空间 | 起始地图图结构必须固定，未来房间从开放门位扩展 | `roomGraph`, `startingTiles` | 中央地图 | 起始拓扑测试 | `design-ready` |
| 5.9 房间堆 | 剩余房间洗混成堆 | 房间堆按区域和顺序建模，不能固定下一房间 | `roomTileStack`, `roomDiscoveryOrderByFloor` | 牌堆 / 探索状态 | 房间池测试 | `design-ready` |
| 5.10 起始位置 | 探索者放入口大厅 | 所有角色 figure 起点一致，除非剧本 / 效果改写 | `explorers[].tileId` | 角色 token | 初始位置测试 | `design-ready` |
| 5.11 剧本卡选择 | 团队翻阅五张选一张 | 见 3.1；当前已补五张候选、提议和共同确认流程；作祟揭示能对代表链回写选定剧本卡和触发预兆来源，但仍不代表 50 个作祟逐条运行时完成 | `scenarioCandidateIds`, `proposedScenarioCardId`, `scenarioCardConfirmations`, `scenarioId`, `hauntScenarioCardId`, `triggeringOmenName` | 剧本选择面板 + 共同确认短状态；作祟揭示短溯源 | 页面选择、共同确认和待接入阻止测试；证据见 `evidence/betrayal-core-interactions/scenario-card-selection/e2e-test.md`；代表作祟溯源证据见 `evidence/betrayal-core-interactions/haunt-reveal-protocol/e2e-test.md` | `implemented-needs-remodel` |
| 5.12 首玩家 | 按规则决定第一个玩家，顺时针轮流行动；作祟 setup 可指定叛徒左侧或揭秘者左侧玩家先行动 | 已补作祟后首玩家代表读模型：普通预兆 / 事件型作祟都会生成 `HauntFirstPlayerResolution`，记录首玩家策略、锚点玩家、下一名玩家、原因和代表边界；1/33 按叛徒左侧，3/12 按作祟揭秘者左侧；setup 命令预览会把 `first-player-left-of-traitor` / `first-player-left-of-revealer` 映射到当前 `nextHauntPlayerId`，供后续确认命令和 UI 短提示使用。仍缺开局首玩家 catalog、完整 50 个作祟首玩家策略、正式 setup 完成确认和 UI 短提示承接 | `firstPlayerRule`, `turnOrder`, `hauntFirstPlayerResolution`, `nextHauntPlayerId`, `resolveBetrayalHauntSetupCommandPreviews`, 后续 `hauntFirstPlayerOverride` | 设置摘要 + 作祟设置完成提示 | 代表单测覆盖 1/3/12/33 和普通预兆触发路径；setup 命令预览测试覆盖首玩家目标；后续补完整作祟首玩家合同测试 | `implemented-needs-remodel` |
| 6.1 房间板块区域 | 房间背面标明地下室 / 一楼 / 二楼；正面可能有事件 / 物品 / 预兆符号 | 房间 catalog 存区域、门位、符号、文字效果 | `roomTileCatalog`, `roomInstances` | 房间板块本体 | 房间数据完整性测试 | `design-ready` |
| 6.2 事件卡 | 朗读斜体文本，按指示，检定表只读匹配结果，完成后掩埋到底部 | 已补事件牌堆顺序语义：探索抽事件牌堆顶，结算后把该事件牌放回事件牌堆底部，`discardCounts.event` 保持 0；事件选择和兔脚重掷链路复用该牌堆快照；真实入口已覆盖当前 23 张官方事件池的自动属性检定、固定骰、可选事件骰、可选作祟检定、选择检定属性、全属性检定、后续属性奖励 / 通用伤害 / 目标房间选择、结果关闭回牌桌。仍缺未来新增事件牌的独立合同，以及从领域状态到 UI 的通用发现结算队列 | `eventOrder`, `latestDiscovery`, `pendingEventChoice`, `recentRoll`, `recentAllTraitCheck`, `eventEffectSnapshot` | 翻牌亮相 + 事件选择层 + 骰盘 + 当前结果 | 事件掩埋到底部测试 + `event-choice-coverage.e2e.ts` 多模式事件完整链路 + 兔脚事件回滚测试 | `implemented-needs-remodel` |
| 6.3 物品卡 | 朗读，牌面朝上放自己面前，之后可用 / 交易 / 转移 | 物品 owner 进入持有区，效果注册到可用行动 / 被动修正 | `possessions[itemId]`, `ownerPlayerId` | 持有物区卡牌本体 | 获得 / 转移测试 | `design-ready` |
| 6.4 预兆卡 | 朗读，获得，立即作祟检定 | 预兆和物品一样 owner 化，但额外触发作祟检定 | `possessions[omenId]`, `hauntRollPending` | 持有区 + 风险条 + 骰盘 | 预兆抽取测试 | `design-ready` |
| 6.5 指示物 | 多数用于作祟，作用由作祟规则解释；每个作祟子账本必须声明 token 数量、owner、位置、可见性、拾取/交易/攻击/触发规则 | token 由基础 `tokenInstances` 承载，具体语义在 50 个作祟子账本中闭合，不能用通用 token 名代替作祟状态 | `tokenInstances`, `hauntRuntime.tokens[]` | 地图 / 角色 / 作祟目标条 | 每个作祟 token 合同字段机检 + 子账本测试 | `contract-ready` |
| 7 属性 | 力量、速度、知识、神志公开，用夹子记录 | 已补属性轨模型：探索者保存 `traitTracks`，当前属性值由轨道位置派生；角色板和队友详情都显示轨道、绿色起点、重复数值和当前夹子位置，不再只展示裸数字 | `traitTracks`, `currentTraits`, `traitValueAtPosition` | 角色板属性轨 + 队友详情轨道 | 领域轨道派生测试 + Board 轨道位置测试 + 真实入口 E2E；证据见 `evidence/betrayal-core-interactions/trait-track-ui/e2e-test.md` | `implemented-verified` |
| 7 官方补充：提升 / 下降 | Gain/Lose 移动夹子一格，可能不改变数值；最高值不能再升 | 已补按步移动：属性提升 / 下降修改轨道位置而非裸数值，重复数值时位置变化仍可见，最高值边界由轨道 `maxPosition` 控制 | `TRAIT_STEP_CHANGED`, `traitTracks[].position`, `maxPosition` | 轨道夹子位置变化 | 非线性轨 / 重复数值领域测试 + 角色板轨道 E2E；证据见 `evidence/betrayal-core-interactions/trait-track-ui/e2e-test.md` | `implemented-verified` |
| 7 官方补充：治疗 | Heal trait 回到绿色起始值；已在或高于起始值则不降 | 已补治疗回起点：治疗按轨道位置回绿色起始位，不是加固定数值或回满；急救包治疗预览会显示哪些属性回绿色、哪些保持不变 | `HEAL_TRAIT_TO_START`, `startPosition`, `pendingUseTargetPreview` | 治疗目标属性轨预览 | 治疗边界领域测试 + 治疗目标预览 E2E；证据见 `evidence/betrayal-core-interactions/trait-outcome-preview/e2e-test.md` | `implemented-verified` |
| 7.1 临界 / 死亡 | 最低红值为临界；作祟前不会死；作祟后到骷髅死亡 | 已补代表边界：作祟前伤害最多停在临界，作祟后可进入骷髅死亡；伤害分配预览按属性轨展示后果。仍缺全部死亡来源、特殊作祟死亡用途和完整死亡 UI 收口 | `criticalPosition`, `skullPosition`, `deathState`, `pendingDamageAllocation` | 角色板红色警示 / 伤害分配预览 / 死亡反馈 | 作祟前后死亡领域测试 + 伤害分配预览 E2E；证据见 `evidence/betrayal-core-interactions/trait-outcome-preview/e2e-test.md` | `implemented-needs-remodel` |
| 8 伤害 | 物理分配力量 / 速度；精神分配知识 / 神志；一般由玩家选择属性 | 已补事件一般伤害、火炉房回合末物理伤害、倒塌房间结束回合速度检定失败坠落物理伤害、普通首剧本英雄攻击叛徒 / 叛徒或杰克之灵攻击英雄的非致死伤害切片、普通首剧本无头骨死亡保护的致死攻防分配后死亡 / 杰克之灵 / 英雄全灭收口切片、普通首剧本攻击头骨死亡保护分配后判断切片、普通攻击兔脚重掷后回算防守者非致死伤害的领域切片、12 号作祟「援手」力量攻击奖励伤害和巨魔手怪物攻击伤害的玩家确认分配切片、3 号作祟「灰尘」回合末未交换疾病 2 骰一般伤害分配切片；这些入口都会停在伤害分配面板，受伤玩家确认后才扣属性 / 推进。头骨不会在攻击阶段提前预判，只有玩家实际把伤害分到骷髅后才掷死亡保护，成功拉回濒死，失败再进入死亡 / 杰克之灵 / 英雄全灭 / 狂热病患化收口。仍缺其它作祟 / 非 12 号怪物伤害来源统一接入 | `DamageAllocationInteraction`, `pendingDamageAllocation`, `recentRoll.deathPrevention.damageTraits` | 伤害分配面板 + 轨道预览 + 头骨死亡保护骰盘 | 火炉房领域 / Board 定向测试 + 倒塌房间坠落伤害领域 / Board 定向测试 + 普通攻击首剧本攻防领域 / Board 定向测试 + 普通攻击头骨死亡保护领域 / Board 定向测试 + 普通攻击兔脚回算领域测试 + 援手攻击奖励伤害领域 / Board 定向测试 + 巨魔手怪物攻击伤害领域 / Board 定向测试 + 灰尘未交换疾病伤害领域 / 真实入口 E2E；后续补其它怪物和其它作祟伤害 | `implemented-needs-remodel` |
| 8 官方补充：按步扣 | 伤害降低的是属性轨步数，不是数值差 | 火炉房分配确认、倒塌房间坠落伤害分配确认、普通攻击首剧本攻防分配确认、普通攻击兔脚重掷后新生成的防守者伤害分配确认、援手攻击奖励分配确认和巨魔手怪物攻击伤害分配确认后均复用属性轨步数扣减；重复数字时位置变化仍成立。其它伤害来源仍需迁入同一分配模型 | `TRAIT_STEP_CHANGED`, `pendingDamageAllocation.traits` | 轨道预览 | 重复数字伤害测试 + 火炉房分配测试 + 倒塌房间坠落分配测试 + 普通攻击分配测试 + 普通攻击兔脚回算测试 + 援手攻击奖励分配测试 + 巨魔手怪物攻击分配测试 | `implemented-needs-remodel` |
| 8 官方补充：临界分配限制 | 作祟前不能把伤害分到已临界属性，如果还有其他可降属性 | 火炉房和事件一般伤害领域校验均会拒绝把作祟前伤害分到已临界属性；Board 面板按可分配步数禁用属性。普通攻击、援手攻击奖励和巨魔手怪物攻击为作祟后伤害，当前代表切片允许到骷髅；其它伤害来源仍需逐步接入 | `allocationOptions`, `damageTraitsAreAssignable`, `pendingDamageAllocation.allowedTraits` | 禁用原因短提示 / 禁用属性按钮 | 临界属性分配测试 + 普通攻击分配测试 + 援手攻击奖励分配测试 + 巨魔手怪物攻击分配测试 | `implemented-needs-remodel` |
| 9 骰子 | 8 枚骰子，每面 0/1/2，结果为点数和 | 已补统一骰面和骰池上限：通用投骰记录每颗骰面，点数为骰面和再加合法被动修正；高属性检定仍最多记录 8 颗骰，单颗骰面只会是 0/1/2 | `recentRoll.dice[]`, `passiveBonus`, `BETRAYAL_DICE_POOL_SIZE` | 骰盘 / 结果条 | 高属性 8 骰上限领域测试 + 多类既有骰盘测试；仍需完整 UI 逐类回归 | `implemented-needs-remodel` |
| 9.1 属性检定 | 按当前属性值掷骰，执行对应结果表 | 已补事件属性检定代表链：按当前属性 / 非战斗替换 / 事件额外骰派生骰数，记录 `eventTraitCheck`、骰面、被动修正、分支阈值和命中分支；高属性时仍最多 8 骰 | `recentRoll.kind=eventTraitCheck`, `trait`, `branchThresholds`, `passiveBonus` | 骰盘 + 当前分支 | 属性检定分支领域测试 + 8 骰上限测试 + 事件页面代表链 | `implemented-needs-remodel` |
| 9.2 作祟检定 | 按预兆总数掷骰，5+ 作祟，掷骰者为揭秘者 | 已补作祟检定独立读模型：按全员当前持有预兆 + 新抽预兆请求骰数，真实投骰最多 8 颗；结果记录为 `hauntRoll`，不走属性检定修正；作祟风险条和实际投骰同源。仍缺交易 / 死亡掉落后风险条真实入口回归和更多预兆组合 | `BetrayalHauntRiskStatus`, `recentRoll.kind=hauntRoll`, `hauntRevealerPlayerId` | 风险条 + 骰盘 | 作祟风险领域 / Board / E2E + 8 骰上限领域测试 | `implemented-needs-remodel` |
| 9 官方补充：普通掷骰 | 效果可要求掷若干骰，这不是属性检定，不受只影响属性检定的效果 | 已补普通事件固定骰和多类特殊骰代表链，`eventDiceRoll`、`mysticElevator`、死亡保护、怪物移动等不会被属性检定专属修正误用；仍需把全部作祟特殊骰逐条迁入同一合同 | `recentRoll.kind`, `eventDiceRoll`, `mysticElevator`, `deathPrevention`, `monsterMoveRoll` | 骰盘标题短标签 | 普通事件骰 / 电梯 / 死亡保护 / 怪物移动代表测试 | `implemented-needs-remodel` |
| 9.3 攻击检定 | 攻击者和防御者掷同一属性，低者按差值受伤；平局无伤 | 已补首剧本普通攻防代表链和武器声明代表链：攻击记录双方骰面、使用属性、被动 / 武器修正、差值、伤害类型和待分配伤害；平局无伤害。仍缺全部作祟攻击、完整怪物系统和所有武器牌录入 | `AttackResolution`, `recentRoll.kind=attackRoll`, `damageKind`, `pendingDamageAllocation` | 攻击面板 + 骰盘 | 首剧本攻防 / 武器声明 / 伤害分配领域和 Board 测试 | `implemented-needs-remodel` |
| 10 作祟前回合 | 移动、探索、交易、特殊行动可任意顺序；探索结束回合 | 恶兆前普通行动仍允许任意顺序；探索成功并关闭发现结果后，会把本回合剩余行动收束为单一结束回合入口，避免玩家继续误点交易 / 使用 / 移动。仍需继续扩展更多特殊行动预算真实入口证据 | `turnActionState`, `turnEndedByDiscovery`, `recommendedAction` | 行动槽 + 当前可点对象；探索后只剩结束回合 | 行动任意顺序测试 + 探索后结束回合 E2E；证据见 `evidence/betrayal-core-interactions/discovery-end-turn/e2e-test.md` | `implemented-needs-remodel` |
| 11.1 移动力 | 回合开始看速度；中途速度变化不改本回合移动力 | 已补回合开始移动力快照：回合开始写入 `turnStartSpeed` 和 `movesRemaining`；真实移动会消耗剩余移动；回合中速度变化只改属性轨 / 当前速度，不回填本回合移动力；结束回合后下一名玩家重新按其速度锁定移动力。仍不外推为假门 / 门位相邻、障碍物离开成本、强制移动或怪物移动完整完成 | `turnStartSpeed`, `movesRemaining` | HUD 移动力短状态 | 领域单测 + 真实入口 E2E + 截图核验；证据见 `evidence/betrayal-core-interactions/movement-snapshot/e2e-test.md` | `implemented-verified` |
| 11.2 相邻 | 共享直连门位才相邻；特殊文字可声明相邻；假门不相邻 | 已补基础门位相邻语义：普通移动目标从当前房间的真实连接门位派生；几何相邻但双边门位连接被拆掉时，不会出现在可移动目标里，普通移动命令也会被拒绝。骨制钥匙 / 秘密通道等特殊文字仍作为特殊连接代表链单独处理；仍缺完整假门 catalog、全部特殊相邻文字和路径预览 UI | `roomConnections`, `doorways[].connectsToRoomId`, `specialAdjacency` | 地图门位高亮；后续路径预览 | 普通门位相邻领域测试 + 骨制钥匙特殊移动代表测试；仍需完整假门 / 特殊连接回归 | `implemented-needs-remodel` |
| 11.3 强制移动 | 若效果写“最多移动 N”，执行移动的人决定移动多远，即使移动别人 | 面具代表链已由执行者给每个同房间目标指定去向；后续泛化成通用强制移动交互和路径预览 | `targetRoomIdsByTokenId`, `ForcedMoveInteraction` | 目标路径选择 | 面具强制移动 owner 测试 | `implemented-needs-remodel` |
| 12 探索入口 | 在有未探索走廊的房间上，可穿过该门探索 | 已补真实门位入口：玩家先点“探索”进入选择态，地图上的未知门位本体才高亮可选；点击目标门位后进入房间放置面板，而不是自动翻开放置 | `entryDoorway`, `RoomPlacementInteraction`, `resolveExplorableRoomSlots` | 未探索门位高亮 + 房间放置面板 | 领域探索入口测试 + Board 门位高亮测试 + 真实入口 E2E；证据见 `evidence/betrayal-core-interactions/room-placement-orientation/e2e-test.md` 和 `evidence/betrayal-core-interactions/discovery-end-turn/e2e-test.md` | `implemented-verified` |
| 12 区域匹配 | 翻房间堆顶；区域匹配才可翻开放置 | 已补统一房间堆翻找：区域不匹配板块记为掩埋并放回堆底，继续翻找当前区域；放置面板会提示本次已掩埋房间；真实入口截图已覆盖塔楼 / 储物间掩埋后继续翻到火炉房 | `roomDiscoveryDeck`, `RoomDrawResolution`, `buriedRoomTiles`, `latestRoomDrawResolution` | 放置面板短提示 | 区域不匹配掩埋领域测试 + 牌桌组件提示测试 + `evidence/betrayal-core-interactions/room-discovery-failures/e2e-test.md` | `implemented-verified` |
| 12 玩家放置方向 | 新房间任一走廊与当前未探索走廊相连即可，不要求所有门匹配 | 已补房间放置朝向交互：玩家先点地图上的未知门位，放置面板展示新房间预览、入口门位和合法连接门；玩家可左右旋转并确认合法朝向，确认后把 `orientationTurns`、入口边和连接门位保存到房间实例。当前只证明代表旋转确认链，不外推为所有极端桌面摆放完成 | `orientationTurns`, `entryEdge`, `connectedDoorways`, `orientationOptions` | 房间预览旋转 / 入口门位 / 合法连接门 / 确认放置 | 领域合法性测试 + Board 放置面板测试 + 真实入口 E2E；证据见 `evidence/betrayal-core-interactions/room-placement-orientation/e2e-test.md` | `implemented-verified` |
| 12 放置角色 | 新房间放置后把探索者移动到新房间 | 已补探索成功后的角色移动：确认新房间朝向后，目标房间变为已发现，当前探索者、active room 和地图 token 都进入新房间；发现结果未关闭前仍阻塞在当前探索者，不提前切换下一位 | `currentExplorer.roomId`, `activeRoomId`, `ROOM_EXPLORED` | 新房间上的探索者 token + 发现结果阻塞层 | 领域探索移动测试 + Board token 承接测试 + 真实入口 E2E；证据见 `evidence/betrayal-core-interactions/room-placement-orientation/e2e-test.md` 和 `evidence/betrayal-core-interactions/discovery-end-turn/e2e-test.md` | `implemented-verified` |
| 12 房间文字 / 符号 | 先结算房间文字，再按符号抽事件 / 物品 / 预兆 | 已补两个领域代表链：书房 / 图书馆这类“发现时提升属性”的房间会先影响随后事件属性检定骰数，`ROOM_EXPLORED` 仍只落地一次房间文字；器械库先按房间文字展示物品牌直到武器，非武器展示牌掩埋回物品牌堆底部，再按物品符号另抽下一张物品牌，不能把两次抽牌合并；牌桌发现详情、发现步骤、逐步确认按钮和牌堆区最近结算会合并显示器械库文字奖励、展示后掩埋和符号抽牌，避免房间文字奖励被后续抽牌淹没；后续仍需通用阻塞式结算队列和更多房间文字 / 符号组合 | `resolveCoreAfterRoomDiscoveryText`, `eventTraitCheck`, `roomDiscoveryCards`, `drawnCard`, `possessionOrderByKind`, `latestDiscovery.resolutionSteps`, `pendingCardResolutionQueue` | 事件骰盘读取房间文字后的属性；发现详情 / 逐步确认按钮 / 牌堆区最近结算显示房间文字奖励和符号抽牌 | 房间文字先于事件检定测试 + 器械库房间文字 / 物品符号分离 / 展示牌掩埋测试 + 器械库牌桌发现详情、逐步确认与牌堆区最近结算组件测试 + 探索结算相关回归 | `implemented-needs-remodel` |
| 12.1 区域耗尽 | 区域房间用完时不消耗移动，继续回合 | 已补对应楼层发现池为空时的安全守门：预览为空、命令拒绝、移动力和回合结束状态不变；牌桌选择未知门位时显示“{{楼层}}房间已耗尽”；真实入口 E2E、截图核验和服务器相册已回填 | `resolveRoomPlacementPreview`, `roomDiscoveryDeck`, `roomDiscoveryOrderByFloor`, `pendingRoomPlacementFailure` | 短提示 + 回到移动 | 耗尽领域测试 + 牌桌提示测试 + `evidence/betrayal-core-interactions/room-discovery-failures/e2e-test.md` | `implemented-verified` |
| 12.2 保持可探索 | 放置后所在区域必须仍有至少一个可通行走廊；唯一封死的板块掩埋重抽；若仍无法放置，最小调整已有板块 | 已补封死区域重抽：候选房间所有合法朝向都会封死当前区域、且后续仍有同区域房间时，记录 `sealedRegion` 掩埋并继续翻；若这是最后一张同区域房间且会封死区域，则房间放置面板列出最小调整候选，玩家选择已有板块的新位置 / 入口 / 朝向后才能确认放置；当前代表切片验证会移动一个已有同区域房间并保留开放走廊，不外推为所有现实桌面极端调整方案完成 | `RoomDrawResolution.buriedRoomTiles`, `RoomDrawResolution.requiresTileAdjustment`, `roomTileAdjustment`, `selectedRoomRequiresOpenFrontier`, `regionOpenDoorways`, `tileAdjustmentEvent` | 放置预览 + 调整候选 + 选中后确认 | 封死区域 / 最小调整领域测试 + 牌桌完整选择组件测试 + `evidence/betrayal-core-interactions/room-discovery-failures/e2e-test.md` | `implemented-verified` |
| 13 抽牌 | 带符号房间抽对应牌堆顶 | 已补领域抽牌顺序：事件从 `eventOrder[0]` 读取并进入事件牌页面承接链；物品 / 预兆从当前持有牌堆顶部读取，获得才移出牌堆；器械库代表链已把多步骤结果写入 `latestDiscovery.resolutionSteps` 和 `pendingCardResolutionQueue`，普通预兆也会生成单步确认队列；发现面板会按步骤确认，未确认完会阻止直接结束回合，确认完关闭后牌堆区最近结算继续消费结构化步骤，不再只能拆中文 `detail`。这仍不是通用领域级发现结算队列。仍缺物品 / 预兆更多符号组合真实入口回归和通用队列抽象 | `cardDrawRequest`, `eventOrder`, `possessionOrderByKind`, `latestDiscovery.resolutionSteps`, `pendingCardResolutionQueue`, `ACKNOWLEDGE_CARD_RESOLUTION` | 牌堆翻牌 + 发现面板步骤列表 + 逐步确认按钮 + 牌堆区最近结算 | 抽牌顺序 / 掩埋回底测试 + 事件牌真实入口 E2E + 器械库结构化步骤领域测试 + 器械库逐步确认领域 / 组件测试 + 普通预兆确认领域 / 组件测试 | `implemented-needs-remodel` |
| 13.1 事件 | 事件完成后掩埋到底部；只读匹配结果 | 见 6.2；当前已验证事件牌回到底部且事件弃牌数不增加，并由真实入口覆盖当前接入事件池的翻牌、选择 / 投骰、结算和关闭链 | `eventOrder`, `pendingEventChoice`, `recentRoll`, `recentAllTraitCheck` | 事件翻牌 + 选择 / 骰盘 / 结果层 | 事件掩埋测试 + `event-choice-coverage.e2e.ts` | `implemented-needs-remodel` |
| 13.2 物品 | 物品获得，后续可使用 / 交易 / 转移 | 见 6.3 | `possessions` | 持有物区 | 获得物品测试 | `design-ready` |
| 13.3 预兆 | 预兆获得并进行作祟检定；最后一张预兆自动开始作祟 | 已补最后预兆自动作祟领域链和风险计数轨状态；`haunt-risk` 会在最后预兆时显示自动作祟进度，普通预兆抽取仍按全员预兆总数掷骰；抽牌确认已接入同一 `pendingCardResolutionQueue` 机制，圣符预兆真实页面代表链会在作祟骰盘同屏时显示确认 1/1，确认前不能绕过发现面板。仍缺更多预兆组合、触发作祟时确认队列收口和交易 / 死亡掉落后风险条真实入口回归 | `omenDeck.remaining`, `hauntAutoStartReason`, `numberTracks[]`, `pendingCardResolutionQueue` | 风险条显示“最后预兆” + 发现确认按钮 + 作祟骰盘 | 最后一张预兆测试 + 风险条组件测试 + 器械库逐步确认代表测试 + 圣符预兆作祟骰盘 / 确认 1/1 组件测试 | `implemented-needs-remodel` |
| 14 交易 | 每回合一次；同房间；双方同意；可任意数量 / 不等价 / 一方给或拿 | 已补普通同房间交易多选承接：发起方可一次选择多张己方物品 / 预兆给出，也可只拿对方持有物或做双方不等价交换；请求必须等待接收方同意，同意后才结算；拒绝 / 空交易 / 非同房间 / 每回合一次边界由领域链和旧交易 E2E 回归覆盖；交易限制牌面提示已补齐，己方给出、对方给回和狗交易候选都保留不可交易牌并显示原因；狗远距交易代表链已补齐，可用狗选择多张持有物、点击 4 格内队友地图 token、等待接收方同意、同意后结算并清空选择态。当前不外推为完整攻击声明 UI、所有武器牌完整录入、全部持有物特殊行动预算或完整山屋规则完成 | `TradeAgreementInteraction`, `pendingTradeAgreement`, `tradeUsedThisTurnPlayerIds`, `selectedTradeGiveCardIds` | 持有物多选 + 双方确认 / 拒绝入口 + 狗远距交易候选区 / 4 格内地图 token 高亮 + 不可交易牌面禁用原因 | 领域测试覆盖只给、只拿、双方交换、拒绝 / 空交易边界和交易限制读模型；Board 组件测试覆盖多选给出等待同意、己方 / 对方 / 狗交易不可交易牌面禁用原因；真实入口 E2E 覆盖兔脚 + 书本给出、地图拿取、同意后转移、三类交易限制牌面禁用提示，以及狗远距交易送出急救包 + 地图给 4 格内队友、等待同意、同意结算和回牌桌清空；证据见 `evidence/betrayal-core-interactions/trade-multi-give/e2e-test.md`、`trade-turn-limit/e2e-test.md`、`trade-card-disabled-reasons/e2e-test.md` 和 `evidence/山屋惊魂-狗远距交易完整链路/e2e-test.md` | `implemented-verified` |
| 14 官方补充：交易限制 | 本回合已用特殊行动的物品 / 预兆不能交易；本回合用过攻击的武器不能交易 | 已补交易卡状态读模型，区分可交易、已用、狗作为交易来源、缺失持有物；攻击使用过的武器会写入本回合已用持有物，交易校验会拒绝；Board 候选牌面不再过滤不可交易牌，而是禁用并显示原因 | `resolveBetrayalTradeCardStatus`, `usedCardIdsThisTurn` | 禁用原因短提示，牌面仍保留可见 | 领域测试覆盖交易状态、狗交易限制和砍刀攻击后禁交易；Board 组件测试覆盖己方 / 对方 / 狗交易候选禁用原因；真实入口 E2E 和截图见 `evidence/betrayal-core-interactions/trade-card-disabled-reasons/e2e-test.md` | `implemented-verified` |
| 15 特殊行动 | 标特殊行动符号；总是可选；每个可用特殊行动每回合一次；不能重复 | 持有物、神秘电梯房间效果和作祟特殊行动已补预算读模型和真实入口承接；Board 普通“使用”、房间效果和作祟主动作均接入统一禁用原因，入口不会因已用 / 不可用直接消失；灰尘剧本“寻找解药”已用、盔甲被动、奇怪的药品刚获得和神秘电梯已用都有真实入口 E2E / 截图相册。当前不外推全部持有物效果、全部房间文字、全部作祟特殊行动或 50 个作祟完成 | `resolveBetrayalPossessionSpecialActionStatus`, `resolveBetrayalRoomSpecialActionStatus`, `resolveBetrayalHauntSpecialActionStatus`, `usedCardIdsThisTurn`, `scenarioRuntime.usedRoomEffectIdsThisTurn`, `turnStartInventoryCardIds` | 卡牌本体 / 房间效果 / 作祟主动作按钮 + 可见禁用短提示 | 持有物、房间效果、作祟特殊行动预算单测 + Board 组件测试 + 作祟预算真实入口 E2E + 特殊行动预算真实入口 E2E；证据见 `evidence/betrayal-core-interactions/haunt-special-action-budget/e2e-test.md` 和 `evidence/betrayal-core-interactions/special-action-budget/e2e-test.md` | `implemented-verified` |
| 15 官方补充：刚获得限制 | 不能用本回合开始时未持有的物品 / 预兆做特殊行动 | 持有物读模型校验回合开始持有物快照和本回合获得记录；真实页面选择刚获得的“奇怪的药品”时保留“使用”入口但置灰，显示“本回合新获得，下回合可用” | `turnStartInventoryCardIds`, `receivedCardIdsThisTurnByPlayerId` | 卡牌“下回合”标记 + 禁用原因短提示 | 领域测试、Board 组件测试和 `special-action-budget` E2E | `implemented-verified` |
| 15 官方补充：非特殊被动 | 有些物品 / 预兆效果不是特殊行动，只要持有就生效 | 持有物效果已区分主动 / 被动；真实页面选择“盔甲”时保留“使用”入口但置灰，显示“被动效果，不能主动使用”，避免玩家误以为被动消失或需要消耗特殊行动 | `active`, `resolveInventoryEffectId`, `PHYSICAL_DAMAGE_REDUCTION_BY_CARD_ID` | 被动持有物本体 + 禁用原因短提示 | 领域测试、Board 组件测试和 `special-action-budget` E2E | `implemented-verified` |
| 16 作祟流程 | 50 个作祟，各有英雄和叛徒版本；作祟由预兆触发 | 作祟定义必须按编号和双方版本建模；50 个子账本已分别覆盖公开/私密/setup/目标/行动/触发/token/怪物/UI/验证 | `hauntDefinitions`, `hauntRuntime`, `hauntContracts[1..50]` | 作祟揭示 / 剧本书 / 目标条 | 子账本必填字段机检 + 作祟目录测试 | `contract-ready` |
| 16 作祟定位 | 用开局剧本卡找到触发预兆对应编号和叛徒 | 已补代表运行时解析：普通预兆抽牌和事件型作祟都生成 `HauntRevealResolution`；新增 `HauntTraitorResolution`，保存叛徒策略、阵营类型、候选玩家、排除玩家、平局口径和代表边界。当前代表链覆盖 `赤红杰克归来 + A Splash of Crimson -> 作祟 1 / 揭秘者叛徒`、`A Dusty Vial -> 作祟 3 / 隐藏叛徒`、作祟 12 自由混战和作祟 33 魔法相机持有者；但剧本卡 + 预兆映射表仍未覆盖全部组合，不能宣称 50 个作祟完成 | `scenarioOmenHauntMap`, `hauntScenarioCardId`, `triggeringOmenId`, `triggeringOmenName`, `hauntCardNumber`, `hauntResolutionMatchedTrigger`, `hauntResolutionRepresentativeOnly`, `hauntRevealerPlayerId`, `traitorPlayerId`, `hauntTraitorResolution` | 作祟揭示横幅短溯源 + 剧本书入口；长规则和叛徒策略细节仍在剧本书 / 帮助层，不进主 HUD | 代表链单测、Board 组件测试、真实入口 E2E 和截图证据见 `evidence/betrayal-core-interactions/haunt-reveal-protocol/e2e-test.md`；叛徒读模型定向单测覆盖 1 / 3 / 12 / 33；后续仍需映射完整性测试 + 50 个源段页码账本落实现实运行时 | `implemented-needs-remodel` |
| 17 作祟类型 | 无叛徒 / 一名叛徒 / 隐藏叛徒 / 自由混战 | 已补代表运行时 `teamModel` 读模型：作祟揭示协议优先读取 `hauntTraitorResolution.teamModel`，四类代表链可被领域测试断言；自由混战下其他探索者已进入敌对阻碍移动成本判断，无叛徒作祟中怪物仍按英雄敌人阻碍移动。完整攻击阵营、隐藏身份推进、自由混战胜负仍需逐作祟落地 | `teamModel`, `hiddenRoleState`, `hauntTraitorResolution`, `resolveExplorerSide` | 目标条和可攻击对象；主界面只放短状态，不放长规则解释 | 四类型代表单测 + 自由混战 / 无叛徒阻碍移动成本单测；后续补隐藏身份 / 自由混战完整 E2E | `implemented-needs-remodel` |
| 18 开始作祟 | 英雄介绍和设置 -> 叛徒介绍和设置 -> 分开读秘密目标 / 规则 | 已补作祟揭示代表协议：公开步骤按官方顺序派生，牌桌揭示层只用短提示承接；灰尘已从旧“无叛徒”口径修正为隐藏叛徒，不公开隐藏身份；setup 队列保留为领域/内部状态，不在作祟揭示前景 UI 直接显示；作祟后常驻进度、主动作、交换 / 攻击提示和武器选择只能在揭示提示收口后恢复，且可见层、sr-only、aria/status 和 title 都必须遵守同一边界，避免把公开读法提示、进度条和内部 setup 状态堆成同屏信息墙；新增 setup 命令预览合同，已能把 1/3/12/33 代表作祟的 setup 条目拆成状态证据、目标玩家 / 房间 / 卡牌 / 怪物和缺口。当前不是正式逐作祟 setup 确认命令，尚未逐作祟拆公开设置操作和 UI 接线 | `resolveBetrayalHauntRevealProtocol`, `resolveBetrayalHauntSetupQueue`, `resolveBetrayalHauntSetupCommandPreviews`, `publicSteps`, `hauntSetupQueue` | 轻量公开揭示提示 + 手动剧本书入口；返回牌桌后恢复作祟进度 / 主动作；setup 命令预览暂不进玩家前景 | 领域测试覆盖一名叛徒、灰尘隐藏叛徒、魔法相机 setup 队列和 setup 命令预览；组件测试覆盖不自动开书、手动剧本入口、首剧本开场、setup 队列不进入玩家前景和揭示收口后恢复进度；真实入口 E2E 覆盖一名叛徒 / 隐藏叛徒揭示与返回牌桌截图 | `implemented-needs-remodel` |
| 18 官方补充：秘密信息 | 作祟书信息默认对另一方保密；但使用规则 / 特殊行动时对方可要求朗读相关段落 | 已补基础秘密边界读模型和揭示层提示：分开阅读目标，使用规则时可公开对应文本；灰尘隐藏叛徒分支明确隐藏身份不公开。当前仍缺段落级 `visibility`、`reveal-on-use` 记录、隐藏叛徒完整阵营模型和对方请求朗读交互 | `secretBoundary`, `heroBookVisibleTo`, `traitorBookVisibleTo`, `revealOnUse`, `hiddenRoleState` | 揭示层秘密边界短提示 | 领域测试覆盖秘密边界；组件测试覆盖玩家可见提示；真实入口 E2E 截图覆盖一名叛徒 / 隐藏叛徒两种提示 | `implemented-needs-remodel` |
| 19 攻击时机 | 作祟开始后可攻击同房间敌方探索者 / 怪物；每回合只能攻击一次 | 已补首剧本和代表作祟攻击时机链：攻击动作只在作祟后开放，目标按英雄 / 叛徒 / 怪物阵营和同房间或武器视线范围过滤；攻击后会把 `haunt-attack` 记录进本回合已用来源，并拦截同一玩家本回合再次普通攻击；攻击结算后回到同一玩家牌桌继续可操作，不自动结束回合。当前只证明首剧本普通攻防、武器声明、弩视线攻击、魔法相机幻影摄影师和 12 号巨魔手代表链，不代表完整怪物系统或全部作祟攻击时机完成 | `HAUNT_ATTACK`, `usedCardIdsThisTurn`, `resolveBetrayalAttackTargetPlayerIds`, `teamModel`, `lineOfSightGraph` | 攻击动作入口 / 目标高亮 / 视线线条 / 武器选择面板 | 首剧本攻防 / 武器声明 / 远程视线 / 魔法相机 / 大宅饿了领域、Board 和 E2E 代表链；证据见覆盖矩阵“普通攻击首剧本攻防伤害分配切片”“攻击与武器声明代表链”“远程武器视线攻击领域 + 目标高亮 / 视线线条代表链”“魔法相机幻影摄影师视线攻击代表链”和“作祟 12「大宅饿了 / 援手」领域战斗 + Board 承接切片” | `implemented-needs-remodel` |
| 19 攻击结算 | 默认力量攻击；高者赢；低者受差值伤害；平局无伤；知识 / 神志攻击造成精神伤害 | 已补默认力量对攻和代表武器结算链：攻击骰盘记录双方骰面、使用属性、武器 / 被动修正、伤害类型和差值；平局无伤；砍刀加成、匕首额外骰和速度花费、指环改用神志并造成精神伤害；造成伤害时先生成受伤方伤害分配，不再自动扣属性，致死攻击等到分配确认后再判断死亡 / 特殊保护。当前只证明代表攻击来源和代表武器，不代表所有武器、所有怪物攻击或全部作祟攻击结算完成 | `AttackResolution`, `recentRoll.kind=attackRoll`, `attackTrait`, `damageKind`, `pendingDamageAllocation`, `usedCardIdsThisTurn` | 攻击面板 / 骰盘 / 武器选择 / 伤害分配面板 | 首剧本普通攻防、砍刀 / 匕首 / 指环、头骨死亡保护、兔脚攻击重掷、12 号攻击奖励和巨魔手伤害分配领域与 Board 测试；证据见覆盖矩阵攻击相关切片 | `implemented-needs-remodel` |
| 19.1 武器 | 每次攻击最多一件；可选择不用；攻击后本回合不能交易；刚获得不能用；不能防御 | 已补攻击武器状态读模型：攻击面板保留所有已识别攻击武器，区分可用、刚获得不可用、已使用不可用，并显示禁用原因；徒手默认仍可选；可用武器仍能进入地图目标选择并完成攻击结算。当前只证明徒手 / 砍刀 / 匕首 / 指环 / 弩等代表武器和禁用原因表达，不等于所有武器牌完整录入、完整攻击声明 interaction 或全部作祟攻击完成 | `AttackDeclarationInteraction`, `BetrayalAttackWeaponCardStatus`, `resolveAttackWeaponCardStatuses`, `turnStartInventoryCardIds`, `usedCardIdsThisTurn` | 武器选择面板保留不可用武器本体 + 禁用原因短提示 | 领域 / Board 定向测试 + 真实入口 E2E：`evidence/山屋惊魂-攻击武器禁用原因完整链路/e2e-test.md`；既有徒手 / 砍刀 / 指环 / 匕首 / 弩代表链仍覆盖可用武器路径 | `implemented-needs-remodel` |
| 19.2 视线 | 同方向且不换区域可视线，中间可隔房间；房间内所有角色都在视线内 | 已补基础读模型，按同楼层 / 同一直线 / 连续已发现板块判断房间视线；远程武器领域校验代表链已接入通用英雄 / 叛徒目标范围，近战和徒手仍限同房间；牌桌目标高亮和视线线条代表链已接入当前选中武器的合法目标，弩可高亮并连线视线内非同房间叛徒；弩真实入口 E2E、截图核验和服务器相册已补证据；魔法相机幻影摄影师可攻击视线内英雄的代表链已补目标切换、视线线、骰盘、截图核验和服务器相册；仍需完整怪物系统、所有怪物视线攻击和真实远程牌面完整录入 | `lineOfSightGraph` / `resolveBetrayalLineOfSightRoomIds`, `rangedAttackWeaponIds`, `resolveBetrayalAttackTargetPlayerIds` | 目标高亮 / 视线线条 | 基础视线单测已覆盖，同楼层直线、跨楼层、未发现目标和中间断点；远程武器代表单测覆盖视线内可攻击、视线外不可攻击、近战 / 徒手不可跨房间；Board 组件测试覆盖弩选择后高亮并连线视线内非同房间叛徒；真实入口 E2E：`e2e/betrayal/non-p0-representative.e2e.ts "弩远程视线"`，1 passed；证据：`evidence/山屋惊魂-弩远程视线完整链路/e2e-test.md`；魔法相机幻影摄影师代表链真实入口 E2E：`e2e/betrayal/non-p0-representative.e2e.ts "幻影摄影师视线攻击"`，1 passed；证据：`evidence/山屋惊魂-幻影摄影师视线攻击完整链路/e2e-test.md` | `implemented-needs-remodel` |
| 官方补充：尸体搜刮 | 死者仍持有物品 / 预兆；同房间每回合可拿一个，不需同意 | 已补基础尸体搜刮代表链：死亡探索者保留为尸体对象，同房间存活探索者必须点选尸体和具体物品 / 预兆；同一尸体本回合拿 1 张后禁用二次搜刮；不外推为特殊作祟尸体用途或完整怪物尸体系统 | `LOOT_CORPSE`, `resolveCorpseLootTargets`, `corpseLootedByPlayerIdsThisTurn` | 尸体 token + 物品 / 预兆选择 | 领域定向测试、组件测试、`e2e/betrayal/first-scenario-corpse-loot.e2e.ts`、`evidence/betrayal-first-scenario-corpse-loot/betrayal-first-scenario-corpse-loot-e2e-test.md`、服务器相册 `http://8.148.71.102:18080/#/boardgame/betrayal-first-scenario-corpse-loot` | `implemented-verified` |
| 官方补充：障碍物 | 障碍物所在房间离开耗 2 移动力；作祟后敌对探索者 / 怪物也算障碍物 | 已补基础移动成本读模型：房间障碍标记、作祟后同房间敌对探索者、英雄同房间怪物都会把离开成本抬到 2；仍需路径预览和完整怪物阵营模型 | `movementCost` / `resolveBetrayalMoveCost`, `obstacles` | 路径预览显示耗费 | 房间标记 / 敌对探索者 / 怪物障碍物移动测试已覆盖 | `implemented-needs-remodel` |
| 20 作祟条目结构 | 识别、介绍设置、目标、指示物、重要地点、其他规则、If You Win、怪物盒 | 已补 50 个作祟源段页码账本和逐作祟子账本，子账本按源段锁定、公开 / 私密、setup、目标、特殊行动、持续规则、token / 怪物、UI 和验证拆分；新增 `resolveBetrayalHauntTokenInstances` 统一只读运行态目录，可从房间标记、驱魔圈、灰尘疾病 / 研究 token、怪物、尸体和魔法相机 Essence 派生 id、类型、房间、owner、可见性、来源、状态和代表边界；新增 `resolveBetrayalHauntSetupCommandPreviews` 把代表作祟 setup 条目转成后续正式命令可消费的预览合同。这只证明“规则合同已落账 + 现有运行态可枚举 + setup 命令预览可派生”，不代表 `HauntDefinition` 运行时、正式逐作祟 setup 命令、token 面板、If You Win 原文展示或 50 个 E2E 已完成 | `docs/games/betrayal/haunt-contract-ledger.md`, `docs/games/betrayal/haunts/*`, `resolveBetrayalHauntTokenInstances`, `resolveBetrayalHauntSetupCommandPreviews`, 后续 `HauntDefinition` | 剧本书分区 + 目标条；运行态 token 目录；setup 命令预览仍是领域合同；运行时仍需按合同逐作祟接入 setup 和 UI | 本地已有 50 个 `docs/games/betrayal/haunts/*.md` 子账本；源段账本 1-50 均标记 `contract-ready`；token 目录领域测试覆盖房间标记、疾病隐私、驱魔圈、研究 token、怪物、尸体；setup 命令预览测试覆盖灰尘、援手和魔法相机代表链；后续仍需 schema 机检和逐作祟实现证据 | `implemented-needs-remodel` |
| 20 怪物盒 | 怪物名、属性、特殊规则、特殊行动仅适用于该怪物 | 怪物盒字段已进入逐作祟子账本，例如杰克之灵、巨魔手、无脸人、幻影摄影师等都记录怪物属性 / token / 不可击晕或特殊攻击；但通用怪物 catalog、怪物类型移动骰、击晕 / 杀死状态机和全部怪物行动 UI 仍未统一实现 | `docs/games/betrayal/haunts/*`, 后续 `monsterDefinitions`, `monsterActionSet` | 怪物卡 / 地图 token / 作祟目标条；运行时只能使用已实现代表怪物链 | 子账本字段已落账；12 号巨魔手和 33 号幻影摄影师只是代表链，完整怪物系统仍看第 26 组缺口 | `contract-ready` |
| 21 进行作祟 | 仍按正常回合，使用新行动和目标；不再作祟检定；敌对方成为障碍物 | 已补基础作祟后探索口径：英雄和叛徒在作祟后仍可走普通探索入口、放置新房间并结算发现，但不会再触发作祟检定；真实入口 E2E 已证明作祟后叛徒仍可探索、房间本体目标高亮、放置新房间并回到作祟牌桌；不选择跳过事件时即时事件牌会正常结算，仍不再进行作祟检定。这一切片只证明基础探索继续可用，不代表完整作祟目标、怪物回合或逐剧本特殊行动完成 | `phase=haunt`, `hauntRuntime`, `teams`, `monsterTurns`, `recentRoll` | 目标条 + 主动作槽 + 普通探索入口 | 领域定向测试覆盖作祟阶段探索新房间且不再作祟检定、叛徒不选择跳过事件时正常结算即时事件；Board 定向测试覆盖首剧本真实 haunt 态桌面 / 移动探索入口可见；真实入口 E2E 和截图核验证据见 `evidence/山屋惊魂-作祟后探索与跳过事件完整链路/e2e-test.md` | `implemented-needs-remodel` |
| 22 计数轨 / 参考资料 | 某些作祟用 0-9 计数轨记录时间 / 进度 / 力量等；玩家参考卡、作祟书和怪物参考卡必须按阶段与阵营控制权限 | 已补通用 `numberTracks[]` 读模型原语：作祟前 `haunt-risk` 表达预兆风险，作祟 1 / 3 / 33 代表运行态分别派生驱魔圈、研究 token、摄影师 / 相机、Essence 进度，并标记 `representativeOnly`；新增 `resolveBetrayalReferenceCardAccess` 参考资料权限读模型，作祟前只开放基础参考卡，公开叛徒作祟区分英雄书 / 叛徒书，隐藏叛徒作祟不开放叛徒书，有怪物运行态才开放怪物参考卡。仍缺实体指针、完整配件 catalog、玩家可调整计数轨命令、参考资料 UI 接线和 50 个作祟逐条合同 | `numberTracks[]`, `resolveBetrayalReferenceCardAccess` | 牌堆区风险进度条；后续作祟目标条 / 计数轨 / 参考资料入口权限 | 领域单测覆盖风险轨、作祟目标代表轨和参考资料权限；Board 组件测试覆盖牌堆区进度条；参考资料 UI 接线仍需后续补测 | `implemented-needs-remodel` |
| 23 寻找特定板块 | 可查看房间堆作为参考，必要时搜索，完成后重洗 | 已补领域层搜索预览和执行原语：`resolveBetrayalTileStackSearchPreview` 可按房名 / 房间图 ID / 楼层判断目标是否已在屋内、房间堆候选、是否可搜索、命中后是否移除并重洗；`applyBetrayalTileStackSearch` 会命中移除目标并重洗剩余房间堆，同时同步按楼层派生堆；未命中不会移除或误洗。当前还不是玩家可见搜索面板，也未接入逐作祟 setup 放置流程 | `resolveBetrayalTileStackSearchPreview`, `applyBetrayalTileStackSearch`, `tileStackSearch`, `reshuffleAfterSearch` | 后续搜索面板 / 自动重洗提示；当前只在领域层可复用 | 定向单测覆盖命中预览、目标已在屋内阻止重复搜索、命中移除 + 重洗、未命中不改堆；后续仍需逐作祟 setup 和 UI 测试 | `implemented-needs-remodel` |
| 24 叛徒选择 | 通常为作祟揭秘者；也可能最高 / 最低属性，平局从揭秘者最近的回合顺序判定；左侧叛徒排除揭秘者 | 已补代表 resolver：1 / 3 / 12 / 33 进入真实触发链；并在同一读模型中登记左侧玩家、最高 / 最低属性、持有预兆最多、年龄最大等合同策略。除代表作祟外仍标记为待完整剧本接入，年龄数据尚未接入角色模型 | `hauntTraitorResolution.policy`, `candidatePlayerIds`, `excludedPlayerIds`, `tieBreak`, `representativeOnly` | 揭示层如需展示只能短原因；完整策略说明进剧本书 / 帮助层 | 叛徒策略代表单测已覆盖；后续需逐作祟策略和 tie-break 完整测试 | `implemented-needs-remodel` |
| 24 自愿替代叛徒 | 指定叛徒不愿意时可由其他玩家自愿，交换位置并传递触发卡 | 已补只读交互模型和结算预览模型：一名公开叛徒作祟会给出指定叛徒、可自愿替代玩家、触发牌持有人和“需要换位 / 转移触发牌”口径；预览会区分指定叛徒接受、无人自愿、自愿者替代和非法志愿者，并显式列出角色变化、换位目标、触发牌转移、叛徒强化 / 首玩家 / setup 重算缺口；隐藏叛徒、无叛徒和自由混战不会错误进入替代流程。当前仍缺正式接受 / 拒绝命令、真实状态写入、揭示层 UI 和完整 setup 时机接入 | `resolveBetrayalTraitorVolunteerInteraction`, `resolveBetrayalTraitorVolunteerResolutionPreview`, 后续 `TraitorVolunteerInteraction`, `volunteerCandidates`, `triggerCardTransfer` | 后续揭示层确认弹窗 + 短原因；当前预览模型可供 UI / 命令设计使用 | 定向单测覆盖一名公开叛徒候选、自由混战禁用、自愿者替代预览、无人自愿保留指定叛徒、非法志愿者阻止；后续补正式命令和真实入口 | `implemented-needs-remodel` |
| 25 叛徒能力 | 可忽略伤害性房间效果；仍需掷神秘电梯 / 滑洗衣滑槽；可忽略事件符号，但若抽事件必须正常结算 | 已补 `resolveBetrayalTraitorPowerStatus` 读模型、房间效果代表链和作祟后探索事件符号切片：叛徒在火炉房忽略房间伤害；在倒塌房间仍进行速度检定并坠落，但免坠落伤害；洗衣滑槽仍强制滑到地下室起始点；神秘电梯在作祟后仍可走既有房间效果命令。作祟后探索已放开，叛徒探索带事件符号的新房间时可选择跳过事件，不抽事件牌、不结算事件、不产生作祟检定；真实入口截图已覆盖选中跳过、探索目标高亮、事件符号结果提示和关闭后回作祟牌桌；也已覆盖不选择跳过事件时抽取“阴影扑面”并即时结算力量 -1、事件牌回到底部、无作祟检定。当前仍不等于需要玩家选择 / 检定 / 延迟确认的完整阻塞式事件牌 UI 完成 | `traitorPowers`, `resolveBetrayalTraitorPowerStatus`, `ignoredByTraitorPower`, `ignoreEventSymbolWithTraitorPower` | 房间效果短反馈；探索选项短按钮“跳过事件” | 叛徒能力领域测试覆盖火炉房、倒塌房间、洗衣滑槽、神秘电梯、作祟后探索、事件符号跳过边界和不选择跳过事件时正常即时结算；Board 定向测试覆盖叛徒作祟后探索事件符号时按钮可见并能跳过事件；真实入口 E2E 和截图核验证据见 `evidence/山屋惊魂-作祟后探索与跳过事件完整链路/e2e-test.md` | `implemented-needs-remodel` |
| 26 怪物属性 | 怪物通常固定属性，不升降 | 已补怪物状态读模型和初始官方怪物定义 catalog：`resolveBetrayalMonsterStatuses` 会把力量 / 速度 / 神志 / 知识输出为固定属性，并明确 `usesTraitTrack=false`，避免把怪物误接到探索者属性轨；`monsterDefinitions` 已先纳入杰克之灵、狂热病患、巨魔手、幻影摄影师、石像小天使、恶魔地产经纪人、镜中怪物和管家。当前只证明 8 个定义底座和石像小天使定义 / 视线移动 / 英雄进入新视线伤害 / 怪物回合结束凝视伤害 / 自然怪物回合代表入口，不代表完整怪物定义 catalog 或 50 个作祟怪物完成 | `monsterDefinitions`, `monsterStatus[].traits`, `usesTraitTrack=false`, `definitionId` | 怪物卡 / 后续怪物状态层 / Board 底部怪物动作槽代表链 | 怪物状态读模型定向领域测试；石像小天使真实入口 E2E 证明定义被移动骰、真实 token 移动、视线内不移动、进入视线停步、英雄进入新视线伤害、怪物回合结束凝视伤害消费，以及揭秘者结束英雄回合后自然进入石像小天使怪物回合；仍需怪物卡 UI、逐作祟 setup 和 50 个作祟怪物合同接入 | `implemented-needs-remodel` |
| 26 怪物受伤 | 通常受伤变击晕；回合开始若已击晕则翻正并结束该怪物回合；有些被杀死 / 不能击晕 | 已补统一状态读模型、怪物受伤结果原语、正式怪物受伤命令、回合开始结算预览和正式回合开始命令：`resolveBetrayalMonsterDamageOutcome` 会把正数伤害结算成 none / resisted / stunned / killed，巨魔手和杰克之灵会标为不可击晕，幻影摄影师力量伤害杀死并移出房子、非力量伤害击晕；`RESOLVE_MONSTER_DAMAGE` 会复用该原语，把击晕 / 击杀结果写入通用 `monsterStatusesById` 运行态，已覆盖幻影摄影师击晕 / 击杀和狂热病患击晕，避免“日志说击晕但状态不变”；现有巨魔手和幻影摄影师攻击链已复用该结果写入 `monsterDamageOutcome`，避免攻击结算各自硬编码击晕 / 杀死判断；幻影摄影师可区分 active / stunned / killed，已杀死的幻影摄影师以 `roomId=null` 和 `removedFromHouse=true` 表达移出房子；击晕状态会标记不减缓英雄移动；`resolveBetrayalMonsterTurnStartStatus` 会在怪物回合开始时把已击晕怪物判定为“翻正并跳过本次回合”；`resolveBetrayalMonsterTurnStartResolutionPreview` 会进一步列出击晕怪物翻正 / 移除击晕标记 / 跳过、活跃怪物进入移动骰、已杀死怪物跳过和状态展示合同；`RESOLVE_MONSTER_TURN_START` 会写入本回合已处理 / 已跳过运行态，击晕怪物翻正后不会重新进入本回合移动或攻击。当前已补 Board 底部动作栏代表接线，能从动作槽触发幻影摄影师开回合、移动骰和地图房间本体移动；仍缺完整怪物动作 UI、路径预览 UI、完整多怪物 / 逐作祟翻面回归、逐作祟特殊受伤 / 特殊攻击覆写、全部怪物攻击目标全量回归和 50 个作祟怪物定义接入 / 完整回归 | `monsterStatus`, `resolveBetrayalMonsterDamageOutcome`, `RESOLVE_MONSTER_DAMAGE`, `monsterDamageOutcome`, `monsterTurnStartStatus`, `monsterTurnStartResolutionPreview`, `monsterTurn`, `canBeStunned`, `stunned`, `killed`, `removedFromHouse`, `slowsHeroMovement` | Board 底部怪物动作槽代表链；怪物 token 击晕短标记 / 翻正恢复已有真实入口代表链，完整多怪物翻面回归仍后续 | 怪物受伤结果 / 状态 / 受伤正式命令 / 回合开始 / 正式命令定向领域测试；Board 组件测试覆盖幻影摄影师动作槽移动代表链、杰克之灵攻击槽代表链，以及击晕怪物 token 短标记 / 开回合翻正跳过代表链；真实入口 E2E 覆盖魔法相机幻影摄影师击晕 token / 开回合翻正跳过代表链，证据见 `evidence/山屋惊魂-怪物击晕翻正完整链路/e2e-test.md`；仍需完整状态机、全部怪物攻击目标全量回归、完整多怪物 / 逐作祟翻面回归 | `implemented-needs-remodel` |
| 26 怪物移动 | 怪物回合开始按速度掷骰决定移动，至少 1；同类型怪物只掷一次，多类型各掷一次 | 已补移动分组读模型、移动骰组结果合同、正式移动骰组命令和正式路径移动命令：`resolveBetrayalMonsterMovementGroups` 会按怪物名称 + 速度聚合可行动怪物，输出同组怪物、速度骰数和最低移动 1，并排除已跳过本回合、被击晕或已杀死怪物；`resolveBetrayalMonsterMovementRollGroupPreview` 会预览同组只掷一次、哪些怪物会写入移动额度和后续路径 UI 缺口；`createBetrayalMonsterMovementRollGroupResult` 会按山屋骰面生成同组移动骰结果，且总和为 0 时仍给最低 1 移动；`ROLL_MONSTER_MOVEMENT_GROUP` 会把移动骰结果和同组怪物移动额度写入 `monsterTurn` 运行态；`MOVE_MONSTER_TO_ROOM` 会要求已掷出移动额度，只允许移动到已发现且真实连接的房间，并按 `resolveBetrayalMonsterMoveCost` 扣减剩余移动；作祟 5 石像小天使已接入“视线内开始回合不移动”和“进入任一英雄视线后立即停止”的专属移动覆写。当前已补魔法相机幻影摄影师的 Board 动作槽代表链：开回合、掷移动骰、关闭骰盘、进入移动模式、点击地图房间本体移动并显示反馈；首剧本杰克之灵和非杰克普通怪物都已有真实入口路径预览代表链：怪物移动槽、怪物 token、相邻房间高亮、点击房间本体移动和状态同步；作祟 1 已补叛徒死亡后上一名英雄结束回合自然进入杰克之灵速度 3 移动骰的真实入口代表链；同类型两只普通怪物代表链已证明同组一次移动骰后，玩家可逐只点击怪物 token 和房间本体移动，移动额度按怪物分别扣减；多类型普通怪物也已补真实入口代表链，证明第一组“慢速怪物移动骰”掷完并关闭骰盘后，动作栏继续开放第二组“快速怪物移动骰”，全部移动骰组掷完后才进入怪物移动槽，并可分别点击两种怪物 token 查看目标房间高亮；石像小天使代表链证明视线内开始回合不会进入移动骰组，非视线起点可移动，进入英雄视线后剩余移动清零；英雄进入本回合开始时未在自己视线内的石像小天使视线时，会触发 2 骰一般伤害且每回合最多一次；石像小天使怪物回合结束凝视伤害也已接到真实动作栏和一般伤害分配队列；“玩躲猫猫”已补底部主动作、同房石像小天使 token、视线内石像小天使 token、Mirror 加值成功成对移除代表链；已补移除最后两只后的英雄胜利真实入口终局、失败时一般伤害分配真实入口，以及全部英雄死亡后的作祟胜利真实入口终局。仍缺全部怪物类型接入、完整多怪物自然回合全排列、全部作祟特殊相邻 / 移动覆写、全部怪物攻击目标全量回归和 50 个作祟怪物回归；石像小天使已补视线外房间不足时缺口为 1 的玩家补放真实房间选择 UI、缺口为 2 时同房重复补放真实入口，以及多英雄连续凝视伤害分配真实入口；12 号巨魔手已有代表运行链，但不代表完整怪物系统 | `monsterMovementRollByType`, `monsterMovementGroups`, `monsterMovementRollGroupPreview`, `monsterMovementRollGroupResult`, `MOVE_MONSTER_TO_ROOM`, `resolveBetrayalMonsterMoveCost`, `monsterTurn`, `diceCount`, `minimumMoveAllowance`, `isRoomInAnyLivingHeroLineOfSight`, `bloodFromStoneNewLineOfSightDamage`, `PLAY_PEEKABOO`, `resolveBloodFromStonePeekabooOptions` | Board 底部怪物动作槽代表链 / 怪物 token / 相邻房间本体高亮 / 一般伤害分配面板 / “玩躲猫猫”双 token 选择态 / 终局页分支 | 怪物移动分组 / 移动骰组命令 / 正式移动命令定向领域测试；Board 组件测试覆盖幻影摄影师动作槽移动代表链；领域测试覆盖同类型普通怪物共用一次移动骰、逐只独立扣减移动额度、多类型普通怪物分组掷骰 / 第一组后继续开放第二组，以及石像小天使视线内不移动 / 进入视线停步 / 英雄进入新视线伤害 / 怪物回合结束凝视伤害 / “玩躲猫猫”成功与失败 / 多缺口同房重复补放 / 移除最后两只后英雄胜利 / 全部英雄死亡后作祟胜利；真实入口 E2E 覆盖杰克之灵路径预览代表链、非杰克普通怪物路径预览代表链、同类型多只普通怪物逐只移动代表链、多类型普通怪物连续移动骰组代表链，以及石像小天使 setup 自动放置 / 单缺口与多缺口补放 / 视线停步 / 英雄进入新视线伤害 / 怪物回合结束凝视伤害 / “玩躲猫猫”成功双 token 选择代表链、失败伤害分配真实入口、英雄胜利终局真实入口和作祟胜利终局真实入口，证据见 `evidence/山屋惊魂-杰克之灵怪物路径预览完整链路/e2e-test.md`、`evidence/山屋惊魂-普通怪物路径预览完整链路/e2e-test.md`、`evidence/山屋惊魂-多怪物同组移动完整链路/e2e-test.md`、`evidence/山屋惊魂-多类型怪物移动骰组真实入口/e2e-test.md`、`evidence/山屋惊魂-石像小天使怪物定义真实入口/e2e-test.md`；仍需逐作祟回归 | `implemented-needs-remodel` |
| 26 怪物邻接 | 怪物可把地下室平台和一楼楼梯视为相邻 | 已补通用怪物移动目标读模型：`resolveBetrayalMonsterMoveTargetRooms` 会从活跃怪物所在房间派生已发现相邻房间，复用现有门位 / 特殊连接规则，地下室登陆点的巨魔手可看到大阶梯；已击晕或已杀死怪物不会得到移动目标，且目标只返回已发现房间，避免怪物探索新板块；正式移动命令复用这些目标执行房间写回。当前杰克之灵和非杰克普通怪物相邻房间高亮均已有真实入口代表链；仍缺全部作祟专属特殊相邻合同和完整多怪物路径回归 | `monsterMoveTargetRooms`, `resolveBetrayalMonsterMoveTargetRooms`, `MOVE_MONSTER_TO_ROOM`, 后续 `monsterSpecialAdjacency` | 怪物路径预览 | 怪物移动目标读模型和正式移动命令定向领域测试；真实入口代表链见普通怪物 / 杰克之灵路径预览证据；仍需逐作祟特殊相邻回归 | `implemented-needs-remodel` |
| 26 怪物攻击 / 限制 | 默认力量攻击；可忽略伤害性房间；不能持有物品 / 预兆；不能探索新板块 | 已补怪物行动集合读模型、怪物动作槽读模型、普通攻击目标读模型、普通怪物正式攻击命令和命令级代表拦截：`resolveBetrayalMonsterActionSet(s)` 会表达活跃怪物默认可按力量走正常攻击规则、可忽略伤害性房间效果、不能持有物品 / 预兆、不能使用持有物行动、不能探索或发现新房间；击晕 / 已杀死 / 本回合已攻击怪物不会开放攻击；`resolveBetrayalMonsterActionPanel` 会把开回合、同类型移动骰、移动、攻击合成动作槽，并区分未掷移动骰不可移动、掷骰后开放目标、已攻击关闭攻击；`resolveBetrayalNormalMonsterAttackTargets` 会把普通怪物攻击目标限制为同房、存活、英雄侧探索者，排除叛徒和死亡英雄；`MONSTER_ATTACK_HERO` 会让非专用普通怪物按怪物力量攻击英雄，怪物赢时英雄进入物理伤害分配，英雄赢时怪物按通用怪物受伤结果受伤 / 击晕 / 抵抗，平手无伤，并记录该怪物本回合已攻击；杰克之灵仍复用既有杰克攻击链，幻影摄影师 / 巨魔手继续走作祟专用攻击命令；`isPlayerControllingMonster` 会在杰克之灵 / 狂热病患这类死亡玩家操控怪物回合中阻止持有物、预兆、兔脚、交易回应和搜尸类命令，同时不影响怪物移动与攻击。当前动作槽代表 UI 已落到 Board 底部动作栏，杰克之灵和非杰克普通怪物都有真实入口 E2E，能证明可从怪物动作槽点怪物 token 再点同房英雄 token 进入攻击骰盘 / 伤害分配；但这只证明普通攻击命令和代表点击链，完整多怪物自然回合、通用路径预览 UI、逐作祟特殊攻击覆写和 50 个作祟怪物定义仍未完成 | `monsterActionSet`, `resolveBetrayalMonsterActionSet`, `resolveBetrayalMonsterActionPanel`, `monsterActionSlot`, `resolveBetrayalNormalMonsterAttackTargets`, `MONSTER_ATTACK_HERO`, `monsterTurn.attackedMonsterIdsThisTurn`, `canHoldOmens=false`, `canDiscoverRoomTiles=false` | Board 底部怪物动作槽代表链；普通怪物攻击槽、怪物 token 和同房英雄 token 选择链；杰克之灵同房英雄目标高亮已有真实入口代表链；非杰克普通怪物攻击已有真实入口代表链 | 怪物行动集合 / 动作槽 / 普通攻击目标读模型 / 普通怪物正式攻击命令定向领域测试；Board 组件测试覆盖幻影摄影师动作槽移动代表链、杰克之灵攻击槽目标选择代表链和非杰克普通怪物从动作槽点怪物再点同房英雄攻击代表链；真实入口 E2E 覆盖首剧本杰克之灵怪物攻击槽、怪物 token、同房英雄 token 和攻击骰盘代表链，以及非杰克普通怪物攻击槽、怪物 token、同房英雄 token、叛徒 / 死亡英雄排除和伤害分配代表链；证据见 `evidence/山屋惊魂-杰克之灵怪物动作槽攻击完整链路/e2e-test.md`、`evidence/山屋惊魂-普通怪物攻击完整链路/e2e-test.md`；仍需逐作祟特殊攻击覆写、完整多怪物自然回合、通用路径预览 UI 和逐作祟回归 | `implemented-needs-remodel` |
| 27 死亡 | 作祟后才会死亡；死亡时立牌倒在房间变尸体，持有物保留在角色板旁，可被搜刮 | 已补死亡状态读模型：`resolveBetrayalDeathStateSummary` 会表达作祟死亡规则是否启用、存活 / 死亡探索者、尸体所在房间、尸体立牌应倒伏、尸体保留的物品 / 预兆、同房间当前探索者是否可搜刮，以及同一尸体本回合已搜刮后的禁用状态。当前仍缺完整死亡 UI 倒伏表现、所有作祟死亡变体、特殊尸体用途和变怪物 / 特殊胜负接入 | `deathState`, `resolveBetrayalDeathStateSummary`, `corpseInventory`, `corpseLootedByPlayerIdsThisTurn` | 倒伏角色 / 尸体 marker / 搜尸选择器 | 死亡状态 / 基础搜尸领域测试；基础搜尸 E2E 已覆盖尸体可搜刮；完整死亡链仍需补测 | `implemented-needs-remodel` |
| 27 终局 | 首个达成作祟目标的阵营获胜，朗读该方 If You Win | 已补代表终局结果和终局读模型：首剧本英雄驱魔成功 / 叛徒击倒全部英雄、灰尘英雄治愈 / 疾病全员转叛徒、魔法相机英雄砸毁相机 + 摄影师全灭 / 叛徒夺取全部本质均能进入 `phase=endgame` 并写入胜方、获胜者和剧本标识；新增 `resolveBetrayalEndgameReadModel` 会暴露胜方、赢家、`ifYouWinTextId`、If You Win 原文未接入状态、同时达成 / 平局政策缺口，避免通用胜负页冒充逐作祟结局。当前只证明代表作祟终局读模型，不代表全部 50 个作祟 If You Win 原文、同时完成 / 平局处理或 12 号完整终局完成 | `phase=endgame`, `endgameResult.hauntId`, `endgameResult.outcome`, `endgameResult.winners`, `endgameReadModel.ifYouWinTextStatus`, `endgameReadModel.simultaneousCompletionPolicyStatus`, `sys.gameover` | 终局页 + 剧本文本回看；后续终局页必须读取缺口状态，不能提前展示不存在的原文 | 首剧本、灰尘、魔法相机终局领域测试 + 终局读模型定向测试 + 首剧本终局 Board 测试；后续需逐作祟终局和 If You Win 文本证据 | `implemented-needs-remodel` |
| 28 角色描述 | 背景用于代入，不直接改变基础规则；角色板属性才是规则数据 | 角色 lore 与规则属性分离 | `characterLore`, `traitTracks` | 角色详情页 | 角色 catalog 测试 | `design-ready` |
| 29 索引 | 移动、攻击、作祟、卡牌、房间、属性、伤害死亡、骰子、计数轨、掩埋 | 索引入口全部能回链到账本行 | `ruleIndexMap` | 帮助层搜索 | 覆盖检查 | `design-ready` |
| 30 录入口径 | 基础规则优先中文扫描；作祟书单独；扩展单独；素材回图片；英文只对照 | source policy 写入项目文档，代码注释不得反向覆盖规则 | `sourcePolicy` | 开发文档 | 文档审计 | `design-ready` |

> 怪物移动 / 攻击补充（作祟 3）：狂热病患已有真实入口代表链，证明死亡叛徒自然进入速度 5 移动骰、返回牌桌后点击真实相邻房间移动、移动后交接给下一名玩家，并可从怪物动作槽选择同房英雄进入攻击骰盘。证据见 `evidence/betrayal-the-dust-feverish-natural-monster-turn/e2e-test.md`。这仍只覆盖作祟 3「灰尘」狂热病患自然怪物回合代表链，不代表灰尘完整感染交换、隐藏编号可见性、研究 / 治愈全路径、同时胜负政策、完整终局或其它作祟自然怪物回合完成。

> 伤害分配补充（作祟 3）：灰尘回合末未交换疾病代表链已证明当前探索者本回合没有交换疾病标记时，结束回合进入“灰尘冲动”2 点一般伤害分配；玩家选满属性并确认后才交给下一名玩家；隐藏叛徒因该伤害死亡时，确认分配后才变成狂热病患。证据见 `evidence/betrayal-the-dust-end-turn-damage-allocation/e2e-test.md`。这仍只覆盖该伤害分配切片，不代表感染交换全排列、隐藏编号可见性、研究 / 治愈全路径、同时胜负政策或完整终局完成。

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
| 作祟 3 | 子账本已补齐；已有狂热病患自然怪物回合代表链，覆盖死亡叛徒自然进入速度 5 移动骰、真实房间移动、攻击同房英雄和回合交接；已有未交换疾病回合末 2 骰一般伤害分配代表链，覆盖玩家确认分配后交接和隐藏叛徒确认分配后才变狂热病患；仍不能等同于灰尘完整作祟完成 | 后续实现继续检查感染交换、隐藏编号可见性、研究 / 治愈全路径、同时胜负政策和完整终局边界 |
| 作祟 12 | 子账本已补齐；现有代表链只能作为实现差距参考；当前子账本写的是奇异护符 / 巨魔手自由混战，运行时曾使用“大宅饿了”邪教徒 / 仪式房 / 裂隙链口径，二者必须单独审计；当前已接入官方 setup、奇异护符换手控制权、巨魔手初始放置、偷牌替代伤害、Board 组件里的巨魔手移动 / 结束怪物回合、巨魔手合击入口、巨魔手攻击伤害分配切片和真实入口移动 / 结束 / 合击 / 护符换手 / 无护符跳过代表截图证据 | 后续继续补完整自然怪物回合全排列和 12 号完整终局；不得把旧邪教徒 / 仪式房 / 裂隙链写成 12 号已一致 |
| 作祟 33 | 子账本已补齐；现有代表链只能作为实现差距参考；幻影摄影师通用怪物移动动作槽已有 Board 代表链，但 33 完整仍未完成 | 后续实现检查相机 / Essence / 叛徒口径、完整怪物攻击 / 路径 / 翻面和终局边界 |
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
2. 作祟揭示公开步骤和秘密可见性：已补代表读模型、轻量揭示提示、灰尘隐藏叛徒口径、setup 队列只留在领域状态不进入玩家前景、参考资料权限读模型、setup 命令预览合同，以及“揭示期单主焦点 / 返回牌桌后才恢复作祟进度、主动作、攻击或交换提示、武器选择和对应无障碍状态”的 UI 边界；仍需正式逐作祟 setup 确认命令、段落级可见性、参考资料 UI 接线和逐作祟公开设置。
3. 阵营模型支持四类作祟。
4. 怪物行动、击晕、移动和特殊能力。
5. 计数轨、特定房间搜索、叛徒选择策略、token / 重要地点运行态目录。

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
