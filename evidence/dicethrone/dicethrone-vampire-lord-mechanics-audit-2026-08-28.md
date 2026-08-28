# DiceThrone 吸血鬼领主机制实现审计

## 基本信息

- 对象：Dice Throne 新英雄吸血鬼领主（`vampire_lord` / Vampire Lord）。
- 日期：2026-08-28。
- 文档类型：`audit`。
- 关联需求：新增 DiceThrone 吸血鬼新派系，继续从静态接入进入机制实现、审计和 E2E 流程。
- 当前工作目录：`D:\gongzuo\webgame\BoardGame`。

## 本轮范围

- 本轮覆盖对象：`vampire_lord` 角色、已录入的基础技能 / 升级技能、专属行动牌、升级替换壳、鲜血之力、催眠、流血。
- 本轮覆盖规则子句：现有共享结算器能直接表达的伤害、治疗、获得 Token、施加流血、抽牌和升级替换。
- 本轮目标入口 / 环境：领域测试入口 `src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts`；不执行服务器发布。
- 明确不在本轮范围内：真实双玩家浏览器 E2E 截图、`blood_power` 主动消费增强、`mesmerize` 强迫重掷交互、复合升级牌下区效果裁定、`slot-32` 通用牌图面冲突裁定。

## 批次矩阵

| objectId | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `vampire_lord` | `passed` | `passed` | `in_progress` | `in_progress` | `pending` | `in_progress` |

判定说明：静态数据、资源链和上传回查已有独立证据；本轮新增领域结果级测试，只能把共享结算可表达的子集推进到 `passed`，不能覆盖复杂 Token 消费、强制重掷、真实 UI 或争议素材合同。

## 结论等级

结论等级：`仍有残余范围`。

判定理由：吸血鬼领主已有一组机制子句通过领域最终状态断言；但核心身份机制 `blood_power` 和 `mesmerize` 仍缺完整玩家交互与消费链，真实入口 E2E 也未跑。本文件用于把“已验证子集”和“仍在实施中的缺口”分开登记。

## 权威来源

- 主真相源：`src/games/dicethrone/rule/吸血鬼领主真相源表.md`、`src/games/dicethrone/rule/吸血鬼领主录入核对.md`、`src/games/dicethrone/rule/吸血鬼领主卡牌录入核对.md`。
- 静态定义源：`src/games/dicethrone/heroes/vampire_lord/abilities.ts`、`src/games/dicethrone/heroes/vampire_lord/cards.ts`、`src/games/dicethrone/heroes/vampire_lord/tokens.ts`。
- 领域消费源：`src/games/dicethrone/domain/effects.ts`、`src/games/dicethrone/domain/executeCards.ts`、`src/games/dicethrone/domain/reducer.ts`、`src/games/dicethrone/domain/reduceCards.ts`。
- 验证来源：`src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts`，定向命令 `npx vitest run src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts src/games/dicethrone/__tests__/vampire-lord-intake.test.ts --configLoader native`。
- 合同状态：`locked` 用于已录入的普通效果与升级替换；`blocked / disputed` 用于下方残余项。

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | 本轮只覆盖 `vampire_lord`，不外推到其它 DiceThrone 英雄。 |
| 真相源状态 | `passed` | 主真相源、静态定义源和领域消费源列在“权威来源”。 |
| 原子语义断言 | `blocked` | 下方“原子语义与实现消费”列出本轮直测对象；复杂消费语义仍 blocked。 |
| 实现消费链 | `blocked` | `effects.ts` / `executeCards.ts` / `reducer.ts` / `reduceCards.ts` 已覆盖普通效果；强制重掷和主动消费缺正式交互 owner。 |
| 最终权威结果 | `representative_only` | 本轮测试断言 HP、CP、token、状态、手牌、弃牌堆、技能等级和升级槽；真实 UI 状态未覆盖。 |
| 交互真实入口 | `blocked` | 真实双玩家浏览器 E2E 未跑；当前只有领域入口证据。 |
| 验证证据 | `passed` | `vampire-lord-mechanics.test.ts` 11 条通过；同命令中 intake 测试 4 条通过。 |
| 共享影响与代表链依据 | `blocked` | 普通 effect / 升级壳引用共享流程；`blood_power` / `mesmerize` 不能引用现有流程直接完成。 |
| 缺口分类与范围裁定 | `passed` | 下方残余范围表逐项分类。 |
| 旧 evidence / 旧结论对账回写 | `passed` | 当前无旧吸血鬼机制完成结论；本文件建立首份机制 evidence，防止把静态上传误称为完整派系完成。 |
| 残余范围声明 | `passed` | 结论等级和残余范围表均声明仍处于实施中。 |

