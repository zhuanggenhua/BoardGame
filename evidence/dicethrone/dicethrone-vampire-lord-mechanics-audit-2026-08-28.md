# DiceThrone 吸血鬼领主机制实现审计

## 基本信息

- 对象：Dice Throne 新英雄吸血鬼领主（`vampire_lord` / Vampire Lord）。
- 日期：2026-08-28；最近更新：2026-08-30（旧完成态结论失效；本轮补齐鲜血之力四档成本、累计门槛和每回合限制的录入与实现，并修正按钮重复显示成本的问题）。
- 文档类型：`invalidation` + `audit`。
- 关联需求：新增 DiceThrone 吸血鬼新派系；修复旧审计把“角色可选 / 一条伤害代表链”误当完整派系完成的问题。
- 当前工作目录：`D:\gongzuo\webgame\BoardGame`。

## 本轮范围

- 本轮覆盖对象：`vampire_lord` 角色、玩家板基础 / 升级技能、专属行动牌、升级替换壳、鲜血之力、催眠、流血、玩家可见生命周期。
- 本轮重点规则子句：嗜血之爪 I / II / III 的 3/4/5 利爪伤害，以及“投出指定数量相同数字后获得 1 个鲜血之力”的附加奖励。
- 本轮目标入口 / 环境：领域测试入口 `src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts`，目录 / 命令 / AI 候选测试，真实浏览器入口 `e2e/dicethrone/vampire-lord-real-entry.e2e.ts`。
- 明确不在本轮范围内：扩大到其它 DiceThrone 英雄或新增未锁定规则；本轮仅收口吸血鬼领主当前锁定范围，不把结论外推到其它英雄。

## 批次矩阵

| objectId | 数据录入 | 资源链 | 机制实现 | 审计 | E2E | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `vampire_lord` | `passed` | `passed` | `passed` | `passed` | `passed` | `in_progress` |

判定说明：静态数据、资源链和已上传素材仍保留有效；旧 evidence 中“完成态 / 当前范围已收口”的旧结论曾被嗜血之爪漏审推翻。本轮已补齐鲜血之力四档的成本、累计门槛和每回合限制，并重新完成领域测试、真实入口 E2E、交互截图和隐藏态入口验证。当前锁定范围审计已通过，角色进入 `in_progress`；移除实施中标记还必须经过真人明确批准。

## 结论等级

结论等级：`当前范围已收口`。

判定理由：旧审计先漏掉嗜血之爪的附加奖励，随后又把鲜血之力四档的完整原文错误录成“不消耗、不限次”。提示卡明确要求四档分别消耗 1/2/3/4 个鲜血之力，每回合每个效果一次，并按持有数量累计解锁；当前代码、领域测试、真实入口、截图和 evidence 已按锁定合同重新核对。审计已完成，但按照人工确认闸门，当前仍保留实施中标记，等待真人明确批准。

## 权威来源

- 主真相源：`src/games/dicethrone/rule/吸血鬼领主真相源表.md`、`src/games/dicethrone/rule/吸血鬼领主录入核对.md`、`src/games/dicethrone/rule/吸血鬼领主卡牌录入核对.md`。
- 关键图面裁图：`temp/dicethrone-intake/xixuegui/rule-audit-crops/bloodthirsty-claws-board-2x.png`、`temp/dicethrone-intake/xixuegui/rule-audit-crops/slot-29-4x.png`、`temp/dicethrone-intake/xixuegui/rule-audit-crops/slot-30-4x.png`。
- 静态定义源：`src/games/dicethrone/heroes/vampire_lord/abilities.ts`、`src/games/dicethrone/heroes/vampire_lord/cards.ts`、`src/games/dicethrone/heroes/vampire_lord/tokens.ts`。
- 领域消费源：`src/games/dicethrone/domain/effects.ts`、`src/games/dicethrone/domain/customActions/vampire_lord.ts`、`src/games/dicethrone/domain/rules.ts`、`src/games/dicethrone/domain/reducer.ts`。
- 合同状态：`locked` 用于嗜血之爪图面伤害、相同数字阈值奖励、吸血鬼状态 / Token 图集归属和完成态玩家可见生命周期。

