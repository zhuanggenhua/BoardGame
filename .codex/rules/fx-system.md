# FX 特效系统架构

## 整体架构
```
FxRegistry（注册表）→ FxBus（事件调度）→ FxLayer（渲染层）
```
- **FxRegistry**：cue 字符串 → 渲染器组件映射，支持通配符 `fx.combat.*`
- **FxBus**（`useFxBus` hook）：接收事件，管理并发上限、防抖、安全超时
- **FxLayer**：读取活跃事件列表，渲染对应渲染器

## 文件结构
```
src/engine/fx/              ← 引擎层（游戏无关）
├── types.ts                  FxCue, FxEvent, FxRenderer 等类型
├── FxRegistry.ts             cue → renderer 注册表
├── useFxBus.ts               事件调度 Hook
├── FxLayer.tsx               渲染层组件
├── index.ts                  barrel export
└── shader/                 ← WebGL Shader 管线
    ├── types.ts               UniformValue, ShaderCanvasProps
    ├── ShaderMaterial.ts      编译/链接/uniform 上传
    ├── ShaderCanvas.tsx       通用 shader 渲染组件（RAF 循环 + 自动注入 uTime/uResolution/uProgress）
    ├── shaders/
    │   ├── common.vert.ts     fullscreen quad 顶点着色器
    │   └── vortex.frag.ts     旋涡片元着色器
    └── glsl/
        └── noise.glsl.ts      snoise, fbm, hash, starField 等 GLSL 工具函数

src/components/common/animations/  ← 底层动画组件（可独立使用）
├── VortexShaderEffect.tsx         WebGL 旋涡（包装 ShaderCanvas + 颜色预设）
├── SummonEffect.tsx               Canvas 2D 召唤光柱
├── BurstParticles.tsx             Canvas 2D 爆发粒子
├── ...其他动画组件

src/games/summonerwars/ui/fxSetup.ts  ← 游戏侧注册
├── SW_FX 常量（cue 字符串）
├── Renderer 适配器（FxEvent → 动画组件 props）
└── summonerWarsFxRegistry 单例
```

## 核心约定

### Cue 命名
点分层级：`fx.<domain>.<detail>`，如 `fx.summon`、`fx.combat.shockwave`

### Renderer 适配器模式
Renderer 不含业务逻辑，只做参数映射：
1. 从 `event.ctx` / `event.params` 提取参数
2. 通过 `getCellPosition()` 把格坐标转为百分比定位
3. 委托底层动画组件（SummonEffect、VortexShaderEffect 等）

### Shader 开发流程
1. GLSL 代码写在 `shader/glsl/*.glsl.ts` 或 `shader/shaders/*.frag.ts`（TS 字符串常量）
2. Fragment shader 通过字符串拼接组合（noise + main）
3. `ShaderCanvas` 自动提供 `uTime`、`uResolution`、`uProgress` 三个内置 uniform
4. 自定义 uniform 通过 `uniforms` prop 传入，类型自动映射（number→1f, [x,y]→2f, [r,g,b]→3f）

### 动画组件与 Renderer 的关系
- 动画组件（`animations/` 下）可独立使用（DevTools 预览、非棋盘场景）
- Renderer（`fxSetup.ts`）是适配器，仅在 FX 系统管线中使用
- 新增特效时：先写动画组件 → 再写 Renderer 适配器 → 注册到 Registry
