# 第一批录入后对照差异（CHM 中文 vs TTS 英文）

日期：2026-10-11。\\
裁定：中文 CHM 卡面是主真相源；TTS 只汇报差异，不覆盖。\\
Wiki QA：本轮不可达，下列条目待 Wiki 回来后再核效果理解。

## 已确认差异

| 对象 | 字段 | CHM 中文（采用） | TTS 英文 | 状态 |
| --- | --- | --- | --- | --- |
| 卫宫士郎 | 远离尘世的理想乡 | 当首次被淘汰时你将失去所有的魔力来继续游戏 | Avalon - The first time you would be eliminated from the game, you are not. | **CHM `locked`（用户 2026-10-11 确认）**。TTS 英文是 Workshop CardCustom tooltip 漏写「失去全部魔力」代价，不是 BoardGame 中文录入错误。中文已在 `demo-data.ts` `m_shirou_emiya.s3` 与身份合同中。TTS 原文：`temp/fate-domination-intake/first-batch-canonical-tts.json` nickname `Emiya Shirou` |
| 间桐脏砚 | 开局魔力 | 10 且上限 16 | The Pit - You start the game with 10 Mana.（未写上限 16） | `disputed`；采用 CHM 上限 16 |
| 间桐慎二 | 小丑 | 战败时失去一枚令咒 | 身份卡 TTS 未写此条 | `disputed`；采用 CHM |
| 远坂凛 | 绝对服从的命令 | 第一回合必须用一枚令咒，否则回合结束失去一枚；若该令咒获得魔力，战斗结束后失去 4 魔力 | 身份卡 TTS 只写 Gem Magic 10 gems | `disputed`；采用 CHM |
| 卫宫切嗣 | 固有时制御 / 四倍速 | 行动暗置打出再抽；战斗关闭一张激活攻击再激活暗置起源弹 | 身份卡 TTS 只写 Mage Killer 替换起源弹 | `disputed`；采用 CHM |
| 伊莉雅斯菲尔 | 天之衣触发 / 附属正文 | 身份卡：第八回合开始激活【天之衣】；附属图：`归于虚无-回合开始时，若你上回合在战斗阶段时与至少一名被淘汰的玩家位于同一战场，获得2点战果。` | Dress of Heaven - Return to Nothing：回合开始若上回合有玩家在你所在战场被淘汰则 +2 VP（英文对照未体现 CHM 中文身份触发） | **CHM `locked`**；身份卡触发与附属卡持续效果分开记录，不能互相覆盖 |
| 阿尔托莉雅 | 身份能力 | 担任世界/辉白之钢/花之旅途 | TTS 概览是 Saber 数字牌库，能力在 Class/技能卡 | 结构不同，不直接冲突；数字概览仍 `partial` |

## 结构一致、仅译名不同（不升级为 disputed）

| 对象 | CHM | TTS |
| --- | --- | --- |
| 间桐雁夜 | 刻印虫 / 虚妄梦境 / 宿敌 | Crest Worms / Delusional / Nemesis |
| 雨生龙之介 | 死之艺术 | Art of Death |
| 远坂时臣 | 火炎弹 / 道具 | Einäscherung / items |
| 韦伯 | 鉴识眼 / 战略部署 / 调查 | Observant / Strategize / Investigate |
| 肯尼斯 | 双重御主 / 月灵髓液 / 倨傲 | Master Duo / Volumen Hydrargyrum / Disdainful |
| 言峰绮礼 | 监督者 / 执行者 | Supervisor / Executor |

## Wiki

本轮未抓到任何 Wiki 卡页，无法做第三份 QA。恢复网络后优先核：卫宫士郎 Avalon、脏砚魔力上限、士郎投影追加打出。

## 本轮新增图面差异（局势 / 事件）

| 对象 | CHM 中文采用 | demo / 旧摘要 | 状态 |
| --- | --- | --- | --- |
| 冬木 E9 | 光荣的决斗 | 光荣决斗 | `manual-review`：名称补入“的”，效果一致 |
| 冬木 E11 | 险恶地形 | 险恶之地 | `manual-review`：名称以 CHM 为准，效果一致 |
| 冬木 E12 | 遏制第三方威胁 | 遏制威胁 | `manual-review`：CHM 标题更完整；效果以 CHM 全文为准 |
| 冬木 E3 / E10 | 魔术攻击 | demo 缩写写“魔法” | `manual-review`：中文术语以 CHM “魔术”为准 |
| 局势 sit12 / sit13 | 魔术工房仅限一人部署 | demo 摘要同义但未保留 CHM 术语 | `manual-review`：合同保留 CHM 原词 |

E0「夺回伊莉雅」图面正文为空白，已在 `events-fuyuki-ocr.md` 标 `blocked`；禁止用 demo 的“赢区域者得3魔”补入中文效果。
