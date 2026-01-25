# 自动化流程测试

基于 Domain Core 的无头测试框架，可脱离 UI 和 boardgame.io 直接运行游戏流程。

## 快速开始

```bash
# 运行井字棋测试
npx tsx src/games/tictactoe/__tests__/flow.test.ts
```

## 目录结构

```
src/
├── engine/
│   └── testing/
│       └── index.ts          # 通用测试运行器
└── games/
    └── tictactoe/
        └── __tests__/
            └── flow.test.ts  # 井字棋流程测试
```

测试文件放在游戏目录的 `__tests__` 文件夹下，便于：
- 游戏自包含
- UGC 作者可为自己的游戏编写测试
- 导入路径简短

## 编写测试

### 1. 定义断言类型

```typescript
interface MyGameExpectation extends StateExpectation {
    winner?: string;
    score?: number;
    // ... 游戏特定字段
}
```

### 2. 实现断言函数

```typescript
function assertMyGame(state: MyGameCore, expect: MyGameExpectation): string[] {
    const errors: string[] = [];
    
    if (expect.winner !== undefined && state.winner !== expect.winner) {
        errors.push(`获胜者不匹配: 预期 ${expect.winner}, 实际 ${state.winner}`);
    }
    
    return errors;
}
```

### 3. 编写测试用例

```typescript
const testCases: TestCase<MyGameExpectation>[] = [
    {
        name: '正常流程 - 玩家获胜',
        commands: [
            { type: 'MOVE', playerId: '0', payload: { ... } },
            { type: 'ATTACK', playerId: '1', payload: { ... } },
        ],
        expect: {
            winner: '0',
        },
    },
    {
        name: '错误测试 - 非法操作',
        commands: [
            { type: 'INVALID_MOVE', playerId: '0', payload: {} },
        ],
        expect: {
            errorAtStep: { step: 1, error: 'invalidMove' },
        },
    },
];
```

### 4. 运行测试

```typescript
const runner = new GameTestRunner({
    domain: MyGameDomain,
    playerIds: ['0', '1'],
    assertFn: assertMyGame,
    visualizeFn: (state) => console.log(state), // 可选
});

runner.runAll(testCases);
```

## API 参考

### GameTestRunner

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `domain` | `DomainCore` | 游戏领域内核 |
| `playerIds` | `string[]` | 玩家列表 |
| `assertFn` | `(state, expect) => string[]` | 断言函数，返回错误列表 |
| `visualizeFn` | `(state) => void` | 可选，状态可视化 |
| `random` | `RandomFn` | 可选，自定义随机数生成器 |
| `silent` | `boolean` | 可选，静默模式 |

### TestCase

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 测试名称 |
| `commands` | `Command[]` | 命令序列 |
| `expect` | `StateExpectation` | 预期结果 |
| `skip` | `boolean` | 可选，跳过此测试 |

### StateExpectation

| 字段 | 类型 | 说明 |
|------|------|------|
| `errorAtStep` | `{ step, error }` | 预期某步出现的错误 |

## 构建排除

测试文件不应打包到生产环境，在 vite.config.ts 中配置：

```typescript
build: {
  rollupOptions: {
    external: [/__tests__/]
  }
}
```
