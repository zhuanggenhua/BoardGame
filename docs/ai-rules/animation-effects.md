# 动画/动效完整规范

> 本文档是 `AGENTS.md` 的补充，包含动效技术选型、Canvas 粒子引擎、特效组件的完整规范。
> **触发条件**：开发/修改任何动画、特效、粒子效果时阅读。
> **引擎层动画架构**（表现与逻辑分离、`useVisualStateBuffer`、`useVisualSequenceGate`）见 `docs/ai-rules/engine-systems.md`「动画表现与逻辑分离规范」节。

---

## 动画/动效通用规范

- **动画库已接入**：项目使用 **framer-motion**（`motion` / `AnimatePresence`）。
- **通用动效组件**：`src/components/common/animations/` 下已有 `FlyingEffect`、`ShakeContainer`、`PulseGlow` 与 `variants`。
- **冲击帧音效绑定（强制）**：有动画的事件（伤害/治疗/状态/Token）音效必须通过 `FlyingEffectData.onImpact`（或 FX 渲染器 `onImpact`）在动画到达时播放，禁止在事件生成时立即播放。此类事件的 `feedbackResolver` **必须返回 `null`**；音效 key 由动画层在 `onImpact` 回调中直接 `playSound(resolvedKey)`，或由 FX 系统通过 `FeedbackPack.sound`（`source: 'params'`）从 `event.params.soundKey` 读取并播放。
- **优先复用原则**：新增动画优先复用/扩展上述组件或 framer-motion 变体，避免重复造轮子或引入平行动画库。
- **性能友好（强制）**：
  - **禁止 `transition-all` / `transition-colors`**：会导致 `border-color` 等不可合成属性触发主线程渲染。改用具体属性：`transition-[background-color]`、`transition-[opacity,transform]`。
  - **优先合成属性**：`transform`、`opacity`、`filter`；**谨慎使用**：`background-color`、`box-shadow`、`border-*`。
  - **transition 与 @keyframes 互斥**：同一元素禁止同时使用，应通过 `style.transition` 动态切换。
- **毛玻璃策略**：`backdrop-filter` 尽量保持静态；需要动效时只动遮罩层 `opacity`，避免在动画过程中改变 blur 半径。
- **通用动效 hooks**：延迟渲染/延迟 blur 优先复用 `useDeferredRender` / `useDelayedBackdropBlur`，避免各处重复实现。受击反馈优先使用 `useImpactFeedback`（组合 hook，一次调用编排震动+钝帧+裂隙闪光三件套），避免手动管理多个原子 hook。
- **颜色/阴影替代**：若需高亮变化，优先采用"叠层 + opacity"而非直接动画颜色/阴影。
- **Hover 颜色复用**：按钮 hover 颜色变化优先使用通用 `HoverOverlayLabel`（叠层 + opacity）模式，减少重复实现。

---

## 动效技术选型规范（强制）

> **核心原则**：根据动效本质选择正确的技术，而非统一用一种方案硬做所有效果。

| 动效类型 | 正确技术 | 判断标准 | 典型场景 |
|----------|----------|----------|----------|
| **粒子系统** | Canvas 2D（自研引擎） | 粒子特效（几十到几百级别）；双层绘制（辉光+核心） | 胜利彩带、召唤光粒子、爆炸碎片、烟尘扩散 |
| **复杂矢量动画** | Canvas 2D **推荐** | 每帧重绘复杂路径（弧形/渐变/多层叠加） | 斜切刀光、气浪冲击波、复杂轨迹特效 |
| **多阶段组合特效** | Canvas 2D **推荐** | 需要蓄力→爆发→持续→消散等多阶段节奏；需要 additive 混合/动态渐变/脉冲呼吸 | 召唤光柱、技能释放、大招特写 |
| **流体/逐像素特效** | WebGL Shader（`ShaderCanvas`） | 需要连续旋臂/密度渐变/噪声纹理等逐像素计算的流体效果；Canvas 2D 无法实现 | 旋涡、火焰、能量护盾、溶解 |
| **形状动画** | framer-motion | 确定性形状变换（缩放/位移/旋转/裁切/透明度）；每次触发 1-3 个 DOM 节点 | 红闪脉冲、伤害数字飞出、简单冲击波 |
| **UI 状态过渡** | framer-motion / CSS transition | 组件进出场、hover/press 反馈、布局动画 | 手牌展开、横幅切换、按钮反馈、阶段指示脉冲 |
| **精确设计动效** | Lottie（未接入，需美术资源） | 设计师在 AE 中制作的复杂动画，需要逐帧精确控制 | 暂无，未来可用于技能释放特写 |

