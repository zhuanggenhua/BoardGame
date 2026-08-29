# DiceThrone 吸血鬼领主机制实现审计

## 基本信息

- 对象：Dice Throne 新英雄吸血鬼领主（`vampire_lord` / Vampire Lord）。
- 日期：2026-08-28；最近更新：2026-08-29（补鲜血之力 3/4 档、嗜血之爪 III 5 利爪、不死防御真实入口 E2E，并将玩家入口切入实施中口径）。
- 文档类型：`audit`。
- 关联需求：新增 DiceThrone 吸血鬼新派系，继续从静态接入进入机制实现、审计和 E2E 流程。
- 当前工作目录：`D:\gongzuo\webgame\BoardGame`。

## 本轮范围

- 本轮覆盖对象：`vampire_lord` 角色、已录入的基础技能 / 升级技能、专属行动牌、升级替换壳、鲜血之力、催眠、流血。
- 本轮覆盖规则子句：现有共享结算器能直接表达的伤害、治疗、获得 Token、施加流血、抽牌、攻击修正、升级替换、复合升级下区 variants，以及鲜血之力 / 催眠的低层主动消费链、嗜血之爪 III 5 利爪真实入口代表链、不死防御入口链和利爪 I/II/III 其它 3/4/5 分支的共享流程判等。
- 本轮目标入口 / 环境：领域测试入口 `src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts`，本地真实牌桌入口、内部状态注入资源验证入口与玩家选角入口 `e2e/dicethrone/vampire-lord-real-entry.e2e.ts`；资源发布已回查，本轮不执行无过滤全仓发布。
- 明确不在本轮范围内：利爪 I/II/III 全部 3/4/5 分支逐条独立真实入口截图；本轮按 III 级 5 利爪代表链 + `dt-bloodthirsty-claws-variants-damage-v1` 共享流程判等覆盖当前实现审计范围。

## 批次矩阵

| objectId | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `vampire_lord` | `passed` | `passed` | `passed` | `passed` | `passed` | `in_progress` |

判定说明：静态数据、资源链和上传回查已有独立证据；领域 / pipeline 结果级测试已经把共享结算、攻击修正、复合升级下区 variants、鲜血之力主动消费、催眠强迫重掷、不死防御效果链和嗜血之爪 variants + damage 链推进到 `passed`。本地真实牌桌入口覆盖鲜血之力 1 档加伤、2 档状态选择移除流血、3 档抽 2 张牌、4 档按已造成伤害治疗、催眠临时骰与对手骰选择重掷、嗜血之爪 III 5 利爪槽位触发与 8 点攻击伤害，以及不死防御 4 骰、反击和自疗收口。当前玩家可见状态为 `in_progress`：玩家选角入口和直接玩家命令可手动选择吸血鬼领主，界面显示实施中标记；共享 AI 自动选角仍过滤实施中角色。

## 结论等级

结论等级：`当前范围已收口`。

判定理由：吸血鬼领主已有一组机制子句通过领域最终状态断言；复合升级下区已经按老角色同类合同进入升级后能力 `variants`，`card-vampire-lord-bloodstone` 已独占 `slot-32`，公共 `card-unexpected` 不再绑定吸血鬼 atlas 预览。`blood_power` 和 `mesmerize` 的低层消费链已经可执行，鲜血之力 1/2/3/4 档、催眠关键主动交互、嗜血之爪 III 5 利爪代表链和不死防御入口已有本地真实入口证据；利爪 I/II/III 其它 3/4/5 分支只在 `level`、`variantId`、`requiredClawCount`、`damageAmount` 上不同，已按 `dt-bloodthirsty-claws-variants-damage-v1` 共享流程判等，不再构成当前范围验证缺口。当前文件用于登记“当前范围机制已审计，玩家入口已进入实施中，但尚未移除实施中标记进入完整完成态”。

## 权威来源

