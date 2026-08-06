# 山屋惊魂房间板块 S0 合同：发现符号与运行池对账

目标状态：active
当前目标：锁定房间板块正面发现符号，并把探索抽牌从运行时顺序改为消费房间符号。
非当前历史背景：既有 `drawOrder / exploreIndex` 代表链只能作为旧实现覆盖源，不能作为符号真相源。
禁止自动接管：不得用当前运行池、旧测试或教程摘要替代房间正面图集；不得在 `Panic Room` 等缺口未裁定时宣称房间全集完成。
更新时间：2026-07-29

## 0. 本轮前提锁定

| 项 | 锁定结论 |
| --- | --- |
| 问题对象 | 《山屋惊魂 / 小黑屋》房间板块发现符号，以及探索新房间后抽事件 / 物品 / 预兆的消费链 |
| 真相来源 | 规则文本明确“放置带符号的新房间后抽对应卡牌”，房间正面图集提供逐房间印刷符号 |
| 目标入口 / 环境 | 当前仓库 `D:\gongzuo\webgame\BoardGame`；运行入口为 `src/games/betrayal/scenarioConfig.ts` 的房间发现池与 `src/games/betrayal/game.ts` 的 `EXPLORE_ROOM` |
| 验收口径 | 合同先落 `evidence/`；代码新增房间固有 `discoverySymbol`；探索、预览、雕像、叛徒跳过事件均从房间符号读取；定向领域测试和 OpenSpec 校验通过 |

## 1. 规则真相源

| 来源 | 位置 | 规则字段 | 结论 |
| --- | --- | --- | --- |
| 三版规则整理 | `src/games/betrayal/rule/山屋惊魂小黑屋第三版规则汉化整理.md:79` | 探索时序 | 放置新房间后，先结算板块效果，再按板块符号抽事件 / 物品 / 预兆，随后回合结束 |
| 三版规则整理 | `src/games/betrayal/rule/山屋惊魂小黑屋第三版规则汉化整理.md:128-134` | 房间正面字段 | 房间正面可能带事件 / 物品 / 预兆符号 |
| 三版规则整理 | `src/games/betrayal/rule/山屋惊魂小黑屋第三版规则汉化整理.md:283` | 抽牌类型 | 大多数房间板块带事件、物品或预兆符号；放置时从对应牌堆抽最上面一张 |
| 旧版中文规则书对照 | `src/games/betrayal/rule/legacy-zh/betrayal-2e-rulebook-zh-v1.1/betrayal-2e-rulebook-zh-v1.1.md:581` | 事件符号 | 漩涡 = 事件 |
| 旧版中文规则书对照 | 同上 `:584` | 物品符号 | 公牛头 = 物品 |
| 旧版中文规则书对照 | 同上 `:588` | 预兆符号 | 乌鸦 = 预兆 |

## 2. 图集真相源

| 字段 | 结论 |
| --- | --- |
| 主图 | `public/assets/i18n/zh-CN/betrayal/rooms/room-front-atlas.jpg` |
| SHA256 | `8635D8F10F6B5CE815357864BE0AA355BE243794EEA81B2FBE66BF76B55CD719` |
| 图集规格 | 6300 x 5400；7 列 x 6 行；每格 900 x 900 |
| 代码索引 | `src/games/betrayal/roomAtlas.ts` 的 `ROOM_FRONT_ATLAS = generateUniformAtlasConfig(6300, 5400, 6, 7)` |
| 资源索引对照 | `docs/games/betrayal/sources/image-index/runtime-resource-map.json:21` |
| 录入裁图 | `temp/betrayal-room-reintake/room-front-frame-00.png` 到 `room-front-frame-41.png`，以及疑难项复核图 `room-front-uncertain-frames.png` |

## 3. 符号字段定义

| 合同字段 | 值 | 图面载体 | 规则含义 |
| --- | --- | --- | --- |
| `discoverySymbol` | `event` | 黄色漩涡 | 探索放置后抽事件牌并结算 |
| `discoverySymbol` | `item` | 黄色公牛头 | 探索放置后抽物品牌并获得 / 结算 |
| `discoverySymbol` | `omen` | 黄色乌鸦 | 探索放置后抽预兆牌，随后按预兆规则可能作祟检定 |
| `discoverySymbol` | `none` | 无上述三种发现符号 | 仍可探索并结算房间文字；不额外按符号抽牌 |

