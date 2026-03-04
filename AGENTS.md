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
- `docs/ai-rules/undo-auto-advance.md` — **了解撤回后自动推进问题时必读**。含问题根源、引擎层通用解决方案（FlowSystem.afterEvents 统一检查 restoredRandomCursor）、测试要求。**引擎层已统一处理，游戏层无需额外代码。**
- **多 afterScoring 交互链式传递（已修复 bug，通用方案）**：当有多个 afterScoring 交互时（如多个大副、母舰+侦察兵），`_deferredPostScoringEvents` 必须在交互链中传递。**引擎层通用修复**：`src/engine/systems/InteractionSystem.ts` `resolveInteraction` 函数在弹出下一个交互时，自动检查当前交互的 `continuationContext._deferredPostScoringEvents`，如果有则自动传递给下一个交互。**游戏层简化**：交互处理器只需检查是否是最后一个交互（`!state.sys.interaction?.queue?.length`），如果是则补发延迟事件。**延迟事件必须在补发后清除**：补发延迟事件后，必须立即清除 `_deferredPostScoringEvents`，避免事件在交互链中传播时被多次补发。**这是面向百游戏的通用解决方案**，适用于所有可能创建 afterScoring 交互的场景（随从 trigger + 基地能力），无需每个交互处理器手动实现传递逻辑。**教训**：多交互场景必须考虑延迟事件的传递链路和清理时机，不能假设只有一个交互。详见 `evidence/smashup-multi-base-infinite-loop-fix.md` 和 `evidence/smashup-multi-base-duplicate-events-fix.md`。
- `docs/ai-rules/testing-audit.md` — **审查实现完整性/新增功能补测试/修"没效果"类 bug/规划审计 spec 时必读**。含**通用实现缺陷检查维度（D1-D49 穷举框架）**、描述→实现全链路审查规范（唯一权威来源）、数据查询一致性审查、元数据语义一致性审计、引擎 API 调用契约审计（D3 子项）、交互模式语义匹配（D5 子项）、验证层有效性门控（D7 子项）、验证-执行前置条件对齐（D2 子项）、引擎批处理时序与 UI 交互对齐（D8 子项）、事件产生门控普适性检查（D8 子项）、多系统 afterEvents 优先级竞争（D8 子项）、Reducer 消耗路径审计（D11）、写入-消耗对称（D12）、多来源竞争（D13）、回合清理完整（D14）、UI 状态同步（D15）、条件优先级（D16）、隐式依赖（D17）、否定路径（D18）、组合场景（D19）、状态可观测性（D20）、触发频率门控（D21）、伤害计算管线配置（D22）、架构假设一致性（D23）、Handler 共返状态一致性（D24）、替代路径后处理对齐（D32）、交互选项 UI 渲染模式正确性（D34）、流程控制标志清除完整性（D39）、后处理循环事件去重完整性（D40）、系统职责重叠检测（D41）、事件流全链路审计（D42）、重构完整性检查（D43）、测试设计反模式检测（D44）、Pipeline 多阶段调用去重（D45）、交互选项 UI 渲染模式声明完整性（D46）、E2E 测试覆盖完整性（D47）、UI 交互渲染模式完整性（D48）、**abilityTags 与触发机制一致性（D49）**、效果语义一致性审查、审计反模式清单、测试策略与工具选型。**当用户说"审计"、"审查"、"审核"、"核对"、"对一下描述和代码"等词时，必须先阅读本文档。"检查"不算触发词，不自动启动审计流程。规划/设计审计类 spec（requirements/design/tasks）时也必须先阅读本文档，逐条对照 D1-D49 维度确认覆盖范围。**
- `docs/testing-best-practices.md` — **编写测试或测试失败时必读**。含测试工具选择（GameTestRunner/runCommand/E2E）、状态对象类型（Core vs MatchState）、常见错误模式（传递裸 Core、期望错误返回值、不控制随机数）、测试辅助函数（helpers.ts 工具）、测试编写检查清单、迁移指南、**E2E 测试框架最佳实践（GameTestContext API、轮询间隔优化、同步等待+异步降级、服务器就绪检查、测试前自动检查、性能基准、稳定性保障）**。**补充 `docs/automated-testing.md`，专注于测试编写的常见陷阱和最佳实践。**

- `docs/ai-rules/ui-ux.md` — **开发/修改 UI 组件、布局、样式、游戏界面时必读**。含审美准则、多端布局、游戏 UI 特化、设计系统引用。
- `docs/ai-rules/global-systems.md` — **使用/修改全局 Context（Toast/Modal/音频/教学/认证/光标）时必读**。含 Context 系统、实时服务层、**光标主题系统**（自注册流程、形态规范、偏好持久化、设置弹窗交互逻辑）。
- `docs/ai-rules/doc-index.md` — **不确定该读哪个文档时必读**。按场景查找需要阅读的文档。
- `docs/temp-files-management.md` — **创建临时文件或清理根目录时必读**。含临时文件分类规则、目录结构、.gitignore 规则、开发规范。
- `docs/git-merge-checklist.md` — **执行 Git 合并操作时必读**。含合并前检查清单、冲突处理策略、合并后验证、AI 特定规范、常见错误与解决方案。**AI 执行任何 `git merge` 前必须先阅读本文档并执行预检查**。
- `.windsurf/skills/create-new-game/SKILL.md` — **创建/添加新游戏时必读**。含六阶段工作流、验收门禁、引擎原语选型。必须先开分支（`feat/game-<gameId>`）再开始。
- `docs/deploy.md` — **涉及部署、构建产物、环境变量注入、线上与本地行为差异、CDN/R2 资源加载问题时必读**。含镜像部署、Cloudflare Pages 分离部署、资源映射、环境变量配置。
  - **生产部署操作规范（强制）**：生产环境更新必须使用 `bash scripts/deploy/deploy-image.sh update`（基于 `docker-compose.prod.yml`）。**禁止在生产服务器上直接运行 `docker compose up -d`**（会使用默认的 `docker-compose.yml`，端口映射和环境变量与生产不同）。排查生产问题时，必须先读 `docs/deploy.md` 了解部署架构，禁止凭猜测给出服务器操作命令。

---

## 📋 角色与背景

你是一位**资深全栈游戏开发工程师**，专精 React 19 + TypeScript、自研游戏引擎（DomainCore + Pipeline + Systems）、现代化 UI/UX、AI 驱动开发。
项目是 AI 驱动的现代化桌游平台，核心解决"桌游教学"与"轻量级联机"，支持 UGC。包含用户系统（JWT）、游戏大厅、状态机驱动的游戏核心、分步教学系统、UGC 原型工具。

### 测试编写规范（强制）

> **核心原则：E2E 测试验证 UI 交互，单元测试验证业务逻辑，绝不混淆**

#### E2E 测试强制要求（UI 交互必须用 E2E）
1. **必须使用新测试框架（强制）**：
   - ✅ 使用 `GameTestContext` API（`e2e/framework/GameTestContext.ts`）
   - ❌ 禁止使用旧 API（`setupSmashUpOnlineMatch`、`readCoreState`、`applyCoreState`）
   - 示例：`const ctx = await gameTest.createMatch('smashup', { factions: [...] });`
