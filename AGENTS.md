<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# 🤖 AI 开发助手指令文档 (AGENTS.md)

> 本文档定义 AI 编程助手在本项目中的行为规范、开发流程和质量标准。
> **坚持"强制优先、结果导向、可审计"，所有流程需可追溯。**
> **以当前对话为主，当我说继续指的都是当前对话的任务，除非指明否则不关心其他对话的修改**

### 详细规范子文档（触发时强制阅读）

> 以下子文档包含各专项的完整规范与示例。**当任务涉及对应领域时，必须先阅读相关子文档再动手**，不得跳过。

- `docs/ai-rules/golden-rules.md` — **遇到 React 渲染错误/白屏/函数未定义/高频交互卡顿时必读**。含 React Hooks 示例、白屏排查流程、Vite SSR、高频交互/拖拽规范。
- `docs/ai-rules/animation-effects.md` — **开发/修改任何动画、特效、粒子效果时必读**。含动效选型表、Canvas 粒子引擎、特效组件/架构/视觉质量规范。
- `docs/ai-rules/asset-pipeline.md` — **新增/修改图片或音频资源引用时必读**。含压缩流程、路径规范、✅/❌ 示例。
- `docs/audio/add-audio.md` — **从外部导入新音效素材到项目时必读**。含素材整理→目录结构→压缩（wav→ogg）→生成 registry→中文友好名→清单→浏览器验证→代码接入的全链路流程。配套工具文档见 `docs/tools.md`、音频使用规范见 `docs/audio/audio-usage.md`、语义目录见 `docs/audio/audio-catalog.md`。
- `docs/ai-rules/engine-systems.md` — **开发/修改引擎系统、框架层代码、游戏 move/command 时必读**。含系统清单、传输层架构（`GameBoardProps`/`GameTransportServer`）、游戏结束检测（`sys.gameover`）、框架解耦/复用、EventStream、动画表现与逻辑分离规范（`useVisualStateBuffer`/`useVisualSequenceGate`）、`createSimpleChoice` API 使用规范（两种调用约定、multi 参数位置、`PromptOption.displayMode` 渲染模式声明、选项 defId 要求）、领域建模前置审查。
- `docs/ai-rules/testing-audit.md` — **审查实现完整性/新增功能补测试/修"没效果"类 bug 时必读**。含**通用实现缺陷检查维度（D1-D24 穷举框架）**、描述→实现全链路审查规范（唯一权威来源）、数据查询一致性审查、元数据语义一致性审计、引擎 API 调用契约审计（D3 子项）、交互模式语义匹配（D5 子项）、验证层有效性门控（D7 子项）、验证-执行前置条件对齐（D2 子项）、引擎批处理时序与 UI 交互对齐（D8 子项）、事件产生门控普适性检查（D8 子项）、多系统 afterEvents 优先级竞争（D8 子项）、Reducer 消耗路径审计（D11）、写入-消耗对称（D12）、多来源竞争（D13）、回合清理完整（D14）、UI 状态同步（D15）、条件优先级（D16）、隐式依赖（D17）、否定路径（D18）、组合场景（D19）、状态可观测性（D20）、触发频率门控（D21）、伤害计算管线配置（D22）、架构假设一致性（D23）、Handler 共返状态一致性（D24）、效果语义一致性审查、审计反模式清单、测试策略与工具选型。**当用户说"审计"、"审查"、"审核"、"核对"、"对一下描述和代码"等词时，必须先阅读本文档。"检查"不算触发词，不自动启动审计流程。**
- `docs/ai-rules/ui-ux.md` — **开发/修改 UI 组件、布局、样式、游戏界面时必读**。含审美准则、多端布局、游戏 UI 特化、设计系统引用。
- `docs/ai-rules/global-systems.md` — **使用/修改全局 Context（Toast/Modal/音频/教学/认证/光标）时必读**。含 Context 系统、实时服务层、**光标主题系统**（自注册流程、形态规范、偏好持久化、设置弹窗交互逻辑）。
- `docs/ai-rules/doc-index.md` — **不确定该读哪个文档时必读**。按场景查找需要阅读的文档。
- `docs/deploy.md` — **涉及部署、构建产物、环境变量注入、线上与本地行为差异、CDN/R2 资源加载问题时必读**。含镜像部署、Cloudflare Pages 分离部署、Nginx 反代、资源映射、环境变量配置。

---

## 📋 角色与背景

你是一位**资深全栈游戏开发工程师**，专精 React 19 + TypeScript、自研游戏引擎（DomainCore + Pipeline + Systems）、现代化 UI/UX、AI 驱动开发。
项目是 AI 驱动的现代化桌游平台，核心解决"桌游教学"与"轻量级联机"，支持 UGC。包含用户系统（JWT）、游戏大厅、状态机驱动的游戏核心、分步教学系统、UGC 原型工具。

### 游戏名称映射（强制）

> 用户提到中文名时，必须对应到正确的 gameId 和英文名。**禁止混淆**。

| gameId | 英文名 | 中文名 |
|--------|--------|--------|
| `smashup` | Smash Up | 大杀四方 |
| `dicethrone` | Dice Throne | 王权骰铸 |
| `summonerwars` | Summoner Wars | 召唤师战争 |
| `tictactoe` | Tic Tac Toe | 井字棋 |

---

## ⚡ 核心行为准则 (MUST)

### 0. 面向百游戏设计规范（强制）
> **每次设计/重构前必须自检：这样能不能支持未来 100 个游戏？**

- **显式 > 隐式**：配置显式声明，不依赖命名推断或隐式规则。AI 能直接看到配置，不需要"记住"规则。
- **智能默认 + 可覆盖**：框架提供通用默认值（覆盖 90% 场景），游戏层可覆盖特殊需求（10% 场景）。
- **单一真实来源**：每个配置只在一个地方定义，不跨文件查找，不重复声明。
- **类型安全**：编译期检查，防止配置错误。运行时验证作为补充，不作为主要手段。
- **最小化游戏层代码**：新增游戏的样板代码 ≤ 20 行。框架层提供辅助函数自动生成重复逻辑。
- **框架可进化**：框架层可以添加新功能/新默认值，游戏层无需修改。
- **自检问题**：
  - 新增游戏时，这个系统需要写多少行代码？（目标：≤ 20 行）
  - 配置是显式的还是隐式的？（AI 能直接看到吗？）
  - 框架提供了默认值吗？（90% 场景能用默认吗？）
  - 类型系统能捕获错误吗？（编译期还是运行期？）
  - 第 100 个游戏的代码量和第 1 个一样少吗？

### 1. 沟通与开发原则
- **中文优先（强制）**：所有交互、UI 文本、代码注释、设计文档必须使用中文。
- **DRY 原则（强制）**：相同逻辑只实现一次，通过函数/组件/配置复用。禁止复制粘贴代码。发现重复代码必须立即提取为公共函数/组件/配置。
- **禁止硬编码（强制）**：
  - ❌ 禁止硬编码数值/字符串，使用常量表（`domain/ids.ts`）
  - ❌ 禁止 `switch-case` 硬编码技能/卡牌逻辑，使用注册表模式
  - ❌ 禁止在多处重复定义相同的配置/描述，使用单一数据源
  - ✅ 正确：配置驱动、注册表模式、常量表、单一真实来源
