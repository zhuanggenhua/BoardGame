## 1. 重点机制审计与问题定位

### 1.1 Fate 当前骨架

- `src/games/fate-domination/domain/types.ts` 已有阶段、地点、玩家资源、手牌、事件、局势和代表性战斗结果。
- `src/games/fate-domination/domain/commands.ts` 已有身份选择、部署、移动、两张攻击牌选择、技能、阶段推进和战斗地点结算命令。
- 当前 `pendingChoice`、`activeAttackIds`、`selectedAttackIds`、`battleResult` 仍偏向 foundation demo，无法独立表达响应者队列、替代/防止、持续修正来源、父子结算帧和私有候选快照。
- 现有 `data/demo-data.ts`、`cards.ts`、`events.ts`、`situations.ts` 是 runtime 基线；intake Markdown 是作者源/证据合同，两者不能互相冒充。

### 1.2 跨游戏重点机制矩阵

本轮不再把少量卡牌抽样当作覆盖证明，而是按最容易击穿规则内核的机制族检查现有实现入口、注册表、测试和恢复合同。重点是“规则会改变、对象会换控制者、效果会复制、结算会递归”的路径。

| 游戏 / 证据 | 重点机制族 | 真实形状 | Fate 必须能表达 |
| --- | --- | --- | --- |
| Mage Wars：`domain/abilityCatalog.ts`、`objectAbilityRuntime.ts`、`responseResolution.ts` | 快速/正常行动、能力注册、状态 token、临时 trait、反击/响应 | 能力定义 + 约束 + Opportunity + ResponseWindow + modifier/status 生命周期 | 技能牌、令咒、宝具、战斗前后响应、临时战力和回合结束清理 |
| Cardia：`domain/abilityRegistry.ts`、`effectHost.ts`、`abilityExecutor.ts`、`abilities/group*.ts` | 资源、卡牌操作、持续效果、复制/分支、特殊效果 | registry + effect host + executor + 交互 handler，卡牌差异进入配置 | 局势/事件效果、从者技能、御主附属、抽弃/移除/复制和分支选择 |
| 七大恨：`domain/selectionBuilders.ts`、`battleInteractionBuilders.ts`、`battleForceOutcomes.ts` | 多步选择、战斗承诺、撤退/伤亡、私有/公共选择、复杂 follow-up | ChoiceRequest builder + live/snapshot selection + battle outcome builder + 领域事件 | 选择目标/数量/顺序、战斗承诺、败北/淘汰、战后续链 |
| Smash Up：`domain/abilityHelpers.ts`、`ongoingEffects.ts`、`ongoingModifiers.ts`、`reducer.ts` | on-play/on-score 触发、持续卡、保护/抑制、移动/摧毁/返回/控制权、额外行动、重算 | 触发队列 + response window + ongoing modifier + semantic selector/gateway + deferred follow-up | 卡牌触发、被动能力、场上附属、位置变化、替代/防止、结算后追加动作 |
| Cardia 复制链：`domain/abilities/group5-copy.ts`、`abilityExecutor.ts`、`integration-ability-copy.test.ts` | 复制即时能力、复制后继续交互、递归执行、复制限制、延迟效果 | 复制来源 + 执行者重绑定 + 复制事件 + 子交互/延迟 payload | 从者模仿技能、复制宝具、复制御主附属效果，并保留“谁发动/谁支付/谁选目标” |
| Smash Up 规则改写：`domain/ongoingEffects.ts`、`ongoingModifiers.ts`、`effectiveBaseAbilities.ts`、`baseRestrictions.ts` | 基地能力抑制、计分抑制、卡牌能力抑制、保护、限制、事件拦截、临时重算、POD 变体映射 | typed registry + source-aware filtered state + restriction/interceptor/modifier query | 禁止移动/出牌、关闭局势或地点能力、改变计分和触发条件、临时覆写规则 |
| Smash Up 借用/控制权：`borrowedTalentConsumerParity.test.ts`、`effectSemantics.ts`、`reactionSession.ts` | 借用持续能力、owner/controller/sourceController 分离、转移后仍可用、AI/Board 同源 | 控制者透镜 + provenance + 运行时语义 selector + 触发队列 | 从者被他人控制、附属卡转移、能力由当前控制者支付但由原持有者清理 |
| Betrayal 替代/分支：`eventRollReplacementModel.ts`、`eventEffectResolutionModel.ts` | 下一次检定替代、分支重算、延迟选择、多个后续子链和结果快照 | replacement state + materialized effect snapshot + deferred choice/follow-up | 改写攻击结果、改判技能检定、把结果改成另一种事件并保留原事件来源 |
| Fantasy Realms 变体/代理：`data/cards.ts`、`foundation.ts` | 实体卡牌定义替换、运行时代理、牌面定义与实例身份分离 | definition mapping + stable instance identity + source provenance | 复制/变身/替身类 Fate 卡牌，不能用新 `defId` 冒充原卡实例 |

