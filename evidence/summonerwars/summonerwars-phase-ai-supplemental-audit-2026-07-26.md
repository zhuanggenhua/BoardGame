# 召唤师战争实施中派系全集阶段与 AI 合法动作补审记录（2026-07-26）

- 结论等级：D8/D55/D6 专项补审已通过；2026-07-27 二审发现 D3/D33 审计口径缺口，本文不能再被解读为“所有通用维度全面收口”。
- 本次范围：莫古、灰烬、永恒议会三个实施中派系。2026-07-26 重点覆盖 D8 阶段真实推进链、D55 AI 合法动作与自动跳过消费者一致性、D6 死亡后处理；2026-07-27 追加 D3/D33“静态定义空效果 vs 运行时旁路消费”通用维度二审。
- 旧证据边界：`summonerwars-mogu-reentry-audit-2026-07-14.md` 中 2026-07-16 的代码验证完成口径未覆盖本次暴露的 `ADVANCE_PHASE` 阶段退出消费者和 AI legal-actions 消费者；本文只补齐实施中派系全集在 D8/D55/D6 与本次 D3/D33 结构维度上的口径，不代表生产部署或全 D1-D57 深审已重跑。

## 全面审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象全集 | passed | `FACTION_CATALOG` 当前 `statusTag: 'under_construction'` 只有莫古、灰烬、永恒议会；本文件按三个派系列批次矩阵 |
| 规则子句表 | passed | 用户原始症状拆为 C1/C2 级子句；灰烬与永恒议会召唤阶段持续事件按“召唤阶段可打出 / AI 不只剩结束阶段”子句补证 |
| 完整技能流程矩阵 | passed | 莫古保留对象级 D8/D55 完整流程矩阵；灰烬与永恒议会新增 D55 AI 合法动作矩阵、D8 阶段触发等价消费矩阵；2026-07-27 补 D3/D33 空效果能力旁路消费矩阵 |
| L0-L4 证据层级 | passed | L0/L1 来自静态定义和已锁 intake evidence；L2 来自 Vitest；L3/L4 引用既有灰烬 / 永恒议会真实入口 evidence 与本轮阶段/AI 消费者补证 |
| 命中 D 维度 | passed | 本轮命中 D8、D55、D6、D3、D33；不命中对象逐行写不适用原因 |
| 真实入口 E2E 与截图核验 | passed | 莫古、灰烬、永恒议会既有 intake / E2E evidence 保留真实入口截图；本轮不新增 UI 形态，仅补 AI/阶段消费者代码验证 |
| 测试语义对账 / 旧测试失效检查 | passed | 本轮测试断言最终权威状态、完整命令 payload、AI 动作集合不只剩 `advance-phase`；旧莫古口径已回写失效边界 |
| 同类扩审记录 | passed | 根因关键词：`PHASE_END_ABILITIES`、`PHASE_START_ABILITIES`、`buildEventCardActions`、`buildSummonerWarsAiLegalActions`、召唤阶段持续事件、空牌库自动跳过 |
| 分支/可选/数量边界 | passed | 腐坏“仍在场才继续”、爆裂“3+ 充能才消灭”、探寻“确认/跳过抓牌”、心念侵袭“可跳过目标”均有既有或本轮证据 |
| 阶段/生命周期收口 | passed | `ADVANCE_PHASE` 阶段推进、`flowHalted` 阶段结束交互、持续事件阶段开始交互、AI 召唤阶段动作集合均已补证；流程收口不依赖单层 validator |
| 残余范围声明 | passed | 当前边界明确排除生产部署、AI 策略评分优劣重调；腐坏手动指定目标已在 2026-07-27 补成正式 simple-choice 交互；灰烬/永恒议会空效果旁路消费已登记为结构 finding，不再按“未实现”残余表述 |
| 旧 evidence / 旧结论对账回写 | passed | 已回写 `summonerwars-mogu-reentry-audit-2026-07-14.md`；本文件替代莫古旧 D8/D55 口径，并补灰烬、永恒议会同批口径 |

## 审计范围

| 范围层级 | 本次覆盖 | 本次不覆盖 |
| --- | --- | --- |
| 实施中派系全集 | `src/games/summonerwars/config/factions/index.ts` 中 `statusTag: 'under_construction'` 的莫古、灰烬、永恒议会 | 已可选但未标记实施中的兽人，以及所有成熟旧派系全量重审 |
| 莫古对象全集 | 库鞭克、托恩、畸形巨怪、玛硕达、枯萎法师、鲜血萨满、菌化野兽、菌袍疫病体、命令、共生自愈、狂热菌菇、释放菌袍、起始城门、传送门 | 生产部署 |
| 灰烬对象全集 | 召唤师奥莉安娜、灰烬守卫、灰烬弓箭手、炫目光芒、灼烧、神族复仇、凤凰之魂、起始城门、传送门；其中本轮 D55 命中召唤阶段持续事件「凤凰之魂」，D8 命中阶段结束技能「召集护卫」与阶段开始技能「燎原」 | 灰烬中 `effects: []` 不是统一未实现标记；怒焰召唤、点燃、护主、火焰喷吐、还击、庇护、烈火降生均已由旁路消费者实现，见 2026-07-27 D3/D33 二审 |
| 永恒议会对象全集 | 大议长艾迪雅、城塞参谋、心灵骑士、远古学者、主管奥维、主管卡图、神秘学者、学习、洞察、探寻、心念侵袭、起始城门、传送门；其中本轮 D55 命中召唤阶段持续事件「洞察」「探寻」「心念侵袭」，D8 命中「探寻」阶段开始等价系统消费链 | 永恒议会中延续、惩戒、谋划同样是空 effects 但运行时已实现；本轮登记为旁路消费结构 finding，不再表述为未接执行器残余 |
| 用户点名链路 | 腐坏、爆裂/菌化变异、复活死灵自动跳过 | 其它游戏全量 AI 策略评分质量 |
| 同类扩审 | 莫古召唤阶段持续事件「狂热菌菇」、灰烬「凤凰之魂」、永恒议会「洞察」「探寻」「心念侵袭」、畸形巨怪「最终形态」；跨派系同类特殊召唤入口雷塔勒斯「复活死灵」、伊路特-巴尔「火祀召唤」 | 非召唤阶段 AI 策略优劣评分重调 |
| 规范补强 | D8 阶段真实推进链、D55 AI 合法动作与自动跳过消费者一致性；新增 / 实施中批次漏审时补审范围升级到批次全集 | 其它 D 维度重写 |

