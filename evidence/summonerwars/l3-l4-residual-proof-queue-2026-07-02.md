# 召唤师战争 L3/L4 残余补证队列（2026-07-02）

> 当前状态（2026-07-03 / C86）：本文件已从“待执行残余队列”转为“已完成残余补证索引 + 条件性专项入口”。C85 已纠正 C80/C84 的来源越权口径；C86 进一步纠正“审计要回卡图/回录入层”的误读。普通续跑不得再按本文件旧的“下一步”字样寻找常规残余任务，也不得为 `ferocity` / `entangle` 自动启动卡图、OCR、Wiki、网页文本或在线文本包复核；这两个对象只是不允许继续宣称已证实修复，若要裁定归属，必须单独进入数据录入/对象归属复核任务。

> 2026-07-17 更新：贾穆德「寒冰碎屑」（`ice_shards`）旧的“建造阶段结束确认/跳过”补证已被当前用户故事覆盖。现行证据入口为 `evidence/summonerwars/summonerwars-ice-shards-e2e-test.md`，验收口径为攻击阶段开始自动结算、无确认/跳过 UI、伤害与充能结果落位。

## 续跑口径

- 本文件只消费已 `locked` 的数据录入合同和已完成的首轮实现对照矩阵，不重新读图片/OCR，不重新录入规则。
- `locked` 对象若在 L3/L4 对照中暴露合同缺字段、来源冲突或对象归属不清，必须先降级为 `blocked` 或 `disputed` 并回写 evidence，再回录入层补合同。
- `disputed` 对象只做归属裁定；未裁定前不得写规则断言测试、不得修机制。
- 本队列原本不代表全量审计完成；C84 后它只作为已完成补证索引和条件性专项入口，不再表示仍有常规残余补证任务。

## 更新后的继续规则

- 数据录入要在 `locked` 之前做好：主真相源、完整单对象图/可读裁图、对象归属、规则原文、原子子句、索引入口、对照差异和未决项都必须已经落表。
- `locked` 不是“以后继续补录入”的标记，而是后续实现审计可以消费的合同；普通续跑不得把 `locked` 对象重新送回图片/OCR/重新抄规则。
- 后续继续时先读本队列、主 evidence 第 143-149 节、对应实现对照矩阵和 `continuation-task-state.json` 的最新状态；只有发现具体症状、官方规则冲突或合同字段缺口时，才新增对象级专项。
- 如果执行到某个 `locked` 对象时发现合同字段缺失、来源互相冲突、对象归属不清，先停止该对象的实现补证，把状态降级并回写 evidence；只有这种情况才回录入层。
- 如果对象仍是 `disputed`，只做归属裁定；归属未定前不写规则断言测试、不修机制、不用实现现状反推卡面规则。
- 本轮用户纠偏的结论是：录入质量靠合同字段守门，不靠后续反复读图续命；继续推进要消费已锁合同，而不是重做录入。

## 当前状态

| 分类 | 数量 | 说明 |
| --- | ---: | --- |
| 已完成 L4 专项 | 4 | 雌狮「威势」、贾穆德「威势」、瑟拉·艾德温「城塞之力」、城塞圣武士「裁决」 |
| 已锁规则原文并完成实现层补证 | 62 | C85 后不再把 `ferocity` / `entangle` 计入已锁/已裁定对象 |
| disputed 对象归属待裁定 | 2 | 史米革/部落投石手「凶猛」（`ferocity`）、城塞骑士「缠斗」（`entangle`）不得按 C80/C84 宣称已证实修复；是否复核归属需另启数据录入/对象归属任务 |
| 待建合同 | 0 | 普通续跑不回录入层 |

## 已完成 L4 补证

