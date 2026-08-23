---
name: smashup-faction-implementation
description: "Smash Up 派系玩法实现、旧派系参考、测试、E2E 与审计 workflow。"
---

# Smash Up 派系玩法实施工作流

## 适用范围

用于 Smash Up 新派系在 intake 完成后的正式玩法实施：运行时接入、ability / trigger / interaction / base ability 实现、共享机制复用、测试、E2E、evidence 和批量收口。本流程不重新裁定图片、atlas、资源真相源；这些属于 [`smashup-faction-intake`](../smashup-faction-intake/SKILL.md)。

进入 implementation 前必须已有 intake 合同和 handoff 包，至少包含主真相源、atlas 几何、row-major 索引、基地元信息、faction 清单、card/base canonical 名称、仍待裁定项和复用风险。intake 未收口时必须停下，不能边猜边做。

## 执行原则

- **连续推进**：用户给出“长期任务 / 继续 / 不要停 / 最后再总结”时，默认清空当前 scope；硬阻塞才停，并写清剩余对象和卡在哪层。
- **一次一个派系**：批量任务也按单派系闭环推进：实现、测试、E2E、evidence，再进入下一个派系；禁止多个派系同时改一半。
- **资源完成不等于玩法完成**：atlas、locale、选派系入口、静态数据或单测通过，只能证明结构或展示接通；玩法完成必须包含玩法实现、测试、真实入口和 evidence。
- **先复用共享机制**：优先查 `src/games/smashup/domain/`、`src/games/smashup/abilities/`、`src/games/smashup/__tests__/` 是否已有 bury / uncover、ongoing modifier、movement、destroy、duel、before/after scoring、response window 等机制；确实缺共享抽象时再扩展共享层。
- **共享重构默认允许**：确认共享抽象缺口后可直接做必要扩展，前提是服务当前和后续派系、不引入一次性硬编码、同步测试与 evidence，并说明影响范围。分支 / worktree / tag、删除本地数据等高风险动作仍需用户确认。
- **新派系 AI 走 outcome 合同**：新增行动牌、可发动能力或其它会消耗手牌 / 次数 / 资源的对象时，AI 收益判断必须复用 [`game-ai-strategy-design`](../game-ai-strategy-design/SKILL.md) 的共享 outcome 合同和 `smashUpAiRuntime.projectActionOutcome`；旧派系可按触碰范围逐步迁移，但新派系不得再为单卡补“零收益 / 无目标”特例。

## 批量重审模式

当任务是整批重审、重录或补证时：

1. 建立批次对象清单，粒度到单卡、单基地或单 effect atom。
2. 每项标注证据轴：`未核图 / 已核图 / 已修数据 / 已过最终状态 / 已过真实入口 / 已过生命周期`。
3. 用户说“继续”默认推进下一个未完成对象，不重复汇报上一个对象。
4. 抽样发现 HIGH / CRITICAL、语义反转、ID 漂移、注册不触发或旧测试沿错语义时，旧“全面 / 收口”结论失效，必须回到全量矩阵。
5. 批次清单仍有未完成对象时，只能写“仍有残余范围”。

`effect atom` 是重审最小单位。一张卡包含多个动作时，按目标选择、摧毁、额外打出、洗牌 / 重排等自然语义拆开；每个 atom 必须追到描述限定词、静态字段、command / validator、handler / reducer / trigger、UI / 交互出口、测试和证据。若测试断言沿错语义，测试本身就是 finding。

## 结论等级

对外汇报必须选择当前证据能支撑的等级：

- `结构审计通过`：静态接入、注册、`targetType`、`defId` 或结构测试通过；不证明玩法。
- `代表性玩法已验证`：有行为级测试和至少一条真实规则链路，但不是全对象覆盖。
- `当前发布口径已收口`：当前计划发布范围内，结构、行为、真实入口、生命周期和残余范围声明都闭合。
- `仍有残余范围`：仍有未审家族、共享根因、交互链或验证缺口。
- `旧结论失效`：旧 audit / rollup / closeout 被新证据推翻，必须回写原文档。

只说“审计 / 重审 / 收口审计”时，默认是对已锁定对象范围做对象级审计，不自动扩大到整批派系。只有所有对象都有对象级结论，或明确登记为共享链路完全同构、仅配置不同，才允许写“当前发布口径已收口”。

## 证据轴

每个派系对象默认按五层验收：

