# DiceThrone Treant / Ninja 抽样深审：Token、手牌技能、基础技能（2026-05-15）

## 2026-05-16 失效补记：抽样结论不能外推 Treant 全量

后续直接对照 Treant `提示板.png` / `玩家面板.png` / `abilitycards.png` 发现，本文件虽然抓到了若干真实消费点问题，但它的抽样对象远不足以覆盖 Treant 全量规则语义。

已经被后续证据推翻或降级的核心点：

- `quiet-cultivation`、`treant-card-mother-tree`、`treant-card-cultivate` 等对象，旧文把“当前写入 seedling 的行为测试通过”当成了可接受的 L2；但提示板已经坐实 `养成树灵 != 直接加幼种`，所以这些 L2 现在只能降级为“旧实现行为存在”，不能再代表规则正确。
- `treant-card-trample`、`treant-card-soulfire` 虽然本文件曾修过“打牌时机 / attackBonus 消费点”，但卡图本体后来证明其**规则语义本身**还录错了：`trample` 的刺藤触发条件、`soulfire` 的树枝分支都不对。
- `rooted-2` 旧文只证明了“4 骰消费点修好”，不代表 `rooted` / `rooted-2` 的防御语义正确；玩家板图片后来又坐实了防止值与双叶/双树灵分支都和当前实现不一致。

因此，本文件当前只能证明：这些对象曾命中过一轮“消费点 / 结构”问题并被修过；**不能**再外推为 Treant 深审已覆盖大头。

## 结论口径

本文件只证明本轮“抽样深审”已完成，不证明 Treant / Ninja 全对象、全分支、全端到端已经无遗漏。抽样覆盖三类对象：

- Token / 状态：Ninja `smoke_bomb` 失败分支。
- 手牌技能 / 专属卡：Ninja `ninja-card-shuriken`、`ninja-card-escape`；Treant `treant-card-trample`、`treant-card-mother-tree`。
- 基础技能 / 升级基础技能：Treant `quiet-cultivation`、`rooted-2`。

2026-05-16 追加限制：

- 本文件只覆盖“功能消费点 / 行为合同 / 部分 UI 链路”的抽样深审，不覆盖 Treant 玩家板图面合同。
- 后续已确认：Treant 明明有玩家板图，但旧审计没有逐槽核对 `quiet-cultivation` 与 `rooted` 的图面落点，导致被动/防御槽错位漏审。
- 因此，凡涉及 Treant 玩家板落点、特殊槽、空槽、display-only 区域的判断，必须改看 `evidence/dicethrone/dicethrone-treant-slot-audit-2026-05-16.md`，不能引用本文件替代。

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
| Token | Ninja `smoke_bomb` 失败分支 | 失败时消耗烟雾弹但不免伤 | `USE_TOKEN` / token handler / `pendingDamage` | 已证明失败骰面消耗 token，保留待结算伤害，不提前扣 HP；2026-05-17 补真实 UI/E2E 后证明跳过响应会正常结算伤害 | L4 |
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

- 本轮原始抽样没有新增真实 UI E2E 截图链；因此上述对象在 2026-05-15 当时只能升级到 L2，不能写 L3/L4。
- `ninja-card-shuriken` 已于 2026-05-17 追加真实手牌 L3；`treant-card-trample`、`treant-card-soulfire` 已于 2026-05-17 追加真实手牌 L3，分别覆盖奖励骰加伤/刺藤与三种骰面分支。
- `rooted-2` 已证明防御骰数合同修复，但仍缺升级卡真实打出后进入防御的 E2E。
- 本轮只抽查了部分 Token、专属卡和基础技能；Treant / Ninja 仍不能被描述为“全部新机制新交互均已端到端”。

## 对旧审计结论的影响

旧文档中关于以下对象的结论需要降级或修订：

- `rooted-2`：旧“共享 rooted 合同”结论不充分；实际消费点仍按 3 骰，已在本轮修复。
- `ninja-card-shuriken`、`treant-card-trample`、`treant-card-soulfire`：旧“L1/L2 静态/代表覆盖”不足；实际卡牌打出链路存在 timing 消费错误，已在本轮修复并补 L2。
- `treant-card-mother-tree`：旧“缺行为测试”已升级为 L2 抽查覆盖；2026-05-17 已补真实手牌 L3，覆盖树灵养成分支与非树灵抽牌分支。
- `quiet-cultivation`：旧“缺 L2/L3 专项”已升级为 L2 抽查覆盖，但仍缺 L3。
- `ninja-card-escape`：已于 2026-05-17 追加真实受击响应窗手牌 L3，见 `evidence/dicethrone/dicethrone-ninja-escape-real-hand-e2e-2026-05-17.md`；`smoke_bomb` 失败分支已在下一条补真实 UI/E2E。
- `smoke_bomb` 失败分支：已于 2026-05-17 追加真实响应窗 E2E，见 `evidence/dicethrone/dicethrone-ninja-smoke-bomb-failure-e2e-2026-05-17.md`；证明失败骰面消耗 token、保留伤害、跳过响应后 HP 30->23。
- `ninja-card-training` / `ninja-card-poison-dart` / `ninja-card-knife-fan`：已于 2026-05-17 追加真实主阶段手牌 L3，见 `evidence/dicethrone/dicethrone-ninja-main-action-real-hand-e2e-2026-05-17.md`；该补充不改变本文件“抽样不能外推全量”的主结论。
- Ninja 8 张升级卡：已于 2026-05-17 追加真实主阶段手牌 L3，见 `evidence/dicethrone/dicethrone-ninja-upgrade-real-hand-e2e-2026-05-17.md`；该补充只证明升级卡打出与替换合同，不证明升级后技能本体所有骰面/分支均已 L3。
- Treant 玩家板图面合同：旧“基础技能抽样深审已覆盖 Treant `quiet-cultivation` / `rooted-2`”不能外推成图面落点正确；这部分当时根本不在本文件审计范围内，现已单列专项证据。
