# 召唤师战争：莫古新派系重审证据

- 日期：2026-07-12
- 分支：`main`
- 真相源：`public/assets/i18n/zh-CN/summonerwars/hero/mogu`
- 批次状态：`superseded_by_2026-07-14_feedback / catalog_under_construction`
- 结论等级：旧结论失效；本文只能作为 2026-07-12 历史快照，不能继续作为莫古当前“已审计收口”证据。
- 用户可见标记：继续保留“实施中”，这是用户当轮要求的新批次标记，不作为资源或机制缺口。

## 2026-07-14 线上反馈后降级

- 旧的“莫古对象级审计已按当前发布口径收口”结论已被线上反馈推翻。
- 直接命中的旧结论包括：数据录入字段曾用低分辨率 contact sheet 定稿，托恩费用被录成 2 而非 6；共生自愈阶段被录成召唤阶段而非移动阶段；命令、腐坏、爆裂这三条链路的旧测试/旧矩阵没有证明最终权威状态与后续收口。
- 当前替代入口：`evidence/summonerwars/summonerwars-mogu-reentry-audit-2026-07-14.md`。
- 当前代码修复入口：`src/games/summonerwars/config/factions/mogu.ts`、`src/games/summonerwars/domain/execute/eventCards.ts`、`src/games/summonerwars/domain/execute.ts`、`src/games/summonerwars/domain/reduce.ts`、`src/games/summonerwars/domain/types.ts`、`src/games/summonerwars/__tests__/abilities-mogu.test.ts`。

| 旧文档内受影响结论 | 失效原因 | 2026-07-14 当前口径 |
| --- | --- | --- |
| 批次状态 `full_audit_e2e_verified` | 录入合同和机制行为均被玩家反馈推翻 | 降级为“旧结论失效，需按单卡重核录入 + 行为链补证” |
| 全面审计自检表中的“数据录入 passed” | 费用、阶段字段未回到完整单卡主裁图逐项锁定 | 重新核录入前不得标 `locked` |
| 全面审计自检表中的“L2/L3/L4 证据 passed” | 证据覆盖入口和代表链，但漏了命令额外攻击完成后消灭、腐坏加到 3 后爆裂、死亡替换收口等最终状态 | 只能作为历史代表性证据；本轮需补最终状态和负向断言 |
| 对象全集中托恩、共生自愈、命令、玛硕达、菌袍疫病体 | 分别命中费用、阶段、额外攻击后消灭、移动阶段结束腐坏、魔力阶段结束爆裂/菌化变异问题 | 这些对象必须重新进入 2026-07-14 重核清单 |
| D 维度命中表中的 D1/D8/D12/D18 passed | D1 语义保真、D8 时序、D12 写入-消耗、D18 否定路径实际未打穿 | 旧 D 维度结论降级为“覆盖不足” |
| L4 共享链判等矩阵中的自动/被动链路 `system_passed` | 阶段结束和死亡后替换链未证明跨阶段后续消费 | 需重新补 L4：阶段结束 -> 事件写入 -> 后续阶段消费 -> 最终棋盘状态 |

## 2026-07-14 失效警示与历史段落说明

- 以下为 2026-07-12 历史记录，已被 2026-07-14 线上反馈降级；保留仅用于追溯旧审计如何漏出问题。
- 下方“全面审计自检表”“批次矩阵”“逐对象规则子句表”“真实入口 E2E 与截图核验”“收口口径”等历史段落中的 `passed`、`已收口`、`当前发布口径` 只代表 2026-07-12 当时判断，已经不能作为当前莫古发布或反馈收口证据。
- 2026-07-15 再次补充：下方正文中关于菌化野兽“寄生”的“优先消耗 1 充能”属于旧审计误写；正确合同是玩家在“消耗 1 点充能”或“受到 1 点伤害”中选择。任何看到旧行的后续审计都必须回到 2026-07-14 重核文档，不得沿用本文件旧子句。
- 2026-07-15 再次补充：下方正文中关于 L3/L4、真实入口 E2E、自动/被动链路、释放菌袍、枯萎法师按钮状态的 `passed` 都是历史快照，不覆盖误点召唤师格、重复 cardId、每回合一次使用后 UI 隐藏、simple-choice 真实横幅按钮等后续补检维度。
- 当前替代入口是 `evidence/summonerwars/summonerwars-mogu-reentry-audit-2026-07-14.md`；如需对外说明当前状态，必须引用该新 evidence。

## 历史全面审计自检表（已失效）

> 本表保留 2026-07-12 当时判断。表内 `passed` 不是当前结论；凡涉及莫古当前状态、发布口径或线上反馈收口，必须改用 2026-07-14 重核 evidence。

