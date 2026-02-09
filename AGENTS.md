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
> **以当前对话为主，当我说继续指的都是当前对话的任务，除非指明否则不关心其他对话的修改**

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
- **多方案必须标注最正确方案（强制）**：当给出多个方案时，必须明确写出"最正确方案"，并说明理由。**最正确方案的评判标准优先级（从高到低）**：
  1. **架构正确性**：用正确的模型解决问题，而非用 hack/补丁掩盖不合适的模型。
  2. **可维护性**：代码意图清晰、状态流可追踪、未来扩展无须重写。
  3. **一致性**：与项目现有模式、约定保持一致。
  4. **风险/成本**：改动范围、回归影响、实现复杂度。
  - **禁止以"改动最小"作为最正确方案的首要理由**；如果改动小但架构不正确，必须选择架构正确的方案并说明为什么不能用补丁。
- **未讨论方案先自检（强制）**：当准备直接给出并执行某个修改方案、且该方案未经过讨论/确认时，必须先自检：是否为最正确方案、是否合理、是否符合现有架构与设计模式原则；若存在不确定点，先提出并等待确认。
- **最正确方案可直接执行（强制）**：当你已明确判断存在且唯一的“最正确方案”，并且该方案不依赖用户偏好/取舍、不会引入额外不确定性时，**不需要询问，直接执行**；仅在需要用户做价值取舍（例如范围/优先级/视觉风格）、或关键事实缺失会改变最正确方案时才提问确认。
- **重构清理遗留代码（强制）**：重构应尽可能删除/迁移不再使用的代码与资源；若确实无法清理，必须明确告知哪些遗留被保留、原因、以及后续清理计划/风险。
- **字段准入（Schema Gate）（强制）**：任何“布局/契约结构”只允许进入**有架构意义的数据**（稳定、可复用、跨模块边界需要共享的字段）；严禁把“历史回放数据、局部 UI 状态、调试缓存/临时派生值”等回灌进布局结构。确需使用时，放入组件局部 state、专用模块状态或专用缓存结构，避免结构膨胀与语义误导。
- **命名冲突裁决机制（强制）**：当出现多种命名并存时，必须给出唯一裁决并做**全链路统一**（类型/文件名/导出名/调用点/文档）。裁决依据使用：覆盖范围 + 已实现程度 + 架构权重；禁止为了“改动最小”保留多头命名。
- **临时实现债务登记（强制）**：允许为打通流程做临时实现，但必须标注 TODO，并写清：回填逻辑（最终应如何收敛）+ 清理触发条件（何时/由谁删除临时代码）。若不确定方案，优先扩展阅读或暂停提问，禁止硬写“糊过去”。
- **样式开发约束（核心规定）**：**当任务目标为优化样式/视觉效果时，严禁修改任何业务逻辑代码**（如状态判定、Button 的 disabled 条件、Phase 转换逻辑等）。如需修改逻辑，必须单独申请。
- **目录/游戏边界严格区分（强制）**：本仓库为综合性游戏项目，存在同名/近似命名文件夹；修改/引用前必须以完整路径与所属 gameId（如 `src/games/dicethrone/...`）核对，禁止把不同游戏/模块的目录当成同一个。
- **规则文档指代（强制）**：当我说“规则”时，默认指该游戏目录下 `rule/` 文件夹中的规则 Markdown（如 `src/games/dicethrone/rule/王权骰铸规则.md`）。
- **改游戏规则/机制前先读规则文档（强制）**：当修改会影响玩法/回合/结算/卡牌或状态效果/资源等“规则或机制”时（而非纯 UI 样式/小 bug 修复），在开始改该游戏代码之前必须先检查该游戏对应脚本目录 `rule/` 文件夹下的规则文档（例如 `src/games/<gameId>/rule/`），确认约束与注意事项后再动手。
- **Git 禁止使用 restore（强制）**：禁止使用 `git restore`（含 `--staged`）；如需丢弃/回退变更，必须先说明原因并采用可审计的替代方式。
- **关键逻辑注释（强制）**：涉及全局状态/架构入口/默认行为（例如 Modal 栈、路由守卫、全局事件）必须写清晰中文注释；提交前自检是否遗漏，避免再次发生。
- **日志不需要开关，调试完后将移除（强制）**
- **日志格式**：新增/临时日志尽量是“可直接复制”的纯文本，不要直接打印对象（避免控制台折叠与难复制）；推荐用 key=value 形式把关键字段展开，例如：`[模块] 事件=xxx userId=... matchId=... step=... costMs=...`。
- **新增功能必须补充测试（强制）**：新增任何功能、技能、卡牌、效果或 API 端点时，必须同步补充对应的测试用例。测试应覆盖正常流程和异常场景，确保效果与描述一致。补充测试后必须自行运行测试确保通过。详见 `docs/automated-testing.md`。
- **单文件行数限制（强制）**：单个源码文件（`.ts`/`.tsx`/`.js`/`.jsx`）**不得超过 1000 行**。超过时必须拆分为独立模块或子文件，按职责划分（如按英雄、按功能类型）。拆分后确保导入导出关系清晰，避免循环依赖。
- **素材数据录入规范（强制）**：当根据图片素材（如卡牌图集、技能面板、单位属性图）对代码中的业务数据（数值、效果、触发条件等）进行**提取、覆盖或修正**时：
  1. **全口径核对**：表格必须包含该素材中展示的**被操作组件的所有核心业务属性及执行顺序**。
  2. **逻辑序列化**：如果图片中描述了"先 A 然后 B"的逻辑，表格必须以 **1. 2. 3.** 的形式枚举完整的逻辑链路。
  3. **关键限定词显式核对**：如"然后"、"另外"、"所有对手"、"不可阻挡"等限定词需明确标注，并说明代码如何实现该语义。
  4. **输出格式**：使用 Markdown 表格，列包含 `组件ID`、`属性/逻辑序列（视觉解读）`、`代码状态`、`操作/原因`。此表格在对话回复中输出，作为 AI 与用户之间的"全量核对契约"。
