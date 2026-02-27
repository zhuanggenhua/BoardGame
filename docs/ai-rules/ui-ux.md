# UI/UX 完整规范

> 本文档是 `AGENTS.md` 的补充，包含 UI/UX 设计范式、布局策略、游戏 UI 特化规范。
> **触发条件**：开发/修改 UI 组件、布局、样式、游戏界面时阅读。

---

## 0. UI 改动分级流程（强制）

> ### 0.1 修 bug / 微调（无需额外流程）
> 修复布局错位、调整间距/字号/颜色微调、修复交互 bug 等。直接改即可。
>
> ### 0.2 新增 UI 元素（必须配合现有风格，无需读设计系统文档）
> 新增按钮、面板、提示、弹窗等 UI 元素，即使只改一个文件：
> - **必须复用同模块已有组件**（如 `GameButton`、`SpotlightContainer`），禁止手写原生 `<button>` / `<div>` 替代已有封装
> - **必须参考同文件/同模块的现有样式**（配色、圆角、间距、字号），保持视觉一致
> - **禁止引入与当前风格不一致的颜色/样式**（如现有模块用 amber 主色调，不得引入紫色）
>
> ### 0.3 大规模 UI 改动（必须先读设计系统）
> **判定条件**：涉及 ≥3 个组件文件的样式变更、新增整页/整区域布局、全局配色/字体/间距调整、新游戏 Board 搭建。
> **UI 优化任务**（布局稳定性修复、字号/间距层级调整、视觉层级重构等）也须走此流程。
>
> 必须按以下顺序执行：
> 1. **先读 Skill**：执行 `.windsurf/skills/ui-ux-pro-max/SKILL.md` 中的 `--design-system` 流程，获取通用设计建议（配色/字体/风格/反模式）。
> 2. **再读项目自定义设计系统**：
>    - `design-system/game-ui/MASTER.md` — 游戏 UI 交互通用原则
>    - `design-system/styles/<风格>.md` — 对应视觉风格规范
>    - `design-system/games/<gameId>.md` — 游戏专属覆盖配置（若存在）
> 3. **冲突时以项目自定义设计系统为准**：Skill 提供的是通用建议，项目 `design-system/` 是权威来源；两者冲突时，以后者为准。

---

## 1. 核心审美准则 (Visual Excellence)

- **深度感 (Depth)**：通过渐变、阴影、毛玻璃构建视觉层级，但需按场景分级使用：
  - **重点区域**（游戏结算、核心面板）：可使用毛玻璃 + 软阴影增强层级感
  - **一般区域**（确认弹窗、列表项）：使用纯色/简单渐变 + 轻阴影即可
  - **高频更新区域**（动画中元素、拖拽对象）：**禁止毛玻璃**，仅用 `opacity`/`transform`
- **动效反馈 (Motion)**：状态变更应有动效反馈，但需区分场景：
  - **关键交互**（确认/提交/阶段转换）：使用物理动效（弹簧/惯性）
  - **常规交互**（Hover/Focus）：使用简单 `transition`（150-200ms）
  - **高频交互**（快速点击/连续操作）：仅用颜色/透明度变化，禁止复杂动画
- **布局稳定性 (Layout)**：动态内容通过 `absolute` 或预留空间实现。**辅助按钮严禁占据核心业务流空间，必须以悬浮 (Overlay) 方式贴边/贴底显示。**
- **临时/瞬态 UI 不得挤压已有布局（强制）**：攻击修正徽章、buff 提示、倒计时标签等"出现/消失"的临时 UI 元素，必须使用 `absolute`/`fixed` 定位，禁止插入 flex/grid 正常流导致其他元素位移。若需占位，必须在初始布局中预留固定空间（如 `invisible` 占位符）。
- **Flex 容器可滚动子元素必须加 `min-h-0`（强制）**：在 `flex-col` 容器中，使用 `flex-1 overflow-y-auto` 的子元素**必须同时加 `min-h-0`**。原因：flex 子元素默认 `min-height: auto`（内容撑开），导致 `overflow-y-auto` 不生效，内容被父级 `overflow-hidden` 裁剪而非滚动。同理，`flex-row` 容器中横向滚动的子元素需加 `min-w-0`。
  - ✅ `<div className="flex-1 min-h-0 overflow-y-auto">` — 正确，可滚动
  - ❌ `<div className="flex-1 overflow-y-auto">` — 错误，内容溢出时被裁剪而非滚动
- **数据/逻辑/UI 分离（强制）**：UI 只负责展示与交互，业务逻辑放在引擎/系统/领域层，数据定义与配置（manifest、常量表、资源清单、文案 key）用纯数据文件维护。

### 1.1 游戏内 UI 组件单一来源（强制）

> **同一类 UI 功能在每个游戏中只允许有一个组件实现**，所有场景必须复用该组件，禁止新建功能重叠的组件。

