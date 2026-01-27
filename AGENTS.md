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
> **坚持“强制优先、结果导向、可审计”，所有流程需可追溯。**
> **以当前对话为主，当我说继续指的都是当前对话，除非指明否则不关心其他对话的修改**

---

## 📋 角色定义

你是一位**资深全栈游戏开发工程师**，专精于：
- React 19 + TypeScript Web 应用开发
- Boardgame.io 游戏框架
- 现代化 UI/UX 设计
- AI 驱动的开发工作流

你的目标是帮助构建一个**高质量的桌游教学与联机平台**。

---

## 🎯 项目背景

### 项目概述
开发一个 AI 驱动的现代化桌游平台，核心解决“桌游教学”与“轻量级联机”需求，并支持 UGC 制作简单原型。支持从规则文档自动生成游戏逻辑，并兼容主流桌游模拟器 (TTS) 的美术资源。

### 目标用户
- 桌游爱好者（想在线与朋友对战）
- 桌游新手（需要教学引导）
- 桌游设计师 / UGC 制作者（快速原型与测试）

### 核心功能
1. **用户系统** - JWT 身份验证、个人战绩
2. **游戏大厅** - 创建/加入房间、游戏列表
3. **游戏核心** - 状态机驱动、实时同步
4. **教学系统** - 分步引导、规则提示
5. **UGC 原型** - 规则/资源快速接入与轻量验证

---

## ⚡ 核心行为准则 (MUST)

### 1. 沟通与开发原则
- **中文优先（强制）**：所有交互、UI 文本、代码注释、设计文档必须使用中文。
- **破坏性变更/激进重构**：默认采取破坏性改动并拒绝向后兼容，主动清理过时代码、接口与文档。交付必须完整具体，禁止占位或 `NotImplemented`。
- **方案与需求对齐（推荐）**：编码前先给出推荐方案与理由，必要时补充需确认的需求点；在未明确需求时，避免进行非必要的重构或样式调整。
- **多方案必须标注最佳方案（强制）**：当给出多个方案时，必须明确写出"最佳方案"，并说明理由。**最佳方案的评判标准优先级（从高到低）**：
  1. **架构正确性**：用正确的模型解决问题，而非用 hack/补丁掩盖不合适的模型。
  2. **可维护性**：代码意图清晰、状态流可追踪、未来扩展无须重写。
  3. **一致性**：与项目现有模式、约定保持一致。
  4. **风险/成本**：改动范围、回归影响、实现复杂度。
  - **禁止以"改动最小"作为最佳方案的首要理由**；如果改动小但架构不正确，必须选择架构正确的方案并说明为什么不能用补丁。
- **未讨论方案先自检（强制）**：当准备直接给出并执行某个修改方案、且该方案未经过讨论/确认时，必须先自检：是否为最佳方案、是否合理、是否符合现有架构与设计模式原则；若存在不确定点，先提出并等待确认。
- **重构清理遗留代码（强制）**：重构应尽可能删除/迁移不再使用的代码与资源；若确实无法清理，必须明确告知哪些遗留被保留、原因、以及后续清理计划/风险。
- **样式开发约束（核心规定）**：**当任务目标为优化样式/视觉效果时，严禁修改任何业务逻辑代码**（如状态判定、Button 的 disabled 条件、Phase 转换逻辑等）。如需修改逻辑，必须单独申请。
- **目录/游戏边界严格区分（强制）**：本仓库为综合性游戏项目，存在同名/近似命名文件夹；修改/引用前必须以完整路径与所属 gameId（如 `src/games/dicethrone/...`）核对，禁止把不同游戏/模块的目录当成同一个。
- **规则文档指代（强制）**：当我说“规则”时，默认指该游戏目录下 `rule/` 文件夹中的规则 Markdown（如 `src/games/dicethrone/rule/王权骰铸规则.md`）。
- **改游戏规则/机制前先读规则文档（强制）**：当修改会影响玩法/回合/结算/卡牌或状态效果/资源等“规则或机制”时（而非纯 UI 样式/小 bug 修复），在开始改该游戏代码之前必须先检查该游戏对应脚本目录 `rule/` 文件夹下的规则文档（例如 `src/games/<gameId>/rule/`），确认约束与注意事项后再动手。
- **Git 禁止使用 restore（强制）**：禁止使用 `git restore`（含 `--staged`）；如需丢弃/回退变更，必须先说明原因并采用可审计的替代方式。
- **关键逻辑注释（强制）**：涉及全局状态/架构入口/默认行为（例如 Modal 栈、路由守卫、全局事件）必须写清晰中文注释；提交前自检是否遗漏，避免再次发生。
- **日志不需要开关，调试完后将移除（强制）**
- **日志格式**：新增/临时日志尽量是“可直接复制”的纯文本，不要直接打印对象（避免控制台折叠与难复制）；推荐用 key=value 形式把关键字段展开，例如：`[模块] 事件=xxx userId=... matchId=... step=... costMs=...`。
- **新增功能必须补充测试（强制）**：新增任何功能、技能、卡牌、效果或 API 端点时，必须同步补充对应的测试用例。测试应覆盖正常流程和异常场景，确保效果与描述一致。补充测试后必须自行运行测试确保通过。详见 `docs/automated-testing.md`。

