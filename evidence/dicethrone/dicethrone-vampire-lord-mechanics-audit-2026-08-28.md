# DiceThrone 吸血鬼领主机制实现审计

## 基本信息

- 对象：Dice Throne 新英雄吸血鬼领主（`vampire_lord` / Vampire Lord）。
- 日期：2026-08-28；最近更新：2026-09-12（继续复查专属行动牌、升级费用、提示卡和奖励骰可见归属：`slot-17/18/19/20/21/31/32` 的旧简化合同失效，`slot-29 嗜血之爪 III` 旧 4CP 成本合同失效，`slot-30 嗜血之爪 II` 旧 2CP 成本合同失效，鲜血之力第 4 档旧“攻击阶段 / Attack Phase”文案失效；本轮按本地单卡图和提示卡重新锁定血潮汹涌、血从天降、死无全尸、沸血之力、饮血如酒、血石、嗜血之爪 II / III 成本、第 4 档投掷阶段时机，以及魔血附身奖励骰应显示攻击方吸血鬼领主归属）。
- 文档类型：`invalidation` + `audit`。
- 关联需求：新增 DiceThrone 吸血鬼新派系；修复旧审计把“角色可选 / 一条伤害代表链”误当完整派系完成的问题。
- 当前工作目录：`D:\gongzuo\webgame\BoardGame`。

## 本轮范围

- 本轮覆盖对象：`vampire_lord` 角色、玩家板基础 / 升级技能、专属行动牌、升级替换壳、鲜血之力、催眠、流血、玩家可见生命周期。
- 本轮重点规则子句：旧“+1 伤害”问题已不是当前讨论核心；继续扩审的是专属行动牌旧录入把不同卡牌简化成统一获得血力、统一攻击修正 +1 或错误抽牌的问题，以及嗜血之爪 I / II / III 的伤害、相同数字奖励和 `slot-29/30` 升级费用角标。
- 本轮目标入口 / 环境：领域测试入口 `src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts`，目录 / 命令 / AI 候选测试，真实浏览器入口 `e2e/dicethrone/vampire-lord-real-entry.e2e.ts`。
- 明确不在本轮范围内：扩大到其它 DiceThrone 英雄或新增未锁定规则；本轮仅收口吸血鬼领主当前锁定范围，不把结论外推到其它英雄。

## 批次矩阵

| objectId | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `vampire_lord` | `passed` | `passed` | `passed` | `passed` | `passed` | `in_progress` |

判定说明：静态数据、资源链和已上传素材仍保留有效；旧 evidence 中“完成态 / 当前范围已收口”的旧结论曾被嗜血之爪漏审推翻，2026-09-11 又确认专属行动牌旧合同仍传播“获得类统一处理 / 攻击修正统一 +1 / 血石抽牌”等错误，并确认 `slot-29 嗜血之爪 III` 图面为 2CP、旧 4CP 合同失效，`slot-30 嗜血之爪 II` 图面为 1CP、旧 2CP 合同失效。当前已按本地卡图补齐鲜血之力四档、催眠 token 入口、嗜血之爪奖励、专属行动牌逐卡结算和嗜血之爪 II / III 成本；角色仍为 `in_progress`，移除实施中标记必须经过真人明确批准。

## 结论等级

结论等级：`当前范围已收口`。

判定理由：旧审计先漏掉嗜血之爪的附加奖励，随后又把鲜血之力四档的完整原文错误录成“不消耗、不限次”，并把多张专属行动牌按当前测试会用到的字段简化录入；本轮继续确认 `slot-29/30` 费用角标也被旧合同分别错写为 4CP / 2CP。项目通用录入规范本来要求完整登记所有有特殊含义的文字、数字、图案、颜色、区域关系和限定词；本次不是规范根本缺失，而是执行没有逐卡回到本地卡图，旧测试和旧 evidence 又把不完整合同标成了 `passed`。当前代码、领域测试、规则合同和本 evidence 已按本地卡图重新核对。

## 权威来源

- 主真相源：`src/games/dicethrone/rule/吸血鬼领主真相源表.md`、`src/games/dicethrone/rule/吸血鬼领主录入核对.md`、`src/games/dicethrone/rule/吸血鬼领主卡牌录入核对.md`。
- 关键图面裁图：`temp/dicethrone-intake/xixuegui/rule-audit-crops/bloodthirsty-claws-board-2x.png`、`temp/dicethrone-intake/xixuegui/rule-audit-crops/slot-29-4x.png`、`temp/dicethrone-intake/xixuegui/rule-audit-crops/slot-30-4x.png`、`temp/dicethrone-intake/xixuegui/ability-card-slots/contact-sheet-focus-17-32.png`、`temp/dicethrone-intake/xixuegui/ability-card-slots/contact-sheet-focus-22-30.png`、`temp/dicethrone-intake/xixuegui/ability-card-slots/slot-17.webp`、`slot-18.webp`、`slot-19.webp`、`slot-20.webp`、`slot-21.webp`、`slot-29.webp`、`slot-30.webp`、`slot-31.webp`、`slot-32.webp`。
- 静态定义源：`src/games/dicethrone/heroes/vampire_lord/abilities.ts`、`src/games/dicethrone/heroes/vampire_lord/cards.ts`、`src/games/dicethrone/heroes/vampire_lord/tokens.ts`。
- 领域消费源：`src/games/dicethrone/domain/effects.ts`、`src/games/dicethrone/domain/customActions/vampire_lord.ts`、`src/games/dicethrone/domain/rules.ts`、`src/games/dicethrone/domain/reducer.ts`。
- 合同状态：`locked` 用于嗜血之爪图面伤害、相同数字阈值奖励、专属行动牌逐卡语义、吸血鬼状态 / Token 图集归属和实施中玩家可见生命周期；官方 FAQ / 官方商店 / RulePop / Fandom 只能作外部对照和冲突提示，不能覆盖本地卡图。

## 图片合同与裁图清单

本轮实际读取过的素材全部登记在本节；图片只负责确认图面对象、槽位和规则文字，结构化规则仍以三份吸血鬼规则合同为唯一可执行数据来源。

