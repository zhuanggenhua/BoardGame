# DiceThrone 新派系 Treant / Ninja 全量重审与抽查循环（2026-05-15）

## 范围与完成定义

本轮目标不是新增功能，而是按补强后的审计规范重审两个新英雄：

- `treant` / 树精
- `ninja` / 忍者

完成定义：

1. 两个新英雄的技能、Token/状态、专属卡进入完整流程矩阵。
2. 旧“可触发 / 代表路径通过 / 当前发布口径已收口”结论被降级或修正。
3. 抽查若干全链路对象：真相源、静态定义、入口、命令、消耗、主效果、分支/否定、后续清理。
4. 发现实现错误时修实现，发现审计规范缺口时补规范，再按新规范回到矩阵重审。

## 本轮循环结果

### 循环 1：防御技能同类扩审

触发原因：上一轮 Ninja `blink` 曾因 `rollDie` effect 使用错误 timing 导致防御无效果。按新规范“同类已修 bug 必须扩审兄弟对象”，本轮扩查 Treant `rooted`。

发现：

- `src/games/dicethrone/heroes/treant/abilities.ts` 中 `rooted` 的 `rollDie` effect 仍是 `timing: 'immediate'`。
- 防御 resolver `resolveDefenseEffects` 只消费 `withDamage` / `postDamage`，因此 `rooted` 静态存在但真实防御结算不会执行。

修复：

- `rooted` effect timing 改为 `withDamage`。
- 新增 `src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts`：
  - 可防御时 Rooted 掷 3 骰，按 1/4/6 产生反击、幼种树灵、生命源泉。
  - 不可防御时 Rooted 不执行。
- 新增 E2E：`树精扎根防御应真实掷骰结算且不可防御时跳过`。

规范补强：

- `docs/ai-rules/testing-audit.md` 新增“同类已修 bug 必须扩审兄弟对象”。
- `docs/ai-rules/testing-audit.md` 新增“多次随机/多骰 E2E 必须使用序列策略”。

### 循环 1 复审结论

Rooted 已从 L1 静态定义升级到 L2/L3：

- L2：Vitest 权威状态证明。
- L3：真实在线对局 E2E 阶段推进截图链。
- 否定路径：`isDefendable=false` 时 Rooted 不执行。

## Treant 完整流程矩阵