| 自检项 | 状态 | 当前证据 | 结论 |
| --- | --- | --- | --- |
| 对象全集 | passed | 已列出 14 个莫古运行对象：库鞭克、托恩、畸形巨怪、玛硕达、枯萎法师、鲜血萨满、菌化野兽、菌袍疫病体、命令、共生自愈、狂热菌菇、释放菌袍、起始城门、传送门 | 当前对象范围已锁定 |
| 规则子句表 | passed | 本文“逐对象规则子句表”逐项列出 C1/C2/C3 | 已具备子句级核销入口 |
| 完整技能流程矩阵 | passed | 本文“完整技能流程矩阵”按真相源、静态定义、入口、执行、消耗、主效果、分支、清理、证据层级记录 | 已补矩阵；玩家入口与系统入口已分层收口 |
| L0/L1/L2/L3/L4 证据层级 | historical_passed_invalid | 14/14 对象有 L0/L1；12 个能力均有 L2；真实入口 L3 覆盖选派系、进局、枯萎法师“鲜血灌注”、鲜血萨满、狂热菌菇、共生自愈成功与空选、释放菌袍成功与空选 | 历史口径已失效；未覆盖后续反馈命中的最终状态、负向路径、按钮使用后 UI、simple-choice 真实横幅、无效输入污染配对 |
| 命中 D 维度 | passed | 已命中并记录 D1、D3、D5、D7、D8、D12、D15、D18、D21、D25、D28、D33、D52 | 当前莫古对象级审计命中维度已回写 |
| 框架消费合同矩阵 | passed | 本文列出 ability registry、executor registry、system interaction、事件/阶段系统、资源 resolver、i18n 消费点 | 当前莫古新增消费点均有对应证据 |
| L4 共享链判等矩阵 | historical_passed_invalid | 枯萎法师、鲜血萨满、狂热菌菇、共生自愈、释放菌袍均有 direct E2E；自动/被动对象按阶段、死亡、回合系统测试收口 | 历史口径已失效；旧代表链不能证明腐坏到爆裂、感染替换、命令额外攻击后消灭、寄生二选一和按钮使用后隐藏 |
| 旧 evidence/旧结论对账回写 | historical_passed_invalid | 本文替换旧降级口径，改为 `full_audit_e2e_verified`，并回写新增交互证据 | 历史口径已失效；当前旧结论回写以 2026-07-14 重核 evidence 为准 |
| 真实入口 E2E 与截图核验 | historical_passed_invalid | 8 条定向 E2E、18 张截图、1 张最终审计合图；已核验入口、选中、进局、鲜血灌注、共生自愈、释放菌袍、鲜血萨满、狂热菌菇的选择与结算截图 | 历史口径已失效；未覆盖后续补检维度，当前真实入口证据以 2026-07-14 重核 evidence 为准 |
| 收口声明 | historical_passed_invalid | 本文按对象、入口、共享链、截图和测试结果回写 | 历史收口声明作废；不得再用本文宣称莫古当前已收口 |

## 批次矩阵

| 模块 | 状态 | 证据 |
| --- | --- | --- |
| 数据录入 | passed | 莫古 14 个运行对象已落入 `src/games/summonerwars/config/factions/mogu.ts`，含图集索引、卡牌类型、数量、费用、生命、攻击和能力绑定 |
| 资源链 | passed | 已生成压缩资源与 manifest；已用 `--asset-prefix i18n/zh-CN/summonerwars/hero/mogu` 定向上传 3 个莫古压缩资源并完成远端 HEAD 回查 |
| 静态入口 | passed | `factions.test.ts`、`criticalImageResolver.test.ts` 覆盖莫古阵营注册与关键图片路径 |
| 机制实现 | passed | 新增 `abilities-mogu.ts`、`executors/mogu.ts`，并接入 `abilities.ts`、`executors/index.ts`、事件牌、阶段结算、死亡后处理与弃牌堆替换链 |
| L2 机制测试 | passed | `src/games/summonerwars/__tests__/abilities-mogu.test.ts` 24 条通过，覆盖 12 个莫古能力定义的最终权威状态 |
| 真实入口 E2E | passed | `e2e/summonerwars/summonerwars-mogu.e2e.ts` 8 条定向通过；覆盖真实选派系/进局、枯萎法师“鲜血灌注”、共生自愈成功与空选、释放菌袍成功与空选、鲜血萨满转移、狂热菌菇推拉 |
| 对象级审计 | passed | 玩家决策入口均有 direct E2E；自动/被动链路由 L2 机制测试、阶段/死亡/回合系统证据与共享链矩阵收口 |
| 用户可见状态标记 | passed | 阵营目录仍使用 `under_construction`，符合用户要求“新一批，标记实施中” |

## 对象全集

