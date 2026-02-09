# 自动化测试

项目使用三种测试框架：
- **Vitest** - 游戏领域层测试 + API 集成测试
- **Playwright** - 端到端 UI 测试
- **GameTestRunner** - 游戏领域层专用测试运行器

## 快速开始

```bash
npm test                      # 所有 Vitest 测试
npm run test:game             # 游戏测试
npm run test:tictactoe        # 井字棋测试
npm run test:dicethrone       # 王权骰铸测试
npm run test:api              # API 测试
npm run test:watch            # Watch 模式
npm run test:e2e              # E2E 测试（Playwright）
```

## 测试范围策略

项目无自动计算受影响测试脚本，建议按影响范围选择：

- **日常开发**：只跑直接相关的 Vitest 测试
- **提交前/合并前**（跨模块、影响引擎/系统/公共组件）：跑全量测试

### 精简策略（同类覆盖保留）

目标：减少低价值用例数量，保持每个“交互类别/能力类别”至少 1 条代表性用例。

**为什么即使用 AI 生成，也要保留精简策略：**
- **运行成本**：用例越多，CI/本地运行时间越长，反馈变慢。
- **稳定性成本**：同类用例越多，受到波动/偶发失败影响的概率越高。
- **维护成本**：UI/文案/流程调整会同时破坏大量重复用例，排查时间增加。
- **噪声成本**：大量相似失败会掩盖真正的高价值回归。

**例外（必须保持多样化覆盖的场景）：**
- **素材/配置差异高**（例如角色选择、资源加载、图片缺失）：需要按数据维度保留或改为数据驱动的完整性检查。

**低价值用例判定（可删除/合并）：**
- 只验证“出现/可见”的静态用例，且在其它测试中已有同一路径的功能性操作。
- 与“创建/更新/删除/保存”同类行为重复，仅验证列表/计数/标题等弱断言。
- 同一个交互链条被拆成多个短用例，但没有新增失败分支或独立状态变化。
- 仅为截图存在的用例（无断言或无状态变化）。

**必须保留的同类覆盖（最少 1 条）：**
- 入口可达 + 关键操作 + 结果验证（例如：创建→保存→刷新恢复）。
- 关键交互面（Modal/Tab/表单校验/多步骤选择）每类至少 1 条。
- 负向或边界至少 1 条（如未登录/非法操作被拒绝）。

**精简建议做法：**
1. 将同类的“打开/可见”断言并入功能性用例的前置步骤。
2. 对同一功能域，保留“功能链闭环”的单条用例（含核心断言）。
3. UI 交互链条尽量在一条用例内完成，避免重复 setup。

### 过滤运行 Vitest 测试

```bash
npm test -- audio.config                        # 匹配文件名/路径
npm test -- src/ugc/builder                     # 匹配目录
npm test -- src/games/tictactoe/__tests__       # 游戏测试目录
npm test -- src/games/tictactoe/__tests__/flow.test.ts  # 单文件
```

### 何时跑全量

满足任一条件就扩大范围：
- 修改 `src/engine/`、`src/systems/`、`src/core/`、`src/components/game/framework/`
- 涉及多人联机、状态同步、Undo/Rematch/Prompt 等系统性行为
- 涉及公共类型/协议

## API 测试（NestJS）

可设置 `MONGO_URI` 复用 Docker MongoDB，避免下载内存 MongoDB 二进制：

```bash
# PowerShell
$env:MONGO_URI="mongodb://localhost:27017/boardgame_test"
npm run test:api
```

> 未设置时使用 `mongodb-memory-server` 自动启动临时 MongoDB。

## E2E 测试（Playwright）

测试文件位于 `e2e/` 目录。

**硬性要求（更新）**：E2E 必须覆盖“交互面”而不只是“完整流程”。

- **交互覆盖**：对用户可见且可操作的关键交互点，逐一验证：
  - 能否触达（入口/按钮/快捷入口/菜单/路由）
  - 能否操作（点击/输入/拖拽/切换 Tab/确认取消/关闭弹窗）
  - 操作后的 UI 反馈（状态变化、禁用态、提示文案、Loading、错误提示）
  - 数据/状态副作用（如加入房间、发送消息、发起重赛投票、退出房间）
- **流程覆盖**：对“从入口到结束/返回”的主路径至少保留 1 条 happy path 作为回归基线。

> 解释：完整流程只能证明“最常见路径可用”，无法覆盖大量分支与 UI 入口（例如 Modal 打开/关闭、Tab 切换、列表筛选、异常提示等）。E2E 的价值是覆盖“真实用户会点到的交互面”。

### 本地模式 vs 在线对局

**大多数游戏不支持本地同屏**。`/play/<gameId>/local` 仅用于调试，不代表真实多人流程。

| 场景 | 做法 |
|------|------|
| 真实多人流程 | 使用 host/guest 两个浏览器上下文：创建房间 → guest `?join=true` 加入 → 覆盖关键交互点（不强制打完整对局） |
| 交互回归 | 按“交互覆盖清单”逐条验证（按钮/弹窗/Tab/关键面板）；必要时可拆成多个短测试用例 |
| 冒烟测试 | 验证页面加载 + 关键元素出现；不支持本地同屏的游戏也走在线房间 |
| 调试/静态渲染 | 可用 `/play/<gameId>/local`，但不能替代多人流程 |

### 编写 E2E 测试

```typescript
import { test, expect } from '@playwright/test';

test('Homepage Check', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Board Game' })).toBeVisible();
});
```

### 截图与附件管理（强制）

为了防止并行测试或重复运行导致截图相互覆盖，所有手动触发的截图（`page.screenshot()`）必须遵循以下规范：