- 主真相源：`src/games/dicethrone/rule/吸血鬼领主真相源表.md`、`src/games/dicethrone/rule/吸血鬼领主录入核对.md`、`src/games/dicethrone/rule/吸血鬼领主卡牌录入核对.md`。
- 静态定义源：`src/games/dicethrone/heroes/vampire_lord/abilities.ts`、`src/games/dicethrone/heroes/vampire_lord/cards.ts`、`src/games/dicethrone/heroes/vampire_lord/tokens.ts`。
- 领域消费源：`src/games/dicethrone/domain/effects.ts`、`src/games/dicethrone/domain/execute.ts`、`src/games/dicethrone/domain/executeCards.ts`、`src/games/dicethrone/domain/passiveAbility.ts`、`src/games/dicethrone/domain/customActions/vampire_lord.ts`、`src/games/dicethrone/domain/reducer.ts`、`src/games/dicethrone/domain/reduceCards.ts`。
- 验证来源：`src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts`、`src/games/dicethrone/__tests__/vampire-lord-intake.test.ts`、`src/games/dicethrone/__tests__/StatusEffectsIcons.test.tsx`；定向命令 `npx vitest run src/games/dicethrone/__tests__/StatusEffectsIcons.test.tsx src/games/dicethrone/__tests__/vampire-lord-intake.test.ts src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts --configLoader native`；真实入口 E2E `node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone/vampire-lord-real-entry.e2e.ts`。
- 合同状态：`locked` 用于已录入的普通效果、升级替换、复合升级下区、`slot-32` 归属、吸血鬼 `xixuegui` 状态 / Token 图集归属和嗜血之爪 variants + damage 共享流程；逐分支独立截图属于范围外扩展，不阻塞当前范围。

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | 本轮只覆盖 `vampire_lord`，不外推到其它 DiceThrone 英雄。 |
| 真相源状态 | `passed` | 主真相源、静态定义源和领域消费源列在“权威来源”。 |
| 原子语义断言 | `passed` | 下方“原子语义与实现消费”列出本轮直测对象；复合升级下区和 `slot-32` 合同已裁定。 |
| 实现消费链 | `passed` | 普通效果、攻击修正、复合升级下区、鲜血之力 / 催眠低层消费、不死防御、状态 / Token 图标按当前英雄取图集，以及嗜血之爪 variants + damage 共享流程均已覆盖。 |
| 最终权威结果 | `passed` | 本轮测试断言 HP、CP、token、状态、手牌、弃牌堆、技能等级、升级槽、复合 variants 和嗜血之爪 III 5 利爪最终伤害；E2E 断言鲜血之力加伤、状态移除、抽牌、治疗、催眠重掷、嗜血之爪 8 点攻击伤害和不死防御收口后的权威状态。 |
| 交互真实入口 | `passed` | 本地真实牌桌已覆盖鲜血之力 1 档加伤、2 档状态选择移除流血、3 档抽 2 张牌、4 档按已造成伤害治疗、催眠临时骰与对手骰选择重掷、嗜血之爪 III 5 利爪槽位触发和不死防御 4 骰反击自疗；真实在线玩家选角入口应覆盖吸血鬼领主实施中可见、可手动选择并进入牌桌。嗜血之爪其它分支按 `dt-bloodthirsty-claws-variants-damage-v1` 判等，不要求逐条独立截图。 |
| 验证证据 | `passed` | `StatusEffectsIcons.test.tsx`、`vampire-lord-intake.test.ts`、`vampire-lord-mechanics.test.ts`、`character-catalog-status.test.ts` 和 `basic-commands-coverage.test.ts` 覆盖内部目录、玩家可见目录包含实施中角色、直接命令可选实施中角色、共享 AI 自动选角过滤实施中角色；`vampire-lord-real-entry.e2e.ts` 覆盖内部注入资源链、鲜血之力 1/2/3/4 档真实入口、催眠真实入口、嗜血之爪 III 5 利爪真实入口、不死防御真实入口和玩家选角实施中入口。 |
| 共享影响与代表链依据 | `passed` | 普通 effect / 攻击修正 / 升级壳引用共享流程；复合下区按老角色 variants 合同落地并有直接测试；鲜血之力 / 催眠有直接低层测试；嗜血之爪 I/II/III 分支引用同一 variants + damage 流程，仅配置差异不同。 |
| 缺口分类与范围裁定 | `passed` | 下方残余范围表逐项分类。 |
| 旧 evidence / 旧结论对账回写 | `passed` | 当前无旧吸血鬼完整完成态结论；本文回写隐藏阶段和误写完成态口径，防止把实施中误称为完整派系完成。 |
| 残余范围声明 | `passed` | 结论等级和残余范围表均声明当前玩家可见状态为 `in_progress`，尚未进入完成态或完整发布级收口。 |

## 共享流程审计