| 对象 | 类型 | 静态入口 | 能力/作用 | 当前层级 |
| --- | --- | --- | --- | --- |
| 库鞭克 | 召唤师 | `SUMMONER_MOGU` | 血腥绽放 | L2 system |
| 托恩 | 英雄 | `CHAMPION_UNITS_MOGU` | 血腥狂怒、力量强化、血腥狂怒衰减 | L2 system |
| 畸形巨怪 | 英雄 | `CHAMPION_UNITS_MOGU` | 最终形态 | L2 system |
| 玛硕达 | 英雄 | `CHAMPION_UNITS_MOGU` | 腐坏 | L2 system |
| 枯萎法师 | 普通单位 | `COMMON_UNITS_MOGU` | 鲜血灌注 | L3 direct |
| 鲜血萨满 | 普通单位 | `COMMON_UNITS_MOGU` | 传输 | L3 direct |
| 菌化野兽 | 普通单位 | `COMMON_UNITS_MOGU` | 感染、寄生 | L2 system |
| 菌袍疫病体 | 普通单位 | `COMMON_UNITS_MOGU` | 爆裂、菌化变异 | L2 system |
| 命令 | 事件牌 | `EVENT_CARDS_MOGU` | 额外攻击后消灭目标 | L2 system |
| 共生自愈 | 事件牌 | `EVENT_CARDS_MOGU` | 任意数量治疗并充能，可空选 | L3 direct success + skip |
| 狂热菌菇 | 事件牌 | `EVENT_CARDS_MOGU` | 移动后可推拉、充能并受伤 | L3 direct |
| 释放菌袍 | 事件牌 | `EVENT_CARDS_MOGU` | 至多两张菌袍疫病体从弃牌堆入场，可空选 | L3 direct success + skip |
| 起始城门 | 建筑 | `STRUCTURE_CARDS_MOGU` | 起始牌组建筑 | L1 + L3 entry |
| 传送门 | 建筑 | `STRUCTURE_CARDS_MOGU` | 常规传送门 | L1 deck build |

## 逐对象规则子句表

| 对象 | 子句 | 规则语义 | 实现入口 | 证据 |
| --- | --- | --- | --- | --- |
| 库鞭克 | C1 | 2 格内友方单位被消灭后触发 | `processDestroyTriggers` / `mogu_blood_bloom_charge` | `abilities-mogu.test.ts` 血腥绽放 |
| 库鞭克 | C2 | 2 格内所有友方单位充能 | `SW_EVENTS.UNIT_CHARGE_CHANGED` | 同上 |
| 库鞭克 | C3 | 不充能召唤师和死亡单位 | 筛选逻辑 | 同上 |
| 托恩 | C1 | 自己回合有单位死亡时充能 | `mogu_blood_rage` | 血腥狂怒测试 |
| 托恩 | C2 | 回合结束移除至多 2 点充能 | `mogu_blood_rage_decay` / `onTurnEnd` | 血腥狂怒衰减测试 |
| 托恩 | C3 | 力量强化最多 +5 | `power_up` 叠加充能 | 同上 |
| 畸形巨怪 | C1 | 召唤时必须消灭 5+ 充能菌化野兽 | `mogu_final_form_replace` | 最终形态测试 |
| 畸形巨怪 | C2 | 在被消灭菌化野兽位置登场 | 召唤命令内先销毁再召唤 | 同上 |
| 玛硕达 | C1 | 移动阶段结束自伤 | `mogu_decay` 阶段结束处理 | 腐坏测试 |
| 玛硕达 | C2 | 若仍在场，相邻友方 +2 充能 | `SW_EVENTS.UNIT_CHARGE_CHANGED` | 同上 |
| 枯萎法师 | C1 | 移动阶段每回合一次 | `mogu_blood_infusion` phase/once 约束 | 鲜血灌注测试 |
| 枯萎法师 | C2 | 选择 2 格内友方单位 | `systems.ts` 创建 `mogu_blood_infusion` 目标交互 | E2E 按钮与目标选择截图 |
| 枯萎法师 | C3 | 目标充能并受 1 伤 | `executors/mogu.ts` | L2 测试 + E2E 结算截图 |
| 鲜血萨满 | C1 | 移动后在 2 格内转移充能 | `mogu_transmission` | 传输成功测试 |
| 鲜血萨满 | C2 | 任意数量，允许转移 0 | executor payload `amount` | 0 充能测试 |
| 菌化野兽 | C1 | 击杀后替换被消灭单位 | `mogu_infection_replace` | 感染测试 |
| 菌化野兽 | C2 | 使用弃牌堆菌袍疫病体 | 弃牌堆移除 + 棋盘入场 | 感染测试 |
| 菌化野兽 | C3 | 历史错误子句：本文曾误写成“攻击阶段结束优先消耗 1 充能，否则自伤”；当前正确合同为玩家在“消耗 1 点充能”或“受到 1 点伤害”中选择 | `mogu_parasite` | 本行历史证据失效；当前证据见 2026-07-14 重核 evidence |
| 菌袍疫病体 | C1 | 魔力阶段结束 3+ 充能消灭 | `mogu_burst` | 爆裂测试 |
| 菌袍疫病体 | C2 | 3+ 充能死亡后可用弃牌堆菌化野兽替换 | `mogu_fungal_mutation_replace` | 菌化变异测试 |
| 命令 | C1 | 召唤师 3 格内友方士兵获得额外攻击 | `execute/eventCards.ts` | 命令测试 |
| 命令 | C2 | 额外攻击后消灭目标 | 后续事件处理 | 命令测试 |
| 共生自愈 | C1 | 任意数量已受伤友方士兵/英雄治疗 1 | `execute/eventCards.ts` | 共生自愈成功测试 |
| 共生自愈 | C2 | 被治疗对象充能 | 同上 | 同上 |
| 共生自愈 | C3 | 合法候选存在时可空选 | 空选 payload | 共生自愈空选测试 |
| 狂热菌菇 | C1 | 移动单位后可充能 | `mogu_fanatical_fungus` | 推拉/不推拉测试 |
| 狂热菌菇 | C2 | 可推拉 1 格 | executor `toPosition` | 推拉测试 |
| 狂热菌菇 | C3 | 目标受 1 伤 | executor damage event | 推拉/不推拉测试 |
| 释放菌袍 | C1 | 从弃牌堆拿至多两张菌袍疫病体 | `execute/eventCards.ts` | 释放菌袍成功测试 |
| 释放菌袍 | C2 | 放到召唤师相邻空格 | summon around summoner | 同上 |
| 释放菌袍 | C3 | 合法候选存在时可空选 | 空选 payload | 释放菌袍空选测试 |
| 起始城门 | C1 | 起始建筑进入起始设置 | `startingGate` | 选派系进局 E2E |
| 传送门 | C1 | 牌组内常规传送门 | `deck.push` | 静态牌组构建 |