| 图面对象 | 主裁图 / 裁图清单 | SHA256 | 录入用途 | 处置 |
| --- | --- | --- | --- | --- |
| 玩家板 | `temp/dicethrone-intake/xixuegui/player-board-preview.png`；`rule-audit-crops/bloodthirsty-claws-board-2x.png` | `905F7265E0212D3E0EDE01132BCD2052DA6B88C24520E257B2563ACBAE824C54`；`ACFF2EE0919BFB8A26D6F5367EA10CB647970BFEB7674DC864AEA24477EDEE35` | 九个物理技能槽和嗜血之爪 `fist` 槽 | 已登记并进入正式玩家板资源链 |
| 提示卡 | `public/assets/i18n/zh-CN/dicethrone/images/xixuegui/tip.jpg`；`temp/dicethrone-intake/xixuegui/tip-preview.png` | `D5E953B6E986731572C5F1F67CFDD99C6690ADF569A30CFDDE0DF39018ACEED8` | 鲜血之力四档的门槛、成本、效果、每回合限制和第 4 档“只能在你的投掷阶段激活”时机 | 已登记并锁定规则合同；旧“攻击阶段 / Attack Phase”文案已回写为提示卡口径 |
| 能力卡图集 | `temp/dicethrone-intake/xixuegui/ability-card-slots/slot-00.webp` 至 `slot-32.webp`，共 33 张完整单卡主裁图；重点复核联系表 `contact-sheet-focus-17-32.png` 和 `contact-sheet-focus-22-30.png` | `1DA9CF2722503DA3F183AB78E05846A95613191E767AE17ADB0F8D1BF7A3B8BE`（`slot-17/18/19/20/21/31/32` 联系表）；`4F591C636B786BA18A846BDB29DC366DA3EE2418E61D34429532B9D1D441B531`（`slot-22..30` 联系表） | 卡牌标题、费用角标、类型、slot、升级上下区和公共卡归属 | 已登记；裁图使用 `ability-cards-vampire_lord.atlas.json`，运行时同样消费该 atlas |
| 嗜血之爪规则裁图 | `temp/dicethrone-intake/xixuegui/rule-audit-crops/slot-29-4x.png`、`slot-30-4x.png` | `A0C5CC28B98F1A31D465114E1DBBA1658BF815DE3B60DBC7DD368C8860D5A648`；`430AFA7B2CC03AFA6A9E72152170147FF0B8D5D352A3625758F73ED66BBF8D65` | 三同 / 四同奖励和等级分支交叉核对 | 已登记并拆入嗜血之爪原子语义 |
| 升级费用 slot-29/30 | `temp/dicethrone-intake/xixuegui/ability-card-slots/slot-29.webp`、`slot-30.webp` | `57A804CA7D845ADC9C8D1F6564C48819EACB1A4B58BE4FC42C69815FB3832CF4`；`A46FEA7E0DB6C7C23223DD97484E27028FE649D85465C0291568454A29EE543F` | 嗜血之爪 III 左侧费用角标为 2 CP，嗜血之爪 II 左侧费用角标为 1 CP；旧 4 CP / 2 CP 合同失效 | 已登记并同步到运行时 `cpCost`、测试和规则合同 |
| 专属行动牌 17/18 | `temp/dicethrone-intake/xixuegui/ability-card-slots/slot-17.webp`、`slot-18.webp` | `36D76F503FEB6780873A12E2F7BA635E03773F0AEFDD6A62F2820C06DC8B95D1`；`A9AE0772C146244554DDF47E27C6AB2EC3A7D0C1C0013FCBC429D21F7813DF08` | 血潮汹涌 0 CP、利爪 / 否则分支；血从天降 1 CP、骰值一半向上取整 | 已登记并拆入专属行动牌原子语义 |
| 攻击修正牌 19/20 | `temp/dicethrone-intake/xixuegui/ability-card-slots/slot-19.webp`、`slot-20.webp` | `B5106D8801202F3BD52DF71EFB89209C228626A15F14D2264CA4F6D59FE29DA2`；`84EB217446B0E2D3B44085A2B82A2CE2843B41A1CC91C1C1BAFD354DF9C3C77C` | 死无全尸 1 CP、5 骰血滴加伤 / 3+ 流血；沸血之力 0 CP、基础 +1 和按对手流血层数追加 | 已登记并拆入攻击修正原子语义 |
| 专属行动牌 21 | `temp/dicethrone-intake/xixuegui/ability-card-slots/slot-21.webp` | `10DB70ABA43249FEC46F39A20F65F0E4F58626B693A09B473A15631971000C76` | 血流如注 0 CP，获得 1 鲜血之力和 1 催眠 | 已登记并保留独立最终状态断言 |
| 专属行动牌 31/32 | `temp/dicethrone-intake/xixuegui/ability-card-slots/slot-31.webp`、`slot-32.webp` | `C5460E8D400A3862D051582DD33002CEADAA387F359E1C8C53B29D0A5D12B814`；`7A41C2CFCDE7C0436292D4DF05619DF3A6753803014F8F20A3C1235646892BB2` | 饮血如酒 0 CP、至少花费 2 鲜血之力 / 每个 2 CP；血石 4 CP、催眠 + 鲜血之力 + 流血且无抽牌 | 已登记并拆入专属行动牌原子语义 |

裁图清单即本轮 `crop manifest`：玩家板 1 张总览 + 1 张规则裁图，提示卡 1 张，能力卡 `slot-00..32` 33 张单卡，嗜血之爪规则裁图 2 张，并在 2026-09-11 用 `contact-sheet-focus-17-32.png` 重点复看 `slot-17/18/19/20/21/31/32`，用 `contact-sheet-focus-22-30.png`、`slot-29.webp` 与 `slot-30.webp` 复看升级牌费用和上下区；未以未登记图片推导运行时规则。

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | 本轮只覆盖 `vampire_lord`，不外推到其它 DiceThrone 英雄。 |
| 真相源状态 | `passed` | 三份吸血鬼规则合同、提示卡原图、嗜血之爪规则裁图、`slot-17/18/19/20/21/31/32` 单卡图、`contact-sheet-focus-22-30.png`、`slot-29.webp` 和 `slot-30.webp` 已锁定当前范围。 |
| 原子语义断言 | `passed` | 嗜血之爪已拆成利爪数量伤害、相同数字阈值、鲜血之力最终状态、攻击骰快照和升级费用；专属行动牌已拆成投骰分支、向上取整、加伤来源、流血层数、花费选择和不抽牌负向断言。 |
| 实现消费链 | `passed` | `abilities.ts` 写入 postDamage custom action；`cards.ts` 与 `customActions/vampire_lord.ts` 分别消费专属行动牌的投骰、选择、状态、抽牌和攻击修正合同。 |
| 最终权威结果 | `passed` | 领域测试断言对手 HP、攻击者 `blood_power`、卡牌弃牌堆、手牌 / 牌库、流血层数、CP 和防御骰不污染攻击骰快照；E2E 断言结算后鲜血之力为 1/5，且魔血附身奖励骰确认前显示为攻击方吸血鬼领主骰。 |
| 交互真实入口 | `passed` | 四档鲜血之力、催眠、魔血附身奖励骰归属、嗜血之爪、不死防御和实施中玩家入口已分别通过真实入口；审计前隐藏态与中间实施态历史门禁也有独立证据。 |
| 验证证据 | `passed` | 见“测试语义对账与验证证据”。 |
| 共享影响与代表链依据 | `passed` | 旧 `dt-bloodthirsty-claws-variants-damage-v1` 已降级；旧“获得类行动牌”和旧“攻击修正 +1”测试合同也已降级，不能再作为规则真相。 |
| 缺口分类与范围裁定 | `passed` | 本轮已完成当前范围复核；仅保留非阻塞的逐分支截图扩展。 |
| 旧 evidence / 旧结论回写 | `passed` | 本文件已回写旧完成态、旧“不消耗 / 不限次”、旧“专属行动牌统一获得血力 / 血石抽牌 / 攻击修正统一 +1”、旧 `slot-29` 4CP、旧 `slot-30` 2CP 和旧鲜血之力第 4 档“攻击阶段 / Attack Phase”结论失效，规则合同已同步。 |
| 残余范围声明 | `passed` | 当前锁定范围无阻塞残余；I/II 分支逐条浏览器截图属于非阻塞展示扩展，已有逐分支领域最终状态测试和共享流程判等证据。 |

