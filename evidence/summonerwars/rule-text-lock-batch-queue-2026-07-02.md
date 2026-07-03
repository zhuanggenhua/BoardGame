# 召唤师战争逐字规则锁定批次队列（2026-07-02）

## 目的

- 承接“所有漏审都全面补审”：P1/P2/P3/P4 的入口合同已补齐，下一步不再重复建入口。
- 本文件把后续工作转入逐字规则锁定批次：完整单卡 + 文字区裁图 + 官方/权威原文，逐对象锁原子子句。
- 本文件按对象状态滚动更新：已锁对象进入实现对照；锁不住的对象继续登记缺口。

## 当前入口合同基线

| 范围 | 对象数 | 当前状态 | 后续动作 |
| --- | ---: | --- | --- |
| P1 | 7 | `locked-规则原文已锁` | 不再重读图/OCR；继续实现对照、真实入口补证和 L3/L4 缺口登记 |
| P2 | 36 | B3 12 个 + B4 5 个 + B5 18 个已锁对象 + `ferocity` disputed | locked 对象进入实现对照；`ferocity` 在 C85 后降回 `disputed-待本地卡图合同裁定` |
| P3 | 13 | 12 个已锁/已裁定对象 + `entangle` disputed | locked 对象进入实现对照；`entangle` 在 C85 后降回 `disputed-待本地卡图合同裁定` |
| P4 | 8 | 8 个 `locked-规则原文已锁` | locked 对象进入实现对照；fire_sacrifice_summon/living_gate/mobile_structure 不得按空 effects 直接放过 |

## 批次队列

| 批次 | 范围 | 对象 | 处理门禁 |
| --- | --- | --- | --- |
| B1-P1-攻击后与额外攻击 | P1 | `rapid_fire`、`withdraw`、`high_telekinesis`、`mind_transmission`、`telekinesis` | 已锁官方英文原文和原子子句，见 `evidence/summonerwars/b1-p1-rule-text-lock-matrix-2026-07-02.md`；下一步进入实现对照，冲突对象先转 disputed。 |
| B2-P1-充能准备 | P1 | `prepare`、`inspire` | 已锁官方英文原文和原子子句，见 `evidence/summonerwars/b2-p1-rule-text-lock-matrix-2026-07-02.md`；下一步进入实现对照，冲突对象先转 disputed。 |
| B3-P2-目标交互与每回合次数 | P2 | `feed_beast`、`revive_undead`、`spirit_bond`、`vanish`、`ancestral_bond`、`blood_rune`、`frost_axe`、`grab`、`healing`、`holy_arrow`、`illusion`、`structure_shift` | 已锁官方英文原文和原子子句，见 `evidence/summonerwars/b3-p2-rule-text-lock-matrix-2026-07-02.md`；下一步进入实现对照，冲突对象先转 disputed。 |
| B4-P2-攻击窗口与召唤转移 | P2 | `infection`、`life_drain`、`soul_transfer`、`high_telekinesis_instead`、`telekinesis_instead` | 已锁官方英文原文和原子子句，见 `evidence/summonerwars/b4-p2-rule-text-lock-matrix-2026-07-02.md`；下一步进入实现对照，冲突对象先转 disputed。 |
| B5-P2-custom与continuation | P2 | `aerial_strike`、`charge`、`divine_shield`、`ferocity`、`fortress_elite`、`frost_bolt`、`greater_frost_bolt`、`guardian`、`guidance`、`ice_ram`、`ice_shards`、`immobile`、`magic_addiction`、`mind_capture`、`mind_capture_resolve`、`radiant_shot`、`ranged`、`speed_up`、`stable` | 18 个对象已锁，见 `evidence/summonerwars/b5-p2-rule-text-lock-matrix-2026-07-02.md`；`ferocity` 在 C85 后降回 disputed，必须回本地卡图合同层裁定。 |
| B6-P3-充能与数值共享链 | P3/P4 | `blood_rage`、`blood_rage_decay`、`gather_power`、`power_boost`、`power_up`、`life_up`、`rage` | 已锁 7 个官方英文原文和原子子句，见 `evidence/summonerwars/b6-p3-p4-charge-and-stat-rule-text-lock-matrix-2026-07-02.md`；下一步进入实现对照。 |
| B7-P3-移动穿越与相邻离开 | P3 | `climb`、`entangle`、`evasion`、`flying`、`rebound`、`slow`、`swift`、`trample` | 7 个对象已锁，见 `evidence/summonerwars/b7-p3-movement-and-adjacency-rule-text-lock-matrix-2026-07-02.md`；`entangle` 在 C85 后降回 disputed，必须回本地卡图合同层裁定。 |
| B8-P4-低风险疑似升级 | P4/P3 | `cold_snap`、`fire_sacrifice_summon`、`living_gate`、`mobile_structure`、`soulless`、`sacrifice` | 已锁 6 个官方英文原文和原子子句，见 `evidence/summonerwars/b8-p3-p4-static-summon-and-death-rule-text-lock-matrix-2026-07-02.md`；下一步进入实现对照。 |

## 单对象锁定模板

| 对象 | 合同入口状态 | 主真相源 | 完整单卡裁图 | 文字区裁图 | 逐字原文 | 原子子句 | 状态变更 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `<abilityId>` | `blocked-入口已补` 或 `待建合同-入口已补` | 本地图集/官方原文 | `temp/.../full/...jpg` | `temp/.../text/...jpg` | 待锁/已锁 | 时机、目标、次数、成本、效果、可选性、负向场景 | 保持 blocked / 转 locked / 转 disputed |

## 继续门禁

