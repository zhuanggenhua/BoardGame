# DiceThrone 新派系 Treant / Ninja 全量重审与抽查循环（2026-05-15）

## 2026-05-16 全面审计再降级：Treant 不是“还剩两项”

本文件关于 Treant 的旧矩阵结论需要继续降级。2026-05-16 直接对照 `玩家面板.png`、`提示板.png`、`abilitycards.png` 后，新增命中的不是零散尾项，而是一整簇对象级真错误：

- 树灵 `每回合每种仅限花费1次` 未实现；
- `养成1树灵` 被系统性简化成 `grant seedling` / `grant sapling`，没有“获得幼种或升级现有树灵”的正式合同；
- 神性树灵防负面被做成自动消耗，不是可选响应；
- 刺藤“每回合至多因此受到2伤害”上限已在 2026-05-17 修复，见 `treant-token-mechanics.test.ts`；
- `wild-growth`（2026-05-17 已修复）、`nature-touch`（2026-05-17 已修复到 L2）、`rooted`（2026-05-17 已修复到 L2）、`tend-care`（2026-05-17 已修复到 L2）、`forest-awakens`（2026-05-17 已修复到 L2） 的主效果曾与图片直接冲突；
- `treant-card-harvest`、`treant-card-downpour`、`treant-card-soulfire`、`upgrade-shattering-fist-3`、`upgrade-wild-growth-2`、`treant-card-planting` 等多张专属卡结构化字段错误；
- `upgrade-shattering-fist-2` / `treant-card-planting` 还额外命中 atlas 预览索引越界。

因此，本文件里凡是把 Treant 写成“已进入 L2/L3，只差逐卡 E2E”的对象，都必须理解为**旧审计结论失效**。Treant 当前有效的全面审计出口改以：

- `evidence/dicethrone/dicethrone-treant-full-audit-2026-05-16.md`

为准；本文件只保留为“此前几轮抽查/修复的历史记录”，不再充当 Treant 收口证明。

## 2026-05-16 Treant 图面合同口径再降级

本文件虽然已经把 Treant `rooted` 的防御时机、`rooted-2` 的 4 骰合同、若干 Token/卡牌流程问题重审了一轮，但 2026-05-16 用户继续指出：

- `quiet-cultivation` 被错误落在普通技能共享槽语义里；
- `rooted` 被错误挂到 `calm`；
- 真相源里明明已有 Treant 玩家板图，旧审计却没有把“图面槽位合同”作为独立对象逐槽核对。

因此，本文件里关于 Treant 的矩阵只能继续解释为“功能链/消费点/部分 UI 流程重审”，不能外推成“Treant 玩家板图面合同也已收口”。Treant 图面合同的当前有效证据改以：

- `evidence/dicethrone/dicethrone-treant-slot-audit-2026-05-16.md`

为准。

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
  - 历史版本曾按旧错语义断言“1/4/6 产生反击、幼种树灵、生命源泉”；该结论已在 2026-05-17 失效。
  - 当前测试已改为覆盖 Rooted 按树枝 + 树灵防止伤害、双树叶养成、双树灵选择生命源泉目标、Rooted II 4 骰，以及不可防御时 Rooted 不执行。
- 新增 E2E：`树精扎根防御应真实掷骰结算且不可防御时跳过`。

规范补强：

- `docs/ai-rules/testing-audit.md` 新增“同类已修 bug 必须扩审兄弟对象”。
- `docs/ai-rules/testing-audit.md` 新增“多次随机/多骰 E2E 必须使用序列策略”。

### 循环 1 复审结论

Rooted 当前从旧错语义降级后重新进入 L2；旧 L3 截图只证明防御入口会触发，不再证明当前完整语义：

- L2：Vitest 权威状态证明。
- L3：待按 2026-05-17 新语义补真实在线对局 E2E 阶段推进截图链。
- 否定路径：`isDefendable=false` 时 Rooted 不执行。

