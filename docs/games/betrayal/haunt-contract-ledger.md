# 山屋惊魂 50 个作祟源段映射与交互合同账本

> 目的：把 50 个作祟从“目录级索引”推进到“可逐条设计”的状态。本文不是玩法实现，也不把代表链冒充完整支持。
> 真相源：`docs/games/betrayal/sources/official/betrayal-3e-secrets-of-survival-en.md`、`docs/games/betrayal/sources/official/betrayal-3e-traitors-tome-en.md`。

## 0. 当前结论

- 之前把多数作祟标为 `source-blocked` 不准确：官方 Markdown 源段已经在本地，真正缺口是“未逐条拆成交互子账本”。
- `haunt-redesign-index.md` 只能证明 50 个作祟进入追踪范围；本文补上官方源段页码、机制焦点和逐作祟合同门禁。
- 任一作祟要进入实现，必须先从本文对应页码回读英雄书 / 叛徒书正文，完成独立子账本；不能只按本文一行摘要写代码。

## 1. 状态口径

| 状态 | 含义 | 是否可实现 |
| --- | --- | --- |
| `source-mapped-contract-pending` | 官方源段已定位，但还没有逐条子账本 | 不可实现 |
| `representative-implementation-needs-contract` | 现有代码或 E2E 只有代表链，仍缺完整合同 | 不可宣称完整，可作为差距参考 |
| `contract-ready` | 独立子账本已覆盖公开/私密/设置/目标/规则/行动/token/怪物/终局/验证 | 可排入实现 |
| `implemented-with-evidence` | 代码、测试和页面证据都回填到子账本 | 可宣称该作祟完成 |

## 2. 全量源段映射