## 图片合同与裁图清单

本轮实际读取过的素材全部登记在本节；图片只负责确认图面对象、槽位和规则文字，结构化规则仍以三份吸血鬼规则合同为唯一可执行数据来源。

| 图面对象 | 主裁图 / 裁图清单 | SHA256 | 录入用途 | 处置 |
| --- | --- | --- | --- | --- |
| 玩家板 | `temp/dicethrone-intake/xixuegui/player-board-preview.png`；`rule-audit-crops/bloodthirsty-claws-board-2x.png` | `905F7265E0212D3E0EDE01132BCD2052DA6B88C24520E257B2563ACBAE824C54`；`ACFF2EE0919BFB8A26D6F5367EA10CB647970BFEB7674DC864AEA24477EDEE35` | 九个物理技能槽和嗜血之爪 `fist` 槽 | 已登记并进入正式玩家板资源链 |
| 提示卡 | `temp/dicethrone-intake/xixuegui/tip-preview.png` | `D5E953B6E986731572C5F1F67CFDD99C6690ADF569A30CFDDE0DF39018ACEED8` | 鲜血之力四档的门槛、成本、效果和每回合限制 | 已登记并锁定规则合同 |
| 能力卡图集 | `temp/dicethrone-intake/xixuegui/ability-card-slots/contact-sheet.png`；`ability-card-slots/slot-00.png` 至 `slot-32.png`，共 33 张完整单卡主裁图 | `F2BEBDC0AF209782E8F54E9D2F031163AF121DBBEB1E588C6D6F2B3F8E251190`（联系表） | 卡牌标题、类型、slot、升级上下区和公共卡归属 | 已登记；运行时消费 `ability-cards-vampire_lord.atlas.json` |
| 嗜血之爪规则裁图 | `temp/dicethrone-intake/xixuegui/rule-audit-crops/slot-29-4x.png`、`slot-30-4x.png` | `A0C5CC28B98F1A31D465114E1DBBA1658BF815DE3B60DBC7DD368C8860D5A648`；`430AFA7B2CC03AFA6A9E72152170147FF0B8D5D352A3625758F73ED66BBF8D65` | 三同 / 四同奖励和等级分支交叉核对 | 已登记并拆入嗜血之爪原子语义 |

裁图清单即本轮 `crop manifest`：玩家板 1 张总览 + 1 张规则裁图，提示卡 1 张，能力卡 `slot-00..32` 33 张单卡 + 1 张联系表，嗜血之爪规则裁图 2 张；未以未登记图片推导运行时规则。

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | 本轮只覆盖 `vampire_lord`，不外推到其它 DiceThrone 英雄。 |
| 真相源状态 | `passed` | 三份吸血鬼规则合同和三张规则裁图已锁定嗜血之爪 I/II/III 奖励条件。 |
| 原子语义断言 | `passed` | 嗜血之爪已拆成利爪数量伤害、相同数字阈值、鲜血之力最终状态、攻击骰快照四类断言。 |
| 实现消费链 | `passed` | `abilities.ts` 写入 postDamage custom action，`customActions/vampire_lord.ts` 读取攻击骰快照并发 `TOKEN_GRANTED`。 |
| 最终权威结果 | `passed` | 领域测试断言对手 HP、攻击者 `blood_power` 和防御骰不污染攻击骰快照；E2E 断言结算后鲜血之力为 1/5。 |
| 交互真实入口 | `passed` | 四档鲜血之力、催眠、嗜血之爪、不死防御和完成态玩家入口已分别通过真实入口；审计前隐藏态与中间实施态历史门禁也有独立证据。 |
| 验证证据 | `passed` | 见“测试语义对账与验证证据”。 |
| 共享影响与代表链依据 | `passed` | 旧 `dt-bloodthirsty-claws-variants-damage-v1` 已降级；新共享流程只允许在伤害 + 相同数字奖励都判等时引用。 |
| 缺口分类与范围裁定 | `passed` | 本轮已完成当前范围复核；仅保留非阻塞的逐分支截图扩展。 |
| 旧 evidence / 旧结论回写 | `passed` | 本文件已回写旧完成态和旧“不消耗 / 不限次”结论失效，规则合同和 OpenSpec 已同步。 |
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
| 攻击骰快照 | 嗜血之爪奖励必须读取发起攻击时的骰值，不能被防御阶段当前骰覆盖 | custom action 注册 `usesAttackDiceSnapshot: true`，最终读取攻击上下文中的 `attackDiceValues` | 攻击骰无三同则不加血力；即使当前骰区防御骰全相同也不得误加 | `vampire-lord-mechanics.test.ts` 快照负向断言 | 已修语义不一致风险 | `passed` |
| 玩家可见生命周期 | 审计通过后进入实施中；真人明确批准后才移除实施中标记进入完成态 | `core-types.ts` 生命周期过滤与徽标 | 玩家入口在审计前隐藏；实施中允许玩家选择并显示标记；完成态才允许玩家与 AI 选择且无标记 | 隐藏态与实施中生命周期 E2E、目录 / 命令 / AI 测试；完成态仅保留历史候选证据 | 当前已进入实施中，等待真人批准 | `passed` |