## 共享流程审计

| sharedFlowId | 流程职责 | 一次性审计证据 | 流程不变量 | 允许配置差异 | 失效影响面 |
| --- | --- | --- | --- | --- | --- |
| `dt-effect-basic-event-v1` | 技能或行动牌效果转成 HP、token、状态、抽牌等正式事件 | `effects.ts` 的 `damage` / `heal` / `grantStatus` / `grantToken` / `drawCard` 分支；`reducer.ts` 与 `reduceCards.ts` 写入最终状态；`vampire-lord-mechanics.test.ts` 11 条覆盖吸血鬼调用 | 触发时机来自 effect timing；payload 写明目标、数值、来源；最终权威状态为 HP、token、状态、手牌 / 牌库；无额外 pending 清理 | 技能 ID、卡牌 ID、数值、目标 self/opponent、音效、图集 slot | 所有用普通 effect 建模的 DiceThrone 技能 / 行动牌 |
| `dt-replace-ability-upgrade-v1` | 普通升级牌扣 CP、移出手牌并替换玩家板基础技能 | `executeCards.ts` 产生 `CP_CHANGED` / `CARD_PLAYED` / `ABILITY_REPLACED`；`effects.ts` 生成替换事件；`reduceCards.ts` 写入 `abilityLevels` 和 `upgradeCardByAbilityId`；吸血鬼嗜血之爪 II 与其余 7 张普通升级壳直测 | 触发时机为主阶段打出升级牌；候选来自手牌升级牌；payload 为目标基础技能、替换定义和等级；最终权威状态为技能定义 / 等级 / 升级槽；不自动结算升级后技能 | `cpCost`、目标基础技能、替换等级、替换后的能力定义、卡图 slot | 所有普通替换型升级牌 |

## 原子语义与实现消费

