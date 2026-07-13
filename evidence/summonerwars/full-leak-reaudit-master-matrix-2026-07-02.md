# 召唤师战争漏审全面补审总矩阵（2026-07-02）

## 目标

- 本文件用于承接用户要求的“所有漏审都全面补审”，不是只补 P0 四个对象。
- 当前先把 68 个能力风险对象全部纳入补审合同状态；后续按状态推进，不再把 locked 对象倒回录入层。
- 本文件不直接授权机制修改；只有对象合同为 locked 或 disputed 已裁定后，才进入实现对照、测试补证或最小修复。

## 总量与状态

> 当前状态覆盖说明（2026-07-03 / C85）：本文件的“当前继续动作”列是 2026-07-02 全量入队时的推进基线，不再代表 2026-07-03 的最新续跑状态。最新状态以各批次 `rule-text-lock`、`implementation-diff`、`l3-l4-residual-proof-queue-2026-07-02.md`、主 evidence 第 151 节和 `temp/summonerwars-audit/continuation-task-state.json` 为准：C80/C84 中基于官方在线文本包裁定 `ferocity` 与 `entangle` 归属的结论已失效，这两个对象降回 `disputed-待本地卡图合同裁定`；普通续跑不得因本表早期“下一步实现对照”字样回到图片/OCR/重新录入，除非明确进入数据录入合同层裁定这两个 disputed 对象。

| 项目 | 数量 |
| --- | ---: |
| 能力风险对象总数 | 68 |
| P0 | 4 |
| P1 | 7 |
| P2 | 36 |
| P3 | 13 |
| P4 | 8 |
| locked-L4已补 | 4 |
| locked-规则原文已锁 / 归属已裁定 | 62 |
| disputed-对象归属待裁定 | 2 |
| 待建合同-入口已补 | 0 |

## 全量补审矩阵

> 阅读门禁：下表用于保留 68 个对象被纳入补审时的对象全集、合同状态和当时继续动作。若要继续执行，应先读取后续批次矩阵和残余队列；不要直接按本表旧的“下一步实现对照”逐行重跑。