## 阶段、触发队列与流程收口证据

- 嗜血之爪的触发时机是进攻投骰确认后，玩家点击玩家板 `fist` 槽；合法候选由 DiceThrone AI / 命令校验链生成并校验，执行入口由 `abilities.ts` 的后置效果和 `customActions/vampire_lord.ts` 消费。
- 真实 E2E 逐步确认：投骰前 -> 投出 5 个利爪且三同 -> `fist` 槽可触发 -> 进入防御阶段 -> 防御确认 -> 结算收口。结算最终状态为主阶段 2、对手生命 42、攻击者鲜血之力 1、攻击上下文为空，并出现 `DAMAGE_DEALT`、`TOKEN_GRANTED`、`ATTACK_RESOLVED` 三类正式事件。
- 不死防御真实 E2E 逐步确认：进入防御阶段 -> 显示 4 颗吸血鬼骰 -> 玩家确认骰面 -> 点击结束防御 -> 进入主阶段 2；最终攻击上下文为空，并同时落地反击伤害、自疗和 `ATTACK_RESOLVED`。
- 鲜血之力四档真实 E2E 逐档确认按钮入口、使用后的扣除事件、对应效果和本回合禁用；第二档无可移除状态时保持可发现但禁用，不产生状态选择残留。上述证据覆盖触发队列、阶段推进、确认边界、正式事件和无残留收口。

其它基础共享效果、攻击修正、鲜血之力四档主动能力、催眠主动消费、复合升级下区 variants、`slot-32` 血石归属、不死防御入口链的旧低层证据仍可作为当前实现证据保留；它们与本轮原子语义、最终状态和真实入口证据共同支撑当前范围复验。

## 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞完整派系完成口径 | 当前范围裁定 | 最小补救 |
| --- | --- | --- | --- | --- | --- |
| 嗜血之爪相同数字奖励旧漏项 | `功能实现阻塞` | 否，当前已修 | 否，已补齐并重新验证 | 当前范围内，已补实现和测试 | 保留 I/II/III 阈值测试、快照负向测试和 III 真实入口截图组 |
| 旧完成态 evidence 继续传播 | `审计留档缺口` | 否 | 否，已回写并替换当前引用 | 当前范围内，本文原地回写 | 规则合同、OpenSpec 和当前截图均使用新完成态口径 |
| 玩家入口当前状态 | `当前范围验证缺口` | 否 | 否 | 审计后的实施中入口已通过；真人批准前不得切入完成态，AI 继续过滤实施中角色 | 等待真人明确批准后再切换完成态并重跑完成态入口 |
| 利爪 I/II 每个分支逐条浏览器截图 | `非阻塞扩展` | 否 | 否，前提是 v2 共享流程判等表保持成立 | 当前范围外扩展 | 如用户要求逐分支展示，再补 I/II 真实入口截图组 |

## 测试语义对账与验证证据