## 权威来源

- 真相源：`FACTION_CATALOG` 的实施中状态、已锁规则合同、当前代码、当前测试结果。
- 合同入口：`evidence/summonerwars/summonerwars-mogu-reentry-audit-2026-07-14.md`、`evidence/summonerwars/summonerwars-huijin-intake-2026-07-16.md`、`evidence/summonerwars/summonerwars-huijin-reintake-2026-07-20.md`、`evidence/summonerwars/summonerwars-yongheng-intake-2026-07-21.md`、`evidence/summonerwars/b3-p2-rule-text-lock-matrix-2026-07-02.md`、`evidence/summonerwars/b8-p3-p4-static-summon-and-death-rule-text-lock-matrix-2026-07-02.md`。
- 图片合同表：本轮不新增图片 / 图集 / 卡图真相源；“主管卡图”是永恒议会角色中文名，不是卡牌图片证据。莫古完整单卡主裁图、裁图清单与 SHA256 保留在 `summonerwars-mogu-reentry-audit-2026-07-14.md`；灰烬、永恒议会图片合同仍以各自 intake evidence 为准。
- 当前实现入口：`src/games/summonerwars/config/factions/index.ts`、`src/games/summonerwars/config/factions/huijin.ts`、`src/games/summonerwars/config/factions/yongheng.ts`、`src/games/summonerwars/domain/flowHooks.ts`、`src/games/summonerwars/domain/systems.ts`、`src/games/summonerwars/domain/customActionHandlers.ts`、`src/games/summonerwars/ai.ts`。
- 当前测试入口：`src/games/summonerwars/__tests__/flow.test.ts`、`src/games/summonerwars/__tests__/phase-ability-integration.test.ts`、`src/games/summonerwars/__tests__/abilities-mogu.test.ts`、`src/games/summonerwars/__tests__/abilities-huijin.test.ts`、`src/games/summonerwars/__tests__/abilities-yongheng.test.ts`。

## 用户原始症状

| 症状 | 保真描述 | 当前命中对象 |
| --- | --- | --- |
| 腐坏 | 移动阶段结束时对本单位造成 1 点伤害；若仍在场，应能让相邻友方单位获得 2 点充能 | 玛硕达「腐坏」（`mogu_decay`） |
| 复活死灵自动跳过 | 召唤师牌库没牌时自动跳过召唤阶段，导致复活死灵这类召唤型牌/能力无法正常使用 | 雷塔勒斯「复活死灵」（`revive_undead`） |
| 爆裂 | 魔力阶段结束时，3+ 充能的菌袍疫病体应消灭，并继续进入菌化变异替换链 | 菌袍疫病体「爆裂 / 菌化变异」（`mogu_burst` / `mogu_fungal_mutation`） |
| 审计维度不足 | 不是单张牌文案没录，而是审计没覆盖真实阶段推进和 AI 自动推进消费者 | D8 / D55 漏审 |

## 前提锁定

| 项 | 当前结论 |
| --- | --- |
| 问题对象 | 召唤师战争领域规则链：阶段结束自动技能、死亡后处理、召唤阶段 AI 合法动作 |
| 真相来源 | 已锁规则合同与当前实现入口：`evidence/summonerwars/summonerwars-mogu-reentry-audit-2026-07-14.md`、`b3-p2-rule-text-lock-matrix-2026-07-02.md`、`b8-p3-p4-static-summon-and-death-rule-text-lock-matrix-2026-07-02.md`、当前代码与当前测试 |
| 目标入口 | 当前仓库 `D:\gongzuo\webgame\BoardGame`；真实阶段入口为 `FLOW_COMMANDS.ADVANCE_PHASE`；AI 入口为 `buildSummonerWarsAiLegalActions` / `resolveNextLocalAiAction` |
| 验收口径 | 行为证据必须落到最终权威状态：阶段推进后棋盘伤害/充能/替换状态正确；召唤阶段有合法动作时 AI 动作集合不得只剩结束阶段 |

## 漏审归因

