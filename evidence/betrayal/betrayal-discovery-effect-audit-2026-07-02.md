# 山屋惊魂发现池效果实现审计（2026-07-02）

## 结论

当前山屋惊魂可以进入审计阶段，但第一批运行态审计结论必须写成：**发现池对象真相已成型，具体效果实现未收口**。

本轮审计已把房间、物品、预兆、事件放在同一套“对象真相 + 具体效果实现”口径下核对。当前代码已经建立 43 间房、11 张物品、9 张预兆、8 张事件的发现池；基础房间图合同已覆盖 32 个对象键，其中阁楼命中客房图面、书房/图书馆共用图书室 frame/hash，均已在合同中保留 frame-note，剩余 11 间仍待建合同。运行态已覆盖 11 个房间效果：火炉房、倒塌房间、洗衣滑槽、神秘电梯、礼拜堂、密道楼梯、墓园、器械库、书房、图书馆、长廊；另有 21 个对象键锁定为无房间文字效果或带 frame-note 的无文字效果。物品/预兆保持逐卡局部 L3；事件仍是项目占位通用模型，不能判为逐事件牌效果收口。因此当前结论是“房间发现池进入分批审计和局部 L3 补证阶段”，不能判为全部房间/卡牌效果已完成。

## 范围与真相源

| 范围 | 当前对象数 | 规则真相源 | 代码真相源 | 当前结论 |
| --- | ---: | --- | --- | --- |
| 房间发现池 | 43 间 | 基础规则书：发现新房间时必须先结算房间文字效果，再抽事件/物品/预兆 | `src/games/betrayal/scenarioConfig.ts` 的 `BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor` + `game.ts` 的发现/结束回合/进入触发房间效果结算 | 有房间名、提示、标签、图集、门位；32 个对象键已有基础房间图合同，11 个房间效果已进运行态；阁楼、书房/图书馆保留 frame-note；剩余 11 间仍待建合同 |
| 物品牌 | 11 张 | 基础规则书：抽到物品后读文本并持有；特殊行动可选，默认每回合一次，本回合新获得不能用；正式物品牌正面 atlas 裁图 | `BETRAYAL_DISCOVERY_POOLS.possessions.item` + `possessionAtlas.ts` + `temp/betrayal-possession-contract-crops/manifest.json` | 11 张发现池物品玩家可见显示名已按卡图合同对齐；legacy id 保留；奇怪的药品、急救包、地图、手电筒、头戴耳机、砍刀、骨制钥匙、兔脚均已有对应机制证据；地图的 legacy 复用对象按同一地图合同处理；物品层剩余风险主要是未来新增投骰入口必须复用兔脚最近投骰窗口，以及首剧本补充对象不得自动并入发现池通过结论 |
| 预兆牌 | 9 张 | 基础规则书：抽到预兆后读文本并持有；每次抽预兆必须进行 haunt roll；正式预兆牌正面 atlas 裁图 | `BETRAYAL_DISCOVERY_POOLS.possessions.omen` + `possessionAtlas.ts` + `ROOM_EXPLORED` | 9 张预兆玩家可见显示名已按卡图合同对齐；`omen-book` 作为 legacy id 保留；haunt roll 是预兆抽牌通用规则，不属于单卡效果；书本、狗、面具、头骨、圣符、盔甲、雕像、指环、匕首均已有对应机制证据；剩余风险是后续新增探索场景特例、非攻击致死来源、多目标页面入口或新检定消费者时，必须复用已有机制并补回归 |
| 事件牌 | 8 张 | 基础规则书：抽到事件后必须读牌面文本并执行；若有属性检定，只读并执行对应结果 | `BETRAYAL_DISCOVERY_POOLS.events` + `ROOM_EXPLORED` 事件结算 | 当前 8 张事件是项目内占位事件名 + 通用移动/属性效果，不是官方事件卡原文；只能证明事件抽取/弃牌/通用结算框架，不能写成逐事件牌效果通过 |

## 官方规则依据

| 规则点 | 官方依据 | 审计判据 |
| --- | --- | --- |
| 发现新房间必须结算房间文字 | `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:716-718` | 只录入房间名、门位、图集，不算房间效果实现 |
| 房间文字结算早于抽卡 | `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:720-724`、`782-786` | `ROOM_EXPLORED` 需要能表达“房间效果 -> 抽卡 -> 卡牌效果 -> 结束回合”顺序 |
| 事件牌要读文本并执行 | `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:731-740` | 事件不能只用通用 `move/trait` 模型替代，必须保留原文子句、检定和结果表 |
| 物品/预兆要读文本并持有 | `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:741-748` | 持有区只是对象归属；每张牌自身效果仍需独立审计 |
| 抽预兆必须 haunt roll | `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:749-753` | 预兆审计必须同时覆盖抽牌、持有、haunt roll 和预兆自身效果 |
| 特殊行动和常驻效果不同 | `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:812-838` | 物品/预兆效果必须拆成特殊行动、常驻效果、武器/攻击修正等不同子句 |
| 武器不能泛化为普通使用 | `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:965-975` | 武器牌必须走攻击修正/交易限制/本回合新获得限制，不应被 `USE_POSSESSION` 通用按钮吞掉 |
| 房间特殊效果真实存在 | `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:1267-1270` | 倒塌房间、火炉房、神秘电梯、洗衣滑槽等必须进入房间效果审计 |

## 房间效果真相表（首批文本源锁定）

本表只登记本轮已由官方文本或当前代码配置锁定的字段。场景书中的房间用法只作为“该房间可能被场景特例消费”的证据，不能替代基础房间图原文；基础房间图原文未锁定时，合同状态仍标为 `partial/blocked`，不得直接实现。