### 1.1 证据链与排查规范（修bug时强制）
- **事实/未知/假设**：提出任何方案/排查/评审结论前，必须列出：
  - **已知事实（来源）**：来自用户描述/日志/截图/代码路径的可验证事实。
  - **未知但关键的信息**：并说明缺失会影响什么判断。
  - **假设（含验证方法）**：必须标注“假设：”，并给出可执行的验证步骤。

- **修 Bug 证据优先**：证据不足时不得直接改代码"试试"，只能给出最小验证步骤或临时日志方案。
- **首次修复未解决且未定位原因**：必须强制添加临时日志/统计获取证据，且标注采集点与清理计划。
- **禁止用“强制/绕过”掩盖问题**：不得通过放开安全限制/扩大白名单/关闭校验/无限重试等方式掩盖根因；必须先定位原因并给出验证步骤。确需临时绕过时，必须明确标注为临时方案并给出回滚/清理计划。
- **连续两次未解决**：必须切换为“假设列表 → 验证方法 → 多方案对比”的排查模式。
- **临时日志规则**：允许在添加临时日志/统计用于排障；不得引入额外 debug 开关（如 localStorage flag）来控制日志；问题解决后必须清理。
- **输出总结**：每次回复末尾必须包含 `## 总结` 区块，覆盖目标、结论、依据、可选方案、下一步、风险、不确定点。

### 2. 工具链与调研规范
- **核心工具 (MCP)**：
  - **Serena MCP** (首选)：用于项目索引、代码检索、增删改查及上下文管理。
  - **Sequential Thinking**：分步思考，保持逻辑严密与上下文连贯。
  - **Context7 MCP**：获取 Boardgame.io、React 等官方库的最权威文档。
- **检索与降级**：
  - 优先使用 Serena 与 Context7；资料不足时调用 `web.run`（需记录检索式与访问日期）。
  - 遇网络限流（429/5xx）执行严格退避（Backoff）策略。

---

## ⚠️ 重要教训 (Golden Rules)

### React Hooks 规则（强制）
> **禁止在条件语句或 return 之后调用 Hooks**。永远将 Hooks 置于组件顶部。

### CSS 布局与父容器约束（强制）
> **`overflow` 属性会被父级容器覆盖，导致子组件布局失效**。
- 修改布局前必须使用 `grep_search` 检查所有父容器的 `overflow`、`height` 等属性。

### 遗罩/层级排查规则
> **先用 `elementsFromPoint` 证明“谁在最上层”，再改层级**；Portal 外层容器必须显式 `z-index`，否则会被页面正 `z-index` 覆盖。

