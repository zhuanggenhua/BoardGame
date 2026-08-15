# DiceThrone Ninja 完整流程重审（2026-05-15）

> 2026-06-05 当前有效口径：本文仍是 Ninja 单英雄主重审入口；其中对象级 E2E/专项文档只能作为子证据，不得反向外推新英雄整批结论。当前若要判断 Ninja 对象级残余或新英雄整批发布口径，应以 `evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md`、`evidence/dicethrone/dicethrone-new-factions-full-cycle-audit-2026-05-15.md` 与 `evidence/dicethrone/dicethrone-new-factions-reaudit-wiki-diff-2026-05-17.md` 为准。
>
> 2026-05-19 范围澄清：本文件只覆盖 `ninja` 这一个英雄的逐对象矩阵与失效回写。当前整批“新英雄补审”的总范围已按用户要求扩到 `gunslinger / samurai / treant / ninja` 四位，新英雄总范围请以 `evidence/dicethrone/dicethrone-new-factions-full-cycle-audit-2026-05-15.md` 与 `evidence/dicethrone/dicethrone-new-factions-reaudit-wiki-diff-2026-05-17.md` 为准；不能再把本文件的“Ninja 子范围”误读成整批补审范围。
>
> 2026-05-19 本轮复核：按“四个新英雄”总范围重新回看后，Ninja 当前没有新增实现级 finding。此处旧总述若仍被理解成“部分技能本体与组合分支仍普遍未覆盖”，对 2026-06-05 当前状态已不成立：升级技能对象级 L3 与关键 L4 已按后续补记大幅补齐；本文当前只能作为单英雄历史轨迹。Ninja **不再单列对象级 residual** 只表示对象级主 bug 已明显收敛，**不表示 Ninja 整英雄或四英雄整批已经完成**；实时残余应改读为批次级 `L4` 判等矩阵、外围旧文档统一回写与治理口径统一。
>
> 2026-06-04 失效回写：本文内若仍把 `going-forward-2`、`slash-2`、`shadow-fang-2`、`shadow-step-2`、`smoke-screen-2`、`death-blossom-2`、`poison-blade-2`、`blink-2` 写成“结构未对齐/仍是旧实现/真实 L3 仍待补”，这些口径都已不同程度失效。当前以 `evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` 的 2026-06-04 补记与 `src/games/dicethrone/rule/ninja录入核对.md` 最新矩阵为准；本文保留历史审计轨迹，不再作为这些对象的最新正确性结论。
>
> 2026-06-06 失效回写：本文里若仍把 `slash-2`、`going-forward-2`、`shadow-fang-2 / 诳惑`、`blink-2` 写成“只证明槽位入口 / 真实 closeout 仍未补 / 真实防御 L3 仍待补”，这些口径也已失效。按 `evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` 的 2026-06-04/2026-06-06 补记，这几组升级技能的对象级 L3 已补齐，关键对象级 L4 也已大幅补齐；其中 `blink-2` 当前最新权威归因已更新为 `rollLimit=2 + rerollDieLimit=2 + DiceTray / Dice3D UI 命中层` 三线共同收口，不是“技能未实装”。当前残余应改读为批次级 `L4` 判等矩阵、外围旧文档统一回写与治理口径统一。

## 本次重审结论

旧“全面审计完成”结论不成立。本次用户反馈证明旧审计只覆盖了“能进游戏、能触发代表路径、少量机制可收口”，没有对每个技能/Token/专属卡做完整生命周期矩阵。因此旧审计维度失效，必须降级为“代表链路审计”，不能继续作为 Ninja 全量完成证明。

按 2026-06-05 当前代码、合同测试与 direct E2E，Ninja 当前**已不再单列对象级 residual**；但这只表示对象级主 bug 已明显收敛。本文当前职责是：

- 保留 Ninja 单英雄历史审计轨迹与旧结论失效回写。
- 给旧对象行补“哪些是历史、哪些已被后续批次文档取代”的阅读门禁。

本文当前**不是** Ninja 的最终整英雄收口矩阵，也不是四位新英雄整批完成证明。若要判断当前残余，只能读作批次级 `L4` 判等矩阵、外围旧文档统一回写与治理口径统一。