## 完整技能流程矩阵

| 对象 | 真相源 | 静态定义 | 候选/入口 | 命令/执行 | 消耗/限制 | 主效果 | 分支/否定 | 后续清理 | 证据层级 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 库鞭克 | 卡图裁片 | `mogu_blood_bloom` | 友方单位死亡后自动触发 | 死亡后处理 | 2 格、友方、非召唤师 | 充能 | 排除死亡单位/召唤师 | 无临时态 | L2 | passed |
| 托恩 | 卡图裁片 | `mogu_blood_rage` / `mogu_blood_rage_decay` | 单位死亡、回合结束 | 阶段/回合钩子 | 自己回合、至多 2 点衰减 | 充能、力量最多 +5 | 衰减上限 | 回合结束清理 | L2 | passed |
| 畸形巨怪 | 卡图裁片 | `mogu_final_form` | 召唤命令 | 先消灭再召唤 | 目标需 5+ 充能菌化野兽 | 替换登场 | 事件顺序防误删 | 无残留同格旧单位 | L2 | passed |
| 玛硕达 | 卡图裁片 | `mogu_decay` | 移动阶段结束 | 阶段结束处理 | 若自伤后仍在场才充能 | 相邻友方 +2 充能 | 死亡后不继续加 | 阶段推进 | L2 | passed |
| 枯萎法师 | 卡图裁片 | `mogu_blood_infusion` | 真实棋盘能力按钮 | system interaction + executor | 移动阶段、每回合一次、2 格内友方 | 目标 +1 充能并受 1 伤 | 当前无 skip；这是主动能力执行 | interaction 收口，棋盘状态变化 | L3 direct | passed |
| 鲜血萨满 | 卡图裁片 | `mogu_transmission` | 移动后能力执行 | system interaction + executor | 2 格内、任意数量 | 转移充能 | 允许 0 充能 | interaction 收口，棋盘状态变化 | L3 direct | passed |
| 菌化野兽 | 卡图裁片 | `mogu_infection` / `mogu_parasite` | 击杀后、攻击阶段结束 | 死亡后处理/阶段处理 | 历史错误：本文曾把寄生误审为“消耗 1 充能优先”；当前正确合同需要玩家二选一 UI | 替换敌方/自我维护 | 无充能时自伤 | 阶段推进 | L2 | historical_passed_invalid |
| 菌袍疫病体 | 卡图裁片 | `mogu_burst` / `mogu_fungal_mutation` | 魔力阶段结束、死亡后 | 阶段/死亡后处理 | 3+ 充能 | 自毁并可替换成菌化野兽 | 2 充能不自毁 | 弃牌堆移除 | L2 | passed |
| 命令 | 卡图裁片 | 事件牌定义 | 打出事件牌 | event card executor | 召唤师 3 格内友方士兵 | 额外攻击后消灭 | 目标范围由测试覆盖 | 事件牌进弃牌堆 | L2 | passed |
| 共生自愈 | 卡图裁片 | 事件牌定义 | 打出事件牌 | event card executor | 任意数量受伤友方士兵/英雄 | 治疗并充能 | 合法候选存在时可空选 | 事件牌消耗 | L3 direct success + skip | passed |
| 狂热菌菇 | 卡图裁片 | `mogu_fanatical_fungus` | 移动后持续事件 | system interaction + executor | 可推拉 1 格 | 充能并受伤 | 不推拉路径 | interaction 收口，棋盘状态变化 | L3 direct | passed |
| 释放菌袍 | 卡图裁片 | 事件牌定义 | 打出事件牌 | event card executor | 弃牌堆至多两张、相邻空格 | 疫病体入场 | 合法候选存在时可空选 | 事件牌消耗 | L3 direct success + skip | passed |
| 起始城门 | 卡图裁片 | `startingGate` | 起始设置 | 牌组初始化 | 起始建筑 | 入场 | 无 | 随对局初始化 | L1 + L3 entry | passed |
| 传送门 | 卡图裁片 | `STRUCTURE_CARDS_MOGU[1]` | 牌组构建 | deck builder | 固定数量 | 牌组内建筑 | 无 | 无 | L1 deck build | passed |

