# 召唤师战争 B5 P2 custom 与 continuation 规则原文锁定（2026-07-02）

## 目的

- 承接 `rule-text-lock-batch-queue-2026-07-02.md` 的 B5 队列。
- 本文件只做数据录入合同锁定：锁官方英文原文、对象归属、原子子句和继续边界。
- 本文件不做实现审计、不写规则断言测试、不改机制代码；C85 后撤销基于在线文本包的 `ferocity` 归属裁定，改回待本地卡图合同裁定。

## 权威来源

- 官方站点静态包：`https://summonerwars.plaidhatgames.com/static/js/main.610e76c5.chunk.js`。
- 本地缓存：`temp/summonerwars-audit/official-cache/main.610e76c5.chunk.js`。
- 图源入口沿用 `data-entry-crop-manifest-2026-07-02.md` 中的完整单卡裁图和文字区裁图。
- 本轮只使用官方静态包 `|TEXT` 锁规则原文；本地 i18n、AbilityDef、旧测试和 OCR 只作为对象归属线索。
- 2026-07-17 更新：贾穆德「寒冰碎屑」（`ice_shards`）已被当前用户故事覆盖，现行实现和验收口径见 `docs/games/summonerwars/user-stories/ice-shards-attack-start-auto-2026-07-17.md` 与 `evidence/summonerwars/summonerwars-ice-shards-e2e-test.md`；本文件中该对象旧的“建造阶段结束 / 可选择”口径只保留为历史来源记录，不再作为当前实现真相。

## 命名映射裁定

- 葛拉克「浮空术」（`aerial_strike`）对应官方 `Levitate`；本地能力名不是官方名。
- 野兽骑手「冲锋」（`charge`）对应官方 `Charge`。
- 科琳·布莱顿「神圣护盾」（`divine_shield`）对应官方 `Divine Shield`。
- 瓦伦蒂娜·斯托哈特「城塞精锐」（`fortress_elite`）对应官方 `Citadel Champion`；本地能力名不是官方名。
- 冰霜法师「冰霜飞弹」（`frost_bolt`）对应官方 `Frost Bolt`。
- 纳蒂亚娜「高阶冰霜飞弹」（`greater_frost_bolt`）对应官方 `Greater Frost Bolt`。
- 城塞骑士「守卫」（`guardian`）对应官方 `Protect`；本地能力名不是官方名。
- 瓦伦蒂娜·斯托哈特「指引」（`guidance`）对应官方 `Guidance`。
- 贾穆德「寒冰碎屑」（`ice_shards`）对应官方 `Ice Shards`。
- 部落抓附手「禁足」（`immobile`）对应官方 `Immobile`。
- 史米革「魔力成瘾」（`magic_addiction`）对应官方 `Magic Junkie`；本地能力名不是官方名。
- 泰珂露「心灵捕获」（`mind_capture` / `mind_capture_resolve`）对应官方 `Mind Capture`；`mind_capture_resolve` 是同一官方能力的内部确认分支，不是独立卡面能力。
- 雅各布·艾德温「辉光射击」（`radiant_shot`）对应官方 `Radiant Shot`。
- 清风弓箭手「远射」（`ranged`）对应官方 `Far Shot`；本地能力名不是官方名。
- 犀牛「速度强化」（`speed_up`）对应官方 `Imbued Speed`；本地能力名不是官方名。
- 卡拉「稳固」（`stable`）对应官方 `Steadfast`；本地能力名不是官方名。

## 规则锁定矩阵