**PixiJS 已评估不适用（2026-02-08）**：已移除，当前特效规模下 Canvas 2D 全面优于 PixiJS。详见 `docs/refactor/pixi-performance-findings.md`。

**判断边界（快速自检）**：
1. 需要每帧重绘复杂矢量路径（弧形/渐变）？→ 用 Canvas 2D 手写（如 SlashEffect）
2. 需要粒子特效（爆炸/烟尘/彩带/光粒子）？→ 用 Canvas 粒子引擎（BurstParticles）
3. 需要多阶段组合特效（蓄力/爆发/持续/消散）？→ 用 Canvas 2D（如 SummonEffect）
4. 需要连续流体效果（旋涡/火焰/护盾/溶解）？→ 用 WebGL Shader（`ShaderCanvas`）
5. 需要简单形状变换（1-3 个元素）？→ 用 framer-motion
6. 需要 UI 组件进出场/状态切换？→ 用 framer-motion 或 CSS transition

---

## Canvas 粒子引擎使用规范

- **引擎位置**：`src/components/common/animations/canvasParticleEngine.ts`
- **双层绘制**：每个粒子有辉光层（半透明大圆）+ 核心层（高亮小圆），视觉质感和 FlyingEffect 一致
- **预设驱动**：通过 `ParticlePreset` 配置粒子行为，`BURST_PRESETS` 提供常用预设
- **生命周期**：粒子效果必须有明确的 `life` 配置，所有粒子消散后自动停止渲染循环
- **现有组件**：`BurstParticles`（爆炸/召唤/烟尘）、`VictoryParticles`（胜利彩带）

### 俯视角物理规范（强制）

本项目游戏为**俯视角棋盘游戏**（召唤师战争/Smash Up 等），**棋盘层**特效必须遵循俯视角物理：
  - **禁止重力下坠**：`gravity: 0`（或极小值模拟空气阻力），粒子不应往下掉
  - **平面扩散**：`direction: 'none'`（径向）或指定方向，粒子在平面上扩散
  - **减速停止**：`drag` 较大（0.92-0.96），模拟摩擦力快速停下
  - **淡出+缩小**：`opacityDecay: true, sizeDecay: true`，粒子逐渐消散
  - **例外**：火花（sparks）可保留轻微重力（0.5）模拟金属碰撞的物理感
  - **适用范围**：棋盘格子内的特效（召唤/攻击/摧毁/碎裂/爆发粒子等）。错误示例：`gravity: 1.5` + `direction: 'top'` 是横版物理，不适用于俯视角。

### UI 层特效物理规范

全屏 UI 层的庆祝/装饰特效（如胜利彩带 `VictoryParticles`）**不受俯视角约束**，应使用符合直觉的物理模型（重力下落、向上喷射等），因为它们叠加在屏幕上而非棋盘内。
- **判断标准**：特效挂载在棋盘格子/卡牌上 → 俯视角；特效挂载在全屏 overlay/结算页 → UI 层物理

### Canvas 溢出规范（强制）

特效 Canvas 天然超出挂载目标边界，**禁止用 `overflow: hidden` 裁切**。优先使用无溢出方案（Canvas 铺满父级，绘制基于 canvas 尺寸）；小元素挂载场景使用溢出放大方案（Canvas 比容器大 N 倍，居中偏移，容器设 `overflow: visible` + `pointer-events-none`）。详见 `docs/particle-engine.md` § Canvas 溢出规范。

