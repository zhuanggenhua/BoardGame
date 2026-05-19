# DiceThrone Ninja 完整流程重审（2026-05-15）

> 2026-05-19 范围澄清：本文件只覆盖 `ninja` 这一个英雄的逐对象矩阵与失效回写。当前整批“新英雄补审”的总范围已按用户要求扩到 `gunslinger / samurai / treant / ninja` 四位，新英雄总范围请以 `evidence/dicethrone/dicethrone-new-factions-full-cycle-audit-2026-05-15.md` 与 `evidence/dicethrone/dicethrone-new-factions-reaudit-wiki-diff-2026-05-17.md` 为准；不能再把本文件的“Ninja 子范围”误读成整批补审范围。

## 本次重审结论

旧“全面审计完成”结论不成立。本次用户反馈证明旧审计只覆盖了“能进游戏、能触发代表路径、少量机制可收口”，没有对每个技能/Token/专属卡做完整生命周期矩阵。因此旧审计维度失效，必须降级为“代表链路审计”，不能继续作为 Ninja 全量完成证明。

本次已补强通用审计规则：

- `docs/ai-rules/testing-audit.md`：新增“技能/卡牌必须审查完整流程，禁止只测触发点”与通用技能完整流程矩阵。
- `.windsurf/skills/add-new-faction/SKILL.md`：新增派系/角色接入时，机制实现与审计 evidence 必须包含逐对象完整流程矩阵。

本次重审范围只覆盖 Ninja，不把 Treant 或共享 DiceThrone 系统重新宣称为已全面审计。

## 为什么旧审计漏掉

| 漏项 | 旧审计为什么会漏 | 新矩阵对应门禁 |
|---|---|---|
| 毒刃/死亡盛放贴图槽位错 | 只看到了技能可触发，没有核对“入口与贴图”和“点击后消费的 abilityId 是否一致” | 入口与贴图、命令与执行 |
| Blink 防御无效果 | 静态定义存在 `rollDie`，但没有核对防御结算阶段是否消费该 effect timing | 命令与执行、主效果、后续清理 |
| 不可防御后仍执行防御 | 只测了 Ninja 忍术不可防御分支，没有把它和防御 resolver 交叉验证 | 分支/否定路径、防御/不可防御交叉规则 |
| 刀扇时机错误 | 卡牌有图、有定义，但没有回到图片/卡牌类型核对 `timing` 和 `isAttackModifier` | 真相源语义、静态定义、候选生成 |

根本原因：旧流程把“代表 E2E 通过”外推成“全对象流程完成”。正确口径是：代表路径只能证明对应对象、对应阶段、对应分支，不能证明其它技能/卡牌/交叉规则。

## 2026-05-18 补审回写

这次漏审不是“维度再多加一点”就能解决，而是旧审计方法本身少了三道门禁：

1. **没先冻结 Ninja 对象全集**：旧文档虽然补了很多代表链，但没有把 `blink` / `blink-2` / 各升级版差异按独立对象逐行冻结，导致升级差异和对象特有语义被“同家族差不多”吞掉。
2. **把代表链外推成对象完成**：像 `slash-2`、`smoke-screen-2`、`death-blossom-2` 的真实入口证据，本来只能证明各自共享入口或共享收口，不应外推成 `blink` 这类不同语义对象也已全面审完。
3. **没从框架消费点反查到真实合同**：旧结论停在“定义里有 `withDamage` / `rollDie`，E2E 最终 HP 也变了”，却没有继续反查 `defensiveRoll -> resolveAttack -> effect/customAction` 究竟消费的是“防御投已出骰面”还是“额外奖励骰/共享 rollDie 语义”。这正是本轮 `blink` 被再次推翻的直接根因。

据此，本文件当前把 `blink` / `blink-2` 明确降回 **L2 合同层**：规则文本、录入合同、领域行为测试和实现入口已对齐；但新的**真防御 L3 截图链仍待补**，所以不能再沿用 2026-05-14 的旧 L3 收口口径。

2026-05-18 实测：

```powershell
npx vitest run src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts --configLoader native --maxWorkers 1
```

结果：`1 file passed / 6 tests passed`。其中新增覆盖 `blink` 基础版与 `blink-2` 的防御投骰面合同。

## 证据层级说明

- L1：静态定义、i18n、资源、图集、注册表已核对。
- L2：领域单测/合同测试验证权威状态。
- L3：真实 UI/E2E 入口验证。
- L4：复杂响应窗、奖励骰、选择分支、跨阶段或回合结束闭环。