## 共享流程审计

| sharedFlowId | 流程职责 | 一次性审计证据 | 流程不变量 | 允许配置差异 | 失效影响面 |
| --- | --- | --- | --- | --- | --- |
| `dt-effect-basic-event-v1` | 技能或行动牌效果转成 HP、token、状态、抽牌等正式事件 | `effects.ts` 普通 effect 分支，`reducer.ts` 与 `reduceCards.ts` 写入最终状态，`vampire-lord-mechanics.test.ts` 覆盖吸血鬼调用 | 触发时机来自 effect timing；最终权威状态为 HP、token、状态、手牌 / 牌库 | 技能 ID、卡牌 ID、数值、目标、音效、图集 slot | 所有用普通 effect 建模的 DiceThrone 技能 / 行动牌 |
| `dt-replace-ability-upgrade-v1` | 普通 / 复合升级牌扣 CP、移出手牌并替换玩家板基础技能 | `executeCards.ts` / `effects.ts` / `reduceCards.ts`，吸血鬼升级壳测试 | 主阶段打出升级牌；最终权威状态为技能定义、等级、升级槽 | `cpCost`、目标基础技能、替换等级、升级后 variants | 所有替换型升级牌 |
| `dt-bloodthirsty-claws-damage-and-kind-blood-power-v2` | 嗜血之爪按升级等级和利爪数量造成伤害，并按相同数字阈值获得鲜血之力 | `abilities.ts` 三个等级 variants 均包含 damage + `vampire-lord-bloodthirsty-claws-blood-power-if-kind`；`customActions/vampire_lord.ts` 读取攻击骰快照；领域测试覆盖 I/II/III 和快照负向；E2E 覆盖 III 5 利爪三同 | 触发时机为进攻投骰确认后点击玩家板 `fist` 槽；候选生成、权限判断、payload、执行入口、最终 HP / token 状态、攻击上下文清理一致 | `level`、`variantId`、`requiredClawCount`、`damageAmount`、相同数字阈值 3 或 4 | 吸血鬼领主 `bloodthirsty-claws` I/II/III 的 3/4/5 利爪分支 |

旧 `dt-bloodthirsty-claws-variants-damage-v1` 仅覆盖伤害，不覆盖获得鲜血之力这个最终权威状态；不得再用它支撑嗜血之爪全分支完成结论。

## 原子语义与实现消费