| 对象 | 类型 | 真相来源 | 官方原文/已锁文本 | 原子子句 | 结构化规则字段 | 合同状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 倒塌房间（collapsedRoom） | 房间 | `temp/betrayal-room-effect-crops/26-collapsedRoom.jpg`，SHA256 `BB296BD6DF843C78252C07EDFA1DBDF43D3F25544309B47FD14F1A5421F95975`；规则书锚点 `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:1265-1270` | 中文：若你在此板块结束你的回合，需进行一个速度检定。5+ 无事发生。4-0 将你的探险者放置在地下室起始点并承受一颗骰子的物理伤害。英文：If you end your turn on this tile, make a Speed roll. 5+ Nothing happens. 4-0 Place your explorer on the Basement Landing and take one die of Physical damage. | C1 结束回合在本板块触发；C2 进行速度检定；C3 5+ 无事发生；C4 4-0 移动至地下室起始点；C5 4-0 承受 1 骰物理伤害 | `trigger=end_turn_on_tile`; `actor=current_explorer`; `check=Speed roll`; `branches=[{range:"5+", result:"nothing"}, {range:"4-0", move:"Basement Landing", damage:{amount:"one die", type:"Physical"}}]`; `cleanup=not_applicable`; `name_note=图中文字译名为“崩塌的房间”，英文房间名与 defId 可锁定` | locked |
| 火炉房（furnaceRoom） | 房间 | `temp/betrayal-room-effect-crops/21-furnaceRoom.jpg`，SHA256 `D5B0BCF866D6D9AC870C404D7D5BBEED9E73B4D65A37AEC14F88A10EB49E90FE`；规则书锚点 `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:1265-1270` | 中文：若你在此板块结束你的回合，则承受1点物理伤害。英文：If you end your turn on this tile, take 1 Physical damage. | C1 结束回合在本板块触发；C2 承受 1 点物理伤害 | `trigger=end_turn_on_tile`; `actor=current_explorer`; `check=none`; `payment=none`; `result=take_damage`; `damage={amount:1, type:"Physical"}`; `movement=none`; `cleanup=not_applicable` | locked |
| 神秘电梯（mysticElevator） | 房间 | `temp/betrayal-room-effect-crops/41-mysticElevator.jpg`，SHA256 `DF5E22C61061069343CCDA574883B7F3EB7A41100E5F4C43569313B775885E11`；规则书锚点 `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:1269` | 中文：每回合一次，当你进入亚板块时，你可以投掷两颗骰子，并将神秘电梯移动至下列楼层的某个开放的门口。4+ 任一区域。3 上层楼层。2 地面楼层。0-1 地下室楼层。英文：Once per turn when you enter this tile, you may roll two dice. Move the Mystic Elevator to an open doorway on: 4+ Any region. 3 Upper Floor. 2 Ground Floor. 0-1 Basement. | C1 每回合一次；C2 进入本板块时可触发；C3 玩家可以选择投 2 骰；C4 按结果移动神秘电梯；C5 4+ 任一区域开放门口；C6 3 上层楼层开放门口；C7 2 地面楼层开放门口；C8 0-1 地下室楼层开放门口 | `trigger=enter_tile`; `frequency=once_per_turn`; `actor=entering_explorer`; `optional=true`; `roll=two_dice`; `target=Mystic Elevator tile`; `destination=open_doorway`; `branches=[{range:"4+", region:"Any region"}, {range:"3", region:"Upper Floor"}, {range:"2", region:"Ground Floor"}, {range:"0-1", region:"Basement"}]`; `damage=none`; `cleanup=not_applicable` | locked |
| 洗衣滑槽（laundryChute） | 房间 | `temp/betrayal-room-effect-crops/12-laundryChute.jpg`，SHA256 `273D07F7738B65E8CF9DDF8F67E9942435DA0D8F19AD613E50BD737C4AF48151`；规则书锚点 `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md:1269-1270` | 中文：通向地下室起始点。若你在此板块结束你的回合，将你的探险者放置在地下室起始点。英文：Leads to the Basement Landing. If you end your turn on this tile, place your explorer on the Basement Landing. | C1 静态连接/通向地下室起始点；C2 结束回合在本板块触发；C3 将探险者放置到地下室起始点 | `trigger=end_turn_on_tile`; `static_effect=leads_to_Basement_Landing`; `actor=current_explorer`; `check=none`; `payment=none`; `result=place_explorer`; `movement={destination:"Basement Landing"}`; `damage=none`; `cleanup=not_applicable` | locked |
| 观测台（observatory） | 房间 | `temp/betrayal-room-contract-batch-2026-07-03/00-observatory-观测台.jpg`，SHA256 `8DBA28D2C69AC3B3702B65D6F1CEE4D98758E1E5A8683C4910DF82A69C8A429E` | 无房间文字；可见房间名 `天文台 / OBSERVATORY`；可见 1 个预兆牌图标 | C1 无需要执行的房间文字效果；C2 发现/进入该房间本身不触发文字规则；C3 仅存在预兆牌图标信息 | `visualId=observatory`; `frameIndex=0`; `hasRoomTextEffect=false`; `cardIcons=[omen]`; `effectKind=none`; `notApplicableReason=房间裁图中没有房间文字效果，仅有抽牌图标` | locked-no-effect |
| 温室（conservatory） | 房间 | `temp/betrayal-room-contract-batch-2026-07-03/07-conservatory-温室.jpg`，SHA256 `3F9EE187327768AC4B238BA2C5A075BD444DD7A16EB0CD23981DD764AC596F4A` | 无房间文字；可见房间名 `温室 / CONSERVATORY`；可见 1 个物品牌图标 | C1 无需要执行的房间文字效果；C2 发现/进入该房间本身不触发文字规则；C3 仅存在物品牌图标信息 | `visualId=conservatory`; `frameIndex=7`; `hasRoomTextEffect=false`; `cardIcons=[item]`; `effectKind=none`; `notApplicableReason=房间裁图中没有房间文字效果，仅有抽牌图标` | locked-no-effect |
| 墓园（graveyard） | 房间 | `temp/betrayal-room-contract-batch-2026-07-03/08-graveyard-墓园.jpg`，SHA256 `8971219AF62D9062F085B00D069784C1C8B9E1BAB3DBBE717B16A527F8C7156B` | 中文：通向地下洞穴。英文：Leads to the Underground Cavern. | C1 该房间提供通往地下洞穴的固定连通关系 | `visualId=graveyard`; `frameIndex=8`; `trigger=static_link`; `effectKind=fixed_link`; `linkTargetRoomZh=地下洞穴`; `linkTargetRoomEn=Underground Cavern`; `targetVisualId=undergroundCavern`; `cardIcons=[omen]` | locked |
| 舞厅（ballroom） | 房间 | `temp/betrayal-room-contract-batch-2026-07-03/04-ballroom-舞厅.jpg`，SHA256 `DAF3ED153BD6D7C505C40432766CF0642F89BFA7C5603F283101EA15B6E6A69C` | 无房间文字；可见房间名 `舞厅 / BALLROOM`；可见 1 个预兆牌图标 | C1 无需要执行的房间文字效果；C2 发现/进入该房间本身不触发文字规则；C3 仅存在预兆牌图标信息 | `visualId=ballroom`; `frameIndex=4`; `hasRoomTextEffect=false`; `cardIcons=[omen]`; `effectKind=none`; `notApplicableReason=房间裁图中没有房间文字效果，仅有抽牌图标` | locked-no-effect |
| 金库（vault） | 房间 | `temp/betrayal-room-contract-batch-2026-07-03/13-vault-金库.jpg`，SHA256 `A1790CFAB3B5C44A818BDDA0C92B9367AFB9B5DDD2DDDE353B6E9530ED37D9C`；场景特例见 `docs/games/betrayal/sources/official/betrayal-3e-secrets-of-survival-en.md:1127-1131`、`docs/games/betrayal/sources/official/betrayal-3e-traitors-tome-en.md:215-219` | 无房间文字；可见房间名 `金库 / VAULT`；可见 2 个物品牌图标 | C1 无需要执行的房间文字效果；C2 发现/进入该房间本身不触发文字规则；C3 仅存在物品牌图标信息 | `visualId=vault`; `frameIndex=13`; `hasRoomTextEffect=false`; `cardIcons=[item,item]`; `effectKind=none`; `scene_note=场景书特例不得当作基础房间效果` | locked-no-effect |
| 裂隙（chasm） | 房间 | `temp/betrayal-room-contract-batch-2026-07-03/14-chasm-裂隙.jpg`，SHA256 `AFFBC395C5F4F8EA451EFD04441C4B5242F796AB30EAC36B41956157738C2D7E`；场景特例见 `docs/games/betrayal/sources/official/betrayal-3e-traitors-tome-en.md:414-415`、`439-444` | 无房间文字；可见房间名 `深渊 / CHASM`；可见 1 个预兆牌图标 | C1 无需要执行的房间文字效果；C2 发现/进入该房间本身不触发文字规则；C3 仅存在预兆牌图标信息 | `visualId=chasm`; `frameIndex=14`; `hasRoomTextEffect=false`; `cardIcons=[omen]`; `effectKind=none`; `name_note=图中文字译名为“深渊”，当前代码名为“裂隙”`; `scene_note=场景书特例不得当作基础房间效果` | locked-no-effect |
| 地下湖（undergroundLake） | 房间 | `temp/betrayal-room-contract-batch-2026-07-03/18-undergroundLake-地下湖.jpg`，SHA256 `F0B1A720C0A190280057CF2E6C5477E3E010C6666965C28AF526284193E2BA34`；场景特例见 `docs/games/betrayal/sources/official/betrayal-3e-secrets-of-survival-en.md:1469-1480`、`1498-1501` | 无房间文字；可见房间名 `地下湖 / UNDERGROUND LAKE`；可见 1 个预兆牌图标 | C1 无需要执行的房间文字效果；C2 发现/进入该房间本身不触发文字规则；C3 仅存在预兆牌图标信息 | `visualId=undergroundLake`; `frameIndex=18`; `hasRoomTextEffect=false`; `cardIcons=[omen]`; `effectKind=none`; `scene_note=场景书特例不得当作基础房间效果` | locked-no-effect |
| 密道楼梯（secretStaircase） | 房间 | `temp/betrayal-room-contract-batch-2026-07-03/20-secretStaircase-密道楼梯.jpg`，SHA256 `3C6C3BC638025BE6C6313B025B64F7EA8E6873297705978E5D809E689D94521C`；场景特例见 `docs/games/betrayal/sources/official/betrayal-3e-secrets-of-survival-en.md:1831-1834` | 中文：通向门厅。英文：Leads to the Hallway. | C1 该房间提供通往门厅的固定连通关系 | `visualId=secretStaircase`; `frameIndex=20`; `trigger=static_link`; `effectKind=fixed_link`; `linkTargetRoomZh=门厅`; `linkTargetRoomEn=Hallway`; `name_note=图中文字译名为“秘密楼梯”，当前代码名为“密道楼梯”`; `scene_note=场景书特例不得当作基础房间效果` | locked |

## 审计总表

| 对象层 | 对象真相/归属 | 具体效果实现 | 当前等级 | Finding |
| --- | --- | --- | --- | --- |
| 43 间房 | 已列入发现池；按楼层拆为一层 18、上层 15、地下 10；每间有 `visualId` 与 `doorways`；32 个对象键已有基础房间图合同，含阁楼命中客房图面、书房/图书馆共用图书室 frame/hash 两类 frame-note | `BetrayalRoomDiscoveryTemplate.discoveryEffect` 已承载礼拜堂发现时 +1 神志、书房/图书馆发现时 +1 知识、器械库发现时从物品牌堆展示直到武器；`endTurnEffect` 已承载 3 个结束回合效果；`enterEffect=mysticElevator` 已承载神秘电梯进入触发；`resolveConnectedRoomIds` 已承载密道楼梯->门厅、墓园->地下洞窟、长廊->舞厅固定连通 | L3 局部通过：11 个房间效果已运行态验证；21 个对象键锁定为无房间文字效果或带 frame-note 的无文字效果；剩余 11 间仍待建合同 | 后续重点转为剩余 11 间合同录入、frame-note 裁定与新增合同后的最小运行态补证 |
| 11 张物品 | 已在 item 牌堆；可进入持有区；使用命令存在一次/回合与本回合新获得不可立即使用门禁 | 已从正式物品牌正面裁图补录卡面合同；玩家可见显示名已对齐卡面标题；历史 `id` 继续作为 legacy alias 使用；奇怪的药品与急救包已接入 `healTraits` 专属效果、使用后移出持有区；地图已接入埋葬后放置到已发现板块；手电筒已接入事件属性检定额外骰；头戴耳机已接入精神伤害减免和通用伤害负向边界；砍刀已接入显式武器攻击；骨制钥匙已接入领域穿墙移动并补真实页面移动模式入口；兔脚已接入事件属性检定、神秘电梯房间投骰、攻击投骰非致死伤害回算、倒塌房间结束回合速度检定和头骨死亡保护后的单骰重掷、每回合一次门禁和对应结算回写 | L3 局部通过：11 张发现池物品都有对象合同和至少一个对应机制证据；奇怪的药品、急救包、地图、砍刀、骨制钥匙已有真实页面入口或攻击/移动入口验证；手电筒、头戴耳机、兔脚已有领域层或页面基础入口验证 | 物品层当前口径已更新为逐卡局部 L3；剩余风险收窄为未来新增投骰消费者必须复用兔脚窗口、legacy 复用对象不得重复脑补新机制、首剧本补充对象仍需单独登记 |
| 9 张预兆 | 已在 omen 牌堆；抽预兆会推进 haunt 相关计数 | 已从正式预兆牌正面裁图补录卡面合同；玩家可见显示名已对齐卡面标题；`omen-book` 继续作为 legacy alias 使用；书本、狗、面具、头骨、圣符、盔甲、雕像、指环、匕首均已从通用占位拆出对应机制：常驻检定、特殊行动、死亡替代、防具减伤、探索替换、事件跳过或攻击武器 | L3 局部通过：9 张发现池预兆都有对象合同和对应机制证据；狗、面具、圣符、雕像、指环、匕首已补真实页面入口或攻击/探索入口验证；书本、头骨、盔甲已有领域层消费者验证 | haunt roll 只属于抽预兆通用规则；剩余风险收窄为后续新增非攻击致死、探索场景特例、多目标 UI 或新检定消费者时，必须接入既有单卡机制并补回归 |
| 8 张事件 | 已在 event 牌堆；探索到事件房间时会抽取并写入弃牌数 | 当前配置只有项目占位事件名和通用 `move/trait` 即时数值模型；规则书只证明事件牌通用流程，未提供这 8 张牌的牌面原文、结果表、选择分支或逐事件结算合同 | L2 对象归属 + 通用占位效果，不是逐事件效果收口 | 8 张事件都未锁真实卡图/官方原文；后续不得把 `回廊顺风`、`窃窃低语` 等占位配置当官方事件牌继续实现 |

## 房间效果审计表

