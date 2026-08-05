# Smash Up 派系玩法实施工作流

## 适用范围

适用于 **Smash Up 新派系在 intake 完成之后** 的正式玩法实施，覆盖：

- faction / card / base 的最终运行时接入
- ability / trigger / interaction handler / base ability 实现
- 共享机制复用与缺口补齐
- 单派系测试、E2E、evidence
- 批量派系任务的统一收口

本工作流**不负责**重新做一遍图片核对、atlas 索引裁定、资源 truth-source 合同；这些属于 intake 阶段。

本流程继承通用 `data-entry-workflow` 的 Spec 拆解模板（S0~S4），只是把其具体化到 Smash Up 派系实现。

## 前置输入（缺一不可）

进入 implementation 前，至少要有：

1. 一份已收口的 intake 合同文档
   - 必须写明主真相源、对照源、atlas 几何、row-major 索引、基地元信息
2. intake 已确认的 handoff 包
   - faction 清单
   - card/base canonical 名称
   - 仍待裁定项
   - 复用风险说明
3. 对应派系图片、locale、静态数据已接入或已明确待接入范围

若 intake 尚未收口，implementation 必须停下，不能边猜边做。

## 核心原则

### 0. 长期任务连续执行（强制）

- 用户明确给出“长期任务 / 继续 / 不要停 / 最后再总结”语义时，默认主流程必须持续推进到本轮 scope 完成。
- 除非出现硬阻塞（权限缺失、环境不可用、真相源冲突且无法裁定），否则不得在中间阶段以“进度确认”代替执行。
- 每次推进都必须产出可复查证据（测试结果、截图、evidence 文档、审计记录）并回填 planning 文件。
- 若当前是**批量派系重审 / 重录 / 补证**，必须先把“本轮批次剩余对象”写清；只要当前批次仍有未完成对象，就不得因为“刚补了 1-2 张”暂停。

### 0.1 批量派系重审 / 重录模式（强制）

当任务不是“新增派系初次实施”，而是对既有派系做**整批重审 / 重录 / 补证**时，额外遵守：

1. 先建立批次清单
   - 至少到单卡 / 单基地 / 单对象粒度
   - 每项标明当前状态：`未核图 / 已核图 / 已修数据 / 已过 L2 / 已过 L3 / 已过 L4`
2. 默认连续清空当前批次
   - 用户连续发“继续”时，语义是“继续做下一个未完成对象”，不是“继续汇报上一个对象”
3. 默认先修真相，再补证据
   - 先解决卡图/数据/语义偏差，再补对象级 L3/L4
4. 对象级补证不得偷换成整包收口
   - 只要批次清单里仍有未完成对象，就只能维持“仍有残余范围”
5. 每次停下都必须有剩余项清单
   - 若遇到硬阻塞或用户切换任务，必须明确写出“剩余哪些对象未做、分别卡在哪层”
6. 只有同链路纯配置差异才允许复用深层证据
   - 若两张卡/两个基地只是 `id/名称/文案/数值/目标枚举/筛选参数` 不同，而真实入口、validator、handler、resolver、reaction/queue 与清理链完全一致，才允许复用同一条 L3/L4 代表链
   - 只要多出额外子句、不同阶段、不同可选/强制语义、不同后续触发或不同拒绝路径，就必须分开补对象级证据

6. 抽样发现问题后必须回到全量矩阵
   - 如果抽样审计在已宣称“全面 / 收口”的批次里发现 HIGH/CRITICAL、语义反转、ID 漂移、注册不触发或测试仍沿旧语义，原完成结论立即失效。
   - 后续不能再用“抽样修完了”作为批次完成依据，必须先建立全量对象清单，再把每张卡 / 每个基地拆成 effect atom（效果原子）矩阵。
   - 全量矩阵每行至少覆盖：牌面或规则原文、原子语义、语义限定词、静态字段、注册入口、validator/canActivate、handler/trigger/reducer、UI/交互出口、测试证据、当前 L0-L4 层级和残余范围。
   - 只要矩阵里仍有对象没有展开 effect atom，或 effect atom 没有链路结论，就只能写“仍在全量重审”，不能写“全面审计完成”。