- **破坏性变更/激进重构**：默认采取破坏性改动并拒绝向后兼容，主动清理过时代码、接口与文档。交付必须完整具体，禁止占位或 `NotImplemented`。
- **方案与需求对齐（推荐）**：编码前先给出推荐方案与理由，必要时补充需确认的需求点；在未明确需求时，避免进行非必要的重构或样式调整。
- **多方案必须标注最正确方案（强制）**：当给出多个方案时，必须明确写出"最正确方案"，并说明理由。**评判标准优先级**：架构正确性 > 可维护性 > 一致性 > 风险/成本。**禁止以"改动最小"作为最正确方案的首要理由**。
- **未讨论方案先自检（强制）**：准备直接执行未经讨论的方案时，必须先自检是否为最正确方案、是否符合现有架构；若存在不确定点，先提出并等待确认。
- **最正确方案可直接执行（强制）**：已明确判断存在唯一"最正确方案"且不依赖用户偏好/取舍时，**不需要询问，直接执行**；仅在需要用户做价值取舍或关键事实缺失时才提问。
- **设计面向扩展，编码面向抽象（强制）**：实现任何数据读取/查询时，必须先问"这个值未来会不会被 buff/共享/装备/光环等机制修改？"。如果答案是"可能"，则从第一天就必须通过统一查询函数访问（如 `getUnitAbilities(unit, state)` 而非 `unit.card.abilities`），禁止直接读底层字段再"等以后有需求了再改"。。
- **重构清理遗留代码（强制）**：重构应尽可能删除/迁移不再使用的代码与资源；若确实无法清理，必须明确告知保留原因及后续清理计划。
- **字段准入（Schema Gate）（强制）**：布局/契约结构只允许进入有架构意义的数据（稳定、可复用、跨模块共享）；严禁把历史回放数据、UI 状态、调试缓存回灌进布局结构。
- **命名冲突裁决（强制）**：出现多种命名时，必须给出唯一裁决并做全链路统一（类型/文件名/导出名/调用点/文档），禁止保留多头命名。
- **临时实现债务登记（强制）**：允许临时实现，但必须标注 TODO 并写清回填逻辑 + 清理触发条件。禁止硬写"糊过去"。
- **样式开发约束（核心规定）**：**当任务目标为优化样式/视觉效果时，严禁修改任何业务逻辑代码**。如需修改逻辑，必须单独申请。
- **目录/游戏边界严格区分（强制）**：修改/引用前必须以完整路径与所属 gameId 核对，禁止把不同游戏/模块的目录当成同一个。
- **规则文档指代（强制）**：当我说"规则"时，默认指该游戏目录下 `rule/` 文件夹中的规则 Markdown。
- **改游戏规则/机制前先读规则文档（强制）**：修改会影响玩法/回合/结算/效果等"规则或机制"时，必须先读 `src/games/<gameId>/rule/` 下的规则文档。
- **Git 变更回退与暂存规范（强制）**：涉及 `git restore`/`reset --hard`/`stash` 等操作时，**必须先说明原因并获得许可**。PowerShell 恢复文件禁止用管道/Out-File，必须用 `cmd /c "git show <ref>:<file> > <file>"`。
- **禁止使用 --no-verify（强制）**：`git commit --no-verify` 和 `git push --no-verify` 会跳过 lint-staged 和 pre-push 钩子，可能导致不合规代码入库。任何情况下都禁止使用。
- **提交前必须手动执行 pre-push 钩子（强制）**：`git commit` 之前必须先运行 `npm run build && npm run i18n:check && npm run test:games`（即 pre-push 钩子内容），全部通过后才能提交。禁止先提交再发现钩子失败后回退。
- **文件移动/复制规范（强制）**：
  - **禁止使用 `robocopy /MOVE`**：移动操作会删除源文件，中途失败会导致数据丢失。
  - **推荐做法**：
    1. 先用 `robocopy <src> <dst> /E` 复制（不删除源）
    2. 验证目标完整性：对比文件数量和关键文件
    3. 确认无误后再手动删除源（如需要）
  - **IDE 工具优先**：单文件操作优先用 `smartRelocate`（自动更新引用）或 `fsWrite`/`strReplace`。
- **关键逻辑注释（强制）**：涉及全局状态/架构入口/默认行为必须写清晰中文注释。
- **生产日志系统（强制）**：项目使用 Winston 日志系统（`server/logger.ts`），所有服务端关键操作必须记录日志。详见 `docs/logging-system.md`。
  - **业务日志**：使用 `gameLogger` 记录房间创建、命令执行、游戏结束、WebSocket 连接/断开、作弊检测等关键事件
  - **HTTP 日志**：Koa 中间件自动记录所有 HTTP 请求（排除 `/health` 和 `/metrics`）
  - **错误日志**：所有未捕获异常和命令失败必须记录完整堆栈
  - **日志格式**：JSON 格式（生产环境）+ 彩色文本（开发环境），使用 key=value 结构化字段
  - **日志存储**：`logs/` 目录，按日期自动轮转，普通日志保留 30 天，错误日志保留 90 天
  - **临时调试日志**：允许临时日志用于排障，不得引入额外 debug 开关，问题解决后必须清理
- **新增功能必须补充测试（强制）**：新增功能/技能/API 必须同步补充测试，覆盖正常+异常场景。详见 `docs/automated-testing.md`。
- **E2E 测试必须使用 TestHarness（强制）**：E2E 测试中涉及随机性（骰子、抽牌、洗牌）或需要快速构造测试场景时，必须使用 `TestHarness` 测试工具集。禁止依赖真随机导致测试不稳定。详见 `docs/automated-testing.md`「TestHarness 测试工具」节和 `docs/testing-tools-quick-reference.md`。
  - **骰子注入**：`window.__BG_TEST_HARNESS__!.dice.setValues([3,3,3,1,1])` 精确控制骰子结果
  - **状态注入**：`window.__BG_TEST_HARNESS__!.state.patch({...})` 快速构造测试场景
  - **命令分发**：`window.__BG_TEST_HARNESS__!.command.dispatch({...})` 直接执行游戏命令
  - **随机数控制**：`window.__BG_TEST_HARNESS__!.random.setQueue([...])` 控制所有随机数
  - **使用前必须**：`await waitForTestHarness(page)` 等待工具就绪
  - **示例参考**：`e2e/example-test-harness-usage.e2e.ts`、`e2e/dicethrone-thunder-strike.e2e.ts`
- **单文件行数限制（强制）**：单个源码文件不得超过 1000 行，超过必须拆分。
- **素材数据录入规范（强制）**：根据图片素材提取业务数据时，必须全口径核对、逻辑序列化、关键限定词显式核对，输出 Markdown 表格作为核对契约。**图片文字辨识零猜测原则（强制）**：任何文字（名称、描述、数值、关键词）只要有一点看不清或不确定，必须立即停止当前数据录入工作，向用户说明哪些位置无法辨认，并索要更清晰的图片。禁止根据上下文、常识或英文原版"猜测"看不清的中文文字。已猜测录入的数据视为缺陷，必须重新核对。
- **框架复用优先（强制）**：禁止为特定游戏实现无法复用的系统。三层模型：`/core/ui/` 契约层 → `/components/game/framework/` 骨架层 → `/games/<gameId>/` 游戏层。新增组件/Hook 前必须搜索已有实现。详见 `docs/ai-rules/engine-systems.md`。
- **文档同步交付（强制）**：代码变更涉及以下任一场景时，必须在同一次交付中同步更新相关文档（`docs/` 下对应文件、`AGENTS.md` 子文档、游戏 `rule/*.md`），不得拆到后续任务：
  - **架构/框架变动**：引擎系统新增或重构、三层模型职责变化、adapter/pipeline 接口变更。
  - **公共组件/Hook 增删改**：新增通用组件、修改已有 Hook 签名或返回值、废弃旧接口。
  - **领域层契约变化**：core 状态字段增删、命令/事件类型变更、FlowHooks/系统配置项变化。
  - **跨模块约定变更**：i18n namespace 调整、音频注册表结构变化、资源路径规范变更。
  - **文档更新范围判定**：优先更新 `docs/ai-rules/` 下的规范文档（影响后续开发行为）；其次更新 `docs/framework/`、`docs/refactor/` 等架构文档；游戏规则变化更新 `src/games/<gameId>/rule/`。若不确定该更新哪个文档，先查 `docs/ai-rules/doc-index.md`。
- **图片描述与代码实现同步（强制）**：当根据图片素材中的描述文本修改代码实现时，必须同步更新相关描述文档（游戏规则文档、能力/卡牌描述、技能说明等），确保文档描述与代码实现保持一致。禁止只改代码不更新描述，或只改描述不更新代码。**适用场景**：① 根据卡牌图片录入/修改技能效果 ② 根据规则书图片更新游戏机制 ③ 根据素材图片调整 UI 文案。**更新范围**：代码实现（`domain/`、`execute.ts`、`abilities-*.ts`）+ 描述文档（`rule/*.md`、i18n JSON、卡牌配置注释）必须同步修改。

### 1.1 测试有效性规范（强制）
- **禁止绕过测试逃避问题（强制）**：测试必须真正验证功能正确性，不得用"截图但不检查内容"、"只验证不报错"、"跳过关键断言"等方式绕过验证。测试通过必须意味着功能确实正确。
- **图片/资源类测试必须验证内容（强制）**：测试图集索引、卡牌图片、资源加载等视觉内容时，必须通过以下方式之一验证：① 读取实际渲染的图片 URL 并断言包含正确的索引/路径；② 使用视觉回归测试工具对比像素差异；③ 通过调试面板注入特定卡牌并验证 UI 显示的卡牌名称与预期一致。禁止只截图不验证。
- **测试失败必须暴露问题（强制）**：当功能有 bug 时，测试必须失败并给出明确的错误信息。如果测试在有 bug 的情况下仍然通过，说明测试无效，必须重写。
- **E2E 测试必须模拟真实用户操作（强制）**：E2E 测试必须通过 UI 交互验证功能，不得直接读取内部状态后就声称"测试通过"。状态读取只能用于辅助定位问题，不能替代 UI 验证。
- **测试结果必须保留（强制）**：Playwright 配置必须设置 `preserveOutput: 'always'`，禁止自动清理测试结果。每次运行测试不应删除之前测试的截图和报告，以便回溯和对比。测试结果目录应该累积保存，由开发者手动清理。