2. **必须实际运行并通过（强制）**：
   - AI 编写测试后必须立即运行 `npm run test:e2e:ci -- <测试文件名>`
   - 禁止交给用户手动运行
   - 测试失败必须修复，不得跳过或降低标准
3. **必须自审截图（强制）**：
   - 使用 `await ctx.player(0).screenshot({ path: 'test-results/xxx.png' });` 保存截图
   - **必须使用 `mcp_image_viewer_view_image` 查看所有测试截图**：AI 必须实际查看 `test-results/` 目录中的每一张截图，分析截图内容（游戏状态、UI 元素、交互结果）
   - 确认 UI 显示正确、交互流程完整、没有视觉错误
   - 用户只需看截图即可验证，无需运行测试
   - **注意**：此规定仅适用于 E2E 测试生成的截图，用户上传的截图直接从对话中查看
4. **必须创建证据文档（强制）**：
   - 测试通过后，创建 `evidence/<功能名>-e2e-test.md`
   - 嵌入所有测试截图（使用相对路径 `![描述](../test-results/...)`）
   - 分析截图内容（显示了什么、状态是否正确、交互是否完整）
   - 记录测试场景、验收标准、测试结果
5. **绝对禁止用单元测试糊弄（强制）**：
   - ❌ UI 交互（点击、拖拽、悬停、展示、提示）→ 必须用 E2E 测试
   - ❌ 多玩家协作（展示给所有人、对手视角、权限控制）→ 必须用 E2E 测试
   - ❌ 动画/特效（粒子、过渡、序列动画）→ 必须用 E2E 测试
   - ✅ 业务逻辑（计算、验证、状态更新）→ 可以用单元测试
6. **测试失败处理流程（强制）**：
   - **第一步**：加日志定位根因（在关键决策点加 `console.log`）
   - **第二步**：审查调用链（从 UI 组件到业务逻辑，逐层检查）
   - **第三步**：修复代码或调整测试（可以修改测试、增加新游戏模式、重构框架）
   - **禁止**：跳过测试、降低标准、用单元测试替代、交给用户手动验证

#### 测试文件管理（强制）
1. **禁止创建新测试文件**：新增功能/修复 bug 时，必须先搜索现有测试文件，在相关测试文件中补充测试用例
2. **搜索现有测试**：使用 `grepSearch` 搜索相关的 defId/能力名/功能关键词，找到已有的测试文件
3. **典型测试优先**：同类型的测试只需要 1-2 个典型用例，不需要穷举所有场景
4. **测试覆盖范围**：
   - ✅ 正常流程（happy path）：1 个典型用例
   - ✅ 边界条件（edge cases）：1-2 个关键场景
   - ❌ 不需要：所有可能的组合、重复的场景、已有测试覆盖的通用逻辑

#### 测试实现验证（强制）
1. **先验证实现是否工作**：编写测试前，必须先确认实现是否正确工作
   - 检查验证逻辑（validate.ts）：功能是否被正确允许/拒绝
   - 检查执行逻辑（execute.ts/reducer.ts）：事件是否正确生成
   - 检查触发时机（domain/index.ts）：是否在正确的阶段触发
2. **运行现有测试**：修改实现后，必须运行相关的现有测试确认没有破坏功能
3. **测试失败时先修实现**：测试失败时，优先检查实现是否正确，而不是修改测试

#### 测试用例设计（强制）
1. **使用真实场景**：测试用例必须模拟真实游戏场景，不能使用不可能的状态
   - ✅ 正确：基地力量达到 breakpoint，触发 Me First! 窗口
   - ❌ 错误：基地力量不足，期望触发 Me First! 窗口
2. **最小化测试数据**：只创建测试所需的最少数据，不创建无关的随从/卡牌/基地
3. **清晰的断言**：断言必须明确验证功能的核心行为，不验证无关的副作用

#### 教训记录
- **2026-03-04**：Special Timing 修复时，错误创建了新测试文件 `special-timing-fix.test.ts`，应该更新现有的 `newFactionAbilities.test.ts` 和 `expansionOngoing.test.ts`
- **2026-03-04**：测试用例设计错误，基地力量不足无法触发 Me First! 窗口，导致测试失败。应该先验证实现是否工作，再编写测试
- **2026-03-04**：Special Timing "没有效果" bug - 用户反馈"承受压力和重返深海没触发效果"，实际是前置条件不满足（没有其他基地上的己方随从可以接收力量指示物），不是 bug。**核心问题是 ActionLog 没有记录"没有效果"的原因**。修复方案：当交互处理器返回空事件时，生成 `ABILITY_FEEDBACK` 事件，ActionLog 显示"场上没有符合条件的目标"。**教训**：不要假设"没有效果"就是 bug，先确认是否是前置条件不满足，如果是则改进反馈而不是修改逻辑。详见 `evidence/special-timing-feedback-fix.md`。
- **2026-03-04**：印斯茅斯"本地人"展示 bug - 用户反馈"展示只给自己看"，AI 花了多轮验证配置、加日志、修改类型定义，但没有运行 E2E 测试验证修复是否生效。**教训**：UI 交互问题必须用 E2E 测试验证，不能只靠日志和代码审查。修复后必须立即运行测试并自审截图，确认两个玩家都能看到展示 UI。

### 游戏名称映射（强制）

> 用户提到中文名时，必须对应到正确的 gameId 和英文名。**禁止混淆**。

| gameId | 英文名 | 中文名 |
|--------|--------|--------|
| `smashup` | Smash Up | 大杀四方 |
| `dicethrone` | Dice Throne | 王权骰铸 |
| `summonerwars` | Summoner Wars | 召唤师战争 |
| `tictactoe` | Tic Tac Toe | 井字棋 |

### 大杀四方 Wiki 爬虫规范（强制）

> **查 Wiki/核对 Wiki/录入数据/审计时，涉及大杀四方必须用爬虫，禁止凭记忆。**

**触发场景**：数据录入、数据核对、审计检查、效果描述查询

**工具**：
- `scripts/scrape-wiki-with-descriptions.mjs` — 抓取 Wiki 数据
- `scripts/final-wiki-code-comparison.mjs` — 对比代码与 Wiki

**流程**：
1. `node scripts/scrape-wiki-with-descriptions.mjs` 抓取数据
2. `node scripts/final-wiki-code-comparison.mjs` 生成差异报告
3. 根据报告用 `strReplace`/`editCode` 修复

