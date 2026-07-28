# 召唤师战争新派系实施中批次补审记录（2026-07-28）

- 文档类型：新派系实施状态补审 evidence
- 实施现场：`D:\gongzuo\webgame\BoardGame`，当前分支 `main`
- 结论等级：`仍有残余范围`
- 本轮结论：本轮补齐“所有新派系”的对象全集口径，重点补审 D6 副作用传播、D8 阶段时序、D5 交互完整、D55 多消费者一致性；同时回写灰烬旧 evidence 中被玩家反馈推翻的野火、灼烧旧 `passed` 结论。本文不声称四派全量重新收口，也不代表生产部署已经覆盖。

## 前提锁定

| 项 | 当前锁定 |
| --- | --- |
| 问题对象 | 召唤师战争当前新派系全集：莫古（`mogu`）、灰烬（`huijin`）、冰苔兽人（`shouren`）、永恒议会（`yongheng`） |
| 真相来源 | 派系配置 `src/games/summonerwars/config/factions/index.ts`、派系类型 `src/games/summonerwars/domain/types.ts`、已有派系 intake/full-audit evidence、当前实现入口和本轮定向测试 |
| 目标入口 | 当前仓库当前代码；阶段推进入口为 `FLOW_COMMANDS.ADVANCE_PHASE`，事件打牌入口为 `PLAY_EVENT` / `REQUEST_EVENT_INTERACTION`，系统交互入口为 `sys.interaction` |
| 验收口径 | 先列全四派对象矩阵；对高风险对象写出规则子句、实现入口、命中 D 维度、L0-L4 证据层级和残余；旧 evidence 被推翻时原地回写失效 |

## 范围裁定

| 来源 | 命中事实 | 裁定 |
| --- | --- | --- |
| `FACTION_CATALOG` | 当前 `statusTag: 'under_construction'` 为莫古、灰烬、永恒议会 | 这是“实施中”标签来源 |
| `FACTION_IDS` / `FactionId` / `createDeckByFactionId` | 冰苔兽人同样已进入派系 ID、中文名解析和牌组工厂 | 用户说“实施中也就是所有新派系”时，不能只按 `statusTag` 排除冰苔兽人 |
| 旧三派补审 `summonerwars-phase-ai-supplemental-audit-2026-07-26.md` | 只覆盖莫古、灰烬、永恒议会 | 该文档不能继续解释为“四个新派系全集补审” |
| 冰苔兽人 full audit `summonerwars-shouren-full-audit-2026-07-18.md` | 单派对象级收口，不外推到其它派系 | 本文只把它纳入四派总口径，不重写其单派完成结论 |

## 覆盖门禁表（非收口）

| 门禁项 | 状态 | 说明 |
| --- | --- | --- |
| 四派对象全集 | passed | 依据当前牌组工厂抽取并按基础对象去重 |
| 规则子句 / 实现入口 | passed | 每个对象至少登记主要规则语义、实现入口与当前 evidence 来源 |
| D6/D8/D5/D55 高风险维度 | passed | 野火、灼烧、冻结、莫古阶段链、永恒议会持续事件均写入矩阵 |
| L0-L4 证据层级 | scoped_debt | 本轮补的是全集补审口径，不重跑四派全部 L3/E2E 截图 |
| 旧 evidence 失效回写 | passed | 已在灰烬 2026-07-16 intake 原地回写野火、灼烧旧 `passed` 失效 |
| 测试语义对账 | representative_only | 本轮跑定向/代表性回归；没有跑四派全部测试与 E2E |
| 残余范围声明 | passed | 本文明确保留残余，不使用完成类收口口径 |
| evidence 自检 | scoped_debt | 因本文结论为“仍有残余范围”，本轮不运行 `audit:evidence:selfcheck` 申请收口资格 |

## 对象全集矩阵

### 莫古