## 技能完整流程矩阵

| 对象 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
|---|---|---|---|---|---|---|---|---|---|---|
| `slash` | 面板：3/4/5 忍刀伤害 | `abilities.ts` variants 5/6/7 | 依赖通用骰面候选；`fist` 槽共享升级入口已测 | 通用 ability activate | N/A | 通用 damage | 无分支 | 通用攻击流程 | L1/L3 代表 | 基础版未单独逐骰面 E2E；`slash-2` 已证明同槽真实入口与 `sourceAbilityId` |
| `slash-2` | 升级卡：斩击 II | `SLASH_2` variants 6/7/8 | 升级后 `fist` 槽真实可点 | `SELECT_ABILITY` 写入 `sourceAbilityId=slash-2-5` | 升级卡替换 | 通用 damage | 防御分支未展开 | `pendingAttack` 创建正常 | L3 入口 | 真实玩家板槽位入口已补；不外推防御后全分支 |
| `going-forward` | 面板：4 手里剑 7 伤害 | `diceSet shuriken=4` | 通用候选；`chi` 槽共享升级入口已测 | 通用 ability activate | N/A | damage 7 | 无分支 | 通用攻击流程 | L1/L3 代表 | 基础版未单独逐骰面 E2E；升级槽位入口已补 |
| `going-forward-2` | 升级卡：一往无前 II | `GOING_FORWARD_2` 复用基础定义 | 升级后 `chi` 槽真实可点 | `SELECT_ABILITY` 写入 `sourceAbilityId=going-forward` | 升级卡替换 | 当前实现未提高数值 | 防御分支未展开 | `pendingAttack` 创建正常 | L3 入口 | 真实玩家板槽位入口已补；仍需后续核图片确认 II 级是否应变化 |
| `poison-blade` | 面板：小顺子，慢性中毒 + 伤害 | `smallStraight`，grant poison，damage 5 | Ninja v2 槽位 `combo` | E2E 点击槽位后 `pendingAttack.sourceAbilityId='poison-blade'` | N/A | token + damage | 防御仍可触发 | 攻击 pending 进入通用流程 | L2/L3 | 四项回归内已审，槽位与入口已修 |
| `poison-blade-2` | 升级：慢性中毒 + 不可防御伤害 | tags unblockable，damage 6 | 升级后 `combo` 槽真实可点 | `SELECT_ABILITY` 写入 `sourceAbilityId=poison-blade` | 升级卡替换 | 对手 HP 30->24，慢性中毒 1 | 不可防御跳过防御 | `pendingAttack` 清空，可继续推进 | L3 | 真实玩家板槽位入口与结算已补 |
| `shadow-step` | 面板：4 面具，烟雾弹、慢性中毒、不可防御伤害 | smoke + poison + unblockable damage 6 | 通用候选；`lotus` 槽共享升级入口已测 | 通用 ability activate；旧全局别名已收敛 | N/A | token + damage | 不可防御代表覆盖 | 通用攻击流程 | L1/L3 代表 | 基础版未单独逐骰面 E2E；升级真实入口证明不再误跳 Moon Elf `elusive-step` |
| `shadow-step-2` | 升级：慢性中毒 2、伤害 7 | smoke + poison 2 + unblockable damage 7 | 升级后 `lotus` 槽真实可点 | `sourceAbilityId=shadow-step` | 升级卡替换 | 对手 HP 30->23，烟雾弹 1，慢性中毒 2 | 不可防御跳过防御 | `pendingAttack` 清空，可继续推进 | L3 | 真实玩家板入口与不可防御结算已补 |
| `death-blossom` | 面板：忍刀/手里剑加伤，面具给忍术 | `rollDie 5` withDamage conditional | Ninja v2 槽位 `sky`；共享升级入口已测 | E2E 点击槽位后 `pendingAttack.sourceAbilityId='death-blossom'` | N/A | 奖励骰 conditional | 结果分支由通用 rollDie 处理 | 奖励骰 settlement | L2/L3 | 槽位已审；升级版已补奖励骰特写与收口代表链 |
| `death-blossom-2` | 升级：死亡盛放 II | 当前 `DEATH_BLOSSOM_2` 复用基础定义 | 升级后 `sky` 槽真实可点 | `sourceAbilityId=death-blossom` | 升级卡替换 | 奖励骰特写出现，收口后忍术 +1 | 使用潜行免防路径证明奖励骰 UI 与 token 结果 | `pendingBonusDiceSettlement` 与 `pendingAttack` 清空 | L3 | 真实玩家板入口、奖励骰本体与收口已补；不外推所有骰面组合 |
| `smoke-screen` | 面板：获得烟雾弹/忍术并给慢性中毒 | grant smoke 1/ninjutsu 2/poison 1，`type='utility'` | 通用候选；`lightning` 槽共享升级入口已测 | 通用 ability activate；`offensiveRoll` 已允许 utility | N/A | token grant | 无选择 | token 后续由各 token 流程覆盖 | L1/L3 代表 | 基础版未单独 E2E；升级版证明 utility 不再被过滤 |
| `smoke-screen-2` | 升级：忍术 3 | grant smoke 1/ninjutsu 3/poison 1 | 升级后 `lightning` 槽真实可点 | `sourceAbilityId=smoke-screen` | 升级卡替换 | 烟雾弹 1、忍术 3、慢性中毒 1，HP 不变 | 非伤害 utility 不进入防御 | `pendingAttack` 清空，可继续推进 | L3 | 真实玩家板入口与 utility 结算已补 |
| `shadow-fang` | 面板：大顺子，忍术 2 + 8 伤害 | `largeStraight`，ninjutsu 2，damage 8 | 通用候选；`calm` 槽共享升级入口已测 | 通用 ability activate | N/A | token + damage | 无分支 | 通用攻击流程 | L1/L3 代表 | 基础版未单独 E2E；升级槽位入口已补 |
| `shadow-fang-2` | 升级：忍术 2 + 9 伤害 | `largeStraight`，ninjutsu 2，damage 9 | 升级后 `calm` 槽真实可点 | `sourceAbilityId=shadow-fang` | 升级卡替换 | 主效果由通用攻击结算层覆盖 | 防御分支未展开 | `pendingAttack` 创建正常 | L3 入口 | 真实玩家板槽位入口已补；不外推防御后全分支 |
| `blink` | 防御：掷 3 骰；若投出忍刀，造成 1 伤害；若投出手里剑，造成 2 伤害；若投出面具，获得烟雾弹 | `defensiveRoll` + 读取防御投已出骰面；不额外奖励骰 | 防御阶段 pendingAttack | `resolveAttack` 调用 `ninja-blink` | N/A | 当前 L2 合同：`1/4/6` 时攻击者 HP -3、防御者烟雾弹 +1 | `isDefendable=false` 跳过 | 防御事件后攻击流程继续 | L2 | 2026-05-18 证实旧“累计奖励骰反击”结论失效，需后续补新的 L3 真防御截图链 |
| `blink-2` | 升级：瞬身 II；忍刀按数量造成伤害，手里剑固定 2 伤害，2 面具给烟雾弹 | 升级后使用独立 `ninja-blink-2`，不再复用基础定义 | 升级后防御入口 | `resolveAttack` | 升级卡替换 | 当前 L2 合同：`1/2/4` 时攻击者 HP -4；`1/6/6` 时攻击者 HP -1 且防御者烟雾弹 +1 | 同上 | 攻击流程继续 | L2 | 2026-05-18 按 `Ablilitycards.png` 修正；旧“同基础定义”结论失效 |
| `ninja-assassinate` | 终极技：慢性中毒 2、烟雾弹、10 伤害 | mask 5，poison 2，smoke 1，damage 10 | `ultimate` 槽真实可点 | `sourceAbilityId=ninja-assassinate` | N/A | 对手 HP 30->20，慢性中毒 2，烟雾弹 1 | 终极不可防御 | `pendingAttack` 清空，可继续推进 | L3 | 真实玩家板终极槽结算已补 |