### Canvas transform 尺寸陷阱（强制）

棋盘层 Canvas 特效获取容器尺寸时，**禁止使用 `getBoundingClientRect()`**（会返回经过父级 `transform: scale()` 缩放后的屏幕像素尺寸），**必须使用 `offsetWidth/offsetHeight`**（CSS 布局尺寸，不受 transform 影响）。已修复的组件：ConeBlast、SummonEffect、ShatterEffect、BurstParticles、SlashEffect、RiftSlash。例外：全屏 UI 层特效（如 VictoryParticles）和使用视口坐标的特效（如 FlyingEffect）不受此约束。

### 棋盘特效容器与卡牌对齐规范（强制）

棋盘格子内的特效容器应使用与卡牌相同的尺寸约束（`w-[85%]` + `aspectRatio: 1044/729`）。召唤等需要大范围溢出的特效（如光柱）使用放大容器（5 倍格子大小），不走卡牌约束。`DestroyEffect` 内部也使用 `CARD_ASPECT_RATIO` + `CARD_WIDTH_RATIO` 常量保持一致。

---

## 引擎级 FX 系统（强制）

棋盘特效调度已迁移至引擎级 FX 系统（`src/engine/fx/`），提供 cue-based 的注册、调度与渲染框架。

### 核心概念
- **FxCue**：点分层级标识符（如 `fx.summon`、`fx.combat.shockwave`），支持通配符（`fx.combat.*`）
- **FxRegistry**：Cue → FxRenderer 映射，精确匹配优先于通配符
- **FxBus**（`useFxBus` hook）：push 事件触发特效，内置并发上限、防抖、安全超时
- **FxLayer**：通用渲染层组件，查注册表获取 renderer 并渲染，自动注入 `onImpact` 回调
- **FxRenderer**：适配器组件，将 FxEvent 参数映射为底层动画组件 props
- **FeedbackPack**：反馈包，将音效（`FxSoundConfig`）和震动（`FxShakeConfig`）与视觉特效统一声明

### 反馈包系统（FeedbackPack）（强制）

参考 UE Gameplay Cue 设计，一个 cue 注册时可同时声明视觉 + 音效 + 震动反馈，运行时自动触发：

```ts
// fxSetup.ts — 注册时声明反馈包
registry.register('fx.summon', SummonRenderer, { timeoutMs: 4000 }, {
  shake: { intensity: 'normal', type: 'impact', timing: 'on-impact' },
});
```

- `timing: 'immediate'`：事件推入 FxBus 时立即触发
- `timing: 'on-impact'`：渲染器调用 `props.onImpact()` 时触发（爆发/命中关键帧）
- 震动强度支持动态覆盖：`event.ctx.intensity` 优先于注册时的默认值
- `useFxBus` 接受 `{ playSound, triggerShake }` 选项，由游戏层注入实际播放/震动函数
- **禁止在 useGameEvents 中手动传 `params.onImpact` 回调**，震动由 FeedbackPack 声明式管理
- **例外：条件反馈保持手动编排**：当反馈触发依赖运行时状态（如战斗震动仅在 hits≥3 时触发），不应使用 FeedbackPack，而是由调用侧（Board.tsx）手动调用 `triggerShake`。原因：FeedbackPack 设计初衷是“一个 cue 总是触发相同反馈”（参考 UE Gameplay Cue），条件判断属于游戏规则而非反馈关注点。

### FeedbackPack 适用边界（强制）

- **适用**：一个 cue 触发时总是产生相同反馈（如召唤光柱总是震动）。强度可通过 `ctx.intensity` 动态调整，但“是否触发”不应有条件。
- **不适用**：反馈是否触发取决于运行时状态（如 hits 数量、玩家阶段、特定条件）。这类反馈应由调用侧手动编排，与同一时序链中的其他反馈（音效等）统一管理。
- **未来扩展**：若条件反馈场景增多（≥3 个不同条件触发），可考虑 UE 拆分 Cue 模式（注册不同 cue 如 `fx.combat.shockwave.light` / `fx.combat.shockwave.heavy`，每个带不同 FeedbackPack），而非在 FeedbackPack 内嵌条件函数。