## Treant 完整流程矩阵

| 对象 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
|---|---|---|---|---|---|---|---|---|---|---|
| `shattering-fist` | 3/4/5 树枝伤害；可移除 1 树灵施加刺藤 | choice + damage 5/6/7 | 通用骰面候选 | 通用 ability activate | 可消耗 1 树灵 | thorn choice + damage | 无树灵时无选择 | 通用攻击流程 | L2 | 2026-05-17 已修；缺逐技能 L3 |
| `shattering-fist-2` | 升级施加刺藤 + 5/6/7 伤害 | grant thorn + damage 5/6/7 | 升级后候选 | 通用 ability activate | 升级卡替换 | thorn + damage | 刺藤后续代表覆盖 | 通用攻击流程 | L2 | 2026-05-17 已修；缺升级卡 L3 |
| `shattering-fist-3` | 升级施加刺藤 + 三同点养成 1 + 5/6/7 伤害 | grant thorn + cultivate choice + damage 5/6/7 | 升级后候选 | 通用 ability activate | 升级卡替换 | thorn + cultivate + damage | 非三同点不养成 | 通用攻击流程 | L2 | 2026-05-17 已修；缺升级卡 L3 |
| `tend-care` | 抽 1；养成 3 树灵；1 名玩家得生命源泉；1 名对手得刺藤 | draw + `treant-tend-care-choice(cultivateAmount=3)` | 通用候选 | 通用 ability activate | N/A | 组合选择写回树灵最终分布、生命源泉目标、刺藤目标 | token 后续代表覆盖 | 通用流程 | L2 | 2026-05-17 已修；缺技能本体 L3 |
| `tend-care-2` | 抽 1；养成 4 树灵；1 名玩家得生命源泉；1 名对手得刺藤 | draw + `treant-tend-care-choice(cultivateAmount=4)` | 升级后候选 | 通用 ability activate | 升级卡替换 | 组合选择写回树灵最终分布、生命源泉目标、刺藤目标 | token 后续代表覆盖 | 通用流程 | L2 | 2026-05-17 已修；缺升级卡打出 L3 |
| `vengeful-vines` | 小顺子，刺藤 + 7 伤害 | smallStraight + thorn + damage | 通用候选 | 通用 ability activate | N/A | thorn + damage | 刺藤后续覆盖 | 通用攻击流程 | L1/L2 | 缺技能本体 L3 |
| `vengeful-vines-2` | 刺藤 + 8 伤害 | smallStraight + thorn + damage 8 | 升级后候选 | 通用 ability activate | 升级卡替换 | thorn + damage | 刺藤后续覆盖 | 通用攻击流程 | L1/L2 | 缺技能本体 L3 |
| `nature-touch` | 4 树灵，养成 2 后按树灵数加不可防御伤害 | preDefense 养成选择 + unblockable damage 5 + 养成后树灵数 | 通用候选 | 通用 ability activate | N/A | token final state + bonusDamage + damage | 不进入防御 | 通用攻击流程 | L2 | 2026-05-17 已修；缺技能本体 L3 |
| `nature-touch-2` | 养成 2 后按树灵数加不可防御伤害，基础 6 | preDefense 养成选择 + unblockable damage 6 + 养成后树灵数 | 升级后候选 | 通用 ability activate | 升级卡替换 | token final state + bonusDamage + damage | 不进入防御 | 通用攻击流程 | L2 | 2026-05-17 已修；缺技能本体 L3 |
| `quiet-cultivation` | 维持阶段养成 | phaseStart upkeep + seedling 1 | 无玩家入口 | flowHooks phaseStart | N/A | seedling +1 | 自动被动，无 skip | 阶段进入后继续 | L1 | 缺 L2/L3 专项 |
| `wild-growth` | 伤害 + 可移除树灵加伤 + 可弃生命源泉不可防御 | preDefense choice + damage 2 | 通用候选 | 通用 ability activate | 可消耗至多 2 树灵 / 1 生命源泉 | damage + bonusDamage | 不再治疗；生命源泉使不可防御 | 通用攻击流程 | L2 | 2026-05-17 已修 |
| `wild-growth-2` | 伤害 4 + 同 wild-growth 可选分支 | preDefense choice + damage 4 | 升级后候选 | 通用 ability activate | 升级卡替换；可消耗至多 2 树灵 / 1 生命源泉 | damage + bonusDamage | 不再治疗；生命源泉使不可防御 | 通用攻击流程 | L2 | 2026-05-17 已修 |
| `rooted` | 防止 1×树枝 + 1×树灵；双树叶养成；双树灵生命源泉 | defensive custom `treant-rooted-defense` diceCount 3 | 防御阶段 | resolveAttack / resolveDefenseEffects | N/A | prevent + cultivate choice + lifeSap target choice | 不可防御跳过 | 防御结算后继续 | L2 | 2026-05-17 已按图片修正；缺新语义 L3 |
| `rooted-2` | 同 rooted，防御掷 4 骰 | defensive custom `treant-rooted-defense` diceCount 4 | 升级后防御入口 | resolveAttack / resolveDefenseEffects | 升级卡替换 | 同 rooted，多 1 骰 | 不可防御跳过 | 防御结算后继续 | L2 | 共享 rooted 合同，缺专属 L3 |
| `forest-awakens` | 终极：自己和队友生命源泉、养成 5、刺藤、10 伤害 | `treant-forest-awakens-choice` + damage 10 | 通用候选 | 通用 ability activate | N/A | 组合选择写回树灵最终分布、自己/队友 lifeSap、防御目标 thorn | 终极跳过防御方响应 | 通用攻击流程 | L2 | 2026-05-17 已修；缺终极本体 L3 |

