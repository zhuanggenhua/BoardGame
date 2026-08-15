# 测试最佳实践

> 本文档补充 `docs/automated-testing.md`，专注于测试编写的常见陷阱和最佳实践。

## 目录

- [核心原则](#核心原则)
- [状态对象：Core vs MatchState](#状态对象core-vs-matchstate)
- [测试工具选择](#测试工具选择)
- [常见错误模式](#常见错误模式)
- [测试辅助函数](#测试辅助函数)

---

## 核心原则

### 0. 默认先跑增量测试

- 默认命令：`npm run test:changed`（基于 `origin/main` 只跑改动相关测试）
- 只有特殊情况（修改引擎/核心公共层、跨游戏联动验证、CI 回归、用户明确要求）时，才扩大到 `test:games:core` 或 `npm test`
- 目的：缩短反馈周期，优先发现当前改动引入的问题

### 0.1 重构前先锁“入口行为矩阵”

- 任何重构只要改到“用户入口路由”（例如手牌点击、按钮分流、交互弹层入口），必须先写出至少两类路径：`可执行主路径` 与 `不可执行但仍合法的兜底路径`（例如不可施放但可弃置）。
- 合并门禁判断时，禁止让“可施放/可支付”这类条件吞掉兜底动作（取消、弃牌、跳过、仅查看等）。
- 该类重构必须补自动化回归，至少覆盖：
  - 1 条主路径用例（功能照常可执行）
  - 1 条兜底路径用例（主路径不满足时仍能走替代动作）

### 0.1.1 完整流程默认拆成组合矩阵

- 一个游戏的“完整流程”默认不是单条自然长链，而是由几段可组合证明拼出来：
  1. `entry`：主页 / 房间 / 联机入口是否把用户送进正确的 `match`
  2. `opening`：进入 `match` 后首个可行动回合是否成立
  3. `midgame`：当前真正关心的抓牌、弃牌、等待态、reload、spectator 等中段语义
  4. `near-end`：终局前最后一步或最后一跳
  5. `review`：终局、复盘、刷新恢复是否一致
- 用户说“从开局测”时，默认先判断这里的“开局”是不是 `match` 内起始态；除非本轮目标就是入口合同，否则不要把主页/大厅前摇机械绑进来。
- 如果一条测试同时承担主页进入、房间同步、第二轮身份、AI 中段行为、终局前最后一弃、review、reload，默认已经拆层失败，应优先改成组合矩阵。

### 0.1.2 旧 UI 文案退场后，不得靠反向断言制造遗留

- 旧长句、旧提示正文、旧按钮名一旦已经从正式实现退出，测试不得长期保留“某旧文案不应出现”的精确反向断言，把它继续钉在仓库里。
- 这类场景应优先改成**当前正向合同断言**，例如当前短状态、当前按钮标签、当前结构边界、当前可见/不可见职责。
- 只有“缺席本身就是正式业务语义”的场景，才允许保留否定断言；否则默认视为测试在为历史实现守灵。

### 0.2 TDD 行为 seam 门禁

- 测试必须锁定公开行为，不默认锁内部实现形状。若一次重构导致大量测试跟着改，而用户可见/调用者可见行为没有变化，必须优先判断为“测试 seam 过浅”或“断言耦合内部结构”。
- 新增或修复测试时，先写清本用例保护的行为入口：命令入口、公开 API、真实 UI 入口、审计工厂或系统边界。禁止只因为某个内部函数方便调用就直接测它。
- 纯展示元数据默认不是阻断测试候选，例如图标映射、装饰色值、非语义视觉别名、仅用于展示的文案别名。此类问题默认用代码审查 + 最小视觉/交互核对收口，不要为了“防重复”直接把它们升成阻断测试。
- 只有当这类元数据本身承载稳定业务语义、跨多个入口复用且一旦变化就会直接破坏长期合同，或用户明确要求把它锁成合同，才允许把它写成自动化门禁。
- 交互链测试不得散落直读 `sys.interaction.current` / `queue` / `data.options`；应优先通过游戏专用测试 helper/facade 读取 prompt、选择 option、断言 source/候选/禁用状态。只有在测试目标就是 InteractionSystem 内部契约时，才允许直接断言内部字段。
- `vi.mock` / `spyOn` / `toHaveBeenCalled*` 默认只用于系统边界（网络、时间、随机数、文件系统、外部服务、浏览器 API）。项目自有模块之间的协作应优先通过输出状态、事件、可见 UI 或公开返回值证明。
- 禁止通过批量修改 expected 来“适配重构”。如果行为确实变化，测试名、证据文档或提交说明必须写清新行为依据；如果行为未变，应调整测试 seam，而不是让测试继续绑定内部实现。

### 0.3 统一测试分层

| 分层              | 默认用途                                                | 禁区                                             |
| ----------------- | ------------------------------------------------------- | ------------------------------------------------ |
| 逻辑/规则行为测试 | 验证领域规则、命令合法性、最终权威状态                  | 绕过真实命令链直接调用深层 helper 来证明完整行为 |
| 集成链路测试      | 验证 `executePipeline` / `execute()` / Interaction 链路 | 只断言某内部函数被调用                           |
| E2E               | 验证真实 UI 入口、交互可操作、关键视觉结果              | 重复铺满同类卡牌逻辑或代替业务状态断言           |
| 审计/属性测试     | 批量验证注册表、引用链、数据契约、规则覆盖              | 作为单个 bug 修复的唯一成功证据                  |
| 调试/临时测试     | 构造最小复现、定位根因                                  | 长期留在主测试集或作为收口证据                   |

### 0.4 `e2e/src` Junction 禁写

- `src/games/**/__tests__` 是游戏 Vitest 行为测试的权威来源。
- `e2e/src/**` 是本地 Junction 兼容入口，不再作为 Git 跟踪内容；禁止把任何文件通过镜像路径入库。
- E2E 文件需要引用源码时，必须按相对路径直接指向仓库根 `src/`，不得依赖 `e2e/src` 镜像。
- 后续拆分/迁移测试文件时，目标是减少镜像目录依赖，而不是继续扩写镜像测试。

### 0.5 测试文件组织门禁

- 新增游戏 E2E 必须放在 `e2e/<gameId>/` 下；根级 `e2e/*.e2e.ts` 只允许保留跨游戏/共享入口或尚未迁移的历史债务。
- 禁止为同一游戏继续制造“根级文件 + 子目录文件”双入口；迁移时应收敛到子目录版本，并用 `--list` 或目标 E2E 验证 Playwright 仍能发现规范文件。
- `e2e/<gameId>/legacy-root/` 仅用于安放从根目录迁出的历史 E2E 独有用例，保留覆盖但标明债务来源；新增用例不得进入该目录。
- 测试文件必须按行为簇命名和归档：能力簇、交互链、配置合同、页面行为、审计合同分别放到清晰目录或文件中。
- 禁止继续新增 `new*`、`misc`、`regression`、`feedback`、`fixes` 这类可无限吸纳场景的泛名测试文件；已有泛名文件只能迁出或收敛，不作为新增用例入口。
- Smash Up 的基地能力合同默认优先放到 `src/games/smashup/__tests__/bases/` 下的专项目文件；根级仅保留系统/集成/保护类白名单文件，禁止继续新增类似 `baseAbilitiesPrompt` 这种把多个基地合同塞在一起的聚合壳。
- 当一个测试文件已经覆盖多个无关派系、页面、反馈编号、规则簇或系统层，新增用例必须优先落到更聚焦的新文件；只有同一行为簇内的少量补充才允许追加。
- 拆分不是删除覆盖。迁移用例时必须保留该行为簇至少 1 条代表性路径，并运行迁出后的新文件；若原巨型文件仍保留大量相关场景，应按风险决定是否复跑原文件。
- 示例：Smash Up 音效配置测试应落到 `src/games/smashup/__tests__/audio/faction-audio-config.test.ts`，不再塞回 `newFactionAbilities.test.ts`。
- 自动门禁：`npm run test:structure` 会阻止新增根级游戏 E2E、`e2e/src/**` 镜像入库、临时/备份/测试输出文件入库、新增泛名测试文件、给旧泛名文件净增加内容，以及在非系统契约游戏测试里新增裸 `getInteractionsFromMS` / `prompt.data.options` / `SYS_INTERACTION_RESPOND` / `SYS_INTERACTION_CANCEL` / `sys.interaction.current` / `resolveAbility(...)` / `getInteractionHandler(...)` / `getAbilityRuntimePromptHandler(...)` 访问，也会阻止新增测试里的 `console.log/warn/error/debug` 调试输出。历史债务允许继续收敛；旧泛名文件净删减时只警告，迁出的新文件必须改走 facade。必要豁免必须显式设置 `ALLOW_TEST_STRUCTURE_DEBT=1` 并说明原因。
- 新增或迁出的游戏行为测试不得使用 `it.skip` / `test.skip` / `describe.skip`。如果旧测试是 skip，迁移时必须先补齐真实行为链路并跑绿；无法补齐时保留为历史债务并记录原因，不得把 skip 带进新的聚焦测试文件。

### 0.6 测试接口 / 行为端口门禁

- 每类高频测试对象都应有稳定的测试接口：游戏命令用 `GameTestRunner` / `runCommand`，交互 prompt 用游戏专用 prompt facade，UI 用真实 E2E 入口。
- 测试主体不应直接依赖内部结构字段，例如 `sys.interaction.current`、`queue`、`data.options`、内部 handler 调用顺序。确需测试内部契约时，测试文件名或 describe 必须写明它是在测系统契约。
- 业务/能力测试默认禁止新增 `getInteractionHandler(...)`、`getAbilityRuntimePromptHandler(...)` 直调。优先表达成真实 `trigger -> prompt -> respond`、真实命令入口，或通过 facade 读取 prompt 和选择 option。
- 业务/能力测试默认禁止新增裸 `resolveAbility(...)`。公开行为请走真实命令入口；确需保留 low-level ability executor 合同时，优先通过 `invokeRegisteredAbilityContract(...)` 进入，而不是在测试体中直接摸 ability registry。
- 业务/能力测试默认禁止新增原始 `resolveAbility` / `getInteractionHandler` / `getAbilityRuntimePromptHandler` 导入。若确实在测系统合同或低层注册表合同，也优先通过 `helpers.ts` 中的显式 contract helper 暴露测试入口。
- 只有三类场景允许保留 direct handler / runtime prompt handler：注册表存在性合同、PromptSystem/response chain 系统合同、通过测试 helper 显式封装的低层能力合同（例如 stale/runtime resolver/metadata 合同）。这类测试必须明确说明它锁的不是业务路径，而是底层合同。
- 即使是低层合同，也优先通过 `helpers.ts` 中的显式 helper（如 `invokeRegisteredAbilityContract`、`invokeRegisteredInteractionHandlerContract`、`invokeRegisteredRuntimePromptHandlerContract`）进入，不要在测试体里再次直接摸注册表 API。
- 测试默认禁止新增 `console.log` / `console.warn` / `console.error` / `console.debug` 作为调试壳层。需要保留失败上下文时，应改成更强的断言、`expect.fail(...)` 消息或证据文档，而不是把控制台当事实载体。
- `resolvePromptViaRegisteredHandler(...)` 不视为“真实交互入口”。这类 registered-handler 直调 helper 已作为旧 seam 收口，不应再新增或恢复；需要系统级/低层合同时，优先使用显式 contract helper、`resolveSmashUpReactionChoice(...)`，或真实 `respondToPrompt/respondToPromptOption(s)`。
- 如果一次实现重构导致大量测试改 `option` 读取方式、prompt 字段名、命令 payload 形状或内部 helper 调用，应先新增/调整测试接口层，再迁移用例，禁止在每个测试里重复适配。
- 新增测试接口要放在对应游戏的 `__tests__/helpers.ts` 或更聚焦的 helper 文件中；测试用例只表达“选择某张牌 / 某玩家 / 某基地 / 某模式”，不表达 InteractionSystem 如何存储这些选项。
- 示例：Smash Up 交互测试优先使用 `getSimpleChoicePrompt`、`getPromptOption`、`getPromptOptions`、`respondToPrompt`、`respondToPromptOptions`、`cancelPrompt`，而不是在测试体中散落 `prompt.data.options.find(...)` 或手写系统交互命令。

### 0.7 测试便利不得擅自新增产品入口

- 当用户目标是“让我能测”“给我一条可重复测试路径”“AI/联机/教程要方便验证”时，默认优先复用**现有正式产品入口**、既有配置项或既有房间流程，例如 `创建房间 -> 开启 AI`、既有 debug/test helper、既有 query 合同、既有测试模式按钮。
- 不得把“测试不方便”“建房步骤多”“想更快到达场景”直接升级成新增首页按钮、详情页捷径、房间外独立入口、额外导航项或新的产品流。
- 只有两种情况允许新增可见入口：
  - 用户当轮明确要求新增该入口，并接受它成为产品功能；
  - 现有正式入口根本无法表达该能力，且已经给出证据说明为什么既有入口、配置项、测试 helper 都不足以承接。
- 若为了验证需要更快到达目标状态，优先顺序固定为：`既有正式入口` → `测试模式/状态注入/代表态` → `项目已存在的调试入口`；不得跳过这三层直接做新入口。
- 验收时必须明确区分“为了测试补了验证手段”与“产品新增了用户可见入口”。如果变更会改变首页、详情、房间、导航、常驻按钮或用户操作漏斗，就不再属于纯测试辅助，必须先获得用户确认。

### 0.2.1 runtime callback seam 门禁

- 只要实现经过 `prompt -> onResolve -> helper`、`reaction choose -> resolver`、`branching choice -> handler`、`custom action -> resolve` 这类分段 callback seam，测试最少要覆盖一条“入口触发 + resolve 结算 + 最终 reduce 状态”的完整链，不能只测 prompt 创建或 options 生成。
- 当一次重构把内联事件改为 shared helper / primitive 时，必须新增或升级测试，打到 helper 真正执行的那一层。只看入口、不看最终 `CARDS_DRAWN` / `DECK_RESHUFFLED` / 伤害 / 资源变化 / 阶段推进，默认视为测试链路不完整。
- 对于声明层本身不拥有随机或时序语义、只是声明“抽牌/摸牌/结算/造成伤害/重掷/目标选择”的场景，优先使用接受整份 runtime args/context 的 helper，避免每个 `onResolve` / `resolve` 手写解构 `random`、`timestamp`、`matchState`。只有规则本身真的拥有随机、洗牌、排序、多次消费顺序等语义时，才在 callback 层显式消费这些 runtime 依赖。
- 职责边界统一约束为三层：声明层只表达意图与业务参数；runtime seam 层负责携带本次交互上下文；primitive / helper 层负责消费运行时依赖并产出权威结果。测试应该优先保护这个边界，而不是默许声明层直接手拼底层依赖。

### 1. 使用正确的测试工具

| 场景         | 推荐工具                                                                                                                          | 原因                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 游戏逻辑测试 | `GameTestRunner`                                                                                                                  | 完整模拟引擎管线，自动处理状态初始化                           |
| 单个能力测试 | `runCommand` (testRunner.ts)                                                                                                      | 简化的命令执行，自动包装 MatchState                            |
| 基地能力测试 | `triggerBaseAbilityWithMS` (helpers.ts)                                                                                           | 自动注入 matchState                                            |
| 低层合同测试 | `invokeRegisteredAbilityContract` / `invokeRegisteredInteractionHandlerContract` / `invokeRegisteredRuntimePromptHandlerContract` | 显式锁能力注册表、prompt resolver、非法值、metadata 等底层合同 |
| UI 集成测试  | Playwright E2E                                                                                                                    | 状态注入或真实链路的浏览器级验证                               |

### 1.1 E2E 去重与分层

- 本项目默认把 `E2E / 端到端` 理解为**基于状态注入的浏览器级验证**：允许使用 `GameTestContext.setupScene(...)` 构造场景，重点证明 UI 布局、入口可操作、交互组件和最终可见结果。
- 只有用户**明确要求真实链路**时，才把 E2E 提升为“从真实玩法入口自然走到目标 prompt / 结算结果”的链路验证；这类用例标题、evidence 和汇报里都必须显式写 `真实链路`，不能和默认状态注入 E2E 混叫。
- 如果测试直接 `patch`/注入某个 prompt、interaction 或阶段，只能表述成“状态注入 E2E / 状态注入布局验证 / 中间态验证”；不得把它写成“真实链路已验证”。
- Playwright CLI、Browser snapshot 或其他临时浏览器自动化，只能用于复现、定位、截图和 trace；它们不能自动等同于“项目已新增正式 E2E 覆盖”。
- 某次 CLI 排查里“点通了流程”只能证明当前复现/定位成功；若需要长期防回归，仍必须把覆盖沉淀到项目 Playwright E2E 用例，并按现有项目命令和配置执行。
- E2E 的目标是验证真实 UI 入口、交互链是否可操作、以及最终可见结果是否完整，不是把同一种交互模式在不同卡上重复铺满。
- 同一种交互模式通常只保留 1 条代表性完整流程；只有当入口位置、控件形态、链路阶段、布局风险或跨系统协作明显不同，才新增第二条 E2E。
- 写完整流程 E2E 前必须先锁定规则时序家族，例如 `先选择后投骰`、`先投骰后选择`、`投骰后直接结算`、`可选是否触发`。不同家族不能互相代表；测试标题、截图名和 evidence 必须写清本用例证明的是哪一种时序。
- 完整流程的状态覆盖、截图证据资格和用户目标对账统一由 [`.spec/knowledge/standards/e2e-verification.md`](../.spec/knowledge/standards/e2e-verification.md) 承载；本文只规定测试如何分层、如何选工具和如何表达测试 seam。
- `passed` 只证明测试命令通过，不自动等于 E2E、截图或 UI 验收通过；截图资格、真实链路和玩家视角判定必须按 `.spec` 的 E2E / UI 验收入口裁决。
- 如果测试只验证“交互出现”“可以进入下一步”“某个中间选择器可点”，标题必须明确写成中间态/入口验证，不能写成已经完成整条能力效果。
- 业务最终状态、事件顺序、边界分支优先交给 `GameTestRunner` / smoke；E2E 只保留对 UI 和真实链路有独立价值的代表性流程。

### 1.2 E2E 语言基线

- 本项目 E2E 默认使用中文环境（`zh-CN`），断言优先对中文可见文案建立，不再把英文当默认基线。
- 设置语言时必须优先使用 `e2e/helpers/common.ts` 提供的 `setChineseLocale` / `setTestLocale`，不要在单个测试里继续手写 `localStorage.setItem('i18nextLng', 'en')` 这类散落注入。
- 注入语言时要同时写入 `bg_locale_preference` 与 `i18nextLng`，避免页面继续被旧缓存、浏览器语言或历史英文偏好劫持回英文。
- 只有在“显式验证英文文案切换”或“做双语回归”时，才允许单独切到英文；此时测试标题必须写明“英文”或“双语”，避免后续把英文链路误当默认行为。
- 如果页面真实默认应为中文，就不要再用英文选择器兜底通过；这类兜底会掩盖“页面被旧语言缓存劫持”或“测试自己强制切英文”的回归。
- 新增 E2E 时，截图里会出现的标题、按钮、占位文案、提示语也应优先断言中文，避免测试虽然跑在中文环境里，代码却继续围绕英文文案编写。

### 1.3 E2E 真实点击规则（强制）

- 交互测试里，禁止使用 `locator.evaluate((el) => el.click())`、`page.evaluate(() => element.click())` 这类“页面内脚本点击”绕过可点击性校验。
- 必须优先使用 Playwright 原生交互：`locator.click()`（必要时配合 `scrollIntoViewIfNeeded()`、更精确定位器或显式等待）。
- 这条红线同样适用于 Playwright CLI / Browser snapshot 排查：默认使用 `click`、`fill`、`press`、`hover` 等用户级动作，不得用 `eval`、`run-code`、页面内脚本点击来伪造“已可交互”。
- 若点击失败，先修定位器/层级/遮挡/时序，不得用 `evaluate(...click())` 掩盖真实交互问题。
- `evaluate` 仅可用于“读取/观测”类操作（如 DOM 状态采样），不用于触发用户交互。

### 2. 永远不要直接调用 domain 层函数

❌ **错误**：

```typescript
const core: SmashUpCore = { players: {...}, bases: [...] };
const events = SmashUpDomain.execute(core, command, random);  // 类型错误！
```

✅ **正确**：

```typescript
const core: SmashUpCore = { players: {...}, bases: [...] };
const matchState = makeMatchState(core);  // 包装为 MatchState
const events = SmashUpDomain.execute(matchState, command, random);
```

✅ **更好**：

```typescript
// 使用 testRunner 的 runCommand，自动处理状态包装
const result = runCommand(matchState, command);
```

---

## 状态对象：Core vs MatchState

### 类型定义

```typescript
// Core：游戏领域状态（玩家、基地、手牌等）
interface SmashUpCore {
  players: Record<PlayerId, PlayerState>;
  bases: BaseInPlay[];
  turnOrder: PlayerId[];
  // ... 游戏特定字段
}

// MatchState：完整对局状态（Core + 系统状态）
interface MatchState<TCore> {
  core: TCore; // 游戏领域状态
  sys: SystemState; // 引擎系统状态（interaction、phase、undo 等）
}

// SystemState：引擎层管理的状态
interface SystemState {
  phase: string;
  turnNumber: number;
  interaction: {
    current?: Interaction;
    queue: Interaction[];
  };
  undo: { snapshots: Snapshot[] };
  eventStream: { entries: EventEntry[] };
  actionLog: { entries: ActionEntry[] };
  responseWindow: { current?: ResponseWindow };
  // ... 其他系统状态
}
```

### 为什么需要 MatchState？

1. **引擎系统依赖 sys 字段**：
   - `InteractionSystem` 需要 `sys.interaction` 存储交互队列
   - `FlowSystem` 需要 `sys.phase` 管理阶段流转
   - `UndoSystem` 需要 `sys.undo` 存储快照

2. **能力函数需要创建交互**：

   ```typescript
   // 能力函数内部调用 queueInteraction
   const interaction = createSimpleChoice(...);
   const updatedState = queueInteraction(matchState, interaction);
   // ↑ 需要 matchState.sys.interaction
   ```

3. **防止状态不一致**：
   - 裸 `core` 对象缺少 `sys` 字段
   - 能力函数尝试访问 `state.sys.interaction` → `undefined` → 崩溃

### 何时使用哪种类型？

| 场景               | 使用类型                  | 原因                           |
| ------------------ | ------------------------- | ------------------------------ |
| 测试初始化         | `SmashUpCore`             | 方便手写测试数据               |
| 传递给 domain 函数 | `MatchState<SmashUpCore>` | domain 函数签名要求            |
| 断言游戏状态       | `SmashUpCore`             | 只关心游戏逻辑，不关心系统状态 |
| 检查交互           | `MatchState<SmashUpCore>` | 需要访问 `sys.interaction`     |

---

## 测试工具选择

### GameTestRunner（推荐）

**适用场景**：

- 完整游戏流程测试
- 多命令序列测试
- 需要验证状态变化的测试

**优点**：

- ✅ 自动初始化 `MatchState`
- ✅ 自动执行完整管线（validate → execute → reduce → postProcess）
- ✅ 支持命令序列
- ✅ 清晰的错误信息

**示例**：

```typescript
import { GameTestRunner } from "../../../engine/testing";
import { SmashUpDomain } from "../domain";

const runner = new GameTestRunner({
  domain: SmashUpDomain,
  playerIds: ["0", "1"],
  assertFn: assertSmashUp,
});

const testCases = [
  {
    name: "打出随从",
    commands: [
      {
        type: "PLAY_MINION",
        playerId: "0",
        payload: { cardUid: "m1", baseIndex: 0 },
      },
    ],
    expect: {
      minionsOnBase: [{ baseIndex: 0, count: 1 }],
    },
  },
];

runner.runAll(testCases);
```

### runCommand（简化版）

**适用场景**：

- 单命令测试
- 需要检查事件列表的测试
- 需要访问 `sys` 状态的测试

**优点**：

- ✅ 自动包装 `MatchState`
- ✅ 返回完整结果（success、events、state）
- ✅ 比 GameTestRunner 更灵活

**示例**：

```typescript
import { runCommand } from "./testRunner";
import { makeMatchState, makeState } from "./helpers";

const core = makeState({/* ... */});
const matchState = makeMatchState(core);

const result = runCommand(matchState, {
  type: "PLAY_MINION",
  playerId: "0",
  payload: { cardUid: "m1", baseIndex: 0 },
});

expect(result.success).toBe(true);
expect(result.events).toContainEqual(
  expect.objectContaining({ type: "su:minion_played" }),
);
```

### 直接调用 domain 函数（不推荐）

**仅在以下情况使用**：

- 测试 domain 层的纯函数（如 `reduce`、`validate`）
- 不涉及交互系统的简单测试

**必须手动包装 MatchState**：

```typescript
import { SmashUpDomain } from "../domain";
import { makeMatchState, makeState } from "./helpers";

const core = makeState({/* ... */});
const matchState = makeMatchState(core); // ⚠️ 必须包装

const events = SmashUpDomain.execute(matchState, command, random);
```

---

## 常见错误模式

### 错误 1：传递裸 Core 给 domain 函数

❌ **错误**：

```typescript
const core: SmashUpCore = { players: {...}, bases: [...] };
const events = SmashUpDomain.execute(core, command, random);
// TypeError: Cannot read properties of undefined (reading 'interaction')
```

**原因**：

- `domain.execute` 期望 `MatchState<SmashUpCore>`
- 传递裸 `core` 导致 `state.sys` 为 `undefined`
- 能力函数尝试访问 `state.sys.interaction` → 崩溃

✅ **修复**：

```typescript
const core: SmashUpCore = { players: {...}, bases: [...] };
const matchState = makeMatchState(core);  // 包装为 MatchState
const events = SmashUpDomain.execute(matchState, command, random);
```

### 错误 2：期望 execute 返回 { success, events }

❌ **错误**：

```typescript
const result = SmashUpDomain.execute(matchState, command, random);
console.log(result.success); // undefined
console.log(result.events); // undefined
```

**原因**：

- `domain.execute` 直接返回 `SmashUpEvent[]`
- 不返回包装对象

✅ **修复**：

```typescript
// 方案 1：使用 runCommand（推荐）
const result = runCommand(matchState, command);
console.log(result.success); // true/false
console.log(result.events); // SmashUpEvent[]

// 方案 2：直接使用返回值
const events = SmashUpDomain.execute(matchState, command, random);
console.log(events); // SmashUpEvent[]
```

### 错误 3：不使用 helpers.ts 中的工具函数

❌ **错误**：

```typescript
// 每个测试文件重复定义
function makeMinion(
  uid: string,
  defId: string,
  controller: string,
  power: number,
) {
  return {
    uid,
    defId,
    controller,
    owner: controller,
    basePower: power /* ... */,
  };
}
```

**问题**：

- 16+ 个测试文件重复定义相同函数
- 字段不一致（有的有 `powerModifier`，有的没有）
- 维护困难

✅ **修复**：

```typescript
import { makeMinion, makePlayer, makeState, makeMatchState } from "./helpers";

const minion = makeMinion("m1", "pirate_first_mate", "0", 3);
const player = makePlayer("0", { hand: [card1, card2] });
const core = makeState({ players: { "0": player }, bases: [base1] });
const matchState = makeMatchState(core);
```

### 错误 4：测试中不控制随机数

❌ **错误**：

```typescript
const result = runCommand(matchState, {
  type: "DRAW_CARDS",
  playerId: "0",
  payload: { count: 5 },
});
// 每次运行抽到的牌不同 → 测试不稳定
```

✅ **修复**：

```typescript
// 方案 1：使用固定随机数
const random: RandomFn = {
  random: () => 0.5,
  d: () => 1,
  range: (min) => min,
  shuffle: (arr) => arr, // 不洗牌
};

// 方案 2：使用确定性初始状态
const core = makeState({
  players: {
    "0": makePlayer("0", {
      deck: [card1, card2, card3], // 预设牌库顺序
    }),
  },
});
```

---

## 测试辅助函数

### helpers.ts 提供的工具

位置：`src/games/smashup/__tests__/helpers.ts`

#### 状态工厂

```typescript
// 创建最小可用的 SmashUpCore（双人）
const core = makeState({
    players: { '0': player1, '1': player2 },
    bases: [base1, base2],
});

// 创建带基地列表的 SmashUpCore
const core = makeStateWithBases([base1, base2, base3]);

// 创建带疯狂牌库的 SmashUpCore
const core = makeStateWithMadness({ madnessDeck: [...] });

// 包装为 MatchState（用于 validate/execute 测试）
const matchState = makeMatchState(core);
```

#### 实体工厂

```typescript
// 创建随从（常用签名）
const minion = makeMinion("m1", "pirate_first_mate", "0", 3);

// 创建随从（带额外字段）
const minion = makeMinion("m1", "pirate_first_mate", "0", 3, {
  powerModifier: 2,
  talentUsed: true,
});

// 创建玩家
const player = makePlayer("0", {
  hand: [card1, card2],
  vp: 5,
});

// 创建玩家（带自定义派系）
const player = makePlayerWithFactions("0", ["pirates", "aliens"], {
  hand: [card1],
});

// 创建卡牌实例（4 参数：uid, defId, type, owner）
const card = makeCard("c1", "pirate_first_mate", "minion", "0");

// 创建卡牌实例（3 参数：uid, defId, owner，默认 type='minion'）
const card = makeCard("c1", "pirate_first_mate", "0");

// 创建基地
const base = makeBase("test_base", [minion1, minion2]);
```

#### 事件应用

```typescript
// 应用事件列表到状态（通过 reduce）
const newCore = applyEvents(core, events);
```

#### 测试桥接工具

```typescript
// 低层合同测试：显式调用已注册的 continuation/runtime handler
const result = invokeRegisteredInteractionHandlerContract(
    'test_source',
    matchState,
    '0',
    { baseIndex: 0 },
    { continuationContext: {...} },
    Date.now(),
    random,
);

// 基地能力测试桥接（自动注入 matchState）
const result = triggerBaseAbilityWithMS('base_tortuga', 'afterScoring', {
    state: core,
    baseIndex: 0,
    playerId: '0',
    rankings: [...],
    now: Date.now(),
});

// 获取 BaseAbilityResult 中的所有 interaction（低层兼容工具）
const interactions = getInteractionsFromResult(result);

// 业务测试优先使用 prompt facade，不直接枚举 sys.interaction
const prompt = getSimpleChoicePrompt(matchState, 'alien_crop_circles');
const option = getPromptOption(prompt, option => option.value?.baseIndex === 0);
expectNoPrompt(finalState);

// 只有测试目标就是 InteractionSystem/queue 存储契约时，才直接枚举 interaction
const interactions = getInteractionsFromMS(matchState);
```

---

## 测试编写检查清单

### 开始编写测试前

- [ ] 确定测试类型（单元测试 / 集成测试 / E2E 测试）
- [ ] 选择合适的测试工具（GameTestRunner / runCommand / E2E）
- [ ] 检查 `helpers.ts` 是否有可复用的工具函数

### 编写测试时

- [ ] 使用 `makeMatchState(core)` 包装状态（如果直接调用 domain 函数）
- [ ] 使用 `helpers.ts` 中的工厂函数（不重复定义）
- [ ] 控制随机数（使用固定值或确定性初始状态）
- [ ] 断言具体字段（不只检查 `success: true`）
- [ ] 检查交互是否创建（如果能力应该创建交互）

### 测试失败时

- [ ] 检查是否传递了裸 `core` 而非 `MatchState`
- [ ] 检查是否期望错误的返回值类型
- [ ] 检查是否使用了真随机导致不稳定
- [ ] 检查是否缺少必需的系统状态初始化
- [ ] 使用 `console.log` 输出中间状态辅助调试

---

## 迁移指南：修复旧测试

### 步骤 1：识别问题模式

搜索以下模式：

```bash
# 直接调用 domain.execute
grep -r "SmashUpDomain.execute" src/games/smashup/__tests__/

# 期望 result.success
grep -r "result.success" src/games/smashup/__tests__/

# 重复定义工厂函数
grep -r "function makeMinion" src/games/smashup/__tests__/
```

### 步骤 2：修复类型错误

```typescript
// 修复前
const core: SmashUpCore = {/* ... */};
const events = SmashUpDomain.execute(core, command, random);

// 修复后
const core: SmashUpCore = {/* ... */};
const matchState = makeMatchState(core);
const events = SmashUpDomain.execute(matchState, command, random);
```

### 步骤 3：使用 runCommand

```typescript
// 修复前
const events = SmashUpDomain.execute(matchState, command, random);
expect(events.length).toBeGreaterThan(0);

// 修复后
const result = runCommand(matchState, command);
expect(result.success).toBe(true);
expect(result.events.length).toBeGreaterThan(0);
```

### 步骤 4：使用 helpers.ts

```typescript
// 修复前
function makeMinion(
  uid: string,
  defId: string,
  controller: string,
  power: number,
) {
  return {
    uid,
    defId,
    controller,
    owner: controller,
    basePower: power /* ... */,
  };
}

// 修复后
import { makeMinion } from "./helpers";
```

---

## 总结

### 核心规则

1. **永远使用 MatchState**：传递给 domain 函数时必须包装
2. **优先使用 GameTestRunner**：完整管线测试
3. **复用 helpers.ts**：不重复定义工厂函数
4. **控制随机数**：确保测试可重复
5. **断言具体字段**：不只检查 `success: true`

### 快速参考

| 需求         | 使用工具                                                                            |
| ------------ | ----------------------------------------------------------------------------------- |
| 完整流程测试 | `GameTestRunner`                                                                    |
| 单命令测试   | `runCommand`                                                                        |
| 创建测试状态 | `makeState` + `makeMatchState`                                                      |
| 创建测试实体 | `makeMinion` / `makePlayer` / `makeCard`                                            |
| 检查交互     | `getSimpleChoicePrompt` / `getPromptOption` / `getPromptOptions` / `expectNoPrompt` |
| 基地能力测试 | `triggerBaseAbilityWithMS`                                                          |

### 相关文档

- `docs/automated-testing.md` - 测试框架总览
- [`.spec/knowledge/standards/engine-systems.md`](../.spec/knowledge/standards/engine-systems.md) - 引擎测试工具规范
- `src/games/smashup/__tests__/helpers.ts` - 测试辅助函数源码
- `src/games/smashup/__tests__/testRunner.ts` - runCommand 实现

---

## 测试性能和超时

### 测试套件运行时间

项目包含大量测试，不同测试套件的运行时间差异很大：

| 测试套件         | 命令                             | 预计时间  | 说明                         |
| ---------------- | -------------------------------- | --------- | ---------------------------- |
| 单个测试文件     | `npm run test -- <file>.test.ts` | 10-60秒   | 最快，推荐开发时使用         |
| SmashUp 核心测试 | `npm run test:smashup`           | 2-3分钟   | 包含大量单元测试             |
| 所有游戏核心测试 | `npm run test:games:core`        | 3-5分钟   | 排除 property/audit/E2E 测试 |
| 所有游戏测试     | `npm run test:games`             | 5-10分钟  | 包含所有测试类型             |
| 完整测试套件     | `npm run test`                   | 10-15分钟 | 包含所有测试                 |

### Property-Based 测试

项目使用 `fast-check` 进行 property-based 测试，这些测试会运行多次（通常 100-200 次）：

```typescript
// 示例：运行 200 次
fc.assert(
  fc.property(arbBaseStrength(), (baseStrength) => {
    // 测试逻辑
  }),
  { numRuns: 200 },
);
```

**位置**：

- `src/games/summonerwars/__tests__/*.property.test.ts`
- `src/games/summonerwars/__tests__/deck-*.property.test.ts`

**影响**：这些测试会显著增加测试时间，但提供了更全面的覆盖。

### 超时配置

测试超时在 `vitest.config.core.ts` 中配置：

```typescript
test: {
  testTimeout: 180000,  // 3分钟
}
```

**注意**：某些 IDE 或 CI 工具可能有自己的超时限制（如 90 秒），需要单独配置。

### 开发时的最佳实践

1. **只运行相关测试**：

   ```bash
   # 只运行你修改的文件的测试
   npm run test -- myFeature.test.ts

   # 只运行特定游戏的测试
   npm run test:smashup
   ```

2. **使用 watch 模式**（开发时）：

   ```bash
   npm run test:watch
   ```

3. **不要提交新的 skipped 行为测试**：
   - 开发时只跑相关文件或用例，不要把 `it.skip` / `describe.skip` 当作性能优化手段提交进游戏行为测试。
   - 确实属于慢速专项的测试，应放入明确的 property/audit/E2E 配置，并通过专用命令运行；临时本地跳过不得入库。

4. **CI/CD 中运行完整测试**：
   ```bash
   # pre-push hook 会自动运行核心测试
   npm run test:games:core
   ```

### 性能优化建议

如果测试运行太慢：

1. **检查是否有无限循环**：
   - 使用 `console.log` 或调试器定位问题
   - 检查 `while` 循环的退出条件

2. **减少 property-based 测试的运行次数**（开发时）：

   ```typescript
   // 临时减少运行次数
   {
     numRuns: 10;
   } // 而不是 200
   ```

3. **使用测试分片**（CI 中）：

   ```bash
   # 将测试分成多个并行任务
   npm run test:smashup &
   npm run test:summonerwars &
   npm run test:dicethrone &
   ```

4. **排除不必要的测试**：
   - `vitest.config.core.ts` 已排除 audit/property/E2E 测试
   - 开发时使用 `test:games:core` 而不是 `test:games`

---

---

## E2E 专项入口

E2E 的运行命令、`GameTestContext` API、就绪检查、截图产物目录和启动日志统一由 [`docs/automated-testing.md`](automated-testing.md) 承载。

E2E 的真实入口、状态注入与真实链路边界、流程阶段、截图证据资格、视觉结果和对外结论以 [`.spec/knowledge/standards/e2e-verification.md`](../.spec/knowledge/standards/e2e-verification.md) 为唯一正文。玩家视角 UI 审计、最终图片展示和多图标记由 `.spec` 的 UI / 开图入口承担；测试通过、截图落盘、AI 核图和用户可见开图分别证明不同事实，不能互相替代。