- **真相源**：卡图本体、中文名、`previewRef/index`、显示名与 canonical 名一致。
- **静态接入**：`defId`、locale、静态字段、注册入口、`targetType`、`abilityTags` 与合同一致。
- **最终状态**：单测 / 行为测试证明 reducer、helper 或 shared mechanism 语义成立。
- **真实入口**：从真实打牌、真实触发或真实响应窗口进入；对象、目标、支付物、顺序、数量和模式选择都必须由玩家手动选择，即使只有一个合法候选。
- **生命周期**：涉及 reaction、afterScoring、beforeScoring、uncover、discard special、ongoing talent、deferred 或多段交互时，必须观察 `finalState / triggerQueue / reaction session`。

新增交互类型、新 UI 或新操作方式时，必须至少补一条该类型的 direct E2E，覆盖真实入口和生命周期；共享证据只能在首条 direct 证据之后复用。最终验收必须给出 E2E 文件路径、至少一张本轮核对过的截图绝对路径，以及截图证明的新交互类型 / 新 UI 名称。

## 代表链复用

对象 B 复用对象 A 的真实入口 / 生命周期证据，必须同时满足：

1. 同一 handler / resolver / interaction family / finalize 链路。
2. 同一触发时机、窗口和流程态。
3. 同一资源消耗、使用限制和 skip / 拒绝路径。
4. 差异只限 `defId`、数值、筛选参数、文案或图集索引。

新增排序、多选、reaction、deferred、替代入口、额外清理或候选生成差异时，必须独立补对象级真实入口 / 生命周期证据。复用时仍要给对象 B 单独留 evidence 行，写清复用对象、判等依据和剩余差异。

共享合同可复用，但必须可追溯。对 `queueDeckMinionSearch`、`grantExtraMinion`、`buildValidatedDestroyEvents`、`deckReordered`、reaction session、ongoing power modifier、base afterScoring 等共享路径，应建立 shared-contract 证据；shared-contract 变更后，所有引用 atom 先标 `dirty`，重审后才能改回 `clean`。

## 实施步骤

### 1. 裁定边界

每个派系开工前写清：

- 哪些卡 / 基地直接复用现有能力。
- 哪些“同名但要重新核语义”。
- 哪些必须全新实现。
- 哪些机制要求修改共享层。
- 哪些对象需要新 UI / 新交互和 direct E2E。

### 2. 分三批推进

1. **配置复用**：id、`previewRef`、`abilityTags`、已有 handler 绑定。
2. **新机制 / 共享扩展**：shared helper、domain 抽象、interaction 链路。
3. **新 UI / 新交互**：交互组件、目标提示、阶段按钮、真实端到端验证。出现新类型必须有 direct E2E 和截图。

禁止把“机制未实现”或“UI 未接上”的残留留到派系完成后再补。

### 3. 静态接入与能力

常见落点：

- 基础接入：`src/games/smashup/domain/ids.ts`、`atlasCatalog.ts`、`data/cards.ts`、`ui/factionMeta.ts`、中英文 locale。
- 派系能力：`src/games/smashup/data/factions/<faction>.ts`、`abilities/<faction>.ts`、`abilities/index.ts`。
- 证据：`src/games/smashup/__tests__/*.test.ts`、`e2e/smashup/*.e2e.ts`、`evidence/smashup/*.md`。

### 4. 单派系验证

每完成一个派系，至少补：

- 相关 Vitest / GameTestRunner，证明核心规则链生效。
- 受影响的审计测试，证明结构接入未漏注册或漏声明。
- 至少一条关键真实交互 E2E，入口来自真实打牌、真实触发或真实响应窗口。
- 多段选择 E2E 必须逐段证明 `交互出现 -> 玩家点击候选 -> 下一段交互 / 结算`；不能只用最终状态或下一段 prompt 证明前一段选择。
- evidence 文档，写清结论等级、残余范围、共享根因；涉及反应窗、延迟结算、挖掘后续、计分后续或多段交互时，写出生命周期观察结论。

### 5. E2E 预检

新增或修改 E2E 场景前，先检查场景注入的所有 `defId` 是否在运行时 card registry 中存在。假 `defId` 导致的失败必须记为“场景真值错误”，不能混成玩法 bug。

## 专项门禁

### 联机 E2E phase

