# 《文化冲击》四派系 intake 来源合同

## 当前结论

- 当前阶段：OpenSpec 提案与 intake 范围锁定。
- 当前未进入运行时实施；共享代码、正式资源、locale 和 manifest 尚未修改。
- 图片实际包含四个派系：阿南西传说、格林童话、俄罗斯童话、古代印加人。
- implementation 前仍需逐卡锁定中文原文、英文规则对照和 effect atom。

## 权威来源

| 来源 | 路径 | 用途 | SHA-256 |
| --- | --- | --- | --- |
| 中文卡牌 atlas | `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Images/httpssteamusercontentaakamaihdnetugc1177076490642124867E9F9B732BA5D238B9B282C3E9F60BA0B8F67CCBE.png` | 中文名、力量、中文牌面原文、图像槽位 | `5CA8838ED9C57F1A53C2C864837E56D2279ECE101E1FE39E74BE74828B61F08E` |
| TTS 模组配置 | `C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Workshop/2833984701.json` | 派系归属、英文名、CardID、数量、基地、断点、atlas URL | `9CB9EC26259D8BF85BFB6FA84F9B14A7D32A6E21AD075B8B6C62757BD24CFF1D` |
| 英文官方资料 / Smash Up Wiki | 待 intake 逐卡登记 | 英文规则正文与勘误对照 | `pending` |

## 图集几何

- 原图尺寸：`4096 x 3454`
- 卡牌 atlas：`10 x 6`
- 有效卡面：槽位 `0-58`
- 标识格：槽位 `59`
- 本地总览：`temp/smashup-culture-shock-intake/overview.jpg`
- 本地行切片：`temp/smashup-culture-shock-intake/rows/row-01.jpg` 至 `row-06.jpg`
- 本地单卡切片：`temp/smashup-culture-shock-intake/cards/slot-00.png` 至 `slot-59.png`
- 结构化牌表：`temp/smashup-culture-shock-intake/all-decks-summary.json`

## 批次矩阵

| objectId | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `anansi_tales` | `in_progress` | `pending` | `pending` | `pending` | `pending` | `blocked:等待提案批准与逐卡规则合同` |
| `grimms_fairy_tales` | `in_progress` | `pending` | `pending` | `pending` | `pending` | `blocked:等待提案批准与逐卡规则合同` |
| `russian_fairy_tales` | `in_progress` | `pending` | `pending` | `pending` | `pending` | `blocked:等待提案批准与逐卡规则合同` |
| `ancient_incas` | `in_progress` | `pending` | `pending` | `pending` | `pending` | `blocked:等待提案批准与逐卡规则合同` |

## 阿南西传说牌表

| slot | count | type | canonical English |
| ---: | ---: | --- | --- |
| 0 | 1 | Minion | Anansi the Spider |
| 1 | 1 | Minion | Osebo the Leopard |
| 2 | 1 | Minion | Onini the Python |
| 3 | 3 | Minion | Akye the Turtle |
| 4 | 4 | Minion | Mboro Hornet |
| 5 | 1 | Action | The Perfect Gift |
| 6 | 2 | Action | Pot of Beans |
| 7 | 2 | Action | Collecting Stories |
| 8 | 1 | Action | Ear of Corn |
| 9 | 1 | Action | Pot of Wisdom |
| 10 | 1 | Action | Trading Stories |
| 11 | 1 | Action | Let it be Full and Eat |
| 12 | 1 | Action | Feather Gifts |

## 格林童话牌表

| slot | count | type | canonical English |
| ---: | ---: | --- | --- |
| 13 | 1 | Action | Fairy Godmother's Blessing |
| 14 | 1 | Action | The Woodsman's Axe |
| 15 | 1 | Action | Another Story |
| 16 | 1 | Action | Breadcrumbs |
| 17 | 1 | Action | Mouse, Bird and Sausage |
| 18 | 2 | Action | Teamwork |
| 19 | 2 | Action | Grimms' Blessing |
| 20 | 1 | Action | Basket of Goodies |
| 21 | 1 | Minion | Hansel |
| 22 | 1 | Minion | Gretel |
| 23 | 1 | Minion | The Other Snow White |
| 24 | 1 | Minion | Rose Red |
| 25 | 1 | Minion | Red Riding Hood |
| 26 | 1 | Minion | Big Bad Wolf |
| 27 | 1 | Minion | Prince Charming |
| 28 | 1 | Minion | Charming Princess |
| 29 | 1 | Minion | The Frog Prince |
| 30 | 1 | Minion | Rumpelstiltskin |

