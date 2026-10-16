# 第一批 FSN+FZ 对象合同

范围与 `src/games/fate-domination/data/identities.ts` 一致。\\
主图面：CHM 角色页第一张截图。TTS Description 只作对照。\\
技能/附属卡已进入 `precision: authority-summary` 合同：御主见 `first-batch-master-aux-ocr.md`，从者见 `first-batch-servant-skills-ocr.md`。攻击 12 张逐从者索引见 `first-batch-attacks-ocr.md`；阿尔托莉雅数字概览仍 `blocked`，其余从者为 authority-summary。完整卡面效果和低置信字段仍需人工复核。

变体排除：Alter / Lily / Prototype / 灵子 / 夏 / 蓄势 / 圣诞 / 弟子 / 今天的饭。\\
兰斯洛特：第一批取 `兰斯洛特1.htm`（Berserker / Lancelot of the Lake）。`兰斯洛特.htm` 为 Saber，排除。

## 御主身份卡（CHM OCR，`locked`）

| 中文 | TTS | 开局魔力 | 身份能力（CHM 原文摘要） | CHM 身份图 | 附属截图数 |
| --- | --- | ---: | --- | --- | ---: |
| 间桐雁夜 | Matou Kariya | 4（默认） | 刻印虫：部署工房额外+2魔力；常规移动每步额外-1魔力。虚妄梦境：开始时右边玩家成为【宿敌】。 | `ScreenShot_2025-10-29_215119_688.png` | 4 |
| 间桐慎二 | Matou Shinji | 4 | 吸魔命令：进入深山町+1魔力。无用之人：开始获得【伪臣之书】。小丑：战败失去一枚令咒。 | `ScreenShot_2025-10-30_194536_066.png` | 4 |
| 卫宫士郎 | Emiya Shirou | **2** | 未熟：初始魔力2。投影：【干将·莫邪】加入技能区。远离尘世的理想乡：首次被淘汰时失去所有魔力来继续游戏。（2026-10-11 用户确认 CHM；TTS 英文 Avalon 漏写魔力代价，不是中文录入错） | `ScreenShot_2025-10-29_231025_144.png` | 3 |
| 雨生龙之介 | Uryuu Ryuunosuke | 4 | 连环杀手：开始得到【死之艺术】；不能从工房获魔力；部署工房或战斗胜利时激活【死之艺术】。 | `ScreenShot_2025-10-30_185820_078.png` | 4 |
| 远坂时臣 | Tohsaka Tokiomi | 4 | 元素使：【火炎弹】加入技能区。粗心导师：4件【道具】加入游戏；回合顺位倒数两位可各用1件；时臣用道具无法获战果。 | `ScreenShot_2025-10-29_214455_857.png` | 7 |
| 伊莉雅斯菲尔 | Illyasviel von Einzbern | **6** | 人工生命体：初始魔力6。圣杯容器：第8回合开始激活【天之衣】。小圣杯：打出攻击魔力消耗-1；回合结束若本回合打出均为暗置，+1魔力。 | `ScreenShot_2025-10-29_163935_232.png` | 3 |
| 间桐樱 | Matou Sakura | 4 | 缺损容器：回合结束战果低于所有其他玩家且第一名御主不是【间桐慎二】，激活【黑泥】。此世全部之恶：第8回合结束战果排名不为第一，激活【被污染的圣杯】。 | `ScreenShot_2025-10-30_183128_104.png` | 4 |
| 韦伯·维尔维特 | Waver Velvet | 4 | 鉴识眼：可看背面朝上的事件。战略部署-前哨：支付1魔力抽2张。调查-前哨：看一名玩家手牌，可把一张放到其牌库顶，若如此下回合不可调查。 | `ScreenShot_2025-10-30_201641_717.png` | 2 |
| 言峰绮礼 | Kotomine Kirei | 4 | 两幅面孔：从者真名隐藏时为【监督者】；否则为【执行者】（包括没有从者）。 | `ScreenShot_2025-10-29_214959_423.png` | 4 |
| 肯尼斯 | Kayneth Archibald | 4 | 双重御主：魔力少于8也可使用技能。炼金术师：开始将6张【月灵髓液】洗成独立牌库；行动阶段从该库抽1张。倨傲：若可部署于战果低于你且独自位于战场的其他玩家所在战场，则必须部署。 | `ScreenShot_2025-10-29_163037_577.png` | 5（含 HTML 重复引用） |
| 间桐脏砚 | Matou Zouken | **10，上限16** | 大空洞的亡者：开始魔力10且上限16。五百年的活尸：大圣杯【创造者】并怀揣【五百年的执念】。间桐家的宗主：局势牌无法禁止你使用宝具。 | `ScreenShot_2025-10-30_194137_834.png` | 3 |
| 卫宫切嗣 | Emiya Kiritsugu | 4 | 魔术师杀手：开始将牌库一张牌替换为【起源弹】。固有时制御-行动：暗置打出一张然后抽一张。四倍速-战斗：关闭一张你激活的攻击，然后激活一张你暗置的【起源弹】。 | `ScreenShot_2025-10-29_215423_544.png` | 3 |
| 远坂凛 | Tohsaka Rin | 4 | 宝石魔术：开始获得10枚【宝石】；高潮阶段可在宝石上选择相同选项，每选项至多3次（共9次）。绝对服从的命令：第一回合必须使用一枚令咒，否则该回合结束失去一枚；若该令咒获得了魔力，战斗阶段结束后失去4魔力。 | `ScreenShot_2025-10-30_191812_276.png` | 5 |