| 漏审层 | 之前覆盖到什么 | 缺了什么 | 本次补法 |
| --- | --- | --- | --- |
| D8 时序正确 | 能力定义、resolver、部分 L2 行为测试 | `trigger: 'onPhaseEnd'` 是否接入真实 `PHASE_END_ABILITIES` 和 `ADVANCE_PHASE`；阶段退出事件是否继续死亡后处理 | `flowHooks.ts` 接入 `mogu_decay` / `mogu_burst`，阶段退出后跑死亡后处理与菌化变异补链；新增结构守卫测试 |
| D6 副作用传播 | 看见伤害或消灭事件 | 阶段退出产生的 `UNIT_DESTROYED` 是否继续触发 `mogu_fungal_mutation` | `flow.test.ts` 直接断言 `ADVANCE_PHASE` 后棋盘位置已被菌化野兽替换 |
| D55 多消费者一致性 | 人工 UI / 命令层验证过复活、特殊召唤或召唤阶段事件 | AI legal-actions 没有完整 payload，或空牌库时只看到 `advance-phase` | `ai.ts` 给复活死灵、火祀召唤、最终形态生成完整合法动作；新增莫古「狂热菌菇」空牌库召唤阶段事件回归 |
| D3 / D33 静态定义与旁路消费 | 静态定义、部分执行器和旧 intake evidence 分别存在 | `effects: []` 被误读成未实现，或相反被误读成静态定义完整闭环；同批次里 effects/custom 与旁路特判并存未分类 | 更新通用维度文档；新增实施中派系空 effects 分类守卫；在本文件登记灰烬 / 永恒议会旁路消费矩阵 |

## 2026-07-27 通用维度二审：不是只有用户点名 bug

| 类型 | 结论 | 证据 / 处理 |
| --- | --- | --- |
| 用户点名玩法 bug | 腐坏、爆裂、复活死灵空牌库自动跳过属于 D8/D55/D6 专项问题，已按实施中派系全集补审并有定向回归 | 见下方 D8/D55 矩阵与验证命令 |
| 新发现的审计口径 bug | 旧文档把 `effects: []` 近似理解为“未接执行器/未实现”，但灰烬、永恒议会已有多条空 effects 能力通过旁路运行时消费并在 intake 中 passed | 已更新 D3/D33 维度，并新增空 effects 能力分类守卫 |
| 新发现的结构 finding | 同一实施中批次里存在 `effects/custom action` 与 helper / execute / abilityResolver / systems 旁路并存。它不等于玩法行为坏了，但会让静态审计误判和漏测 | 登记为 D3/D33：静态定义不能独立解释全部行为，必须维护旁路消费证据映射 |
| 2026-07-27 腐坏交互补修 | 腐坏“可以指定相邻友方目标”的手动选择 UI 已补成正式 simple-choice 交互；`ADVANCE_PHASE` 与 legacy `END_PHASE` 均不再自动选第一个友方 | 新增目标选择、跳过、无目标、自伤死亡、UI adapter 回归和真实页面 E2E；生产部署与 AI 策略评分优劣仍不在本文证明范围 |

### D3/D33 空 effects 旁路消费矩阵

| 派系 | 能力 | 空 effects 分类 | 运行时消费者 | 现有证据 | 二审结论 |
| --- | --- | --- | --- | --- | --- |
| 灰烬 | 赫丽丝「怒焰召唤」（`huijin_ember_summon`） | 已实现旁路消费 | `helpers.getValidSummonPositions` / `getSummonablePositions` | `summonerwars-huijin-intake-2026-07-16.md` L2 机制矩阵 | 不能判未实现；登记为 D3/D33 结构 finding |
| 灰烬 | 赫丽丝「点燃」（`huijin_ignite`） | 已实现旁路消费 | `abilityResolver.calculateEffectiveStrength` | `summonerwars-huijin-intake-2026-07-16.md` L2 机制矩阵 | 不能判未实现；登记为 D3/D33 结构 finding |
| 灰烬 | 火焰龙兽「护主」（`huijin_guard_master`） | 已实现旁路消费 | `helpers.getValidSummonPositions` / `getSummonablePositions` | `summonerwars-huijin-intake-2026-07-16.md` L2 机制矩阵 | 不能判未实现；登记为 D3/D33 结构 finding |
| 灰烬 | 火焰龙兽「火焰喷吐」（`huijin_flame_breath`） | 已实现旁路消费 | `helpers.canAttackEnhanced` + `execute.ts DECLARE_ATTACK` | `summonerwars-huijin-intake-2026-07-16.md` L2 机制矩阵 | 不能判未实现；登记为 D3/D33 结构 finding |
| 灰烬 | 风妮莎「还击」（`huijin_counterattack`） | 已实现旁路消费 | `execute.ts DECLARE_ATTACK` 攻击后处理 | `summonerwars-huijin-intake-2026-07-16.md` L2 机制矩阵 | 不能判未实现；登记为 D3/D33 结构 finding |
| 灰烬 | 灰烬法师「庇护」（`huijin_shelter`） | 已实现旁路消费 | `execute.ts DECLARE_ATTACK` 首次攻击伤害上限 | `summonerwars-huijin-intake-2026-07-16.md` L2 机制矩阵 | 不能判未实现；登记为 D3/D33 结构 finding |
| 灰烬 | 灰烬野兽「烈火降生」（`huijin_born_of_flame`） | 已实现旁路消费 | `helpers.getValidSummonPositions` / `getSummonablePositions` | `summonerwars-huijin-intake-2026-07-16.md` L2 机制矩阵 | 不能判未实现；登记为 D3/D33 结构 finding |
| 永恒议会 | 大议长艾迪雅「延续」（`yongheng_continuance`） | 已实现旁路消费 | `yonghengMechanics.interceptYonghengContinuanceEvent` + `systems.ts` 交互收口 | `summonerwars-yongheng-intake-2026-07-21.md` L2/L3/L4 | 不能判未实现；登记为 D3/D33 结构 finding |
| 永恒议会 | 主管玛鲁娜「惩戒」（`yongheng_punish`） | 已实现旁路消费 | `getYonghengPostProcessEvents` 监听 `UNIT_SUMMONED` + `systems.ts` 强制弃牌交互 | `summonerwars-yongheng-intake-2026-07-21.md` L2/L3/L4 | 不能判未实现；登记为 D3/D33 结构 finding |
| 永恒议会 | 主管奥维「谋划」（`yongheng_scheme`） | 已实现旁路消费 | `abilityResolver.calculateEffectiveStrength` | `summonerwars-yongheng-intake-2026-07-21.md` L2 机制矩阵 | 不能判未实现；登记为 D3/D33 结构 finding |