| 楼层 | 房间 | 门位 | 抽牌奖励 | 效果实现状态 |
| --- | --- | --- | --- | --- |
| ground | 观测台（observatory） | north/east/south/west | 1 个预兆 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算 |
| ground | 温室（conservatory） | east/south | 1 个物品 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算 |
| ground | 墓园（graveyard） | east/south | 1 个预兆 | 已实现：固定连通地下洞窟；`resolveConnectedRoomIds` 会在墓园与地下洞窟之间加入双向移动目标；已有领域测试 |
| ground | 舞厅（ballroom） | south/west | 1 个预兆 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算 |
| ground | 厨房（kitchen） | east/south/west | 无 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算 |
| ground | 餐厅（diningRoom） | north/west | 无 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算 |
| ground | 礼拜堂（chapel） | east/south | 无 | 已实现：`discoveryEffect=gainSanity1`，发现板块时让发现者获得 1 点神志；已有领域测试 |
| ground | 实验室（laboratory） | north/east | 无 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算 |
| ground | 金库（vault） | north/east | 2 个物品 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算；场景书特例不得当作基础房间效果 |
| ground | 火炉房（furnaceRoom） | east/south/west | 无 | 已实现：`endTurnEffect=physicalDamage1`，结束回合在火炉房时承受 1 点物理伤害；已有领域测试 |
| ground | 客房（guestQuarters） | east/south | 无 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算 |
| ground | 血腥房间（bloodyRoom） | north/east | 无 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算 |
| ground | 标本室（specimenRoom） | north/east/south | 无 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算 |
| ground | 沙龙（salon） | north/east/south | 无 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算 |
| ground | 主卧（primaryBedroom） | north/east/south | 无 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算 |
| ground | 育婴室（nursery） | north/east/south | 无 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算 |
| ground | 手术室（operatingTheatre） | north/east/south | 无 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算 |
| ground | 器械库（armory） | north/east/south | 无 | 已实现：`discoveryEffect=drawUntilWeapon`，发现时从物品牌堆顶展示直到武器，拿取武器并埋葬其余展示牌；已有领域测试覆盖拿砍刀、埋急救包、扣物品牌堆 |
| upper | 塔楼（tower） | south/west | 无 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算 |
| upper | 雕像走廊（statuaryCorridor） | north/east/south | 无 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算 |
| upper | 阁楼（attic） | south/west | 无 | frame-note：当前裁图实际文字为客房/GUEST QUARTERS，按图片文字锁为无房间文字效果；阁楼对象归属仍需后续裁定，不得当作无争议独立图面 |
| upper | 书房（study） | north/east | 无 | 已实现：`discoveryEffect=gainKnowledge1`，发现板块时让发现者获得 1 点知识；frame-note：图片实际文字为图书室/LIBRARY，与图书馆共 frame/hash；已有领域测试 |
| upper | 长廊（gallery） | north/south | 无 | 已实现：固定连通舞厅；`resolveConnectedRoomIds` 会在长廊与已发现舞厅之间加入移动目标；已有领域测试 |
| upper | 图书馆（library） | south/west | 无 | 已实现：`discoveryEffect=gainKnowledge1`，发现板块时让发现者获得 1 点知识；已有领域测试 |
| upper | 冬季卧室（winterBedroom） | east/south | 无 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算 |
| upper | 倒塌房间（collapsedRoom） | north/south | 无 | 已实现：`endTurnEffect=speedCheckFallToBasement`，结束回合速度检定失败时移至地下室起始点并承受 1 骰物理伤害；已有领域测试覆盖失败分支 |
| upper | 烧焦房间（charredRoom） | north/east | 无 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算 |
| upper | 管风琴室（organRoom） | north/east/south | 无 | 缺房间效果字段；未见触发/检定/状态结算 |
| upper | 隔音室（soundproofedRoom） | north/east/south | 无 | 缺房间效果字段；未见触发/检定/状态结算 |
| upper | 游戏室（gameRoom） | north/east/south | 无 | 缺房间效果字段；未见触发/检定/状态结算 |
| upper | 体育馆（gymnasium） | north/east/south | 无 | 缺房间效果字段；未见触发/检定/状态结算 |
| upper | 狭窄通道（crampedPassageway） | north/east/south/west | 无 | 缺房间效果字段；未见触发/检定/状态结算 |
| upper | 神秘电梯（mysticElevator） | north/east/south/west | 无 | 已实现：`enterEffect=mysticElevator`，当前探索者在神秘电梯时可点房间效果按钮，投 2 骰后按 4+/3/2/0-1 将电梯移动到对应楼层开放门口；`usedRoomEffectIdsThisTurn` 限制每回合一次；已有领域测试与页面测试 |
| basement | 洗衣滑槽（laundryChute） | north/east | 无 | 已实现：`endTurnEffect=moveToBasementLanding`，结束回合在本板块时将探险者放置到地下室起始点；已有领域测试 |
| basement | 裂隙（chasm） | north/south | 1 个预兆 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算；图中文字译名为“深渊”，当前代码名为“裂隙” |
| basement | 储物间（larder） | north/east | 无 | 缺房间效果字段；未见触发/检定/状态结算 |
| basement | 地下湖（undergroundLake） | north/west | 1 个预兆 | 已锁为无房间文字效果；发现/进入不需要新增房间效果结算；场景书特例不得当作基础房间效果 |
| basement | 地下洞窟（undergroundCavern） | east/south | 无 | 缺房间效果字段；未见触发/检定/状态结算 |
| basement | 仪式室（ritualRoom） | west/south | 无 | 缺房间效果字段；未见触发/检定/状态结算 |
| basement | 地下墓穴（catacombs） | north/south | 无 | 缺房间效果字段；未见触发/检定/状态结算 |
| basement | 密道楼梯（secretStaircase） | north/east | 无 | 已实现：固定连通门厅；`resolveConnectedRoomIds` 会在密道楼梯与门厅之间加入双向移动目标；已有领域测试 |
| basement | 杂物间（junkRoom） | north/east | 无 | 缺房间效果字段；未见触发/检定/状态结算 |
| basement | 爬行空间（crawlspace） | north/east | 无 | 缺房间效果字段；未见触发/检定/状态结算 |

## 物品/预兆具体效果实现审计表

### 物品牌录入合同

| 项目对象 | 卡图标题 | 图片路径 | 卡面原文 | 原子子句 | 结构化字段 | 合同状态 | 对当前实现的审计结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 魔法相机（camera） | Magic Camera | `temp/betrayal-possession-contract-crops/item-camera-full.jpg` | 咔嚓！你可以使用你的神志去代替进行知识检定。 | C1：进行知识检定时，可以使用神志代替知识。 | 时机=知识检定；目标=自己的检定；消耗=无；类型=常驻替代属性。 | C1 L3 局部通过 | `rollTraitCheck` 已通过魔法相机把知识检定改为可取更高的神志值，并覆盖调查杰克、研究法阵两个知识检定入口；魔法相机不再作为主动使用牌进入默认属性加成 |
| 急救包（medical-kit） | Medical Kit | `temp/betrayal-possession-contract-crops/item-medical-kit-full.jpg` | 人人有份。在你的回合内，你可以埋葬此急救包。若你如此做，治疗你的所有濒死属性。你可以对同板块的另一位探险者使用急救包治疗。 | C1：己方回合可埋葬急救包。C2：治疗所有濒死属性。C3：可对同板块另一位探险者使用。 | 时机=己方回合；目标=自己或同板块另一位探险者；消耗=埋葬；类型=特殊行动/治疗。 | C1-C3 L3 局部通过 | `USE_POSSESSION -> POSSESSION_USED` 已用 `healTraits` 治疗自己全部濒死属性，或治疗同板块另一位探索者；使用后从当前探索者持有区移除。领域单测覆盖自己治疗、同板块队友治疗、异板块目标拒绝 |
| 奇怪的药品（holy-water，legacy id） | Strange Medicine | `temp/betrayal-possession-contract-crops/item-holy-water-full.jpg` | 副作用包括颤抖、恶心和偏执狂。在你的回合内，你可以埋葬此奇怪的药品。若你如此做，治疗你的力量和速度。 | C1：己方回合可埋葬奇怪的药品。C2：治疗自己的力量和速度。 | 时机=己方回合；目标=自己；消耗=埋葬；类型=特殊行动/治疗。 | L3 局部通过 / legacy-id | 玩家可见显示名已改为“奇怪的药品”；`holy-water` 仅保留为内部 legacy id。`USE_POSSESSION -> POSSESSION_USED` 已用 `healTraits` 治疗当前探索者的力量和速度，并在使用后从持有区移除；领域单测覆盖治疗、埋葬、二次使用拒绝 |
| 手电筒（flashlight） | Flashlight | `temp/betrayal-possession-contract-crops/item-flashlight-full.jpg` | 注意：不要对着眼睛。在事件中，你可以在属性检定中多投2颗额外的骰子。 | C1：事件中的属性检定可多投 2 颗骰子。 | 时机=事件中的属性检定；目标=自己的检定；消耗=无；类型=场景特例/事件加骰。 | C1 L3 局部通过 | `rollEventTraitCheck` 已在事件属性检定中按手电筒持有状态额外多投 2 颗骰子；手电筒不再作为主动使用牌进入默认属性加成 |
| 头戴耳机（radio，legacy id） | Headphones | `temp/betrayal-possession-contract-crops/item-radio-full.jpg` | 它没有连接到任何东西，但仍然播放着曲子。听起来很舒缓。无论何时你受到精神伤害时，降低1点伤害值。（本耳机无法阻挡通用伤害，或是对知识/神志属性的直接降低） | C1：受到精神伤害时伤害值 -1。C2：不能阻挡通用伤害。C3：不能阻挡知识/神志直接降低。 | 时机=受到精神伤害时；目标=自己；消耗=无；类型=常驻减伤；例外=通用伤害和直接降属性。 | C1-C3 L3 局部通过 / legacy-id | 玩家可见显示名已改为“头戴耳机”；`radio` 仅保留为内部 legacy id。`applyMentalDamage` 已按头戴耳机持有状态把精神伤害降低 1 点，并由研究法阵失败入口证明；头戴耳机不再作为主动使用牌进入默认移动效果，且不会阻挡事件导致的知识直接降低；新增通用伤害事件入口证明头戴耳机不会减免通用伤害。 |
| 折叠地图（map） | Map | `temp/betrayal-possession-contract-crops/item-map-full.jpg` | 它的部分内容不断地变换着。不知何故，不同的门总是通向同一个地方。在你的回合内，你可以埋葬此地图。若你如此做，将你的探险者放置在任一板块上。 | C1：己方回合可埋葬地图。C2：将自己的探险者放置到任一板块上。 | 时机=己方回合；目标=自己的探险者；消耗=埋葬；类型=特殊行动/传送。 | C1-C2 L3 局部通过 | `USE_POSSESSION -> POSSESSION_USED` 已用 `placeExplorer` 把当前探索者放置到指定已发现板块，并在使用后从持有区移除；领域单测覆盖已发现板块成功和未发现板块拒绝 |
| 兔脚（rope，legacy id） | Rabbit's Foot | `temp/betrayal-possession-contract-crops/item-rope-full.jpg` | 对一些人来说是幸运的，但对另一些人来说不是。对兔子来说当然更不幸了。你的每个回合可使用一次，你可以使用此兔脚重掷一颗你刚刚投过的骰子。 | C1：每回合可使用一次。C2：重掷一颗刚刚投过的骰子。 | 时机=己方回合刚投骰后；目标=自己刚投过的 1 颗骰子；消耗=无；类型=每回合一次/重掷。 | C1-C2 事件属性检定 + 神秘电梯房间投骰 + 攻击投骰非致死伤害回算 + 倒塌房间结束回合速度检定 + 头骨死亡保护领域层，页面基础入口 L3 局部通过 / legacy-id | 玩家可见显示名已改为“兔脚”；`rope` 仅保留为内部 legacy id。已移除“移动 +1”主动使用占位，并用领域测试证明兔脚不会再被当成移动加成牌。运行时现在会保存事件属性检定、神秘电梯房间效果、攻击投骰、倒塌房间结束回合速度检定和头骨死亡保护的最近单颗骰子明细，`USE_RABBIT_FOOT -> RABBIT_FOOT_USED` 可选择刚投过的一颗骰子重掷：事件属性检定会按新总点数撤销旧事件分支并应用新分支，神秘电梯会基于投骰前房间状态按新总点数重新移动房间，攻击投骰会先还原非致死攻击伤害再按新攻击点数回算双方物理/精神伤害，倒塌房间会按新速度检定结果回算坠落与物理伤害，头骨死亡保护会按新 3 骰总点数决定阻止死亡或正常死亡；同回合二次使用会被拒绝。当前证明事件属性检定、神秘电梯房间投骰、攻击投骰非致死伤害回算、倒塌房间结束回合速度检定和头骨死亡保护后的领域层重掷，以及真实页面基础入口：选中兔脚后展示最近投骰按钮，点击指定骰子会派发兔脚重掷命令；未来新增投骰入口仍需复用最近投骰窗口并补回归 |
| 骨制钥匙（lockpick-tool，legacy id） | Skeleton Key | `temp/betrayal-possession-contract-crops/item-lockpick-tool-full.jpg` | 用真正的骨头制成的。你可以穿过墙壁。无论何时若你如此做，投一颗骰子。如果你投到一面空白，则埋葬此骨制钥匙。你不可以使用骨制钥匙去发现新房间。 | C1：可穿过墙壁。C2：每次穿墙投 1 颗骰子。C3：投到空白则埋葬。C4：不能用于发现新房间。 | 时机=移动/穿墙时；目标=自己；消耗=空白面时埋葬；类型=特殊移动。 | C1-C4 领域 + 页面入口 L3 局部通过 / legacy-id | 玩家可见显示名已改为“骨制钥匙”；`lockpick-tool` 仅保留为内部 legacy id。`MOVE_TO_ROOM` 已支持声明骨制钥匙穿过相邻但无门连接的已发现板块；每次穿墙会投 1 颗骰子，空白面会从持有区移除骨制钥匙；未发现板块会被拒绝；骨制钥匙已从主动使用效果表移除，不再显示或结算为“移动 +1”。真实页面移动模式已把骨制钥匙穿墙目标展示为可手动选择，并在点击目标时传入骨制钥匙穿墙命令。 |
| 砍刀（hunting-knife，legacy id） | Machete | `temp/betrayal-possession-contract-crops/item-hunting-knife-full.jpg` | 武器。依然锋芒毕露。当你使用砍刀进行攻击时，将你的投骰结果加1。（你每次攻击只能使用一把武器，你不允许在本回合将已经使用过的武器进行交易） | C1：使用砍刀攻击时投骰结果 +1。C2：每次攻击只能使用一把武器。C3：本回合已使用过的武器不能交易。 | 时机=使用该武器攻击时；目标=本次攻击投骰；消耗=无；类型=武器/攻击修正。 | C1-C3 L3 局部通过 / legacy-id | 玩家可见显示名已改为“砍刀”；`hunting-knife` 仅保留为内部 legacy id。`HAUNT_ATTACK` 现在只能在攻击命令显式带 `weaponCardId=hunting-knife` 时加入攻击投骰 +1，命令结构一次只能声明一把武器；`USE_POSSESSION` 不再把砍刀当通用力量 +1 主动使用牌；已使用砍刀会写入本回合已用持有物并阻止交易 |
| 地图（notebook，legacy id） | Map | `temp/betrayal-possession-contract-crops/item-notebook-full.jpg` | 同折叠地图卡面。 | C1：己方回合可埋葬地图。C2：将自己的探险者放置到任一板块上。 | 时机=己方回合；目标=自己的探险者；消耗=埋葬；类型=特殊行动/传送。 | C1-C2 L3 局部通过 / legacy-id | 玩家可见显示名已改为“地图”；`notebook` 仅保留为内部 legacy id。机制按地图合同审计，已接入同一 `placeExplorer` 运行态效果 |
| 地图（manuscript，legacy id） | Map | `temp/betrayal-possession-contract-crops/item-manuscript-full.jpg` | 同折叠地图卡面。 | C1：己方回合可埋葬地图。C2：将自己的探险者放置到任一板块上。 | 时机=己方回合；目标=自己的探险者；消耗=埋葬；类型=特殊行动/传送。 | C1-C2 L3 局部通过 / legacy-id | 玩家可见显示名已改为“地图”；`manuscript` 仅保留为内部 legacy id。机制按地图合同审计，已接入同一 `placeExplorer` 运行态效果 |
| 手电筒（lantern，首剧本补充 legacy id） | Flashlight | `possessionAtlas.ts` 复用手电筒帧 | 同手电筒卡面。 | C1：事件中的属性检定可多投 2 颗骰子。 | 时机=事件中的属性检定；目标=自己的检定；消耗=无；类型=场景特例/事件加骰。 | C1 L3 局部通过 / legacy-id | 首剧本起始物玩家可见显示名已改为“手电筒”；`lantern` 仅保留为内部 legacy id。机制按手电筒合同审计，已接入事件属性检定加骰 |
| 地图（journal，首剧本补充 legacy id） | Map | `temp/betrayal-possession-contract-crops/item-journal-full.jpg` | 同折叠地图卡面。 | C1：己方回合可埋葬地图。C2：将自己的探险者放置到任一板块上。 | 时机=己方回合；目标=自己的探险者；消耗=埋葬；类型=特殊行动/传送。 | C1-C2 L3 局部通过 / legacy-id | 首剧本起始物玩家可见显示名已改为“地图”；`journal` 仅保留为内部 legacy id。机制按地图合同审计，已接入同一 `placeExplorer` 运行态效果 |