### 1.3 结论

现有实现已经验证了这些机制是项目真实需求，不是未来假设。尤其是规则改写和复制链会同时跨越能力、对象、控制权、交互和结算恢复；只做普通即时效果、单层 modifier 和单次 response 仍然不够。框架应当统一“规则时点、能力来源、复制上下文、对象语义、控制权透镜、选择合同、结算恢复和可见性”，而不是统一所有游戏的具体规则文本。

## 2. 设计原则

1. **不新增第二套效果语言**：卡牌/技能定义使用现有 `AbilityDef`、effect primitive 和 executor registry；Fate 只定义自己的 effect union、trigger union 和 adapter。
2. **不把所有效果都做成同一种机制**：普通即时效果走 execute → events；需要触发/响应/替代/防止/持续/延迟时才进入 Timing/Opportunity/Resolution。
3. **事实与交互分层**：`G.core` 只保存可被规则、验证、AI 或胜负消费的事实；`G.sys` 保存 interaction、response window、resolution frame、undo、log 和 gameover。
4. **选择先于 UI**：所有玩家/AI 选择先建 `ChoiceRequest`，候选带稳定对象 ID、来源 provenance、可见性、min/max、跳过策略和最终命令；UI 只是承载。
5. **对象语义显式化**：`target`、`material`、`reference` 不混用；跨区、附属、移除、控制权变化和延迟交互必须携带稳定 `ObjectRef` / provenance。
6. **单一结算权威**：一条跨事件、交互、响应窗口和 deferred follow-up 的长事务只由 `ResolutionFrame` 拥有；游戏私有 pending 只能作为兼容投影，不能成为第二主链。
7. **规则改写显式化**：禁止卡牌直接改写 reducer 或打印定义；限制、抑制、保护、替代、阻止、费用/合法性/计分变更都必须通过来源明确、可排序、可过期的规则修改查询。
8. **复制上下文显式化**：复制不是简单替换 `abilityId` 或 `cardId`。必须保留原始来源、复制者、执行者、控制者、所有者、目标重绑定、成本/次数策略和复制深度。
9. **数据状态不越权**：`locked / partial / blocked / disputed / authority-summary` 由 intake 合同决定；未锁中文效果不能被 runtime 当作完整规则实现。

## 3. 目标架构

### 3.1 分层

```text
作者源 / intake 合同
        ↓
游戏数据 registry（定义、ID、资源、i18n、来源状态）
        ↓
Fate domain adapter（规则查询、能力 catalog、选择 builder、frame handler）
        ↓
共享引擎：Command → validate → execute → timing/opportunity → choice/response/resolution → commit → reduce
        ↓
playerView / AI view / referee view / EventStream / Board Surface
```

### 3.2 共享层职责

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| `src/engine/primitives` | AbilityDef、effect spec/application、modifier、ObjectRef/provenance、condition、damage/value breakdown | Fate 卡名、Fate 阶段、地点顺序、宝具语义 |
| `src/engine/systems` | Flow、Interaction、ResponseWindow、ResolutionFrame、Undo、ActionLog、EventStream、GameOver | 解释某张卡为何能打出、决定具体目标或替游戏补规则 |
| `src/games/fate-domination/data` | 御主/从者/卡牌/地点/事件/局势的作者源映射、来源状态和资源路径 | 运行时可变状态、UI pending、临时选择 |
| `src/games/fate-domination/domain` | Fate 规则事实、命令、事件、reduce、能力 adapter、时点发现、选择 builder、playerView | 直接拼 UI、等待动画、写第二份交互状态 |
| `src/games/fate-domination/Board.tsx` 与 Surface | 读取 view/read model、绑定正式命令、展示同源 interaction | 规则验证、效果结算、AI 合法性、私有信息猜测 |