## 俄罗斯童话牌表

| slot | count | type | canonical English |
| ---: | ---: | --- | --- |
| 31 | 1 | Minion | The Birch Woman |
| 32 | 1 | Minion | Finist the Falcon |
| 33 | 1 | Minion | Baba Yaga |
| 34 | 1 | Action | The Frog Princess |
| 35 | 2 | Action | The Water of Life |
| 36 | 1 | Action | Fetch I Know Not What |
| 37 | 1 | Action | Go I Know Not Whither |
| 38 | 1 | Action | Go See My Sister |
| 39 | 1 | Action | Bewitched |
| 40 | 2 | Action | Transformation |
| 41 | 1 | Minion | The Birch |
| 42 | 2 | Minion | Tsar Eagle |
| 43 | 1 | Minion | The Gray Wolf |
| 44 | 2 | Minion | Foolish Magician |
| 45 | 1 | Minion | Toad |
| 46 | 1 | Action | Mass Transformation |

## 古代印加人牌表

| slot | count | type | canonical English |
| ---: | ---: | --- | --- |
| 47 | 1 | Action | Ashlar Masonry |
| 48 | 1 | Action | Golden Condor |
| 49 | 1 | Action | Royal Highway |
| 50 | 1 | Action | Quipu Strings |
| 51 | 4 | Minion | Llama |
| 52 | 3 | Minion | Incan Engineer |
| 53 | 2 | Minion | Child of the Sun |
| 54 | 2 | Action | Armory |
| 55 | 2 | Action | Fortress Walls |
| 56 | 1 | Action | Temple of the Sun |
| 57 | 1 | Action | Signs in the Stars |
| 58 | 1 | Minion | Sapa Inca |

## 基地来源

共享基地 atlas：

- TTS `CustomDeck 73`
- FaceURL：`https://steamusercontent-a.akamaihd.net/ugc/1177076490642121102/1226F16F4B2B7BE3D730F95BA7C47DFE13900D37/`
- 网格：`4 x 3`

| slot | faction | base | breakpoint | 状态 |
| ---: | --- | --- | ---: | --- |
| 0 | 俄罗斯童话 | Transformation Spring | 19 | 名称/断点已锁，正文待核 |
| 1 | 俄罗斯童话 | Giant Turnip | 30 | 名称/断点已锁，正文待核 |
| 2 | 格林童话 | Gingerbread House | 21 | 名称/断点已锁，正文待核 |
| 3 | 格林童话 | Woodland Cottage | 19 | 名称/断点已锁，正文待核 |
| 4 | 古代印加人 | Machu Picchu | 20 | 名称/断点已锁，正文待核 |
| 7 | 阿南西传说 | Storyteller's Hut | 24 | 名称/断点已锁，正文待核 |
| 8 | 阿南西传说 | Anansi's Web | 17 | 名称/断点已锁，正文待核 |
| 10 | 古代印加人 | Cuzcu | 30 | canonical 拼写待裁定 |

## 待裁定项

1. `Cuzcu` 是否为 TTS 拼写错误，canonical 英文是否应为 `Cuzco`。
2. `Grimms' Fairy Tales` 的 canonical 标点与中文派系名最终 locale。
3. 59 个卡面的英文规则正文对照源。
4. 每张卡牌和基地的完整规则子句、可选/强制语义、运行时入口和清理时机。
5. 基地 atlas 与 `add-smashup-polynesian-voyagers-penguins` 的唯一 atlas ID、资源路径和 manifest key。

## Implementation Handoff 状态

- faction 清单：`locked`
- CardID / 数量 / atlas 槽位：`locked`
- 基地归属 / 槽位 / 断点：`locked`
- 中文牌面逐卡核对：`in_progress`
- 英文规则正文与勘误：`pending`
- effect atom / 共享机制矩阵：`pending`
- implementation：`blocked:等待 OpenSpec 批准与 intake 合同收口`