### 预兆牌录入合同

| 项目对象 | 卡图标题 | 图片路径 | 卡面原文 | 原子子句 | 结构化字段 | 合同状态 | 对当前实现的审计结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 书本（omen-book，legacy id） | Book / 书本 | `temp/betrayal-possession-contract-crops/omen-omen-book-full.jpg` | 奇怪的涂鸦覆盖了书页。你的知识检定结果+1。你的每个回合可使用一次，你可以使用此书本失去1点神志。对你在本回合的下一次非战斗的检定投骰，你可以使用你的知识替换所选属性的检定。（使用你对应知识的加成而非原属性的加成） | C1：持有时知识检定结果 +1。C2：每回合最多使用一次。C3：使用时失去 1 点神志。C4：本回合下一次非战斗检定可用知识替换所选属性。C5：替换时使用知识加成。 | 时机=持有常驻/己方回合一次/下一次非战斗检定前；目标=持有者；消耗=失去 1 点神志；类型=常驻加成+特殊行动。 | C1-C5 L3 局部通过 / legacy-id | 玩家可见显示名已改为“书本”；`omen-book` 仅保留为内部 legacy id。`rollTraitCheck` 已把书本 C1 接入知识检定被动加成，并由调查杰克、研究法阵两个知识检定消费者覆盖；`USE_POSSESSION` 已覆盖 C2-C5：每回合一次，使用时失去 1 点神志，并设置本回合下一次非战斗检定可用知识替换所选属性；替换会在调查杰克、研究法阵或驱魔检定后消费清理，且不会影响战斗对攻 |
| 狗（dog） | Dog / 狗 | `temp/betrayal-possession-contract-crops/omen-dog-full.jpg` | 他用一种热切的智慧凝视着你。你的速度检定结果+1。你的每个回合可使用一次，你可以使用狗狗与另一名4格以内的玩家交易任意数量的物品或预兆牌，沿用正常的交易规则。（你不能交易一件你在本回合已经用过的物品或预兆，也不能使用一件你刚刚从其它玩家处收到的物品或预兆。） | C1：持有时速度检定结果 +1。C2：每回合最多使用一次。C3：可与 4 格以内另一名玩家交易任意数量物品或预兆。C4：沿用正常交易规则。C5：不能交易本回合已使用过的物品或预兆。C6：不能使用本回合刚收到的物品或预兆。 | 时机=持有常驻/己方回合一次；目标=4 格内另一名玩家及交易物；消耗=无；类型=常驻加成+特殊交易行动。 | C1-C6 领域层 + 页面 4 格内多牌交易入口 L3 局部通过 | `rollTraitCheck` 已把狗 C1 接入速度检定被动加成，并由倒塌房间结束回合速度检定覆盖；`TRADE_POSSESSION` 的 `useDog` 分支已覆盖 C2-C6：狗每回合只能作为交易行动使用一次，可与 4 格以内玩家交易多张物品/预兆，拒绝交易本回合已使用过的持有物，并通过 `receivedCardIdsThisTurnByPlayerId` 阻止收牌方本回合立刻使用刚收到的持有物；真实页面已显示狗交易选择器，可选择 4 格内目标并勾选多张交易牌后派发狗交易命令 |
| 面具（mask） | Mask / 面具 | `temp/betrayal-possession-contract-crops/omen-mask-full.jpg` | 你看不出来它是用什麼制造的，但是摸起来很光滑，还带有一丝温润。你的速度检定结果+1。你的每个回合可使用一次，你可以使用面具，将和你同处一张板块上的所有其他人（探险者和怪物）移动至相同或不同的相邻板块，本效果不能用于发现新板块。 | C1：持有时速度检定结果 +1。C2：每回合最多使用一次。C3：目标为同板块所有其他人。C4：包括探险者和怪物。C5：移动到相同或不同的相邻板块。C6：不能用于发现新板块。 | 时机=持有常驻/己方回合一次；目标=同板块所有其他探险者和怪物；消耗=无；类型=常驻加成+特殊移动行动。 | C1-C6 领域层 + 页面逐目标分配入口 L3 局部通过 | `rollTraitCheck` 已把面具 C1 接入速度检定被动加成，并由倒塌房间结束回合速度检定覆盖；`USE_POSSESSION` 的 `moveOthersInRoom` 分支已覆盖 C2-C6：每回合只能使用一次，要求同板块存在其他探险者或怪物，目标必须是已发现相邻板块，结算时移动同板块其他活探险者和怪物，不移动当前探索者，并拒绝未发现板块目标；领域命令可通过 `targetRoomIdsByTokenId` 为每个同板块目标分别指定相同或不同的已发现相邻板块；页面已在真实牌桌入口显示同板块目标列表，可为每个探险者/怪物选择相同或不同的已发现相邻板块，并把逐目标分配随 `targetRoomIdsByTokenId` 传入领域命令 |
| 头骨（skull） | Skull / 头骨 | `temp/betrayal-possession-contract-crops/omen-skull-full.jpg` | 用奇怪的符号精妙地雕刻过。你的知识检定结果+1。如果某些效果将导致你的探险者死亡，在此之前先投掷3颗骰子。4-6 你不会死亡，但要将你的所有属性调整至濒死。毋忘此生。0-3 你正常死亡。 | C1：持有时知识检定结果 +1。C2：死亡将发生前触发。C3：投 3 颗骰子。C4：4-6 不死亡，所有属性调整至濒死。C5：0-3 正常死亡。 | 时机=持有常驻/死亡前被动；目标=持有者；消耗=无；类型=常驻加成+死亡替代；分支=3 骰 4-6/0-3。 | C1-C5 L3 局部通过 | `rollTraitCheck` 已把头骨 C1 接入知识检定被动加成，并由调查杰克覆盖；`HAUNT_ATTACK_RESOLVED` 已在攻击伤害导致死亡前触发头骨 3 骰替代，4-6 时不加入死亡列表并把四项属性调至濒死，0-3 时正常死亡；`USE_POSSESSION` 不再把头骨当通用知识加成主动使用牌 |
| 圣符（holy-symbol） | Holy Symbol / 圣符 | `temp/betrayal-possession-contract-crops/omen-holy-symbol-full.jpg` | 一枚在黑暗中闪闪发光的银色护符。你的神志检定结果+1。无论何时，当你发现一张板块，你可以选择埋葬该板块并继之以发现下一张板块，若你这么做，不需要结算第一张板块的任何效果。 | C1：持有时神志检定结果 +1。C2：发现板块时可触发。C3：可埋葬刚发现的板块。C4：继续发现下一张板块。C5：不结算第一张板块效果。 | 时机=持有常驻/发现板块时；目标=刚发现板块及下一张待发现板块；消耗=不消耗圣符，埋葬板块；类型=探索场景特例。 | C1-C5 L3 局部通过 | `rollTraitCheck` 已把圣符 C1 接入神志检定被动加成，并由驱魔杰克覆盖；`EXPLORE_ROOM` 的 `useHolySymbol` 分支已覆盖 C2-C5：持有且非本回合刚获得圣符时，可跳过/埋葬第一张房间模板，继续发现下一张，第一张不结算房间效果、不抽牌；没有圣符或本回合刚获得圣符时声明会被拒绝 |
| 匕首（dagger） | Dagger / 匕首 | `temp/betrayal-possession-contract-crops/omen-dagger-full.jpg` | 武器。它闻起来有强烈的血腥味。是你的血。当你使用匕首进行攻击时，失去1点速度。本次攻击多投掷两颗额外的骰子。（你每次攻击只能使用一把武器。你不允许在本回合将已经使用过的武器进行交易） | C1：该预兆是武器。C2：使用匕首攻击时触发。C3：失去 1 点速度。C4：本次攻击额外投 2 骰。C5：每次攻击只能用一把武器。C6：本回合已用武器不能交易。 | 时机=使用匕首攻击时；目标=本次攻击；消耗=失去 1 点速度；类型=武器/攻击修正。 | C1-C6 L3 局部通过 | `HAUNT_ATTACK` 现在只能在攻击命令显式带 `weaponCardId=dagger` 时额外投 2 颗骰，并在结算后让攻击者失去 1 点速度；`USE_POSSESSION` 不再把匕首当通用力量 +1 主动使用牌；未声明使用匕首时不会自动加骰或扣速度；已使用匕首会写入本回合已用持有物 |
| 指环（ring） | Ring / 指环 | `temp/betrayal-possession-contract-crops/omen-ring-full.jpg` | 武器。它自绕成型。你的神志检定结果+1。当你使用戒指进行攻击时，你和防御者皆使用神志属性而非力量属性进行投骰。失败者承受精神伤害。（你每次攻击只能使用一把武器。你不允许在本回合将已经使用过的武器进行交易） | C1：该预兆是武器。C2：持有时神志检定结果 +1。C3：使用指环攻击时双方用神志而非力量投骰。C4：失败者承受精神伤害。C5：每次攻击只能用一把武器。C6：本回合已用武器不能交易。 | 时机=持有常驻/使用指环攻击时；目标=攻击者和防御者；消耗=无；类型=常驻加成+武器/攻击属性替换。 | C1-C6 L3 局部通过 | `rollTraitCheck` 已把指环 C2 接入神志检定被动加成，并由驱魔杰克覆盖；`HAUNT_ATTACK` 现在只能在攻击命令显式带 `weaponCardId=ring` 时让双方用神志对攻，并按精神伤害结算失败者；`USE_POSSESSION` 不再把指环当通用神志 +1 主动使用牌；未声明使用指环时不会自动改用神志或造成精神伤害；已使用指环会写入本回合已用持有物 |
| 盔甲（armor） | Armor / 盔甲 | `temp/betrayal-possession-contract-crops/omen-armor-full.jpg` | 锈迹斑斑，但牢固可靠。无论何时你承受任何物理伤害，降低1点伤害值。（本盔甲无法阻挡通用伤害，或是对力量/速度属性的直接降低） | C1：承受物理伤害时触发。C2：物理伤害 -1。C3：不能阻挡通用伤害。C4：不能阻挡力量/速度直接降低。 | 时机=承受物理伤害时；目标=持有者；消耗=无；类型=常驻防具/减伤。 | C1-C4 L3 局部通过 | `applyPhysicalDamage` 已按盔甲持有状态把物理伤害降低 1 点，并由火炉房物理伤害入口证明；盔甲不再作为主动使用牌进入默认移动效果，且不会阻挡事件导致的力量直接降低；新增通用伤害事件入口证明盔甲不会减免通用伤害。 |
| 雕像（idol） | Idol / 雕像 | `temp/betrayal-possession-contract-crops/omen-idol-full.jpg` | 这个神像是由一种奇怪的、磨损的石头制成的。你不能完全弄清楚它本来想表达什麼。你的力量检定结果+1。当你发现一张带有事件符号的板块时，你可以选择不抽取一张事件卡。 | C1：持有时力量检定结果 +1。C2：发现带事件符号板块时可触发。C3：可选择不抽事件卡。 | 时机=持有常驻/发现事件符号板块时；目标=该次事件抽取；消耗=无；类型=常驻加成+探索场景特例。 | C1-C3 L3 局部通过 | C1 已通过事件力量检定消费者证明：雕像持有者进行事件力量检定时结果 +1；`EXPLORE_ROOM` 的 `useIdol` 分支已覆盖 C2-C3：持有且非本回合刚获得雕像时，发现事件符号板块可跳过事件抽取，事件不会进入弃牌，也不会结算属性降低或移动等事件效果；无雕像或非事件符号板块声明会被拒绝 |