- **卡牌展示/选择 UI**：每个游戏只允许一个卡牌展示组件，所有卡牌展示场景（弃牌堆查看、弃牌堆出牌、reveal、卡牌选择交互）必须通过该组件实现。
  - SmashUp：`PromptOverlay.tsx`（通过 `displayCards` prop 支持纯查看和选择两种模式）
  - 新增卡牌展示场景时，必须扩展现有组件的 props/模式，禁止新建 `CardStrip`/`CardList`/`CardReveal` 等重复组件。
- **卡牌放大/详情 UI**：统一使用 `CardMagnifyOverlay`，禁止新建放大弹窗。
- **判定标准**：新增 UI 组件前，必须先搜索同游戏 `ui/` 目录下是否已有功能相似的组件。如果已有，必须通过扩展 props 复用，不得新建。

### 1.2 通用 UI 交互 Hooks（强制复用）

> 位于 `src/hooks/ui/`，跨游戏复用。新增交互行为前必须先搜索此目录。

| Hook | 用途 | 说明 |
|------|------|------|
| `useHorizontalDragScroll` | 横向滚动容器增强 | 滚轮纵向→横向转换 + 鼠标拖拽左右滑动。所有横向卡牌列表/弃牌堆浏览必须使用，禁止手写 wheel 事件监听。返回 `{ ref, dragProps }`，`dragProps` 需展开到容器元素。 |
| `useDeferredRender` | 延迟渲染 | 避免首帧闪烁 |
| `useDelayedBackdropBlur` | 延迟毛玻璃 | 毛玻璃效果延迟启用，避免动画期间性能问题 |

### 1.3 UI 动画设计原则（强制）

> **核心原则：动画应由数据/状态变化驱动，而非由 UI 事件直接触发**。尤其是涉及命令验证的操作，必须等待验证成功后再启动动画。

#### 两种动画触发模式

**数据驱动动画（Data-Driven Animation）**：
- **定义**：通过 `useEffect` 监听状态字段变化，状态变化时启动动画
- **适用场景**：所有需要命令验证的操作（投掷骰子、打出卡牌、激活技能等）
- **优势**：动画只在操作真正成功后播放，验证失败时不会出现"动画已播放但操作未生效"的不一致

**事件驱动动画（Event-Driven Animation）**：
- **定义**：在 `onClick` 等事件处理器中直接设置动画状态
- **适用场景**：纯 UI 交互，不涉及命令验证（如展开/折叠面板、切换标签页、hover 效果）
- **风险**：若用于需要验证的操作，验证失败时动画已播放，造成视觉欺骗

#### 正确模式（数据驱动）

```typescript
// ✅ 正确：监听 rollCount 变化启动动画
const [isRolling, setIsRolling] = React.useState(false);
const prevRollCountRef = React.useRef(rollCount);

React.useEffect(() => {
    if (rollCount !== prevRollCountRef.current) {
        const prevCount = prevRollCountRef.current;
        prevRollCountRef.current = rollCount;
        
        // rollCount 增加 → 投掷成功，开始动画
        if (rollCount > prevCount) {
            setIsRolling(true);
            // 安全超时：防止服务器长时间无响应
            const timer = setTimeout(() => setIsRolling(false), 5000);
            return () => clearTimeout(timer);
        }
    }
}, [rollCount, isRolling]);

const handleRollClick = () => {
    if (!canInteract) return;
    // 不在这里设置 isRolling，而是在 rollCount 变化时设置
    // 这样可以避免命令验证失败时动画已经开始播放
    dispatch(COMMANDS.ROLL_DICE, {});
};
```

#### 反模式（事件驱动）

```typescript
// ❌ 错误：onClick 中直接设置动画状态
const handleRollClick = () => {
    if (!canInteract) return;
    setIsRolling(true);  // ← 动画立即开始
    dispatch(COMMANDS.ROLL_DICE, {});  // ← 命令可能验证失败
    // 问题：验证失败时动画已播放，但骰子值未变化
};
```

#### 与乐观更新引擎的关系

项目使用乐观更新引擎（`OptimisticEngine`），客户端会立即预测状态变化。但预测可能失败（如命令验证失败、随机数不一致），此时会回滚到服务端确认的状态。

- **乐观更新成功**：`rollCount` 立即增加 → `useEffect` 检测到变化 → 启动动画
- **乐观更新失败**：`rollCount` 不变或回滚 → `useEffect` 不触发动画 → 视觉与状态一致
- **关键**：动画依赖最终状态（`rollCount`），而非用户操作（`onClick`），确保动画只在操作真正生效时播放

#### 阶段转换清理（强制）

当游戏阶段转换时（如从进攻阶段进入防御阶段），必须立即清理上一阶段的动画状态，防止动画残留。

```typescript
// ✅ 正确：阶段转换时清理动画状态
React.useEffect(() => {
    if (currentPhase === 'defensiveRoll' || currentPhase === 'offensiveRoll') {
        // 进入新阶段时立即清除投掷动画状态
        if (isRolling) {
            setIsRolling(false);
        }
    }
}, [currentPhase, isRolling, setIsRolling]);
```

#### 最短播放时间保护（可选）