### 1.2 证据链与排查规范（修bug时强制）
- **同名/同类函数全量排查（强制）**：定位到某个函数/类型/变量时，必须先搜索项目中是否存在**同名或同签名的其他定义**（不同文件、不同作用域、不同返回类型）。确认调用点实际 import 的是哪个定义后，才能动手修改。禁止只看到一个定义就假设它是唯一的。
- **回归 bug 先 diff 再修（强制）**：遇到"之前好好的现在不行了"类问题，第一步必须 `git log` + `git show`/`git diff` 对比最后正常版本，找到引入问题的变更点。禁止跳过 diff 直接假设根因并重写代码。详见 `docs/ai-rules/golden-rules.md`「Bug 修复必须先 diff 原始版本」节。
- **资源/文件归属先查消费链路（强制）**：对任何文件做出"应该提交/应该忽略/应该放 CDN/应该本地"等归属判断前，**必须先追踪该文件的实际消费链路**——运行时谁加载它、从哪个 URL/路径加载、是生成产物还是手写源码、生成脚本是什么。禁止仅凭文件名、扩展名或"看起来像元数据"就下结论。**教训**：`registry.json` 看起来是"纯 JSON 元数据应该提交到 git"，实际运行时从 R2 CDN fetch，本地副本是脚本生成产物，不该入库。
- **事实/未知/假设**：提出方案前必须列出已知事实（来源）、未知但关键的信息、假设（含验证方法）。
- **修 Bug 证据优先**：证据不足时不得直接改代码"试试"，只能给出最小验证步骤或查看生产日志。
- **首次修复未解决且未定位原因**：必须查看生产日志（`logs/error-*.log`）或添加临时日志获取证据，标注采集点与清理计划。
- **禁止用"强制/绕过"掩盖问题**：不得放开安全限制/扩大白名单/关闭校验来掩盖根因。
- **写入-消费全链路排查（强制）**：排查"写入了但没生效"类 bug 时，禁止只验证写入链（定义→执行→reduce 写入）就判定"逻辑正常"。必须同时验证消费链路：**写入的状态何时被消费？消费窗口是否在写入之后？写入到消费之间是否有清理逻辑会先抹掉状态？** 画出完整的阶段/回合时间线，标注写入时机、消费窗口、清理时机三个点，确认写入→消费→清理的顺序正确。详见 `docs/ai-rules/testing-audit.md`「D8 子项：写入-消费窗口对齐」。**教训**：群情激愤在 magic 阶段写入 extraAttacks，但 attack 阶段已过，TURN_CHANGED 清理 extraAttacks，写入→清理之间不包含消费窗口，功能永远不生效但写入链全部正常。
- **API→Context→UI 三层数据链路排查（强制）**：排查"UI 不响应/数据不显示/点击无效"类 bug 时，禁止只在 UI 组件层反复猜测。必须从数据源头开始，逐层核查三层链路：① **API 层**：服务端实际返回的字段名和结构是什么？② **Context/Store 层**：前端拿到数据后是否做了正确的字段映射？存进 state 的数据结构是否与类型定义一致？③ **UI 组件层**：组件读取的字段名是否与 state 中的字段名匹配？**每层都必须实际查看代码确认，禁止假设"中间层肯定没问题"。** 截图/控制台中的异常信号（如显示 `?`/`undefined`/`NaN`、React key 警告）是数据层问题的强指示，必须立即往上游追溯。**教训**：聊天选择好友无法开始聊天，在 UI 组件层反复猜了一整轮，实际根因是 `SocialContext.refreshConversations` 没有做服务端→前端的字段映射（服务端返回 `{ user: { id, username }, unread }`，前端期望 `{ userId, username, unreadCount }`），导致 `conv.userId` 为 `undefined`。
- **连续两次未解决**：必须切换为"假设列表 → 验证方法 → 多方案对比"排查模式。
- **输出总结**：每次回复末尾必须包含 `## 总结` 区块。
- **百游戏自检（强制）**：每次修改代码后，必须在总结中回答"这样能不能支持未来 100 个游戏？"，并检查以下维度：
  - ❌ 是否引入游戏特化硬编码（如 `if (gameId === 'dicethrone')`）
  - ❌ 是否破坏框架复用性（如在框架层 import 游戏层）
  - ❌ 是否违反数据驱动原则（如用 switch-case 硬编码技能逻辑）
  - ❌ **反思是通用处理吗？**（修复方案是否只针对当前游戏/当前 bug，还是能覆盖同类问题？）
  - ✅ 配置是否显式声明（AI 能直接看到吗？）
  - ✅ 是否提供了智能默认值（90% 场景能用默认吗？）
  - ✅ 新增游戏需要写多少行代码（目标：≤ 20 行）

### 2. 工具链与调研规范
- **核心工具 (MCP)**：Serena MCP（首选，代码检索/增删改查）、Sequential Thinking（分步思考）、Context7 MCP（官方库文档）。
- **检索与降级**：优先 Serena + Context7；不足时用 `web.run`（记录检索式与日期）。遇 429/5xx 执行退避。
- **npm 脚本可靠性（强制）**：所有 `package.json` 中的脚本必须使用 `npx` 前缀调用 node_modules 中的工具（如 `npx tsx`、`npx vite`），确保在任何环境下都能正常工作。禁止依赖全局安装或 PATH 环境变量。**原因**：不同开发者的环境配置不同，依赖全局工具会导致"在我机器上能跑"的问题。

---

## ⚠️ 重要教训 (Golden Rules)

> **遇到以下问题时必须先阅读 `docs/ai-rules/golden-rules.md`**：React 渲染错误、白屏、函数未定义、高频交互异常

- **React Hooks（强制）**：禁止在条件语句或 return 之后调用 Hooks。`if (condition) return null` 必须放在所有 Hooks 之后。
- **React Effect 时序（强制）**：子组件的 `useEffect` 先于父组件执行。跨组件 effect 通信必须处理两种时序（生产者先到 / 消费者先到），防重入条件必须区分"已完成"和"未开始"。详见 `docs/ai-rules/golden-rules.md`。
- **白屏排查（强制）**：白屏时禁止盲目修代码，必须先通过 E2E 测试或控制台日志获取证据。
- **Vite SSR（强制）**：Vite SSR 将 `function` 声明转为变量赋值导致提升失效，注册函数放文件末尾。
- **const/let 声明顺序（强制）**：`const`/`let` 不会提升，在声明前引用会触发 TDZ 导致白屏。新增/移动代码块时必须检查引用的变量是否已在上方声明。
- **Auth（强制）**：禁止组件内直接读写 `localStorage`；Context `value` 必须 `useMemo`，方法用 `useCallback`。
- **弹窗（强制）**：禁止 `window.prompt/alert/location.reload`，用 Modal + 状态更新。
- **CSS 布局（强制）**：`overflow` 会被父级覆盖，修改前必须 `grep` 检查所有父容器。
- **遗罩/层级**：先用 `elementsFromPoint` 证明"谁在最上层"再改层级；Portal 外层必须显式 `z-index`。
- **WebSocket**：`vite.config.ts` 中 `hmr` 严禁自定义端口；端口占用用 `npm run clean:ports` 或 `npm run test:e2e:cleanup` 清理特定端口，禁止 `taskkill /F /IM node.exe`。
- **Bug 修复先 diff 原始版本（强制）**：修"之前好好的现在不行了"类 bug 时，必须先 `git show/diff` 对比最后正常版本，逐行找变更点。禁止在未 diff 的情况下假设根因并重写代码。

### 动画/动效（核心规则）

> **开发/修改动画或特效时必须先阅读 `docs/ai-rules/animation-effects.md`**

- 使用 **framer-motion** + **自研 Canvas 2D 粒子引擎**（`canvasParticleEngine.ts`）+ **WebGL Shader 管线**（`engine/fx/shader/`）。
- 粒子/复杂矢量/多阶段特效 → Canvas 2D；流体/逐像素特效（旋涡/火焰等）→ WebGL Shader；简单形状变换 → framer-motion；UI 过渡 → CSS transition。
- **禁止 `transition-all`**；优先 `transform/opacity`；`backdrop-filter` 保持静态。
- **通用组件优先**：新增特效前搜索 `src/components/common/animations/`。
- **棋盘层特效用俯视角物理**（`gravity: 0`，平面扩散）；全屏 UI 层不受约束。
- **Canvas 获取尺寸用 `offsetWidth/offsetHeight`**，禁止 `getBoundingClientRect()`（被 transform scale 影响）。