> `discoverySymbol` 是房间板块固有规则字段，不是运行时抽牌结果。已发现房间上的 `discoveryReward` 只能记录本次探索实际结算结果。

## 4. 42 个正面 frame 合同表

| frame | 图面对象 / 运行 visualId | 图面符号 | 合同值 | 运行状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 00 | 观测台 / `observatory` | 乌鸦 | `omen` | in-runtime | 当前运行名“观测台” |
| 01 | 塔楼 / `tower` | 漩涡 | `event` | in-runtime |  |
| 02 | 雕像走廊 / `statuaryCorridor` | 漩涡 | `event` | in-runtime |  |
| 03 | 长廊 / `gallery` | 漩涡 | `event` | in-runtime | `entranceHall` 也误指向该 frame，仅作 atlas alias，不是可探索房间 |
| 04 | 舞厅 / `ballroom` | 乌鸦 | `omen` | in-runtime | `foyer` 也误指向该 frame，仅作 atlas alias，不是可探索房间 |
| 05 | 厨房 / `kitchen` | 漩涡 | `event` | in-runtime |  |
| 06 | 实验室 / `laboratory` | 漩涡 | `event` | in-runtime |  |
| 07 | 温室 / `conservatory` | 乌鸦 | `omen` | in-runtime |  |
| 08 | 墓园 / `graveyard` | 乌鸦 | `omen` | in-runtime | 图面文字：通向地下洞窟 |
| 09 | 礼拜堂 / `chapel` | 漩涡 | `event` | in-runtime | 发现时神志 +1 |
| 10 | 储物间 / `larder` | 无 | `none` | in-runtime | 发现时力量 +1 |
| 11 | 餐厅 / `diningRoom` | 漩涡 | `event` | in-runtime |  |
| 12 | 洗衣滑槽 / `laundryChute` | 无 | `none` | in-runtime | 结束回合移动到地下室起始点 |
| 13 | 金库 / `vault` | 公牛头 | `item` | in-runtime |  |
| 14 | 裂隙 / `chasm` | 漩涡 | `event` | in-runtime |  |
| 15 | Panic Room / `panicRoom` | 乌鸦 | `omen` | not-in-runtime | 图集中存在，但当前 `roomDiscoveryByFloor` 未录入；缺楼层 / 中文名 / 门位裁定 |
| 16 | 地下洞窟 / `undergroundCavern` | 漩涡 | `event` | in-runtime |  |
| 17 | 仪式室 / `ritualRoom` | 乌鸦 | `omen` | in-runtime |  |
| 18 | 地下湖 / `undergroundLake` | 漩涡 | `event` | in-runtime |  |
| 19 | 地下墓穴 / `catacombs` | 乌鸦 | `omen` | in-runtime |  |
| 20 | 密道楼梯 / `secretStaircase` | 无 | `none` | in-runtime | 图面文字：通向走廊 |
| 21 | 火炉房 / `furnaceRoom` | 漩涡 | `event` | in-runtime | 结束回合受 1 点物理伤害 |
| 22 | 冬季卧室 / `winterBedroom` | 乌鸦 | `omen` | in-runtime |  |
| 23 | 客房 / `guestQuarters` | 漩涡 | `event` | in-runtime |  |
| 24 | 血腥房间 / `bloodyRoom` | 公牛头 | `item` | in-runtime | 疑难项已复核为公牛头 |
| 25 | 图书馆 / `library`、书房 / `study` | 乌鸦 | `omen` | duplicate-alias / disputed | 图面显示 `LIBRARY`，运行池同时录 `图书馆` 和 `书房`；符号字段可锁，独立对象归属仍需后续裁定 |
| 26 | 倒塌房间 / `collapsedRoom` | 无 | `none` | in-runtime | 结束回合速度检定，失败坠落 |
| 27 | 杂物间 / `junkRoom` | 公牛头 | `item` | in-runtime | 发现时放障碍物 |
| 28 | 标本室 / `specimenRoom` | 乌鸦 | `omen` | in-runtime |  |
| 29 | 烧焦房间 / `charredRoom` | 乌鸦 | `omen` | in-runtime |  |
| 30 | 沙龙 / `salon` | 漩涡 | `event` | in-runtime |  |
| 31 | 主卧 / `primaryBedroom`、`bedroom` | 乌鸦 | `omen` | duplicate-alias | 运行池用 `primaryBedroom`；atlas 另有 `bedroom` alias 指同一 frame |
| 32 | 管风琴室 / `organRoom` | 漩涡 | `event` | in-runtime |  |
| 33 | 隔音室 / `soundproofedRoom` | 乌鸦 | `omen` | in-runtime |  |
| 34 | 育婴室 / `nursery` | 乌鸦 | `omen` | in-runtime |  |
| 35 | 手术室 / `operatingTheatre` | 公牛头 | `item` | in-runtime | 疑难项已复核为公牛头 |
| 36 | 爬行空间 / `crawlspace` | 漩涡 | `event` | in-runtime |  |
| 37 | 游戏室 / `gameRoom` | 公牛头 | `item` | in-runtime | 疑难项已复核为公牛头 |
| 38 | 体育馆 / `gymnasium` | 无 | `none` | in-runtime | 发现时速度 +1 |
| 39 | 器械库 / `armory` | 无 | `none` | in-runtime | 房间文字会展示物品牌直到武器；不是物品符号，不得再额外按符号抽物品牌 |
| 40 | 狭窄通道 / `crampedPassageway`、`upperLanding` alias | 漩涡 | `event` | in-runtime / alias-risk | `upperLanding` 是起始房间 alias，不应混入可探索合同 |
| 41 | 神秘电梯 / `mysticElevator` | 无 | `none` | in-runtime | 进入 / 使用电梯效果 |