- 命令：`npx vitest run src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts --run`。
- 结果：领域机制测试 25 条通过；当前已覆盖四档鲜血之力的成本、扣除事件、独立每回合限制和扣除后不可用性。
- 命令：`npm run spec:lint`、`npm run audit:evidence:selfcheck -- evidence/dicethrone/dicethrone-vampire-lord-mechanics-audit-2026-08-28.md`、`npx openspec validate add-dicethrone-vampire-lord-faction --strict --no-interactive`。
- 结果：TypeScript、规范结构、i18n、审计 evidence 自检、OpenSpec strict validate 和补丁格式均通过；完成态生命周期测试与真实入口 E2E 重新通过。
- 命令：`npx vitest run src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts src/games/dicethrone/__tests__/vampire-lord-intake.test.ts src/games/dicethrone/__tests__/character-catalog-status.test.ts src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`。
- 结果：本轮定向测试 4 个文件、194 条通过；覆盖完整目录保留吸血鬼领主、实施中生命周期、直接玩家命令和 AI 过滤，以及四档鲜血之力成本 / 限制。审计前隐藏态过滤证据作为历史门禁保留，当前实施中状态由本轮 E2E 和状态源核对。
- 命令：`npx tsc --noEmit --pretty false`。
- 结果：通过，TypeScript 无新增类型错误。
- 命令：`node scripts/infra/run-e2e-command.mjs isolated e2e/dicethrone/vampire-lord-real-entry.e2e.ts`。
- 结果：本轮隔离真实入口 9 条全部通过，覆盖四档鲜血之力、催眠、嗜血之爪、不死防御和实施中玩家入口；审计前隐藏态入口的历史证据另行保留，完成态候选截图不作为当前完成依据。
- 证明了什么：嗜血之爪三同 / 四同奖励和鲜血之力四档领域消费链已有代码与领域测试证据；真实入口证明按钮、禁用态、临时骰、选择、扣除和最终状态；实施中入口证明玩家可见、带实施中标记、可选择并进入牌桌；AI 上下文测试证明实施中角色仍被过滤；审计前隐藏态历史入口仍保留生命周期门禁证据；资源链仍保留原有有效证据。
- 没有证明什么：没有证明未锁定的其它 DiceThrone 英雄；I/II 利爪未逐分支重复浏览器截图，但已由 `dt-bloodthirsty-claws-damage-and-kind-blood-power-v2` 共享流程判等和逐分支领域最终状态测试覆盖，不构成本轮 blocker。
- 截图 / 日志路径（2026-08-30 本轮重跑）：
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
 - 人工观察结论：四档鲜血之力按钮只显示动作短名，亮起 / 置灰表达当前是否可用，详细成本、门槛、效果和次数由提示卡承载；使用后对应最终资源和效果已落地。催眠截图显示临时骰、对手骰候选和重掷收口；嗜血之爪结算后截图显示攻击者鲜血之力为 1/5、对手生命 42；不死防御截图显示 4 颗骰、确认、反击 / 自疗后的最终生命值和主要阶段 2；实施中入口截图显示吸血鬼领主可见、带实施中标记且可选；完成态候选截图仅作为误切换后的历史证据，不能替代真人批准。部分收口帧保留正常对手思考提示，未将该覆盖层误报为无覆盖层视觉美术验收。

## 2026-08-30 UI 职责修正

- 发现：被动能力按钮正文同时显示动作短名和“消耗 N 个鲜血之力”，与提示卡的规则说明重复；按钮亮起本身已经表达当前可执行，按钮置灰已经表达当前不可执行。
- 修正：移除被动按钮正文的可见成本行，并将吸血鬼四个短按钮文案改为只保留动作名称；真实成本仍保留在规则数据、提示卡和无障碍名称中，领域层的成本校验与实际扣除不变。
- 验证：`PassiveAbilityPanel` 组件回归测试 1 条通过；吸血鬼领域 / 录入定向测试与组件测试共 30 条通过；真实入口 E2E 9/9 通过，其中第 2 条直接断言无可移除状态时按钮置灰且不显示“消耗 2”，其余三档断言亮起和点击后的真实 Token 消耗。
- 规范来源：项目 UI 改动门禁中的“动作按钮与规则说明分工”条款；按钮成本不是新的规则真相，提示卡仍是鲜血之力成本、门槛、效果和次数的说明来源。

## 同类扩审与漏审归因