7. effect atom 是 Smash Up 全链路重审的最小单位
   - 一张卡若包含“选择目标 -> 摧毁 -> 额外打出 -> 洗牌”，至少拆成目标选择、摧毁、额外打出、洗牌/重排四个 effect atom；不能用一行卡牌结论覆盖全部效果。
   - 一个 effect atom 必须从自然语言语义走到最终权威状态：描述限定词 -> 静态字段 -> command/validator -> handler/reducer/trigger -> UI/交互出口 -> 测试/证据。
   - 语义限定词必须显式写出：你的/任意/其他玩家、至多/恰好/任意数量、可以/必须、代替/然后/直到回合结束、任意顺序/洗牌/放顶/放底。
   - 若测试断言沿用了错误语义，测试本身就是 finding，必须同步修正；禁止用“测试通过”覆盖语义错审。

8. 共享合同可以复用，但必须 dirty/clean 可追溯
   - 对 `queueDeckMinionSearch`、`grantExtraMinion`、`buildValidatedDestroyEvents`、`deckReordered`、reaction session、ongoing power modifier、base afterScoring 等共享路径，应建立 shared-contract 证据。
   - 每个 effect atom 行必须写明引用的 shared-contract、传入参数、上下文携带字段和独有风险；不得只写“复用共享 helper”。
   - shared-contract 变更后，所有引用它的 effect atom 必须标 `dirty`，并按影响面重审；只有本地参数和共享合同都重新核过，才能改回 `clean`。
   - “不用重复审计”的唯一合法方式是引用同一 shared-contract 的当前签名：合同 ID、关键函数/字段、dirty 条件、最后测试证据必须在 evidence 中可反查；本 effect atom 的本地限定词仍要单独核对。若本地限定词不同（例如 `immediate` vs `this turn`、`same name` vs 任意随从、`owner` vs `controller`），不能沿用旧结论。

### 1. 一次只做一个派系

批量任务也必须按单派系闭环推进：

1. 派系 A：实现 → 测试 → E2E → evidence
2. 派系 B：实现 → 测试 → E2E → evidence
3. 派系 C：实现 → 测试 → E2E → evidence
4. 最后再做统一审计与批量收口

禁止“三个派系同时改一半”后再试图一起救火。

### 2. 资源完成 ≠ 派系完成

以下都**不能**当成“派系已完成”：

- 只是 atlas / locale 已接入
- 只是 faction selection 能看到新派系
- 只是静态数据已录入
- 只是单测通过

只有当 **玩法实现 + 测试 + E2E + evidence** 都闭环后，才能说该派系完成。

### 2.1 审计结论必须分级（强制）

Smash Up 派系任务对外汇报时，至少要先判断自己处于哪一级，禁止再混成一句“已收口”：

- **结构审计通过**：只证明静态接入、注册、`targetType`、`defId`、审计测试通过。
- **代表性玩法已验证**：已经有行为级测试和至少 1 条真实规则链路被证明成立，但覆盖范围仍有限。
- **当前发布口径已收口**：当前计划发布的派系范围内，结构、行为、真实入口玩法、残余范围声明都满足门禁。
- **仍有残余范围**：已经修了一部分，但仍有未审家族、共享根因、未覆盖交互链或待补验证。
- **旧结论失效**：之前的派系 audit / rollup / final closeout 已被后续证据推翻，必须回写原文档。

### 2.1.1 “审计”默认含义与做到底门禁（强制）

