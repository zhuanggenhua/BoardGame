# 召唤师战争实现对照第一批发现（2026-07-02）

## 目的

- 承接 `implementation-audit-first-pass-index-2026-07-02.md`，开始读取真实消费者链。
- 本文件只记录实现对照发现，不改机制代码、不写规则断言测试。
- 结论分为“已找到消费者链”“已有覆盖”“高风险差异”“待补负向断言”，不把任一项直接包装成已修复。

## 当前合同状态

- 68 个风险对象：4 个 `locked-L4已补`，62 个 `locked-规则原文已锁`，2 个 `disputed-对象归属待裁定`。
- `ferocity` 与 `entangle` 仍先裁定对象归属，未裁定前不写规则断言测试、不改机制代码。

## 第一批实现对照发现

| 对象 | 类型 | 证据入口 | 发现 |
| --- | --- | --- | --- |
| `cold_snap` | 实现入口 | `abilityResolver.ts:getEffectiveLife` | mobile_structure 单位在 getEffectiveLife 中读取 auraStructureLife；当前按 dist <= effect.range 结算，effect.range 来自 cold_snap 定义。 |
| `cold_snap` | 高风险差异 | `abilities-frost.ts + abilityResolver.ts` | 官方合同无范围文字；当前定义存在 range: 3，并由 getEffectiveLife 按距离过滤。 |
| `cold_snap` | 旧测试冲突 | `entity-chain-integrity.test.ts` | 已有测试断言超出 3 格不生效，这与已锁官方原文“友方建筑 +1 生命”存在潜在冲突。 |
| `fire_sacrifice_summon` | 消费者链已找到 | `validate.ts/execute.ts` | validate/execute 已显式识别 fire_sacrifice_summon |
| `fire_sacrifice_summon` | 消费者链已找到 | `validate.ts/execute.ts` | SUMMON_UNIT payload 使用 sacrificeUnitId 选择牺牲品 |
| `fire_sacrifice_summon` | 消费者链已找到 | `validate.ts/execute.ts` | execute 将召唤位置替换为牺牲品位置 |
| `fire_sacrifice_summon` | 消费者链已找到 | `validate.ts/execute.ts` | validate 拒绝缺少牺牲品的召唤 |
| `fire_sacrifice_summon` | 已补覆盖 | `abilities-necromancer-execute.test.ts` | 已覆盖任意位置友方单位可作为牺牲品、缺少牺牲品拒绝、牺牲召唤师拒绝。 |
| `fire_sacrifice_summon` | 已补负向断言 | `abilities-necromancer-execute.test.ts` | 新增找不到牺牲品拒绝、牺牲敌方单位拒绝；实现无需修改。 |
| `living_gate` | 消费者链已找到 | `helpers.ts:getValidSummonPositions` | 活体传送门单位会加入可召唤位置来源。 |
| `living_gate` | 已补负向断言 | `abilities-frost.test.ts` | 已覆盖己方活体传送门提供召唤位置、敌方活体传送门不提供己方召唤位置；实现无需修改。 |
| `mobile_structure` | 消费者链已找到 | `execute.ts:postprocess` | mobile_structure 正常移动事件被纳入结构移动事件，用于寒冰冲撞等结构移动后续结算。 |
| `mobile_structure` | 消费者链已找到 | `validate.ts` | 移动/建筑相关校验读取 mobile_structure 能力。 |
| `mobile_structure` | 已补边界断言 | `abilities-frost.test.ts` | 已覆盖活体结构仍可按单位移动，不按普通建筑禁止移动；实现无需修改。 |
| `sacrifice` | 目标解析入口 | `abilityTargets.ts` | adjacentEnemies 通过 sourcePosition 当前相邻格解析目标。 |
| `sacrifice` | 触发链入口 | `execute/helpers.ts:emitDestroyWithTriggers` | onDeath 上下文传入 victim 原 position，可用于解析死亡前位置相邻敌人。 |
| `sacrifice` | 已有覆盖 | `entity-chain-integrity.test.ts` | 已有 onDeath/sacrifice 流程测试，但还需核对是否覆盖“曾相邻”集合与死亡后清格顺序。 |
| `sacrifice` | 已补边界断言 | `entity-chain-integrity.test.ts` | 已覆盖只伤害死亡前相邻敌方，不伤害相邻友方或非相邻敌方；实现无需修改。 |
| `blood_rage` | 消费者链已找到 | `execute/helpers.ts:emitDestroyWithTriggers` | onUnitDestroyed 只遍历 opts.playerId 当前玩家；注释写明规则为“在你的回合中”。 |
| `blood_rage` | 实现分层说明 | `abilities.ts + execute/helpers.ts` | AbilityDef 自身是 always，但全局触发器按当前回合玩家限制；不能只看 AbilityDef 判错。 |
| `blood_rage` | 已有覆盖 | `entity-chain-integrity.test.ts` | 已有本方回合单位被消灭时充能测试；仍缺对手回合不充能负向断言。 |
| `rebound` | 已有覆盖 | `entity-chain-integrity.test.ts` | 已有普通移动离开相邻触发 1 点伤害测试；仍需核对 forced away 覆盖。 |
| `evasion` | 已有覆盖 | `entity-chain-integrity.test.ts` | 已有相邻敌人攻击且特殊骰面时产生减伤事件测试；仍需核对攻击任意卡、减伤作用对象和最小伤害边界。 |
| `rebound` | 已补覆盖 | `abilities-trickster.test.ts + abilities-trickster-execute.test.ts` | 已覆盖普通移动离开、未远离不触发、多个缠斗单位叠加、推拉强制离开后在新位置受伤；实现无需修改。 |
| `evasion` | 已补边界断言 | `abilities-trickster.test.ts` | 已覆盖相邻敌人攻击单位和建筑时掷出特殊面均减伤、无特殊面不触发、不相邻不触发、幻化复制后仍生效；实现无需修改。 |

