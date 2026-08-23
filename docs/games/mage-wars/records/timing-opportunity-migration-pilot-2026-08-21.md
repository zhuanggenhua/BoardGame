# Mage Wars 时点-机会迁移试点记录

本记录只描述 Mage Wars 当前迁移状态；平台级时点模型和接入要求看 [时点-机会-结算标准](../../../../.spec/knowledge/standards/timing-opportunity-resolution.md)。

## 试点理由

Mage Wars 当前范围命中复杂技能、状态、响应和事件改写需求，且未承担旧线上存档兼容负担，适合作为 `TimingPoint -> Opportunity -> ChoiceRequest` 的先行迁移对象。

## 已迁移

- 女祭司法师恢复从 Board 私有距离、费用和状态枚举，迁到 [`src/games/mage-wars/domain/mageAbilityRuntime.ts`](../../../../src/games/mage-wars/domain/mageAbilityRuntime.ts) 的 `AbilityDef -> Opportunity -> ChoiceRequest` 合同。
- 快速恢复和标准恢复的目标、费用、状态组合和提交命令，统一由 ChoiceRequest 候选生成。
- 验证入口复用 `validateMageWarsMageAbilityStatusRemoval`。
- Board 只消费 direct selection 投影：目标高亮来自候选 `targetRef`，最终命令来自候选 `commandPreview`。
- 标准恢复同一目标存在多个状态组合时，Board 不再选择“偏好组合”，而是要求玩家在二级状态选择面板中明确选择要移除的状态组合。
- 对象主动能力的 Board 消费从只写死治疗之光，迁到枚举当前对象所有已注册 `AbilityDef -> Opportunity -> ChoiceRequest` 合同：蓝色精怪迅捷传送这类 self/confirm 能力直接提交候选命令，治疗之光和救赎献祭这类对象目标能力用候选 `targetRef` 高亮目标，群兽法杖这类同一目标多模式能力必须在二级模式面板中明确选择，元素魔杖绑定这类 `select-card` 能力通过候选面板选择新绑定法术。
- 对象主动能力的附件来源也改为消费合同；例如群兽法杖作为法师附件时，附件卡本体可以成为能力来源入口，最终 `USE_ARENA_OBJECT_ABILITY` payload 仍来自候选 `commandPreview`。
- 兽性觉醒、昏睡、汲血之击、溶解、驱散、爆炸、缠绕藤蔓、剧痛难当和显性对象结界这类单对象直接施放法术，已迁到 [`src/games/mage-wars/domain/spellCastRuntime.ts`](../../../../src/games/mage-wars/domain/spellCastRuntime.ts) 的 `AbilityDef -> Opportunity -> ChoiceRequest` 合同。
- 推斥和传送这类“先选对象、再选目的地区域”的多步施放法术，已迁到同一施法合同：ChoiceRequest 候选同时携带对象目标、区域目标、费用和最终 `CAST_SPELL` 命令。
- 区域目标法术，包括区域攻击、区域治疗和生物召唤，已迁到同一施法合同；通用 Choice Request 增加 `select-zone` 语义，区域 UI 和 AI 合法动作都消费同一候选。合同 family 已拆成 `zone-attack`、`zone-healing` 和 `summon-creature`，不再保留粗 `zone-target` 作为规则主控。显性区域结界也不再被粗略吞进普通区域目标，而是由 `visible-area-enchantment` 施法 family 表达，例如 `1913` 圣佑领地。
- 墙体法术已迁到同一施法合同；通用 Choice Request 增加 `select-position` 语义，墙体边线 UI 和 AI 合法动作都消费同一候选。
- 结界窃取这类“先选可见附着结界、再选新附着目标”的法术已迁到同一施法合同：ChoiceRequest 候选同时携带被偷结界、新对象 / 新玩家 / 新区域目标、费用和最终 `CAST_SPELL` 命令。
- 连锁闪电这类“首目标 + 可选后续目标链”的法术已迁到同一施法合同：ChoiceRequest 候选用完整对象路径表达每一种合法停止点和继续点，Board 只负责沿候选路径高亮下一跳或提交当前链路。
- 火球术这类普通直接攻击法术已迁到同一施法合同：对象目标和对方法师目标分别由 ChoiceRequest 候选表达，Board 只提交候选里的 `CAST_SPELL` 命令。
- 气流这类“攻击目标 + 推移目的地”的攻击法术已迁到同一施法合同：ChoiceRequest 候选同时携带对象 / 对方法师目标、推移区域、费用和最终 `CAST_SPELL` 命令；Board 先选对象或法师，再选合法推移区域。
- 厄运、法力失效和攻击逆转这类隐藏响应结界的施放目标也已迁到同一施法合同：对象目标和可挂法师目标由 ChoiceRequest 候选表达，响应窗口仍由隐藏响应结界时点系统负责。
- 单体治疗和生命汲取已迁到同一施法合同：对象目标和法师目标分别由 ChoiceRequest 候选表达，Board 不再把玩家点击降级成旧 `targetPlayerId` fallback。
- 普通装备自目标法术已迁到同一施法合同：皮革手套、恶魔胸甲这类已实现非元素魔杖装备生成指向施法者法师的 `select-player` 候选，UI、AI 和验证统一消费候选里的 `CAST_SPELL` 命令。
- 元素魔杖施放时的“目标法师 + 可选绑定法术”已迁到同一施法合同：ChoiceRequest 使用 `choose-option` / `player-bound-spell` 复合候选表达“不绑定”和每张可绑定非史诗攻击法术，Board 点击目标法师后必须打开候选面板，不再默认提交无绑定分支。
- 这些法术的合法目标、目标依赖费用、目标链、绑定选项和提交命令由 ChoiceRequest 候选生成；Board 只用候选 `targetRef`、候选 value 和命令 payload 高亮目标对象 / 目标区域 / 目的地区域 / 墙体边线 / 新附着目标 / 连锁下一跳 / 绑定法术选项，并用 `commandPreview` 提交 `CAST_SPELL`。
- Board 的施法旧 fallback 已删除：只要当前准备法术存在 ChoiceRequest 合同，目标对象、区域、墙体边线、玩家、确认或二级目的地点击都不能再自行拼 `CAST_SPELL`，只能命中合同候选的 `commandPreview`。`3417` 荒野呼唤这类无目标竞技场强化法术也已迁为 `confirm` ChoiceRequest；法力不足等 disabled 候选不会再被 Board 的无目标直接施法路径绕过。
- Board 的施法二段选择状态已从 `pendingSpellTargetObjectId` / `pendingSpellTargetPlayerId` / `pendingSpellChainTargetObjectIds` 三个可并存状态收口为单一 `PendingSpellCastSelection` 联合类型：对象目标、玩家目标和连锁路径结构上互斥，仍只负责 UI 当前选择意图，提交命令仍只能来自 ChoiceRequest 候选 `commandPreview`。`ArenaStage` 子树也只接收这一个结构，不再把对象目标和玩家目标作为两条 pending prop 继续向下传。
- `CAST_SPELL` validator 的主分支已切到 `spellCastChoiceFamily`：push、chain、新附着目标、墙体边线、装备、攻击、区域和对象目标都先按 family 合同裁决，不再由一串具体法术 helper 或 targetRule 文案成为主控入口。
- `CAST_SPELL` validator 已进一步从一个长 `if` 主控收口为 `MAGE_WARS_SPELL_CAST_FAMILY_VALIDATORS: Record<MageWarsSpellCastChoiceFamily, ...>`：通用施法门槛留在入口，具体目标、费用、范围、目标模式和特殊拒绝语义按 family validator 分派，和执行层的 family map 对齐。
- 施法执行入口也已切到 `spellCastChoiceFamily -> executor`：[`src/games/mage-wars/domain/spellAbilityExecutors.ts`](../../../../src/games/mage-wars/domain/spellAbilityExecutors.ts) 不再按 `spell-type:*` 注册攻击 / 生物 / 魔物 / 咒语 / 装备 / 结界执行器，也删除了咒语串行尝试多个具体效果的旧 `executeIncantationSpell`；保留的 executor registry 只作为 ability catalog 对齐的薄适配，真实执行由 family map 决定。
- 施法执行器内部的具体牌 guard 已继续删除：缠绕藤蔓不再复用通用魔物 / 墙体分支，显性区域结界和显性对象结界不再共用一个执行器后再判断锚点；未进入施法 family 的法术如果绕过验证直达执行层，会抛出明确合同错误而不是静默返回空事件。`spellCastRuntime` 的直指对象法术费用候选也改为按 family switch 分派，不再重新调用一串具体已实现 helper 当第二套主控。
- `CAST_SPELL` 验证入口现在要求法术先命中 `resolveMageWarsSpellCastChoiceFamily`；标准法术书里仍 `requiresCodeSupport=true` 或没有正式施法 family 的牌会被拒绝为 `spellRequiresCodeSupport`，不能再靠 validator 末尾自然落到 valid。
- 隐藏响应结界，包括法术反制类响应和攻击反转类响应，已迁到 [`src/games/mage-wars/domain/timingOpportunities.ts`](../../../../src/games/mage-wars/domain/timingOpportunities.ts)、[`src/games/mage-wars/domain/responseResolution.ts`](../../../../src/games/mage-wars/domain/responseResolution.ts) 和 [`src/games/mage-wars/domain/systems.ts`](../../../../src/games/mage-wars/domain/systems.ts)：事件发现 `Opportunity`，响应窗口承载当前响应者，`ResolutionFrame` 持有 live 响应上下文，ChoiceRequest 候选提交 reveal。
- 目标法术反制的触发条件已收口为 [`src/games/mage-wars/domain/spellRules.ts`](../../../../src/games/mage-wars/domain/spellRules.ts) 的规则语义查询；[`src/games/mage-wars/domain/execute.ts`](../../../../src/games/mage-wars/domain/execute.ts) 不再直接用中文法术类别解释“目标法术反制”。
- 隐藏响应牌号也已收口到 `spellRules.ts` 的 `MAGE_WARS_HIDDEN_RESPONSE_CARD_IDS`、响应牌号类型和解析函数；执行层从响应对象的 `sourceSpellCardId` 解析 live 响应牌，`responseResolution` / `systems` / `reducer` 只消费规则层类型和谓词，不再散写 `1825` / `1901` / `1904` 作为分支主控。
- 法师祸咒 `1804` 的“附着生物成功施放并结算法术后受到 1 点直接伤害”已从 `createMageWarsInteractionSystem` 的直接事件扫描迁到 `discoverMageWarsTimingOpportunities`：每个附着诅咒生成一个 mandatory `MAGEBANE_CURSE_DAMAGE` Opportunity，由 TimingOpportunitySystem 追加伤害事件。交互系统不再发现这个触发，伤害来源玩家也由诅咒本体控制者提供，而不是被诅咒施法者。
- 反击、防御、维持费用、死亡链接维持治疗转移和睡眠受伤替代也已接入 `discoverMageWarsTimingOpportunities`；它们属于 Mage Wars 当前试点的时点机会消费者，不表示所有游戏默认强制启用。
- 死亡链接的施放入口已按显性对象结界纳入施法 ChoiceRequest；其“每个维持阶段可以治疗控制方法师最多 2 点，并把实际移除伤害作为直接伤害放到附着生物上”的效果不靠施法按钮或展示文案结算，而是在维持阶段生成 `UPKEEP_HEAL_TRANSFER_AVAILABLE`，再由 `UPKEEP_HEAL_TRANSFER` Opportunity 投影成 `heal-1` / `heal-2` / `skip` 候选。玩家选择治疗后，`createMageWarsInteractionSystem` 只生成治疗事件和 `UPKEEP_HEAL_TRANSFER_DAMAGE_AVAILABLE` 事实，附着生物受到的直接伤害与击败事件由 `UPKEEP_HEAL_TRANSFER_DAMAGE` Opportunity 结算。
- 维持阶段腐化、燃烧和显性结界直伤已从 [`src/games/mage-wars/domain/flowHooks.ts`](../../../../src/games/mage-wars/domain/flowHooks.ts) 的直接伤害 / 击败事件生成，迁到 `UPKEEP_ROT_DAMAGE_AVAILABLE`、`UPKEEP_BURN_ROLL_AVAILABLE` 和 `UPKEEP_ENCHANTMENT_DIRECT_DAMAGE_AVAILABLE` 三类规则事实，再由 `discoverMageWarsTimingOpportunities` 生成 mandatory Opportunity 结算伤害、燃烧移除和击败事件。`flowHooks` 现在只枚举维持阶段可触发事实，不再直接吐 `DAMAGE_DEALT`、`STATUS_TOKEN_REMOVED` 或击败事件；显性结界直伤来源也改由来源结界控制者归因。
- 恶魔胸甲这类反伤屏障已从 [`src/games/mage-wars/domain/execute.ts`](../../../../src/games/mage-wars/domain/execute.ts) 的攻击执行内直接反伤，迁到 `DAMAGE_BARRIER_AVAILABLE -> DAMAGE_BARRIER` Opportunity：攻击执行只保留来源发现和屏障掷骰事实，TimingOpportunitySystem 统一生成 `DAMAGE_BARRIER_TRIGGERED`、反伤伤害和攻击者被击败事件；reducer 仍只消费 `DAMAGE_BARRIER_TRIGGERED` 记录 once-per-attacker-per-round。