## 框架消费合同矩阵

| 消费合同 | 声明值 | 消费点 | 证据 | 状态 |
| --- | --- | --- | --- | --- |
| 阵营注册 | `mogu` | `config/factions/index.ts`、选派系 UI | 真实选派系 E2E 截图 `mogu-selection-entry.jpg` / `mogu-selection-picked.jpg` | passed |
| 用户可见状态 | `under_construction` | 阵营卡状态 ribbon | E2E 断言 `sw-faction-card-mogu-status-ribbon` 可见 | passed |
| 能力定义注册 | `MOGU_ABILITIES` | `domain/abilities.ts` | 175 条相关测试包含能力注册/交互链综合测试 | passed |
| executor 注册 | `mogu_blood_infusion`、`mogu_transmission`、`mogu_fanatical_fungus` | `domain/executors/index.ts` 导入 `./mogu` | `abilities-mogu.test.ts` 对 executor 最终状态断言 | passed |
| 棋盘主动按钮白名单 | `mogu_blood_infusion` | `systemInteractionAdapter.ts` 主动技能白名单与棋盘单位选择路由 | 真实棋盘按钮 E2E | passed |
| system interaction | `mogu_blood_infusion` / `selectUnit` | `systems.ts` 创建并结算目标选择交互 | E2E `uses Mogu Blood Infusion...` | passed |
| 阶段/回合钩子 | `onPhaseEnd` / `onTurnEnd` / death post-processing | `execute.ts`、阶段处理、死亡后处理 | 玛硕达、菌化野兽、菌袍疫病体、托恩测试 | passed |
| 事件牌执行 | `mogu-command`、`mogu-symbiotic-self-healing`、`mogu-release-spores` | `execute/eventCards.ts` | 命令、共生自愈、释放菌袍测试 | passed |
| i18n 按钮文案 | `abilityButtons.moguBloodInfusion`、`interaction.sw.moguBloodInfusion` | `public/locales/zh-CN/game-summonerwars.json`、`public/locales/en/game-summonerwars.json` | E2E 通过角色按钮名 `/鲜血灌注|Blood Infusion/i` 查找 | passed |
| 关键图片预加载 | `summonerwars/hero/mogu/cards/hero/tip` | `criticalImageResolver.ts` | `criticalImageResolver.test.ts` 已纳入 175 条验证命令 | passed |
| 资源 manifest | `zh-CN/summonerwars/hero/mogu/*` | `public/assets/i18n/assets-manifest.json` | `npm run assets:manifest` + `npm run assets:validate` | passed |
| 服务器资源主源 | `compressed/cards.webp`、`hero.webp`、`tip.webp` | `https://assets.easyboardgame.top/official/...` | HEAD 回查 200、Content-Length 与本地产物一致 | passed |

## D 维度命中表

