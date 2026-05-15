# DiceThrone Ninja 完整流程重审（2026-05-15）

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

## 证据层级说明

- L1：静态定义、i18n、资源、图集、注册表已核对。
- L2：领域单测/合同测试验证权威状态。
- L3：真实 UI/E2E 入口验证。
- L4：复杂响应窗、奖励骰、选择分支、跨阶段或回合结束闭环。

## 技能完整流程矩阵

| 对象 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
|---|---|---|---|---|---|---|---|---|---|---|
| `slash` | 面板：3/4/5 忍刀伤害 | `abilities.ts` variants 5/6/7 | 依赖通用骰面候选 | 通用 ability activate | N/A | 通用 damage | 无分支 | 通用攻击流程 | L1 | 仅静态矩阵，不得写全流程已审 |
| `slash-2` | 升级卡：斩击 II | `SLASH_2` variants 6/7/8 | 依赖升级后通用候选 | 通用 ability activate | 升级卡替换 | 通用 damage | 无分支 | 通用攻击流程 | L1 | 仅静态矩阵 |
| `going-forward` | 面板：4 手里剑 7 伤害 | `diceSet shuriken=4` | 通用候选 | 通用 ability activate | N/A | damage 7 | 无分支 | 通用攻击流程 | L1 | 仅静态矩阵 |
| `going-forward-2` | 升级卡：一往无前 II | `GOING_FORWARD_2` 复用基础定义 | 升级后通用候选 | 通用 ability activate | 升级卡替换 | 当前实现未提高数值 | 无分支 | 通用攻击流程 | L1 | 需要后续核图片确认 II 级是否应变化 |
| `poison-blade` | 面板：小顺子，慢性中毒 + 伤害 | `smallStraight`，grant poison，damage 5 | Ninja v2 槽位 `combo` | E2E 点击槽位后 `pendingAttack.sourceAbilityId='poison-blade'` | N/A | token + damage | 防御仍可触发 | 攻击 pending 进入通用流程 | L2/L3 | 四项回归内已审，槽位与入口已修 |
| `poison-blade-2` | 升级：慢性中毒 + 不可防御伤害 | tags unblockable，damage 6 | 升级后候选 | 通用 ability activate | 升级卡替换 | poison + unblockable damage | 不可防御交叉规则已有代表覆盖 | 通用攻击流程 | L1/L2 | 静态与交叉代表覆盖，不是逐技能 E2E |
| `shadow-step` | 面板：4 面具，烟雾弹、慢性中毒、不可防御伤害 | smoke + poison + unblockable damage 6 | 通用候选 | 通用 ability activate | N/A | token + damage | 不可防御代表覆盖 | 通用攻击流程 | L1/L2 | token 后续有覆盖，技能本体缺 L3 |
| `shadow-step-2` | 升级：慢性中毒 2、伤害 7 | smoke + poison 2 + unblockable damage 7 | 升级后候选 | 通用 ability activate | 升级卡替换 | token + damage | 不可防御代表覆盖 | 通用攻击流程 | L1/L2 | 技能本体缺 L3 |
| `death-blossom` | 面板：忍刀/手里剑加伤，面具给忍术 | `rollDie 5` withDamage conditional | Ninja v2 槽位 `sky` | E2E 点击槽位后 `pendingAttack.sourceAbilityId='death-blossom'` | N/A | 奖励骰 conditional | 结果分支由通用 rollDie 处理 | 奖励骰 settlement | L2/L3 | 槽位已审；奖励骰结果缺专属 E2E |
| `death-blossom-2` | 升级：死亡盛放 II | 当前 `DEATH_BLOSSOM_2` 复用基础定义 | 升级后候选 | 通用 ability activate | 升级卡替换 | 同基础定义 | 同基础定义 | 奖励骰 settlement | L1 | 需要后续核图片确认 II 级差异 |
| `smoke-screen` | 面板：获得烟雾弹/忍术并给慢性中毒 | grant smoke 1/ninjutsu 2/poison 1 | 通用候选 | 通用 ability activate | N/A | token grant | 无选择 | token 后续由各 token 流程覆盖 | L1/L2 | token 后续有覆盖，技能本体缺 L3 |
| `smoke-screen-2` | 升级：忍术 3 | grant smoke 1/ninjutsu 3/poison 1 | 升级后候选 | 通用 ability activate | 升级卡替换 | token grant | 无选择 | token 后续由各 token 流程覆盖 | L1/L2 | 技能本体缺 L3 |
| `shadow-fang` | 面板：大顺子，忍术 2 + 8 伤害 | `largeStraight`，ninjutsu 2，damage 8 | 通用候选 | 通用 ability activate | N/A | token + damage | 无分支 | 通用攻击流程 | L1/L2 | token 后续有覆盖，技能本体缺 L3 |
| `shadow-fang-2` | 升级：忍术 2 + 9 伤害 | `largeStraight`，ninjutsu 2，damage 9 | 升级后候选 | 通用 ability activate | 升级卡替换 | token + damage | 无分支 | 通用攻击流程 | L1/L2 | 技能本体缺 L3 |
| `blink` | 防御：掷 3 骰，忍刀/手里剑反击，面具烟雾弹 | `defensiveRoll` + `timing='withDamage'` | 防御阶段 pendingAttack | `resolveAttack` 调用防御效果 | N/A | 攻击者 HP -3，防御者烟雾弹 +1 | `isDefendable=false` 跳过 | 防御事件后攻击流程继续 | L2/L3 | 四项回归内已审 |
| `blink-2` | 升级：瞬身 II | 当前 `BLINK_2` 复用基础定义 | 升级后防御入口 | `resolveAttack` | 升级卡替换 | 同基础定义 | 同基础定义 | 攻击流程继续 | L1 | 需要后续核图片确认 II 级差异 |
| `ninja-assassinate` | 终极技：慢性中毒 2、烟雾弹、10 伤害 | mask 5，poison 2，smoke 1，damage 10 | 通用候选 | 通用 ability activate | N/A | token + damage | 无选择 | 通用攻击流程 | L1/L2 | token 后续有覆盖，终极技本体缺 L3 |