### D3/D33 守卫回写

- 通用维度已补：`.spec/knowledge/standards/testing-audit-dimensions.md` 和 `testing-audit-dimensions-semantics-interaction.md` 要求空 effects 能力必须分类为“已实现旁路消费 / 有意静态被动 / 真实占位”。
- 机器守卫已补：`src/games/summonerwars/__tests__/entity-chain-integrity.test.ts` 新增实施中派系空 effects 分类测试，新增空效果能力未登记消费者和 evidence 时会失败。

## 逐项结论

| 对象 | 规则子句 | 实现入口 | 新增证据 | 结论 |
| --- | --- | --- | --- | --- |
| 玛硕达「腐坏」（`mogu_decay`） | C1 移动阶段结束自伤；C2 若仍在场，可指定相邻友方；C3 选中目标后 +2 充能；C4 跳过/无目标/自伤死亡不充能 | `PHASE_END_ABILITIES.move`、`flowHooks.ts`、`execute.ts` legacy `END_PHASE`、`systems.ts` `mogu_decay_select_target`、`systemInteractionAdapter.ts` | `flow.test.ts`：`ADVANCE_PHASE` 先自伤并进入目标选择；`interaction-chain-comprehensive.test.ts`：legacy `END_PHASE` 目标选择、跳过、无目标、自伤死亡；UI adapter 单测覆盖棋盘单位点选 | 通过；旧“自动选第一个相邻友方”口径失效 |
| 菌袍疫病体「爆裂 / 菌化变异」（`mogu_burst` / `mogu_fungal_mutation`） | C1 魔力阶段结束 3+ 充能消灭；C2 若可能，用弃牌堆菌化野兽替换 | `PHASE_END_ABILITIES.magic`、`postProcessDeathChecks`、`appendDirectDestroyDeathTriggers` | `flow.test.ts`：`ADVANCE_PHASE` 离开魔力阶段后出现 `UNIT_DESTROYED` 与 `UNIT_SUMMONED`，棋盘原位置变为菌化野兽 | 专项通过 |
| 雷塔勒斯「复活死灵」（`revive_undead`） | 召唤阶段可自伤 2，从弃牌堆取亡灵单位放在相邻空格 | `buildActivatedAbilityActions` 生成 `ACTIVATE_ABILITY` 完整 payload | `flow.test.ts`：牌库为空、手牌为空但弃牌堆有亡灵时，AI legal-actions 暴露复活死灵，且策略选择 `activate-ability` | 专项通过 |
| 伊路特-巴尔「火祀召唤」（`fire_sacrifice_summon`） | 召唤支付时必须摧毁友方单位，并用本单位替换其位置 | `buildSummonActions` 生成 `SUMMON_UNIT(cardId, position, sacrificeUnitId)` | `flow.test.ts`：牌库为空且手牌有火祀召唤单位时，AI legal-actions 暴露 `fire_sacrifice_summon`，不只剩结束阶段 | 同类扩审样本通过 |
| 畸形巨怪「最终形态」（`mogu_final_form`） | 召唤时必须消灭 5+ 充能友方菌化野兽，并替换其位置 | `buildSummonActions` 生成 `SUMMON_UNIT(cardId, position, sacrificeUnitId)` | `flow.test.ts`：牌库为空且有 5+ 充能菌化野兽时，AI legal-actions 暴露 `mogu_final_form`，不只剩结束阶段 | 同类扩审样本通过 |

## 实施中派系全集 D8/D55 补审矩阵