## Token / 状态完整流程矩阵

| 对象 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
|---|---|---|---|---|---|---|---|---|---|---|
| `delayed_poison` | 提示板：回合结束每层 3 伤害并移除 | debuff，上限 2，`onTurnEnd` | 无玩家主动入口 | `flowHooks.onPhaseExit` | 回合结束移除 | HP - stacks*3 | 多层按层结算 | token 归零 | L2/L4 | 已有单测与 E2E 回合结束链 |
| `ninjutsu` 1-3/4-5 | 提示板：造成伤害前花费，掷骰加伤 | activeUse beforeDamageDealt，consume 1 | 攻击方响应窗 | `USE_TOKEN` -> custom action | token -1 | +1 或 +2 写入 `pendingDamage` 与 `pendingAttack.bonusDamage` | 1-3/4-5 分支 | 特写收口后流程继续 | L2/L4 | 已覆盖 |
| `ninjutsu` 6 慢性中毒 | 同上，6 点选择慢性中毒或不可防御 | choice handler | 选择弹窗 | choice resolved | token 已消耗 | +2 + poison | 慢性中毒分支 | choice 清理，后续回合结束 poison | L2/L4 | 已覆盖 |
| `ninjutsu` 6 不可防御 | 同上 | choice handler | 选择弹窗 | choice resolved | token 已消耗 | +2 + attack undefendable | 不可防御后跳过防御 | choice 清理，攻击继续 | L2/L4 | 已覆盖 |
| `smoke_bomb` | 提示板：受伤前花费，1-3 避免伤害 | activeUse beforeDamageReceived，consume 1 | 防御方响应窗 | `USE_TOKEN` | token -1 | 成功时 `pendingDamage` 清空/evaded | 失败骰面消耗 token、保留伤害 | 成功/失败后均可收口 | L4 | 成功免伤与失败扣伤害分支均已有真实 UI/E2E |