| 对象 | 原子语义断言 | 实现消费点 | 最终权威结果 | 真实入口 / 验证证据 | 缺口分类 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| `bloodthirsty-claws` I | 3/4/5 利爪分别造成 3/5/7 点攻击伤害；若攻击骰里有 4 个相同数字，攻击者获得 1 个鲜血之力；未达四同不得获得 | `abilities.ts` 基础 variants -> `damage` + `bloodthirstyClawsBloodPowerIfKind(4)`；`customActions/vampire_lord.ts` -> `getAttackMaxDuplicateValueCount` | 对手 HP 按伤害下降；攻击者 `blood_power` 增加 1 且不超过上限 | `vampire-lord-mechanics.test.ts` I 级四同 / 五同最终状态断言 | 已修功能实现阻塞 | `passed for domain` |
| `bloodthirsty-claws` II | 3/4/5 利爪分别造成 3/5/7 点攻击伤害；若攻击骰里有 3 个相同数字，攻击者获得 1 个鲜血之力 | `abilities.ts` II variants -> `bloodthirstyClawsBloodPowerIfKind(3)` | 对手 HP 按伤害下降；攻击者 `blood_power` 增加 1 | `vampire-lord-mechanics.test.ts` II 级三同 / 五同最终状态断言 | 已修功能实现阻塞 | `passed for domain` |
| `bloodthirsty-claws` III | 3/4/5 利爪分别造成 4/6/8 点攻击伤害；若攻击骰里有 3 个相同数字，攻击者获得 1 个鲜血之力 | `abilities.ts` III variants -> `damage` + `bloodthirstyClawsBloodPowerIfKind(3)`；E2E 点击玩家板 `fist` 物理槽 | E2E 中对手 HP 50 -> 42；攻击者 `blood_power` 0 -> 1；攻击上下文清空并进入主阶段 2 | `vampire-lord-mechanics.test.ts`；`vampire-lord-real-entry.e2e.ts` 截图组 | 已修功能实现阻塞 | `passed for domain and real entry` |
| `upgrade-vampire-lord-bloodthirsty-claws-3` | `slot-29` 嗜血之爪 III 左侧图面费用为 2 CP；旧运行时和合同写成 4 CP，属于费用角标录入错误 | `cards.ts` 的 `cpCost` 与升级替换效果；`reduceCards.ts` 写入升级槽成本快照 | 主阶段打出后 CP 10 -> 8，技能升级到 III 级，升级槽记录成本 2 CP | `slot-29.webp`；`contact-sheet-focus-22-30.png`；`vampire-lord-mechanics.test.ts` 升级壳最终状态断言 | 旧录入合同错误，当前已修 | `passed` |
| `upgrade-vampire-lord-bloodthirsty-claws-2` | `slot-30` 嗜血之爪 II 左侧图面费用为 1 CP；旧运行时和合同写成 2 CP，属于费用角标录入错误 | `cards.ts` 的 `cpCost` 与升级替换效果；`reduceCards.ts` 写入升级槽成本快照 | 主阶段打出后 CP 10 -> 9，技能升级到 II 级，升级槽记录成本 1 CP | `slot-30.webp`；`contact-sheet-focus-22-30.png`；`vampire-lord-mechanics.test.ts` 升级壳最终状态断言 | 旧录入合同错误，当前已修 | `passed` |
| 攻击骰快照 | 嗜血之爪奖励必须读取发起攻击时的骰值，不能被防御阶段当前骰覆盖 | custom action 注册 `usesAttackDiceSnapshot: true`，最终读取攻击上下文中的 `attackDiceValues` | 攻击骰无三同则不加血力；即使当前骰区防御骰全相同也不得误加 | `vampire-lord-mechanics.test.ts` 快照负向断言 | 已修语义不一致风险 | `passed` |
| `blood-possessed` 奖励骰可见归属 | 基础魔血附身是攻击方造成 7 点伤害后再投 1 颗奖励骰；即使奖励骰暂时显示在右侧栏，也必须让玩家看出它是攻击方吸血鬼领主投出的骰子，不得因右侧座位位置误认成防御方骰 | `rollContext.ts` 将奖励骰上下文转换为攻击方 `ownerId` 和 `vampire_lord-dice`；`RightSidebar.tsx` 显示奖励骰归属标签；`DiceTray.tsx` 按每颗骰子的 `definitionId` 渲染骰面 | 奖励骰确认前，当前奖励骰 owner 为 `0`、骰子定义为 `vampire_lord-dice`、可见标签为“吸血鬼领主的奖励骰”；确认后利爪结果对防御方施加 1 层流血 | `vampire-lord-mechanics.test.ts` 魔血附身规则用例；`DiceTray.test.tsx`；`active-modifiers-undo.test.ts`；`vampire-lord-real-entry.e2e.ts` 单用例截图组 | 玩家可见归属缺口，当前已补 UI 与真实入口回归 | `passed for domain, UI and real entry` |
| `card-vampire-lord-blood-surge` | 血潮汹涌不是直接获得 1 鲜血之力，也不是 1 CP 牌；卡图写明 0 CP 后投 1 骰，利爪获得 3 鲜血之力，否则抽 1 张牌 | `cards.ts` 使用 0 CP 和 `rollDie` 条件分支，利爪给 `blood_power`，默认分支抽牌，骰子确认只结算分支不把骰点当伤害 | 0 CP 也可打出；利爪场景结算后鲜血之力 0 -> 3；非利爪场景不加血力且抽 1 张；卡牌进入弃牌堆 | `slot-17.webp`；`vampire-lord-mechanics.test.ts` 血潮汹涌两分支最终状态断言 | 旧录入合同错误，当前已修 | `passed` |
| `card-vampire-lord-blood-from-above` | 血从天降不是固定获得 1 鲜血之力；卡图写明扣 1 CP 后投 1 骰，获得该骰值一半向上取整的鲜血之力 | `cards.ts` 走吸血鬼专属 custom action；`customActions/vampire_lord.ts` 在奖励骰确认后按最终骰值 `ceil(value / 2)` 发放鲜血之力 | 掷出 5 时获得 3 鲜血之力；不造成伤害；卡牌扣 1 CP 并进入弃牌堆 | `slot-18.webp`；`vampire-lord-mechanics.test.ts` 掷 5 获得 3 血力断言 | 旧录入合同错误，当前已修 | `passed` |
| `card-vampire-lord-total-demise` | 死无全尸不是固定 +1；卡图写明扣 1 CP、攻击修正投 5 骰，每个血滴 +1 伤害，至少加总 3 伤害时施加流血 | `cards.ts` 走吸血鬼专属 custom action；`customActions/vampire_lord.ts` 投 5 骰、按血滴数量写入当前攻击加伤，3+ 血滴再施加流血 | 3 个血滴结算后当前攻击修正 +3、对手获得 1 层流血；不直接扣对手 HP | `slot-19.webp`；`vampire-lord-mechanics.test.ts` 3 血滴攻击修正与流血断言 | 旧测试合同错误，当前已修 | `passed` |
| `card-vampire-lord-boiling-blood` | 沸血之力不是固定 +1；卡图写明 0 CP 攻击修正，基础 +1，此外被攻击对手每有 1 层流血再 +1 | `cards.ts` 走吸血鬼专属 custom action；`customActions/vampire_lord.ts` 读取被攻击对手当前流血层数后写入攻击修正 | 对手有 2 层流血时当前攻击修正合计 +3；不直接扣对手 HP | `slot-20.webp`；`vampire-lord-mechanics.test.ts` 2 层流血 +3 断言 | 用户点名旧 bug 已修，当前作为同类扩审证据保留 | `passed` |
| `card-vampire-lord-gushing-blood` | 血流如注是 0 CP 行动牌，直接获得 1 鲜血之力和 1 催眠，作为专属行动牌的简单获得类保留独立断言 | `cards.ts` 普通效果发放 `blood_power` 和 `mesmerize` | 鲜血之力 0 -> 1，催眠 0 -> 1；卡牌进入弃牌堆 | `slot-21.webp`；`vampire-lord-mechanics.test.ts` 最终状态断言 | 旧聚合测试拆分后保留 | `passed` |
| `card-vampire-lord-drink-up` | 饮血如酒不是获得 2 鲜血之力；卡图写明 0 CP、至少花费 2 鲜血之力，然后每花费 1 个获得 2 CP | `cards.ts` 用持有门槛拦截低于 2 个鲜血之力；`customActions/vampire_lord.ts` 生成 2..当前持有数量的花费选择，选择后消耗血力并增加 CP | 只有 1 个鲜血之力时不能打出；持有 4 个时出现花费 2/3/4 选项；选 3 后鲜血之力 4 -> 1，CP 0 -> 6 | `slot-31.webp`；`vampire-lord-mechanics.test.ts` 正式命令拒绝与选择结算断言 | 旧录入合同错误，当前已修 | `passed` |
| `card-vampire-lord-bloodstone` | 血石不是抽牌牌；卡图写明扣 4 CP，获得 1 催眠和 2 鲜血之力，并对一名对手施加 1 层流血 | `cards.ts` 保留催眠、鲜血之力和流血三个效果，移除抽牌效果 | 扣 4 CP 后催眠 0 -> 1、鲜血之力 0 -> 2、对手流血 0 -> 1；手牌清空、牌库不被抽走、血石进弃牌堆 | `slot-32.webp`；`vampire-lord-mechanics.test.ts` 不抽牌负向断言 | 旧录入合同错误，当前已修 | `passed` |
| `vampire-lord-mesmerize` 主动消费 | 不是任意时刻可点；对手确认当前骰区后，若仍有可重掷的对手骰子，必须打开 `afterRollConfirmed` 响应窗口，左侧催眠 token 本体高亮并成为主入口。点击后消耗 1 个催眠并投 1 颗临时骰；5/6 后选择 1 颗对手骰强迫重掷 | `tokens.ts` 的 Token 主动使用定义要求 `requiresOpponentRollDice`，`rules.ts` 将可用 active roll token 纳入响应队列，`commandValidation.ts` 和 `executeTokens.ts` 校验当前响应窗口与可重掷骰区，`LeftSidebar.tsx` 只把合法 token 本体标成可点，`customActions/vampire_lord.ts` 生成临时骰和对手骰选择交互 | 对手正式确认骰后响应窗口出现；催眠 token 本体可见且有可用高亮；旧右侧“催眠重掷”按钮不存在；点击 token 本体后催眠 1 -> 0；临时骰为 6；对手骰可选、选中后确认按钮可用；确认后对手骰 6 -> 2，响应窗口和交互清空 | `vampire-lord-mechanics.test.ts`；`LeftSidebar.test.tsx`；`vampire-lord-real-entry.e2e.ts`；`vampire-lord-mesmerize-after-roll-response-pass-2026-09-12.json` | 已按项目 UI 规范改回 token 本体入口，并把 9/11 旧按钮 / 非开窗证据降级为历史证据 | `passed for domain and real entry` |
| 玩家可见生命周期 | 审计通过后进入实施中；真人明确批准后才移除实施中标记进入完成态 | `core-types.ts` 生命周期过滤与徽标 | 玩家入口在审计前隐藏；实施中允许玩家选择并显示标记；完成态才允许玩家与 AI 选择且无标记 | 隐藏态与实施中生命周期 E2E、目录 / 命令 / AI 测试；完成态仅保留历史候选证据 | 当前已进入实施中，等待真人批准 | `passed` |