1.  **使用 `testInfo.outputPath()`**：始终使用 `testInfo.outputPath('filename.png')` 生成存放路径。
    - **原理**：Playwright 会为每个测试用例分配一个独立的输出目录（通常位于 `test-results/<test-id>/`）。
    - **收益**：100% 隔离，支持并行，支持查看特定用例的历史产物。
2.  **禁止硬编码路径**：严禁使用 `e2e/screenshots/...` 或固定在 `test-results/` 根目录下的文件名。
3.  **产物提交限制**：`test-results/` 目录已被 git 忽略，测试产物不应提交到代码仓库。
4.  **按需截图**：除非是专门的视觉回归测试，否则建议仅在关键状态验证点截图。默认情况下，配置已开启 `screenshot: 'only-on-failure'`。

示例：
```typescript
test('Match started', async ({ page }, testInfo) => {
    // ... 操作
    await page.screenshot({ path: testInfo.outputPath('game-started.png') });
});
```

---

### 所有游戏 E2E 覆盖范围（通用规范）

**目标：覆盖“完整流程 + 特殊交互面”，适用于所有游戏。**

覆盖范围（类别级）：

1. **完整流程基线（Happy Path）**
   - 入口 → 创建房间 → 阵营选择 → 开始对局 → 回合推进 → 结束/结算

2. **核心交互面（可见且可操作）**
   - 关键 UI 面板（阶段、手牌、地图、行动按钮）
   - 地图缩放/拖拽、阶段推进、弃牌与资源变化

3. **特殊交互面（多步骤/弹窗/选择模式）**
   - 攻击后技能选择（如控制/伤害、推拉方向、额外攻击目标）
   - 事件卡多目标/多步骤选择（选择目标 → 方向/距离 → 确认）
   - 弃牌堆选择/从弃牌堆召唤/跟随位置确认

4. **负面与边界**
   - 非当前玩家操作被拒绝
   - 阶段自动跳过边界（有可用操作时不应跳过）

> 具体用例明细以各游戏对应的 `e2e/<gameId>*.e2e.ts` 为准，文档只定义覆盖范围与原则，避免膨胀为超长清单。

### Mock API 响应

```typescript
test.beforeEach(async ({ page }) => {
    await page.route('**/auth/me', async route => {
        await route.fulfill({ json: { user: mockUser } });
    });
});
```

### 关键功能覆盖

- `e2e/social.test.ts` - Global HUD 入口、模态框、标签页、好友列表
- `e2e/navbar.test.ts` - 顶部导航、登录状态、游戏分类
- `e2e/tictactoe-tutorial.e2e.ts` - 井字棋教程完整流程
- `e2e/dicethrone.e2e.ts` - 线上房间手牌校验 + 教程完整流程 + 僧侣莲花掌选择 + 雷霆万钧奖励骰重掷
- `e2e/dicethrone-moon-elf.e2e.ts` - 月精灵基础攻击 + Targeted 伤害结算
- `e2e/dicethrone-shadow-thief.e2e.ts` - 暗影刺客基础攻击 + Sneak 免伤 + 双防御技能选择

## 目录结构

```
/
├── e2e/                          # Playwright E2E 测试
├── apps/api/test/                # API 集成测试
├── src/engine/testing/           # GameTestRunner
└── src/games/<gameId>/__tests__/ # 游戏领域测试
```

## 测试覆盖要求

**集成测试必须覆盖所有情况**：

| 类别 | 覆盖点 |
|------|--------|
| 基础流程 | 初始状态、状态流转、正常结束 |
| 核心机制 | 触发条件、实际效果（与描述一致）、状态变更、资源获取/消耗 |
| 数据驱动 | 效果与描述完全一致、状态变化、副作用正确性 |
| 升级系统 | 逐级升级、跳级拒绝、费用计算、最高级处理 |
| 错误处理 | 非法操作拒绝、前置条件拒绝、错误码正确性 |
| 边界条件 | 数值上下限、特殊触发、并发/竞态 |
| E2E | 入口 → 关键交互 → 完成/退出；教程需验证 AI 回合 |

### 测试命名规范

- 正向测试：描述预期行为（`"成功创建用户"`）
- 错误测试：标注错误码（`"无权限操作 - unauthorized"`）

## 编写 GameTestRunner 测试

### 1. 定义断言类型

```typescript
interface MyGameExpectation extends StateExpectation {
    winner?: string;
    score?: number;
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
        expect: { winner: '0' },
    },
    {
        name: '错误测试 - 非法操作',
        commands: [{ type: 'INVALID_MOVE', playerId: '0', payload: {} }],
        expect: { errorAtStep: { step: 1, error: 'invalidMove' } },
    },
];
```

### 4. 运行测试

```typescript
const runner = new GameTestRunner({
    domain: MyGameDomain,
    playerIds: ['0', '1'],
    setup: (playerIds, random) => MyGameDomain.setup(playerIds, random), // 可选
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
| `setup` | `(playerIds, random) => state` | 可选，自定义初始化 |
| `assertFn` | `(state, expect) => string[]` | 断言函数 |
| `visualizeFn` | `(state) => void` | 可选，状态可视化 |
| `random` | `RandomFn` | 可选，自定义随机数 |
| `silent` | `boolean` | 可选，静默模式 |

### TestCase

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 测试名称 |
| `commands` | `Command[]` | 命令序列 |
| `expect` | `StateExpectation` | 预期结果 |
| `skip` | `boolean` | 可选，跳过 |

### StateExpectation

| 字段 | 类型 | 说明 |
|------|------|------|
| `errorAtStep` | `{ step, error }` | 预期错误 |

## 构建排除

测试文件不打包到生产环境：

```typescript
// vite.config.ts
build: {
  rollupOptions: {
    external: [/__tests__/]
  }
}
```