| # | 作祟 | 英雄书源段 | 叛徒书源段 | 类型 / 叛徒口径 | 设计焦点 | 当前状态 |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | 堆积如柴 2：血红杰克归来 | p5 | p5 | 作祟揭秘者 | 杰克知识、驱魔圈、叛徒死亡后杰克之灵、怪物替代回合、叛徒复活 | `contract-ready` |
| 2 | Friends Forever | p6-p7 | 无，英雄书独占 | 隐藏叛徒 | 隐藏编号、戒指毁灭、时间循环倒计时、登陆点返回、揭露叛徒后的规则变化 | `contract-ready` |
| 3 | The Dust | p8-p9 | 无，英雄书独占 | 隐藏叛徒 | 狂热感染、发烧者阵营、研究 token、治愈检定、怪物回合和胜负切换 | `contract-ready` |
| 4 | Free the Realtor | p10-p11 | 无，英雄书独占 | 无叛徒 | 诅咒知识、房间净化、护符准备、恶魔地产经纪人、合作胜负 | `contract-ready` |
| 5 | Blood from a Stone | p12-p13 | 无，英雄书独占 | 无叛徒 | 石像怪、遮眼/躲避、凝视伤害、怪物行动顺序、合作目标 | `contract-ready` |
| 6 | Inheritance | p14-p15 | 无，英雄书独占 | 隐藏叛徒 | 证据 token、真相揭露、隐藏叛徒身份、遗产目标和秘密信息 | `contract-ready` |
| 7 | Upon Reflection | p16-p17 | 无，英雄书独占 | 无叛徒 | 镜中领域、作祟揭秘者沟通限制、秘密组合、镜像怪物、合作解谜 | `contract-ready` |
| 8 | Housekeeping | p18-p19 | 无，英雄书独占 | 无叛徒 | 清洁房间、血腥房间、管家怪物、清洁 token、合作目标 | `contract-ready` |
| 9 | Let Bygones be Bygones | 无，叛徒书独占 | p7 | 自由混战 | 神像持有者攻击加值、击杀推进计数、偷神像、物品掩埋强化攻击 | `contract-ready` |
| 10 | A Serious Offer | 无，叛徒书独占 | p8-p9 | 自由混战 | 宝藏编号、倒计时献礼、秘藏宝藏搜索、尸体搜刮、最高分共享胜利 | `contract-ready` |
| 11 | Don't Get Cooked | 无，叛徒书独占 | p10 | 自由混战 | 食物 token、女巫献祭、无食物者死亡、逐轮减少食物池、最后生还者 | `contract-ready` |
| 12 | The House is Hungry / Helping Hands | 无，叛徒书独占 | p11 | 自由混战 | 奇异护符、巨魔手、双手合击、偷物品/预兆、持护符者控制怪物 | `contract-ready` |
| 13 | Holy Ground | p21 | p12 | 作祟揭秘者 | 仪式知识、扰乱仪式、尸体负担、献祭进度、邪教徒尸体与怪物回合 | `contract-ready` |
| 14 | Object Permanence | p22 | p13 | 作祟揭秘者左侧玩家 | 咒书、计数轨、英雄加速施法、叛徒毁书、活动家具替身复活 | `contract-ready` |
| 15 | Of Monsters and Mayhem | p23 | p14-p15 | 作祟揭秘者 | 三怪物、三指定武器、怪物各自特殊攻击、叛徒死亡后控怪 | `contract-ready` |
| 16 | Come Play With Us | p24 | p16 | 作祟揭秘者 | 遗骸搜索/辨认/安葬、墓地、愤怒幽灵生成、遗骸精神伤害 | `contract-ready` |
| 17 | Forward This or Die | p25 | p17 | 作祟揭秘者 | 符文标记使 Gremlin 可杀、手机研究、邮件抽签、Gremlin 伏击 | `contract-ready` |
| 18 | A Nice Ring to It | p26 | p18-p19 | 作祟揭秘者 | 幻象编号、真身隐藏、驱散/攻击幻象、金库呼唤、幻象共享持有物 | `contract-ready` |
| 19 | Caught on Tape | p27 | p20 | 作祟揭秘者 | 录像带、午夜倒计时、入口逃离、怨灵在录像带间移动、理智攻击 | `contract-ready` |
| 20 | Don't Say It | p28 | p21 | 年龄最大角色 | 叛徒秘密记录音节房间、提示规则、无脸人追击、知晓名字后可击杀 | `contract-ready` |
| 21 | Spooky McMasters Presents... | p29 | p22-p23 | 作祟揭秘者 | 书、图书馆、烧书、恐怖小说家怪物、恐怖怪生成、代写效果表 | `contract-ready` |
| 22 | Operation: Underground | p30 | p24 | 作祟揭秘者左侧玩家 | 地下室重洗、逃离房子、骷髅看地下室堆、冷战僵尸、监控/密道规则 | `contract-ready` |
| 23 | Intruder Alert | p31 | p25 | 作祟揭秘者 | 机器开关、翻面毁坏房间、计数轨、机器人助手、激光/上传压力 | `contract-ready` |
| 24 | The Shadow Masquerade | p32 | p26-p27 | 速度最高 | Seelie Flame 搬运、教堂收集、舞会厅、Fae Dancer、Dark Queen 到场 | `contract-ready` |
| 25 | Borrowed Time | p33 | p28 | 作祟揭秘者左侧玩家 | 四类材料 token、破甲咒、Armor 传递、叛徒不死、回合末四属性流失 | `contract-ready` |
| 26 | The Family's Blessing | p34 | p29 | 作祟揭秘者 | 祭坛、毁贡/毁坛、亲族和 Elder、暗道行动、第二回合召唤 | `contract-ready` |
| 27 | Words from the Stars | p35 | p30 | 作祟揭秘者 | 外星文字扩散、语言知识、相邻伤害、文字障碍、叛徒移除英雄骰子 | `contract-ready` |
| 28 | We're Going to Need a Bigger House | p36 | p31 | 作祟揭秘者 | 淹没房间、鲨鱼、爆炸物搜索/喂食、洪水扩张、全屋淹没胜利 | `contract-ready` |
| 29 | A Beautiful Garden | p37 | p32 | 作祟揭秘者 | Cold Iron、学习/束缚 Fae、Fae 速度攻击、不可击晕怪物 | `contract-ready` |
| 30 | 'Til Death Do Us Part | p38 | p33 | 最低神志，排除揭秘者 | 婚礼戒指、预兆正反面、祭坛锁定、Wedding Party、叛徒属性下限 | `contract-ready` |
| 31 | A Ghost of a Chance | p39 | p34 | 作祟揭秘者 | 诅咒物品、偷取物品/预兆、特殊攻击属性、对应卡牌武器化 | `contract-ready` |
| 32 | The Catastrophe | p40 | p36-p37 | 作祟揭秘者 | 火 token、Bakeneko、亡灵猫、火焰房间伤害、火烧全屋胜利 | `contract-ready` |
| 33 | Smile for the Camera | p41 | p38 | 见事件 | 魔法相机、幻影摄影师、相机破坏、照片/魂魄目标、远程理智攻击 | `contract-ready` |
| 34 | Down the Hall, Second Dimension on the Right | p42-p43 | p39 | 最高知识 | 所有楼层视为一楼、维度操纵、Christina/目标人物、特殊连接与逃离 | `contract-ready` |
| 35 | Space Slugs | p44 | p40 | 作祟揭秘者 | 盐 token、太空蛞蝓、感染/附着、盐攻击和群体生成 | `contract-ready` |
| 36 | Finding Peace | p45 | p41 | 最低神志 | 鬼魂、悔恨/告解目标、不可攻击幽灵、回合末区域惩罚 | `contract-ready` |
| 37 | Out of Body | p46 | p42-p43 | 作祟揭秘者 | 换身、科技房间、样本上传、安全机器人、角色板与物品分离 | `contract-ready` |
| 38 | The Sinister Soiree | p47 | p44 | 作祟揭秘者 | 邻居/宴会、食物/派对目标、厨房复活、怪物数量轨 | `contract-ready` |
| 39 | Hive Mind | p48 | p46-p47 | 最高知识，排除揭秘者 | 黄蜂卵、工蜂、巨蜂、巢群防御、倒计时孵化 | `contract-ready` |
| 40 | Return of the Fleshwalkers | p49 | p48-p49 | 作祟揭秘者 | 邪恶双胞胎、反射对象、面具、陷阱/发电机、双胞胎属性复制 | `contract-ready` |
| 41 | A God in the Machine | p50 | p50 | 作祟揭秘者 | 神化房屋、陷阱、开关 token、电子附身、发电机过载 | `contract-ready` |
| 42 | Snack Attack | p51 | p51 | 作祟揭秘者 | 恶魔狗、闹鬼房间、食物、驱灵、狗随食物增强 | `contract-ready` |
| 43 | Hide and Eat | p52 | p52 | 持有预兆最多 | 狼人、隐藏 token、黎明计数、未受伤加速、隐藏者不可被攻击 | `contract-ready` |
| 44 | A Missing Seam | p53 | p53 | 作祟揭秘者左侧玩家 | 燃烧房间、假人、火势扩散、登陆板例外、全屋燃烧 | `contract-ready` |
| 45 | An Audacious Debut | p54 | p54 | 作祟揭秘者 | 剧本书、偷剧本、改写剧本、死亡场景计数、叛徒假死回归 | `contract-ready` |
| 46 | Ghost Hair | p55 | p55 | 作祟揭秘者 | 真解药编号、诅咒研究、大小毛发怪、携带真解药击败巨怪 | `contract-ready` |
| 47 | A Knight to Remember | p56 | p56 | 作祟揭秘者 | 传送门、被困英雄、关闭传送门、另一维度移动、骑士规则 | `contract-ready` |
| 48 | Don't Upset the Host! | p57 | p57 | 最高力量 | 房主之首、头骨、恐慌室、Bloody Room 复活、携带头骨风险 | `contract-ready` |
| 49 | Terms and Conditions | p58 | p58 | 作祟揭秘者 | 合同、血 token、恶魔、血魔法、恶魔不可持有合同限制 | `contract-ready` |
| 50 | The Taste of Flesh and Metal | p59 | p59 | 作祟揭秘者 | 构装体、吞噬房间、爆炸物、每区域爆炸物、计数轨速度 | `contract-ready` |