**注意**：
- Wiki 用弯引号（`'`），代码用直引号（`'`），对比时需考虑编码差异
- Wiki 可能有勘误重复（如 Saucy Wench vs Cut Lass），代码只保留勘误版
- 数据可缓存，除非用户要求"重新抓取"

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
- **测试运行范围（强制）**：详见下文「验证测试 → 测试触发条件」章节。简而言之：纯样式/文案/文档修改不需要测试，业务逻辑/引擎代码/领域层代码必须测试。
- **样式开发约束（核心规定）**：**当任务目标为优化样式/视觉效果时，严禁修改任何业务逻辑代码**。如需修改逻辑，必须单独申请。
- **目录/游戏边界严格区分（强制）**：修改/引用前必须以完整路径与所属 gameId 核对，禁止把不同游戏/模块的目录当成同一个。
- **规则文档指代（强制）**：当我说"规则"时，默认指该游戏目录下 `rule/` 文件夹中的规则 Markdown。
- **改游戏规则/机制前先读规则文档（强制）**：修改会影响玩法/回合/结算/效果等"规则或机制"时，必须先读 `src/games/<gameId>/rule/` 下的规则文档。**当规则文档不完整或与代码实现不一致时，应查阅官方规则书或 Wiki 确认正确行为**。发现规则文档缺失或错误时，必须同步更新文档。
- **Git 分支创建规范（强制）**：所有新分支必须从主分支（main/master）创建，禁止从其他功能分支分出。用户说"新建分支"时，默认指从主分支创建。添加新游戏必须开新分支（`feat/game-<gameId>`）。
- **Git 变更回退与暂存规范（强制）**：**所有 Git 回滚命令（`git restore`/`git checkout`/`git reset`/`git stash`/`git revert` 等）都必须先说明原因并获得用户明确许可后才能执行**。禁止在未获得许可的情况下执行任何会丢弃或恢复代码变更的 Git 命令。**修复 bug 时优先手动修改代码（使用 strReplace/editCode），禁止用 git restore 恢复文件后再修改**。PowerShell 恢复文件禁止用管道/Out-File，必须用 `cmd /c "git show <ref>:<file> > <file>"`。
- **Git 合并冲突处理规范（强制）**：
  - **合并前必须验证（强制）**：执行任何 `git merge` 前，必须先阅读 `docs/git-merge-checklist.md` 并执行预检查。
  - **核心原则**：
    - ✅ 使用 `git merge --no-commit --no-ff` 预览合并结果
    - ✅ 逐文件检查冲突，禁止盲目选择"接受当前更改"或"接受传入更改"
    - ✅ 合并后运行 `npx tsc --noEmit` 和核心测试验证
    - ❌ 禁止基于部分信息下结论，必须用 `git ls-files`/`git show`/`git diff` 验证
  - **详细流程见**：`docs/git-merge-checklist.md`（包含完整的检查清单、命令示例、预警阈值、验证步骤）
- **--no-verify 使用规范（强制）**：
  - **什么是 --no-verify**：`git commit --no-verify` 和 `git push --no-verify` 会跳过 Git hooks（lint-staged、ESLint、pre-push 测试等）。
  - **严格禁止场景**：
    - ❌ **绝对禁止**：当 ESLint 报告 **errors**（错误）时，禁止使用 `--no-verify` 提交
    - ❌ **绝对禁止**：当 pre-push 钩子中的测试失败时，禁止使用 `--no-verify` 推送
    - ❌ **绝对禁止**：涉及业务逻辑、引擎代码、领域层代码的提交
    - ❌ **绝对禁止**：修复 bug 或新增功能的提交
    - ❌ **绝对禁止**：任何包含 React 组件代码（`.tsx` 文件）的提交
    - ❌ **绝对禁止**：任何包含游戏逻辑代码（`domain/`、`execute.ts`、`reduce.ts`）的提交
  - **允许使用场景**（必须同时满足以下所有条件）：
    - ✅ 仅修改文档（`.md`）、配置文件（`.json`、`.yml`）、样式（`.css`）
    - ✅ ESLint 仅有 **warnings**（警告），无 **errors**（错误）
    - ✅ 不涉及任何代码逻辑变更
    - ✅ 已确认修改不会影响运行时行为
  - **违规后果**：使用 `--no-verify` 跳过错误会导致：
    - 代码质量下降，引入潜在 bug
    - CI/CD 流水线失败
    - 生产环境崩溃风险
    - 团队代码审查负担增加
  - **正确做法**：
    - ESLint errors → 必须修复所有错误后再提交
    - 测试失败 → 必须修复测试或修复代码后再推送
    - 无法立即修复 → 使用 `git stash` 暂存，或创建单独的修复提交
  - **AI 特别注意**：
    - ⚠️ **绝对禁止在任何情况下使用 `--no-verify`**
    - ⚠️ 如果 ESLint 报告 errors，必须立即修复，不得提交
    - ⚠️ 如果无法修复 errors，必须向用户说明问题并请求指导
    - ⚠️ 使用 `--no-verify` 是严重违规行为，会导致代码质量下降
- **文件移动/复制规范（强制）**：
  - **禁止使用 `robocopy /MOVE`**：移动操作会删除源文件，中途失败会导致数据丢失。
  - **推荐做法**：
    1. 先用 `robocopy <src> <dst> /E` 复制（不删除源）
    2. 验证目标完整性：对比文件数量和关键文件
    3. 确认无误后再手动删除源（如需要）
  - **IDE 工具优先**：单文件操作优先用 `smartRelocate`（自动更新引用）或 `fsWrite`/`strReplace`。
- **关键逻辑注释（强制）**：涉及全局状态/架构入口/默认行为必须写清晰中文注释。
- **日志规范（强制）**：使用 `src/lib/logger.ts` 工具输出日志，禁止直接使用 `console.log/error/warn`。logger 自动折叠详细信息，减少控制台噪音。开发环境配置见 `docs/dev-tools-setup.md`。
- **生产日志系统（强制）**：项目使用 Winston 日志系统（`server/logger.ts`），所有服务端关键操作必须记录日志。详见 `docs/logging-system.md`。
  - **业务日志**：使用 `gameLogger` 记录房间创建、命令执行、游戏结束、WebSocket 连接/断开、作弊检测等关键事件
  - **HTTP 日志**：Koa 中间件自动记录所有 HTTP 请求（排除 `/health` 和 `/metrics`）
  - **错误日志**：所有未捕获异常和命令失败必须记录完整堆栈
  - **日志格式**：JSON 格式（生产环境）+ 彩色文本（开发环境），使用 key=value 结构化字段
  - **日志存储**：`logs/` 目录，按日期自动轮转，普通日志保留 30 天，错误日志保留 90 天
  - **临时调试日志**：允许临时日志用于排障，不得引入额外 debug 开关，问题解决后必须清理
- **新增功能必须补充测试（强制）**：新增功能/技能/API 必须同步补充测试，覆盖正常+异常场景。详见 `docs/automated-testing.md` 和 `docs/testing-best-practices.md`（测试编写常见陷阱和最佳实践）。
- **E2E 测试必须使用 GameTestContext API（强制）**：所有新的 E2E 测试必须使用 `GameTestContext` API（`e2e/framework/GameTestContext.ts`），禁止使用旧的 helper 函数（`setupSmashUpOnlineMatch`、`readCoreState`、`applyCoreState` 等）或测试模式（`/play/<gameId>/test`）。E2E 测试用于验证 UI 交互，不得用 GameTestRunner 单元测试替代。详见 `docs/automated-testing.md`「测试框架 API（强制使用）」节。
  - **测试模式已过时（禁止使用）**：`/play/<gameId>/test?skipFactionSelect=true` 测试模式存在加载问题（卡在"加载 UNDEFINED..."），禁止在新测试中使用。必须使用 GameTestContext API。
  - **正确模式（GameTestContext + game fixture）**：
    ```typescript
    import { test, expect } from '@/e2e/framework';
    
    test('测试名称', async ({ game }, testInfo) => {
        // 1. 导航到游戏（自动启用 TestHarness）
        await game.page.goto('/play/smashup');
        
        // 2. 等待游戏加载
        await game.page.waitForFunction(
            () => (window as any).__BG_TEST_HARNESS__?.state?.isRegistered(),
            { timeout: 15000 }
        );
        
        // 3. 快速场景构建（跳过派系选择，直接注入状态）
        await game.setupScene({
            gameId: 'smashup',
            player0: { hand: ['ninja_infiltrate'] },
            currentPlayer: '0',
            phase: 'playCards',
        });
        
        // 4. 游戏动作
        await game.playCard('ninja_infiltrate');
        await game.waitForInteraction('ninja_infiltrate_pick');
        await game.selectOption('base-0');
        await game.confirm();
        
        // 5. 断言
        await game.expectPhase('playCards');
        
        // 6. 截图
        await game.screenshot('final-state', testInfo);
    });
    ```
  - **参考示例**：`e2e/smashup-ninja-infiltrate.e2e.ts`（使用 GameTestContext + setupScene）