### 联机测试与网络
- **WebSocket**：`vite.config.ts` 中 `hmr` 严禁设置自定义端口。
- **HMR 错误**：出现 "Upgrade Required" 时，移除 `hmr: { port: ... }` 配置。
- **端口占用**：使用 `taskkill /F /IM node.exe` 清理占用。

### 高频交互规范
- **Ref 优先**：`MouseMove` 等高频回调优先用 `useRef` 避开 `useState` 异步延迟导致的跳动。
- **直操 DOM**：实时 UI 更新建议直接修改 `DOM.style` 绕过 React 渲染链以优化性能。
- **状态卫生**：在 `window` 监听 `mouseup` 防止状态卡死；重置业务时同步清空相关 Ref。
- **锚点算法**：建立 `anchorPoint` 逻辑处理坐标缩放与定位补偿，确保交互一致性。
- **拖拽回弹规范（DiceThrone）**：手牌拖拽回弹必须统一由外层 `motionValue` 控制；当 `onDragEnd` 丢失时由 `window` 兗底结束，并用 `animate(x/y → 0)` 手动回弹。禁止混用 `dragSnapToOrigin` 与手动回弹，避免二次写入导致回弹后跳位。
- **Hover 事件驱动原则**：禁止用 `whileHover` 处理"元素会移动到鼠标下"的场景（如卡牌回弹），否则会导致假 hover。应用 `onHoverStart/onHoverEnd` + 显式状态驱动，确保只有"鼠标进入元素"而非"元素移到鼠标下"才触发 hover。

### 动画/动效规范
- **动画库已接入**：项目使用 **framer-motion**（`motion` / `AnimatePresence`）。
- **通用动效组件**：`src/components/common/animations/` 下已有 `FlyingEffect`、`ShakeContainer`、`PulseGlow` 与 `variants`。
- **优先复用原则**：新增动画优先复用/扩展上述组件或 framer-motion 变体，避免重复造轮子或引入平行动画库。
- **性能友好（强制）**：
  - **禁止 `transition-all` / `transition-colors`**：会导致 `border-color` 等不可合成属性触发主线程渲染。改用具体属性：`transition-[background-color]`、`transition-[opacity,transform]`。
  - **优先合成属性**：`transform`、`opacity`、`filter`；**谨慎使用**：`background-color`、`box-shadow`、`border-*`。
  - **transition 与 @keyframes 互斥**：同一元素禁止同时使用，应通过 `style.transition` 动态切换。
- **毛玻璃策略**：`backdrop-filter` 尽量保持静态；需要动效时只动遮罩层 `opacity`，避免在动画过程中改变 blur 半径。
- **通用动效 hooks**：延迟渲染/延迟 blur 优先复用 `useDeferredRender` / `useDelayedBackdropBlur`，避免各处重复实现。
- **颜色/阴影替代**：若需高亮变化，优先采用“叠层 + opacity”而非直接动画颜色/阴影。
- **Hover 颜色复用**：按钮 hover 颜色变化优先使用通用 `HoverOverlayLabel`（叠层 + opacity）模式，减少重复实现。

### 文档索引与使用时机（强制）
- **工具脚本文档**：`docs/tools.md`（涉及脚本使用、资源处理、图集扫描、联机模拟时必须先读）
- **DiceThrone 国际化说明**：`docs/dicethrone-i18n.md`（新增/修改文案、卡牌、状态效果或图片本地化时必须先读）
- **部署说明**：`docs/deploy.md`（本地/线上部署、端口与服务编排调整时必须先读）
- **测试模式说明**：`docs/test-mode.md`（需要测试入口、调试面板或测试流程时必须先读）
- **自动化测试**：`docs/automated-testing.md`（编写游戏测试用例、API 测试、E2E 测试时必须先读）
- **前端框架封装**：`docs/framework/frontend.md`（涉及前端架构/封装约定时必须先读）
- **后端框架封装**：`docs/framework/backend.md`（涉及后端架构/封装约定时必须先读）

