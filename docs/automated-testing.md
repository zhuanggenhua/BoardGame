# 自动化测试

> 本文档是项目唯一的测试规范文档。引擎层审计工具的详细规范见 `docs/ai-rules/engine-systems.md`「引擎测试工具总览」节。

## 目录

- [快速开始](#快速开始)
- [测试隔离与性能](#测试隔离与性能)
- [测试框架与工具](#测试框架与工具)
- [测试策略](#测试策略)
- [E2E 测试](#e2e-测试)
- [API 测试](#api-测试)
- [GameTestRunner](#gametestrunner)
- [调试工具](#调试工具)
- [持续集成](#持续集成)

---

## 快速开始

```bash
# 运行所有测试
npm test

# 运行特定游戏的测试（推荐开发时使用）
npm run test:summonerwars    # Summoner Wars
npm run test:smashup         # Smash Up
npm run test:dicethrone      # Dice Throne
npm run test:tictactoe       # Tic Tac Toe

# 运行核心框架测试
npm run test:core            # 引擎、组件、工具库

# 运行其他模块测试
npm run test:server          # 服务端测试
npm run test:ugc             # UGC 系统测试
npm run test:games           # 所有游戏测试
npm run test:api             # API 测试

# 监听模式（开发时使用）
npm run test:watch

# E2E 测试
npm run test:e2e
```

### 过滤运行 Vitest 测试

```bash
npm test -- audio.config                        # 匹配文件名/路径
npm test -- src/ugc/builder                     # 匹配目录
npm test -- src/games/tictactoe/__tests__       # 游戏测试目录
npm test -- src/games/tictactoe/__tests__/flow.test.ts  # 单文件
```

### 开发工作流建议

1. **开发特定游戏时**：只运行该游戏的测试（6-12秒）
2. **修改核心框架时**：先运行核心测试，再运行游戏测试
3. **提交前**：运行所有测试
4. **调试单个测试文件**：`npx vitest run <文件路径>`

---

## 测试隔离与性能

项目采用测试隔离策略，将测试分为多个独立模块，支持选择性运行和并行测试。

### 测试模块划分

| 模块 | 命令 |
|------|------|
| Summoner Wars | `npm run test:summonerwars` |
| Smash Up | `npm run test:smashup` |
| Dice Throne | `npm run test:dicethrone` |
| Tic Tac Toe | `npm run test:tictactoe` |
| 核心框架 | `npm run test:core` |
| 服务端 | `npm run test:server` |
| UGC 系统 | `npm run test:ugc` |
| API | `npm run test:api` |
| 全量 | `npm test` |

### 何时运行全量测试

满足任一条件就扩大范围：
- 修改 `src/engine/`（含 `primitives/` 与 `systems/`）、`src/core/`、`src/components/game/framework/`
- 涉及多人联机、状态同步、Undo/Rematch/Prompt 等系统性行为
- 涉及公共类型/协议
- 提交前/合并前

---

## 测试框架与工具

### 测试框架

| 框架 | 用途 |
|------|------|
| Vitest | 游戏领域层测试 + API 集成测试 |
| Playwright | 端到端 UI 测试 |
| GameTestRunner | 游戏领域层专用测试运行器（命令序列 → pipeline → 状态断言） |

### 引擎层审计工具（`src/engine/testing/`）

> **GameTestRunner 行为测试是最优先、最可靠的测试手段**。审计工具是补充，用于批量覆盖 GameTestRunner 无法高效覆盖的注册表引用完整性和交互链完整性。
> 详细规范见 `docs/ai-rules/engine-systems.md`「引擎测试工具总览」节。

| 工具 | 文件 | 用途 |
|------|------|------|
| GameTestRunner | `index.ts` | 命令序列执行 + 状态断言，所有游戏首选 |
| entityIntegritySuite | `entityIntegritySuite.ts` | 数据定义契约验证（注册表完整性/引用链/触发路径/效果契约） |
| referenceValidator | `referenceValidator.ts` | 实体引用链提取与验证 |
| interactionChainAudit | `interactionChainAudit.ts` | UI 状态机 payload 覆盖审计（模式 A） |
| interactionCompletenessAudit | `interactionCompletenessAudit.ts` | Interaction handler 注册覆盖审计（模式 B） |

新增游戏时根据游戏特征选择需要的审计工具：
- 所有游戏（必选）→ GameTestRunner
- 有注册表 + 数据定义（≥20 个实体）→ entityIntegritySuite
- 有多步 UI 交互 → interactionChainAudit
- 有 InteractionSystem → interactionCompletenessAudit

### 目录结构

```
/
├── e2e/                          # Playwright E2E 测试
├── apps/api/test/                # API 集成测试
├── src/engine/testing/           # 引擎层测试工具
└── src/games/<gameId>/__tests__/ # 游戏领域测试
```

---

## 测试策略

### 测试覆盖要求

| 类别 | 覆盖点 |
|------|--------|
| 基础流程 | 初始状态、状态流转、正常结束 |
| 核心机制 | 触发条件、实际效果（与描述一致）、状态变更、资源获取/消耗 |
| 数据驱动 | 效果与描述完全一致、状态变化、副作用正确性 |
| 升级系统 | 逐级升级、跳级拒绝、费用计算、最高级处理 |
| 错误处理 | 非法操作拒绝、前置条件拒绝、错误码正确性 |
| 边界条件 | 数值上下限、特殊触发、并发/竞态 |
| 静态审计 | 注册表完整性、交互链覆盖（使用引擎层审计工厂） |
| **集成链路** | **每个需要 Interaction 的能力至少 1 条 execute() 完整链路测试** |
| E2E | 入口 → 关键交互 → 完成/退出；教程需验证 AI 回合 |

### 集成链路测试规范（强制）

> 教训：单元测试直接调用能力函数（如 `triggerBaseAbility`）时会自动传递 `matchState` 参数，
> 但 reducer 层可能漏传参数导致 Interaction 类能力静默失败。单元测试全绿不代表完整链路正确。

**规则**：每个通过 `matchState` / `queueInteraction` 创建交互的能力，必须至少有 1 条通过 `execute()` 走完整链路的集成测试，验证：
1. `execute()` 返回的事件列表正确
2. `sys.interaction` 中有对应的 Interaction（sourceId 匹配）

**参考**：`src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts`

### 精简策略（同类覆盖保留）

目标：减少低价值用例数量，保持每个"交互类别/能力类别"至少 1 条代表性用例。

**为什么需要精简**：
- **运行成本**：用例越多，CI/本地运行时间越长，反馈变慢
- **稳定性成本**：同类用例越多，受到波动/偶发失败影响的概率越高
- **维护成本**：UI/文案/流程调整会同时破坏大量重复用例
- **噪声成本**：大量相似失败会掩盖真正的高价值回归

**例外（必须保持多样化覆盖的场景）**：
- 素材/配置差异高（例如角色选择、资源加载、图片缺失）：需要按数据维度保留或改为数据驱动的完整性检查

**低价值用例判定（可删除/合并）**：
- 只验证"出现/可见"的静态用例，且在其它测试中已有同一路径的功能性操作
- 与"创建/更新/删除/保存"同类行为重复，仅验证列表/计数/标题等弱断言
- 同一个交互链条被拆成多个短用例，但没有新增失败分支或独立状态变化
- 仅为截图存在的用例（无断言或无状态变化）

**必须保留的同类覆盖（最少 1 条）**：
- 入口可达 + 关键操作 + 结果验证（例如：创建→保存→刷新恢复）
- 关键交互面（Modal/Tab/表单校验/多步骤选择）每类至少 1 条
- 负向或边界至少 1 条（如未登录/非法操作被拒绝）

### 测试命名规范

- 正向测试：描述预期行为（`"成功创建用户"`）
- 错误测试：标注错误码（`"无权限操作 - unauthorized"`）

### 测试最佳实践

1. 测试文件命名：`*.test.ts` 或 `*.test.tsx`
2. 测试文件位置：`__tests__` 目录下
3. 测试描述：使用中文描述测试用例
4. 测试隔离：每个测试应该独立，不依赖其他测试的状态
5. 快照测试：谨慎使用，优先使用断言
6. 异步测试：使用 `async/await`，设置合理的超时时间
7. **随机数处理（强制）**：测试中涉及随机数（骰子、抽牌、洗牌等）时，必须使用固定值或可控的伪随机序列，禁止依赖真随机。做法：
   - GameTestRunner 的 `random` 参数传入返回固定值的函数（如 `() => 0.5`）
   - E2E 测试使用 `applyDiceValues` 等调试面板 API 注入预设骰子值
   - 测试 setup 中直接构造确定性初始状态，跳过随机初始化
   - 目的：确保测试结果可重复、可调试、不因随机波动导致偶发失败

---

## E2E 测试

测试文件位于 `e2e/` 目录。

### 使用 Fixture 简化测试（推荐）

项目提供了 Playwright Fixture 来自动管理对局创建和清理，大幅减少样板代码。

#### 基础用法

```typescript
import { test, expect } from './fixtures';

test('测试名称', async ({ smashupMatch }) => {
  const { hostPage, guestPage, matchId } = smashupMatch;
  
  // 直接开始测试，无需 setup 代码
  await hostPage.click('[data-testid="play-card"]');
  await expect(hostPage.getByText('Card played')).toBeVisible();
  
  // 无需手动 cleanup，fixture 自动处理
});
```

#### 可用的 Fixture

| Fixture | 说明 | 默认配置 |
|---------|------|----------|
| `smashupMatch` | SmashUp 对局 | Host: 派系 [0,1], Guest: 派系 [2,3] |
| `dicethroneMatch` | DiceThrone 对局 | Host: Monk, Guest: Barbarian |
| `summonerwarsMatch` | SummonerWars 对局 | Host: Necromancer, Guest: Trickster |

#### 自定义配置

如需自定义派系/角色，使用工厂函数：

```typescript
import { test, expect, createSmashUpMatch } from './fixtures';

test('自定义派系', async ({ browser }, testInfo) => {
  const setup = await createSmashUpMatch(browser, testInfo.project.use.baseURL, {
    hostFactions: [9, 0],  // 幽灵 + 海盗
    guestFactions: [1, 2], // 忍者 + 恐龙
  });
  
  if (!setup) {
    test.skip();
    return;
  }
  
  const { hostPage, guestPage } = setup;
  // 测试代码...
});
```

#### 代码量对比

**重构前**（每个测试 23-35 行）：
```typescript
test('test', async ({ browser }, testInfo) => {
  // 15-20 行 setup 代码
  const hostContext = await browser.newContext(...);
  await initContext(...);
  const matchId = await createRoom(...);
  // ...
  
  // 5-10 行测试代码
  await hostPage.click(...);
  
  // 3-5 行 cleanup
  await hostContext.close();
  await guestContext.close();
});
```

**重构后**（每个测试 5-10 行）：
```typescript
test('test', async ({ smashupMatch }) => {
  const { hostPage } = smashupMatch;
  
  // 5-10 行测试代码
  await hostPage.click(...);
  
  // 自动 cleanup
});
```

**减少代码量：60-70%**

### 传统方式（不推荐，仅用于特殊场景）

如果 fixture 不满足需求，可以使用传统的 helper 函数：

```typescript
import { setupSmashUpOnlineMatch } from './helpers/smashup';

test('test', async ({ browser }, testInfo) => {
  const setup = await setupSmashUpOnlineMatch(browser, testInfo.project.use.baseURL);
  if (!setup) {
    test.skip();
    return;
  }
  
  try {
    // 测试代码
  } finally {
    await setup.hostContext.close();
    await setup.guestContext.close();
  }
});
```

### E2E 测试失败排查规范（强制）

**当 E2E 测试失败时，必须按以下顺序排查，禁止跳过步骤直接猜测原因：**

1. **先读代码，再调试**
   - ❌ 错误做法：看到超时/卡住就假设"有 bug"，直接修改测试或增加等待时间
   - ✅ 正确做法：先读取相关源码，理解业务逻辑和 UI 交互设计
   - 示例：SummonerWars 的"结束阶段"按钮在 `move`/`attack` 阶段有防误操作机制，需要点击两次（第一次确认，第二次执行）。这不是 bug，是设计特性。

2. **理解测试失败的真实原因**
   - 读取失败日志，定位卡住/超时的具体步骤
   - 检查相关 UI 组件的 `disabled`/`onClick`/`useEffect` 逻辑
   - 检查状态管理（useState/useCallback）和条件渲染
   - 检查是否有"确认模式"、"二次确认"、"等待动画"等设计

3. **验证是设计特性还是真正的 bug**
   - 设计特性：防误操作、二次确认、动画延迟、状态门控
   - 真正的 bug：逻辑错误、状态不同步、事件未触发、死锁

4. **修复策略**
   - 设计特性 → 更新测试代码适配设计（如增加等待、处理确认流程）
   - 真正的 bug → 修复源码逻辑

**反面教材**：
```typescript
// ❌ 错误：未读代码就假设"阶段推进有 bug"
// 实际：move 阶段有可移动单位时需要二次确认
await page.click('[data-testid="end-phase"]');
await page.waitForTimeout(5000); // 盲目增加等待
```

**正确做法**：
```typescript
// ✅ 正确：读代码后理解确认机制，测试代码适配设计
// src/games/summonerwars/ui/useCellInteraction.ts:
// if ((currentPhase === 'move' || currentPhase === 'attack') && actionableUnitPositions.length > 0) {
//   setEndPhaseConfirmPending(true);  // 第一次点击进入确认模式
//   return;
// }

// 测试代码处理确认流程
const endPhaseBtn = page.getByTestId('sw-end-phase');
await endPhaseBtn.click(); // 第一次点击：进入确认模式
await page.waitForTimeout(500);
await endPhaseBtn.click(); // 第二次点击：确认并推进阶段
```

### E2E 测试环境依赖排查（强制）

**E2E 测试依赖三个服务同时运行**：前端开发服务器（Vite）、游戏服务器（game-server）、API 服务器（api-server）。测试失败时必须先检查服务依赖。

#### 推荐工作流

1. **开发模式**（手动启动服务，推荐）：
   ```bash
   # 终端 1：启动所有服务
   npm run dev
   
   # 终端 2：运行测试
   npm run test:e2e
   ```

2. **CI 模式**（自动启动服务）：
   ```bash
   # 单终端：自动启动服务并运行测试
   npm run test:e2e:ci
   ```

3. **清理端口占用**（测试异常退出后）：
   ```bash
   npm run test:e2e:cleanup
   ```

#### 测试失败排查顺序

**当 E2E 测试失败时，按以下顺序排查：**

1. **检查端口配置**
   - 读取 `.env` 文件确认端口配置：
     - `VITE_DEV_PORT`（默认 3000）
     - `GAME_SERVER_PORT`（默认 18000）
     - `API_SERVER_PORT`（默认 18001）

2. **检查服务状态**
   ```powershell
   # 检查端口是否被占用
   netstat -ano | findstr ":3000"
   netstat -ano | findstr ":18000"
   netstat -ano | findstr ":18001"
   
   # 或使用 PowerShell
   Get-NetTCPConnection -LocalPort 3000
   Get-NetTCPConnection -LocalPort 18000
   Get-NetTCPConnection -LocalPort 18001
   ```

3. **验证服务可达性**
   - 前端：访问 `http://localhost:3000`（或 `.env` 中配置的端口）
   - 游戏服务器：访问 `http://localhost:18000/games`（应返回游戏列表）
   - API 服务器：访问 `http://localhost:18001/auth/status`（应返回认证状态）

4. **验证代理配置**
   - 检查 `vite.config.ts` 中的 `server.proxy` 配置是否与 `.env` 端口一致

5. **清理遗留连接**
   ```bash
   # 清理测试遗留的端口占用和 WebSocket 连接
   npm run test:e2e:cleanup
   ```

#### 端口冲突处理

**如果端口被占用**：

1. **优先清理测试遗留进程**：
   ```bash
   npm run test:e2e:cleanup
   ```

2. **手动终止占用进程**（确认非关键进程后）：
   ```powershell
   # 查找占用进程的 PID
   netstat -ano | findstr ":18000"
   
   # 终止进程（替换 <PID> 为实际 PID）
   taskkill /F /PID <PID>
   ```

3. **⚠️ 危险操作警告**：
   - ❌ **禁止**：`taskkill /F /IM node.exe`（会杀掉所有 Node.js 进程）
   - ❌ **禁止**：`killall node`、`pkill node`（同上）
   - ❌ **禁止**：`Get-Process node | Stop-Process -Force`（同上）
   - **原因**：会杀掉其他项目的服务器、VS Code 语言服务器、调试器、正在运行的测试等

#### 为什么会端口占用

E2E 测试会创建多个 BrowserContext 和 WebSocket 连接。如果测试异常退出或清理不完整，这些连接可能不会被正确关闭，导致端口持续被占用。

**解决方案**：
- 使用 `npm run test:e2e:cleanup` 强制清理所有相关进程
- 或使用 `node scripts/infra/port-allocator.js <workerId>` 清理特定 worker 的端口

#### 测试超时排查

**如果测试超时（timeout）**：

1. **优先检查服务是否启动**（而非直接修改测试代码的超时时间）
2. **检查端口配置是否正确**
3. **检查是否有端口冲突**
4. **检查网络连接**（防火墙、代理等）

**常见错误**：
```
TimeoutError: page.goto: Timeout 30000ms exceeded
```

**排查步骤**：
1. 确认前端服务器正在运行（`http://localhost:3000`）
2. 确认游戏服务器正在运行（`http://localhost:18000/games`）
3. 确认 API 服务器正在运行（`http://localhost:18001/auth/status`）
4. 检查浏览器控制台是否有错误（使用 `page.on('console', ...)` 监听）

### E2E 测试选择器多语言支持（强制）

**问题**：E2E 测试环境的语言可能与手动操作时不同，导致基于文本的选择器失败。

**规则**：所有 E2E 测试选择器必须支持多语言环境，不得依赖特定语言的文本内容。

**错误做法**：
```typescript
// ❌ 错误：只支持中文，测试环境是英文时会失败
const banner = page.locator('.bg-purple-900\\/95', { 
  hasText: '选择：打出事件卡或弃牌换魔力' 
});

const playButton = banner.locator('button', { hasText: '打出' });
```

**正确做法**：
```typescript
// ✅ 正确：使用 CSS 类 + 正则表达式，支持中英文
const banner = page.locator('.bg-purple-900\\/95').filter({ 
  hasText: /Choose|选择/ 
});

const playButton = banner.locator('button').filter({ 
  hasText: /Play|打出/ 
});

const discardButton = banner.locator('button').filter({ 
  hasText: /Discard|弃牌/ 
});

const cancelButton = banner.locator('button').filter({ 
  hasText: /Cancel|取消/ 
});
```

**最佳实践**：
1. **优先使用 `data-testid`**：不依赖文本和样式，最稳定
   ```typescript
   const button = page.getByTestId('play-event-button');
   ```

2. **使用 CSS 类选择器**：不依赖文本内容
   ```typescript
   const banner = page.locator('.magic-event-choice-banner');
   ```

3. **使用正则表达式匹配多语言**：当必须依赖文本时
   ```typescript
   const button = page.locator('button').filter({ hasText: /Play|打出/ });
   ```

4. **避免硬编码文本**：禁止使用 `{ hasText: '打出' }` 或 `getByText('打出')`

**为什么会出现语言不一致**：
- 手动操作时浏览器可能加载中文（根据系统语言或用户设置）
- E2E 测试环境可能加载英文（Playwright 默认语言或 CI 环境语言）
- i18next 根据 `navigator.language` 或 localStorage 自动选择语言

**教训案例**：
- 问题：`e2e/summonerwars-magic-event-choice.e2e.ts` 测试失败，横幅文本未找到
- 原因：代码渲染了英文横幅 "Choose: Play event card or discard for magic"，但测试查找中文 "选择：打出事件卡或弃牌换魔力"
- 解决：使用正则表达式 `/Choose|选择/` 同时匹配中英文
- 参考：`e2e/summonerwars-magic-event-choice.e2e.ts`

### TestHarness 测试工具（推荐）

项目提供了统一的测试工具集（TestHarness），用于控制游戏状态、骰子投掷、随机数等，确保 E2E 测试稳定可靠。

#### 核心功能

| 功能 | 说明 | 用途 |
|------|------|------|
| 骰子注入 | 精确控制骰子投掷结果 | 消除随机性，测试特定技能触发条件 |
| 状态注入 | 直接设置游戏状态 | 快速构造测试场景，跳过冗长的准备步骤 |
| 命令分发 | 直接执行游戏命令 | 绕过 UI 交互，快速推进游戏流程 |
| 随机数控制 | 控制所有随机数生成 | 确保测试结果可预测、可重复 |

#### 快速开始

```typescript
import { test, expect } from '@playwright/test';
import { setupDTOnlineMatch, selectCharacter, readyAndStartGame, waitForGameBoard } from './helpers/dicethrone';
import { waitForTestHarness } from './helpers/common';

test('雷霆万钧技能测试', async ({ browser }, testInfo) => {
    const setup = await setupDTOnlineMatch(browser, testInfo.project.use.baseURL);
    const { hostPage, guestPage, hostContext, guestContext } = setup;

    // 选择角色并开始游戏
    await selectCharacter(hostPage, 'monk');
    await selectCharacter(guestPage, 'monk');
    await readyAndStartGame(hostPage, guestPage);
    await waitForGameBoard(hostPage);

    // 等待测试工具就绪
    await waitForTestHarness(hostPage);

    // 注入骰子值：3个掌面（值为3）+ 2个拳头（值为1）
    await hostPage.evaluate(() => {
        window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3, 1, 1]);
    });

    // 修改玩家状态
    await hostPage.evaluate(() => {
        window.__BG_TEST_HARNESS__!.state.patch({
            core: {
                players: {
                    '0': { tokens: { taiji: 2 } }
                }
            }
        });
    });

    // 执行掷骰操作
    await hostPage.click('[data-tutorial-id="dice-roll-button"]');
    await hostPage.waitForTimeout(2500);
    await hostPage.click('button:has-text("确认")');

    // 验证骰子值
    const state = await hostPage.evaluate(() => {
        return window.__BG_TEST_HARNESS__!.state.get();
    });
    expect(state.core.dice.map(d => d.value)).toEqual([3, 3, 3, 1, 1]);

    // 清理
    await guestContext.close();
    await hostContext.close();
});
```

#### API 参考

**骰子注入**：
```typescript
// 设置骰子值（1-6）
window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3, 1, 1]);

// 添加骰子值到队列末尾
window.__BG_TEST_HARNESS__!.dice.enqueue(6, 6);

// 清空队列
window.__BG_TEST_HARNESS__!.dice.clear();

// 检查剩余骰子数
window.__BG_TEST_HARNESS__!.dice.remaining();
```

**状态注入**：
```typescript
// 获取当前状态
const state = window.__BG_TEST_HARNESS__!.state.get();

// 设置状态（完全替换）
state.core.players['0'].resources.hp = 10;
window.__BG_TEST_HARNESS__!.state.set(state);

// 部分更新（深度合并，推荐）
window.__BG_TEST_HARNESS__!.state.patch({
    core: {
        players: {
            '0': {
                resources: { hp: 10, cp: 5 },
                tokens: { taiji: 2 }
            }
        }
    }
});
```

**命令分发**：
```typescript
// 分发命令
await window.__BG_TEST_HARNESS__!.command.dispatch({
    type: 'ADVANCE_PHASE',
    playerId: '0',
    payload: {}
});
```

**随机数控制**：
```typescript
// 设置随机数队列（0-1 范围）
window.__BG_TEST_HARNESS__!.random.setQueue([0.1, 0.5, 0.9]);

// 添加随机数
window.__BG_TEST_HARNESS__!.random.enqueue(0.2, 0.7);

// 清空队列
window.__BG_TEST_HARNESS__!.random.clear();
```

**工具状态查询**：
```typescript
// 获取所有工具状态
const status = window.__BG_TEST_HARNESS__!.getStatus();
console.log(status);
// {
//     random: { enabled: true, queueLength: 5, consumed: 3 },
//     dice: { remaining: 5, values: [3,3,3,1,1] },
//     state: { registered: true },
//     command: { registered: true }
// }

// 重置所有工具
window.__BG_TEST_HARNESS__!.reset();
```

#### 使用场景

**场景 1：测试依赖特定骰子结果的技能**
```typescript
// 雷霆万钧技能需要3个掌面（值为3）才能触发
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3, 1, 1]);
});
```

**场景 2：快速构造测试场景**
```typescript
// 设置玩家 HP 为 10，跳过冗长的战斗过程
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.state.patch({
        core: { players: { '0': { resources: { hp: 10 } } } }
    });
});
```

**场景 3：直接推进游戏阶段**
```typescript
// 直接推进到攻击阶段，跳过前置阶段
await page.evaluate(() => {
    window.__BG_TEST_HARNESS__!.command.dispatch({
        type: 'ADVANCE_PHASE',
        playerId: '0',
        payload: {}
    });
});
```

#### 最佳实践

1. **总是等待测试工具就绪**
   ```typescript
   await waitForTestHarness(page);
   ```

2. **使用类型断言**
   ```typescript
   window.__BG_TEST_HARNESS__!  // 注意感叹号
   ```

3. **状态修改后等待渲染**
   ```typescript
   await page.evaluate(() => {
       window.__BG_TEST_HARNESS__!.state.patch({ ... });
   });
   await page.waitForTimeout(500);  // 等待 React 重新渲染
   ```

4. **使用有意义的骰子值**
   ```typescript
   // ✅ 正确：注释说明骰子含义
   await page.evaluate(() => {
       // 武僧骰子：3=掌面，1=拳头
       window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3, 1, 1]);
   });
   ```

5. **测试结束时清理**
   ```typescript
   await page.evaluate(() => {
       window.__BG_TEST_HARNESS__!.reset();
   });
   ```

#### 常见陷阱

1. **忘记等待测试工具就绪**
   ```typescript
   // ❌ 错误：可能报错 "Cannot read property 'dice' of undefined"
   await page.evaluate(() => {
       window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3]);
   });

   // ✅ 正确
   await waitForTestHarness(page);
   await page.evaluate(() => {
       window.__BG_TEST_HARNESS__!.dice.setValues([3, 3, 3]);
   });
   ```

2. **骰子值超出范围**
   ```typescript
   // ❌ 错误：骰子值必须是 1-6
   window.__BG_TEST_HARNESS__!.dice.setValues([0, 7, 10]);

   // ✅ 正确
   window.__BG_TEST_HARNESS__!.dice.setValues([1, 6, 3]);
   ```

3. **状态路径错误**
   ```typescript
   // ❌ 错误：缺少 core 前缀
   state.players['0'].hp

   // ✅ 正确
   state.core.players['0'].resources.hp
   ```

#### 更多资源

- 完整设计文档：`docs/testing-infrastructure.md`
- 快速参考：`docs/testing-tools-quick-reference.md`
- 示例测试：`e2e/example-test-harness-usage.e2e.ts`
- 实际案例：`e2e/dicethrone-thunder-strike.e2e.ts`

### 运行方式

```bash
# 开发模式（默认）：使用已运行的服务器
# 1. 先手动启动服务
npm run dev

# 2. 在另一个终端运行测试
npm run test:e2e

# CI 模式：自动启动服务器
npm run test:e2e:ci
```

**环境变量控制**：
- `PW_START_SERVERS=true` — 强制启动服务器（CI 模式）
- 默认（不设置）— 使用已运行的服务器（开发模式）

### 端口配置与隔离（重要）

E2E 测试使用独立的端口范围，与开发环境完全隔离，避免冲突。

#### 端口分配

| 环境 | Frontend | Game Server | API Server |
|------|----------|-------------|------------|
| 开发环境 | 3000 | 18000 | 18001 |
| E2E 测试 | 5173 | 19000 | 19001 |

#### 测试模式

**1. 隔离模式（推荐，默认）**
```bash
npm run test:e2e
```
- 使用独立的测试端口（5173/19000/19001）
- 不会影响开发环境
- 测试失败不会破坏开发服务器状态

**2. 开发服务器模式（不推荐）**
```bash
# 设置环境变量
$env:PW_USE_DEV_SERVERS = "true"  # PowerShell
export PW_USE_DEV_SERVERS=true    # Bash

# 运行测试
npm run test:e2e

# 清除环境变量
$env:PW_USE_DEV_SERVERS = $null   # PowerShell
unset PW_USE_DEV_SERVERS          # Bash
```
- 使用开发环境端口（3000/18000/18001）
- 需要先手动启动 `npm run dev`
- 测试会影响开发环境状态
- 仅用于调试特定问题

#### 端口配置原理

Playwright 配置文件（`playwright.config.ts`）根据 `PW_USE_DEV_SERVERS` 环境变量自动选择端口：

```typescript
// 根据模式选择端口
const PORTS = useDevServers ? DEV_PORTS : E2E_PORTS;

// 设置环境变量，让测试代码能够读取正确的端口
if (!process.env.PW_GAME_SERVER_PORT) {
    process.env.PW_GAME_SERVER_PORT = PORTS.gameServer.toString();
}
```

测试辅助函数（`e2e/helpers/common.ts`）通过环境变量获取端口：

```typescript
export const getGameServerBaseURL = () => {
    const envUrl = process.env.PW_GAME_SERVER_URL || process.env.VITE_GAME_SERVER_URL;
    if (envUrl) return normalizeUrl(envUrl);
    const port = process.env.GAME_SERVER_PORT || process.env.PW_GAME_SERVER_PORT || '18000';
    return `http://localhost:${port}`;
};
```

#### 常见问题

**问题：测试失败，错误信息"房间不存在或已被删除"**

原因：测试代码连接到错误的端口（如连接到 19000 但服务器运行在 18000）

解决方案：
1. 检查是否设置了 `PW_USE_DEV_SERVERS` 环境变量
2. 如果使用开发服务器模式，确保 `npm run dev` 正在运行
3. 如果使用隔离模式，清除 `PW_USE_DEV_SERVERS` 环境变量
4. 检查测试日志中的实际请求 URL（`pw:api → POST http://localhost:xxxxx/...`）

**问题：端口被占用**

解决方案：
```bash
# 查看端口占用
netstat -ano | findstr :19000  # Windows
lsof -ti:19000                 # Linux/Mac

# 清理测试环境端口
npm run test:e2e:cleanup

# 清理开发环境端口
npm run clean:ports
```

### 覆盖原则

**硬性要求**：E2E 必须覆盖"交互面"而不只是"完整流程"。

- **交互覆盖**：对用户可见且可操作的关键交互点，逐一验证：
  - 能否触达（入口/按钮/快捷入口/菜单/路由）
  - 能否操作（点击/输入/拖拽/切换 Tab/确认取消/关闭弹窗）
  - 操作后的 UI 反馈（状态变化、禁用态、提示文案、Loading、错误提示）
  - 数据/状态副作用（如加入房间、发送消息、发起重赛投票、退出房间）
- **流程覆盖**：对"从入口到结束/返回"的主路径至少保留 1 条 happy path 作为回归基线

### 所有游戏 E2E 覆盖范围（通用规范）

1. **完整流程基线（Happy Path）**：入口 → 创建房间 → 阵营选择 → 开始对局 → 回合推进 → 结束/结算
2. **核心交互面**：关键 UI 面板（阶段、手牌、地图、行动按钮）、地图缩放/拖拽、阶段推进
3. **特殊交互面**：攻击后技能选择、事件卡多目标/多步骤选择、弃牌堆选择
4. **负面与边界**：非当前玩家操作被拒绝、阶段自动跳过边界

### 在线对局测试

| 场景 | 做法 |
|------|------|
| 真实多人流程 | 使用 host/guest 两个浏览器上下文：创建房间 → guest `?join=true` 加入 |
| 交互回归 | 按"交互覆盖清单"逐条验证 |
| 冒烟测试 | 验证页面加载 + 关键元素出现 |

### 截图与附件管理（强制）

1. 使用 `testInfo.outputPath('filename.png')` 生成存放路径
2. 禁止硬编码路径（如 `e2e/screenshots/...`）
3. `test-results/` 目录已被 git 忽略，测试产物不应提交
4. 按需截图，默认配置已开启 `screenshot: 'only-on-failure'`

```typescript
test('Match started', async ({ page }, testInfo) => {
    await page.screenshot({ path: testInfo.outputPath('game-started.png') });
});
```

### 多客户端测试（Multi-Player E2E）

适用于需要模拟真实多玩家交互的测试。

```typescript
import { createMultiPlayerTest } from './helpers/multiPlayer';

test('多玩家游戏流程', async ({ browser }, testInfo) => {
  const multiPlayer = await createMultiPlayerTest({
    browser,
    baseURL: testInfo.project.use.baseURL,
    gameId: 'my-game',
    matchId: 'test-match-id',
    numPlayers: 3,
    disableAudio: true,
    disableTutorial: true,
  });

  try {
    const player1 = multiPlayer.getPlayer('0');
    await multiPlayer.waitForAllPlayersReady();
    // 执行测试逻辑...
  } finally {
    await multiPlayer.cleanup();
  }
});
```

关键要点：
1. 每个玩家必须使用独立的 `BrowserContext`
2. 每个玩家需要独立获取和存储 credentials
3. 根据游戏状态动态选择对应的客户端发送命令
4. 测试结束后必须关闭所有上下文

参考：`e2e/helpers/multiPlayer.ts`、`e2e/ugc-preview.e2e.ts`

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

---

## API 测试

可设置 `MONGO_URI` 复用 Docker MongoDB，避免下载内存 MongoDB 二进制：

```bash
# PowerShell
$env:MONGO_URI="mongodb://localhost:27017/boardgame_test"
npm run test:api
```

> 未设置时使用 `mongodb-memory-server` 自动启动临时 MongoDB。

---

## GameTestRunner

游戏领域层专用测试运行器，输入命令序列 → 执行 pipeline → 断言最终状态。

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
        ],
        expect: { winner: '0' },
    },
    {
        name: '错误测试 - 非法操作',
        commands: [{ type: 'INVALID_MOVE', playerId: '0', payload: {} }],
        expect: { expectError: { command: 'INVALID_MOVE', error: 'invalidMove' } },
    },
];
```

### 4. 运行测试

```typescript
const runner = new GameTestRunner({
    domain: MyGameDomain,
    playerIds: ['0', '1'],
    assertFn: assertMyGame,
});

runner.runAll(testCases);
```

### API 参考

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `domain` | `DomainCore` | 游戏领域内核 |
| `playerIds` | `string[]` | 玩家列表 |
| `setup` | `(playerIds, random) => state` | 可选，自定义初始化 |
| `assertFn` | `(state, expect) => string[]` | 断言函数 |
| `visualizeFn` | `(state) => void` | 可选，状态可视化 |
| `random` | `RandomFn` | 可选，自定义随机数 |
| `silent` | `boolean` | 可选，静默模式 |

| TestCase 字段 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 测试名称 |
| `commands` | `Command[]` | 命令序列 |
| `expect` | `StateExpectation` | 预期结果 |
| `setup` | `(playerIds, random) => state` | 可选，单测自定义初始化 |
| `skip` | `boolean` | 可选，跳过 |

---

## E2E 状态同步工具

### waitForState 工具集

智能状态轮询工具，替代固定时间等待（`waitForTimeout`），提升测试速度和稳定性。

**位置**: `e2e/helpers/waitForState.ts`

**核心函数**:

| 函数 | 用途 | 示例 |
|------|------|------|
| `waitForState` | 通用条件等待 | `await waitForState(page, async () => condition)` |
| `waitForCoreState` | 等待核心状态 | `await waitForCoreState(page, (core) => core.currentPlayer === '1')` |
| `waitForSystemState` | 等待系统状态 | `await waitForSystemState(page, (sys) => sys.phase === 'attack')` |
| `waitForPhaseChange` | 等待阶段变化 | `await waitForPhaseChange(page, 'attack')` |
| `waitForInteractionComplete` | 等待交互完成 | `await waitForInteractionComplete(page)` |
| `waitForGameOver` | 等待游戏结束 | `await waitForGameOver(page)` |
| `waitForStateApplied` | 等待状态应用 | `await waitForStateApplied(page, (core) => core.xxx === yyy)` |

**迁移示例**:

```typescript
// ❌ 旧方式：固定等待
await page.waitForTimeout(500);

// ✅ 新方式：等待阶段变化
await waitForPhaseChange(page, 'attack');

// ❌ 旧方式：固定等待
await applyCoreState(page, state);
await page.waitForTimeout(2000);

// ✅ 新方式：等待状态应用
await applyCoreState(page, state);
await waitForStateApplied(page, (core) => core.currentPlayer === '1');
```

**优点**:
- ✅ 自动适应机器速度（快速机器节省时间，慢速机器不超时）
- ✅ 精确等待到条件满足（不是"等 500ms"，而是"等到阶段变为 X"）
- ✅ 清晰的错误信息（超时时显示当前状态和预期状态）
- ✅ 提升测试速度（平均节省 50% 等待时间）

**完整示例**: 见 `e2e/example-wait-for-state.e2e.ts`

#### waitForState 详细使用指南

##### 1. 基础用法

```typescript
import { waitForCoreState, waitForPhaseChange, waitForInteractionComplete } from './helpers/waitForState';

// 等待玩家切换
await waitForCoreState(page, (core) => core.currentPlayer === '1');

// 等待阶段变化
await waitForPhaseChange(page, 'attack');

// 等待交互完成（没有 pending interaction）
await waitForInteractionComplete(page);

// 等待游戏结束
await waitForGameOver(page);
```

##### 2. 复杂条件等待

```typescript
// 等待多个条件同时满足
await waitForCoreState(page, (core) => {
  return core.currentPlayer === '1' && 
         core.players['1'].hp > 0 &&
         core.players['1'].resources.mana >= 3;
});

// 等待数组长度变化
await waitForCoreState(page, (core) => {
  return core.players['0'].hand.length === 5;
});

// 等待特定单位出现
await waitForCoreState(page, (core) => {
  const units = core.bases[0].minions;
  return units.some(u => u.defId === 'ninja_infiltrator');
});
```

##### 3. 状态注入后等待

```typescript
// 注入状态后必须等待应用完成
await applyCoreStateDirect(page, {
  currentPlayer: '1',
  players: {
    '1': { hp: 10, resources: { mana: 5 } }
  }
});

// 等待状态应用
await waitForStateApplied(page, (core) => {
  return core.currentPlayer === '1' && 
         core.players['1'].resources.mana === 5;
});
```

##### 4. 自定义超时时间

```typescript
// 默认超时 10 秒，可以自定义
await waitForCoreState(
  page, 
  (core) => core.currentPlayer === '1',
  { timeout: 5000 } // 5 秒超时
);
```

##### 5. 错误处理

```typescript
try {
  await waitForCoreState(page, (core) => core.currentPlayer === '1');
} catch (error) {
  // 超时错误会包含当前状态信息
  console.error('等待超时，当前状态:', error.message);
  // 可以截图保存现场
  await page.screenshot({ path: 'timeout-error.png' });
  throw error;
}
```

#### waitForState 常见问题排查

##### 问题 1：超时但条件看起来应该满足

**症状**：
```
TimeoutError: Waiting for condition failed: timeout 10000ms exceeded
Current state: { currentPlayer: '1', ... }
```

**排查步骤**：
1. 检查条件函数是否正确（是否有拼写错误、逻辑错误）
2. 使用 `readCoreState` 手动读取状态，确认实际值
3. 检查是否有动画延迟（UI 更新但状态未同步）
4. 检查是否有其他交互阻塞（pending interaction）

**解决方案**：
```typescript
// 调试：先读取当前状态
const currentState = await readCoreState(page);
console.log('当前状态:', JSON.stringify(currentState, null, 2));

// 然后调整条件函数
await waitForCoreState(page, (core) => {
  console.log('检查条件:', core.currentPlayer); // 添加日志
  return core.currentPlayer === '1';
});
```

##### 问题 2：条件函数抛出异常

**症状**：
```
TypeError: Cannot read property 'length' of undefined
```

**原因**：条件函数访问了不存在的属性

**解决方案**：
```typescript
// ❌ 错误：没有检查 null/undefined
await waitForCoreState(page, (core) => {
  return core.players['1'].hand.length === 5; // 如果 hand 是 undefined 会报错
});

// ✅ 正确：添加安全检查
await waitForCoreState(page, (core) => {
  const hand = core.players?.['1']?.hand;
  return hand !== undefined && hand.length === 5;
});
```

##### 问题 3：状态更新太快，条件一直不满足

**症状**：等待 `currentPlayer === '1'`，但状态从 '0' 跳到 '2'，跳过了 '1'

**原因**：状态更新太快，轮询间隔（100ms）内状态已经变化多次

**解决方案**：
```typescript
// 方案 1：等待最终状态
await waitForCoreState(page, (core) => core.currentPlayer === '2');

// 方案 2：使用事件监听（如果可用）
await page.waitForEvent('console', msg => {
  return msg.text().includes('Player 1 turn started');
});

// 方案 3：减少轮询间隔（不推荐，会增加 CPU 负载）
await waitForCoreState(
  page, 
  (core) => core.currentPlayer === '1',
  { interval: 50 } // 50ms 轮询
);
```

##### 问题 4：waitForInteractionComplete 一直超时

**症状**：调用 `waitForInteractionComplete` 后一直超时

**排查步骤**：
1. 检查是否有 pending interaction 未处理
2. 检查 UI 是否显示了选择框/确认框
3. 检查是否有 bug 导致 interaction 无法完成

**解决方案**：
```typescript
// 调试：读取当前交互状态
const sysState = await readSystemState(page);
console.log('当前交互:', sysState.interaction);

// 如果有 pending interaction，需要先处理
if (sysState.interaction?.pending) {
  // 点击选项或取消
  await page.click('[data-testid="interaction-option-0"]');
}

// 然后再等待完成
await waitForInteractionComplete(page);
```

##### 问题 5：测试在 CI 环境超时，本地正常

**原因**：CI 环境机器较慢，默认 10 秒超时不够

**解决方案**：
```typescript
// 增加超时时间
await waitForCoreState(
  page, 
  (core) => core.currentPlayer === '1',
  { timeout: 30000 } // CI 环境使用 30 秒
);

// 或者使用环境变量
const timeout = process.env.CI ? 30000 : 10000;
await waitForCoreState(page, condition, { timeout });
```

#### waitForState 最佳实践

1. **优先使用专用函数**：`waitForPhaseChange`、`waitForInteractionComplete` 比通用的 `waitForCoreState` 更清晰
2. **条件函数保持简单**：避免复杂逻辑，只检查必要的条件
3. **添加安全检查**：使用可选链 `?.` 和 nullish coalescing `??` 避免异常
4. **合理设置超时**：默认 10 秒适合大多数场景，复杂操作可以增加到 20-30 秒
5. **失败时截图**：超时时保存截图和状态快照，方便排查问题
6. **避免过度等待**：不要在每个操作后都加 `waitForState`，只在关键状态变化时使用

---

## 调试工具

### 测试模式（调试面板）

测试模式用于快速联机测试：执行一次行动后自动切换到另一位玩家视角。

- **入口**：调试面板（右下角工具按钮）→ `⚙️ 系统` 标签页
- **开启**：执行任意 move 后自动切换视角（P0 ⇄ P1）
- **状态**：持久化到本地存储（键：`debug_testMode`）
- **限制**：仅面向开发调试，主要适用于 2 人对局

### 调试测试

```bash
# 详细输出
npx vitest run <文件路径> --reporter=verbose

# 监听模式
npx vitest <文件路径>

# VS Code 调试器：在测试文件中设置断点，使用 "JavaScript Debug Terminal" 运行
```

### ⚠️ 危险操作警告（强制）

**禁止使用以下命令清理进程**：

```bash
# ❌ 禁止：杀掉所有 Node.js 进程
taskkill /F /IM node.exe
killall node

# ❌ 禁止：杀掉所有进程（包括其他项目、IDE、工具）
taskkill /F /IM node.exe 2>$null
Get-Process node | Stop-Process -Force
```

**为什么禁止**：
- 会杀掉所有 Node.js 进程，包括其他项目的服务器
- 会杀掉 VS Code 的语言服务器、调试器等工具
- 会杀掉正在运行的其他测试
- 会导致数据丢失和状态不一致

**正确做法**：

```bash
# ✅ 清理单个测试的端口（推荐，不影响其他并行测试）
# 1. 查找占用端口的 PID
netstat -ano | findstr :5173    # Windows
lsof -ti:5173                   # Linux/Mac

# 2. 只杀掉该测试的进程
taskkill /F /PID <PID>          # Windows
kill -9 <PID>                   # Linux/Mac

# ✅ 清理所有测试环境端口（会影响所有并行测试，谨慎使用）
npm run test:e2e:cleanup        # 清理测试环境端口（5173/19000/19001）

# ✅ 清理开发环境端口（不影响测试）
npm run clean:ports             # 清理开发环境端口（3000/18000/18001）

# ✅ 清理特定 worker 的端口（并行测试）
node scripts/infra/port-allocator.js <workerId>  # workerId: 0, 1, 2...
```

**并行测试端口分配**：
- Worker 0: 3000, 18000, 18001
- Worker 1: 3100, 18100, 18101
- Worker 2: 3200, 18200, 18201
- 每个 worker 使用独立端口范围（+100 偏移）

**如果测试环境混乱**：

1. 先检查端口占用：`npm run test:e2e:check`
2. **优先清理单个测试的端口**（不影响其他测试）：
   ```bash
   # 查找并杀掉特定端口的进程
   netstat -ano | findstr :5173
   taskkill /F /PID <PID>
   ```
3. 如果需要清理所有测试端口（会中断其他并行测试）：`npm run test:e2e:cleanup`
4. 最后手段：重启终端/IDE（不要杀掉所有进程）

---

## 持续集成

当前仓库采用 `quality-gate.yml` 作为主门禁，PR/主分支推送必须通过：

1. `npm run typecheck`
2. `npm run test:games`
3. `npm run i18n:check`
4. `npm run test:e2e:critical`

其中 `test:e2e:critical` 为关键 E2E 烟测（当前覆盖 SmashUp 与 TicTacToe rematch）。

```yaml
# GitHub Actions 示例（quality gate）
- name: Typecheck
  run: npm run typecheck
- name: Run Game Tests
  run: npm run test:games
- name: Run i18n Contract Check
  run: npm run i18n:check
- name: Run Critical E2E
  run: npm run test:e2e:critical
```

---

## 添加新游戏测试

游戏测试会自动包含在 `npm run test:games` 中。如需单独运行：

```json
{
  "scripts": {
    "test:newgame": "vitest run src/games/newgame"
  }
}
```

---

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