- `blocked-入口已补` 不等于 `locked`：不能写规则断言测试，不能改机制代码。
- `locked-规则原文已锁` 才能进入实现对照；实现对照发现合同缺字段、来源冲突或对象归属错误时，先回写为 `blocked` 或 `disputed`，补齐录入合同后再继续。
- 逐字原文锁定必须优先使用完整单卡；文字区裁图只能辅助读字。
- 同一卡多能力必须作为共享合同处理，不能只锁其中一个能力就外推整张卡。
- 每次对象状态变化必须回写主 evidence 和总矩阵。
- 看不清或来源冲突时保持缺口，不得用实现摘要、i18n、旧测试、OCR 倒推规则。

## B6 P3/P4 充能与数值共享链（已锁）

| 对象 | 批次状态 | 真相源 | 结果 | 下一步 |
| --- | --- | --- | --- | --- |
| `blood_rage` | locked | 官方 `Blood Fury|TEXT` | 已锁“你的回合内单位被消灭则充能；你的回合结束移除 2 充能” | 实现对照 |
| `blood_rage_decay` | locked | 官方 `Blood Fury|TEXT` | 已锁回合末清理子句；与 `blood_rage` 共享合同 | 实现对照 |
| `gather_power` | locked | 官方 `Charged|TEXT` | 已锁召唤本单位后充能 | 实现对照 |
| `power_boost` | locked | 官方 `Imbued Strength|TEXT` | 已锁每点充能 +1 战力，最多 +5 | 实现对照 |
| `power_up` | locked | 官方 `Imbued Strength|TEXT` | 已锁每点充能 +1 战力，最多 +5 | 实现对照 |
| `life_up` | locked | 官方 `Imbued Life|TEXT` | 已锁每点充能 +1 生命，最多 +5 | 实现对照 |
| `rage` | locked | 官方 `Wrath|TEXT` | 已锁每点伤害 +1 战力 | 实现对照 |

## 下一批 B7/B8

- B7 优先处理移动/穿越/离开相邻链：`climb`、`entangle`、`evasion`、`flying`、`rebound`、`slow`、`swift`、`trample`。
- B8 处理低风险但可能升级对象：`cold_snap`、`fire_sacrifice_summon`、`living_gate`、`mobile_structure`、`soulless`、`sacrifice`。
- `ferocity` 在 C85 后撤销已裁定口径：官方在线文本包只保留为候选线索，必须回本地卡图合同层裁定。

## B7 P3 移动穿越与相邻离开（已锁/争议分流）

| 对象 | 批次状态 | 真相源 | 结果 | 下一步 |
| --- | --- | --- | --- | --- |
| `climb` | locked | 官方 `Climb|TEXT` | 已锁移动时可额外 1 格并穿越建筑 | 实现对照 |
| `evasion` | locked | 官方 `Stupefy|TEXT` | 已锁相邻敌人攻击任意卡且掷出 [s] 时少加 1 伤害 | 实现对照 |
| `flying` | locked | 官方 `Flight|TEXT` | 已锁移动时可额外 1 格并穿越 cards | 实现对照 |
| `rebound` | locked | 官方 `Engage|TEXT` | 已锁相邻敌方单位移动或被强制离开本单位时加 1 伤害 | 实现对照 |
| `slow` | locked | 官方 `Slow|TEXT` | 已锁本单位少移动 1 格 | 实现对照 |
| `swift` | locked | 官方 `Swift|TEXT` | 已锁移动时可额外 1 格 | 实现对照 |
| `trample` | locked | 官方 `Trample|TEXT` | 已锁可穿越 commons，移动后对穿越过的每个 common 加 1 伤害 | 实现对照 |
| `entangle` | disputed-待本地卡图合同裁定 | 官方在线文本包只作候选线索，不能在审计阶段裁定城塞骑士是否承载 | 当前配置改动只算待裁定候选改动 | 回到数据录入合同层裁定对象归属 |

## B8 P3/P4 静态、召唤与死亡（已锁）

| 对象 | 批次状态 | 真相源 | 结果 | 下一步 |
| --- | --- | --- | --- | --- |
| `sacrifice` | locked | 官方 `Immolate|TEXT` | 已锁本单位被摧毁后，对每个曾相邻的敌方单位加 1 伤害 | 实现对照 |
| `cold_snap` | locked | 官方 `Cold Snap|TEXT` | 已锁友方建筑 +1 生命；官方原文无范围限制 | 实现对照 |
| `fire_sacrifice_summon` | locked | 官方 `Summoned by Fire|TEXT` | 已锁召唤支付时必须摧毁友方单位，并用本单位替换其位置 | 实现对照 |
| `living_gate` | locked | 官方 `Living Gate|TEXT` | 已锁本卡是传送门 | 实现对照 |
| `mobile_structure` | locked | 官方 `Mobile Structure|TEXT` | 已锁本卡可以移动 | 实现对照 |
| `soulless` | locked | 官方 `Soulless|TEXT` | 已锁本单位摧毁敌方单位时不获得魔法 | 实现对照 |

## 数据录入合同阶段收口

- 68 个风险对象当前入口合同分流按 C85 修正为：4 个 `locked-L4已补`，62 个 `locked/归属已裁定`，2 个 `disputed-待本地卡图合同裁定`，0 个 `待建合同-入口已补`。
- `ferocity`、`entangle` 的在线文本包归属裁定已撤销；相关配置/测试改动只能视为待裁定候选，不能汇报为已证实修复。
- 下一阶段是实现对照，不再把 locked 对象倒回图片/OCR 或实现文案录入层。