## Treant Token / 被动矩阵

| 对象 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
|---|---|---|---|---|---|---|---|---|---|---|
| `treant_seedling` | 掷骰阶段消耗重掷 | passive rerollDie | 自己掷骰阶段按钮 | `USE_PASSIVE_ABILITY` | token -1 | 指定骰重掷 | 无 token 时隐藏 | selection mode 清理 | L2/L3 | 已覆盖 |
| `treant_sapling` 治疗+CP | 主阶段消耗治疗并 +CP | passive custom | 主阶段按钮 | custom action | token -1 | HP +1，CP +1 | CP 上限 delta 0 | 按钮随 token 隐藏 | L2/L3 | 已覆盖 |
| `treant_sapling` 抽牌 | 主阶段额外 1CP 抽牌 | passive custom | 主阶段按钮 | custom action | token -1，CP -1 | hand +1 | CP 不足由候选/校验限制 | 按钮随 token 隐藏 | L2/L3 | 已覆盖 |
| `treant_divine` 加伤 | 造成伤害前 +3 | activeUse beforeDamageDealt | 攻击方响应窗 | `USE_TOKEN` | token -1 | pendingDamage 与 pendingAttack +3 | 无 token 无入口 | 响应窗收口 | L2/L4 | 已覆盖 |
| `treant_divine` 防负面 | 阻止即将受到负面状态 | flowHooks debuff filter | 无主动入口 | 阶段推进 | token -1 | 过滤 debuff | 仅 incoming debuff 触发 | 阶段继续 | L2/L4 | 已覆盖 |
| `life_sap` | 主阶段掷 1 骰治疗半值向上 | passive custom | 主阶段按钮 | custom action | token -1 | bonus die + heal | 无 token 隐藏 | 特写收口 | L2/L4 | 已覆盖 |
| `thorn` | 进攻掷骰结束按额外投掷受伤，每回合最多 2 伤害 | phaseExit offensiveRoll | 无主动入口 | 阶段推进 | token 清空 | HP - min(rollCount - 1, 2) | rollCount=1 应为 0 | 阶段继续 | L2/L4 | 2026-05-17 已补上限 2 回归 |