| 对象 | 原子语义断言 | 实现消费点 | 最终权威结果 | 真实入口 / 验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| `blood-feast` | 3 个血滴技能效果：治疗自己 2，获得 3 个鲜血之力；token 上限为 5 | `abilities.ts` `healSelf` / `grantToken` -> `effects.ts` `heal` / `grantToken` -> `reducer.ts` | HP 从 44 到 46；`blood_power` 从 4 封顶到 5 | `vampire-lord-mechanics.test.ts` 鲜血盛宴测试 | 无 | `passed` |
| `rend-claws` | 小顺技能效果：给对手 1 层流血，并造成 6 点攻击伤害 | `abilities.ts` `grantBleed` / `damage` -> `effects.ts` `grantStatus` / `damage` -> `reducer.ts` | 对手 `bleed=1`；HP 从 50 到 44；伤害范围为攻击伤害 | `vampire-lord-mechanics.test.ts` 撕裂之爪测试 | 无 | `passed` |
| `bloody-slaughter` | 终极效果：获得 2 个鲜血之力，给对手 2 层流血，造成 12 点攻击伤害 | `abilities.ts` -> `effects.ts` -> `reducer.ts` | 自己 `blood_power=2`；对手 `bleed=2`；对手 HP 从 50 到 38 | `vampire-lord-mechanics.test.ts` 血色杀戮测试 | 无 | `passed` |
| `mesmerize-power` | 获得 1 催眠并造成 4 点攻击伤害；仅验证获得催眠，不验证催眠主动强迫重掷 | `abilities.ts` `grantToken` / `damage` -> `effects.ts` -> `reducer.ts` | 自己 `mesmerize=1`；对手 HP 从 50 到 46；伤害范围为攻击伤害 | `vampire-lord-mechanics.test.ts` 基础共享技能矩阵 | 无；主动消费另列 blocked | `passed` |
| `blood-possessed` | 获得 2 鲜血之力并造成 6 点攻击伤害 | `abilities.ts` `grantToken` / `damage` -> `effects.ts` -> `reducer.ts` | 自己 `blood_power=2`；对手 HP 从 50 到 44 | `vampire-lord-mechanics.test.ts` 基础共享技能矩阵 | 无 | `passed` |
| `blood-thirst` | 给对手 1 层流血并造成 4 点攻击伤害 | `abilities.ts` `grantBleed` / `damage` -> `effects.ts` -> `reducer.ts` | 对手 `bleed=1`；对手 HP 从 50 到 46 | `vampire-lord-mechanics.test.ts` 基础共享技能矩阵 | 无 | `passed` |
| `blood-magic` | 获得 2 鲜血之力并造成 7 点攻击伤害 | `abilities.ts` `grantToken` / `damage` -> `effects.ts` -> `reducer.ts` | 自己 `blood_power=2`；对手 HP 从 50 到 43 | `vampire-lord-mechanics.test.ts` 基础共享技能矩阵 | 无 | `passed` |
| `undying` / `undying-2` | 防御上下文中对攻击者造成 1 点直接反击伤害，并治疗自己 1 点 | `abilities.ts` `damage` / `healSelf` -> `effects.ts` -> `reducer.ts` | 对手 HP 从 50 到 49；自己 HP 从 47 到 48；伤害范围为直接伤害 | `vampire-lord-mechanics.test.ts` 不死之身 I / II 防御效果测试 | 真实防御入口未覆盖 | `passed for effect` |
| `card-vampire-lord-blood-surge` | 主阶段行动牌：扣 1 CP，获得 1 鲜血之力，牌进入弃牌堆 | `cards.ts` effects -> `execute.ts` / `executeCards.ts` `PLAY_CARD` -> `effects.ts` -> `reducer.ts` / `reduceCards.ts` | CP 10 到 9；`blood_power=1`；手牌清空；本牌进入弃牌堆 | `vampire-lord-mechanics.test.ts` 获得类专属行动牌矩阵 | 无 | `passed` |
| `card-vampire-lord-blood-from-above` | 主阶段行动牌：扣 1 CP，获得 1 鲜血之力，牌进入弃牌堆 | `cards.ts` effects -> `execute.ts` / `executeCards.ts` `PLAY_CARD` -> `effects.ts` -> `reducer.ts` / `reduceCards.ts` | CP 10 到 9；`blood_power=1`；手牌清空；本牌进入弃牌堆 | `vampire-lord-mechanics.test.ts` 获得类专属行动牌矩阵 | 无 | `passed` |
| `card-vampire-lord-gushing-blood` | 主阶段行动牌：获得 1 鲜血之力和 1 催眠，牌进入弃牌堆 | `cards.ts` effects -> `execute.ts` / `executeCards.ts` `PLAY_CARD` -> `effects.ts` -> `reducer.ts` / `reduceCards.ts` | `blood_power=1`；`mesmerize=1`；手牌清空；本牌进入弃牌堆 | `vampire-lord-mechanics.test.ts` 获得类专属行动牌矩阵 | 无；催眠主动消费另列 blocked | `passed` |
| `card-vampire-lord-drink-up` | 主阶段行动牌：获得 2 鲜血之力，牌进入弃牌堆 | `cards.ts` effects -> `execute.ts` / `executeCards.ts` `PLAY_CARD` -> `effects.ts` -> `reducer.ts` / `reduceCards.ts` | `blood_power=2`；手牌清空；本牌进入弃牌堆 | `vampire-lord-mechanics.test.ts` 获得类专属行动牌矩阵 | 无 | `passed` |
| `card-vampire-lord-bloodstone` | 主阶段行动牌：扣 4 CP，获得 1 催眠与 2 鲜血之力，给对手 1 流血，抽 1 张牌，牌进入弃牌堆 | `cards.ts` effects -> `execute.ts` / `executeCards.ts` `PLAY_CARD` -> `effects.ts` -> `reducer.ts` / `reduceCards.ts` | CP 10 到 6；`mesmerize=1`；`blood_power=2`；对手 `bleed=1`；手牌抽入指定牌；血石进入弃牌堆 | `vampire-lord-mechanics.test.ts` 血石测试 | 无；`slot-32` 预览冲突另列 disputed | `passed` |
| `upgrade-vampire-lord-bloodthirsty-claws-2` | 主阶段升级牌：扣 2 CP，替换嗜血之爪到 II 级，不自动结算技能本体 | `cards.ts` `replaceAbility` -> `executeCards.ts` -> `effects.ts` -> `reduceCards.ts` | CP 10 到 8；`abilityLevels.bloodthirsty-claws=2`；升级槽记录卡牌；手牌移除 | `vampire-lord-mechanics.test.ts` 嗜血之爪 II 升级壳测试 | 无 | `passed` |
| 其余 7 张普通升级壳 | slot 22/23/24/25/26/27/28 均扣 CP、替换目标基础技能、写入技能等级和升级槽 | `cards.ts` `replaceAbility` -> `executeCards.ts` -> `effects.ts` -> `reduceCards.ts` | 每张升级牌均产生 `CP_CHANGED` 与 `ABILITY_REPLACED`，并写入对应 `abilityLevels` / `upgradeCardByAbilityId` | `vampire-lord-mechanics.test.ts` 其余普通升级牌矩阵 | 复合下区不在本断言内 | `passed for upgrade shell` |
| II 级共享技能上区 | `blood-feast` / `rend-claws` / `blood-possessed` / `blood-thirst` / `blood-magic` / `mesmerize-power` 的 II 级上区效果落到 HP、token、流血和攻击伤害 | 升级替换后从 `abilities` 读取升级技能 -> `effects.ts` -> `reducer.ts` | 对应 II 级数值均写入最终 HP、token 或状态；伤害范围为攻击伤害 | `vampire-lord-mechanics.test.ts` 升级后共享技能上区矩阵 | 复合下区不在本断言内 | `passed for upper section` |
| `bloodthirsty-claws-3-5` | III 级 5 利爪分支造成 8 点攻击伤害 | 升级替换后从 `abilities` 读取分支 -> `effects.ts` `damage` -> `reducer.ts` | `abilityLevels.bloodthirsty-claws=3`；对手 HP 从 50 到 42 | `vampire-lord-mechanics.test.ts` 嗜血之爪 III 分支测试 | 其它利爪数值分支仍属共享流程待判等 | `passed` |
| `blood_power` 消费增强 | 玩家花费鲜血之力增强技能或伤害，需明确使用时机、可消耗数量、是否可跳过、是否影响当前攻击伤害 | 只有静态 token 定义和获得事件；缺正式主动使用入口 / 权限 / payload / 执行 owner | 无法证明消耗后 token 减少、伤害增加或流程清理 | 当前未实现；规则合同标为消费机制 blocked | `功能实现阻塞` | `blocked` |
| `mesmerize` 强迫重掷 | 玩家花费催眠强迫对手重掷，需明确目标骰、5-6 重掷语义、对手 / 自己骰区权限和关闭条件 | 只有静态 token 定义和获得事件；缺正式骰子选择 / 重掷交互 owner | 无法证明对手骰被重掷、token 被消耗、窗口关闭且阶段继续 | 当前未实现；规则合同标为交互机制 blocked | `功能实现阻塞` | `blocked` |
| 复合升级下区 | 多张升级牌含“升级技能 + 下区技能/效果”复合语义，需裁定是否为同一物理牌的能力 variants | `cards.ts` 目前只登记升级壳；下区效果未进入正式对象模型 | 只能证明升级壳，不能证明下区技能语义 | 卡牌录入核对标为复合下区 blocked | `合同未锁定` | `blocked` |
| `slot-32` 通用牌冲突 | 图面 `slot-32` 是“血石！”，但公共 `card-unexpected` 暂复用同 slot | `cards.ts` 仍注入通用卡并给 `card-unexpected` 同 atlas index | 可证明血石行动牌本身生效；不能证明公共牌预览合同正确 | 卡牌录入核对标为 disputed | `合同未锁定` | `disputed` |