## 剩余边界

- `pendingMageAbility` 仍是 UI 选择意图状态，只负责“玩家已选中法师能力，等待目标 / 状态组合”，不是规则真相源。
- `pendingObjectAbility` 仍是 UI 选择意图状态，只负责“玩家已选中对象能力，等待目标 / 模式 / 卡牌候选”，不是规则真相源。
- `selectedSpellCardId` 和 `PendingSpellCastSelection` 仍是 UI 选择意图状态，只负责“玩家已选中准备法术、等待目标 / 目的地 / 新附着目标 / 连锁下一跳”，不是规则真相源。
- 施法 UI 不再保留自行拼装 `CAST_SPELL` 的旧兼容路径；`spellCastRuntime` 尚未覆盖或当前状态无法生成合同的法术，不会从 Board 私有规则推断里获得可施放入口，validator 也会在 family gate 拒绝未接入法术。
- 冲锋陷阵仍按旧排除口径处理：当前标准法术书会拒绝 legacy casts；其施法 family 可投影为 inactive ChoiceRequest 合同，但所有候选会因 `spellNotInPresetSpellbook` disabled，不会生成 AI 合法动作，也不会被 Board 当成可施放。
- 其它响应、多目标批量选择、替代、防止或长事务仍保留旧 UI 兼容路径，后续需要按各自目标结构迁移。
- 当前试点覆盖女祭司恢复、对象主动能力 Board 消费路径、兽性觉醒、荒野呼唤确认施法、昏睡、汲血之击、普通直接攻击法术、气流对象 / 玩家推移目标、隐藏响应结界施放目标、单体治疗、生命汲取、溶解、驱散、爆炸、缠绕藤蔓、剧痛难当攻击骰负修正、死亡链接维持治疗转移、法师祸咒施法后强制伤害触发、腐化 / 燃烧维持伤害、显性结界维持直伤、恶魔胸甲反伤屏障、显性对象结界、显性区域结界、推斥、传送、区域攻击、区域治疗、生物召唤、墙体法术、普通装备自目标、元素魔杖施放绑定、结界窃取、连锁闪电目标链、隐藏响应结界响应窗口、反击、防御、维持费用和睡眠受伤替代；其它主动技能、响应、替代、防止和长事务仍需按命中需求逐项迁移，不能从本试点外推为 Mage Wars 全量完成。