| 派系 | 对象 | 规则子句 / 审计子句 | 实现入口 | D 维度 | 证据层级 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 莫古 | 玛硕达「腐坏」 | C1 移动阶段结束自伤；C2 仍在场才进入相邻友方目标选择；C3 玩家选择后目标 +2 充能；C4 跳过/无目标/自伤死亡不充能 | `PHASE_END_ABILITIES.move`、`onPhaseExit`、`execute.ts` legacy `END_PHASE`、`systems.ts` simple-choice、`systemInteractionAdapter.ts` | D8/D5/D6/D55 | L2/L4 | 通过；最终权威状态由玩家目标选择决定，不再自动选第一个友方 |
| 莫古 | 菌袍疫病体「爆裂 / 菌化变异」 | C1 魔力阶段结束 3+ 充能消灭；C2 死亡后用弃牌堆菌化野兽替换 | `PHASE_END_ABILITIES.magic`、死亡后处理、`mogu_fungal_mutation` | D8/D6 | L2/L4 | 通过；最终状态为原位置替换且阶段可继续 |
| 莫古 | 畸形巨怪「最终形态」 | C1 召唤支付时必须消灭 5+ 充能友方菌化野兽；C2 替换其位置 | `buildSummonActions`、`SUMMON_UNIT` payload | D55/D18 | L2 | 通过；AI 空牌库时仍暴露完整 payload |
| 莫古 | 「狂热菌菇」 | C1 召唤阶段可打出持续事件；C2 空牌库不应让 AI 只剩结束阶段 | `buildEventCardActions`、`PLAY_EVENT` | D55 | L2 | 通过；AI legal-actions 暴露 `PLAY_EVENT` |
| 莫古 | 其它莫古对象 | 本轮 D8/D55 不适用或已有旧证据覆盖；对象级明细见下方莫古矩阵 | 对象各自定义、handler、测试入口 | D3/D5/D8/D18 | L1/L2/L3 | 已列入批次全集，不用代表对象冒充全集 |
| 灰烬 | 玛达莉雅女王「召集护卫」 | C1 攻击阶段结束可消耗 1 充能；C2 选择场上友方士兵；C3 放到召唤师相邻空格 | `PHASE_END_ABILITIES.attack`、`CONFIRMABLE_PHASE_END_ABILITIES`、`huijin_call_guards` handler | D8/D5/D55 | L2/L3/L4 | 通过；既有灰烬重录入 evidence 覆盖真实阶段结束交互与最终位置 |
| 灰烬 | 灰烬野兽「野火」 | C1 移动阶段开始对相邻敌方造成 1 伤害；C2 阶段开始技能必须登记 | `PHASE_START_ABILITIES.move`、`huijin_wildfire` | D8/D6 | L1/L2 | 通过；阶段表守卫覆盖 trigger 与注册一致 |
| 灰烬 | 「凤凰之魂」 | C1 召唤阶段可打出持续事件；C2 牌库为空时 AI 不应只剩结束阶段 | `buildEventCardActions`、`PLAY_EVENT` | D55 | L2 | 本轮新增回归覆盖 `huijin-phoenix-soul-0` |
| 灰烬 | 赫丽丝、火焰龙兽、风妮莎、灰烬法师、皇家守卫、灰烬弓箭手、炫目光芒、灼烧、神族复仇、起始城门、传送门 | 本轮 D55 空牌库召唤阶段自动跳过不适用；阶段/机制状态按灰烬 intake 与重录 evidence 保留；空 effects 能力按 2026-07-27 D3/D33 旁路消费矩阵登记 | 静态配置、灰烬能力测试、真实入口 E2E、空 effects 分类守卫 | D1/D3/D5/D8/D33/D52 | L1/L2/L3 | 纳入实施中批次全集；不能再把 `effects: []` 简单写成未实现 |
| 永恒议会 | 「洞察」 | C1 召唤阶段可打出持续事件；C2 牌库为空时 AI 不应只剩结束阶段 | `buildEventCardActions`、`PLAY_EVENT` | D55 | L2 | 本轮新增回归覆盖 `yongheng-insight-0` |
| 永恒议会 | 「探寻」 | C1 召唤阶段可打出持续事件；C2 移动/建造/攻击阶段开始确认或跳过抓牌；C3 空牌库召唤阶段 AI 不应只剩结束阶段 | `buildEventCardActions`、`systems.ts` PHASE_CHANGED 消费链、`yongheng_search` 等价阶段开始消费例外 | D55/D8/D5 | L2/L3/L4 | 本轮新增 AI 回归和 onPhaseStart 等价消费守卫；既有永恒议会 evidence 覆盖确认/跳过与截图 |
| 永恒议会 | 「心念侵袭」 | C1 召唤阶段可打出持续事件；C2 己方抓牌后可选 2 格内敌方士兵/英雄造成 1 伤害；C3 可跳过目标 | `buildEventCardActions`、`getYonghengPostProcessEvents`、`yongheng_mental_invasion` interaction | D55/D5/D18 | L2/L3/L4 | 本轮新增 AI 回归；既有永恒议会 evidence 覆盖目标选择、跳过、无合法目标负向 |
| 永恒议会 | 主管卡图「坚毅」 | C1 回合结束且牌库空则充能；C2 力量强化最多 +5 | `triggerSequentialUnitAbilities('onTurnEnd')`、`yongheng_tenacity` | D8/D14 | L2 | 既有永恒议会能力测试覆盖空牌库正向和非空负向 |
| 永恒议会 | 大议长艾迪雅、学习、城塞参谋、心灵骑士、主管玛鲁娜、远古学者、主管奥维、玄谜贤者、起始城门、传送门 | 本轮 D55 空牌库召唤阶段自动跳过不适用或已由对应持续事件行覆盖；对象级机制按永恒议会 intake evidence 保留 | 静态配置、永恒议会能力测试、真实入口 E2E | D1/D3/D5/D8/D18/D52 | L1/L2/L3/L4 | 纳入实施中批次全集，不用单个事件代表全部对象 |

## 莫古子范围 D8/D55 补审明细