## Treant 专属卡矩阵

| 对象 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
|---|---|---|---|---|---|---|---|---|---|---|
| `treant-card-trample` | 攻击修正 5 骰 | roll action immediate + attackBonus | 真实手牌 L3 | 通用打牌 | 1CP | 每树枝 +1；至少 +3 施加刺藤 | 骰面分支 | 奖励骰收口 | L3 | 已补真实手牌；骰子局部截图可见 |
| `upgrade-tend-care-2` | 升级细心呵护 | replaceAbility | 真实手牌 L3 | 通用打牌 | 2CP | replace | 无 | 能力表更新 | L3 | 已补逐卡升级入口 |
| `upgrade-rooted-2` | 升级扎根 | replace rooted | 真实手牌 L3 | 通用打牌 | 3CP | replace | 防御共享 Rooted | 能力表更新 | L3 | 已补逐卡升级入口 |
| `treant-card-drink-deep` | 获得生命源泉 | main choose player lifeSap | 真实手牌 L3 | 通用打牌 | 1CP | 所选玩家 lifeSap +1 | 目标选择 | 打牌清理 | L3 | 已补真实手牌选择窗 |
| `upgrade-shattering-fist-3` | 升级破碎之拳 III | replace | 真实手牌 L3 | 通用打牌 | 2CP | replace 到 `5/6/7 + 三同点养成1 + thorn` | 后续 thorn 代表覆盖 | 能力表更新 | L3 | 已补逐卡升级入口 |
| `treant-card-harvest` | 移除树灵得 CP，可给生命源泉 | main custom choice | 真实手牌 L3 | 通用打牌 | 0CP | 移除树灵、得 CP、选择生命源泉目标 | 数量/目标选择 | 打牌清理 | L3 | 已补真实手牌选择窗 |
| `treant-card-cultivate` | 养成 3 树灵 | main cultivate choice | 真实手牌 L3 | 通用打牌 | 3CP | 选择养成最终分布 | 上限 | 打牌清理 | L3 | 已补真实手牌选择窗 |
| `treant-card-downpour` | 养成所有现有树灵各一次 | main cultivate choice | 真实手牌 L3 | 通用打牌 | 2CP | 选择养成最终分布 | 上限 | 打牌清理 | L3 | 已补真实手牌结算 |
| `upgrade-nature-touch-2` | 升级自然之触 | replace | 真实手牌 L3 | 通用打牌 | 2CP | replace | 不可防御代表覆盖 | 能力表更新 | L3 | 已补逐卡升级入口 |
| `treant-card-soulfire` | 攻击修正 3 骰 | roll action immediate + attackBonus | 真实手牌 L3 | 通用打牌 | 1CP | 树枝附属伤害、树叶生命源泉、树灵养成 | 骰面分支 | 奖励骰收口 | L3 | 已补三骰面真实手牌链 |
| `treant-card-mother-tree` | 掷 1 骰，树灵或抽牌 | roll action immediate | 真实手牌 L3 | 通用打牌 | 0CP | 树灵分支养成4，否则抽1 | 两分支 | 打牌清理 | L3 | 已补树灵/非树灵两分支 |
| `upgrade-vengeful-vines-2` | 升级复仇枝蔓 | replace | 真实手牌 L3 | 通用打牌 | 2CP | replace | thorn 后续覆盖 | 能力表更新 | L3 | 已补逐卡升级入口 |
| `upgrade-wild-growth-2` | 升级野蛮生长 | replace | 真实手牌 L3 | 通用打牌 | 2CP | replace | 无 | 能力表更新 | L3 | 已补逐卡升级入口 |
| `upgrade-shattering-fist-2` | 升级破碎之拳 II | replace | 真实手牌 L3 | 通用打牌 | 1CP | replace 到 `5/6/7 + thorn`；卡图索引 30 | 无 | 能力表更新 | L3 | 已补逐卡升级入口 |
| `treant-card-planting` | 养成 3 树灵 | main cultivate choice | 真实手牌 L3 | 通用打牌 | 1CP | 选择养成最终分布 | 上限 | 打牌清理 | L3 | 已补真实手牌选择窗 |