| 对象 | 规则子句 / 本轮关注点 | 实现入口 / 证据 | D 维度 | L 层级 | 当前裁定 |
| --- | --- | --- | --- | --- | --- |
| 库鞭克 | 血腥绽放：单位死亡后给 2 格内友方充能 | `execute.ts` 死亡后处理；`abilities-mogu.test.ts` | D6/D8 | L2/L4 | 已纳入；本轮未重跑全链 E2E |
| 起始城门 | 起始结构，10 生命，不进入牌库 | `config/factions/mogu.ts`、旧莫古 evidence | D3/D52 | L1/L3 | 沿用旧证据 |
| 枯萎法师 | 鲜血灌注：2 格内友方充能并受伤，每回合一次 | `ACTIVATE_ABILITY`、`abilities-mogu.test.ts` | D5/D7/D8 | L2/L3 | 沿用旧证据 |
| 菌袍疫病体 | 爆裂/菌化变异：魔力阶段结束消灭并可替换 | `PHASE_END_ABILITIES.magic`、`postProcessDeathChecks` | D6/D8 | L2/L4 | 代表性阶段链已覆盖 |
| 托恩 | 死亡充能、力量强化、回合末衰减 | `abilities-mogu.ts`、`abilities-mogu.test.ts` | D6/D8/D14 | L2/L4 | 沿用旧证据 |
| 畸形巨怪 | 最终形态：牺牲 5+ 充能菌化野兽替换召唤 | `buildSummonActions`、`SUMMON_UNIT` payload | D55/D18 | L2 | 沿用 2026-07-26 补审 |
| 玛硕达 | 腐坏：移动阶段结束自伤，仍在场才选择相邻友方充能 | `PHASE_END_ABILITIES.move`、`systems.ts`、`systemInteractionAdapter.ts` | D5/D6/D8/D55 | L2/L4 | 代表性高风险链已覆盖 |
| 鲜血萨满 | 传输：移动后转移充能，多步交互 | `systems.ts`、`executors/mogu.ts` | D5/D18/D55 | L2/L3 | 沿用旧证据 |
| 菌化野兽 | 感染/寄生：死亡替换、攻击阶段结束选择 | `PHASE_END_ABILITIES.attack`、`abilities-mogu.test.ts` | D6/D8/D55 | L2/L4 | 沿用旧证据 |
| 命令 | 事件目标链：额外攻击完成后消灭 | `INTERACTIVE_EVENT_BASE_IDS`、`systems.ts`、`eventCards.ts` | D5/D8/D55 | L2/L3 | 本轮代表性命令组回归通过 |
| 共生自愈 | 多目标治疗与充能，可空选 | `systems.ts`、`validate.ts`、`eventCards.ts` | D5/D18/D55 | L2/L3 | 本轮代表性命令组回归通过 |
| 狂热菌菇 | 召唤阶段持续事件，移动后推拉/不推拉 | `buildEventCardActions`、`systems.ts` | D5/D6/D55 | L2/L3 | 本轮代表性莫古回归通过 |
| 释放菌袍 | 从弃牌堆取至多两张疫病体放到召唤师相邻 | `INTERACTIVE_EVENT_BASE_IDS`、`systems.ts`、`eventCards.ts` | D5/D18/D55 | L2/L3 | 本轮代表性命令组回归通过 |
| 传送门 | 标准城门 5 生命，三张入牌库 | `config/factions/mogu.ts`、标准城门链 | D3/D52 | L1/L3 | 沿用旧证据 |

### 灰烬