| sharedFlowId | 流程职责 | 一次性审计证据 | 流程不变量 | 允许配置差异 | 失效影响面 |
| --- | --- | --- | --- | --- | --- |
| `dt-effect-basic-event-v1` | 技能或行动牌效果转成 HP、token、状态、抽牌等正式事件 | `effects.ts` 的 `damage` / `heal` / `grantStatus` / `grantToken` / `drawCard` 分支；`reducer.ts` 与 `reduceCards.ts` 写入最终状态；`vampire-lord-mechanics.test.ts` 11 条覆盖吸血鬼调用 | 触发时机来自 effect timing；payload 写明目标、数值、来源；最终权威状态为 HP、token、状态、手牌 / 牌库；流程收口后无残留临时结算状态 | 技能 ID、卡牌 ID、数值、目标 self/opponent、音效、图集 slot | 所有用普通 effect 建模的 DiceThrone 技能 / 行动牌 |
| `dt-replace-ability-upgrade-v1` | 普通 / 复合升级牌扣 CP、移出手牌并替换玩家板基础技能 | `executeCards.ts` 产生 `CP_CHANGED` / `CARD_PLAYED` / `ABILITY_REPLACED`；`effects.ts` 生成替换事件；`reduceCards.ts` 写入 `abilityLevels` 和 `upgradeCardByAbilityId`；吸血鬼嗜血之爪 II 与其余 7 张升级壳直测 | 触发时机为主阶段打出升级牌；候选来自手牌升级牌；payload 为目标基础技能、替换定义和等级；最终权威状态为技能定义 / 等级 / 升级槽；不自动结算升级后技能；复合下区进入升级后技能 `variants` | `cpCost`、目标基础技能、替换等级、替换后的能力定义、卡图 slot、升级后能力 variants | 所有替换型升级牌 |
| `dt-attack-modifier-card-v1` | 攻击修正牌在投掷阶段把数值加入当前攻击，不直接造成即时伤害 | `cards.ts` `common-add-attack-bonus` -> `execute.ts` / custom action -> `BONUS_DAMAGE_ADDED` -> `reducer.ts` 写入当前攻击加伤和攻击修正来源；吸血鬼两张攻击修正牌直测 | 需要已有当前攻击；打出后只更新本次攻击加伤和弃牌堆；不立即产生 `DAMAGE_DEALT`；CP 按卡牌配置扣除 | 卡牌 ID、CP 费用、加伤数值、来源卡牌 | 所有复用同一攻击修正入口的 DiceThrone roll / attack modifier 卡 |
| `dt-passive-token-custom-action-v1` | 被动能力主动花费 token / CP 后执行抽牌、加伤、状态选择或专属 custom action | `passiveAbility.ts` 判定可用性和每回合限制；`execute.ts` `USE_PASSIVE_ABILITY` 扣成本并分发 action；`customActions/vampire_lord.ts` 处理催眠临时骰和鲜血之力治疗；`systems.ts` 把后续选择接到正式交互；`vampire-lord-real-entry.e2e.ts` 覆盖关键玩家按钮与收口 | 可用性先校验资源、阶段和规则前提；成本只扣一次；最终权威状态为 token、手牌、当前攻击上下文、HP、正式交互或当前骰区；每回合限制由 `TOKEN_CONSUMED` 写入 | 被动 ID、actionIndex、token 成本、时机、customActionId、数值 | 所有用 PassiveAbilityDef 建模的主动被动动作 |
| `dt-bloodthirsty-claws-variants-damage-v1` | 嗜血之爪按当前升级等级和利爪数量选择对应 variants，并进入同一攻击伤害结算 | `abilities.ts` 中 I/II/III 的 variants 只改变 `variantId`、利爪数量和伤害数值；`effects.ts` 统一消费 `damage`；`reducer.ts` 统一写入当前攻击上下文 / `DAMAGE_DEALT` / HP；`vampire-lord-mechanics.test.ts` 覆盖 III 5 利爪最终状态，`vampire-lord-real-entry.e2e.ts` 覆盖真实投骰 + 玩家板物理槽代表链 | 触发时机为进攻投骰确认后点击同一玩家板 `fist` 物理槽；候选生成、权限判断、payload、执行入口、防御进入、最终 HP 扣减和清理语义一致 | `level`、`variantId`、`requiredClawCount`、`damageAmount` | 吸血鬼领主 `bloodthirsty-claws` I/II/III 的 3/4/5 利爪分支 |

## 代表链判等与图片合同证据

| 项目 | 证据 |
| --- | --- |
| 代表对象 | `bloodthirsty-claws-3-5`。代表链为真实投出 5 个利爪、点击玩家板 `fist` 物理槽、进入防御、结算 8 点攻击伤害并回到主要阶段 2。 |
| 共享链路 ID | `dt-bloodthirsty-claws-variants-damage-v1`。 |
| 判等依据 | I/II/III 其它 3/4/5 利爪分支与代表对象仅配置不同：`level`、`variantId`、`requiredClawCount`、`damageAmount`；触发入口、候选生成、权限判断、payload / command 结构、执行入口、最终权威状态和清理语义逐项一致。 |
| 一致性核对 | 触发时机为进攻投骰确认后；候选集合来自同一 `fist` 槽 variants；合法动作只允许当前进攻玩家点击；载荷结构为能力 ID / variant ID / 防守方；执行入口为同一伤害 resolver / reducer；最终状态为对手 HP 扣减、事件流记录攻击伤害、阶段可继续；清理语义为攻击上下文清空且无残留交互。 |
| 图片合同表 | `src/games/dicethrone/rule/吸血鬼领主真相源表.md` 的素材矩阵和玩家板槽位契约、`src/games/dicethrone/rule/吸血鬼领主卡牌录入核对.md` 的 `slot-00` 至 `slot-32` 卡牌合同共同承担图片合同表；裁图清单为 `temp/dicethrone-intake/xixuegui/ability-card-slots/`，atlas SHA256 见 `public/assets/atlas-configs/assets-manifest.json` 中 `dicethrone/ability-cards-vampire_lord.atlas`。 |
| 按钮生命周期 | 使用后按钮隐藏/禁用证据来自 `vampire-lord-real-entry.e2e.ts`：鲜血之力 1/3/4 档断言对应按钮使用后隐藏，四档消费均写入 `passiveActionUsedThisTurn`；同档每回合只能使用一次由 `passiveAbility.ts` 每回合限制和 `vampire-lord-mechanics.test.ts` 最终状态断言覆盖。 |
| 流程生命周期 | 嗜血之爪代表链结算后进入主要阶段 2，攻击上下文清空；不死防御链结束后同样进入主要阶段 2；鲜血之力状态选择和催眠选择在确认后关闭选择层，均形成流程收口和无残留证据。 |