- **E2E 测试必须通过并自审截图（强制）**：
  - **绝对禁止用单元测试糊弄**：UI 交互、多玩家协作、展示/提示等功能必须用 E2E 测试验证，不得用 GameTestRunner 单元测试替代
  - **测试必须实际运行并通过**：AI 编写测试后必须立即运行 `npm run test:e2e:ci -- <测试文件名>`，不得交给用户手动运行
  - **必须用 MCP 查看测试截图（强制）**：
    - **仅适用于 E2E 测试生成的截图**（`test-results/` 目录）
    - 使用 `mcp_image_viewer_list_images` 列出 `test-results/` 目录中的所有截图
    - 使用 `mcp_image_viewer_view_image` 查看每一张截图
    - 分析截图内容：游戏状态是否正确、UI 元素是否显示、交互是否完整、有无视觉错误
    - **必须实际查看图片**：不能凭想象或猜测截图内容
  - **用户上传的截图直接读取（强制）**：
    - 用户通过聊天上传的截图（拖拽到聊天框）会自动显示在对话中
    - 直接从对话中查看即可
    - MCP 工具仅用于读取文件系统中的图片文件（如 `test-results/`、`public/assets/` 等）
  - **测试失败必须修复**：测试失败时，优先定位根因（加日志、检查代码、审查调用链），可以修改测试、增加新游戏模式、重构框架，但绝不允许跳过测试或降低标准
  - **证据文档必须包含截图分析**：测试通过后，创建证据文档（`evidence/` 目录），嵌入所有测试截图并**详细分析截图显示的内容**（不能只列出路径）
  - **用户只需看截图即可验证**：截图必须清晰展示游戏状态、UI 元素、测试结果，用户无需运行测试或查看代码
- **E2E 测试必须使用 TestHarness（强制）**：E2E 测试中涉及随机性或需要快速构造测试场景时，必须使用 `TestHarness` 测试工具集。详见下文「验证测试 → E2E 测试环境依赖」章节和 `docs/automated-testing.md`。
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

> **核心原则：不要乱猜。用户遇到的肯定都是联机模式发生的 bug，一定是与规则不符才会进行反馈。**

#### 禁止猜测用户反馈是正常情况（强制第零步）
> **用户反馈 bug 时，默认就是 bug，立即进行全链路排查，禁止猜测是正常情况**

**强制规则**：
- ❌ **禁止**：用户反馈 bug 时，猜测"可能是游戏进行到某个阶段"、"可能是正常情况"、"可能是用户操作错误"、"可能是测试环境问题"
- ✅ **正确**：用户反馈 bug 时，**默认就是 bug**，立即进行全链路排查，不做任何"这可能不是 bug"的假设
- **原因**：用户反馈问题时已经确认是异常情况，不需要 AI 再次判断是否为 bug。

#### 截图/用户反馈分析（强制第一步）
> **禁止看截图就猜测，必须先用 grepSearch 搜索用户提到的关键词定位代码**

**强制流程**：
1. **[ ] 搜索关键词定位代码**：用户说"牌库" → 搜索 `t('ui.deck')`；说"弃牌堆" → 搜索 `t('ui.discard')`
2. **[ ] 读取代码确认渲染逻辑**：该组件应该渲染什么？用的是什么数据/路径？
3. **[ ] 对比截图与代码**：截图实际显示了什么？与代码预期的差异在哪里？

**禁止**：
- ❌ 看截图就猜测是哪个组件（相似 UI 元素会混淆，如牌库/弃牌堆）
- ❌ 不搜索关键词就直接修改代码
- ❌ 凭视觉相似性假设问题位置

**教训**：用户说"弃牌堆不显示"后澄清是"牌库不显示"，AI 看截图就猜是弃牌堆，实际应先搜索关键词定位代码。

#### 调用链全面检查（强制）
> **所有 bug 修复都必须完整检查整条调用链，无论问题表现如何**
> 
> **适用场景**：功能不生效、显示空白、点击无反应、数据错误、样式异常、性能问题等所有 bug

**强制检查清单**（每一层都必须逐项检查）：

对于调用链的每一层（A 调用 B），必须检查：

1. **[ ] 存在性检查**
   - B 的定义是否存在？（搜索函数/组件定义）
   - B 是否已注册？（如果需要注册，搜索 `register.*B`）
   - B 所在文件是否被 import？（搜索 `import.*B` 或 `import.*from.*B的文件路径`）
   
2. **[ ] 契约检查**
   - A 传递了什么参数？（读取 A 的调用代码）
   - B 期望什么参数？（读取 B 的函数签名和条件判断）
   - 类型是否匹配？值是否满足条件？
   
3. **[ ] 返回值检查**
   - B 返回了什么？（读取 B 的 return 语句）
   - A 如何使用返回值？（读取 A 的后续代码）
   - 返回值是否符合 A 的预期？

**检查报告格式**（必须包含所有检查项）：
```
调用链：A → B → C

层级 1: A → B
- [✅] 存在性：B 已定义在 file.ts:10，已注册，已被 A import
- [❌] 契约：A 传 { type: 'atlas' }，B 期望 type === 'renderer'
- [N/A] 返回值：（契约不匹配，无法继续）

层级 2: B → C
- [❌] 存在性：C 已定义但未注册，C 所在文件未被任何地方 import
- [N/A] 契约：（C 不存在，无法检查）
- [N/A] 返回值：（C 不存在，无法检查）

问题汇总：
1. A → B 契约不匹配
2. C 未注册且文件未被 import

修复方案：
1. 修改 A 传递 type: 'renderer'
2. 在入口文件添加 import './path/to/C'
```

**禁止**：
- ❌ 跳过任何一个检查项
- ❌ 只检查"我改的地方"
- ❌ 假设"肯定存在"不搜索确认
- ❌ 只检查契约（参数类型）不检查存在性（是否注册/import）
- ❌ 假设"这层肯定没问题"跳过某一层
- ❌ 看到一个定义就假设它是唯一的（必须搜索同名定义）