- **框架复用优先（强制）**：

  - **禁止为特定游戏实现无法复用的系统**。所有UI组件、逻辑Hook、动画系统必须先实现为通用骨架/框架（放在 `/core/` 或 `/components/game/framework/`），游戏层通过配置/回调注入差异。
  - **复用架构三层模型**：
    1. `/core/ui/` - 类型契约层（接口定义）
    2. `/components/game/framework/` - 骨架组件层（通用实现，泛型）
    3. `/games/<gameId>/` - 游戏层（样式注入、配置覆盖）
  - **新增任何系统/组件/Hook前强制检查清单**：
    1. `find_by_name` 搜索 `/core/`、`/components/game/framework/`、`/engine/` 等目录，检查是否已有相关实现
    2. `grep_search` 搜索关键词（如 "Skeleton"、功能名、Hook名），确认是否已有可复用实现
    3. 若已有实现，必须复用；若需扩展，在框架层扩展而非游戏/模块层重复实现
    4. 若确实需要新建，必须先设计为可跨游戏/跨模块复用的通用实现
  - **判定标准**：如果为了复用需要增加大量不必要代码，说明框架设计有问题，必须重新设计而非硬塞。
  - **适用范围**：手牌区、出牌区、资源栏、阶段指示器等UI骨架组件。
  - **系统层设计原则**：
    - **接口 + 通用逻辑骨架**：系统层包含可跨游戏复用的接口定义和通用逻辑（如边界检查、叠加计算），不包含游戏特化逻辑。
    - **游戏特化下沉**：游戏特有概念放在`/games/<gameId>/`目录。
    - **预设扩展**：常见游戏类型（战斗类、棋盘类）可提供预设扩展，游戏按需引用。
    - **每游戏独立实例**：禁止全局单例，每个游戏创建自己的系统实例并注册定义。
    - **UGC通过AI生成代码**：AI提示词包含系统接口规范，生成符合规范的定义代码，运行时动态注册。
    - **Schema自包含作为备选**：简单UGC场景可用Schema字段直接包含min/max等约束，不依赖系统注册。

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

- **早期返回必须在所有 Hooks 之后**：`if (condition) return null` 这类早期返回必须放在所有 `useState`、`useEffect`、`useCallback`、`useMemo` 等 Hooks 调用之后，否则会导致 "Rendered more hooks than during the previous render" 错误。
- **典型错误模式**：
  ```tsx
  // ❌ 错误：useEffect 在早期返回之后
  const [position, setPosition] = useState(null);
  if (!position) return null;  // 早期返回
  useEffect(() => { ... }, []); // 这个 hook 在某些渲染中不会执行
  
  // ✅ 正确：所有 hooks 在早期返回之前
  const [position, setPosition] = useState(null);
  useEffect(() => { ... }, []); // 先声明所有 hooks
  if (!position) return null;  // 早期返回放最后
  ```

### 白屏问题排查流程（强制）
> **白屏时禁止盲目修改代码**，必须先获取证据。

1. **第一步：运行 E2E 测试获取错误日志**
   ```bash
   npx playwright test e2e/<相关测试>.e2e.ts --reporter=list
   ```
2. **第二步：如果 E2E 无法捕获，请求用户提供浏览器控制台日志**
3. **第三步：根据错误信息定位问题**，常见白屏原因：
   - React Hooks 顺序错误（"Rendered more hooks than during the previous render"）
   - 组件渲染时抛出异常
   - 路由配置错误
   - 资源加载失败（404）
4. **禁止行为**：在没有错误日志的情况下"猜测"问题并随意修改代码

### Vite SSR 函数提升陷阱（强制）
> **Vite 的 SSR 转换会将 `function` 声明转为变量赋值，导致函数提升（hoisting）失效。**

- **问题**：原生 JS 中 `function foo() {}` 会被提升到作用域顶部，但 Vite SSR（vite-node）会将其转换为类似 `const foo = function() {}` 的形式，此时在定义之前引用会抛出 `ReferenceError: xxx is not defined`。
- **典型错误模式**：
  ```typescript
  // ❌ 错误：注册函数在文件上方，被引用的函数定义在文件下方
  export function registerAll(): void {
      registerAbility('foo', handler); // handler 还未定义！
  }
  // ... 200 行后 ...
  function handler(ctx: Context) { ... }
  
  // ✅ 正确：确保所有被引用的函数在注册调用之前定义，或将注册函数放在文件末尾
  function handler(ctx: Context) { ... }
  export function registerAll(): void {
      registerAbility('foo', handler); // handler 已定义
  }
  ```
- **规则**：在能力注册文件（`abilities/*.ts`）中，`register*Abilities()` 导出函数必须放在文件末尾，确保所有被引用的实现函数都已定义。

### Auth / 状态管理（强制）
- **禁止在组件内直接读写 `localStorage` 作为业务状态**（例如 token）。优先通过 Context/状态流获取，避免 key 不一致与状态不同步。
- **Context Provider 的 `value` 必须 `useMemo`，内部方法用 `useCallback`**，避免全局无意义重渲染。

### 交互与弹窗（强制）
- **禁止使用 `window.prompt` / `window.alert` / `window.location.reload` 作为业务流程**；一律用 Modal + 状态更新，保证单向数据流。
- **弹窗逻辑依赖稳定**：`useEffect` 依赖的 handler 必须 `useCallback`，避免重复触发与关闭/打开抖动。
- **Toast 用于非阻塞提示**：可用于“成功/失败/告警”轻提示，但不可替代需要用户确认/输入的交互。

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