预兆卡底部“抽取时进行作祟检定；作祟已开始则跳过”属于预兆抽牌通用规则，不能计入单卡效果通过。它应由 `ROOM_EXPLORED` 的预兆抽取/haunt roll 框架审计，不能替代上表里的每张预兆自身能力。

补充：`USE_EFFECTS` 里仍有 `holy-medallion / dark-omen / cross / matches` 四个效果键没有出现在当前发现池或首剧本起始持有物中。本轮只把它们登记为历史残留或未来占位候选，不纳入 20 张发现池牌的通过结论。

### 持有物合同状态


### 持有物图集映射合同

| 批次 | 对象 | 图集证据 | 映射结论 | 合同状态 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| 发现池物品/预兆 | 20 张发现池牌 | `public/assets/i18n/zh-CN/betrayal/cards/item-front-atlas.jpg`、`omen-front-atlas.jpg`；裁图清单 `temp/betrayal-possession-contract-crops/manifest.json` | 20 张发现池牌均能定位到正式正面 atlas 帧，且玩家可见显示名已按卡面标题对齐；内部 `id` 作为 legacy alias 保留 | `locked-display / mechanism-open` | 进入机制实现审计；不得把显示名已对齐误写成效果已实现 |
| 起始持有物补充对象 | 18 个首剧本起始持有物去重 ID | `scenarioConfig.ts` 起始持有物 + `possessionAtlas.ts` | 起始物品大多复用发现池牌图；提灯/日志等玩家可见显示名已按复用卡图对齐，内部 `id` 作为 legacy alias 保留 | `locked-display / mechanism-open` | 不并入发现池通过结论；机制按对应卡面合同审计 |
| 共用帧风险 | `map / notebook / manuscript / journal` | `possessionAtlas.ts` 均指向 item frame 16 | 四个 ID 共用地图卡图；玩家可见显示名已统一为“地图”，内部 ID 保留作 legacy alias | `C1-C2 L3 局部通过 / legacy-id` | 机制已按地图合同接入埋葬后放置到任一已发现板块；未发现板块拒绝路径已有领域测试 |
| 共用帧风险 | `flashlight / lantern` | `possessionAtlas.ts` 均指向 item frame 8 | 手电筒与首剧本补充物 `lantern` 共用同一张卡图；玩家可见显示名已统一为“手电筒”，内部 ID 保留作 legacy alias | `C1 L3 局部通过 / legacy-id` | 机制已按手电筒合同接入事件属性检定加骰；后续若出现其它手电筒子句再另行登记 |
| 共用帧风险 | `ring / 古戒`、`mask / 骨面具` | `scenarioConfig.ts` 起始名称与发现池名称不同，但共用同一 omen frame | 当前可证明是同一 atlas 帧，尚不能证明中文别名是否应保留 | `partial` | 后续统一中文名或登记别名，不影响发现池主对象先审计 |
| 批次 | 对象 | 已锁字段 | 未锁字段 | 合同状态 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| 发现池物品 | 11 张物品 | 牌名、牌堆归属、持有区入口、正式卡面裁图、卡面原文、原子子句、结构化字段、显示名裁定；奇怪的药品已补运行态治疗与埋葬测试证据；急救包 C1-C3 已补自己/同板块队友治疗与异板块拒绝测试证据；地图 C1-C2 已补已发现板块放置与未发现板块拒绝测试证据；手电筒 C1 已补事件属性检定加骰测试证据；头戴耳机 C1-C3 已补精神伤害减免、通用伤害负向边界和直接属性降低负向测试证据；砍刀 C1-C3 已补显式武器攻击 +1、非声明不自动加成、不能通用使用和已用不能交易测试证据；骨制钥匙 C1-C4 已补领域穿墙、投骰、空白埋葬、不能发现新房间和真实页面手动入口测试证据；兔脚已补事件属性检定、神秘电梯房间投骰、攻击投骰非致死伤害回算、倒塌房间结束回合速度检定和头骨死亡保护的单骰明细、每回合一次重掷门禁和对应结算回写测试证据 | 未来新增投骰入口的兔脚最近投骰窗口复用；地图/手电筒 legacy 复用对象不得被当作新卡脑补新机制；首剧本补充对象需独立登记 | `locked-display / mechanism-l3-local` | 11 张发现池物品已进入逐卡局部 L3；后续重点是扩展新消费者时补回归，而不是重复读取卡图或重复裁定显示名 |
| 发现池预兆 | 9 张预兆 | 牌名、牌堆归属、持有区入口、haunt roll 触发框架、正式卡面裁图、卡面原文、原子子句、结构化字段、显示名裁定；书本 C1-C5、头骨 C1-C5、狗 C1-C6、面具 C1-C6、圣符 C1-C5、指环 C1-C6、盔甲 C1-C4、匕首 C1-C6、雕像 C1-C3 均已有运行态或页面入口测试证据 | 后续新增非攻击致死来源、探索场景特例、多目标页面入口或新检定消费者时，必须接入既有单卡机制并补回归 | `locked-display / mechanism-l3-local` | 9 张发现池预兆已进入逐卡局部 L3；haunt roll 仍只算抽预兆通用规则，不能替代单卡效果证据 |
| 首剧本起始持有物 | 手电筒、地图等补充对象 | 起始持有物归属、卡面复用关系、显示名裁定；手电筒已按卡面合同接入事件属性检定加骰；地图已按卡面合同接入埋葬后放置效果 | 其它补充对象真实单卡能力实现与测试证据 | `locked-display / mechanism-in-progress` | 作为补充对象登记；手电筒和地图已按合同推进，其它补充对象仍不能并入通过结论 |
| 历史/未来占位键 | `holy-medallion / dark-omen / cross / matches` | 仅存在于 `USE_EFFECTS` 映射 | 当前发现池和首剧本起始持有物均未引用 | `blocked` | 先确认是否仍是有效对象；未确认前不纳入审计通过范围 |