## Token / 状态完整流程矩阵

| 对象 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
|---|---|---|---|---|---|---|---|---|---|---|
| `delayed_poison` | 提示板：回合结束每层 3 伤害并移除 | debuff，上限 2，`onTurnEnd` | 无玩家主动入口 | `flowHooks.onPhaseExit` | 回合结束移除 | HP - stacks*3 | 多层按层结算 | token 归零 | L2/L4 | 已有单测与 E2E 回合结束链 |
| `ninjutsu` 1-3/4-5 | 提示板：造成伤害前花费，掷骰加伤 | activeUse beforeDamageDealt，consume 1 | 攻击方响应窗 | `USE_TOKEN` -> custom action | token -1 | +1 或 +2 写入 `pendingDamage` 与 `pendingAttack.bonusDamage` | 1-3/4-5 分支 | 特写收口后流程继续 | L2/L4 | 已覆盖 |
| `ninjutsu` 6 慢性中毒 | 同上，6 点选择慢性中毒或不可防御 | choice handler | 选择弹窗 | choice resolved | token 已消耗 | +2 + poison | 慢性中毒分支 | choice 清理，后续回合结束 poison | L2/L4 | 已覆盖 |
| `ninjutsu` 6 不可防御 | 同上 | choice handler | 选择弹窗 | choice resolved | token 已消耗 | +2 + attack undefendable | 不可防御后跳过防御 | choice 清理，攻击继续 | L2/L4 | 已覆盖 |
| `smoke_bomb` | 提示板：受伤前花费，1-3 避免伤害 | activeUse beforeDamageReceived，consume 1 | 防御方响应窗 | `USE_TOKEN` | token -1 | 成功时 `pendingDamage` 清空/evaded | 失败分支未形成 E2E | 响应窗收口 | L2/L4 | 成功路径已覆盖，失败分支仍缺 E2E |

## 专属卡完整流程矩阵