## 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞完整派系完成口径 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| `blood_power` 主动消费增强 | `功能实现阻塞` | 是 | 是 | 当前范围内 | 从提示卡 / 规则合同补权限矩阵，再接入正式 token 使用入口和最终状态测试。 |
| `mesmerize` 强迫重掷 | `功能实现阻塞` | 是 | 是 | 当前范围内 | 建立骰子选择 / 重掷交互合同，明确授权玩家、目标骰、消耗和清理，再实现。 |
| 复合升级下区 | `合同未锁定` | 可能 | 是 | 当前范围内 | 回单卡裁图与成熟角色复合升级合同，决定下区进入能力 variants 还是独立效果。 |
| `slot-32` 公共牌预览冲突 | `合同未锁定` | 否 | 是 | 当前范围内 | 裁定公共牌图面来源；不能让“血石！”继续替代“出乎意料！”的正式预览。 |
| 真实双玩家 E2E 与截图 | `当前范围验证缺口` | 否 | 是 | 当前范围内 | 在机制子集稳定后跑真实入口，证明选角、牌桌、玩家板、提示卡、手牌、状态图标和关键交互可见。 |
| 攻击修正牌、利爪剩余分支和真实入口未逐项覆盖 | `当前范围验证缺口` | 可能 | 是 | 当前范围内 | 攻击修正牌先裁定是否进入攻击伤害主链；利爪剩余分支用共享流程判等或补最终状态测试；真实入口另跑 E2E。 |