### 动效技术选型规范（强制）

> **核心原则**：根据动效本质选择正确的技术，而非统一用一种方案硬做所有效果。

| 动效类型 | 正确技术 | 判断标准 | 典型场景 |
|----------|----------|----------|----------|
| **粒子系统** | Canvas 2D（自研引擎） | 粒子特效（几十到几百级别）；双层绘制（辉光+核心） | 胜利彩带、召唤光粒子、爆炸碎片、烟尘扩散 |
| **复杂矢量动画** | Canvas 2D **推荐** | 每帧重绘复杂路径（弧形/渐变/多层叠加） | 斜切刀光、气浪冲击波、复杂轨迹特效 |
| **多阶段组合特效** | Canvas 2D **推荐** | 需要蓄力→爆发→持续→消散等多阶段节奏；需要 additive 混合/动态渐变/脉冲呼吸 | 召唤光柱、技能释放、大招特写 |
| **形状动画** | framer-motion | 确定性形状变换（缩放/位移/旋转/裁切/透明度）；每次触发 1-3 个 DOM 节点 | 红闪脉冲、伤害数字飞出、简单冲击波 |
| **UI 状态过渡** | framer-motion / CSS transition | 组件进出场、hover/press 反馈、布局动画 | 手牌展开、横幅切换、按钮反馈、阶段指示脉冲 |
| **精确设计动效** | Lottie（未接入，需美术资源） | 设计师在 AE 中制作的复杂动画，需要逐帧精确控制 | 暂无，未来可用于技能释放特写 |

**PixiJS 已评估不适用（2026-02-08）**：已移除，当前特效规模下 Canvas 2D 全面优于 PixiJS。详见 `docs/refactor/pixi-performance-findings.md`。

**Canvas 粒子引擎使用规范**：
- **引擎位置**：`src/components/common/animations/canvasParticleEngine.ts`
- **双层绘制**：每个粒子有辉光层（半透明大圆）+ 核心层（高亮小圆），视觉质感和 FlyingEffect 一致
- **预设驱动**：通过 `ParticlePreset` 配置粒子行为，`BURST_PRESETS` 提供常用预设
- **生命周期**：粒子效果必须有明确的 `life` 配置，所有粒子消散后自动停止渲染循环
- **现有组件**：`BurstParticles`（爆炸/召唤/烟尘）、`VictoryParticles`（胜利彩带）
- **Canvas 溢出规范（强制）**：特效 Canvas 天然超出挂载目标边界，**禁止用 `overflow: hidden` 裁切**。优先使用无溢出方案（Canvas 铺满父级，绘制基于 canvas 尺寸）；小元素挂载场景使用溢出放大方案（Canvas 比容器大 N 倍，居中偏移，容器设 `overflow: visible` + `pointer-events-none`）。详见 `docs/particle-engine.md` § Canvas 溢出规范。
- **特效组件 useEffect 依赖稳定性（强制，适用于所有特效组件）**：所有特效组件（Canvas 粒子、framer-motion、DOM timer 驱动）的动画循环/timer 由 useEffect 启动，**其依赖数组中的每一项都必须引用稳定**，否则父组件重渲染会导致 useEffect 重跑 → 动画重启/中断。
  - **回调 prop（`onComplete` 等）**：必须用 `useRef` 持有，禁止放入 useEffect 依赖。Canvas 组件和 DOM timer 组件（如 ImpactContainer/DamageFlash）同样适用。
  - **数组/对象 prop（`color` 等）**：`useMemo` 的依赖不能直接用数组/对象引用（浅比较会失败），必须用 `JSON.stringify` 做值比较。
  - **典型错误**：调用方传内联箭头函数或数组字面量 → 父组件因性能计数器/状态更新重渲染 → prop 引用变化 → useEffect 重跑 → 粒子不断重生/timer 组件效果被截断，表现为"特效卡住好几秒"或"播放一半就没了"。
- **条件渲染特效的生命周期管理（强制）**：当使用 `{isActive && <Effect />}` 条件渲染特效组件时：
  - **必须有关闭机制**：通过 `onComplete` 回调将 `isActive` 设回 `false`，否则 isActive 永远为 true，连续触发时组件不会卸载重挂载，效果只播一次。
  - **重触发模式**：`setIsActive(false)` → `requestAnimationFrame(() => setIsActive(true))`，确保 React 先卸载再重挂载。
  - **禁止用固定 timer 关闭**：不要用 `setTimeout(() => setIsActive(false), 100)` 硬编码关闭时间，必须由效果组件自身通过 `onComplete` 通知完成。
  - **典型错误**：ImpactCard 没有 onComplete → isActive 永远 true → 连续点击时 DamageFlash 不重挂载 → 效果只播一瞬间。
- **组合式特效架构（强制）**：打击感特效必须按职责拆分为两层：
  - **ImpactContainer（包裹层）**：作用于目标本身——震动（ShakeContainer）+ 钝帧（HitStopContainer）。ShakeContainer 在外层承载 className（背景/边框），HitStopContainer 在内层。
  - **DamageFlash（覆盖层）**：纯视觉 overlay——斜切（RiftSlash）+ 红脉冲（RedPulse）+ 伤害数字（DamageNumber），作为 ImpactContainer 的子元素。
  - **正确组合**：`<ImpactContainer><Target /><DamageFlash /></ImpactContainer>`
  - **禁止**：把震动和视觉效果混在同一个组件里；把 DamageFlash 放在 ImpactContainer 外面（会导致震动目标不一致）。