- 在本工作流里，用户或任务只说“审计 / 重审 / 收口审计 / 深入审计”时，默认含义是**对象级彻底审计**，不是“每个派系挑几条代表链”。
- 对象级彻底审计的最低要求：当前批次每张新增卡、每个新增基地都必须有独立矩阵行，逐子句写出 L0/L1/L2/L3/L4 证据或阻塞原因。
- 若当前只完成代表性玩法验证、共享链路抽样或高风险交互抽样，必须在 evidence 标题、章节和最终汇报里显式写成“代表性验证”或“抽样审计”，不得简称“已审计完成”。
- 只有当所有对象都已达到对象级结论，或被明确登记为“共享链路完全同构，仅配置不同”的合法复用，才允许写“当前发布口径已收口”。

### 2.2 这些证据不能单独当玩法收口（强制）

以下情况最多只能写“展示已接入”或“结构已接通”，不能写“派系玩法完成”：

- 只能看到 faction selection、横幅、房间列表、资源展示的新派系 E2E。
- 只证明 `registerAbility`、静态覆盖、审计测试、`interactionCompletenessAudit` 没报新增失败。
- 通过状态注入、直接灌 `interaction`、从 prompt 已打开状态继续执行的注入型交互 E2E。
- 只证明 prompt 出现、按钮可点、toast 弹出，未证明真实入口和最终权威状态变化。

### 2.3 分层验收模型（强制）

Smash Up 派系对象在重审 / 重录 / 补证时，默认按以下层级验收：

- **L0 卡图/中文名/索引**
  - 卡图本体、中文名、`previewRef/index`、显示名与 canonical 名裁定一致
- **L1 locale / 静态数据 / 注册**
  - `defId`、locale、静态字段、注册入口、`targetType`、`abilityTags` 与当前口径一致
- **L2 领域行为**
  - 单测 / 行为测试证明 reducer、helper、shared mechanism 语义成立
- **L3 真实入口 E2E**
  - 从真实打牌 / 真实触发 / 真实天赋入口进入，不靠“prompt 预打开”的注入型捷径收口
  - 任何对象 / 目标 / 支付物 / 顺序 / 数量 / 模式选择都必须证明玩家手动选择；即使当前合法候选只有 1 个，也必须截图并断言该选择态真实停住，不能被 `autoResolveIfSingle` 或等价默认隐式代选吞掉。截图里的候选本体必须清楚无遮挡；如果被卡牌预览、hover 特写、displayCard、提示浮层或 HUD 遮住，不能算该步 L3 证据。只有所有玩家决策都完成后的固定结果收口，才允许自动推进。
- **L4 流程态与权威状态**
  - 强制补看 `finalState / triggerQueue / reaction session`
  - 只要 effect atom 链路涉及 reaction / afterScoring / beforeScoring / uncover / discard special / ongoing talent，就必须按该 effect atom 补到这一层，不能只抽样同类对象

补充强制门禁：

- 只要本轮新增对象引入了**新的交互类型**或**新的 UI 表现 / 新的交互组件 / 新的操作方式**，就必须至少补 `1` 条该新类型 / 新 UI 的 direct L3/L4 E2E。
- 这条首个 direct E2E 不能被“同链路仅配置不同”的共享证据替代；共享复用只允许发生在该新类型 / 新 UI 已经有首条 direct 证据之后。
- 最终验收和对外汇报必须显式输出：
  - 对应 E2E 文件完整路径
  - 至少 `1` 张本轮实际核对过的截图绝对路径
  - 该截图所证明的新交互类型 / 新 UI 名称

规则：

- 只有 L0/L1 通过，最多只能写“结构已对齐”；
- 只有 L2 通过，最多只能写“行为级已验证”；
- 只有 L3+L4 补齐，才允许把单对象升级为“对象级正路径 L3/L4 证据”；
- 缺 L4 时，不得因为 E2E 通过就默认流程完整。
- L3/L4 的复用只允许发生在“共享链路完全同构，仅配置不同”的对象之间；否则即使入口类型相似，也必须单独做对象级 L3/L4。

### 2.4 Smash Up 联机 E2E phase 门禁（强制）