### 共享流程一致性核对

`dt-bloodthirsty-claws-damage-and-kind-blood-power-v2` 的代表对象是嗜血之爪 III 5 利爪分支；I / II 的剩余差异仅为 `level`、`variantId`、利爪数量、伤害数值和相同数字阈值。已逐项核对触发时机、候选生成、权限判断、`payload` / command 结构、执行入口、最终权威状态、清理语义以及 AI / 自动推进路径均一致；新增的鲜血之力获得不是被旧伤害流程吞并，而是由三档定义和同一后置 custom action 独立消费，并由 I / II / III 领域最终状态测试分别验证。因此这里是 `passed（共享流程引用）`，不是仅因界面或命名相似而复用。

对于 `dt-effect-basic-event-v1` 和 `dt-replace-ability-upgrade-v1`，代表对象分别是吸血鬼领主普通效果和吸血鬼升级牌；已核对触发时机、候选生成、权限判断、`payload` / command、执行入口、最终权威状态与清理语义，差异只在技能 / 卡牌 ID、数值、目标和图集 slot 等允许配置字段。新状态、资源、阶段和玩家选择均已在吸血鬼专属断言中单独列出，没有用共享流程掩盖新增语义。

- 同类扩审：本轮覆盖嗜血之爪 I / II / III 的 3/4/5 利爪分支，不只补 III 5 利爪；领域测试覆盖基础四同、II/III 三同、五同边界和未达阈值负向。
- 横向搜索范围：`abilities.ts` 三个嗜血之爪等级、`customActions/vampire_lord.ts` custom action 注册、`vampire-lord-mechanics.test.ts` 结果级断言、`vampire-lord-real-entry.e2e.ts` 真实投骰入口。
- 漏审归因：旧审计把“3/4/5 利爪造成伤害”当成唯一原子语义，并把“相同数字获得鲜血之力”误归为可忽略配置差异；旧 E2E 只断言 HP 50 -> 42，没有断言 `blood_power` 0 -> 1；旧共享流程 `dt-bloodthirsty-claws-variants-damage-v1` 的允许配置差异过宽，遗漏了新增最终权威状态。
- 修正规则：相同数字奖励、状态 / token 获得、资源变化这类附加结果必须拆成独立原子语义；只验证主伤害不能代表验证附加最终状态。

## 修订 / 失效记录

- 旧文档路径：本文旧版、`src/games/dicethrone/rule/吸血鬼领主录入核对.md`、`src/games/dicethrone/rule/吸血鬼领主真相源表.md`、`src/games/dicethrone/rule/吸血鬼领主卡牌录入核对.md`、`openspec/changes/add-dicethrone-vampire-lord-faction/*`。
- 旧结论：吸血鬼领主当前范围已收口，玩家入口完成态可见、无实施中徽标、直接玩家命令可选、共享 AI 自动选角可纳入。
- 失效原因：嗜血之爪相同数字获得鲜血之力是独立最终权威状态，旧代码、旧测试和旧 evidence 均未覆盖。
- 替代旧结论的当前证据：本轮代码补丁、25 条领域机制测试、4 个定向测试文件共 194 条通过、隔离真实入口 9 条通过，以及 2026-08-30 真实截图复核。
- 当前状态：`vampire_lord` 完整目录保留，当前玩家可见状态为 `in_progress`；玩家可选择并显示实施中标记，AI 继续过滤，等待真人明确批准后才进入完成态。
- 是否需要修改旧文档正文中的误导行：需要，且本轮同步回写规则合同、OpenSpec 和项目规范。

## 对外汇报口径

- 允许说：吸血鬼领主当前锁定范围的嗜血之爪奖励、鲜血之力四档成本 / 累计门槛 / 效果 / 每回合限制、真实交互和玩家入口生命周期已完成审计，当前处于实施中并等待真人批准。
- 允许说：旧“完成态 / 全面收口 / 可选即完成”的结论失效，旧 `dt-bloodthirsty-claws-variants-damage-v1` 只能作为历史坏证据。
- 禁止说：把本轮结论外推到未锁定的其它英雄，或把审计通过 / 测试通过 / 截图通过说成真人已批准完成态。

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