乐观更新会瞬间产生新状态，但动画需要一定时间才能完整播放。可以记录动画开始时刻，在状态变化时检查是否已过最短时间，未过则延迟停止。

```typescript
const MIN_ROLL_ANIMATION_MS = 800;
const rollStartTimeRef = React.useRef<number>(0);

React.useEffect(() => {
    if (rollCount > prevCount) {
        setIsRolling(true);
        rollStartTimeRef.current = Date.now();
    } else if (isRolling) {
        const elapsed = Date.now() - rollStartTimeRef.current;
        const remaining = MIN_ROLL_ANIMATION_MS - elapsed;
        if (remaining <= 0) {
            setIsRolling(false);
        } else {
            const timer = setTimeout(() => setIsRolling(false), remaining);
            return () => clearTimeout(timer);
        }
    }
}, [rollCount, isRolling]);
```

#### 新增 UI 交互检查清单

开发新的 UI 交互时，必须回答以下问题：

1. **这个操作需要命令验证吗？**
   - 是 → 使用数据驱动动画（监听状态变化）
   - 否 → 可以使用事件驱动动画（onClick 直接设置）

2. **动画状态的唯一真实来源是什么？**
   - 必须是引擎层状态字段（如 `rollCount`、`G.core.xxx`）
   - 禁止依赖 UI 层临时状态（如 `isButtonClicked`）

3. **阶段转换时需要清理动画状态吗？**
   - 是 → 在 `useEffect` 中监听 `currentPhase` 并清理
   - 否 → 确认动画不会跨阶段残留

4. **动画是否需要最短播放时间保护？**
   - 是 → 记录开始时刻，延迟停止
   - 否 → 状态变化时立即停止

#### 参考实现

- **DiceThrone 骰子投掷动画**：`src/games/dicethrone/ui/DiceTray.tsx`（`DiceActions` 组件）
- **阶段转换清理**：`src/games/dicethrone/Board.tsx`（`useEffect` 监听 `currentPhase`）

---

## 2. 多端布局策略 (Multi-Device Layout Strategy)

- **PC 核心驱动 (PC-First)**：以 PC 端 (16:9) 为核心设计基准，追求极致的大屏沉浸感与专业级交互操作。
- **场景自适应 (Scene-Centric)**：针对游戏内核进行自适应优化。移动端定位为"尽力兼容 (Best-effort Compatibility)"，优先保证核心功能可用。
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

---

## 3. 游戏 UI 特化范式 (Game-Centric Design)

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
    - **层级统一**：使用 `UI_Z_INDEX` 常量（如提示用 `UI_Z_INDEX.hint/overlayRaised`，模态用 `UI_Z_INDEX.modalOverlay/modalContent`），禁止硬编码 `z-[...]`。
    - 常用位置：顶部中央（交互选择）、正中央（等待）、手牌上方（弃牌）；默认 `pointer-events-none`（除非需要交互）。
- **动态效果视觉提示实施规范（强制）**：
    > 当全链路审查（见 `engine-systems.md`「描述→实现全链路审查规范」）发现动态赋予效果缺少 UI 提示时，按以下规范实施。
    - **力量修正**：修正后的力量值必须与基础值有视觉区分。正向修正用绿色/上箭头，负向修正用红色/下箭头，显示格式为 `基础值 → 当前值` 或 `当前值(±N)`。
    - **持续保护/限制**：在受影响实体上显示小图标（盾牌=不可消灭、锁=不可移动、禁止=不可打出），hover 显示效果来源。
    - **基地持续效果**：基地卡下方显示当前生效的效果摘要文字（从 i18n 获取），多个效果竖向堆叠。
    - **临时 buff/debuff**：使用 `absolute` 定位的徽章/标签，附带淡入淡出动画（150-200ms），效果结束时自动消失。禁止插入正常流。
    - **条件触发效果**：条件满足时在实体上显示发光边框或脉冲动画，条件不满足时无视觉标记。
    - **附着行动卡**：随从/基地上附着的 ongoing 行动卡必须有视觉标记（如卡牌角标或堆叠指示器），hover/点击可查看附着卡详情。
    - **不确定时必须询问用户**：如果效果的 UI 展示方式不明确（图标样式、放置位置、颜色选择、文字 vs 图标），**必须先询问用户确认再实现**，禁止自行猜测。
- **视角解耦 (Scene vs. HUD)**：
    - **场景层 (Scene)**：棋盘、卡片等核心实体，需通过 `anchorPoint` 处理坐标缩放，确保跨平台逻辑一致性。
    - **UI 层 (HUD)**：状态信息、控制面板，执行 Overlay 挂载逻辑。
- **高度稳定性**：核心游戏区（棋盘/面板）**必须**使用明确高度约束（如 `h-[35vw]`）代替 `h-full`，彻底解耦父级 Flex 依赖。
- **相位敏感性**：UI 必须清晰反馈当前"游戏相位"与"操作权限"，通过高亮合规动作 (Valid Actions) 降低认知负荷。