## 阶段、触发队列与流程收口证据

- 嗜血之爪的触发时机是进攻投骰确认后，玩家点击玩家板 `fist` 槽；合法候选由 DiceThrone AI / 命令校验链生成并校验，执行入口由 `abilities.ts` 的后置效果和 `customActions/vampire_lord.ts` 消费。
- 真实 E2E 逐步确认：投骰前 -> 投出 5 个利爪且三同 -> `fist` 槽可触发 -> 进入防御阶段 -> 防御确认 -> 结算收口。结算最终状态为主阶段 2、对手生命 42、攻击者鲜血之力 1、攻击上下文为空，并出现 `DAMAGE_DEALT`、`TOKEN_GRANTED`、`ATTACK_RESOLVED` 三类正式事件。
- 魔血附身真实 E2E 逐步确认：玩家板 `combo` 槽触发基础魔血附身 -> 对手进入防御并确认 -> 伤害后生成奖励骰；奖励骰确认前当前投骰者、第一颗可见骰和右侧可见标签均指向攻击方 `0` / `vampire_lord-dice` / 吸血鬼领主，确认后利爪结果给防御方 1 层流血。
- 不死防御真实 E2E 逐步确认：进入防御阶段 -> 显示 4 颗吸血鬼骰 -> 玩家确认骰面 -> 点击结束防御 -> 进入主阶段 2；最终攻击上下文为空，并同时落地反击伤害、自疗和 `ATTACK_RESOLVED`。
- 鲜血之力四档真实 E2E 逐档确认按钮入口、使用后的扣除事件、对应效果和本回合禁用；第二档无可移除状态时保持可发现但禁用，不产生状态选择残留。上述证据覆盖触发队列、阶段推进、确认边界、正式事件和无残留收口。
- 催眠真实 E2E 重新确认：对手通过正式确认当前骰区后打开 `afterRollConfirmed` 响应窗口；合法时机下左侧催眠 token 本体有静态可用高亮、可点击且中心点命中 token 命中区；旧右侧“催眠重掷”按钮不存在。点击 token 本体后消耗催眠并投临时骰，5/6 后对手骰本体变为可选，确认后对手骰被正式重掷，响应窗口与选择状态清空。2026-09-12 当前 PASS 清单：`evidence/dicethrone/vampire-lord-mesmerize-after-roll-response-pass-2026-09-12.json`。

其它基础共享效果、鲜血之力四档主动能力、催眠主动消费、复合升级下区 variants、不死防御入口链的旧低层证据仍可作为当前实现证据保留；专属行动牌和攻击修正牌的旧聚合证据已被逐卡原子语义替换，不能再用“获得类 / +1 类”概括。

## 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞完整派系完成口径 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| 嗜血之爪相同数字奖励旧漏项 | `功能实现阻塞` | 否，当前已修 | 否，已补齐并重新验证 | 当前范围内，已补实现和测试 | 保留 I/II/III 阈值测试、快照负向测试和 III 真实入口截图组 |
| 专属行动牌旧简化合同 | `功能实现阻塞` | 否，当前已修 | 否，已补齐逐卡领域测试 | 当前范围内，已补血潮汹涌、血从天降、死无全尸、沸血之力、血流如注、饮血如酒和血石 | 保留逐卡卡图合同和最终状态测试；不得再用“获得类 / 攻击修正 +1”聚合断言 |
| 录入裁图工具默认配置不匹配 | `审计留档缺口` | 否，当前已修 | 否，已补项目 workflow 和工具验证 | 吸血鬼正式卡图是 1910x4348、运行时 atlas 是 `ability-cards-vampire_lord.atlas.json` 的 5x7 物理卡槽；旧临时重切若误用 common 4x10 atlas 会错位 | `extract-dicethrone-intake-crops.mjs` 已改为默认优先选择角色专属 atlas；直接 `node` 入口已验证 `xixuegui` 与 `vampire_lord` 都命中吸血鬼专属配置，npm 11 双分隔符入口已实测命中吸血鬼专属 atlas，避免吞掉 `--hero` |
| 旧完成态 evidence 继续传播 | `审计留档缺口` | 否 | 否，已回写并替换当前引用 | 当前范围内，本文原地回写 | 规则合同、OpenSpec 和当前截图均使用新完成态口径 |
| Wiki / Fandom 对照 | `非阻塞对照` | 否 | 否 | Fandom API 可读到角色页、`Blood Power`、`Mesmerize`、`Bleed` 状态页；状态规则与本地提示卡大体一致。未找到 `Boiling Blood`、`Blood from Above`、`Total Demise` 单卡页；角色页 `Extra Card / Promo / BLOOD TIDE!` 是额外 Promo 记录，不能直接覆盖本地 `slot-17` 中文卡图。 | 继续以本地完整卡图和规则合同为第一真相；若后续获得官方高清图或 FAQ 原文，再登记为对照源 |
| 玩家入口当前状态 | `当前范围验证缺口` | 否 | 否 | 审计后的实施中入口已通过；真人批准前不得切入完成态，AI 继续过滤实施中角色 | 等待真人明确批准后再切换完成态并重跑完成态入口 |
| 利爪 I/II 每个分支逐条浏览器截图 | `非阻塞扩展` | 否 | 否，前提是 v2 共享流程判等表保持成立 | 当前范围外扩展 | 如用户要求逐分支展示，再补 I/II 真实入口截图组 |

## 测试语义对账与验证证据