## 原子语义与实现消费

| 对象 | 原子语义断言 | 实现消费点 | 最终权威结果 | 真实入口 / 验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| `blood-feast` | 3 个血滴技能效果：治疗自己 2，获得 3 个鲜血之力；token 上限为 5 | `abilities.ts` `healSelf` / `grantToken` -> `effects.ts` `heal` / `grantToken` -> `reducer.ts` | HP 从 44 到 46；`blood_power` 从 4 封顶到 5 | `vampire-lord-mechanics.test.ts` 鲜血盛宴测试 | 无 | `passed` |
| `rend-claws` | 小顺技能效果：给对手 1 层流血，并造成 6 点攻击伤害 | `abilities.ts` `grantBleed` / `damage` -> `effects.ts` `grantStatus` / `damage` -> `reducer.ts` | 对手 `bleed=1`；HP 从 50 到 44；伤害范围为攻击伤害 | `vampire-lord-mechanics.test.ts` 撕裂之爪测试 | 无 | `passed` |
| `bloody-slaughter` | 终极效果：获得 2 个鲜血之力，给对手 2 层流血，造成 12 点攻击伤害 | `abilities.ts` -> `effects.ts` -> `reducer.ts` | 自己 `blood_power=2`；对手 `bleed=2`；对手 HP 从 50 到 38 | `vampire-lord-mechanics.test.ts` 血色杀戮测试 | 无 | `passed` |
| `mesmerize-power` | 获得 1 催眠并造成 4 点攻击伤害；主动消费另由 `vampire-lord-mesmerize` 行覆盖 | `abilities.ts` `grantToken` / `damage` -> `effects.ts` -> `reducer.ts` | 自己 `mesmerize=1`；对手 HP 从 50 到 46；伤害范围为攻击伤害 | `vampire-lord-mechanics.test.ts` 基础共享技能矩阵 | 无 | `passed` |
| `blood-possessed` | 获得 2 鲜血之力并造成 6 点攻击伤害 | `abilities.ts` `grantToken` / `damage` -> `effects.ts` -> `reducer.ts` | 自己 `blood_power=2`；对手 HP 从 50 到 44 | `vampire-lord-mechanics.test.ts` 基础共享技能矩阵 | 无 | `passed` |
| `blood-thirst` | 给对手 1 层流血并造成 4 点攻击伤害 | `abilities.ts` `grantBleed` / `damage` -> `effects.ts` -> `reducer.ts` | 对手 `bleed=1`；对手 HP 从 50 到 46 | `vampire-lord-mechanics.test.ts` 基础共享技能矩阵 | 无 | `passed` |
| `blood-magic` | 获得 2 鲜血之力并造成 7 点攻击伤害 | `abilities.ts` `grantToken` / `damage` -> `effects.ts` -> `reducer.ts` | 自己 `blood_power=2`；对手 HP 从 50 到 43 | `vampire-lord-mechanics.test.ts` 基础共享技能矩阵 | 无 | `passed` |
| `undying` / `undying-2` | 防御上下文中对攻击者造成 1 点直接反击伤害，并治疗自己 1 点；防御入口为 4 颗吸血鬼骰 | `abilities.ts` `damage` / `healSelf` -> `effects.ts` -> `reducer.ts`；`execute.ts` / `flowHooks.ts` 进入防御阶段自动选择唯一防御技能并设置 4 骰 | 领域测试中对手 HP 从 50 到 49、自己 HP 从 47 到 48；真实入口中攻击者 HP 50 到 49、防御方 HP 42 经 4 点攻击伤害和 1 点治疗后到 39；伤害范围为直接伤害 | `vampire-lord-mechanics.test.ts` 不死之身 I / II 防御效果测试；`vampire-lord-real-entry.e2e.ts` 不死防御 4 骰、确认、结束防御和收口截图 | 无 | `passed for domain and real entry` |
| `card-vampire-lord-blood-surge` | 主阶段行动牌：扣 1 CP，获得 1 鲜血之力，牌进入弃牌堆 | `cards.ts` effects -> `execute.ts` / `executeCards.ts` `PLAY_CARD` -> `effects.ts` -> `reducer.ts` / `reduceCards.ts` | CP 10 到 9；`blood_power=1`；手牌清空；本牌进入弃牌堆 | `vampire-lord-mechanics.test.ts` 获得类专属行动牌矩阵 | 无 | `passed` |
| `card-vampire-lord-blood-from-above` | 主阶段行动牌：扣 1 CP，获得 1 鲜血之力，牌进入弃牌堆 | `cards.ts` effects -> `execute.ts` / `executeCards.ts` `PLAY_CARD` -> `effects.ts` -> `reducer.ts` / `reduceCards.ts` | CP 10 到 9；`blood_power=1`；手牌清空；本牌进入弃牌堆 | `vampire-lord-mechanics.test.ts` 获得类专属行动牌矩阵 | 无 | `passed` |
| `card-vampire-lord-gushing-blood` | 主阶段行动牌：获得 1 鲜血之力和 1 催眠，牌进入弃牌堆 | `cards.ts` effects -> `execute.ts` / `executeCards.ts` `PLAY_CARD` -> `effects.ts` -> `reducer.ts` / `reduceCards.ts` | `blood_power=1`；`mesmerize=1`；手牌清空；本牌进入弃牌堆 | `vampire-lord-mechanics.test.ts` 获得类专属行动牌矩阵；催眠主动消费入口另由 `vampire-lord-mesmerize` 行覆盖 | 无 | `passed` |
| `card-vampire-lord-drink-up` | 主阶段行动牌：获得 2 鲜血之力，牌进入弃牌堆 | `cards.ts` effects -> `execute.ts` / `executeCards.ts` `PLAY_CARD` -> `effects.ts` -> `reducer.ts` / `reduceCards.ts` | `blood_power=2`；手牌清空；本牌进入弃牌堆 | `vampire-lord-mechanics.test.ts` 获得类专属行动牌矩阵 | 无 | `passed` |
| `card-vampire-lord-bloodstone` | 主阶段行动牌：扣 4 CP，获得 1 催眠与 2 鲜血之力，给对手 1 流血，抽 1 张牌，牌进入弃牌堆 | `cards.ts` effects -> `execute.ts` / `executeCards.ts` `PLAY_CARD` -> `effects.ts` -> `reducer.ts` / `reduceCards.ts` | CP 10 到 6；`mesmerize=1`；`blood_power=2`；对手 `bleed=1`；手牌抽入指定牌；血石进入弃牌堆；卡图独占 `slot-32` | `vampire-lord-mechanics.test.ts` 血石测试；`vampire-lord-intake.test.ts` slot-32 预览合同 | 无 | `passed` |
| `card-vampire-lord-total-demise` / `card-vampire-lord-boiling-blood` | 投掷阶段已有当前攻击时可打出；打出后本次攻击伤害 +1，牌进入弃牌堆，不直接扣对手 HP | `cards.ts` `common-add-attack-bonus` -> `execute.ts` / custom action -> `reducer.ts` | 当前攻击加伤为 1；攻击修正来源为本牌；对手 HP 保持 50；CP 按卡牌费用扣除 | `vampire-lord-mechanics.test.ts` 攻击修正牌测试 | 无 | `passed` |
| `upgrade-vampire-lord-bloodthirsty-claws-2` | 主阶段升级牌：扣 2 CP，替换嗜血之爪到 II 级，不自动结算技能本体 | `cards.ts` `replaceAbility` -> `executeCards.ts` -> `effects.ts` -> `reduceCards.ts` | CP 10 到 8；`abilityLevels.bloodthirsty-claws=2`；升级槽记录卡牌；手牌移除 | `vampire-lord-mechanics.test.ts` 嗜血之爪 II 升级壳测试 | 无 | `passed` |
| 其余 7 张普通升级壳 | slot 22/23/24/25/26/27/28 均扣 CP、替换目标基础技能、写入技能等级和升级槽；复合牌下区不在打出升级牌时结算 | `cards.ts` `replaceAbility` -> `executeCards.ts` -> `effects.ts` -> `reduceCards.ts` | 每张升级牌均产生 `CP_CHANGED` 与 `ABILITY_REPLACED`，并写入对应 `abilityLevels` / `upgradeCardByAbilityId` | `vampire-lord-mechanics.test.ts` 其余升级牌矩阵 | 无；复合下区由 variants 行覆盖 | `passed` |
| II 级共享技能上区 | `blood-feast` / `rend-claws` / `blood-possessed` / `blood-thirst` / `blood-magic` / `mesmerize-power` 的 II 级上区效果落到 HP、token、流血、选择和攻击伤害 | 升级替换后从 `abilities` 读取升级技能 -> `effects.ts` -> `reducer.ts` | 对应 II 级数值均写入最终 HP、token、状态、选择请求或伤害；伤害范围符合攻击 / 不可防御设置 | `vampire-lord-mechanics.test.ts` 升级后共享技能上区矩阵和魔血附身 II 选择测试 | 无 | `passed` |
| `bloodthirsty-claws` I / II / III 分支 | 3/4/5 利爪分支按升级等级使用对应攻击伤害，不是复合升级即时效果 | `abilities.ts` variants -> `effects.ts` `damage` -> `reducer.ts` | I / II 分支进入升级后 variants；III 级 5 利爪造成 8 点攻击伤害；升级槽与等级先由升级牌写入 | `vampire-lord-mechanics.test.ts` 嗜血之爪 II 升级壳与 III 分支测试；intake variants 结构测试；`vampire-lord-real-entry.e2e.ts` 嗜血之爪 III 5 利爪真实投骰、`fist` 物理槽触发、防御和结算截图 | I/II/III 其它 3/4/5 利爪分支仅为 `level`、`variantId`、`requiredClawCount`、`damageAmount` 配置差异，引用 `dt-bloodthirsty-claws-variants-damage-v1` | `passed via shared flow` |
| `vampire-lord-blood-power` 消费增强 | 玩家可花费 1/2/3/4 个鲜血之力分别执行当前攻击 +3、移除 1 个状态 / 标记、抽 2 张、按本次攻击已造成伤害治疗；同档每回合一次 | `tokens.ts` `VAMPIRE_LORD_PASSIVE_ABILITIES` -> `passiveAbility.ts` 可用性 -> `execute.ts` `USE_PASSIVE_ABILITY` -> `common-add-attack-bonus` / `remove-status-1` / `drawCard` / `vampire-lord-blood-power-heal-attack-damage` -> `reducer.ts` | token 按成本扣减；+3 写入当前攻击加伤；移除状态生成正式选择；抽牌写入手牌；治疗写入 HP；每回合限制写入 `passiveActionUsedThisTurn` | `vampire-lord-mechanics.test.ts` 鲜血之力四档测试；`vampire-lord-real-entry.e2e.ts` 覆盖 1 档加伤按钮、2 档状态选择移除流血、3 档抽 2 张牌、4 档按已造成伤害治疗，以及内部状态注入资源链 | 无 | `passed for domain and real entry` |
| `vampire-lord-mesmerize` 强迫重掷 | 持有催眠且当前骰区存在对手骰时可消耗 1 催眠投 1 颗临时骰；结果 4 不触发后续选择；结果 5/6 可选择 1 颗对手骰并强迫重掷 | `tokens.ts` passive action -> `passiveAbility.ts` `requiresOpponentRollDice` -> `execute.ts` -> `customActions/vampire_lord.ts` 临时骰与 followup -> `systems.ts` selectDie -> `REROLL_DIE` -> `reducer.ts` | 无 token / 无对手骰不可用；token 扣到 0；临时骰确认后恢复父骰区；5/6 生成对手骰选择；正式重掷命令改变对手骰并可确认收口 | `vampire-lord-mechanics.test.ts` 催眠三条测试，其中成功路径经过 `executePipeline`；`vampire-lord-real-entry.e2e.ts` 覆盖催眠按钮、临时骰、对手骰选择、确认和收口；真实在线双玩家链证明催眠图标和吸血鬼骰面可见 | 无 | `passed` |
| 复合升级下区 | 多张升级牌含“升级技能 + 下区技能/效果”复合语义；同一物理牌只产生一个升级卡对象，下区进入升级后基础技能 variants | `cards.ts` `replaceAbility` 写入包含 variants 的 `newAbilityDef`；`abilities.ts` 定义 `blood-river` / `flayed` / `blood-addiction` / `dressed-to-kill` / `soul-gaze` variants | 升级牌只替换基础技能；下区 variants 分别落到流血、直接 / 不可防御伤害、鲜血之力、抽牌、催眠等最终状态 | `vampire-lord-intake.test.ts` variants 结构断言；`vampire-lord-mechanics.test.ts` 复合升级下区最终状态测试 | 无 | `passed` |
| `slot-32` 通用牌冲突 | 图面 `slot-32` 是“血石！”，不能作为公共 `card-unexpected` 的吸血鬼 atlas 预览 | `cards.ts` 过滤吸血鬼公共 atlas 中的 `card-unexpected`；`card-vampire-lord-bloodstone` 使用 index 32 | 血石显示吸血鬼 atlas `slot-32`；`card-unexpected` 公共定义保留但 `previewRef` 为 `undefined`，避免错用专属牌图 | `vampire-lord-intake.test.ts` `card-unexpected.previewRef` 与血石 index 32 断言 | 无 | `passed` |
| 状态 / Token 图标归属 | 吸血鬼自己的鲜血之力、催眠、流血必须使用 `xixuegui/status-icons-atlas`，不能因 `bleed` 与女猎手同名而显示 `lieren` 图集 | `tokens.ts` `atlasId` -> `statusEffects.tsx` 按当前玩家 `characterId` 优先取英雄 token 定义 -> `LeftSidebar.tsx` / `OpponentHeader.tsx` / `InteractionOverlay.tsx` / `PurifyModal.tsx` 传入当前展示玩家 | P1 状态 / Token 徽章图片来源为 `dicethrone/images/xixuegui/.../status-icons-atlas`；同名女猎手流血仍可使用 `lieren` 图集 | `StatusEffectsIcons.test.tsx` 同名状态回归；`vampire-lord-real-entry.e2e.ts` 内部注入主视角断言 `blood_power` / `mesmerize` / `bleed` 图集来源并截图 | 无 | `passed` |