## 专属卡完整流程矩阵

| 对象 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
|---|---|---|---|---|---|---|---|---|---|---|
| `ninja-card-training` | 卡图：0CP 主要阶段，获得忍术 | main action，grant ninjutsu 1 | main 阶段真实手牌 E2E 已覆盖 | 通用打牌 | 0CP | token +1 | 无 | 通用打牌清理 | L3 | 真实手牌打出、手牌消耗、`ninjutsu=1` 已覆盖 |
| `upgrade-blink-2` | 卡图：升级瞬身 | upgrade 2CP replace blink | main 阶段真实手牌 E2E 已覆盖 | 通用打牌 | 2CP | replaceAbility | 无 | 升级后能力表更新 | L3 | 真实手牌打出、CP 5->3、`abilityLevels.blink=2` 与 `upgradeCardByAbilityId.blink` 已覆盖 |
| `upgrade-going-forward-2` | 卡图：升级一往无前 | upgrade 2CP replace | main 阶段真实手牌 E2E 已覆盖 | 通用打牌 | 2CP | replaceAbility | 无 | 能力表更新 | L3 | 真实手牌打出、CP 5->3、`abilityLevels.going-forward=2` 与升级卡记录已覆盖 |
| `upgrade-slash-2` | 卡图：升级斩击 | upgrade 2CP replace | main 阶段真实手牌 E2E 已覆盖 | 通用打牌 | 2CP | replaceAbility | 无 | 能力表更新 | L3 | 真实手牌打出、CP 5->3、`abilityLevels.slash=2` 与升级卡记录已覆盖 |
| `upgrade-shadow-step-2` | 卡图：升级暗影步 | upgrade 2CP replace | main 阶段真实手牌 E2E 已覆盖 | 通用打牌 | 2CP | replaceAbility | 无 | 能力表更新 | L3 | 真实手牌打出、CP 5->3、`abilityLevels.shadow-step=2` 与升级卡记录已覆盖；后续 token 代表覆盖 |
| `ninja-card-shuriken` | 卡图：攻击修正，投 5 骰，每忍刀 +1 | roll action，isAttackModifier | roll 阶段真实手牌 E2E 已覆盖 | 通用打牌 + reward dice | 1CP | bonusDamage / attackModifierBonusDamage | 5 骰中 3 忍刀分支已测 | 特写收口后 `pendingBonusDiceSettlement` 清空 | L3 | 真实手牌、奖励骰特写、CP/手牌消耗、收口后攻击修正 +3 已覆盖 |
| `ninja-card-escape` | 卡图：被攻击后即时，减伤/烟雾弹 | instant，pendingDamage target | 受击 afterAttackResolved 响应窗真实手牌 E2E 已覆盖 | 通用打牌 + rollDie | 0CP | 手里剑骰面授 2 点护盾 | 手里剑减伤分支已测；烟雾弹分支由 smoke 后续代表覆盖 | `SKIP_TOKEN_RESPONSE` 后伤害收口 | L3 | 真实响应窗手牌、奖励骰本体、手牌消耗、护盾写入与伤害收口已覆盖 |
| `ninja-card-poison-dart` | 卡图：2CP 主要阶段，给慢性中毒 | main，grant poison 2 | main 阶段真实手牌 E2E 已覆盖 | 通用打牌 | 2CP | poison +2 | 上限 2 | 回合结束 poison 清理 | L3 | 真实手牌打出、CP 3->1、对手 `delayed_poison=2` 已覆盖 |
| `ninja-card-knife-fan` | 卡图：2CP 主要阶段，1 不可防御伤害 | main action，direct unblockable damage 1 | main 阶段真实手牌 E2E 已覆盖；offensiveRoll 否定由合同测试覆盖 | 通用打牌 | 2CP | direct damage | roll 阶段否定已测 | 通用打牌清理 | L3 | 真实手牌打出、CP 3->1、对手 HP 30->29、`pendingDamage` 未打开已覆盖 |
| `upgrade-smoke-screen-2` | 卡图：升级烟雾阵 | upgrade 2CP replace | main 阶段真实手牌 E2E 已覆盖 | 通用打牌 | 2CP | replaceAbility | 无 | 能力表更新 | L3 | 真实手牌打出、CP 5->3、`abilityLevels.smoke-screen=2` 与升级卡记录已覆盖；后续 token 代表覆盖 |
| `upgrade-shadow-fang-2` | 卡图：升级影牙 | upgrade 2CP replace | main 阶段真实手牌 E2E 已覆盖 | 通用打牌 | 2CP | replaceAbility | 无 | 能力表更新 | L3 | 真实手牌打出、CP 5->3、`abilityLevels.shadow-fang=2` 与升级卡记录已覆盖；后续 token 代表覆盖 |
| `upgrade-poison-blade-2` | 卡图：升级毒刃 | upgrade 2CP replace | main 阶段真实手牌 E2E 已覆盖 | 通用打牌 | 2CP | replaceAbility | 无 | 能力表更新 | L3 | 真实手牌打出、CP 5->3、`abilityLevels.poison-blade=2` 与升级卡记录已覆盖；后续 poison/不可防御代表覆盖 |
| `upgrade-death-blossom-2` | 卡图：升级死亡盛放 | upgrade 2CP replace | main 阶段真实手牌 E2E 已覆盖 | 通用打牌 | 2CP | replaceAbility | 无 | 能力表更新 | L3 | 真实手牌打出、CP 5->3、`abilityLevels.death-blossom=2` 与升级卡记录已覆盖 |
| `ninja-card-vanish` | 卡图：0CP 即时，获得烟雾弹 | instant，grant smoke 1 | 真实手牌 E2E 已覆盖 | 通用打牌 | 0CP | smoke +1 | 无 | 通用打牌清理 | L3 | 真实手牌打出、手牌消耗、烟雾弹写入已覆盖 |
| `ninja-card-dojo` | 卡图：0CP 主要阶段，投 1 骰；面具=>烟雾弹+2 忍术；否则抽 1 | main，rollDie 1；mask 分支 grant smoke/ninjutsu；default draw 1 | main 阶段真实手牌 E2E 已覆盖 | 通用打牌后解析 immediate rollDie | 0CP | mask 分支 token grant；非 mask 抽牌 | 骰面成功/失败分支均有截图链 | 奖励骰 settlement 后通用打牌清理 | L3 | 2026-05-17 修复旧“直接给 token”假阳性；两分支 L2 + 真实手牌 L3 已补 |