### 序列特效（`pushSequence`）（强制）

多步骤技能效果（如"移除 token → 造成伤害"、"施加状态 → 治疗"）必须使用 `fxBus.pushSequence()` 编排，禁止并行 push 多个效果让玩家看到同时发生。

```ts
// 示例：移除 token 动画 → 等 200ms → 伤害飞行数字
fxBus.pushSequence([
  { cue: DT_FX.TOKEN, ctx: {}, params: { /* token 移除 */ }, delayAfter: 200 },
  { cue: DT_FX.DAMAGE, ctx: {}, params: { /* 伤害数字 */ } },
]);
```

- 每个步骤等上一个渲染器 `onComplete` 后再播放下一个
- `delayAfter`（ms）：该步骤完成后、下一步开始前的等待时间，默认 0
- 序列中某步 cue 未注册会自动跳过继续下一步
- 安全超时触发也会推进序列，避免卡死
- `cancelSequence(seqId)` 可取消正在进行的序列
- 渲染器完全不感知自己是否在序列中，无需适配
- 返回 `sequenceId`（string），可用于取消

### 新增特效流程
1. 在 `src/components/common/animations/` 实现底层动画组件（如已有则复用）
2. 在游戏侧 `fxSetup.ts` 中创建 FxRenderer 适配器，注册到 registry，声明 FeedbackPack
3. 在事件消费处（`useGameEvents.ts` 或 `Board.tsx`）调用 `fxBus.push(cue, ctx, params)`
4. 在 `EffectPreview.tsx` 添加预览

### 文件分布
- `src/engine/fx/` — 引擎层（types / FxRegistry / useFxBus / FxLayer）
- `src/engine/fx/shader/` — WebGL Shader 子系统（ShaderCanvas / ShaderMaterial / ShaderPrecompile / GLSL 库 / 预设 shader）
- `src/games/<gameId>/ui/fxSetup.ts` — 游戏侧注册表 + 渲染器适配器
- `src/components/common/animations/` — 底层动画组件（Canvas 2D + Shader 版本共存）

---

## WebGL Shader 特效系统

FX 系统支持 WebGL shader 管线，用于逐像素计算的流体特效。与 Canvas 2D 粒子系统共存，按需使用。

### 核心组件
- **`ShaderCanvas`**（`src/engine/fx/shader/ShaderCanvas.tsx`）：管理 WebGL context + fullscreen quad，接受 fragment shader + uniforms + duration，自动处理 DPI/RAF/生命周期。自动注入 `uTime`、`uResolution`、`uProgress` 三个内置 uniform。
- **`ShaderMaterial`**（`ShaderMaterial.ts`）：shader 编译、program 链接、类型安全的 uniform setter（带 location 缓存）。
- **GLSL 噪声库**（`glsl/noise.glsl.ts`）：Simplex 2D 噪声 + FBM，以 TS 字符串导出，在 shader 中拼接使用。

### Shader 预设
- `summon.frag.ts` — 召唤光柱（径向渐变 + 多阶段颜色映射 + 暗角遮罩）
- `vortex.frag.ts` — 流体旋涡（极坐标螺旋扭曲 + 双层 FBM + 三阶段动画 + 颜色映射）
- 后续可扩展：火焰、能量护盾、溶解等

### Shader 预编译（自注册，自动，强制）

Shader 包装组件（如 `SummonShaderEffect`、`VortexShaderEffect`）在模块顶层调用 `registerShader(FRAG)` 自注册到预编译队列。`useFxBus` 挂载时调用 `flushRegisteredShaders()` 一次性预编译所有已注册的 shader，通过后台 1×1 离屏 canvas 编译 + drawArrays 触发 GPU 驱动缓存。后续同源码 shader 编译几乎零开销。