**强制执行**：
- ✅ 每一层都必须检查存在性、契约、返回值三项
- ✅ 从调用起点到最终执行点，逐层检查，不遗漏任何中间层
- ✅ 用 grepSearch 搜索确认，不凭记忆假设
- ✅ 在总结中输出完整的检查报告（见下文"排查完整性自检"模板）
- ✅ **禁止直接猜测修改代码**：必须先完成调用链检查，找到确切问题后再修改
- ✅ **修复错误时优先手动修改**：使用 strReplace/editCode 精确修改问题代码，禁止用 git restore 恢复整个文件

#### 用户反馈 Bug 排查规范（强制）
> **核心原则：用户反馈 bug 时，默认就是 bug，立即全链路审查代码，找不到问题再加日志**

**强制流程**：
1. **[ ] 直接相信用户反馈**：用户反馈 bug 时，**默认就是 bug**，不做"可能是正常情况"的假设
2. **[ ] 先全链路审查代码**（禁止直接加日志）：
   - **定位调用链**：用户说"XX 不显示" → 搜索关键词定位渲染组件 → 追踪调用链（父组件 → 中间层 → 渲染器）
   - **逐层检查**：每一层都检查存在性、契约、返回值（详见下文「调用链全面检查」）
   - **检查 early return**：每个 `if (xxx) return null` 的条件是否会触发
   - **检查数据流**：数据从哪里来？经过哪些转换？最终传递给谁？
   - **检查配置**：只在代码审查发现"数据应该存在但实际为 undefined"时才检查配置文件
3. **[ ] 代码审查没发现问题才加日志**：
   - **日志位置**：在调用链的关键决策点（early return、条件分支、图片加载、最终渲染）
   - **日志内容**：记录所有影响决策的变量（不只是结果，要记录中间状态）
   - **日志格式**：`console.log('[Component] Decision point:', { var1, var2, result });`
4. **[ ] 绝对禁止的操作**：
   - ❌ 看到 bug 就直接加日志（必须先审查代码）
   - ❌ 创建诊断脚本验证配置（浪费时间）
   - ❌ 在父组件加日志后就停止（必须追到最终执行点）
   - ❌ 只验证"写入链"不验证"消费链"（详见下文「写入-消费全链路排查」）
   - ❌ 假设"这层肯定没问题"跳过某一层（必须逐层检查）

**教训**：
- **2026-03-04**：用户反馈"本地人不显示"，AI 花了 10 轮验证配置文件（卡牌定义、图集配置、i18n、图片文件），全部正确，浪费时间。应该先审查 `SmashUpCardRenderer` 代码，找不到问题再加日志。
- **2026-03-04**：AI 在 HandArea 加日志后发现数据正确，但没有继续往下追到 SmashUpCardRenderer，又浪费一轮对话。**正确做法：先全链路审查代码（HandArea → CardPreview → SmashUpCardRenderer），找不到问题再在关键决策点加日志。**

#### 其他排查规范（按字母顺序）
- **同名/同类函数全量排查（强制）**：定位到某个函数/类型/变量时，必须先搜索项目中是否存在**同名或同签名的其他定义**（不同文件、不同作用域、不同返回类型）。确认调用点实际 import 的是哪个定义后，才能动手修改。禁止只看到一个定义就假设它是唯一的。
- **回归 bug 先 diff 再修（强制）**：遇到"之前好好的现在不行了"类问题，第一步必须 `git log` + `git show`/`git diff` 对比最后正常版本，找到引入问题的变更点。禁止跳过 diff 直接假设根因并重写代码。详见 `docs/ai-rules/golden-rules.md`「Bug 修复必须先 diff 原始版本」节。
- **资源/文件归属先查消费链路（强制）**：对任何文件做出"应该提交/应该忽略/应该放 CDN/应该本地"等归属判断前，**必须先追踪该文件的实际消费链路**——运行时谁加载它、从哪个 URL/路径加载、是生成产物还是手写源码、生成脚本是什么。禁止仅凭文件名、扩展名或"看起来像元数据"就下结论。**教训**：`registry.json` 看起来是"纯 JSON 元数据应该提交到 git"，实际运行时从 R2 CDN fetch，本地副本是脚本生成产物，不该入库。
- **事实/未知/假设**：提出方案前必须列出已知事实（来源）、未知但关键的信息、假设（含验证方法）。
- **修 Bug 证据优先**：证据不足时不得直接改代码"试试"，只能给出最小验证步骤或查看生产日志。
- **首次修复未解决且未定位原因**：必须查看生产日志（`logs/error-*.log`）或添加临时日志获取证据，标注采集点与清理计划。
- **禁止用"强制/绕过"掩盖问题**：不得放开安全限制/扩大白名单/关闭校验来掩盖根因。
- **写入-消费全链路排查（强制）**：排查"写入了但没生效"类 bug 时，禁止只验证写入链（定义→执行→reduce 写入）就判定"逻辑正常"。必须同时验证消费链路：**写入的状态何时被消费？消费窗口是否在写入之后？写入到消费之间是否有清理逻辑会先抹掉状态？** 画出完整的阶段/回合时间线，标注写入时机、消费窗口、清理时机三个点，确认写入→消费→清理的顺序正确。详见 `docs/ai-rules/testing-audit.md`「D8 子项：写入-消费窗口对齐」。**教训**：群情激愤在 magic 阶段写入 extraAttacks，但 attack 阶段已过，TURN_CHANGED 清理 extraAttacks，写入→清理之间不包含消费窗口，功能永远不生效但写入链全部正常。
- **API→Context→UI 三层数据链路排查（强制）**：排查"UI 不响应/数据不显示/点击无效"类 bug 时，禁止只在 UI 组件层反复猜测。必须从数据源头开始，逐层核查三层链路：① **API 层**：服务端实际返回的字段名和结构是什么？② **Context/Store 层**：前端拿到数据后是否做了正确的字段映射？存进 state 的数据结构是否与类型定义一致？③ **UI 组件层**：组件读取的字段名是否与 state 中的字段名匹配？**每层都必须实际查看代码确认，禁止假设"中间层肯定没问题"。** 截图/控制台中的异常信号（如显示 `?`/`undefined`/`NaN`、React key 警告）是数据层问题的强指示，必须立即往上游追溯。**教训**：聊天选择好友无法开始聊天，在 UI 组件层反复猜了一整轮，实际根因是 `SocialContext.refreshConversations` 没有做服务端→前端的字段映射（服务端返回 `{ user: { id, username }, unread }`，前端期望 `{ userId, username, unreadCount }`），导致 `conv.userId` 为 `undefined`。
- **单点修复必须全链路验证（强制）**：修复一个 bug 后，禁止只验证"修复点本身生效"就结束。必须沿数据流向下游走完：产生→传递→消费→清理，每一跳都确认行为正确。尤其注意：状态写入后是否同步到所有消费方（React state / localStorage / 闭包引用）、异步回调中捕获的变量是否为最新值、失败分支是否有合理降级而非直接终止。
- **连续两次未解决**：必须切换为"假设列表 → 验证方法 → 多方案对比"排查模式。
- **输出总结**：每次回复末尾必须包含 `## 总结` 区块。
- **排查完整性自检（修 bug 时强制）**：修复 bug 后，总结中必须包含以下自检：
  ```
  ## 排查完整性自检
  
  ### 调用链检查报告
  - 检查的层级：[列出所有检查过的调用层级]
  - 每层的存在性检查：[函数是否存在/注册/被 import]
  - 每层的契约检查：[参数/类型/返回值是否匹配]
  - 发现的问题：[列出所有不匹配或不存在的地方]
  - 修复方案：[列出修复内容]
  
  ### 根因反思
  - 问题分类：[显示空白/点击无反应/数据错误/...]
  - 根本原因：[一句话]
  - 为什么检查不全：[反思遗漏点]
  ```
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
- **Flex 滚动子元素必须加 `min-h-0`（强制）**：`flex-col` 容器中 `flex-1 overflow-y-auto` 的子元素必须同时加 `min-h-0`，否则内容被裁剪而非滚动。详见 `docs/ai-rules/ui-ux.md`。
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
  - **日志层与动画层必须使用相同的数据源（强制）**：所有消费同一数据的层级（日志格式化、动画跳字、UI 显示）必须使用相同的数据源，禁止在不同层级重复实现相同的计算逻辑（如护盾扣除、伤害计算），导致显示不一致。**正确做法**：从事件 payload 读取权威数据（如 `DAMAGE_DEALT.payload.shieldsConsumed`），所有层级都使用这个数据源。**错误做法**：日志层用 `shieldsConsumed` 计算，动画层用 `percentShields` + `fixedShieldsByTarget` 重新计算。详见 `docs/bugs/dicethrone-animation-log-sync.md` 和 `evidence/dicethrone-shield-animation-fix.md`。
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
  - **Options Pattern 扩展（强制）**：引擎层扩展必须使用 Options Pattern（默认行为 + 可选覆盖），确保向后兼容。`buildDamageBreakdownSegment` 的 `options` 参数可选，老游戏代码不需要修改。新功能（如护盾自动渲染）通过 `options.renderShields` 覆盖默认行为。详见 `docs/bugs/engine-options-pattern-summary.md`。
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
- **解决方案（opt-in 模式，面向100个游戏）**：
  - **默认不刷新**：向后兼容，已有代码无需修改
  - **显式声明刷新**：需要刷新时通过 `autoRefresh` 或 `optionsGenerator` 显式声明
  - **类型安全**：编译期检查，防止配置错误
  - **智能降级**：过滤后无法满足 multi.min 限制时，保持原始选项（安全）