| 莫古对象 | 本次补审维度判定 | 当前实现 / 消费入口 | 本次或既有证据 | 结论 |
| --- | --- | --- | --- | --- |
| 库鞭克「血腥绽放」（`mogu_blood_bloom`） | 命中 D6/D8 死亡后处理；不命中 D55 召唤阶段自动跳过 | `execute.ts` 死亡后处理基于归约后的棋盘触发周围友方充能 | `abilities-mogu.test.ts`：2 格内友方死亡后充能，不给召唤师和死亡单位；2026-07-17 追加狂热菌菇自伤致死触发血腥绽放证据 | 莫古子范围覆盖，无新增代码 |
| 托恩「血腥狂怒 / 充能强化 / 衰减」（`mogu_blood_rage` / `power_up` / `mogu_blood_rage_decay`） | 命中 D8 回合结束真实收口；不命中 D55 | 死亡触发充能；抽牌阶段结束的回合结束链逐个应用衰减 | `abilities-mogu.test.ts`：单位死亡充能、力量最多 +5、回合结束移除至多 2 充能并换人后收口 | 莫古子范围覆盖，无新增代码 |
| 畸形巨怪「最终形态」（`mogu_final_form`） | 命中 D55 召唤阶段特殊 payload；命中 D18 负向路径 | `buildSummonActions` / `SUMMON_UNIT` payload 带 `sacrificeUnitId` 和替换位置 | `flow.test.ts`：空牌库仍暴露最终形态 AI 合法动作；`abilities-mogu.test.ts` 覆盖无候选、低充能、多候选只替换指定目标 | 通过 |
| 玛硕达「腐坏」（`mogu_decay`） | 命中 D8 阶段退出真实推进链、D5 可选目标交互、D6 自伤死亡负向链 | `PHASE_END_ABILITIES.move`、`onPhaseExit`、`execute.ts` legacy `END_PHASE`、`systems.ts` `mogu_decay_select_target`、`systemInteractionAdapter.ts` | `flow.test.ts` 覆盖真实 `ADVANCE_PHASE` 自伤后等待目标；`interaction-chain-comprehensive.test.ts` 覆盖目标选择、跳过、无目标、自伤死亡；`abilities-mogu.test.ts` 覆盖 execute 层不再自动充能与爆裂链 | 通过；手动指定目标已补为正式交互 |
| 枯萎法师「鲜血灌注」（`mogu_blood_infusion`） | 不命中 D8/D55；纳入莫古子范围对象矩阵防漏 | 主动技能按钮、`ACTIVATE_ABILITY`、每回合一次使用计数 | `abilities-mogu.test.ts`：2 格内友方充能并受伤、`abilityUsageCount` 写入、二次使用返回“每回合只能使用一次”；旧 E2E 覆盖真实按钮使用后隐藏 | 莫古子范围覆盖，无新增代码 |
| 鲜血萨满「传输」（`mogu_transmission`） | 不命中召唤阶段 D55；命中多步交互 D3/D5/D18，按旧证据保留 | 移动后系统交互：模式 -> 来源 -> 目标 -> 数量 -> `ACTIVATE_ABILITY` | `abilities-mogu.test.ts`：2 格内转移充能、0 充能不改变权威状态；旧 E2E 覆盖真实移动后传输 | 莫古子范围覆盖，无新增代码 |
| 菌化野兽「感染 / 寄生」（`mogu_infection` / `mogu_parasite`） | 命中 D8 攻击阶段结束交互和死亡替换；不命中 D55 | `PHASE_END_ABILITIES.attack`、simple-choice 二选一、死亡后从弃牌堆替换 | `phase-ability-integration.test.ts` 结构守卫确保 `mogu_parasite` 已登记；`abilities-mogu.test.ts` 覆盖感染替换、寄生选择前不自动替玩家选择、真实击杀来源移除 | 莫古子范围覆盖，无新增代码 |
| 菌袍疫病体「爆裂 / 菌化变异」（`mogu_burst` / `mogu_fungal_mutation`） | 命中 D8 阶段退出真实推进链；命中 D6 死亡后替换补链 | `PHASE_END_ABILITIES.magic`、`postProcessDeathChecks`、`appendDirectDestroyDeathTriggers` | `flow.test.ts`：真实 `ADVANCE_PHASE` 后消灭并替换为菌化野兽；`abilities-mogu.test.ts` 覆盖 2 充能负向、同阶段只替换一次、弃牌堆来源清理 | 通过 |
| 「命令」（`mogu-command`） | 不命中 D55；命中 D8 攻击完成后再消灭 | `PLAY_EVENT` 写入额外攻击来源，攻击结算后消费并消灭目标 | `abilities-mogu.test.ts`：打出时目标不立刻死亡，额外横向攻击完成后再消灭 | 莫古子范围覆盖，无新增代码 |
| 「共生自愈」（`mogu-symbiotic-self-healing`） | 不命中 D8/D55；纳入可选/任意数量对象矩阵 | `REQUEST_EVENT_INTERACTION` 多目标选择与空选 | `abilities-mogu.test.ts`：治疗多个目标并充能、空选只消耗事件牌、不重复结算 | 莫古子范围覆盖，无新增代码 |
| 「狂热菌菇」（`mogu-fanatical-fungus`） | 命中 D55 召唤阶段事件合法动作；命中移动后交互 D3/D5 | 召唤阶段 `PLAY_EVENT` 进入持续事件；移动后系统交互结算推拉/不推拉、充能、自伤 | 新增 `flow.test.ts`：牌库为空且手牌有狂热菌菇时 AI 不只剩结束阶段；`abilities-mogu.test.ts` 覆盖推拉与不推拉最终状态；2026-07-17 追加真实 UI 不推拉证据 | 通过 |
| 「释放菌袍」（`mogu-release-spores`） | 不命中召唤阶段 D55；命中多目标/至多/空选 D18 | 魔力阶段事件交互，从弃牌堆取至多两张疫病体放到召唤师相邻格 | `abilities-mogu.test.ts`：成功、空选、重复打出、无效落位、重复卡牌 id 均不污染最终状态；旧 E2E 覆盖真实魔力阶段入口 | 莫古子范围覆盖，无新增代码 |
| 起始城门 / 传送门 | 不命中 D8/D55；作为莫古子范围对象全集保留 | 静态结构与召唤位置来源 | `summonerwars-mogu-reentry-audit-2026-07-14.md`：起始城门、传送门字段与牌组生成合同；`factions.test.ts` / 旧 E2E 覆盖进局可见与召唤入口 | 莫古子范围覆盖，无新增代码 |