## 5. 当前运行池对照

| 楼层池 | 当前运行对象数 | 符号合同可锁对象 | 对账结论 |
| --- | ---: | ---: | --- |
| 一层 `ground` | 18 | 18 | `Panic Room` 未在运行池；`观测台` 一层归属沿用当前运行池，后续对象全集需复核官方楼层 |
| 上层 `upper` | 14 | 14 | `书房` 与 `图书馆` 共用 frame 25；`狭窄通道` 与 `upperLanding` frame alias 需避免混入起始房间 |
| 地下 `basement` | 10 | 10 | 当前 10 个运行对象符号可锁；无符号房间必须允许探索但不抽符号牌 |

运行池符号分布（按当前实现对象，不按官方唯一正面计数）：

| 合同值 | 当前运行对象 |
| --- | --- |
| `event` | 塔楼、雕像走廊、长廊、厨房、餐厅、礼拜堂、实验室、裂隙、地下洞窟、地下湖、火炉房、客房、沙龙、管风琴室、爬行空间、狭窄通道 |
| `item` | 金库、血腥房间、杂物间、手术室、游戏室 |
| `omen` | 观测台、温室、墓园、舞厅、书房、图书馆、冬季卧室、仪式室、地下墓穴、标本室、烧焦房间、主卧、隔音室、育婴室 |
| `none` | 储物间、洗衣滑槽、密道楼梯、倒塌房间、体育馆、器械库、神秘电梯 |

## 6. 实现准入裁定

| 字段 / 对象 | 状态 | 后续动作 |
| --- | --- | --- |
| 当前运行池 42 个模板的 `discoverySymbol` | locked | 可进入实现；探索抽牌、预览、雕像、叛徒跳过事件均必须消费该字段 |
| `Panic Room` 正面 frame 15 | blocked / not-in-runtime | 不得猜楼层和中文名；后续必须补完整对象合同后才能进运行池 |
| `图书馆` / `书房` frame 25 | disputed alias | 本轮只允许锁定符号为 `omen`；不得宣称两个独立官方正面已完成裁定 |
| `bedroom` / `primaryBedroom` frame 31 | duplicate-alias | 本轮按当前运行池 `主卧 / primaryBedroom` 消费符号 `omen`；alias 关系记录为后续对象全集缺口 |
| `upperLanding` / `crampedPassageway` frame 40 | alias-risk | `upperLanding` 是起始房间资源 alias；探索合同只对 `狭窄通道 / crampedPassageway` 生效 |
| `entranceHall` / `foyer` alias | alias-risk | 这两个 atlas alias 不进入可探索房间符号合同 |

## 7. 本轮结论

- 房间符号是规则定义字段，且已能从规则文本与房间正面图集锁定为 `event / item / omen / none`。
- 当前探索链路继续按 `drawOrder / exploreIndex` 推导抽牌类型属于规则消费错误；运行时顺序不能替代房间固有符号。
- 当前运行池 42 个模板的符号字段可进入实现，但房间对象全集仍不是完成态：`Panic Room` 缺运行对象，`图书馆 / 书房` 与若干起始房间 alias 仍需后续对象全集裁定。
