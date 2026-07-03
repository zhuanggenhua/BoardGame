# 召唤师战争 B6 P3/P4 充能与数值实现对照（2026-07-02）

## 目的

- 承接 `b6-p3-p4-charge-and-stat-rule-text-lock-matrix-2026-07-02.md` 中 7 个已 `locked` 对象。
- 本文件只消费已锁官方合同，不重新读图、不重新 OCR、不重新录入。
- 若后续发现合同缺字段、来源冲突或对象归属不清，先回写为 `blocked` / `disputed`，再回录入层补合同。

## 实现对照矩阵

| 对象 | 中文对象 | 已锁合同摘要 | 实现入口 | 证明/测试入口 | 对照结论 | 后续边界 |
| --- | --- | --- | --- | --- | --- | --- |
| `blood_rage` | 亡灵战士「血腥狂怒」充能子句 | 你的回合每有一个单位被消灭时，给本单位 +1 充能；不是任意玩家回合触发 | `abilities.ts` 定义 `onUnitDestroyed` + `addCharge self 1`；`triggerAllUnitsAbilities('onUnitDestroyed', core, currentPlayer)` 只扫描当前玩家单位；UI 充能反馈通过 `shouldConsumeChargeEvent` 按事件 id 去重 | `entity-chain-integrity.test.ts` 覆盖当前玩家回合击杀触发、对手回合不为非当前玩家触发、自身被消灭不触发；`abilities-necromancer-execute.test.ts` 覆盖真实攻击击杀后只产生 1 次 `blood_rage` 充能且最终 boosts=1；`useGameEvents.test.ts` 覆盖事件流回放时同一充能事件不重复消费 | `match-with-L4-proof` | 已补真实攻击入口与事件流回放去重边界；未改机制 |
| `blood_rage_decay` | 亡灵战士「血腥狂怒」回合末清理子句 | 你的回合结束时移除本单位 2 充能；无充能不触发；1 充能时由 reducer 夹到 0 | `abilities.ts` 定义 `onTurnEnd` + `hasCharge >= 1` + `removeCharge self 2`；`flowHooks.ts` 在抽牌阶段结束触发当前玩家 `onTurnEnd`；`ADVANCE_PHASE` 从 draw 退出时进入真实回合末清理入口 | `entity-chain-integrity.test.ts` 覆盖 3 充能触发 `delta=-2`、0 充能不触发、1 充能触发且由 reducer clamp 到 0；`interaction-chain-comprehensive.test.ts` 覆盖真实 draw 阶段退出时 3/1/0 充能单位分别清理到 1/0/0，且只为有充能单位发衰减事件 | `match-with-L4-proof` | 已补真实抽牌阶段结束入口；未改机制 |
| `gather_power` | 祖灵法师「聚能」 | 本单位被召唤后，本单位 +1 充能；不是任意友方单位 | `execute.ts` 在 `SUMMON_UNIT` 后检查被召唤卡是否含 `gather_power`，向召唤位置发 `UNIT_CHARGED delta=1` | `abilities-barbaric.test.ts` 覆盖祖灵法师召唤后 boosts=1、非 `gather_power` 单位召唤后不充能；`entity-chain-integrity.test.ts` 覆盖事件级正负路径；新增 `[gather_power/living_gate/L4]` 覆盖通过己方活体传送门召唤祖灵法师后只在被召唤位置产生 1 次聚能充能，敌方活体传送门不提供己方召唤位 | `match-with-L4-proof` | 已补特殊召唤入口未绕过 `SUMMON_UNIT` 后续充能；不改机制 |
| `power_boost` | 布拉夫 / 亡灵战士「力量强化」 | 每 1 充能 +1 战力，最大 +5；需分别核对布拉夫与亡灵战士承载 | `abilities.ts` `modifyStrength attr=charge maxBonus=5`；`calculateEffectiveStrength` 对 `modifyStrength` 统一执行 `maxBonus` 上限，并在 breakdown 中记录 `source='power_boost'` | `abilities-goblin.test.ts` 覆盖布拉夫 0/3/8 充能下战力与 +5 上限；`abilities-necromancer-execute.test.ts` 新增亡灵战士 0/3/8 充能断言，确认基础 2、+3、+5 上限与 `power_boost` 来源拆解 | `match-with-L4-proof` | 已补亡灵战士专属数值读取与上限拆解；未改机制 |
| `power_up` | 蒙威尊者「力量强化」 | 每 1 充能 +1 战力，最大 +5 | `abilities-barbaric.ts` `modifyStrength attr=charge maxBonus=5`；`calculateEffectiveStrength` 执行充能读取和上限，并在 breakdown 中记录 `source='power_up'` | `abilities-barbaric.test.ts` 覆盖 0/3/8 充能；`interaction-flow-e2e.test.ts` 覆盖祖灵交流转移充能后攻击战力提升；新增 `[power_up/L4]` 覆盖蒙威尊者 0/3/8 充能下最终战力 1/4/6，并在 breakdown 中以 `power_up` 来源记录 +3 / +5 上限 | `match-with-L4-proof` | 已补蒙威尊者专属数值读取与上限拆解；未改机制 |
| `life_up` | 雌狮「生命强化」 | 每 1 充能 +1 生命，最大 +5；需核对伤害/死亡重算边界 | `abilities-barbaric.ts` `modifyLife attr=charge maxBonus=5`；`getEffectiveLife` / `getEffectiveLifeBase` 执行充能读取和上限；死亡判定通过有效生命计算 | `abilities-barbaric.test.ts` 覆盖 0/2/7 充能、+5 上限、伤害不足时存活、伤害达到有效生命时死亡、reducer 伤害链考虑 life_up；本轮新增 `getEffectiveLife` 当前状态动态读取断言，确认 2 充能、7 充能上限和充能归零时都会即时重算 | `match-with-L4-proof` | 已完成静态数值读取代表链中有效生命动态读取补证；未改机制 |
| `rage` | 古尔-达斯「暴怒」 | 每 1 伤害 +1 战力 | `abilities.ts` `modifyStrength attr=damage`；`calculateEffectiveStrength` 从本单位当前 damage 读取加成，并在 breakdown 中记录 `source='rage'` | `entity-chain-integrity.test.ts` 覆盖 2 伤害时攻击骰数为基础 2 + 伤害 2，0 伤害时保持基础战力；新增 `[onDamageCalculation/rage/L4]` 覆盖古尔-达斯 0/3 伤害下最终战力 2/5，并在 breakdown 中以 `rage` 来源记录 +3 | `match-with-L4-proof` | 已补古尔-达斯专属数值读取与来源拆解；未改机制 |