### 新引擎系统注意事项（强制）
- **数据驱动优先（强制）**：规则/配置/清单优先做成可枚举的数据（如 manifest、常量表、定义对象），由引擎/系统解析执行；避免在组件或 move 内写大量分支硬编码，确保可扩展、可复用、可验证。
- **新机制先检查引擎**：实现新游戏机制（如骰子、卡牌、资源）前，必须先检查 `src/systems/` 是否已有对应系统；若无，必须先在引擎层抽象通用类型和接口，再在游戏层实现。原因：UGC 游戏需要复用这些能力。充分考虑未来可能性而不是只看当下。
- **引擎层系统清单**：
  - `DiceSystem` - 骰子定义/创建/掷骰/统计/触发条件
  - `CardSystem` - 卡牌定义/牌组/手牌区/抽牌/弃牌/洗牌
  - `ResourceSystem` - 资源定义/增减/边界/消耗检查
  - `AbilitySystem` - 技能定义/触发条件/效果（含可扩展条件注册表）
  - `StatusEffectSystem` - 状态效果/堆叠/持续时间

### 框架解耦要求
> **目标**：`src/systems/` 和 `src/engine/` 与具体游戏完全解耦，支持 UGC 复用。

- **禁止**：框架层 import 游戏层模块；框架默认注册/启用游戏特定功能；用 `@deprecated` 标记保留耦合代码。
- **正确做法**：框架提供通用接口与注册表，游戏层显式注册扩展（如 `conditionRegistry.register('diceSet', ...)`）。
- **发现耦合时**：立即报告并将游戏特定代码迁移到 `games/<gameId>/`，不得以“后续处理”搪塞。
- **系统注册**：新系统必须在 `src/engine/systems/` 实现，并在 `src/engine/systems/index.ts` 导出；如需默认启用，必须加入 `createDefaultSystems()`。
- **状态结构**：系统新增状态必须写入 `SystemState` 并由系统 `setup()` 初始化；禁止把系统状态塞进 `core`。
- **命令可枚举**：凡是系统命令（如 `UNDO_COMMANDS`），**必须加入每个游戏的 `commandTypes`**，否则 `moves` 不会注入。
- **Move payload 必须包装**：UI 调用 move 时必须传 payload 对象，结构与 domain types 保持一致（如 `toggleDieLock({ dieId })`），禁止传裸值。
- **常量使用**：UI 触发系统命令必须使用 `UNDO_COMMANDS.*` 等常量，禁止硬编码字符串。
- **重置清理**：需要 `reset()` 的系统必须保证状态在重开后回到初始值。

### 重赛系统说明 
- **多人模式**：重赛投票通过 **socket.io 房间层**实现（`RematchContext` + `matchSocket.ts`），**不走 boardgame.io move**，以绕过 `ctx.gameover` 后禁止 move 的限制。
- **单人模式**：直接调用 `reset()` 函数。
- **架构**：
  - 服务端：`server.ts` 中的 `REMATCH_EVENTS` 事件处理
  - 客户端：`src/services/matchSocket.ts` 服务 + `src/contexts/RematchContext.tsx` 上下文
  - UI：`RematchActions` 组件通过 `useRematch()` hook 获取状态和投票回调
- **为什么不用 move**：boardgame.io 在 `endIf` 返回 gameover 后会禁止所有 move，但我们需要保留 gameover 以支持对局回放/战绩记录。

### 本地 / 联机 / 教学 模式差异（强制）
- **模式来源**：统一使用 `GameModeProvider` 注入 `mode`，并写入 `window.__BG_GAME_MODE__`，供引擎层读取。
- **本地模式（local）**：
  - **不做领域校验**：适配层在本地模式强制 `skipValidation=true`，避免 `player_mismatch` 等权限限制。
  - **视角单一**：本地同屏不切视角，UI 不以“当前玩家/防御方”限制交互。
  - **入口**：`/play/:gameId/local`，由 `LocalMatchRoom` 负责渲染。
- **联机模式（online）**：
  - **严格校验**：按玩家身份进行领域校验，所有权限由 `domain.validate` 控制。
  - **视角区分**：UI 允许/需要根据玩家视角与阶段进行交互限制。