| 对象 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
|---|---|---|---|---|---|---|---|---|---|---|
| `shattering-fist` | 3/4/5 树枝伤害 | variants 5/6/7 | 通用骰面候选 | 通用 ability activate | N/A | damage | 无 | 通用攻击流程 | L1 | 仅静态矩阵 |
| `shattering-fist-2` | 升级伤害 | variants 6/7/8 | 升级后候选 | 通用 ability activate | 升级卡替换 | damage | 无 | 通用攻击流程 | L1 | 仅静态矩阵 |
| `shattering-fist-3` | 升级施加刺藤 + 伤害 | grant thorn + damage 6/7/8 | 升级后候选 | 通用 ability activate | 升级卡替换 | thorn + damage | 刺藤后续代表覆盖 | 通用攻击流程 | L1/L2 | 缺逐技能 L3 |
| `tend-care` | 抽牌、树灵、生命源泉、刺藤 | draw + seedling + lifeSap + thorn | 通用候选 | 通用 ability activate | N/A | 多效果 | token 后续代表覆盖 | 通用流程 | L1/L2 | 缺技能本体 L3 |
| `tend-care-2` | 额外木苗树灵 | draw + seedling + sapling + lifeSap + thorn | 升级后候选 | 通用 ability activate | 升级卡替换 | 多效果 | 木苗后续覆盖 | 通用流程 | L1/L2 | 缺技能本体 L3 |
| `vengeful-vines` | 小顺子，刺藤 + 7 伤害 | smallStraight + thorn + damage | 通用候选 | 通用 ability activate | N/A | thorn + damage | 刺藤后续覆盖 | 通用攻击流程 | L1/L2 | 缺技能本体 L3 |
| `vengeful-vines-2` | 刺藤 + 8 伤害 | smallStraight + thorn + damage 8 | 升级后候选 | 通用 ability activate | 升级卡替换 | thorn + damage | 刺藤后续覆盖 | 通用攻击流程 | L1/L2 | 缺技能本体 L3 |
| `nature-touch` | 4 树灵，不可防御伤害 | seedling 2 + unblockable damage 5 | 通用候选 | 通用 ability activate | N/A | token + unblockable damage | 防御跳过代表覆盖 | 通用攻击流程 | L1/L2 | 缺技能本体 L3 |
| `nature-touch-2` | 不可防御伤害 6 | seedling 2 + unblockable damage 6 | 升级后候选 | 通用 ability activate | 升级卡替换 | token + damage | 防御跳过代表覆盖 | 通用攻击流程 | L1/L2 | 缺技能本体 L3 |
| `quiet-cultivation` | 维持阶段养成 | phaseStart upkeep + seedling 1 | 无玩家入口 | flowHooks phaseStart | N/A | seedling +1 | 自动被动，无 skip | 阶段进入后继续 | L1 | 缺 L2/L3 专项 |
| `wild-growth` | 伤害并治疗 | damage 2 + heal 1 | 通用候选 | 通用 ability activate | N/A | damage + heal | 无 | 通用攻击流程 | L1 | 仅静态矩阵 |
| `wild-growth-2` | 伤害 4 + 治疗 | damage 4 + heal 1 | 升级后候选 | 通用 ability activate | 升级卡替换 | damage + heal | 无 | 通用攻击流程 | L1 | 仅静态矩阵 |
| `rooted` | 防御掷 3 骰 | defensiveRoll diceCount 3，withDamage | 防御阶段 | resolveAttack / resolveDefenseEffects | N/A | 反击、seedling、lifeSap | 不可防御跳过 | 防御结算后继续 | L2/L3 | 本轮发现并修复 |
| `rooted-2` | 防御掷 4 骰 | diceCount 4，复用 rooted effects | 升级后防御入口 | resolveAttack / resolveDefenseEffects | 升级卡替换 | 同 rooted，多 1 骰 | 不可防御跳过 | 防御结算后继续 | L1/L2 | 共享 rooted 合同，缺专属 L3 |
| `forest-awakens` | 终极：lifeSap、seedling、thorn、10 伤害 | mask 5，多效果 | 通用候选 | 通用 ability activate | N/A | token + damage | token 后续代表覆盖 | 通用攻击流程 | L1/L2 | 缺终极本体 L3 |

## Treant Token / 被动矩阵

| 对象 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
|---|---|---|---|---|---|---|---|---|---|---|
| `treant_seedling` | 掷骰阶段消耗重掷 | passive rerollDie | 自己掷骰阶段按钮 | `USE_PASSIVE_ABILITY` | token -1 | 指定骰重掷 | 无 token 时隐藏 | selection mode 清理 | L2/L3 | 已覆盖 |
| `treant_sapling` 治疗+CP | 主阶段消耗治疗并 +CP | passive custom | 主阶段按钮 | custom action | token -1 | HP +1，CP +1 | CP 上限 delta 0 | 按钮随 token 隐藏 | L2/L3 | 已覆盖 |
| `treant_sapling` 抽牌 | 主阶段额外 1CP 抽牌 | passive custom | 主阶段按钮 | custom action | token -1，CP -1 | hand +1 | CP 不足由候选/校验限制 | 按钮随 token 隐藏 | L2/L3 | 已覆盖 |
| `treant_divine` 加伤 | 造成伤害前 +3 | activeUse beforeDamageDealt | 攻击方响应窗 | `USE_TOKEN` | token -1 | pendingDamage 与 pendingAttack +3 | 无 token 无入口 | 响应窗收口 | L2/L4 | 已覆盖 |
| `treant_divine` 防负面 | 阻止即将受到负面状态 | flowHooks debuff filter | 无主动入口 | 阶段推进 | token -1 | 过滤 debuff | 仅 incoming debuff 触发 | 阶段继续 | L2/L4 | 已覆盖 |
| `life_sap` | 主阶段掷 1 骰治疗半值向上 | passive custom | 主阶段按钮 | custom action | token -1 | bonus die + heal | 无 token 隐藏 | 特写收口 | L2/L4 | 已覆盖 |
| `thorn` | 进攻掷骰结束按额外投掷受伤 | phaseExit offensiveRoll | 无主动入口 | 阶段推进 | token 清空 | HP - (rollCount - 1) | rollCount=1 应为 0 | 阶段继续 | L2/L4 | 已覆盖正向，0 伤害边界未专项 E2E |

