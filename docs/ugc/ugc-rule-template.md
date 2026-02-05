# UGC 规则模板（DomainCore）

> 用于外部 AI 生成规则代码的标准模板。**只允许粘贴导入，不提供手动编辑器。**

## 使用说明
1. 在 Builder 里生成提示词。
2. 让外部 AI 按本模板输出 `domain` 对象。
3. 将结果完整粘贴到规则代码框。

## 关键约束
- **禁止 Math.random**：只能用注入的 `random`。
- **必须可序列化**：`setup/execute/reduce` 返回值必须可 JSON 序列化。
- **不得访问宿主资源**：禁止使用 `window/fetch/localStorage/process/fs` 等。
- **不得包含游戏特化系统**：框架不内置任何规则或牌型逻辑。

## 规则模板（只输出 domain 对象）
```ts
const domain = {
  gameId: 'your-game-id',

  setup(playerIds, random) {
    // 返回初始 UGCGameState（必须可序列化）
    return {
      phase: 'init',
      turnNumber: 1,
      activePlayerId: playerIds[0] || 'player-1',
      players: Object.fromEntries(playerIds.map(id => [id, {
        resources: {},
        handCount: 0,
        deckCount: 0,
        discardCount: 0,
        statusEffects: {},
      }])),
      publicZones: {
        // 可选：放入公共可见数据
      },
    };
  },

  validate(state, command) {
    // 返回命令合法性
    return { valid: true };
  },

  execute(state, command, random) {
    // 返回事件数组（必须可序列化）
    return [
      { type: 'NO_OP', payload: { commandType: command.type } },
    ];
  },

  reduce(state, event) {
    // 归约为新状态（必须可序列化）
    return state;
  },

  playerView(state, playerId) {
    // 可选：为不同玩家裁剪视图
    return {};
  },

  isGameOver(state) {
    // 可选：返回胜负
    return undefined;
  },
};
```

## Command / Event 约定
```ts
// 来自动作钩子或 UI 的命令
interface RuntimeCommand {
  type: string;
  playerId: string;
  payload: Record<string, unknown>;
  timestamp?: number;
}

// 规则执行的事件
interface RuntimeGameEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp?: number;
  sourceCommandType?: string;
  sfxKey?: string;
}
```