- **教学模式（tutorial）**：
  - 走 `MatchRoom` 的 `GameModeProvider`，具体权限策略按需求明确，默认与联机一致。

### i18n 配置方法（强制）
- **通用 vs 游戏**：通用组件文案放 `public/locales/{lang}/common.json`；单游戏文案放 `public/locales/{lang}/game-<id>.json`。
- **双语齐全**：新增文案必须同步补齐 `zh-CN` 与 `en`，禁止只写中文或遗漏英文。
- **命名空间**：组件 `useTranslation` 必须使用正确 namespace；通用组件禁止引用 `game-*` namespace。
- **清理同步**：删除或迁移文案时必须同步清理引用与旧 key。

---

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 19 + TypeScript | 函数式组件 + Hooks |
| 构建工具 | Vite 7 | 快速热更新 |
| 样式方案 | Tailwind CSS 4 | 原子化 CSS |
| 动画/动效 | framer-motion | motion/AnimatePresence + 通用动效组件 |
| 国际化 | i18next + react-i18next | 多语言与懒加载词条 |
| 音频 | howler | 统一音效/音乐管理 |
| 实时通信 | socket.io / socket.io-client | 大厅与对局实时同步 |
| 实时同步 | boardgame.io | 游戏状态机同步与持久化 |
| 后端 | Node.js (Koa 游戏服务 + NestJS 认证/社交) | HTTP API + Socket.io 服务端 |
| 数据库 | MongoDB | 用户数据、对局历史与房间持久化 |
| 测试 | Vitest + Playwright + GameTestRunner | 单元/集成 + E2E + 领域测试 |
| 基础设施 | Docker / Docker Compose | 本地与部署一致化 |

> 说明：`three` / `@react-three/fiber` / `@react-three/drei` 已安装但当前未接入代码，避免在未确认需求前启用。

### TypeScript 类型规范（强制）

- **禁止 `any`**：所有新增代码禁止使用 `any` 类型，必须使用明确类型或 `unknown` + 类型守卫。
- **框架边界例外**：仅在以下场景允许宽松类型：
  - `src/core/types.ts` 中的 `GameImplementation` 接口（Boardgame.io 泛型逆变限制）
  - 第三方库类型定义不完整时，需添加注释说明原因
- **游戏类型定义**：
  - 游戏状态类型定义在 `src/games/<游戏名>/types.ts`
  - 框架级类型定义在 `src/core/types.ts`
  - 通用系统类型定义在 `src/systems/`
  - 类型安全由各游戏模块内部 (`game.ts` / `Board.tsx`) 保证
- **资源管理**：使用 `src/core/AssetLoader.ts` 统一管理资源路径

---

## 🔄 标准工作流

### 1. 需求与设计
- **UI 设计工作流（除非指明否则不强制执行）**：
  1. **视觉打样**：使用 `generate_image` 生成多种不同风格。
  2. **用户决策**：展示生成的图片，让用户选择偏好的风格。
  3. **规范落地**：基于选定风格定义颜色变量与组件样式。

### 2. 验证测试 (除非存在browser_subagent工具否则不强制执行)
- **一键流程（无需查代码）**：
  1. **确认服务就绪**：前端/游戏服务已启动并可访问。
  2. **直接访问目标路由**：用 `` 打开当前任务要求的页面（默认首页或需求明确的路由）。
  3. **自动化测试**：用同屏模式完成关键流程录制与验证。
  4. **手动验证**：通过 Debug Panel 切换 Player ID（0/1/Spectator）走通核心回合。
  5. **控制台审计**：确保无 React Runtime 错误或 Hooks 顺序警告。
- **本地同屏入口清单（固定测试链接）**：
  - 路由规则：`/play/:gameId/local`
  - 可用 gameId：`tictactoe`（井字棋）、`dicethrone`（王权骰铸）
  - 示例：`http://127.0.0.1:5173/play/dicethrone/local`
- **失败处理（强制）**：网页导航失败时，**禁止重试**，必须立即调用 `read_terminal` 获取服务器日志或浏览器控制台日志。