## Treant 专属卡矩阵

| 对象 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
|---|---|---|---|---|---|---|---|---|---|---|
| `treant-card-trample` | 攻击修正 5 骰 | roll action withDamage | roll 阶段手牌候选未逐卡 E2E | 通用打牌 | 1CP | branch +1，spirit thorn | 骰面分支 | 特写收口 | L1/L2 | 缺专属 E2E |
| `upgrade-tend-care-2` | 升级细心呵护 | replaceAbility | main 候选未逐卡 E2E | 通用打牌 | 2CP | replace | 无 | 能力表更新 | L1/L2 | 缺逐卡 E2E |
| `upgrade-rooted-2` | 升级扎根 | replace rooted | main 候选未逐卡 E2E | 通用打牌 | 3CP | replace | 防御共享 Rooted | 能力表更新 | L1/L2 | 缺升级后 L3 |
| `treant-card-drink-deep` | 获得生命源泉 | main grant lifeSap | main 候选未逐卡 E2E | 通用打牌 | 1CP | lifeSap +1 | 上限 | 打牌清理 | L1/L2 | token 后续覆盖，卡本体缺 L3 |
| `upgrade-shattering-fist-3` | 升级破碎之拳 III | replace | main 候选未逐卡 E2E | 通用打牌 | 2CP | replace | 后续 thorn 代表覆盖 | 能力表更新 | L1/L2 | 缺逐卡 E2E |
| `treant-card-harvest` | 抽牌 + 树灵 | main draw + seedling | main 候选未逐卡 E2E | 通用打牌 | 0CP | hand +1，seedling +1 | 牌库洗牌边界未审 | 打牌清理 | L1/L2 | 缺卡本体 L3 |
| `treant-card-cultivate` | 树灵 +3 | main grant seedling | main 候选未逐卡 E2E | 通用打牌 | 3CP | seedling +3 | 上限 | 打牌清理 | L1/L2 | 缺卡本体 L3 |
| `treant-card-downpour` | 治疗 + 树灵 | main heal + seedling | main 候选未逐卡 E2E | 通用打牌 | 2CP | heal +2，seedling +1 | 上限 | 打牌清理 | L1/L2 | 缺卡本体 L3 |
| `upgrade-nature-touch-2` | 升级自然之触 | replace | main 候选未逐卡 E2E | 通用打牌 | 2CP | replace | 不可防御代表覆盖 | 能力表更新 | L1/L2 | 缺逐卡 E2E |
| `treant-card-soulfire` | 攻击修正 3 骰 | roll action withDamage | roll 候选未逐卡 E2E | 通用打牌 | 1CP | branch +1，leaf lifeSap，spirit seedling | 骰面分支 | 特写收口 | L1/L2 | 缺专属 E2E |
| `treant-card-mother-tree` | 掷 1 骰，树灵或抽牌 | roll action immediate | main 候选未逐卡 E2E | 通用打牌 | 0CP | spirit seedling 4，否则 draw | 默认分支 | 特写收口 | L1 | 缺行为测试 |
| `upgrade-vengeful-vines-2` | 升级复仇枝蔓 | replace | main 候选未逐卡 E2E | 通用打牌 | 2CP | replace | thorn 后续覆盖 | 能力表更新 | L1/L2 | 缺逐卡 E2E |
| `upgrade-wild-growth-2` | 升级野蛮生长 | replace | main 候选未逐卡 E2E | 通用打牌 | 2CP | replace | 无 | 能力表更新 | L1 | 缺逐卡 E2E |
| `upgrade-shattering-fist-2` | 升级破碎之拳 II | replace | main 候选未逐卡 E2E | 通用打牌 | 1CP | replace | 无 | 能力表更新 | L1 | 缺逐卡 E2E |
| `treant-card-planting` | 树灵 +4 | main grant seedling | main 候选未逐卡 E2E | 通用打牌 | 1CP | seedling +4 | 上限 | 打牌清理 | L1/L2 | 缺卡本体 L3 |