| 队列 | 对象 | 中文对象 | 已补证据 | 验证 |
| --- | --- | --- | --- | --- |
| L4-01 | `rapid_fire` | 梅肯达·露、边境弓箭手「连续射击」 | 真实攻击后确认交互收口；确认后只消耗 1 充能并授予本单位 1 次额外攻击；重复响应被拒绝且不再次消耗或授予 | `interaction-chain-comprehensive.test.ts` 目标测试通过 |
| L4-02 | `mind_transmission` | 古尔壮「心灵传念」 | 攻击敌方建筑后生成友方士兵选择；选择后只给目标 1 次额外攻击；重复响应被拒绝且不二次授予 | `interaction-chain-comprehensive.test.ts` 目标测试通过 |
| L4-10 | `infection` | 亡灵疫病体「感染」 | 真实击杀后生成选弃牌堆疫病体交互；选择后召唤落位并移出弃牌堆；重复响应被拒绝且不二次召唤 | `interaction-chain-comprehensive.test.ts` 目标测试通过 |
| L4-11 | `life_drain` | 德拉戈斯「吸取生命」 | 攻击前生成可跳过的牺牲选择；选择牺牲后收口并只摧毁一次；重复响应被拒绝且不二次牺牲 | `interaction-chain-comprehensive.test.ts` 目标测试通过 |
| L4-12 | `soul_transfer` | 亡灵弓箭手「灵魂转移」 | 触发后生成确认/跳过交互；确认后源位置清空并落到被摧毁位置；重复响应被拒绝且不二次移动 | `interaction-chain-comprehensive.test.ts` 目标测试通过 |
| L4-13 | `high_telekinesis_instead` | 卡拉「高阶念力」代替攻击 | 共享二段选择系统由 `telekinesis_instead` 代表链覆盖；高阶范围/行动经济已有直接断言 | `interaction-chain-comprehensive.test.ts` 目标测试通过 |
| L4-14 | `telekinesis_instead` | 清风法师「念力」代替攻击 | 真实 UI 二段选择先选目标再选方向；成功后推拉落位并只消耗一次攻击行动；重复响应不二次消耗 | `interaction-chain-comprehensive.test.ts` 目标测试通过 |
| L4-03 | `feed_beast` | 巨食兽「喂养野兽」 | 攻击阶段结束真实 halt；吞噬相邻友方后收口；重复响应被拒绝且不二次弃置；再次推进进入 magic 且不残留交互 | `interaction-chain-comprehensive.test.ts` 目标测试通过 |
| L4-15 | `ice_shards` | 贾穆德「寒冰碎屑」 | 2026-07-17 已改为攻击阶段开始自动结算；无确认/跳过 UI；多个贾穆德同阶段开始全部自动结算；伤害与充能结果落位 | `interaction-chain-comprehensive.test.ts` 与 `summonerwars-ice-shards-minimal.e2e.ts` 目标测试通过 |
| L4-19 | `magic_addiction` | 史米革「魔力成瘾」 | 回合结束真实入口自动扣魔力或弃置；多个史米革同回合结束时按顺序消费共享魔力，前一来源事件先进入临时状态，后一个来源不共享旧魔力快照；相邻阶段自动能力回归通过 | `interaction-chain-comprehensive.test.ts` 与 `abilities-goblin.test.ts` 目标测试通过 |
| L4-20 | `guidance` | 瓦伦蒂娜「指引」 | 召唤阶段真实入口自动抽 2 张；牌库不足时只抽实际剩余牌数，不越界、不重复抽 | `interaction-chain-comprehensive.test.ts` 目标测试通过 |
| L4-21 | `blood_rune` | 布拉夫「血符文」 | 攻击阶段开始真实入口按最新魔力生成二选一；多个布拉夫顺序处理时，第一个花唯一魔力充能后，第二个不沿用旧 charge 选项并自动自伤收口 | `interaction-chain-comprehensive.test.ts` 与 `abilities-goblin.test.ts` 目标测试通过 |
| L4-04 | `revive_undead` | 雷塔勒斯「复活亡灵」 | 真实交互链从发动技能进入弃牌堆选牌，再选相邻空格；结算时源单位自伤 2、目标亡灵从弃牌堆召唤落位并移出弃牌堆；重复响应被拒绝且不二次自伤/召唤 | `interaction-chain-comprehensive.test.ts` 与 `abilities-necromancer-execute.test.ts` 目标测试通过 |
| L4-05 | `ancestral_bond` | 阿布亚·石「祖灵纽带」 | 移动后真实入口生成可跳过目标选择；只列入 3 格内友方单位；确认后目标 +1 充能并接收自身全部充能；重复响应被拒绝且不二次转移 | `interaction-chain-comprehensive.test.ts` 与 `abilities-barbaric.test.ts` 目标测试通过 |
| L4-06 | `frost_axe` | 寒冰锻造师「寒冰战斧」 | 移动后真实入口附加到友方士兵；只消耗 1 充能；附加后士兵攻击时 special 按 2 个命中结算 | `interaction-chain-comprehensive.test.ts` 与 `abilities-frost.test.ts` 目标测试通过 |
| L4-07 | `healing` | 圣殿牧师「治疗」 | 攻击前真实入口选牌弃牌；本次攻击转为治疗且不造成伤害；攻击后治疗模式清理；重复响应被拒绝且不二次治疗/弃牌 | `interaction-chain-comprehensive.test.ts`、`abilities-paladin-new.test.ts` 与 `healing-friendly-attack.test.ts` 目标测试通过 |
| L4-08 | `holy_arrow` | 城塞弓箭手「圣光箭」 | 攻击前真实多选按卡名去重；只弃所选不同名单位牌；本次攻击临时加成不写永久充能；重复响应被拒绝且不二次弃牌/加成 | `interaction-chain-comprehensive.test.ts`、`abilities-paladin-execute.test.ts` 与 `abilities-paladin.test.ts` 目标测试通过 |
| L4-17 | `sacrifice` | 地狱火教徒「献祭」 | 重复致死伤害后处理只注入一次献祭连锁；同一地狱火教徒只被摧毁一次，相邻敌方只受到一次献祭伤害并只被摧毁一次，血腥狂怒只因连锁死亡充能一次 | `entity-chain-integrity.test.ts` 目标测试通过 |
| L4-18 | `cold_snap` | 奥莱格「寒流」 | 有效生命按当前棋盘动态重算；新建筑进场立即获得加成，建筑离场不影响其他建筑重算，建筑归属变化或奥莱格离场后不再获得加成 | `entity-chain-integrity.test.ts` 目标测试通过 |
| L4-22 | `illusion` | 心灵巫女「幻象」 | 移动阶段开始生成可跳过士兵目标选择；只列入 3 格内士兵；确认后复制目标能力；交互收口；重复响应被拒绝且不二次复制 | `interaction-chain-comprehensive.test.ts` 目标测试通过 |
| L4-23 | `spirit_bond` | 祖灵法师「祖灵交流」 | 移动后生成强制二选一且不提供跳过；转移路径花 1 充能并给 3 格内友方单位 +1 充能；交互收口；重复响应被拒绝且不二次转移 | `interaction-chain-comprehensive.test.ts` 目标测试通过 |
| L4-24 | `prepare` | 梅肯达·露、边境弓箭手「准备」 | 完整管线中准备直接给自身 +1 充能并消耗本次移动；无交互残留；准备后移动命令被拒绝且不二次充能 | `interaction-chain-comprehensive.test.ts` 目标测试通过 |
| L4-25 | `inspire` | 凯鲁尊者「鼓舞」 | 完整管线中移动后自动充能移动后相邻友方；不作用自身、敌方相邻单位、只在移动前相邻但移动后非相邻的友方单位；无交互残留 | `interaction-chain-comprehensive.test.ts` 目标测试通过 |
| L4-26 | `living_gate` / `gather_power` | 寒冰魔像「活体传送门」与祖灵法师「聚能」 | 活体传送门作为己方召唤入口时可召唤祖灵法师；敌方活体传送门不提供己方召唤位；该特殊召唤入口仍走 `SUMMON_UNIT` 后续，只给被召唤单位 1 次聚能充能 | `entity-chain-integrity.test.ts` 目标测试通过 |
| L4-27 | `soulless` | 亡灵疫病体「无魂」 | 真实击杀后进入最终状态校验：无魂单位击杀敌方后不获得魔力；普通单位在同场景击杀敌方会获得 1 魔力 | `entity-chain-integrity.test.ts` 目标测试通过 |
| L4-28 | `fire_sacrifice_summon` | 伊路特-巴尔「火祀召唤」 | 系统交互只列己方非召唤师作为牺牲候选；确认后只扣费、牺牲并召唤落位一次；重复响应被拒绝且不二次扣费/牺牲/召唤 | `interaction-chain-comprehensive.test.ts` 目标测试通过 |
| L4-29 | `mobile_structure` | 寒冰魔像「活体结构」 | 寒冰魔像移动后按新位置作为友方建筑被结构消费者读取；旧位置不再提供寒冰箭结构加成；移动事件只落地一次 | `abilities-frost.test.ts` 目标测试通过 |
| L4-30 | `speed_up` | 犀牛「速度强化」 | 8 充能时仍最多只提供 +5 移动：7 格移动可行，8 格移动被拒绝，不能把 8 充能当作 +8 移动 | `abilities-barbaric.test.ts` 目标测试通过 |
| L4-31 | `ranged` | 清风弓箭手「远射」 | 真实声明攻击命令入口沿用 4 格清晰直线合同：敌方建筑目标可攻击，路径中间有卡牌阻挡时拒绝，4 格内非直线目标拒绝 | `abilities-trickster.test.ts` 目标测试通过 |
| L4-32 | `divine_shield` | 科琳·布莱顿「神圣护盾」 | 真实声明攻击入口只保护科琳友方城塞目标，不为敌方城塞目标触发；护盾减攻只作用本次攻击，下一次独立攻击重新按攻击者原始战力掷骰 | `abilities-paladin-new.test.ts` 目标测试通过 |
| L4-33 | `aerial_strike` | 葛拉克「浮空术」 | 只影响开始移动时 2 格内的友方士兵，不影响敌方士兵；真实移动入口允许该士兵本次移动穿越路径中间卡牌 | `abilities-trickster.test.ts` 目标测试通过 |
| L4-34 | `guardian` | 城塞骑士「守卫」 | 相邻敌方守卫存在时，攻击目标必须是守卫单位本身；不能改攻非守卫单位，也不能改攻建筑 | `abilities-paladin.test.ts` 目标测试通过 |
| L4-35 | `immobile` | 部落抓附手「禁足」 | 普通移动目标清单为空；真实移动命令被禁足门禁拒绝；同场其它非禁足单位普通移动不受影响 | `abilities-goblin.test.ts` 目标测试通过 |
| L4-36 | `blood_rage` | 亡灵战士「血腥狂怒」 | 真实攻击击杀后只产生 1 次血腥狂怒充能并落到最终 boosts=1；事件流回放时同一充能事件不会被 UI 反馈重复消费 | `abilities-necromancer-execute.test.ts` 与 `useGameEvents.test.ts` 目标测试通过 |
| L4-37 | `blood_rage_decay` | 亡灵战士「血腥狂怒」回合末清理 | 真实抽牌阶段结束进入回合末清理；3 充能降到 1，1 充能由 reducer 夹到 0，0 充能不触发衰减事件 | `interaction-chain-comprehensive.test.ts` 目标测试通过 |
| L4-38 | `power_boost` | 布拉夫 / 亡灵战士「力量强化」 | 补齐亡灵战士承载链：0/3/8 充能分别得到基础战力 2、战力 5、战力 7，并在 breakdown 中以 `power_boost` 来源记录 +3 / +5 上限 | `abilities-necromancer-execute.test.ts` 目标测试通过 |
| L4-39 | `power_up` | 蒙威尊者「力量强化」 | 补齐蒙威尊者承载链：0/3/8 充能分别得到基础战力 1、战力 4、战力 6，并在 breakdown 中以 `power_up` 来源记录 +3 / +5 上限 | `abilities-barbaric.test.ts` 目标测试通过 |
| L4-40 | `rage` | 古尔-达斯「暴怒」 | 补齐古尔-达斯承载链：0/3 伤害分别得到基础战力 2、战力 5，并在 breakdown 中以 `rage` 来源记录 +3 | `entity-chain-integrity.test.ts` 目标测试通过 |
| L4-41 | `evasion` | 掷术师「迷魂」 | 同骰面对照有/无迷魂时，special 面触发后最终 hits 和 `UNIT_DAMAGED.damage` 均减少 1，并产生 `DAMAGE_REDUCED value=1` | `entity-chain-integrity.test.ts` 目标测试通过 |
| L4-42 | `charge` / `ice_ram` / `stable` | 野兽骑手「冲锋」、寒冰冲撞、卡拉「稳固」 | 冲锋补真实移动门禁与非直线 3 格负向；寒冰冲撞补建筑目标负向并沿用稳固只伤不推拉代表链；稳固补普通移动不受影响边界 | `abilities-goblin.test.ts`、`interaction-chain-comprehensive.test.ts`、`abilities-trickster.test.ts` 目标测试通过 |