- **自注册模式**：包装组件在模块顶层 `registerShader(FRAG_SOURCE)`，import 即注册，无需在 `fxSetup.ts` 中手动声明
- **Board.tsx / fxSetup.ts 无需关心 shader**：预编译由 `useFxBus` + 自注册自动完成，游戏侧零感知
- **去重**：`ShaderPrecompile` 内部维护 `precompiledSet`，同一源码只编译一次
- **非阻塞**：通过 `requestIdleCallback`（降级 `setTimeout`）异步执行

### 新增 Shader 特效流程
1. 在 `src/engine/fx/shader/glsl/` 中复用或新增 GLSL 工具函数
2. 在 `src/engine/fx/shader/shaders/` 中创建 `.frag.ts`，拼接 noise 库 + 主 shader 代码
3. 在 `src/components/common/animations/` 创建包装组件（如 `VortexShaderEffect`），内部使用 `ShaderCanvas`，**模块顶层调用 `registerShader(FRAG_SOURCE)` 自注册到预编译队列**
4. 在游戏侧 `fxSetup.ts` 注册到 FxRegistry（无需声明 shader 依赖，自注册已处理）
5. 颜色值从 0-255 归一化到 0-1 后传入 uniform（GLSL 标准）

### 降级策略
若浏览器不支持 WebGL，`ShaderCanvas` 自动触发 `onComplete`，效果静默跳过。调用方可搭配 Canvas 2D 版本做回退。

---

## 特效组件 useEffect 依赖稳定性（强制）

> 适用于所有特效组件：Canvas 粒子、framer-motion、DOM timer 驱动。

动画循环/timer 由 useEffect 启动，**其依赖数组中的每一项都必须引用稳定**，否则父组件重渲染会导致 useEffect 重跑 → 动画重启/中断。
- **回调 prop（`onComplete` 等）**：必须用 `useRef` 持有，禁止放入 useEffect 依赖。Canvas 组件和 DOM timer 组件（如 ImpactContainer/DamageFlash）同样适用。
- **数组/对象 prop（`color` 等）**：`useMemo` 的依赖不能直接用数组/对象引用（浅比较会失败），必须用 `JSON.stringify` 做值比较。
- **典型错误**：内联箭头函数/数组字面量作为 prop → 父组件重渲染 → useEffect 重跑 → 动画重启。

### 条件渲染特效的生命周期管理（强制）

当使用 `{isActive && <Effect />}` 条件渲染特效组件时：
- **必须有关闭机制**：通过 `onComplete` 回调将 `isActive` 设回 `false`，否则 isActive 永远为 true，连续触发时组件不会卸载重挂载，效果只播一次。
- **重触发模式**：`setIsActive(false)` → `requestAnimationFrame(() => setIsActive(true))`，确保 React 先卸载再重挂载。
- **禁止用固定 timer 关闭**：不要用 `setTimeout(() => setIsActive(false), 100)` 硬编码关闭时间，必须由效果组件自身通过 `onComplete` 通知完成。
- **典型错误**：缺少 onComplete → isActive 永远 true → 连续触发时组件不重挂载。

---

## 组合式特效架构（强制）

打击感特效必须按职责拆分为两层：
- **ImpactContainer（包裹层）**：作用于目标本身——震动（ShakeContainer）+ 钝帧（HitStopContainer）。ShakeContainer 在外层承载 className（背景/边框），HitStopContainer 在内层。
- **DamageFlash（覆盖层）**：纯视觉 overlay——斜切（RiftSlash）+ 红脉冲（RedPulse）+ 伤害数字（DamageNumber），作为 ImpactContainer 的子元素。
- **正确组合**：`<ImpactContainer><Target /><DamageFlash /></ImpactContainer>`
- **禁止**：把震动和视觉效果混在同一个组件里；把 DamageFlash 放在 ImpactContainer 外面（会导致震动目标不一致）。

### 受击反馈 Hooks（强制）

受击反馈的状态管理已抽象为通用 hooks，位于 `src/components/common/animations/`，和 `useShake` / `useHitStop` 同级：