| 对象 | 规则子句 / 本轮关注点 | 实现入口 / 证据 | D 维度 | L 层级 | 当前裁定 |
| --- | --- | --- | --- | --- | --- |
| 玛达莉雅女王 | 威势、召集护卫；召集护卫是攻击阶段结束交互 | `PHASE_END_ABILITIES.attack`、`systems.ts` | D5/D8/D55 | L2/L4 | 沿用旧证据；非本轮反馈点 |
| 起始城门 | 起始结构，10 生命 | `config/factions/huijin.ts` | D3/D52 | L1/L3 | 沿用旧证据 |
| 灰烬弓箭手 | 快速射击：移动后直线视野目标伤害 | `systems.ts`、`executors/huijin.ts` | D5/D8/D55 | L2/L3 | 沿用旧证据 |
| 皇家守卫 | 缠门、冲撞：离开相邻伤害与攻击后二段推拉 | `abilities-huijin.ts`、`systems.ts` | D5/D6/D8 | L2/L3 | 沿用旧证据 |
| 赫丽丝 | 怒焰召唤、点燃 | `helpers.ts`、`abilityResolver.ts` | D3/D33/D55 | L2 | 空 effects 旁路消费已登记 |
| 火焰龙兽 | 护主、火焰喷吐 | `helpers.ts`、`execute.ts` | D3/D6/D8/D33 | L2 | 空 effects 旁路消费已登记 |
| 风妮莎 | 还击：被相邻敌方攻击后仍在场则反伤 | `execute.ts` 攻击后处理 | D6/D8 | L2 | 沿用旧证据 |
| 灰烬法师 | 庇护：本回合首次被攻击最多 1 伤 | `execute.ts` 攻击伤害限制 | D8/D14 | L2 | 沿用旧证据 |
| 灰烬野兽 | 烈火降生；野火：移动阶段开始对相邻敌方 1 伤并要触发死亡离场 | `PHASE_START_ABILITIES.move`、`pipeline.ts` preCommand 后处理、`postProcessDeathChecks` | D6/D8 | L2/L4 | 2026-07-16 旧 `passed` 已失效；本轮以 `flow.test.ts` 野火定向回归替代旧 claim |
| 炫目光芒 | 持续事件，攻击伤害按特殊标记替换 | `eventCards.ts`、`execute.ts` | D8/D22/D55 | L2/L3 | 沿用旧证据 |
| 灼烧 | 召唤师 2 格内任意阵营士兵/英雄，造成 2 伤；必须打出后进入目标选择，且友方士兵可选 | `getHuijinScorchTargets`、`systems.ts`、`validate.ts`、`useEventCardModes.ts`、`eventCards.ts` | D5/D8/D55 | L2/L3 | 2026-07-16 旧 `passed` 已失效；本轮定向 UI/交互回归通过 |
| 神族复仇 | 持续事件，召唤师被攻击后反伤 | `eventCards.ts`、`execute.ts` | D6/D8 | L2/L3 | 沿用旧证据 |
| 凤凰之魂 | 持续事件，友方技能非攻击伤害增幅 | `eventCards.ts`、`execute/helpers.ts` | D6/D8/D55 | L2/L4 | 沿用 2026-07-26/27 补审 |
| 传送门 | 标准城门 5 生命，三张入牌库 | `config/factions/huijin.ts` | D3/D52 | L1/L3 | 沿用旧证据 |

### 冰苔兽人

| 对象 | 规则子句 / 本轮关注点 | 实现入口 / 证据 | D 维度 | L 层级 | 当前裁定 |
| --- | --- | --- | --- | --- | --- |
| 格鲁纳克 | 恢复、激励；激励保留/重掷后再结算 | `execute.ts`、`systems.ts`、冰苔 full audit | D5/D8/D55 | L2/L3/L4 | 单派 full audit 保留；本轮能力全文件回归通过 |
| 起始城门 | 起始结构坐标 | `config/factions/shouren.ts`、冰苔 full audit | D3/D52 | L1/L3 | 沿用旧证据 |
| 冰苔斗士 | 狂暴：攻击后掷技能骰，可位移并得额外攻击 | `execute.ts`、`systems.ts` | D5/D8/D56 | L2/L3/L4 | 本轮能力全文件回归通过 |
| 冰霜萨满 | 北方魔法：攻击时 0 特殊标记则 0 伤害 | `execute.ts` | D8/D22 | L2 | 本轮能力全文件回归通过 |
| 拉格诺 | 鲜血羁绊：攻击后召唤师充能 | `execute.ts` 攻击后处理 | D6/D8 | L2 | 本轮能力全文件回归通过 |
| 塔甘 | 远射、刺骨冰霜 | `helpers.ts`、`abilityResolver.ts` | D4/D23/D33 | L2 | 本轮能力全文件回归通过 |
| 雄科 | 狂乱打击：特殊标记替代近战命中 | `execute.ts` | D8/D22/D54 | L2 | 本轮能力全文件回归通过 |
| 粉碎者 | 迟钝：被攻击时额外受特殊标记伤害 | `execute.ts` | D6/D22 | L2 | 本轮能力全文件回归通过 |
| 冰苔冲锋者 | 血腥急袭：召唤后可自伤并位移 | `systems.ts`、`executors/shouren.ts` | D5/D6/D8/D55 | L2/L3/L4 | 本轮能力全文件回归通过 |
| 冻结 | 召唤师 3 格内任意阵营未充能士兵/英雄；附着后禁止技能、移动、攻击、被攻击、推拉 | `getValidShourenFreezeTargets`、`validate.ts`、`useEventCardModes.ts` | D5/D31/D55/D57 | L2/L3/L4 | 本轮 UI 路由和能力全文件回归通过 |
| 粗暴蛮力 | 持续授予蛮力冲击，造成伤害后可推拉 | `abilityResolver.ts`、`systems.ts` | D5/D8/D55 | L2/L3/L4 | 本轮能力全文件回归通过 |
| 原始狂怒 | 召唤师攻击后可移动并获得额外攻击 | `systems.ts`、`execute.ts` | D5/D8/D56 | L2/L3/L4 | 本轮能力全文件回归通过 |
| 无上荣耀 | 持续授予鲁莽打击，士兵战力 +2 且按特殊标记自伤 | `abilityResolver.ts`、`execute.ts` | D6/D8/D22 | L2/L4 | 本轮能力全文件回归通过 |
| 传送门 | 标准城门 5 生命，三张入牌库 | `config/factions/shouren.ts` | D3/D52 | L1/L3 | 沿用 full audit |