## P0 必须优先补的 L4 队列

| 队列 | 对象 | 中文对象 | 原残余补证点 | 现有证据入口 | 当前边界 |
| --- | --- | --- | --- | --- | --- |
| L4-01 | `rapid_fire` | 梅肯达·露、边境弓箭手「连续射击」 | 确认后只授予一次额外攻击；刷新/回放不重复授予 | `b1-p1-implementation-diff-matrix` | 已完成真实入口与重复响应补证；若后续扩大，只补 UI eventStream 回放不重复打开确认 |
| L4-02 | `mind_transmission` | 古尔壮「心灵传念」 | 选择友方士兵后只授予目标一次额外攻击；刷新/回放不重复授予 | `b1-p1-implementation-diff-matrix` | 已完成真实入口与重复响应补证；若后续扩大，只补 UI eventStream 回放不重复打开选择 |
| L4-03 | `feed_beast` | 巨食兽「喂养野兽」 | 攻击阶段结束强制结算后不重复二次弃置；阶段推进不残留选择 | `b3-p2-implementation-diff-matrix` | 已完成阶段结束真实入口、重复响应和阶段推进收口补证 |
| L4-04 | `revive_undead` | 雷塔勒斯「复活亡灵」 | 成本自伤、选弃牌堆亡灵、相邻空格选择在刷新/重放下不重复执行 | `b3-p2-implementation-diff-matrix` | 已完成真实交互链、成本、召唤落位和重复响应补证；若后续扩大，只补 UI eventStream 回放不重复打开选牌/选格 |
| L4-05 | `ancestral_bond` | 阿布亚·石「祖灵纽带」 | 移动后交互刷新/重放不重复转移充能 | `b3-p2-implementation-diff-matrix` | 已完成移动后真实入口、目标过滤、充能转移落地和重复响应补证；若后续扩大，只补 UI eventStream 回放不重复打开选择 |
| L4-06 | `frost_axe` | 寒冰锻造师「寒冰战斧」 | 附加后士兵攻击时特殊面替换真实生效；只消费 1 充能 | `b3-p2-implementation-diff-matrix` | 已完成移动后真实入口、附加落地、攻击消费和 special 按 2 命中补证；若后续扩大，只补 UI eventStream 回放不重复打开选择 |
| L4-07 | `healing` | 圣殿牧师「治疗」 | 治疗模式只作用本次攻击，刷新/重放后不残留 | `b3-p2-implementation-diff-matrix` | 已完成攻击前真实选牌、治疗落地、攻击后清理和重复响应补证；若后续扩大，只补 UI eventStream 回放不重复打开选牌 |
| L4-08 | `holy_arrow` | 城塞弓箭手「圣光箭」 | 多选同名候选 UI/交互边界；本次攻击临时加成不残留 | `b3-p2-implementation-diff-matrix` | 已完成真实多选去重、临时加成、不写永久充能和重复响应补证；若后续扩大，只补 UI eventStream 回放不重复打开选牌 |
| L4-09 | `structure_shift` | 斯瓦拉「结构迁移」 | Force 通用规则来源与刷新/重放不重复移动 | `b3-p2-implementation-diff-matrix` | 已完成移动后两步真实入口、Force 1 相邻空格候选、占用格排除、建筑移动落地和重复响应补证；若后续扩大，只补 UI eventStream 回放不重复打开两步选择 |
| L4-10 | `infection` | 亡灵疫病体「感染」 | 击杀后生成选牌交互，选牌后落位；刷新/重放不重复召唤 | `b4-p2-implementation-diff-matrix` | 已完成真实交互闭环与重复响应补证；若后续扩大，只补 UI eventStream 回放不重复打开选择 |
| L4-11 | `life_drain` | 德拉戈斯「吸取生命」 | 攻击前 UI 选择/跳过与刷新不重复牺牲 | `b4-p2-implementation-diff-matrix` | 已完成真实攻击前选择与重复响应补证；跳过路径可并入可选交互代表链 |
| L4-12 | `soul_transfer` | 亡灵弓箭手「灵魂转移」 | 交互层确认/跳过与刷新不重复移动 | `b4-p2-implementation-diff-matrix` | 已完成确认移动与重复响应补证；跳过路径可并入可选交互代表链 |
| L4-13 | `high_telekinesis_instead` | 卡拉「高阶念力」代替攻击 | 真实 UI 二段选择和刷新不重复消耗攻击行动 | `b4-p2-implementation-diff-matrix` | 已由共享二段系统代表链覆盖，保留高阶范围/目标类型直接断言 |
| L4-14 | `telekinesis_instead` | 清风法师「念力」代替攻击 | 真实 UI 二段选择和刷新不重复消耗攻击行动 | `b4-p2-implementation-diff-matrix` | 已完成真实 UI 二段选择与重复响应补证 |
| L4-15 | `ice_shards` | 贾穆德「寒冰碎屑」 | 攻击阶段开始自动触发时的多来源边界与无选择 UI 收口 | `summonerwars-ice-shards-e2e-test` | 已完成多来源自动结算、充能不足不触发、无确认/跳过 UI 与真实页面结果补证 |
| L4-16 | `mind_capture` / `mind_capture_resolve` | 泰珂露「心灵捕获」 | 伤害路径真实交互闭环，控制/伤害二选一后不重复伤害 | `b5-p2-implementation-diff-matrix` | 已完成 damage 选择真实入口、伤害摧毁、决策后攻击后触发和重复响应不二次伤害补证；若后续扩大，只补 UI eventStream 回放不重复打开二选一 |
| L4-17 | `sacrifice` | 地狱火教徒「献祭」 | 连锁死亡回放/重连不重复触发 | `b8-p3-p4-static-summon-and-death-implementation-diff-matrix` | 已完成连锁死亡重复消费断言；若后续扩大，只补 UI eventStream 重连不重复展示死亡链 |
| L4-18 | `cold_snap` | 奥莱格「寒流」 | 建筑进出场/控制权变化后的动态重算 | `b8-p3-p4-static-summon-and-death-implementation-diff-matrix` | 已完成动态重算断言；若后续扩大，只补 UI 展示层有效生命即时刷新 |