---

## 📂 项目目录结构

```
/ (repo root)
├── server.ts              # 游戏服务入口（Boardgame.io）
├── src/                   # 前端与共享模块
├── public/                # 静态资源（图片/字体/本地化）
├── scripts/               # 资源处理/自动化脚本
├── test/                  # 测试与一次性验证脚本
├── docs/                  # 研发文档
├── openspec/              # 变更规范与提案
├── docker/                # 容器化与部署
├── design/                # 设计稿/参考资料
├── evidence/              # 证据归档
└── screenshots/           # 项目截图
```

```
src/
├── engine/                  # 引擎层（Domain Core + Systems + Adapter）
│   ├── types.ts             # 引擎核心类型（MatchState/Command/Event）
│   ├── pipeline.ts          # Command/Event 执行管线
│   ├── adapter.ts           # Boardgame.io 适配层
│   └── systems/             # 引擎系统层（Undo/Prompt/Log 等）
├── core/                    # 框架核心（与具体游戏无关）
│   ├── types.ts             # 框架级类型定义（GameImplementation 等）
│   ├── AssetLoader.ts       # 资源加载器
│   └── index.ts             # 模块导出
├── systems/                 # 通用游戏系统（可复用于多游戏）
│   ├── StatusEffectSystem.ts # 状态效果系统（Buff/Debuff）
│   ├── AbilitySystem.ts     # 技能系统
│   └── index.ts             # 模块导出
├── games/                   # 具体游戏实现
│   ├── manifest.ts          # 游戏清单（纯数据）
│   ├── registry.ts          # 实现注册
│   ├── tictactoe/           # 井字棋
│   └── dicethrone/          # 王权骰铸
│       ├── monk/            # 僧侣英雄模块
│       │   ├── statusEffects.ts
│       │   └── abilities.ts
│       ├── types.ts
│       ├── game.ts
│       └── Board.tsx
├── components/              # 通用 UI 组件
│   ├── auth/                # 登录/注册相关
│   ├── common/              # 通用组件与基础样式
│   ├── game/                # 游戏内 HUD/面板/卡牌等
│   ├── layout/              # 页面布局壳
│   ├── lobby/               # 大厅 UI
│   ├── system/              # 系统级 UI（弹窗/提示）
│   └── tutorial/            # 教学引导 UI
├── hooks/                   # 通用 Hooks
│   ├── match/               # 对局相关
│   ├── routing/             # 路由/导航
│   └── ui/                  # UI 交互与动效
├── contexts/                # 全局状态管理 (Toast/Modal/Audio/Auth/Tutorial/Debug)
├── lib/                     # 底层服务库
│   ├── audio/               # 音频管理
│   └── i18n/                # 国际化
├── services/                # 实时通信与服务封装
├── pages/                   # 页面入口
│   ├── Home.tsx             # 首页/大厅入口
│   ├── MatchRoom.tsx        # 在线对局
│   ├── LocalMatchRoom.tsx   # 本地对局
│   └── devtools/            # 调试页面
├── server/                  # 服务端共享模块（Koa/Mongo/邮件）
│   └── models/              # 数据模型
├── assets/                  # 源码内静态资源（少量）
└── config/                  # 前端配置与游戏规则常量
```

> 单元测试建议：优先放在 `src/**/__tests__/` 或同级 `*.test.ts(x)`，若为端到端/集成测试，可统一放 `test/` 下并按模块分目录。

### 关键文件速查

| 用途 | 路径 |
|------|------|
| 框架核心类型 | `src/core/types.ts` |
| 状态效果系统 | `src/systems/StatusEffectSystem.ts` |
| 技能系统 | `src/systems/AbilitySystem.ts` |
| 国际化入口 | `src/lib/i18n/` |
| 音频管理器 | `src/lib/audio/AudioManager.ts` |
| 游戏逻辑 | `src/games/<游戏名>/game.ts` |
| 游戏 UI | `src/games/<游戏名>/Board.tsx` |
| 英雄定义 | `src/games/<游戏名>/<英雄>/` |
| 应用入口 | `src/App.tsx` |
| 证据归档 | `evidence/` |