## 维度与规范更新

| 文档 | 更新点 |
| --- | --- |
| `.spec/knowledge/standards/testing-audit-dimensions.md` | D8 增加真实 `ADVANCE_PHASE` / `onPhaseExit` 消费与死亡后处理检查；D55 增加 AI legal-actions、空牌库自动跳过、召唤阶段事件、召唤型特殊入口矩阵；D3/D33 增加 `effects: []` 旁路消费分类要求 |
| `.spec/knowledge/standards/testing-audit-dimensions-semantics-interaction.md` | 新增 D3 子项“静态定义与旁路消费一致性审计”，要求空 effects 能力分类为已实现旁路消费 / 有意静态被动 / 真实占位，并补 evidence 或机器守卫 |
| `.spec/knowledge/standards/testing-audit-dimensions-resource-timing.md` | 新增 D8 子项“阶段退出真实推进链”，要求所有 `onPhaseEnd` 定义必须接入阶段表或写明等价消费链 |
| `.spec/knowledge/standards/testing-audit-dimensions-state-pipeline.md` | 新增 D55 子项“AI 合法动作与自动跳过消费者一致性”，要求 validator/UI/AI/auto-continue 同审；召唤阶段全入口清单补入事件/持续事件；实施中批次补审必须覆盖批次全集并逐对象写不适用原因 |
| `.spec/knowledge/standards/testing-audit-core-principles.md` | 技能完整流程矩阵的“候选生成”加入 AI legal-actions 与自动推进消费者；“静态定义”加入空 effects 旁路消费证据映射；新增 / 实施中批次漏审时补审范围默认升级到批次对象全集 |
| `src/games/summonerwars/__tests__/entity-chain-integrity.test.ts` | 新增实施中派系空 effects 能力分类守卫，覆盖莫古、灰烬、永恒议会；新增空 effects 能力不登记消费者和 evidence 时失败 |

## 修订或失效记录

| 项 | 记录 |
| --- | --- |
| 旧文档失效点 | 2026-07-16 的莫古代码验证完成口径没有单独证明 `ADVANCE_PHASE` 阶段退出消费者，也没有证明 AI legal-actions 在空牌库时仍暴露召唤型合法动作；该失效点暴露的是实施中批次 D8/D55 审计维度缺口，不是单个派系问题。 |
| 本次修订 | 将补审范围从用户点名对象升级到 `FACTION_CATALOG` 当前 `under_construction` 实施中派系全集：莫古、灰烬、永恒议会；同步回写 `summonerwars-mogu-reentry-audit-2026-07-14.md`，明确它只是莫古子范围旧文档，整批补审以本文件为汇总入口。 |
| 同类扩审 | 根因关键词为“阶段退出真实推进链”和“召唤阶段 AI legal-actions 完整 payload”。搜索范围覆盖莫古、灰烬、永恒议会三个实施中派系对象全集、`PHASE_START_ABILITIES`、`PHASE_END_ABILITIES`、全部阶段触发定义、召唤阶段持续事件、复活死灵、火祀召唤、最终形态。 |
| 命中对象 | 莫古：腐坏、爆裂/菌化变异、狂热菌菇、最终形态；灰烬：召集护卫、野火、凤凰之魂；永恒议会：洞察、探寻、心念侵袭、主管卡图「坚毅」；跨派系同类样本：复活死灵、火祀召唤。 |
| 残余扩审 | 本次没有扩到所有 AI 策略评分，只验证“存在合法动作时不只剩结束阶段”的硬合同；灰烬 / 永恒议会里 `effects: []` 的已实现旁路消费能力已按 D3/D33 登记，未发现新的同类玩法行为 bug，但静态定义与运行时消费分散仍是结构 finding。 |

## 验证证据