多人局 / 多客户端 E2E 里，只要链路会把当前回合推进到**未连接页面的下一位玩家**，就不能把 `phase === 'playCards'` 当成默认正确结论。

必须先区分两类语义：

1. **玩法/队列语义**
   - 例如当前玩家是否已切到正确的 `currentPlayerIndex`
   - `activeExtraTurn` / `pendingExtraTurns` / `triggerQueue` / `interaction.current` 是否已按规则清空或推进
2. **联机可见停点语义**
   - 若下一位玩家没有真实连接页面，服务端停在 `startTurn` 可能是正常稳定点
   - 这不等于玩法回退，也不等于“额外回合没收口”

因此，多客户端 E2E 断言 phase 时必须遵守：

- 若下一位玩家已连接并完成 `startTurn` 自动链，可断言进入 `playCards`
- 若下一位玩家未连接，默认先断言：
  - `currentPlayerIndex` 正确
  - `sys.phase` 至少停在符合该链路的稳定点（常见为 `startTurn`）
  - 该对象对应的 `interaction.current / responseWindow.current / activeExtraTurn / pendingExtraTurns` 已满足规则收口
- 禁止把与当前 effect atom 无关的抽牌/洗牌/弃牌副作用一并塞进“回合切换是否正确”的主断言里

典型例子：

- `Portal Room` 三人局只有两页在线时，赢家额外回合结束后若服务端已回到 `currentPlayerIndex=2` 且 `activeExtraTurn==null`，`phase='startTurn'` 可以是正常联机停点；不得误报为 extra-turn queue 回退。

### 3. 先复用共享机制，再补共享缺口

优先检查：

- `src/games/smashup/domain/`
- `src/games/smashup/abilities/`
- `src/games/smashup/__tests__/`

是否已有：

- bury / uncover
- ongoing modifier
- ongoing restriction / suppression
- movement / transfer / destroy / replace
- duel
- after scoring / before scoring / response window

若确实缺共享抽象，再补共享层；不要一上来在派系文件里堆私有硬编码。

## 典型文件落点

### 基础接入

- `src/games/smashup/domain/ids.ts`
- `src/games/smashup/domain/atlasCatalog.ts`
- `src/games/smashup/data/cards.ts`
- `src/games/smashup/ui/factionMeta.ts`
- `public/locales/zh-CN/game-smashup.json`
- `public/locales/en/game-smashup.json`

### 派系数据与能力

- `src/games/smashup/data/factions/<faction>.ts`
- `src/games/smashup/abilities/<faction>.ts`
- `src/games/smashup/abilities/index.ts`

### 测试与留证

- `src/games/smashup/__tests__/*.test.ts`
- `e2e/smashup/*.e2e.ts`
- `evidence/smashup/*.md`

## 执行步骤

### 1. 读取 handoff 包并裁定实现边界

每个派系开工前，必须先写清楚：

- 哪些卡是直接复用现有能力
- 哪些卡是“同名但要重新核语义”
- 哪些卡必须全新实现
- 哪些基地能力已有共享模板
- 哪些机制会要求修改共享层

### 2. 单派系内再拆三批子任务（强制）

每个派系实施时，必须再拆成以下三批并按顺序推进：

1. **可直接通过配置复用的一批**
   - 目标：先把可复用卡牌/基地快速接上，降低不确定性
   - 典型内容：id、previewRef、abilityTags、已有 handler 绑定
2. **需要新机制或共享层扩展的一批**
   - 目标：解决当前引擎/共享抽象无法表达的规则
   - 典型内容：新增 shared helper、补 domain 抽象、补 interaction 链路
3. **需要新 UI / 新交互表现的一批（含对应 E2E）**
   - 目标：把机制真正暴露为可操作、可验收的真实链路
   - 典型内容：新交互组件、可选目标提示、阶段按钮、真实端到端流程验证
   - 强制验收：凡是这一批里出现“新交互类型 / 新 UI”，都必须至少有 `1` 条首个 direct E2E，并在 evidence/最终回复中给出 E2E 文件完整路径和截图绝对路径