## P1 可按代表链合并的补证队列

| 代表链 | 覆盖对象 | 中文对象 | 本轮补证点 | 当前状态 |
| --- | --- | --- | --- | --- |
| P1-FORCE-STABLE-01 | `stable` / `high_telekinesis` / `telekinesis` / `ice_ram` | 卡拉「稳固」、卡拉「高阶念力」、清风法师「念力」、寒冰冲撞 | 已消费 locked 合同，不回图片/OCR；新增高阶念力不能推动稳固目标、寒冰冲撞仍造成 1 点伤害但不强制移动稳固目标、寒冰冲撞排除建筑目标、稳固不影响普通移动等断言；定向测试 `冲锋|charge|ice_ram|寒冰冲撞|stable|稳固` 通过，3 个测试文件、16 passed / 222 skipped | 已补到 L4；`withdraw` 的直线/空格 Force 细则仍保留规则书核对，不因本轮代表链硬判 |
| P1-MOVE-CHOICE-01 | `grab` / `ancestral_bond` / `structure_shift` | 部落抓附手「抓附」、阿布亚·石「祖灵纽带」、斯瓦拉「结构迁移」 | 已消费 locked 合同，不回图片/OCR；新增「抓附」真实入口断言，覆盖友方从相邻处移动后生成跟随选择、确认后只移动一次、交互收口、重复响应不二次移动；定向测试 `grab|抓附` 通过，1 passed / 128 skipped | 已补移动后选择代表链中的「抓附」真实入口；`prepare`、`inspire`、`illusion`、`spirit_bond` 已有各自首轮/专项证据，后续继续补 `vanish` 或低风险边界，不把本代表链当全量完成 |
| P1-ACTIVE-CHOICE-01 | `vanish` | 思尼克斯「狡黠」 | 已消费 locked 合同，不回图片/OCR；新增真实入口断言，覆盖无目标发动后只列入友方 0 费用单位、确认后交换位置、交互收口、重复响应不二次交换、同回合二次使用拒绝；定向测试 `vanish|狡黠|神出鬼没` 通过，5 passed / 125 skipped | 已补主动选目标能力的真实入口和次数门禁；后续若扩大，只补 UI eventStream 回放不重复打开选择 |
| P1-STATIC-STATS-01 | `life_up` / `radiant_shot` / `frost_bolt` / `greater_frost_bolt` / `fortress_elite` | 生命强化、光辉射击、寒冰箭、高阶寒冰箭、城塞精英 | 已消费 locked 合同，不回图片/OCR；新增静态数值读取代表链断言，覆盖敌方/超距/非相邻不计入、奇数魔力向下取整、生命强化按当前充能动态读取且最多 +5；定向测试 `radiant_shot|frost_bolt|greater_frost_bolt|fortress_elite|life_up|静态数值|辉光射击|寒冰箭|高阶寒冰箭|城塞精英|生命强化` 通过，1 个测试文件，9 passed / 90 skipped | 已补静态数值代表链当前 L4；`power_boost`、`power_up`、`rage` 保留首轮证明，后续只在发现战力拆解/UI 展示层分叉时追加专项 |
| P1-MOVE-PATH-01 | `climb` / `flying` / `swift` / `slow` / `trample` / `rebound` / `evasion` | 攀爬、飞行、迅捷、缓慢、践踏、缠斗、迷魂 | 已消费 locked 合同，不回图片/OCR；新增移动穿越/相邻代表链断言，覆盖攀爬可穿建筑但不穿单位、飞行可穿单位和建筑、迅捷只加距离不穿阻挡、缓慢只允许 1 格、践踏只伤害路径中间被穿越单位、缠斗仅在相邻敌方远离时触发且靠近/仍相邻不触发；另补迷魂真实攻击最终伤害落点，确认 special 面触发后 hits 与 `UNIT_DAMAGED.damage` 均减少 1；定向测试 `movement|trample|rebound|climb|flying|swift|slow|移动|践踏|缠斗|攀爬|飞行|迅捷|缓慢` 通过，1 个测试文件，13 passed / 89 skipped；`evasion|迷魂` 通过，1 个测试文件，4 passed / 102 skipped | 已补移动与相邻/攻击减伤通用链当前 L4；后续只在攻击展示/UI 回放分叉时追加专项；不得用该代表链裁定城塞骑士 `entangle` 归属 |
| P1-DISPUTED-FIX-01 | `ferocity` / `entangle` | 史米革/部落投石手「凶猛」、城塞骑士「缠斗」 | C85 后撤销“官方在线文本包已裁定”口径；C86 明确普通审计不自动回卡图或录入层。现有配置/测试改动只能视为待裁定候选，不得汇报为已证实修复。 | 现有测试通过只能证明候选配置下的行为，不证明真实归属；若要裁定归属，需另启数据录入/对象归属复核任务 | `disputed-待归属复核任务` |