### 永恒议会

| 对象 | 规则子句 / 本轮关注点 | 实现入口 / 证据 | D 维度 | L 层级 | 当前裁定 |
| --- | --- | --- | --- | --- | --- |
| 大议长艾迪雅 | 延续与议会核心能力 | `yonghengMechanics.ts`、旧 intake evidence | D3/D8/D55 | L2/L4 | 旁路消费保留；本轮代表回归通过 |
| 起始城门 | 起始结构，10 生命 | `config/factions/yongheng.ts` | D3/D52 | L1/L3 | 沿用旧证据 |
| 城塞参谋 | 永恒议会单位能力 | `abilities-yongheng.ts`、旧 intake evidence | D3/D8 | L2 | 沿用旧证据 |
| 心灵骑士 | 永恒议会单位能力 | `abilities-yongheng.ts`、旧 intake evidence | D3/D8 | L2 | 沿用旧证据 |
| 主管玛鲁娜 | 惩戒：对方召唤后强制弃牌交互 | `getYonghengPostProcessEvents`、`systems.ts` | D5/D8/D55 | L2/L4 | 旁路消费保留；本轮代表回归通过 |
| 主管奥维 | 谋划：战力修正 | `abilityResolver.ts` | D3/D33 | L2 | 旁路消费保留；本轮代表回归通过 |
| 主管卡图 | 坚毅：回合结束/空牌库充能与力量强化 | `flowHooks.ts`、`abilityResolver.ts` | D8/D14 | L2 | 沿用 2026-07-26 补审 |
| 远古学者 | 永恒议会单位能力 | `abilities-yongheng.ts`、旧 intake evidence | D3/D8 | L2 | 沿用旧证据 |
| 玄谜贤者 | 永恒议会单位能力 | `abilities-yongheng.ts`、旧 intake evidence | D3/D8 | L2 | 沿用旧证据 |
| 学习 | 召唤阶段事件/知识链 | `eventCards.ts`、`yonghengMechanics.ts` | D5/D8/D55 | L2/L3 | 本轮代表回归通过 |
| 洞察 | 召唤阶段持续事件，AI/手牌入口不能被空牌库跳过 | `buildEventCardActions`、`eventCards.ts` | D55 | L2/L3 | 本轮代表回归通过 |
| 探寻 | 持续事件，阶段开始确认/跳过抓牌 | `systems.ts` `PHASE_CHANGED` 消费链、`yonghengMechanics.ts` | D5/D8/D55 | L2/L4 | 本轮代表回归通过 |
| 心念侵袭 | 抓牌后可选 2 格内敌方士兵/英雄造成 1 伤害，可跳过 | `getYonghengPostProcessEvents`、`systems.ts` | D5/D8/D55 | L2/L4 | 本轮代表回归通过 |
| 传送门 | 标准城门 5 生命，三张入牌库 | `config/factions/yongheng.ts` | D3/D52 | L1/L3 | 沿用旧证据 |

## 高风险消费点矩阵

| 维度 | 现实风险 | 命中对象 | 当前证据 | 裁定 |
| --- | --- | --- | --- | --- |
| D6 副作用传播 | 被动/事件造成伤害后，生命到 0 的单位必须继续死亡后处理并离场 | 灰烬野兽「野火」、菌袍疫病体「爆裂」、冰苔自伤/目标受伤、永恒议会心念侵袭 | `pipeline.ts` 对系统 preCommand 事件执行 `postProcessSystemEvents`；`postProcessDeathChecks` 从 `UNIT_DAMAGED` 注入 `UNIT_DESTROYED`；本轮野火测试通过 | 灰烬旧野火结论失效后已由新链路替代 |
| D8 时序正确 | 阶段开始/阶段结束技能不能只在 resolver 单测中可用，必须接真实阶段推进 | 灰烬野火、莫古腐坏/爆裂、永恒议会探寻、主管卡图 | `PHASE_START_ABILITIES`、`PHASE_END_ABILITIES`、`ADVANCE_PHASE` 回归 | 代表性时序补审通过，非四派全量 E2E |
| D5 交互完整 | 打出卡牌后应进入目标选择，目标集合与规则一致 | 灼烧、冻结、命令、共生自愈、释放菌袍、探寻、心念侵袭 | `systems.ts`、`validate.ts`、`useEventCardModes.ts` 共享交互名单；本轮 UI 路由测试通过 | 灼烧旧 UI 复用口径失效，已补成同源 helper 证据 |
| D55 多消费者一致性 | UI、validator、系统候选、AI legal-actions 只修一层会出现“能打但选不了/AI 跳过” | 灼烧、冻结、莫古召唤阶段事件、永恒议会持续事件 | `getHuijinScorchTargets` / `getValidShourenFreezeTargets` 被 UI 与 validate 同源消费；entity-chain 空 effects 守卫通过 | 代表性消费者矩阵通过，AI 策略评分未重调 |

