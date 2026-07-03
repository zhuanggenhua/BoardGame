# 召唤师战争 B5 P2 实现对照首轮矩阵（2026-07-02）

## 目的

- 承接 `b5-p2-rule-text-lock-matrix-2026-07-02.md` 的 18 个 `locked-规则原文已锁` 对象和 1 个 `disputed` 对象。
- 本文件只做“官方合同子句 → 当前实现入口 → 现有证据/缺口”的首轮分流。
- 本轮继续消费已锁合同，不回图片/OCR，不重新做数据录入；若实现对照发现合同缺字段、来源冲突或对象归属不清，再把对应对象退回合同层处理。

## 续接门禁

- `ferocity` 当前是 `disputed-对象归属待裁定`，不得进入机制修复或规则断言测试。
- 只有“官方合同子句”和“当前实现链路”直接冲突时，才补最小失败测试和最小修复。
- 对只缺证据的对象，先补最小验证；对已有足够测试覆盖的对象，先登记 `match-with-proof`。

## 首轮分流矩阵

| 对象 | 中文承载卡 | 官方合同要点 | 当前实现入口 | 现有测试/证据 | 首轮分流 | 后续动作 |
| --- | --- | --- | --- | --- | --- | --- |
| `aerial_strike` | 葛拉克 | 2 格内开始移动的友方士兵，该次移动获得 Flight | `helpers.ts` 的移动增强扫描 2 格内 `aerial_strike` 单位；移动消费者使用增强后的穿越能力 | `abilities-trickster.test.ts`、`entity-chain-integrity.test.ts` 已覆盖 2 格内友方普通士兵获得飞行、超出 2 格不生效；本轮新增 L4 断言，确认不影响敌方士兵，并在真实 `MOVE_UNIT` 入口按开始移动位置授予本次移动穿越能力 | `match-with-L4-proof` | 已完成 L4：友方士兵归属、开始移动位置和本次移动穿越入口均已补证；未改机制实现 |
| `charge` | 野兽骑手 | 只沿一个方向移动时最多额外 2 格；若移动 3 格或更多且直线，本回合 +1 战力 | `helpers.ts` 处理直线移动上限；`execute.ts`/移动链对 3+ 格直线写入 `UNIT_CHARGE_BONUS_GAINED`；`abilityResolver.ts` 只读取 `chargeBonusThisTurn` 计入战力；`reduce.ts` 在回合切换清除该临时字段 | 新增失败测试先证明回合切换后仍按 4 战力计算；修复后 `abilities-goblin.test.ts -t "冲锋|charge"` 通过，确认冲锋不写真实充能、回合结束不残留；`strength-breakdown.property.test.ts` 用审计配置通过，确认战力拆解不再把真实充能当作冲锋来源 | `fixed-with-proof` | 本轮已修复“本回合 +1 战力”生命周期；后续仍可补非直线路径获得加成的更窄负向断言 |
| `divine_shield` | 科琳·布莱顿 | 3 格内友方城塞成为敌方攻击目标时掷 2 骰；每个特殊使攻击者本次攻击 -1，最低 1 | `execute.ts` 攻击结算中扫描 3 格内 `divine_shield`，按骰面生成本次攻击减伤 | `abilities-paladin-new.test.ts`、`divine-shield.test.ts` 已覆盖触发、无特殊不减、多个特殊减伤、最低战力边界等；本轮新增真实声明攻击入口 L4 断言，确认只保护科琳友方城塞目标，且减攻只作用本次攻击、不残留到下一次攻击 | `match-with-L4-proof` | 已完成 L4：真实声明攻击入口覆盖友方城塞归属边界和本次攻击临时减攻边界；未改机制实现 |
| `fortress_elite` | 瓦伦蒂娜·斯托哈特 | 2 格内每个友方城塞单位 +1 战力 | `abilityResolver.ts` 在战力计算时扫描 2 格内友方城塞单位并加入 `fortress_elite` 修正 | `abilities-paladin.test.ts`、`entity-chain-integrity.test.ts`、`strength-boost-display.test.ts` 已覆盖 2 格内加成与展示来源；本轮新增敌方城塞、超距城塞、非城塞友方均不计入的 L4 边界断言 | `match-with-L4-proof` | 已完成静态数值读取代表链负向边界补证；未改机制实现 |
| `frost_bolt` | 冰霜法师 | 每个相邻友方建筑 +1 战力 | `abilityResolver.ts` 扫描四邻友方建筑并加入 `frost_bolt` 修正 | `abilities-frost.test.ts`、`entity-chain-integrity.test.ts` 已覆盖相邻友方建筑加成、无相邻建筑不加成；本轮新增只统计相邻友方建筑、敌方建筑和非相邻建筑不计入的 L4 边界断言 | `match-with-L4-proof` | 已完成静态数值读取代表链负向边界补证；未改机制实现 |
| `greater_frost_bolt` | 纳蒂亚娜 | 2 格内每个友方建筑 +1 战力 | `abilityResolver.ts` 扫描 2 格内友方建筑并加入 `greater_frost_bolt` 修正 | `abilities-frost.test.ts`、`entity-chain-integrity.test.ts` 已覆盖 2 格内友方建筑加成；本轮新增只统计 2 格内友方建筑、敌方建筑和超 2 格友方建筑不计入的 L4 边界断言 | `match-with-L4-proof` | 已完成静态数值读取代表链负向边界补证；未改机制实现 |
| `guardian` | 城塞骑士 | 相邻敌方攻击时，攻击目标必须是有 Protect 的单位 | `validate.ts` 在攻击声明验证中检查相邻 `guardian` 单位并强制目标落到守卫单位 | `abilities-paladin.test.ts`、`boundaryEdgeCases.test.ts` 已覆盖守卫目标限制；本轮新增多守卫边界补证，确认多个相邻守卫均可被攻击，非守卫目标仍被拒绝 | `match-with-proof` | 本轮已补多守卫可选集合与非守卫目标拒绝证据；后续如需扩大，再补无合法守卫可攻击时的攻击门禁 |
| `guidance` | 瓦伦蒂娜·斯托哈特 | 你的召唤阶段开始时强制抽 2 张牌 | `flowHooks.ts` 在 summon 阶段开始触发 `guidance`；`executors/paladin.ts` 生成抽牌事件 | `abilities-paladin-execute.test.ts` 覆盖直接执行与牌库为空边界；`interaction-chain-comprehensive.test.ts` 已补真实阶段入口，确认从对手抽牌阶段进入己方召唤阶段时自动抽 2 张；本轮新增牌库不足真实入口断言，确认只抽实际剩余牌数且不越界 | `match-with-L4-proof` | 已完成 L4：召唤阶段真实入口、正常抽 2、牌库不足只抽实际剩余牌数均已补证；未改机制实现 |
| `ice_ram` | 寒冰冲撞 | 移动或强制移动友方建筑后，可选相邻士兵/英雄加 1 伤害并可 Force 1 格 | `execute.ts` 在结构移动后发 `ice_ram_trigger`；`systems.ts` 建目标选择和推拉二段交互；`abilityValidation.ts`/`executors/frost.ts` 统一只允许士兵/英雄目标并排除召唤师；`executors/frost.ts` 结算 1 伤害和可选推拉 | 新增真实移动友方活体结构触发测试先证明召唤师被列入目标；修复后 `interaction-chain-comprehensive.test.ts -t "ice_ram|寒冰冲撞"` 通过，确认目标选择和执行器均排除召唤师，既有两步推拉/skip 回归仍通过 | `fixed-with-proof` | 本轮已修复目标类型过滤；后续如需扩大，再补建筑目标排除、稳定目标只受伤不被推拉等更窄边界 |
| `ice_shards` | 贾穆德 | 建造阶段结束时可花 1 充能；每个与己方建筑相邻的敌方单位受 1 伤，多建筑相邻不重复 | `flowHooks.ts` 在 build 阶段结束确认并 halt 阶段推进；`systems.ts` 建确认/跳过交互并在响应后按来源单位登记阶段结束能力已处理；`executors/frost.ts` 消耗 1 充能并用单位集合去重伤害目标 | `abilities-frost.test.ts`、`interaction-flow-e2e.test.ts` 已覆盖直接激活、无充能/无目标拒绝、目标伤害；`interaction-chain-comprehensive.test.ts` 已覆盖 build 退出确认/跳过路径、多建筑相邻去重伤害、多贾穆德同阶段结束时逐个收口、第二个交互未处理前提前推进被拒绝且不重放能力、全部收口后推进到 attack 阶段；目标测试 `ice_shards\|冰片\|寒冰碎屑` 通过，3 passed / 115 skipped | `match-with-L4-proof` | 已完成 L4：单来源确认/跳过、多来源顺序、阶段收口和提前推进门禁均已补证；未改机制实现 |
| `immobile` | 部落抓附手 | 本单位不能移动 | `helpers.ts`/移动目标计算检查 `immobile` 并返回空移动目标 | `abilities-goblin.test.ts` 已覆盖有/无 immobile helper 和普通移动禁用 | `match-with-proof` | 后续如需裁定“被强制移动/放置”是否受限，必须引用通用规则合同，当前不扩大解释 |
| `magic_addiction` | 史米革 | 回合结束时强制二选一：花 1 魔力或弃置本单位；无魔力必须弃置 | `abilities-goblin.ts` 定义 `onTurnEnd`；`customActionHandlers.ts` 注册 `magic_addiction_check`，回合结束真实入口直接扣 1 魔力或弃置本单位；`flowHooks.ts` 对回合结束自动技能按单位顺序应用事件后的临时状态继续触发，避免多个来源共享同一份魔力快照；直接执行器保留同语义 | 入口修复已覆盖有魔力自动花 1、无魔力自动弃置；本轮新增多个史米革同回合结束、玩家只有 1 点魔力时的 L4 失败测试，先证明两个史米革会各自读取旧魔力快照，修复后确认只扣 1 次魔力，另 1 个史米革按合同弃置；`interaction-chain-comprehensive.test.ts` 与 `abilities-goblin.test.ts` 目标测试均通过 | `fixed-with-L4-proof` | 已完成 L4：真实回合结束入口、无魔力强制弃置、多来源顺序消费、相邻阶段自动能力回归均已补证；后续只在发现 UI eventStream 回放重复触发时追加 UI 层专项 |
| `mind_capture` | 泰珂露 | 攻击敌方单位且本次伤害足以摧毁目标时，可忽略伤害并获得控制权 | `execute.ts` 在攻击伤害足以摧毁目标时生成 `mind_capture` 选择；`systems.ts` 转为控制/伤害二选一 | `abilities-trickster.test.ts` 已覆盖致死攻击生成请求、非致死攻击正常伤害；真实交互桥接补证已覆盖请求阶段不立即伤害、选择控制后目标不受伤且控制权转移；本轮新增伤害路径 L4 断言，确认选择 damage 后目标被伤害并摧毁、控制权不转移、攻击后能力在决策后触发、重复响应不二次伤害/摧毁 | `match-with-L4-proof` | 已完成 L4：控制/伤害二选一两条真实入口均已覆盖，重复响应不二次结算；未改机制实现 |
| `mind_capture_resolve` | 泰珂露 | 心灵捕获的内部确认分支，只承接控制或保留伤害选择 | `abilityValidation.ts` 允许持有 `mind_capture` 的单位激活内部分支；`executors/trickster.ts` 执行控制或伤害；`execute/abilities.ts` 决策后再触发 afterAttack | `abilities-trickster-execute.test.ts` 已覆盖控制/伤害/非法 choice/持有能力验证；真实交互桥接补证已确认 `systems.ts` 响应 control 后只执行一次控制结算、不造成重复伤害，并在决策后才触发攻击后能力；本轮新增 damage 响应桥接断言，确认伤害和摧毁只执行一次，旧交互重复响应被拒绝 | `match-with-L4-proof` | 已完成 L4：内部确认分支 control/damage 均有真实入口与重复响应证据；未改机制实现 |
| `radiant_shot` | 雅各布·艾德温 | 每 2 点魔力 +1 战力，向下取整 | `abilityResolver.ts` 用当前魔力 `Math.floor(magic / 2)` 加入 `radiant_shot` 修正 | `abilities-paladin.test.ts`、`strength-breakdown.property.test.ts` 已覆盖魔力折算与来源；本轮新增当前魔力 5 只 +2、当前魔力 1 不加成的 L4 取整断言 | `match-with-L4-proof` | 已完成静态数值读取代表链奇数魔力向下取整补证；未改机制实现 |
| `ranged` | 清风弓箭手 | 最多 4 个清晰直线格攻击卡牌 | `helpers.ts` 的 `getEffectiveAttackRange` 对 `ranged` 返回 4；`canAttackEnhanced` 允许敌方单位或建筑目标，并要求直线、距离不超过 4、路径无遮挡；`validate.ts` 的 `DECLARE_ATTACK` 真实声明攻击入口复用 `canAttackEnhanced` | `abilities-trickster.test.ts` 已覆盖 4 格单位目标、超过 4 格拒绝、攻击范围 helper、4 格清晰直线敌方建筑 helper 可攻击、路径中间有卡牌阻挡 helper 拒绝、4 格内非直线 helper 拒绝；本轮新增真实声明攻击命令 L4 断言，确认 4 格清晰直线敌方建筑可攻击、路径中间卡牌阻挡拒绝、4 格内非直线拒绝 | `match-with-L4-proof` | 已完成 L4：真实声明攻击命令入口覆盖建筑目标、路径阻挡和非直线拒绝；未改机制实现；后续只在 UI 攻击目标高亮或 eventStream 回放出现分叉时追加专项 |
| `speed_up` | 犀牛 | 每个充能可额外移动 1 格，最多 +5；可选 | `helpers.ts` 移动增强按 `speed_up` 和充能数计算，最大 +5 | `abilities-barbaric.test.ts` 已覆盖无充能、充能额外移动、上限相关用例；本轮新增 8 充能时 7 格可移动但 8 格不可移动的负向断言，确认超过 5 充能仍最多只提供 +5 移动 | `match-with-L4-proof` | 已完成速度强化上限负向边界补证；未改机制实现 |
| `stable` | 卡拉 | 本单位不能被 Force | `helpers.ts`/`abilityResolver.ts`/`executors/trickster.ts`/事件卡执行器在推拉前检查 `stable` | `abilities-trickster.test.ts`、`abilities-trickster-execute.test.ts` 已覆盖稳定单位不被推拉；本轮新增代表链补证：卡拉「高阶念力」不能推动稳固目标，寒冰冲撞对稳固目标仍造成 1 点伤害但不强制移动；定向测试 `稳固|stable|高阶念力|寒冰冲撞|ice_ram|high_telekinesis` 通过，2 个测试文件、6 passed / 65 skipped | `match-with-representative-proof` | 已补念力链与寒冰冲撞两个 Force 消费者代表链；后续若扩大，只补普通移动不受影响、更多 Force 消费者抽样或 UI 回放不重复展示 |
| `ferocity` | 史米革 / 部落投石手 | 官方 Relentless 只锁到史米革；部落投石手归属未裁定 | 本地 `abilities-goblin.ts` 同一 `ferocity` 可能挂到多个对象；`validate.ts` 允许额外攻击 | 由于对象归属冲突，现有测试不能作为官方合同证明 | `disputed-skip` | 先裁定部落投石手是否承载该能力；未裁定前不写规则断言测试、不修机制 |

## 当前结论

- B5 已按 `locked` 合同进入实现对照，没有回到图片/OCR。
- 当前分流结果：2 个 `match-with-proof`、1 个 `match-with-representative-proof`、12 个 `match-with-L4-proof`、2 个 `fixed-with-proof`、1 个 `fixed-with-L4-proof`、0 个 `proof-needed`、1 个 `disputed-skip`。
- `match-with-L4-proof`：`aerial_strike`、`divine_shield`、`fortress_elite`、`frost_bolt`、`greater_frost_bolt`、`guidance`、`ice_shards`、`mind_capture`、`mind_capture_resolve`、`radiant_shot`、`ranged`、`speed_up`。
- `match-with-proof`：`guardian`、`immobile`。
- `match-with-representative-proof`：`stable`。
- `fixed-with-proof`：`charge`、`ice_ram`。
- `fixed-with-L4-proof`：`magic_addiction`。
- `proof-needed`：无。
- `ferocity` 继续保持 disputed，不进入实现修复流。
- B5 的 18 个 `locked` 对象首轮实现对照已清空 `proof-needed`；`ferocity` 继续保持 disputed，不写规则断言测试、不做机制修复。