| 代表链 | 对象 | 中文对象 | 合并理由 | 当前边界 |
| --- | --- | --- | --- | --- |
| Force / 稳固通用规则来源 | `withdraw`、`high_telekinesis`、`telekinesis`、`structure_shift`、`stable` | 凯鲁尊者「撤退」、卡拉「高阶念力」、清风法师「念力」、斯瓦拉「结构迁移」、卡拉「稳固」 | 已查本地实现层：`helpers.ts` 中普通 Force 按上/下/左/右任选方向、每格必须在界内且为空、单位和建筑阻挡；旧 `push/pull` 按来源方向推断的 helper 已标 deprecated。本地实现口径清晰，但这仍不是官方规则真相源。 | 保持为“通用规则来源专项”：不回图片/OCR，不阻塞已 locked 对象 L4；后续若找到官方 Force 规则与本地实现冲突，再单独降级 Force 细则并开最小测试/修复。 |
| 阶段开始/结束自动能力 | `blood_rune`、`guidance`、`blood_rage_decay` | 布拉夫「血符文」、瓦伦蒂娜「指引」、亡灵战士「血腥狂怒」回合末清理 | 都是阶段或回合钩子；史米革「魔力成瘾」、瓦伦蒂娜「指引」、布拉夫「血符文」已完成 L4，剩余残余仅为低风险回合末清理边界或后续 UI 回放专项 | `blood_rage_decay` 低风险边界后续按代表链补；`magic_addiction`、`guidance`、`blood_rune` 后续只在发现 UI 回放重复触发时追加专项 |
| 移动后可选/强制选择 | `prepare`、`inspire`、`illusion`、`spirit_bond`、`grab` | 准备、鼓舞、幻象、祖灵交流、抓附 | 都依赖移动阶段或移动后真实入口；已补「抓附」「幻象」「祖灵交流」真实入口、交互收口和重复响应证据；本轮补齐「准备」完整管线行动经济和「鼓舞」移动后目标全集边界 | 该代表链已完成当前 L4；后续只在 UI eventStream 回放重复展示时追加专项，不回录入 |
| 静态数值读取 | `power_boost`、`power_up`、`life_up`、`rage`、`radiant_shot`、`frost_bolt`、`greater_frost_bolt`、`fortress_elite`、`speed_up` | 力量强化、生命强化、暴怒、光辉射击、寒冰箭、高阶寒冰箭、城塞精英、速度强化 | 静态计算或按当前资源读取；已补 `life_up`、`radiant_shot`、`frost_bolt`、`greater_frost_bolt`、`fortress_elite` 的动态读取/负向边界；已补 `speed_up` 超过 5 充能仍最多 +5 移动；已补 `power_boost`、`power_up`、`rage` 的来源拆解或上限边界 | 该代表链已完成当前 L4；后续只在战力/移动力拆解或 UI 展示层出现分叉时追加专项，不回录入 |
| 移动与相邻通用链 | `climb`、`flying`、`swift`、`slow`、`rebound`、`evasion`、`trample` | 攀爬、飞行、迅捷、缓慢、缠斗、迷魂、践踏 | 已补攀爬/飞行/迅捷/缓慢/践踏/缠斗的真实移动入口或负向边界；已补迷魂 special 面触发后的真实攻击最终伤害落点 | 该代表链已完成当前 L4；后续只在攻击展示、移动 UI 回放或对象类型合同出现分叉时追加专项，不回录入 |
| 召唤/死亡奖励链 | `fire_sacrifice_summon`、`soulless`、`living_gate`、`mobile_structure`、`gather_power` | 火祀召唤、无魂、活体传送门、活体结构、聚能 | 已补活体传送门作为特殊召唤入口时的归属边界和聚能后续触发，确认敌方活体传送门不提供己方召唤位、祖灵法师被召唤后只给自身位置充能 1 次；已补无魂真实击杀后的最终魔力状态边界，确认无魂击杀不加魔力、普通击杀加魔力；已补火祀召唤真实交互候选过滤、最终落位和重复响应不二次结算；已补活体结构移动后结构消费者读取新位置且旧位置不残留 | 当前已完成召唤入口、火祀召唤、活体结构和无魂死亡奖励代表链；后续只在发现 UI 展示、eventStream 重放或其它低风险对象有特殊入口绕过时追加专项 |