| 维度 | 现实含义 | 莫古命中点 | 当前证据 | 状态 |
| --- | --- | --- | --- | --- |
| D1 语义保真 | 是否忠实于卡图规则 | 阶段、目标、范围、数量、伤害/充能数值 | 逐对象 L2 测试 | passed |
| D3 数据流闭环 | 定义到 UI/测试是否闭环 | faction、abilities、executors、i18n、E2E | 175 条验证 + 8 条定向 E2E | passed |
| D5 交互完整 | 玩家决策点是否有 UI | 枯萎法师“鲜血灌注”、鲜血萨满、狂热菌菇、共生自愈、释放菌袍 | E2E 截图链 | passed |
| D7 资源守恒 | 代价/消耗是否正确 | 充能消耗、事件牌消耗、弃牌堆移除 | L2 测试 | passed |
| D8 时序正确 | 触发顺序和阶段生命周期 | 回合结束、阶段结束、死亡后替换、先消灭再召唤 | L2 测试 | passed |
| D12 写入-消耗对称 | 写入字段是否被正确消费 | 充能、伤害、弃牌堆替换、interaction payload | L2 + 枯萎法师 E2E | passed |
| D15 UI 状态同步 | UI 是否读取实际状态 | 新按钮、状态提示、棋盘单位可见、系统能力选择横幅 | E2E 截图 | passed |
| D18 否定路径 | 不该发生的情况是否覆盖 | 空选、0 充能、不推拉、2 充能不爆裂、无充能自伤 | L2 测试 | passed |
| D21 触发频率门控 | 每回合/阶段限制是否成立 | 枯萎法师每回合一次、托恩回合结束、寄生攻击阶段结束、鲜血萨满/狂热菌菇移动后触发 | L2 测试 + E2E | passed |
| D25 MatchState 传播完整性 | 创建交互时状态是否传递 | `mogu_blood_infusion` system interaction | E2E 点击真实按钮并结算 | passed |
| D28 白名单完整性 | 新主动技能是否加入白名单 | `systemInteractionAdapter.ts` 主动技能白名单 | E2E 能看到并点击按钮 | passed |
| D33 跨实体同类能力路径一致性 | 同类充能/伤害/替换是否走一致事件 | 充能、伤害、弃牌堆替换 | L2 测试 | passed |
| D52 权威可视合同一致性 | 图集索引、对象、UI 识别是否一致 | 莫古选派系卡、进局单位、卡图/hero/tip 资源、新交互截图合图 | E2E 截图 + 资源 HEAD | passed |

## L4 共享链判等矩阵

| 对象 | 共享链名称 | 代表对象 | 是否仅配置不同 | 判等依据 | 当前收口口径 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 枯萎法师 | 棋盘主动能力按钮 -> 目标选择 -> executor -> 结算 | 枯萎法师自身 | 是 | direct E2E 覆盖真实按钮、目标选择和最终状态变化 | 玩家入口已测 | direct_passed |
| 鲜血萨满 | 移动后转移充能 system interaction -> 数量选择 -> executor | 鲜血萨满自身 | 否 | direct E2E 覆盖移动后模式选择、数量选择和最终转移结算 | 玩家入口已测 | direct_passed |
| 狂热菌菇 | 移动后持续事件 system interaction -> 推拉选择 -> executor | 狂热菌菇自身 | 否 | direct E2E 覆盖移动后推拉选择和最终结算 | 玩家入口已测 | direct_passed |
| 共生自愈 | 事件牌多选/空选 | 共生自愈自身 | 否 | direct E2E 覆盖从真实手牌打出、目标选择、治疗/充能结算、事件牌消耗和空选收口 | 成功与空选入口均已测 | direct_success_skip_passed |
| 释放菌袍 | 事件牌弃牌堆选择/空选 | 释放菌袍自身 | 否 | direct E2E 覆盖从真实手牌打出、相邻空格选择、弃牌堆菌袍疫病体入场、事件牌消耗和空选收口 | 成功与空选入口均已测 | direct_success_skip_passed |
| 菌化野兽/菌袍疫病体 | 死亡后替换与阶段结算 | 自动/被动链路自身 | 否 | 后处理与阶段链路无独立玩家点击入口；L2 测试覆盖弃牌堆替换、爆裂、菌化变异与寄生 | 系统入口已测 | system_passed |
| 自动/被动能力族 | 阶段/死亡/回合钩子 | 自动/被动链路自身 | 否 | 库鞭克、托恩、玛硕达等自动能力按阶段、死亡、回合系统测试收口 | 系统入口已测 | system_passed |

## 真实入口 E2E 与截图核验

