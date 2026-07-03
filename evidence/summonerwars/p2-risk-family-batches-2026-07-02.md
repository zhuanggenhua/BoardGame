# 召唤师战争 P2 风险族补审批次表（2026-07-02）

## 目的

- 承接“所有漏审都全面补审”：P2 不能只保留第一组，必须把 36 个 blocked 对象拆成可执行风险族。
- 所有对象当前仍为 `blocked`：未锁权威原文前不得写规则断言测试或机制修复。

## 风险族批次

| 风险族 | 对象数 | 对象 | 当前动作 |
| --- | ---: | --- | --- |
| 攻击前/攻击后/击杀窗口 | 5 | `healing`、`holy_arrow`、`infection`、`life_drain`、`soul_transfer` | 先补对象合同和权威原文；未锁前不修机制 |
| 每回合次数 | 4 | `feed_beast`、`revive_undead`、`spirit_bond`、`vanish` | 先补对象合同和权威原文；未锁前不修机制 |
| 目标/交互选择 | 16 | `ancestral_bond`、`blood_rune`、`feed_beast`、`frost_axe`、`grab`、`healing`、`high_telekinesis_instead`、`holy_arrow`、`illusion`、`infection`、`life_drain`、`revive_undead`、`spirit_bond`、`structure_shift`、`telekinesis_instead`、`vanish` | 先补对象合同和权威原文；未锁前不修机制 |
| custom 后续结算 | 31 | `aerial_strike`、`ancestral_bond`、`blood_rune`、`charge`、`divine_shield`、`feed_beast`、`ferocity`、`fortress_elite`、`frost_axe`、`frost_bolt`、`grab`、`greater_frost_bolt`、`guardian`、`guidance`、`healing`、`holy_arrow`、`ice_ram`、`ice_shards`、`illusion`、`immobile`、`magic_addiction`、`mind_capture`、`mind_capture_resolve`、`radiant_shot`、`ranged`、`soul_transfer`、`speed_up`、`spirit_bond`、`stable`、`structure_shift`、`vanish` | 先补对象合同和权威原文；未锁前不修机制 |
| 召唤/弃牌/转移/状态写入 | 5 | `high_telekinesis_instead`、`infection`、`life_drain`、`revive_undead`、`telekinesis_instead` | 先补对象合同和权威原文；未锁前不修机制 |
| 内部 continuation 归属已补 | 2 | `ice_ram`、`mind_capture_resolve` | 已补到承载卡牌；仍需补对象合同和权威原文，未锁前不修机制 |

## P2 全量对象