| 优先级 | 合同状态 | 对象 | 承载卡牌 | 触发 | 次数 | 风险字段 | 当前继续动作 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P0 | `locked-L4已补` | `fortress_power` | 瑟拉·艾德温(paladin-summoner) | afterAttack | 1 | 攻击后触发；每回合次数；custom结算；交互/目标选择 | L4 已补：未完成选择刷新恢复入口；完成选择后刷新不重复回手；不回录入层 |
| P0 | `locked-L4已补` | `imposing` | 贾穆德(frost-jarmund) | afterAttack | 1 | 攻击后触发；每回合次数；充能/boost | L4 已补：刷新/重连后仍只保留 1 个充能点；不回录入层 |
| P0 | `locked-L4已补` | `intimidate` | 雌狮(barbaric-lioness) | afterAttack | 1 | 攻击后触发；每回合次数；充能/boost | L4 已补：刷新/重连后仍只保留 1 个充能点；不回录入层 |
| P0 | `locked-L4已补` | `judgment` | 城塞圣武士(paladin-fortress-warrior) | afterAttack | - | 攻击后触发；custom结算 | L4 已补：刷新/重连后不重复抓牌；不回录入层 |
| P1 | `locked-规则原文已锁` | `high_telekinesis` | 卡拉(trickster-kara) | afterAttack | 1 | 攻击后触发；每回合次数；交互/目标选择；资源/状态改写 | 已锁官方原文 Greater Push；下一步实现对照，不回录入层 |
| P1 | `locked-规则原文已锁` | `inspire` | 凯鲁尊者(barbaric-kalu) | afterMove | - | 充能/boost | 2026-07-10 已将静态触发合同从 `activated` 修正为 `afterMove`；移动后自动结算与 AI 候选排除回归通过 |
| P1 | `locked-规则原文已锁` | `mind_transmission` | 古尔壮(trickster-gulzhuang) | afterAttack | 1 | 攻击后触发；每回合次数；交互/目标选择；资源/状态改写 | 已锁官方原文 Telepathic Command；下一步实现对照，不回录入层 |
| P1 | `locked-规则原文已锁` | `prepare` | 梅肯达·露(barbaric-makinda-ru)、边境弓箭手(barbaric-frontier-archer) | activated | 1 | 每回合次数；充能/boost | 已锁官方原文 Prepare；下一步实现对照，不回录入层 |
| P1 | `locked-规则原文已锁` | `rapid_fire` | 梅肯达·露(barbaric-makinda-ru)、边境弓箭手(barbaric-frontier-archer) | afterAttack | 1 | 攻击后触发；每回合次数；custom结算 | 已锁官方原文 Swift Shot；下一步实现对照，不回录入层 |
| P1 | `locked-规则原文已锁` | `telekinesis` | 清风法师(trickster-wind-mage) | afterAttack | 1 | 攻击后触发；每回合次数；交互/目标选择；资源/状态改写 | 已锁官方原文 Push；下一步实现对照，不回录入层 |
| P1 | `locked-规则原文已锁` | `withdraw` | 凯鲁尊者(barbaric-kalu) | afterAttack | 1 | 攻击后触发；每回合次数；custom结算；交互/目标选择 | 已锁官方原文 Withdraw；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `aerial_strike` | 葛拉克(trickster-gelak) | passive | - | custom结算 | 已锁官方原文 Levitate；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `ancestral_bond` | 阿布亚·石(barbaric-summoner) | afterMove | - | custom结算；交互/目标选择 | 2026-07-10 已修正静态触发合同；完整炽原精灵 AI 回合不再重复直推该能力并可正常结束 |
| P2 | `locked-规则原文已锁` | `blood_rune` | 布拉夫(goblin-blarf) | onPhaseStart | - | custom结算；交互/目标选择 | B3 已锁官方 Blood Runes 原文；下一步进入实现对照 |
| P2 | `locked-规则原文已锁` | `charge` | 野兽骑手(goblin-beast-rider) | onMove | - | custom结算；充能/boost | 已锁官方原文 Charge；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `divine_shield` | 科琳·布莱顿(paladin-corin) | passive | - | custom结算 | 已锁官方原文 Divine Shield；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `feed_beast` | 巨食兽(goblin-glutton) | onPhaseEnd | 1 | 每回合次数；custom结算；交互/目标选择 | B3 已锁官方 Feed the Eater 原文；下一步进入实现对照 |
| P2 | `disputed-待本地卡图合同裁定` | `ferocity` | 史米革(goblin-smirg) / 部落投石手(goblin-slinger)归属未裁定 | passive | - | custom结算 | C85 后不再接受官方在线文本包作为审计阶段归属裁定；现有配置/测试改动只能视为待裁定候选，必须回到本地卡图合同层裁定 |
| P2 | `locked-规则原文已锁` | `fortress_elite` | 瓦伦蒂娜·斯托哈特(paladin-valentina) | onDamageCalculation | - | custom结算 | 已锁官方原文 Citadel Champion；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `frost_axe` | 寒冰锻造师(frost-ice-smith) | afterMove | - | custom结算；交互/目标选择 | 2026-07-10 已修正静态触发合同；原移动后交互与攻击消费回归继续通过 |
| P2 | `locked-规则原文已锁` | `frost_bolt` | 冰霜法师(frost-mage) | onDamageCalculation | - | custom结算 | 已锁官方原文 Frost Bolt；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `grab` | 部落抓附手(goblin-grabber) | passive | - | custom结算；交互/目标选择 | B3 已锁官方 Cling 原文；下一步进入实现对照 |
| P2 | `locked-规则原文已锁` | `greater_frost_bolt` | 纳蒂亚娜(frost-natiana) | onDamageCalculation | - | custom结算 | 已锁官方原文 Greater Frost Bolt；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `guardian` | 城塞骑士(paladin-fortress-knight) | passive | - | custom结算 | 已锁官方原文 Protect；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `guidance` | 瓦伦蒂娜·斯托哈特(paladin-valentina) | onPhaseStart | - | custom结算 | 已锁官方原文 Guidance；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `healing` | 圣殿牧师(paladin-temple-priest) | beforeAttack | - | custom结算；交互/目标选择 | B3 已锁官方 Heal 原文；下一步进入实现对照 |
| P2 | `locked-规则原文已锁` | `high_telekinesis_instead` | 卡拉(trickster-kara) | activated | - | 交互/目标选择；资源/状态改写 | 已锁官方原文 Greater Push 的代替攻击分支；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `holy_arrow` | 城塞弓箭手(paladin-fortress-archer) | beforeAttack | - | custom结算；交互/目标选择 | B3 已锁官方 Arrow of Light 原文；下一步进入实现对照 |
| P2 | `locked-规则原文已锁` | `ice_ram` | 寒冰冲撞(frost-ice-ram) | activated | - | custom结算；事件卡持续效果内部执行能力 | 已锁官方原文 Ice Ram 分段规则；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `ice_shards` | 贾穆德(frost-jarmund) | onPhaseEnd | - | custom结算 | 已锁官方原文 Ice Shards；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `illusion` | 心灵巫女(trickster-mind-witch) | onPhaseStart | - | custom结算；交互/目标选择 | B3 已锁官方 Mimic 原文；下一步进入实现对照 |
| P2 | `locked-规则原文已锁` | `immobile` | 部落抓附手(goblin-grabber) | passive | - | custom结算 | 已锁官方原文 Immobile；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `infection` | 亡灵疫病体(necro-plague-zombie) | onKill | - | 交互/目标选择；资源/状态改写 | 已锁官方原文 Infect；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `life_drain` | 德拉戈斯(necro-dragos) | beforeAttack | - | 交互/目标选择；资源/状态改写 | 已锁官方原文 Life Drain；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `magic_addiction` | 史米革(goblin-smirg) | onTurnEnd | - | custom结算 | 已锁官方原文 Magic Junkie；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `mind_capture` | 泰珂露(trickster-summoner) | passive | - | custom结算 | 已锁官方原文 Mind Capture；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `mind_capture_resolve` | 泰珂露(trickster-summoner) | activated | - | custom结算；心灵捕获确认分支内部执行能力 | 已锁为 Mind Capture 内部确认分支；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `radiant_shot` | 雅各布·艾德温(paladin-jacob) | onDamageCalculation | - | custom结算 | 已锁官方原文 Radiant Shot；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `ranged` | 清风弓箭手(trickster-wind-archer) | passive | - | custom结算 | 已锁官方原文 Far Shot；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `revive_undead` | 瑞特-塔鲁斯(necro-summoner) | activated | 1 | 每回合次数；交互/目标选择；资源/状态改写 | B3 已锁官方 Raise the Dead 原文；下一步进入实现对照 |
| P2 | `locked-规则原文已锁` | `soul_transfer` | 亡灵弓箭手(necro-undead-archer) | onKill | - | custom结算 | 已锁官方原文 Soul Shift；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `speed_up` | 犀牛(barbaric-rhinoceros) | onMove | - | custom结算 | 已锁官方原文 Imbued Speed；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `spirit_bond` | 祖灵法师(barbaric-spirit-mage) | afterMove | 1 | 每回合次数；custom结算；交互/目标选择 | 2026-07-10 已修正静态触发合同；移动后强制二选一与重复响应回归继续通过 |
| P2 | `locked-规则原文已锁` | `stable` | 卡拉(trickster-kara) | passive | - | custom结算 | 已锁官方原文 Steadfast；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `structure_shift` | 丝瓦拉(frost-summoner) | afterMove | - | custom结算；交互/目标选择 | 2026-07-10 已修正静态触发合同；移动后两步建筑推移与重复响应回归继续通过 |
| P2 | `locked-规则原文已锁` | `telekinesis_instead` | 清风法师(trickster-wind-mage) | activated | - | 交互/目标选择；资源/状态改写 | 已锁官方原文 Push 的代替攻击分支；下一步实现对照，不回录入层 |
| P2 | `locked-规则原文已锁` | `vanish` | 思尼克斯(goblin-summoner) | activated | 1 | 每回合次数；custom结算；交互/目标选择 | B3 已锁官方 Sly 原文；下一步进入实现对照 |
| P3 | `locked-规则原文已锁` | `blood_rage` | 亡灵战士(necro-undead-warrior) | onUnitDestroyed | - | 充能/boost | B6 已锁官方 Blood Fury：你的回合内单位被消灭则本单位充能；你的回合结束移除 2 充能；进入实现对照 |
| P3 | `locked-规则原文已锁` | `blood_rage_decay` | 亡灵战士(necro-undead-warrior) | onTurnEnd | - | 资源/状态改写 | B6 已锁官方 Blood Fury 的回合末清理子句：你的回合结束移除 2 充能；与 blood_rage 共享合同 |
| P3 | `locked-规则原文已锁` | `climb` | 部落攀爬手(goblin-climber) | onMove | - | 资源/状态改写 | B7 已锁官方 Climb：移动时可额外 1 格并穿越建筑；进入实现对照 |
| P3 | `disputed-待本地卡图合同裁定` | `entangle` | 城塞骑士(paladin-fortress-knight)是否承载未裁定 | onAdjacentEnemyLeave | - | 资源/状态改写 | C85 后不再接受官方在线文本包作为审计阶段归属裁定；现有配置/测试改动只能视为待裁定候选，必须回到本地卡图合同层裁定 |
| P3 | `locked-规则原文已锁` | `evasion` | 掷术师(trickster-telekinetic) | onAdjacentEnemyAttack | - | 资源/状态改写 | B7 已锁官方 Stupefy：相邻敌人攻击任意卡且掷出 [s] 时该攻击少加 1 伤害；进入实现对照 |
| P3 | `locked-规则原文已锁` | `flying` | 葛拉克(trickster-gelak) | onMove | - | 资源/状态改写 | B7 已锁官方 Flight：移动时可额外 1 格并穿越 cards；进入实现对照 |
| P3 | `locked-规则原文已锁` | `gather_power` | 祖灵法师(barbaric-spirit-mage) | onSummon | - | 充能/boost | B6 已锁官方 Charged：召唤本单位后给本单位充能；进入实现对照 |
| P3 | `locked-规则原文已锁` | `power_boost` | 布拉夫(goblin-blarf)、亡灵战士(necro-undead-warrior) | onDamageCalculation | - | 充能/boost | B6 已锁官方 Imbued Strength：每点充能 +1 战力，最多 +5；需分别核对布拉夫与亡灵战士承载 |
| P3 | `locked-规则原文已锁` | `rebound` | 掷术师(trickster-telekinetic) | onAdjacentEnemyLeave | - | 资源/状态改写 | B7 已锁官方 Engage：相邻敌方单位移动或被强制离开本单位时对该敌人加 1 伤害；进入实现对照 |
| P3 | `locked-规则原文已锁` | `sacrifice` | 地狱火教徒(necro-hellfire-cultist) | onDeath | - | 资源/状态改写 | B8 已锁官方 Immolate：本单位被摧毁后，对每个曾相邻的敌方单位加 1 伤害；进入实现对照 |
| P3 | `locked-规则原文已锁` | `slow` | 寒冰魔像(frost-ice-golem) | onMove | - | 资源/状态改写 | B7 已锁官方 Slow：本单位少移动 1 格；进入实现对照 |
| P3 | `locked-规则原文已锁` | `swift` | 清风弓箭手(trickster-wind-archer) | onMove | - | 资源/状态改写 | B7 已锁官方 Swift：移动时可额外 1 格；进入实现对照 |
| P3 | `locked-规则原文已锁` | `trample` | 蒙威尊者(barbaric-moka)、犀牛(barbaric-rhinoceros)、熊骑兵(frost-bear-cavalry) | onMove | - | 资源/状态改写 | B7 已锁官方 Trample：移动可穿越 commons，移动后对穿越过的每个 common 加 1 伤害；进入实现对照 |
| P4 | `locked-规则原文已锁` | `cold_snap` | 奥莱格(frost-oleg) | passive | - | 低风险静态/被动 | B8 已锁官方 Cold Snap：友方建筑 +1 生命，官方原文无范围限制；进入实现对照 |
| P4 | `locked-规则原文已锁` | `fire_sacrifice_summon` | 伊路特-巴尔(necro-elut-bar) | onSummon | - | 低风险静态/被动 | B8 已锁官方 Summoned by Fire：召唤支付时必须摧毁友方单位，并用本单位替换其位置；进入实现对照 |
| P4 | `locked-规则原文已锁` | `life_up` | 雌狮(barbaric-lioness) | passive | - | 低风险静态/被动 | B6 已锁官方 Imbued Life：每点充能 +1 生命，最多 +5；进入实现对照 |
| P4 | `locked-规则原文已锁` | `living_gate` | 寒冰魔像(frost-ice-golem) | passive | - | 低风险静态/被动 | B8 已锁官方 Living Gate：本卡是传送门；进入实现对照 |
| P4 | `locked-规则原文已锁` | `mobile_structure` | 寒冰魔像(frost-ice-golem) | passive | - | 低风险静态/被动 | B8 已锁官方 Mobile Structure：本卡可以移动；进入实现对照 |
| P4 | `locked-规则原文已锁` | `power_up` | 蒙威尊者(barbaric-moka) | onDamageCalculation | - | 低风险静态/被动 | B6 已锁官方 Imbued Strength：每点充能 +1 战力，最多 +5；后续裁定本地 power_up 命名/承载差异 |
| P4 | `locked-规则原文已锁` | `rage` | 古尔-达斯(necro-gul-das) | onDamageCalculation | - | 低风险静态/被动 | B6 已锁官方 Wrath：每点伤害 +1 战力；进入实现对照 |
| P4 | `locked-规则原文已锁` | `soulless` | 亡灵疫病体(necro-plague-zombie) | onKill | - | 低风险静态/被动 | B8 已锁官方 Soulless：本单位摧毁敌方单位时不获得魔法；进入实现对照 |