### 3.3 Fate domain 目录建议

```text
src/games/fate-domination/domain/
  core-types.ts          # G.core 领域事实
  ids.ts                 # 稳定 ID / zone / source kind
  commands.ts            # 玩家意图
  events.ts              # 领域后果
  validate.ts            # 命令与 ChoiceRequest 活体性复核
  execute.ts             # 命令 -> 基础事件
  reducer.ts             # 事件 -> core
  setup.ts               # 确定性初始化
  view.ts                # 公共/私有/裁判视图
  rules/
    phaseRules.ts
    resourceRules.ts
    movementRules.ts
    battleRules.ts
    scoringRules.ts
  abilities/
    catalog.ts           # AbilityRegistry 入口
    executors.ts         # 只放真正命令式能力
    opportunities.ts     # TimingPoint -> Opportunity
    effects.ts           # Fate effect union 到共享 gateway 的 adapter
    copyContext.ts        # 复制/借用/代理执行上下文与循环保护
    ruleModifiers.ts     # Fate 规则改写到 modifier/restriction/interceptor 的适配
  interactions/
    choiceBuilders.ts
    responseBuilders.ts
    snapshots.ts
  resolution/
    frameKinds.ts
    handlers.ts
    battleFrame.ts
    responseFrame.ts
  selectors/
    targets.ts
    materials.ts
    visibility.ts
    controllers.ts       # owner/controller/holder/sourceController 透镜
    proxies.ts           # 打印定义、运行时实例、来源对象的分离
```

目录是职责建议，不要求一次性创建空文件。真实实现只在对应机制有已锁合同和消费者时落地。

## 4. 机制兼容合同

### 4.1 基础阶段 / 资源 / 区域

- 阶段、回合、行动顺序、部署、移动和资源支付属于 Fate domain 的常驻机制。
- 资源使用统一 `resourceId + amount + timing` 表达；魔力、令咒、战果不写成散落的布尔开关。
- 区域使用稳定 `ZoneRef` / `LocationId`；移动、部署、抽牌、弃牌、移除、附属和公开/私有区变化必须生成自足事件。

### 4.2 能力 / 卡牌 / 规则来源

- `AbilityDef` 负责能力身份、触发、条件、成本、标签、变体和效果定义。
- `AbilityRegistry` 负责可测试注册集合；`getRegisteredIds()` 纳入实体链完整性测试。
- 声明式效果优先交给共享 executor；只有流程差异真实存在时才注册命令式 executor。
- 同一能力只能有一条最终执行路径，不能声明式和命令式抢写同一事实。

### 4.3 时点 / 响应 / 替代 / 防止

Fate 第一批至少预留这些 TimingPoint：

| TimingPoint | 用途 | 典型能力 |
| --- | --- | --- |
| `phaseStart` / `phaseEnd` | 阶段开始/结束自动效果、清理、回合限制 | 御主被动、情况牌、回合结束弃置 |
| `before.play-card` / `after.play-card` | 出牌前替代、支付、出牌后触发 | 技能牌、宝具、附属卡 |
| `before.battle` / `after.battle` | 战斗前修正、响应、战后奖励 | 令咒、攻击修正、战果能力 |
| `before.elimination` / `after.elimination` | 淘汰替代、防止、代价和后续 | 身份卡、宝具、败北效果 |
| `before.commit-event` | 事件/局势效果的 replacement / prevention | 禁宝具、禁止移动、战场修正 |

- 没有玩家或 AI 输入的强制触发直接进入后处理。
- 有可选、响应、替代、防止时，先发现 `Opportunity`，再决定 ChoiceRequest、ResponseWindow、ResolutionFrame 或 EventCommit。
- 不能让响应者顺手推进阶段；“响应权限”和“阶段推进权限”分开。

### 4.4 持续效果 / 修正 / 生命周期