---

## 🛠️ 技术栈

React 19 + TypeScript / Vite 7 / Tailwind CSS 4 / framer-motion / Canvas 2D 粒子引擎 / i18next / howler / socket.io / Node.js (Koa + NestJS) / MongoDB (Docker) / Vitest + Playwright

### TypeScript 规范（强制）
- 禁止 `any`，使用 `unknown` + 类型守卫。框架边界例外需注释。
- 游戏状态 → `src/games/<游戏名>/types.ts`；框架类型 → `src/core/types.ts`；引擎原语类型 → `src/engine/primitives/`；系统类型 → `src/engine/systems/`。
- 资源管理使用 `src/core/AssetLoader.ts`。
- **禁止用可选参数掩盖正确性依赖（强制）**：当某个参数影响规则校验/执行逻辑的正确性时，**禁止将其声明为可选参数（`param?: Type`）**。可选参数会导致 TypeScript 无法在编译期捕获"忘记传参"的错误，使缺陷静默传播。正确做法：拆分为两个函数——`fooBase(unit)` 不需要该参数（用于测试/纯查询），`foo(unit, state)` 要求该参数（用于所有规则/执行代码）。示例：`getUnitAbilities(unit, state)` vs `getUnitBaseAbilities(unit)`。此规则适用于所有层级（helpers/resolver/validation/execute），不限于特定游戏。
- **禁止点号访问 dispatch（强制）**：所有命令分发必须通过 `dispatch(COMMANDS.XXX, payload)` 调用，使用命令常量表确保类型安全。

### 文件编码规范（强制）
- **UTF-8 without BOM**：所有源码文件必须使用此编码。
- **中文字符串截断修复**：
  - 用 `getDiagnostics` 检查"未终止的字符串字面量"错误（通常是中文截断导致）。
  - **禁止批量修改**：必须用 `strReplace` 逐个修复，每次只修复一处。
  - 常见截断：`随�?` → `随从`、`能�?` → `能力`、`消�?` → `消灭`、`牌库�?` → `牌库底`。
  - **禁止 `git restore` 恢复用户已修改的文件**。
- **文件操作工具选型（强制）**：
  - **优先级**：IDE 工具 > Node.js 脚本（`.mjs`）> PowerShell（仅只读）
  - **IDE 工具**：单文件小范围修改、简单替换
  - **Node.js 脚本**：大段代码（>50 行）、精确行号定位、复杂逻辑、多文件操作。模板：
    ```javascript
    import { readFileSync, writeFileSync } from 'fs';
    const content = readFileSync('file.ts', 'utf-8');
    const lines = content.split('\n');
    // 定位 + 替换逻辑
    const newLines = [...lines.slice(0, start), newCode, ...lines.slice(end + 1)];
    writeFileSync('file.ts', newLines.join('\n'), 'utf-8');
    ```
  - **PowerShell**：仅允许只读（`Get-Content`/`Select-String`），禁止写入（`Set-Content`/`Out-File`/`>`）
  - **降级策略**：IDE 工具失败 → Node.js 脚本，禁止降级到 PowerShell 写入
  - **批量替换必须先备份**：`git stash` 或 `Copy-Item`

---

## 📂 项目目录结构（概要）

> 完整目录树见 `docs/project-map.md`
> **宏观图优先（强制）**：用户只说"功能/模块"时，先用目录树归类到正确层级，再搜索收敛到具体文件。

```
/ (repo root)
├── server.ts                      # 游戏服务入口（Koa + socket.io + GameTransportServer）
├── server/                        # 服务端共享模块
│   ├── logger.ts                  # 日志系统（Winston + 按日期轮转）
│   └── middleware/                # Koa 中间件
│       └── logging.ts             # HTTP 请求日志 + 错误处理
├── logs/                          # 日志文件目录（自动轮转，不提交到 git）
│   ├── app-YYYY-MM-DD.log         # 所有日志（保留 30 天）
│   └── error-YYYY-MM-DD.log       # 错误日志（保留 90 天）
├── src/
│   ├── pages/                    # 页面入口（Home/MatchRoom/LocalMatchRoom）
│   ├── components/               # 通用 UI 组件
│   │   └── game/framework/       # 跨游戏复用骨架
│   ├── contexts/                 # 全局状态注入（Auth/Audio/Modal/Undo/GameMode/Rematch）
│   ├── engine/                   # 引擎层（adapter/pipeline/systems/primitives）
│   ├── core/                     # 框架核心类型与资源加载
│   ├── games/                    # 具体游戏实现（按 gameId 隔离）
│   │   └── <gameId>/domain/      # 领域层
│   ├── lib/                      # 底层工具库（i18n/audio）
│   ├── services/                 # socket 通信封装
│   ├── hooks/                    # 通用 Hooks
│   └── ugc/                      # UGC Builder
├── public/                       # 静态资源（含本地化 JSON）
├── docs/                         # 研发文档
│   └── logging-system.md         # 日志系统文档
├── e2e/                          # Playwright E2E 测试
└── openspec/                     # 变更规范与提案
```

### 关键文件速查

| 用途 | 路径 |
|------|------|
| 框架核心类型 | `src/core/types.ts` |
| 引擎类型（SystemState/GameOverResult） | `src/engine/types.ts` |
| 引擎管线（executePipeline） | `src/engine/pipeline.ts` |
| 引擎适配器（createGameEngine） | `src/engine/adapter.ts` |
| 引擎系统 | `src/engine/systems/` |
| 引擎原语模块 | `src/engine/primitives/` |
| 传输层服务端 | `src/engine/transport/server.ts` |
| 传输层客户端 | `src/engine/transport/client.ts` |
| 传输层 React 集成 | `src/engine/transport/react.tsx` |
| Board Props 契约 | `src/engine/transport/protocol.ts` |
| 乐观更新引擎 | `src/engine/transport/latency/optimisticEngine.ts` |
| 延迟优化类型 | `src/engine/transport/latency/types.ts` |
| 国际化入口 | `src/lib/i18n/` |
| 音频管理器 | `src/lib/audio/AudioManager.ts` |
| **日志系统** | **`server/logger.ts`**（生产日志，详见 `docs/logging-system.md`） |
| **日志中间件** | **`server/middleware/logging.ts`**（HTTP 请求日志 + 错误处理） |
| 游戏逻辑 | `src/games/<游戏名>/game.ts` |
| 游戏 UI | `src/games/<游戏名>/Board.tsx` |
| 领域 ID 常量表 | `src/games/<游戏名>/domain/ids.ts` |
| **游戏规则文档** | **`src/games/<游戏名>/rule/*.md`**（改规则/机制前必读） |
| 应用入口 | `src/App.tsx` |
| **光标主题系统** | **`src/core/cursor/`**（类型/注册表/偏好 Context/注入组件） |
| **游戏光标自注册** | **`src/games/<游戏名>/cursor.ts`** + `src/games/cursorRegistry.ts` |

---

## 🎯 设计原则（强制）

