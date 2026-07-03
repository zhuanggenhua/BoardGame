# 召唤师战争 P3/P4 待建合同对象表（2026-07-02）

## 目的

- 承接“所有漏审都全面补审”：P3/P4 不能继续只挂在总队列里，必须落到对象级合同。
- 本文件先建立待建合同入口，不把低风险对象直接判通过。
- 若对象后续发现攻击后、次数、custom、目标选择、状态清理、UI 或共享链风险，立即升级到 P2/P3 深审。

## 总量

| 分层 | 数量 | 当前状态 |
| --- | ---: | --- |
| P3 状态/数值链 | 13 | 12 已锁，1 disputed |
| P4 低风险静态/被动 | 8 | 8 已锁 |

## 对象级合同入口

> 本节把 21 个 P3/P4 漏审对象从“只有总队列”推进到对象级合同入口：每个对象都有承载卡、主图源、完整单卡裁图、文字区裁图、实现入口和实现效果摘要。  
> 这仍不是 `locked`：规则原文/原子子句还未逐字锁定，不能写机制断言测试，也不能改机制代码。

| 分层 | 对象 | 承载卡牌 | 主图源与帧 | 完整单卡/文字区裁图 | 实现入口与当前实现摘要 | 合同状态 | 待补合同字段 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P3 | `blood_rage` | 亡灵战士(necro-undead-warrior) | Necromancer `cards.webp` / NECROMANCER_CARDS_ATLAS 6 | `full\necro-undead-warrior__blood_rage,blood_rage_decay,power_boost__NECROMANCER_CARDS_ATLAS__6.jpg` / `text\necro-undead-warrior__blood_rage,blood_rage_decay,power_boost__NECROMANCER_CARDS_ATLAS__6__text.jpg` | `domain/abilities.ts:497`；`onUnitDestroyed`，当前实现为单位被消灭时给自身 +1 充能 | `locked-规则原文已锁` | B6 已锁：见 `b6-p3-p4-charge-and-stat-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |
| P3 | `blood_rage_decay` | 亡灵战士(necro-undead-warrior) | Necromancer `cards.webp` / NECROMANCER_CARDS_ATLAS 6 | 同 `blood_rage` | `domain/abilities.ts:531`；`onTurnEnd`，当前实现为回合结束且有充能时移除 2 充能 | `locked-规则原文已锁` | B6 已锁：见 `b6-p3-p4-charge-and-stat-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |
| P3 | `climb` | 部落攀爬手(goblin-climber) | Goblin `cards.webp` / CARDS_ATLAS 0 | `full\goblin-climber__climb__CARDS_ATLAS__0.jpg` / `text\goblin-climber__climb__CARDS_ATLAS__0__text.jpg` | `domain/abilities-goblin.ts:246`；`onMove`，当前实现为额外移动 +1 且可穿越建筑 | `locked-规则原文已锁` | B7 已锁：见 `b7-p3-movement-and-adjacency-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |
| P3 | `entangle` | 城塞骑士(paladin-fortress-knight) | Paladin `cards.webp` / CARDS_ATLAS 5 | `full\paladin-fortress-knight__entangle,guardian__CARDS_ATLAS__5.jpg` / `text\paladin-fortress-knight__entangle,guardian__CARDS_ATLAS__5__text.jpg` | `domain/abilities-paladin.ts:252`；`onAdjacentEnemyLeave`，当前实现为对目标造成 1 点伤害 | `disputed-对象归属待裁定` | B7 转 disputed：官方缓存不能证明城塞骑士承载 Engage/Entangle；先裁定对象归属 |
| P3 | `evasion` | 掷术师(trickster-telekinetic) | Trickster `cards.webp` / CARDS_ATLAS 7 | `full\trickster-telekinetic__evasion,rebound__CARDS_ATLAS__7.jpg` / `text\trickster-telekinetic__evasion,rebound__CARDS_ATLAS__7__text.jpg` | `domain/abilities-trickster.ts:522`；`onAdjacentEnemyAttack`，当前实现为特殊骰条件下减伤 1 | `locked-规则原文已锁` | B7 已锁：见 `b7-p3-movement-and-adjacency-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |
| P3 | `flying` | 葛拉克(trickster-gelak) | Trickster `cards.webp` / CARDS_ATLAS 1 | `full\trickster-gelak__aerial_strike,flying__CARDS_ATLAS__1.jpg` / `text\trickster-gelak__aerial_strike,flying__CARDS_ATLAS__1__text.jpg` | `domain/abilities-trickster.ts:69`；`onMove`，当前实现为额外移动 +1 且可穿越所有对象 | `locked-规则原文已锁` | B7 已锁：见 `b7-p3-movement-and-adjacency-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |
| P3 | `gather_power` | 祖灵法师(barbaric-spirit-mage) | Barbaric `cards.webp` / CARDS_ATLAS 1 | `full\barbaric-spirit-mage__gather_power,spirit_bond__CARDS_ATLAS__1.jpg` / `text\barbaric-spirit-mage__gather_power,spirit_bond__CARDS_ATLAS__1__text.jpg` | `domain/abilities-barbaric.ts:307`；`onSummon`，当前实现为召唤时自身 +1 充能 | `locked-规则原文已锁` | B6 已锁：见 `b6-p3-p4-charge-and-stat-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |
| P3 | `power_boost` | 布拉夫(goblin-blarf)、亡灵战士(necro-undead-warrior) | Goblin CARDS_ATLAS 1；Necromancer NECROMANCER_CARDS_ATLAS 6 | `full\goblin-blarf__blood_rune,power_boost__CARDS_ATLAS__1.jpg`；`full\necro-undead-warrior__blood_rage,blood_rage_decay,power_boost__NECROMANCER_CARDS_ATLAS__6.jpg` | `domain/abilities.ts:510`；`onDamageCalculation`，当前实现为按自身充能增加攻击，最多 +5 | `locked-规则原文已锁` | B6 已锁：见 `b6-p3-p4-charge-and-stat-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |
| P3 | `rebound` | 掷术师(trickster-telekinetic) | Trickster `cards.webp` / CARDS_ATLAS 7 | 同 `evasion` | `domain/abilities-trickster.ts:533`；`onAdjacentEnemyLeave`，当前实现为对目标造成 1 点伤害 | `locked-规则原文已锁` | B7 已锁：见 `b7-p3-movement-and-adjacency-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |
| P3 | `sacrifice` | 地狱火教徒(necro-hellfire-cultist) | Necromancer `cards.webp` / NECROMANCER_CARDS_ATLAS 7 | `full\necro-hellfire-cultist__sacrifice__NECROMANCER_CARDS_ATLAS__7.jpg` / `text\necro-hellfire-cultist__sacrifice__NECROMANCER_CARDS_ATLAS__7__text.jpg` | `domain/abilities.ts:544`；`onDeath`，当前实现为对相邻敌人造成 1 点伤害 | `locked-规则原文已锁` | B8 已锁：见 `b8-p3-p4-static-summon-and-death-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |
| P3 | `slow` | 寒冰魔像(frost-ice-golem) | Frost `cards.webp` / CARDS_ATLAS 6 | `full\frost-ice-golem__living_gate,mobile_structure,slow__CARDS_ATLAS__6.jpg` / `text\frost-ice-golem__living_gate,mobile_structure,slow__CARDS_ATLAS__6__text.jpg` | `domain/abilities-frost.ts:340`；`onMove`，当前实现为额外移动 -1 | `locked-规则原文已锁` | B7 已锁：见 `b7-p3-movement-and-adjacency-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |
| P3 | `swift` | 清风弓箭手(trickster-wind-archer) | Trickster `cards.webp` / CARDS_ATLAS 4 | `full\trickster-wind-archer__ranged,swift__CARDS_ATLAS__4.jpg` / `text\trickster-wind-archer__ranged,swift__CARDS_ATLAS__4__text.jpg` | `domain/abilities-trickster.ts:308`；`onMove`，当前实现为额外移动 +1 | `locked-规则原文已锁` | B7 已锁：见 `b7-p3-movement-and-adjacency-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |
| P3 | `trample` | 蒙威尊者、犀牛、熊骑兵 | Barbaric CARDS_ATLAS 3/8；Frost CARDS_ATLAS 1 | `full\barbaric-moka__power_up,trample__CARDS_ATLAS__3.jpg`；`full\barbaric-rhinoceros__speed_up,trample__CARDS_ATLAS__8.jpg`；`full\frost-bear-cavalry__trample__CARDS_ATLAS__1.jpg` | `domain/abilities-frost.ts:224`；`onMove`，当前实现为可穿越单位并对穿越单位造成 1 点伤害 | `locked-规则原文已锁` | B7 已锁：见 `b7-p3-movement-and-adjacency-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |
| P4 | `cold_snap` | 奥莱格(frost-oleg) | Frost `cards.webp` / CARDS_ATLAS 2 | `full\frost-oleg__cold_snap__CARDS_ATLAS__2.jpg` / `text\frost-oleg__cold_snap__CARDS_ATLAS__2__text.jpg` | `domain/abilities-frost.ts:126`；`passive`，当前实现为 3 格内建筑生命 +1 光环 | `locked-规则原文已锁` | B8 已锁：见 `b8-p3-p4-static-summon-and-death-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |
| P4 | `fire_sacrifice_summon` | 伊路特-巴尔(necro-elut-bar) | Necromancer `cards.webp` / NECROMANCER_CARDS_ATLAS 0 | `full\necro-elut-bar__fire_sacrifice_summon__NECROMANCER_CARDS_ATLAS__0.jpg` / `text\necro-elut-bar__fire_sacrifice_summon__NECROMANCER_CARDS_ATLAS__0__text.jpg` | `domain/abilities.ts:389`；`onSummon`，当前定义为空效果，由召唤命令处理占位/献祭流程 | `locked-规则原文已锁` | B8 已锁：见 `b8-p3-p4-static-summon-and-death-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |
| P4 | `life_up` | 雌狮(barbaric-lioness) | Barbaric `cards.webp` / CARDS_ATLAS 7 | `full\barbaric-lioness__intimidate,life_up__CARDS_ATLAS__7.jpg` / `text\barbaric-lioness__intimidate,life_up__CARDS_ATLAS__7__text.jpg` | `domain/abilities-barbaric.ts:272`；`passive`，当前实现为按自身充能增加生命，最多 +5 | `locked-规则原文已锁` | B6 已锁：见 `b6-p3-p4-charge-and-stat-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |
| P4 | `living_gate` | 寒冰魔像(frost-ice-golem) | Frost `cards.webp` / CARDS_ATLAS 6 | 同 `slow` | `domain/abilities-frost.ts:322`；`passive`，当前定义为空效果 | `locked-规则原文已锁` | B8 已锁：见 `b8-p3-p4-static-summon-and-death-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |
| P4 | `mobile_structure` | 寒冰魔像(frost-ice-golem) | Frost `cards.webp` / CARDS_ATLAS 6 | 同 `slow` | `domain/abilities-frost.ts:331`；`passive`，当前定义为空效果，但移动/建筑判定 helper 会读取该能力 | `locked-规则原文已锁` | B8 已锁：见 `b8-p3-p4-static-summon-and-death-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |
| P4 | `power_up` | 蒙威尊者(barbaric-moka) | Barbaric `cards.webp` / CARDS_ATLAS 3 | `full\barbaric-moka__power_up,trample__CARDS_ATLAS__3.jpg` / `text\barbaric-moka__power_up,trample__CARDS_ATLAS__3__text.jpg` | `domain/abilities-barbaric.ts:88`；`onDamageCalculation`，当前实现为按自身充能增加攻击，最多 +5 | `locked-规则原文已锁` | B6 已锁：见 `b6-p3-p4-charge-and-stat-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |
| P4 | `rage` | 古尔-达斯(necro-gul-das) | Necromancer `cards.webp` / NECROMANCER_CARDS_ATLAS 10 | `full\necro-gul-das__rage__NECROMANCER_CARDS_ATLAS__10.jpg` / `text\necro-gul-das__rage__NECROMANCER_CARDS_ATLAS__10__text.jpg` | `domain/abilities.ts:481`；`onDamageCalculation`，当前实现为按自身伤害增加攻击 | `locked-规则原文已锁` | B6 已锁：见 `b6-p3-p4-charge-and-stat-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |
| P4 | `soulless` | 亡灵疫病体(necro-plague-zombie) | Necromancer `cards.webp` / NECROMANCER_CARDS_ATLAS 8 | `full\necro-plague-zombie__infection,soulless__NECROMANCER_CARDS_ATLAS__8.jpg` / `text\necro-plague-zombie__infection,soulless__NECROMANCER_CARDS_ATLAS__8__text.jpg` | `domain/abilities.ts:556`；`onKill`，当前实现为阻止拥有者获得魔法 | `locked-规则原文已锁` | B8 已锁：见 `b8-p3-p4-static-summon-and-death-rule-text-lock-matrix-2026-07-02.md`；下一步实现对照，不重读图片/OCR |

## 入口补齐后的分流结论

- 21 个 P3/P4 对象已经不再停留在“只在总队列有名字”的状态：承载卡、主图源、裁图路径和实现入口均已登记。
- B6 七个充能/数值对象、B7 七个移动/相邻对象、B8 六个静态/召唤/死亡对象已转为 `locked-规则原文已锁`；`entangle` 保持 `disputed-对象归属待裁定`。
- `fire_sacrifice_summon`、`living_gate`、`mobile_structure` 已出现“定义为空或由外部 helper/命令消费”的迹象，下一步不能按低风险静态被动直接放过，应优先升级成 P3/P2 候选合同复核。
- 充能/数值共享家族已明确：`blood_rage`、`blood_rage_decay`、`power_boost`、`power_up`、`life_up`、`gather_power` 后续需要统一审“谁写入充能、谁读取充能、谁清理充能、是否有上限和回放重复”。

## 下一步

1. P3 先按“最终状态 + 清理/持续时间 + 负向断言”补合同，不直接修机制。
2. P4 先做轻量合同；只要发现它不是纯静态/被动，立即升级。
3. 任一对象合同转为 `locked`、`blocked` 或 `disputed`，必须回写正式 evidence。