## disputed 队列

| 对象 | 中文对象 | 当前状态 | 禁止动作 | 下一步 |
| --- | --- | --- | --- | --- |
| `ferocity` | 史米革 / 部落投石手「凶猛」 | `disputed-待归属复核任务` | 不得把在线文本包或测试通过当作归属证明；不得汇报为已证实修复 | 不在普通审计中自动回卡图/重录 |
| `entangle` | 城塞骑士「缠斗」 | `disputed-待归属复核任务` | 不得把在线文本包或测试通过当作归属证明；不得汇报为已证实修复 | 不在普通审计中自动回卡图/重录 |

## 条件性专项入口

1. `rapid_fire` 与 `mind_transmission` 已完成真实入口和重复响应补证；只有后续发现 UI eventStream 回放风险时，才追加 UI 层专项。
2. `infection`、`soul_transfer`、`life_drain`、`high_telekinesis_instead`、`telekinesis_instead` 已完成 B4 真实交互闭环补证；只有后续发现 UI eventStream 回放风险时，才追加 UI 层专项。
3. 阶段推进类中 `feed_beast`、`ice_shards`、`magic_addiction`、`guidance`、`blood_rune` 已完成 L4；`revive_undead`、`ancestral_bond`、`frost_axe`、`healing`、`holy_arrow`、`structure_shift`、`illusion`、`spirit_bond`、`prepare`、`inspire`、`charge`、`ice_ram`、`stable` 等已补到 L4，不再作为常规残余队列继续清点。
4. 静态数值、移动穿越、活体结构等低风险对象已按代表链补边界；后续只在发现战力/移动力展示分叉、eventStream 重放、官方规则来源冲突或合同字段缺口时追加专项，不逐项重做录入。