## Ninja 重审矩阵

Ninja 已在 `evidence/dicethrone/dicethrone-ninja-full-flow-reaudit-2026-05-15.md` 建立完整矩阵。本轮复用该矩阵并纳入本轮循环结论：

- 四项用户指出回归已有专项 L2/L3：
  - `poison-blade` / `death-blossom` Ninja v2 槽位映射。
  - `blink` 防御时机。
  - 不可防御跳过防御 resolver。
  - `ninja-card-knife-fan` 主阶段行动牌时机。
- Token 复杂链路已有 L2/L4：`ninjutsu`、`smoke_bomb` 成功免伤、`delayed_poison` 回合结束。
- 仍不能宣称 Ninja 全对象全量 E2E：`ninja-card-shuriken`、`ninja-card-escape`、多张升级卡和部分基础/升级技能缺专属 L3。

## 抽查全链路

| 抽查对象 | 审查链 | 结果 |
|---|---|---|
| Treant `rooted` | 真相源防御掷骰 → 静态 timing → defense resolver → phase advance → 反击/token → 不可防御否定路径 | 发现实现 bug，已修并补 L2/L3 |
| Treant `life_sap` | token 主阶段入口 → passive custom → bonus die → heal → display-only settlement → 收口 | 既有 L2/L4 与截图链仍有效 |
| Ninja `ninjutsu` | beforeDamageDealt 响应窗 → token 消耗 → bonus die → 4/5 加伤或 6 点选择 → pendingDamage/pendingAttack 更新 → 收口 | 既有 L2/L4 与截图链仍有效 |
| Ninja `knife-fan` | 卡图主阶段语义 → `timing='main'` → offensiveRoll 否定 → direct unblockable damage 定义 | L2 合同已覆盖；缺真实打出 E2E，不能写 L3 |

## 验证

已通过：

```powershell
npx eslint src/games/dicethrone/heroes/treant/abilities.ts src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts src/games/dicethrone/__tests__/treant-token-mechanics.test.ts src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts src/games/dicethrone/__tests__/ninja-token-mechanics.test.ts
npx vitest run src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts src/games/dicethrone/__tests__/treant-token-mechanics.test.ts src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts src/games/dicethrone/__tests__/ninja-token-mechanics.test.ts --configLoader native --maxWorkers 1
npx eslint e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts
npm run typecheck
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts "树精扎根防御应真实掷骰结算且不可防御时跳过"
npm run test:e2e:ci -- e2e/dicethrone/dicethrone-treant-ninja-mechanics.e2e.ts
```

Vitest 结果：4 files / 18 tests passed。

E2E 结果：

- 新增 Rooted 单条：1 passed。
- Treant / Ninja 机制整文件：11 passed。

## E2E 截图核验

Rooted 可防御结算后：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精扎根防御应真实掷骰结算且不可防御时跳过\02-rooted-after-defense-advance.png`

肉眼观察：

- 仍在真实 Treant/Ninja 在线对局界面，不是孤立预览。
- 顶部 Ninja HP 显示为 29，证明树枝反击已生效。
- Treant 状态区可见幼种/生命源泉图标；E2E 同时断言 `seedling=1`、`lifeSap=1`。

Rooted 不可防御路径：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精扎根防御应真实掷骰结算且不可防御时跳过\04-rooted-undefendable-after-advance.png`

肉眼观察：

- 顶部 Ninja HP 保持 30。
- Treant 状态没有新增幼种/生命源泉；E2E 同时断言二者均为 0。
- 证明 `pendingAttack.isDefendable=false` 时，即使挂着 `defenseAbilityId='rooted'` 也不会执行防御效果。

## 当前结论

- Treant/Ninja 已完成本轮“重审 + 抽查 + 发现问题后补规范再重审”的一个闭环。
- 本轮发现并修复 Treant `rooted` 防御实现错误。
- 本轮补强了两条通用审计规范：同类 bug 扩审、多骰 E2E 使用 sequence。
- 两个新英雄仍不能被描述为“所有技能/专属卡均已逐对象 L3/E2E 全覆盖”；专属卡逐卡真实打出和部分基础/升级技能本体仍按矩阵保留为 L1/L2 残余范围。