## 测试语义对账与验证证据

- 命令：`npx vitest run src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts src/games/dicethrone/__tests__/vampire-lord-intake.test.ts --configLoader native`。
- 结果：2 个测试文件通过，15 条测试通过；其中机制测试 11 条、intake 测试 4 条。
- 证明了什么：普通效果分支会写入最终权威状态，包括 HP、CP、token 层数、流血层数、手牌 / 牌库 / 弃牌堆、技能等级和升级槽；获得类行动牌与普通升级壳有结果级覆盖。
- 没有证明什么：没有证明真实浏览器入口、玩家可见图标、`blood_power` 消费增强、`mesmerize` 重掷交互、复合升级下区和公共牌 `slot-32` 争议。
- 截图 / 录像 / 日志路径：本轮未生成截图；当前证据是领域测试输出。

## 修订 / 失效记录

- 旧文档路径：无旧吸血鬼机制 evidence。
- 旧结论：此前只有静态接入、资源链和上传回查完成，不代表派系机制完成。
- 失效原因：无失效；本文件补机制阶段首份证据。
- 替代旧结论的新证据：`src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts` 的结果级断言。
- 新结论：吸血鬼领主完成一批共享效果机制验证，整体仍保持 `in_progress`。

## 对外汇报口径

- 允许说：吸血鬼领主的静态接入、资源链、基础共享效果、获得类行动牌、普通升级壳和一批 II 级上区结果断言已完成；当前仍是实施中。
- 禁止说：吸血鬼领主派系已经完整完成、完整可玩、完整发布级验收通过，或 `blood_power` / `mesmerize` 已实现。