| 对象 | 承载卡牌 | 触发 | 次数 | 目标/交互 | custom | 风险字段 | 合同状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `aerial_strike` | 葛拉克(trickster-gelak) | passive | - | - | - | custom结算 | `blocked` |
| `ancestral_bond` | 阿布亚·石(barbaric-summoner) | activated | - | - | - | custom结算；交互/目标选择 | `blocked` |
| `blood_rune` | 布拉夫(goblin-blarf) | onPhaseStart | - | - | - | custom结算；交互/目标选择 | `blocked` |
| `charge` | 野兽骑手(goblin-beast-rider) | onMove | - | - | - | custom结算；充能/boost | `blocked` |
| `divine_shield` | 科琳·布莱顿(paladin-corin) | passive | - | - | - | custom结算 | `blocked` |
| `feed_beast` | 巨食兽(goblin-glutton) | onPhaseEnd | 1 | - | - | 每回合次数；custom结算；交互/目标选择 | `blocked` |
| `ferocity` | 史米革(goblin-smirg)、部落投石手(goblin-slinger) | passive | - | - | - | custom结算 | `blocked` |
| `fortress_elite` | 瓦伦蒂娜·斯托哈特(paladin-valentina) | onDamageCalculation | - | - | - | custom结算 | `blocked` |
| `frost_axe` | 寒冰锻造师(frost-ice-smith) | activated | - | - | - | custom结算；交互/目标选择 | `blocked` |
| `frost_bolt` | 冰霜法师(frost-mage) | onDamageCalculation | - | - | - | custom结算 | `blocked` |
| `grab` | 部落抓附手(goblin-grabber) | passive | - | - | - | custom结算；交互/目标选择 | `blocked` |
| `greater_frost_bolt` | 纳蒂亚娜(frost-natiana) | onDamageCalculation | - | - | - | custom结算 | `blocked` |
| `guardian` | 城塞骑士(paladin-fortress-knight) | passive | - | - | - | custom结算 | `blocked` |
| `guidance` | 瓦伦蒂娜·斯托哈特(paladin-valentina) | onPhaseStart | - | - | - | custom结算 | `blocked` |
| `healing` | 圣殿牧师(paladin-temple-priest) | beforeAttack | - | - | - | custom结算；交互/目标选择 | `blocked` |
| `high_telekinesis_instead` | 卡拉(trickster-kara) | activated | - | - | - | 交互/目标选择；资源/状态改写 | `blocked` |
| `holy_arrow` | 城塞弓箭手(paladin-fortress-archer) | beforeAttack | - | - | - | custom结算；交互/目标选择 | `blocked` |
| `ice_ram` | 寒冰冲撞(frost-ice-ram) | activated | - | - | - | custom结算；事件卡持续效果内部执行能力 | `blocked` |
| `ice_shards` | 贾穆德(frost-jarmund) | onPhaseEnd | - | - | - | custom结算 | `blocked` |
| `illusion` | 心灵巫女(trickster-mind-witch) | onPhaseStart | - | - | - | custom结算；交互/目标选择 | `blocked` |
| `immobile` | 部落抓附手(goblin-grabber) | passive | - | - | - | custom结算 | `blocked` |
| `infection` | 亡灵疫病体(necro-plague-zombie) | onKill | - | - | - | 交互/目标选择；资源/状态改写 | `blocked` |
| `life_drain` | 德拉戈斯(necro-dragos) | beforeAttack | - | - | - | 交互/目标选择；资源/状态改写 | `blocked` |
| `magic_addiction` | 史米革(goblin-smirg) | onTurnEnd | - | - | - | custom结算 | `blocked` |
| `mind_capture` | 泰珂露(trickster-summoner) | passive | - | - | - | custom结算 | `blocked` |
| `mind_capture_resolve` | 泰珂露(trickster-summoner) | activated | - | - | - | custom结算；心灵捕获确认分支内部执行能力 | `blocked` |
| `radiant_shot` | 雅各布·艾德温(paladin-jacob) | onDamageCalculation | - | - | - | custom结算 | `blocked` |
| `ranged` | 清风弓箭手(trickster-wind-archer) | passive | - | - | - | custom结算 | `blocked` |
| `revive_undead` | 瑞特-塔鲁斯(necro-summoner) | activated | 1 | - | - | 每回合次数；交互/目标选择；资源/状态改写 | `blocked` |
| `soul_transfer` | 亡灵弓箭手(necro-undead-archer) | onKill | - | - | - | custom结算 | `blocked` |
| `speed_up` | 犀牛(barbaric-rhinoceros) | onMove | - | - | - | custom结算 | `blocked` |
| `spirit_bond` | 祖灵法师(barbaric-spirit-mage) | activated | 1 | - | - | 每回合次数；custom结算；交互/目标选择 | `blocked` |
| `stable` | 卡拉(trickster-kara) | passive | - | - | - | custom结算 | `blocked` |
| `structure_shift` | 丝瓦拉(frost-summoner) | activated | - | - | - | custom结算；交互/目标选择 | `blocked` |
| `telekinesis_instead` | 清风法师(trickster-wind-mage) | activated | - | - | - | 交互/目标选择；资源/状态改写 | `blocked` |
| `vanish` | 思尼克斯(goblin-summoner) | activated | 1 | - | - | 每回合次数；custom结算；交互/目标选择 | `blocked` |

## 下一步

1. `ice_ram` 与 `mind_capture_resolve` 已先补承载卡牌归属，但仍保持 `blocked`，下一步补权威原文与原子子句。
2. 再处理目标/交互与 custom 后续结算族，因为这些最容易产生卡死、重复结算和共享链漏审。
3. 每锁定一张卡或一个对象，回写正式 evidence 后再进入测试或代码修复。