禁止把“机制还没实现”或“UI 还没接上”的残留留到派系完成后再补。

### 3. 先完成静态接入，再落能力

顺序建议：

1. faction id / atlas / metadata / locale
2. `data/factions/*.ts`
3. `abilities/*.ts`
4. `abilities/index.ts`
5. 必要的 domain / shared helper 调整

### 4. 共享缺口可直接扩展重构（默认授权）

当你在派系实施中确认存在共享抽象缺口时：

- 允许直接进行必要的扩展重构，不需要再逐次停下来确认
- 但必须满足：
  - 改动目的仅限“让当前与后续派系都可复用”
  - 不引入临时硬编码和一次性补丁
  - 同步更新受影响测试与 evidence
  - 在阶段总结中明确写清“为什么要改共享层、影响范围是什么”

仍需单独确认的场景：

- 分支/worktree/tag 操作
- 删除/清理本地数据
- 其他高风险不可逆操作

### 5. 单派系完成后立刻验证

每完成一个派系，至少做：

- 相关 Vitest / GameTestRunner，证明核心规则链确实生效
- 受影响的审计测试，证明结构接入没有漏注册或漏声明
- 至少 1 条关键真实交互 E2E，入口必须来自真实打牌 / 真实触发 / 真实响应窗口
- 涉及多段选择时，E2E 必须逐段证明 `交互出现 -> 玩家点击候选 -> 下一段交互 / 结算`，并覆盖单候选仍需手选的代表态；不能只用最终状态或下一段 prompt 存在来证明前一段选择合格
- 1 份 evidence 文档，明确写清当前结论等级、残余范围、共享根因
- 若该对象链路涉及反应窗、延迟结算、挖掘后续、计分后续或多段交互，evidence 必须显式写出 `finalState / triggerQueue / reaction session` 的观察结论

不能把验证全压到最后。

### 5.3 代表链复用边界（强制）

- 默认不允许用“同派系 / 同交互家族 / 同时机”这类粗粒度相似性，跳过对象级真实入口验证。
- 只有同时满足以下条件，才允许对象 B 复用对象 A 的 L3/L4：
  1. 同一 handler / resolver / interaction family / finalize 链路。
  2. 同一触发时机、同一窗口与同一流程态。
  3. 同一资源消耗、使用限制与 skip/拒绝路径。
  4. 差异仅为静态配置，例如 `defId`、数值、筛选参数、文案或图集索引。
- 只要对象 B 新增了排序、多选、reaction、deferred、替代入口、额外清理或候选生成差异，就必须独立做对象级 L3/L4。
- 复用时仍必须给对象 B 单独留一行 evidence，并明确写出：复用对象、判等依据、剩余差异。

### 5.1 E2E 场景 `defId` 预检（强制）

凡是 Smash Up 派系实现 / 重审里新增或修改 E2E 场景，必须先做：

1. 检查场景注入中所有 `defId`
2. 确认这些 `defId` 在运行时 card registry 中真实存在
3. 只有预检通过，才允许启动 Playwright

禁止：

- 用仓库里并不存在的 `defId` 造测试场景
- 把由假 `defId` 导致的失败误判成实现 bug

若场景因为假 `defId` 失败，必须在 evidence / findings 中单独记为“场景真值错误”，不能混写成玩法问题。

### 5.2 reaction session 抽样门禁（强制）

以下 effect atom 默认必须补看 `reaction session`，不能只看最终状态：

- beforeScoring / afterScoring
- 挖掘后继续触发的持续效果
- 通过 `special` / `ongoing` / `onUncover` 再派生下一段交互
- 任何你怀疑“单测看起来像直达，但真实入口可能先经过 `smashup_reaction_choose`”的链路

只要真实入口里出现 `smashup_reaction_choose`：

- 必须在 evidence 文档中单独截图或单独写明
- 必须把它记入当前 effect atom 的 L4 结论
- 不得继续沿用“单测观察面”替代浏览器真入口真相

