# DiceThrone 攻击修正卡“先选择技能”语义审计 2026-05-17

## 审计范围

- 共享门禁
  - `src/games/dicethrone/domain/rules.ts`
- 专属攻击修正卡定义
  - `src/games/dicethrone/heroes/barbarian/cards.ts`
  - `src/games/dicethrone/heroes/pyromancer/cards.ts`
  - `src/games/dicethrone/heroes/moon_elf/cards.ts`
  - `src/games/dicethrone/heroes/gunslinger/cards.ts`
  - `src/games/dicethrone/heroes/samurai/cards.ts`
  - `src/games/dicethrone/heroes/treant/cards.ts`
  - `src/games/dicethrone/heroes/ninja/cards.ts`
- 专属攻击修正执行器
  - `src/games/dicethrone/domain/customActions/*.ts`
- 现有测试/录入文档
  - `src/games/dicethrone/__tests__/red-hot-meteor-integration.test.ts`
  - `src/games/dicethrone/__tests__/cross-hero.test.ts`
  - `src/games/dicethrone/__tests__/treant-ability-card-contract.test.ts`
  - `src/games/dicethrone/__tests__/card-playCondition-audit.test.ts`
  - `src/games/dicethrone/rule/*.md`

## 结论等级

- 已完成 L1 语义审计
- 已完成 L2 `selected attack` 门禁行为证据复核

说明：

- 本轮结论聚焦“哪些牌会触发 `attackModifierRequiresSelectedAttack`，以及为什么这是业务语义而不是误判”。
- 本轮已为 12 张 `isAttackModifier` 牌逐张补齐“无当前攻击时拒绝 / 有当前攻击时允许”的门禁专项测试。
- 但这不等于 12 张牌的全部攻击修正语义都已同等级收口；例如额外掷骰结果写入、奖励骰特写、目标落点、状态施加等仍依赖各自专项测试覆盖深度。

## 共享门禁真相

- `src/games/dicethrone/domain/rules.ts`
  - `card.isAttackModifier !== true`：不命中该门禁
  - `card.isAttackModifier === true` 且 `pendingAttack.sourceAbilityId` 为空：返回 `attackModifierRequiresSelectedAttack`
  - `pendingAttack.attackerId !== playerId`：返回 `wrongPhaseForCard`

这条共享门禁表达的是：

- “攻击修正卡”必须附着在一条已经选定的当前攻击上；
- 没有当前攻击技能时，攻击修正没有合法宿主；
- 这不是“UI 提示偏好”，而是当前领域模型中 `pendingAttack` 的强业务合同。

## 逐张语义矩阵

| 卡牌 | 语义为何必须先有 selected attack | 是否还要求 selected defender | 当前证据深度 |
| --- | --- | --- | --- |
| `card-more-please` | custom action 额外掷骰并把结果写回当前攻击的加伤/状态链，没有当前攻击就无合法宿主 | 是 | L2：`red-hot-meteor-integration.test.ts` + `barbarian-behavior.test.ts` |
| `card-red-hot` | 读取当前攻击骰面中的 `fire mastery` 并给当前攻击加伤；没有当前攻击就没有可修正对象 | 否 | L2：`red-hot-meteor-integration.test.ts` + `pyromancer-behavior.test.ts` |
| `card-get-fired-up` | 额外掷 1 骰并把结果写回当前攻击 bonusDamage / token 效果链 | 是 | L2：`red-hot-meteor-integration.test.ts` + `pyromancer-behavior.test.ts` |
| `volley` | 额外掷骰并把弓面伤害写入当前攻击 | 是 | L2：`red-hot-meteor-integration.test.ts` + `moon_elf-behavior.test.ts` |
| `watch-out` | 额外掷骰并把结果写入当前攻击/目标状态 | 是 | L2：`red-hot-meteor-integration.test.ts` + `moon_elf-behavior.test.ts` |
| `card-wild-west` | 不是改主骰盘，而是给当前攻击挂 `loadedBonusDieBoost`，等待后续 `Loaded` 奖励骰特写消费；没有当前攻击，这个 boost 无处挂载 | 否 | L2：`red-hot-meteor-integration.test.ts` + `cross-hero.test.ts` |
| `card-eat-my-lead` | 额外掷 5 骰并把子弹数写成当前攻击加伤；没有当前攻击就无宿主 | 是 | L2：`red-hot-meteor-integration.test.ts` |
| `card-righteousness` | 额外掷骰结果直接修正当前攻击并可能施加对手状态 | 是 | L2：`red-hot-meteor-integration.test.ts`；武士专项行为测试已有卡牌语义覆盖 |
| `card-zanshin` | 额外掷 5 骰结果汇总到当前攻击伤害/状态链 | 是 | L2：`red-hot-meteor-integration.test.ts`；武士专项行为测试已有卡牌语义覆盖 |
| `treant-card-trample` | 额外掷 5 骰，树枝数写入当前攻击 bonusDamage，并按阈值给 defender 上刺藤 | 是 | L2：`red-hot-meteor-integration.test.ts` + `treant-ability-card-contract.test.ts` |
| `treant-card-soulfire` | 额外掷 3 骰；树枝/树叶/树灵分支都会围绕当前攻击与其时序结算，且部分效果需要依附攻击窗口 | 否 | L2：`red-hot-meteor-integration.test.ts` + `treant-ability-card-contract.test.ts` |
| `ninja-card-shuriken` | `rollDie` 使用 `resolutionMode='attackBonus'` + `attackBonusSourceCardId`，语义上是把额外掷骰结果写入当前攻击 bonusDamage；没有当前攻击就没有 attackBonus 写入目标 | 否 | L2/L3：`red-hot-meteor-integration.test.ts` + `ninja卡牌录入核对.md` |