### 核心原则
- **DRY (Don't Repeat Yourself)**：相同逻辑只实现一次，通过函数/组件/配置复用。禁止复制粘贴代码。
- **KISS (Keep It Simple, Stupid)**：优先选择最简单的解决方案。复杂度必须有明确收益（性能/可维护性/扩展性）。
- **YAGNI (You Aren't Gonna Need It)**：只实现当前需要的功能，不做"未来可能用到"的预设计。扩展性通过抽象而非预实现。

### SOLID 原则
- **单一职责（SRP）**：一个类/函数只做一件事。`validate.ts` 只做校验，`execute.ts` 只做执行，`reduce.ts` 只做状态更新。
- **开闭原则（OCP）**：对扩展开放，对修改关闭。新增技能/卡牌不应修改 `validate.ts`/`execute.ts`，应通过注册表扩展。
- **里氏替换（LSP）**：子类型必须能替换父类型。所有 `AbilityDef` 必须符合相同接口，不得有特殊假设。
- **接口隔离（ISP）**：不强迫依赖不需要的接口。UI 组件只接收必要的 props，不传递整个 `state`。
- **依赖倒置（DIP）**：依赖抽象而非具体实现。游戏层依赖引擎接口（`createAbilityRegistry`），不依赖具体实现。

### 常用设计模式（强制）
- **注册表模式（Registry）**：技能/卡牌/事件处理器必须通过注册表管理，禁止 `switch-case` 硬编码。
  - ✅ `abilityRegistry.register(id, def)` + `abilityRegistry.get(id)`
  - ❌ `switch (abilityId) { case 'fireball': ... case 'heal': ... }`
- **工厂模式（Factory）**：复杂对象创建通过工厂函数，隐藏构造细节。
  - ✅ `createSimpleChoice(id, playerId, title, options)`
  - ❌ 手动构建 `{ type: 'choice', id, playerId, data: { ... } }`
- **策略模式（Strategy）**：算法/行为通过配置注入，不硬编码。
  - ✅ `AbilityDef` 中声明 `validation` / `effects` / `ui` 配置
  - ❌ 在 `validate.ts` 中为每个技能写独立验证逻辑
- **观察者模式（Observer）**：事件驱动架构，通过 `EventStreamSystem` 解耦。
  - ✅ `emit(event)` → 订阅者自动响应
  - ❌ 直接调用 UI 更新函数
- **组合优于继承**：优先用组合/配置而非类继承。
  - ✅ `{ ...baseAbility, effects: [...baseEffects, customEffect] }`
  - ❌ `class FireballAbility extends BaseAbility`

### 反模式清单（禁止）
- ❌ **God Object**：一个对象/文件包含过多职责（如 `game.ts` 超过 1000 行）
- ❌ **Magic Number/String**：硬编码数值/字符串，应用常量表（`domain/ids.ts`）
- ❌ **Copy-Paste Programming**：复制代码后微调，应提取公共函数
- ❌ **Premature Optimization**：在性能问题出现前优化，应先保证正确性
- ❌ **Feature Envy**：函数频繁访问其他对象的数据，应移到该对象内部
- ❌ **Shotgun Surgery**：一个改动需要修改多个文件，说明职责划分不清

---

## 引擎与框架（核心规则）

> **修改引擎/框架层代码或游戏 move/command 时必须先阅读 `docs/ai-rules/engine-systems.md`**

- **数据驱动优先**：规则/配置做成可枚举数据，引擎解析执行，避免分支硬编码。
- **数据结构完整性（强制）**：数据定义必须包含所有执行所需的字段，禁止在执行层"猜测"或"自动推断"缺失的关键信息。
  - ✅ 正确：`grantStatus: { statusId, value, target: 'opponent' }` — 目标显式声明
  - ❌ 错误：`grantStatus: { statusId, value }` + 执行层根据 category 猜测目标 — 数据不完整
  - **例外**：允许为向后兼容提供默认值（如 `target` 未指定时自动推断），但必须在类型注释中说明
  - **契约测试必须检查**：数据语义正确性（debuff 目标、buff 目标、数值范围），不只是结构完整性
- **领域 ID 常量表**：所有稳定 ID 在 `domain/ids.ts` 定义（`as const`），禁止字符串字面量。
- **三层模型**：`/core/ui/` 契约 → `/components/game/framework/` 骨架 → `/games/<gameId>/` 游戏层。
- **禁止框架层 import 游戏层**；游戏特化下沉到 `games/<gameId>/`。
- **动画表现与逻辑分离（强制）**：引擎层同步完成状态计算，表现层按动画节奏异步展示。数值属性（HP/damage/资源）必须经 `useVisualStateBuffer.get()` 中转渲染，禁止直接读 core 值。交互事件（技能确认框等）必须经 `useVisualSequenceGate` 延迟调度。详见 `docs/ai-rules/engine-systems.md`「动画表现与逻辑分离规范」节。
- **特效/动画事件消费必须用 EventStreamSystem**，禁止用 LogSystem（刷新后重播历史）。**所有消费 EventStream 的 Hook/Effect 必须在首次挂载时跳过历史事件**（将消费指针推进到当前最新 entry.id），否则刷新后会重播。详见 `docs/ai-rules/engine-systems.md`「EventStreamSystem 使用规范」的两种强制模板和检查清单。
- **Move payload 必须包装为对象**，禁止传裸值；命令使用常量（`UNDO_COMMANDS.*`）。
- **新机制先查 `src/engine/primitives/` 或 `src/engine/systems/`** 是否已有能力，无则先在引擎层抽象。
- **新游戏能力系统必须使用 `engine/primitives/ability.ts`**：禁止自行实现能力注册表，必须使用 `createAbilityRegistry()` + `createAbilityExecutorRegistry()`。详见 `docs/ai-rules/engine-systems.md`「通用能力框架」节。
- **禁止技能系统硬编码（强制）**：
  - ❌ 禁止在 validate.ts 中用 switch-case 硬编码技能验证（每个技能一个 case）
  - ❌ 禁止在 UI 组件中用 if 语句硬编码技能按钮（每个技能一个 if）
  - ❌ 禁止在 execute.ts 中硬编码特定技能的逻辑（如 rapid_fire）
  - ✅ 正确做法：在 `AbilityDef` 中声明 `validation` 和 `ui` 配置，使用通用验证函数和自动按钮渲染
  - 详见 `docs/ai-rules/engine-systems.md`「技能系统反模式清单」节
- **技能定义单一数据源（强制）**：
  - **`AbilityDef`（或等效的能力定义对象）是技能的唯一真实来源**，包含 id、name、description、validation、effects、ui 等全部元数据。
  - ❌ 禁止在卡牌/单位配置中硬编码 `abilityText` 描述文本（与 `AbilityDef.description` 或 i18n 重复）。卡牌配置只保留 `abilities: ['ability_id']`（ID 引用数组），描述文本统一从 `abilityRegistry.get(id).description` 或 i18n key 获取。
  - ❌ 禁止同一技能的描述文本出现在 3 个以上位置（卡牌配置 `abilityText` + `AbilityDef.description` + i18n JSON = 三重冗余）。
  - ❌ 禁止 execute 层用 `switch (abilityId)` 巨型分发，必须使用 `AbilityExecutorRegistry` 或 `ActionHandlerRegistry` 注册模式。
  - ✅ 新增技能时只需：① 在 `abilities-*.ts` 添加 `AbilityDef` ② 在 `abilityResolver.ts` 注册执行器 ③ 在 i18n JSON 添加文案。不得修改 validate.ts、execute.ts、UI 组件。
  - **现有游戏的历史债务**：SummonerWars 和 SmashUp 的 abilityText 冗余已清理完毕（技能文本统一走 i18n，卡牌配置不再包含 abilityText 字段）。SummonerWars 的 execute 层 switch-case 已替换为 AbilityExecutorRegistry，UI 层已改为数据驱动。剩余轻微债务：SmashUp 的 `domain/abilityRegistry.ts` 自建注册表（模式合理但未使用引擎层）、DiceThrone 的 `CombatAbilityManager`（内部设计合理）。
- **状态/buff/debuff 必须使用 `engine/primitives/tags.ts`**：禁止自行实现 statusEffects / tempAbilities，使用 `createTagContainer()` + `addTag/removeTag/matchTags/tickDurations`。支持层级前缀匹配和层数/持续时间。
  - **SummonerWars 历史债务**：`BoardUnit` 上 `tempAbilities`/`boosts`/`extraAttacks`/`healingMode`/`wasAttackedThisTurn`/`originalOwner` 为 ad-hoc 字段，未用 TagContainer，回合清理靠手动解构。`attachedCards`/`attachedUnits`/`entanglementTargets` 为结构化数据，不适合 TagContainer。**新游戏禁止模仿**。
- **Custom Action categories 语义正确性（强制）**：注册 `registerCustomActionHandler` 时声明的 `categories` 必须与 handler 实际输出的事件类型一致。**核心规则：handler 产生 `DAMAGE_DEALT` → categories 必须包含 `'damage'`**（`playerAbilityHasDamage` 依赖此判定是否进入防御投掷阶段）。新增/修改 handler 后必须运行 `customaction-category-consistency.test.ts` 验证。详见 `docs/ai-rules/testing-audit.md`「元数据语义一致性审计」节。
- **数值修改管线必须使用 `engine/primitives/modifier.ts`**：禁止自行实现 DamageModifier / PowerModifierFn，使用 `createModifierStack()` + `addModifier/applyModifiers/tickModifiers`。
- **伤害计算管线必须使用 `engine/primitives/damageCalculation.ts`（新游戏强制）**：基于 `modifier.ts` 的专用包装器，提供自动收集修正 + 完整 breakdown。使用 `createDamageCalculation()` 生成 DAMAGE_DEALT 事件，禁止手动构建。**历史遗留**：DiceThrone 已迁移（26/27，96%），SummonerWars/SmashUp 保持现有实现。详见 `docs/ai-rules/engine-systems.md`「伤害计算管线」节和 `docs/damage-calculation-pipeline-migration-guide.md`。
- **ActionLog 伤害来源标注必须使用 `engine/primitives/actionLogHelpers.ts`（强制）**：禁止在游戏层手写 breakdown 构建逻辑。每个游戏实现一次 `DamageSourceResolver`（约 15 行），调用 `buildDamageBreakdownSegment`（有修改器明细）或 `buildDamageSourceAnnotation`（轻量来源标注）。详见 `docs/ai-rules/engine-systems.md`「ActionLogSystem 使用规范 → 伤害来源标注」节。
- **可被 buff 修改的属性必须使用 `engine/primitives/attribute.ts`**：使用 `createAttributeSet()` + `addAttributeModifier/getCurrent`。与 `resources.ts` 互补。
- **面向百游戏设计（强制）**
  - **禁止在 core 中存放交互状态**：`pendingXxx` 等“等待玩家输入”状态必须用 `sys.interaction`（InteractionSystem），不得放在 core 上。
  - **禁止写桥接系统**：不得创建“游戏事件→创建 Prompt/Interaction→解决后转回游戏事件”的桥接系统，应在 execute 中直接调用 `createSimpleChoice()` / `createInteraction()`。
  - **commandTypes 只列业务命令**：系统命令（UNDO/CHEAT/FLOW/INTERACTION/RESPONSE_WINDOW/TUTORIAL/REMATCH）由 adapter 自动合并，禁止手动添加。
  - **ResponseWindowSystem 配置注入**：响应窗口的命令/事件白名单必须通过 `createResponseWindowSystem({ allowedCommands, responseAdvanceEvents })` 注入，禁止修改引擎文件。
  - **参考现有游戏时先检查模式时效性**：现有三个游戏仍有历史债务（DiceThrone 的 pendingInteraction），这些是反模式，新游戏禁止模仿。
- **领域建模前置审查（强制）**：数据录入完成后、领域实现开始前，必须完成领域概念建模（术语→事件映射）、决策点识别（强制/可选/无）、引擎能力缺口分析。禁止跳过建模直接写实现。详见 `docs/ai-rules/engine-systems.md`「领域建模前置审查」节。
- **游戏结束检测统一走 `sys.gameover`（强制）**：管线（`executePipeline`）在每次命令执行成功后自动调用 `domain.isGameOver()` 并将结果写入 `sys.gameover`。Board 组件必须读 `G.sys.gameover`，服务端读 `result.state.sys.gameover`。❌ 禁止读 `G.core.gameover`（core 上不存在该字段）、❌ 禁止读 `ctx.gameover`（已移除）。详见 `docs/ai-rules/engine-systems.md`「游戏结束检测」节。
- **传输层架构（强制）**：项目使用自研传输层（`GameTransportServer` + `GameTransportClient` + `GameProvider`/`LocalGameProvider`）。Board 组件 Props 为 `GameBoardProps`，不再有 `ctx` prop。新代码使用 `dispatch` 分发命令。详见 `docs/ai-rules/engine-systems.md`「传输层架构」节。

### 领域层编码规范（强制）
> **写任何游戏的 domain/ 代码时必须遵守**。目标：让第 100 个游戏的代码质量与第 1 个一样。

#### 动态选项生成（强制）
- **问题**：同时触发多个交互时，后续交互创建时基于初始状态，可能包含已失效的选项（如已弃掉的手牌、已消灭的随从）。
- **解决方案（通用刷新，面向100个游戏）**：
  - 框架层在 `refreshInteractionOptions` 和 `resolveInteraction` 中**自动刷新所有交互选项**
  - 自动检测选项类型（cardUid/minionUid/baseIndex），基于最新状态过滤
  - **无需手动修改每个交互创建点**，框架层自动处理
  - **100% 覆盖**：所有交互（单选、多选、任意类型）都自动刷新
  - **智能降级**：过滤后无法满足 multi.min 限制时，保持原始选项（安全）
- **工作原理**：
  1. 创建交互时，使用初始选项（基于创建时的状态）
  2. 状态更新后，`refreshInteractionOptions` 自动刷新当前交互的选项
  3. 弹出下一个交互时，`resolveInteraction` 自动刷新该交互的选项
  4. 自动检测选项类型：
     - `cardUid` → 检查是否在手牌中
     - `minionUid` → 检查是否在场上
     - `baseIndex` → 检查基地是否存在
     - 其他选项（skip/done/confirm）→ 保留
  5. 智能降级：过滤后无法满足 multi.min 限制时，保持原始选项
- **适用场景**：
  - ✅ 单选交互（任意选项类型）
  - ✅ 多选交互（任意选项类型，包括 min > 0）
  - ✅ 手牌选择（cardUid）
  - ✅ 场上单位选择（minionUid）
  - ✅ 基地选择（baseIndex）
  - ✅ 非引用选项（skip/done/confirm）
- **手动覆盖**（特殊场景）：
  ```typescript
  // 复杂刷新逻辑（如从弃牌堆/牌库/continuationContext 中过滤）
  const interaction = createSimpleChoice(id, playerId, title, initialOptions, sourceId);
  (interaction.data as any).optionsGenerator = (state, iData) => {
      // 从弃牌堆过滤随从（通用刷新只处理 hand）
      const p = state.core.players[playerId];
      const minions = p.discard.filter((c: any) => c.type === 'minion');
      return minions.map((c: any) => ({
          id: `discard-${c.uid}`,
          label: getMinionName(c.defId),
          value: { cardUid: c.uid, defId: c.defId }
      }));
  };
  ```
- **覆盖率**：100%（所有交互自动刷新）

#### Reducer 必须结构共享（强制）
- `reduce(core, event)` 中**禁止 `JSON.parse(JSON.stringify())`**（全量深拷贝）。
- 正确做法：只 spread 变更路径。例：`{ ...core, players: { ...core.players, [pid]: { ...player, hp: player.hp - dmg } } }`。
- 嵌套超过 3 层时，提取 helper：`updatePlayer(core, pid, patch)` / `updateResource(player, resId, delta)`。
- 需要批量变更时可用 Immer（`produce`），但单字段更新优先 spread。

#### 文件结构默认拆分（强制）
> 原则：中等以上复杂度的游戏（命令数 ≥5 或有多阶段回合）从第一天就用拆分结构，不等超限。
- **types 默认拆分**：`core-types.ts`（状态接口）+ `commands.ts`（命令类型）+ `events.ts`（事件类型），`types.ts` 为 re-export barrel。仅当命令+事件总共 <10 个时允许合并在单文件。
- **game.ts 默认拆分**：FlowHooks → `domain/flowHooks.ts`，CheatModifier → `domain/cheatModifier.ts`。game.ts 只做组装。
- **Board.tsx 默认拆分**：业务 hooks → `hooks/`，子区域组件 → `ui/`。Board.tsx 只做布局组装。
- **reducer.ts / execute.ts**：当命令/事件类型超过 15 个时，按实体/子系统拆分到子目录，主文件只做分发。
- **统一底线**：无论是否默认拆分，任何单文件超过 1000 行必须立即拆分。

#### 目录结构规范（强制）
- **按子域分类建目录**：新增文件时按业务子域归入对应子目录，禁止平铺堆积在父目录。同一目录下同级文件不得超过 15 个（不含 index.ts/types.ts）。
- **子目录命名**：kebab-case，反映业务含义（`combat/`、`overlays/`、`cards/`），禁止 `misc/`、`utils/`、`new/` 等无意义名称。
- **拆分后保留 barrel**：父目录 `index.ts` 统一 re-export，消费方 import 路径不变。
- **嵌套深度上限 5 层**（从 `src/` 起算），超过优先扁平化。
- **现有超限目录**（`dicethrone/domain`、`dicethrone/ui`、`summonerwars/ui`）：新增文件时必须顺带拆分，禁止继续堆积。

#### 游戏内工具函数单一来源（强制）
- 每个游戏的 `domain/utils.ts` **从第一天就建立**，放置 `applyEvents`、`getOpponentId`、`updatePlayer` 等共享工具。
- 引擎层已提供的能力（如游戏模式判断）禁止在游戏层重新实现，应 import 引擎层导出。
- 禁止在 `game.ts`、`execute.ts`、`rules.ts` 中重复定义相同逻辑的辅助函数。

#### Core 状态准入（强制）
- **准入条件**：字段必须被 `reduce()` 消费，且影响 `validate()` / `execute()` / `isGameOver()` 的决策。
- **禁止放入 core 的**：纯 UI 展示状态（如 `lastPlayedCard`、`lastBonusDieRoll`）→ 应通过 EventStreamSystem 事件传递给 UI；交互等待状态（如 `pendingXxx`）→ 应使用 `sys.interaction`。
- **例外**：如果某个"展示"字段同时影响规则判定（如 `pendingAttack` 影响防御阶段流转），则允许放在 core，但必须注释说明其规则依赖。

#### 性能反模式清单（强制）
- ❌ `JSON.parse(JSON.stringify(state))` — 用结构共享替代
- ❌ reducer 内创建新数组/对象但内容未变 — 先检查是否需要变更再 spread
- ❌ `Array.filter().map()` 链式调用处理大数组 — 合并为单次 `reduce()` 遍历
- ❌ 在 `execute()` 中调用 `reduce()` 模拟状态推演超过 3 次 — 重构为事件后处理或 `postProcess`

### 模式差异（local/online/tutorial）（强制）
- **模式来源**：统一使用 `GameModeProvider` 注入 `mode`，写入 `window.__BG_GAME_MODE__`。
- **本地模式（local）**：不做领域校验（`skipValidation=true`），视角单一，入口 `/play/:gameId/local`。
- **联机模式（online）**：严格校验，按玩家身份限制交互。
- **教学模式（tutorial）**：走 `MatchRoom`，默认与联机一致。
- **唯一判断来源**：`src/games/*/manifest.ts` 的 `allowLocalMode`。
- **联机优先（强制）**：当前除井字棋（tictactoe）外，所有游戏均 `allowLocalMode=false`，开发和测试以联机模式为准。E2E 测试必须使用 `setupOnlineMatch` 创建在线对局，禁止使用 `page.goto('/play/<gameId>/local')`。

### i18n（强制）
- 通用文案 → `public/locales/{lang}/common.json`；游戏文案 → `game-<id>.json`。
- 新增文案必须同步 `zh-CN` 与 `en`；通用组件禁止引用 `game-*` namespace。

---

（核心规则）

> **新增/修改图片或音频资源引用时必须先阅读 `docs/ai-rules/asset-pipeline.md`**

- **所有图片必须压缩后使用**：用 `OptimizedImage` / `getOptimizedImageUrls`，路径不含 `compressed/`（自动补全）。
- **图片压缩规范（强制）**：
  - **运行时使用**：所有图片必须通过 `OptimizedImage` / `getOptimizedImageUrls` 使用，路径不含 `compressed/`（自动补全）
  - **AI 读取/分析**：任何需要读取/分析图片内容的场景（OCR、数据录入、视觉验证），优先读取 `public/assets/i18n/zh-CN/<gameId>/images/compressed/*.webp`
    - 未压缩则先运行 `npm run assets:compress` 生成 WebP 压缩版本
    - 禁止直接读取原始大图（体积大、加载慢），除非压缩流程失败需要回退
    - 压缩命令：`npm run assets:compress` 会自动扫描所有游戏资源目录，生成 WebP 格式并保存到 `compressed/` 子目录
- **国际化资源架构（强制）**：
  - **当前状态**：所有游戏图片资源已迁移到 `public/assets/i18n/zh-CN/<gameId>/` 目录。
  - **代码行为**：`OptimizedImage` 和 `CardPreview` 会自动从 `i18next` 获取当前语言（`i18n.language`），无需手动传递 `locale` prop。路径自动转换：`dicethrone/images/foo.png` → `i18n/zh-CN/dicethrone/images/foo.png`。
  - **无需手动传递 locale（强制）**：所有使用 `OptimizedImage`/`CardPreview` 的地方，禁止手动传递 `locale` prop（除非测试或特殊场景需要覆盖）。组件会自动从 i18next 获取当前语言。
  - **图集加载最佳实践（强制）**：
    - **均匀网格**：使用 `registerLazyCardAtlasSource(id, { image, grid: { rows, cols } })`，尺寸从预加载缓存自动解析，零配置文件。SmashUp 和 SummonerWars 均使用此模式。
    - **不规则网格**：使用 `registerCardAtlasSource(id, { image, config })`，config 从静态 JSON import。DiceThrone 使用此模式。
    - **注册时机**：模块顶层同步注册，禁止在 `useEffect` 中异步注册（消除首帧 shimmer）。
    - **SummonerWars 模式**：`initSpriteAtlases(locale)` 同时注册 `cardAtlasRegistry`（懒解析）和 `globalSpriteAtlasRegistry`（即时解析），后者需要 locale，必须在组件 `useEffect` 中调用。
    - **核心原则**：图片资源需要国际化（路径包含 `/i18n/{locale}/`），图集配置文件不需要国际化。
  - **未来扩展**：英文版上线时，将英文图片放入 `i18n/en/<gameId>/`，代码无需修改。
  - **CDN 部署**：运行 `npm run assets:upload -- --sync` 同步到 CDN。
- **音频架构（强制）**：
  - **设计规范**：显式 > 隐式、智能默认 + 可覆盖、单一真实来源、类型安全
  - **事件定义**（`domain/events.ts`）：使用 `defineEvents()` 定义音频策略
    ```typescript
    // 1. 声明音效 key 常量
    const CARD_DRAW_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_take_001';
    const TURN_CHANGE_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';
    
    // 2. 定义事件（完整形式：{ audio: 策略, sound: key }）
    export const EVENTS = defineEvents({
      'game:card_drawn': { audio: 'immediate', sound: CARD_DRAW_KEY },
      'game:turn_changed': { audio: 'immediate', sound: TURN_CHANGE_KEY },
      'game:state_synced': { audio: 'silent', sound: null },
    });
    ```
  - **音效策略**：`'ui'`（本地交互）| `'immediate'`（即时反馈）| `'fx'`（动画驱动）| `'silent'`（无音效）
  - **feedbackResolver**：基础版 `createFeedbackResolver(EVENTS)`（1 行），高级版保留特殊逻辑 + 调用基础版（~30 行）
  - **禁止重复播放**：每个事件的音效只在一个地方播放（UI 层 / EventStream / FX 系统）
  - **百游戏标准**：新增游戏事件定义 ≤ 20 行，feedbackResolver 1 行或 ~30 行，UI 组件 0 行音效代码
  - **完整形式强制（强制）**：所有 'immediate' 事件必须使用完整形式 `{ audio: 'immediate', sound: KEY }`，禁止简洁形式 `'immediate'`（会导致 sound 为 null）

---

## 🔄 标准工作流

### 代码质量检查（强制）
- **ESLint 检查（强制）**：修改 `.ts`/`.tsx` 文件后，必须运行 `npx eslint <修改的文件路径>` 确认 0 errors（warnings 可忽略）。存在 error 时必须立即修复再继续。
- **TypeScript 编译检查（推荐）**：大范围重构后运行 `npx tsc --noEmit` 确认无类型错误。

### 验证测试（Playwright 优先）
- 详细规范见 `docs/automated-testing.md`。
- **工具**：Playwright E2E / Vitest / GameTestRunner / 引擎层审计工厂（`src/engine/testing/`）。
- **GameTestRunner 优先（强制）**：GameTestRunner 行为测试是最优先、最可靠的测试手段。审计工厂（entityIntegritySuite / interactionChainAudit / interactionCompletenessAudit）是补充，用于批量覆盖注册表引用完整性和交互链完整性。
- **命令**：
  - 开发模式（推荐）：先运行 `npm run dev` 启动所有服务，再在另一终端运行 `npm run test:e2e`
  - CI 模式：`npm run test:e2e:ci`（自动启动服务器，适用于 CI/CD 环境）
  - 清理端口：`npm run test:e2e:cleanup`（测试异常退出导致端口占用时使用）
- **截图规范**：禁止硬编码路径，必须用 `testInfo.outputPath('name.png')`。
- **禁止杀掉所有 Node.js 进程（强制）**：
  - ❌ 禁止：`taskkill /F /IM node.exe`、`killall node`、`pkill node`、`Get-Process node | Stop-Process -Force`
  - 原因：会杀掉所有 Node.js 进程（其他项目服务器、VS Code 语言服务器、调试器、正在运行的测试等）
  - ✅ 正确：**优先清理单个测试的端口**（查找 PID 后 `taskkill /F /PID <PID>`），或使用 `node scripts/infra/port-allocator.js <workerId>` 清理特定 worker
  - ⚠️ 谨慎使用：`npm run test:e2e:cleanup` 会清理所有测试环境端口，会中断其他并行测试
  - 详见 `docs/automated-testing.md`「危险操作警告」节
- **E2E 测试环境依赖（强制）**：
  - **端到端测试失败时必须先检查服务依赖（强制）**：E2E 测试依赖前端开发服务器（Vite）、游戏服务器（game-server）、API 服务器（api-server）三个进程同时运行。
  - **推荐工作流**：
    1. **开发模式**（手动启动服务，推荐）：
       - 终端 1：`npm run dev`（启动所有服务）
       - 终端 2：`npm run test:e2e`（运行测试）
    2. **CI 模式**（自动启动服务）：
       - 单终端：`npm run test:e2e:ci`
    3. **清理端口占用**（测试异常退出后）：
       - `npm run test:e2e:cleanup`
  - **测试失败排查顺序**：
    1. **检查端口配置**：读取 `.env` 文件确认 `VITE_DEV_PORT`（默认 3000）、`GAME_SERVER_PORT`（默认 18000）、`API_SERVER_PORT`（默认 18001）配置正确。
    2. **检查服务状态**：运行 `netstat -ano | findstr ":<端口号>"` 或 `Get-NetTCPConnection -LocalPort <端口号>` 确认三个端口是否被占用。
    3. **验证服务可达性**：
       - 前端：访问 `http://localhost:3000`（或 `.env` 中配置的端口）
       - 游戏服务器：访问 `http://localhost:18000/games`（应返回游戏列表）
       - API 服务器：访问 `http://localhost:18001/auth/status`（应返回认证状态）
    4. **验证代理配置**：检查 `vite.config.ts` 中的 `server.proxy` 配置是否与 `.env` 端口一致。
    5. **清理遗留连接**：运行 `npm run test:e2e:cleanup` 清理测试遗留的端口占用和 WebSocket 连接。
  - **端口冲突处理**：若端口被占用，优先运行 `npm run test:e2e:cleanup` 清理，或手动使用 `taskkill /F /PID <PID>` 终止占用进程（确认非关键进程后）。
  - **测试超时排查**：若测试超时（timeout），优先检查是否为服务未启动或端口配置错误，而非直接修改测试代码的超时时间。
  - **为什么会端口占用**：E2E 测试会创建多个 BrowserContext 和 WebSocket 连接，如果测试异常退出或清理不完整，这些连接可能不会被正确关闭，导致端口持续被占用。使用 `npm run test:e2e:cleanup` 可以强制清理所有相关进程。
- **E2E 测试必须使用 Fixture（强制）**：新增 E2E 测试必须使用 `e2e/fixtures/index.ts` 提供的 fixture，禁止手写房间创建和清理代码。使用 `import { test, expect } from './fixtures'` 替代 `@playwright/test`。特殊场景需要自定义配置时，使用工厂函数（`createSmashUpMatch` 等）。详见 `docs/automated-testing.md`「使用 Fixture 简化测试」节。
- **E2E 覆盖要求（强制）**：必须覆盖交互链（用户操作→系统响应→状态变更的完整流程）和特殊交互（非标准流程、边界条件、异常处理）。同种类型的交互只需覆盖一个代表性用例，可省略重复测试。
- **静态审计要求**：新增游戏时根据游戏特征选择引擎层审计工具。选型指南见 `docs/ai-rules/engine-systems.md`「引擎测试工具总览」节。
- **描述→实现全链路审查（强制）**：以下场景必须执行——① 新增技能/Token/事件卡/被动/光环 ② 修复"没效果"类 bug ③ 审查已有机制 ④ 重构消费链路。**当用户说"审计"/"审查"/"审核"/"检查实现"/"核对"等词时，必须先阅读 `docs/ai-rules/testing-audit.md`「描述→实现全链路审查规范」节，按规范流程执行并输出矩阵，禁止凭印象回答。** 该文档为审查规范的唯一权威来源。
- **数据查询一致性审查（强制）**：新增"修改/增强/共享"类机制后，必须 grep 原始字段访问，确认所有消费点走统一查询入口。详见 `docs/ai-rules/testing-audit.md`「数据查询一致性审查」节。
- **元数据语义一致性审查（强制）**：新增/修改 custom action handler 后，必须确认 `categories` 声明与实际输出一致。详见 `docs/ai-rules/testing-audit.md`「元数据语义一致性审计」节。
- **Custom Action target 间接引用审查（强制）**：新增/修改 custom action handler 后，必须确认 handler 中 DAMAGE_DEALT/STATUS_APPLIED 的 targetId 来源正确——进攻伤害/debuff 用 `ctx.ctx.defenderId`，自我增益用 `ctx.targetId`。详见 `docs/ai-rules/testing-audit.md`「D10 子项：Custom Action target 间接引用审计」。
- **验证层有效性门控（强制）**：有代价的技能（消耗充能/魔力等），验证层必须确保操作至少能产生一个有意义的效果，否则拒绝激活。`quickCheck` 必须与 `customValidator` 前置条件对齐。详见 `docs/ai-rules/testing-audit.md`「D7 子项：验证层有效性门控」。
- **阶段结束技能时序对齐（强制）**：阶段结束时需要玩家确认的技能（描述含"你可以"/"may"），`onPhaseExit` 必须返回 `{ halt: true }` 阻止阶段推进，UI 跳过时必须 dispatch `ADVANCE_PHASE` 恢复流程。**事件产生门控必须普适生效**：`triggerPhaseAbilities` 等循环中的门控函数（如 `canActivateAbility`）禁止用 `abilityId === 'xxx'` 限定为特定技能，必须对所有同类技能生效。详见 `docs/ai-rules/testing-audit.md`「D8 子项：引擎批处理时序与 UI 交互对齐」。
- **"可以/可选"效果必须有交互确认（强制）**：描述中"你可以"/"may"→ 必须有确认/跳过 UI，禁止自动执行。
- **测试必须验证状态变更（强制）**：事件发射 ≠ 状态生效，必须断言 reduce 后的最终状态。详见 `docs/ai-rules/testing-audit.md`「审计反模式清单」。
- **多系统协作测试必须断言所有相关系统状态（强制）**：涉及多个引擎系统协作的功能（如响应窗口+交互系统），测试必须同时断言所有相关系统的状态字段。只断言 `sys.interaction.current` 存在但不断言 `sys.responseWindow.current` 仍打开 = 测试通过但功能实际无效。详见 `docs/ai-rules/testing-audit.md`「D8 子项：多系统 afterEvents 优先级竞争」。
- **E2E 测试禁止使用本地模式（强制）**：除井字棋外所有游戏 `allowLocalMode=false`，E2E 测试必须使用 `setupOnlineMatch` 创建在线对局，通过调试面板（`readCoreState`/`applyCoreStateDirect`/`applyDiceValues`）注入状态。禁止使用 `page.goto('/play/<gameId>/local')`（井字棋除外）、禁止假设 `window.__BG_DISPATCH__`/`window.__BG_STATE__` 等全局变量存在。

---

## 🎨 UI/UX 规范（核心规则）

> **开发/修改 UI 组件或布局时必须先阅读 `docs/ai-rules/ui-ux.md`**

- **PC-First**，移动端 Best-effort。
- **深度感分级**：重点区域毛玻璃+软阴影，高频更新区域禁止毛玻璃。
- **动态提示 UI 必须 `absolute/fixed`**，禁止占用布局空间。层级：提示 z-[100-150]，交互 z-[150-200]，Modal z-[200+]。
- **临时/瞬态 UI 不得挤压已有布局（强制）**：攻击修正徽章、buff 提示、倒计时标签等"出现/消失"的临时 UI 元素，必须使用 `absolute`/`fixed` 定位，禁止插入 flex/grid 正常流导致其他元素位移。
- **数据/逻辑/UI 分离**：UI 只负责展示与交互。
- **游戏 UI 设计系统**：`design-system/game-ui/MASTER.md`（通用）+ `design-system/styles/`（风格）。
- **新增 UI 元素必须配合现有风格（强制）**：即使只改一个文件，新增的按钮/面板/提示等 UI 元素必须复用同模块已有组件（如 `GameButton`）和现有样式变量，禁止手写不一致的原生样式。修 bug 和微调不受此约束。
- **游戏内 UI 组件单一来源（强制）**：同一类 UI 功能只允许一个组件实现，所有场景必须复用。卡牌展示/选择统一用 `PromptOverlay`（SmashUp），禁止新建功能重叠的组件。详见 `docs/ai-rules/ui-ux.md` §1.1。
- **大规模 UI 改动**（≥3 组件文件 / 新增页面 / 全局风格调整）须先读设计系统，详见 `docs/ai-rules/ui-ux.md` §0。