本轮已检索 `docs/games/betrayal/sources/official/` 下的规则书、幸存者手册和叛徒之书 Markdown；它们能证明物品/预兆的通用抽取、持有、特殊行动、武器规则和 haunt roll 框架。当前 20 张发现池物品/预兆的完整卡面原文已改由正式卡图裁图合同补齐，玩家可见显示名也已按卡面合同对齐；奇怪的药品和急救包已经从 `resolveUseEffect` 通用数值占位拆成逐卡专属 `healTraits` 机制，地图已经拆成逐卡专属 `placeExplorer` 机制，骨制钥匙已经从通用移动占位拆入 `MOVE_TO_ROOM` 的穿墙移动分支，兔脚已经移除通用移动占位，并在领域层补入事件属性检定、神秘电梯房间投骰、攻击投骰非致死伤害回算、倒塌房间结束回合速度检定和头骨死亡保护的单骰明细、重掷命令和对应分支/伤害/死亡保护回写；真实页面基础入口已接入；未来新增投骰入口仍需复用最近投骰窗口并补回归；砍刀、匕首和指环已经从通用属性占位拆入 `HAUNT_ATTACK` 显式武器机制。预兆常驻检定加成已从 `resolveUseEffect` 的通用属性/移动占位拆入 `rollTraitCheck`：书本/头骨覆盖知识检定，狗/面具覆盖速度检定，圣符/指环覆盖神志检定；圣符发现板块替换已拆入 `EXPLORE_ROOM` 的可选探索分支；雕像力量检定 +1 已通过事件力量检定消费者证明；雕像跳过事件抽取已接入探索场景特例。下一步不再是继续读图或裁定显示名，而是按同一口径继续拆常驻、特殊行动、武器、防具、场景特例、死亡替代和重掷等真实机制。

## 事件具体效果实现审计表

| 类型 | 事件 | 对象真相/结算入口 | 当前实现 | 审计结论 |
| --- | --- | --- | --- | --- |
| 事件 | 回廊顺风 | 抽到即弃置/结算 | 当前配置只有 `move +1` 通用即时效果 | 只有通用移动增减；真实事件卡原文、检定、选择、成功/失败分支未锁 |
| 事件 | 窃窃低语 | 抽到即弃置/结算 | 当前配置只有 `sanity -1` 通用即时效果 | 只有通用属性增减；真实事件卡原文、检定、选择、成功/失败分支未锁 |
| 事件 | 旧日手记 | 抽到即弃置/结算 | 当前配置只有 `knowledge +1` 通用即时效果 | 只有通用属性增减；真实事件卡原文、检定、选择、成功/失败分支未锁 |
| 事件 | 滑落阶梯 | 抽到即弃置/结算 | 当前配置只有 `speed -1` 通用即时效果 | 只有通用属性增减；真实事件卡原文、检定、选择、成功/失败分支未锁 |
| 事件 | 墙中低语 | 抽到即弃置/结算 | 当前配置只有 `knowledge -1` 通用即时效果 | 只有通用属性增减；真实事件卡原文、检定、结果表、成功/失败分支未锁 |
| 事件 | 冷风指路 | 抽到即弃置/结算 | 当前配置只有 `move +1` 通用即时效果 | 只有通用移动增减；真实事件卡原文、检定、选择、成功/失败分支未锁 |
| 事件 | 阴影扑面 | 抽到即弃置/结算 | 当前配置只有 `might -1` 通用即时效果 | 只有通用属性增减；真实事件卡原文、检定、选择、成功/失败分支未锁 |
| 事件 | 残留祝福 | 抽到即弃置/结算 | 当前配置只有 `sanity +1` 通用即时效果 | 只有通用属性增减；真实事件卡原文、检定、选择、成功/失败分支未锁 |

### 事件合同状态

| 批次 | 对象 | 已锁字段 | 未锁字段 | 合同状态 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| 发现池事件 | 8 张事件 | 事件名、事件牌堆归属、探索抽取入口、弃牌计数、通用 `move/trait` 即时效果结算 | 官方事件卡原文、检定属性、结果档位、选择分支、失败路径、是否结束行动 | `blocked` | 需要完整事件卡图或官方事件卡文本后，才能进入逐事件机制实现 |

本轮已检索 `docs/games/betrayal/sources/official/` 下的规则书、幸存者手册和叛徒之书 Markdown。它们能证明事件牌的通用抽取与“读文本并执行”规则，但没有提供当前 8 张事件牌的完整卡面原文。因此，本轮不能继续把事件配置里的通用移动/属性数值升级为官方逐事件效果实现。

## 代码证据

- 房间模板已新增 `endTurnEffect` 和 `enterEffect`：`endTurnEffect` 用于火炉房、倒塌房间、洗衣滑槽 3 个结束回合效果；`enterEffect=mysticElevator` 用于神秘电梯进入触发。
- `END_TURN -> TURN_ENDED` 已承载房间结束回合效果结果，并在事件归约里写入权威状态：物理伤害会落到探索者属性，移动/放置会落到探索者房间。
- `USE_ROOM_EFFECT -> ROOM_EFFECT_USED` 已承载神秘电梯效果：按 2 骰结果筛选开放门口楼层，移动神秘电梯房间板块，并用 `usedRoomEffectIdsThisTurn` 做每回合一次门禁。
- 探索房间结算会更新房间基础数据、消耗牌堆、写入最近发现；事件牌当前只按配置里的通用 `move/trait` 即时效果结算，没有真实卡面原文、检定结果表或选择分支合同。
- 物品/预兆牌池对象当前保留 `id / name / kind` 作为对象入口，逐卡卡面原文和子句已经写入本 evidence；运行时代码已把奇怪的药品和急救包拆成 `healTraits` 专属特殊行动，把地图拆成 `placeExplorer` 放置行动，把骨制钥匙拆成领域穿墙移动并补真实页面入口，把砍刀/匕首/指环拆成显式武器，把书本/狗/面具/头骨/圣符/指环的检定加成拆入 `rollTraitCheck`，把书本特殊行动拆成下一次非战斗检定替换状态，把圣符发现板块替换拆入 `EXPLORE_ROOM` 可选分支，把狗特殊行动拆入 4 格内多牌交易和本回合收到禁用状态，把盔甲拆成物理伤害入口的被动减伤，把头戴耳机拆成精神伤害入口的被动减伤，并新增通用伤害事件结算入口证明盔甲/头戴耳机都不会减免通用伤害；兔脚已移除错误移动占位，并已在领域层覆盖事件属性检定、神秘电梯房间投骰、攻击投骰非致死伤害回算、倒塌房间结束回合速度检定和头骨死亡保护后的单骰重掷、每回合一次和对应结算回写；未来新增投骰入口仍需复用最近投骰窗口并补回归。其余子句仍未拆成特殊行动、场景特例和重掷等真实机制。
- `USE_POSSESSION` 有基本门禁：当前探索者必须持有该牌、同回合不能重复使用、本回合新获得不能立刻使用；但这只是特殊行动通用门禁，不等于逐卡效果实现。
- `Board.tsx` 已不再维护独立的前端预览效果映射；持有物卡面预览和领域结算现在都复用 `game.ts` 的 `resolveUseEffect`，避免 UI 预览与真实结算出现双重真相。

## 测试覆盖审计