| 命令 | 覆盖范围 | 结果 |
| --- | --- | --- |
| `npx vitest run src/games/summonerwars/__tests__/flow.test.ts --testNamePattern "凤凰之魂\|洞察\|探寻\|心念侵袭\|狂热菌菇\|复活死灵\|最终形态\|fire_sacrifice_summon\|腐坏\|爆裂"` | 用户点名链路、莫古召唤阶段事件、灰烬 / 永恒议会召唤阶段持续事件与同类特殊召唤入口定向回归 | 1 file passed；10 passed / 59 skipped |
| `npx vitest run src/games/summonerwars/__tests__/phase-ability-integration.test.ts --testNamePattern "onPhaseEnd\|onPhaseStart\|PHASE_END_ABILITIES\|PHASE_START_ABILITIES\|等价系统消费链"` | 阶段表结构守卫：所有阶段触发技能注册、trigger 类型、所有 `onPhaseEnd` 技能必须登记到阶段退出表；所有 `onPhaseStart` 技能必须登记到阶段进入表或声明等价系统消费链 | 1 file passed；5 passed / 104 skipped |
| `npx vitest run src/games/summonerwars/__tests__/flow.test.ts` | 召唤师战争流程测试完整文件 | 1 file passed；69 passed |
| `npx vitest run src/games/summonerwars/__tests__/phase-ability-integration.test.ts` | 阶段触发技能集成测试完整文件 | 1 file passed；109 passed |
| `npx vitest run src/games/summonerwars/__tests__/abilities-mogu.test.ts src/games/summonerwars/__tests__/abilities-huijin.test.ts src/games/summonerwars/__tests__/abilities-yongheng.test.ts` | 实施中三派系能力领域回归 | 3 files passed；81 passed |
| `npx vitest run src/games/summonerwars/__tests__/flow.test.ts -t "腐坏" --configLoader native` | 2026-07-27 腐坏 `ADVANCE_PHASE` 真实阶段退出：先自伤、停在目标选择、响应后才给目标充能并继续建造阶段 | 1 file passed；1 passed / 68 skipped |
| `npx vitest run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts -t "mogu_decay" --configLoader native` | 2026-07-27 腐坏 legacy `END_PHASE` 旁路：目标选择、跳过不充能、无目标不弹 UI、自伤死亡不充能 | 1 file passed；3 passed / 147 skipped |
| `npx vitest run src/games/summonerwars/__tests__/abilities-mogu.test.ts -t "腐坏\|爆裂\|菌袍" --configLoader native` | 2026-07-27 腐坏 execute 层不再自动给友方充能；自伤死亡负向；爆裂/菌化变异仍可结算 | 1 file passed；10 passed / 20 skipped |
| `npx vitest run src/games/summonerwars/ui/__tests__/systemInteractionAdapter.test.ts -t "腐坏" --configLoader native` | 2026-07-27 腐坏目标选择 UI adapter：派生 `mogu_decay/selectUnit`、路由到棋盘单位点击、按位置消费 option | 1 file passed；1 passed / 4 skipped |
| `$env:PW_E2E_SERVICE_REUSE='isolated'; $env:PW_RUNTIME_SCOPE='mogu-decay-manual-target-20260727b'; npm run test:e2e:file -- e2e/summonerwars/summonerwars-mogu.e2e.ts "resolves Mogu Decay into Burst and Fungal Mutation across real phase endings"` | 2026-07-27 腐坏真实页面链：结束移动阶段后出现腐坏目标选择，点击相邻菌袍疫病体后才获得 2 充能，并继续跨阶段触发爆裂 / 菌化变异 | 1 passed；独立测试环境 |
| `npx eslint src/games/summonerwars/ai.ts src/games/summonerwars/domain/customActionHandlers.ts src/games/summonerwars/domain/flowHooks.ts src/games/summonerwars/__tests__/flow.test.ts src/games/summonerwars/__tests__/phase-ability-integration.test.ts` | 本次相关 TypeScript 文件静态检查 | 0 errors |
| `npx eslint src/games/summonerwars/__tests__/entity-chain-integrity.test.ts src/games/summonerwars/domain/abilities-huijin.ts src/games/summonerwars/domain/abilities-yongheng.ts` | 2026-07-27 D3/D33 守卫与能力文件头口径修正 | 0 errors |
| `npx vitest run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts -t "空 effects"` | 2026-07-27 空 effects 分类守卫定向验证 | 1 file passed；3 passed / 106 skipped |
| `npx vitest run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts` | 2026-07-27 实体链完整性完整文件回归 | 1 file passed；109 passed |
| `npm run audit:evidence:selfcheck -- evidence/summonerwars/summonerwars-phase-ai-supplemental-audit-2026-07-26.md evidence/summonerwars/summonerwars-mogu-reentry-audit-2026-07-14.md` | 审计 evidence 自检：总补审文档与莫古子文档结构、旧结论回写、同类扩审和残余范围 | checked files: 2；audit docs: 2；OK |

## 残余范围

- 腐坏文本里的“你可以指定一个相邻友方单位”为玩家选择语义；2026-07-27 已补为阶段结束 simple-choice 目标选择：先自伤，若玛硕达仍在场且存在相邻友方，玩家可点选相邻友方或跳过；选中后才给目标 2 点充能。当前剩余边界是生产部署未验证、AI 策略评分优劣未重调，不再把腐坏手动选择列为未实现残余。
- 本次已经按 `FACTION_CATALOG` 当前实施中派系全集（莫古、灰烬、永恒议会）应用 D8/D55 补审矩阵；但没有重新跑生产部署，也没有重调所有 AI 策略评分。
- 灰烬 / 永恒议会里旧 intake 已证明多条 `effects: []` 能力其实由运行时旁路消费；本轮没有重构这些实现路径，只把“空 effects 必须分类并登记消费者”升级为 D3/D33 通用审计维度和机器守卫。
- 本次没有覆盖生产部署；只证明当前工作区代码与测试通过。