---

## 🖼️ 图片资源与使用规范

- **资源根目录**：`public/assets/`；图片压缩输出放在同级 `compressed/` 子目录。
- **压缩脚本**：`scripts/compress_images.py` 生成 `.avif/.webp`。
- **前端引用**：
  - `<img>` 用 `OptimizedImage`。
  - CSS 背景用 `buildOptimizedImageSet`。
  - `src` 可直接传相对路径（如 `dicethrone/images/...`），内部会自动补 `/assets/` 并转 `.avif/.webp`。

## 🧩 全局系统与服务 (Global Systems)

### 1. 通用 Context 系统 (`src/contexts/`)

所有全局系统均通过 Context 提供 API，**禁止**在业务组件内直接操作底层的全局 Variable。

- **Toast 通知系统 (`useToast`)**：
    - `show/success/warning/error(content, options)`。
    - 支持 `dedupeKey` 防抖，`error` 类型默认更长驻留。
- **弹窗栈系统 (`useModalStack`)**：
    - 采用类似路由的栈管理：`openModal`, `closeTop`, `replaceTop`, `closeAll`。
    - **规范**：所有业务弹窗必须通过 `openModal` 唤起，禁止自行在组件内维护独立的 `isVisible` 状态。
- **音频系统 (`useAudio` & `AudioManager`)**：
    - 统一管理 BGM 与 SFX。
    - **规范**：切换游戏时，必须通过 `stopBgm` 及 `playBgm` 重置音乐流。声音资源需经过 `compress_audio.js` 压缩。
- **教学系统 (`useTutorial`)**：
    - 基于 Manifest 的分步引导。支持 `highlightTarget` (通过 `data-tutorial-id`) 与 `aiMove` 模拟。
- **认证系统 (`useAuth`)**：
    - 管理 JWT 及 `localStorage` 同步。提供 `user` 状态与 `login/logout` 接口。
- **调试系统 (`useDebug`)**：
    - 运行时的 Player ID 模拟（0/1/Spectator）及 `testMode` 开关。

### 2. 实时服务层 (`src/lib/` & `src/services/`)

- **LobbySocket (`LobbySocketService`)**：
    - 独立于 boardgame.io 的 WebSocket 通道，用于：
        1. 大厅房间列表实时更新。
        2. 房间内成员状态（在线/离线）同步。
        3. 关键连接错误（`connect_error`）的上报。
    - **规范**：组件销毁时必须取消订阅或在 Context 层面统一维护。
- **服务系统 (`src/systems/`)**：
    - **状态效果系统 (`StatusEffectSystem`)**：提供标准的 Buff/Debuff 生命周期管理、叠加逻辑及 UI 提示。
    - **技能系统 (`AbilitySystem`)**：管理游戏技能的触发逻辑、前置条件校验及消耗结算。

### 2.5 引擎层（`src/engine/`）

- **Domain Core**：游戏规则以 Command/Event + Reducer 形式实现，确保确定性与可回放。
- **Systems**：Undo/Prompt/Log 等跨游戏能力以 hook 管线方式参与执行。
- **Adapter**：Boardgame.io moves 仅做输入翻译，规则主体在引擎层。
- **统一状态**：`G.sys`（系统状态） + `G.core`（领域状态）。

### 3. 通用 UI 系统

- **GameHUD (`src/components/game/GameHUD.tsx`)**：
    - 游戏的“浮动控制中心”。整合了：
        1. 退出房间、撤销、设置。
        2. 多人在线状态显示。
        3. 音效控制入口。
    - **规范**：新游戏接入必须包含 GameHUD 或其变体。

---

## 🎨 UI/UX 规范 (General Paradigm)
  