- 命令：`npx vitest run src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts --reporter=dot`。
- 结果：2026-09-12 复跑领域机制测试 37 条通过；当前覆盖四档鲜血之力、催眠 token 入口、嗜血之爪奖励、嗜血之爪 II 扣 1 CP 升级、血潮汹涌两分支、血从天降向上取整、死无全尸 5 骰 / 3+ 流血、沸血之力 2 层流血 +3、饮血如酒花费选择和血石不抽牌。本轮同步修正催眠测试夹具，让直接 / 管线用例进入真实 `afterRollConfirmed` 响应窗口后再使用催眠。
- 命令：`npm run typecheck`。
- 结果：2026-09-12 本轮复跑通过，TypeScript 无新增类型错误。
- 命令：`npm run i18n:check`。
- 结果：2026-09-12 本轮复跑通过，未发现缺失文案键；保留既有 legacy warning baseline 1 条。
- 命令：`npm run audit:evidence:selfcheck -- evidence/dicethrone/dicethrone-vampire-lord-mechanics-audit-2026-08-28.md`。
- 结果：2026-09-12 本轮复跑通过，审计 evidence 结构自检 OK。
- 命令：`npx vitest run src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts src/games/dicethrone/__tests__/vampire-lord-intake.test.ts src/games/dicethrone/__tests__/character-catalog-status.test.ts src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`。
- 结果：2026-09-12 本轮定向测试 4 个文件、208 条通过；覆盖完整目录保留吸血鬼领主、实施中生命周期、直接玩家命令和 AI 过滤，以及四档鲜血之力成本 / 限制。审计前隐藏态过滤证据作为历史门禁保留，当前实施中状态由本轮 E2E 和状态源核对。
- 命令：`npx vitest run src/games/dicethrone/ui/__tests__/DiceTray.test.tsx src/games/dicethrone/__tests__/active-modifiers-undo.test.ts --reporter=dot`。
- 结果：2026-09-12 重新通过 2 个文件、29 条；覆盖奖励骰骰面按自身 `definitionId` 渲染、右侧栏奖励骰可见归属标签，以及既有骰盘交互不回归。
- 命令：`npx vitest run src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts -t "魔血附身" --reporter=dot`。
- 结果：2026-09-12 重新通过 1 个文件、3 条相关用例；确认魔血附身基础版和 II 级上区领域结算仍按规则合同。
- 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/vampire-lord-real-entry.e2e.ts "魔血附身基础版的奖励骰"`。
- 结果：2026-09-12 通过 1 条；覆盖魔血附身真实玩家板入口、伤害后奖励骰确认窗口、奖励骰 owner/definition/可见归属标签、吸血鬼骰面资源和确认后流血结算。
- 命令：`npx tsc --noEmit --pretty false`。
- 结果：通过，TypeScript 无新增类型错误。
- 命令：`node scripts/infra/run-e2e-command.mjs isolated e2e/dicethrone/vampire-lord-real-entry.e2e.ts`。
- 结果：旧范围隔离真实入口 9 条已通过，覆盖四档鲜血之力、催眠、嗜血之爪、不死防御和实施中玩家入口；2026-09-11 新增的专属行动牌手牌真实入口另用下方 grep 目标单跑通过。审计前隐藏态入口的历史证据另行保留，完成态候选截图不作为当前完成依据。
- 命令：`node scripts/infra/run-e2e-command.mjs isolated e2e/dicethrone/vampire-lord-real-entry.e2e.ts --grep "血潮汹涌、血从天降、饮血如酒|鲜血之力 4 档应通过玩家板按钮按已造成伤害治疗|血色杀戮应通过玩家板终极技打开抽牌堆搜牌交互并结算"`。
- 结果：2026-09-12 重新通过 3 条；覆盖用户点名的血潮汹涌 / 血从天降 / 饮血如酒真实手牌入口、鲜血之力第 4 档消耗 4 个后吸血治疗，以及血色杀戮从抽牌堆搜牌并加入手牌。运行中 shared-single 端口预留失败后自动回退到 isolated runtime，不是规则测试失败。
- 命令：`node scripts/infra/run-e2e-command.mjs isolated e2e/dicethrone/vampire-lord-real-entry.e2e.ts --grep "催眠应通过点击 token 本体投临时骰并选择对手骰重掷"`。
- 结果：2026-09-11 重新通过 1 条；补强断言覆盖 token 本体可用高亮、中心点命中、旧右侧催眠按钮不存在、临时骰、对手骰选择、确认按钮和重掷收口；同时生成本轮专用 PASS 图组。
- 命令：`node scripts/infra/run-e2e-command.mjs isolated e2e/dicethrone/vampire-lord-real-entry.e2e.ts --grep "血潮汹涌、血从天降、饮血如酒应通过手牌真实入口进入奖励骰或花费选择"`。
- 结果：2026-09-11 重新通过 1 条；补强断言覆盖血潮汹涌 0 CP 真实拖牌、利爪奖励骰确认后获得 3 鲜血之力、血从天降扣 1 CP 后按骰值 5 获得 3 鲜血之力，以及饮血如酒花费 4 鲜血之力后获得 8 CP；过程中 shared-single 端口预留失败后自动回退到 isolated runtime，不是规则测试失败。
- 命令：`node scripts/infra/run-e2e-command.mjs isolated e2e/dicethrone/vampire-lord-real-entry.e2e.ts --grep "血色杀戮应通过玩家板终极技打开抽牌堆搜牌交互并结算"`。
- 结果：2026-09-11 重新通过 1 条；补强断言覆盖血色杀戮从玩家板终极技打开抽牌堆搜牌窗口、选择非顶牌加入手牌、剩余抽牌堆洗混，并最终获得 2 鲜血之力、造成 10 点攻击伤害；过程中 shared-single 端口预留失败后自动回退到 isolated runtime，不是规则测试失败。
- 证明了什么：嗜血之爪三同 / 四同奖励、鲜血之力四档、专属行动牌逐卡领域消费链和血色杀戮抽牌堆搜牌链已有代码与领域测试证据；真实入口证明按钮、禁用态、临时骰、选择、扣除、奖励骰确认、手牌拖出、弃牌堆落点、抽牌堆选牌、洗牌和最终状态；实施中入口证明玩家可见、带实施中标记、可选择并进入牌桌；AI 上下文测试证明实施中角色仍被过滤；审计前隐藏态历史入口仍保留生命周期门禁证据；资源链仍保留原有有效证据。
- 没有证明什么：没有证明未锁定的其它 DiceThrone 英雄；I/II 利爪未逐分支重复浏览器截图；专属行动牌真实入口已覆盖血潮汹涌、血从天降和饮血如酒三张，死无全尸、沸血之力、血流如注和血石当前仍以领域最终状态测试作为本轮规则机制证据，不构成本轮规则机制 blocker。
- 截图 / 日志路径（截至 2026-09-12）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\嗜血之爪-III-5-利爪三同应通过真实投骰获得鲜血之力并造成-8-点攻击伤害\吸血鬼领主-嗜血之爪III入口-投骰前.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\嗜血之爪-III-5-利爪三同应通过真实投骰获得鲜血之力并造成-8-点攻击伤害\吸血鬼领主-嗜血之爪III已投5利爪且三同.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\嗜血之爪-III-5-利爪三同应通过真实投骰获得鲜血之力并造成-8-点攻击伤害\吸血鬼领主-嗜血之爪III槽位可触发.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\嗜血之爪-III-5-利爪三同应通过真实投骰获得鲜血之力并造成-8-点攻击伤害\吸血鬼领主-嗜血之爪III槽位触发后.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\嗜血之爪-III-5-利爪三同应通过真实投骰获得鲜血之力并造成-8-点攻击伤害\吸血鬼领主-嗜血之爪III进入防御.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\嗜血之爪-III-5-利爪三同应通过真实投骰获得鲜血之力并造成-8-点攻击伤害\吸血鬼领主-嗜血之爪III结算后血力增加.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\真实在线玩家选角入口应隐藏未完成审计的吸血鬼领主，但内部注入仍可初始化\01-选角-吸血鬼领主隐藏且其它角色可选.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\鲜血之力-2-档在无可移除状态时仍显示为禁用入口且不重复显示成本\吸血鬼领主-鲜血之力四档入口-第2档禁用但可见.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\真实在线玩家选角入口应隐藏未完成审计的吸血鬼领主，但内部注入仍可初始化\03-牌桌-吸血鬼领主资源链与状态图标.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\真实在线玩家选角入口应显示实施中的吸血鬼领主并可进入牌桌\01-选角-吸血鬼领主实施中可见且可选.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\完成态最终截图组\open-pass-manifest-vampire-lord-completed.json`（历史候选，不代表已获真人批准）
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\血潮汹涌、血从天降、饮血如酒应通过手牌真实入口进入奖励骰或花费选择\吸血鬼领主-血潮汹涌-奖励骰待确认.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\血潮汹涌、血从天降、饮血如酒应通过手牌真实入口进入奖励骰或花费选择\吸血鬼领主-血潮汹涌-利爪结算后获得3血力.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\血潮汹涌、血从天降、饮血如酒应通过手牌真实入口进入奖励骰或花费选择\吸血鬼领主-血从天降-奖励骰待确认.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\血潮汹涌、血从天降、饮血如酒应通过手牌真实入口进入奖励骰或花费选择\吸血鬼领主-血从天降-结算后获得3血力.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\血潮汹涌、血从天降、饮血如酒应通过手牌真实入口进入奖励骰或花费选择\吸血鬼领主-饮血如酒-花费血力选择.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\血潮汹涌、血从天降、饮血如酒应通过手牌真实入口进入奖励骰或花费选择\吸血鬼领主-饮血如酒-花费4血力获得8CP.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\魔血附身基础版的奖励骰应显示为吸血鬼领主本人投出的骰子\吸血鬼领主-魔血附身-槽位触发后.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\魔血附身基础版的奖励骰应显示为吸血鬼领主本人投出的骰子\吸血鬼领主-魔血附身-奖励骰显示真实归属.jpg`
 - 人工观察结论：四档鲜血之力按钮只显示动作短名，亮起 / 置灰表达当前是否可用，详细成本、门槛、效果和次数由提示卡承载；使用后对应最终资源和效果已落地。催眠截图显示临时骰、对手骰候选和重掷收口；嗜血之爪结算后截图显示攻击者鲜血之力为 1/5、对手生命 42；不死防御截图显示 4 颗骰、确认、反击 / 自疗后的最终生命值和主要阶段 2；实施中入口截图显示吸血鬼领主可见、带实施中标记且可选；完成态候选截图仅作为误切换后的历史证据，不能替代真人批准。部分收口帧保留正常对手思考提示，未将该覆盖层误报为无覆盖层视觉美术验收。

## 2026-08-30 UI 职责修正

- 发现：被动能力按钮正文同时显示动作短名和“消耗 N 个鲜血之力”，与提示卡的规则说明重复；按钮亮起本身已经表达当前可执行，按钮置灰已经表达当前不可执行。
- 修正：移除被动按钮正文的可见成本行，并将吸血鬼四个短按钮文案改为只保留动作名称；真实成本仍保留在规则数据、提示卡和无障碍名称中，领域层的成本校验与实际扣除不变。
- 验证：`PassiveAbilityPanel` 组件回归测试 1 条通过；吸血鬼领域 / 录入定向测试与组件测试共 30 条通过；真实入口 E2E 9/9 通过，其中第 2 条直接断言无可移除状态时按钮置灰且不显示“消耗 2”，其余三档断言亮起和点击后的真实 Token 消耗。
- 规范来源：项目 UI 改动门禁中的“动作按钮与规则说明分工”条款；按钮成本不是新的规则真相，提示卡仍是鲜血之力成本、门槛、效果和次数的说明来源。

## 同类扩审与漏审归因

### 共享流程一致性核对

`dt-bloodthirsty-claws-damage-and-kind-blood-power-v2` 的代表对象是嗜血之爪 III 5 利爪分支；I / II 的剩余差异仅为 `level`、`variantId`、利爪数量、伤害数值和相同数字阈值。已逐项核对触发时机、候选生成、权限判断、`payload` / command 结构、执行入口、最终权威状态、清理语义以及 AI / 自动推进路径均一致；新增的鲜血之力获得不是被旧伤害流程吞并，而是由三档定义和同一后置 custom action 独立消费，并由 I / II / III 领域最终状态测试分别验证。因此这里是 `passed（共享流程引用）`，不是仅因界面或命名相似而复用。

对于 `dt-effect-basic-event-v1` 和 `dt-replace-ability-upgrade-v1`，代表对象分别是吸血鬼领主普通效果和吸血鬼升级牌；已核对触发时机、候选生成、权限判断、`payload` / command、执行入口、最终权威状态与清理语义，差异只在技能 / 卡牌 ID、数值、目标和图集 slot 等允许配置字段。2026-09-11 复查后，专属行动牌不能再整体归进“普通获得类”或“攻击修正 +1 类”；凡有投骰、否则分支、按图案计数、按对手状态层数计数、花费选择或不抽牌负向语义的，必须单独列断言和测试。

- 同类扩审：本轮覆盖嗜血之爪 I / II / III 的 3/4/5 利爪分支，不只补 III 5 利爪；领域测试覆盖基础四同、II/III 三同、五同边界和未达阈值负向。
- 横向搜索范围：`abilities.ts` 三个嗜血之爪等级、`cards.ts` 专属行动牌、`customActions/vampire_lord.ts` custom action 注册、`rules.ts` 卡牌门槛校验、`vampire-lord-mechanics.test.ts` 结果级断言、`vampire-lord-real-entry.e2e.ts` 真实投骰入口、三份吸血鬼规则合同和本 evidence。
- 漏审归因：旧审计把“3/4/5 利爪造成伤害”当成唯一原子语义，并把“相同数字获得鲜血之力”误归为可忽略配置差异；旧 E2E 只断言 HP 50 -> 42，没有断言 `blood_power` 0 -> 1；旧共享流程 `dt-bloodthirsty-claws-variants-damage-v1` 的允许配置差异过宽，遗漏了新增最终权威状态。专属行动牌这一轮进一步确认是录入执行失守：卡图上的骰面、否则、向上取整、每个血滴、至少 3 伤害、每层流血、花费至少 2、然后每花费 1 个、无抽牌等限定词没有逐项进入旧合同，旧测试又用“获得类 / +1 类”聚合断言把错误放过去。
- 规范回代裁定：项目通用录入规范和 DiceThrone intake workflow 已经要求完整录入全部特殊含义文本、数字、图案和关系；本轮不新增平行规范。需要回代的是 evidence 和测试执行纪律：图片读过就登记，聚合测试不得代替逐卡合同，旧 `passed` 证据发现漏项时必须降级。
- 修正规则：相同数字奖励、状态 / token 获得、资源变化、投骰分支、骰面图案计数、状态层数累计、花费选择和负向“不抽牌”都必须拆成独立原子语义；只验证主伤害或只验证一张同类牌不能代表验证其它附加最终状态。

## 修订 / 失效记录

- 旧文档路径：本文旧版、`src/games/dicethrone/rule/吸血鬼领主录入核对.md`、`src/games/dicethrone/rule/吸血鬼领主真相源表.md`、`src/games/dicethrone/rule/吸血鬼领主卡牌录入核对.md`、`openspec/changes/add-dicethrone-vampire-lord-faction/*`。
- 旧结论：吸血鬼领主当前范围已收口，玩家入口完成态可见、无实施中徽标、直接玩家命令可选、共享 AI 自动选角可纳入。
- 失效原因：嗜血之爪相同数字获得鲜血之力是独立最终权威状态；专属行动牌的投骰分支、按骰值向上取整、按血滴 / 流血层数加伤、花费选择和血石不抽牌也都是独立规则语义，旧代码、旧测试和旧 evidence 均未完整覆盖。
- 替代旧结论的当前证据：本轮代码补丁、2026-09-12 领域机制测试 37 条通过、2026-09-12 定向测试 4 个文件共 208 条通过、隔离真实入口历史 9 条通过、2026-09-12 用户点名三条真实入口 E2E 通过，以及本地单卡图 `slot-17/18/19/20/21/29/30/31/32.webp`、`contact-sheet-focus-17-32.png` 与 `contact-sheet-focus-22-30.png` 复核。
- 当前状态：`vampire_lord` 完整目录保留，当前玩家可见状态为 `in_progress`；玩家可选择并显示实施中标记，AI 继续过滤，等待真人明确批准后才进入完成态。
- 是否需要修改旧文档正文中的误导行：需要，且本轮同步回写规则合同和本 evidence；项目通用规范已经覆盖完整录入要求，本轮裁定为执行失守，不新增平行规范。

## 对外汇报口径

- 允许说：吸血鬼领主当前锁定范围的嗜血之爪奖励、鲜血之力四档成本 / 累计门槛 / 效果 / 每回合限制、催眠 token 主入口、专属行动牌逐卡领域结算和玩家入口生命周期已完成审计，当前处于实施中并等待真人批准。
- 允许说：旧“完成态 / 全面收口 / 可选即完成”的结论失效，旧 `dt-bloodthirsty-claws-variants-damage-v1`、旧“获得类行动牌”和旧“攻击修正 +1”聚合测试只能作为历史坏证据。
- 禁止说：把本轮结论外推到未锁定的其它英雄，或把审计通过 / 测试通过 / 截图通过说成真人已批准完成态。

## 2026-09-11 专属行动牌与升级费用复核补充

- 用户纠偏边界：`沸血之力` 对方两个流血仍只 +1 的问题已经修复；本节继续查的是同一录入失守模式下是否还有其它规则和消费 bug。
- 本地卡图第一真相：已用吸血鬼专属 `ability-cards-vampire_lord.atlas.json` 重切并重新查看 `slot-17/18/19/20/21/31/32.webp`，并继续用 `contact-sheet-focus-22-30.png`、`slot-29.webp` 与 `slot-30.webp` 复看升级费用和上下区；2026-09-11 外部复查只确认官方 FAQ 挂有 Vampire Lord / Huntress / Tactician 的 Leaflet Patch Kit、官方商店说明该补丁是三名 Season Two 英雄的 leaflet 小加强、RulePop 是官方规则参考且能索引 Vampire Lord 与 `Blood Power` / `Mesmerize` / `Bleed` 状态入口；未抓到血潮汹涌、血从天降、饮血如酒、血色杀戮等完整单卡/技能正文，Fandom 当前直连不可用。因此外部来源只能做对照源，不能替代本地清晰单卡图裁定。
- 确认并修正的其它旧合同污染：血潮汹涌从 1 CP / 固定血力改为 0 CP / 投骰利爪 / 否则分支；血从天降从固定血力改为骰值一半向上取整；死无全尸从固定 +1 改为投 5 骰按血滴加伤并在 3+ 时施加流血；饮血如酒从获得 2 鲜血之力改为花费至少 2 并按每个 2 CP；血石移除错误抽牌；`slot-29 嗜血之爪 III` 从 4 CP 改为图面 2 CP，`slot-30 嗜血之爪 II` 从 2 CP 改为图面 1 CP。
- 规则 / 录入规范结论：通用规范已经要求完整录入所有特殊含义元素，不管当前能不能用；本次根因不是规范没有要求，而是没有执行逐卡回图、费用角标等特殊图案信息未逐项登记，旧 evidence 错标 `passed`，旧测试把不同牌混成同一类。
- 工具层补救：录入裁图脚本原默认 `ability-cards-common.atlas.json`，对吸血鬼 5x7 图集会裁错；当前已改为未显式传 `--atlas-config` 时优先自动选择角色专属 atlas，并用 `xixuegui` / `vampire_lord` 两种直接 `node` 入口验证都命中 `ability-cards-vampire_lord.atlas.json`。当前 npm 11 会吞掉旧示例里的 `--hero` 等参数，脚本帮助和 DiceThrone intake workflow 已同步改成双分隔符命令；新 npm 示例已实测命中吸血鬼专属 atlas。

## 2026-08-29 用户复核补充

- 用户复核指出：录入数据必须完整覆盖规则原文；“拥有指示物可以花费它们”明确意味着鲜血之力四档分别消耗 1/2/3/4 个，每回合每个效果只能激活一次，且高档位累计解锁低档位。
- 复核结论：此前实现和 E2E 把未完整录入的合同当成“不消耗 / 不限次”，属于录入责任和审计语义覆盖缺失；该旧结论已失效。
- 修复方向：四档定义补齐成本、独立 `oncePerTurnKey`、时机和累计门槛；通用被动执行链负责扣除与记录次数，领域测试已验证最终状态；真实入口截图和审计需重新执行后才能开放玩家入口。
- 旧的 E2E 断言以“资源不变 / 无消费事件 / 可重复使用”为目标，已降级为失效证据。
- 新增 / 更新截图证据：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\鲜血之力-2-档在无可移除状态时仍显示为禁用入口且不显示成本\吸血鬼领主-鲜血之力四档入口-第2档禁用但可见.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\鲜血之力-1-档应通过玩家板按钮给当前攻击加-3-点\吸血鬼领主-鲜血之力加伤后.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\鲜血之力-2-档应通过状态选择移除流血\吸血鬼领主-鲜血之力移除状态后收口.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\鲜血之力-3-档应通过玩家板按钮抽-2-张牌\吸血鬼领主-鲜血之力抽牌后收口.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\vampire-lord-real-entry.e2e\鲜血之力-4-档应通过玩家板按钮按已造成伤害治疗\吸血鬼领主-鲜血之力治疗后收口.jpg`