**判断边界（快速自检）**：
1. 需要每帧重绘复杂矢量路径（弧形/渐变）？→ 用 Canvas 2D 手写（如 SlashEffect）
2. 需要粒子特效（爆炸/烟尘/彩带/光粒子）？→ 用 Canvas 粒子引擎（BurstParticles）
3. 需要多阶段组合特效（蓄力/爆发/持续/消散）？→ 用 Canvas 2D（如 SummonEffect）
4. 需要简单形状变换（1-3 个元素）？→ 用 framer-motion
5. 需要 UI 组件进出场/状态切换？→ 用 framer-motion 或 CSS transition

**为什么多阶段特效必须用 Canvas 而非 framer-motion（教训）**：
- **逐帧精确控制**：Canvas 每帧重绘，可在同一动画循环中实现蓄力→爆发→呼吸→消散等多阶段节奏；framer-motion 只能声明式定义起止状态，中间过程不可控。
- **动态渐变**：Canvas 的 `createLinearGradient`/`createRadialGradient` 每帧可动态改变参数（位置/颜色/透明度），CSS gradient 是静态的。
- **additive 混合**：`globalCompositeOperation: 'lighter'` 让光效自然叠加发亮，DOM 元素无法实现。
- **形状自由度**：梯形光柱、柔和边缘辉光等自由路径绘制不受 CSS box model 限制。
- **clipPath 动画不可靠**：framer-motion 对 `clipPath` 字符串插值支持不稳定，实测无法正确动画。

**特效视觉质量规则（强制）**：
- **禁止纯几何拼接**：特效禁止用 `stroke` 线段、V 形轮廓、横切线等几何图元拼凑，视觉效果生硬且缺乏能量感。
- **正确做法**：优先使用粒子系统（streak/circle 喷射 + 自然衰减）或柔和径向渐变模拟气流/光晕；需要轨迹时用粒子拖尾而非画线。
- **判断标准**：如果特效看起来像"线框图/几何示意图"而非"有能量感的自然效果"，说明方案有问题，必须换用粒子/渐变方案。

**通用特效组件规范（强制）**：
- **通用 vs 游戏特有**：除非特效包含游戏特有语义（如特定卡牌名称文字、游戏专属资源），否则必须实现为通用组件放在 `src/components/common/animations/`，游戏层通过 props 注入差异。
- **现有通用特效清单**（新增特效前必须检查是否已有）：
  - `FlyingEffect` — 飞行特效（伤害/治疗/Buff 飞行数字+粒子尾迹）｜使用：`dicethrone/Board`、`dicethrone/hooks/useAnimationEffects`
  - `ShakeContainer` — 震动容器｜使用：`dicethrone/Board`、`dicethrone/ui/OpponentHeader`、`ImpactContainer`（内部）
  - `HitStopContainer` — 钝帧容器｜使用：`summonerwars/ui/BoardGrid`、`ImpactContainer`（内部）
  - `SlashEffect` — 弧形刀光（Canvas 2D）｜使用：仅预览页
  - `BurstParticles` — 爆发粒子（Canvas 2D 引擎）｜使用：`summonerwars/ui/DestroyEffect`
  - `VictoryParticles` — 胜利彩带（Canvas 2D 引擎）｜使用：`components/game/EndgameOverlay`
  - `ImpactContainer` — 打击感包裹容器（震动+钝帧，ShakeContainer 外层 + HitStopContainer 内层）｜使用：`summonerwars/ui/BoardEffects`
  - `PulseGlow` — 脉冲发光/涟漪｜使用：`dicethrone/Board`、`components/system/FabMenu`
  - `SummonEffect` — 召唤/降临特效（Canvas 2D 多阶段）｜使用：`summonerwars/ui/BoardEffects`
  - `ConeBlast` — 远程投射气浪（Canvas 2D 粒子引擎）｜使用：`summonerwars/ui/BoardEffects`
  - `DamageFlash` — 受伤视觉覆盖层（斜切+红脉冲+伤害数字，纯 overlay）｜使用：`summonerwars/ui/BoardEffects`
  - `RedPulse` — 红色脉冲原子组件（framer-motion）｜使用：`DamageFlash`（内部）
  - `DamageNumber` — 伤害数字飘出原子组件｜使用：`DamageFlash`（内部）
  - `FloatingText` — 独立飘字（弹出+弹性缩回+上浮淡出）｜使用：仅预览页
  - `RiftSlash` — 次元裂隙直线斜切（Canvas 2D）｜使用：`DamageFlash`（内部）
  - `CardDrawAnimation` — 抽牌动画（飞出+3D翻转）｜使用：仅导出，暂无业务引用
  - `ShatterEffect` — 碎裂消散（square 粒子 + 重力下坠 + 旋转飞散）｜使用：暂未接入，预期替代 BurstParticles 用于死亡效果
- **预览页同步**：新增通用特效组件后，必须在 `src/pages/devtools/EffectPreview.tsx` 的 `EFFECT_CATEGORIES` 中注册预览区块。

### 文档索引与使用时机（强制）