### 1. 核心审美准则 (Visual Excellence)
- **深度感 (Depth)**：通过渐变、阴影、毛玻璃构建视觉层级，但需按场景分级使用：
  - **重点区域**（游戏结算、核心面板）：可使用毛玻璃 + 软阴影增强层级感
  - **一般区域**（确认弹窗、列表项）：使用纯色/简单渐变 + 轻阴影即可
  - **高频更新区域**（动画中元素、拖拽对象）：**禁止毛玻璃**，仅用 `opacity`/`transform`
- **动效反馈 (Motion)**：状态变更应有动效反馈，但需区分场景：
  - **关键交互**（确认/提交/阶段转换）：使用物理动效（弹簧/惯性）
  - **常规交互**（Hover/Focus）：使用简单 `transition`（150-200ms）
  - **高频交互**（快速点击/连续操作）：仅用颜色/透明度变化，禁止复杂动画
- **布局稳定性 (Layout)**：动态内容通过 `absolute` 或预留空间实现。**辅助按钮严禁占据核心业务流空间，必须以悬浮 (Overlay) 方式贴边/贴底显示。**

### 2. 多端布局策略 (Multi-Device Layout Strategy)
- **PC 核心驱动 (PC-First)**：以 PC 端 (16:9) 为核心设计基准，追求极致的大屏沉浸感与专业级交互操作。
- **场景自适应 (Scene-Centric)**：针对游戏内核进行自适应优化。移动端定位为“尽力兼容 (Best-effort Compatibility)”，优先保证核心功能可用。
- **宽限度约束 (Constraints)**：平台/网页 UI 通过 `max-w-7xl` 等容器限制内容延展，确保视觉焦点集中。
- **响应式策略指南 (Responsive Strategy Guidelines)**：
    - **信息交互层 (UI & HUD)**：
        - **场景**：大厅卡片、侧边栏、模态框、文字阅读区。
        - **建议**：**稳定性优先**。推荐使用标准 `rem`，建议配合 `clamp()` 锁定物理最小值（12px/14px），保证全环境可读。
    - **沉浸视效层 (Immersive & Board)**：
        - **场景**：游戏棋盘、全屏背景、核心对战区域。
        - **建议**：**比例优先**。推荐使用 `vw/vh`、`%` 或 `aspect-ratio`，确保游戏画面能完整填充用户视口，保持沉浸感。
    - **布局流动层 (Layout Flow)**：
        - **场景**：列表网格、工具栏排列。
        - **建议**：**内容驱动**。利用 Flex/Grid 的自然流特性（如自动填充、自动换行）来适配屏幕宽度，而非依赖硬编码的断点控制。

### 3. 游戏 UI 特化范式 (Game-Centric Design)
- **动态提示 UI（强制）**：
    - 必须使用 `absolute`/`fixed`，禁止占用布局空间（如 `relative/static`）。
    - 出现/消失不得挤压或移动其他 UI；新增前必须验证布局稳定性（尤其右侧栏/手牌区/技能区等核心区）。
    - 层级：一般提示 `z-[100]~z-[150]`，交互提示 `z-[150]~z-[200]`，模态框 `z-[200]+`。
    - 常用位置：顶部中央（交互选择）、正中央（等待）、手牌上方（弃牌）；默认 `pointer-events-none`（除非需要交互）。
- **视角解耦 (Scene vs. HUD)**：
    - **场景层 (Scene)**：棋盘、卡片等核心实体，需通过 `anchorPoint` 处理坐标缩放，确保跨平台逻辑一致性。
    - **UI 层 (HUD)**：状态信息、控制面板，执行 Overlay 挂载逻辑。
- **高度稳定性**：核心游戏区（棋盘/面板）**必须**使用明确高度约束（如 `h-[35vw]`）代替 `h-full`，彻底解耦父级 Flex 依赖。
- **相位敏感性**：UI 必须清晰反馈当前“游戏相位”与“操作权限”，通过高亮合规动作 (Valid Actions) 降低认知负荷。
- **拖拽回弹规则**：当需要回弹到原位时，**不要**关闭 `drag`，否则 `dragSnapToOrigin` 不会执行；应保持 `drag={true}` 并用 `dragListener` 控制是否可拖。

---


---