| Hook | 层级 | 职责 | API |
|------|------|------|-----|
| `useDamageFlash` | 原子 | 管理 DamageFlash 的激活/自动重置 | `{ isActive, damage, trigger(damage) }` |
| `useImpactFeedback` | 组合 | 编排 useShake + useHitStop + useDamageFlash | `{ trigger(damage), shake, hitStop, flash }` |

- **新游戏接入受击反馈**：直接使用 `useImpactFeedback()`，一次调用获得全套状态，把 `shake`/`hitStop`/`flash` 分别传给 `ShakeContainer`/`HitStopContainer`/`DamageFlash`。
- **可选效果**：`useImpactFeedback({ shake: true, hitStop: true, flash: true })` 按需开关。
- **禁止手动管理多套 useState + setTimeout**：受击反馈状态必须通过 `useImpactFeedback` 或其原子 hooks 管理，禁止在 Board.tsx 中手写 `useState<{ active, damage }>` + `setTimeout` 重置逻辑。

```tsx
// 典型用法（Board.tsx）
const opponentImpact = useImpactFeedback();
const selfImpact = useImpactFeedback();

// 触发
onImpact: () => opponentImpact.trigger(damage);

// 渲染（OpponentHeader）
<ShakeContainer isShaking={opponentImpact.shake.isShaking}>
  <HitStopContainer isActive={opponentImpact.hitStop.isActive} {...opponentImpact.hitStop.config}>
    <Content />
    <DamageFlash active={opponentImpact.flash.isActive} damage={opponentImpact.flash.damage} />
  </HitStopContainer>
</ShakeContainer>
```

### 伤害反馈分级（强制）

不同伤害来源应有不同强度的受击反馈，禁止所有伤害走同一套完整反馈：

| 伤害来源 | 反馈强度 | 典型效果 | 示例 |
|---------|---------|---------|------|
| 战斗伤害（技能攻击/反击） | 完整 | 飞行数字 + 动态音效 + 震动 + 钝帧 + 裂隙闪光 | DiceThrone 技能攻击、SummonerWars 近战/远程 |
| 持续伤害（DoT：灼烧/中毒/流血） | 轻量 | 飞行数字 + 轻微音效，无震动无钝帧 | DiceThrone upkeep 灼烧/中毒 |
| 系统惩罚（不活动惩罚等） | 轻量 | 飞行数字或状态变化动画，无震动 | SummonerWars 不活动惩罚 |

- **实现方式**：在 FX 注册表中为不同强度的伤害注册不同的 cue（如 `fx.damage` vs `fx.dot-damage`），通过 FeedbackPack 控制是否包含 shake。
- **判断依据**：事件的 `sourceAbilityId` 或 `reason` 字段区分伤害来源。持续伤害的 sourceAbilityId 通常以 `upkeep-` 开头。
- **禁止**：所有 `DAMAGE_DEALT` / `UNIT_DAMAGED` 事件无差别触发完整受击反馈（震动+钝帧+裂隙闪光）。

---

## 特效视觉质量规则（强制）

- **禁止纯几何拼接**：特效禁止用 `stroke` 线段、V 形轮廓、横切线等几何图元拼凑，视觉效果生硬且缺乏能量感。
- **正确做法**：优先使用粒子系统（streak/circle 喷射 + 自然衰减）或柔和径向渐变模拟气流/光晕；需要轨迹时用粒子拖尾而非画线。
- **判断标准**：如果特效看起来像"线框图/几何示意图"而非"有能量感的自然效果"，说明方案有问题，必须换用粒子/渐变方案。

---

## 通用特效组件规范（强制）

- **通用 vs 游戏特有**：除非特效包含游戏特有语义（如特定卡牌名称文字、游戏专属资源），否则必须实现为通用组件放在 `src/components/common/animations/`，游戏层通过 props 注入差异。
- **现有通用特效清单**：新增特效前必须用 `grep` 搜索 `src/components/common/animations/` 确认是否已有可复用组件。完整清单与使用说明见 `docs/particle-engine.md`。
- **预览页同步**：新增通用特效组件后，必须在 `src/pages/devtools/EffectPreview.tsx` 的 `EFFECT_CATEGORIES` 中注册预览区块。