| 覆盖点 | 现有测试证据 | 能证明什么 | 不能证明什么 |
| --- | --- | --- | --- |
| 发现池顺序消费 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts:21-46` | 正式局会消费 setup 生成的发现池顺序，不再只靠固定索引 | 不能证明每间房的文字效果已录入或已结算 |
| 发现池规模与资源映射 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts:48-83` | 11 张物品、9 张预兆、43 间房存在，且持有物/房间图集可渲染 | 不能证明卡牌效果、房间效果、门位官方文本全部正确 |
| 火炉房结束回合效果 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“火炉房在探索者结束回合时造成 1 点物理伤害” | 证明火炉房文字合同已落到结束回合运行态，并真实扣除物理伤害 | 不覆盖其它伤害房间或火炉房之外的触发时机 |
| 洗衣滑槽结束回合效果 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“洗衣滑槽在探索者结束回合时放置到地下室起始点” | 证明洗衣滑槽结束回合会把当前探索者放置到地下室起始点 | 不覆盖“通向地下室起始点”的静态连接 UI 表达 |
| 倒塌房间结束回合效果 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“倒塌房间结束回合速度检定失败时坠落并承受物理伤害”和“倒塌房间结束回合速度检定 5+ 时不会坠落或受伤” | 证明倒塌房间失败分支会移动到地下室起始点并承受 1 骰物理伤害，5+ 分支会保留原房间且不扣除物理属性 | 不覆盖其它检定房间或叛徒阶段特例 |
| 神秘电梯进入触发效果 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“神秘电梯进入后可按骰点移动到对应楼层开放门口且每回合只能用一次” | 证明神秘电梯可通过房间效果命令投 2 骰、移动房间板块并记录每回合一次门禁 | 目前目标开放门口由领域自动选择，尚未做玩家手动选择门口 UI |
| haunt roll 触发 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts:85-95`、`189-205`、`252-265` | 抽预兆后的 haunt 触发框架有正反路径和最后一张预兆兜底 | 不能证明每张预兆自身效果已经实现 |
| 新获得持有物使用门禁 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts:97-139` | 本回合新获得的物品/预兆不能立刻用，下一轮可用 | 不能证明该牌的真实特殊行动、常驻效果或武器效果正确 |
| 探索后空间连接 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts:267-290` | 新房间会按开放门位连接，探索后空间结构可继续使用 | 不能证明发现房间时的房间文字先于抽卡结算 |
| 搜尸与交易类持有物流转 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts:612-641` | 同房间尸体上的物品/预兆可按每回合 1 件搜刮 | 不能证明搜来的牌本身效果正确，或武器交易限制完整 |
| UI 使用入口 | `src/games/betrayal/__tests__/Board.foundation.test.tsx:180-196` | 页面能点击“使用”并由 reducer 驱动进入后续目标 | 不能证明点击的是官方卡牌效果，只能证明通用使用入口可用 |
| UI 房间效果入口 | `src/games/betrayal/__tests__/Board.foundation.test.tsx` 的“当前房间是神秘电梯时才显示并执行房间效果按钮” | 证明神秘电梯按钮不会在普通房间常驻，且点击后进入真实 reducer 结算 | 不能证明后续所有房间效果都已有 UI 入口 |
| 奇怪的药品运行态效果 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“奇怪的药品会埋葬并治疗当前探索者的力量和速度” | 证明己方回合使用奇怪的药品会治疗当前探索者力量和速度，并在使用后从持有区移除；二次使用被拒绝 | 不覆盖地图等其它埋葬类特殊行动 |
| 急救包 C1-C3 运行态效果 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“急救包会埋葬并治疗当前探索者的所有濒死属性”“急救包可以治疗同板块另一位探索者并从当前探索者持有区移除”“急救包不能治疗不同板块的另一位探索者” | 证明己方回合使用急救包会治疗自己全部濒死属性，或治疗同板块另一位探索者，并在使用后从当前探索者持有区移除；异板块目标会被拒绝 | 不覆盖地图、兔脚、骨制钥匙等其它特殊行动 |
| 地图 C1-C2 运行态效果 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“地图会埋葬并把当前探索者放置到任一已发现板块”“地图不能把当前探索者放置到未发现板块”；`src/games/betrayal/__tests__/Board.foundation.test.tsx` 的“地图会在真实页面选择已发现板块并放置当前探索者” | 证明己方回合使用地图会把当前探索者放置到指定已发现板块，并在使用后从持有区移除；未发现板块会被拒绝；真实页面可在使用地图前选择已发现板块并派发目标板块 | 领域层 + 页面已发现板块选择入口 L3 局部通过；不覆盖兔脚、骨制钥匙、武器等其它特殊行动 |
| 急救包 C1-C3 治疗特殊行动 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“急救包会埋葬并治疗当前探索者的所有濒死属性”“急救包可以治疗同板块另一位探索者并从当前探索者持有区移除”“急救包不能治疗不同板块的另一位探索者”；`src/games/betrayal/__tests__/Board.foundation.test.tsx` 的“急救包会在真实页面选择同板块队友并治疗目标” | 证明己方回合使用急救包会埋葬并治疗自己全部濒死属性，也可选择同板块另一位探索者作为目标；异板块目标会被拒绝；真实页面可在使用急救包前选择同板块队友并派发治疗目标 | 领域层 + 页面同板块队友目标入口 L3 局部通过；不覆盖其它治疗牌或异板块治疗入口 |
| 骨制钥匙 C1-C4 领域穿墙移动 + 页面入口 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“骨制钥匙可以穿过墙壁移动到已发现相邻板块，且不会作为主动移动加成使用”“骨制钥匙穿墙投到空白会被埋葬，且不能用于发现新房间”；`src/games/betrayal/__tests__/Board.foundation.test.tsx` 的“骨制钥匙会在真实页面移动模式显示穿墙目标并传入领域命令” | 证明骨制钥匙持有者可声明穿过相邻但无门连接的已发现板块；普通移动仍被拒绝；穿墙会投 1 颗骰子；空白面会埋葬骨制钥匙；未发现板块会被拒绝；骨制钥匙不再是主动移动加成牌；页面移动模式会把骨制钥匙穿墙目标展示成可手动选择，并通过移动按钮传入领域命令 | 领域和页面基础入口 L3 局部通过；其它物品未因此通过，未来新增投骰入口仍需复用最近投骰窗口并补回归 |
| 手电筒 C1 事件检定加骰 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“手电筒只在事件属性检定多投 2 颗骰，不能被主动使用成通用加成” | 证明手电筒持有者在事件属性检定中额外多投 2 颗骰子，并能改变事件结果分支 | 当前只覆盖事件属性检定加骰；不把手电筒扩展成主动使用牌 |
| 兔脚 C1-C2 重掷入口 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“兔脚不能被主动使用成移动加成，真实重掷必须等待骰子明细窗口”“兔脚会重掷刚刚事件检定的一颗骰子，并回写原事件分支结算”“兔脚重掷后若跨过事件检定阈值，会撤销旧分支并应用新分支”“兔脚可以重掷神秘电梯刚投过的一颗骰子并重算楼层”“兔脚可以重掷刚刚攻击投骰的一颗骰子，并按新结果回算非致死攻击伤害”“兔脚可以重掷倒塌房间结束回合速度检定，并按新结果回算坠落”“兔脚可以重掷头骨死亡保护的一颗骰子，并按新结果阻止死亡” | 证明兔脚不再产生“移动 +1”假效果；事件属性检定、神秘电梯房间投骰、攻击投骰、倒塌房间结束回合速度检定和头骨死亡保护会记录单颗骰子；兔脚能选择刚投过的一颗骰子重掷；同回合二次使用被拒绝；重掷后会按新总点数回写事件分支、神秘电梯楼层移动、非致死攻击伤害、倒塌房间坠落结果或头骨死亡保护结果 | 当前证明领域层事件属性检定、神秘电梯房间投骰、攻击投骰非致死伤害回算、倒塌房间结束回合速度检定、头骨死亡保护重掷与真实页面基础入口；未来新增投骰入口仍需复用最近投骰窗口并补回归 |
| 头戴耳机 C1-C3 精神减伤与负向边界 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“头戴耳机会把承受的精神伤害降低 1 点”“头戴耳机不会阻挡对知识属性的直接降低，也不能被主动使用成通用移动效果”“盔甲和头戴耳机不会阻挡通用伤害” | 证明头戴耳机持有者承受精神伤害时会降低 1 点伤害值，且被动防具不会被主动使用成默认移动效果 | 已证明不会阻挡知识直接降低，也不会阻挡通用伤害；这是防具负向边界，不代表事件牌逐卡效果全部收口 |
| 书本 C1-C5 知识检定被动与下一次非战斗检定替换 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“书本会让知识检定结果 +1，并影响调查杰克和研究法阵”“书本每回合一次：失去 1 点神志，并让下一次非战斗检定可用知识替换”“书本替换只作用于非战斗检定，不会让战斗对攻改用知识” | 证明书本持有者的知识检定结果 +1 会进入调查杰克和研究法阵；主动使用书本会失去 1 点神志，设置并消费下一次非战斗检定替换；同回合二次使用被拒绝；战斗对攻不会改用知识 | 当前只覆盖首剧本里的非战斗检定消费者；若后续新增其它非战斗检定入口，需要复用同一替换状态补回归 |
| 狗 C1-C6 速度检定被动与 4 格内交易行动 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“狗和面具会让倒塌房间速度检定结果 +1”“狗每回合一次，可与 4 格内玩家交易任意数量物品或预兆”“狗交易沿用正常交易限制：已用牌不能交易，收到的牌本回合不能立刻使用”；`src/games/betrayal/__tests__/Board.foundation.test.tsx` 的“狗会在真实页面选择 4 格内目标并交易多张牌” | 证明狗持有者的速度检定 +1 会进入倒塌房间速度检定；狗特殊交易每回合一次，可与 4 格内玩家交易多张物品或预兆；本回合已使用持有物不能交易；收牌方本回合不能立刻使用刚收到的持有物；真实页面可选择 4 格内目标并勾选多张交易牌后派发狗交易命令 | 领域层 C1-C6 + 页面 4 格内多牌交易入口 L3 局部通过；不覆盖面具的同板块群体移动行动 |
| 面具 C1-C6 速度检定被动与同板块群体移动行动 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“狗和面具会让倒塌房间速度检定结果 +1”“面具每回合一次，会把同板块其他探险者和怪物移动到已发现相邻板块，且不能发现新板块”“面具可以把同板块不同目标分别移动到不同已发现相邻板块”；`src/games/betrayal/__tests__/Board.foundation.test.tsx` 的“面具会在真实页面给同板块队友和怪物分别选择相邻板块” | 证明面具持有者的速度检定 +1 会进入倒塌房间结束回合速度检定；主动使用面具每回合一次，能移动同板块其他探险者和怪物到已发现相邻板块，能按目标分别移动到相同或不同的已发现相邻板块，并拒绝未发现板块目标；真实页面可为同板块队友和怪物分别选择相邻板块，使用后棋盘 token 分别移动到各自目标房间 | 领域层 C1-C6 + 页面逐目标分配入口 L3 局部通过；不代表其它预兆特殊行动或其它多目标 UI 已自动通过 |
| 头骨 C1-C5 知识检定与死亡替代 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“头骨会让知识检定结果 +1，并影响调查杰克”“头骨在探索者将要死亡前投 3 骰，4-6 时不死亡并把所有属性调至濒死”“头骨死亡前投 3 骰为 0-3 时仍正常死亡”“头骨不能被主动使用成通用知识加成” | 证明头骨持有者的知识检定 +1 会进入调查杰克知识检定；将死前 3 骰 4-6 会阻止死亡并把四项属性调至濒死；0-3 会正常死亡；头骨不会再走通用主动使用加成 | 当前只覆盖攻击伤害导致死亡的消费者；若后续新增非攻击致死来源，需要复用同一死亡前替代入口补回归 |
| 圣符 C1-C5 神志检定被动与发现板块替换 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“圣符和指环会让驱魔神志检定结果 +1”“圣符发现板块时可埋葬第一张板块并继续发现下一张，且不结算第一张效果”“没有圣符或本回合刚获得圣符时，不能声明埋葬发现板块” | 证明圣符持有者的神志检定 +1 会进入驱魔杰克神志检定；发现板块时可声明跳过/埋葬第一张房间模板并继续发现下一张；第一张房间不会结算房间效果或抽牌；无圣符或本回合刚获得圣符时会被拒绝 | 领域探索命令分支与真实页面探索声明入口 L3 局部通过；不代表其它探索场景特例自动通过 |
| 指环 C2 神志检定被动 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“圣符和指环会让驱魔神志检定结果 +1” | 证明指环持有者的神志检定 +1 会进入驱魔杰克神志检定，并能在阈值边界完成首剧本 | 不覆盖指环作为武器时的神志攻击、精神伤害和交易限制 |
| 盔甲 C1-C4 物理减伤与负向边界 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“盔甲会把承受的物理伤害降低 1 点”“盔甲不会阻挡对力量属性的直接降低”“盔甲是被动物理减伤防具，不能被主动使用成通用移动效果”“盔甲和头戴耳机不会阻挡通用伤害” | 证明盔甲持有者承受物理伤害时会降低 1 点伤害值，且被动防具不会被主动使用成默认移动效果 | 已证明不会阻挡力量直接降低，也不会阻挡通用伤害；这是防具负向边界，不代表事件牌逐卡效果全部收口 |
| 魔法相机 C1 知识检定替代 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“魔法相机会让知识检定改用更高的神志属性，且不能被主动使用成通用属性加成” | 证明魔法相机持有者进行知识检定时可改用更高的神志属性，并覆盖调查杰克、研究法阵两个知识检定入口 | 当前只覆盖 C1 常驻替代属性；没有把魔法相机扩展成主动使用牌 |
| 砍刀 C1-C3 攻击武器 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“砍刀只能作为攻击武器显式使用，攻击结果 +1 且本回合不能交易”“未声明使用砍刀时，不会只因持有武器自动获得攻击 +1”；`src/games/betrayal/__tests__/Board.foundation.test.tsx` 的“砍刀会在真实页面攻击入口选择武器并传入攻击命令” | 证明砍刀不再走通用持有物使用按钮；只有攻击命令显式声明使用砍刀时，攻击投骰结果 +1；命令结构一次只能声明一把武器；本回合已用砍刀不能交易；真实页面攻击入口可选择砍刀并把武器声明传给攻击命令 | 领域层 + 页面武器声明入口 L3 局部通过；当前页面测试只覆盖砍刀这一把固定攻击结果加成武器，不覆盖匕首的速度代价或指环的神志攻击 |
| 匕首 C1-C6 攻击武器 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“匕首只能作为攻击武器显式使用，会失去 1 点速度并额外投 2 颗骰”“未声明使用匕首时，不会只因持有武器自动额外投骰或失去速度”；`src/games/betrayal/__tests__/Board.foundation.test.tsx` 的“匕首会在真实页面攻击入口选择武器并传入攻击命令” | 证明匕首不再走通用持有物使用按钮；只有攻击命令显式声明使用匕首时，本次攻击额外投 2 颗骰，攻击者失去 1 点速度；未声明使用时不会自动加骰或扣速度；命令结构一次只能声明一把武器；已使用匕首会写入本回合已用持有物；真实页面攻击入口可选择匕首并把武器声明传给攻击命令 | 领域层 + 页面武器声明入口 L3 局部通过；不代表其它预兆特殊行动 |
| 指环 C1-C6 攻击武器 | `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 的“指环只能作为攻击武器显式使用，双方改用神志对攻并造成精神伤害”“未声明使用指环时，不会只因持有武器自动改用神志或造成精神伤害”；`src/games/betrayal/__tests__/Board.foundation.test.tsx` 的“指环会在真实页面攻击入口选择武器并传入攻击命令” | 证明指环不再走通用持有物使用按钮；只有攻击命令显式声明使用指环时，双方改用神志对攻，失败者承受精神伤害；未声明使用时不会自动改用神志或造成精神伤害；命令结构一次只能声明一把武器；已使用指环会写入本回合已用持有物；真实页面攻击入口可选择指环并把武器声明传给攻击命令 | 领域层 + 页面武器声明入口 L3 局部通过；不覆盖圣符探索替换、狗/面具特殊行动等其它预兆能力 |

测试层当前同样支持本轮结论：现有测试主要覆盖对象存在、发现池消费、haunt 框架、通用使用门禁、11 个已锁房间效果、物品/预兆逐卡局部机制、真实页面基础入口以及教程入口。本轮新增领域回归覆盖长廊固定连通舞厅、图书馆/书房发现时 +1 知识、器械库展示物品牌直到武器并埋葬其余展示牌；它仍不覆盖剩余 11 间房的基础房间图合同，也不能证明未来新增投骰、致死、探索特例、多目标页面入口或新检定消费者自动通过。

## 本轮验证结果

| 验证项 | 命令 | 本轮结果 | 审计含义 |
| --- | --- | --- | --- |
| 领域单测（本轮重跑） | `$env:NODE_OPTIONS='--max-old-space-size=8192'; node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts --configLoader native` | 1 个测试文件通过，83 条测试通过 | 证明本轮新增长廊固定连通、图书馆/书房发现加知识、器械库抽至武器并埋葬其余展示牌，以及既有山屋领域运行态仍通过；页面基础与教程测试需在最终全量验证中另行重跑 |
| TypeScript 类型检查 | `$env:NODE_OPTIONS='--max-old-space-size=8192'; npx tsc --noEmit --pretty false --incremental false` | 通过 | 证明本轮兔脚事件属性检定、神秘电梯房间投骰、攻击投骰非致死伤害回算、倒塌房间结束回合速度检定和头骨死亡保护重掷、页面基础入口、通用伤害事件效果类型、显示名、legacy id、事件/房间效果相关类型仍能整体编译；不证明运行时页面 E2E 已通过。未加内存上限的同进程串联命令曾触发 Node OOM，应记为环境/内存阻塞，不是业务断言失败 |
| E2E 复核：核心交互、怪物同场、持有区、预兆图集 | `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/first-scenario-core-interactions.e2e.ts`、`monster-runtime.e2e.ts`、`inventory-density.e2e.ts`、`omen-atlas.e2e.ts`；随后以 `PW_E2E_SERVICE_REUSE=isolated` 重跑 `omen-atlas.e2e.ts --grep "真实预兆牌"` | 当前阻塞在 Playwright/前端运行环境：页面或 worker 进程在用例断言前崩溃，日志包含 `JavaScript heap out of memory`、`Page crashed`、`worker process exited unexpectedly (code=134/3221226505)` | 这不是山屋惊魂业务断言失败，也不能记为 E2E 通过；后续需要在释放内存或修复 E2E runtime/worker 内存参数后重跑真实页面验证 |

## Finding 与执行队列

| 优先级 | Finding | 现实影响 | 下一步 |
| --- | --- | --- | --- |
| P0 | 房间效果进入第二批收口 | 11 个已锁房间效果已可执行；32 个对象键已有合同，其中 21 个为无文字或带 frame-note 无文字；剩余 11 间房仍未锁基础房间图合同 | 继续建立剩余 11 间合同状态；frame-note 对象先裁定归属再扩实现 |
| P0 | 物品/预兆已从“录入合同”推进到逐卡局部 L3 | 玩家拿到真实牌名后，11 张发现池物品和 9 张发现池预兆均已有对应机制证据；但这些结论仍是当前消费者范围内的局部 L3，不等于未来新增投骰、致死、探索特例、多目标页面入口自动通过 | 继续按对象机制扩消费者和回归；legacy id 只服务兼容，不再阻塞机制审计，也不得把已完成对象误写成“其余机制未做” |
| P0 | 事件仍缺真实卡面/官方原文合同 | 当前事件只有项目占位名和通用即时数值模型；规则书只证明事件通用流程，不能证明这 8 张占位事件就是官方事件牌 | 先取得真实事件卡图/官方原文，再建立逐事件原文子句表；未锁官方原文前不得把通用数值模型写成规则通过，也不得继续扩写占位事件效果 |
| P1 | `USE_POSSESSION` 通用按钮容易吞掉武器/常驻/特殊行动差异 | 武器、常驻效果、特殊行动可能被同一种“使用”语义错误处理 | 拆分 `specialAction / passive / weapon / scenarioSpecific` 效果类型 |
| P1 | 预兆 haunt roll 不能替代单卡能力证据 | 抽预兆能触发 haunt；当前 9 张发现池预兆已有各自局部机制证据，但后续新增消费者仍不能只拿 haunt roll 当通过 | 预兆审计表继续同时覆盖 haunt roll 和单卡能力；新增场景特例、致死来源或页面入口时必须补对象级回归 |

## 后续审计入口

1. 先建立房间效果真相表：43 间房逐项补“是否有房间文字效果 / 触发时机 / 目标 / 检定 / 成败 / 清理 / 不适用原因”。
2. 对物品/预兆逐卡合同做机制审计：20 张发现池牌的玩家可见显示名已对齐卡图合同，legacy id 保留；下一步直接按卡面子句拆机制，不再重复读图或停在命名裁定。
3. 对事件牌先补真相源：当前 8 张事件配置只能当项目占位；没有真实事件卡图/官方原文前，不得继续扩写占位事件效果，也不得把通用数值模型写成事件牌规则通过。
4. 后续任何“发现池已审计”汇报必须同时说明：空间/牌堆归属是否审完，具体效果实现是否审完；不得再用前者替代后者。
5. 当前不应直接脑补实现所有房间/卡牌效果；实现前必须先锁定卡面/房间文字真相源。

## 下一批录入合同执行清单

这张清单是后续继续审计的前置门禁。没有形成 `locked / partial / blocked / disputed` 合同前，不得把任何房间或卡牌效果写进运行时代码。

| 批次 | 对象范围 | 主真相源 | 必填字段 | 进入实现审计条件 |
| --- | --- | --- | --- | --- |
| R1 房间效果优先批 | 倒塌房间、火炉房、神秘电梯、洗衣滑槽 | 基础房间图完整单对象裁图；规则书已点名这些房间存在特殊效果，只能作为候选锚点 | 房间名、官方房间文字、触发时机、目标、检定/支付、结果分支、伤害/移动、叛徒例外、清理、抽卡标记 | 已锁定 4/4；已进入实现审计并补最小领域/页面测试 |
| R2 房间效果全量批 | 剩余 11 间房 + frame-note 裁定对象 | 基础房间图完整单对象裁图；当前 `scenarioConfig.ts` 只提供对象名、楼层、门位、图集 | 是否有房间文字效果、触发时机、不适用原因、门位/楼层/图集索引、frame/hash 是否命中正确对象 | 32 个对象键已有合同；剩余 11 间继续锁定，阁楼/书房等 frame-note 对象不得当作无争议独立图面 |
| C1 物品牌批 | 11 张物品 | 物品牌完整单卡图；本轮裁图合同已回写逐卡表；玩家可见显示名已按卡图合同对齐 | 卡名、官方原文、使用时机、目标、常驻/特殊行动/武器、消耗/弃置、限制、清理 | 录入合同已完成第一轮：11 张 locked-display；下一步是机制实现审计 |
| C2 预兆牌批 | 9 张预兆 | 预兆牌完整单卡图；规则书提供抽预兆和 haunt roll 通用规则；玩家可见显示名已按卡图合同对齐 | 卡名、官方原文、持有后效果、haunt roll 关系、常驻/特殊行动/武器/场景特例、限制、清理 | 录入合同已完成第一轮：9 张 locked-display；下一步是单卡能力机制实现审计，haunt roll 继续按通用抽预兆框架审计 |
| C3 事件牌批 | 8 张事件 | 事件牌完整单卡图；规则书提供事件读文本、执行指令、结果表通用规则 | 事件名、官方原文、检定属性、结果档位、每档效果、弃置、结束回合/继续行动 | 真实卡面原文未锁前，当前 `move/trait` 数值只能算占位，不能判规则通过 |

## 图片处理执行口径

| 场景 | 交给图片处理方的内容 | 返回内容 | 写回落点 |
| --- | --- | --- | --- |
| 房间/卡牌规则录入 | 用户当前需求是补齐山屋惊魂发现池效果审计；对象名；完整裁图路径；图片需要补足官方文字和结构化规则字段 | 官方原文、原子子句、结构化字段、合同状态；无法判断时只标具体字段 `blocked/disputed/partial` | 本文的房间效果真相表、物品/预兆/事件逐卡子句表 |
| 资源/图集核对 | 用户当前需求是确认对象真相或图集归属；对象名；图集/裁图路径；图片需要回答对象是否匹配 | `passed/failed/blocked`、失败点、证据路径/hash | 对象真相/归属列或资源 evidence |
| 实现验收 | 用户当前需求是确认某个已实现效果是否符合图片/官方文本；对象名；实现入口；图片需要回答是否满足预期 | 是否满足预期、失败点、最小证据；不转写无关文字 | 测试覆盖审计或对应实现 evidence |

本轮已经确认：图片链路曾因本地 JPG 读取和上下文溢出失败，后续同一路径不得继续硬试。继续审计时只把图片读取用于当前需求：录入时返回可落表字段，验收时返回是否满足预期和失败点。若仍失败，只阻塞具体对象字段，不阻塞已经能从官方文本和代码配置确认的对象真相。