| 场景 / 行为 | 必须阅读的文档 | 关注重点 |
| :--- | :--- | :--- |
| **处理资源** (图片/音频/图集/清单) | `docs/tools.md` | 压缩指令、扫描参数、清单校验 |
| **修改 DiceThrone** (文案/资源) | `docs/dicethrone-i18n.md` | 翻译 Key 结构、Scheme A 取图函数 |
| **环境配置 / 部署** (端口/同域代理) | `docs/deploy.md` | 端口映射、环境变量、Nginx 参数 |
| **本地联机测试** (单人同步调试) | `docs/test-mode.md` | 测试模式开关及其对视角的影响 |
| **编写或修复测试** (Vitest/Playwright) | `docs/automated-testing.md` | 测试库配置、错误码命名规范 |
| **开发前端 / 新增游戏** (引擎/组件) | `docs/framework/frontend.md` | 系统复用 (Ability/Status)、动画组件、解耦规范 |
| **开发后端 / 数据库** (NestJS/Mongo) | `docs/framework/backend.md` | 模块划分、Socket 网关、存储适配器 |
| **接口调用 / 联调** (REST/WS) | `docs/api/README.md` | 认证方式、分页约定、实时通信事件 |
| **使用 Undo / Fab 功能** | `docs/components/UndoFab.md` | UndoFab 组件的 Props 要求与环境依赖 |
| **新增作弊/调试指令** | `docs/debug-tool-refactor.md` | 游戏专属调试配置的解耦注入方式 |
| **粒子特效开发** (Canvas 2D 引擎) | `docs/particle-engine.md` | API、预设字段、性能优化、视觉质量规则、新增检查清单 |
| **状态同步/存储调优** (16MB 限制) | `docs/mongodb-16mb-fix.md` | 状态裁剪策略、Log 限制、Undo 快照优化 |
| **复杂任务规划** (多文件/长流程) | `.agent/skills/planning-with-files/SKILL.md` | 必须维护 `task_plan.md`，定期转存 `findings.md` |
| **UI/UX 设计** (配色/组件/动效) | `.agent/skills/ui-ux-pro-max/SKILL.md` | 使用 `python3 ... search.py` 生成设计系统与样式 |
| **大规模 UI 改动** (新页面/重做布局/新游戏UI) | 先 Skill `--design-system`，再 `design-system/` | 见 §UI/UX 规范 → §0. 大规模 UI 改动前置流程 |
| **游戏内 UI 交互** (按钮/面板/指示器) | `design-system/game-ui/MASTER.md` | 交互原则、反馈规范、动画时长、状态清晰 |
| **游戏 UI 风格选择** | `design-system/styles/` | arcade-3d（街机立体）、tactical-clean（战术简洁）、classic-parchment（经典羊皮纸） |

### 新引擎系统注意事项（强制）
- **数据驱动优先（强制）**：规则/配置/清单优先做成可枚举的数据（如 manifest、常量表、定义对象），由引擎/系统解析执行；避免在组件或 move 内写大量分支硬编码，确保可扩展、可复用、可验证。
- **领域 ID 常量表（强制）**：所有领域内的稳定 ID（如状态效果、Token、骰面符号、命令类型）必须在 `domain/ids.ts` 中定义常量表，禁止在代码中直接使用字符串字面量（如 `'knockdown'`、`'taiji'`）。
  - **常量表结构**：使用 `as const` 确保类型安全，并导出派生类型（如 `StatusId`、`TokenId`）。
  - **示例**：`STATUS_IDS.KNOCKDOWN`、`TOKEN_IDS.TAIJI`、`DICE_FACE_IDS.FIST`。
  - **例外**：国际化 key（如 `t('dice.face.fist')`）、类型定义（如 `type DieFace = 'fist' | ...`）可保留字符串字面量。
  - **好处**：重命名成本低、IDE 自动补全、类型安全、序列化兼容（字符串值保留）。
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
- **特效/动画事件消费必须使用 EventStreamSystem（强制）**：
  - UI 层消费事件驱动特效/动画/音效时，**必须**使用 `getEventStreamEntries(G)`（`EventStreamSystem`），**禁止**使用 `getEvents(G)`（`LogSystem`）。
  - **原因**：`LogSystem` 是持久化全量日志，刷新后完整恢复；`EventStreamSystem` 是实时消费通道，每条 entry 带稳定自增 `id`，撤销时会清空（避免重播）。用 LogSystem + `useRef(0)` 做消费指针，刷新后指针归零会导致历史事件全部重演。
  - **正确模式**：用 `lastSeenEventId = useRef(-1)` 追踪已消费的 `entry.id`；首次挂载时将指针推进到末尾（跳过历史）；后续只处理 `entry.id > lastSeenEventId` 的新事件。
  - **参考实现**：`src/games/summonerwars/Board.tsx` 的事件消费 effect、`src/lib/audio/useGameAudio.ts` 的音效去重。

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

### 本地模式配置来源（强制）
- **唯一判断来源**：`src/games/*/manifest.ts` 的 `allowLocalMode`。
- **规则**：文档与代码逻辑必须严格以该字段为准，禁止再写“判定准则”。
- **落地要求**：
  - `allowLocalMode=false` 时，不得新增任何 local 专用流程（自动选角/自动准备/跳过校验）。
  - 教学模式仍可保留，但逻辑与联机一致。

> DiceThrone：`allowLocalMode=false`，仅保留 tutorial；联机流程为唯一权威路径。

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
| 粒子特效 | Canvas 2D（自研引擎） | 双层绘制（辉光+核心），零依赖；选型规范见"动效技术选型规范" |
| 国际化 | i18next + react-i18next | 多语言与懒加载词条 |
| 音频 | howler | 统一音效/音乐管理 |
| 实时通信 | socket.io / socket.io-client | 大厅与对局实时同步 |
| 实时同步 | boardgame.io | 游戏状态机同步与持久化 |
| 后端 | Node.js (Koa 游戏服务 + NestJS 认证/社交) | HTTP API + Socket.io 服务端 |
| 数据库 | MongoDB (注意使用的是docker而不是本地) | 用户数据、对局历史与房间持久化 |
| 测试 | Vitest + Playwright + GameTestRunner | 单元/集成 + E2E + 领域测试 |
| 基础设施 | Docker / Docker Compose | 本地与部署一致化 |