## 当前可确认的已覆盖项

- 四项用户指出回归已有独立审计：`evidence/dicethrone/dicethrone-ninja-regression-audit-2026-05-14.md`。
- Token 复杂链路已有代表覆盖：`ninjutsu` 奖励骰与 6 点选择、`smoke_bomb` 成功免伤与失败分支、`delayed_poison` 回合结束。
- `ninja-card-knife-fan` 时机合同已有 L2 覆盖：main 可打，offensiveRoll 不可打；2026-05-17 又补真实主阶段手牌 L3，证明 direct unblockable damage 1 会扣对手 HP。
- `blink` / `blink-2` 当前最新权威口径已回到 `src/games/dicethrone/rule/ninja录入核对.md` 与 `src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts`：基础版读取防御投已出骰面后按“忍刀 +1 伤害 / 手里剑 +2 伤害 / 面具给烟雾弹”结算；II 级按“忍刀数量伤害 / 任一手里剑 +2 / 两个面具给烟雾弹”结算。对应实现入口为 `src/games/dicethrone/heroes/ninja/abilities.ts` 与 `src/games/dicethrone/domain/customActions/ninja.ts`。

## 仍不能宣称完成的范围

- 基础/升级技能本体已补一组真实玩家板代表链：`slash-2`、`going-forward-2`、`shadow-step-2`、`smoke-screen-2`、`shadow-fang-2`、`poison-blade-2`、`death-blossom-2`、`ninja-assassinate`。但其中 `slash-2`、`going-forward-2`、`shadow-fang-2` 只证明槽位入口与 `sourceAbilityId`，未逐技能展开防御后伤害结算。
- 8 张 Ninja 升级卡已补真实手牌打出与 `abilityLevels / upgradeCardByAbilityId` 写入 L3；升级后的技能本体也有代表性 L3，但不等于每个基础版、每个升级版、每种骰面组合和所有防御/响应/减伤分支都达到 L4。
- `ninja-card-escape` 已补受击响应窗真实手牌 L3 截图链。
- `ninja-card-dojo` 已补真实手牌打出、奖励骰、面具成功、非面具抽牌和收口截图链，但该单卡 L3 不能外推升级卡或基础/升级技能本体。
- `ninja-card-training`、`ninja-card-poison-dart`、`ninja-card-knife-fan`、`ninja-card-shuriken`、`ninja-card-vanish`、`ninja-card-escape` 与 8 张升级卡已补真实手牌 L3，但不能外推基础/升级技能本体的所有骰面与分支。
- `smoke_bomb` 失败骰面分支已补真实 UI/E2E；当前证明失败会消耗 token、保留 `pendingDamage`，跳过响应后 HP 30->23。
- 若后续要宣称 Ninja 全量收口，必须补齐上述对象或明确按发布范围冻结；不能再用代表路径替代。