## 当前验证

- `Board.fx.test.tsx` 覆盖 Force Push 已有 ChoiceRequest 合同时，点击不在候选中的目的地区域不会派发旧拼装的 `CAST_SPELL`。
- `Board.fx.test.tsx` 覆盖荒野呼唤 confirm ChoiceRequest 被 disabled 时，点击准备法术不会派发旧无目标拼装的 `CAST_SPELL`。
- `ability-catalog.test.ts` 覆盖普通直接攻击法术、气流对象 / 玩家推移目标、隐藏响应结界施放目标、单体治疗、生命汲取、普通装备自目标、剧痛难当、死亡链接、恶魔胸甲和元素魔杖施放绑定的 ChoiceRequest 候选、direct selection 投影和 AI legal-action 投影。
- `ability-catalog.test.ts` 覆盖 `2800` 生物召唤、`1701` 区域攻击、`3405` 区域治疗和 `1913` 显性区域结界分别落到具体 family，且不会退回粗 `zone-target`。
- `ability-catalog.test.ts` 覆盖未进入施法 family 的 `1804` 如果绕过验证直达 `executeMageWarsSpellAbility`，执行层会抛出合同错误，防止 unsupported 法术被空事件伪装成已执行。
- `ability-catalog.test.ts` 覆盖 legacy 冲锋陷阵仍能投影 inactive ChoiceRequest 合同，但候选因 `spellNotInPresetSpellbook` disabled 且 AI 不生成合法动作；同文件也覆盖显性区域结界 `1913` 的 `select-zone` 施法候选。
- `domain-flow.test.ts` 覆盖标准法术书内但未进入施法 family 的 `1804` 法师祸咒会被 `spellRequiresCodeSupport` 拒绝，防止未迁移法术从旧 validator 尾部自然放行。
- `Board.fx.test.tsx` 覆盖生命汲取、火球术和厄运的玩家法师目标从 ChoiceRequest 玩家候选高亮并提交。
- `Board.fx.test.tsx` 覆盖气流先选对象或对方法师、再选合法推移区域并提交候选命令。
- `Board.fx.test.tsx` 覆盖皮革手套和恶魔胸甲的自方法师目标从 ChoiceRequest 玩家候选高亮并提交。
- `Board.fx.test.tsx` 覆盖元素魔杖点击自方法师后打开施法候选面板，选择绑定法术后提交候选 `CAST_SPELL` payload。`domain-flow.test.ts` 覆盖剧痛难当作为显性对象结界落场后，由结构化 `attackDice` 语义让该生物攻击少投 2 颗骰，且不依赖展示文案解析。
- `domain-flow.test.ts` 覆盖死亡链接在控制方法师有伤害时生成维持 ChoiceRequest，AI 合法动作包含 `heal-1` / `heal-2` / `skip`，选择 `heal-2` 后先生成 `UPKEEP_HEAL_TRANSFER_DAMAGE_AVAILABLE`，再由 TimingOpportunitySystem 让法师实际治疗 2 点、附着生物受到等量直接伤害；控制方法师无伤害时不创建阻塞选择。
- `domain-flow.test.ts` 覆盖 `flowHooks.onPhaseEnter(upkeep)` 只生成腐化、燃烧和显性结界直伤 available 事实，不再直接生成伤害、状态移除或击败事件；同文件覆盖完整管线仍由 TimingOpportunitySystem 结算腐化 / 燃烧 / 结界维持伤害。
- `domain-flow.test.ts` 覆盖 `resolveMageWarsObjectAttackEvents` 对恶魔胸甲只生成 `DAMAGE_BARRIER_AVAILABLE`，不再直接生成 `DAMAGE_BARRIER_TRIGGERED` 或反伤；完整管线仍生成反伤屏障触发、反伤伤害和 once-per-round 记录。
- `spell-caster-source.test.ts` 覆盖法师祸咒伤害由 TimingOpportunitySystem 在 `SPELL_CAST_RESOLVED` 后发现并生成；同文件也有负向断言证明旧 `createMageWarsInteractionSystem` 不再发现该触发。
- `npm run typecheck` 覆盖 validator family map、隐藏响应触发 helper 和施法执行入口的 TypeScript 合同。
- `npx vitest run src/games/mage-wars/__tests__/enchantment-response.test.ts src/games/mage-wars/__tests__/domain-flow.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 覆盖隐藏响应牌号收口后的法术反制、攻击反转和核心领域流，2 个文件、207 条用例。
- `npx vitest run src/games/mage-wars/__tests__/ability-catalog.test.ts src/games/mage-wars/__tests__/Board.fx.test.tsx src/games/mage-wars/__tests__/domain-flow.test.ts src/games/mage-wars/__tests__/enchantment-response.test.ts src/games/mage-wars/__tests__/spell-caster-source.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` 覆盖 5 个 Mage Wars 测试文件、296 条用例。