多人局 / 多客户端 E2E 里，若链路会推进到未连接页面的下一位玩家，不能把 `phase === 'playCards'` 当成默认正确结论。必须分别断言：

- 玩法 / 队列语义：`currentPlayerIndex`、`activeExtraTurn`、`pendingExtraTurns`、`triggerQueue`、`interaction.current` 是否按规则收口。
- 联机可见停点：下一位玩家未连接时，服务端停在 `startTurn` 可能是正常稳定点；这不等于玩法回退。

禁止把与当前 effect atom 无关的抽牌、洗牌、弃牌副作用塞进“回合切换是否正确”的主断言。

### 计分响应反馈

反馈属于 `scoreBases / Me First / afterScoring / smashup_reaction_choose`，且出现“让过又出现”“计分后卡死”“以前是手牌承接”“中间弹窗 / 提示层”“没有可选目标”“同一基地重复触发”时：

1. 先锁定是否同一基地同一响应帧：基地对象、reaction `frameId`、当前响应玩家、当前 `sourceId`。
2. 区分同一个 `afterScoring` 帧重复续链，还是一个效果结束后又进入下一个合法 `afterScoring`。
3. 锁定真正承接点击的是手牌、基地、随从还是系统 interaction；提示横幅 / 中间提示层默认只当提示 UI。
4. 修复后补一条最窄源码测试和一条回到用户原始位点的真实 E2E。
5. E2E 断言必须直接命中“不会再卡 / 不会再重开 / 不会再二次让过”，不能只看最终 phase。
6. 看图结论必须翻译成用户能判断的现象，不只写内部状态字段。

### reaction session

beforeScoring / afterScoring、挖掘后继续触发、special / ongoing / onUncover 派生交互，以及任何真实入口可能经过 `smashup_reaction_choose` 的 atom，都必须补看 reaction session；不能只看最终状态。真实入口出现 `smashup_reaction_choose` 时，evidence 必须截图或写明，并纳入当前 atom 生命周期结论。

### `targetType: 'generic'`

新增或调整 `targetType: 'generic'` 前，先判断能否收窄为 `hand`、`base`、`minion`、`player`、`button`、`field-source-target` 或 `field-source-action`。只有真实语义无法由对象本体承接时，才允许保留 `generic`。

保留 `generic` 必须满足其一：

- 选项形状能推导为牌池选择、埋葬牌、离场快照对象、复合上下文、模式、排序、卡牌与控制混合或定义选择。
- `createSimpleChoice` 显式声明 `genericIntent`，且意图属于上述通用语义。

禁止给单个 `sourceId` 增加 generic 白名单。`REQUIRED_SOURCE_CONFIGS` 只能锁确实特殊的 targetType / autoRefresh / responseValidationMode，不能证明 generic 合法。若 generic 带场上实体字段却不属于通用语义，必须改对象本体入口或拆步骤。

### 混源复刻批次

若某批次属于 mixed-source one-of deck 或同名复刻集合，不能因卡名和旧牌一样就直接复用旧 handler；必须逐张裁定直接复用、复制并改名或全新实现，语义一致后才允许别名复用。

## 批量统一收口

所有派系完成后，再做统一回归、批量 E2E、统一 evidence、服务器资源主源发布与公开 URL 回查。统一审计分两层：

- **本任务新增范围**：新增 / 修改派系相关能力、交互、`targetType`、`defId`、能力标签执行器覆盖；必须无新增失败，或失败已修复并复测。
- **历史基线债**：与本轮改动无关的旧失败单列追踪；不得写成本任务未完成，也不得伪装成审计全绿。

批量汇总只能在每个派系都有各自 evidence 后写。引用单派系结论时保留原等级；某派系只是结构审计通过，汇总也只能写到该等级。后续发现漏审、误判或假阳性时，必须回写原派系 evidence，并同步修订 rollup / closeout。

## 完成清单

- [ ] intake 合同与 handoff 包已存在。
- [ ] 单派系边界已裁定。
- [ ] 已按配置复用 / 新机制 / 新 UI + E2E 三批推进。
- [ ] 静态接入、ability、interaction、base ability 完成。
- [ ] 相关 Vitest、审计测试和关键 E2E 通过。
- [ ] evidence 已声明结论等级、残余范围和共享根因。
- [ ] 批量统一审计已区分本任务新增范围与历史基线债。
- [ ] 旧结论被推翻时，原 evidence 与汇总文档已回写。