> 说明：`three` / `@react-three/fiber` / `@react-three/drei` 已安装但当前未接入代码，避免在未确认需求前启用。
> 说明：`tsParticles` 已移除（2026-02-08），替换为自研 Canvas 2D 粒子引擎（`canvasParticleEngine.ts`），效果更好、零依赖、包体积更小。

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

### 2. 验证测试（Playwright 优先）
- **详细规范**：阅读 `docs/automated-testing.md`（命令、目录结构、覆盖要求、编写规范）。
- **测试工具**：Playwright E2E（首选）、Vitest（领域/API）、GameTestRunner（命令序列）。
- **常用命令**：`npm run test:e2e`（E2E）、`npm test -- <路径>`（Vitest）。
- **失败处理**：查看 Playwright 报告（`npx playwright show-report`）和截图/视频。
- **截图规范（强制）**：禁止使用硬编码路径保存截图，必须使用 `testInfo.outputPath('name.png')` 以确保并行测试时的隔离性。详情见 `docs/automated-testing.md`。

**E2E 覆盖要求（强制）**：端到端测试必须覆盖“关键交互面”，而不只是跑通一条完整流程。
- 交互面示例：按钮/菜单/Tab/Modal 打开关闭/表单校验与错误提示/列表操作/关键面板交互。
- 主流程：保留 1 条 happy path 作为回归基线，但不能替代交互覆盖。

---

## 📂 项目目录结构

> 更完整的“项目地图（超详细目录树）”见 `docs/project-map.md`，用于按目录层级快速定位到具体功能文件（例如悬浮球：`src/components/system/FabMenu.tsx`）。

> **宏观图优先（强制）**：当用户只说“功能/模块”（例如：悬浮球/大厅/重赛/撤销/弹窗/音频/国际化/教学/调试/状态效果/技能系统），但未提供明确路径时：
> 1) 先用本节的目录树把需求归类到正确层级边界；2) 再进入该边界内用搜索收敛到具体文件；

```
/ (repo root)
├── server.ts                     # 游戏服务入口（Boardgame.io + socket.io 事件）
├── src/                          # 前端与共享模块（React/TS）
├── server/                       # 服务端共享模块（db/邮件/存储/模型；被 server.ts 使用）
├── public/                       # 静态资源（图片/字体/本地化 JSON）
├── scripts/                      # 工具脚本（压缩/打包/迁移/诊断/验证）
│   └── verify/                   # 一次性/脚本级验证（如 social-ws）
├── docs/                         # 研发文档（框架/部署/组件/测试规范/API）
│   ├── api/                      # API 文档集合
│   ├── audio/                    # 音频迁移/统计/清理记录
│   ├── components/               # 组件级规范（如 UndoFab）
│   ├── framework/                # 前后端框架规范
│   └── refactor/                 # 重大重构记录与复盘
├── openspec/                     # 变更规范与提案（proposal/spec/tasks/design）
│   ├── 🛡️ AGENTS.md               # OpenSpec 自身的代理规则（与本文件互补）
│   ├── specs/                    # 通用 specs（跨变更复用）
│   └── changes/                  # 每次变更的 proposal/design/spec/tasks
├── e2e/                          # Playwright 端到端测试
├── test/                         # 集成/脚本型测试与一次性验证
├── docker/                       # 容器化与部署
├── design/                       # 设计稿/参考资料
├── evidence/                     # 证据归档（截图/日志/复现步骤）
└── screenshots/                  # 项目截图
```