### 6. 批量任务最后再做统一审计

当所有派系都已完成后，再做：

- 统一回归
- 批量 E2E 补充
- 统一 evidence 汇总
- 服务器资源主源发布与公开 URL 回查

#### 审计执行矩阵（强制）

统一审计时，必须把结果分成两层，避免“历史债”干扰本轮结论：

1. **本任务新增范围（硬门禁）**
   - 新增/修改派系相关能力、交互、targetType、defId、能力标签执行器覆盖
   - 必须达到“无新增失败”或“失败已在本轮修复并复测通过”
2. **全局历史基线债（单列追踪）**
   - 与本轮改动无关的历史失败可以保留，但必须单列成债务清单
   - 禁止写成“本任务未完成”，也禁止伪装成“审计全绿”
   - 对 `interactionCompletenessAudit` 这类历史债密集项，建议维护 `orphan/dynamic` 基线白名单：**当前基线允许存在，新增项必须失败**

最低产出要求：
- 一份专项审计文档：`evidence/smashup/<task>-audit-YYYY-MM-DD.md`
- 文档内必须包含：命令、结果、失败归因（本任务/历史基线）、结论等级、残余范围、后续动作

#### 统一收口口径（强制）

- 批量汇总文档只能在每个派系都已有各自 evidence 的前提下，才允许写汇总结论。
- 汇总文档引用单派系结论时，必须保留原等级；某个派系只是“结构审计通过”，汇总里也只能写到这个等级。
- 若后续发现某个派系存在漏审、误判或假阳性收口，必须回写原派系 evidence，并同步修订批量 rollup / final closeout，禁止保留旧“全部完成”摘要继续流通。
- 如果批量文档里存在“仅用代表性链路覆盖一部分对象”的情况，汇总结论只能写“代表性玩法已验证”或“仍有残余范围”，不得再写“已全面审计”“没有死角”或“当前发布口径已收口”。

#### `targetType: 'generic'` 门禁补充（强制）

凡是新增或调整到 `targetType: 'generic'` 的 `sourceId`，必须同步更新：

1. `src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts` 的 `REQUIRED_SOURCE_CONFIGS`
2. 同文件 `APPROVED_GENERIC_SOURCE_REASONS`（写清保留 generic 的语义理由）

否则 `interactionTargetTypeAudit` 会在“所有 generic targetType 都必须登记保留原因”处直接失败。

## 多 agent 使用建议

允许并行的通常是：

- 规则核对
- 索引合同整理
- 文档 / evidence 草拟
- 测试梳理

默认**不建议**多个 agent 同时写同一组核心文件：

- `ids.ts`
- `atlasCatalog.ts`
- `data/cards.ts`
- `abilities/index.ts`
- locale 主文件

如果要并行，必须先明确文件写入边界，避免互相覆盖。

## World Champs 额外规则

`World Champs` 默认按 **mixed-source one-of deck** 对待。

这意味着：

- 不能因为卡名和旧牌一样，就默认直接复用旧 handler
- 必须逐张写清：
  - 直接复用
  - 复制并改名
  - 全新实现
- 只有在语义已核对一致后，才允许别名复用

## 完成清单

- [ ] intake 合同与 handoff 包已存在
- [ ] 单派系边界已裁定
- [ ] 单派系已按“配置复用 / 新机制 / 新 UI+E2E”三批推进
- [ ] 运行时静态接入完成
- [ ] ability / interaction / base ability 完成
- [ ] 相关 Vitest 通过
- [ ] 关键 E2E 通过
- [ ] evidence 已留档，且已声明结论等级 / 残余范围 / 共享根因
- [ ] 批量统一审计完成（已区分本任务新增范围 vs 历史基线债）
- [ ] 若旧结论被推翻，原 evidence 与汇总文档已完成失效回写
- [ ] 若涉及资源运行时链路，服务器资源主源已发布并通过公开 URL 远端验证