本次已补强通用审计规则：

- `.spec/knowledge/standards/testing-audit.md`：新增“技能/卡牌必须审查完整流程，禁止只测触发点”与通用技能完整流程矩阵。
- `DiceThrone 新英雄 intake / add-new-faction workflow`：新增派系/角色接入时，机制实现与审计 evidence 必须包含逐对象完整流程矩阵，并强制把旧文档里的高风险正文行同步回写，不允许只在文首加失效声明。

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

据此，**在 2026-05-18 当时的审计节点**，本文件曾把 `blink` / `blink-2` 明确降回 **L2 合同层**：规则文本、录入合同、领域行为测试和实现入口已对齐，但新的真防御 `L3` 截图链当时仍待补。该口径现已被后续升级重审取代：按 `evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` 的 2026-06-04/2026-06-05 补记，`blink-2` 的对象级真实防御 `L3` 与关键防御重投 `L4` 已补齐；本段仅保留为历史轨迹，不再代表当前状态。

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

> 2026-06-05 当前阅读门禁：下表保留的是这份**单英雄历史重审文档**在不同日期累计回写的对象行，其中既有“当前仍可引用的对象级入口/合同/收口证据”，也有“只保留为旧结论失效轨迹”的历史层级。凡某行写明“历史轨迹 / 旧结论失效 / 当前以升级重审文档为准”，都不得再被当成当前对象级 residual 或当前最新层级；当前 Ninja 的实时残余统一只读作批次级 `L4` 判等矩阵、旧文档统一回写与治理口径统一。