```
src/
├── main.tsx                      # 前端启动入口（挂载 App / Provider 链）
├── App.tsx                       # 顶层路由与全局壳
├── index.css                     # 全局样式入口（Tailwind）
├── api/                          # 前端 API 调用封装（HTTP client/typed endpoints 等）
├── assets/                       # 源码内静态资源（少量；大资源应在 public/assets/）
├── config/                       # 前端配置与游戏规则常量
├── pages/                        # 页面级入口（路由落点优先从这里找）
│   ├── Home.tsx                  # 首页/大厅入口
│   ├── MatchRoom.tsx             # 在线对局/教学模式入口（GameModeProvider 在此链路）
│   ├── LocalMatchRoom.tsx        # 本地同屏对局入口
│   └── admin/                    # 管理后台页面
│       └── components/           # 管理后台专用组件
├── components/                   # 通用 UI 组件（从“页面”向下分发）
│   ├── layout/                   # 页面布局壳
│   ├── lobby/                    # 大厅 UI（房间列表/创建加入/成员状态）
│   ├── game/                     # 游戏内 HUD/面板/战斗区/框架骨架
│   │   └── framework/            # 跨游戏复用的棋盘/区域骨架组件
│   ├── system/                   # 系统级 UI（悬浮按钮/全局浮层/系统菜单等）
│   ├── auth/                     # 登录/注册相关 UI
│   ├── tutorial/                 # 教学引导 UI
│   └── common/                   # 通用小组件与基础样式
├── hooks/                         # 通用 Hooks
│   └── ui/                        # UI/动效相关 hooks（如 deferred render/backdrop blur）
├── contexts/                     # 全局状态/服务注入点（业务入口优先从这里找）
│   ├── AuthContext.tsx           # 登录态/JWT
│   ├── AudioContext.tsx          # 音频开关/BGM/SFX
│   ├── ModalStackContext.tsx     # 弹窗栈
│   ├── UndoContext.tsx           # 撤销能力
│   ├── GameModeContext.tsx       # local/online/tutorial 模式注入
│   ├── MatchRoomExitContext.tsx  # 退出房间流程
│   └── RematchContext.tsx        # 重赛投票（多人走 socket 事件，非 move）
├── services/                     # 对外通信/实时通道封装（socket/http）
│   ├── matchSocket.ts            # 对局房间 socket（含 rematch）
│   ├── lobbySocket.ts            # 大厅 socket
│   └── socialSocket.ts           # 社交 socket
├── lib/                          # 底层工具库（不含业务 UI）
│   ├── i18n/                     # 国际化初始化/懒加载
│   └── audio/                    # AudioManager 与音频路由/合并配置
├── shared/                       # 前后端共享的协议/类型（如 chat）
├── types/                        # 全局类型（如 social）
├── engine/                       # 引擎层（确定性规则核心 + 系统管线）
│   ├── adapter.ts                # boardgame.io 适配层
│   ├── notifications.ts          # 引擎级通知
│   ├── pipeline.ts               # Command/Event 执行管线
│   ├── types.ts                  # 引擎核心类型
│   ├── hooks/                    # 引擎 hooks
│   └── systems/                  # 引擎系统（Undo/Prompt/Flow/Log/Tutorial/Rematch 等）
├── systems/                      # 跨游戏可复用通用系统（Dice/Resource/Token/Ability 等）
│   ├── core/                     # 系统核心契约（Effect/Condition/Tag 等）
│   ├── presets/                  # 预设（如 combat）
│   ├── DiceSystem/               # 骰子系统
│   ├── ResourceSystem/           # 资源系统
│   └── TokenSystem/              # Token 系统
├── core/                         # 框架核心（类型/资源加载/通用 UI 类型契约）
│   ├── AssetLoader.ts            # 资源加载器
│   ├── __tests__/                # core 层测试
│   └── ui/                       # UI 类型契约与通用算法（board hit-test/layout 等）
├── games/                        # 具体游戏实现（强制以 gameId 隔离）
│   ├── manifest.ts               # 游戏清单（纯数据）
│   ├── registry.ts               # 游戏实现注册
│   ├── manifest.*generated*      # 自动生成的清单与类型（不要手改）
│   ├── ugcbuilder/               # UGC Builder 作为一种“游戏”的 manifest
│   └── <gameId>/                 # 每个游戏独立目录（dicethrone/summonerwars/tictactoe/...）
│       ├── rule/                 # 规则文档
│       ├── game.ts               # 规则入口
│       ├── Board.tsx             # 游戏 UI 主板
│       ├── tutorial.ts           # 教学配置
│       ├── audio.config.ts       # 游戏专属音频配置
│       ├── __tests__/            # 游戏测试
│       ├── domain/               # 领域层（存在则表示已做领域拆分）
│       ├── config/               # 游戏配置（存在则表示数据驱动）
│       └── ui/                   # 游戏 UI 子模块（存在则表示已拆分 UI）
├── ugc/                          # UGC 运行时 + Builder（AI 提示词/Schema/打包/沙箱）
│   ├── builder/                  # Builder 主体（pages/context/ui/utils/schema/ai）
│   ├── assets/                   # UGC 资产类型与索引
│   └── client/                   # UGC client types
└── server/                       # 前端侧的“server helpers”（注意：与 repo 根的 server/ 不同）
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
| 领域 ID 常量表 | `src/games/<游戏名>/domain/ids.ts` |
| 应用入口 | `src/App.tsx` |
| 证据归档 | `evidence/` |

---

## 🖼️ 图片资源与使用规范

### ⚠️ 强制规则：禁止直接使用未压缩图片

**所有图片必须经过压缩后使用，禁止在代码中直接引用原始 `.png/.jpg` 文件。**

### 资源目录结构

```
public/assets/<gameId>/
├── images/
│   ├── foo.png              # 原始图片（仅用于压缩源）
│   └── compressed/          # 压缩输出目录
│       ├── foo.avif         # AVIF 格式（首选）
│       └── foo.webp         # WebP 格式（回退）
```

### 压缩流程

1. **压缩命令**：`npm run compress:images -- public/assets/<gameId>`
2. **压缩脚本**：`scripts/assets/compress_images.js`（启动器）+ `scripts/assets/compress_images.py`（实现）
3. **输出位置**：同级 `compressed/` 子目录，生成 `.avif` 和 `.webp`

### 前端引用方式

| 场景 | 组件/函数 | 示例 |
|------|-----------|------|
| `<img>` 标签 | `OptimizedImage` | `<OptimizedImage src="dicethrone/images/foo.png" />` |
| CSS 背景 | `buildOptimizedImageSet` | `background: ${buildOptimizedImageSet('dicethrone/images/foo.png')}` |
| 精灵图裁切 | `getOptimizedImageUrls` | `const { avif, webp } = getOptimizedImageUrls('dicethrone/images/foo.png')` |

**路径规则（强制）**：
- `src` 传相对路径（如 `dicethrone/images/foo.png`），**不带** `/assets/` 前缀
- 内部自动补全 `/assets/` 并转换为 `compressed/foo.avif` / `compressed/foo.webp`
- **禁止在路径中硬编码 `compressed/` 子目录**（如 `'dicethrone/images/compressed/foo.png'`）
- **原因**：`getOptimizedImageUrls()` 会自动插入 `compressed/`，硬编码会导致路径重复（`compressed/compressed/`）

### 图片路径使用规范（强制）

#### ✅ 正确示例
```typescript
// manifest 配置
thumbnailPath: 'dicethrone/thumbnails/fengm'

// ASSETS 常量
CARD_BG: 'dicethrone/images/Common/card-background'
AVATAR: 'dicethrone/images/Common/character-portraits'

