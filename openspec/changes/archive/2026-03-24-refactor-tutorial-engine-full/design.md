# 设计：教程引擎完整抽象（本地教程、事件驱动）

## 目标
- 教程状态成为单一权威来源（`G.sys.tutorial`）。
- 推进逻辑从 UI 迁移到系统层，**事件驱动**为主。
- 随机控制、动作拦截、AI 行动、UI 高亮全部纳入统一系统。
- 移除领域层/adapter 对 `window` 的依赖。

## 非目标
- 不支持在线教程同步（仅本地/教程路由）。
- 不引入回放能力。
- 不改变现有游戏规则逻辑。

## 架构概览
- 新增 `TutorialSystem`（EngineSystem 插件）。
- Tutorial manifest 扩展为 **事件驱动**：`advanceOnEvents` 取代 UI/命令耦合。
- UI 仅消费 `G.sys.tutorial.step` 渲染。
- 通过 `createTutorialRandom` 在 adapter 侧包装 `RandomFn`（从 `G.sys.tutorial` 读取随机策略）。

## 状态模型（SystemState 扩展）
```ts
interface TutorialState {
  active: boolean;
  manifestId: string | null;
  stepIndex: number;
  step: TutorialStepSnapshot | null;
  allowedCommands?: string[];
  blockedCommands?: string[];
  advanceOnEvents?: Array<{ type: string; match?: Record<string, unknown> }>;
  randomPolicy?: { mode: 'fixed' | 'sequence'; values: number[]; cursor?: number };
  aiActions?: Array<{ commandType: string; payload: unknown }>;
  allowManualSkip?: boolean;
}
```

## 事件驱动推进
- `beforeCommand`：拦截不在 allowedCommands 的命令，返回 `halt + error`。
- `afterEvents`：检查 `advanceOnEvents` 是否命中（事件类型 + payload 子集匹配），命中则推进 `stepIndex` 并刷新 `step`。
- 产生系统事件（如 `SYS_TUTORIAL_STEP_CHANGED`）供 UI 监听（可选）。

## 随机控制
- `RandomFn` 包装：`d/range/shuffle/random` 根据 `sys.tutorial.randomPolicy` 返回固定/序列值。
- 只在 `tutorial.active === true` 时生效。

## AI 行动
- 步骤可声明 `aiActions`（命令 + payload）。
- UI 读取 `sys.tutorial.aiActions` 并执行 move，完成后发送 `SYS_TUTORIAL_AI_CONSUMED` 清理。

## UI 适配
- `TutorialOverlay` 改为读取 `G.sys.tutorial.step`。
- `TutorialContext` 移除或降级为只读兼容层（推荐移除）。

## 迁移路径
1) 新增 TutorialSystem + manifest 扩展。
2) UI 改为读取 `G.sys.tutorial`。
3) 移除旧 TutorialContext。
4) 在 DiceThrone 教程 manifest 中配置事件驱动与固定骰子策略。

## 风险
- 事件未命中导致无法推进：需在 manifest 中保证事件必达。
- 随机策略覆盖范围必须明确（仅本地教程）。