| 对象 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
|---|---|---|---|---|---|---|---|---|---|---|
| `slash` | 面板：3/4/5 忍刀伤害 | `abilities.ts` variants 5/6/7 | 依赖通用骰面候选；`fist` 槽共享升级入口已测 | 通用 ability activate | N/A | 通用 damage | 无分支 | 通用攻击流程 | L1/L3 代表 | 基础版未单独逐骰面 E2E；`slash-2` 已证明同槽真实入口与 `sourceAbilityId` |
| `slash-2` | 升级卡：斩击 II | `SLASH_2` 现为 `4/6/8` + `3` 同点得 `1` 忍术 | 升级后 `fist` 槽真实可点 | `SELECT_ABILITY` 写入 `sourceAbilityId=slash-2-5` | 升级卡替换 | 对象级主效果已由合同测试补到 L2，direct closeout 已补到对象级 L3 | 当前对象级残余已不再是“仍缺真实收口”，而是批次级 `L4` 判等与外围旧文档统一回写 | `pendingAttack` 创建后已可在新文档证明真实收口 | L2/L3 | 当前实现已对齐；本文旧“只到入口”口径已失效，当前最新对象级结论以升级重审文档为准 |
| `going-forward` | 面板：4 手里剑 7 伤害 | `diceSet shuriken=4` | 通用候选；`chi` 槽共享升级入口已测 | 通用 ability activate | N/A | damage 7 | 无分支 | 通用攻击流程 | L1/L3 代表 | 基础版未单独逐骰面 E2E；升级槽位入口已补 |
| `going-forward-2` | 升级卡：一往无前 II | `GOING_FORWARD_2` 已按主路线 + `刀尖舔血` 分支落地 | 升级后 `chi` 槽真实可点 | `SELECT_ABILITY` 写入 `sourceAbilityId=going-forward` | 升级卡替换 | 主分支与 `刀尖舔血` 分支都已由合同测试与 direct E2E 补到对象级 L2/L3 | 当前残余已从对象级缺口收敛为批次级 `L4` 判等与治理口径统一，不再是“只到入口” | `pendingAttack` 创建与最终 closeout 均已在新文档留证 | L2/L3 | 当前实现已对齐；本文旧“未提高数值 / 仅入口”结论已失效 |
| `poison-blade` | 面板：小顺子，慢性中毒 + 伤害 | `smallStraight`，grant poison，damage 5 | Ninja v2 槽位 `combo` | E2E 点击槽位后 `pendingAttack.sourceAbilityId='poison-blade'` | N/A | token + damage | 防御仍可触发 | 攻击 pending 进入通用流程 | L2/L3 | 四项回归内已审，槽位与入口已修 |
| `poison-blade-2` | 升级：本行旧结论已失效，保留作历史轨迹 | 旧审计曾误记为 `tags unblockable，damage 6` | 升级后 `combo` 槽真实可点 | `SELECT_ABILITY` 写入 `sourceAbilityId=poison-blade` | 升级卡替换 | **旧结论失效**：`对手 HP 30->24，慢性中毒 1` 已被 2026-06-04 复核推翻；当前正确口径见 `dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` | 旧结论失效 | 当前以新审计文档为准 | 历史 L3 | 不再作为现行正确性证据 |
| `shadow-step` | 面板：4 面具，烟雾弹、慢性中毒、不可防御伤害 | smoke + poison + unblockable damage 6 | 通用候选；`lightning` 槽共享升级入口已测 | 通用 ability activate；旧全局别名已收敛 | N/A | token + damage | 不可防御代表覆盖 | 通用攻击流程 | L1/L3 代表 | 基础版未单独逐骰面 E2E；升级真实入口证明不再误跳 Moon Elf `elusive-step` |
| `shadow-step-2` | 升级：慢性中毒 2、伤害 7 | smoke + poison 2 + unblockable damage 7 | 升级后 `lightning` 槽真实可点 | `sourceAbilityId=shadow-step` | 升级卡替换 | 对手 HP 30->23，烟雾弹 1，慢性中毒 2 | 不可防御跳过防御 | `pendingAttack` 清空，可继续推进 | L3 | 真实玩家板入口与不可防御结算已补 |
| `death-blossom` | 面板：忍刀/手里剑加伤，面具给忍术 | `rollDie 5` withDamage conditional | Ninja v2 槽位 `sky`；共享升级入口已测 | E2E 点击槽位后 `pendingAttack.sourceAbilityId='death-blossom'` | N/A | 奖励骰 conditional | 结果分支由通用 rollDie 处理 | 奖励骰 settlement | L2/L3 | 槽位已审；升级版已补奖励骰特写与收口代表链 |
| `death-blossom-2` | 升级：死亡盛放 II | 当前 `DEATH_BLOSSOM_2` 的奖励骰结算为忍刀=1 伤害、手里剑=2 伤害；1 个面具使攻击不可防御，2 个面具再施加 1 慢性中毒；不授予忍术 | 升级后 `sky` 槽真实可点 | `sourceAbilityId=death-blossom` | 升级卡替换 | 奖励骰特写出现，收口后按面具数量写入不可防御 / 慢性中毒，忍术不增加 | 使用潜行免防路径证明奖励骰 UI 与当前面具分支结果 | `pendingBonusDiceSettlement` 与 `pendingAttack` 清空 | L3 | 真实玩家板入口、奖励骰本体与收口已补；不外推所有骰面组合 |
| `smoke-screen` | 面板：获得烟雾弹/忍术并给慢性中毒 | grant smoke 1/ninjutsu 2/poison 1，`type='utility'` | 通用候选；`lotus` 槽共享升级入口已测 | 通用 ability activate；`offensiveRoll` 已允许 utility | N/A | token grant | 无选择 | token 后续由各 token 流程覆盖 | L1/L3 代表 | 基础版未单独 E2E；升级版证明 utility 不再被过滤 |
| `smoke-screen-2` | 升级：忍术 3 | grant smoke 1/ninjutsu 3/poison 1 | 升级后 `lotus` 槽真实可点 | `sourceAbilityId=smoke-screen` | 升级卡替换 | 烟雾弹 1、忍术 3、慢性中毒 1，HP 不变 | 非伤害 utility 不进入防御 | `pendingAttack` 清空，可继续推进 | L3 | 真实玩家板入口与 utility 结算已补 |
| `shadow-fang` | 面板：大顺子，忍术 2 + 8 伤害 | `largeStraight`，ninjutsu 2，damage 8 | 通用候选；`calm` 槽共享升级入口已测 | 通用 ability activate | N/A | token + damage | 无分支 | 通用攻击流程 | L1/L3 代表 | 基础版未单独 E2E；升级槽位入口已补 |
| `shadow-fang-2` | 升级：影牙 II / 诳惑 | `SHADOW_FANG_2` 已按主路线 + `诳惑` 分支落地 | 升级后 `calm` 槽真实可点 | `sourceAbilityId=shadow-fang` | 升级卡替换 | 对象级主分支与 `诳惑` 分支已由合同测试补到 L2，direct closeout 已补到对象级 L3 | 当前对象级残余已不再是“仍缺真实收口”，而是批次级 `L4` 判等与外围旧文档统一回写 | `pendingAttack` 创建与最终 closeout 均已在新文档留证 | L2/L3 | 当前实现已对齐；本文旧“只到入口”口径已失效，当前最新对象级结论以升级重审文档为准 |
| `blink` | 防御：掷 3 骰；若投出忍刀，造成 1 伤害；若投出手里剑，造成 2 伤害；若投出面具，获得烟雾弹 | `defensiveRoll` + 读取防御投已出骰面；不额外奖励骰 | 防御阶段 pendingAttack | `resolveAttack` 调用 `ninja-blink` | N/A | 当前保留的仍是 2026-05-18 合同层证据：`1/4/6` 时攻击者 HP -3、防御者烟雾弹 +1 | `isDefendable=false` 跳过 | 防御事件后攻击流程继续 | 历史 L2 | 旧“累计奖励骰反击”结论已失效；本行现在只保留基础 `blink` 合同回写轨迹，不构成 2026-06-05 当前 residual，实时残余仍以批次级治理口径为准 |
| `blink-2` | 升级：瞬身 II；忍刀按数量造成伤害，手里剑固定 2 伤害，2 面具给烟雾弹；可重掷至多 2 颗 | 升级后使用独立 `ninja-blink-2`，并通过 `trigger.rollLimit=2 + rerollDieLimit=2` 进入共享防御重投合同 | 升级后防御入口 | `resolveAttack` | 升级卡替换 | 当前 L2 合同：`1/2/4` 时攻击者 HP -4；`1/6/6` 时攻击者 HP -1 且防御者烟雾弹 +1；第二次防御重投前若 3 颗全开应被拒绝，锁 1 颗后只重投另外 2 颗应放行 | 同上 | 攻击流程继续 | L2/L3 | 当前已补合同测试 + 真实防御重投 E2E；对象级 L3 已达标，关键对象级 L4 也已补齐。本行现仅作为单对象历史回写入口，不能再被当成“瞬身 II 仍是当前对象级未完成项” |
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
  - 该文档当前只保留“2026-05-14 那一轮回归修复证据”职责，不再充当 Ninja 当前主出口；当前主线仍以本文 + `dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` + `src/games/dicethrone/rule/ninja录入核对.md` 为准。
