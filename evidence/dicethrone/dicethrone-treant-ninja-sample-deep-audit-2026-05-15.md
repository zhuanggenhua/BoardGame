# DiceThrone Treant / Ninja 抽样深审：Token、手牌技能、基础技能（2026-05-15）

## 结论口径

本文件只证明本轮“抽样深审”已完成，不证明 Treant / Ninja 全对象、全分支、全端到端已经无遗漏。抽样覆盖三类对象：

- Token / 状态：Ninja `smoke_bomb` 失败分支。
- 手牌技能 / 专属卡：Ninja `ninja-card-shuriken`、`ninja-card-escape`；Treant `treant-card-trample`、`treant-card-mother-tree`。
- 基础技能 / 升级基础技能：Treant `quiet-cultivation`、`rooted-2`。

本轮审计方法不是只看静态定义，而是反查真实消费点：

- 卡牌 `PLAY_CARD` 实际只用 `resolveEffectsToEvents(..., 'immediate')` 解析效果。
- 防御 resolver 实际消费 `AbilityDef.effects[].action.diceCount`，不是只看 `trigger.diceCount`。
- Token 使用后必须检查权威状态、消耗、后续 pending 状态，而不是只看按钮或事件存在。

## 发现并修复的问题

### 1. 攻击修正奖励骰卡打出后不生效

命中对象：

- `ninja-card-shuriken`
- `treant-card-trample`
- `treant-card-soulfire`

旧实现问题：

- 三张卡的 `rollDie` effect 使用 `timing: 'withDamage'`。
- 但 `PLAY_CARD` 的执行链只按 `immediate` 解析卡牌效果。
- 结果是卡牌可被判定为可打，但奖励骰加伤不会真实进入 `pendingAttack.bonusDamage`。

修复：

- 三张卡改为 `timing: 'immediate'`。
- `EffectAction` 增加 `resolutionMode?: 'damage' | 'attackBonus'` 与 `attackBonusSourceCardId?: string`。
- `rollDie` 在 `resolutionMode === 'attackBonus'` 时发 `BONUS_DAMAGE_ADDED`，写入当前攻击加伤，不直接扣对手 HP。

修复文件：

- `src/games/dicethrone/domain/tokenTypes.ts`
- `src/games/dicethrone/domain/effects.ts`
- `src/games/dicethrone/heroes/ninja/cards.ts`
- `src/games/dicethrone/heroes/treant/cards.ts`
- `e2e/src/games/dicethrone/domain/tokenTypes.ts`
- `e2e/src/games/dicethrone/domain/effects.ts`
- `e2e/src/games/dicethrone/heroes/ninja/cards.ts`
- `e2e/src/games/dicethrone/heroes/treant/cards.ts`

### 2. Treant `rooted-2` 静态显示 4 骰但实际仍按 3 骰结算

旧实现问题：

- `rooted-2.trigger.diceCount = 4`。
- 但防御结算实际执行 `effects[0].action.diceCount`。
- `rooted-2` 继承基础 `ROOTED` effects，实际仍是 3 骰。

修复：

- `ROOTED_2.effects` 显式定义 4 骰 `rollDie`，并保留 `timing: 'withDamage'`。

修复文件：

- `src/games/dicethrone/heroes/treant/abilities.ts`
- `e2e/src/games/dicethrone/heroes/treant/abilities.ts`

## 抽样对象矩阵