## Ninja 重审矩阵

Ninja 已在 `evidence/dicethrone/dicethrone-ninja-full-flow-reaudit-2026-05-15.md` 建立完整矩阵。本轮复用该矩阵并纳入本轮循环结论：

- 四项用户指出回归已有专项 L2/L3：
  - `poison-blade` / `death-blossom` Ninja v2 槽位映射。
  - `blink` 防御时机。
  - 不可防御跳过防御 resolver。
  - `ninja-card-knife-fan` 主阶段行动牌时机。
- Token 复杂链路已有 L2/L4：`ninjutsu`、`smoke_bomb` 成功免伤与失败扣伤害分支、`delayed_poison` 回合结束。
- 仍不能宣称 Ninja 全对象全量 E2E：`ninja-card-training`、`ninja-card-poison-dart`、`ninja-card-knife-fan`、`ninja-card-shuriken`、`ninja-card-vanish`、`ninja-card-escape`、`ninja-card-dojo` 和 8 张升级卡已于 2026-05-17 追加真实手牌 L3（见 `dicethrone-ninja-main-action-real-hand-e2e-2026-05-17.md`、`dicethrone-ninja-upgrade-real-hand-e2e-2026-05-17.md`、`dicethrone-ninja-shuriken-vanish-real-hand-e2e-2026-05-17.md`、`dicethrone-ninja-escape-real-hand-e2e-2026-05-17.md`、`dicethrone-ninja-dojo-real-hand-e2e-2026-05-17.md`），`smoke_bomb` 失败分支已补真实 UI/E2E（见 `dicethrone-ninja-smoke-bomb-failure-e2e-2026-05-17.md`），但部分基础/升级技能本体仍缺专属 L3。

## 抽查全链路

| 抽查对象 | 审查链 | 结果 |
|---|---|---|
| Treant `rooted` | 真相源防御掷骰 → 静态 timing → defense resolver → phase advance → 防止伤害 / 双树叶养成 / 双树灵生命源泉目标 → 不可防御否定路径 | 旧反击/token 结论失效；2026-05-17 已修到 L2，缺新语义 L3 |
| Treant `life_sap` | token 主阶段入口 → passive custom → bonus die → heal → display-only settlement → 收口 | 既有 L2/L4 与截图链仍有效 |
| Ninja `ninjutsu` | beforeDamageDealt 响应窗 → token 消耗 → bonus die → 4/5 加伤或 6 点选择 → pendingDamage/pendingAttack 更新 → 收口 | 既有 L2/L4 与截图链仍有效 |
| Ninja `knife-fan` | 卡图主阶段语义 → `timing='main'` → offensiveRoll 否定 → direct unblockable damage 定义 → 主阶段真实手牌拖拽打出 → 对手 HP 30->29 且不打开 `pendingDamage` | 2026-05-17 已补真实打出 L3；offensiveRoll 否定仍由合同测试覆盖 |

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
- 顶部 Ninja HP 显示为 29，只能证明历史旧语义下的树枝反击曾生效；2026-05-17 后该截图不能再证明 Rooted 当前语义。
- Treant 状态区可见幼种/生命源泉图标；E2E 同时断言 `seedling=1`、`lifeSap=1`。