统一使用 `ModifierDef / AppliedEffectInstance / status tag / duration` 等稳定原语表达：

- instant：一次性修改资源、状态或区域。
- continuous：持续影响力量、费用、合法目标或可见性。
- temporary：直到回合/阶段/战斗/事件结束。
- delayed：当前事件后或下一阶段触发。
- replacement/prevention：在 EventCommit 前改变或阻止事件。

每个修正至少声明：来源、目标语义、叠加方式、优先级、生命周期、移除条件和 provenance。不要把“本回合 +2”“关闭后移除”“下一次战斗生效”散落到 UI 或 reducer 分支。

### 4.5 选择 / 多步 / 私有信息

每个 ChoiceRequest 必须声明：

- 当前决策者和授权来源；
- 选择 kind（玩家、卡牌、区域、数量、顺序、模式、确认/跳过）；
- live 候选或 snapshot 候选；
- `min/max/ordered`、是否可跳过；
- 来源对象和目标对象的 provenance；
- 解决命令、拒绝原因、恢复动作、AI 支持状态；
- 公共/私有可见性。

延迟到跨阶段、清场或响应窗口后才解决的选择，必须显式记录 snapshot 字段；只允许按 live state 重算的字段要单独声明。

### 4.6 战斗 / 伤害 / 计分 / 终局

- 战斗是一个 `ResolutionFrame` 候选，而不是单个 `BATTLE_RESOLVED` 事件包住所有逻辑。
- 战斗 frame 可包含：声明攻击、选择/确认攻击牌、计算修正、响应窗口、正式提交、结果公开、战果结算、败北/淘汰、战后触发。
- 力量/迅捷/魔术/宝具等 Fate 语义通过游戏层 `valueBreakdown` 和 modifier query 映射到通用数值管线；不能把属性规则硬编码到共享伤害 primitive。
- 终局通过 `G.sys.gameover` 唯一读取；淘汰、胜果和 tie-break 由 Fate domain 生成事实事件。

### 4.7 规则改写 / 限制 / 抑制 / 保护

规则改写不是“某张卡把 reducer 改一行”，而是一个带来源的规则查询层。Fate adapter 至少要能表达：

- `restriction`：禁止或限制出牌、移动、部署、支付、响应、发动能力；
- `suppression`：暂时关闭一张卡、一个地点、一个技能或一个触发源；
- `protection`：对摧毁、移动、影响、弃置或事件应用提供条件性保护；
- `interceptor`：在事件提交前把原事件替换、拆分、缩减、转向或阻止；
- `recompute`：按当前场面重新计算力量、费用、目标合法性、计分、触发可用性；
- `rule variant`：同一规则查询在不同来源、场景或变体下使用不同语义。

每个规则修改至少声明：`sourceRef`、作用域、适用查询、优先级、叠加/冲突策略、生命周期、移除条件、控制者透镜、可见性和审计标签。打印卡面、能力定义和对象身份保持不可变；规则查询返回应用过的修改器与来源，供 replay/referee/AI 复用。

Fate 不需要一个可以任意拼装规则的万能 JSON DSL。规则修改只允许通过已登记的 typed adapter 映射到 `ModifierDef`、`Opportunity`、`EventCommit`、restriction/interceptor 等已有原语。

#### 已确认的 Fate 真实效果锚点

以下是当前中文权威合同已经锁定、会直接约束移动/地点规则的效果，不是抽象假设：

| 来源 | 已锁定效果 | 需要的规则查询 |
| --- | --- | --- |
| `catalog/events-fuyuki-ocr.md`：固有结界 | 特殊攻击于此战场禁止打出；所有玩家不能移动至此地点，也不能离开此地点 | `canPlayAttack`、`canEnterLocation`、`canLeaveLocation` |
| `intake/rules/chm-进行一场圣杯战争.md` | 常规移动沿单向箭头、按路径支付；交战时不能常规移动；效果移动默认不花移动成本且无视交战 | `resolveMovementPath`、`resolveMovementCost`、`canNormalMove`、`movementMode` |
| `catalog/first-batch-master-aux-ocr.md`：宿敌 | 指定对象在自己回合不能从间桐雁夜所在战场离开 | `canLeaveLocation` 的对象/来源条件 |
| `catalog/first-batch-master-aux-ocr.md`：幕后主使 | 该玩家移动时可以无视交战状态 | `canNormalMove` 的 `ignoreEngagement` 修正 |
| `catalog/first-batch-servant-skills-ocr.md`：已锁令咒效果 | 从新都或深山町移动至任意位置，无视交战状态 | `resolveMovementDestination`、`ignoreEngagement` |
| `catalog/first-batch-master-aux-ocr.md`：刻印虫 | 常规移动每步额外耗 1 魔力 | `resolveMovementCost` 的 per-step 修正 |