## 初步分流

- `cold_snap` 已完成最小修复并通过目标测试：官方合同未写范围，本地实现和旧测试固定 3 格范围；已移除范围限制，目标测试 `--testNamePattern "cold_snap"` 通过。
- `blood_rage` 已补负向断言并通过目标测试：真实消费者链按当前回合玩家遍历，验证了对手回合单位死亡不会给非当前玩家血腥狂怒单位充能。
- `fire_sacrifice_summon` 已完成第一轮实现对照补证并通过目标测试：命令链覆盖必须选择友方非召唤师牺牲品、牺牲品位置无限制、召唤替换到牺牲品位置；本轮只补负向断言，未改机制实现。
- `living_gate`、`mobile_structure` 已完成第一轮实现对照补证并通过目标测试：己方活体传送门提供召唤位置，敌方活体传送门不提供己方召唤位置，活体结构仍可移动；本轮只补断言，未改机制实现。
- `sacrifice` 已完成第一轮实现对照补证并通过目标测试：onDeath 使用死亡前位置解析相邻敌方，只伤害相邻敌方，不伤害友方或非相邻敌方；本轮只补断言，未改机制实现。
- `rebound` 已完成第一轮实现对照补证并通过目标测试：普通移动和强制推拉离开均触发，靠近/未远离不触发，多名缠斗单位可叠加；本轮未改机制实现。
- `evasion` 已完成第一轮实现对照补证并通过目标测试：相邻敌人攻击任意卡牌（单位或建筑）且掷出特殊面时减伤，无特殊面或攻击者不相邻时不触发；本轮只补断言，未改机制实现。

## 下一步

1. 第一批实现对照对象已全部完成首轮分流/补证；下一步应从总矩阵继续挑选下一个 locked 对象批次，两个 disputed（`ferocity`、`entangle`）仍先裁定对象归属。

## 验证记录

- `cold_snap` 目标测试通过：`npx vitest run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --testNamePattern "cold_snap"`。
- 一次错误命令 `npm test -- --run ...` 触发全量测试并超时，不作为目标验证结果。

- `blood_rage` 目标测试通过：`npx vitest run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --testNamePattern "blood_rage"`。

- `fire_sacrifice_summon` 目标测试通过：`npx vitest run src/games/summonerwars/__tests__/abilities-necromancer-execute.test.ts --testNamePattern "火祭召唤|fire_sacrifice_summon"`。
- 结果：1 个测试文件通过，6 个火祭召唤相关测试通过，11 个非目标测试跳过。
- `fire_sacrifice_summon` 所在测试文件 ESLint 结果：0 errors，3 个既有 unused warnings；本轮新增断言未引入 lint error。

- `living_gate` / `mobile_structure` 目标测试通过：`npx vitest run src/games/summonerwars/__tests__/abilities-frost.test.ts --testNamePattern "活体传送门|活体结构|living_gate|mobile_structure"`。
- 结果：1 个测试文件通过，8 个目标测试通过，29 个非目标测试跳过。
- `living_gate` / `mobile_structure` 所在测试文件 ESLint 结果：0 errors，2 个既有 unused warnings；本轮新增断言未引入 lint error。

- `sacrifice` 目标测试通过：`npx vitest run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts --testNamePattern "sacrifice|献祭"`。
- 结果：1 个测试文件通过，4 个目标测试通过，88 个非目标测试跳过。
- `sacrifice` 所在测试文件 ESLint 结果：0 errors，0 warnings；本轮新增断言未引入 lint 问题。

- `rebound` / `evasion` 目标测试通过：`npx vitest run src/games/summonerwars/__tests__/abilities-trickster.test.ts --testNamePattern "迷魂|缠斗|evasion|rebound"`。
- 结果：1 个测试文件通过，10 个目标测试通过，33 个非目标测试跳过。
- `rebound` / `evasion` 所在测试文件 ESLint 结果：0 errors，0 warnings；本轮新增断言未引入 lint 问题。