## 从者概览卡（CHM OCR，`locked`）

概览卡列出职阶与 12 张攻击构成（力量红 / 敏捷绿 / 魔术蓝 + 基础特殊）。技能 3 张另计。

| 中文 | 职阶 | TTS 概览名 | 力量 | 敏捷 | 魔术 | 其它基础 | CHM 概览图 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 阿尔托莉雅·潘德拉贡 | Saber（TTS Class 卡） | Artoria Pendragon | 待技能页/蓄势页补 | 待补 | 待补 | 身份卡写：将【幸运】洗入牌堆；基础攻击威力+1；高潮合计威力+4 | `ScreenShot_2025-10-29_221758_597.png` | CHM 首页是中文能力卡，不是数字概览；数字概览 `partial` |
| 赫拉克勒斯 | Berserker | Heracles | 2,2,3,5,5,7,9 | 2,4,7 | — | Luck×2 | `ScreenShot_2025-11-02_110640_013.png` | 12 张对账通过 |
| 吉尔伽美什 | Archer | Gilgamesh | 2,3,4 | 2,3,4 | 2,3,4 | Preparation, Luck×2 | `ScreenShot_2025-11-01_154227_893.png` | 12 张对账通过 |
| 佐佐木小次郎 | Assassin | Sasaki Kojirou | 2,3,4 | 2,3,3,4,5,5 | — | Surveil, Luck×2 | `ScreenShot_2025-11-01_212419_960.png` | 12 张对账通过 |
| 美狄亚 | Caster | Medea | — | 2,3,4 | 2,3,3,4,4,5 | Surveil, Luck, Preparation | `ScreenShot_2025-11-01_191706_941.png` | 12 张对账通过 |
| 哈桑·萨巴赫(咒腕) | Assassin | Hassan-i Sabbah | 2,3,4 | 3,4,5 | 2,3,3 | Surveil×2, Preparation | `ScreenShot_2025-11-01_212532_416.png` | 12 张对账通过 |
| 卫宫 | Archer | Emiya | 2,3 | 2,2,3,4 | 2,3,4 | Surveil, Preparation×2 | `ScreenShot_2025-11-01_154110_741.png` | 12 张对账通过 |
| 兰斯洛特 | Berserker | Lancelot of the Lake | 2,2,4,7 | 2,3,5,7,9 | — | Luck×3 | `ScreenShot_2025-11-02_110748_453.png` | 来自 `兰斯洛特1.htm` |
| 安格拉·曼纽 | Avenger | Angra Mainyu | 2,2,3 | 2,2,3,4 | 2,3 | Avenger Class×3 | `ScreenShot_2025-11-02_120543_887.png` | 12 张对账通过 |
| 伊斯坎达尔 | Rider | Iskandar of Macedonia | 2,2,3,3,4,5 | 2,3,4 | 3 | Surveil, Luck | `ScreenShot_2025-11-01_163842_910.png` | 12 张对账通过 |
| 迪卢木多·奥迪那 | Lancer | Diarmuid of the Lovespot | 3,4,5 | 2,3,3,4,4,4,5,5 | — | Surveil | `ScreenShot_2025-11-01_111207_280.png` | 12 张对账通过 |
| 吉尔·德·雷 | Caster | Gilles de Rais | — | — | 2,2,2,3,3,3,4,4,5,5 | Preparation×2 | `ScreenShot_2025-11-01_191753_822.png` | 12 张对账通过 |
| 库·丘林 | Lancer | Cú Chulainn | 2,3 | 2,4,4,4,5 | 2,4,5 | Surveil×2 | `ScreenShot_2025-11-01_111054_633.png` | 12 张对账通过 |
| 美杜莎 | Rider | Medusa | 2,3,5 | 3,3,4,5 | 3,3 | Surveil, Preparation×2 | `ScreenShot_2025-11-01_163744_063.png` | 12 张对账通过 |

阿尔托莉雅身份卡（CHM，与数字概览分开）：

- 担任世界：将一张【幸运】洗入牌堆。
- 辉白之钢：基础攻击威力+1。
- 花之旅途：高潮回合合计威力+4。

## 技能/附属（`authority-summary`）

CHM 每页另有 2–7 张截图，未全部 OCR。TTS 英文已抽出到 `temp/fate-domination-intake/first-batch-canonical-tts.json`。

已读中文样例：

- 干将·莫邪（士郎技能）：力量/宝具，消耗 1，威力 5，需 8 魔力，投影-此牌需追加打出。
- 无穷的武练（Saber 兰斯洛特技能，**排除出第一批**）：消耗 3 敏捷 0 剑；行动阶段打出一张手牌，创造并激活该手牌的临时复制直至回合结束。

第一批技能中文已按 CHM 页后续截图进入 authority-summary 合同；逐字原文不清处显式标记，不能用 TTS 英文当正式规则。

## 数量对账（第一批身份层）

| 类别 | 规则数量 | CHM 身份/概览实测 | 结论 |
| --- | ---: | ---: | --- |
| 第一批御主身份卡 | 13 | 13 | `matched` |
| 第一批从者概览 | 14 | 14（狂化取 `兰斯洛特1.htm`） | `matched` |
| 每从者攻击构成 | 12 | 13/14 概览数字加总为 12；阿尔托莉雅数字概览缺 | 阿尔托莉雅 `partial` |
| 每从者技能 | 3 | CHM 有截图，未逐张 OCR | `partial` |
| 御主附属组件 | 因人而异 | CHM 有截图 + TTS bag | `partial` |
