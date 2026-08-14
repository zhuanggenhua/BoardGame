---
name: engine-gameover
description: 游戏结束标准：胜负判定、终局状态和传输收口——改 gameover 流程时查
metadata:
  type: doc
  status: 已交付
---

# 游戏结束检测规范

## 游戏结束检测（`sys.gameover`）（强制）

### 架构

管线（`executePipeline`）在每次命令执行成功后自动调用 `domain.isGameOver(core)` 检测游戏是否结束，结果写入 `sys.gameover`：

```typescript
// pipeline.ts 内部辅助函数（两个成功返回点都会调用）
const applyGameoverCheck = (s: MatchState<TCore>): MatchState<TCore> => {
    if (!domain.isGameOver) return s;
    const result = domain.isGameOver(s.core);
    if (result === s.sys.gameover) return s;
    return { ...s, sys: { ...s.sys, gameover: result } };
};
```

### GameOverResult 类型

```typescript
interface GameOverResult {
    winner?: PlayerId;
    winners?: PlayerId[];
    draw?: boolean;
    scores?: Record<PlayerId, number>;
}
```

### 各层读取方式（强制）

| 层级 | 正确读取方式 | 禁止 |
|------|-------------|------|
| Board 组件 | `G.sys.gameover` | ❌ `G.core.gameover`、❌ `ctx.gameover` |
| 服务端 | `result.state.sys.gameover` | ❌ 再次调用 `isGameOver()` |
| 测试 | `state.sys.gameover` | ❌ `state.core.gameover` |
| 交互裁决 | `state.sys.gameover` | ❌ `core.gameover` |

### 服务端处理

`GameTransportServer.executeCommandInternal` 在管线执行成功后读取 `result.state.sys.gameover`，若检测到游戏结束且 metadata 尚未标记，则：
1. 更新 `match.metadata.gameover`
2. 持久化 metadata
3. 触发 `onGameOver` 回调（用于归档战绩等）

### 游戏层实现

每个游戏在 `DomainCore.isGameOver` 中实现检测逻辑，返回 `GameOverResult | undefined`：

```typescript
// 示例：DiceThrone — HP 归零判定
isGameOver: (core) => {
    const loser = Object.values(core.players).find(p => p.hp <= 0);
    if (!loser) return undefined;
    const winner = Object.values(core.players).find(p => p.hp > 0);
    return { winner: winner?.id };
},
```

### 禁止事项

- ❌ 禁止在 Board 组件中读取 `G.core.gameover` 或 `ctx.gameover`（前者不存在于 core，后者已移除）
- ❌ 禁止在服务端重复调用 `isGameOver()` 检测——管线已自动完成
- ❌ 禁止在 core 状态中存储名为 `gameover` 的字段——游戏结束结果由管线自动写入 `sys.gameover`。core 中可以有 `gameResult` 等中间字段供 `isGameOver()` 读取，但 UI/服务端必须统一从 `sys.gameover` 获取最终结果。

---