// 组件使用
<OptimizedImage src="dicethrone/images/Common/background" />
<OptimizedImage 
    src={getLocalizedAssetPath('dicethrone/images/monk/player-board', locale)}
/>
```

#### ❌ 错误示例
```typescript
// ❌ 硬编码 compressed/
thumbnailPath: 'dicethrone/thumbnails/compressed/fengm'
CARD_BG: 'dicethrone/images/Common/compressed/card-background'
<OptimizedImage src="dicethrone/images/Common/compressed/background" />

// ❌ 直接使用原始图片
<img src="/assets/dicethrone/images/foo.png" />

// ❌ 手动拼接 avif/webp
<img src="/assets/dicethrone/images/compressed/foo.avif" />
```

### 音频路径使用规范（强制）

**现行规范（已启用）**：音效/音乐仅允许使用 `public/assets/common/audio/registry.json` 中的**唯一 key**。

- **禁止**在游戏层定义音频资源（`src/games/<gameId>/audio.config.ts` 不得再声明 `basePath/sounds`）。
- **禁止**使用旧短 key（如 `click` / `dice_roll` / `card_draw`）。
- **必须**使用 registry 的完整 key（如 `ui.general....uiclick_dialog_choice_01_krst_none`）。
- **路径规则**：`getOptimizedAudioUrl()` 自动插入 `compressed/`，配置中**不得**手写 `compressed/`。

#### ✅ 音效触发规范（统一标准）
- **游戏态事件音**：一律通过事件流触发（`eventSoundResolver` 或事件元数据）。
- **UI 点击音**：仅用于纯 UI 行为（打开面板/切换 Tab），通过 `GameButton` 播放。
- **单一来源原则**：同一动作只能由“事件音”或“按钮音”二选一，禁止重复。
- **事件元数据**：事件可携带 `audioKey` / `audioCategory`，音频系统必须优先使用。
- **阶段推进**：统一使用 `SYS_PHASE_CHANGED` 事件音效；推进按钮需关闭点击音。

#### ✅ 音频文件使用规范（与图片规范一致）
- **压缩脚本**：`npm run compress:audio -- public/assets/common/audio`
- **生成 registry**：`node scripts/audio/generate_common_audio_registry.js`
- **资源清单**：`node scripts/audio/generate_audio_assets_md.js`
- **详见文档**：`docs/audio/audio-usage.md`

#### ✅ 当前正确示例（音频）
```typescript
// 事件解析直接返回 registry key
eventSoundResolver: (event) => {
  if (event.type === 'CELL_OCCUPIED') {
    return 'system.general.casual_mobile_sound_fx_pack_vol.interactions.puzzles.heavy_object_move';
  }
  return undefined;
}

// 事件级元数据（优先级最高）
event.audioKey = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';
event.audioCategory = { group: 'ui', sub: 'click' };
```

**相关提案**：`openspec/changes/refactor-audio-common-layer/specs/audio-path-auto-compression.md`

### 新增游戏资源检查清单

1. ✅ 原始图片放入 `public/assets/<gameId>/` 对应目录
2. ✅ 运行 `npm run compress:images -- public/assets/<gameId>`
3. ✅ 确认 `compressed/` 子目录生成 `.avif/.webp` 文件
4. ✅ 代码中使用 `OptimizedImage` 或 `getOptimizedImageUrls`
5. ✅ **确认路径中不含 `compressed/` 子目录**
6. ❌ **禁止**直接写 `<img src="/assets/xxx.png" />`
7. ❌ **禁止**硬编码 `compressed/` 路径

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

### 0. 大规模 UI 改动前置流程（强制）
> **当任务涉及大规模 UI 改动**（新增页面/重做布局/全局风格调整/新游戏 UI 搭建）时，必须按以下顺序执行：
>
> 1. **先读 Skill**：执行 `.windsurf/skills/ui-ux-pro-max/SKILL.md` 中的 `--design-system` 流程，获取通用设计建议（配色/字体/风格/反模式）。
> 2. **再读项目自定义设计系统**：
>    - `design-system/game-ui/MASTER.md` — 游戏 UI 交互通用原则
>    - `design-system/styles/<风格>.md` — 对应视觉风格规范
>    - `design-system/games/<gameId>.md` — 游戏专属覆盖配置（若存在）
> 3. **冲突时以项目自定义设计系统为准**：Skill 提供的是通用建议，项目 `design-system/` 是权威来源；两者冲突时，以后者为准。
>
> **判定"大规模 UI 改动"**：涉及 ≥3 个组件文件的样式变更、新增整页/整区域布局、全局配色/字体/间距调整、新游戏 Board 搭建。
> **小改动**（单按钮样式/单组件微调）无需走此流程，但仍需遵守 `design-system/` 中的约束。

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
- **数据/逻辑/UI 分离（强制）**：UI 只负责展示与交互，业务逻辑放在引擎/系统/领域层，数据定义与配置（manifest、常量表、资源清单、文案 key）用纯数据文件维护。

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

> **⚠️ 游戏内 UI 必须遵循设计系统规范**
> 
> - **交互原则**：`design-system/game-ui/MASTER.md`（所有游戏通用）
> - **视觉风格**：`design-system/styles/` 下选择合适风格
>   - `arcade-3d.md` - 街机立体风（休闲、派对、骰子类）
>   - `tactical-clean.md` - 战术简洁风（策略、卡牌对战）
>   - `classic-parchment.md` - 经典羊皮纸风（复古、桌游模拟）
> 
> **核心要求**：游戏感 = 即时反馈 + 状态清晰 + 操作愉悦
> - 所有可交互元素必须有 hover/press 反馈
> - 禁用状态必须视觉明显
> - 动画只用 transform/opacity，时长 150-300ms

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