## 本次重审状态

当前状态：重审矩阵已建立，旧“全面审计完成”已降级。Ninja 四项回归已在专项 evidence 中有 L2/L3 证据，但 Ninja 全对象仍存在未覆盖项，因此不能写“全量新机制新交互都已端到端”。

补审后的更精确口径：

- `poison-blade`、`death-blossom` 槽位问题、`smoke-screen` utility 入口、`shadow-step` 别名问题、`knife-fan` 时机问题都已有各自 L2/L3 证据。
- `blink` / `blink-2` 的**规则语义**已通过 2026-05-18 的录入回写与合同测试重新对齐，但**真实防御入口 L3** 需要按“防御投本体出现 -> 伤害/烟雾弹变化 -> 收口可继续推进”的新截图链另补，旧 `withDamage` 口径不得再复用。

## 2026-05-15 追加抽样深审：Token 与手牌卡消费点

新增证据文档：

- `evidence/dicethrone/dicethrone-treant-ninja-sample-deep-audit-2026-05-15.md`

本轮抽样深审修订本文件部分结论：

- `ninja-card-shuriken`：旧矩阵写“缺专属卡奖励骰 E2E / L1”，但实际问题比“缺 E2E”更严重。旧实现使用 `timing: 'withDamage'`，而 `PLAY_CARD` 只解析 `immediate`，导致卡牌打出后奖励骰加伤不执行。现已改为 `immediate + resolutionMode: 'attackBonus'`，并补 L2 行为测试；2026-05-17 追加真实手牌 L3，覆盖打出、奖励骰特写、CP/手牌消耗、收口后 `bonusDamage=3` 与 `attackModifierBonusDamage=3`。
  - 真实入口命令：`npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者手里剑应通过真实手牌打出并在奖励骰收口后计入攻击修正"`，2026-05-17 实测 `1 passed`。
  - 截图证据：`evidence/dicethrone/dicethrone-ninja-shuriken-vanish-real-hand-e2e-2026-05-17.md`。
- `ninja-card-escape`：已补 L2 行为覆盖，证明受击响应窗可打，护盾抵消后续结算伤害；2026-05-17 追加真实受击响应窗手牌 L3，覆盖可拖拽态、奖励骰本体、手牌消耗、护盾写入与 `SKIP_TOKEN_RESPONSE` 后 HP=25 / `pendingDamage` 清空。
  - 真实入口命令：`npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者脱身应通过受击响应窗真实手牌打出并结算减伤奖励骰"`，2026-05-17 实测 `1 passed`。
  - 截图证据：`evidence/dicethrone/dicethrone-ninja-escape-real-hand-e2e-2026-05-17.md`。