- Token 复杂链路已有代表覆盖：`ninjutsu` 奖励骰与 6 点选择、`smoke_bomb` 成功免伤与失败分支、`delayed_poison` 回合结束。
- `ninja-card-knife-fan` 时机合同已有 L2 覆盖：main 可打，offensiveRoll 不可打；2026-05-17 又补真实主阶段手牌 L3，证明 direct unblockable damage 1 会扣对手 HP。
- `blink` / `blink-2` 当前最新权威口径已回到 `src/games/dicethrone/rule/ninja录入核对.md` 与 `src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts`：基础版读取防御投已出骰面后按“忍刀 +1 伤害 / 手里剑 +2 伤害 / 面具给烟雾弹”结算；II 级按“忍刀数量伤害 / 任一手里剑 +2 / 两个面具给烟雾弹”结算。对应实现入口为 `src/games/dicethrone/heroes/ninja/abilities.ts` 与 `src/games/dicethrone/domain/customActions/ninja.ts`。
- `blink-2` 的当前最新异常归因已进一步更新：2026-06-05 命中过的真实 UI 点击红点来自 `DiceTray` 命中层，但 2026-06-06 又继续坐实一条共享校验漏项，说明旧实现除了 UI 命中层外，还缺“第二次至多重掷 2 颗”的命令级合同。现行权威口径应读作 `trigger.rollLimit=2 + rerollDieLimit=2 + DiceTray 命中层` 三线都已补齐，具体回写证据见升级重审文档中的 `2026-06-06 补记：瞬身 II 仍有一层共享校验漏项` 与 `2026-06-05 补记：瞬身 II 再失效并非“未实装”，而是 UI 命中层回归`。