| 验收项 | E2E 文件 | 截图 | 肉眼观察 | 状态 |
| --- | --- | --- | --- | --- |
| 真实选派系入口 | `e2e/summonerwars/summonerwars-mogu.e2e.ts` | `test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/selects-Mogu-from-real-faction-selection-and-starts-a-match-with-Mogu-units-visible/mogu-selection-entry.jpg` | 选派系界面有莫古卡，且状态 ribbon 可见 | passed |
| 真实选中莫古 | 同上 | `test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/selects-Mogu-from-real-faction-selection-and-starts-a-match-with-Mogu-units-visible/mogu-selection-picked.jpg` | 莫古已被选中，玩家状态显示莫古 | passed |
| 莫古进局可见 | 同上 | `test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/selects-Mogu-from-real-faction-selection-and-starts-a-match-with-Mogu-units-visible/mogu-game-started.jpg` | 棋盘上可见莫古单位与手牌区 | passed |
| 新交互按钮可见 | 同上 | `test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/uses-Mogu-Blood-Infusion-through-the-real-board-ability-button/mogu-blood-infusion-button-visible.jpg` | 枯萎法师“鲜血灌注”按钮可见，棋盘出现目标高亮 | passed |
| 新交互结算完成 | 同上 | `test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/uses-Mogu-Blood-Infusion-through-the-real-board-ability-button/mogu-blood-infusion-resolved.jpg` | 点击后棋盘出现充能/状态变化，交互可收口 | passed |
| 共生自愈目标选择 | 同上 | `test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/plays-Mogu-Symbiotic-Self-Healing-from-hand-and-resolves-selected-target/mogu-symbiotic-self-healing-selected.jpg` | 从真实手牌打出后，棋盘出现可选目标与事件牌交互提示 | passed |
| 共生自愈结算完成 | 同上 | `test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/plays-Mogu-Symbiotic-Self-Healing-from-hand-and-resolves-selected-target/mogu-symbiotic-self-healing-resolved.jpg` | 目标单位治疗/充能后交互收口，事件牌离手 | passed |
| 共生自愈空选入口 | 同上 | `test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/plays-Mogu-Symbiotic-Self-Healing-from-hand-and-can-skip-with-no-target-selected/mogu-symbiotic-self-healing-skip-ready.jpg` | 合法候选存在时可进入空选/跳过路径，提示与可选目标可见 | passed |
| 共生自愈空选结算 | 同上 | `test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/plays-Mogu-Symbiotic-Self-Healing-from-hand-and-can-skip-with-no-target-selected/mogu-symbiotic-self-healing-skip-resolved.jpg` | 跳过后交互正常收口，事件牌处理完成 | passed |
| 释放菌袍位置选择 | 同上 | `test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/plays-Mogu-Release-Spores-from-hand-and-summons-discard-bodies-to-selected-cells/mogu-release-spores-selected.jpg` | 从真实手牌打出后，棋盘出现召唤师相邻空格选择 | passed |
| 释放菌袍结算完成 | 同上 | `test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/plays-Mogu-Release-Spores-from-hand-and-summons-discard-bodies-to-selected-cells/mogu-release-spores-resolved.jpg` | 两张菌袍疫病体入场，交互收口；最终图已等待召唤特效自然消失，无白色光柱残影 | passed |
| 释放菌袍空选入口 | 同上 | `test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/plays-Mogu-Release-Spores-from-hand-and-can-skip-without-summoning-bodies/mogu-release-spores-skip-ready.jpg` | 合法弃牌堆目标存在时可进入空选/跳过路径，空格选择和提示可见 | passed |
| 释放菌袍空选结算 | 同上 | `test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/plays-Mogu-Release-Spores-from-hand-and-can-skip-without-summoning-bodies/mogu-release-spores-skip-resolved.jpg` | 跳过后交互正常收口，未错误召唤菌袍疫病体 | passed |
| 鲜血萨满模式选择 | 同上 | `test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/resolves-Blood-Shaman-Transmission-after-a-real-move-interaction/mogu-transmission-select-mode.jpg` | 移动后出现鲜血萨满传输交互，来源/目标选择入口可见 | passed |
| 鲜血萨满数量选择 | 同上 | `test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/resolves-Blood-Shaman-Transmission-after-a-real-move-interaction/mogu-transmission-select-amount.jpg` | 选择来源与目标后进入数量选择，任意数量路径可见 | passed |
| 鲜血萨满结算完成 | 同上 | `test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/resolves-Blood-Shaman-Transmission-after-a-real-move-interaction/mogu-transmission-resolved.jpg` | 充能转移完成，系统交互收口，棋盘状态更新 | passed |
| 狂热菌菇推拉选择 | 同上 | `test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/resolves-Fanatical-Fungus-after-a-real-move-interaction-with-push-target/mogu-fanatical-fungus-select-position.jpg` | 己方单位移动后，狂热菌菇持续事件出现推拉选择入口 | passed |
| 狂热菌菇结算完成 | 同上 | `test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/resolves-Fanatical-Fungus-after-a-real-move-interaction-with-push-target/mogu-fanatical-fungus-resolved.jpg` | 推拉、充能和伤害结算完成，系统交互收口 | passed |
| 最终审计合图 | 本轮审计脚本 | `test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/audit/mogu-full-audit-contact-sheet-2026-07-12.jpg` | 18 张截图按入口、选择、结算顺序展示；覆盖本轮所有真实入口 E2E，已完成 AI 图面核验 | passed |

## 资源链重审