| 对象 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
|---|---|---|---|---|---|---|---|---|---|---|
| `ninja-card-training` | 卡图：0CP 主要阶段，获得忍术 | main action，grant ninjutsu 1 | main 阶段手牌候选未逐卡 E2E | 通用打牌 | 0CP | token +1 | 无 | 通用打牌清理 | L1/L2 | token 后续有覆盖，逐卡打出缺 L3 |
| `upgrade-blink-2` | 卡图：升级瞬身 | upgrade 2CP replace blink | main 阶段手牌候选未逐卡 E2E | 通用打牌 | 2CP | replaceAbility | 无 | 升级后能力表更新 | L1 | 缺逐卡执行验证 |
| `upgrade-going-forward-2` | 卡图：升级一往无前 | upgrade 2CP replace | 同上 | 通用打牌 | 2CP | replaceAbility | 无 | 能力表更新 | L1 | 缺逐卡执行验证 |
| `upgrade-slash-2` | 卡图：升级斩击 | upgrade 2CP replace | 同上 | 通用打牌 | 2CP | replaceAbility | 无 | 能力表更新 | L1 | 缺逐卡执行验证 |
| `upgrade-shadow-step-2` | 卡图：升级暗影步 | upgrade 2CP replace | 同上 | 通用打牌 | 2CP | replaceAbility | 无 | 能力表更新 | L1/L2 | 后续 token 代表覆盖，逐卡缺 L3 |
| `ninja-card-shuriken` | 卡图：攻击修正，投 5 骰，每忍刀 +1 | roll action，isAttackModifier | roll 阶段手牌候选未逐卡 E2E | 通用打牌 + reward dice | 1CP | bonusDamage | 骰面分支 | 特写收口 | L1 | 缺专属卡奖励骰 E2E |
| `ninja-card-escape` | 卡图：被攻击后即时，减伤/烟雾弹 | instant，pendingDamage target | beforeDamageReceived 候选未逐卡 E2E | 通用打牌 + rollDie | 0CP | shield 或 smoke | 骰面分支 | 响应窗收口 | L1/L2 | smoke 后续覆盖，卡牌本体缺 L3 |
| `ninja-card-poison-dart` | 卡图：2CP 主要阶段，给慢性中毒 | main，grant poison 2 | main 候选未逐卡 E2E | 通用打牌 | 2CP | poison +2 | 上限 2 | 回合结束 poison 清理 | L1/L2 | poison 后续覆盖，卡牌本体缺 L3 |
| `ninja-card-knife-fan` | 卡图：2CP 主要阶段，1 不可防御伤害 | main action，direct unblockable damage 1 | 合同测试 main 可打、offensiveRoll 不可打 | 通用打牌 | 2CP | direct damage | roll 阶段否定已测 | 通用打牌清理 | L2 | 四项回归内已审，缺真实打出 E2E |
| `upgrade-smoke-screen-2` | 卡图：升级烟雾阵 | upgrade 2CP replace | main 候选未逐卡 E2E | 通用打牌 | 2CP | replaceAbility | 无 | 能力表更新 | L1/L2 | 后续 token 代表覆盖，逐卡缺 L3 |
| `upgrade-shadow-fang-2` | 卡图：升级影牙 | upgrade 2CP replace | main 候选未逐卡 E2E | 通用打牌 | 2CP | replaceAbility | 无 | 能力表更新 | L1/L2 | 后续 token 代表覆盖，逐卡缺 L3 |
| `upgrade-poison-blade-2` | 卡图：升级毒刃 | upgrade 2CP replace | main 候选未逐卡 E2E | 通用打牌 | 2CP | replaceAbility | 无 | 能力表更新 | L1/L2 | 后续 poison/不可防御代表覆盖，逐卡缺 L3 |
| `upgrade-death-blossom-2` | 卡图：升级死亡盛放 | upgrade 2CP replace | main 候选未逐卡 E2E | 通用打牌 | 2CP | replaceAbility | 无 | 能力表更新 | L1 | 缺逐卡执行验证 |
| `ninja-card-vanish` | 卡图：0CP 即时，获得烟雾弹 | instant，grant smoke 1 | instant 候选未逐卡 E2E | 通用打牌 | 0CP | smoke +1 | 无 | 通用打牌清理 | L1/L2 | smoke 后续覆盖，卡牌本体缺 L3 |
| `ninja-card-dojo` | 卡图：0CP 主要阶段，烟雾弹 + 忍术 | main，grant smoke 1/ninjutsu 2 | main 候选未逐卡 E2E | 通用打牌 | 0CP | token grant | 上限 | 通用打牌清理 | L1/L2 | token 后续覆盖，卡牌本体缺 L3 |

## 当前可确认的已覆盖项

- 四项用户指出回归已有独立审计：`evidence/dicethrone/dicethrone-ninja-regression-audit-2026-05-14.md`。
- Token 复杂链路已有代表覆盖：`ninjutsu` 奖励骰与 6 点选择、`smoke_bomb` 成功免伤、`delayed_poison` 回合结束。
- `ninja-card-knife-fan` 时机合同已有 L2 覆盖：main 可打，offensiveRoll 不可打。

## 仍不能宣称完成的范围

- 大多数基础攻击技能只有静态定义与通用能力执行假设，未逐技能真实入口 L3。
- 多张升级卡只有 replaceAbility 静态合同，未逐卡真实打出验证升级后能力表变化。
- `ninja-card-shuriken`、`ninja-card-escape` 这类带奖励骰/响应窗的专属卡缺专属 E2E 截图链。
- `smoke_bomb` 失败骰面分支缺 E2E；当前只证明成功免伤。
- 若后续要宣称 Ninja 全量收口，必须补齐上述对象或明确按发布范围冻结；不能再用代表路径替代。

## 本次重审状态

当前状态：重审矩阵已建立，旧“全面审计完成”已降级。Ninja 四项回归已在专项 evidence 中有 L2/L3 证据，但 Ninja 全对象仍存在未覆盖项，因此不能写“全量新机制新交互都已端到端”。

## 2026-05-15 追加抽样深审：Token 与手牌卡消费点

新增证据文档：

- `evidence/dicethrone/dicethrone-treant-ninja-sample-deep-audit-2026-05-15.md`

本轮抽样深审修订本文件部分结论：

- `ninja-card-shuriken`：旧矩阵写“缺专属卡奖励骰 E2E / L1”，但实际问题比“缺 E2E”更严重。旧实现使用 `timing: 'withDamage'`，而 `PLAY_CARD` 只解析 `immediate`，导致卡牌打出后奖励骰加伤不执行。现已改为 `immediate + resolutionMode: 'attackBonus'`，并补 L2 行为测试；仍缺 L3 真实手牌打出 E2E。
- `ninja-card-escape`：已补 L2 行为覆盖，证明受击响应窗可打，护盾抵消后续结算伤害；仍缺 L3。
- `smoke_bomb` 失败分支：已补 L2 行为覆盖，证明失败骰面消耗 token 但不关闭 pendingDamage、不提前扣 HP；仍缺失败分支 E2E。

本轮追加结论不改变主口径：Ninja 仍不能被描述为全对象全交互端到端完成。