## 灰烬玩家反馈回写

| 用户反馈 | 保真症状 | 旧 evidence 为什么失效 | 当前替代证据 |
| --- | --- | --- | --- |
| 灰烬野兽「野火」 | 移动阶段开始的被动把单位打到 0 血时，单位没有消失 | 2026-07-16 intake 只写阶段触发和技能伤害后处理 `passed`，没有单独证明真实 `ADVANCE_PHASE` 的阶段开始系统事件会先进入死亡后处理再写回棋盘 | `pipeline.ts` 对 preCommand 事件执行领域后处理；`postProcessDeathChecks` 注入 `UNIT_DESTROYED`；本轮 `flow.test.ts -t "野火"` 1 passed |
| 灼烧 | 灼烧打出来选不了目标；按规则应能选择自己士兵/英雄 | 2026-07-16 intake 把“复用事件牌目标选择 UI”写成 `passed`，但没有证明手牌打出会进入系统目标选择，也没有证明目标集合包含任意阵营士兵/英雄 | `getHuijinScorchTargets` 遍历双方单位；`systems.ts`、`validate.ts`、`useEventCardModes.ts` 同源；本轮 `interaction-chain-comprehensive.test.ts -t "huijin_scorch|灼烧"` 和 UI 路由测试通过 |

## 本轮验证记录

| 命令 | 覆盖范围 | 结果 |
| --- | --- | --- |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/flow.test.ts -t "野火" --configLoader native` | 灰烬野兽「野火」真实 `ADVANCE_PHASE` 阶段开始伤害、死亡离场 | 1 file passed；1 passed / 69 skipped |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts -t "huijin_scorch|灼烧" --configLoader native` | 灼烧目标集合包含友方士兵与敌方英雄，排除超距对象 | 1 file passed；1 passed / 150 skipped |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/ui/__tests__/useEventCardModes.test.ts --configLoader native` | 冻结、灼烧从手牌进入系统目标选择，而不是无目标直接打出 | 1 file passed；2 passed |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-shouren.test.ts --configLoader native` | 冰苔兽人对象级能力回归 | 1 file passed；35 passed |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-mogu.test.ts -t "狂热菌菇|腐坏|爆裂|菌袍|命令|共生|释放菌袍" --configLoader native` | 莫古阶段/事件/交互代表链 | 1 file passed；17 passed / 13 skipped |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/abilities-yongheng.test.ts -t "探寻|心念侵袭|学习|洞察|惩戒|谋划" --configLoader native` | 永恒议会持续事件与旁路消费代表链 | 1 file passed；10 passed / 16 skipped |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/entity-chain-integrity.test.ts -t "空 effects|under_construction|实施中" --configLoader native` | 实施中派系空 effects 旁路消费分类守卫 | 1 file passed；3 passed / 106 skipped |

## 残余范围

- 本轮没有重跑四派全部领域测试、全部真实入口 E2E、截图核验或生产部署回查；因此不能写四派全量完成类结论。
- 旧三派补审只覆盖 `statusTag: under_construction` 的莫古、灰烬、永恒议会；冰苔兽人由单派 full audit 纳入本轮总口径，但不反向证明三派无残余。
- 灰烬 2026-07-16 intake 原有完成类口径已被玩家反馈推翻；后续引用灰烬野火、灼烧时必须优先引用本文和 2026-07-28 回归，而不是旧 `passed` 行。
- 如后续要把本文升级为完成类收口口径，必须补齐四派对象全量测试语义对账、真实入口/E2E 证据、旧 evidence 对账，并运行 `npm run audit:evidence:selfcheck -- evidence/summonerwars/summonerwars-new-factions-implementation-reaudit-2026-07-28.md`。