## 分流规则

- P0 / `locked-L4已补`：雌狮「威势」、贾穆德「威势」、瑟拉·艾德温「城塞之力」、城塞圣武士「裁决」的 L4 重连/回放专项已补；禁止重新 OCR 或重录。
- P1 / `locked-规则原文已锁`：B1 五个对象与 B2 两个对象均已锁官方原文并完成首轮实现对照；后续只进入真实入口、刷新/回放、重复消费等 L3/L4 补证。
- P2 / `locked-规则原文已锁`：35 个对象已完成规则原文锁定和首轮实现对照分批收口；`ferocity` 在 C85 后降回 `disputed-待本地卡图合同裁定`，不得按已裁定处理。
- P3/P4 / `locked-规则原文已锁`：P3/P4 locked/已裁定对象已完成规则原文锁定和首轮实现对照分批收口；不再按待建合同处理，后续只按风险补真实入口或代表链证据。
- `disputed-对象归属待裁定`：当前为 2；`ferocity`、`entangle` 必须回到本地清晰卡图/完整单对象图/用户指定权威来源裁定。

## 下一批执行入口

1. 当前数据录入合同阶段在 C85 后修正为 `4 L4 + 62 locked/已裁定 + 2 disputed + 0 待建合同`；普通续跑不得回图片/OCR 或重新录入，除非明确进入数据录入合同层裁定 `ferocity` / `entangle`。
2. 下一步以 `evidence/summonerwars/l3-l4-residual-proof-queue-2026-07-02.md` 为入口，优先补攻击后额外攻击、真实选择/确认、阶段推进、刷新/回放不重复消费。
3. 若 L3/L4 对照中发现 locked 合同缺字段、来源冲突或对象归属不清，先把对象回写为 `blocked` 或 `disputed`，再回录入层补合同。
4. `ferocity`、`entangle` 仍为 disputed；在本地卡图合同未裁定前，不得写“已修复”结论，不得把测试通过当作归属证明。
5. 只有“已锁合同子句”和“当前实现链路”形成明确冲突时，才写最小失败测试和最小修复。
