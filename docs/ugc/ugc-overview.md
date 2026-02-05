# UGC 总览

> 目标：提供“需求 → 提示词 → 外部 AI → 粘贴导入 → 预览/运行”的通用 UGC 规则执行框架，**不内置任何具体游戏规则**。

## 边界与约束
- **仅支持粘贴导入**：规则代码必须来自外部 AI 生成并粘贴导入，不提供手动编辑器。
- **无游戏特化**：框架不包含任何牌型、胜负条件、比较逻辑或游戏特定规则。
- **规则必须可序列化**：状态与事件必须可 JSON 序列化。
- **确定性随机**：禁止使用 `Math.random`，仅允许使用注入的 `random` 参数。

## 核心链路（预览/运行一致）
1. Builder 生成提示词 → 外部 AI 生成规则 → 粘贴导入。
2. 规则代码加载到 **DomainCore 执行器**（Runtime + Server Sandbox）。
3. Builder 预览通过 `UGCRuntimeHost` + `UGCRuntimeView` 复用同一执行链路。
4. 预览配置存于 `publicZones.builderPreviewConfig`，运行态和预览态一致。

## 关键协议
### DomainCore 契约
- `domain.gameId: string`
- `setup(playerIds, random): UGCGameState`
- `validate(state, command): { valid: boolean; error?: string }`
- `execute(state, command, random): RuntimeGameEvent[]`
- `reduce(state, event): UGCGameState`
- `playerView?(state, playerId): Partial<UGCGameState>`
- `isGameOver?(state): { winner?; winners?; draw?; scores? }`

### RuntimeCommand（动作 → 规则）
```ts
interface RuntimeCommand {
  type: string;
  playerId: string;
  payload: Record<string, unknown>;
  timestamp?: number;
}
```

### RuntimeGameEvent（规则 → 状态）
```ts
interface RuntimeGameEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp?: number;
  sourceCommandType?: string;
  sfxKey?: string;
}
```

## 动作钩子协议（区域组件）
- 区域组件可配置动作钩子（hand-zone / play-zone 等）。
- 动作钩子支持：
  - `dispatchCommand({ type?, payload? })` 直接派发命令；
  - 或 `return` 命令对象/数组，框架自动派发。
- **区域级开关**：`allowActionHooks=false` 时禁止触发。

## 渲染面策略
- 区域组件支持 `renderFaceMode`：`auto | front | back`。
- `auto` 跟随预览切换，`front/back` 强制渲染面。

## 确定性与安全限制
- 随机数仅通过 `random` 注入函数获取（`random.d / random.range / random.shuffle`）。
- `Math.random` 会抛出权限错误。
- 沙箱禁用：`eval` / `Function` / `process` / `fs` / `fetch` / `window` 等全局 API。

## 错误分类（最小日志）
- `timeout | runtime | syntax | contract | permission`（服务端还包含 `memory`）
- 统一日志格式：
```
[UGC_RULE_EXEC] stage=<load|setup|validate|execute|reduce|isGameOver> type=<errorType> message=<msg> costMs=<ms>
```