- `smoke_bomb` 失败分支：已补 L2 行为覆盖；2026-05-17 又追加真实 UI/E2E，证明失败骰面消耗 token 但不关闭 pendingDamage、不提前扣 HP，随后跳过响应后正常结算 7 点伤害。
  - 真实入口命令：`npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者烟雾弹失败骰面应消耗 token 但保留伤害并可继续结算"`，2026-05-17 实测 `1 passed`。
  - 截图证据：`evidence/dicethrone/dicethrone-ninja-smoke-bomb-failure-e2e-2026-05-17.md`。
- `ninja-card-dojo`：2026-05-17 重审发现旧矩阵和实现把卡图/Wiki 的“投 1 骰；面具成功，否则抽 1”误录成直接获得烟雾弹与 2 忍术。现已改为 `rollDie + conditionalEffects/defaultEffect`，并补 L2 覆盖 mask 成功分支与非 mask 抽牌分支；随后补 L3 真实手牌 E2E，覆盖打出、奖励骰特写、面具成功、非面具抽牌和收口。
  - 验证命令：`npx vitest run src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts --configLoader native --maxWorkers 1`，2026-05-17 实测 `5/5` 通过。
  - 真实入口命令：`npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者道场应通过真实手牌打出并按骰面分支结算"`，2026-05-17 实测 `1 passed`。
  - 截图证据：`evidence/dicethrone/dicethrone-ninja-dojo-real-hand-e2e-2026-05-17.md`。
- `ninja-card-vanish`：2026-05-17 追加真实手牌 L3，覆盖打出、手牌消耗和 `smoke_bomb=1`。
  - 真实入口命令：`npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者雾隐应通过真实手牌打出并获得烟雾弹"`，2026-05-17 实测 `1 passed`。
  - 截图证据：`evidence/dicethrone/dicethrone-ninja-shuriken-vanish-real-hand-e2e-2026-05-17.md`。
- `ninja-card-training` / `ninja-card-poison-dart` / `ninja-card-knife-fan`：2026-05-17 追加真实主阶段手牌 L3，覆盖可拖拽态、打出、手牌消耗、CP 消耗与权威状态写入。训练写入 `ninjutsu=1`；毒镖写入对手 `delayed_poison=2`；刀扇造成 1 点直接不可防御伤害且不打开 `pendingDamage`。
  - 真实入口命令：`npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者训练毒镖刀扇应通过真实手牌主阶段打出并结算"`，2026-05-17 实测 `1 passed`。
  - 截图证据：`evidence/dicethrone/dicethrone-ninja-main-action-real-hand-e2e-2026-05-17.md`。
- Ninja 8 张升级卡：2026-05-17 追加真实主阶段手牌 L3，逐张覆盖可拖拽态、打出、CP 5->3、手牌消耗、`abilityLevels` 写入和 `upgradeCardByAbilityId` 记录。
  - 真实入口命令：`npm run test:e2e:ci:file -- dicethrone-treant-ninja-mechanics.e2e.ts "忍者升级卡应通过真实手牌逐张升级到正确技能"`，2026-05-17 实测 `1 passed`。
  - 截图证据：`evidence/dicethrone/dicethrone-ninja-upgrade-real-hand-e2e-2026-05-17.md`。
- Ninja 技能本体真实玩家板入口：2026-05-17 追加独立 E2E，覆盖升级技能槽位入口、不可防御结算、utility 结算、终极结算与 Death Blossom II 奖励骰特写/收口；同时修复 `shadow-step` 全局误别名到 Moon Elf `elusive-step`，以及 `offensiveRoll` 过滤 `utility` 导致 `smoke-screen` 不可选的问题。
  - 验证命令：`npm run test:e2e:ci -- e2e/dicethrone/dicethrone-ninja-ability-real-entry.e2e.ts`，2026-05-17 实测 `3 passed`。
  - 配套验证：`npx vitest run src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts src/games/dicethrone/__tests__/moon-elf-abilities.test.ts --configLoader native --maxWorkers 1`，2026-05-17 实测 `40 tests passed`。
  - 截图证据：`evidence/dicethrone/dicethrone-ninja-ability-real-entry-e2e-2026-05-17.md`。

本轮追加结论不改变主口径：Ninja 仍不能被描述为全对象全交互端到端完成。