## 3. 逐作祟子账本必须落地的字段

每个作祟后续必须建立 `docs/games/betrayal/haunts/<number>-interaction-contract.md`，并至少填满以下字段：

| 字段 | 必须落地的设计内容 |
| --- | --- |
| 源段锁定 | 英雄书页码、叛徒书页码、是否独占一本书、是否 OCR 粘连或跨页 |
| 公开步骤 | 作祟揭示后所有玩家必须共同知道的介绍、设置、共同规则和顺序 |
| 私密可见性 | 英雄、叛徒、隐藏叛徒、自由混战各自能看什么；使用时哪些段落可公开 |
| setup 队列 | 搜索房间、放 token、移角色、回血 / 增属性、牌堆处理、首玩家；这是领域/执行队列，不等于作祟揭示前景 UI，秘密分发、内部状态和可由牌桌对象体现的设置明细不得直接堆上屏 |
| 揭示期 UI 边界 | 作祟揭示前景只承接公开读法和秘密边界短提示；作祟后进度条、特殊行动入口、攻击 / 交换 / 武器选择、setup 执行状态和秘密分发结果必须等玩家返回牌桌后再按各自 UI 承接，不得与揭示提示同屏组成信息墙；这里的 UI 包括可见层、sr-only、aria/status 播报和按钮 title，不能用无障碍文本提前暴露规则外或作祟后信息 |
| 目标模型 | 胜利条件、失败条件、倒计时、同时达成、平局、共享胜利 |
| 特殊行动 | 行动名、行动者、目标、所在房间 / 持有物条件、检定、结果表、次数限制 |
| 持续 / 触发规则 | 回合开始/结束、怪物回合、死亡、攻击、移动、交易、拾取、尸体搜刮 |
| token 合同 | 类型、数量、编号含义、正反面、owner、位置、可见性、是否可拾取/交易/攻击 |
| 房间 / 空间合同 | 重要房间、区域、楼层变化、翻面房间、特殊相邻、火/水/吞噬等板块状态 |
| 怪物合同 | 怪物属性、移动掷骰、攻击属性、受伤/击晕/杀死、行动顺序、特殊行动 |
| UI 承接 | 主目标条、进度条/计数轨、地图 token、对象本体动作、私密剧本书 |
| 验证 | 单测、页面测试、E2E、截图、未覆盖边界和代表链限制 |

## 4. 不可再犯的设计错误

- 不能再把 `source-blocked` 当成默认借口；本地已有官方源段时，缺的是拆解工作，不是来源。
- 不能用 #1 / #3 / #12 / #33 的代表链外推 50 个作祟。
- 不能只录目标和怪物名；每个特殊行动、回合触发、token 状态、房间状态都必须有状态真相和 UI 承接。
- 不能把长规则正文直接塞主界面；主界面承接短目标、进度、对象可点状态，完整规则进剧本书 / 帮助层。
- 不能在作祟子账本未完成时进入 `src/games/betrayal/*` 对应实现。