| 对象 | 中文承载卡 | 官方能力名 | 官方原文 | 原子子句 | 合同状态 | 下一步 |
| --- | --- | --- | --- | --- | --- | --- |
| `aerial_strike` | 葛拉克 | Levitate | Any friendly common that starts its move within 2 spaces of this unit has Flight during that move. | C1 影响友方士兵；C2 该士兵开始移动时必须在本单位 2 格内；C3 只在该次移动期间获得 Flight；C4 Flight 规则另有官方原文，但本对象锁定的是赋予 Flight 的光环子句 | `locked-规则原文已锁` | 进入实现对照：确认开始移动时距离、友方士兵限制、Flight 持续到本次移动结束、与本地 `flying`/移动穿越规则的边界 |
| `charge` | 野兽骑手 | Charge | When this unit moves, it may move up to 2 extra spaces if it moves only in one direction. If it moves 3 or more spaces and only in one direction, it has +1 strength until the end of the turn. | C1 本单位移动时结算；C2 若只沿一个方向移动，可最多额外移动 2 格；C3 若移动 3 格或更多且只沿一个方向，本回合结束前 +1 战力；C4 两段效果都受“只沿一个方向”限制 | `locked-规则原文已锁` | 进入实现对照：确认移动距离、直线方向、+1 战力持续到回合结束、无效路径负向场景 |
| `divine_shield` | 科琳·布莱顿 | Divine Shield | Each time a friendly Citadel unit within 3 spaces of this unit is targeted by an enemy's attack, roll 2 dice. For each [s] rolled, reduce the attacking unit’s strength by 1 during that attack, to a minimum of 1. | C1 每当 3 格内友方城塞单位成为敌方攻击目标时触发；C2 掷 2 个骰子；C3 每个特殊标记使攻击单位本次攻击战力 -1；C4 战力最低为 1；C5 只影响本次攻击 | `locked-规则原文已锁` | 进入实现对照：确认目标窗口、友方城塞限制、3 格距离、骰子数量、最低战力 1、只影响本次攻击 |
| `ferocity` | 史米革 / 部落投石手归属未裁定 | Relentless 仅作候选线索 | C85 后官方缓存/在线文本包不能在审计阶段高于本地清晰卡图或已锁合同；此前 `Smeg` / `Horde Slinger` 邻近文本只能作为录入层对照线索，不能直接裁定对象归属。 | C1 需要本地清晰卡图、完整单对象图或用户明确指定权威来源裁定史米革是否承载；C2 需要同级来源裁定部落投石手是否承载；C3 在裁定前，本地旧配置与候选来源差异只能记为对象归属争议 | `disputed-待本地卡图合同裁定` | 回到数据录入合同层裁定对象归属；裁定前不得进入机制修复或通过结论 |
| `fortress_elite` | 瓦伦蒂娜·斯托哈特 | Citadel Champion | This unit has +1 strength for each friendly Citadel unit within 2 spaces. | C1 本单位获得战力加成；C2 每个 2 格内友方城塞单位提供 +1 战力；C3 按当前战斗/计算时状态动态计数；C4 只统计友方城塞单位 | `locked-规则原文已锁` | 进入实现对照：确认城塞标签、友方限制、2 格范围、战力计算时机和动态变化 |
| `frost_bolt` | 冰霜法师 | Frost Bolt | This unit has +1 strength for each adjacent friendly structure. | C1 本单位获得战力加成；C2 每个相邻友方建筑提供 +1 战力；C3 只统计相邻；C4 只统计友方建筑 | `locked-规则原文已锁` | 进入实现对照：确认相邻范围、友方建筑限制、战力计算时机 |
| `greater_frost_bolt` | 纳蒂亚娜 | Greater Frost Bolt | This unit has +1 strength for each friendly structure within 2 spaces. | C1 本单位获得战力加成；C2 每个 2 格内友方建筑提供 +1 战力；C3 只统计友方建筑；C4 与 `frost_bolt` 的相邻范围不同 | `locked-规则原文已锁` | 进入实现对照：确认 2 格范围、友方建筑限制、战力计算时机 |
| `guardian` | 城塞骑士 | Protect | When an adjacent enemy attacks, the target of that attack must be a unit with the Protect ability. | C1 相邻敌方单位攻击时触发；C2 该攻击的目标必须是有 Protect 能力的单位；C3 限制的是攻击目标选择；C4 只要求敌方攻击者相邻 | `locked-规则原文已锁` | 进入实现对照：确认相邻敌方攻击窗口、强制目标筛选、多个 Protect 目标、无合法目标负向场景 |
| `guidance` | 瓦伦蒂娜·斯托哈特 | Guidance | At the start of your Summon Phase, draw 2 cards. | C1 你的召唤阶段开始时触发；C2 抽 2 张牌；C3 未写 may，按强制自动效果登记 | `locked-规则原文已锁` | 进入实现对照：确认召唤阶段开始窗口、抽牌数、牌库不足负向场景 |
| `ice_ram` | 寒冰冲撞 | Ice Ram | After moving or forcing a friendly structure, you may target a common or champion adjacent to that structure. Add 1 damage to the target. You may force the target 1 space. | C1 在移动或强制移动一个友方建筑后结算；C2 可目标该建筑相邻的一个士兵或英雄；C3 对目标加 1 伤害；C4 可强制移动目标 1 格；C5 目标类型不包括召唤师或建筑 | `locked-规则原文已锁` | 进入实现对照：确认友方建筑移动/被强制移动窗口、相邻目标、士兵/英雄限制、1 伤害、可选 Force 1 格 |
| `ice_shards` | 贾穆德 | Ice Shards | At the end of your Build Phase, you may spend 1 boost to add 1 damage to each enemy unit adjacent to 1 or more structures you control. | 2026-07-17 被当前用户故事覆盖：现行口径为攻击阶段开始自动消耗 1 充能，并对每个与己方建筑相邻的敌方单位造成 1 伤害；不出现确认/跳过选择；多建筑相邻不重复伤害。 | `superseded-用户故事覆盖旧口径` | 当前实现对照和 E2E 证据见 `docs/games/summonerwars/user-stories/ice-shards-attack-start-auto-2026-07-17.md` 与 `evidence/summonerwars/summonerwars-ice-shards-e2e-test.md` |
| `immobile` | 部落抓附手 | Immobile | This unit cannot move. | C1 本单位不能移动；C2 这是移动权限限制；C3 与被放置、被强制移动是否等同移动需在实现对照中引用通用规则裁定 | `locked-规则原文已锁` | 进入实现对照：确认普通移动禁用、强制移动/放置是否受限的规则来源 |
| `magic_addiction` | 史米革 | Magic Junkie | At the end of your turn, either spend 1 magic or discard this unit. | C1 你的回合结束时结算；C2 二选一：花费 1 魔力或弃置本单位；C3 未写 may，按强制二选一登记；C4 无魔力时必须走弃置路径 | `locked-规则原文已锁` | 进入实现对照：确认回合结束窗口、魔力花费、无魔力弃置、可选路径 UI 或自动路径 |
| `mind_capture` | 泰珂露 | Mind Capture | When this unit attacks an enemy unit, if the damage added would be enough to destroy the target, you may instead ignore that damage and take control of the target. | C1 本单位攻击敌方单位时结算；C2 条件是本次将加入的伤害足以摧毁目标；C3 可改为忽略该伤害；C4 若选择忽略伤害，则获得目标控制权；C5 目标是敌方单位 | `locked-规则原文已锁` | 进入实现对照：确认致死伤害判定、忽略伤害、控制权转移、可选确认和取消路径 |
| `mind_capture_resolve` | 泰珂露 | Mind Capture | When this unit attacks an enemy unit, if the damage added would be enough to destroy the target, you may instead ignore that damage and take control of the target. | C1 本对象是 `mind_capture` 的内部确认分支；C2 不单独对应额外卡面能力；C3 只承接“忽略伤害并获得控制权”或“保留伤害”的选择结果 | `locked-规则原文已锁` | 进入实现对照：确认内部分支只服务 Mind Capture，不得独立触发或重复结算 |
| `radiant_shot` | 雅各布·艾德温 | Radiant Shot | This unit has +1 strength for every 2 magic you have. | C1 本单位获得战力加成；C2 你每有 2 点魔力提供 +1 战力；C3 按整数每 2 点计；C4 以当前拥有魔力数为计算来源 | `locked-规则原文已锁` | 进入实现对照：确认魔力计数、向下取整、战力计算时机 |
| `ranged` | 清风弓箭手 | Far Shot | This unit may attack cards up to 4 clear straight spaces away. | C1 本单位可攻击最多 4 个清晰直线格外的卡牌；C2 要求 clear straight spaces；C3 目标是 cards，不只限单位；C4 这是远程攻击距离规则 | `locked-规则原文已锁` | 进入实现对照：确认 4 格直线、阻挡规则、目标类型 cards、与普通远程 3 格规则边界 |
| `speed_up` | 犀牛 | Imbued Speed | When this unit moves, it may move 1 extra space for each boost it has, to a maximum of +5. | C1 本单位移动时结算；C2 每有 1 充能可额外移动 1 格；C3 最多 +5；C4 写有 may，按可选额外移动登记 | `locked-规则原文已锁` | 进入实现对照：确认充能计数、最大 +5、移动路径上限、可选性 |
| `stable` | 卡拉 | Steadfast | This unit cannot be forced. | C1 本单位不能被强制移动；C2 该限制只针对 forced；C3 与普通移动、放置、交换是否受限需实现对照引用通用规则裁定 | `locked-规则原文已锁` | 进入实现对照：确认 Force 免疫、普通移动不受影响、与 Greater Push/Push 的目标过滤关系 |

## 继续边界

- B5 十八个对象已完成规则原文 locked；后续不再回到 OCR、裁图重读或实现字段倒推。
- `ferocity` 在 C85 后撤销已裁定口径：官方在线文本包只保留为候选线索，后续必须按 `disputed` 回到本地卡图/完整单对象图合同层裁定。
- 本文件没有确认任何实现 bug；locked 对象下一步只能进入实现对照和最小验证分流。