Rooted 不可防御路径：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-treant-ninja-mechanics.e2e\树精扎根防御应真实掷骰结算且不可防御时跳过\04-rooted-undefendable-after-advance.png`

肉眼观察：

- 顶部 Ninja HP 保持 30。
- Treant 状态没有新增幼种/生命源泉；E2E 同时断言二者均为 0。
- 证明 `pendingAttack.isDefendable=false` 时，即使挂着 `defenseAbilityId='rooted'` 也不会执行防御效果。

## 当前结论

- Treant/Ninja 已完成本轮“重审 + 抽查 + 发现问题后补规范再重审”的一个闭环。
- 本轮曾发现并修复 Treant `rooted` 防御时机错误；2026-05-17 又进一步修正了 Rooted 的图片语义（防止伤害 / 双树叶 / 双树灵），旧反击结论不再有效。
- 本轮补强了两条通用审计规范：同类 bug 扩审、多骰 E2E 使用 sequence。
- 两个新英雄仍不能被描述为“所有技能/token/卡牌分支 L4 全覆盖”；Ninja 已补 7 张专属行动卡与 8 张升级卡真实手牌 L3，Treant 已补 15 张专属卡逐卡真实手牌 L3，但两者部分基础/升级技能本体和组合分支仍按矩阵保留为 L2/代表性 L3 残余范围。
- 追加降级：Treant 玩家板图面合同未被本文件逐槽覆盖，因此本文件不能再作为 Treant “有图对象全部收口”的证明。

## 2026-05-15 追加降级：框架消费合同漏审

用户继续指出基础技能错误不应在“全面审计”后存在。复查确认，本文件此前仍缺少“框架消费合同反向审计”层，不能支撑“全面无遗漏”。

新增证据文档：

- `evidence/dicethrone/dicethrone-framework-contract-deep-audit-2026-05-15.md`

追加结论：

- Rooted / Blink 暴露的不是单点录入问题，而是 DiceThrone 防御 resolver 只消费 `withDamage/postDamage`，但 AbilityDef 类型允许 `immediate/preDefense`，旧审计没有从消费点反查字段合法性。
- 新增合同测试还命中旧英雄 Pyromancer `magma-armor` I/II/III，说明影响面超出 Treant/Ninja。
- 本文件所有“重审闭环”结论降级为：已完成一轮新增批次重审与部分共享根因修复；不得解释为 DiceThrone 新旧英雄全部基础技能已无遗漏。

## 2026-05-15 追加抽样深审：Token、手牌技能、基础技能

新增证据文档：

- `evidence/dicethrone/dicethrone-treant-ninja-sample-deep-audit-2026-05-15.md`

本轮继续抽查 Treant / Ninja 的 Token、手牌技能和基础技能，发现此前矩阵里仍有消费点漏审：

- `rooted-2`：旧矩阵写作“共享 rooted 合同，缺专属 L3”，该结论不够准确。实际防御 resolver 消费 `effects[0].action.diceCount`，旧实现虽然 `trigger.diceCount=4`，但仍继承基础 3 骰 effects。2026-05-17 后 Rooted / Rooted II 已改为共享 `treant-rooted-defense` custom action，并分别传入 3/4 骰合同，L2 合同测试覆盖 Rooted II 4 骰与双树灵生命源泉选择。
- `treant-card-trample`、`treant-card-soulfire`：旧结论不能只写“攻击修正卡 L1/L2，缺专属 E2E”。真实卡牌打出链只解析 `immediate`，旧 `withDamage` 导致打出后奖励骰加伤不会执行。现已改为 `immediate + resolutionMode: 'attackBonus'`，并于 2026-05-17 补真实手牌 L3。
- `treant-card-mother-tree`：旧“缺行为测试”已升级为 L2，已覆盖树灵分支与否则抽牌分支；2026-05-17 已补真实手牌 L3，覆盖树灵分支选择和非树灵抽牌。
- `quiet-cultivation`：旧“缺 L2/L3 专项”已升级为 L2，已覆盖 upkeep 进入时自动养成；仍缺真实流程 E2E。

因此，本文件此前“本轮循环结果”仍只能解释为多轮抽查与部分根因修复，不能升级为 Treant 全对象全端到端完成。
