# 自动化测试

项目使用三种测试框架：
- **Vitest** - 游戏领域层测试 + API 集成测试
- **Playwright** - 端到端 UI 测试
- **GameTestRunner** - 游戏领域层专用测试运行器

## 快速开始

```bash
# 运行所有 Vitest 测试（游戏 + API）
npm test

# 运行游戏测试
npm run test:game

# 运行井字棋测试
npm run test:tictactoe

# 运行王权骰铸测试
npm run test:dicethrone

# 运行 API 测试
npm run test:api

# Watch 模式（开发时推荐）
npm run test:watch

# 运行 E2E 测试（Playwright）
npm run test:e2e
```

## API 测试（NestJS）

### 使用 Docker / 本地 MongoDB

当你已经启动 MongoDB（例如 Docker）时，可以设置 `MONGO_URI` 让测试复用现有数据库，**避免下载内存 MongoDB 二进制**：

```bash
# PowerShell
$env:MONGO_URI="mongodb://localhost:27017/boardgame"
npm run test:api
```

> 说明：若未设置 `MONGO_URI`，测试会使用 `mongodb-memory-server` 自动下载并启动临时 MongoDB。

## E2E 测试（Playwright）

端到端测试使用 Playwright，测试文件位于 `e2e/` 目录。

```bash
# 运行 E2E 测试
npm run test:e2e
```

### 编写 E2E 测试

```typescript
import { test, expect } from '@playwright/test';

test('Homepage Check', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Board Game' })).toBeVisible();
});
```

### 关键功能覆盖

- **社交系统 (`e2e/social.test.ts`)**: 覆盖 Global HUD (右下角悬浮球) 入口点击、模态框打开、标签页切换及好友列表渲染。
- **导航栏 (`e2e/navbar.test.ts`)**: 覆盖顶部导航、登录状态及游戏分类切换。

### Mock API 响应

```typescript
test.beforeEach(async ({ page }) => {
    await page.route('**/auth/me', async route => {
        await route.fulfill({ json: { user: mockUser } });
    });
});
```

## 目录结构

```
/
├── e2e/                          # Playwright E2E 测试
│   ├── navbar.test.ts           # 导航栏测试
│   └── social.test.ts           # 社交功能测试
├── apps/
│   └── api/
│       └── test/                 # API 集成测试
│           ├── vitest.setup.ts  # Vitest 启动配置
│           ├── auth.e2e-spec.ts # 认证 API 测试
│           └── social.e2e-spec.ts # 社交 API 测试
├── src/
│   ├── engine/
│   │   └── testing/
│   │       └── index.ts         # GameTestRunner 通用测试运行器
│   └── games/
│       ├── tictactoe/
│       │   └── __tests__/
│       │       └── flow.test.ts # 井字棋流程测试
│       └── dicethrone/
│           └── __tests__/
│               └── flow.test.ts # 王权骰铸流程测试
└── vitest.config.ts              # Vitest 全局配置
```

测试文件放在游戏目录的 `__tests__` 文件夹下，便于：
- 游戏自包含
- UGC 作者可为自己的游戏编写测试
- 导入路径简短

## 测试覆盖要求

测试应全面覆盖以下场景（根据具体项目选择适用项）：

### 1. 基础流程
- 初始状态验证
- 状态流转逻辑
- 正常结束条件

### 2. 核心机制
- 所有功能/能力的触发条件
- 所有功能/能力的实际效果（**与描述/文档一致**）
- 状态的变更与持久化
- 资源的获取与消耗

### 3. 数据驱动效果
- **每个数据驱动的效果必须与其描述完全一致**
- 测试操作后的实际状态变化
- 测试副作用的正确性

### 4. 升级/进阶系统（如有）
- 正常逐级升级
- **跳级升级的拒绝**
- 费用计算（包括差价逻辑）
- 已达最高级时的处理

### 5. 错误处理
- 非法操作的拒绝与错误码返回
- 前置条件不满足时的拒绝
- 错误状态下的操作拒绝
- **错误提示信息的正确性**（用于 i18n 显示）

### 6. 边界条件
- 数值上限/下限
- 特殊触发条件
- 并发/竞态场景（如适用）

### 测试命名规范

测试名称应清晰表达测试意图：
- 正向测试：描述预期行为，如 `"成功创建用户"`, `"正常流程完成"`
- 错误测试：在名称中标注预期的错误码，如 `"无权限操作 - unauthorized"`, `"参数缺失 - missingParams"`

错误测试在名称中标注错误码，便于追踪和维护。

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
    // 如果 Domain.setup 需要 RandomFn，可传入 setup
    setup: (playerIds, random) => MyGameDomain.setup(playerIds, random),
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
| `setup` | `(playerIds, random) => state` | 可选，自定义初始化（用于需要 RandomFn 的 setup） |
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