## 关键业务结论

### 1. “会弹先选择技能”的对象不是所有 roll 牌，而是 12 张 `isAttackModifier` 牌

- 它们的共同点不是“在投掷阶段打出”，而是“效果要写回当前攻击”。
- 因此门禁的业务本质是“当前攻击是否已建立”，不是“这张牌是不是在投掷阶段看起来合理”。

### 2. `selected attack` 与 `selected defender` 不是同一层门禁

- 所有 12 张都需要先有当前攻击技能，也就是 `pendingAttack.sourceAbilityId`。
- 但不是所有卡都需要先有具体 defender。
- 当前实现中，额外还要求 `requiresSelectedDefender: true` 的，是这些卡：
  - `card-more-please`
  - `card-get-fired-up`
  - `volley`
  - `watch-out`
  - `card-eat-my-lead`
  - `card-righteousness`
  - `card-zanshin`
  - `treant-card-trample`
- 当前不要求 `selected defender` 的，是：
  - `card-red-hot`
  - `card-wild-west`
  - `treant-card-soulfire`
  - `ninja-card-shuriken`

### 3. “逐张都核过 selected attack 语义”现在可以成立，但不能外推成“所有攻击修正语义都已完全收口”

- 共享门禁语义已核清：12 张都属于“必须依附当前攻击”的牌。
- `red-hot-meteor-integration.test.ts` 现已逐张覆盖 12 张攻击修正卡：
  - 无 `pendingAttack.sourceAbilityId` 时命中 `attackModifierRequiresSelectedAttack`
  - 有 `pendingAttack.sourceAbilityId` 时攻击方可在 `offensiveRoll` 正常打出
- 其中 `requiresSelectedDefender: true` 的 8 张牌，当前还额外有自动目标 / 手选目标窗口测试覆盖。
- 但逐张“selected attack 门禁已覆盖”不等于逐张“整条效果链都已同等级证明”；更宽的专项行为深度仍以各英雄专测和录入审计为准。

## 当前最准口径

- 可以说：这 12 张牌在语义上都属于“攻击修正卡”，共享门禁 `attackModifierRequiresSelectedAttack` 与当前实现模型一致，且“无当前攻击时拒绝 / 有当前攻击时允许”的 selected-attack 门禁已逐张具备专项自动化证据。
- 不可以说：这 12 张牌的全部攻击修正行为都已经逐张完整收口，或 selected-defender、特写、写伤、状态副作用、E2E 证据都已同等级补齐。

## 验证证据

- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/red-hot-meteor-integration.test.ts --configLoader native`
  - 结果：`59 passed`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/card-playCondition-audit.test.ts --config vitest.config.audit.ts --configLoader native`
  - 结果：`132 passed`

## 后续建议

- 若要继续收口，后续方向不再是补 `selected attack` 门禁，而是补更深一层的卡牌专项证据：
  - 奖励骰特写与收口后写伤是否正确
  - `requiresSelectedDefender` 卡在自动目标 / 手选目标 / 收口后的目标一致性
  - 真实 UI 链路里“弹先选技能”提示与实际结算是否一致