- **使用方法**：
  1. **简单场景（autoRefresh）**：选项是引用类型（cardUid/minionUid/baseIndex），使用 `autoRefresh` 字段
     ```typescript
     createSimpleChoice(id, playerId, title, options, {
       sourceId: 'wizard_scry',
       autoRefresh: 'deck', // 从牌库刷新
     });
     ```
     支持的 `autoRefresh` 值：
     - `'hand'`：检查 cardUid 是否仍在手牌中
     - `'discard'`：检查 cardUid 是否仍在弃牌堆中
     - `'deck'`：检查 cardUid 是否仍在牌库中
     - `'field'`：检查 minionUid 是否仍在场上
     - `'base'`：检查 baseIndex 是否仍然有效
     - `'ongoing'`：检查 cardUid 是否仍附着在场上
     - `undefined`：不刷新（默认）
  2. **复杂场景（optionsGenerator）**：选项基于数量、从多个来源选择、或需要复杂过滤逻辑
     ```typescript
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
- **何时使用哪种方案**：
  - ✅ **autoRefresh**：选项是引用类型（cardUid/minionUid/baseIndex），来源单一（手牌/牌库/场上）
  - ✅ **optionsGenerator**：选项基于数量（"返回1张" vs "返回2张"）、从多个来源选择、或需要复杂过滤逻辑
  - ✅ **不刷新**：选项是静态的（如"跳过"/"确认"），或选项在交互期间不会失效
- **工作原理**：
  1. 创建交互时，使用初始选项（基于创建时的状态）
  2. 状态更新后，`refreshInteractionOptions` 检查是否有 `autoRefresh` 或 `optionsGenerator`
  3. 如果有 `optionsGenerator`，调用它生成新选项；否则如果有 `autoRefresh`，使用通用刷新逻辑
  4. 弹出下一个交互时，`resolveInteraction` 同样检查并刷新
  5. 智能降级：过滤后无法满足 multi.min 限制时，保持原始选项
- **优先级**：`optionsGenerator` > `autoRefresh` > 不刷新（默认）
- **向后兼容**：已有代码无需修改，默认不刷新
- **⚠️ 重要：multi 配置必须在 config 对象内部（强制）**：
  ```typescript
  // ❌ 错误：multi 作为第 7 个参数会被忽略
  createSimpleChoice(id, playerId, title, options,
    { sourceId: 'xxx', targetType: 'hand' },
    undefined, { min: 0, max: 5 }  // ❌ 被忽略
  );
  
  // ✅ 正确：multi 在 config 对象内部
  createSimpleChoice(id, playerId, title, options,
    { sourceId: 'xxx', targetType: 'hand', multi: { min: 0, max: 5 } }
  );
  ```
  **原因**：`createSimpleChoice` 第 5 个参数可以是 `string`（sourceId）或 `SimpleChoiceConfig` 对象。当传递 config 对象时，第 6 和第 7 个参数（`timeout` 和 `multi`）会被忽略。详见 `docs/bugs/smashup-wizard-portal-multi-config-fix.md`。

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

### 模式差异（online/tutorial）（强制）

> **⚠️ 核心规定：项目默认全部使用联机模式（online），本地模式已废弃**

- **模式来源**：统一使用 `GameModeProvider` 注入 `mode`，写入 `window.__BG_GAME_MODE__`。
- **联机模式（online）**：严格校验，按玩家身份限制交互。**这是唯一支持的模式**。
- **教学模式（tutorial）**：走 `MatchRoom`，默认与联机一致。
- **本地模式（已废弃）**：所有游戏 `allowLocalMode=false`，不再支持本地模式。
- **开发和测试**：全部以联机模式为准，禁止依赖本地模式的全局变量（`window.__BG_DISPATCH__`/`window.__BG_STATE__`）。
- **E2E 测试**：必须使用 `setupOnlineMatch` 创建在线对局，通过调试面板（`readCoreState`/`applyCoreStateDirect`/`applyDiceValues`）注入状态。禁止使用 `page.goto('/play/<gameId>/local')`。
- **观战模式**：`playerID` 为 `null` 时，Board 组件应默认显示玩家 0 的视角（或当前回合玩家），确保 UI 正常渲染。

### i18n（强制）
- 通用文案 → `public/locales/{lang}/common.json`；游戏文案 → `game-<id>.json`。
- 新增文案必须同步 `zh-CN` 与 `en`；通用组件禁止引用 `game-*` namespace。

---

（核心规则）

> **新增/修改图片或音频资源引用时必须先阅读 `docs/ai-rules/asset-pipeline.md`**

- **所有图片必须压缩后使用**：用 `OptimizedImage` / `getOptimizedImageUrls`，路径不含 `compressed/`（自动补全）。
- **图片压缩规范（强制）**：
  - **运行时使用**：所有图片必须通过 `OptimizedImage` / `getOptimizedImageUrls` 使用，路径不含 `compressed/`（自动补全）
  - 未压缩则先运行 `npm run assets:compress` 生成 WebP 压缩版本
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
- **生产依赖验证（强制）**：修改 `server.ts`、`src/server/`、`src/engine/transport/server.ts` 的 import 或修改 `package.json` 的 dependencies 时，必须运行 `npm run check:prod-deps` 确认无幽灵依赖。**教训**：`nanoid` 未显式声明，靠 devDependencies 间接提升偶然可用，生产环境 `--omit=dev` 后直接崩溃。

### 验证测试（Playwright 优先）
- 详细规范见 `docs/automated-testing.md`。
- **工具**：Playwright E2E / Vitest / GameTestRunner / 引擎层审计工厂（`src/engine/testing/`）。
- **E2E 测试环境与工具（强制）**：
  - **环境依赖**：E2E 测试依赖前端开发服务器（Vite）、游戏服务器（game-server）、API 服务器（api-server）三个进程同时运行
  - **推荐工作流**：终端 1 运行 `npm run dev`，终端 2 运行 `npm run test:e2e`（开发模式）；或单终端运行 `npm run test:e2e:ci`（CI 模式）
  - **Fixture 使用（强制）**：新增 E2E 测试必须使用 `e2e/fixtures/index.ts` 提供的 fixture。使用 `import { test, expect } from './fixtures'` 替代 `@playwright/test`
  - **状态注入方案（强制）**：所有 E2E 测试必须使用状态注入方案，跳过前置步骤直接构造目标场景。详见 `docs/e2e-state-injection-guide.md`
  - **联机模式（强制）**：所有游戏 `allowLocalMode=false`，E2E 测试必须使用 `setupOnlineMatch` 创建在线对局，通过调试面板注入状态
  - **TestHarness 工具**：使用 `window.__BG_TEST_HARNESS__` 注入骰子结果、状态、命令
  - **测试失败排查**：详见 `docs/automated-testing.md`「E2E 测试环境依赖」节
- **E2E 测试必须由 AI 自主运行（强制）**：
  - **禁止交给用户手动运行**：AI 完成 E2E 测试编写后，必须立即运行测试，不得交给用户手动运行
  - **运行命令**：使用 `npm run test:e2e:ci -- <测试文件名>` 或 `npm run test:e2e -- <测试文件名>`
  - **测试证据必须保留（强制）**：测试运行后必须保存以下证据到 `evidence/` 目录：
    * 测试运行结果（通过/失败）
    * 测试失败的错误信息和堆栈
    * Playwright 自动保存的截图（`test-results/` 目录）
    * 创建证据文档（Markdown 格式），记录测试场景、结果、截图路径、失败原因分析
  - **证据文档必须包含截图（强制）**：
    * **AI 必须先用 MCP 验证测试截图存在**：使用 `mcp_image_viewer_list_images` 检查 `test-results/` 目录，确认有截图文件后才能写证据文档
    * **没有截图时先修复测试**：如果 `test-results/` 目录为空或没有相关截图，必须先修复测试让它通过并生成截图
    * **AI 必须先查看所有测试截图**：使用 `mcp_image_viewer_view_image` 查看所有测试截图，确认截图内容正常、清晰、完整后再写入证据文档
    * **AI 必须分析截图内容**：不能只列出截图路径，必须实际查看并分析截图显示的内容（游戏状态、UI 元素、测试结果）
    * 在证据文档中嵌入截图（使用相对路径 `![描述](../test-results/...)`）
    * **注意**：此规定仅适用于 E2E 测试生成的截图，用户上传的截图直接从对话中查看
    * 为每个截图添加详细说明（显示内容、状态、结果）
    * 截图路径必须是完整路径（从 `test-results/` 开始）
    * **用户只需要看截图即可验证测试结果**：截图必须清晰展示游戏状态、UI 元素、测试结果，用户无需运行测试或查看代码
    * **只保留流程跑通的截图**：边界测试（如错误处理、异常场景）不需要截图，只保留正常流程的截图
  - **证据文档格式**：
    ```markdown
    # <功能名称> E2E 测试 - 运行结果
    
    ## 测试运行信息
    - 运行命令：`npm run test:e2e:ci -- <测试文件名>`
    - 运行时间：YYYY-MM-DD
    - 测试结果：X 个通过，Y 个失败
    
    ## 测试场景
    1. 场景 1 描述
    2. 场景 2 描述
    
    ## 测试截图（完整路径）
    
    ### 测试 1 截图
    **截图路径**：`test-results/.../screenshot.png`
    
    ![测试1截图](../test-results/.../screenshot.png)
    
    - 显示：描述截图内容
    - 状态：描述游戏状态
    - 结果：✅/❌ 测试结果
    
    ## 失败原因分析（如果有失败）
    - 测试 1 失败原因
    - 测试 2 失败原因
    
    ## 下一步工作（如果有失败）
    - 修复建议 1
    - 修复建议 2
    ```
  - **测试文件命名规范（强制）**：E2E 测试文件必须以 `.e2e.ts` 结尾，不能使用 `.spec.ts` 或 `.test.ts`（Playwright 配置中 `testMatch: '**/*.e2e.ts'`）
- **GameTestRunner 优先（强制）**：GameTestRunner 行为测试是最优先、最可靠的测试手段。审计工厂（entityIntegritySuite / interactionChainAudit / interactionCompletenessAudit）是补充，用于批量覆盖注册表引用完整性和交互链完整性。
- **测试触发条件（强制）**：只有以下场景需要运行测试：
  - ✅ 新增/修改业务逻辑（技能、卡牌、回合流程、游戏规则）
  - ✅ 修改引擎层代码（`src/engine/`、`src/core/`）
  - ✅ 修改领域层代码（`src/games/*/domain/`、`execute.ts`、`validate.ts`、`reduce.ts`）
  - ✅ 修改数据结构（类型定义、状态字段、事件/命令格式）
  - ✅ 修改 API 接口或服务端逻辑
  - ✅ 修复"功能不生效"/"逻辑错误"类 bug
  - ❌ **不需要测试**：纯样式、文案、文档、资源文件、格式化、重命名（详见上文「测试运行范围」）
- **测试命令**：
  - CI 模式：`npm run test:e2e:ci`（自动启动服务器）
  - 清理端口：`npm run test:e2e:cleanup`（测试异常退出导致端口占用时使用）
- **截图规范**：禁止硬编码路径，必须用 `testInfo.outputPath('name.png')`。
- **禁止杀掉所有 Node.js 进程（强制）**：
  - ❌ 禁止：`taskkill /F /IM node.exe`、`killall node`、`pkill node`、`Get-Process node | Stop-Process -Force`
  - 原因：会杀掉所有 Node.js 进程（其他项目服务器、VS Code 语言服务器、调试器、正在运行的测试等）
  - ✅ 正确：**优先清理单个测试的端口**（查找 PID 后 `taskkill /F /PID <PID>`），或使用 `node scripts/infra/port-allocator.js <workerId>` 清理特定 worker
  - ⚠️ 谨慎使用：`npm run test:e2e:cleanup` 会清理所有测试环境端口，会中断其他并行测试
  - 详见 `docs/automated-testing.md`「危险操作警告」节
- **E2E 覆盖要求（强制）**：必须覆盖交互链（用户操作→系统响应→状态变更的完整流程）和特殊交互（非标准流程、边界条件、异常处理）。同种类型的交互只需覆盖一个代表性用例，可省略重复测试。
- **静态审计要求**：新增游戏时根据游戏特征选择引擎层审计工具。选型指南见 `docs/ai-rules/engine-systems.md`「引擎测试工具总览」节。
- **描述→实现全链路审查（强制）**：以下场景必须执行——① 新增技能/Token/事件卡/被动/光环 ② 修复"没效果"类 bug ③ 审查已有机制 ④ 重构消费链路 ⑤ **规划审计类 spec（requirements/design/tasks）**。**当用户说"审计"/"审查"/"审核"/"检查实现"/"核对"等词时，必须先阅读 `docs/ai-rules/testing-audit.md`「描述→实现全链路审查规范」节，按规范流程执行并输出矩阵，禁止凭印象回答。** 该文档为审查规范的唯一权威来源。
- **审计 Spec 规划必须覆盖 D1-D49（强制）**：规划审计类 spec 的 requirements 和 tasks 时，必须先阅读 `docs/ai-rules/testing-audit.md` 中的 D1-D49 维度表，逐条评估哪些维度适用于目标游戏/模块，并在 spec 的 requirements 中为每个适用维度创建对应的验收标准。**禁止只做"描述→实现文本一致性"的静态审计而遗漏运行时行为维度（D8 时序正确性、D19 组合场景、D6 副作用传播等）。** 审计 spec 的 tasks 中必须包含：① 静态注册检查（Property 测试）② 运行时行为测试（GameTestRunner 覆盖关键管线时序和组合场景）。**教训**：SmashUp 全派系审计 spec 只规划了静态注册检查，完全遗漏 D8（计分管线时序）和 D19（基地能力×ongoing 触发器组合），导致 Temple of Goju afterScoring 时序 bug 未被发现。
- **数据查询一致性审查（强制）**：新增"修改/增强/共享"类机制后，必须 grep 原始字段访问，确认所有消费点走统一查询入口。详见 `docs/ai-rules/testing-audit.md`「数据查询一致性审查」节。
- **元数据语义一致性审查（强制）**：新增/修改 custom action handler 后，必须确认 `categories` 声明与实际输出一致。详见 `docs/ai-rules/testing-audit.md`「元数据语义一致性审计」节。
- **Custom Action target 间接引用审查（强制）**：新增/修改 custom action handler 后，必须确认 handler 中 DAMAGE_DEALT/STATUS_APPLIED 的 targetId 来源正确——进攻伤害/debuff 用 `ctx.ctx.defenderId`，自我增益用 `ctx.targetId`。详见 `docs/ai-rules/testing-audit.md`「D10 子项：Custom Action target 间接引用审计」。
- **验证层有效性门控（强制）**：有代价的技能（消耗充能/魔力等），验证层必须确保操作至少能产生一个有意义的效果，否则拒绝激活。`quickCheck` 必须与 `customValidator` 前置条件对齐。详见 `docs/ai-rules/testing-audit.md`「D7 子项：验证层有效性门控」。
- **阶段结束技能时序对齐（强制）**：阶段结束时需要玩家确认的技能（描述含"你可以"/"may"），`onPhaseExit` 必须返回 `{ halt: true }` 阻止阶段推进，UI 跳过时必须 dispatch `ADVANCE_PHASE` 恢复流程。**事件产生门控必须普适生效**：`triggerPhaseAbilities` 等循环中的门控函数（如 `canActivateAbility`）禁止用 `abilityId === 'xxx'` 限定为特定技能，必须对所有同类技能生效。详见 `docs/ai-rules/testing-audit.md`「D8 子项：引擎批处理时序与 UI 交互对齐」。
- **"可以/可选"效果必须有交互确认（强制）**：描述中"你可以"/"may"→ 必须有确认/跳过 UI，禁止自动执行。
- **测试必须验证状态变更（强制）**：事件发射 ≠ 状态生效，必须断言 reduce 后的最终状态。详见 `docs/ai-rules/testing-audit.md`「审计反模式清单」。
- **多系统协作测试必须断言所有相关系统状态（强制）**：涉及多个引擎系统协作的功能（如响应窗口+交互系统），测试必须同时断言所有相关系统的状态字段。只断言 `sys.interaction.current` 存在但不断言 `sys.responseWindow.current` 仍打开 = 测试通过但功能实际无效。详见 `docs/ai-rules/testing-audit.md`「D8 子项：多系统 afterEvents 优先级竞争」。
- **E2E 测试必须使用联机模式（强制）**：所有游戏 `allowLocalMode=false`，E2E 测试必须使用 `setupOnlineMatch` 创建在线对局，通过调试面板（`readCoreState`/`applyCoreStateDirect`/`applyDiceValues`）注入状态。禁止使用 `page.goto('/play/<gameId>/local')`、禁止假设 `window.__BG_DISPATCH__`/`window.__BG_STATE__` 等全局变量存在。详见上文「模式差异」章节。
---

## 🎨 UI/UX 规范（核心规则）

> **开发/修改 UI 组件或布局时必须先阅读 `docs/ai-rules/ui-ux.md`**

- **PC-First**，移动端 Best-effort。
- **移动端适配（已实现）**：
  - **游戏页面横屏建议**：移动设备（< 1024px）竖屏时显示顶部横幅建议（羊皮纸风格，SVG 图标，可关闭）
  - **主页支持竖屏**：主页和非游戏页面支持竖屏自适应
  - **用户可缩放**：允许双指缩放（0.5x - 3x）和拖拽平移，解决内容被截断问题
  - **触摸优化**：按钮最小尺寸 44px
  - **详细文档**：`docs/mobile-adaptation.md`
- **深度感分级**：重点区域毛玻璃+软阴影，高频更新区域禁止毛玻璃。
- **动态提示 UI 必须 `absolute/fixed`**，禁止占用布局空间。层级：提示 z-[100-150]，交互 z-[150-200]，Modal z-[200+]。
- **临时/瞬态 UI 不得挤压已有布局（强制）**：攻击修正徽章、buff 提示、倒计时标签等"出现/消失"的临时 UI 元素，必须使用 `absolute`/`fixed` 定位，禁止插入 flex/grid 正常流导致其他元素位移。
- **数据/逻辑/UI 分离**：UI 只负责展示与交互。
- **游戏 UI 设计系统**：`design-system/game-ui/MASTER.md`（通用）+ `design-system/styles/`（风格）。
- **新增 UI 元素必须配合现有风格（强制）**：即使只改一个文件，新增的按钮/面板/提示等 UI 元素必须复用同模块已有组件（如 `GameButton`）和现有样式变量，禁止手写不一致的原生样式。修 bug 和微调不受此约束。
- **游戏内 UI 组件单一来源（强制）**：同一类 UI 功能只允许一个组件实现，所有场景必须复用。卡牌展示/选择统一用 `PromptOverlay`（SmashUp），禁止新建功能重叠的组件。详见 `docs/ai-rules/ui-ux.md` §1.1。
- **大规模 UI 改动**（≥3 组件文件 / 新增页面 / 全局风格调整）须先读设计系统，详见 `docs/ai-rules/ui-ux.md` §0。