因此 Fate 的第一条规则修改 seam 应该先落在“移动/地点规则查询”上，而不是先做泛化的任意规则脚本。建议的最小查询面是：

- `canNormalMove(actor, from, to, context)`；
- `canEnterLocation(actor, from, to, mode, context)`；
- `canLeaveLocation(actor, from, to, mode, context)`；
- `resolveMovementPath(from, to, mode, context)`；
- `resolveMovementCost(actor, path, mode, context)`；
- `canPlayAttack(actor, card, location, context)`；
- `resolveLocationKind(location, context)`（仅在后续有已锁定的地点类型转换效果时启用）。

`resolveLocationKind` 目前只作为未来接入口保留。`demo-data.ts` 里的“魔术工房变为战场”等文本仍要等对应 CHM/OCR 合同锁定后才能进入 authoritative executor，不能因为 demo 已有就提前当作规则事实。

### 4.8 复制 / 借用 / 模仿 / 代理对象

复制效果按“复制什么”分层，不允许用一个布尔值覆盖所有语义：

| CopyMode | 复制内容 | 必须重新决定 |
| --- | --- | --- |
| `effect-only` | 只复制一次即时效果 | 执行控制者、目标、成本、来源日志 |
| `ability-with-choice` | 复制能力及其 ChoiceRequest/ResponseWindow | 选择授权、目标重绑定、私有信息和后续 frame |
| `printed-card-proxy` | 临时把一张卡视为另一张卡的打印定义 | 代理期间的卡名、类型、触发、合法性、离场恢复 |
| `borrowed-ongoing` | 借用持续能力或场上附属效果 | `owner/controller/holder/sourceController`、清理和触发权限 |

复制执行上下文至少包括：

- 原始 `sourceRef`、原始 `abilityId` / `effectId`；
- 复制者 `copierRef` 与当前执行对象 `executorRef`；
- 当前 `ownerId`、`controllerId`、`holderId`、`sourceControllerId`；
- `targetPolicy`、`costPolicy`、`oncePolicy`、`visibilityPolicy`；
- `copyDepth`、`visitedKeys`、`parentFrameId`、`originEventId`。

“你/你的”“控制者”“拥有者”“这张牌”“另一张牌”等文本必须按 copy mode 重新绑定，不能沿用被复制能力的旧对象引用。被复制能力产生的交互、响应、延迟事件和子 frame 必须回到同一条 resolution 链。

递归复制必须有最大深度、访问键和循环拒绝事件。拒绝后要恢复父 frame，不能静默返回空事件，也不能让 UI 自己清除 pending。

### 4.9 所有权 / 控制权 / 持有者 / 来源控制者

- `owner` 表示对象或卡牌的规则所有者；`controller` 表示当前获得其使用权的一方；`holder` 表示当前承载对象的实体或区域；`sourceController` 表示产生这次能力/触发的控制者。
- 借用、转移、附属和代理对象必须保留这些字段的来源，不允许在 selector 中默认 `owner === controller`。
- 触发权限、支付资源、目标合法性、AI 可用性、离场清理和回合结束清理分别声明使用哪个控制者透镜。
- 运行时实例 UID、打印定义 ID、来源对象 ID 和当前代理 ID 必须分开；复制或变体不能通过替换 UID 伪造对象身份。

## 5. Fate 第一批 pilot 顺序