## 验证

- 首轮命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts src/games/summonerwars/__tests__/abilities-barbaric.test.ts src/games/summonerwars/__tests__/abilities-goblin.test.ts src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts --configLoader native -t "rage|blood_rage|blood_rage_decay|gather_power|power_boost|power_up|life_up|暴怒|血腥狂怒|聚能|力量强化|生命强化"`
- 首轮结果：4 个测试文件通过；28 passed / 196 skipped。
- L4 追加命令：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --configLoader native -t "radiant_shot|frost_bolt|greater_frost_bolt|fortress_elite|life_up|静态数值|辉光射击|寒冰箭|高阶寒冰箭|城塞精英|生命强化"`
- L4 追加结果：1 个测试文件通过；9 passed / 90 skipped。
- L4 追加命令：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --configLoader native -t "gather_power|living_gate|聚能|活体传送门"`
- L4 追加结果：1 个测试文件通过；3 passed / 100 skipped。
- L4 追加命令：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts src/games/summonerwars/__tests__/useGameEvents.test.ts --configLoader native -t "blood_rage|血腥狂怒|shouldConsumeChargeEvent"`
- L4 追加结果：2 个测试文件通过；4 passed / 52 skipped。
- L4 追加命令：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native -t "blood_rage_decay|血腥狂怒"`
- L4 追加结果：1 个测试文件通过；1 passed / 134 skipped。
- L4 追加命令：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts --configLoader native -t "power_boost|力量强化|亡灵战士"`
- L4 追加结果：1 个测试文件通过；3 passed / 21 skipped。
- L4 追加命令：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-barbaric.test.ts --configLoader native -t "power_up|力量强化|蒙威尊者"`
- L4 追加结果：1 个测试文件通过；5 passed / 55 skipped。
- L4 追加命令：`NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --configLoader native -t "onDamageCalculation/rage|暴怒"`
- L4 追加结果：1 个测试文件通过；2 passed / 103 skipped。

## 分流结论

- B6 7 个已锁对象首轮均已完成实现对照；其中 `blood_rage` 已追加真实攻击入口与事件流回放去重补证，`blood_rage_decay` 已追加真实抽牌阶段结束清理入口补证，`power_boost` 已追加亡灵战士专属数值读取与上限拆解补证，`power_up` 已追加蒙威尊者专属数值读取与上限拆解补证，`rage` 已追加古尔-达斯专属数值读取与来源拆解补证，`life_up` 已追加 L4 动态读取补证，`gather_power` 已追加活体传送门特殊召唤入口补证，均升级为 `match-with-L4-proof`。
- 本轮没有发现“已锁官方合同 vs 当前实现链路”的明确冲突，因此没有修改机制实现。
- 下一步继续从后续 `locked` 批次进入实现对照；不得把 B6 收口倒退成重新读图/OCR。