| 类别 | 对象 | 真相/规则要点 | 真实消费点 | 本轮结论 | 证据层级 |
|---|---|---|---|---|---|
| Token | Ninja `smoke_bomb` 失败分支 | 失败时消耗烟雾弹但不免伤 | `USE_TOKEN` / token handler / `pendingDamage` | 已证明失败骰面消耗 token，保留待结算伤害，不提前扣 HP | L2 |
| 手牌卡 | Ninja `ninja-card-shuriken` | 攻击修正，投 5 骰，每忍刀 +1 | `PLAY_CARD` immediate effect / `BONUS_DAMAGE_ADDED` | 已修复并证明加伤写入 `pendingAttack`，不直接扣 HP | L2 |
| 手牌卡 | Ninja `ninja-card-escape` | 受击响应窗可打，护盾抵伤 | `checkPlayCard` / `PLAY_CARD` / `SKIP_TOKEN_RESPONSE` | 已证明响应窗可打，护盾抵消后续结算伤害 | L2 |
| 手牌卡 | Treant `treant-card-trample` | 攻击修正投 5 骰，加伤并施加刺藤 | `PLAY_CARD` immediate effect / `BONUS_DAMAGE_ADDED` | 已修复并证明加伤与刺藤同时进入权威状态 | L2 |
| 手牌卡 | Treant `treant-card-mother-tree` | 掷 1 骰，树灵分支或否则抽牌 | `PLAY_CARD` immediate effect | 已证明树灵分支与默认抽牌分支不同 | L2 |
| 基础技能 | Treant `quiet-cultivation` | 维持阶段开始获得幼种 | `flowHooks.onPhaseEnter` | 已证明 upkeep 进入时自动加 1，并受上限后的总量约束 | L2 |
| 升级基础技能 | Treant `rooted-2` | 防御掷 4 骰 | `resolveAttack` / defense effect action | 已发现旧实现仍 3 骰，已修复并证明 4 个奖励骰事件 | L2 |

## 验证

已通过：

```powershell
npx eslint src/games/dicethrone/domain/tokenTypes.ts src/games/dicethrone/domain/effects.ts src/games/dicethrone/heroes/ninja/cards.ts src/games/dicethrone/heroes/treant/cards.ts src/games/dicethrone/heroes/treant/abilities.ts src/games/dicethrone/__tests__/treant-ninja-sample-deep-check.test.ts e2e/src/games/dicethrone/domain/tokenTypes.ts e2e/src/games/dicethrone/domain/effects.ts e2e/src/games/dicethrone/heroes/ninja/cards.ts e2e/src/games/dicethrone/heroes/treant/cards.ts e2e/src/games/dicethrone/heroes/treant/abilities.ts
npx vitest run src/games/dicethrone/__tests__/treant-ninja-sample-deep-check.test.ts --configLoader native --maxWorkers 1
npx vitest run src/games/dicethrone/__tests__/treant-token-mechanics.test.ts src/games/dicethrone/__tests__/ninja-token-mechanics.test.ts src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts src/games/dicethrone/__tests__/ability-effect-timing-contract.test.ts --configLoader native --maxWorkers 1
npm run typecheck
```

结果：

- `treant-ninja-sample-deep-check.test.ts`：1 file / 7 tests passed。
- 相邻合同与 Token 测试：5 files / 20 tests passed。
- TypeScript：通过。

## 未覆盖与不能外推的范围

- 本轮没有新增真实 UI E2E 截图链；因此上述对象只能升级到 L2，不能写 L3/L4。
- `ninja-card-shuriken`、`treant-card-trample`、`treant-card-soulfire` 已有领域行为证明，但仍缺真实手牌打出 E2E。
- `rooted-2` 已证明防御骰数合同修复，但仍缺升级卡真实打出后进入防御的 E2E。
- 本轮只抽查了部分 Token、专属卡和基础技能；Treant / Ninja 仍不能被描述为“全部新机制新交互均已端到端”。

## 对旧审计结论的影响

旧文档中关于以下对象的结论需要降级或修订：

- `rooted-2`：旧“共享 rooted 合同”结论不充分；实际消费点仍按 3 骰，已在本轮修复。
- `ninja-card-shuriken`、`treant-card-trample`、`treant-card-soulfire`：旧“L1/L2 静态/代表覆盖”不足；实际卡牌打出链路存在 timing 消费错误，已在本轮修复并补 L2。
- `treant-card-mother-tree`：旧“缺行为测试”已升级为 L2 抽查覆盖，但仍缺 L3。
- `quiet-cultivation`：旧“缺 L2/L3 专项”已升级为 L2 抽查覆盖，但仍缺 L3。
- `ninja-card-escape`、`smoke_bomb` 失败分支：已补 L2 抽查覆盖，但仍缺真实 UI/E2E。