1. **S0 数据合同**：继续消费 intake authority-summary；blocked 对象不生成完整 runtime 效果。
2. **S1 基础流程**：setup、阶段、行动玩家、魔力/令咒、移动、区域与可见性。
3. **S2 攻击/战斗**：两张攻击牌、支付、暗置/公开、威力 breakdown、局势/事件修正、战斗 frame。
4. **S3 能力与规则修改**：从者/御主技能 registry、主动能力、被动能力、持续规则修正、限制/抑制/保护、技能区生命周期。
5. **S4 复制与响应链**：复制/借用/代理上下文、战斗前后响应、替代/防止、令咒和宝具的响应窗口、递归复制保护、父子 frame 恢复。
6. **S5 终局**：败北/淘汰、移除/继续游戏、11 回合终局、战果 tie-break、gameover。

每一阶段都要有：规则合同、命令/事件消费表、权限矩阵、正负路径测试、AI 合法动作和真实入口验证点。

## 6. 明确不做的框架化

- 不建立“所有卡牌都能用 JSON 自由拼装”的万能 DSL。
- 不把 `pendingChoice` 扩成另一套响应/结算系统。
- 不把 UI 设计稿里的布局对象直接作为 core state。
- 不把 TTS 英文或未锁中文效果直接提升成运行时规则。
- 不把每个游戏的独有规则硬塞入共享引擎。
- 不允许卡牌直接修改 reducer、打印定义或共享规则查询的全局注册表。
- 不允许用 `abilityId`/`cardId` 单字段替换伪装成复制；不允许无深度/无循环键的递归复制。
- 不允许把 owner、controller、holder、sourceController 合并成一个 `playerId`。

## 7. Capability Matrix

| Capability | 本 change | 原因 |
| --- | --- | --- |
| `action-log` | 仅消费现有底层接口 | 机制框架要求事件可审计，但不在本 change 新做 UI |
| `undo-system` | 仅消费现有底层接口 | ResolutionFrame / ChoiceRequest 需要可恢复边界，具体撤回 UX 后续补 |
| `audio-feedback` | 本轮明确跳过 | 不影响规则框架兼容性 |
| `game-ai-system` | 仅保留合法动作接口 | 所有 ChoiceRequest/Opportunity 必须可被 AI 消费，但策略实现另立 change |
| `tutorial-engine` | 本轮明确跳过 | 设计稿和教程流程另立 change |
| `debug-config` | 仅保留底层接口 | 只要求可记录机制诊断，不做玩家可见 debug UI |

## 8. 验收口径

- 重点机制矩阵能把规则改写、复制/借用、控制权、代理对象、响应/替代、延迟/嵌套等机制族逐项映射到唯一共享 owner 或 Fate adapter。
- 任一新增 Fate 卡牌能力都能回答：来源、时点、授权者、候选、成本、事件、生命周期、可见性、AI 支持和恢复点。
- 任一规则改写都能回答：作用域、优先级、冲突策略、过期/移除、受影响的规则查询、应用来源和审计证据。
- 任一复制/借用效果都能回答：复制模式、原始来源、复制者、执行控制者、目标重绑定、成本/次数策略、copy depth、循环政策和父 frame 恢复。
- 不允许通过新增 Fate 私有 `pending*`、第二注册表、UI 选中态或 afterEvents 兜底绕过共享机制。
- 设计稿变更不会改变 core state、命令、事件和 ChoiceRequest 的业务真相。
- 当前已完成移动/地点查询与共享复制上下文 pilot；复制、借用卡牌的 Fate 具体消费、响应、替代和未锁卡面效果仍未实现，不能提前算作完整运行时规则。

## 2026-10-20 接续实施锁定

最新用户要求：手牌中心40%/60%、扇形改并排、去额外金条；完成必要英雄、残留等新交互及黄金端到端。旧25%/75%视觉证据不覆盖本轮变更。

继续已有 owner，不重建Fate：计分归 battleAwards，回合清理/随机重洗归 roundLifecycle，权限由 commands、状态由事件落地，界面仍复用 HandSurface/地图目标/唯一阶段入口。阶段内逐人完成准备和战斗操作后才进入下一阶段，依据 CHM 回合结构，而不是最后行动者跳过所有人的战斗能力。

候选完整切片为士郎、韦伯、绮礼及卫宫、伊斯坎达尔、兰斯洛特。先核每张原文与费用符号，未核字段不实现或声称完成。升华仅由扩展莎士比亚激活（CHM 内容物介绍408–418），本切片不含该从者，不把升华当普通技能入口。