## 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞完整派系完成口径 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| 利爪逐分支独立真实入口截图 | `非阻塞扩展` | 否 | 否 | 当前范围外；当前范围已由 III 5 利爪代表链 + `dt-bloodthirsty-claws-variants-damage-v1` 共享流程判等覆盖 | 如果未来需要逐截图展示每个利爪数值，可补 I/II/III 全部分支截图；当前实现审计不再以此作为 blocker。 |

## 测试语义对账与验证证据

- 命令：`npx vitest run src/games/dicethrone/__tests__/character-catalog-status.test.ts src/games/dicethrone/__tests__/vampire-lord-intake.test.ts src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native`。
- 结果：3 个测试文件通过，167 条测试通过；覆盖吸血鬼领主保留在完整目录、进入玩家可见目录、显示实施中徽标、直接玩家命令可选择，以及共享 AI 自动选角过滤实施中角色。
- 命令：`npx vitest run src/games/dicethrone/__tests__/StatusEffectsIcons.test.tsx src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts --configLoader native`。
- 结果：2 个测试文件通过，56 条测试通过；其中状态 / Token 图标测试 33 条、机制测试 23 条。
- 命令：`npm run typecheck`。
- 结果：通过，TypeScript 无新增类型错误。
- 命令：`npx openspec validate add-dicethrone-vampire-lord-faction --strict --no-interactive`。
- 结果：通过，变更包有效。
- 命令：`npm run spec:lint`。
- 结果：通过，项目规范结构校验 OK。
- 命令：`npm run audit:evidence:selfcheck -- evidence/dicethrone/dicethrone-vampire-lord-mechanics-audit-2026-08-28.md`。
- 结果：通过，审计 evidence 自检 OK。
- 命令：`node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone/vampire-lord-real-entry.e2e.ts`。
- 结果：本轮 `node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone/vampire-lord-real-entry.e2e.ts` 通过 8 条；覆盖鲜血之力 1 档加伤、2 档状态选择移除流血、3 档抽 2 张牌、4 档按已造成伤害治疗、催眠临时骰与对手骰选择重掷、嗜血之爪 III 5 利爪真实入口、不死防御真实入口、内部状态注入资源链和玩家选角实施中入口。
- 公开资源 HEAD 回查：`player-board.webp`、`tip.webp`、`ability-cards.webp`、`dice.webp`、`status-icons-atlas.webp` 均返回 `200` 且 `x-asset-source=server`；长度分别为 1515796、1588778、2094998、33522、43058。
- 证明了什么：普通效果分支、攻击修正牌、复合升级下区 variants、`slot-32` 归属、鲜血之力四档主动消费、催眠主动消费 / 5-6 强迫重掷、嗜血之爪 III 5 利爪、不死防御、获得类行动牌与普通升级壳会写入最终权威状态或正式交互；真实牌桌里鲜血之力 1/2/3/4 档玩家按钮、状态选择弹层、抽牌后手牌落位、按伤害治疗后的 HP、催眠临时骰、对手骰选择、嗜血之爪 III 5 利爪槽位触发、不死防御 4 骰、反击伤害、自疗和收口可见可用；玩家选角入口显示吸血鬼领主并带实施中标记，玩家可手动选择并进入牌桌。
- 没有证明什么：没有证明吸血鬼领主已经进入完成态或完整发布级收口。也没有逐条截图证明利爪 I/II/III 的每个 3/4/5 分支，但这些分支已按同一 variants + damage 共享流程和配置差异判等覆盖当前范围。
- 截图 / 录像 / 日志路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\鲜血之力-1-档应通过玩家板按钮给当前攻击加-3-点\吸血鬼领主-鲜血之力入口-使用前.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\鲜血之力-2-档应通过状态选择移除流血\吸血鬼领主-鲜血之力状态选择-流血可选.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\鲜血之力-3-档应通过玩家板按钮抽-2-张牌\吸血鬼领主-鲜血之力抽牌后收口.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\鲜血之力-4-档应通过玩家板按钮按已造成伤害治疗\吸血鬼领主-鲜血之力治疗后收口.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\催眠应通过玩家按钮投临时骰并选择对手骰重掷\吸血鬼领主-催眠临时骰-确认前.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\催眠应通过玩家按钮投临时骰并选择对手骰重掷\吸血鬼领主-催眠重掷后收口.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\嗜血之爪-III-5-利爪应通过真实投骰与玩家板物理槽触发-8-点攻击伤害\吸血鬼领主-嗜血之爪III槽位可触发.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\嗜血之爪-III-5-利爪应通过真实投骰与玩家板物理槽触发-8-点攻击伤害\吸血鬼领主-嗜血之爪III结算后收口.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\不死防御应通过真实防御按钮投-4-骰并结算反击与自疗\吸血鬼领主-不死防御入口-投骰前.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\不死防御应通过真实防御按钮投-4-骰并结算反击与自疗\吸血鬼领主-不死防御已投4骰.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\不死防御应通过真实防御按钮投-4-骰并结算反击与自疗\吸血鬼领主-不死防御结算后收口.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\真实在线玩家选角入口应显示实施中吸血鬼领主，玩家可选择并进入牌桌\01-选角-吸血鬼领主实施中可见并已选.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\真实在线玩家选角入口应显示实施中吸血鬼领主，玩家可选择并进入牌桌\02-牌桌-玩家选择吸血鬼领主进入牌桌.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\真实在线玩家选角入口应显示实施中吸血鬼领主，玩家可选择并进入牌桌\03-牌桌-吸血鬼领主资源链与状态图标.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\真实在线玩家选角入口应显示实施中吸血鬼领主，玩家可选择并进入牌桌\04-牌桌-吸血鬼领主骰面与关键入口.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\真实在线玩家选角入口应显示实施中吸血鬼领主，玩家可选择并进入牌桌\05-牌桌-可见对手角色视角已进入.jpg`
- 人工观察结论：状态选择截图能看到“选择要移除的状态效果”弹层、P1 的流血图标和确认按钮；收口截图回到吸血鬼领主牌桌，说明选择层已关闭。抽牌收口截图能看到手牌区新增两张吸血鬼专属卡图，鲜血之力归零；治疗收口截图能看到 P1 生命从 38 治疗到 45，右侧仍保留本次攻击造成 7 点伤害的上下文。催眠截图能看到吸血鬼骰面和右侧骰盘过程，收口后对手骰已完成重掷。嗜血之爪 III 截图能看到玩家板物理槽可触发，收口后对手生命从 50 到 42。不死防御截图能看到 4 颗吸血鬼骰，收口后攻击者生命从 50 到 49、防御方生命 42 经攻击伤害和自疗后到 39，并进入主要阶段 2。玩家选角截图实际看到吸血鬼领主卡片、黄色“实施中”标记和 P1 已选择状态。

## 修订 / 失效记录

- 旧文档路径：无旧吸血鬼机制 evidence。
- 旧结论：隐藏阶段真实入口要求玩家选角页看不到吸血鬼领主，且直接玩家命令和 AI 自动选角不得选到它。
- 本轮修订原因：当前范围实施、机制审计、资源回查和真实入口验证已推进到 `passed`；按新增派系玩家可见生命周期，吸血鬼领主可从 `hidden` 切入玩家可见的 `in_progress` 阶段。
- 当前证据：`src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts` 的结果级断言，`src/games/dicethrone/__tests__/StatusEffectsIcons.test.tsx` 的同名状态图集回归，`src/games/dicethrone/__tests__/vampire-lord-intake.test.ts` 与 `character-catalog-status.test.ts` 的实施中目录断言，`basic-commands-coverage.test.ts` 的直接命令可选 / AI 自动选角过滤实施中角色断言，以及 `e2e/dicethrone/vampire-lord-real-entry.e2e.ts` 的实施中玩家入口与内部资源链。
- 新结论：吸血鬼领主完成共享效果、攻击修正、复合升级下区 variants、`slot-32` 归属、鲜血之力 1/2/3/4 档、催眠关键主动交互、嗜血之爪 III 5 利爪代表链、不死防御真实入口验证，以及利爪其它分支的共享流程判等；完整目录和内部注入保留，玩家入口和直接玩家命令当前可用，界面保留实施中徽标，共享 AI 自动选角仍过滤实施中角色，本轮状态为 `in_progress`。

## 对外汇报口径

- 允许说：吸血鬼领主的静态接入、资源链、基础共享效果、攻击修正、复合升级下区 variants、`slot-32` 归属、鲜血之力 1/2/3/4 档、催眠关键主动交互、嗜血之爪 III 5 利爪代表链、利爪其它分支共享流程判等、不死防御真实入口、获得类行动牌、普通升级壳和一批 II 级上区结果断言已完成；当前玩家入口已进入实施中，可手动选择并显示实施中徽标。
- 禁止说：吸血鬼领主已经进入完成态、完整发布级验收通过，或利爪分支真实入口已经逐项独立截图全覆盖。