## 仍不能宣称完成的范围与已回写补记

- 旧“`slash-2`、`going-forward-2`、`shadow-fang-2 / 诳惑`、`blink-2` 只到槽位入口 / 真实收口仍待补”的对象级残余口径已失效：这些升级技能的对象级 L3 已在 `dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` 中补齐，关键对象级 L4 也已大幅补齐。对这批升级技能而言，当前残余应改读为**批次级 L4 判等矩阵、外围旧文档统一回写与治理口径统一**，而不是继续视为对象级未完成。
- 这份文档仍不能被当作“Ninja 全对象全面审计完成”证明：即便升级技能对象级口径已更新，本文覆盖的仍是单英雄历史重审轨迹，非升级技能、专属卡、token、基础技能与共享系统之间的整英雄最终 L4 判等矩阵仍未在本文内重建完成。
- 但截至 2026-06-05，Ninja 当前也**不再单列对象级 residual**：这只表示对象级主 bug 已清到当前主线之外；若后续还有“未完成项”，只能落在批次级 `L4` 判等矩阵、旧文档统一回写与治理口径统一，而不是继续表述成某几项技能/卡牌“仍待补对象级实现或 L3/L4”。
- 以下条目仅保留为“后续已补到何处”的回写补记，不再属于 2026-06-05 的当前残余清单：
- `ninja-card-escape` 已补受击响应窗真实手牌 L3 截图链。
- `ninja-card-dojo` 已补真实手牌打出、奖励骰、面具成功、非面具抽牌和收口截图链，但该单卡 L3 不能外推升级卡或基础/升级技能本体。
- `ninja-card-training`、`ninja-card-poison-dart`、`ninja-card-knife-fan`、`ninja-card-shuriken`、`ninja-card-vanish`、`ninja-card-escape` 与 8 张升级卡已补真实手牌 L3，但不能外推基础/升级技能本体的所有骰面与分支。
- `smoke_bomb` 失败骰面分支已补真实 UI/E2E；当前证明失败会消耗 token、保留 `pendingDamage`，跳过响应后 HP 30->23。
- 若后续要宣称 Ninja 全量收口，必须补齐上述对象或明确按发布范围冻结；不能再用代表路径替代。

## 本次重审状态

当前状态：重审矩阵已建立，旧“全面审计完成”已降级。Ninja 四项回归与升级技能对象级补审已有 L2/L3/L4 分层证据；其中升级技能对象级 `L3` 与关键 `L4` 已在后续文档中大幅补齐。**Ninja 当前不再单列对象级 residual**；但这只表示对象级主 bug 已明显收敛。

因此，本文现在只能承担两类作用：

- 作为 Ninja 单英雄历史重审入口，保留对象级矩阵与旧结论失效轨迹。
- 把读者导向当前真正有效的批次级口径，而不是让旧对象行继续冒充当前残余。

当前真正残余已收敛为**批次级 `L4` 判等矩阵、旧文档统一回写与治理口径统一**。但**这份单英雄历史文档本身**仍未重写成最终整英雄收口矩阵，因此不能把它当作“Ninja 全对象全交互已端到端收口”的当前证明。

补审后的更精确口径：

- `poison-blade`、`death-blossom` 槽位问题、`smoke-screen` utility 入口、`shadow-step` 别名问题、`knife-fan` 时机问题都已有各自 L2/L3 证据。
- `blink` / `blink-2` 的**规则语义**已通过 2026-05-18 的录入回写与合同测试重新对齐；其中 `blink-2` 的真实防御入口 L3 已在后续 direct E2E 中补齐。本文若继续讨论 Ninja 升级技能当前状态，应以升级重审文档中的对象级 L3/L4 矩阵为准，而不是沿用这里较早的“仍待补”表述。

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