交互设计来源为 CHM 的阶段能力/目标/取消语义，以及现有Fate地图目标与单一确认区域：从已激活牌本体发动；无需选择的动作直接使用，需要目标的动作在现有牌桌或既有选牌层选合法候选，唯一提交扣费；取消不使用。复制只展示规则可见、合法来源，不能从隐藏手牌偷读。残留对象跨轮保持激活，关闭后才恢复归区和常规规则，相关选择、修改器与临时代理同时收口。多人私密选择交给规则指定本人，不从当前视角推导权限。

验收以自然11轮、规则状态与可见终局一致为主链；独立分支证明残留/关闭、复制/临时、私密信息、否决与陈旧目标。按e2e-verification独特UI策略采图，行为日志完整，纯数值与重复返回不另拍。

### 观战投影的最小共享扩展

旧共享默认是观战者读取完整 core；这与 Fate 的隐藏真名、手牌和暗置事件规则不符。保留所有既有游戏默认不变，仅增加可选 domain.spectatorView 覆盖；Fate 显式注册其既有公开投影。普通席位仍调用 playerView，未注册覆盖的观战仍走原路径，系统投影/归一化顺序不变。保护测试同时覆盖默认观战、显式覆盖、普通席位和 Fate 实际来源。Fate 的事件流/交互隐私只在游戏系统适配，不改变别的游戏的日志或选项。

### 战后可选恢复的既有链路接入（待实施）

- E18/E19 的自动魔力奖励只在所有战场胜负确定后结算，目标为仍在战场的参与者，败北不排除。E12 为各胜者独立选择恢复或不恢复，不共享第一人的选择。两者早于移人和弃事件。
- E12 窗口消费已提交的战后开始事实和当前 battle frame，经 `discoverTimingOpportunities` 产生 `choice-request`；候选及回合、frame、受益者来源由权威端冻结，不新建 `core.pendingAbility`。
- `ChoiceRequest` 的恢复/不恢复为显式选项，单选后确认；取消、超时及强制解锁不能丢失已提交的结算。guard 在 Undo 前验证 exact interaction ID、owner、round、frame、合法选项并拒绝客户端覆盖值。
- SimpleChoice(21) 产生已解析事件后，游戏适配需要在其后消费该系统命令，不能让它继续进入领域命令分发的 `unknownCommand`。响应处理位于 Timing(30) 之后、ResolutionFrame(35) 之前；先落地选择的领域事实，随后才统一生成淘汰及回合收口。
- 规则上下文通过 Fate 扩展的 `sys.interaction.data.fateContext` 显式承载 round/frame/recipient；选择结果消费已提交的 interactionData 中同一上下文。ChoiceRequest 诊断快照不得作为规则真相或回退来源，不能假设 ownerFrameId 被自动复制进结果。当前无正式 Fate AI adapter，必须如实声明 unsupported；共享适配的默认 semantic 不能冒充已接入。
- 此处只锁接入边界，尚无E12实现、界面或端到端完成结论。恢复实例范围与中文“恢复”语义一起核对，不把初始三枚擅自写成所有版本的全局上限。

## 2026-10-22 用户确认的出牌草稿与右侧技能合同

用户先要求确认前可任意撤回、预览威力且只在确认后同步，随后明确取消技能抽屉，技能牌右侧常显，推进操作在其上方。该最新指令替代旧双手牌比例布局，不替代规则。

客户端唯一草稿 owner 为游戏内 useFateAttackDraft；现有领域 attackSelection 提供纯临时投影和确认解析，validate/execute 共享正式规则。Board/Hand 只组合和触发，不能复制魔耗或威力公式。CONFIRM_ATTACK 新 payload 携带两张实例、暗置子集和回合，服务器从当前权威状态重算；旧空 payload 调用仍兼容。普通草稿不发送 SELECT_ATTACK_CARD，也不发送临时 UI 同步事件。

不改公共 transport。dispatch 无回执时不乐观清空草稿、不做无法解锁的 pending 锁；断线禁止提交，权威确认后清空，失败允许明确重试。双次命令不得重复扣费；严谨联网证据仍待真实端到端。