| 项 | 证据 | 状态 |
| --- | --- | --- |
| 本地压缩资源 | `public/assets/i18n/zh-CN/summonerwars/hero/mogu/compressed/cards.webp`、`hero.webp`、`tip.webp` | passed |
| 定向预检 | `node scripts/assets/upload-to-server.js --check --asset-prefix i18n/zh-CN/summonerwars/hero/mogu` 输出 3 个待发布对象 | passed |
| manifest | `npm run assets:manifest` + `npm run assets:validate`，根级 i18n manifest 已包含莫古原图与 compressed 条目 | passed |
| 定向上传 | `node scripts/assets/upload-to-server.js --asset-prefix i18n/zh-CN/summonerwars/hero/mogu`，`serverPrimaryPublish=completed objects=3` | passed |
| 远端 HEAD | `cards.webp` 200/137518，`hero.webp` 200/131218，`tip.webp` 200/61882 | passed |
| Android package-managed 索引 | 上传脚本同步刷新 summonerwars Android package-managed file-index / manifest | passed |

## 测试结果

通过：

```text
npm run typecheck
passed
```

通过：

```text
node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-mogu.test.ts --configLoader native
24 tests passed
```

通过：

```text
node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/useGameEvents.test.ts --configLoader native
34 tests passed
```

通过：

```text
node scripts/assets/upload-to-server.js --check --asset-prefix i18n/zh-CN/summonerwars/hero/mogu
待发布 3 个对象：
official/i18n/zh-CN/summonerwars/hero/mogu/compressed/cards.webp (137518 bytes, md5=6b0aeea8a316dd36d908c7899ebe4c96)
official/i18n/zh-CN/summonerwars/hero/mogu/compressed/hero.webp (131218 bytes, md5=d6726a2c255a76b8a01e54b3ed2b9ac2)
official/i18n/zh-CN/summonerwars/hero/mogu/compressed/tip.webp (61882 bytes, md5=74aa5695f90323eab52a609a15693edb)
```

通过：

```text
npm run assets:manifest
npm run assets:validate
public/assets/i18n/assets-manifest.json 已包含 zh-CN/summonerwars/hero/mogu/cards、hero、tip 及 compressed/cards、compressed/hero、compressed/tip
```

通过：

```text
node scripts/assets/upload-to-server.js --asset-prefix i18n/zh-CN/summonerwars/hero/mogu
serverPrimaryPublish=completed objects=3
已发布 3 个莫古压缩资源；同步刷新 summonerwars Android package-managed file-index / manifest
```

远端 HEAD 回查：

```text
200 137518 image/webp https://assets.easyboardgame.top/official/i18n/zh-CN/summonerwars/hero/mogu/compressed/cards.webp
200 131218 image/webp https://assets.easyboardgame.top/official/i18n/zh-CN/summonerwars/hero/mogu/compressed/hero.webp
200 61882 image/webp https://assets.easyboardgame.top/official/i18n/zh-CN/summonerwars/hero/mogu/compressed/tip.webp
```

通过：

```text
node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-mogu.test.ts src/games/summonerwars/__tests__/factions.test.ts src/games/summonerwars/__tests__/criticalImageResolver.test.ts src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts --configLoader native
4 files / 175 tests passed
```

通过：

```text
npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-mogu.e2e.ts "selects Mogu"
passed
```

通过：

```text
npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-mogu.e2e.ts "Blood Infusion"
passed
```

通过：

```text
npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-mogu.e2e.ts "Symbiotic Self-Healing from hand and resolves selected target"
passed
```

通过：

```text
npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-mogu.e2e.ts "Symbiotic Self-Healing from hand and can skip"
passed
```

通过：

```text
npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-mogu.e2e.ts "Release Spores from hand and summons discard bodies"
passed
```

通过：

```text
npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-mogu.e2e.ts "Release Spores from hand and can skip"
passed
```

通过：

```text
npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-mogu.e2e.ts "Blood Shaman"
passed
```

通过：

```text
npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-mogu.e2e.ts "Fanatical Fungus"
passed
```

未纳入通过口径：

```text
src/games/summonerwars/__tests__/abilities.test.ts
失败点：亡灵弓箭手“灵魂转移”旧测试期望 trigger 为 onKill，但当前实现注册为 onUnitDestroyed。
处理口径：这是非莫古既有定义与旧测试不一致，本轮没有改亡灵弓箭手逻辑，暂不作为莫古机制阻塞。
```

## 收口口径

- 本段为 2026-07-12 历史收口口径，已被 2026-07-14 线上反馈推翻，不可作为当前结论引用。
- 历史当时判断：莫古本轮新增玩家交互已补齐：鲜血萨满移动后传输、狂热菌菇持续事件移动后推拉、共生自愈空选、释放菌袍空选均有真实入口 E2E。
- 历史当时判断：自动/被动对象没有独立玩家点击入口，按规则定义、执行器、阶段/死亡/回合系统测试与共享链判等收口。
- 历史当时截图：`test-results/evidence-screenshots/summonerwars/summonerwars-mogu.e2e/audit/mogu-full-audit-contact-sheet-2026-07-12.jpg`，合图包含 18 张截图并已完成 AI 图面核验。
- 当前可引用口径：只能以 `evidence/summonerwars/summonerwars-mogu-reentry-audit-2026-07-14.md` 为准。
